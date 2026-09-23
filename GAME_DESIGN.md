# Dominion Rush — Skirmish Alpha Design Baseline

## Core idea

Dominion Rush is a real-time tactical grid game where **placement replaces direct movement control**.

The decision loop is:

**mana → hand → card → cell → formation → cooldown combat → territory → Core pressure**

The board remains readable like a turn-based tactics game, but time never stops.

## Battlefield

Permanent board: **5 columns × 6 rows**.

```text
ENEMY CORE

row 0  [ ][ ][ ][ ][ ]   protected enemy home row
row 1  [ ][ ][ ][ ][ ]   enemy starting territory
row 2  [ ][ ][ ][ ][ ]   NEUTRAL — locked until conquered
       -----------------
row 3  [ ][ ][ ][ ][ ]   NEUTRAL — locked until conquered
row 4  [ ][ ][ ][ ][ ]   player starting territory
row 5  [ ][ ][ ][ ][ ]   protected player home row

PLAYER CORE
```

One entity occupies one cell. No free movement/pathfinding exists.

## Mana

- Start: **3**
- Maximum: **10**
- Regulation: **0.5 mana/sec**
- Overtime: **1 mana/sec**
- Territory does **not** currently modify mana income.

## Cards

MVP uses:
- fixed **8-card deck**;
- **4-card hand**;
- after a card is deployed, it rotates out and the next card enters that hand slot;
- both player and AI obey the same card availability rule.

Future deck building can select any 8 legal cards from the larger collection.

## Deployment

Deployment requires:
1. enough mana;
2. card present in the current hand;
3. empty cell;
4. territory controlled by the deploying player.

The two middle rows (2 and 3) begin **neutral**. Neither side can deploy there at match start. A neutral cell becomes deployable only after an advancing unit physically enters it and captures it.

Default restrictions:
- melee: cannot normally deploy on the protected home row;
- ranged: any controlled cell;
- structures: any controlled cell;
- active emergency cells override the home-row restriction.

Individual future cards may override these defaults.

## Combat

Default attack direction is the unit's **vertical lane**.

### Melee
- must be the frontmost friendly entity in the lane;
- attacks only the immediately adjacent enemy ahead;
- cannot attack through allies.

### Ranged
- attacks the nearest enemy ahead in the lane, within range;
- friendly units do not block shots in MVP;
- if no enemy blocks the lane and the Core is in range, it can attack the Core.

### Splash
Splash is an explicit exception: Pyromancer/Bombardier-style attacks may damage units in adjacent columns around the primary target.

## Movement

Movement is a charged manual action.

Current implemented rules:
- almost every **unit** has a movement recharge time;
- structures and explicitly static pieces do not have movement charge;
- the movement indicator is a small side arrow/bar on the unit token;
- the bar fills with time but **never moves the unit automatically**;
- when full, the arrow glows and the player may tap that unit to advance exactly **1 cell for 0 mana**;
- if the forward cell is occupied, the charge remains ready and can be used later;
- after a successful move, the bar resets and begins charging again;
- assault/mobility units recharge quickly;
- ranged/support units can still reposition, but recharge substantially more slowly;
- **Charge:** units with a charge bonus prime that bonus only after a successful manual advance.

Current movement-charge examples:
- Knight: 6s
- Legionnaire: 8s
- Siege Ram: 9s
- Guardian: 14s
- Spearman: 16s
- Archer: 18s
- Bombardier: 20s
- Pyromancer / Crossbow: 22s

Future legal patterns:
- breakthrough;
- push;
- pull;
- leap;
- swap;
- retreat;
- teleport.

## Territory

Territory ownership and unit occupancy are separate.

When an advancing unit enters conquerable enemy territory:
1. ownership flips immediately;
2. the defender loses that deployment cell;
3. the attacker may later deploy there if the cell becomes empty;
4. territory remains captured after the capturing unit dies;
5. reconquest can flip it back.

### Protected final row

