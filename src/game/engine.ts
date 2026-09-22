import {
  BOARD_COLS,
  BOARD_ROWS,
  AiDifficulty,
  CardCycleState,
  Entity,
  GameConfig,
  GameState,
  PlacementResult,
  Side,
  UnitDefinition,
  Winner,
} from './types';
import { nextRandom } from './rng';
import { STARTER_DECK, UNIT_BY_ID } from './units';

export function createGameConfig(difficulty: AiDifficulty = 'normal'): GameConfig {
  const ai = {
    easy: { enemyThinkEveryMs: 1300, aiTopChoices: 8 },
    normal: { enemyThinkEveryMs: 850, aiTopChoices: 4 },
    hard: { enemyThinkEveryMs: 550, aiTopChoices: 2 },
  }[difficulty];

  return {
    startingMana: 3,
    maxMana: 10,
    manaPerSecond: 0.5,
    overtimeManaPerSecond: 1,
    coreHp: 2500,
    enemyThinkEveryMs: ai.enemyThinkEveryMs,
    regulationMs: 180_000,
    overtimeMs: 60_000,
    deckSize: 8,
    handSize: 4,
    aiDifficulty: difficulty,
    aiTopChoices: ai.aiTopChoices,
  };
}

export const DEFAULT_CONFIG: GameConfig = createGameConfig('normal');

const directionFor = (side: Side) => (side === 'player' ? -1 : 1);
const enemyOf = (side: Side): Side => (side === 'player' ? 'enemy' : 'player');

function createCardCycle(deck: string[], handSize: number): CardCycleState {
  const normalizedDeck = [...deck];
  return {
    deck: normalizedDeck,
    hand: normalizedDeck.slice(0, Math.min(handSize, normalizedDeck.length)),
    drawIndex: Math.min(handSize, normalizedDeck.length),
  };
}

function rotateUsedCard(cards: CardCycleState, definitionId: string): CardCycleState {
  const index = cards.hand.indexOf(definitionId);
  if (index < 0 || cards.deck.length === 0) return cards;

  const nextCard = cards.deck[cards.drawIndex % cards.deck.length];
  const hand = [...cards.hand];
  hand[index] = nextCard;

  return {
    ...cards,
    hand,
    drawIndex: cards.drawIndex + 1,
  };
}

export function createInitialTerritory(): Side[][] {
  return Array.from({ length: BOARD_ROWS }, (_, row) =>
    Array.from({ length: BOARD_COLS }, () => (row <= 2 ? 'enemy' : 'player') as Side),
  );
}

export function createInitialState(
  seed = 1337,
  config: GameConfig = DEFAULT_CONFIG,
  playerDeck: string[] = STARTER_DECK,
  enemyDeck: string[] = STARTER_DECK,
): GameState {
  const validateDeck = (deck: string[]) => {
    const valid = deck.filter((id) => Boolean(UNIT_BY_ID[id])).slice(0, config.deckSize);
    return valid.length > 0 ? valid : [...STARTER_DECK];
  };

  return {
    timeMs: 0,
    phase: 'regulation',
    players: {
      player: {
        mana: config.startingMana,
        coreHp: config.coreHp,
        cards: createCardCycle(validateDeck(playerDeck), config.handSize),
      },
      enemy: {
        mana: config.startingMana,
        coreHp: config.coreHp,
        cards: createCardCycle(validateDeck(enemyDeck), config.handSize),
      },
    },
    entities: [],
    territory: createInitialTerritory(),
    winner: null,
    nextEntityId: 1,
    nextEventId: 1,
    rngState: seed | 0,
    enemyNextActionAt: 1000,
    events: [],
  };
}

export function isNormalBoardCell(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS;
}

export function isProtectedHomeRow(side: Side, row: number): boolean {
  return side === 'player' ? row === BOARD_ROWS - 1 : row === 0;
}

export function getEmergencyRow(side: Side): number {
  return side === 'player' ? BOARD_ROWS : -1;
}

