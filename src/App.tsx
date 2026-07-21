import { lazy, Suspense, useState, useEffect, useRef } from 'react'
import Lobby      from './components/Lobby'
import Login       from './components/Login'
import DailyCheckIn from './components/DailyCheckIn'
import { useGameStore }           from './store/gameStore'
import { usePlayerStore }         from './store/playerStore'
import { useRoom, loadSession, clearSession } from './hooks/useRoom'
import { initFromCloud, getBgUrl, getAvailableBattleBgUrls, getUrlByKey, warmImageCache } from './utils/charStore'
import { useSolo }                from './hooks/useSolo'
import { useAIBattle }           from './hooks/useAIBattle'
import { supabase }               from './utils/supabase'
import type { User }              from '@supabase/supabase-js'
import { initDailyRewards } from './utils/dailyRewards'
import { getLogisticsBusyCharacterIds } from './utils/logisticsStore'
import { getBgmConfig, syncBgmConfig, type BgmConfig } from './utils/bgmStore'

const CharSelect = lazy(() => import('./components/CharSelect'))
const DeckBuild = lazy(() => import('./components/DeckBuild'))
const BattleView = lazy(() => import('./components/BattleView'))
const Admin = lazy(() => import('./components/Admin'))

// ── Rotate prompt (portrait mobile only) ─────────────────────────────────────

function RotatePrompt() {
  return (
    <div className="rotate-prompt">
      <div className="rotate-phone">📱</div>
      <div className="rotate-arrow">↻</div>
      <div className="rotate-text">請旋轉畫面以橫向操作</div>
      <div className="rotate-sub">Please rotate to landscape</div>
    </div>
  )
}

