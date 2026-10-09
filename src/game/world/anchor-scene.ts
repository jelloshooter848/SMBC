import type { Renderer } from '@engine/gfx/renderer';
import type { InputFrame } from '@engine/input/input-manager';
import { px, toPx, velToSub } from '@engine/math/units';
import { moveX, moveY } from '../entities/body';
import { Entity, type View } from '../entities/entity';
import { Enemy } from '../entities/enemies/enemy';
import { Projectile } from '../entities/projectiles/projectile';
import type { AnchorDrop } from '../entities/objects/anchor-drop';
import type { Player } from '../entities/player';
import type { World } from './world';
import { ANCHOR_LARRY_SAID } from '../story/script';

/*
 * 4-2's anchor scene (0.4.39, owner's v0.4.34 play-test notes; campaign story only, once per file:
 * LevelScene sets World.anchorStory while it is due). It takes over from the anchor drop
 * (entities/objects/anchor-drop.ts) the moment a player lands on the hidden zone's floor, and play
 * holds while it runs (World.update runs only the scene):
 *
 * 1. The ground shakes (gently; not at all with reduce flashing, World.shakeY), never a flash.
 * 2. The hero stops and looks up (a `!` over the head).
 * 3. The anchor slams down (the drop's own fall and smash) and knocks the hero back, unhurt.
 * 4. Larry yells down from his airship: his card (`AnchorStory.cards('larry')`, read out, OK).
 * 5. He climbs down the chain, sees the hero, panics (a `!`) and scurries back up.
 * 6. The hero's line (`cards('hero')`: "LET'S GET HIM!", or that hero's own).
 * 7. Play goes on into the airship: the hero runs to the chain and climbs it off the top of the
 *    screen, as a climb would (World.boardChain: the chain's `vine` link, a climb arrival).
 *
 * BACK (or MENU) skips the whole scene at any point after a short guard, and so does BACK on its
 * cards: the anchor is put at rest, the pipe smashed, and the hero goes straight up into the
 * airship. Every card waits for a press (story/cards.ts); the scene's own beats are announced.
 */

export const ANCHOR_SCENE = {
  /** The rumble before the anchor shows; the hero looks up at LOOK_AT. */
  rumble: 70,
  lookAt: 16,
  /** After the crash: the knockback lands, then a beat before Larry yells. */
  yellAfter: 36,
  /** Larry's climb down (px a frame) to his feet at STOP_Y (screen px), his panic, the climb up. */
  down: 1.5,
  stopY: 160,
  panic: 48,
  up: 4,
  /** Off the top: a beat, then the hero's line. */
  heroAfter: 20,
  /** The run to the chain and the climb up it (px a frame). */
  run: 2,
  climb: 3,
  /** Frames before BACK or MENU may skip (a press held from before the scene does not count). */
  guard: 30,
} as const;
const S = ANCHOR_SCENE;

/** The knockback: up and away from the anchor (velocity units), and how far it reaches (px). */
const KNOCK_VY = 0x02c00;
const KNOCK_VX = 0x01400;
const KNOCK_NEAR_VX = 0x01c00;
const NEAR = 48;
const GRAVITY = 0x00400;
const MAX_FALL = 0x04000;

/** What the scene asks of the level (LevelScene): its cards, and that it has started. */
export interface AnchorStory {
  /**
   * Show Larry's yell (`larry`) or the hero's line (`hero`, player `hero` speaking) over the frozen
   * level; `done` runs when the last page closes, `skip` when BACK skips them.
   */
  cards(kind: 'larry' | 'hero', hero: Player, done: () => void, skip: () => void): void;
  /** Said by the announcer at the scene's beats (the rumble, the crash, Larry's panic). */
  say(text: string): void;
  /** The scene has started: it is seen on the file. */
  started(): void;
  /** The skip control as the hint on screen names it ("SKIP (X)"; "SKIP" on touch). */
  skipHint(): string;
}

export const ANCHOR_SCENE_SAID = {
  rumble: 'The ground shakes! You stop and look up.',
  crash: 'An anchor slams down and knocks you back!',
} as const;

