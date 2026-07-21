import { useState } from 'react'
import { cards } from '../data/db'
import { CARD_ICON } from '../data/cardIcons'
import { getChars, getUrlByKey, getCardImg } from '../utils/charStore'
import { usePlayerStore } from '../store/playerStore'
import GameImage from './GameImage'
import FunctionIcon from './FunctionIcon'

const EL_COLOR: Record<string, string> = { '劍': '#e87733', '槍': '#22cc77', '法': '#9955ee' }

interface Props { onClose: () => void }

export default function Collection({ onClose }: Props) {
  const { ownedCharIds, characterStars, characterFragments, cardInventory, coins, gems, materials, skillSouls, upgradeItems } = usePlayerStore()
  const chars = getChars()
  const [tab, setTab] = useState<'characters' | 'cards' | 'items'>('characters')
  const [itemFilter, setItemFilter] = useState<'all' | 'currency' | 'material' | 'soul' | 'fragment'>('all')
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'owned' | 'locked'>('all')
  const [elementFilter, setElementFilter] = useState<'all' | '劍' | '槍' | '法'>('all')
  const filteredChars = chars.filter(char => {
    const owned = ownedCharIds.includes(char.id)
    return (ownershipFilter === 'all' || (ownershipFilter === 'owned' ? owned : !owned))
      && (elementFilter === 'all' || char.element === elementFilter)
  })
  const items = [
    { id: 'gems', name: '鑽石', count: gems, icon: '◆', group: 'currency', tone: 'cyan', description: '召喚與特殊功能使用的珍貴貨幣' },
    { id: 'coins', name: '金幣', count: coins, icon: '●', group: 'currency', tone: 'gold', description: '商店購買卡片與一般消耗使用' },
    { id: 'silver', name: '銀', count: materials?.silver ?? 0, icon: '●', group: 'material', tone: 'silver', description: '後勤與故事模式取得的加工素材' },
    { id: 'copper', name: '銅', count: materials?.copper ?? 0, icon: '●', group: 'material', tone: 'copper', description: '後勤與礦坑取得的基礎素材' },
    { id: 'iron', name: '鐵', count: materials?.iron ?? 0, icon: '⬡', group: 'material', tone: 'iron', description: '礦坑及後勤取得的強化素材' },
    { id: 'wood', name: '木', count: materials?.wood ?? 0, icon: '▰', group: 'material', tone: 'wood', description: '後勤工作取得的建設素材' },
    { id: 'piece', name: '棋子', count: upgradeItems ?? 0, icon: '♟', group: 'material', tone: 'gold', description: '用來提升角色星級' },
    { id: 'swordSoul', name: '劍魂', count: skillSouls?.sword ?? 0, icon: '⚔', group: 'soul', tone: 'red', description: '升級劍屬性招式的素材' },
    { id: 'gunSoul', name: '槍魂', count: skillSouls?.gun ?? 0, icon: '➶', group: 'soul', tone: 'green', description: '升級槍屬性招式的素材' },
    { id: 'magicSoul', name: '法魂', count: skillSouls?.magic ?? 0, icon: '✦', group: 'soul', tone: 'blue', description: '升級法屬性招式的素材' },
    ...chars.map(char => ({ id: `fragment-${char.id}`, name: `${char.name}碎片`, count: characterFragments?.[char.id] ?? 0, icon: '◈', group: 'fragment', tone: 'purple', description: '重複召喚角色時取得的角色碎片' })),
  ]
  const ownedItems = items.filter(item => item.count > 0 && (itemFilter === 'all' || item.group === itemFilter))

  return (
    <div className="panel-overlay">
      <div className="panel-header">
        <button className="panel-back" onClick={onClose}>← 返回</button>
        <span className="panel-title"><FunctionIcon name="collection" />收藏</span>
        <span className="panel-meta">{tab === 'characters' ? `${ownedCharIds.length} / ${chars.length}` : tab === 'cards' ? `${cards.filter(card => (cardInventory[card.id] ?? 0) > 0).length} / ${cards.length}` : `持有 ${items.filter(item => item.count > 0).length} 種`}</span>
      </div>
      <div className="panel-body">
        <div className="diag-mode-tabs" style={{ marginBottom: 14 }}>
          <button className={tab === 'characters' ? 'active' : ''} onClick={() => setTab('characters')}>角色</button>
          <button className={tab === 'cards' ? 'active' : ''} onClick={() => setTab('cards')}>卡片</button>
          <button className={tab === 'items' ? 'active' : ''} onClick={() => setTab('items')}>道具</button>
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
        </div></> : tab === 'cards' ? <div className="coll-grid">
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
        </div> : <><div className="diag-mode-tabs item-filter-tabs">{([['all','全部'],['currency','貨幣'],['material','素材'],['soul','技能魂'],['fragment','角色碎片']] as const).map(([value,label])=><button key={value} className={itemFilter===value?'active':''} onClick={()=>setItemFilter(value)}>{label}</button>)}</div>{ownedItems.length?<div className="collection-item-grid">{ownedItems.map(item=><article className={`collection-item tone-${item.tone}`} key={item.id}><div className="collection-item-icon">{item.icon}</div><div><b>{item.name}</b><small>{item.description}</small></div><strong>× {item.count.toLocaleString()}</strong></article>)}</div>:<div className="collection-empty-items">目前沒有這個分類的道具</div>}</>}
      </div>
    </div>
  )
}
