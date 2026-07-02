/**
 * Controller — solo game session manager.
 * No WebSocket; drives ATB loop directly; AI controls B-side via autoBattleB.
 */
import { characters } from '../data/db'
import { useGameStore } from '../store/gameStore'
import { randomDeck } from '../engine/randomDeck'

function pickRandom<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n)
}

export function useSolo() {
  const gs = () => useGameStore.getState()

  /**
   * Call after player selects deck.
   * Sets opponent chars, starts battle, enables B-side AI.
   */
  const startSolo = (myCharIds: string[], myDeckIds: string[]) => {
    const store = gs()
    const opponentIds = pickRandom(
      characters.filter(c => !myCharIds.includes(c.id)),
      3,
    ).map(c => c.id)

    store.setOpponentChars(opponentIds)
    store.setMyDeck(myDeckIds)
    store.setOpponentDeck(randomDeck())
    store.selectPiece('pawn')
    store.startBattle()
    store.toggleAuto('B')       // AI always controls B
    store.startATBLoop(() => {}) // no-op: no WebSocket sync needed
  }

  return { startSolo }
}
