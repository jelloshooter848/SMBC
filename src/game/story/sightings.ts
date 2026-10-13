import type { World } from '@game/world/world';
import { spinFrame, TRICK_SPIN_FRAMES } from '@game/entities/objects/trick-wall';
import { BOOM_FRAMES, CONTRA_SHEET } from '@game/entities/objects/bridge-blast';
import { beat, storyOn, type StoryGame } from './beats';

/*
 * The hero sightings (0.4.51, docs/STORY.md "Sighting" under each world): the first time a
 * world's first level starts on a campaign file, its brainwashed hero is glimpsed on the start
 * screen, doing something that points at where they hide, then player 1's hero says one card.
 * Luigi's run in 1-1 (luigi-runs.ts) came first; the others share one scene (hero-sighting.ts),
 * each driven by a script here: what is drawn at each frame, its sounds and an optional camera pan.
 *
 * Built so far: Link (2-1, a vine grows by magic and he climbs it into the sky), Mega Man (3-1,
 * he flickers, then beams up), since 0.4.52 Samus (4-2, shown as 4-1: she bombs her way on
 * into the caves) and Simon (5-1: he walks through the crypt gate, and it slams shut), and since
 * 0.4.53 Ryu (6-2, shown as 6-1: a castle wall panel spins him through) and Bill (7-3, shown as
 * 7-1: hand over hand under the first bridge, then a far boom), and since 0.4.54 Sophia III (8-1:
 * she drives into the hatch by the start, Fred dives after her, and it slams shut).
 */

/** Something the scene draws at a frame. Positions are level px (x) and screen px (y). */
export type SightingDraw =
  | {
      kind: 'sprite';
      /** Sprite sheet id and the palette it is drawn in (the brainwashed fx goes over it). */
      sheet: string;
      palette: string;
      frame: string;
      /** Left edge (level px) and the bottom of the frame (screen px). */
      x: number;
      feet: number;
      flip?: boolean;
      /** The captive's look: the brainwashed palette (as Luigi in 1-1). */
      fx?: boolean;
      /** Three wand sparkles drift off it (the hero; not a beam streak). */
      sparkles?: boolean;
      /**
       * (0.4.54) Nothing of it below this screen y is drawn (sinking into 8-1's hatch shaft: the
       * ground under the shaft stays drawn over it).
       */
      clipBelow?: number;
    }
  /** A beanstalk as the vine entity draws it: `x` its left edge, from `base` (its foot) up to `top`. */
  | { kind: 'vine'; x: number; base: number; top: number }
  /** A puff of wand sparkles flung out from (x, y), `age` frames old (gone at BURST_LIFE). */
  | { kind: 'burst'; x: number; y: number; age: number }
  /**
   * (0.4.52) A locked gate (objects/keys.ts drawGate) drawn over the level's own: `x` its left edge
   * (level px), `top` its doorway's top (screen px), its portcullis raised `lift` px (0 shut), its
   * padlock swung `swing` px aside.
   */
  | { kind: 'gate'; x: number; top: number; lift: number; swing: number }
  /** (0.4.52) A little dust puff either side of (x, y), `age` frames old (gone at DUST_LIFE). */
  | { kind: 'dust'; x: number; y: number; age: number }
  /**
   * (0.4.54) 8-1's steel hatch (objects/keys.ts drawHatch) over the level's own: `x` its left edge
   * (level px), `top` the ground's top (screen px), open or shut.
   */
  | { kind: 'hatch'; x: number; top: number; open: boolean };

export interface SightingScript {
  /** The hero's CharacterDef id (the beat is `sighting:<hero>`). */
  hero: string;
  /** The main area it plays in (internal id: never an intro, bonus room or sub-area). */
  level: string;
  /** Frames the action lasts; the card follows (at once on a skip). */
  frames: number;
  /** What is drawn at frame `t` (1 on the first frame), back to front. Scene-only: nothing stays. */
  draw(t: number, reduceFlashing: boolean): SightingDraw[];
  /** Sound effects by the frame they play on. */
  sfx?: Readonly<Record<number, string>>;
  /**
   * The camera eases `dx` px (right is positive) from frame `at`, `speed` px a frame, and back
   * from frame `back` at `backSpeed`. The scene saves the camera first and puts it back exactly
   * before the card, or at once on a skip; the world stays frozen meanwhile, so nothing wakes.
   */
  pan?: { dx: number; at: number; back: number; speed: number; backSpeed: number };
}

/** Frames a sparkle burst lasts. */
export const BURST_LIFE = 30;

/** Frames a dust puff lasts. */
export const DUST_LIFE = 12;

/** The ground's top on a start screen (row 13), where the heroes' feet are. */
export const GROUND = 208;

