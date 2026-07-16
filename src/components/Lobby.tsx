import { lazy, Suspense, useState, useEffect, useRef } from 'react'
import type { SavedSession } from '../hooks/useRoom'
import { getChars, getUrlByKey, onCloudSynced } from '../utils/charStore'
import { usePlayerStore } from '../store/playerStore'
import type { FeatureMode } from './FeaturePanel'
const Collection = lazy(() => import('./Collection'))
const Shop = lazy(() => import('./Shop'))
const Summon = lazy(() => import('./Summon'))
const Teams = lazy(() => import('./Teams'))
const Settings = lazy(() => import('./Settings'))
const StoryMode = lazy(() => import('./StoryMode'))
const FeaturePanel = lazy(() => import('./FeaturePanel'))
const DuelMenu = lazy(() => import('./DuelMenu'))
const PlayerProfile = lazy(() => import('./PlayerProfile'))

type Panel = 'profile' | 'duel' | 'summon' | 'collection' | 'shop' | 'teams' | 'settings' | 'story' | 'pieces' | 'tasks' | 'mail' | 'achievements' | 'announcements' | 'friends' | null

interface Props {
  onJoin:        (roomId: string) => void
  onSolo:        () => void
  onAIBattle:    () => void
  savedSession:  SavedSession | null
  onRejoin:      () => void
  onAdmin:       () => void
}

const LOBBY_CHAR_KEY = 'cb_lobby_char'

