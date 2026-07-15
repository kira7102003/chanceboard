import { usePlayerStore } from '../store/playerStore'
import { cards } from '../data/db'
import { CARD_ICON } from '../data/cardIcons'
import { getCardImg } from '../utils/charStore'
import GameImage from './GameImage'

const CARD_COLOR: Record<string, string> = { red: '#ee4444', green: '#22cc77', blue: '#5566ee', yellow: '#ddaa22', flower: '#bb55ee' }
const cardPrice = (isSuitCard: boolean) => isSuitCard ? 100 : 300

interface Props { onClose: () => void }

export default function Shop({ onClose }: Props) {
  const { coins, gems, cardInventory, buyCard } = usePlayerStore()

  return (
    <div className="panel-overlay">
      <div className="panel-header">
        <button className="panel-back" onClick={onClose}>← 返回</button>
        <span className="panel-title">🛒 商店</span>
        <div className="panel-currency-row">
          <span>🪙 {coins.toLocaleString()}</span>
          <span>💎 {gems}</span>
        </div>
      </div>
      <div className="panel-body">

        <section className="shop-section">
          <div className="shop-section-title">🎴 卡片商店 · 每種最多持有 10 張</div>
          <div className="shop-char-grid">
            {cards.map(card => {
              const count = cardInventory[card.id] ?? 0
              const price = cardPrice(card.isSuitCard)
              const imgUrl = getCardImg(card.id)
              const col = CARD_COLOR[card.color]
              return (
                <div key={card.id} className={`shop-char-card${count >= 10 ? ' owned' : ''}`}>
                  <div className="shop-char-portrait" style={{ borderColor: col + '44' }}>
                    {imgUrl
                      ? <GameImage storageKey={`cb_card_img_${card.id}`} thumbWidth={160} alt={card.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ color: col, fontSize: 28 }}>{CARD_ICON[card.id]}</span>
                    }
                    <div className="shop-char-owned-badge">{count}/10</div>
                  </div>
                  <div className="shop-char-name">{card.name}</div>
                  <button className="btn primary" style={{ fontSize: 11, padding: '4px 8px', marginTop: 4 }}
                    disabled={count >= 10 || coins < price} onClick={() => buyCard(card.id, price)}>
                    {count >= 10 ? '已達上限' : `🪙 ${price}`}
                  </button>
                </div>
              )
            })}
          </div>
        </section>

      </div>
    </div>
  )
}
