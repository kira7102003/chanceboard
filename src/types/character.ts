export type Element = '劍' | '槍' | '法'
export type Gender = 'male' | 'female'

export interface Character {
  id: string
  name: string
  title: string
  gender: Gender
  element: Element
  hp: number
  atk: number
  def: number
  spd: number
  moveNameSword: string
  moveNameGun: string
  moveNameMagic: string
  moveNameWish: string
  passiveName: string
  /** false for non-human beings that are exempt from Robot Law restrictions. */
  isHuman?: boolean
  story?: string
  innerStory?: string
  /** Stars required to reveal the inner story. Defaults to five. */
  innerStoryUnlockStars?: number
  enabled?: boolean   // undefined / true = shown in CharSelect; false = hidden
  /** Per-star percentage stat bonuses. Index 0 is one-star, index 4 is five-star. */
  starBonuses?: Array<{ hp: number; atk: number; def: number; spd: number }>
  extraBImageFacing?: 'left' | 'right'
  wideImageFacing?: 'left' | 'right'
}
