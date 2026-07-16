import { getChars, getUrlByKey } from '../utils/charStore'
import { usePlayerStore } from '../store/playerStore'
import { supabase } from '../utils/supabase'

interface Props { onClose: () => void }

export default function PlayerProfile({ onClose }: Props) {
  const player = usePlayerStore()
  const characters = getChars().filter(character => player.ownedCharIds.includes(character.id))
  const selected = player.desktopCharIds ?? []
  const toggle = (id: string) => {
    if (selected.includes(id)) player.setDesktopCharacters(selected.filter(charId => charId !== id))
    else if (selected.length < 5) player.setDesktopCharacters([...selected, id])
  }
  const needed = player.level * 100

  return <div className="panel-overlay profile-screen">
    <div className="panel-header"><button className="panel-back" onClick={onClose}>← 返回大廳</button><span className="panel-title">玩家資料</span><span className="panel-meta">桌面立繪 {selected.length}/5</span></div>
    <div className="profile-body">
      <section className="profile-level-card">
        <div className="profile-level-orb"><small>LV</small><b>{player.level}</b></div>
        <div><h2>{player.username}</h2><p>完成決鬥與故事可獲得經驗值</p><div className="profile-exp"><i style={{ width: `${Math.min(100, player.experience / needed * 100)}%` }} /></div><small>{player.experience} / {needed} EXP</small></div>
      </section>
      <section><h3>設定桌面立繪</h3><p className="profile-hint">最多選擇五名收藏角色；在大廳點擊人物可依序切換。</p>
        <div className="profile-character-grid">{characters.map(character => {
          const active = selected.includes(character.id)
          const image = getUrlByKey(`cb_head_img_${character.id}`) ?? getUrlByKey(`cb_front_img_${character.id}`) ?? getUrlByKey(`cb_wide_img_${character.id}`)
          return <button key={character.id} className={active ? 'selected' : ''} disabled={!active && selected.length >= 5} onClick={() => toggle(character.id)}>
            {image ? <img src={image} alt="" /> : <span>♟</span>}<b>{character.name}</b><small>{active ? `第 ${selected.indexOf(character.id) + 1} 位` : '點擊選擇'}</small>
          </button>
        })}</div>
        {!characters.length && <div className="profile-empty">收藏中尚無角色，請先透過召喚取得角色。</div>}
      </section>
      <button className="profile-logout" onClick={() => supabase.auth.signOut()}>🚪 登出</button>
    </div>
  </div>
}
