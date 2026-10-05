import { describe, expect, it } from 'vitest';
import type { LevelData } from '../level/schema';
import type { MapNode, MapPath, WorldMapPage } from './types';
import {
  clearLevel,
  entryLevel,
  exitId,
  isCleared,
  isOpen,
  mainLevel,
  newMapProgress,
  nextStep,
  openPaths,
  parseRevealId,
  pathId,
  revealId,
  warpTo,
} from './rules';

/** A straight road like the placeholder pages: start, W-1..W-3, the W-4 castle, a hidden bonus off W-2. */
function straightPage(world: number): WorldMapPage {
  const y = 7;
  const xs = [1, 4, 7, 10, 13];
  const nodes: MapNode[] = [
    { id: 'start', kind: 'start', x: 1, y },
    ...[1, 2, 3, 4].map((s): MapNode => ({
      id: `${world}-${s}`,
      kind: s === 4 ? 'castle' : 'level',
      level: `${world}-${s}`,
      x: xs[s] as number,
      y,
    })),
    { id: `bonus-${world}`, kind: 'bonus', x: 7, y: 11, unlock: `key-${world}` },
  ];
  const line = (a: number, b: number): [number, number][] =>
    Array.from({ length: b - a + 1 }, (_, i): [number, number] => [a + i, y]);
  const paths: MapPath[] = [];
  for (let s = 0; s < 4; s++)
    paths.push({
      from: s === 0 ? 'start' : `${world}-${s}`,
      to: `${world}-${s + 1}`,
      points: line(xs[s] as number, xs[s + 1] as number),
    });
  paths.push({
    from: `${world}-2`,
    to: `bonus-${world}`,
    points: [8, 9, 10, 11].reduce<[number, number][]>((a, yy) => [...a, [7, yy]], [[7, 7]]),
  });
  return {
    world,
    title: `TEST ${world}`,
    theme: 'grass',
    music: 'title',
    tiles: Array.from({ length: 15 }, () => '.'.repeat(16)),
    nodes,
    paths,
    exits:
      world < 3
        ? [
            {
              from: `${world}-4`,
              toWorld: world + 1,
              side: 'right',
              points: [
                [13, y],
                [14, y],
                [15, y],
              ],
            },
          ]
        : [],
    actors: [],
  };
}

const PAGES = [1, 2, 3].map(straightPage);
const P1 = PAGES[0] as WorldMapPage;
const P2 = PAGES[1] as WorldMapPage;

/** Levels: main ids plus 1-2's intro and exit sub-areas (parent 1-2). */
function getLevel(id: string): LevelData {
  const known: Record<string, string | null> = {
    '1-1': null,
    '1-2': null,
    '1-2-intro': '1-2',
    '1-2-exit': '1-2',
    '1-3': null,
    '1-4': null,
    '2-1': null,
  };
  if (!(id in known)) throw new Error(`no level ${id}`);
  return { id, parent: known[id] } as LevelData;
}

/** World 3's main levels, for the last-page test. */
const getLevel3 = (id: string) => ({ id, parent: null }) as LevelData;

const open = (p: ReturnType<typeof newMapProgress>, page: WorldMapPage) =>
  page.nodes.filter((n) => isOpen(p, page, n.id)).map((n) => n.id);

describe('map rules', () => {
  it('opens one node at a time along the road', () => {
    const p = newMapProgress();
    expect(open(p, P1)).toEqual(['start', '1-1']);
    expect(open(p, P2)).toEqual([]);
    expect(clearLevel(p, '1-1', getLevel, PAGES)).toEqual(['1:1-1>1-2', '1:1-2']);
    expect(open(p, P1)).toEqual(['start', '1-1', '1-2']);
    expect(isCleared(p, P1, '1-1')).toBe(true);
    expect(isCleared(p, P1, '1-2')).toBe(false);
    expect(p.position).toEqual({ world: 1, node: '1-1' });
    clearLevel(p, '1-2', getLevel, PAGES);
    expect(open(p, P1)).toEqual(['start', '1-1', '1-2', '1-3']);
    // Clearing again opens nothing new.
    expect(clearLevel(p, '1-2', getLevel, PAGES)).toEqual([]);
    expect(p.cleared).toEqual(['1-1', '1-2']);
  });

  it('only open paths are drawn', () => {
    const p = newMapProgress();
    expect(openPaths(p, P1).paths.map(pathId)).toEqual(['start>1-1']);
    expect(openPaths(p, P1).exits).toEqual([]);
  });

  it('a castle clear opens the world exit and the next world', () => {
    const p = newMapProgress();
    for (const id of ['1-1', '1-2', '1-3']) clearLevel(p, id, getLevel, PAGES);
    const opened = clearLevel(p, '1-4', getLevel, PAGES);
    // Ids are world-qualified: World 1's exit, then World 2's start, path and first level.
    expect(opened).toEqual([`1:${exitId(P1.exits[0]!)}`, '2:start', '2:start>2-1', '2:2-1']);
    expect(opened.map(parseRevealId)).toContainEqual({ world: 2, id: 'start' });
    expect(p.worlds).toEqual([1, 2]);
    expect(open(p, P2)).toEqual(['start', '2-1']);
    expect(openPaths(p, P1).exits.map((e) => e.toWorld)).toEqual([2]);
  });

  it('a warp opens only its target world', () => {
    const p = newMapProgress();
    clearLevel(p, '1-1', getLevel, PAGES);
    expect(warpTo(p, 3, PAGES)).toEqual(['3:start', '3:start>3-1', '3:3-1']);
    expect(p.worlds).toEqual([1, 3]);
    expect(open(p, P2)).toEqual([]);
    expect(open(p, PAGES[2]!)).toEqual(['start', '3-1']);
    expect(warpTo(p, 3, PAGES)).toEqual([]);
  });

  it('a castle without a world exit (World 8) opens no new world', () => {
    const p = newMapProgress();
    p.worlds.push(3);
    for (const id of ['3-1', '3-2', '3-3', '3-4']) clearLevel(p, id, getLevel3, PAGES);
    expect(p.worlds).toEqual([1, 3]);
    expect(p.cleared).toContain('3-4');
  });

  it('reveal ids round-trip', () => {
    expect(revealId(2, 'start')).toBe('2:start');
    expect(parseRevealId('1:1-1>1-2')).toEqual({ world: 1, id: '1-1>1-2' });
    expect(parseRevealId('start')).toBeNull();
  });

  it('a sub-area clear counts for its main level', () => {
    expect(mainLevel('1-2-exit', getLevel)).toBe('1-2');
    expect(mainLevel('1-2', getLevel)).toBe('1-2');
    expect(mainLevel('9-9', getLevel)).toBe('9-9');
    const p = newMapProgress();
    clearLevel(p, '1-1', getLevel, PAGES);
    clearLevel(p, '1-2-exit', getLevel, PAGES);
    expect(p.cleared).toEqual(['1-1', '1-2']);
    expect(isOpen(p, P1, '1-3')).toBe(true);
  });

  it('a bonus node stays hidden until its key is found', () => {
    const p = newMapProgress();
    clearLevel(p, '1-1', getLevel, PAGES);
    clearLevel(p, '1-2', getLevel, PAGES);
    expect(isOpen(p, P1, 'bonus-1')).toBe(false);
    expect(openPaths(p, P1).paths.map(pathId)).not.toContain('1-2>bonus-1');
    p.secrets.push('key-1');
    expect(isOpen(p, P1, 'bonus-1')).toBe(true);
    expect(openPaths(p, P1).paths.map(pathId)).toContain('1-2>bonus-1');
    // The key alone is not enough: the path's start must be cleared.
    const q = newMapProgress();
    q.secrets.push('key-1');
    expect(isOpen(q, P1, 'bonus-1')).toBe(false);
  });

  it('entryLevel starts at the intro when there is one', () => {
    expect(entryLevel('1-2', getLevel)).toBe('1-2-intro');
    expect(entryLevel('1-1', getLevel)).toBe('1-1');
  });
});

