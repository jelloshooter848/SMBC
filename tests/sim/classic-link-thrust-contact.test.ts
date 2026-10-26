import { describe, expect, it } from 'vitest';
import { px, velToSub } from '@engine/math/units';
import { LINK } from '@game/characters/link';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import { Podoboo } from '@game/entities/enemies/podoboo';
import type { Enemy } from '@game/entities/enemies/enemy';
import { runSim } from '@game/sim/headless';
import type { Action } from '@engine/input/actions';
import type { World } from '@game/world/world';
import { flatLevel } from './classic-plumber-harness';

/*
 * v0.4.73 item 104 (owner bug): Classic Link's down-thrust hurt him when he landed a little off
 * centre on an enemy: the sword box is 4 px wide, his hurt box 13.5, and only an overlapping sword
 * box spared him the body contact. The original (Link.hitEnemy, Link.as:1077-1094): body contact
 * on his bottom side while down-thrusting (or his top side while up-thrusting) is landAttack,
 * which attacks and bounces and never takes damage; a still or just-kicked shell is the exception.
 */

type Rules = 'classic' | 'campaign';
interface Result {
  hits: number;
  hurt: boolean;
  bounced: boolean;
  contact: boolean;
  /** Hurt on the frame it first touches it, or the next (not later, off the ground or a second pass). */
  hurtAtContact: boolean;
}

/** The enemy, held still where it is put (an enemy that walks off would muddy the sweep). */
function hold(e: Enemy, x: number, y: number): void {
  e.body.x = x;
  e.body.y = y;
  e.body.vx = 0;
  e.body.vy = 0;
}

/**
 * Link (big) at centre offset `dx` px from the enemy's centre: 'down' falls onto it from above
 * holding Down; 'up' jumps into it from below holding Up (the enemy held in the air).
 */
function thrust(
  dir: 'down' | 'up',
  dx: number,
  rules: Rules = 'classic',
  make: () => Enemy = () => new Goomba(0, 0),
): Result {
  const e = make();
  const ex = px(20 * 16 + 2);
  const ey = dir === 'down' ? px(13 * 16) - e.body.h : px(9 * 16) - e.body.h;
  const res: Result = { hits: 0, hurt: false, bounced: false, contact: false, hurtAtContact: false };
  let touchedAt = -1;
  let hitY: number | null = null;
  const hit = e.hit.bind(e);
  e.hit = (src, w) => {
    res.hits++;
    hitY ??= w.player.body.y;
    return hit(src, w);
  };
  runSim({
    level: flatLevel({}, 60),
    character: LINK,
    rules,
    script: { steps: [] },
    maxFrames: 90,
    state: { powerState: 'big' },
    controller: (w: World, f: number): Action[] => {
      const p = w.player;
      const b = p.body;
      if (f === 0) {
        w.spawn(e);
        e.activated = true;
        b.x = ex + (e.body.w >> 1) + px(dx) - (b.w >> 1);
        b.y = dir === 'down' ? ey - px(40) - b.h : px(13 * 16) - b.h;
        b.vx = 0;
        b.vy = 0;
        b.onGround = dir === 'up';
      }
      if (e.alive && res.hits === 0 && !res.contact) hold(e, ex, ey);
      if (p.invuln > 0 || p.powerState !== 'big') res.hurt = true;
      const hb = p.hurtBody();
      const over =
        hb.x < e.body.x + e.body.w &&
        hb.x + hb.w > e.body.x &&
        hb.y < e.body.y + e.body.h &&
        hb.y + hb.h > e.body.y;
      if (over || res.hits > 0) res.contact = true;
      if (res.contact && touchedAt < 0) touchedAt = f;
      if (touchedAt >= 0 && f <= touchedAt + 1 && (p.invuln > 0 || p.powerState !== 'big'))
        res.hurtAtContact = true;
      // After the hit: down, back up off it (the thrust bounce); up, the rise stopped.
      if (hitY !== null && dir === 'down' && b.y < hitY - px(4)) res.bounced = true;
      if (hitY !== null && dir === 'up' && b.vy >= 0) res.bounced = true;
      if (dir === 'down') return f >= 1 ? ['down'] : [];
      return f === 1 ? ['jump', 'up'] : f > 1 && f < 40 ? ['jump', 'up'] : [];
    },
  });
  return res;
}

/** Centre offsets (px) at which his hurt box and the enemy's body overlap, both sides, by 0.5. */
function sweep(enemyW = 12): number[] {
  const reach = (13.5 + enemyW) / 2;
  const out: number[] = [];
  for (let dx = -reach + 0.5; dx < reach; dx += 0.5) out.push(dx);
  return out;
}

