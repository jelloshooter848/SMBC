import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import { OffsetRenderer, type Renderer } from '@engine/gfx/renderer';
import { Actions } from '@engine/input/actions';
import type { TouchLabels } from '@engine/input/touch';
import { FONT_COLOURS } from '@content/sprites/font';
import { CROSSOVER_ADVANCE, CROSSOVER_LETTERS } from '@content/sprites/title-logo';
import type { Game } from './game';
import type { MenuItem } from './menu';
import { abilityHint, controlScheme } from './hints';
import { menuTouchLabels } from '../touch-labels';
import { ClassicDemo, MARIO_WAIT } from './title-demo';
import { boxGrowth, drawMenuBox, type BoxRow } from './menu-box';
import { ClassicMenuScene, ClassicOptionsScene } from './original-game';

/**
 * The CLASSIC title in the original's style (O-04; level/TitleLevel.as, messageBoxes/StartMenu.as):
 * the live 1-1 demo (title-demo.ts) with no HUD, our logo centred near the top, the version at
 * the bottom left and, once Mario sets off, the begin prompt blinking every 500 ms (steady with
 * Reduce flashing). OK (or a tap on the screen) opens the Start box: START, OPTIONS, BACK. START
 * goes on to the map set menu (ClassicMenuScene, drawn as a box over the demo); BACK in the box
 * closes it back to the demo, BACK on the demo returns to the title. The demo never reads a press:
 * every press is the menu's from the first frame, and nothing waits for the demo.
 */

/** The prompt's blink (TitleLevel.as clickScreenTxtTmr: 500 ms on, 500 ms off). */
export const PROMPT_BLINK = 30;
/** Where the prompt sits (TitleLevel.as CLICK_SCREEN_TXT_Y_POS: about half the stage, under CLASSIC). */
const PROMPT_Y = 138;
/** The logo's drop from the REMIX title's place (TitleLevel.as TITLE_Y_POS 60: our 30). */
const LOGO_DY = 22;
/** The boxes' centre (screen px). */
export const BOX_CX = 128;
export const BOX_CY = 160;

/**
 * The CLASSIC smash (owner request on O-04): on the way in from the title, a big CLASSIC drops
 * onto the REMIX stamp, lands hard (a squash, dust, the stamp's chips flying, a short shake and
 * the stamp's own thud) and stays there in its place. Frames from the scene's start.
 */
export const SMASH = { drop: 16, squash: 4, shake: 10, end: 44 } as const;
/** Where CLASSIC rests: over the REMIX stamp's spot (its top left, screen px). */
export const CLASSIC_AT = { x: 41, y: 94 } as const;
/** Where it starts its fall (above the screen). */
const CLASSIC_FROM_Y = -32;
/** The stamp's chips: start (screen px) and speed (px a frame); they fall with gravity. */
const CHIPS = [
  [170, 84, -1.6, -2.6],
  [184, 80, -0.8, -3.2],
  [198, 82, 0.4, -3],
  [212, 78, 1.1, -3.4],
  [226, 80, 1.8, -2.8],
  [240, 84, 2.4, -2.2],
  [178, 96, -2.2, -1.6],
  [232, 92, 2.8, -1.4],
] as const;

/** The Start box's cursor, kept between visits (StartMenu.lastIndex). */
let lastIndex = 0;

export type ClassicTitlePhase = 'demo' | 'start';

export class ClassicTitleScene implements Scene {
  readonly translucent = false;
  readonly demo: ClassicDemo;
  phase: ClassicTitlePhase;
  /** Frames since the scene opened. */
  t = 0;
  /** Frame the current box opened (its grow). */
  private boxAt = 0;
  index = lastIndex;
  /** The Start box's rows (StartMenu.as: NEW GAME, LOAD GAME, OPTIONS, LINKS; see below). */
  readonly items: MenuItem[];
  private readonly version = `VER ${__APP_VERSION__}`.toUpperCase();

