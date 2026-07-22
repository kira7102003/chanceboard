import { useEffect, useRef, useState } from 'react'
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
  const canvasRef = useRef<HTMLElement>(null)
  const scrollKey = `cb_story_designer_scroll_v2_${chapter.id}`
  const change = (next: StoryFlowNode[]) => { setFlow(next); setSaved(false) }
  const revealNode = (id:string) => requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const target=canvasRef.current?.querySelector<HTMLElement>(`[data-editor-node-id="${CSS.escape(id)}"]`)
    target?.scrollIntoView({behavior:'smooth',block:'center',inline:'center'})
    target?.classList.add('just-added');window.setTimeout(()=>target?.classList.remove('just-added'),1800)
  }))
  const append = (node:StoryFlowNode) => { change([...flow,node]); revealNode(node.id) }
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
      <ChapterRouteSettings nodes={flow} onChange={change}/>
      <FlowGraphOverview nodes={flow} onChange={change} onLocate={revealNode} />
      <FlowLane nodes={flow} onChange={change} boardCharacters={boardCharacters} depth={0} label="章節開始" laneId="root" />
      <RewardCard rewards={rewards} onChange={next => { setRewards(next); setSaved(false) }} />
      {!flow.length && <div className="story-designer-empty">尚無節點，請從右上角新增第一段對話。</div>}
    </main>
    {previewWindow && !previewWindow.closed && createPortal(previewRoute?<StoryRoutePicker chapter={chapter} node={previewRoute} onBack={()=>previewWindow.close()} onChoose={route=>{setPreviewNodes((previewNodes??flow).flatMap(node=>node.id===previewRoute.id?route.nodes:[node]));setPreviewRoute(null)}}/>:<StoryPlayer chapter={chapter} initialNodes={previewNodes??flow} onLeave={() => previewWindow.close()} preview />, previewWindow.document.body)}
  </div>
}

function ChapterRouteSettings({nodes,onChange}:{nodes:StoryFlowNode[];onChange:(nodes:StoryFlowNode[])=>void}){
 const index=nodes.findIndex(node=>node.type==='branch'&&node.chapterRouteSelect)
 if(index<0)return <section className="story-route-mode-empty"><b>章節入口畫面</b><p>目前沒有設定。按上方「＋ 路線入口」即可建立雙圖片路線選擇模式。</p></section>
 const node=nodes[index] as Extract<StoryFlowNode,{type:'branch'}>
 const patch=(value:Partial<typeof node>)=>onChange(nodes.map((item,i)=>i===index?{...node,...value}:item))
 const patchRoute=(id:string,value:Partial<(typeof node.branches)[number]>)=>patch({branches:node.branches.map(route=>route.id===id?{...route,...value}:route)})
 return <section className="story-route-mode-settings"><header><div><small>CHAPTER ENTRY MODE</small><b>章節入口・雙圖片路線選擇</b></div><label>畫面標題<input value={node.title} onChange={event=>patch({title:event.target.value})}/></label><label>說明<input value={node.routeSelectSubtitle??''} onChange={event=>patch({routeSelectSubtitle:event.target.value})}/></label></header><div>{node.branches.map(route=><article key={route.id}><RouteCoverUpload storageKey={route.coverKey||`cb_story_route_${route.id}`} onChange={coverKey=>patchRoute(route.id,{coverKey})}/><label>路線名稱<input value={route.label} onChange={event=>patchRoute(route.id,{label:event.target.value})}/></label><label>路線說明<input value={route.description??''} onChange={event=>patchRoute(route.id,{description:event.target.value})}/></label><label>進度文字<input value={route.progressText??''} onChange={event=>patchRoute(route.id,{progressText:event.target.value})}/></label></article>)}</div></section>
}

