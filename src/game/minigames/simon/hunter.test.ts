import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { px } from '@engine/math/units';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { SIMON, SIMON_PROFILE } from '@game/characters/simon';
import type { World } from '@game/world/world';
import { HUNTER_PROFILE, HUNTER_WALK, KNOCK_VX, KNOCK_VY, knockedBack, SIMON_HUNTER } from './hunter';
import { castleHarness, type CastleHarness } from './harness';
import { READY_FRAMES } from './scene';

/** A flat field. */
const FIELD = parseTextMap(
  [
    'id: t',
    'time: 300',
    'start: 4,12',
    '',
    '[tiles]',
    ...Array.from({ length: 13 }, () => '.'.repeat(48)),
    '#'.repeat(48),
    '#'.repeat(48),
  ].join('\n'),
);

/** The campaign's Simon on the field, driven frame by frame; the world after `frames`. */
function campaign(controller: (f: number, w: World) => Action[], frames: number): World {
  return runSim({
    level: FIELD,
    character: SIMON,
    script: { steps: [] },
    maxFrames: frames,
    controller: (w, f) => controller(f, w),
  }).world;
}

function ready(): CastleHarness {
  const h = castleHarness();
  h.step([], READY_FRAMES);
  expect(h.scene.phase).toBe('stage');
  // Off the candles, on the entrance hall's floor.
  const b = h.scene.player.body;
  b.x = px(60);
  h.step([], 2);
  expect(b.onGround).toBe(true);
  return h;
}

describe("Simon's Castlevania form (Dracula's Castle only)", () => {
  it('leaves the campaign kit alone: his tuned walk, his knockback and his behaviour', () => {
    expect(SIMON.movement).toBe(SIMON_PROFILE);
    expect(SIMON_PROFILE).toMatchObject({
      minWalk: 0x00100,
      walkAccel: 0x00200,
      maxWalk: 0x01000,
      instantAccel: false,
      airControl: 'none',
    });
    expect(SIMON.damage).toMatchObject({ kind: 'hp', knockback: { vx: 0x01800, vy: 0x02800 } });
    expect(SIMON_HUNTER.behaviour).not.toBe(SIMON.behaviour);
    expect(SIMON_HUNTER.movement).toBe(HUNTER_PROFILE);
    expect(SIMON_HUNTER.id).toBe(SIMON.id);
    // In a campaign world he still eases into his walk and keeps walking while he lashes.
    const w1 = campaign(() => ['right'], 3);
    expect(w1.player.body.vx).toBeGreaterThan(0);
    expect(w1.player.body.vx).toBeLessThan(0x01000);
    const w2 = campaign((f) => (f === 30 ? ['right', 'attack'] : ['right']), 36);
    expect(w2.player.attackTimer).toBeGreaterThan(0);
    expect(w2.player.body.vx).toBeGreaterThan(0);
  });

  it('the castle plays him in that form: full walking speed on the first frame, a dead stop on release', () => {
    const h = ready();
    expect(h.scene.state.character).toBe(SIMON_HUNTER);
    const b = h.scene.player.body;
    h.step(['right']);
    expect(b.vx).toBe(HUNTER_WALK);
    h.step(['right'], 5);
    expect(b.vx).toBe(HUNTER_WALK);
    h.step();
    expect(b.vx).toBe(0);
  });

  it('a lash on the ground roots him: no walking, turning or jumping until it is done', () => {
    const h = ready();
    const p = h.scene.player;
    h.step(['right'], 4);
    const x = p.body.x;
    h.step(['right', 'attack']);
    expect(p.body.vx).toBe(0);
    expect(p.body.x).toBe(x);
    for (let i = 0; i < 6; i++) {
      h.step(['left', 'jump']);
      expect(p.facing).toBe(1);
      expect(p.body.vx).toBe(0);
      expect(p.body.onGround).toBe(true);
    }
    expect(p.body.x).toBe(x);
    for (let i = 0; i < 30 && p.attackTimer > 0; i++) h.step(['right']);
    h.step(['right']);
    expect(p.body.vx).toBe(HUNTER_WALK);
  });

  it('a lash in the air leaves the jump arc as it was', () => {
    const h = ready();
    const p = h.scene.player;
    h.step(['right']);
    h.step(['right', 'jump']);
    expect(p.body.onGround).toBe(false);
    const vx = p.body.vx;
    expect(vx).toBe(HUNTER_WALK);
    h.step(['right', 'attack']);
    h.step(['left'], 6);
    expect(p.body.vx).toBe(vx);
  });

  it('a hit turns him to face it and throws him back in a fixed arc, helpless until he lands', () => {
    const h = ready();
    const p = h.scene.player;
    h.step(['left']);
    expect(p.facing).toBe(-1);
    const x0 = p.body.x;
    // Hit from his right (thrown left).
    h.world.hurtPlayer(p, -1);
    expect(knockedBack(p)).toBe(true);
    expect(p.body.vx).toBe(-KNOCK_VX);
    expect(p.body.vy).toBe(-KNOCK_VY);
    let air = 0;
    let top = p.body.y;
    for (let i = 0; i < 120 && knockedBack(p); i++) {
      // Everything held: none of it does anything in the arc.
      h.step(['right', 'jump', 'attack', 'special']);
      top = Math.min(top, p.body.y);
      if (!knockedBack(p)) break;
      air++;
      expect(p.facing).toBe(1);
      expect(p.attackTimer).toBe(0);
      expect(p.body.vx).toBe(-KNOCK_VX);
    }
    expect(p.body.onGround).toBe(true);
    expect(air).toBeGreaterThan(20);
    // About two tiles back and one and a half up.
    expect(x0 - p.body.x).toBeGreaterThan(px(24));
    expect(x0 - p.body.x).toBeLessThan(px(48));
    expect(x0 - p.body.x).toBeGreaterThan(0);
    expect(p.body.y - top).toBeGreaterThan(px(16));
    // Landed: control is back.
    h.step([]);
    h.step(['right']);
    expect(p.body.vx).toBe(HUNTER_WALK);
  });
});
