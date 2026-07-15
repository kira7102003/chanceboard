import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const originalRandom = Math.random

try {
  const { characters, moves, cards } = await server.ssrLoadModule('/src/data/db.ts')
  const { initBattleState, makeUnit, doExecuteMove, doPass, tickATB } = await server.ssrLoadModule('/src/engine/atb.ts')
  const { runEffectOps } = await server.ssrLoadModule('/src/engine/effects.ts')

  Math.random = () => 0
  assert.equal(moves.length, characters.length * 5, 'every character must have five moves/passives')

  const slots = ['劍', '槍', '法', '願', '被']
  const suitColor = { 劍: 'red', 槍: 'green', 法: 'blue', 願: 'yellow' }
  const tested = []

  function assertStateHealthy(state, label) {
    for (const unit of [...state.teamA, ...state.teamB]) {
      assert.ok(Number.isFinite(unit.hp), `${label}: ${unit.name} HP is not finite`)
      assert.ok(Number.isFinite(unit.nextActionAt), `${label}: ${unit.name} ATB is not finite`)
      for (const status of unit.statuses) {
        assert.ok(Number.isFinite(status.value), `${label}: invalid status value`)
        assert.ok(Number.isFinite(status.expiresAt), `${label}: invalid status expiry`)
      }
    }
  }

  for (const character of characters) {
    const kit = moves.filter(move => move.ownerId === character.id)
    assert.equal(kit.length, 5, `${character.name}: kit must contain five entries`)
    assert.deepEqual(new Set(kit.map(move => move.slot)), new Set(slots), `${character.name}: missing or duplicate slot`)

    for (const move of kit) {
      const label = `${character.id} ${character.name} / ${move.slot} ${move.name}`
      assert.notEqual(move.name, '?', `${label}: placeholder name`)
      assert.ok(move.description && move.description !== '待定', `${label}: missing description`)

      if (move.slot === '被') {
        assert.ok(move.effectTrigger, `${label}: passive has no trigger`)
        assert.ok(move.effectOps.length > 0, `${label}: passive has no executable effect`)

        const actor = makeUnit(character.id, 'A', 3, 0)
        const enemy = makeUnit(character.id === '001' ? '002' : '001', 'B', 1, 0)
        const state = initBattleState([character.id], [enemy.characterId], 'pawn')
        const stateActor = state.teamA[0]
        const log = []

        if (move.effectTrigger === 'roundStart' || move.effectTrigger === 'roundEnd') {
          state.clock = 99
          assertStateHealthy(tickATB(state), label)
        } else if (move.effectTrigger === 'onPass') {
          assertStateHealthy(doPass(state, stateActor.id), label)
        } else if (move.effectTrigger === 'onHit') {
          runEffectOps(move.effectOps, stateActor, state.teamB[0], state, state.clock, 1, log)
          assertStateHealthy(state, label)
        } else if (move.effectTrigger === 'battleStart') {
          assert.ok(Object.keys(actor.flags).length > 0 || actor.statuses.length > 0,
            `${label}: battleStart passive was not applied by makeUnit`)
        }

        tested.push(label)
        continue
      }

      const opponentIds = ['001', '002', '018'].map(id => id === character.id ? '004' : id)
      const state = initBattleState([character.id], opponentIds, 'pawn')
      const actor = state.teamA[0]
      const need = move.condition ?? 1
      const card = cards.find(c => c.color === suitColor[move.slot])
      assert.ok(card, `${label}: suit card missing`)
      state.handA = Array.from({ length: need }, () => ({ ...card }))
      state.handCustomA = []
      const discardBefore = state.discardPublic.filter(c => c.id === card.id).length
      const target = move.rangeType === '法' ? state.teamB[2] : state.teamB[0]
      const result = doExecuteMove(state, {
        unitId: actor.id, moveSlot: move.slot, targetId: target.id, cardId: null,
      })

      assert.notEqual(result, state, `${label}: execution returned unchanged state`)
      assert.ok(result.discardPublic.filter(c => c.id === card.id).length >= discardBefore + need,
        `${label}: paid suit cards were not consumed`)
      assert.ok(result.log.some(entry => entry.html.includes(move.name)), `${label}: move missing from battle log`)
      if (move.cooldown) {
        const resultActor = result.teamA.find(unit => unit.id === actor.id)
        assert.equal(resultActor.moveCooldownUntil[move.id], state.clock + move.cooldown * 100,
          `${label}: cooldown is not measured in rounds`)
      }
      assertStateHealthy(result, label)
      tested.push(label)
    }
  }

  // Robot Law matrix: humans are protected, Heather is not, sure-hit overrides.
  const robot = makeUnit('005', 'A', 3, 0)
  const human = makeUnit('001', 'B', 1, 0)
  const heather = makeUnit('018', 'B', 1, 0)
  const { resolveHit } = await server.ssrLoadModule('/src/engine/combat.ts')
  assert.equal(resolveHit(robot, human, robot.moves['劍']).hit, false, 'Robot Law must protect humans')
  assert.equal(resolveHit(robot, heather, robot.moves['劍']).hit, true, 'Robot Law must not protect Heather')
  robot.statuses.push({ key: 'sureHit', mode: 'flat', value: 0, expiresAt: 500 })
  assert.equal(resolveHit(robot, human, robot.moves['劍']).hit, true, 'sure-hit must override Robot Law')

  console.log(`PASS: ${tested.length}/${characters.length * 5} moves and passives executed successfully`)
  for (const character of characters) console.log(`  ${character.id} ${character.name}: 5/5`)
} finally {
  Math.random = originalRandom
  await server.close()
}
