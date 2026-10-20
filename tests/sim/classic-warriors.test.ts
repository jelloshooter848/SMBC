import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { px } from '@engine/math/units';
import { parseTextMap } from '@game/level/textmap';
import type { LevelData } from '@game/level/schema';
import { T } from '@game/level/tiles';
import { CHARACTERS, CLASSIC_EXTRAS, heroFor } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import {
  JOB,
  JOB_LABELS,
  SWING_DAMAGE,
  WARRIORS_CLASSIC,
  WARRIORS_PROFILE,
  cureReady,
  jobOf,
} from '@game/characters/warriors/classic';
import { WL_BOLT, WL_FIRE, WL_ICE, WarriorSpell } from '@game/characters/warriors/classic-weapons';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import type { Enemy } from '@game/entities/enemies/enemy';
import { PowerUp } from '@game/entities/objects/powerup';
import { SPRING_GREEN_BOOST, SPRING_RISE_GRAVITY } from '@game/entities/objects/spring';
import { fontText } from '@game/hud/text';
import { PALETTES, SPRITES } from '@content/sprites/index';
import { Rig, flatLevel, measureJump } from './classic-plumber-harness';
import { makeGame, useStorage } from './heroes-harness';

// The Warriors of Light, a Classic-only hero (bug-reports/2026-10-07-warriors-of-light-build-classic-character.md,
// WL-1..WL-24, with the owner's recommended WL-M answers from docs/classic/WARRIORS_OF_LIGHT.md):
// the report's acceptance checks with rules 'classic'.

useStorage();

const W = WARRIORS_CLASSIC;
const SUB = 256;

function rig(power = 'small', kit: Record<string, number> = {}, level: LevelData = flatLevel()): Rig {
  const r = new Rig(W, level, 'classic', power);
  Object.assign(r.p.scratch, kit);
  r.settle();
  return r;
}
const spells = (r: Rig) =>
  r.world.entities.filter((e): e is WarriorSpell => e instanceof WarriorSpell && e.alive);
const dead = (e: Enemy) => (e.classicHp ?? 1) <= 0 || !e.alive;
/** The hero's body centre (subpixels). */
const cx = (r: Rig) => r.p.body.x + (r.p.body.w >> 1);
/** Puts an enemy with its left edge `ahead` px in front of the hero's centre, on the floor. */
function place<E extends Enemy>(r: Rig, e: E, ahead: number): E {
  e.body.x = cx(r) + px(ahead);
  e.body.y = r.p.body.y + r.p.body.h - e.body.h;
  r.world.spawn(e);
  return e;
}
/** One action: press `hold` + attack, then `frames` frames with nothing held. */
function act(r: Rig, hold: Action[] = [], frames = 31): void {
  r.step([...hold, 'attack']);
  for (let i = 0; i < frames; i++) r.step([]);
}

