import { describe, expect, it } from 'vitest';
import { px } from '@engine/math/units';
import { rasterizeToBuffer } from '@engine/gfx/pixelart';
import { PALETTES, SPRITES } from '@content/sprites';
import { sfx } from '@content/sfx/sfx';
import { CHARACTERS, CLASSIC_EXTRAS, heroFor } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import {
  EGGS_BIG,
  EGGS_SMALL,
  POUND_HANG,
  POUND_VY,
  YOSHI_CLASSIC,
  YOSHI_CLASSIC_PROFILE,
  YOSHI_WALK,
  yoshiSprite,
} from '@game/characters/yoshi/classic';
import { YoshiEgg, YoshiSpit } from '@game/characters/yoshi/classic-weapons';
import { mouthOf, sweepAngle } from '@game/characters/classic/yoshi-tongue';
import type { CharacterDef } from '@game/characters/character';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import { Spiny } from '@game/entities/enemies/spiny';
import { BulletBill } from '@game/entities/enemies/bullet-bill';
import type { Enemy } from '@game/entities/enemies/enemy';
import { T } from '@game/level/tiles';
import { fontText } from '@game/hud/text';
import { Rig, flatLevel, measureJump } from './classic-plumber-harness';
import { makeGame, useStorage } from './heroes-harness';

// Classic Yoshi, the playable Classic-only hero (bug-reports/2026-10-19-yoshi-build-classic-
// character.md, Part A, YO-1..YO-30): the report's acceptance checks with rules 'classic'.

useStorage();

const Y = YOSHI_CLASSIC;
const tile = (n: number) => px(n * 16);

function rig(power = 'small', kit: Record<string, number> = {}, level = flatLevel()): Rig {
  const r = new Rig(Y, level, 'classic', power);
  r.settle();
  Object.assign(r.p.scratch, kit);
  return r;
}

/** Puts `e` on the floor `dx` px ahead of Yoshi's front (feet on the floor). */
function place<E extends Enemy>(r: Rig, e: E, dx: number): E {
  const b = r.p.body;
  e.body.x = b.x + b.w + px(dx);
  e.body.y = px(208) - e.body.h;
  e.body.vx = 0;
  e.activated = true;
  r.world.spawn(e);
  return e;
}
const eggs = (r: Rig) => r.world.entities.filter((e): e is YoshiEgg => e instanceof YoshiEgg && e.alive);

describe('YO-1, YO-2: definition and roster', () => {
  it('a Classic-only def, last in CLASSIC_EXTRAS, never a Campaign hero', () => {
    expect(Y).toMatchObject({ id: 'yoshi', name: 'Yoshi', hudName: 'YOSHI', rules: 'classic' });
    expect(Y.notInOriginal).toBe(true);
    expect(Y.damage).toEqual({ kind: 'powerup', states: ['small', 'big', 'fire'] });
    expect(Y.stomps).toBe(true);
    expect(Y.crouches).toBe(true);
    expect(Y.canBreakBricks({} as never)).toBe(false);
    expect(Y.powerIcon).toBe(true);
    expect(Y.drop).toBeUndefined();
    expect(Y.blockDrop).toBeUndefined();
    expect(Y.portrait).toEqual({ sheet: 'yoshi', palette: 'yoshi', frame: 'stand' });
    expect(Y.jumpSfx({} as never)).toBe('yoshi-jump');
    expect(CLASSIC_EXTRAS.at(-1)).toBe(Y);
    expect(CHARACTERS).not.toContain(Y);
    expect(CHARACTERS.some((c) => c.id === 'yoshi')).toBe(false);
    expect(heroFor(Y, 'classic')).toBe(Y);
    expect(fontText(Y.hudName)).toBe(Y.hudName);
    for (const id of [
      'yoshi-jump',
      'yoshi-flutter',
      'yoshi-pound',
      'yoshi-tongue',
      'yoshi-lay',
      'yoshi-throw',
    ])
      expect(
        sfx.some((s) => s.id === id),
        id,
      ).toBe(true);
  });

  it('Classic rosters list him; Campaign ones, and the campaign roster, never (TG-38)', () => {
    const h = makeGame({ dev: true });
    expect(h.game.rosterFor('classic')).toContain(Y);
    expect(h.game.rosterFor('campaign')).not.toContain(Y);
    // Under Campaign the roster's defs are unchanged.
    expect(heroFor(MARIO, 'campaign')).toBe(MARIO);
  });

  it('every frame he can show is on his sheet, in every palette', () => {
    const sheet = SPRITES.yoshi;
    expect(sheet).toBeDefined();
    for (const pal of ['yoshi', 'yoshi-flower', 'yoshi-p2', 'yoshi-star-0', 'yoshi-star-3'])
      expect(() =>
        rasterizeToBuffer(
          { ...(sheet as NonNullable<typeof sheet>), palette: pal },
          (PALETTES.default as Record<string, string[]>)[pal] as never,
        ),
      ).not.toThrow();
    const frames = Object.keys(sheet?.frames ?? {});
    for (const f of [
      'stand',
      'walk-0',
      'walk-2',
      'jump',
      'flutter-0',
      'flutter-1',
      'pound',
      'tongue',
      'full',
      'lay',
      'aim',
      'throw',
      'hurt',
      'crouch',
      'climb-0',
      'climb-1',
      'die',
      'egg-green',
      'egg-red',
      'aim-cursor',
      'tongue-mid',
      'tongue-tip',
      'icon-egg',
      'icon-egg-red',
      'yoshi-head',
    ])
      expect(frames, f).toContain(f);
    const r = rig();
    const s = yoshiSprite(r.p, 0, true);
    expect(s).toMatchObject({ sheet: 'yoshi', palette: 'yoshi', frame: 'stand', offsetX: 3, offsetY: 8 });
    const f = rig('fire');
    expect(yoshiSprite(f.p, 0, true).palette).toBe('yoshi-flower');
  });
});

