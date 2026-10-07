import type { InputFrame } from '@engine/input/input-manager';
import { worldLabel } from '../hud/world-label';
import { SCORE_MAX } from '../hud/hud';
import { NO_INPUT } from '@engine/input/input-manager';
import { OffsetRenderer, type Renderer } from '@engine/gfx/renderer';
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
import { Captive } from '../entities/objects/captive';
import { Toad } from '../entities/objects/toad';
import { Spring } from '../entities/objects/spring';
import { Vine } from '../entities/objects/vine';
import {
  BEAM_GATHER_FRAMES,
  BEAM_H,
  BEAM_HOLD_FRAMES,
  BEAM_SPEED,
  drawBeam,
  TeleportPad,
  type TeleportZone,
} from '../entities/objects/teleporter';
import { PowerUp } from '../entities/objects/powerup';
import { Pickup } from '../entities/objects/pickup';
import { FlagScore, Flagpole } from '../entities/objects/flagpole';
import { Projectile } from '../entities/projectiles/projectile';
import { BlockBump, BrickPiece, CoinPop, Corpse, Explosion, ScorePopup } from '../entities/effects/effects';
import { castleFlagStart, Firework, FIREWORK_FRAMES, FIREWORK_TILES } from '../entities/effects/firework';
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
import { Larry } from '../entities/enemies/larry';
import { startHp, type CharacterDef } from '../characters/character';

export type WorldEvent =
  | { type: 'pipe'; target: { level: string; x: number; y: number; exitDir?: TransferMode; secret?: string } }
  | { type: 'exit'; next: string }
  /** `player`: index of the player whose death ended the attempt (they pick the next hero). */
  | { type: 'died'; player?: number }
  | { type: 'checkpoint'; x: number; y: number }
  /** The castle maze moved the players from column `from` to `to` (informational). */
  | { type: 'loop'; from: number; to: number }
  /** A player pressed up next to a captive hero (campaign): the level starts the unlock flow. */
  | { type: 'talk'; hero: string; player: number }
  /** A player came within a captive's talking reach (TALK shows for them): announced. */
  | { type: 'captive-near'; hero: string; player: number }
  /**
   * A player touched Larry Koopa's crystal ball (objects/crystal-ball.ts): the level shows its
   * card and ends the area (campaign: 4-2's secret exit; else on to `next`).
   */
  | { type: 'crystal-ball'; player: number; next: string | null };

/**
 * Campaign play's captive heroes (Captive): who is freed already on the file, and each hero's
 * definition. Null outside campaign mode, where no captive spawns.
 */
export interface CaptiveRules {
  isFreed(id: string): boolean;
  hero(id: string): CharacterDef | undefined;
}

/** Counts of things the players did in this world (stage tutorials check their lessons by them). */
export interface WorldFeats {
  /** Enemies stomped. */
  stomps: number;
  /** ? blocks (and coin bricks) bumped for a coin. */
  coinBlocks: number;
  /** Blocks bumped for a power-up (mushroom or flower). */
  powerBlocks: number;
  /** Bricks broken. */
  bricks: number;
}

export interface WorldStart {
  /** Override the level's start tile. */
  x?: number;
  y?: number;
  mode?: LevelData['startMode'];
  /** Timer to continue with (transfers within one stage). */
  time?: number;
  /**
   * Remove the enemies within 6 tiles of the arrival point (Level.destroyNearbyEnemies):
   * 'all' at a checkpoint restart (startAtHalfwayPoint), 'keep-piranhas' on a pipe or pit
   * arrival (changePlayerLoc calls destroyNearbyEnemies(true)).
   */
  clearEnemies?: 'all' | 'keep-piranhas';
  /**
   * Seed for the world's RNG (swimming Cheep Cheeps' setup, jump and throw timers...). Left out,
   * every visit gets a fresh one, as the original's Math.random does; headless runs pass a fixed one.
   */
  seed?: number;
  /**
   * Entity types of a mini game's own map (Mega Man's station robots...), so they need no case in
   * makeEntity. Asked first for every spawn: an entity takes the spawn, null drops it (a type the
   * mini game handles some other way), undefined leaves it to the built-in types.
   */
  extraEntities?: (s: EntitySpawn, world: World) => Entity | null | undefined;
}

/** The fixed seed headless runs use for a level unless they pass their own. */
export const levelSeed = (level: LevelData): number => level.id.length * 7919 + 1;

let visits = 0;
/** A fresh seed for each world built in play (LevelScene), so no two visits share a school of fish. */
export const freshSeed = (): number =>
  ((Math.random() * 0x100000000) ^ Math.imul(++visits, 0x9e3779b1)) >>> 0;

/**
 * Pipe travel speed: the original's vertPipeSpeed = horzPipeSpeed = 50 Flash px/s
 * (Character.as), with 2 Flash px to our px and 60 frames a second: 25/60 px per frame, in subpixels.
 */
const PIPE_SPEED = px(25) / 60;
/** Character.PIPE_LEV_TRANS_DELAY (500 ms): hidden in the pipe before the next area loads. */
const PIPE_TRANSFER_DELAY_FRAMES = 30;
/** Level.HW_ENEMY_REMOVAL_DIST = TILE_SIZE*6: enemies closer than this (px, horizontally) go. */
const ENEMY_REMOVAL_PX = 6 * 16;
/**
 * The vine you arrive on in a sky area (Vine.growFromStgBot): it grows from the screen bottom
 * (GLOB_STG_BOT) until its top is 5 tiles up, at riseSpeed 60 Flash px/s (0.5 px a frame).
 */
