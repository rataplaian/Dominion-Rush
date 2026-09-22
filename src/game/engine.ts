import {
  BOARD_COLS,
  BOARD_ROWS,
  Entity,
  GameConfig,
  GameState,
  PlacementResult,
  Side,
  UnitDefinition,
} from './types';
import { nextRandom } from './rng';
import { STARTER_DECK, UNIT_BY_ID } from './units';

export const DEFAULT_CONFIG: GameConfig = {
  startingMana: 3,
  maxMana: 10,
  manaPerSecond: 0.5,
  coreHp: 2500,
  enemyThinkEveryMs: 850,
};

const directionFor = (side: Side) => (side === 'player' ? -1 : 1);
const enemyOf = (side: Side): Side => (side === 'player' ? 'enemy' : 'player');

export function createInitialTerritory(): Side[][] {
  return Array.from({ length: BOARD_ROWS }, (_, row) =>
    Array.from({ length: BOARD_COLS }, () => (row <= 2 ? 'enemy' : 'player') as Side),
  );
}

export function createInitialState(seed = 1337, config: GameConfig = DEFAULT_CONFIG): GameState {
  return {
    timeMs: 0,
    players: {
      player: { mana: config.startingMana, coreHp: config.coreHp },
      enemy: { mana: config.startingMana, coreHp: config.coreHp },
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

/**
 * A temporary emergency slot appears behind the defender's protected home row
 * when the attacker owns every conquerable cell in that vertical lane.
 * Existing emergency occupants keep the slot visible until they leave/die.
 */
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
    events: [...state.events.slice(-9), event],
  };
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
    // Emergency reinforcement deliberately overrides normal deployment-band restrictions.
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
    moveReadyAt: definition.advanceCooldownMs
      ? state.timeMs + definition.advanceCooldownMs
      : null,
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
      },
    },
    entities: [...state.entities, entity],
  };

  next = appendEvent(next, `${side === 'player' ? 'You' : 'Enemy'} deployed ${definition.name}${row === getEmergencyRow(side) ? ' from an emergency slot' : ''}.`);
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
      const delta = target.row - attacker.row;
      const forwardDistance = delta * dir;
      return forwardDistance > 0 && forwardDistance <= definition.range;
    })
    .sort((a, b) => Math.abs(a.row - attacker.row) - Math.abs(b.row - attacker.row) || a.id - b.id)[0];
}

function meleeTarget(state: GameState, attacker: Entity): Entity | undefined {
  if (!isFrontmostFriendly(state, attacker)) return undefined;
  const dir = directionFor(attacker.owner);
  const row = attacker.row + dir;
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
  splash?: boolean;
}

function collectAttacks(state: GameState): { damages: PendingDamage[]; updatedEntities: Entity[] } {
  const damages: PendingDamage[] = [];
  const updatedEntities = state.entities.map((entity) => ({ ...entity }));
  const byId = new Map(updatedEntities.map((entity) => [entity.id, entity]));

  for (const snapshotEntity of [...state.entities].sort((a, b) => a.id - b.id)) {
    if (snapshotEntity.hp <= 0 || snapshotEntity.attackReadyAt > state.timeMs) continue;
    const definition = UNIT_BY_ID[snapshotEntity.definitionId];
    if (!definition || definition.attackType === 'none' || definition.attackDamage <= 0) continue;

    let target: Entity | undefined;
    if (definition.attackType === 'melee') target = meleeTarget(state, snapshotEntity);
    else target = rangedTarget(state, snapshotEntity, definition);

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

      // Splash is an explicit exception to the default same-column attack rule.
      if (definition.splashFactor && definition.splashFactor > 0 && isNormalBoardCell(target.row, target.col)) {
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
              splash: true,
            });
          }
        }
      }
    } else {
      const canHitCore = definition.attackType === 'ranged'
        ? distanceToEnemyCore(snapshotEntity) <= definition.range
        : isFrontmostFriendly(state, snapshotEntity) && distanceToEnemyCore(snapshotEntity) === 1;
      if (canHitCore) {
        damages.push({
          targetSide: enemyOf(snapshotEntity.owner),
          amount: damage,
          sourceId: snapshotEntity.id,
        });
        attacked = true;
        if (mutableAttacker.chargePrimed) mutableAttacker.chargePrimed = false;
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
      player: {
        ...state.players.player,
        coreHp: Math.max(0, state.players.player.coreHp - coreDamage.player),
      },
      enemy: {
        ...state.players.enemy,
        coreHp: Math.max(0, state.players.enemy.coreHp - coreDamage.enemy),
      },
    },
  };

  if (coreDamage.player > 0 || coreDamage.enemy > 0) {
    const damagedSide: Side = coreDamage.enemy > 0 ? 'enemy' : 'player';
    const amount = coreDamage[damagedSide];
    next = appendEvent(next, `${damagedSide === 'enemy' ? 'Enemy' : 'Your'} Core took ${Math.round(amount)} damage.`);
  }

  for (const damage of damages) {
    if (damage.targetId === undefined) continue;
    const before = state.entities.find((entity) => entity.id === damage.targetId);
    const after = next.entities.find((entity) => entity.id === damage.targetId);
    if (before && !after) {
      const source = sourceById.get(damage.sourceId);
      next = appendEvent(next, `${UNIT_BY_ID[before.definitionId].name} was destroyed${source ? ` by ${UNIT_BY_ID[source.definitionId].name}` : ''}.`);
    }
  }

  return next;
}

