import { cards as allCards } from '../data/db'

const DECK_SIZE = 10

export function randomDeck(): string[] {
  return fillDeck([])
}

export function fillDeck(existing: string[]): string[] {
  const deck = [...existing]
  const pool: string[] = []

  // Every card participates equally, with at most two copies in a generated deck.
  for (const card of allCards) {
    const remaining = Math.max(0, 2 - deck.filter(id => id === card.id).length)
    for (let i = 0; i < remaining; i++) pool.push(card.id)
  }

  // Fisher–Yates avoids the bias of Array.sort(() => Math.random() - .5).
  for (let i = pool.length - 1; i > 0; i--) {
    const random = new Uint32Array(1)
    crypto.getRandomValues(random)
    const j = random[0] % (i + 1)
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }

  deck.push(...pool.slice(0, Math.max(0, DECK_SIZE - deck.length)))

  return deck
}
