import { characters, moves, cards, deckWeights } from './db'
import type { Character } from '../types/character'
import type { Move } from '../types/move'
import type { Card } from '../types/card'
import type { DeckWeight } from '../types/piece'

export const CHAR_BY_ID: Record<string, Character> = Object.fromEntries(
  characters.map(c => [c.id, c])
)

export const MOVES_BY_OWNER: Record<string, Move[]> = moves.reduce<Record<string, Move[]>>(
  (acc, m) => {
    if (!acc[m.ownerId]) acc[m.ownerId] = []
    acc[m.ownerId].push(m)
    return acc
  },
  {}
)

export const CARD_BY_ID: Record<string, Card> = Object.fromEntries(
  cards.map(c => [c.id, c])
)

export const DECKW_BY_CARDID: Record<string, DeckWeight> = Object.fromEntries(
  deckWeights.map(d => [d.cardId, d])
)
