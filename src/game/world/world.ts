import type { InputFrame } from '@engine/input/input-manager';
import { worldLabel } from '../hud/world-label';
import { SCORE_MAX } from '../hud/hud';
import { NO_INPUT } from '@engine/input/input-manager';
import { OffsetRenderer, type Renderer } from '@engine/gfx/renderer';
import { overlaps } from '@engine/math/aabb';
import { px, tileAt, tileToSub, TILE_SUB, toPx, velToSub } from '@engine/math/units';
import { Rng } from '@engine/rng';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import type { EntitySpawn, LevelData, PipeDir, TransferMode, Zone } from '../level/schema';
import { isWaterTheme } from '../level/schema';
import { tileDef, T } from '../level/tiles';
import { Camera, DEFAULT_AUTO_SCROLL } from './camera';
import { drawStars, renderTiles, SKY, STARRY_SKIES } from './tile-render';
import { TileMap } from './tilemap';
import { SafetyFloor } from './safety-floor';
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
import { placeOnStairs, Stairs, type StairDir } from '../entities/objects/stairs';
import { AnchorDrop } from '../entities/objects/anchor-drop';
import { BridgeBlast } from '../entities/objects/bridge-blast';
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
import {
  BlockBump,
  BrickPiece,
  CoinPop,
  Corpse,
  Explosion,
  ScorePopup,
  type PieceFrame,
} from '../entities/effects/effects';
import { castleFlagStart, Firework, FIREWORK_FRAMES, FIREWORK_TILES } from '../entities/effects/firework';
import type { DamageKind, DamageSource, Reaction } from '../rules/damage';
import { shellKickSeqScore, stompScore } from '../rules/score';
import type { GameContext, GameState } from '../context';
import { HURRY_TIME, SPAWN_MARGIN_PX, TIMER_FRAMES } from '../constants';
import { Decoration } from '../entities/objects/decoration';
import { drawThemeBackdrop } from './theme-backdrop';
import { Lift } from '../entities/objects/lift';
import { Candle, Respawner } from '../entities/objects/crypt';
import {
  TRICK_HOLD_FRAMES,
  TRICK_PUSH_FRAMES,
  TRICK_SPIN_FRAMES,
  TrickWall,
  type TrickZone,
} from '../entities/objects/trick-wall';
import { sfx as SFX_LIB } from '@content/sfx/sfx';
import { Firebar } from '../entities/enemies/firebar';
import { Bowser, type BowserAttack } from '../entities/enemies/bowser';
import { BowserFire } from './bowser-fire';
import { Axe } from '../entities/objects/axe';
import { CaveFire, Moblin } from '../entities/objects/moblin';
import { YoshiEgg } from '../entities/objects/yoshi-egg';
import { Larry } from '../entities/enemies/larry';
import { CANNON_PERIOD, Cannon, isCannonDir } from '../entities/enemies/cannon';
import { RockyWrench } from '../entities/enemies/rocky-wrench';
import { startHp, type CharacterDef } from '../characters/character';

export type WorldEvent =
  /** `chain`: a climb up an anchor chain (the arrival's vine is drawn as a chain too). */
  | {
      type: 'pipe';
      target: {
        level: string;
        x: number;
        y: number;
        exitDir?: TransferMode;
        secret?: string;
        chain?: boolean;
      };
    }
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
  | { type: 'crystal-ball'; player: number; next: string | null }
  /** Larry's anchor smashed 4-2's warp-zone pipe (objects/anchor-drop.ts): the level announces it. */
  | { type: 'anchor' }
  /**
   * A player came up to the Moblin in 2-1's hidden cave (objects/moblin.ts): the level plays his
   * cards and ends (campaign: 2-1 cleared and the secret `secret` found; else on to `next`).
   */
  | { type: 'moblin'; player: number; secret: string; next: string | null }
  /** A hidden path's block was bumped (World.layPath): its clouds are being laid. */
  | { type: 'path' };

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
  /** A `climb` arrival up an anchor chain (4-2's anchor to Larry's airship): the vine is a chain. */
  chain?: boolean;
  /**
   * False: points still count, but no "200" popup floats up where they were scored (a mini game
   * whose HUD shows no score: Dracula's Castle, Zebes Escape, Station Escape). 1UP still shows.
   */
  scorePopups?: boolean;
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
/** The Safety floor assist's dashed line: faint, steady (nothing flashes). */
const SAFETY_FLOOR_COLOR = 'rgba(255, 255, 255, 0.45)';
/** The crypt's own sounds (S3's) once they exist; until then the plain brick break and none. */
const hasSfx = (id: string): boolean => SFX_LIB.some((x) => x.id === id);
const CRUMBLE_SFX = hasSfx('whip-wall') ? 'whip-wall' : 'break';
/** A trick wall's spin (R3's whoosh once it exists; until then the card flip). */
const SPIN_SFX = hasSfx('panel-spin') ? 'panel-spin' : 'card-flip';
const CANDLE_SFX = hasSfx('candle') ? 'candle' : null;
/** 7-3's exploding bridge (B3's boom once it exists; until then the bomb blast). */
const BRIDGE_BOOM_SFX = hasSfx('bridge-boom') ? 'bridge-boom' : 'explosion';
/** The cracked wall's rubble (the `crypt` sheet's; BrickPiece falls back to the brick piece). */
const RUBBLE: readonly PieceFrame[] = ['crypt:rubble-0', 'crypt:rubble-1'];

/** A hero's attack in flight: a shot or thrown weapon a player owns (or a hero shot's own shot). */
function heroShot(e: Entity): e is Projectile {
  if (!(e instanceof Projectile)) return false;
  const o = e.owner;
  return o instanceof Player || (o instanceof Projectile && o.owner instanceof Player);
}

/** Character.PIPE_LEV_TRANS_DELAY (500 ms): hidden in the pipe before the next area loads. */
const PIPE_TRANSFER_DELAY_FRAMES = 30;
/** Frames between two tiles of a hidden path appearing (World.layPath). */
export const PATH_STEP_FRAMES = 6;
/** Level.HW_ENEMY_REMOVAL_DIST = TILE_SIZE*6: enemies closer than this (px, horizontally) go. */
const ENEMY_REMOVAL_PX = 6 * 16;
/**
 * The vine you arrive on in a sky area (Vine.growFromStgBot): it grows from the screen bottom
 * (GLOB_STG_BOT) until its top is 5 tiles up, at riseSpeed 60 Flash px/s (0.5 px a frame).
 */
const ARRIVAL_VINE_TILES = 5;
const ARRIVAL_VINE_RISE = 0.5;
/** An anchor chain's arrival rises faster (it may reach a deck high up the screen). */
const ARRIVAL_CHAIN_RISE = 1.5;