export type AnchorPhase =
  'rumble' | 'fall' | 'knock' | 'yell' | 'down' | 'panic' | 'up' | 'hero' | 'go' | 'done';

export class AnchorScene {
  phase: AnchorPhase = 'rumble';
  /** Frames in the current phase, and in the whole scene. */
  private t = 0;
  age = 0;
  /** A card is up: the scene waits for it. */
  waiting = false;
  /** Larry on the chain (spawned for the climb down). */
  larry: LarryOnChain | null = null;
  private readonly marks: Exclaim[] = [];
  /** Set when it is over: play goes on up the chain. */
  over = false;

  constructor(
    readonly drop: AnchorDrop,
    readonly hero: Player,
    private readonly story: AnchorStory,
  ) {}

  /** Play holds: every player stands where it is (it falls to the floor if in the air). */
  start(world: World): void {
    this.drop.scripted = true;
    for (const p of world.players) {
      p.frozen = true;
      p.stairs = null;
      p.body.vx = 0;
      p.sliding = 0;
      p.activeMelee = null;
      p.invuln = 0;
      if (!p.dead && !p.out) p.anim = p.body.onGround ? 'idle' : 'jump';
    }
    world.shake(S.rumble + 4, 1);
    world.audio.sfx('rumble');
    this.story.started();
    // The SKIP hint on screen is said too (new text is announced).
    this.story.say(`${ANCHOR_SCENE_SAID.rumble} ${this.story.skipHint()} skips the scene.`);
  }

  private enter(phase: AnchorPhase): void {
    this.phase = phase;
    this.t = 0;
  }

  /** The chain's centre (px). */
  private get chainX(): number {
    return this.drop.tx * 16 + 8;
  }

  /** One frame; `inputs` may skip it. True once it is over (the hero is on the way up). */
  update(world: World, inputs: readonly InputFrame[]): boolean {
    if (this.over) return true;
    if (this.waiting) return false;
    this.age++;
    this.t++;
    if (this.age > S.guard && inputs.some((i) => i.pressed('attack') || i.pressed('start'))) {
      this.skip(world);
      return true;
    }
    this.effects(world);
    this.physics(world);
    switch (this.phase) {
      case 'rumble':
        if (this.t === 36) world.audio.sfx('rumble');
        if (this.t === S.lookAt) this.lookUp(world);
        if (this.t >= S.rumble) {
          this.drop.startFall();
          this.enter('fall');
        }
        break;
      case 'fall': {
        const was = this.drop.smashed;
        this.drop.fallStep(world);
        if (!was && this.drop.smashed) this.knockBack(world);
        if (this.drop.phase === 'rest') this.enter('knock');
        break;
      }
      case 'knock':
        if (this.t >= S.yellAfter && this.allLanded(world)) {
          for (const p of world.players) if (!p.dead && !p.out) p.facing = this.facingChain(p);
          this.cards(world, 'larry', () => this.enter('down'));
        }
        break;
      case 'down':
        if (this.t === 1) {
          this.larry = new LarryOnChain(this.chainX);
          world.spawn(this.larry);
          this.story.say(ANCHOR_LARRY_SAID);
        }
        if (this.larry && this.larry.climb(world, -S.down, S.stopY)) {
          this.larry.panic(this.hero);
          this.mark(world, this.larry.body.x + px(8), this.larry.body.y - px(3), S.panic);
          world.audio.sfx('flinch');
          this.enter('panic');
        }
        break;
      case 'panic':
        if (this.t >= S.panic) {
          this.larry?.flee();
          this.enter('up');
        }
        break;
      case 'up':
        if (this.larry && this.larry.climb(world, S.up, -40)) {
          this.larry.destroy();
          this.larry = null;
        }
        if (!this.larry && this.t >= S.heroAfter) this.cards(world, 'hero', () => this.enter('go'));
        break;
      case 'go':
        if (this.goUp(world)) this.finish(world);
        break;
      case 'hero':
      case 'yell':
      case 'done':
        break;
    }
    return this.over;
  }

