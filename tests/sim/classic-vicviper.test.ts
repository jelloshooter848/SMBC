import { describe, expect, it } from 'vitest';
import { px } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { AssetRegistry } from '@engine/assets/registry';
import { getLevel } from '@content/levels';
import { SPRITES } from '@content/sprites';
import { CHARACTERS, CLASSIC_EXTRAS, heroFor } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import {
  AUTO_SCROLL,
  VICVIPER_CLASSIC as VIC,
  VIC_BAR,
  addCapsule,
  flySpeed,
  spendPower,
} from '@game/characters/vicviper/classic';
import {
  VIC_BULLET,
  VicMissile,
  VicOption,
  VicShield,
  shieldBoxes,
} from '@game/characters/vicviper/classic-weapons';
import { DARKPIT_CLASSIC } from '@game/characters/pit/classic';
import { Projectile } from '@game/entities/projectiles/projectile';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import { PowerUp } from '@game/entities/objects/powerup';
import { Spring } from '@game/entities/objects/spring';
import { Pickup } from '@game/entities/objects/pickup';
import { drawHud, HUD_BOTTOM, POWER_BAR } from '@game/hud/hud';
import { fontText } from '@game/hud/text';
import { newGameState } from '@game/context';
import { flatLevel, Rig } from './classic-plumber-harness';
import { makeGame, useStorage } from './heroes-harness';

// Vic Viper, a Classic-only hero (bug-reports/2026-10-07-vicviper-build-classic-character.md, VV-1..
// VV-32 with the approved VV-M answers of docs/classic/VIC_VIPER.md): the report's acceptance checks
// with rules 'classic'.

useStorage();

const sub = (n: number) => n / 256;
const screenX = (r: Rig) => sub(r.p.body.x - r.world.camera.x);
/** A pipe entry is under way (World.enterPipe freezes the players). */
const piping = (r: Rig): boolean => r.p.frozen && !r.p.dead;
const shots = (r: Rig) =>
  r.world.entities.filter((e): e is Projectile => e instanceof Projectile && e.alive && e.owner === r.p);

function rig(level = getLevel('1-1'), power = 'small', kit: Record<string, number> = {}): Rig {
  const r = new Rig(VIC, level, 'classic', power);
  Object.assign(r.p.scratch, kit);
  return r;
}

/** Steps `n` frames holding `hold`. */
function hold(r: Rig, n: number, keys: Action[] = []): void {
  for (let i = 0; i < n; i++) r.step(keys);
}

describe('definition (VV-2, VV-3, VV-4, TG-41)', () => {
  it('a Classic-only def in CLASSIC_EXTRAS after Pit and Dark Pit, never in CHARACTERS', () => {
    expect(VIC.id).toBe('vicviper');
    expect(VIC.name).toBe('Vic Viper');
    expect(VIC.hudName).toBe('VIPER');
    expect(VIC.rules).toBe('classic');
    expect(CLASSIC_EXTRAS).toContain(VIC);
    expect(CLASSIC_EXTRAS[CLASSIC_EXTRAS.indexOf(DARKPIT_CLASSIC) + 1]).toBe(VIC);
    expect(CHARACTERS).not.toContain(VIC);
    expect(heroFor(VIC, 'classic')).toBe(VIC);
    expect(VIC.stomps).toBe(false);
    expect(VIC.crouches).toBe(false);
    expect(VIC.meter).toBeUndefined();
    expect(VIC.tools).toBeUndefined();
    expect(VIC.startHp).toBeUndefined();
    expect(fontText(VIC.hudName)).toBe(VIC.hudName);
  });

  it('a 15 x 10 hitbox in every state (VV-3)', () => {
    for (const power of ['small', 'big', 'fire']) {
      const r = rig(flatLevel(), power);
      expect([sub(r.p.body.w), sub(r.p.body.h)]).toEqual([15, 10]);
    }
  });

  it('its sheet has every frame the def and its weapons ask for', () => {
    const frames = SPRITES.vicviper?.frames ?? {};
    for (const pose of ['normal', 'up-1', 'up-2', 'down-1', 'down-2'])
      for (const f of ['slow', 'fast'])
        for (let n = 0; n < 4; n++) expect(frames[`fly-${pose}-${f}-${n}`]).toBeDefined();
    for (const f of ['portrait', 'bullet', 'laser', 'laser-long', 'missile-down', 'missile-run', 'shot-hit'])
      expect(frames[f], f).toBeDefined();
    for (const f of ['option-0', 'shield-top', 'shield-bot-hurt', 'capsule-0', 'capsule-1', 'boom-3', 'none'])
      expect(frames[f], f).toBeDefined();
  });

  it('Current is unchanged (TG-38): Current heroes set none of the new fields', () => {
    for (const c of CHARACTERS) {
      expect(c.autoScroll, c.id).toBeUndefined();
      expect(c.pipesAirborne, c.id).toBeUndefined();
      expect(c.flies, c.id).toBeUndefined();
      expect(c.powerBar, c.id).toBeUndefined();
      expect(c.powerUpArt, c.id).toBeUndefined();
    }
    expect(heroFor(MARIO, 'current')).toBe(MARIO);
  });
});

