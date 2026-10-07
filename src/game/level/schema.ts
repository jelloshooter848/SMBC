export type Theme =
  | 'overworld'
  | 'underground'
  | 'castle'
  | 'water'
  | 'night'
  | 'treetop'
  | 'snow'
  // The Lost Levels' extra skins: orange and red giant-mushroom land, sky-high cloud ledges
  // (over cloud banks, or over plain ground), overworld areas flooded with water (also in gray),
  // a castle drawn under the daylight sky and a swim through a castle.
  | 'mushroom'
  | 'clouds'
  | 'clouds-overworld'
  | 'overworld-water'
  | 'water-gray'
  | 'castle-overworld'
  | 'mushroom-red'
  | 'castle-water'
  // Mega Man's space station above 3-1: steel plating against the black of space.
  | 'station'
  // Samus's cavern below 4-2: bubbly blue rock in the dark.
  | 'cavern'
  // Larry Koopa's airship behind 4-2's right-hand pipe: wooden decks and iron under a night sky.
  | 'airship'
  // The airship's open decks (4-2-airship, auto-scrolling): SMB3-style planks under a daylight sky.
  | 'airship-deck'
  // Simon's crypt under 5-4 and his mini game's castle: grey stone, night-blue brick, candlelight.
  | 'crypt'
  // Ryu's hideout under 6-2: a night dojo of dark lacquered wood, shoji and lanterns.
  | 'dojo'
  // Ryu's mini game outdoors: a moonlit town of grey stone, tiled roofs and lit windows.
  | 'ninja-night';

/** Every theme, in the order the editor lists them. */
export const THEMES: readonly Theme[] = [
  'overworld',
  'underground',
  'castle',
  'water',
  'night',
  'treetop',
  'snow',
  'mushroom',
  'clouds',
  'clouds-overworld',
  'overworld-water',
  'water-gray',
  'castle-overworld',
  'mushroom-red',
  'castle-water',
  'station',
  'cavern',
  'airship',
  'airship-deck',
  'crypt',
  'dojo',
  'ninja-night',
];

export const isTheme = (s: string): s is Theme => (THEMES as readonly string[]).includes(s);

/**
 * Swimming areas: from the first row of wave tiles down the player swims. Besides the water
 * theme itself these are the Lost Levels' flooded overworld areas, which only look different.
 */
export const isWaterTheme = (theme: Theme): boolean =>
  theme === 'water' || theme === 'overworld-water' || theme === 'water-gray' || theme === 'castle-water';

/** The music an area of this theme plays when its map names none. */
export function themeMusic(theme: Theme): string {
  if (isWaterTheme(theme)) return 'water';
  if (theme === 'castle' || theme === 'castle-overworld') return 'castle';
  if (theme === 'underground') return 'underground';
  if (theme === 'station') return 'mm-station';
  if (theme === 'cavern') return 'cavern';
  if (theme === 'airship' || theme === 'airship-deck') return 'airship';
  if (theme === 'crypt') return 'crypt';
  if (theme === 'dojo') return 'dojo';
  if (theme === 'ninja-night') return 'ng-stage';
  return 'overworld';
}

export interface EntitySpawn {
  type: string;
  /** Tile coordinates. */
  x: number;
  y: number;
  props?: Record<string, string | number | boolean>;
}

export type PipeDir = 'down' | 'up' | 'left' | 'right';

/**
 * How the player arrives in a linked area: rising from a pipe, dropping in, climbing a vine,
 * beamed down by a teleport pad (`beam`), or placed.
 */
export type TransferMode = PipeDir | 'none' | 'climb' | 'fall' | 'beam';

