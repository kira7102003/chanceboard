import { characters, moves, cards } from '../data/db'
import type { GameState } from '../types/game'
import type { MoveSlot } from '../types/move'
import {
  initBattleState, makeUnit, doExecuteMove, doPass, tickATB,
  fastForwardToNextReady, getReadyUnits, autoPlayUnit, doPlayCard,
} from './atb'
import { runEffectOps } from './effects'
import { resolveHit } from './combat'
import { getMoveImg } from '../utils/charStore'

export interface DiagnosticLine {
  ok: boolean
  characterId: string
  characterName: string
  item: string
  message: string
}

export interface MoveTestReport {
  passed: number
  failed: number
  total: number
  durationMs: number
  lines: DiagnosticLine[]
  checklist: Array<{ label: string; ok: boolean; detail: string }>
}

function healthy(state: GameState): boolean {
  return [...state.teamA, ...state.teamB].every(unit =>
    Number.isFinite(unit.hp) && Number.isFinite(unit.nextActionAt) &&
    unit.statuses.every(status => Number.isFinite(status.value) && Number.isFinite(status.expiresAt)))
}

/** Browser-safe counterpart of scripts/test-all-moves.mjs for the admin UI. */
function verifyImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const timer = setTimeout(() => reject(new Error('招式圖片載入逾時')), 12000)
    image.onload = () => {
      clearTimeout(timer)
      if (image.naturalWidth <= 0 || image.naturalHeight <= 0) reject(new Error('招式圖片尺寸無效'))
      else resolve()
    }
    image.onerror = () => { clearTimeout(timer); reject(new Error('招式圖片載入失敗（網址失效或 404）')) }
    image.src = url
  })
}

