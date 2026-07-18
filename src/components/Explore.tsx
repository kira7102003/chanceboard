import { useEffect, useMemo, useState } from 'react'
import FunctionIcon from './FunctionIcon'
import PixelCharacterActor from './PixelCharacterActor'
import { getChars, getCharImg, getMoveImg } from '../utils/charStore'
import { moves } from '../data/db'
import { usePlayerStore } from '../store/playerStore'
import { consumeMiningDailyUse, getMiningConfig, getMiningDailyUses, getMiningRun, miningStats, saveMiningRun, type MiningJob, type MiningRun, type MiningRewardKey } from '../utils/miningStore'
import './Explore.css'

interface Props { onClose: () => void }
const fmt = (seconds: number) => `${Math.max(0, Math.floor(seconds / 3600))}:${String(Math.max(0, Math.floor(seconds % 3600 / 60))).padStart(2, '0')}:${String(Math.max(0, Math.floor(seconds % 60))).padStart(2, '0')}`

export default function Explore({ onClose }: Props) {
  const player = usePlayerStore(), chars = useMemo(() => getChars(), []), config = useMemo(() => getMiningConfig(), [])
  const available = (player.ownedCharIds.length ? chars.filter(char => player.ownedCharIds.includes(char.id)) : chars).filter(char => char.enabled !== false)
  const [selected, setSelected] = useState<string[]>([]), [run, setRun] = useState<MiningRun>(() => getMiningRun() ?? { jobs: [] }), [now, setNow] = useState(Date.now()), [message, setMessage] = useState('')
  const [dailyTick, setDailyTick] = useState(0), [manual, setManual] = useState(false), [target, setTarget] = useState(0)
  const [manualHp, setManualHp] = useState(() => config.nodes.map(node => node.maxHp)), [manualPositions, setManualPositions] = useState<{x:number;y:number}[]>([])
  const [manualEndAt, setManualEndAt] = useState(0), [attacking, setAttacking] = useState('')
  useEffect(() => { const timer = setInterval(() => { setNow(Date.now()); setDailyTick(value => value + 1) }, 500); return () => clearInterval(timer) }, [])
  const persistJobs = (jobs: MiningJob[]) => { const value = { jobs }; setRun(value); saveMiningRun(jobs.length ? value : null) }
  const nodeState = config.nodes.map(node => {
    const job = run.jobs.find(item => item.nodeId === node.id), char = job ? chars.find(item => item.id === job.charId) : undefined, stats = char ? miningStats(char.atk, char.spd, config.weeklyCharacterIds.includes(char.id), config) : null
    const elapsed = job ? Math.max(0, Math.min(job.endsAt, now) - job.startedAt) / 1000 : 0, total = (stats?.damagePerSecond ?? 0) * elapsed, cycle = node.maxHp + (stats?.damagePerSecond ?? 0) * node.respawnSeconds, broken = Math.floor(total / cycle), hp = Math.max(0, node.maxHp - total % cycle)
    return { ...node, job, char, stats, broken, hp, percent: hp / node.maxHp * 100, finished: !!job && now >= job.endsAt, uses: getMiningDailyUses(node.id) }
  })
  const startNode = (nodeId: string) => {
    const used = new Set(run.jobs.map(job => job.charId)), charId = selected.find(id => !used.has(id))
    if (!charId) return setMessage('請選擇一位尚未派遣的角色；每個礦點只能一人')
    if (!consumeMiningDailyUse(nodeId)) return setMessage('這個礦點今天三次自動挖掘已用完，上午 4:00 重置')
    const job = { nodeId, charId, startedAt: Date.now(), endsAt: Date.now() + config.durationHours * 3600000 }
    persistJobs([...run.jobs, job]); setDailyTick(value => value + 1); setMessage('角色已前往該礦點自動挖掘')
  }
  const cancelNode = (nodeId: string) => { if (!confirm('確定取消這個礦點的自動挖掘？次數不會退回。')) return; persistJobs(run.jobs.filter(job => job.nodeId !== nodeId)); setMessage('已取消該礦點的自動挖掘') }
  const claimNode = (nodeId: string) => {
    const state = nodeState.find(node => node.id === nodeId); if (!state?.finished) return
    const amount = Math.max(1, Math.floor(state.broken * (state.rewardMin + state.rewardMax) / 2)), reward: Partial<Record<MiningRewardKey, number>> = { [state.reward]: amount }
    player.addResourceRewards(reward); persistJobs(run.jobs.filter(job => job.nodeId !== nodeId)); setMessage(`${state.name}完成：${state.reward} +${amount}`)
  }
  const enterManual = () => { if (!selected.length) return setMessage('請先選擇 1～3 位角色'); setManualPositions(selected.map(() => ({ x: 8 + Math.floor(Math.random() * 35) * 2, y: 12 + Math.floor(Math.random() * 35) * 2 }))); setManualHp(config.nodes.map(node => node.maxHp)); setTarget(0); setAttacking(''); setMessage('15 秒內移動角色並用招式清除礦物'); setManualEndAt(Date.now()+15000); setManual(true) }
  const manualSeconds=Math.max(0,Math.ceil((manualEndAt-now)/1000)),manualFinished=manualSeconds<=0||selected.every((_,index)=>manualHp[index]<=0)
  const rewardLabel:Record<string,string>={swordSoul:'劍魂',gunSoul:'槍魂',magicSoul:'法魂'}
  const attackRock = (charId: string, moveId: string) => {
    const char=chars.find(item=>item.id===charId),move=moves.find(item=>item.id===moveId),node=config.nodes[target]
    if(!char||!move||!node||manualFinished||manualHp[target]<=0||attacking)return
    if(selected.indexOf(charId)!==target)return setMessage(`${char.name}綁定的是第 ${selected.indexOf(charId)+1} 個礦點`)
    const damage=Math.max(1,Math.round(char.atk*(move.powerRatio??1)*120)),attackKey=`${charId}_${moveId}`
    setAttacking(attackKey)
    setManualPositions(pos=>pos.map((point,index)=>selected[index]===charId?{x:Math.max(4,Math.min(96,node.x+(Math.random()-.5)*7)),y:Math.max(8,Math.min(92,node.y+9+Math.random()*5))}:point))
    window.setTimeout(()=>{setManualHp(current=>{if(Date.now()>=manualEndAt)return current;const next=[...current],before=next[target];next[target]=Math.max(0,before-damage);if(before>0&&next[target]===0){const amount=Math.floor((node.rewardMin+node.rewardMax)/2);player.addResourceRewards({[node.reward]:amount});setMessage(`${node.name}已清除，獲得 ${rewardLabel[node.reward]??node.reward} +${amount}`)}return next});setAttacking('')},520)
  }
  if (manual) return <div className="panel-overlay mining-manual"><div className="panel-header"><button className="panel-back" onClick={()=>setManual(false)}>返回挖礦</button><span className="panel-title">⛏ 手動挖掘 · 50×50</span><span className={`panel-meta manual-timer ${manualSeconds<=5?'danger':''}`}>剩餘 {manualSeconds}s</span></div><section className="manual-mine-grid"><div className="manual-tile-field" aria-label="50×50 礦坑地磚"><i className="manual-target-tile" style={{left:`${config.nodes[target]?.x??50}%`,top:`${config.nodes[target]?.y??50}%`}}/></div>{config.nodes.map((node,index)=><button key={node.id} disabled={manualFinished||manualHp[index]<=0} className={`manual-rock ${target===index?'selected':''} ${manualHp[index]<=0?'cleared':''}`} style={{left:`${node.x}%`,top:`${node.y}%`}} onClick={()=>setTarget(index)}><span>{manualHp[index]<=0?'✓':'◆'}</span><b>{node.name}</b><strong>{rewardLabel[node.reward]??node.reward}</strong><i><em style={{width:`${manualHp[index]/node.maxHp*100}%`}}/></i><small>{Math.ceil(manualHp[index]).toLocaleString()} / {node.maxHp.toLocaleString()}</small></button>)}{selected.map((id,index)=><div className={`manual-worker ${attacking.startsWith(id)?'attacking':''}`} key={id} style={{left:`${manualPositions[index]?.x??50}%`,top:`${manualPositions[index]?.y??80}%`}}><PixelCharacterActor charId={id} pose="side" action={attacking.startsWith(id)?'mining':'walk'} face="right"/><b>{chars.find(char=>char.id===id)?.name}</b></div>)}{manualFinished&&<div className="manual-result"><b>{manualHp.every(hp=>hp<=0)?'全部礦物清除！':'時間到'}</b><span>已清除 {manualHp.filter(hp=>hp<=0).length} / {manualHp.length} 個挖掘點</span><button onClick={enterManual}>再挑戰一次</button></div>}</section><div className="manual-skills">{selected.flatMap(id=>moves.filter(move=>move.ownerId===id&&move.slot!=='被').map(move=><button disabled={manualFinished||!!attacking||manualHp[target]<=0} className={attacking===`${id}_${move.id}`?'attacking':''} key={`${id}_${move.id}`} onClick={()=>attackRock(id,move.id)}>{getMoveImg(move.id)&&<img src={getMoveImg(move.id)!} alt=""/>}<span>{chars.find(char=>char.id===id)?.name}<b>{move.name}</b><small>礦物傷害 {Math.round((chars.find(char=>char.id===id)?.atk??1)*(move.powerRatio??1)*120)}</small></span></button>))}</div>{message&&<output className="manual-message">{message}</output>}</div>
  return <div className="panel-overlay mining-screen" data-daily-tick={dailyTick}><div className="panel-header"><button className="panel-back" onClick={onClose}>返回大廳</button><span className="panel-title"><FunctionIcon name="explore"/>礦坑探索</span><span className="panel-meta">每日 04:00 重置</span></div><main className="mining-layout"><section className="mining-map">{nodeState.map((state,index)=>{const direction=['right','up','left','down'][Math.floor(now/2200+index)%4] as 'right'|'up'|'left'|'down',pose=direction==='up'?'back':direction==='down'?'front':'side';return <div className={`mining-node mining-node-${index+1} ${state.percent<40?'cracked':''}`} style={{left:`${state.x}%`,top:`${state.y}%`}} key={state.id}><div className="mining-hp"><b>{state.name}</b><span>{Math.ceil(state.hp).toLocaleString()} / {state.maxHp.toLocaleString()}</span><i><em style={{width:`${state.percent}%`}}/></i><small>已挖碎 {state.broken} 塊 · 今日 {state.uses}/3</small></div>{state.char&&<div className={`mining-worker walk-${direction}`}><PixelCharacterActor charId={state.char.id} pose={pose} action="walk" face={direction==='left'?'left':'right'}/><label>{state.char.name}<small>力度 {state.stats?.power.toFixed(1)} · 速度 +{state.stats?.speed.toFixed(0)}%</small></label></div>}<div className="mining-node-action">{!state.job?<button disabled={state.uses>=3} onClick={()=>startNode(state.id)}>自動挖掘</button>:state.finished?<button className="ready" onClick={()=>claimNode(state.id)}>領取</button>:<><span>{fmt((state.job.endsAt-now)/1000)}</span><button onClick={()=>cancelNode(state.id)}>取消</button></>}</div></div>})}</section><aside className="mining-side"><h2>選擇挖礦角色</h2><p>一個礦點只能一人；同一角色不能重複派遣。</p><div className="mining-roster">{available.map(char=>{const bound=nodeState.find(node=>node.char?.id===char.id);return <button disabled={!!bound} className={selected.includes(char.id)?'selected':''} onClick={()=>setSelected(ids=>ids.includes(char.id)?ids.filter(id=>id!==char.id):ids.length<3?[...ids,char.id]:ids)} key={char.id}>{getCharImg(char.id)&&<img src={getCharImg(char.id)!} alt=""/>}<span>{char.name}<small>{bound?`綁定：${bound.name}`:`ATK ${char.atk} · SPD ${char.spd}`}</small></span></button>})}</div><button className="mining-main manual" onClick={enterManual}>進入 50×50 手動挖掘</button>{message&&<output>{message}</output>}</aside></main></div>
}
