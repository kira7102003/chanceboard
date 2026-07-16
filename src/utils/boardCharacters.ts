export interface BoardCharacter {
  id: string
  name: string
}

const KEY = 'cb_board_characters'
const DEFAULTS: BoardCharacter[] = [{ id: 'black', name: '小黑' }, { id: 'white', name: '小白' }]

export function getBoardCharacters(): BoardCharacter[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as BoardCharacter[] | null
    return saved?.length ? saved : DEFAULTS
  } catch { return DEFAULTS }
}

export function saveBoardCharacters(characters: BoardCharacter[]): void {
  localStorage.setItem(KEY, JSON.stringify(characters))
}

export function getBattleBackgroundNames(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem('cb_battle_bg_names') ?? 'null') as string[] | null
    return Array.from({ length: 6 }, (_, index) => saved?.[index] || `戰鬥背景 ${index + 1}`)
  } catch { return Array.from({ length: 6 }, (_, index) => `戰鬥背景 ${index + 1}`) }
}
