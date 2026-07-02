/**
 * Model — pure score calculation from final game state.
 * No side effects, no store access.
 */
import type { GameState }   from '../types/game'
import type { ScoreResult } from '../types/score'

export function calcScore(game: GameState, playerSide: 'A' | 'B'): ScoreResult {
  const myTeam  = playerSide === 'A' ? game.teamA : game.teamB
  const foeTeam = playerSide === 'A' ? game.teamB : game.teamA

  // 勝負獎勵
  const win =
    game.winner === playerSide ? 300 :
    game.winner === 'draw'     ? 100 : 0

  // 擊倒獎勵 (每名 200 分)
  const kos     = foeTeam.filter(u => !u.alive).length
  const koScore = kos * 200

  // 存活率獎勵
  const totalMaxHp    = myTeam.reduce((s, u) => s + u.maxHp, 0)
  const remainingHp   = myTeam.reduce((s, u) => s + (u.alive ? u.hp : 0), 0)
  const survival      = totalMaxHp > 0 ? remainingHp / totalMaxHp : 0
  const survivalScore = Math.round(survival * 300)

  // 己方陣亡扣分 (每名 -150)
  const lostUnits   = myTeam.filter(u => !u.alive).length
  const lostPenalty = -(lostUnits * 150)

  // 速攻獎勵 (回合越少越高，最高 200)
  const rounds     = Math.min(game.round, 10)
  const roundScore = Math.round(((10 - rounds) / 9) * 200)

  const total = Math.max(0, win + koScore + survivalScore + lostPenalty + roundScore)

  const grade: ScoreResult['grade'] =
    total >= 900 ? 'S' :
    total >= 700 ? 'A' :
    total >= 500 ? 'B' :
    total >= 300 ? 'C' : 'D'

  return {
    grade, total,
    breakdown: { win, kos, koScore, survival, survivalScore, lostUnits, lostPenalty, rounds, roundScore },
  }
}
