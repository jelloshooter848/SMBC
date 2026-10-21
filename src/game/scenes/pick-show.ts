/**
 * Classic mode's pick performances (G-055; CharacterSelect.as 55, 189-200 and each hero's
 * chooseCharacter): a picked hero acts out the original's own move, and the select waits its
 * CHAR_SEL_END_DUR before the game goes on. The original's select is a level (9-1a) with the hero
 * standing on its ground; a pick closes the select and name boxes (CharacterSelectBox: cancel,
 * nameBox.cancel) and the hero plays its move there with the props its chooseCharacter adds
 * (RC-007: the whole hero, never clipped by a cell). A fresh OK or BACK press skips the wait
 * (every scene is skippable). Reduce flashing holds the flashing ones steady.
 *
 * The moves (the original's chooseCharacter and CHOOSE_CHAR_SEQ, timings in ms):
 * - Mario (Mario.as 110-121): a full jump into an invisible block 4 tiles over his feet, which
 *   shows as a used block once hit.
 * - Luigi (Luigi.as 49-51, 101-123): walks right (1), runs (+67: pressAtkBtn is RUN), jumps
 *   (+120) over a column of 5 bricks built on the ground 3 tiles to his right, holding right and
 *   jump: his high jump (JUMP_HEIGHT_NORMAL 128) clears it and he lands on top.
 * - Link (Link.as 1461-1469): raises his arms.
 * - Samus (Samus.as 1296-1320): the 2 x 2 ground under her goes and she sinks through the hole on
 *   a falling platform.
 * - Simon (Simon.as 187-190, 1052-1077): two breakable bricks 2 tiles to his right, a pork chop
 *   behind them; he whips (1), crouches (+500), crouch-whips (+100), stands (+500) and walks right
 *   (+100) for 500 ms onto the pork chop.
 * - Mega Man (MegaMan.as 154-161): teleports away, with the teleport sound. Proto Man and Break
 *   Man are Mega Man skins in the original (MegaManBase PROTO_MAN_SKIN; ProtoMan.as is unused), so
 *   they teleport too; only Proto Man's choose music is his whistle.
 * - Bass (Bass.as 93-95): holds right and jumps twice (a jump, then his double jump).
 * - Bill (Bill.as 1084-1092): electrocuted with a star-power colour flash and the shock sound.
 * - Ryu (Ryu.as 162-164, 1375-1400): a wall from the top of the screen to the ground 3 tiles to
 *   his right; he walks right (1), jumps (+100) and holds up (+1): he grabs the wall and climbs
 *   it at 120 px/s (Ryu.as 554-563, ST_CLIMB, towards topClimbPos) for the rest of the wait.
 * - Sophia (Sophia.as 3381-3393): the hatch opens and Jason jumps out.
 */
export type PickMove =
  | 'stand'
  | 'hop'
  | 'block'
  | 'column'
  | 'raise'
  | 'sink'
  | 'whip'
  | 'teleport'
  | 'dashjump'
  | 'shock'
  | 'cling'
  | 'jason';

/** Each hero's move and wait (CHAR_SEL_END_DUR, ms), by look id, then by select-slot hero id. */
export const PICK_SHOWS: Readonly<Record<string, { move: PickMove; ms: number }>> = {
  mario: { move: 'block', ms: 1700 },
  luigi: { move: 'column', ms: 2000 },
  link: { move: 'raise', ms: 1700 },
  samus: { move: 'sink', ms: 2000 },
  simon: { move: 'whip', ms: 2000 },
  megaman: { move: 'teleport', ms: 1700 },
  bass: { move: 'dashjump', ms: 1700 },
  bill: { move: 'shock', ms: 1950 },
  ryu: { move: 'cling', ms: 1900 },
  sophia: { move: 'jason', ms: 2000 },
};

/**
 * Looks with a move of their own, by look id. None in the original: every look takes its hero's
 * chooseCharacter (Proto Man and Break Man teleport as Mega Man does).
 */
export const LOOK_SHOWS: Readonly<Record<string, { move: PickMove; ms: number }>> = {};

/** Any other hero (the Expansion heroes, a stand-in): a hop, 1700 ms (the original's most common). */
export const DEFAULT_PICK_SHOW = { move: 'hop', ms: 1700 } as const satisfies { move: PickMove; ms: number };

