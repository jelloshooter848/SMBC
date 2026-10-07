import { beat } from '@game/story/beats';
import { MISSED_PAGES, RESTYLE_PAGES, WORLD_ENTRY } from '@game/story/script';
import { CHARACTERS } from '@game/characters/registry';

/*
 * Every Chapter 1 story beat id (story/beats.ts), for tests about something else: a file with
 * these seen plays none of Toad's map scenes (map/toad-guide.ts) nor the level remarks, so the
 * map goes straight on to its reveal as before the story.
 */
const heroes = [...new Set([...Object.keys(MISSED_PAGES), ...CHARACTERS.map((c) => c.id)])];

export const ALL_STORY: readonly string[] = [
  ...Object.keys(WORLD_ENTRY).map((p) => beat.enter(p)),
  beat.enterHero('smb-8', 'sophia'),
  ...heroes.map((id) => beat.missed(id)),
  beat.joined(),
  ...heroes.map((id) => beat.joined(id)),
  ...Object.keys(RESTYLE_PAGES).map((id) => beat.restyle(id)),
  beat.allFreed,
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
