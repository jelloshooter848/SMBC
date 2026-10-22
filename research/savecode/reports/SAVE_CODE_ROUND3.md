# SMBC Remix save codes, round 3: audit, cost breakdown, Experiments A–D, compressor controls

Branch `claude/savecode-research`. This is research only. No production code changed: `src/`, `tests/` and the configs are untouched, and the temporary vitest shim was deleted after each run and never committed.

**M** = MEASURED by `harness/bench3.ts` (raw output in `harness/results3.json`). **F** = FORECAST (arithmetic or judgement, not run).

Every length:
- is a complete Base64url profile code: `P` + version + flags + CRC-32 + payload, which is 9 chars of framing;
- uses the semantic policy (dev fields and timestamps dropped);
- counts every presence bit, selector, count, escape, model and finalisation byte.

A new method's identity sits in the existing flags byte, so it costs 0 bytes. Whole-profile codes are paste/link codes, so typed Base32 does not apply to them. The typed per-file codes are not changed by anything here.

"Ratio" is the ratio of corpus medians. "Per-profile" is the median of the per-profile percentage savings. They are different statistics, and the tables report both.

---

## Classification and recommendation (§9)

### Recommendation

**Retain R1 for the first release, with the method value reserved, and keep config M as the optional next step, exactly as round 2 recommended. No new technique is justified now.**

- **One fix inside R1's own design, with no new technique:** give `classicTutorialsSeen` a frozen dictionary built from the game's `TUTORIAL_IDS` (39 ids).
  - Round 1's K left this dictionary empty, so every id is sent as an escaped string. Escapes are 2.4–4.3 % of all raw bits (**M**).
  - The gain cannot be measured here, because the synthetic generators use ids that are not in the registry (0 of 6) (**M**).
  - On real ids, each id would drop from about 50–90 bits to one 6-bit symbol (**F**).
- **If a length target is still missed after config M,** the only increment this round measured is:
  - **method 2 = M + an adaptive binary range coder over the codec's own decisions.** It needs no trained table, is guarded by min(method 2, M, R1), and adds about 3 KB of gzipped source.
  - It saves **3–5 % per profile beyond guarded M (12–26 chars median)** on all three synthetic generators. That is about the same size as M's own gain over R1, which round 2 already called marginal.
- **Trained probability tables or dictionaries** should be considered only after an opt-in real-save corpus exists, split by player. Their measured gain is 0.3 % to 28 %, depending only on how closely the test data's generator matches the training data's.

### Four-way classification

| Class | Technique | Evidence (vs guarded M unless stated) |
| --- | --- | --- |
| **1. Already present or already tested; no new experiment needed** | Set codes: bitmap, runs (campaign codec), gap lists (R1), symmetric difference vs a reference (R2). | §1 audit |
| | Integers: EG-k with a fixed per-field order, a whole-number flag with a float or text fallback, and the codec's "usual value" bit. | §1 audit |
| | Kits: the campaign codec's per-hero flag/number dictionaries with usual values and usual hp (a frozen per-hero numeric baseline); R2's basic/full kit templates. | §1 audit |
| | Structural sharing: whole-record previous-slot references (M); kits and rules stages against a previous slot (H). | Round 2 |
| | Entropy coding: DEFLATE's Huffman stage (R1, M). | §1 audit |
| | Dictionary + escape for ids. The K content gap for `classicTutorialsSeen` is fixed within R1 (see the recommendation). | §1, §7 |
| | Comparison policy: R1 and M decode to the same full semantic state. | 0 of 1,176 profiles differ (**M**) |
| **2. New technique with material measured improvement** | **None that holds across generators.** | §4, §6 |
| **3. New technique with marginal or no improvement** | A1, whole-profile candidate search. | Median 0. At most 0–55 of 190–200 profiles get shorter, by at most 33 chars (**M**) |
| | A2, field-major channels. | **Worse**: −2 to −3.5 % tight, −20 to −24 % byte-aligned (**M**) |
| | B, adaptive range coding (no table). | **+3.4 to +4.8 % per profile**, 12–26 chars median, never longer when guarded (**M**) |
| | C, enumerative set code. | +0.6 to +1.9 % on two generators, worse on random-200; on R1 ≤ 0 (**M**) |
| | C, mixed-radix packing. | Stopped on budget: a median of 26–45 raw bits of slack per profile (**M**) |
| | D, hierarchical sharing. | Stopped at stage 2: median 0 repeats beyond one best reference; net estimate negative (**M**) |
| | Zopfli; zstd and Brotli without a dictionary. | Median 0 (**M**) |
| | zstd or DEFLATE with a trained dictionary. | +3 to +9 % only where the test data shares the training generator's Classic palette; 0 to +0.9 % on the independent corpus (**M**) |
| **4. Not evaluated: no implementation or no representative data** | Trained models or dictionaries on real players. | No real saves exist |
| | Per-hero Classic kit prediction. | Every corpus's Classic kits come from a synthetic palette |
| | Tutorial-id dictionary gain. | The synthetic ids are not real |
| | Shared Brotli. | No offline implementation with a dictionary interface |
| | zstd-with-dictionary in browsers. | No built-in API; `fzstd` has no dictionary support |
| | B-L. | No real loader (structural checks only) |
| | Browser and iPhone/iPad timings. | Node only |

