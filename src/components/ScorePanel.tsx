/**
 * View — solo battle score result panel.
 */
import type { ScoreResult } from '../types/score'

interface Props {
  result:   ScoreResult
  onReplay: () => void
  onBack:   () => void
}

const GRADE_STYLE: Record<ScoreResult['grade'], { color: string; shadow: string }> = {
  S: { color: '#fff0c0', shadow: '0 0 32px #ffd700cc' },
  A: { color: '#e8cc88', shadow: '0 0 20px #c8a15a99' },
  B: { color: '#88ccff', shadow: '0 0 16px #4488ffaa' },
  C: { color: '#aaccaa', shadow: '0 0 10px #44aa6688' },
  D: { color: '#998899', shadow: '0 0 8px #66446688' },
}

export default function ScorePanel({ result, onReplay, onBack }: Props) {
  const gs = GRADE_STYLE[result.grade]
  const b  = result.breakdown

  return (
    <div className="score-panel">
      <div className="score-grade" style={{ color: gs.color, textShadow: gs.shadow }}>
        {result.grade}
      </div>
      <div className="score-total">{result.total.toLocaleString()} 分</div>

      <table className="score-table">
        <tbody>
          <tr>
            <td>勝負</td>
            <td className={b.win > 0 ? 'sc-plus' : 'sc-zero'}>
              {b.win > 0 ? `+${b.win}` : '—'}
            </td>
          </tr>
          <tr>
            <td>擊倒敵方 {b.kos} / 3</td>
            <td className="sc-plus">+{b.koScore}</td>
          </tr>
          <tr>
            <td>存活率 {Math.round(b.survival * 100)}%</td>
            <td className="sc-plus">+{b.survivalScore}</td>
          </tr>
          {b.lostPenalty < 0 && (
            <tr>
              <td>己方陣亡 {b.lostUnits} 名</td>
              <td className="sc-minus">{b.lostPenalty}</td>
            </tr>
          )}
          <tr>
            <td>第 {b.rounds} 回合結束</td>
            <td className="sc-plus">+{b.roundScore}</td>
          </tr>
        </tbody>
      </table>

      <div className="score-actions">
        <button className="btn primary" onClick={onReplay}>再挑戰</button>
        <button className="btn"         onClick={onBack}>返回大廳</button>
      </div>
    </div>
  )
}
