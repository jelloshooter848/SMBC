/**
 * DESIGN MOCKUP storyboard (not the game). Opened by tools/mockups/classic/render.mjs through Vite; draws
 * hand-posed 256x240 frames of a 1-1-like scene with the game's own tile, enemy, item and font art plus
 * the draft hero sprites in this folder, scales them 3x and hands PNG data URLs back to the script.
 * Nothing under src/ imports this file.
 */
import { PALETTES, SPRITES } from '@content/sprites';
import { rasterizeToBuffer, validateDef, type SpriteDef } from '@engine/gfx/pixelart';
import { peachDef, peachItemPalette, peachItemsDef, peachPalettes } from './peach';
import { arthurDef, arthurFxDef, arthurFxPalette, arthurPalettes } from './arthur';

const W = 256;
const H = 240;
const SCALE = 3;
const GROUND = 208;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Sheet {
  canvas: HTMLCanvasElement;
  frames: Map<string, Rect>;
}

const MOCK_DEFS: Record<string, SpriteDef> = {
  peach: peachDef,
  'peach-items': peachItemsDef,
  arthur: arthurDef,
  'arthur-fx': arthurFxDef,
};
const MOCK_PALETTES: Record<string, readonly string[]> = {
  ...peachPalettes,
  'peach-items': peachItemPalette,
  ...arthurPalettes,
  'arthur-fx': arthurFxPalette,
};
for (const [name, def] of Object.entries(MOCK_DEFS)) validateDef(name, def);

function paletteOf(name: string): readonly string[] {
  const p = MOCK_PALETTES[name] ?? PALETTES.default[name];
  if (!p) throw new Error(`no palette ${name}`);
  return p;
}

const sheets = new Map<string, Sheet>();
function sheetFor(id: string, palette?: string): Sheet {
  const def = MOCK_DEFS[id] ?? SPRITES[id];
  if (!def) throw new Error(`no sprite sheet ${id}`);
  const palName = palette ?? def.palette;
  const key = `${id}/${palName}`;
  const hit = sheets.get(key);
  if (hit) return hit;
  const r = rasterizeToBuffer(def, paletteOf(palName));
  const canvas = document.createElement('canvas');
  canvas.width = r.width;
  canvas.height = r.height;
  const c = canvas.getContext('2d') as CanvasRenderingContext2D;
  const img = c.createImageData(r.width, r.height);
  img.data.set(r.data);
  c.putImageData(img, 0, 0);
  const made = { canvas, frames: r.frames };
  sheets.set(key, made);
  return made;
}

interface DrawOpts {
  palette?: string;
  flip?: boolean;
  flipV?: boolean;
  alpha?: number;
}

