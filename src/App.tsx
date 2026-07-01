import { useState } from 'react'
import Lobby from './components/Lobby'
import CharSelect from './components/CharSelect'
import PieceSelect from './components/PieceSelect'
import BattleView from './components/BattleView'
import { useGameStore } from './store/gameStore'
import { useRoom, loadSession, clearSession } from './hooks/useRoom'
import type { PieceType } from './types/piece'

function WaitingRoom({ roomId, mySide }: { roomId: string; mySide: 'A' | 'B' | null }) {
  const copy = () => navigator.clipboard.writeText(roomId)
  return (
    <div className="lobby">
      <h1 className="title">奇蹟之盤 <span>Chanceboard</span></h1>
      <div className="lobby-card">
        <p style={{ color: '#888', textAlign: 'center' }}>
          {mySide ? `你是 ${mySide} 方，等待對手加入…` : '連線中…'}
        </p>
        <div style={{ textAlign: 'center', margin: '12px 0' }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>房間代碼</div>
          <div style={{ fontSize: '2.4rem', fontWeight: 700, letterSpacing: '6px', color: '#fff' }}>
            {roomId}
          </div>
        </div>
        <button className="btn" onClick={copy}>複製代碼</button>
        <p style={{ fontSize: '12px', color: '#555', textAlign: 'center' }}>
          把代碼傳給朋友，他輸入後對戰開始
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const saved = loadSession()
  const [roomId, setRoomId] = useState('')
  const { appPhase, mySide } = useGameStore()

  const { localPlayCard, localMoveUnit, localExecuteMove, localPass, localToggleAuto,
          sendCharSelect, sendPieceSelect, sendReady } = useRoom(roomId)

  const handleJoin = (id: string) => setRoomId(id)

  const handleRejoin = () => {
    if (saved) setRoomId(saved.roomId)
  }

  const handleCharConfirm = (ids: string[]) => {
    sendCharSelect(ids)
    useGameStore.getState().setAppPhase('pieceSelect')
  }

  const handlePieceConfirm = (p: PieceType) => {
    sendPieceSelect(p)
    sendReady()
  }

  const handleEnd = () => {
    clearSession()
    window.location.reload()
  }

  return (
    <div className="app">
      {/* 未進房間 */}
      {!roomId && (
        <Lobby
          onJoin={handleJoin}
          savedSession={saved}
          onRejoin={handleRejoin}
        />
      )}

      {/* 進了房間但還在等對手 */}
      {roomId && appPhase === 'lobby' && (
        <WaitingRoom roomId={roomId} mySide={mySide} />
      )}

      {roomId && appPhase === 'charSelect' && (
        <CharSelect onConfirm={handleCharConfirm} />
      )}

      {roomId && appPhase === 'pieceSelect' && (
        <PieceSelect onConfirm={handlePieceConfirm} />
      )}

      {roomId && (appPhase === 'battle' || appPhase === 'end') && (
        <BattleView
          onPlayCard={localPlayCard}
          onMoveUnit={localMoveUnit}
          onExecuteMove={(u, s, t) => localExecuteMove(u, s, t)}
          onPass={localPass}
          onToggleAuto={localToggleAuto}
          onEnd={handleEnd}
        />
      )}

      {roomId && appPhase !== 'lobby' && (
        <div className="room-badge">
          房間：<b>{roomId}</b>
          {mySide && <> &nbsp;|&nbsp; {mySide} 方</>}
        </div>
      )}
    </div>
  )
}
