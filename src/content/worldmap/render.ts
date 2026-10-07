import type { Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import type { MapActor, MapTheme, WorldMapPage } from '@game/map/types';
import { ARENA_CROWD_FRAMES, ARENA_NIGHT, WARP_SPACE, WATER_FRAMES } from '@content/sprites/map';
import { POND_CHARS } from './build';

/*
 * Drawing for the world map pages (art in src/content/sprites/map.ts, palette `map-<theme>`).
 * The engine calls only mapSky, drawMapTile and drawMapActor, every frame, so nothing here
 * builds strings or allocates per call: frame names and palette names are precomputed.
 *
 * Tile legend (one char per 16×16 tile):
 *
 *   .  sky / background (nothing drawn)       ~  water (the theme's sea: water, clouds, lava)
 *   #  ground          ,  grass tufts         *  flowers (shells by the sea)     :  sand
 *   o  snow drifts     %  beach surf          L  bubbling lava
 *   Shores, generated from '#' by autoShore (build.ts):
 *   8 2 4 6  edge with water to the north / south / west / east (south edges show a cliff face)
 *   7 9 1 3  outer corners NW / NE / SW / SE    q e z c  inner corners (water diagonally NW/NE/SW/SE)
 *   [ ] n u  bridge landings (the bridge lies to the west / east / north / south)
 *   =  bridge (east-west)    I  bridge (north-south)
 *   T tree   Y palm   H hill   S snowy hill   ^ mountain   R boulder   C cliff face
 *   K  cliff standing in the sea               h j  horizon ridge (plain / snow-capped)
 *   ( O )  giant mushroom cap (left, middle, right)   !  mushroom stem
 *   { - }  treetop platform in the sea (left, middle, right)   |  tree trunk in the sea
 *   W castle wall   V battlements   G castle gate      P pipe   X cannon
 *   A  crystal cluster (the Warp Zone's scenery)
 *   s x  twinkling stars     D moon     k small cloud
 *   a b d f / g i l m / p r t v  a round pond, 4×3 tiles, always written as this whole block
 *   The Mini Game Arena (theme 'arena'; no water, so no autoShore):
 *   F  the pitch (checkered floor)     M N  stands full of cheering fans (two crowds, out of step)
 *   E  a team banner over the stands   B  the barrier wall (ad boards) along the pitch's far edge
 *   w  bunting: a line of pennants waving in the sky above the stands
 *
 * Walkable (MAP_WALKABLE; every path tile must be one of these): # , * : o, all shores and
 * landings, = I, the mushroom caps ( O ), the treetops { - }, the gate G and the pitch F.
 *
 * Pages keep tile rows 0-1 (under the engine's 24 px header) as plain sky.
 *
 * Actors (`MapActor.type`, x/y = top-left px of a 16×16 box; taller sprites stand on its bottom;
 * mapActorBounds gives the whole area each one can cover):
 *   cloud {size 1-3, speed px/frame}           drifts and wraps around the page
 *   cheep {range px, height, period, phase}    leaps out of the water in an arc and splashes back
 *   podoboo {height, period, phase}            leaps out of lava
 *   star {phase}  flag {phase}  smoke {period, phase}  bubble {height, period, phase}
 *   goomba / koopa {range, speed, color} / hammer-bro {range}   pace back and forth
 *   paratroopa {range, color}  bobs up and down    lakitu {range}  bobs on its cloud and drifts
 *   bullet {speed}  crosses the sky and wraps
 *   comet {speed, phase}  streaks across the sky, bobbing a little, and wraps
 *   light-tower {phase}  the arena's floodlights, 16×48 standing on the box; a lamp glints now and then
 *   scoreboard {phase}   the arena's scoreboard, 48×32 from the box's left edge, standing on its
 *                        bottom (box rows y-16..y+16); its marquee bulbs slowly trade colours
 */

interface TileDef {
  frame: string;
  /** Animation frames (`frame-0`..), each shown `ticks` frames; `phase` offsets the cycle. */
  frames?: number;
  ticks?: number;
  phase?: number;
  walk?: boolean;
}

const WATER_TICKS = 8;
const wet = (frame: string, walk = false): TileDef => ({
  frame,
  frames: WATER_FRAMES,
  ticks: WATER_TICKS,
  walk,
});

export const MAP_LEGEND: Readonly<Record<string, TileDef>> = {
  '.': { frame: '' },
  '~': wet('water'),
  L: { frame: 'lava', frames: 4, ticks: 12 },
  '#': { frame: 'ground', walk: true },
  ',': { frame: 'tuft', walk: true },
  '*': { frame: 'flowers', frames: 2, ticks: 40, walk: true },
  ':': { frame: 'sand', walk: true },
  o: { frame: 'drift', walk: true },
  '%': wet('surf'),
  '8': wet('shore-n', true),
  '2': wet('shore-s', true),
  '4': wet('shore-w', true),
  '6': wet('shore-e', true),
  '7': wet('shore-nw', true),
  '9': wet('shore-ne', true),
  '1': wet('shore-sw', true),
  '3': wet('shore-se', true),
  q: wet('shore-in-nw', true),
  e: wet('shore-in-ne', true),
  z: wet('shore-in-sw', true),
  c: wet('shore-in-se', true),
  '[': wet('landing-w', true),
  ']': wet('landing-e', true),
  n: wet('landing-n', true),
  u: wet('landing-s', true),
  '=': wet('bridge-h', true),
  I: wet('bridge-v', true),
  T: { frame: 'tree' },
  Y: { frame: 'palm' },
  H: { frame: 'hill' },
  S: { frame: 'hill-snow' },
  '^': { frame: 'mountain' },
  R: { frame: 'rock' },
  C: { frame: 'cliff' },
  K: wet('cliff-sea'),
  h: { frame: 'ridge' },
  j: { frame: 'ridge-snow' },
  '(': { frame: 'cap-left', walk: true },
  O: { frame: 'cap-mid', walk: true },
  ')': { frame: 'cap-right', walk: true },
  '!': { frame: 'stem' },
  '{': wet('treetop-left', true),
  '-': wet('treetop-mid', true),
  '}': wet('treetop-right', true),
  '|': wet('trunk'),
  W: { frame: 'wall' },
  V: { frame: 'battlement' },
  G: { frame: 'gate', walk: true },
  P: { frame: 'pipe' },
  X: { frame: 'blaster' },
  A: { frame: 'crystal' },
  s: { frame: 'star', frames: 4, ticks: 28 },
  x: { frame: 'star', frames: 4, ticks: 36, phase: 2 },
  D: { frame: 'moon' },
  k: { frame: 'cloud' },
  // The Mini Game Arena ('arena' theme). Two crowds (M, N) cheer in different patterns and out
  // of step, so neighbouring stands never move together; the banner hangs over a cheering crowd.
  F: { frame: 'arena-floor', walk: true },
  M: { frame: 'arena-crowd-a', frames: ARENA_CROWD_FRAMES, ticks: 22 },
  N: { frame: 'arena-crowd-b', frames: ARENA_CROWD_FRAMES, ticks: 26, phase: 2 },
  E: { frame: 'arena-banner', frames: ARENA_CROWD_FRAMES, ticks: 26 },
  B: { frame: 'arena-wall' },
  w: { frame: 'arena-bunting', frames: 3, ticks: 14 },
  ...Object.fromEntries(POND_CHARS.split('').map((ch, i) => [ch, wet(`pond-${i}`)])),
};

/** Legend chars the hero's paths may run over. */
export const MAP_WALKABLE: ReadonlySet<string> = new Set(
  Object.entries(MAP_LEGEND)
    .filter(([, d]) => d.walk)
    .map(([c]) => c),
);

/** Each tile's frame names, built once: the still frame, or the animation cycle with its phase applied. */
const TILE_FRAMES: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  Object.entries(MAP_LEGEND).map(([ch, d]) => {
    const n = d.frames ?? 0;
    const names = n
      ? Array.from({ length: n }, (_, i) => `${d.frame}-${(i + (d.phase ?? 0)) % n}`)
      : [d.frame];
    return [ch, names];
  }),
);
const TILE_TICKS: Readonly<Record<string, number>> = Object.fromEntries(
  Object.entries(MAP_LEGEND).map(([ch, d]) => [ch, d.ticks ?? 1]),
);

