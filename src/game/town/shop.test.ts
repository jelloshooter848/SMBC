import { describe, expect, it } from 'vitest';
import { newGameState, type GameState } from '../context';
import type { CharacterDef } from '../characters/character';
import { CHARACTERS, characterById } from '../characters/registry';
import { heroStart } from '../items/heroes';
import { has } from '../items/flags';
import { HERO_ITEMS, itemInfo } from '../items/catalog';
import { MAX_LIVES } from '../bonus/use';
import {
  PRICES,
  SHOP_STOCK,
  WALLET_LIFE_PRICE,
  buy,
  shopEntries,
  newShopVisit,
  type ShopEntry,
  type ShopSlot,
} from './shop';

// Kakariko's shop (0.4.42, the approved design's release 2, docs/POWERUPS.md "Kakariko shop"):
// each hero's stock is placed, not worked out (their grow item, one World 2 power item, a refill
// where they have one, the 1-up), at fixed prices. Purchases go through the power blocks' item
// code (applyItem) into the hero's carried kit.

const hero = (id: string) => characterById(id) as CharacterDef;

/** A campaign run with `id` as the hero, on their basic kit, `coins` in hand. */
function run(id: string, coins = 99, wallet = false): GameState {
  const c = hero(id);
  const s = newGameState(c);
  const start = heroStart(c);
  s.powerState = start.powerState;
  s.hp = start.hp;
  s.kit = { ...start.kit };
  s.coins = coins;
  s.wallet = wallet;
  return s;
}

const entry = (s: GameState, slot: ShopSlot, visit = newShopVisit()): ShopEntry | undefined =>
  shopEntries(s, visit).find((e) => e.slot === slot);

/** Buys `slot` and expects it to go through. */
function bought(s: GameState, slot: ShopSlot, visit = newShopVisit()): void {
  const out = buy(s, visit, slot);
  expect(out.kind, `${s.character.id} ${slot}`).toBe('bought');
}

describe("the shop's stock: placed per hero, as the design's table", () => {
  it('every hero has a stock: their grow item, one power item, a refill where they have one', () => {
    expect(Object.keys(SHOP_STOCK).sort()).toEqual(CHARACTERS.map((c) => c.id).sort());
    const table = Object.fromEntries(
      Object.entries(SHOP_STOCK).map(([id, s]) => [id, [s.grow, s.power, s.refill !== null]]),
    );
    expect(table).toEqual({
      mario: ['mushroom', 'fire-flower', false],
      luigi: ['mushroom', 'fire-flower', false],
      link: ['heart-container', 'shield-spell', true],
      megaman: ['helmet', 'rush-coil', true],
      samus: ['energy-tank', 'ice-beam', true],
      simon: ['pot-roast', 'holy-water', true],
      ryu: ['medicine', 'windmill', true],
      bill: ['medal', 'machine-gun', false],
      sophia: ['power-capsule', 'triple-missile', true],
    });
    for (const [id, s] of Object.entries(SHOP_STOCK)) {
      expect(s.grow, id).toBe(HERO_ITEMS[id]?.grow);
      expect(itemInfo(id, s.power)?.kind, id).toBe('power');
    }
  });

  it('prices: refill 10, grow 20, power 40, 1-up 50 (100 with the Wallet)', () => {
    expect(PRICES).toEqual({ refill: 10, grow: 20, power: 40, life: 50 });
    expect(WALLET_LIFE_PRICE).toBe(100);
    const s = run('link');
    const prices = shopEntries(s, newShopVisit()).map((e) => [e.slot, e.price]);
    expect(prices).toEqual([
      ['grow', 20],
      ['power', 40],
      ['refill', 10],
      ['life', 50],
    ]);
    s.wallet = true;
    expect(entry(s, 'life')?.price).toBe(100);
  });

  it('Mario, Luigi and Bill show three tables (no refill); the rest four', () => {
    for (const c of CHARACTERS) {
      const slots = shopEntries(run(c.id), newShopVisit()).map((e) => e.slot);
      const three = ['mario', 'luigi', 'bill'].includes(c.id);
      expect(slots, c.id).toEqual(three ? ['grow', 'power', 'life'] : ['grow', 'power', 'refill', 'life']);
    }
  });

  it('each table names the item and says what it does', () => {
    const s = run('samus');
    const power = entry(s, 'power') as ShopEntry;
    expect(power.name).toBe('Ice Beam');
    expect(power.does).toBe('it freezes what it hits');
    expect(entry(s, 'life')?.name).toBe('1-Up');
    expect(entry(s, 'refill')?.name).toBe('Missile Pack');
  });
});