describe('item 104: Classic Link thrusts by body contact', () => {
  it('down-thrust onto a still Goomba at every overlapping offset: hit, never hurt, bounces', () => {
    const bad: string[] = [];
    for (const dx of sweep()) {
      const r = thrust('down', dx);
      if (!r.contact) continue;
      if (r.hits === 0 || r.hurt || !r.bounced) bad.push(`${dx}: ${JSON.stringify(r)}`);
    }
    expect(bad).toEqual([]);
  });

  it('every overlapping offset makes contact (the sweep covers the whole overlap)', () => {
    const none = sweep().filter((dx) => !thrust('down', dx).contact);
    expect(none).toEqual([]);
  });

  it('up-thrust into a Goomba held above at every overlapping offset: hit, never hurt, stops rising', () => {
    const bad: string[] = [];
    for (const dx of sweep()) {
      const r = thrust('up', dx);
      if (!r.contact) bad.push(`${dx}: no contact`);
      else if (r.hits === 0 || r.hurt || !r.bounced) bad.push(`${dx}: ${JSON.stringify(r)}`);
    }
    expect(bad).toEqual([]);
  });

  it('a still shell stays the exception: no thrust hit on it, plain body contact (it is kicked, as before)', () => {
    const shell = () => {
      const k = new Koopa(0, 0, 'green');
      k.stopShell();
      return k;
    };
    for (const dx of [-8, 0, 8]) {
      const r = thrust('down', dx, 'classic', shell);
      expect(r.contact, `${dx}`).toBe(true);
      // Body contact as usual (Link.hitEnemy skips landAttack for it): the shell is kicked.
      expect(r.hits, `${dx}`).toBe(0);
    }
  });

  it('a Podoboo (immune to the sword) is plain contact: landing on it off the sword box hurts', () => {
    for (const dx of [-10, 9, 10]) {
      const r = thrust('down', dx, 'classic', () => new Podoboo(0, 0));
      expect(r.contact, `${dx}`).toBe(true);
      expect(r.hurtAtContact, `${dx}`).toBe(true);
    }
  });

  it('jumping into an enemy from the side while holding Up hurts (not from below)', () => {
    // The review's case: rising with the up-thrust on, a sliver of overlap at his front, his head
    // 8 px below the enemy's top. Side contact, so a hurt (the original's takeDamage).
    for (const facing of [1, -1] as const) {
      const e = new Goomba(0, 0);
      let placed = -1;
      let hurt = false;
      let hits = 0;
      const hit = e.hit.bind(e);
      e.hit = (src, w) => {
        hits++;
        return hit(src, w);
      };
      runSim({
        level: flatLevel({}, 60),
        character: LINK,
        rules: 'classic',
        script: { steps: [] },
        maxFrames: 40,
        state: { powerState: 'big' },
        controller: (w: World, f: number): Action[] => {
          const p = w.player;
          const b = p.body;
          if (f === 0) {
            w.spawn(e);
            e.activated = true;
            hold(e, px(40 * 16), px(5 * 16));
            p.facing = facing;
          }
          // Late in the rise (under 3 px a frame), as in the review's case.
          if (placed < 0 && p.scratch.upThrust && b.vy < 0 && velToSub(-b.vy) < px(3)) {
            placed = f;
            const hb = p.hurtBody();
            const x = facing > 0 ? hb.x + hb.w - px(0.5) : hb.x - e.body.w + px(0.5);
            hold(e, x, hb.y - px(8));
          } else if (placed >= 0) hold(e, e.body.x, e.body.y);
          if (placed >= 0 && f <= placed + 2 && (p.invuln > 0 || p.powerState !== 'big')) hurt = true;
          return f >= 2 ? ['jump', 'up'] : [];
        },
      });
      expect(placed, `facing ${facing}`).toBeGreaterThan(0);
      expect(hits, `facing ${facing}`).toBe(0);
      expect(hurt, `facing ${facing}`).toBe(true);
    }
  });

  it('side contact (not from above) still hurts, thrust held or not', () => {
    const e = new Goomba(0, 0);
    let hurt = false;
    runSim({
      level: flatLevel({}, 60),
      character: LINK,
      rules: 'classic',
      script: { steps: [] },
      maxFrames: 120,
      state: { powerState: 'big' },
      controller: (w: World, f: number): Action[] => {
        const p = w.player;
        if (f === 0) {
          w.spawn(e);
          e.activated = true;
          p.body.x = px(16 * 16);
        }
        if (e.alive) hold(e, px(20 * 16 + 2), px(13 * 16) - e.body.h);
        if (p.invuln > 0 || p.powerState !== 'big') hurt = true;
        // A low hop into its side holding Down.
        return f === 2 ? ['right', 'jump', 'down'] : ['right', 'down'];
      },
    });
    expect(hurt).toBe(true);
  });
});
