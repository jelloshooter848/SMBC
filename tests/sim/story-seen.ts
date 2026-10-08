import { beat, STORY_REV } from '@game/story/beats';

/*
 * Every Chapter 1 story beat id (story/beats.ts), for tests about something else: a file with
 * these seen plays none of Toad's map scenes (map/toad-guide.ts) nor the level scenes (the
 * opening, Luigi running off in 1-1, ...), so the map goes straight on to its reveal as before
 * the story. Marked STORY_REV, so loading the file adds nothing (beats.ts upgradeStory).
 */

export const ALL_STORY: readonly string[] = [
  STORY_REV,
  beat.opening,
  beat.spell,
  ...['smb-1', 'smb-2', 'smb-3', 'smb-4', 'smb-5', 'smb-6', 'smb-7', 'smb-8'].map((p) => beat.enter(p)),
  beat.luigiRuns,
  beat.fakes,
  beat.crash,
  beat.rift,
  beat.bowser84,
  beat.hub,
  beat.arena,
];

/** Marks every story beat seen on the open file (saved the next time the game saves). */
export function seeAllStory(game: { story: string[] }): void {
  game.story = [...new Set([...game.story, ...ALL_STORY])];
}