describe('flight and auto-scroll (VV-5..VV-12)', () => {
  it('idle 600 frames in 1-1: the camera rises 500 +- 1 px, the ship stays put on screen', () => {
    const r = rig();
    // Up clear of the pipes first (a ship at floor height is squashed against the first one).
    hold(r, 60, ['up']);
    const x0 = r.world.camera.x;
    const s0 = screenX(r);
    const y0 = r.p.body.y;
    hold(r, 600);
    expect(Math.abs(sub(r.world.camera.x - x0) - 500)).toBeLessThanOrEqual(1);
    expect(Math.abs(screenX(r) - s0)).toBeLessThanOrEqual(1 / 256 + 0.01);
    // No gravity: the screen y is unchanged too.
    expect(r.p.body.y).toBe(y0);
  });

  it('right 60 frames: +100 +- 1 px on screen; left 60 frames: -150 +- 1 px (VV-7)', () => {
    const r = rig();
    hold(r, 60, ['up']);
    hold(r, 30, ['right']);
    const a = screenX(r);
    hold(r, 60, ['right']);
    expect(Math.abs(screenX(r) - a - 100)).toBeLessThanOrEqual(1);
    const b = screenX(r);
    hold(r, 60, ['left']);
    expect(Math.abs(screenX(r) - b + 150)).toBeLessThanOrEqual(1);
  });

  it('up, down and the diagonals at 1.667 px/f a side, not normalised', () => {
    const r = rig(flatLevel());
    hold(r, 10, ['up']);
    const y = r.p.body.y;
    hold(r, 30, ['up']);
    expect(Math.abs(sub(y - r.p.body.y) - 50)).toBeLessThanOrEqual(1);
    const x = screenX(r);
    const y2 = r.p.body.y;
    hold(r, 30, ['down', 'right']);
    expect(Math.abs(sub(r.p.body.y - y2) - 50)).toBeLessThanOrEqual(1);
    expect(Math.abs(screenX(r) - x - 50)).toBeLessThanOrEqual(1);
    expect(r.p.body.onGround).toBe(false);
  });

  it('the camera stops at its end and stays there; left is 1.667 px/f there', () => {
    const r = rig(flatLevel({}, 40));
    hold(r, 600, ['up']);
    const max = r.world.camera.maxX;
    expect(r.world.camera.x).toBe(max);
    hold(r, 60);
    expect(r.world.camera.x).toBe(max);
    const x = screenX(r);
    hold(r, 30, ['left']);
    expect(Math.abs(x - screenX(r) - 50)).toBeLessThanOrEqual(1);
  });

  it('a scroll-stop level stops at the stop', () => {
    const level = flatLevel({}, 200);
    level.zones.push({ kind: 'scrollStop', x: 40 });
    const r = rig(level);
    hold(r, 900, ['up']);
    expect(r.world.camera.x).toBe(px(40 * 16 - 256));
  });

  it('the right edge holds the ship 3 px inside, the top under the HUD rows (VV-M11)', () => {
    const r = rig(flatLevel());
    hold(r, 240, ['right', 'up']);
    const b = r.p.body;
    expect(sub(r.world.camera.right - (b.x + b.w))).toBeGreaterThanOrEqual(3);
    expect(sub(r.world.camera.right - (b.x + b.w))).toBeLessThan(4.7);
    expect(b.y).toBe(px(HUD_BOTTOM));
  });

  it('the Options and the Shield stay under the HUD rows too; the Double shot ends there', () => {
    const r = rig(flatLevel(), 'small', {
      vvOption: 2,
      vvShield: 1,
      vvShieldTop: 4,
      vvShieldBot: 4,
      vvDouble: 1,
    });
    hold(r, 30, ['down']);
    hold(r, 200, ['up', 'right']);
    hold(r, 60, ['up']);
    const b = r.p.body;
    expect(b.y).toBe(px(HUD_BOTTOM + 8));
    const top = (e: { body: { y: number } }) => e.body.y;
    for (const o of r.world.entities.filter((e) => e instanceof VicOption && e.alive))
      expect(top(o)).toBeGreaterThanOrEqual(px(HUD_BOTTOM));
    const { top: piece } = shieldBoxes(r.p);
    expect(piece.y).toBeGreaterThanOrEqual(px(HUD_BOTTOM));
    r.step(['attack']);
    hold(r, 30);
    for (const s of shots(r)) expect(s.body.y).toBeGreaterThanOrEqual(px(HUD_BOTTOM));
    expect(shots(r).some((s) => s.body.vy < 0)).toBe(false);
  });

  it('1-2: the HUD lane is closed, so the ship cannot fly over the ceiling', () => {
    const r = rig(getLevel('1-2'));
    r.p.star = 100000;
    hold(r, 900, ['up', 'right']);
    expect(r.p.body.y).toBeGreaterThanOrEqual(px(3 * 16));
  });

  it('pinned against a wall by the left edge, it is pushed out, not killed (VV-M12, as the original)', () => {
    // Sitting still at floor height in 1-1 (a Star for the Goombas): the first pipes come; the
    // ship ends up over them.
    const r = rig();
    r.p.star = 100000;
    hold(r, 700);
    expect(r.p.dead).toBe(false);
    expect(r.world.camera.x).toBeGreaterThan(px(28 * 16));
    // A wall the full height of the screen: shoved through it.
    const wall: Record<number, string> = {};
    for (let y = 0; y < 13; y++) wall[y] = `${'.'.repeat(14)}#`;
    const w = rig(flatLevel(wall, 60));
    hold(w, 30, ['up']);
    hold(w, 600);
    expect(w.p.dead).toBe(false);
    expect(w.p.body.x).toBeGreaterThan(px(15 * 16) - 1);
  });

  it('a map auto-scroll still squashes everyone else (no eject without the flag)', () => {
    expect(MARIO.autoScroll).toBeUndefined();
  });

  it('a hero with no auto-scroll keeps the following camera (Current Mario on 1-1)', () => {
    const r = new Rig(MARIO, getLevel('1-1'), 'current');
    hold(r, 120);
    expect(r.world.camera.x).toBe(0);
  });
});

