import type { Game } from '../scenes/game';
import { CardScene } from '../scenes/message';
import { abilityHint } from '../scenes/hints';
import { fontText } from '../hud/text';
import type { World } from '../world/world';
import type { MenuItem } from '../scenes/menu';

/*
 * The pause menu's LAST TIPS (0.4.43, owner): the last three tips a tutorial or a training stage
 * showed (tips.ts, Game.tips), the newest first, in a box over the paused level, read out again.
 * It waits for OK, then the menu is back.
 */

/** The card's lines: a title, then each tip's lines, a blank row between tips. */
export function lastTipsLines(game: Game): string[] {
  const out = ['LAST TIPS'];
  for (const t of game.tips.last()) out.push('', ...t.lines);
  return out;
}

/** Shows LAST TIPS over `world` (the paused level), read out; OK goes back to the menu. */
export function showLastTips(game: Game, world: World | null): void {
  const tips = game.tips.last();
  if (!tips.length) return;
  game.ctx.audio.sfx('pause');
  game.deps.announcer?.say(`Last tips. ${tips.map((t) => t.said).join(' ')} OK to continue.`);
  game.scenes.push(
    new CardScene(game, lastTipsLines(game), () => game.scenes.pop(), world, {
      keys: ['jump', 'attack', 'start'],
      panel: true,
      top: true,
      overlay: true,
      prompt: () => fontText(abilityHint(game, 'OK', 'jump')),
    }),
  );
}

/** The menu entry, while there are tips to show (a tutorial or a training stage). */
export function lastTipsItem(game: Game, world: World | null): MenuItem[] {
  if (!game.tips.last().length) return [];
  return [
    {
      label: 'Last tips',
      select: () => showLastTips(game, world),
      hint: 'The last three tips, read again',
    },
  ];
}
