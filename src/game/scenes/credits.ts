import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import type { Game } from './game';
import type { TouchLabels } from '@engine/input/touch';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import type { World } from '../world/world';
import { STORY_NOT_OVER } from '../story/script';

/**
 * Our game's name as the credits print it: in full (the roll's first lines and its thanks) and
 * short (the closing lines). The original's name, in the INSPIRED BY lines, is not ours and stays.
 * TODO(0.5.0): the rebrand to SMB Crossover REMIX (docs/ROADMAP.md, "The rebrand") changes these
 * two, e.g. 'SUPER MARIO BROS. CROSSOVER:' / 'REMIX' and 'SMB CROSSOVER' / 'REMIX', with its
 * "MADE BY" credit; the title screen's session owns the rename strings.
 */
export const CREDITS_NAME: readonly string[] = ['SUPER MARIO BROS. CROSSOVER', 'FAN REBUILD'];
export const CREDITS_SHORT_NAME: readonly string[] = ['SMB CROSSOVER', 'FAN REBUILD'];

/** Our credits (the original's GameTextMessages.CREDITS_* credit its own team; these credit ours). */
export const CREDITS: readonly string[] = [
  ...CREDITS_NAME,
  '',
  '',
  'INSPIRED BY THE 2010 FLASH GAME',
  'SUPER MARIO BROS. CROSSOVER',
  'BY JAY PAVLINA',
  'AND EXPLODING RABBIT',
  '',
  'BASED ON THE GAME',
  'SUPER MARIO BROS.',
  '(1985, NINTENDO)',
  '',
  'PROGRAMMING, LEVELS,',
  'ART AND MUSIC',
  'SMBC CONTRIBUTORS',
  '',
  'EVERY SPRITE AND TILE IS',
  'ORIGINAL PIXEL ART.',
  'EVERY SONG IS ORIGINAL',
  'CHIPTUNE.',
  '',
  'AN UNAFFILIATED FAN PROJECT.',
  'ALL TRADEMARKS BELONG TO',
  'THEIR RESPECTIVE HOLDERS.',
  'CHARACTER NAMES ONLY DESCRIBE',
  'GAMEPLAY STYLES.',
  '',
  'THANKS FOR PLAYING',
  ...CREDITS_NAME,
  '',
  '',
];
/**
 * The credits as they roll: the campaign's SMB 8-4 false ending (`story`, docs/STORY.md 2.12)
 * adds "END OF CHAPTER 1" and "...BUT THE STORY ISN'T OVER." right after THANKS FOR PLAYING and
 * our name; everywhere else the plain CREDITS.
 */
export function creditsLines(story: boolean): readonly string[] {
  if (!story) return CREDITS;
  const at = CREDITS.indexOf('THANKS FOR PLAYING') + 1 + CREDITS_NAME.length;
  return [...CREDITS.slice(0, at), ...STORY_NOT_OVER, ...CREDITS.slice(at)];
}

/** The closing lines that stop mid-screen (GameTextMessages.CREDITS_TAIL's place). */
export const CREDITS_TAIL: readonly string[] = CREDITS_SHORT_NAME;

/** ScreenManager.CREDITS_SPEED = 40 Flash px/s: 20 px/s here, at 60 frames a second. */
const SPEED = 20 / 60;
/** ScreenManager.CREDITS_SPEED_FAST = CREDITS_SPEED * 10 (the pause button, ButtonManager). */
const FAST = SPEED * 10;
/** ScreenManager.RESTART_GAME_TMR_DUR = 6500 ms (a quarter of it when fast-forwarded). */
export const CREDITS_HOLD_FRAMES = 390;
/** Text above this (ScreenManager.CREDITS_VISIBLE_END_Y, 2 Flash tiles: under the HUD) is not drawn. */
const TOP = 32;
const LINE = 12;

/**
 * The credits roll after the last castle (ScreenManager.startMoveCreditsTmrHandler and
 * moveCreditsLoopTmrHandler): the castle's text lines (`head`, drawn where World draws them) and
 * the credits scroll up from below the screen; the closing lines follow until their middle
 * reaches the middle of the screen and stay there; 6.5 s later `onDone` runs (the original's
 * restartGameTmrHandler -> beatGame). Start fast-forwards. Given the level's `world`, the text
 * is drawn behind its tiles and sprites (the original adds it under the level); else on black.
 */
export class CreditsScene implements Scene {
  readonly translucent: boolean;
  private scroll = 0;
  private fast = false;
  private hold: number | null = null;
  private finished = false;

  constructor(
    private readonly game: Game,
    private readonly head: readonly string[],
    private readonly onDone: () => void,
    world: World | null = null,
    /** The lines that roll (creditsLines). */
    readonly lines: readonly string[] = CREDITS,
  ) {
    this.translucent = world !== null;
    if (world) world.backdrop = (r) => this.draw(r);
  }

  enter(): void {
    this.game.ctx.audio.stopMusic();
    this.game.ctx.audio.playMusic('credits');
  }

  /** Top y of the closing lines: right after the credits until it reaches mid-screen. */
  get tailY(): number {
    const natural = SCREEN_H + this.lines.length * LINE - this.scroll;
    return Math.max(natural, (SCREEN_H - CREDITS_TAIL.length * LINE) / 2);
  }

  /** Start speeds the roll up (once). */
  touchLabels(): TouchLabels {
    return { ...NO_TOUCH_BUTTONS, start: this.fast || this.finished ? null : 'FASTER' };
  }

  update(input: InputFrame): void {
    if (this.finished) return;
    if (input.pressed('start')) this.fast = true;
    this.scroll += this.fast ? FAST : SPEED;
    if (this.hold === null) {
      if (this.tailY <= (SCREEN_H - CREDITS_TAIL.length * LINE) / 2)
        this.hold = this.fast ? CREDITS_HOLD_FRAMES / 4 : CREDITS_HOLD_FRAMES;
      return;
    }
    if (--this.hold <= 0) {
      this.finished = true;
      this.onDone();
    }
  }

  render(r: Renderer): void {
    if (this.translucent) return; // the level beneath draws the text (World.backdrop)
    r.clear('#000');
    this.draw(r);
  }

  private draw(r: Renderer): void {
    const font = this.game.ctx.assets.sheet('font');
    const line = (s: string, y: number) => {
      if (s && y >= TOP && y < SCREEN_H) r.text(font, s, (SCREEN_W - s.length * 8) >> 1, Math.round(y));
    };
    this.head.forEach((s, i) => line(s, 80 + i * 16 - this.scroll));
    this.lines.forEach((s, i) => line(s, SCREEN_H + i * LINE - this.scroll));
    const tail = this.tailY;
    CREDITS_TAIL.forEach((s, i) => line(s, tail + i * LINE));
  }
}