/** `from` at frame `t0`, `to` at `t1`, in a straight line between (held outside). */
export function tween(t: number, t0: number, t1: number, from: number, to: number): number {
  if (t <= t0) return from;
  if (t >= t1) return to;
  return from + ((to - from) * (t - t0)) / (t1 - t0);
}

const hero = (
  sheet: string,
  frame: string,
  x: number,
  feet: number,
  flip = false,
): SightingDraw & { kind: 'sprite' } => ({
  kind: 'sprite',
  sheet,
  palette: sheet,
  frame,
  x: Math.round(x),
  feet: Math.round(feet),
  flip,
  fx: true,
  sparkles: true,
});

/* ---------------------------------------------------------------- Link, 2-1 */

/**
 * Link (2-1, the Hyrule field; he hides above the clouds, up the vine to 2-1-sky2). No brick and
 * no block: a vine grows out of the ground by magic, he climbs it, and it crawls up after him, so
 * nothing is left and the real vine is still to be found.
 */
export const LINK_SIGHTING_TIMING = {
  /**
   * Where he stands (level px, his left edge) and where the vine grows (its left edge): on the
   * open grass between the start castle (to x 112) and the field's small tree (col 11, x 176), so
   * the vine never grows over a tree and blends into its green.
   */
  x: 124,
  vineX: 148,
  /** He looks back at you over his shoulder, then faces away again. */
  lookAt: 24,
  lookEnd: 36,
  /** Sparkles burst from the grass and the vine grows, `grow` px a frame. */
  growAt: 40,
  grow: 3,
  /** He steps over to it, then climbs, `climb` px a frame. */
  stepAt: 60,
  climbAt: 70,
  climb: 1.5,
  /** The vine crawls up after him, `slide` px a frame, until its foot is off the top. */
  slideAt: 130,
  slide: 4,
  /** Frames after the vine is gone before the card. */
  beat: 24,
} as const;
const LT = LINK_SIGHTING_TIMING;

export const LINK_SIGHTING: SightingScript = {
  hero: 'link',
  level: '2-1',
  frames: LT.slideAt + Math.ceil(GROUND / LT.slide) + LT.beat,
  sfx: { [LT.growAt]: 'vine', [LT.slideAt]: 'magic' },
  draw(t) {
    const out: SightingDraw[] = [];
    const slide = t > LT.slideAt ? LT.slide * (t - LT.slideAt) : 0;
    const base = GROUND - slide;
    if (t >= LT.growAt && base > 0) {
      // Grown from the ground up, then past the top of the screen; it slides up whole.
      const top = Math.max(-32, GROUND - LT.grow * (t - LT.growAt));
      out.push({ kind: 'vine', x: LT.vineX, base, top: Math.max(-32, top - slide) });
    }
    if (t >= LT.growAt && t < LT.growAt + BURST_LIFE)
      out.push({ kind: 'burst', x: LT.vineX + 8, y: GROUND - 4, age: t - LT.growAt });
    if (t >= LT.slideAt && t < LT.slideAt + BURST_LIFE)
      out.push({ kind: 'burst', x: LT.vineX + 8, y: GROUND - 2, age: t - LT.slideAt });
    if (t < LT.stepAt) {
      out.push(hero('link', 'idle', LT.x, GROUND, t >= LT.lookAt && t < LT.lookEnd));
    } else if (t < LT.climbAt) {
      const x = tween(t, LT.stepAt, LT.climbAt, LT.x, LT.vineX);
      out.push(hero('link', `walk-${((t - LT.stepAt) >> 2) % 3}`, x, GROUND));
    } else {
      const feet = GROUND - LT.climb * (t - LT.climbAt) - slide;
      if (feet > 0) out.push(hero('link', `climb-${(t >> 3) & 1}`, LT.vineX, feet));
    }
    return out;
  },
};

/* ---------------------------------------------------------------- Mega Man, 3-1 */

/**
 * Mega Man (3-1, the night city; he hides in the space station, up the teleporter in the coin
 * heaven). The rogue program shows (his helmet flickers), then he beams up as a teleport streak.
 */
export const MEGAMAN_SIGHTING_TIMING = {
  x: 140,
  /** He blinks once, back turned. */
  blinkAt: 24,
  blinkEnd: 32,
  /** The helmet flickers off and on every 4 frames (reduce flashing: off once, held). */
  flickerAt: 36,
  /** He faces you and gathers (teleport-0). */
  gatherAt: 60,
  /** The streak rises at the pad's speed (teleporter.ts BEAM_SPEED) off the top. */
  beamAt: 76,
  beamSpeed: 8,
  /** The streak's size (station:beam-*). */
  beamW: 16,
  beamH: 32,
  /** Mega Man's standing frames' width: the streak is centred on him. */
  heroW: 16,
  beat: 24,
} as const;
const MT = MEGAMAN_SIGHTING_TIMING;

