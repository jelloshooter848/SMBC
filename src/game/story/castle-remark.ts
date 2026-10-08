import type { Game } from '@game/scenes/game';
import type { CharacterDef } from '@game/characters/character';
import type { World } from '@game/world/world';
import { fontText } from '@game/hud/text';
import { beat, storyOn } from './beats';
import { playStoryCards } from './cards';
import { castleRemark } from './script';

/*
 * The hero's remark at a fake Bowser's axe (docs/STORY.md 2.3a item 3, 0.4.23): when the
 * disguise bursts at the axe, the hero looks at the creature and says the castle's line, in the
 * story box over the frozen level. The first time per castle per file (`beat.remark(level)`);
 * after that the hero just looks a moment (world/unmask.ts). LevelScene hands this to
 * World.remarkHook in the campaign.
 */

/**
 * Plays castle `level`'s remark spoken by `hero` if it is due (campaign story, not seen on this
 * file): marks it seen, shows the card and calls `done` when it closes (OK, or BACK). Returns
 * false when nothing is due (`done` is not called).
 */
export function playCastleRemark(
  game: Game,
  world: World,
  level: string,
  hero: CharacterDef,
  done: () => void,
): boolean {
  if (!storyOn(game) || game.seen(beat.remark(level))) return false;
  const page = castleRemark(level, fontText(hero.name).toUpperCase());
  if (!page) return false;
  game.markSeen(beat.remark(level));
  playStoryCards(game, world, [page], done);
  return true;
}
