import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import { SPRITES } from '@content/sprites';
import { LINK_CLASSIC_BODIES, LINK_CLASSIC_TOP } from '@content/sprites/link-classic';
import { SAMUS_CLASSIC_FRAMES, SAMUS_CLASSIC_ORIGIN } from '@content/sprites/samus-classic';
import {
  SIMON_CLASSIC_BODY_OF,
  SIMON_CLASSIC_FRAMES,
  SIMON_CLASSIC_ORIGIN,
} from '@content/sprites/simon-classic';
import { marioClassicDef } from '@content/sprites/mario-classic';
import { shownPortrait, type CharacterDef } from '@game/characters/character';
import { LINK_CLASSIC, SWORD_BOX } from '@game/characters/link/classic';
import { CLASSIC_GROW_SEQ, CLASSIC_GROW_STEP, MARIO_CLASSIC } from '@game/characters/mario/classic';
import { LUIGI_CLASSIC } from '@game/characters/luigi/classic';
import { SAMUS_CLASSIC } from '@game/characters/samus/classic';
import { MISSILE_UP_CLASSIC, MUZZLE, WAVE_BEAM_CLASSIC } from '@game/characters/samus/classic-weapons';
import { SIMON_CLASSIC } from '@game/characters/simon/classic';
import { WHIP_REACH } from '@game/characters/simon/classic-weapons';
import { Rig, flatLevel } from './classic-plumber-harness';
import { useStorage } from './heroes-harness';

// R1 (part A): Classic Link, Samus and Simon redrawn at the original 3.1.21's per-frame sizes
// (ANIMATION_CATALOGUE, NES px), Mario and Luigi's few poses more than 1 px off re-cut; feet on
// the floor, weapons where their boxes are, the campaign's sheets untouched.

useStorage();

type Size = readonly [number, number];

/** The drawn bounding box of `rows` (width, height), and its bottom row. */
function bbox(rows: readonly string[]): {
  w: number;
  h: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  let left = Infinity;
  let right = -1;
  let top = Infinity;
  let bottom = -1;
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++)
      if (r[x] !== '.') {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  });
  return { w: right - left + 1, h: bottom - top + 1, top, bottom, left, right };
}

function within(name: string, rows: readonly string[] | undefined, [w, h]: Size, tol = 1): void {
  expect(rows, name).toBeDefined();
  const b = bbox(rows as string[]);
  expect(Math.abs(b.w - w), `${name} width ${b.w} vs the original's ${w}`).toBeLessThanOrEqual(tol);
  expect(Math.abs(b.h - h), `${name} height ${b.h} vs the original's ${h}`).toBeLessThanOrEqual(tol);
}

// The original's LinkMc / SamusMc / SimonMc / MarioMc body sizes (NES px), by our frame.
const LINK_SIZES: Record<string, Size> = {
  idle: [15, 16],
  'walk-0': [14, 15],
  'walk-1': [15, 16],
  'attack-0': [15, 15],
  'attack-1': [14, 15],
  'attack-2': [15, 16],
  'attack-air': [14, 15],
  'stab-up-0': [16, 16],
  'stab-up-1': [12, 16],
  'stab-down-0': [16, 15],
  'stab-down-1': [14, 16],
  'up-thrust-0': [12, 16],
  'up-thrust-1': [16, 16],
  'down-thrust-0': [15, 16],
  'down-thrust-1': [16, 15],
  jump: [14, 15],
  'roll-0': [15, 14],
  'roll-1': [14, 15],
  'roll-2': [15, 14],
  'climb-0': [12, 16],
  'climb-1': [12, 16],
  'raise-arms': [14, 16],
  'die-front': [15, 16],
  'die-right': [14, 15],
  'die-back': [12, 16],
  'die-left': [14, 15],
  'die-spark-0': [10, 10],
  'die-spark-1': [16, 16],
};
const SAMUS_SIZES: Record<string, Size> = {
  idle: [22, 33],
  shoot: [20, 33],
  'walk-0': [17, 32],
  'walk-1': [19, 33],
  'walk-2': [22, 33],
  'walk-shoot-0': [22, 32],
  'walk-shoot-1': [24, 32],
  'walk-shoot-2': [27, 32],
  'aim-up': [16, 39],
  'aim-up-shoot': [16, 37],
  'up-walk-0': [14, 39],
  'up-walk-1': [19, 39],
  'up-walk-2': [21, 39],
  'up-walk-shoot-0': [14, 37],
  'up-walk-shoot-1': [19, 37],
  'up-walk-shoot-2': [21, 37],
  air: [20, 27],
  'air-shoot': [25, 27],
  'up-air': [20, 34],
  'up-air-shoot': [20, 32],
  'spin-0': [21, 17],
  'spin-1': [16, 25],
  'spin-2': [21, 17],
  'spin-3': [16, 25],
  crouch: [23, 25],
  'crouch-shoot': [21, 25],
  'ball-0': [14, 15],
  'ball-1': [14, 15],
  'ball-2': [14, 15],
  'ball-3': [14, 15],
  'climb-0': [18, 33],
  'climb-1': [18, 33],
};
/** Aiming up mid-stride: the walk's legs make ours 16 wide (the original's upWalk-1 is 14). */
const SAMUS_TOL: Record<string, number> = { 'up-walk-0': 2, 'up-walk-shoot-0': 2 };
const SIMON_SIZES: Record<string, Size> = {
  idle: [16, 30],
  'walk-0': [12, 31],
  'walk-1': [15, 30],
  'walk-2': [12, 31],
  'walk-3': [16, 30],
  'throw-0': [24, 30],
  'throw-1': [16, 30],
  'throw-2': [22, 29],
  crouch: [16, 23],
  'crouch-throw-0': [24, 23],
  'crouch-throw-1': [16, 23],
  'crouch-throw-2': [22, 22],
  'jump-tuck': [16, 23],
  hurt: [16, 29],
  'climb-0': [13, 34],
  'climb-1': [13, 34],
  'die-0': [16, 21],
  'die-1': [32, 15],
};
const MARIO_SIZES: Record<string, Size> = {
  'small-walk-2': [11, 16],
  'small-skid': [13, 16],
  'small-die': [14, 14],
  'big-idle': [16, 32],
  'grow-mid': [16, 24],
};

