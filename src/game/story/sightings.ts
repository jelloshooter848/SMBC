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
 * Built so far: Link (2-1, a vine grows by magic and he climbs it into the sky) and Mega Man
 * (3-1, he flickers, then beams up); 0.4.53: Ryu (6-2, a castle wall panel spins him through) and
 * Bill (7-3, hand over hand under the first bridge, then a far boom). The rest come with their
 * worlds; their beat ids are reserved already (beats.ts SIGHTING_HEROES, the save code's version 3).
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

/* ---------------------------------------------------------------- when one plays */

/** The built sightings, by the level they play in. */
export const SIGHTINGS: Readonly<Record<string, SightingScript>> = {
  [LINK_SIGHTING.level]: LINK_SIGHTING,
  [MEGAMAN_SIGHTING.level]: MEGAMAN_SIGHTING,
  [RYU_SIGHTING.level]: RYU_SIGHTING,
  [BILL_SIGHTING.level]: BILL_SIGHTING,
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
