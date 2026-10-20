import { gainCoins } from '../items/wallet';
import type { InputFrame } from '@engine/input/input-manager';
import { worldLabel } from '../hud/world-label';
import { HUD_BOTTOM, SCORE_MAX } from '../hud/hud';
import { fontText, wrapText } from '../hud/text';
import { NO_INPUT } from '@engine/input/input-manager';
import { OffsetRenderer, clipped, translucent, type Renderer } from '@engine/gfx/renderer';
import { overlaps, type AABB } from '@engine/math/aabb';
import { moveX, type Body } from '../entities/body';
import { px, tileAt, tileToSub, TILE_SUB, toPx, velToSub } from '@engine/math/units';
import { Rng } from '@engine/rng';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import type {
  EntitySpawn,
  HeroItemEntry,
  LevelData,
  MapDifficulty,
  PipeDir,
  TransferMode,
  Zone,
} from '../level/schema';
import { isSwimLevel, isWaterTheme } from '../level/schema';
import { tileDef, T, type BlockContent } from '../level/tiles';
import { BOSS_PAN, Camera, DEFAULT_AUTO_SCROLL, SCROLL_BACK_CENTER } from './camera';
import { drawStars, FLOODED, FLOODED_WATER, renderTiles, SKY, STARRY_SKIES } from './tile-render';
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
import { SpikeTop } from '../entities/enemies/spike-top';
import { Barrel, Crab, FireEnemy, Fly, Icicle } from '../entities/enemies/special-enemies';
import { LakituZone } from '../entities/enemies/lakitu';
import { Spiny } from '../entities/enemies/spiny';
import { BulletBill, BulletLauncher, BULLET_SPEED } from '../entities/enemies/bullet-bill';
import { BalanceLift } from '../entities/objects/balance-lift';
import { Princess } from '../entities/objects/princess';
import { Captive } from '../entities/objects/captive';
import { Partner } from '../entities/objects/partner';
import { Fred } from '../entities/objects/fred';
import { Toad } from '../entities/objects/toad';
import { Spring } from '../entities/objects/spring';
import { Vine } from '../entities/objects/vine';
import { placeOnStairs, Stairs, type StairDir } from '../entities/objects/stairs';
import { AnchorDrop } from '../entities/objects/anchor-drop';
import { AnchorScene, type AnchorStory } from './anchor-scene';
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
import { PowerUp, isWorldItem, type HeroPowerUp, type PowerUpKind } from '../entities/objects/powerup';
import { isSpecialItem, takeSpecialItem, type SpecialItem } from './special-items';
import { isPickupKind, Pickup, type PickupKind } from '../entities/objects/pickup';
import { HeroItem } from '../entities/objects/hero-item';
import { applyItem, blockItem, itemRules, itemSfx } from '../items/heroes';
import { heroItems } from '../items/catalog';
import { isFound } from '../items/flags';
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
import { WandBreak, WAND_SCENE_FRAMES } from '../entities/effects/wand-break';
import { WandPoof } from '../entities/effects/wand-poof';
import type { ClassicHitProps, DamageKind, DamageSource, Reaction } from '../rules/damage';
import { classicRules, type BlockHit, type BlockStrike } from '../rules/hooks';
import { shellKickSeqScore, stompScore } from '../rules/score';
import {
  cheatAssist,
  NO_CHEATS,
  rulesOf,
  type CheatFlags,
  type GameContext,
  type GameState,
  type Rules,
} from '../context';
import type { ClassicCheatStat } from '@engine/save/settings';
import type { ClassicSettings } from '@engine/save/original-options';
import { heroFor } from '../characters/registry';
import { layeredLevel, layerFlags } from '../level/layers';
import { HURRY_TIME, SPAWN_MARGIN_PX, TIMER_FRAMES } from '../constants';
import { Decoration } from '../entities/objects/decoration';
import { drawThemeBackdrop } from './theme-backdrop';
import { Lift } from '../entities/objects/lift';
import { Candle, Respawner } from '../entities/objects/crypt';
import {
  KEY_SAID,
  KeyBox,
  KeyItem,
  LockedDoor,
  LockedGate,
  LockedHatch,
  type KeyThing,
} from '../entities/objects/keys';
import {
  TRICK_HOLD_FRAMES,
  TRICK_PUSH_FRAMES,
  TRICK_SPIN_FRAMES,
  TrickWall,
  type TrickZone,
} from '../entities/objects/trick-wall';
import { sfx as SFX_LIB } from '@content/sfx/sfx';
import { Firebar } from '../entities/enemies/firebar';
import { Bowser, trueFormOf, type BowserAttack } from '../entities/enemies/bowser';
import { BowserFire } from './bowser-fire';
import {
  burstPieces,
  DEATH_FRAMES,
  DEATH_SFX,
  renderDeath,
  startDeath,
  stepDeath,
  stepThrow,
  type DeathStyle,
} from './death-style';
import { Axe } from '../entities/objects/axe';
import { CaveFire, Moblin } from '../entities/objects/moblin';
import { YoshiEgg } from '../entities/objects/yoshi-egg';
import { Larry, WAND_BLAST_POINTS, WandBlast } from '../entities/enemies/larry';
import { Gull, ShieldJoe, TellyPort, Telly, Yoku } from '../entities/enemies/wily-sky';
import { CANNON_PERIOD, Cannon, isCannonDir } from '../entities/enemies/cannon';
import { RockyWrench } from '../entities/enemies/rocky-wrench';
import { startHp, type CharacterDef, type SpriteSpec } from '../characters/character';
import { damp } from '../characters/profile';
import { castlePages, REMARK_CASTLES } from '../story/script';
import { endMoved, FINALE } from '../story/finale';
import { CastleUnmask, walkStep } from './unmask';
import { BossBar } from './boss-bar';
import { CostumePile } from '../entities/effects/costume-pile';
import { cardContinues, CARD_GUARD_FRAMES } from '../scenes/message';
import type { Action } from '@engine/input/actions';

/** What goes on from the castle's text (OK): JUMP or ATTACK. MENU still pauses. */
const CASTLE_OK_KEYS: readonly Action[] = ['jump', 'attack'];
/** How long an item's name shows under the HUD when first found (docs/POWERUPS.md 3.3). */
export const ITEM_CAPTION_FRAMES = 120;
/** A HeroItem's entries from the Top Secret Area's fixed grow block (`R`): the grow item for anyone. */
const GROW_BLOCK: Readonly<Record<string, string>> = Object.freeze({});

/**
 * SMB's rule for an item already out of its block (0.4.46, owner #20): a Mega Man whose Helmet a
 * hit knocked off since the block was struck takes the Helmet from it, never a weapon (his weapons
 * come only with the Helmet). His alone (no change for the other heroes: Sophia III knocked to
 * Normal still takes her Crusher). In a found kit (the campaign and training) only.
 */
function growFirst(p: Player, id: string): string {
  if (p.def.id !== 'megaman') return id;
  const rules = itemRules(p.def.id);
  const grow = heroItems(p.def.id)?.grow;
  if (!rules || !grow || id === grow || !isFound(p) || !rules.small(p)) return id;
  return grow;
}

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
  /**
   * Classic rules only: one more of a cheat goal's count (cheats.ts; StatManager's num* setters):
   * an enemy defeated (and an armoured one, a Hammer Bro, a Cheep Cheep), a stomp, a brick broken.
   */
  | { type: 'tally'; stat: ClassicCheatStat }
  /** `player`: index of the player whose death ended the attempt (they pick the next hero). */
  | { type: 'died'; player?: number }
  | { type: 'checkpoint'; x: number; y: number }
  /** The castle maze moved the players from column `from` to `to` (informational). */
  | { type: 'loop'; from: number; to: number }
  /** A player pressed up next to a captive hero (campaign): the level starts the unlock flow. */
  | { type: 'talk'; hero: string; player: number }
  /** A player came within a captive's talking reach (TALK shows for them): announced. */
  | { type: 'captive-near'; hero: string; player: number }
  /** A player pressed up next to a partner (campaign story): the level plays its pages. */
  | { type: 'partner'; who: string; player: number }
  /** A player came within a partner's reach (TALK or READ shows for them): announced. */
  | { type: 'partner-near'; who: string; player: number }
  /**
   * A player touched Larry Koopa's crystal ball (objects/crystal-ball.ts): the level shows its
   * card and ends the area (campaign: 4-2's secret exit; else on to `next`).
   */
  | { type: 'crystal-ball'; player: number; next: string | null }
  /** Larry's anchor smashed 4-2's warp-zone pipe (objects/anchor-drop.ts): the level announces it. */
  | { type: 'anchor'; scene?: boolean }
  /**
   * A player came up to the Moblin in 2-1's hidden cave (objects/moblin.ts): the level plays his
   * cards and ends (campaign: 2-1 cleared and the secret `secret` found; else on to `next`).
   */
  | { type: 'moblin'; player: number; secret: string; next: string | null }
  /** A hidden path's block was bumped (World.layPath): its clouds are being laid. */
  | { type: 'path' }
  /** A line for the screen reader (the campaign's castle pages): the level announces it. */
  | { type: 'say'; text: string }
  /** Player `player` touched a dropped pickup (0.4.46: its one-time explainer, tutorial/explainers.ts). */
  | { type: 'pickup'; item: PickupKind; player: number }
  /** Player `player` took their item `item` for the first time (its one-time explainer, if any). */
  | { type: 'item'; item: string; player: number }
  /**
   * (0.4.52, objects/keys.ts) A player came within reach of the key (`key`), a locked door (`door`),
   * an open one (`open-door`), or a locked gate (or, 0.4.54, 8-1's hatch) untried (`gate`,
   * `hatch`) or tried this visit (`locked`): announced.
   */
  | { type: 'key-near'; what: 'key' | 'door' | 'open-door' | 'gate' | 'hatch' | 'locked'; player: number }
  /** (0.4.52) Player `player` tried hero `hero`'s locked gate (once a visit): its locked card. */
  | { type: 'gate'; hero: string; player: number };

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
  /** Blocks a shot flying through walls bumped (0.4.46: Mega Man's charge shot, Simon's axe). */
  pierced: number;
}

export interface WorldStart {
  /**
   * The rules this World plays by, instead of the context's (TG-14). Mini games and training
   * rooms pass 'current': they are scripted around Current kits.
   */
  rules?: Rules;
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
   * the level's fixed seed (levelSeed). In play LevelScene passes a fresh one for every visit, as
   * the original's Math.random does (GameDeps.freshSeeds, main.ts only); tests keep the fixed one.
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
  /**
   * How a hero dies here (death-style.ts): `hop` (the default) is Mario's jingle and hop, as
   * always; a mini game picks its hero's own NES death (`orbs` Mega Man, `explode` Samus,
   * `collapse` Simon, `ninja` Ryu), each with its own sound. `died` is raised at the end of it.
   */
  deathStyle?: DeathStyle;
  /** The sound a non-hop death makes, in place of its style's own (DEATH_SFX). */
  deathSfx?: string;
  /**
   * Classic SMBC: the stage's areas left so far (World.areaMemory), passed on by a transfer to
   * another area of the same stage. Left out, a Classic World starts a fresh memory (a new
   * stage, a death, a warp: StatManager.resetLevelStats).
   */
  areaMemory?: AreaMemory;
}

/**
 * An area as it was left (StatManager.saveAreaStats: its objects, ground and scenery): the tile
 * map (bricks broken, blocks used, coins taken), the brick hit points and multi-coin blocks, the
 * spawn list's progress and the map's own entities (enemies where and as they were, spawners,
 * lifts) with any items still out.
 */
export interface AreaSnapshot {
  tiles: Uint16Array;
  brickHp: Map<string, number>;
  coinBlocks: Map<string, { left: number; until: number }>;
  spawnIndex: number;
  spawns: EntitySpawn[];
  entities: Entity[];
}

/** Classic SMBC: the areas of one stage left so far, by level id. */
export type AreaMemory = Map<string, AreaSnapshot>;

/** Flying Cheep Cheeps out at once, by map difficulty (FlyingCheepSpawner.as MAX_CHEEP_*). */
export const FLYING_CHEEP_CAP: Readonly<Record<MapDifficulty, number>> = { easy: 2, normal: 3, hard: 4 };

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

/**
 * A tile a Classic weapon (shot or melee) strikes: any block, hidden ones too (BR-C11), but our
 * own hidden teleporter, which keeps today's head-bump-only behaviour.
 */
function weaponStrikable(id: number): boolean {
  const block = tileDef(id).block;
  return !!block && !(block.kind === 'hidden' && block.content === 'teleporter');
}

/** The block a Classic frozen enemy carries (HP-C17): 16x16, left and bottom on its hitbox's. */
function frozenBlock(e: Enemy): AABB {
  const b = e.body;
  return { x: b.x, y: b.y + b.h - px(16), w: px(16), h: px(16) };
}

/**
 * Keeps a player's body out of a solid box that is not on the tile grid (a frozen enemy's block):
 * lands on its top, bumps its underside, stops at its sides (as Spring.block does).
 */
function solidBox(b: Body, s: AABB): void {
  if (!(b.x < s.x + s.w && b.x + b.w > s.x && b.y < s.y + s.h && b.y + b.h > s.y)) return;
  if (b.vy >= 0 && b.prevBottom <= s.y + px(4)) {
    b.y = s.y - b.h;
    b.vy = 0;
    b.onGround = true;
  } else if (b.vy < 0 && b.y - velToSub(b.vy) >= s.y + s.h - px(4)) {
    b.y = s.y + s.h;
    b.vy = 0;
    b.hitHead = true;
  } else if (b.x + b.w / 2 < s.x + s.w / 2) {
    b.x = s.x - b.w;
    if (b.vx > 0) b.vx = 0;
    b.hitWall = 1;
  } else {
    b.x = s.x + s.w;
    if (b.vx < 0) b.vx = 0;
    b.hitWall = -1;
  }
}

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
 * Bouncy Pits (Classic cheat): AnimatedObject.VY_BOUNCY_PITS_DEF -1000 px/s on the original's
 * 32-px tiles, so 500 px/s here: 8.33 px/f. A leaping Cheep Cheep's is CheepFast.FLYING_JUMP_PWR
 * 555 px/s: 4.63 px/f.
 */
const BOUNCY_PIT_VY = 0x08555;
const BOUNCY_PIT_CHEEP_VY = 0x04a00;
/** Water Mode (Classic cheat): the swimming line above the top of any map. */
const WATER_MODE_TOP = px(-1024);
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

export type ClearPhase = 'slide' | 'hop' | 'walk' | 'countdown' | 'flag' | 'done';
/** Frames from UP at an open locked door to the next area (the hero has gone in). */
export const DOOR_TRANSFER_FRAMES = 24;

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

/** `input` without SPECIAL: in reach of someone to talk to, it is the TALK button (0.4.35). */
function withoutSpecial(input: InputFrame): InputFrame {
  return {
    held: (a) => a !== 'special' && input.held(a),
    pressed: (a) => a !== 'special' && input.pressed(a),
    released: (a) => a !== 'special' && input.released(a),
    bufferedJump: (w) => input.bufferedJump(w),
    consumeJumpBuffer: () => input.consumeJumpBuffer(),
    dirX: input.dirX,
  };
}

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

/** px the camera keeps behind a camera anchor (Entity.anchorsCamera: a parked tank). */
const ANCHOR_ROOM = 32;