describe('areas entered from the top (1-2)', () => {
  it('dropped in at the top of 1-2, it steers at once', () => {
    const r = rig(getLevel('1-2'));
    hold(r, 2);
    const x = screenX(r);
    hold(r, 30, ['right', 'down']);
    expect(screenX(r) - x).toBeGreaterThan(40);
  });

  it('the 1-2 intro walks it into the side pipe', () => {
    const r = rig(getLevel('1-2-intro'));
    r.until(() => r.events.some((e) => e.e.type === 'pipe'), [], 400);
    expect(r.events.some((e) => e.e.type === 'pipe')).toBe(true);
  });
});

describe('Bowser (VV-12, 4b)', () => {
  it('in 1-4 the scroll stops with the axe a tile in from the right edge', () => {
    const r = rig(getLevel('1-4'));
    r.world.camera.x = px(143 * 16 - 256) - px(40);
    r.p.star = 100000;
    r.p.body.x = r.world.camera.x + px(80);
    r.p.body.y = px(3 * 16);
    hold(r, 120);
    expect(r.world.camera.x).toBe(px(143 * 16 - 256));
  });

  it('touching the axe: the shared sequence lowers the ship and walks it to Toad', () => {
    const r = rig(getLevel('1-4'), 'big');
    r.world.camera.x = px(143 * 16 - 256) - px(40);
    r.p.star = 100000;
    r.p.body.x = px(136 * 16);
    r.p.body.y = px(8 * 16 + 2);
    r.until(
      () => r.events.some((e) => e.e.type === 'say'),
      (i) => (i < 50 ? ['right'] : []),
      900,
    );
    expect(r.events.some((e) => e.e.type === 'say')).toBe(true);
    expect(r.p.body.y + r.p.body.h).toBe(px(13 * 16));
  });
});

