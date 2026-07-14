/**
 * Controller — AI vs AI battle session manager.
 * Picks 6 random characters, splits them into two teams,
 * enables autoBattle for both sides, then drives the ATB loop.
 */
import { characters } from '../data/db'
import { useGameStore } from '../store/gameStore'
import { shuffled } from '../utils/random'

function pickRandom<T>(arr: T[], n: number): T[] {
  return shuffled(arr).slice(0, n)
}

export function useAIBattle() {
  const gs = () => useGameStore.getState()

  const startAIBattle = () => {
    const store = gs()
    const six = pickRandom(characters, 6)
    const charAIds = six.slice(0, 3).map(c => c.id)
    const charBIds = six.slice(3, 6).map(c => c.id)

    store.setAIBattle(true)
    store.setSolo(false)
    store.setRoom('AI', 'A', true)
    store.setPlayerCount(2)
    useGameStore.setState({ selectedCharIds: charAIds })
    store.setOpponentChars(charBIds)
    store.setMyDeck([])
    store.setOpponentDeck([])
    store.selectPiece('pawn')
    store.startBattle()
    store.toggleAuto('A')   // AI controls A
    store.toggleAuto('B')   // AI controls B
    store.startATBLoop(() => {}, 200)
  }

  return { startAIBattle }
}
