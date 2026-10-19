/**
 * DESIGN MOCKUP storyboard (not the game). Opened by tools/mockups/classic/render.mjs through Vite; draws
 * hand-posed 256x240 frames of a 1-1-like scene with the game's own tile, enemy, item and font art plus
 * the draft hero sprites in this folder, scales them 3x and hands PNG data URLs back to the script.
 * Nothing under src/ imports this file.
 */
import { PALETTES, SPRITES } from '@content/sprites';
import { rasterizeToBuffer, validateDef, type SpriteDef } from '@engine/gfx/pixelart';
import { yoshiDef, yoshiPalettes } from './yoshi';

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

const MOCK_DEFS: Record<string, SpriteDef> = { yoshi: yoshiDef };
const MOCK_PALETTES: Record<string, readonly string[]> = {
  ...yoshiPalettes,
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
  /** Draw only this many rows from the top of the frame (a rider cut at the saddle line). */
  cropH?: number;
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
    const h = Math.min(r.h, o.cropH ?? r.h);
    c.drawImage(s.canvas, r.x, r.y, r.w, h, 0, 0, r.w, h);
    c.restore();
  }
  /** The sprite's bottom-left at (x, bottom). */
  stand(id: string, frame: string, x: number, bottom: number, o: DrawOpts = {}): void {
    const r = sheetFor(id, o.palette).frames.get(frame);
    if (!r) throw new Error(`no frame ${id}:${frame}`);
    this.spr(id, frame, x, bottom - r.h, o);
  }
  tile(name: string, tx: number, ty: number): void {
    this.spr('tiles', name, tx * 16, ty * 16);
  }
  ground(holes: number[] = []): void {
    for (let tx = 0; tx < 16; tx++) {
      if (holes.includes(tx)) continue;
      this.tile('ground', tx, 13);
      this.tile('ground', tx, 14);
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

/* ---------------- Yoshi (shared helpers) ---------------- */

/** Yoshi's 24x32 cell with its feet at `bottom`; `x` is the cell's left edge. */
function yo(s: Scene, frame: string, x: number, bottom = GROUND, o: DrawOpts = {}): void {
  s.stand('yoshi', frame, x, bottom, o);
}
/** The saddle line: px below the top of Yoshi's cell where a rider's frame is cut (YM-20). */
const SADDLE = 17;
/**
 * A rider on Yoshi (YM-20): the hero's own frame, cut `keep` rows from its top, its bottom on the saddle
 * line, drawn before Yoshi so his head and neck overlap it. `keep`: 11 for a 16x16 small plumber, 19 for
 * a 16x32 hero.
 */
function rider(
  s: Scene,
  sheet: string,
  frame: string,
  yx: number,
  bottom: number,
  o: { palette?: string; keep?: number; alpha?: number } = {},
): void {
  const keep = o.keep ?? 19;
  const top = bottom - 32 + SADDLE - keep;
  s.spr(sheet, frame, yx - 2, top, {
    cropH: keep,
    ...(o.palette ? { palette: o.palette } : {}),
    ...(o.alpha !== undefined ? { alpha: o.alpha } : {}),
  });
}
function riding(
  s: Scene,
  yframe: string,
  sheet: string,
  frame: string,
  yx: number,
  bottom = GROUND,
  o: { palette?: string; keep?: number; alpha?: number; ypal?: string } = {},
): void {
  rider(s, sheet, frame, yx, bottom, o);
  yo(s, yframe, yx, bottom, {
    ...(o.ypal ? { palette: o.ypal } : {}),
    ...(o.alpha !== undefined ? { alpha: o.alpha } : {}),
  });
}
/** The tongue from Yoshi's mouth (cell x + 23, 11 px below the cell top) out `len` px. */
function tongue(s: Scene, yx: number, bottom: number, len: number, up = false): void {
  const mx = yx + 22;
  const my = bottom - 32 + 10;
  const step = 4;
  for (let i = 0; i < len - 5; i += step) {
    if (up) s.spr('yoshi', 'tongue-mid', mx + i * 0.7, my - i * 0.7);
    else s.spr('yoshi', 'tongue-mid', mx + i, my);
  }
  if (up) s.spr('yoshi', 'tongue-tip', mx + (len - 5) * 0.7, my - (len - 5) * 0.7 - 1);
  else s.spr('yoshi', 'tongue-tip', mx + len - 5, my - 1);
}
function eggHud(s: Scene, name: string, eggs: number, power?: 'mushroom' | 'flower', red = false): void {
  s.hud(name, (sc) => {
    if (power) sc.spr('items', power === 'mushroom' ? 'icon-mushroom' : 'icon-flower', 24, 24);
    sc.spr('yoshi', 'icon-egg', 96, 24, red ? { palette: 'yoshi-flower' } : {});
    sc.text(`*${String(eggs).padStart(2, '0')}`, 104, 24);
  });
}
function mountHud(s: Scene, name: string, power?: 'mushroom' | 'flower'): void {
  s.hud(name, (sc) => {
    if (power) sc.spr('items', power === 'mushroom' ? 'icon-mushroom' : 'icon-flower', 24, 24);
  });
}

/* ---------------- Yoshi, the playable hero ---------------- */

const YOSHI_FRAMES: { file: string; caption: string; draw: (s: Scene) => void }[] = [
  {
    file: 'yoshi-01-stand',
    caption:
      'Yoshi (Classic extra, second select row). Stand: 12x24 hitbox, no size change. HUD: egg count (small: max 3).',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.tile('question-0', 9, 9);
      eggHud(s, 'YOSHI', 3);
      yo(s, 'stand', 64);
      s.stand('enemies', 'goomba-0', 184, GROUND);
    },
  },
  {
    file: 'yoshi-02-walk',
    caption:
      'Walk: Mario-style inertia up to 1.75 px/f, no run button (Attack is the tongue). Tuning values.',
    draw: (s) => {
      s.scenery();
      s.ground();
      eggHud(s, 'YOSHI', 3);
      yo(s, 'walk-0', 40, GROUND, { alpha: 0.3 });
      yo(s, 'walk-2', 64, GROUND, { alpha: 0.55 });
      yo(s, 'walk-1', 88);
      s.arrow(120, 180, 150, 180);
    },
  },
  {
    file: 'yoshi-03-jump',
    caption: 'JUMP: rise 3.25 px/f to 40 px, then gravity: about 65 px (4 tiles) at full hold.',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.tile('brick', 7, 7);
      s.tile('question-0', 8, 7);
      eggHud(s, 'YOSHI', 3);
      for (let f = 0; f <= 60; f += 3) {
        const y = f < 12 ? f * 3.25 : 39 + (f - 12) * 3.25 - 0.104 * (f - 12) ** 2;
        s.dot(52 + f * 1.75, GROUND - 12 - Math.max(0, y));
      }
      yo(s, 'jump', 112, GROUND - 60);
    },
  },
  {
    file: 'yoshi-04-flutter',
    caption:
      'Flutter jump: hold JUMP while falling. Up to 40 frames of kicking legs: the fall stops and he rises a little. Once per jump.',
    draw: (s) => {
      s.scenery();
      s.ground([7, 8, 9, 10]);
      eggHud(s, 'YOSHI', 3);
      for (let f = 0; f <= 110; f += 3) {
        let y: number;
        if (f < 12) y = f * 3.25;
        else if (f < 37) y = 39 + (f - 12) * 3.25 - 0.104 * (f - 12) ** 2;
        else if (f < 77) y = 55 + Math.min(f - 37, 20) * 0.3;
        else y = 61 - 0.104 * (f - 77) ** 2;
        s.dot(30 + f * 1.75, GROUND - 12 - Math.max(-16, y));
      }
      yo(s, 'flutter-0', 116, GROUND - 52);
      yo(s, 'flutter-1', 156, GROUND - 56, { alpha: 0.5 });
    },
  },
  {
    file: 'yoshi-05-pound',
    caption:
      'Ground pound: Down in the air. 12 frames hang (curled), then a 6 px/f drop: 800 damage, pierces armour, breaks a brick below.',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.tile('brick', 6, 12);
      s.tile('brick', 7, 12);
      s.spr('items', 'brick-piece', 104, 182);
      s.spr('items', 'brick-piece', 122, 178, { flip: true });
      eggHud(s, 'YOSHI', 3);
      yo(s, 'pound', 96, 96, { alpha: 0.45 });
      yo(s, 'pound', 98, 186);
      s.arrow(110, 104, 110, 150);
      s.stand('enemies', 'buzzy-0', 168, GROUND, { flipV: true, alpha: 0.7 });
      yo(s, 'pound', 160, 150, { alpha: 0.45 });
    },
  },
  {
    file: 'yoshi-06-tongue',
    caption:
      'ATTACK = tongue: 40 px out in 10 frames, back in 10. Up + ATTACK licks up at 45 degrees. It catches one edible enemy.',
    draw: (s) => {
      s.scenery();
      s.ground();
      eggHud(s, 'YOSHI', 2);
      yo(s, 'tongue', 56);
      tongue(s, 56, GROUND, 40);
      s.stand('enemies', 'goomba-0', 112, GROUND);
      yo(s, 'tongue', 152, GROUND, { alpha: 0.6 });
      tongue(s, 152, GROUND, 36, true);
      s.stand('enemies', 'koopa-fly-0', 196, 168);
    },
  },
  {
    file: 'yoshi-07-swallow',
    caption:
      'Mouth full (cheeks puff). Down = swallow: he squats and lays an egg (+1, 20 frames). ATTACK instead spits the enemy out.',
    draw: (s) => {
      s.scenery();
      s.ground();
      eggHud(s, 'YOSHI', 3);
      yo(s, 'full', 40);
      s.arrow(76, 170, 100, 170);
      yo(s, 'lay', 112);
      s.stand('yoshi', 'egg-green', 106, GROUND);
      s.stand('yoshi', 'egg-green', 94, GROUND, { alpha: 0.6 });
    },
  },
  {
    file: 'yoshi-08-aim',
    caption:
      'Hold SPECIAL to aim: the cursor sweeps between level and 75 degrees up (64 frames each way); he can still walk and jump.',
    draw: (s) => {
      s.scenery();
      s.ground();
      eggHud(s, 'YOSHI', 3);
      yo(s, 'aim', 56);
      const cx = 72;
      const cy = 172;
      for (let a = -10; a <= 75; a += 5) {
        const r = (a * Math.PI) / 180;
        s.dot(cx + Math.cos(r) * 56, cy - Math.sin(r) * 56, '#f8d878');
      }
      const r = (35 * Math.PI) / 180;
      s.spr('yoshi', 'aim-cursor', cx + Math.cos(r) * 56 - 3, cy - Math.sin(r) * 56 - 3);
      s.stand('yoshi', 'egg-green', 40, GROUND);
      s.stand('yoshi', 'egg-green', 30, GROUND);
    },
  },
  {
    file: 'yoshi-09-throw',
    caption:
      'Release SPECIAL: the egg flies along the line at 4 px/f, 400 damage, breaks bricks, bumps ? blocks and bounces once off ground.',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.pipe(12, 10);
      s.tile('question-0', 9, 5);
      eggHud(s, 'YOSHI', 2);
      yo(s, 'throw', 40);
      for (let i = 0; i < 9; i++) s.dot(66 + i * 9, 166 - i * 9, '#f8d878');
      s.spr('yoshi', 'egg-green', 138, 92);
      s.spr('items', 'coin-0', 144, 60);
      for (let i = 0; i < 6; i++) s.dot(160 + i * 6, 120 + i * 5, '#f8d878');
      s.stand('enemies', 'koopa-0', 152, GROUND);
    },
  },
  {
    file: 'yoshi-10-power',
    caption:
      'Power states (no size change): small 3 eggs; Mushroom one extra hit and 6 eggs; Fire Flower a red Yoshi whose red eggs do 800 and pierce.',
    draw: (s) => {
      s.scenery();
      s.ground();
      eggHud(s, 'YOSHI', 6, 'flower', true);
      yo(s, 'stand', 24);
      s.text('SMALL', 24, 140);
      yo(s, 'stand', 100);
      s.spr('items', 'icon-mushroom', 116, 152);
      s.text('MUSH', 104, 140);
      yo(s, 'stand', 176, GROUND, { palette: 'yoshi-flower' });
      s.spr('yoshi', 'egg-red', 204, 198, { palette: 'yoshi-flower' });
      s.text('FLOWER', 168, 140);
    },
  },
  {
    file: 'yoshi-11-spit',
    caption:
      'Spit: a held enemy flies out at 3 px/f as a tumbling projectile; it kills the first enemy it hits.',
    draw: (s) => {
      s.scenery();
      s.ground();
      eggHud(s, 'YOSHI', 6, 'mushroom');
      yo(s, 'tongue', 48);
      s.stand('enemies', 'goomba-0', 104, GROUND - 12, { flipV: true });
      s.arrow(124, 186, 150, 186);
      s.stand('enemies', 'koopa-1', 168, GROUND, { flipV: true, alpha: 0.7 });
    },
  },
  {
    file: 'yoshi-12-water',
    caption:
      'Water: Classic floor jumper (no stroke): floor jump 3.25 px/f, water gravity 0.0694; the flutter works under water.',
    draw: (s) => {
      s.ctx.fillStyle = '#2038ec';
      s.ctx.fillRect(0, 32, 256, 208);
      for (let tx = 0; tx < 16; tx++) s.tile('water-0', tx, 2);
      s.ground();
      eggHud(s, 'YOSHI', 3);
      for (let f = 0; f <= 50; f += 3) s.dot(56 + f * 1.4, GROUND - 14 - (f * 3.25 - 0.035 * f * f));
      yo(s, 'flutter-1', 112, 132);
      s.stand('enemies', 'cheep-0', 192, 120);
    },
  },
  {
    file: 'yoshi-13-hit',
    caption:
      'Hit: Lose Everything (red to green, back to 3 eggs max). Pushed back 1.25 px/f with a hop, then 75 frames at 65 % opacity.',
    draw: (s) => {
      s.scenery();
      s.ground();
      eggHud(s, 'YOSHI', 3);
      yo(s, 'hurt', 72, GROUND - 14, { alpha: 0.65 });
      s.arrow(86, 160, 60, 150);
      s.stand('enemies', 'goomba-0', 108, GROUND);
    },
  },
];

