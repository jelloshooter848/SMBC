import { levelIds } from '@content/levels';
import { songs } from '@content/music/songs';
import type { EntitySpawn, LevelData, Zone } from './schema';
import { isTheme } from './schema';
import { T, isSolid } from './tiles';

/*
 * Campaign variants of levels (Game.startLevel uses them while a save file is played from the
 * map). Non-campaign play (dev select, ?level=, custom) uses the level as it is.
 *
 * Warp zones with a campaign variant show ONE pipe: the middle pipe stays, the others are taken
 * out of the room (their tiles and pipe zones), and the world numbers go.
 * - `secret` (1-2's, owner decision for 0.4.0): the pipe gets `target.secret`, which LevelScene
 *   hands to Game.campaignSecret instead of warping (a secret exit: one map road). The welcome
 *   text stays.
 * - `goto` (4-2's two zones, owner decision for 0.5.0: "all warp pipes gone eventually"): the
 *   pipe leads to `goto` instead (an area of the level: Samus's cavern, Larry's airship), and the
 *   welcome text goes too. It is an ordinary pipe into an area: no secret, no map road, the clock
 *   carries on. A `goto` whose level is not in the library (yet) leaves the warp as it is.
 * - `goto` with exit `climb` (4-2's right zone, owner decisions 8:25 PM and later: Larry's
 *   airship): the room first looks like the CLASSIC warp zone (its welcome text, the middle pipe
 *   and its world number) but that pipe is dead: solid, with no pipe zone, so it never warps.
 *   Once a player stands on the room's floor, Larry's anchor crashes down from above the screen
 *   (an `anchor-drop` entity, entities/objects/anchor-drop.ts), smashes the pipe and the number,
 *   and rests on the floor where the pipe stood, its CHAIN (a placed vine in chain art) rising
 *   off the top of the screen through the hole it broke in the ceiling. A `vine` zone on the
 *   chain's foot links its top to `goto` (a climb arrival in chain art: world/world.ts). See
 *   `anchorDrop`.
 *   With `until=<secret>` and that secret on the file (`larry`: the airship has crashed on the
 *   map) the room is sealed instead: its pipe is gone and the gap in its ceiling is closed, so
 *   nobody can drop into a room with no way out (no anchor, no chain, no warp, no text).
 *
 * A `descent` zone marked `campaign` (5-4's lift shaft, owner decision for 0.4.7: Simon's
 * dungeon) sleeps outside the campaign; its campaign variant wakes it, so riding the down lift
 * past the screen bottom carries the player down into the area below. Like a `goto`, it is an
 * ordinary way into an area of the same level: no secret, no map road, the clock carries on.
 *
 * A `trick` zone marked `campaign` (6-2's bonus room, owner decision for 0.4.8: Ryu's dojo) sleeps
 * the same way: outside the campaign the room is exactly as it was (its panel plain brick, which
 * bombs break as ever, and no coin arrow). The campaign variant wakes it: its panel's tiles become
 * the trick wall (`N`, T.TRICK) and a coin arrow is laid pointing at its marked row (`trickArrow`),
 * so pushing into it flips the player through into the dojo (World.checkTricks). Likewise no
 * secret, no map road, the clock carries on.
 *
 * A `pit` zone marked `campaign` (7-3's exploding bridge, owner decision for 0.4.9: Bill's jungle
 * camp) sleeps the same way: outside the campaign a fall there kills as anywhere. Its campaign
 * variant wakes it, so falling through the gap the bridge leaves drops the player into the area.
 * Likewise an ENTITY with `campaign=true` (`bridge-blast`) sleeps outside the campaign (World
 * leaves it out) and the campaign variant drops the mark, so it spawns. A woken `bridge-blast`
 * also gets a coin arrow pointing down at its marked end (`blastArrow`).
 *
 * A `pipe` zone marked `campaign` (2-1's way into the Moblin's cave past its castle, owner decision
 * for 0.4.10: the Top Secret Area) sleeps the same way, and a `path` zone marked `campaign` (2-1's
 * hidden cloud path from the top of its last tower toward the flagpole) too: outside the campaign
 * the level is exactly as it was (no hidden block, no way into the cave). The campaign variant
 * wakes them, and puts the path's hidden block (T.HIDDEN_PATH) in at its `block` tile. Nothing
 * else changes: the cave is an area of 2-1, where the Moblin ends the level (scenes/level.ts).
 * A woken pipe on the same mouth as a live one (same column, row and direction) takes its place,
 * the live one's zone going: 8-4-end's trap pipe at column 10 (owner decision for 0.4.18: Sophia's
 * route) leads, in the campaign only, to Jason's secret area (8-4-jason) instead of back into the
 * castle maze; outside the campaign it is the trap pipe exactly as before.
 *
 * A `ledge` zone (always marked `campaign`; 2-1's step by its last tower, 0.4.12) is laid by the
 * campaign variant only: its tiles become one-way cloud (T.CLOUD_LEDGE), which a hero lands on
 * from above and passes through from below and the sides. Simon's fixed jump arc reaches the
 * hidden coin block's top from it (and the tower top from there); a springboard's launch rises
 * through it.
 *
 * A level's campaign LOOK (`LevelData.campaignLook`: the map's `campaignTheme:` and
 * `campaignMusic:` headers and its `[campaign-decor]` section; 7-3 as a Contra jungle stage) is
 * applied here too (`applyLook`): the same tiles, zones and entities in another theme, music and
 * decor. A look whose theme is not registered yet is left out entirely, so a level can name its
 * look before the art lands. The next reskins (2-1, 3-1, 4-2, 5-4, 6-2) need only their own
 * headers and decor.
 */