describe('definition and roster (WL-2, WL-4, TG-41..43)', () => {
  it('one Classic-only def, after Vic Viper in CLASSIC_EXTRAS, never a Current hero', () => {
    expect(W.id).toBe('warriors');
    expect(W.name).toBe('Warriors of Light');
    expect(W.hudName).toBe('WARRIOR');
    expect(W.thanksName).toBe('WARRIOR');
    expect(W.rules).toBe('classic');
    expect(W.stomps).toBe(false);
    expect(W.crouches).toBe(true);
    expect(W.headBumps?.({} as never)).toBe(false);
    expect(W.passesHiddenBlocks).toBe(true);
    expect(W.meleeStrikesBlocks).toBe(true);
    expect(W.drop).toBeUndefined();
    expect(W.devKit?.()).toEqual({});
    expect(W.meter).toBeUndefined();
    expect(W.tools).toBeUndefined();
    // Next after Vic Viper (later extras, Peach and Arthur, come after it).
    expect(CLASSIC_EXTRAS[CLASSIC_EXTRAS.findIndex((c) => c.id === 'vicviper') + 1]).toBe(W);
    expect(CHARACTERS).not.toContain(W);
    expect(heroFor(W, 'classic')).toBe(W);
    expect(fontText(W.hudName)).toBe(W.hudName);
    for (const l of JOB_LABELS) expect(fontText(`${l} CURE 1`)).toBe(`${l} CURE 1`);
    expect(SPRING_GREEN_BOOST.warriors).toBeCloseTo(0x08555, -1);
    expect(SPRING_RISE_GRAVITY.warriors).toBeCloseTo(0x0031c, -1);
  });

  it('in Classic runs only, never under Current', () => {
    const h = makeGame({ dev: true });
    expect(h.game.rosterFor('current')).not.toContain(W);
    const roster = h.game.rosterFor('classic');
    expect(roster[roster.findIndex((c) => c.id === 'vicviper') + 1]).toBe(W);
    expect(h.game.roster).not.toContain(W);
  });

  it('Current heroes set none of the new optional fields (TG-23, TG-38)', () => {
    for (const c of CHARACTERS) {
      expect(c.thanksName, c.id).toBeUndefined();
      expect(c.passesHiddenBlocks, c.id).toBeUndefined();
      expect(c.portraitFor, c.id).toBeUndefined();
      expect(c.keepOnDeath, c.id).toBeUndefined();
    }
  });

  it('every pose of every job and outfit exists in the sheet, with its palettes', () => {
    const frames = SPRITES.warriors?.frames ?? {};
    const poses = [
      'stand',
      'jump',
      'fall',
      'crouch',
      'swing-0',
      'swing-1',
      'swing-2',
      'windup-0',
      'windup-1',
    ];
    for (const job of ['fighter', 'thief', 'bmage', 'wmage'])
      for (const pose of [...poses, 'cast', 'hurt', 'die', 'walk-0', 'walk-1', 'walk-2', 'walk-3'])
        expect(frames[`${job}-${pose}`], `${job}-${pose}`).toBeDefined();
    for (const pal of ['fighter', 'thief', 'bmage', 'wmage', 'knight', 'ninja', 'bwizard', 'wwizard']) {
      expect(PALETTES.default?.[`war-${pal}`]).toBeDefined();
      for (let i = 0; i < 4; i++) expect(PALETTES.default?.[`war-${pal}-star-${i}`]).toBeDefined();
    }
    for (const f of [...WL_FIRE.frames, ...WL_ICE.frames, ...WL_BOLT.frames, 'cure-0', 'cure-1'])
      expect(SPRITES['warriors-fx']?.frames[f], f).toBeDefined();
  });

  it('hitbox 14 x 26, crouched 14 x 15, in every state and job (WL-3)', () => {
    for (const power of ['small', 'big', 'fire']) {
      const r = rig(power, { job: JOB.bmage });
      expect([r.p.body.w / SUB, r.p.body.h / SUB]).toEqual([14, 26]);
      r.step(['down']);
      expect([r.p.body.w / SUB, r.p.body.h / SUB]).toEqual([14, 15]);
    }
  });
});

describe('movement (WL-6)', () => {
  it('standing jump: apex 68.3 ± 1 px, lands after 53 ± 1 frames; a tap jumps as high as a hold', () => {
    const held = measureJump(W, 0, Infinity);
    expect(Math.abs(held.apex - 68.3)).toBeLessThanOrEqual(1);
    expect(Math.abs(held.airtime - 53)).toBeLessThanOrEqual(1);
    expect(Math.abs(held.apexFrame - 26)).toBeLessThanOrEqual(1);
    const tap = measureJump(W, 0, 1);
    expect(tap.apex).toBe(held.apex);
    expect(tap.airtime).toBe(held.airtime);
  });

  it('Right for 60 frames from rest: 100 ± 1 px at full speed from the first frame; stops on release', () => {
    const r = rig();
    const x0 = r.p.body.x;
    r.step(['right']);
    expect(r.p.body.vx).toBe(WARRIORS_PROFILE.maxWalk);
    for (let i = 1; i < 60; i++) r.step(['right']);
    expect(Math.abs((r.p.body.x - x0) / SUB - 100)).toBeLessThanOrEqual(1);
    const x1 = r.p.body.x;
    r.step([]);
    expect(r.p.body.vx).toBe(0);
    expect(r.p.body.x).toBe(x1);
  });

  it('a floor jump under water rises about 130 px (WL-8, WL-M15)', () => {
    const level = parseTextMap(
      [
        'id: deep',
        'theme: water',
        'swim: true',
        'time: 300',
        'start: 4,27',
        'height: 30',
        'camera: free',
        '',
        '[tiles]',
        ...Array.from({ length: 30 }, (_, y) =>
          y >= 28 ? '#'.repeat(48) : y === 2 ? 'w'.repeat(48) : '.'.repeat(48),
        ),
      ].join('\n'),
    );
    const r = new Rig(W, level);
    for (let i = 0; i < 120; i++) r.step();
    expect(r.p.inWater).toBe(true);
    const feet0 = r.p.body.y + r.p.body.h;
    let top = feet0;
    r.step(['jump']);
    for (let i = 0; i < 200 && !r.p.body.onGround; i++) {
      top = Math.min(top, r.p.body.y + r.p.body.h);
      r.step([]);
    }
    expect(Math.abs((feet0 - top) / SUB - 130)).toBeLessThanOrEqual(2);
  });
});

