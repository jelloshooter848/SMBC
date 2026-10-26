import { describe, expect, it } from 'vitest';
import { CHARACTERS, CLASSIC_EXTRAS, heroFor } from '@game/characters/registry';
import { SAMUS } from '@game/characters/samus';
import {
  SAMUS_CLASSIC,
  SAMUS_CLASSIC_PROFILE,
  crouchPose,
  flipping,
  inBall,
} from '@game/characters/samus/classic';
import { DARKPIT_CLASSIC, PIT_CLASSIC } from '@game/characters/pit/classic';
import type { CharacterDef } from '@game/characters/character';
import { ClassicBomb } from '@game/characters/samus/classic-bomb';
import { Projectile } from '@game/entities/projectiles/projectile';
import { SPRING_GREEN_BOOST, SPRING_RISE_GRAVITY } from '@game/entities/objects/spring';
import { fontText } from '@game/hud/text';
import { sfx } from '@content/sfx/sfx';
import { Rig, flatLevel } from './classic-plumber-harness';
import { makeGame, useStorage } from './heroes-harness';

// Pit and Dark Pit, Classic-only heroes (bug-reports/2026-10-07-pit-build-classic-character.md, Part A,
// PI-1..PI-25): the report's acceptance checks with rules 'classic', against Classic Samus.

useStorage();

const shots = (r: Rig) =>
  r.world.entities.filter((e): e is Projectile => e instanceof Projectile && e.alive && e.owner === r.p);
const bombs = (r: Rig) => r.world.entities.filter((e) => e instanceof ClassicBomb && e.alive);

function rig(def: CharacterDef, power = 'small', kit: Record<string, number> = {}, level = flatLevel()): Rig {
  const r = new Rig(def, level, 'classic', power);
  Object.assign(r.p.scratch, kit);
  r.settle();
  return r;
}
/** The newest shot's centre above the feet now (px). */
const shotHeight = (r: Rig): number => {
  const s = shots(r).at(-1) as Projectile;
  return (r.p.feetY - (s.body.y + (s.body.h >> 1))) / 256;
};

describe('Pit and Dark Pit: definitions (PI-1, PI-2, TG-41)', () => {
  it('two Classic-only defs built on Classic Samus, in CLASSIC_EXTRAS only', () => {
    for (const [d, id, name, hud] of [
      [PIT_CLASSIC, 'pit', 'Pit', 'PIT'],
      [DARKPIT_CLASSIC, 'darkpit', 'Dark Pit', 'D.PIT'],
    ] as const) {
      expect(d.id).toBe(id);
      expect(d.name).toBe(name);
      expect(d.hudName).toBe(hud);
      expect(d.rules).toBe('classic');
      expect(d.portrait).toEqual({ sheet: 'samus', palette: id, frame: 'idle' });
      expect(d.movement).toBe(SAMUS_CLASSIC_PROFILE);
      expect(d.damage).toEqual(SAMUS_CLASSIC.damage);
      expect(d.crouches).toBe(false);
      expect(d.stomps).toBe(false);
      expect(d.jumpSfx({} as never)).toBe('pit-jump');
      expect(CLASSIC_EXTRAS).toContain(d);
      expect(CHARACTERS).not.toContain(d);
      expect(heroFor(d, 'classic')).toBe(d);
      expect(fontText(d.hudName)).toBe(d.hudName);
      // TG-22: no Campaign HUD extras.
      expect(d.meter).toBeUndefined();
      expect(d.startHp).toBeUndefined();
    }
    const i = CLASSIC_EXTRAS.indexOf(PIT_CLASSIC);
    expect(CLASSIC_EXTRAS[i + 1]).toBe(DARKPIT_CLASSIC);
    for (const id of ['pit-shoot', 'pit-jump']) expect(sfx.some((s) => s.id === id)).toBe(true);
    expect(SPRING_GREEN_BOOST.pit).toBe(SPRING_GREEN_BOOST.samus);
    expect(SPRING_RISE_GRAVITY.darkpit).toBe(SPRING_RISE_GRAVITY.samus);
  });

  it('Classic Samus and Campaign Samus are unchanged (TG-38)', () => {
    expect(heroFor(SAMUS, 'classic')).toBe(SAMUS_CLASSIC);
    expect(heroFor(SAMUS, 'campaign')).toBe(SAMUS);
    expect(SAMUS_CLASSIC.jumpSfx({} as never)).toBe('jump-big');
    expect(SAMUS.pickSfx).toBeUndefined();
  });

  it('draws with its own palettes, Varia-style with the Flower', () => {
    const r = rig(PIT_CLASSIC);
    expect(PIT_CLASSIC.sprite(r.p, 0, true).palette).toBe('pit');
    const f = rig(DARKPIT_CLASSIC, 'fire');
    expect(DARKPIT_CLASSIC.sprite(f.p, 0, true).palette).toBe('darkpit-varia');
  });
});

