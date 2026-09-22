import { UnitDefinition } from './types';

export const UNIT_DEFINITIONS: UnitDefinition[] = [
  {
    id: 'guardian', name: 'Guardian', shortName: 'Gd', icon: '🛡️', kind: 'unit',
    manaCost: 2, maxHp: 620, attackDamage: 85, attackCooldownMs: 1400,
    attackType: 'melee', range: 1, deploymentRule: 'not_home_row',
    description: 'Cheap frontline melee. Does not move on its own.',
  },
  {
    id: 'legionnaire', name: 'Legionnaire', shortName: 'Lg', icon: '⚔️', kind: 'unit',
    manaCost: 3, maxHp: 700, attackDamage: 105, attackCooldownMs: 1500,
    attackType: 'melee', range: 1, deploymentRule: 'not_home_row', advanceCooldownMs: 8000,
    description: 'Advances 1 cell every 8s when the cell ahead is empty.',
  },
  {
    id: 'knight', name: 'Knight', shortName: 'Kn', icon: '🐎', kind: 'unit',
    manaCost: 5, maxHp: 900, attackDamage: 145, attackCooldownMs: 1700,
    attackType: 'melee', range: 1, deploymentRule: 'not_home_row', advanceCooldownMs: 6000, chargeBonus: 0.5,
    description: 'Advances quickly. First melee hit after moving deals +50%.',
  },
  {
    id: 'archer', name: 'Archer', shortName: 'Ar', icon: '🏹', kind: 'unit',
    manaCost: 3, maxHp: 360, attackDamage: 78, attackCooldownMs: 1300,
    attackType: 'ranged', range: 4, deploymentRule: 'any_owned',
    description: 'Fast ranged attacker. Shoots the nearest enemy in its column.',
  },
  {
    id: 'crossbow', name: 'Crossbow', shortName: 'Xb', icon: '🎯', kind: 'unit',
    manaCost: 4, maxHp: 420, attackDamage: 145, attackCooldownMs: 2300,
    attackType: 'ranged', range: 5, deploymentRule: 'any_owned',
    description: 'Long range and heavy single-target damage.',
  },
  {
    id: 'pyromancer', name: 'Pyromancer', shortName: 'Py', icon: '🔥', kind: 'unit',
    manaCost: 5, maxHp: 390, attackDamage: 135, attackCooldownMs: 2500,
    attackType: 'ranged', range: 4, deploymentRule: 'any_owned', splashFactor: 0.5,
    description: 'Ranged attack splashes 50% damage to enemies beside the target.',
  },
  {
    id: 'spearman', name: 'Spearman', shortName: 'Sp', icon: '🔱', kind: 'unit',
    manaCost: 3, maxHp: 520, attackDamage: 100, attackCooldownMs: 1350,
    attackType: 'ranged', range: 2, deploymentRule: 'any_owned',
    description: 'Short reach attacker that can fight from one cell behind the front.',
  },
  {
    id: 'ram', name: 'Siege Ram', shortName: 'Rm', icon: '🐏', kind: 'unit',
    manaCost: 4, maxHp: 1050, attackDamage: 170, attackCooldownMs: 2400,
    attackType: 'melee', range: 1, deploymentRule: 'not_home_row', advanceCooldownMs: 9000, chargeBonus: 0.75,
    description: 'Slow, durable invader with a devastating charge hit.',
  },
  {
    id: 'tower', name: 'Arrow Tower', shortName: 'Tw', icon: '🏰', kind: 'structure',
    manaCost: 4, maxHp: 950, attackDamage: 70, attackCooldownMs: 1200,
    attackType: 'ranged', range: 4, deploymentRule: 'any_owned',
    description: 'Immobile defensive structure with steady ranged fire.',
  },
  {
    id: 'barricade', name: 'Barricade', shortName: 'Ba', icon: '🧱', kind: 'structure',
    manaCost: 2, maxHp: 1250, attackDamage: 0, attackCooldownMs: 999999,
    attackType: 'none', range: 0, deploymentRule: 'any_owned',
    description: 'Cheap blocker. Cannot attack or move.',
  },
  {
    id: 'ballista', name: 'Ballista', shortName: 'Bl', icon: '🪵', kind: 'structure',
    manaCost: 5, maxHp: 700, attackDamage: 220, attackCooldownMs: 3200,
    attackType: 'ranged', range: 6, deploymentRule: 'any_owned',
    description: 'Immobile artillery with full-lane range.',
  },
  {
    id: 'bombardier', name: 'Bombardier', shortName: 'Bo', icon: '💣', kind: 'unit',
    manaCost: 4, maxHp: 410, attackDamage: 105, attackCooldownMs: 2100,
    attackType: 'ranged', range: 3, deploymentRule: 'any_owned', splashFactor: 0.75,
    description: 'Medium-range splash attacker.',
  },
];

export const UNIT_BY_ID: Record<string, UnitDefinition> = Object.fromEntries(
  UNIT_DEFINITIONS.map((unit) => [unit.id, unit]),
);

export const STARTER_DECK = [
  'guardian', 'legionnaire', 'knight', 'archer', 'pyromancer', 'spearman',
  'tower', 'barricade', 'ballista', 'bombardier',
];
