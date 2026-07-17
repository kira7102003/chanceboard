import { useEffect, useMemo, useRef, useState } from 'react'
import './PixelSkeletonEditor.css'
import './PixelSkeletonMotion.css'
import PixelFrameAnimator from './PixelFrameAnimator'
import { getUrlByKey } from '../utils/charStore'

type Pose = 'a' | 'b' | 'c'
type Action = 'idle' | 'walk' | 'mining'
type Part = { id: string; label: string; x: number; y: number; w: number; h: number; px: number; py: number }
type Drag = { id: string; mode: 'move' | 'resize' | 'pivot'; sx: number; sy: number; part: Part } | null

const PARTS: Part[] = [
  { id:'head',label:'頭',x:35,y:3,w:30,h:18,px:50,py:88 }, { id:'body',label:'身體',x:30,y:20,w:40,h:31,px:50,py:10 },
  { id:'arm-l',label:'左上臂',x:17,y:21,w:18,h:25,px:88,py:10 }, { id:'forearm-l',label:'左前臂',x:10,y:40,w:18,h:24,px:70,py:8 },
  { id:'arm-r',label:'右上臂',x:65,y:21,w:18,h:25,px:12,py:10 }, { id:'forearm-r',label:'右前臂',x:72,y:40,w:18,h:24,px:30,py:8 },
  { id:'thigh-l',label:'左大腿',x:30,y:48,w:20,h:26,px:55,py:8 }, { id:'shin-l',label:'左小腿',x:28,y:70,w:20,h:27,px:55,py:8 },
  { id:'thigh-r',label:'右大腿',x:50,y:48,w:20,h:26,px:45,py:8 }, { id:'shin-r',label:'右小腿',x:52,y:70,w:20,h:27,px:45,py:8 },
]

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const loadParts = (key: string) => { try { const value = JSON.parse(localStorage.getItem(key) ?? 'null'); return Array.isArray(value) ? value as Part[] : PARTS } catch { return PARTS } }

