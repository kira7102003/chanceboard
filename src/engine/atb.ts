/**
 * ATB game reducer + unit-init helpers.
 * Pure functions — no side effects, no timers here.
 * The Zustand store drives the setInterval and calls these.
 */

import type { GameState } from '../types/game'
import type { Unit, UnitFlags } from '../types/unit'
import type { Move, MoveSlot } from '../types/move'
import type { Card } from '../types/card'
import type { StatusEntry } from '../types/status'
import { characters, moves as allMoves, cards as allCards, deckWeights } from '../data/db'
import type { PieceType } from '../types/piece'
import { calcBAT, effectiveSPD, resolveHit, applyDamage, elementMult } from './combat'
import { runEffectOps, runCardEffects, tickStatuses } from './effects'
import type { LogLine } from './effects'

// ─── Unit factory ──────────────────────────────────────────────────────────────

let _uid = 0
export function makeUnit(charId: string, side: 'A' | 'B', slot: 1 | 2 | 3, startAt: number): Unit {
  const char = characters.find(c => c.id === charId)!
  const charMoves = allMoves.filter(m => m.ownerId === charId)

  const moveMap = {} as Record<MoveSlot, Move>
  for (const m of charMoves) moveMap[m.slot] = m

  const flags: UnitFlags = {}
  const initStatuses: StatusEntry[] = []

  // Apply battleStart passive: staticFlags + initial statuses
  const passive = charMoves.find(m => m.slot === '被')
  if (passive?.effectTrigger === 'battleStart') {
    for (const op of passive.effectOps) {
      if (op.op === 'staticFlag') {
        ;(flags as unknown as Record<string, unknown>)[op.flag as string] = op.value
      } else if (op.op === 'status') {
        const dur = (op.duration as number) ?? 9999
        initStatuses.push({
          key:       op.key as StatusEntry['key'],
          mode:      ((op.mode as string) ?? 'flat') as StatusEntry['mode'],
          value:     (op.value as number) ?? 0,
          expiresAt: startAt + dur * 10,
        })
      }
    }
  }

  const unit: Unit = {
    id: `${side}-${charId}-${++_uid}`,
    characterId: charId,
    isHuman: char.isHuman !== false,
    name: char.name,
    side,
    slot,
    element: char.element,
    hp: char.hp,
    maxHp: char.hp,
    baseAtk: char.atk,
    baseDef: char.def,
    baseSpd: char.spd,
    moves: moveMap,
    alive: true,
    nextActionAt: startAt,
    statuses: initStatuses,
    moveCooldownUntil: {},
    flags,
    _didNotMoveThisTurn: true,
  }
  return unit
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function frontSlot(side: 'A' | 'B'): 1 | 3 { return side === 'A' ? 3 : 1 }
function backSlot(side: 'A' | 'B'): 1 | 3 { return side === 'A' ? 1 : 3 }
function slotDistanceLabel(side: 'A' | 'B', slot: 1 | 2 | 3): string {
  if (slot === 2) return '中'
  return slot === frontSlot(side) ? '近' : '遠'
}
function mirrorOf(slot: 1 | 2 | 3): 1 | 2 | 3 { return (4 - slot) as 1 | 2 | 3 }
function globalIndex(side: 'A' | 'B', slot: 1 | 2 | 3): number {
  return side === 'A' ? slot - 1 : 3 + slot - 1
}
function nearestGunTargets(actorSide: 'A' | 'B', actorSlot: 1 | 2 | 3, enemies: Unit[]): Unit[] {
  if (enemies.length === 0) return []
  const origin = globalIndex(actorSide, actorSlot)
  const minDistance = Math.min(...enemies.map(enemy => Math.abs(globalIndex(enemy.side, enemy.slot) - origin)))
  return enemies.filter(enemy => Math.abs(globalIndex(enemy.side, enemy.slot) - origin) === minDistance)
}

// ─── Public deck builder ────────────────────────────────────────────────────────

export function buildPublicDeck(piece: PieceType): Card[] {
  const pool: Card[] = []
  for (const dw of deckWeights) {
    const w = dw.weightsByPiece[piece]
    if (!w) continue
    const card = allCards.find(c => c.id === dw.cardId)
    if (!card) continue
    for (let i = 0; i < w; i++) pool.push(card)
  }
  return shuffleArr(pool)
}

const HAND_LIMIT = 4

// ─── Initial deal ────────────────────────────────────────────────────────────────

function drawN(deck: Card[], n: number): [Card[], Card[]] {
  const hand = deck.splice(0, n)
  return [hand, deck]
}

function buildCustomDeckOrder(deckIds: string[]): Card[] {
  const resolved = deckIds.flatMap(id => {
    const card = allCards.find(c => c.id === id)
    return card ? [card] : []
  })
  return shuffleArr(resolved)
}

export function initBattleState(
  charIdsA: string[],
  charIdsB: string[],
  piece: PieceType,
  deckAIds: string[] = [],
  deckBIds: string[] = [],
): GameState {
  const startClock = 0
  // SA: A front/mid/back = 3/2/1; B front/mid/back = 1/2/3.
  const slotOrderA: (1|2|3)[] = [3, 2, 1]
  const teamA = charIdsA.map((id, i) => makeUnit(id, 'A', slotOrderA[i], startClock))
  const teamB = charIdsB.map((id, i) => makeUnit(id, 'B', (i + 1) as 1 | 2 | 3, startClock))

  // The first turn follows the same SPD → BAT rule as every later turn.
  // Previously every unit started at tick 0, so array order incorrectly won.
  for (const unit of [...teamA, ...teamB]) unit.nextActionAt = startClock + calcBAT(unit)

  const pubDeck = buildPublicDeck(piece)
  const [handA, deckAfterA] = drawN(pubDeck, HAND_LIMIT)
  const [handB, finalDeck]  = drawN(deckAfterA, HAND_LIMIT)

  const customDeckOrder = buildCustomDeckOrder(deckAIds)
  const customDeckOrderB = buildCustomDeckOrder(deckBIds)
  const handCustomA = customDeckOrder.length ? [customDeckOrder.shift()!] : []
  const handCustomB = customDeckOrderB.length ? [customDeckOrderB.shift()!] : []

  return {
    phase: 'act',
    selectedIds: [],
    selectedPiece: piece,
    deckDraft: [],
    customDeck: [],
    customDeckB: [],
    teamA,
    teamB,
    drawPublic: finalDeck,
    discardPublic: [],
    handA,
    handB,
    handCustomA,
    handCustomB,
    lastDiscardedA: null,
    lastDiscardedB: null,
    clock: 0,
    dealtRound: 0,
    round: 1,
    actingUnitId: null,
    actPending: { cardId: null, moveSlot: null },
    flowerActionUsed: {},
    discardActionUsed: {},
    log: [],
    winner: null,
    winnerReason: null,
    autoBattleA: false,
    autoBattleB: false,
    customDeckOrder,
    customDeckOrderB,
  }
}

// ─── Round card deal ─────────────────────────────────────────────────────────────

function drawPublicCard(s: GameState): Card | null {
  if (s.drawPublic.length === 0) {
    if (s.discardPublic.length === 0) return null
    s.drawPublic = shuffleArr(s.discardPublic)
    s.discardPublic = []
  }
  return s.drawPublic.shift() ?? null
}

function dealRoundCards(s: GameState) {
  while (s.handA.length < HAND_LIMIT) {
    const c = drawPublicCard(s)
    if (!c) break
    s.handA.push(c)
  }
  while (s.handB.length < HAND_LIMIT) {
    const c = drawPublicCard(s)
    if (!c) break
    s.handB.push(c)
  }
  if (s.customDeckOrder.length > 0)  s.handCustomA.push(s.customDeckOrder.shift()!)
  if (s.customDeckOrderB.length > 0) s.handCustomB.push(s.customDeckOrderB.shift()!)
}

// ─── ATB tick ────────────────────────────────────────────────────────────────────
// Called every 100ms real-time; advances clock by 1 tick.

export function tickATB(gs: GameState): GameState {
  const s = deepClone(gs)
  s.clock++

  // status DoT/HoT every 10 ticks (=1 game-second)
  const log: LogLine[] = []
  if (s.clock % 10 === 0) tickStatuses(s, s.clock, log)
  for (const l of log) s.log.push(l)

  // round advance every 100 ticks (=10 seconds)
  if (s.clock % 100 === 0) {
    runRoundEndPassives(s)             // SA 7.7: roundEnd passives first
    dealRoundCards(s)                  // SA 7.8: refill hands, then
    s.round++                          // advance counter, then
    runRoundPassives(s, 'roundStart')  // SA 7.7: roundStart with fresh hand
  }

  // check winner
  const winCheck = checkWinner(s)
  if (winCheck) {
    s.winner = winCheck.winner
    s.winnerReason = winCheck.reason
    s.phase = 'end'
    return s
  }

  return s
}

// When nobody can act, resolve the otherwise idle countdown immediately while
// still processing every status tick and round boundary along the way.
export function fastForwardToNextReady(gs: GameState): GameState {
  let s = gs
  const MAX_IDLE_TICKS = 10000
  for (let i = 0; i < MAX_IDLE_TICKS && s.phase !== 'end' && getReadyUnits(s).length === 0; i++) {
    s = tickATB(s)
  }
  return s
}

function runRoundPassives(s: GameState, trigger: 'roundStart' | 'roundEnd') {
  const log: LogLine[] = []
  for (const u of [...s.teamA, ...s.teamB]) {
    if (!u.alive) continue
    const passive = u.moves['被']
    if (!passive || passive.effectTrigger !== trigger) continue
    const chance = passive.effectChance ?? 1
    if (Math.random() < chance) {
      runEffectOps(passive.effectOps, u, null, s, s.clock, 1, log)
    }
  }
  for (const l of log) s.log.push(l)
}

function runRoundEndPassives(s: GameState) { runRoundPassives(s, 'roundEnd') }

function checkWinner(s: GameState): { winner: 'A' | 'B' | 'draw'; reason: string } | null {
  const aAlive = s.teamA.some(u => u.alive)
  const bAlive = s.teamB.some(u => u.alive)
  if (!aAlive && !bAlive) return { winner: 'draw', reason: '雙方同時倒下' }
  if (!aAlive) return { winner: 'B', reason: 'A 方全滅' }
  if (!bAlive) return { winner: 'A', reason: 'B 方全滅' }
  // Time limit: after round 10, compare remaining HP
  if (s.round > 10) {
    const hpA = s.teamA.reduce((sum, u) => sum + (u.alive ? u.hp : 0), 0)
    const hpB = s.teamB.reduce((sum, u) => sum + (u.alive ? u.hp : 0), 0)
    if (hpA > hpB) return { winner: 'A', reason: `時間到！A ${hpA} HP > B ${hpB} HP` }
    if (hpB > hpA) return { winner: 'B', reason: `時間到！B ${hpB} HP > A ${hpA} HP` }
    return { winner: 'draw', reason: '時間到！HP 相同，平局' }
  }
  return null
}

// ─── Player action: play card ─────────────────────────────────────────────────

export function doPlayCard(gs: GameState, side: 'A' | 'B', cardId: string): GameState {
  const s = deepClone(gs)
  const publicHand = side === 'A' ? s.handA : s.handB
  const customHand = side === 'A' ? s.handCustomA : s.handCustomB
  let hand = publicHand
  let idx = hand.findIndex(c => c.id === cardId)
  let isCustom = false
  if (idx === -1) {
    hand = customHand
    idx = hand.findIndex(c => c.id === cardId)
    isCustom = idx !== -1
  }
  if (idx === -1) return gs

  const card = hand[idx]
  const actingUnit = getReadyUnits(s).find(u => u.side === side)
  if (!actingUnit) return gs
  const actionKey = `${actingUnit.id}:${actingUnit.nextActionAt}`
  s.flowerActionUsed ??= {}
  if (!card.isSuitCard && s.flowerActionUsed[side] === actionKey) return gs

  hand.splice(idx, 1)
  if (!isCustom) s.discardPublic.push(card)
  if (!card.isSuitCard) {
    s.flowerActionUsed[side] = actionKey
    actingUnit.assignedCardName = card.name
  }

  const log: LogLine[] = []
  // For flower cards, run effects; for suit cards, add to condition pool
  if (!card.isSuitCard && card.effectOps.length) {
    runCardEffects(card, actingUnit, s, s.clock, log)
  }
  for (const l of log) s.log.push(l)
  s.log.push({ html: `${side} 打出 <b>${card.name}</b>` })
  return s
}

// ─── Player action: move unit ─────────────────────────────────────────────────

export function doMoveUnit(gs: GameState, unitId: string, toSlot: 1 | 2 | 3): GameState {
  const s = deepClone(gs)
  const u = findUnit(s, unitId)
  if (!u || !u.alive) return gs
  if (u.statuses.some(st => st.key === 'rooted') && !u.flags.immuneToRooted) return gs
  // SA A2: can only move 1 slot at a time, no jumping across 2 slots
  if (Math.abs(toSlot - u.slot) > 1) return gs
  // Prevent moving twice in the same turn
  if (!u._didNotMoveThisTurn) return gs
  u.slot = toSlot
  u._didNotMoveThisTurn = false
  const moveLabel = slotDistanceLabel(u.side, toSlot)
  s.log.push({ html: `<b>${u.name}</b> 移至 ${moveLabel}距離` })
  return s
}

// ─── Player action: execute move ─────────────────────────────────────────────

export interface MoveAction {
  unitId: string
  moveSlot: MoveSlot
  targetId: string | null
  cardId: string | null // suit card consumed
}

export function doExecuteMove(gs: GameState, action: MoveAction): GameState {
  const s = deepClone(gs)
  const u = findUnit(s, action.unitId)
  if (!u || !u.alive) return gs

  const move = u.moves[action.moveSlot]
  if (!move) return gs

  // Check cooldown
  if ((u.moveCooldownUntil[move.id] ?? 0) > s.clock) {
    s.log.push({ html: `<b>${u.name}</b> 的 ${move.name} 冷卻中` })
    return gs
  }

  // Sword requires attacker at 近(slot1) — same for both sides
  if (move.rangeType === '劍' && u.slot !== frontSlot(u.side)) {
    s.log.push({ html: `<b>${u.name}</b> 劍技需在近距才能使用` })
    return gs
  }

  // 封招 (sealed): cannot use any moves
  if (u.statuses.some(st => st.key === 'sealed')) {
    s.log.push({ html: `<b>${u.name}</b> 被封招，無法出招` })
    return gs
  }

  // Resolve targets before announcing the move. A confirmed move still spends
  // its cards even when no target is currently reachable.
  const log: LogLine[] = []
  const targets = resolveTargetUnits(move, u, action.targetId, s)

  // Check condition: consume suit cards from hand
  const publicHand = u.side === 'A' ? s.handA : s.handB
  const customHand = u.side === 'A' ? s.handCustomA : s.handCustomB
  const condN = move.condition ?? 1
  const suitColor = { '劍': 'red', '槍': 'green', '法': 'blue', '願': 'yellow', '被': null }[action.moveSlot] as string | null

  const liberated = u.statuses.some(st => st.key === 'liberated')
  const needed = liberated ? 1 : condN

  if (suitColor) {
    let found = 0
    const publicRemove: number[] = []
    const customRemove: number[] = []
    for (let i = 0; i < publicHand.length && found < needed; i++)
      if (publicHand[i].color === suitColor) { publicRemove.push(i); found++ }
    for (let i = 0; i < customHand.length && found < needed; i++)
      if (customHand[i].color === suitColor) { customRemove.push(i); found++ }
    if (found < needed) {
      s.log.push({ html: `${u.side} 手牌不足，無法出招` })
      return gs
    }
    for (const i of publicRemove.reverse()) s.discardPublic.push(publicHand.splice(i, 1)[0])
    for (const i of customRemove.reverse()) customHand.splice(i, 1)
  }

  // Announce move: show attacker → target (or group label)
  const SLOT_COLOR: Record<string, string> = { sword:'#e87733', gun:'#22cc77', magic:'#9955ee', wish:'#ddaa22', passive:'#666' }
  const moveColor = SLOT_COLOR[action.moveSlot] ?? '#aaa'
  const moveLabel = `<span style="color:${moveColor}">【${move.name}】</span>`
  const dealsDamage = typeof move.powerRatio === 'number' && move.powerRatio > 0
  const allies = (u.side === 'A' ? s.teamA : s.teamB).filter(unit => unit.alive)
  const allEnemies = (u.side === 'A' ? s.teamB : s.teamA).filter(unit => unit.alive)
  const deadAllies = (u.side === 'A' ? s.teamA : s.teamB).filter(unit => !unit.alive)
  const effectTargets = new Set(move.effectOps.map(op => op.target))
  const visualTargets = dealsDamage
    ? targets
    : effectTargets.has('enemyAll')
      ? allEnemies
    : effectTargets.has('allyAll')
      ? allies
      : effectTargets.has('sameCell') || effectTargets.has('sameCellAllies')
        ? allies.filter(unit => unit.slot === u.slot)
        : effectTargets.has('randomDeadAlly') && deadAllies.length > 0
          ? deadAllies
          : effectTargets.has('allyLowestHp')
            ? [allies.reduce((lowest, unit) => unit.hp < lowest.hp ? unit : lowest, u)]
        : [u]
  const animationIsGroup = move.scope === '群' || visualTargets.length > 1
  const firstTarget = animationIsGroup ? undefined : visualTargets[0]
  const groupTargets = animationIsGroup ? visualTargets.map(t => ({ name: t.name, charId: t.characterId })) : undefined
  const selfTargetOnly = !dealsDamage && visualTargets.length === 1 && visualTargets[0].id === u.id
  const moveAnim  = { moveId: move.id, moveName: move.name, moveSlot: action.moveSlot, charName: u.name, charId: u.characterId, attackerSide: u.side as 'A' | 'B', targetSide: visualTargets[0]?.side ?? u.side, targetName: firstTarget?.name, targetCharId: firstTarget?.characterId, targetUnitId: firstTarget?.id, groupTargets, dealsDamage, hasTarget: visualTargets.length > 0, selfTargetOnly, missed: false }
  const targetDesc = move.scope === '群'
    ? '⚔ 群體'
    : targets.length > 0
      ? `→ <b>${targets[0].name}</b>`
      : '（無目標）'
  s.log.push({ html: `${moveLabel} <b>${u.name}</b> ${targetDesc}`, moveAnim })

  if (move.effectTrigger === 'preHit') {
    for (const t of targets) runEffectOps(move.effectOps, u, t, s, s.clock, 1, log)
  }

  // Resolve hits
  let killedAny = false
  let landedHits = 0
  const isGroup = move.scope === '群'
  for (const t of targets) {
    // Confused: 50% chance attack self
    if (u.statuses.some(st => st.key === 'confused') && Math.random() < 0.5) {
      const { hit, rawDamage } = resolveHit(u, u, move)
      if (hit) {
        landedHits++
        const { hpLost } = applyDamage(u, rawDamage)
        log.push({ html: `🔄 混亂！<b>${u.name}</b> 攻擊自己 <span class="dmg-num">-${hpLost}</span>` })
      }
    } else {
      // SA D1: collect same-slot allies of defender for lightSourceAura DEF boost
      const defTeam = t.side === 'A' ? s.teamA : s.teamB
      const targetSlotAllies = defTeam.filter(a => a.alive && a.slot === t.slot && a.id !== t.id)
      const { hit, crit, rawDamage } = resolveHit(u, t, move, targetSlotAllies)
      if (!hit) {
        // Group: show per-target miss; single: attacker→target already in announcement
        log.push({ html: isGroup
          ? `<b>${t.name}</b> ✦ <span class="dmg-miss">Miss！</span>`
          : `✦ <span class="dmg-miss">Miss！</span>`
        })
        continue
      }

      landedHits++

      const hasReflect = move.effectOps.some(op => op.op === 'reflectHalfHeal')
      const { hpLost } = applyDamage(t, rawDamage)
      t._lastHitMoveId = move.id
      const critTag = crit ? ' <span class="dmg-crit">💥爆擊</span>' : ''
      // Group: show target name per line; single: attacker→target already in announcement
      log.push({ html: isGroup
        ? `<b>${t.name}</b> 受到 ${hpLost} 傷害（HP <span class="dmg-num">-${hpLost}</span>）${critTag}`
        : `<b>${t.name}</b> 受到 ${hpLost} 傷害（HP <span class="dmg-num">-${hpLost}</span>）${critTag}`
      })

      if (hasReflect) {
        const healAmt = Math.floor(hpLost / 2)
        u.hp = Math.min(u.maxHp, u.hp + healAmt)
        log.push({ html: `<b>${u.name}</b> 吸血 <span class="dmg-heal">+${healAmt} HP</span>` })
      }

      if (!t.alive) {
        log.push({ html: `<b>${t.name}</b> 倒下！` })
        killedAny = true
      }

      // SA 7.5 結冰: being hit cancels frozen status, restore remaining freeze time
      if (t.statuses.some(st => st.key === 'frozen')) {
        const frozenEntries = t.statuses.filter(st => st.key === 'frozen')
        const maxExpiry = Math.max(...frozenEntries.map(st => st.expiresAt))
        const remaining = maxExpiry - s.clock
        if (remaining > 0) t.nextActionAt = Math.max(s.clock, t.nextActionAt - remaining)
        t.statuses = t.statuses.filter(st => st.key !== 'frozen')
        log.push({ html: `<b>${t.name}</b> 結冰解除` })
      }

      // SA 7.5 還手(counter): retaliate with powerRatio=1.0, attacker's element, no crit
      if (t.alive && t.statuses.some(st => st.key === 'counter') && move.name !== '反擊' && u.id !== t.id) {
        t.nextActionAt = s.clock
        const counterMove: Move = {
          id: 'counter', ownerId: t.id, slot: '劍', name: '反擊',
          condition: null, rangeType: t.element, scope: '單',
          powerRatio: 1.0, hitRate: 1, critRate: 0, cooldown: null,
          description: '', effectTrigger: null, effectOps: [], effectChance: 0,
        }
        const cResult = resolveHit(t, u, counterMove)
        if (cResult.hit) {
          const { hpLost: cHpLost } = applyDamage(u, cResult.rawDamage)
          log.push({ html: `<b>${t.name}</b> 還手！→ <b>${u.name}</b> <span class="dmg-num">-${cHpLost}</span>${!u.alive ? ' → 倒下！' : ''}` })
        } else {
          log.push({ html: `<b>${t.name}</b> 還手未命中` })
        }
      }

      // onHit effects
      if (move.effectTrigger === 'onHit') {
        const chance = move.effectChance ?? 1
        if (Math.random() < chance) runEffectOps(move.effectOps, u, t, s, s.clock, 1, log)
      }

      // Attacker passives that trigger whenever one of their moves lands.
      const hitPassive = u.moves['被']
      if (hitPassive?.effectTrigger === 'onHit') {
        const chance = hitPassive.effectChance ?? 1
        if (Math.random() < chance) runEffectOps(hitPassive.effectOps, u, t, s, s.clock, 1, log)
      }

      // onCrit effects
      if (crit && move.effectTrigger === 'onCrit') {
        runEffectOps(move.effectOps, u, t, s, s.clock, 1, log)
      }

      // powerMult on crit
      if (crit && move.effectOps.some(op => op.op === 'powerMult')) {
        // damage already done; additional mult is conceptual
      }

      // burning: on each action end
      if (u.statuses.some(st => st.key === 'burning')) {
        const burnDmg = Math.floor(u.maxHp * 0.05)
        applyDamage(u, burnDmg)
        log.push({ html: `🔥 <b>${u.name}</b> 燃燒受到 ${burnDmg} 傷害` })
      }
    }
  }
  moveAnim.missed = dealsDamage && targets.length > 0 && landedHits === 0

  // onKill effects
  if (killedAny && move.effectTrigger === 'onKill') {
    runEffectOps(move.effectOps, u, null, s, s.clock, 1, log)
  }

  // postAction effects
  if (move.effectTrigger === 'postAction') {
    const chance = move.effectChance ?? 1
    if (Math.random() < chance) runEffectOps(move.effectOps, u, targets[0] ?? null, s, s.clock, 1, log)
  }

  for (const l of log) s.log.push(l)

  // Apply cooldown
  if (move.cooldown) {
    // Database cooldown is measured in rounds. One round is 100 ticks (10s).
    u.moveCooldownUntil[move.id] = s.clock + move.cooldown * 100
  }

  // Advance ATB timer — BAT- shortens cooldown, BAT+ extends it
  const bat = calcBAT(u)
  const batMinusSt = u.statuses.find(st => st.key === 'batMinus')
  const batPlusSt  = u.statuses.find(st => st.key === 'batPlus')
  let effBat = bat
  if (batMinusSt) effBat = Math.max(10, effBat - batMinusSt.value)
  if (batPlusSt)  effBat += batPlusSt.value
  const linked = u.statuses.some(st => st.key === 'linked')
  u.nextActionAt = s.clock + (linked ? Math.floor(effBat / 2) : effBat)
  u._didNotMoveThisTurn = true  // reset move allowance for next turn
  u.assignedCardName = undefined

  // Check winner
  const winCheck = checkWinner(s)
  if (winCheck) {
    s.winner = winCheck.winner
    s.winnerReason = winCheck.reason
    s.phase = 'end'
  }

  return s
}

// ─── Pass action ─────────────────────────────────────────────────────────────

export function doPass(gs: GameState, unitId: string): GameState {
  const s = deepClone(gs)
  const u = findUnit(s, unitId)
  if (!u) return gs

  u._didNotMoveThisTurn = true
  const log: LogLine[] = []

  // passive onPass
  const passive = u.moves['被']
  if (passive?.effectTrigger === 'onPass') {
    const chance = passive.effectChance ?? 1
    if (Math.random() < chance) runEffectOps(passive.effectOps, u, null, s, s.clock, 1, log)
  }

  for (const l of log) s.log.push(l)
  s.log.push({ html: `<b>${u.name}</b> PASS` })

  const bat = calcBAT(u)
  const batMinusSt = u.statuses.find(st => st.key === 'batMinus')
  const batPlusSt  = u.statuses.find(st => st.key === 'batPlus')
  let effBat = bat
  if (batMinusSt) effBat = Math.max(10, effBat - batMinusSt.value)
  if (batPlusSt)  effBat += batPlusSt.value
  u.nextActionAt = s.clock + effBat
  u.assignedCardName = undefined

  return s
}

// ─── helpers ─────────────────────────────────────────────────────────────────

export function findUnit(s: GameState, id: string): Unit | undefined {
  return [...s.teamA, ...s.teamB].find(u => u.id === id)
}

function resolveTargetUnits(move: Move, actor: Unit, targetId: string | null, s: GameState): Unit[] {
  const isHidden = (u: Unit) => u.statuses.some(st => st.key === 'hidden')
  const enemies  = (actor.side === 'A' ? s.teamB : s.teamA).filter(u => u.alive && !isHidden(u))

  const isAwakened = actor.statuses.some(st => st.key === 'awakened')

  // SA 7.2: within a valid target pool, prefer taunting units first,
  // then tie-break by HP (awakened → lowest HP, default → highest HP)
  function pickBest(pool: Unit[]): Unit | undefined {
    if (pool.length === 0) return undefined
    const taunting = pool.filter(u => u.flags.taunt)
    const cands    = taunting.length > 0 ? taunting : pool
    if (cands.length === 1) return cands[0]
    return cands.reduce((b, u) => isAwakened ? (u.hp < b.hp ? u : b) : (u.hp > b.hp ? u : b))
  }

  // Sword: actor must be at own front and hits the mirrored enemy slot.
  if (move.rangeType === '劍') {
    const swordTargetSlot = mirrorOf(actor.slot)
    const mirrored = enemies.filter(e => e.slot === swordTargetSlot)
    if (move.scope === '群') return mirrored
    if (targetId) {
      const t = findUnit(s, targetId)
      if (t && t.side !== actor.side && t.alive && t.slot === swordTargetSlot && !isHidden(t)) {
        // SA 7.2: redirect to taunter if player did not pick the taunter
        const taunterAtFront = mirrored.find(u => u.flags.taunt)
        return [taunterAtFront && taunterAtFront.id !== t.id ? taunterAtFront : t]
      }
    }
    const best = pickBest(mirrored)
    return best ? [best] : []
  }

  // Magic crossOf(slot)=slot: physical near→far, mid→mid, far→near.
  if (move.rangeType === '法') {
    const crossed = enemies.filter(e => e.slot === actor.slot)
    if (move.scope === '群') return crossed
    const best = pickBest(crossed)
    return best ? [best] : []
  }

  // Gun: globally nearest occupied enemy slot; AoE hits everyone in that slot.
  if (move.rangeType === '槍') {
    const near = nearestGunTargets(actor.side, actor.slot, enemies)
    if (move.scope === '群') return near
    const best = pickBest(near)
    return best ? [best] : []
  }

  if (move.scope === '群') return enemies

  // Default single-target: explicit targetId (taunt-redirect) or HP tie-break
  if (targetId) {
    const t = findUnit(s, targetId)
    if (t && t.side !== actor.side && t.alive && !isHidden(t)) {
      // SA 7.2: redirect to taunter if target is not the taunter
      const taunting = enemies.filter(u => u.flags.taunt)
      if (taunting.length > 0 && !t.flags.taunt) {
        const best = pickBest(taunting)
        return best ? [best] : []
      }
      return [t]
    }
  }
  const best = pickBest(enemies)
  return best ? [best] : []
}

export function doDiscardCard(gs: GameState, side: 'A' | 'B', cardId: string): GameState {
  const s = deepClone(gs)
  const publicHand = side === 'A' ? s.handA : s.handB
  const customHand = side === 'A' ? s.handCustomA : s.handCustomB
  let hand = publicHand
  let idx = hand.findIndex(c => c.id === cardId)
  let isCustom = false
  if (idx === -1) {
    hand = customHand
    idx = hand.findIndex(c => c.id === cardId)
    isCustom = idx !== -1
  }
  if (idx === -1) return gs
  const actingUnit = getReadyUnits(s).find(u => u.side === side)
  if (!actingUnit) return gs
  const actionKey = `${actingUnit.id}:${actingUnit.nextActionAt}`
  s.discardActionUsed ??= {}
  if (s.discardActionUsed[side] === actionKey) return gs
  const [card] = hand.splice(idx, 1)
  if (!isCustom) s.discardPublic.push(card)
  s.discardActionUsed[side] = actionKey
  s.log.push({ html: `${side} 棄牌 <b>${card.name}</b>（下回合補牌）` })
  return s
}

export function doToggleAuto(gs: GameState, side: 'A' | 'B'): GameState {
  const s = deepClone(gs)
  if (side === 'A') s.autoBattleA = !s.autoBattleA
  else              s.autoBattleB = !s.autoBattleB
  return s
}

// Determine ideal slot based on what moves the unit can ACTUALLY USE right now
// (has the cards in hand + not on cooldown). Falls back to full kit if nothing affordable.
function kitPreferredSlot(unit: Unit, enemies: Unit[], hand: Card[], clock: number): 1 | 2 | 3 {
  const suitOf: Record<string, string> = { '劍': 'red', '槍': 'green', '法': 'blue', '願': 'yellow' }
  const attackSlots: MoveSlot[] = ['劍', '槍', '法', '願']
  const liberated = unit.statuses.some(st => st.key === 'liberated')

  function sumPwr(affordableOnly: boolean) {
    let swordPwr = 0, gunPwr = 0, magicPwr = 0
    for (const s of attackSlots) {
      const m = unit.moves[s]
      if (!m || !m.powerRatio) continue
      if (affordableOnly) {
        if ((unit.moveCooldownUntil[m.id] ?? 0) > clock) continue
        const color = suitOf[s]
        if (color) {
          const needed = liberated ? 1 : (m.condition ?? 1)
          if (hand.filter(c => c.color === color).length < needed) continue
        }
      }
      if (m.rangeType === '劍')       swordPwr += m.powerRatio
      else if (m.rangeType === '槍')    gunPwr   += m.powerRatio
      else if (m.rangeType === '法')  magicPwr += m.powerRatio
    }
    return { swordPwr, gunPwr, magicPwr }
  }

  // First try: only count moves affordable with current hand
  let { swordPwr, gunPwr, magicPwr } = sumPwr(true)
  // Fallback: use full kit if no affordable attack moves exist
  if (swordPwr + gunPwr + magicPwr === 0) {
    ;({ swordPwr, gunPwr, magicPwr } = sumPwr(false))
  }

  const total = swordPwr + gunPwr + magicPwr
  if (total === 0) return backSlot(unit.side)  // pure support — retreat to back row

  // Magic-dominant: crossOf(slot)=slot → align to the enemy slot.
  if (magicPwr >= swordPwr && magicPwr >= gunPwr) {
    const count: Record<number, number> = { 1: 0, 2: 0, 3: 0 }
    for (const e of enemies) count[e.slot] = (count[e.slot] ?? 0) + 1
    const enemySlot = ([1, 2, 3] as const).reduce((a, b) => (count[b] ?? 0) > (count[a] ?? 0) ? b : a)
    return enemySlot
  }

  // Sword dominant → own front slot.
  if (swordPwr >= gunPwr) return frontSlot(unit.side)

  // Gun dominant → mid row (can hit anyone from slot 2, safer than front)
  return 2
}

// Score all usable moves from a given slot position.
// Returns sorted list (highest score first); empty list means no usable moves.
function scoreMoves(
  unit: Unit,
  fromSlot: 1 | 2 | 3,
  enemies: Unit[],
  allies: Unit[],
  hand: Card[],
  clock: number,
): Array<{ slot: MoveSlot; score: number; targetId: string | null }> {
  const suitOf: Record<string, string>    = { '劍': 'red', '槍': 'green', '法': 'blue', '願': 'yellow' }
  const attackSlots: MoveSlot[]           = ['劍', '槍', '法', '願']
  const liberated = unit.statuses.some(st => st.key === 'liberated')
  const result: Array<{ slot: MoveSlot; score: number; targetId: string | null }> = []

  for (const slot of attackSlots) {
    const move = unit.moves[slot]
    if (!move) continue
    // Cooldown check
    if ((unit.moveCooldownUntil[move.id] ?? 0) > clock) continue
    // Suit-card affordability
    const color = suitOf[slot]
    if (color) {
      const needed = liberated ? 1 : (move.condition ?? 1)
      if (hand.filter(c => c.color === color).length < needed) continue
    }

    // Support / wish moves (no powerRatio): score by how hurt the team is
    if (!move.powerRatio) {
      const minHpPct = Math.min(
        unit.hp / unit.maxHp,
        ...allies.map(a => a.hp / a.maxHp),
      )
      // Only queue support when someone is actually hurt; 0.7+ means barely needed
      const score = 0.15 + (1 - minHpPct) * 0.65
      result.push({ slot, score, targetId: null })
      continue
    }

    // Attack moves: build reachable enemy list
    let reachable = enemies.filter(e => !e.statuses.some(s => s.key === 'hidden'))

    if (move.rangeType === '劍') {
      if (fromSlot !== frontSlot(unit.side)) continue
      const targetSlot = mirrorOf(fromSlot)
      reachable = reachable.filter(e => e.slot === targetSlot)
    }

    // Magic crossOf(slot)=slot.
    if (move.rangeType === '法') {
      reachable = reachable.filter(e => e.slot === fromSlot)
    }

    // Gun hits the globally nearest occupied enemy slot.
    if (move.rangeType === '槍' && reachable.length > 0) {
      reachable = nearestGunTargets(unit.side, fromSlot, reachable)
    }

    if (reachable.length === 0) continue     // no valid targets → skip

    let score = 0
    let targetId: string | null = null

    if (move.scope === '群') {
      const moveElement = move.rangeType === '劍' || move.rangeType === '槍' || move.rangeType === '法' ? move.rangeType : null
      const avgEl = reachable.reduce((s, e) =>
        s + elementMult(moveElement, e.element), 0) / reachable.length
      score = move.powerRatio * reachable.length * avgEl
    } else {
      let best: Unit
      if (move.rangeType === '槍') {
        best = reachable.reduce((a, b) => (a.hp / a.maxHp) <= (b.hp / b.maxHp) ? a : b)
      } else {
        // Other single-target: prefer lowest HP% (finish kills first)
        best = reachable.reduce((a, b) => (a.hp / a.maxHp) <= (b.hp / b.maxHp) ? a : b)
      }
      const moveElement = move.rangeType === '劍' || move.rangeType === '槍' || move.rangeType === '法' ? move.rangeType : null
      const elBonus = elementMult(moveElement, best.element)
      score = move.powerRatio * elBonus * (best.hp / best.maxHp < 0.3 ? 1.4 : 1)
      targetId = best.id
    }

    if (score > 0) result.push({ slot, score, targetId })
  }

  return result.sort((a, b) => b.score - a.score)
}

// Smart AI: scores moves from current position, optionally repositions if it
// would unlock meaningfully better moves, then executes the best candidate.
export function autoPlayUnit(gs: GameState, unit: Unit): GameState {
  // Auto mode uses at most one flower card during this unit action, matching
  // the manual flow: use flower first, then choose movement/move and 出手.
  const initialHand = unit.side === 'A'
    ? [...gs.handA, ...gs.handCustomA]
    : [...gs.handB, ...gs.handCustomB]
  const actionKey = `${unit.id}:${unit.nextActionAt}`
  const flowerCards = initialHand.filter(card => !card.isSuitCard)
  if (flowerCards.length > 0 && gs.flowerActionUsed[unit.side] !== actionKey) {
    const flower = flowerCards[Math.floor(Math.random() * flowerCards.length)]
    gs = doPlayCard(gs, unit.side, flower.id)
    unit = findUnit(gs, unit.id) ?? unit
  }

  // 封招 (sealed): can't use moves, pass immediately
  if (unit.statuses.some(s => s.key === 'sealed')) return doPass(gs, unit.id)

  const side    = unit.side
  const enemies = (side === 'A' ? gs.teamB : gs.teamA).filter(u => u.alive)
  const allies  = (side === 'A' ? gs.teamA : gs.teamB).filter(u => u.alive && u.id !== unit.id)
  if (enemies.length === 0) return doPass(gs, unit.id)

  const isRooted = unit.statuses.some(s => s.key === 'rooted') && !unit.flags.immuneToRooted
  const hand = side === 'A'
    ? [...gs.handA, ...gs.handCustomA]
    : [...gs.handB, ...gs.handCustomB]

  // Auto "出手" with no selection is PASS. Do it immediately when the hand
  // cannot pay for any off-cooldown move instead of entering target/reposition
  // logic and leaving the ready unit waiting on a failed attempt.
  const suitFor: Partial<Record<MoveSlot, string>> = {
    '劍': 'red', '槍': 'green', '法': 'blue', '願': 'yellow',
  }
  const liberated = unit.statuses.some(st => st.key === 'liberated')
  const hasAffordableMove = (['劍', '槍', '法', '願'] as MoveSlot[]).some(slot => {
    const move = unit.moves[slot]
    if (!move || (unit.moveCooldownUntil[move.id] ?? 0) > gs.clock) return false
    const color = suitFor[slot]
    if (!color) return false
    const needed = liberated ? 1 : (move.condition ?? 1)
    return hand.filter(card => card.color === color).length >= needed
  })
  if (!hasAffordableMove) return doPass(gs, unit.id)

  // Score moves from current slot
  const hereCandidates = scoreMoves(unit, unit.slot, enemies, allies, hand, gs.clock)
  const hereBest       = hereCandidates[0] ?? null

  // SA A2: only 1 slot at a time — clamp preferred slot to at most 1 step away
  const preferredSlot = isRooted
    ? unit.slot
    : kitPreferredSlot(unit, enemies, hand, gs.clock)
  const moveToSlot = (unit.slot < preferredSlot
    ? Math.min(unit.slot + 1, preferredSlot)
    : Math.max(unit.slot - 1, preferredSlot)) as 1 | 2 | 3

  let workGS   = gs
  let execMove = hereBest

  if (!isRooted && moveToSlot !== unit.slot) {
    const thereCandidates = scoreMoves(unit, moveToSlot, enemies, allies, hand, gs.clock)
    const thereBest       = thereCandidates[0] ?? null

    // Only move if repositioning unlocks a move AND it's at least 10% better
    const shouldMove = thereBest != null && (
      hereBest == null || thereBest.score > hereBest.score * 1.1
    )
    if (shouldMove) {
      workGS   = doMoveUnit(gs, unit.id, moveToSlot)
      execMove = thereBest
    }
  }

  // SA C3: if no move can reach anyone, randomly use any affordable move (can't be stuck)
  if (!execMove) {
    const suitFallback: Record<string, string> = { '劍': 'red', '槍': 'green', '法': 'blue', '願': 'yellow' }
    const liberatedFb  = unit.statuses.some(st => st.key === 'liberated')
    const fallbackSlots = (['劍', '槍', '法', '願'] as MoveSlot[]).filter(sl => {
      const m = unit.moves[sl]
      if (!m) return false
      if ((unit.moveCooldownUntil[m.id] ?? 0) > gs.clock) return false
      const color = suitFallback[sl]
      if (!color) return false
      const needed = liberatedFb ? 1 : (m.condition ?? 1)
      return hand.filter(c => c.color === color).length >= needed
    })
    if (fallbackSlots.length > 0) {
      const sl = fallbackSlots[Math.floor(Math.random() * fallbackSlots.length)]
      execMove = { slot: sl, score: 0, targetId: null }
    }
  }

  if (!execMove) return doPass(workGS, unit.id)

  const executed = doExecuteMove(workGS, {
    unitId:   unit.id,
    moveSlot: execMove.slot,
    targetId: execMove.targetId,
    cardId:   null,
  })
  const afterUnit = [...executed.teamA, ...executed.teamB].find(u => u.id === unit.id)
  if (afterUnit && afterUnit.alive && afterUnit.nextActionAt <= executed.clock) {
    return doPass(executed, unit.id)
  }
  return executed
}

export function getReadyUnits(gs: GameState): Unit[] {
  return [...gs.teamA, ...gs.teamB]
    .filter(u => u.alive && !u.statuses.some(s => s.key === 'frozen') && u.nextActionAt <= gs.clock)
    .sort((a, b) => a.nextActionAt - b.nextActionAt || effectiveSPD(b) - effectiveSPD(a))
}

function deepClone<T>(v: T): T {
  return structuredClone(v)
}
