/**
 * DESIGN MOCKUP storyboard (not the game). Opened by tools/mockups/classic/render.mjs through Vite; draws
 * hand-posed 256x240 frames of a 1-1-like scene with the game's own tile, enemy, item and font art plus
 * the draft hero sprites in this folder, scales them 3x and hands PNG data URLs back to the script.
 * Nothing under src/ imports this file.
 */
import { PALETTES, SPRITES } from '@content/sprites';
import { rasterizeToBuffer, validateDef, type SpriteDef } from '@engine/gfx/pixelart';
import { VIC_BAR, vicDef, vicPalettes } from './vicviper';
import { WARRIOR_JOBS, warriorFxDef, warriorFxPalette, warriorPalettes, warriorsDef } from './warriors';

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

const MOCK_DEFS: Record<string, SpriteDef> = { vic: vicDef, war: warriorsDef, warfx: warriorFxDef };
const MOCK_PALETTES: Record<string, readonly string[]> = {
  ...vicPalettes,
  ...warriorPalettes,
  'war-fx': warriorFxPalette,
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
    this.decor('cloud-1', 64, 56);
    this.decor('cloud-2', 168, 40);
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

/* ---------------- Vic Viper ---------------- */

interface Bar {
  selected: number;
  maxed?: number[];
}
function vicHud(s: Scene, bar: Bar): void {
  s.hud('VIPER', (sc) => {
    const c = sc.ctx;
    VIC_BAR.forEach((slot, i) => {
      const x = 24 + i * 17;
      const sel = bar.selected === i + 1;
      c.fillStyle = '#fcfcfc';
      c.fillRect(x, 25, 17, 10);
      c.fillStyle = sel ? '#e45c10' : '#0000bc';
      c.fillRect(x + 1, 26, 15, 8);
      if (!bar.maxed?.includes(i + 1)) sc.text(slot.cell, x + (slot.cell.length === 1 ? 5 : 1), 26);
    });
    const name = bar.selected > 0 ? (VIC_BAR[bar.selected - 1]?.name ?? '') : '';
    sc.text(name, 132, 26, 'font-gold');
  });
}
function ship(s: Scene, x: number, y: number, o: { pose?: string; pal?: string; speed?: boolean; f?: number } = {}): void {
  const f = o.f ?? 0;
  const flame = o.speed ? `flame-speed-${f % 4}` : `flame-${f % 4}`;
  const fw = o.speed ? 12 : 8;
  s.spr('vic', flame, x - fw + 1, y + 7, o.pal ? { palette: o.pal } : {});
  s.spr('vic', o.pose ?? `normal-${f % 2}`, x, y, o.pal ? { palette: o.pal } : {});
}

const VIC_FRAMES: { file: string; caption: string; draw: (s: Scene) => void }[] = [
  {
    file: 'vic-01-idle',
    caption: 'Idle: hovers in place, no gravity. The screen scrolls right by itself (0.833 px/f) and carries the ship.',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.tile('question-0', 10, 9);
      vicHud(s, { selected: 0 });
      ship(s, 32, 120);
      s.arrow(200, 120, 236, 120);
      s.arrow(200, 132, 236, 132);
    },
  },
  {
    file: 'vic-02-fly',
    caption: 'Fly right (the "run"): fixed 1.667 px/f in 8 directions, no acceleration; jet flame at the tail.',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.tile('brick', 7, 9);
      s.tile('question-1', 8, 9);
      s.tile('brick', 9, 9);
      s.stand('enemies', 'goomba-0', 176, GROUND);
      vicHud(s, { selected: 0 });
      ship(s, 72, 150, { f: 2 });
    },
  },
  {
    file: 'vic-03-up',
    caption: 'Fly up (no jump exists): the ship pitches nose-up. Flying into a block from below does nothing (no head bump).',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.tile('brick', 6, 7);
      s.tile('question-0', 7, 7);
      s.tile('brick', 8, 7);
      vicHud(s, { selected: 0 });
      ship(s, 96, 128, { pose: 'up-1', f: 1 });
      s.arrow(110, 150, 110, 132);
    },
  },
  {
    file: 'vic-04-shoot',
    caption: 'SHOOT: one bullet per press, 5 px/f, flies through ground and pipes, breaks the first brick it meets and is spent.',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.pipe(12, 10);
      s.tile('question-0', 9, 6);
      s.tile('brick', 10, 6);
      s.spr('items', 'brick-piece', 176, 84);
      s.spr('items', 'brick-piece', 188, 80, { flip: true });
      s.spr('items', 'brick-piece', 174, 108);
      s.spr('items', 'brick-piece', 190, 104, { flip: true });
      vicHud(s, { selected: 0 });
      ship(s, 40, 96, { f: 3 });
      s.spr('vic', 'bullet', 90, 101);
      s.spr('vic', 'bullet', 130, 101);
      s.spr('vic', 'bullet', 190, 165);
      ship(s, 140, 160, { f: 1, pose: 'normal-1' });
    },
  },
  {
    file: 'vic-05-small',
    caption: 'Small (start): red trim. Any hit destroys the ship. HUD bar empty.',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.tile('question-0', 7, 9);
      vicHud(s, { selected: 0 });
      ship(s, 64, 120);
      s.stand('enemies', 'goomba-1', 160, GROUND);
    },
  },
  {
    file: 'vic-06-mushroom',
    caption: 'Mushroom: trim turns blue = one extra hit (no size change). From the first power-up block.',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.tile('used', 7, 9);
      vicHud(s, { selected: 0 });
      s.spr('items', 'mushroom', 112, 128);
      ship(s, 64, 120, { pal: 'vicviper-mushroom' });
    },
  },
  {
    file: 'vic-07-flower',
    caption: 'Fire Flower state: gold trim (cosmetic). Every later power-up block gives a red power capsule instead of a Flower.',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.tile('used', 8, 9);
      s.spr('vic', 'capsule-0', 128, 128);
      vicHud(s, { selected: 1 });
      ship(s, 48, 112, { pal: 'vicviper-flower', f: 2 });
    },
  },
  {
    file: 'vic-08-bar',
    caption: 'Power bar (HUD row 3): each capsule moves the light one slot right. Here 2 capsules: MISSILE is lit.',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.stand('enemies', 'goomba-0', 200, GROUND);
      s.spr('vic', 'capsule-1', 120, 150);
      vicHud(s, { selected: 2 });
      ship(s, 64, 148, { pal: 'vicviper-mushroom', f: 1 });
    },
  },
  {
    file: 'vic-09-kit',
    caption: 'POWER spends the lit slot. Speed Up x2 (long flame), 2 Options trailing, ground Missile running along the floor.',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.stand('enemies', 'buzzy-0', 196, GROUND);
      vicHud(s, { selected: 0, maxed: [2] });
      s.spr('vic', 'option-0', 36, 146);
      s.spr('vic', 'option-1', 16, 160);
      ship(s, 60, 132, { pal: 'vicviper-mushroom', speed: true, f: 2 });
      s.spr('vic', 'bullet', 110, 137);
      s.spr('vic', 'bullet', 66, 151);
      s.spr('vic', 'missile-down', 96, 160);
      s.spr('vic', 'missile-run', 150, GROUND - 10);
    },
  },
  {
    file: 'vic-10-laser-shield',
    caption: 'Laser (pierces, keeps flying, 2 on screen) and the front Shield (4 hits per piece; dims when worn).',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.stand('enemies', 'koopa-0', 208, GROUND);
      s.spr('enemies', 'bullet', 168, 108, { flip: true });
      vicHud(s, { selected: 0, maxed: [4, 6] });
      ship(s, 72, 112, { pal: 'vicviper-flower', speed: true, f: 0 });
      s.spr('vic', 'shield-top', 104, 106);
      s.spr('vic', 'shield-bot-hurt', 104, 120);
      s.spr('vic', 'laser', 124, 117);
      s.spr('vic', 'laser', 176, 117);
    },
  },
  {
    file: 'vic-11-pipe',
    caption: 'Down over a pipe enters it even in mid-air; auto-scroll pauses in the pipe and resumes after the exit.',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.pipe(8, 9);
      vicHud(s, { selected: 3 });
      ship(s, 120, 128, { pose: 'down-1', f: 1 });
      s.arrow(144, 120, 144, 140);
    },
  },
  {
    file: 'vic-12-death',
    caption: 'Hit while small: the ship explodes (24x24 burst) and the bar empties.',
    draw: (s) => {
      s.scenery();
      s.ground();
      vicHud(s, { selected: 0 });
      s.spr('vic', 'boom-2', 84, 116);
      s.stand('enemies', 'goomba-1', 112, GROUND);
    },
  },
];

