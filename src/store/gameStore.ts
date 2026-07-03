import { create } from 'zustand'
import type { GameState } from '../types/game'
import type { MoveSlot } from '../types/move'
import type { PieceType } from '../types/piece'

const ALL_PIECES: PieceType[] = ['pawn', 'knight', 'castle', 'bishop', 'queen', 'king']
function randomPiece(): PieceType { return ALL_PIECES[Math.floor(Math.random() * ALL_PIECES.length)] }
import type { ScoreResult } from '../types/score'
import {
  initBattleState, tickATB, doPlayCard, doMoveUnit,
  doExecuteMove, doPass, doToggleAuto, autoPlayUnit, getReadyUnits,
} from '../engine/atb'
import { calcScore } from '../engine/score'

export type AppPhase = 'lobby' | 'charSelect' | 'deckBuild' | 'battle' | 'end'

interface Store {
  appPhase: AppPhase
  mySide: 'A' | 'B' | null
  isHost: boolean
  roomId: string
  playerCount: number
  isSolo:     boolean
  isAIBattle: boolean
  soloScore:  ScoreResult | null

  selectedCharIds: string[]
  opponentCharIds: string[]
  selectedPiece: PieceType | null
  opponentPiece: PieceType | null
  myDeckIds: string[]
  opponentDeckIds: string[]

  game: GameState | null
  pendingUnitId: string | null    // unit the local player is currently deciding for
  intervalId: ReturnType<typeof setInterval> | null

  // Actions
  setRoom: (roomId: string, side: 'A' | 'B', isHost: boolean) => void
  setPlayerCount: (n: number) => void
  setAppPhase: (p: AppPhase) => void
  setSolo:     (v: boolean) => void
  setAIBattle: (v: boolean) => void
  setScore:    (r: ScoreResult | null) => void

  toggleCharSelect: (id: string) => void
  confirmCharSelect: () => void
  setOpponentChars: (ids: string[]) => void

  selectPiece: (p: PieceType) => void
  setOpponentPiece: (p: PieceType) => void
  setMyDeck: (ids: string[]) => void
  setOpponentDeck: (ids: string[]) => void

  startBattle: () => void
  applyRemoteState: (json: string) => void

  tick: () => void
  startATBLoop: (onSync: (json: string, phase: AppPhase) => void) => void
  stopATBLoop: () => void

  playCard: (cardId: string, side?: 'A' | 'B') => void
  moveUnit: (unitId: string, toSlot: 1 | 2 | 3) => void
  executeMove: (unitId: string, moveSlot: MoveSlot, targetId: string | null) => void
  pass: (unitId: string) => void
  toggleAuto: (side: 'A' | 'B') => void

  _syncCb: ((json: string, phase: AppPhase) => void) | null
  _applyGame: (g: GameState) => void
}

