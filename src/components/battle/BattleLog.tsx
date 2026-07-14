import { forwardRef } from 'react'
import type { BattleLogEntry } from '../../types/game'

interface Props {
  entries: BattleLogEntry[]
  className?: string
}

/** Battle logs are legacy formatted strings. Convert them to plain text before
 * rendering so edited character/move names can never inject markup or scripts. */
export function logText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.body.textContent ?? ''
}

const BattleLog = forwardRef<HTMLDivElement, Props>(function BattleLog(
  { entries, className = 'log-panel' }, ref,
) {
  return (
    <div className={className} ref={ref}>
      {entries.map((line, i) => <div className="log-line" key={i}>{logText(line.html)}</div>)}
    </div>
  )
})

export default BattleLog
