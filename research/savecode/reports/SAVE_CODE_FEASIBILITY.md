# SMBC Remix: compact, self-contained save codes. Feasibility note

Repo `main` at `b56d770` (v0.4.68), with `origin/claude/bug-play` (PR #193) read for Classic `heroKits`. This is a read-only review: the repo is unchanged and `git status --short` is empty. The benchmark code is in `/tmp/claude-0/-home-user-SMBC/ed1be232-9526-5dbb-b2cc-de87896d1401/scratchpad/savecode/` (`codec.ts`, `schema.ts`, `scenarios.ts`, `bench.ts`, raw numbers in `results.json`). It ran through vitest against the game's real modules, then the temporary test shim was deleted.

**Read this first: what the sample is.** The supplied `sample-save.json` and `sample-save-code.txt` were made by a throwaway script. **No whole-game export exists in the game today.**
- `smbc.settings` (`defaultSettings()` plus 2 tweaks) and `smbc.save.1..3` (`newSave()` plus edits) come from real code.
- `smbc.progress` was hand-written in the real shape.
- The envelope `{app, v, exported, data}` was invented.
- The 9 `smbc-classic-file-{set}-{n}` records are **invented placeholders** for batch **B-L "Classic save files"**. B-L is approved but not built: 3 files per map set, each with its own rules and continues, and heroKits per hero. Its field names (`rules`, `more`, `continues`, `savedAt` and so on) are not a real schema. The sample even holds values no game enum has (`'original'`, `gameMode: 'allHeroes'`).
- The real Classic save today is **one slot per map set**: key `smbc-classic-resume-{set}`, type `ClassicResume` (`src/game/run-resume.ts:38-63`). Its `heroKits` exist only on PR #193.
- The `z` code is Node `deflateRaw` level 9 plus base64url. Re-encoding the sample reproduces it exactly: 2,941 chars, decoding to the same object (MEASURED).

Every number below is labelled **M** (MEASURED by `bench.ts`) or **F** (FORECAST: arithmetic or judgement, not run).

---

## 1. Executive feasibility verdict

**Feasible, with two caveats: there are two different products here, and a short whole-profile code is not realistic.**

- **Per-file codes are already solved for the campaign.** The existing bit-packed Crockford-Base32 code (`src/game/save/save-code.ts`) gives 23 / 36 / 58 / 96 chars for a new, first-castle, mid-game and 100% file (**M**). The same building blocks give a **Classic slot code of 19-41 chars without heroKits and 50-200 with them** (**M**).
- **A whole-profile code** covers settings, unlocks, 3 campaign files and 3 Classic slots (or 9 B-L files). Best encoding (**M**):
  - fresh profile: **11** chars;
  - typical profile: **~115-140**;
  - the sample: **203-236** in today's slot shape, **~470-510** in B-L shape;
  - late or 100% profile: **~350-520** (B-L shape ~930);
  - adversarial maximum: ~1,000-1,750.
  - Median of 200 random profiles: **351** (current shape) and **513** (B-L shape), against **3,723** for today's `z` JSON (**M**).
  - That is roughly **6x-30x shorter than the `z` baseline**, but **not "short"**: it is a paste-or-link artefact, not something to type in.
- **The wins come from:**
  1. K-side defaults (a fresh profile costs about 3 bits);
  2. reusing the campaign codec for campaign files (3.7x better than a naive schema on a 100% file: 96 vs 355 chars, **M**);
  3. dictionaries and enums;
  4. dropping dev-only fields and timestamps.

  Deflating the bit-packed binary helps only once there are many records (B-L files, max profiles). On small profiles it costs a few chars.
- **The biggest variable costs** are Classic `heroKits` (≈ 7-10 chars per hero kept), campaign 100% files (≈ 100 chars each), custom key bindings (≈ 50-150 chars), and B-L's 9 files.
- **E should not be used.** No encryption, and no birthday. Codes stay unencrypted, checksummed, versioned and shareable. A low-entropy secret cannot shorten H or protect it meaningfully (§4.3).
- **Top risks:**
  1. **Classic cheat unlocks and stats live in `smbc.settings`, not in progress.** An export that treats settings as device preferences silently resets every Classic unlock.
  2. **Today's `z` format has no checksum.** In 2,000 single-character typos on the sample, **135 (6.75 %) decoded to valid but different data** with no error (**M**).
  3. **Delta-from-defaults must use frozen per-version defaults.** A default that changes in a later build (precedent: the master volume moved 0.8 → 0.4 in 0.4.49) would otherwise silently rewrite old codes.
  4. A per-slot Classic code is **not self-contained today**: a `ClassicResume` plays under the device's global Classic options, cheats and hero list.
  5. Carrying `devUnlock` or `dev` would open dev mode on a release build.

---

## 2. Current code paths

| Piece | Where | What it does |
| --- | --- | --- |
| Storage | `src/engine/save/storage.ts:1-35` `loadJson/saveJson/removeKey/hasKey` | localStorage JSON, never throws. **localStorage is the only authoritative store for saves.** |
| `z`/`r` text codec | `src/engine/share.ts:28-50` `encodeShare/decodeShare` | `CompressionStream('deflate-raw')` + base64url, prefix `z`; `r` = plain base64url fallback. **No checksum, no version.** Used only by the level editor's SHARE (`src/game/scenes/editor.ts:293`) and `#level=` links (`src/main.ts:290,328`). **Not** used for saves. |
| Campaign save file | `src/game/save/save-files.ts`: `SaveFile` 27-147, `saveKey` 149, `SAVE_MIGRATIONS`/`SAVE_VERSION` 243-245 (v4), `newSave` 265-311, `migrateSave` 454-556, `loadSave/writeSave` 559-567 | `smbc.save.{1,2,3}`; every read goes through migrations + field-by-field validation + derivations |
| Campaign save code | `src/game/save/save-code.ts`: `CODE_VERSION=3` 38, `SAVE_CODE_FIELDS` 53-97, frozen chunked dicts 109-390, `dictFingerprints` 402, `FIELDS` 742, `packCode` 974, `encodeSaveCode` 985, `decodeSaveCode` 1008-1050, `codeCandidates` 1063, `saveLink/linkCode` 1132/1146 | Bit-packed, Crockford Base32, groups of 5, `[version EG0][CRC-16][fields][pad]`, decoded then passed through `migrateSave` |
| Bit layer | `src/game/save/code-bits.ts`: `BitWriter/BitReader` (EG-k), `BASE32`, `cleanCode` (O→0, I/L→1, dashes and spaces ignored), `crc16` | Pure, reusable as is |
| Share/copy | `src/game/save/share-code.ts` `shareSave/copyCode/browserShareEnv` | share sheet → clipboard → execCommand fallback |
| UI | `src/game/scenes/save-codes.ts`: `SaveFilesOptions` 70, `FileCodeScene` 152 (COPY CODE, SHARE SAVE), `PasteCodeScene` 274, `LoadCodeScene` 381 (LOAD THIS SAVE?, choose file, `writeSave` 505); `#save=` via `main.ts:291-296` → `Game.offerSaveLink` (`game.ts:1395`); backup card `backup-card.ts` | Documented in `docs/SAVE_CODES.md` |
| Settings | `src/engine/save/settings.ts`: `Settings` 37-129, `SETTINGS_VERSION=3` 240, `defaultSettings` 251, `migrations` 288-301, `merge` 304-314, `loadSettings` 316-368 | `smbc.settings`. **Also holds Classic progression** (`classicCheats`, `classicTutorialsSeen`) |
| Classic options | `src/engine/save/original-options.ts` `ClassicSettings`, `normaliseClassic` 221 | inside `Settings.classic` |
| Progress | `src/engine/save/progress.ts` `Progress` 19-39, `loadProgress` 61-94, `recordBeat`, `recordLostGameBeaten` | `smbc.progress` |
| Classic slot | `src/game/run-resume.ts` `ClassicResume` 38-63, `saveClassicResume` 96, `readSlot` 138-171; written by `Game.keepResume` (`game.ts:2182-2206`), read by `Game.resumeClassic` (`game.ts:2244-2300`) | `smbc-classic-resume-{smb,special,lost}`; legacy `smbc-classic-resume` migrated |
| Other localStorage | `smbc.levels` (custom level library, `.map` text; `src/game/level/library.ts:11`), `smbc.devLast` (dev start; `dev-play.ts:45`) | `smbc-shots` and `smbc-line` are **sprite sheet names**, not storage keys |
| IndexedDB | `src/engine/assets/idb.ts:9` DB `smbc`, store `packs` (asset pack Blobs) | Not exportable in a code |

**Data flow today.**
- **Per-file:** `SaveFile` (localStorage) → `encodeSaveCode` → Base32 → COPY / SHARE / `#save=` link. Then `decodeSaveCode` → CRC → version check → field reads → `migrateSave` → `LoadCodeScene` → `writeSave`.
- **There is no path** that collects `smbc.*` keys into one export, and none that imports one.

---

## 3. Field classification

Classes:
- **ESS**: essential game state.
- **UNL**: global unlock/progression.
- **PREF**: user preference or input mapping (**DEV-P** = per-device by owner rule).
- **DER**: derived or recomputable.
- **DEF**: defaultable.
- **META**: metadata.
- **DEV**: dev-only, should not travel.
- **DSN**: B-L design, not code.

A ⚠ marks a dangerous omission or inclusion.

### 3.1 `smbc.settings` (`Settings`, settings.ts:37-129)

| Field | Class | Evidence / note |
| --- | --- | --- |
| `v` | META (must be written as current) | Omitting it is dangerous ⚠. `loadSettings` treats a missing `v` as v1 (`:319`) and replays v1→v2 (master 0.8→0.4) and v2→v3 (`backupReminders=false`, `:288-301`). |
| `video.*`, `audio.*` | PREF, DEV-P | owner rule; defaults `:254-255` |
| `input.bindings[2]` (keyboard/gamepad × 10 actions, `gamepadIndex`), `touch`, `touchScale`, `dpad`, `keyHints?` | PREF, DEV-P | `fillBindings` `:399-408` restores missing actions; code order inside an action is kept. ≈ 50-150 chars when fully remapped (**M**, unusual scenario: portable vs semantic, 340 vs 183 b64) |
| `assist.*` | PREF (player-ish) | `:263-272`. Proposed to travel. Owner to decide. |
| `packs[]` | PREF, DEV-P | names of IndexedDB packs: meaningless on another device |
| `announce`, `homeScreen?`, `backupReminders` | PREF, DEV-P (device notes) | `:56-76` |
| `dev`, `devUnlock`, `classicDev{yoshiMount, yoshiRide?, heroesOff, heroesOn?}` | **DEV** ⚠ (inclusion) | `enforceDevLock` keeps dev mode when `devUnlock === lock.hash` (`dev-lock.ts:64-70`), so importing them would open dev mode on a release build without the passphrase. `classicDev` is read only in dev mode (`game.ts:848`). |
| `classicRules`, `classicMapDifficulty`, `classic` (11 rows + 11 weapons), `classicSkins?`, `classicHeroesOff?`, `classicTutorials?` | PREF (Classic options) | Read by a resumed run (`original-options.ts:5-7`, `game.ts:2254-2266`). A current-shape Classic slot depends on them (§3.4). |
| `classicTutorialsSeen?` | UNL (minor) | boxes already shown |
| **`classicCheats.unlocked[16]`, `.stats[7]`, `.beaten{3}`, `.continuesUsed`, `.levelSelect`** | **UNL** ⚠⚠ | **The Classic unlock state lives in the *settings* key.** Dropping "settings as device prefs" resets every cheat unlock, the Level Select cheat and the goal counters. `continuesUsed` reset to 0 would also wrongly re-qualify Infinite Lives (`:176-180`). Shared across all Classic files (owner). |
| `classicCheats.on[16]` | PREF (cheat toggles) | |

The loader keeps only keys that the defaults have (`merge` `:304-314`) plus the explicitly copied optional fields (`:341-364`). An importer that writes extra keys loses them silently.

### 3.2 `smbc.progress` (`Progress`, progress.ts:19-39)

| Field | Class | Evidence |
| --- | --- | --- |
| `v` | META | `loadProgress` returns all defaults if `v !== 1` (`:64`) ⚠ |
| `classicBeat{smb,special,lost}` | **UNL** ⚠ | Level Select via `allSetsBeaten` (`game.ts:934`); best status kept (`recordBeat`) |
| `lost.beaten` | **UNL** ⚠ | Lost Levels worlds A-D at ≥ 8 (`:4`, `:91`) |
| `lost.letters` | DER | Recomputed as `beaten >= 8` on load (`:91`). A 0.2.1 file without a count is a special case (`:78-83`). |
| `lost.world9` | UNL (written, not read yet) | Written by `recordLostGameBeaten` (`:105`); no reader on main. Keep: 1 bit. |
| `cleared[]` | DER/legacy | Only read to migrate `'8-4'` → `classicBeat.smb='normal'` (`:55`). Keep it, or apply the migration before encoding. |
| `bestScore`, `lastCharacter`, `reached{}` | META, unused | Only defaulted in `loadProgress` (`:87-89`). No reader in `src`. |

### 3.3 Campaign `SaveFile` (save-files.ts:27-147; per-field code policy `SAVE_CODE_FIELDS` save-code.ts:53-97)

| Field(s) | Class | Evidence / derivation |
| --- | --- | --- |
| `character(2)`, `powerState(2)`, `hp(2)`, `kit(2)`, `lives` (1..99), `coins` (0..99, or 999 with `wallet`) | ESS | `migrateSave` clamps (`:504-516`); `coinCap` (`wallet.ts:36`) |
| `score` | ESS-ish | ⚠ **The existing per-file code drops it** (`SAVE_CODE_FIELDS.score='left-out'`). A full backup should keep it: +3 to +7 chars per file (**M**). |
| `cleared`, `pages`, `secrets`, `position`, `lastNode`, `pendingReveal`, `gameCleared`, `wallet`, `bonusOpen/Guard`, `bonusNext`, `spadeBoard/Taken`, `heroInventory`, `heroItemsNext`, `heroKits` | ESS / UNL | All in the existing code. `1-0` is re-derived when `cleared` is non-empty (`withTutorial :408`, confirmed by a negative control). `bonusGuard` only when `bonusOpen===false` (`:542`). |
| `freed` | **UNL** ⚠ | Not derivable (freeing needs the captive talk). Mario forced first (`freedHeroes :192`). |
| `met`, `tutorials` | UNL | `met` ⊇ `freed` (+`larry` from secret, `:538`); `tutorials` ⊇ current freed heroes (`:533-536`). Only those supersets are derivable. |
| `inventoryUnlocked` | UNL, partly DER | true if the `larry` secret is present (`:540`). Otherwise stored. |
| `story` | UNL | Seeded by `seedSeen` **only when absent** (`beats.ts:110`); a present list is authoritative ⚠ |
| `explained` | UNL (minor) | |
| `v` | META | migrations need it; the code version stands in for it (`CODE_SAVE_FORMAT`) |
| `slot`, `created`, `updated` | META | `updated` only picks the title demo's file (`title-anim.ts:90`). Drop, and restamp on import. |
| `devUnlockAll`, `devAllHeroes`, `devGateOpen`, `devInventory` | DEV | left out by the existing code |
| `inventory`, `itemsNext` | legacy | read-only migration input |

### 3.4 Current Classic slot `ClassicResume` (run-resume.ts:38-63, + PR #193)

| Field | Class | Evidence |
| --- | --- | --- |
| `levelId`, `hero`, `score`, `coins`, `lives` (≥1 or the slot is dropped ⚠ `:143`), `powerState`, `hp`, `kit`, `warped`, `checkpoint{level,x,y?}` (tile coords, `world.ts:3846-3860`), `survival{fallen,reviveAllowed}`, `difficulty?`, `gameMode?` | ESS | `resumeClassic` `game.ts:2244-2300` |
| `world`, `stage` | DER | `keepResume` writes them from `getLevel(levelId)` (`game.ts:2194-2199`). The benchmark encodes them as a K-derived default: 0 bits. |
| `rules` | ESS, but **ignored outside dev mode** | `resumeRules` → `'classic'` (`game.ts:2213`) |
| `heroKits{hero → {powerState,hp,kit}}` | ESS (**PR #193 only**) | Without it, every other hero restarts with the basic kit. Cost: dominant (≈ 7-10 chars per hero, **M**). |
| `savedAt` | META | Only picks the "latest" slot (`:132`). Replace with a 2-bit rank, or restamp. |
| `v` | META | `readSlot` rejects `v !== 1` |

**Cross-slot dependencies:** a resumed Classic run reads the **global** `Settings.classic` (More Settings, weapons, music), `classicCheats.on`, `classicHeroesOff`, `classicSkins`, `classic.expansion`, `classicRules`, and writes `classicMapDifficulty` and `classic.gameMode` back from the slot (`game.ts:2256-2266`). A per-slot code therefore restores the *run*, not the run's rules, unless those settings ride along.

### 3.5 Planned B-L Classic file (**DSN**: design only)

The sample's placeholder shape:
- run state as `ClassicResume`, plus `heroKits` per hero;
- per-file `continues`;
- per-file `rules{difficulty, gameMode, more{7 rows}, weapons, disabled heroes}`.

Under the owner's rule, cheat unlocks and records stay **global**, so they are not in the file. The file's rules are user-controlled, snapshotted per file. Encoded against K defaults they cost 1 bit when untouched and ≈ 10-20 chars when every row changes (**M**, max case).

### 3.6 Outside every export

- `smbc.levels` (custom levels): about 1,580 chars per level even deflated (**M**, 1-1.map). Out of scope; the editor already shares levels.
- IndexedDB asset packs (Blobs).
- `smbc.devLast` (DEV).
- PWA caches.

---

## 4. Recommended encoding spec

### 4.1 Export modes (Q2, Q21)

Recommend **both modes, and they are different products**:
- **A. Per-file code** (type-able, ≤ ~100-200 chars). It has two kinds:
  - campaign: the existing code, unchanged;
  - Classic: new, one map-set slot, or one B-L file once it exists.
- **B. Whole-profile backup.** Paste, link or file; no typing. It carries global unlocks, all files, and optionally the device preferences. It should be offered first as a **downloaded file** (no length limit, robust), and second as a **link/code**.

### 4.2 K: contents and versioning (Q10, Q13)

- **Frozen per-code-version snapshots.** Like `CODE_DICTS`, every code version carries a frozen copy of:
  - the default records (settings, progress, a fresh file, a fresh Classic slot / B-L file);
  - the dictionaries (heroes, Classic roster and skins, campaign and Classic level ids, pages, nodes, secrets, story, explainers, kit keys per hero with usual values, `KeyboardEvent.code` list + `pad:` codes, enum lists from `original-options.ts` / `settings.ts`).

  Never use live `defaultSettings()` as the delta base. A changed default would silently rewrite old codes; `DEFAULT_MASTER` moved 0.8 → 0.4 in 0.4.49 (`settings.ts:247-249`).
- **Pin the snapshots.** Chunked append-only dictionaries plus fingerprints pinned in tests (`dictFingerprints`, `save-code.ts:402`). Escape any unknown id as text, so nothing is lost.
- **Bundle all old decoders forever**, per `docs/RELEASING.md:187` ("must load every save file and settings written by any earlier release"). Cost: a few KB of tables per version (**F**).
- **Decoding order:**
  1. decode to the stored shape *of that code version*;
  2. stamp the record's `v`;
  3. run the store's own migrations and validation: `migrateSave`, the settings migrations + `merge` + normalisers, `loadProgress` rules, `readSlot`.

  Codes and stored files then share one migration path, as campaign codes already do.

### 4.3 E: recommendation (Q19, Q20, Q22)

**Do not use E.** Codes are unencrypted, versioned and CRC-checked. Anyone holding a code can load it, the same as today's campaign codes and `#save=` links.

- **Why not encryption?** Measured on a typical portable profile payload of 131 bytes (Node WebCrypto):

  | Variant | Base64url chars | Base32 chars |
  | --- | --- | --- |
  | Plaintext | 184 | 217 |
  | AES-GCM-128, salt 16 + IV 12 + tag 16 | 237 (**+53**) | 288 (**+71**) |
  | Lean: salt 8, implicit IV (fresh key per salt), 96-bit tag | 205 (**+21**) | 250 (**+33**) |

  PBKDF2-SHA-256 at 600k iterations takes **150 ms** per guess on one Node core. A 4-digit PIN therefore falls in **≤ 0.42 h on one JS core**, and a 6-digit PIN in ≤ 1.7 days. GPUs are orders of magnitude faster (**F**). A low-entropy E gives weak confidentiality, adds 21-71 chars, and turns a forgotten PIN into a lost save.
- **Cheating cannot be prevented.** Client-side crypto cannot stop a player who has the game; the key-derivation code ships in the bundle.
- **No PII.** Name + birthday must not be used: it is personal data, players include kids, and it has low entropy.
- **Personalisation** (E mixed into the CRC) would cost 0 chars. But a wrong E looks exactly like a typo, a 16-bit CRC accepts 1 wrong E in 65,536, and it gives no security. Only worth it for "make casual sharing awkward", which conflicts with SHARE SAVE.
- **If the owner insists later:** an optional "lock this backup" for **mode B only**:
  - PBKDF2 ≥ 600k iterations + AES-GCM, about +21-53 chars;
  - a passphrase of at least 4 random words, never a PIN;
  - clear UI saying that a forgotten passphrase means a lost backup.

### 4.4 H: envelope (Q22)

**Per-file codes** (mode A, typing):
- Crockford Base32, groups of 5, forgiving input (the existing `cleanCode`).
- Layout: `[kind][version EG0][CRC-16 over everything else incl. padding][payload][zero pad]`.
- **Kind:** existing campaign codes (versions 1-3) must keep decoding unchanged. So give Classic codes a distinct *CRC domain* (CRC-16 seeded or prefixed by a kind constant), or one leading kind character. The benchmark used an EG0 kind field (+1-3 bits).
- **Typo check:** CRC-16 caught **all** exhaustive single-character substitutions, adjacent swaps and truncations, plus 5,000 double substitutions and 20,000 random same-length strings (**M**, 105-char Classic code). The existing campaign code also rejected 1,798 of 1,798 single-character substitutions (**M**).
- **Version check:** a valid CRC with an unknown version gives "newer" (**M**).

**Profile codes** (mode B, paste/link/file):
- Format: `P` + base64url(`[version u8][flags u8: deflate, policy][CRC-32 u32][payload]`). Overhead: 9 chars.
- Canonical base64url check: re-encode and compare, which rejects slack bits.
- Deflate only when it is smaller (flag bit).
- Cap the inflated size, as a defence against decompression bombs.
- **M:** 0 of 12,000 corruptions accepted (one char, two chars, swaps, truncations, random strings); version + 1 → "newer".
- Base32 with CRC-32 is the alternative when the code may be read aloud or put in a QR code. Crockford uppercase + `-` is QR alphanumeric-mode compatible. It costs about 17 % more characters.

**Error UX** (extends the `docs/SAVE_CODES.md` table):

| Situation | Behaviour |
| --- | --- |
| Bad CRC or parse error | THAT CODE DOESN'T LOOK RIGHT. No partial load. |
| Valid CRC, newer version | UPDATE THE GAME |
| Older version | Decode with that version's frozen K, then the normal migrations. Silent. |
| Ids this build lacks (escaped text) | Dropped by the stores' own validators, as today (`migrateSave` keeps registered pages only) |
| Unknown future fields | Cannot occur inside a version: a newer version is refused as a whole |
| Profile import | Always a summary + confirm screen (files, unlocks, what will be replaced), since it overwrites several keys. Write all keys or none: stage, then commit. |

---

## 5. Measured comparisons

Lengths are characters, without dashes, envelope and checksum included. Unless noted:
- **Policy "semantic"**: dev fields dropped; timestamps (`created`, `updated`, `savedAt`) dropped; everything else kept.
- **Policy "portable"**: semantic, minus the device preferences (video, audio, input, packs, announce, homeScreen, backupReminders).
- **Policy "exact"**: lossless deep-equal.

Every encoding was **round-tripped and deep-compared** with the policy-applied input. The only normalisation is that sets are compared order-free, the same rule as the existing campaign code (`docs/SAVE_CODES.md` "String set").

For current-shape profiles the decoded data was also written back and **re-read through the game's real loaders** (`loadSettings`, `loadProgress`, `loadSave`, `loadClassicResume`) and compared with the original's loaded state: equal in all scenarios. Negative controls confirmed the comparison detects a dropped level, a changed cheat unlock and an added Classic heroKit.

Totals: **13,442 checks, 0 failures (M)**.

### 5.1 The supplied sample (B-L placeholder shape, as given) (M)

| Encoding | exact | semantic | portable |
| --- | --- | --- | --- |
| Existing `z` (zlib 9, = supplied file) | **2,941** | 2,777 | 2,184 |
| Game's own `encodeShare` (CompressionStream default level) | 2,955 | 2,795 | 2,205 |
| `z` with a K preset dictionary (Node zlib; browsers would need a JS inflater) | 876 | 829 | 815 |
| Binary schema, Base32 / Base64url | 1,161 / 971 | 957 / 801 | 825 / 691 |
| Binary + deflate (Base64url) | 793 | 653 | 536 |
| Delta vs K, Base32 / Base64url | 946 / 792 | 745 / 624 | 743 / 623 |
| **Delta + deflate (Base64url)** | **593** | **472** | **471** |
| Hybrid (delta + game's campaign codec), Base32 / best Base64url | n/a | 787 / 509 | 786 / 503 |

The same sample with its Classic data in **today's shape** (3 `ClassicResume` slots with heroKits, built from each set's file 1): delta Base64url **203**, hybrid **236**, `z` 2,441 (semantic, **M**).

Where the bits go (semantic, delta, **M**):
- each B-L file ≈ 352-372 bits ≈ 60 chars (each current slot 264-282 bits);
- settings 32 bits (2 tweaks);
- progress 61;
- each near-new campaign file 93-105 bits generic, or 156-175 through the campaign codec. For near-new files the generic delta wins.

### 5.2 Named scenarios: best encodings (M)

Current Classic shape (`ClassicResume` + PR #193 heroKits), semantic policy:

| Scenario | `z` (encodeShare) | Delta B32 | Delta best B64 | **Hybrid B32** | **Hybrid best B64** |
| --- | --- | --- | --- | --- | --- |
| Fresh profile | 1,608 | 8 | 11 | 8 | **11** |
| Typical (1 mid file, 1 slot w/ 2 kits, light settings) | 2,501 | 222 | 171 | 137 | **117** |
| Late / end-game (3 files incl. 100%, 3 slots × 8 kits) | 4,339 | 982 | 789 | 618 | **519** |
| Unusual settings + every key rebound | 2,852 | 488 | 405 | 403 | **340** (portable: 183) |
| Max values (all 9,999,999; 15 kits; dev profile) | 4,684 | 2,182 | 1,656 | 1,445 | **1,137** |
| Fully unlocked, 3 × 100% files, runs finished | 3,640 | 1,159 | 919 | 422 | **356** |
| Survival (3 slots, fallen heroes, 6 kits) | 2,871 | 496 | 392 | 411 | **343** |

Planned B-L shape (9 files), semantic: typical **123**, late **929**, Survival **701**, max **1,752**, sample **472-509** (**M**).

### 5.3 Spread over 200 seeded random profiles (min / median / max, M)

Each random profile has:
- one of 4 settings presets;
- random beats;
- 0-3 campaign files (fresh, first castle, mid or 100%, with random score, lives and coins);
- 0-3 Classic runs per set, with 0-9 kits, random rules and Survival.

| Shape / policy | `z` encodeShare | Binary best B64 | Delta best B64 | Hybrid B32 | **Hybrid best B64** |
| --- | --- | --- | --- | --- | --- |
| current / exact | 2,025 / 3,868 / 4,725 | 241 / 684 / 1,240 | 117 / 589 / 1,220 | n/a | n/a |
| current / semantic | 1,952 / 3,723 / 4,584 | 229 / 612 / 1,049 | 91 / 507 / 1,160 | 124 / 417 / 895 | **107 / 351 / 749** |
| current / portable | 1,351 / 3,125 / 3,819 | 119 / 480 / 939 | 91 / 465 / 991 | 118 / 376 / 707 | **101 / 316 / 593** |
| B-L / semantic | 2,024 / 4,148 / 5,144 | 233 / 771 / 1,399 | 107 / 687 / 1,329 | 138 / 629 / 1,299 | **119 / 513 / 1,009** |

### 5.4 Per-slot codes (Base32, CRC-16, M)

**Campaign file:**

| File | Existing code | + score | Naive generic delta |
| --- | --- | --- | --- |
| new | 23 (27 w/ dashes) | 26 | 6 |
| first castle | 36 | 40 | 78 |
| mid-game | 58 | 63 | 154 |
| 100% | 96 (115 w/ dashes) | 103 | 355 |

`docs/SAVE_CODES.md` lists the mid-game file as 61. Today's build measures 58.

**One Classic slot** (semantic; savedAt kept, "exact", adds about 13 chars):

| Case | `ClassicResume` (main, no kits) | + PR #193 heroKits | Planned B-L file |
| --- | --- | --- | --- |
| Start of run (1-1) | 19 | 19 | 19 |
| Mid run, checkpoint, 2 kits | 33 | 50 | 47 |
| Late run, 8 kits, hard | 30 | 94 | 112 |
| Survival, 5 fallen, 6 kits | 21 | 65 | 86 |
| Max: 15 kits, every rule changed | 41 | 188 | 200 |

The sample's own records as per-slot codes (exact): B-L files 88-92; current-shape slots 70-74.

### 5.5 Corruption / fuzz (M)

| Code | Test | Result |
| --- | --- | --- |
| Existing `z` (sample) | 2,000 one-char substitutions | 1,865 rejected, **135 (6.75 %) decoded to valid but different JSON, silently** |
| Existing `z` | 500 truncations | 500 rejected |
| Proposed profile B64 + CRC-32 (821 chars) | 3,000 one-char, 3,000 two-char, 1,000 swaps, 1,000 truncations, 3,000 random | **0 accepted**; version 2 → "newer" |
| Proposed Classic B32 + CRC-16 (105 chars) | exhaustive 3,255 one-char, 96 swaps, 104 truncations; 5,000 two-char; 20,000 random | **0 accepted**; version 2 → "newer"; lower case + spaces + O-for-0 → accepted correctly |
| Existing campaign code (58 chars) | exhaustive 1,798 one-char | 1,798 rejected |

### 5.6 Realistic targets (Q18)

| Target | What fits (M) | What it costs |
| --- | --- | --- |
| **< 100** | One campaign file: 23-96, ≤ 103 with score. One Classic slot without heroKits (19-41) or with ≤ ~4 kits. A fresh profile (11). | Nothing for files. A whole profile only fits while nearly empty. |
| **< 250** | One Classic slot with up to ~15 kits (≤ 200), or a B-L file with every rule changed (200). Typical profiles (101-140). The sample in today's shape (203-236). | For profiles: drop device prefs (portable) and timestamps. Late and 100% profiles do not fit. |
| **< 500** | Most late and 100% profiles in today's shape (356-519; random median 316-351). The sample in B-L shape (471-509). | Portable policy. B-L late profiles (≈ 930) do not fit. With per-file "best of generic/campaign codec" and the inner campaign CRC stripped: about −5 chars per file (**F**). |
| **< 1,000** | All realistic profiles in either shape. Random max: 749 current, 1,009 B-L. | Adversarial max (1,137-1,752) and custom levels do not fit. A file download has no limit. |

---

## 6. Open decisions for the product owner

1. **Export modes.**
   - Do we ship per-file Classic codes (A) and/or a whole-profile backup (B)?
   - For B: file only, file + link, or also a pasteable code?
   - Accept "no length promise" for B? Recommendation: A for Classic once B-L settles; B as file + link.
2. **What travels in B.**
   - Device prefs (video, audio, controls, touch, packs, announce, home-screen notes): recommend **off by default**, with an "include this device's settings" checkbox.
   - Assist options?
   - Key bindings: separately?
3. **Classic per-file code and global state.**
   - Cheat unlocks and records are shared across files (owner). A file code loaded elsewhere therefore plays with the target's unlocks.
   - For the current shape: should the slot code also carry the global Classic options it plays under, at about +5-15 chars (**F**)?
4. **Import semantics for B.**
   - Replace everything, or merge? Possible merge rules: unlocks OR, stats and `continuesUsed` max, `classicBeat` max, `lost.beaten` max, files chosen per slot.
5. **Score in campaign codes.** Currently dropped by design. Keep dropping it, or add it at +3-7 chars (needs a code version bump)?
6. **Timestamps.** OK to restamp `created`, `updated` and `savedAt` at import time, keeping only slot order? Recommend yes.
7. **Dev fields never travel.** `dev`, `devUnlock`, `classicDev`, the `dev*` file flags and `smbc.devLast`. Recommend yes.
8. **E.** Confirm "none". If a lock is wanted: B only, passphrase not PIN, never birthdays.
9. **Out of scope.** Custom levels (`smbc.levels`) and asset packs: separate exports?
10. **B-L schema** must be final before its code is frozen:
    - field names;
    - whether `rules` snapshot every row or only overrides;
    - the bound on `heroKits` (Expansion heroes add more);
    - whether `continues` is per file (sample) and whether `savedAt` is needed.

---

## 7. Incremental implementation and test plan (no code changes made)

1. **Guard-rail tests first** (no user-visible change).
   - Add a `PROFILE_FIELDS` table classifying every field of `Settings`, `Progress` and `ClassicResume`: travels, device, dev or derived. Mirror the existing "SAVE_CODE_FIELDS lists exactly the fields of SaveFile" source-parsing test, so a new field cannot be added unclassified.
   - Split `classicCheats` / `classicTutorialsSeen` conceptually from device prefs in that table. Optionally move them into progress later, with a migration.
2. **Whole-profile backup as a file** (mode B, simplest, no length goal).
   - Envelope `{app, v, crc32, exported, data}`. Allow-listed keys only; dev fields stripped.
   - Import writes each key and then reads it back through the real loaders.
   - Summary + confirm screen. Atomic: stage, then commit.
   - Tests: export → import → loader-level deep-equal (as `bench.ts` `loaderCheck`); corrupt, truncated and newer files.
3. **Classic per-file code** (mode A), after B-L or on `ClassicResume` + heroKits.
   - Reuse `code-bits.ts`. Frozen chunked dictionaries for the Classic roster, skins, levels and kit keys (per hero, with usual values, like `KIT_NUMS`). Derived `world`/`stage`. Kind separation from campaign codes.
   - Hook into `FileCodeScene` / `PasteCodeScene` / `#save=`.
   - Tests mirroring `save-code.test.ts`: round trips, 200 seeded randoms, exhaustive typos, versions, a lengths table in `docs/SAVE_CODES.md`, fingerprints.
4. **Profile link/code.**
   - Hybrid codec: delta vs a **frozen K v1 snapshot**; campaign files through `encodeSaveCode` bits, or the generic delta when shorter; CRC-32; optional deflate via `CompressionStream` (already used by `share.ts`); inflate size cap.
   - `#profile=` link through the existing `codeCandidates` / `LoadCodeScene` patterns.
   - Tests: golden codes per version pinned forever (`docs/RELEASING.md:187`), a K-snapshot fingerprint, the fuzz suite from §5.5, and a "default changed" test (a live default changes, so old codes must still decode to the old value).
5. **Optional, only if decided:** an encrypted lock for B (WebCrypto PBKDF2 + AES-GCM), with explicit loss warnings.

---

## Answers Q1-Q22

1. **Q1. Who builds and imports the export?** No module builds, exports or imports the whole-profile JSON. It was synthetic.
   - The `z` codec is `encodeShare` / `decodeShare` (`src/engine/share.ts:28-50`). It is used only for level sharing (`editor.ts:293`, `main.ts:328`).
   - The real save export is the per-file campaign code: `encodeSaveCode` / `decodeSaveCode` (`save-code.ts:985/1008`), UI in `save-codes.ts`, links via `saveLink` / `linkCode` / `offerSaveLink` (§2).
2. **Q2. Full backup or per-slot?** Only **per-campaign-file** export exists; there is no profile backup, and no Classic export at all.
   - A playable campaign restore needs the code's fields; `migrateSave` rebuilds the rest (`save-files.ts:454-556`).
   - A playable Classic restore needs the slot plus the global Classic options and cheats it plays under (§3.4).
   - Restoring *unlocks* needs `smbc.progress` **and** `smbc.settings.classicCheats`.
3. **Q3. Is there a schema, and what migrations exist?** `app` / `v` / `exported` are invented, with no schema. Real versions:
   - `Settings.v=3` (migrations `settings.ts:288-301`; `merge` + normalisers);
   - `SaveFile.v=4` (`SAVE_MIGRATIONS`);
   - `Progress.v=1` (in-loader fix-ups);
   - `ClassicResume.v=1` (`readSlot` + legacy key migration `run-resume.ts:112`);
   - campaign `CODE_VERSION=3` → `CODE_SAVE_FORMAT`.

   These are governed in code comments, by `docs/SAVE_CODES.md`, and by the rule in `docs/RELEASING.md:15-16,187`.
4. **Q4. What is authoritative?** localStorage is authoritative for all save state; IndexedDB holds only asset packs. Fields recalculated on load:
   - `lost.letters` and `classicBeat` from legacy `cleared`;
   - campaign `1-0`, `met`, `tutorials`, `inventoryUnlocked`, `gameCleared`, `bonusGuard`, and `story` when missing;
   - kit conversion (`campaignKit`);
   - Classic `kit` / `checkpoint` / `survival` sanitised.
5. **Q5. Field inventory.** See the §3 tables.
6. **Q6. Evidence for each omission, and the dangerous ones.** Evidence is cited per row in §3. Dangerous omissions:
   - `classicCheats.*` (in settings);
   - `classicBeat` and `lost.beaten`;
   - `freed`, `story`, `explained`;
   - `v` fields (missing settings `v` replays migrations; wrong progress `v` resets it);
   - Classic `lives` < 1 (the slot is dropped);
   - `heroKits`.

   Dangerous inclusion: `dev`, `devUnlock`.
7. **Q7. Do settings and bindings follow the player?** Video, audio and controls are per-device (owner), so they should not follow by default.
   - A single Classic slot relies on the global Classic options, cheats on/unlocked, hero list and skins, and on the cheat goal stats for unlock progress.
   - A campaign file is self-contained, apart from global settings and assists.
8. **Q8. Domains and limits.**
   - Campaign: `lives` 1-99; `coins` 0-99 (999 with the Wallet); `score` ≥ 0, unbounded integer; `hp` and kit values are finite numbers.
   - Classic: `score`, `coins`, `hp` finite; `lives` ≥ 1; checkpoint x/y tile coordinates (< ~500 / ≤ 15).
   - Cheat stats and `continuesUsed`: unbounded integers ≥ 0.
   - Timestamps: ms epoch (≈ 41 bits).
   - Level, page and hero ids: closed registries plus escapes.
   - Arbitrary strings: pack names, skin map entries, `classicTutorialsSeen`, `heroesOff/On`, kit keys (Classic kit = the hero's `scratch`, `player.ts:32`), `pendingReveal`, the custom-level text.
   - Order: kept for bindings and `packs` (override order); not meaningful for the campaign sets (`docs/SAVE_CODES.md`), `classicHeroesOff` or `survival.fallen`.
9. **Q9. State outside the export.**
   - No saved RNG seed: Single-random picks are reseeded on resume (`game.ts`, `pickRng`).
   - No mid-level world state: Classic resumes at the WORLD card plus checkpoint; campaign at the map.
   - Outside the export: custom levels, asset packs, `smbc.devLast`.
   - No DLC.
10. **Q10. What can K hold?** Safe in K, if frozen per version:
    - all defaults;
    - dictionaries (heroes, roster and skins, levels, pages, nodes, secrets, story, explainers, items, key codes);
    - enum lists;
    - per-hero kit keys with usual values.

    Encode as overrides, bitsets (cheats, beaten), enums (difficulty, rules, Classic rows, power) and sparse maps (heroKits, lastNode).
11. **Q11. What are `heroKits`, `rules` and `more`?**
    - `heroKits` is per-run runtime state (PR #193), independent per hero.
    - B-L `rules` / `more` are user-chosen and snapshotted per file (design). They usually equal the defaults, which makes them nearly free in delta form.
    - The sample's identical copies are an artefact of the script.
12. **Q12. What can be derived?** Derivable:
    - `lost.letters`;
    - `world` / `stage` from `levelId`;
    - campaign `1-0`, and `met` ⊇ `freed` and `tutorials` ⊇ current heroes (supersets only);
    - `inventoryUnlocked` from `larry`;
    - `story` *only when absent*.

    **Not derivable:** `freed`, cheat `unlocked` (code unlocks, persisted flags), the stats, `explained`, `pendingReveal`, `lastNode`, a present `story`, `classicBeat` (best difficulty, not inferable), `continuesUsed`.
13. **Q13. How should K be versioned?** Append-only chunked dictionaries plus frozen default snapshots per code version, with fingerprints pinned in tests. Keep every decoder bundled, and run the store's migrations after decoding (§4.2).
14. **Q14. Does a seed or canonical state already generate the save?** No. Levels are bundled and deterministic, which is why `world` / `stage` are derivable. Nothing else regenerates save state.
15. **Q15. Prototype.** Built under the scratchpad. Results are in §5.1-5.2: the sample goes from 2,941 to 472 (semantic) or 593 (exact) chars; in today's Classic shape, 203.
16. **Q16. Other scenarios.** Seven named scenarios plus 200 seeded random profiles, with min/median/max in §5.3. All numbers are MEASURED except the rows marked F.
17. **Q17. Decode correctness.**
    - Deep equality after the documented policy; set order ignored.
    - Loader-level equality through the real loaders, with negative controls.
    - Corruption, fuzz and version tests (§5.5).
    - B-L records cannot be load-tested: no loader exists.
18. **Q18. Length targets.** See §5.6.
19. **Q19. What should E be for?** Nothing (§4.3). Encryption adds 21-71 chars for little security; personalisation adds nothing useful; never use birthdays.
20. **Q20. Is open loading acceptable?** Recommend yes: anyone with a code can load it. Confidentiality is not required, cheat resistance is out of scope, and codes are meant to be texted and shared, as today's SHARE SAVE already does.
21. **Q21. One code or several?** Both: short per-file codes for typing and sharing, and one whole-profile backup as a file or link for moving devices (§4.1).
22. **Q22. Error handling.** Wrong E: not applicable. Mistyped H, older and newer versions, unknown ids: see the error table in §4.4. Future fields are impossible within a version, and a newer version is refused as a whole.
