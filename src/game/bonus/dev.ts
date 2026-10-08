import type { Game } from '../scenes/game';
import { MenuScene } from '../scenes/menu';
import { MessageScene } from '../scenes/message';
import { snapshot } from '../scenes/free-hero';
import { abilityHint } from '../scenes/hints';
import { fontText } from '../hud/text';
import { newBonusState } from './items';
import { BONUS_KINDS, BONUS_TITLES, type BonusKind, type BonusPrize } from './rules';
import { ITEM_NAMES } from './items';
import { openBonusGame } from '.';
import type { BonusResult } from './common';

/** A prize as the dev result card lists it. */
export function prizeText(p: BonusPrize): string {
  if (p.kind === 'item') return ITEM_NAMES[p.item];
  if (p.kind === 'coins') return `${p.amount} COINS`;
  return p.amount === 1 ? '1 UP' : `${p.amount} UP`;
}

/**
 * Dev mode → Bonus games: the three SMB3 bonus games, played from the dev menu. One game, then a
 * card listing what it gave, and back to the list. Nothing sticks: no file is written, and the
 * run's state and the bonus state are put back (the round plays with an unlocked, empty inventory
 * so its items show how the campaign stores them).
 */
export class DevBonusGamesScene extends MenuScene {
  lastResult: BonusResult | null = null;

  constructor(
    game: Game,
    private readonly fromPause = false,
  ) {
    super(game, 'BONUS GAMES', [], () => game.scenes.pop(), fromPause);
    this.setItems([
      ...BONUS_KINDS.map((kind) => ({
        label: label(BONUS_TITLES[kind]),
        select: () => this.play(kind),
        hint: 'Plays one game; nothing is saved',
      })),
      { label: 'Back', select: () => game.scenes.pop() },
    ]);
  }

  play(kind: BonusKind, seed?: number): void {
    const game = this.game;
    const audio = game.ctx.audio;
    const saved = game.state;
    const before = snapshot(saved);
    const bonus = game.bonus;
    const campaign = game.campaign;
    const unlocked = game.inventoryUnlocked;
    game.campaign = null; // nothing it does can autosave
    game.bonus = newBonusState();
    game.inventoryUnlocked = true;
    audio.resume();
    openBonusGame(
      game,
      kind,
      (result) => {
        game.state = saved;
        Object.assign(saved, before);
        game.bonus = bonus;
        game.inventoryUnlocked = unlocked;
        game.campaign = campaign;
        this.lastResult = result;
        const won = result.prizes.map(prizeText);
        game.scenes.push(
          new MessageScene(
            game,
            [
              BONUS_TITLES[kind],
              '',
              ...(won.length ? ['WON:', ...won.slice(0, 6)] : ['NOTHING WON']),
              '',
              fontText(`PRESS ${abilityHint(game, 'OK', 'jump')}`),
            ],
            () => {
              game.scenes.pop();
              this.restoreMusic();
              this.announce();
            },
            ['jump', 'start', 'attack'],
          ),
        );
        game.deps.announcer?.say(
          `${label(BONUS_TITLES[kind])}. ${won.length ? `Won ${won.join(', ').toLowerCase()}` : 'Nothing won'}. OK to go back.`,
        );
      },
      { music: null, ...(seed === undefined ? {} : { seed }) },
    );
  }

  private restoreMusic(): void {
    const audio = this.game.ctx.audio;
    const level = this.game.scenes.find(
      (s) => typeof (s as { playMusic?: unknown }).playMusic === 'function',
    ) as { playMusic(): void } | undefined;
    if (level) level.playMusic();
    else audio.playMusic('title');
    if (this.fromPause) audio.pause();
  }
}

function label(title: string): string {
  const t = title.toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
