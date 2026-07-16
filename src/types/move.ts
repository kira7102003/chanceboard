import type { EffectOp } from './effect'

export type MoveSlot = '劍' | '槍' | '法' | '願' | '被'
export type RangeType = '劍' | '槍' | '法' | null
export type Scope = '單' | '群' | null
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
  /** Original direction of the uploaded move artwork. Defaults to left. */
  imageFacing?: 'left' | 'right'
}
