import type { Element } from './character'
import type { Move, MoveSlot } from './move'
import type { StatusEntry } from './status'

export interface UnitFlags {
  alwaysMiss?: boolean
  taunt?: boolean
  defBonusWhenClean?: boolean
  powerRatioBonus?: number
  atkBonus?: number
  sameMoveDamageReduction?: boolean
  immuneToRooted?: boolean
  nextMoveEffectMult?: number
  statusDurationExtend?: number
  lightSourceAura?: boolean
  miracleSurvivalChance?: number
}

export interface Unit {
  id: string
  characterId: string
  isHuman: boolean
  name: string
  side: 'A' | 'B'
  slot: 1 | 2 | 3
  element: Element
  hp: number
  maxHp: number
  baseAtk: number
  baseDef: number
  baseSpd: number
  moves: Record<MoveSlot, Move>
  alive: boolean
  nextActionAt: number
  statuses: StatusEntry[]
  moveCooldownUntil: Record<string, number>
  flags: UnitFlags
  _didNotMoveThisTurn: boolean
  _lastHitMoveId?: string
  /** Flower card selected for this unit's current action. */
  assignedCardName?: string
}
