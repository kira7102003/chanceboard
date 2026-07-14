import { useLayoutEffect, useRef, type RefObject } from 'react'

interface FitBattleLayoutRefs {
  battleMainRef: RefObject<HTMLDivElement | null>
  arenaRef: RefObject<HTMLDivElement | null>
  actRowRef: RefObject<HTMLDivElement | null>
  actionAreaRef: RefObject<HTMLDivElement | null>
  slotColRef: RefObject<HTMLDivElement | null>
}

// Matches the Admin portrait-crop tool's 768x1376 target (24:43), not the
// generic 307:458 card shape — see .slot-cards-stack in index.css.
const CARD_ASPECT = 24 / 43

// 六個角色欄位優先：先讓格子吃到最大（同時受「寬度÷比例」與
// 「下方面板最低高度」限制），剩餘高度才分給下方面板；面板內容
// 塞不下時用 transform:scale 縮進去，而不是反過來壓縮人物。
const ACT_ROW_MIN_H = 170
const ACT_ROW_MIN_H_SHORT = 130 // 手機橫向等矮螢幕：面板底線再低一點，多留給人物
const SHORT_MAIN_H = 520
const SCALE_FLOOR_SHORT_H = 500
const SCALE_FLOOR_TALL_H = 800
const ARENA_CHROME_V = 16 // .battle-arena vertical padding
const SAFETY = 3

export function useFitBattleLayout(refs: FitBattleLayoutRefs) {
  const rafRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    const { battleMainRef, arenaRef, actRowRef, actionAreaRef, slotColRef } = refs

    const fit = () => {
      const mainEl = battleMainRef.current
      const arenaEl = arenaRef.current
      const actRowEl = actRowRef.current
      const actionAreaEl = actionAreaRef.current
      if (!mainEl || !arenaEl || !actRowEl || !actionAreaEl) return

      // Reset any previous scale before measuring natural content height.
      actionAreaEl.style.transform = 'none'
      actionAreaEl.style.overflowY = 'auto'

      const mainH = mainEl.clientHeight
      if (mainH <= 0) return

      // .slot-col's max-width is itself derived from --board-cell-h, so uncap
      // it first — measuring under the previous value would lock cellH there.
      arenaEl.style.setProperty('--board-cell-h', '9999px')
      const slotColW = slotColRef.current?.clientWidth ?? 0

      const minActRowH = mainH < SHORT_MAIN_H ? ACT_ROW_MIN_H_SHORT : ACT_ROW_MIN_H
      let cellH = Math.max(100, Math.round(mainH - minActRowH - ARENA_CHROME_V - SAFETY))
      if (slotColW > 0) {
        // 寬度上限：六欄均分後，卡片高不能超過 欄寬÷(24/43)，比例才固定
        cellH = Math.min(cellH, Math.floor(slotColW / CARD_ASPECT))
      }
      arenaEl.style.setProperty('--board-cell-h', `${cellH}px`)

      // 面板拿剩下的（寬度限制住 cellH 時剩的會比底線多）。
      // 高度只由視窗與欄寬決定，不隨回合內容變動 → 面板不會位移。
      const actRowH = Math.max(minActRowH, mainH - (cellH + ARENA_CHROME_V + SAFETY))
      actRowEl.style.setProperty('--act-row-h', `${Math.round(actRowH)}px`)

      const actionAreaScrollH = actionAreaEl.scrollHeight
      if (actionAreaScrollH > 0 && actRowH > 30 && actionAreaScrollH > actRowH) {
        const t = Math.max(0, Math.min(1, (mainH - SCALE_FLOOR_SHORT_H) / (SCALE_FLOOR_TALL_H - SCALE_FLOOR_SHORT_H)))
        const scaleFloor = 0.4 + t * 0.2
        const scale = Math.max(scaleFloor, actRowH / actionAreaScrollH)
        actionAreaEl.style.transform = `scale(${scale})`
        // At the scale floor the content may still be taller than the row —
        // keep it scrollable then, or the confirm row gets clipped away.
        actionAreaEl.style.overflowY =
          scale * actionAreaScrollH > actRowH + 1 ? 'auto' : 'hidden'
      }
    }

    const schedule = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(fit)
    }

    schedule()

    const ro = new ResizeObserver(schedule)
    if (battleMainRef.current) ro.observe(battleMainRef.current)
    if (actionAreaRef.current) ro.observe(actionAreaRef.current)
    if (slotColRef.current) ro.observe(slotColRef.current)

    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // Refs are stable across renders; fit() always reads refs.current live, so this
    // only needs to run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
