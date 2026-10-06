import type { LevelData, Zone } from './schema';
import { T } from './tiles';

/*
 * Campaign variants of levels (Game.startLevel uses them while a save file is played from the
 * map). A warp zone with `secret` (1-2's, owner decision for 0.4.0) shows ONE pipe and no world
 * numbers: the middle pipe stays, the others are taken out of the room (their tiles and pipe
 * zones), and the one left gets `target.secret`, which LevelScene hands to Game.campaignSecret
 * instead of warping. Non-campaign play (dev select, ?level=, custom) uses the level as it is.
 *
 * Future secret hooks: SMB 4-2's two warp zones keep their warps; a `secret=` key on either
 * would make it work like 1-2's.
 */

const PIPE_TILES = new Set<number>([T.PIPE_TL, T.PIPE_TR, T.PIPE_BL, T.PIPE_BR]);
const cache = new WeakMap<LevelData, LevelData>();

type Pipe = Zone & { kind: 'pipe' };
type Warp = Zone & { kind: 'warp' };

/** The level as campaign play shows it (the same object when nothing changes). */
export function campaignLevel(level: LevelData): LevelData {
  const hit = cache.get(level);
  if (hit) return hit;
  const secrets = level.zones.filter((z): z is Warp => z.kind === 'warp' && !!z.secret);
  if (!secrets.length) {
    cache.set(level, level);
    return level;
  }
  const tiles = new Uint16Array(level.tiles);
  const dropped = new Set<Zone>();
  const kept = new Map<Pipe, string>();
  for (const w of secrets) {
    const pipes = level.zones
      .filter((z): z is Pipe => z.kind === 'pipe' && z.x >= w.x && z.x < w.x + w.w)
      .sort((a, b) => a.x - b.x);
    const keep = pipes[Math.floor((pipes.length - 1) / 2)];
    for (const p of pipes) {
      if (p === keep) {
        kept.set(p, w.secret as string);
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
      if (z.kind === 'warp' && z.secret) return { ...z, worlds: [] };
      const secret = z.kind === 'pipe' ? kept.get(z) : undefined;
      if (z.kind === 'pipe' && secret) return { ...z, target: { ...z.target, secret } };
      return z;
    });
  const out: LevelData = { ...level, tiles, zones };
  cache.set(level, out);
  return out;
}