export const MEGAMAN_SIGHTING: SightingScript = {
  hero: 'megaman',
  level: '3-1',
  frames: MT.beamAt + Math.ceil(GROUND / MT.beamSpeed) + MT.beat,
  sfx: { [MT.flickerAt]: 'charge', [MT.beamAt]: 'beam' },
  draw(t, reduce) {
    if (t < MT.flickerAt)
      return [hero('megaman', t >= MT.blinkAt && t < MT.blinkEnd ? 'idle-blink' : 'idle', MT.x, GROUND)];
    if (t < MT.gatherAt) {
      const off = reduce || ((t - MT.flickerAt) >> 2) % 2 === 0;
      const jitter = reduce ? 0 : ((t - MT.flickerAt) >> 2) % 2;
      return [hero('megaman', off ? 'bare-idle' : 'idle', MT.x + jitter, GROUND)];
    }
    if (t < MT.beamAt) return [hero('megaman', 'teleport-0', MT.x, GROUND, true)];
    const feet = GROUND - MT.beamSpeed * (t - MT.beamAt);
    if (feet <= 0) return [];
    return [
      {
        kind: 'sprite',
        sheet: 'station',
        palette: 'station',
        frame: !reduce && t % 4 < 2 ? 'beam-1' : 'beam-0',
        x: MT.x + (MT.heroW - MT.beamW) / 2,
        feet,
        fx: true,
      },
    ];
  },
};

/* ---------------------------------------------------------------- Samus, 4-2 (shown as 4-1) */

/**
 * Samus (4-2, Brinstar; she hides in 4-2-cavern, up the vine and down the warp pipe). The level
 * starts with a fall into the cave: the scene waits until every player has landed (sightingDue).
 * On the little ledge between the first two pits she looks back once, curls into the morph ball,
 * lays a bomb, and its burst bounces her over the next pit; she rolls on, deeper in.
 */
export const SAMUS_SIGHTING_TIMING = {
  /** Where she stands (level px, her left edge): the ledge between the first two pits. */
  x: 212,
  /** She looks back at you once, then away again. */
  lookAt: 40,
  lookEnd: 52,
  /** She curls into the ball (ball-0..3, one every `roll` frames) and lays the bomb. */
  curlAt: 52,
  roll: 3,
  bombAt: 56,
  /** The bomb blinks every 4 frames (held on bomb-0 with reduce flashing), then bursts. */
  burstAt: 64,
  burstFrames: 8,
  /** The burst bounces the ball: up `hopVy`, falling `gravity`, on right `vx` px a frame. */
  hopVy: -4,
  gravity: 0.25,
  vx: 2.5,
  /** Frames after she is off the screen before the card. */
  beat: 24,
} as const;
const ST = SAMUS_SIGHTING_TIMING;

/** Where the ball is at frame `t` after the burst (its left edge, its feet). */
function samusBall(t: number): { x: number; feet: number } {
  const k = t - ST.burstAt;
  const x = ST.x + ST.vx * k;
  const rise = ST.hopVy * k + (ST.gravity * k * k) / 2;
  return { x, feet: GROUND + Math.min(0, rise) };
}

/** The first frame the ball is wholly off the right of the screen. */
const SAMUS_GONE = ST.burstAt + Math.ceil((256 - ST.x) / ST.vx);

export const SAMUS_SIGHTING: SightingScript = {
  hero: 'samus',
  level: '4-2',
  frames: SAMUS_GONE + ST.beat,
  sfx: { [ST.bombAt]: 'dink', [ST.burstAt]: 'bump' },
  draw(t, reduce) {
    const out: SightingDraw[] = [];
    if (t < ST.curlAt) {
      out.push(hero('samus', 'idle', ST.x, GROUND, t >= ST.lookAt && t < ST.lookEnd));
      return out;
    }
    const ball = `ball-${Math.floor((t - ST.curlAt) / ST.roll) % 4}`;
    if (t < ST.burstAt) {
      if (t >= ST.bombAt) {
        const lit = reduce || ((t - ST.bombAt) >> 2) % 2 === 0;
        out.push({ ...hero('samus', lit ? 'bomb-0' : 'bomb-1', ST.x + 4, GROUND), sparkles: false });
      }
      out.push(hero('samus', ball, ST.x, GROUND));
      return out;
    }
    if (t < ST.burstAt + ST.burstFrames)
      out.push({ ...hero('samus', 'bomb-burst', ST.x, GROUND + 4), sparkles: false });
    const at = samusBall(t);
    if (at.x < 256) out.push(hero('samus', ball, at.x, at.feet));
    return out;
  },
};

/* ---------------------------------------------------------------- Simon, 5-1 */

