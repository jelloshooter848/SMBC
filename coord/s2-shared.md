# Brief S2-<a|b>: shared Classic rules

Read `briefs/common.md` first (same folder). Base: the Slice-1 integration branch named in your launch
message (it has the rules plumbing: `Rules`, `ctx.rules`, `heroFor`, `World.rules`, `CLASSIC_CHARACTERS`,
`SimOptions.rules`, the parity fixture). Your branch/wip/port are in your launch message.

## S2-a: power states + swimming
Spec: `bug-reports/2026-10-07-classic-power-states.md` (PS-C, all items) and
`bug-reports/2026-10-07-classic-swimming.md` (SW-C, all items), plus TG-21, TG-27, TG-28, TG-29, TG-45.
- `src/game/characters/classic/power.ts`: Lose Everything, hit response + invulnerability (semi-transparent if
  the report says so; respect Reduce flashing), knockback inside the helper, ammo-only drops, Star 720 frames,
  1-ups, death/pit rules, the HUD rules (no hearts/bars/meters for Classic defs). Fire-keeps-big assist ignored
  under Classic.
- Swimming: optional `SwimProfile` field(s) (e.g. `floorJumpOnly`, per-hero water jump/gravity) read in
  `Player.swim`; `DEFAULT_SWIM` and every Current path unchanged. Per-hero water numbers go in a table the hero
  slices will consume (e.g. `src/game/rules/classic-swim.ts` exporting per-id SwimProfile) — the hero slices
  will reference it from their Classic defs.
- TG-45 level variants for floor jumpers: `src/game/rules/classic-water.ts`, applied in the World only when
  `this.rules === 'classic'` and the report's condition holds. Tile map hash under Current unchanged.
- Provide a minimal shared Classic def factory for tests (e.g. `characters/classic/test-def.ts` or inside the
  test) so behaviour is testable before hero defs exist. Do NOT write the per-hero Classic defs (later slices),
  but DO export helpers they will call (`classicOnHurt`, `classicOnPowerUp`, `classicDrop`, …) with clear docs.

## S2-b: enemy HP and armour + bricks and shots
Spec: `bug-reports/2026-10-07-classic-enemy-hp-and-armour.md` (HP-C, all) and
`bug-reports/2026-10-07-classic-bricks-and-shots.md` (BR-C, all), plus TG-24, TG-25, TG-26.
- `Enemy.hit` single door: first line `if (world.rules === 'classic') return classicHit(...)`, logic + tables
  in `src/game/rules/classic-enemies.ts`; separate classic HP counter (don't touch `Enemy.hp`); armour,
  piercing, hit-stun/freeze, Bowser forms, score, stomp rules; optional `CharacterBehaviour.meleeDamage?`.
- `World.strikeBlock` single branch on `this.rules` for brick HP 125, side bumps, weapon breaks; optional
  `damage?` param; per-hero head rules via each def's `canBreakBricks` (Classic defs will set it); optional
  projectile spec flag(s) for "passes ground but hits bricks/? blocks" in `Projectile.update`.
- Per-hero tables (weapon damage, which weapons break/bump) as data the hero slices will plug in (e.g. damage
  carried on `DamageSource.amount` from the Classic weapon specs). Test with stub sources/defs.

## Both
- Tests in new files: `tests/sim/classic-<topic>.test.ts`, driven by `runSim({ rules: 'classic', … })` and unit
  tests. Every acceptance check in your reports that doesn't need a finished hero def gets a test; list the
  ones deferred to hero slices in your report.
- Parity fixture + full suite green, zero edits to existing tests.
- Play it with `?dev=1&rules=classic&level=1-1&char=mario` (and 1-2, 1-4 Bowser, 2-2 water) on your port.
