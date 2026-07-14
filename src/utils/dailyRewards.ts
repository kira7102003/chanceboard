import { storageUrl, uploadBlob } from './supabase'

export interface DailyReward { coins: number; gems: number }
export const DEFAULT_DAILY_REWARD: DailyReward = { coins: 200, gems: 5 }

const STORAGE_KEY = 'cb_daily_rewards'
const CLOUD_PATH = 'daily-rewards.json'

export function localDateKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getDailyRewards(): Record<string, DailyReward> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? parsed as Record<string, DailyReward> : {}
  } catch (error) {
    console.warn('[dailyRewards] invalid local settings', error)
    return {}
  }
}

export function getDailyReward(dateKey: string): DailyReward {
  return getDailyRewards()[dateKey] ?? DEFAULT_DAILY_REWARD
}

export async function saveDailyReward(dateKey: string, reward: DailyReward): Promise<void> {
  await saveDailyRewardSettings({ [dateKey]: reward })
}

export async function saveDailyRewardSettings(updates: Record<string, DailyReward>): Promise<void> {
  const today = localDateKey()
  if (Object.keys(updates).some(dateKey => dateKey < today)) throw new Error('過去日期不能修改')
  const rewards = getDailyRewards()
  for (const [dateKey, reward] of Object.entries(updates)) {
    rewards[dateKey] = {
      coins: Math.max(0, Math.floor(reward.coins)),
      gems: Math.max(0, Math.floor(reward.gems)),
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rewards))
  const blob = new Blob([JSON.stringify(rewards)], { type: 'application/json' })
  await uploadBlob(CLOUD_PATH, blob)
}

export async function initDailyRewards(): Promise<void> {
  try {
    const response = await fetch(storageUrl(CLOUD_PATH), { cache: 'no-cache' })
    if (!response.ok) return
    const rewards: unknown = await response.json()
    if (rewards && typeof rewards === 'object' && !Array.isArray(rewards)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rewards))
    }
  } catch (error) {
    console.warn('[dailyRewards] cloud sync failed; using defaults/local settings', error)
  }
}
