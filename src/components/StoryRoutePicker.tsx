import {getUrlByKey} from '../utils/charStore'
import type {StoryChapter,StoryFlowNode} from '../utils/storyStore'
import './StoryPlaybackV2.css'

type BranchNode=Extract<StoryFlowNode,{type:'branch'}>
export default function StoryRoutePicker({chapter,node,onChoose,onBack}:{chapter:StoryChapter;node:BranchNode;onChoose:(route:BranchNode['branches'][number])=>void;onBack:()=>void}){
 return <div className="story-route-picker"><section><header><button onClick={onBack}>‹ 返回</button><div><h1>第{chapter.order===1?'一':chapter.order}章　{chapter.piece}（{chapter.id==='pawn'?'Pawn':chapter.title}）</h1><p>{node.routeSelectSubtitle||`選擇${node.branches.map(route=>route.label).join('或')}，不同路線將通往不同故事。`}</p></div></header><div className="story-route-picker-grid">{node.branches.map(route=>{const image=route.coverKey&&(getUrlByKey(route.coverKey)||(/^(https?:|data:|\/)/.test(route.coverKey)?route.coverKey:null));return <button className={`story-route-cover${image?'':' empty'}`} key={route.id} onClick={()=>onChoose(route)} style={image?{backgroundImage:`linear-gradient(transparent 45%,#020309f5),url(${image})`}:undefined}>{!image&&<strong>尚未設定「{route.label}」選擇 CG</strong>}<span><b>{route.label}</b><p>{route.description||`${route.label}路線，體驗不同的選擇與結局。`}</p><small>{route.progressText||'尚未開始'}</small></span></button>})}</div><button className="story-route-picker-back" onClick={onBack}>返回大廳</button></section></div>
}
