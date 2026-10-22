import { afterEach, describe, expect, it, vi } from 'vitest';
import { px } from '@engine/math/units';
import { parseTextMap } from '@game/level/textmap';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { MEGAMAN } from '@game/characters/megaman';
import { SAMUS } from '@game/characters/samus';
import { SIMON } from '@game/characters/simon';
import { BILL } from '@game/characters/bill';
import { RYU } from '@game/characters/ryu';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import { Bowser } from '@game/entities/enemies/bowser';
import { BulletBill } from '@game/entities/enemies/bullet-bill';
import { Lakitu } from '@game/entities/enemies/lakitu';
import { HammerBro } from '@game/entities/enemies/hammer-bro';
import { Podoboo } from '@game/entities/enemies/podoboo';
import { Spiny } from '@game/entities/enemies/spiny';
import { Projectile } from '@game/entities/projectiles/projectile';
import type { Enemy } from '@game/entities/enemies/enemy';
import type { Reaction } from '@game/rules/damage';
import { runSim } from '@game/sim/headless';
import {
  CLASSIC_ATTACK_MULT,
  CLASSIC_HP,
  CAMPAIGN_POINT_DAMAGE,
  attackerDef,
  classicDamage,
  classicMaxHp,
  isArmoured,
  resistsStop,
} from '@game/rules/classic-enemies';
import {
  classicStub,
  classicWorld,
  sfxLog,
  shotSpec,
  step,
  testLevel,
  tile,
  weapon,
} from './classic-harness';
import { builtClassicDefs, isolateClassicRegistry } from './classic-registry';

// Independent of which hero slices have landed: no registered Classic hero def replaces this
// file's stand-ins (tests/sim/classic-registry.ts).
isolateClassicRegistry({ hide: true });

// Classic enemy rules (bug-reports/2026-10-07-classic-enemy-hp-and-armour.md, HP-C1..HP-C24): HP
// in the original's units, armour, hit-stun, freeze, Bowser's forms and the instant kills. The
// heroes are stand-in Classic defs (Campaign defs marked `rules: 'classic'`), so the weapons here
// are stub damage sources carrying the HP-C9 values.

afterEach(() => {
  vi.restoreAllMocks();
});

/** Hits `e` with `make()` until it dies (at most `max` times); the reactions in order. */
function hitsToKill(e: Enemy, hit: () => Reaction, max = 60): Reaction[] {
  const out: Reaction[] = [];
  while (e.alive && out.length < max) out.push(hit());
  return out;
}

function place<E extends Enemy>(w: ReturnType<typeof classicWorld>, e: E): E {
  w.spawn(e);
  return e;
}

