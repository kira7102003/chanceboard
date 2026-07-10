import { characters as defaultChars } from '../data/db'
import type { Character } from '../types/character'
import { uploadDataUrl, uploadBlob, deleteStorageFile, storageUrl } from './supabase'

const LS_CHARS    = 'cb_chars'
const CHARS_PATH  = 'chars.json'

let _syncTimer: ReturnType<typeof setTimeout> | null = null
function debouncedCloudSync(chars: Character[]): void {
  if (_syncTimer) clearTimeout(_syncTimer)
  _syncTimer = setTimeout(() => {
    const blob = new Blob([JSON.stringify(chars)], { type: 'application/json' })
    uploadBlob(CHARS_PATH, blob).catch(err => console.warn('[charStore] cloud sync failed:', err))
  }, 2000)
}

// Flag: tiny marker stored in localStorage that says "this image is on Supabase"
const FLAG = (key: string) => `${key}_sb`

// Map storageKey → Supabase Storage path
function storagePath(storageKey: string): string {
  if (storageKey.startsWith('cb_move_img_')) return `moves/${storageKey}.webp`
  if (storageKey.startsWith('cb_story_img_')) return `story/${storageKey}.webp`
  return `chars/${storageKey}.webp`
}

// ── Generic key-based API (used by ImageCrop) ─────────────────────────────────

export function getUrlByKey(storageKey: string): string | null {
  if (localStorage.getItem(FLAG(storageKey))) return storageUrl(storagePath(storageKey))
  const local = localStorage.getItem(storageKey)
  if (local) return local
  // Fallback: try Supabase directly (bucket is public; 404 just leaves img blank)
  return storageUrl(storagePath(storageKey))
}

export async function uploadByKey(storageKey: string, dataUrl: string): Promise<string> {
  const url = await uploadDataUrl(storagePath(storageKey), dataUrl)
  localStorage.setItem(FLAG(storageKey), '1')
  localStorage.removeItem(storageKey) // clean up old base64
  return url
}

export function removeByKey(storageKey: string): void {
  const hadFlag = !!localStorage.getItem(FLAG(storageKey))
  localStorage.removeItem(FLAG(storageKey))
  localStorage.removeItem(storageKey)
  if (hadFlag) deleteStorageFile(storagePath(storageKey))
}

// ── Character data ────────────────────────────────────────────────────────────

export function getChars(): Character[] {
  try {
    const raw = localStorage.getItem(LS_CHARS)
    if (!raw) return defaultChars
    const saved: Character[] = JSON.parse(raw)
    return defaultChars.map(dc => {
      const override = saved.find(s => s.id === dc.id)
      return override ? { ...dc, ...override } : dc
    })
  } catch { return defaultChars }
}

export function saveChars(chars: Character[]): void {
  localStorage.setItem(LS_CHARS, JSON.stringify(chars))
  debouncedCloudSync(chars)
}

export function resetChars(): void {
  localStorage.removeItem(LS_CHARS)
}

export async function initFromCloud(): Promise<boolean> {
  try {
    const url = storageUrl(CHARS_PATH)
    const resp = await fetch(url, { cache: 'no-cache' })
    if (!resp.ok) return false
    const data: Character[] = await resp.json()
    if (!Array.isArray(data) || !data.length) return false
    localStorage.setItem(LS_CHARS, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

// ── Typed image helpers (convenience wrappers) ────────────────────────────────

export function getCharImg(id: string): string | null {
  return getUrlByKey(`cb_img_${id}`)
}
export async function saveCharImg(id: string, dataUrl: string): Promise<string> {
  return uploadByKey(`cb_img_${id}`, dataUrl)
}
export function removeCharImg(id: string): void {
  removeByKey(`cb_img_${id}`)
}

export function getCharWideImg(id: string): string | null {
  return getUrlByKey(`cb_wide_img_${id}`)
}
export async function saveCharWideImg(id: string, dataUrl: string): Promise<string> {
  return uploadByKey(`cb_wide_img_${id}`, dataUrl)
}
export function removeCharWideImg(id: string): void {
  removeByKey(`cb_wide_img_${id}`)
}

export function getMoveImg(id: string): string | null {
  return getUrlByKey(`cb_move_img_${id}`)
}
export async function saveMoveImg(id: string, dataUrl: string): Promise<string> {
  return uploadByKey(`cb_move_img_${id}`, dataUrl)
}
export function removeMoveImg(id: string): void {
  removeByKey(`cb_move_img_${id}`)
}

export function getStoryImg(id: string): string | null {
  return getUrlByKey(`cb_story_img_${id}`)
}
export async function saveStoryImg(id: string, dataUrl: string): Promise<string> {
  return uploadByKey(`cb_story_img_${id}`, dataUrl)
}
export function removeStoryImg(id: string): void {
  removeByKey(`cb_story_img_${id}`)
}
