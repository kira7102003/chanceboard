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

type LogKind = 'move' | 'damage' | 'miss' | 'status' | 'defeat' | 'cards' | 'heal' | 'movement' | 'pass' | 'system'

function getLogKind(text: string): LogKind {
  if (/^【.+】/.test(text)) return 'move'
  if (/Miss|MISS|閃避/i.test(text)) return 'miss'
  if (/倒下|戰敗|勝利/.test(text)) return 'defeat'
  if (/受到.+傷害|HP\s*-|爆擊/.test(text)) return 'damage'
  if (/獲得.+狀態|狀態解除|混亂|麻痺|中毒|禁錮|護盾|shield|confused|rooted|paralyzed|batMinus/i.test(text)) return 'status'
  if (/抽.+張牌|丟棄.+張|棄牌|手牌|打出|回收|交換/.test(text)) return 'cards'
  if (/\+\s*\d+\s*HP|回復.+HP/.test(text)) return 'heal'
  if (/移至|移動/.test(text)) return 'movement'
  if (/PASS|待機/.test(text)) return 'pass'
  return 'system'
}

function getLogAccent(text: string, line: BattleLogEntry): string {
  const classes: string[] = []
  if (/^A\s/.test(text)) classes.push('log-side-a')
  if (/^B\s/.test(text)) classes.push('log-side-b')
  if (/爆擊/.test(text)) classes.push('log-critical')
  const slotClass: Record<string, string> = { '劍': 'sword', '槍': 'gun', '法': 'magic', '願': 'wish' }
  const slot = line.moveAnim?.moveSlot
  if (slot && slotClass[slot]) classes.push(`log-move-${slotClass[slot]}`)
  return classes.join(' ')
}

const BattleLog = forwardRef<HTMLDivElement, Props>(function BattleLog(
  { entries, className = 'log-panel' }, ref,
) {
  return (
    <div className={className} ref={ref}>
      {entries.map((line, i) => {
        const text = logText(line.html)
        const kind = getLogKind(text)
        const accent = getLogAccent(text, line)
        return <div className={`log-line log-${kind}${accent ? ` ${accent}` : ''}`} key={i}>{text}</div>
      })}
    </div>
  )
})

export default BattleLog
