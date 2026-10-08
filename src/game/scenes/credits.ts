import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import type { Game } from './game';
import type { TouchLabels } from '@engine/input/touch';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import type { World } from '../world/world';
import { STORY_NOT_OVER } from '../story/script';
import { cardContinues, CARD_GUARD_FRAMES } from './message';
import { abilityHint } from './hints';
import { fontText } from '../hud/text';

/** The game's name on two lines ("Super Mario Bros. Crossover: REMIX" is too wide for one). */
export const CREDITS_NAME: readonly string[] = ['SUPER MARIO BROS. CROSSOVER', 'REMIX'];
/** Its short form, for the closing lines. */
export const CREDITS_SHORT_NAME: readonly string[] = ['SMB CROSSOVER', 'REMIX'];

/** Our credits (the original's GameTextMessages.CREDITS_* credit its own team; these credit ours). */
export const CREDITS: readonly string[] = [
  ...CREDITS_NAME,
  '',
  '',
  'MADE BY JELLOSHOOTER848',
  '',
  'BASED ON THE 2010 FLASH GAME',
  'SUPER MARIO BROS. CROSSOVER',
  'BY JAY PAVLINA',
  'AND EXPLODING RABBIT',
  '',
  'ITSELF BASED ON THE GAME',
  'SUPER MARIO BROS.',
  '(1985, NINTENDO)',
  '',
  'PROGRAMMING, LEVELS,',
  'ART AND MUSIC',
  'SMBC REMIX CONTRIBUTORS',
  '',
  'EVERY SPRITE AND TILE IS',
  'ORIGINAL PIXEL ART.',
  'EVERY SONG IS ORIGINAL',
  'CHIPTUNE.',
  '',
  'AN UNOFFICIAL FAN PROJECT.',
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
 * adds "END OF CHAPTER 1" and "...BUT THE STORY ISN'T OVER." (STORY_NOT_OVER) right after
 * THANKS FOR PLAYING / SUPER MARIO BROS. CROSSOVER / REMIX; everywhere else the plain CREDITS.
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
/** Text above this (ScreenManager.CREDITS_VISIBLE_END_Y, 2 Flash tiles: under the HUD) is not drawn. */
const TOP = 32;
const LINE = 12;

/**
 * The credits roll after the last castle (ScreenManager.startMoveCreditsTmrHandler and
 * moveCreditsLoopTmrHandler): the castle's text lines (`head`, drawn where World draws them) and
 * the credits scroll up from below the screen; the closing lines follow until their middle
 * reaches the middle of the screen and stay there, with an OK prompt once the card guard is over,
 * until OK (JUMP, ATTACK or MENU, any player) runs `onDone` (owner note 4: the original went on
 * by itself 6.5 s later, restartGameTmrHandler -> beatGame). Start fast-forwards the roll. Given the level's `world`, the text
 * is drawn behind its tiles and sprites (the original adds it under the level); else on black.
 */
export class CreditsScene implements Scene {
  readonly translucent: boolean;
  private scroll = 0;
  private fast = false;
  /** Frames the closing lines have stood still, or null while they still rise. */
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

  /** The closing lines stand still and OK goes on. */
  get waiting(): boolean {
    return this.hold !== null && this.hold > CARD_GUARD_FRAMES;
  }

  /** Start speeds the roll up (once); at the end OK goes on. */
  touchLabels(): TouchLabels {
    if (this.waiting && !this.finished) return { ...NO_TOUCH_BUTTONS, jump: 'OK' };
    return { ...NO_TOUCH_BUTTONS, start: this.fast || this.finished ? null : 'FASTER' };
  }

  update(input: InputFrame, inputs: InputFrame[] = [input]): void {
    if (this.finished) return;
    if (this.hold === null) {
      if (inputs.some((i) => i.pressed('start'))) this.fast = true;
      this.scroll += this.fast ? FAST : SPEED;
      if (this.tailY <= (SCREEN_H - CREDITS_TAIL.length * LINE) / 2) this.hold = 0;
      return;
    }
    this.hold++;
    if (this.hold === CARD_GUARD_FRAMES + 1) this.game.deps.announcer?.say('OK to continue.');
    if (cardContinues(this.hold, inputs, ['jump', 'attack', 'start'])) {
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
    if (this.waiting && !this.finished) {
      const ok = fontText(abilityHint(this.game, 'OK', 'jump'));
      line(ok, tail + (CREDITS_TAIL.length + 1) * LINE);
    }
  }
}
