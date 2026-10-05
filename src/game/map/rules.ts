import { MAP_PAGES } from '@content/worldmap';
import type { LevelData } from '../level/schema';
import type { MapNode, MapPath, MapProgress, WorldExit, WorldMapPage } from './types';

/*
 * World map rules (pure apart from the documented in-place updates of `progress`): which nodes and
 * paths are open, what a level clear or a warp opens, and where the hero walks on the d-pad.
 */

export type GetLevel = (id: string) => LevelData;
export type Dir = 'left' | 'right' | 'up' | 'down';

/** A fresh file: World 1 open, the hero on its start node. */
export function newMapProgress(): MapProgress {
  return { cleared: [], worlds: [1], secrets: [], position: { world: 1, node: 'start' } };
}

/** Reveal/animation id of a path ('1-1>1-2'). */
export function pathId(p: MapPath): string {
  return `${p.from}>${p.to}`;
}

/** Reveal/animation id of a world exit ('1-4>world-2'). */
export function exitId(e: WorldExit): string {
  return `${e.from}>world-${e.toWorld}`;
}

export function isWorldOpen(progress: MapProgress, world: number): boolean {
  return world === 1 || progress.worlds.includes(world);
}

function node(page: WorldMapPage, id: string): MapNode | undefined {
  return page.nodes.find((n) => n.id === id);
}

/** The node's level has been cleared (start nodes never are). */
export function isCleared(progress: MapProgress, page: WorldMapPage, nodeId: string): boolean {
  const n = node(page, nodeId);
  return !!n?.level && progress.cleared.includes(n.level);
}

/** A path counts as walked once its `from` node is cleared (or is the start of an open world). */
function pathFromDone(progress: MapProgress, page: WorldMapPage, p: MapPath): boolean {
  const from = node(page, p.from);
  if (!from) return false;
  if (from.kind === 'start') return isWorldOpen(progress, page.world);
  return isCleared(progress, page, p.from);
}

function keyFound(progress: MapProgress, n: MapNode): boolean {
  return n.kind !== 'bonus' || (!!n.unlock && progress.secrets.includes(n.unlock));
}

/**
 * World 1's start always; a world's start when the world is open; any node at the `to` end of
 * a path whose `from` is cleared or is the start of an open world. Bonus nodes also need their key.
 */
export function isOpen(progress: MapProgress, page: WorldMapPage, nodeId: string): boolean {
  const n = node(page, nodeId);
  if (!n || !isWorldOpen(progress, page.world) || !keyFound(progress, n)) return false;
  if (n.kind === 'start') return true;
  return page.paths.some((p) => p.to === nodeId && pathFromDone(progress, page, p));
}

export function isPathOpen(progress: MapProgress, page: WorldMapPage, p: MapPath): boolean {
  return pathFromDone(progress, page, p) && isOpen(progress, page, p.to);
}

/** A world exit opens when the node it leaves from (the castle) is cleared. */
export function isExitOpen(progress: MapProgress, page: WorldMapPage, e: WorldExit): boolean {
  return isWorldOpen(progress, page.world) && isCleared(progress, page, e.from);
}

/** The paths and world exits to draw. */
export function openPaths(
  progress: MapProgress,
  page: WorldMapPage,
): { paths: MapPath[]; exits: WorldExit[] } {
  return {
    paths: page.paths.filter((p) => isPathOpen(progress, page, p)),
    exits: page.exits.filter((e) => isExitOpen(progress, page, e)),
  };
}

/** Everything open on a page, in reveal order (each path followed by the node it leads to). */
function openIds(progress: MapProgress, page: WorldMapPage): string[] {
  const ids: string[] = [];
  for (const n of page.nodes) if (n.kind === 'start' && isOpen(progress, page, n.id)) ids.push(n.id);
  const { paths, exits } = openPaths(progress, page);
  for (const p of paths) {
    ids.push(pathId(p));
    if (!ids.includes(p.to)) ids.push(p.to);
  }
  for (const e of exits) ids.push(exitId(e));
  return ids;
}

function openedBy(pages: readonly WorldMapPage[], progress: MapProgress, change: () => void): string[] {
  const before = new Set(pages.flatMap((p) => openIds(progress, p).map((id) => `${p.world}:${id}`)));
  change();
  const out: string[] = [];
  for (const p of pages)
    for (const id of openIds(progress, p)) if (!before.has(`${p.world}:${id}`)) out.push(id);
  return out;
}

/** The main level of a sub-area ('1-2-exit' → '1-2'), following `parent` links. */
export function mainLevel(levelId: string, getLevel: GetLevel): string {
  let id = levelId;
  for (let i = 0; i < 8; i++) {
    let parent: string | null;
    try {
      parent = getLevel(id).parent;
    } catch {
      return id;
    }
    if (!parent || parent === id) return id;
    id = parent;
  }
  return id;
}

