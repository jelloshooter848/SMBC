import type { Scene } from '@engine/scene';
import { NO_INPUT, type InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { TouchLabels } from '@engine/input/touch';
import type { AssetRegistry } from '@engine/assets/registry';
import { px, tileToSub, toPx } from '@engine/math/units';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import { fxPalette } from '@content/sprites/palette-fx';
import { levelSeed, World } from '../../world/world';
import { newGameState, type GameState } from '../../context';
import { SAMUS } from '../../characters/samus';
import type { Entity } from '../../entities/entity';
import type { Player } from '../../entities/player';
import type { Game } from '../../scenes/game';
import { abilityHint } from '../../scenes/hints';
import { levelTouchLabels, NO_TOUCH_BUTTONS } from '../../touch-labels';
import { MiniGameMenuScene } from '../menu';
import { GAME_OVER_FRAMES, lifeLostSaid, MiniLives, type LifeLost, type MiniCheckpoint } from '../lives';
import type { MiniGameResult } from '../types';
import { ZEBES_SOUNDS } from './art';
import { drawEscapeHud, drawTimeCounter, timePalette, timeShown, TIME_MAX } from './hud';
import { escapeEntities, escapeStage, roomAt, roomBounds, ROOMS, SURFACE_ROW, type Room } from './stage';
import { BrainTank, CannonShot, type Door, type TourianHooks } from './tourian';

/**
 * Frames Samus takes to materialise on her start spot to her start jingle (no READY), before
 * she can move: 2.5 s, the jingle's length.
 */
export const APPEAR_FRAMES = 150;
/** The self-destruct countdown, in seconds (the TIME counter shows it as 999 down to 0). */
export const COUNTDOWN_SECONDS = 60;
export const COUNTDOWN_FRAMES = COUNTDOWN_SECONDS * 60;
/** Seconds left at which the announcer calls the time. */
export const CALLOUTS = [30, 10] as const;
/** The final stretch: the alarm ticks faster and the music speeds up. */
export const FINAL_SECONDS = 10;
/** Frames between alarm sounds, before and in the final stretch. */
export const ALARM_EVERY = 120;
export const ALARM_EVERY_FINAL = 30;
/** Music speed in the final stretch. */
export const FINAL_TEMPO = 1.2;
/** Frames a door's scroll to the next room takes (a screen at 4 px a frame, as Metroid's). */
export const DOOR_SCROLL_FRAMES = 64;
/** Frames the bubble behind Samus stays open after a scroll before it shuts. */
export const DOOR_SHUT_BEHIND = 20;
/** Frames the ending on the surface plays before the round passes. */
export const ENDING_FRAMES = 240;
/** Frames Tourian takes to blow up before the life is lost. */
export const BOOM_FRAMES = 120;
/** Frames the opening banner stays up. */
export const BANNER_FRAMES = 150;
/** The escape's opener, as Metroid's after Mother Brain. */
export const OPENER = ['TIME BOMB SET', 'GET OUT FAST!'] as const;

/**
 * Samus's kit for the round (her devKit's scratch keys, toned down): one energy tank (60 energy),
 * the Long Beam, thirty missiles (the red door, the barriers and the brain take 23); morph ball
 * and bombs are always hers. No Varia suit.
 */
export const ESCAPE_KIT = { tanks: 1, maxHp: 60, beam: 1, missiles: 30 } as const;

/**
 * Where a life starts (MiniLives): Tourian's first corridor; the brain's chamber once she has
 * gone through the red door; the foot of the escape shaft once the bomb is set.
 */
export const ESCAPE_START: MiniCheckpoint = { id: 'start', x: 3, y: 56 };
export const ESCAPE_CHECKPOINTS: readonly MiniCheckpoint[] = [
  { id: 'brain', x: 50, y: 56 },
  { id: 'escape', x: 82, y: 56 },
];

export type EscapePhase = 'appear' | 'tourian' | 'escape' | 'ending' | 'boom' | 'dead' | 'gameover' | 'over';

export interface EscapeOptions {
  /** World seed (drops). */
  seed?: number;
  /** Countdown length in frames (tests). */
  countdown?: number;
}

/** A door's scroll under way: the camera and Samus slide into the next room. */
export interface DoorScroll {
  door: Door;
  to: Room;
  t: number;
  from: { x: number; y: number; px: number };
  goal: { x: number; y: number; px: number };
}

/**
 * Samus's mini game, Zebes Escape, as the NES Metroid ends: Tourian, then the escape. Played as
 * Samus (beam, missiles, morph ball and bombs) in a World of its own (stage.map, four rooms built
 * again for each life) with a fresh GameState, so the campaign's lives, score and power are never
 * touched. Each life starts with Samus materialising to her jingle. In Tourian she shoots bubble
 * doors open and walks through them (the screen scrolls a room on and the door shuts behind her;
 * the red one takes five missiles), rolls and bombs through a wall, breaks the barriers with
 * missiles past cannons and Rinkas, and destroys the brain in its tank. That sets the time bomb:
 * TIME BOMB SET / GET OUT FAST!, the TIME counter running down from 999 with the alarm, and she
 * climbs the escape shaft to the surface, where a short ending plays and the round passes. The
 * HUD is Metroid's (energy tanks, EN, missiles). Three lives (lives.ts): losing all energy (she
 * explodes) or the clock running out (Tourian blows up) costs one; the next starts at the last
 * checkpoint (after the bomb: the foot of the shaft, the clock full again, the brain still dead);
 * losing the last is GAME OVER, which fails the round. The menu's Give up quits.
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
  /** The room Samus is in (the camera keeps inside it). */
  room: Room;
  /** A door's scroll under way, or null. */
  transition: DoorScroll | null = null;
  /** The brain is dead and the time bomb set (for the rest of the round). */
  bombSet = false;
  /** Callouts said so far this life (seconds). */
  private called = new Set<number>();
  /** The infinite-time assist's note was said (once a round). */
  private heldSaid = false;
  /** The music was set back to normal speed while the countdown holds. */
  private tempoHeld = false;
  /** What losing the life in play came to (decided as she goes down). */
  private lost: LifeLost | null = null;
  /** Lives started so far. */
  private life = 0;
  /** Tourian blew up on the life just lost (the white stays up under GAME OVER). */
  private blasted = false;
  private music: string | null = null;
  private nextAlarm = 0;
  private readonly seed: number;
  private readonly hooks: TourianHooks = {
    active: (e) => this.transition === null && roomOf(e) === this.room,
    calm: () => this.bombSet,
    onDoor: (door) => this.enterDoor(door),
    onBrain: () => this.brainDown(),
  };

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
    this.room = ROOMS[0] as Room;
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
      extraEntities: escapeEntities(this.hooks),
    });
    world.time = null;
    this.transition = null;
    this.syncRoom(world, true);
    // The doors, the brain and the guards show while she materialises already; the world does
    // not step until she can move, so they stay still till then.
    world.spawnInView();
    if (this.bombSet) for (const e of world.entities) if (e instanceof BrainTank) e.destroyed();
    world.player.hidden = true;
    return world;
  }

  /**
   * The room Samus's centre is in becomes the room on screen (rooms change through doors; a
   * warp in a test lands anywhere); `snap` puts the camera on her at once.
   */
  syncRoom(world: World = this.world, snap = false): void {
    const r = roomOf(world.player);
    if (r) this.room = r;
    const cam = world.camera;
    cam.room = roomBounds(this.room);
    if (snap) cam.snapTo(world.player.body.x, world.player.body.y);
  }

  get player(): Player {
    return this.world.player;
  }

  /** Whole seconds left on the countdown (the announcer's callouts). */
  get seconds(): number {
    return Math.ceil(this.left / 60);
  }

  /** The TIME counter: 999 at the start, 0 when Tourian blows. */
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
      `Zebes escape. Play as Samus in Tourian. ${this.hint('SHOOT', 'attack')} opens the blue doors; ` +
        `the red door, the barriers and the brain take ${this.hint('MISSILE', 'special')}. ` +
        `${this.hint('MORPH', 'down')} rolls into the ball, and ${this.hint('BOMB', 'attack')} in the ball ` +
        `opens cracked blocks. Destroy the brain, then climb out before the time bomb goes off. ` +
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

  /** In play (Tourian or the escape): Samus can move. */
  private get playing(): boolean {
    return this.phase === 'tourian' || this.phase === 'escape';
  }

  /** Samus's buttons as in a level while she plays; only MENU while she appears; none once decided. */
  touchLabels(): TouchLabels {
    if (this.playing) return levelTouchLabels(this.world.players[0], this.world);
    if (this.phase === 'appear') return { ...NO_TOUCH_BUTTONS, start: 'MENU' };
    return { ...NO_TOUCH_BUTTONS };
  }

  /** Can the menu open now (not once the life or the round is decided). */
  private get menuOpen(): boolean {
    return this.phase === 'appear' || this.playing;
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
        if (this.phaseT >= APPEAR_FRAMES) {
          if (this.bombSet) this.startEscape();
          else this.startTourian();
        }
        return;
      case 'tourian':
        if (this.transition) this.scroll();
        else this.step(input);
        return;
      case 'escape':
        this.tickCountdown();
        if (this.phase !== 'escape') return;
        if (this.transition) this.scroll();
        else {
          this.step(input);
          if (this.phase === 'escape') this.checkSurface();
        }
        return;
      case 'ending':
        if (this.phaseT >= ENDING_FRAMES) this.finish('pass');
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

  /** Into Tourian (no clock yet: there is none until the brain falls). */
  private startTourian(): void {
    this.setPhase('tourian');
    this.player.hidden = false;
    this.playMusic(ZEBES_SOUNDS.tourian);
  }

  /** The escape: the countdown, the alarm, the opener (on the life the bomb was set). */
  private startEscape(opener = false): void {
    this.setPhase('escape');
    this.player.hidden = false;
    this.left = this.total;
    this.called = new Set();
    this.playMusic(ZEBES_SOUNDS.escape);
    this.game.ctx.audio.sfx(ZEBES_SOUNDS.alarm);
    this.nextAlarm = ALARM_EVERY;
    if (opener) {
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
    if (this.playing && this.player.dead) this.down();
    if (this.phase === 'dead' && events.some((e) => e.type === 'died')) this.afterLoss();
    if (this.playing && !this.transition) this.syncRoom();
  }

  /** Samus went down: a life is lost. */
  private down(): void {
    this.setPhase('dead');
    this.transition = null;
    this.stopMusic(); // (the World stopped it already, for her own sound)
    this.banner = null;
    this.lost = this.lives.lose();
    this.say(lifeLostSaid('Samus', this.lives.lives, this.game.ctx.assist.infiniteLives));
  }

  /** After the explosion (hers or Tourian's): the next life, or GAME OVER. */
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

  /* ---------- Doors ---------- */

  /** Samus walked into an open door: the scroll to the room past it begins. */
  private enterDoor(door: Door): void {
    const pair = door.pair;
    const to = pair ? roomAt(pair.tx, pair.ty) : null;
    if (!pair || !to || this.transition) return;
    const p = this.player;
    const b = p.body;
    pair.openUp(null);
    b.vx = 0;
    b.vy = 0;
    const cam = this.world.camera;
    const goalX = door.leads > 0 ? pair.body.x + pair.body.w + px(2) : pair.body.x - b.w - px(2);
    const room = roomBounds(to);
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    this.transition = {
      door,
      to,
      t: 0,
      from: { x: cam.x, y: cam.y, px: b.x },
      goal: {
        x: clamp(goalX - cam.pushX, room.x0, room.x1 - px(SCREEN_W)),
        y: clamp(cam.y, room.y0, room.y1 - px(SCREEN_H)),
        px: goalX,
      },
    };
    p.facing = door.leads;
  }

  /** One frame of a door's scroll: the world holds still while the screen slides on. */
  private scroll(): void {
    const s = this.transition as DoorScroll;
    s.t++;
    const k = Math.min(1, s.t / DOOR_SCROLL_FRAMES);
    const cam = this.world.camera;
    cam.room = null;
    cam.x = Math.round(s.from.x + (s.goal.x - s.from.x) * k);
    cam.y = Math.round(s.from.y + (s.goal.y - s.from.y) * k);
    this.player.body.x = Math.round(s.from.px + (s.goal.px - s.from.px) * k);
    this.world.spawnInView();
    if (s.t < DOOR_SCROLL_FRAMES) return;
    // Through: the room on, the bubble she came through shut, the one behind her shutting.
    this.transition = null;
    this.room = s.to;
    cam.room = roomBounds(s.to);
    s.door.close();
    const pair = s.door.pair;
    if (pair) pair.openFor = DOOR_SHUT_BEHIND;
    if (s.to.id === 'brain' && !this.bombSet) this.lives.set('brain');
  }

  /* ---------- The brain and the escape ---------- */

  /** The brain is destroyed: the time bomb is set and the escape begins. */
  private brainDown(): void {
    if (this.bombSet) return;
    this.bombSet = true;
    this.lives.set('escape');
    for (const e of this.world.entities) if (e instanceof CannonShot) e.destroy();
    this.startEscape(true);
  }

  /** Standing on the surface above the shaft ends the round. */
  private checkSurface(): void {
    const b = this.player.body;
    if (b.onGround && !this.player.dead && b.y + b.h <= tileToSub(SURFACE_ROW)) this.reachSurface();
  }

  /** Out: the clock stops and a short ending plays on the surface, then the round passes. */
  private reachSurface(): void {
    this.setPhase('ending');
    this.stopMusic();
    const p = this.player;
    p.frozen = true;
    p.body.vx = 0;
    p.body.vy = 0;
    p.facing = 1;
    this.game.ctx.audio.playJingle(ZEBES_SOUNDS.victory);
    this.banner = { lines: ['SAMUS ESCAPED!'], until: Infinity, y: 176 };
    const spell = this.game.inRound ? '' : ' The spell on Samus breaks.'; // none in a round for fun
    this.say(`Samus escaped to the surface with ${this.seconds} seconds to spare!${spell}`);
  }

  /* ---------- The blast ---------- */

  /** The clock ran out: Tourian blows up, and the life with it. */
  private blowUp(): void {
    this.setPhase('boom');
    this.transition = null;
    this.stopMusic();
    this.banner = null;
    this.game.ctx.audio.sfx(ZEBES_SOUNDS.blast);
    this.blasted = true;
    this.lost = this.lives.lose();
    // The cause, then the lives as every other lost life says them.
    const what = lifeLostSaid('Samus', this.lives.lives, this.game.ctx.assist.infiniteLives);
    this.say(`Time is up. Tourian exploded. ${what}`);
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
    const cam = this.world.camera;
    if (this.phase === 'escape' || (this.phase === 'appear' && this.bombSet))
      drawAlarmTint(r, this.t, this.seconds, ctx.reduceFlashing);
    if (this.phase === 'appear')
      drawMaterialise(r, ctx.assets, this.player, this.phaseT, cam.pxX, cam.pxY, ctx.reduceFlashing);
    if (this.phase === 'ending') drawEnding(r, this.phaseT, cam.pxY, ctx.reduceFlashing);
    if (this.phase === 'boom') drawBlast(r, this.phaseT, ctx.reduceFlashing);
    else if (this.phase === 'gameover' && this.blasted) drawBlast(r, BOOM_FRAMES, ctx.reduceFlashing);
    // Metroid's HUD: energy tanks, EN, missiles; and after the bomb, the escape's TIME counter.
    const covered = (x: number, y: number, w: number, h: number) => this.world.spriteIn(x, y, w, h);
    drawEscapeHud(r, ctx.assets, this.player, covered);
    if (this.bombSet) {
      const final = this.phase === 'escape' && this.seconds <= FINAL_SECONDS;
      const tint = this.held ? 'held' : final ? 'final' : 'plain';
      const palette = timePalette(tint, this.t, ctx.reduceFlashing);
      drawTimeCounter(r, ctx.assets, this.phase === 'appear' ? TIME_MAX : this.time, covered, palette);
    }
    const b = this.banner;
    if (b && this.t < b.until) drawBanner(r, font, b.lines, b.y);
  }
}

/** The room an entity's centre is in. */
function roomOf(e: { readonly body: Entity['body'] }): Room | null {
  const b = e.body;
  return roomAt((b.x + (b.w >> 1)) >> 12, (b.y + (b.h >> 1)) >> 12);
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
 * The alarm's red wash over the screen: it swells and fades about once a second (faster in the
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
 * Tourian blowing up: without reduce flashing white and orange alternate for a moment, then
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

/** Fixed stars over the surface's sky (px in a 256x48 band). */
const STARS: readonly (readonly [number, number])[] = Array.from({ length: 28 }, (_, i) => [
  (i * 97 + ((i * i * 13) % 41)) % 256,
  4 + ((i * 53 + 7) % 40),
]);

/**
 * The ending on the surface (frame t of ENDING_FRAMES): stars come out over the sky above the
 * ground (map rows 0-2, `camY` the camera's px y), and a glow rises out of the shaft's mouth as
 * Tourian goes up behind her (it pulses without reduce flashing; a steady swell with it).
 */
export function drawEnding(r: Renderer, t: number, camY: number, reduceFlashing: boolean): void {
  const sky = SURFACE_ROW * 16 - camY;
  if (sky <= 0) return;
  const shown = Math.min(STARS.length, Math.floor((t / ENDING_FRAMES) * STARS.length * 2));
  for (let i = 0; i < shown; i++) {
    const [x, y] = STARS[i] as readonly [number, number];
    if (y < sky) r.rect(x, y, 1, 1, i % 5 === 0 ? '#fcfcfc' : '#a4e4fc');
  }
  // A column of light out of the mouth (x 83-89 of the shaft: screen px 48-160), fading upward.
  const k = Math.min(1, t / (ENDING_FRAMES * 0.6));
  const pulse = reduceFlashing ? 1 : 0.75 + 0.25 * Math.sin(t / 5);
  for (let y = 0; y < sky; y += 4) {
    const a = 0.45 * k * pulse * (y / sky);
    r.rect(48, y, 112, Math.min(4, sky - y), `rgba(252,216,168,${a.toFixed(3)})`);
  }
}

/** Lines of the bitmap font on a dark band, centred, the first at `y`. */
export function drawBanner(r: Renderer, font: SpriteSheet, lines: readonly string[], y: number): void {
  const w = Math.max(...lines.map((l) => l.length)) * 8;
  r.rect(((SCREEN_W - w) >> 1) - 8, y - 6, w + 16, lines.length * 12 + 8, 'rgba(0,0,0,0.75)');
  lines.forEach((l, i) => r.text(font, l, (SCREEN_W - l.length * 8) >> 1, y + i * 12));
}

/**
 * Zebes Escape's own menu: Continue, or Give up (ends the round as 'quit'), and in dev mode the
 * assists (No damage keeps Samus's energy; Infinite time holds the countdown; Infinite lives
 * keeps her lives). Pauses the music and the countdown.
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
