/**
 * Tile vocabulary shared by every level. A tile id is an index into TILES; the themed atlas
 * decides how it looks, the TileDef decides how it behaves.
 */
export type Collision = 'none' | 'solid' | 'top';

/** `poison`: a Lost Levels poison mushroom, which hurts the player like an enemy. */
export type BlockContent = 'coin' | 'powerup' | '1up' | 'star' | 'coins10' | 'vine' | 'poison' | 'none';

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
  LAVA: def('lava', 'none', { hazard: true }),
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
  B: T.HARD,
  u: T.USED,
  '[': T.PIPE_TL,
  ']': T.PIPE_TR,
  '{': T.PIPE_BL,
  '}': T.PIPE_BR,
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
  '^': T.BLASTER_TOP,
  '|': T.BLASTER_BASE,
  A: T.WALL_TOP,
  H: T.WALL,
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
  x: '@bullet-launcher',
  Z: '@decor-castle', // small castle anchor (bottom-left)
  X: '@decor-castle-big',
};
