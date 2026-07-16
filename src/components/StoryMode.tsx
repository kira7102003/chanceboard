import { useMemo, useState } from 'react'
import './StoryMode.css'
import { describeStoryRewards, getChapterFlow, getStoryChapters, type StoryChapter, type StoryFlowNode } from '../utils/storyStore'
import { getCharImg, getChars, getUrlByKey } from '../utils/charStore'
import { getBoardCharacters } from '../utils/boardCharacters'

interface Props { onClose: () => void; onComplete?: (chapter: StoryChapter) => void }

export default function StoryMode({ onClose, onComplete }: Props) {
  const chapters = useMemo(getStoryChapters, [])
  const boardCharacters = useMemo(getBoardCharacters, [])
  const characters = useMemo(getChars, [])
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
    const selectedPieceId = segment?.boardCharacter?.startsWith('piece:') ? segment.boardCharacter.slice(6) : null
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
    const activeCharacter = selectedPieceId ? (segment?.side === 'right' ? rightDefault : leftDefault) : segment?.boardCharacter ?? (segment?.side === 'right' ? rightDefault : leftDefault)
    const background = getUrlByKey(chapter.backgroundKey || `cb_story_map_${chapter.id}`) ?? ''
    const speaker = segment?.speaker || chapter.title
    const speakerCharacter = characters.find(character => character.id === selectedPieceId || character.name === speaker || character.name.includes(speaker) || speaker.includes(character.name))
    const speakerBoard = boardCharacters.find(character => character.name === speaker)?.id ?? (selectedPieceId ? undefined : segment?.boardCharacter)
    const speakerAvatar = speakerCharacter
      ? (getCharImg(speakerCharacter.id) ?? getUrlByKey(`cb_head_img_${speakerCharacter.id}`) ?? getUrlByKey(`cb_front_img_${speakerCharacter.id}`))
      : speakerBoard ? (getUrlByKey(`cb_board_${speakerBoard}_front`) ?? getUrlByKey('cb_board_portrait_1')) : null
    const elementColor: Record<string, string> = { '劍': '#ef704d', '槍': '#29d889', '法': '#a86cff' }
    const elementIcon: Record<string, string> = { '劍': '⚔', '槍': '♧', '法': '✦' }
    const speakerColor = speakerCharacter ? (elementColor[speakerCharacter.element] ?? '#d9bd72')
      : speakerBoard === 'black' ? '#a86cff' : speakerBoard === 'white' ? '#55c9ef' : '#d9bd72'

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
      </div> : node ? <button className={`story-dialogue story-dialogue-${segment?.side ?? 'left'}`} style={{ '--story-accent': speakerColor } as React.CSSProperties} onClick={() => setCursor(value => Math.min(nodes.length, value + 1))}>
        <div className="story-speaker-avatar">{speakerAvatar ? <img src={speakerAvatar} alt="" /> : <b>{speaker.slice(0, 1)}</b>}{speakerCharacter && <i className="story-avatar-element">{elementIcon[speakerCharacter.element] ?? '◆'}</i>}</div>
        <div className="story-dialogue-content">
          <span className="story-speaker-name">{speaker}<i>{speakerCharacter?.element ?? (segment?.side === 'right' ? 'RIGHT' : 'LEFT')}</i></span>
          {segment?.section && <em className="story-section-label">{segment.section}</em>}
          <p>{segment?.text}</p><small>點擊繼續　›</small>
        </div>
      </button> : null}
      {cursor >= nodes.length && <button className="btn primary story-finish" onClick={() => { onComplete?.(chapter); leaveChapter() }}>完成章節 ＋100 EXP{describeStoryRewards(chapter.rewards) ? `　${describeStoryRewards(chapter.rewards)}` : ''}</button>}
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
