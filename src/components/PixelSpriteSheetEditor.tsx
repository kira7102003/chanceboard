import { useEffect, useState } from 'react'
import { getUrlByKey, removeByKey, uploadByKey } from '../utils/charStore'
import './PixelSpriteSheet.css'

export type PixelSheetPose = 'front' | 'side' | 'back'
export type PixelSheetAction = 'idle' | 'walk' | 'mining'
const poses: { id: PixelSheetPose; label: string }[] = [{ id:'front',label:'正面' },{ id:'side',label:'側面' },{ id:'back',label:'背面' }]
const actions: { id: PixelSheetAction; label: string }[] = [{ id:'idle',label:'待機' },{ id:'walk',label:'走路' },{ id:'mining',label:'挖礦' }]
export const spriteSheetKey = (charId: string, pose: PixelSheetPose, action: PixelSheetAction) => `cb_pixel_sheet_${charId}_${pose}_${action}`

export default function PixelSpriteSheetEditor({ charId }: { charId: string }) {
  const [pose,setPose]=useState<PixelSheetPose>('side'); const [action,setAction]=useState<PixelSheetAction>('idle'); const [busy,setBusy]=useState(false); const [version,setVersion]=useState(0)
  const fpsKey=`cb_pixel_sheet_fps_${charId}_${action}`; const [fps,setFps]=useState(()=>Number(localStorage.getItem(fpsKey))||6)
  const storageKey=spriteSheetKey(charId,pose,action); const image=getUrlByKey(storageKey)
  useEffect(()=>setFps(Number(localStorage.getItem(`cb_pixel_sheet_fps_${charId}_${action}`))||6),[charId,action])
  const upload=(event:React.ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();setBusy(true);reader.onload=async()=>{try{await uploadByKey(storageKey,String(reader.result));setVersion(value=>value+1)}finally{setBusy(false);event.target.value=''}};reader.readAsDataURL(file)}
  return <div className="pixel-sheet-editor" data-version={version}><div className="pixel-sheet-tabs"><div>{poses.map(item=><button key={item.id} className={pose===item.id?'active':''} onClick={()=>setPose(item.id)}>{item.label}</button>)}</div><div>{actions.map(item=><button key={item.id} className={action===item.id?'active':''} onClick={()=>setAction(item.id)}>{item.label}</button>)}</div></div><div className="pixel-sheet-content"><div className="pixel-sheet-preview">{image?<div className="pixel-sheet-sprite" style={{backgroundImage:`url(${image})`,'--sheet-duration':`${4/fps}s`} as React.CSSProperties}/>:<span>尚未上傳這個方向與動作</span>}<b>2 × 2／4 格</b></div><div className="pixel-sheet-controls"><h4>{poses.find(item=>item.id===pose)?.label}・{actions.find(item=>item.id===action)?.label}</h4><p>上傳一張 2×2 排列圖，依左上、右上、左下、右下播放。</p><label>播放速度 <strong>{fps} FPS</strong><input type="range" min="2" max="12" value={fps} onChange={event=>{const value=Number(event.target.value);setFps(value);localStorage.setItem(fpsKey,String(value))}}/></label><label className="pixel-sheet-upload">{busy?'上傳中…':'上傳 2×2 Sprite Sheet'}<input type="file" accept="image/png,image/webp" hidden disabled={busy} onChange={upload}/></label>{image&&<button className="pixel-sheet-remove" onClick={()=>{removeByKey(storageKey);setVersion(value=>value+1)}}>移除這張動畫</button>}<small>四格需相同大小、腳底對齊，而且背景必須真正透明。</small></div></div></div>
}
