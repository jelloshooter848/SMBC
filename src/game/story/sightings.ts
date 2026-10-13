import type { World } from '@game/world/world';
import { beat, storyOn, type StoryGame } from './beats';

/*
 * The hero sightings (0.4.51, docs/STORY.md "Sighting" under each world): the first time a
 * world's first level starts on a campaign file, its brainwashed hero is glimpsed on the start
 * screen, doing something that points at where they hide, then player 1's hero says one card.
 * Luigi's run in 1-1 (luigi-runs.ts) came first; the others share one scene (hero-sighting.ts),
 * each driven by a script here: what is drawn at each frame, its sounds and an optional camera pan.
 *
 * Built so far: Link (2-1, a vine grows by magic and he climbs it into the sky), Mega Man (3-1,
 * he flickers, then beams up), and since 0.4.52 Samus (4-2, shown as 4-1: she bombs her way on
 * into the caves) and Simon (5-1: he walks through the crypt gate, and it slams shut). Ryu, Bill
 * and Sophia III come with their worlds; their beat ids are reserved already (beats.ts
 * SIGHTING_HEROES, the save code's version 3).
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
  | { kind: 'dust'; x: number; y: number; age: number };

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

/* ---------------------------------------------------------------- when one plays */

/** The built sightings, by the level they play in. */
export const SIGHTINGS: Readonly<Record<string, SightingScript>> = {
  [LINK_SIGHTING.level]: LINK_SIGHTING,
  [MEGAMAN_SIGHTING.level]: MEGAMAN_SIGHTING,
  [SAMUS_SIGHTING.level]: SAMUS_SIGHTING,
  [SIMON_SIGHTING.level]: SIMON_SIGHTING,
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