export function territoryOwnerAt(state: GameState, row: number, col: number): Side | null {
  if (!isNormalBoardCell(row, col)) return null;
  return state.territory[row][col];
}

export function entityAt(state: GameState, row: number, col: number): Entity | undefined {
  return state.entities.find((entity) => entity.row === row && entity.col === col && entity.hp > 0);
}

export function territoryCount(state: GameState, side: Side): number {
  return state.territory.flat().filter((owner) => owner === side).length;
}

export function getMatchRemainingMs(state: GameState, config: GameConfig = DEFAULT_CONFIG): number {
  if (state.phase === 'finished') return 0;
  if (state.phase === 'regulation') return Math.max(0, config.regulationMs - state.timeMs);
  return Math.max(0, config.regulationMs + config.overtimeMs - state.timeMs);
}

export function isEmergencyCellActive(state: GameState, side: Side, col: number): boolean {
  if (col < 0 || col >= BOARD_COLS) return false;
  const emergencyRow = getEmergencyRow(side);
  if (entityAt(state, emergencyRow, col)?.owner === side) return true;

  const attacker = enemyOf(side);
  const conquerableRows = side === 'player' ? [3, 4] : [1, 2];
  return conquerableRows.every((row) => state.territory[row][col] === attacker);
}

function appendEvent(state: GameState, text: string): GameState {
  const event = { id: state.nextEventId, timeMs: state.timeMs, text };
  return {
    ...state,
    nextEventId: state.nextEventId + 1,
    events: [...state.events.slice(-11), event],
  };
}

function finish(state: GameState, winner: Winner, text: string): GameState {
  if (state.winner) return state;
  return appendEvent({ ...state, winner, phase: 'finished' }, text);
}

function isEmergencyCoordinateFor(side: Side, row: number, col: number): boolean {
  return row === getEmergencyRow(side) && col >= 0 && col < BOARD_COLS;
}

export function canDeployDefinitionAt(
  state: GameState,
  side: Side,
  definition: UnitDefinition,
  row: number,
  col: number,
): { ok: boolean; reason?: string } {
  if (state.winner) return { ok: false, reason: 'The match is over.' };

  const emergency = isEmergencyCoordinateFor(side, row, col);
  if (emergency) {
    if (!isEmergencyCellActive(state, side, col)) {
      return { ok: false, reason: 'That emergency slot is not active.' };
    }
    if (entityAt(state, row, col)) return { ok: false, reason: 'That emergency slot is occupied.' };
    return { ok: true };
  }

  if (!isNormalBoardCell(row, col)) return { ok: false, reason: 'Outside the board.' };
  if (territoryOwnerAt(state, row, col) !== side) {
    return { ok: false, reason: 'You can deploy only on territory you currently control.' };
  }
  if (entityAt(state, row, col)) return { ok: false, reason: 'That cell is occupied.' };

  if (definition.deploymentRule === 'not_home_row' && isProtectedHomeRow(side, row)) {
    return { ok: false, reason: 'This melee unit cannot be deployed on the row closest to your Core.' };
  }

  return { ok: true };
}

export function placeEntity(
  state: GameState,
  side: Side,
  definitionId: string,
  row: number,
  col: number,
  config: GameConfig = DEFAULT_CONFIG,
): PlacementResult {
  const definition = UNIT_BY_ID[definitionId];
  if (!definition) return { ok: false, state, reason: 'Unknown card.' };

  if (!state.players[side].cards.hand.includes(definitionId)) {
    return { ok: false, state, reason: 'That card is not currently in your hand.' };
  }

  const cellCheck = canDeployDefinitionAt(state, side, definition, row, col);
  if (!cellCheck.ok) return { ok: false, state, reason: cellCheck.reason };

  if (state.players[side].mana + 1e-9 < definition.manaCost) {
    return { ok: false, state, reason: 'Not enough mana.' };
  }

  const entity: Entity = {
    id: state.nextEntityId,
    definitionId,
    owner: side,
    row,
    col,
    hp: definition.maxHp,
    attackReadyAt: state.timeMs + 250,
    moveReadyAt: definition.advanceCooldownMs ? state.timeMs + definition.advanceCooldownMs : null,
    chargePrimed: false,
  };

  let next: GameState = {
    ...state,
    nextEntityId: state.nextEntityId + 1,
    players: {
      ...state.players,
      [side]: {
        ...state.players[side],
        mana: Math.max(0, state.players[side].mana - definition.manaCost),
        cards: rotateUsedCard(state.players[side].cards, definitionId),
      },
    },
    entities: [...state.entities, entity],
  };

  next = appendEvent(
    next,
    `${side === 'player' ? 'You' : 'Enemy'} deployed ${definition.name}${row === getEmergencyRow(side) ? ' from an emergency slot' : ''}.`,
  );
  return { ok: true, state: next };
}