/**
 * Simon (5-1, the castle courtyard; he hides in the crypt behind the locked gate by the start,
 * whose real way in is the key in 5-1-bonus). A bat flutters down; he looks back at you over his
 * shoulder, walks to the gate (never runs), the portcullis rises for him (the curse) and he steps
 * into the dark; it drops behind him with a CLANG, the padlock swinging, and the bat flies off.
 * The gate is the level's own (`locked-gate 12 11`): the scene draws it raised and dropping over it.
 */
export const SIMON_SIGHTING_TIMING = {
  /** Where he stands (level px, his left edge), facing the castle. */
  x: 148,
  /** The gate: its left edge (level px, column 12) and its doorway's top (screen px, row 11). */
  gateX: 192,
  gateTop: 176,
  /** The bat flutters down from above the screen to hang over him, then flies off. */
  batX: 168,
  batY: 120,
  batInEnd: 36,
  /** He looks back at you over his shoulder. */
  lookAt: 24,
  lookEnd: 40,
  /** He walks to the gate, `walk` px a frame, swapping walk-0..2 every 8 frames. */
  walkAt: 50,
  walk: 0.75,
  /** The portcullis rises for him, a px a frame, with wand sparkles. */
  raiseAt: 50,
  /** It drops behind him, `drop` px a frame, from `dropAt`; CLANG as it lands. */
  dropAt: 124,
  drop: 4,
  /** The padlock swings (1 px either way) for this many frames once it lands. */
  swingFrames: 24,
  /** The bat flies off up and away from here. */
  batOffAt: 136,
  /** Frames after the bat is gone before the card. */
  beat: 24,
} as const;
const SM = SIMON_SIGHTING_TIMING;

/** The frame the portcullis is shut again (CLANG). */
const SIMON_CLANG = SM.dropAt + Math.ceil(32 / SM.drop);
/** The frame the bat has flown off the screen. */
const SIMON_BAT_GONE = SM.batOffAt + 40;

export const SIMON_SIGHTING: SightingScript = {
  hero: 'simon',
  level: '5-1',
  frames: Math.max(SIMON_BAT_GONE, SIMON_CLANG + SM.swingFrames) + SM.beat,
  sfx: { [SM.raiseAt]: 'magic', [SIMON_CLANG]: 'bump' },
  draw(t) {
    const out: SightingDraw[] = [];
    // The gate: raised for him, then dropping shut behind him (the level's own shows once still).
    const lift =
      t < SM.raiseAt
        ? 0
        : t < SM.dropAt
          ? Math.min(32, t - SM.raiseAt)
          : Math.max(0, 32 - SM.drop * (t - SM.dropAt));
    const swinging = t >= SIMON_CLANG && t < SIMON_CLANG + SM.swingFrames;
    const gate: SightingDraw = {
      kind: 'gate',
      x: SM.gateX,
      top: SM.gateTop,
      lift,
      swing: swinging ? (((t - SIMON_CLANG) >> 2) % 2 === 0 ? 1 : -1) : 0,
    };
    const moving = t >= SM.raiseAt && t < SIMON_CLANG + SM.swingFrames;
    // Simon walks into the dark doorway; the falling bars cover him, and he is gone.
    if (t < SIMON_CLANG) {
      if (moving) out.push(gate);
      if (t < SM.walkAt) out.push(hero('simon', 'idle', SM.x, GROUND, t >= SM.lookAt && t < SM.lookEnd));
      else {
        const x = Math.min(SM.gateX, SM.x + SM.walk * (t - SM.walkAt));
        const walking = x < SM.gateX;
        out.push(hero('simon', walking ? `walk-${((t - SM.walkAt) >> 3) % 3}` : 'idle', x, GROUND));
      }
      if (t >= SM.dropAt) out.push({ ...gate });
    } else if (moving) out.push(gate);
    if (t >= SM.raiseAt && t < SM.raiseAt + BURST_LIFE)
      out.push({ kind: 'burst', x: SM.gateX + 8, y: SM.gateTop + 8, age: t - SM.raiseAt });
    if (t >= SIMON_CLANG && t < SIMON_CLANG + DUST_LIFE)
      out.push({ kind: 'dust', x: SM.gateX + 8, y: GROUND - 1, age: t - SIMON_CLANG });
    // The bat (its own colours): down from above the screen, flapping, then up and away.
    if (t < SIMON_BAT_GONE) {
      const flap = `bat-${1 + ((t >> 3) & 1)}`;
      const y =
        t < SM.batInEnd
          ? tween(t, 0, SM.batInEnd, -16, SM.batY)
          : t < SM.batOffAt
            ? SM.batY
            : SM.batY - 4 * (t - SM.batOffAt);
      const x = t < SM.batOffAt ? SM.batX + ((t >> 4) % 2) : SM.batX + 2 * (t - SM.batOffAt);
      if (y > -16)
        out.push({ kind: 'sprite', sheet: 'crypt', palette: 'crypt', frame: flap, x, feet: y + 16 });
    }
    return out;
  },
};