  /**
   * `phase` 'start' opens with the Start box up (coming back from a run or the map set menu);
   * `quiet` says nothing on enter (a menu over it speaks for both). `smash` plays the CLASSIC
   * smash (only on the way in from the title); without it CLASSIC is already in its place.
   */
  constructor(
    private readonly game: Game,
    phase: ClassicTitlePhase = 'demo',
    private readonly quiet = false,
    smash = phase === 'demo' && !quiet,
  ) {
    this.demo = new ClassicDemo(game.ctx);
    this.phase = phase;
    // With Reduce flashing it is simply in place: no fall, no shake, no flying chips.
    this.smashing = smash && !game.ctx.reduceFlashing;
    // START in place of NEW GAME and LOAD GAME: each map set keeps its own run, and the map set
    // menu asks CONTINUE or NEW GAME for a set that has one. No LINKS (nothing to link to).
    this.items = [
      {
        label: 'Start',
        select: () => this.openSets(),
        hint: 'Choose a map set and its difficulty, then a hero',
      },
      {
        label: 'Options',
        select: () =>
          game.scenes.push(
            new ClassicOptionsScene(game, () => {
              game.scenes.pop();
              this.announce();
            }),
          ),
        hint: 'Classic rules, game mode, more settings, weapons, music set and all settings',
      },
      { label: 'Back', select: () => game.showTitle(), hint: 'To the title' },
    ];
  }

  /** The begin prompt's words: the ability named (and its key, when not on touch). */
  get prompt(): string {
    return controlScheme(this.game) === 'touch'
      ? 'TAP OK TO BEGIN'
      : `PRESS ${abilityHint(this.game, 'OK', 'jump')} TO BEGIN`;
  }

  /** Whether the prompt shows this frame (TitleLevel: from Mario's start, 500 ms on and off). */
  promptShown(): boolean {
    // Each run of the demo hides it until its blink timer's first tick, 500 ms after Mario sets
    // off (TitleLevel: the timer starts with him; a new TitleLevel restarts it).
    const since = this.demo.t - MARIO_WAIT - PROMPT_BLINK;
    if (this.phase !== 'demo' || since < 0) return false;
    if (this.game.ctx.reduceFlashing) return true;
    return Math.floor(since / PROMPT_BLINK) % 2 === 0;
  }

  enter(): void {
    this.bindPointer();
    // The demo's own level tune, every time it opens (TitleLevel is a real 1-1: a new one, from
    // the title, a game over or the select, starts its music).
    this.game.ctx.audio.playMusic('overworld');
    if (this.quiet) return;
    if (this.phase === 'start') this.announce(true);
    else this.sayDemo();
  }

  exit(): void {
    this.unbind?.();
    this.unbind = null;
  }

  private sayDemo(): void {
    const touch = controlScheme(this.game) === 'touch';
    const ok = touch ? 'Tap OK' : `Press ${abilityHint(this.game, 'OK', 'jump')}`;
    const back = touch ? 'BACK' : abilityHint(this.game, 'BACK', 'attack');
    this.game.deps.announcer?.say(
      `Classic. The original game, with a demo of World 1-1 playing. ${ok} to begin. ${back} returns to the title.`,
    );
  }

  /** Read the Start box's highlighted row (and, on opening, the box's name first). */
  announce(opening = false): void {
    const it = this.items[this.index];
    if (!it) return;
    this.game.deps.announcer?.say(
      `${opening ? 'Start menu. ' : ''}${it.label}${it.hint ? `. ${it.hint}` : ''}`,
    );
  }

  /** One frame of the demo (also run by the menus drawn over it, so it keeps playing). */
  tickDemo(): void {
    this.demo.update();
  }

  /** OK on the demo: the Start box grows open (StartMenu.initiate). */
  openStart(): void {
    this.phase = 'start';
    this.boxAt = this.t;
    this.game.ctx.audio.sfx('coin');
    this.announce(true);
  }

