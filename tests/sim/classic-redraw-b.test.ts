import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import type { Action } from '@engine/input/actions';
import { SPRITES } from '@content/sprites';
import { drawnBox } from '@content/sprites/smbc-anchor';
import { MEGAMAN_SMBC_CANVAS } from '@content/sprites/smbc-megaman';
import { RYU_SMBC_CANVAS } from '@content/sprites/smbc-ryu';
import { BILL_SMBC_CANVAS } from '@content/sprites/smbc-bill';
import { JASON_SMBC_CANVAS } from '@content/sprites/smbc-sophia';
import type { CharacterDef } from '@game/characters/character';
import { MEGAMAN_CLASSIC } from '@game/characters/megaman/classic';
import { MM_SHOT_PAD } from '@game/characters/megaman/classic-weapons';
import { PROTOMAN_CLASSIC, BREAKMAN_CLASSIC } from '@game/characters/protoman/classic';
import { BASS_CLASSIC } from '@game/characters/bass/classic';
import { RYU_CLASSIC, CLASSIC_SWORD_REACH } from '@game/characters/ryu/classic';
import { BILL_CLASSIC } from '@game/characters/bill/classic';
import { SOPHIA_CLASSIC } from '@game/characters/sophia/classic';
import { CLASSIC_HURT, CLASSIC_WALK_ANIM, WALK_RYU } from '@game/characters/classic/anim';
import { Rig, flatLevel } from './classic-plumber-harness';
import { useStorage } from './heroes-harness';

// R1 (owner decision 2026-10-20), part B: Mega Man, Ryu, Bill and Sophia III / Jason redrawn on
// their Classic sheets at the original 3.1.21's per-frame sizes (ANIMATION_CATALOGUE numbers, NES
// px), standing on the ground, their weapons where their shots and swords hit. Current sheets
// untouched; Proto Man, Break Man and Bass keep their own sheets.

useStorage();

const frame = (sheet: string, name: string): readonly string[] => {
  const f = SPRITES[sheet]?.frames[name];
  if (!f) throw new Error(`${sheet}:${name} missing`);
  return f;
};

/** [frame, original W, original H] (body bbox; with the buster or sword layer where drawn). */
type Size = readonly [string, number, number];