describe('swings (WL-5, WL-12, WL-M1)', () => {
  it('Fighter: one swing kills a Goomba, two a Koopa', () => {
    const r = rig();
    const g = place(r, new Goomba(0, 0), 8);
    r.step(['attack']);
    expect(dead(g)).toBe(true);
    const k = rig();
    k.p.invuln = 10000;
    const koopa = place(k, new Koopa(0, 0, 'green'), 8);
    act(k);
    expect(dead(koopa)).toBe(false);
    // It walked on through the invulnerable hero: back into reach.
    koopa.body.x = cx(k) + px(8);
    act(k);
    expect(dead(koopa)).toBe(true);
  });

  it('Thief: five swings per Goomba; White Mage staff: 100', () => {
    const r = rig('small', { job: JOB.thief });
    r.p.invuln = 10000;
    const g = place(r, new Goomba(0, 0), 8);
    let swings = 0;
    while (!dead(g) && swings < 10) {
      act(r);
      swings++;
      if (!dead(g)) g.body.x = cx(r) + px(8);
    }
    expect(swings).toBe(5);
    expect(SWING_DAMAGE).toEqual({ 0: 300, 1: 50, 2: 0, 3: 100 });
    const m = rig('small', { job: JOB.wmage });
    expect(W.behaviour.meleeDamage?.(m.p, g).amount).toBe(100);
  });

  it('on the ground: rooted for the 30 frames of the swing, even with Right held; the box lives all 30', () => {
    const r = rig();
    const x0 = r.p.body.x;
    r.step(['right', 'attack']);
    let live = r.p.activeMelee ? 1 : 0;
    for (let i = 1; i < 30; i++) {
      r.step(['right']);
      expect(r.p.body.x).toBe(x0);
      if (r.p.activeMelee) live++;
    }
    expect(r.p.body.x).toBe(x0);
    expect(live).toBe(30);
    r.step(['right']);
    expect(r.p.activeMelee).toBeNull();
    expect(r.p.body.x).toBeGreaterThan(x0);
  });

  it('a press during a swing is ignored, not buffered', () => {
    const r = rig();
    r.step(['attack']);
    r.step([]);
    r.step(['attack']);
    for (let i = 0; i < 28; i++) r.step([]);
    r.step([]);
    expect(r.p.activeMelee).toBeNull();
  });

  it('a jump on frame 5 ends the swing: an enemy entering the box afterwards is not hit', () => {
    const r = rig();
    r.step(['attack']);
    for (let i = 0; i < 3; i++) r.step([]);
    r.step(['jump']);
    expect(r.p.body.onGround).toBe(false);
    expect(r.p.activeMelee).toBeNull();
    const g = place(r, new Goomba(0, 0), 8);
    g.body.y = r.p.body.y + r.p.body.h - g.body.h;
    r.step([]);
    expect(g.classicHp ?? 250).toBe(250);
  });

  it('a swing breaks a plain brick and bumps a ? block (WL-12)', () => {
    const r = rig('small', {}, flatLevel({ 11: '.......=', 12: '.......?' }));
    r.step(['attack']);
    for (let i = 0; i < 31; i++) r.step([]);
    expect(r.world.map.get(7, 11)).toBe(T.AIR);
    expect(r.world.map.get(7, 12)).not.toBe(T.Q_COIN);
  });

  it('down + attack does nothing for the Fighter (no attack from a crouch)', () => {
    const r = rig();
    r.step(['down', 'attack']);
    expect(r.p.activeMelee).toBeNull();
  });
});