/** Frames a fresh press is ignored for at the start, so the pick's own press never skips it. */
export const PICK_SHOW_GUARD = 8;

/** The show for slot hero `slotId` in look `lookId` (a look's own, else its slot's). */
export function pickShowOf(slotId: string, lookId = slotId): { move: PickMove; ms: number } {
  return LOOK_SHOWS[lookId] ?? PICK_SHOWS[slotId] ?? DEFAULT_PICK_SHOW;
}

/** The wait in 60 fps frames. */
export function pickShowFrames(slotId: string, lookId = slotId): number {
  return Math.round((pickShowOf(slotId, lookId).ms * 60) / 1000);
}

/** ms of the original's timers as 60 fps frames. */
const f = (ms: number) => Math.round((ms * 60) / 1000);

/** Where the hero stands (its body's centre; CharacterSelect.PLAYER_X_POS) and the ground's top. */
export const STAND_X = 128;
export const GROUND_Y = 208;
const TILE = 16;

/** Gravity of the shows' jumps, px a frame squared. */
const G = 0.25;
/** A jump that would rise `h` px: its height after `t` frames (rising, then falling to 0). */
function arc(t: number, h: number): number {
  const v = Math.sqrt(2 * G * h);
  return Math.max(0, v * t - (G * t * t) / 2);
}

/**
 * A frame of the hero's own sheet (resolved against its sheet by the select: `jump` is
 * `small-jump` for small Mario, `whip` the leather whip's lash, `walk-1` a walk pose).
 */
export type PickFrame =
  | 'jump'
  | `walk-${number}`
  | 'crouch'
  | 'whip-0'
  | 'whip-1'
  | 'whip'
  | 'crouch-whip-0'
  | 'crouch-whip-1'
  | 'crouch-whip'
  | 'cling'
  | `climb-${number}`
  | 'teleport'
  | 'open'
  | 'raise';

/** What the stage holds this frame besides the hero, in screen px. */
export type ShowProp =
  /** A tile of the level's sheet: a brick, a used block, a wall block. */
  | { kind: 'tile'; frame: 'brick' | 'used' | 'hard'; x: number; y: number }
  /** A broken brick's piece in flight. */
  | { kind: 'piece'; x: number; y: number }
  /** Simon's pork chop. */
  | { kind: 'meat'; x: number; y: number }
  /** Samus's platform, a row of planks. */
  | { kind: 'plank'; x: number; y: number }
  /** Ground taken away: the sky shows there. */
  | { kind: 'hole'; x: number; y: number; w: number; h: number }
  /** Jason, his feet at (x, y). */
  | { kind: 'jason'; x: number; y: number; air: boolean };

export interface ShowFrame {
  /** The hero's art moved by (dx, dy) px from where it stands. */
  dx: number;
  dy: number;
  shown: boolean;
  frame?: PickFrame;
  /** Bill's star-power colour step (none with Reduce flashing). */
  flash?: number;
  /** Only what is above this screen y shows of the hero (Samus in her hole). */
  clipY?: number;
  /** Drawn before the hero (behind it), and after it. */
  behind: ShowProp[];
  front: ShowProp[];
  /** A sound that starts on this frame. */
  sfx?: string;
}

/** -round(v), never -0. */
const up0 = (v: number): number => (Math.round(v) ? -Math.round(v) : 0);

const still = (o: Partial<ShowFrame> = {}): ShowFrame => ({
  dx: 0,
  dy: 0,
  shown: true,
  behind: [],
  front: [],
  ...o,
});

/** A broken brick's four pieces `t` frames after it broke at (x, y), until they fall off screen. */
function pieces(x: number, y: number, t: number): ShowProp[] {
  if (t < 0 || t > 50) return [];
  const out: ShowProp[] = [];
  for (const [vx, vy, ox, oy] of [
    [-1, -4, 0, 0],
    [1, -4, 8, 0],
    [-1, -2.5, 0, 8],
    [1, -2.5, 8, 8],
  ] as const)
    out.push({
      kind: 'piece',
      x: Math.round(x + ox + vx * t),
      y: Math.round(y + oy + vy * t + (G * t * t) / 2),
    });
  return out.filter((p) => p.y < 240);
}

