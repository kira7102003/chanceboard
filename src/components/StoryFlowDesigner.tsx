import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import './StoryFlowDesigner.css'
import './StoryPlaybackV2.css'
import { getCharImg, getChars, getUrlByKey } from '../utils/charStore'
import type { BoardCharacter } from '../utils/boardCharacters'
import { getChapterFlow, type StoryChapter, type StoryFlowNode, type StoryRewards, type StorySegment } from '../utils/storyStore'
import StoryPlayer from './StoryPlayer'

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
const cloneNode = (node: StoryFlowNode): StoryFlowNode => node.type === 'common'
  ? { ...node, id: uid('node'), segment: { ...node.segment, id: uid('segment') } }
  : { ...node, id: uid('branch'), branches: node.branches.map(branch => ({ ...branch, id: uid('route'), nodes: branch.nodes.map(cloneNode) })) }
const pieceIdFromRef = (value?: string) => value?.startsWith('piece:') ? value.slice(6) : null

export default function StoryFlowDesigner({ chapter, boardCharacters, onSave, onClose }: Props) {
  const [flow, setFlow] = useState(() => getChapterFlow(chapter))
  const [rewards, setRewards] = useState<StoryRewards>(chapter.rewards ?? {})
  const [previewWindow, setPreviewWindow] = useState<Window | null>(null)
  const [saved, setSaved] = useState(false)
  const change = (next: StoryFlowNode[]) => { setFlow(next); setSaved(false) }
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
    setPreviewWindow(popup)
    popup.focus()
  }
  useEffect(() => {
    if (!previewWindow) return
    const close = () => setPreviewWindow(null)
    previewWindow.addEventListener('beforeunload', close)
    return () => previewWindow.removeEventListener('beforeunload', close)
  }, [previewWindow])

  return <div className="story-designer">
    <header className="story-designer-head">
      <div><button onClick={onClose}>← 返回章節設定</button><span className="story-designer-dot" /><b>{chapter.piece}　{chapter.title}｜故事流程</b></div>
      <div className="story-designer-legend"><i className="dialogue" />對話<i className="choice" />選項<i className="route" />分支</div>
      <div className="story-add-toolbar"><button onClick={openPreview}>↗ 開新視窗預覽</button><button onClick={() => change([...flow, makeCommon(boardCharacters[0])])}>＋ 對話</button><button onClick={() => change([...flow, makeBranch()])}>＋ 分支</button><button onClick={() => change([...flow, makePresentation('narration')])}>＋ 旁白</button><button onClick={() => change([...flow, makePresentation('marquee')])}>＋ 跑馬燈</button><button onClick={() => change([...flow, makePresentation('chapter')])}>＋ 章節</button><button onClick={() => change([...flow, makePresentation('cg')])}>＋ CG</button><button onClick={() => change([...flow, makePresentation('battle')])}>＋ 戰鬥</button><button className="primary" onClick={save}>{saved ? '✓ 已儲存' : '儲存'}</button></div>
    </header>
    <div className="story-designer-sub">以卡片編排章節。實線代表順序，彩色路線代表玩家選項；每條分支都能繼續加入對話或下一層選項。</div>
    <nav className="story-designer-palette">
      <button className="reward" onClick={() => document.querySelector('.story-reward-node')?.scrollIntoView({ behavior: 'smooth', inline: 'center' })}><i>★</i><span>故事獎勵</span></button>
      {boardCharacters.map((character, index) => { const showIcon = index < 2; const image = showIcon ? getUrlByKey(`cb_board_${character.id}_front`) : null; return <button key={character.id} onClick={() => change([...flow, makeCommon(character)])}><i>{image ? <img src={image} alt="" /> : showIcon ? character.name.slice(0, 1) : null}</i><span>{character.name}</span></button> })}
    </nav>
    <main className="story-designer-canvas">
      <RewardCard rewards={rewards} onChange={next => { setRewards(next); setSaved(false) }} />
      <FlowLane nodes={flow} onChange={change} boardCharacters={boardCharacters} depth={0} label="章節開始" laneId="root" />
      {!flow.length && <div className="story-designer-empty">尚無節點，請從右上角新增第一段對話。</div>}
    </main>
    {previewWindow && !previewWindow.closed && createPortal(<StoryPlayer chapter={chapter} initialNodes={flow} onLeave={() => previewWindow.close()} preview />, previewWindow.document.body)}
  </div>
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
  return <section className={`story-flow-lane${dragging ? ' dragging' : ''}`} style={{ '--lane-depth': depth } as React.CSSProperties}>
    <div className="story-flow-lane-label">{label}</div>
    <div className="story-flow-board">
      {nodes.map((node, index) => <div className="story-flow-card-wrap" key={node.id}>
        <div className="story-drop-zone" onDragOver={event => event.preventDefault()} onDrop={event => dropAt(event, index)}><span>放到這裡</span></div>
        {index > 0 && <span className="story-flow-arrow">→</span>}
        <article className={`story-designer-card ${node.type}${collapsed.has(node.id)?' collapsed':''}`}>
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
  return <div className={`story-branch-editor${depth === 0 ? ' root-parallel-routes' : ''}`}>
    <input className="story-branch-title" value={node.title} onChange={event => onChange({ ...node, title: event.target.value })} />
    <div className="story-branch-routes">{node.branches.map((route, routeIndex) => <div className="story-route-lane" key={route.id}>
      <div className="story-route-head"><i style={{ '--route-index': routeIndex } as React.CSSProperties} /><input value={route.label} onChange={event => onChange({ ...node, branches: node.branches.map(item => item.id === route.id ? { ...item, label: event.target.value } : item) })} /><button disabled={node.branches.length <= 2} onClick={() => onChange({ ...node, branches: node.branches.filter(item => item.id !== route.id) })}>×</button></div>
      <FlowLane laneId={route.id} label={`分支：${route.label}`} nodes={route.nodes} depth={depth + 1} boardCharacters={boardCharacters} onChange={routeNodes => onChange({ ...node, branches: node.branches.map(item => item.id === route.id ? { ...item, nodes: routeNodes } : item) })} />
    </div>)}</div>
    <button className="story-add-route" onClick={() => onChange({ ...node, branches: [...node.branches, { id: uid('route'), label: `選項 ${node.branches.length + 1}`, nodes: [] }] })}>＋ 新增選項路線</button>
  </div>
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
