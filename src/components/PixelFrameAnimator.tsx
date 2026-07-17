import { useEffect, useMemo, useRef, useState } from 'react'
import { getUrlByKey, removeByKey, uploadByKey } from '../utils/charStore'
import './PixelFrameAnimator.css'

type Action = 'idle' | 'walk' | 'mining'
const ACTIONS: { id: Action; label: string; hint: string }[] = [
  { id: 'idle', label: '待機', hint: '建議 4～6 格，動作細微並可循環' },
  { id: 'walk', label: '走路', hint: '建議 6～8 格，第一格與最後一格要能銜接' },
  { id: 'mining', label: '挖礦', hint: '建議 6～8 格：蓄力、落鎬、命中、回復' },
]
const MAX_FRAMES = 8

const readOrder = (charId: string, action: Action) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(`cb_pixel_frames_order_${charId}_${action}`) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(value => Number.isInteger(value) && value >= 0 && value < MAX_FRAMES) as number[] : []
  } catch { return [] }
}

export default function PixelFrameAnimator({ charId, fallback }: { charId: string; fallback: string }) {
  const [action, setAction] = useState<Action>('idle')
  const [fps, setFps] = useState(() => Number(localStorage.getItem(`cb_pixel_frames_fps_${charId}_idle`)) || 6)
  const [order, setOrder] = useState<number[]>(() => readOrder(charId, 'idle'))
  const [frame, setFrame] = useState(0)
  const [busy, setBusy] = useState(false)
  const dragged = useRef<number | null>(null)
  const key = (slot: number) => `cb_pixel_anim_${charId}_${action}_${slot}`
  const available = useMemo(() => {
    const existing = Array.from({ length: MAX_FRAMES }, (_, slot) => slot).filter(slot => !!getUrlByKey(key(slot)))
    return [...order.filter(slot => existing.includes(slot)), ...existing.filter(slot => !order.includes(slot))]
  // getUrlByKey reads the current manifest/local storage after uploads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, charId, order, busy])
  const urls = available.map(slot => getUrlByKey(key(slot))).filter((url): url is string => !!url)

  useEffect(() => {
    const next = readOrder(charId, action)
    setOrder(next); setFrame(0)
    setFps(Number(localStorage.getItem(`cb_pixel_frames_fps_${charId}_${action}`)) || (action === 'idle' ? 5 : 8))
  }, [action, charId])
  useEffect(() => {
    if (urls.length < 2) return
    const timer = window.setInterval(() => setFrame(value => (value + 1) % urls.length), 1000 / fps)
    return () => window.clearInterval(timer)
  }, [fps, urls.length])

  const saveOrder = (next: number[]) => { setOrder(next); localStorage.setItem(`cb_pixel_frames_order_${charId}_${action}`, JSON.stringify(next)) }
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])].slice(0, MAX_FRAMES)
    if (!files.length) return
    setBusy(true)
    try {
      const slots = Array.from({ length: MAX_FRAMES }, (_, index) => index)
      for (let index = 0; index < files.length; index++) {
        const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(files[index]) })
        await uploadByKey(key(slots[index]), dataUrl)
      }
      for (let index = files.length; index < MAX_FRAMES; index++) {
        if (getUrlByKey(key(slots[index]))) removeByKey(key(slots[index]))
      }
      saveOrder(slots.slice(0, files.length))
      setFrame(0)
    } finally { setBusy(false); event.target.value = '' }
  }
  const remove = (slot: number) => { removeByKey(key(slot)); saveOrder(available.filter(value => value !== slot)); setFrame(0) }
  const drop = (target: number) => { const source = dragged.current; if (source === null || source === target) return; const next = [...available]; next.splice(next.indexOf(source), 1); next.splice(next.indexOf(target), 0, source); saveOrder(next); dragged.current = null }

  return <div className="pixel-frame-animator">
    <div className="pixel-frame-actions">{ACTIONS.map(item => <button key={item.id} className={action === item.id ? 'active' : ''} onClick={() => setAction(item.id)}>{item.label}</button>)}</div>
    <div className="pixel-frame-main">
      <div className="pixel-frame-preview">{urls[frame] || fallback ? <img src={urls[frame] ?? fallback} alt={`${action} preview`} /> : <span>尚未上傳角色圖片</span>}<b>{urls.length ? `${frame + 1} / ${urls.length}` : '原圖預覽'}</b></div>
      <div className="pixel-frame-settings">
        <h4>{ACTIONS.find(item => item.id === action)?.label}逐格動畫</h4>
        <p>{ACTIONS.find(item => item.id === action)?.hint}</p>
        <label>播放速度 <strong>{fps} FPS</strong><input type="range" min="2" max="16" value={fps} onChange={event => { const value = Number(event.target.value); setFps(value); localStorage.setItem(`cb_pixel_frames_fps_${charId}_${action}`, String(value)) }} /></label>
        <label className="pixel-frame-upload">{busy ? '上傳中…' : `一次選取 1～${MAX_FRAMES} 張 PNG`}<input type="file" accept="image/png,image/webp" multiple hidden disabled={busy} onChange={upload} /></label>
        <small>圖片請使用相同畫布尺寸與透明背景；依檔名順序上傳。</small>
      </div>
    </div>
    <div className="pixel-frame-strip">{available.map((slot, index) => <div key={slot} draggable onDragStart={() => { dragged.current = slot }} onDragOver={event => event.preventDefault()} onDrop={() => drop(slot)}><img src={getUrlByKey(key(slot)) ?? ''} alt={`影格 ${index + 1}`} /><span>{index + 1}</span><button onClick={() => remove(slot)} aria-label={`刪除影格 ${index + 1}`}>×</button></div>)}</div>
  </div>
}
