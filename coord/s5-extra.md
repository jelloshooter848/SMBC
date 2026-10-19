# Brief S5-<hero>: a Classic-only new character

Read `briefs/common.md` and `briefs/s3-hero.md` first (same folder). Base/branch/wip/port are in your launch message.

## Rules for Classic-only extras (TG-41..43, owner decisions)
- They exist ONLY as Classic defs (`rules: 'classic'`), registered in `CLASSIC_EXTRAS` in `registry.ts`, in the
  order Bass, Sophia III (not you), Proto Man, Pit, Vic Viper, Warriors of Light. Never in `CHARACTERS`.
- They appear only in Classic mode (title CLASSIC → select second row) and dev Classic-rules starts, through
  `game.roster` / `rosterFor(rules)`. Never in the campaign, heroesToFind, captives, map, training, or mini games.
  `?dev=1&rules=classic&level=1-1&char=<id>` must work. One player only in Classic mode.
- Variants of existing heroes are built from those heroes' Classic factories:
  `classicMegaMan(options)` in `megaman/classic.ts`, `classicSamus({variant, palette, guide, jumpSfx})` in
  `samus/classic.ts`. Extend the factory options if needed; don't fork the code. The base hero's tests must
  stay green.
- Art: original pixel art only, in the repo's text-array sprite format (a palette swap of the base hero is the
  minimum; give each a distinct look). Portrait for the select screen, HUD name, own guide + touch labels, music
  per the report (MML in the repo's format, or reuse an existing original track).
- Tests: `tests/sim/classic-<id>.test.ts` covering the report's measurable acceptance checks, roster rules
  (appears in Classic select second row, not in campaign/free play Current), guide/no-button-letters.

## Play
Title → CLASSIC → Super Mario Bros. → select (second row shows your hero) → 1-1, plus
`?dev=1&rules=classic&level=1-1&char=<id>`, desktop + phone 393x852. Screenshots of select screen and play to
`shots/<id>-classic/`. Report per common.md.
