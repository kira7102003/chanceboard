const fs = require('fs')
const path = require('path')

const sourcePath = process.argv[2]
if (!sourcePath) throw new Error('Usage: node scripts/import-chanceboard-db.cjs <chanceboard_db.js>')

const raw = fs.readFileSync(sourcePath, 'utf8')
  .replace(/^\uFEFF?window\.CHANCEBOARD_DB\s*=\s*/, '')
  .replace(/;\s*$/, '')
const source = JSON.parse(raw)
const dbPath = path.resolve(__dirname, '../src/data/db.ts')
let db = fs.readFileSync(dbPath, 'utf8')

const cleanName = value => String(value ?? '').replace(/\([^)]*\)\s*$/, '').trim()
const statusKeys = {
  'HP+': 'hpPlus', 'HP-': 'hpMinus', 'ATK+': 'atkPlus', 'ATK-': 'atkMinus',
  'DEF+': 'defPlus', 'DEF-': 'defMinus', 'SPD+': 'spdPlus', 'SPD-': 'spdMinus',
  'BAT+': 'batPlus', 'BAT-': 'batMinus', '必中': 'sureHit', '迴避%': 'evasion',
  '封招': 'sealed', '禁足': 'rooted', '混亂': 'confused', '隱身': 'hidden',
  '燃燒': 'burning', '結冰': 'frozen', '減傷%': 'damageReduction', '連動': 'linked',
  '解放': 'liberated', '護盾+': 'shield', '麻痺': 'paralyzed', '威能': 'empowered',
  '覺醒': 'awakened', '強運': 'lucky', '還手': 'counter', '反擊': 'counter', '帶電': 'charged',
}
const targets = {
  ownHand: 'self', ownCell: 'sameCell', lowestHpAlly: 'allyLowestHp',
  enemyTeam: 'enemyAll', ownTeam: 'allyAll',
}
const distances = { near: 1, mid: 2, far: 3 }
const nonHumanTitles = new Set(['機器人', '人偶', '精靈'])

function convertOp(input) {
  const op = { ...input }
  if (op.op === 'status' && op.key === '魅影模式') {
    return { op: 'staticFlag', flag: 'nextMoveEffectMult', value: 2, chance: op.chance ?? 1 }
  }
  if (targets[op.target]) op.target = targets[op.target]
  if (op.key && statusKeys[op.key]) op.key = statusKeys[op.key]

  if (op.op === 'status' || op.op === 'statusByDistance') {
    if (op.durSec != null) { op.duration = op.durSec; delete op.durSec }
    if (op.mode === 'value') op.mode = 'flat'
    if (op.mode === 'pct' || op.key === 'evasion' || op.key === 'damageReduction') {
      op.mode = 'pct'
      if (typeof op.value === 'number' && Math.abs(op.value) <= 1) op.value *= 100
    }
  }
  if (op.op === 'discard') {
    if (op.mode === 'toCount') op.toCount = op.count
    if (op.mode === 'random1') { op.count = 1; op.random = true }
    if (op.mode === 'all') op.count = 'all'
    delete op.mode
  }
  if (op.op === 'healPct' || op.op === 'damagePct' || op.op === 'revive') {
    if (op.percent != null) op.pct = op.percent
    if (op.of != null) op.basis = op.of
    delete op.percent; delete op.of
  }
  if (op.op === 'knockback' || op.op === 'selfMove') {
    op.to = distances[op.dist]
    delete op.dist
  }
  if (op.op === 'drainStatus') {
    op.target = op.from === 'ownCell' ? 'sameCellAllies' : 'target'
    if (op.alsoDamage) op.withDamage = true
    delete op.from; delete op.to; delete op.alsoDamage
  }
  if (op.op === 'staticFlag') {
    op.flag = op.key
    delete op.key
    if (op.value == null) op.value = true
  }
  if (op.op === 'condHeal') {
    op.pct = op.percent
    op.threshold = op.below
    delete op.percent; delete op.below
  }
  if (op.op === 'condHealIfNoMove') { op.pct = op.percent; delete op.percent }
  if (op.op === 'deadAllyScaling') { op.pct = op.perDead; delete op.perDead }
  if (op.op === 'clearStatuses' && op.healCountBonus) {
    op.healPerStatus = true
    delete op.healCountBonus
  }
  return op
}

const characters = [...source.characters]
  .sort((a, b) => a.id.localeCompare(b.id))
  .map(c => ({
    id: c.id, name: cleanName(c.name), title: cleanName(c.title),
    gender: c.gender === '女' ? 'female' : 'male', element: c.element,
    isHuman: !nonHumanTitles.has(cleanName(c.title)),
    hp: c.hp, atk: c.atk, def: c.def, spd: c.spd,
    moveNameSword: cleanName(c.moveNameSword), moveNameGun: cleanName(c.moveNameGun),
    moveNameMagic: cleanName(c.moveNameMagic), moveNameWish: cleanName(c.moveNameWish),
    passiveName: cleanName(c.passiveName), story: c.story,
  }))

const moves = [...source.moves]
  .sort((a, b) => Number(a.id) - Number(b.id))
  .map(m => ({
    id: m.id, ownerId: m.ownerId, slot: m.slot, name: cleanName(m.name),
    condition: m.condition, rangeType: m.rangeType, scope: m.scope,
    powerRatio: m.powerRatio, hitRate: m.hitRate, critRate: m.critRate,
    cooldown: m.cooldown, description: m.id === '025'
      ? '機器人不得傷害人類角色；非人類可正常命中，且必中或血腥機關期間可蓋過此限制'
      : m.description,
    effectTrigger: m.effectTrigger, effectOps: (m.effectOps ?? []).map(convertOp),
    effectChance: m.effectChance ?? 1,
  }))

const render = value => JSON.stringify(value, null, 2)
const replaceExport = (name, type, value, nextMarker) => {
  const start = db.indexOf(`export const ${name}: ${type}[] = [`)
  const end = nextMarker ? db.indexOf(nextMarker, start) : db.length
  if (start < 0 || end < 0) throw new Error(`Cannot locate ${name} export`)
  const separator = nextMarker ? '\n\n' : '\n'
  db = db.slice(0, start) + `export const ${name}: ${type}[] = ${render(value)}${separator}` + db.slice(end)
}

replaceExport('characters', 'Character', characters, '// ─── Statuses')
replaceExport('moves', 'Move', moves, null)
fs.writeFileSync(dbPath, db, 'utf8')
console.log(`Imported ${characters.length} characters and ${moves.length} moves from ${sourcePath}`)
