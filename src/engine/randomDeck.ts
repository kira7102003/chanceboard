import { cards as allCards } from '../data/db'

const DECK_SIZE = 10

// Guarantee suit coverage so the player can actually trigger moves.
// Strategy: 2 of each suit color (8 cards) + 2 random flower cards.
export function randomDeck(): string[] {
  return fillDeck([])
}

export function fillDeck(existing: string[]): string[] {
  const deck = [...existing]
  const suits   = allCards.filter(c => c.isSuitCard)
  const flowers = allCards.filter(c => !c.isSuitCard)

  // Count how many of each suit color the deck already has
  const suitColors = ['red', 'green', 'blue', 'yellow']
  for (const color of suitColors) {
    const card = suits.find(c => c.color === color)
    if (!card) continue
    const have = deck.filter(id => id === card.id).length
    for (let i = have; i < 2 && deck.length < DECK_SIZE; i++) {
      deck.push(card.id)
    }
  }

  // Fill remaining slots with random flower cards (max 2 copies each)
  const shuffled = [...flowers].sort(() => Math.random() - 0.5)
  for (const c of shuffled) {
    if (deck.length >= DECK_SIZE) break
    if (deck.filter(x => x === c.id).length < 2) deck.push(c.id)
  }

  return deck
}
