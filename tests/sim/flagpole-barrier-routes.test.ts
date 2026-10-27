import { describe, expect, it } from 'vitest';
import { px, toPx, vel } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { getLevel, levelIds, specialLevelIds } from '@content/levels';
import { campaignLevel } from '@game/level/campaign';
import type { LevelData } from '@game/level/schema';
import { runSim, ScriptedInput } from '@game/sim/headless';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { LINK } from '@game/characters/link';
import { Spring } from '@game/entities/objects/spring';
import type { CharacterDef } from '@game/characters/character';
import type { Rules } from '@game/context';
import type { World } from '@game/world/world';

// Items 193/194, round 2 (owner decision 231 = a): the barrier stands at every pole but the four
// with a designed route over it (Campaign 2-1's Top Secret Area, the Lost Levels' 3-1, 5-1 and
// A-3 warps); a hero pinned against it still grabs the pole as he falls (never slides down it).

function world(level: LevelData, def: CharacterDef = MARIO, rules: Rules = 'campaign'): World {
  return runSim({ level, character: def, script: { steps: [] }, maxFrames: 0, rules }).world;
}

/** Put the hero at (xPx, feet yPx), airborne, the screen with him. */
function place(w: World, xPx: number, feetPx: number, vx: number, vy: number): void {
  const b = w.player.body;
  b.x = px(xPx);
  b.y = px(feetPx) - b.h;
  b.prevBottom = b.y + b.h;
  b.vx = vx;
  b.vy = vy;
  b.onGround = false;
  w.camera.x = Math.max(0, b.x - px(96));
}

function step(w: World, input: ScriptedInput, hold: Action[]): void {
  input.setHeld(hold);
  input.next();
  w.update([input]);
}

/**
 * Far above the screen, a few tiles left of the pole, rising and running right: whether the hero
 * ever gets past the shaft with his feet still above the ball (no barrier there).
 */
function passesAbove(w: World): boolean {
  const pole = w.flagpole!;
  place(w, toPx(pole.body.x) - 40, pole.topY - 100, vel(2), -vel(3));
  const input = new ScriptedInput({ steps: [] });
  for (let i = 0; i < 90 && w.clearPhase === null; i++) {
    step(w, input, ['right', 'run']);
    const b = w.player.body;
    if (b.y + b.h <= pole.body.y && b.x > pole.body.x + pole.body.w) return true;
  }
  return false;
}

const EXEMPT: [string, () => LevelData][] = [
  ['Campaign 2-1 (the Top Secret Area)', () => campaignLevel(getLevel('2-1'))],
  // top-secret.test.ts measures Luigi's jump over plain 2-1's pole too: the exemption is the level's.
  ['2-1 outside the campaign', () => getLevel('2-1')],
  ['Lost 3-1 (the springboard to the backwards warp)', () => getLevel('ll-3-1')],
  ['Lost 5-1 (the warp to World 6)', () => getLevel('ll-5-1')],
  ['Lost A-3 (the springboard to World C)', () => getLevel('ll-10-3')],
  ['Special 4-2 exit area (its pipe past the pole)', () => getLevel('sp-4-2-exit')],
];

describe('owner 231: the over-the-pole routes keep no barrier', () => {
  it.each(EXEMPT)('%s: a hero can pass over the pole', (_n, level) => {
    expect(passesAbove(world(level()))).toBe(true);
  });

  it.each(EXEMPT)('%s: Classic rules too', (_n, level) => {
    expect(passesAbove(world(level(), MARIO, 'classic'))).toBe(true);
  });

  const exemptIds = new Set(['2-1', 'll-3-1', 'll-5-1', 'll-10-3', 'sp-4-2-exit']);
  const withPole = [...levelIds(), ...specialLevelIds()].filter((id) => !exemptIds.has(id));
  it('every other level with a pole has the barrier', () => {
    let poles = 0;
    const open: string[] = [];
    for (const id of withPole) {
      const w = world(getLevel(id));
      if (!w.flagpole) continue;
      poles++;
      if (passesAbove(w)) open.push(id);
    }
    expect(poles).toBeGreaterThan(40);
    expect(open).toEqual([]);
  });
});

