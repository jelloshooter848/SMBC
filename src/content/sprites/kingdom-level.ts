import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { Canvas, hash } from './paint';

/*
 * World 1's levels in the Mushroom Kingdom's look (0.4.48, campaign play only): decor and backdrop,
 * never the layout. Tiles, enemies and collision stay exactly as they are; a level takes its look
 * through its map's `campaignTheme:` (level/campaign.ts applyLook), the way 2-1 became a Zelda II
 * field. Classic play keeps the original look. Original art drawn from shapes; nothing traced.
 *
 * - `kingdom` (1-0, 1-1 and 1-3's outdoor rooms): SMB's own blue sky over a pale horizon band, far
 *   blue-green hills with Peach's Castle on one of them at a quarter of the camera's speed (the
 *   theme backdrop, world/theme-backdrop.ts), and the level's own hills, bushes and clouds redrawn
 *   rounder (`hill-big@kingdom` and the rest, in the decor sheet's `decor-kingdom` palette): banded
 *   hills with a light crest, clustered round bushes, soft shaded clouds. The ground, blocks and
 *   pipes are the real tiles.
 * - `kingdom-keep` (1-4): Bowser's hold on a Mushroom Kingdom fort: a dim blue-grey block wall from
 *   below the HUD's band down, scrolling with the level, a tall arched window onto the night every
 *   KEEP_WINDOW_PERIOD px with a Bowser banner hanging between, and iron sconces whose flames hold
 *   still. Nothing blinks (reduce flashing). The castle tiles and the lava are SMB's.
 *
 * Palette `kingdom-level` (the backdrops' sheet; index: role):
 *   0 outline   1-3 hill green (dark, mid, light)   4-6 far hills (dark, mid, light)
 *   7-9 cloud (shade, white, rim)   a-c bush (dark, mid, light)   d sky   e horizon
 *   f-g castle stone (light, shade)   h-j red (dark, mid, light)   k pink   l gold
 *   m-o keep wall (dark, mid, light)   p night   q moon   r-s banner (red, dark)   t white
 *   u flame orange   v flame yellow   w iron
 */
export const KINGDOM_LEVEL_PALETTE: readonly string[] = [
  '#1c1410', // 0
  '#1e7a2c', // 1 hill dark
  '#3cae44', // 2 hill
  '#8ad85c', // 3 hill light
  '#3c8c84', // 4 far hill dark
  '#5cb0a0', // 5 far hill
  '#90d4c0', // 6 far hill light
  '#a8c8f0', // 7 cloud shade
  '#fcfcfc', // 8 cloud
  '#6898d8', // 9 cloud rim
  '#106c28', // a bush dark
  '#30a040', // b bush
  '#7cd858', // c bush light
  '#5c94fc', // d sky (SMB's own blue)
  '#94c4fc', // e horizon
  '#f4f0ec', // f castle stone
  '#c0bcc8', // g castle stone shade
  '#901c18', // h red dark
  '#dc3a28', // i red
  '#fa7c5c', // j red light
  '#f8a8c8', // k pink
  '#f8c830', // l gold
  '#1c2030', // m keep wall dark
  '#2c3448', // n keep wall
  '#40506a', // o keep wall light
  '#0c1030', // p night
  '#f8e8a0', // q moon
  '#b82018', // r banner
  '#681010', // s banner dark
  '#fcfcfc', // t white
  '#f08830', // u flame
  '#f8d850', // v flame light
  '#585868', // w iron
];

export const kingdomLevelPalettes: Record<string, string[]> = { 'kingdom-level': [...KINGDOM_LEVEL_PALETTE] };

/** The `kingdom` level look's sky and its pale horizon band (world/theme-backdrop.ts). */
export const KINGDOM_SKY = KINGDOM_LEVEL_PALETTE[13] as string;
export const KINGDOM_HORIZON = KINGDOM_LEVEL_PALETTE[14] as string;
/** 1-4's keep: a window and a banner every this many px of the level. */
export const KEEP_WINDOW_PERIOD = 128;

type Rows = string[];

const paint = (w: number, h: number, fn: (c: Canvas) => void): Rows => {
  const c = new Canvas(w, h);
  fn(c);
  return c.rows();
};

/* ------------------------------------------------------------------ `kingdom`: the far hills */

