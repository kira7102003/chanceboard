import type React from 'react'
import './PixelSpritePlayer.css'
export type FrameAdjust={x:number;y:number;scale:number}
export const DEFAULT_ADJUST:FrameAdjust={x:0,y:0,scale:90}
export const spriteAdjustKey=(charId:string,pose:string,action:string)=>`cb_pixel_adjust_${charId}_${pose}_${action}`
export const loadSpriteAdjust=(charId:string,pose:string,action:string):FrameAdjust[]=>{try{const value=JSON.parse(localStorage.getItem(spriteAdjustKey(charId,pose,action))??'[]');return Array.from({length:4},(_,index)=>({...DEFAULT_ADJUST,...value[index]}))}catch{return Array.from({length:4},()=>({...DEFAULT_ADJUST}))}}
const positions=['0 0','100% 0','0 100%','100% 100%']
export default function PixelSpritePlayer({src,fps,adjustments,playing=true,selectedFrame=0,overlay=false}:{src:string;fps:number;adjustments:FrameAdjust[];playing?:boolean;selectedFrame?:number;overlay?:boolean}){
  const frame=Math.max(0,Math.min(3,selectedFrame))
  if(!playing){return <div className={`pixel-sprite-player${overlay?' pixel-sprite-overlay':''}`}>{(overlay?positions:[positions[frame]]).map((position,listIndex)=>{const index=overlay?listIndex:frame,item=adjustments[index]??DEFAULT_ADJUST;return <div key={position} className="pixel-sprite-layer pixel-sprite-static" style={{backgroundImage:`url(${src})`,backgroundPosition:position,transform:`translate(${item.x}%,${item.y}%) scale(${item.scale/100})`,opacity:overlay?(index===frame?.68:.2):1}}/>})}</div>}
  return <div className="pixel-sprite-player">{positions.map((position,index)=>{const item=adjustments[index]??DEFAULT_ADJUST;return <div key={position} className="pixel-sprite-layer" style={{backgroundImage:`url(${src})`,backgroundPosition:position,transform:`translate(${item.x}%,${item.y}%) scale(${item.scale/100})`,'--sprite-duration':`${4/fps}s`,animationDelay:`${index/fps}s`} as React.CSSProperties}/>})}</div>
}
