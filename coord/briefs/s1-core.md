# Brief S1-core: parity fixture + Classic rules plumbing (no Classic hero behaviour yet)

Read `briefs/common.md` first (same folder). Base: `origin/main`. Your branch: `claude/classic-core`.
Wip backup branch: `claude/classic-wip-core`. Vite port: 5182.

## Goal
Lay the rails every later Classic slice plugs into, while Current/campaign stays byte-for-byte the same.
With no Classic defs registered yet, a Classic-rules world plays every hero Current and the tag reads CLASSIC?.

## Scope (requirement IDs from the umbrella report)
1. FIRST, before touching any source: TG-36 golden parity fixture, recorded on the untouched `origin/main`
   checkout. `tests/sim/current-parity.test.ts` + `tests/sim/fixtures/current-parity.json` (JSON is fine; keep
   it reasonably small — e.g. sample every 4th frame, or hash per-frame tuples per run, as long as any drift
   fails). Runs per TG-36: every Current hero in 1-1, 1-2, 2-2 (check `CHARACTERS` for the real hero list —
   it may include Sophia now), each from top power with full kit, one co-op run. Recorder behind
   `RECORD_PARITY=1`. Commit + push this alone first.
2. TG-9 Rules type / optional `ctx.rules` / `rulesOf` (exact text in common.md).
3. One `Game` method deciding live rules (common.md "Rules model"): returns 'current' whenever
   `game.campaign !== null`. Expose a way for run starters to set the run's rules, e.g. `devStart(..., { rules })`
   and a `game.runRules` field the Classic shell builder (S1-shell, working in parallel) will set for Classic
   mode runs. Keep the API small and documented in a comment.
4. TG-13/14: `World.rules` read once in the constructor; `WorldStart.rules?` override; mini games and training
   rooms always pass 'current'.
5. TG-17/18/19/20: `heroFor(def, rules)`, `CLASSIC_CHARACTERS` (empty for now), `CharacterDef.rules?: 'classic'`;
   World builds players with the resolved def; HUD / pause guide / level music read `players[i].def`.
6. TG-15/16/17a: `GameState.rules?`, `newGameState(..., rules)` writing it only for 'classic'; carry reset
   when rules differ (announce "Rules changed. Power reset."). Skip TG-17b/17c (campaign saves are always
   Current now; never write `rules` into campaign saves — assert that in a test).
7. TG-21/22 types only (Classic defs come later). TG-23 optional-field policy: document in a comment where
   later slices add fields.
8. TG-31/32/33 tag CLASSIC / CLASSIC? on the HUD and intro card, F1 overlay line.
9. TG-37 `SimOptions.rules`.
10. Dev: `?dev=1&rules=classic|current` (TG-5..7 helper `src/game/dev-url.ts`, honoured only in dev mode) and a
    **Rules** row in the dev Level select (Current / Classic SMBC) passed into `devStart`. Do NOT add the Mode
    row or the Classic mode flow — S1-shell owns those (and `mode=` URL param). Do not add a Rules row to the
    Dev mode menu (rules are chosen per start now). No persistent `settings.rules` needed; if you add one, it
    must never affect campaign.
11. TG-41/42/43 roster plumbing: `CLASSIC_EXTRAS: CharacterDef[]` (empty now) and `Game.roster` — returns
    `CHARACTERS` + extras when the live run is a Classic-rules non-campaign run, else `deps.characters`. Extras
    never in heroesToFind/captives/map/training. (Classic mode select layout itself is S1-shell's job; just
    provide `game.roster`.)
12. Tests: `tests/sim/rules-toggle.test.ts` per TG-38 (adapted), guard test TG-39, TG-40 new cases.
    Add a test that a campaign file opened while dev rules are Classic still plays 'current'.

## Out of scope
Any Classic hero behaviour, enemy HP, bricks, swimming, power states (later slices). Title screen, Classic
mode flow, pause menu, Options switch (S1-shell).

## Files to look at
src/game/context.ts, src/game/scenes/game.ts, src/game/world/world.ts (constructor ~277-330, player build),
src/game/characters/registry.ts, character.ts, profile.ts, src/game/hud/hud.ts, src/game/scenes/level.ts,
intro.ts, pause.ts, debug-overlay.ts, dev-level-select.ts, src/main.ts, src/game/sim/headless.ts,
src/game/minigames/**, src/game/tutorial/room.ts, src/engine/save/settings.ts.

## Done when
Parity fixture green with and without `rules:'current'`; full suite green with zero edits to existing tests;
`?dev=1&rules=classic&level=1-1&char=link` shows CLASSIC? and plays like Current; campaign unaffected.
Report per common.md.
