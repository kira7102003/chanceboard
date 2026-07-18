import { useEffect, useMemo, useState } from 'react'
import FunctionIcon from './FunctionIcon'
import PixelCharacterActor from './PixelCharacterActor'
import { getChars, getCharImg } from '../utils/charStore'
import { usePlayerStore } from '../store/playerStore'
import { getMiningConfig, getMiningRun, miningStats, saveMiningRun, type MiningRun, type MiningRewardKey } from '../utils/miningStore'
import './Explore.css'

interface Props { onClose: () => void }
const fmt = (seconds: number) => `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

export default function Explore({ onClose }: Props) {
  const player = usePlayerStore(), chars = useMemo(() => getChars(), []), config = useMemo(() => getMiningConfig(), [])
  const available = (player.ownedCharIds.length ? chars.filter(char => player.ownedCharIds.includes(char.id)) : chars).filter(char => char.enabled !== false)
  const [selected, setSelected] = useState<string[]>([]), [run, setRun] = useState<MiningRun | null>(getMiningRun), [now, setNow] = useState(Date.now()), [message, setMessage] = useState('')
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(timer) }, [])
  const assigned = (run?.characterIds ?? selected).map(id => chars.find(char => char.id === id)).filter(Boolean) as typeof chars
  const elapsed = run ? Math.max(0, Math.min(run.endsAt, now) - run.startedAt) / 1000 : 0, finished = !!run && now >= run.endsAt
  const nodeState = config.nodes.map((node, index) => {
    const char = assigned[index % Math.max(1, assigned.length)], stats = char ? miningStats(char.atk, char.spd, config.weeklyCharacterIds.includes(char.id), config) : null
    const total = (stats?.damagePerSecond ?? 0) * elapsed, cycle = node.maxHp + (stats?.damagePerSecond ?? 0) * node.respawnSeconds, broken = Math.floor(total / cycle), damage = total % cycle, hp = Math.max(0, node.maxHp - damage)
    return { ...node, char, stats, broken, hp, percent: hp / node.maxHp * 100 }
  })
  const start = () => {
    if (!selected.length) return setMessage('請選擇 1～3 位挖礦角色')
    const value = { startedAt: Date.now(), endsAt: Date.now() + config.durationHours * 3600000, characterIds: selected }
    saveMiningRun(value); setRun(value); setMessage('挖礦隊伍已出發')
  }
  const claim = () => {
    if (!run || !finished) return
    const reward: Partial<Record<MiningRewardKey, number>> = {}
    nodeState.forEach(node => { const average = (node.rewardMin + node.rewardMax) / 2; reward[node.reward] = (reward[node.reward] ?? 0) + Math.max(1, Math.floor(node.broken * average)) })
    player.addResourceRewards(reward); saveMiningRun(null); setRun(null); setSelected([])
    setMessage(`挖礦完成：${Object.entries(reward).map(([key, value]) => `${key} +${value}`).join('、')}`)
  }
  return <div className="panel-overlay mining-screen">
    <div className="panel-header"><button className="panel-back" onClick={onClose}>返回大廳</button><span className="panel-title"><FunctionIcon name="explore" />礦坑探索</span><span className="panel-meta">{run ? (finished ? '可以領取' : `剩餘 ${fmt((run.endsAt - now) / 1000)}`) : `派遣 ${selected.length}/3`}</span></div>
    <main className="mining-layout"><section className="mining-map">
      {config.nodes.map((node, index) => { const state = nodeState[index]; return <div className={`mining-node mining-node-${index + 1} ${state.percent < 40 ? 'cracked' : ''}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} key={node.id}>
        <div className="mining-hp"><b>{node.name}</b><span>{Math.ceil(state.hp).toLocaleString()} / {node.maxHp.toLocaleString()}</span><i><em style={{ width: `${state.percent}%` }} /></i><small>已挖碎 {state.broken} 塊</small></div>
        {state.char && <div className="mining-worker"><PixelCharacterActor charId={state.char.id} pose="side" action="walk" face={index === 2 ? 'left' : 'right'} /><label>{state.char.name}<small>力度 {state.stats?.power.toFixed(1)} · 速度 +{state.stats?.speed.toFixed(0)}%</small></label></div>}
        <div className="mining-impact">✦</div>
      </div> })}<div className="mining-spawn">50 × 50 自動尋路區</div>
    </section><aside className="mining-side"><h2>{run ? '挖掘進行中' : '選擇挖礦角色'}</h2><p>ATK 影響力度，SPD 影響挖掘速度；最多三位角色。</p><div className="mining-roster">
      {available.map(char => <button disabled={!!run} className={selected.includes(char.id) || run?.characterIds.includes(char.id) ? 'selected' : ''} onClick={() => setSelected(ids => ids.includes(char.id) ? ids.filter(id => id !== char.id) : ids.length < 3 ? [...ids, char.id] : ids)} key={char.id}>{getCharImg(char.id) && <img src={getCharImg(char.id)!} alt="" />}<span>{char.name}<small>ATK {char.atk} · SPD {char.spd}{config.weeklyCharacterIds.includes(char.id) ? ' · 本週加成' : ''}</small></span></button>)}
    </div>{!run ? <button className="mining-main" onClick={start}>開始 {config.durationHours} 小時挖礦</button> : finished ? <button className="mining-main ready" onClick={claim}>領取挖礦成果</button> : <button className="mining-main" disabled>自動挖掘中</button>}{message && <output>{message}</output>}</aside></main>
  </div>
}
