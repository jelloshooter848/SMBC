import { describe, expect, it } from 'vitest';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { MARIO } from '@game/characters/mario';
import { HURT_STEADY_ALPHA, type World } from '@game/world/world';
import { classicWorld, step } from './classic-harness';

// G-092: under Campaign rules (the campaign, and Classic mode with Classic rules set to Campaign)
// the hurt blink toggled the hero every 2 frames whatever Reduce flashing said. With Reduce
// flashing on it is now held steady: the hero is drawn every frame, see-through.

interface Seen {
  drawn: boolean;
  alpha: number | null;
}

function frames(world: World, n: number): Seen[] {
  const out: Seen[] = [];
  for (let i = 0; i < n; i++) {
    step(world);
    let drawn = false;
    let alpha: number | null = null;
    const r: Renderer = Object.assign(new NullRenderer(), {
      sprite(sheet: SpriteSheet, frame: string): void {
        if ((sheet as { name?: string }).name === MARIO.sprite(world.player, 0, false).sheet && frame)
          drawn = true;
      },
      alpha(a: number, draw: () => void): void {
        alpha = a;
        draw();
      },
    });
    world.render(r);
    out.push({ drawn, alpha });
  }
  return out;
}

function hurtWorld(reduceFlashing: boolean): World {
  const world = classicWorld(MARIO, undefined, 'campaign');
  const ctx = world.ctx as { reduceFlashing: boolean; assets: unknown };
  ctx.reduceFlashing = reduceFlashing;
  ctx.assets = { sheet: (name: string) => ({ name, frames: new Map() }) };
  world.player.invuln = 90;
  return world;
}

describe('G-092 hurt blink and Reduce flashing (Campaign rules)', () => {
  it('without Reduce flashing the hero still blinks', () => {
    const seen = frames(hurtWorld(false), 12);
    expect(seen.some((s) => !s.drawn)).toBe(true);
    expect(seen.some((s) => s.drawn)).toBe(true);
    expect(seen.every((s) => s.alpha === null)).toBe(true);
  });

  it('with Reduce flashing the hero is drawn every frame, held see-through', () => {
    const seen = frames(hurtWorld(true), 12);
    expect(seen.every((s) => s.drawn)).toBe(true);
    expect(seen.every((s) => s.alpha === HURT_STEADY_ALPHA)).toBe(true);
  });

  it('once the hurt time is over the hero is drawn plainly', () => {
    const world = hurtWorld(true);
    world.player.invuln = 2;
    const seen = frames(world, 6);
    expect(seen.at(-1)).toEqual({ drawn: true, alpha: null });
  });
});
