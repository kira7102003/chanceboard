import { useState } from 'react'
import Lobby from './components/Lobby'
import CharSelect from './components/CharSelect'
import PieceSelect from './components/PieceSelect'
import BattleView from './components/BattleView'
import { useGameStore } from './store/gameStore'
import { useRoom } from './hooks/useRoom'
import type { PieceType } from './types/piece'

export default function App() {
  const [roomId, setRoomId] = useState('')
  const { appPhase, mySide } = useGameStore()

  const { localPlayCard, localMoveUnit, localExecuteMove, localPass,
          sendCharSelect, sendPieceSelect, sendReady } = useRoom(roomId)

  const handleJoin = (id: string) => setRoomId(id)

  const handleCharConfirm = (ids: string[]) => {
    sendCharSelect(ids)
    useGameStore.getState().setAppPhase('pieceSelect')
  }

  const handlePieceConfirm = (p: PieceType) => {
    sendPieceSelect(p)
    sendReady()
    // Server triggers startBattle when both ready
  }

  return (
    <div className="app">
      {(!roomId || appPhase === 'lobby') && (
        <Lobby onJoin={handleJoin} />
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
        />
      )}

      {roomId && (
        <div className="room-badge">
          房間：<b>{roomId}</b>
          {mySide && <> &nbsp;|&nbsp; {mySide} 方</>}
        </div>
      )}
    </div>
  )
}