describe('HP table and damage (HP-C3, HP-C5, HP-C10)', () => {
  it('reads the original values and multiplies by Normal attack strength', () => {
    const w = classicWorld(classicStub(LINK));
    expect(CLASSIC_ATTACK_MULT).toBe(1);
    expect(classicMaxHp(new Goomba(0, 0), w)).toBe(250);
    expect(classicMaxHp(new Koopa(0, 0, 'green'), w)).toBe(600);
    expect(classicMaxHp(new Koopa(0, 0, 'red', true), w)).toBe(900);
    expect(classicMaxHp(new Koopa(0, 0, 'buzzy'), w)).toBe(600);
    expect(classicMaxHp(new Spiny(0, 0), w)).toBe(350);
    expect(classicMaxHp(new BulletBill(0, 0, -1), w)).toBe(400);
    expect(classicMaxHp(new Lakitu(0, 0), w)).toBe(800);
    expect(classicMaxHp(new HammerBro(0, 0), w)).toBe(800);
    expect(classicMaxHp(new Bowser(10, 10, 'fire'), w)).toBe(2400);
    expect(classicMaxHp(new Bowser(10, 10, 'hammer'), w)).toBe(3600);
    expect(classicMaxHp(new Bowser(10, 10, 'both'), w)).toBe(4400);
    expect(classicMaxHp(new Bowser(10, 10, 'hammer', true), w)).toBe(3600);
    expect(classicMaxHp(new Podoboo(0, 0), w)).toBeNull();
    // Mario or Luigi in the lead: 5000 whatever the form.
    const wm = classicWorld(classicStub(MARIO));
    expect(classicMaxHp(new Bowser(10, 10, 'both'), wm)).toBe(CLASSIC_HP['bowser-mario']);
  });

  it('armour and stop resistance by enemy (HP-C12, HP-C15)', () => {
    expect(isArmoured(new Koopa(0, 0, 'buzzy'))).toBe(true);
    expect(isArmoured(new BulletBill(0, 0, -1))).toBe(true);
    expect(isArmoured(new Spiny(0, 0))).toBe(false);
    expect(isArmoured(new Koopa(0, 0, 'green'))).toBe(false);
    expect(resistsStop(new Lakitu(0, 0))).toBe(true);
    expect(resistsStop(new Bowser(10, 10))).toBe(true);
    expect(resistsStop(new HammerBro(0, 0))).toBe(false);
  });

  it('a Campaign def under Classic rules counts each point as 1000; a Classic def its own units', () => {
    const cur = classicWorld(LINK);
    expect(classicDamage({ kind: 'sword', amount: 1, owner: cur.player, dirX: 1 })).toBe(
      CAMPAIGN_POINT_DAMAGE,
    );
    const cl = classicWorld(classicStub(LINK));
    expect(classicDamage(weapon(cl, 'sword', 275))).toBe(275);
    // Through the hero's projectile too.
    const pr = new Projectile(0, 0, 1, shotSpec({ amount: 100 }), cl.player);
    expect(classicDamage({ kind: 'buster', amount: 100, owner: pr, dirX: 1 })).toBe(100);
  });
});

