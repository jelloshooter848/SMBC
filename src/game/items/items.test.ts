import { describe, expect, it } from 'vitest';
import type { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO, type AudioSink } from '@engine/audio/audio-manager';
import { NO_INPUT } from '@engine/input/input-manager';
import type { Announcer } from '@engine/a11y/announcer';
import { getLevel } from '@content/levels';
import { DEFAULT_ASSIST, newGameState } from '../context';
import type { CharacterDef } from '../characters/character';
import { CHARACTERS, characterById } from '../characters/registry';
import { MARIO } from '../characters/mario';
import { LINK } from '../characters/link';
import { SAMUS } from '../characters/samus';
import { SIMON } from '../characters/simon';
import { SOPHIA } from '../characters/sophia';
import { MEGAMAN } from '../characters/megaman';
import { parseTextMap, serializeTextMap, MapParseError } from '../level/textmap';
import { World } from '../world/world';
import { HeroItem } from '../entities/objects/hero-item';
import { PowerUp } from '../entities/objects/powerup';
import { carriedKit } from '../entities/player';
import { Game } from '../scenes/game';
import { HERO_ITEMS } from './catalog';
import { has, isFound } from './flags';
import { heroStart, itemRules, itemSfx } from './heroes';
import { campaignKit } from './migrate';
import { bonusSaveFields, bonusStateFrom, swapInventory } from '../bonus/items';
import { migrateSave, newSave } from '../save/save-files';

const STUB_ASSETS = {
  sheet: () => ({ id: 'stub', image: null, frames: new Map() }),
  has: () => false,
} as unknown as AssetRegistry;

const HEROES_WITH_ITEMS = CHARACTERS.filter((c) => HERO_ITEMS[c.id]?.ownItems);

/** The first power item that isn't the hero's default (what a placed entry gives). */
const placedFor = (hero: string): string => {
  const h = HERO_ITEMS[hero]!;
  return h.items.find((i) => i.kind === 'power' && i.id !== h.defaultPower)!.id;
};

/**
 * A flat room with ? power blocks over the floor: (5,9) with every hero's entry, (8,9) blank,
 * (11,9) `W`, (14,9) `R`, and (17,9) a grow-slot block (every hero `=grow`).
 */
function room(): string {
  const rows: string[] = [];
  for (let y = 0; y < 15; y++) {
    let row = '';
    for (let x = 0; x < 24; x++) {
      if (y >= 13) row += '#';
      else if (y === 9 && (x === 5 || x === 8 || x === 17)) row += 'M';
      else if (y === 9 && x === 11) row += 'W';
      else if (y === 9 && x === 14) row += 'R';
      else row += '.';
    }
    rows.push(row);
  }
  const entries = HEROES_WITH_ITEMS.map((c) => `${c.id}=${placedFor(c.id)}`).join(' ');
  return [
    'id: t',
    'theme: overworld',
    'start: 2,12',
    '[tiles]',
    ...rows,
    '',
    '[hero-items]',
    `5 9 ${entries}`,
    `17 9 ${HEROES_WITH_ITEMS.map((c) => `${c.id}=grow`).join(' ')}`,
  ].join('\n');
}
const ROOM = parseTextMap(room(), 't');

function campaignWorld(def: CharacterDef, opts: { grown?: boolean; classic?: boolean } = {}) {
  const sfx: string[] = [];
  const audio: AudioSink = { ...NULL_AUDIO, sfx: (id) => void sfx.push(id) };
  const state = newGameState(def);
  if (!opts.classic) {
    const start = heroStart(def);
    state.powerState = start.powerState;
    state.hp = start.hp;
    state.kit = start.kit;
  }
  const ctx = { assets: STUB_ASSETS, audio, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true };
  const w = new World(ROOM, ctx, state, { seed: 1 });
  w.time = null;
  if (!opts.classic) w.useHeroItems(ROOM.heroItems ?? []);
  for (let i = 0; i < 4; i++) w.update([NO_INPUT]);
  const p = w.player;
  if (opts.grown) itemRules(def.id)!.give(p, HERO_ITEMS[def.id]!.grow);
  p.transition = null;
  return { w, p, sfx };
}

/** Strike the block at (tx, 9) and let its item rise; returns the item entity. */
function strike(w: World, tx: number): HeroItem | PowerUp | undefined {
  const p = w.player;
  w.strikeBlock(tx, 9, p, false);
  p.transition = null;
  for (let i = 0; i < 40; i++) w.update([NO_INPUT]);
  return w.entities.find((e) => (e instanceof HeroItem || e instanceof PowerUp) && e.alive) as
    HeroItem | PowerUp | undefined;
}

