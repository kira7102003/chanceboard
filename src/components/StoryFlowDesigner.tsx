import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './StoryFlowDesigner.css'
import './StoryPlaybackV2.css'
import { getCharImg, getChars, getUrlByKey, uploadByKey } from '../utils/charStore'
import type { BoardCharacter } from '../utils/boardCharacters'
import { getChapterFlow, type StoryChapter, type StoryFlowNode, type StoryRewards, type StorySegment } from '../utils/storyStore'
import StoryPlayer from './StoryPlayer'
import StoryRoutePicker from './StoryRoutePicker'

interface Props {
  chapter: StoryChapter
  boardCharacters: BoardCharacter[]
  onSave: (flow: StoryFlowNode[], rewards: StoryRewards) => void
  onClose: () => void
}

const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
const makeSegment = (character?: BoardCharacter): StorySegment => ({
  id: uid('segment'), speaker: character?.name ?? '旁白', text: '輸入故事對話……', side: 'left', boardCharacter: character?.id, pose: 'front', section: '新段落',
})
const makeCommon = (character?: BoardCharacter): StoryFlowNode => ({ id: uid('node'), type: 'common', segment: makeSegment(character) })
const makePresentation = (presentation: NonNullable<StorySegment['presentation']>, character?: BoardCharacter): StoryFlowNode => ({ id: uid('node'), type: 'common', segment: { ...makeSegment(character), presentation, speaker: presentation === 'narration' ? '旁白' : character?.name ?? '旁白', text: presentation === 'chapter' ? '章節標題' : presentation === 'battle' ? '即將進入戰鬥' : '輸入故事內容……' } })
const makeBranch = (): StoryFlowNode => ({ id: uid('branch'), type: 'branch', title: '新選項', branches: [
  { id: uid('route'), label: '選項 A', nodes: [] }, { id: uid('route'), label: '選項 B', nodes: [] },
] })
const makeRouteSelect = (): StoryFlowNode => ({ id: uid('route_select'), type: 'branch', title: '選擇路線', chapterRouteSelect: true, routeSelectSubtitle: '選擇一條路線開始故事。', branches: [
  { id: uid('route'), label: '路線 A', nodes: [], description: '第一條故事路線', progressText: '尚未開始' },
  { id: uid('route'), label: '路線 B', nodes: [], description: '第二條故事路線', progressText: '尚未開始' },
] })
const cloneNode = (node: StoryFlowNode): StoryFlowNode => node.type === 'common'
  ? { ...node, id: uid('node'), segment: { ...node.segment, id: uid('segment') } }
  : { ...node, id: uid('branch'), branches: node.branches.map(branch => ({ ...branch, id: uid('route'), nodes: branch.nodes.map(cloneNode) })) }
const pieceIdFromRef = (value?: string) => value?.startsWith('piece:') ? value.slice(6) : null

