import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import type { Unit } from '../types/unit'
import type { Card } from '../types/card'
import type { MoveSlot } from '../types/move'
import { getReadyUnits } from '../engine/atb'

const SLOT_NAME = ['近', '中', '遠']
const EL_COLOR: Record<string, string> = { sword: '#e55', gun: '#5a5', magic: '#66e' }
const SUIT_COLOR: Record<string, string> = { red: '#e44', green: '#4a4', blue: '#44e', yellow: '#ca0', flower: '#c8c' }

interface Props {
  onPlayCard: (cardId: string) => void
  onMoveUnit: (unitId: string, toSlot: 1 | 2 | 3) => void
  onExecuteMove: (unitId: string, moveSlot: MoveSlot, targetId: string | null) => void
  onPass: (unitId: string) => void
  onEnd: () => void
}

export default function BattleView({ onPlayCard, onMoveUnit, onExecuteMove, onPass, onEnd }: Props) {
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

  if (game.phase === 'end') {
    return (
      <div className="battle-end">
        <h2>{game.winner === mySide ? '🏆 勝利！' : game.winner === 'draw' ? '平局' : '💀 落敗'}</h2>
        <p>{game.winnerReason}</p>
        <button className="btn" onClick={onEnd}>再玩一局</button>
      </div>
    )
  }

  const handleMoveClick = (unit: Unit, slot: MoveSlot) => {
    const move = unit.moves[slot]
    if (!move) return
    if (move.scope === 'group' || !move.rangeType) {
      // no target selection needed
      onExecuteMove(unit.id, slot, null)
      setActiveUnit(null)
      setSelectingTarget(null)
    } else {
      setSelectingTarget(slot)
    }
  }

  const handleTargetClick = (target: Unit) => {
    if (!activeUnit || !selectingTarget) return
    onExecuteMove(activeUnit.id, selectingTarget, target.id)
    setActiveUnit(null)
    setSelectingTarget(null)
  }

  return (
    <div className="battle">
      {/* Header */}
      <div className="battle-header">
        <span>回合 {game.round}</span>
        <span>時鐘 {game.clock}</span>
        <span>剩餘牌 {game.drawPublic.length}</span>
      </div>

      {/* Teams */}
      <div className="teams">
        {/* Enemy team */}
        <TeamPanel
          team={enemyTeam}
          label={mySide === 'A' ? 'B' : 'A'}
          isEnemy
          onTargetClick={selectingTarget ? handleTargetClick : undefined}
        />

        {/* Battle log */}
        <div className="log-panel" ref={logRef}>
          {game.log.slice(-60).map((l, i) => (
            <div key={i} className="log-line" dangerouslySetInnerHTML={{ __html: l.html }} />
          ))}
        </div>

        {/* My team */}
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
          <div className="section-label">手牌</div>
          <div className="hand">
            {myHand.map(c => (
              <CardChip key={c.id} card={c} onClick={() => onPlayCard(c.id)} />
            ))}
          </div>
        </div>

        {/* Ready units */}
        {readyUnits.length > 0 && (
          <div className="ready-section">
            <div className="section-label">待行動</div>
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

// ─── Sub-components ─────────────────────────────────────────────────────────

function TeamPanel({
  team, label, isEnemy, onTargetClick,
}: {
  team: Unit[]
  label: string
  isEnemy: boolean
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
  const color = pct > 50 ? '#4c8' : pct > 25 ? '#ca4' : '#e44'

  return (
    <div className={`unit-bar ${!unit.alive ? 'dead' : ''} ${onClick ? 'targetable' : ''}`} onClick={onClick}>
      <div className="unit-name" style={{ color: EL_COLOR[unit.element] }}>{unit.name}</div>
      <div className="hp-bar-wrap">
        <div className="hp-bar" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="unit-hp">{unit.alive ? `${unit.hp}/${unit.maxHp}` : '倒下'}</div>
      {unit.statuses.length > 0 && (
        <div className="status-chips">
          {unit.statuses.map((s, i) => (
            <span key={i} className="status-chip">{s.key}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function CardChip({ card, onClick }: { card: Card; onClick: () => void }) {
  return (
    <div
      className="card-chip"
      style={{ borderColor: SUIT_COLOR[card.color] ?? '#888' }}
      onClick={onClick}
      title={card.description ?? ''}
    >
      <span className="card-name">{card.name}</span>
      {card.color === 'flower' && <span className="card-badge">花</span>}
    </div>
  )
}

const MOVE_SLOTS: MoveSlot[] = ['sword', 'gun', 'magic', 'wish']
const SLOT_LABEL: Record<MoveSlot, string> = { sword: '劍', gun: '槍', magic: '法', wish: '願', passive: '被' }
const SLOT_COLOR: Record<MoveSlot, string> = { sword: '#e55', gun: '#5a5', magic: '#66e', wish: '#ca0', passive: '#888' }

function UnitActions({
  unit, active, selectingTarget,
  onSelect, onMove, onSelfMove, onPass,
}: {
  unit: Unit
  active: boolean
  selectingTarget: MoveSlot | null
  onSelect: () => void
  onMove: (slot: MoveSlot) => void
  onSelfMove: (slot: 1 | 2 | 3) => void
  onPass: () => void
}) {
  return (
    <div className={`unit-action ${active ? 'open' : ''}`}>
      <div className="unit-action-header" onClick={onSelect}>
        <b>{unit.name}</b>
        <span style={{ color: EL_COLOR[unit.element] }}>{unit.element}</span>
        <span>HP {unit.hp}/{unit.maxHp}</span>
      </div>

      {active && (
        <div className="unit-action-body">
          {selectingTarget && (
            <div className="hint">↑ 點選上方敵方目標</div>
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
                  <span style={{ color: SLOT_COLOR[slot] }}>{SLOT_LABEL[slot]}</span>
                  {' '}{move.name}
                  {move.condition ? ` (×${move.condition})` : ''}
                </button>
              )
            })}
          </div>

          <div className="move-section">
            <div className="section-label">移動</div>
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
