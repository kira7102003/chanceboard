import { useState } from 'react'
import { getUrlByKey } from '../utils/charStore'
import type { BoardCharacter } from '../utils/boardCharacters'
import { getChapterFlow, type StoryChapter, type StoryFlowNode, type StorySegment } from '../utils/storyStore'

interface Props {
  chapter: StoryChapter
  boardCharacters: BoardCharacter[]
  onChange: (flow: StoryFlowNode[]) => void
  onClose: () => void
}

const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
const makeSegment = (character?: BoardCharacter): StorySegment => ({
  id: uid('segment'), speaker: character?.name ?? '旁白', text: '輸入故事對話……', side: 'left', boardCharacter: character?.id, pose: 'front', section: '新段落',
})
const makeCommon = (character?: BoardCharacter): StoryFlowNode => ({ id: uid('node'), type: 'common', segment: makeSegment(character) })
const makeBranch = (): StoryFlowNode => ({ id: uid('branch'), type: 'branch', title: '新選項', branches: [
  { id: uid('route'), label: '選項 A', nodes: [] }, { id: uid('route'), label: '選項 B', nodes: [] },
] })

export default function StoryFlowDesigner({ chapter, boardCharacters, onChange, onClose }: Props) {
  const [flow, setFlow] = useState(() => getChapterFlow(chapter))
  const [saved, setSaved] = useState(false)
  const change = (next: StoryFlowNode[]) => { setFlow(next); setSaved(false) }
  const save = () => { onChange(flow); setSaved(true) }

  return <div className="story-designer">
    <header className="story-designer-head">
      <div><button onClick={onClose}>← 返回章節設定</button><span className="story-designer-dot" /><b>{chapter.piece}　{chapter.title}｜故事流程</b></div>
      <div className="story-designer-legend"><i className="dialogue" />對話<i className="choice" />選項<i className="route" />分支</div>
      <div><button onClick={() => change([...flow, makeCommon(boardCharacters[0])])}>＋ 對話</button><button onClick={() => change([...flow, makeBranch()])}>＋ 分支</button><button className="primary" onClick={save}>{saved ? '✓ 已儲存' : '儲存'}</button></div>
    </header>
    <div className="story-designer-sub">以卡片編排章節。實線代表順序，彩色路線代表玩家選項；每條分支都能繼續加入對話或下一層選項。</div>
    <main className="story-designer-canvas">
      <FlowLane nodes={flow} onChange={change} boardCharacters={boardCharacters} depth={0} label="章節開始" />
      {!flow.length && <div className="story-designer-empty">尚無節點，請從右上角新增第一段對話。</div>}
    </main>
  </div>
}

function FlowLane({ nodes, onChange, boardCharacters, depth, label }: {
  nodes: StoryFlowNode[]; onChange: (nodes: StoryFlowNode[]) => void; boardCharacters: BoardCharacter[]; depth: number; label: string
}) {
  const replace = (id: string, node: StoryFlowNode) => onChange(nodes.map(item => item.id === id ? node : item))
  const move = (index: number, offset: number) => {
    const target = index + offset
    if (target < 0 || target >= nodes.length) return
    const next = [...nodes]; [next[index], next[target]] = [next[target], next[index]]; onChange(next)
  }
  return <section className="story-flow-lane" style={{ '--lane-depth': depth } as React.CSSProperties}>
    <div className="story-flow-lane-label">{label}</div>
    <div className="story-flow-board">
      {nodes.map((node, index) => <div className="story-flow-card-wrap" key={node.id}>
        {index > 0 && <span className="story-flow-arrow">→</span>}
        <article className={`story-designer-card ${node.type}`}>
          <div className="story-card-top"><i>{index + 1}</i><b>{node.type === 'common' ? '對話節點' : '選項分支'}</b><span>
            <button disabled={index === 0} onClick={() => move(index, -1)}>←</button><button disabled={index === nodes.length - 1} onClick={() => move(index, 1)}>→</button><button className="delete" onClick={() => onChange(nodes.filter(item => item.id !== node.id))}>×</button>
          </span></div>
          {node.type === 'common' ? <DialogueCard segment={node.segment} boardCharacters={boardCharacters} onChange={segment => replace(node.id, { ...node, segment })} />
            : <BranchCard node={node} boardCharacters={boardCharacters} depth={depth} onChange={next => replace(node.id, next)} />}
        </article>
      </div>)}
      <div className="story-flow-inline-add"><button onClick={() => onChange([...nodes, makeCommon(boardCharacters[0])])}>＋ 對話</button><button onClick={() => onChange([...nodes, makeBranch()])}>＋ 分支</button></div>
    </div>
  </section>
}