### Headline numbers (**M**; medians; guarded = never longer than the guard)

| Corpus / shape | R1 | Guarded M | Guarded M vs R1: ratio / per-profile | + adaptive range coding, guarded | Its gain beyond guarded M: ratio / per-profile / chars |
| --- | --- | --- | --- | --- | --- |
| progress / current | 375 | 345 | 8.0 % / 4.3 % | **335** | 2.9 % / 3.4 % / 12 |
| progress / B-L (design) | 487 | 447 | 8.2 % / 8.4 % | **425** | 4.9 % / 4.4 % / 17 |
| rk (independent kits) / current | 405 | 389 | 4.0 % / 2.8 % | **376** | 3.3 % / 3.9 % / 13 |
| rk / B-L (design) | 607 | 567 | 6.6 % / 3.3 % | **547** | 3.5 % / 4.8 % / 26 |
| random-200 / current | 351 | 311 | 11.4 % / 7.1 % | **300** | 3.5 % / 2.6 % / 8 |
| random-200 / B-L | 513 | 460 | 10.3 % / 10.3 % | **439** | 4.6 % / 4.2 % / 19 |

Guarded M, measured explicitly as min(M, R1):
- it is never longer than R1;
- unguarded M is longer than R1 in 2, 0, 4, 4, 8 and 2 profiles of the six rows above (**M**).

Round 2's "5.1 %" was guarded H, not guarded M: H measures 5.13 % here, M 4.31 %.

---

## 0. What was run, and what the data is

- **Harness.** Round 1-2's harness was reused unchanged in behaviour:
  - re-running `bench2.ts` with round 3's instrumentation gives a `results2.json` identical to the committed one, timings aside (**M**);
  - it runs through the real game modules (`encodeSaveCode` / `decodeSaveCode`, `migrateSave`, the loaders).
- **New files:**
  - `trace.ts`: a call-level trace of every bit-writer call, with the semantic role and schema path the codec sets.
  - `layouts.ts` (A2).
  - `rc.ts` (B).
  - `scenarios3.ts`: the rk corpus.
  - `bench3.ts`.
  - `train_zstd_dict.py`.
  - `results3.json`.
  - Small hooks in `codec.ts` / `codec2.ts` / `bench.ts` / `bench2.ts`: roles, a reader parameter, exports, and the `OPT.enumSets` toggle.
- **Checks: 24,564, failures 0 (M).**
  - Every R1 and M encoding of all 1,176 profile×shape cases was replayed through the real decoders. Each read had to match the encoder's call in kind, width, role and schema path. This is the proof that every layout and model below is decodable.
  - The sectionised M equals bench2's M bit for bit (1,176 of 1,176).
  - A1, A2, B and C were decoded back to the full semantic state: all A1 and C cases, sampled A2 and B cases.
  - Compressor round trips were checked.
  - Loader-level equality through `loadSettings` / `loadProgress` / `loadSave` / `loadClassicResume` was checked for A1 and for B, on the named profiles and every 4th current-shape profile.
