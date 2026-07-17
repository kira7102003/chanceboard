import { useEffect, useState } from 'react'
import './Logistics.css'
import './LobbyLogisticsShowcase.css'
import { getChars, getUrlByKey } from '../utils/charStore'
import { cancelActiveLogistics, getActiveLogistics, getLogisticsJobs } from '../utils/logisticsStore'

export default function LobbyLogisticsShowcase({ onOpen }: { onOpen?: () => void }) {
  const [active, setActive] = useState(getActiveLogistics)
  const [now, setNow] = useState(Date.now())
  const [completedNotice, setCompletedNotice] = useState<string[]>([])
  const jobs = getLogisticsJobs()

  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  useEffect(() => {
    const completed = active.filter(item => item.endsAt <= now).filter(item => {
      const key = `cb_logistics_notified_${item.id}_${item.endsAt}`
      if (localStorage.getItem(key)) return false
      localStorage.setItem(key, '1')
      return true
    }).map(item => item.id)
    if (completed.length) setCompletedNotice(current => [...new Set([...current, ...completed])])
  }, [active, now])

  if (!active.length) return null
  const completedNames = completedNotice.map(id => jobs.find(job => job.id === id)?.name ?? '後勤工作')
  return <>
    {completedNotice.length > 0 && <aside className="lobby-logistics-notice"><b>後勤完成</b><span>{completedNames.join('、')}已經完成，可以前往後勤領取。</span><div><button onClick={() => { setCompletedNotice([]); onOpen?.() }}>前往後勤</button><button onClick={() => setCompletedNotice([])}>稍後</button></div></aside>}
    <div className="lobby-logistics-list">{active.map(item => {
      const jobIndex = Math.max(0, jobs.findIndex(job => job.id === item.id)); const job = jobs[jobIndex]
      const characters = getChars().filter(character => item.charIds.includes(character.id)); const generatedIcon = getUrlByKey(`cb_logistics_icon_${item.id}`)
      const remain = Math.max(0, Math.ceil((item.endsAt - now) / 1000)); const hours = Math.floor(remain / 3600); const minutes = Math.floor(remain % 3600 / 60); const seconds = remain % 60
      const openOrCancel = () => remain === 0 ? onOpen?.() : setActive(cancelActiveLogistics(item.id))
      return <section className={`lobby-logistics-showcase${remain === 0 ? ' completed' : ''}`} key={item.id}>
        <button className={`lobby-logistics-emblem${generatedIcon ? ' generated' : ''}`} title={remain === 0 ? '前往領取' : `取消${job?.name ?? '後勤'}`} aria-label={remain === 0 ? '前往領取' : `取消${job?.name ?? '後勤'}`} onClick={openOrCancel} style={{ '--job-index': jobIndex, backgroundPosition: `${jobIndex * 25}% center` } as React.CSSProperties}>{generatedIcon && <img src={generatedIcon} alt="" />}</button>
        <div className="lobby-logistics-title"><b>{job?.name ?? '後勤工作'}</b><span>{remain === 0 ? '完成 · 可領取' : `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}</span></div>
        <div className="lobby-logistics-workers">{characters.map((character, index) => { const image = getUrlByKey(`cb_extra_b_img_${character.id}`) ?? getUrlByKey(`cb_extra_a_img_${character.id}`) ?? getUrlByKey(`cb_img_${character.id}`); return <div key={character.id} style={{ '--worker-index': index } as React.CSSProperties}>{image ? <img src={image} alt="" /> : <b>{character.name[0]}</b>}<span>{character.name}</span></div> })}</div>
      </section>
    })}</div>
  </>
}