class Scene {
  readonly canvas = document.createElement('canvas');
  readonly ctx: CanvasRenderingContext2D;
  constructor(bg = '#5c94fc') {
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.fillStyle = bg;
    this.ctx.fillRect(0, 0, W, H);
  }
  spr(id: string, frame: string, x: number, y: number, o: DrawOpts = {}): void {
    const s = sheetFor(id, o.palette);
    const r = s.frames.get(frame);
    if (!r) throw new Error(`no frame ${id}:${frame}`);
    const c = this.ctx;
    c.save();
    c.globalAlpha = o.alpha ?? 1;
    c.translate(Math.round(x) + (o.flip ? r.w : 0), Math.round(y) + (o.flipV ? r.h : 0));
    c.scale(o.flip ? -1 : 1, o.flipV ? -1 : 1);
    c.drawImage(s.canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    c.restore();
  }
  /** The sprite's bottom-left at (x, bottom). */
  stand(id: string, frame: string, x: number, bottom: number, o: DrawOpts = {}): void {
    const r = sheetFor(id, o.palette).frames.get(frame);
    if (!r) throw new Error(`no frame ${id}:${frame}`);
    this.spr(id, frame, x, bottom - r.h, o);
  }
  tile(name: string, tx: number, ty: number, palette?: string): void {
    this.spr('tiles', name, tx * 16, ty * 16, palette ? { palette } : {});
  }
  ground(holes: number[] = [], palette?: string): void {
    for (let tx = 0; tx < 16; tx++) {
      if (holes.includes(tx)) continue;
      this.tile('ground', tx, 13, palette);
      this.tile('ground', tx, 14, palette);
    }
  }
  pipe(tx: number, topTy: number): void {
    this.tile('pipe-top-left', tx, topTy);
    this.tile('pipe-top-right', tx + 1, topTy);
    for (let ty = topTy + 1; ty < 13; ty++) {
      this.tile('pipe-body-left', tx, ty);
      this.tile('pipe-body-right', tx + 1, ty);
    }
  }
  decor(name: string, x: number, bottom: number): void {
    this.stand('decor', name, x, bottom);
  }
  scenery(): void {
    this.decor('hill-big', 0, GROUND);
    this.decor('cloud-1', 56, 88);
    this.decor('cloud-2', 176, 72);
    this.decor('bush-2', 184, GROUND);
  }
  text(str: string, x: number, y: number, palette = 'font'): void {
    const font = sheetFor('font', palette);
    [...str].forEach((ch, i) => {
      const r = font.frames.get(ch) ?? font.frames.get(ch.toUpperCase());
      if (!r) return;
      this.ctx.drawImage(font.canvas, r.x, r.y, r.w, r.h, x + i * 8, y, r.w, r.h);
    });
  }
  hud(name: string, extra?: (s: Scene) => void): void {
    this.text(name, 24, 8);
    this.text('WORLD', 144, 8);
    this.text('TIME', 200, 8);
    this.text('004200', 24, 16);
    this.text('1-1', 152, 16);
    this.text('377', 208, 16);
    extra?.(this);
  }
  dot(x: number, y: number, colour = '#fcfcfc'): void {
    this.ctx.fillStyle = colour;
    this.ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
  }
  arrow(x0: number, y0: number, x1: number, y1: number): void {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 6));
    for (let i = 0; i <= n; i++) this.dot(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n);
    const a = Math.atan2(y1 - y0, x1 - x0);
    for (const s of [-1, 1]) this.dot(x1 - Math.cos(a + s * 0.6) * 5, y1 - Math.sin(a + s * 0.6) * 5);
  }
  scaled(): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width = W * SCALE;
    out.height = H * SCALE;
    const c = out.getContext('2d') as CanvasRenderingContext2D;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.canvas, 0, 0, W * SCALE, H * SCALE);
    return out;
  }
}

/* ---------------- Princess Peach ---------------- */

type Board = { file: string; caption: string; draw: (s: Scene) => void }[];

function peachHud(s: Scene, power?: 'mushroom' | 'flower'): void {
  s.hud('PEACH', (sc) => {
    if (power) sc.spr('items', power === 'mushroom' ? 'mushroom' : 'flower-0', 104, 20);
  });
}
function peach(s: Scene, frame: string, x: number, bottom = GROUND, o: DrawOpts = {}): void {
  s.stand('peach', frame, x, bottom, o);
}
function item(s: Scene, frame: string, x: number, y: number, o: DrawOpts = {}): void {
  s.spr('peach-items', frame, x, y, o);
}
/** Dots along a ballistic path: start (x, y), speeds in px/f, gravity in px/f², every `step` frames. */
function path(s: Scene, x: number, y: number, vx: number, vy: number, g: number, frames: number, step = 3): void {
  for (let f = 0; f <= frames; f += step) s.dot(x + vx * f, y + vy * f + (g * f * f) / 2);
}

