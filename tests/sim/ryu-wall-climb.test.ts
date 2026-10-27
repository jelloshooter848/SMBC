import { describe, expect, it } from 'vitest';
import { px } from '@engine/math/units';
import { ButtonLabeler, type LabelSlot } from '@engine/input/touch-logic';
import type { Action } from '@engine/input/actions';
import { SPRITES } from '@content/sprites';
import { drawnBox } from '@content/sprites/smbc-anchor';
import { RYU } from '@game/characters/ryu';
import { Lift } from '@game/entities/objects/lift';
import { getLevel } from '@content/levels';
import { runSim } from '@game/sim/headless';
import { keyHintItems, keyHintMap } from '@engine/input/key-hints';
import { defaultBindings } from '@engine/input/bindings';
import { BLANK_CAPTION, levelTouchLabels } from '@game/touch-labels';
import { flatLevel, Rig } from './classic-plumber-harness';

// Items 201 (Ryu's ATTACK caption on a wall and the flagpole) and 202 (his wall climb animation,
// Classic only: owner 233).

const col = (c: number, ch: string) => '.'.repeat(c) + ch;
/** A wall from the floor up to row 4 (9 tiles) at column 12. */
const TALL_WALL = Object.fromEntries([4, 5, 6, 7, 8, 9, 10, 11, 12].map((y) => [y, col(12, '#')]));

function rig(rules: 'classic' | 'campaign'): Rig {
  const r = new Rig(RYU, flatLevel(TALL_WALL), rules);
  r.settle();
  return r;
}

/** Classic: walk into the wall, jump and hold right until he is on it. */
function grabClassic(r: Rig): void {
  r.until(() => r.p.body.hitWall === 1, ['right'], 200);
  r.until(
    () => r.p.wall !== null,
    (i) => (i === 0 ? ['right', 'jump'] : ['right']),
    200,
  );
  expect(r.p.wall).not.toBeNull();
}

/** Campaign: walk into the wall, jump and hold right until he clings. */
function grabCampaign(r: Rig): void {
  r.until(() => r.p.body.hitWall === 1, ['right'], 200);
  r.until(
    () => r.p.clinging,
    (i) => (i === 0 ? ['right', 'jump'] : ['right']),
    200,
  );
  expect(r.p.clinging).toBe(true);
}

const pose = (r: Rig, frame: number): string => r.p.def.sprite(r.p, frame, true).frame;
const attack = (r: Rig) => levelTouchLabels(r.p, r.world).attack;

describe('item 202: Classic Ryu climbs a wall with his own poses', () => {
  it('still on the wall: the cling', () => {
    const r = rig('classic');
    grabClassic(r);
    for (let i = 0; i < 5; i++) r.step();
    expect(pose(r, 0)).toBe('cling');
    expect(pose(r, 7)).toBe('cling');
  });

  it('moving up or down: the two climb poses alternate at 115 ms (6.9 frames)', () => {
    const r = rig('classic');
    grabClassic(r);
    r.step(['up']);
    r.step(['up']);
    const y = r.p.body.y;
    r.step(['up']);
    expect(r.p.body.y).toBeLessThan(y);
    expect(pose(r, 0)).toBe('wallclimb-0');
    expect(pose(r, 6)).toBe('wallclimb-0');
    expect(pose(r, 7)).toBe('wallclimb-1');
    expect(pose(r, 14)).toBe('wallclimb-0');
    r.step(['down']);
    expect(pose(r, 7)).toBe('wallclimb-1');
    // Let go of Up: the cling again.
    r.step();
    expect(pose(r, 7)).toBe('cling');
  });

  it('held at the top of his climb with Up still held: the cling', () => {
    const r = rig('classic');
    grabClassic(r);
    let last = r.p.body.y;
    let still = 0;
    for (let i = 0; i < 300 && still < 3; i++) {
      r.step(['up']);
      still = r.p.body.y === last ? still + 1 : 0;
      last = r.p.body.y;
    }
    expect(still).toBe(3);
    expect(r.p.wall).not.toBeNull();
    expect(pose(r, 7)).toBe('cling');
  });

  it('a throw from the wall keeps the cling throw', () => {
    const r = rig('classic');
    grabClassic(r);
    r.step(['up']);
    r.step(['up', 'attack']);
    expect(pose(r, 7)).toBe('cling-throw');
  });
});

describe('item 202 (owner 233): the climb is Classic only', () => {
  it('Campaign Ryu clings still (his cling never climbs) and his sheet has no climb poses', () => {
    const r = rig('campaign');
    grabCampaign(r);
    const y = r.p.body.y;
    for (let i = 0; i < 5; i++) r.step(['right', 'up']);
    expect(r.p.clinging).toBe(true);
    expect(r.p.body.y).toBe(y);
    expect(pose(r, 7)).toBe('cling');
    expect(SPRITES.ryu!.frames['wallclimb-0']).toBeUndefined();
  });
});

