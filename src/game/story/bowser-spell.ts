import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import type { Action } from '@engine/input/actions';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import { toPx } from '@engine/math/units';
import { fxPalette } from '@content/sprites/palette-fx';
import type { Game } from '@game/scenes/game';
import type { World } from '@game/world/world';
import type { CharacterDef } from '@game/characters/character';
import { startHp } from '@game/characters/character';
import { Player } from '@game/entities/player';
import { enemyPalette } from '@game/entities/enemies/enemy';
import { drawSparkle, WAND_SPARKLE } from '@game/entities/effects/wand-poof';
import { SKY } from '@game/world/tile-render';
import { CARD_GUARD_FRAMES } from '@game/scenes/message';
import { abilityHint } from '@game/scenes/hints';
import { NO_TOUCH_BUTTONS } from '@game/touch-labels';
import { fontText } from '@game/hud/text';
import { pageSaid } from './cards';
import { BOWSER_SPELL_LAST, BOWSER_SPELL_PAGES, BOWSER_SPELL_SAID, type Page } from './script';

/*
 * Bowser's spell at the end of 1-0 (docs/STORY.md 2.2; campaign only, in place of the shadow
 * tease): the music stops and the sky dims, a column of wand sparkles drops between Mario and
 * the flagpole and Bowser stands in it in full colour. His four pages show in the box at the top
 * (the wand comes out on the second); then the spell: the wand goes up, its star flares and eight
 * sparks fly off the top, and eight framed windows open on a dark screen, one a half second, each
 * a strip of a hero's world with that hero pulled down into it by a beam of sparks, in the captive
 * palette and half hidden. Back in 1-0 for his last page; he vanishes in a puff, the sky clears,
 * the music comes back.
 *
 * No text moves on by itself: every page waits for OK (or MENU). BACK on a page skips the rest of
 * the scene (he vanishes); OK or BACK while the windows open skips to his last page. The windows
 * and the puff are animations on timers. With reduce flashing the star glows steadily and the
 * sparkles keep their colours.
 */

/** Frames: the sky dims, the sparkle column falls, Bowser stands in it, the first page shows. */
export const SPELL_TIMING = {
  dim: 30,
  columnFrom: 16,
  columnFall: 24,
  /** Bowser appears (the column has landed). */
  bowserAt: 40,
  firstPage: 64,
  /** The wand goes over his head; the star flares; the sparks fly; then the windows. */
  raise: 20,
  flareAt: 20,
  sparksEnd: 56,
  /** The windows: the first opens this many frames in, then one every `windowGap` (half a second). */
  windowFrom: 10,
  windowGap: 30,
  /** A window's shutter opening, and the hero's fall down its beam. */
  windowOpen: 8,
  heroFall: 18,
  /** After the eighth window, a beat before the last page. */
  windowsHold: 50,
  /** Bowser's puff and the sky clearing. */
  vanish: 30,
} as const;
const T = SPELL_TIMING;

/** The eight heroes, in world order, and the look of each window's strip (a level theme). */
export const SPELL_WINDOWS: readonly { hero: string; theme: string }[] = [
  { hero: 'luigi', theme: 'overworld' },
  { hero: 'link', theme: 'zelda2' },
  { hero: 'megaman', theme: 'megaman-stage' },
  { hero: 'samus', theme: 'brinstar' },
  { hero: 'simon', theme: 'crypt' },
  { hero: 'ryu', theme: 'ninja-city' },
  { hero: 'bill', theme: 'contra-jungle' },
  { hero: 'sophia', theme: 'underworld' },
];

/** A window's box (outer, frame included), by index 0-7: two rows of four. */
export const WINDOW_W = 52;
export const WINDOW_H = 64;
export function windowBox(i: number): { x: number; y: number } {
  return { x: 10 + (i % 4) * 61, y: 44 + Math.floor(i / 4) * 92 };
}

/** The frame (since the windows began) window `i` starts to open. */
export const windowAt = (i: number): number => T.windowFrom + i * T.windowGap;
/** Frames the windows take before the last page comes on its own. */
export const WINDOWS_END = windowAt(SPELL_WINDOWS.length - 1) + T.windowOpen + T.heroFall + T.windowsHold;

type Phase = 'appear' | 'page' | 'raise' | 'windows' | 'last' | 'vanish' | 'done';

