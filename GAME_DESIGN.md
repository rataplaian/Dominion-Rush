# Dominion Rush — Core Design Notes

## Pillar

A real-time tactical game where **placement is the primary player action** and units execute combat through independent cooldowns.

The intended decision loop is:

**mana → card → cell → formation → timing → automatic combat → territory**

## Board

The permanent board is **5 columns × 6 rows**.

```text
ENEMY CORE

row 0  [ ][ ][ ][ ][ ]   protected enemy home row
row 1  [ ][ ][ ][ ][ ]   conquerable enemy territory
row 2  [ ][ ][ ][ ][ ]   conquerable enemy frontline
       -----------------
row 3  [ ][ ][ ][ ][ ]   conquerable player frontline
row 4  [ ][ ][ ][ ][ ]   conquerable player territory
row 5  [ ][ ][ ][ ][ ]   protected player home row

PLAYER CORE
```

Every entity occupies exactly one cell. There is no free movement.

## Mana

- Both sides start at **3 mana**.
- Maximum stored mana: **10**.
- Prototype regeneration: **0.5 mana/s** (1 mana every 2 seconds).
- Territory ownership currently has **no effect on mana generation**.

## Deployment rules

Deployment depends on both **territory ownership** and the card's own placement rule.

Current prototype defaults:

- Melee units: can deploy on controlled cells, but **not on the protected row closest to their own Core**.
- Ranged units: can deploy on **any controlled cell** unless a future card specifies an exception.
- Structures: currently can deploy on any controlled cell.
- Emergency reinforcement cells override normal placement-band restrictions.

These are data-driven card rules, so individual units can later have exceptions.

## Combat direction

The normal rule is that attacks resolve **along the same vertical column / direction of advance**.

- Melee: only the frontmost friendly melee can attack, and only the immediately adjacent forward cell.
- Ranged: targets the nearest valid enemy ahead in the same column, within range.
- Splash / special abilities may explicitly break the same-column rule.

## Movement philosophy

Movement is an ability/property, not a universal command.

Examples:

- Advance: move forward one cell every X seconds if free.
- Charge: advance and prime bonus damage.
- Breakthrough: move into the defeated enemy's cell after a kill.
- Push: force an enemy backward one cell if free.
- Pull: move an enemy toward the attacker.
- Leap: pass over an occupied cell.
- Swap: exchange positions with an allied unit.
- Retreat: automatically step backward below an HP threshold.
- Teleport: relocate according to specific targeting rules.

## Territory conquest

Territory is tracked independently from unit occupancy.

When an advancing unit enters a cell controlled by the opponent:

1. the entered cell becomes controlled by the advancing side;
2. the defender can no longer deploy there;
3. the attacker can use that cell as forward deployment territory if it is empty;
4. ownership persists even if the capturing unit later dies;
5. ownership can later flip back through reconquest.

### Protected final row

The row directly beside each Core is **never conquerable**.

An enemy unit may physically enter that row, occupy it and threaten the Core, but the territory itself remains owned by the defender.

## Emergency reinforcement cell

Prototype interpretation of the current design:

If an attacker captures **both conquerable cells in one defender lane/column**, that lane is considered fully breached.

A temporary emergency cell appears **behind the defender's protected home row in the same column**. The defender can deploy one unit there even if that unit would normally be barred from the home row.

This creates a last counterplay opportunity while preserving the strong reward for territorial pressure.

The emergency cell is outside the permanent 5×6 board and exists only for a breached lane (or while a unit already occupies it).

## Main balance levers

Every card can be balanced mostly through data:

- mana cost;
- HP;
- attack damage;
- attack cooldown;
- range;
- deployment rule;
- movement cooldown;
- charge multiplier;
- splash multiplier;
- entity type: unit / structure.

## Prototype 0.2 status

Implemented:

- 5×6 board;
- 3 starting mana / 10 maximum;
- real-time mana regeneration;
- units and structures;
- automatic attack cooldowns;
- melee frontline restrictions;
- ranged same-column attacks;
- movement-by-cell abilities;
- dynamic territorial ownership;
- forward deployment on captured territory;
- protected final rows;
- emergency reinforcement slots;
- simple deterministic bot;
- Core HP / victory condition;
- battle log;
- automated engine tests.

## Open design questions

- Fixed deck size: 8? 10?
- Full deck visible or rotating hand?
- Match duration and overtime.
- Exact mana regeneration speed after playtesting.
- Should every captured cell allow forward summoning, or only connected territory?
- Should structures have stricter deployment limits?
- Should territory slowly revert when undefended?
- Should an emergency cell disappear immediately after reconquest or remain until its occupant dies? Prototype: existing occupant keeps it visible.
- Should ranged attacks be blocked by friendly units? Prototype: no.
- Which special attacks may cross columns?
- Core-only win condition vs additional objectives.
