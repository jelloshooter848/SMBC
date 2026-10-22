import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import { px } from '@engine/math/units';
import { DEFAULT_ASSIST, newGameState, type GameContext } from '@game/context';
import { MARIO } from '@game/characters/mario';
import { ClassicDemo } from '@game/scenes/title-demo';
import { World } from '@game/world/world';

// 0.4.72 release review: Show hidden items is drawn only in the playing world, never in the
// CLASSIC title's demo (World demo), even when the demo's context has the assist on.

function ctx(showHidden: boolean): GameContext {
  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  return { assets, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST, showHidden }, reduceFlashing: true };
}

/** The marker squares (white 12 x 12 frames) a World draws with its camera over 1-1's first blocks. */
function frames(w: World): number {
  let n = 0;
  const r: Renderer = Object.assign(new NullRenderer(), {
    rect(_x: number, _y: number, wd: number, h: number, c: string): void {
      if (wd === 12 && h === 12 && c === '#fcfcfc') n++;
    },
  });
  w.camera.x = px(15 * 16);
  w.render(r);
  return n;
}

const world = (showHidden: boolean, demo: boolean) =>
  new World(getLevel('1-1'), ctx(showHidden), newGameState(MARIO, null, 'classic'), {
    ...(demo ? { demo: true } : {}),
    rules: 'classic',
  });

describe('0.4.72 release review: no hidden-item markers in the title demo', () => {
  it('a playing world draws them; a demo world with the same assist does not', () => {
    expect(frames(world(true, false))).toBeGreaterThan(0);
    expect(frames(world(true, true))).toBe(0);
    expect(frames(world(false, false))).toBe(0);
  });

  it("the CLASSIC title's demo, built from a context with the assist on, draws none", () => {
    const demo = new ClassicDemo(ctx(true));
    expect(frames((demo as unknown as { world: World }).world)).toBe(0);
  });
});
