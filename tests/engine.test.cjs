const assert = require('node:assert/strict');
const {
  createInitialState,
  placeEntity,
  tickGame,
  entityAt,
  DEFAULT_CONFIG,
  UNIT_BY_ID,
  territoryOwnerAt,
  isEmergencyCellActive,
  getEmergencyRow,
} = require('../.engine-build/index.js');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

function advance(state, ms, bot = false) {
  let current = state;
  let remaining = ms;
  while (remaining > 0) {
    const step = Math.min(250, remaining);
    current = tickGame(current, step, DEFAULT_CONFIG, bot);
    remaining -= step;
  }
  return current;
}

function withMana(state, side, mana = 10) {
  return {
    ...state,
    players: {
      ...state.players,
      [side]: { ...state.players[side], mana },
    },
  };
}

test('starts both sides at 3 mana and full Core HP', () => {
  const state = createInitialState(1);
  assert.equal(state.players.player.mana, 3);
  assert.equal(state.players.enemy.mana, 3);
  assert.equal(state.players.player.coreHp, 2500);
});

test('placement spends mana and occupies the chosen cell', () => {
  let state = createInitialState(2);
  const result = placeEntity(state, 'player', 'guardian', 3, 1);
  assert.equal(result.ok, true);
  state = result.state;
  assert.equal(state.players.player.mana, 1);
  assert.equal(entityAt(state, 3, 1).definitionId, 'guardian');
});

test('player cannot deploy into enemy starting territory', () => {
  const state = createInitialState(3);
  const result = placeEntity(state, 'player', 'guardian', 2, 1);
  assert.equal(result.ok, false);
});

test('mana regenerates at 1 every 2 seconds and caps at 10', () => {
  let state = createInitialState(4);
  state = advance(state, 4000);
  assert.equal(Number(state.players.player.mana.toFixed(2)), 5);
  state = advance(state, 30000);
  assert.equal(state.players.player.mana, 10);
});

test('frontline melee units attack across the center border', () => {
  let state = createInitialState(5);
  state = withMana(state, 'player');
  state = withMana(state, 'enemy');
  state = placeEntity(state, 'player', 'guardian', 3, 2).state;
  state = placeEntity(state, 'enemy', 'guardian', 2, 2).state;
  state = advance(state, 300);
  const player = entityAt(state, 3, 2);
  const enemy = entityAt(state, 2, 2);
  assert.equal(player.hp, UNIT_BY_ID.guardian.maxHp - UNIT_BY_ID.guardian.attackDamage);
  assert.equal(enemy.hp, UNIT_BY_ID.guardian.maxHp - UNIT_BY_ID.guardian.attackDamage);
});

test('a melee unit behind a friendly blocker cannot attack through it', () => {
  let state = createInitialState(6);
  state = withMana(state, 'player');
  state = withMana(state, 'enemy');
  state = placeEntity(state, 'player', 'guardian', 4, 0).state;
  state = placeEntity(state, 'player', 'barricade', 3, 0).state;
  state = placeEntity(state, 'enemy', 'guardian', 2, 0).state;
  const rearBefore = entityAt(state, 4, 0).hp;
  state = advance(state, 300);
  assert.equal(entityAt(state, 4, 0).hp, rearBefore);
  assert.equal(entityAt(state, 2, 0).hp, UNIT_BY_ID.guardian.maxHp);
  assert.ok(entityAt(state, 3, 0).hp < UNIT_BY_ID.barricade.maxHp);
});

test('ranged units can fire from behind the frontline', () => {
  let state = createInitialState(7);
  state = withMana(state, 'player');
  state = withMana(state, 'enemy');
  state = placeEntity(state, 'player', 'barricade', 3, 3).state;
  state = placeEntity(state, 'player', 'archer', 4, 3).state;
  state = placeEntity(state, 'enemy', 'guardian', 2, 3).state;
  state = advance(state, 300);
  assert.equal(entityAt(state, 2, 3).hp, UNIT_BY_ID.guardian.maxHp - UNIT_BY_ID.archer.attackDamage);
});

test('advance units move one cell forward after their movement cooldown', () => {
  let state = createInitialState(8);
  state = withMana(state, 'player');
  state = placeEntity(state, 'player', 'legionnaire', 3, 4).state;
  state = advance(state, 8000);
  const unit = state.entities.find((e) => e.definitionId === 'legionnaire');
  assert.equal(unit.row, 2);
  assert.equal(unit.col, 4);
});

test('advance is blocked by an occupied cell', () => {
  let state = createInitialState(9);
  state = withMana(state, 'player');
  state = withMana(state, 'enemy');
  state = placeEntity(state, 'player', 'legionnaire', 3, 1).state;
  state = placeEntity(state, 'enemy', 'barricade', 2, 1).state;
  state = advance(state, 8000);
  const unit = state.entities.find((e) => e.definitionId === 'legionnaire');
  assert.equal(unit.row, 3);
});

test('long-range units damage the enemy Core when the lane is clear', () => {
  let state = createInitialState(10);
  state = withMana(state, 'player');
  state = placeEntity(state, 'player', 'ballista', 3, 2).state;
  state = advance(state, 300);
  assert.equal(state.players.enemy.coreHp, DEFAULT_CONFIG.coreHp - UNIT_BY_ID.ballista.attackDamage);
});

