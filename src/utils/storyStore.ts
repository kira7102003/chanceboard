import { PAWN_STORY_FLOW } from './pawnStory'

export type StoryChapterId = 'pawn' | 'knight' | 'rook' | 'bishop' | 'queen' | 'king'

export interface StorySegment {
  id: string
  speaker: string
  text: string
  side: 'left' | 'right'
  /** Legacy 1=front, 2=side. */
  portrait?: 1 | 2
  boardCharacter?: string
  pose?: 'front' | 'side'
  section?: string
  presentation?: 'dialogue' | 'narration' | 'marquee' | 'chapter' | 'cg' | 'battle'
  textDirection?: 'ltr' | 'ttb' | 'btt' | 'rtl'
  cgKey?: string
  cgPositionX?: number
  cgPositionY?: number
  cgEndPositionX?: number
  cgEndPositionY?: number
  cgDuration?: number
  portraitActiveScale?: number
  portraitInactiveScale?: number
  portraitInactiveOpacity?: number
}

export type StoryFlowNode =
  | { id: string; type: 'common'; segment: StorySegment }
  | { id: string; type: 'branch'; title: string; branches: StoryFlowBranch[]; showPortraits?: boolean; leftCharacter?: string; rightCharacter?: string; choicePortraits?: StoryChoicePortrait[]; chapterRouteSelect?: boolean; routeSelectSubtitle?: string }

export interface StoryChoicePortrait { id: string; character?: string; side: 'left' | 'right'; visible: boolean }

export interface StoryFlowBranch { id: string; label: string; nodes: StoryFlowNode[]; coverKey?: string; description?: string; progressText?: string }

export interface StoryChapter {
  id: StoryChapterId
  order: number
  piece: string
  title: string
  subtitle: string
  unlocked: boolean
  story: string
  segments?: StorySegment[]
  flow?: StoryFlowNode[]
  backgroundKey?: string
  rewards?: StoryRewards
  mapX?: number
  mapY?: number
  mapRoutePoints?: { x: number; y: number }[]
}

export interface StoryRewards {
  characterId?: string
  coins?: number
  gems?: number
  silver?: number
  copper?: number
  iron?: number
  wood?: number
}

export function describeStoryRewards(rewards?: StoryRewards): string {
  if (!rewards) return ''
  return [rewards.characterId && '角色', rewards.gems && `鑽石 ×${rewards.gems}`, rewards.coins && `金幣 ×${rewards.coins}`,
    rewards.silver && `銀 ×${rewards.silver}`, rewards.copper && `銅 ×${rewards.copper}`, rewards.iron && `鐵 ×${rewards.iron}`, rewards.wood && `木 ×${rewards.wood}`]
    .filter(Boolean).join('　')
}

const KEY = 'cb_story_chapters'
const PAWN_IMPORT_VERSION_KEY = 'cb_story_pawn_import_version'
const PAWN_IMPORT_VERSION = '2026-07-22-v5-route-picker'

export const DEFAULT_STORY_CHAPTERS: StoryChapter[] = [
  { id: 'pawn', order: 1, piece: '兵', title: '初心荒野', subtitle: '所有願望，皆從最弱小的一步開始。', unlocked: true, story: `【開場 CG】\n無數人從天空墜落，棋盤從中央裂開。\n\n小黑：「新的棋局開始了。歡迎來到棋盤。」\n\n【第一節　初心荒野】\n打倒荒野魔物，學會棋盤沒有新手保護。\n\n【第二節　另一位玩家】\n親眼看見玩家為了勝利捨棄自己的棋子。\n\n【第三節　命運分歧】\n執黑將遇見圖卡勒絲；執白將遇見守護村莊的梅朵。你的選擇會累積求生意志或守護之心。\n\n【第四節　Boss：無名戰士】\n擊敗已經勝利九十九次、只想回家的無名戰士。\n\n【第一章　完】` },
  { id: 'knight', order: 2, piece: '騎士', title: '逆行之徑', subtitle: '騎士從不沿著直線抵達命運。', unlocked: false, story: '' },
  { id: 'rook', order: 3, piece: '城堡', title: '不落高牆', subtitle: '守護與囚禁，只隔著一面牆。', unlocked: false, story: '' },
  { id: 'bishop', order: 4, piece: '主教', title: '斜光聖堂', subtitle: '信仰沿著光與影的縫隙前進。', unlocked: false, story: '' },
  { id: 'queen', order: 5, piece: '皇后', title: '萬象王庭', subtitle: '最自由的棋子，也背負最沉重的選擇。', unlocked: false, story: '' },
  { id: 'king', order: 6, piece: '國王', title: '最後棋局', subtitle: '王倒下時，所有願望都將迎來答案。', unlocked: false, story: '' },
]

export function getStoryChapters(): StoryChapter[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as StoryChapter[] | null
    const needsPawnImport = localStorage.getItem(PAWN_IMPORT_VERSION_KEY) !== PAWN_IMPORT_VERSION
    if (needsPawnImport) localStorage.setItem(PAWN_IMPORT_VERSION_KEY, PAWN_IMPORT_VERSION)
    if (!saved) return DEFAULT_STORY_CHAPTERS.map(chapter => chapter.id === 'pawn' ? { ...chapter, flow: PAWN_STORY_FLOW } : chapter)
    return DEFAULT_STORY_CHAPTERS.map(base => {
      const merged = { ...base, ...saved.find(chapter => chapter.id === base.id) }
      return merged.id === 'pawn' && (needsPawnImport || !merged.flow?.length) ? { ...merged, flow: PAWN_STORY_FLOW } : merged
    })
  } catch { return DEFAULT_STORY_CHAPTERS }
}

export function getChapterSegments(chapter: StoryChapter): StorySegment[] {
  if (chapter.flow?.length) return flattenStoryFlow(chapter.flow)
  if (chapter.segments?.length) return chapter.segments
  return chapter.story.split(/\n\s*\n/).map<StorySegment>((text, index) => ({
    id: `legacy_${chapter.id}_${index}`,
    speaker: text.trim().startsWith('小白') ? '小白' : text.trim().startsWith('小黑') ? '小黑' : '旁白',
    text: text.trim(),
    side: index % 2 === 0 ? 'left' : 'right',
    boardCharacter: text.trim().startsWith('小白') ? 'white' : 'black',
    pose: index % 2 === 0 ? 'front' : 'side',
  })).filter(segment => segment.text)
}

export function getChapterFlow(chapter: StoryChapter): StoryFlowNode[] {
  if (chapter.flow?.length) return chapter.flow
  return getChapterSegments({ ...chapter, flow: undefined }).map(segment => ({ id: `node_${segment.id}`, type: 'common', segment }))
}

/** Runtime fallback follows the first branch; the editor retains every route. */
export function flattenStoryFlow(nodes: StoryFlowNode[]): StorySegment[] {
  return nodes.flatMap(node => node.type === 'common'
    ? [node.segment]
    : node.branches[0] ? flattenStoryFlow(node.branches[0].nodes) : [])
}

export function saveStoryChapters(chapters: StoryChapter[]): void {
  localStorage.setItem(KEY, JSON.stringify(chapters))
}

/** Mark the cleared chapter and open the next chapter in map order. */
export function unlockNextStoryChapter(chapterId: StoryChapterId): StoryChapter[] {
  const chapters = getStoryChapters()
  const clearedIndex = chapters.findIndex(chapter => chapter.id === chapterId)
  if (clearedIndex < 0) return chapters
  const next = chapters.map((chapter, index) => index === clearedIndex + 1 ? { ...chapter, unlocked: true } : chapter)
  saveStoryChapters(next)
  return next
}