export default function StoryFlowDesigner({ chapter, boardCharacters, onSave, onClose }: Props) {
  const [flow, setFlow] = useState(() => getChapterFlow(chapter))
  const [rewards, setRewards] = useState<StoryRewards>(chapter.rewards ?? {})
  const [previewWindow, setPreviewWindow] = useState<Window | null>(null)
  const [previewRoute,setPreviewRoute]=useState<Extract<StoryFlowNode,{type:'branch'}>|null>(null)
  const [previewNodes,setPreviewNodes]=useState<StoryFlowNode[]|null>(null)
  const [saved, setSaved] = useState(false)
  const [mapOpen,setMapOpen]=useState(true)
  const [detailsVisible,setDetailsVisible]=useState(true)
  const canvasRef = useRef<HTMLElement>(null)
  const scrollKey = `cb_story_designer_scroll_v2_${chapter.id}`
  const change = (next: StoryFlowNode[]) => { setFlow(next); onSave(next, rewards); setSaved(false) }
  const revealNode = (id:string) => requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const target=canvasRef.current?.querySelector<HTMLElement>(`[data-editor-node-id="${CSS.escape(id)}"]`)
    target?.scrollIntoView({behavior:'smooth',block:'center',inline:'center'})
    target?.classList.add('just-added');window.setTimeout(()=>target?.classList.remove('just-added'),1800)
  }))
  const append = (node:StoryFlowNode) => { change([...flow,node]); revealNode(node.id) }
  const returnToMap=()=>{const canvas=canvasRef.current,map=canvas?.querySelector<HTMLElement>('.story-graph-overview');if(canvas&&map){setMapOpen(true);requestAnimationFrame(()=>{canvas.scrollTo({top:Math.max(0,map.offsetTop-12),left:0,behavior:'smooth'})})}}
  const save = () => { onSave(flow, rewards); setSaved(true) }
  const openPreview = () => {
    if (previewWindow && !previewWindow.closed) { previewWindow.focus(); return }
    const popup = window.open('', 'chanceboard-story-preview', 'popup=yes,width=1440,height=900,resizable=yes,scrollbars=no')
    if (!popup) { window.alert('瀏覽器已阻擋預覽視窗，請允許此網站開啟彈出式視窗。'); return }
    popup.document.title = `${chapter.title}｜故事預覽`
    popup.document.documentElement.lang = 'zh-Hant'
    popup.document.body.innerHTML = ''
    popup.document.body.style.margin = '0'
    document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style').forEach(source => {
      const copy = source.cloneNode(true) as HTMLLinkElement | HTMLStyleElement
      if (copy instanceof HTMLLinkElement) copy.href = source instanceof HTMLLinkElement ? source.href : ''
      popup.document.head.appendChild(copy)
    })
    const picker=flow.find((node):node is Extract<StoryFlowNode,{type:'branch'}>=>node.type==='branch'&&!!node.chapterRouteSelect)
    setPreviewRoute(picker??null);setPreviewNodes(flow);setPreviewWindow(popup)
    popup.focus()
  }
  useEffect(() => {
    if (!previewWindow) return
    const close = () => setPreviewWindow(null)
    previewWindow.addEventListener('beforeunload', close)
    return () => previewWindow.removeEventListener('beforeunload', close)
  }, [previewWindow])
  useEffect(() => {
    const canvas=canvasRef.current
    if(!canvas)return
    try{const saved=JSON.parse(localStorage.getItem(scrollKey)??'null') as {left:number;top:number}|null;if(saved)requestAnimationFrame(()=>canvas.scrollTo(saved.left,saved.top))}catch{/* ignore invalid saved position */}
    const remember=()=>localStorage.setItem(scrollKey,JSON.stringify({left:canvas.scrollLeft,top:canvas.scrollTop}))
    canvas.addEventListener('scroll',remember,{passive:true})
    return()=>{remember();canvas.removeEventListener('scroll',remember)}
  },[scrollKey])

  return <div className="story-designer">
    <header className="story-designer-head">
      <div><button onClick={onClose}>← 返回章節設定</button><span className="story-designer-dot" /><b>{chapter.piece}　{chapter.title}｜故事流程</b></div>
      <div className="story-designer-legend"><i className="dialogue" />對話<i className="choice" />選項<i className="route" />分支</div>
      <div className="story-add-toolbar"><button onClick={openPreview}>↗ 開新視窗預覽</button><button className="route-entry" onClick={() => append(makeRouteSelect())}>＋ 路線入口</button><button onClick={() => append(makeCommon(boardCharacters[0]))}>＋ 對話</button><button onClick={() => append(makeBranch())}>＋ 分支</button><button onClick={() => append(makePresentation('narration'))}>＋ 旁白</button><button onClick={() => append(makePresentation('marquee'))}>＋ 跑馬燈</button><button onClick={() => append(makePresentation('chapter'))}>＋ 章節</button><button onClick={() => append(makePresentation('cg'))}>＋ CG</button><button onClick={() => append(makePresentation('battle'))}>＋ 戰鬥</button><button className="primary" onClick={save}>{saved ? '✓ 已儲存' : '儲存'}</button></div>
    </header>
    <div className="story-designer-sub">以卡片編排章節。實線代表順序，彩色路線代表玩家選項；每條分支都能繼續加入對話或下一層選項。</div>
    <nav className="story-designer-palette">
      <button className="reward" onClick={() => document.querySelector('.story-reward-node')?.scrollIntoView({ behavior: 'smooth', inline: 'center' })}><i>★</i><span>故事獎勵</span></button>
      {boardCharacters.map((character, index) => { const showIcon = index < 2; const image = showIcon ? getUrlByKey(`cb_board_${character.id}_front`) : null; return <button key={character.id} onClick={() => append(makeCommon(character))}><i>{image ? <img src={image} alt="" /> : showIcon ? character.name.slice(0, 1) : null}</i><span>{character.name}</span></button> })}
    </nav>
    <main className="story-designer-canvas" ref={canvasRef}>
      <FlowGraphOverview nodes={flow} onChange={change} onLocate={revealNode} open={mapOpen} onOpenChange={setMapOpen}/>
      {detailsVisible&&<><FlowLane nodes={flow} onChange={change} boardCharacters={boardCharacters} depth={0} label="章節開始" laneId="root" /><RewardCard rewards={rewards} onChange={next => { setRewards(next); setSaved(false) }} /></>}
      {!flow.length && <div className="story-designer-empty">尚無節點，請從右上角新增第一段對話。</div>}
    </main>
    <aside className="story-designer-anchor-tools"><button onClick={returnToMap}>↑ 回流程圖</button><button onClick={()=>setMapOpen(value=>!value)}>{mapOpen?'收縮 MAP':'展開 MAP'}</button><button onClick={()=>setDetailsVisible(value=>!value)}>{detailsVisible?'隱藏細節':'顯示細節'}</button></aside>
    {previewWindow && !previewWindow.closed && createPortal(previewRoute?<StoryRoutePicker chapter={chapter} node={previewRoute} onBack={()=>previewWindow.close()} onChoose={route=>{setPreviewNodes((previewNodes??flow).flatMap(node=>node.id===previewRoute.id?route.nodes:[node]));setPreviewRoute(null)}}/>:<StoryPlayer chapter={chapter} initialNodes={previewNodes??flow} onLeave={() => previewWindow.close()} preview />, previewWindow.document.body)}
  </div>
}