/**
 * px: the top of a climb arrival's vine at column `x` (the start's x; it rises from the screen
 * bottom). The classic sky-area vine reaches 5 tiles up (Vine.growFromStgBot). A start row `y`
 * above that (a deck: 4-2's airship bow) makes it reach the ground the player steps off onto:
 * the first solid tile in column x + 1 below row y, with two tiles of headroom over it (every
 * hero stands at most 24 px tall), so he steps off above that floor and drops onto it.
 */
export function arrivalVineTop(map: TileMap, x: number, y: number, heightTiles: number): number {
  const classic = SCREEN_H - ARRIVAL_VINE_TILES * 16;
  for (let r = y + 1; r < heightTiles; r++) if (map.isSolid(x + 1, r)) return Math.min(classic, r * 16 - 32);
  return classic;
}
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

/**
 * A fall arrival (startMode / exit `fall`: a bonus room's pipe, a pit, a descent) drops each hero
 * straight down from his start column: left and right do nothing until his head is below this
 * line (px; the top of row 3), past the room's ceiling row and the HUD band above it, or he lands.
 * Steering from the first frame (left still held from walking onto the pipe) could otherwise drift
 * him over the wall beside the drop shaft and land him on its top, above the room (QA 0.4.8, 6-2's
 * bonus room).
 */
export const FALL_IN_STEER_Y = 3 * 16;

/** A player's input with left and right taken out (the straight drop of a fall arrival). */
function withoutSteering(input: InputFrame): InputFrame {
  return {
    held: (a) => a !== 'left' && a !== 'right' && input.held(a),
    pressed: (a) => a !== 'left' && a !== 'right' && input.pressed(a),
    released: (a) => a !== 'left' && a !== 'right' && input.released(a),
    bufferedJump: (w) => input.bufferedJump(w),
    consumeJumpBuffer: () => input.consumeJumpBuffer(),
    dirX: 0,
  };
}

const COOP_RESPAWN_FRAMES = 120;

/** TIME units the clear tally turns into points each frame (the original: one every two frames). */
export const TALLY_PER_FRAME = 2;
/** Points per TIME unit left (ScoreValue.TIME_REMAINING). */
const TIME_POINTS = 50;

/** No hero's body is wider than a tile (characters' hitboxes; simon-crypt.test.ts checks). */
const MAX_HERO_W = 16;

/**
 * Whether fire bar (tx, ty) of `n` balls can sweep anything spanning x0..x1 (px, end exclusive):
 * ball i's hit box is x = tx * 16 + 4 ± i * 8, plus 1..7 (Firebar.ballPos and its 6 px box).
 */
function barSweepX(tx: number, n: number, x0: number, x1: number): boolean {
  const r = (n - 1) * 8;
  return tx * 16 + 4 - r + 1 < x1 && tx * 16 + 4 + r + 7 > x0;
}

/**
 * One loaded level: tiles, camera, players, entities and the rules that tie them together.
 * Supports one or two players; with two, deaths respawn from a shared life pool.
 */
export class World {
  /** Points scored float up as a popup (WorldStart.scorePopups). */
  readonly scorePopups: boolean;
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
  /** Frames of screen shake left (the anchor's crash); never drawn with reduce flashing. */
  shakeFrames = 0;
  /** Warp zones whose pipe the anchor smashed: their number and welcome text are gone. */
  private readonly smashedWarps = new Set<Zone>();
  private readonly deathTimers = new Map<Player, number>();
  private readonly respawnTimers = new Map<Player, number>();
  /** Players still in a fall arrival's straight drop (FALL_IN_STEER_Y): no steering yet. */
  private readonly fallingIn = new Set<Player>();
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
  /** The exploding bridge's boom (entities/objects/bridge-blast.ts). */
  readonly bridgeBoomSfx = BRIDGE_BOOM_SFX;
  /** What the players have done here so far (the tutorial's lessons read it, src/game/tutorial). */
  readonly feats: WorldFeats = { stomps: 0, coinBlocks: 0, powerBlocks: 0, bricks: 0 };
  /** A free camera's renderer (the screen moved up by the camera's y), reused each frame. */
  private offsetRenderer: OffsetRenderer | null = null;
  /** The map's height in px (240, one screen, unless a `camera: free` map is taller). */
  readonly heightPx: number;
  /** Co-op respawns cost no shared life (Larry's airship challenge: deaths there are free). */
  livesFree = false;
  /** WorldStart.extraEntities: a mini game's own entity types. */
  private readonly extraEntities: WorldStart['extraEntities'];
  /** Cracked-wall tiles still standing (T.CRACKED; crackWalls does nothing once none are left). */
  private cracked = 0;
  /** The Safety floor assist's rims and the players' view of the map with it (made on first use). */
  private safety: SafetyFloor | null = null;
  private safetyView: TileMap | null = null;
  /** The live `descent` zones (a sleeping campaign one is left out): down-lift shafts. */
  private readonly descents: (Zone & { kind: 'descent' })[];
  /** Every `trick` zone's panel (a sleeping one too: it still turns for an arrival). */
  private readonly tricks: TrickWall[] = [];
  /** Frames each player has pushed into a live panel without letting go (TRICK_PUSH_FRAMES). */
  private readonly trickPush = new Map<Player, number>();
  /**
   * A trick wall's half turn: `out`, the pusher flipped through (hidden as it turns edge-on), then
   * the transfer TRICK_HOLD_FRAMES later; `in`, a `spin` arrival (the players appear beside it as
   * it turns edge-on and move once it is shut).
   */
  private trickSpin: { wall: TrickWall; dir: 'out' | 'in'; t: number } | null = null;

