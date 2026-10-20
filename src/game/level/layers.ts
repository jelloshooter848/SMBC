import type { CharacterDef } from '../characters/character';
import type { LayerFlag, LevelData, MapDifficulty, Zone } from './schema';

/*
 * The original's per-difficulty and per-hero level build (G-006, G-010, G-011, G-012). Level.as
 * builds each level for the map difficulty and the playing hero: HideOnDifficulties leaves pieces
 * out on some difficulties, and the charHorz / charVert / BadSwimmer / WideCharacter /
 * poorBowserFighter tags show or hide helper pieces by the hero's level flags. Our maps hold the
 * Normal build for a hero with no flags (Mario); tools/levelgen/convert-smbc.mjs --layers writes
 * the rest as an area's layers (LevelData.layers), each the difference from what the earlier
 * layers lay, so laying in order every layer that matches gives exactly the original's level.
 *
 * Classic SMBC play only: the World lays them for its heroes' flags (CharacterDef.levelFlags,
 * which every Classic def declares) and the run's Map Difficulty. Current play never does.
 */

/** Who an area is built for: the run's map difficulty and the heroes' flags. */
export interface LayerProfile {
  difficulty: MapDifficulty;
  flags: readonly LayerFlag[];
}

/**
 * The flags of the heroes playing (CharacterDef.levelFlags): in co-op, any player's (the
 * original is single player; a helper piece helps both, as hero variants do).
 */
export function layerFlags(defs: readonly CharacterDef[]): LayerFlag[] {
  const out = new Set<LayerFlag>();
  for (const d of defs) {
    const f = d.levelFlags;
    if (!f) continue;
    if (f.horz) out.add('horz');
    if (f.vert) out.add('vert');
    if (!f.goodSwimmer) out.add('badswimmer');
    if (f.wide) out.add('wide');
    if (f.poorBowser) out.add('poorbowser');
  }
  return [...out];
}

const sameZone = (a: Zone, b: Zone): boolean => JSON.stringify(a) === JSON.stringify(b);

const cache = new WeakMap<LevelData, Map<string, LevelData>>();

/**
 * `level` as the original builds it for `profile`: every layer whose difficulty is the
 * profile's (or none) and whose flags the profile has, laid in order. The same object when none
 * applies, and the same copy for the same profile.
 */
export function layeredLevel(level: LevelData, profile: LayerProfile): LevelData {
  const layers = (level.layers ?? []).filter(
    (l) =>
      (l.difficulty === undefined || l.difficulty === profile.difficulty) &&
      l.flags.every((f) => profile.flags.includes(f)),
  );
  if (!layers.length) return level;
  const key = `${profile.difficulty}:${[...profile.flags].sort().join(',')}`;
  let byKey = cache.get(level);
  const hit = byKey?.get(key);
  if (hit) return hit;
  const tiles = new Uint16Array(level.tiles);
  let entities = level.entities;
  let zones = level.zones;
  let start = { x: level.start.x, y: level.start.y };
  let startMode = level.startMode;
  for (const l of layers) {
    for (const r of l.tiles)
      r.tiles.forEach((t, i) => {
        const x = r.x + i;
        if (x >= 0 && x < level.width && r.y >= 0 && r.y < level.height) tiles[r.y * level.width + x] = t;
      });
    const gone = l.remove ?? [];
    entities = entities
      .filter((e) => !gone.some((g) => g.type === e.type && g.x === e.x && g.y === e.y))
      .concat((l.add ?? []).map((e) => ({ ...e })));
    const out = l.removeZones ?? [];
    zones = zones.filter((z) => !out.some((o) => sameZone(o, z))).concat(l.addZones ?? []);
    if (l.start) {
      start = { x: l.start.x, y: l.start.y };
      startMode = l.start.mode;
    }
  }
  const copy: LevelData = { ...level, tiles, entities, zones, start, startMode };
  if (!byKey) cache.set(level, (byKey = new Map()));
  byKey.set(key, copy);
  return copy;
}
