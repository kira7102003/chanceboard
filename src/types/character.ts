export type Element = 'sword' | 'gun' | 'magic'
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
  story?: string
}