- **Corpora** (all synthetic; no real player saves exist):
  - progress (190);
  - random-200;
  - named (8);
  - **rk (190, new).**
- **Why rk exists.** Round 2 called the progress corpus "the fairer test". The audit found that **every corpus, progress included, draws Classic kits from one 6-entry palette** (`scenarios.ts` `KITS`) and **B-L rules from 3 presets**, so anything trained on one corpus learns the palette. rk keeps the progress profiles but regenerates every Classic hero, kit and B-L rules row from a separate seed stream:
  - a random roster subset;
  - campaign heroes get a random share of their real full kit;
  - other heroes get per-hero key sets;
  - rules rows are independent.

  rk is still synthetic. It is only *different* from the training generators.
- **Splits.** Learned components (B tables, zstd/DEFLATE dictionaries) were trained on one corpus and tested on another, as listed in §4 and §6. Named profiles were only ever tested. There is no real-player split, because no real saves exist.

## 1. Audit: what R1, R2 and the campaign codec already do (§2)

1. **Sets.**
   - Campaign codec (`save-code.ts` `writeIndexSet`): runs (gap + length) or a bitmap, plus an escaped list of unknown ids.
   - R1 generic: an EG0 gap list or a bitmap, plus escapes.
   - R2: the symmetric difference against a reference (which covers "complement of a full template").
   - Absent: combinatorial ranking and exception masks. Ranking was added in C.
2. **Integers.**
   - EG-k with a fixed order per field (score 10, coins 3–4, lives 2, stats 4; 0 or 2 otherwise).
   - A whole-number flag with an f64 fallback (R1) or a text fallback (codec).
   - The codec's 1-bit "usual value" for kit numbers and hp.
   - Enums: a fixed width plus an escape.
   - Absent: exact ranges for numbers and joint packing.
3. **Kits.**
   - Campaign codec: per-hero flag and number-key dictionaries (`KIT_FLAGS` / `KIT_NUMS`), a usual value per number key, and usual hp = `maxHp` or `FULL_HP`. **This is already a frozen per-hero numeric baseline.**
   - R2: basic/full per-hero templates for campaign equipment.
   - **Classic `heroKits` in R1/M: a generic map over the global `KIT_KEYS` dictionary** (about 8 bits per key) with EG0 values. No per-hero model.
4. **Probability coding.**
   - Only DEFLATE: Huffman over the LZ77 symbols of the packed bytes, which are unaligned and bit-packed.
   - The EG codes are fixed implicit priors.
   - No model is conditioned on game fields.
5. **Structural sharing.**
   - Whole-record previous-slot references (M).
   - Separately referenced heroKits and rules stages (H).
   - Absent: individual-hero references and reusable nested subobjects.
6. **Layout.**
   - Record-major, tight bits, one stream, one DEFLATE, raw kept when shorter.
   - Each campaign file in R1/M is the full inner campaign code: its own version + CRC-16 (19 bits), an EG4 length and up to 4 pad bits. That is 1–3 % of raw bits.
7. **Candidate selection.**
   - Per section, the candidate with the fewest raw bits wins (local, before DEFLATE).
   - Then best-of raw/DEFLATE, and min(·, R1) on the complete code.
   - Combinations are not searched. A1 searched them.

**Comparison policy.**
- R1's decoded profiles equal the full semantic state that M is checked against in **1,176 of 1,176** cases (**M**). The campaign codec drops only fields the semantic policy drops anyway; the hybrid re-adds the score. R1, M and every round-3 candidate therefore keep the same state.
- One caveat on round 2's *per-file* table: the new kind kept the score and the existing code drops it. So that comparison was not like-for-like, and it biased the numbers against the new kind.

## 2. Instrumented cost breakdown (raw bits before DEFLATE; corpus totals, **M**)