/** Sprite frame for tile `ch` at animation counter `frame` ('' = nothing to draw). */
export function mapTileFrame(ch: string, frame: number): string {
  const names = TILE_FRAMES[ch];
  if (!names) return '';
  if (names.length === 1) return names[0] as string;
  const i = Math.floor(Math.max(0, frame) / (TILE_TICKS[ch] as number)) % names.length;
  return names[i] as string;
}

/** The map sheet's palette for each theme. */
export const MAP_PAL: Readonly<Record<MapTheme, string>> = {
  grass: 'map-grass',
  sea: 'map-sea',
  night: 'map-night',
  mushroom: 'map-mushroom',
  sky: 'map-sky',
  snow: 'map-snow',
  coast: 'map-coast',
  bowser: 'map-bowser',
  warp: 'map-warp',
  arena: 'map-arena',
};

const SKY: Readonly<Record<MapTheme, string>> = {
  grass: '#5c94fc',
  sea: '#3cbcfc',
  night: '#000058',
  mushroom: '#5c94fc',
  sky: '#5c94fc',
  snow: '#000000',
  coast: '#5c94fc',
  bowser: '#881400',
  warp: WARP_SPACE, // the same indigo as its void, so sky and void are one starfield
  arena: ARENA_NIGHT, // a night match under the lights
};

