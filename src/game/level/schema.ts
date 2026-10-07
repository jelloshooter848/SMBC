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
  // 5-4's campaign look (0.4.12): Simon's castle hall, orange stone blocks before a grey brick wall.
  // Castle gameplay keys off what it draws (lava, fire bars, Bowser, the axe), not the theme; its
  // enemies take the castle's palette (enemyPalette) and hammer bros its solid floors.
  | 'castlevania'
  // Ryu's hideout under 6-2: a night dojo of dark lacquered wood, shoji and lanterns.
  | 'dojo'
  // Ryu's mini game outdoors: a moonlit town of grey stone, tiled roofs and lit windows.
  | 'ninja-night'
  // 6-2's campaign look (0.4.12): Ryu's city street at night, pavement, red brick, a far skyline.
  | 'ninja-city'
  // Bill's jungle (7-3's campaign look, his camp, his mini game): rock, girders, palms, a river.
  | 'contra-jungle'
  // Bill's waterfall climb out of the camp: wet rock ledges, falling water, mist.
  | 'contra-falls'
  // Red Falcon's lair (Bill's mini game): organic walls and floor.
  | 'alien-lair'
  // Sophia's Underworld (her garage, her mini game's cavern): rust rock, roots, slime, gateways.
  | 'underworld'
  // The overhead dungeon's metal seen from the side (the top-down kit draws the `bm-dungeon` sheet).
  | 'bm-dungeon'
  // The Top Secret Area behind World 2's hidden bonus spot (0.4.10), in a Super Mario World look:
  // grass-topped dirt, green bush hills and a big sparkly hill under a cream sky.
  | 'smw-secret'
  // Campaign looks (0.4.12): 2-1 as a Zelda II field, 3-1 as a Mega Man night stage, 4-2 as
  // Metroid's Brinstar.
  | 'zelda2'
  | 'megaman-stage'
  | 'brinstar';

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
  'castlevania',
  'dojo',
  'ninja-night',
  'ninja-city',
  'contra-jungle',
  'contra-falls',
  'alien-lair',
  'underworld',
  'bm-dungeon',
  'smw-secret',
  'zelda2',
  'megaman-stage',
  'brinstar',
];

export const isTheme = (s: string): s is Theme => (THEMES as readonly string[]).includes(s);

/**
 * Swimming areas: from the first row of wave tiles down the player swims. Besides the water
 * theme itself these are the Lost Levels' flooded overworld areas, which only look different.
 */
export const isWaterTheme = (theme: Theme): boolean =>
  theme === 'water' || theme === 'overworld-water' || theme === 'water-gray' || theme === 'castle-water';

/**
 * Whether the player swims in `level` (from its first row of wave tiles down): a swimming theme,
 * or any theme with the map's `swim: true` header (LevelData.swim; Fred's flooded tunnel under
 * 8-4, `8-4-fred`, in the Underworld's look).
 */
export const isSwimLevel = (level: Pick<LevelData, 'theme' | 'swim'>): boolean =>
  level.swim === true || isWaterTheme(level.theme);

/**
 * The castle family: SMB's castle, the Lost Levels' castle under the daylight sky and its swim, and
 * 5-4's campaign look (Simon's hall). Castle rules that key off the theme ask this, never the name.
 */
export const isCastleTheme = (theme: Theme): boolean =>
  theme === 'castle' || theme === 'castle-overworld' || theme === 'castle-water' || theme === 'castlevania';

/**
 * The original's `cannotPassThroughGround`: underground and castle areas, where a Hammer Bro's
 * jumps go only straight up and down (no hopping through the floors), and 4-2's campaign look
 * (Brinstar), which is 4-2's underground still. Samus's cavern is not one.
 */
export const hasSolidFloors = (theme: Theme): boolean =>
  theme === 'underground' || theme === 'brinstar' || isCastleTheme(theme);

