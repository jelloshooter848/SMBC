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
import { joinMusic, TITLE_MUSIC } from './title-music';

/**
 * The CLASSIC title in the original's style (O-04; level/TitleLevel.as, messageBoxes/StartMenu.as):
 * the live 1-1 demo (title-demo.ts) with no HUD, our logo centred near the top, the version at
 * the bottom left and, once Mario sets off, the begin prompt blinking every 500 ms (steady with
 * Reduce flashing). OK (or a tap on the screen) opens the Start box: START, OPTIONS, BACK. START
 * goes on to the map set menu (ClassicMenuScene, drawn as a box over the demo), then a set's
 * save files (original-files-menu.ts); BACK in the box
 * closes it back to the demo, BACK on the demo returns to the title. The demo never reads a press:
 * every press is the menu's from the first frame, and nothing waits for the demo.
 */

/** The prompt's blink (TitleLevel.as clickScreenTxtTmr: 500 ms on, 500 ms off). */
export const PROMPT_BLINK = 30;
/** Where the prompt sits (TitleLevel.as CLICK_SCREEN_TXT_Y_POS: about half the stage, under CLASSIC). */
const PROMPT_Y = 138;
/** The prompt's dark strip: its margin around the words, and its colour. */
const PROMPT_PAD = 3;
export const PROMPT_STRIP = 'rgba(0,0,0,0.6)';
/**
 * BUG-02 (owner): SMB and CROSSOVER stay exactly where the REMIX title has them (title.ts TAG_*,
 * CROSS_*; no drop on the way in), and CLASSIC takes the REMIX stamp's place.
 */
export const LOGO = { tagX: 18, tagY: 8, crossX: 17, crossY: 30 } as const;
/** The REMIX stamp's place on the title (title.ts STAMP_X, STAMP_Y), until CLASSIC lands on it. */
const STAMP = { x: 160, y: 54 } as const;
/** The boxes' centre x (screen px); each box's top is menu-box.ts BOX_TOP, under the logo. */
export const BOX_CX = 128;

/**
 * The CLASSIC smash (owner request on O-04): on the way in from the title, a big CLASSIC drops
 * onto the REMIX stamp, lands hard (a squash, dust, the stamp's chips flying, a short shake and
 * the stamp's own thud) and stays there in its place. Frames from the scene's start.
 */
export const SMASH = { drop: 16, squash: 4, shake: 10, end: 44 } as const;
/**
 * Where CLASSIC rests (its top left, screen px): in the REMIX stamp's place (BUG-02), its right
 * end at the stamp's (252) and its middle level with the stamp's (CLASSIC is 173 x 29, the stamp
 * 92 x 44 at 160, 54).
 */
export const CLASSIC_AT = { x: 79, y: 62 } as const;
/** CLASSIC's height (the 'classic' frame, 173 x 29). */
const CLASSIC_H = 29;
/** The demo's ground (1-1's row 13, as the REMIX title's TITLE_GROUND_Y). */
const GROUND_Y = 208;
/**
 * 0.4.72 (owner, Start box option A): the Start box's centre y, half way between CLASSIC's foot
 * and the ground, so the demo's heroes and ground stay in view. The map set box and the boxes
 * after it keep their place under the logo (menu-box.ts BOX_TOP).
 */
export const START_BOX_CY = Math.round((CLASSIC_AT.y + CLASSIC_H + GROUND_Y) / 2);
/** Where it starts its fall (above the screen). */
const CLASSIC_FROM_Y = -32;
/** The stamp's chips: start (screen px, on the stamp) and speed (px a frame); they fall with gravity. */
const CHIPS = [
  [170, 62, -1.6, -2.6],
  [184, 58, -0.8, -3.2],
  [198, 60, 0.4, -3],
  [212, 56, 1.1, -3.4],
  [226, 58, 1.8, -2.8],
  [240, 62, 2.4, -2.2],
  [178, 74, -2.2, -1.6],
  [232, 70, 2.8, -1.4],
] as const;

/** The Start box's cursor, kept between visits (StartMenu.lastIndex). */
let lastIndex = 0;

export type ClassicTitlePhase = 'demo' | 'start';

export class ClassicTitleScene implements Scene {
  readonly translucent = false;
  /** The backdrop every CLASSIC box is drawn over (original-box-menu.ts demoUnder). */
  readonly classicBackdrop = true as const;
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
    this.fromRemix = smash;
    // With Reduce flashing it is simply in place: no fall, no shake, no flying chips.
    this.smashing = smash && !game.ctx.reduceFlashing;
    // START in place of NEW GAME and LOAD GAME: it opens the map set menu, where a run is
    // started or continued. No LINKS (nothing to link to).
    this.items = [
      {
        label: 'Start',
        select: () => this.openSets(),
        hint: 'Choose a map set and a file, then a hero',
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
        hint: 'Music set, tutorials, cheats, and video, audio and controls',
      },
      { label: 'Back', select: () => this.leaveToTitle(), hint: 'To the title' },
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
    // BUG-12: from the REMIX title the join is smoothed. With the smash, the REMIX theme fades
    // out over CLASSIC's fall and the overworld rises from the impact frame (startOverworld);
    // with Reduce flashing (no smash), a plain crossfade.
    const audio = this.game.ctx.audio;
    if (this.fromRemix && this.smashing) {
      audio.fadeOutMusic?.(TITLE_MUSIC.fallOut);
      this.overworldDue = true;
    } else if (this.fromRemix) {
      this.overworldFrom = Math.round(
        joinMusic(audio, 'overworld', TITLE_MUSIC.crossOut, TITLE_MUSIC.crossIn) * 60,
      );
      this.overworldAsked = true;
    } else {
      audio.playMusic('overworld');
      this.overworldAsked = true;
    }
    if (this.quiet) return;
    if (this.phase === 'start') this.announce(true);
    else this.sayDemo();
  }

