import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import type { Unit } from '../types/unit'
import type { Card } from '../types/card'
import type { MoveSlot } from '../types/move'
import { getReadyUnits } from '../engine/atb'

const SLOT_NAME = ['近', '中', '遠']
const EL_COLOR: Record<string, string> = { sword: '#e87733', gun: '#22cc77', magic: '#9955ee' }
const SUIT_CLS: Record<string, string>  = { red: 'suit-red', green: 'suit-green', blue: 'suit-blue', yellow: 'suit-yellow', flower: 'suit-flower' }
const MOVE_SLOTS: MoveSlot[] = ['sword', 'gun', 'magic', 'wish']
const SLOT_LABEL: Record<MoveSlot, string> = { sword: '刀', gun: '槍', magic: '法', wish: '願', passive: '' }
const SLOT_COLOR: Record<MoveSlot, string> = { sword: '#e87733', gun: '#22cc77', magic: '#9955ee', wish: '#ddaa22', passive: '#666' }
const SUIT_FOR: Record<string, string> = { sword: 'red', gun: 'green', magic: 'blue', wish: 'yellow' }

interface Props {
  onPlayCard: (cardId: string) => void
  onMoveUnit: (unitId: string, toSlot: 1|2|3) => void
  onExecuteMove: (unitId: string, moveSlot: MoveSlot, targetId: string|null) => void
  onPass: (unitId: string) => void
  onToggleAuto: () => void
  onEnd: () => void
}

