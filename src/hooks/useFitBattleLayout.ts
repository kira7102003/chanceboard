import { useLayoutEffect, useRef, type RefObject } from 'react'

interface FitBattleLayoutRefs {
  battleMainRef: RefObject<HTMLDivElement | null>
  arenaRef: RefObject<HTMLDivElement | null>
  actRowRef: RefObject<HTMLDivElement | null>
  actionAreaRef: RefObject<HTMLDivElement | null>
  slotNameRef: RefObject<HTMLDivElement | null>
  slotColRef: RefObject<HTMLDivElement | null>
}

const CARD_ASPECT = 307 / 458

// Ported from chanceboard.html's fitBattleLayout(): split the space below the
// header between the arena and the act row by the action panel's actual content
// size, clamp so neither side collapses, and scale the act row down (instead of
// letting it grow/scroll) if it still doesn't fit at the clamped height.
const HAND_H = 116
const ACT_ROW_MIN_H = 150
const BOARD_RATIO_MIN = 0.35
const BOARD_RATIO_SHORT_H = 500
const BOARD_RATIO_TALL_H = 800
const ARENA_CHROME_V = 16 // .battle-arena vertical padding
const SAFETY = 3

export function useFitBattleLayout(refs: FitBattleLayoutRefs) {
  const rafRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    const { battleMainRef, arenaRef, actRowRef, actionAreaRef, slotNameRef, slotColRef } = refs

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

      const slotNameH = slotNameRef.current?.offsetHeight ?? 24
      const actionAreaScrollH = actionAreaEl.scrollHeight
      const desiredActRowH = actionAreaScrollH + HAND_H

      const minBoardH = mainH * BOARD_RATIO_MIN
      const maxActRowH = mainH - minBoardH
      const actRowH = Math.max(ACT_ROW_MIN_H, Math.min(maxActRowH, desiredActRowH))
      actRowEl.style.setProperty('--act-row-h', `${Math.round(actRowH)}px`)

      const arenaH = mainH - actRowH
      let cellH = Math.max(100, Math.round(arenaH - slotNameH - ARENA_CHROME_V - SAFETY))

      // Clamp by available column width too, so a tall-but-narrow viewport
      // can't blow the card's aspect-ratio-derived width past its column
      // (mirrors the reference's max-height/max-width formulas, which were
      // both derived from the same viewport value and so stayed in sync).
      const slotColW = slotColRef.current?.clientWidth
      if (slotColW && slotColW > 0) {
        const maxCellHByWidth = Math.floor(slotColW / CARD_ASPECT)
        cellH = Math.min(cellH, maxCellHByWidth)
      }

      arenaEl.style.setProperty('--board-cell-h', `${cellH}px`)

      const availableForActionArea = actRowH - HAND_H
      if (actionAreaScrollH > 0 && availableForActionArea > 30 && actionAreaScrollH > availableForActionArea) {
        const boardRatioT = Math.max(0, Math.min(1, (mainH - BOARD_RATIO_SHORT_H) / (BOARD_RATIO_TALL_H - BOARD_RATIO_SHORT_H)))
        const scaleFloor = 0.4 + boardRatioT * 0.2
        const scale = Math.max(scaleFloor, availableForActionArea / actionAreaScrollH)
        actionAreaEl.style.transform = `scale(${scale})`
        actionAreaEl.style.overflowY = 'hidden'
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
