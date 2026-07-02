import { cards as allCards } from '../data/db'

const DECK_SIZE = 10

export function randomDeck(): string[] {
  return fillDeck([])
}

export function fillDeck(existing: string[]): string[] {
  const deck = [...existing]
  const pool = [...allCards, ...allCards].sort(() => Math.random() - 0.5)
  for (const c of pool) {
    if (deck.length >= DECK_SIZE) break
    if (deck.filter(x => x === c.id).length < 2) deck.push(c.id)
  }
  return deck
}
