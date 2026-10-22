# Save-code compression research: handoff for Round 3

This branch (`claude/savecode-research`) carries the save-code research from the release
orchestrator's session to a new session. It is **research only**. It is never merged, and no PR
is opened from it.

## Your task

Run **Round 3**, as briefed in `briefs/round3-brief.md`. That brief evaluates `reports/SAVE_CODE_ROUND2.md` and asks for:
- an audit of what the current coders already do;
- an instrumented cost breakdown;
- the Experiments A–D: whole-profile candidate selection and field layout, semantic entropy coding, enumerative set coding, narrowly scoped hierarchical sharing;
- compressor controls: Zopfli, zstd with a dictionary, and shared Brotli if available offline.

It has strict benchmark and stopping rules.

Deliver `reports/SAVE_CODE_ROUND3.md`. Put the brief's four-way classification and recommendation (§9) at the top: keep R1 or config M, or adopt the smallest justified combination.

## Ground rules (from the product owner, jelloshooter848)

- **Do not change production game code** (`src/`, `tests/`, configs) on any branch. All experiment code lives under `research/savecode/harness/` on this branch.
- To import the game's TypeScript modules, the round-1/2 harness copied a vitest shim into `tests/` temporarily and deleted it afterwards. If you do the same, never commit the shim. Run `git status --short` before every commit, and commit only `research/savecode/**`.
- Commit and push your work to this branch (`claude/savecode-research`) as you go, so nothing is lost if the container restarts. Do not open a PR.
- **No server, no database, no external dictionary service.** Everything must work offline in a normal browser, including iPhone/iPad Safari. Any dictionary must ship with the game or travel inside the code.
- **No E** (secret/password/birthday) by current recommendation. Round 1 §4.3 explains why.
- **Dev fields never travel**: `dev`, `devUnlock`, devUnlockAll, devAllHeroes, devGateOpen, Classic dev toggles, `smbc.devLast`. Carrying them would open dev mode on a release build.
- Label every number **MEASURED** or **FORECAST**. Count all framing, selectors, dictionaries, model and escape costs. Report the median per-profile saving separately from the ratio of corpus medians.
- The owner has not decided to build any save export yet (it is ON HOLD). This work informs that decision.

## What is real and what is synthetic (read before trusting any number)

- **No whole-game export exists in the game today.** `sample/sample-save.json` and `sample/sample-save-code.txt` were made by a throwaway script:
  - `smbc.settings` (`defaultSettings()` plus 2 tweaks) and `smbc.save.1..3` (`newSave()` plus edits) come from real code;
  - `smbc.progress` is hand-written in the real shape;
  - the envelope `{app, v, exported, data}` is invented.
- The 9 `smbc-classic-file-{smb,special,lost}-{1,2,3}` records are **invented placeholders** for the approved but unbuilt design **B-L "Classic save files"** (`design/classic-files-design.md`). Its field names are not a real schema.
- **The real Classic save today** is one slot per map set: key `smbc-classic-resume-{set}`, type `ClassicResume` in `src/game/run-resume.ts`. As of v0.4.69 (PRs #193/#194 merged on main), it also holds:
  - `heroKits` (per-hero power and kit, validated on load);
  - the run's difficulty and game mode;
  - possibly a per-slot `continues` count, which is landing in the dev-tools PR.
- **B-L will change all of this:** 3 files per set, per-file rules (difficulty, game mode, more settings, weapons, disabled heroes) and per-file continues. It is being built in batch B-L (branch `claude/classic-files`) and is not merged. Treat the B-L shape as a design until it lands, then re-measure against the real loader.
- The **campaign** already has a real, short, bit-packed per-file code: `src/game/save/save-code.ts`, `code-bits.ts`, `share-code.ts`, `src/game/scenes/save-codes.ts`, and `docs/SAVE_CODES.md`. Keep backward compatibility with it.
- **The fair-progress and random generators are synthetic.** No real player saves exist. Say so, and don't generalise synthetic gains.

## Files

| Path | What |
| --- | --- |
| `briefs/round1-brief.md` | The owner's original feasibility brief (K, A, E, H; questions 1–22) |
| `briefs/round2-brief.md` | Round 2: multiple-K, modular references, adaptive, cross-slot |
| `briefs/round3-brief.md` | **Round 3: your task** |
| `reports/SAVE_CODE_FEASIBILITY.md` | Round-1 report: code paths, field inventory, R1 codec spec, measurements |
| `reports/SAVE_CODE_ROUND2.md` | Round-2 report: config M, adaptive guard, cross-slot results |
| `harness/codec.ts`, `schema.ts`, `scenarios.ts`, `bench.ts` | Round-1 prototype codec and benchmark |
| `harness/codec2.ts`, `scenarios2.ts`, `bench2.ts` | Round-2 additions |
| `harness/results.json`, `results2.json` | Raw measured outputs of rounds 1 and 2 |
| `reports/SAVE_CODE_ROUND3.md` | **Round-3 report** (classification and recommendation at the top) |
| `harness/trace.ts`, `layouts.ts`, `rc.ts`, `scenarios3.ts`, `bench3.ts`, `train_zstd_dict.py`, `results3.json` | Round-3 additions: call tracing, layouts (A2), range coder (B), the independent rk corpus, the benchmark and its raw output |
| `harness/zz-savecode-bench.test.ts.shim` | The vitest shim: it imports `process.env.BENCH_FILE` and calls `run()` |
| `sample/` | The synthetic sample: JSON, plus its 2,941-char `z` code |
| `design/classic-files-design.md` | The owner-approved B-L design |

**Paths:** `bench.ts` and `bench2.ts` hard-code the old scratchpad paths in their `DIR`, `SAMPLE` and `SAMPLE_CODE` constants, e.g. `/tmp/claude-0/.../scratchpad/savecode`. Point them at this folder, or at your own scratch dir, before running. The reports also cite those old paths; they correspond to this folder.

**How it was run** (from the repo root, with `node_modules` installed):

```sh
cp research/savecode/harness/zz-savecode-bench.test.ts.shim tests/zz-savecode-bench.test.ts
BENCH_FILE=$PWD/research/savecode/harness/bench2.ts npx vitest run tests/zz-savecode-bench.test.ts
rm tests/zz-savecode-bench.test.ts   # never commit it
```

## Project facts that matter here

- Repo: jelloshooter848/SMBC, "Super Mario Bros. Crossover: REMIX", TypeScript + Vite + pnpm.
- It is a static site on GitHub Pages (jelloshooter848.github.io/SMBC/), and localStorage is the authoritative store.
- Keys:
  - `smbc.settings` (which also holds Classic cheat unlocks and stats in `classicCheats` and `classicTutorialsSeen`);
  - `smbc.progress`;
  - `smbc.save.1..3`;
  - `smbc-classic-resume-{smb,special,lost}`;
  - plus non-save keys: `smbc.levels` (custom levels), `smbc.devLast`, `smbc-shots`, `smbc-line`, and asset packs in IndexedDB.
- Round-1 risk: an export that treats settings as device preferences silently resets every Classic unlock.
- Round-1 risk: defaults must be frozen per code version. Live `defaultSettings()` changes between releases; for example, the master volume went from 0.8 to 0.4 in 0.4.49.

## Reporting back

When done, push `reports/SAVE_CODE_ROUND3.md` and the harness changes to this branch. Then give the owner a short summary covering:
- the four-way classification;
- headline MEASURED numbers against R1 and config M;
- the recommendation;
- a confirmation that no production code changed.
