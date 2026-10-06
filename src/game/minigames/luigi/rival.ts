import type { Action } from '@engine/input/actions';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { px, toPx } from '@engine/math/units';
import { Player } from '../../entities/player';
import type { View } from '../../entities/entity';
import { startHp, type CharacterDef } from '../../characters/character';
import { plumberSprite } from '../../characters/mario';
import { TileMap } from '../../world/tilemap';
import type { LevelData } from '../../level/schema';

/**
 * A racer's way along the course, keyed to where the racer is (px of the body's left edge), so
 * the same route plays out the same way every time. Jumps fire in order once the racer is on the
 * ground at or past `at`, holding jump for `hold` frames; inside a `walks` stretch the racer lets
 * go of run; at a pause (once on the ground at or past `at`) the racer lets go of everything for
 * `frames` frames.
 */
export interface Route {
  jumps: readonly { at: number; hold: number }[];
  walks?: readonly (readonly [number, number])[];
  pauses?: readonly { at: number; frames: number }[];
  /** A top running speed (velocity units) in place of the hero's own; the rival's pace. */
  maxRun?: number;
}

/** Drives a Player along a Route: an InputFrame whose buttons are worked out each frame. */
export class RouteInput implements InputFrame {
  private cur = new Set<Action>();
  private prev = new Set<Action>();
  private next = 0;
  private holdLeft = 0;
  private buffered = false;
  private nextPause = 0;
  /** Frames left standing still at a pause. */
  pauseLeft = 0;

  constructor(private readonly route: Route) {}

  /** Work out this frame's buttons from where `p` is. */
  step(p: Player): void {
    const b = p.body;
    const x = toPx(b.x);
    this.prev = this.cur;
    this.buffered = false;
    const pause = this.route.pauses?.[this.nextPause];
    if (pause && this.pauseLeft === 0 && b.onGround && x >= pause.at) {
      this.nextPause++;
      this.pauseLeft = pause.frames;
    }
    if (this.pauseLeft > 0) {
      this.pauseLeft--;
      this.cur = new Set();
      return;
    }
    const held: Action[] = ['right'];
    const walking = this.route.walks?.some(([a, z]) => x >= a && x < z) ?? false;
    if (!walking) held.push('run');
    const jump = this.route.jumps[this.next];
    if (this.holdLeft > 0) {
      this.holdLeft--;
      held.push('jump');
    } else if (jump && b.onGround && x >= jump.at && !this.prev.has('jump')) {
      // A new press: the player takes off this frame (the jump buffer is that one press).
      this.next++;
      this.holdLeft = jump.hold - 1;
      this.buffered = true;
      held.push('jump');
    }
    this.cur = new Set(held);
  }

  held(a: Action): boolean {
    return this.cur.has(a);
  }
  pressed(a: Action): boolean {
    return this.cur.has(a) && !this.prev.has(a);
  }
  released(a: Action): boolean {
    return !this.cur.has(a) && this.prev.has(a);
  }
  bufferedJump(): boolean {
    return this.buffered;
  }
  consumeJumpBuffer(): void {
    this.buffered = false;
  }
  get dirX(): -1 | 0 | 1 {
    return this.cur.has('right') ? 1 : 0;
  }
}

/** Brainwashed Luigi's palette (content/sprites/mario.ts): his own sprites in a dark purple suit. */
const MIRROR_PALETTES = { normal: 'luigi-mirror', fire: 'luigi-mirror', star: 'mario-star' } as const;

/** Frames per px the rival slides down the pole once there. */
const POLE_SLIDE = 2;

/**
 * The rival: Luigi with his real CharacterDef physics, steered along a fixed Route. A ghost
 * racer: he runs on his own copy of the course's tiles (so nothing Mario bumps changes his way),
 * meets no enemies, and never touches or hurts Mario. Silent, so his jumps don't sound like the
 * player's.
 */
export class RivalLuigi {
  readonly player: Player;
  private readonly map: TileMap;
  private readonly input: RouteInput;
  /** Frames run so far, and the frame he reached the pole (null until then). */
  frames = 0;
  finishedAt: number | null = null;
  /** Frozen in place (the race was decided another way). */
  stopped = false;

  constructor(
    level: LevelData,
    def: CharacterDef,
    route: Route,
    /** Subpixel x of his body's left edge at the start (feet on the level's start row). */
    x: number,
    /** The pole's left edge and the top of its base block, in px. */
    private readonly pole: { x: number; baseY: number },
  ) {
    this.map = new TileMap(level);
    const tmp = new Player(0, 0, def, 'small', startHp(def));
    const h = def.hitbox(tmp).h;
    this.player = new Player(x, px((level.start.y + 1) * 16 - h), def, 'small', startHp(def));
    if (route.maxRun !== undefined) this.player.profile = { ...def.movement, maxRun: route.maxRun };
    this.input = new RouteInput(route);
  }

  /** px of his body's left edge. */
  get x(): number {
    return toPx(this.player.body.x);
  }

  get finished(): boolean {
    return this.finishedAt !== null;
  }

  update(): void {
    const p = this.player;
    if (this.stopped) return;
    if (this.finished) return this.slide();
    this.frames++;
    this.input.step(p);
    p.update(this.input, this.map, NULL_AUDIO);
    // At a pause, once stopped, he turns to stare back at Mario.
    if (this.input.pauseLeft > 0 && p.body.vx === 0) p.facing = -1;
    // Grabbing the pole: the shaft's 2 px column, anywhere along it.
    const b = p.body;
    if (b.x + b.w >= px(this.pole.x)) {
      this.finishedAt = this.frames;
      p.frozen = true;
      p.body.vx = 0;
      p.body.vy = 0;
      p.body.x = px(this.pole.x) - p.body.w + px(2);
      p.anim = 'climb';
      p.facing = 1;
    }
  }

  /** Down the pole after the win. */
  private slide(): void {
    const b = this.player.body;
    const bottom = px(this.pole.baseY) - b.h;
    if (b.y < bottom) b.y = Math.min(b.y + px(POLE_SLIDE), bottom);
    this.player.frame++;
  }

  render(r: Renderer, view: View): void {
    const p = this.player;
    const s = plumberSprite(p, view.frame, view.reduceFlashing, MIRROR_PALETTES);
    const sheet = view.assets.sheet(s.sheet, s.palette);
    const w = sheet.frames.get(s.frame)?.w ?? 16;
    const x = toPx(p.body.x) - view.camX - (s.flip ? w - toPx(p.body.w) - s.offsetX : s.offsetX);
    r.sprite(sheet, s.frame, x, toPx(p.body.y) - s.offsetY, s.flip);
  }
}
