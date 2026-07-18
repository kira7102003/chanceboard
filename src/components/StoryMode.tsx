import {useMemo,useState} from 'react'
import './StoryMode.css'
import {getChapterFlow,getStoryChapters,type StoryChapter,type StoryFlowNode} from '../utils/storyStore'
import {getUrlByKey} from '../utils/charStore'
import StoryPlayer from './StoryPlayer'
import PixelCharacterActor from './PixelCharacterActor'
import {usePlayerStore} from '../store/playerStore'

interface Props{onClose:()=>void;onComplete?:(chapter:StoryChapter)=>void;onBattle?:()=>void}

export default function StoryMode({onClose,onComplete,onBattle}:Props){
 const chapters=useMemo(getStoryChapters,[])
 const resume=useMemo(()=>{try{const raw=localStorage.getItem('cb_story_resume');if(!raw)return null;localStorage.removeItem('cb_story_resume');return JSON.parse(raw) as {chapterId:string;cursor:number;nodes:StoryFlowNode[]}}catch{return null}},[])
 const[chapter,setChapter]=useState<StoryChapter|null>(()=>resume?chapters.find(item=>item.id===resume.chapterId)??null:null),[nodes,setNodes]=useState<StoryFlowNode[]>(()=>resume?resume.nodes.slice(resume.cursor):[])
 const[selectedId,setSelectedId]=useState(()=>chapters.find(item=>item.unlocked)?.id??chapters[0]?.id)
 const player=usePlayerStore()
 const leaveChapter=()=>{setChapter(null);setNodes([])}
 if(chapter)return <StoryPlayer chapter={chapter} initialNodes={nodes} onLeave={leaveChapter} onComplete={onComplete} onBattle={onBattle}/>
 const selected=chapters.find(item=>item.id===selectedId)??chapters[0]
 const mapPoints=chapters.map((item,index)=>({x:item.mapX??[9.5,28.5,45.5,62.5,80.5,93][index],y:item.mapY??[68,41,64,33,57,23][index]})),routePoints=chapters[0]?.mapRoutePoints?.length?chapters[0].mapRoutePoints:mapPoints,selectedIndex=Math.max(0,chapters.findIndex(item=>item.id===selectedId)),actorId=player.desktopCharIds?.[0]??player.ownedCharIds[0]
 const enter=(item:StoryChapter)=>{if(!item.unlocked)return;setChapter(item);setNodes(getChapterFlow(item))}
 return <div className="panel-overlay story-map-screen">
  <div className="panel-header"><button className="panel-back" onClick={onClose}>返回大廳</button><span className="panel-title">故事模式</span><span className="panel-meta">命運棋盤</span></div>
  <div className="story-world-map">
   <header><small>CHANCEBOARD CHRONICLE</small><h1>六棋之境</h1><p>沿著命運棋路前進，每一幅地圖都是一段尚未落子的故事。</p></header>
   <div className="story-map-route">
    <div className="story-map-land" aria-hidden="true"/>
    <div className={`story-region-highlight region-${selectedIndex+1}`}/>
    <svg className="story-route-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline className="route-shadow" points={routePoints.map(point=>`${point.x},${point.y}`).join(' ')}/><polyline className="route-main" points={routePoints.map(point=>`${point.x},${point.y}`).join(' ')}/></svg>
    {actorId&&selected?.unlocked&&<div className="story-map-actor" style={{left:`${mapPoints[selectedIndex].x}%`,top:`${mapPoints[selectedIndex].y}%`}}><PixelCharacterActor charId={actorId} pose="side" action="walk" face="right"/></div>}
    {chapters.map((item,index)=> <button key={item.id} aria-disabled={!item.unlocked} style={{'--node-x':`${mapPoints[index].x}%`,'--node-y':`${mapPoints[index].y}%`} as React.CSSProperties} className={`story-map-node ${item.unlocked?'unlocked':'locked'} ${selectedId===item.id?'selected':''} node-${index+1}`} onClick={()=>setSelectedId(item.id)} onDoubleClick={()=>enter(item)}>
      <i>{item.piece}</i><span><em>第 {item.order} 章</em><b>{item.title}</b></span><small>{item.unlocked?'◆':'🔒'}</small>
     </button>)}
   </div>
   {selected&&<aside className={`story-map-detail ${selected.unlocked?'':'locked'}`} style={{backgroundImage:`linear-gradient(90deg,#080a18f5,#080a18aa),url(${getUrlByKey(`cb_story_map_${selected.id}`)??''})`}}><div><small>CHAPTER {selected.order} · {selected.piece}</small><h2>{selected.title}</h2><p>{selected.subtitle}</p></div><button disabled={!selected.unlocked} onClick={()=>enter(selected)}>{selected.unlocked?'進入章節 →':'🔒 尚未解鎖'}</button></aside>}
  </div>
 </div>
}
