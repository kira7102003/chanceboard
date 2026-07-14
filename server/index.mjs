import { WebSocketServer } from 'ws'

const PORT = process.env.PORT ?? 3001
const wss  = new WebSocketServer({ port: Number(PORT) })

const PIECES = ['pawn', 'knight', 'castle', 'bishop', 'queen', 'king']
const SIDES = ['A', 'B']
const ACTIONS = ['playCard', 'discardCard', 'moveUnit', 'executeMove', 'pass', 'toggleAuto']
const text = (v, max = 100) => typeof v === 'string' && v.length > 0 && v.length <= max
const strings = (v, max) => Array.isArray(v) && v.length <= max && v.every(x => text(x, 80))
function validMessage(msg) {
  if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return false
  if (msg.type === 'join') return text(msg.roomId, 12) && (msg.rejoinSide === undefined || SIDES.includes(msg.rejoinSide))
  if (msg.type === 'charSelect') return strings(msg.charIds, 3)
  if (msg.type === 'deckSelect') return strings(msg.deckIds, 10)
  if (msg.type === 'stateSync') return text(msg.stateJson, 1_000_000)
  if (msg.type === 'action') {
    const a = msg.action
    if (!a || !ACTIONS.includes(a.type)) return false
    if (a.type === 'playCard' || a.type === 'discardCard') return SIDES.includes(a.side) && text(a.cardId)
    if (a.type === 'moveUnit') return text(a.unitId) && [1, 2, 3].includes(a.toSlot)
    if (a.type === 'executeMove') return text(a.unitId) && ['劍', '槍', '法', '願', '被'].includes(a.moveSlot) && (a.targetId === null || text(a.targetId))
    if (a.type === 'pass') return text(a.unitId)
    return a.type === 'toggleAuto' && SIDES.includes(a.side)
  }
  return false
}

// rooms: Map<roomId, { players: Map<connId, player>, lastState, piece, deckA, deckB }>
const rooms = new Map()
let _id = 0

function getRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, { players: new Map(), lastState: null, piece: null, deckA: null, deckB: null })
  return rooms.get(roomId)
}

wss.on('connection', ws => {
  const connId = String(++_id)
  let roomId = null

  ws.on('message', raw => {
    if (raw.length > 1_000_000) return
    let msg
    try { msg = JSON.parse(raw) } catch { return }
    if (!validMessage(msg)) {
      ws.send(JSON.stringify({ type: 'error', msg: '無效的連線訊息' }))
      return
    }

    if (msg.type === 'join') {
      roomId = msg.roomId
      const room = getRoom(roomId)

      // Determine side: try requested rejoinSide first, else auto-assign
      let side
      const taken = new Set([...room.players.values()].map(p => p.side))
      if (msg.rejoinSide && !taken.has(msg.rejoinSide)) {
        side = msg.rejoinSide
      } else if (!taken.has('A')) {
        side = 'A'
      } else if (!taken.has('B')) {
        side = 'B'
      } else {
        ws.send(JSON.stringify({ type: 'error', msg: '房間已滿' }))
        return
      }

      const isHost = side === 'A'
      room.players.set(connId, { ws, side, charIds: null, deckIds: null })

      ws.send(JSON.stringify({
        type: 'welcome',
        side,
        isHost,
        playerCount: room.players.size,
        isRejoin: !!msg.rejoinSide,
      }))

      broadcast(room, connId, { type: 'playerJoined', side, playerCount: room.players.size })

      // Send cached game state if exists (for reconnection mid-game)
      if (room.lastState) {
        ws.send(JSON.stringify({ type: 'stateSync', stateJson: room.lastState }))
      }

      // Send opponent's cached selections to newcomer
      for (const [, p] of room.players) {
        if (p.side !== side) {
          if (p.charIds) ws.send(JSON.stringify({ type: 'charSelect', charIds: p.charIds }))
          break
        }
      }

      // If 2 players and game already in progress, tell both to resume
      if (room.lastState && room.players.size === 2) {
        broadcastAll(room, { type: 'resumeGame' })
      }
      return
    }

    if (!roomId || !rooms.has(roomId)) return
    const room = rooms.get(roomId)
    const self = room.players.get(connId)

    if (msg.type === 'charSelect' && self) {
      self.charIds = msg.charIds
      broadcast(room, connId, msg)  // relay to opponent
      return
    }

    if (msg.type === 'deckSelect' && self) {
      self.deckIds = msg.deckIds
      const all = [...room.players.values()]
      console.log(`[deckSelect] room=${roomId} side=${self.side} decks ready: ${all.filter(p=>p.deckIds).length}/${all.length}`)
      if (all.length === 2 && all.every(p => p.deckIds)) {
        const piece = PIECES[Math.floor(Math.random() * PIECES.length)]
        const deckA = all.find(p => p.side === 'A')?.deckIds ?? []
        const deckB = all.find(p => p.side === 'B')?.deckIds ?? []
        room.piece = piece
        room.deckA = deckA
        room.deckB = deckB
        console.log(`[startBattle] room=${roomId} piece=${piece}`)
        broadcastAll(room, { type: 'startBattle', piece, deckA, deckB })
      }
      return
    }

    if (msg.type === 'stateSync' && self?.side === 'A') {
      room.lastState = msg.stateJson
      broadcast(room, connId, msg)  // relay to guest only
      return
    }

    if (msg.type === 'action' && self) {
      const action = msg.action
      if ('side' in action && action.side !== self.side) return
      if ('unitId' in action && !action.unitId.startsWith(`${self.side}-`)) return
      broadcast(room, connId, msg)
    }
  })

  ws.on('close', () => {
    if (!roomId || !rooms.has(roomId)) return
    const room = rooms.get(roomId)
    room.players.delete(connId)
    broadcastAll(room, { type: 'playerLeft', connId })
    // Keep room alive for 10 minutes to allow reconnection
    if (room.players.size === 0) {
      setTimeout(() => {
        if (rooms.has(roomId) && rooms.get(roomId).players.size === 0) {
          rooms.delete(roomId)
        }
      }, 10 * 60 * 1000)
    }
  })

  const ping = setInterval(() => {
    if (ws.readyState === 1) ws.ping()
  }, 20000)
  ws.on('close', () => clearInterval(ping))
})

function broadcast(room, excludeId, msg) {
  const str = JSON.stringify(msg)
  for (const [id, p] of room.players) {
    if (id !== excludeId && p.ws.readyState === 1) p.ws.send(str)
  }
}
function broadcastAll(room, msg) {
  const str = JSON.stringify(msg)
  for (const [, p] of room.players) {
    if (p.ws.readyState === 1) p.ws.send(str)
  }
}

console.log(`🎴 Chanceboard WS server on :${PORT}`)