/**
 * Past the pole, to the warp pipe under the warp zone's ledge (its mouth's centre at `pipeX` px,
 * its top on row 10): hop up the staircase, off the ledge's far end, back left onto the pipe and
 * DOWN.
 */
function toPipe(w: World, f: number, pipeX: number): Action[] {
  const b = w.player.body;
  const cx = toPx(w.player.centerX);
  const feet = toPx(b.y + b.h);
  if (feet <= 64 && cx < pipeX + 6 * 16) return f % 24 < 14 ? ['right', 'jump'] : ['right'];
  const onTop = feet === 10 * 16 && b.onGround && Math.abs(cx - pipeX) < 24;
  if (onTop && Math.abs(cx - pipeX) <= 3) return ['down'];
  const dir = cx > pipeX ? 'left' : 'right';
  return onTop || f % 24 >= 14 ? [dir] : [dir, 'jump'];
}

/**
 * A real run from `start`: right (and RUN) held, JUMP held for 60 frames once the hero's x passes
 * `jumpAt` px (top-secret.test.ts's way over 2-1's pole); once past the pole, on right to the
 * warp pipe's mouth (`pipeX`, px of its centre) and DOWN, or RIGHT into a side pipe.
 */
function overToPipe(
  level: LevelData,
  def: CharacterDef,
  rules: Rules,
  start: { x: number; y: number },
  jumpAt: number,
  pipeX: number,
  side = false,
) {
  let jumped = -1;
  let over = false;
  let touched = false;
  const r = runSim({
    level,
    character: def,
    rules,
    assist: { invulnerable: true },
    script: { steps: [] },
    start: { ...start, mode: 'stand', time: 300 },
    maxFrames: 1500,
    controller: (w, f) => {
      const p = w.player;
      if (p.body.x > w.flagpole!.body.x + w.flagpole!.body.w) over = true;
      if (!over) {
        const hold: Action[] = ['right', 'run'];
        if (f > 2 && jumped < 0 && toPx(p.body.x) >= jumpAt) jumped = f;
        if (jumped >= 0 && f - jumped < 60) hold.push('jump');
        return hold;
      }
      if (side) return ['right'];
      return toPipe(w, f, pipeX);
    },
    until: (w) => {
      touched ||= w.clearPhase !== null;
      return touched;
    },
  });
  const pipe = r.events.find((e) => e.type === 'pipe');
  return { over, touched, pipe: pipe?.type === 'pipe' ? pipe.target : null };
}

const bare = (id: string) => {
  const l = getLevel(id);
  l.entities = l.entities.filter((e) => e.type.startsWith('decor') || e.type.startsWith('spring'));
  return l;
};

