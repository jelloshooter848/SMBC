import { describe, expect, it } from 'vitest';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { Action } from '@engine/input/actions';
import { px, toPx } from '@engine/math/units';
import { ScriptedInput } from '@game/sim/headless';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { parseTextMap, serializeTextMap } from '@game/level/textmap';
import { World } from '@game/world/world';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { SAMUS } from '@game/characters/samus';
import { SIMON } from '@game/characters/simon';
import type { CharacterDef } from '@game/characters/character';
import { Stairs, STAIR_LOCK } from './stairs';

/*
 * Castlevania stairs as a World piece, for any hero: a flight rising right from the floor at
 * column 8 to a landing on row 9 (columns 12-20), and a placed vine beside the flight's middle.
 */
const MAP = (camera = 'scroll') => `id: 1-1
name: STAIRS TEST
world: 1
stage: 1
theme: castle
time: 400
start: 2,12
startMode: stand
camera: ${camera}${camera === 'auto' ? '\nscroll: 0.5' : ''}

[tiles]
................................
................................
................................
................................
................................
................................
................................
................................
................................
............#########...........
............#########...........
............#########...........
............#########...........
################################
################################

[entities]
stairs 8 12 len=4 dir=ur
vine 10 12 len=6
`;

/** A world for `hero` (`power`: Mario's) and a stepper. */
function setup(hero: CharacterDef, opts: { power?: string | undefined; camera?: string } = {}) {
  const level = parseTextMap(MAP(opts.camera), 'stairs-test');
  const state = { ...newGameState(hero), ...(opts.power ? { powerState: opts.power } : {}) };
  const world = new World(
    level,
    {
      assets: new AssetRegistry({ default: {} }),
      audio: NULL_AUDIO,
      assist: { ...DEFAULT_ASSIST },
      reduceFlashing: true,
    },
    state,
    { seed: 1 },
  );
  const input = new ScriptedInput({ steps: [] });
  const step = (held: Action[] = [], n = 1) => {
    for (let i = 0; i < n; i++) {
      input.setHeld(held);
      input.next();
      world.update([input]);
    }
  };
  const p = world.player;
  const flight = world.entities.find((e): e is Stairs => e instanceof Stairs) as Stairs;
  /** Stands the hero on the floor with his centre at `cx` px. */
  const stand = (cx: number, feet = 208) => {
    const b = p.body;
    b.x = px(cx) - (b.w >> 1);
    b.y = px(feet) - b.h;
    b.vx = 0;
    b.vy = 0;
    b.onGround = true;
    step();
  };
  /** Feet on the flight's line (centre on it). */
  const onLine = () => {
    const l = flight.line;
    return p.body.y + p.body.h - l.footY === -(p.centerX - l.footX) * l.sx;
  };
  return { world, p, step, stand, flight, onLine };
}

describe('Castlevania stairs for every hero', () => {
  const heroes: [string, CharacterDef, string | undefined][] = [
    ['small Mario', MARIO, 'small'],
    ['big Mario', MARIO, 'big'],
    ['Link', LINK, undefined],
  ];
  it.each(heroes)(
    '%s: UP at the foot, up the flight onto the landing; DOWN at the top, back down',
    (_, hero, power) => {
      const { p, step, stand, onLine } = setup(hero, { power });
      stand(130);
      step(['up']);
      expect(p.stairs).not.toBeNull();
      step(['up'], 20);
      expect(onLine()).toBe(true);
      for (let i = 0; i < 200 && p.stairs; i++) step(['up']);
      expect(p.stairs).toBeNull();
      expect(p.body.y + p.body.h).toBe(px(9 * 16));
      step([], STAIR_LOCK + 2);
      step(['down']);
      expect(p.stairs).not.toBeNull();
      for (let i = 0; i < 200 && p.stairs; i++) step(['down']);
      expect(p.stairs).toBeNull();
      expect(p.body.y + p.body.h).toBe(px(208));
      expect(toPx(p.centerX)).toBe(128);
    },
  );

  it('a vine beside the flight is never grabbed from the stairs', () => {
    const { p, step, stand } = setup(MARIO);
    stand(130);
    step(['up']);
    for (let i = 0; i < 200 && p.stairs; i++) {
      step(['up']);
      expect(p.vine).toBeNull();
    }
    expect(p.body.y + p.body.h).toBe(px(9 * 16));
  });

  it('the screen edge moves a player along the flight, never off the steps', () => {
    const { world, p, step, stand, onLine } = setup(MARIO);
    stand(130);
    step(['up'], 30);
    expect(p.stairs).not.toBeNull();
    world.camera.x = p.body.x + px(6);
    step();
    expect(p.body.x).toBeGreaterThanOrEqual(world.camera.x);
    expect(p.stairs).not.toBeNull();
    expect(onLine()).toBe(true);
  });

  it('under auto-scroll, the screen edge knocks a player off the stairs and squashes him on a wall', () => {
    const { world, p, step, stand } = setup(MARIO, { camera: 'auto' });
    stand(130);
    step(['up'], 16);
    expect(p.stairs).not.toBeNull();
    // A wall just ahead of him: the edge pushes him into it.
    world.map.set(
      Math.floor(toPx(p.body.x + p.body.w) / 16) + 1,
      Math.floor(toPx(p.body.y + p.body.h - 1) / 16),
      1,
    );
    world.map.set(Math.floor(toPx(p.body.x + p.body.w) / 16) + 1, Math.floor(toPx(p.body.y) / 16), 1);
    world.camera.x = p.body.x + px(14);
    step();
    expect(p.stairs).toBeNull();
    expect(p.dead).toBe(true);
  });

  it('Samus takes the stairs standing: DOWN at the top never curls her up, and a morph ball unrolls', () => {
    const { p, step, stand } = setup(SAMUS);
    stand(12 * 16 + 4, 9 * 16);
    step(['down']);
    expect(p.stairs).not.toBeNull();
    step(['down'], 10);
    expect(p.scratch.ball ?? 0).toBe(0);
    // Curled up at the top, DOWN gets on and she stands.
    const s = setup(SAMUS);
    s.stand(12 * 16 + 4, 9 * 16);
    s.p.scratch.ball = 1;
    s.p.refitHitbox();
    s.step(['down']);
    expect(s.p.stairs).not.toBeNull();
    expect(s.p.scratch.ball).toBe(0);
    expect(s.onLine()).toBe(true);
  });

  it('Simon on the stairs: UP + WHIP lashes the whip (no sub-weapon throw)', () => {
    const { p, step, stand } = setup(SIMON);
    p.scratch.subs = 1;
    p.scratch.hearts = 5;
    stand(130);
    step(['up'], 10);
    expect(p.stairs).not.toBeNull();
    step(['up', 'attack']);
    expect(p.attackTimer).toBeGreaterThan(0);
    expect(p.scratch.hearts).toBe(5);
    expect(p.scratch.throwT ?? 0).toBe(0);
  });

  it('`stairs x y len=N dir=ur|ul` survives the text map round trip', () => {
    const level = parseTextMap(MAP(), 'stairs-test');
    const again = parseTextMap(serializeTextMap(level), 'stairs-test');
    const stairs = (l: typeof level) => l.entities.filter((e) => e.type === 'stairs');
    expect(stairs(again)).toEqual(stairs(level));
    expect(stairs(level)).toEqual([{ type: 'stairs', x: 8, y: 12, props: { len: 4, dir: 'ur' } }]);
  });
});
