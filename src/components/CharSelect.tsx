import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { usePlayerStore } from '../store/playerStore'
import { getChars, getUrlByKey } from '../utils/charStore'
import { CharPortrait } from './Admin'
import { moves as allMoves } from '../data/db'
import type { Character } from '../types/character'
import type { MoveSlot } from '../types/move'
import { getLogisticsBusyCharacterIds } from '../utils/logisticsStore'
import './CharacterStory.css'

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
  onBack: () => void
}

// ── Gallery (大典) modal ────────────────────────────────────────
function CharGallery({ char, stars, selectedIds, onToggle, onClose }: {
  char: Character
  stars: number
  selectedIds: string[]
  onToggle: (id: string) => void
  onClose: () => void
}) {
  const col      = EL_COLOR[char.element]
  const isSel    = selectedIds.includes(char.id)
  const selIdx   = selectedIds.indexOf(char.id)
  const moves    = allMoves.filter(m => m.ownerId === char.id)
  const imgUrl   = getUrlByKey(`cb_img_${char.id}`)

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
          {char.story && <div className="cs-gallery-story"><b>外篇</b>{char.story}</div>}
          {char.innerStory && (stars >= (char.innerStoryUnlockStars ?? 5) ? <div className="cs-gallery-story inner"><b>裡篇</b>{char.innerStory}</div> : <div className="cs-gallery-story locked">🔒 裡篇需要 {char.innerStoryUnlockStars ?? 5} 星解鎖（目前 {stars} 星）</div>)}

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
export default function CharSelect({ onConfirm, onToggle, onBack }: Props) {
  const allChars   = getChars()
  const logisticsBusyIds = getLogisticsBusyCharacterIds()
  const characters = allChars.filter(c => c.enabled !== false && !logisticsBusyIds.includes(c.id))
  const { selectedCharIds, isSolo, loadTeam } = useGameStore()
  const { savedTeams, defaultTeamId, setDefaultTeam, characterStars } = usePlayerStore()
  const ready = selectedCharIds.length === 3

  const [elFilter,    setElFilter]    = useState<ElFilter>('all')
  const [galleryChar, setGalleryChar] = useState<Character | null>(null)
  const [focusIdx,    setFocusIdx]    = useState(0)
  const [dragStartX,  setDragStartX]  = useState<number | null>(null)
  const [dragPixels,  setDragPixels]  = useState(0)
  const [vw,          setVw]          = useState(window.innerWidth)
  const [carouselH,   setCarouselH]   = useState(0)
  const carouselRef    = useRef<HTMLDivElement>(null)
  // Refs for event handlers — avoid stale-closure and pointer-capture issues
  const wasDraggingRef  = useRef(false)
  const dragStartXRef   = useRef<number | null>(null)
  const dragPixelsRef   = useRef(0)
  const downCharIdRef   = useRef<string | null>(null)
  const downCharOffRef  = useRef(0)

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const el = carouselRef.current; if (!el) return
    const obs = new ResizeObserver(entries => {
      const h = entries[0]?.contentRect.height ?? 0
      if (h > 0) setCarouselH(h)
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const filtered = characters.filter(c => elFilter === 'all' || c.element === elFilter)
  const n = filtered.length

  useEffect(() => { setFocusIdx(0) }, [elFilter])
  useEffect(() => {
    if (n > 0) setFocusIdx(p => (p >= n ? 0 : p))
  }, [n])

  // Sizing — use measured carousel height to avoid overflow
  const isMobile    = vw < 640
  const isLandscape = window.innerHeight < 500
  // availH = measured carousel height (from ResizeObserver), fallback if not yet measured
  const availH = carouselH > 50 ? carouselH : Math.max(180, window.innerHeight - (isMobile ? 180 : 210))
  // Portrait width capped so it doesn't overflow screen width
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
    dragStartXRef.current  = e.clientX
    dragPixelsRef.current  = 0
    wasDraggingRef.current = false
    setDragStartX(e.clientX)
    setDragPixels(0)
    e.currentTarget.setPointerCapture(e.pointerId)

    // Determine which char was tapped from current layout
    const rect  = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - (rect.left + rect.width / 2)
    let bestId = '', bestOff = 0, bestDist = Infinity
    for (const { c, off } of charsWithOff) {
      const d = Math.abs(off * STEP - clickX)
      if (d < bestDist) { bestId = c.id; bestOff = off; bestDist = d }
    }
    downCharIdRef.current  = bestDist < CW ? bestId : null
    downCharOffRef.current = bestOff
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragStartXRef.current === null) return
    const d = e.clientX - dragStartXRef.current
    setDragPixels(d)
    dragPixelsRef.current = d
    if (Math.abs(d) > 14) wasDraggingRef.current = true
  }

  function onPointerUp() {
    if (dragStartXRef.current === null) return

    if (!wasDraggingRef.current) {
      // Tap: toggle selection (center) or navigate to char
      const charId = downCharIdRef.current
      if (charId) {
        if (Math.abs(downCharOffRef.current) < 0.5) {
          onToggle(charId)
        } else {
          const idx = filtered.findIndex(c => c.id === charId)
          if (idx >= 0) setFocusIdx(idx)
        }
      }
    } else {
      // Drag end: snap to nearest char
      const snapped = Math.round(focusIdx - dragPixelsRef.current / STEP)
      setFocusIdx(((snapped % n) + n) % n)
    }

    dragStartXRef.current = null
    setDragStartX(null)
    setDragPixels(0)
    dragPixelsRef.current = 0
  }

  const focusedInt  = n > 0 ? ((Math.round(displayFocus) % n) + n) % n : 0
  const focusedChar = filtered[focusedInt]
  const prevIdx     = n > 0 ? ((focusedInt - 1 + n) % n) : 0
  const nextIdx     = n > 0 ? ((focusedInt + 1) % n) : 0
  const prevChar    = filtered[prevIdx]
  const nextChar    = filtered[nextIdx]

  function adjNameSize(name: string): number {
    // The wider navigation buttons can keep most names comfortably readable.
    if (name.length <= 8) return 13
    if (name.length <= 12) return 11
    return 10
  }

  const charsWithOff = filtered.map((c, i) => ({ c, i, off: getOff(i) }))
  const sorted       = [...charsWithOff].sort((a, b) => Math.abs(b.off) - Math.abs(a.off))
  const VISIBLE_CUTOFF = Math.min(7, n * 0.45)

  return (
    <div className="char-select">

      {/* ── Header */}
      <div className="cs-header">
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
        {isSolo && savedTeams.length > 0 && (
          <label className="cs-team-picker">
            <span>隊伍</span>
            <select value={savedTeams.find(t => t.id === defaultTeamId)?.id ?? ''}
              onChange={e => {
                if (e.target.value === '') {
                  setDefaultTeam(null)
                  loadTeam([])
                  return
                }
                const team = savedTeams.find(t => t.id === e.target.value)
                if (!team) return
                setDefaultTeam(team.id)
                loadTeam(team.charIds.filter(id => !logisticsBusyIds.includes(id)))
              }}>
              <option value="">自選</option>
              {savedTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </label>
        )}
      </div>

      {/* ── Carousel */}
      <div
        ref={carouselRef}
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
            >
              <CharPortrait
                id={c.id} size={CW} height={CH}
                style={{
                  width: '100%', height: '100%',
                  // Character art has varying aspect ratios. `cover` cropped the
                  // bottom of taller portraits, which cut off their feet.
                  objectFit: 'contain', objectPosition: 'bottom center',
                  borderRadius: 0, background: 'transparent',
                  display: 'block', pointerEvents: 'none',
                }}
              />
              {sel && selIdx >= 0 && (
                <span className="cs-pos" style={{ background: col }}>{'前中後'[selIdx]}</span>
              )}
            </div>
          )
        })}

        {/* Info button — bottom-right of carousel */}
        {focusedChar && (
          <button
            className="cs-info-btn"
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); setGalleryChar(focusedChar) }}
          >
            資訊
          </button>
        )}
      </div>

      {/* ── Nav arrows + current name */}
      <div className="cs-nav-hint">
        <button className="cs-nav-btn prev" onClick={() => setFocusIdx(prevIdx)}>
          <span className="cs-nav-arrow">‹</span>
          {prevChar && prevChar.id !== focusedChar?.id && (
            <span className="cs-nav-copy">
              <span className="cs-nav-direction">上一隻角色</span>
              <span className="cs-nav-adj-name" style={{ fontSize: adjNameSize(prevChar.name) }}>
                {prevChar.name}
              </span>
            </span>
          )}
        </button>
        <div className="cs-nav-label">
          <span className="cs-nav-cur-name">{focusedChar?.name ?? ''}</span>
        </div>
        <button className="cs-nav-btn next" onClick={() => setFocusIdx(nextIdx)}>
          <span className="cs-nav-arrow">›</span>
          {nextChar && nextChar.id !== focusedChar?.id && (
            <span className="cs-nav-copy">
              <span className="cs-nav-direction">下一隻角色</span>
              <span className="cs-nav-adj-name" style={{ fontSize: adjNameSize(nextChar.name) }}>
                {nextChar.name}
              </span>
            </span>
          )}
        </button>
      </div>

      {/* ── Confirm + Selected in one row */}
      <div className="cs-confirm-row">
        <button className="btn primary" disabled={!ready} onClick={() => onConfirm(selectedCharIds)}>
          確認選角 →
        </button>
        {!ready && selectedCharIds.length === 0 && <span className="hint">還需 3 位</span>}
        {selectedCharIds.map((id, i) => {
          const col  = ['#e85533', '#ddaa22', '#33aacc'][i]
          const char = allChars.find(c => c.id === id)
          if (!char) return null
          return (
            <span key={id} className="cs-chip" style={{ borderColor: `${col}66` }}
              onClick={() => onToggle(id)}>
              <b style={{ color: col }}>{'前中後'[i]}</b>
              {char.name}
            </span>
          )
        })}
      </div>

      <button className="btn flow-back-lobby" onClick={onBack}>← 返回大廳</button>

      {/* ── 大典 Gallery modal */}
      {galleryChar && (
        <CharGallery
          char={galleryChar}
          stars={characterStars[galleryChar.id] ?? 0}
          selectedIds={selectedCharIds}
          onToggle={onToggle}
          onClose={() => setGalleryChar(null)}
        />
      )}
    </div>
  )
}
