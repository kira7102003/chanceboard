import type { EffectOp } from './effect'
import type { EffectTrigger } from './move'

export type CardColor = 'red' | 'green' | 'blue' | 'yellow' | 'flower'

export interface Card {
  id: string
  name: string
  color: CardColor
  isSuitCard: boolean
  description: string | null
  effectTrigger: EffectTrigger | null
  effectOps: EffectOp[]
  effectChance: number
}