export default function BattleView({ onPlayCard, onMoveUnit, onExecuteMove, onPass, onToggleAuto, onEnd }: Props) {
  const { game, mySide } = useGameStore()
  const logRef = useRef<HTMLDivElement>(null)
  const [activeUnitId, setActiveUnitId] = useState<string|null>(null)
  const [selectingTarget, setSelectingTarget] = useState<MoveSlot|null>(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
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

  const suitInHand: Record<string, number> = { red: 0, green: 0, blue: 0, yellow: 0 }
  for (const c of myHand) if (c.color in suitInHand) suitInHand[c.color]++
  const flowerHand = myHand.filter(c => !c.isSuitCard)

  const atbQueue = [...game.teamA, ...game.teamB]
    .filter(u => u.alive)
    .sort((a, b) => a.nextActionAt - b.nextActionAt)

  if (game.phase === 'end') {
    const result = game.winner === mySide ? '🏆 勝利！' : game.winner === 'draw' ? '⚖ 平局' : '💀 落敗'
    return (
      <div className="battle-end">
        <h2>{result}</h2>
        <p>{game.winnerReason}</p>
        <button className="btn primary" onClick={onEnd}>再玩一局</button>
      </div>
    )
  }

  const handleMoveClick = (unit: Unit, slot: MoveSlot) => {
    const move = unit.moves[slot]
    if (!move) return
    if (move.scope === 'group' || !move.rangeType) {
      onExecuteMove(unit.id, slot, null)
      setActiveUnitId(null); setSelectingTarget(null)
    } else {
      setSelectingTarget(slot)
    }
  }

  const handleTargetClick = (target: Unit) => {
    const active = readyUnits.find(u => u.id === activeUnitId) ?? readyUnits[0]
    if (!active || !selectingTarget) return
    onExecuteMove(active.id, selectingTarget, target.id)
    setActiveUnitId(null); setSelectingTarget(null)
  }

  return (
    <div className="battle">

      {/* ── Header ── */}
      <div className="battle-header">
        <div className="bh-item">第 <b>{game.round}</b> 回合</div>
        <div className="bh-item bh-sep">時鐘 <b>{game.clock}</b></div>
        <div className="bh-item bh-sep">牌庫 <b>{game.drawPublic.length}</b> · 棄牌 <b>{game.discardPublic.length}</b></div>
        <div style={{ flex: 1 }} />
        <label className="auto-check">
          <input type="checkbox" checked={isAutoMe} onChange={onToggleAuto} />
          自動（{mySide}）
        </label>
        <label className="auto-check" style={{ opacity: .45 }}>
          <input type="checkbox" checked={isAutoOpp} readOnly />
          自動（{oppSide}）
        </label>
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

      {/* ── Battle main: 我方 | 敵方 ── */}
      <div className="battle-main">

        {/* 我方 */}
        <div className="battle-side my-side">
          <div className="side-hdr">
            <span className={`side-badge side-${mySide}`}>{mySide} 方</span>
            <span className="side-meta">手牌 {myHand.length} · 自訂剩 {myCustomLeft}</span>
          </div>
          <div className="slots-row">
            {[1,2,3].map(slot => (
              <div key={slot} className="slot-col">
                <div className="slot-name">{SLOT_NAME[slot-1]}</div>
                {myTeam.filter(u => u.slot === slot).map(u => (
                  <UnitCard key={u.id} unit={u} clock={game.clock} />
                ))}
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
            {[1,2,3].map(slot => (
              <div key={slot} className="slot-col">
                <div className="slot-name">{SLOT_NAME[slot-1]}</div>
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

      {/* ── Action panels ── */}
      {readyUnits.length > 0 && (
        <div className="action-area">
          {readyUnits.map((unit, idx) => {
            const isOpen = activeUnitId ? activeUnitId === unit.id : idx === 0
            return (
              <ReadyUnitPanel
                key={unit.id}
                unit={unit}
                clock={game.clock}
                suitInHand={suitInHand}
                flowerHand={flowerHand}
                isOpen={isOpen}
                selectingTarget={isOpen ? selectingTarget : null}
                onToggle={() => setActiveUnitId(p => p === unit.id ? null : unit.id)}
                onMove={slot => handleMoveClick(unit, slot)}
                onSelfMove={s => { onMoveUnit(unit.id, s); setActiveUnitId(null) }}
                onPass={() => { onPass(unit.id); setActiveUnitId(null) }}
                onPlayCard={onPlayCard}
              />
            )
          })}
        </div>
      )}

      {/* ── Log ── */}
      <div className="log-panel" ref={logRef}>
        {game.log.slice(-80).map((l, i) => (
          <div key={i} className="log-line" dangerouslySetInnerHTML={{ __html: l.html }} />
        ))}
      </div>
    </div>
  )
}

// ─── UnitCard ────────────────────────────────────────────────────────────────

function UnitCard({ unit, clock, onClick }: { unit: Unit; clock: number; onClick?: () => void }) {
  const pct    = unit.alive ? (unit.hp / unit.maxHp) * 100 : 0
  const ticks  = Math.max(0, unit.nextActionAt - clock)
  const ready  = ticks === 0 && unit.alive
  const hpColor = pct > 60 ? '#22cc66' : pct > 30 ? '#ccaa22' : '#cc3333'

  return (
    <div
      className={`unit-card ${!unit.alive ? 'dead' : ''} ${ready ? 'uc-ready' : ''} ${onClick ? 'targetable' : ''}`}
      onClick={onClick}
    >
      <div className="unit-card-name" style={{ color: EL_COLOR[unit.element] }}>{unit.name}</div>
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
  onToggle, onMove, onSelfMove, onPass, onPlayCard }: {
  unit: Unit; clock: number
  suitInHand: Record<string, number>; flowerHand: Card[]
  isOpen: boolean; selectingTarget: MoveSlot|null
  onToggle: () => void; onMove: (s: MoveSlot) => void
  onSelfMove: (s: 1|2|3) => void; onPass: () => void
  onPlayCard: (id: string) => void
}) {
  return (
    <div className="rup">
      <div className="rup-hdr" onClick={onToggle}>
        <b style={{ color: EL_COLOR[unit.element] }}>{unit.name}</b>
        <span className="rup-pos">目前在 {SLOT_NAME[unit.slot - 1]}</span>
        <span className="rup-chev">{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <div className="rup-body">
          {selectingTarget && <div className="target-hint">↑ 點選上方敵方角色</div>}

          {/* Move */}
          <div className="rup-row">
            <span className="section-label">移動至</span>
            {([1,2,3] as (1|2|3)[]).map(s => (
              <button key={s}
                className={`btn sm ${unit.slot === s ? 'primary' : ''}`}
                onClick={() => onSelfMove(s)}>
                {['後','中','前'][s-1]}
              </button>
            ))}
          </div>

          {/* Skills */}
          <div className="rup-row" style={{ flexWrap: 'wrap' }}>
            <span className="section-label">招式</span>
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

              return (
                <button
                  key={slot}
                  className={`btn skill-btn ${!ok ? 'skill-dim' : ''}`}
                  style={{ borderColor: ok ? SLOT_COLOR[slot] : '#2a2a3e' }}
                  onClick={() => ok && onMove(slot)}
                  title={move.description}
                >
                  <div className="skill-top">
                    <span style={{ color: ok ? SLOT_COLOR[slot] : '#444', fontWeight: 800 }}>
                      {SLOT_LABEL[slot]}
                    </span>
                    {sKey && (
                      <span className={canUse ? 'skill-ok' : 'skill-ng'}>{have}/{need}</span>
                    )}
                    {onCD && <span className="skill-cd">CD</span>}
                  </div>
                  <div className="skill-name">{move.name}</div>
                </button>
              )
            })}
          </div>

          {/* Flower hand */}
          {flowerHand.length > 0 && (
            <div className="rup-row" style={{ flexWrap: 'wrap' }}>
              <span className="section-label">花牌</span>
              {flowerHand.map((c, i) => (
                <CardChip key={`${c.id}-${i}`} card={c} onClick={() => onPlayCard(c.id)} />
              ))}
            </div>
          )}

          <button className="btn danger" style={{ alignSelf: 'flex-start' }} onClick={onPass}>
            PASS
          </button>
        </div>
      )}
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