describe('Black Mage spells (WL-13..WL-15, WL-M9)', () => {
  const bm = (level?: LevelData, power = 'small') => rig(power, { job: JOB.bmage }, level);

  it('Fire appears on frame 30 after the press; the hero is rooted 48 frames', () => {
    const r = bm();
    const x0 = r.p.body.x;
    r.step(['right', 'attack']);
    for (let i = 1; i < 30; i++) {
      r.step(['right']);
      expect(spells(r)).toHaveLength(0);
    }
    r.step(['right']);
    expect(spells(r)).toHaveLength(1);
    expect(spells(r)[0]?.spec).toBe(WL_FIRE);
    for (let i = 31; i < 48; i++) r.step(['right']);
    expect(r.p.body.x).toBe(x0);
    r.step(['right']);
    expect(r.p.body.x).toBeGreaterThan(x0);
  });

  it('Fire passes a pipe and a Koopa and flies on; it breaks a brick and flies on', () => {
    const level = flatLevel({ 11: '..........[]', 12: '..........{}....=' });
    const r = bm(level);
    r.p.invuln = 10000;
    const k = place(r, new Koopa(0, 0, 'green'), 120);
    act(r, [], 30);
    const fire = spells(r)[0] as WarriorSpell;
    for (let i = 0; i < 40; i++) r.step([]);
    expect(fire.alive).toBe(true);
    expect(fire.body.x).toBeGreaterThan(k.body.x + k.body.w);
    expect(k.classicHp).toBe(200);
    expect(r.world.map.get(16, 12)).toBe(T.AIR);
  });

  it('Bolt (up + attack) kills a Koopa 50 px ahead high above the ground', () => {
    const r = bm();
    const k = place(r, new Koopa(0, 0, 'green'), 44);
    k.body.y = px(40);
    r.step(['up', 'attack']);
    for (let i = 0; i < 31; i++) r.step([]);
    expect(spells(r)[0]?.spec).toBe(WL_BOLT);
    expect(dead(k)).toBe(true);
    const b = spells(r)[0] as WarriorSpell;
    expect([b.body.w / SUB, b.body.h / SUB]).toEqual([27, 240]);
    expect(b.body.y).toBe(r.world.camera.y + px(5));
  });

  it('Ice (down + attack, also crouched): one 48 x 48 burst for 22 frames', () => {
    const r = bm();
    r.step(['down']);
    r.step(['down', 'attack']);
    for (let i = 0; i < 30; i++) r.step(['down']);
    const ice = spells(r)[0] as WarriorSpell;
    expect(ice.spec).toBe(WL_ICE);
    let alive = 0;
    for (let i = 0; i < 40; i++) {
      if (ice.alive) alive++;
      r.step(['down']);
    }
    expect(Math.abs(alive - 22)).toBeLessThanOrEqual(1);
  });

  it('a ground jump in the wind-up casts nothing; a hit in it casts nothing (WL-M8)', () => {
    const r = bm();
    r.step(['attack']);
    for (let i = 0; i < 10; i++) r.step([]);
    r.step(['jump']);
    for (let i = 0; i < 60; i++) r.step([]);
    expect(spells(r)).toHaveLength(0);
    const h = bm(undefined, 'big');
    h.step(['attack']);
    for (let i = 0; i < 10; i++) h.step([]);
    h.world.hurtPlayer(h.p, 1);
    for (let i = 0; i < 60; i++) h.step([]);
    expect(spells(h)).toHaveLength(0);
    expect(h.p.powerState).toBe('small');
    expect(jobOf(h.p)).toBe(JOB.bmage);
  });
});