function FlowGraphOverview({nodes,onChange,onLocate,open,onOpenChange}:{nodes:StoryFlowNode[];onChange:(nodes:StoryFlowNode[])=>void;onLocate:(id:string)=>void;open:boolean;onOpenChange:(open:boolean)=>void}){
  const stageRef=useRef<HTMLDivElement>(null)
  const[links,setLinks]=useState<{from:string;to:string;color:string;label?:string;path?:string}[]>([])
  const[collapseVersion,setCollapseVersion]=useState(0)
  const toggleGraphRoute=(event:React.MouseEvent<HTMLDivElement>)=>{const target=event.target as HTMLElement;if(!target.matches('.story-graph-route>input'))return;event.preventDefault();target.closest('.story-graph-route')?.classList.toggle('collapsed');target.blur();setCollapseVersion(value=>value+1)}
  const label=(node:StoryFlowNode)=>node.type==='branch'?node.title:(node.segment.section||node.segment.text.slice(0,18)||'空白節點')
  const kind=(node:StoryFlowNode)=>node.type==='branch'?'選擇':node.segment.presentation==='cg'?'CG':node.segment.presentation==='chapter'?'章節':node.segment.presentation==='battle'?'戰鬥':'劇情'
  const make=(type:'dialogue'|'branch'|'cg'|'battle')=>type==='dialogue'?makeCommon():type==='branch'?makeBranch():makePresentation(type)
  useLayoutEffect(()=>{
    const stage=stageRef.current;if(!stage)return
    const edges:{from:string;to:string;color:string;label?:string}[]=[]
    const walk=(items:StoryFlowNode[])=>{items.forEach((node,index)=>{if(index<items.length-1)edges.push({from:node.id,to:items[index+1].id,color:'#58c8ff'});if(node.type==='branch')node.branches.forEach((route,routeIndex)=>{if(route.nodes[0])edges.push({from:node.id,to:route.nodes[0].id,color:['#65e49a','#6da8ff','#ba83ff','#ff7f9d'][routeIndex%4],label:route.label});walk(route.nodes)})})}
    if(nodes[0])edges.push({from:'__start__',to:nodes[0].id,color:'#ffd45e'});walk(nodes)
    const draw=()=>{const base=stage.getBoundingClientRect();setLinks(edges.map(edge=>{const fromElement=stage.querySelector<HTMLElement>(`[data-graph-node-id="${CSS.escape(edge.from)}"]`),toElement=stage.querySelector<HTMLElement>(`[data-graph-node-id="${CSS.escape(edge.to)}"]`);if(!fromElement?.offsetParent||!toElement?.offsetParent)return{...edge,path:undefined};const from=fromElement.getBoundingClientRect(),to=toElement.getBoundingClientRect(),x1=from.right-base.left+stage.scrollLeft,y1=from.top+from.height/2-base.top+stage.scrollTop,x2=to.left-base.left+stage.scrollLeft,y2=to.top+to.height/2-base.top+stage.scrollTop,curve=Math.max(45,Math.abs(x2-x1)*.42);return{...edge,path:`M ${x1} ${y1} C ${x1+curve} ${y1}, ${x2-curve} ${y2}, ${x2} ${y2}`}}))}
    const frame=requestAnimationFrame(draw),observer=new ResizeObserver(draw);observer.observe(stage);return()=>{cancelAnimationFrame(frame);observer.disconnect()}
  },[nodes,collapseVersion])
  const Sequence=({items,setItems}:{items:StoryFlowNode[];setItems:(items:StoryFlowNode[])=>void}):React.ReactNode=><div className="story-graph-sequence">{items.map((node,index)=><div className="story-graph-unit" key={node.id}><article data-graph-node-id={node.id} className={`story-graph-node ${node.type}`}><div className="story-graph-node-head"><small>{kind(node)}</small><span><button disabled={index===0} onClick={()=>{const next=[...items];[next[index-1],next[index]]=[next[index],next[index-1]];setItems(next)}}>←</button><button disabled={index===items.length-1} onClick={()=>{const next=[...items];[next[index+1],next[index]]=[next[index],next[index+1]];setItems(next)}}>→</button><button className="delete" onClick={()=>setItems(items.filter(item=>item.id!==node.id))}>×</button></span></div>{node.type==='branch'?<><input aria-label="選擇題目" value={node.title} onChange={event=>setItems(items.map(item=>item.id===node.id&&item.type==='branch'?{...item,title:event.target.value}:item))}/><label className="story-graph-entry"><input type="checkbox" checked={node.chapterRouteSelect??false} onChange={event=>setItems(items.map(item=>item.id===node.id&&item.type==='branch'?{...item,chapterRouteSelect:event.target.checked}:item))}/>章節入口頁</label></>:<b>{label(node)}</b>}<button onClick={()=>onLocate(node.id)}>修改細節</button><div className="story-graph-insert"><button onClick={()=>{const next=[...items];next.splice(index+1,0,make('dialogue'));setItems(next)}}>＋對話</button><button onClick={()=>{const next=[...items];next.splice(index+1,0,make('branch'));setItems(next)}}>＋分支</button><button onClick={()=>{const next=[...items];next.splice(index+1,0,make('cg'));setItems(next)}}>＋CG</button><button onClick={()=>{const next=[...items];next.splice(index+1,0,make('battle'));setItems(next)}}>＋戰鬥</button></div></article>{node.type==='branch'&&<div className="story-graph-branches">{node.branches.map(branch=><div className="story-graph-route" key={branch.id}><input aria-label="路線名稱" value={branch.label} onChange={event=>setItems(items.map(item=>item.id===node.id&&item.type==='branch'?{...item,branches:item.branches.map(route=>route.id===branch.id?{...route,label:event.target.value}:route)}:item))}/><button className="story-graph-remove-route" disabled={node.branches.length<=2} onClick={()=>setItems(items.map(item=>item.id===node.id&&item.type==='branch'?{...item,branches:item.branches.filter(route=>route.id!==branch.id)}:item))}>刪除路線</button><Sequence items={branch.nodes} setItems={routeNodes=>setItems(items.map(item=>item.id===node.id&&item.type==='branch'?{...item,branches:item.branches.map(route=>route.id===branch.id?{...route,nodes:routeNodes}:route)}:item))}/></div>)}<button className="story-graph-add-route" onClick={()=>setItems(items.map(item=>item.id===node.id&&item.type==='branch'?{...item,branches:[...item.branches,{id:uid('route'),label:`路線 ${item.branches.length+1}`,nodes:[]}]}:item))}>＋ 新增路線</button></div>}</div>)}</div>
  return <details className="story-graph-overview" open={open} onToggle={event=>onOpenChange(event.currentTarget.open)}><summary><span>FLOW MAP</span><b>章節流程骨架</b><small>點分支起點標籤可收縮／展開該路線</small></summary><div className="story-graph-stage" ref={stageRef} onClick={toggleGraphRoute}><svg className="story-graph-svg" width={stageRef.current?.scrollWidth||0} height={stageRef.current?.scrollHeight||0}><defs><marker id="story-edge-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>{links.map((link,index)=>link.path&&<g key={`${link.from}_${link.to}_${index}`}><path id={`edge_${index}`} d={link.path} stroke={link.color} markerEnd="url(#story-edge-arrow)"/>{link.label&&<text><textPath href={`#edge_${index}`} startOffset="50%">{link.label}</textPath></text>}</g>)}</svg><article data-graph-node-id="__start__" className="story-graph-start"><small>START</small><b>章節開始</b><div className="story-graph-start-actions"><button onClick={()=>onChange([makeCommon(),...nodes])}>＋對話</button><button onClick={()=>onChange([makeBranch(),...nodes])}>＋分支</button><button onClick={()=>onChange([makePresentation('cg'),...nodes])}>＋CG</button></div></article><Sequence items={nodes} setItems={onChange}/></div></details>
}

function FlowLane({ nodes, onChange, boardCharacters, depth, label, laneId }: {
  nodes: StoryFlowNode[]; onChange: (nodes: StoryFlowNode[]) => void; boardCharacters: BoardCharacter[]; depth: number; label: string; laneId: string
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [dragging, setDragging] = useState(false)
  const toggleCollapsed = (id: string) => setCollapsed(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const replace = (id: string, node: StoryFlowNode) => onChange(nodes.map(item => item.id === id ? node : item))
  const move = (index: number, offset: number) => {
    const target = index + offset
    if (target < 0 || target >= nodes.length) return
    const next = [...nodes]; [next[index], next[target]] = [next[target], next[index]]; onChange(next)
  }
  const dropAt = (event: React.DragEvent, insertIndex: number) => {
    event.preventDefault()
    try {
      const source = JSON.parse(event.dataTransfer.getData('application/x-story-node')) as { laneId: string; index: number }
      if (source.laneId !== laneId || source.index === insertIndex || source.index + 1 === insertIndex) return
      const next = [...nodes]
      const [moving] = next.splice(source.index, 1)
      next.splice(source.index < insertIndex ? insertIndex - 1 : insertIndex, 0, moving)
      onChange(next)
    } catch { /* Ignore non-story drags. */ }
  }
  return <section className={`story-flow-lane${depth===0?' root-lane':''}${dragging ? ' dragging' : ''}`} style={{ '--lane-depth': depth } as React.CSSProperties}>
    <div className="story-flow-lane-label">{label}</div>
    <div className="story-flow-board">
      {depth===0&&<article className="story-start-node"><i>▶</i><span><small>FLOW START</small><b>故事起始點</b><em>第一個節點類型</em></span><div><button className={nodes[0]?.type==='branch'?'active':''} onClick={()=>{if(nodes[0]?.type!=='branch')onChange([makeBranch(),...nodes])}}>分支</button><button className={nodes[0]?.type==='common'?'active':''} onClick={()=>{if(nodes[0]?.type!=='common')onChange([makeCommon(boardCharacters[0]),...nodes])}}>對話</button></div></article>}
      {nodes.map((node, index) => <div className="story-flow-card-wrap" key={node.id}>
        <div className="story-drop-zone" onDragOver={event => event.preventDefault()} onDrop={event => dropAt(event, index)}><span>放到這裡</span></div>
        {(depth===0||index > 0) && <span className="story-flow-arrow">→</span>}
        <article data-editor-node-id={node.id} className={`story-designer-card ${node.type}${collapsed.has(node.id)?' collapsed':''}`}>
          <div className="story-card-top" draggable onDragStart={event => { setDragging(true); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-story-node', JSON.stringify({ laneId, index })) }} onDragEnd={() => setDragging(false)}><i>{index + 1}</i><b>{node.type === 'common' ? `${node.segment.presentation==='narration'?'旁白':node.segment.presentation==='marquee'?'跑馬燈':node.segment.presentation==='chapter'?'章節':node.segment.presentation==='cg'?'CG':node.segment.presentation==='battle'?'戰鬥':'對話'}節點` : depth === 0 ? '共用選擇' : '選項分支'}</b>{collapsed.has(node.id)&&node.type==='common'&&<em>{node.segment.speaker}</em>}<span><button draggable={false} title={collapsed.has(node.id)?'展開':'收縮'} onMouseDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();toggleCollapsed(node.id)}}>{collapsed.has(node.id)?'▾':'▴'}</button><span className="story-drag-handle" title="拖曳標題列即可移動">☷</span>
            <button title="複製卡片" onClick={() => { const next = [...nodes]; next.splice(index + 1, 0, cloneNode(node)); onChange(next) }}>⧉</button><button disabled={index === 0} onClick={() => move(index, -1)}>←</button><button disabled={index === nodes.length - 1} onClick={() => move(index, 1)}>→</button><button className="delete" onClick={() => onChange(nodes.filter(item => item.id !== node.id))}>×</button>
          </span></div>
          {!collapsed.has(node.id)&&(node.type === 'common' ? <DialogueCard segment={node.segment} boardCharacters={boardCharacters} onChange={segment => replace(node.id, { ...node, segment })} />
            : <BranchCard node={node} boardCharacters={boardCharacters} depth={depth} onChange={next => replace(node.id, next)} />)}
        </article>
      </div>)}
      <div className="story-drop-zone end" onDragOver={event => event.preventDefault()} onDrop={event => dropAt(event, nodes.length)}><span>放到最後</span></div>
      <div className="story-flow-inline-add"><button onClick={() => onChange([...nodes, makeCommon(boardCharacters[0])])}>＋ 對話</button><button onClick={() => onChange([...nodes, makePresentation('narration')])}>＋ 旁白</button><button onClick={() => onChange([...nodes, makePresentation('cg')])}>＋ CG</button><button onClick={() => onChange([...nodes, makePresentation('battle')])}>＋ 戰鬥</button><button onClick={() => onChange([...nodes, makeBranch()])}>＋ 分支</button></div>
    </div>
  </section>
}

function DialogueCard({ segment, boardCharacters, onChange }: { segment: StorySegment; boardCharacters: BoardCharacter[]; onChange: (segment: StorySegment) => void }) {
  const patch = (value: Partial<StorySegment>) => onChange({ ...segment, ...value })
  const characters = getChars(); const selectedPieceId = pieceIdFromRef(segment.boardCharacter)
  const image = selectedPieceId ? (getCharImg(selectedPieceId) ?? '') : (getUrlByKey(`cb_board_${segment.boardCharacter ?? 'black'}_front`) ?? '')
  return <div className="story-dialogue-editor">
    <div className="story-node-speaker">{image ? <img src={image} alt="" /> : <span>{segment.speaker.slice(0, 1)}</span>}<input value={segment.speaker} onChange={event => patch({ speaker: event.target.value })} /></div>
    <input className="story-node-section" value={segment.section ?? ''} placeholder="段落名稱" onChange={event => patch({ section: event.target.value })} />
    <textarea value={segment.text} onChange={event => patch({ text: event.target.value })} />
    <div className="story-node-presentation"><select value={segment.presentation ?? 'dialogue'} onChange={event => patch({ presentation: event.target.value as StorySegment['presentation'] })}><option value="dialogue">角色對話</option><option value="narration">第三人稱旁白</option><option value="marquee">開場跑馬燈</option><option value="chapter">大章節字卡</option><option value="cg">CG 全圖</option><option value="battle">進入戰鬥提示</option></select>{segment.presentation==='marquee'&&<select value={segment.textDirection??'ltr'} onChange={event=>patch({textDirection:event.target.value as StorySegment['textDirection']})}><option value="ltr">左至右</option><option value="ttb">上至下</option><option value="btt">下至上</option><option value="rtl">右至左</option></select>}{segment.presentation==='cg'&&<><input value={segment.cgKey??''} placeholder="CG 圖片鍵值／網址" onChange={event=>patch({cgKey:event.target.value})}/><label>起點 X {segment.cgPositionX??50}%<input type="range" min="0" max="100" value={segment.cgPositionX??50} onChange={event=>patch({cgPositionX:Number(event.target.value)})}/></label><label>起點 Y {segment.cgPositionY??50}%<input type="range" min="0" max="100" value={segment.cgPositionY??50} onChange={event=>patch({cgPositionY:Number(event.target.value)})}/></label><label>終點 X {segment.cgEndPositionX??segment.cgPositionX??50}%<input type="range" min="0" max="100" value={segment.cgEndPositionX??segment.cgPositionX??50} onChange={event=>patch({cgEndPositionX:Number(event.target.value)})}/></label><label>終點 Y {segment.cgEndPositionY??segment.cgPositionY??50}%<input type="range" min="0" max="100" value={segment.cgEndPositionY??segment.cgPositionY??50} onChange={event=>patch({cgEndPositionY:Number(event.target.value)})}/></label><label>運鏡秒數 {segment.cgDuration??6}s<input type="range" min="2" max="20" value={segment.cgDuration??6} onChange={event=>patch({cgDuration:Number(event.target.value)})}/></label></>}{(segment.presentation??'dialogue')==='dialogue'&&<><label>講話立繪 {segment.portraitActiveScale??100}%<input type="range" min="90" max="130" value={segment.portraitActiveScale??100} onChange={event=>patch({portraitActiveScale:Number(event.target.value)})}/></label><label>待機立繪 {segment.portraitInactiveScale??88}%<input type="range" min="70" max="100" value={segment.portraitInactiveScale??88} onChange={event=>patch({portraitInactiveScale:Number(event.target.value)})}/></label><label>待機亮度 {segment.portraitInactiveOpacity??45}%<input type="range" min="20" max="90" value={segment.portraitInactiveOpacity??45} onChange={event=>patch({portraitInactiveOpacity:Number(event.target.value)})}/></label></>}</div>
    <div className="story-node-controls"><select value={segment.boardCharacter ?? ''} onChange={event => { const value = event.target.value; const pieceId = pieceIdFromRef(value); const character = pieceId ? characters.find(item => item.id === pieceId) : boardCharacters.find(item => item.id === value); patch({ boardCharacter: value || undefined, speaker: character?.name ?? segment.speaker, pose: 'front' }) }}><option value="">無大頭貼</option><optgroup label="看板角色">{boardCharacters.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}</optgroup><optgroup label="所有棋子">{characters.map(character => <option key={character.id} value={`piece:${character.id}`}>{character.name}</option>)}</optgroup></select>
      <select value={segment.side} onChange={event => patch({ side: event.target.value as 'left' | 'right' })}><option value="left">左側發言</option><option value="right">右側發言</option></select>
      <select value={segment.pose ?? 'front'} onChange={event => patch({ pose: event.target.value as 'front' | 'side' })}><option value="front">正面</option><option value="side">側面</option></select></div>
  </div>
}

function BranchCard({ node, boardCharacters, depth, onChange }: { node: Extract<StoryFlowNode, { type: 'branch' }>; boardCharacters: BoardCharacter[]; depth: number; onChange: (node: Extract<StoryFlowNode, { type: 'branch' }>) => void }) {
  const characters = getChars()
  const [collapsedRoutes,setCollapsedRoutes]=useState<Set<string>>(()=>new Set())
  const toggleRoute=(id:string)=>setCollapsedRoutes(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next})
  const portraits = node.choicePortraits ?? [
    ...(node.leftCharacter ? [{ id: uid('choice_portrait'), character: node.leftCharacter, side: 'left' as const, visible: true }] : []),
    ...(node.rightCharacter ? [{ id: uid('choice_portrait'), character: node.rightCharacter, side: 'right' as const, visible: true }] : []),
  ]
  const patchPortrait = (id: string, value: Partial<(typeof portraits)[number]>) => onChange({ ...node, choicePortraits: portraits.map(item => item.id === id ? { ...item, ...value } : item) })
  const PortraitOptions = () => <><option value="">請選擇角色</option><optgroup label="看板角色">{boardCharacters.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}</optgroup><optgroup label="所有棋子">{characters.map(character => <option key={character.id} value={`piece:${character.id}`}>{character.name}</option>)}</optgroup></>
  return <div className={`story-branch-editor${depth === 0 ? ' root-parallel-routes' : ''}`}>
    <div className="story-branch-display-settings">
      <div className="story-choice-settings-title"><b>⚙ 選擇畫面設定</b><small>玩家看到「{node.title}」選項時的畫面</small></div>
      <div className="story-choice-mode-select"><button className={!node.chapterRouteSelect?'active':''} onClick={()=>onChange({...node,chapterRouteSelect:false})}><b>一般選項</b><small>中央按鈕清單</small></button><button className={node.chapterRouteSelect?'active':''} onClick={()=>onChange({...node,chapterRouteSelect:true})}><b>全圖路線面板</b><small>每個選項使用大型圖片</small></button></div>
      {node.chapterRouteSelect?<input value={node.routeSelectSubtitle??''} placeholder="路線選擇頁說明文字" onChange={event=>onChange({...node,routeSelectSubtitle:event.target.value})}/>:<><div className="story-choice-display-mode"><label><input type="radio" name={`portrait_${node.id}`} checked={!node.showPortraits} onChange={() => onChange({ ...node, showPortraits: false })} /> 不顯示立繪</label><label><input type="radio" name={`portrait_${node.id}`} checked={node.showPortraits ?? false} onChange={() => onChange({ ...node, showPortraits: true })} /> 顯示立繪</label></div>{node.showPortraits && <div className="story-choice-portrait-list">{portraits.map((portrait,index) => <div className="story-choice-portrait-row" key={portrait.id}><i>{index + 1}</i><select value={portrait.character ?? ''} onChange={event => patchPortrait(portrait.id, { character: event.target.value || undefined })}><PortraitOptions /></select><select value={portrait.side} onChange={event => patchPortrait(portrait.id, { side: event.target.value as 'left'|'right' })}><option value="left">左側</option><option value="right">右側</option></select><label><input type="checkbox" checked={portrait.visible} onChange={event => patchPortrait(portrait.id, { visible: event.target.checked })} /> 顯示</label><button onClick={() => onChange({ ...node, choicePortraits: portraits.filter(item => item.id !== portrait.id) })}>×</button></div>)}<button className="story-choice-add-portrait" onClick={() => onChange({ ...node, choicePortraits: [...portraits, { id: uid('choice_portrait'), side: portraits.filter(item=>item.side==='left').length<=portraits.filter(item=>item.side==='right').length?'left':'right', visible: true }] })}>＋ 新增立繪</button></div>}</>}
    </div>
    <label className="story-branch-question-label">選擇題目<input className="story-branch-title" value={node.title} onChange={event => onChange({ ...node, title: event.target.value })} /></label>
    <div className="story-branch-routes">{node.branches.map((route, routeIndex) => <div className="story-route-lane" key={route.id}>
      <div className="story-route-head"><button className="story-route-collapse" title={collapsedRoutes.has(route.id)?'展開分支':'收縮分支'} onClick={()=>toggleRoute(route.id)}>{collapsedRoutes.has(route.id)?'▸':'▾'}</button><i style={{ '--route-index': routeIndex } as React.CSSProperties} /><input value={route.label} onChange={event => onChange({ ...node, branches: node.branches.map(item => item.id === route.id ? { ...item, label: event.target.value } : item) })} /><button disabled={node.branches.length <= 2} onClick={() => onChange({ ...node, branches: node.branches.filter(item => item.id !== route.id) })}>×</button></div>
      {!collapsedRoutes.has(route.id)&&<>
      {node.chapterRouteSelect&&<div className="story-route-cover-settings"><RouteCoverUpload storageKey={route.coverKey||`cb_story_route_${route.id}`} onChange={coverKey=>onChange({...node,branches:node.branches.map(item=>item.id===route.id?{...item,coverKey}:item)})}/><input value={route.coverKey??''} placeholder="或輸入封面圖片鍵值／網址" onChange={event=>onChange({...node,branches:node.branches.map(item=>item.id===route.id?{...item,coverKey:event.target.value}:item)})}/><input value={route.description??''} placeholder="路線說明" onChange={event=>onChange({...node,branches:node.branches.map(item=>item.id===route.id?{...item,description:event.target.value}:item)})}/><input value={route.progressText??''} placeholder="進度文字，例如 0／7 關" onChange={event=>onChange({...node,branches:node.branches.map(item=>item.id===route.id?{...item,progressText:event.target.value}:item)})}/></div>}
      <FlowLane laneId={route.id} label={`分支：${route.label}`} nodes={route.nodes} depth={depth + 1} boardCharacters={boardCharacters} onChange={routeNodes => onChange({ ...node, branches: node.branches.map(item => item.id === route.id ? { ...item, nodes: routeNodes } : item) })} />
      </>}
    </div>)}</div>
    <button className="story-add-route" onClick={() => onChange({ ...node, branches: [...node.branches, { id: uid('route'), label: `選項 ${node.branches.length + 1}`, nodes: [] }] })}>＋ 新增選項路線</button>
  </div>
}

function RouteCoverUpload({storageKey,onChange}:{storageKey:string;onChange:(key:string)=>void}){
 const uploadKey=/^https?:/.test(storageKey)?decodeURIComponent(storageKey.split('/').pop()?.split('?')[0].replace(/\.webp$/,'')||`cb_story_route_${Date.now()}`):storageKey
 const[url,setUrl]=useState(()=>/^https?:/.test(storageKey)?storageKey:getUrlByKey(storageKey)),[busy,setBusy]=useState(false)
 const upload=(event:React.ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();setBusy(true);reader.onload=async()=>{try{const cloudUrl=await uploadByKey(uploadKey,String(reader.result));onChange(cloudUrl);setUrl(cloudUrl)}finally{setBusy(false)}};reader.readAsDataURL(file);event.target.value=''}
 return <div className="story-route-cover-upload">{url?<img src={url} alt="路線選擇 CG"/>:<span>尚未設定路線 CG</span>}<label>{busy?'上傳中…':'上傳選擇 CG'}<input hidden disabled={busy} type="file" accept="image/*" onChange={upload}/></label></div>
}

function RewardCard({ rewards, onChange }: { rewards: StoryRewards; onChange: (rewards: StoryRewards) => void }) {
  const characters = getChars()
  const numeric = ([['gems', '鑽石'], ['coins', '金幣'], ['silver', '銀'], ['copper', '銅'], ['iron', '鐵'], ['wood', '木']] as const)
  return <section className="story-reward-node">
    <div className="story-reward-link">↓ 完成章節</div>
    <article className="story-designer-card reward"><div className="story-card-top"><i>★</i><b>首次通關獎勵</b></div>
      <div className="story-reward-editor"><label>角色<select value={rewards.characterId ?? ''} onChange={event => onChange({ ...rewards, characterId: event.target.value || undefined })}><option value="">不贈送角色</option>{characters.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}</select></label>
        <div>{numeric.map(([key, label]) => <label key={key}><span>{label}</span><input type="number" min="0" value={rewards[key] ?? 0} onChange={event => onChange({ ...rewards, [key]: Math.max(0, Math.floor(Number(event.target.value) || 0)) })} /></label>)}</div>
        <small>每個帳號只能領取一次；重複角色會轉成 10 個碎片。</small>
      </div>
    </article>
  </section>
}
