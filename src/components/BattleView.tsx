import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGameStore } from '../store/gameStore'
import type { Unit } from '../types/unit'
import type { Card } from '../types/card'
import type { Move, MoveSlot } from '../types/move'
import type { GameState } from '../types/game'
import { getReadyUnits } from '../engine/atb'
import { effectiveATK, effectiveDEF, effectiveSPD } from '../engine/combat'
import ScorePanel from './ScorePanel'
import { getCharImg, getCharWideImg, getMoveImg, getCardImg } from '../utils/charStore'
import BattleLog from './battle/BattleLog'
import { useFitBattleLayout } from '../hooks/useFitBattleLayout'

const DIST_COLOR: Record<string, string> = { '前': '#e85533', '中': '#ddaa22', '後': '#33aacc' }

// SA board coordinates: A front=3/back=1; B front=1/back=3.
function getSlotLabel(side: 'A' | 'B', slot: number): string {
  if (slot === 2) return '中'
  return slot === (side === 'A' ? 3 : 1) ? '前' : '後'
}
const EL_COLOR: Record<string, string> = { '劍': '#e87733', '槍': '#22cc77', '法': '#9955ee' }
const EL_ICON:  Record<string, string> = { '劍': '⚔', '槍': '🔫', '法': '✨' }
const SUIT_ICON: Record<string, string> = { '劍': '⚔', '槍': '🔫', '法': '✨', '願': '🌠' }
const MOVE_SLOTS: MoveSlot[] = ['劍', '槍', '法', '願']
const SLOT_COLOR: Record<MoveSlot, string> = { '劍': '#e87733', '槍': '#22cc77', '法': '#9955ee', '願': '#ddaa22', '被': '#666' }
const SUIT_FOR: Record<string, string> = { '劍': 'red', '槍': 'green', '法': 'blue', '願': 'yellow' }

// Suit cards from data/db (ids stable): shown as the always-visible count row
// in the act panel, mirroring the reference's #suit-count-row card faces.
const SUIT_CARDS: Array<{ slot: MoveSlot; id: string; name: string }> = [
  { slot: '劍', id: '001', name: '刀劍(Sword)' },
  { slot: '槍', id: '002', name: '槍炮(Gun)' },
  { slot: '法', id: '003', name: '魔法(Magic)' },
  { slot: '願', id: '004', name: '心願(Wish)' },
]

// StatusKey → 顯示名稱（參考版卡片標籤用「ATK+(30%) 常駐」這種格式）
const STATUS_LABEL: Record<string, string> = {
  hpPlus: 'HP+', hpMinus: 'HP-', atkPlus: 'ATK+', atkMinus: 'ATK-',
  defPlus: 'DEF+', defMinus: 'DEF-', spdPlus: 'SPD+', spdMinus: 'SPD-',
  batPlus: 'BAT+', batMinus: 'BAT-', sureHit: '必中', evasion: '迴避',
  sealed: '封招', rooted: '禁足', confused: '混亂', hidden: '隱身',
  burning: '燃燒', frozen: '凍結', damageReduction: '減傷', linked: '連動',
  liberated: '解放', shield: '護盾', paralyzed: '麻痺', empowered: '強擊',
  awakened: '覺醒', lucky: '幸運', counter: '反擊', charged: '帶電',
}

// 常駐判定：battle-start passives 給超大 expiresAt 表示整場有效
const PERMANENT_TICKS = 6000

function statusTagText(key: string, mode: string, value: number, remainTicks: number): string {
  const label = STATUS_LABEL[key] ?? key
  const mag = mode === 'pct'
    ? (value ? `(${Math.round(value)}%)` : '')
    : (value ? `${value}` : '')
  const remain = remainTicks >= PERMANENT_TICKS ? '常駐' : `${Math.max(0, Math.ceil(remainTicks / 10))}s`
  return `${label}${mag} ${remain}`
}

function statusTagTexts(unit: Unit, clock: number): string[] {
  const counts = new Map<string, number>()
  for (const status of unit.statuses) {
    const text = statusTagText(status.key, status.mode, status.value, status.expiresAt - clock)
    counts.set(text, (counts.get(text) ?? 0) + 1)
  }
  return [...counts].map(([text, count]) => count > 1 ? `${text} ×${count}` : text)
}

// Ported from the reference's moveTargetRuleShort(): one-line targeting rule
function moveTargetRule(move: Move): string | null {
  if (move.powerRatio == null) return null
  const grp = move.scope === '群'
  if (move.rangeType === '劍') return '🎯近戰・需前排・' + (grp ? '鏡像群體' : '鏡像單體')
  if (move.rangeType === '槍') return '🎯遠程・' + (grp ? '最近一格全體' : '最近敵人')
  if (move.rangeType === '法') return '🎯法系・不需前排・' + (grp ? '交錯群體' : '交錯單體')
  return null
}

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
  targetSide: 'A' | 'B'
  targetName: string | null
  targetCharImg: string | null
  targetUnitId: string | null
  isGroup: boolean
  groupTargets: Array<{ name: string; charImg: string | null }>
  color: string
  dealsDamage: boolean
  hasTarget: boolean
  selfTargetOnly: boolean
  missed: boolean
}

