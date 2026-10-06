import type { MiniGameDef } from '../types';
import type { Scene } from '@engine/scene';

/**
 * Placeholder until the Mirror Race lands: jump passes, attack fails, menu quits. Keeps the
 * unlock flow testable on its own.
 */
export const LUIGI_MINIGAME: MiniGameDef = {
  hero: 'luigi',
  title: 'MIRROR RACE',
  rules: ['BEAT LUIGI TO THE FLAG!'],
  create(game, done): Scene {
    let over = false;
    const end = (r: 'pass' | 'fail' | 'quit'): void => {
      if (over) return;
      over = true;
      done(r);
    };
    return {
      update(input) {
        if (input.pressed('jump')) end('pass');
        else if (input.pressed('attack')) end('fail');
        else if (input.pressed('start')) end('quit');
      },
      render(r) {
        r.clear('#000');
        r.text(game.ctx.assets.sheet('font'), 'MIRROR RACE', 84, 112);
      },
    };
  },
};