/** The music an area of this theme plays when its map names none. */
export function themeMusic(theme: Theme): string {
  if (theme === 'smw-secret') return 'top-secret';
  if (isWaterTheme(theme)) return 'water';
  if (theme === 'castle' || theme === 'castle-overworld') return 'castle';
  if (theme === 'underground') return 'underground';
  if (theme === 'station') return 'mm-station';
  if (theme === 'cavern') return 'cavern';
  if (theme === 'airship' || theme === 'airship-deck') return 'airship';
  if (theme === 'crypt') return 'crypt';
  if (theme === 'dojo') return 'dojo';
  if (theme === 'ninja-night') return 'ng-stage';
  if (theme === 'castlevania') return 'cv-hall';
  if (theme === 'ninja-city') return 'ng-city';
  if (theme === 'contra-jungle' || theme === 'contra-falls') return 'contra-jungle';
  if (theme === 'alien-lair') return 'contra-lair';
  if (theme === 'underworld') return 'bm-area';
  if (theme === 'bm-dungeon') return 'bm-dungeon';
  if (theme === 'zelda2') return 'zelda2-field';
  if (theme === 'megaman-stage') return 'mm-stage-31';
  if (theme === 'brinstar') return 'brinstar';
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
 * beamed down by a teleport pad (`beam`), flipped through a trick wall's spinning panel
 * (`spin`), or placed.
 */
export type TransferMode = PipeDir | 'none' | 'climb' | 'fall' | 'beam' | 'spin';

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
      /**
       * The pipe sleeps (no way in) unless the campaign variant (level/campaign.ts) wakes it: 2-1's
       * way into the Moblin's cave past its castle (0.4.10). A sleeping pipe is drawn by nothing:
       * it is a zone only, so its level's tiles are the same either way.
       */
      campaign?: boolean;
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
  /**
   * Falling out of the level at column >= x (with `w`, only within [x, x + w)) drops the player
   * into `target` instead of killing them. `campaign`: the zone sleeps (a fall there kills as
   * ever) unless the campaign variant (level/campaign.ts) wakes it: 7-3's exploding bridge into
   * Bill's jungle camp.
   */
  | {
      kind: 'pit';
      x: number;
      w?: number;
      target: { level: string; x: number; y: number };
      campaign?: boolean;
    }
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
  /**
   * A ninja trick wall (6-2's bonus room into Ryu's dojo): the panel of `h` tiles from (x, y)
   * down, in a wall (tile `N`, T.TRICK). A player pushing into its open side for TRICK_PUSH_FRAMES
   * (about a second) spins the panel and is flipped through into `target`: a `spin` arrival (the
   * panel there spins and the players step out beside it), or with `exitDir: 'up'` rising out of
   * the pipe at the target (the dojo's way back into 6-2). `campaign`: the zone sleeps (its panel
   * a plain brick wall: no tile `N`, no mark, no spin) unless the campaign variant
   * (level/campaign.ts) wakes it, which also makes its panel `N` and lays a coin arrow at it.
   */
  | {
      kind: 'trick';
      x: number;
      y: number;
      h: number;
      target: { level: string; x: number; y: number; exitDir?: 'up' };
      campaign?: boolean;
    }
  /**
   * A hidden path (2-1's cloud path, 0.4.10): the `w` tiles from (x, y) rightward appear one by one
   * as cloud blocks once the hidden path block at `block` (tile `9`, T.HIDDEN_PATH) is bumped
   * (World.layPath). `campaign`: the zone sleeps (no block, no path) unless the campaign variant
   * (level/campaign.ts) wakes it, which also puts the hidden block in.
   */
  | {
      kind: 'path';
      x: number;
      y: number;
      w: number;
      block: { x: number; y: number };
      /** Laid as one-way cloud ledges (T.CLOUD_LEDGE) instead of cloud blocks (`one-way` in maps). */
      oneWay?: boolean;
      campaign?: boolean;
    }
  /**
   * A one-way cloud ledge (0.4.12): the `w` tiles from (x, y) rightward, laid as T.CLOUD_LEDGE by
   * the campaign variant only (level/campaign.ts; `campaign` is required): 2-1's step by its last
   * tower, which a hero with a fixed jump arc (Simon) lands on to reach the hidden coin block's top
   * (and from there the tower top). Elsewhere the zone sleeps and its tiles stay as they are. (Its woken copy, in
   * the campaign variant, has no `campaign` mark: its tiles are laid. serializeTextMap writes either
   * back as the sleeping zone.)
   */
  | { kind: 'ledge'; x: number; y: number; w: number; campaign?: boolean }
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
  startMode: 'stand' | 'pipe-exit' | 'fall' | 'autowalk' | 'climb' | 'beam' | 'spin';
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
  /**
   * The level's campaign look (level/campaign.ts `applyLook`): campaign play shows it in this
   * theme, music and decor instead; every tile, zone and entity stays. Other play never sees it.
   */
  campaignLook?: CampaignLook;
  /**
   * A fill-up spot entered from a map node (the map's `bonus: true` header; the Top Secret Area,
   * 0.4.10): no clock and no WORLD card, nothing to clear; its exit pipe (`-> map`, MAP_EXIT)
   * leads back to the map. Every visit starts afresh, so its blocks are full again.
   */
  bonus?: boolean;
  /**
   * The player swims here although the theme is no water theme (the map's `swim: true` header):
   * from the first row of wave tiles down, as in a water level (isSwimLevel). Fred's flooded
   * tunnel under 8-4 (`8-4-fred`) swims in the Underworld's look.
   */
  swim?: boolean;
}

/**
 * A pipe target that is no level: the way back to the world map (the Top Secret Area's pipe).
 * In campaign play LevelScene returns to the map without clearing anything; elsewhere it ends
 * the play-test or goes back to the title.
 */
export const MAP_EXIT = 'map';

/**
 * A campaign-only reskin of a level (the map's `campaignTheme:` / `campaignMusic:` headers and
 * its `[campaign-decor]` section): 7-3 as a Contra jungle stage. Ids are kept as written, so a
 * look can name a theme or song that is not registered yet: campaign play then keeps the level's
 * own look (`applyLook`).
 */
export interface CampaignLook {
  /** A Theme id; until it is registered the look is not applied at all. */
  theme: string;
  /** A song id; the level's own music plays until it is registered. */
  music?: string;
  /** Replaces the level's decor (left out: the decor stays). */
  decor?: Decor[];
}

export function tileAtTiles(level: LevelData, tx: number, ty: number): number {
  if (tx < 0 || tx >= level.width || ty < 0 || ty >= level.height) return 0;
  return level.tiles[ty * level.width + tx] ?? 0;
}
