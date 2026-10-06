import type { InputFrame } from '@engine/input/input-manager';
import { worldLabel } from '../hud/world-label';
import { SCORE_MAX } from '../hud/hud';
import { NO_INPUT } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import { overlaps } from '@engine/math/aabb';
import { px, tileAt, tileToSub, toPx, velToSub } from '@engine/math/units';
import { Rng } from '@engine/rng';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import type { EntitySpawn, LevelData, PipeDir, TransferMode, Zone } from '../level/schema';
import { isWaterTheme } from '../level/schema';
import { tileDef, T } from '../level/tiles';
import { Camera } from './camera';
import { renderTiles, SKY } from './tile-render';
import { TileMap } from './tilemap';
import { Player } from '../entities/player';
import type { Entity } from '../entities/entity';
import { type View } from '../entities/entity';
import { Enemy } from '../entities/enemies/enemy';
import { Goomba } from '../entities/enemies/goomba';
import { Koopa } from '../entities/enemies/koopa';
import { Piranha } from '../entities/enemies/piranha';
import { Cheep } from '../entities/enemies/cheep';
import { Blooper } from '../entities/enemies/blooper';
import { Podoboo } from '../entities/enemies/podoboo';
import { HammerBro } from '../entities/enemies/hammer-bro';
import { LakituZone } from '../entities/enemies/lakitu';
import { Spiny } from '../entities/enemies/spiny';
import { BulletBill, BulletLauncher, BULLET_SPEED } from '../entities/enemies/bullet-bill';
import { BalanceLift } from '../entities/objects/balance-lift';
import { Princess } from '../entities/objects/princess';
import { Toad } from '../entities/objects/toad';
import { Spring } from '../entities/objects/spring';
import { Vine } from '../entities/objects/vine';
import { PowerUp } from '../entities/objects/powerup';
import { Pickup } from '../entities/objects/pickup';
import { FlagScore, Flagpole } from '../entities/objects/flagpole';
import { Projectile } from '../entities/projectiles/projectile';
import { BlockBump, BrickPiece, CoinPop, Explosion, ScorePopup } from '../entities/effects/effects';
import type { DamageKind, DamageSource, Reaction } from '../rules/damage';
import { shellKickSeqScore, stompScore } from '../rules/score';
import type { GameContext, GameState } from '../context';
import { HURRY_TIME, SPAWN_MARGIN_PX, TIMER_FRAMES } from '../constants';
import { Decoration } from '../entities/objects/decoration';
import { Lift } from '../entities/objects/lift';
import { Firebar } from '../entities/enemies/firebar';
import { Bowser, type BowserAttack } from '../entities/enemies/bowser';
import { BowserFire } from './bowser-fire';
import { Axe } from '../entities/objects/axe';
import { startHp, type CharacterDef } from '../characters/character';

export type WorldEvent =
  | { type: 'pipe'; target: { level: string; x: number; y: number; exitDir?: TransferMode } }
  | { type: 'exit'; next: string }
  /** `player`: index of the player whose death ended the attempt (they pick the next hero). */
  | { type: 'died'; player?: number }
  | { type: 'checkpoint'; x: number }
  /** The castle maze moved the players from column `from` to `to` (informational). */
  | { type: 'loop'; from: number; to: number };

export interface WorldStart {
  /** Override the level's start tile. */
  x?: number;
  y?: number;
  mode?: LevelData['startMode'];
  /** Timer to continue with (transfers within one stage). */
  time?: number;
}

/** The clock a level starts with: a carried timer, else the level's, else the stage's (or 400). */
export function startTime(level: LevelData, state: GameState, start: WorldStart = {}): number {
  return start.time ?? (level.time === null ? (state.time ?? 400) : level.time);
}

type ClearPhase = 'slide' | 'hop' | 'walk' | 'countdown' | 'flag' | 'done';
type PipeAnim = {
  player: Player;
  dir: PipeDir;
  t: number;
  frames: number;
  target: WorldEvent & { type: 'pipe' };
};

/** Synthetic input for auto-walk intros: hold right; the pipe check triggers on touch. */
const AUTO_WALK_INPUT: InputFrame = {
  held: (a) => a === 'right',
  pressed: () => false,
  released: () => false,
  bufferedJump: () => false,
  consumeJumpBuffer: () => undefined,
  dirX: 1,
};

const COOP_RESPAWN_FRAMES = 120;

/**
 * One loaded level: tiles, camera, players, entities and the rules that tie them together.
 * Supports one or two players; with two, deaths respawn from a shared life pool.
 */
export class World {
  readonly map: TileMap;
  readonly camera: Camera;
  readonly players: Player[] = [];
  readonly rng: Rng;
  readonly entities: Entity[] = [];
  readonly events: WorldEvent[] = [];
  readonly audio: GameContext['audio'];
  readonly assist: GameContext['assist'];
  frame = 0;
  /** Timer in SMB1 units; null = no timer. */
  time: number | null;
  private timerTick = 0;
  hurryPlayed = false;
  private spawnIndex = 0;
  private readonly spawns: EntitySpawn[];
  /** Subpixel y of the water line in water levels; Infinity elsewhere. */
  waterTop = Infinity;
  /** Set once a vine or pit transfer has been queued, so the frame ends quietly. */
  private leaving = false;
  private cheepTimer = 0;
  /** Frames since the lead player last moved right (flying Cheep Cheeps' reverse rule). */
  private cheepNoRight = 0;
  private bulletTimer = 60;
  /** Bowser's long-range flames (`bowser-fire` zone), or null. */
  private readonly bowserFire: BowserFire | null;
  /** Castle maze: lead player's centre x last frame (px) and the loop checkpoints passed. */
  private loopPrevX: number | null = null;
  private readonly loopChecks = new Set<string>();
  private readonly coinBlocks = new Map<string, { left: number; until: number }>();
  private clear: { phase: ClearPhase; t: number; pole: Flagpole; walkTo: number; player: Player } | null =
    null;
  private pipeAnim: PipeAnim | null = null;
  private pipeExit: { t: number; frames: number } | null = null;
  private readonly deathTimers = new Map<Player, number>();
  private readonly respawnTimers = new Map<Player, number>();
  private checkpointSent = false;
  /** Set when Bowser's bridge is cut; freezes everything but the axe sequence. */
  bossClear: { t: number; stop?: number } | null = null;
  /** The castle-clear message shown over the level (Toad's thanks), one entry per text row. */
  castleText: string[] = [];
  /** Level intro that walks the player into a pipe (1-2 style) ignoring input. */
  autoWalk = false;
  readonly flagpole: Flagpole | null = null;