describe('every Classic pose at the original 3.1.21 size', () => {
  it('Link (LinkMc: 15 x 16 standing, nothing over 16 px but the sword)', () => {
    for (const [f, size] of Object.entries(LINK_SIZES)) within(`link ${f}`, LINK_CLASSIC_BODIES[f], size);
    for (const f of Object.keys(LINK_SIZES)) expect(SPRITES['link-classic']?.frames[f], f).toBeDefined();
  });

  it('Samus (SamusMc: stand 22 x 33 with the cannon, aim up 16 x 39, ball 14 x 15)', () => {
    for (const [f, size] of Object.entries(SAMUS_SIZES))
      within(`samus ${f}`, SPRITES['samus-classic']?.frames[f], size, SAMUS_TOL[f] ?? 1);
  });

  it('Simon (SimonMc: stand 16 x 30; the whip frames are these bodies plus the lash)', () => {
    for (const [f, size] of Object.entries(SIMON_SIZES)) within(`simon ${f}`, SIMON_CLASSIC_FRAMES[f], size);
    for (const [whip, body] of Object.entries(SIMON_CLASSIC_BODY_OF)) {
      expect(SIMON_SIZES[body], body).toBeDefined();
      expect(
        SPRITES['simon-classic']?.frames[whip] ?? SPRITES['simon-flame']?.frames[whip],
        whip,
      ).toBeDefined();
    }
  });

  it("Mario and Luigi: the poses more than 1 px off the original's are re-cut", () => {
    for (const [f, size] of Object.entries(MARIO_SIZES))
      within(`mario ${f}`, marioClassicDef.frames[f], size);
    // Same cells as the campaign's frames, so every offset still holds.
    for (const [f, rows] of Object.entries(marioClassicDef.frames)) {
      const cur = SPRITES.mario?.frames[f] as string[];
      expect([rows[0]?.length, rows.length], f).toEqual([cur[0]?.length, cur.length]);
    }
  });
});

