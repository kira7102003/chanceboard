import { useState } from 'react'
import type { SavedSession } from '../hooks/useRoom'

interface Props {
  onJoin: (roomId: string) => void
  savedSession: SavedSession | null
  onRejoin: () => void
  onAdmin: () => void
}

export default function Lobby({ onJoin, savedSession, onRejoin, onAdmin }: Props) {
  const [input, setInput] = useState('')

  const create = () => {
    const id = Math.random().toString(36).slice(2, 8).toUpperCase()
    onJoin(id)
  }

  const join = () => {
    const id = input.trim().toUpperCase()
    if (id.length >= 4) onJoin(id)
  }

  return (
    <div className="lobby">
      <div style={{ textAlign: 'center' }}>
        <h1 className="title">奇蹟之盤 <span>Chanceboard</span></h1>
        <p style={{ color: '#444466', fontSize: 12, marginTop: 6, letterSpacing: 1 }}>
          TWO-PLAYER TACTICAL CARD BATTLE
        </p>
      </div>

      {savedSession && (
        <div className="lobby-card" style={{ borderColor: '#443388', minWidth: 280 }}>
          <p style={{ textAlign: 'center', color: '#666688', fontSize: 11,
                      letterSpacing: 1, textTransform: 'uppercase' }}>上次的對局</p>
          <div style={{ textAlign: 'center', fontSize: '2rem', fontWeight: 800,
                        letterSpacing: '6px', color: '#d8d8f4', margin: '4px 0' }}>
            {savedSession.roomId}
          </div>
          <p style={{ textAlign: 'center', fontSize: 11, color: '#444466' }}>
            <span className={`side side-${savedSession.side}`}>{savedSession.side} 方</span>
          </p>
          <button className="btn primary" onClick={onRejoin}>繼續上局</button>
        </div>
      )}

      <div className="lobby-card">
        <button className="btn primary" onClick={create}>建立新房間</button>
        <div className="divider">— 或 —</div>
        <div className="join-row">
          <input
            className="input"
            placeholder="輸入代碼"
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && join()}
            maxLength={8}
          />
          <button className="btn" onClick={join}>加入</button>
        </div>
        <p style={{ fontSize: 11, color: '#333350', textAlign: 'center' }}>
          建立房間後把代碼傳給對手，雙方加入即可開始
        </p>
      </div>

      <button
        className="btn"
        style={{ fontSize: 11, color: '#333355', border: '1px solid #222338', background: 'transparent' }}
        onClick={onAdmin}
      >
        ⚙ 資料編輯器
      </button>
    </div>
  )
}
