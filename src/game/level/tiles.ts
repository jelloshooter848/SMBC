/**
 * Tile vocabulary shared by every level. A tile id is an index into TILES; the themed atlas
 * decides how it looks, the TileDef decides how it behaves.
 */
export type Collision = 'none' | 'solid' | 'top';

/**
 * `poison`: a Lost Levels poison mushroom, which hurts the player like an enemy. `clock`: a Lost
 * Levels Clock (+100 time); its block then holds a coin (see T.Q_CLOCK).
 */
export type BlockContent =
  | 'coin'
  | 'powerup'
  | '1up'
  | 'star'
  | 'coins10'
  | 'vine'
  | 'poison'
  | 'clock'
  /** Reveals the teleport pad hidden in this block (a `teleport` zone with `block=x,y`). */
  | 'teleporter'
  /**
   * The Top Secret Area's blocks (0.4.10): always a fire flower, always a mushroom (each hero
   * takes them as its own power, as from any block), or a Yoshi egg (entities/objects/yoshi-egg.ts).
   */
  | 'flower'
  | 'mushroom'
  | 'egg'
  /** Lays the hidden path of the `path` zone whose `block=x,y` is this block (World.layPath). */
  | 'path'
  | 'none';

export interface TileDef {
  readonly id: number;
  readonly name: string;
  readonly collision: Collision;
  /** Block behaviour when hit from below. */
  readonly block?: { kind: 'question' | 'brick' | 'hidden'; content: BlockContent };
  /** Picked up on touch (coins). */
  readonly pickup?: 'coin';
  /** Kills the player on touch. */
  readonly hazard?: boolean;
  /** Draw in front of the player (nothing yet; reserved for editor layers). */
  readonly decor?: boolean;
}

const defs: TileDef[] = [];
function def(name: string, collision: Collision, extra: Partial<TileDef> = {}): number {
  const id = defs.length;
  defs.push({ id, name, collision, ...extra });
  return id;
}