export async function runAllMoveTests(roster = characters): Promise<MoveTestReport> {
  const started = performance.now()
  const originalRandom = Math.random
  const lines: DiagnosticLine[] = []
  const verifiedActiveImages = new Set<string>()
  const verifiedPassiveImages = new Set<string>()
  let comboCheck = { ok: false, detail: '尚未執行' }
  let stressCheck = { ok: false, detail: '尚未執行' }
  const slots: MoveSlot[] = ['劍', '槍', '法', '願', '被']
  const suitColor: Partial<Record<MoveSlot, string>> = { 劍: 'red', 槍: 'green', 法: 'blue', 願: 'yellow' }
  Math.random = () => 0

  try {
    for (const character of roster) {
      const kit = moves.filter(move => move.ownerId === character.id)
      for (const slot of slots) {
        const move = kit.find(item => item.slot === slot)
        const item = move ? `${slot} ${move.name}` : `${slot}（缺少資料）`
        try {
          if (!move) throw new Error('缺少招式資料')
          if (move.name === '?' || !move.description || move.description === '待定') throw new Error('名稱或說明尚未完成')

          if (slot === '被') {
            if (!move.effectTrigger || move.effectOps.length === 0) throw new Error('被動沒有可執行效果')
            const passiveImage = getMoveImg(move.id)
            if (!passiveImage) throw new Error(`缺少被動圖片：cb_move_img_${move.id}`)
            await verifyImage(passiveImage)
            verifiedPassiveImages.add(move.id)
            const actor = makeUnit(character.id, 'A', 3, 0)
            const opponentId = character.id === '001' ? '002' : '001'
            const state = initBattleState([character.id], [opponentId], 'pawn')
            const log: { html: string }[] = []
            if (move.effectTrigger === 'roundStart' || move.effectTrigger === 'roundEnd') {
              state.clock = 99
              if (!healthy(tickATB(state))) throw new Error('回合被動產生無效狀態')
            } else if (move.effectTrigger === 'onPass') {
              if (!healthy(doPass(state, state.teamA[0].id))) throw new Error('PASS 被動執行失敗')
            } else if (move.effectTrigger === 'onHit') {
              runEffectOps(move.effectOps, state.teamA[0], state.teamB[0], state, 0, 1, log)
              if (!healthy(state)) throw new Error('命中被動產生無效狀態')
            } else if (move.effectTrigger === 'battleStart' && Object.keys(actor.flags).length === 0 && actor.statuses.length === 0) {
              throw new Error('開戰被動未套用')
            }
          } else {
            const opponentIds = ['001', '002', '018'].map(id => id === character.id ? '004' : id)
            const state = initBattleState([character.id], opponentIds, 'pawn')
            const actor = state.teamA[0]
            const need = move.condition ?? 1
            const card = cards.find(entry => entry.color === suitColor[slot])
            if (!card) throw new Error('找不到對應花色手牌')
            state.handA = Array.from({ length: need }, () => ({ ...card }))
            state.handCustomA = []
            const target = move.rangeType === '法' ? state.teamB[2] : state.teamB[0]
            const result = doExecuteMove(state, { unitId: actor.id, moveSlot: slot, targetId: target.id, cardId: null })
            if (result === state) throw new Error('出手後遊戲狀態沒有更新')
            if (!result.log.some(entry => entry.html.includes(move.name))) throw new Error('戰鬥紀錄缺少招式名稱')
            const animation = [...result.log].reverse().find(entry => entry.moveAnim)?.moveAnim
            if (!animation) throw new Error('出手後沒有建立招式動畫資料')
            if (animation.moveId !== move.id || animation.moveName !== move.name) {
              throw new Error(`招式動畫對應錯誤：預期 ${move.id}/${move.name}，實際 ${animation.moveId}/${animation.moveName}`)
            }
            const moveImage = getMoveImg(move.id)
            if (!moveImage) throw new Error(`缺少招式圖片：cb_move_img_${move.id}`)
            await verifyImage(moveImage)
            verifiedActiveImages.add(move.id)
            if (result.discardPublic.filter(entry => entry.id === card.id).length < need) throw new Error('沒有正確消耗手牌')
            if (move.cooldown) {
              const after = result.teamA.find(unit => unit.id === actor.id)!
              if (after.moveCooldownUntil[move.id] !== state.clock + move.cooldown * 100) throw new Error('冷卻回合錯誤')
            }
            if (!healthy(result)) throw new Error('招式產生無效 HP／ATB／狀態')
          }
          lines.push({ ok: true, characterId: character.id, characterName: character.name, item, message: 'PASS' })
        } catch (error) {
          lines.push({ ok: false, characterId: character.id, characterName: character.name, item,
            message: error instanceof Error ? error.message : String(error) })
        }
      }
    }

    const robot = makeUnit('005', 'A', 3, 0)
    const human = makeUnit('001', 'B', 1, 0)
    const heather = makeUnit('018', 'B', 1, 0)
    if (resolveHit(robot, human, robot.moves['劍']).hit) throw new Error('機器人三定律：人類應受到保護')
    if (!resolveHit(robot, heather, robot.moves['劍']).hit) throw new Error('機器人三定律：海瑟應可被命中')
    robot.statuses.push({ key: 'sureHit', mode: 'flat', value: 0, expiresAt: 500 })
    if (!resolveHit(robot, human, robot.moves['劍']).hit) throw new Error('機器人三定律：必中應可覆蓋被動')

    // Full interaction matrix: every attacker × flower card × active move ×
    // defender. Besides artwork, this exercises defender passives/statuses and
    // group targeting. Twocolors + 鎖定 is one case in this matrix.
    const flowerCards = cards.filter(card => !card.isSuitCard)
    let comboTotal = 0
    let comboPassed = 0
    let comboFailed = 0
    for (const character of roster) {
      const activeMoves = moves.filter(move => move.ownerId === character.id && move.slot !== '被')
      for (const flowerCard of flowerCards) {
        for (const move of activeMoves) {
          for (const defender of roster) {
            comboTotal++
            try {
              let comboState = initBattleState([character.id], [defender.id, defender.id, defender.id], 'pawn')
              comboState.teamA[0].nextActionAt = comboState.clock
              comboState.handA = [{ ...flowerCard }]
              comboState = doPlayCard(comboState, 'A', flowerCard.id)
              const comboActor = comboState.teamA[0]
              if (!comboState.log.some(entry => entry.html.includes(flowerCard.name))) throw new Error('花牌沒有成功使用')

              const color = suitColor[move.slot]
              const suitCard = cards.find(card => card.color === color)
              if (!suitCard) throw new Error('找不到招式花色牌')
              const need = comboActor.statuses.some(status => status.key === 'liberated') ? 1 : (move.condition ?? 1)
              comboState.handA.push(...Array.from({ length: need }, () => ({ ...suitCard })))
              const target = move.rangeType === '法' ? comboState.teamB[2] : comboState.teamB[0]
              const hpBefore = target.hp
              const comboResult = doExecuteMove(comboState, {
                unitId: comboActor.id, moveSlot: move.slot, targetId: target.id, cardId: null,
              })
              const animation = [...comboResult.log].reverse().find(entry => entry.moveAnim)?.moveAnim
              if (!animation || animation.moveId !== move.id || animation.moveName !== move.name) {
                throw new Error(`動畫錯圖：預期 cb_move_img_${move.id} ${move.name}`)
              }
              if (!getMoveImg(move.id)) throw new Error(`缺少招式圖片 cb_move_img_${move.id}`)
              if (!healthy(comboResult)) throw new Error('角色互動後產生無效 HP／ATB／狀態')

              // Explicit rule assertion inside the general matrix.
              if (character.id === '005' && defender.id === '001' && flowerCard.id === '018' && move.slot === '劍') {
                if (!comboActor.statuses.some(status => status.key === 'sureHit')) throw new Error('鎖定未套用必中')
                if (animation.missed || comboResult.teamB[0].hp >= hpBefore) throw new Error('必中未蓋過機器人三定律')
              }
              comboPassed++
            } catch (error) {
              comboFailed++
              lines.push({ ok: false, characterId: character.id, characterName: character.name,
                item: `${flowerCard.name}＋${move.name} → ${defender.name}`,
                message: error instanceof Error ? error.message : String(error) })
            }
            if (comboTotal % 100 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0))
          }
        }
      }
    }
    comboCheck = { ok: comboFailed === 0, detail: `${comboPassed}/${comboTotal} 組通過${comboFailed ? `，失敗 ${comboFailed}` : ''}` }

    // Deterministic 3v3 stress battles cover ally passives, AoE, death/revive,
    // round transitions, cooldowns and winner resolution across mixed teams.
    let stressPassed = 0
    let stressFailed = 0
    const stressTotal = Math.max(210, roster.length * 10)
    let seed = 0x5eed1234
    Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000)
    for (let test = 0; test < stressTotal; test++) {
      const at = (offset: number) => roster[(test + offset) % roster.length].id
      const teamA = [at(0), at(3), at(7)]
      const teamB = [at(11), at(15), at(19)]
      try {
        let state = initBattleState(teamA, teamB, 'king')
        let actions = 0
        while (state.phase !== 'end' && actions++ < 700) {
          state = fastForwardToNextReady(state)
          if (!healthy(state)) throw new Error('產生無效 HP／ATB／狀態')
          if (state.phase === 'end') break
          const ready = getReadyUnits(state)
          state = ready.length ? autoPlayUnit(state, ready[0]) : tickATB(state)
        }
        if (state.phase !== 'end' || !state.winner) throw new Error('戰鬥卡住或沒有勝負結果')
        stressPassed++
      } catch (error) {
        stressFailed++
        lines.push({ ok: false, characterId: 'TEAM', characterName: teamA.join('/'),
          item: `3v3 vs ${teamB.join('/')}`, message: error instanceof Error ? error.message : String(error) })
      }
      if (test % 4 === 3) await new Promise<void>(resolve => setTimeout(resolve, 0))
    }
    Math.random = () => 0
    stressCheck = { ok: stressFailed === 0, detail: `${stressPassed}/${stressTotal} 場完成${stressFailed ? `，失敗 ${stressFailed}` : ''}` }
  } catch (error) {
    lines.push({ ok: false, characterId: 'SYSTEM', characterName: '規則矩陣', item: '跨角色規則',
      message: error instanceof Error ? error.message : String(error) })
  } finally {
    Math.random = originalRandom
  }

  const passed = lines.filter(line => line.ok).length
  const rosterIds = new Set(roster.map(character => character.id))
  const activeCount = moves.filter(move => rosterIds.has(move.ownerId) && move.slot !== '被').length
  const passiveCount = moves.filter(move => rosterIds.has(move.ownerId) && move.slot === '被').length
  return {
    passed, failed: lines.length - passed, total: lines.length, durationMs: performance.now() - started, lines,
    checklist: [
      { label: '招式圖片', ok: verifiedActiveImages.size === activeCount, detail: `${verifiedActiveImages.size}/${activeCount} 張已載入並對應` },
      { label: '被動圖片', ok: verifiedPassiveImages.size === passiveCount, detail: `${verifiedPassiveImages.size}/${passiveCount} 張已載入並對應` },
      { label: '卡片＋招式＋對手', ...comboCheck },
      { label: '3v3 混戰壓力', ...stressCheck },
    ],
  }
}

