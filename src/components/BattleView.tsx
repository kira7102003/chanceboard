import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import type { Unit } from '../types/unit'
import type { Card } from '../types/card'
import type { MoveSlot } from '../types/move'
import { getReadyUnits } from '../engine/atb'
import ScorePanel from './ScorePanel'
import { getCharImg, getCharWideImg, getMoveImg } from '../utils/charStore'

const DIST_COLOR: Record<string, string> = { '近': '#e85533', '中': '#ddaa22', '遠': '#33aacc' }

// Both sides: slot1=近(front), slot2=中, slot3=遠(back)
function getSlotLabel(_side: 'A' | 'B', slot: number): string {
  if (slot === 1) return '近'
  if (slot === 2) return '中'
  return '遠'
}
// depth 0=front/bottom(近), 2=back/top(遠); same for both sides
function slotDepth(_side: 'A' | 'B', slot: number): number {
  return slot - 1
}
const EL_COLOR: Record<string, string> = { '劍': '#e87733', '槍': '#22cc77', '法': '#9955ee' }
const SUIT_CLS: Record<string, string>  = { red: 'suit-red', green: 'suit-green', blue: 'suit-blue', yellow: 'suit-yellow', flower: 'suit-flower' }
const MOVE_SLOTS: MoveSlot[] = ['劍', '槍', '法', '願']
const SLOT_LABEL: Record<MoveSlot, string> = { '劍': '刀', '槍': '槍', '法': '法', '願': '願', '被': '' }
const SLOT_COLOR: Record<MoveSlot, string> = { '劍': '#e87733', '槍': '#22cc77', '法': '#9955ee', '願': '#ddaa22', '被': '#666' }
const SUIT_FOR: Record<string, string> = { '劍': 'red', '槍': 'green', '法': 'blue', '願': 'yellow' }

interface Props {
  onPlayCard:    (cardId: string) => void
  onDiscardCard: (cardId: string) => void
  onMoveUnit:    (unitId: string, toSlot: 1|2|3) => void
  onExecuteMove: (unitId: string, moveSlot: MoveSlot, targetId: string|null) => void
  onPass:        (unitId: string) => void
  onToggleAuto:  () => void
  onEnd:         () => void
  onSoloReplay?: () => void
  bgUrl?:        string | null
}

interface MoveAnim {
  img: string | null
  name: string
  charName: string
  charImg: string | null
  attackerSide: 'A' | 'B'
  targetName: string | null
  targetCharImg: string | null
  targetUnitId: string | null
  isGroup: boolean
  groupTargets: Array<{ name: string; charImg: string | null }>
  color: string
}