const PIPE_TILES = new Set<number>([T.PIPE_TL, T.PIPE_TR, T.PIPE_BL, T.PIPE_BR]);
const cache = new WeakMap<LevelData, LevelData>();
/** The bundled library's variants once a climb zone's `until` secret is on the file. */
const cacheGone = new WeakMap<LevelData, LevelData>();

type Pipe = Zone & { kind: 'pipe' };
type Trick = Zone & { kind: 'trick' };

/**
 * The coin arrow a campaign trick wall gets, as [x, y] tiles: pointing at the panel's marked row
 * (its middle, TrickWall.markRow) from the room side, tip two tiles out, a shaft of three behind it
 * and a coin above and below the shaft's first (a `<` for a panel in a left wall). `side`: 1 when
 * the room lies right of the panel. Only tiles that are open air get a coin.
 */
export function trickArrow(z: Trick, side: 1 | -1): [number, number][] {
  const m = z.y + (z.h >> 1);
  const at = (dx: number, y: number): [number, number] => [z.x + side * dx, y];
  return [at(2, m), at(3, m - 1), at(3, m), at(3, m + 1), at(4, m), at(5, m)];
}
type Warp = Zone & { kind: 'warp' };

/**
 * The coin arrow over a campaign `bridge-blast` (7-3's exploding bridge), as [x, y] tiles: a down
 * arrow centred over the bridge's third segment, near its marked left end (the post with the red
 * light): a shaft of two, then a head of five, three and one, its tip two tiles above the girders.
 * Only open-air tiles get a coin.
 */
export function blastArrow(b: EntitySpawn): [number, number][] {
  const x = b.x + 2;
  const y = b.y;
  return [
    [x, y - 6],
    [x, y - 5],
    [x - 2, y - 4],
    [x - 1, y - 4],
    [x, y - 4],
    [x + 1, y - 4],
    [x + 2, y - 4],
    [x - 1, y - 3],
    [x, y - 3],
    [x + 1, y - 3],
    [x, y - 2],
  ];
}

/** What the running game has registered, for a campaign look (`applyLook`). */
export interface LookRegistry {
  theme: (id: string) => boolean;
  music: (id: string) => boolean;
}

let songIds: ReadonlySet<string> | undefined;
/** The bundled themes (schema.ts THEMES) and songs (content/music). */
export const REGISTERED: LookRegistry = {
  theme: isTheme,
  music: (id) => (songIds ??= new Set(songs.map((s) => s.id))).has(id),
};

/**
 * `level` in its campaign look (LevelData.campaignLook), or `level` itself when it has none or
 * its theme is not registered (yet): the theme, the decor (when the look has its own) and the
 * music (once that song is registered; else the level's own plays on). Tiles, zones and
 * entities are untouched, so the collision is the same.
 */