function canTerritoryFlipTo(state: GameState, owner: Side, row: number, col: number): boolean {
  if (!isNormalBoardCell(row, col)) return false;
  const currentOwner = state.territory[row][col];
  if (currentOwner === owner) return false;
  // The defender's final row remains permanently theirs even while occupied by an invader.
  if (isProtectedHomeRow(currentOwner, row)) return false;
  return true;
}

function applyMovement(state: GameState): GameState {
  let entities = state.entities.map((entity) => ({ ...entity }));
  const territory = state.territory.map((row) => [...row]);
  const occupied = new Set(entities.filter((e) => e.hp > 0).map((e) => `${e.row},${e.col}`));
  const conquestEvents: string[] = [];

  for (const entity of [...entities].sort((a, b) => a.id - b.id)) {
    const definition = UNIT_BY_ID[entity.definitionId];
    if (!definition?.advanceCooldownMs || entity.moveReadyAt === null || entity.moveReadyAt > state.timeMs) continue;

    const mutable = entities.find((e) => e.id === entity.id)!;
    const dir = directionFor(entity.owner);
    const nextRow = entity.row + dir;
    mutable.moveReadyAt = state.timeMs + definition.advanceCooldownMs;

    // Advancing units may enter from an emergency slot, but may not move beyond the normal board.
    if (nextRow < 0 || nextRow >= BOARD_ROWS) continue;
    const nextKey = `${nextRow},${entity.col}`;
    if (occupied.has(nextKey)) continue;

    occupied.delete(`${entity.row},${entity.col}`);
    mutable.row = nextRow;
    mutable.chargePrimed = Boolean(definition.chargeBonus);
    occupied.add(nextKey);

    const territoryState = { ...state, territory };
    if (canTerritoryFlipTo(territoryState, entity.owner, nextRow, entity.col)) {
      territory[nextRow][entity.col] = entity.owner;
      conquestEvents.push(`${entity.owner === 'player' ? 'You' : 'Enemy'} conquered lane ${entity.col + 1}, row ${nextRow + 1}.`);
    }
  }

  let next: GameState = { ...state, entities, territory };
  for (const text of conquestEvents) next = appendEvent(next, text);
  return next;
}

function regenerateMana(state: GameState, deltaMs: number, config: GameConfig): GameState {
  const gained = config.manaPerSecond * (deltaMs / 1000);
  return {
    ...state,
    players: {
      player: { ...state.players.player, mana: Math.min(config.maxMana, state.players.player.mana + gained) },
      enemy: { ...state.players.enemy, mana: Math.min(config.maxMana, state.players.enemy.mana + gained) },
    },
  };
}

function allPotentialCellsForSide(state: GameState, side: Side): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];

  // Front-to-back preference. Enemy advances toward larger row indices; player toward smaller ones.
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

function runEnemyBot(state: GameState, config: GameConfig): GameState {
  if (state.timeMs < state.enemyNextActionAt || state.winner) return state;

  let next = { ...state, enemyNextActionAt: state.timeMs + config.enemyThinkEveryMs };
  const affordable = STARTER_DECK.filter((id) => UNIT_BY_ID[id].manaCost <= next.players.enemy.mana + 1e-9);
  const cells = allPotentialCellsForSide(next, 'enemy');
  if (affordable.length === 0 || cells.length === 0) return next;

  const legalPairs: Array<{ card: string; row: number; col: number }> = [];
  for (const card of affordable) {
    for (const cell of cells) {
      if (canDeployDefinitionAt(next, 'enemy', UNIT_BY_ID[card], cell.row, cell.col).ok) {
        legalPairs.push({ card, ...cell });
      }
    }
  }
  if (legalPairs.length === 0) return next;

  const pressuredColumns = new Set(next.entities.filter((e) => e.owner === 'player').map((e) => e.col));
  const usefulPairs = legalPairs.filter((pair) => pressuredColumns.has(pair.col));
  const pool = usefulPairs.length > 0 ? usefulPairs : legalPairs;

  const roll = nextRandom(next.rngState);
  next = { ...next, rngState: roll.seed };
  const choice = pool[Math.floor(roll.value * pool.length) % pool.length];
  return placeEntity(next, 'enemy', choice.card, choice.row, choice.col, config).state;
}

function determineWinner(state: GameState): GameState {
  if (state.players.player.coreHp <= 0 && state.players.enemy.coreHp <= 0) {
    return appendEvent({ ...state, winner: 'player' }, 'Both Cores fell. Player wins the prototype tiebreaker.');
  }
  if (state.players.enemy.coreHp <= 0) return appendEvent({ ...state, winner: 'player' }, 'Enemy Core destroyed. Victory!');
  if (state.players.player.coreHp <= 0) return appendEvent({ ...state, winner: 'enemy' }, 'Your Core was destroyed. Defeat.');
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
  let next: GameState = { ...state, timeMs: state.timeMs + clampedDelta };
  next = regenerateMana(next, clampedDelta, config);
  next = applyMovement(next);
  next = applyAttacks(next);
  next = determineWinner(next);
  if (enemyBotEnabled && !next.winner) next = runEnemyBot(next, config);
  return next;
}

export function formatMana(mana: number): string {
  return mana.toFixed(1).replace('.0', '');
}
