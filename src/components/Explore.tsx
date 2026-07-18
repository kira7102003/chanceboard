import { useEffect, useMemo, useState } from 'react'
import FunctionIcon from './FunctionIcon'
import PixelCharacterActor from './PixelCharacterActor'
import { getChars, getCharImg, getMoveImg } from '../utils/charStore'
import { moves } from '../data/db'
import { usePlayerStore } from '../store/playerStore'
import { consumeMiningDailyUse, getMiningConfig, getMiningDailyUses, getMiningRun, miningStats, rollMiningRewards, saveMiningRun, type MiningJob, type MiningRun } from '../utils/miningStore'
import './Explore.css'

interface Props { onClose: () => void }
const fmt = (seconds: number) => `${Math.max(0, Math.floor(seconds / 3600))}:${String(Math.max(0, Math.floor(seconds % 3600 / 60))).padStart(2, '0')}:${String(Math.max(0, Math.floor(seconds % 60))).padStart(2, '0')}`

export default function Explore({ onClose }: Props) {
  const player = usePlayerStore(), chars = useMemo(() => getChars(), []), config = useMemo(() => getMiningConfig(), [])
  const available = (player.ownedCharIds.length ? chars.filter(char => player.ownedCharIds.includes(char.id)) : chars).filter(char => char.enabled !== false)
  const [selected, setSelected] = useState<string[]>([]), [run, setRun] = useState<MiningRun>(() => getMiningRun() ?? { jobs: [] }), [now, setNow] = useState(Date.now()), [message, setMessage] = useState('')
  const [dailyTick, setDailyTick] = useState(0), [manual, setManual] = useState(false), [target, setTarget] = useState(0),[entryMode,setEntryMode]=useState<'manual'|'auto'>('manual')
  const [manualHp, setManualHp] = useState(() => config.nodes.map(node => node.maxHp)), [manualPositions, setManualPositions] = useState<{x:number;y:number}[]>([])
  const [manualEndAt, setManualEndAt] = useState(0), [attacking, setAttacking] = useState('')
  const [activeMiner,setActiveMiner]=useState(''),[combo,setCombo]=useState(0),[lastStrike,setLastStrike]=useState(0)
  const [manualDebris,setManualDebris]=useState<{id:number;x:number;y:number;kind:'rock'|'crystal'|'pit'}[]>([])
  const [skillCooldowns,setSkillCooldowns]=useState<Record<string,number>>({})
  const [digMarks,setDigMarks]=useState<{id:number;x:number;y:number;size:number}[]>([])
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
    const reward=rollMiningRewards(state,Math.max(1,state.broken)),summary=Object.entries(reward).map(([key,amount])=>`${rewardLabel[key]??key} +${amount}`).join('、')||'沒有額外掉落'
    player.addResourceRewards(reward); persistJobs(run.jobs.filter(job => job.nodeId !== nodeId)); setMessage(`${state.name}完成：${summary}`)
  }
  const enterManual = (choice:number|React.MouseEvent=target) => { const chosen=typeof choice==='number'?choice:target;if (!selected.length) return setMessage('請先選擇一位角色，再點擊要進入的礦坑'); const miner=selected[0];setSelected([miner]);setManualPositions([{ x: 12, y: 78 }]); setManualDebris(Array.from({length:34},(_,id)=>({id,x:4+Math.floor(Math.random()*46)*2,y:7+Math.floor(Math.random()*43)*2,kind:(id%7===0?'crystal':id%5===0?'pit':'rock') as 'rock'|'crystal'|'pit'}))); setManualHp(config.nodes.map(node => node.maxHp)); setTarget(chosen); setActiveMiner(miner);setCombo(0);setLastStrike(0);setDigMarks([]);setSkillCooldowns({});setAttacking(''); setMessage(`直接連按技能挖掘 ${config.nodes[chosen].name}，命中會留下挖掘痕跡`); setManualEndAt(Date.now()+15000); setManual(true) }
  const manualSeconds=Math.max(0,Math.ceil((manualEndAt-now)/1000)),manualFinished=manualSeconds<=0||manualHp[target]<=0
  const rewardLabel:Record<string,string>={swordSoul:'劍魂',gunSoul:'槍魂',magicSoul:'法魂',coins:'金幣',gems:'鑽石',silver:'銀',copper:'銅',iron:'鐵',wood:'木'}
  const attackRock = (charId: string, moveId: string) => {
    const char=chars.find(item=>item.id===charId),move=moves.find(item=>item.id===moveId),node=config.nodes[target]
    const cooldownKey=`${charId}_${moveId}`
    if(!char||!move||!node||manualFinished||manualHp[target]<=0||attacking||(skillCooldowns[cooldownKey]??0)>Date.now())return
    const nextCombo=Date.now()-lastStrike<2000?Math.min(5,combo+1):1,damage=Math.max(1,Math.round(char.atk*(move.powerRatio??1)*120*(1+(nextCombo-1)*.1))),attackKey=`${charId}_${moveId}`
    const miningCooldown=Math.max(.35,Math.min(1.5,(move.cooldown??2)*.3))
    setCombo(nextCombo);setLastStrike(Date.now());setActiveMiner(charId);setSkillCooldowns(value=>({...value,[cooldownKey]:Date.now()+miningCooldown*1000}))
    setAttacking(attackKey)
    setManualPositions(pos=>pos.map((point,index)=>index===0?{x:Math.max(4,Math.min(96,node.x+(Math.random()-.5)*7)),y:Math.max(8,Math.min(92,node.y+9+Math.random()*5))}:point))
    window.setTimeout(()=>{setDigMarks(marks=>[...marks.slice(-23),{id:Date.now(),x:Math.max(3,Math.min(97,node.x+(Math.random()-.5)*14)),y:Math.max(6,Math.min(94,node.y+(Math.random()-.5)*10)),size:18+Math.random()*24}]);setManualHp(current=>{if(Date.now()>=manualEndAt)return current;const next=[...current],before=next[target];next[target]=Math.max(0,before-damage);if(before>0&&next[target]===0){const rewards=rollMiningRewards(node),summary=Object.entries(rewards).map(([key,amount])=>`${rewardLabel[key]??key} +${amount}`).join('、')||'沒有額外掉落';player.addResourceRewards(rewards);setMessage(`${node.name}已清除：${summary}`)}return next});setAttacking('')},420)
  }
  const moveOnGrid=(event:React.MouseEvent<HTMLElement>)=>{if(manualFinished||!activeMiner||(event.target as HTMLElement).closest('button'))return;const rect=event.currentTarget.getBoundingClientRect(),x=Math.round((event.clientX-rect.left)/rect.width*49)/49*100,y=Math.round((event.clientY-rect.top)/rect.height*49)/49*100;setManualPositions(points=>points.map((point,index)=>selected[index]===activeMiner?{x,y}:point))}
  if (manual) return <div className="panel-overlay mining-manual">
    <div className="panel-header"><button className="panel-back" onClick={()=>setManual(false)}>返回挖礦</button><span className="panel-title">⛏ 手動挖掘 · 50×50</span><span className="manual-combo">{combo>1?`${combo} COMBO · +${(combo-1)*10}%`:activeMiner?`${chars.find(char=>char.id===activeMiner)?.name} 挖掘中`:''}</span><span className={`panel-meta manual-timer ${manualSeconds<=5?'danger':''}`}>剩餘 {manualSeconds}s</span></div>
    <section className="manual-mine-grid" onClick={moveOnGrid}><div className="manual-tile-field" aria-label="50×50 礦坑地磚"><i className="manual-target-tile" style={{left:`${config.nodes[target]?.x??50}%`,top:`${config.nodes[target]?.y??50}%`}}/></div>
      {manualDebris.map(item=><i key={item.id} className={`manual-debris ${item.kind}`} style={{left:`${item.x}%`,top:`${item.y}%`}}/>)}
      {digMarks.map(mark=><i key={mark.id} className="manual-dig-mark" style={{left:`${mark.x}%`,top:`${mark.y}%`,width:mark.size,height:mark.size}}/>)}
      {config.nodes.map((node,index)=><button key={node.id} disabled={manualFinished||manualHp[index]<=0} className={`manual-rock ${target===index?'selected':''} ${manualHp[index]<=0?'cleared':''}`} style={{left:`${node.x}%`,top:`${node.y}%`}} onClick={()=>setTarget(index)}><span>{manualHp[index]<=0?'✓':'◆'}</span><b>{node.name}</b><strong>{rewardLabel[node.reward]??node.reward}</strong><i><em style={{width:`${manualHp[index]/node.maxHp*100}%`}}/></i><small>{Math.ceil(manualHp[index]).toLocaleString()} / {node.maxHp.toLocaleString()}</small></button>)}
      {selected.map((id,index)=><div className={`manual-worker active ${attacking.startsWith(id)?'attacking':''}`} key={id} style={{left:`${manualPositions[index]?.x??50}%`,top:`${manualPositions[index]?.y??80}%`}}><PixelCharacterActor charId={id} pose="side" action="mining" face="right"/><b>{chars.find(char=>char.id===id)?.name}</b></div>)}
      {manualFinished&&<div className="manual-result"><b>{manualHp[target]<=0?'挖掘完成！':'時間到'}</b><span>{manualHp[target]<=0?'已取得本礦坑獎勵':'本次沒有挖完礦脈'}</span><button onClick={()=>enterManual(target)}>再次挖掘</button></div>}
    </section>
    <div className="manual-skills">{selected.flatMap(id=>moves.filter(move=>move.ownerId===id&&move.slot!=='被').map(move=>{const duration=Math.max(.35,Math.min(1.5,(move.cooldown??2)*.3)),cooldown=Math.max(0,(skillCooldowns[`${id}_${move.id}`]??0)-now),cooling=cooldown>0;return <button disabled={manualFinished||!!attacking||manualHp[target]<=0||cooling} className={`${activeMiner===id?'active-miner':''} ${cooling?'cooling':''} ${attacking===`${id}_${move.id}`?'attacking':''}`} key={`${id}_${move.id}`} onClick={()=>attackRock(id,move.id)}>{getMoveImg(move.id)&&<img src={getMoveImg(move.id)!} alt=""/>}<span>{chars.find(char=>char.id===id)?.name}<b>{move.name}</b><small>{cooling?`CD ${(cooldown/1000).toFixed(1)}s`:`傷害 ${Math.round((chars.find(char=>char.id===id)?.atk??1)*(move.powerRatio??1)*120)} · CD ${duration.toFixed(1)}s`}</small></span>{cooling&&<i className="manual-skill-cd" style={{'--cd':`${Math.min(100,cooldown/(duration*10))}%`} as React.CSSProperties}/>}</button>}) )}</div>
    {message&&<output className="manual-message">{message}</output>}
  </div>
  return <div className="panel-overlay mining-screen" data-daily-tick={dailyTick}>
    <div className="panel-header"><button className="panel-back" onClick={onClose}>返回大廳</button><span className="panel-title"><FunctionIcon name="explore"/>礦坑探索</span><span className="panel-meta">選角色後，點擊礦坑進入</span></div>
    <main className="mining-layout"><section className="mining-map">{nodeState.map((state,index)=>{
      const direction=['right','up','left','down'][Math.floor(now/2200+index)%4] as 'right'|'up'|'left'|'down',pose=direction==='up'?'back':direction==='down'?'front':'side'
      return <div role="button" tabIndex={entryMode==='manual'?0:-1} aria-label={`進入${state.name}`} className={`mining-node mining-node-${index+1} mode-${entryMode} ${state.percent<40?'cracked':''}`} style={{left:`${state.x}%`,top:`${state.y}%`}} key={state.id} onClick={event=>{if(entryMode==='manual'&&!(event.target as HTMLElement).closest('button'))enterManual(index)}} onKeyDown={event=>{if(entryMode==='manual'&&event.key==='Enter')enterManual(index)}}>
        <div className="mining-hp"><b>{state.name}</b><span>{Math.ceil(state.hp).toLocaleString()} / {state.maxHp.toLocaleString()}</span><i><em style={{width:`${state.percent}%`}}/></i><small>{entryMode==='manual'?'點擊礦坑進入手動':'選角後開始自動挖掘'} · 今日 {state.uses}/3</small></div>
        {state.char&&<div className={`mining-worker walk-${direction}`}><PixelCharacterActor charId={state.char.id} pose={pose} action="walk" face={direction==='left'?'left':'right'}/><label>{state.char.name}<small>力度 {state.stats?.power.toFixed(1)} · 速度 +{state.stats?.speed.toFixed(0)}%</small></label></div>}
        <div className="mining-node-action">{state.job?(state.finished?<button className="ready" onClick={()=>claimNode(state.id)}>領取</button>:<><span>{fmt((state.job.endsAt-now)/1000)}</span><button onClick={()=>cancelNode(state.id)}>取消</button></>):entryMode==='manual'?<button onClick={()=>enterManual(index)}>進入手動</button>:<button disabled={state.uses>=3} onClick={()=>startNode(state.id)}>開始自動</button>}</div>
      </div>
    })}</section><aside className="mining-side"><div className="mining-mode-switch"><button className={entryMode==='manual'?'active':''} onClick={()=>{setEntryMode('manual');setSelected([]);setMessage('')}}>手動挖礦</button><button className={entryMode==='auto'?'active':''} onClick={()=>{setEntryMode('auto');setSelected([]);setMessage('')}}>自動挖掘</button></div><h2>{entryMode==='manual'?'選擇一位進場角色':'選擇一位派遣角色'}</h2><p>{entryMode==='manual'?'選好角色後，點礦坑進場。':'選好角色後，按礦坑下方「開始自動」。'}</p><div className="mining-roster">{available.map(char=>{const bound=nodeState.find(node=>node.char?.id===char.id);return <button disabled={!!bound} className={selected.includes(char.id)?'selected':''} onClick={()=>setSelected(ids=>ids.includes(char.id)?[]:[char.id])} key={char.id}>{getCharImg(char.id)&&<img src={getCharImg(char.id)!} alt=""/>}<span>{char.name}<small>{bound?`綁定：${bound.name}`:`ATK ${char.atk} · SPD ${char.spd}`}</small></span></button>})}</div>{message&&<output>{message}</output>}</aside></main>
  </div>
}
