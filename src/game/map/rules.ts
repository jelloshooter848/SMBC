import { MAP_PAGES } from '@content/worldmap';
import type { LevelData } from '../level/schema';
import type { MapCondition, MapNode, MapPath, MapProgress, PageId, WorldExit, WorldMapPage } from './types';

/*
 * World map rules (pure apart from the documented in-place updates of `progress`; every
 * condition reads the file alone): which pages, nodes and paths are open, what a level clear or
 * a warp opens, and where the hero walks on the d-pad.
 *
 * The open checks take an optional `unlockAll` (developer mode's "Unlock all"): every page,
 * level and castle node, path and world exit counts as open, and every condition holds except
 * 'never', without anything counting as cleared. A warp node hidden only by its secret key
 * (World 1's warp spot) shows too, with its road; one that never works and bonus nodes still need
 * their key. Nothing is written to the file. docs/WORLD_MAP.md describes the page contract.
 */

export type GetLevel = (id: string) => LevelData;
export type Dir = 'left' | 'right' | 'up' | 'down';

/** The page every file starts on, always open. */
export const FIRST_PAGE: PageId = 'smb-1';

/** A fresh file: World 1 open, the hero on its start node. */
export function newMapProgress(): MapProgress {
  return {
    cleared: [],
    pages: [FIRST_PAGE],
    secrets: [],
    position: { page: FIRST_PAGE, node: 'start' },
    gameCleared: false,
  };
}

/** Reveal/animation id of a path ('1-1>1-2'). */
export function pathId(p: MapPath): string {
  return `${p.from}>${p.to}`;
}

/** Reveal/animation id of a world exit ('1-4>smb-2'). */
export function exitId(e: WorldExit): string {
  return `${e.from}>${e.to}`;
}

function registered(id: PageId, pages: readonly WorldMapPage[]): boolean {
  return pages.some((p) => p.id === id);
}

/** World 1 always; with unlock all every registered page; otherwise the file's open pages. */
export function isPageOpen(
  progress: MapProgress,
  id: PageId,
  unlockAll = false,
  pages: readonly WorldMapPage[] = MAP_PAGES,
): boolean {
  return id === FIRST_PAGE || progress.pages.includes(id) || (unlockAll && registered(id, pages));
}

/**
 * The main levels whose clears open the Lost Levels' World 9 in campaign play ('ll9', owner
 * decision for 0.4.0): all 32 of Lost 1-1 to 8-4.
 */
export const LOST_NINE_LEVELS: readonly string[] = Array.from(
  { length: 32 },
  (_, i) => `ll-${Math.floor(i / 4) + 1}-${(i % 4) + 1}`,
);

/** How many of LOST_NINE_LEVELS the file has cleared. */
export function lostNineCleared(progress: MapProgress): number {
  return LOST_NINE_LEVELS.filter((id) => progress.cleared.includes(id)).length;
}

/**
 * A condition's progress so far, for a hint's '{n}' ('ll9': '31/32'); '' for the others.
 */
export function conditionCount(progress: MapProgress, cond: MapCondition | undefined): string {
  return cond === 'll9' ? `${lostNineCleared(progress)}/${LOST_NINE_LEVELS.length}` : '';
}

/** Whether `cond` holds (no condition always does; 'never' never does, even with unlock all). */
export function conditionMet(
  progress: MapProgress,
  cond: MapCondition | undefined,
  unlockAll = false,
): boolean {
  if (cond === undefined) return true;
  if (cond === 'never') return false;
  if (unlockAll) return true;
  if (cond === 'gameCleared') return progress.gameCleared === true;
  if (cond.startsWith('secret:')) return progress.secrets.includes(cond.slice('secret:'.length));
  if (cond === 'll9') return lostNineCleared(progress) === LOST_NINE_LEVELS.length;
  if (cond === 'llLetters') return progress.cleared.includes('ll-8-4');
  return false;
}

