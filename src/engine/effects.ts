import type { EffectOp } from '../types/effect'
import type { Unit } from '../types/unit'
import type { Card } from '../types/card'
import type { GameState } from '../types/game'
import type { StatusEntry } from '../types/status'
import { applyDamage, effectiveSPD } from './combat'

export type LogLine = { html: string; moveAnim?: { moveId: string; moveName: string; moveSlot: string; charName: string; charId?: string; targetName?: string; targetCharId?: string; targetUnitId?: string; groupTargets?: Array<{ name: string; charId?: string }> } }

function allUnits(gs: GameState): Unit[] {
  return [...gs.teamA, ...gs.teamB]
}

function resolveTarget(
  op: EffectOp,
  actor: Unit,
  target: Unit | null,
  gs: GameState,
): Unit[] {
  switch (op.target) {
    case 'self':         return [actor]
    case 'target':       return target ? [target] : []
    case 'enemyAll':     return (actor.side === 'A' ? gs.teamB : gs.teamA).filter(u => u.alive)
    case 'allyAll':      return (actor.side === 'A' ? gs.teamA : gs.teamB).filter(u => u.alive)
    case 'sameCell':     return allUnits(gs).filter(u => u.side === actor.side && u.slot === actor.slot && u.alive)
    case 'sameCellAllies': return allUnits(gs).filter(u => u.side === actor.side && u.slot === actor.slot && u.alive && u.id !== actor.id)
    case 'allyLowestHp': {
      const allies = (actor.side === 'A' ? gs.teamA : gs.teamB).filter(u => u.alive)
      const min = Math.min(...allies.map(u => u.hp))
      const pick = allies.find(u => u.hp === min)
      return pick ? [pick] : []
    }
    case 'randomDeadAlly': {
      const dead = (actor.side === 'A' ? gs.teamA : gs.teamB).filter(u => !u.alive)
      if (dead.length === 0) return []
      return [dead[Math.floor(Math.random() * dead.length)]]
    }
    case 'bothHands':    return [] // handled per-op below
    case 'opponent':     return target ? [target] : []
    default:             return target ? [target] : []
  }
}

function addStatus(unit: Unit, op: EffectOp, clock: number, durationMult = 1) {
  const oldSpd = effectiveSPD(unit)
  const key    = op.key as StatusEntry['key']
  const value  = (op.value as number) ?? 0
  const mode   = (op.mode as StatusEntry['mode']) ?? 'flat'
  const rng     = op.durationRng as [number, number] | undefined
  const baseDur = rng
    ? Math.floor(Math.random() * (rng[1] - rng[0] + 1)) + rng[0]
    : ((op.duration as number) ?? 10)
  const dur     = Math.round(baseDur * durationMult * (unit.flags.statusDurationExtend
    ? (1 + unit.flags.statusDurationExtend / 10)
    : 1))

  unit.statuses = unit.statuses.filter(s => s.key !== key)
  unit.statuses.push({ key, mode, value, expiresAt: clock + dur * 10 })

  // SPD changes immediately affect the remaining ATB wait, not only the next
  // action scheduled after this one.
  const newSpd = effectiveSPD(unit)
  if (newSpd !== oldSpd && unit.nextActionAt > clock) {
    const remaining = unit.nextActionAt - clock
    unit.nextActionAt = clock + Math.max(1, Math.round(remaining * oldSpd / newSpd))
  }

  // 結冰 special: push action timer forward so the unit can't act while frozen
  if (key === 'frozen' && unit.nextActionAt > clock) {
    unit.nextActionAt += dur * 10
  }
}

function healUnit(unit: Unit, amount: number) {
  unit.hp = Math.min(unit.maxHp, unit.hp + Math.max(0, amount))
}

// Data uses distance 1/2/3 = front/mid/back; numeric board slots are mirrored by side.
function distToSlot(dist: 1 | 2 | 3, side: 'A' | 'B'): 1 | 2 | 3 {
  if (dist === 2) return 2
  if (dist === 1) return side === 'A' ? 3 : 1
  return side === 'A' ? 1 : 3
}

function slotLabel(side: 'A' | 'B', slot: 1 | 2 | 3): string {
  if (slot === 2) return '中'
  return slot === (side === 'A' ? 3 : 1) ? '近' : '遠'
}

