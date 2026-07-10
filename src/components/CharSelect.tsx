import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { getChars } from '../utils/charStore'
import { CharPortrait } from './Admin'
import { moves as allMoves } from '../data/db'
import type { MoveSlot } from '../types/move'

type ElFilter = '劍' | '槍' | '法' | 'all'

const EL_COLOR: Record<string, string> = { '劍': '#e87733', '槍': '#22cc77', '法': '#9955ee' }
const EL_LABEL: Record<string, string> = { '劍': '⚔ 劍', '槍': '🔫 槍', '法': '✦ 法' }

const SLOT_LABEL: Record<MoveSlot, string> = { '劍': '刀', '槍': '槍', '法': '法', '願': '願', '被': '被' }
const SLOT_COLOR: Record<MoveSlot, string> = { '劍': '#e85533', '槍': '#22cc77', '法': '#9955ee', '願': '#ddaa22', '被': '#888' }
const SUIT_DOT:  Record<string, string>    = { red: '🔴', green: '🟢', blue: '🔵', yellow: '🟡' }
const SUIT_OF:   Record<string, string>    = { '劍': 'red', '槍': 'green', '法': 'blue', '願': 'yellow' }
const RANGE_LBL: Record<string, string>    = { '劍': '近戰', '槍': '遠程', '法': '魔法' }

const DISC = 360   // container px
const CX   = DISC / 2
const CY   = DISC / 2
const PORT = 72    // portrait diameter

function discR(n: number) {
  if (n <= 5)  return 100
  if (n <= 9)  return 128
  return 148
}

interface Props {
  onConfirm: (ids: string[]) => void
  onToggle:  (id: string) => void
}

export default function CharSelect({ onConfirm, onToggle }: Props) {
  const characters = getChars()
  const { selectedCharIds, mySide, playerCount } = useGameStore()
  const ready = selectedCharIds.length === 3
  const [elFilter, setElFilter] = useState<ElFilter>('all')
  const [infoId,   setInfoId]   = useState<string | null>(null)

  const filtered = characters.filter(c => elFilter === 'all' || c.element === elFilter)
  const n = filtered.length
  const R = discR(n)

  const infoChar  = infoId ? characters.find(c => c.id === infoId)! : null
  const infoMoves = infoId ? allMoves.filter(m => m.ownerId === infoId) : []

  return (
    <div className="char-select" onClick={() => setInfoId(null)}>
      {/* ── Header ─────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>選擇角色 — <span className={`side side-${mySide}`}>{mySide} 方</span></h2>
        <span className="hint">選 3 位（{selectedCharIds.length}/3）</span>
        {playerCount < 2 && <span className="waiting">等待對手…</span>}
      </div>

      {/* ── Element filter bar ──────────────────── */}
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

      {/* ── Disc ────────────────────────────────── */}
      <div className="cs-disc-wrap">
        <div className="cs-disc" style={{ width: DISC, height: DISC }}>

          {/* Decorative rings */}
          <div className="cs-ring" style={{ width: R * 2 + PORT + 4, height: R * 2 + PORT + 4 }} />
          <div className="cs-ring" style={{ width: R * 1.1,         height: R * 1.1, opacity: .35 }} />
          <div className="cs-ring" style={{ width: 86,              height: 86,      opacity: .5 }} />

          {/* Spoke lines to each character */}
          {filtered.map((_, i) => {
            const ang = (i / n) * 360 - 90
            return (
              <div
                key={i}
                className="cs-spoke"
                style={{
                  width: R,
                  left:  CX,
                  top:   CY,
                  transform: `rotate(${ang}deg)`,
                  transformOrigin: '0 50%',
                }}
              />
            )
          })}

          {/* Center count */}
          <div className="cs-disc-center">
            {selectedCharIds.length === 0
              ? <div className="cs-c-hint">選角</div>
              : <div className="cs-c-count">
                  {selectedCharIds.length}<span className="cs-c-max">/3</span>
                </div>
            }
          </div>

          {/* Character portraits */}
          {filtered.map((c, i) => {
            const ang   = (i / n) * Math.PI * 2 - Math.PI / 2
            const x     = Math.cos(ang) * R + CX
            const y     = Math.sin(ang) * R + CY
            const sel   = selectedCharIds.includes(c.id)
            const idx   = selectedCharIds.indexOf(c.id)
            const pos   = idx >= 0 ? '前中後'[idx] : null
            const col   = EL_COLOR[c.element]

            return (
              <div
                key={c.id}
                className={`cs-char ${sel ? 'selected' : ''}`}
                style={{
                  left:  x - PORT / 2,
                  top:   y - PORT / 2,
                  width:  PORT,
                  height: PORT,
                  '--ecol': col,
                } as React.CSSProperties}
                onClick={e => { e.stopPropagation(); onToggle(c.id) }}
                onDoubleClick={e => { e.stopPropagation(); setInfoId(p => p === c.id ? null : c.id) }}
                title={`${c.name}（雙擊查看招式）`}
              >
                <div className="cs-char-port">
                  <CharPortrait id={c.id} size={PORT}
                    style={{ width: '100%', height: '100%', borderRadius: '50%', display: 'block', flexShrink: 0 }}
                  />
                </div>
                {pos && (
                  <span className="cs-pos" style={{ background: col }}>{pos}</span>
                )}
                <span className="cs-name">{c.name}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Selected strip ──────────────────────── */}
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

      {/* ── Move info popover (double-click) ─────── */}
      {infoChar && (
        <div className="char-info-overlay" onClick={() => setInfoId(null)}>
          <div className="char-info-panel" onClick={e => e.stopPropagation()}>
            <div className="char-info-hdr">
              <span className="char-info-name">{infoChar.name}</span>
              <button className="char-info-close" onClick={() => setInfoId(null)}>✕</button>
            </div>
            <div className="char-info-moves">
              {(['劍', '槍', '法', '願', '被'] as MoveSlot[]).map(slot => {
                const mv = infoMoves.find(m => m.slot === slot)
                if (!mv) return null
                const dot = SUIT_DOT[SUIT_OF[slot]] ?? null
                return (
                  <div key={slot} className="char-info-move">
                    <div className="cim-header">
                      <span className="cim-slot" style={{ color: SLOT_COLOR[slot] }}>[{SLOT_LABEL[slot]}]</span>
                      <span className="cim-name">{mv.name}</span>
                      <span className="cim-cost">{dot ? `${dot}×${mv.condition ?? 1}` : '—'}</span>
                      {mv.rangeType  && <span className="cim-range">{RANGE_LBL[mv.rangeType]}</span>}
                      {mv.powerRatio && <span className="cim-power">威力 {mv.powerRatio}×</span>}
                    </div>
                    {mv.description && <div className="cim-desc">{mv.description}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm ─────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button className="btn primary" disabled={!ready} onClick={() => onConfirm(selectedCharIds)}>
          確認選角 →
        </button>
        {!ready && <span className="hint">還需 {3 - selectedCharIds.length} 位</span>}
      </div>
    </div>
  )
}
