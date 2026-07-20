import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SavedDeck, SavedTeam } from '../types/player'

interface PlayerState {
  username: string
  coins: number
  gems:  number
  ownedCharIds: string[]
  savedTeams:   SavedTeam[]
  defaultTeamId: string | null
  savedDecks: SavedDeck[]
  defaultDeckId: string | null
  dailyClaims: Record<string, string[]>
  characterStars: Record<string, number>
  characterFragments: Record<string, number>
  materials: { silver: number; copper: number; iron: number; wood: number }
  skillSouls: { sword: number; gun: number; magic: number }
  cardInventory: Record<string, number>
  upgradeItems: number
  claimedRewards: string[]
  friends: string[]
  level: number
  experience: number
  desktopCharIds: string[]
  musicEnabled: boolean
  soundEnabled: boolean
  musicVolume: number
  soundVolume: number

  // Model mutations (Controller calls these)
  setUsername: (name: string) => void
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
  saveDeck: (deck: Omit<SavedDeck, 'id'>) => string | null
  deleteDeck: (id: string) => void
  setDefaultDeck: (id: string | null) => void
  claimDailyReward: (userId: string, dateKey: string, coins: number, gems: number) => boolean
  addCharacterStar: (id: string) => boolean
  addCharacterFragments: (id: string, quantity: number) => void
  buyCards: (id: string, quantity: number, unitPrice: number) => boolean
  upgradeCharacterWithItem: (id: string) => boolean
  claimReward: (id: string, coins: number, gems: number, upgradeItems: number) => boolean
  addFriend: (playerId: string) => boolean
  removeFriend: (playerId: string) => void
  addExperience: (amount: number) => void
  setDesktopCharacters: (ids: string[]) => void
  claimStoryReward: (chapterId: string, reward: { characterId?: string; coins?: number; gems?: number; silver?: number; copper?: number; iron?: number; wood?: number }) => boolean
  setMusicSettings: (enabled: boolean, volume: number) => void
  setSoundSettings: (enabled: boolean, volume: number) => void
  addResourceRewards: (reward: { gems?: number; coins?: number; silver?: number; copper?: number; iron?: number; wood?: number; swordSoul?: number; gunSoul?: number; magicSoul?: number }) => void
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      username: '玩家',
      coins: 1320,
      gems:  395,
      ownedCharIds: [],
      savedTeams:   [],
      defaultTeamId: null,
      savedDecks: [],
      defaultDeckId: null,
      dailyClaims: {},
      characterStars: {},
      characterFragments: {},
      materials: { silver: 0, copper: 0, iron: 0, wood: 0 },
      skillSouls: { sword: 0, gun: 0, magic: 0 },
      cardInventory: { '001': 10, '002': 10, '003': 10, '004': 10 },
      upgradeItems: 0,
      claimedRewards: [],
      friends: [],
      level: 1,
      experience: 0,
      desktopCharIds: [],
      musicEnabled: true,
      soundEnabled: true,
      musicVolume: 70,
      soundVolume: 80,

