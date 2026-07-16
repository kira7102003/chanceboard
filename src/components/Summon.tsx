import { useState } from 'react'
import { usePlayerStore } from '../store/playerStore'
import { getChars, getUrlByKey } from '../utils/charStore'
import GameImage from './GameImage'
import type { Character } from '../types/character'

const PULL_1_COST  = 160
const PULL_10_COST = 1440
const DUP_FRAGMENTS = 10
const EL_COLOR: Record<string, string> = { '劍': '#e87733', '槍': '#22cc77', '法': '#9955ee' }

interface PullResult { char: Character; isNew: boolean; fragments: number }

interface Props { onClose: () => void }

export default function Summon({ onClose }: Props) {
  const { gems, ownedCharIds, spendGems, unlockChar, addCharacterFragments } = usePlayerStore()
  const allChars = getChars().filter(c => c.enabled !== false)

  const [results,   setResults]   = useState<PullResult[] | null>(null)
  const [animating, setAnimating] = useState(false)

  const doPull = (count: number) => {
    const cost = count === 1 ? PULL_1_COST : PULL_10_COST
    if (!spendGems(cost)) return

    // Snapshot owned set before loop so duplicates resolve correctly
    const alreadyOwned = new Set(ownedCharIds)
    const pulled: PullResult[] = []
    for (let i = 0; i < count; i++) {
      const c     = allChars[Math.floor(Math.random() * allChars.length)]
      const isNew = !alreadyOwned.has(c.id)
      pulled.push({ char: c, isNew, fragments: isNew ? 0 : DUP_FRAGMENTS })
      if (isNew) { alreadyOwned.add(c.id); unlockChar(c.id) }
      else addCharacterFragments(c.id, DUP_FRAGMENTS)
    }

    setResults(null)
    setAnimating(true)
    setTimeout(() => { setResults(pulled); setAnimating(false) }, 1200)
  }

  const repeatPull = () => doPull(results?.length ?? 1)

  return (
    <div className="panel-overlay">
      <div className="panel-header">
        <button className="panel-back" disabled={animating} onClick={results ? repeatPull : onClose}>
          {results ? '← 再次招喚' : '← 返回'}
        </button>
        <span className="panel-title">✨ 招喚</span>
        <div className="panel-currency-row">💎 {gems}</div>
      </div>

      {/* ── Main summon screen ── */}
      {!results && !animating && (
        <div className="panel-body">
          <div className="summon-banner">
            <div className="summon-banner-inner">
              <div className="summon-banner-title">奇蹟招喚</div>
              <div className="summon-banner-sub">從命運之輪召喚你的夥伴</div>
            </div>
          </div>

          <div className="summon-pool-section">
            <div className="shop-section-title" style={{ marginBottom: 8 }}>
              招喚池 · {allChars.length} 位英雄
            </div>
            <div className="summon-pool-row">
              {allChars.map(c => {
                const imgUrl = getUrlByKey(`cb_img_${c.id}`)
                const col    = EL_COLOR[c.element]
                const owned  = ownedCharIds.includes(c.id)
                return (
                  <div key={c.id} className="summon-pool-char"
                    style={{ borderColor: owned ? col + '88' : col + '22' }}>
                    {imgUrl
                      ? <GameImage storageKey={`cb_img_${c.id}`} thumbWidth={120} alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover',
                                   objectPosition: 'top',
                                   filter: owned ? 'none' : 'grayscale(.7) brightness(.6)' }} />
                      : <span style={{ color: col, fontSize: 14 }}>{c.name[0]}</span>
                    }
                  </div>
                )
              })}
            </div>
          </div>

          <div className="summon-btns">
            <button className="btn summon-btn" disabled={gems < PULL_1_COST} onClick={() => doPull(1)}>
              <span>單次招喚</span>
              <span className="summon-cost">💎 {PULL_1_COST}</span>
            </button>
            <button className="btn primary summon-btn" disabled={gems < PULL_10_COST} onClick={() => doPull(10)}>
              <span>十連招喚</span>
              <span className="summon-cost">💎 {PULL_10_COST}</span>
            </button>
          </div>

          <div className="hint" style={{ textAlign: 'center', marginTop: 8 }}>
            重複角色會轉換為該角色碎片 ×{DUP_FRAGMENTS}
          </div>
        </div>
      )}

      {/* ── Animating ── */}
      {animating && (
        <div className="panel-body summon-animation-screen">
          <div className="summon-stage">
            <div className="summon-rays" />
            <div className="summon-ring summon-ring-one" />
            <div className="summon-ring summon-ring-two" />
            <div className="summon-core">✦</div>
            <div className="summon-particles">✦　·　✧　·　✦</div>
          </div>
          <div className="summon-casting-text">命運之輪轉動中</div>
        </div>
      )}

      {/* ── Results ── */}
      {results && (
        <div className="panel-body">
          <div className="summon-results">
            {results.map(({ char: c, isNew, fragments }, i) => {
              const imgUrl = getUrlByKey(`cb_img_${c.id}`)
              const col    = EL_COLOR[c.element]
              return (
                <div key={i} className={`summon-result-card${isNew ? ' is-new' : ''}`}
                  style={{ '--col': col, '--delay': `${i * 80}ms` } as React.CSSProperties}>
                  {isNew && <span className="summon-new-badge">NEW</span>}
                  <div className="summon-result-portrait" style={{ borderColor: col + '88' }}>
                    {imgUrl
                      ? <GameImage storageKey={`cb_img_${c.id}`} thumbWidth={260} alt={c.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                      : <span style={{ color: col, fontSize: 18 }}>{c.name[0]}</span>
                    }
                  </div>
                  <div className="summon-result-name" style={{ color: col }}>{c.name}</div>
                  {!isNew && <div className="summon-dup-label">角色碎片 +{fragments}</div>}
                </div>
              )
            })}
          </div>
          <div style={{ textAlign: 'center', marginTop: 18, display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn primary" onClick={repeatPull}>再次招喚</button>
            <button className="btn" onClick={onClose}>返回大廳</button>
          </div>
        </div>
      )}
    </div>
  )
}
