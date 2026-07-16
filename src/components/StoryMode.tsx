import { useMemo, useState } from 'react'
import { getChapterSegments, getStoryChapters, type StoryChapter } from '../utils/storyStore'
import { getUrlByKey } from '../utils/charStore'

interface Props { onClose: () => void }

export default function StoryMode({ onClose }: Props) {
  const chapters = useMemo(getStoryChapters, [])
  const [chapter, setChapter] = useState<StoryChapter | null>(null)
  const [line, setLine] = useState(0)
  const [route, setRoute] = useState<'black' | 'white' | null>(null)
  const segments = chapter ? getChapterSegments(chapter) : []

  if (chapter) {
    const segment = segments[line]
    const boardFacing = (() => { try { return JSON.parse(localStorage.getItem('cb_board_facing') ?? '{}') } catch { return {} } })() as Record<string, string>
    const portrait = (side: 'left' | 'right', index: 1 | 2) => {
      const sourceRight = boardFacing[`portrait_${index}`] === 'right'
      const flip = (side === 'right') !== sourceRight
      return <img className={`story-board-char story-board-${side} ${segment?.side === side ? 'speaking' : ''}`}
        src={getUrlByKey(`cb_board_portrait_${index}`) ?? ''} alt="" style={{ transform: flip ? 'scaleX(-1)' : undefined }} />
    }
    return <div className="story-stage" style={{ backgroundImage: `linear-gradient(180deg,rgba(2,3,12,.2),#03040e 95%),url(${getUrlByKey(`cb_story_map_${chapter.id}`) ?? ''})` }}>
      <div className="story-cinematic-bars" />
      <button className="panel-back story-back" onClick={() => { setChapter(null); setLine(0); setRoute(null) }}>← 章節地圖</button>
      <div className="story-chapter-mark">CHAPTER {chapter.order} · {chapter.piece}</div>
      {(route || chapter.id !== 'pawn') && <>{portrait('left', segment?.side === 'left' ? segment.portrait : 1)}{portrait('right', segment?.side === 'right' ? segment.portrait : 2)}</>}
      {!route && chapter.id === 'pawn' ? <div className="story-dialogue story-route-pick">
        <small>請選擇你的棋盤立場</small><h2>執黑，或執白？</h2>
        <div><button onClick={() => setRoute('black')}>♟ 執黑</button><button onClick={() => setRoute('white')}>♙ 執白</button></div>
      </div> : <button className="story-dialogue" onClick={() => setLine(value => Math.min(segments.length, value + 1))}>
        <span>{segment?.speaker || (route === 'black' ? '小黑' : route === 'white' ? '小白' : chapter.title)}</span>
        <p>{segment?.text ?? '【章節結束】'}</p><small>{line >= segments.length ? '點擊返回章節地圖' : '點擊繼續　▶'}</small>
      </button>}
      {line >= segments.length && <button className="btn primary story-finish" onClick={() => { setChapter(null); setLine(0); setRoute(null) }}>完成章節</button>}
    </div>
  }

  return <div className="panel-overlay story-map-screen">
    <div className="panel-header"><button className="panel-back" onClick={onClose}>← 返回大廳</button><span className="panel-title">♟ 故事模式</span><span className="panel-meta">命運棋盤</span></div>
    <div className="story-map-path">
      {chapters.map(ch => <button key={ch.id} disabled={!ch.unlocked} className={`story-map-node ${ch.unlocked ? 'unlocked' : 'locked'}`}
        style={{ backgroundImage: `linear-gradient(180deg,transparent,#050611),url(${getUrlByKey(`cb_story_map_${ch.id}`) ?? ''})` }} onClick={() => setChapter(ch)}>
        <i>{ch.piece}</i><b>{ch.title}</b><span>{ch.subtitle}</span><small>{ch.unlocked ? '進入章節 ▶' : '🔒 尚未解鎖'}</small>
      </button>)}
    </div>
  </div>
}