export function applyLook(level: LevelData, known: LookRegistry = REGISTERED): LevelData {
  const look = level.campaignLook;
  if (!look || !known.theme(look.theme) || !isTheme(look.theme)) return level;
  const out: LevelData = { ...level, theme: look.theme };
  if (look.music !== undefined && known.music(look.music)) out.music = look.music;
  if (look.decor) out.decor = look.decor.map((d) => ({ ...d }));
  return out;
}

let bundled: ReadonlySet<string> | undefined;
/** Whether `id` is a bundled level (the default check for a warp zone's `goto`). */
const isBundled = (id: string): boolean => (bundled ??= new Set(levelIds())).has(id);

/**
 * The level as campaign play shows it (the same object when nothing changes). `has` says
 * whether a `goto` target exists (default: the bundled level library); `secrets` are the file's
 * map secrets (a climb zone's `until`).
 */
export function campaignLevel(
  given: LevelData,
  has: (id: string) => boolean = isBundled,
  secrets: readonly string[] = [],
): LevelData {
  const level = toadAt84(given);
  const gone = (w: Warp) => !!w.until && secrets.includes(w.until);
  const anyGone = level.zones.some((z) => z.kind === 'warp' && gone(z));
  // Cached for the bundled library only (a test's own `has` gets a fresh variant).
  const memo = has !== isBundled ? new WeakMap<LevelData, LevelData>() : anyGone ? cacheGone : cache;
  const hit = memo.get(level);
  if (hit) return hit;
  const variants = level.zones.filter(
    (z): z is Warp => z.kind === 'warp' && (!!z.secret || (!!z.goto && has(z.goto.level))),
  );
  // A sleeping `descent` zone (5-4's down lift into Simon's dungeon), `trick` zone (6-2's trick
  // wall into Ryu's dojo) or `pit` zone (7-3's exploding bridge into Bill's camp), and a sleeping
  // entity (`campaign=true`), wake in campaign play.
  const sleeping =
    level.zones.some((z) => isSleepingZone(z)) || level.entities.some((e) => e.props?.campaign === true);
  const looked = applyLook(level);
  if (!variants.length && !sleeping) {
    memo.set(level, looked);
    return looked;
  }
  const tiles = new Uint16Array(level.tiles);
  const dropped = new Set<Zone>();
  // A woken pipe takes the place of a live one on the same mouth (8-4-end's trap pipe).
  const wokenPipes = level.zones.filter((z): z is Pipe => z.kind === 'pipe' && z.campaign === true);
  for (const z of level.zones)
    if (
      z.kind === 'pipe' &&
      !z.campaign &&
      wokenPipes.some((w) => w.x === z.x && w.y === z.y && w.dir === z.dir)
    )
      dropped.add(z);
  const kept = new Map<Pipe, Warp>();
  const added: { zones: Zone[]; entities: EntitySpawn[] } = { zones: [], entities: [] };
  /** Climb zones as shown: the dead pipe's label (classic look), or the stump only (gone). */
  const climbs = new Map<Warp, Warp>();
  for (const w of variants) {
    const pipes = level.zones
      .filter((z): z is Pipe => z.kind === 'pipe' && z.x >= w.x && z.x < w.x + w.w)
      .sort((a, b) => a.x - b.x);
    const keep = pipes[Math.floor((pipes.length - 1) / 2)];
    const chain = !w.secret && w.goto?.exitDir === 'climb';
    for (const p of pipes) {
      if (p === keep && !chain) {
        kept.set(p, w);
        continue;
      }
      dropped.add(p);
      // The climb zone's middle pipe stays standing (dead) for the anchor to smash.
      if (p === keep) continue;
      // Clear the pipe's two columns from its mouth down while they are pipe tiles.
      for (let y = p.y; y < level.height; y++) {
        const row = y * level.width;
        const a = tiles[row + p.x] as number;
        const b = tiles[row + p.x + 1] as number;
        if (!PIPE_TILES.has(a) && !PIPE_TILES.has(b)) break;
        if (PIPE_TILES.has(a)) tiles[row + p.x] = T.AIR;
        if (PIPE_TILES.has(b)) tiles[row + p.x + 1] = T.AIR;
      }
    }
    if (chain && keep && w.goto) {
      if (gone(w)) {
        added.zones.push(...sealRoom(level, tiles, keep, w));
        const bare: Warp = { ...w, worlds: [] };
        delete bare.text;
        climbs.set(w, bare);
        continue;
      }
      const a = anchorDrop(level, tiles, keep, w);
      added.zones.push(a.zone);
      added.entities.push(a.entity);
      const world = w.worlds[pipes.indexOf(keep)];
      climbs.set(w, {
        ...w,
        worlds: world === undefined ? [] : [world],
        labelAt: [{ x: keep.x, y: keep.y }],
      });
    }
  }
  // Woken trick walls: the panel turns to trick-wall tiles, and its coin arrow is laid.
  for (const z of level.zones) {
    if (z.kind !== 'trick' || !z.campaign) continue;
    for (let y = z.y; y < z.y + z.h; y++) tiles[y * level.width + z.x] = T.TRICK;
    const bottom = (z.y + z.h - 1) * level.width;
    const side = isSolid(tiles[bottom + z.x + 1] as number) ? -1 : 1;
    for (const [x, y] of trickArrow(z, side)) {
      const i = y * level.width + x;
      if (x >= 0 && x < level.width && y >= 0 && y < level.height && tiles[i] === T.AIR) tiles[i] = T.COIN;
    }
  }
  // Woken hidden paths: their hidden block goes in.
  for (const z of level.zones) {
    if (z.kind !== 'path' || !z.campaign) continue;
    const { x, y } = z.block;
    if (x >= 0 && x < level.width && y >= 0 && y < level.height) tiles[y * level.width + x] = T.HIDDEN_PATH;
  }
  // Woken cloud ledges (2-1's step by its last tower): their one-way cloud goes into open air.
  for (const z of level.zones) {
    if (z.kind !== 'ledge' || !z.campaign) continue;
    for (let x = z.x; x < z.x + z.w; x++) {
      const i = z.y * level.width + x;
      if (x >= 0 && x < level.width && z.y >= 0 && z.y < level.height && tiles[i] === T.AIR)
        tiles[i] = T.CLOUD_LEDGE;
    }
  }
  // Woken exploding bridges: a coin arrow points down at each one's marked end.
  for (const e of level.entities) {
    if (e.type !== 'bridge-blast' || e.props?.campaign !== true) continue;
    for (const [x, y] of blastArrow(e)) {
      const i = y * level.width + x;
      if (x >= 0 && x < level.width && y >= 0 && y < level.height && tiles[i] === T.AIR) tiles[i] = T.COIN;
    }
  }
  const zones = level.zones
    .filter((z) => !dropped.has(z))
    .map((z): Zone => {
      if (isSleepingZone(z)) {
        const live: Zone = { ...z };
        delete (live as { campaign?: boolean }).campaign;
        return live;
      }
      if (z.kind === 'warp' && variants.includes(z)) {
        const climb = climbs.get(z);
        if (climb) return climb;
        if (z.secret) return { ...z, worlds: [] };
        const bare: Warp = { ...z, worlds: [] };
        delete bare.text;
        return bare;
      }
      const w = z.kind === 'pipe' ? kept.get(z) : undefined;
      if (z.kind !== 'pipe' || !w) return z;
      if (w.secret) return { ...z, target: { ...z.target, secret: w.secret } };
      return { ...z, target: { ...(w.goto as NonNullable<Warp['goto']>) } };
    })
    .concat(added.zones);
  // Sleeping entities wake: the mark goes, so World spawns them.
  const entities = level.entities
    .map((e): EntitySpawn => {
      if (e.props?.campaign !== true) return e;
      const { campaign: _, ...props } = e.props;
      return { ...e, props };
    })
    .concat(added.entities);
  const out: LevelData = { ...looked, tiles, zones, entities };
  memo.set(level, out);
  return out;
}

