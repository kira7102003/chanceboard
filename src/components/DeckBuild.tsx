import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { usePlayerStore } from '../store/playerStore'
import { cards as allCards } from '../data/db'
import { randomDeck } from '../engine/randomDeck'
import { CARD_ICON } from '../data/cardIcons'
import { getCardImg } from '../utils/charStore'
import type { Card } from '../types/card'
import GameImage from './GameImage'

const DECK_SIZE = 10

const SUIT_COLOR: Record<string, string> = {
  red: '#ee4444', green: '#22cc77', blue: '#5566ee', yellow: '#ddaa22', flower: '#bb55ee',
}

const suitCards   = allCards.filter(c => c.isSuitCard)
const flowerCards = allCards.filter(c => !c.isSuitCard)

// ── CardRow: stable top-level component so hooks don't reset ──────────────────
interface CardRowProps {
  card: Card; cnt: number; total: number
  pulse?: boolean
  onAdd: () => void; onRemove: () => void
}
function CardRow({ card, cnt, total, pulse, onAdd, onRemove }: CardRowProps) {
  const [showDesc, setShowDesc] = useState(false)
  const col    = SUIT_COLOR[card.color]
  const imgUrl = getCardImg(card.id)

  return (
    <div
      className={`deck-card${cnt > 0 ? ' in-deck' : ''}${pulse ? ' dk-card-dealt' : ''}`}
      style={{ borderTopColor: cnt > 0 ? col : undefined, borderTopWidth: cnt > 0 ? 2 : 1 }}
      onMouseEnter={() => setShowDesc(true)}
      onMouseLeave={() => setShowDesc(false)}
    >
      {showDesc && card.description && (
        <div className="deck-card-tooltip">{card.description}</div>
      )}
      <div className="deck-card-header">
        {imgUrl && <GameImage storageKey={`cb_card_img_${card.id}`} thumbWidth={160} className="deck-card-img" alt="" draggable={false}
          onError={e => { e.currentTarget.style.display = 'none' }} />}
        <div className="deck-card-main">
          <div className="deck-card-name" style={{ color: cnt > 0 ? col : undefined }}>
            <span className="deck-card-icon">{CARD_ICON[card.id]}</span>
            {card.name}
          </div>
          <div className="deck-card-controls" onClick={e => e.stopPropagation()}>
            <button className="btn sm" onClick={onRemove} disabled={cnt === 0}>－</button>
            <span className="deck-card-count" style={{ color: cnt > 0 ? col : '#333355' }}>
              {cnt > 0 ? cnt : '·'}
            </span>
            <button className="btn sm" onClick={onAdd} disabled={total >= DECK_SIZE}>＋</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props { onConfirm: (deckIds: string[]) => void; onBack: () => void }

export default function DeckBuild({ onConfirm, onBack }: Props) {
  const { mySide, isSolo } = useGameStore()
  const { savedDecks, defaultDeckId, saveDeck, deleteDeck, setDefaultDeck } = usePlayerStore()
  const defaultDeck = savedDecks.find(deck => deck.id === defaultDeckId)
  const [selected, setSelected] = useState<string[]>(() => defaultDeck?.cardIds.slice(0, DECK_SIZE) ?? [])
  const [selectedPresetId, setSelectedPresetId] = useState(defaultDeck?.id ?? '')
  const [tab,      setTab]      = useState<'suit' | 'flower'>('suit')
  const [randomPhase, setRandomPhase] = useState<'gather' | 'deal' | null>(null)
  const [dealtCardId, setDealtCardId] = useState<string | null>(null)
  const [dealTotal, setDealTotal] = useState(0)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => () => timersRef.current.forEach(clearTimeout), [])

  const countOf  = (id: string) => selected.filter(x => x === id).length
  const add      = (id: string) => { if (selected.length < DECK_SIZE) { setSelectedPresetId(''); setSelected(s => [...s, id]) } }
  const remove   = (id: string) => {
    const idx = selected.lastIndexOf(id)
    if (idx !== -1) { setSelectedPresetId(''); setSelected(s => { const a = [...s]; a.splice(idx, 1); return a }) }
  }
  const loadPreset = (id: string) => {
    setSelectedPresetId(id)
    const deck = savedDecks.find(item => item.id === id)
    if (deck) setSelected(deck.cardIds.slice(0, DECK_SIZE))
  }
  const saveCurrent = () => {
    if (selected.length !== DECK_SIZE) return
    const name = window.prompt('請輸入牌組名稱', `牌組 ${savedDecks.length + 1}`)?.trim()
    if (name) saveDeck({ name, cardIds: selected })
  }
  const randomize = () => {
    if (randomPhase) return
    setSelectedPresetId('')
    const additions = randomDeck()

    setDealTotal(additions.length)
    setRandomPhase('gather')
    setSelected([])
    const gatherTimer = setTimeout(() => {
      setRandomPhase('deal')
      additions.forEach((id, i) => {
        const dealTimer = setTimeout(() => {
          setSelected(s => [...s, id])
          setDealtCardId(id)
          const pulseTimer = setTimeout(() => setDealtCardId(null), 180)
          timersRef.current.push(pulseTimer)
          if (i === additions.length - 1) {
            const finishTimer = setTimeout(() => setRandomPhase(null), 420)
            timersRef.current.push(finishTimer)
          }
        }, i * 150)
        timersRef.current.push(dealTimer)
      })
    }, 520)
    timersRef.current.push(gatherTimer)
  }

  return (
    <div className={`deck-page${randomPhase === 'gather' ? ' dk-gathering' : ''}${randomPhase === 'deal' ? ' dk-dealing' : ''}`}>

      {randomPhase && (
        <div className="dk-random-fx" aria-hidden="true">
          <div className="dk-random-stack">
            <i /><i /><i /><i />
            <span>✦</span>
          </div>
          {randomPhase === 'deal' && Array.from({ length: dealTotal }).map((_, i) => (
            <b key={i} style={{
              '--deal-x': `${(i - 4.5) * 8}vw`,
              '--deal-delay': `${i * .15}s`,
            } as React.CSSProperties}>◆</b>
          ))}
          <div className="dk-random-label">{randomPhase === 'gather' ? '牌組收集中' : '命運發牌中'}</div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="dk-header">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
          <h2 style={{ margin: 0, whiteSpace: 'nowrap', fontSize: 'clamp(14px,4vw,20px)' }}>
            自訂牌組 — <span className={`side side-${mySide}`}>{mySide} 方</span>
          </h2>
        </div>
        <div className="dk-preset-controls">
          <select className="dk-preset-select" value={selectedPresetId} onChange={e => loadPreset(e.target.value)} aria-label="選擇牌組">
            <option value="">自選牌組</option>
            {savedDecks.map(deck => <option key={deck.id} value={deck.id}>{deck.name}{deck.id === defaultDeckId ? '（預設）' : ''}</option>)}
          </select>
          <button className="btn dk-random-btn" disabled={!!randomPhase} onClick={randomize}>🎲 隨機配置</button>
        </div>
      </div>

      {/* ── Selected strip ── */}
      <div className="dk-strip">
        <strong className="dk-selected-count">已選 {selected.length}/{DECK_SIZE}</strong>
        <div className="deck-selected-strip">
          {selected.length === 0 && <span className="deck-empty-hint">尚未選牌</span>}
          {(() => {
            const counts: Record<string, number> = {}
            for (const id of selected) counts[id] = (counts[id] ?? 0) + 1
            return Object.entries(counts).map(([id, n]) => {
              const card = allCards.find(c => c.id === id)!
              const col  = SUIT_COLOR[card.color]
              return (
                <span key={id} className="deck-chip"
                  style={{ borderColor: col, color: col, background: `${col}18` }}>
                  {card.name}{n > 1 ? ` ×${n}` : ''}
                </span>
              )
            })
          })()}
        </div>
      </div>

      {/* ── Tab bar (mobile only) ── */}
      <div className="dk-tabs">
        <button className={`dk-tab${tab === 'suit' ? ' active' : ''}`} onClick={() => setTab('suit')}>
          花色牌 <span className="dk-tab-count">4</span>
        </button>
        <button className={`dk-tab${tab === 'flower' ? ' active' : ''}`} onClick={() => setTab('flower')}>
          花牌 <span className="dk-tab-count">{flowerCards.length}</span>
        </button>
      </div>

      {/* ── Card areas ── */}
      <div className="dk-cards">

        <div className={tab !== 'suit' ? 'dk-tab-hidden' : ''}>
          <div className="deck-section-label">花色牌（觸發招式條件）</div>
          <div className="deck-suit-grid">
            {suitCards.map(c => (
              <CardRow key={c.id} card={c}
                cnt={countOf(c.id)} total={selected.length}
                pulse={dealtCardId === c.id}
                onAdd={() => add(c.id)} onRemove={() => remove(c.id)} />
            ))}
          </div>
        </div>

        <div className={tab !== 'flower' ? 'dk-tab-hidden' : ''} style={{ marginTop: 16 }}>
          <div className="deck-section-label">花牌（特效）</div>
          <div className="char-grid">
            {flowerCards.map(c => (
              <CardRow key={c.id} card={c}
                cnt={countOf(c.id)} total={selected.length}
                pulse={dealtCardId === c.id}
                onAdd={() => add(c.id)} onRemove={() => remove(c.id)} />
            ))}
          </div>
        </div>

      </div>

      {/* ── Footer ── */}
      <div className="dk-footer">
        <button className="btn" disabled={selected.length === 0 || !!randomPhase} onClick={() => { setSelected([]); setSelectedPresetId('') }}>清空</button>
        <button className="btn" disabled={selected.length !== DECK_SIZE || savedDecks.length >= 10} onClick={saveCurrent}>儲存牌組</button>
        {selectedPresetId && <button className="btn" onClick={() => setDefaultDeck(selectedPresetId)}>{selectedPresetId === defaultDeckId ? '已設為預設' : '設為預設'}</button>}
        {selectedPresetId && <button className="btn danger" onClick={() => { deleteDeck(selectedPresetId); setSelectedPresetId('') }}>刪除牌組</button>}
        <button className="btn primary" disabled={selected.length !== DECK_SIZE || !!randomPhase} onClick={() => onConfirm(selected)}>
          {isSolo ? '確認牌組 — 開始挑戰' : '確認牌組 — 等待對手'}
        </button>
      </div>

      <button className="btn flow-back-lobby" onClick={onBack}>← 返回大廳</button>

    </div>
  )
}