test('splash attacks damage enemies beside the primary target', () => {
  let state = createInitialState(11);
  state = withMana(state, 'player');
  state = withMana(state, 'enemy');
  state = placeEntity(state, 'player', 'pyromancer', 5, 2).state;
  state = placeEntity(state, 'enemy', 'guardian', 2, 2).state;
  state = placeEntity(state, 'enemy', 'guardian', 2, 1).state;
  state = advance(state, 300);
  assert.equal(entityAt(state, 2, 2).hp, UNIT_BY_ID.guardian.maxHp - UNIT_BY_ID.pyromancer.attackDamage);
  assert.equal(entityAt(state, 2, 1).hp, UNIT_BY_ID.guardian.maxHp - UNIT_BY_ID.pyromancer.attackDamage * 0.5);
});

test('destroying a Core ends the match', () => {
  let state = createInitialState(12);
  state = withMana(state, 'player');
  state = placeEntity(state, 'player', 'ballista', 3, 0).state;
  state = {
    ...state,
    players: {
      ...state.players,
      enemy: { ...state.players.enemy, coreHp: 100 },
    },
  };
  state = advance(state, 300);
  assert.equal(state.winner, 'player');
  assert.equal(state.players.enemy.coreHp, 0);
});

test('enemy bot eventually deploys an affordable card', () => {
  let state = createInitialState(13);
  state = advance(state, 1500, true);
  assert.ok(state.entities.some((entity) => entity.owner === 'enemy'));
});

test('melee cannot deploy on the row closest to its own Core', () => {
  let state = createInitialState(14);
  state = withMana(state, 'player');
  const result = placeEntity(state, 'player', 'guardian', 5, 2);
  assert.equal(result.ok, false);
  assert.match(result.reason, /closest to your Core/);
});

test('ranged units may deploy on the protected home row', () => {
  let state = createInitialState(15);
  state = withMana(state, 'player');
  const result = placeEntity(state, 'player', 'archer', 5, 2);
  assert.equal(result.ok, true);
});

test('advancing into enemy territory captures the entered cell', () => {
  let state = createInitialState(16);
  state = withMana(state, 'player');
  state = placeEntity(state, 'player', 'legionnaire', 3, 4).state;
  state = advance(state, 8000);
  assert.equal(territoryOwnerAt(state, 2, 4), 'player');
});

test('captured territory becomes a legal deployment cell for its new owner', () => {
  let state = createInitialState(17);
  state = withMana(state, 'player');
  state = placeEntity(state, 'player', 'legionnaire', 3, 4).state;
  state = advance(state, 8000);
  state = withMana(state, 'player');
  state = advance(state, 8000);
  const result = placeEntity(state, 'player', 'archer', 2, 4);
  assert.equal(result.ok, true);
});

test('the defender can no longer deploy on a cell that was captured', () => {
  let state = createInitialState(18);
  state = withMana(state, 'player');
  state = withMana(state, 'enemy');
  state = placeEntity(state, 'player', 'legionnaire', 3, 1).state;
  state = advance(state, 8000);
  const result = placeEntity(state, 'enemy', 'archer', 2, 1);
  assert.equal(result.ok, false);
  assert.match(result.reason, /currently control/);
});

test('the final home row cannot be captured even when an invader enters it', () => {
  let state = createInitialState(19);
  state = withMana(state, 'player');
  state = placeEntity(state, 'player', 'legionnaire', 3, 3).state;
  state = advance(state, 24000);
  const invader = state.entities.find((e) => e.definitionId === 'legionnaire');
  assert.equal(invader.row, 0);
  assert.equal(territoryOwnerAt(state, 0, 3), 'enemy');
});

test('fully breaching the conquerable cells in a lane opens a defender emergency slot', () => {
  let state = createInitialState(20);
  state = withMana(state, 'player');
  state = placeEntity(state, 'player', 'legionnaire', 3, 0).state;
  state = advance(state, 16000);
  assert.equal(territoryOwnerAt(state, 2, 0), 'player');
  assert.equal(territoryOwnerAt(state, 1, 0), 'player');
  assert.equal(isEmergencyCellActive(state, 'enemy', 0), true);
  assert.equal(getEmergencyRow('enemy'), -1);
});

test('the defender can deploy into an active emergency slot', () => {
  let state = createInitialState(21);
  state = withMana(state, 'player');
  state = withMana(state, 'enemy');
  state = placeEntity(state, 'player', 'legionnaire', 3, 2).state;
  state = advance(state, 16000);
  const result = placeEntity(state, 'enemy', 'guardian', -1, 2);
  assert.equal(result.ok, true);
  assert.equal(entityAt(result.state, -1, 2).definitionId, 'guardian');
});

test('captured territory persists after the capturing unit is gone', () => {
  let state = createInitialState(22);
  state = withMana(state, 'player');
  state = placeEntity(state, 'player', 'legionnaire', 3, 1).state;
  state = advance(state, 8000);
  const invaderId = state.entities.find((e) => e.definitionId === 'legionnaire').id;
  state = { ...state, entities: state.entities.filter((e) => e.id !== invaderId) };
  assert.equal(territoryOwnerAt(state, 2, 1), 'player');
});

console.log(`\n${passed} engine tests passed.`);