  constructor(
    readonly level: LevelData,
    readonly ctx: GameContext,
    readonly state: GameState,
    start: WorldStart = {},
  ) {
    this.audio = ctx.audio;
    this.assist = ctx.assist;
    this.map = new TileMap(level);
    const stop = level.zones.find((z): z is Zone & { kind: 'scrollStop' } => z.kind === 'scrollStop');
    this.camera = new Camera(level.width, stop ? stop.x : null, level.camera === 'locked');
    this.camera.allowLeftScroll = ctx.assist.allowLeftScroll;
    this.rng = new Rng(level.id.length * 7919 + 1);
    // A transfer within the same stage (bonus room, detour, sky) keeps the running clock.
    this.time = startTime(level, state, start);
    // Swimming Cheep Cheeps get their random start tile now, like the original's calcPosition at
    // level load, so the shifted fish still spawns off screen.
    this.spawns = level.entities.map((e) => Cheep.placeSwimmer(e, this.rng)).sort((a, b) => a.x - b.x);
    this.bowserFire = BowserFire.forLevel(level);

    const sx = start.x ?? level.start.x;
    const sy = start.y ?? level.start.y;
    const mode = start.mode ?? level.startMode;
    const defs: [CharacterDef, string, number][] = [[state.character, state.powerState, state.hp]];
    if (state.character2) defs.push([state.character2, state.powerState2, state.hp2]);
    defs.forEach(([def, power, hp], i) => {
      const tmp = new Player(0, 0, def, power, hp);
      const hb = def.hitbox(tmp);
      const feet = tileToSub(sy + 1);
      const p = new Player(
        tileToSub(sx) + px((16 - hb.w) >> 1) + px(i * 20),
        feet - px(hb.h),
        def,
        power,
        hp,
      );
      p.profile = { ...def.movement, coyoteFrames: ctx.assist.coyoteFrames };
      p.index = i;
      Object.assign(p.scratch, i === 0 ? state.kit : state.kit2);
      if (mode === 'fall') p.body.y = px(-32) - px(i * 24);
      else if (mode === 'climb') {
        // Hanging on the vine entity at the start column, feet on the start tile.
        const spec = level.entities.find((e) => e.type === 'vine' && e.x === sx);
        const len = Number(spec?.props?.len ?? 8);
        const vine = new Vine(sx, spec?.y ?? sy, len);
        p.vine = { x: vine.centerX, top: vine.topPx, bottom: vine.basePx };
        p.body.y = feet - px(hb.h) - px(i * 24);
        p.anim = 'climb';
      } else if (mode === 'pipe-exit') {
        // Start inside the pipe below (centred on the 2-wide pipe) and rise out; P2 arrives a moment later.
        p.body.x += px(8) - px(i * 20);
        p.body.y = feet + px(8);
        p.frozen = true;
        if (i > 0) p.hidden = true;
        this.pipeExit = { t: 0, frames: hb.h + 8 };
      } else if (mode === 'autowalk') this.autoWalk = true;
      this.players.push(p);
    });
    this.camera.snapTo(this.player.body.x);
    // Water levels (any swimming theme): everything from the first row of wave tiles down is swimmable.
    if (isWaterTheme(level.theme)) {
      let row = 0;
      for (let ty = 0; ty < level.height && row === 0; ty++) {
        for (let tx = 0; tx < level.width; tx++) {
          if (this.map.get(tx, ty) === T.WATER) {
            row = ty;
            break;
          }
        }
      }
      this.waterTop = tileToSub(row) + px(8);
    }

    // Static objects from the tile grid.
    for (let tx = 0; tx < level.width; tx++) {
      let ballRow = -1;
      for (let ty = 0; ty < level.height; ty++) {
        const id = this.map.get(tx, ty);
        if (id === T.FLAG_BALL) ballRow = ty;
        if (id === T.FLAG_SHAFT && ballRow >= 0) {
          let base = ty;
          while (this.map.get(tx, base) === T.FLAG_SHAFT) base++;
          const pole = new Flagpole(tx, ballRow, base);
          this.entities.push(pole);
          (this as { flagpole: Flagpole | null }).flagpole = pole;
          break;
        }
      }
      for (let ty = 0; ty < level.height; ty++) {
        if (this.map.get(tx, ty) === T.BLASTER_TOP) this.entities.push(new BulletLauncher(tx, ty));
      }
    }
    for (const d of level.decor) this.entities.push(new Decoration(d.kind, d.x, d.y));
  }

  /** Player 1 (also what enemies and the camera use as the primary target in solo play). */
  get player(): Player {
    return this.players[0] as Player;
  }

  get coop(): boolean {
    return this.players.length > 1;
  }

  /** Players still in the level (not dead, not eliminated). */
  activePlayers(): Player[] {
    return this.players.filter((p) => !p.dead && !p.out);
  }