/** Background colour behind the tiles. */
export function mapSky(page: WorldMapPage): string {
  return SKY[page.theme];
}

/** Draws the tile `ch` of `page` at screen pixel (x, y); `frame` is the animation counter. */
export function drawMapTile(
  r: Renderer,
  assets: AssetRegistry,
  page: WorldMapPage,
  ch: string,
  x: number,
  y: number,
  frame: number,
): void {
  const f = mapTileFrame(ch, frame);
  if (f) r.sprite(assets.sheet('map', MAP_PAL[page.theme]), f, x, y);
}

/* ------------------------------------------------------------------------------------------ */

const ENEMY_PAL: Readonly<Record<MapTheme, string>> = {
  grass: 'enemies-overworld',
  sea: 'enemies-overworld',
  night: 'enemies-overworld',
  mushroom: 'enemies-overworld',
  sky: 'enemies-overworld',
  snow: 'enemies-overworld',
  coast: 'enemies-overworld',
  bowser: 'enemies-castle',
  warp: 'enemies-underground',
  arena: 'enemies-overworld',
};
const CHEEP_PAL: Readonly<Record<MapTheme, string>> = {
  grass: 'enemies-water',
  sea: 'enemies-water',
  night: 'enemies-water',
  mushroom: 'enemies-water',
  sky: 'enemies-water',
  snow: 'enemies-water',
  coast: 'enemies-water',
  bowser: 'enemies-castle',
  warp: 'enemies-water',
  arena: 'enemies-water',
};
const DECOR_PAL: Readonly<Record<MapTheme, string>> = {
  grass: 'decor-overworld',
  sea: 'decor-overworld',
  night: 'decor-night',
  mushroom: 'decor-overworld',
  sky: 'decor-overworld',
  snow: 'decor-night',
  coast: 'decor-overworld',
  bowser: 'decor-gray',
  warp: 'decor-night',
  arena: 'decor-night',
};

