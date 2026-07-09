import { useEffect, useRef, useState, useCallback } from 'react'
import { useGameStore } from '../store/gameStore'
import type { Unit } from '../types/unit'
import type { Card } from '../types/card'
import type { MoveSlot } from '../types/move'
import { getReadyUnits } from '../engine/atb'
import ScorePanel from './ScorePanel'
import { getCharImg } from '../utils/charStore'

const DIST_COLOR: Record<string, string> = { '前': '#e85533', '中': '#ddaa22', '後': '#33aacc' }

// SA: slot2 always = 中; frontSlot(A)=3, frontSlot(B)=1
function getSlotLabel(side: 'A' | 'B', slot: number): string {
  if (slot === 2) return '中'
  return slot === (side === 'A' ? 3 : 1) ? '前' : '後'
}
// depth 0=front(bottom) … 2=back(top); used for staircase height
function slotDepth(side: 'A' | 'B', slot: number): number {
  return side === 'A' ? 3 - slot : slot - 1
}
const EL_COLOR: Record<string, string> = { sword: '#e87733', gun: '#22cc77', magic: '#9955ee' }
const SUIT_CLS: Record<string, string>  = { red: 'suit-red', green: 'suit-green', blue: 'suit-blue', yellow: 'suit-yellow', flower: 'suit-flower' }
const MOVE_SLOTS: MoveSlot[] = ['sword', 'gun', 'magic', 'wish']
const SLOT_LABEL: Record<MoveSlot, string> = { sword: '刀', gun: '槍', magic: '法', wish: '願', passive: '' }
const SLOT_COLOR: Record<MoveSlot, string> = { sword: '#e87733', gun: '#22cc77', magic: '#9955ee', wish: '#ddaa22', passive: '#666' }
const SUIT_FOR: Record<string, string> = { sword: 'red', gun: 'green', magic: 'blue', wish: 'yellow' }

interface Props {
  onPlayCard:    (cardId: string) => void
  onMoveUnit:    (unitId: string, toSlot: 1|2|3) => void
  onExecuteMove: (unitId: string, moveSlot: MoveSlot, targetId: string|null) => void
  onPass:        (unitId: string) => void
  onToggleAuto:  () => void
  onEnd:         () => void
  onSoloReplay?: () => void
}

interface MoveAnim {
  img: string | null
  name: string
  charName: string
  color: string
}

