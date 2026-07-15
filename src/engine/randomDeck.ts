import { cards as allCards } from '../data/db'
import { shuffled } from '../utils/random'

const DECK_SIZE = 10

export function randomDeck(inventory?: Record<string, number>): string[] {
  return fillDeck([], inventory)
}

export function fillDeck(existing: string[], inventory?: Record<string, number>): string[] {
  const deck = [...existing]
  const pool: string[] = []

  // Every card participates equally, with at most two copies in a generated deck.
  for (const card of allCards) {
    const owned = inventory ? Math.max(0, inventory[card.id] ?? 0) : 2
    const remaining = Math.max(0, Math.min(2, owned) - deck.filter(id => id === card.id).length)
    for (let i = 0; i < remaining; i++) pool.push(card.id)
  }

  deck.push(...shuffled(pool).slice(0, Math.max(0, DECK_SIZE - deck.length)))

  return deck
}