export default function PixelSkeletonEditor({ charId }: { charId: string }) {
  const [mode, setMode] = useState<'motion' | 'frames' | 'skeleton'>('motion')
  const [pose, setPose] = useState<Pose>('b'); const [action, setAction] = useState<Action>('idle')
  const storageKey = `cb_pixel_skeleton_${charId}_${pose}`
  const [parts, setParts] = useState<Part[]>(() => loadParts(storageKey)); const [selected, setSelected] = useState('head'); const [saved, setSaved] = useState(false)
  const drag = useRef<Drag>(null); const stage = useRef<HTMLDivElement>(null)
  const image = getUrlByKey(`cb_extra_${pose}_img_${charId}`) ?? getUrlByKey(`cb_img_${charId}`) ?? ''
  useEffect(() => { setParts(loadParts(storageKey)); setSelected('head'); setSaved(false) }, [storageKey])
  useEffect(() => {
    const move = (event: PointerEvent) => { const current = drag.current; const rect = stage.current?.getBoundingClientRect(); if (!current || !rect) return; const dx = (event.clientX-current.sx)/rect.width*100; const dy=(event.clientY-current.sy)/rect.height*100; setParts(items => items.map(item => { if(item.id!==current.id)return item; const p=current.part; if(current.mode==='move')return {...p,x:clamp(p.x+dx,0,100-p.w),y:clamp(p.y+dy,0,100-p.h)}; if(current.mode==='resize')return {...p,w:clamp(p.w+dx,4,100-p.x),h:clamp(p.h+dy,4,100-p.y)}; return {...p,px:clamp(p.px+dx/p.w*100,0,100),py:clamp(p.py+dy/p.h*100,0,100)} })); setSaved(false) }
    const up=()=>{drag.current=null}; window.addEventListener('pointermove',move); window.addEventListener('pointerup',up); return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)}
  },[])
  const begin=(event:React.PointerEvent,id:string,mode:NonNullable<Drag>['mode'])=>{event.preventDefault();event.stopPropagation();const part=parts.find(item=>item.id===id);if(part){setSelected(id);drag.current={id,mode,sx:event.clientX,sy:event.clientY,part}}}
  const selectedPart=parts.find(item=>item.id===selected)
  const previewParts=useMemo(()=>parts.map(part=>({part,origin:`${part.px}% ${part.py}%`})),[parts])
  return <div className="pixel-skeleton-editor">
    <div className="pixel-animation-mode"><button className={mode==='motion'?'active':''} onClick={()=>setMode('motion')}>整張微動（建議）</button><button className={mode==='frames'?'active':''} onClick={()=>setMode('frames')}>逐格動畫</button><button className={mode==='skeleton'?'active':''} onClick={()=>setMode('skeleton')}>拆件骨架</button></div>
    {mode==='motion'?<div className="pixel-whole-motion"><div className="pixel-frame-actions">{(['idle','walk','mining'] as Action[]).map(value=><button key={value} className={action===value?'active':''} onClick={()=>setAction(value)}>{value==='idle'?'待機':value==='walk'?'走路':'挖礦'}</button>)}</div><div className={`pixel-whole-preview whole-${action}`}>{image?<img src={image} alt="整張角色微動預覽"/>:<span>尚未上傳角色圖片</span>}{action==='mining'&&<><b>⛏</b><i/></>}</div><small>整張圖片保持完整，只做小幅位移與傾斜，因此不會出現關節裂縫。</small></div>:mode==='frames'?<PixelFrameAnimator charId={charId} fallback={image}/>:<>
    <div className="pixel-skeleton-tools"><div>{(['a','b','c'] as Pose[]).map(value=><button className={pose===value?'active':''} key={value} onClick={()=>setPose(value)}>{value.toUpperCase()} {value==='a'?'正面':value==='b'?'側面':'背面'}</button>)}</div><div><select value={action} onChange={event=>setAction(event.target.value as Action)}><option value="idle">待機</option><option value="walk">走路</option><option value="mining">挖礦</option></select><button onClick={()=>{localStorage.setItem(storageKey,JSON.stringify(parts));setSaved(true)}}>{saved?'✓ 已儲存':'儲存骨架'}</button><button onClick={()=>{setParts(PARTS);setSaved(false)}}>重設</button></div></div>
    <div className="pixel-skeleton-workspace"><div className="pixel-skeleton-stage" ref={stage}>{image&&<img src={image} alt="" />}{parts.map(part=><div key={part.id} className={`pixel-bone-box ${selected===part.id?'selected':''}`} style={{left:`${part.x}%`,top:`${part.y}%`,width:`${part.w}%`,height:`${part.h}%`}} onPointerDown={event=>begin(event,part.id,'move')}><span>{part.label}</span><i className="pixel-bone-pivot" style={{left:`${part.px}%`,top:`${part.py}%`}} onPointerDown={event=>begin(event,part.id,'pivot')}/><i className="pixel-bone-resize" onPointerDown={event=>begin(event,part.id,'resize')}/></div>)}</div>
      <div className={`pixel-skeleton-preview preview-${action}`}>{previewParts.map(({part,origin})=><div key={part.id} className={`pixel-preview-part part-${part.id}`} style={{left:`${part.x}%`,top:`${part.y}%`,width:`${part.w}%`,height:`${part.h}%`,transformOrigin:origin}}><img src={image} alt="" style={{width:`${10000/part.w}%`,height:`${10000/part.h}%`,left:`${-part.x/part.w*100}%`,top:`${-part.y/part.h*100}%`}} /></div>)}{action==='mining'&&<><b className="skeleton-pickaxe">⛏</b><i className="skeleton-mining-rock"/><i className="skeleton-mining-impact"/></>}</div></div>
    <div className="pixel-skeleton-parts">{parts.map(part=><button key={part.id} className={selected===part.id?'active':''} onClick={()=>setSelected(part.id)}>{part.label}</button>)}</div>{selectedPart&&<small>目前：{selectedPart.label}。拖曳框移動，拖右下角縮放，拖黃點設定關節。</small>}
    </>}
  </div>
}
