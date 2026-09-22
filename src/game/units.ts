import { UnitDefinition } from './types';

export const UNIT_DEFINITIONS: UnitDefinition[] = [
  {
    id: 'guardian', name: 'Guardian', shortName: 'Gd', icon: '🛡️', kind: 'unit',
    manaCost: 2, maxHp: 620, attackDamage: 85, attackCooldownMs: 1400,
    attackType: 'melee', range: 1, deploymentRule: 'not_home_row',
    description: 'Cheap frontline melee. Holds a lane but does not advance.',
  },
  {
    id: 'legionnaire', name: 'Legionnaire', shortName: 'Lg', icon: '⚔️', kind: 'unit',
    manaCost: 3, maxHp: 700, attackDamage: 105, attackCooldownMs: 1500,
    attackType: 'melee', range: 1, deploymentRule: 'not_home_row', advanceCooldownMs: 8000,
    description: 'Core invader. Advances one cell every 8 seconds when clear.',
  },
  {
    id: 'knight', name: 'Knight', shortName: 'Kn', icon: '🐎', kind: 'unit',
    manaCost: 5, maxHp: 900, attackDamage: 145, attackCooldownMs: 1700,
    attackType: 'melee', range: 1, deploymentRule: 'not_home_row', advanceCooldownMs: 6000, chargeBonus: 0.5,
    description: 'Fast invader. First melee hit after moving deals +50%.',
  },
  {
    id: 'archer', name: 'Archer', shortName: 'Ar', icon: '🏹', kind: 'unit',
    manaCost: 3, maxHp: 360, attackDamage: 78, attackCooldownMs: 1300,
    attackType: 'ranged', range: 4, deploymentRule: 'any_owned',
    description: 'Fast ranged pressure against the nearest enemy in its lane.',
  },
  {
    id: 'crossbow', name: 'Crossbow', shortName: 'Xb', icon: '🎯', kind: 'unit',
    manaCost: 4, maxHp: 420, attackDamage: 145, attackCooldownMs: 2300,
    attackType: 'ranged', range: 5, deploymentRule: 'any_owned',
    description: 'Long range, slow rate of fire and heavy single-target damage.',
  },
  {
    id: 'pyromancer', name: 'Pyromancer', shortName: 'Py', icon: '🔥', kind: 'unit',
    manaCost: 5, maxHp: 390, attackDamage: 135, attackCooldownMs: 2500,
    attackType: 'ranged', range: 4, deploymentRule: 'any_owned', splashFactor: 0.5,
    description: 'Ranged blast splashes half damage into adjacent columns.',
  },
  {
    id: 'spearman', name: 'Spearman', shortName: 'Sp', icon: '🔱', kind: 'unit',
    manaCost: 3, maxHp: 520, attackDamage: 100, attackCooldownMs: 1350,
    attackType: 'ranged', range: 2, deploymentRule: 'any_owned',
    description: 'Short-reach support that can fight from behind the frontline.',
  },
  {
    id: 'ram', name: 'Siege Ram', shortName: 'Rm', icon: '🐏', kind: 'unit',
    manaCost: 4, maxHp: 1050, attackDamage: 170, attackCooldownMs: 2400,
    attackType: 'melee', range: 1, deploymentRule: 'not_home_row', advanceCooldownMs: 9000, chargeBonus: 0.75,
    description: 'Slow durable invader with a devastating charge hit.',
  },
  {
    id: 'tower', name: 'Arrow Tower', shortName: 'Tw', icon: '🏰', kind: 'structure',
    manaCost: 4, maxHp: 950, attackDamage: 70, attackCooldownMs: 1200,
    attackType: 'ranged', range: 4, deploymentRule: 'any_owned',
    description: 'Immobile lane-control structure with reliable ranged fire.',
  },
  {
    id: 'barricade', name: 'Barricade', shortName: 'Ba', icon: '🧱', kind: 'structure',
    manaCost: 2, maxHp: 1250, attackDamage: 0, attackCooldownMs: 999999,
    attackType: 'none', range: 0, deploymentRule: 'any_owned',
    description: 'Cheap blocker. Buys time but cannot attack or move.',
  },
  {
    id: 'ballista', name: 'Ballista', shortName: 'Bl', icon: '🪵', kind: 'structure',
    manaCost: 5, maxHp: 700, attackDamage: 220, attackCooldownMs: 3200,
    attackType: 'ranged', range: 6, deploymentRule: 'any_owned',
    description: 'Immobile artillery with full-lane range and huge single hits.',
  },
  {
    id: 'bombardier', name: 'Bombardier', shortName: 'Bo', icon: '💣', kind: 'unit',
    manaCost: 4, maxHp: 410, attackDamage: 105, attackCooldownMs: 2100,
    attackType: 'ranged', range: 3, deploymentRule: 'any_owned', splashFactor: 0.75,
    description: 'Medium-range area damage for breaking packed formations.',
  },
];

export const UNIT_BY_ID: Record<string, UnitDefinition> = Object.fromEntries(
  UNIT_DEFINITIONS.map((unit) => [unit.id, unit]),
);

// MVP deck is fixed at 8 cards. Additional units remain available for future deck building.
export const STARTER_DECK = [
  'guardian',
  'legionnaire',
  'knight',
  'archer',
  'pyromancer',
  'spearman',
  'tower',
  'barricade',
];


export const SKIRMISH_PRESETS = {
  balanced: {
    name: 'Balanced',
    description: 'Mixed frontline, ranged pressure and defense.',
    deck: ['guardian', 'legionnaire', 'knight', 'archer', 'pyromancer', 'spearman', 'tower', 'barricade'],
  },
  rush: {
    name: 'Rush',
    description: 'Aggressive advancing units and fast pressure.',
    deck: ['guardian', 'legionnaire', 'knight', 'ram', 'archer', 'spearman', 'bombardier', 'barricade'],
  },
  siege: {
    name: 'Siege',
    description: 'Slower ranged control with heavy structures.',
    deck: ['guardian', 'legionnaire', 'archer', 'crossbow', 'pyromancer', 'tower', 'ballista', 'barricade'],
  },
} as const;

export type SkirmishPresetId = keyof typeof SKIRMISH_PRESETS;
