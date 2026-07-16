import { useMemo, useState } from 'react'
import { getChapterFlow, getStoryChapters, type StoryChapter, type StoryFlowNode } from '../utils/storyStore'
import { getUrlByKey } from '../utils/charStore'
import { getBoardCharacters } from '../utils/boardCharacters'

interface Props { onClose: () => void }

export default function StoryMode({ onClose }: Props) {
  const chapters = useMemo(getStoryChapters, [])
  const boardCharacters = useMemo(getBoardCharacters, [])
  const [chapter, setChapter] = useState<StoryChapter | null>(null)
  const [nodes, setNodes] = useState<StoryFlowNode[]>([])
  const [cursor, setCursor] = useState(0)

  const leaveChapter = () => { setChapter(null); setNodes([]); setCursor(0) }

  if (chapter) {
    const node = nodes[cursor]
    const segment = node?.type === 'common' ? node.segment : undefined
    const boardFacing = (() => { try { return JSON.parse(localStorage.getItem('cb_board_facing') ?? '{}') } catch { return {} } })() as Record<string, string>
    const leftDefault = boardCharacters[0]?.id ?? 'black'
    const rightDefault = boardCharacters[1]?.id ?? leftDefault
    const portrait = (side: 'left' | 'right', boardCharacter: string, pose: 'front' | 'side') => {
      const sourceRight = boardFacing[`${boardCharacter}_${pose}`] === 'right'
      const flip = pose === 'side' && ((side === 'right') !== sourceRight)
      const legacyIndex = pose === 'front' ? 1 : 2
      const image = getUrlByKey(`cb_board_${boardCharacter}_${pose}`) ?? getUrlByKey(`cb_board_portrait_${legacyIndex}`) ?? ''
      return image ? <img className={`story-board-char story-board-${side} ${segment?.side === side ? 'speaking' : ''}`}
        src={image} alt={boardCharacters.find(character => character.id === boardCharacter)?.name ?? boardCharacter}
        style={{ transform: flip ? 'scaleX(-1)' : undefined }} /> : null
    }
    const pose = segment?.pose ?? (segment?.portrait === 2 ? 'side' : 'front')
    const activeCharacter = segment?.boardCharacter ?? (segment?.side === 'right' ? rightDefault : leftDefault)
    const background = getUrlByKey(chapter.backgroundKey || `cb_story_map_${chapter.id}`) ?? ''

    return <div className="story-stage" style={{ backgroundImage: `linear-gradient(180deg,rgba(2,3,12,.2),#03040e 95%),url(${background})` }}>
      <div className="story-cinematic-bars" />
      <button className="panel-back story-back" onClick={leaveChapter}>返回章節</button>
      <div className="story-chapter-mark">CHAPTER {chapter.order} · {chapter.piece}</div>
      {node?.type !== 'branch' && <>
        {portrait('left', segment?.side === 'left' ? activeCharacter : leftDefault, segment?.side === 'left' ? pose : 'front')}
        {portrait('right', segment?.side === 'right' ? activeCharacter : rightDefault, segment?.side === 'right' ? pose : 'front')}
      </>}
      {node?.type === 'branch' ? <div className="story-dialogue story-route-pick">
        <small>故事選項</small><h2>{node.title}</h2>
        <div>{node.branches.map(branch => <button key={branch.id} onClick={() => {
          setNodes(current => [...current.slice(0, cursor), ...branch.nodes, ...current.slice(cursor + 1)])
        }}>{branch.label}</button>)}</div>
      </div> : node ? <button className="story-dialogue" onClick={() => setCursor(value => Math.min(nodes.length, value + 1))}>
        <span>{segment?.section && <em style={{ marginRight: 10, opacity: .65 }}>{segment.section}</em>}{segment?.speaker || chapter.title}</span>
        <p>{segment?.text}</p><small>點擊繼續</small>
      </button> : null}
      {cursor >= nodes.length && <button className="btn primary story-finish" onClick={leaveChapter}>完成章節</button>}
    </div>
  }

  return <div className="panel-overlay story-map-screen">
    <div className="panel-header"><button className="panel-back" onClick={onClose}>返回大廳</button><span className="panel-title">故事模式</span><span className="panel-meta">命運棋盤</span></div>
    <div className="story-map-path">
      {chapters.map(item => <button key={item.id} disabled={!item.unlocked} className={`story-map-node ${item.unlocked ? 'unlocked' : 'locked'}`}
        style={{ backgroundImage: `linear-gradient(180deg,transparent,#050611),url(${getUrlByKey(`cb_story_map_${item.id}`) ?? ''})` }}
        onClick={() => { setChapter(item); setNodes(getChapterFlow(item)); setCursor(0) }}>
        <i>{item.piece}</i><b>{item.title}</b><span>{item.subtitle}</span><small>{item.unlocked ? '進入章節 →' : '🔒 尚未解鎖'}</small>
      </button>)}
    </div>
  </div>
}
