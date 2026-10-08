import type { Game } from '@game/scenes/game';
import { CardScene } from '@game/scenes/message';
import { abilityHint } from '@game/scenes/hints';
import type { World } from '@game/world/world';
import type { Page } from './script';

/**
 * What the announcer says for a story page: its lines (blank ones left out), then what to press,
 * "OK to continue." on the last page, else "OK for more, BACK to skip." (every story box: cards,
 * Toad's map box, 1-0's tease).
 */
export function pageSaid(page: readonly string[], last: boolean): string {
  const text = page.filter((l) => l !== '').join(' ');
  return `${text} ${last ? 'OK to continue.' : 'OK for more, BACK to skip.'}`;
}

export interface StoryCardOptions {
  /** The box at the bottom of the screen instead of the top (the default, under the HUD). */
  bottom?: boolean;
  /** Runs when page `i` is closed with OK (not when BACK skips the rest), before what follows. */
  onNext?: (i: number) => void;
}

/**
 * Plays a story scene's `pages` one after another (docs/STORY.md 1 "Story beat tiers"), each in a
 * CardScene box pushed over the frozen scene beneath: over `world`'s level, or with `world` null
 * over whatever scene is on top (the world map). The box is at the top by default, with the OK
 * prompt; each page is read out by the announcer. OK (jump) or MENU (start) goes on to the next
 * page; BACK (attack) closes the rest of the scene. A page never turns by itself. When the last page is closed, or the scene
 * is skipped, the card is popped and `done` runs. No pages: `done` runs at once.
 */
export function playStoryCards(
  game: Game,
  world: World | null,
  pages: readonly Page[],
  done: () => void,
  opts: StoryCardOptions = {},
): void {
  const show = (i: number): void => {
    const page = pages[i];
    if (!page) {
      done();
      return;
    }
    const last = i === pages.length - 1;
    const close = () => {
      game.scenes.pop();
      done();
    };
    game.deps.announcer?.say(pageSaid(page, last));
    game.scenes.push(
      new CardScene(
        game,
        page,
        () => {
          game.scenes.pop();
          opts.onNext?.(i);
          if (last) done();
          else show(i + 1);
        },
        world,
        {
          panel: true,
          overlay: true,
          top: opts.bottom !== true,
          keys: ['jump', 'start'],
          skipKeys: ['attack'],
          onSkip: close,
          prompt: () => abilityHint(game, 'OK', 'jump'),
        },
      ),
    );
  };
  show(0);
}
