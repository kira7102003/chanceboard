import { uploadBlob, storageUrl } from './supabase'

export type BgmMode = 'selected' | 'random'
export type BgmChannel = 'lobby' | 'battle'
export interface BgmTrack { id: string; name: string; storageKey: string }
export interface BgmConfig { mode: BgmMode; selectedId: string; tracks: BgmTrack[] }

const keyFor = (channel: BgmChannel) => channel === 'battle' ? 'cb_bgm_library_battle' : 'cb_bgm_library'
const pathFor = (channel: BgmChannel) => `audio/bgm-library-${channel}.json`

const fallback = (channel: BgmChannel): BgmConfig => channel === 'lobby'
  ? { mode: 'selected', selectedId: 'legacy', tracks: [{ id: 'legacy', name: '大廳 BGM', storageKey: 'cb_audio_bgm' }] }
  : { mode: 'random', selectedId: '', tracks: [] }

function valid(value: unknown): value is BgmConfig {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<BgmConfig>
  return (item.mode === 'selected' || item.mode === 'random') && typeof item.selectedId === 'string' && Array.isArray(item.tracks)
}

export function getBgmConfig(channel: BgmChannel = 'lobby'): BgmConfig {
  try { const value = JSON.parse(localStorage.getItem(keyFor(channel)) ?? 'null'); return valid(value) ? value : fallback(channel) } catch { return fallback(channel) }
}

export function saveBgmConfig(config: BgmConfig, channel: BgmChannel = 'lobby'): void {
  localStorage.setItem(keyFor(channel), JSON.stringify(config))
  window.dispatchEvent(new CustomEvent('chanceboard:bgm-change', { detail: { channel, config } }))
  uploadBlob(pathFor(channel), new Blob([JSON.stringify(config)], { type: 'application/json' })).catch(error => console.warn('[bgm] config upload failed', error))
}

export async function syncBgmConfig(channel: BgmChannel = 'lobby'): Promise<BgmConfig> {
  try {
    const response = await fetch(storageUrl(pathFor(channel)), { cache: 'no-cache' })
    if (response.ok) {
      const value: unknown = await response.json()
      if (valid(value)) { localStorage.setItem(keyFor(channel), JSON.stringify(value)); return value }
    }
  } catch (error) { console.warn('[bgm] config sync failed; using local data', error) }
  return getBgmConfig(channel)
}