function node(page: WorldMapPage, id: string): MapNode | undefined {
  return page.nodes.find((n) => n.id === id);
}

/** The node's level has been cleared (start and warp nodes never are). */
export function isCleared(progress: MapProgress, page: WorldMapPage, nodeId: string): boolean {
  const n = node(page, nodeId);
  return !!n?.level && progress.cleared.includes(n.level);
}

/**
 * A node's secret key: bonus nodes always need one, any node with `unlock` needs its key. Unlock
 * all stands in for the key of a warp node that can work ('never' stays hidden).
 */
function keyFound(progress: MapProgress, n: MapNode, unlockAll = false): boolean {
  if (n.unlock)
    return progress.secrets.includes(n.unlock) || (unlockAll && n.kind === 'warp' && n.requires !== 'never');
  return n.kind !== 'bonus';
}

/**
 * Whether JUMP on the node warps: a 'warp' node, or a 'start' node carrying `to` (a page's
 * arrival node that is also a warp, like the hub's centre; arriving there never warps).
 */
export function isWarpNode(n: MapNode): boolean {
  return n.kind === 'warp' || (n.kind === 'start' && n.to !== undefined);
}

/**
 * A warp node works: its target page exists and its `requires` holds (with unlock all, every
 * condition but 'never'). Says nothing about whether the node is shown (isOpen).
 */
export function isWarpOpen(
  progress: MapProgress,
  n: MapNode,
  unlockAll = false,
  pages: readonly WorldMapPage[] = MAP_PAGES,
): boolean {
  return isWarpNode(n) && !!n.to && registered(n.to, pages) && conditionMet(progress, n.requires, unlockAll);
}

/**
 * Jumping on warp node `n` of `page` records the trip (warpTo opens its target page): it is shown
 * and works in the file alone. One that works only through Unlock all travels without recording.
 */
export function warpRecords(
  progress: MapProgress,
  page: WorldMapPage,
  n: MapNode,
  pages: readonly WorldMapPage[] = MAP_PAGES,
): boolean {
  return isOpen(progress, page, n.id) && isWarpOpen(progress, n, false, pages);
}

/**
 * The hint line for a warp node: its destination while open (`label`, else the target page's
 * title), its `hint` while locked ('???' without one).
 */
export function warpText(
  progress: MapProgress,
  n: MapNode,
  unlockAll = false,
  pages: readonly WorldMapPage[] = MAP_PAGES,
): string {
  if (!isWarpOpen(progress, n, unlockAll, pages)) return n.hint ?? '???';
  return n.label ?? pages.find((p) => p.id === n.to)?.title ?? '';
}

/**
 * A path counts as walked once its `from` node is cleared, is the start of an open page, or is
 * a found warp node that works.
 */
function pathFromDone(progress: MapProgress, page: WorldMapPage, p: MapPath): boolean {
  const from = node(page, p.from);
  if (!from) return false;
  if (from.kind === 'start') return isPageOpen(progress, page.id);
  if (from.kind === 'warp')
    return isPageOpen(progress, page.id) && keyFound(progress, from) && conditionMet(progress, from.requires);
  return isCleared(progress, page, p.from);
}

/**
 * Shown and walkable: World 1's start always; a page's start when the page is open; any node at
 * the `to` end of a path whose `from` is done (pathFromDone). Bonus nodes, and warp nodes with
 * an `unlock` key, also need their key. A locked warp node is still shown (its hint says why).
 */
export function isOpen(
  progress: MapProgress,
  page: WorldMapPage,
  nodeId: string,
  unlockAll = false,
): boolean {
  const n = node(page, nodeId);
  if (!n || !isPageOpen(progress, page.id, unlockAll) || !keyFound(progress, n, unlockAll)) return false;
  if (n.kind === 'start' || unlockAll) return true;
  return page.paths.some((p) => p.to === nodeId && pathFromDone(progress, page, p));
}