const MEGAMAN_SIZES: Size[] = [
  ['idle', 21, 24], // stand
  ['idle-blink', 21, 24],
  ['charge-0', 21, 24],
  ['step', 19, 24], // walk-0
  ['walk-0', 24, 22], // walk-1
  ['walk-1', 16, 24], // walk-2 / walk-4
  ['walk-2', 21, 22], // walk-3
  ['shoot', 31, 24], // body 21 at -10.5, buster 13x6 at 7.5
  ['walk-shoot-0', 29, 22], // walkShoot-1 19 at -12, buster at 4
  ['walk-shoot-1', 26, 24], // walkShoot-2 16 at -9
  ['walk-shoot-2', 30, 22], // walkShoot-3 21 at -13
  ['jump', 26, 30],
  ['jump-shoot', 29, 30], // jumpShoot 24 at -13, buster at 3
  ['hurt', 26, 28], // takeDamage
  ['climb-0', 16, 29],
  ['climb-1', 16, 29],
  ['slide', 27, 21],
];
const RYU_SIZES: Size[] = [
  ['idle', 17, 32],
  ['idle-1', 17, 32],
  ['walk-0', 20, 31],
  ['walk-1', 22, 31],
  ['walk-2', 20, 31],
  ['walk-3', 20, 31],
  ['fall', 17, 31],
  ['jump', 20, 16], // flipStart
  ['spin-1', 16, 22],
  ['spin-2', 20, 16],
  ['spin-3', 16, 22],
  ['spin-0', 16, 22],
  ['jslash-0', 22, 23],
  ['jslash-1', 24, 25],
  ['jslash-2', 22, 23],
  ['jslash-3', 24, 25],
  ['slash-0', 18, 31], // attackStart
  ['slash-1', 31, 29], // attack-2 26x29 at -8.5, sword 14x7 at 8.5
  ['crouch', 17, 24],
  ['crouch-slash-0', 18, 23],
  ['crouch-slash', 31, 23], // crouchAttack-2 25x23, sword at 8.5
  ['throw', 26, 29],
  ['cling', 15, 31], // climbStop
  ['cling-throw', 21, 31],
  ['hurt', 16, 22],
  ['die', 16, 22],
  ['climb-0', 15, 31], // climbPoleStart
  ['climb-1', 15, 29], // climbPole-2
];
const BILL_SIZES: Size[] = [
  ['idle', 23, 34], // torso normal 23x15 over legs stand 12x19
  ['aim-up', 14, 44], // torso up 14x26 at -28 from the torso origin
  ['aim-diag-up', 17, 35], // diagUp 16x16 at (-5, -19) over the legs (-6)
  ['aim-diag-down', 20, 35], // diagDwn 20x21 at (-7, -19)
  ['walk-0', 19, 34], // torso walk 17 at -8, legs walk-1 18 at -10
  ['walk-1', 21, 33], // legs walk-2 21 at -10, the torso 1 lower
  ['walk-2', 17, 35], // legs walk-3 12, the torso 1 higher
  ['fall', 19, 34], // torso fall 17x15, legs fall 18x19
  ['spin-0', 20, 16],
  ['spin-1', 16, 20],
  ['spin-2', 20, 16],
  ['spin-3', 16, 20],
  ['prone', 34, 17], // crouch
  ['die', 23, 18], // dieStart
  ['climb-0', 19, 39], // climbStart
];
const SOPHIA_SIZES: Size[] = [
  ['idle', 26, 18], // hull 26x16 over the 8x8 wheels
  ['drive-1', 26, 19],
  ['turn-1', 18, 18], // turn 18x16 over a wheel
  ['aim-diag', 26, 24], // diag 25x24 (+ the back wheel's edge)
  // up 21x26 lifted on its struts: 2 px shorter, as the 32x32 tank frame (turned about its centre
  // on walls) has 24 rows above her wheels' bottom.
  ['aim-up', 26, 24],
  ['open', 26, 24],
  ['jason-stand', 10, 17],
  ['jason-walk-0', 10, 16],
];

function checkSizes(sheet: string, sizes: Size[]): string[] {
  const bad: string[] = [];
  for (const [name, w, h] of sizes) {
    const b = drawnBox(frame(sheet, name));
    if (Math.abs(b.w - w) > 1 || Math.abs(b.h - h) > 1) bad.push(`${name}: ${b.w}x${b.h}, want ${w}x${h}`);
  }
  return bad;
}

describe('every redrawn pose is the original size (+/-1 px)', () => {
  it('Mega Man (MegaManMc)', () => expect(checkSizes('megaman-classic', MEGAMAN_SIZES)).toEqual([]));
  it('Ryu (RyuMc)', () => expect(checkSizes('ryu-classic', RYU_SIZES)).toEqual([]));
  it('Bill (BillMc, BillTorsoMc over BillLegsMc)', () =>
    expect(checkSizes('bill-classic', BILL_SIZES)).toEqual([]));
  it('Sophia III (SophiaMc) and Jason (JasonMc)', () =>
    expect(checkSizes('sophia-classic', SOPHIA_SIZES)).toEqual([]));
});

