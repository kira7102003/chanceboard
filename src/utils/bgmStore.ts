import { uploadBlob, storageUrl } from './supabase'

export type BgmMode = 'selected' | 'random'
export interface BgmTrack { id: string; name: string; storageKey: string }
export interface BgmConfig { mode: BgmMode; selectedId: string; tracks: BgmTrack[] }

const LS_KEY = 'cb_bgm_library'
const CLOUD_PATH = 'audio/bgm-library.json'

const fallback = (): BgmConfig => ({ mode: 'selected', selectedId: 'legacy', tracks: [{ id: 'legacy', name: '全域 BGM', storageKey: 'cb_audio_bgm' }] })

function valid(value: unknown): value is BgmConfig {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<BgmConfig>
  return (item.mode === 'selected' || item.mode === 'random') && typeof item.selectedId === 'string' && Array.isArray(item.tracks)
}

export function getBgmConfig(): BgmConfig {
  try { const value = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null'); return valid(value) ? value : fallback() } catch { return fallback() }
}

export function saveBgmConfig(config: BgmConfig): void {
  localStorage.setItem(LS_KEY, JSON.stringify(config))
  window.dispatchEvent(new CustomEvent('chanceboard:bgm-change', { detail: config }))
  uploadBlob(CLOUD_PATH, new Blob([JSON.stringify(config)], { type: 'application/json' })).catch(error => console.warn('[bgm] config upload failed', error))
}

export async function syncBgmConfig(): Promise<BgmConfig> {
  try {
    const response = await fetch(storageUrl(CLOUD_PATH), { cache: 'no-cache' })
    if (response.ok) {
      const value: unknown = await response.json()
      if (valid(value)) { localStorage.setItem(LS_KEY, JSON.stringify(value)); return value }
    }
  } catch (error) { console.warn('[bgm] config sync failed; using local data', error) }
  return getBgmConfig()
}