describe('PI-7, PI-3: crouch-walk', () => {
  it('Down + Right for 60 frames: 75 px in the crouch pose and the 12 x 15 box; Classic Samus 0 px', () => {
    const r = rig(PIT_CLASSIC);
    const x0 = r.p.body.x;
    for (let i = 0; i < 60; i++) {
      r.step(['down', 'right']);
      expect(crouchPose(r.p)).toBe(true);
      expect(r.p.body.h).toBe(15 * 256);
    }
    expect(Math.abs((r.p.body.x - x0) / 256 - 75)).toBeLessThanOrEqual(1);
    const s = rig(SAMUS);
    const sx = s.p.body.x;
    for (let i = 0; i < 60; i++) s.step(['down', 'right']);
    expect(s.p.body.x).toBe(sx);
  });

  it('letting go of Down stands him at once (not latched)', () => {
    const r = rig(DARKPIT_CLASSIC);
    r.step(['down']);
    expect(crouchPose(r.p)).toBe(true);
    r.step([]);
    expect(crouchPose(r.p)).toBe(false);
    expect(r.p.body.h).toBe(24 * 256);
  });

  it('crouch-walks through a one-tile-high corridor; Classic Samus standing does not', () => {
    // A ceiling over row 11 from column 10 on: a 16 px gap above the floor.
    const level = () => flatLevel({ 11: '..........##########' });
    const r = rig(PIT_CLASSIC, 'small', {}, level());
    for (let i = 0; i < 200; i++) r.step(['down', 'right']);
    expect(r.p.body.x / 256).toBeGreaterThan(20 * 16);
    const s = rig(SAMUS, 'small', {}, level());
    for (let i = 0; i < 200; i++) s.step(['right']);
    expect(s.p.body.x / 256).toBeLessThan(10 * 16);
  });

  it('PI-10: under a ceiling he stays crouched after letting go of Down, until the box fits', () => {
    const r = rig(PIT_CLASSIC, 'small', {}, flatLevel({ 11: '..........##########' }));
    for (let i = 0; i < 80; i++) r.step(['down', 'right']);
    r.step([]);
    expect(crouchPose(r.p)).toBe(true);
    expect(r.p.body.h).toBe(15 * 256);
  });
});

