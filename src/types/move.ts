import type { EffectOp } from './effect'

export type MoveSlot = 'sword' | 'gun' | 'magic' | 'wish' | 'passive'
export type RangeType = 'sword' | 'gun' | 'magic' | null
export type Scope = 'single' | 'group' | null
export type EffectTrigger =
  | 'battleStart' | 'roundStart' | 'roundEnd'
  | 'preHit' | 'onHit' | 'onCrit' | 'postAction'
  | 'onKill' | 'onPass' | 'onPlay'

export interface Move {
  id: string
  ownerId: string
  slot: MoveSlot
  name: string
  condition: number | null
  rangeType: RangeType
  scope: Scope
  powerRatio: number | null
  hitRate: number | null
  critRate: number | null
  cooldown: number | null
  description: string
  effectTrigger: EffectTrigger | null
  effectOps: EffectOp[]
  effectChance: number
}
