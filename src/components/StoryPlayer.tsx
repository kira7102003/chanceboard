import {useEffect,useMemo,useState} from 'react'
import {getBoardCharacters} from '../utils/boardCharacters'
import {getCharImg,getChars,getUrlByKey} from '../utils/charStore'
import {describeStoryRewards,type StoryChapter,type StoryFlowNode} from '../utils/storyStore'
import './StoryPlaybackV2.css'

interface Props{chapter:StoryChapter;initialNodes:StoryFlowNode[];onLeave:()=>void;onComplete?: (chapter:StoryChapter)=>void;onBattle?:()=>void;preview?:boolean}
const pieceId=(value?:string)=>value?.startsWith('piece:')?value.slice(6):null

export default function StoryPlayer({chapter,initialNodes,onLeave,onComplete,onBattle,preview=false}:Props){
 const[nodes,setNodes]=useState(initialNodes),[cursor,setCursor]=useState(0),[shown,setShown]=useState(0),[auto,setAuto]=useState(false),[speed,setSpeed]=useState<1|2>(1),[historyOpen,setHistoryOpen]=useState(false),[history,setHistory]=useState<{speaker:string;text:string}[]>([])
 const node=nodes[cursor],segment=node?.type==='common'?node.segment:undefined,type=segment?.presentation??'dialogue',text=segment?.text??'',marqueeParts=useMemo(()=>text.split(/\n\s*\n/).filter(Boolean),[text]),complete=shown>=(type==='marquee'?marqueeParts.length:text.length)
 const boards=useMemo(getBoardCharacters,[]),chars=useMemo(getChars,[]),leftId=boards[0]?.id??'black',rightId=boards[1]?.id??leftId
 const selectedId=pieceId(segment?.boardCharacter),speaker=segment?.speaker||chapter.title,speakerChar=chars.find(char=>char.id===selectedId||char.name===speaker),activeSide=segment?.side??'left'
 const avatar=speakerChar?(getCharImg(speakerChar.id)??getUrlByKey(`cb_head_img_${speakerChar.id}`)):getUrlByKey(`cb_board_${segment?.boardCharacter??leftId}_front`)
 const background=getUrlByKey(chapter.backgroundKey||`cb_story_map_${chapter.id}`)??'',cg=segment?.cgKey?(getUrlByKey(segment.cgKey)??segment.cgKey):''
 useEffect(()=>{setShown(0)},[cursor,text])
 useEffect(()=>{if(!text||complete)return;const maximum=type==='marquee'?marqueeParts.length:text.length,delay=type==='marquee'?Math.max(650,1500/speed):Math.max(12,32/speed);const timer=window.setInterval(()=>setShown(value=>Math.min(maximum,value+1)),delay);return()=>clearInterval(timer)},[text,type,marqueeParts.length,complete,speed])
 useEffect(()=>{if(!auto||!node||node.type==='branch'||type==='battle'||!complete)return;const timer=window.setTimeout(()=>advance(),Math.max(380,1100/speed));return()=>clearTimeout(timer)})
 const addHistory=()=>{if(text&&!history.some((item,index)=>index===history.length-1&&item.text===text))setHistory(items=>[...items,{speaker:type==='narration'?'旁白':speaker,text}])}
 const advance=()=>{if(!complete){setShown(type==='marquee'?marqueeParts.length:text.length);return}addHistory();setCursor(value=>Math.min(nodes.length,value+1))}
 const skip=()=>{setAuto(false);addHistory();const next=nodes.findIndex((item,index)=>index>cursor&&(item.type==='branch'||(item.type==='common'&&item.segment.presentation==='battle')));setCursor(next>=0?next:nodes.length)}
 const choose=(branch:Extract<StoryFlowNode,{type:'branch'}>['branches'][number])=>{setNodes(current=>[...current.slice(0,cursor),...branch.nodes,...current.slice(cursor+1)]);setShown(0)}
 const boardPortrait=(side:'left'|'right')=>{const id=side===activeSide?(segment?.boardCharacter&&!selectedId?segment.boardCharacter:side==='left'?leftId:rightId):side==='left'?leftId:rightId;if(selectedId&&side===activeSide){const image=getCharImg(selectedId);return image?<img className={`story-v2-portrait ${side} active`} src={image} alt=""/>:null}const image=getUrlByKey(`cb_board_${id}_${segment?.pose??'front'}`)??getUrlByKey(`cb_board_${id}_front`);return image?<img className={`story-v2-portrait ${side} ${side===activeSide?'active':'inactive'}`} src={image} alt=""/>:null}
 const enterBattle=()=>{addHistory();if(preview||!onBattle){advance();return}localStorage.setItem('cb_story_resume',JSON.stringify({chapterId:chapter.id,cursor:cursor+1,nodes}));onBattle()}
 return <div className={`story-v2 type-${type}`} style={{'--story-bg':`url(${background})`,'--cg':`url(${cg})`,'--cg-x':`${segment?.cgPositionX??50}%`,'--cg-y':`${segment?.cgPositionY??50}%`,'--cg-end-x':`${segment?.cgEndPositionX??segment?.cgPositionX??50}%`,'--cg-end-y':`${segment?.cgEndPositionY??segment?.cgPositionY??50}%`,'--cg-duration':`${segment?.cgDuration??6}s`,'--portrait-active':`${(segment?.portraitActiveScale??100)/100}`,'--portrait-inactive':`${(segment?.portraitInactiveScale??88)/100}`,'--portrait-dim':`${(segment?.portraitInactiveOpacity??45)/100}`} as React.CSSProperties}>
  <div className="story-v2-bg"/>{cg&&<><div className="story-v2-cg-blur"/><div key={segment?.id} className="story-v2-cg"/></>}
  <header className="story-v2-tools"><button onClick={onLeave}>← 返回</button><span>{chapter.order} · {chapter.title}</span><div><button onClick={()=>setHistoryOpen(true)}>紀錄</button><button className={auto?'active':''} onClick={()=>setAuto(value=>!value)}>AUTO</button><button onClick={()=>setSpeed(value=>value===1?2:1)}>{speed}×</button><button onClick={skip}>SKIP</button></div></header>
  {!['narration','marquee','chapter','cg','battle'].includes(type)&&<>{boardPortrait('left')}{boardPortrait('right')}</>}
  {node?.type==='branch'?<section className="story-v2-choice"><small>PLAYER CHOICE</small><h2>{node.title}</h2>{node.branches.map(branch=><button key={branch.id} onClick={()=>choose(branch)}>{branch.label}</button>)}</section>:node? <>
   {type==='marquee'&&<button className={`story-v2-marquee dir-${segment?.textDirection??'ltr'}`} onClick={advance}>{marqueeParts.slice(0,shown).map((part,index)=><span key={index}>{part}</span>)}</button>}
   {type==='chapter'&&<button className="story-v2-chapter" onClick={advance}><small>{segment?.section??`CHAPTER ${chapter.order}`}</small><strong>{text.slice(0,shown)}</strong></button>}
   {type==='narration'&&<button className="story-v2-narration" onClick={advance}>{text.slice(0,shown)}</button>}
   {type==='cg'&&<button className="story-v2-cg-caption" onClick={advance}>{text.slice(0,shown)}</button>}
   {type==='battle'&&<section className="story-v2-battle"><small>BATTLE</small><h2>{segment?.section??'即將進入戰鬥'}</h2><p>{text}</p><button onClick={enterBattle}>{preview?'預覽：繼續下一段':'確認並進入戰鬥'}</button></section>}
   {type==='dialogue'&&<button className={`story-v2-dialogue ${activeSide}`} onClick={advance}>{avatar&&<span className="story-v2-avatar"><img src={avatar} alt=""/></span>}<div><b>{speaker}</b>{segment?.section&&<small>{segment.section}</small>}<p>{text.slice(0,shown)}</p><em>{complete?'點擊繼續 ›':'●●●'}</em></div></button>}
  </>:<><div className="story-v2-reward"><small>CHAPTER REWARD</small><b>{describeStoryRewards(chapter.rewards)||'章節完成獎勵'}</b></div><button className="story-v2-finish" onClick={()=>{onComplete?.(chapter);onLeave()}}>完成章節 ＋100 EXP</button></>}
  {historyOpen&&<div className="story-v2-history"><section><header><b>過往對話</b><button onClick={()=>setHistoryOpen(false)}>×</button></header>{history.length?history.map((item,index)=><article key={index}><b>{item.speaker}</b><p>{item.text}</p></article>):<p>尚無對話紀錄</p>}</section></div>}
 </div>
}
