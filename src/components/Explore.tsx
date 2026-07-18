import { useEffect, useMemo, useState } from 'react'
import FunctionIcon from './FunctionIcon'
import PixelCharacterActor from './PixelCharacterActor'
import { getChars, getCharImg } from '../utils/charStore'
import { getMoveImg } from '../utils/charStore'
import { moves } from '../data/db'
import { usePlayerStore } from '../store/playerStore'
import { consumeMiningDailyUse, getMiningConfig, getMiningDailyUses, getMiningRun, miningStats, saveMiningRun, type MiningRun, type MiningRewardKey } from '../utils/miningStore'
import './Explore.css'

interface Props { onClose: () => void }
const fmt = (seconds: number) => `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

export default function Explore({ onClose }: Props) {
  const player = usePlayerStore(), chars = useMemo(() => getChars(), []), config = useMemo(() => getMiningConfig(), [])
  const available = (player.ownedCharIds.length ? chars.filter(char => player.ownedCharIds.includes(char.id)) : chars).filter(char => char.enabled !== false)
  const [selected, setSelected] = useState<string[]>([]), [run, setRun] = useState<MiningRun | null>(getMiningRun), [now, setNow] = useState(Date.now()), [message, setMessage] = useState('')
  const [dailyUses, setDailyUses] = useState(getMiningDailyUses), [manual, setManual] = useState(false), [target, setTarget] = useState(0)
  const [manualHp, setManualHp] = useState(() => config.nodes.map(node => node.maxHp)), [manualPositions, setManualPositions] = useState<{x:number;y:number}[]>([])
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
    if (!consumeMiningDailyUse()) return setMessage('今天三次自動挖掘次數已用完')
    const value = { startedAt: Date.now(), endsAt: Date.now() + config.durationHours * 3600000, characterIds: selected }
    saveMiningRun(value); setRun(value); setDailyUses(getMiningDailyUses()); setMessage('挖礦隊伍已出發')
  }
  const cancelAuto = () => { if (!run || !confirm('確定取消自動挖掘？本次每日次數不會退回。')) return; saveMiningRun(null); setRun(null); setMessage('已取消自動挖掘') }
  const enterManual = () => { if (!selected.length) return setMessage('請先選擇 1～3 位角色'); setManualPositions(selected.map(() => ({ x: 8 + Math.floor(Math.random() * 35) * 2, y: 12 + Math.floor(Math.random() * 35) * 2 }))); setManualHp(config.nodes.map(node => node.maxHp)); setManual(true) }
  const attackRock = (charId: string, moveId: string) => { const char=chars.find(item=>item.id===charId),move=moves.find(item=>item.id===moveId);if(!char||!move)return;const damage=Math.max(1,Math.round(char.atk*(move.powerRatio??1)*18)),next=[...manualHp];next[target]=Math.max(0,next[target]-damage);setManualPositions(pos=>pos.map((point,index)=>selected[index]===charId?{x:Math.max(4,Math.min(96,config.nodes[target].x+(Math.random()-.5)*9)),y:Math.max(8,Math.min(92,config.nodes[target].y+10+Math.random()*7))}:point));if(next[target]===0){const node=config.nodes[target],amount=Math.floor((node.rewardMin+node.rewardMax)/2);player.addResourceRewards({[node.reward]:amount});setMessage(`${node.name}碎裂，獲得 ${node.reward} +${amount}`);window.setTimeout(()=>setManualHp(hp=>hp.map((value,index)=>index===target?node.maxHp:value)),900)}setManualHp(next) }
  const claim = () => {
    if (!run || !finished) return
    const reward: Partial<Record<MiningRewardKey, number>> = {}
    nodeState.forEach(node => { const average = (node.rewardMin + node.rewardMax) / 2; reward[node.reward] = (reward[node.reward] ?? 0) + Math.max(1, Math.floor(node.broken * average)) })
    player.addResourceRewards(reward); saveMiningRun(null); setRun(null); setSelected([])
    setMessage(`挖礦完成：${Object.entries(reward).map(([key, value]) => `${key} +${value}`).join('、')}`)
  }
  if(manual)return <div className="panel-overlay mining-manual"><div className="panel-header"><button className="panel-back" onClick={()=>setManual(false)}>返回挖礦</button><span className="panel-title">⛏ 手動挖掘 · 50×50</span><span className="panel-meta">選擇岩石，再使用招式</span></div><section className="manual-mine-grid">{config.nodes.map((node,index)=><button key={node.id} className={`manual-rock ${target===index?'selected':''}`} style={{left:`${node.x}%`,top:`${node.y}%`}} onClick={()=>setTarget(index)}><span>◆</span><b>{node.name}</b><i><em style={{width:`${manualHp[index]/node.maxHp*100}%`}}/></i><small>{Math.ceil(manualHp[index]).toLocaleString()} / {node.maxHp.toLocaleString()}</small></button>)}{selected.map((id,index)=><div className="manual-worker" key={id} style={{left:`${manualPositions[index]?.x??50}%`,top:`${manualPositions[index]?.y??80}%`}}><PixelCharacterActor charId={id} pose="side" action="walk" face="right"/><b>{chars.find(char=>char.id===id)?.name}</b></div>)}</section><div className="manual-skills">{selected.flatMap(id=>moves.filter(move=>move.ownerId===id&&move.slot!=='被').map(move=><button key={`${id}_${move.id}`} onClick={()=>attackRock(id,move.id)}>{getMoveImg(move.id)&&<img src={getMoveImg(move.id)!} alt=""/>}<span>{chars.find(char=>char.id===id)?.name}<b>{move.name}</b><small>預估傷害 {Math.round((chars.find(char=>char.id===id)?.atk??1)*(move.powerRatio??1)*18)}</small></span></button>))}</div>{message&&<output className="manual-message">{message}</output>}</div>
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
    </div><small className="mining-daily">今日自動挖掘：{dailyUses}/3</small>{!run ? <><button className="mining-main" onClick={start} disabled={dailyUses>=3}>開始 {config.durationHours} 小時自動挖掘</button><button className="mining-main manual" onClick={enterManual}>進入 50×50 手動挖掘</button></> : finished ? <button className="mining-main ready" onClick={claim}>領取挖礦成果</button> : <><button className="mining-main" disabled>自動挖掘中</button><button className="mining-cancel" onClick={cancelAuto}>關閉並取消自動挖掘</button></>}{message && <output>{message}</output>}</aside></main>
  </div>
}
