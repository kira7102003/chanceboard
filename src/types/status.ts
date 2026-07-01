export type StatusKey =
  | 'hpPlus' | 'hpMinus'
  | 'atkPlus' | 'atkMinus'
  | 'defPlus' | 'defMinus'
  | 'spdPlus' | 'spdMinus'
  | 'batPlus' | 'batMinus'
  | 'sureHit' | 'evasion'
  | 'sealed' | 'rooted' | 'confused'
  | 'hidden' | 'burning' | 'frozen'
  | 'damageReduction' | 'linked' | 'liberated'
  | 'shield' | 'paralyzed' | 'empowered'
  | 'awakened' | 'lucky' | 'counter'

export type StatusMode = 'flat' | 'pct'

export interface StatusEntry {
  key: StatusKey
  mode: StatusMode
  value: number
  expiresAt: number
}

export interface StatusDef {
  id: string
  name: string
  description: string
}