describe('the weapons line up with their boxes', () => {
  it("Link's sword tip at the stab box's reach; the up and down blades at theirs", () => {
    const stab = SPRITES['link-classic']?.frames['attack-0'] as string[];
    // Centre column 8 (offsetX 2 on the 12 px body).
    expect(Math.abs(bbox(stab).right + 1 - 8 - SWORD_BOX.forward.x1)).toBeLessThanOrEqual(1);
    const up = SPRITES['link-classic']?.frames['stab-up-0'] as string[];
    const top = LINK_CLASSIC_TOP['stab-up-0'] as number;
    // The blade's tip: 16 + top rows above the feet, the box's -27.
    expect(Math.abs(up.length - bbox(up).top + 0 - -SWORD_BOX.up.y0)).toBeLessThanOrEqual(1);
    expect(up.length - 16).toBe(top);
    const down = SPRITES['link-classic']?.frames['stab-down-0'] as string[];
    expect(Math.abs(bbox(down).bottom + 1 - 16 - SWORD_BOX.down.y1)).toBeLessThanOrEqual(1);
  });

  it("Samus's muzzle where her shots appear (SamusShot.as: 12.5 ahead, 22 up)", () => {
    const idle = SAMUS_CLASSIC_FRAMES.idle as string[];
    const b = bbox(idle);
    expect(Math.abs(b.right + 1 - (SAMUS_CLASSIC_ORIGIN as number) - MUZZLE.ahead)).toBeLessThanOrEqual(1.5);
    const glow = idle.findIndex((r) => r.includes('5'));
    expect(Math.abs(idle.length - glow - MUZZLE.stand)).toBeLessThanOrEqual(1.5);
    const crouch = SAMUS_CLASSIC_FRAMES.crouch as string[];
    const cg = crouch.findIndex((r) => r.includes('5'));
    expect(Math.abs(crouch.length - cg - MUZZLE.crouch)).toBeLessThanOrEqual(1.5);
  });

  it("Simon's lash ends near the whip box's reach", () => {
    for (const [f, state] of [
      ['whip-leather', 'small'],
      ['whip-chain', 'big'],
    ] as const) {
      const rows = SIMON_CLASSIC_FRAMES[f] as string[];
      const tip = bbox(rows).right - (SIMON_CLASSIC_ORIGIN[f] as number);
      expect(Math.abs(tip - (WHIP_REACH[state] as number)), f).toBeLessThanOrEqual(3);
    }
  });
});

/** Where the art's lowest pixel and the hero's centre land for this frame's sprite. */
function drawn(r: Rig): { bottom: number; feet: number; name: string } {
  const p = r.p;
  const s = p.def.sprite(p, r.frame, false);
  const rows = SPRITES[s.sheet]?.frames[s.frame] as string[];
  expect(rows, `${s.sheet}:${s.frame}`).toBeDefined();
  const y = toPx(p.body.y) - s.offsetY;
  return {
    bottom: y + bbox(rows).bottom + 1,
    feet: toPx(p.body.y + p.body.h),
    name: `${s.sheet}:${s.frame}`,
  };
}

function standsOnFloor(def: CharacterDef, power: string, inputs: Action[][]): string[] {
  const r = new Rig(def, flatLevel(), 'classic', power);
  r.settle();
  const seen: string[] = [];
  for (const hold of inputs) {
    r.step(hold);
    if (!r.p.body.onGround) continue;
    const d = drawn(r);
    seen.push(d.name);
    expect(d.bottom, d.name).toBe(d.feet);
  }
  return seen;
}

describe('feet anchored', () => {
  const walk: Action[][] = [...Array.from({ length: 30 }, (): Action[] => ['right']), [], []];
  it('Link stands, walks and stabs on the floor, every state', () => {
    for (const power of ['small', 'big', 'fire']) {
      const seen = standsOnFloor(LINK_CLASSIC, power, [
        ...walk,
        ['attack'],
        ...Array.from({ length: 15 }, (): Action[] => []),
        ['up', 'attack'],
        ...Array.from({ length: 15 }, (): Action[] => ['up']),
      ]);
      expect(seen.filter((s) => !/^link-classic(-shield)?:/.test(s))).toEqual([]);
      expect(seen.some((s) => s.startsWith('link-classic-shield:'))).toBe(power !== 'small');
      expect(new Set(seen).size).toBeGreaterThan(4);
    }
  });

  it('Samus stands, walks, shoots and crouches on the floor', () => {
    const seen = standsOnFloor(SAMUS_CLASSIC, 'big', [
      ...walk,
      ['attack'],
      [],
      ['up'],
      ['up', 'attack'],
      [],
      ['down'],
      [],
      [],
      ['down'],
      ...Array.from({ length: 20 }, (): Action[] => []),
    ]);
    expect(seen.filter((s) => !s.startsWith('samus-classic:'))).toEqual([]);
    expect(seen.join(' ')).toMatch(/ball/);
    expect(seen.join(' ')).toMatch(/aim-up/);
  });

  it('Simon stands, walks, whips and crouches on the floor', () => {
    for (const power of ['small', 'big', 'fire']) {
      const seen = standsOnFloor(SIMON_CLASSIC, power, [
        ...walk,
        ['attack'],
        ...Array.from({ length: 22 }, (): Action[] => []),
        ['down'],
        ['down', 'attack'],
        ...Array.from({ length: 22 }, (): Action[] => ['down']),
      ]);
      expect(seen.some((s) => /whip-(leather|chain|flame)$/.test(s))).toBe(true);
      expect(seen.some((s) => s.includes('crouch-whip'))).toBe(true);
    }
  });

  it('Mario and Luigi stand on their re-cut frames', () => {
    for (const def of [MARIO_CLASSIC, LUIGI_CLASSIC]) {
      const seen = standsOnFloor(def, 'big', [...walk, ...Array.from({ length: 60 }, (): Action[] => [])]);
      expect(seen).toContain('mario-classic:big-idle');
    }
  });

  it("Link's shield is drawn only with the Mushroom or Flower (the original's small Link has none)", () => {
    const plain = SPRITES['link-classic']?.frames;
    const shield = SPRITES['link-classic-shield']?.frames;
    expect(Object.keys(shield ?? {})).toEqual(Object.keys(plain ?? {}));
    expect(shield?.idle).not.toEqual(plain?.idle);
    expect(plain?.idle?.join('')).not.toMatch(/a/);
  });

  it('the hurt and air poses keep the feet on the body floor too (bottom row of the cell)', () => {
    for (const [sheet, frames] of [
      ['link-classic', ['jump', 'roll-1', 'climb-0', 'die-front']],
      ['samus-classic', ['air', 'hurt', 'spin-1', 'climb-0']],
      ['simon-classic', ['jump-tuck', 'hurt', 'climb-0', 'die-0', 'die-1']],
    ] as const)
      for (const f of frames) {
        const rows = SPRITES[sheet]?.frames[f] as string[];
        expect(bbox(rows).bottom, `${sheet}:${f}`).toBe(rows.length - 1);
      }
  });
});

