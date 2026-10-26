import { describe, expect, it } from 'vitest';
import { px } from '@engine/math/units';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { LINK } from '@game/characters/link';
import { MEGAMAN } from '@game/characters/megaman';
import { heroFor } from '@game/characters/registry';
import { MARIO_CLASSIC } from '@game/characters/mario/classic';
import { FIREBALL_CLASSIC } from '@game/characters/mario/classic-weapons';
import { FIREBALL, Projectile } from '@game/entities/projectiles/projectile';
import { Bowser } from '@game/entities/enemies/bowser';
import { powerIcon } from '@game/hud/hud';
import { T } from '@game/level/tiles';
import { flatLevel, Rig } from './classic-plumber-harness';

// Hero rules part 1 together (Mario, Luigi, Link, Mega Man): what the shared systems give each
// Classic def once all of them are registered.

const HEROES = [MARIO, LUIGI, LINK, MEGAMAN];

describe('hero rules part 1', () => {
  it('each plays its Classic def under Classic rules and its Campaign def under Campaign', () => {
    for (const h of HEROES) {
      const c = heroFor(h, 'classic');
      expect(c, h.id).not.toBe(h);
      expect(c.rules).toBe('classic');
      expect(heroFor(h, 'campaign')).toBe(h);
      expect(h.powerIcon).toBeUndefined();
    }
  });

  it('each Classic def shows the Mushroom or Fire Flower icon on the HUD (PS-C26)', () => {
    for (const h of HEROES) {
      const r = new Rig(h, flatLevel(), 'classic', 'big');
      expect(powerIcon(r.p), h.id).toBe('icon-mushroom');
      r.p.powerState = 'fire';
      expect(powerIcon(r.p), h.id).toBe('icon-flower');
      r.p.powerState = 'small';
      expect(powerIcon(r.p), h.id).toBeNull();
      const cur = new Rig(h, flatLevel(), 'campaign', h.damage.kind === 'hp' ? 'full' : 'big');
      expect(powerIcon(cur.p), h.id).toBeNull();
    }
  });

  it("the Classic fireball treats bricks and ? blocks as ground (BR-C2); Campaign's is unchanged", () => {
    expect(FIREBALL_CLASSIC.classicBlocks).toEqual({
      ground: 'collide',
      afterBlock: 'end',
      strikesBlocks: false,
    });
    expect(FIREBALL.classicBlocks).toBeUndefined();
    const r = new Rig(MARIO, flatLevel({ 11: '..........=', 12: '..........=' }), 'classic', 'fire');
    r.settle();
    r.p.body.x = px(8 * 16);
    for (let i = 0; i < 60; i++) r.step(i % 12 === 0 ? ['attack'] : []);
    expect(r.world.map.get(10, 11)).toBe(T.BRICK);
    expect(r.world.map.get(10, 12)).toBe(T.BRICK);
  });

  it('Bowser takes 5 Classic fireballs in every form (5000 HP against Mario, 1000 each)', () => {
    for (const form of ['fire', 'hammer', 'both'] as const) {
      const r = new Rig(MARIO, flatLevel(), 'classic', 'fire');
      r.settle();
      expect(r.p.def).toBe(MARIO_CLASSIC);
      const bw = new Bowser(px(20 * 16), px(10 * 16), form);
      r.world.spawn(bw);
      // The hit a Classic fireball deals (World.projectile's source for it).
      const shot = new Projectile(0, 0, 1, FIREBALL_CLASSIC, r.p);
      let hits = 0;
      const hp: number[] = [];
      while (bw.alive && hits < 10) {
        bw.invulnFrames = 0;
        bw.hit(
          {
            kind: 'fireball',
            amount: FIREBALL_CLASSIC.amount,
            owner: shot,
            dirX: 1,
            ...FIREBALL_CLASSIC.classicHit,
          },
          r.world,
        );
        hits++;
        hp.push(bw.classicHp ?? -1);
      }
      expect(hp.slice(0, 4), form).toEqual([4000, 3000, 2000, 1000]);
      expect(hits, form).toBe(5);
    }
  });
});
