/**
 * ATB game reducer + unit-init helpers.
 * Pure functions — no side effects, no timers here.
 * The Zustand store drives the setInterval and calls these.
 */

import type { GameState } from '../types/game'
import type { Unit } from '../types/unit'
import type { Move, MoveSlot } from '../types/move'
import type { Card } from '../types/card'
import { characters, moves as allMoves, cards as allCards, deckWeights } from '../data/db'
import type { PieceType } from '../types/piece'
import { calcBAT, resolveHit, applyDamage } from './combat'
import { runEffectOps, runCardEffects, tickStatuses } from './effects'
import type { LogLine } from './effects'

// ─── Unit factory ──────────────────────────────────────────────────────────────

let _uid = 0
export function makeUnit(charId: string, side: 'A' | 'B', slot: 1 | 2 | 3, startAt: number): Unit {
  const char = characters.find(c => c.id === charId)!
  const charMoves = allMoves.filter(m => m.ownerId === charId)

  const moveMap = {} as Record<MoveSlot, Move>
  for (const m of charMoves) moveMap[m.slot] = m

  const flags = {}
  // Apply staticFlag passives immediately
  const passive = charMoves.find(m => m.slot === 'passive')
  if (passive) {
    for (const op of passive.effectOps) {
      if (op.op === 'staticFlag') {
        // @ts-ignore
        flags[op.flag as string] = op.value
      }
    }
  }

  const unit: Unit = {
    id: `${side}-${charId}-${++_uid}`,
    characterId: charId,
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
    nextActionAt: startAt + Math.max(1, Math.floor(10 * (10 / char.spd))),
    statuses: [],
    moveCooldownUntil: {},
    flags,
    _didNotMoveThisTurn: false,
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
): Partial<GameState> {
  const startClock = 0
  const teamA = charIdsA.map((id, i) => makeUnit(id, 'A', (i + 1) as 1 | 2 | 3, startClock))
  const teamB = charIdsB.map((id, i) => makeUnit(id, 'B', (i + 1) as 1 | 2 | 3, startClock))

  const pubDeck = buildPublicDeck(piece)
  const [handA, deckAfterA] = drawN(pubDeck, HAND_LIMIT)
  const [handB, finalDeck]  = drawN(deckAfterA, HAND_LIMIT)

  return {
    phase: 'act',
    teamA,
    teamB,
    drawPublic: finalDeck,
    discardPublic: [],
    handA,
    handB,
    handCustomA: [],
    handCustomB: [],
    lastDiscardedA: null,
    lastDiscardedB: null,
    clock: 0,
    dealtRound: 0,
    round: 1,
    actingUnitId: null,
    actPending: { cardId: null, moveSlot: null },
    log: [],
    winner: null,
    winnerReason: null,
    customDeckOrder:  buildCustomDeckOrder(deckAIds),
    customDeckOrderB: buildCustomDeckOrder(deckBIds),
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
  if (s.customDeckOrder.length > 0)  s.handA.push(s.customDeckOrder.shift()!)
  if (s.customDeckOrderB.length > 0) s.handB.push(s.customDeckOrderB.shift()!)
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
    s.round++
    runRoundEndPassives(s)
    dealRoundCards(s)
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

function runRoundEndPassives(s: GameState) {
  const log: LogLine[] = []
  for (const u of [...s.teamA, ...s.teamB]) {
    if (!u.alive) continue
    const passive = u.moves['passive']
    if (!passive || !passive.effectTrigger) continue
    if (passive.effectTrigger === 'roundEnd') {
      const chance = passive.effectChance ?? 1
      if (Math.random() < chance) {
        runEffectOps(passive.effectOps, u, null, s, s.clock, 1, log)
      }
    }
  }
  for (const l of log) s.log.push(l)
}

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
  const hand = side === 'A' ? s.handA : s.handB
  const idx  = hand.findIndex(c => c.id === cardId)
  if (idx === -1) return gs

  const [card] = hand.splice(idx, 1)
  s.discardPublic.push(card)

  const log: LogLine[] = []
  // For flower cards, run effects; for suit cards, add to condition pool
  if (!card.isSuitCard && card.effectOps.length) {
    // pick first alive unit of that side as actor
    const actor = (side === 'A' ? s.teamA : s.teamB).find(u => u.alive)
    if (actor) runCardEffects(card, actor, s, s.clock, log)
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
  u.slot = toSlot
  u._didNotMoveThisTurn = false
  s.log.push({ html: `<b>${u.name}</b> 移至 ${['近', '中', '遠'][toSlot - 1]}距離` })
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

  // Check condition: consume suit cards from hand
  const hand  = u.side === 'A' ? s.handA : s.handB
  const condN = move.condition ?? 1
  const suitColor = { sword: 'red', gun: 'green', magic: 'blue', wish: 'yellow', passive: null }[action.moveSlot] as string | null

  const liberated = u.statuses.some(st => st.key === 'liberated')
  const needed = liberated ? 1 : condN

  if (suitColor) {
    let found = 0
    const toRemove: number[] = []
    for (let i = 0; i < hand.length && found < needed; i++) {
      if (hand[i].color === suitColor) { toRemove.push(i); found++ }
    }
    if (found < needed) {
      s.log.push({ html: `${u.side} 手牌不足，無法出招` })
      return gs
    }
    for (const i of toRemove.reverse()) {
      s.discardPublic.push(hand.splice(i, 1)[0])
    }
  }

  // Announce move with animation marker
  const SLOT_COLOR: Record<string, string> = { sword:'#e87733', gun:'#22cc77', magic:'#9955ee', wish:'#ddaa22', passive:'#666' }
  const moveColor = SLOT_COLOR[action.moveSlot] ?? '#aaa'
  const moveAnim = { moveId: move.id, moveName: move.name, moveSlot: action.moveSlot, charName: u.name }
  s.log.push({
    html: `<span style="color:${moveColor}">【${move.name}】</span> <b>${u.name}</b> 準備出招`,
    moveAnim,
  })

  // Pre-hit effects
  const log: LogLine[] = []
  const targets = resolveTargetUnits(move, u, action.targetId, s)

  if (move.effectTrigger === 'preHit') {
    for (const t of targets) runEffectOps(move.effectOps, u, t, s, s.clock, 1, log)
  }

  // Resolve hits
  let killedAny = false
  for (const t of targets) {
    // Confused: 50% chance attack self
    if (u.statuses.some(st => st.key === 'confused') && Math.random() < 0.5) {
      const { hit, rawDamage } = resolveHit(u, u, move)
      if (hit) {
        const { hpLost } = applyDamage(u, rawDamage)
        log.push({ html: `🔄 混亂！<b>${u.name}</b> 攻擊自己 <span class="dmg-num">-${hpLost}</span>` })
      }
    } else {
      const { hit, crit, rawDamage } = resolveHit(u, t, move)
      if (!hit) {
        log.push({ html: `<b>${u.name}</b> → <b>${t.name}</b> ✦ <span class="dmg-miss">Miss！</span>` })
        continue
      }

      let dmg = rawDamage
      // reflectHalfHeal: heal self by half dmg dealt
      const hasReflect = move.effectOps.some(op => op.op === 'reflectHalfHeal')

      const { hpLost } = applyDamage(t, dmg)
      t._lastHitMoveId = move.id
      const critTag = crit ? ' <span class="dmg-crit">💥爆擊</span>' : ''
      log.push({ html: `<b>${u.name}</b> → <b>${t.name}</b> <span class="dmg-num">-${hpLost}</span>${critTag}` })

      if (hasReflect) {
        const healAmt = Math.floor(hpLost / 2)
        u.hp = Math.min(u.maxHp, u.hp + healAmt)
        log.push({ html: `<b>${u.name}</b> 吸血 <span class="dmg-heal">+${healAmt} HP</span>` })
      }

      if (!t.alive) {
        log.push({ html: `<b>${t.name}</b> 倒下！` })
        killedAny = true
      }

      // onHit effects
      if (move.effectTrigger === 'onHit') {
        const chance = move.effectChance ?? 1
        if (Math.random() < chance) runEffectOps(move.effectOps, u, t, s, s.clock, 1, log)
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
    u.moveCooldownUntil[move.id] = s.clock + move.cooldown * 10
  }

  // Advance ATB timer
  const bat = calcBAT(u)
  const linked = u.statuses.some(st => st.key === 'linked')
  u.nextActionAt = s.clock + (linked ? Math.floor(bat / 2) : bat)

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
  const passive = u.moves['passive']
  if (passive?.effectTrigger === 'onPass') {
    const chance = passive.effectChance ?? 1
    if (Math.random() < chance) runEffectOps(passive.effectOps, u, null, s, s.clock, 1, log)
  }

  for (const l of log) s.log.push(l)
  s.log.push({ html: `<b>${u.name}</b> PASS` })

  const bat = calcBAT(u)
  u.nextActionAt = s.clock + bat

  return s
}

// ─── helpers ─────────────────────────────────────────────────────────────────

export function findUnit(s: GameState, id: string): Unit | undefined {
  return [...s.teamA, ...s.teamB].find(u => u.id === id)
}

function resolveTargetUnits(move: Move, actor: Unit, targetId: string | null, s: GameState): Unit[] {
  if (move.scope === 'group') {
    return (actor.side === 'A' ? s.teamB : s.teamA).filter(u => u.alive)
  }
  if (targetId) {
    const t = findUnit(s, targetId)
    return t ? [t] : []
  }
  return (actor.side === 'A' ? s.teamB : s.teamA).filter(u => u.alive).slice(0, 1)
}

export function doToggleAuto(gs: GameState, side: 'A' | 'B'): GameState {
  const s = deepClone(gs)
  if (side === 'A') s.autoBattleA = !s.autoBattleA
  else              s.autoBattleB = !s.autoBattleB
  return s
}

// Picks the best available move for a unit and executes it.
export function autoPlayUnit(gs: GameState, unit: Unit): GameState {
  const hand = unit.side === 'A' ? gs.handA : gs.handB
  const suitOf: Record<string, string> = { sword: 'red', gun: 'green', magic: 'blue', wish: 'yellow' }
  const slots: MoveSlot[] = ['sword', 'gun', 'magic', 'wish']

  for (const slot of slots) {
    const move = unit.moves[slot]
    if (!move) continue
    if ((unit.moveCooldownUntil[move.id] ?? 0) > gs.clock) continue

    const color = suitOf[slot]
    if (color) {
      const liberated = unit.statuses.some(st => st.key === 'liberated')
      const needed = liberated ? 1 : (move.condition ?? 1)
      if (hand.filter(c => c.color === color).length < needed) continue
    }

    // resolveTargetUnits handles null targetId → first alive enemy
    return doExecuteMove(gs, { unitId: unit.id, moveSlot: slot, targetId: null, cardId: null })
  }

  return doPass(gs, unit.id)
}

export function getReadyUnits(gs: GameState): Unit[] {
  return [...gs.teamA, ...gs.teamB].filter(
    u => u.alive && !u.statuses.some(s => s.key === 'frozen') && u.nextActionAt <= gs.clock
  )
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}
