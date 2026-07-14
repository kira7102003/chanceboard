import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SavedTeam } from '../types/player'

interface PlayerState {
  coins: number
  gems:  number
  ownedCharIds: string[]
  savedTeams:   SavedTeam[]
  defaultTeamId: string | null
  dailyClaims: Record<string, string[]>

  // Model mutations (Controller calls these)
  addCoins:   (n: number) => void
  spendCoins: (n: number) => boolean
  addGems:    (n: number) => void
  spendGems:  (n: number) => boolean
  unlockChar: (id: string) => void
  saveTeam:   (team: Omit<SavedTeam, 'id'>) => void
  deleteTeam: (id: string) => void
  setCoins: (n: number) => void
  setGems: (n: number) => void
  removeOwnedChar: (id: string) => void
  clearCollection: () => void
  setDefaultTeam: (id: string | null) => void
  claimDailyReward: (userId: string, dateKey: string, coins: number, gems: number) => boolean
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      coins: 1320,
      gems:  395,
      ownedCharIds: [],
      savedTeams:   [],
      defaultTeamId: null,
      dailyClaims: {},

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
        defaultTeamId: s.defaultTeamId === id ? null : s.defaultTeamId,
      })),
      setCoins: (n) => set({ coins: Math.max(0, Math.floor(n)) }),
      setGems: (n) => set({ gems: Math.max(0, Math.floor(n)) }),
      removeOwnedChar: (id) => set(s => ({
        ownedCharIds: s.ownedCharIds.filter(charId => charId !== id),
      })),
      clearCollection: () => set({ ownedCharIds: [] }),
      setDefaultTeam: (id) => set({ defaultTeamId: id }),
      claimDailyReward: (userId, dateKey, coins, gems) => {
        const claims = get().dailyClaims ?? {}
        const userClaims = claims[userId] ?? []
        if (userClaims.includes(dateKey)) return false
        set(s => ({
          coins: s.coins + Math.max(0, Math.floor(coins)),
          gems: s.gems + Math.max(0, Math.floor(gems)),
          dailyClaims: { ...s.dailyClaims, [userId]: [...userClaims, dateKey] },
        }))
        return true
      },
    }),
    { name: 'cb_player' }
  )
)
