import { useLayoutEffect, useRef, type RefObject } from 'react'

interface FitBattleLayoutRefs {
  battleMainRef: RefObject<HTMLDivElement | null>
  arenaRef: RefObject<HTMLDivElement | null>
  actRowRef: RefObject<HTMLDivElement | null>
  actionAreaRef: RefObject<HTMLDivElement | null>
  slotColRef: RefObject<HTMLDivElement | null>
  cardsRowRef: RefObject<HTMLDivElement | null>
}

// Matches the Admin portrait-crop tool's 768x1376 target (24:43), not the
// generic 307:458 card shape — see .slot-cards-stack in index.css.
const CARD_ASPECT = 24 / 43

// 戰場與操作區固定採參考畫面的 62:38 視覺比例；六個角色欄位
// 同時受「寬度÷立繪比例」限制，窄螢幕只會等比縮小、不改變構圖。
// 面板底線 = 手牌列自然高度（整排最寬、不縮放不裁切）+ 訊息/招式區底線；
// 訊息/招式區塞不下時用 transform:scale 縮進去，而不是反過來壓縮人物。
const ACT_TOP_MIN_H = 60
const ACT_TOP_MIN_H_SHORT = 60 // 手機橫向等矮螢幕：上半底線再低，多留給人物
const SHORT_MAIN_H = 520
const SCALE_FLOOR_SHORT_H = 500
const SCALE_FLOOR_TALL_H = 800
const ARENA_CHROME_V = 16 // .battle-arena vertical padding
const SAFETY = 3
const ARENA_RATIO = 0.62

export function useFitBattleLayout(refs: FitBattleLayoutRefs) {
  const rafRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    const { battleMainRef, arenaRef, actRowRef, actionAreaRef, slotColRef, cardsRowRef } = refs

    const fit = () => {
      const mainEl = battleMainRef.current
      const arenaEl = arenaRef.current
      const actRowEl = actRowRef.current
      // actionArea / cardsRow 在觀戰模式不存在 — arena 的計算照常跑
      const actionAreaEl = actionAreaRef.current
      const cardsRowEl = cardsRowRef.current
      if (!mainEl || !arenaEl || !actRowEl) return

      // Reset any previous scale before measuring natural content height.
      if (actionAreaEl) {
        actionAreaEl.style.transform = 'none'
        actionAreaEl.style.width = '100%'
        actionAreaEl.style.overflowY = 'auto'
      }

      const mainH = mainEl.clientHeight
      if (mainH <= 0) return

      // 先清除上一輪高度，再讀取 flex 已平均分配後的單格實際寬度。
      // 這個寬度已扣除戰場 padding、五個 gap 與中央分隔線。
      arenaEl.style.setProperty('--board-cell-h', '9999px')
      const slotColW = slotColRef.current?.clientWidth ?? 0

      const cardsRowH = cardsRowEl?.offsetHeight ?? 0
      const minTopH = mainH < SHORT_MAIN_H ? ACT_TOP_MIN_H_SHORT : ACT_TOP_MIN_H
      const minActRowH = cardsRowH + minTopH
      const ratioCellH = Math.round(mainH * ARENA_RATIO - ARENA_CHROME_V)
      const availableCellH = mainH - minActRowH - ARENA_CHROME_V - SAFETY
      let cellH = Math.max(100, Math.min(ratioCellH, availableCellH))
      if (slotColW > 0) {
        // 六格先平均寬度，再用 24:43 圖片比例求出可用高度；
        // 最後才把角色、狀態與重疊卡填進格內。
        cellH = Math.min(cellH, Math.floor(slotColW / CARD_ASPECT))
      }
      arenaEl.style.setProperty('--board-cell-h', `${cellH}px`)

      // 面板拿剩下的（寬度限制住 cellH 時剩的會比底線多）。
      // 高度只由視窗與欄寬決定，不隨回合內容變動 → 面板不會位移。
      const actRowH = Math.max(minActRowH, mainH - (cellH + ARENA_CHROME_V + SAFETY))
      actRowEl.style.setProperty('--act-row-h', `${Math.round(actRowH)}px`)

      if (actionAreaEl) {
        // 手牌列吃固定高度，訊息/招式區只能用剩下的上半
        const topH = actRowH - cardsRowH
        const actionAreaScrollH = actionAreaEl.scrollHeight
        if (actionAreaScrollH > 0 && topH > 30 && actionAreaScrollH > topH) {
          const t = Math.max(0, Math.min(1, (mainH - SCALE_FLOOR_SHORT_H) / (SCALE_FLOOR_TALL_H - SCALE_FLOOR_SHORT_H)))
          const scaleFloor = 0.4 + t * 0.2
          const scale = Math.max(scaleFloor, topH / actionAreaScrollH)
          actionAreaEl.style.transform = `scale(${scale})`
          // Scaling also shrinks the panel horizontally. Compensate its layout
          // width so the rendered panel still fills all available screen space.
          actionAreaEl.style.width = `${100 / scale}%`
          // At the scale floor the content may still be taller than the row —
          // keep it scrollable then, or the bottom rows get clipped away.
          actionAreaEl.style.overflowY =
            scale * actionAreaScrollH > topH + 1 ? 'auto' : 'hidden'
        }
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
    if (cardsRowRef.current) ro.observe(cardsRowRef.current)

    // act-panel 的盒子尺寸固定（flex 撐滿），內容變多時 ResizeObserver 不會觸發
    // → 換回合/選招後 scale 會沿用舊值、把底下內容截掉；改盯 DOM 內容變動重算。
    const mo = new MutationObserver(schedule)
    if (actionAreaRef.current) {
      mo.observe(actionAreaRef.current, { childList: true, subtree: true, characterData: true })
    }

    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)

    return () => {
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // Refs are stable across renders; fit() always reads refs.current live, so this
    // only needs to run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
