# SMBC Remix save codes, round 2: multiple references, modular references, cross-slot coding

Repo `main` at `b56d770`: read-only, and `git status --short` is empty at the end (the temporary vitest shim was deleted).

The harness reuses round 1's `codec.ts`, `schema.ts`, `scenarios.ts` and `bench.ts`, plus the game's real modules (`encodeSaveCode` / `decodeSaveCode`, `migrateSave`, `loadSettings`, `loadProgress`, `loadClassicResume`, `upgradeStory`, `metIds`, `heroStart`). New files:
- `codec2.ts`: reference-delta coder and staged references.
- `scenarios2.ts`: 10-100 % progress profiles.
- `bench2.ts`
- `results2.json`

**M** = MEASURED by `bench2.ts`. **F** = FORECAST (arithmetic or judgement, not run).

Every length:
- is in Base64url characters, unless it says "Base32";
- includes the `P` prefix, version byte, flags byte, CRC-32, every section's presence bits and every **reference-selector bit**;
- is the best of raw and deflate, the same rule as round 1's baseline ("R1" = round-1 hybrid).

All encodings were decoded through their envelope and deep-compared. **18,954 checks, 0 failures (M).**

**B-L (9 Classic files) is still a design, not code.** Its numbers model the sample's placeholder shape. Nothing in the synthetic data is treated as a gameplay invariant. References only change *how* a value is coded, never *what* is stored: the delta always carries the real `freed`, `story`, cheat unlocks and `heroKits`.

---

## Answers to the 7 questions

1. **Does multiple-K encoding beat the hybrid?** **Not on its own; yes, slightly, combined with the hybrid's own pieces.**
   - Multi-K that replaces the campaign codec loses to R1 in **60-90 %** of profiles (configs A/B/C, §2).
   - Multi-K *as extra candidates* next to the campaign codec and round-1 representations (config D) wins **92 %** of the fair corpus, but by little: median **375 → 352 (−6 %)**, current shape (**M**).
2. **Which sections gain most?** In order (**M**, §3):
   1. **High-completion campaign files**: the "100 %" template was chosen for 33 % of files; campaign sections −11 % in bits.
   2. **Near-duplicate slots**: a previous-slot reference; B-L sections −13 %.
   3. Classic unlock state: the "all unlocked" template was chosen in 45 % of profiles; −5 %.
   4. Progress: −5 %.

   Little or nothing for:
   - current Classic slots (−4 %);
   - settings options and device prefs (worse by the selector bit);
   - per-file Classic codes (0 % wins).
3. **Are modular references better than whole-save references?** **Barely.**
   - Per-section multi-K ≈ one whole-profile selector: medians 357 vs 357 (fair corpus) and 385 vs 387 (random-200) (**M**).
   - Modular stages (progress / freed / met / story / equipment, each with its own selector, including references derived from earlier stages) add 0-3 % (D → G).
   - Modular stages need frozen copies of game logic (`upgradeStory`, `metIds`) to stay decodable. Not worth it.
4. **Does cross-slot deduplication shrink future 9-file backups?** **Only if real files are near-copies, which is unknown.** On Classic-only B-L profiles (**M**, §4):
   - files independent: **−1 %**;
   - same rules within a set: **−3.7 %**;
   - same rules and same heroes / kits with 30 % of the values changed: **−31 %**.

   On the general corpora it gives −4 to −10 % (its rules and kits are partly correlated by the generator). The real distribution needs B-L to ship and real saves to look at (**F**).
5. **What is the improvement after all overhead?** The shipped encoder picks the adaptive method or R1, whichever is shorter. The choice sits in the existing flags byte, so it costs 0 extra bytes and **is never longer than R1: 0 of 1,592 encodes longer (M)**. Median saving vs R1 (**M**):

   | Corpus | Current shape | B-L shape |
   | --- | --- | --- |
   | Fair progress corpus | **5.1 %** (375 → 345) | **9.0 %** (487 → 444) |
   | Round-1 random-200 | 8.9 % (351 → 305) | 12.5 % (513 → 453) |

   - p95 savings: 20-24 %.
   - Max savings: 28-50 %, and only on profiles with duplicated files.
   - Fresh profile: 11 → 11 (the guard is needed; unguarded adaptive is 15).
6. **What is the smallest practical implementation?** **Config M**: per section, the best of {round-1 representation, campaign codec, one "100 %" reference per section (file, Classic unlocks, progress), copy-of-a-previous-slot}, plus the R1 guard.
   - It captures **87-100 %** of the full adaptive gain: fair corpus 345 vs 345 (current) and 447 vs 444 (B-L); random-200 311 vs 305 and 460 vs 453 (**M**).
   - No intermediate templates, no modular stages, no derived references.