const ARRIVAL_VINE_TILES = 5;
const ARRIVAL_VINE_RISE = 0.5;
/** Synthetic input for the vine arrival (Character.climbVineStarter sets upBtn). */
const AUTO_CLIMB_INPUT: InputFrame = {
  held: (a) => a === 'up',
  pressed: () => false,
  released: () => false,
  bufferedJump: () => false,
  consumeJumpBuffer: () => undefined,
  dirX: 0,
};

/** The clock a level starts with: a carried timer, else the level's, else the stage's (or 400). */
export function startTime(level: LevelData, state: GameState, start: WorldStart = {}): number {
  return start.time ?? (level.time === null ? (state.time ?? 400) : level.time);
}

type ClearPhase = 'slide' | 'hop' | 'walk' | 'countdown' | 'flag' | 'done';
type PipeAnim = {
  player: Player;
  dir: PipeDir;
  t: number;
  /** Subpixel y (down) or x (right) of the body when it started into the pipe. */
  from: number;
  /** Frames left hidden in the pipe before the transfer (PIPE_LEV_TRANS_DELAY); null while moving. */
  hold: number | null;
  target: WorldEvent & { type: 'pipe' };
};
/**
 * A teleport pad's beam (entities/objects/teleporter.ts). `up`: the rider is hidden, the streak
 * gathers where he stood, rises off the top of the screen, and `target` is raised after a short
 * hold. `down` (a `beam` arrival): each player's streak drops from above the screen onto his start
 * spot, gathers, and he appears (player 2 a little later).
 */
type BeamAnim = {
  dir: 'up' | 'down';
  t: number;
  streaks: { player: Player; x: number; top: number; floor: number; delay: number; landed: number }[];
  target?: WorldEvent & { type: 'pipe' };
};
/** Player 2's beam-down starts this many frames after player 1's. */
const BEAM_P2_DELAY = 12;

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

