import type { World } from '@game/world/world';
import { beat, storyOn, type StoryGame } from './beats';

/*
 * The hero sightings (0.4.51, docs/STORY.md "Sighting" under each world): the first time a
 * world's first level starts on a campaign file, its brainwashed hero is glimpsed on the start
 * screen, doing something that points at where they hide, then player 1's hero says one card.
 * Luigi's run in 1-1 (luigi-runs.ts) came first; the others share one scene (hero-sighting.ts),
 * each driven by a script here: what is drawn at each frame, its sounds and an optional camera pan.
 *
 * Built so far: Link (2-1, a vine grows by magic and he climbs it into the sky) and Mega Man
 * (3-1, he flickers, then beams up). Samus, Simon, Ryu, Bill and Sophia III come with their worlds;
 * their beat ids are reserved already (beats.ts SIGHTING_HEROES, the save code's version 3).
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
  | { kind: 'burst'; x: number; y: number; age: number };

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
  /** Where he stands (level px, his left edge) and where the vine grows (its left edge). */
  x: 196,
  vineX: 216,
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

/* ---------------------------------------------------------------- when one plays */

/** The built sightings, by the level they play in. */
export const SIGHTINGS: Readonly<Record<string, SightingScript>> = {
  [LINK_SIGHTING.level]: LINK_SIGHTING,
  [MEGAMAN_SIGHTING.level]: MEGAMAN_SIGHTING,
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
