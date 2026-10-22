# SMBC Remix — Compact, Self-Contained Save Codes

## Purpose of this handoff

I'm exploring a portable save system that allows a player to reconstruct their game state **without a server-side database and without keeping a local save file**. Please review this proposal against the actual SMBC Remix codebase, answer the questions below, and recommend a realistic approach. **Do not change the code yet**; this is an architecture and feasibility review.

I will share your findings with a second agent to choose a design and plan an implementation.

## The four values

- **K — shared fixed knowledge:** A predetermined, potentially large, versioned collection of game rules, schema, default values, dictionaries, reconstruction algorithms, etc. Built into the game, available when saving and restoring.
- **A — complete save data:** The long game-state representation that currently needs to be exported and restored.
- **E — short user-provided secret:** A short value the player can remember or enter again. It could be a password/PIN/passphrase, but its exact security purpose remains open.
- **H — portable short save code:** The string the user copies, records, texts to themselves, or enters later.

Desired operations:

```text
H = Encode(K, A, E)
A = Decode(K, H, E)
```

The decode should recover all **required** state exactly (or reconstruct an equivalent valid state if we explicitly agree that some export fields aren't required). It must work offline/in a normal browser, without a database. A relatively short, human-manageable `H` is a major goal.

### Important mathematical constraint

A shared fixed `K` and a password-like `E` do **not** magically allow arbitrary data to fit into an arbitrarily short `H`. A shorter code is possible to the extent the original data has defaults, repetitive structure, limited value ranges, inferred fields, or other exploitable constraints. We must measure achievable size and document any tradeoffs.

## Example data provided

The example consists of:

1. `sample-save.json` — formatted exported JSON, **23,104 bytes**.
2. `sample-save-code.txt` — existing encoded text, **2,941 characters** (excluding its trailing newline).

**Verified:** The text code begins with `z`. The remainder is URL-safe Base64 containing a **raw DEFLATE** stream. After decoding/decompressing, it produces **11,819 bytes of minified JSON** that parse to the *same JSON object* as the supplied `sample-save.json`. Thus the current format is already losslessly compressed; we should compare any replacement with **2,941 characters**, not just 23 KB of pretty-printed JSON.

The sample has 14 keys in `data`:

- `smbc.settings`
- `smbc.progress`
- `smbc.save.1` through `.3`
- `smbc-classic-file-smb-1` through `-3`
- `smbc-classic-file-special-1` through `-3`
- `smbc-classic-file-lost-1` through `-3`

There are extensive input bindings and settings, mostly default-looking booleans/empty arrays, unlock and progress markers, timestamps, and repeated `heroKits` / `rules` / `more` structures across classic save records. **These are observations about one sample, not proof any field can be dropped.**

## Proposed architecture to evaluate

### Stage 1 — establish the required semantics

Determine whether an export must preserve:

- **(a)** all user preferences, global progress/unlocks, and every save slot;
- **(b)** a chosen individual save slot, with necessary global dependencies; or
- **(c)** both, as two export modes.

Distinguish *byte-for-byte identical JSON reconstruction* from *semantically equivalent state that loads and behaves identically*. Prefer semantic equivalence if the application contract permits it, but be explicit about fields omitted/rebuilt.

### Stage 2 — compact lossless serialization

Investigate a versioned binary schema with:

- short numeric IDs or fixed schemas instead of verbose JSON property names;
- bitsets for boolean flags, unlocked items, completed stages, and achievements;
- enum indices for levels, characters, weapons, difficulty, power states, etc.;
- variable-length unsigned/signed integers for scores, counters, and similar numbers;
- efficiently encoded sparse arrays/maps and IDs;
- optionally a final compression stage (DEFLATE/Brotli or another browser-compatible codec) **only when benchmarks show it helps**.

### Stage 3 — use K to reconstruct shared/default structure

Store deterministic versioned defaults, schema and repeated immutable structures in `K` and only encode exceptions. Investigate safe derivations (e.g., counters or progress inferred from stored facts). Never infer relationships from this one sample alone.

### Stage 4 — optionally apply E

Please investigate whether `E` is needed at all. A passphrase may be desirable for privacy, an anti-typo personalization mechanism, or making codes harder to casually share. But it cannot replace the state bits. If genuine confidentiality/authentication is desired, propose appropriate browser-compatible authenticated encryption and password-based key derivation, and account for nonce/salt/tag overhead. A human-memorable short secret has low entropy; don't represent it as strong security by default. If codes are intended to be easily portable and shareable, an unencrypted, checksummed code may be preferable. Note that client-side cryptography cannot reliably prevent cheating or tampering by a determined player with access to the game.

### Stage 5 — durable, user-friendly H

Design a versioned envelope; human-readable alphabet (e.g., base64url, base32, Crockford base32), optional grouping, typo detection/checksum, future migration, and graceful handling of malformed/older codes. Evaluate character length and user experience, especially mobile copy/paste vs manual transcription.

## Questions for the code-aware agent

### A. Current format and boundaries

1. Which source modules/functions construct the JSON export, compress it into the current `z...` string, decode it, and import it? Provide file paths and names, plus a brief data-flow explanation.
2. Are exports currently intended as a full user profile backup, or are there existing per-slot save/export mechanisms? What is required for a playable restore?
3. Are the names and versions (`app`, `v`, settings versions, slot `v`) governed by a documented schema? What migration or backward compatibility logic exists?
4. Which state is authoritative: localStorage, IndexedDB, another store, or a runtime model? Are any save fields recalculated when loaded?

### B. Field inventory and essential data

5. Please inventory the top-level groups and nested fields. Classify each as **essential game state**, **global unlock/progression**, **user preference/input mapping**, **derived/recomputable**, **defaultable**, **metadata**, or **unknown**.
6. For every proposed omission, default, or inferred value, cite code evidence: the default construction, reader, migration logic, or invariant. Highlight any fields whose omission might silently reset unlocks/achievements or corrupt saves.
7. Do settings/key bindings need to follow the player with a save? Are they device-specific? Does a single classic-mode slot rely on global progress, settings, heroes, unlock flags, or cross-slot state?
8. What are the legal domains and realistic max sizes for all variable fields: score, coins, lives, timestamps, position coordinates, level IDs, unlocked item sets, collections, dynamically introduced content/mods/custom packs, etc.? Are arrays ordered? Can fields contain arbitrary strings?
9. Are there state elements outside this export that matter for exact restore (random seed, procedural generation, mutable world changes, hidden events, local achievements, DLC/mod pack IDs)?

### C. Reconstruction opportunities

10. Which default structures are safe to bundle in `K`? What fields can reliably be encoded as overrides, bitsets, enum IDs, or sparse numeric maps?
11. Are the repeated classic `heroKits`, `rules`, and `more` structures independent user-controlled fields, shared defaults, or intentionally snapshotted configurations?
12. Can completed-stage lists, unlocked characters, `freed`/`met`/`tutorials`, and progression markers be derived from other recorded fields? Identify cases where derivation **does not** hold.
13. How should `K` be versioned so a code generated on an older game release still restores correctly after changes to character lists, game defaults, level IDs, or save schema? Can multiple dictionaries/decoders remain bundled?
14. Does any existing fixed-length seed or compact canonical state already generate what appears as a large save? If so, identify it and describe which fields would still need to be encoded.

### D. Feasibility and measurement

15. Please build a **read-only prototype/benchmark**, if feasible, that round-trips the supplied sample and reports lengths for:
    - Existing `z...` export (baseline: 2,941 characters).
    - Minified JSON + the existing compression codec.
    - Binary schema without post-compression.
    - Binary schema with post-compression.
    - Default-aware/delta serialization (with and without post-compression).
    - Optionally, per-slot-only export.
16. Test **more than this sample**: fresh save, mid-game, late/end-game, unusual settings/key bindings, high-score/high-inventory, fully unlocked, classic modes, modded/custom content if supported. Provide min/median/max code sizes by scenario; clarify whether any measurements are estimates.
17. Validate real decode correctness. Prefer deep-equality where exact reproduction is intended, otherwise load into game and test a documented equivalence checklist. Include corruption/fuzz tests and schema-version tests.
18. Set realistic short-code targets from measurements (for example under 100, 250, 500, 1,000 characters), and explain what functionality each target would require sacrificing, if any. **Do not promise a target before benchmarking.**

### E. E, security, and user experience

19. What do you recommend `E` should be used for: encryption key, independent memorized recovery factor, lightweight code personalization, or not used at all? Why?
20. Is it acceptable that anyone with a valid code can load that save? Is confidentiality a requirement? Is cheat resistance required or out of scope? Are codes expected to be texted/shared?
21. Would you recommend one full-profile code, separate codes per slot, or both? Include usability and length implications.
22. What should happen when users enter an incorrect `E`, mistype `H`, import an outdated version, or load a code with unsupported future fields?

## Requested response format

Please return a Markdown technical note containing:

1. **Executive feasibility verdict**, with likely compression opportunities and risks.
2. **Current code paths**, file/function names and export/import flow.
3. **Field classification table**, including evidence and any dangerous omissions.
4. **Recommended encoding spec**, especially `K` contents, exact semantics of `E`, and the envelope for `H`.
5. **Measured comparisons** against the existing 2,941-character string; distinguish measured numbers from forecasts.
6. **Open design decisions** requiring a product-owner answer.
7. **Incremental implementation/test plan**, but no code changes unless separately authorized.

Prioritize identifying what must actually survive save-and-load; the desired outcome is the **shortest practical, correct, offline-restorable code**, not simply the smallest JSON file.