describe('PI-8: the crouch pose in the air', () => {
  it('a jump with Down held keeps the pose and the 12 x 15 box; apex 87 +- 2 px', () => {
    const r = rig(PIT_CLASSIC, 'small', {}, flatLevel({}, 400));
    r.step(['down']);
    const y0 = r.p.feetY;
    let min = y0;
    r.step(['down', 'jump']);
    for (let i = 0; i < 200 && !r.p.body.onGround; i++) {
      expect(crouchPose(r.p)).toBe(true);
      expect(r.p.body.h).toBe(15 * 256);
      min = Math.min(min, r.p.feetY);
      r.step(['down', 'jump']);
    }
    expect(Math.abs((y0 - min) / 256 - 87)).toBeLessThanOrEqual(2);
  });

  it('Down in the air after a plain jump tucks; letting go shows the jump pose again', () => {
    const r = rig(DARKPIT_CLASSIC);
    r.step(['jump']);
    for (let i = 0; i < 10; i++) r.step(['jump']);
    expect(crouchPose(r.p)).toBe(false);
    r.step(['jump', 'down']);
    expect(crouchPose(r.p)).toBe(true);
    expect(inBall(r.p)).toBe(false);
    r.step(['jump']);
    expect(crouchPose(r.p)).toBe(false);
  });

  it('PI-18: the somersault (Screw Attack) is kept through the air crouch', () => {
    const r = rig(PIT_CLASSIC, 'fire', {}, flatLevel({}, 400));
    let tucked = false;
    for (let i = 0; i < 60; i++) {
      const down = flipping(r.p) || tucked;
      r.step(down ? ['jump', 'right', 'down'] : ['jump', 'right']);
      if (down && crouchPose(r.p)) {
        tucked = true;
        expect(flipping(r.p)).toBe(true);
        break;
      }
    }
    expect(tucked).toBe(true);
  });
});

describe('PI-9: no walking while aiming up', () => {
  it('Up + Right on the ground for 30 frames: 0 px, facing kept; in the air 1.25 px/f', () => {
    const r = rig(PIT_CLASSIC);
    r.step(['left']);
    r.step([]);
    const x0 = r.p.body.x;
    for (let i = 0; i < 30; i++) r.step(['up', 'right']);
    expect(r.p.body.x).toBe(x0);
    expect(r.p.facing).toBe(-1);
    r.step(['jump']);
    r.step(['jump']);
    const ax = r.p.body.x;
    r.step(['jump', 'up', 'right']);
    expect((r.p.body.x - ax) / 256).toBeCloseTo(1.25, 2);
  });

  it('Classic Samus walks while aiming up', () => {
    const s = rig(SAMUS);
    const x0 = s.p.body.x;
    for (let i = 0; i < 30; i++) s.step(['up', 'right']);
    expect(s.p.body.x).toBeGreaterThan(x0);
  });
});

describe('PI-13, PI-14: no beam from the crouch, missiles yes', () => {
  it('Down + Attack on the ground and in the air: no shot; Down + Special: one missile', () => {
    const r = rig(PIT_CLASSIC, 'big', { missileUp: 1, missiles: 4 });
    r.step(['down', 'attack']);
    expect(shots(r)).toHaveLength(0);
    r.step(['down', 'special']);
    expect(shots(r)).toHaveLength(1);
    expect(shots(r)[0]?.kind).toBe('samus-shot');
    expect(r.p.scratch.missiles).toBe(3);
    const a = rig(DARKPIT_CLASSIC, 'big');
    a.step(['jump']);
    for (let i = 0; i < 8; i++) a.step(['jump', 'down']);
    a.step(['jump', 'down', 'attack']);
    expect(shots(a)).toHaveLength(0);
  });

  it('touch labels hide SHOOT while crouched; no button letters', () => {
    const r = rig(PIT_CLASSIC, 'big', { missileUp: 1, missiles: 4 });
    expect(PIT_CLASSIC.touchLabels?.(r.p, r.world)).toMatchObject({ attack: 'SHOOT', special: 'MISSILE' });
    r.step(['down']);
    expect(PIT_CLASSIC.touchLabels?.(r.p, r.world)).toMatchObject({ attack: null, special: 'MISSILE' });
  });
});