describe('White Mage Cure (WL-M1, WL-M2)', () => {
  it('small: down + attack brings back the Mushroom once a stage; HUD CURE 1, hidden powered up, then CURE 0', () => {
    const r = rig('small', { job: JOB.wmage });
    expect(W.hudExtra?.(r.p)).toBe('W.MAGE CURE 1');
    r.step(['down', 'attack']);
    for (let i = 0; i < 29; i++) r.step(['down']);
    expect(r.p.powerState).toBe('small');
    r.step(['down']);
    expect(r.p.powerState).toBe('big');
    expect(r.p.transition?.kind).toBe('freeze');
    expect(cureReady(r.p)).toBe(false);
    expect(W.hudExtra?.(r.p)).toBe('W.MAGE');
    expect(r.events.some((e) => e.e.type === 'say' && e.e.text === 'Cure used.')).toBe(true);
    for (let i = 0; i < 120; i++) r.step([]);
    r.world.hurtPlayer(r.p, 1);
    for (let i = 0; i < 120; i++) r.step([]);
    expect(r.p.powerState).toBe('small');
    expect(W.hudExtra?.(r.p)).toBe('W.MAGE CURE 0');
    r.step(['down', 'attack']);
    for (let i = 0; i < 60; i++) r.step(['down']);
    expect(r.p.powerState).toBe('small');
  });

  it('with the Mushroom, Cure does not start; up + attack does nothing', () => {
    const r = rig('big', { job: JOB.wmage });
    r.step(['down', 'attack']);
    expect(r.p.scratch._act ?? 0).toBe(0);
    r.step(['up', 'attack']);
    expect(r.p.scratch._act ?? 0).toBe(0);
    expect(r.p.activeMelee).toBeNull();
  });
});

describe('no head bump, no stomp (WL-20, WL-21)', () => {
  it('a jump under a ? block: no item, no bump', () => {
    const r = rig('small', {}, flatLevel({ 9: '......?' }));
    r.step(['jump']);
    for (let i = 0; i < 70; i++) r.step([]);
    expect(r.world.map.get(6, 9)).toBe(T.Q_COIN);
    expect(r.world.state.coins).toBe(0);
    expect(r.world.entities.some((e) => e instanceof PowerUp)).toBe(false);
  });

  it('a hidden block is passed through and never revealed', () => {
    const r = rig('small', {}, flatLevel({ 9: '......2' }));
    const feet0 = r.p.body.y + r.p.body.h;
    let top = feet0;
    r.step(['jump']);
    for (let i = 0; i < 70; i++) {
      top = Math.min(top, r.p.body.y + r.p.body.h);
      r.step([]);
    }
    expect(r.world.map.get(6, 9)).toBe(T.HIDDEN_COIN);
    expect((feet0 - top) / SUB).toBeGreaterThan(60);
    // Classic Mario's head still stops at it and reveals it.
    const m = new Rig(MARIO, flatLevel({ 9: '......2' }));
    m.settle();
    m.step(['jump']);
    for (let i = 0; i < 70; i++) m.step(['jump']);
    expect(m.world.map.get(6, 9)).not.toBe(T.HIDDEN_COIN);
  });

  it('landing on a Goomba hurts', () => {
    const r = rig('big');
    const g = place(r, new Goomba(0, 0), -8);
    g.body.y = r.p.body.y + r.p.body.h + px(2) - g.body.h;
    r.p.body.y -= px(30);
    for (let i = 0; i < 20; i++) r.step([]);
    expect(r.p.powerState).toBe('small');
  });
});