function DialogueCard({ segment, boardCharacters, onChange }: { segment: StorySegment; boardCharacters: BoardCharacter[]; onChange: (segment: StorySegment) => void }) {
  const patch = (value: Partial<StorySegment>) => onChange({ ...segment, ...value })
  const image = getUrlByKey(`cb_board_${segment.boardCharacter ?? 'black'}_front`) ?? ''
  return <div className="story-dialogue-editor">
    <div className="story-node-speaker">{image ? <img src={image} alt="" /> : <span>{segment.speaker.slice(0, 1)}</span>}<input value={segment.speaker} onChange={event => patch({ speaker: event.target.value })} /></div>
    <input className="story-node-section" value={segment.section ?? ''} placeholder="段落名稱" onChange={event => patch({ section: event.target.value })} />
    <textarea value={segment.text} onChange={event => patch({ text: event.target.value })} />
    <div className="story-node-controls"><select value={segment.boardCharacter ?? ''} onChange={event => { const character = boardCharacters.find(item => item.id === event.target.value); patch({ boardCharacter: event.target.value, speaker: character?.name ?? segment.speaker }) }}><option value="">無大頭貼</option>{boardCharacters.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}</select>
      <select value={segment.side} onChange={event => patch({ side: event.target.value as 'left' | 'right' })}><option value="left">左側發言</option><option value="right">右側發言</option></select>
      <select value={segment.pose ?? 'front'} onChange={event => patch({ pose: event.target.value as 'front' | 'side' })}><option value="front">正面</option><option value="side">側面</option></select></div>
  </div>
}

function BranchCard({ node, boardCharacters, depth, onChange }: { node: Extract<StoryFlowNode, { type: 'branch' }>; boardCharacters: BoardCharacter[]; depth: number; onChange: (node: Extract<StoryFlowNode, { type: 'branch' }>) => void }) {
  return <div className="story-branch-editor">
    <input className="story-branch-title" value={node.title} onChange={event => onChange({ ...node, title: event.target.value })} />
    <div className="story-branch-routes">{node.branches.map((route, routeIndex) => <div className="story-route-lane" key={route.id}>
      <div className="story-route-head"><i style={{ '--route-index': routeIndex } as React.CSSProperties} /><input value={route.label} onChange={event => onChange({ ...node, branches: node.branches.map(item => item.id === route.id ? { ...item, label: event.target.value } : item) })} /><button disabled={node.branches.length <= 2} onClick={() => onChange({ ...node, branches: node.branches.filter(item => item.id !== route.id) })}>×</button></div>
      <FlowLane label={`分支：${route.label}`} nodes={route.nodes} depth={depth + 1} boardCharacters={boardCharacters} onChange={routeNodes => onChange({ ...node, branches: node.branches.map(item => item.id === route.id ? { ...item, nodes: routeNodes } : item) })} />
    </div>)}</div>
    <button className="story-add-route" onClick={() => onChange({ ...node, branches: [...node.branches, { id: uid('route'), label: `選項 ${node.branches.length + 1}`, nodes: [] }] })}>＋ 新增選項路線</button>
  </div>
}