describe('hits to kill (HP-C8 acceptance checks)', () => {
  it('Mega Buster vs Goomba: 3 hits, 100 points on the 3rd only', () => {
    const w = classicWorld(classicStub(MEGAMAN));
    w.player.body.x = tile(2);
    const g = place(w, new Goomba(tile(8), tile(12) + px(2)));
    g.body.vx = 0;
    g.activated = true;
    const scores: number[] = [];
    for (let i = 0; i < 3; i++) {
      const before = w.state.score;
      const shot = new Projectile(
        g.body.x - px(10),
        g.body.y + px(4),
        1,
        shotSpec({ amount: 100 }),
        w.player,
      );
      w.spawn(shot);
      for (let f = 0; f < 10 && shot.alive; f++) step(w);
      expect(shot.alive, `shot ${i + 1} ends on the Goomba`).toBe(false);
      scores.push(w.state.score - before);
    }
    expect(g.alive).toBe(false);
    expect(scores).toEqual([0, 0, 100]);
  });

  it('Mega Buster vs Koopa: shell after the 4th, dead on the 6th', () => {
    const w = classicWorld(classicStub(MEGAMAN));
    const k = place(w, new Koopa(tile(20), tile(12), 'green'));
    const r = hitsToKill(k, () => k.hit(weapon(w, 'buster', 100), w));
    expect(r).toEqual(['hp', 'hp', 'hp', 'shell', 'hp', 'kill']);
  });

  it('Link sword levels vs Paratroopa: 5 / 4 / 3 stabs; it walks after losing 300 or more', () => {
    for (const [dmg, n] of [
      [200, 5],
      [275, 4],
      [400, 3],
    ] as const) {
      const w = classicWorld(classicStub(LINK));
      const k = place(w, new Koopa(tile(20), tile(8), 'red', true));
      const wings: boolean[] = [];
      const r = hitsToKill(k, () => {
        const res = k.hit(weapon(w, 'sword', dmg), w);
        wings.push(k.wings);
        return res;
      });
      expect(r.length, `sword ${dmg}`).toBe(n);
      expect(r[r.length - 1]).toBe('kill');
      // HP after each hit: wings go once 600 or less is left (i.e. 300 or more lost).
      wings
        .slice(0, -1)
        .forEach((wg, i) => expect(wg, `sword ${dmg} hit ${i + 1}`).toBe(900 - dmg * (i + 1) > 600));
    }
  });

  it('Samus beam vs Buzzy Beetle: unhurt after 10; a missile shells it at 200; a second kills it', () => {
    const w = classicWorld(classicStub(SAMUS));
    const sounds = sfxLog(w);
    const b = place(w, new Koopa(tile(20), tile(12), 'buzzy'));
    for (let i = 0; i < 10; i++)
      expect(b.hit(weapon(w, 'buster', 150, { blockedSfx: 'armour' }), w)).toBe('blocked');
    expect(b.classicHp).toBe(600);
    expect(sounds.filter((s) => s === 'armour')).toHaveLength(10);
    expect(b.hit(weapon(w, 'weapon', 400, { pierce: 10, invulnFrames: 9 }), w)).toBe('shell');
    expect(b.classicHp).toBe(200);
    expect(b.isStillShell).toBe(true);
    b.invulnFrames = 0;
    expect(b.hit(weapon(w, 'weapon', 400, { pierce: 10 }), w)).toBe('kill');
    expect(b.alive).toBe(false);
  });

  it('Bill rifle vs Bullet Bill: no effect; Ryu Windmill (pierce 6): 2 passes kill it', () => {
    const w = classicWorld(classicStub(BILL));
    const bb = place(w, new BulletBill(tile(30), tile(10), -1));
    for (let i = 0; i < 5; i++) expect(bb.hit(weapon(w, 'buster', 100), w)).toBe('blocked');
    expect(bb.alive).toBe(true);
    const wr = classicWorld(classicStub(RYU));
    const b2 = place(wr, new BulletBill(tile(30), tile(10), -1));
    expect(hitsToKill(b2, () => b2.hit(weapon(wr, 'weapon', 300, { pierce: 6 }), wr))).toEqual([
      'hp',
      'kill',
    ]);
  });

  it('Bowser: Mario fireballs 5, Link Magic Sword 6 (fire form), Simon Flame Whip 11 (both)', () => {
    const wm = classicWorld(classicStub(MARIO));
    const b1 = place(wm, new Bowser(30, 10, 'fire'));
    expect(hitsToKill(b1, () => b1.hit(weapon(wm, 'fireball', 1000), wm))).toHaveLength(5);
    const wl = classicWorld(classicStub(LINK));
    const b2 = place(wl, new Bowser(30, 10, 'fire'));
    expect(hitsToKill(b2, () => b2.hit(weapon(wl, 'sword', 400), wl))).toHaveLength(6);
    const ws = classicWorld(classicStub(SIMON));
    const b3 = place(ws, new Bowser(30, 10, 'both'));
    expect(hitsToKill(b3, () => b3.hit(weapon(ws, 'sword', 400), ws))).toHaveLength(11);
  });

  it('a Koopa keeps its lost HP through its shell and back out (HP-C5, HP-C6)', () => {
    const w = classicWorld(classicStub(LINK));
    const k = place(w, new Koopa(tile(20), tile(12), 'green'));
    expect(k.hit(weapon(w, 'sword', 400), w)).toBe('shell');
    expect(k.classicHp).toBe(200);
    // Stomped shells and kicks leave HP alone; the next hit kills.
    k.stopFrames = 0;
    expect(k.hit(weapon(w, 'sword', 200), w)).toBe('kill');
  });
});

