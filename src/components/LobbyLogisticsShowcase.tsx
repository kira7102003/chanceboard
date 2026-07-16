import { useEffect, useState } from 'react'
import './Logistics.css'
import './LobbyLogisticsShowcase.css'
import { getChars, getUrlByKey } from '../utils/charStore'
import { cancelActiveLogistics, getActiveLogistics, getLogisticsJobs } from '../utils/logisticsStore'

export default function LobbyLogisticsShowcase() {
  const [active, setActive] = useState(getActiveLogistics)
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  if (!active.length) return null
  const jobs = getLogisticsJobs()
  return <div className="lobby-logistics-list">{active.map(item => {
    const jobIndex = Math.max(0, jobs.findIndex(job => job.id === item.id)); const job = jobs[jobIndex]
    const characters = getChars().filter(character => item.charIds.includes(character.id))
    const remain = Math.max(0, Math.ceil((item.endsAt - now) / 1000)); const hours = Math.floor(remain / 3600); const minutes = Math.floor(remain % 3600 / 60); const seconds = remain % 60
    return <section className="lobby-logistics-showcase" key={item.id}>
      <button className="lobby-logistics-emblem" title={`取消${job?.name ?? '後勤'}`} aria-label={`取消${job?.name ?? '後勤'}`} onClick={() => setActive(cancelActiveLogistics(item.id))} style={{ '--job-index': jobIndex, backgroundPosition: `${jobIndex * 25}% center` } as React.CSSProperties} />
      <div className="lobby-logistics-title"><small>後勤執行中 · 點圖示取消</small><b>{job?.name ?? '後勤工作'}</b><span>{hours}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span></div>
      <div className="lobby-logistics-workers">{characters.map((character, index) => { const image = getUrlByKey(`cb_extra_b_img_${character.id}`) ?? getUrlByKey(`cb_extra_a_img_${character.id}`) ?? getUrlByKey(`cb_img_${character.id}`); return <div key={character.id} style={{ '--worker-index': index } as React.CSSProperties}>{image ? <img src={image} alt="" /> : <b>{character.name[0]}</b>}<span>{character.name}</span></div> })}</div>
    </section>
  })}</div>
}