const CLOUD = ['cloud-1', 'cloud-2', 'cloud-3'] as const;
const CHEEP = ['cheep-0', 'cheep-1'] as const;
const SPLASH = ['splash-0', 'splash-1'] as const;
const PODOBOO = ['podoboo-0', 'podoboo-1'] as const;
const TWINKLE = ['twinkle-0', 'twinkle-1', 'twinkle-2'] as const;
const TWINKLE_STEPS = [0, 0, 0, 1, 2, 1, 0, 0, 0, 0] as const;
const FLAG = ['flag-0', 'flag-1', 'flag-2'] as const;
const SMOKE = ['smoke-0', 'smoke-1', 'smoke-2'] as const;
const GOOMBA = ['goomba-0', 'goomba-1'] as const;
const KOOPA = ['koopa-0', 'koopa-1'] as const;
const KOOPA_FLY = ['koopa-fly-0', 'koopa-fly-1'] as const;
const HAMMER_BRO = ['hammer-bro-0', 'hammer-bro-1'] as const;
const LAKITU = ['lakitu-0', 'lakitu-1'] as const;
const COMET = ['comet-0', 'comet-1'] as const;
const TOWER = ['arena-tower-0', 'arena-tower-1'] as const;
const SCOREBOARD = ['arena-scoreboard-0', 'arena-scoreboard-1'] as const;

const num = (a: MapActor, key: string, fallback: number): number => {
  const v = a.props?.[key];
  return typeof v === 'number' ? v : fallback;
};

const koopaPal = (a: MapActor): string => (a.props?.['color'] === 'red' ? 'koopa-red' : 'koopa-green');

/** How far the engine shifted this actor (page slides pass a copy moved by the slide offset). */
function pageOffset(page: WorldMapPage, a: MapActor): number {
  const list = page.actors;
  for (let i = 0; i < list.length; i++) {
    const p = list[i] as MapActor;
    if (p === a || (p.type === a.type && p.y === a.y && p.props === a.props)) return a.x - p.x;
  }
  return 0;
}

/** Wraps a horizontal position across the page so a w-px sprite leaves one side and enters the other. */
const wrapX = (x: number, w: number): number => {
  const span = 256 + w;
  return ((((x + w) % span) + span) % span) - w;
};

/**
 * Back-and-forth walk over `range` px at `speed` px/frame (a triangle wave): the offset from the
 * left end, signed by the heading (positive walking right, negative walking left).
 */
function pace(t: number, range: number, speed: number): number {
  if (range <= 0) return 0;
  const period = (2 * range) / speed;
  const u = (t % period) / period;
  return u < 0.5 ? u * 2 * range : -(1 - u) * 2 * range;
}

/** Actor types drawMapActor knows. */
export const MAP_ACTOR_TYPES = [
  'cloud',
  'bullet',
  'cheep',
  'podoboo',
  'star',
  'flag',
  'smoke',
  'bubble',
  'goomba',
  'koopa',
  'hammer-bro',
  'paratroopa',
  'lakitu',
  'comet',
  'light-tower',
  'scoreboard',
] as const;