| Category | R1, progress / current | M, progress / current | M, progress / B-L | M, rk / current | M, rk / B-L |
| --- | --- | --- | --- | --- | --- |
| Kit values (heroKits, kits, inventories) | 22.5 % | 24.7 % | 30.1 % | 32.2 % | **40.3 %** |
| Campaign codec payload (opaque) | **47.4 %** | 19.5 % | 14.7 % | 17.6 % | 11.8 % |
| Numeric values (score, coins, stats, …) | 14.0 % | 17.1 % | 16.7 % | 15.4 % | 13.9 % |
| Presence / same flags | 6.3 % | 11.8 % | 12.4 % | 10.5 % | 10.7 % |
| Set membership | 0.2 % | 10.5 % | 8.3 % | 9.5 % | 8.2 % |
| Ids / enums / bools | 3.0 % | 8.3 % | 6.9 % | 7.8 % | 5.7 % |
| Rule values (B-L rules, Classic options) | – | – | 4.1 % | – | 4.0 % |
| Unknown-string escapes | 4.0 % | 4.3 % | 3.2 % | 3.8 % | 2.6 % |
| Reference / mode selectors | 0.0 % | 1.9 % | 2.1 % | 1.6 % | 1.7 % |
| Framing: inner campaign code (version, CRC-16, length) | 2.5 % | 1.1 % | 0.8 % | 1.0 % | 0.7 % |
| Counts / lengths | 0.1 % | 0.8 % | 0.6 % | 0.7 % | 0.5 % |

The outer framing is 9 chars per code in every method.

**Controlled ablations** remove one kind of content and re-measure the complete code. They attribute length, and they are not additive (median, R1 → guarded M, **M**):

| Removed | progress / current | progress / B-L | rk / current | rk / B-L |
| --- | --- | --- | --- | --- |
| Nothing | 375 → 345 | 487 → 447 | 405 → 389 | 607 → 567 |
| Classic heroKits | 296 → 276 | 365 → 328 | 324 → 300 | 425 → 395 |
| Campaign files | 176 → 172 | 301 → 276 | 197 → 195 | 383 → 363 |
| All Classic records | 256 → 229 | 256 → 229 | 273 → 244 | 273 → 244 |
| Settings → defaults | 315 → 296 | 441 → 392 | 355 → 335 | 549 → 529 |

**Reading.**
- Classic heroKits are the largest single lever: 70–170 chars of a 345–600-char code. The campaign codec is the second.
- Every remaining category is ≤ 17 % of raw bits. Optimising a category that small cannot explain a large whole-code reduction.

## 3. Experiment A: representation choice and layout

**A1. Whole-profile candidate search.**
- Method: coordinate descent over the 4 shortest candidates per section, up to 3 passes, each scored on the complete wrapped code. It starts from greedy M, so it is never longer. It uses the same grammar, so the decoder is unchanged.
- **Median saving 0 in every group** (**M**). Profiles that get shorter:
  - progress: 5 of 190 (current), 36 of 190 (B-L);
  - rk: 0 of 190 in both shapes;
  - random-200: 9 of 200 (current), 55 of 200 (B-L).
- Largest saving: 4–33 chars.
- Cost:
  - a median of 19 evaluations and 13 ms (p95 28 ms, max 687 ms, Node) on top of M's 8.8 ms;
  - 14 of 1,176 searches scored a choice wrongly, because a later section's references depend on what earlier sections decoded to. The true re-encoded length is what counts, and it is guarded.
- **Marginal (class 3).**

**A2. Layout matrix** (one final DEFLATE, raw kept when shorter, every channel header counted; decodability proved by a decoder reading each channel by its own role; **M**):

| Layout | progress / current | progress / B-L | rk / current | rk / B-L |
| --- | --- | --- | --- | --- |
| Record-major, tight bits (= M) | 345 | 447 | 389 | 567 |
| Field-major typed channels, tight bits | 357 (−3.5 %) | 457 (−2.2 %) | 401 (−3.1 %) | 580 (−2.3 %) |
| Field-major typed channels, byte-aligned (uint bytes, LEB128 varints) | 415 (−20 %) | 547 (−22 %) | 481 (−24 %) | 699 (−23 %) |

