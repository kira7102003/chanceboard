import { characters as defaultChars } from '../data/db'
import type { Character } from '../types/character'

const LS_CHARS = 'cb_chars'
const LS_IMG   = (id: string) => `cb_img_${id}`

export function getChars(): Character[] {
  try {
    const raw = localStorage.getItem(LS_CHARS)
    if (!raw) return defaultChars
    const saved: Character[] = JSON.parse(raw)
    // Merge: saved fields take priority, but keep any new chars from defaultChars
    return defaultChars.map(dc => {
      const override = saved.find(s => s.id === dc.id)
      return override ? { ...dc, ...override } : dc
    })
  } catch { return defaultChars }
}

export function saveChars(chars: Character[]): void {
  localStorage.setItem(LS_CHARS, JSON.stringify(chars))
}

export function resetChars(): void {
  localStorage.removeItem(LS_CHARS)
}

export function getCharImg(id: string): string | null {
  return localStorage.getItem(LS_IMG(id))
}

export function saveCharImg(id: string, dataUrl: string): void {
  localStorage.setItem(LS_IMG(id), dataUrl)
}

export function removeCharImg(id: string): void {
  localStorage.removeItem(LS_IMG(id))
}

// Move skill images
export const getMoveImg    = (id: string)             => localStorage.getItem(`cb_move_img_${id}`)
export const saveMoveImg   = (id: string, d: string)  => localStorage.setItem(`cb_move_img_${id}`, d)
export const removeMoveImg = (id: string)             => localStorage.removeItem(`cb_move_img_${id}`)

// Story illustration images
export const getStoryImg    = (id: string)             => localStorage.getItem(`cb_story_img_${id}`)
export const saveStoryImg   = (id: string, d: string)  => localStorage.setItem(`cb_story_img_${id}`, d)
export const removeStoryImg = (id: string)             => localStorage.removeItem(`cb_story_img_${id}`)
