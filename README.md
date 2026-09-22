# Dominion Rush — Prototype 0.2

A playable Expo / React Native prototype for a real-time tactical mobile game played on a **5×6 cell grid**.

## Current gameplay

- 1v1 player vs simple bot.
- Both players start with 3 mana; max 10.
- Mana regenerates continuously.
- Cards place persistent units or structures onto cells.
- Melee normally cannot be summoned on the row closest to your Core.
- Ranged units can normally use any cell you control.
- Attacks primarily travel along the same column.
- Some units automatically advance by one cell on a cooldown.
- Entering enemy territory captures the cell permanently until reconquered.
- Captured territory reduces the defender's deployment space and expands yours.
- The final row beside each Core cannot be conquered.
- Fully breaching a vertical lane opens a temporary emergency reinforcement cell for the defender.
- Destroy the enemy Core to win.

Territory currently **does not modify mana generation**.

## Run locally

```bash
npm install
npm start
```

Then open the project through Expo on a supported target.

## Engine tests

```bash
npm run test:engine
```

The engine is kept separate from the React Native UI under `src/game/`.

## Structure

```text
App.tsx
src/
  components/
    CardBar.tsx
    GameBoard.tsx
  game/
    engine.ts
    rng.ts
    types.ts
    units.ts
tests/
  engine.test.cjs
GAME_DESIGN.md
```

See `GAME_DESIGN.md` for the current rules and the design decisions that are still open.
