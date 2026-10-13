import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { CHARACTERS } from '@game/characters/registry';
import { applyLook, campaignLevel } from '@game/level/campaign';
import {
  hasSolidFloors,
  isCastleTheme,
  isSwimLevel,
  isWaterTheme,
  type LevelData,
  type Theme,
} from '@game/level/schema';
import { enemyPalette } from '@game/entities/enemies/enemy';
import { decorPalette } from '@game/entities/objects/decoration';
import { levelMusic } from '@game/scenes/level';
import { drawThemeBackdrop, hasThemeBackdrop } from '@game/world/theme-backdrop';
import { SKY } from '@game/world/tile-render';
import type { View } from '@game/entities/entity';

/*
 * World 1 as the Mushroom Kingdom (0.4.48, owner decisions): in campaign play 1-0, 1-1 and 1-3 take
 * the `kingdom` look (SMB's sky, far hills with Peach's Castle, rounder hills, bushes and clouds) and
 * 1-4 the `kingdom-keep` (a keep's wall, windows onto the night, Bowser's banners). Decor and
 * backdrop only: the tiles, zones, entities, clock and music are the level's own, and every rule
 * that keys off the theme answers as before. 1-2 (underground) and every other area keep their look.
 */

const LOOKS: Readonly<Record<string, Theme>> = {
  '1-0': 'kingdom',
  '1-1': 'kingdom',
  '1-3': 'kingdom',
  '1-4': 'kingdom-keep',
};
const IDS = Object.keys(LOOKS);

const both = (id: string): [LevelData, LevelData] => {
  const lvl = getLevel(id);
  const plain: LevelData = { ...lvl };
  delete plain.campaignLook;
  return [campaignLevel(lvl), campaignLevel(plain)];
};

/** Everything but the skin (theme, decor and the look itself). */
const play = (l: LevelData) => {
  const { theme: _t, decor: _d, campaignLook: _l, ...rest } = l;
  return { ...rest, tiles: Array.from(l.tiles) };
};

class Recorder implements Renderer {
  calls: string[] = [];
  clear(): void {}
  rect(x: number, y: number, w: number, h: number, c: string): void {
    this.calls.push(`rect ${x} ${y} ${w} ${h} ${c}`);
  }
  text(): void {}
  debugText(): void {}
  line(): void {}
  sprite(s: SpriteSheet, frame: string, x: number, y: number): void {
    this.calls.push(`${s.id} ${frame} ${x} ${y}`);
  }
}

describe('World 1 as the Mushroom Kingdom (campaign looks)', () => {
  it.each(IDS)('%s: campaign play shows its look; elsewhere the original', (id) => {
    const [camp] = both(id);
    expect(camp.theme).toBe(LOOKS[id]);
    const lvl = getLevel(id);
    expect(lvl.theme).toBe(LOOKS[id] === 'kingdom' ? 'overworld' : 'castle');
    expect(applyLook(lvl, { theme: () => false, music: () => false })).toBe(lvl);
  });

  it.each(IDS)(
    '%s: plays exactly as the classic level (tiles, zones, entities, start, clock, music)',
    (id) => {
      const [camp, classic] = both(id);
      expect(play(camp)).toEqual(play(classic));
      expect(camp.music).toBe(classic.music);
      // Its own hills, bushes and clouds, where they always stood (redrawn by the look).
      expect(camp.decor).toEqual(classic.decor);
      for (const hero of [...CHARACTERS, { music: 'hero-tune' }])
        expect(levelMusic(camp, hero)).toBe(levelMusic(classic, hero));
    },
  );

  it.each(IDS)('%s: every rule that keys off the theme answers as in the classic level', (id) => {
    const [camp, classic] = both(id);
    const [a, b] = [camp.theme, classic.theme];
    expect(isWaterTheme(a)).toBe(false);
    expect(isSwimLevel(camp)).toBe(isSwimLevel(classic));
    expect(isCastleTheme(a)).toBe(isCastleTheme(b));
    expect(hasSolidFloors(a)).toBe(hasSolidFloors(b));
    expect(enemyPalette(a)).toBe(enemyPalette(b));
    // The real tiles in SMB's own colours, and the castle's flagstones in the keep.
    expect(PALETTES.default[`tiles-${a}`]).toEqual(PALETTES.default[`tiles-${b}`]);
    expect(SKY[a]).toBe(SKY[b]);
  });

  it('redraws each of their decor pieces and paints a backdrop behind', () => {
    const assets = new AssetRegistry(PALETTES);
    assets.defineAll(SPRITES);
    const sheet = assets.sheet('decor', decorPalette('kingdom'));
    for (const id of IDS) {
      const camp = campaignLevel(getLevel(id));
      expect(hasThemeBackdrop(camp.theme), id).toBe(true);
      for (const d of camp.decor) {
        expect(sheet.frames.has(d.kind), `${id}: ${d.kind}`).toBe(true);
        // The look's own round hills, bushes and clouds (the castle at the end stays SMB's).
        if (/^(hill|bush|cloud)-/.test(d.kind))
          expect(sheet.frames.has(`${d.kind}@kingdom`), d.kind).toBe(true);
      }
    }
  });

  it.each(['kingdom', 'kingdom-keep'] as const)('%s: its backdrop scrolls and never blinks', (theme) => {
    const assets = new AssetRegistry(PALETTES);
    assets.defineAll(SPRITES);
    const draw = (camX: number, frame: number) => {
      const r = new Recorder();
      const view = { assets, theme, camX, frame, reduceFlashing: false } as unknown as View;
      drawThemeBackdrop(r, view);
      return r.calls;
    };
    expect(draw(40, 0).length).toBeGreaterThan(0);
    for (const f of [1, 7, 60, 241]) expect(draw(40, f)).toEqual(draw(40, 0));
    expect(draw(200, 0)).not.toEqual(draw(40, 0));
  });

  it('1-2 and the other areas of World 1 keep their own looks', () => {
    for (const id of ['1-0-pipe', '1-1-bonus', '1-2-intro', '1-2', '1-2-bonus', '1-2-exit']) {
      const l = getLevel(id);
      expect(l.campaignLook, id).toBeUndefined();
      expect(campaignLevel(l).theme, id).toBe(l.theme);
    }
  });
});
