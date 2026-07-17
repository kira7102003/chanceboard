import { useEffect, useState } from 'react'
import { getChars, getUrlByKey, removeByKey, uploadByKey } from '../utils/charStore'
import { supabase } from '../utils/supabase'
import './PixelSpriteSheet.css'
import './PixelSpriteSheetAI.css'

export type PixelSheetPose = 'front' | 'side' | 'back'
export type PixelSheetAction = 'idle' | 'walk' | 'mining'
const POSES: { id: PixelSheetPose; label: string }[] = [{ id:'front',label:'正面' },{ id:'side',label:'側面' },{ id:'back',label:'背面' }]
const ACTIONS: { id: PixelSheetAction; label: string }[] = [{ id:'idle',label:'待機' },{ id:'walk',label:'走路' },{ id:'mining',label:'挖礦' }]
export const spriteSheetKey = (charId: string, pose: PixelSheetPose, action: PixelSheetAction) => `cb_pixel_sheet_${charId}_${pose}_${action}`

export default function PixelSpriteSheetEditor({ charId }: { charId: string }) {
  const [pose,setPose] = useState<PixelSheetPose>('side')
  const [action,setAction] = useState<PixelSheetAction>('idle')
  const [busy,setBusy] = useState(false), [generating,setGenerating] = useState(false)
  const [generated,setGenerated] = useState(''), [error,setError] = useState(''), [detail,setDetail] = useState('')
  const [version,setVersion] = useState(0)
  const fpsKey = `cb_pixel_sheet_fps_${charId}_${action}`
  const [fps,setFps] = useState(() => Number(localStorage.getItem(fpsKey)) || 6)
  const storageKey = spriteSheetKey(charId,pose,action)
  const image = getUrlByKey(storageKey), shown = generated || image

  useEffect(() => setFps(Number(localStorage.getItem(`cb_pixel_sheet_fps_${charId}_${action}`)) || 6), [charId,action])
  const clearPreview = () => { setGenerated(''); setError('') }
  const upload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file=event.target.files?.[0]; if(!file)return
    const reader=new FileReader(); setBusy(true)
    reader.onload=async()=>{try{await uploadByKey(storageKey,String(reader.result));setVersion(value=>value+1)}finally{setBusy(false);event.target.value=''}}
    reader.readAsDataURL(file)
  }
  const generate = async () => {
    setGenerating(true); clearPreview()
    try {
      const { data } = await supabase.auth.getSession(); const token=data.session?.access_token
      if(!token) throw new Error('請先登入')
      const poseKey=pose==='front'?'a':pose==='side'?'b':'c'
      const referenceImage=getUrlByKey(`cb_extra_${poseKey}_img_${charId}`)??getUrlByKey(`cb_extra_a_img_${charId}`)??getUrlByKey(`cb_img_${charId}`)
      if(!referenceImage) throw new Error('請先上傳角色 8-bit 參考圖片')
      const characterName=getChars().find(character=>character.id===charId)?.name??'角色'
      const response=await fetch('/.netlify/functions/generate-pixel-sprite-sheet',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({pose,action,characterName,detail,referenceImage})})
      const result=await response.json(); if(!response.ok)throw new Error(result.error??'生成失敗')
      setGenerated(result.dataUrl)
    } catch(reason) { setError(reason instanceof Error?reason.message:'生成失敗') }
    finally { setGenerating(false) }
  }
  const saveGenerated = async () => {
    setBusy(true)
    try { await uploadByKey(storageKey,generated); setGenerated(''); setVersion(value=>value+1) }
    finally { setBusy(false) }
  }
  return <div className="pixel-sheet-editor" data-version={version}>
    <div className="pixel-sheet-tabs">
      <div>{POSES.map(item=><button key={item.id} className={pose===item.id?'active':''} onClick={()=>{setPose(item.id);clearPreview()}}>{item.label}</button>)}</div>
      <div>{ACTIONS.map(item=><button key={item.id} className={action===item.id?'active':''} onClick={()=>{setAction(item.id);clearPreview()}}>{item.label}</button>)}</div>
    </div>
    <div className="pixel-sheet-content">
      <div className="pixel-sheet-preview">{shown?<div className="pixel-sheet-sprite" style={{backgroundImage:`url(${shown})`,'--sheet-duration':`${4/fps}s`} as React.CSSProperties}/>:<span>尚未上傳這個方向與動作</span>}<b>{generated?'AI 預覽':'2 × 2／4 格'}</b></div>
      <div className="pixel-sheet-controls">
        <h4>{POSES.find(item=>item.id===pose)?.label}・{ACTIONS.find(item=>item.id===action)?.label}</h4>
        <p>自行上傳 2×2 圖片，或由 AI 依目前角色圖生成。</p>
        <label>播放速度 <strong>{fps} FPS</strong><input type="range" min="2" max="12" value={fps} onChange={event=>{const value=Number(event.target.value);setFps(value);localStorage.setItem(fpsKey,String(value))}}/></label>
        <textarea value={detail} maxLength={300} onChange={event=>setDetail(event.target.value)} placeholder="AI 補充要求（選填），例如：步伐小一點、帽子不要變形"/>
        <button className="pixel-sheet-generate" disabled={generating} onClick={generate}>{generating?'AI 生成中，請稍候…':'✨ AI 生成目前動畫'}</button>
        {error&&<em className="pixel-sheet-error">{error}</em>}
        {generated&&<button className="pixel-sheet-save" disabled={busy} onClick={saveGenerated}>確認並儲存 AI 圖片</button>}
        <label className="pixel-sheet-upload">{busy?'上傳中…':'自行上傳 2×2 Sprite Sheet'}<input type="file" accept="image/png,image/webp" hidden disabled={busy} onChange={upload}/></label>
        {image&&!generated&&<button className="pixel-sheet-remove" onClick={()=>{removeByKey(storageKey);setVersion(value=>value+1)}}>移除這張動畫</button>}
        <small>AI 生成會使用 OpenAI API 額度；確認後才會覆蓋目前圖片。</small>
      </div>
    </div>
  </div>
}