const OK_KEYS: readonly Action[] = ['jump', 'start'];
const BACK_KEYS: readonly Action[] = ['attack'];
const pressed = (inputs: readonly InputFrame[], keys: readonly Action[]) =>
  inputs.some((i) => keys.some((k) => i.pressed(k)));

/** Top of the pages' box, under the HUD (as every story card at the top). */
const BOX_Y = 40;

export class BowserSpellScene implements Scene {
  readonly translucent = true;
  private phase: Phase = 'appear';
  /** Frames into the scene, and into the current phase. */
  private t = 0;
  private pt = 0;
  private page = 0;
  /** Screen x of Bowser's 32x32 box, and the ground line both stand on. */
  private readonly bx: number;
  private readonly feet: number;
  /** The heroes' poses for the windows (null: that hero is not in this build). */
  private readonly heroes: (Player | null)[];

  constructor(
    private readonly game: Game,
    private readonly world: World,
    private readonly next: () => void,
  ) {
    const p = world.player;
    const camX = world.camera.pxX;
    const mx = toPx(p.body.x) - camX;
    this.feet = toPx(p.body.y + p.body.h);
    // Between Mario and the flagpole (or a few steps ahead of him), always on screen.
    const pole = world.entities.find((e) => e.kind === 'flagpole');
    const px = pole ? toPx(pole.body.x) - camX : mx + 112;
    const mid = Math.round((mx + 16 + px) / 2) - 16;
    this.bx = Math.max(mx + 28, Math.min(SCREEN_W - 44, mid));
    const chars = game.deps.characters;
    this.heroes = SPELL_WINDOWS.map(({ hero }) => {
      const def = chars.find((c) => c.id === hero);
      return def ? pose(def) : null;
    });
  }

  /** The page in the box now, or null while none shows. */
  get lines(): Page | null {
    if (this.phase === 'page') return BOWSER_SPELL_PAGES[this.page] ?? null;
    if (this.phase === 'last') return BOWSER_SPELL_LAST;
    return null;
  }

  /** The eight windows are on screen (the spell). */
  get windows(): boolean {
    return this.phase === 'windows';
  }

  /** Bowser stands in the level (not before the column lands, not after his puff). */
  get bowserShown(): boolean {
    return (
      this.phase !== 'windows' && this.phase !== 'done' && !(this.phase === 'appear' && this.t < T.bowserAt)
    );
  }

  get stage(): Phase {
    return this.phase;
  }

  enter(): void {
    this.game.ctx.audio.stopMusic();
    this.game.deps.announcer?.say('The sky darkens. A column of sparkles falls, and Bowser appears.');
  }

  touchLabels(): TouchLabels {
    if (this.phase === 'page' || this.phase === 'last')
      return this.pt > CARD_GUARD_FRAMES
        ? { ...NO_TOUCH_BUTTONS, jump: 'OK', attack: 'BACK' }
        : NO_TOUCH_BUTTONS;
    if (this.phase === 'windows' && this.pt > CARD_GUARD_FRAMES) return { ...NO_TOUCH_BUTTONS, jump: 'SKIP' };
    return NO_TOUCH_BUTTONS;
  }

  private go(phase: Phase): void {
    this.phase = phase;
    this.pt = 0;
  }

  private showPage(i: number): void {
    this.page = i;
    this.go('page');
    const page = BOWSER_SPELL_PAGES[i] as Page;
    this.game.deps.announcer?.say(pageSaid(page, false));
  }

