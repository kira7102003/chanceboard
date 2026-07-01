import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { cards as allCards } from '../data/db'

const DECK_SIZE = 10

interface Props {
  onConfirm: (deckIds: string[]) => void
}

export default function DeckBuild({ onConfirm }: Props) {
  const { mySide } = useGameStore()
  const [selected, setSelected] = useState<string[]>([])

  const countOf = (id: string) => selected.filter(x => x === id).length

  const add = (id: string) => {
    if (selected.length >= DECK_SIZE) return
    setSelected(s => [...s, id])
  }

  const remove = (id: string) => {
    const idx = selected.lastIndexOf(id)
    if (idx === -1) return
    setSelected(s => { const a = [...s]; a.splice(idx, 1); return a })
  }

  const SUIT_COLOR: Record<string, string> = {
    red: '#e44', green: '#4a4', blue: '#44e', yellow: '#ca0', flower: '#c8c',
  }

  return (
    <div className="char-select">
      <h2>
        <span className={`side side-${mySide}`}>{mySide} 方</span>
        {' '}選擇自訂牌組
      </h2>
      <p className="hint">選擇 {DECK_SIZE} 張牌加入你的專屬牌組，每回合補給 1 張 · 已選 {selected.length}/{DECK_SIZE}</p>

      <div className="char-grid">
        {allCards.map(card => {
          const cnt = countOf(card.id)
          return (
            <div
              key={card.id}
              className={`char-card ${cnt > 0 ? 'selected' : ''}`}
              style={{ borderColor: cnt > 0 ? SUIT_COLOR[card.color] : undefined }}
            >
              <div className="char-name" style={{ color: SUIT_COLOR[card.color] }}>
                {card.name}
              </div>
              <div className="char-title">{card.color === 'flower' ? '花牌' : '花色牌'}</div>
              <div className="char-stats" style={{ marginBottom: 8 }}>{card.description}</div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                <button
                  className="btn sm"
                  onClick={() => remove(card.id)}
                  disabled={cnt === 0}
                >－</button>
                <span style={{ minWidth: 20, textAlign: 'center', color: cnt > 0 ? '#fff' : '#555' }}>
                  {cnt > 0 ? cnt : '·'}
                </span>
                <button
                  className="btn sm"
                  onClick={() => add(card.id)}
                  disabled={selected.length >= DECK_SIZE}
                >＋</button>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
        <button
          className="btn primary"
          disabled={selected.length === 0}
          onClick={() => onConfirm(selected)}
        >
          確認牌組（{selected.length}/{DECK_SIZE}）等待對手…
        </button>
        {selected.length < DECK_SIZE && (
          <span className="hint">還需 {DECK_SIZE - selected.length} 張</span>
        )}
      </div>
    </div>
  )
}