/** Draws a decorative actor; `frame` is the animation counter. */
export function drawMapActor(
  r: Renderer,
  assets: AssetRegistry,
  page: WorldMapPage,
  actor: MapActor,
  frame: number,
): void {
  const t = Math.max(0, frame) + num(actor, 'phase', 0);
  const x = actor.x;
  const y = actor.y;
  switch (actor.type) {
    case 'cloud': {
      const size = Math.min(3, Math.max(1, num(actor, 'size', 1)));
      const ox = pageOffset(page, actor);
      const cx = ox + wrapX(x - ox + t * num(actor, 'speed', 0.15), 16 + 16 * size);
      r.sprite(assets.sheet('decor', DECOR_PAL[page.theme]), CLOUD[size - 1] as string, cx, y);
      return;
    }
    case 'bullet': {
      const speed = num(actor, 'speed', -0.6);
      const ox = pageOffset(page, actor);
      const bx = ox + wrapX(x - ox + t * speed, 16);
      r.sprite(assets.sheet('enemies', ENEMY_PAL[page.theme]), 'bullet', bx, y, speed > 0);
      return;
    }
    case 'cheep': {
      const period = num(actor, 'period', 160);
      const range = num(actor, 'range', 32);
      const height = num(actor, 'height', 32);
      const jump = 60;
      const local = t % period;
      const map = assets.sheet('map', MAP_PAL[page.theme]);
      if (local < jump) {
        const s = local / jump;
        const fish = assets.sheet('enemies', CHEEP_PAL[page.theme]);
        r.sprite(fish, CHEEP[(t >> 3) & 1] as string, x + range * s, y - height * 4 * s * (1 - s), range > 0);
        if (local < 12) r.sprite(map, SPLASH[local < 6 ? 0 : 1] as string, x, y + 8);
      } else if (local < jump + 12) {
        r.sprite(map, SPLASH[local - jump < 6 ? 0 : 1] as string, x + range, y + 8);
      }
      return;
    }
    case 'podoboo': {
      const period = num(actor, 'period', 130);
      const height = num(actor, 'height', 40);
      const jump = 70;
      const local = t % period;
      if (local >= jump) return;
      const s = local / jump;
      const sheet = assets.sheet('enemies', ENEMY_PAL[page.theme]);
      r.sprite(sheet, PODOBOO[(t >> 2) & 1] as string, x, y - height * 4 * s * (1 - s), false, s > 0.5);
      return;
    }
    case 'star': {
      // Mostly a soft point of light, now and then a slow, small sparkle.
      const size = TWINKLE_STEPS[Math.floor(t / 18) % TWINKLE_STEPS.length] as number;
      r.sprite(assets.sheet('map', MAP_PAL[page.theme]), TWINKLE[size] as string, x, y);
      return;
    }
    case 'flag':
      r.sprite(assets.sheet('map', MAP_PAL[page.theme]), FLAG[Math.floor(t / 10) % 3] as string, x, y);
      return;
    case 'smoke': {
      const period = num(actor, 'period', 120);
      const map = assets.sheet('map', MAP_PAL[page.theme]);
      for (let k = 0; k < 3; k++) {
        const u = ((t + (k * period) / 3) % period) / period;
        r.sprite(map, SMOKE[u < 0.33 ? 0 : u < 0.66 ? 1 : 2] as string, x + Math.sin(u * 6) * 3, y - u * 28);
      }
      return;
    }
    case 'bubble': {
      const period = num(actor, 'period', 100);
      const height = num(actor, 'height', 16);
      const map = assets.sheet('map', MAP_PAL[page.theme]);
      for (let k = 0; k < 2; k++) {
        const u = ((t + (k * period) / 2) % period) / period;
        r.sprite(map, 'bubble', x + k * 5 + Math.sin(u * 9) * 1.5, y - u * height);
      }
      return;
    }
    case 'goomba': {
      const p = pace(t, num(actor, 'range', 24), num(actor, 'speed', 0.25));
      const sheet = assets.sheet('enemies', ENEMY_PAL[page.theme]);
      r.sprite(sheet, GOOMBA[(t >> 3) & 1] as string, x + Math.abs(p), y, p > 0);
      return;
    }
    case 'koopa': {
      const p = pace(t, num(actor, 'range', 24), num(actor, 'speed', 0.25));
      r.sprite(
        assets.sheet('enemies', koopaPal(actor)),
        KOOPA[(t >> 3) & 1] as string,
        x + Math.abs(p),
        y - 8,
        p > 0,
      );
      return;
    }
    case 'hammer-bro': {
      const p = pace(t, num(actor, 'range', 8), 0.15);
      const hop = t % 120 < 24 ? Math.sin(((t % 120) / 24) * Math.PI) * 10 : 0;
      const sheet = assets.sheet('enemies', ENEMY_PAL[page.theme]);
      r.sprite(sheet, HAMMER_BRO[(t >> 4) & 1] as string, x + Math.abs(p), y - 8 - hop);
      return;
    }
    case 'paratroopa': {
      const by = Math.sin(t / 40) * num(actor, 'range', 8);
      r.sprite(assets.sheet('enemies', koopaPal(actor)), KOOPA_FLY[(t >> 3) & 1] as string, x, y - 8 + by);
      return;
    }
    case 'lakitu': {
      const range = num(actor, 'range', 48);
      const lx = x + (range / 2) * (1 - Math.cos(t / 200));
      const sheet = assets.sheet('enemies', ENEMY_PAL[page.theme]);
      r.sprite(sheet, LAKITU[(t >> 5) & 1] as string, lx, y - 8 + Math.sin(t / 30) * 2);
      return;
    }
    case 'comet': {
      const speed = num(actor, 'speed', 0.45);
      const ox = pageOffset(page, actor);
      const cx = ox + wrapX(x - ox + t * speed, 16);
      const map = assets.sheet('map', MAP_PAL[page.theme]);
      r.sprite(map, COMET[(t >> 2) & 1] as string, cx, y + Math.sin(t / 50) * 2, speed < 0);
      return;
    }
    case 'light-tower': {
      // Steady lamps; one glints for a moment every few seconds.
      const map = assets.sheet('map', MAP_PAL[page.theme]);
      r.sprite(map, TOWER[t % 200 < 24 ? 1 : 0] as string, x, y - 32);
      return;
    }
    case 'scoreboard':
      // A slow marquee: the bulbs trade colours about twice a second, never a flash.
      r.sprite(
        assets.sheet('map', MAP_PAL[page.theme]),
        SCOREBOARD[Math.floor(t / 32) % 2] as string,
        x,
        y - 16,
      );
      return;
    default:
      return;
  }
}

