import { describe, expect, it } from 'vitest';
import { runSim } from '@game/sim/headless';
import type { Action } from '@engine/input/actions';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { AssetRegistry } from '@engine/assets/registry';
import { px } from '@engine/math/units';
import type { View } from '@game/entities/entity';
import type { Player } from '@game/entities/player';
import { ARTHUR_CLASSIC } from '@game/characters/arthur/classic';
import { ArthurBolt, BOLT_TOP } from '@game/characters/arthur/classic-weapons';
import { HUD_BOTTOM, POWER_ICON_P1 } from '@game/hud/hud';
import { flatLevel } from './classic-plumber-harness';
import { useStorage } from './heroes-harness';

// classic-patch-2 item 7: Arthur's gold lightning stops 8 px under the HUD, clear of the power
// icon at the HUD's left end (the left column at the screen's left edge nearly touched it).

useStorage();

const none = { steps: [{ frame: 0, hold: [] as Action[] }] };

describe("Arthur's lightning keeps below the HUD", () => {
  it('the column is drawn from the ground up to BOLT_TOP, 8 px under the power icon', () => {
    expect(BOLT_TOP).toBe(HUD_BOTTOM + 8);
    expect(BOLT_TOP).toBeGreaterThanOrEqual(POWER_ICON_P1.y + 8 + 8);
    const w = runSim({
      level: flatLevel(),
      character: ARTHUR_CLASSIC,
      rules: 'classic',
      script: none,
      maxFrames: 1,
    }).world;
    const p = w.player as Player;
    // The left column at the screen's left edge, under the power icon.
    const bolt = new ArthurBolt(px(POWER_ICON_P1.x + 4), p.feetY, w, p);
    const clips: { y: number; h: number }[] = [];
    const sprites: number[] = [];
    let inClip = false;
    const r: Renderer = Object.assign(new NullRenderer(), {
      clip(_x: number, y: number, _w: number, h: number, draw: () => void): void {
        clips.push({ y, h });
        inClip = true;
        draw();
        inClip = false;
      },
      sprite(_s: SpriteSheet, _f: string, _x: number, y: number): void {
        expect(inClip).toBe(true);
        sprites.push(y);
      },
    });
    const view = {
      camX: 0,
      frame: 0,
      reduceFlashing: true,
      assets: { sheet: () => ({}) } as unknown as AssetRegistry,
    } as unknown as View;
    bolt.render(r, view);
    expect(clips).toEqual([{ y: BOLT_TOP, h: 13 * 16 - BOLT_TOP }]);
    // Bottom piece on the ground (row 13), the top one reaching up past the cut.
    expect(Math.max(...sprites)).toBe(13 * 16 - 16);
    expect(Math.min(...sprites)).toBeLessThanOrEqual(BOLT_TOP);
    expect(Math.min(...sprites)).toBeGreaterThan(BOLT_TOP - 16);
  });
});
