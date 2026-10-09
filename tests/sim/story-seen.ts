import { beat, STORY_REV } from '@game/story/beats';
import { OpeningScene } from '@game/story/opening';
import { CARD_GUARD_FRAMES } from '@game/scenes/message';

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
  beat.anchor42,
  beat.hub,
  beat.arena,
  // S3 (0.4.23): the world gates, their reminders, the welcomes and the castle remarks.
  ...[1, 2, 3, 4, 5, 6, 7, 8].flatMap((n) => [
    beat.gate(`smb-${n}`),
    beat.sealed(`smb-${n}`),
    beat.welcome(`smb-${n}`),
  ]),
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => beat.remark(`${n}-4`)),
];

/** Marks every story beat seen on the open file (saved the next time the game saves). */
export function seeAllStory(game: { story: string[] }): void {
  game.story = [...new Set([...game.story, ...ALL_STORY])];
}

/**
 * A new file plays the story's opening (story/opening.ts, docs/STORY.md 2.1) before its map:
 * BACK skips it and the map shows, for tests about something else. Does nothing without one.
 */
export function skipOpening(h: {
  game: { scenes: { top: unknown } };
  idle(n: number): void;
  tap(a: 'attack'): void;
}): void {
  if (!(h.game.scenes.top instanceof OpeningScene)) return;
  h.idle(CARD_GUARD_FRAMES + 1);
  h.tap('attack');
  for (let i = 0; i < 300 && h.game.scenes.top instanceof OpeningScene; i++) h.idle(1);
}
