import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SavedDeck, SavedTeam } from '../types/player'

interface PlayerState {
  coins: number
  gems:  number
  ownedCharIds: string[]
  savedTeams:   SavedTeam[]
  defaultTeamId: string | null
  savedDecks: SavedDeck[]
  defaultDeckId: string | null
  dailyClaims: Record<string, string[]>
  characterStars: Record<string, number>
  cardInventory: Record<string, number>

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
  saveDeck: (deck: Omit<SavedDeck, 'id'>) => void
  deleteDeck: (id: string) => void
  setDefaultDeck: (id: string | null) => void
  claimDailyReward: (userId: string, dateKey: string, coins: number, gems: number) => boolean
  addCharacterStar: (id: string) => boolean
  buyCards: (id: string, quantity: number, unitPrice: number) => boolean
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      coins: 1320,
      gems:  395,
      ownedCharIds: [],
      savedTeams:   [],
      defaultTeamId: null,
      savedDecks: [],
      defaultDeckId: null,
      dailyClaims: {},
      characterStars: {},
      cardInventory: { '001': 10, '002': 10, '003': 10, '004': 10 },

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
      addCharacterStar: (id) => {
        const current = get().characterStars[id] ?? 0
        if (current >= 5) return false
        set(s => ({ characterStars: { ...s.characterStars, [id]: current + 1 } }))
        return true
      },
      buyCards: (id, quantity, unitPrice) => {
        const count = get().cardInventory[id] ?? 0
        const amount = Math.max(1, Math.floor(quantity))
        const total = amount * Math.max(0, Math.floor(unitPrice))
        if (count + amount > 10 || get().coins < total) return false
        set(s => ({ coins: s.coins - total, cardInventory: { ...s.cardInventory, [id]: count + amount } }))
        return true
      },
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
      saveDeck: (deck) => {
        if (deck.cardIds.length !== 10 || get().savedDecks.length >= 10) return
        const id = `deck_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        set(s => ({ savedDecks: [...s.savedDecks, { ...deck, cardIds: [...deck.cardIds], id }] }))
      },
      deleteDeck: (id) => set(s => ({
        savedDecks: s.savedDecks.filter(deck => deck.id !== id),
        defaultDeckId: s.defaultDeckId === id ? null : s.defaultDeckId,
      })),
      setDefaultDeck: (id) => set({ defaultDeckId: id }),
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