Rows 0 and 5 never change ownership. An invader may occupy them and attack the Core, but cannot convert them into deployment territory.

## Emergency reinforcement

When both conquerable cells of one defender lane are captured, a temporary emergency cell opens **behind that defender's protected row in the same column**.

It:
- exists outside the 5×6 board;
- accepts one defender unit;
- overrides normal home-row deployment restrictions;
- provides one last counterplay window against a full lane breach.

## Match format

### Regulation
**3:00**

If a Core is destroyed: immediate win.

At 3:00:
- higher Core HP wins;
- equal Core HP triggers overtime.

### Overtime
**1:00**
- mana regeneration doubles.

At overtime end:
1. higher Core HP wins;
2. if tied, more controlled cells wins;
3. if still tied, match is a draw.

## Pre-match unit information

The deck-selection screen exposes the full selected deck before PLAY. Every card shows its numerical combat profile and can be inspected for:
- mana cost;
- HP;
- damage;
- range in forward grid cells;
- attack cooldown;
- movement interval;
- charge/splash/other special effect;
- plain-language role description.

The battlefield, timer, mana regeneration and AI remain frozen until the player presses **PLAY**.

## MVP starter deck

| Card | Mana | Role |
|---|---:|---|
| Guardian | 2 | slow-moving melee tank |
| Legionnaire | 3 | advancing melee |
| Knight | 5 | fast charge invader |
| Archer | 3 | fast ranged |
| Pyromancer | 5 | splash ranged |
| Spearman | 3 | short-range support |
| Arrow Tower | 4 | ranged structure |
| Barricade | 2 | blocker |

Additional coded cards: Crossbow, Siege Ram, Ballista, Bombardier.

## AI

The single-player AI:
- obeys mana;
- uses the same charged movement rules as the player;
- moves a unit only after that unit's movement charge is ready;
- uses only its current 4-card hand;
- deploys only on legal controlled territory;
- prioritizes lanes under pressure;
- gives extra weight to defensive structures in threatened lanes and advancing units when pressure opportunities exist;
- uses deterministic seeded randomness among its highest-scoring choices.

Difficulty changes decision speed and choice quality while keeping the same mana, Core HP and card rules as the player. The AI does not receive hidden economic or stat bonuses.

## Architecture

- React Native + Expo + TypeScript.
- Pure deterministic game engine separated from UI.
- Engine state is serializable and suitable for future replay/network synchronization.
- No free-space physics or pathfinding.
- Automated tests cover gameplay rules.
- GitHub Actions validates engine and UI types.

## Not in MVP 1.0

These are product-expansion systems, not blockers for the core game:
- custom deck builder UI;
- collection/unlocks;
- cosmetics;
- sound/VFX/final art;
- tutorial campaign;
- monetization;
- analytics;
- localization;
- store publishing metadata.

## Current phase: Skirmish Alpha

No campaign or progression design should constrain the core rules yet.

The current build exists to answer:
- Is placement satisfying?
- Is mana timing interesting?
- Are melee/ranged formations readable?
- Is advancing and conquering territory strategically meaningful?
- Does the emergency-cell rule create comeback potential without removing the reward for pressure?
- Are match length and overtime appropriate?
- Are there enough meaningful choices with an 8-card deck / 4-card hand?
- Can the AI create interesting matches without cheating?

Skirmish presets currently cover Balanced, Rush and Siege archetypes and collectively expose all implemented gameplay roles.

## Future single-player product direction

Dominion Rush is designed as an offline-first single-player game. Future work prioritizes:
- campaign structure and authored missions;
- AI archetypes and boss encounters;
- deck building, unlocks and progression;
- challenge modifiers and replayability;
- final presentation, audio and tutorialization.

PvP, matchmaking, ranked ladders and multiplayer server infrastructure are intentionally excluded.

The MVP is deliberately focused on proving that **mana + placement + cooldown combat + territory conquest** is fun before expanding the single-player content.