function isFrontmostFriendly(state: GameState, entity: Entity): boolean {
  const dir = directionFor(entity.owner);
  return !state.entities.some((other) => {
    if (other.hp <= 0 || other.owner !== entity.owner || other.col !== entity.col || other.id === entity.id) return false;
    return dir < 0 ? other.row < entity.row : other.row > entity.row;
  });
}

function rangedTarget(state: GameState, attacker: Entity, definition: UnitDefinition): Entity | undefined {
  const dir = directionFor(attacker.owner);
  return state.entities
    .filter((target) => {
      if (target.hp <= 0 || target.owner === attacker.owner || target.col !== attacker.col) return false;
      const forwardDistance = (target.row - attacker.row) * dir;
      return forwardDistance > 0 && forwardDistance <= definition.range;
    })
    .sort((a, b) => Math.abs(a.row - attacker.row) - Math.abs(b.row - attacker.row) || a.id - b.id)[0];
}

function meleeTarget(state: GameState, attacker: Entity): Entity | undefined {
  if (!isFrontmostFriendly(state, attacker)) return undefined;
  const row = attacker.row + directionFor(attacker.owner);
  if (row < 0 || row >= BOARD_ROWS) return undefined;
  const target = entityAt(state, row, attacker.col);
  return target && target.owner !== attacker.owner ? target : undefined;
}

function distanceToEnemyCore(entity: Entity): number {
  return entity.owner === 'player' ? entity.row + 1 : BOARD_ROWS - entity.row;
}

interface PendingDamage {
  targetId?: number;
  targetSide?: Side;
  amount: number;
  sourceId: number;
}

function collectAttacks(state: GameState): { damages: PendingDamage[]; updatedEntities: Entity[] } {
  const damages: PendingDamage[] = [];
  const updatedEntities = state.entities.map((entity) => ({ ...entity }));
  const byId = new Map(updatedEntities.map((entity) => [entity.id, entity]));

  for (const snapshotEntity of [...state.entities].sort((a, b) => a.id - b.id)) {
    if (snapshotEntity.hp <= 0 || snapshotEntity.attackReadyAt > state.timeMs) continue;
    const definition = UNIT_BY_ID[snapshotEntity.definitionId];
    if (!definition || definition.attackType === 'none' || definition.attackDamage <= 0) continue;

    const target = definition.attackType === 'melee'
      ? meleeTarget(state, snapshotEntity)
      : rangedTarget(state, snapshotEntity, definition);

    let attacked = false;
    let damage = definition.attackDamage;
    const mutableAttacker = byId.get(snapshotEntity.id)!;

    if (target) {
      if (mutableAttacker.chargePrimed && definition.chargeBonus) {
        damage *= 1 + definition.chargeBonus;
        mutableAttacker.chargePrimed = false;
      }
      damages.push({ targetId: target.id, amount: damage, sourceId: snapshotEntity.id });
      attacked = true;

      if (definition.splashFactor && isNormalBoardCell(target.row, target.col)) {
        for (const adjacent of state.entities) {
          if (
            adjacent.hp > 0 &&
            adjacent.owner === target.owner &&
            adjacent.row === target.row &&
            Math.abs(adjacent.col - target.col) === 1
          ) {
            damages.push({
              targetId: adjacent.id,
              amount: damage * definition.splashFactor,
              sourceId: snapshotEntity.id,
            });
          }
        }
      }
    } else {
      const canHitCore = definition.attackType === 'ranged'
        ? distanceToEnemyCore(snapshotEntity) <= definition.range
        : isFrontmostFriendly(state, snapshotEntity) && distanceToEnemyCore(snapshotEntity) === 1;

      if (canHitCore) {
        damages.push({ targetSide: enemyOf(snapshotEntity.owner), amount: damage, sourceId: snapshotEntity.id });
        attacked = true;
        mutableAttacker.chargePrimed = false;
      }
    }

    if (attacked) mutableAttacker.attackReadyAt = state.timeMs + definition.attackCooldownMs;
  }

  return { damages, updatedEntities };
}

