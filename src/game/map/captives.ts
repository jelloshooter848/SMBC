import { getLevel, levelIds } from '@content/levels';
import { MAP_PAGES } from '@content/worldmap';
import type { LevelData } from '../level/schema';
import { findLevelNode, mainLevel } from './rules';
import type { MapNode, MapProgress, PageId, WorldMapPage } from './types';

/*
 * Where the brainwashed heroes hide, for the world map's hint (docs/HEROES.md "The map hint"):
 * found from the level data alone. Every `captive x y hero=<id>` entity of every level is
 * mapped through its level's `parent` chain to the main level, and from there to the map node
 * that enters it, so a new captive gets its map hint with nothing else to write.
 */

/** A captive hero and the map node of the level it waits in. */
export interface HiddenHero {
  /** CharacterDef id. */
  hero: string;
  /** The level (or area) it waits in ('1-1-bonus'). */
  level: string;
  /** That level's main level, as the node names it ('1-1'). */
  main: string;
  page: PageId;
  /** The node's id on `page`. */
  node: string;
}

/**
 * What the map shows beside a node hiding `h`:
 * - 'none': the level is not cleared yet (no hint at all);
 * - 'silhouette': cleared, the hero not freed yet: a faint shape peeking from behind the node;
 * - 'trophy': freed: the hero stands beside the node in full colour.
 */
export type HeroHint = 'none' | 'silhouette' | 'trophy';

/** The captives of `levels` whose main level has a node on `pages`, in level order. */
export function hiddenHeroesIn(levels: readonly LevelData[], pages: readonly WorldMapPage[]): HiddenHero[] {
  const byId = new Map(levels.map((l) => [l.id, l]));
  const get = (id: string): LevelData => {
    const l = byId.get(id);
    if (!l) throw new Error(`unknown level "${id}"`);
    return l;
  };
  const out: HiddenHero[] = [];
  for (const level of levels) {
    for (const e of level.entities) {
      const hero = e.type === 'captive' ? e.props?.hero : undefined;
      if (typeof hero !== 'string' || !hero) continue;
      const main = mainLevel(level.id, get);
      const at = findLevelNode(main, pages);
      if (at) out.push({ hero, level: level.id, main, page: at.page.id, node: at.node.id });
    }
  }
  return out;
}

let cached: readonly HiddenHero[] | undefined;

/** Every captive of the bundled levels with a map node (cached: the level data never changes). */
export function hiddenHeroes(): readonly HiddenHero[] {
  cached ??= hiddenHeroesIn(
    levelIds().map((id) => getLevel(id)),
    MAP_PAGES,
  );
  return cached;
}

/** The captives hidden in the level of node `node` on page `page`. */
export function hiddenHeroesAt(page: PageId, node: string): HiddenHero[] {
  return hiddenHeroes().filter((h) => h.page === page && h.node === node);
}

/**
 * The secret key of Larry Koopa's crystal ball (4-2's airship): once the file has it, every hero
 * not freed yet shows its silhouette by its level, even before that level is cleared.
 */
export const CRYSTAL_BALL = 'larry';

/**
 * The hint stage for `h` on a file (campaign play): its trophy once the hero is freed (even if
 * the level was left without its clear), its silhouette once the level is cleared (or at once with
 * the crystal ball, CRYSTAL_BALL), else nothing.
 */
export function heroHint(h: HiddenHero, progress: MapProgress, freed: readonly string[]): HeroHint {
  if (freed.includes(h.hero)) return 'trophy';
  return progress.cleared.includes(h.main) || progress.secrets.includes(CRYSTAL_BALL) ? 'silhouette' : 'none';
}

/**
 * The side of node `n` a hidden hero is drawn on: 1 (right) or -1 (left). The node's `heroSpot`
 * when set; otherwise the right unless a road (path or world exit) leaves the node that way.
 */
export function heroSide(page: WorldMapPage, n: MapNode): 1 | -1 {
  if (n.heroSpot) return n.heroSpot === 'left' ? -1 : 1;
  const roadAt = (x: number, y: number) =>
    page.paths.some((p) => p.points.some(([px, py]) => px === x && py === y)) ||
    page.exits.some((e) => e.points.some(([px, py]) => px === x && py === y));
  return roadAt(n.x + 1, n.y) && !roadAt(n.x - 1, n.y) ? -1 : 1;
}