/** Peach's Castle far off on its hill, small and hazy. */
function farCastle(): Rows {
  return paint(40, 34, (c) => {
    const cone = (cx: number, top: number, h: number, hw: number) => {
      for (let y = top; y <= top + h; y++) {
        const w = (hw * (y - top)) / h;
        for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w) - 1; x++) c.set(x, y, x < cx ? 'j' : 'i');
      }
      c.set(cx, top - 1, 'l');
      c.set(cx, top - 2, 'l');
    };
    c.rect(4, 18, 32, 16, 'f');
    c.rect(26, 18, 10, 16, 'g');
    c.rect(12, 9, 16, 12, 'f');
    c.rect(22, 9, 6, 12, 'g');
    for (let x = 4; x < 36; x += 3) c.set(x, 17, 'f');
    cone(20, 1, 9, 9);
    cone(6, 10, 8, 4);
    cone(34, 10, 8, 4);
    c.rect(18, 26, 4, 8, 'h');
    c.set(20, 14, 'k');
    c.set(19, 14, 'k');
  });
}

/** The far hills band, 256 px wide (it repeats), hazy blue-green, a castle hill in the middle. */
function farHills(): Rows {
  const castle = farCastle();
  return paint(256, 56, (c) => {
    c.each((x, y) => {
      const t = (x / 256) * Math.PI * 2;
      const hump = Math.abs(x - 128) < 40 ? 14 * Math.cos(((x - 128) / 40) * (Math.PI / 2)) : 0;
      const top = 30 - 10 * Math.sin(t * 2 + 0.7) - 5 * Math.sin(t * 5 + 1.3) - hump;
      if (y < top) return null;
      if (y < top + 1.5) return '6';
      return y > 46 ? '4' : '5';
    });
    c.paste(castle, 108, 2);
  });
}

/* ------------------------------------------------------------------ `kingdom-keep`: 1-4's wall */

/** One 128-px stretch of the keep's wall, 128×176: blocks, a tall window, a banner, sconces. */
function keepWall(): Rows {
  return paint(KEEP_WINDOW_PERIOD, 176, (c) => {
    c.each((x, y) => {
      const row = Math.floor(y / 12);
      const bx = (x + (row % 2 ? 12 : 0)) % 24;
      if (y % 12 === 11 || bx === 0) return 'm';
      if (y % 12 === 0 || bx === 1) return 'o';
      return hash(Math.floor((x + (row % 2 ? 12 : 0)) / 24), row, 5) < 0.2 ? 'm' : 'n';
    });
    // A tall arched window onto the night, a moon in one corner, a stone sill.
    const wx = 32;
    c.each((x, y) => {
      const dx = (x + 0.5 - wx) / 14;
      const inArch =
        y >= 52 && y < 126 && Math.abs(dx) <= 1 && (y >= 66 || (y - 66) ** 2 / 196 + dx * dx <= 1);
      return inArch ? 'p' : null;
    });
    c.ellipse(wx + 6, 72, 4, 4, 'q');
    c.ellipse(wx + 8, 71, 3, 3, 'p');
    const stars: [number, number][] = [
      [wx - 8, 84],
      [wx - 3, 104],
      [wx + 9, 96],
      [wx - 9, 114],
    ];
    for (const [sx, sy] of stars) c.set(sx, sy, 't');
    c.rect(wx - 16, 126, 32, 4, 'o');
    c.rect(wx - 16, 129, 32, 1, 'm');
    c.rect(wx - 1, 52, 2, 74, 'w');
    c.rect(wx - 14, 92, 28, 2, 'w');
    // Bowser's banner: deep red, a dark border, a white spiked ring (his shell's), a forked tail.
    const bx = 88;
    c.rect(bx - 12, 50, 24, 3, 'w');
    c.each((x, y) => {
      if (x < bx - 10 || x > bx + 9 || y < 53 || y > 120) return null;
      if (y > 110 && Math.abs(x + 0.5 - bx) < (y - 110) * 0.9) return null;
      return x === bx - 10 || x === bx + 9 ? 's' : 'r';
    });
    c.ellipse(bx, 78, 7, 7, (_x, _y, d) => (d > 0.55 ? 't' : 'r'));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      c.set(Math.round(bx + Math.cos(a) * 9), Math.round(78 + Math.sin(a) * 9), 't');
    }
    // Two iron sconces; their flames hold still.
    for (const sx of [64, 116]) {
      c.rect(sx - 2, 96, 5, 3, 'w');
      c.rect(sx, 99, 1, 6, 'w');
      c.ellipse(sx + 0.5, 92, 3, 5, (_x, y) => (y > 92 ? 'u' : 'v'));
    }
  });
}