/** Mario's block (Mario.as 116-118): its top 4 tiles over his feet, centred on him. */
export const MARIO_BLOCK = { x: STAND_X - 8, y: GROUND_Y - 4 * TILE } as const;
/** Mario's full jump (px) and the frame his head reaches the block (16 px tall: 3 tiles up). */
const MARIO_JUMP = 64;
const MARIO_HIT = (() => {
  // His head (16 px over his feet) meets the block's bottom.
  const need = GROUND_Y - 16 - (MARIO_BLOCK.y + TILE);
  for (let t = 1; t < 60; t++) if (arc(t, MARIO_JUMP) >= need) return t;
  return 20;
})();

/** Luigi's column (Luigi.as 106-118): 5 bricks on the ground at the grid 3 tiles to his right. */
export const LUIGI_COLUMN_X = Math.floor((STAND_X + 3 * TILE) / TILE) * TILE;
/** Simon's bricks (Simon.as 1059-1066): at the grid 2 tiles to his right, the 2 tiles over the ground. */
export const SIMON_BRICK_X = Math.floor((STAND_X + 2 * TILE) / TILE) * TILE;
/** Ryu's wall (Ryu.as 1382-1394): from the top of the screen to the ground, 3 tiles to his right. */
export const RYU_WALL_X = Math.floor((STAND_X + 3 * TILE) / TILE) * TILE;
/** Samus's hole (Samus.as 1300-1303): the 2 x 2 ground tiles under her. */
export const SAMUS_HOLE = { x: STAND_X - TILE, y: GROUND_Y, w: 2 * TILE, h: 2 * TILE } as const;

/**
 * Luigi at frame `t` of his show: his feet (x centre, y), on the ground or the column's top. He
 * walks right, runs from `runAt` and jumps at `jumpAt` with jump held (a 96 px jump), stopped by
 * the column's side below its top and landing on it from above.
 */
function luigiAt(t: number, runAt: number, jumpAt: number): { x: number; y: number; ground: boolean } {
  const left = LUIGI_COLUMN_X;
  const right = LUIGI_COLUMN_X + TILE;
  const top = GROUND_Y - 5 * TILE;
  let x = STAND_X;
  let y = GROUND_Y;
  let vx = 0;
  let vy = 0;
  let ground = true;
  const over = (cx: number) => cx + 6 > left && cx - 6 < right;
  for (let k = 1; k <= t; k++) {
    vx = Math.min(k >= runAt ? 1.5 : 1.25, vx + 0.08);
    if (k === jumpAt && ground) {
      vy = -Math.sqrt(2 * G * 96);
      ground = false;
    }
    let nx = x + vx;
    // The column's side, below its top.
    if (y > top && !over(x) && over(nx)) {
      nx = left - 6;
      vx = 0;
    }
    x = nx;
    if (ground) {
      // Walked off the column's top.
      if (y === top && !over(x)) ground = false;
    }
    if (!ground) {
      vy += G;
      const ny = y + vy;
      if (vy > 0 && over(x) && y <= top && ny >= top) {
        y = top;
        vy = 0;
        ground = true;
      } else if (ny >= GROUND_Y) {
        y = GROUND_Y;
        vy = 0;
        ground = true;
      } else y = ny;
    }
  }
  return { x, y, ground };
}

/** A walk pose every 6 frames. */
const walk = (t: number): PickFrame => `walk-${Math.floor(t / 6) % 3}`;