  update(_input: InputFrame, inputs: InputFrame[]): void {
    if (this.phase === 'done') return;
    this.t++;
    this.pt++;
    const audio = this.game.ctx.audio;
    const p = this.world.player;
    const guarded = this.pt > CARD_GUARD_FRAMES;
    switch (this.phase) {
      case 'appear':
        if (this.t === T.bowserAt) {
          audio.sfx('poof');
          audio.sfx('bowser-laugh');
          p.facing = 1; // Mario turns to face him
        }
        if (this.t >= T.firstPage) this.showPage(0);
        return;
      case 'page':
        if (guarded && pressed(inputs, BACK_KEYS)) return this.go('vanish');
        if (!guarded || !pressed(inputs, OK_KEYS)) return;
        if (this.page < BOWSER_SPELL_PAGES.length - 1) this.showPage(this.page + 1);
        else this.go('raise');
        return;
      case 'raise':
        if (this.pt === T.flareAt) audio.sfx('magic');
        if (this.pt >= T.sparksEnd) {
          this.go('windows');
          this.game.deps.announcer?.say(BOWSER_SPELL_SAID);
        }
        return;
      case 'windows': {
        for (let i = 0; i < SPELL_WINDOWS.length; i++) if (this.pt === windowAt(i)) audio.sfx('coin');
        const skip = guarded && pressed(inputs, [...OK_KEYS, ...BACK_KEYS]);
        if (skip || this.pt >= WINDOWS_END) {
          this.go('last');
          audio.sfx('bowser-laugh');
          this.game.deps.announcer?.say(pageSaid(BOWSER_SPELL_LAST, true));
        }
        return;
      }
      case 'last':
        if (guarded && pressed(inputs, [...OK_KEYS, ...BACK_KEYS])) {
          this.go('vanish');
          audio.sfx('poof');
        }
        return;
      case 'vanish':
        if (this.pt >= T.vanish) {
          this.phase = 'done';
          p.facing = 1;
          this.next();
        }
        return;
      default:
    }
  }

  /* ---------- drawing ---------- */

  render(r: Renderer): void {
    if (this.phase === 'windows') return this.renderWindows(r);
    const reduce = this.game.ctx.reduceFlashing;
    // The sky dims (and clears again as he vanishes).
    let k = Math.min(1, this.t / T.dim);
    if (this.phase === 'vanish') k = Math.max(0, 1 - this.pt / T.vanish);
    if (k > 0) r.rect(0, 0, SCREEN_W, SCREEN_H, `rgba(0,0,0,${(0.5 * k).toFixed(3)})`);
    this.redrawMario(r);
    const by = this.feet - 32;
    const cx = this.bx + 16;
    // The column of wand sparkles falling onto the ground where he will stand.
    if (this.phase === 'appear' && this.t >= T.columnFrom && this.t < T.bowserAt + 10) {
      const fall = Math.min(1, (this.t - T.columnFrom) / T.columnFall);
      const bottom = Math.round(this.feet * fall);
      for (let y = bottom; y > 0; y -= 7) {
        const c = reduce ? (y >> 3) % 3 : ((y >> 3) + (this.t >> 2)) % 3;
        drawSparkle(r, cx + (((y * 13) >> 3) % 9) - 4, y, y > bottom - 14 ? 2 : 1, WAND_SPARKLE[c] as string);
      }
    }
    if (this.bowserShown && this.phase !== 'vanish') this.drawBowser(r, by, reduce);
    // His arrival's puff, and his going.
    const puff = this.phase === 'appear' ? this.t - T.bowserAt : this.phase === 'vanish' ? this.pt : -1;
    if (puff >= 0 && puff < T.vanish) drawPuff(r, cx, by + 16, puff, reduce);
    const lines = this.lines;
    if (lines) this.drawBox(r, lines);
  }

  /** Mario drawn again over the dimmed sky, so he stays in full colour like Bowser. */
  private redrawMario(r: Renderer): void {
    const p = this.world.player;
    if (p.dead || p.out || p.hidden) return;
    const assets = this.game.ctx.assets;
    const s = p.def.sprite(p, this.world.frame, this.game.ctx.reduceFlashing);
    const sheet = assets.sheet(s.sheet, s.palette);
    const w = sheet.frames.get(s.frame)?.w ?? 16;
    const bw = toPx(p.body.w);
    const x = toPx(p.body.x) - this.world.camera.pxX - (s.flip ? w - bw - s.offsetX : s.offsetX);
    r.sprite(sheet, s.frame, x, toPx(p.body.y) - s.offsetY, s.flip);
  }