describe('instant kills (HP-C7)', () => {
  it('the Star kills Bowser for 5000 points; Campaign Bowser stays star-proof', () => {
    // No drop (Campaign Link's would be collected for points on the spot).
    const def = classicStub(LINK);
    delete def.drop;
    const w = classicWorld(def);
    const p = w.player;
    const b = place(w, new Bowser(2, 11, 'fire'));
    b.body.x = p.body.x;
    b.body.y = p.body.y + p.body.h - b.body.h;
    p.star = 100;
    const before = w.state.score;
    step(w);
    expect(b.alive).toBe(false);
    expect(w.state.score - before).toBe(5000);

    const cur = classicWorld(LINK, undefined, 'campaign');
    const b2 = place(cur, new Bowser(30, 10, 'fire'));
    expect(b2.hit({ kind: 'star', amount: 1, owner: null, dirX: 1 }, cur)).toBe('immune');
  });

  it('a kicked shell kills a Hammer Bro and Bowser', () => {
    const w = classicWorld(classicStub(LINK));
    const shell = new Koopa(tile(20), tile(12), 'green');
    const h = place(w, new HammerBro(tile(25), tile(11)));
    const b = place(w, new Bowser(30, 10, 'fire'));
    expect(h.hit(shell.shellDamage(), w)).toBe('kill');
    expect(b.hit(shell.shellDamage(), w)).toBe('kill');
    expect(h.alive || b.alive).toBe(false);
  });

  it('stomps keep their Campaign reactions and leave HP alone', () => {
    const w = classicWorld(classicStub(MARIO));
    const k = place(w, new Koopa(tile(20), tile(12), 'green'));
    expect(k.hit({ kind: 'stomp', amount: 1, owner: null, dirX: 1 }, w)).toBe('shell');
    expect(k.classicHp).toBeNull();
    const s = place(w, new Spiny(tile(24), tile(12), false));
    expect(s.hit({ kind: 'stomp', amount: 1, owner: null, dirX: 1 }, w)).toBe('hurtAttacker');
  });

  it('an instant source (Screw Attack) kills through armour and HP', () => {
    const w = classicWorld(classicStub(SAMUS));
    const b = place(w, new Koopa(tile(20), tile(12), 'buzzy'));
    expect(b.hit(weapon(w, 'contact', 0, { instant: true, pierce: 10 }), w)).toBe('kill');
  });

  it('hazards stay unhurtable (Podoboo)', () => {
    const w = classicWorld(classicStub(MEGAMAN));
    const pd = place(w, new Podoboo(tile(20), tile(12)));
    expect(pd.hit(weapon(w, 'buster', 1000), w)).toBe('immune');
  });
});