/* ---------------------------------------------------------------- Ryu, 6-2 (shown 6-1) */

/**
 * Ryu (6-2, shown 6-1: the city street at night; he hides in the dojo, through the trick wall in
 * the first pipe's room). He drops in spinning, lands facing you, dashes to the start castle's wall
 * and presses into it, and a panel there spins him through: the trick wall's own half turn
 * (trick-wall.ts spinFrame), in the castle's brick (palette `ninja-castle-city`), then back. The
 * panel is drawn only while it turns; at rest the castle's own wall shows, so nothing in the level
 * changes and there is no live panel (and no shuriken mark) to mislead.
 */
export const RYU_SIGHTING_TIMING = {
  /** Where he lands (level px, his left edge): between the hero and Irene. */
  x: 88,
  /** The castle's right-hand wall at ground level: the panel's left edge and its two tiles' feet. */
  wallX: 64,
  wallFeet: [GROUND - 16, GROUND] as const,
  /** He drops from above the screen, spinning (spin-0..3, every `spinEvery` frames), and lands. */
  landAt: 30,
  spinEvery: 4,
  /** He rises from the crouch, facing you, then dashes left to the wall, `dash` px a frame. */
  standAt: 42,
  dashAt: 52,
  dash: 3,
  /** Pressing into the wall, his feet working (walk-0..2, every `pressEvery` frames). */
  pressEvery: 8,
  /** The panel's half turn: he goes in with it and is gone once it is edge-on. */
  turnAt: 90,
  /** It turns back to the brick, then is the castle's wall again. */
  turnBackAt: 90 + TRICK_SPIN_FRAMES,
  restAt: 90 + 2 * TRICK_SPIN_FRAMES,
  /** Px he slides into the panel as it opens. */
  slideIn: 8,
  /** Frames from the wall at rest to the card: a held moment, then the beat. */
  after: 12,
  beat: 24,
} as const;
const RT = RYU_SIGHTING_TIMING;

/** The panel's frame at frame `t` of the sighting, or null at rest (the castle's own wall shows). */
export function ryuPanelFrame(t: number): string | null {
  if (t < RT.turnAt || t >= RT.restAt) return null;
  return t < RT.turnBackAt
    ? spinFrame(t - RT.turnAt + 1, 'out', false)
    : spinFrame(t - RT.turnBackAt + 1, 'in', false);
}

/** The half turn's frames from edge-on to the far face: the moment he is through and gone. */
const THROUGH = new Set(['trick-wall-2', 'trick-wall-3', 'trick-wall-back']);

export const RYU_SIGHTING: SightingScript = {
  hero: 'ryu',
  level: '6-2',
  frames: RT.restAt + RT.after + RT.beat,
  sfx: { [RT.turnAt]: 'panel-spin', [RT.turnBackAt]: 'panel-spin' },
  draw(t) {
    const out: SightingDraw[] = [];
    const wallFace = RT.wallX + 16;
    const panel = ryuPanelFrame(t);
    if (t < RT.landAt) {
      // Falling from above the top of the screen, speeding up, turning over and over.
      const k = t / RT.landAt;
      out.push(hero('ryu', `spin-${Math.floor(t / RT.spinEvery) % 4}`, RT.x, GROUND * k * k, true));
    } else if (t < RT.standAt) {
      out.push(hero('ryu', 'crouch', RT.x, GROUND, true));
    } else if (t < RT.dashAt) {
      out.push(hero('ryu', 'idle', RT.x, GROUND, true));
    } else if (t < RT.turnAt) {
      const x = Math.max(wallFace, RT.x - RT.dash * (t - RT.dashAt));
      const walk = x > wallFace ? (t - RT.dashAt) % 3 : Math.floor(t / RT.pressEvery) % 3;
      out.push(hero('ryu', `walk-${walk}`, x, GROUND, true));
    } else if (t < RT.turnBackAt && !THROUGH.has(panel ?? '')) {
      // In with the panel as it opens; gone once it is edge-on (the trick wall's own moment).
      const x = tween(t, RT.turnAt, RT.turnAt + TRICK_SPIN_FRAMES / 2, wallFace, wallFace - RT.slideIn);
      out.push(hero('ryu', `walk-${Math.floor(t / RT.pressEvery) % 3}`, x, GROUND, true));
    }
    // The panel over him (he goes in behind its turning face), in the castle's brick.
    if (panel)
      for (const feet of RT.wallFeet)
        out.push({
          kind: 'sprite',
          sheet: 'ninja',
          palette: 'ninja-castle-city',
          frame: panel,
          x: RT.wallX,
          feet,
        });
    return out;
  },
};

/* ---------------------------------------------------------------- Bill, 7-3 (shown 7-1) */

