export const BOARD_ROWS = 6;
export const BOARD_COLS = 5;

export type Side = 'player' | 'enemy';
export type Winner = Side | 'draw';
export type AiDifficulty = 'easy' | 'normal' | 'hard';
export type MatchPhase = 'regulation' | 'overtime' | 'finished';
export type EntityKind = 'unit' | 'structure';
export type AttackType = 'melee' | 'ranged' | 'none';
export type DeploymentRule = 'any_owned' | 'not_home_row';

export interface UnitDefinition {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  kind: EntityKind;
  manaCost: number;
  maxHp: number;
  attackDamage: number;
  attackCooldownMs: number;
  attackType: AttackType;
  range: number;
  deploymentRule: DeploymentRule;
  advanceCooldownMs?: number;
  chargeBonus?: number;
  splashFactor?: number;
  description: string;
}

export interface Entity {
  id: number;
  definitionId: string;
  owner: Side;
  row: number;
  col: number;
  hp: number;
  attackReadyAt: number;
  moveReadyAt: number | null;
  chargePrimed: boolean;
}

export interface CardCycleState {
  deck: string[];
  hand: string[];
  drawIndex: number;
}

export interface PlayerState {
  mana: number;
  coreHp: number;
  cards: CardCycleState;
}

export interface CombatEvent {
  id: number;
  timeMs: number;
  text: string;
}

export interface GameState {
  timeMs: number;
  phase: MatchPhase;
  players: Record<Side, PlayerState>;
  entities: Entity[];
  territory: Side[][];
  winner: Winner | null;
  nextEntityId: number;
  nextEventId: number;
  rngState: number;
  enemyNextActionAt: number;
  events: CombatEvent[];
}

export interface GameConfig {
  startingMana: number;
  maxMana: number;
  manaPerSecond: number;
  overtimeManaPerSecond: number;
  coreHp: number;
  enemyThinkEveryMs: number;
  regulationMs: number;
  overtimeMs: number;
  deckSize: number;
  handSize: number;
  aiDifficulty: AiDifficulty;
  aiTopChoices: number;
}

export interface PlacementResult {
  ok: boolean;
  state: GameState;
  reason?: string;
}