function applyAttacks(state: GameState): GameState {
  const { damages, updatedEntities } = collectAttacks(state);
  if (damages.length === 0) return { ...state, entities: updatedEntities };

  const hpById = new Map(updatedEntities.map((entity) => [entity.id, entity.hp]));
  const sourceById = new Map(updatedEntities.map((entity) => [entity.id, entity]));
  const coreDamage: Record<Side, number> = { player: 0, enemy: 0 };

  for (const damage of damages) {
    if (damage.targetId !== undefined) {
      hpById.set(damage.targetId, (hpById.get(damage.targetId) ?? 0) - damage.amount);
    } else if (damage.targetSide) {
      coreDamage[damage.targetSide] += damage.amount;
    }
  }

  let next: GameState = {
    ...state,
    entities: updatedEntities
      .map((entity) => ({ ...entity, hp: hpById.get(entity.id) ?? entity.hp }))
      .filter((entity) => entity.hp > 0),
    players: {
      player: { ...state.players.player, coreHp: Math.max(0, state.players.player.coreHp - coreDamage.player) },
      enemy: { ...state.players.enemy, coreHp: Math.max(0, state.players.enemy.coreHp - coreDamage.enemy) },
    },
  };

  for (const side of ['player', 'enemy'] as Side[]) {
    if (coreDamage[side] > 0) {
      next = appendEvent(next, `${side === 'enemy' ? 'Enemy' : 'Your'} Core took ${Math.round(coreDamage[side])} damage.`);
    }
  }

  const killedIds = new Set(
    updatedEntities.filter((entity) => !next.entities.some((alive) => alive.id === entity.id)).map((entity) => entity.id),
  );
  for (const killedId of killedIds) {
    const before = updatedEntities.find((entity) => entity.id === killedId);
    if (!before) continue;
    const killingDamage = damages.find((damage) => damage.targetId === killedId);
    const source = killingDamage ? sourceById.get(killingDamage.sourceId) : undefined;
    next = appendEvent(
      next,
      `${UNIT_BY_ID[before.definitionId].name} was destroyed${source ? ` by ${UNIT_BY_ID[source.definitionId].name}` : ''}.`,
    );
  }

  return next;
}

function canTerritoryFlipTo(state: GameState, owner: Side, row: number, col: number): boolean {
  if (!isNormalBoardCell(row, col)) return false;
  const currentOwner = state.territory[row][col];
  if (currentOwner === owner) return false;
  if (isProtectedHomeRow(currentOwner, row)) return false;
  return true;
}

