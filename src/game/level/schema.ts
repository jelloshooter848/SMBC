export type Theme = 'overworld' | 'underground' | 'castle' | 'water' | 'night' | 'treetop' | 'snow';

export interface EntitySpawn {
  type: string;
  /** Tile coordinates. */
  x: number;
  y: number;
  props?: Record<string, string | number | boolean>;
}

export type PipeDir = 'down' | 'up' | 'left' | 'right';

/** How the player arrives in a linked area: rising from a pipe, dropping in, climbing a vine, or placed. */
export type TransferMode = PipeDir | 'none' | 'climb' | 'fall';

export type Zone =
  | {
      kind: 'pipe';
      /** Tile coords of the pipe mouth (top-left of the 2-wide opening for vertical pipes, the single body tile for horizontal). */
      x: number;
      y: number;
      dir: PipeDir;
      target: { level: string; x: number; y: number; exitDir?: TransferMode };
    }
  /** A vine brick at (x, y): climbing its vine off the top of the screen leads to `target` (climb mode). */
  | { kind: 'vine'; x: number; y: number; target: { level: string; x: number; y: number } }
  /** Falling out of the level at column >= x drops the player into `target` instead of killing them. */
  | { kind: 'pit'; x: number; target: { level: string; x: number; y: number } }
  /** Flying Cheep Cheeps leap from below while the player is within [x, x + w). */
  | { kind: 'cheeps'; x: number; w: number }
  /** Bullet Bills fly in from the screen edges while the player is within [x, x + w). */
  | { kind: 'bullets'; x: number; w: number }
  /**
   * Castle maze: walking right past column x with the body inside rows y0..y1 moves the player
   * to column `to` (same height). With `check`, only after passing that column inside its rows
   * since the last move: the wrong path loops back, the right path skips the repeated part.
   */
  | {
      kind: 'loop';
      x: number;
      y0: number;
      y1: number;
      to: number;
      check: { x: number; y0: number; y1: number } | null;
    }
  | { kind: 'warp'; x: number; w: number; worlds: number[]; text?: string }
  | { kind: 'checkpoint'; x: number }
  | { kind: 'exit'; x: number; next: string }
  | { kind: 'scrollStop'; x: number }
  | { kind: 'text'; x: number; y: number; text: string; triggerX: number };

export interface Decor {
  kind: string; // hill-big, hill-small, bush-1, bush-3, cloud-1, cloud-3, tree-big, tree-small, fence, castle-small, castle-big
  x: number;
  y: number;
}

export interface LevelData {
  schema: 1;
  id: string;
  name: string;
  world: number;
  stage: number;
  theme: Theme;
  music: string;
  /** Starting timer; null = inherit from the level that pipe-linked here (bonus rooms). */
  time: number | null;
  width: number;
  height: 15;
  /** Row-major tile ids. */
  tiles: Uint16Array;
  entities: EntitySpawn[];
  zones: Zone[];
  decor: Decor[];
  /** Player start, tile coords (feet on the tile below `y`). */
  start: { x: number; y: number };
  /** When set, the level starts with the "walk in from a pipe" animation. */
  startMode: 'stand' | 'pipe-exit' | 'fall' | 'autowalk' | 'climb';
  /** Camera behaviour: 'scroll' (default) or 'locked' (bonus rooms). */
  camera: 'scroll' | 'locked';
  /** Level to respawn in after dying here (sub-areas point at their main level). */
  parent: string | null;
}

export function tileAtTiles(level: LevelData, tx: number, ty: number): number {
  if (tx < 0 || tx >= level.width || ty < 0 || ty >= level.height) return 0;
  return level.tiles[ty * level.width + tx] ?? 0;
}