- None of the layouts is shorter in any profile.
- At 300–700 bytes, DEFLATE gains less from grouping than the alignment and channel headers cost.
- **No improvement (class 3).**

## 4. Experiment B: semantic range coding

**What was built.**
- One LZMA-style binary range coder: 32-bit range, 11-bit probabilities, shift-5 adaptation.
  - It is integer-only and deterministic.
  - Every probability stays in [31, 2017]/2048, so no accepted value is ever unencodable.
  - Finalisation is counted. The always-zero lead byte and trailing zero bytes are dropped, and the decoder reads zeros past the end.
- It codes the traced *decisions* of the existing R1 or M representation, not its packed bytes:
  - presence/same flags, selectors and mode bits;
  - set bits and gaps;
  - enum and dictionary ids as bit-trees;
  - EG numbers as an adaptive unary prefix plus a suffix (top 6 bits modelled, the rest bypassed).
- Contexts come only from already-decoded structure: the role, plus the last two schema-path parts (field identity, kit/rules position, record kind).
- Model rules:
  - (a) frozen tables;
  - (b) adaptive from ½, which needs **no table**;
  - (c) a frozen initial table, then adaptive.
- The opaque campaign-code bits can only be modelled as bits. A bit-history context there helped little.

**Results** (best context = role + path, guarded by min(·, guarded M), **M**):