export interface LadderRow {
  rank: number
  characterId: string
  characterName: string
  games: number
  wins: number
  losses: number
  draws: number
  winRate: number
  points: number
}

export interface LadderReport {
  mode: '1v1' | '3v3'
  gamesPerPair: number
  totalMatches: number
  durationMs: number
  rows: LadderRow[]
  log: string[]
  errors: number
  flowerCardsPlayed: number
  movesExecuted: number
  suitCardsSpent: number
}

function runAutoMatch(idsA: string[], idsB: string[]): GameState {
  let state = initBattleState(idsA, idsB, 'pawn')
  let actions = 0
  while (state.phase !== 'end' && actions++ < 500) {
    state = fastForwardToNextReady(state)
    if (state.phase === 'end') break
    const ready = getReadyUnits(state)
    if (ready.length === 0) state = tickATB(state)
    else state = autoPlayUnit(state, ready[0])
  }
  return state
}

export async function runWinRateLadder(
  gamesPerPair = 2,
  onProgress?: (done: number, total: number) => void,
  roster = characters,
  mode: '1v1' | '3v3' = '1v1',
): Promise<LadderReport> {
  const started = performance.now()
  const rounds = Math.max(2, Math.min(20, Math.floor(gamesPerPair)))
  const activeRoster = roster.filter(character => character.enabled !== false)
  const total = activeRoster.length * (activeRoster.length - 1) / 2 * rounds
  const stats = new Map(activeRoster.map(character => [character.id,
    { wins: 0, losses: 0, draws: 0, games: 0, points: 0 }]))
  const log: string[] = []
  let done = 0
  let errors = 0
  let flowerCardsPlayed = 0
  let movesExecuted = 0
  let suitCardsSpent = 0

  const recordMatch = (idsA: string[], idsB: string[], result: GameState | null, error?: unknown) => {
    const participants = [...idsA, ...idsB]
    for (const id of participants) stats.get(id)!.games++
    if (!result || error) {
      errors++
      for (const id of participants) stats.get(id)!.draws++
      return
    }
    flowerCardsPlayed += result.log.filter(entry => entry.html.includes('打出')).length
    const moveEntries = result.log.filter(entry => entry.moveAnim)
    movesExecuted += moveEntries.length
    suitCardsSpent += moveEntries.reduce((sum, entry) => sum + (entry.cardsSpent ?? 0), 0)
    if (result.winner === 'draw' || !result.winner) {
      for (const id of participants) { stats.get(id)!.draws++; stats.get(id)!.points++ }
      return
    }
    const winners = result.winner === 'A' ? idsA : idsB
    const losers = result.winner === 'A' ? idsB : idsA
    for (const id of winners) { stats.get(id)!.wins++; stats.get(id)!.points += 3 }
    for (const id of losers) stats.get(id)!.losses++
  }

  if (mode === '3v3') {
    const baseMatches = activeRoster.length * (activeRoster.length - 1) / 2
    const total3v3 = baseMatches * rounds
    const pickTeam = (anchor: number, blocked: Set<number>, salt: number) => {
      const indexes: number[] = [anchor]
      blocked.add(anchor)
      for (let step = 1; indexes.length < 3 && step <= activeRoster.length * 2; step++) {
        const candidate = (anchor + step * (salt + 1)) % activeRoster.length
        if (!blocked.has(candidate)) { blocked.add(candidate); indexes.push(candidate) }
      }
      for (let candidate = 0; indexes.length < 3 && candidate < activeRoster.length; candidate++) {
        if (!blocked.has(candidate)) { blocked.add(candidate); indexes.push(candidate) }
      }
      return indexes.map(index => activeRoster[index].id)
    }
    let matchIndex = 0
    for (let i = 0; i < activeRoster.length; i++) {
      for (let j = i + 1; j < activeRoster.length; j++) {
        for (let game = 0; game < rounds; game++) {
          const blocked = new Set<number>()
          const firstTeam = pickTeam(i, blocked, j + game)
          const secondTeam = pickTeam(j, blocked, i + game + 2)
          const swapped = game % 2 === 1
          const idsA = swapped ? secondTeam : firstTeam
          const idsB = swapped ? firstTeam : secondTeam
          try {
            const result = runAutoMatch(idsA, idsB)
            recordMatch(idsA, idsB, result)
            const namesA = idsA.map(id => activeRoster.find(c => c.id === id)!.name).join('／')
            const namesB = idsB.map(id => activeRoster.find(c => c.id === id)!.name).join('／')
            log.push(`#${matchIndex + 1} [${namesA}] vs [${namesB}] → ${result.winner === 'draw' ? '平手' : result.winner + ' 方勝'}（${result.winnerReason ?? '達行動上限'}）`)
          } catch (error) {
            recordMatch(idsA, idsB, null, error)
            log.push(`#${matchIndex + 1} 3v3 ERROR：${error instanceof Error ? error.message : String(error)}`)
          }
          matchIndex++; done++
          onProgress?.(done, total3v3)
          if (done % 2 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0))
        }
      }
    }
  } else {

  for (let i = 0; i < activeRoster.length; i++) {
    for (let j = i + 1; j < activeRoster.length; j++) {
      const first = activeRoster[i]
      const second = activeRoster[j]
      for (let game = 0; game < rounds; game++) {
        const swapped = game % 2 === 1
        const idA = swapped ? second.id : first.id
        const idB = swapped ? first.id : second.id
        try {
          const result = runAutoMatch([idA], [idB])
          recordMatch([idA], [idB], result)
          log.push(`#${done + 1} ${first.name} vs ${second.name} → ${result.winner === 'draw' ? '平手' : result.winner === (swapped ? 'B' : 'A') ? first.name + ' 勝' : second.name + ' 勝'}（${result.winnerReason ?? '達行動上限'}）`)
        } catch (error) {
          recordMatch([idA], [idB], null, error)
          log.push(`#${done + 1} ${first.name} vs ${second.name} → ERROR：${error instanceof Error ? error.message : String(error)}`)
        }
        done++
        onProgress?.(done, total)
        if (done % 4 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0))
      }
    }
  }
  }

  const rows = activeRoster.map(character => {
    const stat = stats.get(character.id)!
    return { rank: 0, characterId: character.id, characterName: character.name, ...stat,
      winRate: stat.games ? stat.wins / stat.games * 100 : 0 }
  }).sort((a, b) => b.points - a.points || b.winRate - a.winRate || b.wins - a.wins)
    .map((row, index) => ({ ...row, rank: index + 1 }))

  return { mode, gamesPerPair: rounds, totalMatches: total, durationMs: performance.now() - started, rows, log, errors, flowerCardsPlayed, movesExecuted, suitCardsSpent }
}