describe('feet on the ground', () => {
  const GROUND: [string, number, readonly string[]][] = [
    [
      'megaman-classic',
      MEGAMAN_SMBC_CANVAS.h,
      ['idle', 'step', 'walk-0', 'walk-1', 'walk-2', 'shoot', 'slide'],
    ],
    [
      'ryu-classic',
      RYU_SMBC_CANVAS.h,
      ['idle', 'walk-0', 'walk-1', 'walk-2', 'walk-3', 'slash-1', 'crouch', 'throw'],
    ],
    ['bill-classic', BILL_SMBC_CANVAS.h, ['idle', 'shoot', 'aim-up', 'walk-0', 'walk-1', 'walk-2', 'prone']],
    ['sophia-classic', 24, ['idle', 'drive-0', 'drive-1', 'aim-diag', 'aim-up', 'open', 'turn-1']],
    ['sophia-classic', JASON_SMBC_CANVAS.h, ['jason-stand', 'jason-walk-0']],
  ];
  it('every ground pose ends on the canvas row the hitbox stands on', () => {
    const bad: string[] = [];
    for (const [sheet, ground, names] of GROUND)
      for (const n of names) {
        const b = drawnBox(frame(sheet, n));
        if (b.y + b.h !== ground) bad.push(`${sheet}:${n} ends at ${b.y + b.h}, ground ${ground}`);
      }
    expect(bad).toEqual([]);
  });

  it("sprite() puts the canvas's origin under the hitbox's bottom centre", () => {
    const cases: [CharacterDef, string, number][] = [
      [MEGAMAN_CLASSIC, 'megaman-classic', MEGAMAN_SMBC_CANVAS.cx],
      [RYU_CLASSIC, 'ryu-classic', RYU_SMBC_CANVAS.cx],
      [BILL_CLASSIC, 'bill-classic', BILL_SMBC_CANVAS.cx],
    ];
    for (const [def, sheet, cx] of cases) {
      const r = new Rig(def, flatLevel(), 'classic', 'small');
      r.settle();
      const s = def.sprite(r.p, r.frame, false);
      const box = def.hitbox(r.p);
      const rows = frame(sheet, s.frame);
      expect(s.sheet).toBe(sheet);
      expect(s.offsetX + box.w / 2).toBe(cx);
      expect(rows.length - s.offsetY).toBe(box.h);
      // Standing: Mega Man and Ryu centred on the origin (within the original's half pixel); Bill's
      // rifle reaches ahead of him (his torso at -7..16 over legs at -6..6).
      const b = drawnBox(rows);
      const centre = def === BILL_CLASSIC ? 4.5 : 0;
      expect(Math.abs(b.x + b.w / 2 - cx - centre)).toBeLessThanOrEqual(1.5);
    }
  });
});