/** The stage at frame `t` of move `m`. */
export function pickShow(m: PickMove, t: number, reduceFlashing: boolean): ShowFrame {
  switch (m) {
    case 'stand':
      return still();
    case 'hop': {
      const up = arc(t, 8);
      return still({ dy: up0(up), ...(t > 0 && up > 0 ? { frame: 'jump' as const } : {}) });
    }
    case 'block': {
      // Up until his head meets the block, then down again; the block shows, used, once hit.
      const rise =
        t <= MARIO_HIT
          ? arc(t, MARIO_JUMP)
          : Math.max(0, arc(MARIO_HIT, MARIO_JUMP) - (G * (t - MARIO_HIT) ** 2) / 2);
      const hit = t >= MARIO_HIT;
      const bump = hit && t < MARIO_HIT + 6 ? -[2, 4, 4, 3, 2, 1][t - MARIO_HIT]! : 0;
      return still({
        dy: up0(rise),
        ...(rise > 0 ? { frame: 'jump' as const } : {}),
        front: hit ? [{ kind: 'tile', frame: 'used', x: MARIO_BLOCK.x, y: MARIO_BLOCK.y + bump }] : [],
        ...(t === MARIO_HIT ? { sfx: 'bump' } : {}),
      });
    }
    case 'column': {
      // Right (1), RUN (+67), jump (+120), all held: up and over the column, on to its top.
      const runAt = f(1 + 67);
      const jumpAt = runAt + f(120);
      const p = luigiAt(t, runAt, jumpAt);
      const column: ShowProp[] = [];
      for (let k = 1; k <= 5; k++)
        column.push({ kind: 'tile', frame: 'brick', x: LUIGI_COLUMN_X, y: GROUND_Y - k * TILE });
      return still({
        dx: Math.round(p.x - STAND_X),
        dy: Math.round(p.y - GROUND_Y),
        shown: p.x < 256 + 8,
        frame: p.ground ? walk(t) : 'jump',
        front: column,
        ...(t === jumpAt ? { sfx: 'jump-small' } : {}),
      });
    }
    case 'raise':
      return still(t >= 6 ? { frame: 'raise' } : {});
    case 'sink': {
      // The ground under her goes; she sinks on the platform through the hole and out of sight.
      const down = Math.max(0, t - 6);
      return still({
        dy: down,
        clipY: 240,
        behind: [{ kind: 'hole', ...SAMUS_HOLE }],
        front: [0, 8, 16, 24].map((ox) => ({
          kind: 'plank' as const,
          x: SAMUS_HOLE.x + ox,
          y: GROUND_Y + down,
        })),
      });
    }
    case 'whip': {
      const crouchAt = f(1 + 500);
      const lowWhipAt = crouchAt + f(100);
      const standAt = lowWhipAt + f(500);
      const walkAt = standAt + f(100);
      const walkEnd = walkAt + f(500);
      const hit1 = 12;
      const hit2 = lowWhipAt + 12;
      const whipFrame = (k: number, low: boolean): PickFrame | undefined => {
        const pre = low ? 'crouch-' : '';
        if (k < 0 || k >= 26) return low ? 'crouch' : undefined;
        return `${pre}${k < 7 ? 'whip-0' : k < 12 ? 'whip-1' : 'whip'}` as PickFrame;
      };
      let frame: PickFrame | undefined;
      let dx = 0;
      if (t < crouchAt) frame = whipFrame(t, false);
      else if (t < lowWhipAt) frame = 'crouch';
      else if (t < standAt) frame = whipFrame(t - lowWhipAt, true);
      else if (t >= walkAt) {
        const k = Math.min(t, walkEnd) - walkAt;
        dx = Math.round(k * 1.25);
        if (t < walkEnd) frame = walk(k);
      }
      // The pork chop waits behind the bricks until Simon walks onto it (his right side reaches it).
      const meatX = SIMON_BRICK_X;
      const eaten = STAND_X + 8 + dx >= meatX + 4;
      const eatAt = (() => {
        for (let k = walkAt; k <= walkEnd; k++)
          if (STAND_X + 8 + Math.round((k - walkAt) * 1.25) >= meatX + 4) return k;
        return -1;
      })();
      const behind: ShowProp[] = eaten ? [] : [{ kind: 'meat', x: meatX, y: GROUND_Y - TILE }];
      const front: ShowProp[] = [];
      if (t < hit1) front.push({ kind: 'tile', frame: 'brick', x: SIMON_BRICK_X, y: GROUND_Y - 2 * TILE });
      if (t < hit2) front.push({ kind: 'tile', frame: 'brick', x: SIMON_BRICK_X, y: GROUND_Y - TILE });
      front.push(
        ...pieces(SIMON_BRICK_X, GROUND_Y - 2 * TILE, t - hit1),
        ...pieces(SIMON_BRICK_X, GROUND_Y - TILE, t - hit2),
      );
      const sfx =
        t === 1 || t === lowWhipAt
          ? 'whip'
          : t === hit1 || t === hit2
            ? 'break'
            : t === eatAt
              ? 'cv-weapon'
              : undefined;
      return still({ dx, ...(frame ? { frame } : {}), behind, front, ...(sfx ? { sfx } : {}) });
    }
    case 'teleport': {
      // He stands a moment, then beams straight up and away.
      const up = Math.max(0, t - 30) * 4;
      return still({
        dy: up ? -up : 0,
        shown: GROUND_Y - up > -40,
        ...(up > 0 ? { frame: 'teleport' as const } : {}),
      });
    }
    case 'dashjump': {
      // Bass.as 93-95: right (1), down (+0), jump (+47) released (+136), jump again in the air
      // (+220, his double jump), down released (+83), jump released (+334).
      const jump1 = f(1 + 47);
      const rel1 = jump1 + f(136);
      const jump2 = rel1 + f(220);
      const rel2 = jump2 + f(83 + 334);
      let x = STAND_X;
      let y = GROUND_Y;
      let vy = 0;
      for (let k = 1; k <= t; k++) {
        x += 1.3;
        if (k === jump1 || k === jump2) vy = -Math.sqrt(2 * G * 40);
        if ((k === rel1 || k === rel2) && vy < 0) vy = Math.max(vy, -1);
        if (y < GROUND_Y || vy < 0) {
          vy += G;
          y += vy;
          if (y >= GROUND_Y) {
            y = GROUND_Y;
            vy = 0;
          }
        }
      }
      return still({
        dx: Math.round(x - STAND_X),
        dy: Math.round(y - GROUND_Y),
        shown: x < 256 + 16,
        frame: y < GROUND_Y ? 'jump' : walk(t),
        ...(t === jump1 || t === jump2 ? { sfx: 'jump-small' } : {}),
      });
    }
    case 'shock':
      // Electrocuted: he shakes in place, flashing star-power colours (held steady with Reduce
      // flashing). The shock sound is the choose sound (Game.playChooseJingle, CHOOSE_SFX).
      return still({
        dx: reduceFlashing ? 0 : (t >> 1) & 1 ? 1 : -1,
        ...(reduceFlashing ? {} : { flash: (t >> 1) & 3 }),
      });
    case 'cling': {
      // Right (1), jump (+100): on to the wall's side, where he clings (Ryu.as WALK_SPEED 185).
      const jumpAt = f(1 + 100);
      const speed = 185 / 2 / 60;
      const stop = RYU_WALL_X - 8 - STAND_X;
      const clingAt = Math.max(jumpAt, Math.ceil(stop / speed));
      const x = Math.min(t * speed, stop);
      const grab = t < jumpAt ? 0 : arc(Math.min(t, clingAt) - jumpAt, 40);
      // Up held: he climbs the wall at 120 px/s (1 px a frame here).
      const air = grab + Math.max(0, t - clingAt);
      const wall: ShowProp[] = [];
      for (let y = GROUND_Y - TILE; y > -TILE; y -= TILE)
        wall.push({ kind: 'tile', frame: 'hard', x: RYU_WALL_X, y });
      return still({
        dx: Math.round(x),
        dy: up0(air),
        frame: t >= clingAt ? (`climb-${(t >> 3) & 1}` as PickFrame) : t >= jumpAt ? 'jump' : walk(t),
        shown: GROUND_Y - air > -8,
        front: wall,
      });
    }
    case 'jason': {
      // The hatch opens, and Jason jumps out of it and lands beside the tank.
      const out = t - 10;
      const tankTop = GROUND_Y - 32;
      if (out < 0) return still(t >= 4 ? { frame: 'open' } : {});
      const d = 30;
      const k = Math.min(1, out / d);
      const feet =
        out < d ? tankTop + 8 - arc(out, 16) + Math.round((GROUND_Y - tankTop - 8) * k * k) : GROUND_Y;
      return still({
        frame: 'open',
        front: [
          {
            kind: 'jason',
            x: STAND_X + Math.round(26 * k),
            y: Math.min(GROUND_Y, Math.round(feet)),
            air: out < d,
          },
        ],
      });
    }
  }
}