describe('hero items: the [hero-items] section', () => {
  it('parses entries and writes them back the same', () => {
    expect(ROOM.heroItems?.[0]?.x).toBe(5);
    expect(ROOM.heroItems?.[0]?.items.samus).toBe(placedFor('samus'));
    const again = parseTextMap(serializeTextMap(ROOM), 't');
    expect(again.heroItems).toEqual(ROOM.heroItems);
  });

  it('rejects a tile that is no power block, an unknown hero or item, and a hero twice', () => {
    const bad = (line: string) => () => parseTextMap(room() + '\n' + line, 't');
    expect(bad('3 3 samus=ice-beam')).toThrow(MapParseError);
    expect(bad('8 9 wario=ice-beam')).toThrow(/unknown hero/);
    expect(bad('8 9 samus=bomb-bag')).toThrow(/not one of samus/);
    expect(bad('8 9 samus=ice-beam samus=wave-beam')).toThrow(/twice/);
    expect(bad('5 9 link=grow')).toThrow(/second line/);
    expect(() =>
      parseTextMap(room().replace('[hero-items]', '[hero-items]\n8 9 link=grow mario=fire-flower'), 't'),
    ).not.toThrow();
  });

  it('every hero item id is unique to its hero, and each hero has one grow item listed first', () => {
    for (const [hero, h] of Object.entries(HERO_ITEMS)) {
      expect(h.items[0]?.id, hero).toBe(h.grow);
      expect(h.items.filter((i) => i.kind === 'grow').length, hero).toBe(1);
      expect(
        h.items.some((i) => i.id === h.defaultPower),
        hero,
      ).toBe(true);
    }
  });
});

