export type PieceType = 'pawn' | 'knight' | 'castle' | 'bishop' | 'queen' | 'king'

export interface DeckWeight {
  cardId: string
  cardName: string
  weightsByPiece: Record<PieceType, number | null>
}
