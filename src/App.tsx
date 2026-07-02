import { useState } from 'react'
import Lobby      from './components/Lobby'
import CharSelect  from './components/CharSelect'
import DeckBuild   from './components/DeckBuild'
import BattleView  from './components/BattleView'
import Admin       from './components/Admin'
import { useGameStore }           from './store/gameStore'
import { useRoom, loadSession, clearSession } from './hooks/useRoom'
import { useSolo }                from './hooks/useSolo'

// ── Waiting room (online only) ────────────────────────────────────────────────

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

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const saved = loadSession()
  const [onlineRoomId, setOnlineRoomId] = useState('')
  const [showAdmin,    setShowAdmin]    = useState(false)

  const { appPhase, mySide, isSolo } = useGameStore()

  // ── Controllers ──────────────────────────────────────────────────────────────

  // Online: WebSocket room (no-op when isSolo)
  const { localPlayCard, localMoveUnit, localExecuteMove, localPass, localToggleAuto,
          sendCharSelect, sendDeckSelect } = useRoom(isSolo ? '' : onlineRoomId)

  // Solo: direct engine driver
  const { startSolo } = useSolo()

  // ── Routing helpers ───────────────────────────────────────────────────────────

  // Gate: something is active (online room OR solo mode)
  const isActive = isSolo || !!onlineRoomId

  // ── Lobby handlers ────────────────────────────────────────────────────────────

  const handleJoin = (id: string) => setOnlineRoomId(id)

  const handleRejoin = () => { if (saved) setOnlineRoomId(saved.roomId) }

  const handleSoloStart = () => {
    const store = useGameStore.getState()
    store.setSolo(true)
    store.setRoom('SOLO', 'A', true)
    store.setPlayerCount(2)   // skip "等待對手" in CharSelect
    store.setAppPhase('charSelect')
  }

  // ── CharSelect handlers ───────────────────────────────────────────────────────

  const handleCharConfirm = (ids: string[]) => {
    if (isSolo) {
      // No server — go straight to deckBuild; opponent picked later in startSolo
      useGameStore.getState().setAppPhase('deckBuild')
    } else {
      sendCharSelect(ids)
      useGameStore.getState().setAppPhase('deckBuild')
    }
  }

  // ── DeckBuild handlers ────────────────────────────────────────────────────────

  const handleDeckConfirm = (deckIds: string[]) => {
    const store = useGameStore.getState()
    if (isSolo) {
      startSolo(store.selectedCharIds, deckIds)
    } else {
      store.setMyDeck(deckIds)
      sendDeckSelect(deckIds)
    }
  }

  // ── End handlers ──────────────────────────────────────────────────────────────

  const handleEnd = () => {
    clearSession()
    window.location.reload()
  }

  const handleSoloReplay = () => {
    const store = useGameStore.getState()
    store.stopATBLoop()
    useGameStore.setState({
      game:            null,
      appPhase:        'charSelect',
      selectedCharIds: [],
      opponentCharIds: [],
      myDeckIds:       [],
      opponentDeckIds: [],
      soloScore:       null,
      pendingUnitId:   null,
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="app">
      {/* 資料編輯器 */}
      {showAdmin && <Admin onBack={() => setShowAdmin(false)} />}

      {/* 大廳 */}
      {!showAdmin && !isActive && (
        <Lobby
          onJoin={handleJoin}
          onSolo={handleSoloStart}
          savedSession={saved}
          onRejoin={handleRejoin}
          onAdmin={() => setShowAdmin(true)}
        />
      )}

      {/* Online：等待對手 */}
      {!showAdmin && !isSolo && onlineRoomId && appPhase === 'lobby' && (
        <WaitingRoom roomId={onlineRoomId} mySide={mySide} />
      )}

      {/* 選角 */}
      {!showAdmin && isActive && appPhase === 'charSelect' && (
        <CharSelect onConfirm={handleCharConfirm} />
      )}

      {/* 組牌 */}
      {!showAdmin && isActive && appPhase === 'deckBuild' && (
        <DeckBuild onConfirm={handleDeckConfirm} />
      )}

      {/* 戰鬥 */}
      {!showAdmin && isActive && (appPhase === 'battle' || appPhase === 'end') && (
        <BattleView
          onPlayCard={localPlayCard}
          onMoveUnit={localMoveUnit}
          onExecuteMove={(u, s, t) => localExecuteMove(u, s, t)}
          onPass={localPass}
          onToggleAuto={localToggleAuto}
          onEnd={handleEnd}
          onSoloReplay={handleSoloReplay}
        />
      )}

      {/* 房間標籤 (online only) */}
      {!showAdmin && !isSolo && onlineRoomId && appPhase !== 'lobby' && (
        <div className="room-badge">
          房間：<b>{onlineRoomId}</b>
          {mySide && <> &nbsp;|&nbsp; {mySide} 方</>}
        </div>
      )}

      {/* Solo 標籤 */}
      {!showAdmin && isSolo && appPhase !== 'charSelect' && appPhase !== 'deckBuild' && (
        <div className="room-badge">⚔ 單人模式</div>
      )}
    </div>
  )
}
