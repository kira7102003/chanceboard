import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SavedTeam } from '../types/player'

interface PlayerState {
  coins: number
  gems:  number
  ownedCharIds: string[]
  savedTeams:   SavedTeam[]

  // Model mutations (Controller calls these)
  addCoins:   (n: number) => void
  spendCoins: (n: number) => boolean
  addGems:    (n: number) => void
  spendGems:  (n: number) => boolean
  unlockChar: (id: string) => void
  saveTeam:   (team: Omit<SavedTeam, 'id'>) => void
  deleteTeam: (id: string) => void
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      coins: 1320,
      gems:  395,
      ownedCharIds: [],
      savedTeams:   [],

      addCoins:   (n) => set(s => ({ coins: s.coins + n })),
      spendCoins: (n) => {
        if (get().coins < n) return false
        set(s => ({ coins: s.coins - n }))
        return true
      },
      addGems:    (n) => set(s => ({ gems: s.gems + n })),
      spendGems:  (n) => {
        if (get().gems < n) return false
        set(s => ({ gems: s.gems - n }))
        return true
      },
      unlockChar: (id) => set(s => ({
        ownedCharIds: s.ownedCharIds.includes(id)
          ? s.ownedCharIds
          : [...s.ownedCharIds, id],
      })),
      saveTeam: (team) => {
        if (get().savedTeams.length >= 5) return
        const id = `team_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        set(s => ({ savedTeams: [...s.savedTeams, { ...team, id }] }))
      },
      deleteTeam: (id) => set(s => ({
        savedTeams: s.savedTeams.filter(t => t.id !== id),
      })),
    }),
    { name: 'cb_player' }
  )
)