  /** BACK in the Start box: it closes, back to the demo (StartMenu.pressAtkBtn). */
  closeStart(): void {
    this.phase = 'demo';
    this.game.ctx.audio.sfx('bump');
    this.sayDemo();
  }

  /** START: the map set menu, as a box over the demo. */
  private openSets(): void {
    this.game.scenes.push(new ClassicMenuScene(this.game, this));
  }

  /** The map set menu closed (its BACK): the Start box again. */
  backFromSets(): void {
    this.game.scenes.pop();
    this.phase = 'start';
    this.boxAt = this.t;
    this.announce(true);
  }

  touchLabels(): TouchLabels {
    return { ...menuTouchLabels(true), jump: 'OK' };
  }

  /** The CLASSIC smash is still playing (falling, or its landing). */
  smashing: boolean;

  /** Where the smash is: falling, landing (squash, shake, chips) or done (in place). */
  smashPhase(): 'drop' | 'land' | 'done' {
    if (!this.smashing || this.game.ctx.reduceFlashing) return 'done';
    return this.t < SMASH.drop ? 'drop' : 'land';
  }

  /** The screen's shake now (px; 0 with Reduce flashing and outside the landing). */
  shake(): number {
    if (this.smashPhase() !== 'land') return 0;
    const a = this.t - SMASH.drop;
    return a < SMASH.shake ? (a % 2 === 0 ? 2 : -2) : 0;
  }

  /** The smash ends at once: CLASSIC in its place (a press, or its time up). */
  finishSmash(): void {
    this.smashing = false;
  }

  update(input: InputFrame): void {
    this.t++;
    this.tickDemo();
    if (this.smashing) {
      if (this.t === SMASH.drop && !this.game.ctx.reduceFlashing) this.game.ctx.audio.sfx('stamp');
      // Any press finishes it, and still does what it does (OK still opens the Start box).
      if (this.t >= SMASH.end || this.tapped || Actions.some((a) => input.pressed(a))) this.finishSmash();
    }
    if (this.phase === 'demo') {
      if (input.pressed('jump') || input.pressed('start') || this.tapped) this.openStart();
      else if (input.pressed('attack') || input.pressed('select')) {
        this.game.ctx.audio.sfx('bump');
        this.game.showTitle();
      }
      this.tapped = false;
      return;
    }
    this.tapped = false;
    const n = this.items.length;
    if (input.pressed('up') || input.pressed('down')) {
      this.index = (this.index + (input.pressed('up') ? n - 1 : 1)) % n;
      lastIndex = this.index;
      this.game.ctx.audio.sfx('fireball');
      this.announce();
    } else if (input.pressed('jump') || input.pressed('start')) {
      lastIndex = this.index;
      this.game.ctx.audio.sfx('coin');
      this.items[this.index]?.select?.();
    } else if (input.pressed('attack') || input.pressed('select')) this.closeStart();
  }

  // ------------------------------------------------------------ a tap on the screen begins

  private tapped = false;
  private unbind: (() => void) | null = null;

  /** TitleLevel.clickHandler: a click or tap anywhere on the demo opens the Start box. */
  private bindPointer(): void {
    const canvas = this.game.deps.canvas;
    if (!canvas || this.unbind) return;
    const down = () => {
      if (this.game.scenes.top === this && this.phase === 'demo') this.tapped = true;
    };
    canvas.addEventListener('pointerdown', down);
    this.unbind = () => canvas.removeEventListener('pointerdown', down);
  }

  // ------------------------------------------------------------ drawing