const PEACH_FRAMES: Board = [
  {
    file: 'peach-01-stand',
    caption:
      'Peach (Classic extra, second select row). Mushroom state: 12x24 body. Walks and runs like Classic Mario (RUN on ATTACK), jumps a little lower.',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.tile('brick', 7, 9);
      s.tile('question-0', 8, 9);
      s.tile('brick', 9, 9);
      peachHud(s, 'mushroom');
      peach(s, 'stand', 64);
      s.stand('enemies', 'goomba-0', 200, GROUND);
    },
  },
  {
    file: 'peach-02-walk',
    caption:
      'Walk 1.458 px/f, run 2.5 px/f with the plumber inertia. Standing jump 65 px (Mario 67), running jump 75 px.',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.pipe(12, 9);
      peachHud(s, 'mushroom');
      peach(s, 'walk-1', 40, GROUND, { alpha: 0.35 });
      peach(s, 'walk-0', 64);
      path(s, 120, GROUND - 16, 2.5, -3.333, 0.2083, 32, 2);
      peach(s, 'jump', 150, GROUND - 74);
    },
  },
  {
    file: 'peach-03-float',
    caption:
      'FLOAT: hold JUMP once she starts to fall and she hovers level for up to 90 frames (1.5 s), steering freely. Once per jump.',
    draw: (s) => {
      s.scenery();
      s.ground([7, 8, 9, 10]);
      peachHud(s, 'mushroom');
      path(s, 40, GROUND - 16, 1.458, -3.333, 0.2083, 16, 2);
      for (let x = 64; x <= 160; x += 6) s.dot(x, 128);
      path(s, 166, 128, 1.458, 0, 0.2083, 14, 2);
      peach(s, 'float-0', 96, 146, { alpha: 0.35 });
      peach(s, 'float-1', 140, 146);
    },
  },
  {
    file: 'peach-04-pluck',
    caption:
      'LIFT on plain ground: she plucks a turnip (20 frames, rooted; 10 with the Flower). Ground, hard blocks, tree and mushroom tops only.',
    draw: (s) => {
      s.scenery();
      s.ground();
      peachHud(s);
      peach(s, 'lift', 80);
      item(s, 'turnip', 92, GROUND - 12);
      item(s, 'sprout', 150, GROUND - 4);
      s.text('PLUCK', 72, 150, 'font-gold');
    },
  },
  {
    file: 'peach-05-throw-veg',
    caption:
      'ATTACK while carrying throws: 4 px/f forward, a low arc. 400 damage: 1 Goomba, 2 Koopa. Breaks a brick, bumps a ? block.',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.tile('brick', 13, 10);
      peachHud(s, 'mushroom');
      peach(s, 'throw', 48);
      path(s, 70, GROUND - 26, 4, -1, 0.125, 18, 2);
      item(s, 'turnip', 140, GROUND - 32);
      s.stand('enemies', 'goomba-0', 176, GROUND, { flipV: true, alpha: 0.8 });
      s.stand('enemies', 'koopa-0', 220, GROUND);
    },
  },
  {
    file: 'peach-06-ride',
    caption:
      'Peach never stomps and is not hurt landing on a Goomba, Koopa, Buzzy, Bullet Bill or Hammer Bro: she stands on it and rides along.',
    draw: (s) => {
      s.scenery();
      s.ground();
      peachHud(s, 'mushroom');
      s.stand('enemies', 'koopa-1', 96, GROUND);
      peach(s, 'stand', 96, GROUND - 24);
      s.arrow(96, GROUND + 6, 74, GROUND + 6);
      s.stand('enemies', 'spiny-0', 196, GROUND);
      s.text('HURTS', 186, 168);
    },
  },
  {
    file: 'peach-07-lift-enemy',
    caption: 'LIFT while standing on one picks it up over her head. Carrying: no run, jumps 57 / 67 px, float still works.',
    draw: (s) => {
      s.scenery();
      s.ground();
      peachHud(s, 'mushroom');
      peach(s, 'carry', 80);
      s.stand('enemies', 'goomba-1', 80, GROUND - 31);
      peach(s, 'carry-walk', 150, GROUND, { alpha: 0.35 });
      s.stand('enemies', 'goomba-1', 150, GROUND - 31, { alpha: 0.35 });
    },
  },
  {
    file: 'peach-08-throw-enemy',
    caption:
      'A thrown enemy flies 3.5 px/f and kills the first enemy it meets outright (armour too, like a kicked shell); both fall off screen.',
    draw: (s) => {
      s.scenery();
      s.ground();
      peachHud(s, 'mushroom');
      peach(s, 'throw', 40);
      path(s, 62, GROUND - 36, 3.5, -1, 0.125, 24, 2);
      s.stand('enemies', 'goomba-1', 150, GROUND - 26, { flipV: true });
      s.stand('enemies', 'buzzy-0', 168, GROUND, { flipV: true, alpha: 0.8 });
      s.stand('enemies', 'koopa-0', 220, GROUND);
    },
  },
  {
    file: 'peach-09-brick',
    caption:
      'Owner decision: LIFT on a plain brick pulls it out (like SMB2 mushroom blocks, our Super Arm code). Thrown: 400, breaks on impact.',
    draw: (s) => {
      s.scenery();
      s.ground();
      for (let tx = 3; tx <= 9; tx++) if (tx !== 6) s.tile('brick', tx, 10);
      peachHud(s, 'flower');
      peach(s, 'carry', 96, 160, { palette: 'peach-flower' });
      s.tile('brick', 6, 7);
      s.stand('enemies', 'goomba-0', 200, GROUND);
    },
  },
  {
    file: 'peach-10-power',
    caption:
      'Power states: small (12x16, one hit kills), Mushroom (grows, survives one hit), Fire Flower = white dress, quick pluck, piercing turnips.',
    draw: (s) => {
      s.scenery();
      s.ground();
      peachHud(s, 'flower');
      peach(s, 'small-stand', 40);
      peach(s, 'stand', 104);
      peach(s, 'stand', 168, GROUND, { palette: 'peach-flower' });
      s.text('SMALL', 28, 214);
      s.text('MUSHROOM', 84, 226);
      s.text('FLOWER', 152, 214);
    },
  },
  {
    file: 'peach-11-rare',
    caption:
      'Rare plucks: 1 in 32 a POW block (thrown, it lands with a jolt: every grounded enemy on screen is bumped); every 6th turnip in a row, a stopwatch.',
    draw: (s) => {
      s.scenery();
      s.ground();
      peachHud(s, 'mushroom');
      peach(s, 'throw', 40);
      item(s, 'pow', 110, GROUND - 16);
      item(s, 'shock-lines', 114, GROUND - 26);
      s.stand('enemies', 'goomba-0', 170, GROUND - 10, { flipV: true });
      s.stand('enemies', 'koopa-0', 214, GROUND - 6, { flipV: true });
      item(s, 'watch', 40, 96);
      s.text('6TH', 60, 102);
    },
  },
  {
    file: 'peach-12-water',
    caption:
      'Water (SW-C2): no stroke and no float. She jumps off the floor (about 123 px); plucking and throwing work on the seabed; no riding.',
    draw: (s) => {
      s.ctx.fillStyle = '#2038ec';
      s.ctx.fillRect(0, 32, W, H);
      s.ground([], 'tiles-water');
      peachHud(s, 'mushroom');
      path(s, 64, GROUND - 16, 0.75, -2.05, 0.0347, 60, 4);
      peach(s, 'jump', 100, 120);
      s.stand('enemies', 'cheep-0', 190, 140);
      s.stand('enemies', 'blooper-0', 210, 96);
    },
  },
  {
    file: 'peach-13-hit',
    caption:
      'A hit while big or Flower: Lose Everything, freeze and shrink like Mario (150 frames see-through). She drops what she carries.',
    draw: (s) => {
      s.scenery();
      s.ground();
      peachHud(s);
      peach(s, 'hurt', 80, GROUND, { alpha: 0.5 });
      peach(s, 'small-stand', 112, GROUND, { alpha: 0.65 });
      item(s, 'turnip', 96, GROUND - 16);
      s.stand('enemies', 'goomba-0', 136, GROUND);
    },
  },
];