describe('PI-15: shot heights', () => {
  it('standing beam 11 px above the feet (Classic Samus 22); in the air 15', () => {
    const r = rig(PIT_CLASSIC, 'big');
    r.step(['attack']);
    expect(shotHeight(r)).toBeCloseTo(11, 0);
    const s = rig(SAMUS, 'big');
    s.step(['attack']);
    expect(shotHeight(s)).toBeCloseTo(22, 0);
    const a = rig(PIT_CLASSIC, 'big');
    for (let i = 0; i < 8; i++) a.step(['jump']);
    a.step(['jump', 'attack']);
    expect(shotHeight(a)).toBeCloseTo(15, 0);
  });

  it('a missile crouched in place 12.5 px; after a crouch-walk step 11 px', () => {
    const r = rig(PIT_CLASSIC, 'big', { missileUp: 1, missiles: 10 });
    r.step(['down']);
    r.step(['down', 'special']);
    expect(shotHeight(r)).toBeCloseTo(12.5, 0);
    for (let i = 0; i < 40; i++) r.step([]);
    r.step(['down']);
    r.step(['down', 'right']);
    r.step(['down', 'right', 'special']);
    expect(shotHeight(r)).toBeCloseTo(11, 0);
  });

  it('every beam plays pit-shoot (PI-22)', () => {
    const r = rig(PIT_CLASSIC);
    const played: string[] = [];
    const audio = r.world.audio as { sfx: (id: string) => void };
    const orig = audio.sfx;
    audio.sfx = (id: string) => void played.push(id);
    try {
      r.step(['attack']);
    } finally {
      audio.sfx = orig;
    }
    expect(played).toContain('pit-shoot');
  });
});

describe('PI-17: no morph ball, no bombs', () => {
  it('Down twice on the ground and Down in the air: never in the ball', () => {
    const r = rig(DARKPIT_CLASSIC, 'big');
    for (const hold of [['down'], [], ['down'], [], ['down'], ['down', 'attack']] as const) r.step([...hold]);
    expect(inBall(r.p)).toBe(false);
    r.step(['jump']);
    for (let i = 0; i < 6; i++) r.step(['jump']);
    r.step(['down']);
    r.step(['down', 'attack']);
    expect(inBall(r.p)).toBe(false);
    expect(bombs(r)).toHaveLength(0);
  });
});

describe('roster and guide (TG-41..43, PI-25, TG-40)', () => {
  it('in a Classic run, never under Campaign', () => {
    const h = makeGame({ dev: true });
    for (const d of [PIT_CLASSIC, DARKPIT_CLASSIC]) {
      expect(h.game.rosterFor('campaign')).not.toContain(d);
      expect(h.game.rosterFor('classic')).toContain(d);
      expect(h.game.roster).not.toContain(d);
    }
  });

  it('each has its own guide with its name, drawable by the font, with no button letters', () => {
    expect(PIT_CLASSIC.guide.tagline).toBe("Samus's rules, Pit's moves. No morph ball.");
    expect(DARKPIT_CLASSIC.guide.tagline).toBe("Samus's rules, Dark Pit's moves. No morph ball.");
    for (const d of [PIT_CLASSIC, DARKPIT_CLASSIC]) {
      const g = d.guide;
      const texts = [
        g.tagline,
        ...g.controls.flatMap((x) => [x.does, x.touchDoes ?? '', x.touch ?? '']),
        ...g.powerups.map((x) => x.does),
        ...(g.tips ?? []),
      ];
      for (const t of texts) {
        expect(fontText(t).length, t).toBe(t.length);
        expect(t, t).not.toMatch(/\b(button|press|push|tap|hold)\s+[abc]\b|\([abc]\)|\b[abc]\s*:/i);
        expect(t, t).not.toMatch(/\bbomb\b(?!s)|in the ball/i);
      }
      expect(g.demo).toEqual(['idle', 'walk', 'jump', 'attack', 'crouch']);
    }
  });

  it('the full kit: Flower state kit with Wave and Ice on Select (TG-44)', () => {
    const kit = PIT_CLASSIC.devKit?.() ?? {};
    const r = rig(PIT_CLASSIC, 'fire', kit);
    expect(PIT_CLASSIC.tools?.(r.p).map((t) => t.id)).toEqual(['wave', 'ice']);
  });
});
