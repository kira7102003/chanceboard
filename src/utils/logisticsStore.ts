export interface LogisticsRewards { gems: number; coins: number; silver: number; copper: number; iron: number; wood: number }
export interface LogisticsJob { id: string; name: string; icon: string; durationSeconds: number; rewards: LogisticsRewards }

const KEY = 'cb_logistics_jobs'
const ACTIVE_KEY = 'cb_logistics_active'
export interface ActiveLogistics { id: string; endsAt: number; charIds: string[] }
export const DEFAULT_LOGISTICS_JOBS: LogisticsJob[] = [
  { id: 'railway', name: '修鐵路', icon: '🛤️', durationSeconds: 30, rewards: { gems: 0, coins: 80, silver: 0, copper: 0, iron: 2, wood: 1 } },
  { id: 'paint', name: '刷油漆', icon: '🪣', durationSeconds: 30, rewards: { gems: 0, coins: 60, silver: 1, copper: 1, iron: 0, wood: 0 } },
  { id: 'farm', name: '種田', icon: '🌾', durationSeconds: 30, rewards: { gems: 0, coins: 50, silver: 0, copper: 0, iron: 0, wood: 2 } },
  { id: 'tree', name: '爬樹', icon: '🌳', durationSeconds: 30, rewards: { gems: 0, coins: 45, silver: 0, copper: 0, iron: 0, wood: 3 } },
  { id: 'fish', name: '捕魚', icon: '🎣', durationSeconds: 30, rewards: { gems: 1, coins: 70, silver: 0, copper: 1, iron: 0, wood: 0 } },
]
export function getLogisticsJobs(): LogisticsJob[] { try { const value = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return Array.isArray(value) && value.length ? value : DEFAULT_LOGISTICS_JOBS } catch { return DEFAULT_LOGISTICS_JOBS } }
export function saveLogisticsJobs(jobs: LogisticsJob[]): void { localStorage.setItem(KEY, JSON.stringify(jobs)) }
export function getActiveLogistics(): ActiveLogistics | null { try { const value = JSON.parse(localStorage.getItem(ACTIVE_KEY) ?? 'null'); return value?.id ? { ...value, charIds: Array.isArray(value.charIds) ? value.charIds : [] } : null } catch { return null } }
export function saveActiveLogistics(active: ActiveLogistics | null): void { if (active) localStorage.setItem(ACTIVE_KEY, JSON.stringify(active)); else localStorage.removeItem(ACTIVE_KEY) }
export function getLogisticsBusyCharacterIds(): string[] { return getActiveLogistics()?.charIds ?? [] }