describe('hero items: blocks in the campaign', () => {
  for (const def of HEROES_WITH_ITEMS) {
    it(`${def.name} gets the placed item from a placed block, the default from a blank one`, () => {
      const { w } = campaignWorld(def, { grown: true });
      const placed = strike(w, 5);
      expect(placed).toBeInstanceOf(HeroItem);
      expect((placed as HeroItem).item).toBe(placedFor(def.id));
      placed!.destroy();
      const blank = strike(w, 8);
      expect((blank as HeroItem).item).toBe(HERO_ITEMS[def.id]!.defaultPower);
    });

    it(`${def.name} small gets the grow item first, whatever the block's entry`, () => {
      const { w, p } = campaignWorld(def);
      expect(itemRules(def.id)!.small(p)).toBe(true);
      expect((strike(w, 5) as HeroItem).item).toBe(HERO_ITEMS[def.id]!.grow);
    });

    it(`${def.name}: a new item plays its own sound and is named; owned again it refills`, () => {
      const { w, p, sfx } = campaignWorld(def, { grown: true });
      const id = placedFor(def.id);
      const first = new HeroItem(5, 9, id, def.id);
      const before = w.state.score;
      w.takeHeroItem(p, first);
      expect(w.state.score - before).toBe(1000);
      expect(itemRules(def.id)!.owned(p, id) || id === 'ninpo-scroll').toBe(true);
      expect(sfx).toContain(itemSfx(id));
      expect(w.itemCaption?.text).toBe(
        HERO_ITEMS[def.id]!.items.find((i) => i.id === id)!.name.toUpperCase(),
      );
      expect(w.events.some((e) => e.type === 'say')).toBe(true);
      // Owned: the refill sound, no caption, a full refill.
      for (let i = 0; i < 4; i++) w.takeHeroItem(p, new HeroItem(5, 9, id, def.id));
      w.itemCaption = null;
      sfx.length = 0;
      if (p.def.damage.kind === 'hp') p.hp = 1;
      w.takeHeroItem(p, new HeroItem(5, 9, id, def.id));
      expect(sfx).toEqual([itemRules(def.id)!.refillSfx]);
      expect(w.itemCaption).toBeNull();
      if (p.def.damage.kind === 'hp') expect(p.hp).toBeGreaterThan(1);
    });
  }

  for (const def of HEROES_WITH_ITEMS) {
    it(`${def.name}: a grow-slot block once grown gives the next power item, never the grow item again (0.4.35)`, () => {
      const rules = itemRules(def.id)!;
      const items = HERO_ITEMS[def.id]!;
      const powers = items.items.filter((i) => i.kind === 'power').map((i) => i.id);
      // Small: the grow item first (SMB).
      expect((strike(campaignWorld(def).w, 17) as HeroItem).item).toBe(items.grow);
      /** A fresh room, the hero grown all the way (a stacking grow item at its maximum), owning `owned`. */
      const grown = (owned: readonly string[]) => {
        const { w, p } = campaignWorld(def);
        for (let i = 0; i < 10 && !rules.owned(p, items.grow); i++) rules.give(p, items.grow);
        expect(rules.owned(p, items.grow)).toBe(true);
        for (const id of owned) for (let i = 0; i < 4 && !rules.owned(p, id); i++) rules.give(p, id);
        return { w, p };
      };
      // Grown: SMB's big Mario gets the flower. The grow-slot block and the R block give the next
      // power item not owned, in docs/POWERUPS.md order, one after another.
      for (let n = 0; n < powers.length; n++) {
        const { w, p } = grown(powers.slice(0, n));
        const want = powers.find((id) => !rules.owned(p, id)) ?? items.defaultPower;
        expect((strike(w, 17) as HeroItem).item, `${n} owned`).toBe(want);
        w.entities.forEach((e) => e.destroy());
        expect((strike(w, 14) as HeroItem).item, `${n} owned, R`).toBe(want);
      }
      // Everything owned: the default power (its refill).
      expect((strike(grown(powers).w, 17) as HeroItem).item).toBe(items.defaultPower);
    });
  }

  it('hero items stay put on the block; only the Super Mushroom slides', () => {
    const { w } = campaignWorld(SAMUS, { grown: true });
    const item = strike(w, 8) as HeroItem;
    const x = item.body.x;
    for (let i = 0; i < 120; i++) w.update([NO_INPUT]);
    expect(item.alive && item.body.x).toBe(x);
    const mario = campaignWorld(MARIO);
    const shroom = strike(mario.w, 5) as PowerUp;
    expect(shroom).toBeInstanceOf(PowerUp);
    expect(shroom.item).toBe('mushroom');
  });

  it("Mario taking another hero's item gets SMB's item and 1000 points once (as in SMB)", () => {
    const { w, p } = campaignWorld(MARIO);
    const before = w.state.score;
    w.takeHeroItem(p, new HeroItem(5, 9, 'long-beam', 'samus', {}));
    expect(w.state.score - before).toBe(1000);
    expect(p.powerState).toBe('big');
  });

  it("the Top Secret Area's fixed blocks: R the grow item (until it is owned), W the entry or default power", () => {
    const { w } = campaignWorld(LINK, { grown: true });
    expect((strike(w, 14) as HeroItem).item).toBe('heart-container');
    w.entities.forEach((e) => e.destroy());
    expect((strike(w, 11) as HeroItem).item).toBe('bomb-bag');
  });

  it('classic play keeps the mushroom and the flower', () => {
    const { w } = campaignWorld(SAMUS, { classic: true });
    const e = strike(w, 5);
    expect(e).toBeInstanceOf(PowerUp);
  });

  it('a different hero taking the item gets their own item from the same block', () => {
    const { w } = campaignWorld(SAMUS, { grown: true });
    const item = strike(w, 5) as HeroItem;
    const other = campaignWorld(LINK, { grown: true });
    other.w.takeHeroItem(other.p, item);
    expect(has(other.p, placedFor('link'))).toBe(true);
  });
});

