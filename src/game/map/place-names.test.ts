import { describe, expect, it } from 'vitest';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { AssetRegistry } from '@engine/assets/registry';
import { getLevel } from '@content/levels';
import { BOWSERS_CASTLE } from '@content/worldmap/valley-of-bowser';
import { runSim } from '../sim/headless';
import { MARIO } from '../characters/mario';
import { drawHud } from '../hud/hud';
import { PLACE_NAMES, shownPlace, spokenLevel } from './campaign-order';

// 0.4.55: BOWSER'S CASTLE (internal 8-5) is shown by its name everywhere, never "8-5": the HUD's
// WORLD column (BOWSER'S over CASTLE, TIME moved right), the intro card and the announcer.

function hudTexts(levelId: string, time: number): { what: string; x: number; y: number }[] {
  const w = runSim({ level: getLevel(levelId), character: MARIO, script: { steps: [] }, maxFrames: 1 }).world;
  w.state.world = getLevel(levelId).world;
  w.state.stage = getLevel(levelId).stage;
  const out: { what: string; x: number; y: number }[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    text(_f: SpriteSheet, what: string, x: number, y: number): void {
      out.push({ what, x, y });
    },
  });
  drawHud(r, { sheet: () => ({}) } as unknown as AssetRegistry, w.state, time, 0, w.players);
  return out;
}

describe('places shown by name', () => {
  it("8-5 is BOWSER'S CASTLE, the Valley's node name; other levels have none", () => {
    expect(PLACE_NAMES['8-5']?.shown).toBe(BOWSERS_CASTLE);
    expect(shownPlace(8, 5)?.shown).toBe("BOWSER'S CASTLE");
    expect(shownPlace(8, 5)?.said).toBe("Bowser's Castle");
    expect(shownPlace(8, 4)).toBeNull();
    expect(shownPlace(1, 1)).toBeNull();
  });

  it('the announcer says the place, else the world and the (campaign) stage', () => {
    expect(spokenLevel(8, 5, true)).toBe("Bowser's Castle");
    expect(spokenLevel(8, 5, false)).toBe("Bowser's Castle");
    expect(spokenLevel(4, 2, true)).toBe('World 4-1');
    expect(spokenLevel(4, 2, false)).toBe('World 4-2');
  });

  it("the HUD: BOWSER'S over CASTLE in the WORLD column, TIME 16 px right", () => {
    const t = hudTexts('8-5', 600);
    expect(t).toContainEqual({ what: "BOWSER'S", x: 144, y: 8 });
    expect(t).toContainEqual({ what: 'CASTLE', x: 152, y: 16 });
    expect(t).toContainEqual({ what: 'TIME', x: 216, y: 8 });
    expect(t).toContainEqual({ what: '600', x: 224, y: 16 });
    expect(t.some((b) => b.what === 'WORLD' || b.what.includes('8-5'))).toBe(false);
    // Every text ends inside the 256-px screen.
    for (const b of t) expect(b.x + b.what.length * 8).toBeLessThanOrEqual(256);
  });

  it('the HUD keeps WORLD 8-4 for 8-4', () => {
    const t = hudTexts('8-4', 300);
    expect(t).toContainEqual({ what: 'WORLD', x: 144, y: 8 });
    expect(t).toContainEqual({ what: '8-4', x: 152, y: 16 });
    expect(t).toContainEqual({ what: 'TIME', x: 200, y: 8 });
  });
});
