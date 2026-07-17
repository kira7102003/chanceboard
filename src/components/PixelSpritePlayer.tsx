import type React from 'react'
import './PixelSpritePlayer.css'
export type FrameAdjust={x:number;y:number;scale:number}
export const DEFAULT_ADJUST:FrameAdjust={x:0,y:0,scale:100}
export const spriteAdjustKey=(charId:string,pose:string,action:string)=>`cb_pixel_adjust_${charId}_${pose}_${action}`
export const loadSpriteAdjust=(charId:string,pose:string,action:string):FrameAdjust[]=>{try{const value=JSON.parse(localStorage.getItem(spriteAdjustKey(charId,pose,action))??'[]');return Array.from({length:4},(_,index)=>({...DEFAULT_ADJUST,...value[index]}))}catch{return Array.from({length:4},()=>({...DEFAULT_ADJUST}))}}
const positions=['0 0','100% 0','0 100%','100% 100%']
export default function PixelSpritePlayer({src,fps,adjustments}:{src:string;fps:number;adjustments:FrameAdjust[]}){return <div className="pixel-sprite-player">{positions.map((position,index)=>{const item=adjustments[index]??DEFAULT_ADJUST;return <div key={position} className="pixel-sprite-layer" style={{backgroundImage:`url(${src})`,backgroundPosition:position,transform:`translate(${item.x}%,${item.y}%) scale(${item.scale/100})`,'--sprite-duration':`${4/fps}s`,animationDelay:`${index/fps}s`} as React.CSSProperties}/>})}</div>}
