export interface ScoreBreakdown {
  win:           number   // 勝利獎勵
  kos:           number   // 擊倒數量
  koScore:       number
  survival:      number   // 0–1 存活率
  survivalScore: number
  lostUnits:     number   // 己方陣亡數
  lostPenalty:   number
  rounds:        number
  roundScore:    number   // 速攻獎勵
}

export interface ScoreResult {
  grade:     'S' | 'A' | 'B' | 'C' | 'D'
  total:     number
  breakdown: ScoreBreakdown
}
