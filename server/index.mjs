import { WebSocketServer } from 'ws'

const PORT = process.env.PORT ?? 3001
const wss  = new WebSocketServer({ port: Number(PORT) })

// rooms: Map<roomId, Map<connId, { ws, side, ready, piece, charIds }>>
const rooms = new Map()
let _id = 0

wss.on('connection', ws => {
  const connId = String(++_id)
  let roomId = null

  ws.on('message', raw => {
    let msg
    try { msg = JSON.parse(raw) } catch { return }

    if (msg.type === 'join') {
      roomId = msg.roomId
      if (!rooms.has(roomId)) rooms.set(roomId, new Map())
      const room = rooms.get(roomId)
      if (room.size >= 2) { ws.send(JSON.stringify({ type: 'error', msg: '房間已滿' })); return }

      const isHost = room.size === 0
      const side   = isHost ? 'A' : 'B'
      room.set(connId, { ws, side, ready: false, piece: null, charIds: null })

      ws.send(JSON.stringify({ type: 'welcome', side, isHost, playerCount: room.size }))
      broadcast(room, connId, { type: 'playerJoined', side, playerCount: room.size })

      // If guest joining, send host's cached selections immediately
      if (!isHost) {
        for (const [, p] of room) {
          if (p.side === 'A') {
            if (p.charIds) ws.send(JSON.stringify({ type: 'charSelect', charIds: p.charIds }))
            if (p.piece)   ws.send(JSON.stringify({ type: 'pieceSelect', piece: p.piece }))
            break
          }
        }
      }
      return
    }

    if (!roomId || !rooms.has(roomId)) return
    const room = rooms.get(roomId)
    const self = room.get(connId)

    // Cache selections
    if (msg.type === 'charSelect' && self)  { self.charIds = msg.charIds }
    if (msg.type === 'pieceSelect' && self) { self.piece   = msg.piece   }

    if (msg.type === 'ready') {
      if (self) self.ready = true
      broadcastAll(room, msg)
      const all = [...room.values()]
      if (all.length === 2 && all.every(p => p.ready)) {
        const hostPiece = all.find(p => p.side === 'A')?.piece ?? 'pawn'
        broadcastAll(room, { type: 'startBattle', hostPiece })
      }
      return
    }

    // relay all other messages to peers
    broadcast(room, connId, msg)
  })

  ws.on('close', () => {
    if (!roomId || !rooms.has(roomId)) return
    const room = rooms.get(roomId)
    room.delete(connId)
    broadcastAll(room, { type: 'playerLeft', connId })
    if (room.size === 0) rooms.delete(roomId)
  })

  // Keep-alive ping every 20s to prevent Render free tier sleep
  const ping = setInterval(() => {
    if (ws.readyState === 1) ws.ping()
  }, 20000)
  ws.on('close', () => clearInterval(ping))
})

function broadcast(room, excludeId, msg) {
  const str = JSON.stringify(msg)
  for (const [id, p] of room) {
    if (id !== excludeId && p.ws.readyState === 1) p.ws.send(str)
  }
}
function broadcastAll(room, msg) {
  const str = JSON.stringify(msg)
  for (const [, p] of room) {
    if (p.ws.readyState === 1) p.ws.send(str)
  }
}

console.log(`🎴 Chanceboard WS server on :${PORT}`)