describe('hit-stun, invulnerability and freeze (HP-C11, HP-C15..HP-C19)', () => {
  it('Link sword on a Goomba: still for 24 frames, touching it hurts; Lakitu keeps moving', () => {
    const w = classicWorld(classicStub(LINK));
    const g = place(w, new Goomba(tile(20), tile(12) + px(2)));
    g.activated = true;
    step(w, 2);
    expect(g.hit(weapon(w, 'sword', 200, { stopFrames: 24, flashFrames: 24 }), w)).toBe('hp');
    const x0 = g.body.x;
    const xs: number[] = [];
    for (let i = 0; i < 24; i++) {
      step(w);
      xs.push(g.body.x);
    }
    expect(xs.every((x) => x === x0)).toBe(true);
    step(w, 3);
    expect(g.body.x).not.toBe(x0);
    // Stopped again, then touched: Link is hurt (HP-C18).
    g.hit(weapon(w, 'sword', 1, { stopFrames: 24 }), w);
    const hurt = vi.spyOn(w, 'hurtPlayer');
    const p = w.player;
    p.invuln = 0;
    g.body.x = p.body.x;
    g.body.y = p.body.y + p.body.h - g.body.h;
    step(w);
    expect(hurt).toHaveBeenCalled();

    const l = place(w, new Lakitu(tile(30), tile(4)));
    step(w, 3);
    l.hit(weapon(w, 'sword', 200, { stopFrames: 24 }), w);
    expect(l.stopFrames).toBe(0);
  });

  it('a new stop replaces a running one only if it leaves more time', () => {
    const w = classicWorld(classicStub(LINK));
    const g = place(w, new Goomba(tile(20), tile(12)));
    g.hit(weapon(w, 'boomerang', 0, { pierce: 10, stopFrames: 180 }), w);
    g.hit(weapon(w, 'sword', 1, { stopFrames: 24 }), w);
    expect(g.stopFrames).toBe(180);
  });

  it("Samus's hit: 9 frames when nothing damages it (the hit still ends a shot)", () => {
    const w = classicWorld(classicStub(SAMUS));
    const g = place(w, new Koopa(tile(20), tile(12)));
    expect(g.hit(weapon(w, 'buster', 150, { stopFrames: 9, invulnFrames: 9 }), w)).toBe('hp');
    expect(g.hit(weapon(w, 'buster', 150), w)).toBe('blocked');
    expect(g.classicHp).toBe(450);
    step(w, 9);
    expect(g.hit(weapon(w, 'buster', 150), w)).toBe('hp');
    expect(g.classicHp).toBe(300);
  });

  it('Ice freezes without damage (armour too), is harmless, and the next hit thaws and damages', () => {
    const w = classicWorld(classicStub(SAMUS));
    const b = place(w, new Koopa(tile(20), tile(12), 'buzzy'));
    expect(b.hit(weapon(w, 'ice', 125, { freezeFrames: 360 }), w)).toBe('stun');
    expect(b.frozen).toBe(360);
    expect(b.classicHp).toBe(600);
    // Touching a frozen enemy does nothing.
    const hurt = vi.spyOn(w, 'hurtPlayer');
    const p = w.player;
    p.invuln = 0;
    b.body.x = p.body.x;
    b.body.y = p.body.y + p.body.h - b.body.h;
    step(w);
    expect(hurt).not.toHaveBeenCalled();
    // A missile thaws it and deals its damage.
    expect(b.hit(weapon(w, 'weapon', 400, { pierce: 10 }), w)).toBe('shell');
    expect(b.frozen).toBe(0);
    // Lakitu resists the freeze and takes the 125.
    const l = place(w, new Lakitu(tile(30), tile(4)));
    expect(l.hit(weapon(w, 'ice', 125, { freezeFrames: 360 }), w)).toBe('hp');
    expect(l.classicHp).toBe(675);
  });

  it('no Campaign shatter: a stopped enemy takes normal damage (HP-C19)', () => {
    const w = classicWorld(classicStub(LINK));
    const g = place(w, new Goomba(tile(20), tile(12)));
    g.hit(weapon(w, 'boomerang', 0, { pierce: 10, stopFrames: 180 }), w);
    expect(g.alive).toBe(true);
    expect(g.hit(weapon(w, 'sword', 200), w)).toBe('hp');
    expect(g.alive).toBe(true);
  });
});

describe('blocked shots (HP-C14)', () => {
  it('Mega Buster on a Buzzy Beetle: vx flips, vy is -0x02eab, and it hits nothing more', () => {
    const w = classicWorld(classicStub(MEGAMAN));
    const b = place(w, new Koopa(tile(10), tile(12) + px(2), 'buzzy'));
    b.body.vx = 0;
    const spec = shotSpec({ amount: 100, onBlocked: 'deflect', classicHit: { blockedSfx: 'armour' } });
    const shot = new Projectile(b.body.x - px(12), b.body.y + px(2), 1, spec, w.player);
    w.spawn(shot);
    const sounds = sfxLog(w);
    let f = 0;
    while (!shot.deflected && f++ < 10) step(w);
    expect(shot.deflected).toBe(true);
    expect(shot.alive).toBe(true);
    expect(shot.body.vx).toBeLessThan(0);
    expect(shot.body.vy).toBe(-0x02eab);
    expect(sounds).toContain('armour');
    expect(b.classicHp).toBe(600);
  });

  it("'remove' and 'continue' and the default burst", () => {
    for (const [mode, alive] of [
      ['remove', false],
      ['continue', true],
      ['burst', false],
    ] as const) {
      const w = classicWorld(classicStub(BILL));
      const b = place(w, new Koopa(tile(10), tile(12) + px(2), 'buzzy'));
      b.body.vx = 0;
      const shot = new Projectile(
        b.body.x - px(12),
        b.body.y + px(2),
        1,
        shotSpec({ amount: 100, onBlocked: mode }),
        w.player,
      );
      w.spawn(shot);
      step(w, 4);
      expect(shot.alive, String(mode)).toBe(alive);
    }
  });
});