/**
 * Bill (7-3, shown 7-1: the jungle bridges; he hides in the camp, down through the exploding
 * bridge). He lies prone on the stone blocks, springs up and looks back at you (and Lance), then
 * rolls off the edge and catches the underside of the first bridge (column 15): hand over hand
 * (hang-0/hang-1) while the camera eases right, and out of view. Off screen he lets go: a falling
 * whistle and a thud (never shown: the pit under this bridge is deadly, and the scene must not
 * teach that jump), then far ahead a boom: the blast bridge, the camp's way in. The camera comes back.
 */
export const BILL_SIGHTING_TIMING = {
  /** Prone on top of the stone blocks (level px, his left edge; feet on the blocks' top, row 10). */
  x: 200,
  stoneTop: 160,
  /** He springs up and looks back at you. */
  standAt: 24,
  /** He somersaults off the edge (spin-0..3 every `spinEvery` frames), up `hop` px and down. */
  rollAt: 40,
  spinEvery: 3,
  hop: 10,
  /**
   * He catches the underside of the first bridge's girder (column 15, row 10): his hands (the hang
   * frames' top rows) over its bottom chord, the tile's rows 13-14.
   */
  catchAt: 56,
  hangX: 240,
  hangTop: 160 + 13,
  /** Hand over hand: `hang` px a frame, hang-0 and hang-1 swapped every `swapEvery` frames. */
  hang: 2,
  swapEvery: 10,
  /** The camera eases `pan` px right with him (2 px a frame), and back faster (8). */
  panAt: 40,
  pan: 96,
  /** Off screen: the whistle as he drops, the thud, then the far boom at the screen's right edge. */
  whistleAt: 128,
  thudAt: 156,
  boomAt: 164,
  /** The boom (contra:boom-0..3, BOOM_FRAMES long, as a blast bridge's) and where it is drawn. */
  boomFrames: BOOM_FRAMES,
  boomX: 96 + 256 - 28,
  boomFeet: 136,
  backAt: 184,
  /** Frames for the camera to come back (96 px at 8), then the beat. */
  backFrames: 12,
  beat: 24,
} as const;
const BT = BILL_SIGHTING_TIMING;

/** The first frame Bill is out of view (his left edge past the panned screen's right edge). */
export const BILL_GONE_AT = BT.catchAt + Math.ceil((BT.pan + 256 - BT.hangX) / BT.hang);

export const BILL_SIGHTING: SightingScript = {
  hero: 'bill',
  level: '7-3',
  frames: BT.backAt + BT.backFrames + BT.beat,
  sfx: {
    [BT.rollAt]: 'jump-small',
    [BT.whistleAt]: 'fall-whistle',
    [BT.thudAt]: 'bump',
    [BT.boomAt]: 'bridge-boom',
  },
  pan: { dx: BT.pan, at: BT.panAt, back: BT.backAt, speed: 2, backSpeed: 8 },
  draw(t) {
    const out: SightingDraw[] = [];
    if (t < BT.standAt) out.push(hero('bill', 'prone', BT.x, BT.stoneTop));
    else if (t < BT.rollAt) out.push(hero('bill', 'idle', BT.x, BT.stoneTop, true));
    else if (t < BT.catchAt) {
      // A somersault off the edge: up a little, then down under the girder's end.
      const k = (t - BT.rollAt) / (BT.catchAt - BT.rollAt);
      const x = tween(t, BT.rollAt, BT.catchAt, BT.x, BT.hangX);
      const feet = BT.stoneTop + (BT.hangTop + 16 - BT.stoneTop) * k - 4 * BT.hop * k * (1 - k);
      out.push(hero('bill', `spin-${Math.floor((t - BT.rollAt) / BT.spinEvery) % 4}`, x, feet));
    } else if (t < BILL_GONE_AT) {
      const x = BT.hangX + BT.hang * (t - BT.catchAt);
      out.push(hero('bill', `hang-${Math.floor((t - BT.catchAt) / BT.swapEvery) % 2}`, x, BT.hangTop + 32));
    }
    if (t >= BT.boomAt && t < BT.boomAt + BT.boomFrames) {
      const n = Math.min(3, Math.floor(((t - BT.boomAt) * 4) / BT.boomFrames));
      out.push({
        kind: 'sprite',
        sheet: CONTRA_SHEET,
        palette: CONTRA_SHEET,
        frame: `boom-${n}`,
        x: BT.boomX,
        feet: BT.boomFeet,
      });
    }
    return out;
  },
};

/* ---------------------------------------------------------------- Sophia III, 8-1 */