  /** Our logo (the REMIX title's pieces), centred near the top as TitleLevel's is. */
  private logo(r: Renderer): void {
    const sheet = this.game.ctx.assets.sheet('title-logo');
    r.sprite(sheet, 'smb-tag', 18, 8 + LOGO_DY);
    for (let i = 0; i < CROSSOVER_LETTERS.length; i++)
      r.sprite(sheet, `cross-${i}`, 17 + i * CROSSOVER_ADVANCE, 30 + LOGO_DY);
    const phase = this.smashPhase();
    // REMIX until CLASSIC lands on it; then CLASSIC in its place.
    if (phase === 'drop') {
      r.sprite(sheet, 'remix-shadow', 162, 56 + LOGO_DY);
      r.sprite(sheet, 'remix', 160, 54 + LOGO_DY);
      const k = this.t / SMASH.drop;
      const y = Math.round(CLASSIC_FROM_Y + (CLASSIC_AT.y - CLASSIC_FROM_Y) * k * k);
      r.sprite(sheet, 'classic', CLASSIC_AT.x, y);
      return;
    }
    const a = phase === 'land' ? this.t - SMASH.drop : Infinity;
    if (a < SMASH.squash) {
      const full = sheet.frames.get('classic')?.h ?? 29;
      const flat = sheet.frames.get('classic-squash')?.h ?? 22;
      r.sprite(sheet, 'classic-squash', CLASSIC_AT.x, CLASSIC_AT.y + full - flat);
    } else r.sprite(sheet, 'classic', CLASSIC_AT.x, CLASSIC_AT.y);
    if (a < 12) {
      const k = Math.min(2, Math.floor(a / 4));
      r.sprite(sheet, `dust-${k}`, CLASSIC_AT.x - 14, CLASSIC_AT.y + 18);
      r.sprite(sheet, `dust-${k}`, CLASSIC_AT.x + 156, CLASSIC_AT.y + 18);
    }
    if (a < SMASH.end - SMASH.drop)
      for (const [x, y, vx, vy] of CHIPS)
        r.sprite(sheet, 'brick-bit', Math.round(x + vx * a), Math.round(y + vy * a + 0.25 * a * a));
  }

  private shadowText(r: Renderer, s: string, x: number, y: number): void {
    const assets = this.game.ctx.assets;
    r.text(assets.sheet('font', FONT_COLOURS.black), s, x + 1, y + 1);
    r.text(assets.sheet('font'), s, x, y);
  }

  /** The demo, the logo and the version: what every CLASSIC menu is drawn over. */
  renderBackdrop(screen: Renderer): void {
    const dy = this.shake();
    const r = dy ? (this.shaker ??= new OffsetRenderer(screen, 0, 0)) : screen;
    if (r instanceof OffsetRenderer) {
      r.inner = screen;
      r.dy = dy;
    }
    this.demo.render(r);
    this.logo(r);
    // The version while only the demo is up, until the prompt first shows (TitleLevel.as:305-306).
    if (this.promptShown()) this.versionGone = true;
    if (!this.versionGone && this.phase === 'demo' && this.game.scenes.top === this)
      this.shadowText(r, this.version, 8, 227);
  }

  private shaker: OffsetRenderer | null = null;
  /** The prompt has shown once: the version is gone for good (TitleLevel.clickScreenTxtTmrHandler). */
  versionGone = false;

  render(r: Renderer): void {
    this.renderBackdrop(r);
    if (this.promptShown()) {
      const p = this.prompt;
      this.shadowText(r, p, Math.round(128 - (p.length * 8) / 2), PROMPT_Y);
    }
    // The Start box, while it is up and no menu is over it.
    if (this.phase === 'start' && this.game.scenes.top === this) {
      const rows: BoxRow[] = this.items.map((it) => ({ label: it.label }));
      drawMenuBox(r, this.game.ctx.assets, rows, this.index, {
        cx: BOX_CX,
        cy: BOX_CY,
        grow: boxGrowth(this.t - this.boxAt, this.game.ctx.reduceFlashing),
        t: this.t,
        calm: this.game.ctx.reduceFlashing,
      });
    }
  }
}
