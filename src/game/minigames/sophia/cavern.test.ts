import { beforeEach, describe, expect, it } from 'vitest';
import { px, tileToSub } from '@engine/math/units';
import { MARIO } from '@game/characters/mario';
import { tileDef } from '../../level/tiles';
import { areaStage, atGateway, onFoot } from './area';
import { Crawler, Flyer, FLYER_SWOOP, Hopper, HOPPER_REST } from './cavern';
import { GATEWAY_FRAMES, LIVES } from './scene';
import { underworldHarness } from './harness';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

/** The cavern played as a stand-in hero (Mario) until S1's Sophia is registered. */
function cavern() {
  const h = underworldHarness({ keep: true, startInArea: true, areaHero: MARIO });
  const area = () => h.scene.area!;
  return { h, area };
}

const solid = (x: number, y: number) => {
  const l = areaStage().level;
  return tileDef(l.tiles[y * l.width + x] ?? 0).collision === 'solid';
};

describe('Underworld: the tank’s cavern (section 1)', () => {
  it('ends at the gateway on a ledge reached only up a shaft one tile wide (too narrow for the 19-px tank)', () => {
    const a = areaStage();
    expect(a.level.theme).toBe('underworld');
    expect(a.level.music).toBe('bm-area');
    // The shaft: one free column between solid ones, from the floor's air up to the ledge.
    for (let y = 5; y <= 10; y++) {
      expect(solid(a.shaftX, y), `shaft row ${y}`).toBe(false);
      expect(solid(a.shaftX - 1, y), `left wall row ${y}`).toBe(true);
    }
    for (let y = 7; y <= 12; y++) expect(solid(a.shaftX + 1, y), `ledge block row ${y}`).toBe(true);
    // The ledge is roofed over: nothing gets onto it from above.
    for (let x = a.shaftX + 1; x < a.level.width; x++) expect(solid(x, 4)).toBe(true);
    // The doorway is on the ledge (rows 5-6), far from the floor.
    expect(a.door.y).toBeGreaterThanOrEqual(5 * 16);
    expect(a.door.y + a.door.h).toBeLessThanOrEqual(7 * 16);
    // A brick wall under a low roof: the cannon has to break it.
    const bricks = a.level.tiles.filter((t) => tileDef(t).name === 'brick').length;
    expect(bricks).toBeGreaterThanOrEqual(8);
  });

  it('starts the cavern after the cutscene when there is a hero for it, with its music and words', () => {
    const h = underworldHarness({ keep: true, areaHero: MARIO });
    h.tap('jump');
    expect(h.scene.phase).toBe('area');
    expect(h.log.music.at(-1)).toBe('bm-area');
    expect(h.said.at(-1)).toMatch(/cannon.*gateway.*Jason on foot/);
    expect(h.scene.touchLabels().start).toBe('MENU');
    // Without one (S1's Sophia not registered), straight to the dungeon.
    const h2 = underworldHarness({ keep: true, areaHero: null });
    h2.tap('jump');
    expect(h2.scene.phase).toBe('dungeon');
  });

  it('a hero on foot climbs the ladder up the shaft and walks into the gateway: the dungeon', () => {
    const { h, area } = cavern();
    h.game.ctx.assist.invulnerable = true;
    const w = area();
    const p = w.player;
    p.body.x = tileToSub(66);
    w.camera.x = tileToSub(60);
    w.spawnInView();
    for (let i = 0; i < 60; i++) h.step(['right']);
    expect(p.body.x >> 12).toBe(areaStage().shaftX);
    for (let i = 0; i < 200; i++) h.step(['up']);
    expect(p.body.y >> 12).toBeLessThanOrEqual(6);
    h.step([], 4);
    for (let i = 0; i < 200 && h.scene.phase === 'area'; i++) h.step(['right']);
    expect(h.scene.phase).toBe('gateway');
    expect(atGateway(p)).toBe(true);
    h.step([], GATEWAY_FRAMES);
    expect(h.scene.phase).toBe('dungeon');
    expect(h.scene.area).toBeNull();
  });

  it('the tank is not on foot until Jason hops out (S1’s flag); every other hero always is', () => {
    const { area } = cavern();
    const p = area().player;
    expect(onFoot(p)).toBe(true);
    const tank = Object.assign(Object.create(Object.getPrototypeOf(p) as object), p, {
      def: { ...p.def, id: 'sophia' },
      scratch: {},
    });
    expect(onFoot(tank)).toBe(false);
    tank.scratch.jason = 1;
    expect(onFoot(tank)).toBe(true);
  });

  it('a life lost in the cavern starts again (from the checkpoint once past it); out of lives, GAME OVER', () => {
    const { h, area } = cavern();
    const first = area();
    first.kill(first.player);
    for (let i = 0; i < 400 && h.scene.area === first; i++) h.step();
    expect(h.scene.lives).toBe(LIVES - 1);
    expect(h.scene.area).not.toBe(first);
    expect(h.scene.area!.player.body.x >> 12).toBe(areaStage().level.start.x);
    // Past the checkpoint: the next life starts there.
    const w = area();
    w.player.body.x = tileToSub(areaStage().checkpointX + 2);
    h.step();
    w.kill(w.player);
    for (let i = 0; i < 400 && h.scene.area === w; i++) h.step();
    expect(h.scene.area!.player.body.x >> 12).toBe(areaStage().checkpointX);
    const last = area();
    last.kill(last.player);
    for (let i = 0; i < 400 && h.scene.phase === 'area'; i++) h.step();
    expect(h.scene.phase).toBe('lost');
  });
});