/**
 * Sophia III (8-1, the Underworld's forest; she hides in her garage, whose real way in is the key
 * in 8-1-bonus). Parked by the start castle, she turns to face you (a beep), turns back and drives
 * off, the camera following her a little; she hover-hops over Fred, who sits in her way, and the
 * steel hatch in the ground slides open for her by wand magic: she drops in nose first. Fred looks
 * down the shaft and dives in after her, head first; the hatch slams shut (CLANG, a little dust, no
 * shake), and the camera comes back. The hatch is the level's own (`locked-hatch 13 13`): the scene
 * draws it open and shut over it, and nothing of it stays.
 */
export const SOPHIA_SIGHTING_TIMING = {
  /** Where she is parked (level px, her frame's left edge), facing right, away from you. */
  x: 108,
  /**
   * Her 32x32 frames stand on their row 23 (the wheels), 8 rows above the frame's bottom: she
   * is drawn with her frame's bottom this far below the ground.
   */
  sink: 8,
  /** She turns to face you (turn-0, turn-1, turn-2, then facing left, cannon up), `turn` frames each. */
  turnAt: 16,
  turn: 6,
  /** The beep, as she faces you. */
  beepAt: 36,
  /** She turns back (turn-2, turn-1, turn-0), then drives right, `drive` px a frame. */
  backAt: 52,
  driveAt: 70,
  drive: 1,
  /** Then the hover hop: from where she is to over the hatch, peaking `hop` px up. */
  hopAt: 100,
  hopEnd: 134,
  hop: 40,
  /** The hatch: its left edge (level px, column 13), the ground's top (screen px, row 13). */
  hatchX: 208,
  /** Wand sparkles, and the hatch slides open; she tips nose down and sinks, `sink` px a frame. */
  openAt: 138,
  dropAt: 146,
  drop: 3,
  /** Fred sits in her way (his frame's left edge), looks down the shaft, and dives after her. */
  fredX: 180,
  diveAt: 172,
  diveEnd: 190,
  /** The hatch slams shut (CLANG). */
  slamAt: 198,
  /** The camera follows her `pan` px right, and comes back from `panBack`. */
  pan: 48,
  panAt: 70,
  panBack: 214,
  /** Frames after the camera is back before the card. */
  beat: 24,
} as const;
const SO = SOPHIA_SIGHTING_TIMING;

/** Where Sophia III is at frame `t` (her frame's left edge and feet; the frame and its flip). */
function sophiaAt(t: number): { x: number; feet: number; frame: string; flip: boolean } | null {
  const feet = GROUND + SO.sink;
  if (t < SO.turnAt) return { x: SO.x, feet, frame: 'idle', flip: false };
  const faced = SO.turnAt + 3 * SO.turn;
  if (t < faced) {
    const k = Math.floor((t - SO.turnAt) / SO.turn);
    return { x: SO.x, feet, frame: `turn-${k}`, flip: false };
  }
  if (t < SO.backAt) return { x: SO.x, feet, frame: 'aim-up', flip: true };
  if (t < SO.backAt + 3 * SO.turn) {
    const k = 2 - Math.floor((t - SO.backAt) / SO.turn);
    return { x: SO.x, feet, frame: `turn-${k}`, flip: false };
  }
  if (t < SO.driveAt) return { x: SO.x, feet, frame: 'idle', flip: false };
  const driven = SO.x + SO.drive * (Math.min(t, SO.hopAt) - SO.driveAt);
  if (t < SO.hopAt) return { x: driven, feet, frame: `drive-${((t - SO.driveAt) >> 2) % 4}`, flip: false };
  if (t < SO.hopEnd) {
    // A hover hop, a parabola from the road to over the hatch.
    const k = (t - SO.hopAt) / (SO.hopEnd - SO.hopAt);
    const x = driven + (SO.hatchX - driven) * k;
    return { x, feet: feet - 4 * SO.hop * k * (1 - k), frame: `hover-${(t >> 2) & 1}`, flip: false };
  }
  if (t < SO.dropAt) return { x: SO.hatchX, feet, frame: 'idle', flip: false };
  // Nose first down the shaft, until she is wholly below the hatch's bottom.
  const sunk = SO.drop * (t - SO.dropAt);
  if (sunk > 32 + 16) return null;
  return { x: SO.hatchX, feet: feet + sunk, frame: 'tilt-down', flip: false };
}

/** The frame Fred's dive is over (he is gone down the shaft). */
const SOPHIA_FRED_GONE = SO.diveEnd + 1;