/** Unlock all: a path is open when both its ends are (a node still hidden keeps its path hidden). */
export function isPathOpen(
  progress: MapProgress,
  page: WorldMapPage,
  p: MapPath,
  unlockAll = false,
): boolean {
  if (unlockAll) return isOpen(progress, page, p.from, true) && isOpen(progress, page, p.to, true);
  return pathFromDone(progress, page, p) && isOpen(progress, page, p.to);
}

/**
 * A world exit opens when the node it leaves from (the castle) is cleared and its `requires`
 * holds (with unlock all: when the node is open and the condition isn't 'never').
 */
export function isExitOpen(
  progress: MapProgress,
  page: WorldMapPage,
  e: WorldExit,
  unlockAll = false,
): boolean {
  if (!conditionMet(progress, e.requires, unlockAll)) return false;
  if (unlockAll) return isOpen(progress, page, e.from, true);
  return isPageOpen(progress, page.id) && isCleared(progress, page, e.from);
}

/**
 * The hint line on node `nodeId` while a world exit leaving it with a `hint` is locked (its
 * '{n}' filled in by conditionCount: 'WORLD 9 - CLEAR 1-1 TO 8-4 31/32'); '' when there is none.
 */
export function exitHint(
  progress: MapProgress,
  page: WorldMapPage,
  nodeId: string,
  unlockAll = false,
): string {
  const e = page.exits.find((x) => x.from === nodeId && x.hint && !isExitOpen(progress, page, x, unlockAll));
  return e?.hint ? e.hint.replace('{n}', conditionCount(progress, e.requires)) : '';
}