/** TIME units the clear tally turns into points each frame (the original: one every two frames). */
export const TALLY_PER_FRAME = 2;
/** Points per TIME unit left (ScoreValue.TIME_REMAINING). */
const TIME_POINTS = 50;

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
  private spawns: EntitySpawn[];
  /** Subpixel y of the water line in water levels; Infinity elsewhere. */
  waterTop = Infinity;
  /** Set once a vine or pit transfer has been queued, so the frame ends quietly. */
  private leaving = false;
  private cheepTimer = 0;
  /** Frames since the lead player last moved right (flying Cheep Cheeps' reverse rule). */
  private cheepNoRight = 0;
  /** Flying-bill respawn timer in frames (0 = stopped) and the one bill it has out. */
  private bulletTimer = 0;
  private flyingBill: BulletBill | null = null;
  /** Bowser's long-range flames (`bowser-fire` zone), or null. */
  private readonly bowserFire: BowserFire | null;
  /** Castle maze: lead player's centre x last frame (px) and the loop checkpoints passed. */
  private loopPrevX: number | null = null;
  private readonly loopChecks = new Set<string>();
  private readonly coinBlocks = new Map<string, { left: number; until: number }>();
  private clear: {
    phase: ClearPhase;
    t: number;
    pole: Flagpole;
    walkTo: number;
    player: Player;
    /** Fireworks to set off after the tally (1, 3 or 6, else 0): StatManager.touchFlag's HUD time. */
    fireworks: number;
  } | null = null;
  private pipeAnim: PipeAnim | null = null;
  /** Rising out of a pipe; `feet` is the subpixel y of the pipe top, where the rise ends. */
  private pipeExit: { t: number; feet: number } | null = null;
  /** A teleport pad's beam up, or the beam-down arrival (`beam` start mode). */
  private beam: BeamAnim | null = null;
  /** The vine grown for a sky-area arrival while the players climb it on their own. */
  private vineArrival: Vine | null = null;
  /** The HUD leaves the time blank (the vine arrival's watch mode: Level.as tsTxt.hideTime). */
  timeHidden = false;
  private readonly deathTimers = new Map<Player, number>();
  private readonly respawnTimers = new Map<Player, number>();
  private checkpointSent = false;
  /** Set when Bowser's bridge is cut; freezes everything but the axe sequence. */
  bossClear: { t: number; stop?: number } | null = null;
  /** The castle-clear message shown over the level (Toad's thanks), one entry per text row. */
  castleText: string[] = [];
  /** Drawn behind the tiles and sprites (the ending's credits, which the original adds under the level). */
  backdrop: ((r: Renderer) => void) | null = null;
  /** Level intro that walks the player into a pipe (1-2 style) ignoring input. */
  autoWalk = false;
  readonly flagpole: Flagpole | null = null;
  /** Set by LevelScene in campaign play; see CaptiveRules. */
  captives: CaptiveRules | null = null;
  /** What the players have done here so far (the tutorial's lessons read it, src/game/tutorial). */
  readonly feats: WorldFeats = { stomps: 0, coinBlocks: 0, powerBlocks: 0, bricks: 0 };
  /** A free camera's renderer (the screen moved up by the camera's y), reused each frame. */
  private offsetRenderer: OffsetRenderer | null = null;
  /** The map's height in px (240, one screen, unless a `camera: free` map is taller). */
  readonly heightPx: number;
  /** WorldStart.extraEntities: a mini game's own entity types. */
  private readonly extraEntities: WorldStart['extraEntities'];

  constructor(
    readonly level: LevelData,
    readonly ctx: GameContext,
    readonly state: GameState,
    start: WorldStart = {},
  ) {
    this.audio = ctx.audio;
    this.assist = ctx.assist;
    this.extraEntities = start.extraEntities;
    this.map = new TileMap(level);
    const stop = level.zones.find((z): z is Zone & { kind: 'scrollStop' } => z.kind === 'scrollStop');
    this.camera = new Camera(level.width, stop ? stop.x : null, level.camera === 'locked', {
      free: level.camera === 'free',
      heightTiles: level.height,
    });
    this.heightPx = level.height * 16;
    this.camera.allowLeftScroll = ctx.assist.allowLeftScroll;
    this.rng = new Rng(start.seed ?? levelSeed(level));
    // A transfer within the same stage (bonus room, detour, sky) keeps the running clock.
    this.time = startTime(level, state, start);
    const sx = start.x ?? level.start.x;
    const sy = start.y ?? level.start.y;
    const mode = start.mode ?? level.startMode;
    // Swimming Cheep Cheeps get their random start tile now, like the original's calcPosition at
    // level load, so the shifted fish still spawns off screen. A climb start replaces the map's
    // vine at the start column with the arrival vine (below).
    this.spawns = level.entities
      .map((e) => Cheep.placeSwimmer(e, this.rng))
      .filter((e) => !(mode === 'climb' && e.type === 'vine' && e.x === sx))
      .sort((a, b) => a.x - b.x);
    this.bowserFire = BowserFire.forLevel(level);
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
        // The original's vineStart (Level.as watchModeOverrideVine): the vine grows from the
        // screen bottom while the player is hidden (Vine.initiate → growFromStgBot), then
        // Character.climbVineStarter puts him on it with his head at the screen bottom
        // (ny = GLOB_STG_BOT + height) and holds up; updateVineArrival steps him off at the top.
        if (!this.vineArrival) {
          this.vineArrival = new Vine(sx, SCREEN_H / 16 - 1, ARRIVAL_VINE_TILES);
          this.vineArrival.growFromBase(ARRIVAL_VINE_RISE);
          this.entities.push(this.vineArrival);
        }
        const vine = this.vineArrival;
        def.behaviour.onGrabVine?.(p); // a carried morph ball unrolls before the height is used
        const h = p.body.h;
        // `bottom` leaves room for the body below the base: he starts there and climbs up.
        p.vine = { x: vine.centerX, top: vine.topPx, bottom: vine.basePx + toPx(h) };
        p.body.x = vine.centerX - (p.body.w >> 1);
        p.body.y = px(vine.basePx);
        p.anim = 'climb';
        p.hidden = true;
        p.frozen = true;
        this.timeHidden = true;
      } else if (mode === 'pipe-exit') {
        // Character.exitPipeVert: start one body height below the pipe top (y = startPipeLoc +
        // height), centred on the 2-wide pipe, and rise out; P2 arrives a moment later.
        p.body.x += px(8) - px(i * 20);
        p.body.y = feet;
        p.frozen = true;
        if (i > 0) p.hidden = true;
        this.pipeExit = { t: 0, feet };
      } else if (mode === 'beam') {
        // Beamed down (a teleport pad's arrival): hidden until the streak lands on the spot.
        p.frozen = true;
        p.hidden = true;
        this.beam ??= { dir: 'down', t: 0, streaks: [] };
        this.beam.streaks.push({
          player: p,
          x: toPx(p.centerX),
          top: -BEAM_H,
          floor: toPx(feet),
          delay: i * BEAM_P2_DELAY,
          landed: -1,
        });
      } else if (mode === 'autowalk') this.autoWalk = true;
      this.players.push(p);
    });
    // An intro is a cutscene (Level.as watchModeOverride: tsTxt.hideTime()): no clock runs, and
    // the main area after it starts its own.
    if (this.autoWalk) this.time = null;
    this.camera.snapTo(this.player.body.x, this.player.body.y);
    if (start.clearEnemies) {
      // Level.destroyNearbyEnemies: every enemy of the area (spawned or not) within 6 tiles of
      // the player goes, measured from its cell's centre. A pipe or pit arrival measures from the
      // transporter at the right edge of the start cell (the pipe's middle; pitTransferEnd is
      // shiftRight), a checkpoint from the player's centre. Fire bars and lava balls are
      // projectiles there (FireBar, LavaFireBall), not enemies.
      const x0 = mode === 'pipe-exit' || mode === 'fall' ? tileToSub(sx + 1) : this.player.centerX;
      const keepPiranhas = start.clearEnemies === 'keep-piranhas';
      this.spawns = this.spawns.filter((s) => {
        const cx = tileToSub(s.x) + px(8 + Number(s.props?.dx ?? 0));
        if (Math.abs(cx - x0) >= px(ENEMY_REMOVAL_PX)) return true;
        const e = this.makeEntity(s);
        const enemy = e instanceof Enemy && !(e instanceof Firebar) && !(e instanceof Podoboo);
        return !enemy || (keepPiranhas && e instanceof Piranha);
      });
    }
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
    // Teleport pads; one hidden in a hidden teleporter block waits for the bump.
    for (const z of level.zones) {
      if (z.kind !== 'teleport') continue;
      const hidden = !!z.block && tileDef(this.map.get(z.block.x, z.block.y)).block?.content === 'teleporter';
      this.entities.push(new TeleportPad(z, hidden));
    }
  }

  /** The player who touched the flagpole (its level-clear sequence is running), else null. */
  get flagGrabbedBy(): Player | null {
    return this.clear?.player ?? null;
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
    // `dx` / `dy`: the original's half-tile shiftRight / shiftUp nudges, in px (convert-smbc.mjs).
    const x = tileToSub(s.x) + px(Number(s.props?.dx ?? 0));
    const y = tileToSub(s.y) + px(Number(s.props?.dy ?? 0));
    const extra = this.extraEntities?.(s, this);
    if (extra !== undefined) return extra;
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
      case 'captive': {
        // Campaign only, and only until that hero is freed on the file.
        const id = String(s.props?.hero ?? '');
        const hero = this.captives?.hero(id);
        if (!hero || this.captives?.isFreed(id)) return null;
        return new Captive(s.x, s.y, hero);
      }
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
      case 'larry':
        return new Larry(s.x, s.y, typeof s.props?.next === 'string' ? s.props.next : null);
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
    this.feats.stomps++;
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
      return this.updateClear(inputs);
    }
    if (this.bossClear) {
      this.tickScorePopups();
      return this.updateBossClear();
    }
    if (this.pipeAnim) return this.updatePipeAnim();
    if (this.pipeExit) return this.updatePipeExit();
    if (this.beam) return this.updateBeam();
    if (this.leaving) return;

    for (const p of this.players) if (p.dead) this.updateDeath(p);
    if (this.activePlayers().length === 0) return;

    this.tickTimer();
    this.spawnPending();
    if (this.vineArrival) this.updateVineArrival();

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
      else if (this.vineArrival && p.vine) input = AUTO_CLIMB_INPUT;
      p.inWater = p.body.y + (p.body.h >> 1) >= this.waterTop;
      this.grabVines(p, input);
      const spring = this.springUnder(p);
      if (spring) {
        spring.ride(input.pressed('jump'));
        p.anim = 'jump';
        return;
      }
      p.update(input, this.map, this.audio, (tx, ty) => this.hitBlock(tx, ty, p));
      // No attacks, tools or thrusts on a vine: every hero's checkState returns on ST_VINE (e.g.
      // Link.checkState on "vine", MarioBase.checkState) and pressAtkBtn / pressSpcBtn return there.
      if (p.vine) {
        p.activeMelee = null;
        p.scratch.upThrust = 0;
        p.scratch.downThrust = 0;
        p.def.behaviour.vineTick?.(p);
      } else p.def.behaviour.update(p, input, this);
      // Springboards are solid: keep the player out of their box (landing on top starts a ride).
      for (const e of this.entities) if (e instanceof Spring && e.alive) e.block(p);
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
      e.levelHeightPx = this.heightPx;
      e.update(this);
    }
    this.resolveLifts();
    this.checkTalk(inputs);
    for (const p of this.activePlayers()) this.collisions(p);
    this.enemyVsEnemy();
    for (const [i, p] of this.players.entries()) {
      if (p.dead || p.out) continue;
      this.checkPipes(p, this.autoWalk ? AUTO_WALK_INPUT : (inputs[i] ?? NO_INPUT));
      if (this.pipeAnim) break;
    }
    if (!this.pipeAnim && !this.leaving) this.checkTeleports();
    this.checkZones();
    this.checkLoops();
    this.flyingCheeps();
    this.flyingBullets();
    if (this.bowserFire && !this.leaving) {
      const lead = this.rightmost();
      if (lead) this.bowserFire.update(this, lead);
    }

    const lead = this.rightmost();
    if (lead) this.camera.follow(lead.body.x, lead.body.y);
    for (const p of this.players) {
      if (p.star === 1) this.audio.playMusic(this.level.music);
      if (toPx(p.body.y) > this.heightPx + 8 && !p.dead && !p.out && !this.leaving) {
        const pit = this.level.zones.find(
          (z): z is Zone & { kind: 'pit' } => z.kind === 'pit' && p.body.x >= tileToSub(z.x),
        );
        if (pit) this.transfer(pit.target, 'fall');
        else this.kill(p);
      }
    }
    this.cull();
  }

  /** Up pressed by a player within a captive's reach: a `talk` event (one a frame). */
  private checkTalk(inputs: InputFrame[]): void {
    for (const [i, p] of this.players.entries()) {
      if (!(inputs[i] ?? NO_INPUT).pressed('up') || p.vine) continue;
      const c = this.entities.find((e): e is Captive => e instanceof Captive && e.alive && e.inReach(p));
      if (c) {
        c.prompt = false; // hidden under the dialogue; back on the next update in reach
        this.events.push({ type: 'talk', hero: c.hero.id, player: i });
        return;
      }
    }
  }

  /** A captive hero was freed: it leaves the room in a puff. */
  freeCaptive(hero: string): void {
    for (const e of this.entities) if (e instanceof Captive && e.alive && e.hero.id === hero) e.free(this);
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

  /**
   * The vine arrival after the vine has grown: the players appear and climb (AUTO_CLIMB_INPUT);
   * each one whose head reaches the vine's top steps off to the right
   * (Character.checkVinePosition → getOffVine in watch mode: x = vine.hRht + hWidth*.5, then
   * nx += 5 Flash px) and falls; play and the time display resume once all are off.
   */
  private updateVineArrival(): void {
    const v = this.vineArrival as Vine;
    let climbing = false;
    for (const p of this.players) {
      if (p.dead || p.out) continue;
      const on = p.vine !== null && p.vine.x === v.centerX;
      if (on && !v.grown) {
        climbing = true;
        continue;
      }
      if (p.frozen && p.hidden) {
        p.frozen = false;
        p.hidden = false;
      }
      if (!on) continue;
      if (p.body.y > px(v.topPx)) {
        climbing = true;
        continue;
      }
      p.letGo();
      p.leftVine = v.centerX;
      p.facing = 1;
      p.body.x = v.body.x + v.body.w + px(2.5);
      p.body.vy = 0;
      p.body.onGround = false;
    }
    if (!climbing) {
      this.vineArrival = null;
      this.timeHidden = false;
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
    // A vine just stepped off (Character.getOffVine leaves him beside its hit box) is not grabbed
    // again until he lands or moves out of reach.
    if (p.leftVine !== null && (b.onGround || Math.abs(p.centerX - p.leftVine) > px(16))) p.leftVine = null;
    for (const e of this.entities) {
      if (!(e instanceof Vine) || !e.alive || e.centerX === p.leftVine) continue;
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
        p.def.behaviour.onGrabVine?.(p);
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
      // A spring in use belongs to its rider; another player only meets its solid box.
      if (e.busy) {
        if (e.ridBy(p)) return e;
        continue;
      }
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

  /**
   * 5-3 style flying Bullet Bills (`com/smbc/level/BulletBillSpawner.as`): one at a time, each sent
   * 250 ms (`DEL_DEFAULT`) after the last is gone, from just off the right edge flying left, its
   * bottom on the grid line nearest the player's feet plus -2..2 tiles, kept at least 3 tiles below
   * the top of the screen and 1 tile above the bottom (`respawnTmrHandler`, `bulletBillDestroyed`).
   */
  private flyingBullets(): void {
    const lead = this.rightmost();
    if (!lead || this.leaving) return;
    const inZone = this.level.zones.some(
      (z) => z.kind === 'bullets' && lead.body.x >= tileToSub(z.x) && lead.body.x < tileToSub(z.x + z.w),
    );
    if (this.flyingBill && !this.flyingBill.alive) {
      this.flyingBill = null;
      this.bulletTimer = 15; // bulletBillDestroyed restarts the 250 ms timer
    }
    if (this.bulletTimer > 0) {
      if (--this.bulletTimer > 0) return;
      if (!inZone || this.flyingBill) return;
      const feet = toPx(lead.body.y + lead.body.h);
      let bottom = Math.round(feet / 16) * 16 + (this.rng.int(5) - 2) * 16;
      while (bottom > SCREEN_H - 16) bottom -= 16;
      while (bottom < 3 * 16) bottom += 16;
      const bill = new BulletBill(this.camera.right, px(bottom - 14), -1);
      bill.body.vx = -BULLET_SPEED;
      this.flyingBill = bill;
      this.spawn(bill);
      return;
    }
    if (inZone && !this.flyingBill) this.bulletTimer = 15;
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
      if (e.despawnMargin !== null && e.body.x + e.body.w < left - px(e.despawnMargin)) {
        // Gone for good (the original's cleanUp/destroy): whoever still holds it (Lakitu's
        // Spinies, the flying-bill spawner) must see it dead, or it counts against them forever.
        e.destroy();
        this.entities.splice(i, 1);
      }
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
        } else e.bounceHit(tileToSub(tx) + px(8));
      }
    }
    // Coin.gBounceHit: a coin on the block flies off as a FlyingCoin (a coin, then 200 points).
    if (tileDef(this.map.get(tx, ty - 1)).pickup === 'coin') {
      this.map.set(tx, ty - 1, T.AIR);
      this.spawn(new CoinPop(tileToSub(tx) + px(4), tileToSub(ty - 1)));
      this.addCoin();
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
        this.feats.bricks++;
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
        this.feats.coinBlocks++;
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
        this.feats.powerBlocks++;
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
      case 'clock':
        // The Clock comes out of its block; the coin block on the same cell is next (T.Q_CLOCK).
        this.spawn(new PowerUp(tx, ty, 'clock'));
        this.audio.sfx('powerup-appear');
        restore = T.Q_COIN;
        break;
      case 'vine':
        this.spawn(new Vine(tx, ty, 0, { tx, ty }));
        this.audio.sfx('vine');
        break;
      case 'teleporter':
        // The pad hidden in this block rises out of the floor (its `teleport` zone's block=).
        for (const e of this.entities)
          if (e instanceof TeleportPad && e.zone.block?.x === tx && e.zone.block.y === ty && !e.shown) {
            e.reveal();
            this.audio.sfx('powerup-appear');
          }
        break;
      case 'none':
        break;
    }
    this.bump(tx, ty, frame, restore);
  }

  /**
   * Any hero's Clock (Character.as, PickupInfo.CLOCK): Clock.SCORE_VALUE = 1000 points and
   * Clock.TIME_TO_ADD = 100 on the timer; back above the hurry time, the hurry tune ends
   * (StatManager.checkCancelSecondsLeft).
   */
  private collectClock(e: PowerUp): void {
    this.addScore(1000, e.body.x, e.body.y);
    this.audio.sfx('powerup');
    if (this.time === null) return;
    this.time += 100;
    if (this.hurryPlayed && this.time > HURRY_TIME) {
      this.hurryPlayed = false;
      this.audio.setTempoScale(1);
      // Under star power the star tune keeps playing; the level tune returns when it ends.
      if (!this.players.some((p) => p.star > 0)) this.audio.playMusic(this.level.music);
    }
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
          } else if (e.item === 'clock') this.collectClock(e);
          else p.def.behaviour.onPowerUp(p, e.item, this);
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
        // A stomp on something that only shrugs it off (Larry Koopa in his shell): the player
        // bounces off unhurt, and it neither scores nor counts as a stomp.
        if (r === 'bounce') {
          p.stompBounce();
          this.audio.sfx('bump');
          return;
        }
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
    // A fall off the bottom of the screen (a pit, or through the lava, which is only scenery)
    // has no hop: the original's Character.initiatePitDeath only starts the die timer.
    if (t === 30 && toPx(p.body.y) <= this.heightPx) p.body.vy = -0x04000;
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
      from: dir === 'down' ? p.body.y : p.body.x,
      hold: null,
      target: { type: 'pipe', target: z.target },
    };
  }

  /**
   * Into a pipe at PIPE_SPEED (Character.updateStats, pType "enterVert" / "enterHorz"). Down ends
   * once the body's top is HRECT_PADDING_Y (6 Flash px, 3 of ours) below where the feet started;
   * right once its left edge is HRECT_PADDING_X (4 Flash px, 2 of ours) past where its right
   * edge started. Then the player is hidden and the next area loads PIPE_LEV_TRANS_DELAY later.
   */
  private updatePipeAnim(): void {
    const a = this.pipeAnim as PipeAnim;
    const p = a.player;
    a.t++;
    if (a.hold !== null) {
      if (--a.hold <= 0) {
        this.events.push(a.target);
        this.pipeAnim = null;
      }
      return;
    }
    const b = p.body;
    const d = Math.round(a.t * PIPE_SPEED);
    let inside: boolean;
    if (a.dir === 'down') {
      b.y = a.from + d;
      inside = b.y - px(3) > a.from + b.h;
    } else {
      b.x = a.from + d;
      p.anim = 'walk';
      if (a.t % 4 === 0) p.walkFrame = (p.walkFrame + 1) % 3;
      inside = b.x - px(2) > a.from + b.w;
    }
    if (inside) {
      p.hidden = true;
      a.hold = PIPE_TRANSFER_DELAY_FRAMES;
    }
  }

  /**
   * Out of a pipe (Character.exitPipeVert, pType "exitVert"): each player rises at PIPE_SPEED
   * until the feet reach the pipe top, and stops there (completePipeExit: ny = startPipeLoc,
   * onGround). Player 2 starts 20 frames after player 1.
   */
  private updatePipeExit(): void {
    const e = this.pipeExit as NonNullable<typeof this.pipeExit>;
    e.t++;
    let rising = false;
    for (const p of this.players) {
      const t = e.t - (p.index === 0 ? 0 : 20);
      if (t <= 0) {
        rising = true;
        continue;
      }
      p.hidden = false;
      const b = p.body;
      if (b.y + b.h <= e.feet) continue;
      const step = Math.round(t * PIPE_SPEED) - Math.round((t - 1) * PIPE_SPEED);
      b.y = Math.max(e.feet - b.h, b.y - step);
      if (b.y + b.h > e.feet) rising = true;
    }
    if (!rising) {
      this.pipeExit = null;
      for (const p of this.players) {
        p.frozen = false;
        p.body.vy = 0;
        p.body.onGround = true;
      }
    }
  }

  get inPipe(): boolean {
    return this.pipeAnim !== null || this.pipeExit !== null;
  }

  /** A teleport pad's beam is playing (up or down). */
  get beaming(): boolean {
    return this.beam !== null;
  }

  /** The teleport pads of this level (shown or still hidden). */
  get pads(): TeleportPad[] {
    return this.entities.filter((e): e is TeleportPad => e instanceof TeleportPad && e.alive);
  }

  /** A player standing on an armed pad is beamed up (everyone freezes, as for a pipe). */
  private checkTeleports(): void {
    const players = this.activePlayers();
    for (const pad of this.pads) {
      const p = pad.rider(players);
      if (p) return this.beamUp(p, pad.zone);
    }
  }

  private beamUp(p: Player, z: TeleportZone): void {
    for (const o of this.players) {
      o.frozen = true;
      o.body.vx = 0;
      o.body.vy = 0;
      o.anim = 'idle';
      o.hidden = true;
    }
    this.audio.sfx('beam');
    const floor = toPx(p.body.y + p.body.h);
    this.beam = {
      dir: 'up',
      t: 0,
      // Centred on the pad, as Mega Man's teleporters line him up.
      streaks: [{ player: p, x: z.x * 16 + 8, top: floor - BEAM_H, floor, delay: 0, landed: 0 }],
      target: { type: 'pipe', target: { ...z.target } },
    };
  }

  /**
   * The beam (see BeamAnim). Up: BEAM_GATHER_FRAMES gathered, then rising at BEAM_SPEED until off
   * the top, then BEAM_HOLD_FRAMES before the transfer. Down: from above the screen to the spot
   * at BEAM_SPEED, gathered for BEAM_GATHER_FRAMES, then the hero appears; play resumes once all
   * are in.
   */
  private updateBeam(): void {
    const a = this.beam as BeamAnim;
    a.t++;
    if (a.dir === 'up') {
      const s = a.streaks[0];
      if (!s) return;
      if (a.t <= BEAM_GATHER_FRAMES) return;
      if (s.top + BEAM_H >= 0) s.top -= BEAM_SPEED;
      else if (++s.landed >= BEAM_HOLD_FRAMES) {
        // Gone: on to the target, as a pipe would (LevelScene carries the clock within a stage).
        this.beam = null;
        this.leaving = true;
        if (a.target) this.events.push(a.target);
      }
      return;
    }
    let busy = false;
    for (const s of a.streaks) {
      const p = s.player;
      if (a.t <= s.delay || p.dead || p.out) {
        busy ||= a.t <= s.delay;
        continue;
      }
      if (s.landed < 0) {
        s.top = Math.min(s.floor - BEAM_H, s.top + BEAM_SPEED);
        if (s.top >= s.floor - BEAM_H) {
          s.landed = 0;
          this.audio.sfx('beam');
        }
        busy = true;
      } else if (s.landed < BEAM_GATHER_FRAMES) {
        s.landed++;
        busy = true;
      } else if (p.hidden) {
        p.hidden = false;
      }
    }
    if (!busy) {
      this.beam = null;
      for (const p of this.players) {
        p.frozen = false;
        p.body.vy = 0;
        p.body.onGround = true;
      }
    }
  }

  private checkZones(): void {
    for (const z of this.level.zones) {
      if (
        z.kind === 'checkpoint' &&
        !this.checkpointSent &&
        this.players.some((p) => p.body.x >= tileToSub(z.x))
      ) {
        this.checkpointSent = true;
        this.events.push({ type: 'checkpoint', x: z.x, y: z.y ?? 12 });
      }
    }
  }

  /* ---------- Level clear ---------- */

  private startClear(pole: Flagpole, p: Player): void {
    this.destroyEnemiesAndProjectilesOnScreen();
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
    // StatManager.touchFlag keeps the HUD time (timeLeftBeatLevel); when the tally ends,
    // timeScoreConverterTmrLsr sets off that many fireworks if its last digit is 1, 3 or 6.
    const digit = (this.time ?? 0) % 10;
    const fireworks = digit === 1 || digit === 3 || digit === 6 ? digit : 0;
    this.clear = { phase: 'slide', t: 0, pole, walkTo, player: p, fireworks };
    this.time ??= 0;
  }

  /**
   * EventManager.touchedFlagPole → Level.destroyAllEnemiesAndProjectilesOnScreen: every enemy and
   * projectile on the stage vanishes (no score, no death animation). An object is on the stage
   * while within 2 tiles (Flash 64 px, 32 px here) of either screen edge
   * (AnimatedObject.checkStgPos). Brick pieces, coins popping from blocks and falling defeated
   * enemies are the original's Projectiles / Enemies too; spawners and pickups stay.
   */
  private destroyEnemiesAndProjectilesOnScreen(): void {
    const left = this.camera.x - px(32);
    const right = this.camera.right + px(32);
    for (const e of this.entities) {
      if (!e.alive || e.body.x + e.body.w < left || e.body.x > right) continue;
      if (
        e instanceof Enemy ||
        e instanceof Projectile ||
        e instanceof BrickPiece ||
        e instanceof CoinPop ||
        e instanceof Corpse
      )
        e.destroy();
    }
  }

  /** Level.launchNextFirework: the `i`-th firework over the castle flag, worth ScoreValue.FIREWORK. */
  private launchFirework(c: NonNullable<typeof this.clear>, i: number): void {
    const [dx, dy] = FIREWORK_TILES[i] ?? [0, 0];
    // The castle whose flag rises: the nearest one past the pole.
    let castle: Decoration | null = null;
    for (const e of this.entities)
      if (e instanceof Decoration && e.name.startsWith('castle') && e.body.x > c.pole.body.x)
        if (!castle || e.body.x < castle.body.x) castle = e;
    const exit = this.level.zones.find((z): z is Zone & { kind: 'exit' } => z.kind === 'exit');
    // No castle drawn: where a small castle's flag would start, over the exit on the ground (row 13).
    const flag = castle ? castleFlagStart(castle) : { x: (exit?.x ?? c.pole.tx + 6) * 16, y: 13 * 16 - 72 };
    // Level.launchNextFirework: on x-3 levels every position moves one tile right.
    const x = flag.x + 8 + (dx + (this.level.stage === 3 ? 1 : 0)) * 16;
    const y = flag.y - 16 + dy * 16;
    this.spawn(new Firework(x, y));
    this.audio.sfx('firework');
    this.addScore(500);
  }

  /** Score popups keep floating up and expiring through the clear sequences, while all else holds still. */
  private tickScorePopups(): void {
    for (const e of this.entities) if (e.alive && e instanceof ScorePopup) e.update();
  }

  private updateClear(inputs: readonly InputFrame[]): void {
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
        // tick for TIME_PT_VAL (ScoreValue.TIME_REMAINING = 50) points; held back by the locked
        // 30 fps (GameSettings.FRAME_RATE_LOCKED), 3.1.21 measures about 30 units a second.
        // Deliberately faster here (owner feedback: a full clock took over 13 s): TALLY_PER_FRAME
        // units a frame (400 in about 3.3 s), and JUMP finishes it at once for the same points.
        if (this.time && this.time > 0) {
          if (inputs.some((f) => f.pressed('jump'))) {
            this.addScore(this.time * TIME_POINTS);
            this.time = 0;
            this.audio.sfx('timer-tick');
          } else {
            const n = Math.min(TALLY_PER_FRAME, this.time);
            this.time -= n;
            this.addScore(n * TIME_POINTS);
            if (c.t % 4 === 1) this.audio.sfx('timer-tick');
          }
        } else {
          c.phase = 'flag';
          c.t = 0;
        }
        break;
      case 'flag': {
        if (c.t === 1) for (const e of this.entities) if (e instanceof Decoration) e.raiseFlag();
        // Level.raiseFlag starts the castle flag and the first firework together; each firework
        // launches the next when it is removed (Firework.cleanUp), and the level ends
        // WIN_END_TMR_FIREWORKS_DUR (1 s) after the last one. Without fireworks the wait stays
        // 90 frames.
        const fw = (c.t - 1) / FIREWORK_FRAMES;
        if (Number.isInteger(fw) && fw < c.fireworks) this.launchFirework(c, fw);
        for (const e of this.entities)
          if (e.alive && (e instanceof Decoration || e instanceof Firework)) e.update();
        if (c.t >= (c.fireworks > 0 ? 1 + c.fireworks * FIREWORK_FRAMES + 60 : 90)) {
          c.phase = 'done';
          const exit = this.level.zones.find((z): z is Zone & { kind: 'exit' } => z.kind === 'exit');
          this.events.push({ type: 'exit', next: exit?.next ?? 'end' });
        }
        break;
      }
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
  /** The hero who took the axe (Toad's "THANK YOU <hero>!"), or null before the bridge is cut. */
  get castleHero(): Player['def'] | null {
    return this.bossPlayer?.def ?? null;
  }

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
    // No points: BowserAxe.as only calls breakBridgeStart/Inc/End (Bowser.as), never die(), and
    // the fall below the screen (AnimatedObject.checkDosSides -> destroy) scores nothing either.
    if (bowser && c.t === 60) {
      bowser.fallDead();
      this.audio.sfx('bowser-fall');
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
    // original's ADD_TXT_TMR_DUR and WIN_END_TMR_DUNGEON_DUR). The last castle says instead that
    // the quest is over (ScreenManager.addTxtTmrHandler, GameTextMessages.QUEST_IS_OVER) and hands
    // over to the ending 2.5 s later (START_MOVE_CREDITS_TMR_DUR), where the credits roll.
    // The Lost Levels' last castles (8-4, 9-4, D-4) say nothing themselves: the ending's card
    // (Game.showLostEnding) is the thanks, over the level, when Toad's thanks would start, so
    // no line is said twice.
    const next = exit?.next ?? 'end';
    const s = c.t - c.stop;
    if (next === 'end' && (this.level.parent ?? this.level.id).startsWith('ll-')) {
      if (s >= 30) {
        this.events.push({ type: 'exit', next });
        c.t = -100000;
      }
      return;
    }
    if (s === 30) this.castleText = [`THANK YOU ${p.def.hudName}!`];
    if (s === 120 && next !== 'end') this.castleText.push('', 'BUT OUR PRINCESS IS IN', 'ANOTHER CASTLE!');
    if (s === 120 && next === 'end') this.castleText.push('', 'YOUR QUEST IS OVER.');
    if (s >= (next === 'end' ? 270 : 330)) {
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

  render(screen: Renderer): void {
    const theme = this.level.theme;
    screen.clear(SKY[theme] ?? '#5c94fc');
    const view: View = {
      camX: this.camera.pxX,
      frame: this.frame,
      assets: this.ctx.assets,
      theme,
      reduceFlashing: this.ctx.reduceFlashing,
    };
    // A free camera scrolls vertically too: the map is drawn moved up by its y (the backdrop and
    // the castle text stay screen-fixed). Every other level draws straight to the screen.
    let r = screen;
    if (this.camera.free) {
      view.camY = this.camera.pxY;
      const o = (this.offsetRenderer ??= new OffsetRenderer(screen, 0, 0));
      o.inner = screen;
      o.dy = -view.camY;
      r = o;
    }
    for (const e of this.entities) if (e.alive && e.layer === 'back') e.render(r, view);
    this.backdrop?.(screen);
    if (this.inPipe) for (const p of this.players) this.renderPlayer(r, view, p);
    renderTiles(r, view, this.map);
    for (const e of this.entities) if (e.alive && e.layer === 'main') e.render(r, view);
    if (!this.inPipe) for (const p of [...this.players].reverse()) this.renderPlayer(r, view, p);
    this.renderBeam(r, view);
    for (const e of this.entities) if (e.alive && e.layer === 'front') e.render(r, view);
    this.renderWarpText(r, view);
    this.renderCastleText(screen, view);
  }

  private renderBeam(r: Renderer, view: View): void {
    const a = this.beam;
    if (!a) return;
    for (const s of a.streaks) {
      if (a.dir === 'up') {
        if (s.top + BEAM_H >= 0) drawBeam(r, view, s.x, s.top, a.t <= BEAM_GATHER_FRAMES);
      } else if (a.t > s.delay && s.landed < BEAM_GATHER_FRAMES && !s.player.dead) {
        drawBeam(r, view, s.x, s.top, s.landed >= 0);
      }
    }
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
