import { MAP_PAGES } from '@content/worldmap';
import type { MapProgress, WorldMapPage } from '../map/types';
import {
  isOpen,
  isPageOpen,
  isPathOpen,
  isWarpNode,
  isWarpOpen,
  parseRevealId,
  pathId,
  revealId,
} from '../map/rules';

/*
 * The Lost Levels in campaign play (docs/WORLD_MAP.md): their levels sit on the 'll-*' pages and
 * play like SMB's from the map. What is theirs alone:
 * - their warp zones stay as on the NES (backward ones too): a warp pipe opens only its target
 *   page and the map moves there (Game.campaignWarpToMap), and the file remembers it was used
 *   (secret LOST_WARPED), so a later 8-4 clear on that file is not warpless (World 9);
 * - their three game ends (8-4, 9-4, D-4) return to the map (Game.showLostEnding), and a warp
 *   node whose condition the ending made true (worlds A-D, 'llLetters') draws its road in.
 */

/** File secret: a Lost Levels warp pipe was taken on this file (no World 9 from its 8-4 clears). */
export const LOST_WARPED = 'll-warped';

/** A Lost Levels level id ('ll-3-2', 'll-9-1-start'). */
export function isLostLevel(id: string): boolean {
  return id.startsWith('ll-');
}

/** Page-qualified ids (rules.revealId) of the warp nodes shown on open pages that work now. */
export function workingWarps(progress: MapProgress, pages: readonly WorldMapPage[] = MAP_PAGES): Set<string> {
  const out = new Set<string>();
  for (const page of pages) {
    if (!isPageOpen(progress, page.id)) continue;
    for (const n of page.nodes)
      if (isWarpNode(n) && isOpen(progress, page, n.id) && isWarpOpen(progress, n, false, pages))
        out.add(revealId(page.id, n.id));
  }
  return out;
}

/**
 * The warp nodes that work now but were not in `before` (workingWarps), each as the open roads
 * to it then the node itself, to draw in on the map so the newly open warp is plain to see.
 */
export function warpsOpened(
  progress: MapProgress,
  before: ReadonlySet<string>,
  pages: readonly WorldMapPage[] = MAP_PAGES,
): string[] {
  const out: string[] = [];
  for (const rid of workingWarps(progress, pages)) {
    if (before.has(rid)) continue;
    const r = parseRevealId(rid);
    const page = pages.find((p) => p.id === r?.page);
    if (!r || !page) continue;
    const id = r.id;
    for (const p of page.paths)
      if ((p.to === id || p.from === id) && isPathOpen(progress, page, p))
        out.push(revealId(page.id, pathId(p)));
    out.push(rid);
  }
  return out;
}
