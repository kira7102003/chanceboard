import { usePlayerStore } from '../store/playerStore'
import { getChars, getUrlByKey } from '../utils/charStore'

const EL_COLOR:      Record<string, string> = { '劍': '#e87733', '槍': '#22cc77', '法': '#9955ee' }
const COIN_TO_GEM    = { coins: 1000, gems: 100 }
const CHAR_GEM_PRICE = 500

interface Props { onClose: () => void }

export default function Shop({ onClose }: Props) {
  const { coins, gems, ownedCharIds, spendCoins, addGems, spendGems, unlockChar } = usePlayerStore()
  const chars = getChars().filter(c => c.enabled !== false)

  const buyGems = () => {
    if (!spendCoins(COIN_TO_GEM.coins)) return
    addGems(COIN_TO_GEM.gems)
  }

  const buyChar = (id: string) => {
    if (!spendGems(CHAR_GEM_PRICE)) return
    unlockChar(id)
  }

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

        {/* Currency exchange */}
        <section className="shop-section">
          <div className="shop-section-title">💱 貨幣兌換</div>
          <div className="shop-item-row">
            <div>
              <div className="shop-item-name">💎 鑽石 ×{COIN_TO_GEM.gems}</div>
              <div className="shop-item-cost">需要 🪙 {COIN_TO_GEM.coins.toLocaleString()} 金幣</div>
            </div>
            <button className="btn primary" disabled={coins < COIN_TO_GEM.coins} onClick={buyGems}>
              兌換
            </button>
          </div>
        </section>

        {/* Characters */}
        <section className="shop-section">
          <div className="shop-section-title">👤 角色商店 · 每位 💎 {CHAR_GEM_PRICE}</div>
          <div className="shop-char-grid">
            {chars.map(c => {
              const owned  = ownedCharIds.includes(c.id)
              const imgUrl = getUrlByKey(`cb_img_${c.id}`)
              const col    = EL_COLOR[c.element]
              return (
                <div key={c.id} className={`shop-char-card${owned ? ' owned' : ''}`}>
                  <div className="shop-char-portrait" style={{ borderColor: col + '44' }}>
                    {imgUrl
                      ? <img src={imgUrl} alt={c.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top',
                                   filter: owned ? 'none' : 'brightness(.55)' }} />
                      : <span style={{ color: col, fontSize: 18 }}>{c.name[0]}</span>
                    }
                    {owned && <div className="shop-char-owned-badge">已擁有</div>}
                  </div>
                  <div className="shop-char-name" style={{ color: owned ? '#555' : 'var(--text-h)' }}>{c.name}</div>
                  {!owned && (
                    <button className="btn primary" style={{ fontSize: 11, padding: '4px 8px', marginTop: 4 }}
                      disabled={gems < CHAR_GEM_PRICE} onClick={() => buyChar(c.id)}>
                      💎 {CHAR_GEM_PRICE}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>

      </div>
    </div>
  )
}