/* ---------------- Warriors of Light ---------------- */

type JobInfo = (typeof WARRIOR_JOBS)[number];
const JOB = (j: string): JobInfo => WARRIOR_JOBS.find((x) => x.job === j) as JobInfo;
function warHud(s: Scene, job: string, opts: { power?: 'mushroom' | 'flower'; cure?: number } = {}): void {
  s.hud('WARRIOR', (sc) => {
    const info = JOB(job);
    sc.text(info.name + (job === 'wmage' && opts.cure !== undefined ? ` C${opts.cure}` : ''), 24, 26, 'font-gold');
    if (opts.power) sc.spr('items', opts.power === 'mushroom' ? 'mushroom' : 'flower-0', 104, 20);
  });
}
function hero(s: Scene, job: string, pose: string, x: number, bottom = GROUND, o: { flower?: boolean; alpha?: number } = {}): void {
  const info = JOB(job);
  s.stand('war', `${job}-${pose}`, x, bottom, {
    palette: o.flower ? info.flower : info.palette,
    ...(o.alpha !== undefined ? { alpha: o.alpha } : {}),
  });
}

const WAR_FRAMES: { file: string; caption: string; draw: (s: Scene) => void }[] = [
  {
    file: 'war-01-party',
    caption: 'One hero, four jobs: Fighter, Thief, Black Mage, White Mage. Same body, size and movement for all.',
    draw: (s) => {
      s.scenery();
      s.ground();
      warHud(s, 'fighter');
      WARRIOR_JOBS.forEach((j, i) => {
        hero(s, j.job, 'stand', 40 + i * 48);
        s.text(j.name, 32 + i * 48 - (j.name.length > 6 ? 4 : 0), 216);
      });
    },
  },
  {
    file: 'war-02-walk',
    caption: 'Walk: instant 1.667 px/f, no run, full air control. Stands still (rooted) while acting on the ground.',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.stand('enemies', 'goomba-0', 180, GROUND);
      warHud(s, 'fighter');
      hero(s, 'fighter', 'walk-1', 56, GROUND, { alpha: 0.35 });
      hero(s, 'fighter', 'walk-0', 76);
    },
  },
  {
    file: 'war-03-jump',
    caption: 'JUMP: one fixed arc, 68 px high, 53 frames; no variable height. Hitting a block from below does nothing.',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.tile('brick', 7, 7);
      s.tile('question-0', 8, 7);
      s.tile('brick', 9, 7);
      warHud(s, 'fighter');
      for (let f = 0; f <= 53; f += 3) {
        const y = 5.0556 * f - 0.0972 * f * f;
        s.dot(64 + f * 1.667 + 8, GROUND - 14 - y);
      }
      hero(s, 'fighter', 'jump', 100, GROUND - 66);
    },
  },
  {
    file: 'war-04-fighter-swing',
    caption: 'Fighter ATTACK: sword swing, 30 frames, 300 damage: one hit per Goomba, two per Koopa. Breaks bricks.',
    draw: (s) => {
      s.scenery();
      s.ground();
      warHud(s, 'fighter', { power: 'mushroom' });
      hero(s, 'fighter', 'swing-1', 72);
      s.stand('enemies', 'goomba-0', 98, GROUND, { flipV: true, alpha: 0.8 });
      s.stand('enemies', 'koopa-0', 200, GROUND);
    },
  },
  {
    file: 'war-05-thief',
    caption: 'Thief ATTACK: quick dagger swing, only 50 damage (5 per Goomba). Swings and spells are how blocks are opened.',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.tile('brick', 6, 10);
      s.spr('items', 'brick-piece', 116, 148);
      s.spr('items', 'brick-piece', 128, 144, { flip: true });
      warHud(s, 'thief');
      hero(s, 'thief', 'swing-1', 80, GROUND - 16);
      s.tile('brick', 5, 12);
      s.tile('brick', 6, 12);
      s.tile('brick', 7, 12);
      s.stand('enemies', 'goomba-1', 188, GROUND);
    },
  },
  {
    file: 'war-06-windup',
    caption: 'Black Mage: every spell has a 30-frame wind-up (hands glow), then an 18-frame cast pose. Rooted on the ground.',
    draw: (s) => {
      s.scenery();
      s.ground();
      warHud(s, 'bmage');
      hero(s, 'bmage', 'windup', 96);
      s.stand('enemies', 'goomba-0', 176, GROUND);
    },
  },
  {
    file: 'war-07-fire',
    caption: 'Black Mage ATTACK = Fire: 3.75 px/f, 400 damage, passes through pipes, walls and enemies, breaks bricks.',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.pipe(8, 10);
      warHud(s, 'bmage');
      hero(s, 'bmage', 'cast', 48);
      s.spr('warfx', 'fire-0', 132, 176, {});
      s.spr('warfx', 'fire-1', 84, 176);
      s.stand('enemies', 'koopa-1', 200, GROUND);
    },
  },
  {
    file: 'war-08-bolt',
    caption: 'Up + ATTACK = Bolt: a 27 px column the full screen height, 50 px ahead, 600 damage, 27 frames.',
    draw: (s) => {
      s.scenery();
      s.ground();
      s.tile('brick', 7, 6);
      warHud(s, 'bmage');
      for (let y = 0; y < GROUND; y += 16) s.spr('warfx', 'bolt', 98, y);
      hero(s, 'bmage', 'cast', 48);
      s.stand('enemies', 'koopa-fly-0', 102, 96);
    },
  },
  {
    file: 'war-09-ice',
    caption: 'Down + ATTACK = Ice: one 48x48 burst 50 px ahead, 400 damage, 22 frames (also from a crouch).',
    draw: (s) => {
      s.scenery();
      s.ground();
      warHud(s, 'bmage', { power: 'mushroom' });
      hero(s, 'bmage', 'cast', 56);
      s.spr('warfx', 'ice-1', 84, 140);
      s.stand('enemies', 'goomba-1', 100, GROUND);
    },
  },
  {
    file: 'war-10-wmage-staff',
    caption: 'White Mage ATTACK (new design): staff swing, the shared 30-frame swing, 100 damage.',
    draw: (s) => {
      s.scenery();
      s.ground();
      warHud(s, 'wmage', { cure: 1 });
      hero(s, 'wmage', 'swing-1', 72);
      s.stand('enemies', 'goomba-0', 104, GROUND);
    },
  },
  {
    file: 'war-11-cure',
    caption: 'White Mage Down + ATTACK = Cure (new design): while small, uses the one charge (C1 to C0) to regain the Mushroom.',
    draw: (s) => {
      s.scenery();
      s.ground();
      warHud(s, 'wmage', { cure: 0, power: 'mushroom' });
      hero(s, 'wmage', 'windup', 96);
      s.spr('warfx', 'cure-0', 88, 160);
      s.spr('warfx', 'cure-1', 104, 176);
    },
  },
  {
    file: 'war-12-power-states',
    caption: 'Power states: small and Mushroom look the same (HUD icon only; no size change). Fire Flower = new outfit per job.',
    draw: (s) => {
      s.scenery();
      s.ground();
      warHud(s, 'fighter', { power: 'flower' });
      WARRIOR_JOBS.forEach((j, i) => {
        hero(s, j.job, 'stand', 40 + i * 48, GROUND, { flower: true });
        s.text(j.flowerName.slice(0, 7), 28 + i * 48, 216);
      });
    },
  },
  {
    file: 'war-13-class-switch',
    caption: 'Class switch (new design, uses the disabled code): hold a direction + SPECIAL. Up Fighter, Right B.Mage, Down Thief, Left W.Mage.',
    draw: (s) => {
      s.scenery();
      s.ground();
      warHud(s, 'fighter');
      hero(s, 'fighter', 'stand', 120, 160);
      hero(s, 'fighter', 'stand', 120, 100, { alpha: 0.6 });
      hero(s, 'bmage', 'stand', 180, 160, { alpha: 0.6 });
      hero(s, 'thief', 'stand', 120, GROUND, { alpha: 0.6 });
      hero(s, 'wmage', 'stand', 60, 160, { alpha: 0.6 });
      s.arrow(128, 128, 128, 104);
      s.arrow(138, 146, 174, 146);
      s.arrow(128, 162, 128, 176);
      s.arrow(118, 146, 82, 146);
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
    ['Vic Viper (Classic, design mockup, not final)', 'vicviper-sheet', VIC_FRAMES],
    ['Warriors of Light (Classic, design mockup, not final)', 'warriors-sheet', WAR_FRAMES],
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
