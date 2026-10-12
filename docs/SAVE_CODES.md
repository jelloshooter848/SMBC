# Save codes

A campaign save file packed into a short code (0.4.44, roadmap #36): **the code is the save**.
There is no server and no account. A code travels as text, or as a resume link
`<site>/#save=<code>`. The player's side is in the README ("Save codes and resume links"). This
page is the format, for anyone who changes `SaveFile`.

- Codec: `src/game/save/save-code.ts`. Bits, Base32 and CRC: `src/game/save/code-bits.ts`.
- Share sheet and clipboard: `src/game/save/share-code.ts`.
- Menus, the paste box and the LOAD THIS SAVE? question: `src/game/scenes/save-codes.ts`,
  `code-entry.ts`. The after-castle card: `backup-card.ts`.
- Tests: `src/game/save/save-code.test.ts` (format) and `tests/sim/save-codes.test.ts` (flows).

## What a code looks like

`V3Q8E-C4EXT-25AAB-C38J2-A39R9-JN5SA-SSBV5-TSY`

- **Alphabet:** Crockford Base32 (`0-9 A-Z` without I, L, O and U), 5 bits per character.
- **Groups:** five characters, joined by dashes. The last group may be shorter.
- **Forgiving input:** case doesn't matter, and dashes and white space anywhere are ignored. O
  reads as 0, and I and L read as 1.
- **Pasted text:** `codeCandidates` finds a code inside a message. It tries these, in order:
  1. the part after `#save=` in a link;
  2. single words that could be a code, longest first;
  3. runs of neighbouring words joined together (a code typed with spaces), longest first.

  The first candidate whose CRC and layout check out is used.

Real lengths (characters without dashes, from the test `code lengths`):

| File                                                                           | Characters | With dashes |
| ------------------------------------------------------------------------------ | ---------- | ----------- |
| New file                                                                       | 22         | 26          |
| Right after 1-4 (World 2, 2 heroes, one item)                                  | 35         | 41          |
| Mid-game (World 4, 4 heroes, 2 kits, items)                                    | 60         | 71          |
| 100% (every level, all 9 heroes with every item, inventories, all story beats) | 95         | 113         |

## Layout

```
[version: Exp-Golomb 0 of (version - 1)] [CRC-16: 16 bits] [fields of that version …] [0-4 zero bits]
```

- **Version** (`CODE_VERSION`, 1 today). Version 1 is the single bit `1`, and version 2 is `010`.
- **CRC-16/CCITT** (polynomial 0x1021, start 0xFFFF), over the version bits and **every bit after
  the CRC**, padding included.
  - Any build can check any code's CRC, even a code from a newer version it can't read. So a typo
    is always "doesn't look right", never "newer version".
  - It catches every change within 16 bits in a row: any one wrong character, and two neighbours
    swapped. It also catches any odd number of wrong bits. Anything else gets through once in
    65,536.
- **Padding:** zero bits up to a whole character. After decoding, fewer than 5 bits may be left,
  and they must all be 0.

Decoding (`decodeSaveCode`) goes in this order:

1. clean the text;
2. check the CRC (a mismatch is a typo);
3. check the version: one above `CODE_VERSION` is _newer_;
4. read the fields the code's version has (`since <= version`), which gives a save file of that
   version's save format (`CODE_SAVE_FORMAT`, version 1 → `SaveFile.v` 4);
5. run `migrateSave` with the save migrations, like any stored file.

So an old code loads into a newer game through the same migrations as an old file, and new fields
get their defaults. A parse error, leftover bits, or a file `migrateSave` rejects is a typo.

| Error                                 | Message                                                       |
| ------------------------------------- | ------------------------------------------------------------- |
| CRC, parse or validation              | THAT CODE DOESN'T LOOK RIGHT                                  |
| Valid CRC, version above this build's | THIS CODE IS FROM A NEWER VERSION. UPDATE THE GAME TO LOAD IT |
| Nothing typed                         | PASTE OR TYPE A SAVE CODE                                     |

## Building blocks

- **EG(k):** Exp-Golomb code of order k for whole numbers ≥ 0. EG(0): 0 takes 1 bit, 1-2 take 3
  bits, and 3-6 take 5 bits. EG(2): 0-3 take 3 bits, and 4-11 take 5 bits.
- **String:** EG(2) length, then 6 bits per character from `abcdefghijklmnopqrstuvwxyz0123456789-:_.>`.
  Index 63 is followed by a 16-bit UTF-16 unit for any other character.
- **Number** (optionally with a _usual_ value):
  - `0` means the usual value;
  - otherwise `1`, then either `0` + EG(2) for a whole number from 0 to 2^40, or `1` + the
    number's text for anything else (negative, fractional, -0).
- **Symbol of a dictionary:** a fixed-width index. The index equal to the dictionary's size is the
  escape, followed by a string.
- **Pick from a short list:** EG(0) of the index, so the first entries are cheapest. The index
  equal to the list's length is the escape, followed by a string.
- **Index set:** one bit picks the cheaper encoding:
  - `0` + runs: EG(0) count, then for each run, EG(0) gap and EG(0) length - 1;
  - `1` + a bitmap with one bit per entry.
- **String set:** an index set over a dictionary, then EG(0) count and strings for the ids it
  doesn't know. Nothing is lost, but set order isn't kept. The decoded list is in dictionary
  order, then the unknown ids; nothing in the game reads these lists' order.

## Version 1 fields (in order)

| #   | Fields                                                                  | Encoding                                                                                                                                                            |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `character`, `powerState`, `hp`, `kit`                                  | hero symbol; _power_ (below)                                                                                                                                        |
| 2   | `character2`, `powerState2`, `hp2`, `kit2`                              | bit "has a player 2", hero symbol; _power_ (always written: a one-player file keeps its defaults)                                                                   |
| 3   | `lives`, `coins`                                                        | EG(2), EG(4)                                                                                                                                                        |
| 4   | `wallet`, `gameCleared`, `inventoryUnlocked`, `bonusOpen`, `bonusGuard` | 5 bits                                                                                                                                                              |
| 5   | `pages`, `cleared`, `secrets`                                           | string sets over PAGES, LEVELS, SECRETS                                                                                                                             |
| 6   | `position`                                                              | page symbol; node pick from the page's node list                                                                                                                    |
| 7   | `lastNode`                                                              | for each open page (in decoded order): pick from [castle, _none_, start, other levels, bonus]                                                                       |
| 8   | `pendingReveal`                                                         | EG(0) count; each: bit "structured", page symbol, bit "road", node pick (a road: from-node pick, then to-node-or-page pick); else a string                          |
| 9   | `freed`, `tutorials`, `met`                                             | string sets over HEROES, HEROES, MET                                                                                                                                |
| 10  | `story`                                                                 | bit "has a list" (a file without one is seeded on load), string set over STORY                                                                                      |
| 11  | `heroKits`                                                              | string set of heroes over HEROES, then each one's _power_                                                                                                           |
| 12  | `heroInventory`, `heroItemsNext`                                        | string set of heroes; for each, EG(0) count, a bit "all known", then 2-bit item indices (or symbols); then a string set of heroes, each with a string set over NEXT |
| 13  | `bonusNext`, `spadeBoard`, `spadeTaken`                                 | EG(0), EG(0), EG(0) count + EG(0) gaps between sorted indices                                                                                                       |

**Power** (a hero's power state, kit and hit points):

- **Power state:** a pick from the hero's list. Hit-point heroes use `full, small, big, fire`. The
  others use `fire, big, small, full`. An unknown hero uses `small, big, fire, full`.
- **Kit:**
  - an index set of the **flags** whose value is 1: `found` and `has-<item>` for each of the
    hero's items, from `KIT_FLAGS`;
  - an index set of the hero's **number keys** (`KIT_NUMS`: meters, ammo, tiers, the selected
    tool), then each value as a _number_ with that key's usual value;
  - EG(0) count of any other keys, each as a string and a _number_.
- **Hit points:** a _number_. The usual value is the kit's `maxHp`, otherwise the hero's starting
  full health (`FULL_HP`), otherwise 0.

Ammo and meters are kept exactly. Nothing is refilled on load.

### Left out

`SAVE_CODE_FIELDS` lists every `SaveFile` field and how the code treats it.

- **Left out:**
  - `score`: a loaded file has 0;
  - `created` and `updated`: now;
  - `slot`: the file it is loaded into;
  - `v`: the code version stands for it;
  - the developer flags `devUnlockAll`, `devAllHeroes`, `devGateOpen` and `devInventory`: off.
- **Legacy:** `inventory` and `itemsNext` are only read from files older than 0.4.33, never written.

The test **"SAVE_CODE_FIELDS lists exactly the fields of SaveFile"** parses `SaveFile` and
`MapProgress` from the source. It fails when a field is added to either without being listed,
and the mapped type makes `tsc` fail too.

## Dictionaries

The dictionaries are snapshots of the game's registries, frozen per code version.

| Dictionary          | Contents                                                                            |
| ------------------- | ----------------------------------------------------------------------------------- |
| HEROES              | the 9 heroes, in registry order                                                     |
| MET                 | HEROES + `larry`                                                                    |
| PAGES               | `smb-1`…`8`, `hub`, `ll-1`…`13`, `arena`                                            |
| LEVELS              | `1-0`, `1-1`…`8-4`, `2-top-secret`, `ll-1-1`…`ll-13-4`                              |
| SECRETS             | the bonus keys, `kakariko`, `larry`                                                 |
| STORY               | Chapter 1's beats in the order a file meets them, then the beats older builds wrote |
| ITEMS, NEXT         | the inventory items and held items                                                  |
| KIT_FLAGS, KIT_NUMS | per hero (see above)                                                                |

Each dictionary is a list of **chunks**, one per code version. Chunk 0 holds version 1's ids, and
version _v_ decodes with the first _v_ chunks. A shipped chunk never changes: `dictFingerprints()`
is pinned by a test. Why frozen rather than read live from the registries: a registry that gains,
loses or reorders an id would silently change what every shared code means. Frozen chunks keep
old codes exact. Tests keep the dictionaries in step with the game: every hero, page, level,
secret, item flag and Chapter 1 beat of this build must be in its dictionary. Until it is, the id
still goes through the escape, so nothing is ever lost, only a few characters.

## Changing the format (version N+1)

1. Bump `CODE_VERSION` and add `N+1: <save format>` to `CODE_SAVE_FORMAT`.
2. **New `SaveFile` field:**
   - list it in `SAVE_CODE_FIELDS`;
   - append a `FieldCodec` to `FIELDS` with `since: N+1`.

   Older codes skip it, and the save migration gives it its default.

3. **New ids** (a hero, a world, a beat, an item): add a chunk to the dictionary (or to the hero's
   `KIT_FLAGS` / `KIT_NUMS`), then update the fingerprints in the test.
4. Never change an existing field's encoding or a shipped chunk. Changing the bits of version
   1..N means writing a new field (`since: N+1`) and leaving the old one to older versions:
   `FieldCodec.read` gets the code's version.
5. Re-run `save-code.test.ts` (round trips, 200 seeded random files, typos, coverage) and update
   the lengths table here.

## Resume links and UI

- **SHARE SAVE** calls `navigator.share({ title, text })`. The text is one line: "My SMBC REMIX
  save (World n, k heroes): <link>". Some share targets drop a separate `url`, so the link is in
  the text.
  - No share sheet (most desktops): the link is copied, and the screen says NO SHARE SHEET: LINK
    COPIED.
  - The sheet closed: SHARE CANCELLED.
- **COPY CODE** uses the Clipboard API, then falls back to `execCommand('copy')`.
- **PASTE CODE** reads the clipboard at once when the browser allows it, and a code found there
  goes straight to the question. Otherwise the DOM text box takes it:
  - type into it, or long-press and Paste;
  - Enter or LOAD submits, Escape or CANCEL closes;
  - its key presses never reach the game;
  - on a phone held sideways it fits above the on-screen keyboard.

  PASTE CODE is offered from the title only (not over a running game), so the file being played
  is never replaced under it.

- **`#save=` link:** `main.ts` hands the code to `Game.saveLink`. Once the title is ready,
  `Game.offerSaveLink` asks LOAD THIS SAVE? and which file, showing each file's summary. YES or NO
  follows, with NO highlighted and the file it replaces named.
  - After it is answered (loaded, cancelled or an error), `history.replaceState` drops the hash,
    so a reload doesn't ask again.
  - A file loaded opens the file select on it.
- **The backup card:**
  - `Game.recordClear` notes a castle's (`X-4`, SMB or Lost Kingdom) **first** clear on a
    campaign file.
  - The card opens once the map is idle (`Game.offerBackup`), while
    `Settings.backupReminders` is on.
  - A castle that was cleared before never asks again.
  - A game without settings (the headless sims) never shows it.