  exit(): void {
    this.unbind?.();
    this.unbind = null;
    this.overworldDue = false;
  }

  /** Came in from the REMIX title (its music joins smoothly, BUG-12). */
  private readonly fromRemix: boolean;
  /** The overworld waits for CLASSIC's impact (BUG-12). */
  private overworldDue = false;
  /**
   * The overworld has been asked for (0.4.72): BACK before the smash's impact leaves the REMIX
   * theme playing, and the way back (title.ts) only brings it up again.
   */
  overworldAsked = false;
  /** BACK came while CLASSIC was still falling: it never landed on the stamp (0.4.72). */
  backBeforeImpact = false;
  /** Reduce flashing's crossfade: the frame the overworld comes in (0: at once). */
  private overworldFrom = 0;
  /**
   * 0.4.73: with Reduce flashing (no smash), BACK while the REMIX theme was still fading out,
   * before the overworld came in: the calm way's "BACK during the fall". The REMIX title skips
   * its way back and only brings its theme up again, as after BACK during the fall.
   */
  backMidCrossfade = false;

  /** Back to the REMIX title: every way out of this scene to the title goes through here. */
  private leaveToTitle(): void {
    if (this.t <= this.overworldFrom) this.backMidCrossfade = true;
    this.game.showTitle();
  }

  /** The impact (or the smash cut short by a press): the overworld rises, the smash its downbeat. */
  private startOverworld(): void {
    if (!this.overworldDue) return;
    this.overworldDue = false;
    this.overworldAsked = true;
    this.game.ctx.audio.playMusic('overworld', TITLE_MUSIC.impactIn);
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
    // However the smash ended, its overworld never waits past it (BUG-12).
    if (this.overworldDue && this.smashPhase() === 'done') this.startOverworld();
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
    this.startOverworld();
  }

  update(input: InputFrame): void {
    this.t++;
    this.tickDemo();
    if (this.smashing) {
      if (this.t === SMASH.drop && !this.game.ctx.reduceFlashing) {
        // On the impact frame: the overworld starts under the thud (BUG-12).
        this.startOverworld();
        this.game.ctx.audio.sfx('stamp');
      }
      // Any press finishes it, and still does what it does (OK still opens the Start box). BACK
      // before the impact: no overworld at all, the REMIX theme just comes back up (BUG-12), and
      // CLASSIC never landed (0.4.72: the REMIX title then skips its break, title.ts).
      if (input.pressed('attack') || input.pressed('select')) {
        if (this.smashPhase() === 'drop') this.backBeforeImpact = true;
        this.overworldDue = false;
      }
      if (this.t >= SMASH.end || this.tapped || Actions.some((a) => input.pressed(a))) this.finishSmash();
    }
    if (this.phase === 'demo') {
      if (input.pressed('jump') || input.pressed('start') || this.tapped) this.openStart();
      else if (input.pressed('attack') || input.pressed('select')) {
        this.game.ctx.audio.sfx('bump');
        this.leaveToTitle();
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

  /** Our logo: the REMIX title's pieces where that title has them, CLASSIC in the stamp's place. */
  private logo(r: Renderer): void {
    const sheet = this.game.ctx.assets.sheet('title-logo');
    r.sprite(sheet, 'smb-tag', LOGO.tagX, LOGO.tagY);
    for (let i = 0; i < CROSSOVER_LETTERS.length; i++)
      r.sprite(sheet, `cross-${i}`, LOGO.crossX + i * CROSSOVER_ADVANCE, LOGO.crossY);
    const phase = this.smashPhase();
    // REMIX until CLASSIC lands on it; then CLASSIC in its place.
    if (phase === 'drop') {
      r.sprite(sheet, 'remix-shadow', STAMP.x + 2, STAMP.y + 2);
      r.sprite(sheet, 'remix', STAMP.x, STAMP.y);
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
      // Over everything the demo draws, on a dark strip so a hero or a block behind it never
      // breaks it up (the logo has its own black outline).
      const p = this.prompt;
      const x = Math.round(128 - (p.length * 8) / 2);
      r.rect(
        x - PROMPT_PAD,
        PROMPT_Y - PROMPT_PAD,
        p.length * 8 + PROMPT_PAD * 2,
        8 + PROMPT_PAD * 2,
        PROMPT_STRIP,
      );
      this.shadowText(r, p, x, PROMPT_Y);
    }
    // The Start box, while it is up and no menu is over it.
    if (this.phase === 'start' && this.game.scenes.top === this) {
      const rows: BoxRow[] = this.items.map((it) => ({ label: it.label }));
      drawMenuBox(r, this.game.ctx.assets, rows, this.index, {
        cx: BOX_CX,
        cy: START_BOX_CY,
        grow: boxGrowth(this.t - this.boxAt, this.game.ctx.reduceFlashing),
        t: this.t,
        calm: this.game.ctx.reduceFlashing,
      });
    }
  }
}