function GlobalBgm({ config, enabled, volume }: { config: BgmConfig; enabled: boolean; volume: number }) {
  const ref=useRef<HTMLAudioElement>(null)
  const playable=config.tracks.map(track=>({ ...track, url:getUrlByKey(track.storageKey) })).filter((track):track is typeof track & {url:string}=>!!track.url)
  const initial=config.mode==='random'&&playable.length>1?playable[Math.floor(Math.random()*playable.length)]:playable.find(track=>track.id===config.selectedId)??playable[0]
  const [trackId,setTrackId]=useState(initial?.id??'')
  const current=playable.find(track=>track.id===trackId)??initial
  useEffect(()=>{setTrackId(initial?.id??'')},[config.mode,config.selectedId,config.tracks.length])
  useEffect(()=>{
    const audio=ref.current
    if(audio){audio.muted=!enabled;audio.volume=volume/100}
    const play=()=>{if(enabled)ref.current?.play().catch(()=>{})}
    play()
    window.addEventListener('pointerdown',play,{once:true})
    window.addEventListener('keydown',play,{once:true})
    return()=>{window.removeEventListener('pointerdown',play);window.removeEventListener('keydown',play)}
  },[current?.url,enabled,volume])
  const next=()=>{if(config.mode!=='random'||playable.length<2)return;const choices=playable.filter(track=>track.id!==trackId);setTrackId(choices[Math.floor(Math.random()*choices.length)].id)}
  if(!current)return null
  return <audio ref={ref} src={current.url} data-audio-kind="music" autoPlay loop={config.mode==='selected'} preload="auto" onEnded={next} />
}

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
  const [cloudSynced, setCloudSynced] = useState(false)
  const [user,      setUser]      = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const { musicEnabled, soundEnabled, musicVolume, soundVolume } = usePlayerStore()
  const [bgmConfig,setBgmConfig]=useState(getBgmConfig)

  useEffect(()=>{syncBgmConfig().then(setBgmConfig);const update=(event:Event)=>setBgmConfig((event as CustomEvent<BgmConfig>).detail);window.addEventListener('chanceboard:bgm-change',update);return()=>window.removeEventListener('chanceboard:bgm-change',update)},[])

  useEffect(() => {
    const applyOne = (audio: HTMLAudioElement) => {
      const music = audio.dataset.audioKind === 'music'
      audio.muted = music ? !musicEnabled : !soundEnabled
      audio.volume = (music ? musicVolume : soundVolume) / 100
    }
    const apply = (root: ParentNode = document) => {
      if (root instanceof HTMLAudioElement) applyOne(root)
      root.querySelectorAll<HTMLAudioElement>('audio').forEach(applyOne)
    }
    apply()
    const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
      if (node instanceof HTMLElement) apply(node)
    })))
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [musicEnabled, soundEnabled, musicVolume, soundVolume])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    }).catch(error => console.error('[auth] session load failed', error))
      .finally(() => setAuthReady(true))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    initFromCloud().finally(() => {
      warmImageCache()
      setCloudSynced(true)
    })
    initDailyRewards().catch(error => console.warn('[dailyRewards] initialization failed', error))
  }, [])

  const { appPhase, mySide, isSolo, isAIBattle } = useGameStore()

  const [battleBgUrl, setBattleBgUrl] = useState<string | null>(null)
  useEffect(() => {
    if (appPhase === 'battle') {
      const urls = getAvailableBattleBgUrls()
      if (urls.length) setBattleBgUrl(urls[Math.floor(Math.random() * urls.length)])
    }
  }, [appPhase])

  const activeBgUrl = !showAdmin && appPhase !== 'battle' && appPhase !== 'end'
    ? getBgUrl('main') : null

  // ── Controllers ──────────────────────────────────────────────────────────────

  // Online: WebSocket room (no-op when isSolo)
  const { localPlayCard, localDiscardCard, localMoveUnit, localExecuteMove, localPass, localToggleAuto,
          sendCharSelect, sendDeckSelect } = useRoom(isSolo ? '' : onlineRoomId)

  // Solo: direct engine driver
  const { startSolo } = useSolo()

  // AI battle: both sides auto-controlled
  const { startAIBattle } = useAIBattle()

  // ── Routing helpers ───────────────────────────────────────────────────────────

  // Gate: something is active (online room, solo, or AI battle)
  const isActive = isSolo || isAIBattle || !!onlineRoomId

  // ── Lobby handlers ────────────────────────────────────────────────────────────

  const handleJoin = (id: string) => setOnlineRoomId(id)

  const handleRejoin = () => { if (saved) setOnlineRoomId(saved.roomId) }

  const handleAIBattleStart = () => startAIBattle()

  const handleAIReplay = () => {
    useGameStore.getState().resetForAIReplay()
    setTimeout(() => startAIBattle(), 0)
  }

  const handleSoloStart = () => {
    const store = useGameStore.getState()
    const player = usePlayerStore.getState()
    const defaultTeam = player.savedTeams.find(team => team.id === player.defaultTeamId)
    store.setSolo(true)
    store.setRoom('SOLO', 'A', true)
    store.setPlayerCount(2)   // skip "等待對手" in CharSelect
    if (defaultTeam) {
      const busyIds = getLogisticsBusyCharacterIds()
      store.loadTeam(defaultTeam.charIds.filter(id => !busyIds.includes(id)))
    }
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
    const { game, mySide: resultSide } = useGameStore.getState()
    if (game?.phase === 'end') {
      const won = !!game.winner && game.winner !== 'draw' && game.winner === resultSide
      usePlayerStore.getState().addExperience(won ? 200 : 120)
    }
    clearSession()
    setOnlineRoomId('')
    setBattleBgUrl(null)
    useGameStore.getState().resetToLobby()
  }

  const handleSoloReplay = () => {
    useGameStore.getState().resetForSoloReplay()
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (!authReady) return (
    <div className="app" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#44445a', fontSize: 13, letterSpacing: 2 }}>載入中…</div>
    </div>
  )

  if (!user) return <Login />

  return (
    <>
    <GlobalBgm config={bgmConfig} enabled={musicEnabled} volume={musicVolume}/>
    <RotatePrompt />
    {cloudSynced && <DailyCheckIn userId={user.id} />}
    <div className="app" style={activeBgUrl ? {
      backgroundImage: `url(${activeBgUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    } : undefined}>
      <Suspense fallback={<div className="route-loading">載入畫面中…</div>}>
      {/* 資料編輯器 */}
      {showAdmin && <Admin onBack={() => setShowAdmin(false)} />}

      {/* 大廳 */}
      {!showAdmin && !isActive && (
        <Lobby
          userId={user.id}
          onJoin={handleJoin}
          onSolo={handleSoloStart}
          onAIBattle={handleAIBattleStart}
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
        <CharSelect
          onConfirm={handleCharConfirm}
          onToggle={id => useGameStore.getState().toggleCharSelect(id)}
          onBack={handleEnd}
        />
      )}

      {/* 組牌 */}
      {!showAdmin && isActive && appPhase === 'deckBuild' && (
        <DeckBuild onConfirm={handleDeckConfirm} onBack={handleEnd} />
      )}

      {/* 戰鬥 */}
      {!showAdmin && isActive && (appPhase === 'battle' || appPhase === 'end') && (
        <BattleView
          onPlayCard={localPlayCard}
          onDiscardCard={localDiscardCard}
          onMoveUnit={localMoveUnit}
          onExecuteMove={(u, s, t) => localExecuteMove(u, s, t)}
          onPass={localPass}
          onToggleAuto={localToggleAuto}
          onEnd={handleEnd}
          onSoloReplay={isAIBattle ? handleAIReplay : handleSoloReplay}
          bgUrl={battleBgUrl}
        />
      )}

      {/* 房間標籤 (online only) */}
      {!showAdmin && !isSolo && onlineRoomId && appPhase !== 'lobby' && (
        <div className="room-badge">
          房間：<b>{onlineRoomId}</b>
          {mySide && <> &nbsp;|&nbsp; {mySide} 方</>}
        </div>
      )}

      {/* AI 對戰標籤 */}
      {!showAdmin && isAIBattle && (
        <div className="room-badge" style={{ color: '#9955ee' }}>🤖 AI 對戰</div>
      )}
      </Suspense>
    </div>
    </>
  )
}