describe('YO-5, YO-7: walk and jump', () => {
  it('after 120 frames holding Right he walks at 1.75 px/f; no run', () => {
    const r = rig();
    for (let i = 0; i < 120; i++) r.step(['right', 'attack']);
    expect(r.p.body.vx).toBe(YOSHI_WALK);
    expect(YOSHI_CLASSIC_PROFILE.canRun).toBe(false);
  });

  it('a full hold rises about 65 px; a tap about 16 px', () => {
    const noFlutter: CharacterDef = { ...Y, movement: { ...YOSHI_CLASSIC_PROFILE, flutter: undefined } };
    expect(Math.abs(measureJump(noFlutter, 0, Infinity).apex - 65)).toBeLessThanOrEqual(2);
    expect(Math.abs(measureJump(Y, 0, 1).apex - 16)).toBeLessThanOrEqual(1.5);
  });
});

describe('YO-8: flutter', () => {
  it('holding jump through a full jump: a 40-frame flutter at the apex, much more airtime', () => {
    const noFlutter: CharacterDef = { ...Y, movement: { ...YOSHI_CLASSIC_PROFILE, flutter: undefined } };
    const plain = measureJump(noFlutter, 0, Infinity).airtime;
    const r = rig();
    let max = 0;
    let air = 0;
    r.step(['jump']);
    for (let i = 0; i < 300 && !r.p.body.onGround; i++) {
      r.step(['jump']);
      max = Math.max(max, r.p.flutterT);
      air++;
    }
    expect(max).toBe(40);
    expect(air).toBeGreaterThanOrEqual(plain + 40 - 1);
  });

  it('releasing jump ends it at once; a second hold in the same jump does nothing', () => {
    const r = rig();
    r.step(['jump']);
    r.until(() => r.p.flutterT > 0, ['jump']);
    for (let i = 0; i < 5; i++) r.step(['jump']);
    expect(r.p.flutterT).toBeGreaterThan(0);
    r.step([]);
    expect(r.p.flutterT).toBe(0);
    for (let i = 0; i < 20 && !r.p.body.onGround; i++) {
      r.step(['jump']);
      expect(r.p.flutterT).toBe(0);
    }
  });

  it('a landing gives it back', () => {
    const r = rig();
    r.step(['jump']);
    r.until(() => r.p.flutterT > 0, ['jump']);
    r.until(() => r.p.body.onGround, []);
    r.step([]);
    r.step(['jump']);
    expect(r.until(() => r.p.flutterT > 0, ['jump'], 200)).toBeLessThan(200);
  });
});

