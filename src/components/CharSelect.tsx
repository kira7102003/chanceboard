import { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { getChars, getUrlByKey } from '../utils/charStore'
import { CharPortrait } from './Admin'
import { moves as allMoves } from '../data/db'
import type { Character } from '../types/character'
import type { MoveSlot } from '../types/move'

type ElFilter = '劍' | '槍' | '法' | 'all'

const EL_COLOR:  Record<string, string> = { '劍': '#e87733', '槍': '#22cc77', '法': '#9955ee' }
const EL_LABEL:  Record<string, string> = { '劍': '⚔ 劍', '槍': '🔫 槍', '法': '✦ 法' }
const SLOT_COLOR: Record<MoveSlot, string> = { '劍': '#e85533', '槍': '#22cc77', '法': '#9955ee', '願': '#ddaa22', '被': '#888' }
const SLOT_LABEL: Record<MoveSlot, string> = { '劍': '刀', '槍': '槍', '法': '法', '願': '願', '被': '被' }
const SUIT_DOT:   Record<string, string>   = { red: '🔴', green: '🟢', blue: '🔵', yellow: '🟡' }
const SUIT_OF:    Record<string, string>   = { '劍': 'red', '槍': 'green', '法': 'blue', '願': 'yellow' }
const RANGE_LBL:  Record<string, string>   = { '劍': '近戰', '槍': '遠程', '法': '魔法' }

interface Props {
  onConfirm: (ids: string[]) => void
  onToggle:  (id: string) => void
}

// ── Gallery (大典) modal ────────────────────────────────────────
function CharGallery({ char, selectedIds, onToggle, onClose }: {
  char: Character
  selectedIds: string[]
  onToggle: (id: string) => void
  onClose: () => void
}) {
  const col      = EL_COLOR[char.element]
  const isSel    = selectedIds.includes(char.id)
  const selIdx   = selectedIds.indexOf(char.id)
  const moves    = allMoves.filter(m => m.ownerId === char.id)
  const imgUrl   = getUrlByKey(`cb_img_${char.id}`) ?? getUrlByKey(`cb_wide_img_${char.id}`)

  return (
    <div className="cs-gallery-overlay" onClick={onClose}>
      <div className="cs-gallery-panel" onClick={e => e.stopPropagation()}>
        <button className="cs-gallery-close" onClick={onClose}>✕</button>

        {/* Portrait */}
        <div className="cs-gallery-portrait" style={{ borderColor: col + '55' }}>
          {imgUrl
            ? <img src={imgUrl} alt={char.name} className="cs-gallery-img" />
            : <div className="cs-gallery-placeholder" style={{ color: col }}>{char.name[0]}</div>
          }
          {isSel && selIdx >= 0 && (
            <span className="cs-gallery-pos" style={{ background: col }}>{'前中後'[selIdx]}</span>
          )}
        </div>

        {/* Info */}
        <div className="cs-gallery-info">
          <div className="cs-gallery-name" style={{ color: col }}>{char.name}</div>
          {char.title && <div className="cs-gallery-title">{char.title}</div>}
          <div className="cs-gallery-el" style={{ color: col }}>
            {char.element === '劍' ? '⚔' : char.element === '槍' ? '🔫' : '✦'} {char.element}元素
          </div>

          {/* Stats */}
          <div className="cs-gallery-stats">
            {[
              { k: 'HP', v: char.hp },
              { k: '攻', v: char.atk },
              { k: '防', v: char.def },
              { k: '速', v: char.spd },
            ].map(({ k, v }) => (
              <div key={k} className="cs-gallery-stat">
                <span className="cs-gallery-stat-k">{k}</span>
                <span className="cs-gallery-stat-v">{v}</span>
              </div>
            ))}
          </div>

          {/* Move list */}
          <div className="cs-gallery-moves">
            {(['劍', '槍', '法', '願', '被'] as MoveSlot[]).map(slot => {
              const mv = moves.find(m => m.slot === slot)
              if (!mv) return null
              const dot = SUIT_DOT[SUIT_OF[slot]] ?? null
              return (
                <div key={slot} className="cs-gallery-move">
                  <span className="cs-gm-slot" style={{ color: SLOT_COLOR[slot] }}>[{SLOT_LABEL[slot]}]</span>
                  <span className="cs-gm-name">{mv.name}</span>
                  {dot && <span className="cs-gm-cost">{dot}×{mv.condition ?? 1}</span>}
                  {mv.rangeType  && <span className="cs-gm-tag">{RANGE_LBL[mv.rangeType]}</span>}
                  {mv.powerRatio && <span className="cs-gm-tag">威{mv.powerRatio}×</span>}
                  {mv.description && <div className="cs-gm-desc">{mv.description}</div>}
                </div>
              )
            })}
          </div>

          {/* Story */}
          {char.story && <div className="cs-gallery-story">{char.story}</div>}

          {/* Bottom row: select + close */}
          <div className="cs-gallery-bottom">
            <button
              className={`btn ${isSel ? '' : 'primary'}`}
              style={isSel ? { borderColor: col + '88', color: col } : undefined}
              onClick={() => { onToggle(char.id); onClose() }}
            >
              {isSel ? `✕ 移除（${['前', '中', '後'][selIdx] ?? ''}）` : '✚ 選取此角色'}
            </button>
            <button className="cs-gallery-back" onClick={onClose}>✕ 關閉</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
export default function CharSelect({ onConfirm, onToggle }: Props) {
  const characters = getChars()
  const { selectedCharIds, mySide, playerCount } = useGameStore()
  const ready = selectedCharIds.length === 3

  const [elFilter,     setElFilter]     = useState<ElFilter>('all')
  const [galleryChar,  setGalleryChar]  = useState<Character | null>(null)
  const [focusIdx,     setFocusIdx]     = useState(0)
  const [dragStartX,   setDragStartX]   = useState<number | null>(null)
  const [dragPixels,   setDragPixels]   = useState(0)
  const [wasDragging,  setWasDragging]  = useState(false)
  const [vw,           setVw]           = useState(window.innerWidth)
  const [vh,           setVh]           = useState(window.innerHeight)

  useEffect(() => {
    const onResize = () => { setVw(window.innerWidth); setVh(window.innerHeight) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const filtered = characters.filter(c => elFilter === 'all' || c.element === elFilter)
  const n = filtered.length

  useEffect(() => { setFocusIdx(0) }, [elFilter])
  useEffect(() => {
    if (n > 0) setFocusIdx(p => (p >= n ? 0 : p))
  }, [n])

  // Sizing — fill available height
  const isLandscape = vh < 500
  const isMobile    = vw < 640
  // Overhead = everything except the carousel (header, filter, nav, selected, confirm, padding)
  const overhead = isLandscape ? 95 : isMobile ? 175 : 160
  const availH   = Math.max(220, vh - overhead)
  // Portrait fills available height; width capped so it doesn't overflow screen
  const CW = Math.min(
    Math.round(availH / 1.55),
    Math.round(vw * (isLandscape ? 0.45 : isMobile ? 0.80 : 0.78))
  )
  const CH   = Math.round(CW * 1.55)
  const STEP = Math.round(CW * 0.65)

  const dragIdxOff   = dragStartX !== null ? -dragPixels / STEP : 0
  const displayFocus = focusIdx + dragIdxOff
  const isSnapping   = dragStartX === null

  function getOff(i: number): number {
    if (n === 0) return 0
    let off = i - displayFocus
    while (off >  n / 2) off -= n
    while (off < -n / 2) off += n
    return off
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    setDragStartX(e.clientX)
    setDragPixels(0)
    setWasDragging(false)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (dragStartX === null) return
    const d = e.clientX - dragStartX
    setDragPixels(d)
    if (Math.abs(d) > 7) setWasDragging(true)
  }
  function onPointerUp() {
    if (dragStartX === null) return
    const snapped = Math.round(focusIdx - dragPixels / STEP)
    setFocusIdx(((snapped % n) + n) % n)
    setDragStartX(null)
    setDragPixels(0)
  }

  function handleCharClick(charId: string, off: number) {
    if (wasDragging) return
    if (Math.abs(off) < 0.5) {
      // Center char: open 大典 gallery (select/deselect from inside)
      const cdata = characters.find(c => c.id === charId)
      if (cdata) setGalleryChar(cdata)
    } else {
      setFocusIdx(filtered.findIndex(c => c.id === charId))
    }
  }

  const focusedInt  = n > 0 ? ((Math.round(displayFocus) % n) + n) % n : 0
  const focusedChar = filtered[focusedInt]
  const prevIdx     = n > 0 ? ((focusedInt - 1 + n) % n) : 0
  const nextIdx     = n > 0 ? ((focusedInt + 1) % n) : 0
  const prevChar    = filtered[prevIdx]
  const nextChar    = filtered[nextIdx]

  function adjNameSize(name: string): number {
    // shrink font so name fits inside ~60px (Chinese char ~1em)
    if (name.length <= 3) return 13
    if (name.length <= 5) return 11
    return 9
  }

  const charsWithOff = filtered.map((c, i) => ({ c, i, off: getOff(i) }))
  const sorted = [...charsWithOff].sort((a, b) => Math.abs(b.off) - Math.abs(a.off))
  const VISIBLE_CUTOFF = Math.min(7, n * 0.45)

  return (
    <div className="char-select">

      {/* ── Header */}
      <div className="cs-header">
        <h2 style={{ margin: 0 }}>
          選擇角色 — <span className={`side side-${mySide}`}>{mySide} 方</span>
        </h2>
        <span className="hint">選 3 位（{selectedCharIds.length}/3）</span>
        {playerCount < 2 && <span className="waiting">等待對手…</span>}
      </div>

      {/* ── Filter bar */}
      <div className="cs-filter-bar">
        {(['all', '劍', '槍', '法'] as ElFilter[]).map(el => (
          <button
            key={el}
            className={`cs-filter-btn ${elFilter === el ? 'active' : ''}`}
            style={elFilter === el && el !== 'all'
              ? { borderColor: EL_COLOR[el], color: EL_COLOR[el], background: `${EL_COLOR[el]}18` }
              : undefined}
            onClick={() => setElFilter(el)}
          >
            {el === 'all' ? '全部' : EL_LABEL[el]}
            <span className="cs-filter-count">
              {el === 'all' ? characters.length : characters.filter(c => c.element === el).length}
            </span>
          </button>
        ))}
      </div>

      {/* ── Carousel */}
      <div
        className="cs-carousel"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {sorted.map(({ c, off }) => {
          const absOff   = Math.abs(off)
          if (absOff > VISIBLE_CUTOFF) return null
          const scale    = Math.max(0.28, 1 - absOff * 0.16)
          const opacity  = Math.max(0.04, 1 - absOff * 0.24)
          const xOff     = Math.round(off * STEP)
          const zIdx     = Math.round(100 - absOff * 12)
          const isCenter = absOff < 0.5
          const sel      = selectedCharIds.includes(c.id)
          const selIdx   = selectedCharIds.indexOf(c.id)
          const col      = EL_COLOR[c.element]

          return (
            <div
              key={c.id}
              className={`cs-car-char${sel ? ' selected' : ''}${isCenter ? ' center' : ''}`}
              style={{
                width:      CW,
                height:     CH,
                marginLeft: -CW / 2,
                marginTop:  -CH / 2,
                transform:  `translateX(${xOff}px) scale(${scale})`,
                opacity,
                zIndex:     zIdx,
                '--ecol':   col,
                transition: isSnapping
                  ? 'transform .28s cubic-bezier(.25,.46,.45,.94), opacity .28s'
                  : 'none',
              } as React.CSSProperties}
              onClick={e => { e.stopPropagation(); handleCharClick(c.id, off) }}
            >
              <CharPortrait
                id={c.id} size={CW} height={CH}
                style={{
                  width: '100%', height: '100%',
                  objectFit: 'cover', objectPosition: 'top center',
                  borderRadius: 0, background: 'transparent',
                  display: 'block', pointerEvents: 'none',
                }}
              />
              {sel && selIdx >= 0 && (
                <span className="cs-pos" style={{ background: col }}>{'前中後'[selIdx]}</span>
              )}
              {isCenter && (
                <div className="cs-car-name" style={{ color: col }}>{c.name}</div>
              )}
            </div>
          )
        })}

        {/* Info button — bottom-right of carousel */}
        {focusedChar && (
          <button
            className="cs-info-btn"
            onClick={() => setGalleryChar(focusedChar)}
          >
            資訊
          </button>
        )}
      </div>

      {/* ── Nav arrows + counter */}
      <div className="cs-nav-hint">
        <button className="cs-nav-btn prev" onClick={() => setFocusIdx(prevIdx)}>
          <span className="cs-nav-arrow">‹</span>
          {prevChar && prevChar.id !== focusedChar?.id && (
            <span className="cs-nav-adj-name" style={{ fontSize: adjNameSize(prevChar.name) }}>
              {prevChar.name}
            </span>
          )}
        </button>
        <div className="cs-nav-label">
          <span className="cs-nav-count">{focusedInt + 1} / {n}</span>
        </div>
        <button className="cs-nav-btn next" onClick={() => setFocusIdx(nextIdx)}>
          <span className="cs-nav-arrow">›</span>
          {nextChar && nextChar.id !== focusedChar?.id && (
            <span className="cs-nav-adj-name" style={{ fontSize: adjNameSize(nextChar.name) }}>
              {nextChar.name}
            </span>
          )}
        </button>
      </div>

      {/* ── Selected strip */}
      {selectedCharIds.length > 0 && (
        <div className="cs-selected">
          {selectedCharIds.map((id, i) => {
            const col  = ['#e85533', '#ddaa22', '#33aacc'][i]
            const char = characters.find(c => c.id === id)!
            return (
              <span key={id} className="cs-chip" style={{ borderColor: `${col}66` }}>
                <b style={{ color: col }}>{'前中後'[i]}</b>
                {char.name}
              </span>
            )
          })}
        </div>
      )}

      {/* ── Confirm */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button className="btn primary" disabled={!ready} onClick={() => onConfirm(selectedCharIds)}>
          確認選角 →
        </button>
        {!ready && <span className="hint">還需 {3 - selectedCharIds.length} 位</span>}
      </div>

      {/* ── 大典 Gallery modal */}
      {galleryChar && (
        <CharGallery
          char={galleryChar}
          selectedIds={selectedCharIds}
          onToggle={onToggle}
          onClose={() => setGalleryChar(null)}
        />
      )}
    </div>
  )
}
