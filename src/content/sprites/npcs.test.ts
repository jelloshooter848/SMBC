import { describe, expect, it } from 'vitest';
import { PALETTE_MODES, resolvePalette } from '@engine/gfx/palette';
import { rasterizeToBuffer, validateDef } from '@engine/gfx/pixelart';
import { PARTNERS } from '@game/story/script';
import { PALETTES, SPRITES } from './index';
import { npcsDef, npcsPalettes } from './npcs';
import { partnersPalettes } from './partners';

// 0.4.40: the level NPCs' sheet (src/content/sprites/npcs.ts): the hint NPCs' and the locals' art
// in new colours, and a few new faces, each an idle frame and a blink.

const rows = (name: string): readonly string[] => npcsDef.frames[name] as readonly string[];
const who = Object.keys(npcsDef.frames)
  .filter((f) => f.endsWith('-0'))
  .map((f) => f.slice(0, -2));
/** NPCs whose `-1` frame is not a blink: the floaters' wing beat or pulse. */
const FLOATERS: readonly string[] = [];

describe('npcs sheet', () => {
  it('validates, and is registered with its palette', () => {
    validateDef('npcs', npcsDef);
    expect(SPRITES.npcs).toBe(npcsDef);
    expect(PALETTES.default.npcs).toBe(npcsPalettes.npcs);
  });

  it("starts with the partners' palette, so their art keeps its colours", () => {
    expect(npcsPalettes.npcs?.slice(0, partnersPalettes.partners!.length)).toEqual(partnersPalettes.partners);
  });

  it('renders in every colour mode, with only colours its palette has', () => {
    for (const mode of PALETTE_MODES)
      expect(() => rasterizeToBuffer(npcsDef, resolvePalette(PALETTES, 'npcs', mode)), mode).not.toThrow();
    const n = npcsPalettes.npcs!.length;
    for (const f of Object.values(npcsDef.frames))
      for (const r of f) for (const ch of r) if (ch !== '.') expect(parseInt(ch, 36)).toBeLessThan(n);
  });

  it('every frame is a pair for a partner of the script, and nothing else', () => {
    expect(Object.keys(npcsDef.frames).sort()).toEqual(who.flatMap((w) => [`${w}-0`, `${w}-1`]).sort());
    for (const w of who) expect(PARTNERS[w], w).toBeDefined();
  });

  it.each(who)('%s: 16 wide, both frames the same size, an empty top row, feet on the bottom row', (w) => {
    const [a, b] = [rows(`${w}-0`), rows(`${w}-1`)];
    expect(a.length).toBe(b.length);
    for (const r of [...a, ...b]) expect(r.length).toBe(16);
    expect(a[0]).toMatch(/^\.+$/);
    expect(a.at(-1)).toMatch(/[^.]/);
    expect(a.length).toBeGreaterThanOrEqual(16);
    expect(a.length).toBeLessThanOrEqual(32);
  });

  it.each(who.filter((w) => !FLOATERS.includes(w)))(
    '%s: the pair is a blink (differs only round the eyes)',
    (w) => {
      const [a, b] = [rows(`${w}-0`), rows(`${w}-1`)];
      const changed: number[] = [];
      a.forEach((r, y) => [...r].forEach((c, x) => c !== b[y]?.[x] && changed.push(y)));
      expect(changed.length).toBeGreaterThan(0);
      expect(Math.max(...changed) - Math.min(...changed)).toBeLessThan(4);
    },
  );
});