describe('hero items: what each hero starts with and finds', () => {
  it('Link starts with only the Boomerang and no magic meter; found tools join the belt', () => {
    const { p } = campaignWorld(LINK);
    expect(LINK.tools!(p).map((t) => t.id)).toEqual(['boomerang']);
    expect(LINK.meter!(p)).toBeNull();
    itemRules('link')!.give(p, 'bomb-bag');
    itemRules('link')!.give(p, 'fire-spell');
    expect(LINK.tools!(p).map((t) => t.id)).toEqual(['boomerang', 'bomb', 'fire']);
    expect(LINK.meter!(p)).not.toBeNull();
    // Classic Link keeps his whole belt.
    expect(LINK.tools!(campaignWorld(LINK, { classic: true }).p)).toHaveLength(5);
  });

  it('Simon and Ryu start with a 10-point bar; their grow item takes it to 16', () => {
    for (const id of ['simon', 'ryu']) {
      const def = characterById(id);
      const { p } = campaignWorld(def);
      expect(p.hp).toBe(10);
      itemRules(id)!.give(p, HERO_ITEMS[id]!.grow);
      expect(p.hp).toBe(16);
      expect(itemRules(id)!.small(p)).toBe(false);
    }
    expect(campaignWorld(SIMON, { classic: true }).p.hp).toBe(16);
  });

  it('Samus: six 10-energy reserve tanks shown as boxes; Ice and Wave both on the belt', () => {
    const { p } = campaignWorld(SAMUS);
    const rules = itemRules('samus')!;
    for (let i = 0; i < 8; i++) rules.give(p, 'energy-tank');
    expect(p.scratch.tanks).toBe(6);
    expect(p.hp).toBe(90);
    expect(SAMUS.energyTanks!(p)).toEqual({ full: 6, total: 6, bar: 30 });
    p.hp = 60;
    expect(SAMUS.energyTanks!(p)).toEqual({ full: 5, total: 6, bar: 10 });
    rules.give(p, 'ice-beam');
    rules.give(p, 'wave-beam');
    expect(SAMUS.tools!(p).map((t) => t.id)).toEqual(['beam', 'ice', 'wave']);
    rules.give(p, 'missiles');
    expect(p.scratch.missiles).toBe(10);
  });

  it('Mega Man: Rush is its own item, not the helmet', () => {
    const { p } = campaignWorld(MEGAMAN);
    itemRules('megaman')!.give(p, 'helmet');
    expect(MEGAMAN.tools!(p).map((t) => t.id)).toEqual([]);
    itemRules('megaman')!.give(p, 'rush-coil');
    itemRules('megaman')!.give(p, 'bolt');
    expect(MEGAMAN.tools!(p).map((t) => t.id)).toEqual(['bolt', 'rush']);
  });

  it('Sophia: the climbs are their own items, and a hit to Normal takes them', () => {
    const { w, p } = campaignWorld(SOPHIA, { grown: true });
    itemRules('sophia')!.give(p, 'wall-climb');
    expect(has(p, 'wall-climb')).toBe(true);
    p.invuln = 0;
    SOPHIA.behaviour.onHurt(p, w, 1);
    expect(p.powerState).toBe('small');
    expect(has(p, 'wall-climb')).toBe(false);
  });
});

