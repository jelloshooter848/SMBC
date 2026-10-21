import { describe, expect, it } from 'vitest';
import { px, toPx } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { defaultSettings } from '@engine/save/settings';
import { parseTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import { runSim, ScriptedInput } from '@game/sim/headless';
import { CHARACTERS, CLASSIC_CHARACTERS, CLASSIC_EXTRAS, heroFor } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { MEGAMAN_CLASSIC, MEGAMAN_CLASSIC_PROFILE, energyKey } from '@game/characters/megaman/classic';
import { MM_WEAPONS, WEAPON_UNITS, WaterDrop } from '@game/characters/megaman/classic-weapons';
import { BASS_CLASSIC, BASS_CLASSIC_PROFILE } from '@game/characters/bass/classic';
import { BASS_BUSTER } from '@game/characters/bass/classic-weapons';
import { CLASSIC_SWIM } from '@game/rules/classic-swim';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import { Projectile } from '@game/entities/projectiles/projectile';
import { PowerUp } from '@game/entities/objects/powerup';
import { Spring, SPRING_GREEN_BOOST, SPRING_RISE_GRAVITY } from '@game/entities/objects/spring';
import { CharacterSelectScene } from '@game/scenes/character-select';
import type { LevelScene } from '@game/scenes/level';
import type { World } from '@game/world/world';
import type { GameState } from '@game/context';
import { fontText } from '@game/hud/text';
import { PALETTES, SPRITES } from '@content/sprites';
import { testLevel, tile } from './classic-harness';
import { makeGame } from './heroes-harness';
import { isolateClassicRegistry } from './classic-registry';

// Classic SMBC Bass (bug-reports/2026-10-07-bass-build-classic-character.md, BA-1..BA-37): the
// report's acceptance checks the engine can measure, through runSim with rules: 'classic', his
// roster rules (TG-41..TG-43) and TG-38's "Current is unchanged".

isolateClassicRegistry();

type Hold = Action[];

const BASS_SHOT = 0x04d55;
const BASS_DIAG = 0x03a00;
const GRAVITY = 0x00355;
const WATER_GRAVITY = 0x0011c;

function bassWorld(
  level = testLevel(),
  state: Partial<GameState> = {},
  opts: { hurt?: boolean } = {},
): World {
  return runSim({
    level,
    character: BASS_CLASSIC,
    rules: 'classic',
    script: { steps: [] },
    maxFrames: 0,
    state,
    assist: { invulnerable: !opts.hurt },
  }).world;
}

function drive(world: World, n: number, hold: (i: number) => Hold = () => [], each?: (i: number) => void) {
  const input = new ScriptedInput({ steps: [] });
  for (let i = 0; i < n; i++) {
    input.setHeld(hold(i));
    input.next();
    world.update([input]);
    each?.(i);
  }
}

const settle = (w: World) => drive(w, 4);
const shots = (w: World, kind = 'bass-buster') =>
  w.entities.filter((e): e is Projectile => e instanceof Projectile && e.alive && e.kind === kind);
const drops = (w: World) => w.entities.filter((e): e is WaterDrop => e instanceof WaterDrop && e.alive);
const feet = (w: World) => w.player.body.y + w.player.body.h;

function level(rows: Record<number, string>, start = '2,12', ground: string[] = []) {
  const lines: string[] = [];
  for (let y = 0; y < 13; y++) lines.push((rows[y] ?? '').padEnd(48, '.').slice(0, 48));
  lines.push(...(ground.length ? ground : ['#'.repeat(48), '#'.repeat(48)]));
  return parseTextMap(['id: t', 'time: 300', `start: ${start}`, '', '[tiles]', ...lines].join('\n'));
}

/** A deep water room (as classic-swim.test.ts): waves on row 2, the floor at row 28. */
function deepWater(floor = 28) {
  const height = floor + 2;
  const rows = Array.from({ length: height }, (_, y) =>
    y >= floor ? '#'.repeat(48) : (y === 2 ? 'w'.repeat(48) : '').padEnd(48, '.'),
  );
  return parseTextMap(
    [
      'id: deep',
      'theme: water',
      'swim: true',
      'time: 300',
      `start: 4,${floor - 1}`,
      `height: ${height}`,
      'camera: free',
      '',
      '[tiles]',
      ...rows,
    ].join('\n'),
  );
}

describe('a Classic-only hero (BA-1, BA-2, BA-4, TG-41..TG-43)', () => {
  it('is the first Classic extra, never in the roster or a Classic hero slot', () => {
    expect(CLASSIC_EXTRAS[0]).toBe(BASS_CLASSIC);
    expect(CHARACTERS).not.toContain(BASS_CLASSIC);
    expect(CHARACTERS.some((c) => c.id === 'bass')).toBe(false);
    expect(Object.values(CLASSIC_CHARACTERS)).not.toContain(BASS_CLASSIC);
    expect(BASS_CLASSIC).toMatchObject({ id: 'bass', name: 'Bass', hudName: 'BASS', rules: 'classic' });
    expect(BASS_CLASSIC.portrait).toEqual({ sheet: 'bass', palette: 'bass', frame: 'idle' });
    expect(BASS_CLASSIC.damage).toEqual({ kind: 'powerup', states: ['small', 'big', 'fire'] });
    expect(BASS_CLASSIC.music).toBeUndefined();
    expect(BASS_CLASSIC.reserve).toBeUndefined();
    expect(BASS_CLASSIC.hudExtra).toBeUndefined();
    expect(BASS_CLASSIC.startHp).toBeUndefined();
    expect(heroFor(BASS_CLASSIC, 'classic')).toBe(BASS_CLASSIC);
  });

  it('Classic rosters list him after the usual heroes; Current and campaign ones never', () => {
    const h = makeGame({ dev: true });
    expect(h.game.rosterFor('classic')).toEqual([...CHARACTERS, ...CLASSIC_EXTRAS]);
    expect(h.game.rosterFor('classic').indexOf(BASS_CLASSIC)).toBe(CHARACTERS.length);
    expect(h.game.rosterFor('current')).not.toContain(BASS_CLASSIC);
    // `?dev=1&rules=current&char=bass` finds no Bass: the first hero, Mario, plays.
    const c = h.game.rosterFor('current');
    expect(c.find((d) => d.id === 'bass') ?? c[0]).toBe(MARIO);
    h.game.runRules = 'current';
    expect(h.game.heroLocked(BASS_CLASSIC)).toBe(true);
    expect(h.game.heroesToFind).toBe(0);
  });

  it('Classic mode: first on the select screen second row, and playable', () => {
    const settings = defaultSettings();
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    h.game.classicSelect('1-1', () => h.game.showClassicMenu());
    const sel = h.top() as CharacterSelectScene;
    expect(sel).toBeInstanceOf(CharacterSelectScene);
    // The original's grid: Bass is the seventh slot, on its second row (after Mega Man).
    expect(sel.chars[6]).toBe(BASS_CLASSIC);
    expect(sel.slot(6).y).toBeGreaterThan(sel.slot(0).y);
    expect(h.game.heroLocked(BASS_CLASSIC)).toBe(false);
    h.idle(12);
    // Classic mode's select says the hero, then its game (the original's name box).
    for (let i = 0; i < sel.chars.length && h.said.at(-1) !== 'Bass, Mega Man 10'; i++) h.tap('left');
    expect(h.said.at(-1)).toBe('Bass, Mega Man 10');
    h.tap('jump');
    // G-051 (0.5.0): Bass has a second look (Quick Man), so OK opens his looks; OK picks his own.
    if (sel.pickerOpen) h.tap('jump');
    h.until(() => h.top()?.constructor.name === 'LevelScene', 600);
    expect((h.top() as LevelScene).world.player.def).toBe(BASS_CLASSIC);
    expect(h.game.state.character).toBe(BASS_CLASSIC);
  });

  it('Classic mode with Classic rules set to Campaign, and free play: no Bass', () => {
    // O-12: Classic rules set to Current is developer mode's.
    const settings = { ...defaultSettings(), classicRules: 'current' as const, dev: true };
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    h.game.classicSelect('1-1', () => h.game.showClassicMenu());
    expect((h.top() as CharacterSelectScene).chars).not.toContain(BASS_CLASSIC);
    const f = makeGame();
    f.game.showCharacterSelect();
    expect((f.top() as CharacterSelectScene).chars).not.toContain(BASS_CLASSIC);
  });
});

describe('Current is unchanged (TG-23, TG-38)', () => {
  it('no Current profile, nor Classic Mega Man, sets the new optional fields', () => {
    for (const c of CHARACTERS) {
      const m = c.movement;
      expect(m.springKeepsAirJumps, c.id).toBeUndefined();
      expect(m.slide?.jumpWithDown, c.id).toBeUndefined();
      expect(m.slide?.jumpSpeed, c.id).toBeUndefined();
      expect(m.slide?.keepSpeedInAir, c.id).toBeUndefined();
      expect(m.swim?.slideJump, c.id).toBeUndefined();
      expect(c.behaviour.rooted, c.id).toBeUndefined();
    }
    expect(MEGAMAN_CLASSIC_PROFILE.slide).toMatchObject({ hitboxH: 15 });
    expect(MEGAMAN_CLASSIC_PROFILE.slide?.jumpSpeed).toBeUndefined();
    expect(MEGAMAN_CLASSIC_PROFILE.airJumps).toBeUndefined();
    expect(MEGAMAN_CLASSIC.behaviour.rooted).toBeUndefined();
  });

  it('springs know him as a Mega Man (BA-14)', () => {
    expect(SPRING_GREEN_BOOST.bass).toBe(SPRING_GREEN_BOOST.megaman);
    expect(SPRING_RISE_GRAVITY.bass).toBe(SPRING_RISE_GRAVITY.megaman);
  });
});

describe('jumping (BA-8, BA-12, BA-13)', () => {
  /** Holds jump `frames` frames from standing (and `extra` on later frames): apex px and landing frame. */
  function jump(frames: number, extra: (i: number, w: World) => Hold = () => []) {
    const w = bassWorld();
    settle(w);
    const y0 = feet(w);
    let top = y0;
    let land = -1;
    drive(
      w,
      150,
      (i) => [...(i < frames ? (['jump'] as Hold) : []), ...extra(i, w)],
      (i) => {
        top = Math.min(top, feet(w));
        if (land < 0 && i > 0 && w.player.body.onGround) land = i;
      },
    );
    return { apex: toPx(y0 - top), land, w };
  }

  it('a held jump peaks 50-52 px and lands on frame 45 ± 1', () => {
    const j = jump(150);
    expect(j.apex).toBeGreaterThanOrEqual(50);
    expect(j.apex).toBeLessThanOrEqual(52);
    expect(Math.abs(j.land - 45)).toBeLessThanOrEqual(1);
  });

  it('released on the first airborne frame: 13-16 px (the soft cut)', () => {
    const j = jump(1);
    expect(j.apex).toBeGreaterThanOrEqual(13);
    expect(j.apex).toBeLessThanOrEqual(16);
  });

  it('a double jump at the apex reaches 101-103 px; a third press changes nothing', () => {
    // The apex frame of a held jump; then jump held to it, let go, and pressed again the next frame.
    let at = -1;
    jump(150, (i, w) => {
      if (at < 0 && i > 2 && w.player.body.vy >= 0) at = i;
      return [];
    });
    expect(at).toBeGreaterThan(0);
    const d = jump(at, (i) => (i === at + 1 ? ['jump'] : i > at + 1 && i < at + 60 ? ['jump'] : []));
    expect(d.apex).toBeGreaterThanOrEqual(101);
    expect(d.apex).toBeLessThanOrEqual(103);
    // A third press: the arc is the same.
    const t = jump(at, (i) => (i === at + 1 || (i > at + 1 && i < at + 60 && i !== at + 30) ? ['jump'] : []));
    expect(t.apex).toBe(d.apex);
  });

  it('walking off a ledge leaves the double jump ready: vy -0x04800', () => {
    const w = bassWorld(level({}, '2,12', ['#####' + '.'.repeat(43), '#####' + '.'.repeat(43)]));
    settle(w);
    let air = -1;
    drive(
      w,
      40,
      () => ['right'],
      (i) => {
        if (air < 0 && !w.player.body.onGround) air = i;
      },
    );
    expect(air).toBeGreaterThan(0);
    expect(w.player.airJumpsLeft).toBe(1);
    drive(w, 1, () => ['right', 'jump']);
    // After the take-off frame's move one frame of gravity is added.
    expect(w.player.body.vy).toBe(-0x04800 + GRAVITY);
    expect(w.player.airJumpsLeft).toBe(0);
  });

  it('a spring launch keeps a spent double jump spent (BA-12); one left is kept', () => {
    for (const left of [0, 1]) {
      const w = bassWorld();
      settle(w);
      const s = new Spring(8, 12);
      w.spawn(s);
      const p = w.player;
      p.body.x = s.body.x + (s.body.w >> 1) - (p.body.w >> 1);
      p.body.y = s.body.y - p.body.h - px(20);
      p.body.onGround = false;
      p.body.vy = 0;
      p.airJumpsLeft = left;
      let launched = false;
      drive(
        w,
        40,
        () => [],
        () => (launched ||= p.launched),
      );
      expect(launched).toBe(true);
      expect(p.airJumpsLeft).toBe(left);
      const vy = p.body.vy;
      drive(w, 1, () => ['jump']);
      if (left === 0) expect(p.body.vy).toBeGreaterThan(vy);
      else expect(p.body.vy).toBe(-0x04800 + GRAVITY);
    }
  });
});

describe('the dash and dash jump (BA-3, BA-10, BA-11)', () => {
  it('covers 62.5 ± 2.5 px on flat ground, 22 px tall throughout', () => {
    const w = bassWorld();
    settle(w);
    const x0 = w.player.body.x;
    let minH = Infinity;
    let frames = 0;
    drive(
      w,
      60,
      (i) => (i === 0 ? ['down', 'jump'] : []),
      () => {
        if (w.player.sliding > 0) {
          frames++;
          minH = Math.min(minH, toPx(w.player.body.h));
        }
      },
    );
    expect(frames).toBeGreaterThan(20);
    expect(minH).toBe(22);
    expect(BASS_CLASSIC.hitbox(w.player)).toEqual({ w: 12, h: 22 });
    expect(Math.abs(toPx(w.player.body.x - x0) - 62.5)).toBeLessThanOrEqual(2.5);
  });

  it('stops at the wall of a one-tile-high gap', () => {
    const w = bassWorld(level({ 11: '.....########' }));
    settle(w);
    drive(w, 60, (i) => (i === 0 ? ['down', 'jump'] : []));
    expect(w.player.sliding).toBe(0);
    expect(w.player.body.x + w.player.body.w).toBeLessThanOrEqual(tile(5));
  });

  it('jump on dash frame 10 with Down held: vy -0x05355, and vx 0x02800 until landing (about 130 px)', () => {
    const w = bassWorld();
    settle(w);
    // One input stream: the dash on frame 0, the jump press on dash frame 10 (Down still held).
    let x0 = 0;
    let land = -1;
    let x1 = 0;
    const vxs: number[] = [];
    drive(
      w,
      100,
      (i) =>
        i === 0
          ? ['down', 'jump']
          : i < 10
            ? ['down', 'right']
            : i === 10
              ? ['down', 'right']
              : ['down', 'right', 'jump'],
      (i) => {
        const p = w.player;
        if (i === 9) {
          expect(p.sliding).toBeGreaterThan(0);
          x0 = p.body.x;
        }
        if (i === 11) {
          expect(p.sliding).toBe(0);
          expect(p.body.onGround).toBe(false);
          expect(p.body.vy).toBe(-0x05355 + GRAVITY);
        }
        if (i > 11 && land < 0) {
          if (p.body.onGround) {
            land = i;
            x1 = p.body.x;
          } else vxs.push(p.body.vx);
        }
      },
    );
    expect(land).toBeGreaterThan(0);
    expect(vxs.every((v) => v === 0x02800)).toBe(true);
    const across = toPx(x1 - x0);
    expect(across).toBeGreaterThanOrEqual(120);
    expect(across).toBeLessThanOrEqual(140);
  });

  it('Left in the air during it: vx -0x02800; nothing held: 0; a double jump ends the carried speed', () => {
    const w = bassWorld();
    settle(w);
    const vx: number[] = [];
    // Dash (0), dash jump (5, held), Left (7), nothing (8), the double jump (10), Right (11).
    const plan: Record<number, Hold> = {
      0: ['down', 'jump'],
      5: ['jump'],
      6: ['jump'],
      7: ['jump', 'left'],
      8: ['jump'],
      10: ['jump'],
      11: ['jump', 'right'],
    };
    drive(
      w,
      12,
      (i) => plan[i] ?? [],
      () => vx.push(w.player.body.vx),
    );
    expect(vx[7]).toBe(-0x02800);
    expect(vx[8]).toBe(0);
    expect(w.player.airJumpsLeft).toBe(0);
    expect(vx[11]).toBe(0x01600);
  });

  it('a dash off a ledge keeps 2.5 px/f in the air', () => {
    const w = bassWorld(level({}, '2,12', ['#####' + '.'.repeat(43), '#####' + '.'.repeat(43)]));
    settle(w);
    drive(w, 1, () => ['right']);
    drive(w, 8);
    let carried = false;
    drive(
      w,
      30,
      (i) => (i === 0 ? ['down', 'jump'] : ['right']),
      () => {
        if (!w.player.body.onGround && w.player.body.vx === 0x02800) carried = true;
      },
    );
    expect(carried).toBe(true);
  });

  it('a normal jump keeps the walking speed', () => {
    const w = bassWorld();
    settle(w);
    drive(w, 12, () => ['right']);
    drive(w, 3, () => ['right', 'jump']);
    expect(w.player.body.onGround).toBe(false);
    expect(w.player.body.vx).toBe(0x01600);
  });
});

describe('rooted while firing (BA-9)', () => {
  it('Attack + Right on flat ground for 60 frames: no move, facing right; let go and he walks', () => {
    const w = bassWorld();
    settle(w);
    const x0 = w.player.body.x;
    drive(w, 60, () => ['attack', 'right']);
    expect(w.player.body.x).toBe(x0);
    expect(w.player.facing).toBe(1);
    drive(w, 1, () => ['right']);
    expect(w.player.body.x).toBeGreaterThan(x0);
  });

  it('Left turns him without moving; Down + Jump neither dashes nor jumps; Jump alone jumps', () => {
    const w = bassWorld();
    settle(w);
    const x0 = w.player.body.x;
    drive(w, 5, () => ['attack', 'left']);
    expect(w.player.facing).toBe(-1);
    expect(w.player.body.x).toBe(x0);
    drive(w, 3, (i) => (i === 0 ? ['attack', 'down', 'jump'] : ['attack', 'down']));
    expect(w.player.sliding).toBe(0);
    expect(w.player.body.onGround).toBe(true);
    drive(w, 2, (i) => (i === 0 ? ['attack', 'jump'] : ['attack', 'jump']));
    expect(w.player.body.onGround).toBe(false);
  });

  it('in the air holding Attack never stops him: 1.375 px a frame', () => {
    const w = bassWorld();
    settle(w);
    drive(w, 3, () => ['jump']);
    const x0 = w.player.body.x;
    drive(w, 4, () => ['jump', 'attack', 'right']);
    expect(w.player.body.x - x0).toBe(4 * (0x01600 >> 4));
  });

  it('no step nudge starts while firing (BA-7)', () => {
    const w = bassWorld();
    settle(w);
    drive(w, 2, () => ['attack']);
    drive(w, 1, () => ['attack', 'right']);
    expect(w.player.stepT).toBe(0);
  });
});

describe('the Bass Buster (BA-19..BA-22)', () => {
  /** Frames (from the press) on which a new shot appears, holding Attack `n` frames. */
  function cadence(state: Partial<GameState> = {}, n = 24): number[] {
    const w = bassWorld(testLevel(), state);
    settle(w);
    const out: number[] = [];
    let seen = 0;
    drive(
      w,
      n,
      () => ['attack'],
      (i) => {
        const now = w.entities.filter((e) => e instanceof Projectile && e.kind === 'bass-buster').length;
        if (now > seen) out.push(i);
        seen = now;
      },
    );
    return out;
  }

  it('fires on frames 0, 5, 9 then waits for the cap (3); with the Mushroom 4 (frame 14)', () => {
    expect(cadence()).toEqual([0, 5, 9]);
    expect(cadence({ powerState: 'big' })).toEqual([0, 5, 9, 14]);
  });

  it('aims: Up (0, -0x04D55); Up + Right (+0x03A00, -0x03A00); Down + Left (-0x03A00, +0x03A00)', () => {
    const fire = (hold: Hold) => {
      const w = bassWorld();
      settle(w);
      drive(w, 1, () => ['attack', ...hold]);
      const s = shots(w)[0] as Projectile;
      return { vx: s.body.vx, vy: s.body.vy, facing: w.player.facing };
    };
    expect(fire([])).toMatchObject({ vx: BASS_SHOT, vy: 0 });
    expect(fire(['up'])).toMatchObject({ vx: 0, vy: -BASS_SHOT });
    expect(fire(['up', 'right'])).toMatchObject({ vx: BASS_DIAG, vy: -BASS_DIAG });
    // Down: fired in the air (on the ground the shot meets the floor at once).
    const w = bassWorld();
    settle(w);
    drive(w, 4, (i) => (i < 3 ? ['jump'] : ['jump', 'attack', 'down', 'left']));
    const d = shots(w)[0] as Projectile;
    expect({ vx: d.body.vx, vy: d.body.vy, facing: w.player.facing }).toEqual({
      vx: -BASS_DIAG,
      vy: BASS_DIAG,
      facing: -1,
    });
  });

  it('spawns from the BA-20 table (forward: 19 px ahead, 13 px up on the ground)', () => {
    const w = bassWorld();
    settle(w);
    drive(w, 1, () => ['attack']);
    const s = shots(w)[0] as Projectile;
    const p = w.player.body;
    const cx = p.x + (p.w >> 1);
    // One frame of flight after the spawn.
    expect(s.body.x + (s.body.w >> 1) - cx).toBe(px(19) + (BASS_SHOT >> 4));
    expect(p.y + p.h - (s.body.y + (s.body.h >> 1))).toBe(px(13));
  });

  /** Taps Attack once per shot until `done`, each shot gone before the next; the shot count. */
  function shootUntil(w: World, done: () => boolean, max = 30): number {
    let n = 0;
    while (!done() && n < max) {
      drive(w, 1, () => ['attack']);
      n++;
      for (let i = 0; i < 120 && shots(w).length > 0; i++) drive(w, 1);
    }
    return n;
  }

  it('a Goomba dies on the 5th shot, a Koopa on the 12th', () => {
    const w = bassWorld();
    settle(w);
    const g = new Goomba(tile(8), tile(12) + px(2));
    w.spawn(g);
    expect(shootUntil(w, () => !g.alive)).toBe(5);
    const k = new Koopa(tile(9), tile(12) - px(8), 'green');
    w.spawn(k);
    expect(shootUntil(w, () => !k.alive)).toBe(12);
  });

  it('a brick breaks on the 3rd shot; a ? block gives its item', () => {
    const w = bassWorld(level({ 12: '........=' }));
    settle(w);
    for (const hp of [75, 25]) {
      drive(w, 1, () => ['attack']);
      drive(w, 40);
      expect(w.map.get(8, 12)).toBe(T.BRICK);
      expect(w.brickHp.get('8,12')).toBe(hp);
    }
    drive(w, 1, () => ['attack']);
    drive(w, 40);
    expect(w.map.get(8, 12)).toBe(T.AIR);
    const q = bassWorld(level({ 12: '........M' }));
    settle(q);
    drive(q, 1, () => ['attack']);
    drive(q, 40);
    expect(q.entities.some((e) => e instanceof PowerUp)).toBe(true);
  });

  it('a shot at a pipe ends at it (unlike the Mega Buster)', () => {
    const w = bassWorld(level({ 11: '......[]', 12: '......{}' }));
    settle(w);
    drive(w, 1, () => ['attack']);
    drive(w, 30);
    expect(shots(w).length).toBe(0);
    expect(BASS_BUSTER.classicBlocks?.ground).toBe('collide');
  });

  it('a shot at a Buzzy Beetle bounces back up, harmless', () => {
    const w = bassWorld();
    settle(w);
    const b = new Koopa(tile(6), tile(12) - px(8), 'buzzy');
    w.spawn(b);
    drive(w, 1, () => ['attack']);
    let back: { vx: number; vy: number } | undefined;
    drive(
      w,
      30,
      () => [],
      () => {
        const d = shots(w).find((s) => s.deflected);
        if (d && !back) back = { vx: d.body.vx, vy: d.body.vy };
      },
    );
    expect(back).toEqual({ vx: -BASS_SHOT, vy: -0x02eab });
    expect(b.alive).toBe(true);
  });

  it('no shot comes out during a dash; held, firing resumes after it', () => {
    const w = bassWorld();
    settle(w);
    drive(w, 1, () => ['down', 'jump']);
    expect(w.player.sliding).toBeGreaterThan(0);
    drive(w, 10, () => ['attack', 'down']);
    expect(shots(w).length).toBe(0);
    drive(w, 30, () => ['attack']);
    expect(shots(w).length).toBeGreaterThan(0);
  });
});

describe('power states (BA-16, BA-17)', () => {
  it('small + 1 hit = death', () => {
    const w = bassWorld(testLevel(), {}, { hurt: true });
    settle(w);
    w.hurtPlayer(w.player, 1);
    expect(w.player.dead).toBe(true);
  });

  it('Flower + 1 hit = small, no shield, no swap; a second hit kills', () => {
    const w = bassWorld(testLevel(), { powerState: 'fire' }, { hurt: true });
    settle(w);
    drive(w, 2, (i) => (i === 0 ? ['select'] : []));
    expect(w.player.scratch.mmSwap).toBe(1);
    drive(w, 1, () => ['attack']);
    expect(drops(w).length).toBe(8);
    drive(w, 1, () => ['special']);
    expect(shots(w).length).toBe(1);
    const p = w.player;
    w.hurtPlayer(p, 1);
    expect(p.powerState).toBe('small');
    expect(p.dead).toBe(false);
    expect(drops(w).length).toBe(0);
    // Buster shots stay.
    expect(shots(w).length).toBe(1);
    expect(BASS_CLASSIC.touchLabels?.(p, w)).toMatchObject({ attack: 'SHOOT', special: null, select: null });
    drive(w, 140);
    drive(w, 1, () => ['attack']);
    expect(shots(w).length).toBeGreaterThan(0);
    expect(drops(w).length).toBe(0);
    w.hurtPlayer(p, 1);
    expect(p.dead).toBe(true);
  });

  it('a ? block gives the Mushroom when small and the Flower after; his head never breaks bricks', () => {
    const w = bassWorld();
    expect(BASS_CLASSIC.blockPowerUp(w.player)).toBe('mushroom');
    w.player.powerState = 'big';
    expect(BASS_CLASSIC.blockPowerUp(w.player)).toBe('flower');
    w.player.powerState = 'fire';
    expect(BASS_CLASSIC.blockPowerUp(w.player)).toBe('flower');
    expect(BASS_CLASSIC.canBreakBricks(w.player)).toBe(false);
  });

  it('no charge with the Mushroom (BA-26)', () => {
    const w = bassWorld(testLevel(), { powerState: 'big' });
    settle(w);
    drive(w, 120, () => ['attack']);
    drive(w, 1);
    expect(shots(w, 'mm-charge').length + shots(w, 'mm-charge-full').length).toBe(0);
    expect(w.player.scratch._chargeT ?? 0).toBe(0);
  });
});

describe('the Water Shield and the swap (BA-6, BA-18, BA-23)', () => {
  it('Special makes 8 drops; a second Special once all are out sends them outward', () => {
    const w = bassWorld(testLevel(), { powerState: 'fire' });
    settle(w);
    drive(w, 1, () => ['special']);
    expect(drops(w).length).toBe(8);
    expect(w.player.scratch[energyKey('water-shield')]).toBe(WEAPON_UNITS - 16);
    drive(w, 90);
    drive(w, 1, () => ['special']);
    expect(drops(w).every((d) => d.thrownFrom !== null)).toBe(true);
    expect(w.player.scratch[energyKey('water-shield')]).toBe(WEAPON_UNITS - 16);
  });

  it('7 shields empty a full bar', () => {
    const w = bassWorld(testLevel(), { powerState: 'fire' });
    settle(w);
    let fired = 0;
    for (let n = 0; n < 10; n++) {
      drive(w, 1, () => ['special']);
      if (drops(w).length === 8) fired++;
      for (const d of drops(w)) d.destroy();
      drive(w, 2);
    }
    expect(fired).toBe(7);
    expect(w.player.scratch[energyKey('water-shield')]).toBe(0);
  });

  it('the buster still fires 4 shots with the shield up; the shield never roots him', () => {
    const w = bassWorld(testLevel(), { powerState: 'fire' });
    settle(w);
    drive(w, 1, () => ['special']);
    expect(w.player.root).toBe(0);
    drive(w, 20, () => ['attack']);
    expect(shots(w).length).toBe(4);
    expect(drops(w).length).toBe(8);
  });

  it('one Select press swaps: Attack fires the shield, Special the rooted buster', () => {
    const w = bassWorld(testLevel(), { powerState: 'fire' });
    settle(w);
    drive(w, 2, (i) => (i === 0 ? ['select'] : []));
    expect(w.player.scratch.mmSwap).toBe(1);
    expect(BASS_CLASSIC.touchLabels?.(w.player, w)).toMatchObject({
      attack: 'WATER',
      special: 'SHOOT',
      select: 'SWAP',
    });
    expect(BASS_CLASSIC.tools?.(w.player).map((t) => t.id)).toEqual(['water-shield']);
    drive(w, 1, () => ['attack']);
    expect(drops(w).length).toBe(8);
    expect(shots(w).length).toBe(0);
    const x0 = w.player.body.x;
    drive(w, 10, () => ['special', 'right']);
    expect(shots(w).length).toBeGreaterThan(1);
    expect(w.player.body.x).toBe(x0);
  });

  it('wears the Water Shield suit while he holds the Flower', () => {
    const w = bassWorld(testLevel(), { powerState: 'fire' });
    expect(BASS_CLASSIC.sprite(w.player, 0, true).palette).toBe('bass-water');
    const s = bassWorld();
    expect(BASS_CLASSIC.sprite(s.player, 0, true).palette).toBe('bass');
  });

  it('energy drops refill the bar; with no Flower they are collected with no effect', () => {
    const w = bassWorld(testLevel(), { powerState: 'fire' });
    settle(w);
    const p = w.player;
    p.scratch[energyKey('water-shield')] = 50;
    p.def.behaviour.onPickup?.(p, 'weapon-large', w);
    expect(p.scratch[energyKey('water-shield')]).toBe(90);
    const s = bassWorld();
    settle(s);
    expect(s.player.def.behaviour.onPickup?.(s.player, 'weapon-small', s)).toBe(true);
    expect(s.player.transition).toBeNull();
  });
});

describe('water (BA-15)', () => {
  it('uses his floor-jump numbers', () => {
    expect(BASS_CLASSIC_PROFILE.swim).toBe(CLASSIC_SWIM.bass);
    expect(CLASSIC_SWIM.bass).toMatchObject({ stroke: 0x0418e, slideJump: 0x0558e, floorJumpOnly: true });
  });

  it('floor jump -0x0418E; dash jump -0x0558E; mid-water presses do nothing once the double jump is spent', () => {
    const w = bassWorld(deepWater());
    drive(w, 30);
    expect(w.player.inWater).toBe(true);
    expect(w.player.body.onGround).toBe(true);
    // One stream: floor jump (0, held to 10), the double jump (12), a third press (20).
    const vys: number[] = [];
    drive(
      w,
      21,
      (i) => (i <= 10 || i === 12 || i === 20 ? ['jump'] : []),
      () => vys.push(w.player.body.vy),
    );
    expect(vys[0]).toBe(-0x0418e + WATER_GRAVITY);
    expect(vys[12]).toBe(-0x0418e + WATER_GRAVITY);
    expect(w.player.airJumpsLeft).toBe(0);
    // The same arc as without the third press.
    const twin = bassWorld(deepWater());
    drive(twin, 30);
    const tw: number[] = [];
    drive(
      twin,
      21,
      (i) => (i <= 10 || i === 12 ? ['jump'] : []),
      () => tw.push(twin.player.body.vy),
    );
    expect(vys[20]).toBe(tw[20]);

    const d = bassWorld(deepWater());
    drive(d, 30);
    drive(
      d,
      11,
      (i) => (i === 0 || i === 10 ? ['down', 'jump'] : ['down']),
      (i) => {
        if (i === 9) expect(d.player.sliding).toBeGreaterThan(0);
      },
    );
    expect(d.player.body.vy).toBe(-0x0558e + WATER_GRAVITY);
  });
});

describe('the dev full kit (BA-25, TG-44)', () => {
  it('grants the 9 weapons full, no Rush; Select cycles; Special fires the selected one', () => {
    const kit = BASS_CLASSIC.devKit?.() ?? {};
    for (const wp of MM_WEAPONS) expect(kit[energyKey(wp.id)]).toBe(WEAPON_UNITS);
    const w = bassWorld(testLevel(), { powerState: 'fire', kit });
    settle(w);
    const p = w.player;
    const tools = BASS_CLASSIC.tools?.(p) ?? [];
    expect(tools.map((t) => t.id)).toEqual(MM_WEAPONS.map((x) => x.id));
    expect(BASS_CLASSIC.touchLabels?.(p, w).select).toBe('WEAPON');
    // Water Shield is 8th: seven presses (no swap under the kit).
    for (let i = 0; i < 7; i++) drive(w, 2, (k) => (k === 0 ? ['select'] : []));
    expect(p.scratch.mmSwap ?? 0).toBe(0);
    drive(w, 1, () => ['special']);
    expect(drops(w).length).toBe(8);
    // The buster stays on Attack.
    drive(w, 1, () => ['attack']);
    expect(shots(w).length).toBe(1);
  });

  it('every weapon fires from the full kit without throwing', () => {
    const kit = BASS_CLASSIC.devKit?.() ?? {};
    const w = bassWorld(level({ 12: '...=' }), { powerState: 'fire', kit });
    settle(w);
    for (let i = 0; i < MM_WEAPONS.length + 1; i++) {
      drive(w, 30, (k) => (k < 20 ? ['special'] : []));
      drive(w, 60);
      drive(w, 2, (k) => (k === 0 ? ['select'] : []));
    }
    expect(w.player.dead).toBe(false);
  });
});

describe('art, guide and touch labels (BA-32..BA-36, TG-22, TG-40)', () => {
  it('every frame his def can show exists on his sheet, with his palettes', () => {
    const frames = SPRITES.bass?.frames ?? {};
    const names = [
      'idle',
      'idle-blink',
      'step',
      'walk-0',
      'walk-1',
      'walk-2',
      'walk-shoot-0',
      'walk-shoot-1',
      'walk-shoot-2',
      'jump',
      'dash',
      'hurt',
      'climb-0',
      'climb-1',
      'death-orb',
      'bass-buster',
      ...['', '-up', '-diag-up', '-diag-down'].flatMap((a) => [`shoot${a}`, `jump-shoot${a}`]),
    ];
    for (const n of names) {
      expect(frames[n], n).toBeDefined();
      const rows = frames[n] as string[];
      expect(new Set(rows.map((r) => r.length)).size, n).toBe(1);
      expect(rows.join('')).toMatch(/^[.0-5]*$/);
    }
    expect((frames.dash as string[])[10]?.replace(/\./g, '').length).toBeGreaterThan(0);
    for (const pal of ['bass', 'bass-water', 'bass-charge-0', 'bass-charge-1', 'bass-charge-2'])
      expect(PALETTES.default?.[pal], pal).toBeDefined();
    for (let i = 0; i < 4; i++) expect(PALETTES.default?.[`bass-star-${i}`]).toBeDefined();
  });

  it('the poses: rooted aim, dash, jump-shoot', () => {
    const w = bassWorld();
    settle(w);
    drive(w, 1, () => ['attack', 'up']);
    expect(BASS_CLASSIC.sprite(w.player, 0, true).frame).toBe('shoot-up');
    drive(w, 1, () => ['attack', 'down']);
    drive(w, 4, () => ['attack', 'down']);
    expect(BASS_CLASSIC.sprite(w.player, 0, true).frame).toBe('shoot-diag-down');
    drive(w, 20);
    expect(BASS_CLASSIC.sprite(w.player, 0, true).frame).toMatch(/^idle/);
    drive(w, 2, (i) => (i === 0 ? ['down', 'jump'] : []));
    expect(BASS_CLASSIC.sprite(w.player, 0, true)).toMatchObject({ frame: 'dash', offsetY: 10 });
    drive(w, 40);
    drive(w, 3, (i) => (i === 0 ? ['jump'] : ['jump', 'attack']));
    expect(BASS_CLASSIC.sprite(w.player, 0, true).frame).toBe('jump-shoot');
  });

  it('has his own short guide in the bitmap font, with no button letters', () => {
    const g = BASS_CLASSIC.guide;
    expect(g).not.toBe(MEGAMAN_CLASSIC.guide);
    expect(g.tagline.length).toBeLessThanOrEqual(30);
    const texts = [
      g.tagline,
      ...g.controls.flatMap((x) => [x.does, x.touchDoes ?? '', x.touch ?? '']),
      ...g.powerups.map((x) => x.does),
      ...(g.belt ?? []).map((x) => x.does),
      ...(g.tips ?? []),
    ];
    for (const t of texts) {
      expect(fontText(t).length, t).toBe(t.length);
      expect(t, t).not.toMatch(/\b(button|press|push|tap|hold)\s+[abc]\b|\([abc]\)|\b[abc]\s*:/i);
    }
    expect((g.belt ?? []).some((b) => b.icon === 'icon-rush')).toBe(false);
    for (const b of g.belt ?? []) expect(SPRITES.items?.frames[b.icon], b.icon).toBeDefined();
  });

  it('touch labels: SHOOT; WATER and SWAP only with the Flower', () => {
    const s = bassWorld();
    expect(BASS_CLASSIC.touchLabels?.(s.player, s)).toEqual({ attack: 'SHOOT', special: null, select: null });
    const f = bassWorld(testLevel(), { powerState: 'fire' });
    const labels = BASS_CLASSIC.touchLabels?.(f.player, f) ?? {};
    expect(labels).toEqual({ attack: 'SHOOT', special: 'WATER', select: 'SWAP' });
    for (const v of Object.values(labels)) if (v) expect(v).not.toMatch(/\b(BUTTON )?[ABC]\b/);
    // The meter shows only while the Flower is held.
    expect(BASS_CLASSIC.meter?.(s.player)).toBeNull();
    expect(BASS_CLASSIC.meter?.(f.player)).toMatchObject({ max: WEAPON_UNITS });
  });
});
