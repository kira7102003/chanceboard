import { useState, useRef, useEffect, useCallback } from 'react'
import './Logistics.css'
import { moves as defaultMoves, cards as allCards } from '../data/db'
import { getChars, saveChars, resetChars, getCharImg, getUrlByKey, uploadByKey, removeByKey, onCloudSynced, onCloudSave, getMoveOverrides, saveMoveOverride, resetMoveOverride } from '../utils/charStore'
import { removePixelBackground } from '../utils/removePixelBackground'
import { CARD_ICON } from '../data/cardIcons'
import type { Character } from '../types/character'
import type { Move, RangeType, Scope } from '../types/move'
import { DEFAULT_DAILY_REWARD, getDailyRewards, localDateKey, saveDailyRewardSettings } from '../utils/dailyRewards'
import type { DailyReward } from '../utils/dailyRewards'
import { runAllMoveTests, runWinRateLadder } from '../engine/diagnostics'
import type { MoveTestReport, LadderReport } from '../engine/diagnostics'
import { getChapterFlow, getChapterSegments, getStoryChapters, saveStoryChapters, type StoryChapter, type StoryFlowNode, type StorySegment } from '../utils/storyStore'
import { getBattleBackgroundNames, getBoardCharacters, saveBoardCharacters } from '../utils/boardCharacters'
import StoryFlowDesigner from './StoryFlowDesigner'
import { getLogisticsJobs, saveLogisticsJobs } from '../utils/logisticsStore'
import { supabase } from '../utils/supabase'
import PixelCharacterActor from './PixelCharacterActor'
import { getBgmConfig, saveBgmConfig, type BgmChannel, type BgmConfig } from '../utils/bgmStore'
import PixelSkeletonEditor from './PixelSkeletonEditor'
import { getMiningConfig, saveMiningConfig, type MiningConfig } from '../utils/miningStore'
import { getBattlePresentationStyle, saveBattlePresentationStyle, type BattlePresentationStyle } from '../utils/battlePresentation'

const EL_COLOR: Record<string, string>   = { '劍': '#e87733', '槍': '#22cc77', '法': '#9955ee' }
const SLOT_COLOR: Record<string, string> = { '劍': '#e87733', '槍': '#22cc77', '法': '#9955ee', '願': '#ddaa22', '被': '#666688' }
const SLOT_LABEL: Record<string, string> = { '劍': '⚔ 劍槽', '槍': '🔫 槍槽', '法': '✦ 法槽', '願': '🌠 願槽', '被': '💠 被動' }
const CARD_COLOR: Record<string, string> = { red: '#ee4444', green: '#22cc77', blue: '#5566ee', yellow: '#ddaa22', flower: '#bb55ee' }

interface Props { onBack: () => void }

