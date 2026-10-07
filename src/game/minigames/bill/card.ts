import type { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';
import { SCREEN_W } from '@engine/viewport';
import { drawContra, hasContraFrame } from './art';

/*
 * The Contra-style stage card before the round: a small island map with the route drawn to
 * the first stage, STAGE 1 / JUNGLE, REST (the lives in reserve, as Contra's card shows them)
 * and a short briefing. Entering the Konami code here gives 30 lives (scene.ts).
 */

/** Route dots on the island map (px from its top-left), drawn one every ROUTE_STEP frames. */
export const ROUTE: readonly [number, number][] = [
  [4, 44],
  [10, 42],
  [16, 41],
  [22, 40],
  [28, 40],
  [33, 37],
  [37, 33],
  [42, 31],
  [48, 31],
];
export const ROUTE_STEP = 8;
/** The briefing, typed out a letter every TYPE_STEP frames from TYPE_AT. */
export const BRIEFING: readonly string[] = [
  "RED FALCON'S ALIENS HAVE",
  "TAKEN BILL'S MIND.",
  'FIGHT THROUGH THE JUNGLE',
  'TO THE ALIEN HEART!',
];
export const TYPE_AT = 24;
export const TYPE_STEP = 2;
/** Frames until the card has drawn everything (SKIP jumps there). */
export const CARD_ANIM = TYPE_AT + BRIEFING.join('').length * TYPE_STEP;
/** The card starts the stage by itself after this long. */
export const CARD_AUTO = 1200;
/** The island map's place and size. */
export const MAP_X = 80;
export const MAP_Y = 36;
export const MAP_W = 96;
export const MAP_H = 64;

/** The lines of the briefing shown `t` frames into the card. */
export function typed(t: number): string[] {
  let n = Math.max(0, Math.floor((t - TYPE_AT) / TYPE_STEP));
  const out: string[] = [];
  for (const line of BRIEFING) {
    if (n <= 0) break;
    out.push(line.slice(0, n));
    n -= line.length;
  }
  return out;
}

/** The card: `t` frames in (CARD_ANIM or more: all drawn), `rest` lives in reserve, the prompt. */
export function drawCard(
  r: Renderer,
  assets: AssetRegistry,
  t: number,
  rest: number,
  prompt: string,
  konami: boolean,
): void {
  const font = assets.sheet('font');
  r.clear('#000000');
  r.text(font, '1P', 24, 16);
  r.text(font, `REST ${rest}`, 24, 28);
  if (konami) r.text(font, '30 LIVES!', SCREEN_W - 24 - 9 * 8, 16);
  // The island.
  if (hasContraFrame(assets, 'card-island'))
    drawContra(r, assets, 'card-island', MAP_X, MAP_Y, MAP_W, MAP_H, ['#000000', '#000000']);
  else drawIsland(r);
  const dots = Math.min(ROUTE.length, Math.floor(t / ROUTE_STEP) + 1);
  for (let i = 0; i < dots; i++) {
    const [dx, dy] = ROUTE[i] as [number, number];
    if (hasContraFrame(assets, 'card-route'))
      drawContra(r, assets, 'card-route', MAP_X + dx - 2, MAP_Y + dy - 2, 4, 4, ['#fcfcfc', '#fcfcfc']);
    else r.rect(MAP_X + dx - 1, MAP_Y + dy - 1, 2, 2, '#fcfcfc');
  }
  if (dots === ROUTE.length) {
    const [dx, dy] = ROUTE[ROUTE.length - 1] as [number, number];
    r.rect(MAP_X + dx - 2, MAP_Y + dy - 2, 5, 5, '#f83800');
  }
  r.text(font, 'STAGE 1', (SCREEN_W - 7 * 8) >> 1, 112);
  r.text(font, 'JUNGLE', (SCREEN_W - 6 * 8) >> 1, 124);
  typed(t).forEach((line, i) => r.text(font, line, 24, 148 + i * 12));
  r.text(font, prompt, SCREEN_W - 16 - prompt.length * 8, 212);
}

/** The island in plain shapes (until the sheet has `card-island`): sea, jungle, the base. */
function drawIsland(r: Renderer): void {
  r.rect(MAP_X, MAP_Y, MAP_W, MAP_H, '#0c2c6c');
  const land: [number, number, number, number][] = [
    [8, 26, 76, 26],
    [14, 16, 64, 12],
    [24, 10, 40, 8],
    [20, 50, 52, 8],
  ];
  for (const [x, y, w, h] of land) r.rect(MAP_X + x, MAP_Y + y, w, h, '#1c6c1c');
  r.rect(MAP_X + 56, MAP_Y + 18, 12, 8, '#7c7c7c');
}
