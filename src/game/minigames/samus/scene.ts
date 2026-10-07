import type { Scene } from '@engine/scene';
import { NO_INPUT, type InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { TouchLabels } from '@engine/input/touch';
import type { AssetRegistry } from '@engine/assets/registry';
import { toPx } from '@engine/math/units';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import { fxPalette } from '@content/sprites/palette-fx';
import { levelSeed, World } from '../../world/world';
import { newGameState, type GameState } from '../../context';
import { SAMUS } from '../../characters/samus';
import type { Player } from '../../entities/player';
import type { Game } from '../../scenes/game';
import { abilityHint } from '../../scenes/hints';
import { levelTouchLabels, NO_TOUCH_BUTTONS } from '../../touch-labels';
import { MiniGameMenuScene } from '../menu';
import { GAME_OVER_FRAMES, lifeLostSaid, MiniLives, type LifeLost, type MiniCheckpoint } from '../lives';
import type { MiniGameResult } from '../types';
import { ZEBES_SOUNDS } from './art';
import { Creature, SkreeShard, type Ship } from './creatures';
import { drawEscapeHud, drawTimeCounter, timeShown, TIME_MAX } from './hud';
import { escapeEntities, escapeStage } from './stage';

/**
 * Frames Samus takes to materialise on her start spot to her start jingle (no READY), before
 * she can move and the clock starts: 2.5 s, the jingle's length.
 */
export const APPEAR_FRAMES = 150;
/** The self-destruct countdown, in seconds (the TIME counter shows it as 999 down to 0). */
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
/** Frames the cavern takes to blow up before the life is lost. */
export const BOOM_FRAMES = 120;
/** Frames the opening banner stays up. */
export const BANNER_FRAMES = 150;
/** The escape's opener, as Metroid's after Mother Brain. */
export const OPENER = ['TIME BOMB SET', 'GET OUT FAST!'] as const;

/**
 * Samus's kit for the escape (her devKit's scratch keys, toned down): one energy tank (60
 * energy), the Long Beam, ten missiles; morph ball and bombs are always hers. No Varia suit.
 */
export const ESCAPE_KIT = { tanks: 1, maxHp: 60, beam: 1, missiles: 10 } as const;

/**
 * Where a life starts (MiniLives): the Chozo chamber, and halfway, the middle corridor at the
 * top of the first shaft (reached on coming up into it: rows 16-18).
 */
export const ESCAPE_START: MiniCheckpoint = { id: 'start', x: 3, y: 42 };
export const ESCAPE_CHECKPOINTS: readonly MiniCheckpoint[] = [
  { id: 'mid', x: 35, y: 18, at: 0, rows: [16, 18] },
];

export type EscapePhase = 'appear' | 'escape' | 'liftoff' | 'boom' | 'dead' | 'gameover' | 'over';

export interface EscapeOptions {
  /** World seed (drops). */
  seed?: number;
  /** Countdown length in frames (tests). */
  countdown?: number;
}

/**
 * Samus's mini game, Zebes Escape: the cavern under 4-2 starts to self-destruct. Played as Samus
 * (beam, missiles, morph ball and bombs) in a World of its own (stage.map, a `camera: free` map
 * three screens high, built again for each life) with a fresh GameState, so the campaign's lives,
 * score and power are never touched. Each life starts with Samus materialising to her jingle;
 * the first opens on TIME BOMB SET / GET OUT FAST!. The HUD is Metroid's (energy tanks, EN,
 * missiles) with the escape's TIME counter running down from 999 while alarm lights blink and
 * the `alarm` sounds (faster in the last ten seconds); Samus climbs two shafts, rolls through
 * morph-ball tunnels, bombs through walls and runs for her ship. Boarding it passes (after the
 * lift-off). Three lives (lives.ts): losing all energy (she explodes), a pit or the clock
 * running out (the cavern blows up) costs one, and the next starts at the last checkpoint with
 * the clock full again; losing the last is GAME OVER, which fails the round. The menu's Give up
 * quits.
 */
export class EscapeScene implements Scene {
  /** The life in play's World (a new one each life). */
  world: World;
  readonly state: GameState;
  readonly lives: MiniLives;
  phase: EscapePhase = 'appear';
  /** Frames since the scene started, and in the current phase. */
  t = 0;
  phaseT = 0;
  /** Countdown frames left, of `total`. */
  left: number;
  readonly total: number;
  banner: { lines: string[]; until: number; y: number } | null = null;
  ship: Ship | null = null;
  /** Callouts said so far this life (seconds). */
  private called = new Set<number>();
  /** The infinite-time assist's note was said (once a round). */
  private heldSaid = false;
  /** The music was set back to normal speed while the countdown holds. */
  private tempoHeld = false;
  /** What losing the life in play came to (decided as she goes down). */
  private lost: LifeLost | null = null;
  /** Lives started so far (the opener is the first's). */
  private life = 0;
  /** The cavern blew up on the life just lost (the white stays up under GAME OVER). */
  private blasted = false;
  private music: string | null = null;
  private nextAlarm = 0;
  private readonly seed: number;

  constructor(
    private readonly game: Game,
    private readonly done: (result: MiniGameResult) => void,
    opts: EscapeOptions = {},
  ) {
    const state = newGameState(SAMUS);
    state.lives = 1;
    state.world = 4;
    state.stage = 2;
    this.state = state;
    this.total = opts.countdown ?? COUNTDOWN_FRAMES;
    this.left = this.total;
    this.seed = opts.seed ?? levelSeed(escapeStage());
    this.lives = new MiniLives({
      start: ESCAPE_START,
      checkpoints: ESCAPE_CHECKPOINTS,
      infinite: () => game.ctx.assist.infiniteLives,
    });
    this.world = this.buildWorld();
  }

  /** A World for the next life, Samus at the current checkpoint, about to materialise. */
  private buildWorld(): World {
    const level = escapeStage();
    this.state.kit = { ...ESCAPE_KIT };
    this.state.hp = ESCAPE_KIT.maxHp;
    const world = new World(level, this.game.ctx, this.state, {
      ...this.lives.start,
      mode: 'stand',
      deathStyle: 'explode',
      seed: this.seed,
      scorePopups: false, // the HUD shows no score
      extraEntities: escapeEntities({ onShip: (ship) => this.boarded(ship) }),
    });
    world.time = null;
    // The statue, the alarm lights and the creatures show while she materialises already; the
    // world does not step until the escape starts, so they stay still till then.
    world.spawnInView();
    world.player.hidden = true;
    return world;
  }

  get player(): Player {
    return this.world.player;
  }

  /** Whole seconds left on the countdown (the announcer's callouts). */
  get seconds(): number {
    return Math.ceil(this.left / 60);
  }

  /** The TIME counter: 999 at the start, 0 when the cavern blows. */
  get time(): number {
    return timeShown(this.left, this.total);
  }

  /** The countdown holds: the dev assist Infinite time is on. */
  get held(): boolean {
    return this.game.ctx.assist.infiniteTime;
  }

  enter(): void {
    this.game.ctx.audio.stopMusic();
    this.startLife();
    this.say(
      `Zebes escape. Play as Samus: the cavern blows up in ${this.seconds} seconds. Climb the shafts, ` +
        `${this.hint('DOWN', 'down')} rolls into the morph ball for the low tunnels, ` +
        `${this.hint('BOMB', 'attack')} in the ball opens cracked blocks, and reach your ship. ` +
        `${this.lives.lives} lives. ${this.hint('MENU', 'start')} for the menu.`,
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

  /** Samus's buttons as in a level while she runs; only MENU while she appears; none once decided. */
  touchLabels(): TouchLabels {
    if (this.phase === 'escape') return levelTouchLabels(this.world.players[0], this.world);
    if (this.phase === 'appear') return { ...NO_TOUCH_BUTTONS, start: 'MENU' };
    return { ...NO_TOUCH_BUTTONS };
  }

  /** Can the menu open now (not once the life or the round is decided). */
  private get menuOpen(): boolean {
    return this.phase === 'appear' || this.phase === 'escape';
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
      case 'appear':
        // The OK that started the round must not make Samus jump.
        input.consumeJumpBuffer();
        if (this.phaseT >= APPEAR_FRAMES) this.startEscape();
        return;
      case 'escape':
        this.tickCountdown();
        if (this.phase !== 'escape') return;
        this.step(input);
        if (this.phase === 'escape') this.reachCheckpoints();
        return;
      case 'liftoff':
        this.step(NO_INPUT);
        if (this.phaseT >= LIFTOFF_FRAMES) this.finish('pass');
        return;
      case 'boom':
        if (this.phaseT >= BOOM_FRAMES) this.afterLoss();
        return;
      case 'dead':
        this.step(NO_INPUT);
        return;
      case 'gameover':
        if (this.phaseT >= GAME_OVER_FRAMES) this.finish('fail');
        return;
    }
  }

  /** A life begins: Samus materialises (hidden in the World) to her jingle. */
  private startLife(): void {
    this.setPhase('appear');
    this.life++;
    this.left = this.total;
    this.called = new Set();
    this.game.ctx.audio.playJingle(ZEBES_SOUNDS.start);
  }

  private startEscape(): void {
    this.setPhase('escape');
    this.player.hidden = false;
    this.playMusic(ZEBES_SOUNDS.escape);
    this.game.ctx.audio.sfx(ZEBES_SOUNDS.alarm);
    this.nextAlarm = ALARM_EVERY;
    if (this.life === 1) {
      this.banner = { lines: [...OPENER], until: this.t + BANNER_FRAMES, y: 64 };
      this.say(`Time bomb set! Get out fast! ${this.seconds} seconds.`);
    } else this.say(`Get out fast! ${this.seconds} seconds.`);
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

  /**
   * One frame of the world with `input`. Going down (she explodes) costs a life; once that has
   * played, the next life starts at the checkpoint, or GAME OVER shows.
   */
  private step(input: InputFrame): void {
    this.world.update([input]);
    const events = this.world.events.splice(0);
    if (this.phase === 'escape' && this.player.dead) this.down();
    if (this.phase === 'dead' && events.some((e) => e.type === 'died')) this.afterLoss();
  }

  /** Samus went down (energy or a pit): a life is lost. */
  private down(): void {
    this.setPhase('dead');
    this.stopMusic(); // (the World stopped it already, for her own sound)
    this.banner = null;
    this.lost = this.lives.lose();
    const fell = toPx(this.player.body.y) > this.world.heightPx;
    const what = lifeLostSaid('Samus', this.lives.lives, this.game.ctx.assist.infiniteLives);
    this.say(fell ? what.replace('is down', 'fell') : what);
  }

  /** After the explosion (hers or the cavern's): the next life, or GAME OVER. */
  private afterLoss(): void {
    if (this.lost === 'retry') return this.nextLife();
    this.setPhase('gameover');
    this.stopMusic();
    this.banner = { lines: ['GAME OVER'], until: Infinity, y: 104 };
  }

  private nextLife(): void {
    this.world = this.buildWorld();
    this.lost = null;
    this.banner = null;
    this.blasted = false;
    this.startLife();
  }

  /** Coming up into the middle corridor moves where the next life starts. */
  private reachCheckpoints(): void {
    const p = this.player;
    if (p.dead) return;
    const b = p.body;
    this.lives.reach((b.x + (b.w >> 1)) >> 12, (b.y + (b.h >> 1)) >> 12);
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

  /** The clock ran out: the cavern blows up, and the life with it. */
  private blowUp(): void {
    this.setPhase('boom');
    this.stopMusic();
    this.banner = null;
    this.game.ctx.audio.sfx(ZEBES_SOUNDS.blast);
    this.blasted = true;
    this.lost = this.lives.lose();
    const left = this.lives.lives;
    const infinite = this.game.ctx.assist.infiniteLives;
    const after = infinite
      ? ''
      : left <= 0
        ? ' Game over.'
        : left === 1
          ? ' Last life.'
          : ` ${left} lives left.`;
    this.say(`Time is up. The cavern exploded.${after}`);
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
    if (this.phase === 'escape' || this.phase === 'appear')
      drawAlarmTint(r, this.t, this.seconds, ctx.reduceFlashing);
    if (this.phase === 'appear') {
      const cam = this.world.camera;
      drawMaterialise(r, ctx.assets, this.player, this.phaseT, cam.pxX, cam.pxY, ctx.reduceFlashing);
    }
    if (this.phase === 'boom') drawBlast(r, this.phaseT, ctx.reduceFlashing);
    else if (this.phase === 'gameover' && this.blasted) drawBlast(r, BOOM_FRAMES, ctx.reduceFlashing);
    // Metroid's HUD: energy tanks, EN, missiles; and the escape's TIME counter.
    const covered = (x: number, y: number, w: number, h: number) => this.world.spriteIn(x, y, w, h);
    drawEscapeHud(r, ctx.assets, this.player, covered);
    drawTimeCounter(r, ctx.assets, this.phase === 'appear' ? TIME_MAX : this.time, covered);
    const b = this.banner;
    if (b && this.t < b.until) drawBanner(r, font, b.lines, b.y);
  }
}

/* ---------- Samus materialising ---------- */

/** Sparkles over her spot (px offsets in a 16×32 box), the first ones first. */
const SPARKLES: readonly (readonly [number, number])[] = [
  [7, 14],
  [3, 6],
  [12, 22],
  [9, 2],
  [2, 26],
  [13, 10],
  [6, 30],
  [11, 17],
  [4, 19],
  [14, 4],
];
/** The share of APPEAR_FRAMES before her outline shows, and before she shows in full. */
export const APPEAR_OUTLINE = 0.4;
export const APPEAR_FULL = 0.8;

/**
 * Samus materialising at frame t of APPEAR_FRAMES: sparkles gather on her spot, then her outline
 * (her sprite in a flat grey), then herself. Without reduce flashing the sparkles twinkle; with
 * it they hold still.
 */
export function drawMaterialise(
  r: Renderer,
  assets: AssetRegistry,
  p: Player,
  t: number,
  camX: number,
  camY: number,
  reduceFlashing: boolean,
): void {
  const k = t / APPEAR_FRAMES;
  const s = p.def.sprite(p, 0, true);
  const x = toPx(p.body.x) - camX - s.offsetX;
  const top = toPx(p.body.y + p.body.h) - camY - 32;
  if (k >= APPEAR_FULL) {
    r.sprite(assets.sheet(s.sheet, s.palette), s.frame, x, toPx(p.body.y) - camY - s.offsetY, s.flip);
    return;
  }
  if (k >= APPEAR_OUTLINE)
    r.sprite(
      assets.sheet(s.sheet, fxPalette(s.palette, 'rim')),
      s.frame,
      x,
      toPx(p.body.y) - camY - s.offsetY,
      s.flip,
    );
  const n = Math.min(SPARKLES.length, 2 + Math.floor(k * 12));
  for (let i = 0; i < n; i++) {
    const [dx, dy] = SPARKLES[i] as readonly [number, number];
    const on = reduceFlashing || ((t >> 2) + i) % 3 !== 0;
    if (on) r.rect(x + dx, top + dy, 2, 2, i % 2 ? '#fcfcfc' : '#a4e4fc');
  }
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
 * assists (No damage keeps Samus's energy, a pit still costs a life; Infinite time holds the
 * countdown; Infinite lives keeps her lives). Pauses the music and the countdown.
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