export default function Admin({ onBack }: Props) {
  const [chars,      setChars]      = useState<Character[]>(() => getChars())
  const [selId,      setSelId]      = useState(chars[0]?.id ?? '')
  const [tab,        setTab]        = useState<'basic' | 'moves' | 'story'>('basic')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return onCloudSave(s => {
      setSaveStatus(s)
      if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current)
      if (s === 'saved' || s === 'error') {
        saveStatusTimer.current = setTimeout(() => setSaveStatus('idle'), 2500)
      }
    })
  }, [])

  const char  = chars.find(c => c.id === selId)
  const moves = defaultMoves.filter(m => m.ownerId === selId)

  const update = useCallback((patch: Partial<Character>) => {
    setChars(prev => {
      const next = prev.map(c => c.id === selId ? { ...c, ...patch } : c)
      saveChars(next); return next
    })
  }, [selId])

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(chars, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    Object.assign(document.createElement('a'), { href: url, download: 'cb_chars.json' }).click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const r = new FileReader()
    r.onload = ev => {
      try { const d: Character[] = JSON.parse(ev.target!.result as string); saveChars(d); setChars(d) }
      catch { alert('JSON 格式錯誤') }
    }
    r.readAsText(file); e.target.value = ''
  }

  const handleReset = () => {
    if (!confirm('還原所有角色到預設值（圖片不會清除）？')) return
    resetChars(); setChars(getChars())
  }

  const handleAddChar = () => {
    const maxNum = chars.reduce((m, c) => {
      const n = parseInt(c.id, 10); return isNaN(n) ? m : Math.max(m, n)
    }, 0)
    const newId = String(maxNum + 1).padStart(3, '0')
    const newChar: Character = {
      id: newId, name: `新角色 ${newId}`, title: '?',
      gender: 'male', element: '劍',
      hp: 8, atk: 8, def: 8, spd: 8,
      moveNameSword: '?', moveNameGun: '?', moveNameMagic: '?', moveNameWish: '?', passiveName: '?',
    }
    const next = [...chars, newChar]
    saveChars(next); setChars(next); setSelId(newId); setTab('basic')
  }

  return (
    <div className="adm">
      {/* ── top bar ── */}
      <div className="adm-bar">
        <span className="adm-bar-title">奇蹟之盤 — 資料編輯器</span>
        <span className="adm-save-status" data-status={saveStatus}>
          {saveStatus === 'saving' && '↑ 同步中...'}
          {saveStatus === 'saved'  && '✓ 已儲存至雲端'}
          {saveStatus === 'error'  && '✗ 同步失敗'}
        </span>
        <div className="adm-bar-actions">
          <button className="btn sm" onClick={handleExport}>↓ 匯出 JSON</button>
          <label className="btn sm" style={{ cursor: 'pointer' }}>
            ↑ 匯入 JSON
            <input ref={importRef} type="file" accept=".json" onChange={handleImport} hidden />
          </label>
          <button className="btn sm danger" onClick={handleReset}>還原預設</button>
          <button className="btn sm" onClick={onBack}>← 返回</button>
        </div>
      </div>

      <div className="adm-body">
        {/* ── character list ── */}
        <div className="adm-list">
          {/* Background settings entry */}
          <div
            className={`adm-list-item ${selId === '__bg__' ? 'active' : ''}`}
            onClick={() => { setSelId('__bg__'); setTab('basic') }}
          >
            <div style={{
              width: 38, height: 68, borderRadius: 6, background: '#111122', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>🖼</div>
            <div className="adm-list-text">
              <div className="adm-list-name" style={{ color: '#c8a15a' }}>背景設定</div>
              <div className="adm-list-sub">大廳 · 戰鬥</div>
            </div>
          </div>
          <div
            className={`adm-list-item ${selId === '__story__' ? 'active' : ''}`}
            onClick={() => { setSelId('__story__'); setTab('basic') }}
          >
            <div className="adm-list-tool-icon">♟</div>
            <div className="adm-list-text">
              <div className="adm-list-name" style={{ color: '#c8a15a' }}>故事模式設定</div>
              <div className="adm-list-sub">兵～國王 · 六章地圖</div>
            </div>
          </div>
          <div className={`adm-list-item ${selId === '__logistics__' ? 'active' : ''}`} onClick={() => { setSelId('__logistics__'); setTab('basic') }}>
            <div className="adm-list-tool-icon">🧰</div><div className="adm-list-text"><div className="adm-list-name" style={{ color: '#c8a15a' }}>後勤設定</div><div className="adm-list-sub">工作 · 動畫 · 資源</div></div>
          </div>
          <div className={`adm-list-item ${selId === '__mining__' ? 'active' : ''}`} onClick={() => { setSelId('__mining__'); setTab('basic') }}>
            <div className="adm-list-tool-icon">⛏</div><div className="adm-list-text"><div className="adm-list-name" style={{ color: '#c8a15a' }}>挖礦設定</div><div className="adm-list-sub">礦點 · 血量 · 每週加成</div></div>
          </div>
          <div className={`adm-list-item ${selId === '__battlefx__' ? 'active' : ''}`} onClick={() => { setSelId('__battlefx__'); setTab('basic') }}>
            <div className="adm-list-tool-icon">⚔</div><div className="adm-list-text"><div className="adm-list-name" style={{ color: '#c8a15a' }}>戰鬥特效設定</div><div className="adm-list-sub">原版／梯形對決演出</div></div>
          </div>
          {/* Card images entry */}
          <div
            className={`adm-list-item ${selId === '__cards__' ? 'active' : ''}`}
            onClick={() => { setSelId('__cards__'); setTab('basic') }}
          >
            <div style={{
              width: 38, height: 68, borderRadius: 6, background: '#111122', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>🎴</div>
            <div className="adm-list-text">
              <div className="adm-list-name" style={{ color: '#c8a15a' }}>牌組圖片</div>
              <div className="adm-list-sub">26 張卡牌</div>
            </div>
          </div>
          <div
            className={`adm-list-item ${selId === '__daily__' ? 'active' : ''}`}
            onClick={() => { setSelId('__daily__'); setTab('basic') }}
          >
            <div style={{
              width: 38, height: 68, borderRadius: 6, background: '#111122', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>📅</div>
            <div className="adm-list-text">
              <div className="adm-list-name" style={{ color: '#c8a15a' }}>每日簽到設定</div>
              <div className="adm-list-sub">上月～下下月</div>
            </div>
          </div>
          <div
            className={`adm-list-item ${selId === '__tests__' ? 'active' : ''}`}
            onClick={() => { setSelId('__tests__'); setTab('basic') }}
          >
            <div className="adm-list-tool-icon">🧪</div>
            <div className="adm-list-text">
              <div className="adm-list-name" style={{ color: '#c8a15a' }}>角色測試</div>
              <div className="adm-list-sub">招式 LOG · 勝率天梯</div>
            </div>
          </div>
          <div style={{ height: 1, background: 'rgba(200,161,90,.12)', margin: '2px 0' }} />
          {chars.map((c, i) => (
            <div key={c.id}
              className={`adm-list-item ${c.id === selId ? 'active' : ''}`}
              style={{ opacity: c.enabled === false ? 0.45 : 1 }}
              onClick={() => { setSelId(c.id); setTab('basic') }}
            >
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <CharPortrait id={c.id} size={38} height={68} />
                <span style={{
                  position: 'absolute', top: 2, left: 2,
                  background: 'rgba(0,0,0,.65)', color: '#aaa',
                  fontSize: 9, lineHeight: 1, padding: '1px 3px', borderRadius: 3,
                }}>{i + 1}</span>
                {c.enabled === false && (
                  <span style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', background: 'rgba(0,0,0,.5)',
                    fontSize: 10, color: '#888', borderRadius: 6,
                  }}>停用</span>
                )}
              </div>
              <div className="adm-list-text">
                <div className="adm-list-name" style={{ color: EL_COLOR[c.element] }}>{c.name}</div>
                <div className="adm-list-sub">{c.title}</div>
              </div>
            </div>
          ))}
          <button
            onClick={handleAddChar}
            style={{
              margin: '6px 8px', padding: '7px 0', borderRadius: 6,
              background: 'rgba(200,161,90,.08)', border: '1px dashed rgba(200,161,90,.3)',
              color: '#c8a15a', fontSize: 11, cursor: 'pointer', width: 'calc(100% - 16px)',
            }}
          >＋ 新增角色</button>
        </div>

        {/* ── editor ── */}
        <div className="adm-editor">
          {selId === '__bg__' ? (
            <BgSettings />
          ) : selId === '__story__' ? (
            <div className="adm-panel"><StorySettings /></div>
          ) : selId === '__logistics__' ? (
            <div className="adm-panel"><LogisticsSettings /></div>
          ) : selId === '__mining__' ? (
            <div className="adm-panel"><MiningSettings chars={chars} /></div>
          ) : selId === '__battlefx__' ? (
            <div className="adm-panel"><BattlePresentationSettings /></div>
          ) : selId === '__cards__' ? (
            <div className="adm-panel"><CardImgSettings /></div>
          ) : selId === '__daily__' ? (
            <div className="adm-panel"><DailyRewardSettings /></div>
          ) : selId === '__tests__' ? (
            <div className="adm-panel"><CharacterDiagnostics chars={chars} /></div>
          ) : char ? (
            <>
              <div className="adm-tabs">
                {(['basic', 'moves', 'story'] as const).map(t => (
                  <button key={t} className={`adm-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                    {{ basic: '基本資料', moves: '招式', story: '角色故事' }[t]}
                  </button>
                ))}
              </div>

              <div className="adm-panel">
                {tab === 'basic' && <BasicTab char={char} onUpdate={update} />}
                {tab === 'moves' && <MovesTab moves={moves} />}
                {tab === 'story' && <StoryTab char={char} onUpdate={update} />}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function BattlePresentationSettings() {
  const [style, setStyle] = useState<BattlePresentationStyle>(() => getBattlePresentationStyle())
  const choose = (next: BattlePresentationStyle) => { setStyle(next); saveBattlePresentationStyle(next) }
  return <div className="adm-basic"><div className="diag-head"><div><h2>⚔ 戰鬥動畫特效</h2><p>切換招式施放時的全畫面演出；設定會套用到單人與雙人戰鬥。</p></div></div><section className="adm-section"><div className="adm-section-label">演出樣式</div><div className="battle-fx-options"><button className={style==='classic'?'active':''} onClick={()=>choose('classic')}><b>原本特效</b><span>招式圖片與受擊立繪並列</span></button><button className={style==='trapezoid'?'active':''} onClick={()=>choose('trapezoid')}><b>梯形對決特效</b><span>梯形招式圖＋大型屬性字＋受擊立繪</span></button></div></section></div>
}

function CharacterDiagnostics({ chars }: { chars: Character[] }) {
  const [moveReport, setMoveReport] = useState<MoveTestReport | null>(() => {
    try { return JSON.parse(localStorage.getItem('cb_last_move_test_report') ?? 'null') } catch { return null }
  })
  const [ladderReport, setLadderReport] = useState<LadderReport | null>(() => {
    try { return JSON.parse(localStorage.getItem('cb_last_ladder_report') ?? 'null') } catch { return null }
  })
  const [gamesPerPair, setGamesPerPair] = useState(2)
  const [ladderMode, setLadderMode] = useState<'1v1' | '3v3'>('3v3')
  const [testPassiveImages, setTestPassiveImages] = useState(false)
  const [runningMoves, setRunningMoves] = useState(false)
  const [runningLadder, setRunningLadder] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [showMatchLog, setShowMatchLog] = useState(false)

  const testMoves = () => {
    setRunningMoves(true)
    setMoveReport(null)
    setTimeout(async () => {
      try {
        const report = { ...(await runAllMoveTests(chars, testPassiveImages)), testedAt: new Date().toISOString() }
        try { localStorage.setItem('cb_last_move_test_report', JSON.stringify(report)) }
        catch (error) { console.warn('[diagnostics] 無法儲存招式測試 LOG', error) }
        setMoveReport(report)
      }
      finally { setRunningMoves(false) }
    }, 0)
  }

  const testLadder = async () => {
    setRunningLadder(true)
    setLadderReport(null)
    setProgress({ done: 0, total: 0 })
    try {
      const report = await runWinRateLadder(gamesPerPair, (done, total) => setProgress({ done, total }), chars, ladderMode)
      const savedReport = { ...report, testedAt: new Date().toISOString() }
      try { localStorage.setItem('cb_last_ladder_report', JSON.stringify(savedReport)) }
      catch (error) { console.warn('[diagnostics] 無法儲存天梯測試 LOG', error) }
      setLadderReport(savedReport)
    } finally {
      setRunningLadder(false)
    }
  }

  return (
    <div className="diag">
      <div className="diag-head">
        <div>
          <h2>🧪 角色測試中心</h2>
          <p>直接使用目前遊戲引擎測試全部角色；測試結果只顯示 LOG，不會修改玩家資料。</p>
        </div>
      </div>

      <section className="diag-card">
        <div className="diag-card-head">
          <div><h3>全角色招式／被動測試</h3><p>{chars.length} 名角色 × 5 項，並測試每張花牌、每個主動招式、每個對手及 3v3 混戰；未來新增資料會自動加入。</p></div>
          <div className="diag-ladder-actions">
            <label><input type="checkbox" checked={testPassiveImages} disabled={runningMoves}
              onChange={event => setTestPassiveImages(event.target.checked)} /> 測試被動圖片</label>
            <button className="btn primary" disabled={runningMoves || runningLadder} onClick={testMoves}>
              {runningMoves ? '測試中…' : `開始測試 ${chars.length * 5} 項`}
            </button>
          </div>
        </div>
        {moveReport && (
          <>
            <div className="diag-checklist">
              {moveReport.checklist.map(check => (
                <div key={check.label} className={check.ok ? 'ok' : 'error'}>
                  <span>{check.ok ? '✓' : '✗'}</span>
                  <b>{check.label}</b>
                  <small>{check.detail}</small>
                </div>
              ))}
            </div>
            <div className={`diag-summary ${moveReport.failed ? 'failed' : 'passed'}`}>
              {moveReport.failed ? '✗' : '✓'} PASS {moveReport.passed}/{moveReport.total}
              <span>失敗 {moveReport.failed} · {Math.round(moveReport.durationMs)}ms{moveReport.testedAt ? ` · 最後測試 ${new Date(moveReport.testedAt).toLocaleString('zh-TW')}` : ''}</span>
            </div>
            <div className="diag-log">
              {moveReport.lines.map((line, index) => (
                <div key={`${line.characterId}-${line.item}-${index}`} className={`diag-log-line ${line.ok ? 'ok' : 'error'}`}>
                  <span>{line.ok ? 'PASS' : 'FAIL'}</span>
                  <b>{line.characterId} {line.characterName}</b>
                  <em>{line.item}</em>
                  <small>{line.message}</small>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="diag-card">
        <div className="diag-card-head">
          <div><h3>勝率天梯測試</h3><p>可測 1v1 個人戰或 3v3 混合隊伍戰；都會實際抽牌、使用花牌、支付招式牌及交換 A／B 方。</p></div>
          <div className="diag-ladder-actions">
            <div className="diag-mode-tabs">
              <button className={ladderMode === '1v1' ? 'active' : ''} disabled={runningLadder} onClick={() => setLadderMode('1v1')}>1 對 1</button>
              <button className={ladderMode === '3v3' ? 'active' : ''} disabled={runningLadder} onClick={() => setLadderMode('3v3')}>3 對 3</button>
            </div>
            <label>每組對戰
              <input type="number" min="2" max="20" value={gamesPerPair}
                disabled={runningLadder} onChange={event => setGamesPerPair(Math.max(2, Math.min(20, Number(event.target.value) || 2)))} /> 場
            </label>
            <button className="btn primary" disabled={runningMoves || runningLadder} onClick={testLadder}>
              {runningLadder ? `${ladderMode} 天梯運算中…` : `開始 ${ladderMode} 勝率天梯`}
            </button>
          </div>
        </div>
        {runningLadder && (
          <div className="diag-progress">
            <div style={{ width: `${progress.total ? progress.done / progress.total * 100 : 0}%` }} />
            <span>{progress.done} / {progress.total || '計算中'}</span>
          </div>
        )}
        {ladderReport && (
          <>
            <div className={`diag-summary ${ladderReport.errors ? 'failed' : 'passed'}`}>✓ {ladderReport.mode} 完成 {ladderReport.totalMatches} 場
              <span>招式出手 {ladderReport.movesExecuted} 次 · 劍槍法願牌消耗 {ladderReport.suitCardsSpent} 張 · 花牌使用 {ladderReport.flowerCardsPlayed} 次 · 錯誤 {ladderReport.errors} · 每組 {ladderReport.gamesPerPair} 場 · {(ladderReport.durationMs / 1000).toFixed(2)}s{ladderReport.testedAt ? ` · 最後測試 ${new Date(ladderReport.testedAt).toLocaleString('zh-TW')}` : ''}</span>
            </div>
            <div className="diag-table-wrap"><table className="diag-table">
              <thead><tr><th>排名</th><th>角色</th><th>積分</th><th>場次</th><th>勝</th><th>敗</th><th>和</th><th>勝率</th></tr></thead>
              <tbody>{ladderReport.rows.map(row => <tr key={row.characterId}>
                <td className="diag-rank">{row.rank <= 3 ? ['🥇','🥈','🥉'][row.rank - 1] : row.rank}</td>
                <td><b>{row.characterName}</b><small>{row.characterId}</small></td>
                <td>{row.points}</td><td>{row.games}</td><td>{row.wins}</td><td>{row.losses}</td><td>{row.draws}</td>
                <td><strong>{row.winRate.toFixed(1)}%</strong></td>
              </tr>)}</tbody>
            </table></div>
            {ladderReport.mode === '3v3' && ladderReport.topTeams.length > 0 && <>
              <h3>勝率最高三人隊伍與手牌使用</h3>
              <div className="diag-table-wrap"><table className="diag-table">
                <thead><tr><th>排名</th><th>三人隊伍</th><th>勝率</th><th>場次</th><th>勝場</th><th>手牌搭配（實際消耗）</th></tr></thead>
                <tbody>{ladderReport.topTeams.map(team => <tr key={team.characterIds.join('-')}>
                  <td className="diag-rank">{['🥇','🥈','🥉'][team.rank - 1]}</td>
                  <td><b>{team.characterNames.join('／')}</b></td>
                  <td><strong>{team.winRate.toFixed(1)}%</strong></td><td>{team.games}</td><td>{team.wins}</td>
                  <td>劍 {team.cardUsage.劍} · 槍 {team.cardUsage.槍} · 法 {team.cardUsage.法} · 願 {team.cardUsage.願} · 花 {team.flowerCardsPlayed}</td>
                </tr>)}</tbody>
              </table></div>
            </>}
            <button className="btn sm" onClick={() => setShowMatchLog(value => !value)}>
              {showMatchLog ? '收起完整對戰 LOG' : `顯示完整對戰 LOG（${ladderReport.log.length} 筆）`}
            </button>
            {showMatchLog && <div className="diag-match-log">{ladderReport.log.map((line, index) => <div key={index}>{line}</div>)}</div>}
          </>
        )}
      </section>
    </div>
  )
}

function DailyRewardSettings() {
  const [monthOffset, setMonthOffset] = useState(0)
  const [rewards, setRewards] = useState<Record<string, DailyReward>>(() => getDailyRewards())
  const [status, setStatus] = useState('')
  const now = new Date()
  const month = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const today = localDateKey()
  const labels = ['上月', '本月', '下月', '下下月']

  const dateKeyFor = (day: number) => localDateKey(new Date(month.getFullYear(), month.getMonth(), day))
  const updateDay = (dateKey: string, field: keyof DailyReward, value: number) => {
    if (dateKey < today) return
    setRewards(prev => ({
      ...prev,
      [dateKey]: { ...(prev[dateKey] ?? DEFAULT_DAILY_REWARD), [field]: Math.max(0, value || 0) },
    }))
  }
  const save = async () => {
    const editable = Object.fromEntries(Object.entries(rewards).filter(([dateKey]) => dateKey >= today))
    setStatus('儲存中…')
    try {
      await saveDailyRewardSettings(editable)
      setStatus('✓ 已儲存至雲端')
    } catch (error) {
      console.error('[dailyRewards] save failed', error)
      setStatus('✗ 儲存失敗')
    }
  }

  return (
    <div className="daily-admin">
      <div className="daily-admin-head">
        <div>
          <h2>📅 每日簽到設定</h2>
          <p>未另外設定的日期，預設為 💰 金幣 +200、💎 鑽石 +5。過去日期不可修改。</p>
        </div>
        <button className="btn primary" onClick={save}>儲存設定</button>
      </div>
      <div className="daily-month-tabs">
        {labels.map((label, index) => (
          <button key={label} className={`adm-tab ${monthOffset === index - 1 ? 'active' : ''}`}
            onClick={() => setMonthOffset(index - 1)}>{label}</button>
        ))}
      </div>
      <div className="daily-month-title">{month.getFullYear()} 年 {month.getMonth() + 1} 月</div>
      <div className="daily-admin-grid">
        {Array.from({ length: days }, (_, index) => index + 1).map(day => {
          const dateKey = dateKeyFor(day)
          const reward = rewards[dateKey] ?? DEFAULT_DAILY_REWARD
          const past = dateKey < today
          return (
            <div key={dateKey} className={`daily-admin-day${past ? ' past' : ''}`}>
              <b>{day} 日</b>
              <label>💰 <input type="number" min="0" disabled={past} value={reward.coins}
                onChange={e => updateDay(dateKey, 'coins', Number(e.target.value))} /></label>
              <label>💎 <input type="number" min="0" disabled={past} value={reward.gems}
                onChange={e => updateDay(dateKey, 'gems', Number(e.target.value))} /></label>
            </div>
          )
        })}
      </div>
      {status && <div className="daily-admin-status">{status}</div>}
    </div>
  )
}

// ─── CharPortrait (exported for CharSelect) ───────────────────────────────────

export function CharPortrait({ id, size = 48, height: ht, style: sx }: {
  id: string; size?: number; height?: number; style?: React.CSSProperties
}) {
  const w = size, h = ht ?? size
  const [src,    setSrc]    = useState(() => getCharImg(id))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const off = onCloudSynced(() => { setSrc(getCharImg(id)); setFailed(false) })
    return off
  }, [id])
  useEffect(() => { setSrc(getCharImg(id)); setFailed(false) }, [id])

  if (!src || failed) {
    return (
      <div style={{
        width: w, height: h, borderRadius: 6, background: '#0e1028', flexShrink: 0,
        border: '1px dashed #1e2050', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: Math.max(14, h * .28), color: '#2a2a60', ...sx,
      }}>👤</div>
    )
  }
  return (
    <img src={src} width={w} height={h} alt=""
      style={{ borderRadius: 6, objectFit: 'cover', background: '#111122', flexShrink: 0, ...sx }}
      onError={() => setFailed(true)}
    />
  )
}

// ─── BasicTab ─────────────────────────────────────────────────────────────────

function FacingSelect({ value, onChange }: { value: 'left' | 'right'; onChange: (value: 'left' | 'right') => void }) {
  return <label className="adm-field" style={{ marginTop: 7 }}>
    <span>圖片原始面向（預設左）</span>
    <select className="adm-select" value={value} onChange={event => onChange(event.target.value as 'left' | 'right')}>
      <option value="left">← 面向左</option>
      <option value="right">面向右 →</option>
    </select>
  </label>
}

function BasicTab({ char, onUpdate }: { char: Character; onUpdate: (p: Partial<Character>) => void }) {
  return (
    <div className="adm-basic">
      <div className="adm-basic-cols">

        {/* ── Left: images ── */}
        <div className="adm-basic-imgs">
          <div className="adm-section">
            <div className="adm-section-label">正面（僅選角畫面）</div>
            <ImageCrop storageKey={`cb_img_${char.id}`} />
          </div>
          <div className="adm-section">
            <div className="adm-section-label">側面（戰場立繪與大廳）</div>
            <ImageCrop storageKey={`cb_wide_img_${char.id}`} />
            <FacingSelect value={char.wideImageFacing ?? 'left'} onChange={value => onUpdate({ wideImageFacing: value })} />
          </div>
          <div className="adm-section">
            <div className="adm-section-label">四星以上突破圖片</div>
            <ImageCrop storageKey={`cb_star_img_${char.id}`} />
          </div>
          <div className="adm-section">
            <div className="adm-section-label">角色圖片 A（正面 · 8-bit · 1024×1536）</div>
            <ImageCrop storageKey={`cb_extra_a_img_${char.id}`} cropW={1024} cropH={1536} />
          </div>
          <div className="adm-section">
            <div className="adm-section-label">角色圖片 B（側面 · 8-bit · 1024×1536）</div>
            <ImageCrop storageKey={`cb_extra_b_img_${char.id}`} cropW={1024} cropH={1536} />
            <FacingSelect value={char.extraBImageFacing ?? 'left'} onChange={value => onUpdate({ extraBImageFacing: value })} />
          </div>
          <div className="adm-section">
            <div className="adm-section-label">角色圖片 C（背面 · 8-bit · 1024×1536）</div>
            <ImageCrop storageKey={`cb_extra_c_img_${char.id}`} cropW={1024} cropH={1536} />
          </div>
          <div className="adm-section pixel-action-preview">
            <div className="adm-section-label">8-bit 小遊戲動畫預覽</div>
            <PixelCharacterActor charId={char.id} action="mining" />
            <small>挖礦預覽會使用 B 側面圖與原始朝向；之後可將同一元件套用到伐木、採集與後勤小遊戲。</small>
          </div>
          <div className="adm-section">
            <div className="adm-section-label">8-bit 骨架編輯器（試作）</div>
            <PixelSkeletonEditor charId={char.id} />
          </div>
        </div>

        {/* ── Right: data ── */}
        <div className="adm-basic-data">
          <div className="adm-section">
            <div className="adm-section-label">基本資料</div>
            <div className="adm-field-grid">
              <Field label="名稱"  value={char.name}   onChange={v => onUpdate({ name: v })} />
              <Field label="稱號"  value={char.title}  onChange={v => onUpdate({ title: v })} />
              <label className="adm-field">
                <span>元素</span>
                <select className="adm-select" value={char.element}
                  onChange={e => onUpdate({ element: e.target.value as Character['element'] })}>
                  <option value="劍">⚔ 劍</option>
                  <option value="槍">🔫 槍</option>
                  <option value="法">✦ 法</option>
                </select>
              </label>
              <label className="adm-field">
                <span>性別</span>
                <select className="adm-select" value={char.gender}
                  onChange={e => onUpdate({ gender: e.target.value as Character['gender'] })}>
                  <option value="male">男</option>
                  <option value="female">女</option>
                </select>
              </label>
              <label className="adm-field" style={{ gridColumn: '1 / -1' }}>
                <span>選角顯示</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox"
                    checked={char.enabled !== false}
                    onChange={e => onUpdate({ enabled: e.target.checked ? undefined : false })}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <span style={{ color: char.enabled === false ? '#666' : '#c8a15a', fontSize: 13 }}>
                    {char.enabled === false ? '停用（不顯示在選角畫面）' : '啟用中（顯示在選角畫面）'}
                  </span>
                </label>
              </label>
            </div>
          </div>

          <div className="adm-section">
            <div className="adm-section-label">數值</div>
            <div className="adm-stats">
              {(['hp','atk','def','spd'] as const).map(stat => (
                <div key={stat} className="adm-stat-row">
                  <span className="adm-stat-label">{stat.toUpperCase()}</span>
                  <input type="range" min={1} max={20} className="adm-slider"
                    value={char[stat]}
                    onChange={e => onUpdate({ [stat]: +e.target.value } as Partial<Character>)} />
                  <input type="number" min={1} max={20} className="adm-stat-num"
                    value={char[stat]}
                    onChange={e => onUpdate({ [stat]: Math.min(20, Math.max(1, +e.target.value)) } as Partial<Character>)} />
                </div>
              ))}
            </div>
          </div>

          <div className="adm-section">
            <div className="adm-section-label">每星級能力提升（百分比，預設各 5%）</div>
            {[1, 2, 3, 4, 5].map(star => {
              const bonuses = (char.starBonuses ?? Array.from({ length: 5 }, () => ({ hp: 5, atk: 5, def: 5, spd: 5 }))).map(item => ({ ...item }))
              while (bonuses.length < 5) bonuses.push({ hp: 5, atk: 5, def: 5, spd: 5 })
              const bonus = bonuses[star - 1] ?? { hp: 5, atk: 5, def: 5, spd: 5 }
              return <div className="adm-field-grid" key={star} style={{ marginBottom: 8 }}>
                <b style={{ color: '#e8bd55' }}>{'★'.repeat(star)}</b>
                {(['hp', 'atk', 'def', 'spd'] as const).map(stat => <label className="adm-field" key={stat}>
                  <span>{stat.toUpperCase()} %</span>
                  <input type="number" min={0} max={100} value={bonus[stat]}
                    onChange={event => {
                      const next = bonuses.map(item => ({ ...item }))
                      next[star - 1][stat] = Math.max(0, Math.min(100, Number(event.target.value) || 0))
                      onUpdate({ starBonuses: next })
                    }} />
                </label>)}
              </div>
            })}
          </div>

        </div>

      </div>
    </div>
  )
}

// suit dot + colour per slot
const SUIT_DOT:  Record<string, string> = { red: '🔴', green: '🟢', blue: '🔵', yellow: '🟡' }
const SUIT_OF:   Record<string, string> = { '劍': 'red', '槍': 'green', '法': 'blue', '願': 'yellow' }
const SUIT_NAME: Record<string, string> = { red: '紅牌', green: '綠牌', blue: '藍牌', yellow: '黃牌' }
const RANGE_LBL: Record<string, string> = { '劍': '近戰', '槍': '遠程', '法': '魔法' }

// ─── MovesTab ─────────────────────────────────────────────────────────────────

function MovesTab({ moves: baseMoves }: { moves: Move[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [rev,    setRev]    = useState<Record<string, number>>({})
  const [, forceRender] = useState(0)
  const markSaved = (id: string) => setRev(r => ({ ...r, [id]: (r[id] ?? 0) + 1 }))

  const overrides = getMoveOverrides()
  const moves = baseMoves.map(m => overrides[m.id] ? { ...m, ...overrides[m.id] } as Move : m)

  if (!moves.length) return <div className="adm-empty">此角色沒有招式資料</div>
  return (
    <div className="adm-moves">
      {moves.map(m => {
        const suitColor = SUIT_OF[m.slot]
        const dot       = suitColor ? SUIT_DOT[suitColor] : null
        const cost      = m.condition ?? 1
        const isOpen    = openId === m.id
        const isEdit    = editId === m.id
        const hasOverride = !!overrides[m.id]

        return (
          <div key={m.id} className="adm-move" style={{ borderLeftColor: SLOT_COLOR[m.slot] }}>

            <div className="adm-move-body">
              {/* ── Left: image ── */}
              <div className="adm-move-img-col">
                <MoveImg storageKey={`cb_move_img_${m.id}`} rev={rev[m.id] ?? 0} />
                <button className="btn sm" style={{ marginTop: 6, width: '100%', fontSize: 10 }}
                  onClick={() => { setOpenId(isOpen ? null : m.id); setEditId(null) }}>
                  {isOpen ? '收起' : '設定圖片'}
                </button>
                <button className="btn sm" style={{ marginTop: 4, width: '100%', fontSize: 10,
                  background: isEdit ? 'rgba(200,161,90,.15)' : undefined }}
                  onClick={() => { setEditId(isEdit ? null : m.id); setOpenId(null) }}>
                  {isEdit ? '收起' : '編輯數值'}
                </button>
                {hasOverride && (
                  <button className="btn sm danger" style={{ marginTop: 4, width: '100%', fontSize: 10 }}
                    onClick={() => { resetMoveOverride(m.id); forceRender(n => n + 1) }}>
                    重設預設
                  </button>
                )}
              </div>

              {/* ── Right: info ── */}
              <div className="adm-move-info">
                <div className="adm-move-hdr">
                  <span style={{ color: SLOT_COLOR[m.slot], fontWeight: 900, fontSize: 11 }}>{SLOT_LABEL[m.slot]}</span>
                  <b style={{ color: '#d8dcf4', fontSize: 15 }}>{m.name}</b>
                  {hasOverride && <span style={{ fontSize: 9, color: '#c8a15a', marginLeft: 6 }}>✎ 已修改</span>}
                </div>

                <div className="adm-move-cost">
                  {dot
                    ? <span className="adm-cost-badge" style={{ color: SLOT_COLOR[m.slot] }}>
                        啟動條件：{dot} {SUIT_NAME[suitColor]} × {cost}
                      </span>
                    : <span className="adm-cost-badge" style={{ color: '#888' }}>被動 — 不消耗手牌</span>
                  }
                </div>

                <div className="adm-move-stats">
                  {m.rangeType  != null && <Pill label="範圍" val={RANGE_LBL[m.rangeType] ?? m.rangeType} />}
                  {m.scope      != null && <Pill label="目標" val={m.scope === '群' ? '群體' : '單體'} />}
                  {m.powerRatio != null && <Pill label="威力" val={`×${m.powerRatio}`} />}
                  {m.hitRate    != null && <Pill label="命中" val={`${Math.round(m.hitRate * 100)}%`} />}
                  {m.critRate   != null && <Pill label="爆擊" val={`${Math.round(m.critRate * 100)}%`} />}
                  {m.cooldown   != null && <Pill label="CD"   val={`${m.cooldown}回合`} />}
                </div>

                <div className="adm-move-desc">{m.description || '—'}</div>
              </div>
            </div>

            {isEdit && (
              <MoveEditForm move={m} onSave={() => { setEditId(null); forceRender(n => n + 1) }} />
            )}

            {isOpen && (
              <div className="adm-move-crop">
                <label className="adm-field"><span>招式名稱</span><input value={m.name} onChange={event => { saveMoveOverride(m.id, { name: event.target.value }); forceRender(value => value + 1) }} /></label>
                <ImageCrop storageKey={`cb_move_img_${m.id}`} onSave={() => markSaved(m.id)} />
                <FacingSelect value={m.imageFacing ?? 'left'} onChange={value => {
                  saveMoveOverride(m.id, { imageFacing: value }); forceRender(n => n + 1)
                }} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── MoveEditForm ─────────────────────────────────────────────────────────────

function MoveEditForm({ move, onSave }: { move: Move; onSave: () => void }) {
  const [name,       setName]       = useState(move.name)
  const [condition,  setCondition]  = useState<string>(move.condition != null ? String(move.condition) : '')
  const [rangeType,  setRangeType]  = useState<string>(move.rangeType ?? '')
  const [scope,      setScope]      = useState<string>(move.scope ?? '')
  const [powerRatio, setPowerRatio] = useState<string>(move.powerRatio != null ? String(move.powerRatio) : '')
  const [hitRate,    setHitRate]    = useState<string>(move.hitRate    != null ? String(Math.round(move.hitRate * 100)) : '')
  const [critRate,   setCritRate]   = useState<string>(move.critRate   != null ? String(Math.round(move.critRate * 100)) : '')
  const [cooldown,   setCooldown]   = useState<string>(move.cooldown   != null ? String(move.cooldown) : '')
  const [desc,       setDesc]       = useState(move.description)

  const num = (s: string) => s.trim() === '' ? null : Number(s)
  const pct = (s: string) => s.trim() === '' ? null : Number(s) / 100

  const handleSave = () => {
    saveMoveOverride(move.id, {
      name,
      condition:  num(condition),
      rangeType:  (rangeType  || null) as RangeType,
      scope:      (scope      || null) as Scope,
      powerRatio: num(powerRatio),
      hitRate:    pct(hitRate),
      critRate:   pct(critRate),
      cooldown:   num(cooldown),
      description: desc,
    })
    onSave()
  }

  const row = (label: string, node: React.ReactNode) => (
    <label className="adm-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <span style={{ minWidth: 60, fontSize: 11 }}>{label}</span>
      {node}
    </label>
  )

  return (
    <div className="adm-move-edit-form">
      <div className="adm-move-edit-grid">
        {row('招式名稱',
          <input className="adm-input" value={name} onChange={e => setName(e.target.value)} style={{ flex: 1 }} />
        )}
        {row('攻擊範圍',
          <select className="adm-select" value={rangeType} onChange={e => setRangeType(e.target.value)}>
            <option value="">— 無（被動）</option>
            <option value="劍">⚔ 近戰（劍）</option>
            <option value="槍">🔫 遠程（槍）</option>
            <option value="法">✦ 魔法（法）</option>
          </select>
        )}
        {row('目標範圍',
          <select className="adm-select" value={scope} onChange={e => setScope(e.target.value)}>
            <option value="">— 無</option>
            <option value="單">單體</option>
            <option value="群">群體</option>
          </select>
        )}
        {row('啟動費用',
          <input className="adm-input" type="number" min={1} max={10} value={condition}
            onChange={e => setCondition(e.target.value)}
            placeholder="空=被動" style={{ width: 80 }} />
        )}
        {row('威力倍率',
          <input className="adm-input" type="number" min={0} step={0.05} value={powerRatio}
            onChange={e => setPowerRatio(e.target.value)}
            placeholder="空=不計" style={{ width: 80 }} />
        )}
        {row('命中率 %',
          <input className="adm-input" type="number" min={0} max={100} value={hitRate}
            onChange={e => setHitRate(e.target.value)}
            placeholder="空=不計" style={{ width: 80 }} />
        )}
        {row('爆擊率 %',
          <input className="adm-input" type="number" min={0} max={100} value={critRate}
            onChange={e => setCritRate(e.target.value)}
            placeholder="空=不計" style={{ width: 80 }} />
        )}
        {row('冷卻回合',
          <input className="adm-input" type="number" min={0} value={cooldown}
            onChange={e => setCooldown(e.target.value)}
            placeholder="空=無CD" style={{ width: 80 }} />
        )}
        <label className="adm-field" style={{ gridColumn: '1 / -1' }}>
          <span style={{ fontSize: 11 }}>招式說明</span>
          <textarea className="adm-input" rows={2}
            value={desc} onChange={e => setDesc(e.target.value)}
            style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 12 }} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button className="btn primary sm" onClick={handleSave}>儲存修改</button>
        <button className="btn sm" onClick={onSave}>取消</button>
      </div>
    </div>
  )
}

function MoveImg({ storageKey, rev }: { storageKey: string; rev: number }) {
  const [src,    setSrc]    = useState(() => getUrlByKey(storageKey))
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setSrc(getUrlByKey(storageKey))
    setFailed(false)
  }, [storageKey, rev])

  return src && !failed
    ? <img src={src} alt=""
        style={{ width: 62, height: 111, borderRadius: 8, objectFit: 'cover',
                 border: '1px solid #333355', display: 'block' }}
        onError={() => setFailed(true)} />
    : <div style={{
        width: 62, height: 111, borderRadius: 8, background: 'var(--bg3)',
        border: '2px dashed #252545', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 3,
        color: '#353560', fontSize: 10,
      }}>
        <span style={{ fontSize: 22 }}>🖼</span>
        <span>尚無圖片</span>
      </div>
}

// ─── StoryTab ─────────────────────────────────────────────────────────────────

function StoryTab({ char, onUpdate }: { char: Character; onUpdate: (p: Partial<Character>) => void }) {
  return (
    <div className="adm-story">
      <div className="adm-section">
        <div className="adm-section-label">角色故事插圖</div>
        <ImageCrop storageKey={`cb_story_img_${char.id}`} />
      </div>

      <div className="adm-section">
        <div className="adm-section-label">外篇（基礎角色故事）</div>
        <textarea
          className="adm-story-textarea"
          placeholder={`在這裡填寫 ${char.name} 的外篇故事...`}
          value={char.story ?? ''}
          onChange={e => onUpdate({ story: e.target.value })}
          rows={14}
        />
        <small className="adm-story-save-hint">內容會自動儲存在目前角色資料，每位角色的故事互相獨立。</small>
      </div>
      <div className="adm-section adm-inner-story">
        <div className="adm-section-label">裡篇（星級解鎖故事）</div>
        <label className="adm-field"><span>解鎖條件</span><select className="adm-select" value={char.innerStoryUnlockStars ?? 5} onChange={event => onUpdate({ innerStoryUnlockStars: Number(event.target.value) })}>{[0,1,2,3,4,5].map(star => <option key={star} value={star}>{star === 0 ? '無條件' : `${star} 星解鎖${star === 5 ? '（預設滿星）' : ''}`}</option>)}</select></label>
        <textarea className="adm-story-textarea" placeholder={`在這裡填寫 ${char.name} 解鎖後的裡篇故事...`} value={char.innerStory ?? ''} onChange={event => onUpdate({ innerStory: event.target.value })} rows={14} />
      </div>
    </div>
  )
}

// ─── BgSettings ──────────────────────────────────────────────────────────────

function BgSettings() {
  const [boardCharacters, setBoardCharacters] = useState(getBoardCharacters)
  const [facing, setFacing] = useState<Record<string, 'left' | 'right'>>(() => {
    try { return JSON.parse(localStorage.getItem('cb_board_facing') ?? '{}') } catch { return {} }
  })
  const updateFacing = (key: string, value: 'left' | 'right') => {
    const next = { ...facing, [key]: value }
    setFacing(next); localStorage.setItem('cb_board_facing', JSON.stringify(next))
  }
  const [battleBgNames, setBattleBgNames] = useState<string[]>(getBattleBackgroundNames)
  const updateBattleBgName = (index: number, name: string) => {
    const next = battleBgNames.map((value, i) => i === index ? name : value)
    setBattleBgNames(next)
    localStorage.setItem('cb_battle_bg_names', JSON.stringify(next))
  }
  return (
    <div className="adm-basic" style={{ overflowY: 'auto' }}>
      <div className="adm-section">
        <div className="adm-section-label">大廳／故事 BGM</div>
        <BgmLibrary channel="lobby" />
      </div>
      <div className="adm-section">
        <div className="adm-section-label">戰鬥 BGM</div>
        <BgmLibrary channel="battle" />
      </div>
      <div className="adm-section">
        <div className="adm-section-label">大廳背景（大廳 / 選角 / 組牌畫面）</div>
        <ImageCrop storageKey="cb_bg_main" cropW={1376} cropH={768} />
      </div>
      <div className="adm-section" style={{ borderTop: '1px solid #1a1f3e', paddingTop: 16 }}>
        <div className="adm-section-label" style={{ marginBottom: 12 }}>看板角色圖片設定</div>
        {boardCharacters.map((character, characterIndex) => <div className="adm-section" key={character.id} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'end', marginBottom: 10 }}>
            <label className="adm-field" style={{ flex: 1 }}><span>看板角色名稱</span><input value={character.name} maxLength={30} onChange={event => {
              const next = boardCharacters.map((item, index) => index === characterIndex ? { ...item, name: event.target.value } : item)
              setBoardCharacters(next); saveBoardCharacters(next)
            }} /></label>
            <button className="btn sm danger" disabled={boardCharacters.length <= 1} onClick={() => {
              const next = boardCharacters.filter((_, index) => index !== characterIndex)
              setBoardCharacters(next); saveBoardCharacters(next)
            }}>刪除角色</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {(['front', 'side'] as const).map(pose => {
              const key = `${character.id}_${pose}`
              return <div key={key}><div style={{ fontSize: 11, color: '#8f91ad', marginBottom: 6 }}>{character.name || '未命名'} · {pose === 'front' ? '正面' : '側面'}立繪（768×1376）</div>
                <ImageCrop storageKey={`cb_board_${key}`} cropW={768} cropH={1376} />
                {pose === 'side' && <FacingSelect value={facing[key] ?? 'left'} onChange={value => updateFacing(key, value)} />}</div>
            })}
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: '#8f91ad', marginBottom: 6 }}>{character.name || '未命名'} · 全圖立繪（1536×1024）</div>
            <ImageCrop storageKey={`cb_board_${character.id}_full`} cropW={1536} cropH={1024}
              fallbackStorageKey={character.id === 'black' ? 'cb_board_full_1' : character.id === 'white' ? 'cb_board_full_2' : undefined} />
          </div>
        </div>)}
        <button className="btn" onClick={() => {
          const next = [...boardCharacters, { id: `board_${Date.now()}`, name: `看板角色 ${boardCharacters.length + 1}` }]
          setBoardCharacters(next); saveBoardCharacters(next)
        }}>＋ 新增看板角色</button>
      </div>
      <div className="adm-section" style={{ borderTop: '1px solid #1a1f3e', paddingTop: 16 }}>
        <div className="adm-section-label" style={{ marginBottom: 12 }}>
          戰鬥背景（共 6 張，對戰開始時隨機切換）
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i}>
              <label className="adm-field" style={{ marginBottom: 6 }}>
                <span>戰鬥背景 {i + 1} 名稱</span>
                <input value={battleBgNames[i]} maxLength={40} onChange={event => updateBattleBgName(i, event.target.value)} />
              </label>
              <ImageCrop storageKey={`cb_bg_battle_${i + 1}`} cropW={1376} cropH={768} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function BgmLibrary({channel}:{channel:BgmChannel}){
  const [config,setConfig]=useState<BgmConfig>(()=>getBgmConfig(channel)),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const update=(next:BgmConfig)=>{setConfig(next);saveBgmConfig(next,channel)}
  const upload=async(event:React.ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return
    if(file.size>20*1024*1024){setError('音樂檔案不可超過 20 MB');return}
    setBusy(true);setError('')
    try{
      const id=`bgm_${Date.now()}`,storageKey=`cb_audio_${channel}_${id}`
      const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file)})
      await uploadByKey(storageKey,dataUrl)
      const track={id,name:file.name.replace(/\.[^.]+$/,''),storageKey},tracks=[...config.tracks.filter(item=>getUrlByKey(item.storageKey)),track]
      update({...config,tracks,selectedId:config.tracks.some(item=>getUrlByKey(item.storageKey))?config.selectedId:id})
    }catch(reason){setError(reason instanceof Error?reason.message:'BGM 上傳失敗')}
    finally{setBusy(false)}
  }
  const tracks=config.tracks.filter(track=>getUrlByKey(track.storageKey))
  return <div className="bgm-library-admin"><div className="bgm-library-toolbar"><div className="bgm-play-mode"><button className={config.mode==='selected'?'active':''} onClick={()=>update({...config,mode:'selected'})}>指定播放</button><button className={config.mode==='random'?'active':''} onClick={()=>update({...config,mode:'random'})}>隨機播放</button></div><label className="btn sm primary">{busy?'上傳中…':'＋ 新增音樂'}<input hidden disabled={busy} type="file" accept="audio/mpeg,audio/ogg,audio/wav,audio/mp4,.mp3,.ogg,.wav,.m4a" onChange={upload}/></label></div>{tracks.length?<div className="bgm-track-list">{tracks.map((track,index)=>{const active=config.selectedId===track.id;return <article className={active?'active':''} key={track.id}><div role="button" tabIndex={0} className="bgm-track-select" onClick={()=>update({...config,mode:'selected',selectedId:track.id})} onKeyDown={event=>{if(event.key==='Enter')update({...config,mode:'selected',selectedId:track.id})}}><i>{active&&config.mode==='selected'?'▶':String(index+1).padStart(2,'0')}</i><span><input aria-label="音樂名稱" value={track.name} onClick={event=>event.stopPropagation()} onChange={event=>update({...config,tracks:config.tracks.map(item=>item.id===track.id?{...item,name:event.target.value}:item)})}/><small>{active&&config.mode==='selected'?'目前指定播放':config.mode==='random'?'加入隨機曲庫':'點擊指定播放'}</small></span></div><audio controls preload="metadata" src={getUrlByKey(track.storageKey)!} data-audio-kind="music"/><button className="btn sm danger" disabled={busy} onClick={()=>{removeByKey(track.storageKey);const next=config.tracks.filter(item=>item.id!==track.id),selectedId=active?(next[0]?.id??''):config.selectedId;update({...config,tracks:next,selectedId})}}>移除</button></article>})}</div>:<div className="bgm-library-empty">尚未上傳 BGM，請新增第一首音樂。</div>}{error&&<small className="adm-error">{error}</small>}<p>指定播放會循環同一首；隨機播放會在歌曲結束後抽選下一首，且不會連續重複。支援 MP3、OGG、WAV、M4A，單檔最大 20 MB。</p></div>
}

function LogisticsSettings() {
  const [jobs, setJobs] = useState(getLogisticsJobs)
  const update = (index: number, patch: Partial<(typeof jobs)[number]>) => { const next = jobs.map((job, i) => i === index ? { ...job, ...patch } : job); setJobs(next); saveLogisticsJobs(next) }
  return <div className="adm-basic logistics-admin"><div className="diag-head"><div><h2>後勤工作設定</h2><p>設定工作時間、8-bit 動畫圖與完成後可取得的資源。</p></div></div>
    <div className="logistics-admin-grid">{jobs.map((job, index) => <section className="adm-section" key={job.id}><div className="adm-section-label">{job.icon} {job.name}</div>
      <LogisticsIconGenerator jobId={job.id} jobName={job.name} />
      <AnimatedAssetUpload storageKey={`cb_logistics_anim_${job.id}`} />
      <div className="adm-field-grid"><Field label="工作名稱" value={job.name} onChange={name => update(index, { name })} /><label className="adm-field"><span>工作時間（小時，最少 2）</span><input type="number" min="2" step="0.5" value={job.durationSeconds / 3600} onChange={event => update(index, { durationSeconds: Math.max(7200, Math.round((Number(event.target.value) || 2) * 3600)) })} /></label></div>
      <div className="adm-field-grid">{([['gems', '鑽石'], ['coins', '金幣'], ['silver', '銀'], ['copper', '銅'], ['iron', '鐵'], ['wood', '木']] as const).map(([key, label]) => <label className="adm-field" key={key}><span>{label}</span><input type="number" min="0" value={job.rewards[key]} onChange={event => update(index, { rewards: { ...job.rewards, [key]: Math.max(0, Math.floor(Number(event.target.value) || 0)) } })} /></label>)}</div>
    </section>)}</div>
  </div>
}

function LogisticsIconGenerator({ jobId, jobName }: { jobId: string; jobName: string }) {
  const storageKey = `cb_logistics_icon_${jobId}`
  const [url, setUrl] = useState(() => getUrlByKey(storageKey))
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const generate = async () => {
    setBusy(true); setError('')
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('請先登入管理帳號')
      const response = await fetch('/.netlify/functions/generate-logistics-icon', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ jobName, detail }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.dataUrl) throw new Error(result.error ?? `生成失敗 (${response.status})`)
      await uploadByKey(storageKey, result.dataUrl)
      setUrl(getUrlByKey(storageKey))
    } catch (reason) { setError(reason instanceof Error ? reason.message : '生成失敗') } finally { setBusy(false) }
  }
  return <div className="logistics-ai-icon"><div className="logistics-ai-preview">{url ? <img src={url} alt={`${jobName} icon`} /> : <span>8 BIT</span>}</div><div><label className="adm-field"><span>AI icon 描述（可留空）</span><input value={detail} maxLength={300} placeholder={`例如：${jobName}使用的工具`} onChange={event => setDetail(event.target.value)} /></label><button className="btn sm primary" disabled={busy} onClick={generate}>{busy ? 'ChatGPT 生成中…' : '用 ChatGPT 生成 8-bit icon'}</button>{url && <button className="btn sm danger" onClick={() => { removeByKey(storageKey); setUrl(null) }}>移除</button>}{error && <small className="adm-error">{error}</small>}</div></div>
}

function AnimatedAssetUpload({ storageKey }: { storageKey: string }) {
  const [url, setUrl] = useState(() => getUrlByKey(storageKey))
  const [busy, setBusy] = useState(false)
  const upload = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); setBusy(true); reader.onload = async () => { try { await uploadByKey(storageKey, String(reader.result)); setUrl(getUrlByKey(storageKey)) } finally { setBusy(false) } }; reader.readAsDataURL(file); event.target.value = '' }
  return <div className="animated-asset-upload"><div>{url ? <img src={url} alt="8-bit animation" /> : <span>8 BIT</span>}</div><label className="btn sm">{busy ? '上傳中…' : '上傳動畫圖'}<input type="file" accept="image/gif,image/webp,image/png" hidden disabled={busy} onChange={upload} /></label>{url && <button className="btn sm danger" onClick={() => { removeByKey(storageKey); setUrl(null) }}>移除</button>}<small>支援 GIF、動態 WebP、PNG；建議透明背景並使用像素風格。</small></div>
}

function StoryMapRouteEditor({chapters,onMove,onRouteChange}:{chapters:StoryChapter[];onMove:(index:number,x:number,y:number)=>void;onRouteChange:(points:{x:number;y:number}[])=>void}){
  const stage=useRef<HTMLDivElement>(null),defaultsX=[9.5,28.5,45.5,62.5,80.5,93],defaultsY=[68,41,64,33,57,23]
  const[selectedPoint,setSelectedPoint]=useState<number|null>(null)
  const points=chapters.map((chapter,index)=>({x:chapter.mapX??defaultsX[index],y:chapter.mapY??defaultsY[index]})),routePoints=chapters[0]?.mapRoutePoints?.length?chapters[0].mapRoutePoints:points
  const begin=(event:React.PointerEvent,index:number)=>{event.preventDefault();const move=(next:PointerEvent)=>{const rect=stage.current?.getBoundingClientRect();if(!rect)return;onMove(index,Math.max(3,Math.min(97,(next.clientX-rect.left)/rect.width*100)),Math.max(5,Math.min(95,(next.clientY-rect.top)/rect.height*100)))};const end=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',end)}
  const position=(event:{clientX:number;clientY:number})=>{const rect=stage.current?.getBoundingClientRect();return rect?{x:Math.max(1,Math.min(99,(event.clientX-rect.left)/rect.width*100)),y:Math.max(2,Math.min(98,(event.clientY-rect.top)/rect.height*100))}:null}
  const dragPoint=(event:React.PointerEvent,index:number,source=routePoints)=>{event.preventDefault();event.stopPropagation();setSelectedPoint(index);const move=(next:PointerEvent)=>{const point=position(next);if(point)onRouteChange(source.map((item,i)=>i===index?point:item))};const end=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',end)}
  const pullLine=(event:React.PointerEvent)=>{const point=position(event);if(!point||routePoints.length<2)return;let segment=0,distance=Infinity;routePoints.slice(0,-1).forEach((from,index)=>{const to=routePoints[index+1],dx=to.x-from.x,dy=to.y-from.y,t=Math.max(0,Math.min(1,((point.x-from.x)*dx+(point.y-from.y)*dy)/(dx*dx+dy*dy||1))),d=(point.x-(from.x+t*dx))**2+(point.y-(from.y+t*dy))**2;if(d<distance){distance=d;segment=index}});const next=[...routePoints.slice(0,segment+1),point,...routePoints.slice(segment+1)];onRouteChange(next);dragPoint(event,segment+1,next)}
  const addPoint=()=>{const index=selectedPoint??routePoints.length-1,from=routePoints[index]??{x:50,y:50},to=routePoints[index+1];let point:{x:number;y:number};if(to)point={x:(from.x+to.x)/2,y:(from.y+to.y)/2};else{const before=routePoints[index-1]??{x:from.x-8,y:from.y},dx=from.x-before.x,dy=from.y-before.y,length=Math.hypot(dx,dy)||1,step=Math.min(8,length*.55);point={x:Math.max(1,Math.min(99,from.x+dx/length*step)),y:Math.max(2,Math.min(98,from.y+dy/length*step))}}const next=[...routePoints.slice(0,index+1),point,...routePoints.slice(index+1)];onRouteChange(next);setSelectedPoint(index+1)}
  const removePoint=()=>{if(routePoints.length<=2)return;const index=selectedPoint??routePoints.length-2;onRouteChange(routePoints.filter((_,i)=>i!==index));setSelectedPoint(null)}
  return <section className="adm-section story-route-admin"><div className="adm-section-label">世界地圖路線編輯器</div><p>直接抓住黃色虛線即可拉出轉折；也可選取編號圓點後移動或刪除。</p><div className="story-route-actions"><button className="btn sm" onClick={addPoint}>＋ 增加轉折點</button><button className="btn sm" disabled={routePoints.length<=2} onClick={removePoint}>－ 刪除選取轉折點</button><button className="btn sm" onClick={()=>{onRouteChange(points);setSelectedPoint(null)}}>重設並連接章節</button></div><div className="story-route-admin-map" ref={stage}><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline className="route-shadow" points={routePoints.map(point=>`${point.x},${point.y}`).join(' ')}/><polyline className="route-main" points={routePoints.map(point=>`${point.x},${point.y}`).join(' ')}/><polyline className="route-hit" points={routePoints.map(point=>`${point.x},${point.y}`).join(' ')} onPointerDown={pullLine}/></svg>{routePoints.map((point,index)=><button className={`route-point ${selectedPoint===index?'selected':''}`} type="button" key={index} style={{left:`${point.x}%`,top:`${point.y}%`}} title={`路線控制點 ${index+1}`} onPointerDown={event=>dragPoint(event,index)} onClick={()=>setSelectedPoint(index)}>{index+1}</button>)}{chapters.map((chapter,index)=><div className="story-route-control" key={chapter.id} style={{left:`${points[index].x}%`,top:`${points[index].y}%`}}><button className="route-chapter" type="button" onPointerDown={event=>begin(event,index)}><i>{chapter.piece}</i><span>第 {chapter.order} 章<br/><b>{chapter.title}</b></span></button></div>)}</div></section>
}

const MINING_REWARD_OPTIONS=[['swordSoul','劍魂'],['gunSoul','槍魂'],['magicSoul','法魂'],['coins','金幣'],['gems','鑽石'],['silver','銀'],['copper','銅'],['iron','鐵'],['wood','木']] as const
function MiningSettingsV2({chars,config,setConfig,save,saved}:{chars:Character[];config:MiningConfig;setConfig:React.Dispatch<React.SetStateAction<MiningConfig>>;save:()=>void;saved:boolean}){
 const update=(patch:Partial<MiningConfig>)=>setConfig(value=>({...value,...patch})),updateNode=(index:number,patch:Partial<MiningConfig['nodes'][number]>)=>setConfig(value=>({...value,nodes:value.nodes.map((node,i)=>i===index?{...node,...patch}:node)}))
 const updateDrop=(nodeIndex:number,dropIndex:number,patch:Partial<MiningConfig['nodes'][number]['rewardTable'][number]>)=>updateNode(nodeIndex,{rewardTable:config.nodes[nodeIndex].rewardTable.map((drop,i)=>i===dropIndex?{...drop,...patch}:drop)})
 return <div className="adm-basic"><div className="diag-head"><div><h2>⛏ 挖礦與掉落機率設定</h2><p>每項獎勵獨立判定；100% 為必定掉落。</p></div><button className="btn primary" onClick={save}>{saved?'已儲存':'儲存設定'}</button></div><section className="adm-section"><div className="adm-section-label">全域規則</div><div className="adm-basic-cols"><label className="adm-field"><span>自動派遣時間（小時）</span><input type="number" min="2" value={config.durationHours} onChange={e=>update({durationHours:Math.max(2,+e.target.value)})}/></label><label className="adm-field"><span>ATK 力度倍率 %</span><input type="number" value={config.atkPowerPercent} onChange={e=>update({atkPowerPercent:+e.target.value})}/></label><label className="adm-field"><span>每點 SPD 加速 %</span><input type="number" step=".5" value={config.spdSpeedPercent} onChange={e=>update({spdSpeedPercent:+e.target.value})}/></label><label className="adm-field"><span>速度上限 %</span><input type="number" value={config.maxSpeedBonus} onChange={e=>update({maxSpeedBonus:+e.target.value})}/></label></div></section><section className="adm-section"><div className="adm-section-label">本週加成角色</div><div className="mining-admin-chars">{chars.map(char=><label key={char.id}><input type="checkbox" checked={config.weeklyCharacterIds.includes(char.id)} onChange={e=>update({weeklyCharacterIds:e.target.checked?[...config.weeklyCharacterIds,char.id]:config.weeklyCharacterIds.filter(id=>id!==char.id)})}/>{char.name}<small>ATK {char.atk}／SPD {char.spd}</small></label>)}</div></section><div className="logistics-admin-grid">{config.nodes.map((node,nodeIndex)=><section className="adm-section mining-drop-editor" key={node.id}><div className="adm-section-label">礦坑 {nodeIndex+1} · {node.name}</div><div className="adm-basic-cols"><label className="adm-field"><span>名稱</span><input value={node.name} onChange={e=>updateNode(nodeIndex,{name:e.target.value})}/></label><label className="adm-field"><span>礦脈 HP</span><input type="number" min="100" value={node.maxHp} onChange={e=>updateNode(nodeIndex,{maxHp:+e.target.value})}/></label></div><b>獎勵掉落表</b>{node.rewardTable.map((drop,dropIndex)=><div className="mining-drop-row" key={dropIndex}><select value={drop.reward} onChange={e=>updateDrop(nodeIndex,dropIndex,{reward:e.target.value as typeof drop.reward})}>{MINING_REWARD_OPTIONS.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select><label>機率 <input type="number" min="0" max="100" value={drop.chance} onChange={e=>updateDrop(nodeIndex,dropIndex,{chance:Math.max(0,Math.min(100,+e.target.value))})}/>%</label><label>最少 <input type="number" min="0" value={drop.min} onChange={e=>updateDrop(nodeIndex,dropIndex,{min:+e.target.value})}/></label><label>最多 <input type="number" min="0" value={drop.max} onChange={e=>updateDrop(nodeIndex,dropIndex,{max:+e.target.value})}/></label><button onClick={()=>updateNode(nodeIndex,{rewardTable:node.rewardTable.filter((_,i)=>i!==dropIndex)})}>刪除</button></div>)}<button className="btn sm" onClick={()=>updateNode(nodeIndex,{rewardTable:[...node.rewardTable,{reward:'coins',min:1,max:10,chance:25}]})}>＋ 新增獎勵</button></section>)}</div></div>
}

function MiningSettings({chars}:{chars:Character[]}){
  const[config,setConfig]=useState<MiningConfig>(getMiningConfig),[saved,setSaved]=useState(false)
  const update=(patch:Partial<MiningConfig>)=>setConfig(value=>({...value,...patch})),updateNode=(index:number,patch:Partial<MiningConfig['nodes'][number]>)=>setConfig(value=>({...value,nodes:value.nodes.map((node,i)=>i===index?{...node,...patch}:node)}))
  const save=()=>{saveMiningConfig(config);setSaved(true);setTimeout(()=>setSaved(false),1800)}
  return <MiningSettingsV2 chars={chars} config={config} setConfig={setConfig} save={save} saved={saved}/>
  // Legacy editor kept below for saved-layout compatibility; the V2 editor above is authoritative.
  return <div className="adm-basic"><div className="diag-head"><div><h2>⛏ 挖礦小遊戲設定</h2><p>ATK 控制挖掘力度，SPD 控制挖掘速度；每張地圖三個礦點。</p></div><button className="btn primary" onClick={save}>{saved?'已儲存':'儲存設定'}</button></div><section className="adm-section"><div className="adm-section-label">全域規則</div><div className="adm-basic-cols"><label className="adm-field"><span>派遣時間（小時）</span><input type="number" min="2" value={config.durationHours} onChange={e=>update({durationHours:Math.max(2,+e.target.value)})}/></label><label className="adm-field"><span>ATK 力度倍率 %</span><input type="number" value={config.atkPowerPercent} onChange={e=>update({atkPowerPercent:+e.target.value})}/></label><label className="adm-field"><span>每點 SPD 速度加成 %</span><input type="number" step=".5" value={config.spdSpeedPercent} onChange={e=>update({spdSpeedPercent:+e.target.value})}/></label><label className="adm-field"><span>速度加成上限 %</span><input type="number" value={config.maxSpeedBonus} onChange={e=>update({maxSpeedBonus:+e.target.value})}/></label><label className="adm-field"><span>本週力度加成 %</span><input type="number" value={config.weeklyPowerPercent} onChange={e=>update({weeklyPowerPercent:+e.target.value})}/></label><label className="adm-field"><span>本週速度加成 %</span><input type="number" value={config.weeklySpeedPercent} onChange={e=>update({weeklySpeedPercent:+e.target.value})}/></label></div></section><section className="adm-section"><div className="adm-section-label">本週加成角色</div><div className="mining-admin-chars">{chars.map(char=><label key={char.id}><input type="checkbox" checked={config.weeklyCharacterIds.includes(char.id)} onChange={e=>update({weeklyCharacterIds:e.target.checked?[...config.weeklyCharacterIds,char.id]:config.weeklyCharacterIds.filter(id=>id!==char.id)})}/>{char.name}<small>ATK {char.atk}／SPD {char.spd}</small></label>)}</div></section><div className="logistics-admin-grid">{config.nodes.map((node,index)=><section className="adm-section" key={node.id}><div className="adm-section-label">礦點 {index+1} · {node.name}</div><label className="adm-field"><span>名稱</span><input value={node.name} onChange={e=>updateNode(index,{name:e.target.value})}/></label><label className="adm-field"><span>岩石 HP</span><input type="number" min="100" value={node.maxHp} onChange={e=>updateNode(index,{maxHp:+e.target.value})}/></label><label className="adm-field"><span>重生秒數</span><input type="number" min="0" value={node.respawnSeconds} onChange={e=>updateNode(index,{respawnSeconds:+e.target.value})}/></label><label className="adm-field"><span>掉落資源</span><select value={node.reward} onChange={e=>updateNode(index,{reward:e.target.value as typeof node.reward})}><option value="iron">鐵</option><option value="copper">銅</option><option value="silver">銀</option><option value="coins">金幣</option><option value="gems">鑽石</option></select></label><div className="adm-basic-cols"><label className="adm-field"><span>最少</span><input type="number" value={node.rewardMin} onChange={e=>updateNode(index,{rewardMin:+e.target.value})}/></label><label className="adm-field"><span>最多</span><input type="number" value={node.rewardMax} onChange={e=>updateNode(index,{rewardMax:+e.target.value})}/></label></div><div className="adm-basic-cols"><label className="adm-field"><span>地圖 X%</span><input type="number" value={node.x} onChange={e=>updateNode(index,{x:+e.target.value})}/></label><label className="adm-field"><span>地圖 Y%</span><input type="number" value={node.y} onChange={e=>updateNode(index,{y:+e.target.value})}/></label></div></section>)}</div></div>
}

function StorySettings() {
  const [chapters, setChapters] = useState(getStoryChapters)
  const [designerIndex, setDesignerIndex] = useState<number | null>(null)
  const boardCharacters = getBoardCharacters()
  const rewardCharacters = getChars()
  const battleBackgroundNames = getBattleBackgroundNames()
  const update = (index: number, patch: Partial<(typeof chapters)[number]>) => {
    const next = chapters.map((chapter, i) => i === index ? { ...chapter, ...patch } : chapter)
    setChapters(next)
    saveStoryChapters(next)
  }
  const updateMapPosition = (index: number, mapX: number, mapY: number) => update(index, { mapX, mapY })
  const updateRoute = (mapRoutePoints: {x:number;y:number}[]) => update(0, { mapRoutePoints })
  if (designerIndex !== null) return <StoryFlowDesigner chapter={chapters[designerIndex]} boardCharacters={boardCharacters}
    onSave={(flow, rewards) => update(designerIndex, { flow, rewards })} onClose={() => setDesignerIndex(null)} />
  return <div className="adm-basic" style={{ overflowY: 'auto' }}>
    <div className="diag-head"><div><h2>♟ 故事模式設定</h2><p>設定兵、騎士、城堡、主教、皇后、國王六張章節地圖與故事內容。</p></div></div>
    <StoryMapRouteEditor chapters={chapters} onMove={updateMapPosition} onRouteChange={updateRoute}/>
    {chapters.map((chapter, index) => <div className="adm-section" key={chapter.id}>
      <div className="adm-section-label">第 {chapter.order} 章 · {chapter.piece}</div>
      <div className="adm-basic-cols">
        <div><ImageCrop storageKey={`cb_story_map_${chapter.id}`} cropW={1536} cropH={1024} /></div>
        <div className="adm-basic-data">
          <div className="adm-field-grid">
            <Field label="章節標題" value={chapter.title} onChange={value => update(index, { title: value })} />
            <Field label="章節副標" value={chapter.subtitle} onChange={value => update(index, { subtitle: value })} />
            <label className="adm-field"><span>開放章節</span><input type="checkbox" checked={chapter.unlocked} onChange={event => update(index, { unlocked: event.target.checked })} /></label>
            <label className="adm-field"><span>故事背景</span><select className="adm-select" value={chapter.backgroundKey ?? ''} onChange={event => update(index, { backgroundKey: event.target.value || undefined })}>
              <option value="">章節專用地圖圖片</option>
              {battleBackgroundNames.map((name, bgIndex) => <option value={`cb_bg_battle_${bgIndex + 1}`} key={bgIndex}>{name}</option>)}
            </select></label>
          </div>
          <div className="adm-section-label" style={{ marginTop: 14 }}>章節首次完成獎勵</div>
          <div className="adm-field-grid story-reward-grid">
            <label className="adm-field"><span>獎勵角色</span><select className="adm-select" value={chapter.rewards?.characterId ?? ''} onChange={event => update(index, { rewards: { ...chapter.rewards, characterId: event.target.value || undefined } })}>
              <option value="">不贈送角色</option>{rewardCharacters.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}
            </select></label>
            {([['gems', '鑽石'], ['coins', '金幣'], ['silver', '銀'], ['copper', '銅'], ['iron', '鐵'], ['wood', '木']] as const).map(([key, label]) => <label className="adm-field" key={key}><span>{label}</span><input type="number" min="0" value={chapter.rewards?.[key] ?? 0} onChange={event => update(index, { rewards: { ...chapter.rewards, [key]: Math.max(0, Math.floor(Number(event.target.value) || 0)) } })} /></label>)}
          </div>
          <small style={{ color: '#858daa' }}>每個帳號每章只能領取一次；重複角色會自動轉為 10 個角色碎片。</small>
          <button className="story-open-designer" onClick={() => setDesignerIndex(index)}><span>◆</span><div><b>開啟獨立故事流程編輯器</b><small>使用節點、連線與分支卡片編排本章故事</small></div><i>進入全畫面 →</i></button>
          <div hidden>
          <div className="adm-section-label" style={{ marginTop: 12 }}>故事段落編輯</div>
          {getChapterSegments(chapter).map((segment, segmentIndex, allSegments) => {
            const changeSegment = (patch: Partial<StorySegment>) => update(index, {
              segments: allSegments.map((item, i) => i === segmentIndex ? { ...item, ...patch } : item),
            })
            const moveSegment = (direction: -1 | 1) => {
              const target = segmentIndex + direction
              if (target < 0 || target >= allSegments.length) return
              const next = [...allSegments]; [next[segmentIndex], next[target]] = [next[target], next[segmentIndex]]
              update(index, { segments: next })
            }
            return <div key={segment.id} style={{ border: '1px solid #292d4b', borderRadius: 8, padding: 10, marginBottom: 9, background: '#090b1b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <b style={{ color: '#d7ad55' }}>第 {segmentIndex + 1} 段</b>
                <button className="btn sm" disabled={segmentIndex === 0} onClick={() => moveSegment(-1)}>↑</button>
                <button className="btn sm" disabled={segmentIndex === allSegments.length - 1} onClick={() => moveSegment(1)}>↓</button>
                <button className="btn sm danger" onClick={() => update(index, { segments: allSegments.filter((_, i) => i !== segmentIndex) })}>刪除</button>
              </div>
              <div className="adm-field-grid">
                <Field label="流程區段" value={segment.section ?? (segmentIndex === 0 ? '開頭' : '主線')} onChange={section => changeSegment({ section })} />
                <Field label="說話者" value={segment.speaker} onChange={speaker => changeSegment({ speaker })} />
                <label className="adm-field"><span>角色位置</span><select className="adm-select" value={segment.side} onChange={event => changeSegment({ side: event.target.value as 'left' | 'right' })}><option value="left">左邊</option><option value="right">右邊</option></select></label>
                <label className="adm-field"><span>看板角色</span><select className="adm-select" value={segment.boardCharacter ?? (segment.speaker === '小白' ? 'white' : 'black')} onChange={event => {
                  const boardCharacter = event.target.value
                  const selected = boardCharacters.find(character => character.id === boardCharacter)
                  changeSegment({ boardCharacter, speaker: selected?.name ?? segment.speaker })
                }}>{boardCharacters.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}</select></label>
                <label className="adm-field"><span>看板立繪</span><select className="adm-select" value={segment.pose ?? (segment.portrait === 2 ? 'side' : 'front')} onChange={event => changeSegment({ pose: event.target.value as 'front' | 'side' })}><option value="front">正面</option><option value="side">側面</option></select></label>
              </div>
              <textarea className="adm-story-textarea" value={segment.text} onChange={event => changeSegment({ text: event.target.value })} />
            </div>
          })}
          <button className="btn" onClick={() => update(index, { segments: [...getChapterSegments(chapter), {
            id: `segment_${Date.now()}`, speaker: boardCharacters[0]?.name ?? '旁白', text: '新段落', side: 'left', boardCharacter: boardCharacters[0]?.id ?? 'black', pose: 'front', section: '主線',
          }] })}>＋ 新增段落</button></div>
        </div>
      </div>
    </div>)}
  </div>
}

function StoryFlowEditor({ chapter, boardCharacters, onChange }: {
  chapter: StoryChapter
  boardCharacters: ReturnType<typeof getBoardCharacters>
  onChange: (flow: StoryFlowNode[]) => void
}) {
  const flow = getChapterFlow(chapter)
  const newSegment = (): StorySegment => ({
    id: `segment_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    speaker: boardCharacters[0]?.name ?? '旁白', text: '新故事卡片', side: 'left',
    boardCharacter: boardCharacters[0]?.id ?? 'black', pose: 'front', section: '主線',
  })
  const newCommon = (): StoryFlowNode => ({ id: `node_${Date.now()}_${Math.random()}`, type: 'common', segment: newSegment() })
  const newBranch = (): StoryFlowNode => ({ id: `branch_${Date.now()}_${Math.random()}`, type: 'branch', title: '新分歧', branches: [
    { id: `route_a_${Date.now()}`, label: '選項 A', nodes: [] }, { id: `route_b_${Date.now()}`, label: '選項 B', nodes: [] },
  ] })
  return <section className="story-flow-editor">
    <div className="story-flow-head"><div><b>故事 Flow</b><small>共用卡片沿主線排列；分歧路線可繼續加入共用或下一層分歧。</small></div>
      <div><button className="btn sm" onClick={() => onChange([...flow, newCommon()])}>＋ 共用</button><button className="btn sm primary" onClick={() => onChange([...flow, newBranch()])}>⑂ 分歧</button></div>
    </div>
    <StoryFlowList nodes={flow} onChange={onChange} boardCharacters={boardCharacters} chapter={chapter} depth={0} newCommon={newCommon} newBranch={newBranch} />
  </section>
}

function StoryFlowList({ nodes, onChange, boardCharacters, chapter, depth, newCommon, newBranch }: {
  nodes: StoryFlowNode[]; onChange: (nodes: StoryFlowNode[]) => void
  boardCharacters: ReturnType<typeof getBoardCharacters>; chapter: StoryChapter; depth: number
  newCommon: () => StoryFlowNode; newBranch: () => StoryFlowNode
}) {
  return <div className="story-flow-list" style={{ '--flow-depth': depth } as React.CSSProperties}>
    {nodes.map((node, index) => <div className={`story-flow-node ${node.type}`} key={node.id}>
      <div className="story-flow-node-bar"><b>{node.type === 'common' ? '共用卡片' : '分歧節點'}</b><span>#{index + 1}</span><button className="btn sm danger" onClick={() => onChange(nodes.filter(item => item.id !== node.id))}>刪除</button></div>
      {node.type === 'common' ? (() => {
        const segment = node.segment
        const patch = (segmentPatch: Partial<StorySegment>) => onChange(nodes.map(item => item.id === node.id && item.type === 'common' ? { ...item, segment: { ...item.segment, ...segmentPatch } } : item))
        const portraitKey = `cb_board_${segment.boardCharacter ?? 'black'}_${segment.pose ?? 'front'}`
        const portrait = getUrlByKey(portraitKey) ?? ''
        const background = getUrlByKey(chapter.backgroundKey || `cb_story_map_${chapter.id}`) ?? ''
        return <><div className="story-flow-card-fields"><Field label="區段" value={segment.section ?? ''} onChange={section => patch({ section })} /><Field label="說話者" value={segment.speaker} onChange={speaker => patch({ speaker })} />
          <label className="adm-field"><span>位置</span><select className="adm-select" value={segment.side} onChange={event => patch({ side: event.target.value as 'left'|'right' })}><option value="left">左邊</option><option value="right">右邊</option></select></label>
          <label className="adm-field"><span>插入立繪</span><select className="adm-select" value={segment.boardCharacter ?? ''} onChange={event => { const selected = boardCharacters.find(char => char.id === event.target.value); patch({ boardCharacter: event.target.value, speaker: selected?.name ?? segment.speaker }) }}>{boardCharacters.map(char => <option key={char.id} value={char.id}>{char.name}</option>)}</select></label>
          <label className="adm-field"><span>立繪姿勢</span><select className="adm-select" value={segment.pose ?? 'front'} onChange={event => patch({ pose: event.target.value as 'front'|'side' })}><option value="front">正面</option><option value="side">側面</option></select></label></div>
          <textarea className="adm-story-textarea" value={segment.text} onChange={event => patch({ text: event.target.value })} />
          <div className="story-flow-preview" style={{ backgroundImage: `linear-gradient(#05071466,#050714cc),url(${background})` }}>{portrait && <img className={segment.side === 'right' ? 'right' : ''} src={portrait} alt="" />}<div><b>{segment.speaker}</b><p>{segment.text}</p></div></div></>
      })() : <><Field label="分歧標題" value={node.title} onChange={title => onChange(nodes.map(item => item.id === node.id && item.type === 'branch' ? { ...item, title } : item))} />
        <div className="story-flow-branches">{node.branches.map((branch, branchIndex) => <div className="story-flow-route" key={branch.id}><div className="story-flow-route-head"><input className="input" value={branch.label} onChange={event => onChange(nodes.map(item => item.id === node.id && item.type === 'branch' ? { ...item, branches: item.branches.map(route => route.id === branch.id ? { ...route, label: event.target.value } : route) } : item))} /><button className="btn sm danger" disabled={node.branches.length <= 2} onClick={() => onChange(nodes.map(item => item.id === node.id && item.type === 'branch' ? { ...item, branches: item.branches.filter(route => route.id !== branch.id) } : item))}>刪除路線</button></div>
          <StoryFlowList nodes={branch.nodes} depth={depth + 1} boardCharacters={boardCharacters} chapter={chapter} newCommon={newCommon} newBranch={newBranch} onChange={branchNodes => onChange(nodes.map(item => item.id === node.id && item.type === 'branch' ? { ...item, branches: item.branches.map((route, i) => i === branchIndex ? { ...route, nodes: branchNodes } : route) } : item))} />
          <div className="story-flow-add"><button className="btn sm" onClick={() => onChange(nodes.map(item => item.id === node.id && item.type === 'branch' ? { ...item, branches: item.branches.map(route => route.id === branch.id ? { ...route, nodes: [...route.nodes, newCommon()] } : route) } : item))}>＋ 共用</button><button className="btn sm" onClick={() => onChange(nodes.map(item => item.id === node.id && item.type === 'branch' ? { ...item, branches: item.branches.map(route => route.id === branch.id ? { ...route, nodes: [...route.nodes, newBranch()] } : route) } : item))}>⑂ 分歧</button></div>
        </div>)}<button className="btn sm" onClick={() => onChange(nodes.map(item => item.id === node.id && item.type === 'branch' ? { ...item, branches: [...item.branches, { id: `route_${Date.now()}`, label: `選項 ${item.branches.length + 1}`, nodes: [] }] } : item))}>＋ 新增路線</button></div></>}
    </div>)}
    {nodes.length === 0 && <div className="story-flow-empty">這條路線尚無節點，請新增共用或分歧。</div>}
  </div>
}

// ─── ImageCrop — visual crop-box UI ──────────────────────────────────────────

void StoryFlowEditor

const PORTRAIT_W = 768
const PORTRAIT_H = 1376

interface CropProps {
  storageKey: string
  fallbackStorageKey?: string
  cropW?: number
  cropH?: number
  previewSize?: number   // unused
  onSave?: () => void
}

type CropDragState =
  | { mode: 'move'; startMx: number; startMy: number; startBx: number; startBy: number }
  | { mode: 'resize'; corner: 'tl'|'tr'|'bl'|'br'
      ax: number; ay: number; dw: number; dh: number; imgX: number; imgY: number }
  | null

// disp: rendered image bounds within fixed-height stage (coords relative to stage origin)
// box:  crop box position/size relative to rendered image (NOT stage)
function ImageCrop({ storageKey, fallbackStorageKey, cropW = PORTRAIT_W, cropH = PORTRAIT_H, onSave }: CropProps) {
  const CROP_RATIO = cropW / cropH
  const [imgSrc,      setImgSrc]      = useState<string | null>(null)
  const [saved,       setSaved]       = useState<string | null>(() => getUrlByKey(storageKey) ?? (fallbackStorageKey ? getUrlByKey(fallbackStorageKey) : null))
  const [uploading,   setUploading]   = useState(false)
  const [fetchingRe,  setFetchingRe]  = useState(false)
  const [removingBg,   setRemovingBg] = useState(false)
  const [savedFailed, setSavedFailed] = useState(false)
  const [disp,        setDisp]        = useState({ w: 0, h: 0, imgX: 0, imgY: 0 })
  // box: x/y in rendered-image coords; w = box width; height = w / CROP_RATIO
  const [box,         setBox]         = useState({ x: 0, y: 0, w: 100 })

  const imgRef    = useRef<HTMLImageElement>(null)
  const stageRef  = useRef<HTMLDivElement>(null)
  const dragRef   = useRef<CropDragState>(null)
  const blobUrlRef = useRef<string | null>(null)
  const boxRef    = useRef(box)
  const dispRef   = useRef(disp)
  useEffect(() => { boxRef.current  = box  }, [box])
  useEffect(() => { dispRef.current = disp }, [disp])

  useEffect(() => {
    setSaved(getUrlByKey(storageKey))
    setSavedFailed(false)
    setImgSrc(null)
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
  }, [storageKey])

  // compute object-fit:contain rendered size + letterbox offsets
  const initBox = useCallback(() => {
    const img = imgRef.current; const stage = stageRef.current
    if (!img || !stage || !img.naturalWidth) return
    const sw = stage.offsetWidth, sh = stage.offsetHeight
    const nw = img.naturalWidth,  nh = img.naturalHeight
    let rw: number, rh: number, imgX: number, imgY: number
    if (nw / nh >= sw / sh) {
      rw = sw;           rh = sw / nw * nh; imgX = 0;              imgY = (sh - rh) / 2
    } else {
      rh = sh;           rw = sh / nh * nw; imgX = (sw - rw) / 2; imgY = 0
    }
    const d = { w: Math.round(rw), h: Math.round(rh), imgX: Math.round(imgX), imgY: Math.round(imgY) }
    setDisp(d); dispRef.current = d
    // default to maximum: fill as much of the rendered image as possible
    let bw_init = rw
    let bh_init = Math.round(bw_init / CROP_RATIO)
    if (bh_init > rh) { bh_init = rh; bw_init = Math.round(bh_init * CROP_RATIO) }
    const nb = { x: Math.round((rw - bw_init) / 2), y: Math.round((rh - bh_init) / 2), w: bw_init }
    setBox(nb); boxRef.current = nb
  }, [])

  useEffect(() => {
    const MIN = 40
    const onMove = (e: MouseEvent) => {
      const ds = dragRef.current; if (!ds) return
      const stage = stageRef.current; if (!stage) return

      if (ds.mode === 'move') {
        const dx = e.clientX - ds.startMx
        const dy = e.clientY - ds.startMy
        const { w, h } = dispRef.current
        const b = boxRef.current
        const bh = b.w / CROP_RATIO
        const nb = { ...b,
          x: Math.max(0, Math.min(w - b.w, ds.startBx + dx)),
          y: Math.max(0, Math.min(h - bh, ds.startBy + dy)),
        }
        setBox(nb); boxRef.current = nb
      } else {
        const rect = stage.getBoundingClientRect()
        const mx = e.clientX - rect.left - ds.imgX
        const my = e.clientY - rect.top  - ds.imgY
        const { corner, ax, ay, dw, dh } = ds
        // convert constraints to width units (h_constraint * CROP_RATIO = equivalent width)
        let nb: { x: number; y: number; w: number }
        if (corner === 'br') {
          const bw = Math.max(MIN, Math.min(mx - ax, (my - ay) * CROP_RATIO, dw - ax, (dh - ay) * CROP_RATIO))
          nb = { x: ax, y: ay, w: bw }
        } else if (corner === 'tl') {
          const bw = Math.max(MIN, Math.min(ax - mx, (ay - my) * CROP_RATIO, ax, ay * CROP_RATIO))
          nb = { x: ax - bw, y: ay - bw / CROP_RATIO, w: bw }
        } else if (corner === 'tr') {
          const bw = Math.max(MIN, Math.min(mx - ax, (ay - my) * CROP_RATIO, dw - ax, ay * CROP_RATIO))
          nb = { x: ax, y: ay - bw / CROP_RATIO, w: bw }
        } else { // bl
          const bw = Math.max(MIN, Math.min(ax - mx, (my - ay) * CROP_RATIO, ax, (dh - ay) * CROP_RATIO))
          nb = { x: ax - bw, y: ay, w: bw }
        }
        setBox(nb); boxRef.current = nb
      }
    }
    const onUp = () => { dragRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [])

  const startMove = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const b = boxRef.current
    dragRef.current = { mode: 'move', startMx: e.clientX, startMy: e.clientY, startBx: b.x, startBy: b.y }
  }

  const startResize = (corner: 'tl'|'tr'|'bl'|'br') => (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const b = boxRef.current; const d = dispRef.current
    const bh = b.w / CROP_RATIO
    const ax = corner === 'br' || corner === 'tr' ? b.x : b.x + b.w
    const ay = corner === 'br' || corner === 'bl' ? b.y : b.y + bh
    dragRef.current = { mode: 'resize', corner, ax, ay, dw: d.w, dh: d.h, imgX: d.imgX, imgY: d.imgY }
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setImgSrc(ev.target!.result as string)
    reader.readAsDataURL(file); e.target.value = ''
  }

  const handleReEdit = async () => {
    if (!saved) return
    setFetchingRe(true)
    try {
      const resp = await fetch(saved, { mode: 'cors' })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const blob = await resp.blob()
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      const url = URL.createObjectURL(blob)
      blobUrlRef.current = url
      setImgSrc(url)
    } catch (err) {
      console.error('重新裁切載入失敗', err)
      alert('載入圖片失敗，請改用「上傳圖片」')
    } finally {
      setFetchingRe(false)
    }
  }

  const handleCancel = () => {
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
    setImgSrc(null)
  }

  const handleRemoveBackground = async () => {
    if (!imgSrc) return
    setRemovingBg(true)
    try {
      setImgSrc(await removePixelBackground(imgSrc))
    } catch (error) {
      console.error('8-bit 去背失敗', error)
      alert(error instanceof Error ? error.message : '8-bit 去背失敗')
    } finally {
      setRemovingBg(false)
    }
  }

  const handleSave = async () => {
    const img = imgRef.current; if (!img || !img.naturalWidth) return
    const d = dispRef.current; if (!d.w || !d.h) return
    const b = boxRef.current
    const sx = img.naturalWidth / d.w, sy = img.naturalHeight / d.h
    const bh = b.w / CROP_RATIO
    const cv = document.createElement('canvas'); cv.width = cropW; cv.height = cropH
    const ctx = cv.getContext('2d')!
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, b.x * sx, b.y * sy, b.w * sx, bh * sy, 0, 0, cropW, cropH)
    const dataUrl = cv.toDataURL('image/webp', 0.95)
    setUploading(true)
    try {
      const url = await uploadByKey(storageKey, dataUrl)
      setSaved(url); setImgSrc(null); onSave?.()
    } catch (e: any) {
      const msg = e?.message ?? String(e)
      console.error('上傳失敗', msg)
      alert(`圖片上傳失敗：${msg}\n\n請至 Supabase Dashboard → Storage → chanceboard → Policies，新增 anon INSERT 政策後重試。`)
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = () => {
    removeByKey(storageKey)
    setSaved(null)
    setSavedFailed(false)
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
    setImgSrc(null)
  }

  const { x, y, w: bw } = box
  const bh = Math.round(bw / CROP_RATIO)
  const { w: dispW, imgX, imgY } = disp
  const absX = imgX + x, absY = imgY + y

  const previewH = 70
  const previewW = Math.round(previewH * cropW / cropH)

  return (
    <div className="img-crop">
      {!imgSrc && (
        <div className="img-crop-saved">
          <div className="img-crop-preview-box" style={{ width: previewW, height: previewH }}>
            {saved && !savedFailed
              ? <img src={saved} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt=""
                  onError={() => setSavedFailed(true)} />
              : <div className="img-crop-empty">尚無圖片</div>
            }
          </div>
          <div className="img-crop-actions">
            <label className="btn sm" style={{ cursor: 'pointer' }}>
              {saved && !savedFailed ? '更換圖片' : '上傳圖片'}
              <input type="file" accept="image/*" onChange={handleFile} hidden />
            </label>
            {saved && !savedFailed && (
              <button className="btn sm" onClick={handleReEdit} disabled={fetchingRe}>
                {fetchingRe ? '載入中…' : '重新裁切'}
              </button>
            )}
            {saved && <button className="btn sm danger" onClick={handleRemove}>移除</button>}
          </div>
        </div>
      )}

      {imgSrc && (
        <div className="img-crop-tool">
          <div ref={stageRef} className={`img-crop-stage${storageKey.startsWith('cb_extra_') ? ' pixel-transparent-stage' : ''}`}>
            <img ref={imgRef} src={imgSrc} className="img-crop-src"
              alt="" onLoad={initBox} draggable={false} />

            {dispW > 0 && <>
              {/* 4 masks outside portrait crop box */}
              <div className="crop-mask" style={{ top: imgY, left: imgX, width: disp.w, height: y }} />
              <div className="crop-mask" style={{ top: absY + bh, left: imgX, width: disp.w, height: disp.h - y - bh }} />
              <div className="crop-mask" style={{ top: absY, left: imgX, width: x, height: bh }} />
              <div className="crop-mask" style={{ top: absY, left: absX + bw, width: disp.w - x - bw, height: bh }} />

              <div className="crop-box"
                style={{ left: absX, top: absY, width: bw, height: bh }}
                onMouseDown={startMove}
              >
                <div className="crop-grid-h" style={{ top: '33.3%' }} />
                <div className="crop-grid-h" style={{ top: '66.6%' }} />
                <div className="crop-grid-v" style={{ left: '33.3%' }} />
                <div className="crop-grid-v" style={{ left: '66.6%' }} />
                <div className="crop-handle crop-h-tl" onMouseDown={startResize('tl')} />
                <div className="crop-handle crop-h-tr" onMouseDown={startResize('tr')} />
                <div className="crop-handle crop-h-bl" onMouseDown={startResize('bl')} />
                <div className="crop-handle crop-h-br" onMouseDown={startResize('br')} />
              </div>
            </>}
          </div>

          <div className="img-crop-hint">拖曳框內移動位置 · 拖曳四角縮放大小</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {storageKey.startsWith('cb_extra_') && <button className="btn sm" onClick={handleRemoveBackground} disabled={uploading || removingBg}>{removingBg ? '去背處理中…' : '自動去背'}</button>}
            <button className="btn primary sm" onClick={handleSave} disabled={uploading}>
              {uploading ? '上傳中…' : '裁切並儲存'}
            </button>
            <button className="btn sm" onClick={handleCancel} disabled={uploading}>取消</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="adm-field">
      <span>{label}</span>
      <input className="adm-input" value={value} onChange={e => onChange(e.target.value)} />
    </label>
  )
}

function Pill({ label, val }: { label: string; val: string }) {
  return (
    <span className="adm-pill">
      <span className="adm-pill-label">{label}</span>
      <b>{val}</b>
    </span>
  )
}

// ─── CardImgSettings ──────────────────────────────────────────────────────────

const CARD_SUIT = allCards.filter(c => c.isSuitCard)
const CARD_FLOWER = allCards.filter(c => !c.isSuitCard)

function CardImgSettings() {
  return (
    <div className="adm-card-settings">
      <div className="adm-section">
        <div className="adm-section-label">花色牌（4 張）</div>
        <div className="adm-card-grid">
          {CARD_SUIT.map(c => <CardImgItem key={c.id} card={c} />)}
        </div>
      </div>
      <div className="adm-section" style={{ marginTop: 20 }}>
        <div className="adm-section-label">花牌（22 張）</div>
        <div className="adm-card-grid">
          {CARD_FLOWER.map(c => <CardImgItem key={c.id} card={c} />)}
        </div>
      </div>
    </div>
  )
}

function CardImgItem({ card }: { card: typeof allCards[number] }) {
  const col = CARD_COLOR[card.color]
  return (
    <div className="adm-card-item" style={{ borderColor: col + '55' }}>
      <div className="adm-card-item-hdr">
        <span className="adm-card-item-icon" style={{ color: col }}>{CARD_ICON[card.id]}</span>
        <span className="adm-card-item-name" style={{ color: col }}>{card.name}</span>
      </div>
      <ImageCrop storageKey={`cb_card_img_${card.id}`} cropW={420} cropH={560} />
    </div>
  )
}
