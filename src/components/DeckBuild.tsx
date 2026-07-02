import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { cards as allCards } from '../data/db'


const DECK_SIZE = 10

const SUIT_COLOR: Record<string, string> = {
  red: '#ee4444', green: '#22cc77', blue: '#5566ee', yellow: '#ddaa22', flower: '#bb55ee',
}

const suitCards   = allCards.filter(c => c.isSuitCard)
const flowerCards = allCards.filter(c => !c.isSuitCard)

interface Props {
  onConfirm: (deckIds: string[]) => void
}

export default function DeckBuild({ onConfirm }: Props) {
  const { mySide, isSolo } = useGameStore()
  const [selected, setSelected] = useState<string[]>([])

  const countOf = (id: string) => selected.filter(x => x === id).length
  const add    = (id: string) => { if (selected.length < DECK_SIZE) setSelected(s => [...s, id]) }
  const remove = (id: string) => {
    const idx = selected.lastIndexOf(id)
    if (idx !== -1) setSelected(s => { const a = [...s]; a.splice(idx, 1); return a })
  }

  const CardRow = ({ card }: { card: typeof allCards[number] }) => {
    const cnt = countOf(card.id)
    const col = SUIT_COLOR[card.color]
    return (
      <div
        className={`deck-card ${cnt > 0 ? 'in-deck' : ''}`}
        style={{ borderTopColor: cnt > 0 ? col : undefined, borderTopWidth: cnt > 0 ? 2 : 1 }}
      >
        <div className="deck-card-name" style={{ color: cnt > 0 ? col : undefined }}>
          {card.name}
        </div>
        <div className="deck-card-desc">{card.description}</div>
        <div className="deck-card-controls">
          <button className="btn sm" onClick={() => remove(card.id)} disabled={cnt === 0}>－</button>
          <span
            className="deck-card-count"
            style={{ color: cnt > 0 ? col : '#333355' }}
          >{cnt > 0 ? cnt : '·'}</span>
          <button className="btn sm" onClick={() => add(card.id)} disabled={selected.length >= DECK_SIZE}>＋</button>
        </div>
      </div>
    )
  }

  return (
    <div className="deck-page">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h2>自訂牌組 — <span className={`side side-${mySide}`}>{mySide} 方</span></h2>
        <span className="hint">選 {DECK_SIZE} 張，每回合補 1 張（{selected.length}/{DECK_SIZE}）</span>
      </div>

      {/* Selected deck strip */}
      <div>
        <div className="deck-section-label">已選牌組</div>
        <div className="deck-selected-strip">
          {selected.length === 0 && <span className="deck-empty-hint">尚未選牌</span>}
          {(() => {
            const counts: Record<string, number> = {}
            for (const id of selected) counts[id] = (counts[id] ?? 0) + 1
            return Object.entries(counts).map(([id, n]) => {
              const card = allCards.find(c => c.id === id)!
              const col = SUIT_COLOR[card.color]
              return (
                <span
                  key={id}
                  className="deck-chip"
                  style={{ borderColor: col, color: col, background: `${col}18` }}
                >
                  {card.name}{n > 1 ? ` ×${n}` : ''}
                </span>
              )
            })
          })()}
        </div>
      </div>

      {/* Suit cards row */}
      <div>
        <div className="deck-section-label">花色牌（觸發招式條件）</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {suitCards.map(c => <CardRow key={c.id} card={c} />)}
        </div>
      </div>

      {/* Flower cards grid */}
      <div>
        <div className="deck-section-label">花牌（特效）</div>
        <div className="char-grid">
          {flowerCards.map(c => <CardRow key={c.id} card={c} />)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingBottom: 8 }}>
        <button
          className="btn primary"
          disabled={selected.length === 0}
          onClick={() => onConfirm(selected)}
        >
          {isSolo ? '確認牌組 — 開始挑戰' : '確認牌組 — 等待對手'}
        </button>
        {selected.length < DECK_SIZE && (
          <span className="hint">建議選滿 {DECK_SIZE} 張（目前 {selected.length}）</span>
        )}
      </div>
    </div>
  )
}