/** The paths and world exits to draw. */
export function openPaths(
  progress: MapProgress,
  page: WorldMapPage,
  unlockAll = false,
): { paths: MapPath[]; exits: WorldExit[] } {
  return {
    paths: page.paths.filter((p) => isPathOpen(progress, page, p, unlockAll)),
    exits: page.exits.filter((e) => isExitOpen(progress, page, e, unlockAll)),
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

/** A reveal id qualified by its page: 'smb-2:start', 'smb-1:1-1>1-2', 'hub:start>ll'. */
export function revealId(page: PageId, id: string): string {
  return `${page}:${id}`;
}

/** Splits a reveal id back into its page and page-local id (null when malformed). */
export function parseRevealId(rid: string): { page: PageId; id: string } | null {
  const i = rid.indexOf(':');
  return i > 0 && i < rid.length - 1 ? { page: rid.slice(0, i), id: rid.slice(i + 1) } : null;
}

function openedBy(pages: readonly WorldMapPage[], progress: MapProgress, change: () => void): string[] {
  const before = new Set(pages.flatMap((p) => openIds(progress, p).map((id) => revealId(p.id, id))));
  change();
  const out: string[] = [];
  for (const p of pages)
    for (const id of openIds(progress, p)) {
      const rid = revealId(p.id, id);
      if (!before.has(rid)) out.push(rid);
    }
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

/**
 * The page and node a (main) level sits on: the level → page lookup ('ll-3-2' is wherever a
 * node says `level: 'll-3-2'`; nothing parses the world number).
 */
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

function openPage(progress: MapProgress, id: PageId): void {
  if (!progress.pages.includes(id)) progress.pages.push(id);
}

/**
 * Records a clear of `levelId` (a sub-area counts for its main level) in `progress`, puts the
 * hero on its node, and on a castle clear opens the pages its exits lead to (those whose
 * `requires` holds). Returns the page-qualified `revealId`s of the nodes, `pathId`s and
 * `exitId`s that were not open before (on every page), for the reveal animation; levels not on
 * any page change nothing but the cleared list.
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
    progress.position = { page: at.page.id, node: at.node.id };
    if (at.node.kind !== 'castle') return;
    // The castle's world exits lead on (World 8's castle has none: the ending follows).
    for (const e of at.page.exits)
      if (e.from === at.node.id && conditionMet(progress, e.requires)) openPage(progress, e.to);
  });
}

/**
 * Opens the pages of cleared castles' exits whose `requires` has come to hold since (the
 * Lost Levels' World 9 and A-D, opened by the global progress store). Returns the opened
 * `revealId`s. Game.showMap calls it each time the map is shown.
 */
export function openMetExits(progress: MapProgress, pages: readonly WorldMapPage[] = MAP_PAGES): string[] {
  const due = pages.flatMap((page) =>
    isPageOpen(progress, page.id)
      ? page.exits
          .filter(
            (e) =>
              e.requires !== undefined &&
              !progress.pages.includes(e.to) &&
              isExitOpen(progress, page, e) &&
              registered(e.to, pages),
          )
          .map((e) => ({ e, rid: revealId(page.id, exitId(e)) }))
      : [],
  );
  if (!due.length) return [];
  // The exits themselves count as open as soon as the condition holds: draw them in too.
  const opened = openedBy(pages, progress, () => {
    for (const { e } of due) openPage(progress, e.to);
  });
  return [...due.map((d) => d.rid).filter((rid) => !opened.includes(rid)), ...opened];
}

/**
 * A warp pipe or warp node opens only its target page (its start and what its start leads to).
 * Returns the opened `revealId`s.
 */
export function warpTo(
  progress: MapProgress,
  page: PageId,
  pages: readonly WorldMapPage[] = MAP_PAGES,
): string[] {
  return openedBy(pages, progress, () => openPage(progress, page));
}

/** Records secret `key` (shows the nodes it unlocks). Returns the opened `revealId`s. */
export function findSecret(
  progress: MapProgress,
  key: string,
  pages: readonly WorldMapPage[] = MAP_PAGES,
): string[] {
  return openedBy(pages, progress, () => {
    if (!progress.secrets.includes(key)) progress.secrets.push(key);
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
  /** Back off a page's start to the page (same group) that leads here; arrive at `node` (its castle). */
  | { kind: 'back'; page: PageId; node: string; points: [number, number][] };

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
 * null when there is none. On a page's start, the way the page was entered leads back to the
 * previous page of the same group when its exit is open. Warp nodes are walked to and from like
 * any node; warping is a jump (WorldMapScene), not a step.
 */
export function nextStep(
  page: WorldMapPage,
  progress: MapProgress,
  from: string,
  dir: Dir,
  pages: readonly WorldMapPage[] = MAP_PAGES,
  unlockAll = false,
): MapStep | null {
  for (const p of page.paths) {
    if (!isPathOpen(progress, page, p, unlockAll)) continue;
    if (p.from === from && heads(p.points, dir)) return { kind: 'node', to: p.to, points: p.points.slice() };
    if (p.to === from) {
      const back = p.points.slice().reverse();
      if (heads(back, dir)) return { kind: 'node', to: p.from, points: back };
    }
  }
  for (const e of page.exits) {
    if (
      e.from !== from ||
      !isExitOpen(progress, page, e, unlockAll) ||
      !isPageOpen(progress, e.to, unlockAll, pages)
    )
      continue;
    if (heads(e.points, dir)) return { kind: 'exit', exit: e, points: e.points.slice() };
  }
  if (node(page, from)?.kind === 'start') {
    for (const prev of pages) {
      if (prev.id === page.id || prev.group !== page.group) continue;
      const e = prev.exits.find((x) => x.to === page.id && isExitOpen(progress, prev, x, unlockAll));
      if (!e || OPPOSITE[SIDE_DIR[e.side]] !== dir) continue;
      const start = node(page, from) as MapNode;
      const [dx, dy] = DELTA[dir];
      // Straight on to the page edge.
      const points: [number, number][] = [[start.x, start.y]];
      for (let x = start.x + dx, y = start.y + dy; x >= 0 && x < 16 && y >= 0 && y < 15; x += dx, y += dy)
        points.push([x, y]);
      if (points.length < 2) points.push([start.x + dx, start.y + dy]);
      return { kind: 'back', page: prev.id, node: e.from, points };
    }
  }
  return null;
}