describe('the rest of the Classic look', () => {
  it('the select screen and the intro card show the Classic art', () => {
    expect(shownPortrait(LINK_CLASSIC).sheet).toBe('link-classic');
    expect(shownPortrait(SAMUS_CLASSIC).sheet).toBe('samus-classic');
    expect(shownPortrait(SIMON_CLASSIC).sheet).toBe('simon-classic');
  });

  it("Mario's grow steps at 50 ms (ANIM_TMR_FOR_FREEZE): done at frame 42, then big to the freeze's end", () => {
    const r = new Rig(MARIO_CLASSIC, flatLevel(), 'classic', 'small');
    r.settle();
    r.p.powerState = 'big';
    r.p.startTransition('grow', 61);
    const seq: string[] = [];
    for (let t = 0; t < 61; t++) {
      if (r.p.transition) r.p.transition.t = t;
      seq.push(MARIO_CLASSIC.sprite(r.p, t, false).frame);
    }
    const code = (f: string) => (f === 'small-idle' ? 'S' : f === 'grow-mid' ? 'M' : 'B');
    const steps = seq.filter((_, t) => t % CLASSIC_GROW_STEP === 0).map(code);
    expect(steps.slice(0, CLASSIC_GROW_SEQ.length).join('')).toBe(CLASSIC_GROW_SEQ);
    expect(CLASSIC_GROW_STEP * CLASSIC_GROW_SEQ.length).toBe(42);
    expect(seq.slice(42).every((f) => f === 'big-idle')).toBe(true);
    // Each step holds 3 frames.
    expect(seq.slice(0, 3)).toEqual(['small-idle', 'small-idle', 'small-idle']);
    expect(seq[3]).toBe('grow-mid');
  });

  it("the upward missile's art is its 8 x 10 body; the Wave Beam has only its Varia look", () => {
    const up = SPRITES['smbc-shots']?.frames[MISSILE_UP_CLASSIC.frames[0] as string] as string[];
    expect([up[0]?.length, up.length]).toEqual([MISSILE_UP_CLASSIC.w, MISSILE_UP_CLASSIC.h]);
    expect(WAVE_BEAM_CLASSIC.frames.every((f) => f.startsWith('wave-varia'))).toBe(true);
    for (const f of ['wave-0', 'wave-1', 'wave-burst'])
      expect(SPRITES['smbc-shots']?.frames[f]).toBeUndefined();
  });

  it("the campaign's sheets are unchanged (and Pit's own)", () => {
    const hash = (sheet: string) =>
      createHash('sha256').update(JSON.stringify(SPRITES[sheet]?.frames)).digest('hex').slice(0, 16);
    expect({
      link: hash('link'),
      samus: hash('samus'),
      simon: hash('simon'),
      mario: hash('mario'),
      pit: hash('pit'),
    }).toEqual({
      link: '0fe968b3b29bcfe5',
      samus: '2b1aee92a4af5d00',
      simon: '525d23035f91b037',
      mario: '7d379af656df62a2',
      pit: '0a1dcc3cb7196b06',
    });
  });
});
