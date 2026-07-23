import type { MoveSlot, RangeType, Scope } from './move'

export interface Monster {
  id: string
  name: string
  title: string
  element: string
  hp: number
  atk: number
  def: number
  spd: number
  assetDir: string
  description: string
  battleArtScale?: number
}

export interface MonsterMove {
  id: string
  ownerId: string
  name: string
  slot: MoveSlot
  condition: number | null
  rangeType: RangeType
  scope: Scope
  powerRatio: number | null
  hitRate: number | null
  critRate: number | null
  cooldown: number | null
  description: string
  effectTrigger: string | null
  effectOps: Array<Record<string, unknown>>
  effectChance: number
  imageFacing?: 'left' | 'right'
}