  private drawBowser(r: Renderer, by: number, reduce: boolean): void {
    const assets = this.game.ctx.assets;
    const talking =
      (this.phase === 'page' || this.phase === 'last') && this.pt < 48 && ((this.pt >> 3) & 1) === 1;
    const frame = talking || this.phase === 'raise' ? 'bowser-2' : 'bowser-0';
    r.sprite(assets.sheet('enemies', enemyPalette('castle')), frame, this.bx, by);
    // The wand: out from his second page, over his head for the spell.
    const held = (this.phase === 'page' && this.page >= 1) || this.phase === 'last';
    const story = assets.sheet('story');
    const twinkle = !reduce && this.t % 40 < 8 ? 'star-wand-1' : 'star-wand-0';
    if (held) r.sprite(story, twinkle, this.bx - 7, by + 2);
    if (this.phase !== 'raise') return;
    const k = Math.min(1, this.pt / T.raise);
    const wx = Math.round(this.bx - 7 + (18 - -7) * k * 0.72);
    const wy = Math.round(by + 2 - 22 * k);
    r.sprite(story, 'star-wand-0', wx, wy);
    const sx = wx + 4;
    const sy = wy + 4;
    if (this.pt >= T.flareAt) {
      const f = this.pt - T.flareAt;
      if (reduce) {
        // A steady glow: a pale ring and a halo that never blink.
        r.rect(sx - 7, sy - 7, 15, 15, 'rgba(248,216,120,0.35)');
        r.rect(sx - 4, sy - 4, 9, 9, 'rgba(252,252,252,0.45)');
      } else {
        if (f < 4) r.rect(0, 0, SCREEN_W, SCREEN_H, 'rgba(252,252,252,0.5)');
        const rad = 4 + (f % 12);
        for (let a = 0; a < 8; a++) {
          const ang = (a * Math.PI) / 4;
          drawSparkle(
            r,
            Math.round(sx + Math.cos(ang) * rad),
            Math.round(sy + Math.sin(ang) * rad),
            1,
            '#fcfcfc',
          );
        }
      }
      // Eight sparks shoot off the top of the screen.
      for (let i = 0; i < 8; i++) {
        const y = Math.round(sy - f * 7 - (i % 3) * 5);
        const x = Math.round(sx + (i - 3.5) * f * 1.6);
        if (y > -4) drawSparkle(r, x, y, 2, WAND_SPARKLE[reduce ? i % 3 : (i + (f >> 2)) % 3] as string);
      }
    }
  }

  private drawBox(r: Renderer, lines: Page): void {
    const font = this.game.ctx.assets.sheet('font');
    const prompt = fontText(abilityHint(this.game, 'OK', 'jump'));
    const h = (lines.length + 1) * 10 + 12;
    r.rect(12, BOX_Y, SCREEN_W - 24, h, '#fcfcfc');
    r.rect(14, BOX_Y + 2, SCREEN_W - 28, h - 4, '#000');
    lines.forEach((l, i) => r.text(font, l, (SCREEN_W - l.length * 8) >> 1, BOX_Y + 7 + i * 10));
    if (this.pt > CARD_GUARD_FRAMES)
      r.text(font, prompt, SCREEN_W - 20 - prompt.length * 8, BOX_Y + 7 + lines.length * 10);
  }

  /** The dark screen and the eight windows, each opening in turn. */
  private renderWindows(r: Renderer): void {
    r.rect(0, 0, SCREEN_W, SCREEN_H, '#000');
    const reduce = this.game.ctx.reduceFlashing;
    SPELL_WINDOWS.forEach((w, i) => {
      const since = this.pt - windowAt(i);
      if (since < 0) return;
      drawWindow(r, this.game, i, w.theme, this.heroes[i] ?? null, since, this.pt, reduce);
    });
  }
}

/** A hero as a captive stands: its idle pose (big if it can be). */
function pose(def: CharacterDef): Player {
  const states = def.damage.kind === 'powerup' ? def.damage.states : [];
  const power =
    def.damage.kind === 'powerup' ? (states.includes('big') ? 'big' : (states[0] ?? 'small')) : 'full';
  const p = new Player(0, 0, def, power, startHp(def));
  p.body.onGround = true;
  p.facing = 1;
  return p;
}

/** A ring of wand sparkles flung out from (cx, cy), `age` frames old (as the fakes' "poof"). */
function drawPuff(r: Renderer, cx: number, cy: number, age: number, reduce: boolean): void {
  const k = age / SPELL_TIMING.vanish;
  const dist = 24 * (1 - (1 - k) * (1 - k));
  const size = k < 0.4 ? 2 : k < 0.75 ? 1 : 0;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const d = dist * (i & 1 ? 0.7 : 1);
    const c = reduce ? i % 3 : (i + (age >> 2)) % 3;
    drawSparkle(
      r,
      Math.round(cx + Math.cos(a) * d),
      Math.round(cy + Math.sin(a) * d),
      size,
      WAND_SPARKLE[c] as string,
    );
  }
}