7. **Is it worth it?** **Marginal.**
   - It saves about 30-45 chars on 350-500-char paste/link codes, so it doesn't move a code into a typeable class.
   - Costs:
     - encode 12 ms median vs 0.9 ms (decode 1.4 vs 0.7 ms, Node);
     - +≈1-3 KB gzip of frozen tables;
     - every reference frozen and bundled forever.
   - **Recommendation:** keep round 1 for the first release, with the method field reserved now (free). Adopt config M later only if a measured length target needs it (§7).

---

## 1. What was built

- **Round-2 delta operations** (`codec2.ts`), applied against any reference R:
  - a bool that differs costs only its "same" bit;
  - a set that differs may be sent as its symmetric difference with R;
  - a map that differs may be sent as key-level edits (kept / removed / changed + added);
  - a null-in-R skips its presence bit.

  Each choice is 1 mode bit, counted.
- **Frozen references.** All are built from the game's registries and dictionaries, never from test data, and stored as frozen JSON.
  - Campaign file templates:
    - `fresh` (`newSave`);
    - `half` (worlds 1-4 cleared);
    - `smb` (every SMB-group page);
    - `full`: every registered level, page, secret, story beat and explainer, every hero freed / met / tutored, every hero's `fullHero` kit.
  - Classic unlocks: `allUnlocked` (every cheat, the beat flags, Level Select).
  - Progress: `allDone` (hard × 3, Lost Levels 8 / letters / world 9).
  - Classic: K0 (round 1's keyed default).
  - B-L rules: original defaults, or the profile's global Classic options (DESIGN).
- **Modular stages for a campaign file**, each with its own selector:
  1. head;
  2. progression (vs fresh / half / smb / full);
  3. `freed` (fresh / all);
  4. `met` + `tutorials` (fresh / derived from `freed` via `metIds` / all);
  5. `story` + `explained` (fresh / derived via `upgradeStory` / all);
  6. equipment (fresh / every freed hero basic / every freed hero full);
  7. run.

  Classic modular stages: run vs K0; `heroKits` vs {} or a previous slot; B-L `rules` vs defaults, the global options or a previous file.
- **Cross-slot:** a whole record coded against any earlier record of the same kind, as decoded (selector widens with the slot number).
- **Configurations** (all with deflate-if-smaller):

  | Config | Contents |
  | --- | --- |
  | A | single K0 with the new delta operations |
  | B | one whole-profile template selector (fresh / mid / full) |
  | C | per-section multi-K |
  | D | C + campaign codec + round-1 representations |
  | E | round-1 representations + the new delta operations only |
  | F | E + cross-slot |
  | G | D + modular / derived |
  | K | D + cross-slot |
  | **M** | minimal: codec + r1 + "100 %" references + cross-slot |
  | **H** | everything |
  | Shipped | min(H, R1) |

- **Corpora:**
  - the 8 named scenarios (incl. the sample);
  - round 1's **200 seeded random profiles**;
  - **190 fair "progress %" profiles** at 10/25/50/75/90/99/100 %, in two modes. `seq` = the first p % of levels with random holes and random later extras. `scatter` = every level, secret, story beat, hero and kit item independently with probability p. Campaign files are independent and run through `migrateSave`.

  ⚠ The named and random-200 corpora build their campaign files from 4 fixed helpers (`fullSave`, `midSave`, ...) and their Classic kits from a 6-kit palette, so slots are often near-copies. **They overstate cross-slot and template gains.** The progress corpus is the fairer test.

## 2. Profile lengths vs round 1 (semantic policy, M)

Each row shows min / median / p95 / max, then the share of profiles where it is shorter / equal / longer than R1.

**Fair progress corpus, current Classic shape (n = 190):**

| Method | min | med | p95 | max | vs R1: shorter / equal / longer |
| --- | --- | --- | --- | --- | --- |
| R1 hybrid | 144 | 375 | 623 | 699 | n/a |
| A single-K, new delta ops | 132 | 451 | 931 | 1,055 | 9 % / 2 % / **89 %** |
| B whole-profile multi-K | 132 | 357 | 588 | 681 | 65 / 4 / **31 %** |
| C per-section multi-K | 132 | 357 | 589 | 683 | 66 / 4 / 29 % |
| D C + codec + r1 | 133 | 352 | 591 | 684 | 92 / 6 / 3 % |
| E r1 + new delta ops | 133 | 371 | 612 | 695 | 91 / 7 / 3 % |
| F E + cross-slot | 133 | 364 | 595 | 688 | 97 / 3 / 1 % |
| G D + modular/derived | 133 | 352 | 587 | 681 | 93 / 6 / 1 % |
| **M minimal** | 133 | **345** | 572 | 679 | 95 / 4 / 1 % |
| H everything | 133 | 345 | 569 | 673 | 96 / 3 / 1 % |
| **Shipped min(H, R1)** | 133 | **345** | 569 | 673 | 96 / 4 / **0 %** |

**The same, other corpora** (median, with p95 in brackets):

| Corpus / shape | R1 | B | D | M | H | Shipped | Shipped saving med / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| progress / B-L (DESIGN) | 487 (888) | 484 | 468 | 447 (785) | 444 | **444** (788) | 9.0 / 20.2 / 27.8 % |
| random-200 / current | 351 (549) | 387 | 336 | 311 | 305 | **305** (504) | 8.9 / 24.0 / 37.9 % |
| random-200 / B-L | 513 (773) | 552 | 512 | 460 | 453 | **453** (669) | 12.5 / 23.1 / 32.3 % |
| progress / current, portable | 373 | 353 | 348 | 345 | 341 | **341** | 4.8 / 20.7 / 29.5 % |

**Named profiles** (current shape; B-L in brackets):

| Profile | R1 | M | Shipped | Note |
| --- | --- | --- | --- | --- |
| Fresh | 11 (11) | 15 | **11** | Unguarded methods lose 4 chars to selector bits |
| Typical (mid-game) | 117 (123) | 117 | 117 (121) | |
| Late / end-game | 519 (929) | 467 | 460 (729) | |
| Fully unlocked (3 × 100 % files) | 356 | 188 | 179 | ⚠ 3 identical files |
| Survival | 343 (701) | 309 | 309 (576) | |
| Supplied sample | 236 (509) | 163 | 163 (289) | ⚠ Script-made near-copies of files and kits |
| Max values | 1,137 (1,752) | 879 | 875 (1,317) | |

**By completion** (median of 15 per cell, 5 at 100 %; current shape, R1 → shipped, **M**):

| Mode | 10 % | 25 % | 50 % | 75 % | 90 % | 99 % | 100 % |
| --- | --- | --- | --- | --- | --- | --- | --- |
| seq | 255 → 225 | 280 → 271 | 296 → 295 | 405 → 392 | 509 → 443 | 508 → 403 | 515 → 412 |
| scatter | 289 → 281 | 307 → 296 | 320 → 307 | 484 → 477 | 433 → 411 | 423 → 369 | 449 → 359 |

The gain concentrates **at ≥ 90 %**, where the "100 %" template beats both the codec and the K0 delta. At 25-75 % almost nothing changes: intermediate templates don't match scattered real-shaped progress. In the B-L shape: 10 % 355 → 309 … 99 % 671 → 560.

## 3. Which sections gain (adaptive H vs that section's round-1 representation, bits incl. selectors, M)

| Section | Progress corpus | Random-200 | Chosen most often (progress corpus) |
| --- | --- | --- | --- |
| Campaign files | 226,192 → 200,469 (**−11.4 %**) | −22.9 % | full template 33 %, modular 29 %, codec 26 %, fresh 7 %, half 2 %, prev-slot 3 % |
| B-L files (DESIGN) | 297,522 → 258,816 (**−13.0 %**) | −15.5 % | prev-slot 51 %, r1 27 %, modular 18 %, K0 4 % |
| Current Classic slot | 135,888 → 129,845 (−4.4 %) | −5.8 % | K0 35 %, r1 26 %, modular 22 %, prev 17 % |
| Classic unlocks (`classicCheats`, tutorials seen) | −4.7 % | −1.3 % | allUnlocked 45 % |
| Progress | −4.6 % | +0.6 % | allDone 31 % |
| Settings options / device prefs | +1 bit each (worse) | ≈ 0 | default always |

**Per-file codes (typed; Base32 + CRC-16, M):**
- **Campaign**, 607 files. A new per-file kind would be version 4: a 5-bit version head, a 3-bit selector over fresh / half / smb / full / modular, and the score kept (the existing code drops it).
  - It wins **32.8 %** of files, nearly all at high completion (full 129, modular 66).
  - Shipped min(existing, new): median **105 → 93**, p95 146 → 143, max 157 → 157.
  - fresh + full alone: 31.5 % wins, same median 93.
- **Classic**, 1,676 slots (current and B-L): new delta operations and modular stages win **0 %** against round 1's slot code (median 71). The selector bits eat the gain.

## 4. Cross-slot on future 9-file B-L backups (Classic-only profiles, 60 each, M)

| Regime (synthetic) | R1 median | E (no cross) | F / H (cross-slot) | Gain |
| --- | --- | --- | --- | --- |
| Every file independent (rules, heroes, kits) | 959 | 959 | 949 | **−1.0 %** |
| Same rules within a set, independent kits | 955 | 955 | 920 | −3.7 % |
| Same rules, same heroes, 30 % of kit values changed | 921 | 920 | 636 | **−31 %** |

Every combination still round-trips. Cross-slot is only a candidate; the per-record K0 / r1 code always remains available. Whether real B-L files look like row 1 or row 3 depends on B-L's design (does a new file copy the global rules?) and on player behaviour (**F**).

## 5. References that make codes longer, and the no-regression guard (M)

- **Forcing a template** instead of `fresh` makes a campaign file longer in **16.8 %** (half), **32.3 %** (smb) and **35.1 %** (full) of 881 files. The worst case was +78 bits for `full` on a near-fresh file.
- **"Closest reference by field differences"** (leaf-level symmetric difference) is not optimal in **9.4 %** of files. When wrong it costs +109 bits on average (≈ 18 chars), at most +328 bits (≈ 55 chars). The encoder therefore tries every candidate and keeps the shortest, rather than predicting.
- **Unguarded adaptive H** is longer than R1 in 0-3 profiles per group: the fresh profile (15 vs 11) and a few small profiles where the selector bits outweigh the saving. **With the guard** (method picked in the flags byte, 0 bytes): **0 of 1,592 longer**.
- **Without the CRC**, 400 single-bit flips in an adaptive payload gave 216 decode errors, **183 silently different profiles** and 1 identical. A flipped selector picks another reference, so references make corruption *louder* in content. The CRC-32 envelope stays mandatory.

## 6. Cost: speed, bundle, compatibility

**Speed** (Node, per profile, incl. envelope, n = 1,592, **M**; browser likely 1-3× slower, **F**):

| | Encode median / p95 / max | Decode median / p95 |
| --- | --- | --- |
| R1 | 0.9 / 1.8 / 19 ms | 0.7 / 1.2 ms |
| Adaptive H | 12.4 / 24 / 40 ms | 1.4 / 2.6 ms |

**Static tables** (frozen JSON, **M**):

| Table | Raw | gzip |
| --- | --- | --- |
| Round 1, for comparison: new dictionaries | 6,947 B | 2,294 B |
| Round 1: defaults snapshot | 4,059 B | 1,473 B |
| **Round 2: campaign templates** half / smb / full | 7,500 B | 1,790 B |
| Round 2: per-hero basic / full kit tables | 1,973 B | 541 B |
| Round 2: unlock / progress templates | 1,151 B | 439 B |
| **Round 2 total** | **10.6 KB** | **≈ 2.8 KB** |

Config M needs only the full template, the full kits and the two "all" templates: ≈ 1.5-2 KB gzip (**F**). Less if the full template is generated from the frozen dictionaries (it is "every id in them").

**Compatibility:**
- Existing campaign codes and links are untouched; the codec is reused as one candidate.
- The method is a flags-byte value, so a build that does not know it must answer "newer version". Specify that now, even if only method 0 ships.
- Each reference table is frozen per code version and bundled forever (`docs/RELEASING.md:187`). Adding a hero or level means a *new* template version, never an edit.
- Derived references (G) would also freeze game logic (`upgradeStory`, `metIds`, `seedSeen`). A later change to those functions would silently change what old codes decode to, unless a frozen copy is kept. **Avoid.**
- Strict decoding, the CRC-32, dev-field exclusion, the store migrations after decode, and loader-level equality are all kept. Loader-level equality was checked through the real loaders on the named profiles and every 4th profile (current shape); B-L has no loader.

## 7. Recommendation

**Keep the round-1 proposal as the format to implement now. Do not adopt multi-K, modular or derived references.**

1. **Ship round 1** (R1 hybrid as method 0). Reserve the method value in the flags byte, and define "unknown method → newer version". This costs nothing and keeps the door open.
2. **Optional later, only if the owner sets a length target R1 misses** (e.g. "most backups under 500"): add **method 1 = config M**:
   - candidates per section: round-1 representation, campaign codec, one frozen "100 %" reference per section, previous slot;
   - always guarded by min(method 1, R1);
   - measured: −5 to −13 % median, −20 to −24 % at p95, never longer, ≈ 1.5-2 KB gzip, one extra encoder path.
3. **Do not** add intermediate templates (half/smb: chosen for 2 % of files), whole-profile selectors (lose to R1 in 31 % of profiles), modular or derived stages (+0-3 % for frozen game logic), or new per-file versions:
   - campaign: median −12 chars on a third of the files, for a new code version;
   - Classic: 0 % wins.
4. **Revisit cross-slot after B-L ships.** If new B-L files copy the set's rules and kits, previous-slot references cut 9-file backups by up to ~30 %. If they don't, by ~1 %.

Every reference choice was tried, not predicted, and every size includes its selector and framing bits.
