import { describe, expect, it } from 'vitest';
import { px } from '@engine/math/units';
import { ButtonLabeler, type LabelSlot } from '@engine/input/touch-logic';
import type { Action } from '@engine/input/actions';
import { SPRITES } from '@content/sprites';
import { drawnBox } from '@content/sprites/smbc-anchor';
import { RYU } from '@game/characters/ryu';
import { classicAttackLabel } from '@game/characters/ryu/classic';
import { BLANK_CAPTION, levelTouchLabels } from '@game/touch-labels';
import { flatLevel, Rig } from './classic-plumber-harness';

// Items 201 (Ryu's ATTACK caption on a wall, a vine and the flagpole) and 202 (his wall climb
// animation, Classic and Campaign).

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

describe('item 202: Campaign Ryu', () => {
  it('clinging still: the cling; carried up or down while clinging: the climb poses', () => {
    const r = rig('campaign');
    grabCampaign(r);
    r.step(['right']);
    expect(pose(r, 0)).toBe('cling');
    // His cling holds him still; move him as a climb would to see the poses.
    r.p.body.y -= px(2);
    r.step(['right']);
    expect(r.p.clinging).toBe(true);
    expect(pose(r, 0)).toBe('wallclimb-0');
    expect(pose(r, 7)).toBe('wallclimb-1');
    r.step(['right']);
    expect(pose(r, 7)).toBe('cling');
  });
});

describe('item 202: the climb frames fit the cling', () => {
  it.each([
    ['ryu-classic', 'Classic'],
    ['ryu', 'Campaign'],
  ])('%s (%s): two new frames in the cling box, same anchor, different from it and each other', (sheet) => {
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
  });
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

  it('Classic: on the flagpole (the clear) and on a vine, ATTACK says nothing', () => {
    const r = rig('classic');
    r.p.anim = 'climb';
    expect(classicAttackLabel(r.p)).toBe(BLANK_CAPTION);
    r.p.anim = 'idle';
    expect(classicAttackLabel(r.p)).toBe('SLASH');
    // On a vine every hero's buttons but the pad go (levelTouchLabels).
    (r.p as { vine: unknown }).vine = {};
    expect(classicAttackLabel(r.p)).toBe(BLANK_CAPTION);
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