/**
 * Window `i`: a white frame round a strip of its world (the theme's sky over a row of its ground),
 * its number in the corner, the hero pulled down a beam of sparks onto the ground, then standing
 * there in the captive palette under a dark vignette and drifting sparkles (half hidden).
 */
function drawWindow(
  r: Renderer,
  game: Game,
  i: number,
  theme: string,
  hero: Player | null,
  since: number,
  clock: number,
  reduce: boolean,
): void {
  const T2 = SPELL_TIMING;
  const { x, y } = windowBox(i);
  const assets = game.ctx.assets;
  // The shutter: the window grows from its middle row to its full height.
  const open = Math.min(1, (since + 1) / T2.windowOpen);
  const h = Math.max(2, Math.round(WINDOW_H * open));
  const top = y + ((WINDOW_H - h) >> 1);
  r.rect(x, top, WINDOW_W, h, '#fcfcfc');
  if (open < 1) return;
  // Inside: 48x60, the sky over one row of the theme's ground.
  const ix = x + 2;
  const iy = y + 2;
  const iw = WINDOW_W - 4;
  const ih = WINDOW_H - 4;
  const ground = iy + ih - 16;
  r.rect(ix, iy, iw, ih, SKY[theme] ?? '#000');
  const tiles = assets.sheet('tiles', `tiles-${theme}`);
  const tile = tiles.frames.has(`ground@${theme}`) ? `ground@${theme}` : 'ground';
  for (let tx = 0; tx < iw; tx += 16) r.sprite(tiles, tile, ix + tx, ground);
  if (hero) {
    const s = hero.def.sprite(hero, 0, true);
    const sheet = assets.sheet(s.sheet, fxPalette(s.palette, 'brainwashed'));
    const fr = sheet.frames.get(s.frame);
    const fw = fr?.w ?? 16;
    const fh = fr?.h ?? 16;
    const hx = ix + ((iw - fw) >> 1);
    // From the window's top down to its ground.
    const fall = Math.max(0, Math.min(1, (since - T2.windowOpen) / T2.heroFall));
    const feetY = Math.round(iy + (ground - fh - iy) * fall);
    // The beam of sparks it is pulled down by (gone once it has landed).
    if (fall < 1)
      for (let by = iy + 2; by < feetY + fh; by += 6) {
        const c = reduce ? (by >> 2) % 3 : ((by >> 2) + (clock >> 2)) % 3;
        drawSparkle(r, ix + (iw >> 1) + ((by >> 1) % 3) - 1, by, 1, WAND_SPARKLE[c] as string);
      }
    if (since >= T2.windowOpen) r.sprite(sheet, s.frame, hx, feetY, s.flip);
    // Half hidden: a dim veil over the hero once it stands there.
    if (fall >= 1) r.rect(hx - 2, feetY - 2, fw + 4, fh + 2, 'rgba(0,0,0,0.5)');
  }
  // The vignette: dark bands round the inside edges, darker at the rim.
  for (const [d, a] of [
    [0, 0.6],
    [4, 0.35],
  ] as const) {
    const c = `rgba(0,0,0,${a})`;
    r.rect(ix + d, iy + d, iw - 2 * d, 4, c);
    r.rect(ix + d, iy + ih - d - 4, iw - 2 * d, 4, c);
    r.rect(ix + d, iy + d + 4, 4, ih - 2 * d - 8, c);
    r.rect(ix + iw - d - 4, iy + d + 4, 4, ih - 2 * d - 8, c);
  }
  // Wand sparkles drifting up over the hero.
  if (hero && since >= T2.windowOpen + T2.heroFall)
    for (let k = 0; k < 4; k++) {
      const drift = (clock + k * 17 + i * 11) % 40;
      const sx = ix + 12 + ((k * 9 + i * 5) % 24);
      const sy = ground - 4 - drift;
      const c = reduce ? k % 3 : (k + (clock >> 3)) % 3;
      drawSparkle(r, sx, sy, k === 0 ? 1 : 0, WAND_SPARKLE[c] as string);
    }
  // The window's number in its top-left corner, on a black tab so it reads on any sky.
  const font = assets.sheet('font');
  r.rect(x, y, 10, 10, '#000');
  r.text(font, String(i + 1), x + 1, y + 1);
}