const toads = new WeakMap<LevelData, LevelData>();

/**
 * SMB 8-4 in the campaign: Toad, who came to cheer, stands where the princess waits (she is in
 * hiding; docs/STORY.md 2.12). The map file and every other play keep the princess; the Lost
 * Levels' castles are left alone.
 */
function toadAt84(level: LevelData): LevelData {
  if ((level.parent ?? level.id) !== '8-4' || !level.entities.some((e) => e.type === 'princess'))
    return level;
  let out = toads.get(level);
  if (!out) {
    out = {
      ...level,
      entities: level.entities.map((e): EntitySpawn => (e.type === 'princess' ? { ...e, type: 'toad' } : e)),
    };
    toads.set(level, out);
  }
  return out;
}

/** A zone that sleeps outside campaign play (its `campaign` mark), woken by campaignLevel. */
function isSleepingZone(z: Zone): boolean {
  return (
    (z.kind === 'descent' ||
      z.kind === 'trick' ||
      z.kind === 'pit' ||
      z.kind === 'pipe' ||
      z.kind === 'path' ||
      z.kind === 'ledge') &&
    z.campaign === true
  );
}

/** The rows of a pipe standing at (`p.x`, mouth row `p.y`), top down, while they are pipe tiles. */
function pipeRows(level: LevelData, tiles: Uint16Array, p: Pipe): number[] {
  const rows: number[] = [];
  for (let y = p.y; y < level.height; y++) {
    const row = y * level.width;
    if (!PIPE_TILES.has(tiles[row + p.x] as number) && !PIPE_TILES.has(tiles[row + p.x + 1] as number)) break;
    rows.push(y);
  }
  return rows;
}

