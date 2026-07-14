import { lazy, Suspense, useState, useEffect, useRef } from 'react'
import type { SavedSession } from '../hooks/useRoom'
import { getChars, getUrlByKey, onCloudSynced } from '../utils/charStore'
import { supabase } from '../utils/supabase'
import { usePlayerStore } from '../store/playerStore'
const Collection = lazy(() => import('./Collection'))
const Shop = lazy(() => import('./Shop'))
const Summon = lazy(() => import('./Summon'))
const Teams = lazy(() => import('./Teams'))
const Settings = lazy(() => import('./Settings'))

type Panel = 'summon' | 'collection' | 'shop' | 'teams' | 'settings' | null

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
  const [input,      setInput]      = useState('')
  const [showOnline, setShowOnline] = useState(false)
  const [imgFailed,  setImgFailed]  = useState(false)
  const [panel,      setPanel]      = useState<Panel>(null)
  const [, forceUpdate] = useState(0)
  const imgErrCount = useRef(0)

  // Re-evaluate charImgUrl after cloud data loads (desktop fresh-session fix)
  useEffect(() => onCloudSynced(() => { imgErrCount.current = 0; setImgFailed(false); forceUpdate(n => n + 1) }), [])

  const { coins, gems, ownedCharIds } = usePlayerStore()

  const chars  = getChars().filter(c => ownedCharIds.includes(c.id))
  const savedId  = localStorage.getItem(LOBBY_CHAR_KEY)
  const initIdx  = Math.max(0, chars.findIndex(c => c.id === savedId))
  const [charIdx, setCharIdx] = useState(initIdx)

  // 有些角色沒上傳過立繪（getUrlByKey 為 null）——顯示與切換都要跳過它們，
  // 否則輪到沒圖的角色時整個立繪消失、也點不到它切回來（cb_lobby_char 又記住了它）。
  const hasImg = (i: number) => !!chars[i] && !!getUrlByKey(`cb_img_${chars[i].id}`)
  let dispIdx = charIdx
  for (let i = 0; i < chars.length; i++) {
    const idx = (charIdx + i) % chars.length
    if (hasImg(idx)) { dispIdx = idx; break }
  }
  const activeChar = chars[dispIdx]
  const charImgUrl = activeChar ? getUrlByKey(`cb_img_${activeChar.id}`) : null

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
      const flagKey = `cb_img_${activeChar.id}_sb`
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

  const create = () => {
    const id = Math.random().toString(36).slice(2, 8).toUpperCase()
    onJoin(id)
  }
  const join = () => {
    const id = input.trim().toUpperCase()
    if (id.length >= 4) onJoin(id)
  }

  const GRID_BTNS: { icon: string; label: string; panelKey?: Panel; action?: () => void }[] = [
    { icon: '✨', label: '招喚',     panelKey: 'summon' },
    { icon: '📚', label: '收藏',     panelKey: 'collection' },
    { icon: '🛒', label: '商店',     panelKey: 'shop' },
    { icon: '🤝', label: '雙人對戰', action: () => setShowOnline(v => !v) },
    { icon: '🛡', label: '隊伍',     panelKey: 'teams' },
    { icon: '🗂', label: '資料管理', action: onAdmin },
  ]

  return (
    <>
      {/* ── Overlay panels ── */}
      <Suspense fallback={<div className="route-loading">載入畫面中…</div>}>
      {panel === 'summon'     && <Summon     onClose={() => setPanel(null)} />}
      {panel === 'collection' && <Collection onClose={() => setPanel(null)} />}
      {panel === 'shop'       && <Shop       onClose={() => setPanel(null)} />}
      {panel === 'settings'   && <Settings onClose={() => setPanel(null)} />}
      {panel === 'teams'      && (
        <Teams onClose={() => setPanel(null)} />
      )}
      </Suspense>

      <div className="lobby-v2">

        {/* ── Character portrait ── */}
        {charImgUrl && !imgFailed && (
          <div className="lv2-char" onClick={cycleChar} style={{ cursor: 'pointer' }} title="點擊切換角色">
            <img src={charImgUrl} alt="" className="lv2-char-img"
              onError={handleImgError} />
          </div>
        )}

        {/* ── Resources (top-right) ── */}
        <div className="lv2-resources">
          <span className="lv2-res">🪙 <b>{coins.toLocaleString()}</b></span>
          <span className="lv2-res">💎 <b>{gems}</b></span>
        </div>

        {/* ── Menu panel (right) ── */}
        <div className="lv2-panel">

          {/* Primary button */}
          <button className="lv2-btn-main" onClick={onSolo}>
            <span className="lv2-btn-icon">⚔</span>
            <div>
              <div className="lv2-btn-title">單人對戰</div>
            </div>
          </button>

          {/* 2×3 grid */}
          <div className="lv2-grid">
            {GRID_BTNS.map(({ icon, label, panelKey, action }) => (
              <button
                key={label}
                className={`lv2-btn-grid${panelKey || action ? '' : ' disabled'}`}
                onClick={panelKey ? () => setPanel(panelKey) : action}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Online submenu */}
          {showOnline && (
            <div className="lv2-online">
              <button className="lv2-btn-sm" onClick={create}>建立多人房間</button>
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="input" style={{ flex: 1, fontSize: 12 }}
                  placeholder="輸入房間代碼"
                  value={input}
                  onChange={e => setInput(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && join()}
                  maxLength={8}
                />
                <button className="lv2-btn-sm" style={{ width: 'auto', whiteSpace: 'nowrap' }} onClick={join}>加入</button>
              </div>
              <button className="lv2-btn-sm" onClick={onAIBattle}>🤖 AI 對戰觀戰</button>
              {savedSession && (
                <button className="lv2-btn-sm" style={{ color: '#9988ee' }} onClick={onRejoin}>
                  繼續上局（{savedSession.roomId}）
                </button>
              )}
            </div>
          )}

          {/* Bottom row */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="lv2-btn-settings" style={{ flex: 1 }} onClick={() => setPanel('settings')}>
              <span>⚙</span><span>設定</span>
            </button>
            <button className="lv2-btn-settings" style={{ flex: 'none', gap: 6 }}
              onClick={() => supabase.auth.signOut()}>
              <span>🚪</span><span>登出</span>
            </button>
          </div>

        </div>
      </div>
    </>
  )
}