export type Zone =
  | {
      kind: 'pipe';
      /** Tile coords of the pipe mouth (top-left of the 2-wide opening for vertical pipes, the single body tile for horizontal). */
      x: number;
      y: number;
      dir: PipeDir;
      /**
       * `secret`: set only by the campaign variant (level/campaign.ts) on a secret warp zone's
       * pipe: taking it records that secret on the map instead of entering `level`.
       */
      target: { level: string; x: number; y: number; exitDir?: TransferMode; secret?: string };
    }
  /** A vine brick at (x, y): climbing its vine off the top of the screen leads to `target` (climb mode). */
  | { kind: 'vine'; x: number; y: number; target: { level: string; x: number; y: number } }
  /**
   * A teleport pad lying in tile (x, y) (on the floor of the tile below): a player who stands on
   * it is beamed up and arrives in `target` (`exitDir`: 'beam' by default, beamed down; 'fall'
   * drops in from the top like a pit). `block`: the pad is hidden in that hidden teleporter block
   * (tile `8`) until the block is bumped. See entities/objects/teleporter.ts.
   */
  | {
      kind: 'teleport';
      x: number;
      y: number;
      target: { level: string; x: number; y: number; exitDir: 'beam' | 'fall' };
      block?: { x: number; y: number };
    }
  /** Falling out of the level at column >= x drops the player into `target` instead of killing them. */
  | { kind: 'pit'; x: number; target: { level: string; x: number; y: number } }
  /**
   * A lift shaft down into a hidden area (5-4's shaft into `5-4-dungeon`): a player riding a
   * `lift-down` whose column lies within [x, x + w) is carried on down past the screen bottom
   * and drops into `target` from above (a `fall` arrival). Falling into the shaft without the
   * lift still kills. The lift's planks carry a faint skull mark (the hint). `campaign`: the
   * zone sleeps (no descent, no mark) unless the campaign variant (level/campaign.ts) wakes it.
   */
  | {
      kind: 'descent';
      x: number;
      w: number;
      target: { level: string; x: number; y: number };
      campaign?: boolean;
    }
  /** Flying Cheep Cheeps leap from below while the player is within [x, x + w). */
  | { kind: 'cheeps'; x: number; w: number }
  /** Bullet Bills fly in from the screen edges while the player is within [x, x + w). */
  | { kind: 'bullets'; x: number; w: number }
  /**
   * Once the lead player reaches column x, Bowser's flames fly in from the right edge of the
   * screen while he is still off screen (the original's `bowserFireBallStart`).
   */
  | { kind: 'bowser-fire'; x: number }
  /**
   * Castle maze: walking right past column x with the body inside rows y0..y1 moves the player
   * to column `to` (same height), but only after passing its checkpoint columns (inside their
   * rows) since the last move: the wrong path loops back, the right path skips the repeat.
   */
  | {
      kind: 'loop';
      x: number;
      y0: number;
      y1: number;
      to: number;
      /** Checkpoint columns (each with its rows) that arm the move since the last one. */
      checks: { x: number; y0: number; y1: number }[];
      /** 'all' checkpoints must be passed, or 'any' one of them. */
      need: 'all' | 'any';
    }
  /**
   * A warp zone: the pipes inside [x, x + w) are labelled with `worlds` in order. Campaign
   * variants (level/campaign.ts): `secret`: the room shows only its middle pipe, unlabelled,
   * which records this map secret instead of warping (1-2: 'bonus-1'); `goto`: the room shows
   * only its middle pipe, with no labels and no text, leading into `goto` instead (an area of the
   * level, so no map road comes of it; 4-2's two zones). Other play keeps the warps.
   */
  | {
      kind: 'warp';
      x: number;
      w: number;
      worlds: number[];
      text?: string;
      secret?: string;
      goto?: { level: string; x: number; y: number; exitDir?: TransferMode };
      /**
       * A climb `goto` (an anchor chain) works until the file has this map secret (`larry`):
       * then the room shows only the smashed pipe's stump (level/campaign.ts).
       */
      until?: string;
      /**
       * Set only by the campaign variant: pipe mouths whose world numbers are drawn though they
       * are no pipe zones (the climb zone's dead pipe, before the anchor smashes it).
       */
      labelAt?: { x: number; y: number }[];
    }
  /** `y`: the midpoint's row; the respawn stands on the bottom of it (row 12 when left out). */
  | { kind: 'checkpoint'; x: number; y?: number }
  | { kind: 'exit'; x: number; next: string }
  | { kind: 'scrollStop'; x: number }
  | { kind: 'text'; x: number; y: number; text: string; triggerX: number };

export interface Decor {
  kind: string; // hill-big, hill-small, bush-1, bush-3, cloud-1, cloud-3, tree-big, tree-small, fence, castle-small, castle-big, ruin-pillar, ruin-pillar-broken, ruin-statue, ruin-temple, or `sheet:frame` from another sheet (station:window)
  x: number;
  y: number;
}

/** A map's `camera:` header. */
export type CameraMode = 'scroll' | 'locked' | 'free' | 'auto';
export const CAMERA_MODES: readonly CameraMode[] = ['scroll', 'locked', 'free', 'auto'];

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
  /**
   * Rows: 15 (one screen) for every level but a `camera: free` map's taller shafts (the map's
   * `height: N` header).
   */
  height: number;
  /** Row-major tile ids. */
  tiles: Uint16Array;
  entities: EntitySpawn[];
  zones: Zone[];
  decor: Decor[];
  /** Player start, tile coords (feet on the tile below `y`). */
  start: { x: number; y: number };
  /** When set, the level starts with the "walk in from a pipe" animation (`beam`: beamed down onto a teleport pad). */
  startMode: 'stand' | 'pipe-exit' | 'fall' | 'autowalk' | 'climb' | 'beam';
  /**
   * Camera behaviour: 'scroll' (default), 'locked' (bonus rooms), 'free' (scrolls both ways
   * and follows the player up and down a map taller than a screen) or 'auto' (SMB3 airships:
   * moves right on its own at `scroll` px per frame, pushing the players; world/camera.ts).
   */
  camera: CameraMode;
  /**
   * An `auto` camera's speed in px per frame (the map's `scroll:` header; decimals are fine).
   * Set only on `camera: auto` maps.
   */
  scroll?: number;
  /** Level to respawn in after dying here (sub-areas point at their main level). */
  parent: string | null;
}

export function tileAtTiles(level: LevelData, tx: number, ty: number): number {
  if (tx < 0 || tx >= level.width || ty < 0 || ty >= level.height) return 0;
  return level.tiles[ty * level.width + tx] ?? 0;
}
