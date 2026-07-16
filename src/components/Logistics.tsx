import { useEffect, useState } from 'react'
import './Logistics.css'
import { getCharImg, getChars, getUrlByKey } from '../utils/charStore'
import { cancelActiveLogistics, getActiveLogistics, getLogisticsBusyCharacterIds, getLogisticsJobs, saveActiveLogistics } from '../utils/logisticsStore'
import { usePlayerStore } from '../store/playerStore'
import FunctionIcon from './FunctionIcon'

interface Props { onClose: () => void }
export default function Logistics({ onClose }: Props) {
  const jobs = getLogisticsJobs()
  const { addResourceRewards: addRewards, ownedCharIds } = usePlayerStore()
  const characters = getChars().filter(character => ownedCharIds.includes(character.id))
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [active, setActive] = useState(getActiveLogistics)
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer) }, [])
  const begin = (id: string, durationSeconds: number) => { if (selectedIds.length !== 3 || active.some(item => item.id === id)) return; const next = [...active, { id, endsAt: Date.now() + durationSeconds * 1000, charIds: selectedIds }]; setActive(next); saveActiveLogistics(next); setSelectedIds([]) }
  const claim = (id: string) => { const running = active.find(item => item.id === id); const job = jobs.find(item => item.id === id); if (!job || !running || now < running.endsAt) return; addRewards(job.rewards); const next = active.filter(item => item.id !== id); setActive(next); saveActiveLogistics(next) }
  const cancel = (id: string) => setActive(cancelActiveLogistics(id))
  const toggleCharacter = (id: string) => { if (getLogisticsBusyCharacterIds().includes(id)) return; setSelectedIds(ids => ids.includes(id) ? ids.filter(item => item !== id) : ids.length < 3 ? [...ids, id] : ids) }
  const rewardText = (job: typeof jobs[number]) => [['💎', job.rewards.gems], ['金', job.rewards.coins], ['銀', job.rewards.silver], ['銅', job.rewards.copper], ['鐵', job.rewards.iron], ['木', job.rewards.wood]].filter(([, value]) => Number(value) > 0).map(([label, value]) => `${label} ${value}`).join('　')
  const timeText = (seconds: number) => { const hours = Math.floor(seconds / 3600); const minutes = Math.floor(seconds % 3600 / 60); const secs = seconds % 60; return `${hours}時 ${String(minutes).padStart(2, '0')}分 ${String(secs).padStart(2, '0')}秒` }
  const busyIds = getLogisticsBusyCharacterIds()
  return <div className="panel-overlay logistics-screen"><div className="panel-header"><button className="panel-back" onClick={onClose}>← 返回大廳</button><span className="panel-title"><FunctionIcon name="logistics" />後勤</span><span className="panel-meta">執行中 {active.length} 組 · 選擇 {selectedIds.length}/3</span></div>
    <div className="logistics-party"><div>{characters.map(character => { const selected = selectedIds.includes(character.id); const busy = busyIds.includes(character.id); const image = getCharImg(character.id); return <button key={character.id} className={selected ? 'selected' : ''} disabled={busy || (!selected && selectedIds.length >= 3)} onClick={() => toggleCharacter(character.id)}>{image ? <img src={image} alt="" /> : <span>{character.name[0]}</span>}<small>{character.name}{busy ? '（派遣中）' : ''}</small>{selected && <i>{selectedIds.indexOf(character.id) + 1}</i>}</button> })}</div>{characters.length < 3 && <small>收藏角色不足三名，暫時無法派遣。</small>}</div>
    <div className="logistics-grid">{jobs.map(job => { const runningJob = active.find(item => item.id === job.id); const running = !!runningJob; const ready = !!runningJob && now >= runningJob.endsAt; const remain = runningJob ? Math.max(0, Math.ceil((runningJob.endsAt - now) / 1000)) : job.durationSeconds; const image = getUrlByKey(`cb_logistics_anim_${job.id}`); const generatedIcon = getUrlByKey(`cb_logistics_icon_${job.id}`)
      const assigned = runningJob ? characters.filter(character => runningJob.charIds.includes(character.id)) : []
      return <article className={`logistics-job ${running ? 'running' : ''}`} key={job.id}><div className="logistics-scene">{generatedIcon ? <img className="logistics-generated-icon" src={generatedIcon} alt="" /> : <div className="logistics-style-icon" style={{ '--job-index': jobs.indexOf(job), backgroundPosition: `${jobs.indexOf(job) * 25}% center` } as React.CSSProperties} />}{image ? <img src={image} alt="" /> : null}<i /></div><h3>{job.name}</h3><p>{rewardText(job)}</p>{running && <div className="logistics-assigned">{assigned.map(character => { const portrait = getCharImg(character.id); return <span key={character.id}>{portrait ? <img src={portrait} alt="" /> : null}<b>{character.name}</b></span> })}</div>}<div className="logistics-progress"><i style={{ width: running ? `${Math.min(100, (1 - remain / job.durationSeconds) * 100)}%` : '0%' }} /></div><small>{ready ? '工作完成！' : timeText(remain)}</small><button className="btn primary" disabled={!running && selectedIds.length !== 3} onClick={() => ready ? claim(job.id) : running ? cancel(job.id) : begin(job.id, job.durationSeconds)}>{ready ? '領取資源' : running ? '取消後勤' : selectedIds.length === 3 ? '派遣三人' : `還需 ${3 - selectedIds.length} 人`}</button></article>})}</div>
  </div>
}
