import type { EffectOp } from '../types/effect'
import type { Unit } from '../types/unit'
import type { Card } from '../types/card'
import type { GameState } from '../types/game'
import type { StatusEntry } from '../types/status'
import { applyDamage } from './combat'

export type LogLine = { html: string }

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
  const key    = op.key as StatusEntry['key']
  const value  = (op.value as number) ?? 0
  const mode   = (op.mode as StatusEntry['mode']) ?? 'flat'
  const baseDur = (op.duration as number) ?? 10
  const dur     = Math.round(baseDur * durationMult * (unit.flags.statusDurationExtend
    ? (1 + unit.flags.statusDurationExtend / 10)
    : 1))

  unit.statuses = unit.statuses.filter(s => s.key !== key)
  unit.statuses.push({ key, mode, value, expiresAt: clock + dur * 10 })
}

function healUnit(unit: Unit, amount: number) {
  unit.hp = Math.min(unit.maxHp, unit.hp + Math.max(0, amount))
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
        for (const t of targets) {
          addStatus(t, op, clock, effectMult)
          log.push({ html: `<b>${t.name}</b> 獲得 ${op.key} 狀態` })
        }
        break
      }

      case 'healPct': {
        const pct = (op.pct as number) * effectMult
        for (const t of targets) {
          const basis = op.basis === 'current' ? t.hp : t.maxHp
          const amt   = Math.floor(basis * pct)
          healUnit(t, amt)
          log.push({ html: `<b>${t.name}</b> 回復 ${amt} HP` })
        }
        break
      }

      case 'healFlat': {
        const amt = Math.floor((op.amount as number) * effectMult)
        for (const t of targets) {
          healUnit(t, amt)
          log.push({ html: `<b>${t.name}</b> 回復 ${amt} HP` })
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
          t.alive = true
          t.hp    = Math.max(1, Math.floor(t.maxHp * pct))
          log.push({ html: `<b>${t.name}</b> 復活，HP ${t.hp}` })
        }
        break
      }

      case 'draw': {
        const side  = actor.side
        const count = (op.count as number) ?? 1
        const pub   = gs.drawPublic
        const hand  = side === 'A' ? gs.handA : gs.handB
        const drawn = pub.splice(0, count)
        hand.push(...drawn)
        if (drawn.length) log.push({ html: `${side === 'A' ? 'A' : 'B'} 抽 ${drawn.length} 張牌` })
        break
      }

      case 'discard': {
        if (op.target === 'bothHands') {
          // discard both to count=1
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
        const limitA = 5; const limitB = 5
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
        const toSlot = (op.to as 1 | 2 | 3)
        for (const t of targets) {
          if (t.statuses.some(s => s.key === 'rooted') && !actor.flags.immuneToRooted) continue
          t.slot = toSlot
          log.push({ html: `<b>${t.name}</b> 被擊至 ${['近', '中', '遠'][toSlot - 1]}距離` })
        }
        break
      }

      case 'selfMove': {
        if (!actor.statuses.some(s => s.key === 'rooted')) {
          actor.slot = op.to as 1 | 2 | 3
          log.push({ html: `<b>${actor.name}</b> 移至 ${['近', '中', '遠'][(op.to as number) - 1]}距離` })
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

      case 'clearStatuses': {
        let totalCleared = 0
        for (const t of targets) {
          const count = t.statuses.length
          totalCleared += count
          t.statuses = []
          log.push({ html: `<b>${t.name}</b> 清除全部狀態` })
        }
        if (op.healPerStatus) {
          healUnit(actor, totalCleared)
          log.push({ html: `<b>${actor.name}</b> 回復 ${totalCleared} HP` })
        }
        break
      }

      case 'clearStatusKey': {
        for (const t of targets) {
          t.statuses = t.statuses.filter(s => s.key !== op.key)
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

      case 'reflectHalfHeal': {
        // caller already computed damage; here we heal actor by half
        // This is called post-hit from atb.ts where rawDmg is known
        break
      }

      case 'vengeanceScaling': {
        for (const t of targets) {
          const dmg = Math.floor(gs.round / 5)
          applyDamage(t, dmg)
          log.push({ html: `<b>${t.name}</b> 受到 ${dmg} 傷害（回合懲罰）` })
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
        // applied at unit init; no runtime effect here
        break

      case 'powerMult':
        // handled by caller when crit occurs
        break
    }
  }
}

export function runCardEffects(card: Card, actor: Unit, gs: GameState, clock: number, log: LogLine[]) {
  if (!card.effectOps.length) return
  const chance = card.effectChance ?? 1
  if (Math.random() > chance) return
  runEffectOps(card.effectOps, actor, null, gs, clock, 1, log)
}

// Apply per-tick status DoT/HoT (hpPlus, hpMinus, burning handled here)
export function tickStatuses(gs: GameState, clock: number, log: LogLine[]) {
  for (const u of allUnits(gs)) {
    if (!u.alive) continue
    // expire statuses
    u.statuses = u.statuses.filter(s => {
      if (s.expiresAt !== -1 && s.expiresAt <= clock) {
        log.push({ html: `<b>${u.name}</b> 的 ${s.key} 狀態解除` })
        return false
      }
      return true
    })
    // hp+/hp- DoT
    const hpPlus  = u.statuses.find(s => s.key === 'hpPlus')
    const hpMinus = u.statuses.find(s => s.key === 'hpMinus')
    if (hpPlus)  healUnit(u, hpPlus.value)
    if (hpMinus) applyDamage(u, hpMinus.value)
  }
}