/**
 * The climb zone's anchor drop, for its dead middle pipe `p` (left column `x`, mouth row `y`):
 * the floor is the first solid row below the pipe. The `anchor-drop` entity in column x waits
 * for a player on the room's floor (columns of the warp zone), then falls, breaks the solid
 * tiles above the floor in its column (`holes`: 4-2's ceiling), smashes the pipe and leaves the
 * chain (len reaching one tile above the screen top, as a vine grown from a brick does) on the
 * floor. Its `vine` zone sits on the chain's foot (world/world.ts links a placed chain by its
 * column and bottom row).
 */
function anchorDrop(
  level: LevelData,
  tiles: Uint16Array,
  p: Pipe,
  w: Warp,
): { zone: Zone; entity: EntitySpawn } {
  const to = w.goto as NonNullable<Warp['goto']>;
  const at = (r: number) => r * level.width + p.x;
  const rows = pipeRows(level, tiles, p);
  let floor = (rows[rows.length - 1] ?? p.y - 1) + 1;
  while (floor < level.height && !isSolid(tiles[at(floor)] as number)) floor++;
  const foot = floor - 1;
  const holes: number[] = [];
  for (let r = 0; r < p.y; r++) if (isSolid(tiles[at(r)] as number)) holes.push(r);
  return {
    zone: { kind: 'vine', x: p.x, y: foot, target: { level: to.level, x: to.x, y: to.y } },
    entity: {
      type: 'anchor-drop',
      x: p.x,
      y: foot,
      props: { len: floor + 1, pipe: p.y, holes: holes.join(','), room: `${w.x},${w.x + w.w}` },
    },
  };
}

/**
 * Once the airship has crashed: the climb zone's room is sealed, so nobody can drop into a room
 * with no way out, nor get stuck on top of it. Its pipe goes (nobody sees it); the ceiling over it
 * (the solid row in the pipe's column above the mouth: 4-2's row 2) is closed across the zone's
 * columns with that row's own tile, closing the gap the room is entered by; the zone's left wall
 * rises to the top of the screen with the same tile; and the camera stops at that wall (a
 * `scrollStop` at the zone's column, unless the level has one), so the walk along the ceiling ends
 * at the screen's right edge and leads back the way it came.
 */
function sealRoom(level: LevelData, tiles: Uint16Array, p: Pipe, w: Warp): Zone[] {
  for (const y of pipeRows(level, tiles, p)) {
    tiles[y * level.width + p.x] = T.AIR;
    tiles[y * level.width + p.x + 1] = T.AIR;
  }
  for (let r = p.y - 1; r >= 0; r--) {
    const roof = tiles[r * level.width + p.x] as number;
    if (!isSolid(roof)) continue;
    for (let x = w.x; x < Math.min(level.width, w.x + w.w); x++)
      if (!isSolid(tiles[r * level.width + x] as number)) tiles[r * level.width + x] = roof;
    for (let y = 0; y < r; y++) tiles[y * level.width + w.x] = roof;
    break;
  }
  return level.zones.some((z) => z.kind === 'scrollStop') ? [] : [{ kind: 'scrollStop', x: w.x }];
}
