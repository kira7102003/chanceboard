import { useState } from 'react'
import type { SavedSession } from '../hooks/useRoom'

interface Props {
  onJoin: (roomId: string) => void
  savedSession: SavedSession | null
  onRejoin: () => void
}

export default function Lobby({ onJoin, savedSession, onRejoin }: Props) {
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
      <h1 className="title">奇蹟之盤 <span>Chanceboard</span></h1>

      {/* 繼續上局 */}
      {savedSession && (
        <div className="lobby-card" style={{ borderColor: '#8866ff' }}>
          <p style={{ textAlign: 'center', color: '#aaa', fontSize: '13px' }}>上次的房間</p>
          <div style={{ textAlign: 'center', fontSize: '1.8rem', fontWeight: 700,
                        letterSpacing: '4px', color: '#fff', margin: '8px 0' }}>
            {savedSession.roomId}
          </div>
          <p style={{ textAlign: 'center', fontSize: '12px', color: '#666', marginBottom: '8px' }}>
            你是 {savedSession.side} 方
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
            placeholder="房間代碼"
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && join()}
            maxLength={8}
          />
          <button className="btn" onClick={join}>加入</button>
        </div>
      </div>
    </div>
  )
}