/** The drawn pixels of `rows` in the box (canvas coordinates, inclusive). */
function pixelsIn(
  rows: readonly string[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  ch?: string,
): number {
  let n = 0;
  for (let y = Math.max(0, y0); y <= Math.min(rows.length - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= x1; x++) {
      const c = rows[y]?.[x];
      if (c !== undefined && c !== '.' && (ch === undefined || c === ch)) n++;
    }
  return n;
}

describe('weapons line up with the new art', () => {
  it("Mega Man's buster is where his shots leave (19 px ahead, 13 px up; in the air the arm's height)", () => {
    const C = MEGAMAN_SMBC_CANVAS;
    const shoot = frame('megaman-classic', 'shoot');
    const mx = C.cx + 19;
    const my = C.h - MM_SHOT_PAD.ground;
    // The cannon's dark barrel (2) reaches the spawn point's column at its row.
    expect(pixelsIn(shoot, mx - 3, my - 2, mx, my + 2, '2')).toBeGreaterThan(0);
    const air = frame('megaman-classic', 'jump-shoot');
    expect(pixelsIn(air, C.cx + 10, C.h - 23, C.cx + 16, C.h - 17, '2')).toBeGreaterThan(0);
  });

  it("Ryu's blade lies inside his sword box (CLASSIC_SWORD_REACH), standing and crouched", () => {
    const C = RYU_SMBC_CANVAS;
    const blade = (name: string, r: { x0: number; x1: number; y0: number; y1: number }) => {
      const f = frame('ryu-classic', name);
      const inBox = pixelsIn(f, C.cx + r.x0, C.h - r.y1, C.cx + r.x1, C.h - r.y0, '5');
      const all = pixelsIn(f, C.cx, 0, C.w, C.h, '5');
      return { inBox, all };
    };
    for (const [name, r] of [
      ['slash-1', CLASSIC_SWORD_REACH.stand],
      ['crouch-slash', CLASSIC_SWORD_REACH.crouch],
      ['slash-wave-0', CLASSIC_SWORD_REACH.standLong],
      ['crouch-slash-wave-0', CLASSIC_SWORD_REACH.crouchLong],
    ] as const) {
      const b = blade(name, r);
      expect(b.inBox, name).toBeGreaterThan(8);
      expect(b.inBox, name).toBe(b.all);
    }
  });

  it("Bill's rifle muzzles are at his shots' start points (classic.ts MUZZLE)", () => {
    const C = BILL_SMBC_CANVAS;
    const cases: [string, number, number][] = [
      ['idle', 17.5, 22.5],
      ['aim-up', 4.5, 46.5],
      ['aim-diag-up', 13.5, 34.5],
      ['aim-diag-down', 15, 13],
      ['prone', 18, 7.5],
    ];
    for (const [name, fwd, up] of cases) {
      const f = frame('bill-classic', name);
      const x = Math.round(C.cx + fwd);
      const y = Math.round(C.h - up);
      // A rifle pixel (5) within 4 px of the muzzle point (the original's spawn points sit up to
      // 2.5 px past its art, BillBullet.OFS_ARR against BillTorsoMc).
      expect(pixelsIn(f, x - 4, y - 4, x + 4, y + 4, '5'), name).toBeGreaterThan(0);
    }
  });
});

describe('the Classic heroes play on the new sheets', () => {
  /** Every frame name a few seconds of play asks for exists on the sheet it names. */
  function missing(def: CharacterDef, power: string, inputs: Action[][]): string[] {
    const r = new Rig(def, flatLevel(), 'classic', power);
    r.settle();
    const out = new Set<string>();
    for (const hold of inputs)
      for (let i = 0; i < 24; i++) {
        r.step(hold);
        for (const f of [r.frame, r.frame + 1]) {
          const s = def.sprite(r.p, f, false);
          if (!SPRITES[s.sheet]?.frames[s.frame]) out.add(`${s.sheet}:${s.frame}`);
        }
      }
    return [...out];
  }
  const PLAY: Action[][] = [
    [],
    ['right'],
    ['right', 'attack'],
    ['jump'],
    ['jump', 'attack'],
    ['left'],
    ['down'],
    ['down', 'attack'],
    ['down', 'jump'],
    ['up'],
    ['up', 'attack'],
    ['up', 'right', 'attack'],
    ['down', 'right', 'attack'],
    ['attack'],
    [],
  ];
  for (const def of [
    MEGAMAN_CLASSIC,
    PROTOMAN_CLASSIC,
    BREAKMAN_CLASSIC,
    BASS_CLASSIC,
    RYU_CLASSIC,
    BILL_CLASSIC,
    SOPHIA_CLASSIC,
  ])
    for (const power of ['small', 'big', 'fire'])
      it(`${def.id} (${power}): every pose drawn`, () => expect(missing(def, power, PLAY)).toEqual([]));

  it("Proto Man, Break Man and Bass keep their own sheets and Mega Man's hurt boxes and walk", () => {
    for (const def of [PROTOMAN_CLASSIC, BREAKMAN_CLASSIC, BASS_CLASSIC]) {
      const r = new Rig(def, flatLevel(), 'classic', 'small');
      r.settle();
      expect(['protoman', 'bass']).toContain(def.sprite(r.p, 0, false).sheet);
      expect(def.walkAnim).toEqual(CLASSIC_WALK_ANIM.megaman);
      expect(def.hurtbox?.(r.p)).toEqual({ w: CLASSIC_HURT.w, h: CLASSIC_HURT.megaman.stand });
    }
  });

  it('every animation state (vine, flagpole, pipe, hurt, death) has a drawn frame', () => {
    const anims = [
      'idle',
      'walk',
      'skid',
      'jump',
      'fall',
      'climb',
      'hurt',
      'attack',
      'swim',
      'crouch',
      'pipe',
    ];
    const bad: string[] = [];
    for (const def of [
      MEGAMAN_CLASSIC,
      RYU_CLASSIC,
      BILL_CLASSIC,
      SOPHIA_CLASSIC,
      PROTOMAN_CLASSIC,
      BASS_CLASSIC,
    ]) {
      const r = new Rig(def, flatLevel(), 'classic', 'big');
      r.settle();
      const p = r.p as unknown as { anim: string; dead: boolean; walkFrame: number };
      for (const dead of [false, true])
        for (const a of anims)
          for (let f = 0; f < 32; f++) {
            p.anim = a;
            p.dead = dead;
            p.walkFrame = f;
            const s = def.sprite(r.p, f, false);
            // 'none': Sophia III is gone after her blast.
            if (s.frame !== 'none' && !SPRITES[s.sheet]?.frames[s.frame])
              bad.push(`${def.id} ${a}: ${s.sheet}:${s.frame}`);
          }
    }
    expect([...new Set(bad)]).toEqual([]);
    // On a vine or the flagpole each of them shows a climb pose of his own, two of them in turn.
    for (const def of [MEGAMAN_CLASSIC, RYU_CLASSIC, BILL_CLASSIC]) {
      for (const air of [false, true]) {
        const r = new Rig(def, flatLevel(), 'classic', 'small');
        r.settle();
        const p = r.p as unknown as { anim: string };
        p.anim = 'climb';
        r.p.body.onGround = !air;
        const seen = new Set<string>();
        for (let f = 0; f < 32; f++) seen.add(def.sprite(r.p, f, false).frame);
        expect([...seen].sort(), def.id).toEqual(['climb-0', 'climb-1']);
      }
    }
  });

  it('the select screen and the intro card show the Classic art, cropped to the stand', () => {
    for (const def of [MEGAMAN_CLASSIC, RYU_CLASSIC, BILL_CLASSIC, SOPHIA_CLASSIC]) {
      const art = def.portraitArt;
      expect(art?.sheet).toMatch(/-classic$/);
      const rows = frame(art?.sheet ?? '', art?.frame ?? '');
      const b = drawnBox(rows);
      expect([b.x, b.y, b.w, b.h]).toEqual([0, 0, rows[0]?.length, rows.length]);
      // The intro card draws it at x 96 and the lives count at x 120: a gap of at least 1 px.
      expect(b.w, def.id).toBeLessThanOrEqual(23);
    }
  });

  it("Ryu's run: four distinct poses, 75 ms each (owner decision)", () => {
    expect(WALK_RYU).toEqual([0, 1, 2, 3]);
    expect(CLASSIC_WALK_ANIM.ryu).toEqual({ frames: 4, ticks: 4.5 });
    const poses = WALK_RYU.map((n) => frame('ryu-classic', `walk-${n}`).join('\n'));
    expect(new Set(poses).size).toBe(4);
  });
});

describe('Current sheets unchanged', () => {
  // Hashes of the campaign sheets before R1 (and of Proto Man's and Bass's own sheets).
  const HASHES: Record<string, string> = {
    megaman: 'da10ae9b4ba18d70',
    bass: 'f660c33560e3badf',
    protoman: '585d717e72600199',
    ryu: '578590c7901cd92a',
    bill: '02183bc69f656ddf',
  };
  for (const [sheet, hash] of Object.entries(HASHES))
    it(sheet, () =>
      expect(createHash('sha256').update(JSON.stringify(SPRITES[sheet])).digest('hex').slice(0, 16)).toBe(
        hash,
      ),
    );
  it('sophia (the sheet plus its trimmed portrait)', () => {
    const h = createHash('sha256').update(JSON.stringify(SPRITES.sophia)).digest('hex').slice(0, 16);
    expect(h).toBe('6103166dbb02cc90');
  });
});
