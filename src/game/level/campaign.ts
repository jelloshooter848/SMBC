import { levelIds } from '@content/levels';
import type { EntitySpawn, LevelData, Zone } from './schema';
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
 */

const PIPE_TILES = new Set<number>([T.PIPE_TL, T.PIPE_TR, T.PIPE_BL, T.PIPE_BR]);
const cache = new WeakMap<LevelData, LevelData>();
/** The bundled library's variants once a climb zone's `until` secret is on the file. */
const cacheGone = new WeakMap<LevelData, LevelData>();

type Pipe = Zone & { kind: 'pipe' };
type Warp = Zone & { kind: 'warp' };

let bundled: ReadonlySet<string> | undefined;
/** Whether `id` is a bundled level (the default check for a warp zone's `goto`). */
const isBundled = (id: string): boolean => (bundled ??= new Set(levelIds())).has(id);

/**
 * The level as campaign play shows it (the same object when nothing changes). `has` says
 * whether a `goto` target exists (default: the bundled level library); `secrets` are the file's
 * map secrets (a climb zone's `until`).
 */
export function campaignLevel(
  level: LevelData,
  has: (id: string) => boolean = isBundled,
  secrets: readonly string[] = [],
): LevelData {
  const gone = (w: Warp) => !!w.until && secrets.includes(w.until);
  const anyGone = level.zones.some((z) => z.kind === 'warp' && gone(z));
  // Cached for the bundled library only (a test's own `has` gets a fresh variant).
  const memo = has !== isBundled ? new WeakMap<LevelData, LevelData>() : anyGone ? cacheGone : cache;
  const hit = memo.get(level);
  if (hit) return hit;
  const variants = level.zones.filter(
    (z): z is Warp => z.kind === 'warp' && (!!z.secret || (!!z.goto && has(z.goto.level))),
  );
  if (!variants.length) {
    memo.set(level, level);
    return level;
  }
  const tiles = new Uint16Array(level.tiles);
  const dropped = new Set<Zone>();
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
  const zones = level.zones
    .filter((z) => !dropped.has(z))
    .map((z): Zone => {
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
  const out: LevelData = added.entities.length
    ? { ...level, tiles, zones, entities: [...level.entities, ...added.entities] }
    : { ...level, tiles, zones };
  memo.set(level, out);
  return out;
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
