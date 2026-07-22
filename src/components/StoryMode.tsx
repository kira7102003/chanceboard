import {useEffect,useMemo,useState} from 'react'
import './StoryMode.css'
import {getChapterFlow,getStoryChapters,unlockNextStoryChapter,type StoryChapter,type StoryFlowNode} from '../utils/storyStore'
import {getUrlByKey} from '../utils/charStore'
import StoryPlayer from './StoryPlayer'
import StoryRoutePicker from './StoryRoutePicker'
import PixelCharacterActor from './PixelCharacterActor'
import {usePlayerStore} from '../store/playerStore'

interface Props{onClose:()=>void;onComplete?:(chapter:StoryChapter)=>void;onBattle?:()=>void}

export default function StoryMode({onClose,onComplete,onBattle}:Props){
 const[chapters,setChapters]=useState(getStoryChapters)
 const[zoom,setZoom]=useState(()=>Math.max(1,Math.min(2.4,Number(localStorage.getItem('cb_story_map_zoom'))||1.2)))
 const[newUnlock,setNewUnlock]=useState<string|null>(()=>{const latest=chapters.findLast(item=>item.unlocked)?.id??null,seen=localStorage.getItem('cb_story_seen_unlock');return latest&&latest!==seen?latest:null})
 const resume=useMemo(()=>{try{const raw=localStorage.getItem('cb_story_resume');if(!raw)return null;localStorage.removeItem('cb_story_resume');return JSON.parse(raw) as {chapterId:string;cursor:number;nodes:StoryFlowNode[]}}catch{return null}},[])
 const[chapter,setChapter]=useState<StoryChapter|null>(()=>resume?chapters.find(item=>item.id===resume.chapterId)??null:null),[nodes,setNodes]=useState<StoryFlowNode[]>(()=>resume?resume.nodes.slice(resume.cursor):[])
 const entryChapter=chapters.find(item=>item.id==='pawn')??chapters[0]
 const entryPicker=getChapterFlow(entryChapter).find((node):node is Extract<StoryFlowNode,{type:'branch'}>=>node.type==='branch'&&!!node.chapterRouteSelect)
 const[showEntryPicker,setShowEntryPicker]=useState(()=>!resume&&!!entryPicker)
 const[routeChoice,setRouteChoice]=useState<{id:string;label:string}|undefined>()
 const[mapReadyAt,setMapReadyAt]=useState(0)
 const[entryRoute,setEntryRoute]=useState<{id:string;total:number}|undefined>()
 const[selectedId,setSelectedId]=useState(()=>chapters.findLast(item=>item.unlocked)?.id??chapters[0]?.id)
 const player=usePlayerStore()
 useEffect(()=>{if(!newUnlock)return;localStorage.setItem('cb_story_seen_unlock',newUnlock);const timer=window.setTimeout(()=>setNewUnlock(null),4200);return()=>window.clearTimeout(timer)},[newUnlock])
 const leaveChapter=()=>{setChapter(null);setNodes([])}
 const completeChapter=(cleared:StoryChapter)=>{const next=unlockNextStoryChapter(cleared.id);setChapters(next);const following=next[cleared.order];if(following?.unlocked){setSelectedId(following.id);setNewUnlock(following.id)}onComplete?.(cleared)}
 if(showEntryPicker&&entryPicker)return <StoryRoutePicker chapter={entryChapter} node={entryPicker} onBack={onClose} onChoose={route=>{setRouteChoice({id:route.id,label:route.label});setMapReadyAt(Date.now()+700);setShowEntryPicker(false)}}/>
 if(chapter)return <StoryPlayer chapter={chapter} initialNodes={nodes} entryRoute={entryRoute} onLeave={leaveChapter} onComplete={completeChapter} onBattle={onBattle}/>
 const selected=chapters.find(item=>item.id===selectedId)??chapters[0]
 const mapPoints=chapters.map((item,index)=>({x:item.mapX??[9.5,28.5,45.5,62.5,80.5,93][index],y:item.mapY??[68,41,64,33,57,23][index]})),routePoints=chapters[0]?.mapRoutePoints?.length?chapters[0].mapRoutePoints:mapPoints,selectedIndex=Math.max(0,chapters.findIndex(item=>item.id===selectedId)),actorId=player.desktopCharIds?.[0]??player.ownedCharIds[0]
 const setMapZoom=(value:number)=>{const next=Math.max(1,Math.min(2.4,value));setZoom(next);localStorage.setItem('cb_story_map_zoom',String(next))}
 const enter=(item:StoryChapter)=>{if(!item.unlocked||Date.now()<mapReadyAt)return;const flow=getChapterFlow(item),picker=flow.find((node):node is Extract<StoryFlowNode,{type:'branch'}>=>node.type==='branch'&&!!node.chapterRouteSelect),route=picker?.branches.find(branch=>branch.id===routeChoice?.id||branch.label===routeChoice?.label),routeFlow=picker&&route?flow.flatMap(node=>node.id===picker.id?route.nodes:[node]):flow,chapterCard:StoryFlowNode={id:`chapter_card_${item.id}`,type:'common',segment:{id:`chapter_card_segment_${item.id}`,speaker:'旁白',side:'left',presentation:'chapter',section:item.chapterCardEyebrow??'CHAPTER',text:item.chapterCardTitle??`第${item.order}章　${item.piece}`,chapterPrompt:item.chapterCardPrompt??'點擊任意位置開始 ◆'}};setChapter(item);setNodes(item.chapterCardEnabled===false?routeFlow:[chapterCard,...routeFlow]);setEntryRoute(route?{id:route.id,total:route.nodes.length}:undefined)}
 return <div className="panel-overlay story-map-screen">
  <div className="panel-header"><button className="panel-back" onClick={onClose}>返回大廳</button><span className="panel-title">故事模式</span><span className="panel-meta">命運棋盤</span></div>
  <div className="story-world-map">
   <header><small>CHANCEBOARD CHRONICLE</small><h1>六棋之境</h1><p>沿著命運棋路前進，每一幅地圖都是一段尚未落子的故事。</p></header>
   <div className="story-map-route">
    <div className="story-map-canvas" style={{'--map-zoom':zoom,'--map-focus-x':`${mapPoints[selectedIndex].x}%`,'--map-focus-y':`${mapPoints[selectedIndex].y}%`} as React.CSSProperties}>
    <div className="story-map-land" aria-hidden="true"/>
    {selected?.unlocked&&<div className={`story-region-highlight region-${selectedIndex+1}`}/>}
    <svg className="story-route-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline className="route-shadow" points={routePoints.map(point=>`${point.x},${point.y}`).join(' ')}/><polyline className="route-main" points={routePoints.map(point=>`${point.x},${point.y}`).join(' ')}/></svg>
    {actorId&&selected?.unlocked&&<div className="story-map-actor" style={{left:`${mapPoints[selectedIndex].x}%`,top:`${mapPoints[selectedIndex].y}%`}}><PixelCharacterActor charId={actorId} pose="side" action="walk" face="right"/></div>}
    {chapters.map((item,index)=> <button key={item.id} disabled={!item.unlocked} aria-disabled={!item.unlocked} style={{'--node-x':`${mapPoints[index].x}%`,'--node-y':`${mapPoints[index].y}%`} as React.CSSProperties} className={`story-map-node ${item.unlocked?'unlocked':'locked'} ${selectedId===item.id?'selected':''} ${newUnlock===item.id?'newly-unlocked':''} node-${index+1}`} onClick={()=>item.unlocked&&setSelectedId(item.id)} onDoubleClick={()=>enter(item)}>
      <i>{item.unlocked?item.piece:'?'}</i><span>{item.unlocked?<><em>第 {item.order} 章</em><b>{item.title}</b></>:<><em>尚未解鎖</em><b>？？？</b></>}</span><small>{item.unlocked?'◆':'🔒'}</small>
     </button>)}
    </div>
    <div className="story-map-zoom" aria-label="地圖縮放"><button onClick={()=>setMapZoom(zoom+.2)}>＋</button><input aria-label="縮放比例" type="range" min="1" max="2.4" step=".1" value={zoom} onChange={event=>setMapZoom(Number(event.target.value))}/><button onClick={()=>setMapZoom(zoom-.2)}>－</button><span>{Math.round(zoom*100)}%</span><button className="reset" onClick={()=>setMapZoom(1.2)}>定位</button></div>
   </div>
   {selected&&<aside className={`story-map-detail ${selected.unlocked?'':'locked'}`} style={{backgroundImage:`linear-gradient(90deg,#080a18f5,#080a18aa),url(${getUrlByKey(`cb_story_map_${selected.id}`)??''})`}}><div><small>CHAPTER {selected.order} · {selected.piece}</small><h2>{selected.title}</h2><p>{selected.subtitle}</p></div><button disabled={!selected.unlocked} onClick={()=>enter(selected)}>{selected.unlocked?'進入章節 →':'🔒 尚未解鎖'}</button></aside>}
  </div>
 </div>
}
