import { usePlayerStore } from '../store/playerStore'
import { getChars, getCharImg } from '../utils/charStore'

export type FeatureMode = 'pieces' | 'tasks' | 'mail' | 'achievements' | 'announcements'
interface Props { mode: FeatureMode; onClose: () => void }

const TITLE: Record<FeatureMode, string> = { pieces: '🧩 棋子', tasks: '🎯 任務', mail: '📬 信箱', achievements: '🏆 成就', announcements: '📢 公告' }

export default function FeaturePanel({ mode, onClose }: Props) {
  const player = usePlayerStore()
  const chars = getChars().filter(char => player.ownedCharIds.includes(char.id))
  const totalCards = Object.values(player.cardInventory).reduce((sum, count) => sum + count, 0)
  const today = new Date().toLocaleDateString('en-CA')
  const week = `${new Date().getFullYear()}-W${Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 604800000)}`

  const tasks = [
    { id: `daily-login-${today}`, name: '每日登入', detail: '今日登入遊戲', done: true, reward: [200, 5, 0] },
    { id: `daily-collection-${today}`, name: '整備棋子', detail: '持有至少 3 位角色', done: chars.length >= 3, reward: [300, 0, 0] },
    { id: `weekly-cards-${week}`, name: '牌庫收藏家', detail: '持有至少 50 張卡片', done: totalCards >= 50, reward: [500, 10, 1] },
    { id: `weekly-team-${week}`, name: '組成隊伍', detail: '儲存至少一支隊伍', done: player.savedTeams.length > 0, reward: [400, 5, 1] },
  ] as const
  const achievements = [
    { id: 'ach-char-1', name: '第一位夥伴', detail: '獲得 1 位角色', done: chars.length >= 1, reward: [300, 5, 0] },
    { id: 'ach-char-5', name: '棋子集結', detail: '獲得 5 位角色', done: chars.length >= 5, reward: [1000, 20, 1] },
    { id: 'ach-star-3', name: '突破之光', detail: '擁有一位三星角色', done: Object.values(player.characterStars).some(star => star >= 3), reward: [800, 10, 1] },
    { id: 'ach-star-5', name: '五星傳說', detail: '擁有一位五星角色', done: Object.values(player.characterStars).some(star => star >= 5), reward: [2000, 50, 2] },
    { id: 'ach-card-100', name: '百牌之主', detail: '持有 100 張卡片', done: totalCards >= 100, reward: [1500, 20, 1] },
  ] as const
  const mails = [
    { id: 'mail-welcome-v1', title: '歡迎來到奇蹟之盤', body: '感謝加入棋局，這份物資能協助你培養第一批棋子。', reward: [500, 20, 2] },
    { id: 'mail-story-preview-v1', title: '故事模式開發紀念', body: '初心荒野的棋局已經揭開序幕。', reward: [300, 10, 1] },
  ] as const
  const rewardText = (reward: readonly number[]) => `🪙 ${reward[0]}　💎 ${reward[1]}　🧩 ${reward[2]}`
  const RewardList = ({ rows }: { rows: ReadonlyArray<{ id: string; name: string; detail: string; done: boolean; reward: readonly number[] }> }) => <div className="feature-list">
    {rows.map(row => { const claimed = player.claimedRewards.includes(row.id); return <div className={`feature-row ${row.done ? 'done' : ''}`} key={row.id}>
      <div><b>{row.name}</b><p>{row.detail}</p><small>{rewardText(row.reward)}</small></div>
      <button className="btn primary" disabled={!row.done || claimed} onClick={() => player.claimReward(row.id, row.reward[0], row.reward[1], row.reward[2])}>{claimed ? '已領取' : row.done ? '領取' : '未完成'}</button>
    </div> })}
  </div>

  return <div className="panel-overlay feature-panel"><div className="panel-header"><button className="panel-back" onClick={onClose}>← 返回</button><span className="panel-title">{TITLE[mode]}</span>{mode === 'pieces' && <span className="panel-meta">升星道具 🧩 {player.upgradeItems}</span>}</div>
    <div className="panel-body">
      {mode === 'pieces' && <div className="feature-piece-grid">{chars.length ? chars.map(char => { const star = player.characterStars[char.id] ?? 0; const img = getCharImg(char.id); return <div className="feature-piece" key={char.id}>{img && <img src={img} alt="" />}<div><b>{char.name}</b><p>{star ? '★'.repeat(star) : '無星'} · 最高五星</p><small>下一星：HP／ATK／DEF／SPD 依角色設定提升</small></div><button className="btn primary" disabled={star >= 5 || player.upgradeItems <= 0} onClick={() => player.upgradeCharacterWithItem(char.id)}>{star >= 5 ? '已五星' : '使用 🧩 升星'}</button></div> }) : <div className="settings-empty">尚未擁有角色</div>}</div>}
      {mode === 'tasks' && <RewardList rows={tasks} />}
      {mode === 'achievements' && <RewardList rows={achievements} />}
      {mode === 'mail' && <div className="feature-list">{mails.map(mail => { const claimed = player.claimedRewards.includes(mail.id); return <div className="feature-row" key={mail.id}><div><b>{mail.title}</b><p>{mail.body}</p><small>{rewardText(mail.reward)}</small></div><button className="btn primary" disabled={claimed} onClick={() => player.claimReward(mail.id, mail.reward[0], mail.reward[1], mail.reward[2])}>{claimed ? '已領取' : '領取附件'}</button></div> })}</div>}
      {mode === 'announcements' && <div className="feature-list"><article className="feature-announcement"><time>2026/07/16</time><h3>奇蹟之盤功能更新</h3><p>新增五星棋子培養、卡片商店、測試天梯與故事編輯系統。</p></article><article className="feature-announcement"><time>開發預告</time><h3>初心荒野</h3><p>黑方與白方的選擇將決定你在棋盤上的道路。</p></article></div>}
    </div></div>
}
