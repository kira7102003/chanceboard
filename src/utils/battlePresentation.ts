export type BattlePresentationStyle = 'classic' | 'trapezoid'

const STORAGE_KEY = 'cb_battle_presentation_style'

export function getBattlePresentationStyle(): BattlePresentationStyle {
  return localStorage.getItem(STORAGE_KEY) === 'classic' ? 'classic' : 'trapezoid'
}

export function saveBattlePresentationStyle(style: BattlePresentationStyle): void {
  localStorage.setItem(STORAGE_KEY, style)
}