describe('Underworld: the cavern’s mutants', () => {
  it('a crawler creeps along the floor and turns at a ledge', () => {
    const { h, area } = cavern();
    h.game.ctx.assist.invulnerable = true;
    const w = area();
    const c = new Crawler(tileToSub(43), tileToSub(10) - px(10)); // on the ledge (40-45, row 10)
    w.spawn(c);
    const xs: number[] = [];
    for (let i = 0; i < 400; i++) {
      h.step();
      xs.push(c.body.x >> 12);
    }
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(40);
    expect(Math.max(...xs)).toBeLessThanOrEqual(45);
    expect(new Set(xs).size).toBeGreaterThan(3);
  });

  it('a hopper crouches, then leaps at the player when near', () => {
    const { h, area } = cavern();
    h.game.ctx.assist.invulnerable = true;
    const w = area();
    const hop = new Hopper(w.player.body.x + px(64), tileToSub(13) - px(14));
    w.spawn(hop);
    let leapt = false;
    for (let i = 0; i < HOPPER_REST + 30; i++) {
      h.step();
      if (!hop.body.onGround && hop.body.vy < 0) leapt = true;
    }
    expect(leapt).toBe(true);
    expect(hop.facing).toBe(-1);
  });

  it('a flyer hovers, then swoops at the player and climbs back', () => {
    const { h, area } = cavern();
    h.game.ctx.assist.invulnerable = true;
    const w = area();
    const f = new Flyer(w.player.body.x + px(80), tileToSub(6));
    w.spawn(f);
    const y0 = f.body.y;
    let low = y0;
    for (let i = 0; i < 40 + FLYER_SWOOP; i++) {
      h.step();
      low = Math.max(low, f.body.y);
    }
    expect(low - y0).toBeGreaterThan(px(24));
  });

  it('shots hurt them (two hits for a crawler); stomps do nothing', () => {
    const { h, area } = cavern();
    const w = area();
    const c = new Crawler(tileToSub(8), tileToSub(13) - px(10));
    w.spawn(c);
    h.step();
    const src = { kind: 'buster' as const, amount: 1, owner: null, dirX: 1 as const };
    expect(c.hit(src, w)).toBe('hp');
    expect(c.alive).toBe(true);
    c.hit(src, w);
    expect(c.alive).toBe(false);
    expect(c.stompable).toBe(false);
  });
});