  constructor(
    readonly level: LevelData,
    readonly ctx: GameContext,
    readonly state: GameState,
    start: WorldStart = {},
  ) {
    this.audio = ctx.audio;
    this.assist = ctx.assist;
    this.extraEntities = start.extraEntities;
    this.scorePopups = start.scorePopups ?? true;
    this.map = new TileMap(level);
    for (const id of level.tiles) if (id === T.CRACKED) this.cracked++;
    this.descents = level.zones.filter(
      (z): z is Zone & { kind: 'descent' } => z.kind === 'descent' && !z.campaign,
    );
    for (const z of level.zones) {
      if (z.kind !== 'trick') continue;
      // The room lies on the open side of the panel's bottom tile.
      const side = this.map.isSolid(z.x + 1, z.y + z.h - 1) ? -1 : 1;
      const wall = new TrickWall(z, !z.campaign, side);
      this.tricks.push(wall);
      this.entities.push(wall);
    }
    const stop = level.zones.find((z): z is Zone & { kind: 'scrollStop' } => z.kind === 'scrollStop');
    this.camera = new Camera(level.width, stop ? stop.x : null, level.camera === 'locked', {
      free: level.camera === 'free',
      heightTiles: level.height,
      ...(level.camera === 'auto' ? { autoScroll: level.scroll ?? DEFAULT_AUTO_SCROLL } : {}),
    });
    this.heightPx = level.height * 16;
    this.camera.allowLeftScroll = ctx.assist.allowLeftScroll;
    this.rng = new Rng(start.seed ?? levelSeed(level));
    // A transfer within the same stage (bonus room, detour, sky) keeps the running clock.
    // A fill-up spot off the map (the Top Secret Area) runs no clock.
    this.time = level.bonus ? null : startTime(level, state, start);
    const sx = start.x ?? level.start.x;
    const sy = start.y ?? level.start.y;
    const mode = start.mode ?? level.startMode;
    // Swimming Cheep Cheeps get their random start tile now, like the original's calcPosition at
    // level load, so the shifted fish still spawns off screen. A climb start replaces the map's
    // vine at the start column with the arrival vine (below).
    this.spawns = level.entities
      // A campaign-only entity (`campaign=true`: 7-3's exploding bridge) sleeps unless the
      // campaign variant woke it (level/campaign.ts).
      .filter((e) => e.props?.campaign !== true)
      .map((e) => Cheep.placeSwimmer(e, this.rng))
      .filter((e) => !(mode === 'climb' && (e.type === 'vine' || e.type === 'chain') && e.x === sx))
      .sort((a, b) => a.x - b.x);
    // Stairs are scenery spanning several columns (a `ul` flight reaches left of its x): built
    // with the world, never despawned.
    for (const st of this.spawns.filter((e) => e.type === 'stairs')) {
      const e = this.makeEntity(st);
      if (e) this.entities.push(e);
    }
    this.spawns = this.spawns.filter((e) => e.type !== 'stairs');
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
      if (mode === 'fall') {
        p.body.y = px(-32) - px(i * 24);
        this.fallingIn.add(p);
        // Co-op: player 2 drops in beside player 1 where that drop is clear (fallSpot).
        const first = this.players[0];
        if (first) p.body.x = px(this.fallSpot(toPx(first.body.x), toPx(first.body.w), hb.w));
      } else if (mode === 'climb') {
        // The original's vineStart (Level.as watchModeOverrideVine): the vine grows from the
        // screen bottom while the player is hidden (Vine.initiate → growFromStgBot), then
        // Character.climbVineStarter puts him on it with his head at the screen bottom
        // (ny = GLOB_STG_BOT + height) and holds up; updateVineArrival steps him off at the top.
        // A start row above the classic vine's top (a deck) makes it taller (arrivalVineTop);
        // it passes through any hull below that deck (`through`: the climb ignores tiles).
        if (!this.vineArrival) {
          const top = arrivalVineTop(this.map, sx, sy, level.height);
          const rows = (SCREEN_H - top) >> 4;
          const art = start.chain ? 'chain' : 'vine';
          this.vineArrival = new Vine(sx, SCREEN_H / 16 - 1, rows, null, art);
          this.vineArrival.growFromBase(start.chain ? ARRIVAL_CHAIN_RISE : ARRIVAL_VINE_RISE);
          this.entities.push(this.vineArrival);
        }
        const vine = this.vineArrival;
        def.behaviour.onGrabVine?.(p); // a carried morph ball unrolls before the height is used
        const h = p.body.h;
        // `bottom` leaves room for the body below the base: he starts there and climbs up.
        p.stairs = null;
        p.vine = { x: vine.centerX, top: vine.topPx, bottom: vine.basePx + toPx(h), through: true };
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
      } else if (mode === 'spin') {
        // Flipped through a trick wall (World.trickSpin): beside its panel, facing into the room,
        // hidden until the panel turns edge-on; player 2 a step further into the room.
        const wall = this.trickBeside(sx, sy);
        const side = wall?.side ?? 1;
        p.body.x = tileToSub(sx) + px((16 - hb.w) >> 1) + side * px(i * 20);
        p.facing = side;
        if (wall) {
          p.frozen = true;
          p.hidden = true;
          this.trickSpin ??= { wall, dir: 'in', t: 0 };
        }
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

  /**
   * Spawns the map's entities within reach of the camera now, without stepping the world: a mini
   * game shows its props and creatures on a READY screen, still, before its first frame.
   */
  spawnInView(): void {
    this.spawnPending();
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
    if (s.props?.respawn) {
      // Kept alive while a cracked wall stands (5-4's dungeon Koopa: objects/crypt.ts).
      const { respawn: _, ...props } = s.props;
      return new Respawner(s, (sp) => this.makeEntity({ ...sp, props }));
    }
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
      case 'bridge-blast':
        return new BridgeBlast(s.x, s.y, Math.max(1, Number(s.props?.w ?? 1) || 1));
      case 'anchor-drop':
        return new AnchorDrop(s.x, s.y, s.props);
      case 'stairs': {
        const dir: StairDir = s.props?.dir === 'ul' ? 'ul' : 'ur';
        const len = Math.max(1, Number(s.props?.len ?? 4) || 4);
        return new Stairs(s.x, s.y, len, dir, typeof s.props?.sheet === 'string' ? s.props.sheet : 'crypt');
      }
      case 'vine':
      case 'chain':
        return new Vine(s.x, s.y, Number(s.props?.len ?? 8), null, s.type === 'chain' ? 'chain' : 'vine');
      case 'firebar':
      case 'firebar-ccw':
        return new Firebar(
          s.x,
          s.y,
          s.type === 'firebar-ccw' ? -1 : 1,
          this.descentBarLen(s.x, Number(s.props?.len ?? 6)),
        );
      case 'bowser':
        return new Bowser(
          s.x,
          s.y,
          String(s.props?.attack ?? 'fire') as BowserAttack,
          Boolean(s.props?.fake),
        );
      case 'axe':
        return new Axe(s.x, s.y);
      case 'cannon': {
        const dir = s.props?.dir;
        // Anything but a number (`period=fast`) falls back to the default.
        const p = Number(s.props?.period ?? CANNON_PERIOD);
        const period = Number.isFinite(p) ? p : CANNON_PERIOD;
        const d = Number(s.props?.delay);
        const delay = Number.isFinite(d) ? d : undefined;
        return new Cannon(s.x, s.y, isCannonDir(dir) ? dir : 'l', period, delay);
      }
      case 'rocky':
        return new RockyWrench(s.x, s.y);
      case 'larry':
        return new Larry(s.x, s.y, typeof s.props?.next === 'string' ? s.props.next : null);
      case 'lift-h':
      case 'lift-v':
      case 'lift-fall':
      case 'lift-up':
      case 'lift-down':
      case 'lift-right': {
        const lift = new Lift(s.type, s.x, s.y, s.props ?? {});
        // A down lift in a live descent shaft carries its rider down into the zone's area.
        if (s.type === 'lift-down')
          lift.descent = this.descents.find((z) => s.x >= z.x && s.x < z.x + z.w)?.target ?? null;
        return lift;
      }
      case 'candle':
        return new Candle(s.x, s.y);
      case 'moblin':
        // He ends the level with his secret: without one (`secret=<key>`) he is left out (and the
        // level library's tests reject such a map).
        if (typeof s.props?.secret !== 'string' || !s.props.secret) {
          console.warn('a moblin needs secret=<key>');
          return null;
        }
        return new Moblin(s.x, s.y, s.props.secret, typeof s.props.next === 'string' ? s.props.next : null);
      case 'cave-fire':
        return new CaveFire(s.x, s.y);
      case 'decor':
        // Any decor kind as a spawned entity (`decor x y kind=items:cave-mouth`): a campaign-only
        // piece of scenery (`campaign=true`) sleeps with the rest outside the campaign.
        return typeof s.props?.kind === 'string' ? new Decoration(s.props.kind, s.x, s.y) : null;
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
    if (x !== undefined && y !== undefined && this.scorePopups) this.spawn(new ScorePopup(x, y, String(n)));
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
    if (this.shakeFrames > 0) this.shakeFrames--;

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
    if (this.trickSpin) return this.updateTrickSpin();
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
      if (this.fallingIn.has(p)) {
        if (p.body.onGround || p.body.y >= px(FALL_IN_STEER_Y)) this.fallingIn.delete(p);
        else input = withoutSteering(input);
      }
      if (this.autoWalk) input = AUTO_WALK_INPUT;
      else if (this.vineArrival && p.vine) input = AUTO_CLIMB_INPUT;
      p.inWater = p.body.y + (p.body.h >> 1) >= this.waterTop;
      this.grabVines(p, input);
      this.grabStairs(p, input);
      const spring = this.springUnder(p);
      if (spring) {
        spring.ride(input.pressed('jump'));
        p.anim = 'jump';
        return;
      }
      p.update(input, this.playerMap(p), this.audio, (tx, ty) => this.hitBlock(tx, ty, p));
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
        this.placeX(p, this.camera.x);
        if (p.body.vx < 0) p.body.vx = 0;
      }
      const rightEdge = Math.min(tileToSub(this.level.width), this.camera.x + px(SCREEN_W));
      // An auto-scroll screen holds everyone inside it (SMB3: no running ahead off the right).
      if (p.body.x + p.body.w > rightEdge && (this.camera.auto || (this.coop && p !== this.rightmost()))) {
        this.placeX(p, rightEdge - p.body.w);
        if (this.camera.auto && p.body.vx > 0) p.body.vx = 0;
      }
      if (p.body.x + p.body.w > tileToSub(this.level.width))
        this.placeX(p, tileToSub(this.level.width) - p.body.w);
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
    this.crackWalls();
    this.snuffCandles();
    for (const [i, p] of this.players.entries()) {
      if (p.dead || p.out) continue;
      this.checkPipes(p, this.autoWalk ? AUTO_WALK_INPUT : (inputs[i] ?? NO_INPUT));
      if (this.pipeAnim) break;
    }
    if (this.tricks.length && !this.pipeAnim && !this.leaving)
      for (let i = 0; i < this.players.length; i++) {
        const p = this.players[i] as Player;
        // A player who is down (or out) starts any push over.
        if (p.dead || p.out) {
          this.trickPush.delete(p);
          continue;
        }
        this.checkTricks(p, inputs[i] ?? NO_INPUT);
        if (this.trickSpin) break;
      }
    if (!this.pipeAnim && !this.leaving && !this.trickSpin) this.checkTeleports();
    this.checkZones();
    this.tickPath();
    this.checkLoops();
    this.flyingCheeps();
    this.flyingBullets();
    if (this.bowserFire && !this.leaving) {
      const lead = this.rightmost();
      if (lead) this.bowserFire.update(this, lead);
    }

    const lead = this.rightmost();
    if (this.camera.auto) this.autoScroll();
    else if (lead) this.camera.follow(lead.body.x, lead.body.y);
    for (const p of this.players) {
      if (p.star === 1) this.audio.playMusic(this.level.music);
      if (toPx(p.body.y) > this.heightPx + 8 && !p.dead && !p.out && !this.leaving) {
        // Carried down a descent shaft by its lift: into the area below, dropping in from above.
        const down = this.descentLift(p);
        if (down?.descent) {
          this.transfer(down.descent, 'fall');
          continue;
        }
        // A sleeping campaign pit (7-3's bridge) kills like any other fall; one with `w` covers
        // only its columns.
        const pit = this.level.zones.find(
          (z): z is Zone & { kind: 'pit' } =>
            z.kind === 'pit' &&
            !z.campaign &&
            p.body.x >= tileToSub(z.x) &&
            (z.w === undefined || p.body.x < tileToSub(z.x + z.w)),
        );
        if (pit) this.transfer(pit.target, 'fall');
        else if (!this.catchFall(p)) this.kill(p);
      }
    }
    this.cull();
  }

  /**
   * An auto-scroll frame (`camera: auto`): the camera moves on, and its left edge pushes every
   * player it catches. One pushed into a solid wall is squashed between the two and dies, as in
   * SMB3 (whatever the assists: there is no way out, as with a pit). The frames the world stands
   * still (pause, a death with no one left, pipes, growing) never get here, so the scroll holds.
   */
  private autoScroll(): void {
    // A transfer under way, or the players still climbing in (a vine or anchor-chain arrival).
    if (this.leaving || this.arriving) return;
    this.camera.scroll();
    for (const p of this.activePlayers()) {
      if (p.body.x >= this.camera.x || p.frozen || p.hidden) continue;
      // Pushed by the screen's edge, a player on stairs is knocked off them and pushed like
      // anyone else (squashed against a wall too).
      p.stairs = null;
      const blocked = this.solidRows(p);
      p.body.x = this.camera.x;
      if (p.body.vx < 0) p.body.vx = 0;
      if (this.squashed(p, blocked)) this.kill(p);
    }
  }

  /** The tile rows (of the side probe's span) in which the body already overlaps a solid tile. */
  private solidRows(p: Player): Set<number> {
    const b = p.body;
    const rows = new Set<number>();
    for (let ty = tileAt(b.y + px(4)); ty <= tileAt(b.y + b.h - px(4)); ty++)
      for (let tx = tileAt(b.x); tx <= tileAt(b.x + b.w - 1); tx++)
        if (this.map.isSolid(tx, ty)) {
          rows.add(ty);
          break;
        }
    return rows;
  }

  /**
   * Pushed by the auto-scroll edge into a wall: a solid tile in the column under the body's
   * leading (right) edge, between 4 px below its top and 4 px above its feet, in a row where the
   * body was not already inside something solid before the push (a ceiling a lift carried it
   * into, a block it grew into, a floor). Only a wall ahead squashes.
   */
  private squashed(p: Player, blocked: Set<number>): boolean {
    const b = p.body;
    const col = tileAt(b.x + b.w - 1);
    for (let ty = tileAt(b.y + px(4)); ty <= tileAt(b.y + b.h - px(4)); ty++)
      if (!blocked.has(ty) && this.map.isSolid(col, ty)) return true;
    return false;
  }

  /** The players are still arriving on the vine (a sky area's climb-in, an anchor chain). */
  get arriving(): boolean {
    return this.vineArrival !== null;
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
      for (const p of this.players) {
        p.stairs = null;
        p.body.x += dx;
      }
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
  private transfer(
    target: { level: string; x: number; y: number },
    mode: 'climb' | 'fall' | 'spin' | 'up',
    chain = false,
  ): void {
    if (this.leaving) return;
    this.leaving = true;
    for (const o of this.players) {
      o.frozen = true;
      o.stairs = null;
      o.body.vx = 0;
      o.body.vy = 0;
    }
    this.events.push({ type: 'pipe', target: { ...target, exitDir: mode, ...(chain ? { chain } : {}) } });
  }

  /** Touching a vine while airborne (or pressing up beside it) grabs it; off the top is the sky link. */
  private grabVines(p: Player, input: InputFrame): void {
    const b = p.body;
    if (p.vine) {
      if (b.y + b.h <= 0) {
        let on: Vine | undefined;
        const z = this.level.zones.find((v): v is Zone & { kind: 'vine' } => {
          if (v.kind !== 'vine') return false;
          on = this.vineBlockAt(v.x, v.y) ?? this.placedVineAt(v.x, v.y);
          return on?.centerX === p.vine?.x;
        });
        if (z) this.transfer(z.target, 'climb', on?.art === 'chain');
        else b.y = -b.h; // nowhere to go: hang at the top
      }
      return;
    }
    if (p.vineLock > 0 || p.dead || p.frozen || p.sliding > 0 || p.stairs) return;
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
        p.stairs = null;
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

  /**
   * Puts `p`'s body at `x` (subpixels): a player on stairs is moved along the flight instead, to
   * where its body's x is `x` (within the flight), so it never floats off the steps.
   */
  private placeX(p: Player, x: number): void {
    const ride = p.stairs;
    if (!ride) {
      p.body.x = x;
      return;
    }
    const cx = x + (p.body.w >> 1);
    ride.pos = Math.max(0, Math.min(ride.line.span, (cx - ride.line.footX) * ride.line.sx));
    placeOnStairs(p, ride);
  }

  /** UP at the foot of a flight of stairs, or DOWN at its top, gets on (entities/objects/stairs.ts). */
  private grabStairs(p: Player, input: InputFrame): void {
    if (p.stairs || p.vine || p.dead || p.frozen || p.stun > 0 || p.sliding > 0 || p.inWater) return;
    if (!input.held('up') && !input.held('down')) return;
    for (const e of this.entities) {
      if (!(e instanceof Stairs) || !e.alive) continue;
      const ride = e.mount(p, input);
      if (ride) return p.getOnStairs(ride);
    }
  }

  private vineBlockAt(tx: number, ty: number): Vine | undefined {
    return this.entities.find(
      (e): e is Vine => e instanceof Vine && e.alive && e.fromBlock?.tx === tx && e.fromBlock.ty === ty,
    );
  }

  /** A placed vine or chain (`vine`/`chain x y`) standing on row `ty` of column `tx`. */
  private placedVineAt(tx: number, ty: number): Vine | undefined {
    return this.entities.find(
      (e): e is Vine => e instanceof Vine && e.alive && !e.fromBlock && e.tx === tx && e.footRow === ty,
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
    if (id === T.CRACKED) {
      // A cracked wall crumbles to a brick-breaking bump, shot or blast; a small hero's bump
      // only jolts it (it stays in the wall: no hop).
      if (breakBricks) this.shatterWall(tx, ty);
      else this.audio.sfx('bump');
      return;
    }
    const { kind, content } = def.block;
    const frame = kind === 'brick' ? 'brick' : 'used';
    if (kind === 'brick' && content === 'none') {
      if (breakBricks) {
        this.map.set(tx, ty, T.AIR);
        this.breakPieces(tx, ty);
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
      case 'flower':
      case 'mushroom':
        // The Top Secret Area: always this item, whatever the hero's power (its onPowerUp gives
        // the hero's own flower or mushroom power).
        this.spawn(new PowerUp(tx, ty, content));
        this.audio.sfx('powerup-appear');
        this.feats.powerBlocks++;
        break;
      case 'egg':
        // A Yoshi egg pops up, wobbles and hatches (objects/yoshi-egg.ts: a 1-up for now).
        this.spawn(new YoshiEgg(tx, ty));
        this.audio.sfx('powerup-appear');
        break;
      case 'path':
        this.layPath(tx, ty);
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
   * A hidden path's block was bumped (a `path` zone whose `block` is this tile): its tiles are
   * queued, left to right, and appear one every PATH_STEP_FRAMES as cloud blocks (one-way cloud
   * ledges for a `oneWay` path; tickPath), each with a soft pop. Only open air becomes cloud; a
   * tile with a player in it waits for him to move.
   */
  private layPath(tx: number, ty: number): void {
    // Every path zone the block names is laid, in map order (2-1's steps back up, then its path).
    let laid = false;
    for (const z of this.level.zones) {
      if (z.kind !== 'path' || z.campaign || z.block.x !== tx || z.block.y !== ty) continue;
      const tile = z.oneWay ? T.CLOUD_LEDGE : T.CLOUD_BLOCK;
      for (let k = 0; k < z.w; k++) this.pathQueue.push({ x: z.x + k, y: z.y, tile });
      laid = true;
    }
    if (!laid) return;
    this.pathT = 0;
    this.audio.sfx('vine');
    this.events.push({ type: 'path' });
  }

  /** Tiles of a bumped hidden path still to appear (layPath), in order. */
  private pathQueue: { x: number; y: number; tile: number }[] = [];
  private pathT = 0;

  /** The next tile of a hidden path appears (layPath) unless a player stands in its cell. */
  private tickPath(): void {
    const next = this.pathQueue[0];
    if (!next || ++this.pathT < PATH_STEP_FRAMES) return;
    const cell = { x: tileToSub(next.x), y: tileToSub(next.y), w: tileToSub(1), h: tileToSub(1) };
    if (this.players.some((p) => !p.dead && !p.out && overlaps(p.body, cell))) return;
    this.pathT = 0;
    this.pathQueue.shift();
    if (this.map.get(next.x, next.y) !== T.AIR) return;
    this.map.set(next.x, next.y, next.tile);
    this.audio.sfx('coin');
  }

  /** Whether a bumped hidden path is still being laid (tests, the bots). */
  get layingPath(): boolean {
    return this.pathQueue.length > 0;
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
    // On stairs a hit never knocks the player off (Castlevania's stairs keep you on them).
    else if (result === 'hurt' && p.def.damage.kind === 'hp' && p.def.damage.knockback && !p.stairs) {
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
    p.stairs = null;
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
      const free = this.assist.infiniteLives || this.livesFree;
      if (others.length && (this.state.lives > 0 || free)) {
        if (!free) this.state.lives--;
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
    p.stairs = null;
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
      // A sleeping pipe (`campaign`, woken only by the campaign variant) is no way in.
      if (z.kind !== 'pipe' || z.campaign) continue;
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
      o.stairs = null;
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
      o.stairs = null;
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
      o.stairs = null;
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
      o.stairs = null;
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
    if (STARRY_SKIES.has(theme)) drawStars(screen, this.camera.pxX);
    const view: View = {
      camX: this.camera.pxX,
      frame: this.frame,
      assets: this.ctx.assets,
      theme,
      reduceFlashing: this.ctx.reduceFlashing,
    };
    // A restyled theme's hall or skyline behind everything (theme-backdrop.ts).
    drawThemeBackdrop(screen, view);
    // A free camera scrolls vertically too: the map is drawn moved up by its y (the backdrop and
    // the castle text stay screen-fixed). Every other level draws straight to the screen.
    let r = screen;
    const shake = this.shakeY;
    if (this.camera.free || shake) {
      if (this.camera.free) view.camY = this.camera.pxY;
      const o = (this.offsetRenderer ??= new OffsetRenderer(screen, 0, 0));
      o.inner = screen;
      o.dy = -(view.camY ?? 0) + shake;
      r = o;
    }
    for (const e of this.entities) if (e.alive && e.layer === 'back') e.render(r, view);
    this.backdrop?.(screen);
    if (this.inPipe) for (const p of this.players) this.renderPlayer(r, view, p);
    renderTiles(r, view, this.map);
    if (this.assist.safetyFloor) this.renderSafetyFloor(r, view);
    for (const e of this.entities) if (e.alive && e.layer === 'main') e.render(r, view);
    if (!this.inPipe) for (const p of [...this.players].reverse()) this.renderPlayer(r, view, p);
    this.renderBeam(r, view);
    for (const e of this.entities) if (e.alive && e.layer === 'front') e.render(r, view);
    this.renderWarpText(r, view);
    this.renderCastleText(screen, view);
  }

  /**
   * Whether an entity or a player is drawn into the screen box (x, y, w, h) (screen px; each
   * sprite taken as its body widened by its sprite offset, 8 px at least): the HUD outlines the
   * text a sprite passes under (HudOptions.covered).
   */
  spriteIn(x: number, y: number, w: number, h: number): boolean {
    const camX = this.camera.pxX;
    const camY = this.camera.free ? this.camera.pxY : 0;
    const hits = (bx: number, by: number, bw: number, bh: number) =>
      bx < x + w && x < bx + bw && by < y + h && y < by + bh;
    for (const e of this.entities) {
      if (!e.alive) continue;
      const b = e.body;
      const ex = toPx(b.x) - camX - e.spriteOffsetX;
      const ey = toPx(b.y) - camY - e.spriteOffsetY;
      const ew = Math.max(8, toPx(b.w) + 2 * e.spriteOffsetX);
      const eh = Math.max(8, toPx(b.h) + e.spriteOffsetY);
      if (hits(ex, ey, ew, eh)) return true;
    }
    for (const p of this.players) {
      if (p.hidden || p.out) continue;
      const b = p.body;
      if (hits(toPx(b.x) - camX, toPx(b.y) - camY, toPx(b.w), toPx(b.h))) return true;
    }
    return false;
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

  /* ---------- Ryu's trick wall (6-2's bonus room, campaign) ---------- */

  /** A trick wall's half turn is playing (a player flipped through, or the arrival). */
  get spinning(): boolean {
    return this.trickSpin !== null;
  }

  /** The panels of this level's trick walls (live and sleeping). */
  get trickWalls(): readonly TrickWall[] {
    return this.tricks;
  }

  /** The panel a `spin` arrival at tile (x, y) steps out of: in the column beside it, on its room side. */
  private trickBeside(x: number, y: number): TrickWall | undefined {
    return this.tricks.find((w) => {
      const z: TrickZone = w.zone;
      return z.x + w.side === x && y >= z.y && y < z.y + z.h;
    });
  }

  /**
   * Pushing into a live panel: a player holding toward it with the body against its face counts
   * up (any hero: standing, jumping, Ryu clinging to it, Samus rolled up in a ball); letting go,
   * or leaving it, starts over. TRICK_PUSH_FRAMES of it spin the panel: everyone freezes (the
   * others hidden, as for a pipe) and the pusher goes through with it.
   */
  private checkTricks(p: Player, input: InputFrame): void {
    let wall: TrickWall | null = null;
    if (!p.frozen && !p.hidden && !p.vine && !p.stairs)
      for (const w of this.tricks)
        if (w.live && w.pushedBy(p, input)) {
          wall = w;
          break;
        }
    const n = wall ? (this.trickPush.get(p) ?? 0) + 1 : 0;
    this.trickPush.set(p, n);
    if (!wall || n < TRICK_PUSH_FRAMES) return;
    this.trickPush.clear();
    for (const o of this.players) {
      o.frozen = true;
      o.stairs = null;
      o.body.vx = 0;
      o.body.vy = 0;
      if (o !== p) o.hidden = true;
    }
    this.trickSpin = { wall, dir: 'out', t: 0 };
  }

  /** The half turn (see trickSpin), with the spin sound as it starts. */
  private updateTrickSpin(): void {
    const s = this.trickSpin as NonNullable<typeof this.trickSpin>;
    s.t++;
    if (s.t === 1) this.audio.sfx(SPIN_SFX);
    s.wall.spinDir = s.dir;
    // Leaving, the panel keeps showing its far face through the hold, until the level changes.
    s.wall.spinT = s.t <= TRICK_SPIN_FRAMES || s.dir === 'out' ? Math.min(s.t, TRICK_SPIN_FRAMES) : null;
    const edgeOn = s.t === TRICK_SPIN_FRAMES >> 1;
    if (s.dir === 'out') {
      if (edgeOn) for (const p of this.players) p.hidden = true;
      if (s.t >= TRICK_SPIN_FRAMES + TRICK_HOLD_FRAMES) {
        this.trickSpin = null;
        // On into the target: a spin arrival, or rising out of its pipe (`exit=up`).
        const to = s.wall.zone.target;
        this.transfer(to, to.exitDir ?? 'spin');
      }
      return;
    }
    if (edgeOn) for (const p of this.players) if (!p.dead && !p.out) p.hidden = false;
    if (s.t >= TRICK_SPIN_FRAMES) {
      this.trickSpin = null;
      s.wall.spinT = null; // at rest again (on the room's own face)
      for (const p of this.players) p.frozen = false;
    }
  }

  /* ---------- The Safety floor assist ---------- */

  /** The Safety floor's rims for this level (AssistOptions.safetyFloor; worked out on first use). */
  get safetyFloor(): SafetyFloor {
    return (this.safety ??= new SafetyFloor(this.map, this.level));
  }

  /**
   * The map `p` moves through: with the Safety floor on, one where every deadly pit has a one-way
   * floor at its rim and lava is solid from above (read each frame, so toggling the assist
   * mid-level takes effect at once). A hero riding a live descent lift (5-4's shaft into the
   * dungeon) sees the plain map: that ride down leads somewhere.
   */
  private playerMap(p: Player): TileMap {
    if (!this.assist.safetyFloor || this.descentLift(p)) return this.map;
    return (this.safetyView ??= this.safetyFloor.view());
  }

  /**
   * A fall out of the level with the Safety floor on that the floor did not catch (a sinking lift
   * carried the hero through it, or the assist came on mid-fall): put him back on the nearest
   * floor instead of killing him. False when the assist is off or the level has no floor.
   */
  private catchFall(p: Player): boolean {
    if (!this.assist.safetyFloor) return false;
    const b = p.body;
    // On screen (the camera's edges would push him back into whatever is off it), else anywhere.
    const tx = tileAt(b.x + (b.w >> 1));
    const spot =
      this.safetyFloor.nearest(
        tx,
        toPx(b.h),
        tileAt(this.camera.x + TILE_SUB - 1),
        tileAt(this.camera.right) - 1,
      ) ?? this.safetyFloor.nearest(tx, toPx(b.h));
    if (!spot) return false;
    p.stairs = null;
    b.x = tileToSub(spot.tx) + ((tileToSub(1) - b.w) >> 1);
    b.y = tileToSub(spot.row) - b.h;
    b.prevBottom = b.y + b.h;
    b.vx = 0;
    b.vy = 0;
    b.onGround = true;
    return true;
  }

  /** The Safety floor's dev visual: a faint dashed line along the floor and over open lava. */
  private renderSafetyFloor(r: Renderer, view: View): void {
    const floor = this.safetyFloor;
    const camPx = view.camX;
    const first = Math.max(0, camPx >> 4);
    const last = Math.min(this.map.width - 1, (camPx + SCREEN_W) >> 4);
    const dash = (tx: number, ty: number) => {
      for (let x = 0; x < 16; x += 8) r.rect(tx * 16 - camPx + x + 2, ty * 16, 4, 1, SAFETY_FLOOR_COLOR);
    };
    for (let tx = first; tx <= last; tx++) {
      const row = floor.rowAt(tx);
      if (row >= 0) dash(tx, row);
      // Lava's surface (the top tile of each pool), unless the rim floor already covers it.
      for (let ty = 0; ty < this.map.height; ty++)
        if (
          this.map.get(tx, ty) === T.LAVA &&
          this.map.get(tx, ty - 1) !== T.LAVA &&
          (row < 0 || row > ty) &&
          floor.at(tx, ty)
        )
          dash(tx, ty);
    }
  }

  /* ---------- Simon's dungeon (5-4, campaign): descent, cracked wall, candles ---------- */

  /** The descent-shaft lift carrying `p` this frame (World.descents; Lift.descent), else null. */
  private descentLift(p: Player): Lift | null {
    if (!this.descents.length) return null;
    // Every rider counts (co-op: Lift.rider holds only the last one it carried): a ridden lift
    // under the body, its feet on the lift's top.
    const b = p.body;
    for (const e of this.entities) {
      if (!(e instanceof Lift) || !e.alive || !e.descent || !e.ridden) continue;
      const l = e.body;
      if (b.x < l.x + l.w && b.x + b.w > l.x && Math.abs(b.y + b.h - l.y) <= px(1)) return e;
    }
    return null;
  }

  /**
   * A fire bar sweeping a live descent shaft's down lift (5-4's at (92, 10) in the campaign) loses
   * balls until its tip clears the lift's span widened by a hero's width each side (no hero is
   * wider than a tile), so a rider whose body overlaps the lift at all, even hanging off either
   * end, is never hit on the long ride down. Other bars, and every bar outside the campaign, keep
   * their length.
   */
  private descentBarLen(tx: number, len: number): number {
    if (!this.descents.length) return len;
    const spans = this.level.entities
      .filter((e) => e.type === 'lift-down' && this.descents.some((z) => e.x >= z.x && e.x < z.x + z.w))
      .map((e) => {
        const x = e.x * 16 + Number(e.props?.dx ?? 0);
        return { x0: x - (MAX_HERO_W - 1), x1: x + Number(e.props?.len ?? 3) * 8 + (MAX_HERO_W - 1) };
      });
    const reaches = (n: number) => spans.some(({ x0, x1 }) => barSweepX(tx, n, x0, x1));
    let n = len;
    while (n > 1 && reaches(n)) n--;
    return n;
  }

  /**
   * Co-op, a fall arrival: player 2's x (px). Beside player 1 (`x1`, `w1`; 20 px right) when that
   * drop is clear, else the nearest spot that is: inside the level, no solid tile in its columns
   * above the row player 1 lands on (a shaft's wall, a ceiling), and outside every fire bar's sweep
   * on the way down (5-4 at 99, back from the crypt: the bar at (103, 11)). 20 px right when none is.
   */
  private fallSpot(x1: number, w1: number, w: number): number {
    const map = this.map;
    const groundRow = (x0: number, x1e: number) => {
      let row = map.height;
      for (let tx = x0 >> 4; tx <= (x1e - 1) >> 4; tx++)
        for (let ty = 0; ty < row; ty++)
          if (map.isSolid(tx, ty)) {
            row = ty;
            break;
          }
      return row;
    };
    const floor = groundRow(x1, x1 + w1);
    const bars = this.level.entities
      .filter((e) => e.type === 'firebar' || e.type === 'firebar-ccw')
      .map((e) => ({ tx: e.x, ty: e.y, n: this.descentBarLen(e.x, Number(e.props?.len ?? 6)) }))
      // Only a bar whose sweep reaches above the landing row can meet the drop.
      .filter((b) => b.ty * 16 + 4 - (b.n - 1) * 8 + 1 < floor * 16);
    const clear = (x: number) =>
      x >= 0 &&
      x + w <= map.width * 16 &&
      groundRow(x, x + w) >= floor &&
      !bars.some((b) => barSweepX(b.tx, b.n, x, x + w));
    for (const d of [20, 16, 12, -20, -16, -12, 8, -8, 4, -4, 0]) if (clear(x1 + d)) return x1 + d;
    return x1 + 20;
  }

  /** Whether a cracked wall still stands in this level. */
  crackedWalls(): boolean {
    return this.cracked > 0;
  }

  /**
   * The cracked wall at (tx, ty) crumbles: it and every cracked tile joined to it (one hit opens
   * the whole doorway) fly apart as rubble, with the wall-crumble sound.
   */
  shatterWall(tx: number, ty: number): void {
    if (this.map.get(tx, ty) !== T.CRACKED) return;
    const todo: [number, number][] = [[tx, ty]];
    while (todo.length) {
      const [x, y] = todo.pop() as [number, number];
      if (this.map.get(x, y) !== T.CRACKED) continue;
      this.map.set(x, y, T.AIR);
      this.cracked--;
      this.breakPieces(x, y, RUBBLE[(x + y) & 1]);
      todo.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    this.addScore(50);
    this.audio.sfx(CRUMBLE_SFX);
    this.shake(8);
  }

  /** The first cracked-wall tile a box (subpixels) touches, else null. */
  private crackedIn(box: { x: number; y: number; w: number; h: number }): [number, number] | null {
    for (let ty = tileAt(box.y); ty <= tileAt(box.y + box.h - 1); ty++)
      for (let tx = tileAt(box.x); tx <= tileAt(box.x + box.w - 1); tx++)
        if (this.map.get(tx, ty) === T.CRACKED) return [tx, ty];
    return null;
  }

  /**
   * Any hero attack breaks a cracked wall it touches: a melee hit (sword, whip, ...), a hero's
   * shot or thrown weapon, or a kicked shell, which plows on through the opening it made. (A
   * blast, or a head bump from a hero who breaks bricks, goes through strikeBlock.)
   */
  private crackWalls(): void {
    if (this.cracked <= 0) return;
    const grow = (b: { x: number; y: number; w: number; h: number }, n = px(2)) => ({
      x: b.x - n,
      y: b.y,
      w: b.w + n * 2,
      h: b.h,
    });
    for (const p of this.activePlayers()) {
      if (!p.activeMelee) continue;
      const at = this.crackedIn(grow(p.activeMelee));
      if (at) this.shatterWall(at[0], at[1]);
    }
    for (const e of this.entities) {
      // Not filtered on `alive`: a shot that hit the wall died in its own update this frame, before
      // this check, and is only culled at the end of the frame; it must still break the wall.
      if (heroShot(e)) {
        const at = this.crackedIn(grow(e.body));
        if (at) this.shatterWall(at[0], at[1]);
      } else if (e instanceof Koopa && e.alive && e.isMovingShell) {
        const b = e.body;
        const at = this.crackedIn(grow(b));
        if (!at) continue;
        this.shatterWall(at[0], at[1]);
        // It bounced off the wall this frame: it keeps going the way it was kicked instead.
        if (b.hitWall !== 0 && Math.sign(b.vx) === -b.hitWall) b.vx = -b.vx;
      }
    }
  }

  /** Wall candles: any hero attack, a kicked shell, or a hero touching one snuffs it for a coin. */
  private snuffCandles(): void {
    for (const c of this.entities) {
      if (!(c instanceof Candle) || !c.alive) continue;
      const hit =
        this.activePlayers().some(
          (p) => overlaps(p.body, c.body) || (p.activeMelee !== null && overlaps(p.activeMelee, c.body)),
        ) ||
        this.entities.some(
          (e) =>
            e.alive && (heroShot(e) || (e instanceof Koopa && e.isMovingShell)) && overlaps(e.body, c.body),
        );
      if (!hit) continue;
      c.snuff();
      if (CANDLE_SFX) this.audio.sfx(CANDLE_SFX);
      this.spawn(new CoinPop(c.body.x, c.body.y));
      this.addCoin();
    }
  }

  /** Tile (tx, ty) flying apart in four pieces, as a broken brick (`pipe-piece`: a smashed pipe). */
  breakPieces(tx: number, ty: number, frame: PieceFrame = 'brick-piece'): void {
    const cx = tileToSub(tx) + px(4);
    const cy = tileToSub(ty) + px(4);
    this.spawn(new BrickPiece(cx, cy, -0x01000, -0x05000, frame));
    this.spawn(new BrickPiece(cx + px(8), cy, 0x01000, -0x05000, frame));
    this.spawn(new BrickPiece(cx, cy + px(8), -0x01000, -0x03000, frame));
    this.spawn(new BrickPiece(cx + px(8), cy + px(8), 0x01000, -0x03000, frame));
  }

  /** Shake the screen for `frames` (drawn only without reduce flashing). */
  shake(frames: number): void {
    this.shakeFrames = Math.max(this.shakeFrames, frames);
  }

  /** The warp zone over column `tx` loses its world numbers and welcome text (pipe smashed). */
  smashWarpAt(tx: number): void {
    for (const z of this.level.zones)
      if (z.kind === 'warp' && tx >= z.x && tx < z.x + z.w) this.smashedWarps.add(z);
  }

  /** The screen's vertical offset this frame (a shake), 0 with reduce flashing. */
  get shakeY(): number {
    if (this.shakeFrames <= 0 || this.ctx.reduceFlashing) return 0;
    return (this.shakeFrames >> 1) & 1 ? 2 : -2;
  }

  private renderWarpText(r: Renderer, view: View): void {
    for (const z of this.level.zones) {
      if (z.kind !== 'warp' || this.smashedWarps.has(z)) continue;
      const x0 = z.x * 16 - view.camX;
      if (x0 > SCREEN_W || x0 + z.w * 16 < 0) continue;
      const font = view.assets.sheet('font');
      if (z.text) r.text(font, z.text, Math.max(8, x0 + 8), 72);
      // The campaign's dead pipe (labelAt) keeps its number until the anchor smashes it.
      const pipes =
        z.labelAt ??
        this.level.zones.filter(
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