/* ---------------- Yoshi, the mount ---------------- */

const MOUNT_FRAMES: { file: string; caption: string; draw: (s: Scene) => void }[] = [
  {
    file: 'mount-01-off',
    caption:
      'Yoshi mount OFF (Classic default): every level exactly as the original. The first power-up ? block gives its Mushroom.',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.tile('brick', 6, 9);
      s.tile('used', 7, 9);
      s.tile('brick', 8, 9);
      s.spr('items', 'mushroom', 112, 128);
      mountHud(s, 'MARIO');
      s.stand('mario', 'small-idle', 80, GROUND);
    },
  },
  {
    file: 'mount-02-egg',
    caption:
      'Mount ON (owner option): the same block looks the same, but with no Yoshi in play it holds an egg instead (YM-5).',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.tile('brick', 6, 9);
      s.tile('used', 7, 9);
      s.tile('brick', 8, 9);
      s.spr('items', 'yoshi-egg-l', 112, 128);
      mountHud(s, 'MARIO');
      s.stand('mario', 'small-jump', 112, 176);
    },
  },
  {
    file: 'mount-03-hatch',
    caption:
      'The egg wobbles, cracks and hatches (the existing egg animation). Yoshi sits and waits for a rider.',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.tile('brick', 6, 9);
      s.tile('used', 7, 9);
      s.tile('brick', 8, 9);
      s.spr('items', 'egg-shell', 104, 112);
      s.spr('items', 'egg-shell', 128, 108, { flip: true });
      mountHud(s, 'MARIO');
      yo(s, 'sit', 140);
      s.stand('mario', 'small-idle', 64, GROUND);
    },
  },
  {
    file: 'mount-04-mount',
    caption:
      'Land on his back to ride. Any Classic hero but Sophia III, Vic Viper and Yoshi himself. One mount profile for every rider.',
    draw: (s) => {
      s.scenery();
      s.ground();
      mountHud(s, 'MARIO');
      s.stand('mario', 'small-jump', 104, 120, { alpha: 0.5 });
      s.arrow(112, 128, 112, 150);
      riding(s, 'stand', 'mario', 'small-idle', 100, GROUND, { keep: 11 });
    },
  },
  {
    file: 'mount-05-tongue',
    caption:
      'ATTACK = tongue for every rider. Goombas, Spinies, Cheeps and Lakitu are swallowed at once (stomp score).',
    draw: (s) => {
      s.scenery();
      s.ground();
      mountHud(s, 'MARIO', 'mushroom');
      riding(s, 'tongue', 'mario', 'big-idle', 48);
      tongue(s, 48, GROUND, 40);
      s.stand('enemies', 'spiny-0', 106, GROUND);
    },
  },
  {
    file: 'mount-06-shell',
    caption:
      'A Koopa or Buzzy is held in his mouth as a shell; ATTACK spits it as a kicked shell (kills anything). Auto-swallow after 10 s.',
    draw: (s) => {
      s.scenery();
      s.ground();
      mountHud(s, 'MARIO', 'mushroom');
      riding(s, 'full', 'mario', 'big-idle', 40);
      s.arrow(72, 196, 96, 196);
      s.stand('enemies', 'shell', 120, GROUND);
      s.arrow(140, 200, 164, 200);
      s.stand('enemies', 'goomba-0', 184, GROUND, { flipV: true, alpha: 0.7 });
    },
  },
  {
    file: 'mount-07-link',
    caption:
      'Link rides: sword put away; SPECIAL still throws the boomerang, SELECT still bombs. Every hero keeps SPECIAL and SELECT.',
    draw: (s) => {
      s.scenery();
      s.ground();
      mountHud(s, 'LINK');
      riding(s, 'stand', 'link', 'throw', 56);
      s.spr('items', 'boomerang-1', 128, 168);
      s.arrow(96, 172, 120, 172);
      s.stand('enemies', 'goomba-0', 176, GROUND);
    },
  },
  {
    file: 'mount-08-samus',
    caption:
      'A hero whose SPECIAL is empty now (small Samus, Mega Man, Bill) fires its ATTACK shot on SPECIAL instead, from the saddle.',
    draw: (s) => {
      s.scenery();
      s.ground();
      mountHud(s, 'SAMUS');
      riding(s, 'walk-1', 'samus', 'shoot', 56);
      s.spr('items', 'beam-0', 112, 168);
      s.spr('items', 'beam-1', 140, 168);
      s.stand('enemies', 'koopa-0', 184, GROUND);
    },
  },
  {
    file: 'mount-09-stomp',
    caption:
      'Riding, every hero stomps like Mario (Yoshi stomps Spinies too). Bricks: the rider keeps his own head rule.',
    draw: (s) => {
      s.scenery();
      s.ground();
      mountHud(s, 'MEGA');
      riding(s, 'jump', 'megaman', 'jump', 96, 182);
      s.stand('enemies', 'goomba-squash', 104, GROUND);
      s.text('100', 104, 140);
    },
  },
  {
    file: 'mount-10-hit',
    caption:
      'Hit while riding: no power lost. The rider is thrown up (invulnerable 120 frames) and Yoshi runs off at 2 px/f. Catch him to ride again.',
    draw: (s) => {
      s.scenery();
      s.ground();
      mountHud(s, 'MARIO', 'flower');
      s.stand('mario', 'big-jump', 64, 140, { palette: 'mario-fire', alpha: 0.65 });
      yo(s, 'tongue', 128);
      s.spr('yoshi', 'tear', 140, 172);
      s.arrow(156, 196, 196, 196);
      s.stand('enemies', 'koopa-0', 40, GROUND);
    },
  },
  {
    file: 'mount-11-leap',
    caption:
      'Down + JUMP gets off. In mid-air it is a leap: the rider takes a full jump off his back and Yoshi drops (lost in a pit).',
    draw: (s) => {
      s.scenery();
      s.ground([6, 7, 8, 9]);
      mountHud(s, 'SIMON');
      s.stand('simon', 'jump', 116, 96);
      s.arrow(124, 128, 124, 104);
      yo(s, 'jump', 108, 172);
      s.arrow(120, 180, 120, 222);
    },
  },
  {
    file: 'mount-12-castle',
    caption:
      'Castles and water levels: Yoshi waits outside (kept, not lost) and comes back at the next level. Bowser fights stay as they are.',
    draw: (s) => {
      s.scenery();
      s.ground();
      for (let ty = 7; ty < 13; ty++) for (let tx = 9; tx < 16; tx++) s.tile('castle-brick', tx, ty);
      s.ctx.fillStyle = '#000000';
      s.ctx.fillRect(184, 176, 16, 32);
      mountHud(s, 'RYU');
      yo(s, 'sit', 112);
      s.stand('ryu', 'walk-1', 168, GROUND);
    },
  },
  {
    file: 'mount-13-flag',
    caption:
      'Flagpole: the rider hops off and slides alone; Yoshi waits at the base, the rider gets back on and they walk to the castle.',
    draw: (s) => {
      s.scenery();
      s.ground();
      for (let ty = 3; ty < 12; ty++) s.tile('flag-shaft', 8, ty);
      s.tile('flag-ball', 8, 2);
      s.tile('hard', 8, 12);
      s.spr('items', 'flag', 120, 96);
      mountHud(s, 'BILL');
      s.stand('bill', 'hang-0', 134, 128);
      yo(s, 'sit', 150);
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
    ['Yoshi, playable (Classic extra, design mockup, not final)', 'yoshi-sheet', YOSHI_FRAMES],
    ['Yoshi, the mount (Classic option, off by default; design mockup)', 'yoshi-mount-sheet', MOUNT_FRAMES],
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
