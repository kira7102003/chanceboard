export type EffectTarget =
  | 'self' | 'target' | 'enemyAll' | 'allyAll'
  | 'sameCell' | 'sameCellAllies' | 'allyLowestHp' | 'randomDeadAlly'
  | 'bothHands' | 'opponent'

export type EffectOpType =
  | 'status' | 'statusByDistance' | 'damagePct' | 'healPct' | 'healFlat' | 'kill'
  | 'discard' | 'draw' | 'fillToLimit'
  | 'swapHandsRandom' | 'swapHandsFull' | 'swapHP' | 'halveHP'
  | 'knockback' | 'selfMove' | 'drainStatus' | 'revive'
  | 'averageCellHP' | 'clearStatuses' | 'clearStatusKey' | 'staticFlag'
  | 'vengeanceScaling' | 'deadAllyScaling' | 'condHeal' | 'condHealIfNoMove'
  | 'recoverDiscard' | 'reflectHalfHeal' | 'powerMult'
  | 'chargeStack' | 'chargeSplash' | 'chargeDetonateIfThreeStacks' | 'chargeDetonate'

export interface EffectOp {
  op: EffectOpType
  target?: EffectTarget
  [key: string]: unknown
}