describe('class switch (WL-17, WL-M3, WL-10)', () => {
  it('special + right: Black Mage, keeping the Mushroom; each direction picks its class', () => {
    const r = rig('big');
    r.step(['right', 'special']);
    expect(jobOf(r.p)).toBe(JOB.bmage);
    expect(r.p.powerState).toBe('big');
    for (const [dir, job] of [
      ['down', JOB.thief],
      ['left', JOB.wmage],
      ['up', JOB.fighter],
    ] as const) {
      r.step([]);
      r.step([dir, 'special']);
      expect(jobOf(r.p)).toBe(job);
    }
  });

  it('special alone or with two directions does nothing; in the air it works', () => {
    const r = rig();
    r.step(['special']);
    r.step([]);
    r.step(['up', 'right', 'special']);
    expect(jobOf(r.p)).toBe(JOB.fighter);
    r.step([]);
    r.step(['jump']);
    r.step(['jump']);
    r.step(['left', 'special']);
    expect(r.p.body.onGround).toBe(false);
    expect(jobOf(r.p)).toBe(JOB.wmage);
  });

  it('Special + Left or Right switches in place: no walking while CLASS is held', () => {
    for (const dir of ['left', 'right'] as const) {
      const r = rig();
      const x = r.p.body.x;
      for (let i = 0; i < 10; i++) r.step([dir, 'special']);
      expect(r.p.body.x).toBe(x);
      expect(jobOf(r.p)).toBe(dir === 'left' ? JOB.wmage : JOB.bmage);
      r.step([dir]);
      r.step([dir]);
      expect(r.p.body.x).not.toBe(x);
    }
  });

  it('the Cure text is announced when it shows or changes; hidden for every other class', () => {
    const r = rig('small', { job: JOB.fighter });
    r.step([]);
    expect(W.hudExtra?.(r.p)).toBe('FIGHTER');
    r.step(['left', 'special']);
    r.step([]);
    const said = r.events.flatMap(({ e }) => (e.type === 'say' ? [e.text] : []));
    expect(said).toContain('Cure ready.');
    expect(W.hudExtra?.(r.p)).toBe('W.MAGE CURE 1');
  });

  it('is announced by ability names, and flashes only without Reduce flashing', () => {
    const r = rig();
    r.step(['right', 'special']);
    const said = r.events.flatMap(({ e }) => (e.type === 'say' ? [e.text] : []));
    expect(said).toEqual(['Black Mage. ATTACK: Fire. UP and ATTACK: Bolt. DOWN and ATTACK: Ice.']);
    expect(W.sprite(r.p, 0, false).palette).toMatch(/^war-bmage-star-\d$/);
    expect(W.sprite(r.p, 0, true).palette).toBe('war-bmage');
    for (let i = 0; i < 10; i++) r.step([]);
    expect(W.sprite(r.p, 0, false).palette).toBe('war-bmage');
  });

  it('the Fire Flower changes the outfit only (WL-9, WL-M5)', () => {
    const r = rig('fire');
    expect(W.sprite(r.p, 0, true).palette).toBe('war-knight');
    expect(W.behaviour.meleeDamage?.(r.p, new Goomba(0, 0)).amount).toBe(300);
    r.step(['left', 'special']);
    expect(W.sprite(r.p, 0, true).palette).toBe('war-wwizard');
  });

  it('the class is kept through a death and a re-pick of the hero, never by another hero', () => {
    const h = makeGame({ dev: true });
    const s = h.game.state;
    h.game.setHero(0, W);
    s.kit = { job: JOB.thief, cureAt: 101 };
    h.game.resetAfterDeath();
    expect(s.kit).toEqual({ job: JOB.thief });
    h.game.setHero(0, W);
    expect(s.kit).toEqual({ job: JOB.thief });
    expect(W.portraitFor?.(s.kit)).toEqual({ sheet: 'warriors', palette: 'war-thief', frame: 'thief-stand' });
    h.game.setHero(0, MARIO);
    expect(s.kit).toEqual({});
  });

  it('a co-op drop-in keeps its class', () => {
    const r = rig('big', { job: JOB.wmage });
    W.behaviour.onRespawn?.(r.p, r.world);
    expect(jobOf(r.p)).toBe(JOB.wmage);
  });
});

describe('guide and touch (WL guide, TG-22, TG-40)', () => {
  it('the guide names abilities, never buttons, and the font draws it', () => {
    const g = W.guide;
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
    expect(g.controls.find((c) => c.action === 'special')?.touch).toBe('CLASS');
  });

  it('touch labels follow the class', () => {
    const r = rig();
    expect(W.touchLabels?.(r.p, r.world)).toEqual({ attack: 'SWORD', special: 'CLASS', select: null });
    r.step(['right', 'special']);
    expect(W.touchLabels?.(r.p, r.world).attack).toBe('SPELL');
  });
});