export const T = {
  AIR: def('air', 'none'),
  GROUND: def('ground', 'solid'),
  BRICK: def('brick', 'solid', { block: { kind: 'brick', content: 'none' } }),
  BRICK_COIN: def('brick-coin', 'solid', { block: { kind: 'brick', content: 'coin' } }),
  BRICK_COINS10: def('brick-coins10', 'solid', { block: { kind: 'brick', content: 'coins10' } }),
  BRICK_STAR: def('brick-star', 'solid', { block: { kind: 'brick', content: 'star' } }),
  BRICK_POWERUP: def('brick-powerup', 'solid', { block: { kind: 'brick', content: 'powerup' } }),
  BRICK_POISON: def('brick-poison', 'solid', { block: { kind: 'brick', content: 'poison' } }),
  BRICK_1UP: def('brick-1up', 'solid', { block: { kind: 'brick', content: '1up' } }),
  BRICK_VINE: def('brick-vine', 'solid', { block: { kind: 'brick', content: 'vine' } }),
  Q_COIN: def('question-coin', 'solid', { block: { kind: 'question', content: 'coin' } }),
  Q_POWERUP: def('question-powerup', 'solid', { block: { kind: 'question', content: 'powerup' } }),
  Q_POISON: def('question-poison', 'solid', { block: { kind: 'question', content: 'poison' } }),
  Q_1UP: def('question-1up', 'solid', { block: { kind: 'question', content: '1up' } }),
  Q_STAR: def('question-star', 'solid', { block: { kind: 'question', content: 'star' } }),
  HIDDEN_COIN: def('hidden-coin', 'none', { block: { kind: 'hidden', content: 'coin' } }),
  HIDDEN_1UP: def('hidden-1up', 'none', { block: { kind: 'hidden', content: '1up' } }),
  HIDDEN_POWERUP: def('hidden-powerup', 'none', { block: { kind: 'hidden', content: 'powerup' } }),
  HIDDEN_POISON: def('hidden-poison', 'none', { block: { kind: 'hidden', content: 'poison' } }),
  USED: def('used', 'solid'),
  HARD: def('hard', 'solid'),
  PIPE_TL: def('pipe-top-left', 'solid'),
  PIPE_TR: def('pipe-top-right', 'solid'),
  PIPE_BL: def('pipe-body-left', 'solid'),
  PIPE_BR: def('pipe-body-right', 'solid'),
  /** Rim of a pipe hanging from the ceiling (The Lost Levels): the opening faces down. */
  PIPE_BOTTOM_L: def('pipe-bottom-left', 'solid'),
  PIPE_BOTTOM_R: def('pipe-bottom-right', 'solid'),
  /** Horizontal pipe (1-2 exit, 1-1 bonus exit). */
  PIPE_H_TL: def('pipe-h-top-left', 'solid'),
  PIPE_H_TR: def('pipe-h-top-right', 'solid'),
  PIPE_H_BL: def('pipe-h-bottom-left', 'solid'),
  PIPE_H_BR: def('pipe-h-bottom-right', 'solid'),
  COIN: def('coin', 'none', { pickup: 'coin' }),
  FLAG_SHAFT: def('flag-shaft', 'none'),
  FLAG_BALL: def('flag-ball', 'none'),
  TREE_TOP: def('tree-top', 'solid'),
  TREE_TRUNK: def('tree-trunk', 'none'),
  MUSHROOM_TOP: def('mushroom-top', 'solid'),
  MUSHROOM_STEM: def('mushroom-stem', 'none'),
  // Scenery only: the original's wavesLava is a back-layer Scenery (Level.as, Scenery.as), so a
  // player falls through it and dies off the bottom of the screen like in any pit.
  LAVA: def('lava', 'none'),
  BRIDGE: def('bridge', 'solid'),
  CHAIN: def('chain', 'none'),
  CASTLE_BRICK: def('castle-brick', 'solid'),
  WATER: def('water', 'none'),
  CLOUD_BLOCK: def('cloud-block', 'solid'),
  /** Bullet Bill blaster: the barrel (fires; the world builds a launcher on each) and its stand. */
  BLASTER_TOP: def('blaster-top', 'solid'),
  BLASTER_BASE: def('blaster-base', 'solid'),
  /** Background castle walls (8-3): scenery only. */
  WALL_TOP: def('wall-top', 'none'),
  WALL: def('wall', 'none'),
  /** Invisible solid placeholder while a block-bump effect animates the real tile. */
  BUMPING: def('bumping', 'solid'),
  /**
   * Lost Levels 9-1's two `?` blocks on one cell (24,9 on normal difficulty: a Clock block and a
   * coin block; Level.as builds one ItemBlock per `()`-separated token and a bump hits one of
   * them, lines 2047-2051): the first bump releases the Clock, the next one gives the coin.
   */
  Q_CLOCK: def('question-clock', 'solid', { block: { kind: 'question', content: 'clock' } }),
  /** An invisible block holding a vine (the 2-1 coin heaven's way up to the sky ruins). */
  HIDDEN_VINE: def('hidden-vine', 'none', { block: { kind: 'hidden', content: 'vine' } }),
  /** An invisible block hiding a teleport pad (the 3-1 coin heaven's way up to the space station). */
  HIDDEN_TELEPORTER: def('hidden-teleporter', 'none', { block: { kind: 'hidden', content: 'teleporter' } }),
  /**
   * A cracked wall (5-4's dungeon, `&` in maps): solid, and it crumbles (with every cracked tile
   * joined to it) to any hero attack: a melee hit, a shot, a kicked shell or a blast
   * (World.crackWalls), or a head bump from a hero who breaks bricks. A small hero's bump only
   * jolts it.
   */
  CRACKED: def('wall-cracked', 'solid', { block: { kind: 'brick', content: 'none' } }),
  /**
   * A trick wall's panel (6-2's bonus room and Ryu's dojo, `N` in maps; a `trick` zone): solid,
   * drawn as the theme's brick, and unbreakable (no block: a bump or a blast leaves it), so the
   * panel always stands. Only its zone makes it spin.
   */
  TRICK: def('trick-wall', 'solid'),
  /** The Top Secret Area's `?` blocks (0.4.10): a fire flower, a mushroom, a Yoshi egg. */
  Q_FLOWER: def('question-flower', 'solid', { block: { kind: 'question', content: 'flower' } }),
  Q_MUSHROOM: def('question-mushroom', 'solid', { block: { kind: 'question', content: 'mushroom' } }),
  Q_EGG: def('question-egg', 'solid', { block: { kind: 'question', content: 'egg' } }),
  /** An invisible block that lays a hidden cloud path (a `path` zone; 2-1's, campaign only). */
  HIDDEN_PATH: def('hidden-path', 'none', { block: { kind: 'hidden', content: 'path' } }),
  /**
   * A one-way cloud ledge (0.4.12): stood on from above, passed through from below and from the
   * sides. Laid by a `ledge` zone in the campaign only (2-1's ledge by its last tower, a step for a
   * hero with a fixed jump arc), so a springboard's launch rises through it untouched.
   */
  CLOUD_LEDGE: def('cloud-ledge', 'top'),
} as const;