describe('melee damage hook (TG-24)', () => {
  it('a Classic def supplies its melee damage; a Campaign def still sends sword 1', () => {
    const def = classicStub(LINK);
    def.behaviour = {
      ...LINK.behaviour,
      meleeDamage: (p) => ({ kind: 'sword', amount: 275, owner: p, dirX: p.facing, stopFrames: 24 }),
    };
    const w = classicWorld(def);
    const g = place(w, new Koopa(tile(20), tile(12)));
    g.body.vx = 0;
    // The swing's hitbox sits on the Koopa (published after the behaviour's own update).
    def.behaviour.update = (p, input, world) => {
      LINK.behaviour.update(p, input, world);
      p.activeMelee = { x: g.body.x, y: g.body.y, w: g.body.w, h: g.body.h };
    };
    w.player.invuln = 1000;
    step(w);
    expect(g.classicHp).toBe(325);
    expect(g.stopFrames).toBeGreaterThan(0);
    // Once per swing: the next frames of the same swing do not hit again.
    step(w, 3);
    expect(g.classicHp).toBe(325);

    const cur = classicWorld(LINK);
    const g2 = place(cur, new Koopa(tile(20), tile(12)));
    g2.body.vx = 0;
    const box = { x: g2.body.x, y: g2.body.y, w: g2.body.w, h: g2.body.h };
    const spy = vi.spyOn(g2, 'hit');
    cur.player.activeMelee = box;
    cur.player.invuln = 1000;
    (cur as unknown as { collisions(p: unknown): void }).collisions(cur.player);
    expect(spy.mock.calls[0]?.[0]).toEqual({
      kind: 'sword',
      amount: 1,
      owner: null,
      dirX: cur.player.facing,
      by: cur.player,
    });
    // 1 point from a Campaign def: 1000, a dead Koopa.
    expect(g2.alive).toBe(false);
  });
});

describe('re-hits and zero-damage hits (HP-C20, HP-C16)', () => {
  it('Ryu Windmill (pierce 6, re-hits after leaving): 2 passes kill a Bullet Bill', () => {
    const w = classicWorld(classicStub(RYU));
    const bb = place(w, new BulletBill(tile(10), tile(12) + px(2), -1));
    bb.body.vx = 0;
    const spec = shotSpec({ amount: 300, pierce: true, classicHit: { pierce: 6 }, rehitAfter: 15 });
    const s = new Projectile(bb.body.x - px(12), bb.body.y + px(2), 1, spec, w.player);
    w.spawn(s);
    step(w, 12);
    expect(bb.classicHp).toBe(100);
    // Past it, it comes back the other way.
    s.body.vx = -s.body.vx;
    step(w, 12);
    expect(bb.alive).toBe(false);
  });

  it("Link's boomerang (0 damage) stops a Goomba but does nothing to Bowser", () => {
    const w = classicWorld(classicStub(LINK));
    const g = place(w, new Goomba(tile(20), tile(12)));
    expect(g.hit(weapon(w, 'boomerang', 0, { pierce: 10, stopFrames: 180 }), w)).toBe('stun');
    expect(g.classicHp).toBe(250);
    const b = place(w, new Bowser(30, 10, 'fire'));
    expect(b.hit(weapon(w, 'boomerang', 0, { pierce: 10, stopFrames: 180 }), w)).toBe('immune');
    expect(b.stopFrames).toBe(0);
  });
});

