import type * as Party from 'partykit/server'

type Side = 'A' | 'B'
type RoomPhase = 'lobby' | 'charSelect' | 'pieceSelect' | 'battle' | 'end'

interface PlayerInfo {
  id: string
  side: Side
  ready: boolean
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

    const side: Side = rs.players.length === 0 ? 'A' : 'B'
    const isHost = rs.players.length === 0
    if (isHost) rs.hostId = conn.id

    rs.players.push({ id: conn.id, side, ready: false })

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
    const msg = JSON.parse(raw as string)
    const rs = this.room_state

    switch (msg.type) {
      case 'charSelect':
      case 'pieceSelect': {
        this.broadcast(msg, sender.id)
        break
      }

      case 'ready': {
        const p = rs.players.find(p => p.id === sender.id)
        if (p) p.ready = true
        this.room.broadcast(JSON.stringify(msg))

        const allReady = rs.players.length === 2 && rs.players.every(p => p.ready)
        if (allReady && rs.phase === 'lobby') {
          rs.phase = 'charSelect'
          this.room.broadcast(JSON.stringify({ type: 'phaseChange', phase: 'charSelect' }))
        }
        break
      }

      case 'action': {
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

      case 'phaseChange': {
        rs.phase = msg.phase
        this.room.broadcast(JSON.stringify(msg), [sender.id])
        break
      }

      default:
        this.room.broadcast(JSON.stringify(msg), [sender.id])
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