function FlowGraphOverview({nodes,onChange,onLocate}:{nodes:StoryFlowNode[];onChange:(nodes:StoryFlowNode[])=>void;onLocate:(id:string)=>void}){
  const label=(node:StoryFlowNode)=>node.type==='branch'?node.title:(node.segment.section||node.segment.text.slice(0,18)||'空白節點')
  const kind=(node:StoryFlowNode)=>node.type==='branch'?'選擇':node.segment.presentation==='cg'?'CG':node.segment.presentation==='chapter'?'章節':node.segment.presentation==='battle'?'戰鬥':'劇情'
  const Sequence=({items,setItems}:{items:StoryFlowNode[];setItems:(items:StoryFlowNode[])=>void}):React.ReactNode=><div className="story-graph-sequence">{items.map(node=><div className="story-graph-unit" key={node.id}><article className={`story-graph-node ${node.type}`}><small>{kind(node)}</small>{node.type==='branch'?<><input aria-label="選擇題目" value={node.title} onChange={event=>setItems(items.map(item=>item.id===node.id&&item.type==='branch'?{...item,title:event.target.value}:item))}/><label className="story-graph-entry"><input type="checkbox" checked={node.chapterRouteSelect??false} onChange={event=>setItems(items.map(item=>item.id===node.id&&item.type==='branch'?{...item,chapterRouteSelect:event.target.checked}:item))}/>章節入口頁</label></>:<><input aria-label="節點名稱" value={node.segment.section??''} placeholder={label(node)} onChange={event=>setItems(items.map(item=>item.id===node.id&&item.type==='common'?{...item,segment:{...item.segment,section:event.target.value}}:item))}/><textarea aria-label="節點文字" value={node.segment.text} onChange={event=>setItems(items.map(item=>item.id===node.id&&item.type==='common'?{...item,segment:{...item.segment,text:event.target.value}}:item))}/></>}<button onClick={()=>onLocate(node.id)}>定位編輯</button>{node.type==='branch'&&<em>{node.branches.length} 條路線</em>}</article>{node.type==='branch'&&<div className="story-graph-branches">{node.branches.map(branch=><div className="story-graph-route" key={branch.id}><input aria-label="路線名稱" value={branch.label} onChange={event=>setItems(items.map(item=>item.id===node.id&&item.type==='branch'?{...item,branches:item.branches.map(route=>route.id===branch.id?{...route,label:event.target.value}:route)}:item))}/><Sequence items={branch.nodes} setItems={routeNodes=>setItems(items.map(item=>item.id===node.id&&item.type==='branch'?{...item,branches:item.branches.map(route=>route.id===branch.id?{...route,nodes:routeNodes}:route)}:item))}/></div>)}</div>}</div>)}</div>
  return <details className="story-graph-overview" open><summary><span>FLOW MAP</span><b>章節流程圖（可直接修改）</b><small>修改後會同步到下方卡片</small></summary><div className="story-graph-stage"><article className="story-graph-start"><small>START</small><b>章節開始</b></article><Sequence items={nodes} setItems={onChange}/></div></details>
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
  const portraits = node.choicePortraits ?? [
    ...(node.leftCharacter ? [{ id: uid('choice_portrait'), character: node.leftCharacter, side: 'left' as const, visible: true }] : []),
    ...(node.rightCharacter ? [{ id: uid('choice_portrait'), character: node.rightCharacter, side: 'right' as const, visible: true }] : []),
  ]
  const patchPortrait = (id: string, value: Partial<(typeof portraits)[number]>) => onChange({ ...node, choicePortraits: portraits.map(item => item.id === id ? { ...item, ...value } : item) })
  const PortraitOptions = () => <><option value="">請選擇角色</option><optgroup label="看板角色">{boardCharacters.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}</optgroup><optgroup label="所有棋子">{characters.map(character => <option key={character.id} value={`piece:${character.id}`}>{character.name}</option>)}</optgroup></>
  return <div className={`story-branch-editor${depth === 0 ? ' root-parallel-routes' : ''}`}>
    <div className="story-branch-display-settings">
      <div className="story-choice-settings-title"><b>⚙ 選擇畫面設定</b><small>玩家看到「{node.title}」選項時的畫面</small></div>
      <label className="story-route-entry-toggle"><input type="checkbox" checked={node.chapterRouteSelect??false} onChange={event=>onChange({...node,chapterRouteSelect:event.target.checked})}/> 作為章節進入後的全畫面路線選擇</label>
      {node.chapterRouteSelect&&<input value={node.routeSelectSubtitle??''} placeholder="路線選擇頁說明文字" onChange={event=>onChange({...node,routeSelectSubtitle:event.target.value})}/>} 
      <div className="story-choice-display-mode"><label><input type="radio" name={`portrait_${node.id}`} checked={!node.showPortraits} onChange={() => onChange({ ...node, showPortraits: false })} /> 不顯示立繪</label><label><input type="radio" name={`portrait_${node.id}`} checked={node.showPortraits ?? false} onChange={() => onChange({ ...node, showPortraits: true })} /> 顯示立繪</label></div>
      {node.showPortraits && <div className="story-choice-portrait-list">{portraits.map((portrait,index) => <div className="story-choice-portrait-row" key={portrait.id}><i>{index + 1}</i><select value={portrait.character ?? ''} onChange={event => patchPortrait(portrait.id, { character: event.target.value || undefined })}><PortraitOptions /></select><select value={portrait.side} onChange={event => patchPortrait(portrait.id, { side: event.target.value as 'left'|'right' })}><option value="left">左側</option><option value="right">右側</option></select><label><input type="checkbox" checked={portrait.visible} onChange={event => patchPortrait(portrait.id, { visible: event.target.checked })} /> 顯示</label><button onClick={() => onChange({ ...node, choicePortraits: portraits.filter(item => item.id !== portrait.id) })}>×</button></div>)}<button className="story-choice-add-portrait" onClick={() => onChange({ ...node, choicePortraits: [...portraits, { id: uid('choice_portrait'), side: portraits.filter(item=>item.side==='left').length<=portraits.filter(item=>item.side==='right').length?'left':'right', visible: true }] })}>＋ 新增立繪</button></div>}
    </div>
    <label className="story-branch-question-label">選擇題目<input className="story-branch-title" value={node.title} onChange={event => onChange({ ...node, title: event.target.value })} /></label>
    <div className="story-branch-routes">{node.branches.map((route, routeIndex) => <div className="story-route-lane" key={route.id}>
      <div className="story-route-head"><i style={{ '--route-index': routeIndex } as React.CSSProperties} /><input value={route.label} onChange={event => onChange({ ...node, branches: node.branches.map(item => item.id === route.id ? { ...item, label: event.target.value } : item) })} /><button disabled={node.branches.length <= 2} onClick={() => onChange({ ...node, branches: node.branches.filter(item => item.id !== route.id) })}>×</button></div>
      {node.chapterRouteSelect&&<div className="story-route-cover-settings"><RouteCoverUpload storageKey={route.coverKey||`cb_story_route_${route.id}`} onChange={coverKey=>onChange({...node,branches:node.branches.map(item=>item.id===route.id?{...item,coverKey}:item)})}/><input value={route.coverKey??''} placeholder="或輸入封面圖片鍵值／網址" onChange={event=>onChange({...node,branches:node.branches.map(item=>item.id===route.id?{...item,coverKey:event.target.value}:item)})}/><input value={route.description??''} placeholder="路線說明" onChange={event=>onChange({...node,branches:node.branches.map(item=>item.id===route.id?{...item,description:event.target.value}:item)})}/><input value={route.progressText??''} placeholder="進度文字，例如 0／7 關" onChange={event=>onChange({...node,branches:node.branches.map(item=>item.id===route.id?{...item,progressText:event.target.value}:item)})}/></div>}
      <FlowLane laneId={route.id} label={`分支：${route.label}`} nodes={route.nodes} depth={depth + 1} boardCharacters={boardCharacters} onChange={routeNodes => onChange({ ...node, branches: node.branches.map(item => item.id === route.id ? { ...item, nodes: routeNodes } : item) })} />
    </div>)}</div>
    <button className="story-add-route" onClick={() => onChange({ ...node, branches: [...node.branches, { id: uid('route'), label: `選項 ${node.branches.length + 1}`, nodes: [] }] })}>＋ 新增選項路線</button>
  </div>
}

function RouteCoverUpload({storageKey,onChange}:{storageKey:string;onChange:(key:string)=>void}){
 const[url,setUrl]=useState(()=>getUrlByKey(storageKey)),[busy,setBusy]=useState(false)
 const upload=(event:React.ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();setBusy(true);reader.onload=async()=>{try{await uploadByKey(storageKey,String(reader.result));onChange(storageKey);setUrl(getUrlByKey(storageKey))}finally{setBusy(false)}};reader.readAsDataURL(file);event.target.value=''}
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
