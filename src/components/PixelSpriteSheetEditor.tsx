import {useEffect,useState} from 'react'
import {getUrlByKey,removeByKey,uploadByKey} from '../utils/charStore'
import {autoCalibrateSpriteSheet} from '../utils/autoCalibrateSprite'
import {removePixelBackground} from '../utils/removePixelBackground'
import PixelSpritePlayer,{DEFAULT_ADJUST,loadSpriteAdjust,spriteAdjustKey,type FrameAdjust} from './PixelSpritePlayer'
import './PixelSpriteSheet.css';import './PixelSpriteSheetUpload.css';import './PixelSpriteCalibrate.css';import './PixelPreviewToggle.css'
export type PixelSheetPose='front'|'side'|'back';export type PixelSheetAction='idle'|'walk'|'mining'
const POSES:{id:PixelSheetPose;label:string}[]=[{id:'front',label:'正面'},{id:'side',label:'側面'},{id:'back',label:'背面'}],ACTIONS:{id:PixelSheetAction;label:string}[]=[{id:'idle',label:'待機'},{id:'walk',label:'走路'},{id:'mining',label:'挖礦'}]
export const spriteSheetKey=(charId:string,pose:PixelSheetPose,action:PixelSheetAction)=>`cb_pixel_sheet_${charId}_${pose}_${action}`
const inspect=(url:string)=>new Promise<{width:number;height:number}>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve({width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>reject(new Error('無法讀取圖片'));image.src=url})

