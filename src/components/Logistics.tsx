import { useEffect, useState } from 'react'
import './Logistics.css'
import { getCharImg, getChars, getUrlByKey } from '../utils/charStore'
import { getActiveLogistics, getLogisticsJobs, saveActiveLogistics } from '../utils/logisticsStore'
import { usePlayerStore } from '../store/playerStore'

interface Props { onClose: () => void }
export default function Logistics({ onClose }: Props) {
  const jobs = getLogisticsJobs()
  const { addResourceRewards: addRewards, ownedCharIds } = usePlayerStore()
  const characters = getChars().filter(character => ownedCharIds.includes(character.id))
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [active, setActive] = useState(getActiveLogistics)
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer) }, [])
  const begin = (id: string, durationSeconds: number) => { if (selectedIds.length !== 3) return; const next = { id, endsAt: Date.now() + durationSeconds * 1000, charIds: selectedIds }; setActive(next); saveActiveLogistics(next) }
  const claim = () => { const job = jobs.find(item => item.id === active?.id); if (!job || !active || now < active.endsAt) return; addRewards(job.rewards); setActive(null); setSelectedIds([]); saveActiveLogistics(null) }
  const toggleCharacter = (id: string) => { if (active) return; setSelectedIds(ids => ids.includes(id) ? ids.filter(item => item !== id) : ids.length < 3 ? [...ids, id] : ids) }
  const rewardText = (job: typeof jobs[number]) => [['💎', job.rewards.gems], ['金', job.rewards.coins], ['銀', job.rewards.silver], ['銅', job.rewards.copper], ['鐵', job.rewards.iron], ['木', job.rewards.wood]].filter(([, value]) => Number(value) > 0).map(([label, value]) => `${label} ${value}`).join('　')
  const timeText = (seconds: number) => { const hours = Math.floor(seconds / 3600); const minutes = Math.floor(seconds % 3600 / 60); const secs = seconds % 60; return `${hours}時 ${String(minutes).padStart(2, '0')}分 ${String(secs).padStart(2, '0')}秒` }
  const partyIds = active?.charIds ?? selectedIds
  return <div className="panel-overlay logistics-screen"><div className="panel-header"><button className="panel-back" onClick={onClose}>← 返回大廳</button><span className="panel-title">🧰 後勤</span><span className="panel-meta">派遣隊伍 {partyIds.length}/3</span></div>
    <div className="logistics-party"><b>{active ? '後勤執行中：這三名角色暫時無法參與決鬥' : '選擇三名後勤角色'}</b><div>{characters.map(character => { const selected = partyIds.includes(character.id); const image = getCharImg(character.id); return <button key={character.id} className={selected ? 'selected' : ''} disabled={!!active || (!selected && partyIds.length >= 3)} onClick={() => toggleCharacter(character.id)}>{image ? <img src={image} alt="" /> : <span>{character.name[0]}</span>}<small>{character.name}</small>{selected && <i>{partyIds.indexOf(character.id) + 1}</i>}</button> })}</div>{characters.length < 3 && <small>收藏角色不足三名，暫時無法派遣。</small>}</div>
    <div className="logistics-grid">{jobs.map(job => { const running = active?.id === job.id; const ready = running && now >= active.endsAt; const remain = running ? Math.max(0, Math.ceil((active.endsAt - now) / 1000)) : job.durationSeconds; const image = getUrlByKey(`cb_logistics_anim_${job.id}`)
      return <article className={`logistics-job ${running ? 'running' : ''}`} key={job.id}><div className="logistics-scene"><div className="logistics-style-icon" style={{ '--job-index': jobs.indexOf(job), backgroundPosition: `${jobs.indexOf(job) * 25}% center` } as React.CSSProperties} />{image ? <img src={image} alt="" /> : null}<i /></div><h3>{job.name}</h3><p>{rewardText(job)}</p><div className="logistics-progress"><i style={{ width: running ? `${Math.min(100, (1 - remain / job.durationSeconds) * 100)}%` : '0%' }} /></div><small>{ready ? '工作完成！' : timeText(remain)}</small><button className="btn primary" disabled={(!active && selectedIds.length !== 3) || (!!active && !running)} onClick={() => ready ? claim() : !active && begin(job.id, job.durationSeconds)}>{ready ? '領取資源' : running ? '進行中…' : selectedIds.length === 3 ? '派遣三人' : `還需 ${3 - selectedIds.length} 人`}</button></article>})}</div>
  </div>
}
