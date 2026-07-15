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
  enabled?: boolean   // undefined / true = shown in CharSelect; false = hidden
}
