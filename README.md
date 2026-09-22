# Dominion Rush — MVP 1.0

Dominion Rush is a **single-player** real-time tactical mobile game played on a **5×6 grid**. Players spend regenerating mana to deploy persistent units and structures. Combat is automatic and cooldown-driven; the player's main skill is timing, formation and territorial control.

## MVP rules

- Single-player battles against deterministic AI with Easy, Normal and Hard difficulty profiles.
- Both sides start with **3 mana**, maximum **10**.
- Regulation mana: **1 mana every 2 seconds**.
- Fixed **8-card deck** and rotating **4-card hand**.
- Playing a card immediately draws the next card in the cycle.
- Units and structures stay on discrete cells.
- Melee normally cannot deploy on the protected row closest to its own Core.
- Ranged units can normally deploy on any controlled cell.
- Attacks normally resolve only along the same vertical lane.
- Selected units advance by one cell on a cooldown.
- Entering enemy territory captures the cell permanently until reconquered.
- Captured territory changes deployment space but **does not change mana income**.
- The final row beside each Core cannot be conquered.
- Fully breaching a lane opens one temporary emergency reinforcement cell.
- Destroying the enemy Core wins instantly.
- Regulation lasts **3:00**.
- Equal Core HP at 3:00 triggers **1:00 overtime** with double mana.
- Overtime tie: Core HP → territory count → draw.

## Starter deck

1. Guardian — cheap stationary melee.
2. Legionnaire — advancing melee.
3. Knight — fast advancing charge unit.
4. Archer — fast ranged pressure.
5. Pyromancer — ranged splash.
6. Spearman — short-range support.
7. Arrow Tower — defensive structure.
8. Barricade — pure blocker.

Additional implemented units remain available for future deck building: Crossbow, Siege Ram, Ballista and Bombardier.

## Run

```bash
npm install
npm start
```

## Quality checks

```bash
npm run test:engine
npm run typecheck
```

GitHub Actions executes both checks on every push to `main` and on pull requests.

## Project structure

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
eas.json
```

## Product direction

Dominion Rush is intentionally **single-player only**. The roadmap focuses on:
- stronger AI personalities and difficulty;
- campaign missions and challenge battles;
- deck building and unlockable cards;
- enemy factions/archetypes;
- tutorial and progression;
- final art, animation, sound and polish;
- offline-friendly save/progression.

PvP, matchmaking, ranked ladders, accounts and live multiplayer servers are out of scope.

## Build readiness

The repository includes Expo application metadata and EAS build profiles for preview and production. Store signing, EAS project linking, final icons/splash artwork, privacy/store metadata and publishing credentials still require external account setup before an actual App Store / Google Play release.

See `GAME_DESIGN.md` for the complete current rules.
