import type { Unit } from './unit'
import type { Card } from './card'
import type { MoveSlot } from './move'
import type { PieceType } from './piece'

export type Phase = 'select' | 'deckbuild' | 'act' | 'end'

export interface BattleLogEntry {
  type?: string
  html: string
  /** Number of suit cards actually paid for this move. */
  cardsSpent?: number
  moveAnim?: { moveId: string; moveName: string; moveSlot: string; charName: string; charId?: string; attackerSide?: 'A' | 'B'; targetSide?: 'A' | 'B'; targetName?: string; targetCharId?: string; targetUnitId?: string; groupTargets?: Array<{ name: string; charId?: string }>; dealsDamage?: boolean; hasTarget?: boolean; selfTargetOnly?: boolean; missed?: boolean }
}

export interface GameState {
  phase: Phase
  selectedIds: string[]
  selectedPiece: PieceType | null
  deckDraft: Card[]
  customDeck: Card[]
  customDeckOrder: Card[]
  customDeckB: Card[]
  customDeckOrderB: Card[]
  teamA: Unit[]
  teamB: Unit[]
  drawPublic: Card[]
  discardPublic: Card[]
  handA: Card[]
  handB: Card[]
  handCustomA: Card[]
  handCustomB: Card[]
  lastDiscardedA: Card | null
  lastDiscardedB: Card | null
  clock: number
  dealtRound: number
  round: number
  actingUnitId: string | null
  actPending: { cardId: string | null; moveSlot: MoveSlot | null }
  flowerActionUsed: Partial<Record<'A' | 'B', string>>
  discardActionUsed: Partial<Record<'A' | 'B', string>>
  log: BattleLogEntry[]
  winner: 'A' | 'B' | 'draw' | null
  winnerReason: string | null
  autoBattleA: boolean
  autoBattleB: boolean
}
