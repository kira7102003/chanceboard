import { useGameStore } from '../store/gameStore'
import { getChars } from '../utils/charStore'
import { CharPortrait } from './Admin'

const characters = getChars()

const EL_LABEL: Record<string, string> = { sword: '⚔ 劍', gun: '🔫 槍', magic: '✦ 魔' }

interface Props {
  onConfirm: (ids: string[]) => void
}

export default function CharSelect({ onConfirm }: Props) {
  const { selectedCharIds, toggleCharSelect, mySide, playerCount } = useGameStore()
  const ready = selectedCharIds.length === 3

  return (
    <div className="char-select">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h2>選擇角色 — <span className={`side side-${mySide}`}>{mySide} 方</span></h2>
        <span className="hint">選 3 位（{selectedCharIds.length}/3）</span>
        {playerCount < 2 && <span className="waiting">等待對手…</span>}
      </div>

      <div className="char-grid">
        {characters.map(c => {
          const sel = selectedCharIds.includes(c.id)
          return (
            <div
              key={c.id}
              className={`char-card el-${c.element} ${sel ? 'selected' : ''}`}
              onClick={() => toggleCharSelect(c.id)}
            >
              {/* ── Portrait ── */}
              <div className="char-portrait-box">
                <CharPortrait id={c.id} size={160}
                  style={{ width: '100%', height: '100%', borderRadius: 0, flexShrink: 0 }} />
                <div className={`char-portrait-el el-${c.element}-color`}>{EL_LABEL[c.element]}</div>
                {sel && <div className="char-portrait-check">✓</div>}
              </div>

              {/* ── Info ── */}
              <div className="char-card-info">
                <div className="char-name">{c.name}</div>
                <div className="char-title">{c.title}</div>
                <div className="char-stats">
                  <div className="char-stat"><span>HP</span><b>{c.hp}</b></div>
                  <div className="char-stat"><span>ATK</span><b>{c.atk}</b></div>
                  <div className="char-stat"><span>DEF</span><b>{c.def}</b></div>
                  <div className="char-stat"><span>SPD</span><b>{c.spd}</b></div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button className="btn primary" disabled={!ready} onClick={() => onConfirm(selectedCharIds)}>
          確認選角 →
        </button>
        {!ready && <span className="hint">還需 {3 - selectedCharIds.length} 位</span>}
      </div>
    </div>
  )
}
