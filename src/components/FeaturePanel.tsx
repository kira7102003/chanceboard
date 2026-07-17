import { useState } from 'react'
import { usePlayerStore } from '../store/playerStore'
import { getChars, getCharImg } from '../utils/charStore'
import FunctionIcon from './FunctionIcon'
import { getDailyReward, localDateKey } from '../utils/dailyRewards'
import './TaskCalendar.css'

export type FeatureMode = 'pieces' | 'tasks' | 'mail' | 'achievements' | 'announcements' | 'friends'
interface Props { mode: FeatureMode; userId: string; onClose: () => void }

const TITLE: Record<FeatureMode, string> = { pieces: '棋子', tasks: '任務', mail: '信箱', achievements: '成就', announcements: '公告', friends: '好友' }

export default function FeaturePanel({ mode, userId, onClose }: Props) {
  const player = usePlayerStore()
  const [friendId, setFriendId] = useState('')
  const [taskTab, setTaskTab] = useState<'tasks' | 'calendar'>('tasks')
  const chars = getChars().filter(char => player.ownedCharIds.includes(char.id))
  const totalCards = Object.values(player.cardInventory).reduce((sum, count) => sum + count, 0)
  const today = new Date().toLocaleDateString('en-CA')
  const week = `${new Date().getFullYear()}-W${Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 604800000)}`
  const calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const calendarCells = [...Array(calendarMonth.getDay()).fill(null), ...Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }, (_, index) => new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), index + 1))]
  const claimedDates = player.dailyClaims?.[userId] ?? []

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
  const rewardText = (reward: readonly number[]) => `🪙 ${reward[0]}　💎 ${reward[1]}　棋子 ${reward[2]}`
  const RewardList = ({ rows }: { rows: ReadonlyArray<{ id: string; name: string; detail: string; done: boolean; reward: readonly number[] }> }) => <div className="feature-list">
    {rows.map(row => { const claimed = player.claimedRewards.includes(row.id); return <div className={`feature-row ${row.done ? 'done' : ''}`} key={row.id}>
      <div><b>{row.name}</b><p>{row.detail}</p><small>{rewardText(row.reward)}</small></div>
      <button className="btn primary" disabled={!row.done || claimed} onClick={() => player.claimReward(row.id, row.reward[0], row.reward[1], row.reward[2])}>{claimed ? '已領取' : row.done ? '領取' : '未完成'}</button>
    </div> })}
  </div>

  return <div className="panel-overlay feature-panel"><div className="panel-header"><button className="panel-back" onClick={onClose}>← 返回</button><span className="panel-title"><FunctionIcon name={mode} />{TITLE[mode]}</span>{mode === 'pieces' && <span className="panel-meta"><img className="panel-piece-icon sm" src="/chess-piece.svg" alt="" /> 棋子 {player.upgradeItems}</span>}{mode === 'friends' && <span className="panel-meta">{player.friends.length} / 50</span>}</div>
    <div className="panel-body">
      {mode === 'pieces' && <div className="feature-piece-grid">{chars.length ? chars.map(char => { const star = player.characterStars[char.id] ?? 0; const fragments = player.characterFragments?.[char.id] ?? 0; const img = getCharImg(char.id); return <div className="feature-piece" key={char.id}>{img && <img src={img} alt="" />}<div><b>{char.name}</b><p>{star ? '★'.repeat(star) : '無星'} · 最高五星</p><small>角色碎片 {fragments}　下一星：HP／ATK／DEF／SPD 依角色設定提升</small></div><button className="btn primary" disabled={star >= 5 || player.upgradeItems <= 0} onClick={() => player.upgradeCharacterWithItem(char.id)}>{star >= 5 ? '已五星' : '使用棋子'}</button></div> }) : <div className="settings-empty">尚未擁有角色</div>}</div>}
      {mode === 'tasks' && <><nav className="task-tabs"><button className={taskTab === 'tasks' ? 'active' : ''} onClick={() => setTaskTab('tasks')}>任務列表</button><button className={taskTab === 'calendar' ? 'active' : ''} onClick={() => setTaskTab('calendar')}>📅 每日簽到</button></nav>{taskTab === 'tasks' ? <RewardList rows={tasks} /> : <section className="task-calendar"><header><div><b>{calendarMonth.getFullYear()} 年 {calendarMonth.getMonth() + 1} 月</b><span>每日簽到獎勵</span></div><strong>💰 金幣 +200　💎 鑽石 +5</strong></header><div className="task-calendar-week">{['日','一','二','三','四','五','六'].map(day => <b key={day}>{day}</b>)}</div><div className="task-calendar-grid">{calendarCells.map((date, index) => { if (!date) return <i key={`blank-${index}`} />; const dateKey = localDateKey(date); const reward = getDailyReward(dateKey); const claimed = claimedDates.includes(dateKey); const isToday = dateKey === today; const future = dateKey > today; return <article key={dateKey} className={`${claimed ? 'claimed' : ''}${isToday ? ' today' : ''}${future ? ' future' : ''}`}><b>{date.getDate()}</b><small>💰 {reward.coins}</small><small>💎 {reward.gems}</small>{claimed ? <span>✓ 已簽到</span> : isToday ? <button onClick={() => player.claimDailyReward(userId, dateKey, reward.coins, reward.gems)}>今日簽到</button> : <span>{future ? '未開放' : '未簽到'}</span>}</article> })}</div></section>}</>}
      {mode === 'achievements' && <RewardList rows={achievements} />}
      {mode === 'mail' && <div className="feature-list">{mails.map(mail => { const claimed = player.claimedRewards.includes(mail.id); return <div className="feature-row" key={mail.id}><div><b>{mail.title}</b><p>{mail.body}</p><small>{rewardText(mail.reward)}</small></div><button className="btn primary" disabled={claimed} onClick={() => player.claimReward(mail.id, mail.reward[0], mail.reward[1], mail.reward[2])}>{claimed ? '已領取' : '領取附件'}</button></div> })}</div>}
      {mode === 'announcements' && <div className="feature-list"><article className="feature-announcement"><time>2026/07/16</time><h3>奇蹟之盤功能更新</h3><p>新增五星棋子培養、卡片商店、測試天梯與故事編輯系統。</p></article><article className="feature-announcement"><time>開發預告</time><h3>初心荒野</h3><p>黑方與白方的選擇將決定你在棋盤上的道路。</p></article></div>}
      {mode === 'friends' && <div className="feature-list"><div className="feature-row"><div style={{ flex: 1 }}><b>新增好友</b><p>輸入對方玩家 ID，好友上限 50 人。</p><input className="input" value={friendId} maxLength={32} placeholder="玩家 ID" onChange={event => setFriendId(event.target.value.toUpperCase())} onKeyDown={event => { if (event.key === 'Enter' && player.addFriend(friendId)) setFriendId('') }} /></div><button className="btn primary" disabled={!friendId.trim() || player.friends.length >= 50} onClick={() => { if (player.addFriend(friendId)) setFriendId('') }}>新增</button></div>
        {player.friends.map((id, index) => <div className="feature-row" key={id}><div><b>{id}</b><p>好友 #{index + 1}</p></div><button className="btn danger" onClick={() => player.removeFriend(id)}>刪除</button></div>)}
        {player.friends.length === 0 && <div className="settings-empty">目前沒有好友</div>}
      </div>}
    </div></div>
}