export const TILES: readonly TileDef[] = defs;
export const tileDef = (id: number): TileDef => defs[id] ?? (defs[0] as TileDef);
export const isSolid = (id: number): boolean => tileDef(id).collision === 'solid';

/** Character → tile id or entity type for the .map format. Entity values start with '@'. */
export const DEFAULT_LEGEND: Readonly<Record<string, number | string>> = {
  '.': T.AIR,
  '#': T.GROUND,
  '=': T.BRICK,
  '?': T.Q_COIN,
  M: T.Q_POWERUP,
  U: T.Q_1UP,
  '*': T.Q_STAR,
  S: T.BRICK_STAR,
  C: T.BRICK_COINS10,
  E: T.BRICK_COIN,
  P: T.BRICK_POWERUP,
  L: T.BRICK_1UP,
  V: T.BRICK_VINE,
  '1': T.HIDDEN_1UP,
  '2': T.HIDDEN_COIN,
  '3': T.HIDDEN_POWERUP,
  '4': T.Q_POISON,
  '5': T.BRICK_POISON,
  '6': T.HIDDEN_POISON,
  '7': T.HIDDEN_VINE,
  '8': T.HIDDEN_TELEPORTER,
  '9': T.HIDDEN_PATH,
  W: T.Q_FLOWER,
  R: T.Q_MUSHROOM,
  Y: T.Q_EGG,
  Q: T.Q_CLOCK,
  B: T.HARD,
  u: T.USED,
  '[': T.PIPE_TL,
  ']': T.PIPE_TR,
  '{': T.PIPE_BL,
  '}': T.PIPE_BR,
  D: T.PIPE_BOTTOM_L,
  G: T.PIPE_BOTTOM_R,
  '(': T.PIPE_H_TL,
  ')': T.PIPE_H_TR,
  '<': T.PIPE_H_BL,
  '>': T.PIPE_H_BR,
  $: T.COIN,
  '!': T.FLAG_SHAFT,
  o: T.FLAG_BALL,
  T: T.TREE_TOP,
  t: T.TREE_TRUNK,
  m: T.MUSHROOM_TOP,
  i: T.MUSHROOM_STEM,
  '~': T.LAVA,
  '-': T.BRIDGE,
  ':': T.CHAIN,
  '%': T.CASTLE_BRICK,
  w: T.WATER,
  // The coin heavens' floor and ledges (the original's TG_COIN_HEAVEN skin of groundNormal).
  O: T.CLOUD_BLOCK,
  '^': T.BLASTER_TOP,
  '|': T.BLASTER_BASE,
  A: T.WALL_TOP,
  H: T.WALL,
  '&': T.CRACKED,
  N: T.TRICK,
  // entity markers
  g: '@goomba',
  k: '@koopa-green',
  K: '@koopa-red',
  r: '@piranha',
  b: '@bowser',
  f: '@firebar',
  F: '@firebar-ccw',
  a: '@axe',
  h: '@hammer-bro',
  z: '@buzzy',
  l: '@lakitu',
  c: '@cheep-red',
  q: '@blooper',
  s: '@spring',
  y: '@spring-green',
  n: '@hammer-bro-chase',
  x: '@bullet-launcher',
  Z: '@decor-castle', // small castle anchor (bottom-left)
  X: '@decor-castle-big',
};