describe('no head bump, no stomp, springs, water (VV-17, VV-25, VV-26, VV-30)', () => {
  it('a springboard is a solid block: flown onto, it is not pressed and never launches', () => {
    const r = rig(flatLevel({}, 16));
    const sp = new Spring(8, 12);
    r.world.spawn(sp);
    hold(r, 2);
    const b = r.p.body;
    b.x = px(8 * 16) + ((px(16) - b.w) >> 1);
    b.y = sp.body.y - b.h - px(20);
    hold(r, 40, ['down']);
    expect(sp.busy).toBe(false);
    expect(b.y + b.h).toBe(sp.body.y);
    hold(r, 60);
    expect(b.y + b.h).toBe(sp.body.y);
    // Flown into from the side: a wall.
    b.x = px(4 * 16);
    b.y = sp.body.y + px(4);
    hold(r, 60, ['right']);
    expect(b.x + b.w).toBeLessThanOrEqual(sp.body.x);
  });

  it('flying up into a ? block: no bump, it stays a ? block; it is a ceiling', () => {
    // One screen wide: no scroll carries the ship off the column.
    const r = rig(flatLevel({ 9: `${'.'.repeat(6)}?` }, 16));
    r.p.body.x = px(6 * 16 + 1);
    const tile = r.world.map.get(6, 9);
    hold(r, 60, ['up']);
    expect(r.world.map.get(6, 9)).toBe(tile);
    expect(r.world.entities.some((e) => e instanceof PowerUp)).toBe(false);
    expect(sub(r.p.body.y)).toBe(10 * 16);
  });

  it('hidden blocks are passed through and stay hidden', () => {
    const r = rig(flatLevel({ 9: `${'.'.repeat(6)}2` }, 16));
    r.p.body.x = px(6 * 16 + 1);
    const tile = r.world.map.get(6, 9);
    hold(r, 60, ['up']);
    expect(r.world.map.get(6, 9)).toBe(tile);
    expect(sub(r.p.body.y)).toBeLessThan(9 * 16);
  });

  it('touching a Goomba from above hurts the ship (no stomp)', () => {
    const r = rig(flatLevel(), 'big');
    const b = r.p.body;
    const g = new Goomba(b.x, px(13 * 16 - 16));
    r.world.spawn(g);
    r.until(() => r.p.powerState === 'small' || r.p.dead, ['down'], 120);
    expect(g.alive).toBe(true);
    expect(r.p.powerState).toBe('small');
  });

  it('in water, downward flight is capped at 2.083 px/f (binds only from Speed Up 2)', () => {
    const fall = (speed: number, water: boolean): number => {
      const r = rig(flatLevel({}, 16), 'small', { vvSpeed: speed });
      r.p.body.y = px(40);
      r.p.inWater = water;
      const y = r.p.body.y;
      VIC.behaviour.drive?.(r.p, { held: (a: string) => a === 'down' } as never, r.world.map, r.world.audio);
      return r.p.body.y - y;
    };
    expect(fall(0, true)).toBe(fall(0, false));
    expect(fall(1, true)).toBe(fall(1, false));
    expect(fall(2, true)).toBe(0x02155 >> 4);
    expect(fall(2, false)).toBeGreaterThan(0x02155 >> 4);
  });
});