  /** The scene's own effects (the pieces of the pipe and ceiling, its marks, Larry) move on. */
  private effects(world: World): void {
    for (const e of world.entities) {
      if (!e.alive || e === this.drop || e instanceof Enemy || e instanceof Projectile) continue;
      e.levelHeightPx = world.heightPx;
      e.update(world);
    }
  }

  /**
   * Everyone runs to the chain and climbs it: true once the hero is off the top of the screen.
   */
  private goUp(world: World): boolean {
    for (const p of world.players) {
      if (p.dead || p.out) continue;
      const b = p.body;
      const dx = this.chainX - toPx(p.centerX);
      if (p.anim !== 'climb' && Math.abs(dx) > S.run) {
        b.x += px(Math.sign(dx) * S.run);
        p.facing = dx < 0 ? -1 : 1;
        p.anim = b.onGround ? 'walk' : 'jump';
        if (this.t % 4 === 0) p.walkFrame = (p.walkFrame + 1) % 3;
        continue;
      }
      if (p.anim !== 'climb') {
        b.x = px(this.chainX) - (b.w >> 1);
        p.anim = 'climb';
        world.audio.sfx('vine');
      }
      b.vx = 0;
      b.vy = 0;
      b.y -= px(S.climb);
      if (this.t % 6 === 0) p.walkFrame = (p.walkFrame + 1) % 3;
    }
    return toPx(this.hero.body.y + this.hero.body.h) < 0;
  }

  /** The players fall to the floor and slide out their knockback; nobody leaves the room's floor. */
  private physics(world: World): void {
    for (const p of world.players) {
      if (p.dead || p.out || p.anim === 'climb') continue;
      const b = p.body;
      if (b.onGround && b.vy >= 0 && this.phase !== 'fall') {
        b.vx = 0;
        if (p.anim === 'jump') p.anim = 'idle';
      }
      moveX(b, world.map, velToSub(b.vx));
      if (b.hitWall !== 0) b.vx = 0;
      b.vy = Math.min(MAX_FALL, b.vy + GRAVITY);
      const dy = velToSub(b.vy);
      moveY(b, world.map, b.vy >= 0 ? Math.max(dy, 1) : dy);
      if (b.onGround) {
        b.vy = 0;
        if (b.vx === 0 && p.anim === 'jump') p.anim = 'idle';
      } else p.anim = 'jump';
      if (b.x < world.camera.x) b.x = world.camera.x;
    }
  }

  private allLanded(world: World): boolean {
    return world.players.every((p) => p.dead || p.out || p.body.onGround);
  }

  private facingChain(p: Player): -1 | 1 {
    return toPx(p.centerX) < this.chainX ? 1 : -1;
  }

  /** The hero (every player) turns to the anchor's column and looks up: a `!` over the head. */
  private lookUp(world: World): void {
    for (const p of world.players) {
      if (p.dead || p.out) continue;
      p.facing = this.facingChain(p);
      this.mark(world, p.centerX, p.body.y - px(3), S.rumble - S.lookAt + 8);
    }
    world.audio.sfx('flinch');
  }

  private mark(world: World, cx: number, y: number, frames: number): void {
    const m = new Exclaim(cx, y, frames);
    this.marks.push(m);
    world.spawn(m);
  }

  /** The crash's shockwave: every player is thrown up and away from the anchor, unhurt. */
  private knockBack(world: World): void {
    world.shake(16, 1);
    this.story.say(ANCHOR_SCENE_SAID.crash);
    for (const p of world.players) {
      if (p.dead || p.out) continue;
      const dx = toPx(p.centerX) - this.chainX;
      const away: -1 | 1 = dx < 0 ? -1 : 1;
      const b = p.body;
      b.vx = away * (Math.abs(dx) < NEAR ? KNOCK_NEAR_VX : KNOCK_VX);
      b.vy = -KNOCK_VY;
      b.onGround = false;
      p.facing = away > 0 ? -1 : 1;
      p.anim = 'jump';
    }
  }

