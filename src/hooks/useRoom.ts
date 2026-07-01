import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import type { PieceType } from '../types/piece'

const WS_HOST = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001'

export function useRoom(roomId: string) {
  const wsRef = useRef<WebSocket | null>(null)

  // Always read fresh state — never capture store in closure
  const gs = () => useGameStore.getState()

  const send = (msg: object) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }

  useEffect(() => {
    if (!roomId) return

    const ws = new WebSocket(WS_HOST)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', roomId }))
    }

    ws.onmessage = (e: MessageEvent) => {
      let msg: any
      try { msg = JSON.parse(e.data) } catch { return }

      // Get fresh store state on every message
      const store = gs()

      switch (msg.type) {
        case 'welcome': {
          store.setRoom(roomId, msg.side, msg.isHost)
          store.setPlayerCount(msg.playerCount)
          if (msg.playerCount >= 2) {
            store.setAppPhase('charSelect')
          }
          break
        }

        case 'playerJoined': {
          store.setPlayerCount(msg.playerCount)
          if (msg.playerCount >= 2) {
            store.setAppPhase('charSelect')
          }
          break
        }

        case 'playerLeft': {
          store.setPlayerCount(Math.max(0, gs().playerCount - 1))
          break
        }

        case 'phaseChange': {
          store.setAppPhase(msg.phase)
          break
        }

        case 'charSelect': {
          store.setOpponentChars(msg.charIds)
          break
        }

        case 'pieceSelect': {
          store.setOpponentPiece(msg.piece as PieceType)
          break
        }

        case 'startBattle': {
          if (msg.hostPiece) {
            // Fresh read to get correct isHost
            const fresh = gs()
            if (fresh.isHost) fresh.selectPiece(msg.hostPiece)
            else              fresh.setOpponentPiece(msg.hostPiece)
          }
          gs().startBattle()

          // Fresh read again after startBattle mutated state
          if (gs().isHost) {
            gs().startATBLoop((json, phase) => {
              send({ type: 'stateSync', stateJson: json, phase })
            })
          }
          break
        }

        case 'stateSync': {
          if (!gs().isHost) {
            gs().applyRemoteState(msg.stateJson)
          }
          break
        }

        case 'action': {
          if (gs().isHost) {
            applyRemoteAction(msg.action)
          }
          break
        }

        case 'error': {
          alert(msg.msg)
          break
        }
      }
    }

    ws.onerror = () => console.error('WebSocket error')

    return () => {
      ws.close()
      wsRef.current = null
      gs().stopATBLoop()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  const localPlayCard = (cardId: string) => {
    if (gs().isHost) gs().playCard(cardId)
    else send({ type: 'action', action: { type: 'playCard', side: gs().mySide, cardId } })
  }

  const localMoveUnit = (unitId: string, toSlot: 1 | 2 | 3) => {
    if (gs().isHost) gs().moveUnit(unitId, toSlot)
    else send({ type: 'action', action: { type: 'moveUnit', unitId, toSlot } })
  }

  const localExecuteMove = (unitId: string, moveSlot: string, targetId: string | null) => {
    if (gs().isHost) gs().executeMove(unitId, moveSlot as any, targetId)
    else send({ type: 'action', action: { type: 'executeMove', unitId, moveSlot, targetId } })
  }

  const localPass = (unitId: string) => {
    if (gs().isHost) gs().pass(unitId)
    else send({ type: 'action', action: { type: 'pass', unitId } })
  }

  const sendCharSelect  = (charIds: string[])  => send({ type: 'charSelect', charIds })
  const sendPieceSelect = (piece: PieceType)    => send({ type: 'pieceSelect', piece })
  const sendReady       = ()                    => send({ type: 'ready' })

  return { localPlayCard, localMoveUnit, localExecuteMove, localPass, sendCharSelect, sendPieceSelect, sendReady }
}

function applyRemoteAction(action: any) {
  const store = useGameStore.getState()
  switch (action.type) {
    case 'playCard':    store.playCard(action.cardId); break
    case 'moveUnit':    store.moveUnit(action.unitId, action.toSlot); break
    case 'executeMove': store.executeMove(action.unitId, action.moveSlot, action.targetId); break
    case 'pass':        store.pass(action.unitId); break
  }
}
