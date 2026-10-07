import { levelIds } from '@content/levels';
import type { LevelData, Zone } from './schema';
import { T } from './tiles';

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
 */

const PIPE_TILES = new Set<number>([T.PIPE_TL, T.PIPE_TR, T.PIPE_BL, T.PIPE_BR]);
const cache = new WeakMap<LevelData, LevelData>();

type Pipe = Zone & { kind: 'pipe' };
type Warp = Zone & { kind: 'warp' };

let bundled: ReadonlySet<string> | undefined;
/** Whether `id` is a bundled level (the default check for a warp zone's `goto`). */
const isBundled = (id: string): boolean => (bundled ??= new Set(levelIds())).has(id);

/**
 * The level as campaign play shows it (the same object when nothing changes). `has` says
 * whether a `goto` target exists (default: the bundled level library).
 */
export function campaignLevel(level: LevelData, has: (id: string) => boolean = isBundled): LevelData {
  // Cached for the bundled library only (a test's own `has` gets a fresh variant).
  const memo = has === isBundled ? cache : new WeakMap<LevelData, LevelData>();
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
  for (const w of variants) {
    const pipes = level.zones
      .filter((z): z is Pipe => z.kind === 'pipe' && z.x >= w.x && z.x < w.x + w.w)
      .sort((a, b) => a.x - b.x);
    const keep = pipes[Math.floor((pipes.length - 1) / 2)];
    for (const p of pipes) {
      if (p === keep) {
        kept.set(p, w);
        continue;
      }
      dropped.add(p);
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
  }
  const zones = level.zones
    .filter((z) => !dropped.has(z))
    .map((z): Zone => {
      if (z.kind === 'warp' && variants.includes(z)) {
        if (z.secret) return { ...z, worlds: [] };
        const bare: Warp = { ...z, worlds: [] };
        delete bare.text;
        return bare;
      }
      const w = z.kind === 'pipe' ? kept.get(z) : undefined;
      if (z.kind !== 'pipe' || !w) return z;
      if (w.secret) return { ...z, target: { ...z.target, secret: w.secret } };
      return { ...z, target: { ...(w.goto as NonNullable<Warp['goto']>) } };
    });
  const out: LevelData = { ...level, tiles, zones };
  memo.set(level, out);
  return out;
}