const CHARGE_STACK_CAP = 3
const CHARGE_STACK_DUR = 60
const CHARGE_DETONATE_PCT_PER_STACK = 0.1

function runChargeDetonate(_actor: Unit, gs: GameState, _clock: number, effectMult: number, log: LogLine[]) {
  for (const u of allUnits(gs)) {
    if (!u.alive) continue
    const stacks = u.statuses.filter(s => s.key === 'charged').length
    if (stacks === 0) continue
    const isMaxed = stacks >= CHARGE_STACK_CAP
    let dmg = Math.max(1, Math.floor(u.maxHp * CHARGE_DETONATE_PCT_PER_STACK * stacks * effectMult))
    if (isMaxed) dmg *= 2
    u.statuses = u.statuses.filter(s => s.key !== 'charged')
    const { hpLost } = applyDamage(u, dmg)
    log.push({ html: `<b>${u.name}</b> 帶電引爆(${stacks}層)${isMaxed ? '【滿層雙倍】' : ''} <span class="dmg-num">-${hpLost}</span>${!u.alive ? ' → <b>倒下！</b>' : ''}` })
  }
}

export function runEffectOps(
  ops: EffectOp[],
  actor: Unit,
  primaryTarget: Unit | null,
  gs: GameState,
  clock: number,
  effectMult = 1,
  log: LogLine[],
) {
  for (const op of ops) {
    const targets = resolveTarget(op, actor, primaryTarget, gs)

    switch (op.op) {
      case 'status': {
        const alt = op._orAlternate as Record<string, unknown> | undefined
        const effectiveOp = (alt && Math.random() < 0.5) ? { ...op, ...alt } : op
        for (const t of targets) {
          addStatus(t, effectiveOp, clock, effectMult)
          log.push({ html: `<b>${t.name}</b> 獲得 ${effectiveOp.key} 狀態` })
        }
        break
      }

      // 依格距決定持續時間：durByDist[0]=同格, [1]=相鄰, [2]=最遠
      case 'statusByDistance': {
        const key    = op.key as StatusEntry['key']
        const value  = (op.value as number) ?? 0
        const mode   = (op.mode as StatusEntry['mode']) ?? 'flat'
        const durByDist = (op.durByDist as number[]) ?? [10, 8, 5]
        const ownTeam = actor.side === 'A' ? gs.teamA : gs.teamB
        for (const unit of ownTeam) {
          if (!unit.alive) continue
          const dist = Math.abs(unit.slot - actor.slot)
          const dur = durByDist[Math.min(dist, durByDist.length - 1)] ?? 5
          unit.statuses = unit.statuses.filter(s => s.key !== key)
          unit.statuses.push({ key, mode, value, expiresAt: clock + dur * 10 })
          if (key === 'frozen' && unit.nextActionAt > clock) unit.nextActionAt += dur * 10
        }
        break
      }

      case 'healPct': {
        const pct = (op.pct as number) * effectMult
        for (const t of targets) {
          const basis = op.basis === 'current' ? t.hp : t.maxHp
          const amt   = Math.floor(basis * pct)
          healUnit(t, amt)
          log.push({ html: `<b>${t.name}</b> <span class="dmg-heal">+${amt} HP</span>` })
        }
        break
      }

      case 'healFlat': {
        const amt = Math.floor((op.amount as number) * effectMult)
        for (const t of targets) {
          healUnit(t, amt)
          log.push({ html: `<b>${t.name}</b> <span class="dmg-heal">+${amt} HP</span>` })
        }
        break
      }

      case 'damagePct': {
        const pct = (op.pct as number) * effectMult
        for (const t of targets) {
          const basis = op.basis === 'current' ? t.hp : t.maxHp
          const dmg   = Math.floor(basis * pct)
          applyDamage(t, dmg)
          log.push({ html: `<b>${t.name}</b> 損失 ${dmg} HP` })
          if (!t.alive) log.push({ html: `<b>${t.name}</b> 倒下！` })
        }
        break
      }

      case 'kill': {
        for (const t of targets) {
          t.hp    = 0
          t.alive = false
          log.push({ html: `<b>${t.name}</b> 即死！` })
        }
        break
      }

      case 'revive': {
        const pct = (op.pct as number) ?? 0.05
        for (const t of targets) {
          t.alive        = true
          t.hp           = Math.max(1, Math.floor(t.maxHp * pct))
          t.nextActionAt = clock
          log.push({ html: `<b>${t.name}</b> 復活，HP ${t.hp}` })
        }
        break
      }

      case 'draw': {
        const side  = actor.side
        const count = (op.count as number) ?? 1
        const hand  = side === 'A' ? gs.handA : gs.handB

        if (op.fromOpponent) {
          const oppHand = side === 'A' ? gs.handB : gs.handA
          const stolen  = oppHand.splice(0, Math.min(count, oppHand.length))
          hand.push(...stolen)
          if (stolen.length) log.push({ html: `${side} 奪取對手 ${stolen.length} 張手牌` })
        } else if (op.type === 'flower') {
          let drawn = 0
          for (let i = 0; i < count; i++) {
            const idx = gs.drawPublic.findIndex(c => c.color === 'flower')
            if (idx === -1) break
            hand.push(gs.drawPublic.splice(idx, 1)[0])
            drawn++
          }
          if (drawn) log.push({ html: `${side} 抽了 ${drawn} 張花牌` })
        } else {
          const drawn = gs.drawPublic.splice(0, count)
          hand.push(...drawn)
          if (drawn.length) log.push({ html: `${side} 抽 ${drawn.length} 張牌` })
        }
        break
      }

      case 'discard': {
        if (op.target === 'bothHands') {
          const toCount = (op.toCount as number) ?? 1
          while (gs.handA.length > toCount) {
            const c = gs.handA.splice(Math.floor(Math.random() * gs.handA.length), 1)[0]
            gs.lastDiscardedA = c
          }
          while (gs.handB.length > toCount) {
            const c = gs.handB.splice(Math.floor(Math.random() * gs.handB.length), 1)[0]
            gs.lastDiscardedB = c
          }
          log.push({ html: `雙方手牌各減至 ${toCount} 張` })
        } else {
          const side = op.target === 'opponent'
            ? (actor.side === 'A' ? 'B' : 'A')
            : actor.side
          const hand = side === 'A' ? gs.handA : gs.handB
          const count = op.count === 'all'
            ? hand.length
            : Math.min((op.count as number) ?? 1, hand.length)
          for (let i = 0; i < count; i++) {
            const idx = op.random ? Math.floor(Math.random() * hand.length) : 0
            const c = hand.splice(idx, 1)[0]
            if (side === 'A') gs.lastDiscardedA = c
            else              gs.lastDiscardedB = c
          }
          log.push({ html: `${side} 丟棄 ${count} 張手牌` })
        }
        break
      }

      case 'fillToLimit': {
        const limitA = 4; const limitB = 4
        while (gs.handA.length < limitA && gs.drawPublic.length > 0)
          gs.handA.push(gs.drawPublic.shift()!)
        while (gs.handB.length < limitB && gs.drawPublic.length > 0)
          gs.handB.push(gs.drawPublic.shift()!)
        log.push({ html: '雙方手牌補至上限' })
        break
      }

      case 'swapHandsFull': {
        const tmp = [...gs.handA]
        gs.handA = [...gs.handB]
        gs.handB = tmp
        log.push({ html: '雙方交換全部手牌' })
        break
      }

      case 'swapHandsRandom': {
        if (gs.handA.length && gs.handB.length) {
          const ia = Math.floor(Math.random() * gs.handA.length)
          const ib = Math.floor(Math.random() * gs.handB.length)
          const tmp = gs.handA[ia]
          gs.handA[ia] = gs.handB[ib]
          gs.handB[ib] = tmp
          log.push({ html: '雙方隨機交換 1 張手牌' })
        }
        break
      }

      case 'swapHP': {
        for (const t of targets) {
          const aHp = actor.hp; const bHp = t.hp
          actor.hp = Math.min(bHp, actor.maxHp)
          t.hp     = Math.min(aHp, t.maxHp)
          log.push({ html: `<b>${actor.name}</b> 與 <b>${t.name}</b> 交換 HP` })
        }
        break
      }

      case 'halveHP': {
        for (const t of targets) {
          t.hp = Math.floor(t.hp / 2)
          if (t.hp <= 0) { t.hp = 0; t.alive = false }
          log.push({ html: `<b>${t.name}</b> HP 減半 → ${t.hp}` })
        }
        break
      }

      case 'knockback': {
        const dist = (op.to as 1 | 2 | 3)
        for (const t of targets) {
          if (t.statuses.some(s => s.key === 'rooted') && !t.flags.immuneToRooted) continue
          const toSlot = distToSlot(dist, t.side)
          t.slot = toSlot
          log.push({ html: `<b>${t.name}</b> 被擊至 ${slotLabel(t.side, toSlot)}距離` })
        }
        break
      }

      case 'selfMove': {
        if (!actor.statuses.some(s => s.key === 'rooted')) {
          const toSlot = distToSlot(op.to as 1 | 2 | 3, actor.side)
          actor.slot = toSlot
          log.push({ html: `<b>${actor.name}</b> 移至 ${slotLabel(actor.side, toSlot)}距離` })
        }
        break
      }

      case 'drainStatus': {
        for (const t of targets) {
          const drained = [...t.statuses]
          t.statuses = []
          actor.statuses.push(...drained)
          if (op.withDamage) {
            const dmg = drained.length
            applyDamage(t, dmg)
            log.push({ html: `<b>${actor.name}</b> 吸取 ${t.name} 的 ${drained.length} 個狀態，造成 ${dmg} 傷害` })
          } else {
            log.push({ html: `<b>${actor.name}</b> 吸取 ${t.name} 的全部狀態` })
          }
        }
        break
      }

      case 'averageCellHP': {
        const cell = allUnits(gs).filter(u => u.side === actor.side && u.slot === actor.slot && u.alive)
        if (cell.length < 2) break
        const avg = Math.floor(cell.reduce((s, u) => s + u.hp, 0) / cell.length)
        for (const u of cell) u.hp = Math.min(u.maxHp, avg)
        log.push({ html: `格內角色 HP 平均為 ${avg}` })
        break
      }

      case 'reflectHalfHeal':
        break

      case 'vengeanceScaling': {
        for (const t of targets) {
          const dmg = Math.floor(gs.round / 5)
          applyDamage(t, dmg)
          log.push({ html: `<b>${t.name}</b> 受到 ${dmg} 傷害（回合懲罰）` })
        }
        break
      }

      // 依己方陣亡人數追加目標最大HP百分比傷害
      case 'deadAllyScaling': {
        const ownTeam = actor.side === 'A' ? gs.teamA : gs.teamB
        const deadCount = ownTeam.filter(u => !u.alive).length
        if (deadCount === 0 || !primaryTarget || !primaryTarget.alive) break
        const pct = (op.pct as number) ?? 0.1
        const dmg = Math.floor(primaryTarget.maxHp * pct * deadCount)
        if (dmg > 0) {
          const { hpLost } = applyDamage(primaryTarget, dmg)
          log.push({ html: `<b>${primaryTarget.name}</b> 受到亡者怒火 <span class="dmg-num">-${hpLost}</span>（${deadCount}位隊友陣亡）` })
          if (!primaryTarget.alive) log.push({ html: `<b>${primaryTarget.name}</b> 倒下！` })
        }
        break
      }

      case 'condHeal': {
        if (actor.hp / actor.maxHp < 0.30) {
          const amt = Math.floor(actor.maxHp * (op.pct as number))
          healUnit(actor, amt)
          log.push({ html: `<b>${actor.name}</b> 低血觸發回復 ${amt} HP` })
        }
        break
      }

      case 'condHealIfNoMove': {
        if (actor._didNotMoveThisTurn) {
          const amt = Math.floor(actor.maxHp * (op.pct as number))
          healUnit(actor, amt)
          log.push({ html: `<b>${actor.name}</b> 未移動回復 ${amt} HP` })
        }
        break
      }

      case 'recoverDiscard': {
        const card = actor.side === 'A' ? gs.lastDiscardedA : gs.lastDiscardedB
        if (card) {
          const hand = actor.side === 'A' ? gs.handA : gs.handB
          hand.push(card)
          if (actor.side === 'A') gs.lastDiscardedA = null
          else                    gs.lastDiscardedB = null
          log.push({ html: `${actor.side} 回收棄牌` })
        }
        break
      }

      case 'staticFlag':
        break

      case 'powerMult':
        break

      case 'clearStatuses': {
        for (const t of targets) {
          t.statuses = []
          log.push({ html: `<b>${t.name}</b> 清除全部狀態` })
        }
        break
      }

      case 'clearStatusKey': {
        const key = op.key as StatusEntry['key']
        for (const t of targets) {
          t.statuses = t.statuses.filter(s => s.key !== key)
        }
        break
      }

      // ── 帶電系列 ────────────────────────────────────────────────────────────

      // 對目標疊加 1 層帶電狀態（上限 3 層）
      case 'chargeStack': {
        const t = primaryTarget
        if (!t || !t.alive) break
        const stacks = t.statuses.filter(s => s.key === 'charged').length
        if (stacks < CHARGE_STACK_CAP) {
          t.statuses.push({ key: 'charged', mode: 'flat', value: 1, expiresAt: clock + CHARGE_STACK_DUR })
          log.push({ html: `<b>${t.name}</b> 帶電 (${stacks + 1}/${CHARGE_STACK_CAP}層)` })
        }
        break
      }

      // 若目標有帶電，對同格其他敵人造成擴散傷害並各疊一層帶電
      case 'chargeSplash': {
        const t = primaryTarget
        if (!t || !t.alive) break
        const stacks = t.statuses.filter(s => s.key === 'charged').length
        if (stacks === 0) break
        const pct = (op.pct as number) ?? 0.05
        const splashDmg = Math.max(1, Math.floor(t.maxHp * pct * stacks))
        const sameCell = allUnits(gs).filter(u =>
          u.alive && u.side === t.side && u.slot === t.slot && u.id !== t.id
        )
        for (const s of sameCell) {
          const { hpLost } = applyDamage(s, splashDmg)
          log.push({ html: `<b>${s.name}</b> 帶電擴散 <span class="dmg-num">-${hpLost}</span>` })
          if (!s.alive) log.push({ html: `<b>${s.name}</b> 倒下！` })
          const curStacks = s.statuses.filter(x => x.key === 'charged').length
          if (curStacks < CHARGE_STACK_CAP) {
            s.statuses.push({ key: 'charged', mode: 'flat', value: 1, expiresAt: clock + CHARGE_STACK_DUR })
          }
        }
        break
      }

      // 若目標帶電層數已達 3，引爆全場帶電
      case 'chargeDetonateIfThreeStacks': {
        const t = primaryTarget
        if (!t) break
        const stacks = t.statuses.filter(s => s.key === 'charged').length
        if (stacks >= CHARGE_STACK_CAP) {
          runChargeDetonate(actor, gs, clock, effectMult, log)
        }
        break
      }

      // 無條件引爆全場帶電
      case 'chargeDetonate': {
        runChargeDetonate(actor, gs, clock, effectMult, log)
        break
      }
    }
  }
}