describe('bullet (VV-14, VV-15)', () => {
  it('one bullet a press, right at 5 px/f; holding does not repeat', () => {
    const r = rig(flatLevel());
    hold(r, 30, ['up']);
    r.step(['attack', 'up']);
    hold(r, 10, ['attack']);
    expect(shots(r).length).toBe(1);
    const s = shots(r)[0] as Projectile;
    expect(s.spec).toBe(VIC_BULLET);
    expect(s.body.vx).toBe(0x05000);
    const x = s.body.x;
    r.step(['attack']);
    expect(sub(s.body.x - x)).toBe(5);
    r.step([]);
    r.step(['attack']);
    expect(shots(r).length).toBe(2);
  });

  it('flies through the ground', () => {
    const r = rig(flatLevel({ 11: `${'.'.repeat(12)}####`, 12: `${'.'.repeat(12)}####` }));
    hold(r, 6, ['down']);
    r.step(['attack']);
    const s = shots(r)[0] as Projectile;
    hold(r, 30);
    expect(s.alive).toBe(true);
    expect(sub(s.body.x)).toBeGreaterThan(16 * 16);
  });

  it('breaks a brick and is gone; bumps a ? block, which gives its item', () => {
    const r = rig(flatLevel({ 8: `${'.'.repeat(14)}=`, 7: `${'.'.repeat(18)}M` }));
    // Line the bullet's height up with the brick row.
    const b = r.p.body;
    b.y = px(8 * 16 + 4 + 8) - b.h;
    r.step(['attack']);
    const s = shots(r)[0] as Projectile;
    r.until(() => !s.alive, [], 60);
    expect(r.world.map.isSolid(14, 8)).toBe(false);
    b.y = px(7 * 16 + 4 + 8) - b.h;
    r.step([]);
    r.step(['attack']);
    const s2 = shots(r)[0] as Projectile;
    r.until(() => !s2.alive, [], 60);
    expect(r.world.entities.some((e) => e instanceof PowerUp)).toBe(true);
  });

  it('a Goomba takes 2 bullets, a Koopa 3, a Buzzy Beetle none', () => {
    const count = (make: (x: number) => Goomba | Koopa): number => {
      const r = rig(flatLevel({}, 400));
      const e = make(px(200));
      r.world.spawn(e);
      for (let n = 1; n <= 8; n++) {
        r.step(['attack']);
        r.until(() => shots(r).length === 0, [], 120);
        if (!e.alive || e.classicHp === null || (e.classicHp ?? 1) <= 0) return n;
        e.body.x = px(200);
      }
      return Infinity;
    };
    const ground = px(13 * 16 - 16);
    expect(count((x) => new Goomba(x, ground))).toBe(2);
    expect(count((x) => new Koopa(x, ground - px(8), 'green'))).toBe(3);
    expect(count((x) => new Koopa(x, ground - px(8), 'buzzy'))).toBe(Infinity);
  });
});

describe('pipes (VV-27, VV-12)', () => {
  it('mid-air Down over the first enterable pipe in 1-1: in; the camera holds in the pipe', () => {
    const r = rig();
    const b = r.p.body;
    // Hover over the pipe at column 57 (its top at row 9).
    r.world.camera.x = px(57 * 16 - 80);
    b.x = px(57 * 16 + 2);
    b.y = px(9 * 16 - 14);
    r.step([]);
    expect(b.y + b.h).toBeLessThan(px(9 * 16));
    r.until(() => piping(r), ['down'], 120);
    expect(piping(r)).toBe(true);
    const cam = r.world.camera.x;
    hold(r, 20, ['down']);
    expect(r.world.camera.x).toBe(cam);
    r.until(() => r.events.some((e) => e.e.type === 'pipe'), [], 200);
    expect(r.events.some((e) => e.e.type === 'pipe')).toBe(true);
    expect(r.world.camera.x).toBe(cam);
  });

  it('a side pipe in mid-air: Right at the mouth enters it', () => {
    const level = flatLevel({ 9: `${'.'.repeat(14)}##`, 10: `${'.'.repeat(14)}##` }, 200, []);
    level.zones.push({
      kind: 'pipe',
      x: 14,
      y: 9,
      dir: 'right',
      target: { level: 't', x: 1, y: 1 },
    } as never);
    const r = rig(level);
    const b = r.p.body;
    b.y = px(10 * 16 + 4);
    r.until(() => piping(r), ['right'], 240);
    expect(piping(r)).toBe(true);
  });
});