/** No hero's body is wider than a tile (characters' hitboxes; simon-crypt.test.ts checks). */
const MAX_HERO_W = 16;
/** Points for a drop taken with nothing to fill (World.collectPickup). */
export const PICKUP_FULL_SCORE = 200;

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
  /** The TALK prompt's words over someone in reach (View.talkHint), set by LevelScene. */
  talkHint: ((verb: string) => string) | null = null;
  /** The same with up's key ("UP" over an open door: View.upHint), set by LevelScene. */
  upHint: ((verb: string) => string) | null = null;
  /**
   * (0.4.52, objects/keys.ts) The player carrying this room's key (an index), or null. One key a
   * room, either player; it lasts the visit (a new World is a fresh room).
   */
  keyHolder: number | null = null;
  readonly map: TileMap;
  readonly camera: Camera;
  readonly players: Player[] = [];
  readonly rng: Rng;
  readonly entities: Entity[] = [];
  readonly events: WorldEvent[] = [];
  readonly audio: GameContext['audio'];
  readonly assist: GameContext['assist'];
  /**
   * The rules this World plays by, read once when it is built (TG-13): WorldStart.rules, else
   * the context's. A World never changes rules; a switch shows at the next World.
   */
  readonly rules: Rules;
  /**
   * Classic mode's cheats that are on (cheats.ts, FU-7e): the context's live view in a Classic
   * World, NO_CHEATS in every Current one (so Current play never reads a cheat).
   */
  get cheats(): CheatFlags {
    return this.rules === 'classic' ? (this.ctx.classicCheats ?? NO_CHEATS) : NO_CHEATS;
  }
  /**
   * Extra Checkpoints (Classic cheat): the original's halfway points of the levels whose
   * checkpoint it locks (LOCKED_CP: castles, World 8), added by the cheat's level-load edit.
   */
  readonly cheatCheckpoints: { x: number; y: number }[] = [];
  /**
   * Classic mode's options (GameContext.classic), read once when the World is built: only under
   * Classic rules, else null. Every player of this World carries it (Player.classicOptions).
   */
  readonly classic: ClassicSettings | null;
  frame = 0;
  /** Timer in SMB1 units; null = no timer. */
  time: number | null;
  private timerTick = 0;
  hurryPlayed = false;
  private spawnIndex = 0;
  private spawns: EntitySpawn[];
  /**
   * Classic SMBC: the entities that came from the map's spawn list (fromMap), and, with the
   * scroll-back camera, those parked off screen now instead of despawned. The original keeps
   * every object of an area from its load and only takes it off the stage, still, while it is
   * more than 2 tiles off screen (AnimatedObject.checkStgPos: removeChild, timers stopped); it
   * comes back as it was.
   */
  private readonly fromMap = new WeakSet<Entity>();
  private parked: Entity[] = [];
  /** Classic SMBC: this stage's areas as they were left (see AreaSnapshot); null under Current. */
  readonly areaMemory: AreaMemory | null;
  /** Subpixel y of the water line in water levels; Infinity elsewhere. */
  waterTop = Infinity;
  /** The clock ran out here (the heroes died of it: Classic mode's TIME UP card, G-030). */
  timedOut = false;
  /**
   * Classic SMBC's PitVacuums (G-013), worked out on first use: per column, how its pit pulls
   * (PULL_RIGHT, PULL_DOWN, PULL_LEFT; 0 none), or null in an area that does not start under
   * water (the Water Mode cheat adds none: Level._initialWaterLevel).
   */
  private pitVacuums: Int8Array | null | undefined;
  /** Set once a vine or pit transfer has been queued, so the frame ends quietly. */
  private leaving = false;
  private cheepTimer = 0;
  /** Frames since the lead player last moved right (flying Cheep Cheeps' reverse rule). */
  private cheepNoRight = 0;
  /** Flying-bill respawn timer in frames (0 = stopped) and the one bill it has out. */
  private bulletTimer = 0;
  private flyingBill: Enemy | null = null;
  /** Bowser's long-range flames (`bowser-fire` zone), or null. */
  private readonly bowserFire: BowserFire | null;
  /** Castle maze: lead player's centre x last frame (px) and the loop checkpoints passed. */
  private loopPrevX: number | null = null;
  private readonly loopChecks = new Set<string>();
  private readonly coinBlocks = new Map<string, { left: number; until: number }>();
  /**
   * Classic rules: hit points of plain bricks a weapon has hurt ("x,y"; 125 when absent, BR-C1).
   * Each level or area is a new World, so it starts empty. Current never writes it.
   */
  readonly brickHp = new Map<string, number>();
  /** Scratch for shotBlocks: the block tiles a Classic shot touches this frame. */
  private readonly touchingNow = new Set<string>();
  private clear: {
    phase: ClearPhase;
    t: number;
    pole: Flagpole;
    walkTo: number;
    player: Player;
    /** Fireworks to set off after the tally (1, 3 or 6, else 0): StatManager.touchFlag's HUD time. */
    fireworks: number;
    /** Scroll-back camera: the hero's screen x (centre, subpixels) the walk to the castle keeps. */
    camHold?: number;
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
  /** How far the shake moves the screen (px): 2, or 1 for the anchor scene's gentle one. */
  private shakeAmp = 2;
  /**
   * 4-2's anchor scene, while it is due (LevelScene: the campaign's story, not yet seen on the
   * file): the anchor drop starts it (startAnchorScene) instead of falling on its own.
   */
  anchorStory: AnchorStory | null = null;
  /** The anchor scene running (world/anchor-scene.ts): play holds while it does. */
  anchorScene: AnchorScene | null = null;
  /** Warp zones whose pipe the anchor smashed: their number and welcome text are gone. */
  private readonly smashedWarps = new Set<Zone>();
  private readonly deathTimers = new Map<Player, number>();
  /** Players whose CharacterDef.deathHop death began below the screen (a pit: no hop). */
  private readonly pitDeaths = new Set<Player>();
  /** Thrown deaths (CharacterDef.deathThrow): the frame he landed (null while in the air). */
  private readonly throwDeaths = new Map<Player, { landed: number | null }>();
  private readonly respawnTimers = new Map<Player, number>();
  /** Players still in a fall arrival's straight drop (FALL_IN_STEER_Y): no steering yet. */
  private readonly fallingIn = new Set<Player>();
  /** The column of the last checkpoint sent (World.checkZones); a map may hold several. */
  private lastCheckpointX = -Infinity;
  /** A section's own tune (a `music` zone passed, story only), else null: the level's. */
  sectionMusic: string | null = null;

  /** The tune playing here: the section's (a `music` zone passed), else the level's. */
  get music(): string {
    return this.sectionMusic ?? this.level.music;
  }
  /**
   * The campaign's fake Bowser unmasking before the axe (0.4.23, world/unmask.ts): play holds while
   * it runs; then the axe drops the bridge as usual.
   */
  unmask: CastleUnmask | null = null;
  /** The Bowser bar (0.4.47, campaign only): his hit points while his fight is on (boss-bar.ts). */
  readonly bossBar = new BossBar();
  /**
   * Set by LevelScene in the campaign: shows the hero's remark at castle `level`'s axe if it is
   * due (story/castle-remark.ts) and returns true, calling `done` when the card closes; false when
   * there is none (the hero just looks a moment).
   */
  remarkHook: ((level: string, hero: Player['def'], done: () => void) => boolean) | null = null;
  /** Set when Bowser's bridge is cut; freezes everything but the axe sequence. */
  bossClear: {
    t: number;
    stop?: number;
    page?: number;
    at?: number;
    coast?: number;
    /** Scroll-back camera: the hero's screen x (centre) the walk to Toad keeps (keepPlayerOnRight). */
    camRight?: number;
  } | null = null;
  /**
   * Scroll-back camera: the camera's own end, while the axe's tighter one holds it
   * (Level.screenMaxRightScroll from bowserAxe until the axe is taken); null otherwise.
   */
  private preAxeMaxX: number | null = null;
  /** The castle-clear message shown over the level (Toad's thanks), one entry per text row. */
  castleText: string[] = [];
  /**
   * The castle's text is up and waits for OK (JUMP or ATTACK, any player) to show its next page
   * or to exit: text never moves on by itself (owner note 4). True once the card guard is over,
   * when LevelScene draws the OK prompt under the text.
   */
  get castleWaiting(): boolean {
    const c = this.bossClear;
    if (!c || c.stop === undefined || c.at === undefined) return false;
    return c.t - c.stop - c.at > CARD_GUARD_FRAMES;
  }
  /** Drawn behind the tiles and sprites (the ending's credits, which the original adds under the level). */
  backdrop: ((r: Renderer) => void) | null = null;
  /** Level intro that walks the player into a pipe (1-2 style) ignoring input. */
  autoWalk = false;
  readonly flagpole: Flagpole | null = null;
  /** Set by LevelScene in campaign play; see CaptiveRules. */
  captives: CaptiveRules | null = null;
  /**
   * The campaign's hero items (docs/POWERUPS.md): the level's `[hero-items]` entries by "x,y"
   * (LevelScene.useHeroItems). Null outside the campaign, where blocks give SMB's mushroom and
   * flower as today.
   */
  heroItems: Map<string, Readonly<Record<string, string>>> | null = null;
  /** An item just found: its name, shown under the HUD for ITEM_CAPTION_FRAMES (LevelScene). */
  itemCaption: { text: string; t: number } | null = null;
  /**
   * The campaign's story plays here (set by LevelScene when story/beats.ts storyOn holds): off in
   * classic, dev, arena and play-test levels, which keep their old text and behaviour.
   */
  storyMode = false;
  /**
   * A Classic mode run (set by LevelScene from Game.classicCastle, G-001/G-002): an exit marked
   * `next=end` (Lost Levels 8-4's castle, 9-4's flag) leads on to `next`, a castle with Toad's
   * "another castle" news; with `next` null the castle is the map set's last and says the quest
   * is over (Lost Levels D-4 too, as SMB 8-4). Null elsewhere: the Lost Levels' 8-4, 9-4 and D-4
   * keep the NES rules, their castles saying nothing (the endings' cards do).
   */
  classicEnd: { next: string | null } | null = null;
  /** The exploding bridge's boom (entities/objects/bridge-blast.ts). */
  readonly bridgeBoomSfx = BRIDGE_BOOM_SFX;
  /** What the players have done here so far (the tutorial's lessons read it, src/game/tutorial). */
  readonly feats: WorldFeats = { stomps: 0, coinBlocks: 0, powerBlocks: 0, bricks: 0, pierced: 0 };
  /**
   * The enemy each player stands on (CharacterDef.standsOnEnemies, Classic Peach's riding) and
   * where it was when last ridden. Empty unless a def sets standsOnEnemies.
   */
  private readonly rides = new Map<Player, { e: Enemy; x: number }>();
  /** A free camera's renderer (the screen moved up by the camera's y), reused each frame. */
  private offsetRenderer: OffsetRenderer | null = null;
  /** The map's height in px (240, one screen, unless a `camera: free` map is taller). */
  readonly heightPx: number;
  /** Co-op respawns cost no shared life (Larry's airship challenge: deaths there are free). */
  livesFree = false;
  /** WorldStart.extraEntities: a mini game's own entity types. */
  private readonly extraEntities: WorldStart['extraEntities'];
  /** WorldStart.deathStyle: how a hero dies here (`hop`, Mario's, unless a mini game picks one). */
  readonly deathStyle: DeathStyle;
  private readonly deathSfx: string | null;
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

  /**
   * The area being played. Under Classic rules, as the original builds it for the run's map
   * difficulty and the heroes' level flags (G-006, G-010-G-012: level/layers.ts); else the
   * level as given.
   */
  readonly level: LevelData;
  /** Blocks holding another item than their tile's (`block-item` spawns), by "x,y". */
  private readonly blockItems = new Map<string, BlockContent>();
  /** Classic mode's Map Difficulty for this World (GameContext.mapDifficulty; Normal under Current). */
  readonly mapDifficulty: MapDifficulty;

  constructor(
    level: LevelData,
    readonly ctx: GameContext,
    readonly state: GameState,
    start: WorldStart = {},
  ) {
    this.audio = ctx.audio;
    this.rules = start.rules ?? rulesOf(ctx);
    this.mapDifficulty = this.rules === 'classic' ? (ctx.mapDifficulty ?? 'normal') : 'normal';
    if (this.rules === 'classic') {
      const heroes = [state.character, ...(state.character2 ? [state.character2] : [])];
      level = layeredLevel(level, {
        difficulty: this.mapDifficulty,
        flags: layerFlags(heroes.map((d) => heroFor(d, 'classic'))),
      });
    }
    this.level = level;
    // Classic mode's Infinite Lives, Infinite Time and Invincible cheats are the assists' own
    // (cheatAssist); a Current World has the context's assists as they are.
    this.assist = this.rules === 'classic' ? cheatAssist(ctx.assist, () => this.cheats) : ctx.assist;
    this.classic = this.rules === 'classic' ? (ctx.classic ?? null) : null;
    this.extraEntities = start.extraEntities;
    this.deathStyle = start.deathStyle ?? 'hop';
    this.deathSfx = this.deathStyle === 'hop' ? null : (start.deathSfx ?? DEATH_SFX[this.deathStyle]);
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
    // Classic SMBC: SMBC 3.1.21's default camera scrolls back left (Cheats.classicScreenScroll
    // off). Free, locked and auto-scroll cameras keep their own rules.
    // The Classic Screen Scroll cheat turns that off (Level.changeScreenScrollsLeftSetting).
    this.camera.scrollBack =
      this.rules === 'classic' &&
      !this.cheats.classicScreenScroll &&
      !this.camera.free &&
      !this.camera.locked &&
      !this.camera.auto;
    this.areaMemory = this.rules === 'classic' ? (start.areaMemory ?? new Map()) : null;
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
    // `block-item x y item=...` (the Classic layers' Hudson Bee and lone Clocks, G-023): no
    // entity; the block at x y holds that item instead of its own (bumpBlock).
    for (const s of this.spawns)
      if (s.type === 'block-item' && typeof s.props?.item === 'string')
        this.blockItems.set(`${s.x},${s.y}`, s.props.item as BlockContent);
    this.spawns = this.spawns.filter((s) => s.type !== 'block-item');
    // Stairs are scenery spanning several columns (a `ul` flight reaches left of its x): built
    // with the world, never despawned.
    for (const st of this.spawns.filter((e) => e.type === 'stairs')) {
      const e = this.makeEntity(st);
      if (e) this.entities.push(e);
    }
    this.spawns = this.spawns.filter((e) => e.type !== 'stairs');
    this.bowserFire = BowserFire.forLevel(level);
    // The state holds the roster (Current) defs; the players play the defs for these rules (TG-19).
    const defs: [CharacterDef, string, number][] = [
      [heroFor(state.character, this.rules), state.powerState, state.hp],
    ];
    if (state.character2) defs.push([heroFor(state.character2, this.rules), state.powerState2, state.hp2]);
    defs.forEach(([def, power, hp], i) => {
      const tmp = new Player(0, 0, def, power, hp);
      const hb = def.hitbox(tmp);
      const feet = tileToSub(sy + 1);
      const p = new Player(
        tileToSub(sx) + (px(16 - hb.w) >> 1) + px(i * 20),
        feet - px(hb.h),
        def,
        power,
        hp,
      );
      p.profile = { ...def.movement, coyoteFrames: ctx.assist.coyoteFrames };
      p.index = i;
      p.classicOptions = this.classic;
      Object.assign(p.scratch, i === 0 ? state.kit : state.kit2);
      if (mode === 'fall') {
        p.body.y = px(-32) - px(i * 24);
        this.fallingIn.add(p);
        // Co-op: player 2 drops in beside player 1 where that drop is clear (fallSpot).
        const first = this.players[0];
        if (first) {
          const x = this.fallSpot(toPx(first.body.x), toPx(first.body.w), hb.w);
          // No clear drop beside player 1 for a wide body (a one-tile gap): fit through it.
          if (x === null && hb.w > 16 && def.behaviour.narrowFall) {
            const tx = tileAt(first.body.x + (first.body.w >> 1));
            def.behaviour.narrowFall(p, tx, this.gapLip(tx));
          } else p.body.x = px(x ?? toPx(first.body.x) + 20);
        } else if (hb.w > 16) {
          const x = this.wideFall(sx, p.body.x, p.body.w);
          if (x !== null) p.body.x = x;
          else def.behaviour.narrowFall?.(p, sx, this.gapLip(sx));
        }
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
        p.body.x = tileToSub(sx) + (px(16 - hb.w) >> 1) + side * px(i * 20);
        p.facing = side;
        if (wall) {
          p.frozen = true;
          p.hidden = true;
          this.trickSpin ??= { wall, dir: 'in', t: 0 };
        }
      } else if (mode === 'autowalk') this.autoWalk = true;
      // A body wider than a tile standing at its start (Sophia III's tank): centred on the start
      // column unless that clips a wall beside it; then flush with the column's clear side.
      // (A fall picks its column in wideFall; a pipe exit is two tiles wide; a vine is open air.)
      const standing = mode === 'stand' || mode === 'autowalk' || mode === 'spin' || mode === 'beam';
      if (hb.w > 16 && standing) {
        const b = p.body;
        const clear = (x: number) => {
          for (let ty = tileAt(b.y); ty <= tileAt(b.y + b.h - 1); ty++)
            for (let tx = tileAt(x); tx <= tileAt(x + b.w - 1); tx++)
              if (this.map.isSolid(tx, ty)) return false;
          return true;
        };
        // Player 2 (beside player 1) tries its own spot first, then player 1's column.
        const fit = [b.x, tileToSub(sx), tileToSub(sx + 1) - b.w, b.x - px(i * 20)].find(clear);
        if (fit !== undefined) b.x = fit;
      }
      this.players.push(p);
    });
    // An intro is a cutscene (Level.as watchModeOverride: tsTxt.hideTime()): no clock runs, and
    // the main area after it starts its own.
    if (this.autoWalk) this.time = null;
    // Scroll-back camera: while the castle's axe is there the screen ends just past it
    // (Level.screenMaxRightScroll = bowserAxe.x + width/2 + BOWSER_AXE_SCREEN_SCROLL_OFFSET - SCREEN_WIDTH).
    // A hero with its own scroll (Vic Viper, heroScrollEnd) keeps its own axe end.
    const ownScroll = this.players.some((p) => p.def.autoScroll);
    const axeAt =
      this.camera.scrollBack && !ownScroll ? level.entities.find((e) => e.type === 'axe') : undefined;
    if (axeAt) {
      this.preAxeMaxX = this.camera.maxX;
      this.camera.maxX = Math.max(0, Math.min(this.camera.maxX, px(axeAt.x * 16 + 8 + 4 - SCREEN_W)));
    }
    this.camera.snapTo(this.player.body.x, this.player.body.y);
    this.alignBeam();
    // Level.destroyNearbyEnemies: every enemy of the area (spawned or not) within 6 tiles of
    // the player goes, measured from its cell's centre. A pipe or pit arrival measures from the
    // transporter at the right edge of the start cell (the pipe's middle; pitTransferEnd is
    // shiftRight), a checkpoint from the player's centre. Fire bars and lava balls are
    // projectiles there (FireBar, LavaFireBall), not enemies.
    const clearX0 = mode === 'pipe-exit' || mode === 'fall' ? tileToSub(sx + 1) : this.player.centerX;
    const keepPiranhas = start.clearEnemies === 'keep-piranhas';
    const cleared = (e: Entity | null): boolean => {
      const enemy = e instanceof Enemy && !(e instanceof Firebar) && !(e instanceof Podoboo);
      return enemy && !(keepPiranhas && e instanceof Piranha);
    };
    const keepSpawn = (s: EntitySpawn): boolean => {
      const cx = tileToSub(s.x) + px(8 + Number(s.props?.dx ?? 0));
      return Math.abs(cx - clearX0) >= px(ENEMY_REMOVAL_PX) || !cleared(this.makeEntity(s));
    };
    if (start.clearEnemies) this.spawns = this.spawns.filter(keepSpawn);
    // Water levels (any swimming theme, or a map's `swim: true`): everything from the first row of
    // wave tiles down is swimmable.
    if (isSwimLevel(level)) {
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
    // Per-rules level variants (TG-45): Classic SMBC's cells (2-2's and 7-2's stepping stones for
    // floor jumpers, SW-C12; wide heroes' shafts, SO-48). Under Current the map is the level's own.
    if (this.rules === 'classic') {
      classicRules().levelEdits(
        this.map,
        level.id,
        this.players.map((p) => p.def),
        this.spawns,
        this.classic,
        this,
      );
      // The Classic Yoshi mount's egg block and carried rider (YM-5, YM-7; nothing when it is off).
      classicRules().worldLoaded?.(this);
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
    // Classic SMBC: an area left earlier in this stage comes back as it was left
    // (Level.rebuildLevel), and the arrival still clears the enemies near it.
    const snap = this.areaMemory?.get(level.id);
    if (snap) {
      this.map.tiles.set(snap.tiles);
      this.cracked = 0;
      for (const id of this.map.tiles) if (id === T.CRACKED) this.cracked++;
      for (const [k, v] of snap.brickHp) this.brickHp.set(k, v);
      for (const [k, c] of snap.coinBlocks) this.coinBlocks.set(k, { ...c });
      this.spawnIndex = snap.spawnIndex;
      const rest = snap.spawns.slice(snap.spawnIndex);
      this.spawns = [
        ...snap.spawns.slice(0, snap.spawnIndex),
        ...(start.clearEnemies ? rest.filter(keepSpawn) : rest),
      ];
      for (const e of snap.entities) {
        if (
          start.clearEnemies &&
          cleared(e) &&
          Math.abs(e.body.x + (e.body.w >> 1) - clearX0) < px(ENEMY_REMOVAL_PX)
        )
          continue;
        if (!(e instanceof Pickup || e instanceof PowerUp)) this.fromMap.add(e);
        if (this.camera.scrollBack && this.fromMap.has(e) && e.despawnMargin !== null && this.outOfReach(e))
          this.parked.push(e);
        else this.entities.push(e);
      }
      this.areaMemory?.delete(level.id);
    }
  }

  /**
   * Classic SMBC (StatManager.saveAreaStats, on Level.loadArea): keeps this area as it is now for
   * a later return within the stage. The map's entities still alive (parked ones too) and items
   * still out are kept; everything else (projectiles, effects, Lakitu, flying fish, bullets)
   * goes, as the original destroys them on leaving.
   */
  rememberArea(): void {
    if (!this.areaMemory) return;
    const kept: Entity[] = [];
    for (const e of [...this.entities, ...this.parked]) {
      if (!e.alive) continue;
      if (this.fromMap.has(e) || e instanceof Pickup || e instanceof PowerUp) kept.push(e);
      else e.destroy();
    }
    const coinBlocks = new Map<string, { left: number; until: number }>();
    // Timers count on from the new World's first frame.
    for (const [k, c] of this.coinBlocks) coinBlocks.set(k, { left: c.left, until: c.until - this.frame });
    this.areaMemory.set(this.level.id, {
      tiles: new Uint16Array(this.map.tiles),
      brickHp: new Map(this.brickHp),
      coinBlocks,
      spawnIndex: this.spawnIndex,
      spawns: this.spawns,
      entities: kept,
    });
  }

  /** The player who touched the flagpole (its level-clear sequence is running), else null. */
  get flagGrabbedBy(): Player | null {
    return this.clear?.player ?? null;
  }

  /** The flagpole's level-clear sequence's phase ('slide', 'hop', 'walk', ...), else null. */
  get clearPhase(): ClearPhase | null {
    return this.clear?.phase ?? null;
  }

  /** Player 1 (also what enemies and the camera use as the primary target in solo play). */
  get player(): Player {
    return this.players[0] as Player;
  }

  get coop(): boolean {
    return this.players.length > 1;
  }

  /**
   * (0.4.53) Someone can act now: a player is still in the level, and play is not held for a
   * pipe, a beam, a trick wall's spin, a clear, a boss's end, an anchor scene or the way out.
   * The TALK prompts show only then (View.prompts; INT52 QA: OPEN stayed up over a dying hero).
   */
  get inControl(): boolean {
    if (this.clear || this.unmask || this.bossClear || this.anchorScene || this.leaving) return false;
    if (this.pipeAnim || this.pipeExit || this.beam || this.trickSpin) return false;
    return this.activePlayers().length > 0;
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
    this.spawnUpTo(this.camera.right + px(SPAWN_MARGIN_PX));
  }

  /** Spawns the map's entities not spawned yet whose column starts at or before `limit` (sub-px). */
  private spawnUpTo(limit: number): void {
    while (this.spawnIndex < this.spawns.length) {
      const s = this.spawns[this.spawnIndex] as EntitySpawn;
      if (tileToSub(s.x) > limit) break;
      this.spawnIndex++;
      const e = this.makeEntity(s);
      if (!e) continue;
      this.entities.push(e);
      if (this.areaMemory) this.fromMap.add(e);
      // Classic: an enemy's hit points are picked as it spawns (HP-C4: Bowser's from player 1's hero).
      if (this.rules === 'classic' && e instanceof Enemy) classicRules().enemySpawned(e, this);
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
      // Feet on the spawn tile's bottom: the 16 px box (KOOPA_H) fills the tile; the sprite
      // reaches 8 px above it as before.
      case 'koopa-green':
        return new Koopa(x + px(2), y, 'green');
      case 'koopa-red':
        return new Koopa(x + px(2), y, 'red');
      case 'koopa-para-green':
        return new Koopa(x + px(2), y, 'green', true);
      case 'koopa-para-red':
        return new Koopa(x + px(2), y, 'red', true);
      case 'koopa-para-green-h':
        return new Koopa(x + px(2), y, 'green', true, true);
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
      // Classic mode's Replace Goombas: Spike Top (rules/classic-goombas.ts).
      case 'spike-top':
        return new SpikeTop(x + px(2), y + px(2));
      // Super Mario Bros. Special's enemies (G-021; entities/enemies/special-enemies.ts).
      case 'icicle':
        return new Icicle(x + px(3), y + px(1), s.x, s.y);
      case 'crab':
        return new Crab(x + px(2), y + px(2));
      case 'fly':
        return new Fly(x + px(2), y + px(2));
      case 'barrel':
        return new Barrel(x + px(2), y + px(2));
      case 'fire-enemy':
        return new FireEnemy(x + px(2), y + px(2));
      case 'bullet-bill':
        return new BulletBill(x + px(1), y + px(2), -1);
      case 'lakitu':
        return new LakituZone(s.x, s.y, Number(s.props?.end ?? this.level.width), Boolean(s.props?.mid));
      case 'balance':
        return new BalanceLift(s.x, s.y, s.props ?? {});
      case 'princess':
        // A Classic mode run's ordinary castle (classicEnd, G-002): Toad waits, as in the
        // original's data (the converter put the NES princess in Lost Levels 8-4).
        if (this.classicEnd?.next) return new Toad(s.x, s.y);
        return new Princess(s.x, s.y, this.player.def.endingGreeter ?? null);
      case 'toad':
        return new Toad(s.x, s.y);
      case 'captive': {
        // Campaign only, and only until that hero is freed on the file.
        const id = String(s.props?.hero ?? '');
        const hero = this.captives?.hero(id);
        if (!hero || this.captives?.isFreed(id)) return null;
        return new Captive(s.x, s.y, hero);
      }
      case 'partner':
        // A campaign story partner (`partner x y who=<id>`): only while the story plays (and
        // not once it has left: Fred, after Sophia III is freed).
        return this.storyMode
          ? Partner.create(s.x, s.y, String(s.props?.who ?? ''), Number(s.props?.dx ?? 0), (id) =>
              Boolean(this.captives?.isFreed(id)),
            )
          : null;
      // Keys and locked doors (0.4.52, objects/keys.ts): the story's only (classic keeps the brick).
      case 'key-box':
        return this.storyMode
          ? new KeyBox(s.x, s.y, String(s.props?.hero ?? ''), s.props?.out === 'down' ? 'down' : 'up')
          : null;
      case 'locked-door': {
        if (!this.storyMode) return null;
        const hero = String(s.props?.hero ?? '');
        const to = s.props?.to;
        const target =
          typeof to === 'string' && to
            ? { level: to, x: Number(s.props?.tx ?? 0), y: Number(s.props?.ty ?? 0) }
            : null;
        const look = s.props?.look === 'vault' ? 'vault' : 'crypt';
        return new LockedDoor(s.x, s.y, hero, target, Boolean(this.captives?.isFreed(hero)), look);
      }
      case 'locked-gate': {
        if (!this.storyMode) return null;
        const hero = String(s.props?.hero ?? '');
        return new LockedGate(s.x, s.y, hero, Boolean(this.captives?.isFreed(hero)));
      }
      // 0.4.54: 8-1's steel hatch by the start (Sophia III's hole), a locked gate laid flat.
      case 'locked-hatch': {
        if (!this.storyMode) return null;
        const hero = String(s.props?.hero ?? '');
        return new LockedHatch(s.x, s.y, hero, Boolean(this.captives?.isFreed(hero)));
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
        return new Larry(s.x, s.y, typeof s.props?.next === 'string' ? s.props.next : null, this.megamanShip);
      // Mega Man's airship, the Wily-sky remix (0.4.39, entities/enemies/wily-sky.ts).
      case 'telly-port':
        return new TellyPort(s.x, s.y);
      case 'telly':
        return new Telly(x + px(8), y + px(8));
      case 'gull':
        return new Gull(x, y);
      case 'shield-joe':
        return new ShieldJoe(x, y);
      case 'yoku':
        return new Yoku(s.x, s.y, s.props ?? {});
      // A pickup laid by the map (`pickup x y item=<kind>`, standing in cell x y): Mega Man's
      // large health pellet before his airship's stern pipe (0.4.39).
      case 'pickup':
        return isPickupKind(s.props?.item) ? new Pickup(x + px(8), y + px(16), s.props.item, true) : null;
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
      case 'fred':
        // Jason's frog on Sophia III's route under 8-4 (objects/fred.ts): scenery that leads.
        return Fred.create(s.x, s.y, s.props);
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
    if (this.rules === 'classic') {
      this.tally('enemiesDefeated');
      if (classicRules().armoured(e)) this.tally('armouredDefeated');
      if (e instanceof HammerBro) this.tally('hammerBrosDefeated');
      // StatManager.numCheepCheepsDefeated: every Cheep Cheep (CheepFast.die, outside `if (flying)`).
      if (e instanceof Cheep) this.tally('cheepsDefeated');
    }
    let killer: Player | null = null;
    const o = src.owner;
    if (o instanceof Player) killer = o;
    else if (o instanceof Projectile && o.owner instanceof Player) killer = o.owner;
    if (!killer) killer = this.nearestPlayer(e.body.x);
    const kind = killer.def.drop?.(this.rng, e, killer);
    if (!kind) return;
    const drop = new Pickup(e.body.x + (e.body.w >> 1), e.body.y + e.body.h, kind);
    if (this.megamanShip) this.placeDrop(drop);
    this.spawn(drop);
  }

  /** Classic rules: one more of a cheat goal's count (the level passes it on: Game.cheatTally). */
  private tally(stat: ClassicCheatStat): void {
    if (this.rules === 'classic') this.events.push({ type: 'tally', stat });
  }

  /**
   * Bouncy Pits (Classic cheat; Character.die with fellInPit, AnimatedObject.activateBouncyPit):
   * a player falling out of the bottom is thrown back up, feet half a body below the bottom, at
   * the original's 1000 px/s. False when the cheat is off.
   */
  private bouncePlayer(p: Player): boolean {
    if (!this.cheats.bouncyPits) return false;
    const b = p.body;
    b.y = px(this.heightPx) - (b.h >> 1);
    b.vy = -BOUNCY_PIT_VY;
    b.onGround = false;
    return true;
  }

  /**
   * Bouncy Pits for an enemy (AnimatedObject.checkStgPos): falling past the bottom, its feet go
   * back to the bottom edge and it is thrown up (a leaping Cheep Cheep at its own jump, 555 px/s;
   * a flying Paratroopa never).
   */
  private bounceEnemy(e: Enemy): void {
    const b = e.body;
    if (b.vy < 0 || b.y + b.h <= px(this.heightPx)) return;
    if (e instanceof Koopa && e.wings) return;
    b.y = px(this.heightPx) - b.h;
    b.vy = -(e instanceof Cheep && e.flying ? BOUNCY_PIT_CHEEP_VY : BOUNCY_PIT_VY);
    b.onGround = false;
  }

  /**
   * Water Mode (Classic cheat; Level.forceWaterLevel / forceNonwaterLevel): every row of the area
   * swims, or the area's own water again. A water level stays one either way.
   */
  setWaterMode(on: boolean): void {
    this.dryWaterTop ??= this.waterTop;
    this.waterTop = on ? WATER_MODE_TOP : this.dryWaterTop;
  }

  /**
   * Special's Wing (G-022; Character.as 1655-1665, Level.forceWaterLevel): the area swims for
   * `frames` (a new Wing starts the time again), then dries unless it is a water area or the
   * Water Mode cheat is on (wingTimerHandler: `!level.initialWaterLevel && !Cheats.waterMode`).
   */
  wingSwim(frames: number): void {
    this.setWaterMode(true);
    this.wingFrames = frames;
  }
  /** Frames of a Wing's swim left (0: none). */
  wingFrames = 0;

  private tickWing(): void {
    if (this.wingFrames <= 0 || --this.wingFrames > 0) return;
    if (!this.cheats.waterMode) this.setWaterMode(false);
  }
  /** The area's own water line, kept while Water Mode floods it. */
  private dryWaterTop: number | undefined;

  /**
   * Mega Man's airship (0.4.39: the level laid with his `[variant megaman]` sections, level/
   * variants.ts): his own rules there. Cannons take buster hits, Larry has a hit-point bar, his
   * wand blasts can be shot down, and every drop lands where it can be collected.
   */
  get megamanShip(): boolean {
    return this.level.heroVariants?.includes('megaman') === true;
  }

  /**
   * A drop on Mega Man's airship is always collectible: one over open air (a gap, the sky under
   * the hull) or too near the scrolling screen's left edge moves to the nearest column on screen
   * with a deck under it, and one inside a wall comes out on top of it.
   */
  placeDrop(drop: Pickup): void {
    const b = drop.body;
    const cam = this.camera;
    const first = tileAt(cam.x) + 2;
    const last = tileAt(cam.right) - 1;
    const row = Math.max(0, Math.min(this.level.height - 1, tileAt(b.y)));
    /** The first solid row at or below `row` in column `col`, or null. */
    const ground = (col: number): number | null => {
      for (let y = row; y < this.level.height; y++) if (this.map.isSolid(col, y)) return y;
      return null;
    };
    const col0 = Math.max(first, Math.min(last, tileAt(b.x + (b.w >> 1))));
    for (let d = 0; d <= last - first; d++)
      for (const col of d === 0 ? [col0] : [col0 + d, col0 - d]) {
        if (col < first || col > last) continue;
        let g = ground(col);
        if (g === null) continue;
        // Inside a wall: on top of it instead.
        while (g > 0 && this.map.isSolid(col, g - 1)) g--;
        b.x = tileToSub(col) + px(8) - (b.w >> 1);
        if (b.y + b.h > tileToSub(g)) b.y = tileToSub(g) - b.h;
        return;
      }
  }

  /** A bomb blast centred at (cx, cy) in subpixels: hurts everything in the square, opens blocks. */
  explode(
    cx: number,
    cy: number,
    radiusPx: number,
    owner: Player | null,
    opts: {
      hurtsPlayers?: boolean;
      amount?: number;
      small?: boolean;
      /** Classic rules: the blast's pierce, hit-stun and flash (HP-C16). */
      classicHit?: ClassicHitProps;
    } = {},
  ): void {
    const r = px(radiusPx);
    const box = { x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
    this.spawn(new Explosion(cx, cy, opts.small ?? false));
    this.audio.sfx(opts.small ? 'bump' : 'explosion');
    for (const e of this.enemies) {
      if (!overlaps(box, e.body)) continue;
      const res = e.hit(
        { kind: 'bomb', amount: opts.amount ?? 2, owner, dirX: e.body.x < cx ? -1 : 1, ...opts.classicHit },
        this,
      );
      this.scoreKill(e, 'bomb', res);
      if (res === 'hp') this.audio.sfx('hurt-enemy');
    }
    if (opts.hurtsPlayers ?? true) {
      for (const p of this.activePlayers()) {
        if (overlaps(box, p.hurtBody())) this.hurtPlayer(p, p.centerX < cx ? -1 : 1);
      }
    }
    const breaker = owner ?? this.nearestPlayer(cx);
    for (let ty = tileAt(box.y); ty <= tileAt(box.y + box.h - 1); ty++)
      for (let tx = tileAt(box.x); tx <= tileAt(box.x + box.w - 1); tx++) {
        // Blasts always break (Classic: they take `amount` off a brick's 125 and open hidden
        // blocks too, BR-C11/BR-C13; Current's strikeBlock leaves hidden blocks to heads).
        if (weaponStrikable(this.map.get(tx, ty)))
          this.strikeBlock(tx, ty, breaker, true, { source: 'blast', damage: opts.amount ?? 2 });
      }
  }

  /**
   * A fetching boomerang (ProjectileSpec.fetches, Link's) takes what it touches: coins in the tile
   * grid, items out of their blocks (a poison mushroom stays: it is no prize) and drops. They
   * leave the level and ride on it until it is back (deliverFetch).
   */
  boomerangFetch(proj: Projectile): void {
    const b = proj.body;
    for (let ty = tileAt(b.y); ty <= tileAt(b.y + b.h - 1); ty++)
      for (let tx = tileAt(b.x); tx <= tileAt(b.x + b.w - 1); tx++)
        if (tileDef(this.map.get(tx, ty)).pickup === 'coin') {
          this.map.set(tx, ty, T.AIR);
          proj.carriedCoins++;
        }
    for (const e of this.entities) {
      if (!e.alive || !overlaps(b, e.body)) continue;
      const item =
        (e instanceof PowerUp && e.out && e.item !== 'poison') ||
        (e instanceof HeroItem && e.out) ||
        e instanceof Pickup;
      if (!item) continue;
      e.destroy();
      proj.carried.push(e);
    }
  }

  /**
   * A fetching boomerang is back (or gone): its owner gets what it carried, as if touched (a coin
   * and its 200 points, an item, a drop; a drop the owner has no room for falls at his feet).
   */
  deliverFetch(proj: Projectile): void {
    const p = proj.owner instanceof Player && !proj.owner.dead && !proj.owner.out ? proj.owner : null;
    const coins = proj.carriedCoins;
    const carried = proj.carried.splice(0);
    proj.carriedCoins = 0;
    if (!p) return;
    for (let i = 0; i < coins; i++) {
      this.addCoin();
      this.addScore(200);
    }
    for (const e of carried) {
      if (e instanceof PowerUp) {
        if (e.item === 'clock') this.collectClock(e);
        else if (e.item === 'bee') this.collectBee(e);
        else if (isSpecialItem(e.item)) takeSpecialItem(this, p, e as PowerUp & { item: SpecialItem });
        else if (e.item !== 'poison') this.powerUp(p, e.item);
      } else if (e instanceof HeroItem) this.takeHeroItem(p, e);
      else if (e instanceof Pickup) this.collectPickup(p, e);
    }
  }

  /**
   * A player's shot hit a wall at (x, y) (subpixels): on Mega Man's airship a cannon there takes
   * the hit (Cannon.shot). True when one did.
   */
  shotWall(pr: Projectile, x: number, y: number): boolean {
    if (!this.megamanShip || !(pr.owner instanceof Player)) return false;
    const tx = tileAt(x);
    const ty = tileAt(y);
    for (const e of this.entities)
      if (e instanceof Cannon && e.alive && e.tx === tx && e.ty === ty)
        return e.shot(
          { kind: pr.spec.damage, amount: pr.spec.amount, owner: pr, dirX: pr.body.vx > 0 ? 1 : -1 },
          this,
        );
    return false;
  }

  /** A projectile struck the tile at a point: bricks and item blocks react as to a head bump. */
  breakAt(x: number, y: number, owner: Entity | Player | null): void {
    const tx = tileAt(x);
    const ty = tileAt(y);
    const def = tileDef(this.map.get(tx, ty));
    if (!def.block || def.block.kind === 'hidden') return;
    const p = owner instanceof Player ? owner : this.nearestPlayer(x);
    // Only brick-breaking shots (Current specs) call this: they break a brick outright, under
    // Classic rules too.
    this.strikeBlock(tx, ty, p, true, { source: 'shot', damage: Number.MAX_SAFE_INTEGER });
  }

  /**
   * A Classic shot (ProjectileSpec.classicBlocks, TG-26, BR-C9..BR-C11, BR-C17) strikes each block
   * tile its body overlaps once per contact (bricks, ? blocks, item bricks, hidden blocks; used
   * blocks are plain ground). True when the shot ends there by its `afterBlock` rule.
   */
  shotBlocks(pr: Projectile): boolean {
    if (!pr.spec.classicBlocks?.strikesBlocks) return false;
    const b = pr.body;
    const now = this.touchingNow;
    now.clear();
    let end = false;
    for (let ty = tileAt(b.y); ty <= tileAt(b.y + b.h - 1); ty++)
      for (let tx = tileAt(b.x); tx <= tileAt(b.x + b.w - 1); tx++) {
        const key = `${tx},${ty}`;
        const id = this.map.get(tx, ty);
        // A block mid-hop is still the block this shot is touching (one coin per contact).
        if (id === T.BUMPING && pr.touching?.has(key)) now.add(key);
        if (!weaponStrikable(id)) continue;
        now.add(key);
        if (pr.touching?.has(key)) continue;
        if (this.shotStrike(pr, tx, ty)) end = true;
      }
    const touching = pr.touchingTiles();
    touching.clear();
    for (const k of now) touching.add(k);
    return end;
  }

  /** A Classic shot that collides with ground struck the tile at (x, y) (subpixels). */
  shotBlockAt(pr: Projectile, x: number, y: number): void {
    if (!pr.spec.classicBlocks?.strikesBlocks) return;
    const tx = tileAt(x);
    const ty = tileAt(y);
    if (weaponStrikable(this.map.get(tx, ty))) this.shotStrike(pr, tx, ty);
  }

  /** One Classic shot strike; true when the shot ends by its `afterBlock` rule (BR-C9). */
  private shotStrike(pr: Projectile, tx: number, ty: number): boolean {
    const p = pr.owner instanceof Player ? pr.owner : this.nearestPlayer(pr.body.x);
    const res = this.strikeBlock(tx, ty, p, false, { source: 'shot', damage: pr.spec.amount });
    switch (pr.spec.classicBlocks?.afterBlock) {
      case 'continue':
        return false;
      case 'continueIfBroken':
        return (res?.hp ?? 0) > 0;
      default:
        return true;
    }
  }

  /**
   * Classic melee (CharacterDef.meleeStrikesBlocks, BR-C6): every block tile the active hitbox
   * overlaps is struck once per swing (a plain brick breaks, an item block bumps).
   */
  private meleeBlocks(p: Player): void {
    const m = p.activeMelee;
    if (!m) return;
    for (let ty = tileAt(m.y); ty <= tileAt(m.y + m.h - 1); ty++)
      for (let tx = tileAt(m.x); tx <= tileAt(m.x + m.w - 1); tx++) {
        const key = `hitb:${tx},${ty}`;
        if (p.scratch[key]) continue;
        const id = this.map.get(tx, ty);
        // Already struck this swing by the hero's own block strike (Link's strikeBlocks): mid-hop,
        // it stays marked so it is not struck again when it settles (a multi-coin brick).
        if (id === T.BUMPING) p.scratch[key] = 1;
        if (!weaponStrikable(id)) continue;
        p.scratch[key] = 1;
        this.strikeBlock(tx, ty, p, true, { source: 'melee' });
      }
  }

  /**
   * A block-bumping shot flying through tiles (ProjectileSpec.bumpsBlocks, 0.4.46): the block its
   * centre is crossing is struck once on its owner's behalf, as their head bump would (a ? block
   * gives its item or coin, a brick breaks by their rules); a shot that only bumps ? blocks leaves
   * bricks be. On Mega Man's airship a cannon it crosses takes the hit, and the shot ends there
   * (returns true).
   */
  pierceBlocks(pr: Projectile): boolean {
    const b = pr.body;
    const tx = tileAt(b.x + (b.w >> 1));
    const ty = tileAt(b.y + (b.h >> 1));
    const key = `${tx},${ty}`;
    if (pr.bumped.has(key)) return false;
    const id = this.map.get(tx, ty);
    // A training stage's closed gate (blank solid tiles, not a block mid-bump) stops it.
    if (id === T.BUMPING)
      return !this.entities.some((e) => e instanceof BlockBump && e.alive && e.tx === tx && e.ty === ty);
    const block = tileDef(id).block;
    if (!block || block.kind === 'hidden') {
      if (!this.map.isSolid(tx, ty)) return false;
      pr.bumped.add(key);
      return this.shotWall(pr, b.x + (b.w >> 1), b.y + (b.h >> 1));
    }
    if (pr.spec.bumpsBlocks === 'question' && block.kind !== 'question') return false;
    pr.bumped.add(key);
    const p = pr.owner instanceof Player ? pr.owner : this.nearestPlayer(b.x);
    this.feats.pierced++;
    this.strikeBlock(tx, ty, p, p.def.canBreakBricks(p), { source: 'shot' });
    return false;
  }

  /* ---------- Scoring ---------- */

  /**
   * `p` takes dropped pickup `e`. Drops are always collectible (owner decision, 0.4.35): the
   * hero's onPickup uses it (filling what it fills, or a hidden reserve for a power not owned
   * yet); when there is nothing to fill (full, or a drop no use to this hero) it gives
   * PICKUP_FULL_SCORE points instead. Either way it is gone.
   */
  collectPickup(p: Player, e: Pickup): void {
    e.destroy();
    this.events.push({ type: 'pickup', item: e.item, player: Math.max(0, this.players.indexOf(p)) });
    if (p.def.behaviour.onPickup?.(p, e.item, this)) return;
    this.addScore(PICKUP_FULL_SCORE, e.body.x, e.body.y - px(8));
    this.audio.sfx('coin');
  }

  addScore(n: number, x?: number, y?: number): void {
    // Capped like the original's StatManager.addPoints (SCORE_MAX = 9999999).
    this.state.score = Math.min(this.state.score + n, SCORE_MAX);
    if (x !== undefined && y !== undefined && this.scorePopups) this.spawn(new ScorePopup(x, y, String(n)));
  }

  /** A coin: SMB's rule makes every 100 a life; with the Wallet they add up to 999 (items/wallet.ts). */
  addCoin(): void {
    const lives = gainCoins(this.state, 1);
    this.audio.sfx('coin');
    for (let i = 0; i < lives; i++) this.addLife(this.player.body.x, this.player.body.y - px(16));
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
   * Public for Classic weapons that hit by hand (Link's bomb blast).
   */
  scoreKill(e: Enemy, kind: DamageKind, r: Reaction): void {
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
    this.tally('enemiesStomped');
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
    this.bossBar.tick((o) => (o as Entity).alive);
    if (this.itemCaption && --this.itemCaption.t <= 0) this.itemCaption = null;
    if (this.shakeFrames > 0) this.shakeFrames--;

    // Growth/shrink pauses the world (SMB1 does too).
    let transitioning = false;
    for (const p of this.players) if (p.transition) transitioning = p.tickTransition() || transitioning;
    if (transitioning) return;
    if (this.clear) {
      this.tickScorePopups();
      return this.updateClear(inputs);
    }
    if (this.unmask) {
      this.tickScorePopups();
      const done = this.unmask.update(this);
      if (done) {
        this.unmask = null;
        this.startBossClear(done.axe, done.player);
      }
      return;
    }
    if (this.bossClear) {
      this.tickScorePopups();
      return this.updateBossClear(inputs);
    }
    if (this.anchorScene) {
      this.tickScorePopups();
      if (this.anchorScene.update(this, inputs)) this.anchorScene = null;
      this.cull();
      return;
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

    const anchor = this.cameraAnchor();
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
        // A hero that flies never lands: steered at once (CharacterDef.flies).
        if (p.body.onGround || p.body.y >= px(FALL_IN_STEER_Y) || p.def.flies) this.fallingIn.delete(p);
        else input = withoutSteering(input);
      }
      if (this.autoWalk) input = AUTO_WALK_INPUT;
      else if (this.vineArrival && p.vine) input = AUTO_CLIMB_INPUT;
      else if (this.talkTarget(p)) input = withoutSpecial(input);
      // Classic SMBC (SW-C9, SwimProfile.surfaceTest 'top'): the hitbox top against the wave
      // row's top edge, so small and big bodies switch at one height.
      p.inWater =
        p.profile.swim?.surfaceTest === 'top'
          ? p.body.y > this.waterTop - px(8)
          : p.body.y + (p.body.h >> 1) >= this.waterTop;
      p.aboveWater = !p.inWater && this.waterTop !== Infinity;
      // PitVacuum.updateStats pulls whether or not the hero is under water (G-013): only the area
      // (one that starts under water) and the hero (SwimProfile.pitPull) decide.
      p.pitPull = p.profile.swim?.pitPull ? this.pitPullOn(p) : null;
      this.grabVines(p, input);
      this.grabStairs(p, input);
      const spring = this.springUnder(p);
      if (spring) {
        spring.ride(input.pressed('jump'));
        p.anim = 'jump';
        return;
      }
      p.cheatAmmo = this.cheats.infiniteAmmo; // Infinite Ammo (Classic cheat; classic/power.ts freeAmmo)
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
      // Classic Ice (HP-C17, SA-C21): a frozen enemy carries a solid 16x16 block for players only
      // (its left and bottom edges on the enemy's). Only Classic hits ever set `frozen`.
      for (const e of this.entities)
        if (e instanceof Enemy && e.alive && e.frozen > 0) solidBox(p.body, frozenBlock(e));
      if (p.body.x < this.camera.x) {
        this.placeX(p, this.camera.x);
        if (p.body.vx < 0) p.body.vx = 0;
        this.unsqueeze(p);
      }
      const rightEdge = Math.min(tileToSub(this.level.width), this.camera.x + px(SCREEN_W));
      // An auto-scroll screen holds everyone inside it (SMB3: no running ahead off the right), and
      // so does a camera held back by an anchor (a parked tank).
      if (
        p.body.x + p.body.w > rightEdge &&
        (this.camera.auto || anchor !== null || (this.coop && p !== this.rightmost()))
      ) {
        this.placeX(p, rightEdge - p.body.w);
        if (this.camera.auto && p.body.vx > 0) p.body.vx = 0;
        this.unsqueeze(p);
      }
      if (p.body.x + p.body.w > tileToSub(this.level.width))
        this.placeX(p, tileToSub(this.level.width) - p.body.w);
    });

    for (const e of this.entities) {
      if (!e.alive) continue;
      if (e instanceof Enemy) {
        if (e.stunned > 0) {
          e.stunned--;
          continue;
        }
        // Classic hit-stun and freeze (rules/classic-enemies.ts): held still, clocks running.
        e.tickClassicFx();
        if (e.stopFrames > 0) {
          e.stopFrames--;
          continue;
        }
      } else if (e instanceof Projectile && e.stopFrames > 0) {
        // Classic Stopwatch (SI-C25): an enemy projectile held still.
        e.stopFrames--;
        continue;
      }
      e.levelHeightPx = this.heightPx;
      e.update(this);
      if (e instanceof Enemy && e.alive && this.cheats.bouncyPits) this.bounceEnemy(e);
    }
    this.resolveLifts();
    this.rideEnemies();
    this.checkTalk(inputs);
    for (const p of this.activePlayers()) this.collisions(p);
    this.enemyVsEnemy();
    this.crackWalls();
    this.snuffCandles();
    for (const [i, p] of this.players.entries()) {
      if (p.dead || p.out) continue;
      this.checkPipes(p, this.autoWalk ? AUTO_WALK_INPUT : (inputs[i] ?? NO_INPUT));
      if (this.pipeAnim) break;
      if (!this.autoWalk && this.checkDoors(p, inputs[i] ?? NO_INPUT)) break;
    }
    // The key's carrier died (co-op play goes on): it is back in its box.
    if (this.keyHolder !== null) {
      const carrier = this.players[this.keyHolder];
      if (!carrier || carrier.dead || carrier.out) this.returnKey();
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
    this.tickWing();
    this.checkLoops();
    this.flyingCheeps();
    this.flyingBullets();
    if (this.bowserFire && !this.leaving) {
      const lead = this.rightmost();
      if (lead) this.bowserFire.update(this, lead);
    }

    const lead = this.rightmost();
    const heroScroll = this.camera.auto ? 0 : this.heroScrollSpeed();
    if (this.camera.auto) this.autoScroll();
    else if (heroScroll) this.autoScroll(heroScroll);
    else if (lead) {
      const before = this.camera.x;
      // A hero may lead the camera from an eased anchor (CharacterDef.cameraX: Classic Sophia III).
      const camX = lead.def.cameraX?.(lead) ?? lead.body.x;
      if (this.camera.scrollBack)
        // A fixed half width (as snapTo): a body that changes width (Sophia's corner turns) does not jerk the screen.
        this.camera.followBack(camX + px(8), this.bowserOnScreen());
      else this.camera.follow(camX, lead.body.y);
      // Never on past an anchor, with a little room behind it (a parked tank stays on screen):
      // held where it was, never pulled back (the screen does not scroll left), and a locked
      // screen is left alone.
      const a = this.cameraAnchor();
      if (a !== null && !this.camera.locked && this.camera.x > a - px(ANCHOR_ROOM))
        this.camera.x = Math.max(before, a - px(ANCHOR_ROOM));
    }
    for (const p of this.players) {
      if (p.star === (p.def.starMusicLeft ?? 1)) this.audio.playMusic(this.music);
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
        else if (!this.catchFall(p) && !this.bouncePlayer(p)) this.kill(p);
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
  private autoScroll(heroSpeed = 0): void {
    // A transfer under way, or the players still climbing in (a vine or anchor-chain arrival).
    if (this.leaving || this.arriving) return;
    if (heroSpeed) this.heroScroll(heroSpeed);
    else this.camera.scroll();
    for (const p of this.activePlayers()) {
      if (p.body.x >= this.camera.x || p.frozen || p.hidden) continue;
      // Pushed by the screen's edge, a player on stairs is knocked off them and pushed like
      // anyone else (squashed against a wall too).
      p.stairs = null;
      const blocked = this.solidRows(p);
      p.body.x = this.camera.x;
      if (p.body.vx < 0) p.body.vx = 0;
      if (!this.squashed(p, blocked)) continue;
      // A hero whose own scroll pins it (CharacterDef.autoScroll.pinned 'eject': Vic Viper, as
      // the original's hit test pushes the ship out of the ground it was shoved into) is put free
      // where there is room; with none it is squashed like anyone else.
      if (p.def.autoScroll?.pinned === 'eject' && this.eject(p)) continue;
      this.kill(p);
    }
  }

  /**
   * The speed (velocity units) of a hero's own auto-scroll (CharacterDef.autoScroll: Vic Viper,
   * VV-9, VV-M14): while any player still in the level plays such a hero; 0 otherwise, and the
   * camera follows as usual.
   */
  private heroScrollSpeed(): number {
    for (const p of this.players) if (!p.out && p.def.autoScroll) return p.def.autoScroll.speed;
    return 0;
  }

  /**
   * Where a hero's auto-scroll ends for good (VV-12): the camera's end, or in a castle with an axe
   * the screen that has the axe a tile in from its right edge (the original's axe limit), so the
   * fight with Bowser is on a fixed screen.
   */
  private heroScrollEnd(): number {
    const axe = this.level.entities.find((e) => e.type === 'axe');
    if (!axe) return this.camera.maxX;
    return Math.min(this.camera.maxX, Math.max(0, tileToSub(axe.x + 2) - px(SCREEN_W)));
  }

  /**
   * One frame of a hero's auto-scroll (VV-9, VV-10, VV-12): the camera moves right by `speed` up to
   * its end (where it stays), whatever the players do, and carries every player whose hero scrolls
   * (CharacterDef.autoScroll) by the same amount; anyone else is only pushed by the left edge.
   */
  private heroScroll(speed: number): void {
    this.heroScrolled = false;
    if (this.camera.locked) return;
    const before = this.camera.x;
    const end = this.heroScrollEnd();
    if (before >= end) return;
    this.camera.x = Math.min(end, before + velToSub(speed));
    const dx = this.camera.x - before;
    if (dx <= 0) return;
    this.heroScrolled = true;
    for (const p of this.activePlayers())
      if (p.def.autoScroll && !p.frozen && !p.hidden) moveX(p.body, this.playerMap(p), dx);
  }

  /** The hero's auto-scroll moved the camera on this frame (CharacterDef.autoScroll). */
  heroScrolled = false;

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

  /**
   * Someone `p` can talk to now (a captive hero or a partner within reach), or null; else (0.4.52)
   * a key thing the TALK button acts on for `p` (objects/keys.ts): the key (PICK UP), a gate (OPEN,
   * then LOCKED) or a locked door (LOCKED). In reach, SPECIAL is the TALK button (0.4.35:
   * levelTouchLabels shows it, the hero's own special waits).
   */
  talkTarget(p: Player): Captive | Partner | KeyThing | null {
    if (p.vine) return null;
    for (const e of this.entities)
      if ((e instanceof Captive || e instanceof Partner) && e.alive && e.inReach(p)) return e;
    return this.keyThing(p);
  }

  /**
   * The key thing in `p`'s reach with a word on the TALK button, by priority: the key, then a
   * gate or a door (one at a time: they are never side by side).
   */
  private keyThing(p: Player): KeyThing | null {
    let best: KeyThing | null = null;
    for (const e of this.entities) {
      if (!e.alive || !(e instanceof KeyItem || e instanceof LockedGate || e instanceof LockedDoor)) continue;
      if (!e.inReach(p) || e.verb() === null) continue;
      if (e instanceof KeyItem) return e;
      best ??= e;
    }
    return best;
  }

  /** The TALK button's word for `p` now (READ for the bird statue; PICK UP, OPEN, LOCKED), or null. */
  talkVerb(p: Player): string | null {
    const to = this.talkTarget(p);
    if (to instanceof Partner) return to.script.verb;
    if (to instanceof Captive) return 'TALK';
    return to ? to.verb() : null;
  }

  /**
   * SPECIAL, the TALK button, pressed by a player within a captive's reach: a `talk` event; a
   * partner's: a `partner` event (one a frame); the key's: it is taken; an untried gate's: a
   * `gate` event (LOCKED does nothing). Up no longer talks (0.4.43, owner: it went off by
   * accident on touch); it keeps its own jobs (doors, pipes, vines).
   */
  private checkTalk(inputs: InputFrame[]): void {
    for (const [i, p] of this.players.entries()) {
      const input = inputs[i] ?? NO_INPUT;
      if (!input.pressed('special') || p.vine) continue;
      const c = this.entities.find((e): e is Captive => e instanceof Captive && e.alive && e.inReach(p));
      if (c) {
        c.prompt = false; // hidden under the dialogue; back on the next update in reach
        this.events.push({ type: 'talk', hero: c.hero.id, player: i });
        return;
      }
      const partner = this.entities.find(
        (e): e is Partner => e instanceof Partner && e.alive && e.inReach(p),
      );
      if (partner) {
        partner.prompt = false; // hidden under its pages; back on the next update in reach
        partner.talked = true;
        partner.talks++;
        this.events.push({ type: 'partner', who: partner.who, player: i });
        return;
      }
      const thing = this.keyThing(p);
      if (thing instanceof KeyItem) return this.takeKey(thing, i);
      if (thing instanceof LockedGate && thing.verb() === 'OPEN') return thing.tryOpen(this, i);
    }
  }

  /* ---------- Keys and locked doors (0.4.52, objects/keys.ts) ---------- */

  /** The key box laid at tile (tx, ty), if any. */
  private keyBoxAt(tx: number, ty: number): KeyBox | undefined {
    return this.entities.find((e): e is KeyBox => e instanceof KeyBox && e.tx === tx && e.ty === ty);
  }

  /** Player `i` picks up the key: carried (the HUD's key icon) until a door uses it. */
  takeKey(key: KeyItem, i: number): void {
    key.destroy();
    this.keyHolder = i;
    this.audio.sfx('pickup');
    this.events.push({ type: 'say', text: KEY_SAID.got });
  }

  /** The carried key turned in a door (LockedDoor): used up. */
  useKey(): void {
    this.keyHolder = null;
    this.audio.sfx('key-get');
    this.events.push({ type: 'say', text: KEY_SAID.opened });
  }

  /**
   * The key is lost on the visit (its co-op carrier died, or it fell out of the room): back in its
   * box, full again (a single player's death reloads the room anyway).
   */
  returnKey(): void {
    this.keyHolder = null;
    for (const e of this.entities) {
      if (e instanceof KeyItem && e.alive) e.destroy();
      if (e instanceof KeyBox && e.alive) e.refill(this);
    }
    this.events.push({ type: 'say', text: KEY_SAID.back });
  }

  /** Up at an open locked door goes through it (objects/keys.ts), as a pipe does. */
  private checkDoors(p: Player, input: InputFrame): boolean {
    if (!input.pressed('up') || p.vine) return false;
    const door = this.entities.find(
      (e): e is LockedDoor => e instanceof LockedDoor && e.alive && e.canEnter(p),
    );
    if (!door?.target) return false;
    // Into the doorway itself (UP works anywhere its strip shows: LockedDoor.canEnter).
    p.body.x = door.centerX - (p.body.w >> 1);
    for (const o of this.players) {
      o.frozen = true;
      o.stairs = null;
      o.body.vx = 0;
      o.body.vy = 0;
      o.anim = 'idle';
      o.hidden = true;
    }
    this.audio.sfx('door-open');
    this.pipeAnim = {
      player: p,
      dir: 'down',
      t: 0,
      from: p.body.y,
      hold: DOOR_TRANSFER_FRAMES,
      target: { type: 'pipe', target: { ...door.target, exitDir: 'fall' } },
    };
    return true;
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
      // A camera anchor (a parked tank) goes round the loop with them.
      for (const e of this.entities) if (e.alive && e.anchorsCamera) e.body.x += dx;
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
    mode: 'climb' | 'fall' | 'spin' | 'up' | 'none',
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
        // A vine to an area with none to climb on arrives as that area starts (its `exit=`).
        if (z) this.transfer(z.target, z.target.exitDir ?? 'climb', on?.art === 'chain');
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
      if (p.def.behaviour.canGrabVine?.(p, e.art, this) === false) continue;
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
   * zone (FlyingCheepSpawner.as). With fewer than its cap out (FLYING_CHEEP_CAP: 3 on Normal) and no spawn pending it
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
    for (const e of this.entities)
      if (e.alive && ((e instanceof Cheep && e.flying) || (e instanceof HammerBro && e.spawner === 'cheep')))
        flying++;
    // MAX_CHEEP_EASY / NORMAL / HARD (FlyingCheepSpawner.as:17-19, 37-50; G-006): 2, 3 or 4.
    const cap = FLYING_CHEEP_CAP[this.mapDifficulty];
    if (this.cheepTimer > 0 && --this.cheepTimer === 0 && inZone && flying < cap) {
      const marioType = lead.def.id === 'mario' || lead.def.id === 'luigi';
      const target = {
        centerX: lead.centerX,
        vx: lead.body.vx,
        marioWalk: marioType ? lead.profile.maxWalk : null,
      };
      const cheep = Cheep.leaper(this.rng, this.camera.x, SCREEN_H, target, this.cheepNoRight >= 120);
      // All Hammer Bros (Classic cheat; CheepFast): a Hammer Bro leaps out in its place.
      const b = cheep.body;
      this.spawn(
        this.cheats.allHammerBros ? HammerBro.launched(b.x, b.y - px(8), b.vx, b.vy, 'cheep') : cheep,
      );
      flying++;
    }
    if (inZone && flying < cap && this.cheepTimer === 0) this.cheepTimer = 36 + this.rng.int(28);
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
      // All Hammer Bros (Classic cheat; BulletBillSpawner): a Hammer Bro flies in at the top
      // instead (`curBulBill.y = GLOB_STG_TOP + TILE_SIZE*3`), at the Bullet Bill's speed.
      const bill = this.cheats.allHammerBros
        ? HammerBro.launched(this.camera.right, px(3 * 16 - 22), -BULLET_SPEED, 0, 'bullets')
        : new BulletBill(this.camera.right, px(bottom - 14), -1);
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
          this.audio.playMusic(this.music);
        });
      }
      if (this.time <= 0) {
        this.time = 0;
        this.timedOut = true;
        for (const p of this.activePlayers()) this.kill(p);
      }
    }
  }

  private cull(): void {
    const left = this.camera.x;
    if (this.camera.scrollBack) this.unpark();
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i] as Entity;
      if (!e.alive) {
        this.entities.splice(i, 1);
        continue;
      }
      if (this.camera.scrollBack && e.despawnMargin !== null && this.fromMap.has(e) && this.outOfReach(e)) {
        // Scroll-back: still, off the stage, until the camera comes back (see `parked`).
        this.parked.push(e);
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

  /**
   * Scroll-back: a map entity beyond reach of the screen: past its despawn margin on the left, or
   * more than 2 tiles past the spawn margin on the right (the camera went back after it spawned).
   */
  private outOfReach(e: Entity): boolean {
    const b = e.body;
    if (b.x + b.w < this.camera.x - px(e.despawnMargin ?? 0)) return true;
    return b.x > this.camera.right + px(SPAWN_MARGIN_PX + 32);
  }

  /** Scroll-back: parked entities the screen has come back to resume where they were. */
  private unpark(): void {
    for (let i = this.parked.length - 1; i >= 0; i--) {
      const e = this.parked[i] as Entity;
      if (!e.alive) this.parked.splice(i, 1);
      else if (!this.outOfReach(e)) {
        this.parked.splice(i, 1);
        this.entities.push(e);
      }
    }
  }

  /** Scroll-back camera: a live Bowser within 2 tiles of the screen (Level.as bowser.onScreen). */
  private bowserOnScreen(): boolean {
    for (const e of this.entities)
      if (
        e instanceof Bowser &&
        e.alive &&
        e.body.x + e.body.w > this.camera.x - px(32) &&
        e.body.x < this.camera.right + px(32)
      )
        return true;
    return false;
  }

  /* ---------- Blocks & tiles ---------- */

  private hitBlock(tx: number, ty: number, p: Player): void {
    // A head that touches blocks as plain ground (Classic: Samus in the ball, Ryu on a wall).
    if (p.def.headBumps?.(p) === false) return;
    // A Classic SMBC hit's push bumps nothing (PS-C12, Player.hurtLock).
    if (p.hurtLock) return;
    this.strikeBlock(tx, ty, p, p.def.canBreakBricks(p));
  }

  /**
   * A broken brick or a coin out of a block may drop something for the hero who struck it
   * (CharacterDef.blockDrop: Classic SMBC's ammo, PS-C15): out of the brick's cell, or on top of
   * the block that gave the coin. Heroes without the hook roll nothing.
   */
  private blockDrop(tx: number, ty: number, p: Player, source: 'brick' | 'coin'): void {
    const kind = p.def.blockDrop?.(this.rng, p, source);
    if (!kind) return;
    this.spawn(new Pickup(tileToSub(tx) + px(8), tileToSub(source === 'brick' ? ty + 1 : ty), kind));
  }

  /**
   * Strike a block on a player's behalf: the only place a block reacts (TG-25). `breakBricks`
   * decides whether plain bricks shatter; `hit` says what struck it (a head bump by default) and
   * how hard. Under Classic rules the strike goes to rules/classic-bricks.ts (brick HP, weapons
   * from the side) and reports what it did; Current bumps or breaks it as from below and reports
   * nothing.
   */
  strikeBlock(
    tx: number,
    ty: number,
    p: Player,
    breakBricks: boolean,
    hit: BlockHit = { source: 'head' },
  ): BlockStrike | undefined {
    if (this.rules === 'classic') return classicRules().strikeBlock(this, tx, ty, p, breakBricks, hit);
    // Current: only a head opens a hidden block (shots, blasts and melee pass them by).
    if (hit.source !== 'head' && tileDef(this.map.get(tx, ty)).block?.kind === 'hidden') return undefined;
    this.bumpBlock(tx, ty, p, breakBricks);
    return undefined;
  }

  /**
   * A block reacts as to a head bump from `p` (the hop, enemies and coins on top, its item or
   * coin; a plain brick breaks when `breakBricks`). Called by strikeBlock (and the Classic strike).
   */
  bumpBlock(tx: number, ty: number, p: Player, breakBricks: boolean): void {
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
    const { kind } = def.block;
    // A `block-item` spawn's item replaces the block's own (the Hudson Bee, a lone Clock).
    const key = `${tx},${ty}`;
    const item = this.blockItems.get(key);
    if (item) this.blockItems.delete(key);
    const content = item ?? def.block.content;
    const frame = kind === 'brick' ? 'brick' : 'used';
    if (kind === 'brick' && content === 'none') {
      if (breakBricks) {
        this.map.set(tx, ty, T.AIR);
        this.breakPieces(tx, ty);
        this.addScore(50);
        this.audio.sfx('break');
        this.feats.bricks++;
        this.tally('bricksBroken');
        this.blockDrop(tx, ty, p, 'brick');
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
        this.blockDrop(tx, ty, p, 'coin');
        break;
      case 'coins10': {
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
        this.blockDrop(tx, ty, p, 'coin');
        if (c.left > 0 && this.frame < c.until) restore = id;
        break;
      }
      case 'powerup':
        if (!this.spawnHeroItem(tx, ty, p, content))
          this.spawn(this.blockItem(tx, ty, p.def.blockPowerUp(p), p));
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
        // A lone Clock (a `block-item`) leaves a used block.
        if (id === T.Q_CLOCK && !item) restore = T.Q_COIN;
        break;
      case 'bee':
      case 'atom':
      case 'hammer':
      case 'wing':
        // The Hudson Bee rises out like any item (Brick.normalItemExitBrickStart, G-023), and
        // Super Mario Bros. Special's Atom, Hammer and Wing likewise (G-022).
        this.spawn(new PowerUp(tx, ty, content));
        this.audio.sfx('powerup-appear');
        break;
      case 'vine':
        this.spawn(new Vine(tx, ty, 0, { tx, ty }));
        this.audio.sfx('vine');
        break;
      case 'flower':
      case 'mushroom':
        // The Top Secret Area: always this item, whatever the hero's power (its onPowerUp gives
        // the hero's own flower or mushroom power). Campaign: the hero's own grow item from `R`,
        // their entry or default power from `W`.
        if (!this.spawnHeroItem(tx, ty, p, content)) this.spawn(this.blockItem(tx, ty, content, p));
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
      case 'key':
        // A key box (0.4.52, objects/keys.ts): the key rises out (or drops out below); the box
        // is spent.
        this.spawn(new KeyItem(tx, ty, this.keyBoxAt(tx, ty)?.out ?? 'up'));
        this.audio.sfx('powerup-appear');
        this.events.push({ type: 'say', text: KEY_SAID.popped });
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

  /** Campaign play: blocks give each hero their own items from `entries` (the level's `[hero-items]`). */
  useHeroItems(entries: readonly HeroItemEntry[]): void {
    this.heroItems = new Map(entries.map((e) => [`${e.x},${e.y}`, e.items]));
  }

  /** A block's power-up for `p`, drawn with `p`'s own art for it if the def has one (powerUpArt). */
  private blockItem(tx: number, ty: number, kind: PowerUpKind, p: Player): PowerUp {
    const u = new PowerUp(tx, ty, kind);
    const art = p.def.powerUpArt?.(kind);
    if (art) u.art = art;
    return u;
  }

  /**
   * A power block struck in the campaign by a hero with items of their own: their item rises from
   * it (docs/POWERUPS.md 3.3). False (nothing spawned) outside the campaign and for Mario and
   * Luigi, whose blocks give SMB's mushroom and flower.
   */
  private spawnHeroItem(
    tx: number,
    ty: number,
    p: Player,
    content: 'powerup' | 'mushroom' | 'flower',
  ): boolean {
    if (!this.heroItems) return false;
    const entries = this.heroItems.get(`${tx},${ty}`) ?? null;
    const item = blockItem(p, entries, content);
    if (item === null) return false;
    // The fixed grow block (`R`) holds the grow item for whoever takes it.
    this.spawn(new HeroItem(tx, ty, item, p.def.id, content === 'mushroom' ? GROW_BLOCK : entries));
    return true;
  }

  /**
   * `p` takes a hero item: theirs if they struck the block, else worked out again for their own
   * hero from the same block (a small hero: the grow item). 1000 points, then the item's effect,
   * sound and name the first time, or the hero's refill and refill sound once owned.
   */
  takeHeroItem(p: Player, e: HeroItem): void {
    let id: string | null = e.item;
    if (p.def.id !== e.hero)
      id = e.entries === GROW_BLOCK ? blockItem(p, null, 'mushroom') : blockItem(p, e.entries);
    else id = growFirst(p, id);
    // A hero without items of their own (Mario or Luigi in an older co-op file): SMB's item, whose
    // onPowerUp scores its own 1000.
    if (id === null) {
      const kind = e.entries === GROW_BLOCK ? 'mushroom' : p.def.blockPowerUp(p);
      if (!isWorldItem(kind)) p.def.behaviour.onPowerUp(p, kind, this);
      return;
    }
    this.addScore(1000, p.body.x, p.body.y - px(16));
    const got = applyItem(p, id);
    if (!got) return;
    if (!got.fresh) {
      this.audio.sfx(itemRules(p.def.id)?.refillSfx ?? 'pickup');
      return;
    }
    this.audio.sfx(itemSfx(id));
    this.itemCaption = { text: got.name.toUpperCase(), t: ITEM_CAPTION_FRAMES };
    this.events.push({ type: 'say', text: `${got.name}: ${got.does}.` });
    this.events.push({ type: 'item', item: id, player: Math.max(0, this.players.indexOf(p)) });
  }

  /**
   * `p` takes SMB's power-up `kind` (a block another hero struck: Mario's in co-op). In the
   * campaign a hero with items of their own takes theirs instead, by the blocks' rule (0.4.43:
   * Samus took the Varia Suit from a Mushroom before any Energy Tank): a small hero their grow item,
   * else the Mushroom their next one, the Fire Flower their default power. Else its onPowerUp.
   */
  powerUp(p: Player, kind: HeroPowerUp): void {
    if ((kind === 'mushroom' || kind === 'flower') && itemRules(p.def.id) && isFound(p)) {
      const id = blockItem(p, null, kind === 'mushroom' ? 'mushroom' : 'powerup');
      if (id !== null) return this.takeHeroItem(p, new HeroItem(0, 0, id, p.def.id));
    }
    p.def.behaviour.onPowerUp(p, kind, this);
  }

  /**
   * The Hudson Bee (G-023; Character.as:1612-1618): 8000 points shown where it was, and the
   * power-up sound.
   */
  private collectBee(e: PowerUp): void {
    this.addScore(8000, e.body.x, e.body.y);
    this.audio.sfx('powerup');
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
      if (!this.players.some((p) => p.star > 0)) this.audio.playMusic(this.music);
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
      if (p.def.meleeStrikesBlocks) this.meleeBlocks(p);
      for (const e of this.enemies) {
        // A Classic frozen enemy is out of melee's reach (HP-C17).
        if (this.thrustIgnoresShell(p, e) || e.frozen > 0) continue;
        if (overlaps(p.activeMelee, e.body) && !p.scratch[`hit${e.id}`]) {
          p.scratch[`hit${e.id}`] = 1;
          const src: DamageSource = p.def.behaviour.meleeDamage?.(p, e) ?? {
            kind: 'sword',
            amount: 1,
            owner: null,
            dirX: p.facing,
            by: p,
          };
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
          else if (e.item === 'bee') this.collectBee(e);
          else if (isSpecialItem(e.item)) takeSpecialItem(this, p, e as PowerUp & { item: SpecialItem });
          else this.powerUp(p, e.item);
        }
      } else if (e instanceof HeroItem) {
        if (e.out && overlaps(pb, e.body)) {
          e.destroy();
          this.takeHeroItem(p, e);
        }
      } else if (e instanceof Pickup) {
        if (overlaps(pb, e.body)) this.collectPickup(p, e);
      } else if (e instanceof Projectile) this.projectile(p, e);
      else if (e instanceof Flagpole && !this.clear && overlaps(pb, e.body)) this.startClear(e, p);
      else if (e instanceof Axe && overlaps(pb, e.body)) {
        // The axe ends the fight: the Bowser bar goes with it (0.4.47).
        this.bossBar.axe();
        if (!this.unmaskAtAxe(e, p)) this.startBossClear(e, p);
      }
      if (p.dead || this.clear || this.bossClear || this.unmask) return;
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
    // The hurt box (CharacterDef.hurtbox, Classic: the original's HRect); the body without one.
    if (!overlaps(p.hurtBody(), e.body)) return;
    // A whole firebar, its anchor ball too, passes through Classic Fire Man (MegaManBase.hitProj).
    if (e instanceof Firebar && p.def.fireBarProof) return;

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
    // No stomp during a Classic SMBC hit's push (PS-C12), nor under water for a hero whose
    // swim profile says so (SW-C7): plain contact.
    const stompBarred = p.hurtLock !== null || (p.inWater && p.profile.swim?.noStomp === true);
    // CharacterDef.standsOnEnemies (Classic Peach, PE-11): landing on it, or riding it, is no
    // stomp and no hurt (World.rideEnemies keeps her on top).
    if (!stompBarred && p.def.standsOnEnemies?.(p, e) && (fromAbove || this.rides.get(p)?.e === e)) return;
    // CharacterDef.seaFloorSafe (ML-C25): a Blooper leaves a hero on the sea floor alone.
    if (e instanceof Blooper && p.def.seaFloorSafe === true && pb.onGround && feet === px(this.heightPx - 32))
      return;
    if (fromAbove && e.stompable && !stompBarred) {
      // Everyone Can Stomp (Classic cheat; Character.canStomp): any hero stomps.
      if (p.def.stomps || this.cheats.everyoneCanStomp) {
        // Landing on a still shell kicks it; it is not a stomp, so it neither scores nor advances
        // the stomp sequence (KoopaGreen.stomp returns early for a shell, hitCharacter kicks it).
        // Nor does it bounce: Character.hitEnemy does nothing for a shell, leaving the player's
        // vertical speed alone, and the kick's no-hit window lets the player fall on through it.
        if (e instanceof Koopa && e.isStillShell) return this.kickShell(p, e);
        const r = e.hit({ kind: 'stomp', amount: 1, owner: null, dirX: p.facing }, this);
        if (r === 'hurtAttacker') {
          // CharacterDef.stompsSpiky (the Classic Yoshi mount's pair, YM-11): a Spiny is stomped.
          if (p.def.stompsSpiky && e.kind === 'spiny') {
            e.hit({ kind: 'star', amount: 1, owner: null, dirX: p.facing }, this);
            this.scoreStomp(p, e);
            p.stompBounce();
            return;
          }
          return this.hurtPlayer(p);
        }
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
    // A Classic hit-stun still hurts (HP-C18); only a frozen enemy is harmless (HP-C17).
    if (e.stunned > 0 || e.frozen > 0) return;
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
      if (!overlaps(pr.body, p.hurtBody())) return;
      if (p.def.behaviour.blocks?.(p, pr)) {
        pr.destroy();
        this.audio.sfx('bump');
        return;
      }
      this.hurtPlayer(p, pr.body.vx > 0 ? 1 : -1);
      if (!pr.spec.pierce) pr.destroy();
      return;
    }
    if (!pr.spec.hitsEnemies || pr.owner !== p || pr.deflected || pr.bursting > 0) return;
    // Mega Man's airship: Larry's wand blasts can be shot down (a few points; the shot goes on
    // only if it pierces).
    if (this.megamanShip)
      for (const q of this.entities) {
        if (!(q instanceof WandBlast) || !q.alive || !overlaps(q.body, pr.body)) continue;
        q.destroy();
        this.spawn(new Explosion(q.body.x + (q.body.w >> 1), q.body.y + (q.body.h >> 1), true));
        this.audio.sfx('kick');
        this.addScore(WAND_BLAST_POINTS, q.body.x, q.body.y);
        if (!pr.spec.pierce && !pr.spec.pierceDefeat) {
          pr.destroy();
          return;
        }
      }
    if (pr.spec.rehitAfter !== undefined) pr.releaseHits(this.enemies, this.frame);
    for (const e of this.enemies) {
      if (pr.hitIds.has(e.id) || !overlaps(pr.body, e.body)) continue;
      const src: DamageSource = {
        kind: pr.spec.damage,
        amount: pr.spec.amount,
        owner: pr,
        dirX: pr.body.vx > 0 ? 1 : -1,
        ...pr.spec.classicHit,
      };
      const r = e.hit(src, this);
      if (r === 'blocked') {
        pr.hitIds.add(e.id);
        if (this.blockedShot(pr)) return;
        continue;
      }
      if (r === 'immune') {
        if (pr.spec.hitsTiles && !pr.spec.pierce) pr.burst(this);
        return;
      }
      pr.hitIds.add(e.id);
      if (pr.spec.rehitAfter !== undefined) pr.markHit(e.id, this.frame);
      this.scoreKill(e, src.kind, r);
      if (r === 'hp') this.audio.sfx('hurt-enemy');
      else if (r === 'stun') this.audio.sfx('hurt-enemy');
      // A shot that pierces what it defeats goes on only past a kill.
      const through =
        pr.spec.pierce ||
        (pr.spec.pierceKillsOnly ? r === 'kill' : pr.spec.pierceDefeat && r !== 'hp' && r !== 'stun');
      if (!through) {
        pr.burst(this);
        return;
      }
    }
  }

  /**
   * Armour stopped a Classic shot (HP-C14, ProjectileSpec.onBlocked). True when the shot is done
   * with enemies this frame.
   */
  private blockedShot(pr: Projectile): boolean {
    switch (pr.spec.onBlocked ?? 'burst') {
      case 'continue':
        return false;
      case 'remove':
        pr.destroy();
        return true;
      case 'deflect':
        // MegaManProjectile: vx reversed, vy -350 px/s (2.9167 px/f), and it hits nothing more.
        pr.body.vx = -pr.body.vx;
        pr.body.vy = -0x02eab;
        pr.facing = pr.body.vx > 0 ? 1 : -1;
        pr.deflected = true;
        return true;
      case 'burst':
        pr.burst(this);
        return true;
    }
  }

  hurtPlayer(p: Player, fromDir: -1 | 1 = 1): void {
    if (p.invulnerable || this.assist.invulnerable) return;
    const result = p.def.behaviour.onHurt(p, this, fromDir);
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

  /** The enemy `p` stands on now (CharacterDef.standsOnEnemies), or null. */
  ridingEnemy(p: Player): Enemy | null {
    const r = this.rides.get(p);
    return r && r.e.alive && this.entities.includes(r.e) ? r.e : null;
  }

  /**
   * Enemies as moving floors (CharacterDef.standsOnEnemies; Classic Peach's riding, PE-11), after
   * the enemies moved, like Lift.carry: a hero falling onto one (or still on the one ridden last
   * frame) is put on its top, grounded, and moved by its step. Only defs that set the field ride.
   */
  private rideEnemies(): void {
    for (const p of this.activePlayers()) {
      const stands = p.def.standsOnEnemies;
      const was = this.rides.get(p);
      this.rides.delete(p);
      if (!stands || p.vine || p.stairs || p.frozen) continue;
      const pb = p.body;
      if (pb.vy < 0) continue;
      const feet = pb.y + pb.h;
      for (const e of this.enemies) {
        const eb = e.body;
        if (pb.x >= eb.x + eb.w || pb.x + pb.w <= eb.x || !stands(p, e)) continue;
        const riding = was?.e === e;
        const onTop = riding
          ? feet >= eb.y - px(4) && feet <= eb.y + px(12)
          : pb.prevBottom <= eb.y + px(4) && feet >= eb.y && feet <= eb.y + px(12);
        if (!onTop) continue;
        pb.y = eb.y - pb.h;
        pb.vy = 0;
        pb.onGround = true;
        const dx = riding && was ? eb.x - was.x : 0;
        if (dx !== 0) {
          const wall = pb.hitWall;
          moveX(pb, this.playerMap(p), dx);
          if (pb.hitWall === 0) pb.hitWall = wall;
        }
        this.rides.set(p, { e, x: eb.x });
        break;
      }
    }
  }

  private resolveLifts(): void {
    for (const e of this.entities) {
      if (!(e instanceof Lift) || !e.alive) continue;
      for (const p of this.activePlayers()) e.carry(p.body, this);
    }
    for (const p of this.activePlayers()) p.def.behaviour.afterLifts?.(p, this);
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
    const dt = p.def.deathThrow;
    if (dt && this.deathStyle === 'hop' && toPx(p.body.y) <= this.heightPx) {
      // Thrown away from the hit (Classic SMBC Bill, BI-C15); a pit death keeps the shared timing.
      p.body.vx = dt.dir(p) * dt.vx;
      p.body.vy = -dt.vy;
      p.body.onGround = false;
      this.throwDeaths.set(p, { landed: null });
    }
    const burst = this.deathStyle === 'hop' ? p.def.deathBurst : undefined;
    if (burst) {
      // A hero's own bursting death (CharacterDef.deathBurst, Classic SMBC Samus SA-C32): its
      // jingle in place of Mario's; a fall off the screen shows no pieces and ends sooner.
      if (toPx(p.body.y) > this.heightPx) this.pitDeaths.add(p);
      p.body.vx = 0;
      p.body.vy = 0;
      if (this.activePlayers().length === 0) {
        this.audio.setTempoScale(1);
        this.audio.playJingle(burst.jingle);
      } else this.audio.sfx('hit');
      return;
    }
    if (this.deathSfx) {
      // A mini game's own death (WorldStart.deathStyle): its sound, and the music stops.
      startDeath(this.deathStyle, p);
      if (this.activePlayers().length === 0) {
        this.audio.setTempoScale(1);
        this.audio.stopMusic();
      }
      this.audio.sfx(this.deathSfx);
      return;
    }
    if (this.activePlayers().length === 0) {
      this.audio.setTempoScale(1);
      this.audio.playJingle('death');
    } else this.audio.sfx('hit');
  }

  /** Frames since `p` died (null while alive): a death style's clock (death-style.ts). */
  deathTime(p: Player): number | null {
    return p.dead ? (this.deathTimers.get(p) ?? null) : null;
  }

  private updateDeath(p: Player): void {
    const t = (this.deathTimers.get(p) ?? 0) + 1;
    this.deathTimers.set(p, t);
    const thrown = this.throwDeaths.get(p);
    const dt = p.def.deathThrow;
    const hop = this.deathStyle === 'hop' && !(thrown && dt) ? p.def.deathHop : undefined;
    const burst = this.deathStyle === 'hop' ? p.def.deathBurst : undefined;
    if (burst) {
      // A bursting death (CharacterDef.deathBurst): she is gone; the pieces are drawn from t.
    } else if (thrown && dt) {
      // A thrown body (CharacterDef.deathThrow, Classic SMBC Bill BI-C15).
      stepThrow(p, dt.gravity, dt.maxFall, this.map);
      if (thrown.landed === null && p.body.onGround) thrown.landed = t;
    } else if (this.deathStyle !== 'hop') stepDeath(this.deathStyle, p, t, this.map, this.heightPx);
    else if (hop) {
      // A hero's own death (CharacterDef.deathHop, Classic SMBC ML-C18): no hop after a pit.
      if (t === 1 && toPx(p.body.y) > this.heightPx) this.pitDeaths.add(p);
      if (t === hop.freeze && !this.pitDeaths.has(p)) p.body.vy = -hop.vy;
      if (t > hop.freeze && !this.pitDeaths.has(p)) {
        p.body.vy = Math.min(p.body.vy + hop.gravity, hop.maxFall);
        p.body.y += velToSub(p.body.vy);
      }
    } else {
      // A fall off the bottom of the screen (a pit, or through the lava, which is only scenery)
      // has no hop: the original's Character.initiatePitDeath only starts the die timer.
      if (t === 30 && toPx(p.body.y) <= this.heightPx) p.body.vy = -0x04000;
      if (t > 30) {
        p.body.vy += 0x00280;
        p.body.y += velToSub(p.body.vy);
      }
    }
    const end = burst
      ? this.pitDeaths.has(p)
        ? burst.pitFrames
        : burst.frames
      : thrown && dt
        ? thrown.landed !== null
          ? thrown.landed + dt.afterLand
          : dt.maxFrames
        : hop
          ? this.pitDeaths.has(p)
            ? hop.pitFrames
            : hop.frames
          : DEATH_FRAMES[this.deathStyle];
    if (t === end) {
      this.pitDeaths.delete(p);
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
    this.throwDeaths.delete(p);
    this.respawnTimers.set(p, COOP_RESPAWN_FRAMES);
    p.def.behaviour.onRespawn?.(p, this);
  }

  /* ---------- Pipes & zones ---------- */

  private checkPipes(p: Player, input: InputFrame): void {
    const b = p.body;
    // A hero that flies enters pipes in mid-air too (CharacterDef.pipesAirborne, VV-27).
    if (!b.onGround && !p.def.pipesAirborne) return;
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

  /**
   * A beam down still on its way starts just above the camera's top (a tall map's lower screens
   * too). A scene that moves the camera itself after the start calls it again.
   */
  alignBeam(): void {
    if (this.beam?.dir !== 'down') return;
    for (const s of this.beam.streaks) if (s.landed < 0) s.top = this.camera.pxY - BEAM_H;
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

  /**
   * Checkpoints: the furthest one a player has passed, if it lies beyond the last one sent. A map
   * may hold several (0.4.55, BOWSER'S CASTLE has five): each is sent once as it is passed, and a
   * respawn at one sends it again and still reaches the later ones. With one checkpoint this is
   * the original's single midpoint.
   */
  private checkZones(): void {
    let best: { x: number; y: number } | null = null;
    for (const z of this.level.zones) {
      if (
        z.kind === 'checkpoint' &&
        z.x > this.lastCheckpointX &&
        (!best || z.x > best.x) &&
        this.players.some((p) => p.body.x >= tileToSub(z.x))
      ) {
        best = { x: z.x, y: z.y ?? 12 };
      }
    }
    // Extra Checkpoints (Classic cheat): the locked levels' halfway points count as checkpoints.
    for (const c of this.cheatCheckpoints)
      if (
        c.x > this.lastCheckpointX &&
        (!best || c.x > best.x) &&
        this.players.some((p) => p.body.x >= tileToSub(c.x))
      )
        best = { x: c.x, y: c.y };
    if (best) {
      this.lastCheckpointX = best.x;
      this.events.push({ type: 'checkpoint', x: best.x, y: best.y });
    }
    if (this.storyMode) this.checkSectionMusic();
  }

  /**
   * A `music` zone (story only): the furthest one a player has passed sets the section's tune;
   * when it changes it starts at once (the clock's tempo kept), unless a Starman's tune is on,
   * whose end brings back this.music.
   */
  private checkSectionMusic(): void {
    let best: { x: number; music: string } | null = null;
    for (const z of this.level.zones)
      if (
        z.kind === 'music' &&
        (!best || z.x > best.x) &&
        this.players.some((p) => !p.dead && p.body.x >= tileToSub(z.x))
      )
        best = z;
    if (!best || best.music === this.music) return;
    this.sectionMusic = best.music;
    if (!this.players.some((p) => p.star > 0)) this.audio.playMusic(this.music);
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
    p.def.behaviour.onLevelClear?.(p);
    p.body.x = tileToSub(pole.tx) - p.body.w + px(2);
    p.facing = 1;
    p.anim = 'climb';
    this.audio.stopMusic();
    this.audio.sfx('flagpole');
    // FlagPole.touchPlayer: scored by the player's vertical middle; the text follows the flag.
    const score = pole.scoreForGrab((p.body.y + p.body.h / 2) / px(1));
    this.addScore(score);
    // No points float where the HUD shows no score (a training stage: WorldStart.scorePopups).
    if (this.scorePopups) this.spawn(new FlagScore(pole, String(score)));
    const exit = this.level.zones.find((z): z is Zone & { kind: 'exit' } => z.kind === 'exit');
    const walkTo = tileToSub((exit?.x ?? pole.tx) + 6) + px(8);
    // StatManager.touchFlag keeps the HUD time (timeLeftBeatLevel); when the tally ends,
    // timeScoreConverterTmrLsr sets off that many fireworks if its last digit is 1, 3 or 6.
    const digit = (this.time ?? 0) % 10;
    // Infinite Time (Classic cheat): StatManager.convertTimeToScore raises the flag at once, with
    // no tally and no fireworks.
    const fireworks = !this.cheats.infiniteTime && (digit === 1 || digit === 3 || digit === 6) ? digit : 0;
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
          if (this.rules === 'classic') classicRules().clearHop?.(this, p);
        }
        if (c.t >= 20) {
          c.phase = 'walk';
          c.t = 0;
          p.facing = 1;
          // Classic defs: down at the pole's foot, the walk starts on the ground (see 'walk').
          if (this.rules === 'classic') b.onGround = true;
          // Scroll-back camera: MarioBase's flag-pole hop sets rightScrollPosOvRd to the hero's
          // screen x, so the screen follows the walk to the castle from there.
          if (this.camera.scrollBack && p.def.flagWalkFollow) c.camHold = p.centerX - this.camera.x;
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
        const landed = this.map.isSolid(tileAt(b.x + (b.w >> 1)), feetRow);
        if (landed) {
          b.y = tileToSub(feetRow) - b.h;
          b.vy = 0;
        } else b.y = before + velToSub(b.vy);
        // Classic defs pick their walk pose by onGround (an air pose otherwise: Samus's
        // somersault crouch, Bill and Ryu falling) and by vx (standing still at 0: Samus, Sophia
        // III): the scripted walk stands on the ground and moves at its 1 px a frame.
        if (this.rules === 'classic') {
          b.onGround = landed;
          b.vx = 0x01000;
        }
        if (c.camHold !== undefined && p.centerX - this.camera.x > c.camHold)
          this.camera.x = Math.min(this.camera.maxX, p.centerX - c.camHold);
        if (b.x >= c.walkTo) {
          c.phase = 'countdown';
          c.t = 0;
          if (this.rules === 'classic') b.vx = 0;
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
        if (this.time && this.time > 0 && !this.cheats.infiniteTime) {
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
          this.events.push({ type: 'exit', next: this.exitNext(exit?.next) });
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
    p.def.behaviour.onLevelClear?.(p);
    this.audio.stopMusic();
    this.bossClear = { t: 0 };
    this.bossPlayer = p;
  }
  private bossPlayer: Player | null = null;

  /**
   * Scroll-back camera after the axe (Level.scrollScreen with keepPlayerOnRight): the hero walks
   * on to near the screen's right edge (rightScrollPos = SCREEN_WIDTH - hWidth/2 - 8 Flash px);
   * once stopped at the exit, the screen pans on at 150 Flash px/s until they are back at its
   * centre.
   */
  private bossClearCamera(c: NonNullable<World['bossClear']>, p: Player): void {
    // BowserAxe.axeEnd: bowserAxe = null, so the screen may scroll on to Toad (lifted here, after
    // the frame the axe was taken in, so that frame's ordinary follow does not recentre the hero).
    if (this.preAxeMaxX !== null) {
      this.camera.maxX = this.preAxeMaxX;
      this.preAxeMaxX = null;
    }
    c.camRight ??= px(SCREEN_W - 4) - (p.body.w >> 1);
    if (c.stop !== undefined && !c.coast && c.camRight > SCROLL_BACK_CENTER)
      c.camRight = Math.max(SCROLL_BACK_CENTER, c.camRight - BOSS_PAN);
    const want = p.centerX - c.camRight;
    if (want > this.camera.x) this.camera.x = Math.min(this.camera.maxX, want);
  }

  /**
   * The castle whose fake gets the unmask scenes (docs/STORY.md 2.3a): the campaign's 1-4 to 8-4
   * (its main level id; 8-4 since 0.4.54), with the bridge's disguised Bowser `b`; null elsewhere
   * (classic play, the real king's castle, the Lost Kingdom, which keep today's unmasking).
   */
  private unmaskCastle(b: Bowser): string | null {
    const id = this.level.parent ?? this.level.id;
    if (!this.storyMode || b.fake || !REMARK_CASTLES.includes(id) || this.trueForm() === 0) return null;
    return id;
  }

  /**
   * The true form under this castle's Bowser (Bowser trueFormOf): the campaign's fakes 1..8 (8:
   * the campaign's 8-4, 0.4.54), else 0 (the real king; classic play, which has no fakes).
   */
  trueForm(): number {
    return this.storyMode ? trueFormOf(this.state.world, this.level.parent ?? this.level.id) : 0;
  }

  /**
   * The villain costume fake Bowser `b` wears (0.4.47, roadmap #31): the castle's world (2-8) in
   * the campaign's castles 2-4 to 8-4 (those with the unmask scenes; World 1's fake wears the
   * plain king suit; 8-4's, since 0.4.54, the Plutonium Boss), else 0.
   */
  costumeOf(b: Bowser): number {
    const w = this.unmaskCastle(b) ? this.trueForm() : 0;
    return w >= 2 && w <= 8 ? w : 0;
  }

  /**
   * Bowser `b` took a killing hit (Bowser.flipOut): in a castle with the unmask scenes his
   * disguise bursts, the creature drops onto the bridge dazed, and the hero jumps over it to the
   * axe (world/unmask.ts). True when the scene started (he stays, harmless, until the axe).
   */
  unmaskOnKill(b: Bowser): boolean {
    const level = this.unmaskCastle(b);
    if (!level || this.unmask || this.bossClear) return false;
    // Beaten from the foot of the bridge, the axe is often still past the screen's edge (not
    // spawned): bring the map's entities in up to it, so the hero can run there.
    const at = this.level.entities.find((e) => e.type === 'axe');
    if (at && !this.entities.some((e) => e instanceof Axe)) this.spawnUpTo(tileToSub(at.x));
    const axe = this.entities.find((e): e is Axe => e instanceof Axe && e.alive);
    // A shot that lands after the hero died: no one runs to the axe (the death goes on, as before).
    const hero = axe ? this.nearestTo(axe) : null;
    if (!level || !axe || !hero || this.unmask || this.bossClear) return false;
    if (!b.burst(this, true)) return false;
    this.unmask = new CastleUnmask('killed', b, hero, axe, level);
    this.unmask.start(this);
    return true;
  }

  /** A campaign castle's fake that fell off the level (its castle id): the line comes at the axe. */
  private fakeFell: string | null = null;

  /**
   * Bowser `b` fell off the bottom of the level alive (into the lava or a pit, 0.4.43). In a
   * castle with the unmask scenes his disguise is gone with him: the hero says his line at the axe.
   */
  bowserFell(b: Bowser): void {
    const level = this.unmaskCastle(b);
    if (level) this.fakeFell = level;
  }

  /**
   * Player `p` touched the axe: with the fake still standing in a castle with the unmask scenes,
   * his disguise bursts and the hero looks at the creature (and says the remark) before the axe
   * goes (world/unmask.ts). True when that scene started.
   */
  private unmaskAtAxe(axe: Axe, p: Player): boolean {
    const b = this.entities.find(
      (e): e is Bowser => e instanceof Bowser && e.alive && !e.fake && e.standing === 0,
    );
    // The fake fell off the level (0.4.43): the hero still looks and says his line.
    if (!b && this.fakeFell && !this.unmask) {
      this.unmask = new CastleUnmask('fell', null, p, axe, this.fakeFell);
      this.fakeFell = null;
      this.unmask.start(this);
      return true;
    }
    const level = b ? this.unmaskCastle(b) : null;
    if (!b || !level || this.unmask) return false;
    this.unmask = new CastleUnmask('axe', b, p, axe, level);
    this.unmask.start(this);
    return true;
  }

  /** The living player nearest the axe (co-op: that one acts in the unmask scenes), or null. */
  private nearestTo(axe: Axe): Player | null {
    const live = this.players.filter((p) => !p.dead);
    const d = (p: Player) => Math.abs(p.body.x - axe.body.x);
    return live.reduce<Player | null>((a, p) => (!a || d(p) < d(a) ? p : a), null);
  }
  /** The hero who took the axe (Toad's "THANK YOU <hero>!"), or null before the bridge is cut. */
  get castleHero(): Player['def'] | null {
    return this.bossPlayer?.def ?? null;
  }

  /**
   * Whether the axe here breaks the wand (docs/STORY.md 2.12): the campaign's last castle only
   * (story/finale.ts FINALE.castle: SMB 8-4 until Bowser's Castle comes; its main level and its
   * areas), never classic play and never the Lost Levels' 8-4.
   */
  private get wandScene(): boolean {
    return this.storyMode && (this.level.parent ?? this.level.id) === FINALE.castle;
  }

  /**
   * The wand spins up out of the falling king's hand (or, if fireballs already beat him, from the
   * bridge before the axe) to a spot over the lava, where it breaks and the rift opens.
   */
  private breakWand(bowser: Bowser | undefined, p: Player): void {
    let handX: number;
    let feet: number;
    if (bowser) {
      const b = bowser.body;
      handX = toPx(b.x + (b.w >> 1)) + bowser.facing * 10;
      feet = toPx(b.y + b.h);
    } else {
      handX = toPx(p.body.x) - 72;
      feet = toPx(p.body.y + p.body.h) + 16;
    }
    // The rift opens over the lava in view: the hero at the axe sees only the bridge's last
    // tiles, so a king further left sends his wand flying in from the screen's edge.
    const riftX = Math.max(handX, this.camera.pxX + 44);
    this.spawn(new WandBreak(handX, feet - 16, riftX, feet - 56));
  }

  private updateBossClear(inputs: readonly InputFrame[]): void {
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
    for (const e of this.entities)
      if (
        e instanceof Bowser ||
        ((e instanceof WandPoof || e instanceof WandBreak || e instanceof CostumePile) && e.alive)
      )
        e.update(this);
    // The axe drops the bridge's Bowser; a fake one elsewhere in the castle is left alone.
    const bowser = this.entities.find((e): e is Bowser => e instanceof Bowser && e.alive && !e.fake);
    // No points: BowserAxe.as only calls breakBridgeStart/Inc/End (Bowser.as), never die(), and
    // the fall below the screen (AnimatedObject.checkDosSides -> destroy) scores nothing either.
    if (bowser && c.t === 60) {
      bowser.fallDead(this);
      this.audio.sfx('bowser-fall');
    }
    // The campaign's 8-4: as the king drops, his wand breaks over the lava (docs/STORY.md 2.12),
    // and the walk waits for its pieces to swirl into the rift.
    const wand = this.wandScene;
    if (wand && c.t === 60) this.breakWand(bowser, p);
    if (c.t === 120) this.audio.playJingle('castle-clear');
    const exit = this.level.zones.find((z): z is Zone & { kind: 'exit' } => z.kind === 'exit');
    if (c.t > (wand ? 60 + WAND_SCENE_FRAMES + 10 : 150) && c.stop === undefined) {
      p.anim = 'walk';
      if (c.t % 4 === 0) p.walkFrame = (p.walkFrame + 1) % 3;
      p.facing = 1;
      const aw = p.def.axeWalk;
      walkStep(this, p, aw ? velToSub(aw.speed) : px(1));
      // The screen follows the walk, so Toad (or the princess) comes into view.
      if (!this.camera.scrollBack) this.camera.follow(p.body.x);
      this.spawnPending();
      // The walk ends on touching the exit marker, the tile before Toad (the original's
      // Level.as stops the player on touchedExit); without one it lasts three seconds.
      const reached = exit ? p.body.x + p.body.w >= tileToSub(exit.x) : c.t >= 330;
      if (reached || c.t >= 750) {
        c.stop = c.t;
        p.anim = 'idle';
        if (aw) c.coast = aw.speed;
      }
    } else if (c.coast) {
      // CharacterDef.axeWalk (ML-C26): a quick slide to a stop after the walk.
      const aw = p.def.axeWalk as NonNullable<CharacterDef['axeWalk']>;
      c.coast = damp(c.coast, aw.stop);
      if (c.coast < aw.snap) c.coast = 0;
      else walkStep(this, p, velToSub(c.coast));
    }
    if (this.camera.scrollBack) this.bossClearCamera(c, p);
    if (c.stop === undefined) return;
    // Then Toad's thanks and 1.5 s later the news (the original's ADD_TXT_TMR_DUR), which stays
    // until OK (owner note 4: text never moves by itself; the original went on to the next level
    // 3.5 s later, WIN_END_TMR_DUNGEON_DUR). The last castle says instead that the quest is over
    // (ScreenManager.addTxtTmrHandler, GameTextMessages.QUEST_IS_OVER) and, on OK, hands over to
    // the ending, where the credits roll.
    // The Lost Levels' last castles (8-4, 9-4, D-4) say nothing themselves: the ending's card
    // (Game.showLostEnding) is the thanks, over the level, when Toad's thanks would start, so
    // no line is said twice.
    // A Classic mode run (classicEnd, G-001/G-002): a castle marked `next=end` that is not its
    // map set's last is an ordinary one, on to the next world; the last says the quest is over.
    const next = this.exitNext(exit?.next);
    const s = c.t - c.stop;
    if (next === 'end' && !this.classicEnd && (this.level.parent ?? this.level.id).startsWith('ll-')) {
      if (s >= 30) {
        this.events.push({ type: 'exit', next });
        c.t = -100000;
      }
      return;
    }
    const thanks = `THANK YOU ${fontText(p.def.thanksName ?? p.def.name)}!`;
    if (s === 30) this.castleText = [thanks];
    const ok = c.at !== undefined && cardContinues(s - c.at, inputs, CASTLE_OK_KEYS);
    const leave = () => {
      this.events.push({ type: 'exit', next });
      c.t = -100000;
      delete c.at;
    };
    // The campaign's castles (docs/STORY.md 2.4-2.12) tell their own news in two pages instead:
    // the fake Bowser's true form, then on OK the story, each read out; OK on the second exits.
    // The Lost castles keep the NES text (their story is Chapter 2).
    const pages = this.storyMode ? castlePages(this.level.parent ?? this.level.id) : undefined;
    if (pages) {
      const page = s === 120 ? pages.reveal : ok && c.page === 0 ? (pages.news ?? null) : null;
      if (page) {
        c.page = page === pages.reveal ? 0 : 1;
        c.at = s;
        this.castleText = [thanks, '', ...page];
        this.events.push({ type: 'say', text: [thanks, ...page, 'OK to continue.'].join(' ') });
      } else if (ok) leave();
      return;
    }
    if (s === 120) {
      // In the story 8-4 is no longer the end (story/finale.ts endMoved): another castle.
      const end = next === 'end' && !(this.storyMode && endMoved(this.level.parent ?? this.level.id));
      // CharacterDef.endingGreeter: who stands in the princess's place greets the hero instead.
      const greeter = end ? this.player.def.endingGreeter : undefined;
      const news = greeter
        ? [...greeter.news]
        : end
          ? ['YOUR QUEST IS OVER.']
          : anotherCastle(p.def.rescueName);
      this.castleText.push('', ...news);
      c.at = s;
      this.events.push({ type: 'say', text: [thanks, ...news, 'OK to continue.'].join(' ') });
    } else if (ok) leave();
  }

  /**
   * The pull of the pits under `p` this frame (PitVacuum.updateStats: any vacuum whose column the
   * hitbox overlaps, edges touching, at any height): sideways toward each pit's middle, left and
   * right at most once each (Character.pulledLeft/pulledRight), or null over no pit.
   */
  private pitPullOn(p: Player): -1 | 0 | 1 | null {
    if (this.pitVacuums === undefined)
      this.pitVacuums = isSwimLevel(this.level) ? pitVacuumColumns(this.map) : null;
    const vac = this.pitVacuums;
    if (!vac) return null;
    const b = p.body;
    let left = false;
    let right = false;
    let any = false;
    for (let tx = Math.max(0, tileAt(b.x - 1)); tx <= tileAt(b.x + b.w) && tx < vac.length; tx++) {
      const v = vac[tx];
      if (!v) continue;
      any = true;
      if (v === PULL_LEFT) left = true;
      else if (v === PULL_RIGHT) right = true;
    }
    if (!any) return null;
    return ((right ? 1 : 0) - (left ? 1 : 0)) as -1 | 0 | 1;
  }

  /**
   * Where an exit marked `marked` leads: a Classic mode run's way on in place of `end` at an
   * ordinary castle or flagpole (classicEnd: Lost Levels 8-4 and 9-4, G-001/G-002).
   */
  private exitNext(marked = 'end'): string {
    return marked === 'end' ? (this.classicEnd?.next ?? marked) : marked;
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
      ...(this.talkHint ? { talkHint: this.talkHint } : {}),
      ...(this.upHint ? { upHint: this.upHint } : {}),
      prompts: this.inControl,
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
    // A flooded area in a dry theme (a map's `swim: true`: Fred's tunnel under 8-4): its murky
    // water fills the screen from the wave row down, behind everything (FLOODED).
    if (this.level.swim && !isWaterTheme(theme) && Number.isFinite(this.waterTop)) {
      const top = toPx(this.waterTop) - 8;
      r.rect(0, top, SCREEN_W, this.heightPx - top, FLOODED[theme] ?? FLOODED_WATER);
    }
    for (const e of this.entities)
      if (e.alive && e.layer === 'back' && this.drawn(e, view)) e.render(r, view);
    this.backdrop?.(screen);
    if (this.inPipe) for (const p of this.players) this.renderPlayer(r, view, p);
    renderTiles(r, view, this.map);
    if (this.assist.safetyFloor) this.renderSafetyFloor(r, view);
    for (const e of this.entities)
      if (e.alive && e.layer === 'main' && this.drawn(e, view)) e.render(r, view);
    if (!this.inPipe) for (const p of [...this.players].reverse()) this.renderPlayer(r, view, p);
    this.renderBeam(r, view);
    for (const e of this.entities)
      if (e.alive && e.layer === 'front' && this.drawn(e, view)) e.render(r, view);
    this.renderWarpText(r, view);
    this.renderCastleText(screen, view);
  }

  /** Not skipped this frame by a Classic hit's blink or flicker (Enemy.classicHidden). */
  private drawn(e: Entity, view: View): boolean {
    return !(e instanceof Enemy) || !e.classicHidden(view);
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
  private fallSpot(x1: number, w1: number, w: number): number | null {
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
    return null;
  }

  /**
   * A fall arrival for a body wider than a tile (Sophia III's tank): centred on column `tx` unless
   * that clips a solid tile on the way down to the column's floor; then flush with the column's
   * left or right side, whichever drops clear (the drops are laid out for one-tile heroes).
   */
  private wideFall(tx: number, x: number, w: number): number | null {
    const map = this.map;
    let floor = 0;
    while (floor < map.height && !map.isSolid(tx, floor)) floor++;
    const clear = (x0: number) => {
      for (let c = tileAt(x0); c <= tileAt(x0 + w - 1); c++)
        for (let ty = 0; ty < floor; ty++) if (map.isSolid(c, ty)) return false;
      return true;
    };
    for (const c of [x, tileToSub(tx), tileToSub(tx + 1) - w]) if (clear(c)) return c;
    return null;
  }

  /** The last row of the first stretch where column `tx` has a solid tile on either side. */
  private gapLip(tx: number): number {
    const map = this.map;
    let lip = -1;
    for (let ty = 0; ty < map.height; ty++) {
      const narrow = map.isSolid(tx - 1, ty) || map.isSolid(tx + 1, ty);
      if (narrow) lip = ty;
      else if (lip >= 0) break;
      if (map.isSolid(tx, ty)) break;
    }
    return lip;
  }

  /**
   * A screen edge pushed the player back into a wall: that undoes a head-bump corner slip (the
   * body slipped sideways past a block's corner, the edge put it back under the block), so
   * undo this frame's move up or down too, as the bump it should have been.
   */
  private unsqueeze(p: Player): void {
    const b = p.body;
    if (p.stairs || p.vine || !this.overlapsSolid(b)) return;
    const y = b.prevBottom - b.h;
    if (y === b.y || this.overlapsSolid({ x: b.x, y, w: b.w, h: b.h })) return;
    b.y = y;
    if (b.vy < 0) b.vy = 0;
  }

  /**
   * A body pinned against a wall by the scroll's left edge moved to the nearest free place: up or
   * down (the nearer, up first, at most two tiles), else just past the wall. False if none.
   */
  private eject(p: Player): boolean {
    const b = p.body;
    const at = (x: number, y: number) => ({ x, y, w: b.w, h: b.h });
    for (let d = 1; d <= 32; d++)
      for (const dy of [-d, d]) {
        const y = b.y + px(dy);
        if (y >= this.camera.y + px(HUD_BOTTOM) && !this.overlapsSolid(at(b.x, y))) {
          b.y = y;
          return true;
        }
      }
    for (let x = b.x; x < this.camera.right - b.w; x += px(1))
      if (!this.overlapsSolid(at(x, b.y))) {
        b.x = x;
        return true;
      }
    return false;
  }

  /** Whether a box overlaps a solid tile. */
  private overlapsSolid(b: { x: number; y: number; w: number; h: number }): boolean {
    for (let ty = tileAt(b.y); ty <= tileAt(b.y + b.h - 1); ty++)
      for (let tx = tileAt(b.x); tx <= tileAt(b.x + b.w - 1); tx++) if (this.map.isSolid(tx, ty)) return true;
    return false;
  }

  /**
   * The left edge (subpixels) of the left-most live camera anchor (Entity.anchorsCamera), or null.
   * None once the level is won (flagpole or axe): the walk to the castle goes on past it.
   */
  cameraAnchor(): number | null {
    if (this.clear || this.bossClear) return null;
    let x: number | null = null;
    for (const e of this.entities)
      if (e.alive && e.anchorsCamera && (x === null || e.body.x < x)) x = e.body.x;
    return x;
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

  /** Shake the screen for `frames` by `amp` px (drawn only without reduce flashing). */
  shake(frames: number, amp = 2): void {
    if (this.shakeFrames <= 0 || amp > this.shakeAmp) this.shakeAmp = amp;
    this.shakeFrames = Math.max(this.shakeFrames, frames);
  }

  /**
   * 4-2's anchor drop `drop` saw a player land on its floor: with the anchor scene due
   * (anchorStory), it starts, the player nearest the anchor as the hero. False when it is not due
   * (the drop falls on its own, as outside the story).
   */
  startAnchorScene(drop: AnchorDrop): boolean {
    const story = this.anchorStory;
    if (!story || this.anchorScene) return false;
    const live = this.players.filter((p) => !p.dead && !p.out);
    const d = (p: Player) => Math.abs(p.body.x - drop.body.x);
    const hero =
      live.find((p) => p === this.players[0]) ??
      live.reduce<Player | null>((a, p) => (!a || d(p) < d(a) ? p : a), null);
    if (!hero) return false;
    this.anchorStory = null;
    this.anchorScene = new AnchorScene(drop, hero, story);
    this.anchorScene.start(this);
    return true;
  }

  /**
   * The anchor scene is over: everyone goes up `drop`'s chain into the airship, as a climb off its
   * top would (its `vine` zone's link, an anchor-chain arrival).
   */
  boardChain(drop: AnchorDrop): void {
    const z = this.level.zones.find(
      (v): v is Zone & { kind: 'vine' } => v.kind === 'vine' && v.x === drop.tx && v.y === drop.foot,
    );
    if (z) return this.transfer(z.target, 'climb', true);
    // No link (a level without one): play just goes on.
    for (const p of this.players) p.frozen = false;
  }

  /** The warp zone over column `tx` loses its world numbers and welcome text (pipe smashed). */
  smashWarpAt(tx: number): void {
    for (const z of this.level.zones)
      if (z.kind === 'warp' && tx >= z.x && tx < z.x + z.w) this.smashedWarps.add(z);
  }

  /** The screen's vertical offset this frame (a shake), 0 with reduce flashing. */
  get shakeY(): number {
    if (this.shakeFrames <= 0 || this.ctx.reduceFlashing) return 0;
    return (this.shakeFrames >> 1) & 1 ? this.shakeAmp : -this.shakeAmp;
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
    const burst = p.dead && this.deathStyle === 'hop' ? p.def.deathBurst : undefined;
    if (burst) {
      // A bursting death (CharacterDef.deathBurst): only the pieces, none after a pit.
      if (this.pitDeaths.has(p)) return;
      const t = this.deathTimers.get(p) ?? 0;
      const s = p.def.sprite(p, view.frame, view.reduceFlashing);
      const sheet = view.assets.sheet(burst.sheet, s.palette);
      for (const piece of burstPieces(burst, p, t, view.reduceFlashing))
        r.sprite(sheet, piece.frame, Math.round(piece.x) - 4 - view.camX, Math.round(piece.y) - 4);
      return;
    }
    if (p.dead && this.deathStyle !== 'hop') {
      const t = this.deathTimers.get(p) ?? 0;
      const draw = () => this.drawPlayer(r, view, p);
      if (renderDeath(this.deathStyle, r, view, p, t, this.heightPx, draw)) return;
      return draw();
    }
    // A hero's own look (Classic SMBC's hit looks, CharacterDef.drawLook), else the blink.
    const look = p.def.drawLook?.(p, view.frame, view.reduceFlashing);
    if (look) {
      if (look.visible) translucent(r, look.alpha, () => this.drawPlayer(r, view, p));
      return;
    }
    if (!p.visible(view.frame)) return;
    this.drawPlayer(r, view, p);
  }

  /**
   * SpriteSpec.rider (the Classic Yoshi mount's rider, YM-20): its frame centred on `cx`, cut at
   * `top + dy`, the legs below the cut not drawn.
   */
  private drawRider(
    r: Renderer,
    view: View,
    u: NonNullable<SpriteSpec['rider']>,
    cx: number,
    top: number,
  ): void {
    const sheet = view.assets.sheet(u.sheet, u.palette);
    const f = sheet.frames.get(u.frame);
    const w = f?.w ?? 16;
    const h = f?.h ?? 16;
    const keep = h - (h <= 16 ? 5 : 13);
    const x = cx - (w >> 1);
    const y = top + u.dy - keep;
    clipped(r, x, y, w, keep, () => r.sprite(sheet, u.frame, x, y, u.flip));
  }

  private drawPlayer(r: Renderer, view: View, p: Player): void {
    const s = p.def.sprite(p, view.frame, view.reduceFlashing);
    const sheet = view.assets.sheet(s.sheet, s.palette);
    const f = sheet.frames.get(s.frame);
    const w = f?.w ?? 16;
    if (s.rotate !== undefined || s.flipY) {
      // Turned or upside down (Sophia III on a wall or ceiling): centred on the hitbox.
      const h = f?.h ?? 16;
      const side = s.rotate === 90 || s.rotate === 270;
      const bw = side ? h : w;
      const bh = side ? w : h;
      const cx = toPx(p.body.x + (p.body.w >> 1)) - view.camX;
      const cy = toPx(p.body.y + (p.body.h >> 1));
      r.sprite(sheet, s.frame, cx - (bw >> 1), cy - (bh >> 1), s.flip, s.flipY, s.rotate ?? 0);
    } else {
      const x = toPx(p.body.x) - view.camX - (s.flip ? w - toPx(p.body.w) - s.offsetX : s.offsetX);
      r.sprite(sheet, s.frame, x, toPx(p.body.y) - s.offsetY, s.flip);
      if (s.rider)
        this.drawRider(
          r,
          view,
          s.rider,
          s.flip ? x + w - s.rider.dx : x + s.rider.dx,
          toPx(p.body.y) - s.offsetY,
        );
    }
    if (this.coop && p.index > 0 && !p.dead) {
      // Small "2" tag above player two so both players can tell who is who.
      r.text(view.assets.sheet('font'), '2', toPx(p.body.x) - view.camX + 2, toPx(p.body.y) - s.offsetY - 10);
    }
  }
}

/** Widest castle line (characters): the screen's 32 less a margin each side. */
const CASTLE_COLS = 28;

/**
 * The news after a castle that is not the last (GameTextMessages.ANOTHER_CASTLE). A Classic hero
 * with a `rescueName` (the original's skin name, ScreenManager.addTxtTmrHandler) has it in place
 * of "our princess", wrapped to fit; without one the two lines are today's.
 */
export function anotherCastle(rescueName?: string): string[] {
  if (rescueName === undefined) return ['BUT OUR PRINCESS IS IN', 'ANOTHER CASTLE!'];
  const first = `BUT ${fontText(rescueName)} IS IN`;
  if (first.length <= CASTLE_COLS) return [first, 'ANOTHER CASTLE!'];
  return wrapText(`${first} ANOTHER CASTLE!`, CASTLE_COLS);
}

/** A PitVacuum's pull (PitVacuum.setVacDir): "down-right", "down", "down-left". */
const PULL_RIGHT = 1;
const PULL_DOWN = 2;
const PULL_LEFT = 3;

/**
 * Classic SMBC's PitVacuums (G-013; Level.as 762-777 and setUpPitVacs): one on every empty tile of
 * the bottom row; a run of them is one pit, whose left half pulls right, its middle tile straight
 * down and its right half left, toward the middle.
 */
export function pitVacuumColumns(map: TileMap): Int8Array {
  const out = new Int8Array(map.width);
  const row = map.height - 1;
  const empty = (tx: number) => tx < map.width && map.collisionAt(tx, row) === 'none';
  for (let start = 0; start < map.width;) {
    if (!empty(start)) {
      start++;
      continue;
    }
    let end = start;
    while (empty(end + 1)) end++;
    const mid = (start + end) / 2;
    for (let tx = start; tx <= end; tx++)
      out[tx] = tx < mid ? PULL_RIGHT : tx === mid ? PULL_DOWN : PULL_LEFT;
    start = end + 1;
  }
  return out;
}