function applyMovement(state: GameState): GameState {
  const entities = state.entities.map((entity) => ({ ...entity }));
  const territory = state.territory.map((row) => [...row]);
  const occupied = new Set(entities.filter((entity) => entity.hp > 0).map((entity) => `${entity.row},${entity.col}`));
  const events: string[] = [];

  for (const snapshot of [...entities].sort((a, b) => a.id - b.id)) {
    const definition = UNIT_BY_ID[snapshot.definitionId];
    if (!definition?.advanceCooldownMs || snapshot.moveReadyAt === null || snapshot.moveReadyAt > state.timeMs) continue;

    const mutable = entities.find((entity) => entity.id === snapshot.id)!;
    mutable.moveReadyAt = state.timeMs + definition.advanceCooldownMs;

    const nextRow = snapshot.row + directionFor(snapshot.owner);
    if (nextRow < 0 || nextRow >= BOARD_ROWS) continue;

    const nextKey = `${nextRow},${snapshot.col}`;
    if (occupied.has(nextKey)) continue;

    occupied.delete(`${snapshot.row},${snapshot.col}`);
    mutable.row = nextRow;
    mutable.chargePrimed = Boolean(definition.chargeBonus);
    occupied.add(nextKey);

    const territoryState = { ...state, territory };
    if (canTerritoryFlipTo(territoryState, snapshot.owner, nextRow, snapshot.col)) {
      territory[nextRow][snapshot.col] = snapshot.owner;
      events.push(`${snapshot.owner === 'player' ? 'You' : 'Enemy'} conquered lane ${snapshot.col + 1}, row ${nextRow + 1}.`);
    }
  }

  let next: GameState = { ...state, entities, territory };
  for (const event of events) next = appendEvent(next, event);
  return next;
}

function regenerateMana(state: GameState, deltaMs: number, config: GameConfig): GameState {
  const rate = state.phase === 'overtime' ? config.overtimeManaPerSecond : config.manaPerSecond;
  const gained = rate * (deltaMs / 1000);

  return {
    ...state,
    players: {
      player: {
        ...state.players.player,
        mana: Math.min(config.maxMana, state.players.player.mana + gained),
      },
      enemy: {
        ...state.players.enemy,
        mana: Math.min(config.maxMana, state.players.enemy.mana + gained),
      },
    },
  };
}

function allPotentialCellsForSide(state: GameState, side: Side): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];
  const normalRows = side === 'enemy'
    ? Array.from({ length: BOARD_ROWS }, (_, i) => BOARD_ROWS - 1 - i)
    : Array.from({ length: BOARD_ROWS }, (_, i) => i);

  for (const row of normalRows) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      if (state.territory[row][col] === side && !entityAt(state, row, col)) cells.push({ row, col });
    }
  }

  const emergencyRow = getEmergencyRow(side);
  for (let col = 0; col < BOARD_COLS; col += 1) {
    if (isEmergencyCellActive(state, side, col) && !entityAt(state, emergencyRow, col)) {
      cells.push({ row: emergencyRow, col });
    }
  }
  return cells;
}

function laneThreatScore(state: GameState, side: Side, col: number): number {
  const foe = enemyOf(side);
  const enemyPressure = state.entities
    .filter((entity) => entity.owner === foe && entity.col === col)
    .reduce((sum, entity) => {
      const progress = side === 'enemy' ? entity.row + 1 : BOARD_ROWS - entity.row;
      return sum + progress + entity.hp / 500;
    }, 0);

  const lostTerritory = state.territory.reduce(
    (sum, row) => sum + (row[col] === foe ? 1 : 0),
    0,
  );

  return enemyPressure + lostTerritory * 0.7;
}

function runEnemyBot(state: GameState, config: GameConfig): GameState {
  if (state.timeMs < state.enemyNextActionAt || state.winner) return state;

  let next = { ...state, enemyNextActionAt: state.timeMs + config.enemyThinkEveryMs };
  const hand = next.players.enemy.cards.hand;
  const affordable = hand.filter((id) => UNIT_BY_ID[id] && UNIT_BY_ID[id].manaCost <= next.players.enemy.mana + 1e-9);
  const cells = allPotentialCellsForSide(next, 'enemy');
  if (affordable.length === 0 || cells.length === 0) return next;

  const legalPairs: Array<{ card: string; row: number; col: number; score: number }> = [];
  for (const card of affordable) {
    const definition = UNIT_BY_ID[card];
    for (const cell of cells) {
      if (!canDeployDefinitionAt(next, 'enemy', definition, cell.row, cell.col).ok) continue;

      let score = laneThreatScore(next, 'enemy', cell.col);
      if (definition.attackType === 'ranged') score += cell.row <= 1 ? 0.7 : 0.2;
      if (definition.advanceCooldownMs) score += next.territory[3]?.[cell.col] === 'player' ? 0.8 : 0.3;
      if (definition.kind === 'structure') score += laneThreatScore(next, 'enemy', cell.col) > 2 ? 1 : 0;

      legalPairs.push({ card, ...cell, score });
    }
  }
  if (legalPairs.length === 0) return next;

  legalPairs.sort((a, b) => b.score - a.score);
  const topCount = Math.min(config.aiTopChoices, legalPairs.length);
  const roll = nextRandom(next.rngState);
  next = { ...next, rngState: roll.seed };
  const choice = legalPairs[Math.floor(roll.value * topCount) % topCount];

  return placeEntity(next, 'enemy', choice.card, choice.row, choice.col, config).state;
}

