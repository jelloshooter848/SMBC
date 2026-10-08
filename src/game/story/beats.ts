import type { MapProgress } from '@game/map/types';
import { CRYSTAL_BALL, heroHint, hiddenHeroes, type HiddenHero } from '@game/map/captives';

/*
 * The Chapter 1 story's beats (docs/STORY.md 1 "Story beat tiers", 2.3, 2.14): which story
 * scenes a save file has already seen. Every routine beat plays once per file; its id goes into
 * SaveFile.story (Game.story / Game.seen / Game.markSeen) when it has played.
 *
 * Beat ids (plain strings, saved on the file, so never rename one):
 * - `enter:<page>`  Toad's world entry on first arrival ('enter:smb-3'), see beat.enter;
 * - `enter:<page>:<hero>` the entry's pages about a hero added later ('enter:smb-8:sophia');
 * - `missed:<hero>` the "missed something" card when that hero's map silhouette first shows;
 * - `joined`        the generic hero-joined card (the first hero freed);
 * - `joined:<hero>` that hero's own joined card;
 * - `all-freed`     every hidden hero freed;
 * - `fakes`         Toad explains the fake Bowsers (after 1-4);
 * - `crash`         the airship crash on World 4 (the crystal ball);
 * - `rift`          Toad works out Peach's note after the 8-4 credits;
 * - `restyle:<level>` Toad's remark on a restyled level's first start ('restyle:2-1');
 * - `bowser-8-4`    Bowser's "no more stand-ins" on first entering 8-4's bridge room;
 * - `hub` / `arena` the first visit to the Warp Zone hub / the Mini Game Arena;
 * - `gate:<page>`   (0.4.23) the world gate out of page `page` broke: Bowser's cutaway and Toad;
 * - `sealed:<page>` (0.4.23) Toad's reminder while that road is sealed ('sealed:smb-8': the rift);
 * - `welcome:<page>` (0.4.23) the local's welcome on the first arrival on page `page` (worlds 2-8);
 * - `remark:<level>` (0.4.23) the hero's remark at castle `level`'s axe ('remark:1-4').
 */

/** What storyOn reads from the game (the Game class satisfies it). */
export interface StoryGame {
  campaign: unknown;
  inRound: boolean;
  stageRound: unknown;
  playtestDone: unknown;
}

/**
 * Whether the campaign's story plays: a save file is being played (`game.campaign`), and this
 * is not a round played for fun (the arena / Dev → Mini games: `inRound`, `stageRound`) nor an
 * editor play-test (`playtestDone`). Everywhere else (classic, dev, ?level=, shared levels) the
 * game keeps its old text and behaviour.
 */
export function storyOn(game: StoryGame): boolean {
  return game.campaign != null && !game.inRound && game.stageRound == null && game.playtestDone == null;
}

/** The beat ids (see the list at the top of this file). */
export const beat = {
  /** Toad's world entry for map page `page` ('smb-1'..'smb-8'). */
  enter: (page: string) => `enter:${page}`,
  /** The part of page `page`'s world entry about hero `hero` (script.ts ENTRY_NEEDS: 'enter:smb-8:sophia'). */
  enterHero: (page: string, hero: string) => `enter:${page}:${hero}`,
  /** The "missed something" card for hero `hero`. */
  missed: (hero: string) => `missed:${hero}`,
  /** The generic hero-joined card (no argument), or hero `hero`'s own joined card. */
  joined: (hero?: string) => (hero === undefined ? 'joined' : `joined:${hero}`),
  /** Toad's remark on restyled level `level` (a main level id, '2-1'). */
  restyle: (level: string) => `restyle:${level}`,
  allFreed: 'all-freed',
  fakes: 'fakes',
  crash: 'crash',
  rift: 'rift',
  bowser84: 'bowser-8-4',
  hub: 'hub',
  arena: 'arena',
  /** The world gate out of page `page` ('smb-1'..'smb-7') broke: Bowser's cutaway, the seal, Toad. */
  gate: (page: string) => `gate:${page}`,
  /** Toad's reminder while page `page`'s road on is sealed ('sealed:smb-8': the rift waits for Sophia III). */
  sealed: (page: string) => `sealed:${page}`,
  /** The local's welcome, the first arrival on page `page` ('smb-2'..'smb-8'). */
  welcome: (page: string) => `welcome:${page}`,
  /** The hero's remark at castle `level`'s axe ('1-4'..'7-4'). */
  remark: (level: string) => `remark:${level}`,
} as const;