      setUsername: (name) => set({ username: name.trim().slice(0, 20) || '玩家' }),
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
      addCharacterFragments: (id, quantity) => set(s => ({
        characterFragments: { ...s.characterFragments, [id]: (s.characterFragments?.[id] ?? 0) + Math.max(0, Math.floor(quantity)) },
      })),
      buyCards: (id, quantity, unitPrice) => {
        const count = get().cardInventory[id] ?? 0
        const amount = Math.max(1, Math.floor(quantity))
        const total = amount * Math.max(0, Math.floor(unitPrice))
        if (count + amount > 10 || get().coins < total) return false
        set(s => ({ coins: s.coins - total, cardInventory: { ...s.cardInventory, [id]: count + amount } }))
        return true
      },
      upgradeCharacterWithItem: (id) => {
        const state = get()
        if (!state.ownedCharIds.includes(id) || state.upgradeItems <= 0 || (state.characterStars[id] ?? 0) >= 5) return false
        set(s => ({ upgradeItems: s.upgradeItems - 1, characterStars: { ...s.characterStars, [id]: (s.characterStars[id] ?? 0) + 1 } }))
        return true
      },
      claimReward: (id, coins, gems, upgradeItems) => {
        if (get().claimedRewards.includes(id)) return false
        set(s => ({
          coins: s.coins + Math.max(0, Math.floor(coins)), gems: s.gems + Math.max(0, Math.floor(gems)),
          upgradeItems: s.upgradeItems + Math.max(0, Math.floor(upgradeItems)), claimedRewards: [...s.claimedRewards, id],
        }))
        return true
      },
      addFriend: (playerId) => {
        const normalized = playerId.trim().toUpperCase()
        if (!normalized || get().friends.length >= 50 || get().friends.includes(normalized)) return false
        set(s => ({ friends: [...s.friends, normalized] }))
        return true
      },
      removeFriend: (playerId) => set(s => ({ friends: s.friends.filter(id => id !== playerId) })),
      addExperience: (amount) => set(s => {
        let level = Math.max(1, s.level || 1)
        let experience = Math.max(0, s.experience || 0) + Math.max(0, Math.floor(amount))
        while (experience >= level * 100) {
          experience -= level * 100
          level++
        }
        return { level, experience }
      }),
      setDesktopCharacters: (ids) => set(s => ({
        desktopCharIds: [...new Set(ids)].filter(id => s.ownedCharIds.includes(id)).slice(0, 5),
      })),
      claimStoryReward: (chapterId, reward) => {
        const rewardId = `story:${chapterId}`
        if (get().claimedRewards.includes(rewardId)) return false
        set(s => {
          const alreadyOwned = !!reward.characterId && s.ownedCharIds.includes(reward.characterId)
          return {
            coins: s.coins + Math.max(0, Math.floor(reward.coins ?? 0)),
            gems: s.gems + Math.max(0, Math.floor(reward.gems ?? 0)),
            materials: {
              silver: s.materials.silver + Math.max(0, Math.floor(reward.silver ?? 0)),
              copper: s.materials.copper + Math.max(0, Math.floor(reward.copper ?? 0)),
              iron: s.materials.iron + Math.max(0, Math.floor(reward.iron ?? 0)),
              wood: s.materials.wood + Math.max(0, Math.floor(reward.wood ?? 0)),
            },
            ownedCharIds: reward.characterId && !alreadyOwned ? [...s.ownedCharIds, reward.characterId] : s.ownedCharIds,
            characterFragments: alreadyOwned && reward.characterId
              ? { ...s.characterFragments, [reward.characterId]: (s.characterFragments[reward.characterId] ?? 0) + 10 }
              : s.characterFragments,
            claimedRewards: [...s.claimedRewards, rewardId],
          }
        })
        return true
      },
      setMusicSettings: (enabled, volume) => set({ musicEnabled: enabled, musicVolume: Math.max(0, Math.min(100, Math.round(volume))) }),
      setSoundSettings: (enabled, volume) => set({ soundEnabled: enabled, soundVolume: Math.max(0, Math.min(100, Math.round(volume))) }),
      addResourceRewards: (reward) => set(s => ({
        gems: s.gems + Math.max(0, Math.floor(reward.gems ?? 0)), coins: s.coins + Math.max(0, Math.floor(reward.coins ?? 0)),
        materials: { silver: s.materials.silver + Math.max(0, Math.floor(reward.silver ?? 0)), copper: s.materials.copper + Math.max(0, Math.floor(reward.copper ?? 0)), iron: s.materials.iron + Math.max(0, Math.floor(reward.iron ?? 0)), wood: s.materials.wood + Math.max(0, Math.floor(reward.wood ?? 0)) },
        skillSouls: { sword: (s.skillSouls?.sword ?? 0) + Math.max(0, Math.floor(reward.swordSoul ?? 0)), gun: (s.skillSouls?.gun ?? 0) + Math.max(0, Math.floor(reward.gunSoul ?? 0)), magic: (s.skillSouls?.magic ?? 0) + Math.max(0, Math.floor(reward.magicSoul ?? 0)) },
      })),
      saveTeam: (team) => {
        if (get().savedTeams.length >= 10) return
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
        if (deck.cardIds.length !== 10 || get().savedDecks.length >= 10) return null
        const id = `deck_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        set(s => ({ savedDecks: [...s.savedDecks, { ...deck, cardIds: [...deck.cardIds], id }] }))
        return id
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
