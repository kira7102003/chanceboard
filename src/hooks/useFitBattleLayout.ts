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

// Ported from chanceboard.html's fitBattleLayout(): split the space below the
// header between the arena and the act row by the action panel's actual content
// size, clamp so neither side collapses, and scale the act row down (instead of
// letting it grow/scroll) if it still doesn't fit at the clamped height.
// (The hand row now lives inside the act panel itself, so no extra HAND_H.)
const ACT_ROW_MIN_H = 170
const BOARD_RATIO_MIN = 0.35
const BOARD_RATIO_SHORT_H = 500
const BOARD_RATIO_TALL_H = 800
const ARENA_CHROME_V = 16 // .battle-arena vertical padding
const SAFETY = 3

export function useFitBattleLayout(refs: FitBattleLayoutRefs) {
  const rafRef = useRef<number | null>(null)
  // Largest act-panel content seen so far: the row keeps that height even
  // while showing shorter content (等待行動/查看), so the log panel and the
  // 輪到… row stay put instead of jumping every turn.
  const maxDesiredRef = useRef(0)

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

      const actionAreaScrollH = actionAreaEl.scrollHeight
      maxDesiredRef.current = Math.max(maxDesiredRef.current, actionAreaScrollH)
      const desiredActRowH = maxDesiredRef.current

      const minBoardH = mainH * BOARD_RATIO_MIN
      const maxActRowH = mainH - minBoardH
      const actRowH = Math.max(ACT_ROW_MIN_H, Math.min(maxActRowH, desiredActRowH))
      actRowEl.style.setProperty('--act-row-h', `${Math.round(actRowH)}px`)

      const arenaH = mainH - actRowH
      let cellH = Math.max(100, Math.round(arenaH - ARENA_CHROME_V - SAFETY))

      // Clamp by available column width too, so a tall-but-narrow viewport
      // can't blow the card's aspect-ratio-derived width past its column
      // (mirrors the reference's max-height/max-width formulas, which were
      // both derived from the same viewport value and so stayed in sync).
      // .slot-col's max-width is itself derived from --board-cell-h, so uncap
      // it first — measuring under the previous value would lock cellH there.
      arenaEl.style.setProperty('--board-cell-h', '9999px')
      const slotColW = slotColRef.current?.clientWidth
      if (slotColW && slotColW > 0) {
        const maxCellHByWidth = Math.floor(slotColW / CARD_ASPECT)
        cellH = Math.min(cellH, maxCellHByWidth)
      }

      arenaEl.style.setProperty('--board-cell-h', `${cellH}px`)

      const availableForActionArea = actRowH
      if (actionAreaScrollH > 0 && availableForActionArea > 30 && actionAreaScrollH > availableForActionArea) {
        const boardRatioT = Math.max(0, Math.min(1, (mainH - BOARD_RATIO_SHORT_H) / (BOARD_RATIO_TALL_H - BOARD_RATIO_SHORT_H)))
        const scaleFloor = 0.4 + boardRatioT * 0.2
        const scale = Math.max(scaleFloor, availableForActionArea / actionAreaScrollH)
        actionAreaEl.style.transform = `scale(${scale})`
        // At the scale floor the content may still be taller than the row —
        // keep it scrollable then, or the confirm row gets clipped away.
        actionAreaEl.style.overflowY =
          scale * actionAreaScrollH > availableForActionArea + 1 ? 'auto' : 'hidden'
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