export default function BattleView({ onPlayCard, onMoveUnit, onExecuteMove, onPass, onToggleAuto, onEnd, onSoloReplay }: Props) {
  const { game, mySide, isSolo, isAIBattle, soloScore } = useGameStore()
  const logRef      = useRef<HTMLDivElement>(null)
  const animTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selectingTarget, setSelectingTarget] = useState<MoveSlot|null>(null)
  const [moveAnim,  setMoveAnim]  = useState<MoveAnim | null>(null)
  const [animKey,   setAnimKey]   = useState(0)
  // pending destination slot per unit (preview before confirming with a skill/pass)
  const [pendingSlots, setPendingSlots] = useState<Record<string, 1|2|3>>({})

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [game?.log.length])

  // Watch log for moveAnim entries (triggers for ALL moves incl. AI)
  useEffect(() => {
    if (!game) return
    const last = game.log[game.log.length - 1]
    if (!last?.moveAnim) return
    const { moveId, moveName, moveSlot, charName } = last.moveAnim
    const img = localStorage.getItem(`cb_move_img_${moveId}`)
    if (!img) return   // only show overlay if image exists
    if (animTimer.current) clearTimeout(animTimer.current)
    setMoveAnim({ img, name: moveName, charName, color: SLOT_COLOR[moveSlot as MoveSlot] ?? '#aaa' })
    setAnimKey(k => k + 1)
    animTimer.current = setTimeout(() => setMoveAnim(null), 1900)
  }, [game?.log.length])

  if (!game) return null

  const myTeam    = mySide === 'A' ? game.teamA : game.teamB
  const enemyTeam = mySide === 'A' ? game.teamB : game.teamA
  const myHand    = mySide === 'A' ? game.handA : game.handB
  const myCustomLeft = mySide === 'A' ? game.customDeckOrder.length : game.customDeckOrderB.length
  const oppSide = mySide === 'A' ? 'B' : 'A'

  const readyUnits = getReadyUnits(game).filter(u => u.side === mySide)
  const isAutoMe  = mySide === 'A' ? game.autoBattleA : game.autoBattleB
  const isAutoOpp = mySide === 'A' ? game.autoBattleB : game.autoBattleA

  const triggerAnim = useCallback((unit: Unit, slot: MoveSlot) => {
    const move = unit.moves[slot]; if (!move) return
    const img  = localStorage.getItem(`cb_move_img_${move.id}`)
    if (animTimer.current) clearTimeout(animTimer.current)
    // Always show overlay for player actions (img may be null → shows ⚡ fallback)
    setMoveAnim({ img, name: move.name, charName: unit.name, color: SLOT_COLOR[slot] })
    setAnimKey(k => k + 1)
    animTimer.current = setTimeout(() => setMoveAnim(null), 1900)
  }, [])

  const suitInHand: Record<string, number> = { red: 0, green: 0, blue: 0, yellow: 0 }
  for (const c of myHand) if (c.color in suitInHand) suitInHand[c.color]++
  const flowerHand = myHand.filter(c => !c.isSuitCard)

  const atbQueue = [...game.teamA, ...game.teamB]
    .filter(u => u.alive)
    .sort((a, b) => a.nextActionAt - b.nextActionAt)

  if (game.phase === 'end') {
    if (isAIBattle) {
      const label =
        game.winner === 'A' ? '🤖 A 方勝利！' :
        game.winner === 'B' ? '🤖 B 方勝利！' : '⚖ 平局'
      return (
        <div className="battle-end">
          <h2 style={{ fontSize: '2rem' }}>{label}</h2>
          <p>{game.winnerReason}</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn primary" onClick={onSoloReplay ?? onEnd}>再看一局</button>
            <button className="btn"         onClick={onEnd}>返回大廳</button>
          </div>
        </div>
      )
    }
    if (isSolo) {
      if (!soloScore) return <div className="battle-end"><p style={{ color: '#c8a15a' }}>計算評分中…</p></div>
      return (
        <ScorePanel
          result={soloScore}
          onReplay={onSoloReplay ?? onEnd}
          onBack={onEnd}
        />
      )
    }
    const result = game.winner === mySide ? '🏆 勝利！' : game.winner === 'draw' ? '⚖ 平局' : '💀 落敗'
    return (
      <div className="battle-end">
        <h2>{result}</h2>
        <p>{game.winnerReason}</p>
        <button className="btn primary" onClick={onEnd}>再玩一局</button>
      </div>
    )
  }

  const getPendingSlot = (unit: Unit): 1|2|3 => pendingSlots[unit.id] ?? unit.slot

  const applyPendingMove = (unit: Unit) => {
    const pending = getPendingSlot(unit)
    if (pending !== unit.slot) onMoveUnit(unit.id, pending)
    setPendingSlots(prev => { const n = {...prev}; delete n[unit.id]; return n })
  }

  const handleMoveClick = (unit: Unit, slot: MoveSlot) => {
    const move = unit.moves[slot]
    if (!move) return
    applyPendingMove(unit)
    if (move.scope === 'group' || !move.rangeType) {
      triggerAnim(unit, slot)
      onExecuteMove(unit.id, slot, null)
      setSelectingTarget(null)
    } else {
      setSelectingTarget(slot)
    }
  }

  const handleTargetClick = (target: Unit) => {
    const active = readyUnits[0]
    if (!active || !selectingTarget) return
    applyPendingMove(active)
    triggerAnim(active, selectingTarget)
    onExecuteMove(active.id, selectingTarget, target.id)
    setSelectingTarget(null)
  }

  return (
    <div className="battle">
      {/* ── Move animation overlay ── */}
      {moveAnim && (
        <div className="move-anim-overlay" key={animKey}>
          {moveAnim.img
            ? <img src={moveAnim.img} className="move-anim-img" alt="" />
            : <div className="move-anim-no-img" style={{ color: moveAnim.color }}>⚡</div>
          }
          <div className="move-anim-name" style={{ color: moveAnim.color }}>{moveAnim.name}</div>
          <div className="move-anim-char">{moveAnim.charName}</div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="battle-header">
        <div className="bh-item">第 <b>{game.round}</b> 回合</div>
        <div className="bh-item bh-sep">時鐘 <b>{game.clock}</b></div>
        <div className="bh-item bh-sep">牌庫 <b>{game.drawPublic.length}</b> · 棄牌 <b>{game.discardPublic.length}</b></div>
        <div style={{ flex: 1 }} />
        {isAIBattle
          ? <span style={{ fontSize: 12, color: '#9955ee', letterSpacing: 1 }}>🤖 AI 對戰觀戰中</span>
          : <>
              <label className="auto-check">
                <input type="checkbox" checked={isAutoMe} onChange={onToggleAuto} />
                自動（{mySide}）
              </label>
              {!isSolo && (
                <label className="auto-check" style={{ opacity: .45 }}>
                  <input type="checkbox" checked={isAutoOpp} readOnly />
                  自動（{oppSide}）
                </label>
              )}
            </>
        }
      </div>

      {/* ── ATB Queue ── */}
      <div className="atb-queue">
        <span className="atb-label">行動順序</span>
        {atbQueue.map(u => {
          const ticks = Math.max(0, u.nextActionAt - game.clock)
          const ready = ticks === 0
          return (
            <div key={u.id} className={`atb-chip atb-${u.side} ${ready ? 'atb-ready' : ''}`}>
              <span style={{ color: EL_COLOR[u.element], fontSize: 8 }}>⬥</span>
              {u.name}
              <span className="atb-t">{ready ? '⚡' : `${Math.ceil(ticks / 10)}s`}</span>
            </div>
          )
        })}
      </div>

      {/* ── Battle main: spotlight | 我方 | 敵方 ── */}
      <div className="battle-main">

        {/* 戰場兩側 */}
        <div className="battle-sides">

          {/* 我方 */}
          <div className="battle-side my-side">
            <div className="side-hdr">
              <span className={`side-badge side-${mySide}`}>{mySide} 方</span>
              <span className="side-meta">手牌 {myHand.length} · 自訂剩 {myCustomLeft}</span>
            </div>
            {/* 後=左+頂, 前=右+底 (A:slot1=後,B:slot1=前) — column order [1,2,3], height by slotDepth */}
            <div className="slots-row">
              {([1,2,3] as const).map(slot => (
                <div key={slot} className="slot-col" style={{ transform: `translateY(${-slotDepth(mySide ?? 'A', slot) * 28}px)` }}>
                  <div className="slot-name" style={{ color: DIST_COLOR[getSlotLabel(mySide ?? 'A', slot)] }}>{getSlotLabel(mySide ?? 'A', slot)}</div>
                  {myTeam.filter(u => getPendingSlot(u) === slot).map(u => {
                    const isActive = !isAIBattle && readyUnits[0]?.id === u.id
                    return (
                      <UnitCard key={u.id} unit={u} clock={game.clock}
                        selectable={isActive && !selectingTarget}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* 敵方 */}
          <div className="battle-side enemy-side">
            <div className="side-hdr">
              <span className={`side-badge side-${oppSide}`}>{oppSide} 方</span>
              {selectingTarget && <span className="pick-target-hint">← 點選目標</span>}
            </div>
            <div className="slots-row">
              {([1,2,3] as const).map(slot => (
                <div key={slot} className="slot-col" style={{ transform: `translateY(${-slotDepth(oppSide, slot) * 28}px)` }}>
                  <div className="slot-name" style={{ color: DIST_COLOR[getSlotLabel(oppSide, slot)] }}>{getSlotLabel(oppSide, slot)}</div>
                  {enemyTeam.filter(u => u.slot === slot).map(u => (
                    <UnitCard
                      key={u.id} unit={u} clock={game.clock}
                      onClick={selectingTarget && u.alive ? () => handleTargetClick(u) : undefined}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Action panels — always shows first-in-ATB-order unit ── */}
      {!isAIBattle && readyUnits.length > 0 && (() => {
        const activeUnit = readyUnits[0]
        const waitingUnits = readyUnits.slice(1)
        return (
          <div className="action-area">
            {/* Waiting queue — other ready units */}
            {waitingUnits.length > 0 && (
              <div className="rup-queue">
                <span className="rup-queue-label">待機</span>
                {waitingUnits.map(u => (
                  <div key={u.id} className="rup-queue-chip">
                    <span style={{ color: EL_COLOR[u.element] }}>⬥</span>
                    <span>{u.name}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Active unit panel */}
            <ReadyUnitPanel
              key={activeUnit.id}
              unit={activeUnit}
              clock={game.clock}
              suitInHand={suitInHand}
              flowerHand={flowerHand}
              isOpen={true}
              selectingTarget={selectingTarget}
              pendingSlot={getPendingSlot(activeUnit)}
              onToggle={() => {}}
              onMove={slot => handleMoveClick(activeUnit, slot)}
              onPendingMove={s => setPendingSlots(prev => ({ ...prev, [activeUnit.id]: s }))}
              onPass={() => { applyPendingMove(activeUnit); onPass(activeUnit.id); setSelectingTarget(null) }}
              onPlayCard={onPlayCard}
            />
          </div>
        )
      })()}

      {/* ── Bottom row: log (left) + hand panel (right) ── */}
      <div className="battle-bottom">
        <div className="log-panel" ref={logRef}>
          {game.log.slice(-80).map((l, i) => (
            <div key={i} className="log-line" dangerouslySetInnerHTML={{ __html: l.html }} />
          ))}
        </div>
        {!isAIBattle && (
          <HandPanel suitInHand={suitInHand} flowerHand={flowerHand} onPlayCard={onPlayCard} />
        )}
      </div>
    </div>
  )
}

// ─── UnitCard ────────────────────────────────────────────────────────────────

function UnitCard({ unit, clock, onClick, selectable }: { unit: Unit; clock: number; onClick?: () => void; selectable?: boolean }) {
  const pct     = unit.alive ? (unit.hp / unit.maxHp) * 100 : 0
  const ticks   = Math.max(0, unit.nextActionAt - clock)
  const ready   = ticks === 0 && unit.alive
  const hpColor = pct > 60 ? '#22cc66' : pct > 30 ? '#ccaa22' : '#cc3333'
  const img     = getCharImg(unit.characterId)

  return (
    <div
      className={`unit-card ${!unit.alive ? 'dead' : ''} ${ready ? 'uc-ready' : ''} ${selectable ? 'selectable' : (onClick ? 'targetable' : '')}`}
      onClick={onClick}
    >
      {img
        ? (
          <div className="uc-portrait" style={{ backgroundImage: `url(${img})` }}>
            <span className="uc-portrait-name" style={{ color: EL_COLOR[unit.element] }}>{unit.name}</span>
            {!unit.alive && <div className="uc-dead-overlay">陣亡</div>}
          </div>
        )
        : <div className="unit-card-name" style={{ color: EL_COLOR[unit.element] }}>{unit.name}</div>
      }
      <div className="hp-bar-wrap">
        <div className="hp-bar" style={{ width: `${pct}%`, background: hpColor }} />
      </div>
      <div className="unit-card-row">
        <span className="uc-hp">{unit.alive ? `${unit.hp}/${unit.maxHp}` : '倒下'}</span>
        <span className={`uc-timer ${ready ? 'uc-timer-ready' : ''}`}>
          {ready ? '⚡ 行動' : `${Math.ceil(ticks / 10)}s`}
        </span>
      </div>
      {unit.statuses.length > 0 && (
        <div className="status-chips">
          {unit.statuses.map((s, i) => <span key={i} className="status-chip">{s.key}</span>)}
        </div>
      )}
    </div>
  )
}

// ─── ReadyUnitPanel ──────────────────────────────────────────────────────────

function ReadyUnitPanel({ unit, clock, suitInHand, flowerHand, isOpen, selectingTarget,
  pendingSlot, onToggle, onMove, onPendingMove, onPass, onPlayCard }: {
  unit: Unit; clock: number
  suitInHand: Record<string, number>; flowerHand: Card[]
  isOpen: boolean; selectingTarget: MoveSlot|null
  pendingSlot: 1|2|3
  onToggle: () => void; onMove: (s: MoveSlot) => void
  onPendingMove: (s: 1|2|3) => void; onPass: () => void
  onPlayCard: (id: string) => void
}) {
  const pendingLabel = getSlotLabel(unit.side, pendingSlot)
  const moved = pendingSlot !== unit.slot
  return (
    <div className="rup">
      <div className="rup-hdr" onClick={onToggle}>
        <b style={{ color: EL_COLOR[unit.element] }}>{unit.name}</b>
        <span className="rup-pos">
          {moved
            ? <>{getSlotLabel(unit.side, unit.slot)} → <b style={{ color: DIST_COLOR[pendingLabel] }}>{pendingLabel}</b></>
            : <>目前在 {getSlotLabel(unit.side, unit.slot)}</>
          }
        </span>
        <span className="rup-chev">{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <div className="rup-body">
          {selectingTarget && <div className="target-hint">↑ 點選上方敵方角色</div>}

          <div className="rup-cols">
            {/* Left: position buttons + PASS */}
            <div className="rup-left">
              <div className="section-label" style={{ marginBottom: 4 }}>移動</div>
              {([1,2,3] as (1|2|3)[]).map(s => {
                const tooFar = Math.abs(s - unit.slot) > 1
                const label = getSlotLabel(unit.side, s)
                return (
                  <button key={s}
                    className={`btn sm ${pendingSlot === s ? 'primary' : ''}`}
                    disabled={tooFar}
                    onClick={() => !tooFar && onPendingMove(s)}>
                    {label}
                  </button>
                )
              })}
              <button className="btn danger rup-pass" onClick={onPass}>PASS</button>
            </div>

            {/* Right: skill image cards + flower cards */}
            <div className="rup-right">
              <div className="rup-skills-grid">
                {MOVE_SLOTS.map(slot => {
                  const move = unit.moves[slot]
                  if (!move) return null
                  const sKey   = SUIT_FOR[slot]
                  const have   = sKey ? (suitInHand[sKey] ?? 0) : 999
                  const lib    = unit.statuses.some(s => s.key === 'liberated')
                  const need   = lib ? 1 : (move.condition ?? 1)
                  const canUse = !sKey || have >= need
                  const onCD   = (unit.moveCooldownUntil[move.id] ?? 0) > clock
                  const ok     = canUse && !onCD
                  const skillImg = localStorage.getItem(`cb_move_img_${move.id}`)

                  return (
                    <button
                      key={slot}
                      className={`btn skill-btn ${!ok ? 'skill-dim' : ''}`}
                      style={{ borderColor: ok ? SLOT_COLOR[slot] : '#2a2a3e' }}
                      onClick={() => ok && onMove(slot)}
                      title={move.description}
                    >
                      {skillImg && (
                        <div className="skill-img-wrap">
                          <img src={skillImg} className="skill-img" alt="" />
                          {onCD && <span className="skill-cd-overlay">CD</span>}
                        </div>
                      )}
                      <div className="skill-top">
                        <span style={{ color: ok ? SLOT_COLOR[slot] : '#444', fontWeight: 800 }}>
                          {SLOT_LABEL[slot]}
                        </span>
                        {sKey && (
                          <span className={canUse ? 'skill-ok' : 'skill-ng'}>{have}/{need}</span>
                        )}
                        {!skillImg && onCD && <span className="skill-cd">CD</span>}
                      </div>
                      <div className="skill-name">{move.name}</div>
                    </button>
                  )
                })}
              </div>

              {/* Flower hand */}
              {flowerHand.length > 0 && (
                <div className="rup-flowers">
                  <div className="section-label" style={{ marginBottom: 3 }}>花牌</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {flowerHand.map((c, i) => (
                      <CardChip key={`${c.id}-${i}`} card={c} onClick={() => onPlayCard(c.id)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── HandPanel ───────────────────────────────────────────────────────────────

const HP_ICON: Record<string, string>  = { red: '劍', green: '槍', blue: '法', yellow: '院' }

function HandPanel({ suitInHand, flowerHand, onPlayCard }: {
  suitInHand: Record<string, number>
  flowerHand: Card[]
  onPlayCard: (id: string) => void
}) {
  // group flower cards by name so same cards stack
  const flowerGroups = flowerHand.reduce<Record<string, { card: Card; count: number }>>((acc, c) => {
    if (!acc[c.name]) acc[c.name] = { card: c, count: 0 }
    acc[c.name].count++
    return acc
  }, {})

  return (
    <div className="hand-panel">
      <div className="hp-label">手牌</div>
      <div className="hp-chips">
        {(['red','green','blue','yellow'] as const).map(suit => {
          const count = suitInHand[suit] ?? 0
          return (
            <div key={suit} className={`hp-chip hp-${suit}${count === 0 ? ' hp-empty' : ''}`}>
              <span className="hp-icon">{HP_ICON[suit]}</span>
              <span className="hp-count">{count}</span>
            </div>
          )
        })}
        {Object.values(flowerGroups).map(({ card, count }) => (
          <div key={card.name} className="hp-chip hp-flower"
               onClick={() => onPlayCard(card.id)}>
            <span className="hp-icon">花</span>
            <span className="hp-name">{card.name}</span>
            <span className="hp-count">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── CardChip ────────────────────────────────────────────────────────────────

function CardChip({ card, onClick }: { card: Card; onClick: () => void }) {
  return (
    <div className={`card-chip ${SUIT_CLS[card.color] ?? ''}`} onClick={onClick}
         title={card.description ?? ''}>
      <span className="card-name">{card.name}</span>
      {!card.isSuitCard && <span className="card-badge">花</span>}
    </div>
  )
}
