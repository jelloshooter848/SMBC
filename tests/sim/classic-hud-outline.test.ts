import { describe, expect, it } from 'vitest';
import { runSim } from '@game/sim/headless';
import type { Action } from '@engine/input/actions';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { AssetRegistry } from '@engine/assets/registry';
import { SIMON } from '@game/characters/simon';
import { heroFor } from '@game/characters/registry';
import { YOSHI_CLASSIC } from '@game/characters/yoshi/classic';
import type { CharacterDef } from '@game/characters/character';
import type { Player } from '@game/entities/player';
import { drawHud } from '@game/hud/hud';
import { flatLevel } from './classic-plumber-harness';
import { useStorage } from './heroes-harness';

// classic-patch-2 item 6: a Classic hero's HUD counter (hudAmmo: Simon's hearts, Yoshi's eggs,
// ...) always gets the HUD's dark outline, so it reads over a white cloud; Current is unchanged.

useStorage();

const none = { steps: [{ frame: 0, hold: [] as Action[] }] };

/** The HUD texts drawn for `def` (with `kit`), as "text@x,y", one entry per draw. */
function texts(def: CharacterDef, rules: 'classic' | 'current', kit: Record<string, number>): string[] {
  const w = runSim({ level: flatLevel(), character: def, rules, script: none, maxFrames: 1 }).world;
  Object.assign((w.player as Player).scratch, kit);
  const out: string[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    text(_f: SpriteSheet, str: string, x: number, y: number): void {
      out.push(`${str}@${x},${y}`);
    },
  });
  const assets = { sheet: () => ({ frames: new Map() }) } as unknown as AssetRegistry;
  drawHud(r, assets, w.state, 400, 0, w.players);
  return out;
}

describe('Classic HUD counters are outlined', () => {
  it("Classic Simon's hearts: the count drawn four times dark around it, then once", () => {
    const out = texts(heroFor(SIMON, 'classic'), 'classic', { hearts: 5 });
    const count = out.filter((t) => t.startsWith('×05@'));
    expect(count).toHaveLength(5);
    for (const at of ['105,24', '104,24', '106,24', '105,23', '105,25']) expect(count).toContain(`×05@${at}`);
  });

  it("Classic Yoshi's egg count is outlined too", () => {
    const out = texts(YOSHI_CLASSIC, 'classic', {});
    expect(out.filter((t) => t.startsWith('×')).length).toBe(5);
  });

  it('the name stays plain (outlined only over a sprite, as before)', () => {
    const out = texts(heroFor(SIMON, 'classic'), 'classic', { hearts: 5 });
    expect(out.filter((t) => t.endsWith('@24,8'))).toHaveLength(1);
  });

  it("Current Simon's belt count stays plain", () => {
    const out = texts(SIMON, 'current', {});
    for (const t of out.filter((s) => s.startsWith('×'))) expect(out.filter((s) => s === t)).toHaveLength(1);
  });
});