describe('power states (VV-18, VV-19)', () => {
  it('small: one hit kills; with the Mushroom it survives once and the bar is kept', () => {
    const r = rig(flatLevel(), 'small');
    expect(VIC.behaviour.onHurt(r.p, r.world, 1)).toBe('dead');
    const r2 = rig(flatLevel(), 'big', { vvSel: 3, vvSpeed: 2 });
    expect(VIC.behaviour.onHurt(r2.p, r2.world, 1)).toBe('hurt');
    expect(r2.p.powerState).toBe('small');
    expect(r2.p.scratch.vvSel).toBe(3);
    expect(r2.p.scratch.vvSpeed).toBe(2);
  });

  it('a power-up block gives the Mushroom, then a capsule drawn as one (VV-M3)', () => {
    const r = rig(flatLevel(), 'small');
    expect(VIC.blockPowerUp(r.p)).toBe('mushroom');
    r.p.powerState = 'big';
    expect(VIC.blockPowerUp(r.p)).toBe('flower');
    expect(VIC.powerUpArt?.('flower')?.sheet).toBe('vicviper');
    expect(VIC.powerUpArt?.('mushroom')).toBeNull();
    VIC.behaviour.onPowerUp(r.p, 'flower', r.world);
    expect(r.p.powerState).toBe('fire');
    expect(r.p.scratch.vvSel).toBe(1);
  });

  it('a capsule from a kill or a block lights the bar; drops are power capsules', () => {
    const r = rig(flatLevel());
    expect(VIC.behaviour.onPickup?.(r.p, 'power-capsule', r.world)).toBe(true);
    expect(r.p.scratch.vvSel).toBe(1);
    let drops = 0;
    const rng = { chance: () => true, float: () => 0 } as never;
    if (VIC.drop?.(rng, {} as never, r.p) === 'power-capsule') drops++;
    expect(drops).toBe(1);
    expect(VIC.blockDrop?.(rng, r.p, 'brick')).toBe('power-capsule');
  });

  it('touching a dropped capsule takes it', () => {
    const r = rig(flatLevel({}, 16));
    hold(r, 2);
    const b = r.p.body;
    r.world.spawn(new Pickup(b.x + (b.w >> 1), b.y + b.h, 'power-capsule', true));
    hold(r, 3);
    expect(r.p.scratch.vvSel).toBe(1);
  });
});