export default function BattleView({ onPlayCard, onDiscardCard, onMoveUnit, onExecuteMove, onPass, onToggleAuto, onEnd, onSoloReplay, bgUrl }: Props) {
  const { game, mySide, isSolo, isAIBattle, soloScore, autoSpeed, setAutoSpeed } = useGameStore()
  const logRef         = useRef<HTMLDivElement>(null)
  const animTimer      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAnimIdx    = useRef(-1)
  const battleMainRef  = useRef<HTMLDivElement>(null)
  const arenaRef       = useRef<HTMLDivElement>(null)
  const actRowRef      = useRef<HTMLDivElement>(null)
  const actionAreaRef  = useRef<HTMLDivElement>(null)
  const slotColRef     = useRef<HTMLDivElement>(null)
  const cardsRowRef    = useRef<HTMLDivElement>(null)
  useFitBattleLayout({ battleMainRef, arenaRef, actRowRef, actionAreaRef, slotColRef, cardsRowRef })
  const [moveAnim,  setMoveAnim]  = useState<MoveAnim | null>(null)
  const [animKey,   setAnimKey]   = useState(0)
  const [showEndLog, setShowEndLog] = useState(false)
  const [logCollapsed, setLogCollapsed] = useState(() => localStorage.getItem('cb_battle_log_collapsed') === '1')
  // pending destination slot per unit (preview before confirming with a skill/pass)
  const [pendingSlots, setPendingSlots] = useState<Record<string, 1|2|3>>({})
  // preview: clicking a non-active own unit shows their moves read-only
  const [previewUnitId, setPreviewUnitId] = useState<string | null>(null)
  // pick-then-confirm (照抄參考版：點招式/花牌先選取，按「出手」才執行)
  const [pickedMove,   setPickedMove]   = useState<MoveSlot | null>(null)
  // 順序條 chip 精簡後，完整資訊改滑鼠移入（手機點一下）浮窗顯示
  const [atbPop, setAtbPop] = useState<{ id: string; rect: DOMRect } | null>(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [game?.log.length])

  useEffect(() => {
    localStorage.setItem('cb_battle_log_collapsed', logCollapsed ? '1' : '0')
  }, [logCollapsed])

  // Clear picks whenever the acting unit changes (same as the reference's
  // per-turn actMovePicked/actPending reset in nextTurn()).
  const activeReadyId = game ? getReadyUnits(game).filter(u => u.side === mySide)[0]?.id : undefined
  useEffect(() => {
    setPickedMove(null)
  }, [activeReadyId])

  // Watch log for moveAnim entries (triggers for ALL moves incl. AI)
  // Scan all NEW entries (not just the last) because a single tick can push many log lines
  useEffect(() => {
    if (!game) return
    const start = lastAnimIdx.current + 1
    for (let i = start; i < game.log.length; i++) {
      const entry = game.log[i]
      if (!entry.moveAnim) continue
      lastAnimIdx.current = i
      const { moveId, moveName, moveSlot, charName, charId, attackerSide, targetSide, targetName, targetCharId, targetUnitId, groupTargets, dealsDamage, hasTarget, selfTargetOnly, missed } = entry.moveAnim
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
        targetSide: targetSide ?? (attackerSide === 'A' ? 'B' : 'A'),
        targetName: targetName ?? null, targetCharImg,
        targetUnitId: targetUnitId ?? null,
        isGroup: !targetName,
        groupTargets: resolvedGroupTargets,
        color: SLOT_COLOR[moveSlot as MoveSlot] ?? '#aaa',
        dealsDamage: dealsDamage ?? true,
        hasTarget: hasTarget ?? (!!targetName || !!groupTargets?.length),
        selfTargetOnly: selfTargetOnly ?? false,
        missed: missed ?? false,
      })
      setAnimKey(k => k + 1)
      const sideIsAuto = attackerSide === 'A' ? game.autoBattleA : game.autoBattleB
      const manualAnimation = !isAIBattle && !sideIsAuto && !(isSolo && attackerSide === 'B')
      animTimer.current = setTimeout(() => setMoveAnim(null), manualAnimation ? 3400 : 2300)
      break // show only the first new moveAnim per batch
    }
  }, [game?.log.length])

  if (!game) return null

  const myTeam    = mySide === 'A' ? game.teamA : game.teamB
  const enemyTeam = mySide === 'A' ? game.teamB : game.teamA
  const previewUnit = previewUnitId
    ? [...myTeam, ...enemyTeam].find(u => u.id === previewUnitId && u.alive) ?? null
    : null
  const myHand    = mySide === 'A' ? [...game.handA, ...(game.handCustomA ?? [])] : [...game.handB, ...(game.handCustomB ?? [])]
  const oppHand   = mySide === 'A' ? [...game.handB, ...(game.handCustomB ?? [])] : [...game.handA, ...(game.handCustomA ?? [])]
  const myCustomLeft = mySide === 'A' ? game.customDeckOrder.length : game.customDeckOrderB.length
  const oppSide = mySide === 'A' ? 'B' : 'A'
  const mySlotOrder = (mySide === 'A' ? [1, 2, 3] : [3, 2, 1]) as Array<1 | 2 | 3>
  const enemySlotOrder = (oppSide === 'A' ? [3, 2, 1] : [1, 2, 3]) as Array<1 | 2 | 3>

  const readyUnits = getReadyUnits(game).filter(u => u.side === mySide)
  const isAutoMe  = mySide === 'A' ? game.autoBattleA : game.autoBattleB
  const currentActionKey = readyUnits[0]
    ? `${readyUnits[0].id}:${readyUnits[0].nextActionAt}`
    : null
  const flowerUsedThisAction = !!mySide && !!currentActionKey && game.flowerActionUsed?.[mySide] === currentActionKey
  const discardedThisAction = !!mySide && !!currentActionKey && game.discardActionUsed?.[mySide] === currentActionKey


  const suitInHand: Record<string, number> = { red: 0, green: 0, blue: 0, yellow: 0 }
  for (const c of myHand) if (c.color in suitInHand) suitInHand[c.color]++
  const flowerCards = myHand.filter(c => !c.isSuitCard)

  const atbQueue = [...game.teamA, ...game.teamB]
    .filter(u => u.alive)
    .sort((a, b) => a.nextActionAt - b.nextActionAt || effectiveSPD(b) - effectiveSPD(a))
  const globalActiveId = atbQueue[0]?.id

  if (game.phase === 'end') {
    if (isAIBattle) {
      const label =
        game.winner === 'A' ? '🤖 A 方勝利！' :
        game.winner === 'B' ? '🤖 B 方勝利！' : '⚖ 平局'
      return (
        <div className="battle-end">
          <h2 style={{ fontSize: '2rem' }}>{label}</h2>
          <p>{game.winnerReason}</p>
          <BattleEndDetails game={game} showLog={showEndLog} onOpenLog={() => setShowEndLog(true)} onCloseLog={() => setShowEndLog(false)} />
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
        >
          <BattleEndDetails game={game} showLog={showEndLog} onOpenLog={() => setShowEndLog(true)} onCloseLog={() => setShowEndLog(false)} />
        </ScorePanel>
      )
    }
    const result = game.winner === mySide ? '🏆 勝利！' : game.winner === 'draw' ? '⚖ 平局' : '💀 落敗'
    return (
      <div className="battle-end">
        <h2>{result}</h2>
        <p>{game.winnerReason}</p>
        <BattleEndDetails game={game} showLog={showEndLog} onOpenLog={() => setShowEndLog(true)} onCloseLog={() => setShowEndLog(false)} />
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

  const confirmAct = (unit: Unit) => {
    const slot = pickedMove
    if (slot && !unit.moves[slot]) return

    setPickedMove(null)
    applyPendingMove(unit)

    if (slot) onExecuteMove(unit.id, slot, null)
    else onPass(unit.id)
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
        // Direction is viewer-relative: the local team is always rendered on the
        // left and the opposing team on the right, including the B-side view.
        const attackFromLeft = moveAnim.attackerSide === mySide
        const mirrorSkill = !attackFromLeft
        const targetOnRight = moveAnim.targetSide !== mySide
        const mirrorTarget = targetOnRight
        const sideIsAuto = moveAnim.attackerSide === 'A' ? game.autoBattleA : game.autoBattleB
        const manualAnimation = !isAIBattle && !sideIsAuto && !(isSolo && moveAnim.attackerSide === 'B')

        const Portrait = ({ img, name, flip, showName = true }: { img: string|null; name: string; flip: boolean; showName?: boolean }) => (
          <>
            {img
              ? <img src={img} className="ma-portrait" alt=""
                  style={flip ? { transform: 'scaleX(-1)' } : undefined} />
              : <div className="ma-no-img">{name[0]}</div>
            }
            {showName && <div className="ma-char-name">{name}</div>}
          </>
        )

        const TargetZone = (
          <div className={`ma-zone-target${moveAnim.missed ? ' ma-missed' : ''}`}>
            {moveAnim.isGroup
              ? (
                <div className="ma-group-row">
                  {moveAnim.groupTargets.map((t, i) => (
                    <div key={i}>
                      <Portrait img={t.charImg} name={t.name} flip={mirrorTarget} showName={false} />
                    </div>
                  ))}
                  <div className="ma-char-name ma-group-name">群體</div>
                </div>
              )
              : moveAnim.targetName
                ? <Portrait img={moveAnim.targetCharImg} name={moveAnim.targetName} flip={mirrorTarget} />
                : <div className="ma-no-img" style={{ opacity: .15 }}>⚔</div>
            }
            {moveAnim.missed && <div className="ma-miss-text">MISS</div>}
          </div>
        )

        return (
          <div className={`move-anim-overlay${manualAnimation ? ' ma-manual' : ''}`} key={animKey}
            style={{ '--ma-duration': manualAnimation ? '3.4s' : '2.3s' } as React.CSSProperties}>
            <div className={`ma-battle-row ${targetOnRight ? 'ma-from-left' : 'ma-from-right'} ${!moveAnim.dealsDamage || !moveAnim.hasTarget ? 'ma-nondamage' : ''}`}>
              <div className="ma-zone-skill">
                <div className="ma-skill-wrap">
                  {moveAnim.img
                    ? <img src={moveAnim.img} className="ma-skill-img" alt=""
                        style={{
                          filter: `drop-shadow(0 0 18px ${moveAnim.color}cc)`,
                          transform: mirrorSkill ? 'scaleX(-1)' : undefined,
                        }} />
                    : <div className="ma-skill-empty" style={{ color: moveAnim.color }}>⚡</div>
                  }
                </div>
                <div className="ma-skill-name" style={{ color: moveAnim.color }}>{moveAnim.name}</div>
              </div>
              {moveAnim.hasTarget && !moveAnim.selfTargetOnly && TargetZone}
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
        <div className="bh-item bh-sep">牌庫 <b>{game.drawPublic.length}</b> · 棄牌堆 <b>{game.discardPublic.length}</b></div>
        {!isAIBattle && (
          <div className="bh-item bh-sep">
            對方手牌 <b>{oppHand.length}</b>{myCustomLeft > 0 && <> · 自訂剩 <b>{myCustomLeft}</b></>}
          </div>
        )}
        <div className="bh-atb">
          <span className="atb-label">順序</span>
          {atbQueue.map(u => {
            const ticks = Math.max(0, u.nextActionAt - game.clock)
            const ready = ticks === 0
            return (
              <div key={u.id} className={`atb-chip atb-${u.side} ${ready ? 'atb-ready' : ''}`}
                onMouseEnter={e => setAtbPop({ id: u.id, rect: e.currentTarget.getBoundingClientRect() })}
                onMouseLeave={() => setAtbPop(null)}
                onClick={e => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setAtbPop(p => p && p.id === u.id ? null : { id: u.id, rect })
                }}>
                <span className="atb-dot" style={{ color: EL_COLOR[u.element] }}>⬥</span>
                <span className="atb-name">{u.name}</span>
                <span className="atb-time">{ready ? '行動中' : `${Math.ceil(ticks / 10)}s`}</span>
              </div>
            )
          })}
          {atbPop && (() => {
            const u = atbQueue.find(x => x.id === atbPop.id)
            return u ? <AtbPopup unit={u} clock={game.clock} mySide={mySide ?? 'A'} anchor={atbPop.rect} /> : null
          })()}
        </div>
        <div style={{ flex: 1 }} />
        {isAIBattle
          ? <span style={{ fontSize: 12, color: '#9955ee', letterSpacing: 1 }}>🤖 AI 對戰觀戰中</span>
          : (
            <button className={`btn sm auto-toggle ${isAutoMe ? 'on' : ''}`} onClick={onToggleAuto}>
              ⚫ 自動戰鬥
            </button>
          )
        }
        {(isAutoMe || isAIBattle) && (
          <button className="auto-speed-btn" onClick={() => {
            const speeds: (1|2|4)[] = [1, 2, 4]
            const idx = speeds.indexOf(autoSpeed)
            setAutoSpeed(speeds[(idx + 1) % 3])
          }}>
            {autoSpeed}X
          </button>
        )}
      </div>


      {/* ── Battle main: arena (dynamically fit) + act row (dynamically fit) ── */}
      <div className="battle-main" ref={battleMainRef}>
        <div className="battle-arena" ref={arenaRef}>
          <div className="slots-row">
            {/* 我方: 後→中→前 (facing enemy on the right) */}
            {mySlotOrder.map(slot => {
              // 前/中 往後（左）展開，後 往前（右）展開
              const fanClass = slot === 3 ? 'stack-expand-right' : 'stack-expand-left'
              const label = getSlotLabel(mySide ?? 'A', slot)
              const units = myTeam.filter(u => getPendingSlot(u) === slot).sort((a, b) => b.hp - a.hp)
              return (
                <div key={`my-${slot}`} className="slot-col slot-col-my" ref={slot === 3 ? slotColRef : undefined}>
                  <div className={`slot-cards-stack ${fanClass} ${units.length > 1 ? 'stack-multi' : ''}`}>
                    <div className="stack-slotlabel" style={{ color: DIST_COLOR[label] }}>{label}</div>
                    {units.map((u, i) => {
                        const isActive = !isAIBattle && readyUnits[0]?.id === u.id
                        return (
                          <UnitCard key={u.id} unit={u} clock={game.clock} flip={false}
                            stackClass={`uc-i${i}`}
                            selectable={isActive}
                            highlighted={previewUnitId === u.id && !isActive}
                            isPreview={!isActive}
                            isCurrentTurn={u.id === globalActiveId}
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
                </div>
              )
            })}

            {/* 中線分隔 */}
            <div className="arena-divider" />

            {/* 敵方: 前→中→後 */}
            {enemySlotOrder.map(slot => {
              // 前/中 往後（右）展開，後 往前（左）展開
              const fanClass = slot === 3 ? 'stack-expand-left' : 'stack-expand-right'
              const label = getSlotLabel(oppSide, slot)
              const units = enemyTeam.filter(u => u.slot === slot).sort((a, b) => b.hp - a.hp)
              return (
                <div key={`enemy-${slot}`} className="slot-col slot-col-enemy">
                  <div className={`slot-cards-stack ${fanClass} ${units.length > 1 ? 'stack-multi' : ''}`}>
                    <div className="stack-slotlabel" style={{ color: DIST_COLOR[label] }}>{label}</div>
                    {units.map((u, i) => (
                        <UnitCard key={u.id} unit={u} clock={game.clock} flip isCurrentTurn={u.id === globalActiveId}
                          stackClass={`uc-i${i}`}
                          isPreview
                          highlighted={previewUnitId === u.id}
                          onClick={u.alive && !isAIBattle
                            ? () => setPreviewUnitId(prev => prev === u.id ? null : u.id)
                            : undefined}
                        />
                      ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Act row: 上半（戰鬥紀錄 | 出手面板）+ 下半整排手牌 ── */}
        {(() => {
          const au = readyUnits[0]
          const previewing = !!previewUnit && previewUnit.id !== au?.id
          return (
            <div className="battle-act-row" ref={actRowRef}>
              {/* 戰鬥紀錄：整欄到底，手牌列不會蓋到它 */}
              <div className={`log-panel-wrap${logCollapsed ? ' collapsed' : ''}`}>
                <button className="log-panel-label" onClick={() => setLogCollapsed(v => !v)}
                  title={logCollapsed ? '展開戰鬥紀錄' : '收合戰鬥紀錄'}>
                  <span>戰鬥紀錄</span><b>{logCollapsed ? '›' : '‹'}</b>
                </button>
                <BattleLog ref={logRef} entries={game.log.slice(-80)} />
              </div>

              {!isAIBattle && (
                <div className="act-right-col">
                  <div className="act-panel" ref={actionAreaRef}>
                    {previewing && previewUnit
                      ? (
                        <div className="act-flow">
                          <div className="act-who">
                            查看 <b style={{ color: EL_COLOR[previewUnit.element] }}>{previewUnit.name}</b>
                            <span className="act-who-sub">
                              （{getSlotLabel(previewUnit.side, previewUnit.slot)}・
                              {previewUnit.nextActionAt > game.clock ? `${Math.ceil((previewUnit.nextActionAt - game.clock) / 10)}s 後行動` : '即將行動'}）
                            </span>
                          </div>
                          <MoveGrid unit={previewUnit} clock={game.clock} readOnly />
                          <button className="btn sm act-flow-close" onClick={() => setPreviewUnitId(null)}>✕</button>
                        </div>
                      )
                      : au
                        ? (
                          /* 一行流式：輪到 X → 招式鈕(含牌耗) → 移動到 後/中/前，塞不下自動換行 */
                          <div className="act-flow">
                            <div className="act-who">
                              輪到【我方】<b style={{ color: EL_COLOR[au.element] }}>{EL_ICON[au.element]} {au.name}</b>
                            </div>
                            <MoveGrid
                              unit={au}
                              clock={game.clock}
                              suitInHand={suitInHand}
                              picked={pickedMove}
                              onPick={s => setPickedMove(prev => prev === s ? null : s)}
                            />
                            <div className="act-slotrow">
                              <span className="slotrow-label">移動到：</span>
                              {([3,2,1] as const).map(s => {
                                const tooFar = Math.abs(s - au.slot) > 1
                                return (
                                  <button key={s}
                                    className={`btn sm slotbtn ${getPendingSlot(au) === s ? 'current' : ''}`}
                                    disabled={tooFar}
                                    onClick={() => !tooFar && setPendingSlots(prev => ({ ...prev, [au.id]: s }))}>
                                    {getSlotLabel(au.side, s)}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                        : <div className="action-idle">等待行動…</div>
                    }
                  </div>

                  {/* 手牌列＋出手鈕：吃滿紀錄右側整寬，自然高度不縮放
                      （查看模式也保留，只藏出手欄） */}
                  <div className="act-cards-row" ref={cardsRowRef}>
                    <div className="suit-count-row">
                      {SUIT_CARDS.map(sc => {
                        const count = suitInHand[SUIT_FOR[sc.slot]] ?? 0
                        const discardTarget = myHand.find(c => c.color === SUIT_FOR[sc.slot])
                        return (
                          <SuitCountCard key={sc.slot} slot={sc.slot} cardId={sc.id} name={sc.name} count={count}
                            onDiscard={discardTarget && !discardedThisAction ? () => onDiscardCard(discardTarget.id) : undefined} />
                        )
                      })}
                    </div>
                    <div className="act-card-zone">
                      {flowerCards.map((card, i) => {
                        const cardKey = `${card.id}-${i}`
                        return (
                          <FlowerCardFace key={cardKey} card={card}
                            disabled={flowerUsedThisAction}
                            onUse={() => onPlayCard(card.id)}
                            onDiscard={discardedThisAction ? undefined : () => onDiscardCard(card.id)} />
                        )
                      })}
                    </div>
                    {au && !previewing && (
                      <div className="act-confirm-col">
                        <button className="btn primary act-confirm"
                          onClick={() => confirmAct(au)}>
                          出手 ▸
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// ─── UnitCard — 照抄參考版 renderUnitBlock()：立繪鋪滿背景、名字列疊頂端、
//     血條(數字疊在條內)+ATK/DEF/SPD+狀態標籤合併疊底端 ────────────────────

function BattleEndDetails({ game, showLog, onOpenLog, onCloseLog }: {
  game: GameState
  showLog: boolean
  onOpenLog: () => void
  onCloseLog: () => void
}) {
  const Team = ({ side, units }: { side: 'A' | 'B'; units: Unit[] }) => {
    const survivors = units.filter(u => u.alive)
    return (
      <div className={`end-team end-team-${side}`}>
        <div className="end-detail-title">{side} 方殘存角色</div>
        {survivors.length === 0
          ? <div className="end-no-survivor">無</div>
          : survivors.map(u => {
              const pct = Math.max(0, Math.min(100, u.hp / u.maxHp * 100))
              return (
                <div className="end-unit" key={u.id}>
                  <div className="end-unit-row"><b>{u.name}</b><span>{u.hp} / {u.maxHp} HP</span></div>
                  <div className="end-hpbar"><i style={{ width: `${pct}%` }} /></div>
                </div>
              )
            })}
      </div>
    )
  }

  return (
    <>
      <div className="battle-end-details">
        <div className="end-survivors">
          <Team side="A" units={game.teamA} />
          <Team side="B" units={game.teamB} />
        </div>
        <button className="btn end-log-button" onClick={onOpenLog}>📜 LOG</button>
      </div>
      {showLog && (
        <div className="end-log-overlay" onClick={onCloseLog}>
          <div className="end-log-dialog" onClick={e => e.stopPropagation()}>
            <div className="end-log-header">
              <div className="end-detail-title">戰鬥 LOG</div>
              <button className="panel-back end-log-close" onClick={onCloseLog}>✕ 關閉</button>
            </div>
            <div className="end-log">
              <BattleLog entries={game.log} className="end-log-lines" />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function UnitCard({ unit, clock, flip = false, onClick, selectable, highlighted, isPreview, isCurrentTurn, stackClass }: {
  unit: Unit; clock: number; flip?: boolean; onClick?: () => void; selectable?: boolean; highlighted?: boolean; isPreview?: boolean; isCurrentTurn?: boolean; stackClass?: string
}) {
  const pct     = unit.alive ? Math.max(0, (unit.hp / unit.maxHp) * 100) : 0
  const ticks   = Math.max(0, unit.nextActionAt - clock)
  const hpColor = pct > 50 ? '#22cc66' : pct > 20 ? '#ccaa22' : '#cc3333'
  const img     = getCharWideImg(unit.characterId) ?? getCharImg(unit.characterId)
  const stateClass = selectable ? 'selectable' : (onClick && isPreview ? 'previewable' : (onClick ? 'targetable' : ''))

  return (
    <div
      className={`unit-card ${stackClass ?? ''} ${!unit.alive ? 'dead' : ''} ${isCurrentTurn ? 'uc-ready' : ''} ${stateClass} ${highlighted ? 'uc-preview-active' : ''}`}
      onClick={onClick}
      title={onClick && isPreview
        ? `${unit.name}（${unit.element}系 / ${getSlotLabel(unit.side, unit.slot)}）點擊查看完整招式`
        : undefined}
    >
      <div className="uc-art">
        {img
          ? <img src={img} className="uc-art-img" alt=""
              style={flip ? { transform: 'scaleX(-1)' } : undefined} />
          : <div className="uc-art-fallback" style={{ color: EL_COLOR[unit.element] }}>{unit.name[0]}</div>
        }
      </div>
      <div className="uc-head">
        <span className="uc-el-icon">{EL_ICON[unit.element] ?? '❔'}</span>
        <span className="uc-name">{unit.name}</span>
      </div>
      <div className="uc-footer">
        <div className="uc-hpwrap">
          <div className="uc-hpbar" style={{ width: `${pct}%`, background: hpColor }} />
          <div className="uc-hptext">{unit.alive ? `${Math.max(0, Math.round(unit.hp))} / ${unit.maxHp}` : '倒下'}</div>
        </div>
        <div className="uc-mini-stats">
          ATK {Math.round(effectiveATK(unit))} DEF {Math.round(effectiveDEF(unit))} SPD {Math.round(effectiveSPD(unit) * 10) / 10}
        </div>
        <div className="uc-tags">
          <span className="uc-tag uc-tag-next">
            {isCurrentTurn ? '⏳行動中' : `下次 ${Math.ceil(ticks / 10)}s`}
          </span>
          {unit.assignedCardName && <span className="uc-tag uc-tag-flower">🃏 {unit.assignedCardName}</span>}
          {statusTagTexts(unit, clock).map((text, i) => {
            return <span key={i} className="uc-tag uc-tag-status" title={text}>{text}</span>
          })}
        </div>
      </div>
      {!unit.alive && <div className="uc-dead-overlay">陣亡</div>}
    </div>
  )
}

// ─── MoveGrid — 精簡按鈕：只留名稱+消耗；威力/命中/目標規則/描述/圖片
//     改成滑鼠移到按鈕上時浮出視窗（portal 到 body，不會被面板裁掉） ─────────

function MovePopup({ move, slot, anchor }: { move: Move; slot: MoveSlot; anchor: DOMRect }) {
  const img   = getMoveImg(move.id)
  const stats = move.powerRatio != null
    ? `威力${move.powerRatio} 命中${Math.round((move.hitRate ?? 0) * 100)}%`
      + (move.critRate ? ` 爆擊${Math.round(move.critRate * 100)}%` : '')
      + (move.effectChance > 0 && move.effectChance < 1 ? ` 觸發${Math.round(move.effectChance * 100)}%` : '')
    : '（支援型招式）'
  const rule = moveTargetRule(move)
  const cx = Math.min(Math.max(anchor.left + anchor.width / 2, 150), window.innerWidth - 150)
  return createPortal(
    <div className="move-pop" style={{ left: cx, bottom: window.innerHeight - anchor.top + 8 }}>
      {img && <img src={img} className="move-pop-img" alt="" />}
      <div className="move-pop-name" style={{ color: SLOT_COLOR[slot] }}>{move.name}</div>
      <div className="move-pop-stats">{stats}</div>
      {rule && <div className="move-pop-rule">{rule}</div>}
      {move.description && <div className="move-pop-desc">{move.description}</div>}
    </div>,
    document.body
  )
}

// ─── AtbPopup — 順序條 chip 精簡後的完整資訊浮窗（滑入/點擊顯示，portal 到 body）───

function AtbPopup({ unit, clock, mySide, anchor }: { unit: Unit; clock: number; mySide: 'A' | 'B'; anchor: DOMRect }) {
  const ticks = Math.max(0, unit.nextActionAt - clock)
  const isMine = unit.side === mySide
  const cx = Math.min(Math.max(anchor.left + anchor.width / 2, 110), window.innerWidth - 110)
  return createPortal(
    <div className="atb-pop" style={{ left: cx, top: anchor.bottom + 6 }}>
      <div className="atb-pop-name" style={{ color: EL_COLOR[unit.element] }}>
        {EL_ICON[unit.element]} {unit.name}
        <span className={`atb-pop-side ${isMine ? 'mine' : 'enemy'}`}>{isMine ? '我方' : '敵方'}</span>
      </div>
      <div className="atb-pop-stats">
        {getSlotLabel(unit.side, unit.slot)}排 · HP {unit.hp}/{unit.maxHp} ·
        ATK {effectiveATK(unit)} DEF {effectiveDEF(unit)} SPD {effectiveSPD(unit)}
      </div>
      <div className="atb-pop-time">{ticks === 0 ? '⚡ 行動中' : `⏳ ${Math.ceil(ticks / 10)}s 後行動`}</div>
      {unit.assignedCardName && <div className="atb-pop-tags"><span className="uc-tag uc-tag-flower">🃏 {unit.assignedCardName}</span></div>}
      {unit.statuses.length > 0 && (
        <div className="atb-pop-tags">
          {statusTagTexts(unit, clock).map((text, i) => (
            <span key={i} className="uc-tag">{text}</span>
          ))}
        </div>
      )}
    </div>,
    document.body
  )
}

function MoveGrid({ unit, clock, suitInHand, picked, onPick, readOnly }: {
  unit: Unit; clock: number
  suitInHand?: Record<string, number>
  picked?: MoveSlot | null
  onPick?: (s: MoveSlot) => void
  readOnly?: boolean
}) {
  const lib = unit.statuses.some(s => s.key === 'liberated')
  const blocked = unit.statuses.some(s => s.key === 'sealed')
  const [hover, setHover] = useState<{ slot: MoveSlot; rect: DOMRect } | null>(null)
  // 換角色時清掉殘留的浮窗
  useEffect(() => { setHover(null) }, [unit.id])
  return (
    <div className="act-movegrid">
      {MOVE_SLOTS.map(slot => {
        const move = unit.moves[slot]
        if (!move) return null
        const need   = lib ? 1 : (move.condition ?? 1)
        const have   = suitInHand ? (suitInHand[SUIT_FOR[slot]] ?? 0) : need
        const canUse = have >= need
        const onCD   = (unit.moveCooldownUntil[move.id] ?? 0) > clock
        const ok     = canUse && !onCD && !blocked && !readOnly && !!onPick
        return (
          // 不用 disabled 屬性：disabled 的按鈕不會觸發 mouseenter，浮窗會失效
          <button key={slot}
            className={`movebtn ${picked === slot ? 'picked' : ''} ${readOnly ? 'movebtn-ro' : ''} ${!ok ? 'movebtn-off' : ''}`}
            onClick={() => ok && onPick?.(slot)}
            onMouseEnter={e => setHover({ slot, rect: e.currentTarget.getBoundingClientRect() })}
            onMouseLeave={() => setHover(null)}>
            <div className="movebtn-line1">
              <b>{move.name}</b>
              <span className={`suitchip sc-${slot}`}>{slot}×{need}</span>
              {onCD && <span className="movebtn-cdchip">⏳冷卻中</span>}
            </div>
          </button>
        )
      })}
      {blocked && <div className="movebtn-blocked-warn">此角色目前處於「封招」狀態，無法使用招式。</div>}
      {hover && unit.moves[hover.slot] && (
        <MovePopup move={unit.moves[hover.slot]!} slot={hover.slot} anchor={hover.rect} />
      )}
    </div>
  )
}

// ─── Card faces — 照抄參考版 renderCardFace()：花色計數小卡 + 花牌卡 ───────

function SuitCountCard({ slot, cardId, name, count, onDiscard }: {
  slot: MoveSlot; cardId: string; name: string; count: number; onDiscard?: () => void
}) {
  const img = getCardImg(cardId)
  return (
    <div className={`cardface suit-${slot} ${count === 0 ? 'cf-empty' : ''}`}>
      <div className="cf-corner" style={{ color: SLOT_COLOR[slot] }}>{SUIT_ICON[slot]} {slot}</div>
      {img
        ? <img src={img} className="cf-img" alt="" onError={e => { e.currentTarget.style.display = 'none' }} />
        : <div className="cf-bigicon">{SUIT_ICON[slot]}</div>
      }
      <div className="cf-name">{name}</div>
      <div className="cf-badge">×{count}</div>
      {onDiscard && <button className="cf-discard" title="棄1張" onClick={onDiscard}>×</button>}
    </div>
  )
}

function FlowerCardFace({ card, disabled, onUse, onDiscard }: {
  card: Card; disabled: boolean; onUse: () => void; onDiscard?: () => void
}) {
  const img = getCardImg(card.id)
  return (
    <div className={`cardface suit-flower ${disabled ? 'cf-disabled' : ''}`}>
      <div className="cf-corner" style={{ color: '#b499e8' }}>✿ 花</div>
      {img
        ? <img src={img} className="cf-img" alt="" onError={e => { e.currentTarget.style.display = 'none' }} />
        : <div className="cf-bigicon">✿</div>
      }
      <div className="cf-name">{card.name}</div>
      {card.description && <div className="cf-desc">{card.description}</div>}
      <button className="cf-use" disabled={disabled} onClick={e => { e.stopPropagation(); onUse() }}>
        {disabled ? '本次已使用' : '使用'}
      </button>
      {onDiscard && <button className="cf-discard" title="棄牌" onClick={e => { e.stopPropagation(); onDiscard() }}>×</button>}
    </div>
  )
}
