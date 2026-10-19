# Brief S3/S4-<hero>: a hero's Classic SMBC def

Read `briefs/common.md` first (same folder). Base/branch/wip/port are in your launch message.

## What exists on your base
- Rules plumbing (S1-core): `heroFor(def, rules)`, `CLASSIC_CHARACTERS` in `src/game/characters/registry.ts`,
  `CharacterDef.rules?: 'classic'`, `World.rules`, `SimOptions.rules`, `runSim({ character, rules: 'classic' })`,
  the CLASSIC / CLASSIC? tag, `&kit=full` → resolved def's `devKit()` (TG-8/TG-44), parity fixture.
- Shared power states + swimming (S2-a), `src/game/characters/classic/power.ts`: `classicOnHurt`,
  `classicOnPowerUp`, `classicBusy(p)` (call first in your update — no attacks during a push/freeze),
  `classicStartKit`, `classicRespawn`, `classicDrop`/`CLASSIC_DROPS`, `CLASSIC_HIT_RESPONSES`, `classicLook`,
  `spendAmmo`/`hasAmmo`, `CharacterDef.drawLook`, `hudAmmo`, `blockDrop`, `starMusicLeft`;
  `src/game/rules/classic-swim.ts` `CLASSIC_SWIM` (per-hero SwimProfile); `characters/classic/test-def.ts`.
  Read `tests/sim/classic-power.test.ts` and `classic-swim.test.ts` to see usage.
- Possibly (if your base has it) S2-b enemy HP/armour (`src/game/rules/classic-enemies.ts`, `Enemy.hit` branch,
  `DamageSource.amount` in original units, `CharacterBehaviour.meleeDamage?`) and bricks
  (`World.strikeBlock` Classic branch, `damage?` param, projectile spec flags). If your base lacks them, give
  your weapons the right `amount` / flags per the reports anyway and note it; the integrator will check.

## Your job
Create `src/game/characters/<id>/classic.ts` exporting `<ID>_CLASSIC` (and `classic-weapons.ts` if needed),
register it in `CLASSIC_CHARACTERS`. Implement EVERY requirement in your hero's report
(`bug-reports/2026-10-07-<hero>-classic-smbc-rules.md`): controls, movement, jumping, swimming, power tiers,
weapons, special abilities, interactions, feel, guide + touchLabels (TG-22), `&kit=full` all-weapons + Select
cycle (TG-44). New physics = OPTIONAL fields on MovementProfile/SwimProfile/CharacterDef read in shared code
with today's path unchanged when absent (TG-23). Classic files may import Current helpers/sprites; no Current
file imports a classic module (registry.ts excepted). Verify constants against the original source.

## Tests
`tests/sim/classic-<id>.test.ts`: every Acceptance check in the report that the engine can measure (via runSim
with rules:'classic'), plus TG-38 "under Current the def is unchanged". Parity fixture must stay green.
New guide/no-button-letter cases (TG-40) for your def. FULL suite once at the end.

## Play
`?dev=1&rules=classic&level=1-1&char=<id>` (and 1-2, 2-2 water, 1-4 Bowser, `&kit=full`): the tag must read
CLASSIC (not CLASSIC?) for your hero. Desktop keys + phone 393x852 touch. Compare against
`&rules=current`. Screenshots to `shots/<id>-classic/`. Report per common.md, listing each requirement ID.