export default function Lobby({ onJoin, onSolo, onAIBattle, savedSession, onRejoin, onAdmin }: Props) {
  const [imgFailed,  setImgFailed]  = useState(false)
  const [panel,      setPanel]      = useState<Panel>(null)
  const [, forceUpdate] = useState(0)
  const imgErrCount = useRef(0)

  // Re-evaluate charImgUrl after cloud data loads (desktop fresh-session fix)
  useEffect(() => onCloudSynced(() => { imgErrCount.current = 0; setImgFailed(false); forceUpdate(n => n + 1) }), [])

  const { coins, gems, materials, ownedCharIds, level, experience, desktopCharIds, addExperience } = usePlayerStore()

  const ownedChars = getChars().filter(c => ownedCharIds.includes(c.id))
  const configuredChars = (desktopCharIds ?? []).map(id => ownedChars.find(c => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c)
  const chars = configuredChars.length ? configuredChars : ownedChars
  const savedId  = localStorage.getItem(LOBBY_CHAR_KEY)
  const initIdx  = Math.max(0, chars.findIndex(c => c.id === savedId))
  const [charIdx, setCharIdx] = useState(initIdx)

  // 有些角色沒上傳過立繪（getUrlByKey 為 null）——顯示與切換都要跳過它們，
  // 否則輪到沒圖的角色時整個立繪消失、也點不到它切回來（cb_lobby_char 又記住了它）。
  const imageKeyFor = (id: string) => `cb_wide_img_${id}`
  const hasImg = (i: number) => !!chars[i] && !!getUrlByKey(imageKeyFor(chars[i].id))
  let dispIdx = charIdx
  for (let i = 0; i < chars.length; i++) {
    const idx = (charIdx + i) % chars.length
    if (hasImg(idx)) { dispIdx = idx; break }
  }
  const activeChar = chars[dispIdx]
  const activeImageKey = activeChar ? imageKeyFor(activeChar.id) : null
  const charImgUrl = activeImageKey ? getUrlByKey(activeImageKey) : null

  const cycleChar = () => {
    if (chars.length === 0) return
    imgErrCount.current = 0
    let next = (dispIdx + 1) % chars.length
    while (next !== dispIdx && !hasImg(next)) next = (next + 1) % chars.length
    setCharIdx(next)
    setImgFailed(false)
    localStorage.setItem(LOBBY_CHAR_KEY, chars[next].id)
  }

  const handleImgError = () => {
    // Clear stale '1' flag so this URL isn't tried again next session
    if (activeChar) {
      const flagKey = `${activeImageKey ?? `cb_wide_img_${activeChar.id}`}_sb`
      if (localStorage.getItem(flagKey) === '1') localStorage.removeItem(flagKey)
    }
    imgErrCount.current += 1
    if (imgErrCount.current < chars.length) {
      // Try next character that has an image
      let next = (dispIdx + 1) % chars.length
      while (next !== dispIdx && !hasImg(next)) {
        next = (next + 1) % chars.length
      }
      if (next !== dispIdx) {
        setCharIdx(next)
        // imgFailed stays false so next char's image can attempt to load
        return
      }
    }
    setImgFailed(true)  // all chars tried or limit reached
  }

  type MenuItem = { icon: string; iconImage?: string; label: string; panelKey?: Panel; action?: () => void; enabled: boolean }
  const MAIN_BTNS: MenuItem[] = [
    { icon: '⚔️', label: '決鬥', enabled: true, panelKey: 'duel' },
    { icon: '📖', label: '故事', enabled: true, panelKey: 'story' },
    { icon: '👥', label: '隊伍', enabled: true, panelKey: 'teams' },
    { icon: '', iconImage: '/chess-piece.svg', label: '棋子', enabled: true, panelKey: 'pieces' },
    { icon: '✨', label: '召喚', enabled: true, panelKey: 'summon' },
  ]
  const SECONDARY_BTNS: MenuItem[] = [
    { icon: '🎯', label: '任務', enabled: true, panelKey: 'tasks' }, { icon: '📬', label: '信箱', enabled: true, panelKey: 'mail' },
    { icon: '🛒', label: '商店', enabled: true, panelKey: 'shop' }, { icon: '🏆', label: '成就', enabled: true, panelKey: 'achievements' },
    { icon: '📢', label: '公告', enabled: true, panelKey: 'announcements' }, { icon: '📚', label: '收藏', enabled: true, panelKey: 'collection' },
    { icon: '🤝', label: '好友', enabled: true, panelKey: 'friends' },
  ]

  const MenuGrid = ({ items, secondary = false }: { items: MenuItem[]; secondary?: boolean }) => <div className={`lv2-grid ${secondary ? 'lv2-grid-secondary' : 'lv2-grid-main'}`}>
    {items.map(({ icon, iconImage, label, panelKey, action, enabled }) => <button key={label} disabled={!enabled}
      title={enabled ? label : `${label}（尚未開放）`} className={`lv2-btn-grid${secondary ? '' : ' lv2-btn-primary'}${enabled ? '' : ' disabled'}`}
      onClick={enabled ? (panelKey ? () => setPanel(panelKey) : action) : undefined}>
      <span>{iconImage ? <img className="lv2-menu-icon-img" src={iconImage} alt="" /> : icon}</span><span>{label}</span>{!enabled && <small>尚未開放</small>}
    </button>)}
  </div>

  return (
    <>
      {/* ── Overlay panels ── */}
      <Suspense fallback={<div className="route-loading">載入畫面中…</div>}>
      {panel === 'summon'     && <Summon     onClose={() => setPanel(null)} />}
      {panel === 'collection' && <Collection onClose={() => setPanel(null)} />}
      {panel === 'shop'       && <Shop       onClose={() => setPanel(null)} />}
      {panel === 'settings'   && <Settings onClose={() => setPanel(null)} />}
      {panel === 'story'      && <StoryMode onClose={() => setPanel(null)} onComplete={chapter => { addExperience(100); usePlayerStore.getState().claimStoryReward(chapter.id, chapter.rewards ?? {}) }} />}
      {panel === 'profile'    && <PlayerProfile onClose={() => setPanel(null)} />}
      {panel === 'duel'       && <DuelMenu onClose={() => setPanel(null)} onJoin={onJoin} onSolo={onSolo}
        onAIBattle={onAIBattle} savedSession={savedSession} onRejoin={onRejoin} />}
      {panel && ['pieces','tasks','mail','achievements','announcements','friends'].includes(panel) && <FeaturePanel mode={panel as FeatureMode} onClose={() => setPanel(null)} />}
      {panel === 'teams'      && (
        <Teams onClose={() => setPanel(null)} />
      )}
      </Suspense>

      <div className="lobby-v2">

        <button className="lv2-level-entry" onClick={() => setPanel('profile')} title="玩家等級與桌面立繪設定">
          <span>LV</span><b>{level}</b><i><em style={{ width: `${Math.min(100, experience / (Math.max(1, level) * 100) * 100)}%` }} /></i>
        </button>

        {/* ── Character portrait ── */}
        {charImgUrl && !imgFailed && (
          <div className="lv2-char" onClick={cycleChar} style={{ cursor: 'pointer' }} title="點擊切換角色">
            <img src={charImgUrl} alt="" className="lv2-char-img"
              onError={handleImgError} />
          </div>
        )}

        {/* ── User identity + resources: one aligned HUD row ── */}
        <div className="lv2-top-hud">
          <div className="lv2-resources">
            <span className="lv2-res"><i className="resource-icon gem">◆</i><b>{gems}</b></span>
            <span className="lv2-res"><i className="resource-icon gold">●</i><b>金 {coins.toLocaleString()}</b></span>
            <span className="lv2-res resource-silver"><i className="resource-icon silver">●</i><b>銀 {materials?.silver ?? 0}</b></span>
            <span className="lv2-res resource-copper"><i className="resource-icon copper">●</i><b>銅 {materials?.copper ?? 0}</b></span>
            <span className="lv2-res resource-iron"><i className="resource-icon iron">⬡</i><b>鐵 {materials?.iron ?? 0}</b></span>
            <span className="lv2-res resource-wood"><i className="resource-icon wood">▰</i><b>木 {materials?.wood ?? 0}</b></span>
          </div>
        </div>

        {/* ── Menu panel (right) ── */}
        <div className="lv2-panel">

          <MenuGrid items={MAIN_BTNS} />

        </div>

        {/* Reserved mission-status zone; content will be connected later. */}
        <div className="lv2-task-status" aria-hidden="true" />

        {/* ── Secondary actions: fixed bottom strip ── */}
        <div className="lv2-support-panel">
          <MenuGrid items={SECONDARY_BTNS} secondary />
          <div className="lv2-bottom-actions">
            <button className="lv2-btn-settings" onClick={onAdmin}><span>🗂</span><span>資料管理</span></button>
            <button className="lv2-btn-settings" onClick={() => setPanel('settings')}><span>⚙</span><span>設定</span></button>
          </div>
        </div>
      </div>
    </>
  )
}
