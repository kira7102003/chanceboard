import { useEffect, useState } from 'react'
import './Logistics.css'
import { getUrlByKey } from '../utils/charStore'
import { getLogisticsJobs } from '../utils/logisticsStore'
import { usePlayerStore } from '../store/playerStore'

interface Props { onClose: () => void }
const ACTIVE_KEY = 'cb_logistics_active'

export default function Logistics({ onClose }: Props) {
  const jobs = getLogisticsJobs()
  const addRewards = usePlayerStore(state => state.addResourceRewards)
  const [active, setActive] = useState<{ id: string; endsAt: number } | null>(() => { try { return JSON.parse(localStorage.getItem(ACTIVE_KEY) ?? 'null') } catch { return null } })
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer) }, [])
  const begin = (id: string, durationSeconds: number) => { const next = { id, endsAt: Date.now() + durationSeconds * 1000 }; setActive(next); localStorage.setItem(ACTIVE_KEY, JSON.stringify(next)) }
  const claim = () => { const job = jobs.find(item => item.id === active?.id); if (!job || !active || now < active.endsAt) return; addRewards(job.rewards); setActive(null); localStorage.removeItem(ACTIVE_KEY) }
  const rewardText = (job: typeof jobs[number]) => [['💎', job.rewards.gems], ['金', job.rewards.coins], ['銀', job.rewards.silver], ['銅', job.rewards.copper], ['鐵', job.rewards.iron], ['木', job.rewards.wood]].filter(([, value]) => Number(value) > 0).map(([label, value]) => `${label} ${value}`).join('　')
  return <div className="panel-overlay logistics-screen"><div className="panel-header"><button className="panel-back" onClick={onClose}>← 返回大廳</button><span className="panel-title">🧰 後勤</span><span className="panel-meta">選擇一項工作</span></div>
    <div className="logistics-grid">{jobs.map(job => { const running = active?.id === job.id; const ready = running && now >= active.endsAt; const remain = running ? Math.max(0, Math.ceil((active.endsAt - now) / 1000)) : job.durationSeconds; const image = getUrlByKey(`cb_logistics_anim_${job.id}`)
      return <article className={`logistics-job ${running ? 'running' : ''}`} key={job.id}><div className="logistics-scene">{image ? <img src={image} alt="" /> : <span>{job.icon}</span>}<i /></div><h3>{job.name}</h3><p>{rewardText(job)}</p><div className="logistics-progress"><i style={{ width: running ? `${Math.min(100, (1 - remain / job.durationSeconds) * 100)}%` : '0%' }} /></div><small>{ready ? '工作完成！' : `${remain} 秒`}</small><button className="btn primary" disabled={!!active && !running} onClick={() => ready ? claim() : !active && begin(job.id, job.durationSeconds)}>{ready ? '領取資源' : running ? '進行中…' : '開始工作'}</button></article>})}</div>
  </div>
}