/**
 * Everything an actor can ever cover, in px: [x0, y0, x1, y1) with the ends exclusive. Pages keep
 * this off roads and nodes. Clouds, comets and Bullet Bills sweep the whole width of the page.
 */
export function mapActorBounds(a: MapActor): [number, number, number, number] {
  const { x, y } = a;
  switch (a.type) {
    case 'cloud':
      return [0, y, 256, y + 24];
    case 'bullet':
      return [0, y, 256, y + 16];
    case 'comet':
      return [0, y - 2, 256, y + 10];
    case 'cheep': {
      const range = num(a, 'range', 32);
      return [Math.min(x, x + range), y - num(a, 'height', 32), Math.max(x, x + range) + 16, y + 16];
    }
    case 'podoboo':
      return [x, y - num(a, 'height', 40), x + 16, y + 16];
    case 'star':
      return [x, y, x + 8, y + 8];
    case 'flag':
      return [x, y, x + 16, y + 16];
    case 'light-tower':
      return [x, y - 32, x + 16, y + 16];
    case 'scoreboard':
      return [x, y - 16, x + 48, y + 16];
    case 'smoke':
      return [x - 3, y - 28, x + 11, y + 8];
    case 'bubble':
      return [x - 2, y - num(a, 'height', 16), x + 16, y + 8];
    case 'goomba':
      return [x, y, x + num(a, 'range', 24) + 16, y + 16];
    case 'koopa':
      return [x, y - 8, x + num(a, 'range', 24) + 16, y + 16];
    case 'hammer-bro':
      return [x, y - 18, x + num(a, 'range', 8) + 16, y + 16];
    case 'paratroopa': {
      const range = num(a, 'range', 8);
      return [x, y - 8 - range, x + 16, y + 16 + range];
    }
    case 'lakitu':
      return [x, y - 10, x + num(a, 'range', 48) + 16, y + 18];
    default:
      return [x, y, x + 16, y + 16];
  }
}
