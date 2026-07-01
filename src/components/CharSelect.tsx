import { useGameStore } from '../store/gameStore'
import { characters } from '../data/db'

const EL_ICON: Record<string, string> = { sword: '⚔️', gun: '🔫', magic: '✨' }

interface Props {
  onConfirm: (ids: string[]) => void
}

export default function CharSelect({ onConfirm }: Props) {
  const { selectedCharIds, toggleCharSelect, mySide, playerCount } = useGameStore()

  const ready = selectedCharIds.length === 3

  const confirm = () => {
    if (ready) onConfirm(selectedCharIds)
  }

  return (
    <div className="char-select">
      <h2>選擇角色 — 你是 <span className={`side side-${mySide}`}>{mySide} 方</span></h2>
      <p className="hint">選 3 位角色（已選 {selectedCharIds.length}/3）</p>

      <div className="char-grid">
        {characters.map(c => {
          const sel = selectedCharIds.includes(c.id)
          return (
            <div
              key={c.id}
              className={`char-card ${sel ? 'selected' : ''}`}
              onClick={() => toggleCharSelect(c.id)}
            >
              <div className="char-name">{c.name}</div>
              <div className="char-title">{c.title}</div>
              <div className="char-el">{EL_ICON[c.element]} {c.element}</div>
              <div className="char-stats">
                HP {c.hp} | ATK {c.atk} | DEF {c.def} | SPD {c.spd}
              </div>
            </div>
          )
        })}
      </div>

      <button className="btn primary" disabled={!ready} onClick={confirm}>
        確認選擇 →
      </button>

      {playerCount < 2 && (
        <p className="waiting">等待對手加入…</p>
      )}
    </div>
  )
}
