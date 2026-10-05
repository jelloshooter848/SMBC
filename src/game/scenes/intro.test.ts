import { describe, expect, it } from 'vitest';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { DEFAULT_ASSIST, newGameState } from '../context';
import { MARIO } from '../characters/mario';
import { IntroScene } from './intro';
import type { Game } from './game';

// The original's pre-level black screen (InformativeBlackScreen, SCREEN_TYPE_PRE_LEVEL) shows the
// HUD (TopScreenText) across the top, with the time set to the level's total
// (TopScreenText.initiateBlackScreen), hidden only with the infinite-time cheat.

function card(time: number | null, infiniteTime = false): string[] {
  const state = { ...newGameState(MARIO), score: 4200, coins: 7 };
  const game = {
    ctx: {
      assets: { sheet: () => ({ frames: new Map() }) },
      assist: { ...DEFAULT_ASSIST, infiniteTime },
    },
    state,
  } as unknown as Game;
  const texts: string[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    text(_f: SpriteSheet, str: string): void {
      texts.push(str);
    },
  });
  new IntroScene(game, () => undefined, time).render(r);
  return texts;
}

describe('lives card', () => {
  it('shows the HUD row: name, score, coins, world and the level time', () => {
    const t = card(400);
    for (const s of ['MARIO ', '0004200', '$×07', 'WORLD', '1-1', 'TIME', '400']) expect(t).toContain(s);
    expect(t).toContain('WORLD 1-1');
  });

  it('leaves the time blank with the infinite-time assist', () => {
    const t = card(400, true);
    expect(t).toContain('TIME');
    expect(t).not.toContain('400');
  });
});
