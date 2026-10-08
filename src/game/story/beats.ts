import type { MapProgress } from '@game/map/types';
import { CRYSTAL_BALL } from '@game/map/captives';

/*
 * The Chapter 1 story's beats (docs/STORY.md 1 "Story beat tiers", 2.3, 2.14): which story
 * scenes a save file has already seen. Every routine beat plays once per file; its id goes into
 * SaveFile.story (Game.story / Game.seen / Game.markSeen) when it has played.
 *
 * Beat ids (plain strings, saved on the file, so never rename one):
 * - `opening`       the new file's opening: Peach's castle and her note (2.1);
 * - `spell`         Bowser's spell at the end of 1-0 has played on this file (2.2; it replays
 *                   with 1-0, the id only says whether Pause → Skip tutorial must still show it);
 * - `enter:<page>`  first arrival on a map page ('enter:smb-1': Toad's World 1 scene, 2.4);
 * - `luigi-runs`    1-1: brainwashed Luigi runs off (2.4);
 * - `fakes`         Toad explains the fake Bowsers (after 1-4);
 * - `crash`         the airship crash on World 4 (the crystal ball);
 * - `rift`          Toad works out Peach's note after the 8-4 credits;
 * - `bowser-8-4`    Bowser's "no more stand-ins" on first entering 8-4's bridge room;
 * - `hub` / `arena` the first visit to the Warp Zone hub / the Mini Game Arena.
 *
 * Gone in 0.4.23 (docs/STORY.md 2.14; old files may still list them, nothing reads them):
 * `enter:<page>:<hero>`, `missed:<hero>`, `joined`, `joined:<hero>`, `all-freed`, `restyle:<level>`.
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
  /** The first arrival on map page `page` ('smb-1'..'smb-8'). */
  enter: (page: string) => `enter:${page}`,
  opening: 'opening',
  spell: 'spell',
  luigiRuns: 'luigi-runs',
  fakes: 'fakes',
  crash: 'crash',
  rift: 'rift',
  bowser84: 'bowser-8-4',
  hub: 'hub',
  arena: 'arena',
} as const;

/** The hero every file starts with (never a captive). The one definition: save-files imports and re-exports it. */
export const FIRST_HERO = 'mario';

/**
 * The beats that count as already seen on a file loaded without a story list (a save from
 * before 0.4.13, or a test's file): every beat whose trigger already holds on it, so an old file
 * is not flooded with cards about what happened long ago. Pure: reads only its arguments.
 *
 * - the 0.4.23 beats as seedNew gives them;
 * - `enter:<page>` for every open SMB page ('smb-N'), World 1's only once 1-0 is cleared;
 * - `fakes` once 1-4 is cleared; `crash` with the crystal ball's secret;
 * - `rift` and `bowser-8-4` once 8-4 is beaten (gameCleared, or 8-4 cleared);
 * - `hub` / `arena` when those pages are open.
 */
export function seedSeen(progress: MapProgress, freed: readonly string[]): string[] {
  const out: string[] = seedNew(progress, freed);
  const cleared = progress.cleared;
  for (const page of progress.pages)
    if (/^smb-\d+$/.test(page) && (page !== 'smb-1' || cleared.includes('1-0'))) out.push(beat.enter(page));
  if (cleared.includes('1-4')) out.push(beat.fakes);
  if (progress.secrets.includes(CRYSTAL_BALL)) out.push(beat.crash);
  if (progress.gameCleared === true || cleared.includes('8-4')) out.push(beat.rift, beat.bowser84);
  if (progress.pages.includes('hub')) out.push(beat.hub);
  if (progress.pages.includes('arena')) out.push(beat.arena);
  return [...new Set(out)];
}

/**
 * The beats new in 0.4.23 whose trigger already holds on a file (docs/STORY.md open question 8):
 * what a story list from an older build is given once (upgradeStory). Every new beat says here
 * when it is past. Pure.
 *
 * - `opening` and `spell` once the file has cleared anything (1-0 first of all);
 * - `luigi-runs` once 1-1 is cleared or Luigi is freed.
 *
 * Every other 0.4.23 beat (the freeing talks, the gates, the welcomes, the castle remarks) adds its
 * own rule here too, so an older file's list is brought up to date with it.
 */
export function seedNew(progress: MapProgress, freed: readonly string[]): string[] {
  const out: string[] = [];
  const cleared = progress.cleared;
  if (cleared.length) out.push(beat.opening, beat.spell);
  if (cleared.includes('1-1') || freed.includes('luigi')) out.push(beat.luigiRuns);
  return out;
}

/**
 * Marks a story list as made for the 0.4.23 Chapter 1 (docs/STORY.md "What changed from v0.4.21"):
 * a list without it is from an older build, which tracked the older beats but not the new ones.
 */
export const STORY_REV = 'story:0.4.23';

/**
 * A file's story list as loaded (Game.openFile; `story` undefined: none saved), brought up to
 * 0.4.23 once: a file without a list gets seedSeen; a list from an older build keeps what it has
 * and gets the new beats already past (seedNew), so an older file never replays the opening or
 * a new scene about what it did long ago. Either is then marked STORY_REV; a marked list is
 * returned as it is. Pure.
 */
export function upgradeStory(
  story: readonly string[] | undefined,
  progress: MapProgress,
  freed: readonly string[],
): string[] {
  if (story?.includes(STORY_REV)) return [...story];
  const add = story ? seedNew(progress, freed) : seedSeen(progress, freed);
  return [...new Set([...(story ?? []), ...add, STORY_REV])];
}
