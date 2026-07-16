import { useState } from 'react'
import { cards } from '../data/db'
import { CARD_ICON } from '../data/cardIcons'
import { getChars, getUrlByKey, getCardImg } from '../utils/charStore'
import { usePlayerStore } from '../store/playerStore'
import GameImage from './GameImage'

const EL_COLOR: Record<string, string> = { '劍': '#e87733', '槍': '#22cc77', '法': '#9955ee' }

interface Props { onClose: () => void }

export default function Collection({ onClose }: Props) {
  const { ownedCharIds, characterStars, cardInventory } = usePlayerStore()
  const chars = getChars()
  const [tab, setTab] = useState<'characters' | 'cards'>('characters')
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'owned' | 'locked'>('all')
  const [elementFilter, setElementFilter] = useState<'all' | '劍' | '槍' | '法'>('all')
  const filteredChars = chars.filter(char => {
    const owned = ownedCharIds.includes(char.id)
    return (ownershipFilter === 'all' || (ownershipFilter === 'owned' ? owned : !owned))
      && (elementFilter === 'all' || char.element === elementFilter)
  })

  return (
    <div className="panel-overlay">
      <div className="panel-header">
        <button className="panel-back" onClick={onClose}>← 返回</button>
        <span className="panel-title">📚 收藏</span>
        <span className="panel-meta">{tab === 'characters' ? `${ownedCharIds.length} / ${chars.length}` : `${cards.filter(card => (cardInventory[card.id] ?? 0) > 0).length} / ${cards.length}`}</span>
      </div>
      <div className="panel-body">
        <div className="diag-mode-tabs" style={{ marginBottom: 14 }}>
          <button className={tab === 'characters' ? 'active' : ''} onClick={() => setTab('characters')}>角色</button>
          <button className={tab === 'cards' ? 'active' : ''} onClick={() => setTab('cards')}>卡片</button>
        </div>
        {tab === 'characters' ? <><div className="diag-mode-tabs" style={{ marginBottom: 12 }}>
          {(['all','owned','locked'] as const).map(value => <button key={value} className={ownershipFilter === value ? 'active' : ''} onClick={() => setOwnershipFilter(value)}>{{ all: '全部', owned: '已擁有', locked: '未獲得' }[value]}</button>)}
          {(['all','劍','槍','法'] as const).map(value => <button key={`element-${value}`} className={elementFilter === value ? 'active' : ''} onClick={() => setElementFilter(value)}>{value === 'all' ? '全屬性' : value}</button>)}
        </div><div className="coll-grid">
          {filteredChars.map(c => {
            const owned  = ownedCharIds.includes(c.id)
            const stars = characterStars[c.id] ?? 0
            const starKey = stars > 3 && getUrlByKey(`cb_star_img_${c.id}`) ? `cb_star_img_${c.id}` : `cb_img_${c.id}`
            const imgUrl = getUrlByKey(starKey)
            const col    = EL_COLOR[c.element]
            return (
              <div key={c.id} className={`coll-card${owned ? ' owned' : ''}`}>
                <div className="coll-portrait" style={{ borderColor: owned ? col + '55' : 'rgba(255,255,255,.06)' }}>
                  {imgUrl
                      ? <GameImage storageKey={starKey} thumbWidth={220} alt={c.name} className="coll-img"
                        style={{ filter: owned ? 'none' : 'grayscale(1) brightness(.35)' }} />
                    : <div className="coll-placeholder" style={{ color: owned ? col : '#333' }}>{c.name[0]}</div>
                  }
                  {owned
                    ? <span className="coll-el" style={{ background: col }}>{c.element}</span>
                    : <span className="coll-lock">🔒</span>
                  }
                </div>
                <div className="coll-name" style={{ color: owned ? 'var(--text-h)' : '#3a3a55' }}>
                  {c.name}
                </div>
                {owned && <div style={{ color: '#e8bd55', fontSize: 13 }}>{stars ? '★'.repeat(stars) : '無星'}</div>}
              </div>
            )
          })}
        </div></> : <div className="coll-grid">
          {cards.map(card => {
            const count = Math.min(10, cardInventory[card.id] ?? 0)
            const imgUrl = getCardImg(card.id)
            return <div key={card.id} className={`coll-card${count ? ' owned' : ''}`}>
              <div className="coll-portrait">
                {imgUrl ? <GameImage storageKey={`cb_card_img_${card.id}`} thumbWidth={160} alt={card.name} className="coll-img"
                  style={{ filter: count ? 'none' : 'grayscale(1) brightness(.3)' }} />
                  : <div className="coll-placeholder">{CARD_ICON[card.id]}</div>}
                <span className="coll-el" style={{ background: count >= 10 ? '#c8a15a' : '#343858' }}>{count}/10</span>
              </div>
              <div className="coll-name">{card.name}</div>
            </div>
          })}
        </div>}
      </div>
    </div>
  )
}
