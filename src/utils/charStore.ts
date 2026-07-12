import { characters as defaultChars } from '../data/db'
import type { Character } from '../types/character'
import { uploadDataUrl, uploadBlob, deleteStorageFile, storageUrl } from './supabase'

const LS_CHARS      = 'cb_chars'
const CHARS_PATH    = 'chars.json'
const MANIFEST_PATH = 'image-manifest.json'

// In-memory set of keys known to exist on Supabase
const _manifestKeys = new Set<string>()

// Listeners that fire when initFromCloud() completes
type SyncListener = () => void
const _syncListeners: SyncListener[] = []
export function onCloudSynced(fn: SyncListener): () => void {
  _syncListeners.push(fn)
  return () => { const i = _syncListeners.indexOf(fn); if (i !== -1) _syncListeners.splice(i, 1) }
}

function pushManifest(): void {
  const blob = new Blob([JSON.stringify([..._manifestKeys])], { type: 'application/json' })
  uploadBlob(MANIFEST_PATH, blob).catch(() => {})
}

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
  if (storageKey.startsWith('cb_move_img_'))  return `moves/${storageKey}.webp`
  if (storageKey.startsWith('cb_story_img_')) return `story/${storageKey}.webp`
  if (storageKey.startsWith('cb_bg_'))        return `backgrounds/${storageKey}.webp`
  return `chars/${storageKey}.webp`
}

// ── Generic key-based API (used by ImageCrop) ─────────────────────────────────

export function getUrlByKey(storageKey: string): string | null {
  const flag = localStorage.getItem(FLAG(storageKey))
  if (flag) {
    // flag can be '1' (old) or a versioned URL with cache-buster
    return flag.startsWith('http') ? flag : storageUrl(storagePath(storageKey))
  }
  const local = localStorage.getItem(storageKey)
  if (local) return local
  return null
}

export async function uploadByKey(storageKey: string, dataUrl: string): Promise<string> {
  const url = await uploadDataUrl(storagePath(storageKey), dataUrl)
  const versioned = `${url}?t=${Date.now()}`
  localStorage.setItem(FLAG(storageKey), versioned)
  localStorage.removeItem(storageKey)
  _manifestKeys.add(storageKey)
  pushManifest()
  return versioned
}

export function removeByKey(storageKey: string): void {
  const hadFlag = !!localStorage.getItem(FLAG(storageKey))
  localStorage.removeItem(FLAG(storageKey))
  localStorage.removeItem(storageKey)
  if (hadFlag) {
    _manifestKeys.delete(storageKey)
    pushManifest()
    deleteStorageFile(storagePath(storageKey))
  }
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

// ── Move overrides ────────────────────────────────────────────────────────────

const LS_MOVES   = 'cb_moves'
const MOVES_PATH = 'moves.json'

export function getMoveOverrides(): Record<string, Record<string, unknown>> {
  try {
    const raw = localStorage.getItem(LS_MOVES)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

let _mvSyncTimer: ReturnType<typeof setTimeout> | null = null
export function saveMoveOverride(id: string, patch: Record<string, unknown>): void {
  const overrides = getMoveOverrides()
  overrides[id] = { ...(overrides[id] ?? {}), ...patch }
  localStorage.setItem(LS_MOVES, JSON.stringify(overrides))
  if (_mvSyncTimer) clearTimeout(_mvSyncTimer)
  _mvSyncTimer = setTimeout(() => {
    const blob = new Blob([JSON.stringify(overrides)], { type: 'application/json' })
    uploadBlob(MOVES_PATH, blob).catch(err => console.warn('[charStore] moves sync failed:', err))
  }, 2000)
}

export function resetMoveOverride(id: string): void {
  const overrides = getMoveOverrides()
  delete overrides[id]
  localStorage.setItem(LS_MOVES, JSON.stringify(overrides))
  const blob = new Blob([JSON.stringify(overrides)], { type: 'application/json' })
  uploadBlob(MOVES_PATH, blob).catch(() => {})
}

// ── Cloud init ────────────────────────────────────────────────────────────────

export async function initFromCloud(): Promise<boolean> {
  let gotChars = false
  try {
    const resp = await fetch(storageUrl(CHARS_PATH), { cache: 'no-cache' })
    if (resp.ok) {
      const data: Character[] = await resp.json()
      if (Array.isArray(data) && data.length) {
        localStorage.setItem(LS_CHARS, JSON.stringify(data))
        gotChars = true
      }
    }
  } catch {}

  // Fetch move overrides from cloud
  try {
    const mvResp = await fetch(storageUrl(MOVES_PATH), { cache: 'no-cache' })
    if (mvResp.ok) {
      const overrides = await mvResp.json()
      if (overrides && typeof overrides === 'object' && !Array.isArray(overrides)) {
        localStorage.setItem(LS_MOVES, JSON.stringify(overrides))
      }
    }
  } catch {}

  // Read image manifest → set _sb flags for all known-uploaded keys
  try {
    const mResp = await fetch(storageUrl(MANIFEST_PATH), { cache: 'no-cache' })
    if (mResp.ok) {
      const keys: string[] = await mResp.json()
      if (Array.isArray(keys)) {
        keys.forEach(k => {
          _manifestKeys.add(k)
          // don't overwrite a versioned URL already stored locally
          if (!localStorage.getItem(FLAG(k))) localStorage.setItem(FLAG(k), '1')
        })
      }
    }
  } catch {}

  // HEAD-check background images so getBgUrl works cross-browser
  const bgKeysToCheck = [
    'cb_bg_main',
    ...Array.from({ length: 6 }, (_, i) => `cb_bg_battle_${i + 1}`),
  ]
  await Promise.all(bgKeysToCheck.map(async key => {
    if (!localStorage.getItem(FLAG(key))) {
      try {
        const r = await fetch(storageUrl(storagePath(key)), { method: 'HEAD', cache: 'no-cache' })
        if (r.ok) localStorage.setItem(FLAG(key), '1')
      } catch {}
    }
  }))

  _syncListeners.forEach(fn => fn())
  return gotChars
}

export function getBgUrl(type: 'main'): string | null {
  const key = `cb_bg_${type}`
  if (!localStorage.getItem(FLAG(key))) return null
  return storageUrl(storagePath(key))
}

export function getAvailableBattleBgUrls(): string[] {
  const urls: string[] = []
  for (let i = 1; i <= 6; i++) {
    const key = `cb_bg_battle_${i}`
    const flag = localStorage.getItem(FLAG(key))
    if (flag) {
      const url = flag.startsWith('http') ? flag : storageUrl(storagePath(key))
      urls.push(url)
    }
  }
  return urls
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
