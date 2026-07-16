import { useState } from 'react'
import type { SavedSession } from '../hooks/useRoom'
import FunctionIcon from './FunctionIcon'

interface Props {
  onClose: () => void
  onJoin: (roomId: string) => void
  onSolo: () => void
  onAIBattle: () => void
  savedSession: SavedSession | null
  onRejoin: () => void
}

export default function DuelMenu({ onClose, onJoin, onSolo, onAIBattle, savedSession, onRejoin }: Props) {
  const [roomCode, setRoomCode] = useState('')
  const joinRoom = () => {
    const id = roomCode.trim().toUpperCase()
    if (id.length >= 4) onJoin(id)
  }
  const createRoom = () => onJoin(Math.random().toString(36).slice(2, 8).toUpperCase())

  return <div className="panel-overlay duel-menu">
    <div className="panel-header">
      <button className="panel-back" onClick={onClose}>← 返回大廳</button>
      <span className="panel-title"><FunctionIcon name="duel" />決鬥</span>
    </div>
    <div className="panel-body duel-menu-body">
      <div className="duel-mode-grid">
        <button className="duel-mode-card" onClick={onSolo}><span>⚔️</span><b>單人決鬥</b><small>選擇隊伍與牌組，挑戰電腦對手</small></button>
        <button className="duel-mode-card" onClick={createRoom}><span>🏰</span><b>建立多人房間</b><small>建立房間並邀請另一位玩家</small></button>
        <button className="duel-mode-card" onClick={onAIBattle}><span>🤖</span><b>AI 對戰觀戰</b><small>觀看雙方 AI 自動完成對戰</small></button>
        {savedSession && <button className="duel-mode-card resume" onClick={onRejoin}><span>↩️</span><b>繼續上局</b><small>房間 {savedSession.roomId}</small></button>}
      </div>
      <section className="duel-join-card">
        <div><b>加入多人房間</b><small>輸入另一位玩家提供的房間代碼</small></div>
        <input className="input" value={roomCode} maxLength={8} placeholder="房間代碼"
          onChange={event => setRoomCode(event.target.value.toUpperCase())}
          onKeyDown={event => event.key === 'Enter' && joinRoom()} />
        <button className="btn primary" disabled={roomCode.trim().length < 4} onClick={joinRoom}>加入房間</button>
      </section>
    </div>
  </div>
}
