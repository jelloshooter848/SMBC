import { describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import type { Action } from '@engine/input/actions';
import { CHARACTERS, CLASSIC_EXTRAS, skinHost, skinsOf } from '@game/characters/registry';
import { LUIGI } from '@game/characters/luigi';
import { LUIGI_CLASSIC } from '@game/characters/luigi/classic';
import { PEACH_CLASSIC } from '@game/characters/peach/classic';
import type { CharacterDef } from '@game/characters/character';
import { CLASSIC_HIT_RESPONSES } from '@game/characters/classic/power';
import { CLASSIC_SWIM } from '@game/rules/classic-swim';
import { SPRING_GREEN_BOOST, SPRING_RISE_GRAVITY } from '@game/entities/objects/spring';
import { Bowser } from '@game/entities/enemies/bowser';
import { classicMaxHp } from '@game/rules/classic-enemies';
import { fontText } from '@game/hud/text';
import { PALETTES, SPRITES } from '@content/sprites';
import { CLASSIC_RESUME_KEY } from '@game/run-resume';
import type { ClassicFileRef } from '@game/original-files';
import { Rig, flatLevel } from './classic-plumber-harness';
import { makeGame, store, useStorage } from './heroes-harness';

// Owner decision for 0.5.0 (#179): in Classic, Peach plays EXACTLY as the original's, which is
// Luigi's skin (Luigi skins 8 and 10, "Princess Toadstool", BmdInfo.as 758, 766): Luigi's moves,
// jump, fireballs, springs, Bowser's hit points and every other rule; only her look (sprites, face,
// name) is hers. Her SMB2 abilities (vegetables, float, riding, Power Squat) are gone from Classic.

useStorage();

/** B-L: SMB's FILE 1 (an old single or per-set slot migrates into it). */
const F1: ClassicFileRef = { set: 'smb', slot: 1 };

/** A run of `def` holding `keys(f)` for `n` frames; the body each frame, and the projectiles. */
function trace(def: CharacterDef, power: string, keys: (f: number) => Action[], n = 240): string[] {
  const r = new Rig(def, flatLevel(), 'classic', power);
  r.settle();
  const out: string[] = [];
  for (let f = 0; f < n; f++) {
    r.step(keys(f));
    const b = r.p.body;
    out.push(`${b.x},${b.y},${b.vx},${b.vy},${r.p.powerState},${r.world.countProjectiles(r.p, 'fireball')}`);
  }
  return out;
}

describe("Classic Peach is Luigi's look (owner decision, #179)", () => {
  it('a Classic-only skin on Luigi’s slot, counted as Luigi, never a Campaign hero', () => {
    expect(PEACH_CLASSIC.id).toBe('peach');
    expect(PEACH_CLASSIC.name).toBe('Peach');
    expect(PEACH_CLASSIC.lookOf).toBe('luigi');
    expect(PEACH_CLASSIC.rules).toBe('classic');
    expect(PEACH_CLASSIC.notInOriginal).toBeUndefined();
    expect(skinHost(PEACH_CLASSIC)).toBe(LUIGI);
    expect(skinsOf(LUIGI)).toContain(PEACH_CLASSIC);
    expect(CLASSIC_EXTRAS).toContain(PEACH_CLASSIC);
    expect(CHARACTERS).not.toContain(PEACH_CLASSIC);
  });

  it("Luigi's rules, not hers: movement, damage, hitboxes, behaviour, death, springs", () => {
    for (const k of [
      'movement',
      'damage',
      'stomps',
      'crouches',
      'canBreakBricks',
      'hitbox',
      'hurtbox',
      'behaviour',
      'deathHop',
      'axeWalk',
      'blockPowerUp',
      'jumpSfx',
      'touchLabels',
      'drawLook',
    ] as const)
      expect(PEACH_CLASSIC[k], k).toBe(LUIGI_CLASSIC[k]);
    // No row of her own anywhere: Luigi's spring numbers, swim and hit response.
    expect(SPRING_GREEN_BOOST.peach).toBeUndefined();
    expect(SPRING_RISE_GRAVITY.peach).toBeUndefined();
    expect(CLASSIC_SWIM.peach).toBeUndefined();
    expect(CLASSIC_HIT_RESPONSES.peach).toBeUndefined();
    expect((PEACH_CLASSIC.movement as { float?: unknown }).float).toBeUndefined();
  });

  it('plays frame for frame as Luigi: walk, run, jump, float-less fall, fireballs', () => {
    const run = (f: number): Action[] =>
      f < 60
        ? ['right']
        : f < 120
          ? ['right', 'attack', ...(f % 30 < 15 ? (['jump'] as Action[]) : [])]
          : f % 20 < 2
            ? ['attack']
            : ['jump'];
    for (const power of ['small', 'big', 'fire'])
      expect(trace(PEACH_CLASSIC, power, run), power).toEqual(trace(LUIGI_CLASSIC, power, run));
  });

  it('no vegetables, no lift: Special does nothing, as for Luigi', () => {
    const special = (f: number): Action[] =>
      f % 10 === 0 ? ['special'] : f % 10 === 5 ? ['down', 'special'] : [];
    expect(trace(PEACH_CLASSIC, 'big', special, 120)).toEqual(trace(LUIGI_CLASSIC, 'big', special, 120));
    const r = new Rig(PEACH_CLASSIC, flatLevel(), 'classic', 'big');
    r.settle();
    for (let i = 0; i < 60; i++) r.step(i % 2 ? [] : ['special']);
    expect(r.world.entities.filter((e) => e.constructor.name.startsWith('Thrown'))).toHaveLength(0);
  });

  it("Bowser has Luigi's hit points against her", () => {
    const hp = (def: CharacterDef) => {
      const r = new Rig(def, flatLevel(), 'classic', 'big');
      return classicMaxHp(new Bowser(0, 0), r.world);
    };
    expect(hp(PEACH_CLASSIC)).toBe(hp(LUIGI_CLASSIC));
  });

  it('only her look: every frame she shows is on her own sheet, in her palettes', () => {
    const r = new Rig(PEACH_CLASSIC, flatLevel(), 'classic', 'small');
    r.settle();
    const seen = new Set<string>();
    const look = () => {
      const s = PEACH_CLASSIC.sprite(r.p, r.world.frame, false);
      expect(s.sheet).toBe('peach');
      expect(SPRITES.peach?.frames[s.frame], s.frame).toBeDefined();
      expect(PALETTES.default[s.palette ?? ''], s.palette).toBeDefined();
      seen.add(s.frame);
    };
    for (const power of ['small', 'big', 'fire']) {
      r.p.powerState = power;
      r.p.refitHitbox();
      for (let f = 0; f < 90; f++) {
        r.step(f < 30 ? ['right'] : f < 50 ? ['jump'] : f < 70 ? ['down'] : f % 4 === 0 ? ['attack'] : []);
        look();
      }
    }
    expect([...seen].some((f) => f.startsWith('small-'))).toBe(true);
    expect(seen.has('stand') || seen.has('walk-0')).toBe(true);
    expect(PEACH_CLASSIC.portrait.sheet).toBe('peach');
  });

  it('her guide is Luigi’s rules with her name, in the font, no button letters', () => {
    const g = PEACH_CLASSIC.guide;
    expect(g.tagline).toMatch(/Luigi/);
    for (const line of [g.tagline, ...g.controls.map((c) => c.does)])
      expect(fontText(line).length).toBeGreaterThan(0);
  });
});

describe('older Classic Peach runs carry over (owner decision, #179)', () => {
  it('a resume slot as Peach (with Survival) plays on as Luigi in her look', () => {
    store.clear();
    const settings = { ...defaultSettings() };
    settings.classic = { ...settings.classic, gameMode: 'survival' };
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    store.set(
      CLASSIC_RESUME_KEY,
      JSON.stringify({
        v: 1,
        levelId: '1-2',
        rules: 'classic',
        hero: 'peach',
        score: 100,
        coins: 3,
        lives: 2,
        world: 1,
        stage: 2,
        powerState: 'big',
        hp: 0,
        kit: {},
        warped: false,
        checkpoint: null,
        survival: { fallen: ['peach', 'mario'], reviveAllowed: false },
      }),
    );
    // B-L: the old slot migrates into FILE 1 on the first read.
    expect(h.game.classicFiles('smb')[0]?.run.hero).toBe('peach');
    expect(h.game.resumeClassic(F1)).toBe(true);
    expect(h.game.state.character).toBe(PEACH_CLASSIC);
    expect(h.game.state.character.movement).toBe(LUIGI_CLASSIC.movement);
    expect(h.game.slotOf(PEACH_CLASSIC)).toBe(LUIGI);
    expect(settings.classicSkins?.luigi).toBe('peach');
    expect(h.game.survival?.isFallen('luigi')).toBe(true);
    expect(h.game.survival?.isFallen('mario')).toBe(true);
    expect(h.game.survival?.isFallen('link')).toBe(false);
  });

  it('a saved skin choice and a link as Peach start Luigi in her look', () => {
    const settings = { ...defaultSettings(), classicSkins: { luigi: 'peach' } };
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    h.game.classicGame(PEACH_CLASSIC, '1-1', { ref: F1 });
    expect(h.game.skinFor(LUIGI)).toBe(PEACH_CLASSIC);
    expect(h.game.state.character).toBe(PEACH_CLASSIC);
    expect(h.game.state.character.behaviour).toBe(LUIGI_CLASSIC.behaviour);
  });
});
