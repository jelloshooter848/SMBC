import type { Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import type { MapActor, MapTheme, WorldMapPage } from '@game/map/types';
import { WATER_FRAMES } from '@content/sprites/map';

/*
 * Drawing for the world map pages (art in src/content/sprites/map.ts, palette `map-<theme>`).
 * The engine calls only mapSky, drawMapTile and drawMapActor.
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
 *   { - }  treetop platform (left, middle, right)      |  tree trunk
 *   W castle wall   V battlements   G castle gate      P pipe   X cannon
 *   s x  twinkling stars     D moon     k small cloud
 *
 * Walkable (MAP_WALKABLE; every path tile must be one of these): # , * : o, all shores and
 * landings, = I, the mushroom caps ( O ), the treetops { - } and the gate G.
 *
 * Actors (`MapActor.type`, x/y = top-left px of a 16×16 box; taller sprites stand on its bottom):
 *   cloud {size 1-3, speed px/frame}           drifts and wraps around the page
 *   cheep {range px, height, period, phase}    leaps out of the water in an arc and splashes back
 *   podoboo {height, period, phase}            leaps out of lava
 *   star {phase}  flag {phase}  smoke {period, phase}  bubble {height, period, phase}
 *   goomba / koopa {range, speed, color} / hammer-bro {range}   pace back and forth
 *   paratroopa {range, color}  bobs up and down    lakitu {range}  bobs on its cloud and drifts
 *   bullet {speed}  crosses the sky and wraps
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
  '{': { frame: 'treetop-left', walk: true },
  '-': { frame: 'treetop-mid', walk: true },
  '}': { frame: 'treetop-right', walk: true },
  '|': { frame: 'trunk' },
  W: { frame: 'wall' },
  V: { frame: 'battlement' },
  G: { frame: 'gate', walk: true },
  P: { frame: 'pipe' },
  X: { frame: 'blaster' },
  s: { frame: 'star', frames: 4, ticks: 28 },
  x: { frame: 'star', frames: 4, ticks: 36, phase: 2 },
  D: { frame: 'moon' },
  k: { frame: 'cloud' },
};

/** Legend chars the hero's paths may run over. */
export const MAP_WALKABLE: ReadonlySet<string> = new Set(
  Object.entries(MAP_LEGEND)
    .filter(([, d]) => d.walk)
    .map(([c]) => c),
);

/** Sprite frame for tile `ch` at animation counter `frame` ('' = nothing to draw). */
export function mapTileFrame(ch: string, frame: number): string {
  const d = MAP_LEGEND[ch];
  if (!d || !d.frame) return '';
  if (!d.frames) return d.frame;
  const i = (Math.floor(Math.max(0, frame) / (d.ticks ?? 8)) + (d.phase ?? 0)) % d.frames;
  return `${d.frame}-${i}`;
}

const SKY: Record<MapTheme, string> = {
  grass: '#5c94fc',
  sea: '#3cbcfc',
  night: '#000058',
  mushroom: '#5c94fc',
  sky: '#5c94fc',
  snow: '#000000',
  coast: '#5c94fc',
  bowser: '#881400',
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
  if (f) r.sprite(assets.sheet('map', `map-${page.theme}`), f, x, y);
}

/* ------------------------------------------------------------------------------------------ */

const num = (a: MapActor, key: string, fallback: number): number => {
  const v = a.props?.[key];
  return typeof v === 'number' ? v : fallback;
};

/** How far the engine shifted this actor (page slides pass a copy moved by the slide offset). */
function pageOffset(page: WorldMapPage, a: MapActor): number {
  const home = page.actors.find((p) => p === a || (p.type === a.type && p.y === a.y && p.props === a.props));
  return home ? a.x - home.x : 0;
}

/** Wraps a horizontal position across the page so a w-px sprite leaves one side and enters the other. */
const wrapX = (x: number, w: number): number => {
  const span = 256 + w;
  return ((((x + w) % span) + span) % span) - w;
};

/** Back-and-forth position over `range` px at `speed` px/frame (triangle wave) and the heading. */
function pace(t: number, range: number, speed: number): { dx: number; right: boolean } {
  if (range <= 0) return { dx: 0, right: false };
  const period = (2 * range) / speed;
  const u = (t % period) / period;
  return u < 0.5 ? { dx: u * 2 * range, right: true } : { dx: (1 - u) * 2 * range, right: false };
}

const enemyPalette = (page: WorldMapPage): string =>
  page.theme === 'bowser' ? 'enemies-castle' : 'enemies-overworld';
const decorPalette = (page: WorldMapPage): string =>
  page.theme === 'night' || page.theme === 'snow'
    ? 'decor-night'
    : page.theme === 'bowser'
      ? 'decor-gray'
      : 'decor-overworld';

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
  const { x, y } = actor;
  const map = () => assets.sheet('map', `map-${page.theme}`);
  const enemies = (pal = enemyPalette(page)) => assets.sheet('enemies', pal);
  switch (actor.type) {
    case 'cloud': {
      const size = Math.min(3, Math.max(1, num(actor, 'size', 1)));
      const w = 16 + 16 * size;
      const ox = pageOffset(page, actor);
      const cx = ox + wrapX(x - ox + t * num(actor, 'speed', 0.15), w);
      r.sprite(assets.sheet('decor', decorPalette(page)), `cloud-${size}`, cx, y);
      return;
    }
    case 'bullet': {
      const speed = num(actor, 'speed', -0.6);
      const ox = pageOffset(page, actor);
      const bx = ox + wrapX(x - ox + t * speed, 16);
      r.sprite(enemies(), 'bullet', bx, y, speed > 0);
      return;
    }
    case 'cheep': {
      const period = num(actor, 'period', 160);
      const range = num(actor, 'range', 32);
      const height = num(actor, 'height', 32);
      const jump = 60;
      const local = t % period;
      const splash = (sx: number, k: number) => r.sprite(map(), `splash-${k < 6 ? 0 : 1}`, sx, y + 8);
      if (local < jump) {
        const s = local / jump;
        const pal = page.theme === 'bowser' ? 'enemies-castle' : 'enemies-water';
        r.sprite(
          enemies(pal),
          `cheep-${(t >> 3) & 1}`,
          x + range * s,
          y - height * 4 * s * (1 - s),
          range > 0,
        );
        if (local < 12) splash(x, local);
      } else if (local < jump + 12) splash(x + range, local - jump);
      return;
    }
    case 'podoboo': {
      const period = num(actor, 'period', 130);
      const height = num(actor, 'height', 40);
      const jump = 70;
      const local = t % period;
      if (local >= jump) return;
      const s = local / jump;
      r.sprite(enemies(), `podoboo-${(t >> 2) & 1}`, x, y - height * 4 * s * (1 - s), false, s > 0.5);
      return;
    }
    case 'star': {
      // Mostly a soft point of light, now and then a slow, small sparkle.
      const step = Math.floor(t / 18) % 10;
      const size = [0, 0, 0, 1, 2, 1, 0, 0, 0, 0][step] as number;
      r.sprite(map(), `twinkle-${size}`, x, y);
      return;
    }
    case 'flag':
      r.sprite(map(), `flag-${Math.floor(t / 10) % 3}`, x, y);
      return;
    case 'smoke': {
      const period = num(actor, 'period', 120);
      for (let k = 0; k < 3; k++) {
        const u = ((t + (k * period) / 3) % period) / period;
        const f = u < 0.33 ? 0 : u < 0.66 ? 1 : 2;
        r.sprite(map(), `smoke-${f}`, x + Math.sin(u * 6) * 3, y - u * 28);
      }
      return;
    }
    case 'bubble': {
      const period = num(actor, 'period', 100);
      const height = num(actor, 'height', 16);
      for (let k = 0; k < 2; k++) {
        const u = ((t + (k * period) / 2) % period) / period;
        r.sprite(map(), 'bubble', x + k * 5 + Math.sin(u * 9) * 1.5, y - u * height);
      }
      return;
    }
    case 'goomba': {
      const p = pace(t, num(actor, 'range', 24), num(actor, 'speed', 0.25));
      r.sprite(enemies(), `goomba-${(t >> 3) & 1}`, x + p.dx, y, p.right);
      return;
    }
    case 'koopa': {
      const p = pace(t, num(actor, 'range', 24), num(actor, 'speed', 0.25));
      const pal = actor.props?.['color'] === 'red' ? 'koopa-red' : 'koopa-green';
      r.sprite(enemies(pal), `koopa-${(t >> 3) & 1}`, x + p.dx, y - 8, p.right);
      return;
    }
    case 'hammer-bro': {
      const p = pace(t, num(actor, 'range', 8), 0.15);
      const hop = t % 120 < 24 ? Math.sin(((t % 120) / 24) * Math.PI) * 10 : 0;
      r.sprite(enemies(), `hammer-bro-${(t >> 4) & 1}`, x + p.dx, y - 8 - hop);
      return;
    }
    case 'paratroopa': {
      const pal = actor.props?.['color'] === 'red' ? 'koopa-red' : 'koopa-green';
      const by = Math.sin(t / 40) * num(actor, 'range', 8);
      r.sprite(enemies(pal), `koopa-fly-${(t >> 3) & 1}`, x, y - 8 + by);
      return;
    }
    case 'lakitu': {
      const range = num(actor, 'range', 48);
      const lx = x + (range / 2) * (1 - Math.cos(t / 200));
      r.sprite(enemies(), `lakitu-${(t >> 5) & 1}`, lx, y - 8 + Math.sin(t / 30) * 2);
      return;
    }
    default:
      return;
  }
}
