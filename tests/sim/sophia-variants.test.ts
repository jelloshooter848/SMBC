import { beforeEach, describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { SOPHIA } from '@game/characters/sophia';
import { MARIO } from '@game/characters/mario';
import { LevelScene } from '@game/scenes/level';
import { campaignLevel } from '@game/level/campaign';
import { heroVariant } from '@game/level/variants';
import type { LevelData } from '@game/level/schema';
import { file, makeGame, useStorage, type H } from './heroes-harness';

/*
 * Sophia III's level variants (Chapter 1 finishing pass): the `[variant sophia]` runs of the
 * levels Normal Sophia could not finish (docs/HEROES.md "Sophia III in the campaign levels").
 */

/** Every bundled level that has a Sophia variant. */
const VARIANT_LEVELS = ['8-4'];

const scene = (h: H) => h.game.scenes.find((s): s is LevelScene => s instanceof LevelScene) as LevelScene;
/** The (x, y) tiles a level's Sophia variant lays, from its map. */
const laid = (l: LevelData) =>
  (l.variants ?? [])
    .filter((v) => v.hero === 'sophia')
    .flatMap((v) => v.tiles.flatMap((r) => r.tiles.map((t, i) => ({ x: r.x + i, y: r.y, t }))));
const tile = (l: LevelData, x: number, y: number) => l.tiles[y * l.width + x];

beforeEach(useStorage);

describe('the game lays the Sophia variant', () => {
  const play = (hero: typeof MARIO, campaign: boolean, partner?: typeof MARIO) => {
    const h = makeGame();
    if (campaign) {
      file({}, hero.id);
      h.game.openFile(1);
    }
    h.game.setHero(0, hero);
    if (partner) h.game.setHero(1, partner);
    h.game.startLevel(getLevel('8-4'), { mode: 'stand' });
    h.step();
    return scene(h).world.level;
  };

  it('in campaign play when a player is Sophia III (either one in co-op)', () => {
    const runs = laid(getLevel('8-4'));
    expect(runs.length).toBeGreaterThan(0);
    for (const level of [play(SOPHIA, true), play(MARIO, true, SOPHIA)])
      for (const r of runs) expect(tile(level, r.x, r.y)).toBe(r.t);
  });

  it('not for Mario, and not outside the campaign (8-4 has no Sophia tiles in the original)', () => {
    for (const level of [play(MARIO, true), play(SOPHIA, false)])
      for (const r of laid(getLevel('8-4'))) expect(tile(level, r.x, r.y)).toBe(tile(getLevel('8-4'), r.x, r.y));
  });
});

describe.each(VARIANT_LEVELS)('%s: the Sophia variant', (id) => {
  it('is absent for Mario, in the campaign and out of it', () => {
    const camp = campaignLevel(getLevel(id));
    expect(heroVariant(camp, [MARIO.id], true)).toBe(camp);
    expect(heroVariant(getLevel(id), [MARIO.id], false)).toBe(getLevel(id));
  });

  it('only adds tiles in open air', () => {
    const level = getLevel(id);
    const runs = laid(level);
    expect(runs.length).toBeGreaterThan(0);
    const v = heroVariant(campaignLevel(level), [SOPHIA.id], true);
    for (const r of runs) {
      expect(tile(level, r.x, r.y), `${id} ${r.x},${r.y}`).toBe(0);
      expect(tile(v, r.x, r.y)).toBe(r.t);
    }
  });
});
