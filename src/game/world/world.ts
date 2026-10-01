import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import { overlaps } from '@engine/math/aabb';
import { px, TILE, tileAt, tileToSub, toPx, velToSub } from '@engine/math/units';
import { Rng } from '@engine/rng';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import type { EntitySpawn, LevelData, PipeDir, Zone } from '../level/schema';
import { tileDef, T } from '../level/tiles';
import { Camera } from './camera';
import { TileMap } from './tilemap';
import { Player } from '../entities/player';
import type { Entity } from '../entities/entity';
import { type View } from '../entities/entity';
import { Enemy } from '../entities/enemies/enemy';
import { Goomba } from '../entities/enemies/goomba';
import { Koopa } from '../entities/enemies/koopa';
import { Piranha } from '../entities/enemies/piranha';
import { PowerUp } from '../entities/objects/powerup';
import { Flagpole } from '../entities/objects/flagpole';
import { Projectile } from '../entities/projectiles/projectile';
import { BlockBump, BrickPiece, CoinPop, ScorePopup } from '../entities/effects/effects';
import { comboScore, type DamageSource } from '../rules/damage';
import type { GameContext, GameState } from '../context';
import { HURRY_TIME, SPAWN_MARGIN_PX, TIMER_FRAMES } from '../constants';
import { Decoration } from '../entities/objects/decoration';
import { Lift } from '../entities/objects/lift';
import { Firebar } from '../entities/enemies/firebar';
import { Bowser } from '../entities/enemies/bowser';
import { Axe } from '../entities/objects/axe';

export type WorldEvent =
  | { type: 'pipe'; target: { level: string; x: number; y: number; exitDir?: PipeDir | 'none' } }
  | { type: 'exit'; next: string }
  | { type: 'died' }
  | { type: 'checkpoint'; x: number };

export interface WorldStart {
  /** Override the level's start tile. */
  x?: number;
  y?: number;
  mode?: LevelData['startMode'];
}

type ClearPhase = 'slide' | 'hop' | 'walk' | 'countdown' | 'flag' | 'done';
type PipeAnim = { dir: PipeDir; t: number; frames: number; target: WorldEvent & { type: 'pipe' } };

/** One loaded level: tiles, camera, player, entities and the rules that tie them together. */
export class World {
  readonly map: TileMap;
  readonly camera: Camera;
  readonly player: Player;
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
  private readonly coinBlocks = new Map<string, { left: number; until: number }>();
  private clear: { phase: ClearPhase; t: number; pole: Flagpole; walkTo: number } | null = null;
  private pipeAnim: PipeAnim | null = null;
  private pipeExit: { dir: PipeDir; t: number; frames: number } | null = null;
  private deathTimer = 0;
  private checkpointSent = false;
  /** Set when Bowser's bridge is cut; freezes everything but the axe sequence. */
  bossClear: { t: number } | null = null;
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
    this.time = level.time === null ? (state.time ?? 400) : level.time;
    this.spawns = [...level.entities].sort((a, b) => a.x - b.x);

    const sx = start.x ?? level.start.x;
    const sy = start.y ?? level.start.y;
    const mode = start.mode ?? level.startMode;
    const def = state.character;
    const tmp = new Player(0, 0, def, state.powerState, state.hp);
    const hb = def.hitbox(tmp);
    const feet = tileToSub(sy + 1);
    this.player = new Player(
      tileToSub(sx) + px((16 - hb.w) >> 1),
      feet - px(hb.h),
      def,
      state.powerState,
      state.hp,
    );
    this.player.profile = { ...def.movement, coyoteFrames: ctx.assist.coyoteFrames };
    if (mode === 'fall') {
      this.player.body.y = px(-32);
    } else if (mode === 'pipe-exit') {
      // Start inside the pipe below (centred on the 2-wide pipe) and rise out.
      this.player.body.x += px(8);
      this.player.body.y = feet + px(8);
      this.player.frozen = true;
      this.pipeExit = { dir: 'up', t: 0, frames: hb.h + 8 };
    } else if (mode === 'autowalk') {
      this.autoWalk = true;
    }
    this.camera.snapTo(this.player.body.x);

