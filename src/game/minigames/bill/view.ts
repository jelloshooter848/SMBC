import type { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';
import { SCREEN_W } from '@engine/viewport';
import {
  box,
  decorSheet,
  drawBill,
  drawContra,
  hasContraFrame,
  JUNGLE_THEME,
  jungleSky,
  LAIR_THEME,
  lairSky,
  LOOK,
  tileSheet,
} from './art';
import { WADE_DEPTH, type Commando } from './commando';
import type { Paint } from './foes';
import type { Jungle } from './jungle';
import { C, COLS, LAIR_COL, LAIR_CAM, ROWS, TILE, WATER_Y } from './stage';

/*
 * Drawing a Jungle Assault frame: the jungle backdrop (or the lair's), the cells in the jungle
 * and lair themes, the set pieces, foes and pickups, Bill in Contra form, the shots, the river
 * over anything in it, and the medals.
 */

/** The deep river under the surface tiles. */
const DEEP_WATER = '#0c3c8c';

/** Whether any column of the screen is in Red Falcon's lair. */
function inLair(camX: number): boolean {
  return camX + SCREEN_W > LAIR_CAM;
}

/** The jungle behind the stage: mountains far off, canopy and palms nearer (parallax). */
export function drawBackdrop(r: Renderer, assets: AssetRegistry, camX: number): void {
  r.clear(jungleSky());
  if (camX >= LAIR_CAM) {
    r.clear(lairSky());
    return;
  }
  const decor = decorSheet(assets);
  const has = (f: string) => decor?.frames.has(`${f}@${JUNGLE_THEME}`) || decor?.frames.has(f);
  const frame = (f: string) => (decor?.frames.has(`${f}@${JUNGLE_THEME}`) ? `${f}@${JUNGLE_THEME}` : f);
  // Mountains (a quarter of the scroll).
  for (let i = -1; i < 6; i++) {
    const x = i * 64 - ((camX >> 2) % 64);
    if (decor && has('mountain')) r.sprite(decor, frame('mountain'), x, 72);
    else {
      r.rect(x + 8, 92, 48, 12, '#0c3018');
      r.rect(x + 20, 80, 24, 12, '#0c3018');
    }
  }
  // Canopy along the top and palms (half the scroll).
  for (let i = -1; i < 10; i++) {
    const x = i * 32 - ((camX >> 1) % 32);
    if (decor && has('canopy')) r.sprite(decor, frame('canopy'), x, 0);
    else r.rect(x, 0, 32, 10 + ((i * 7) & 7), '#0c2c10');
  }
  for (let i = -1; i < 5; i++) {
    const wx = i * 96 - ((camX >> 1) % 96) + 24;
    if (decor && has('palm')) r.sprite(decor, frame('palm'), wx, 56);
    else {
      r.rect(wx + 14, 64, 4, 40, '#1c3c10');
      r.rect(wx + 2, 58, 28, 6, '#1c5c18');
    }
  }
  if (inLair(camX)) r.rect(LAIR_CAM - camX, 0, SCREEN_W, 240, lairSky());
}

/** The tile frame a cell draws as (by the shared tile names), or null for none. */
function cellFrame(j: Jungle, col: number, row: number, c: number, t: number): string | null {
  switch (c) {
    case C.LEDGE:
      return 'tree-top';
    case C.ROCK:
      return 'ground';
    case C.BASE:
      return col >= 188 && col < LAIR_COL ? 'hard' : j.cell(col, row - 1) === C.BASE ? 'ground' : 'tree-top';
    case C.WATER:
      return `water-${(t >> 4) & 1}`;
    case C.LAIR_FLOOR:
      return 'ground';
    case C.LAIR_WALL:
      return 'wall';
    case C.LAIR_FLESH:
      return 'hard';
    default:
      return null;
  }
}

/** The cells on screen; the river's cells only when `river` (they go over Bill). */
export function drawCells(r: Renderer, assets: AssetRegistry, j: Jungle, t: number, river: boolean): void {
  const camX = Math.floor(j.camX);
  const first = Math.max(0, camX >> 4);
  const last = Math.min(COLS - 1, (camX + SCREEN_W) >> 4);
  const jungle = tileSheet(assets, JUNGLE_THEME);
  const lair = tileSheet(assets, LAIR_THEME);
  for (let row = 0; row < ROWS; row++)
    for (let col = first; col <= last; col++) {
      const c = j.cell(col, row);
      const water = c === C.WATER || c === C.DEEP;
      if (water !== river || c === C.AIR || c === C.BRIDGE) continue;
      const x = col * TILE - camX;
      const y = row * TILE;
      if (c === C.DEEP) {
        r.rect(x, y, TILE, TILE, DEEP_WATER);
        continue;
      }
      const name = cellFrame(j, col, row, c, t);
      if (!name) continue;
      const { sheet, theme } = col >= LAIR_COL ? lair : jungle;
      if (!sheet) {
        box(r, x, y, TILE, TILE, c === C.WATER ? ['#2038ec', '#3c74e4'] : ['#203c00', '#58a028']);
        continue;
      }
      const themed = `${name}@${theme}`;
      if (sheet.frames.has(themed)) r.sprite(sheet, themed, x, y);
      else if (sheet.frames.has(name)) r.sprite(sheet, name, x, y);
      else r.rect(x, y, TILE, TILE, c === C.WATER ? '#2038ec' : '#203c00');
    }
}

/** Bill's frame and how it is drawn (his own sheet; the contra sheet's death flip if it has one). */
export function billFrame(b: Commando): { sheet: 'bill' | 'contra'; frame: string; flipY: boolean } {
  if (b.state === 'dead') {
    if (b.flat) return { sheet: 'contra', frame: 'bill-death-3', flipY: false };
    const step = Math.min(2, b.deathT >> 3);
    return { sheet: 'contra', frame: `bill-death-${step}`, flipY: false };
  }
  if (b.state === 'climb') return { sheet: 'bill', frame: 'walk-1', flipY: false };
  if (b.state === 'air') {
    if (b.spin) return { sheet: 'bill', frame: `spin-${(b.t >> 2) & 3}`, flipY: false };
    return { sheet: 'bill', frame: 'walk-1', flipY: false };
  }
  const a = b.aim;
  if (b.state === 'water') {
    if (a.y < 0) return { sheet: 'bill', frame: a.x === 0 ? 'aim-up' : 'aim-diag-up', flipY: false };
    return { sheet: 'bill', frame: b.shootPose > 0 ? 'shoot' : 'idle', flipY: false };
  }
  if (b.prone) return { sheet: 'bill', frame: 'prone', flipY: false };
  if (a.y < 0) return { sheet: 'bill', frame: a.x === 0 ? 'aim-up' : 'aim-diag-up', flipY: false };
  if (a.y > 0) return { sheet: 'bill', frame: 'aim-diag-down', flipY: false };
  if (b.running) return { sheet: 'bill', frame: `walk-${(b.walkT >> 3) % 3}`, flipY: false };
  return { sheet: 'bill', frame: b.shootPose > 0 ? 'shoot' : 'idle', flipY: false };
}

/** Bill in Contra form. */
export function drawCommando(p: Paint, b: Commando): void {
  if (b.state === 'gone') return;
  // Blinking after a drop-in (steady with reduce flashing).
  if (b.invuln > 0 && !p.rf && (b.invuln & 4) !== 0) return;
  if (b.state === 'water' && b.dive) {
    const x = Math.round(b.x - p.camX);
    p.r.rect(x - 6, WATER_Y - 1, 4, 2, '#fcfcfc');
    p.r.rect(x + 3, WATER_Y - 1, 4, 2, '#fcfcfc');
    return;
  }
  const x = b.x - 8 - p.camX;
  const y = b.y - 32;
  const flip = b.facing < 0;
  const f = billFrame(b);
  if (f.sheet === 'contra') {
    if (hasContraFrame(p.assets, f.frame)) {
      // (32 wide, Bill centred, feet on the bottom row; thrown back away from where he faced)
      drawContra(p.r, p.assets, f.frame, b.x - 16 - p.camX, y, 32, 32, LOOK.bill, flip);
      return;
    }
    // Without the sheet's flip: his own frames, thrown back and tumbling, then flat.
    const frame = b.flat ? 'die' : b.deathT < 6 ? 'hurt' : `spin-${(b.deathT >> 2) & 3}`;
    if (!drawBill(p.r, p.assets, frame, x, y, flip))
      box(p.r, x + 2, b.flat ? b.y - 8 : y + 8, 12, b.flat ? 8 : 24, LOOK.bill);
    return;
  }
  const palette = b.barrier > 0 ? `bill-star-${p.rf ? 0 : (p.t >> 1) & 3}` : undefined;
  if (!drawBillIn(p, f.frame, x, y, flip, palette)) {
    const h = b.prone ? 8 : b.spin ? 14 : 24;
    box(p.r, x + 3, b.y - h - (b.spin ? 4 : 0), 10, h, LOOK.bill);
  }
}

function drawBillIn(p: Paint, frame: string, x: number, y: number, flip: boolean, palette?: string): boolean {
  if (!palette) return drawBill(p.r, p.assets, frame, x, y, flip);
  try {
    if (!p.assets.has('bill')) return false;
    const sheet = p.assets.sheet('bill', palette);
    if (!sheet.frames.has(frame)) return false;
    p.r.sprite(sheet, frame, Math.round(x), Math.round(y), flip);
    return true;
  } catch {
    return drawBill(p.r, p.assets, frame, x, y, flip);
  }
}

/** Bill's shots and the foes'. */
export function drawShots(p: Paint, j: Jungle): void {
  for (const s of j.shots) {
    const x = s.x - p.camX;
    if (s.gun === 'L') {
      // The laser: a beam trailing back along its line.
      const len = 16;
      const sp = Math.hypot(s.vx, s.vy) || 1;
      const ux = s.vx / sp;
      const uy = s.vy / sp;
      if (hasContraFrame(p.assets, 'laser') && uy === 0)
        drawContra(p.r, p.assets, 'laser', x - (ux > 0 ? len : 0), s.y - 2, 16, 4, LOOK.laser, ux < 0);
      else
        for (let i = 0; i < len; i += 2)
          p.r.rect(Math.round(x - ux * i) - 1, Math.round(s.y - uy * i) - 1, 3, 3, LOOK.laser[1]);
      continue;
    }
    const frame =
      s.gun === 'S'
        ? 'spread-ball'
        : s.gun === 'F'
          ? 'fire-ring'
          : s.gun === 'M'
            ? 'bullet-big'
            : 'bullet-small';
    const look = s.gun === 'S' ? LOOK.spread : s.gun === 'F' ? LOOK.fire : LOOK.bullet;
    const size = s.gun === 'F' || s.gun === 'S' ? 8 : s.gun === 'M' ? 6 : 4;
    drawContra(p.r, p.assets, frame, x - size / 2, s.y - size / 2, size, size, look);
  }
  for (const s of j.foeShots) {
    const size = s.kind === 'shell' ? 6 : 4;
    drawContra(
      p.r,
      p.assets,
      s.kind === 'shell' ? 'bullet-big' : 'enemy-bullet',
      s.x - size / 2 - p.camX,
      s.y - size / 2,
      size,
      size,
      LOOK.enemyBullet,
    );
  }
}

/** Contra's lives display: a medal for each life in reserve, top left (at most MEDALS_SHOWN). */
export const MEDALS_SHOWN = 4;
export function drawMedals(r: Renderer, assets: AssetRegistry, rest: number): void {
  for (let i = 0; i < Math.min(MEDALS_SHOWN, rest); i++)
    drawContra(r, assets, 'medal', 16 + i * 12, 16, 8, 16, LOOK.medal);
}

/** A whole frame of the stage (everything but the scene's texts). */
export function drawJungle(p: Paint, j: Jungle): void {
  drawBackdrop(p.r, p.assets, p.camX);
  drawCells(p.r, p.assets, j, p.t, false);
  for (const t of j.things) if (t.alive && t.back) t.render(p, j);
  for (const t of j.things) if (t.alive && !t.back && t.kind !== 'boom') t.render(p, j);
  drawCommando(p, j.bill);
  drawShots(p, j);
  drawCells(p.r, p.assets, j, p.t, true);
  if (j.bill.state === 'water' && j.bill.dive) drawCommando(p, j.bill);
  for (const t of j.things) if (t.alive && t.kind === 'boom') t.render(p, j);
  drawMedals(p.r, p.assets, j.rest);
}

/** Where Bill's feet are while he wades (tests). */
export const WADE_FEET = WATER_Y + WADE_DEPTH;
