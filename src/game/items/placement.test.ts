import { describe, expect, it } from 'vitest';
import type { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NO_INPUT } from '@engine/input/input-manager';
import { getLevel, levelIds } from '@content/levels';
import { DEFAULT_ASSIST, newGameState } from '../context';
import { CHARACTERS } from '../characters/registry';
import { HeroItem } from '../entities/objects/hero-item';
import { tileDef } from '../level/tiles';
import { World } from '../world/world';
import { HERO_ITEMS, entryItem } from './catalog';
import { heroStart, itemRules } from './heroes';

/*
 * The first-pass placement plan (docs/POWERUPS.md 6) as written into the World 1-8 maps: every
 * power item of every hero comes at least twice, and every hero gets each placed block's item.
 */

const STUB_ASSETS = {
  sheet: () => ({ id: 'stub', image: null, frames: new Map() }),
  has: () => false,
} as unknown as AssetRegistry;

const SMB = levelIds().filter((id) => /^[1-8]-[1-4](-|$)/.test(id));
const PLACED = SMB.map((id) => ({ id, level: getLevel(id) })).filter((l) => l.level.heroItems?.length);
const HEROES = CHARACTERS.filter((c) => HERO_ITEMS[c.id]?.ownItems);

/** Every power block of Worlds 1-8: 'x,y' per level, with its entries (or none). */
function powerBlocks(): { id: string; entries: Readonly<Record<string, string>> }[] {
  const out: { id: string; entries: Readonly<Record<string, string>> }[] = [];
  for (const id of SMB) {
    const level = getLevel(id);
    for (let y = 0; y < level.height; y++)
      for (let x = 0; x < level.width; x++) {
        const block = tileDef(level.tiles[y * level.width + x] ?? 0).block;
        if (block?.content !== 'powerup') continue;
        const e = level.heroItems?.find((h) => h.x === x && h.y === y);
        out.push({ id, entries: e?.items ?? {} });
      }
  }
  return out;
}

describe('the placement plan in the World 1-8 maps', () => {
  it('48 power blocks carry entries (2-2, 4-4, 5-1, 7-2, 7-4, 8-1 and 8-4 have none)', () => {
    expect(PLACED.reduce((n, l) => n + (l.level.heroItems?.length ?? 0), 0)).toBe(48);
    for (const none of ['2-2', '4-4', '5-1', '7-2', '7-4', '8-1', '8-4'])
      expect(getLevel(none).heroItems ?? []).toEqual([]);
  });

  it('every power item of every hero comes at least twice (a blank block gives the default)', () => {
    const blocks = powerBlocks();
    for (const hero of HEROES) {
      const h = HERO_ITEMS[hero.id]!;
      const copies = new Map<string, number>();
      for (const b of blocks) {
        const v = b.entries[hero.id];
        const item = v === undefined ? h.defaultPower : entryItem(hero.id, v);
        copies.set(item!, (copies.get(item!) ?? 0) + 1);
      }
      for (const i of h.items.filter((x) => x.kind === 'power'))
        expect(copies.get(i.id) ?? 0, `${hero.id} ${i.id}`).toBeGreaterThanOrEqual(2);
    }
  });

  for (const hero of HEROES)
    it(`${hero.name} gets the placed item (or the default) from each placed block`, () => {
      for (const { id, level } of PLACED) {
        const state = newGameState(hero);
        Object.assign(state, (({ powerState, hp, kit }) => ({ powerState, hp, kit }))(heroStart(hero)));
        const ctx = {
          assets: STUB_ASSETS,
          audio: NULL_AUDIO,
          assist: { ...DEFAULT_ASSIST },
          reduceFlashing: true,
        };
        const w = new World(level, ctx, state, { seed: 1 });
        w.useHeroItems(level.heroItems ?? []);
        const p = w.player;
        itemRules(hero.id)!.give(p, HERO_ITEMS[hero.id]!.grow);
        p.transition = null;
        for (const e of level.heroItems ?? []) {
          for (const old of w.entities) if (old instanceof HeroItem) old.destroy();
          w.strikeBlock(e.x, e.y, p, false);
          p.transition = null;
          w.update([NO_INPUT]);
          const got = w.entities.find((x): x is HeroItem => x instanceof HeroItem && x.alive);
          const want = e.items[hero.id];
          const rules = itemRules(hero.id)!;
          const h = HERO_ITEMS[hero.id]!;
          let item = want === undefined ? h.defaultPower : entryItem(hero.id, want);
          // A grow-slot block once the grow item is owned: the next power item not owned (0.4.35).
          if (item === h.grow && rules.owned(p, h.grow))
            item = h.items.find((i) => i.kind === 'power' && !rules.owned(p, i.id))?.id ?? h.defaultPower;
          expect(got?.item, `${id} ${e.x},${e.y}`).toBe(item);
        }
      }
    });
});