| Variant (M stream) | Train → test | Current shape: len / ratio / per-profile | B-L shape: len / ratio / per-profile |
| --- | --- | --- | --- |
| Adaptive from ½ (no table) | none → progress | 335 / 2.9 % / 3.4 % | 425 / 4.9 % / 4.4 % |
| | none → rk | 376 / 3.3 % / 3.9 % | 547 / 3.5 % / 4.8 % |
| | none → random-200 | 300 / 3.5 % / 2.6 % | 439 / 4.6 % / 4.2 % |
| Frozen init + adaptive | **random-200 → rk** (fully different generators) | 383 / 1.5 % / **0.3 %** | 567 / 0 % / **0.3 %** |
| | random-200 + progress → rk (shares progress's non-Classic generator) | 352 / 9.5 % / 12.0 % | 532 / 6.2 % / 8.0 % |
| | random-200 → progress (shares the Classic palette) | 291 / 15.7 % / 13.6 % | 359 / 19.7 % / 19.3 % |
| | rk even → rk odd (same generator) | 319 / 22.0 % / 23.3 % | 468 / 23.9 % / 23.7 % |
| | progress → random-200 | 231 / 25.7 % / 23.7 % | 331 / 28.0 % / 28.3 % |

**Other variants.**
- On the **R1** stream the coder gains about 0: median 0. Opaque campaign-code bits dominate that stream.
- Frozen tables without adaptation are worse than frozen + adaptive.
- Kind-only and role-only contexts are weaker than role + path.

**Where the bits go.** On the rk test, the palette-trained table makes kit values *longer* than raw (150 k vs 144 k bits). Its gains come from numeric, flag, escape and count fields, whose generator rk shares with progress. **The trained gains measure generator overlap, not save structure.**

**Costs (M).**
- Encode: +1.4 ms median (p95 5.8 ms, max 28 ms) on top of M.
- Decode: 3.3 ms median (p95 9.4 ms).
- Coder source: 3.0 KB gzip (harness code, unminified).
- Trained tables: 2.2–3.0 K contexts, 12–15 KB gzip as key/probability JSON (**M**); about 3 KB if the key list is derived from the schema walk (**F**).
- iPhone/iPad: plain JS arithmetic and no browser API, so it should work (**F**). Not run in a browser.

**Robustness (M).** 1,000 random byte corruptions of a range-coded payload without the CRC:
- 987 threw;
- 6 decoded to a different profile;
- 7 decoded identically;
- at most 1,557 decoder calls and 0.5 s.

With the CRC-32 envelope, 0 of 1,000 were accepted. An all-0xFF payload is rejected ("bad selector"). The 200 k-call budget was never needed.

**Conditional numeric prediction.**
- The campaign codec already predicts per-hero numbers (usual values, usual hp): class 1.
- For Classic kits, a per-hero prediction needs the real Classic kit structure, which no corpus has: class 4.

**Classification.**
- Adaptive coding is **class 3**: +3–5 % per profile beyond guarded M, never longer when guarded.
- Trained tables are **class 4**: their value depends on real data.

## 5. Experiment C: enumerative set coding and verified constraints (**M**)

**Combination-rank set code.** Cost: mode bit + EG0(k) + ⌈log₂ C(N, k)⌉, or a bitmap. It replaced the gap list as the generic set code.

| | progress / current | progress / B-L | rk / current | rk / B-L | random-200 / current | random-200 / B-L |
| --- | --- | --- | --- | --- | --- | --- |
| M + rank vs M: ratio / per-profile | 1.2 % / 1.1 % | 1.8 % / 0.6 % | 1.3 % / 1.1 % | 1.8 % / 0.9 % | 0 / 0 (71 longer) | −0.9 % / −0.5 % (158 longer) |
| R1 + rank vs R1 | 0 (77 longer) | −0.8 % | 0 | +0.3 % / 0 | −0.3 % | −2.0 % |

- Rank-coded bits deflate worse than gap lists.
- Guarded min(R1, M, M+rank) gains 1.1–1.9 % (ratio) on progress and rk, and 0 on random-200.

**Inside the campaign codec** (production code, so this is a budget only). Over 866 files, adding a rank option next to runs and bitmap would save:
- **11 raw bits per file** at the median (max 104), of about 500;
- nothing on `cleared` and `story`, where runs beat rank: 26.0 k vs 35.4 k and 48.5 k vs 70.5 k bits in total.

**Mixed-radix packing** of every bounded id/enum:
- the slack is a median of 26 raw bits per profile (current, max 88) and 45 (B-L, max 137);
- that is ≤ about 4–8 chars before DEFLATE, so the experiment stopped on budget.

**Constrained joint states.** None was introduced: no verified invariant beyond those R1 already derives (round 1 §3) was found.

**Class 3.**

## 6. Experiment D: hierarchical sharing (stages 1–2 only; **M**)

**Stage 1** measured the hero-kit entries that repeat an earlier record's entry but are *not* in the single best earlier record. A whole-record or kits-stage reference already gets those from that one record.

**Stage 2** estimated the saving: the repeat's own bits, minus a reference (1 + log₂ #definitions), minus a 1-bit "new/reference" flag on every component.

| Corpus | Median repeats | Median missed by one best reference | Median net estimate (raw bits) | p95 |
| --- | --- | --- | --- | --- |
| progress / B-L | 0 | 0 | −13 | 0 |
| rk / B-L | 0 | 0 | −16 | −1 |
| random-200 / B-L (palette stress) | 0 | 0 | −20 | 0 |
| B-L regime: independent / shared rules | 0 | 0 | −93 / −94 | −56 / −64 |
| B-L regime: shared rules + kits, 30 % changed | 27 | 1 | −48 | +95 |
| B-L regime: "mosaic" (each kit from a random earlier file) | 29 | 1 | −54 | +13 |

- One best reference already captures nearly every repeat, even in the adversarial mosaic regime. The flags cost more than the rest saves.
- **Stopped at stage 2, with no implementation.** On these regimes guarded M already reaches 523–949 chars against R1's 915–959.

## 7. Compressor controls (progress all; rk odd half; **M**)

| Control on the payload | progress / current | progress / B-L | rk / current | rk / B-L |
| --- | --- | --- | --- | --- |
| DEFLATE 9 (= guarded M) | 345 | 447 | 409 | 615 |
| Zopfli, 50 iterations (standard DEFLATE output) | 345 (21 shorter) | 447 (48 shorter) | 409 | 615 |
| zstd 19, magicless, no checksum/size/dictID | 345 | 447 | 409 | 615 |
| Brotli q11 | 345 | 447 | 409 | 615 |
| zstd + 4 KB dictionary trained on random-200 | 320 (7.3 % / 3.8 %) | 404 (9.6 % / 8.5 %) | 408 (0.2 % / 0) | 613 (0.3 % / 0) |
| DEFLATE + the same dictionary | 321 (7.0 % / 3.1 %) | 412 (7.8 % / 6.9 %) | 409 (0 / 0) | 615 (0 / 0) |
| zstd + 4 KB dictionary trained on rk's even half | – | – | 408 (0.2 % / 0) | 605 (1.6 % / 0.9 %) |

The rk columns are the odd half only (n = 95), so their medians differ from the full-corpus 389 and 567.

- Zopfli's encode cost is 86 ms median and 962 ms max.
- The dictionaries are 1–4 KB.
- **Deployment.**
  - `CompressionStream` has no dictionary option, so DEFLATE with a dictionary needs a JS inflater (fflate, which has `dictionary`).
  - zstd has no browser API, and `fzstd` cannot use dictionaries, so it needs a WASM decoder (**F**: tens of KB).
  - **Shared Brotli: not evaluated (class 4).** No offline implementation exposes the dictionary interface. Node's Brotli has none.
- **Class 3.** The dictionary gains are palette overlap and vanish on rk.

## 8. By completion and named profiles (median, current shape, **M**)

| Completion | 10 % | 25 % | 50 % | 75 % | 90 % | 99 % | 100 % |
| --- | --- | --- | --- | --- | --- | --- | --- |
| progress: R1 → guarded M → + adaptive range coding | 283 → 259 → 253 | 280 → 272 → 271 | 303 → 300 → 300 | 439 → 413 → 389 | 469 → 427 → 397 | 461 → 388 → 365 | 476 → 381 → 360 |
| rk: same | 203 → 195 → 189 | 317 → 311 → 301 | 412 → 404 → 401 | 488 → 485 → 455 | 507 → 483 → 455 | 553 → 484 → 453 | 519 → 452 → 419 |

| Named profile (current / B-L) | R1 | Guarded M | Guarded H | A1 | + adaptive range coding |
| --- | --- | --- | --- | --- | --- |
| Fresh | 11 / 11 | 11 / 11 | 11 / 11 | 11 / 11 | 11 / 11 |
| Typical (mid-game) | 117 / 123 | 117 / 121 | 117 / 121 | 117 / 121 | 117 / 121 |
| Late / end-game | 519 / 929 | 467 / 755 | 460 / 729 | 467 / 737 | 443 / 684 |
| Fully unlocked ⚠ (identical files) | 356 / 356 | 188 / 188 | 179 / 179 | 188 / 188 | 181 / 181 |
| Survival | 343 / 701 | 309 / 573 | 309 / 576 | 309 / 549 | 293 / 515 |
| Supplied sample ⚠ (near-copies) | 236 / 509 | 163 / 289 | 163 / 289 | 163 / 289 | 163 / 279 |
| Max values | 1,137 / 1,752 | 879 / 1,327 | 875 / 1,317 | 869 / 1,304 | 829 / 1,211 |

As in round 2, the gains sit at ≥ 75 % completion. Fresh and typical profiles do not change.

## 9. Limits

- Every number comes from synthetic generators. rk shows that guarded M's gain over R1 also shrinks when Classic kits are not palette-drawn: 2.8–3.3 % per profile on rk vs 4.3–8.4 % on progress.
- The B-L shape is still the sample's placeholder design. It has structural checks only and no loader, and must be re-measured once `claude/classic-files` lands.
- There are no browser, iPhone/iPad or memory measurements. All timings are Node.
- The negative results hold for these representations and corpora. They do not prove an optimum.

**To run:**

```sh
cp research/savecode/harness/zz-savecode-bench.test.ts.shim tests/zz-savecode-bench.test.ts
SCRATCH=<dir> DEPS=<dir with @gfx/zopfli> BENCH_FILE=$PWD/research/savecode/harness/bench3.ts npx vitest run tests/zz-savecode-bench.test.ts
rm tests/zz-savecode-bench.test.ts
```

- It takes about 9 minutes.
- It needs `python3` with `zstandard` for the dictionary training.
- The vitest "failure" it reports is only the shim's string comparison. The checks are in `results3.json`.