describe('nextStep', () => {
  // start (2,3) ─┐ 1-1 at (5,6) via a bend; 1-1 → 1-2 goes up then right then down.
  const bent: WorldMapPage = {
    ...straightPage(1),
    nodes: [
      { id: 'start', kind: 'start', x: 2, y: 3 },
      { id: '1-1', kind: 'level', level: '1-1', x: 5, y: 6 },
      { id: '1-2', kind: 'level', level: '1-2', x: 9, y: 6 },
    ],
    paths: [
      {
        from: 'start',
        to: '1-1',
        points: [
          [2, 3],
          [3, 3],
          [4, 3],
          [5, 3],
          [5, 4],
          [5, 5],
          [5, 6],
        ],
      },
      {
        from: '1-1',
        to: '1-2',
        points: [
          [5, 6],
          [5, 5],
          [6, 5],
          [7, 5],
          [8, 5],
          [9, 5],
          [9, 6],
        ],
      },
    ],
    exits: [],
  };

  it('follows the first step of an open path, either way along it', () => {
    const p = newMapProgress();
    expect(nextStep(bent, p, 'start', 'down', [bent])).toBeNull();
    const s = nextStep(bent, p, 'start', 'right', [bent]);
    expect(s?.kind).toBe('node');
    expect(s && s.kind === 'node' ? s.to : null).toBe('1-1');
    expect(s?.points).toEqual(bent.paths[0]!.points);
    // Back from 1-1: up, along the reversed points.
    const back = nextStep(bent, p, '1-1', 'up', [bent]);
    expect(back && back.kind === 'node' ? back.to : null).toBe('start');
    expect(back?.points[0]).toEqual([5, 6]);
    expect(back?.points.at(-1)).toEqual([2, 3]);
    // 1-2 is locked: 1-1 → 1-2 isn't open, so only "up" (back to start) leads anywhere.
    expect(nextStep(bent, p, '1-1', 'right', [bent])).toBeNull();
  });

  it('two paths leaving a node the same way: the open one wins', () => {
    const p = newMapProgress();
    clearLevel(p, '1-1', getLevel, [bent]);
    // From 1-1 both paths start "up"; the reversed start path comes first.
    const s = nextStep(bent, p, '1-1', 'up', [bent]);
    expect(s && s.kind === 'node' ? s.to : null).toBe('start');
  });

  it('walks off an open world exit, and back from the next start', () => {
    const p = newMapProgress();
    for (const id of ['1-1', '1-2', '1-3']) clearLevel(p, id, getLevel, PAGES);
    expect(nextStep(P1, p, '1-4', 'right', PAGES)).toBeNull();
    clearLevel(p, '1-4', getLevel, PAGES);
    const s = nextStep(P1, p, '1-4', 'right', PAGES);
    expect(s?.kind).toBe('exit');
    expect(s && s.kind === 'exit' ? s.exit.toWorld : null).toBe(2);
    const back = nextStep(P2, p, 'start', 'left', PAGES);
    expect(back && back.kind === 'back' ? [back.world, back.node] : null).toEqual([1, '1-4']);
    expect(back?.points.at(-1)).toEqual([0, 7]);
    // A warped-to world has no way back while the previous castle stands.
    const q = newMapProgress();
    warpTo(q, 3, PAGES);
    expect(nextStep(PAGES[2]!, q, 'start', 'left', PAGES)).toBeNull();
  });
});
