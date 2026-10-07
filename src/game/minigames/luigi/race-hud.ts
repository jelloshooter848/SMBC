import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { SCREEN_W } from '@engine/viewport';

/**
 * Chunky 5×7 glyphs for the start's "GO!", drawn with rectangles so they can be big without a
 * scaled font. Original shapes.
 */
const GLYPHS: Record<string, readonly string[]> = {
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
};

const SCALE = 4;
const GLYPH_W = 5 * SCALE;
const GAP = SCALE * 2;

/** Big text ("GO!") centred on (cx, y): a dark drop shadow under each cell, then the colour. */
export function drawBigText(r: Renderer, text: string, cx: number, y: number, color: string): void {
  const w = text.length * GLYPH_W + (text.length - 1) * GAP;
  let x = Math.round(cx - w / 2);
  for (const ch of text) {
    const rows = GLYPHS[ch];
    if (rows) {
      for (const pass of [0, 1])
        rows.forEach((row, gy) => {
          for (let gx = 0; gx < row.length; gx++) {
            if (row[gx] !== '#') continue;
            const off = pass === 0 ? 2 : 0;
            r.rect(x + gx * SCALE + off, y + gy * SCALE + off, SCALE, SCALE, pass === 0 ? '#000' : color);
          }
        });
    }
    x += GLYPH_W + GAP;
  }
}

/** A line of the bitmap font on a dark band, centred. */
export function drawBanner(r: Renderer, font: SpriteSheet, text: string, y: number): void {
  const w = text.length * 8;
  const x = (SCREEN_W - w) >> 1;
  r.rect(x - 8, y - 6, w + 16, 20, 'rgba(0,0,0,0.75)');
  r.text(font, text, x, y);
}

/** Track colours: Mario's red, the rival's purple (his suit, content/sprites/mario.ts). */
export const MARIO_COLOR = '#f83800';
export const RIVAL_COLOR = '#9878f8';

const TRACK_X0 = 48;
const TRACK_X1 = 192;
/** The flag stands clear of the track's end, so a marker at 100% never covers it. */
const FLAG_X = TRACK_X1 + 7;
/** Under the SMB HUD's two rows (y 8-23): Mario's marker clears them, the rival's hangs below. */
export const TRACK_Y = 40;

/**
 * The race track under the HUD: start to flag, Mario's marker above the line and the rival's
 * below, each placed by how far along the course (0..1) the racer is.
 */
export function drawTrack(r: Renderer, font: SpriteSheet, mario: number, rival: number): void {
  r.rect(TRACK_X0 - 2, TRACK_Y - 1, TRACK_X1 - TRACK_X0 + 4, 3, '#000');
  r.rect(TRACK_X0, TRACK_Y, TRACK_X1 - TRACK_X0, 1, '#fcfcfc');
  // The flag at the far end.
  r.rect(FLAG_X, TRACK_Y - 12, 1, 13, '#fcfcfc');
  r.rect(FLAG_X + 1, TRACK_Y - 12, 7, 5, '#00a800');
  const at = (f: number) => TRACK_X0 + Math.round(Math.max(0, Math.min(1, f)) * (TRACK_X1 - TRACK_X0));
  marker(r, font, 'M', at(mario), TRACK_Y - 11, MARIO_COLOR);
  marker(r, font, 'L', at(rival), TRACK_Y + 3, RIVAL_COLOR);
}

function marker(r: Renderer, font: SpriteSheet, letter: string, cx: number, y: number, color: string): void {
  r.rect(cx - 5, y - 1, 10, 10, '#000');
  r.rect(cx - 4, y, 8, 8, color);
  r.text(font, letter, cx - 4, y);
}

/**
 * The rival is off screen: an arrow at that edge, at his height, with his name beside it, so the
 * player always knows where he is.
 */
export function drawOffscreenArrow(r: Renderer, font: SpriteSheet, side: -1 | 1, y: number): void {
  const yy = Math.max(TRACK_Y + 16, Math.min(200, y));
  const tipX = side > 0 ? SCREEN_W - 3 : 2;
  for (let i = 0; i < 5; i++) {
    const x = side > 0 ? tipX - i : tipX + i;
    r.rect(x, yy + 4 - i, 1, i * 2 + 1, RIVAL_COLOR);
  }
  const label = 'LUIGI';
  const lx = side > 0 ? tipX - 8 - label.length * 8 : tipX + 8;
  r.rect(lx - 1, yy - 1, label.length * 8 + 2, 10, 'rgba(0,0,0,0.6)');
  r.text(font, label, lx, yy);
}