/* ---------------- Sir Arthur ---------------- */

const ARTHUR_ICON: Record<string, string> = { lance: 'lance', dagger: 'dagger', torch: 'torch-0', axe: 'axe-0' };
function arthurHud(s: Scene, weapon: string, power?: 'mushroom' | 'flower'): void {
  s.hud('ARTHUR', (sc) => {
    if (power) sc.spr('items', power === 'mushroom' ? 'mushroom' : 'flower-0', 104, 20);
    sc.spr('arthur-fx', ARTHUR_ICON[weapon] ?? 'lance', 24, 27);
  });
}
function arthur(s: Scene, frame: string, x: number, bottom = GROUND, o: DrawOpts = {}): void {
  s.stand('arthur', frame, x, bottom, o);
}
function fx(s: Scene, frame: string, x: number, y: number, o: DrawOpts = {}): void {
  s.spr('arthur-fx', frame, x, y, o);
}

const ARTHUR_FRAMES: Board = [
  {
    file: 'arthur-01-stand',
    caption:
      'Sir Arthur (Classic extra). Steel armour = the Mushroom state. Same 12x24 body in armour or not; Down crouches (12x16).',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.tile('brick', 7, 9);
      s.tile('question-0', 8, 9);
      arthurHud(s, 'lance', 'mushroom');
      arthur(s, 'stand', 64);
      arthur(s, 'crouch', 104);
      s.stand('enemies', 'goomba-0', 200, GROUND);
    },
  },
  {
    file: 'arthur-02-walk',
    caption: 'Walk: instant 1.25 px/f, no run. Throwing on the ground roots him for 12 frames.',
    draw: (s) => {
      s.scenery();
      s.ground();
      arthurHud(s, 'lance', 'mushroom');
      arthur(s, 'walk-1', 48, GROUND, { alpha: 0.35 });
      arthur(s, 'walk-0', 72);
      s.arrow(96, 170, 120, 170);
    },
  },
  {
    file: 'arthur-03-jump',
    caption:
      'Committed jump: a fixed 68 px arc, 52 frames. The take-off direction is kept: no steering, no turning. Standing jump goes straight up.',
    draw: (s) => {
      s.scenery();
      s.ground([9, 10]);
      arthurHud(s, 'lance', 'mushroom');
      path(s, 40, GROUND - 14, 1.25, -5.219, 0.2083, 52, 3);
      arthur(s, 'jump', 64, GROUND - 60);
      for (let y = GROUND - 14; y > GROUND - 82; y -= 6) s.dot(200, y);
      arthur(s, 'jump', 192, GROUND - 68, { alpha: 0.5 });
    },
  },
  {
    file: 'arthur-04-double',
    caption:
      'JUMP again in the air (Super Ghouls style): one second jump that takes the direction held then (or none), then commits again.',
    draw: (s) => {
      s.scenery();
      s.ground([6, 7, 8, 9, 10]);
      arthurHud(s, 'lance', 'mushroom');
      path(s, 40, GROUND - 14, 1.25, -5.219, 0.2083, 25, 3);
      path(s, 71, GROUND - 82, 1.25, -5.219, 0.2083, 56, 3);
      arthur(s, 'jump', 63, GROUND - 68, { alpha: 0.4 });
      arthur(s, 'jump', 120, GROUND - 130);
    },
  },
  {
    file: 'arthur-05-lance',
    caption: 'Lance (start weapon): 4 px/f straight, 300 damage (1 Goomba, 2 Koopa), 2 on screen, stopped by walls, breaks bricks.',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.tile('brick', 12, 10);
      arthurHud(s, 'lance', 'mushroom');
      arthur(s, 'throw', 40);
      fx(s, 'lance', 72, 182);
      fx(s, 'lance', 128, 182);
      s.stand('enemies', 'goomba-0', 176, GROUND, { flipV: true, alpha: 0.8 });
    },
  },
  {
    file: 'arthur-06-dagger',
    caption: 'Dagger: 5.5 px/f, 200 damage, 3 on screen, 8 frames between throws. Crouch throws go low.',
    draw: (s) => {
      s.scenery();
      s.ground();
      arthurHud(s, 'dagger', 'mushroom');
      arthur(s, 'crouch-throw', 40);
      fx(s, 'dagger', 72, 196);
      fx(s, 'dagger', 112, 196);
      fx(s, 'dagger', 152, 196);
      s.stand('enemies', 'goomba-1', 200, GROUND);
    },
  },
  {
    file: 'arthur-07-torch',
    caption:
      'Torch: a short lob (250); where it lands a floor fire burns 60 frames (150 a touch, every 24 f). The fire pierces armour.',
    draw: (s) => {
      s.scenery();
      s.ground();
      arthurHud(s, 'torch', 'mushroom');
      arthur(s, 'throw', 40);
      path(s, 64, GROUND - 26, 2, -2.5, 0.1667, 30, 3);
      fx(s, 'torch-1', 104, 150);
      fx(s, 'flame-0', 126, GROUND - 10);
      fx(s, 'flame-1', 142, GROUND - 10);
      s.stand('enemies', 'buzzy-1', 150, GROUND, { alpha: 0.7 });
    },
  },
  {
    file: 'arthur-08-axe',
    caption: 'Axe: an upward arc, 400 damage, through ground and through every enemy it kills; 1 on screen.',
    draw: (s) => {
      s.scenery();
      s.ground();
      arthurHud(s, 'axe', 'mushroom');
      arthur(s, 'throw', 32);
      path(s, 56, GROUND - 26, 2.5, -3.5, 0.15, 44, 3);
      fx(s, 'axe-1', 120, 128);
      s.stand('enemies', 'koopa-fly-0', 120, 150, { flipV: true, alpha: 0.8 });
      s.stand('enemies', 'goomba-0', 160, GROUND, { flipV: true, alpha: 0.8 });
    },
  },
  {
    file: 'arthur-09-armour-hit',
    caption:
      'A hit in armour: it bursts off (cosmetic pieces) and he is thrown back to the boxers state. Steel or Gold, one hit takes all.',
    draw: (s) => {
      s.scenery();
      s.ground();
      arthurHud(s, 'lance');
      arthur(s, 'boxers-hurt', 88, GROUND - 20);
      fx(s, 'piece-0', 84, 150);
      fx(s, 'piece-1', 110, 140);
      fx(s, 'piece-0', 78, 176, { flip: true });
      fx(s, 'piece-1', 116, 170, { flip: true });
      s.arrow(96, 196, 70, 196);
      s.stand('enemies', 'goomba-0', 124, GROUND);
    },
  },
  {
    file: 'arthur-10-boxers',
    caption: 'Boxers (small): same moves and weapon, one hit kills. Death: he crumbles into a heap of bones.',
    draw: (s) => {
      s.scenery();
      s.ground();
      arthurHud(s, 'lance');
      arthur(s, 'boxers-stand', 48);
      arthur(s, 'boxers-throw', 96);
      fx(s, 'lance', 128, 182);
      arthur(s, 'bones', 184, GROUND);
    },
  },
  {
    file: 'arthur-11-gold',
    caption:
      'Fire Flower = Gold armour: weapons +100 damage, pierce armour, one more on screen; SPECIAL casts Lightning after a 40-frame wind-up.',
    draw: (s) => {
      s.scenery();
      s.ground();
      arthurHud(s, 'lance', 'flower');
      arthur(s, 'stand', 96, GROUND, { palette: 'arthur-gold' });
      for (let y = 32; y < GROUND; y += 16) {
        fx(s, 'bolt', 40, y);
        fx(s, 'bolt', 152, y);
      }
      s.stand('enemies', 'buzzy-0', 154, GROUND, { flipV: true, alpha: 0.7 });
    },
  },
  {
    file: 'arthur-12-pot',
    caption:
      'Weapon pots: 1 kill in 8 drops a pot showing one of the other weapons. Touch it and that weapon replaces the current one (the torch too).',
    draw: (s) => {
      s.scenery();
      s.ground();
      arthurHud(s, 'lance', 'mushroom');
      arthur(s, 'walk-0', 64);
      fx(s, 'pot', 120, GROUND - 11);
      fx(s, 'axe-0', 122, GROUND - 22);
      fx(s, 'pot', 176, GROUND - 11);
      fx(s, 'torch-0', 180, GROUND - 20);
    },
  },
  {
    file: 'arthur-13-water',
    caption:
      'Water (SW-C2): no stroke. He jumps off the floor (about 123 px), still committed; one air jump; weapons unchanged.',
    draw: (s) => {
      s.ctx.fillStyle = '#2038ec';
      s.ctx.fillRect(0, 32, W, H);
      s.ground([], 'tiles-water');
      arthurHud(s, 'dagger', 'mushroom');
      path(s, 40, GROUND - 14, 1.25, -4.097, 0.0694, 58, 4);
      arthur(s, 'jump', 100, 112);
      s.stand('enemies', 'cheep-0', 190, 120);
    },
  },
];