    // Static objects from the tile grid.
    for (let tx = 0; tx < level.width; tx++) {
      let ballRow = -1;
      for (let ty = 0; ty < level.height; ty++) {
        const id = this.map.get(tx, ty);
        if (id === T.FLAG_BALL) ballRow = ty;
        if (id === T.FLAG_SHAFT && ballRow >= 0) {
          // find the base: first non-shaft tile below
          let base = ty;
          while (this.map.get(tx, base) === T.FLAG_SHAFT) base++;
          const pole = new Flagpole(tx, ballRow, base);
          this.entities.push(pole);
          (this as { flagpole: Flagpole | null }).flagpole = pole;
          break;
        }
      }
    }
    for (const d of level.decor) this.entities.push(new Decoration(d.kind, d.x, d.y));
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
      // Things spawning behind the camera at level start are skipped like SMB1 unless they're static.
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
      case 'piranha':
        return new Piranha(s.x, s.y);
      case 'firebar':
      case 'firebar-ccw':
        return new Firebar(s.x, s.y, s.type === 'firebar-ccw' ? -1 : 1, Number(s.props?.len ?? 6));
      case 'bowser':
        return new Bowser(s.x, s.y);
      case 'axe':
        return new Axe(s.x, s.y);
      case 'lift-h':
      case 'lift-v':
      case 'lift-fall':
      case 'lift-up':
      case 'lift-down':
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
      if (e instanceof Projectile && e.owner === (owner as Entity) && e.kind === kind && e.alive) n++;
    return n;
  }

  get enemies(): Enemy[] {
    return this.entities.filter((e): e is Enemy => e instanceof Enemy && e.alive);
  }

  /* ---------- Scoring ---------- */

  addScore(n: number, x?: number, y?: number): void {
    this.state.score += n;
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

  /** Score a stomp/shell hit using the running combo; returns the text for the popup. */
  private comboHit(combo: number, x: number, y: number): void {
    const s = comboScore(combo);
    if (s === '1up') this.addLife(x, y);
    else this.addScore(s, x, y);
  }

  /* ---------- Update ---------- */

  update(input: InputFrame): void {
    this.frame++;
    const p = this.player;

    if (p.transition) {
      // Growth/shrink pauses the world (SMB1 does too).
      p.tickTransition();
      return;
    }
    if (p.dead) return this.updateDeath();
    if (this.clear) return this.updateClear();
    if (this.bossClear) return this.updateBossClear();
    if (this.pipeAnim) return this.updatePipeAnim();
    if (this.pipeExit) return this.updatePipeExit();

    this.tickTimer();
    this.spawnPending();

    if (this.autoWalk) input = AUTO_WALK_INPUT;
    p.update(input, this.map, this.audio, (tx, ty) => this.hitBlock(tx, ty));
    p.def.behaviour.update(p, input, this);

    if (p.body.x < this.camera.x) {
      p.body.x = this.camera.x;
      if (p.body.vx < 0) p.body.vx = 0;
    }
    if (p.body.x + p.body.w > tileToSub(this.level.width)) {
      p.body.x = tileToSub(this.level.width) - p.body.w;
    }

    for (const e of this.entities) if (e.alive) e.update(this);
    this.resolveLifts();
    this.collisions(input);
    this.checkPipes(input);
    this.checkZones();

    this.camera.follow(p.body.x);
    if (p.star === 1) this.audio.playMusic(this.level.music);
    if (toPx(p.body.y) > SCREEN_H + 8 && !p.dead) this.kill();
    this.cull();
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
        this.kill();
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
      if (e.despawnMargin !== null && e.body.x + e.body.w < left - px(e.despawnMargin)) {
        this.entities.splice(i, 1);
      }
    }
  }

  /* ---------- Blocks & tiles ---------- */

  private hitBlock(tx: number, ty: number): void {
    const id = this.map.get(tx, ty);
    const def = tileDef(id);
    if (!def.block) {
      this.audio.sfx('bump');
      return;
    }
    const p = this.player;
    // Anything standing on the block gets knocked.
    const top = tileToSub(ty);
    for (const e of this.entities) {
      if (!e.alive || !(e instanceof Enemy || e instanceof PowerUp)) continue;
      const b = e.body;
      if (Math.abs(b.y + b.h - top) <= px(2) && b.x < tileToSub(tx + 1) && b.x + b.w > tileToSub(tx)) {
        if (e instanceof Enemy) {
          const r = e.hit({ kind: 'bump', amount: 1, owner: null, dirX: b.x > p.body.x ? 1 : -1 }, this);
          if (r !== 'immune') this.addScore(e.scoreValue, b.x, b.y);
        } else b.vy = -0x03000;
      }
    }
    const { kind, content } = def.block;
    const frame = kind === 'brick' ? 'brick' : 'used';
    if (kind === 'brick' && content === 'none') {
      if (p.def.canBreakBricks(p)) {
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
          c = { left: 10, until: this.frame + 300 };
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
      case 'vine':
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

  private collisions(input: InputFrame): void {
    const p = this.player;
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
        } else if (def.hazard && !this.assist.invulnerable) this.kill();
      }
    }

    // Melee hitbox vs enemies (before contact so a sword hit beats a body hit).
    if (p.activeMelee) {
      for (const e of this.enemies) {
        if (overlaps(p.activeMelee, e.body) && !p.scratch[`hit${e.id}`]) {
          p.scratch[`hit${e.id}`] = 1;
          const src: DamageSource = { kind: 'sword', amount: 1, owner: null, dirX: p.facing };
          const r = e.hit(src, this);
          if (r === 'kill' || r === 'flip') this.addScore(e.scoreValue, e.body.x, e.body.y);
          else if (r === 'hp') this.audio.sfx('hurt-enemy');
          if (r !== 'immune') p.def.behaviour.onMeleeHit?.(p, e, this);
        }
      }
    } else {
      for (const k of Object.keys(p.scratch)) if (k.startsWith('hit')) delete p.scratch[k];
    }

    for (const e of this.entities) {
      if (!e.alive) continue;
      if (e instanceof Enemy) this.playerVsEnemy(e, input);
      else if (e instanceof PowerUp) {
        if (overlaps(pb, e.body)) {
          e.destroy();
          p.def.behaviour.onPowerUp(p, e.item, this);
        }
      } else if (e instanceof Projectile) this.projectile(e);
      else if (e instanceof Flagpole && !this.clear && overlaps(pb, e.body)) this.startClear(e);
      else if (e instanceof Axe && overlaps(pb, e.body)) this.startBossClear(e);
    }

    // Enemy vs enemy: shells kill, walkers turn around.
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
          if (res === 'kill' || res === 'flip' || res === 'shell') {
            this.comboHit(shell.shellCombo++, victim.body.x, victim.body.y);
          }
        } else if (a.body.onGround && c.body.onGround && !(a instanceof Piranha) && !(c instanceof Piranha)) {
          a.bounceOff(c);
          c.bounceOff(a);
        }
      }
    }
  }

  private playerVsEnemy(e: Enemy, _input: InputFrame): void {
    const p = this.player;
    const pb = p.body;
    if (!overlaps(pb, e.body)) return;
    // A sword/thrust that is touching this enemy handles it; no body contact damage.
    if (p.activeMelee && overlaps(p.activeMelee, e.body)) return;
    if (p.star > 0) {
      const r = e.hit({ kind: 'star', amount: 1, owner: null, dirX: pb.x < e.body.x ? 1 : -1 }, this);
      if (r !== 'immune') this.addScore(e.scoreValue, e.body.x, e.body.y);
      return;
    }
    // SMB1-style stomp test: the player was moving down this frame and came in near the enemy's top.
    const feet = pb.y + pb.h;
    const falling = p.fallSpeed > 0;
    const eh = e.body.h;
    const fromAbove = falling && feet - e.body.y <= eh * 0.8 && pb.prevBottom <= e.body.y + eh * 0.6;
    if (fromAbove && e.stompable) {
      if (p.def.stomps) {
        const r = e.hit({ kind: 'stomp', amount: 1, owner: null, dirX: p.facing }, this);
        if (r === 'hurtAttacker') return this.hurtPlayer();
        if (r !== 'immune') {
          this.comboHit(p.combo++, e.body.x, e.body.y - px(8));
          p.stompBounce();
        }
        return;
      }
      // Non-stompers still bounce off resting shells by kicking them; otherwise they get hurt.
    }
    if (e instanceof Koopa && e.state === 'shell') {
      const dir: -1 | 1 = p.centerX < e.body.x + e.body.w / 2 ? 1 : -1;
      e.kick(dir, this);
      this.addScore(400, e.body.x, e.body.y);
      return;
    }
    if (!e.contactHurts) return;
    const custom = p.def.behaviour.contactDamage(p, e, this);
    if (custom) {
      const r = e.hit(custom, this);
      if (r === 'kill' || r === 'flip') this.addScore(e.scoreValue, e.body.x, e.body.y);
      return;
    }
    this.hurtPlayer(e.body.x + e.body.w / 2 < p.centerX ? 1 : -1);
  }

  private projectile(pr: Projectile): void {
    const p = this.player;
    if (pr.spec.hitsPlayer && overlaps(pr.body, p.body)) {
      this.hurtPlayer(pr.body.vx > 0 ? 1 : -1);
      if (!pr.spec.pierce) pr.destroy();
      return;
    }
    if (!pr.spec.hitsEnemies) return;
    for (const e of this.enemies) {
      if (!overlaps(pr.body, e.body)) continue;
      const src: DamageSource = {
        kind: pr.spec.damage,
        amount: pr.spec.amount,
        owner: pr,
        dirX: pr.body.vx > 0 ? 1 : -1,
      };
      const r = e.hit(src, this);
      if (r === 'immune') {
        if (pr.spec.hitsTiles) pr.burst(this);
        return;
      }
      if (r === 'kill' || r === 'flip') this.addScore(e.scoreValue, e.body.x, e.body.y);
      else if (r === 'hp') this.audio.sfx('hurt-enemy');
      if (!pr.spec.pierce) {
        pr.burst(this);
        return;
      }
    }
  }

  hurtPlayer(fromDir: -1 | 1 = 1): void {
    const p = this.player;
    if (p.invulnerable || this.assist.invulnerable) return;
    const result = p.def.behaviour.onHurt(p, this);
    if (result === 'dead') this.kill();
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
    const p = this.player;
    for (const e of this.entities) {
      if (!(e instanceof Lift) || !e.alive) continue;
      e.carry(p.body, this);
    }
  }

  /* ---------- Death ---------- */

  kill(): void {
    const p = this.player;
    if (p.dead) return;
    p.dead = true;
    p.frozen = true;
    p.star = 0;
    this.deathTimer = 0;
    this.audio.setTempoScale(1);
    this.audio.playJingle('death');
  }

  private updateDeath(): void {
    const p = this.player;
    this.deathTimer++;
    if (this.deathTimer === 30) p.body.vy = -0x04000;
    if (this.deathTimer > 30) {
      p.body.vy += 0x00280;
      p.body.y += velToSub(p.body.vy);
    }
    if (this.deathTimer >= 200) {
      this.events.push({ type: 'died' });
      this.deathTimer = -100000;
    }
  }

  /* ---------- Pipes & zones ---------- */

  private checkPipes(input: InputFrame): void {
    const p = this.player;
    const b = p.body;
    if (!b.onGround) return;
    for (const z of this.level.zones) {
      if (z.kind !== 'pipe') continue;
      if (z.dir === 'down') {
        if (this.autoWalk) {
          // Intro walk: slide into the pipe as soon as the player touches it.
          if (b.x + b.w >= tileToSub(z.x) - px(1)) return this.enterPipe(z, 'down');
          continue;
        }
        if (!input.held('down')) continue;
        const top = tileToSub(z.y);
        const inside = b.x >= tileToSub(z.x) && b.x + b.w <= tileToSub(z.x + 2);
        if (inside && Math.abs(b.y + b.h - top) <= px(1)) return this.enterPipe(z, 'down');
      } else if (z.dir === 'right') {
        if (!input.held('right')) continue;
        const mouthX = tileToSub(z.x);
        const standingRow = tileAt(b.y + b.h - 1);
        if (
          b.x + b.w >= mouthX - px(1) &&
          b.x + b.w <= mouthX + px(2) &&
          (standingRow === z.y || standingRow === z.y + 1)
        ) {
          return this.enterPipe(z, 'right');
        }
      }
    }
  }

  private enterPipe(z: Zone & { kind: 'pipe' }, dir: PipeDir): void {
    const p = this.player;
    p.frozen = true;
    p.anim = 'idle';
    p.body.vx = 0;
    p.body.vy = 0;
    if (dir === 'down') p.body.x = tileToSub(z.x) + px(16) - (p.body.w >> 1);
    this.audio.sfx('pipe');
    this.pipeAnim = {
      dir,
      t: 0,
      frames: dir === 'down' ? toPx(p.body.h) + 8 : 24,
      target: { type: 'pipe', target: z.target },
    };
  }

  private updatePipeAnim(): void {
    const a = this.pipeAnim as PipeAnim;
    a.t++;
    const b = this.player.body;
    if (a.dir === 'down') b.y += px(1);
    else if (a.dir === 'right') {
      b.x += px(1);
      this.player.anim = 'walk';
      if (a.t % 4 === 0) this.player.walkFrame = (this.player.walkFrame + 1) % 3;
    }
    if (a.t >= a.frames) {
      this.events.push(a.target);
      this.pipeAnim = null;
    }
  }

  private updatePipeExit(): void {
    const e = this.pipeExit as NonNullable<typeof this.pipeExit>;
    e.t++;
    this.player.body.y -= px(1);
    if (e.t >= e.frames) {
      this.pipeExit = null;
      this.player.frozen = false;
    }
  }

  get inPipe(): boolean {
    return this.pipeAnim !== null || this.pipeExit !== null;
  }

  private checkZones(): void {
    const p = this.player;
    for (const z of this.level.zones) {
      if (z.kind === 'checkpoint' && !this.checkpointSent && p.body.x >= tileToSub(z.x)) {
        this.checkpointSent = true;
        this.events.push({ type: 'checkpoint', x: z.x });
      }
    }
  }

  /* ---------- Level clear ---------- */

  private startClear(pole: Flagpole): void {
    const p = this.player;
    p.frozen = true;
    p.body.vx = 0;
    p.body.vy = 0;
    p.body.x = tileToSub(pole.tx) - p.body.w + px(2);
    p.facing = 1;
    p.anim = 'climb';
    this.audio.stopMusic();
    this.audio.sfx('flagpole');
    const score = pole.scoreForFeet(toPx(p.feetY));
    this.addScore(score, tileToSub(pole.tx) + px(8), p.body.y);
    const exit = this.level.zones.find((z): z is Zone & { kind: 'exit' } => z.kind === 'exit');
    const walkTo = tileToSub((exit?.x ?? pole.tx) + 6) + px(8);
    this.clear = { phase: 'slide', t: 0, pole, walkTo };
    this.time ??= 0;
  }

  private updateClear(): void {
    const c = this.clear as NonNullable<typeof this.clear>;
    const p = this.player;
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
        // simple ground snap using the map
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
        if (this.time && this.time > 0) {
          const step = Math.min(this.time, 2);
          this.time -= step;
          this.state.score += step * 50;
          if (c.t % 4 === 0) this.audio.sfx('timer-tick');
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

  private startBossClear(axe: Axe): void {
    axe.destroy();
    const p = this.player;
    p.frozen = true;
    p.body.vx = 0;
    p.body.vy = 0;
    p.anim = 'idle';
    this.audio.stopMusic();
    this.bossClear = { t: 0 };
  }

  private updateBossClear(): void {
    const c = this.bossClear as { t: number };
    c.t++;
    // Collapse the bridge tile by tile from the right.
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
    const bowser = this.entities.find((e): e is Bowser => e instanceof Bowser && e.alive);
    if (bowser && c.t === 60) {
      bowser.fallDead();
      this.audio.sfx('bowser-fall');
      this.addScore(5000, bowser.body.x, bowser.body.y);
    }
    if (c.t === 120) this.audio.playJingle('castle-clear');
    if (c.t === 150) {
      const p = this.player;
      p.frozen = false;
    }
    if (c.t > 150) {
      const p = this.player;
      p.anim = 'walk';
      if (c.t % 4 === 0) p.walkFrame = (p.walkFrame + 1) % 3;
      p.facing = 1;
      p.body.x += px(1);
      p.frozen = true;
    }
    if (c.t >= 330) {
      const exit = this.level.zones.find((z): z is Zone & { kind: 'exit' } => z.kind === 'exit');
      this.events.push({ type: 'exit', next: exit?.next ?? 'end' });
      c.t = -100000;
    }
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
    if (this.inPipe) this.renderPlayer(r, view);
    this.renderTiles(r, view);
    for (const e of this.entities) if (e.alive && e.layer === 'main') e.render(r, view);
    if (!this.inPipe) this.renderPlayer(r, view);
    for (const e of this.entities) if (e.alive && e.layer === 'front') e.render(r, view);
    this.renderWarpText(r, view);
  }

  private renderWarpText(r: Renderer, view: View): void {
    for (const z of this.level.zones) {
      if (z.kind !== 'warp') continue;
      const x0 = z.x * 16 - view.camX;
      if (x0 > SCREEN_W || x0 + z.w * 16 < 0) continue;
      const font = view.assets.sheet('font');
      if (z.text) r.text(font, z.text, Math.max(8, x0 + 8), 72);
      // Label each pipe in the zone with its destination world.
      const pipes = this.level.zones.filter(
        (p): p is Zone & { kind: 'pipe' } => p.kind === 'pipe' && p.x >= z.x && p.x < z.x + z.w,
      );
      pipes.forEach((p, i) => {
        const w = z.worlds[i];
        if (w !== undefined) r.text(font, String(w), p.x * 16 + 12 - view.camX, p.y * 16 - 16);
      });
    }
  }

  private renderTiles(r: Renderer, view: View): void {
    const sheet = view.assets.sheet('tiles', `tiles-${view.theme}`);
    const camPx = view.camX;
    const first = Math.max(0, camPx >> 4);
    const last = Math.min(this.map.width - 1, (camPx + SCREEN_W) >> 4);
    const anim = (view.frame >> 3) % 3;
    for (let ty = 0; ty < this.map.height; ty++) {
      for (let tx = first; tx <= last; tx++) {
        const id = this.map.get(tx, ty);
        if (id === T.AIR || id === T.BUMPING) continue;
        const def = tileDef(id);
        if (def.block?.kind === 'hidden') continue;
        let name = def.name;
        if (def.block?.kind === 'question') name = `question-${anim === 2 ? 1 : anim}`;
        else if (def.block?.kind === 'brick') name = 'brick';
        else if (def.pickup === 'coin') name = `coin-${(view.frame >> 3) & 3}`;
        else if (id === T.LAVA) name = `lava-${(view.frame >> 4) & 1}`;
        else if (id === T.WATER) name = `water-${(view.frame >> 4) & 1}`;
        const themed = `${name}@${view.theme}`;
        r.sprite(sheet, sheet.frames.has(themed) ? themed : name, tx * TILE - camPx, ty * TILE);
      }
    }
  }

  private renderPlayer(r: Renderer, view: View): void {
    const p = this.player;
    if (p.hidden) return;
    if (!p.visible(view.frame)) return;
    const s = p.def.sprite(p, view.frame, view.reduceFlashing);
    const sheet = view.assets.sheet(s.sheet, s.palette);
    const f = sheet.frames.get(s.frame);
    const w = f?.w ?? 16;
    const x = toPx(p.body.x) - view.camX - (s.flip ? w - toPx(p.body.w) - s.offsetX : s.offsetX);
    r.sprite(sheet, s.frame, x, toPx(p.body.y) - s.offsetY, s.flip);
  }
}

/** Synthetic input for auto-walk intros: hold right; the pipe check triggers on touch. */
const AUTO_WALK_INPUT: InputFrame = {
  held: (a) => a === 'right',
  pressed: () => false,
  released: () => false,
  bufferedJump: () => false,
  consumeJumpBuffer: () => undefined,
  dirX: 1,
};

const SKY: Partial<Record<LevelData['theme'], string>> = {
  overworld: '#5c94fc',
  underground: '#000000',
  castle: '#000000',
  water: '#2038ec',
  night: '#000000',
  treetop: '#5c94fc',
  snow: '#5c94fc',
};
