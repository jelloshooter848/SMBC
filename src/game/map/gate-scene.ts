import type { InputFrame } from '@engine/input/input-manager';
import type { Action } from '@engine/input/actions';
import type { Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import { cardContinues, CARD_GUARD_FRAMES } from '../scenes/message';
import { pageSaid } from '../story/cards';
import type { Page } from '../story/script';
import { drawSparkle, WAND_SPARKLE } from '../entities/effects/wand-poof';
import { TOAD_BOX_Y } from './toad-guide';
import type { GateBreak } from './world-gate';

/*
 * The world gate breaking (docs/STORY.md 2.3b; campaign only), played over the world map by
 * scenes/world-map.ts in its `gate` mode, before the road on draws in:
 *
 * 1. The map dims and a framed cutaway opens over it: Bowser's throne room (dark castle stone, a
 *    lava glow below, his portrait on the wall, Bowser on his throne with the wand). The wand
 *    misfires, worse each world (MISFIRES); his pages show in the box at the top, OK the next,
 *    BACK the rest. The cutaway closes.
 * 2. On the map the seal at the page's edge cracks and shatters with a glassy sound.
 * World 8 has no cutaway: its seal is the rift's crack, which tears wide open (when it had been
 * seen shut) before Toad's rift scene.
 *
 * Original art, drawn here with rectangles and the game's own sprites (Bowser's `bowser-0`, the
 * star wand of his spell from the `story` sheet). Reduce flashing: nothing flickers or flashes; the sparkles keep one colour each.
 */

/** The cutaway's frame on the screen (below Toad's box at the top). */
export const CUTAWAY = { x: 40, y: 118, w: 176, h: 92 } as const;
export const GATE_OPEN_FRAMES = 14;
/** The misfire before Bowser's first page. */
export const GATE_MISFIRE_FRAMES = 64;
export const GATE_CLOSE_FRAMES = 12;
export const GATE_SHATTER_FRAMES = 40;
/** World 8's crack tearing open. */
export const GATE_TEAR_FRAMES = 56;
/** The frame of the misfire at which the wand goes wrong. */
const FIRE_AT = 20;

/** What each world's misfire looks like (2.3b), said by the announcer as the cutaway opens. */
export const MISFIRE_SAID: Readonly<Record<number, string>> = {
  1: "Meanwhile, in Bowser's throne room. He admires his wand, and its star sputters out a weak puff of smoke.",
  2: "Meanwhile, in Bowser's throne room. The wand sparks in his face and singes his eyebrows.",
  3: "Meanwhile, in Bowser's throne room. The wand fires by itself, and a bolt blasts his portrait off the wall.",
  4: "Meanwhile, in Bowser's throne room. The wand smokes and won't stop. He shakes it and glares at it.",
  5: "Meanwhile, in Bowser's throne room. He turns the wand in his claws and finds a glowing crack running up it.",
  6: "Meanwhile, in Bowser's throne room. The wand bucks in his hand, and a blast blows his throne to pieces under him.",
  7: "Meanwhile, in Bowser's throne room. The wand shakes wildly, throwing sparks everywhere. Bowser grips it with both claws and stands up, furious.",
};
export const SHATTER_SAID = 'The seal shatters! The road on is open.';
export const TEAR_SAID = 'The crack over 8-4 tears wide open, shimmering and humming.';

const MISFIRE_SFX: Readonly<Record<number, string>> = {
  1: 'bump',
  2: 'fireball',
  3: 'explosion',
  4: 'bowser-flame',
  5: 'wand-crack',
  6: 'explosion',
  7: 'magic',
};

export interface GateHooks {
  say(text: string): void;
  sfx(id: string): void;
  /** The OK prompt's text, asked each frame drawn. */
  prompt(): string;
  reduceFlashing(): boolean;
}

type Phase = 'open' | 'misfire' | 'page' | 'close' | 'shatter' | 'tear' | 'done';

const OK_KEYS: readonly Action[] = ['jump', 'start'];
const SKIP_KEYS: readonly Action[] = ['attack'];

/** A small pseudo-random number in [0, 1) from integers (fixed patterns: nothing shimmers at random). */
function hash(a: number, b: number): number {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export class GateScene {
  private phase: Phase;
  private t = 0;
  /** The misfire's clock: runs from the misfire through Bowser's pages. */
  private ft = 0;
  private page = 0;

  /**
   * `seal`: the top-left (px) of the page-edge tile the seal stands on (the gate exit's last
   * point).
   */
  constructor(
    readonly gate: GateBreak,
    readonly seal: { x: number; y: number },
    private readonly hooks: GateHooks,
  ) {
    if (gate.world === 8 || !gate.bowser.length) {
      this.phase = gate.tear ? 'tear' : 'done';
      if (gate.tear) {
        hooks.sfx('wand-crack');
        hooks.say(TEAR_SAID);
      }
    } else {
      this.phase = 'open';
      hooks.say(MISFIRE_SAID[gate.world] ?? MISFIRE_SAID[1] ?? '');
    }
  }

  get done(): boolean {
    return this.phase === 'done';
  }

  /** The seal still stands on the map (until it shatters, or the crack tears). */
  get sealShown(): boolean {
    return (
      this.phase === 'open' || this.phase === 'misfire' || this.phase === 'page' || this.phase === 'close'
    );
  }

  /** Bowser's lines in the box now, or null. */
  get lines(): Page | null {
    return this.phase === 'page' ? (this.gate.bowser[this.page] ?? null) : null;
  }

  /** The cutaway is over the map (opening, open or closing). */
  get cutaway(): boolean {
    return (
      this.phase === 'open' || this.phase === 'misfire' || this.phase === 'page' || this.phase === 'close'
    );
  }

  private set(phase: Phase): void {
    this.phase = phase;
    this.t = 0;
  }

  private showPage(i: number): void {
    this.page = i;
    this.set('page');
    const page = this.gate.bowser[i] as Page;
    this.hooks.say(pageSaid(page, i === this.gate.bowser.length - 1));
  }

  private startShatter(): void {
    this.set('shatter');
    this.hooks.sfx('seal-shatter');
    this.hooks.say(SHATTER_SAID);
  }

  update(inputs: readonly InputFrame[]): void {
    this.t++;
    if (this.cutaway && this.phase !== 'close') this.ft++;
    if (this.ft === FIRE_AT && this.phase !== 'page') this.hooks.sfx(MISFIRE_SFX[this.gate.world] ?? 'bump');
    switch (this.phase) {
      case 'open':
        if (this.t >= GATE_OPEN_FRAMES) this.set('misfire');
        return;
      case 'misfire':
        // OK or BACK hurries the misfire on to Bowser's first page.
        if (
          this.t > CARD_GUARD_FRAMES &&
          (cardContinues(this.t, inputs, OK_KEYS) || cardContinues(this.t, inputs, SKIP_KEYS))
        ) {
          this.ft = Math.max(this.ft, GATE_MISFIRE_FRAMES);
          this.showPage(0);
          return;
        }
        if (this.t >= GATE_MISFIRE_FRAMES) this.showPage(0);
        return;
      case 'page':
        if (cardContinues(this.t, inputs, SKIP_KEYS)) {
          this.set('close');
          return;
        }
        if (!cardContinues(this.t, inputs, OK_KEYS)) return;
        if (this.page < this.gate.bowser.length - 1) this.showPage(this.page + 1);
        else this.set('close');
        return;
      case 'close':
        if (this.t >= GATE_CLOSE_FRAMES) this.startShatter();
        return;
      case 'shatter':
        if (this.t >= GATE_SHATTER_FRAMES) this.set('done');
        return;
      case 'tear':
        if (this.t >= GATE_TEAR_FRAMES) this.set('done');
        return;
      default:
    }
  }

  /** The cutaway (over a dimmed map) and Bowser's box, or the shatter / tear at the seal. */
  draw(r: Renderer, assets: AssetRegistry): void {
    const reduce = this.hooks.reduceFlashing();
    if (this.phase === 'shatter') return drawShatter(r, this.seal.x, this.seal.y, this.t, reduce);
    if (this.phase === 'tear') return drawTear(r, this.seal.x, this.seal.y, this.t, reduce);
    if (!this.cutaway) return;
    // How open the cutaway is, 0..1.
    const k =
      this.phase === 'open'
        ? this.t / GATE_OPEN_FRAMES
        : this.phase === 'close'
          ? Math.max(0, 1 - this.t / GATE_CLOSE_FRAMES)
          : 1;
    r.rect(0, 0, 256, 240, `rgba(0,0,0,${(0.55 * k).toFixed(2)})`);
    const c = CUTAWAY;
    const h = Math.max(2, Math.round(c.h * k));
    const y = c.y + ((c.h - h) >> 1);
    r.rect(c.x - 3, y - 3, c.w + 6, h + 6, '#fcfcfc');
    r.rect(c.x - 1, y - 1, c.w + 2, h + 2, '#000');
    if (k >= 1) drawThroneRoom(r, assets, this.gate.world, this.ft, reduce);
    else r.rect(c.x, y, c.w, h, '#201820');
    const lines = this.lines;
    if (lines) drawBox(r, assets, lines, this.t > CARD_GUARD_FRAMES ? this.hooks.prompt() : '');
  }
}

/** The box at the top of the map (as Toad's, map/toad-guide.ts): the lines centred, the OK prompt. */
function drawBox(r: Renderer, assets: AssetRegistry, lines: Page, prompt: string): void {
  const font = assets.sheet('font');
  const h = (lines.length + 1) * 10 + 12;
  const y = TOAD_BOX_Y;
  r.rect(12, y, 256 - 24, h, '#fcfcfc');
  r.rect(14, y + 2, 256 - 28, h - 4, '#000');
  lines.forEach((l, i) => r.text(font, l, (256 - l.length * 8) >> 1, y + 7 + i * 10));
  if (prompt) r.text(font, prompt, 256 - 20 - prompt.length * 8, y + 7 + lines.length * 10);
}

const STONE = '#2c2430';
const MORTAR = '#1a141c';
const FLOOR = '#4c4048';
const FLOOR_TOP = '#7c6c74';
const GOLD = '#fca044';
const GOLD_DARK = '#a86010';
const VELVET = '#a80020';
const VELVET_DARK = '#680010';
const SMOKE = ['#bcbcbc', '#7c7c7c'] as const;
const LAVA = ['#f83800', '#fc7460', '#fca044'] as const;

/** A soft round puff (smoke), radius `rad`, at (x, y). */
function puff(r: Renderer, x: number, y: number, rad: number, color: string): void {
  const s = Math.max(1, Math.round(rad));
  r.rect(x - s, y - s + 1, 2 * s, 2 * s - 2, color);
  r.rect(x - s + 1, y - s, 2 * s - 2, 2 * s, color);
}

/**
 * Bowser's throne room inside the cutaway, `ft` frames into the misfire of world `world` (the
 * effect stays as it ended while his pages show).
 */
function drawThroneRoom(
  r: Renderer,
  assets: AssetRegistry,
  world: number,
  ft: number,
  reduce: boolean,
): void {
  const c = CUTAWAY;
  const x0 = c.x;
  const y0 = c.y;
  const floorY = y0 + c.h - 22;
  // Castle stone, brick rows staggered.
  r.rect(x0, y0, c.w, c.h, STONE);
  for (let row = 0; y0 + row * 8 < floorY; row++) {
    const y = y0 + row * 8;
    r.rect(x0, y + 7, c.w, 1, MORTAR);
    for (let x = (row & 1) * 8; x < c.w; x += 16) r.rect(x0 + x, y, 1, 7, MORTAR);
  }
  // The floor, and the lava's glow below it.
  r.rect(x0, floorY, c.w, 10, FLOOR);
  r.rect(x0, floorY, c.w, 1, FLOOR_TOP);
  for (let x = 0; x < c.w; x += 2) {
    const wave = Math.round(1.5 + 1.5 * Math.sin((x + ft * (reduce ? 0.5 : 1)) / 9));
    const top = floorY + 10 + wave;
    r.rect(x0 + x, top, 2, y0 + c.h - top, LAVA[0]);
    r.rect(x0 + x, top + 3, 2, Math.max(0, y0 + c.h - top - 3), LAVA[1]);
    r.rect(x0 + x, top + 7, 2, Math.max(0, y0 + c.h - top - 7), LAVA[2]);
  }
  const fired = ft >= FIRE_AT;
  // His portrait, left of the throne (blasted off in World 3, and gone from then on).
  const px = x0 + 22;
  const py = y0 + 10;
  if (world > 3 || (world === 3 && fired)) drawBlastedPortrait(r, px, py, world === 3 ? ft - FIRE_AT : 99);
  else drawPortrait(r, assets, px, py);
  // The throne (in World 6 blown to pieces under him).
  const tx = x0 + 104;
  const blasted = world === 6 && ft >= FIRE_AT + 6;
  if (blasted) drawRubble(r, tx, floorY);
  else drawThrone(r, tx, floorY);
  // Bowser: seated; World 6 on his shell once the throne goes; World 7 standing, wand in both claws.
  const enemies = assets.sheet('enemies', 'enemies-castle');
  let bx = tx + 8;
  let by = floorY - 16 - 28;
  let flipY = false;
  if (world === 7) by = floorY - 32;
  if (blasted) {
    // Thrown up by the blast, he lands on his shell.
    const k = Math.min(1, (ft - FIRE_AT - 6) / 10);
    by = Math.round(floorY - 30 - 20 * Math.sin(k * Math.PI));
    flipY = true;
  }
  const shaking = (world === 4 && fired) || world === 7;
  if (shaking && !reduce) bx += (ft >> 1) & 1 ? 1 : -1;
  else if (shaking && (ft >> 3) & 1) bx += 1;
  const mouth = (world === 2 || world === 3 || world === 6 || world === 7) && fired ? 2 : 0;
  r.sprite(enemies, `bowser-${mouth}`, bx, by, false, flipY);
  // The wand in his claw (none once he lies on his shell).
  if (blasted) return drawBlast(r, tx + 24, floorY - 20, ft - FIRE_AT, reduce);
  // The star wand from Bowser's spell (story sheet, story/bowser-spell.ts), held as he holds it
  // there; its star twinkles now and then until it misfires (never with reduce flashing).
  let wx = bx - 7;
  let wy = by + 2;
  if (world === 7) {
    const j = reduce ? 1 : 2;
    wx += Math.round(Math.sin(ft * 1.7) * j);
    wy += Math.round(Math.cos(ft * 2.3) * j);
  }
  const twinkle = !reduce && !fired && ft % 40 < 8;
  r.sprite(assets.sheet('story'), twinkle ? 'star-wand-1' : 'star-wand-0', wx, wy);
  // World 5: a glowing crack runs up the rod from its foot into the star.
  if (world === 5 && fired) drawWandCrack(r, wx, wy, ft - FIRE_AT);
  // The star at the top of the wand: where the misfire comes out.
  const ox = wx + 4;
  const oy = wy + 4;
  drawMisfire(r, world, ft - FIRE_AT, ox, oy, { bx, by, px, py }, reduce);
  if (world === 6 && ft >= FIRE_AT && ft < FIRE_AT + 30)
    drawBlast(r, tx + 24, floorY - 20, ft - FIRE_AT, reduce);
}

/**
 * The crack in the star wand (World 5), `since` frames after the misfire: a pale zigzag climbing
 * the rod (9x17 sprite at (wx, wy), rod at x 4, rows 8-15) into the star, one pixel a frame; it
 * stays lit, it never blinks.
 */
function drawWandCrack(r: Renderer, wx: number, wy: number, since: number): void {
  const path: readonly (readonly [number, number])[] = [
    [4, 15],
    [3, 14],
    [4, 13],
    [5, 12],
    [4, 11],
    [3, 10],
    [4, 9],
    [5, 8],
    [4, 7],
    [3, 6],
    [4, 5],
  ];
  const n = Math.min(path.length, Math.max(0, since + 1));
  for (let i = 0; i < n; i++) {
    const [x, y] = path[i] as readonly [number, number];
    r.rect(wx + x, wy + y, 1, 1, i % 2 ? '#fcfcfc' : '#f8d878');
  }
}

/** His gold-framed portrait (his own face at half size), top-left (x, y). */
function drawPortrait(r: Renderer, assets: AssetRegistry, x: number, y: number): void {
  r.rect(x, y, 26, 28, GOLD_DARK);
  r.rect(x + 1, y + 1, 24, 26, GOLD);
  r.rect(x + 3, y + 3, 20, 22, VELVET_DARK);
  r.sprite(assets.sheet('enemies', 'enemies-castle'), 'bowser-0', x + 5, y + 6, false, false, 0, 0.5);
}

/** The portrait's frame after the bolt: scorched black, hanging crooked, bits falling for a while. */
function drawBlastedPortrait(r: Renderer, x: number, y: number, since: number): void {
  r.rect(x + 2, y + 2, 24, 28, GOLD_DARK);
  r.rect(x + 3, y + 3, 22, 26, '#100c0c');
  r.rect(x + 8, y + 10, 3, 2, '#3c3030');
  r.rect(x + 15, y + 17, 4, 2, '#3c3030');
  if (since < 40)
    for (let i = 0; i < 5; i++) {
      const fx = x + 4 + i * 4 + Math.round((hash(i, 3) - 0.5) * since * 0.6);
      const fy = y + 14 + Math.round(since * since * 0.03 + i * 2);
      r.rect(fx, fy, 2, 2, i & 1 ? GOLD : '#3c3030');
    }
}

/** The throne: a tall red-velvet back in gold, arms and a seat; `floor` is the floor's top. */
function drawThrone(r: Renderer, x: number, floor: number): void {
  r.rect(x + 6, floor - 48, 36, 34, GOLD_DARK);
  r.rect(x + 7, floor - 47, 34, 32, GOLD);
  r.rect(x + 10, floor - 44, 28, 28, VELVET);
  r.rect(x + 10, floor - 44, 28, 2, VELVET_DARK);
  // Three gold points on top.
  for (const dx of [8, 22, 36]) {
    r.rect(x + dx, floor - 52, 4, 4, GOLD);
    r.rect(x + dx + 1, floor - 54, 2, 2, GOLD);
  }
  r.rect(x, floor - 28, 7, 14, GOLD);
  r.rect(x + 41, floor - 28, 7, 14, GOLD);
  r.rect(x + 2, floor - 18, 44, 6, VELVET_DARK);
  r.rect(x + 2, floor - 18, 44, 2, VELVET);
  r.rect(x + 3, floor - 12, 4, 12, GOLD_DARK);
  r.rect(x + 41, floor - 12, 4, 12, GOLD_DARK);
}

/** What is left of the throne: gold and red pieces scattered on the floor. */
function drawRubble(r: Renderer, x: number, floor: number): void {
  for (let i = 0; i < 9; i++) {
    const px = x - 6 + Math.round(hash(i, 1) * 60);
    const w = 3 + Math.round(hash(i, 2) * 5);
    r.rect(px, floor - 3, w, 3, i % 3 === 0 ? VELVET : GOLD_DARK);
  }
}

/** A burst of fire and smoke at (x, y), `since` frames old. */
function drawBlast(r: Renderer, x: number, y: number, since: number, reduce: boolean): void {
  if (since < 0 || since >= 34) return;
  const k = Math.min(1, since / 30);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const d = 6 + 18 * k;
    const color = since < 10 && !reduce ? LAVA[i % 3] : (SMOKE[i & 1] as string);
    puff(
      r,
      Math.round(x + Math.cos(a) * d),
      Math.round(y + Math.sin(a) * d * 0.6 - since * 0.3),
      4 - 2 * k,
      color as string,
    );
  }
}

/**
 * The wand going wrong (`since` frames after it does; negative: not yet), from its orb at (ox, oy):
 * 1 a weak grey puff; 2 sparks into his face, smoke over his eyes; 3 a bolt into the portrait;
 * 4 smoke that won't stop; 5 a glowing crack (the wand's own frame); 6 the blast (drawThroneRoom);
 * 7 sparks everywhere.
 */
function drawMisfire(
  r: Renderer,
  world: number,
  since: number,
  ox: number,
  oy: number,
  at: { bx: number; by: number; px: number; py: number },
  reduce: boolean,
): void {
  const sparkle = (x: number, y: number, size: number, i: number) =>
    drawSparkle(r, x, y, size, WAND_SPARKLE[reduce ? i % 3 : (i + (since >> 2)) % 3] as string);
  // A soft glow on the orb before anything goes wrong.
  if (since < 0) {
    sparkle(ox, oy - 3, since > -8 ? 1 : 0, 0);
    return;
  }
  switch (world) {
    case 1:
      // A sputter: a couple of sparks, then one weak puff rising and fading.
      if (since < 6) sparkle(ox + 2, oy - 4, 1, 1);
      if (since < 44)
        puff(r, ox + 1, oy - 4 - Math.round(since / 4), 1 + since / 14, SMOKE[since < 24 ? 0 : 1]);
      return;
    case 2: {
      // Sparks fly from the orb into his face, then two little smoke puffs over his eyes.
      const eyeX = at.bx + 7;
      const eyeY = at.by + 7;
      if (since < 12)
        for (let i = 0; i < 4; i++) {
          const k = Math.min(1, since / 10 + i * 0.05);
          sparkle(Math.round(ox + (eyeX - ox) * k + i), Math.round(oy + (eyeY - oy) * k - i), 1, i);
        }
      const p = since % 40;
      for (const dx of [0, 7])
        puff(r, eyeX + dx, eyeY - 3 - Math.round(p / 6), 1 + (p < 20 ? 1 : 0), SMOKE[p < 20 ? 0 : 1]);
      return;
    }
    case 3: {
      // A bolt from the orb into the portrait.
      if (since < 10) {
        const tx = at.px + 13;
        const ty = at.py + 14;
        for (let i = 0; i <= 8; i++) {
          const k = i / 8;
          const zig = i % 2 === 0 ? -2 : 2;
          r.rect(
            Math.round(ox + (tx - ox) * k),
            Math.round(oy + (ty - oy) * k + zig),
            3,
            2,
            i & 1 ? '#fcfcfc' : '#fce4a0',
          );
        }
      }
      const p = (since + 20) % 36;
      puff(r, at.px + 14, at.py + 6 - Math.round(p / 4), 2, SMOKE[p < 18 ? 0 : 1]);
      return;
    }
    case 4: {
      // Smoke, pouring out and not stopping.
      for (let i = 0; i < 4; i++) {
        const p = (since + i * 11) % 44;
        puff(
          r,
          ox + Math.round(Math.sin((p + i * 7) / 6) * 3),
          oy - 3 - p,
          1 + p / 16,
          SMOKE[p < 22 ? 0 : 1],
        );
      }
      return;
    }
    case 5:
      // The crack glows: a few sparkles creeping along the rod.
      for (let i = 0; i < 3; i++) sparkle(ox - 2 + i * 2, oy + 4 + (((since >> 3) + i * 3) % 10), 0, i);
      return;
    case 7: {
      // Sparks thrown everywhere.
      for (let i = 0; i < 8; i++) {
        const p = (since + i * 7) % 28;
        const a = hash(i, Math.floor((since + i * 7) / 28)) * Math.PI * 2;
        sparkle(
          Math.round(ox + Math.cos(a) * p * 1.2),
          Math.round(oy + Math.sin(a) * p * 0.9),
          p < 14 ? 1 : 0,
          i,
        );
      }
      return;
    }
    default:
  }
}

/** The seal across a road at the page's edge: a shimmering wall of wand sparkles on tile (x, y) px. */
export function drawSeal(r: Renderer, x: number, y: number, t: number, reduce: boolean): void {
  r.rect(x + 2, y - 8, 12, 32, 'rgba(120,48,200,0.45)');
  r.rect(x + 4, y - 8, 8, 32, 'rgba(176,112,232,0.55)');
  r.rect(x + 6, y - 8, 4, 32, 'rgba(248,216,248,0.5)');
  for (let i = 0; i < 8; i++) {
    const sy = y - 6 + i * 4;
    const sx = x + 4 + ((i * 3) % 8);
    const size = reduce ? (i % 2 === 0 ? 1 : 0) : ((t >> 3) + i) % 3 === 0 ? 1 : 0;
    drawSparkle(r, sx, sy, size, WAND_SPARKLE[reduce ? i % 3 : (i + (t >> 4)) % 3] as string);
  }
}

/** The rift's crack while it is held shut (World 8, Sophia III still captive): a thin dark tear. */
export function drawCrack(r: Renderer, x: number, y: number, t: number, reduce: boolean, open = 0): void {
  const h = 10 + Math.round(open * 18);
  const w = 1 + Math.round(open * 4);
  const cx = x + 8;
  const top = y + 8 - (h >> 1);
  for (let i = 0; i < h; i++) {
    const zig = Math.round(Math.sin(i * 1.3) * (1 + open * 2));
    r.rect(cx + zig - w, top + i, 2 * w + 1, 1, '#b070e8');
    r.rect(cx + zig - Math.max(0, w - 1), top + i, Math.max(1, 2 * w - 1), 1, '#1c0c3c');
  }
  drawSparkle(r, cx + 3, top - 1, reduce ? 0 : (t >> 4) & 1, WAND_SPARKLE[0]);
}

/** The seal cracking, then bursting into shards that fall away, `t` frames in. */
function drawShatter(r: Renderer, x: number, y: number, t: number, reduce: boolean): void {
  if (t < 8) {
    drawSeal(r, x, y, 0, true);
    // Cracks run across it.
    for (let i = 0; i < 6; i++) r.rect(x + 5 + ((i * 5) % 7), y - 4 + i * 4, 3, 1, '#fcfcfc');
    return;
  }
  const s = t - 8;
  for (let i = 0; i < 12; i++) {
    const a = hash(i, 5) * Math.PI * 2;
    const v = 0.8 + hash(i, 9) * 1.4;
    const sx = Math.round(x + 8 + Math.cos(a) * v * s * 0.8);
    const sy = Math.round(y + 8 + Math.sin(a) * v * s * 0.6 + s * s * 0.04);
    const color = WAND_SPARKLE[reduce ? i % 3 : (i + (s >> 2)) % 3] as string;
    r.rect(sx, sy, i & 1 ? 2 : 3, i & 1 ? 3 : 2, color);
  }
}

/** World 8: the crack tearing wide open, `t` frames in, then fading as the road draws in. */
function drawTear(r: Renderer, x: number, y: number, t: number, reduce: boolean): void {
  const k = Math.min(1, t / (GATE_TEAR_FRAMES * 0.6));
  drawCrack(r, x, y, t, reduce, k);
  drawSparkle(r, x + 2, y + 8 - Math.round(k * 10), reduce ? 1 : (t >> 2) & 1, WAND_SPARKLE[1]);
}
