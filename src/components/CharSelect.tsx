import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { getChars } from '../utils/charStore'
import { CharPortrait } from './Admin'
import { moves as allMoves } from '../data/db'
import type { MoveSlot } from '../types/move'

const characters = getChars()

const EL_LABEL: Record<string, string> = { '劍': '⚔ 劍', '槍': '🔫 槍', '法': '✦ 魔' }

const SLOT_LABEL: Record<MoveSlot, string> = { '劍': '刀', '槍': '槍', '法': '法', '願': '願', '被': '被' }
const SLOT_COLOR: Record<MoveSlot, string> = { '劍': '#e85533', '槍': '#22cc77', '法': '#9955ee', '願': '#ddaa22', '被': '#888' }
const SUIT_DOT:  Record<string, string>    = { red: '🔴', green: '🟢', blue: '🔵', yellow: '🟡' }
const SUIT_OF:   Record<string, string>    = { '劍': 'red', '槍': 'green', '法': 'blue', '願': 'yellow' }
const RANGE_LBL: Record<string, string>    = { '劍': '近戰', '槍': '遠程', '法': '魔法' }

interface Props {
  onConfirm: (ids: string[]) => void
}

export default function CharSelect({ onConfirm }: Props) {
  const { selectedCharIds, toggleCharSelect, mySide, playerCount } = useGameStore()
  const ready = selectedCharIds.length === 3
  const [infoId, setInfoId] = useState<string | null>(null)

  const infoChar = infoId ? characters.find(c => c.id === infoId) : null
  const infoMoves = infoId ? allMoves.filter(m => m.ownerId === infoId) : []

  return (
    <div className="char-select" onClick={() => setInfoId(null)}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h2>選擇角色 — <span className={`side side-${mySide}`}>{mySide} 方</span></h2>
        <span className="hint">選 3 位（{selectedCharIds.length}/3）</span>
        {playerCount < 2 && <span className="waiting">等待對手…</span>}
      </div>

      <div className="char-grid">
        {characters.map(c => {
          const sel = selectedCharIds.includes(c.id)
          return (
            <div
              key={c.id}
              className={`char-card el-${c.element} ${sel ? 'selected' : ''}`}
              onClick={() => toggleCharSelect(c.id)}
              style={{ position: 'relative' }}
            >
              {/* ── Info button ── */}
              <button
                className="char-info-btn"
                onClick={e => { e.stopPropagation(); setInfoId(p => p === c.id ? null : c.id) }}
                title="查看招式資訊"
              >ⓘ</button>

              {/* ── Portrait ── */}
              <div className="char-portrait-box">
                <CharPortrait id={c.id} size={160}
                  style={{ width: '100%', height: '100%', borderRadius: 0, flexShrink: 0 }} />
                <div className={`char-portrait-el el-${c.element}-color`}>{EL_LABEL[c.element]}</div>
                {sel && <div className="char-portrait-check">✓</div>}
              </div>

              {/* ── Stats ── */}
              <div className="char-card-info">
                <div className="char-name">{c.name}</div>
                <div className="char-title">{c.title}</div>
                <div className="char-stats">
                  <div className="char-stat"><span>HP</span><b>{c.hp}</b></div>
                  <div className="char-stat"><span>ATK</span><b>{c.atk}</b></div>
                  <div className="char-stat"><span>DEF</span><b>{c.def}</b></div>
                  <div className="char-stat"><span>SPD</span><b>{c.spd}</b></div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Move info popover ── */}
      {infoChar && (
        <div className="char-info-overlay" onClick={e => e.stopPropagation()}>
          <div className="char-info-panel">
            <div className="char-info-hdr">
              <span className="char-info-name">{infoChar.name}</span>
              <button className="char-info-close" onClick={() => setInfoId(null)}>✕</button>
            </div>
            <div className="char-info-moves">
              {(['劍','槍','法','願','被'] as MoveSlot[]).map(slot => {
                const mv = infoMoves.find(m => m.slot === slot)
                if (!mv) return null
                const suitColor = SUIT_OF[slot]
                const dot       = suitColor ? SUIT_DOT[suitColor] : null
                const cost      = mv.condition ?? 1
                return (
                  <div key={slot} className="char-info-move">
                    <div className="cim-header">
                      <span className="cim-slot" style={{ color: SLOT_COLOR[slot] }}>
                        [{SLOT_LABEL[slot]}]
                      </span>
                      <span className="cim-name">{mv.name}</span>
                      <span className="cim-cost">
                        {dot ? `${dot}×${cost}` : '—'}
                      </span>
                      {mv.rangeType && (
                        <span className="cim-range">{RANGE_LBL[mv.rangeType]}</span>
                      )}
                      {mv.powerRatio && (
                        <span className="cim-power">威力 {mv.powerRatio}×</span>
                      )}
                    </div>
                    {mv.description && (
                      <div className="cim-desc">{mv.description}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Show 前/中/後 assignment per pick order (SA: 1st pick=前, 2nd=中, 3rd=後) */}
      {selectedCharIds.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
          {selectedCharIds.map((id, i) => {
            const label  = ['前', '中', '後'][i]
            const color  = [    '#e85533', '#ddaa22', '#33aacc'][i]
            const char   = characters.find(c => c.id === id)
            return (
              <span key={id} style={{ fontSize: 13 }}>
                {char?.name} → <b style={{ color }}>{label}</b>
              </span>
            )
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button className="btn primary" disabled={!ready} onClick={() => onConfirm(selectedCharIds)}>
          確認選角 →
        </button>
        {!ready && <span className="hint">還需 {3 - selectedCharIds.length} 位</span>}
      </div>
    </div>
  )
}