describe('item 202: carried on a lift side he clings (no climb poses)', () => {
  it('a lift moving him up or down: the cling', () => {
    const r = rig('classic');
    const lift = new Lift('lift-right', 9, 9, {});
    r.world.spawn(lift);
    r.until(
      () => r.p.wall !== null,
      (i) => (i < 3 ? ['right', 'jump'] : ['right']),
      200,
    );
    expect(r.p.wall?.lift).toBe(true);
    const y0 = r.p.body.y;
    for (let i = 0; i < 10; i++) {
      lift.shift(px(1));
      r.step(['up']);
      expect(pose(r, 7)).toBe('cling');
    }
    expect(r.p.body.y).not.toBe(y0);
  });
});

describe('item 202: the climb frames fit the cling', () => {
  it.each([['ryu-classic', 'Classic']])(
    '%s (%s): two new frames in the cling box, same anchor, different from it and each other',
    (sheet) => {
      const frames = SPRITES[sheet]!.frames;
      const cling = frames.cling as readonly string[];
      const a = frames['wallclimb-0'] as readonly string[];
      const b = frames['wallclimb-1'] as readonly string[];
      for (const f of [a, b]) {
        // Same canvas (so the same anchor), inside the cling's drawn box.
        expect(f.length).toBe(cling.length);
        expect(f[0]!.length).toBe(cling[0]!.length);
        const c = drawnBox(cling);
        const d = drawnBox(f);
        expect(d.x).toBeGreaterThanOrEqual(c.x);
        expect(d.y).toBeGreaterThanOrEqual(c.y);
        expect(d.x + d.w).toBeLessThanOrEqual(c.x + c.w);
        expect(d.y + d.h).toBe(c.y + c.h); // the feet on the cling's bottom row
        expect(f.join('\n')).not.toBe(cling.join('\n'));
      }
      expect(a.join('\n')).not.toBe(b.join('\n'));
    },
  );
});

describe('item 201: Ryu touch captions', () => {
  it('Classic: SLASH on the ground; on a wall the thrown art; refreshed on leaving', () => {
    const r = rig('classic');
    expect(attack(r)).toBe('SLASH');
    grabClassic(r);
    expect(attack(r)).toBe('SHURIKEN');
    r.until(() => r.p.wall === null, ['down', 'jump'], 30);
    expect(attack(r)).toBe('SLASH');
  });

  it('Classic: on a wall with the Jump Slash as the main art (no throw): a blank caption', () => {
    const r = rig('classic');
    r.p.scratch.classicAll = 1;
    r.p.scratch.tool = 4; // the full kit's Jump Slash
    grabClassic(r);
    expect(attack(r)).toBe(BLANK_CAPTION);
    r.p.scratch.tool = 1; // the Windmill
    expect(attack(r)).toBe('WINDMILL');
  });

  it('Classic: sliding down the flagpole in a real clear, ATTACK says nothing', () => {
    let seen: string | null | undefined;
    runSim({
      level: getLevel('1-1'),
      character: RYU,
      rules: 'classic',
      script: { steps: [{ frame: 0, hold: ['right', 'jump'] }] },
      maxFrames: 400,
      start: { x: 194, y: 12, mode: 'stand' },
      until: (w) => {
        if (w.clearPhase !== 'slide') return false;
        expect(w.player.anim).toBe('climb');
        seen = levelTouchLabels(w.player, w).attack;
        return true;
      },
    });
    expect(seen).toBe(BLANK_CAPTION);
  });

  it('on a vine the shared labels hide the buttons, as for every hero', () => {
    const r = rig('classic');
    (r.p as { vine: unknown }).vine = {};
    expect(attack(r)).toBeNull();
  });

  it('Campaign: SLASH, blank while clinging, SLASH again once off the wall', () => {
    const r = rig('campaign');
    expect(attack(r)).toBe('SLASH');
    grabCampaign(r);
    expect(attack(r)).toBe(BLANK_CAPTION);
    r.until(() => r.p.body.onGround, [], 200);
    expect(attack(r)).toBe('SLASH');
  });

  it("desktop key hints keep a blank caption under the ability name (the title's empty one stays hidden)", () => {
    const keys = keyHintMap(defaultBindings(0).keyboard);
    const items = keyHintItems({ jump: 'JUMP', attack: BLANK_CAPTION }, keys);
    expect(items.map((i) => `${i.id} ${i.label}`)).toEqual(['move MOVE', 'jump JUMP', 'attack ATTACK']);
    expect(keyHintItems({ jump: 'OK', attack: '' }, keys).map((i) => i.id)).toEqual(['move', 'jump']);
  });

  it('a blank caption keeps the button (only null hides one)', () => {
    const hidden = new Set<string>();
    const el = {
      textContent: 'B' as string | null,
      style: { setProperty: () => undefined },
      classList: {
        toggle: (t: string, force?: boolean) => {
          if (force) hidden.add(t);
          else hidden.delete(t);
          return !!force;
        },
      },
    };
    const slots = new Map<Action, LabelSlot>([
      ['attack', { el, def: 'B', shape: { w: 56, h: 56, font: 14 } }],
    ]);
    const l = new ButtonLabeler(slots, () => 1);
    l.apply({ attack: 'SLASH' });
    expect(l.apply({ attack: BLANK_CAPTION })).toEqual([]);
    expect(hidden.has('hidden')).toBe(false);
    expect(el.textContent).toBe('');
  });
});