/** The page and node a (main) level sits on. */
export function findLevelNode(
  levelId: string,
  pages: readonly WorldMapPage[] = MAP_PAGES,
): { page: WorldMapPage; node: MapNode } | null {
  for (const page of pages) {
    const n = page.nodes.find((x) => x.level === levelId);
    if (n) return { page, node: n };
  }
  return null;
}

/**
 * Records a clear of `levelId` (a sub-area counts for its main level) in `progress`, puts the
 * hero on its node, and on a castle clear opens the next world. Returns the ids (nodes, `pathId`s,
 * `exitId`s) that were not open before, for the reveal animation; levels not on any page change
 * nothing but the cleared list.
 */
export function clearLevel(
  progress: MapProgress,
  levelId: string,
  getLevel: GetLevel,
  pages: readonly WorldMapPage[] = MAP_PAGES,
): string[] {
  const main = mainLevel(levelId, getLevel);
  const at = findLevelNode(main, pages);
  return openedBy(pages, progress, () => {
    if (!progress.cleared.includes(main)) progress.cleared.push(main);
    if (!at) return;
    progress.position = { world: at.page.world, node: at.node.id };
    if (at.node.kind !== 'castle') return;
    const exits = at.page.exits.filter((e) => e.from === at.node.id).map((e) => e.toWorld);
    const next = exits.length
      ? exits
      : pages.some((p) => p.world === at.page.world + 1)
        ? [at.page.world + 1]
        : [];
    for (const w of next) if (!progress.worlds.includes(w)) progress.worlds.push(w);
  });
}

/** A warp pipe opens only its target world (its start and first level). Returns the opened ids. */
export function warpTo(
  progress: MapProgress,
  world: number,
  pages: readonly WorldMapPage[] = MAP_PAGES,
): string[] {
  return openedBy(pages, progress, () => {
    if (!progress.worlds.includes(world)) progress.worlds.push(world);
  });
}

/** The level to load for a map node: 'X-Y-intro' when the level has an intro scene. */
export function entryLevel(levelId: string, getLevel: GetLevel): string {
  try {
    getLevel(`${levelId}-intro`);
    return `${levelId}-intro`;
  } catch {
    return levelId;
  }
}

/** Where pressing a direction on the map takes the hero. `points` run from here to there. */
export type MapStep =
  | { kind: 'node'; to: string; points: [number, number][] }
  | { kind: 'exit'; exit: WorldExit; points: [number, number][] }
  /** Back off a world's start to the page that leads here; arrive at `node` (that page's castle). */
  | { kind: 'back'; world: number; node: string; points: [number, number][] };

const DELTA: Record<Dir, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

function heads(points: [number, number][], dir: Dir): boolean {
  const a = points[0];
  const b = points[1];
  if (!a || !b) return false;
  const [dx, dy] = DELTA[dir];
  return Math.sign(b[0] - a[0]) === dx && Math.sign(b[1] - a[1]) === dy;
}

const SIDE_DIR: Record<WorldExit['side'], Dir> = { right: 'right', left: 'left', top: 'up' };
const OPPOSITE: Record<Dir, Dir> = { left: 'right', right: 'left', up: 'down', down: 'up' };

/**
 * The open path (either way along it) or world exit leaving `from` whose first step goes `dir`;
 * null when there is none. On a world's start, the way the page was entered leads back to the
 * previous page when its exit is open.
 */
export function nextStep(
  page: WorldMapPage,
  progress: MapProgress,
  from: string,
  dir: Dir,
  pages: readonly WorldMapPage[] = MAP_PAGES,
): MapStep | null {
  for (const p of page.paths) {
    if (!isPathOpen(progress, page, p)) continue;
    if (p.from === from && heads(p.points, dir)) return { kind: 'node', to: p.to, points: p.points.slice() };
    if (p.to === from) {
      const back = p.points.slice().reverse();
      if (heads(back, dir)) return { kind: 'node', to: p.from, points: back };
    }
  }
  for (const e of page.exits) {
    if (e.from !== from || !isExitOpen(progress, page, e) || !isWorldOpen(progress, e.toWorld)) continue;
    if (heads(e.points, dir)) return { kind: 'exit', exit: e, points: e.points.slice() };
  }
  if (node(page, from)?.kind === 'start') {
    for (const prev of pages) {
      if (prev.world === page.world) continue;
      const e = prev.exits.find((x) => x.toWorld === page.world && isExitOpen(progress, prev, x));
      if (!e || OPPOSITE[SIDE_DIR[e.side]] !== dir) continue;
      const start = node(page, from) as MapNode;
      const [dx, dy] = DELTA[dir];
      // Straight on to the page edge.
      const points: [number, number][] = [[start.x, start.y]];
      for (let x = start.x + dx, y = start.y + dy; x >= 0 && x < 16 && y >= 0 && y < 15; x += dx, y += dy)
        points.push([x, y]);
      if (points.length < 2) points.push([start.x + dx, start.y + dy]);
      return { kind: 'back', world: prev.world, node: e.from, points };
    }
  }
  return null;
}