  /** Closest live player to an x position (enemies use this to aim and hide). */
  nearestPlayer(x: number): Player {
    let best = this.player;
    let bd = Infinity;
    for (const p of this.players) {
      if (p.dead || p.out) continue;
      const d = Math.abs(p.centerX - x);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  /* ---------- Spawning ---------- */

  spawn(e: Entity): void {
    this.entities.push(e);
  }

  private spawnPending(): void {
    const limit = this.camera.right + px(SPAWN_MARGIN_PX);
    while (this.spawnIndex < this.spawns.length) {
      const s = this.spawns[this.spawnIndex] as EntitySpawn;
      if (tileToSub(s.x) > limit) break;
      this.spawnIndex++;
      const e = this.makeEntity(s);
      if (e) this.entities.push(e);
    }
  }

  private makeEntity(s: EntitySpawn): Entity | null {
    const x = tileToSub(s.x);
    const y = tileToSub(s.y);
    switch (s.type) {
      case 'goomba':
        return new Goomba(x + px(2), y + px(2));
      case 'koopa-green':
        return new Koopa(x + px(2), y - px(6), 'green');
      case 'koopa-red':
        return new Koopa(x + px(2), y - px(6), 'red');
      case 'koopa-para-green':
        return new Koopa(x + px(2), y - px(6), 'green', true);
      case 'koopa-para-red':
        return new Koopa(x + px(2), y - px(6), 'red', true);
      case 'koopa-para-green-h':
        return new Koopa(x + px(2), y - px(6), 'green', true, true);
      case 'piranha':
        return new Piranha(s.x, s.y, false, !!s.props?.red);
      case 'piranha-down':
        return new Piranha(s.x, s.y, true, !!s.props?.red);
      case 'cheep-red':
      case 'cheep-grey':
        // The map's colour is ignored, as in the original (Level.as lines 953-958); the start tile
        // was already moved by Cheep.placeSwimmer.
        return Cheep.swimmer(x, y, this.rng);
      case 'blooper':
        return new Blooper(x + px(2), y + px(2));
      case 'podoboo':
        return new Podoboo(s.x, s.y, s.x * 31 + s.y * 7);
      case 'hammer-bro':
      case 'hammer-bro-chase':
        return new HammerBro(x + px(2), y - px(6), s.type === 'hammer-bro-chase');
      case 'buzzy':
        return new Koopa(x + px(2), y + px(2), 'buzzy');
      case 'spiny':
        return new Spiny(x + px(2), y + px(2), false);
      case 'bullet-bill':
        return new BulletBill(x + px(1), y + px(2), -1);
      case 'lakitu':
        return new LakituZone(s.x, s.y, Number(s.props?.end ?? this.level.width), Boolean(s.props?.mid));
      case 'balance':
        return new BalanceLift(s.x, s.y, s.props ?? {});
      case 'princess':
        return new Princess(s.x, s.y);
      case 'toad':
        return new Toad(s.x, s.y);
      case 'spring':
      case 'spring-green':
        return new Spring(s.x, s.y, s.type === 'spring-green');
      case 'vine':
        return new Vine(s.x, s.y, Number(s.props?.len ?? 8));
      case 'firebar':
      case 'firebar-ccw':
        return new Firebar(s.x, s.y, s.type === 'firebar-ccw' ? -1 : 1, Number(s.props?.len ?? 6));
      case 'bowser':
        return new Bowser(
          s.x,
          s.y,
          String(s.props?.attack ?? 'fire') as BowserAttack,
          Boolean(s.props?.fake),
        );
      case 'axe':
        return new Axe(s.x, s.y);
      case 'lift-h':
      case 'lift-v':
      case 'lift-fall':
      case 'lift-up':
      case 'lift-down':
      case 'lift-right':
        return new Lift(s.type, s.x, s.y, s.props ?? {});
      case 'decor-castle':
        return new Decoration('castle-small', s.x, s.y);
      case 'decor-castle-big':
        return new Decoration('castle-big', s.x, s.y);
      case 'mushroom':
      case 'flower':
      case 'star':
      case '1up':
        return new PowerUp(s.x, s.y + 1, s.type);
      default:
        console.warn(`unknown entity type "${s.type}"`);
        return null;
    }
  }

  countProjectiles(owner: Entity | Player, kind: string): number {
    let n = 0;
    for (const e of this.entities)
      if (e instanceof Projectile && e.owner === owner && e.kind === kind && e.alive) n++;
    return n;
  }

  get enemies(): Enemy[] {
    return this.entities.filter((e): e is Enemy => e instanceof Enemy && e.alive);
  }

  /** Closest live, on-screen enemy to a point (homing shots). */
  nearestEnemy(x: number, y: number): Enemy | null {
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      if (e.body.x + e.body.w < this.camera.x || e.body.x > this.camera.right) continue;
      const d = Math.abs(e.body.x - x) + Math.abs(e.body.y - y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  /** An enemy just died: the character that killed it may get a drop. */
  enemyKilled(e: Enemy, src: DamageSource): void {
    let killer: Player | null = null;
    const o = src.owner;
    if (o instanceof Player) killer = o;
    else if (o instanceof Projectile && o.owner instanceof Player) killer = o.owner;
    if (!killer) killer = this.nearestPlayer(e.body.x);
    const kind = killer.def.drop?.(this.rng, e);
    if (kind) this.spawn(new Pickup(e.body.x + (e.body.w >> 1), e.body.y + e.body.h, kind));
  }

  /** A bomb blast centred at (cx, cy) in subpixels: hurts everything in the square, opens blocks. */
  explode(
    cx: number,
    cy: number,
    radiusPx: number,
    owner: Player | null,
    opts: { hurtsPlayers?: boolean; amount?: number; small?: boolean } = {},
  ): void {
    const r = px(radiusPx);
    const box = { x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
    this.spawn(new Explosion(cx, cy, opts.small ?? false));
    this.audio.sfx(opts.small ? 'bump' : 'explosion');
    for (const e of this.enemies) {
      if (!overlaps(box, e.body)) continue;
      const res = e.hit(
        { kind: 'bomb', amount: opts.amount ?? 2, owner, dirX: e.body.x < cx ? -1 : 1 },
        this,
      );
      this.scoreKill(e, 'bomb', res);
      if (res === 'hp') this.audio.sfx('hurt-enemy');
    }
    if (opts.hurtsPlayers ?? true) {
      for (const p of this.activePlayers()) {
        if (overlaps(box, p.body)) this.hurtPlayer(p, p.centerX < cx ? -1 : 1);
      }
    }
    const breaker = owner ?? this.nearestPlayer(cx);
    for (let ty = tileAt(box.y); ty <= tileAt(box.y + box.h - 1); ty++)
      for (let tx = tileAt(box.x); tx <= tileAt(box.x + box.w - 1); tx++) {
        const def = tileDef(this.map.get(tx, ty));
        if (def.block && def.block.kind !== 'hidden') this.strikeBlock(tx, ty, breaker, true); // blasts always break
      }
  }

  /** A projectile struck the tile at a point: bricks and item blocks react as to a head bump. */
  breakAt(x: number, y: number, owner: Entity | Player | null): void {
    const tx = tileAt(x);
    const ty = tileAt(y);
    const def = tileDef(this.map.get(tx, ty));
    if (!def.block || def.block.kind === 'hidden') return;
    const p = owner instanceof Player ? owner : this.nearestPlayer(x);
    this.strikeBlock(tx, ty, p, true); // only brick-breaking shots call this
  }

  /* ---------- Scoring ---------- */

  addScore(n: number, x?: number, y?: number): void {
    // Capped like the original's StatManager.addPoints (SCORE_MAX = 9999999).
    this.state.score = Math.min(this.state.score + n, SCORE_MAX);
    if (x !== undefined && y !== undefined) this.spawn(new ScorePopup(x, y, String(n)));
  }

  addCoin(): void {
    this.state.coins++;
    this.audio.sfx('coin');
    if (this.state.coins >= 100) {
      this.state.coins -= 100;
      this.addLife(this.player.body.x, this.player.body.y - px(16));
    }
  }

  addLife(x: number, y: number): void {
    this.state.lives++;
    this.audio.sfx('1up');
    this.spawn(new ScorePopup(x, y, '1UP'));
  }

  /** Score a sequence step (stomps, shell kills): points, or an extra life at the end of it. */
  private seqHit(s: number | '1up', x: number, y: number): void {
    if (s === '1up') this.addLife(x, y);
    else this.addScore(s, x, y);
  }

  /**
   * Score a hit if it killed the enemy, by how it died (Enemy.as: takeDamage scores ATTACK,
   * hitCharacter with a star STAR, gBounceHit BELOW). Hit-point kills count once the last point goes.
   */
  private scoreKill(e: Enemy, kind: DamageKind, r: Reaction): void {
    if (r === 'kill' || r === 'flip' || (r === 'hp' && !e.alive))
      this.addScore(e.scoreFor(kind), e.body.x, e.body.y);
  }

  /**
   * Enemy.stomp(): the player's stomps since landing (numContStomps) pick a STOMP_SEQ value,
   * floored at the enemy's STOMP value. Bullet Bills don't count towards the sequence, and a Goomba
   * or Buzzy Beetle stomped in the same frame as another enemy is a double stomp (at least 400).
   */
  private scoreStomp(p: Player, e: Enemy): void {
    const double =
      p.stompFrame === this.frame && (e instanceof Goomba || (e instanceof Koopa && e.color === 'buzzy'));
    if (!(e instanceof BulletBill)) {
      p.combo++;
      p.stompFrame = this.frame;
    }
    this.seqHit(stompScore(p.combo, e.scores.stomp, double), e.body.x, e.body.y - px(8));
  }

  /** Kick a still shell (KoopaGreen.kickShell), scored by when in the shell's rest it happens. */
  private kickShell(p: Player, e: Koopa): void {
    const dir: -1 | 1 = p.centerX < e.body.x + e.body.w / 2 ? 1 : -1;
    const points = e.kickScore(p.combo > 0);
    e.kick(dir, this);
    this.addScore(points, e.body.x, e.body.y);
  }

  /* ---------- Update ---------- */

  update(inputs: InputFrame[]): void {
    this.frame++;

    // Growth/shrink pauses the world (SMB1 does too).
    let transitioning = false;
    for (const p of this.players) if (p.transition) transitioning = p.tickTransition() || transitioning;
    if (transitioning) return;
    if (this.clear) {
      this.tickScorePopups();
      return this.updateClear();
    }
    if (this.bossClear) {
      this.tickScorePopups();
      return this.updateBossClear();
    }
    if (this.pipeAnim) return this.updatePipeAnim();
    if (this.pipeExit) return this.updatePipeExit();
    if (this.leaving) return;

    for (const p of this.players) if (p.dead) this.updateDeath(p);
    if (this.activePlayers().length === 0) return;

    this.tickTimer();
    this.spawnPending();

    this.players.forEach((p, i) => {
      if (p.dead || p.out) return;
      const respawn = this.respawnTimers.get(p);
      if (respawn !== undefined) {
        // Dropping back in: fall from the top with brief invulnerability.
        if (respawn > 0) {
          this.respawnTimers.set(p, respawn - 1);
          return;
        }
        this.respawnTimers.delete(p);
      }
      let input = inputs[i] ?? NO_INPUT;
      if (this.autoWalk) input = AUTO_WALK_INPUT;
      p.inWater = p.body.y + (p.body.h >> 1) >= this.waterTop;
      this.grabVines(p, input);
      const spring = this.springUnder(p);
      if (spring) {
        spring.ride(input.held('jump'));
        p.anim = 'jump';
        return;
      }
      p.update(input, this.map, this.audio, (tx, ty) => this.hitBlock(tx, ty, p));
      p.def.behaviour.update(p, input, this);
      if (p.body.x < this.camera.x) {
        p.body.x = this.camera.x;
        if (p.body.vx < 0) p.body.vx = 0;
      }
      const rightEdge = Math.min(tileToSub(this.level.width), this.camera.x + px(SCREEN_W));
      if (p.body.x + p.body.w > rightEdge && this.coop && p !== this.rightmost())
        p.body.x = rightEdge - p.body.w;
      if (p.body.x + p.body.w > tileToSub(this.level.width))
        p.body.x = tileToSub(this.level.width) - p.body.w;
    });

    for (const e of this.entities) {
      if (!e.alive) continue;
      if (e instanceof Enemy && e.stunned > 0) {
        e.stunned--;
        continue;
      }
      e.update(this);
    }
    this.resolveLifts();
    for (const p of this.activePlayers()) this.collisions(p);
    this.enemyVsEnemy();
    for (const [i, p] of this.players.entries()) {
      if (p.dead || p.out) continue;
      this.checkPipes(p, this.autoWalk ? AUTO_WALK_INPUT : (inputs[i] ?? NO_INPUT));
      if (this.pipeAnim) break;
    }
    this.checkZones();
    this.checkLoops();
    this.flyingCheeps();
    this.flyingBullets();
    if (this.bowserFire && !this.leaving) {
      const lead = this.rightmost();
      if (lead) this.bowserFire.update(this, lead);
    }

    const lead = this.rightmost();
    if (lead) this.camera.follow(lead.body.x);
    for (const p of this.players) {
      if (p.star === 1) this.audio.playMusic(this.level.music);
      if (toPx(p.body.y) > SCREEN_H + 8 && !p.dead && !p.out && !this.leaving) {
        const pit = this.level.zones.find(
          (z): z is Zone & { kind: 'pit' } => z.kind === 'pit' && p.body.x >= tileToSub(z.x),
        );
        if (pit) this.transfer(pit.target, 'fall');
        else this.kill(p);
      }
    }
    this.cull();
  }

  /** Castle maze teleports (see the `loop` zone). Follows the lead player; everyone moves. */
  private checkLoops(): void {
    const lead = this.rightmost();
    if (!lead) return;
    const b = lead.body;
    const cur = toPx(lead.centerX);
    const prev = this.loopPrevX ?? cur;
    this.loopPrevX = cur;
    if (cur <= prev) return;
    const top = tileAt(b.y);
    const bottom = tileAt(b.y + b.h - 1);
    const inside = (y0: number, y1: number) => bottom >= y0 && top <= y1;
    const crossed = (col: number) => prev < col * 16 && cur >= col * 16;
    this.level.zones.forEach((z, i) => {
      if (z.kind !== 'loop') return;
      z.checks.forEach((c, j) => {
        if (crossed(c.x) && inside(c.y0, c.y1)) this.loopChecks.add(`${i}:${j}`);
      });
    });
    for (const [i, z] of this.level.zones.entries()) {
      if (z.kind !== 'loop') continue;
      if (!crossed(z.x) || !inside(z.y0, z.y1)) continue;
      const passed = z.checks.map((_, j) => this.loopChecks.has(`${i}:${j}`));
      if (z.checks.length && !(z.need === 'any' ? passed.some(Boolean) : passed.every(Boolean))) continue;
      const dx = tileToSub(z.to - z.x);
      for (const p of this.players) p.body.x += dx;
      this.camera.x = Math.max(0, Math.min(this.camera.maxX, this.camera.x + dx));
      this.loopPrevX = cur + toPx(dx);
      this.loopChecks.clear();
      this.events.push({ type: 'loop', from: z.x, to: z.to });
      return;
    }
  }

  /** Leave for a linked area (vine top, pit); the scene swaps levels on the event. */
  private transfer(target: { level: string; x: number; y: number }, mode: 'climb' | 'fall'): void {
    if (this.leaving) return;
    this.leaving = true;
    for (const o of this.players) {
      o.frozen = true;
      o.body.vx = 0;
      o.body.vy = 0;
    }
    this.events.push({ type: 'pipe', target: { ...target, exitDir: mode } });
  }

  /** Touching a vine while airborne (or pressing up beside it) grabs it; off the top is the sky link. */
  private grabVines(p: Player, input: InputFrame): void {
    const b = p.body;
    if (p.vine) {
      if (b.y + b.h <= 0) {
        const z = this.level.zones.find(
          (v): v is Zone & { kind: 'vine' } =>
            v.kind === 'vine' && this.vineBlockAt(v.x, v.y)?.centerX === p.vine?.x,
        );
        if (z) this.transfer(z.target, 'climb');
        else b.y = -b.h; // nowhere to go: hang at the top
      }
      return;
    }
    if (p.vineLock > 0 || p.dead || p.frozen || p.sliding > 0) return;
    for (const e of this.entities) {
      if (!(e instanceof Vine) || !e.alive) continue;
      const v = e.body;
      // Generous sideways reach (the original lets you grab from beside the block it grew from).
      const overlapX = Math.abs(p.centerX - e.centerX) <= px(16);
      const overlapY = b.y + px(8) <= v.y + v.h && b.y + b.h > v.y;
      if (!overlapX || !overlapY) continue;
      if (!b.onGround || input.held('up')) {
        p.vine = { x: e.centerX, top: e.topPx, bottom: e.basePx };
        p.body.vx = 0;
        p.body.vy = 0;
        p.jumping = false;
        p.anim = 'climb';
        return;
      }
    }
  }

  private vineBlockAt(tx: number, ty: number): Vine | undefined {
    return this.entities.find(
      (e): e is Vine => e instanceof Vine && e.alive && e.fromBlock?.tx === tx && e.fromBlock.ty === ty,
    );
  }

  /** The springboard this player is standing on (feet on its plate, coming down onto it). */
  private springUnder(p: Player): Spring | null {
    const b = p.body;
    for (const e of this.entities) {
      if (!(e instanceof Spring) || !e.alive) continue;
      const s = e.body;
      const feet = b.y + b.h;
      const overlapX = b.x < s.x + s.w && b.x + b.w > s.x;
      if (!overlapX) continue;
      if (e.busy) return e;
      if (b.vy > 0 && feet >= s.y && feet <= s.y + px(10) && b.prevBottom <= s.y + px(4)) {
        e.press(p);
        return e;
      }
    }
    return null;
  }

  /**
   * Bridge levels: red Cheep Cheeps leap from below while the lead player is inside a `cheeps`
   * zone (FlyingCheepSpawner.as). With fewer than MAX_CHEEP_NORMAL = 3 out and no spawn pending it
   * waits a random 600-1050 ms (36-63 frames) and then launches one if still in the zone and below
   * the limit. Fish may only fly left once the lead has not moved right for 2 s
   * (CAN_REVERSE_DIRECTION_DELAY = 2000).
   */
  private flyingCheeps(): void {
    const lead = this.rightmost();
    if (!lead || this.leaving) return;
    if (lead.body.vx > 0) this.cheepNoRight = 0;
    else this.cheepNoRight++;
    const inZone = this.level.zones.some(
      (z) => z.kind === 'cheeps' && lead.body.x >= tileToSub(z.x) && lead.body.x < tileToSub(z.x + z.w),
    );
    let flying = 0;
    for (const e of this.entities) if (e instanceof Cheep && e.alive && e.flying) flying++;
    if (this.cheepTimer > 0 && --this.cheepTimer === 0 && inZone && flying < 3) {
      const marioType = lead.def.id === 'mario' || lead.def.id === 'luigi';
      const target = {
        centerX: lead.centerX,
        vx: lead.body.vx,
        marioWalk: marioType ? lead.profile.maxWalk : null,
      };
      this.spawn(Cheep.leaper(this.rng, this.camera.x, SCREEN_H, target, this.cheepNoRight >= 120));
      flying++;
    }
    if (inZone && flying < 3 && this.cheepTimer === 0) this.cheepTimer = 36 + this.rng.int(28);
  }

  /** 5-3 style: Bullet Bills fly in from the screen edges while the lead is in a `bullets` zone. */
  private flyingBullets(): void {
    const lead = this.rightmost();
    if (!lead || this.leaving) return;
    const inZone = this.level.zones.some(
      (z) => z.kind === 'bullets' && lead.body.x >= tileToSub(z.x) && lead.body.x < tileToSub(z.x + z.w),
    );
    if (!inZone) return;
    if (--this.bulletTimer > 0) return;
    this.bulletTimer = 90 + this.rng.int(90);
    let flying = 0;
    for (const e of this.entities) if (e instanceof BulletBill && e.alive) flying++;
    if (flying >= 2) return;
    const fromLeft = this.rng.int(4) === 0;
    const y = px((3 + this.rng.int(9)) * 16 + 2);
    const x = fromLeft ? this.camera.x - px(14) : this.camera.right;
    const bill = new BulletBill(x, y, fromLeft ? 1 : -1);
    bill.body.vx = (fromLeft ? 1 : -1) * BULLET_SPEED;
    this.spawn(bill);
  }

  private rightmost(): Player | null {
    let best: Player | null = null;
    for (const p of this.activePlayers()) if (!best || p.body.x > best.body.x) best = p;
    return best;
  }

  private tickTimer(): void {
    if (this.time === null || this.assist.infiniteTime) return;
    if (++this.timerTick >= TIMER_FRAMES) {
      this.timerTick = 0;
      this.time--;
      if (this.time === HURRY_TIME && !this.hurryPlayed) {
        this.hurryPlayed = true;
        this.audio.playJingle('hurry', () => {
          this.audio.setTempoScale(1.4);
          this.audio.playMusic(this.level.music);
        });
      }
      if (this.time <= 0) {
        this.time = 0;
        for (const p of this.activePlayers()) this.kill(p);
      }
    }
  }

  private cull(): void {
    const left = this.camera.x;
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i] as Entity;
      if (!e.alive) {
        this.entities.splice(i, 1);
        continue;
      }
      if (e.despawnMargin !== null && e.body.x + e.body.w < left - px(e.despawnMargin))
        this.entities.splice(i, 1);
    }
  }

  /* ---------- Blocks & tiles ---------- */

  private hitBlock(tx: number, ty: number, p: Player): void {
    this.strikeBlock(tx, ty, p, p.def.canBreakBricks(p));
  }

  /** Hit a block from below on a player's behalf; `breakBricks` decides whether plain bricks shatter. */
  strikeBlock(tx: number, ty: number, p: Player, breakBricks: boolean): void {
    const id = this.map.get(tx, ty);
    const def = tileDef(id);
    if (!def.block) {
      this.audio.sfx('bump');
      return;
    }
    const top = tileToSub(ty);
    for (const e of this.entities) {
      if (!e.alive || !(e instanceof Enemy || e instanceof PowerUp)) continue;
      const b = e.body;
      if (Math.abs(b.y + b.h - top) <= px(2) && b.x < tileToSub(tx + 1) && b.x + b.w > tileToSub(tx)) {
        if (e instanceof Enemy) {
          const dirX = b.x > p.body.x ? 1 : -1;
          const r = e.hit({ kind: 'bump', amount: 1, owner: null, dirX, fromX: tileToSub(tx) + px(8) }, this);
          // A bounce (KoopaGreen/Spiney.gBounceHit) skips Enemy.gBounceHit's BELOW score.
          if (r !== 'immune' && r !== 'bounce') this.addScore(e.scoreFor('bump'), b.x, b.y);
        } else b.vy = -0x03000;
      }
    }
    const { kind, content } = def.block;
    const frame = kind === 'brick' ? 'brick' : 'used';
    if (kind === 'brick' && content === 'none') {
      if (breakBricks) {
        this.map.set(tx, ty, T.AIR);
        const cx = tileToSub(tx) + px(4);
        const cy = tileToSub(ty) + px(4);
        this.spawn(new BrickPiece(cx, cy, -0x01000, -0x05000));
        this.spawn(new BrickPiece(cx + px(8), cy, 0x01000, -0x05000));
        this.spawn(new BrickPiece(cx, cy + px(8), -0x01000, -0x03000));
        this.spawn(new BrickPiece(cx + px(8), cy + px(8), 0x01000, -0x03000));
        this.addScore(50);
        this.audio.sfx('break');
      } else {
        this.bump(tx, ty, 'brick', id);
        this.audio.sfx('bump');
      }
      return;
    }
    let restore = T.USED;
    switch (content) {
      case 'coin':
        this.spawn(new CoinPop(tileToSub(tx) + px(4), tileToSub(ty - 1)));
        this.addCoin();
        break;
      case 'coins10': {
        const key = `${tx},${ty}`;
        let c = this.coinBlocks.get(key);
        if (!c) {
          // The original's ground/Brick.as: COIN_BRICK_MAX_COINS = 15 and a coinBrickTmrDur =
          // 6000 ms timer started on the first hit (360 frames); after it runs out, the next hit
          // gives one last coin and the brick is used.
          c = { left: 15, until: this.frame + 360 };
          this.coinBlocks.set(key, c);
        }
        c.left--;
        this.spawn(new CoinPop(tileToSub(tx) + px(4), tileToSub(ty - 1)));
        this.addCoin();
        if (c.left > 0 && this.frame < c.until) restore = id;
        break;
      }
      case 'powerup':
        this.spawn(new PowerUp(tx, ty, p.def.blockPowerUp(p)));
        this.audio.sfx('powerup-appear');
        break;
      case '1up':
        this.spawn(new PowerUp(tx, ty, '1up'));
        this.audio.sfx('powerup-appear');
        break;
      case 'star':
        this.spawn(new PowerUp(tx, ty, 'star'));
        this.audio.sfx('powerup-appear');
        break;
      case 'poison':
        this.spawn(new PowerUp(tx, ty, 'poison'));
        this.audio.sfx('powerup-appear');
        break;
      case 'vine':
        this.spawn(new Vine(tx, ty, 0, { tx, ty }));
        this.audio.sfx('vine');
        break;
      case 'none':
        break;
    }
    this.bump(tx, ty, frame, restore);
  }

  private bump(tx: number, ty: number, frame: string, restore: number): void {
    this.map.set(tx, ty, T.BUMPING);
    this.spawn(new BlockBump(tx, ty, frame, restore, () => undefined));
  }

  /* ---------- Collisions ---------- */

  private collisions(p: Player): void {
    const pb = p.body;
    // Coins and hazards in the tile grid.
    const l = tileAt(pb.x);
    const r = tileAt(pb.x + pb.w - 1);
    const t = tileAt(pb.y);
    const b = tileAt(pb.y + pb.h - 1);
    for (let ty = t; ty <= b; ty++) {
      for (let tx = l; tx <= r; tx++) {
        const def = tileDef(this.map.get(tx, ty));
        if (def.pickup === 'coin') {
          this.map.set(tx, ty, T.AIR);
          this.addCoin();
          this.addScore(200);
        } else if (def.hazard && !this.assist.invulnerable) this.kill(p);
      }
    }

    // Melee hitbox vs enemies (before contact so a sword hit beats a body hit).
    if (p.activeMelee) {
      for (const e of this.enemies) {
        if (this.thrustIgnoresShell(p, e)) continue;
        if (overlaps(p.activeMelee, e.body) && !p.scratch[`hit${e.id}`]) {
          p.scratch[`hit${e.id}`] = 1;
          const src: DamageSource = { kind: 'sword', amount: 1, owner: null, dirX: p.facing };
          const res = e.hit(src, this);
          this.scoreKill(e, src.kind, res);
          if (res === 'hp') this.audio.sfx('hurt-enemy');
          if (res !== 'immune') p.def.behaviour.onMeleeHit?.(p, e, this);
        }
      }
    } else {
      for (const k of Object.keys(p.scratch)) if (k.startsWith('hit')) delete p.scratch[k];
    }

    for (const e of this.entities) {
      if (!e.alive) continue;
      if (e instanceof Enemy) this.playerVsEnemy(p, e);
      else if (e instanceof PowerUp) {
        if (overlaps(pb, e.body)) {
          e.destroy();
          // A poison mushroom hurts every hero alike (star power shrugs it off); it never reaches
          // the character's onPowerUp.
          if (e.item === 'poison') {
            if (p.star <= 0) this.hurtPlayer(p, e.body.x + e.body.w / 2 < p.centerX ? 1 : -1);
          } else p.def.behaviour.onPowerUp(p, e.item, this);
        }
      } else if (e instanceof Pickup) {
        if (overlaps(pb, e.body) && p.def.behaviour.onPickup?.(p, e.item, this)) e.destroy();
      } else if (e instanceof Projectile) this.projectile(p, e);
      else if (e instanceof Flagpole && !this.clear && overlaps(pb, e.body)) this.startClear(e, p);
      else if (e instanceof Axe && overlaps(pb, e.body)) this.startBossClear(e, p);
      if (p.dead || this.clear || this.bossClear) return;
    }
  }

  private enemyVsEnemy(): void {
    const enemies = this.enemies;
    for (let i = 0; i < enemies.length; i++) {
      const a = enemies[i] as Enemy;
      for (let j = i + 1; j < enemies.length; j++) {
        const c = enemies[j] as Enemy;
        if (!a.alive || !c.alive || !overlaps(a.body, c.body)) continue;
        const aShell = a instanceof Koopa && a.isMovingShell;
        const cShell = c instanceof Koopa && c.isMovingShell;
        if (aShell || cShell) {
          if (aShell && cShell) {
            a.hit({ kind: 'shell', amount: 1, owner: c, dirX: 1 }, this);
            c.hit({ kind: 'shell', amount: 1, owner: a, dirX: -1 }, this);
            continue;
          }
          const shell = (aShell ? a : c) as Koopa;
          const victim = aShell ? c : a;
          const res = victim.hit(shell.shellDamage(), this);
          if (res === 'kill' || res === 'flip' || res === 'shell')
            this.seqHit(shellKickSeqScore(++shell.shellCombo), victim.body.x, victim.body.y);
        } else if (a.body.onGround && c.body.onGround && !(a instanceof Piranha) && !(c instanceof Piranha)) {
          a.bounceOff(c);
          c.bounceOff(a);
        }
      }
    }
  }

  /**
   * Link's down/up-thrust does nothing to a still shell or one in its post-kick no-hit window:
   * Link.hitEnemy checks that (KoopaGreen cState "shell" or NO_HIT_SHELL_TMR running) before its
   * dThrust/uThrust landAttack. Body contact then applies as usual (a still shell is kicked).
   */
  private thrustIgnoresShell(p: Player, e: Enemy): boolean {
    return (
      !!(p.scratch.downThrust || p.scratch.upThrust) &&
      e instanceof Koopa &&
      (e.isStillShell || e.noHitTimer > 0)
    );
  }

  private playerVsEnemy(p: Player, e: Enemy): void {
    const pb = p.body;
    if (!overlaps(pb, e.body)) return;
    // A sword/thrust that is touching this enemy handles it; no body contact damage.
    if (p.activeMelee && overlaps(p.activeMelee, e.body) && !this.thrustIgnoresShell(p, e)) return;
    if (p.star > 0) {
      const r = e.hit({ kind: 'star', amount: 1, owner: null, dirX: pb.x < e.body.x ? 1 : -1 }, this);
      if (r !== 'immune') this.addScore(e.scoreFor('star'), e.body.x, e.body.y);
      return;
    }
    // Just after any kick the shell neither hurts nor can be stomped by any player
    // (KoopaGreen.NO_HIT_SHELL_TMR: Character.hitEnemy skips it, KoopaGreen.stomp returns early).
    if (e instanceof Koopa && e.noHitTimer > 0) return;
    // SMB1-style stomp test: the player was moving down this frame and came in near the enemy's top.
    const feet = pb.y + pb.h;
    const falling = p.fallSpeed > 0;
    const eh = e.body.h;
    const fromAbove = falling && feet - e.body.y <= eh * 0.8 && pb.prevBottom <= e.body.y + eh * 0.6;
    if (fromAbove && e.stompable) {
      if (p.def.stomps) {
        // Landing on a still shell kicks it; it is not a stomp, so it neither scores nor advances
        // the stomp sequence (KoopaGreen.stomp returns early for a shell, hitCharacter kicks it).
        // Nor does it bounce: Character.hitEnemy does nothing for a shell, leaving the player's
        // vertical speed alone, and the kick's no-hit window lets the player fall on through it.
        if (e instanceof Koopa && e.isStillShell) return this.kickShell(p, e);
        const r = e.hit({ kind: 'stomp', amount: 1, owner: null, dirX: p.facing }, this);
        if (r === 'hurtAttacker') return this.hurtPlayer(p);
        if (r !== 'immune') {
          this.scoreStomp(p, e);
          p.stompBounce();
        }
        return;
      }
    }
    if (e.stunned > 0) return;
    if (e instanceof Koopa && e.isStillShell) return this.kickShell(p, e);
    if (!e.contactHurts) return;
    const custom = p.def.behaviour.contactDamage(p, e, this);
    if (custom) {
      const r = e.hit(custom, this);
      this.scoreKill(e, custom.kind, r);
      return;
    }
    this.hurtPlayer(p, e.body.x + e.body.w / 2 < p.centerX ? 1 : -1);
  }

  private projectile(p: Player, pr: Projectile): void {
    if (pr.spec.hitsPlayer) {
      // Shields and guard projectiles owned by this player swat it away first.
      for (const q of this.entities) {
        if (
          q instanceof Projectile &&
          q.alive &&
          q.spec.blocks &&
          q.owner === p &&
          overlaps(q.body, pr.body)
        ) {
          pr.destroy();
          this.audio.sfx('bump');
          return;
        }
      }
      if (!overlaps(pr.body, p.body)) return;
      if (p.def.behaviour.blocks?.(p, pr)) {
        pr.destroy();
        this.audio.sfx('bump');
        return;
      }
      this.hurtPlayer(p, pr.body.vx > 0 ? 1 : -1);
      if (!pr.spec.pierce) pr.destroy();
      return;
    }
    if (!pr.spec.hitsEnemies || pr.owner !== p) return;
    for (const e of this.enemies) {
      if (pr.hitIds.has(e.id) || !overlaps(pr.body, e.body)) continue;
      const src: DamageSource = {
        kind: pr.spec.damage,
        amount: pr.spec.amount,
        owner: pr,
        dirX: pr.body.vx > 0 ? 1 : -1,
      };
      const r = e.hit(src, this);
      if (r === 'immune') {
        if (pr.spec.hitsTiles && !pr.spec.pierce) pr.burst(this);
        return;
      }
      pr.hitIds.add(e.id);
      this.scoreKill(e, src.kind, r);
      if (r === 'hp') this.audio.sfx('hurt-enemy');
      else if (r === 'stun') this.audio.sfx('hurt-enemy');
      if (!pr.spec.pierce) {
        pr.burst(this);
        return;
      }
    }
  }

  hurtPlayer(p: Player, fromDir: -1 | 1 = 1): void {
    if (p.invulnerable || this.assist.invulnerable) return;
    const result = p.def.behaviour.onHurt(p, this);
    if (result === 'dead') this.kill(p);
    else if (result === 'hurt' && p.def.damage.kind === 'hp' && p.def.damage.knockback) {
      p.body.vx = fromDir * p.def.damage.knockback.vx;
      p.body.vy = -p.def.damage.knockback.vy;
      p.body.onGround = false;
      p.stun = 16;
      p.sliding = 0;
      p.activeMelee = null;
    }
  }

  /* ---------- Lifts ---------- */

  private resolveLifts(): void {
    for (const e of this.entities) {
      if (!(e instanceof Lift) || !e.alive) continue;
      for (const p of this.activePlayers()) e.carry(p.body, this);
    }
  }

  /* ---------- Death ---------- */

  kill(p: Player): void {
    if (p.dead || p.out) return;
    p.dead = true;
    p.frozen = true;
    p.star = 0;
    p.activeMelee = null;
    this.deathTimers.set(p, 0);
    if (this.activePlayers().length === 0) {
      this.audio.setTempoScale(1);
      this.audio.playJingle('death');
    } else this.audio.sfx('hit');
  }

  private updateDeath(p: Player): void {
    const t = (this.deathTimers.get(p) ?? 0) + 1;
    this.deathTimers.set(p, t);
    if (t === 30) p.body.vy = -0x04000;
    if (t > 30) {
      p.body.vy += 0x00280;
      p.body.y += velToSub(p.body.vy);
    }
    if (t === 200) {
      if (!this.coop) {
        this.events.push({ type: 'died', player: 0 });
        return;
      }
      const others = this.activePlayers();
      if (others.length && (this.state.lives > 0 || this.assist.infiniteLives)) {
        if (!this.assist.infiniteLives) this.state.lives--;
        this.respawn(p, others[0] as Player);
      } else {
        p.out = true;
        p.hidden = true;
        if (!others.length) this.events.push({ type: 'died', player: this.players.indexOf(p) });
      }
    }
  }

  /** Co-op: drop a dead player back in beside a living one. */
  private respawn(p: Player, beside: Player): void {
    p.dead = false;
    p.frozen = false;
    p.hidden = false;
    p.invuln = 150;
    p.stun = 0;
    p.sliding = 0;
    p.crouching = false;
    p.powerState = p.def.damage.kind === 'powerup' ? 'small' : 'full';
    p.hp = p.def.damage.kind === 'hp' ? (p.scratch.maxHp ?? startHp(p.def)) : 0;
    p.refitHitbox();
    p.body.x = Math.max(this.camera.x + px(8), beside.body.x - px(16));
    p.body.y = px(-32);
    p.body.vx = 0;
    p.body.vy = 0;
    this.deathTimers.delete(p);
    this.respawnTimers.set(p, COOP_RESPAWN_FRAMES);
  }

  /* ---------- Pipes & zones ---------- */

  private checkPipes(p: Player, input: InputFrame): void {
    const b = p.body;
    if (!b.onGround) return;
    for (const z of this.level.zones) {
      if (z.kind !== 'pipe') continue;
      if (z.dir === 'down') {
        if (this.autoWalk) {
          if (b.x + b.w >= tileToSub(z.x) - px(1)) return this.enterPipe(p, z, 'down');
          continue;
        }
        if (!input.held('down')) continue;
        const top = tileToSub(z.y);
        const inside = b.x >= tileToSub(z.x) && b.x + b.w <= tileToSub(z.x + 2);
        if (inside && Math.abs(b.y + b.h - top) <= px(1)) return this.enterPipe(p, z, 'down');
      } else if (z.dir === 'right') {
        if (!input.held('right') && !this.autoWalk) continue;
        const mouthX = tileToSub(z.x);
        const standingRow = tileAt(b.y + b.h - 1);
        if (
          b.x + b.w >= mouthX - px(1) &&
          b.x + b.w <= mouthX + px(2) &&
          (standingRow === z.y || standingRow === z.y + 1)
        ) {
          return this.enterPipe(p, z, 'right');
        }
      }
    }
  }

  private enterPipe(p: Player, z: Zone & { kind: 'pipe' }, dir: PipeDir): void {
    for (const o of this.players) {
      o.frozen = true;
      o.body.vx = 0;
      o.body.vy = 0;
      o.anim = 'idle';
      if (o !== p) o.hidden = true;
    }
    if (dir === 'down') p.body.x = tileToSub(z.x) + px(16) - (p.body.w >> 1);
    this.audio.sfx('pipe');
    this.pipeAnim = {
      player: p,
      dir,
      t: 0,
      frames: dir === 'down' ? toPx(p.body.h) + 8 : 24,
      target: { type: 'pipe', target: z.target },
    };
  }

  private updatePipeAnim(): void {
    const a = this.pipeAnim as PipeAnim;
    const p = a.player;
    a.t++;
    const b = p.body;
    if (a.dir === 'down') b.y += px(1);
    else if (a.dir === 'right') {
      b.x += px(1);
      p.anim = 'walk';
      if (a.t % 4 === 0) p.walkFrame = (p.walkFrame + 1) % 3;
    }
    if (a.t >= a.frames) {
      this.events.push(a.target);
      this.pipeAnim = null;
    }
  }

  private updatePipeExit(): void {
    const e = this.pipeExit as NonNullable<typeof this.pipeExit>;
    e.t++;
    for (const p of this.players) {
      if (p.index === 0 || e.t > 20) {
        p.hidden = false;
        p.body.y -= px(1);
      }
    }
    if (e.t >= e.frames + 20) {
      this.pipeExit = null;
      for (const p of this.players) p.frozen = false;
    }
  }

  get inPipe(): boolean {
    return this.pipeAnim !== null || this.pipeExit !== null;
  }

  private checkZones(): void {
    for (const z of this.level.zones) {
      if (
        z.kind === 'checkpoint' &&
        !this.checkpointSent &&
        this.players.some((p) => p.body.x >= tileToSub(z.x))
      ) {
        this.checkpointSent = true;
        this.events.push({ type: 'checkpoint', x: z.x });
      }
    }
  }

  /* ---------- Level clear ---------- */

  private startClear(pole: Flagpole, p: Player): void {
    for (const o of this.players) {
      o.frozen = true;
      o.body.vx = 0;
      o.body.vy = 0;
      if (o !== p) o.hidden = true;
    }
    p.body.x = tileToSub(pole.tx) - p.body.w + px(2);
    p.facing = 1;
    p.anim = 'climb';
    this.audio.stopMusic();
    this.audio.sfx('flagpole');
    // FlagPole.touchPlayer: scored by the player's vertical middle; the text follows the flag.
    const score = pole.scoreForGrab((p.body.y + p.body.h / 2) / px(1));
    this.addScore(score);
    this.spawn(new FlagScore(pole, String(score)));
    const exit = this.level.zones.find((z): z is Zone & { kind: 'exit' } => z.kind === 'exit');
    const walkTo = tileToSub((exit?.x ?? pole.tx) + 6) + px(8);
    this.clear = { phase: 'slide', t: 0, pole, walkTo, player: p };
    this.time ??= 0;
  }

  /** Score popups keep floating up and expiring through the clear sequences, while all else holds still. */
  private tickScorePopups(): void {
    for (const e of this.entities) if (e.alive && e instanceof ScorePopup) e.update();
  }

  private updateClear(): void {
    const c = this.clear as NonNullable<typeof this.clear>;
    const p = c.player;
    const b = p.body;
    c.t++;
    switch (c.phase) {
      case 'slide': {
        const bottom = px(c.pole.baseY);
        b.y = Math.min(b.y + px(2), bottom - b.h);
        const flagDone = c.pole.lowerFlag(2);
        if (b.y + b.h >= bottom && flagDone) {
          c.phase = 'hop';
          c.t = 0;
        }
        break;
      }
      case 'hop':
        if (c.t === 1) {
          b.x = tileToSub(c.pole.tx) + px(10);
          p.facing = -1;
        }
        if (c.t >= 20) {
          c.phase = 'walk';
          c.t = 0;
          p.facing = 1;
          this.audio.playJingle('level-clear');
        }
        break;
      case 'walk': {
        p.anim = 'walk';
        if (c.t % 4 === 0) p.walkFrame = (p.walkFrame + 1) % 3;
        b.x += px(1);
        b.vy += 0x00400;
        if (b.vy > 0x04000) b.vy = 0x04000;
        const before = b.y;
        const feetRow = tileAt(b.y + b.h + velToSub(b.vy));
        if (this.map.isSolid(tileAt(b.x + (b.w >> 1)), feetRow)) {
          b.y = tileToSub(feetRow) - b.h;
          b.vy = 0;
        } else b.y = before + velToSub(b.vy);
        if (b.x >= c.walkTo) {
          c.phase = 'countdown';
          c.t = 0;
          p.anim = 'idle';
          p.hidden = true;
        }
        break;
      }
      case 'countdown':
        // The original's StatManager.convertTimeToScore: a 10 ms timer takes one TIME unit per
        // tick for TIME_PT_VAL (ScoreValue.TIME_REMAINING = 50) points. The timer is held back by
        // the locked 30 fps (GameSettings.FRAME_RATE_LOCKED); 3.1.21 measures about 30 units a
        // second, so one unit every two of our frames.
        if (this.time && this.time > 0) {
          if (c.t % 2 === 1) {
            this.time--;
            this.addScore(50);
          }
          if (c.t % 4 === 1) this.audio.sfx('timer-tick');
        } else {
          c.phase = 'flag';
          c.t = 0;
        }
        break;
      case 'flag':
        if (c.t === 1) for (const e of this.entities) if (e instanceof Decoration) e.raiseFlag();
        if (c.t >= 90) {
          c.phase = 'done';
          const exit = this.level.zones.find((z): z is Zone & { kind: 'exit' } => z.kind === 'exit');
          this.events.push({ type: 'exit', next: exit?.next ?? 'end' });
        }
        break;
      case 'done':
        break;
    }
  }

  private startBossClear(axe: Axe, p: Player): void {
    axe.destroy();
    for (const o of this.players) {
      o.frozen = true;
      o.body.vx = 0;
      o.body.vy = 0;
      o.anim = 'idle';
      if (o !== p) o.hidden = true;
    }
    this.audio.stopMusic();
    this.bossClear = { t: 0 };
    this.bossPlayer = p;
  }
  private bossPlayer: Player | null = null;

  private updateBossClear(): void {
    const c = this.bossClear as NonNullable<typeof this.bossClear>;
    const p = this.bossPlayer ?? this.player;
    c.t++;
    if (c.t % 4 === 0) {
      let cut = false;
      for (let tx = this.level.width - 1; tx >= 0 && !cut; tx--) {
        for (let ty = 0; ty < this.level.height; ty++) {
          if (this.map.get(tx, ty) === T.BRIDGE) {
            this.map.set(tx, ty, T.AIR);
            cut = true;
            break;
          }
        }
      }
      if (cut) this.audio.sfx('break');
    }
    for (const e of this.entities) if (e instanceof Bowser) e.update(this);
    // The axe drops the bridge's Bowser; a fake one elsewhere in the castle is left alone.
    const bowser = this.entities.find((e): e is Bowser => e instanceof Bowser && e.alive && !e.fake);
    if (bowser && c.t === 60) {
      bowser.fallDead();
      this.audio.sfx('bowser-fall');
      this.addScore(5000, bowser.body.x, bowser.body.y);
    }
    if (c.t === 120) this.audio.playJingle('castle-clear');
    const exit = this.level.zones.find((z): z is Zone & { kind: 'exit' } => z.kind === 'exit');
    if (c.t > 150 && c.stop === undefined) {
      p.anim = 'walk';
      if (c.t % 4 === 0) p.walkFrame = (p.walkFrame + 1) % 3;
      p.facing = 1;
      p.body.x += px(1);
      this.bossWalkFall(p);
      // The screen follows the walk, so Toad (or the princess) comes into view.
      this.camera.follow(p.body.x);
      this.spawnPending();
      // The walk ends on touching the exit marker, the tile before Toad (the original's
      // Level.as stops the player on touchedExit); without one it lasts three seconds.
      const reached = exit ? p.body.x + p.body.w >= tileToSub(exit.x) : c.t >= 330;
      if (reached || c.t >= 750) {
        c.stop = c.t;
        p.anim = 'idle';
      }
    }
    if (c.stop === undefined) return;
    // Then Toad's thanks; 1.5 s later the news, and 3.5 s after it the next level (the
    // original's ADD_TXT_TMR_DUR and WIN_END_TMR_DUNGEON_DUR). The last castle hands the thanks
    // over to the ending.
    const next = exit?.next ?? 'end';
    const s = c.t - c.stop;
    if (s === 30) this.castleText = [`THANK YOU ${p.def.hudName}!`];
    if (s === 120 && next !== 'end') this.castleText.push('', 'BUT OUR PRINCESS IS IN', 'ANOTHER CASTLE!');
    if (s >= (next === 'end' ? 120 : 330)) {
      this.events.push({ type: 'exit', next });
      c.t = -100000;
    }
  }

  /**
   * Gravity for the walk to Toad: the player drops off the axe's ledge onto the floor below, but
   * never into a pit (over the cut bridge's lava the walk stays level).
   */
  private bossWalkFall(p: Player): void {
    const b = p.body;
    const col = tileAt(b.x + (b.w >> 1));
    let ground = tileAt(b.y + b.h);
    while (ground < this.level.height && !this.map.isSolid(col, ground)) ground++;
    if (ground >= this.level.height) return;
    const top = tileToSub(ground) - b.h;
    b.vy = Math.min(b.vy + 0x00400, 0x04000);
    b.y = Math.min(b.y + velToSub(b.vy), top);
    if (b.y === top) b.vy = 0;
  }

  private renderCastleText(r: Renderer, view: View): void {
    const font = view.assets.sheet('font');
    this.castleText.forEach((l, i) => r.text(font, l, (SCREEN_W - l.length * 8) >> 1, 80 + i * 16));
  }

  /* ---------- Rendering ---------- */

  render(r: Renderer): void {
    const theme = this.level.theme;
    r.clear(SKY[theme] ?? '#5c94fc');
    const view: View = {
      camX: this.camera.pxX,
      frame: this.frame,
      assets: this.ctx.assets,
      theme,
      reduceFlashing: this.ctx.reduceFlashing,
    };
    for (const e of this.entities) if (e.alive && e.layer === 'back') e.render(r, view);
    if (this.inPipe) for (const p of this.players) this.renderPlayer(r, view, p);
    renderTiles(r, view, this.map);
    for (const e of this.entities) if (e.alive && e.layer === 'main') e.render(r, view);
    if (!this.inPipe) for (const p of [...this.players].reverse()) this.renderPlayer(r, view, p);
    for (const e of this.entities) if (e.alive && e.layer === 'front') e.render(r, view);
    this.renderWarpText(r, view);
    this.renderCastleText(r, view);
  }

  private renderWarpText(r: Renderer, view: View): void {
    for (const z of this.level.zones) {
      if (z.kind !== 'warp') continue;
      const x0 = z.x * 16 - view.camX;
      if (x0 > SCREEN_W || x0 + z.w * 16 < 0) continue;
      const font = view.assets.sheet('font');
      if (z.text) r.text(font, z.text, Math.max(8, x0 + 8), 72);
      const pipes = this.level.zones.filter(
        (p): p is Zone & { kind: 'pipe' } => p.kind === 'pipe' && p.x >= z.x && p.x < z.x + z.w,
      );
      pipes.forEach((p, i) => {
        const w = z.worlds[i];
        if (w !== undefined) r.text(font, worldLabel(w), p.x * 16 + 12 - view.camX, p.y * 16 - 16);
      });
    }
  }

  private renderPlayer(r: Renderer, view: View, p: Player): void {
    if (p.hidden || p.out) return;
    if (!p.visible(view.frame)) return;
    const s = p.def.sprite(p, view.frame, view.reduceFlashing);
    const sheet = view.assets.sheet(s.sheet, s.palette);
    const f = sheet.frames.get(s.frame);
    const w = f?.w ?? 16;
    const x = toPx(p.body.x) - view.camX - (s.flip ? w - toPx(p.body.w) - s.offsetX : s.offsetX);
    r.sprite(sheet, s.frame, x, toPx(p.body.y) - s.offsetY, s.flip);
    if (this.coop && p.index > 0 && !p.dead) {
      // Small "2" tag above player two so both players can tell who is who.
      r.text(view.assets.sheet('font'), '2', toPx(p.body.x) - view.camX + 2, toPx(p.body.y) - s.offsetY - 10);
    }
  }
}
