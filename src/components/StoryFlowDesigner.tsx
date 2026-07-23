import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './StoryFlowDesigner.css'
import './StoryChapterSettings.css'
import './StoryPlaybackV2.css'
import { getCharImg, getChars, getUrlByKey, uploadByKey, removeByKey } from '../utils/charStore'
import { getBattleBackgroundNames, type BoardCharacter } from '../utils/boardCharacters'
import { applyStoryFlowLinks, getChapterFlow, getStoryChapters, type StoryChapter, type StoryFlowNode, type StoryRewards, type StorySegment } from '../utils/storyStore'
import StoryPlayer from './StoryPlayer'
import StoryMode from './StoryMode'

interface Props {
  chapter: StoryChapter
  boardCharacters: BoardCharacter[]
  onSave: (flow: StoryFlowNode[], rewards: StoryRewards) => void
  onChapterChange: (patch: Partial<StoryChapter>) => void
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
const duplicateFlowNode=(nodes:StoryFlowNode[],id:string):StoryFlowNode[]=>{
  const index=nodes.findIndex(node=>node.id===id)
  if(index>=0){const next=[...nodes];next.splice(index+1,0,cloneNode(nodes[index]));return next}
  return nodes.map(node=>node.type==='branch'?{...node,branches:node.branches.map(route=>({...route,nodes:duplicateFlowNode(route.nodes,id)}))}:node)
}
const pieceIdFromRef = (value?: string) => value?.startsWith('piece:') ? value.slice(6) : null
const previewFromNode=(nodes:StoryFlowNode[],id?:string):StoryFlowNode[]|null=>{if(!id)return nodes;const index=nodes.findIndex(node=>node.id===id);if(index>=0)return nodes.slice(index);for(const node of nodes)if(node.type==='branch')for(const route of node.branches){const found=previewFromNode(route.nodes,id);if(found)return found}return null}
const findPreviewNode=(nodes:StoryFlowNode[],id?:string):StoryFlowNode|undefined=>{for(const node of nodes){if(node.id===id)return node;if(node.type==='branch')for(const route of node.branches){const found=findPreviewNode(route.nodes,id);if(found)return found}}}
const reconnectFlowNodes=(nodes:StoryFlowNode[],sourceId:string,targetId:string,linkLabel?:string):StoryFlowNode[]=>nodes.map(node=>node.id===sourceId&&node.type==='common'?{...node,nextNodeId:node.nextNodeId??targetId,nextLinkMode:'manual',nextLinks:(node.nextLinks??[]).some(link=>link.targetId===targetId)?node.nextLinks:[...(node.nextLinks??[]),{id:uid('link'),targetId,label:linkLabel||`連線 ${(node.nextLinks?.length??0)+1}`}]}:node.type==='branch'?{...node,branches:node.branches.map(route=>({...route,nodes:reconnectFlowNodes(route.nodes,sourceId,targetId,linkLabel)}))}:node)
const flattenFlowNodes=(nodes:StoryFlowNode[]):StoryFlowNode[]=>nodes.flatMap(node=>node.type==='branch'?[node,...node.branches.flatMap(route=>flattenFlowNodes(route.nodes))]:[node])
const editFlowLink=(nodes:StoryFlowNode[],sourceId:string,linkId:string,patch:{label?:string;targetId?:string},remove=false):StoryFlowNode[]=>nodes.map(node=>{
  if(node.id===sourceId&&node.type==='common'){
    const links=remove?(node.nextLinks??[]).filter(link=>link.id!==linkId):(node.nextLinks??[]).map(link=>link.id===linkId?{...link,...patch}:link)
    return{...node,nextLinks:links,nextNodeId:links[0]?.targetId,nextLinkMode:links.length?'manual':undefined}
  }
  return node.type==='branch'?{...node,branches:node.branches.map(route=>({...route,nodes:editFlowLink(route.nodes,sourceId,linkId,patch,remove)}))}:node
})
const dedupeFlowLinks=(nodes:StoryFlowNode[]):StoryFlowNode[]=>nodes.map(node=>{if(node.type==='branch')return{...node,branches:node.branches.map(route=>({...route,nodes:dedupeFlowLinks(route.nodes)}))};const seen=new Set<string>(),links=(node.nextLinks??[]).filter(link=>!seen.has(link.targetId)&&!!seen.add(link.targetId));return{...node,nextLinks:links,nextNodeId:links[0]?.targetId??node.nextNodeId}})
const addAutomaticFlowLinks=(nodes:StoryFlowNode[]):StoryFlowNode[]=>nodes.map((node,index)=>node.type==='branch'?{...node,branches:node.branches.map(route=>({...route,nodes:addAutomaticFlowLinks(route.nodes)}))}:node.nextLinkMode==='manual'?node:{...node,nextNodeId:nodes[index+1]?.id,nextLinkMode:'auto'})

export default function StoryFlowDesigner({ chapter, boardCharacters, onSave, onChapterChange, onClose }: Props) {
  const [flow, setFlow] = useState(() => addAutomaticFlowLinks(dedupeFlowLinks(getChapterFlow(chapter))))
  const [rewards, setRewards] = useState<StoryRewards>(chapter.rewards ?? {})
  const [previewWindow, setPreviewWindow] = useState<Window | null>(null)
  const [previewStartId,setPreviewStartId]=useState<string|undefined>(undefined)
  const [mapOpen,setMapOpen]=useState(true)
  const [detailsVisible,setDetailsVisible]=useState(true)
  const canvasRef = useRef<HTMLElement>(null)
  const scrollKey = `cb_story_designer_scroll_v2_${chapter.id}`
  const previewStartNode=findPreviewNode(flow,previewStartId)
  const change = (next: StoryFlowNode[]) => { const linked=addAutomaticFlowLinks(next);setFlow(linked);onSave(linked,rewards) }
  // FLOW MAP and the detail editor are two views of the same chapter model.
  // Reconcile cloud/parent updates back into the local editor immediately, while
  // avoiding a state replacement when the current edit already matches.
  useEffect(()=>{
    const incoming=addAutomaticFlowLinks(dedupeFlowLinks(getChapterFlow(chapter)))
    setFlow(current=>JSON.stringify(current)===JSON.stringify(incoming)?current:incoming)
  },[chapter.id,chapter.flow])
  useEffect(()=>{
    const incoming=chapter.rewards??{}
    setRewards(current=>JSON.stringify(current)===JSON.stringify(incoming)?current:incoming)
  },[chapter.id,chapter.rewards])
  useEffect(()=>{const valid=new Set(['__route_picker__','__world_map__','__map_chapter__','__chapter_card__',...flattenFlowNodes(flow).map(node=>node.id)]),seenGraph=new Set<string>(),graph=(chapter.flowGraphLinks??[]).filter(link=>valid.has(link.sourceId)&&valid.has(link.targetId)&&!seenGraph.has(`${link.sourceId}>${link.targetId}`)&&!!seenGraph.add(`${link.sourceId}>${link.targetId}`)),seenCard=new Set<string>(),card=(chapter.chapterCardNextLinks??[]).filter(link=>valid.has(link.targetId)&&!seenCard.has(link.targetId)&&!!seenCard.add(link.targetId));if(graph.length!==(chapter.flowGraphLinks?.length??0)||card.length!==(chapter.chapterCardNextLinks?.length??0))onChapterChange({flowGraphLinks:graph,chapterCardNextLinks:card,chapterCardNextNodeId:card[0]?.targetId})},[chapter.id])
  useEffect(()=>{if(JSON.stringify(flow)!==JSON.stringify(getChapterFlow(chapter)))onSave(flow,rewards)},[])
  const revealNode = (id:string) => {setPreviewStartId(id);requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const target=canvasRef.current?.querySelector<HTMLElement>(`[data-editor-node-id="${CSS.escape(id)}"]`)
    target?.scrollIntoView({behavior:'smooth',block:'center',inline:'center'})
    target?.classList.add('just-added');window.setTimeout(()=>target?.classList.remove('just-added'),1800)
  }))}
  const append = (node:StoryFlowNode) => { change([...flow,node]); revealNode(node.id) }
  const returnToMap=()=>{const canvas=canvasRef.current,map=canvas?.querySelector<HTMLElement>('.story-graph-overview');if(canvas&&map){setMapOpen(true);requestAnimationFrame(()=>{canvas.scrollTo({top:Math.max(0,map.offsetTop-12),left:0,behavior:'smooth'})})}}
  const openPreview = (startId = previewStartId) => {
    setPreviewStartId(startId)
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
    setPreviewWindow(popup)
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
      <div className="story-add-toolbar"><button className="route-entry" onClick={() => openPreview(undefined)}>↗ 完整流程預覽</button><button onClick={() => openPreview()} disabled={!previewStartId}>↗ 選取節點預覽</button><button className="route-entry" onClick={() => append(makeRouteSelect())}>＋ 路線入口</button><button onClick={() => append(makeCommon(boardCharacters[0]))}>＋ 對話</button><button onClick={() => append(makeBranch())}>＋ 分支</button><button onClick={() => append(makePresentation('narration'))}>＋ 旁白</button><button onClick={() => append(makePresentation('marquee'))}>＋ 跑馬燈</button><button onClick={() => append(makePresentation('chapter'))}>＋ 章節</button><button onClick={() => append(makePresentation('cg'))}>＋ CG</button><button onClick={() => append(makePresentation('battle'))}>＋ 戰鬥</button><button className="primary" disabled>☁ 編輯即自動儲存</button></div>
    </header>
    <div className="story-designer-sub"><b>劇情工作區</b><span>拖曳卡片調整位置</span><span>黃點接到藍點建立流程</span><span>點「修改細節」前往下方編輯</span><span>☁ 所有變更自動儲存</span></div>
    <nav className="story-designer-palette">
      <button className="reward" onClick={() => document.querySelector('#story-chapter-opening-settings .story-chapter-rewards')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><i>★</i><span>故事獎勵</span></button>
      {boardCharacters.map((character, index) => { const showIcon = index < 2; const image = showIcon ? getUrlByKey(`cb_board_${character.id}_front`) : null; return <button key={character.id} onClick={() => append(makeCommon(character))}><i>{image ? <img src={image} alt="" /> : showIcon ? character.name.slice(0, 1) : null}</i><span>{character.name}</span></button> })}
    </nav>
    <main className="story-designer-canvas" ref={canvasRef} onClick={event=>{const card=(event.target as HTMLElement).closest<HTMLElement>('[data-editor-node-id]');if(!card)return;setPreviewStartId(card.dataset.editorNodeId);canvasRef.current?.querySelectorAll('.preview-selected').forEach(item=>item.classList.remove('preview-selected'));card.classList.add('preview-selected')}}>
      <FlowGraphOverview chapter={chapter} nodes={flow} onChange={change} onChapterChange={onChapterChange} onLocate={revealNode} open={mapOpen} onOpenChange={setMapOpen}/>
      {detailsVisible&&<><ChapterSettingsCard chapter={chapter} rewards={rewards} onChapterChange={onChapterChange} onRewardsChange={next=>{setRewards(next);onSave(flow,next)}}/><FlowLane nodes={applyStoryFlowLinks(flow)} onChange={change} boardCharacters={boardCharacters} depth={0} label="章節流程（與上方連線同步）" laneId="root" /></>}
      {!flow.length && <div className="story-designer-empty">尚無節點，請從右上角新增第一段對話。</div>}
    </main>
    <aside className="story-designer-anchor-tools"><button onClick={returnToMap}>↑ 回流程圖</button><button onClick={()=>setMapOpen(value=>!value)}>{mapOpen?'收縮 MAP':'展開 MAP'}</button><button onClick={()=>setDetailsVisible(value=>!value)}>{detailsVisible?'隱藏細節':'顯示細節'}</button></aside>
    {previewWindow && !previewWindow.closed && createPortal((!previewStartId||previewStartNode?.type==='branch'&&previewStartNode.chapterRouteSelect)?<StoryMode onClose={()=>previewWindow.close()} preview previewChapters={getStoryChapters().map(item=>item.id===chapter.id?{...chapter,flow,rewards}:item)}/>:<StoryPlayer key={previewStartId} chapter={{...chapter,rewards}} initialNodes={previewFromNode(flow,previewStartId)??flow} onLeave={()=>previewWindow.close()} preview />, previewWindow.document.body)}
  </div>
}

function ChapterSettingsCard({chapter,rewards,onChapterChange,onRewardsChange}:{chapter:StoryChapter;rewards:StoryRewards;onChapterChange:(patch:Partial<StoryChapter>)=>void;onRewardsChange:(rewards:StoryRewards)=>void}){
  const characters=getChars(),backgrounds=getBattleBackgroundNames()
  const mapNumber=(key:'mapX'|'mapY'|'mapNodeScale',value:number)=>onChapterChange({[key]:value})
  return <section id="story-chapter-opening-settings" className="story-chapter-settings story-reward-node">
    <div className="story-flow-lane-label">章節開場卡節點｜點完地圖後播放</div>
    <div className="story-chapter-settings-grid">
      <label><span>章節標題</span><input value={chapter.title} onChange={e=>onChapterChange({title:e.target.value})}/></label><label><span>章節副標</span><input value={chapter.subtitle} onChange={e=>onChapterChange({subtitle:e.target.value})}/></label>
      <label><span>地圖節點章節標籤</span><input value={chapter.mapNodeLabel??`第 ${chapter.order} 章`} onChange={e=>onChapterChange({mapNodeLabel:e.target.value})}/></label><label><span>地圖節點短標題</span><input value={chapter.mapNodeTitle??chapter.title} onChange={e=>onChapterChange({mapNodeTitle:e.target.value})}/></label><label><span>地圖節點棋子符號</span><input value={chapter.mapNodeSymbol??chapter.piece} onChange={e=>onChapterChange({mapNodeSymbol:e.target.value})}/></label>
      <label><span>地圖位置 X%</span><input type="number" min="0" max="100" value={chapter.mapX??10} onChange={e=>mapNumber('mapX',Math.max(0,Math.min(100,+e.target.value)))}/></label><label><span>地圖位置 Y%</span><input type="number" min="0" max="100" value={chapter.mapY??68} onChange={e=>mapNumber('mapY',Math.max(0,Math.min(100,+e.target.value)))}/></label><label><span>地圖節點尺寸 %</span><input type="number" min="60" max="180" value={chapter.mapNodeScale??100} onChange={e=>mapNumber('mapNodeScale',Math.max(60,Math.min(180,+e.target.value)))}/></label>
      <label className="check"><input type="checkbox" checked={chapter.chapterCardEnabled!==false} onChange={e=>onChapterChange({chapterCardEnabled:e.target.checked})}/><span>顯示開場章節卡</span></label><label><span>章節卡上方標籤</span><input value={chapter.chapterCardEyebrow??'CHAPTER'} onChange={e=>onChapterChange({chapterCardEyebrow:e.target.value})}/></label><label><span>章節卡大標題</span><input value={chapter.chapterCardTitle??`第${chapter.order}章　${chapter.piece}`} onChange={e=>onChapterChange({chapterCardTitle:e.target.value})}/></label><label><span>章節卡點擊提示</span><input value={chapter.chapterCardPrompt??'點擊任意位置開始 ◆'} onChange={e=>onChapterChange({chapterCardPrompt:e.target.value})}/></label><label><span>章節卡顯示效果</span><select value={chapter.chapterCardEffect??'writing'} onChange={e=>onChapterChange({chapterCardEffect:e.target.value as StoryChapter['chapterCardEffect']})}><option value="writing">書寫・逐字出現</option><option value="reading">閱讀・展開整頁</option><option value="fade">淡入・完整標題</option></select></label>
      <label className="check"><input type="checkbox" checked={chapter.unlocked} onChange={e=>onChapterChange({unlocked:e.target.checked})}/><span>開放章節</span></label><label><span>故事背景</span><select value={chapter.backgroundKey??''} onChange={e=>onChapterChange({backgroundKey:e.target.value||undefined})}><option value="">章節預設背景</option>{backgrounds.map((name,index)=><option value={`cb_bg_battle_${index+1}`} key={index}>{name}</option>)}</select></label>
    </div>
    <div className="story-chapter-rewards"><b>章節首次完成獎勵</b><label><span>獎勵角色</span><select value={rewards.characterId??''} onChange={e=>onRewardsChange({...rewards,characterId:e.target.value||undefined})}><option value="">不贈送角色</option>{characters.map(character=><option value={character.id} key={character.id}>{character.name}</option>)}</select></label>{([['gems','鑽石'],['coins','金幣'],['silver','銀'],['copper','銅'],['iron','鐵'],['wood','木']] as const).map(([key,label])=><label key={key}><span>{label}</span><input type="number" min="0" value={rewards[key]??0} onChange={e=>onRewardsChange({...rewards,[key]:Math.max(0,Math.floor(+e.target.value||0))})}/></label>)}</div>
  </section>
}

function FlowGraphOverview({chapter,nodes,onChange,onChapterChange,onLocate,open,onOpenChange}:{chapter:StoryChapter;nodes:StoryFlowNode[];onChange:(nodes:StoryFlowNode[])=>void;onChapterChange:(patch:Partial<StoryChapter>)=>void;onLocate:(id:string)=>void;open:boolean;onOpenChange:(open:boolean)=>void}){
  const stageRef=useRef<HTMLDivElement>(null)
  type DrawnLink={from:string;to:string;color:string;label?:string;path?:string;remove?:{kind:'graph'|'chapter'|'node';id:string;sourceId?:string}}
  const[links,setLinks]=useState<DrawnLink[]>([])
  const[collapseVersion,setCollapseVersion]=useState(0)
  const[linkSource,setLinkSource]=useState<string|null>(null)
  const beginLink=(event:React.PointerEvent<HTMLDivElement>)=>{const card=(event.target as HTMLElement).closest<HTMLElement>('[data-graph-node-id]');if(!card||card.dataset.graphNodeId==='__start__')return;const rect=card.getBoundingClientRect();if(event.clientX<rect.right-30)return;event.preventDefault();event.stopPropagation();setLinkSource(card.dataset.graphNodeId??null);event.currentTarget.setPointerCapture(event.pointerId)}
  const finishLink=(event:React.PointerEvent<HTMLDivElement>)=>{if(!linkSource)return;const target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-graph-node-id]'),rect=target?.getBoundingClientRect();const targetId=target?.dataset.graphNodeId,realNodes=flattenFlowNodes(nodes);if(targetId===linkSource){if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);return}if(targetId&&targetId!=='__start__'&&rect&&event.clientX<=rect.left+36){if(linkSource==='__chapter_card__'&&realNodes.some(node=>node.id===targetId)){const links=chapter.chapterCardNextLinks??[];if(!links.some(link=>link.targetId===targetId))onChapterChange({chapterCardNextNodeId:chapter.chapterCardNextNodeId??targetId,chapterCardNextLinks:[...links,{id:uid('chapter_link'),targetId,label:`連線 ${links.length+1}`}]})}else if(realNodes.some(node=>node.id===linkSource&&node.type==='common')&&realNodes.some(node=>node.id===targetId))onChange(reconnectFlowNodes(nodes,linkSource,targetId));else{const links=chapter.flowGraphLinks??[];if(!links.some(link=>link.sourceId===linkSource&&link.targetId===targetId))onChapterChange({flowGraphLinks:[...links,{id:uid('graph_link'),sourceId:linkSource,targetId,label:`連線 ${links.filter(link=>link.sourceId===linkSource).length+1}`}]})}}setLinkSource(null);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)}
  const dragChapterCard=(event:React.PointerEvent<HTMLElement>)=>{const card=event.currentTarget,rect=card.getBoundingClientRect();if(event.clientX>=rect.right-28||(event.target as HTMLElement).closest('button,input,select,[contenteditable="true"]'))return;event.preventDefault();event.stopPropagation();const startX=event.clientX,startY=event.clientY,originX=chapter.chapterCardEditorX??0,originY=chapter.chapterCardEditorY??0;const move=(next:PointerEvent)=>onChapterChange({chapterCardEditorX:originX+next.clientX-startX,chapterCardEditorY:originY+next.clientY-startY});const end=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',end)}
  useEffect(()=>{const stage=stageRef.current;if(!stage)return;const down=(event:PointerEvent)=>beginLink(event as unknown as React.PointerEvent<HTMLDivElement>),up=(event:PointerEvent)=>finishLink(event as unknown as React.PointerEvent<HTMLDivElement>),cancel=()=>setLinkSource(null);stage.addEventListener('pointerdown',down);stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',cancel);return()=>{stage.removeEventListener('pointerdown',down);stage.removeEventListener('pointerup',up);stage.removeEventListener('pointercancel',cancel)}},[linkSource,nodes])
  useEffect(()=>{const stage=stageRef.current;stage?.querySelectorAll('.link-source-selected').forEach(card=>card.classList.remove('link-source-selected'));if(linkSource)stage?.querySelector<HTMLElement>(`[data-graph-node-id="${CSS.escape(linkSource)}"]`)?.classList.add('link-source-selected')},[linkSource])
  useEffect(()=>{const card=stageRef.current?.querySelector<HTMLElement>('[data-graph-node-id="__chapter_card__"]');if(!card)return;card.style.transform=`translate(${chapter.chapterCardEditorX??0}px,${chapter.chapterCardEditorY??0}px)`;const down=(event:PointerEvent)=>dragChapterCard(event as unknown as React.PointerEvent<HTMLElement>);card.addEventListener('pointerdown',down);return()=>card.removeEventListener('pointerdown',down)},[chapter.chapterCardEditorX,chapter.chapterCardEditorY])
  useEffect(()=>{const cards=[...stageRef.current?.querySelectorAll<HTMLElement>('[data-graph-node-id]:not([data-graph-node-id="__start__"]):not([data-graph-node-id="__chapter_card__"])')??[]],cleanups:CallableFunction[]=[];cards.forEach(card=>{const id=card.dataset.graphNodeId!,position=chapter.flowNodePositions?.[id]??{x:0,y:0};card.style.transform=`translate(${position.x}px,${position.y}px)`;card.classList.add('flow-draggable');const down=(event:PointerEvent)=>{if((event.target as HTMLElement).closest('button,input,select,[contenteditable="true"]')||event.clientX>=card.getBoundingClientRect().right-30)return;event.preventDefault();event.stopPropagation();const startX=event.clientX,startY=event.clientY,origin=chapter.flowNodePositions?.[id]??{x:0,y:0};const move=(next:PointerEvent)=>onChapterChange({flowNodePositions:{...(chapter.flowNodePositions??{}),[id]:{x:origin.x+next.clientX-startX,y:origin.y+next.clientY-startY}}}),up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up)};card.addEventListener('pointerdown',down);cleanups.push(()=>card.removeEventListener('pointerdown',down))});return()=>cleanups.forEach(cleanup=>cleanup())},[chapter.flowNodePositions,nodes])
  useEffect(()=>{const stage=stageRef.current;if(!stage)return;const cleanups:CallableFunction[]=[];flattenFlowNodes(nodes).forEach(node=>{const card=stage.querySelector<HTMLElement>(`[data-graph-node-id="${CSS.escape(node.id)}"]`),actions=card?.querySelector<HTMLElement>('.story-graph-node-head>span');if(!actions||actions.querySelector('.story-graph-copy'))return;const button=document.createElement('button');button.type='button';button.className='story-graph-copy';button.title='複製節點';button.textContent='⧉';const copy=(event:Event)=>{event.preventDefault();event.stopPropagation();onChange(duplicateFlowNode(nodes,node.id))};button.addEventListener('click',copy);actions.prepend(button);cleanups.push(()=>{button.removeEventListener('click',copy);button.remove()})});return()=>cleanups.forEach(cleanup=>cleanup())},[nodes])
  useEffect(()=>{const card=stageRef.current?.querySelector<HTMLElement>('[data-graph-node-id="__chapter_card__"]'),title=card?.querySelector<HTMLElement>(':scope>b'),effect=card?.querySelector<HTMLElement>(':scope>small');if(!title||!effect)return;title.contentEditable='true';title.spellcheck=false;title.title='直接點擊修改章節卡標題';effect.title='雙擊切換顯示效果';const stop=(event:Event)=>event.stopPropagation(),save=()=>onChapterChange({chapterCardTitle:title.textContent?.trim()||undefined}),key=(event:KeyboardEvent)=>{if(event.key==='Enter'){event.preventDefault();title.blur()}},cycle=(event:Event)=>{event.stopPropagation();const current=chapter.chapterCardEffect??'writing',next=current==='writing'?'reading':current==='reading'?'fade':'writing';onChapterChange({chapterCardEffect:next})};title.addEventListener('pointerdown',stop);title.addEventListener('blur',save);title.addEventListener('keydown',key);effect.addEventListener('dblclick',cycle);return()=>{title.removeEventListener('pointerdown',stop);title.removeEventListener('blur',save);title.removeEventListener('keydown',key);effect.removeEventListener('dblclick',cycle)}},[chapter.chapterCardTitle,chapter.chapterCardEffect])
  useEffect(()=>{const stage=stageRef.current;if(!stage)return;const cleanups:CallableFunction[]=[];stage.querySelectorAll<HTMLElement>('.story-graph-node').forEach(card=>{if(!card.querySelector('.story-port-help.input')){const input=document.createElement('span'),output=document.createElement('span');input.className='story-port-help input';output.className='story-port-help output';input.dataset.flowTooltip='輸入連接點｜接收其他節點連線';output.dataset.flowTooltip='輸出連接點｜拖曳到其他節點的藍點';card.append(input,output);cleanups.push(()=>{input.remove();output.remove()})}});stage.querySelectorAll<HTMLButtonElement>('button').forEach(button=>{if(button.dataset.flowTooltip)return;const text=button.textContent?.trim()??'',tooltip=button.title||({"←":'向左移動節點',"→":'向右移動節點',"×":'刪除節點',"⧉":'複製節點'} as Record<string,string>)[text]||(text.startsWith('＋')?`新增${text.slice(1)}`:text);if(tooltip)button.dataset.flowTooltip=tooltip});return()=>cleanups.forEach(cleanup=>cleanup())},[nodes])
  const toggleGraphRoute=(event:React.MouseEvent<HTMLDivElement>)=>{const target=event.target as HTMLElement;if(!target.matches('.story-graph-route>input'))return;event.preventDefault();target.closest('.story-graph-route')?.classList.toggle('collapsed');target.blur();setCollapseVersion(value=>value+1)}
  const label=(node:StoryFlowNode)=>node.type==='branch'?node.title:(node.segment.section||node.segment.text.slice(0,18)||'空白節點')
  const kind=(node:StoryFlowNode)=>node.type==='branch'?'選擇':node.segment.presentation==='cg'?'CG':node.segment.presentation==='chapter'?'章節':node.segment.presentation==='battle'?'戰鬥':'劇情'
  const make=(type:'dialogue'|'branch'|'cg'|'battle')=>type==='dialogue'?makeCommon():type==='branch'?makeBranch():makePresentation(type)
  const allNodes=flattenFlowNodes(nodes),linkedNodes=allNodes.filter((node):node is Extract<StoryFlowNode,{type:'common'}>=>node.type==='common'&&!!node.nextLinks?.length)
  const entryPicker=nodes.find((node):node is Extract<StoryFlowNode,{type:'branch'}>=>node.type==='branch'&&!!node.chapterRouteSelect)
  const rootNodes=entryPicker?nodes.filter(node=>node.id!==entryPicker.id):nodes
  const setRootNodes=(items:StoryFlowNode[])=>{if(!entryPicker){onChange(items);return}const originalIndex=nodes.findIndex(node=>node.id===entryPicker.id),next=[...items];next.splice(Math.max(0,Math.min(originalIndex,next.length)),0,entryPicker);onChange(next)}
  const nodeName=(id:string)=>{const system:Record<string,string>={__route_picker__:'選擇小黑／小白',__world_map__:'候選地圖',__map_chapter__:`地圖關卡｜${chapter.mapNodeTitle??chapter.title}`,__chapter_card__:'章節開場卡'};const found=allNodes.find(node=>node.id===id);return system[id]??(found?label(found):id)}
  const graphLinkList=<section className="story-flow-link-manager always"><h3>{linkSource?`已選來源：${nodeName(linkSource)}｜請點目標卡片左側藍點`:"連線編輯｜點右側黃點，再點目標左側藍點；也可直接拖曳"}</h3>{chapter.flowGraphLinks?.map(link=><div key={link.id}><b>{nodeName(link.sourceId)}</b><input value={link.label} onChange={e=>onChapterChange({flowGraphLinks:chapter.flowGraphLinks?.map(item=>item.id===link.id?{...item,label:e.target.value}:item)})}/><span>→ {nodeName(link.targetId)}</span><button onClick={()=>onChapterChange({flowGraphLinks:chapter.flowGraphLinks?.filter(item=>item.id!==link.id)})}>刪除</button></div>)}{chapter.chapterCardNextLinks?.map(link=><div key={link.id}><b>章節開場卡</b><input value={link.label} onChange={e=>onChapterChange({chapterCardNextLinks:chapter.chapterCardNextLinks?.map(item=>item.id===link.id?{...item,label:e.target.value}:item)})}/><span>→ {nodeName(link.targetId)}</span><button onClick={()=>{const next=chapter.chapterCardNextLinks?.filter(item=>item.id!==link.id)??[];onChapterChange({chapterCardNextLinks:next,chapterCardNextNodeId:next[0]?.targetId})}}>刪除</button></div>)}{linkedNodes.flatMap(source=>source.nextLinks!.map(link=><div key={link.id}><b>{label(source)}</b><input value={link.label} onChange={e=>onChange(editFlowLink(nodes,source.id,link.id,{label:e.target.value}))}/><span>→ {nodeName(link.targetId)}</span><button onClick={()=>onChange(editFlowLink(nodes,source.id,link.id,{},true))}>刪除</button></div>))}{!chapter.flowGraphLinks?.length&&!chapter.chapterCardNextLinks?.length&&!linkedNodes.length&&<p>尚未建立手動連線。拖曳上方卡片右側黃點開始。</p>}</section>
  const removeLink=(link:DrawnLink)=>{
    const graph=(chapter.flowGraphLinks??[]).find(item=>item.sourceId===link.from&&item.targetId===link.to)
    if(graph){onChapterChange({flowGraphLinks:(chapter.flowGraphLinks??[]).filter(item=>item.id!==graph.id)});return}
    if(link.from==='__chapter_card__'){
      const match=(chapter.chapterCardNextLinks??[]).find(item=>item.targetId===link.to)
      if(match){const next=(chapter.chapterCardNextLinks??[]).filter(item=>item.id!==match.id);onChapterChange({chapterCardNextLinks:next,chapterCardNextNodeId:next[0]?.targetId});return}
    }
    const source=allNodes.find(node=>node.id===link.from)
    if(source?.type==='common'){
      const match=source.nextLinks?.find(item=>item.targetId===link.to)
      if(match)onChange(editFlowLink(nodes,source.id,match.id,{},true))
    }
  }
  const canRemoveLink=(link:DrawnLink)=>!!(chapter.flowGraphLinks??[]).some(item=>item.sourceId===link.from&&item.targetId===link.to)||link.from==='__chapter_card__'&&!!(chapter.chapterCardNextLinks??[]).some(item=>item.targetId===link.to)||allNodes.some(node=>node.type==='common'&&node.id===link.from&&node.nextLinks?.some(item=>item.targetId===link.to))
  useLayoutEffect(()=>{
    const stage=stageRef.current;if(!stage)return
    const edges:{from:string;to:string;color:string;label?:string}[]=[]
    chapter.flowGraphLinks?.forEach(link=>edges.push({from:link.sourceId,to:link.targetId,color:'#f3c84d',label:link.label}))
    const walk=(items:StoryFlowNode[])=>{items.forEach((node,index)=>{if(node.type==='common'&&node.nextLinks?.length)node.nextLinks.forEach(link=>edges.push({from:node.id,to:link.targetId,color:'#f3c84d',label:link.label}));else if(node.type==='common'&&node.nextNodeId)edges.push({from:node.id,to:node.nextNodeId,color:node.nextLinkMode==='manual'?'#f3c84d':'#58c8ff',label:node.nextLinkMode==='manual'?'自訂':'自動'});else if(index<items.length-1)edges.push({from:node.id,to:items[index+1].id,color:'#58c8ff',label:'自動'});if(node.type==='branch')node.branches.forEach((route,routeIndex)=>{if(route.nodes[0])edges.push({from:node.id,to:route.nodes[0].id,color:['#65e49a','#6da8ff','#ba83ff','#ff7f9d'][routeIndex%4],label:route.label});walk(route.nodes)})})}
    edges.push({from:'__start__',to:'__world_map__',color:'#ffd45e',label:'點擊故事'});edges.push({from:'__world_map__',to:'__map_chapter__',color:'#ffd45e',label:'選擇地圖點'},{from:'__map_chapter__',to:entryPicker?'__route_picker__':'__chapter_card__',color:'#ffd45e',label:'下一步'});if(entryPicker)entryPicker.branches.forEach(route=>edges.push({from:'__route_picker__',to:'__chapter_card__',color:route.label.includes('白')?'#6da8ff':'#65e49a',label:route.label}));if(chapter.chapterCardNextLinks?.length)chapter.chapterCardNextLinks.forEach(link=>edges.push({from:'__chapter_card__',to:link.targetId,color:'#f3c84d',label:link.label}));else{const chapterTarget=chapter.chapterCardNextNodeId??nodes.find(node=>node.id!==entryPicker?.id)?.id??entryPicker?.branches[0]?.nodes[0]?.id;if(chapterTarget)edges.push({from:'__chapter_card__',to:chapterTarget,color:chapter.chapterCardNextNodeId?'#f3c84d':'#ffd45e',label:chapter.chapterCardNextNodeId?'自訂':'故事開始'})}if(entryPicker)entryPicker.branches.forEach(route=>walk(route.nodes));walk(nodes.filter(node=>node.id!==entryPicker?.id))
    const draw=()=>{const base=stage.getBoundingClientRect();setLinks(edges.map(edge=>{const fromElement=stage.querySelector<HTMLElement>(`[data-graph-node-id="${CSS.escape(edge.from)}"]`),toElement=stage.querySelector<HTMLElement>(`[data-graph-node-id="${CSS.escape(edge.to)}"]`);if(!fromElement?.offsetParent||!toElement?.offsetParent)return{...edge,path:undefined};const from=fromElement.getBoundingClientRect(),to=toElement.getBoundingClientRect(),x1=from.right-base.left+stage.scrollLeft,y1=from.top+from.height/2-base.top+stage.scrollTop,x2=to.left-base.left+stage.scrollLeft,y2=to.top+to.height/2-base.top+stage.scrollTop,curve=Math.max(45,Math.abs(x2-x1)*.42);return{...edge,path:`M ${x1} ${y1} C ${x1+curve} ${y1}, ${x2-curve} ${y2}, ${x2} ${y2}`}}))}
    const frame=requestAnimationFrame(draw),observer=new ResizeObserver(draw);observer.observe(stage);return()=>{cancelAnimationFrame(frame);observer.disconnect()}
  },[nodes,collapseVersion,chapter.chapterCardEditorX,chapter.chapterCardEditorY,chapter.chapterCardNextNodeId,chapter.chapterCardNextLinks,chapter.flowGraphLinks,chapter.flowNodePositions])
  useEffect(()=>{
    const svg=stageRef.current?.querySelector<SVGSVGElement>('.story-graph-svg');if(!svg)return
    const click=(event:MouseEvent)=>{const path=(event.target as Element).closest<SVGPathElement>('path[id^="edge_"]');if(!path)return;const link=links[Number(path.id.slice(5))];if(!link||!canRemoveLink(link))return;event.stopPropagation();if(window.confirm(`移除「${nodeName(link.from)} → ${nodeName(link.to)}」的關聯？`))removeLink(link)}
    svg.addEventListener('click',click);return()=>svg.removeEventListener('click',click)
  },[links,chapter.flowGraphLinks,chapter.chapterCardNextLinks,nodes])
  const Sequence=({items,setItems}:{items:StoryFlowNode[];setItems:(items:StoryFlowNode[])=>void}):React.ReactNode=><div className="story-graph-sequence">{items.map((node,index)=><div className="story-graph-unit" key={node.id}><article data-graph-node-id={node.id} className={`story-graph-node ${node.type}`}><div className="story-graph-node-head"><small>{kind(node)}</small><span><button disabled={index===0} onClick={()=>{const next=[...items];[next[index-1],next[index]]=[next[index],next[index-1]];setItems(next)}}>←</button><button disabled={index===items.length-1} onClick={()=>{const next=[...items];[next[index+1],next[index]]=[next[index],next[index+1]];setItems(next)}}>→</button><button className="delete" onClick={()=>setItems(items.filter(item=>item.id!==node.id))}>×</button></span></div>{node.type==='branch'?<><input aria-label="選擇題目" value={node.title} onChange={event=>setItems(items.map(item=>item.id===node.id&&item.type==='branch'?{...item,title:event.target.value}:item))}/><label className="story-graph-entry"><input type="checkbox" checked={node.chapterRouteSelect??false} onChange={event=>setItems(items.map(item=>item.id===node.id&&item.type==='branch'?{...item,chapterRouteSelect:event.target.checked}:item))}/>章節入口頁</label></>:<b>{label(node)}</b>}<button onClick={()=>onLocate(node.id)}>修改細節</button><div className="story-graph-insert"><button onClick={()=>{const next=[...items];next.splice(index+1,0,make('dialogue'));setItems(next)}}>＋對話</button><button onClick={()=>{const next=[...items];next.splice(index+1,0,make('branch'));setItems(next)}}>＋分支</button><button onClick={()=>{const next=[...items];next.splice(index+1,0,make('cg'));setItems(next)}}>＋CG</button><button onClick={()=>{const next=[...items];next.splice(index+1,0,make('battle'));setItems(next)}}>＋戰鬥</button></div></article>{node.type==='branch'&&<div className="story-graph-branches">{node.branches.map(branch=><div className="story-graph-route" key={branch.id}><input aria-label="路線名稱" value={branch.label} onChange={event=>setItems(items.map(item=>item.id===node.id&&item.type==='branch'?{...item,branches:item.branches.map(route=>route.id===branch.id?{...route,label:event.target.value}:route)}:item))}/><button className="story-graph-remove-route" disabled={node.branches.length<=2} onClick={()=>setItems(items.map(item=>item.id===node.id&&item.type==='branch'?{...item,branches:item.branches.filter(route=>route.id!==branch.id)}:item))}>刪除路線</button><Sequence items={branch.nodes} setItems={routeNodes=>setItems(items.map(item=>item.id===node.id&&item.type==='branch'?{...item,branches:item.branches.map(route=>route.id===branch.id?{...route,nodes:routeNodes}:route)}:item))}/></div>)}<button className="story-graph-add-route" onClick={()=>setItems(items.map(item=>item.id===node.id&&item.type==='branch'?{...item,branches:[...item.branches,{id:uid('route'),label:`路線 ${item.branches.length+1}`,nodes:[]}]}:item))}>＋ 新增路線</button></div>}</div>)}</div>
 return <details className="story-graph-overview" open={open} onToggle={event=>onOpenChange(event.currentTarget.open)}><summary><span>FLOW MAP</span><b>章節流程骨架</b><small>從節點右側拖到其他節點左側，可建立多條連線</small></summary><div className="story-graph-stage" ref={stageRef} onClick={toggleGraphRoute}><svg className="story-graph-svg" width={stageRef.current?.scrollWidth||0} height={stageRef.current?.scrollHeight||0}><defs><marker id="story-edge-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>{links.map((link,index)=>link.path&&<g key={`${link.from}_${link.to}_${index}`}><path id={`edge_${index}`} d={link.path} stroke={link.color} markerEnd="url(#story-edge-arrow)"/>{link.label&&<text><textPath href={`#edge_${index}`} startOffset="50%">{link.label}</textPath></text>}</g>)}</svg><article data-graph-node-id="__start__" className="story-graph-start"><small>START</small><b>點擊故事</b></article><article data-graph-node-id="__world_map__" data-system-card className="story-graph-node system-node"><small>MAP</small><b>候選地圖</b><em>點擊要前往的關卡</em></article><article data-graph-node-id="__map_chapter__" data-system-card className="story-graph-node system-node"><small>地圖關卡</small><b>{chapter.mapNodeLabel??`第 ${chapter.order} 章`}　{chapter.mapNodeSymbol??chapter.piece}</b><em>{chapter.mapNodeTitle??chapter.title}</em><button onClick={()=>document.getElementById("story-chapter-opening-settings")?.scrollIntoView({behavior:"smooth",block:"center"})}>修改地圖節點</button></article>{entryPicker&&<article data-graph-node-id="__route_picker__" data-system-card className="story-graph-node branch"><small>進入後選路線</small><b>{entryPicker.title}</b><em>{entryPicker.branches.map(route=>route.label).join("／")}</em><button onClick={()=>onLocate(entryPicker.id)}>修改小黑／小白</button></article>}<article data-graph-node-id="__chapter_card__" className="story-graph-node chapter-entry"><div className="story-graph-node-head"><small>章節卡</small></div><b>{chapter.chapterCardTitle??`第${chapter.order}章　${chapter.piece}`}</b><small>{chapter.chapterCardEffect==='reading'?'閱讀展開':chapter.chapterCardEffect==='fade'?'淡入':'書寫逐字'}</small><button onClick={()=>document.getElementById('story-chapter-opening-settings')?.scrollIntoView({behavior:'smooth',block:'center'})}>修改細節</button></article><Sequence items={rootNodes} setItems={setRootNodes}/></div>{graphLinkList}{(chapter.chapterCardNextLinks?.length||linkedNodes.length>0)&&<section className="story-flow-link-manager"><h3>連線管理</h3>{chapter.chapterCardNextLinks?.map((link,index)=><div key={link.id}><b>章節開場卡</b><input value={link.label} onChange={e=>onChapterChange({chapterCardNextLinks:chapter.chapterCardNextLinks?.map(item=>item.id===link.id?{...item,label:e.target.value}:item)})}/><select value={link.targetId} onChange={e=>{const links=chapter.chapterCardNextLinks?.map(item=>item.id===link.id?{...item,targetId:e.target.value}:item);onChapterChange({chapterCardNextLinks:links,chapterCardNextNodeId:index===0?e.target.value:chapter.chapterCardNextNodeId})}}>{allNodes.map(target=><option key={target.id} value={target.id}>{nodeName(target.id)}</option>)}</select><button onClick={()=>{const next=chapter.chapterCardNextLinks?.filter(item=>item.id!==link.id)??[];onChapterChange({chapterCardNextLinks:next,chapterCardNextNodeId:next[0]?.targetId})}}>刪除</button></div>)}{linkedNodes.flatMap(source=>source.nextLinks!.map(link=><div key={link.id}><b>{label(source)}</b><input value={link.label} onChange={e=>onChange(editFlowLink(nodes,source.id,link.id,{label:e.target.value}))}/><select value={link.targetId} onChange={e=>onChange(editFlowLink(nodes,source.id,link.id,{targetId:e.target.value}))}>{allNodes.filter(target=>target.id!==source.id).map(target=><option key={target.id} value={target.id}>{nodeName(target.id)}</option>)}</select><button onClick={()=>onChange(editFlowLink(nodes,source.id,link.id,{},true))}>刪除</button></div>))}</section>}</details>
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
    <div className="story-node-flow-meta">
      {segment.presentation==='cg'&&<label className="check"><input type="checkbox" checked={segment.playOnce??/開場/.test(segment.section??'')} onChange={event=>patch({playOnce:event.target.checked})}/><span>每位玩家首次進入才播放</span></label>}
      <label><span>對應地圖路線節點</span><select value={segment.mapRoutePointIndex??''} onChange={event=>patch({mapRoutePointIndex:event.target.value===''?undefined:Number(event.target.value)})}><option value="">不連動地圖</option>{Array.from({length:20},(_,index)=><option value={index} key={index}>第 {index+1} 節點</option>)}</select></label>
    </div>
    {segment.presentation==='chapter'&&<div className="story-node-chapter-effect"><label>顯示效果<select value={segment.chapterEffect??'writing'} onChange={event=>patch({chapterEffect:event.target.value as StorySegment['chapterEffect']})}><option value="writing">書寫・逐字出現</option><option value="reading">閱讀・展開整頁</option><option value="fade">淡入・完整標題</option></select></label><label>點擊提示<input value={segment.chapterPrompt??''} placeholder="點擊任意位置開始 ◆" onChange={event=>patch({chapterPrompt:event.target.value})}/></label></div>}
    <div className="story-node-presentation"><select value={segment.presentation ?? 'dialogue'} onChange={event => patch({ presentation: event.target.value as StorySegment['presentation'] })}><option value="dialogue">角色對話</option><option value="narration">第三人稱旁白</option><option value="marquee">開場跑馬燈</option><option value="chapter">大章節字卡</option><option value="cg">CG 全圖</option><option value="battle">進入戰鬥提示</option></select>{segment.presentation==='marquee'&&<select value={segment.textDirection??'ltr'} onChange={event=>patch({textDirection:event.target.value as StorySegment['textDirection']})}><option value="ltr">左至右</option><option value="ttb">上至下</option><option value="btt">下至上</option><option value="rtl">右至左</option></select>}{segment.presentation==='cg'&&<><CgUpload segment={segment} onChange={onChange}/><input value={segment.cgKey??''} placeholder="或手動輸入 CG 圖片鍵值／網址" onChange={event=>patch({cgKey:event.target.value || undefined})}/><label>起點 X {segment.cgPositionX??50}%<input type="range" min="0" max="100" value={segment.cgPositionX??50} onChange={event=>patch({cgPositionX:Number(event.target.value)})}/></label><label>起點 Y {segment.cgPositionY??50}%<input type="range" min="0" max="100" value={segment.cgPositionY??50} onChange={event=>patch({cgPositionY:Number(event.target.value)})}/></label><label>終點 X {segment.cgEndPositionX??segment.cgPositionX??50}%<input type="range" min="0" max="100" value={segment.cgEndPositionX??segment.cgPositionX??50} onChange={event=>patch({cgEndPositionX:Number(event.target.value)})}/></label><label>終點 Y {segment.cgEndPositionY??segment.cgPositionY??50}%<input type="range" min="0" max="100" value={segment.cgEndPositionY??segment.cgPositionY??50} onChange={event=>patch({cgEndPositionY:Number(event.target.value)})}/></label><label>運鏡秒數 {segment.cgDuration??6}s<input type="range" min="2" max="20" value={segment.cgDuration??6} onChange={event=>patch({cgDuration:Number(event.target.value)})}/></label></>}{(segment.presentation??'dialogue')==='dialogue'&&<><label>講話立繪 {segment.portraitActiveScale??100}%<input type="range" min="90" max="130" value={segment.portraitActiveScale??100} onChange={event=>patch({portraitActiveScale:Number(event.target.value)})}/></label><label>待機立繪 {segment.portraitInactiveScale??88}%<input type="range" min="70" max="100" value={segment.portraitInactiveScale??88} onChange={event=>patch({portraitInactiveScale:Number(event.target.value)})}/></label><label>待機亮度 {segment.portraitInactiveOpacity??45}%<input type="range" min="20" max="90" value={segment.portraitInactiveOpacity??45} onChange={event=>patch({portraitInactiveOpacity:Number(event.target.value)})}/></label></>}</div>
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

function CgUpload({ segment, onChange }: { segment: StorySegment; onChange: (segment: StorySegment) => void }) {
  const storageKey = segment.cgKey && !/^https?:/.test(segment.cgKey) ? segment.cgKey : `cb_story_cg_${segment.id}`
  const [url, setUrl] = useState(() => /^https?:/.test(segment.cgKey ?? '') ? segment.cgKey ?? '' : getUrlByKey(storageKey) ?? '')
  const [busy, setBusy] = useState(false)
  const upload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    setBusy(true)
    reader.onload = async () => {
      try {
        const cloudUrl = await uploadByKey(storageKey, String(reader.result))
        onChange({ ...segment, cgKey: storageKey })
        setUrl(cloudUrl)
      } finally {
        setBusy(false)
        event.target.value = ''
      }
    }
    reader.readAsDataURL(file)
  }
  const clear = () => {
    removeByKey(storageKey)
    onChange({ ...segment, cgKey: undefined })
    setUrl('')
  }
  return <div className="story-route-cover-upload" style={{ marginBottom: 8 }}>
    {url ? <img src={url} alt="CG 預覽" /> : <span>尚未設定 CG</span>}
    <label>{busy ? '上傳中…' : '上傳 CG'}<input hidden disabled={busy} type="file" accept="image/*" onChange={upload} /></label>
    {url && <button className="btn sm danger" type="button" onClick={clear}>移除</button>}
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
void RewardCard
