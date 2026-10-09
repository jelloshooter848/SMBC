import type { LevelData } from './schema';

/*
 * Heroes' level variants (the Chapter 1 finishing pass: Sophia's variants). A map's
 * `[variant <hero>]` sections (LevelData.variants) list runs of extra tiles (a block, a step, a
 * ledge) that let that hero through a place built for Mario: Sophia III cannot stomp, and at
 * Normal her tank jumps about 4.5 tiles high and 6 across.
 *
 * - Each run's tiles are laid as written (a `.` opens a tile), and spawns are added or taken out
 *   (`+ type x y`, `- type x y`; the original's springs and Paratroopas). The runs are laid when ANY player
 *   is that hero, so a co-op partner plays them too: our own (campaign-only) runs only ever fill
 *   open air, off the other heroes' routes, so nothing another hero stands on or needs is taken
 *   away (tests/sim/sophia-variants.test.ts checks it).
 * - Campaign play only, unless the section is marked `classic`: the original Crossover has those
 *   pieces for that hero (Level.as builds each level per character: Sophia sees the `charHorz`,
 *   `charVert` and `WideCharacter` helpers, tools/levelgen helperOnly), so classic play has them
 *   too, as the original lays them (removals included). Everything else outside the campaign stays
 *   exactly as Crossover has it.
 *
 * - A section may name the level's music while that hero plays it (`music <song>`), and the copy
 *   lists the heroes whose sections it laid (LevelData.heroVariants): Mega Man's airship (0.4.39,
 *   `[variant megaman]` in 4-2-airship and 4-2-larry) plays by his rules where World checks it.
 *
 * Game.levelScene applies it after the campaign variant (level/campaign.ts).
 */

const cache = new WeakMap<LevelData, Map<string, LevelData>>();

/**
 * `level` as played by `heroes` (CharacterDef ids, one per player): with the variant runs of each
 * hero playing laid (campaign play: all of them; elsewhere only `classic` ones). The same object
 * when none apply, and the same variant object for the same heroes and play.
 */
export function heroVariant(level: LevelData, heroes: readonly string[], campaign: boolean): LevelData {
  const runs = (level.variants ?? []).filter((v) => heroes.includes(v.hero) && (campaign || v.classic));
  if (!runs.length) return level;
  const key = `${campaign}:${[...new Set(runs.map((v) => v.hero))].sort().join(',')}`;
  let byKey = cache.get(level);
  const hit = byKey?.get(key);
  if (hit) return hit;
  const tiles = new Uint16Array(level.tiles);
  for (const v of runs)
    for (const r of v.tiles)
      r.tiles.forEach((t, i) => {
        const x = r.x + i;
        if (x < 0 || x >= level.width || r.y < 0 || r.y >= level.height) return;
        tiles[r.y * level.width + x] = t;
      });
  const gone = runs.flatMap((v) => v.remove ?? []);
  const entities = level.entities
    .filter((e) => !gone.some((g) => g.type === e.type && g.x === e.x && g.y === e.y))
    .concat(runs.flatMap((v) => (v.add ?? []).map((e) => ({ ...e }))));
  const laid = [...new Set(runs.map((v) => v.hero))].sort();
  const music = runs.find((v) => v.music)?.music;
  const out: LevelData = { ...level, tiles, entities, heroVariants: laid, ...(music ? { music } : {}) };
  if (!byKey) cache.set(level, (byKey = new Map()));
  byKey.set(key, out);
  return out;
}