  private cards(world: World, kind: 'larry' | 'hero', next: () => void): void {
    this.enter(kind === 'larry' ? 'yell' : 'hero');
    this.waiting = true;
    this.story.cards(
      kind,
      this.hero,
      () => {
        this.waiting = false;
        next();
      },
      () => {
        this.waiting = false;
        this.skip(world);
      },
    );
  }

  /** Skipped: the anchor at rest, the pipe smashed, Larry and the marks gone; up the chain. */
  skip(world: World): void {
    if (this.over) return;
    this.drop.restNow(world);
    this.finish(world);
  }

  private finish(world: World): void {
    this.enter('done');
    this.larry?.destroy();
    this.larry = null;
    for (const m of this.marks) m.destroy();
    this.over = true;
    world.boardChain(this.drop);
  }
}

/** A `!` popping up over someone's head for a while (white, outlined). */
export class Exclaim extends Entity {
  readonly kind = 'exclaim';
  private age = 0;

  constructor(
    cx: number,
    bottom: number,
    private readonly frames: number,
  ) {
    super(cx - px(3), bottom - px(14), 6, 14);
    this.layer = 'front';
    this.despawnMargin = null;
  }

  update(): void {
    if (++this.age >= this.frames) this.destroy();
  }

  /** A bold `!` (white, outlined in black), 6 wide and 14 tall, popping up a few pixels. */
  render(r: Renderer, view: View): void {
    const x = toPx(this.body.x) - view.camX;
    const y = toPx(this.body.y) - (this.age < 4 ? 4 - this.age : 0);
    // The stem, tapering at its foot, then the dot.
    r.rect(x, y, 6, 10, '#000');
    r.rect(x + 1, y + 1, 4, 6, '#fcfcfc');
    r.rect(x + 2, y + 7, 2, 2, '#fcfcfc');
    r.rect(x, y + 10, 6, 4, '#000');
    r.rect(x + 1, y + 11, 4, 2, '#fcfcfc');
  }
}

export type LarryChainPose = 'climb' | 'panic' | 'flee';

/**
 * Larry on the anchor chain (the smb3 sheet's `larry-climb-0/1`, gripping it at their left edge;
 * `larry-hurt` for the panic), climbing down from above the screen and back up.
 */
export class LarryOnChain extends Entity {
  readonly kind = 'larry-chain';
  pose: LarryChainPose = 'climb';
  private step = 0;
  private shiver = 0;

  constructor(chainX: number) {
    // Feet start above the top of the screen; his hands (x 1-3 of the frame) on the chain.
    super(px(chainX - 2), px(-32), 16, 24);
    this.layer = 'front';
    this.despawnMargin = null;
    this.facing = -1;
  }

  /**
   * Climbs by `dy` px a frame (negative: down) until his feet reach screen y `to` (px); true once
   * there.
   */
  climb(_world: World, dy: number, to: number): boolean {
    const b = this.body;
    const feet = toPx(b.y + b.h);
    const down = dy < 0;
    const next = down ? Math.min(to, feet - dy) : Math.max(to, feet - dy);
    b.y = px(next) - b.h;
    this.step += Math.abs(dy);
    return next === to;
  }

  /** He sees the hero: turns to face him, throws his arms up. */
  panic(hero: Player): void {
    this.pose = 'panic';
    this.facing = toPx(hero.centerX) < toPx(this.body.x) + 2 ? -1 : 1;
  }

  /** And scurries back up the chain. */
  flee(): void {
    this.pose = 'climb';
    this.facing = -1;
  }

  update(): void {
    this.shiver++;
  }

  render(r: Renderer, view: View): void {
    const sheet = view.assets.sheet('smb3');
    const frame = this.pose === 'panic' ? 'larry-hurt' : `larry-climb-${Math.floor(this.step / 6) & 1}`;
    // A panicked shiver (a pixel side to side; it is no flash, so reduce flashing keeps it).
    const jitter = this.pose === 'panic' ? (this.shiver >> 1) & 1 : 0;
    const x = toPx(this.body.x) - view.camX + jitter;
    r.sprite(sheet, frame, x, toPx(this.body.y), this.facing > 0);
  }
}
