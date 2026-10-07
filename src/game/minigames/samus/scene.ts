import type { Scene } from '@engine/scene';
import { NO_INPUT, type InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { TouchLabels } from '@engine/input/touch';
import { toPx } from '@engine/math/units';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import { levelSeed, World } from '../../world/world';
import { newGameState, type GameState } from '../../context';
import { SAMUS } from '../../characters/samus';
import type { Player } from '../../entities/player';
import type { Game } from '../../scenes/game';
import { abilityHint } from '../../scenes/hints';
import { drawHud } from '../../hud/hud';
import { levelTouchLabels, NO_TOUCH_BUTTONS } from '../../touch-labels';
import { MiniGameMenuScene } from '../menu';
import type { MiniGameResult } from '../types';
import { ZEBES_SOUNDS } from './art';
import { Creature, SkreeShard, type Ship } from './creatures';
import { escapeEntities, escapeStage } from './stage';

/** Frames READY shows before Samus can move (the countdown waits for it). */
export const READY_FRAMES = 75;
/** The self-destruct countdown, in seconds. */
export const COUNTDOWN_SECONDS = 90;
export const COUNTDOWN_FRAMES = COUNTDOWN_SECONDS * 60;
/** Seconds left at which the announcer calls the time. */
export const CALLOUTS = [60, 30, 10] as const;
/** The final stretch: the alarm ticks faster and the music speeds up. */
export const FINAL_SECONDS = 10;
/** Frames between alarm sounds, before and in the final stretch. */
export const ALARM_EVERY = 120;
export const ALARM_EVERY_FINAL = 30;
/** Music speed in the final stretch. */
export const FINAL_TEMPO = 1.2;
/** Frames the ship takes to lift off before the round passes. */
export const LIFTOFF_FRAMES = 150;
/** Frames the cavern takes to blow up before the round fails. */
export const BOOM_FRAMES = 120;
/** Frames the opening banner stays up. */
export const BANNER_FRAMES = 150;

/**
 * Samus's kit for the escape (her devKit's scratch keys, toned down): one energy tank (60
 * energy), the Long Beam, ten missiles; morph ball and bombs are always hers. No Varia suit.
 */
export const ESCAPE_KIT = { tanks: 1, maxHp: 60, beam: 1, missiles: 10 } as const;

export type EscapePhase = 'ready' | 'escape' | 'liftoff' | 'boom' | 'dead' | 'over';

export interface EscapeOptions {
  /** World seed (drops). */
  seed?: number;
  /** Countdown length in frames (tests). */
  countdown?: number;
}

/**
 * Samus's mini game, Zebes Escape: the cavern under 4-2 starts to self-destruct. Played as Samus
 * (beam, missiles, morph ball and bombs) in a World of its own (stage.map, a `camera: free` map
 * three screens high) with a fresh GameState, so the campaign's lives, score and power are never
 * touched. A big countdown runs on the HUD while alarm lights blink and the `alarm` sounds (faster
 * in the last ten seconds); Samus climbs two shafts, rolls through morph-ball tunnels, bombs
 * through walls and runs for her ship. Boarding it passes (after the lift-off); the countdown
 * running out (the cavern blows up), a pit or losing all energy fails; the menu's Give up quits.
 */
export class EscapeScene implements Scene {
  readonly world: World;
  readonly state: GameState;
  phase: EscapePhase = 'ready';
  /** Frames since the scene started, and in the current phase. */
  t = 0;
  phaseT = 0;
  /** Countdown frames left. */
  left: number;
  banner: { lines: string[]; until: number; y: number } | null = null;
  ship: Ship | null = null;
  /** Callouts said so far (seconds). */
  private readonly called = new Set<number>();
  /** The infinite-time assist's note was said (once a round). */
  private heldSaid = false;
  /** The music was set back to normal speed while the countdown holds. */
  private tempoHeld = false;
  private music: string | null = null;
  private nextAlarm = 0;

  constructor(
    private readonly game: Game,
    private readonly done: (result: MiniGameResult) => void,
    opts: EscapeOptions = {},
  ) {
    const level = escapeStage();
    const state = newGameState(SAMUS);
    state.kit = { ...ESCAPE_KIT };
    state.hp = ESCAPE_KIT.maxHp;
    state.lives = 1;
    state.world = 4;
    state.stage = 2;
    this.state = state;
    this.left = opts.countdown ?? COUNTDOWN_FRAMES;
    this.world = new World(level, game.ctx, state, {
      seed: opts.seed ?? levelSeed(level),
      scorePopups: false, // the HUD shows no score
      extraEntities: escapeEntities({ onShip: (ship) => this.boarded(ship) }),
    });
    this.world.time = null;
    // The statue, the alarm lights and the creatures show on READY already; the world does not
    // step until the countdown starts, so they stay still till then.
    this.world.spawnInView();
  }

  get player(): Player {
    return this.world.player;
  }

  /** Whole seconds left on the countdown (shown on the HUD). */
  get seconds(): number {
    return Math.ceil(this.left / 60);
  }

  /** The countdown holds: the dev assist Infinite time is on. */
  get held(): boolean {
    return this.game.ctx.assist.infiniteTime;
  }

  enter(): void {
    this.game.ctx.audio.stopMusic();
    this.say(
      `Zebes escape. Play as Samus: the cavern blows up in ${this.seconds} seconds. Climb the shafts, ` +
        `${this.hint('DOWN', 'down')} rolls into the morph ball for the low tunnels, ` +
        `${this.hint('BOMB', 'attack')} in the ball opens cracked blocks, and reach your ship. ` +
        `${this.hint('MENU', 'start')} for the menu. Ready!`,
    );
  }

  exit(): void {
    this.game.ctx.audio.setTempoScale(1);
  }

  private say(text: string): void {
    this.game.deps.announcer?.say(text);
  }

  private hint(label: string, action: Parameters<typeof abilityHint>[2]): string {
    return abilityHint(this.game, label, action);
  }

  private playMusic(id: string): void {
    if (this.music === id) return;
    this.music = id;
    this.game.ctx.audio.playMusic(id);
  }

  private stopMusic(): void {
    this.music = null;
    this.game.ctx.audio.setTempoScale(1);
    this.game.ctx.audio.stopMusic();
  }

  private setPhase(p: EscapePhase): void {
    this.phase = p;
    this.phaseT = 0;
  }

  /** Samus's buttons as in a level while she runs; only MENU during READY; none once decided. */
  touchLabels(): TouchLabels {
    if (this.phase === 'escape') return levelTouchLabels(this.world.players[0], this.world);
    if (this.phase === 'ready') return { ...NO_TOUCH_BUTTONS, start: 'MENU' };
    return { ...NO_TOUCH_BUTTONS };
  }

  /** Can the menu open now (not once the round is decided). */
  private get menuOpen(): boolean {
    return this.phase === 'ready' || this.phase === 'escape';
  }

  update(input: InputFrame): void {
    if (this.phase === 'over') return;
    if (this.menuOpen && input.pressed('start')) {
      this.game.scenes.push(new EscapeMenuScene(this.game, () => this.finish('quit')));
      return;
    }
    this.t++;
    this.phaseT++;
    switch (this.phase) {
      case 'ready':
        // The OK that started the round must not make Samus jump.
        input.consumeJumpBuffer();
        if (this.phaseT >= READY_FRAMES) this.startEscape();
        return;
      case 'escape':
        this.tickCountdown();
        if (this.phase !== 'escape') return;
        this.step(input);
        return;
      case 'liftoff':
        this.step(NO_INPUT);
        if (this.phaseT >= LIFTOFF_FRAMES) this.finish('pass');
        return;
      case 'boom':
        if (this.phaseT >= BOOM_FRAMES) this.finish('fail');
        return;
      case 'dead':
        this.step(NO_INPUT);
        return;
    }
  }

  private startEscape(): void {
    this.setPhase('escape');
    this.playMusic(ZEBES_SOUNDS.escape);
    this.game.ctx.audio.sfx(ZEBES_SOUNDS.alarm);
    this.nextAlarm = ALARM_EVERY;
    this.banner = { lines: ['ESCAPE!', 'REACH YOUR SHIP'], until: this.t + BANNER_FRAMES, y: 64 };
    this.say(`Escape! ${this.seconds} seconds.`);
    if (this.held) this.sayHeld();
  }

  private sayHeld(): void {
    if (this.heldSaid) return;
    this.heldSaid = true;
    this.say('Infinite time: the countdown holds.');
  }

  /** One frame of the countdown: callouts, the alarm, the final stretch, the blast at zero. */
  private tickCountdown(): void {
    if (this.held) {
      this.sayHeld();
      // The countdown holds: so does the music's final-stretch hurry (it comes back with the clock).
      if (!this.tempoHeld) {
        this.tempoHeld = true;
        this.game.ctx.audio.setTempoScale(1);
      }
      return;
    }
    this.tempoHeld = false;
    this.left = Math.max(0, this.left - 1);
    const s = this.seconds;
    for (const c of CALLOUTS)
      if (s <= c && !this.called.has(c) && this.left > 0) {
        this.called.add(c);
        if (s === c) this.say(`${c} seconds!`);
      }
    const final = s <= FINAL_SECONDS;
    if (final) this.game.ctx.audio.setTempoScale(FINAL_TEMPO);
    if (--this.nextAlarm <= 0) {
      this.game.ctx.audio.sfx(ZEBES_SOUNDS.alarm);
      this.nextAlarm = final ? ALARM_EVERY_FINAL : ALARM_EVERY;
    }
    if (final && this.nextAlarm > ALARM_EVERY_FINAL) this.nextAlarm = ALARM_EVERY_FINAL;
    if (this.left === 0) this.blowUp();
  }

  /** One frame of the world with `input`; a death ends the round once its jingle has played. */
  private step(input: InputFrame): void {
    this.world.update([input]);
    const events = this.world.events.splice(0);
    if (this.phase === 'escape' && this.player.dead) {
      this.setPhase('dead');
      this.stopMusic();
      const fell = toPx(this.player.body.y) > this.world.heightPx;
      this.say(fell ? 'Samus fell. Try again.' : 'Samus is down. Try again.');
    }
    if (this.phase === 'dead' && events.some((e) => e.type === 'died')) this.finish('fail');
  }

  /* ---------- The ship ---------- */

  /** Samus reached the ship's hatch: she climbs in and it lifts off. */
  private boarded(ship: Ship): void {
    if (this.phase !== 'escape') return;
    this.ship = ship;
    this.setPhase('liftoff');
    this.stopMusic();
    const p = this.player;
    p.hidden = true;
    p.frozen = true;
    p.body.vx = 0;
    p.body.vy = 0;
    // Nothing can hurt her now.
    for (const e of this.world.entities) if (e instanceof Creature || e instanceof SkreeShard) e.destroy();
    ship.liftOff();
    this.game.ctx.audio.sfx(ZEBES_SOUNDS.liftoff);
    this.game.ctx.audio.playJingle(ZEBES_SOUNDS.victory);
    // Low on the screen, clear of the ship rising.
    this.banner = { lines: ['SAMUS ESCAPED!'], until: Infinity, y: 184 };
    const spell = this.game.inRound ? '' : ' The spell on Samus breaks.'; // none in a round for fun
    this.say(`Samus reached her ship with ${this.seconds} seconds to spare!${spell}`);
  }

  /* ---------- The blast ---------- */

  private blowUp(): void {
    this.setPhase('boom');
    this.stopMusic();
    this.banner = null;
    this.game.ctx.audio.sfx(ZEBES_SOUNDS.blast);
    this.say('Time is up. The cavern exploded. Try again.');
  }

  /** The round is over: report it once. */
  private finish(result: MiniGameResult): void {
    if (this.phase === 'over') return;
    this.phase = 'over';
    this.stopMusic();
    this.done(result);
  }

  /* ---------- Drawing ---------- */

  render(r: Renderer): void {
    this.world.render(r);
    const ctx = this.game.ctx;
    const font = ctx.assets.sheet('font');
    if (this.phase === 'escape' || this.phase === 'ready')
      drawAlarmTint(r, this.t, this.seconds, ctx.reduceFlashing);
    if (this.phase === 'boom') drawBlast(r, this.phaseT, ctx.reduceFlashing);
    drawHud(r, ctx.assets, this.state, null, this.world.frame, this.world.players, {
      place: 'ZEBES',
      covered: (x, y, w, h) => this.world.spriteIn(x, y, w, h),
    });
    drawCountdown(r, this.seconds, this.held, this.t, ctx.reduceFlashing);
    if (this.phase === 'ready' && (ctx.reduceFlashing || ((this.phaseT >> 3) & 3) !== 3))
      r.text(font, 'READY', (SCREEN_W - 40) >> 1, 104);
    const b = this.banner;
    if (b && this.t < b.until) drawBanner(r, font, b.lines, b.y);
  }
}

/* ---------- The countdown's big digits ---------- */

/** 3×5 digits, a row of three bits per line (top first). */
const DIGITS: readonly number[][] = [
  [7, 5, 5, 5, 7],
  [2, 6, 2, 2, 7],
  [7, 1, 7, 4, 7],
  [7, 1, 3, 1, 7],
  [5, 5, 7, 1, 1],
  [7, 4, 7, 1, 7],
  [7, 4, 7, 5, 7],
  [7, 1, 2, 2, 2],
  [7, 5, 7, 5, 7],
  [7, 5, 7, 1, 7],
];
/** Each digit cell's size (px) and the countdown's top. */
export const DIGIT_SCALE = 4;
export const COUNTDOWN_Y = 6;

/** Draws `n` (two digits at least) in big block digits, centred at the top of the screen. */
export function drawCountdown(
  r: Renderer,
  seconds: number,
  held: boolean,
  t: number,
  reduceFlashing: boolean,
): void {
  const text = String(seconds).padStart(2, '0');
  const s = DIGIT_SCALE;
  const w = text.length * 4 * s - s;
  const x0 = (SCREEN_W - w) >> 1;
  const final = seconds <= FINAL_SECONDS && !held;
  // The last ten seconds: red, and (without reduce flashing) pulsing between two reds.
  const color = held
    ? '#7c7c7c'
    : final
      ? reduceFlashing || ((t >> 3) & 1) === 0
        ? '#f83800'
        : '#a81000'
      : '#fcfcfc';
  r.rect(x0 - 3, COUNTDOWN_Y - 3, w + 6, 5 * s + 6, 'rgba(0,0,0,0.6)');
  [...text].forEach((ch, i) => {
    const rows = DIGITS[Number(ch)] ?? DIGITS[0];
    rows?.forEach((bits, y) => {
      for (let x = 0; x < 3; x++)
        if (bits & (4 >> x)) r.rect(x0 + i * 4 * s + x * s, COUNTDOWN_Y + y * s, s, s, color);
    });
  });
}

/**
 * The alarm's red wash over the cavern: it swells and fades about once a second (faster in the
 * last ten seconds); with reduce flashing it stays a steady light tint.
 */
export function drawAlarmTint(r: Renderer, t: number, seconds: number, reduceFlashing: boolean): void {
  let a = 0.12;
  if (!reduceFlashing) {
    const period = seconds <= FINAL_SECONDS ? 30 : 60;
    a = 0.06 + 0.1 * (0.5 + 0.5 * Math.sin((t / period) * Math.PI * 2));
  }
  r.rect(0, 0, SCREEN_W, SCREEN_H, `rgba(248,56,0,${a.toFixed(3)})`);
}

/**
 * The cavern blowing up: without reduce flashing white and orange alternate for a moment, then
 * the screen fades to white; with reduce flashing it only fades (no flicker).
 */
export function drawBlast(r: Renderer, t: number, reduceFlashing: boolean): void {
  if (!reduceFlashing && t < 40) {
    r.rect(0, 0, SCREEN_W, SCREEN_H, (t >> 2) & 1 ? '#fcfcfc' : '#fc7460');
    return;
  }
  const a = Math.min(1, t / (BOOM_FRAMES * 0.6));
  r.rect(0, 0, SCREEN_W, SCREEN_H, `rgba(252,252,252,${a.toFixed(3)})`);
}

/** Lines of the bitmap font on a dark band, centred, the first at `y`. */
export function drawBanner(r: Renderer, font: SpriteSheet, lines: readonly string[], y: number): void {
  const w = Math.max(...lines.map((l) => l.length)) * 8;
  r.rect(((SCREEN_W - w) >> 1) - 8, y - 6, w + 16, lines.length * 12 + 8, 'rgba(0,0,0,0.75)');
  lines.forEach((l, i) => r.text(font, l, (SCREEN_W - l.length * 8) >> 1, y + i * 12));
}

/**
 * Zebes Escape's own menu: Continue, or Give up (ends the round as 'quit'), and in dev mode the
 * assists (No damage keeps Samus's energy, a pit still ends the round; Infinite time holds the
 * countdown). Pauses the music and the countdown.
 */
export class EscapeMenuScene extends MiniGameMenuScene {
  constructor(game: Game, giveUp: () => void) {
    super(
      game,
      'ZEBES ESCAPE',
      giveUp,
      'Samus stays brainwashed for now; you can try the escape again later',
    );
  }
}
