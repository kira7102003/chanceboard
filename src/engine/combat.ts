import type { Unit } from '../types/unit'
import type { Move } from '../types/move'
import type { Element } from '../types/character'

// sword > magic > gun > sword
const BEATS: Record<Element, Element> = { sword: 'magic', magic: 'gun', gun: 'sword' }

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

export function effectiveDEF(u: Unit): number {
  let v = u.baseDef
  for (const s of u.statuses) {
    if (s.key === 'defPlus')  v += s.mode === 'pct' ? u.baseDef * s.value / 100 : s.value
    if (s.key === 'defMinus') v -= s.mode === 'pct' ? u.baseDef * s.value / 100 : s.value
  }
  if (u.flags.defBonusWhenClean && u.statuses.length === 0) v *= 1.25
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
  return Math.max(1, Math.floor(10 * (10 / spd)))
}

export interface HitResult {
  hit: boolean
  crit: boolean
  rawDamage: number // before shield/reduction applied at caller
}

export function resolveHit(attacker: Unit, target: Unit, move: Move): HitResult {
  if (attacker.flags.alwaysMiss) return { hit: false, crit: false, rawDamage: 0 }
  if (target.statuses.some(s => s.key === 'hidden')) return { hit: false, crit: false, rawDamage: 0 }

  const sureHit = attacker.statuses.some(s => s.key === 'sureHit')
  const evasion = target.statuses.find(s => s.key === 'evasion')

  let hitChance = move.hitRate ?? 1
  if (sureHit) hitChance = 1
  else if (evasion) hitChance *= (1 - evasion.value / 100)

  if (Math.random() > hitChance) return { hit: false, crit: false, rawDamage: 0 }

  const lucky = attacker.statuses.some(s => s.key === 'lucky')
  const critChance = lucky ? 1 : (move.critRate ?? 0)
  const crit = Math.random() < critChance

  const atk = effectiveATK(attacker) * (1 + (attacker.flags.powerRatioBonus ?? 0))
  const def = effectiveDEF(target)
  const ratio = move.powerRatio ?? 1
  const el = elementMult(move.rangeType as Element | null, target.element)

  let dmg = Math.max(1, Math.floor(atk * ratio * el / def * 10))
  if (crit) dmg = Math.floor(dmg * 1.5)

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
