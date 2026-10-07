import { beforeEach, describe, expect, it } from 'vitest';
import { fontDef } from '@content/sprites/font';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import { MINIGAMES } from '.';
import { duelHarness, type DuelHarness } from './ryu/harness';
import { ArtScroll } from './ryu/creatures';
import { READY_FRAMES } from './ryu/scene';

// Mini games draw their rules cards and hint banners in the bitmap font, which silently drops
// any character it has no glyph for (QA 0.4.8: the Shadow Duel card's semicolon vanished, so it
// read "AIR TO CLING KEEP HOLDING"). Every such line uses only characters the font has.

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

const STUB_ASSETS = {
  sheet: () => ({ id: 'stub', image: null, frames: new Map() }),
  has: () => false,
} as unknown as AssetRegistry;

/** The characters of `line` the font cannot draw (letters as the font draws them: upper case). */
function missing(line: string): string[] {
  return [...line.toUpperCase()].filter((ch) => ch !== ' ' && !fontDef.frames[ch]);
}

/** Every string the scene draws in one frame. */
function drawn(h: DuelHarness): string[] {
  const out: string[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    text: (...args: Parameters<Renderer['text']>) => void out.push(args[1]),
  });
  h.game.scenes.render(r);
  return out;
}

describe('the bitmap font draws every mini game line', () => {
  it('has a semicolon in the style of its colon and comma', () => {
    const semi = fontDef.frames[';'] as string[];
    const colon = fontDef.frames[':'] as string[];
    const comma = fontDef.frames[','] as string[];
    expect(semi).toBeDefined();
    expect(semi.slice(0, 3)).toEqual(colon.slice(0, 3)); // the colon's upper dot
    expect(semi.slice(4)).toEqual(comma.slice(4)); // the comma below
  });

  for (const [hero, def] of Object.entries(MINIGAMES))
    it(`${hero}: the title and rules card`, () => {
      for (const line of [def.title, ...def.rules]) expect(missing(line), line).toEqual([]);
    });

  for (const scheme of ['keyboard', 'touch'] as const)
    it(`ryu (${scheme}): the cutscene, READY, the climb and art banners and the win banner`, () => {
      const h = duelHarness({ scheme, assets: STUB_ASSETS, keep: true });
      const lines: string[] = [];
      h.step([], 30);
      lines.push(...drawn(h));
      h.tap('jump'); // skip the cutscene
      lines.push(...drawn(h));
      h.step([], READY_FRAMES);
      h.scene.clingTaught = false;
      (h.scene as unknown as { teachClimb(): void }).teachClimb();
      lines.push(...(h.scene.banner?.lines ?? []), ...drawn(h));
      const p = h.scene.player;
      h.world.spawn(
        new ArtScroll(p.centerX, p.body.y + p.body.h, (q) =>
          (h.scene as unknown as { gotArt(q: unknown): void }).gotArt(q),
        ),
      );
      h.step([], 10);
      lines.push(...(h.scene.banner?.lines ?? []), ...drawn(h));
      (h.scene as unknown as { bossDown(): void }).bossDown();
      h.step();
      lines.push(...(h.scene.banner?.lines ?? []), ...drawn(h));
      expect(lines.length).toBeGreaterThan(10);
      const bad = lines.filter((l) => missing(l).length > 0);
      expect(bad).toEqual([]);
    });
});