export const SOPHIA_SIGHTING: SightingScript = {
  hero: 'sophia',
  level: '8-1',
  frames: SO.panBack + Math.ceil(SO.pan / 4) + SO.beat,
  sfx: {
    [SO.beepAt]: 'select',
    [SO.hopAt]: 'jump-big',
    [SO.openAt]: 'magic',
    [SO.diveAt]: 'jump-small',
    [SO.slamAt]: 'bump',
  },
  pan: { dx: SO.pan, at: SO.panAt, back: SO.panBack, speed: 2, backSpeed: 4 },
  draw(t) {
    const out: SightingDraw[] = [];
    // The hatch open over the level's own (shut, the same picture) from the sparkles to the slam.
    if (t >= SO.openAt && t < SO.slamAt) out.push({ kind: 'hatch', x: SO.hatchX, top: GROUND, open: true });
    if (t >= SO.openAt && t < SO.openAt + BURST_LIFE)
      out.push({ kind: 'burst', x: SO.hatchX + 16, y: GROUND - 2, age: t - SO.openAt });
    // Fred (his own colours): sitting in her way, then the dive down the shaft, head first.
    if (t < SO.diveAt) {
      const look = t >= SO.diveAt - 16;
      out.push({
        kind: 'sprite',
        sheet: 'sophia',
        palette: 'sophia',
        frame: look ? 'fred-1' : 'fred-0',
        x: SO.fredX,
        feet: GROUND,
      });
    } else if (t < SOPHIA_FRED_GONE) {
      const k = Math.min(1, (t - SO.diveAt) / (SO.diveEnd - SO.diveAt));
      const x = SO.fredX + (SO.hatchX + 8 - SO.fredX) * k;
      // Up a little, then down into the shaft (24 px below the ground at the end: gone).
      const feet = GROUND - 20 * Math.sin(Math.PI * Math.min(1, k * 1.6)) + Math.max(0, k - 0.6) * 80;
      out.push({
        kind: 'sprite',
        sheet: 'sophia',
        palette: 'sophia',
        frame: 'cut-fred-jump',
        x: Math.round(x),
        feet: Math.round(feet),
        clipBelow: GROUND + 16,
      });
    }
    // Sophia III, brainwashed.
    const at = sophiaAt(t);
    if (at) {
      const d = hero('sophia', at.frame, at.x, at.feet, at.flip);
      out.push(
        t >= SO.dropAt ? { ...d, clipBelow: GROUND + 16, sparkles: at.feet <= GROUND + SO.sink + 8 } : d,
      );
    }
    if (t >= SO.slamAt && t < SO.slamAt + DUST_LIFE)
      out.push({ kind: 'dust', x: SO.hatchX + 16, y: GROUND - 1, age: t - SO.slamAt });
    return out;
  },
};

/* ---------------------------------------------------------------- when one plays */

/** The built sightings, by the level they play in. */
export const SIGHTINGS: Readonly<Record<string, SightingScript>> = {
  [LINK_SIGHTING.level]: LINK_SIGHTING,
  [MEGAMAN_SIGHTING.level]: MEGAMAN_SIGHTING,
  [SAMUS_SIGHTING.level]: SAMUS_SIGHTING,
  [SIMON_SIGHTING.level]: SIMON_SIGHTING,
  [RYU_SIGHTING.level]: RYU_SIGHTING,
  [BILL_SIGHTING.level]: BILL_SIGHTING,
  [SOPHIA_SIGHTING.level]: SOPHIA_SIGHTING,
};

/** Camera px a start screen may be scrolled and still count as the start (a warp lands further). */
export const START_SCREEN_PX = 16;

/** What sightingDue reads from the game (the Game class satisfies it). */
export interface SightingGame extends StoryGame {
  seen(id: string): boolean;
  freed: readonly string[];
  met: readonly string[];
  mapProgress: { cleared: readonly string[] };
  state: { character: { id: string }; character2: { id: string } | null };
}

/**
 * The sighting due in level `levelId` now, else null (docs/STORY.md, design rules 1 to 7):
 * the campaign's story plays (storyOn); this is the hero's main area; the file has not seen it;
 * the hero is neither freed nor met; the level is not cleared; no player is that hero; and every
 * player stands on the start screen (on the ground, not rising from a pipe, falling in, beaming,
 * climbing in, or walking in on an intro), with the camera still at the start.
 */
export function sightingDue(game: SightingGame, levelId: string, world: World): SightingScript | null {
  const s = SIGHTINGS[levelId];
  if (!s || !storyOn(game) || game.seen(beat.sighting(s.hero))) return null;
  if (game.freed.includes(s.hero) || game.met.includes(s.hero)) return null;
  if (game.mapProgress.cleared.includes(s.level)) return null;
  if (game.state.character.id === s.hero || game.state.character2?.id === s.hero) return null;
  return standingAtStart(world) ? s : null;
}

/** Every player stands free on the start screen (see sightingDue). */
export function standingAtStart(world: World): boolean {
  if (world.inPipe || world.beaming || world.autoWalk || world.camera.pxX >= START_SCREEN_PX) return false;
  if (world.activePlayers().length === 0) return false;
  return world.players.every((p) => p.out || (!p.dead && !p.frozen && !p.hidden && p.body.onGround));
}
