export type EffectTarget =
  | 'self' | 'target' | 'enemyAll' | 'allyAll'
  | 'sameCell' | 'allyLowestHp' | 'randomDeadAlly'
  | 'bothHands' | 'opponent'

export type EffectOpType =
  | 'status' | 'damagePct' | 'healPct' | 'healFlat' | 'kill'
  | 'discard' | 'draw' | 'fillToLimit'
  | 'swapHandsRandom' | 'swapHandsFull' | 'swapHP' | 'halveHP'
  | 'knockback' | 'selfMove' | 'drainStatus' | 'revive'
  | 'averageCellHP' | 'clearStatuses' | 'clearStatusKey' | 'staticFlag'
  | 'vengeanceScaling' | 'condHeal' | 'condHealIfNoMove'
  | 'recoverDiscard' | 'reflectHalfHeal' | 'powerMult'

export interface EffectOp {
  op: EffectOpType
  target?: EffectTarget
  [key: string]: unknown
}
