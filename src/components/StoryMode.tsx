import {useMemo,useState} from 'react'
import './StoryMode.css'
import {getChapterFlow,getStoryChapters,type StoryChapter,type StoryFlowNode} from '../utils/storyStore'
import {getUrlByKey} from '../utils/charStore'
import StoryPlayer from './StoryPlayer'

interface Props{onClose:()=>void;onComplete?:(chapter:StoryChapter)=>void}

export default function StoryMode({onClose,onComplete}:Props){
 const chapters=useMemo(getStoryChapters,[]),[chapter,setChapter]=useState<StoryChapter|null>(null),[nodes,setNodes]=useState<StoryFlowNode[]>([])
 const leaveChapter=()=>{setChapter(null);setNodes([])}
 if(chapter)return <StoryPlayer chapter={chapter} initialNodes={nodes} onLeave={leaveChapter} onComplete={onComplete}/>
 return <div className="panel-overlay story-map-screen"><div className="panel-header"><button className="panel-back" onClick={onClose}>返回大廳</button><span className="panel-title">故事模式</span><span className="panel-meta">命運棋盤</span></div><div className="story-map-path">{chapters.map(item=><button key={item.id} disabled={!item.unlocked} className={`story-map-node ${item.unlocked?'unlocked':'locked'}`} style={{backgroundImage:`linear-gradient(180deg,transparent,#050611),url(${getUrlByKey(`cb_story_map_${item.id}`)??''})`}} onClick={()=>{setChapter(item);setNodes(getChapterFlow(item))}}><i>{item.piece}</i><b>{item.title}</b><span>{item.subtitle}</span><small>{item.unlocked?'進入章節 →':'🔒 尚未解鎖'}</small></button>)}</div></div>
}