describe('YO-9: ground pound', () => {
  function jumpThenPound(r: Rig): void {
    r.step(['jump']);
    for (let i = 0; i < 8; i++) r.step(['jump']);
    r.step(['down']);
  }

  it('hangs 12 frames without moving, then drops at 6 px/f', () => {
    const r = rig();
    jumpThenPound(r);
    const { x, y } = r.p.body;
    for (let i = 0; i < POUND_HANG - 1; i++) {
      r.step(['right']);
      expect([r.p.body.x, r.p.body.y]).toEqual([x, y]);
    }
    r.step([]);
    r.step([]);
    expect(r.p.body.vy).toBe(POUND_VY);
    expect(r.p.body.h).toBe(px(20));
  });

  it('a Goomba and a Buzzy Beetle under him die; he bounces off', () => {
    for (const make of [() => new Goomba(0, 0), () => new Koopa(0, 0, 'buzzy')]) {
      const r = rig();
      r.p.body.y -= px(64);
      r.p.body.onGround = false;
      r.step([]);
      const e = place(r, make(), 0);
      e.body.x = r.p.body.x;
      r.step(['down']);
      r.until(() => !e.alive, [], 60);
      expect(e.alive).toBe(false);
      expect(r.p.body.vy).toBeLessThan(0);
    }
  });

  it('a brick under him breaks and he falls through it', () => {
    const level = flatLevel({ 9: '......=' });
    const r = rig('small', {}, level);
    // Up onto the brick's row from the left: put him above it.
    r.p.body.x = tile(6) + px(2);
    r.p.body.y = tile(5);
    r.p.body.onGround = false;
    r.step([]);
    r.step(['down']);
    r.until(() => r.world.map.get(6, 9) !== T.BRICK, [], 60);
    expect(r.world.map.get(6, 9)).not.toBe(T.BRICK);
    r.until(() => r.p.body.onGround, [], 60);
    expect(r.p.feetY).toBe(px(208));
  });
});

describe('YO-15..YO-20: tongue, mouth, swallow, spit', () => {
  it('a Goomba 32 px ahead is caught: the mouth is full; a Bullet Bill is not', () => {
    const r = rig();
    const g = place(r, new Goomba(0, 0), 32 - 12);
    g.body.y = r.p.body.y - px(4);
    r.step(['attack']);
    r.until(() => !g.alive, [], 15);
    expect(g.alive).toBe(false);
    expect(mouthOf(r.p)).not.toBeNull();
    const s = rig();
    const bill = new BulletBill(0, 0, -1);
    place(s, bill, 20);
    bill.body.y = s.p.body.y;
    s.step(['attack']);
    for (let i = 0; i < 12; i++) s.step([]);
    expect(mouthOf(s.p)).toBeNull();
  });

  it('a Spiny is inedible', () => {
    const r = rig();
    const sp = place(r, new Spiny(0, 0, false), 16);
    sp.body.y = r.p.body.y;
    r.step(['attack']);
    for (let i = 0; i < 12; i++) r.step([]);
    expect(mouthOf(r.p)).toBeNull();
  });

  it('Down on the ground with a full mouth: one more egg after 20 frames', () => {
    const r = rig();
    const g = place(r, new Goomba(0, 0), 16);
    g.body.y = r.p.body.y;
    r.step(['attack']);
    r.until(() => mouthOf(r.p) !== null, [], 20);
    r.until(() => (r.p.scratch._tongue ?? 0) === 0, [], 30);
    r.p.scratch.eggs = 1;
    r.step(['down']);
    for (let i = 0; i < 19; i++) r.step(['down']);
    expect(r.p.scratch.eggs).toBe(1);
    r.step(['down']);
    expect(r.p.scratch.eggs).toBe(2);
    expect(mouthOf(r.p)).toBeNull();
  });

  it('Attack with a full mouth spits the catch; it kills a Koopa 48 px ahead', () => {
    const r = rig();
    const g = place(r, new Goomba(0, 0), 16);
    g.body.y = r.p.body.y;
    r.step(['attack']);
    r.until(() => mouthOf(r.p) !== null && (r.p.scratch._tongue ?? 0) === 0, [], 30);
    const k = place(r, new Koopa(0, 0, 'green'), 48);
    r.step(['attack']);
    expect(r.world.entities.some((e) => e instanceof YoshiSpit)).toBe(true);
    r.until(() => !k.alive, [], 40);
    expect(k.alive).toBe(false);
    expect(mouthOf(r.p)).toBeNull();
  });
});

