import { useEffect, useState } from 'react'
import { getUrlByKey, removeByKey, uploadByKey } from '../utils/charStore'
import './PixelSpriteSheet.css'
import './PixelSpriteSheetUpload.css'

export type PixelSheetPose = 'front' | 'side' | 'back'
export type PixelSheetAction = 'idle' | 'walk' | 'mining'
const POSES: { id: PixelSheetPose; label: string }[] = [{ id:'front',label:'正面' },{ id:'side',label:'側面' },{ id:'back',label:'背面' }]
const ACTIONS: { id: PixelSheetAction; label: string }[] = [{ id:'idle',label:'待機' },{ id:'walk',label:'走路' },{ id:'mining',label:'挖礦' }]
export const spriteSheetKey = (charId: string, pose: PixelSheetPose, action: PixelSheetAction) => `cb_pixel_sheet_${charId}_${pose}_${action}`

const inspectImage = (dataUrl: string) => new Promise<{ width: number; height: number }>((resolve,reject) => {
  const image=new Image(); image.onload=()=>resolve({width:image.naturalWidth,height:image.naturalHeight}); image.onerror=()=>reject(new Error('無法讀取圖片')); image.src=dataUrl
})

export default function PixelSpriteSheetEditor({ charId }: { charId: string }) {
  const [pose,setPose]=useState<PixelSheetPose>('side'), [action,setAction]=useState<PixelSheetAction>('idle')
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [version,setVersion]=useState(0)
  const fpsKey=`cb_pixel_sheet_fps_${charId}_${action}`
  const [fps,setFps]=useState(()=>Number(localStorage.getItem(fpsKey))||6)
  const storageKey=spriteSheetKey(charId,pose,action), image=getUrlByKey(storageKey)
  useEffect(()=>setFps(Number(localStorage.getItem(`cb_pixel_sheet_fps_${charId}_${action}`))||6),[charId,action])
  const upload=(event:React.ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0]; if(!file)return
    setError(''); if(file.size>8*1024*1024){setError('圖片超過 8 MB');event.target.value='';return}
    const reader=new FileReader(); setBusy(true)
    reader.onload=async()=>{try{const dataUrl=String(reader.result);const size=await inspectImage(dataUrl);if(size.width!==size.height)throw new Error(`圖片必須是正方形，目前為 ${size.width}×${size.height}`);if(size.width%2||size.height%2)throw new Error('圖片寬高必須是偶數，才能平均切成 2×2');await uploadByKey(storageKey,dataUrl);setVersion(value=>value+1)}catch(reason){setError(reason instanceof Error?reason.message:'上傳失敗')}finally{setBusy(false);event.target.value=''}}
    reader.onerror=()=>{setError('無法讀取圖片');setBusy(false);event.target.value=''}; reader.readAsDataURL(file)
  }
  return <div className="pixel-sheet-editor" data-version={version}>
    <div className="pixel-sheet-tabs"><div>{POSES.map(item=><button key={item.id} className={pose===item.id?'active':''} onClick={()=>{setPose(item.id);setError('')}}>{item.label}</button>)}</div><div>{ACTIONS.map(item=><button key={item.id} className={action===item.id?'active':''} onClick={()=>{setAction(item.id);setError('')}}>{item.label}</button>)}</div></div>
    <div className="pixel-sheet-content"><div className="pixel-sheet-preview">{image?<div className="pixel-sheet-sprite" style={{backgroundImage:`url(${image})`,'--sheet-duration':`${4/fps}s`} as React.CSSProperties}/>:<span>尚未上傳這個方向與動作</span>}<b>2 × 2／4 格</b></div><div className="pixel-sheet-controls"><h4>{POSES.find(item=>item.id===pose)?.label}・{ACTIONS.find(item=>item.id===action)?.label}</h4><p>上傳一張正方形 2×2 圖片，依左上、右上、左下、右下播放。</p><label>播放速度 <strong>{fps} FPS</strong><input type="range" min="2" max="12" value={fps} onChange={event=>{const value=Number(event.target.value);setFps(value);localStorage.setItem(fpsKey,String(value))}}/></label><label className="pixel-sheet-upload">{busy?'上傳中…':'上傳 PNG／WebP Sprite Sheet'}<input type="file" accept="image/png,image/webp" hidden disabled={busy} onChange={upload}/></label>{error&&<em className="pixel-sheet-upload-error">{error}</em>}{image&&<button className="pixel-sheet-remove" onClick={()=>{removeByKey(storageKey);setVersion(value=>value+1)}}>移除這張動畫</button>}<small>最大 8 MB；四格必須同尺寸、角色腳底對齊，背景建議真正透明。</small></div></div>
  </div>
}
