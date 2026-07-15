import type { Unit } from '../types/unit'
import type { Move } from '../types/move'
import type { Element } from '../types/character'

// 劍剋槍、槍剋法、法剋劍
const BEATS: Record<Element, Element> = { '劍': '槍', '槍': '法', '法': '劍' }

export function elementMult(moveEl: Element | null, targetEl: Element): number {
  if (!moveEl) return 1
  return BEATS[moveEl] === targetEl ? 1.1 : 1
}

export function effectiveATK(u: Unit): number {
  let v = u.baseAtk
  for (const s of u.statuses) {
    if (s.key === 'atkPlus')  v += s.mode === 'pct' ? u.baseAtk * s.value / 100 : s.value
    if (s.key === 'atkMinus') v -= s.mode === 'pct' ? u.baseAtk * s.value / 100 : s.value
  }
  if (u.flags.atkBonus) v += u.baseAtk * u.flags.atkBonus
  if (u.statuses.some(s => s.key === 'empowered')) v *= 2
  return Math.max(1, Math.floor(v))
}

export function effectiveDEF(u: Unit, slotAllies: Unit[] = []): number {
  let v = u.baseDef
  for (const s of u.statuses) {
    if (s.key === 'defPlus')  v += s.mode === 'pct' ? u.baseDef * s.value / 100 : s.value
    if (s.key === 'defMinus') v -= s.mode === 'pct' ? u.baseDef * s.value / 100 : s.value
  }
  if (u.flags.defBonusWhenClean && u.statuses.length === 0) v *= 1.25
  // SA D1: 小可 lightSourceAura — self and same-slot allies gain +15% DEF at calc time
  if (u.flags.lightSourceAura || slotAllies.some(a => a.alive && a.flags.lightSourceAura)) v *= 1.15
  return Math.max(1, Math.floor(v))
}

export function effectiveSPD(u: Unit): number {
  let v = u.baseSpd
  for (const s of u.statuses) {
    if (s.key === 'spdPlus')  v += s.mode === 'pct' ? u.baseSpd * s.value / 100 : s.value
    if (s.key === 'spdMinus') v -= s.mode === 'pct' ? u.baseSpd * s.value / 100 : s.value
    if (s.key === 'paralyzed') v *= 0.5
  }
  return Math.max(1, Math.floor(v))
}

export function calcBAT(u: Unit): number {
  const spd = effectiveSPD(u)
  // Result is in ticks (100ms each). SPD=10 → 100 ticks = 10s = 1 round.
  return Math.max(10, Math.floor(100 * (10 / spd)))
}

export interface HitResult {
  hit: boolean
  crit: boolean
  rawDamage: number // before shield/reduction applied at caller
}

export function resolveHit(attacker: Unit, target: Unit, move: Move, targetSlotAllies: Unit[] = []): HitResult {
  const sureHit = attacker.statuses.some(s => s.key === 'sureHit')
  // 圖卡勒絲「機器人三定律」：不得傷害人形角色。這是被動限制，
  // 優先於必中，因此花牌或其他必中效果也不能繞過它。
  if (attacker.flags.alwaysMiss) return { hit: false, crit: false, rawDamage: 0 }
  if (target.statuses.some(s => s.key === 'hidden')) return { hit: false, crit: false, rawDamage: 0 }

  const evasion = target.statuses.find(s => s.key === 'evasion')

  let hitChance = move.hitRate ?? 1
  if (sureHit) hitChance = 1
  else if (evasion) hitChance *= (1 - evasion.value / 100)

  if (Math.random() > hitChance) return { hit: false, crit: false, rawDamage: 0 }

  const lucky = attacker.statuses.some(s => s.key === 'lucky')
  const critChance = lucky ? 1 : (move.critRate ?? 0)
  const crit = Math.random() < critChance

  const atk = effectiveATK(attacker) * (1 + (attacker.flags.powerRatioBonus ?? 0))
  const def = effectiveDEF(target, targetSlotAllies)
  const ratio = move.powerRatio ?? 1
  const el = elementMult(move.rangeType as Element | null, target.element)

  // SA A7: minimum 2 damage
  let dmg = Math.max(2, Math.round(atk * ratio * el / def))
  // SA A3: element advantage must yield at least +1 over non-boosted (prevents rounding wash)
  if (el > 1) {
    const baseDmg = Math.max(2, Math.round(atk * ratio / def))
    if (dmg <= baseDmg) dmg = baseDmg + 1
  }
  if (crit) dmg = dmg * 2

  // sameMove reduction (法蘭克 passive)
  if (target.flags.sameMoveDamageReduction && target._lastHitMoveId === move.id) {
    dmg = Math.floor(dmg * 0.75)
  }

  const reduction = target.statuses.find(s => s.key === 'damageReduction')
  if (reduction) dmg = Math.floor(dmg * (1 - reduction.value / 100))

  return { hit: true, crit, rawDamage: Math.max(0, dmg) }
}

export function applyDamage(target: Unit, rawDamage: number): { absorbed: number; hpLost: number } {
  const shield = target.statuses.find(s => s.key === 'shield')
  let absorbed = 0
  let dmg = rawDamage

  if (shield) {
    absorbed = Math.min(shield.value, dmg)
    dmg -= absorbed
    shield.value -= absorbed
    if (shield.value <= 0) {
      target.statuses = target.statuses.filter(s => s.key !== 'shield')
    }
  }

  const before = target.hp
  target.hp = Math.max(0, target.hp - dmg)
  const hpLost = before - target.hp
  if (target.hp <= 0) target.alive = false
  return { absorbed, hpLost }
}
