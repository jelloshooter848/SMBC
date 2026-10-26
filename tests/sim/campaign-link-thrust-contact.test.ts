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
 * Item 122 (owner-approved Campaign change): Campaign Link had the same thrust gap Classic Link had
 * before item 104 (hurt at |offset| 10.25-11.75 px, down and up). He now takes the same rule:
 * body contact while thrusting into an enemy is the thrust's hit (CharacterDef.thrustContact).
 * The helpers below are copied from classic-link-thrust-contact.test.ts.
 *
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
  rules: Rules = 'campaign',
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

/** Centre offsets (px) wide enough to cover every overlap, by 0.25 (only contacts are judged). */
function sweep(): number[] {
  const out: number[] = [];
  for (let dx = -14; dx <= 14; dx += 0.25) out.push(dx);
  return out;
}

describe('item 122: Campaign Link thrusts by body contact', () => {
  it('down-thrust onto a still Goomba at every overlapping offset: hit, never hurt, bounces', () => {
    const bad: string[] = [];
    let contacts = 0;
    for (const dx of sweep()) {
      const r = thrust('down', dx);
      if (!r.contact) continue;
      contacts++;
      if (r.hits === 0 || r.hurt || !r.bounced) bad.push(`${dx}: ${JSON.stringify(r)}`);
    }
    expect(contacts).toBeGreaterThan(40);
    expect(bad).toEqual([]);
  });

  it('up-thrust into a Goomba held above at every overlapping offset: hit, never hurt, stops rising', () => {
    const bad: string[] = [];
    let contacts = 0;
    for (const dx of sweep()) {
      const r = thrust('up', dx);
      if (!r.contact) continue;
      contacts++;
      if (r.hits === 0 || r.hurt || !r.bounced) bad.push(`${dx}: ${JSON.stringify(r)}`);
    }
    expect(contacts).toBeGreaterThan(40);
    expect(bad).toEqual([]);
  });

  it('the old gap offsets (|offset| 10.25-11.75 px) are hits, down and up', () => {
    for (const dir of ['down', 'up'] as const)
      for (const dx of [-11.75, -11, -10.25, 10.25, 11, 11.75]) {
        const r = thrust(dir, dx);
        expect(r.contact, `${dir} ${dx}`).toBe(true);
        expect(r.hurt, `${dir} ${dx}`).toBe(false);
        expect(r.hits, `${dir} ${dx}`).toBeGreaterThan(0);
      }
  });

  it('a still shell stays plain contact (kicked, no thrust hit)', () => {
    const shell = () => {
      const k = new Koopa(0, 0, 'green');
      k.stopShell();
      return k;
    };
    for (const dx of [-8, 0, 8]) {
      const r = thrust('down', dx, 'campaign', shell);
      expect(r.contact, `${dx}`).toBe(true);
      expect(r.hits, `${dx}`).toBe(0);
    }
  });

  it('a Podoboo (immune to the sword) off the sword box still hurts', () => {
    for (const dx of [-10, 10]) {
      const r = thrust('down', dx, 'campaign', () => new Podoboo(0, 0));
      expect(r.contact, `${dx}`).toBe(true);
      expect(r.hurtAtContact, `${dx}`).toBe(true);
    }
  });

  it('side contact still hurts: a short hop into its side holding Down', () => {
    const e = new Goomba(0, 0);
    let hurt = false;
    let hopAt = -1;
    runSim({
      level: flatLevel({}, 60),
      character: LINK,
      rules: 'campaign',
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
        // Walk up to it, then a one-frame hop (low) into its side holding Down.
        if (hopAt < 0 && e.body.x - (p.body.x + p.body.w) < px(4)) hopAt = f;
        if (hopAt < 0) return ['right'];
        return f === hopAt ? ['right', 'jump', 'down'] : ['right', 'down'];
      },
    });
    expect(hopAt).toBeGreaterThan(0);
    expect(hurt).toBe(true);
  });
});