/* ---------------- output ---------------- */

interface Out {
  file: string;
  dataUrl: string;
}
function contactSheet(title: string, frames: { caption: string; canvas: HTMLCanvasElement }[]): string {
  const cols = 3;
  const fw = W * 2;
  const fh = H * 2;
  const cap = 64;
  const pad = 16;
  const head = 56;
  const rows = Math.ceil(frames.length / cols);
  const out = document.createElement('canvas');
  out.width = pad + cols * (fw + pad);
  out.height = head + rows * (fh + cap + pad) + pad;
  const c = out.getContext('2d') as CanvasRenderingContext2D;
  c.fillStyle = '#181818';
  c.fillRect(0, 0, out.width, out.height);
  c.fillStyle = '#f0f0f0';
  c.font = 'bold 24px sans-serif';
  c.fillText(title, pad, 36);
  c.imageSmoothingEnabled = false;
  frames.forEach((f, i) => {
    const x = pad + (i % cols) * (fw + pad);
    const y = head + Math.floor(i / cols) * (fh + cap + pad);
    c.drawImage(f.canvas, x, y, fw, fh);
    c.fillStyle = '#e0e0e0';
    c.font = '15px sans-serif';
    let line = `${i + 1}. `;
    let ly = y + fh + 20;
    for (const word of f.caption.split(' ')) {
      if (c.measureText(line + word).width > fw) {
        c.fillText(line, x, ly);
        line = '';
        ly += 19;
      }
      line += `${word} `;
    }
    c.fillText(line, x, ly);
  });
  return out.toDataURL('image/png');
}

function run(): { frames: Out[]; sheets: Out[] } {
  const frames: Out[] = [];
  const sheetsOut: Out[] = [];
  for (const [title, file, list] of [
    ['Princess Peach (Classic extra, design mockup, not final)', 'peach-sheet', PEACH_FRAMES],
    ['Sir Arthur (Classic extra, design mockup, not final)', 'arthur-sheet', ARTHUR_FRAMES],
  ] as const) {
    const done: { caption: string; canvas: HTMLCanvasElement }[] = [];
    for (const f of list) {
      const s = new Scene();
      f.draw(s);
      const big = s.scaled();
      frames.push({ file: f.file, dataUrl: big.toDataURL('image/png') });
      done.push({ caption: f.caption, canvas: s.canvas });
    }
    sheetsOut.push({ file, dataUrl: contactSheet(title, done) });
  }
  return { frames, sheets: sheetsOut };
}

const w = window as unknown as { __mock?: { frames: Out[]; sheets: Out[] }; __mockError?: string };
try {
  w.__mock = run();
} catch (e) {
  w.__mockError = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e);
}