/** The hero every file starts with (never a captive). The one definition: save-files imports and re-exports it. */
export const FIRST_HERO = 'mario';

/**
 * The beats that count as already seen on a file loaded without a story list (a save from
 * before 0.4.13, or a test's file): every beat whose trigger already holds on it, so an old file
 * is not flooded with cards about what happened long ago. Pure: reads only its arguments.
 *
 * - `enter:<page>` for every open SMB page ('smb-N'), World 1's only once 1-0 is cleared;
 * - `fakes` once 1-4 is cleared; `restyle:<id>` for every cleared level;
 * - `joined` and `joined:<id>` for every freed hero other than Mario;
 * - `missed:<id>` for every hidden hero whose map silhouette shows (map/captives heroHint);
 * - `crash` with the crystal ball's secret; `all-freed` when every hidden hero is freed;
 * - `rift` and `bowser-8-4` once 8-4 is beaten (gameCleared, or 8-4 cleared);
 * - `hub` / `arena` when those pages are open;
 * - (0.4.23) `gate:<page>` and `sealed:<page>` for every SMB page whose road on has led somewhere
 *   already (the next page open), `welcome:<page>` for every open page of worlds 2-8, and
 *   `remark:<id>` for every castle cleared.
 */
export function seedSeen(
  progress: MapProgress,
  freed: readonly string[],
  heroes: readonly HiddenHero[] = hiddenHeroes(),
): string[] {
  const out: string[] = [];
  const cleared = progress.cleared;
  for (const page of progress.pages)
    if (/^smb-\d+$/.test(page) && (page !== 'smb-1' || cleared.includes('1-0'))) out.push(beat.enter(page));
  if (cleared.includes('1-4')) out.push(beat.fakes);
  const joined = freed.filter((id) => id !== FIRST_HERO);
  if (joined.length) out.push(beat.joined(), ...joined.map((id) => beat.joined(id)));
  for (const h of heroes) if (heroHint(h, progress, freed) === 'silhouette') out.push(beat.missed(h.hero));
  if (progress.secrets.includes(CRYSTAL_BALL)) out.push(beat.crash);
  if (heroes.length && heroes.every((h) => freed.includes(h.hero))) out.push(beat.allFreed);
  if (progress.gameCleared === true || cleared.includes('8-4')) out.push(beat.rift, beat.bowser84);
  for (const id of cleared) out.push(beat.restyle(id));
  if (progress.pages.includes('hub')) out.push(beat.hub);
  if (progress.pages.includes('arena')) out.push(beat.arena);
  out.push(...seedSeenS3(progress));
  return [...new Set(out)];
}

/** S3's part of seedSeen (0.4.23): the gates, the welcomes and the castle remarks already past. */
export function seedSeenS3(progress: MapProgress): string[] {
  const out: string[] = [];
  const open = progress.pages;
  for (let n = 1; n <= 8; n++) {
    const page = `smb-${n}`;
    const next = n < 8 ? `smb-${n + 1}` : 'll-1';
    if (open.includes(next)) out.push(beat.gate(page), beat.sealed(page));
    if (n >= 2 && open.includes(page)) out.push(beat.welcome(page));
    if (n <= 7 && progress.cleared.includes(`${n}-4`)) out.push(beat.remark(`${n}-4`));
  }
  return out;
}