describe('owner 231, 237, 238: each route over the pole still works with the barrier on', () => {
  // Campaign 2-1: top-secret.test.ts (every hero over the pole untouched, into the cave) and
  // Lost 3-1: lost-world3.test.ts (the green springboard vaults Mario over the flagpole), unedited.

  it('Lost 5-1: a running jump off the pipe by the pole, over it untouched, to the warp pipe to World 6', () => {
    const r = overToPipe(bare('ll-5-1'), LUIGI, 'campaign', { x: 352, y: 4 }, 352 * 16 + 28, 406 * 16 + 16);
    expect(r).toMatchObject({ over: true, touched: false, pipe: { level: 'll-6-1' } });
  });

  it('Lost 5-1: and off the end of the tall wall', () => {
    const r = overToPipe(bare('ll-5-1'), LUIGI, 'classic', { x: 321, y: 1 }, 321 * 16 + 520, 406 * 16 + 16);
    expect(r).toMatchObject({ over: true, touched: false, pipe: { level: 'll-6-1' } });
  });

  it('Lost A-3: the springboard at 156 vaults over the pole, on to the warp pipe to World C', () => {
    const l = bare('ll-10-3');
    let spring: Spring | undefined;
    let launched = false;
    let over = false;
    let touched = false;
    const r = runSim({
      level: { ...l, start: { x: 156, y: 8 }, startMode: 'stand' },
      character: LINK,
      script: { steps: [] },
      maxFrames: 1500,
      assist: { invulnerable: true },
      controller: (w, f) => {
        spring ??= w.entities.find((e): e is Spring => e instanceof Spring);
        if (spring?.busy) launched = true;
        if (w.player.body.x > w.flagpole!.body.x + w.flagpole!.body.w) over = true;
        if (!over) return launched ? ['jump', 'right'] : [];
        return toPipe(w, f, 246 * 16 + 16);
      },
      until: (w) => {
        touched ||= w.clearPhase !== null;
        return touched;
      },
    });
    expect(launched).toBe(true);
    expect(over).toBe(true);
    expect(touched).toBe(false);
    const pipe = r.events.find((e) => e.type === 'pipe');
    expect(pipe?.type === 'pipe' ? pipe.target : null).toMatchObject({ level: 'll-12-1' });
  });

  it("Special 4-2's exit area: off the high blocks, over the pole, into the side pipe past it", () => {
    const r = overToPipe(bare('sp-4-2-exit'), LUIGI, 'classic', { x: 12, y: 4 }, 12 * 16 + 40, 0, true);
    expect(r).toMatchObject({ over: true, touched: false, pipe: { level: 'sp-4-2-exit' } });
  });

  it("Special 4-2's exit area: its pipe is reached only over the pole (a base block under the shaft)", () => {
    const w = world(getLevel('sp-4-2-exit'));
    const pole = w.flagpole!;
    // The shaft stands down to a solid base block on the floor's row: no way past at its foot.
    expect(pole.baseY / 16).toBe(12);
    expect(w.map.isSolid(pole.tx, 12)).toBe(true);
    // The area is entered only at its left (the start), so the pipe at 75 lies beyond the pole.
    expect(getLevel('sp-4-2-exit').start.x).toBeLessThan(pole.tx);
  });
});

describe('item 194 review: a hero pinned at the barrier grabs the pole as he falls', () => {
  const ids = ['mario', 'luigi', 'link', 'megaman', 'samus', 'simon', 'ryu', 'bill'];
  const heroes = CHARACTERS.filter((d) => ids.includes(d.id));
  const cases: [string, CharacterDef, Rules, boolean][] = [];
  for (const d of heroes)
    for (const rules of ['campaign', 'classic'] as const)
      for (const holdRight of [false, true])
        cases.push([`${d.id}, ${rules}, ${holdRight ? 'holding Right' : 'letting go'}`, d, rules, holdRight]);
  expect(heroes).toHaveLength(8);

  it.each(cases)('%s: pinned 4 px above the ball, then the top grab', (_n, def, rules, holdRight) => {
    const w = world(getLevel('1-1'), def, rules);
    const pole = w.flagpole!;
    // Just short of the barrier, feet 4 px above the ball, moving right.
    const b = w.player.body;
    place(w, toPx(pole.body.x) - toPx(b.w) - 2, pole.topY - 4, vel(1), 0);
    const before = w.state.score;
    const input = new ScriptedInput({ steps: [] });
    let pinned = false;
    for (let f = 0; f < 120 && w.clearPhase === null; f++) {
      step(w, input, f < 4 || holdRight ? ['right'] : []);
      if (b.y + b.h <= pole.body.y && b.x + b.w > pole.body.x - px(1)) pinned = true;
    }
    expect(pinned).toBe(true);
    // He grabbed the pole high up (never slid down it to the base and the bottom score).
    expect(w.clearPhase).not.toBeNull();
    expect(w.flagGrabbedBy).toBe(w.player);
    expect(w.state.score - before).toBeGreaterThanOrEqual(4000);
  });
});
