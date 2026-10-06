import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { ScriptedInput, runSim } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { LevelScene } from '@game/scenes/level';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import type { Announcer } from '@engine/a11y/announcer';
import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';

// The original keeps the midpoint's row: Level.as sets hwPnt = (currentX + TILE_SIZE/2,
// currentY + TILE_SIZE) for a shiftRight `halfwayPoint` (lines 1068-1072) and
// startAtHalfwayPoint puts the player's feet there (lines 1663-1672). Lost Levels 5-3's midpoint
// is at 154, row 9, on the giant mushroom whose top is row 10; the stalk below is not solid.

describe('checkpoints keep their row', () => {
  it('ll-5-3: the checkpoint zone is at 154, row 9; the others are on row 12', () => {
    expect(getLevel('ll-5-3').zones).toContainEqual({ kind: 'checkpoint', x: 154, y: 9 });
    expect(getLevel('1-1').zones).toContainEqual({ kind: 'checkpoint', x: 82, y: 12 });
  });

  it('ll-5-3: walking past the midpoint reports its row', () => {
    const r = runSim({
      level: getLevel('ll-5-3'),
      character: MARIO,
      script: { steps: [] },
      maxFrames: 120,
      start: { x: 153, y: 9, mode: 'stand' },
      controller: () => ['right'],
      until: (w) => toPx(w.player.body.x) > 154 * 16 + 4,
    });
    expect(r.events).toContainEqual({ type: 'checkpoint', x: 154, y: 9 });
  });

  it('ll-5-3: after a death past the midpoint Mario stands on the mushroom instead of falling', () => {
    const game = new Game({
      ctx: {
        assets: new AssetRegistry({ default: {} }),
        audio: NULL_AUDIO,
        assist: { ...DEFAULT_ASSIST },
        reduceFlashing: true,
      },
      getLevel,
      characters: CHARACTERS,
      announcer: { say: () => undefined } as unknown as Announcer,
    });
    const input = new ScriptedInput({ steps: [] });
    const step = (a: Action[] = []) => {
      input.setHeld(a);
      input.next();
      game.scenes.update([input]);
    };
    const level = () => (game.scenes.top instanceof LevelScene ? game.scenes.top : null);
    game.newGame(MARIO, 'll-5-3');
    for (let i = 0; i < 2000 && !level(); i++) step();
    game.state.checkpoint = { level: 'll-5-3', x: 154, y: 9 };
    const lives = game.state.lives;
    const first = level()!.world;
    first.kill(first.player);
    // Through the character select (confirm the same hero) and the lives card.
    for (let i = 0; i < 2000 && level()?.world === first; i++) step();
    for (let i = 0; i < 2000 && !level(); i++) step(i % 20 === 0 ? ['start'] : []);
    const w = level()!.world;
    expect(w).not.toBe(first);
    for (let i = 0; i < 90; i++) step();
    const p = w.player;
    expect(p.dead).toBe(false);
    expect(p.body.onGround).toBe(true);
    expect(toPx(p.body.y + p.body.h)).toBe(10 * 16); // feet on the mushroom's top
    expect(Math.floor(toPx(p.body.x + p.body.w / 2) / 16)).toBe(154);
    expect(game.state.lives).toBe(lives - 1);
  });
});
