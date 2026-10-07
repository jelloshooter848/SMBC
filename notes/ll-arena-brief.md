# 0.4.7 batch A: Lost Levels as the story's extension + the Mini Game Arena — shared brief
Conventions: /tmp/claude-0/-home-user-SMBC/ed1be232-9526-5dbb-b2cc-de87896d1401/scratchpad/tutorial-brief.md
(setup, ports, checks, trailers, never commit node_modules, no CHANGELOG edits, ability names not letters,
announcer, reduce flashing, failing tests first). Base: `git merge claude/admiring-galileo-quy3ri` (a7f193a = v0.4.6).
Docs: docs/WORLD_MAP.md (pages, hub, warp pads, Lost Levels progression, secret exits, reveals), docs/HEROES.md
(captives, mini games, MINIGAMES registry, Dev → Mini games, tutorials/training), docs/BONUS.md.

## Owner decisions
1. LOST LEVELS = THE STORY'S EXTENSION (campaign). SMB 8-4 (after its ending/credits) opens a ROAD on the World 8
   map walking toward Lost World 1 (a world exit smb-8 → ll-1). Then the Lost worlds are played IN ORDER:
   ll-1 … ll-8, then 9, A, B, C, D (ll-9 … ll-13) through D-4, each castle opening the next world's exit. The old NES
   unlock rules in the campaign (World 9 only if warpless, A–D after the game is cleared, the hub's "beat 8-4" pad)
   go away; D-4 is the final ending. Lost Levels' own WARP ZONES KEEP their NES behaviour for now (owner: "keep NES
   warps until we come up with something else, like we've been doing with SMB1"). Non-campaign play unchanged.
   Old saves must load cleanly: any Lost progress kept; a file that already beat 8-4 gets the new road (derive it,
   no format bump if possible).
2. WARP ZONE HUB: the first pad (today Lost Levels, locked until 8-4) becomes the MINI GAME ARENA pad, open as soon
   as the hub itself is reachable (nothing else needed). The other three pads stay "???" locked. Lost World 1's
   link back to the hub goes away (Lost World 1 now connects back to World 8 by the road instead).
3. THE ARENA = its own world-map PAGE (`arena`), reached from that pad, with a "Return" pad back to the hub. A
   stadium-like look (new map art). One pad/node per game, walk to it and press JUMP to play, "for fun":
   - every hero MINI GAME (MINIGAMES registry: Luigi's Mirror Race, Link's Shadow Keep, Mega Man's Station Escape,
     Samus's Zebes Escape, and any added later e.g. Simon's) — shown only once the file has MET that hero (talked
     to the captive at least once, or freed); unmet ones show as a dark "???" silhouette pad that can't be played;
   - the TUTORIALS: Mario's 1-0 stage (once cleared/skipped on the file) and each hero's training room (once that
     hero's training was offered/played on the file, i.e. in `tutorials`, or the hero is freed);
   - also Larry's airship (once the file has reached it) and the SMB3 bonus games (once the bonus spot exists) —
     good fun extras, same "found" rule.
   Playing in the arena NEVER changes progress: no freeing, no prizes, no items, no lives, nothing saved except
   that the arena remembers nothing (or at most a best-result line per game — optional, say if you add it).
   After a round: a result card (PASS/FAIL/QUIT, like Dev → Mini games) and back on the arena map at that pad.
   Reuse Dev → Mini games' runner (src/game/scenes/dev-minigames.ts) where possible.
   Save field for "met" heroes: `met?: string[]` (set when a captive is talked to; freed heroes count as met; old
   saves derive from `freed`). Optional field, no format bump.

## Names / ownership
- W1 (Lost Levels extension): rules.ts/campaign progression, smb-8 → ll-1 world exit, ll-N exits through ll-13,
  ending flow (game.ts showEnding / Lost ending), ll-1's hub link removal (lost/world1.ts), old-save derivation,
  tests + docs. W1 does NOT edit the hub page file.
- W2 (Arena code): the hub page's first pad → `arena` warp (owns the hub page file), the `arena` page data (nodes,
  paths, pads, actors), the arena scene behaviour (node per game, found rule, ??? pads, result card, no saves),
  `met` save field, tests + docs.
- W3 (Arena art): map tiles/icons for the arena page: theme `arena` map palette + tiles (stadium floor, stands,
  banners/flags, light poles), one pad icon style per game kind (mini game pad with the hero's face? or a generic
  pad + hero mini-portrait drawn by code from existing hero sprites), a "???" pad, a tutorial pad, plus an arena
  music track `arena` (upbeat, original). Map art lives in src/content/sprites/map*.ts (check the hub's art for the
  pattern) — W3 says the exact frame names in its report; W2 uses rect/placeholder fallbacks until merged.
