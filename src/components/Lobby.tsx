import { useState } from 'react'
import type { SavedSession } from '../hooks/useRoom'
import { getChars, getUrlByKey } from '../utils/charStore'

interface Props {
  onJoin:       (roomId: string) => void
  onSolo:       () => void
  onAIBattle:   () => void
  savedSession: SavedSession | null
  onRejoin:     () => void
  onAdmin:      () => void
}

export default function Lobby({ onJoin, onSolo, onAIBattle, savedSession, onRejoin, onAdmin }: Props) {
  const [input,      setInput]      = useState('')
  const [showOnline, setShowOnline] = useState(false)
  const [imgFailed,  setImgFailed]  = useState(false)

  const firstChar  = getChars()[0]
  const charImgUrl = firstChar ? getUrlByKey(`cb_img_${firstChar.id}`) : null

  const create = () => {
    const id = Math.random().toString(36).slice(2, 8).toUpperCase()
    onJoin(id)
  }

  const join = () => {
    const id = input.trim().toUpperCase()
    if (id.length >= 4) onJoin(id)
  }

  const GRID_BTNS = [
    { icon: '✨', label: '召喚',     action: undefined as (() => void) | undefined },
    { icon: '📚', label: '收藏',     action: undefined },
    { icon: '🛒', label: '商店',     action: undefined },
    { icon: '🤝', label: '雙人對戰', action: () => setShowOnline(v => !v) },
    { icon: '🛡', label: '隊伍',     action: undefined },
    { icon: '📖', label: '遊戲規則', action: undefined },
  ]

  return (
    <div className="lobby-v2">

      {/* ── Character portrait ──────────────────────────────── */}
      {charImgUrl && !imgFailed && (
        <div className="lv2-char">
          <img src={charImgUrl} alt="" className="lv2-char-img"
            onError={() => setImgFailed(true)} />
        </div>
      )}

      {/* ── Resources (top-right) ───────────────────────────── */}
      <div className="lv2-resources">
        <span className="lv2-res">🪙 <b>1320</b></span>
        <span className="lv2-res">💎 <b>395</b></span>
      </div>

      {/* ── Menu panel (right) ──────────────────────────────── */}
      <div className="lv2-panel">

        {/* Primary button */}
        <button className="lv2-btn-main" onClick={onSolo}>
          <span className="lv2-btn-icon">⚔</span>
          <div>
            <div className="lv2-btn-title">單人對戰</div>
            <div className="lv2-btn-sub">挑一支隊伍，跟電腦對戰</div>
          </div>
        </button>

        {/* 2×3 grid */}
        <div className="lv2-grid">
          {GRID_BTNS.map(({ icon, label, action }) => (
            <button key={label}
              className={`lv2-btn-grid${action ? '' : ' disabled'}`}
              onClick={action}
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

        {/* Settings */}
        <button className="lv2-btn-settings" onClick={onAdmin}>
          <span>⚙</span><span>設定</span>
        </button>

      </div>
    </div>
  )
}
