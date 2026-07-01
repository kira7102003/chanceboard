import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import type { Unit } from '../types/unit'
import type { Card } from '../types/card'
import type { MoveSlot } from '../types/move'
import { getReadyUnits } from '../engine/atb'

const SLOT_NAME = ['近', '中', '遠']
const EL_COLOR: Record<string, string> = { sword: '#e87733', gun: '#22cc77', magic: '#9955ee' }
const SUIT_CLS: Record<string, string>  = { red: 'suit-red', green: 'suit-green', blue: 'suit-blue', yellow: 'suit-yellow', flower: 'suit-flower' }

interface Props {
  onPlayCard: (cardId: string) => void
  onMoveUnit: (unitId: string, toSlot: 1 | 2 | 3) => void
  onExecuteMove: (unitId: string, moveSlot: MoveSlot, targetId: string | null) => void
  onPass: (unitId: string) => void
  onToggleAuto: () => void
  onEnd: () => void
}

export default function BattleView({ onPlayCard, onMoveUnit, onExecuteMove, onPass, onToggleAuto, onEnd }: Props) {
  const { game, mySide } = useGameStore()
  const logRef = useRef<HTMLDivElement>(null)
  const [activeUnit, setActiveUnit] = useState<Unit | null>(null)
  const [selectingTarget, setSelectingTarget] = useState<MoveSlot | null>(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [game?.log.length])

  if (!game) return null

  const myTeam    = mySide === 'A' ? game.teamA : game.teamB
  const enemyTeam = mySide === 'A' ? game.teamB : game.teamA
  const myHand    = mySide === 'A' ? game.handA : game.handB
  const readyUnits = getReadyUnits(game).filter(u => u.side === mySide)
  const isAuto = mySide === 'A' ? game.autoBattleA : game.autoBattleB

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
      setActiveUnit(null); setSelectingTarget(null)
    } else {
      setSelectingTarget(slot)
    }
  }

  const handleTargetClick = (target: Unit) => {
    if (!activeUnit || !selectingTarget) return
    onExecuteMove(activeUnit.id, selectingTarget, target.id)
    setActiveUnit(null); setSelectingTarget(null)
  }

  return (
    <div className="battle">
      {/* Header */}
      <div className="battle-header">
        <div className="battle-header-item">回合 <b>{game.round}</b></div>
        <div className="battle-header-item">時鐘 <b>{game.clock}</b></div>
        <div className="battle-header-item">牌堆 <b>{game.drawPublic.length}</b></div>
        <div className="battle-header-item" style={{ marginLeft: 'auto', borderRight: 'none' }}>
          <button
            className={`btn auto-btn ${isAuto ? 'active' : ''}`}
            onClick={onToggleAuto}
          >
            ⚡ {isAuto ? '自動中' : '自動'}
          </button>
        </div>
      </div>

      {/* Teams */}
      <div className="teams">
        <TeamPanel
          team={enemyTeam}
          label={mySide === 'A' ? 'B' : 'A'}
          isEnemy
          onTargetClick={selectingTarget ? handleTargetClick : undefined}
        />

        <div className="log-panel" ref={logRef}>
          {game.log.slice(-80).map((l, i) => (
            <div key={i} className="log-line" dangerouslySetInnerHTML={{ __html: l.html }} />
          ))}
        </div>

        <TeamPanel
          team={myTeam}
          label={mySide!}
          isEnemy={false}
          onTargetClick={undefined}
        />
      </div>

      {/* Action panel */}
      <div className="action-panel">
        {/* Hand */}
        <div className="hand-section">
          <div className="action-row">
            <div className="section-label" style={{ margin: 0 }}>手牌 ({myHand.length})</div>
          </div>
          <div className="hand" style={{ marginTop: 6 }}>
            {myHand.map((c, i) => (
              <CardChip key={`${c.id}-${i}`} card={c} onClick={() => onPlayCard(c.id)} />
            ))}
            {myHand.length === 0 && <span style={{ color: '#333355', fontSize: 12 }}>無手牌</span>}
          </div>
        </div>

        {/* Ready units */}
        {readyUnits.length > 0 && (
          <div className="ready-section">
            <div className="section-label">待行動 ({readyUnits.length})</div>
            {readyUnits.map(u => (
              <UnitActions
                key={u.id}
                unit={u}
                active={activeUnit?.id === u.id}
                selectingTarget={activeUnit?.id === u.id ? selectingTarget : null}
                onSelect={() => setActiveUnit(activeUnit?.id === u.id ? null : u)}
                onMove={(slot) => handleMoveClick(u, slot)}
                onSelfMove={(s) => { onMoveUnit(u.id, s); setActiveUnit(null) }}
                onPass={() => { onPass(u.id); setActiveUnit(null) }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TeamPanel({ team, label, isEnemy, onTargetClick }: {
  team: Unit[]; label: string; isEnemy: boolean
  onTargetClick?: (u: Unit) => void
}) {
  return (
    <div className={`team-panel ${isEnemy ? 'enemy' : 'ally'}`}>
      <div className="team-label">{label} 方</div>
      {[1, 2, 3].map(slot => {
        const units = team.filter(u => u.slot === slot)
        return (
          <div key={slot} className="slot-row">
            <span className="slot-name">{SLOT_NAME[slot - 1]}</span>
            {units.map(u => (
              <UnitBar
                key={u.id}
                unit={u}
                onClick={onTargetClick && u.alive ? () => onTargetClick(u) : undefined}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

function UnitBar({ unit, onClick }: { unit: Unit; onClick?: () => void }) {
  const pct = unit.alive ? (unit.hp / unit.maxHp) * 100 : 0
  // HP bar color shift: green(0%) → yellow(50%) → red(100% of background)
  const hpColor = pct > 60 ? '#22cc66' : pct > 30 ? '#ccaa22' : '#cc3333'

  return (
    <div
      className={`unit-bar ${!unit.alive ? 'dead' : ''} ${onClick ? 'targetable' : ''}`}
      onClick={onClick}
    >
      <div className="unit-name" style={{ color: EL_COLOR[unit.element] }}>
        {unit.name}
      </div>
      <div className="hp-bar-wrap">
        <div className="hp-bar" style={{ width: `${pct}%`, background: hpColor }} />
      </div>
      <div className="unit-hp">{unit.alive ? `${unit.hp} / ${unit.maxHp}` : '倒下'}</div>
      {unit.statuses.length > 0 && (
        <div className="status-chips">
          {unit.statuses.map((s, i) => <span key={i} className="status-chip">{s.key}</span>)}
        </div>
      )}
    </div>
  )
}

function CardChip({ card, onClick }: { card: Card; onClick: () => void }) {
  return (
    <div
      className={`card-chip ${SUIT_CLS[card.color] ?? ''}`}
      onClick={onClick}
      title={card.description ?? ''}
    >
      <span className="card-name">{card.name}</span>
      {!card.isSuitCard && <span className="card-badge">花</span>}
    </div>
  )
}

const MOVE_SLOTS: MoveSlot[] = ['sword', 'gun', 'magic', 'wish']
const SLOT_LABEL: Record<MoveSlot, string> = { sword: '劍', gun: '槍', magic: '法', wish: '願', passive: '被' }
const SLOT_COLOR: Record<MoveSlot, string> = { sword: '#e87733', gun: '#22cc77', magic: '#9955ee', wish: '#ddaa22', passive: '#666' }

function UnitActions({ unit, active, selectingTarget, onSelect, onMove, onSelfMove, onPass }: {
  unit: Unit; active: boolean; selectingTarget: MoveSlot | null
  onSelect: () => void; onMove: (slot: MoveSlot) => void
  onSelfMove: (slot: 1|2|3) => void; onPass: () => void
}) {
  return (
    <div className="unit-action">
      <div className="unit-action-header" onClick={onSelect}>
        <b>{unit.name}</b>
        <span style={{ color: EL_COLOR[unit.element], fontSize: 11 }}>{unit.element}</span>
        <span style={{ color: '#555577' }}>HP {unit.hp}/{unit.maxHp}</span>
        <span style={{ marginLeft: 'auto', color: active ? '#aaa' : '#444466' }}>{active ? '▲' : '▼'}</span>
      </div>

      {active && (
        <div className="unit-action-body">
          {selectingTarget && (
            <div className="target-hint">↑ 點選上方敵方目標</div>
          )}

          <div className="move-buttons">
            {MOVE_SLOTS.map(slot => {
              const move = unit.moves[slot]
              if (!move) return null
              return (
                <button
                  key={slot}
                  className="btn move-btn"
                  style={{ borderColor: SLOT_COLOR[slot] }}
                  onClick={() => onMove(slot)}
                  title={move.description}
                >
                  <span style={{ color: SLOT_COLOR[slot], fontWeight: 700 }}>{SLOT_LABEL[slot]}</span>
                  {' '}{move.name}
                  {move.condition ? <span style={{ color: '#555577' }}> ×{move.condition}</span> : ''}
                </button>
              )
            })}
          </div>

          <div className="move-section">
            <div className="section-label" style={{ margin: 0 }}>移動</div>
            {[1, 2, 3].map(s => (
              <button key={s} className="btn sm" onClick={() => onSelfMove(s as 1|2|3)}>
                {SLOT_NAME[s - 1]}
              </button>
            ))}
          </div>

          <button className="btn danger" onClick={onPass}>PASS</button>
        </div>
      )}
    </div>
  )
}