describe('the single door (TG-24)', () => {
  it("a Koopa shell goes through the Classic door for a boomerang too (Campaign's shell check is Campaign only)", () => {
    const w = classicWorld(classicStub(LINK));
    const k = place(w, new Koopa(tile(20), tile(12), 'green'));
    k.hit({ kind: 'stomp', amount: 1, owner: null, dirX: 1 }, w);
    expect(k.isStillShell).toBe(true);
    expect(k.hit(weapon(w, 'boomerang', 0, { pierce: 10, stopFrames: 180 }), w)).toBe('stun');
    const cur = classicWorld(LINK, undefined, 'campaign');
    const k2 = place(cur, new Koopa(tile(20), tile(12), 'green'));
    k2.hit({ kind: 'stomp', amount: 1, owner: null, dirX: 1 }, cur);
    expect(k2.hit({ kind: 'boomerang', amount: 1, owner: null, dirX: 1 }, cur)).toBe('immune');
  });
});

describe('damage units follow the attacker (TG-20, TG-24)', () => {
  it('the default melee hit of a Classic def without meleeDamage is 1 unit, not a Campaign point', () => {
    const def = classicStub(LINK);
    const w = classicWorld(def);
    const g = place(w, new Goomba(tile(20), tile(12)));
    g.body.vx = 0;
    def.behaviour = {
      ...LINK.behaviour,
      update: (p, input, world) => {
        LINK.behaviour.update(p, input, world);
        p.activeMelee = { x: g.body.x, y: g.body.y, w: g.body.w, h: g.body.h };
      },
    };
    w.player.invuln = 1000;
    step(w);
    expect(g.classicHp).toBe(249);
  });

  it("a shot spawned by a shot counts in its player's units (the owner chain is followed)", () => {
    const w = classicWorld(classicStub(SIMON));
    const bottle = new Projectile(0, 0, 1, shotSpec({ amount: 50 }), w.player);
    const flame = new Projectile(0, 0, 1, shotSpec({ amount: 200 }), bottle);
    expect(classicDamage({ kind: 'weapon', amount: 200, owner: flame, dirX: 1 })).toBe(200);
    expect(attackerDef({ kind: 'weapon', amount: 200, owner: flame, dirX: 1 })?.rules).toBe('classic');
  });

  it('guard: every registered Classic def that swings a melee hitbox defines meleeDamage', () => {
    // The defs registered before this file hid them.
    const defs = builtClassicDefs();
    const bad: string[] = [];
    for (const def of defs) {
      let swung = false;
      runSim({
        level: testLevel(),
        character: def,
        rules: 'classic',
        maxFrames: 90,
        script: { steps: [] },
        controller: (world, f) => {
          if (world.player.activeMelee) swung = true;
          return f % 20 < 4 ? ['attack'] : f % 20 < 8 ? ['up', 'attack'] : [];
        },
      });
      if (swung && !def.behaviour.meleeDamage) bad.push(def.id);
    }
    expect(bad).toEqual([]);
  });
});

describe("Bowser's HP is picked at spawn (HP-C4)", () => {
  const level = () =>
    parseTextMap(
      [
        'id: t',
        'time: 300',
        'start: 2,12',
        '',
        '[tiles]',
        ...Array.from({ length: 13 }, () => '.'.repeat(32)),
        '#'.repeat(32),
        '#'.repeat(32),
        '',
        '[entities]',
        'bowser 10 11 attack=hammer',
      ].join('\n'),
    );
  for (const [def, hp] of [
    [MARIO, 5000],
    [LINK, 3600],
  ] as const) {
    it(`${def.id}: ${hp} before any hit`, () => {
      const w = runSim({
        level: level(),
        character: classicStub(def),
        rules: 'classic',
        script: { steps: [] },
        maxFrames: 30,
        until: (world) => world.entities.some((e) => e instanceof Bowser),
      }).world;
      const b = w.entities.find((e): e is Bowser => e instanceof Bowser);
      expect(b?.classicHp).toBe(hp);
    });
  }

  it('Campaign: no Classic HP at spawn', () => {
    const w = runSim({
      level: level(),
      character: LINK,
      script: { steps: [] },
      maxFrames: 30,
      until: (world) => world.entities.some((e) => e instanceof Bowser),
    }).world;
    const b = w.entities.find((e): e is Bowser => e instanceof Bowser);
    expect(b).toBeDefined();
    expect(b?.classicHp).toBeNull();
  });
});
