import type { PieceType } from '../types/piece'
import { useGameStore } from '../store/gameStore'

const PIECES: { type: PieceType; name: string; desc: string }[] = [
  { type: 'pawn',   name: '兵',   desc: '均衡牌組，多張主牌' },
  { type: 'knight', name: '馬',   desc: '偏劍槽，多花牌強化/弱化' },
  { type: 'castle', name: '城',   desc: '偏槍槽，多換牌/控制花牌' },
  { type: 'bishop', name: '象',   desc: '偏法槽，多回復/復活花牌' },
  { type: 'queen',  name: '后',   desc: '偏願槽，多速度/爆擊花牌' },
  { type: 'king',   name: '王',   desc: '均衡但有全套稀有花牌' },
]

interface Props {
  onConfirm: (p: PieceType) => void
}

export default function PieceSelect({ onConfirm }: Props) {
  const { selectedPiece, selectPiece } = useGameStore()

  return (
    <div className="piece-select">
      <h2>選擇棋子類型</h2>
      <p className="hint">棋子決定公共牌組的花牌分佈</p>

      <div className="piece-grid">
        {PIECES.map(p => (
          <div
            key={p.type}
            className={`piece-card ${selectedPiece === p.type ? 'selected' : ''}`}
            onClick={() => selectPiece(p.type)}
          >
            <div className="piece-name">{p.name}</div>
            <div className="piece-type">{p.type}</div>
            <div className="piece-desc">{p.desc}</div>
          </div>
        ))}
      </div>

      <button
        className="btn primary"
        disabled={!selectedPiece}
        onClick={() => selectedPiece && onConfirm(selectedPiece)}
      >
        確認 →
      </button>
    </div>
  )
}