/** The backdrops' sheet (`kingdom-level`): the far hills and the keep's wall. */
export const kingdomLevelDef: SpriteDef = {
  palette: 'kingdom-level',
  frames: { 'far-hills': farHills(), 'keep-wall': keepWall() },
};

/* ------------------------------------------------------------------ `kingdom`: the level's decor */

/**
 * `decor-kingdom`, in the decor sheet's roles (decor.ts): 0 outline, 1-3 hill and bush greens
 * (dark, main, light), 4 cloud white, 5 cloud shade, 6-a the castle and wood as SMB's.
 */
export const kingdomDecorPalette: string[] = [
  '#1c1410',
  '#1e7a2c',
  '#3cae44',
  '#8ad85c',
  NES.white,
  '#a8c8f0',
  NES.brownDark,
  NES.orangeBrown,
  NES.tanDark,
  NES.brown,
  NES.brownLight,
];

/** A rounded hill `w` wide, `h` tall: soft bands, a light crest, a few dark dots. */
function hill(w: number, h: number): Rows {
  return paint(w, h, (c) => {
    const cx = w / 2;
    c.each((x, y) => {
      const dx = (x + 0.5 - cx) / (w / 2);
      if (Math.abs(dx) > 1) return null;
      const top = h - h * Math.sqrt(1 - dx * dx);
      if (y < top) return null;
      const depth = y - top;
      if (depth < 1) return '0';
      if (depth < 3 && dx < 0.2) return '3';
      // Soft bands across the hill, every 7 rows, following its curve a little.
      if ((y - Math.floor(Math.abs(dx) * 4)) % 7 === 0 && depth > 4) return '1';
      return '2';
    });
    for (let i = 0; i < Math.floor(w / 12); i++) {
      const x = Math.floor(cx - w * 0.3 + hash(i, w, 1) * w * 0.6);
      const y = Math.floor(h * 0.45 + hash(i, w, 2) * h * 0.4);
      if (c.get(x, y) !== '.' && c.get(x, y) !== '0') {
        c.set(x, y, '1');
        c.set(x + 1, y, '1');
        c.set(x, y - 1, '3');
      }
    }
  });
}

/** Round bushes in a cluster of `n` balls, the width of SMB's `bush-<n>`. */
function bushes(n: number): Rows {
  const w = 16 * (n + 1);
  return paint(w, 17, (c) => {
    for (let i = 0; i < n; i++) {
      const cx = 12 + i * 16 + (i % 2 ? 2 : 0);
      c.ellipse(cx, 11, 11, 9, (x, y, d) => (d > 0.82 ? '1' : x + y < cx + 6 && d < 0.5 ? '3' : '2'));
    }
    c.outline('0');
  });
}

/** A soft cloud of `n` puffs, SMB's `cloud-<n>`'s size: white, a pale blue shade underneath. */
function cloud(n: number): Rows {
  const w = 16 * (n + 1);
  return paint(w, 24, (c) => {
    for (let i = 0; i < n; i++) c.ellipse(12 + i * 16, 10, 10, 8, (_x, y) => (y > 12 ? '5' : '4'));
    c.ellipse(w / 2, 15, w / 2 - 4, 6, (x, y) => (y > 16 ? '5' : c.get(x, y) === '.' ? '4' : null));
    c.outline('5');
  });
}

/** The level's own hills, bushes and clouds redrawn for `kingdom` (decor sheet frames). */
export const kingdomDecorFrames: Record<string, Rows> = {
  'hill-big@kingdom': hill(80, 36),
  'hill-small@kingdom': hill(48, 20),
  'bush-1@kingdom': bushes(1),
  'bush-2@kingdom': bushes(2),
  'bush-3@kingdom': bushes(3),
  'cloud-1@kingdom': cloud(1),
  'cloud-2@kingdom': cloud(2),
  'cloud-3@kingdom': cloud(3),
};