export const useGameStore = create<Store>((set, get) => ({
  appPhase: 'lobby',
  mySide: null,
  isHost: false,
  roomId: '',
  playerCount: 0,
  isSolo:     false,
  isAIBattle: false,
  soloScore:  null,

  selectedCharIds: [],
  opponentCharIds: [],
  selectedPiece: null,
  opponentPiece: null,
  myDeckIds: [],
  opponentDeckIds: [],

  game: null,
  pendingUnitId: null,
  intervalId: null,
  _syncCb: null,

  setRoom: (roomId, side, isHost) => set({ roomId, mySide: side, isHost }),
  setPlayerCount: n => set({ playerCount: n }),
  setAppPhase: p => set({ appPhase: p }),
  setSolo:     v => set({ isSolo: v }),
  setAIBattle: v => set({ isAIBattle: v }),
  setScore:    r => set({ soloScore: r }),

  toggleCharSelect: (id) => {
    const cur = get().selectedCharIds
    if (cur.includes(id)) set({ selectedCharIds: cur.filter(x => x !== id) })
    else if (cur.length < 3) set({ selectedCharIds: [...cur, id] })
  },
  confirmCharSelect: () => {
    set({ appPhase: 'deckBuild' })
  },
  setOpponentChars: (ids) => set({ opponentCharIds: ids }),

  selectPiece: (p) => { set({ selectedPiece: p }) },
  setOpponentPiece: (p) => set({ opponentPiece: p }),
  setMyDeck: (ids) => set({ myDeckIds: ids }),
  setOpponentDeck: (ids) => set({ opponentDeckIds: ids }),

  startBattle: () => {
    const { selectedCharIds, opponentCharIds, mySide, myDeckIds, opponentDeckIds } = get()
    const piece = randomPiece()   // SA doc: random at battle start, not player-chosen
    const charA = mySide === 'A' ? selectedCharIds : opponentCharIds
    const charB = mySide === 'A' ? opponentCharIds : selectedCharIds
    const deckAIds = mySide === 'A' ? myDeckIds : opponentDeckIds
    const deckBIds = mySide === 'A' ? opponentDeckIds : myDeckIds
    console.log('[startBattle] charA:', charA, 'charB:', charB, 'piece:', piece, 'mySide:', mySide)
    let init: ReturnType<typeof initBattleState>
    try {
      init = initBattleState(charA, charB, piece, deckAIds, deckBIds)
    } catch (err) {
      console.error('[startBattle] initBattleState THREW:', err)
      return
    }
    const gs: GameState = {
      phase: 'act',
      selectedIds: [],
      selectedPiece: piece,
      deckDraft: [],
      customDeck: [],
      customDeckOrder: [],
      customDeckB: [],
      customDeckOrderB: [],
      teamA: [],
      teamB: [],
      drawPublic: [],
      discardPublic: [],
      handA: [],
      handB: [],
      handCustomA: [],
      handCustomB: [],
      lastDiscardedA: null,
      lastDiscardedB: null,
      clock: 0,
      dealtRound: 0,
      round: 1,
      actingUnitId: null,
      actPending: { cardId: null, moveSlot: null },
      log: [],
      winner: null,
      winnerReason: null,
      autoBattleA: false,
      autoBattleB: false,
      ...init,
    }
    set({ game: gs, appPhase: 'battle' })
  },

  applyRemoteState: (json) => {
    try {
      const g = JSON.parse(json) as GameState
      set({ game: g, appPhase: g.phase === 'end' ? 'end' : 'battle' })
    } catch { /* ignore */ }
  },

  _applyGame: (g) => {
    const { _syncCb, isSolo, soloScore, mySide } = get()
    const appPhase = g.phase === 'end' ? 'end' : 'battle'
    const updates: Partial<Store> = { game: g, appPhase }
    // Compute score once when solo battle ends
    if (g.phase === 'end' && isSolo && !soloScore && mySide) {
      updates.soloScore = calcScore(g, mySide)
    }
    set(updates)
    if (_syncCb) _syncCb(JSON.stringify(g), appPhase)
  },

  tick: () => {
    const { game, isHost } = get()
    if (!game || !isHost || game.phase === 'end') return
    // SA doc 7.1: 任何一方有 ready 單位且未開啟自動時，整個暫停等待該方輸入
    const readyNow = getReadyUnits(game)
    const aPending = !game.autoBattleA && readyNow.some(u => u.side === 'A')
    const bPending = !game.autoBattleB && readyNow.some(u => u.side === 'B')
    if (aPending || bPending) return
    let next = tickATB(game)
    // Auto-play ready units for sides that have auto enabled
    const ready = getReadyUnits(next)
    for (const unit of ready) {
      if ((unit.side === 'A' && next.autoBattleA) || (unit.side === 'B' && next.autoBattleB)) {
        next = autoPlayUnit(next, unit)
        if (next.phase === 'end') break
      }
    }
    get()._applyGame(next)
  },

  startATBLoop: (onSync) => {
    const { isHost, intervalId } = get()
    if (intervalId) clearInterval(intervalId)
    set({ _syncCb: onSync })
    if (!isHost) return
    const id = setInterval(() => { get().tick() }, 100)
    set({ intervalId: id })
  },

  stopATBLoop: () => {
    const { intervalId } = get()
    if (intervalId) clearInterval(intervalId)
    set({ intervalId: null })
  },

  playCard: (cardId, side?) => {
    const { game, mySide } = get()
    if (!game) return
    const effectiveSide = side ?? mySide
    if (!effectiveSide) return
    const next = doPlayCard(game, effectiveSide, cardId)
    get()._applyGame(next)
  },

  moveUnit: (unitId, toSlot) => {
    const { game } = get()
    if (!game) return
    const next = doMoveUnit(game, unitId, toSlot)
    get()._applyGame(next)
  },

  executeMove: (unitId, moveSlot, targetId) => {
    const { game } = get()
    if (!game) return
    const next = doExecuteMove(game, { unitId, moveSlot, targetId, cardId: null })
    get()._applyGame(next)
  },

  pass: (unitId) => {
    const { game } = get()
    if (!game) return
    const next = doPass(game, unitId)
    get()._applyGame(next)
  },

  toggleAuto: (side) => {
    const { game } = get()
    if (!game) return
    const next = doToggleAuto(game, side)
    get()._applyGame(next)
  },
}))
