const assert = require('node:assert/strict');
const {
  createGameConfig,
  createInitialState,
  placeEntity,
  tickGame,
  entityAt,
  DEFAULT_CONFIG,
  SKIRMISH_PRESETS,
  UNIT_BY_ID,
  territoryOwnerAt,
  territoryCount,
  isEmergencyCellActive,
  getEmergencyRow,
  getMatchRemainingMs,
  manualAdvanceEntity,
  claimPlayerHalfCell,
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

function chargeAndMove(state, side, entityId) {
  const entity = state.entities.find((candidate) => candidate.id === entityId);
  assert.ok(entity);
  const definition = UNIT_BY_ID[entity.definitionId];
  assert.ok(definition.advanceCooldownMs);
  let charged = advance(state, definition.advanceCooldownMs, false);
  const result = manualAdvanceEntity(charged, side, entityId);
  assert.equal(result.ok, true, result.reason);
  return result.state;
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

function withCard(state, side, id) {
  const player = state.players[side];
  const hand = [...player.cards.hand];
  hand[0] = id;
  return {
    ...state,
    players: {
      ...state.players,
      [side]: {
        ...player,
        cards: { ...player.cards, hand },
      },
    },
  };
}

function deploy(state, side, id, row, col) {
  let prepared = withMana(state, side);
  prepared = withCard(prepared, side, id);
  const result = placeEntity(prepared, side, id, row, col);
  assert.equal(result.ok, true, result.reason);
  return result.state;
}

function withCenterFrontlines(state) {
  const territory = state.territory.map((row) => [...row]);
  for (let col = 0; col < territory[0].length; col += 1) {
    territory[2][col] = 'enemy';
    territory[3][col] = 'player';
  }
  return { ...state, territory };
}

test('all skirmish presets contain 8 valid unique cards', () => {
  for (const preset of Object.values(SKIRMISH_PRESETS)) {
    assert.equal(preset.deck.length, 8);
    assert.equal(new Set(preset.deck).size, 8);
    for (const id of preset.deck) assert.ok(UNIT_BY_ID[id]);
  }
});

test('AI difficulty profiles change decision speed without changing player economy', () => {
  const easy = createGameConfig('easy');
  const normal = createGameConfig('normal');
  const hard = createGameConfig('hard');

  assert.ok(easy.enemyThinkEveryMs > normal.enemyThinkEveryMs);
  assert.ok(normal.enemyThinkEveryMs > hard.enemyThinkEveryMs);
  assert.ok(easy.aiTopChoices > normal.aiTopChoices);
  assert.ok(normal.aiTopChoices > hard.aiTopChoices);

  for (const config of [easy, normal, hard]) {
    assert.equal(config.startingMana, 3);
    assert.equal(config.maxMana, 10);
    assert.equal(config.manaPerSecond, 0.5);
    assert.equal(config.coreHp, 2500);
  }
});

test('initial state has regulation, 3 mana, full cores, 4-card hands and neutral center rows', () => {
  const state = createInitialState(1);
  assert.equal(state.phase, 'regulation');
  assert.equal(state.players.player.mana, 3);
  assert.equal(state.players.enemy.mana, 3);
  assert.equal(state.players.player.coreHp, 2500);
  assert.equal(state.players.player.cards.hand.length, 4);
  assert.equal(state.players.player.cards.deck.length, 8);
  assert.equal(territoryOwnerAt(state, 1, 0), 'enemy');
  assert.equal(territoryOwnerAt(state, 2, 0), 'neutral');
  assert.equal(territoryOwnerAt(state, 3, 0), 'neutral');
  assert.equal(territoryOwnerAt(state, 4, 0), 'player');
});

test('playing a card spends mana and rotates the hand', () => {
  let state = createInitialState(2);
  const used = state.players.player.cards.hand[0];
  const expectedDraw = state.players.player.cards.deck[4];
  const cost = UNIT_BY_ID[used].manaCost;
  const result = placeEntity(withMana(state, 'player'), 'player', used, 4, 1);
  assert.equal(result.ok, true);
  assert.equal(result.state.players.player.mana, 10 - cost);
  assert.equal(result.state.players.player.cards.hand[0], expectedDraw);
  assert.ok(!result.state.players.player.cards.hand.includes(used) || expectedDraw === used);
});

test('a card outside the current hand cannot be played', () => {
  const state = withMana(createInitialState(3), 'player');
  const result = placeEntity(state, 'player', 'barricade', 4, 0);
  assert.equal(result.ok, false);
  assert.match(result.reason, /not currently in your hand/);
});

test('player cannot deploy into the neutral center before conquest', () => {
  let state = createInitialState(4);
  state = withMana(state, 'player');
  const id = state.players.player.cards.hand[0];
  const result = placeEntity(state, 'player', id, 3, 1);
  assert.equal(result.ok, false);
  assert.match(result.reason, /Neutral center cells must be conquered first/);
});

test('player cannot deploy into enemy-controlled starting territory', () => {
  let state = createInitialState(41);
  state = withMana(state, 'player');
  const id = state.players.player.cards.hand[0];
  const result = placeEntity(state, 'player', id, 1, 1);
  assert.equal(result.ok, false);
});

test('mana regenerates at 1 every 2 seconds and caps at 10 in regulation', () => {
  let state = createInitialState(5);
  state = advance(state, 4000);
  assert.equal(Number(state.players.player.mana.toFixed(2)), 5);
  state = advance(state, 30000);
  assert.equal(state.players.player.mana, 10);
});

test('overtime doubles mana regeneration to 1 per second', () => {
  let state = createInitialState(6);
  state = {
    ...state,
    timeMs: DEFAULT_CONFIG.regulationMs,
    phase: 'overtime',
    players: {
      player: { ...state.players.player, mana: 3 },
      enemy: { ...state.players.enemy, mana: 3 },
    },
  };
  state = advance(state, 2000);
  assert.equal(Number(state.players.player.mana.toFixed(2)), 5);
});

test('melee cannot deploy on the protected row closest to its Core', () => {
  let state = withMana(createInitialState(7), 'player');
  state = withCard(state, 'player', 'guardian');
  const result = placeEntity(state, 'player', 'guardian', 5, 2);
  assert.equal(result.ok, false);
  assert.match(result.reason, /closest to your Core/);
});

test('ranged units may deploy on the protected home row', () => {
  let state = withMana(createInitialState(8), 'player');
  state = withCard(state, 'player', 'archer');
  const result = placeEntity(state, 'player', 'archer', 5, 2);
  assert.equal(result.ok, true);
});

test('frontline melee units attack each other across the center border', () => {
  let state = withCenterFrontlines(createInitialState(9));
  state = deploy(state, 'player', 'guardian', 3, 2);
  state = deploy(state, 'enemy', 'guardian', 2, 2);
  state = advance(state, 300);
  assert.equal(entityAt(state, 3, 2).hp, UNIT_BY_ID.guardian.maxHp - UNIT_BY_ID.guardian.attackDamage);
  assert.equal(entityAt(state, 2, 2).hp, UNIT_BY_ID.guardian.maxHp - UNIT_BY_ID.guardian.attackDamage);
});

test('a melee unit behind a friendly blocker cannot attack through it', () => {
  let state = withCenterFrontlines(createInitialState(10));
  state = deploy(state, 'player', 'guardian', 4, 0);
  state = deploy(state, 'player', 'barricade', 3, 0);
  state = deploy(state, 'enemy', 'guardian', 2, 0);
  state = advance(state, 300);
  assert.equal(entityAt(state, 2, 0).hp, UNIT_BY_ID.guardian.maxHp);
  assert.ok(entityAt(state, 3, 0).hp < UNIT_BY_ID.barricade.maxHp);
});

test('ranged units can fire from behind the frontline', () => {
  let state = withCenterFrontlines(createInitialState(11));
  state = deploy(state, 'player', 'barricade', 3, 3);
  state = deploy(state, 'player', 'archer', 4, 3);
  state = deploy(state, 'enemy', 'guardian', 2, 3);
  state = advance(state, 300);
  assert.equal(entityAt(state, 2, 3).hp, UNIT_BY_ID.guardian.maxHp - UNIT_BY_ID.archer.attackDamage);
});

test('filled movement charge waits for player input and then advances for free', () => {
  let state = createInitialState(12);
  state = deploy(state, 'player', 'legionnaire', 4, 4);
  const unit = state.entities.find((e) => e.definitionId === 'legionnaire');
  const manaBefore = state.players.player.mana;

  state = advance(state, UNIT_BY_ID.legionnaire.advanceCooldownMs);
  assert.equal(state.entities.find((e) => e.id === unit.id).row, 4);

  const result = manualAdvanceEntity(state, 'player', unit.id);
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.state.entities.find((e) => e.id === unit.id).row, 3);
  assert.equal(result.state.players.player.mana, manaBefore + UNIT_BY_ID.legionnaire.advanceCooldownMs / 2000);
  assert.equal(territoryOwnerAt(result.state, 3, 4), 'player');
});

test('ready movement is blocked when the cell ahead is occupied', () => {
  let state = createInitialState(13);
  state = {
    ...state,
    territory: state.territory.map((row) => [...row]),
  };
  state.territory[3][1] = 'enemy';
  state = deploy(state, 'player', 'legionnaire', 4, 1);
  state = deploy(state, 'enemy', 'barricade', 3, 1);
  const unit = state.entities.find((e) => e.definitionId === 'legionnaire');
  state = advance(state, UNIT_BY_ID.legionnaire.advanceCooldownMs);
  const result = manualAdvanceEntity(state, 'player', unit.id);
  assert.equal(result.ok, false);
  assert.match(result.reason, /occupied/);
  assert.equal(result.state.entities.find((e) => e.id === unit.id).row, 4);
});

test('captured territory persists after the capturing unit is removed', () => {
  let state = createInitialState(14);
  state = deploy(state, 'player', 'legionnaire', 4, 1);
  const id = state.entities.find((e) => e.definitionId === 'legionnaire').id;
  state = chargeAndMove(state, 'player', id);
  state = { ...state, entities: state.entities.filter((e) => e.id !== id) };
  assert.equal(territoryOwnerAt(state, 3, 1), 'player');
});

test('captured territory becomes a legal deployment cell for its new owner', () => {
  let state = createInitialState(15);
  state = deploy(state, 'player', 'legionnaire', 4, 4);
  const invader = state.entities.find((e) => e.definitionId === 'legionnaire');
  state = chargeAndMove(state, 'player', invader.id);
  state = { ...state, entities: state.entities.filter((e) => e.id !== invader.id) };
  state = withMana(state, 'player');
  state = withCard(state, 'player', 'archer');
  const result = placeEntity(state, 'player', 'archer', 3, 4);
  assert.equal(result.ok, true);
});

test('protected final home row never changes territory owner', () => {
  let state = createInitialState(16);
  state = deploy(state, 'player', 'legionnaire', 4, 3);
  const invader = state.entities.find((e) => e.definitionId === 'legionnaire');
  state = chargeAndMove(state, 'player', invader.id);
  state = chargeAndMove(state, 'player', invader.id);
  state = chargeAndMove(state, 'player', invader.id);
  state = chargeAndMove(state, 'player', invader.id);
  assert.equal(state.entities.find((e) => e.id === invader.id).row, 0);
  assert.equal(territoryOwnerAt(state, 0, 3), 'enemy');
});

test('fully breaching a lane opens the defender emergency slot', () => {
  let state = createInitialState(17);
  state = deploy(state, 'player', 'legionnaire', 4, 0);
  const invader = state.entities.find((e) => e.definitionId === 'legionnaire');
  state = chargeAndMove(state, 'player', invader.id);
  state = chargeAndMove(state, 'player', invader.id);
  state = chargeAndMove(state, 'player', invader.id);
  assert.equal(territoryOwnerAt(state, 2, 0), 'player');
  assert.equal(territoryOwnerAt(state, 1, 0), 'player');
  assert.equal(isEmergencyCellActive(state, 'enemy', 0), true);
  assert.equal(getEmergencyRow('enemy'), -1);
});

test('defender can deploy melee into an active emergency slot', () => {
  let state = createInitialState(18);
  state = deploy(state, 'player', 'legionnaire', 4, 2);
  const invader = state.entities.find((e) => e.definitionId === 'legionnaire');
  state = chargeAndMove(state, 'player', invader.id);
  state = chargeAndMove(state, 'player', invader.id);
  state = chargeAndMove(state, 'player', invader.id);
  state = withMana(state, 'enemy');
  state = withCard(state, 'enemy', 'guardian');
  const result = placeEntity(state, 'enemy', 'guardian', -1, 2);
  assert.equal(result.ok, true);
  assert.equal(entityAt(result.state, -1, 2).definitionId, 'guardian');
});

test('splash attacks damage enemies in adjacent columns', () => {
  let state = createInitialState(19);
  state = deploy(state, 'player', 'pyromancer', 5, 2);
  state = deploy(state, 'enemy', 'guardian', 1, 2);
  state = deploy(state, 'enemy', 'guardian', 1, 1);
  state = advance(state, 300);
  assert.equal(entityAt(state, 1, 2).hp, UNIT_BY_ID.guardian.maxHp - UNIT_BY_ID.pyromancer.attackDamage);
  assert.equal(entityAt(state, 1, 1).hp, UNIT_BY_ID.guardian.maxHp - UNIT_BY_ID.pyromancer.attackDamage * 0.5);
});

test('long-range artillery can damage a clear enemy Core', () => {
  let state = createInitialState(20);
  state = deploy(state, 'player', 'ballista', 5, 2);
  state = advance(state, 300);
  assert.equal(state.players.enemy.coreHp, DEFAULT_CONFIG.coreHp - UNIT_BY_ID.ballista.attackDamage);
});

test('destroying a Core ends the match immediately', () => {
  let state = createInitialState(21);
  state = deploy(state, 'player', 'ballista', 5, 0);
  state = {
    ...state,
    players: {
      ...state.players,
      enemy: { ...state.players.enemy, coreHp: 100 },
    },
  };
  state = advance(state, 300);
  assert.equal(state.winner, 'player');
  assert.equal(state.phase, 'finished');
});

test('enemy bot deploys only from its current hand', () => {
  let state = createInitialState(22);
  const originalHand = [...state.players.enemy.cards.hand];
  state = advance(state, 1500, true);
  const deployed = state.entities.find((entity) => entity.owner === 'enemy');
  assert.ok(deployed);
  assert.ok(originalHand.includes(deployed.definitionId));
});

test('regulation clock ends match when Core HP is not tied', () => {
  let state = createInitialState(23);
  state = {
    ...state,
    timeMs: DEFAULT_CONFIG.regulationMs - 100,
    players: {
      ...state.players,
      enemy: { ...state.players.enemy, coreHp: 2000 },
    },
  };
  state = advance(state, 100);
  assert.equal(state.winner, 'player');
  assert.equal(state.phase, 'finished');
});

test('equal Core HP at regulation sends match to overtime', () => {
  let state = createInitialState(24);
  state = { ...state, timeMs: DEFAULT_CONFIG.regulationMs - 100 };
  state = advance(state, 100);
  assert.equal(state.winner, null);
  assert.equal(state.phase, 'overtime');
});

test('overtime tie on Core HP is resolved by territory control', () => {
  let state = createInitialState(25);
  state = {
    ...state,
    phase: 'overtime',
    timeMs: DEFAULT_CONFIG.regulationMs + DEFAULT_CONFIG.overtimeMs - 100,
    territory: state.territory.map((row) => [...row]),
  };
  state.territory[2][0] = 'player';
  assert.equal(territoryCount(state, 'player'), 11);
  state = advance(state, 100);
  assert.equal(state.winner, 'player');
});

test('perfect overtime tie ends in a draw', () => {
  let state = createInitialState(26);
  state = {
    ...state,
    phase: 'overtime',
    timeMs: DEFAULT_CONFIG.regulationMs + DEFAULT_CONFIG.overtimeMs - 100,
  };
  state = advance(state, 100);
  assert.equal(state.winner, 'draw');
  assert.equal(state.phase, 'finished');
});

test('remaining clock reports regulation and overtime correctly', () => {
  let state = createInitialState(27);
  assert.equal(getMatchRemainingMs(state), DEFAULT_CONFIG.regulationMs);
  state = { ...state, timeMs: 60_000 };
  assert.equal(getMatchRemainingMs(state), 120_000);
  state = { ...state, phase: 'overtime', timeMs: DEFAULT_CONFIG.regulationMs + 10_000 };
  assert.equal(getMatchRemainingMs(state), 50_000);
});


test('movement is free once its charge is ready', () => {
  let state = createInitialState(28);
  state = deploy(state, 'player', 'guardian', 4, 2);
  const unit = state.entities.find((entity) => entity.owner === 'player' && entity.definitionId === 'guardian');
  state = advance(state, UNIT_BY_ID.guardian.advanceCooldownMs);
  const manaBefore = state.players.player.mana;
  const result = manualAdvanceEntity(state, 'player', unit.id);
  assert.equal(result.ok, true);
  assert.equal(result.state.players.player.mana, manaBefore);
  assert.equal(result.state.entities.find((entity) => entity.id === unit.id).row, 3);
  assert.equal(territoryOwnerAt(result.state, 3, 2), 'player');
});

test('movement cannot be used before the charge is ready', () => {
  let state = createInitialState(29);
  state = deploy(state, 'player', 'guardian', 4, 1);
  const unit = state.entities.find((entity) => entity.owner === 'player' && entity.definitionId === 'guardian');
  const result = manualAdvanceEntity(state, 'player', unit.id);
  assert.equal(result.ok, false);
  assert.match(result.reason, /still charging/);
  assert.equal(result.state.entities.find((entity) => entity.id === unit.id).row, 4);
});

test('movement-focused units recharge faster than ranged support units', () => {
  assert.ok(UNIT_BY_ID.knight.advanceCooldownMs < UNIT_BY_ID.archer.advanceCooldownMs);
  assert.ok(UNIT_BY_ID.legionnaire.advanceCooldownMs < UNIT_BY_ID.pyromancer.advanceCooldownMs);
  assert.ok(UNIT_BY_ID.ram.advanceCooldownMs < UNIT_BY_ID.crossbow.advanceCooldownMs);
});

test('structures remain static and have no movement charge', () => {
  for (const id of ['tower', 'barricade', 'ballista']) {
    assert.equal(UNIT_BY_ID[id].kind, 'structure');
    assert.equal(UNIT_BY_ID[id].advanceCooldownMs, undefined);
  }
});

test('connected empty territory in the player half costs 1 mana to claim', () => {
  let state = createInitialState(30);
  state = withMana(state, 'player', 5);
  const result = claimPlayerHalfCell(state, 3, 0);
  assert.equal(result.ok, true);
  assert.equal(result.state.players.player.mana, 4);
  assert.equal(territoryOwnerAt(result.state, 3, 0), 'player');
});

test('isolated empty territory in the player half costs 2 mana to claim', () => {
  let state = createInitialState(31);
  const territory = state.territory.map((row) => [...row]);
  territory[3][2] = 'enemy';
  territory[4][2] = 'enemy';
  territory[3][1] = 'enemy';
  territory[3][3] = 'enemy';
  state = { ...state, territory };
  state = withMana(state, 'player', 5);

  const result = claimPlayerHalfCell(state, 3, 2);
  assert.equal(result.ok, true);
  assert.equal(result.state.players.player.mana, 3);
  assert.equal(territoryOwnerAt(result.state, 3, 2), 'player');
});

test('territory cannot be bought directly in the enemy half', () => {
  let state = withMana(createInitialState(32), 'player', 5);
  const result = claimPlayerHalfCell(state, 2, 0);
  assert.equal(result.ok, false);
  assert.equal(result.state.players.player.mana, 5);
  assert.match(result.reason, /your half/);
});

test('occupied territory cannot be claimed manually', () => {
  let state = createInitialState(33);
  state = deploy(state, 'player', 'guardian', 4, 0);
  const territory = state.territory.map((row) => [...row]);
  territory[4][0] = 'enemy';
  state = { ...state, territory };
  state = withMana(state, 'player', 5);

  const result = claimPlayerHalfCell(state, 4, 0);
  assert.equal(result.ok, false);
  assert.equal(result.state.players.player.mana, 5);
  assert.match(result.reason, /empty/);
});

console.log(`\n${passed} engine tests passed.`);