describe('YO-12, YO-13, YO-21, YO-22: eggs', () => {
  /** Holds Special `hold` frames (the sweep starts level), then lets go. */
  function throwAfter(r: Rig, hold = 1): void {
    for (let i = 0; i < hold; i++) r.step(['special']);
    r.step([]);
  }

  it('the sweep: 0 degrees going up, 75 at the top, -10 at the bottom', () => {
    expect(sweepAngle(0)).toBe(0);
    expect(sweepAngle(64 * (85 / 85) * (75 / 85))).toBeCloseTo(75, 0);
    expect(Math.min(...Array.from({ length: 256 }, (_, t) => sweepAngle(t)))).toBeLessThan(-9);
  });

  it('small max 3, Mushroom 6; a starting life has 3', () => {
    const r = rig();
    expect(r.p.scratch.eggs).toBe(3);
    r.world.powerUp(r.p, 'mushroom');
    r.p.scratch.eggs = 6;
    r.world.powerUp(r.p, 'flower');
    r.world.powerUp(r.p, 'flower');
    expect(r.p.scratch.eggs).toBe(EGGS_BIG);
    const s = rig();
    s.p.scratch.eggs = EGGS_SMALL;
    expect(EGGS_SMALL).toBe(3);
  });

  it('a green egg kills a Goomba; two kill a Koopa; a Buzzy blocks it', () => {
    const r = rig();
    const g = place(r, new Goomba(0, 0), 40);
    g.body.y = r.p.body.y;
    throwAfter(r);
    expect(eggs(r)).toHaveLength(1);
    r.until(() => !g.alive, [], 40);
    expect(g.alive).toBe(false);

    const k = rig('small', { eggs: 3 });
    const koopa = place(k, new Koopa(0, 0, 'green'), 40);
    koopa.body.y = k.p.body.y;
    throwAfter(k);
    k.until(() => eggs(k).length === 0, [], 40);
    expect(koopa.alive).toBe(true);
    for (let i = 0; i < 4; i++) k.step([]);
    throwAfter(k);
    k.until(() => !koopa.alive || eggs(k).length === 0, [], 40);
    expect(koopa.alive).toBe(false);

    const b = rig('small', { eggs: 3 });
    const buzzy = place(b, new Koopa(0, 0, 'buzzy'), 40);
    buzzy.body.y = b.p.body.y + px(6);
    throwAfter(b);
    b.until(() => eggs(b).length === 0, [], 40);
    expect(buzzy.alive).toBe(true);
    const hp = buzzy.classicHp;
    expect(hp === null || hp > 0).toBe(true);
  });

  it('a red egg (Flower) kills a Buzzy Beetle in one', () => {
    const r = rig('fire', { eggs: 6 });
    const buzzy = place(r, new Koopa(0, 0, 'buzzy'), 40);
    buzzy.body.y = r.p.body.y + px(6);
    throwAfter(r);
    r.until(() => !buzzy.alive, [], 40);
    expect(buzzy.alive).toBe(false);
  });

  it('at most two eggs on screen; no eggs, no throw', () => {
    const r = rig('big', { eggs: 6 });
    throwAfter(r);
    throwAfter(r);
    throwAfter(r);
    expect(eggs(r)).toHaveLength(2);
    expect(r.p.scratch.eggs).toBe(4);
    const s = rig('small', { eggs: 0 });
    s.p.scratch.eggs = 0;
    throwAfter(s);
    expect(eggs(s)).toHaveLength(0);
  });

  it('a green egg bounces once off the ground, then breaks', () => {
    const r = rig('small', { eggs: 3 });
    // Aim at the bottom of the sweep: -10 degrees, into the floor.
    const down = Array.from({ length: 256 }, (_, t) => t).find((t) => sweepAngle(t) < -9) as number;
    throwAfter(r, down + 1);
    const egg = eggs(r)[0] as YoshiEgg;
    expect(egg.body.vy).toBeGreaterThan(0);
    r.until(() => egg.bounced, [], 60);
    expect(egg.bounced).toBe(true);
    expect(egg.body.vy).toBeLessThan(0);
  });

  it('a hit while Flower with 6 eggs leaves 3, small', () => {
    const r = rig('fire', { eggs: 6 });
    r.world.hurtPlayer(r.p, 1);
    expect(r.p.powerState).toBe('small');
    expect(r.p.scratch.eggs).toBe(3);
  });
});

describe('YO-26, YO-27: guide and touch labels', () => {
  it('names abilities, never a button letter', () => {
    const PROSE = /\b(button|press|push|tap|hold)\s+[abc]\b|\([abc]\)|\b[abc]\s*:/i;
    const g = Y.guide;
    for (const t of [g.tagline, ...g.controls.map((c) => c.does), ...g.powerups.map((x) => x.does)]) {
      expect(t).not.toMatch(PROSE);
      expect(fontText(t).length, t).toBe(t.length);
    }
  });

  it('TONGUE or SPIT; EGG only with eggs', () => {
    const r = rig();
    expect(Y.touchLabels?.(r.p, r.world)).toMatchObject({ attack: 'TONGUE', special: 'EGG' });
    r.p.scratch.eggs = 0;
    expect(Y.touchLabels?.(r.p, r.world)?.special).toBeNull();
  });
});