export default function BattleView({ onPlayCard, onDiscardCard, onMoveUnit, onExecuteMove, onPass, onToggleAuto, onEnd, onSoloReplay, bgUrl }: Props) {
  const { game, mySide, isSolo, isAIBattle, soloScore, autoSpeed, setAutoSpeed } = useGameStore()
  const logRef         = useRef<HTMLDivElement>(null)
  const animTimer      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAnimIdx    = useRef(-1)
  const [moveAnim,  setMoveAnim]  = useState<MoveAnim | null>(null)
  const [animKey,   setAnimKey]   = useState(0)
  // pending destination slot per unit (preview before confirming with a skill/pass)
  const [pendingSlots, setPendingSlots] = useState<Record<string, 1|2|3>>({})
  // preview: clicking a non-active own unit shows their moves read-only
  const [previewUnitId, setPreviewUnitId] = useState<string | null>(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [game?.log.length])

  // Watch log for moveAnim entries (triggers for ALL moves incl. AI)
  // Scan all NEW entries (not just the last) because a single tick can push many log lines
  useEffect(() => {
    if (!game) return
    const start = lastAnimIdx.current + 1
    for (let i = start; i < game.log.length; i++) {
      const entry = game.log[i]
      if (!entry.moveAnim) continue
      lastAnimIdx.current = i
      const { moveId, moveName, moveSlot, charName, charId, attackerSide, targetName, targetCharId, targetUnitId, groupTargets } = entry.moveAnim
      const img = getMoveImg(moveId)
      const charImg = charId ? (getCharWideImg(charId) ?? getCharImg(charId)) : null
      const targetCharImg = targetCharId ? (getCharWideImg(targetCharId) ?? getCharImg(targetCharId)) : null
      const resolvedGroupTargets = groupTargets?.map(t => ({
        name: t.name,
        charImg: t.charId ? (getCharWideImg(t.charId) ?? getCharImg(t.charId)) : null,
      })) ?? []
      if (animTimer.current) clearTimeout(animTimer.current)
      setMoveAnim({
        img,
        name: moveName, charName, charImg,
        attackerSide: attackerSide ?? 'A',
        targetName: targetName ?? null, targetCharImg,
        targetUnitId: targetUnitId ?? null,
        isGroup: !targetName,
        groupTargets: resolvedGroupTargets,
        color: SLOT_COLOR[moveSlot as MoveSlot] ?? '#aaa',
      })
      setAnimKey(k => k + 1)
      animTimer.current = setTimeout(() => setMoveAnim(null), 1900)
      break // show only the first new moveAnim per batch
    }
  }, [game?.log.length])

  if (!game) return null

  const myTeam    = mySide === 'A' ? game.teamA : game.teamB
  const enemyTeam = mySide === 'A' ? game.teamB : game.teamA
  const previewUnit = previewUnitId ? myTeam.find(u => u.id === previewUnitId && u.alive) ?? null : null
  const myHand    = mySide === 'A' ? game.handA : game.handB
  const myCustomLeft = mySide === 'A' ? game.customDeckOrder.length : game.customDeckOrderB.length
  const oppSide = mySide === 'A' ? 'B' : 'A'

  const readyUnits = getReadyUnits(game).filter(u => u.side === mySide)
  const isAutoMe  = mySide === 'A' ? game.autoBattleA : game.autoBattleB
  const isAutoOpp = mySide === 'A' ? game.autoBattleB : game.autoBattleA


  const suitInHand: Record<string, number> = { red: 0, green: 0, blue: 0, yellow: 0 }
  for (const c of myHand) if (c.color in suitInHand) suitInHand[c.color]++

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
    onExecuteMove(unit.id, slot, null)
  }

  return (
    <div className="battle">
      {bgUrl && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
          backgroundImage: `url(${bgUrl})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          opacity: 0.5,
        }} />
      )}
      {/* ── Move animation overlay — directional ── */}
      {moveAnim && (() => {
        const atkLeft   = moveAnim.attackerSide === 'A'   // A side is on the left
        const atkFlip   = !atkLeft                         // B attacker faces left (flip)
        const defFlip   = atkLeft                          // B defender faces left (flip)

        const Portrait = ({ img, name, flip }: { img: string|null; name: string; flip: boolean }) => (
          <>
            {img
              ? <img src={img} className="ma-portrait" alt=""
                  style={flip ? { transform: 'scaleX(-1)' } : undefined} />
              : <div className="ma-no-img">{name[0]}</div>
            }
            <div className="ma-char-name">{name}</div>
          </>
        )

        const AttackerZone = (
          <div className="ma-zone-attacker">
            <Portrait img={moveAnim.charImg} name={moveAnim.charName} flip={atkFlip} />
          </div>
        )

        const TargetZone = (
          <div className="ma-zone-target">
            {moveAnim.isGroup && moveAnim.groupTargets.length > 0
              ? (
                <div className="ma-group-row">
                  {moveAnim.groupTargets.map((t, i) => (
                    <div key={i}>
                      <Portrait img={t.charImg} name={t.name} flip={defFlip} />
                    </div>
                  ))}
                </div>
              )
              : moveAnim.targetName
                ? <Portrait img={moveAnim.targetCharImg} name={moveAnim.targetName} flip={defFlip} />
                : <div className="ma-no-img" style={{ opacity: .15 }}>⚔</div>
            }
          </div>
        )

        return (
          <div className="move-anim-overlay" key={animKey}>
            <div className="ma-battle-row">
              {atkLeft ? AttackerZone : TargetZone}

              <div className="ma-zone-skill">
                <div className={`ma-skill-wrap ${atkLeft ? 'ma-slide-ab' : 'ma-slide-ba'}`}>
                  {moveAnim.img
                    ? <img src={moveAnim.img} className="ma-skill-img" alt=""
                        style={{ filter: `drop-shadow(0 0 18px ${moveAnim.color}cc)` }} />
                    : <div className="ma-skill-empty" style={{ color: moveAnim.color }}>⚡</div>
                  }
                </div>
                <div className="ma-skill-name" style={{ color: moveAnim.color }}>{moveAnim.name}</div>
              </div>

              {atkLeft ? TargetZone : AttackerZone}
            </div>
          </div>
        )
      })()}

      {/* ── Header ── */}
      <div className="battle-header">
        <div className="bh-item">第 <b>{game.round}</b> 回合</div>
        <div className="bh-item bh-sep bh-timer">
          <span className="bh-timer-secs">{10 - Math.floor((game.clock % 100) / 10)}</span>s
        </div>
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
        {(isAutoMe || isAIBattle) && (
          <button className="auto-speed-btn" onClick={() => {
            const speeds: (1|2|4)[] = [1, 2, 4]
            const idx = speeds.indexOf(autoSpeed)
            setAutoSpeed(speeds[(idx + 1) % 3])
          }}>
            ⚡ {autoSpeed}×
          </button>
        )}
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
            {/* my-side renders [3,2,1]: 遠 on left, 近 on right (facing enemy center) */}
            <div className="slots-row">
              {([3,2,1] as const).map(slot => (
                <div key={slot} className="slot-col" style={{ transform: `translateY(${-slotDepth(mySide ?? 'A', slot) * 28}px)` }}>
                  <div className="slot-name" style={{ color: DIST_COLOR[getSlotLabel(mySide ?? 'A', slot)] }}>{getSlotLabel(mySide ?? 'A', slot)}</div>
                  {myTeam.filter(u => getPendingSlot(u) === slot).map(u => {
                    const isActive = !isAIBattle && readyUnits[0]?.id === u.id
                    return (
                      <UnitCard key={u.id} unit={u} clock={game.clock}
                        selectable={isActive}
                        highlighted={previewUnitId === u.id && !isActive}
                        isPreview={!isActive}
                        onClick={u.alive && !isAIBattle && (!isActive || previewUnitId !== null)
                          ? () => {
                              if (isActive) { setPreviewUnitId(null) }
                              else { setPreviewUnitId(prev => prev === u.id ? null : u.id) }
                            }
                          : undefined}
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
            </div>
            <div className="slots-row">
              {([1,2,3] as const).map(slot => (
                <div key={slot} className="slot-col" style={{ transform: `translateY(${-slotDepth(oppSide, slot) * 28}px)` }}>
                  <div className="slot-name" style={{ color: DIST_COLOR[getSlotLabel(oppSide, slot)] }}>{getSlotLabel(oppSide, slot)}</div>
                  {enemyTeam.filter(u => u.slot === slot).map(u => (
                    <UnitCard key={u.id} unit={u} clock={game.clock} />
                  ))}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Lower section: log sidebar (left) | action + hand (right) ── */}
      <div className="battle-lower">
        <div className="log-panel" ref={logRef}>
          {game.log.slice(-80).map((l, i) => (
            <div key={i} className="log-line" dangerouslySetInnerHTML={{ __html: l.html }} />
          ))}
        </div>

        {!isAIBattle && (
          <div className="battle-right">
            {/* Action / Preview area */}
            <div className="action-area">
              {previewUnit && previewUnit.id !== readyUnits[0]?.id
                ? <UnitPreviewPanel unit={previewUnit} clock={game.clock} onClose={() => setPreviewUnitId(null)} />
                : readyUnits.length > 0
                  ? (() => {
                      const activeUnit = readyUnits[0]
                      const waitingUnits = readyUnits.slice(1)
                      return (
                        <>
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
                          <ReadyUnitPanel
                            key={activeUnit.id}
                            unit={activeUnit}
                            clock={game.clock}
                            suitInHand={suitInHand}
                            onMove={slot => handleMoveClick(activeUnit, slot)}
                          />
                        </>
                      )
                    })()
                  : <div className="action-idle">等待行動…</div>
              }
            </div>
            {/* Hand panel + position buttons */}
            <HandPanel
              hand={myHand}
              onPlayCard={onPlayCard}
              onDiscardCard={onDiscardCard}
              activeUnit={readyUnits.length > 0 ? readyUnits[0] : null}
              pendingSlot={readyUnits.length > 0 ? getPendingSlot(readyUnits[0]) : undefined}
              onPendingMove={s => {
                if (readyUnits.length > 0) setPendingSlots(prev => ({ ...prev, [readyUnits[0].id]: s }))
              }}
              onPass={() => {
                if (readyUnits.length > 0) { applyPendingMove(readyUnits[0]); onPass(readyUnits[0].id) }
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── UnitCard ────────────────────────────────────────────────────────────────

function UnitCard({ unit, clock, onClick, selectable, highlighted, isPreview }: {
  unit: Unit; clock: number; onClick?: () => void; selectable?: boolean; highlighted?: boolean; isPreview?: boolean
}) {
  const pct     = unit.alive ? (unit.hp / unit.maxHp) * 100 : 0
  const ticks   = Math.max(0, unit.nextActionAt - clock)
  const ready   = ticks === 0 && unit.alive
  const hpColor = pct > 60 ? '#22cc66' : pct > 30 ? '#ccaa22' : '#cc3333'
  const img     = getCharWideImg(unit.characterId) ?? getCharImg(unit.characterId)
  const flip    = unit.side === 'B'
  const stateClass = selectable ? 'selectable' : (onClick && isPreview ? 'previewable' : (onClick ? 'targetable' : ''))

  return (
    <div
      className={`unit-card ${!unit.alive ? 'dead' : ''} ${ready ? 'uc-ready' : ''} ${stateClass} ${highlighted ? 'uc-preview-active' : ''}`}
      onClick={onClick}
    >
      {img
        ? (
          <div className="uc-portrait">
            <img src={img} className="uc-portrait-img" alt=""
              style={flip ? { transform: 'scaleX(-1)' } : undefined} />
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

function ReadyUnitPanel({ unit, clock, suitInHand, onMove }: {
  unit: Unit; clock: number
  suitInHand: Record<string, number>
  onMove: (s: MoveSlot) => void
}) {
  const [hoveredSlot, setHoveredSlot] = useState<MoveSlot | null>(null)
  const [popAnchor,  setPopAnchor]   = useState<DOMRect | null>(null)
  const hoveredMove = hoveredSlot ? unit.moves[hoveredSlot] : null

  return (
    <div className="rup">
      <div className="rup-hdr" style={{ cursor: 'default' }}>
        <b style={{ color: EL_COLOR[unit.element] }}>{unit.name}</b>
        <span className="rup-pos">目前在 {getSlotLabel(unit.side, unit.slot)}</span>
      </div>
      <div className="rup-body">
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
            const skillImg = getMoveImg(move.id)

            return (
              <button
                key={slot}
                className={`btn skill-btn ${!ok ? 'skill-dim' : ''}`}
                style={{ borderColor: ok ? SLOT_COLOR[slot] : '#2a2a3e' }}
                onClick={() => ok && onMove(slot)}
                onMouseEnter={e => { setHoveredSlot(slot); setPopAnchor(e.currentTarget.getBoundingClientRect()) }}
                onMouseLeave={() => { setHoveredSlot(null); setPopAnchor(null) }}
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
      </div>
      {hoveredMove && hoveredSlot && popAnchor && (
        <MoveInfoBox move={hoveredMove} slot={hoveredSlot} anchor={popAnchor} />
      )}
    </div>
  )
}

// ─── HandPanel ───────────────────────────────────────────────────────────────

const HP_ICON: Record<string, string> = { red: '劍', green: '槍', blue: '法', yellow: '院' }

function HandPanel({ hand, onPlayCard, onDiscardCard, activeUnit, pendingSlot, onPendingMove, onPass }: {
  hand: Card[]
  onPlayCard: (id: string) => void
  onDiscardCard: (id: string) => void
  activeUnit?: Unit | null
  pendingSlot?: 1|2|3
  onPendingMove?: (s: 1|2|3) => void
  onPass?: () => void
}) {
  return (
    <div className="hand-panel">
      <div className="hp-label">手牌 <span className="hp-hint">（× 棄牌）</span></div>
      <div className="hp-body">
        <div className="hp-chips">
          {hand.map((card, i) => (
            <div key={`${card.id}-${i}`}
                className={`hp-chip hp-${card.color === 'flower' ? 'flower' : card.color}`}>
              {card.isSuitCard
                ? <span className="hp-icon">{HP_ICON[card.color]}</span>
                : <span className="hp-icon hp-flower-name" onClick={() => onPlayCard(card.id)}>花 {card.name}</span>
              }
              <button className="hp-discard" title="棄牌" onClick={() => onDiscardCard(card.id)}>×</button>
            </div>
          ))}
        </div>

        {activeUnit && (
          <div className="hp-pos-col">
            {([1,2,3] as const).map(s => {
              const tooFar = Math.abs(s - activeUnit.slot) > 1
              const label  = getSlotLabel(activeUnit.side, s)
              return (
                <button key={s}
                  className={`btn sm ${pendingSlot === s ? 'primary' : ''}`}
                  disabled={tooFar}
                  onClick={() => !tooFar && onPendingMove?.(s)}>
                  {label}
                </button>
              )
            })}
            <button className="btn danger hp-pos-pass" onClick={onPass}>PASS</button>
          </div>
        )}
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

// ─── MoveInfoBox ─────────────────────────────────────────────────────────────

const RANGE_LABEL: Record<string, string> = {
  '劍': '劍・前排近戰', '槍': '槍・最近格', '法': '法・交錯格',
}

const POP_W = 252

function MoveInfoBox({ move, slot, anchor }: {
  move: { name: string; description: string; powerRatio: number | null; hitRate: number | null; critRate: number | null; rangeType: string | null; scope: string | null; condition: number | null; cooldown: number | null; effectChance: number }
  slot: MoveSlot
  anchor: DOMRect
}) {
  const left = anchor.right + 10 + POP_W > window.innerWidth
    ? anchor.left - POP_W - 6
    : anchor.right + 10
  const top = Math.min(anchor.top, window.innerHeight - 230)

  return (
    <div className="move-info-box" style={{ position: 'fixed', top, left, width: POP_W, zIndex: 9200 }}>
      <div className="mib-header">
        <span style={{ color: SLOT_COLOR[slot], fontWeight: 800 }}>{SLOT_LABEL[slot]}</span>
        <b style={{ marginLeft: 5 }}>{move.name}</b>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {move.rangeType && <span className="mib-tag">{RANGE_LABEL[move.rangeType] ?? move.rangeType}</span>}
          {move.scope === '群' && <span className="mib-tag">群體</span>}
        </span>
      </div>
      {move.description && <div className="mib-desc">{move.description}</div>}
      <div className="mib-stats">
        {move.powerRatio != null && <span className="mib-stat">威力 <b>{move.powerRatio}x</b></span>}
        {move.hitRate   != null && move.hitRate  < 1 && <span className="mib-stat">命中 <b>{Math.round(move.hitRate*100)}%</b></span>}
        {move.critRate  != null && move.critRate > 0 && <span className="mib-stat">爆擊 <b>{Math.round(move.critRate*100)}%</b></span>}
        {move.condition != null && <span className="mib-stat">需 <b>{move.condition}</b> 張</span>}
        {move.cooldown  != null && <span className="mib-stat">CD <b>{move.cooldown}s</b></span>}
        {move.effectChance > 0 && move.effectChance < 1 && <span className="mib-stat">觸發 <b>{Math.round(move.effectChance * 100)}%</b></span>}
      </div>
    </div>
  )
}

// ─── UnitPreviewPanel ────────────────────────────────────────────────────────

function UnitPreviewPanel({ unit, clock, onClose }: { unit: Unit; clock: number; onClose: () => void }) {
  const [hoveredSlot, setHoveredSlot] = useState<MoveSlot | null>(null)
  const [popAnchor,  setPopAnchor]   = useState<DOMRect | null>(null)
  const hoveredMove = hoveredSlot ? unit.moves[hoveredSlot] : null

  return (
    <div className="rup rup-preview">
      <div className="rup-hdr" style={{ cursor: 'default' }}>
        <b style={{ color: EL_COLOR[unit.element] }}>{unit.name}</b>
        <span className="rup-pos">
          {getSlotLabel(unit.side, unit.slot)} · 預覽（未行動）
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: '#2c2c48' }}>
          {unit.nextActionAt > clock ? `${Math.ceil((unit.nextActionAt - clock) / 10)}s 後行動` : '即將行動'}
        </span>
        <button className="btn sm" style={{ marginLeft: 8, padding: '1px 7px' }} onClick={onClose}>✕</button>
      </div>
      <div className="rup-body">
        <div className="rup-skills-grid">
          {MOVE_SLOTS.map(slot => {
            const move = unit.moves[slot]
            if (!move) return null
            const onCD = (unit.moveCooldownUntil[move.id] ?? 0) > clock
            const skillImg = localStorage.getItem(`cb_move_img_${move.id}`)
            return (
              <div
                key={slot}
                className="btn skill-btn"
                style={{ borderColor: SLOT_COLOR[slot], cursor: 'default', opacity: onCD ? 0.4 : 0.82 }}
                onMouseEnter={e => { setHoveredSlot(slot); setPopAnchor(e.currentTarget.getBoundingClientRect()) }}
                onMouseLeave={() => { setHoveredSlot(null); setPopAnchor(null) }}
              >
                {skillImg && (
                  <div className="skill-img-wrap">
                    <img src={skillImg} className="skill-img" alt="" />
                    {onCD && <span className="skill-cd-overlay">CD</span>}
                  </div>
                )}
                <div className="skill-top">
                  <span style={{ color: SLOT_COLOR[slot], fontWeight: 800 }}>{SLOT_LABEL[slot]}</span>
                  {!skillImg && onCD && <span className="skill-cd">CD</span>}
                </div>
                <div className="skill-name">{move.name}</div>
              </div>
            )
          })}
        </div>
      </div>
      {hoveredMove && hoveredSlot && popAnchor && (
        <MoveInfoBox move={hoveredMove} slot={hoveredSlot} anchor={popAnchor} />
      )}
    </div>
  )
}