describe('the power bar (VV-20, VV-21, VV-M1, VV-M2)', () => {
  it('the bar is read out: a lit slot and a taken power-up (every new text is announced)', () => {
    const r = rig(flatLevel());
    addCapsule(r.p, r.world);
    addCapsule(r.p, r.world);
    spendPower(r.p, r.world);
    const said = r.world.events.flatMap((e) => (e.type === 'say' ? [e.text] : []));
    expect(said).toEqual([
      'Speed Up lit. POWER to take it.',
      'Missile lit. POWER to take it.',
      'Missile taken.',
    ]);
    for (const t of said)
      expect(t).not.toMatch(/\b(button|press|push|tap|hold)\s+[abc]\b|\([abc]\)|\b[abc]\s*:/i);
  });

  it('six capsules light slots 1 to 6 in turn; the 7th selects slot 1', () => {
    const r = rig(flatLevel());
    for (let i = 1; i <= 6; i++) {
      addCapsule(r.p, r.world);
      expect(r.p.scratch.vvSel).toBe(i);
    }
    addCapsule(r.p, r.world);
    expect(r.p.scratch.vvSel).toBe(1);
  });

  it('POWER (Jump or Special) takes the lit slot and empties the bar; nothing lit, nothing', () => {
    const r = rig(flatLevel());
    hold(r, 2);
    r.step(['jump']);
    expect(r.p.scratch.vvSpeed ?? 0).toBe(0);
    addCapsule(r.p, r.world);
    r.step([]);
    r.step(['jump']);
    expect(r.p.scratch.vvSpeed).toBe(1);
    expect(r.p.scratch.vvSel).toBe(0);
    expect(flySpeed(r.p)).toBe(0x01aab + 0x00555);
    addCapsule(r.p, r.world);
    addCapsule(r.p, r.world);
    r.step([]);
    r.step(['special']);
    expect(r.p.scratch.vvMissile).toBe(1);
  });

  it('maxed slots are skipped and drawn blank; all maxed: a capsule scores 1000', () => {
    const r = rig(flatLevel(), 'small', { vvSpeed: 5, vvMissile: 1 });
    addCapsule(r.p, r.world);
    expect(r.p.scratch.vvSel).toBe(3);
    const bar = VIC.powerBar?.(r.p);
    expect(bar?.slots.map((s) => s.available)).toEqual([false, false, true, true, true, true]);
    expect(bar?.slots.map((s) => s.label)).toEqual(['SP', 'MS', 'DB', 'LS', 'OP', '?']);
    expect(bar?.name).toBe('DOUBLE');
    Object.assign(r.p.scratch, { vvDouble: 2, vvLaser: 2, vvOption: 4, vvShield: 1, vvSel: 0 });
    const score = r.world.state.score;
    addCapsule(r.p, r.world);
    expect(r.p.scratch.vvSel).toBe(0);
    expect(r.world.state.score - score).toBe(1000);
  });

  it('Double and Laser replace each other (VV-M6)', () => {
    const r = rig(flatLevel(), 'small', { vvSel: 3 });
    spendPower(r.p, r.world);
    expect(r.p.scratch.vvDouble).toBe(1);
    r.p.scratch.vvSel = 4;
    spendPower(r.p, r.world);
    expect(r.p.scratch.vvLaser).toBe(1);
    expect(r.p.scratch.vvDouble).toBe(0);
  });

  it('the HUD draws six cells on the third row and the lit name', () => {
    const r = rig(flatLevel(), 'small', { vvSel: 2 });
    const rects: { x: number; y: number }[] = [];
    const words: { s: string; x: number }[] = [];
    const rr: Renderer = Object.assign(new NullRenderer(), {
      rect(x: number, y: number) {
        rects.push({ x, y });
      },
      text(_f: SpriteSheet, s: string, x: number) {
        words.push({ s, x });
      },
    });
    drawHud(
      rr,
      { sheet: () => ({}) } as unknown as AssetRegistry,
      newGameState(VIC, null, 'classic'),
      300,
      0,
      [r.p],
    );
    const cells = rects.filter((c) => c.y === POWER_BAR.y);
    expect(cells.map((c) => c.x)).toEqual([0, 1, 2, 3, 4, 5].map((i) => POWER_BAR.x + i * POWER_BAR.cellW));
    expect(words.some((w) => w.s === 'MISSILE' && w.x === POWER_BAR.nameX)).toBe(true);
    for (const s of VIC_BAR) expect(fontText(s.name)).toBe(s.name);
  });

  it('death empties the bar (a fresh life starts with an empty kit)', () => {
    const h = makeGame({ dev: true });
    h.game.state.kit = { vvSel: 3, vvSpeed: 2 };
    h.game.resetAfterDeath();
    expect(h.game.state.kit).toEqual({});
  });
});

