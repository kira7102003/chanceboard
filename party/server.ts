import type * as Party from 'partykit/server'
import { parseClientMessage } from '../src/shared/protocol'
import type { AppPhase } from '../src/store/gameStore'
import type { PieceType } from '../src/types/piece'

type Side = 'A' | 'B'
type RoomPhase = AppPhase
const PIECES: PieceType[] = ['pawn', 'knight', 'castle', 'bishop', 'queen', 'king']

interface PlayerInfo {
  id: string
  side: Side
  ready: boolean
  charIds: string[] | null
  deckIds: string[] | null
}

interface RoomState {
  phase: RoomPhase
  players: PlayerInfo[]
  hostId: string | null
  lastStateJson: string | null
}

export default class ChanceboardRoom implements Party.Server {
  private room_state: RoomState = {
    phase: 'lobby',
    players: [],
    hostId: null,
    lastStateJson: null,
  }

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    const rs = this.room_state
    if (rs.players.length >= 2) {
      conn.send(JSON.stringify({ type: 'error', msg: '房間已滿' }))
      return
    }

    const taken = new Set(rs.players.map(player => player.side))
    const side: Side = !taken.has('A') ? 'A' : 'B'
    const isHost = side === 'A'
    if (isHost) rs.hostId = conn.id

    rs.players.push({ id: conn.id, side, ready: false, charIds: null, deckIds: null })

    conn.send(JSON.stringify({
      type: 'welcome',
      side,
      isHost,
      phase: rs.phase,
      playerCount: rs.players.length,
    }))

    // If reconnecting to active game, send last known state
    if (rs.lastStateJson) {
      conn.send(JSON.stringify({ type: 'stateSync', stateJson: rs.lastStateJson }))
    }

    this.broadcast({ type: 'playerJoined', side, playerCount: rs.players.length }, conn.id)
  }

  onMessage(raw: string | ArrayBuffer, sender: Party.Connection) {
    if (typeof raw !== 'string' || raw.length > 1_000_000) return
    let decoded: unknown
    try { decoded = JSON.parse(raw) } catch { return }
    const msg = parseClientMessage(decoded)
    if (!msg) {
      sender.send(JSON.stringify({ type: 'error', msg: '無效的連線訊息' }))
      return
    }
    const rs = this.room_state
    const player = rs.players.find(p => p.id === sender.id)

    switch (msg.type) {
      case 'join': break
      case 'charSelect': {
        if (player) player.charIds = msg.charIds
        this.broadcast(msg, sender.id)
        break
      }
      case 'deckSelect': {
        if (!player) break
        player.deckIds = msg.deckIds
        if (rs.players.length === 2 && rs.players.every(p => p.deckIds)) {
          const piece = PIECES[Math.floor(Math.random() * PIECES.length)]
          const deckA = rs.players.find(p => p.side === 'A')?.deckIds ?? []
          const deckB = rs.players.find(p => p.side === 'B')?.deckIds ?? []
          rs.phase = 'battle'
          this.room.broadcast(JSON.stringify({ type: 'startBattle', piece, deckA, deckB }))
        }
        break
      }

      case 'action': {
        if (!player) break
        const action = msg.action
        if ('side' in action && action.side !== player.side) break
        if ('unitId' in action && !action.unitId.startsWith(`${player.side}-`)) break
        // relay opponent's action to host; relay host's broadcast to guest
        this.room.broadcast(JSON.stringify(msg), [sender.id])
        break
      }

      case 'stateSync': {
        // host broadcasts full game state; cache it and relay to guest
        if (sender.id === rs.hostId) {
          rs.lastStateJson = msg.stateJson
          rs.phase = msg.phase ?? rs.phase
          this.room.broadcast(JSON.stringify(msg), [sender.id])
        }
        break
      }

    }
  }

  onClose(conn: Party.Connection) {
    this.room_state.players = this.room_state.players.filter(p => p.id !== conn.id)
    this.broadcast({ type: 'playerLeft', connId: conn.id })
  }

  private broadcast(msg: object, excludeId?: string) {
    const str = JSON.stringify(msg)
    if (excludeId) {
      this.room.broadcast(str, [excludeId])
    } else {
      this.room.broadcast(str)
    }
  }
}

ChanceboardRoom satisfies Party.Worker
