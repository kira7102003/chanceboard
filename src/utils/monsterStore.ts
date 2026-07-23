import { monsters as defaults, monsterMoves as defaultMoves } from '../data/monsters'
import type { Monster, MonsterMove } from '../types/monster'
import { storageUrl, uploadBlob } from './supabase'

export interface MonsterDatabase { monsters: Monster[]; moves: MonsterMove[] }
const PATH = 'monsters.json'
let cache: MonsterDatabase = { monsters: defaults, moves: defaultMoves }
let timer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

export function getMonsterDatabase(): MonsterDatabase { return cache }
export function onMonstersChanged(listener: () => void): () => void { listeners.add(listener); return () => listeners.delete(listener) }
function notify() { listeners.forEach(listener => listener()) }

export async function loadMonstersFromCloud(): Promise<MonsterDatabase> {
  try {
    const response = await fetch(storageUrl(PATH), { cache: 'no-cache' })
    if (response.ok) {
      const value = await response.json() as Partial<MonsterDatabase>
      if (Array.isArray(value.monsters) && Array.isArray(value.moves)) cache = { monsters: value.monsters, moves: value.moves }
    }
  } catch (error) { console.warn('[monsterStore] cloud load failed; using bundled defaults', error) }
  notify(); return cache
}

export function saveMonsterDatabase(next: MonsterDatabase): void {
  cache = next; notify()
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    uploadBlob(PATH, new Blob([JSON.stringify(cache)], { type: 'application/json' }))
      .catch(error => console.warn('[monsterStore] cloud save failed', error))
  }, 900)
}