describe('power-ups (VV-M4..VV-M9)', () => {
  it('Double: a 45° shot too; level 2 a rear shot', () => {
    const r = rig(flatLevel(), 'small', { vvDouble: 2 });
    hold(r, 30, ['up']);
    r.step(['attack']);
    const s = shots(r);
    expect(s.length).toBe(3);
    expect(s.map((x) => [x.body.vx, x.body.vy]).sort()).toEqual(
      [
        [-0x05000, 0],
        [0x03892, -0x03892],
        [0x05000, 0],
      ].sort(),
    );
  });

  it('Laser: at most 2 on screen, piercing, 8 px/f', () => {
    const r = rig(flatLevel(), 'small', { vvLaser: 1 });
    hold(r, 30, ['up']);
    for (let i = 0; i < 3; i++) {
      r.step(['attack']);
      r.step([]);
    }
    const s = shots(r);
    expect(s.length).toBe(2);
    expect(s[0]?.spec.pierce).toBe(true);
    expect(s[0]?.body.vx).toBe(0x08000);
  });

  it('Missile: one at a time, dives, then runs along the floor', () => {
    const r = rig(flatLevel(), 'small', { vvMissile: 1 });
    hold(r, 20, ['up']);
    r.step(['attack']);
    r.step([]);
    r.step(['attack']);
    const m = r.world.entities.filter((e): e is VicMissile => e instanceof VicMissile && e.alive);
    expect(m.length).toBe(1);
    r.until(() => (m[0] as VicMissile).running, [], 200);
    expect((m[0] as VicMissile).running).toBe(true);
    const y = m[0]?.body.y;
    hold(r, 10);
    expect(m[0]?.body.y).toBe(y);
  });

  it('Options trail the ship and fire copies of its shots; they bunch while it holds still', () => {
    const r = rig(flatLevel(), 'small', { vvOption: 2 });
    hold(r, 3);
    const opts = () => r.world.entities.filter((e): e is VicOption => e instanceof VicOption && e.alive);
    expect(opts().length).toBe(2);
    hold(r, 40, ['up']);
    const o1 = opts().find((o) => o.n === 1) as VicOption;
    // Twelve moves behind: 20 px below the ship.
    expect(Math.round(sub(o1.body.y + o1.body.h / 2 - (r.p.body.y + r.p.body.h / 2)))).toBe(20);
    const at = o1.body.y;
    hold(r, 30);
    expect(o1.body.y).toBe(at);
    r.step(['attack']);
    expect(shots(r).length).toBe(3);
  });

  it('Shield: two pieces that eat enemy shots, 4 each; with both gone the slot opens', () => {
    const r = rig(flatLevel(), 'small', { vvSel: 6 });
    hold(r, 30, ['up']);
    spendPower(r.p, r.world);
    r.step([]);
    const sh = r.world.entities.find((e): e is VicShield => e instanceof VicShield && e.alive);
    expect(sh).toBeDefined();
    expect(r.p.scratch.vvShieldTop).toBe(4);
    expect(VIC.powerBar?.(r.p)?.slots[5]?.available).toBe(false);
    r.p.scratch.vvShieldTop = 0;
    r.p.scratch.vvShieldBot = 0;
    r.step([]);
    expect(r.p.scratch.vvShield).toBe(0);
    expect(VIC.powerBar?.(r.p)?.slots[5]?.available).toBe(true);
  });
});

describe('roster, guide and touch (TG-40..TG-43, TG-22)', () => {
  it('in a Classic run, never under Current', () => {
    const h = makeGame({ dev: true });
    expect(h.game.rosterFor('current')).not.toContain(VIC);
    expect(h.game.rosterFor('classic')).toContain(VIC);
    expect(h.game.roster).not.toContain(VIC);
  });

  it('its guide reads in the font with no button letters; touch shows SHOOT and POWER', () => {
    const g = VIC.guide;
    const texts = [
      g.tagline,
      ...g.controls.flatMap((x) => [x.does, x.touchDoes ?? '', x.touch ?? '']),
      ...g.powerups.map((x) => x.does),
      ...(g.tips ?? []),
    ];
    for (const t of texts) {
      expect(fontText(t).length, t).toBe(t.length);
      expect(t, t).not.toMatch(/\b(button|press|push|tap|hold)\s+[abc]\b|\([abc]\)|\b[abc]\s*:/i);
    }
    const r = rig(flatLevel());
    expect(VIC.touchLabels?.(r.p, r.world)).toMatchObject({
      attack: 'SHOOT',
      jump: 'POWER',
      special: 'POWER',
    });
  });

  it('the How to play demo shows the ship as it starts, not the full kit', () => {
    expect(VIC.guideKit?.()).toEqual({});
    expect(Object.keys(VIC.devKit?.() ?? {}).length).toBeGreaterThan(0);
    for (const c of CHARACTERS) expect(c.guideKit, c.id).toBeUndefined();
  });

  it('&kit=full: a spent kit with every kind of power-up (TG-44)', () => {
    const kit = VIC.devKit?.() ?? {};
    expect(kit.vvMissile).toBe(1);
    expect(kit.vvOption).toBeGreaterThan(0);
    expect(kit.vvShield).toBe(1);
  });

  it('the scroll speed is 0.833 px/f', () => {
    expect(VIC.autoScroll?.speed).toBe(AUTO_SCROLL);
    expect(AUTO_SCROLL).toBe(0x00d55);
  });
});