export default function PixelSpriteSheetEditor({charId}:{charId:string}){
  const[pose,setPose]=useState<PixelSheetPose>('side'),[action,setAction]=useState<PixelSheetAction>('idle'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[version,setVersion]=useState(0),[selected,setSelected]=useState(0),[playing,setPlaying]=useState(false),[overlay,setOverlay]=useState(true),[adjustments,setAdjustments]=useState<FrameAdjust[]>(()=>loadSpriteAdjust(charId,'side','idle'))
  const fpsKey=`cb_pixel_sheet_fps_${charId}_${action}`,[fps,setFps]=useState(()=>Number(localStorage.getItem(fpsKey))||4),storageKey=spriteSheetKey(charId,pose,action),image=getUrlByKey(storageKey)
  useEffect(()=>setFps(Number(localStorage.getItem(`cb_pixel_sheet_fps_${charId}_${action}`))||4),[charId,action])
  useEffect(()=>{setAdjustments(loadSpriteAdjust(charId,pose,action));setSelected(0)},[charId,pose,action])
  const saveAdjustments=(next:FrameAdjust[])=>{setAdjustments(next);localStorage.setItem(spriteAdjustKey(charId,pose,action),JSON.stringify(next))}
  const adjust=(patch:Partial<FrameAdjust>)=>saveAdjustments(adjustments.map((item,index)=>index===selected?{...item,...patch}:item))
  const finishBackgroundRemoval=async(source:string,backup=false)=>{if(backup)await uploadByKey(`${storageKey}_original`,source);const transparent=await removePixelBackground(source);await uploadByKey(storageKey,transparent);localStorage.setItem(`cb_pixel_bg_removed_${storageKey}`,'1');saveAdjustments(await autoCalibrateSpriteSheet(transparent));setPlaying(false);setOverlay(true);setVersion(value=>value+1)}
  useEffect(()=>{if(!image)return;const flag=`cb_pixel_bg_removed_${storageKey}`;if(localStorage.getItem(flag))return;let active=true;(async()=>{setBusy(true);try{await finishBackgroundRemoval(image)}catch(reason){if(active)setError(reason instanceof Error?`既有動畫去背失敗：${reason.message}`:'既有動畫去背失敗')}finally{if(active)setBusy(false)}})();return()=>{active=false}},[image,storageKey])
  const upload=(event:React.ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];if(!file)return;setError('');if(file.size>8*1024*1024){setError('圖片超過 8 MB');event.target.value='';return}const reader=new FileReader();setBusy(true);reader.onload=async()=>{try{const url=String(reader.result),size=await inspect(url);if(size.width!==size.height)throw new Error(`圖片必須是正方形，目前為 ${size.width}×${size.height}`);if(size.width%2)throw new Error('圖片寬高必須是偶數');await finishBackgroundRemoval(url,true)}catch(reason){setError(reason instanceof Error?reason.message:'上傳失敗')}finally{setBusy(false);event.target.value=''}};reader.readAsDataURL(file)}
  const removeCurrentBackground=async()=>{if(!image)return;setBusy(true);setError('');try{await finishBackgroundRemoval(image)}catch(reason){setError(reason instanceof Error?reason.message:'自動去背失敗')}finally{setBusy(false)}}
  return <div className="pixel-sheet-editor" data-version={version}>
    <div className="pixel-sheet-tabs"><div>{POSES.map(item=><button key={item.id} className={pose===item.id?'active':''} onClick={()=>setPose(item.id)}>{item.label}</button>)}</div><div>{ACTIONS.map(item=><button key={item.id} className={action===item.id?'active':''} onClick={()=>setAction(item.id)}>{item.label}</button>)}</div></div>
    <div className="pixel-sheet-content">
      <div><div className="pixel-preview-buttons"><button type="button" className={`pixel-preview-toggle${playing?' active':''}`} onClick={()=>setPlaying(value=>!value)}>{playing?'■ 停止預覽':'▶ 播放預覽'}</button><button type="button" className={`pixel-preview-toggle${overlay&&!playing?' active':''}`} disabled={playing} onClick={()=>setOverlay(value=>!value)}>▣ 疊圖校正</button><button type="button" className="pixel-preview-toggle remove-bg" disabled={!image||busy} onClick={removeCurrentBackground}>{busy?'處理中…':'✦ 自動去背'}</button></div>
        <div className="pixel-sheet-preview calibrated">{image?<PixelSpritePlayer src={image} fps={fps} adjustments={adjustments} playing={playing} selectedFrame={selected} overlay={overlay}/>:<span>尚未上傳圖片</span>}<i className="pixel-guide-v"/><i className="pixel-guide-h"/><b>{playing?'動畫預覽':overlay?'四格疊圖校正':`第 ${selected+1} 格定位`}</b></div>
        <div className="pixel-frame-picker">{[0,1,2,3].map(index=><button key={index} className={selected===index?'active':''} onClick={()=>setSelected(index)}>第 {index+1} 格</button>)}</div>
      </div>
      <div className="pixel-sheet-controls"><h4>{POSES.find(item=>item.id===pose)?.label}・{ACTIONS.find(item=>item.id===action)?.label}</h4><p>四格疊圖可直接看出中心或腳底偏移；數值可精準輸入至 0.1%。</p>
        {([['水平 X','x',-30,30,0],['垂直 Y','y',-30,30,0],['縮放','scale',70,150,90]] as const).map(([label,key,min,max,fallback])=><label key={key}>{label} <strong>{adjustments[selected]?.[key]??fallback}%</strong><div className="pixel-precise-control"><input type="range" min={min} max={max} step="0.1" value={adjustments[selected]?.[key]??fallback} onChange={event=>adjust({[key]:Number(event.target.value)})}/><input type="number" min={min} max={max} step="0.1" value={adjustments[selected]?.[key]??fallback} onChange={event=>adjust({[key]:Number(event.target.value)})}/></div></label>)}
        <button className="pixel-adjust-reset" onClick={()=>adjust(DEFAULT_ADJUST)}>重設目前影格（90%）</button><label>速度 <strong>{fps} FPS</strong><input type="range" min="2" max="12" value={fps} onChange={event=>{const value=Number(event.target.value);setFps(value);localStorage.setItem(fpsKey,String(value))}}/></label>
        <label className="pixel-sheet-upload">{busy?'上傳中…':'上傳 PNG／WebP'}<input type="file" accept="image/png,image/webp" hidden disabled={busy} onChange={upload}/></label>{error&&<em className="pixel-sheet-upload-error">{error}</em>}{image&&<button className="pixel-sheet-remove" onClick={()=>{removeByKey(storageKey);setVersion(value=>value+1)}}>移除動畫</button>}<small>新影格預設縮放為 90%，校正值會自動儲存並套用到遊戲。</small>
      </div>
    </div>
  </div>
}
