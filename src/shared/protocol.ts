import type { AppPhase } from '../store/gameStore'
import type { MoveSlot } from '../types/move'
import type { PieceType } from '../types/piece'

export type Side = 'A' | 'B'
export type RemoteAction =
  | { type: 'playCard' | 'discardCard'; side: Side; cardId: string }
  | { type: 'moveUnit'; unitId: string; toSlot: 1 | 2 | 3 }
  | { type: 'executeMove'; unitId: string; moveSlot: MoveSlot; targetId: string | null }
  | { type: 'pass'; unitId: string }
  | { type: 'toggleAuto'; side: Side }

export type ClientMessage =
  | { type: 'join'; roomId: string; rejoinSide?: Side }
  | { type: 'charSelect'; charIds: string[] }
  | { type: 'deckSelect'; deckIds: string[] }
  | { type: 'stateSync'; stateJson: string; phase?: AppPhase }
  | { type: 'action'; action: RemoteAction }

export type ServerMessage =
  | { type: 'welcome'; side: Side; isHost: boolean; playerCount: number }
  | { type: 'playerJoined'; side: Side; playerCount: number }
  | { type: 'playerLeft'; connId: string }
  | { type: 'resumeGame' }
  | { type: 'phaseChange'; phase: AppPhase }
  | { type: 'charSelect'; charIds: string[] }
  | { type: 'startBattle'; piece: PieceType; deckA: string[]; deckB: string[] }
  | { type: 'stateSync'; stateJson: string }
  | { type: 'action'; action: RemoteAction }
  | { type: 'error'; msg: string }

const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const side = (v: unknown): v is Side => v === 'A' || v === 'B'
const strings = (v: unknown, max: number): v is string[] => Array.isArray(v) && v.length <= max && v.every(x => typeof x === 'string' && x.length <= 80)
const text = (v: unknown, max = 100): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const phases: AppPhase[] = ['lobby', 'charSelect', 'deckBuild', 'battle', 'end']
const pieces: PieceType[] = ['pawn', 'knight', 'castle', 'bishop', 'queen', 'king']
const slots: MoveSlot[] = ['劍', '槍', '法', '願', '被']

export function isRemoteAction(v: unknown): v is RemoteAction {
  if (!object(v) || typeof v.type !== 'string') return false
  if (v.type === 'playCard' || v.type === 'discardCard') return side(v.side) && text(v.cardId)
  if (v.type === 'moveUnit') return text(v.unitId) && (v.toSlot === 1 || v.toSlot === 2 || v.toSlot === 3)
  if (v.type === 'executeMove') return text(v.unitId) && slots.includes(v.moveSlot as MoveSlot) && (v.targetId === null || text(v.targetId))
  if (v.type === 'pass') return text(v.unitId)
  if (v.type === 'toggleAuto') return side(v.side)
  return false
}

export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (!object(raw) || typeof raw.type !== 'string') return null
  if (raw.type === 'join' && text(raw.roomId, 12) && (raw.rejoinSide === undefined || side(raw.rejoinSide))) return raw as ClientMessage
  if (raw.type === 'charSelect' && strings(raw.charIds, 3)) return raw as ClientMessage
  if (raw.type === 'deckSelect' && strings(raw.deckIds, 10)) return raw as ClientMessage
  if (raw.type === 'stateSync' && text(raw.stateJson, 1_000_000) && (raw.phase === undefined || phases.includes(raw.phase as AppPhase))) return raw as ClientMessage
  if (raw.type === 'action' && isRemoteAction(raw.action)) return raw as ClientMessage
  return null
}

export function parseServerMessage(raw: unknown): ServerMessage | null {
  if (!object(raw) || typeof raw.type !== 'string') return null
  switch (raw.type) {
    case 'welcome': return side(raw.side) && typeof raw.isHost === 'boolean' && typeof raw.playerCount === 'number' ? raw as ServerMessage : null
    case 'playerJoined': return side(raw.side) && typeof raw.playerCount === 'number' ? raw as ServerMessage : null
    case 'playerLeft': return text(raw.connId) ? raw as ServerMessage : null
    case 'resumeGame': return raw as ServerMessage
    case 'phaseChange': return phases.includes(raw.phase as AppPhase) ? raw as ServerMessage : null
    case 'charSelect': return strings(raw.charIds, 3) ? raw as ServerMessage : null
    case 'startBattle': return pieces.includes(raw.piece as PieceType) && strings(raw.deckA, 10) && strings(raw.deckB, 10) ? raw as ServerMessage : null
    case 'stateSync': return text(raw.stateJson, 1_000_000) ? raw as ServerMessage : null
    case 'action': return isRemoteAction(raw.action) ? raw as ServerMessage : null
    case 'error': return text(raw.msg, 300) ? raw as ServerMessage : null
    default: return null
  }
}