function resolveCoreDestruction(state: GameState): GameState {
  const playerDead = state.players.player.coreHp <= 0;
  const enemyDead = state.players.enemy.coreHp <= 0;

  if (playerDead && enemyDead) return finish(state, 'draw', 'Both Cores fell at the same time. Draw.');
  if (enemyDead) return finish(state, 'player', 'Enemy Core destroyed. Victory!');
  if (playerDead) return finish(state, 'enemy', 'Your Core was destroyed. Defeat.');
  return state;
}

function resolveClock(state: GameState, previousTimeMs: number, config: GameConfig): GameState {
  if (state.winner) return state;

  if (
    state.phase === 'regulation' &&
    previousTimeMs < config.regulationMs &&
    state.timeMs >= config.regulationMs
  ) {
    const playerHp = state.players.player.coreHp;
    const enemyHp = state.players.enemy.coreHp;

    if (playerHp > enemyHp) return finish(state, 'player', 'Time. Your Core has more HP. Victory!');
    if (enemyHp > playerHp) return finish(state, 'enemy', 'Time. Enemy Core has more HP. Defeat.');

    return appendEvent({ ...state, phase: 'overtime' }, 'Overtime! Mana regeneration doubled.');
  }

  const overtimeEnd = config.regulationMs + config.overtimeMs;
  if (
    state.phase === 'overtime' &&
    previousTimeMs < overtimeEnd &&
    state.timeMs >= overtimeEnd
  ) {
    const playerHp = state.players.player.coreHp;
    const enemyHp = state.players.enemy.coreHp;

    if (playerHp > enemyHp) return finish(state, 'player', 'Overtime ended. Your Core has more HP. Victory!');
    if (enemyHp > playerHp) return finish(state, 'enemy', 'Overtime ended. Enemy Core has more HP. Defeat.');

    const playerTerritory = territoryCount(state, 'player');
    const enemyTerritory = territoryCount(state, 'enemy');

    if (playerTerritory > enemyTerritory) {
      return finish(state, 'player', 'Overtime ended tied on Core HP. Territory control wins the match!');
    }
    if (enemyTerritory > playerTerritory) {
      return finish(state, 'enemy', 'Overtime ended tied on Core HP. Enemy territory control wins the match.');
    }

    return finish(state, 'draw', 'Overtime ended perfectly tied. Draw.');
  }

  return state;
}

export function tickGame(
  state: GameState,
  deltaMs: number,
  config: GameConfig = DEFAULT_CONFIG,
  enemyBotEnabled = true,
): GameState {
  if (state.winner || deltaMs <= 0) return state;

  const clampedDelta = Math.min(deltaMs, 250);
  const previousTimeMs = state.timeMs;

  let next: GameState = {
    ...state,
    timeMs: state.timeMs + clampedDelta,
  };

  next = regenerateMana(next, clampedDelta, config);
  next = applyMovement(next);
  next = applyAttacks(next);
  next = resolveCoreDestruction(next);
  next = resolveClock(next, previousTimeMs, config);

  if (enemyBotEnabled && !next.winner) next = runEnemyBot(next, config);
  return next;
}

export function formatMana(mana: number): string {
  return mana.toFixed(1).replace('.0', '');
}
