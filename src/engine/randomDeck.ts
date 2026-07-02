import { cards as allCards } from '../data/db'

const DECK_SIZE = 10

export function randomDeck(): string[] {
  const pool = [...allCards, ...allCards]
  const shuffled = pool.sort(() => Math.random() - 0.5)
  const deck: string[] = []
  for (const c of shuffled) {
    if (deck.length >= DECK_SIZE) break
    if (deck.filter(x => x === c.id).length < 2) deck.push(c.id)
  }
  return deck
}