describe('hero items: kits per hero, deaths and saves', () => {
  function campaignGame(hero = SAMUS) {
    const game = new Game({
      ctx: { assets: STUB_ASSETS, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
      getLevel,
      characters: CHARACTERS,
      announcer: { say: () => {} } as unknown as Announcer,
    });
    game.openFile(1, newSave(1, hero.id));
    return game;
  }

  it('a new file starts its hero with the basic kit', () => {
    const game = campaignGame(SIMON);
    expect(isFound({ scratch: game.state.kit })).toBe(true);
    expect(game.state.hp).toBe(10);
  });

  it("each hero's kit persists across switches; a new hero starts with the basic kit", () => {
    const game = campaignGame(SAMUS);
    game.state.kit = { ...game.state.kit, 'has-ice-beam': 1, tanks: 2, maxHp: 50 };
    game.state.hp = 44;
    game.setHero(0, LINK);
    expect(game.state.kit).toEqual(heroStart(LINK).kit);
    game.state.kit['has-bomb-bag'] = 1;
    game.setHero(0, SAMUS);
    expect(game.state.kit['has-ice-beam']).toBe(1);
    expect(game.state.hp).toBe(44);
    game.setHero(0, LINK);
    expect(game.state.kit['has-bomb-bag']).toBe(1);
    // Saved on the file and read back.
    game.autosave();
    const saved = (game as unknown as { campaignSave: unknown }).campaignSave;
    const reread = migrateSave(JSON.parse(JSON.stringify(saved)), 1)!;
    expect(reread.heroKits?.samus?.kit['has-ice-beam']).toBe(1);
  });

  it("a death wipes the played hero's found items, not the others' saved kits", () => {
    const game = campaignGame(SAMUS);
    game.state.kit['has-ice-beam'] = 1;
    game.setHero(0, LINK);
    game.state.kit['has-bomb-bag'] = 1;
    game.resetAfterDeath();
    expect(game.state.kit).toEqual(heroStart(LINK).kit);
    game.setHero(0, SAMUS);
    expect(game.state.kit['has-ice-beam']).toBe(1);
  });

  it('the inventory goes with the hero being played', () => {
    const game = campaignGame(SAMUS);
    game.bonus.inventory.push('mushroom');
    game.setHero(0, LINK);
    expect(game.bonus.inventory).toEqual([]);
    game.setHero(0, SAMUS);
    expect(game.bonus.inventory).toEqual(['mushroom']);
  });
});

describe('hero items: migrations', () => {
  it("an older file's kits convert to found items in their old order", () => {
    expect(campaignKit('megaman', { helmet: 1, weapons: 2 })).toEqual({
      helmet: 1,
      found: 1,
      'has-saw-disc': 1,
      'has-leaf-guard': 1,
      'has-rush-coil': 1,
    });
    const samus = campaignKit('samus', { varia: 1, tanks: 2, maxHp: 90, beam: 2, missiles: 4 });
    expect(samus).toMatchObject({
      tanks: 6,
      maxHp: 90,
      'has-long-beam': 1,
      'has-ice-beam': 1,
      'has-missiles': 1,
    });
    expect(samus.beam).toBeUndefined();
    expect(campaignKit('simon', { whip: 2, multi: 2, subs: 2 })).toMatchObject({
      'has-chain-whip': 1,
      'has-morning-star': 1,
      'has-double-shot': 1,
      'has-dagger': 1,
      'has-axe': 1,
    });
    expect(campaignKit('ryu', { arts: 1, ninpoMax: 80 })).toMatchObject({
      'has-throwing-star': 1,
      scrolls: 2,
    });
    expect(campaignKit('bill', { guns: 1 })).toMatchObject({ 'has-machine-gun': 1 });
    expect(campaignKit('link', {})).toMatchObject({ 'has-bomb-bag': 1, 'has-fire-spell': 1 });
    expect(campaignKit('sophia', {}, 'fire')).toMatchObject({ 'has-wall-climb': 1, 'has-ceiling-climb': 1 });
    // Already converted: unchanged.
    expect(campaignKit('samus', { found: 1, tanks: 2 })).toEqual({ found: 1, tanks: 2 });
  });

  it("an older file's single inventory moves to Mario, whoever the file's hero is", () => {
    const old = { ...newSave(1, 'samus'), inventory: ['star', 'flower'], itemsNext: ['mushroom'] } as Record<
      string,
      unknown
    >;
    delete old.heroInventory;
    delete old.heroItemsNext;
    const s = migrateSave(old, 1)!;
    expect(s.heroInventory).toEqual({ mario: ['star', 'flower'] });
    expect(s.heroItemsNext).toEqual({ mario: ['mushroom'] });
    expect('inventory' in s).toBe(false);
    const b = bonusStateFrom(s, 'samus');
    expect(b.inventory).toEqual([]);
    swapInventory(b, 'mario');
    expect(b.inventory).toEqual(['star', 'flower']);
    expect(bonusSaveFields(b).heroInventory).toEqual({ mario: ['star', 'flower'] });
  });

  it('loading a migrated file again changes nothing (both migrations are idempotent)', () => {
    const old = {
      ...newSave(1, 'samus'),
      kit: { varia: 1, tanks: 2, maxHp: 90, beam: 3, missiles: 7 },
      hp: 90,
      powerState: 'full',
      inventory: ['mushroom'],
      itemsNext: ['flower'],
    } as Record<string, unknown>;
    delete old.heroInventory;
    delete old.heroItemsNext;
    delete old.heroKits;
    const once = migrateSave(JSON.parse(JSON.stringify(old)), 1)!;
    const twice = migrateSave(JSON.parse(JSON.stringify(once)), 1)!;
    expect(twice).toEqual(once);
    expect(once.hp).toBe(90);
    expect(once.kit).toMatchObject({ tanks: 6, 'has-wave-beam': 1, missiles: 7 });
  });

  it('odd saved kits load safely: unknown heroes and bad fields dropped, no hero at 0 hit points', () => {
    const save = {
      ...newSave(1, 'mario'),
      heroKits: {
        simon: { powerState: 'full', hp: 0, kit: { found: 1, maxHp: 10, junk: 'x' } },
        ryu: { powerState: 'full', hp: -3, kit: null },
        nobody: { powerState: 'full', hp: 5, kit: {} },
        link: 'broken',
        samus: { powerState: 'big', hp: 30, kit: {} },
      },
      heroInventory: { link: ['star', 'bogus'], nobody: ['star'], samus: 'x' },
    } as unknown as Record<string, unknown>;
    const s = migrateSave(save, 1)!;
    expect(Object.keys(s.heroKits!).sort()).toEqual(['ryu', 'simon']);
    expect(s.heroKits!.simon).toEqual({ powerState: 'full', hp: 10, kit: { found: 1, maxHp: 10 } });
    expect(s.heroKits!.ryu!.hp).toBeGreaterThan(0);
    expect(s.heroInventory).toEqual({ link: ['star'] });
  });

  it('a kit carried through a level keeps its found flags', () => {
    const { p } = campaignWorld(SAMUS);
    expect(carriedKit(p).found).toBe(1);
  });
});