describe('the greying rules', () => {
  it('a small hero gets the grow item first: the power item is GROW FIRST until then', () => {
    for (const c of CHARACTERS) {
      const s = run(c.id);
      expect(entry(s, 'grow')?.mark, c.id).toBe(null);
      expect(entry(s, 'power')?.mark, c.id).toBe('GROW FIRST');
      const out = buy(s, newShopVisit(), 'power');
      expect(out, c.id).toEqual({ kind: 'refused', mark: 'GROW FIRST' });
      expect(s.coins, c.id).toBe(99);
      bought(s, 'grow');
      expect(entry(s, 'power')?.mark, c.id).toBe(null);
    }
  });

  it('an owned power item, or a single grow item owned, is SOLD OUT', () => {
    for (const c of CHARACTERS) {
      const s = run(c.id);
      bought(s, 'grow');
      bought(s, 'power');
      expect(entry(s, 'power')?.mark, c.id).toBe('SOLD OUT');
      expect(buy(s, newShopVisit(), 'power'), c.id).toEqual({ kind: 'refused', mark: 'SOLD OUT' });
    }
    const mario = run('mario');
    bought(mario, 'grow');
    expect(mario.powerState).toBe('big');
    expect(entry(mario, 'grow')?.mark).toBe('SOLD OUT');
    bought(mario, 'power');
    expect(mario.powerState).toBe('fire');
    const mm = run('megaman');
    bought(mm, 'grow');
    expect(mm.kit.helmet).toBe(1);
    expect(entry(mm, 'grow')?.mark).toBe('SOLD OUT');
  });

  it('a stacking grow item at its maximum is FULL', () => {
    for (const id of ['link', 'samus', 'bill']) {
      const s = run(id, 999, true);
      for (let i = 0; i < 12 && entry(s, 'grow')?.mark === null; i++) bought(s, 'grow');
      expect(entry(s, 'grow')?.mark, id).toBe('FULL');
      expect(buy(s, newShopVisit(), 'grow'), id).toEqual({ kind: 'refused', mark: 'FULL' });
    }
  });

  it('a refill with nothing to fill (its ammo item not owned yet, or full) is FULL', () => {
    // Samus starts with no missiles; once she has them a pack adds ten, up to her maximum.
    const s = run('samus', 999, true);
    expect(entry(s, 'refill')?.mark).toBe('FULL');
    s.kit = { ...s.kit, 'has-missiles': 1, missiles: 5 };
    expect(entry(s, 'refill')?.mark).toBe(null);
    bought(s, 'refill');
    expect(s.kit.missiles).toBe(15);
    for (let i = 0; i < 5 && entry(s, 'refill')?.mark === null; i++) bought(s, 'refill');
    expect(entry(s, 'refill')?.mark).toBe('FULL');
    // Link: bombs to 8 and full magic.
    const link = run('link');
    link.kit = { ...link.kit, 'has-bomb-bag': 1, bombs: 2 };
    bought(link, 'refill');
    expect(link.kit.bombs).toBe(8);
    expect(entry(link, 'refill')?.mark).toBe('FULL');
    // Simon: hearts for a sub-weapon; none owned, nothing to fill.
    const simon = run('simon');
    expect(entry(simon, 'refill')?.mark).toBe('FULL');
    simon.kit = { ...simon.kit, 'has-dagger': 1, hearts: 3 };
    bought(simon, 'refill');
    expect(simon.kit.hearts).toBe(13);
  });

  it("each hero's refill fills what it says, whenever there is something to fill", () => {
    const mm = run('megaman');
    mm.kit = { ...mm.kit, 'has-saw-disc': 1, wsaw: 4 };
    bought(mm, 'refill');
    expect(mm.kit.wsaw).toBe(28);
    const ryu = run('ryu');
    ryu.kit = { ...ryu.kit, 'has-throwing-star': 1, ninpo: 3 };
    bought(ryu, 'refill');
    expect(ryu.kit.ninpo).toBe(40);
    const sophia = run('sophia');
    sophia.kit = { ...sophia.kit, hasTriple: 1, triple: 1 };
    bought(sophia, 'refill');
    expect(sophia.kit.triple).toBe(13);
  });
});

describe('coins', () => {
  it('too few coins: nothing is bought, and the shopkeeper says how many it takes', () => {
    const s = run('link', 39);
    expect(buy(s, newShopVisit(), 'grow')).toMatchObject({ kind: 'bought' });
    expect(s.coins).toBe(19);
    const kit = { ...s.kit };
    expect(buy(s, newShopVisit(), 'power')).toEqual({ kind: 'short', price: 40 });
    expect(s.coins).toBe(19);
    expect(s.kit).toEqual(kit);
  });

  it('a purchase costs its price and lands in the hero carried kit (the power blocks code)', () => {
    const s = run('link', 60);
    bought(s, 'grow');
    expect(s.coins).toBe(40);
    expect(s.kit.maxHp).toBe(8);
    expect(s.hp).toBe(8);
    bought(s, 'power');
    expect(s.coins).toBe(0);
    expect(has({ scratch: s.kit }, 'shield-spell')).toBe(true);
    expect(s.kit.found).toBe(1);
  });
});

describe('the 1-up', () => {
  it('without the Wallet: 50 coins, one per visit (SOLD OUT for the rest of it)', () => {
    const s = run('mario', 99);
    const visit = newShopVisit();
    expect(buy(s, visit, 'life')).toMatchObject({ kind: 'bought' });
    expect(s.lives).toBe(4);
    expect(s.coins).toBe(49);
    expect(entry(s, 'life', visit)?.mark).toBe('SOLD OUT');
    s.coins = 99;
    expect(buy(s, visit, 'life')).toEqual({ kind: 'refused', mark: 'SOLD OUT' });
    // Switching heroes changes nothing: one a visit is the shop's rule.
    s.character = hero('link');
    expect(entry(s, 'life', visit)?.mark).toBe('SOLD OUT');
    // The next visit has one again.
    expect(entry(s, 'life', newShopVisit())?.mark).toBe(null);
  });

  it('with the Wallet: 100 coins, as many as you like', () => {
    const s = run('mario', 350, true);
    const visit = newShopVisit();
    for (let i = 0; i < 3; i++) expect(buy(s, visit, 'life')).toMatchObject({ kind: 'bought' });
    expect(s.lives).toBe(6);
    expect(s.coins).toBe(50);
    expect(entry(s, 'life', visit)?.mark).toBe(null);
    expect(buy(s, visit, 'life')).toEqual({ kind: 'short', price: 100 });
  });

  it('lives at their maximum: FULL', () => {
    const s = run('mario', 99);
    s.lives = MAX_LIVES;
    expect(entry(s, 'life')?.mark).toBe('FULL');
  });
});
