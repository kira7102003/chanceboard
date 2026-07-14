import { getChars, getUrlByKey } from '../utils/charStore'
import { usePlayerStore } from '../store/playerStore'
import GameImage from './GameImage'

const EL_COLOR: Record<string, string> = { '劍': '#e87733', '槍': '#22cc77', '法': '#9955ee' }

interface Props { onClose: () => void }

export default function Collection({ onClose }: Props) {
  const { ownedCharIds } = usePlayerStore()
  const chars = getChars()

  return (
    <div className="panel-overlay">
      <div className="panel-header">
        <button className="panel-back" onClick={onClose}>← 返回</button>
        <span className="panel-title">📚 收藏</span>
        <span className="panel-meta">{ownedCharIds.length} / {chars.length}</span>
      </div>
      <div className="panel-body">
        <div className="coll-grid">
          {chars.map(c => {
            const owned  = ownedCharIds.includes(c.id)
            const imgUrl = getUrlByKey(`cb_img_${c.id}`)
            const col    = EL_COLOR[c.element]
            return (
              <div key={c.id} className={`coll-card${owned ? ' owned' : ''}`}>
                <div className="coll-portrait" style={{ borderColor: owned ? col + '55' : 'rgba(255,255,255,.06)' }}>
                  {imgUrl
                    ? <GameImage storageKey={`cb_img_${c.id}`} thumbWidth={220} alt={c.name} className="coll-img"
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
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