export function runCardEffects(card: Card, actor: Unit, gs: GameState, clock: number, log: LogLine[]) {
  if (!card.effectOps.length) return
  const chance = card.effectChance ?? 1
  if (Math.random() > chance) return
  runEffectOps(card.effectOps, actor, null, gs, clock, 1, log)
}

export function tickStatuses(gs: GameState, clock: number, log: LogLine[]) {
  for (const u of allUnits(gs)) {
    if (!u.alive) continue
    const oldSpd = effectiveSPD(u)
    u.statuses = u.statuses.filter(s => {
      if (s.expiresAt !== -1 && s.expiresAt <= clock) {
        log.push({ html: `<b>${u.name}</b> 的 ${s.key} 狀態解除` })
        return false
      }
      return true
    })
    const newSpd = effectiveSPD(u)
    if (newSpd !== oldSpd && u.nextActionAt > clock) {
      const remaining = u.nextActionAt - clock
      u.nextActionAt = clock + Math.max(1, Math.round(remaining * oldSpd / newSpd))
    }
    const hpPlus  = u.statuses.find(s => s.key === 'hpPlus')
    const hpMinus = u.statuses.find(s => s.key === 'hpMinus')
    if (hpPlus)  healUnit(u, hpPlus.value)
    if (hpMinus) applyDamage(u, hpMinus.value)
  }
}
