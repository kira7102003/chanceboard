export const FONT_STORAGE_KEY = 'cb_global_font'

export const FREE_FONT_OPTIONS = [
  { id: 'noto-sans', label: '思源黑體（清楚・推薦）', family: '"Noto Sans TC", "Microsoft JhengHei", sans-serif' },
  { id: 'noto-serif', label: '思源宋體（故事感）', family: '"Noto Serif TC", "PMingLiU", serif' },
  { id: 'system', label: '系統黑體（載入最快）', family: '"Microsoft JhengHei", "PingFang TC", system-ui, sans-serif' },
] as const

export type FontOptionId = typeof FREE_FONT_OPTIONS[number]['id']

export function applyGlobalFont(id: string) {
  const option = FREE_FONT_OPTIONS.find(item => item.id === id) ?? FREE_FONT_OPTIONS[0]
  document.documentElement.style.setProperty('--app-font', option.family)
  localStorage.setItem(FONT_STORAGE_KEY, option.id)
  return option.id
}

export function initializeGlobalFont() {
  return applyGlobalFont(localStorage.getItem(FONT_STORAGE_KEY) ?? 'noto-sans')
}
