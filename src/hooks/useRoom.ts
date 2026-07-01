import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import type { PieceType } from '../types/piece'

const WS_HOST = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001'

export function useRoom(roomId: string) {
  const wsRef = useRef<WebSocket | null>(null)
  const store  = useGameStore()

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

      switch (msg.type) {
        case 'welcome': {
          store.setRoom(roomId, msg.side, msg.isHost)
          store.setPlayerCount(msg.playerCount)
          break
        }

        case 'playerJoined': {
          store.setPlayerCount(msg.playerCount)
          if (msg.playerCount === 2) {
            store.setAppPhase('charSelect')
          }
          break
        }

        case 'playerLeft': {
          store.setPlayerCount(Math.max(0, store.playerCount - 1))
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
          store.startBattle()
          store.startATBLoop((json, phase) => {
            send({ type: 'stateSync', stateJson: json, phase })
          })
          break
        }

        case 'stateSync': {
          if (!store.isHost) {
            store.applyRemoteState(msg.stateJson)
          }
          break
        }

        case 'action': {
          if (store.isHost) {
            applyRemoteAction(msg.action, store)
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
      store.stopATBLoop()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  const localPlayCard = (cardId: string) => {
    if (store.isHost) store.playCard(cardId)
    else send({ type: 'action', action: { type: 'playCard', side: store.mySide, cardId } })
  }

  const localMoveUnit = (unitId: string, toSlot: 1 | 2 | 3) => {
    if (store.isHost) store.moveUnit(unitId, toSlot)
    else send({ type: 'action', action: { type: 'moveUnit', unitId, toSlot } })
  }

  const localExecuteMove = (unitId: string, moveSlot: string, targetId: string | null) => {
    if (store.isHost) store.executeMove(unitId, moveSlot as any, targetId)
    else send({ type: 'action', action: { type: 'executeMove', unitId, moveSlot, targetId } })
  }

  const localPass = (unitId: string) => {
    if (store.isHost) store.pass(unitId)
    else send({ type: 'action', action: { type: 'pass', unitId } })
  }

  const sendCharSelect = (charIds: string[]) => send({ type: 'charSelect', charIds })
  const sendPieceSelect = (piece: PieceType) => send({ type: 'pieceSelect', piece })
  const sendReady = () => send({ type: 'ready' })

  return { localPlayCard, localMoveUnit, localExecuteMove, localPass, sendCharSelect, sendPieceSelect, sendReady }
}

function applyRemoteAction(action: any, store: ReturnType<typeof useGameStore.getState>) {
  switch (action.type) {
    case 'playCard':    store.playCard(action.cardId); break
    case 'moveUnit':    store.moveUnit(action.unitId, action.toSlot); break
    case 'executeMove': store.executeMove(action.unitId, action.moveSlot, action.targetId); break
    case 'pass':        store.pass(action.unitId); break
  }
}
