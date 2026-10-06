import { beforeEach, describe, expect, it } from 'vitest';
import type { LevelData } from '../level/schema';
import type { MapNode, MapPath, WorldMapPage } from './types';
import {
  clearLevel,
  entryLevel,
  exitId,
  isCleared,
  isExitOpen,
  isOpen,
  isPathOpen,
  isPageOpen,
  mainLevel,
  newMapProgress,
  nextStep,
  openPaths,
  parseRevealId,
  pathId,
  revealId,
  warpTo,
  conditionMet,
  findSecret,
  isWarpNode,
  isWarpOpen,
  openMetExits,
  warpText,
  conditionCount,
  exitHint,
  LOST_NINE_LEVELS,
} from './rules';
import { saveProgress, type Progress } from '@engine/save/progress';

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
    id: `smb-${world}`,
    group: 'smb',
    label: `WORLD ${world}`,
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
              to: `smb-${world + 1}`,
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
    expect(clearLevel(p, '1-1', getLevel, PAGES)).toEqual(['smb-1:1-1>1-2', 'smb-1:1-2']);
    expect(open(p, P1)).toEqual(['start', '1-1', '1-2']);
    expect(isCleared(p, P1, '1-1')).toBe(true);
    expect(isCleared(p, P1, '1-2')).toBe(false);
    expect(p.position).toEqual({ page: 'smb-1', node: '1-1' });
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
    expect(opened).toEqual([`smb-1:${exitId(P1.exits[0]!)}`, 'smb-2:start', 'smb-2:start>2-1', 'smb-2:2-1']);
    expect(opened.map(parseRevealId)).toContainEqual({ page: 'smb-2', id: 'start' });
    expect(p.pages).toEqual(['smb-1', 'smb-2']);
    expect(open(p, P2)).toEqual(['start', '2-1']);
    expect(openPaths(p, P1).exits.map((e) => e.to)).toEqual(['smb-2']);
  });

  it('a warp opens only its target world', () => {
    const p = newMapProgress();
    clearLevel(p, '1-1', getLevel, PAGES);
    expect(warpTo(p, 'smb-3', PAGES)).toEqual(['smb-3:start', 'smb-3:start>3-1', 'smb-3:3-1']);
    expect(p.pages).toEqual(['smb-1', 'smb-3']);
    expect(open(p, P2)).toEqual([]);
    expect(open(p, PAGES[2]!)).toEqual(['start', '3-1']);
    expect(warpTo(p, 'smb-3', PAGES)).toEqual([]);
  });

  it('a castle without a world exit (World 8) opens no new world', () => {
    const p = newMapProgress();
    p.pages.push('smb-3');
    for (const id of ['3-1', '3-2', '3-3', '3-4']) clearLevel(p, id, getLevel3, PAGES);
    expect(p.pages).toEqual(['smb-1', 'smb-3']);
    expect(p.cleared).toContain('3-4');
  });

  it('reveal ids round-trip', () => {
    expect(revealId('smb-2', 'start')).toBe('smb-2:start');
    expect(parseRevealId('smb-1:1-1>1-2')).toEqual({ page: 'smb-1', id: '1-1>1-2' });
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
    expect(s && s.kind === 'exit' ? s.exit.to : null).toBe('smb-2');
    const back = nextStep(P2, p, 'start', 'left', PAGES);
    expect(back && back.kind === 'back' ? [back.page, back.node] : null).toEqual(['smb-1', '1-4']);
    expect(back?.points.at(-1)).toEqual([0, 7]);
    // A warped-to world has no way back while the previous castle stands.
    const q = newMapProgress();
    warpTo(q, 'smb-3', PAGES);
    expect(nextStep(PAGES[2]!, q, 'start', 'left', PAGES)).toBeNull();
  });
});

describe('unlock all (developer mode)', () => {
  const openAll = (p: ReturnType<typeof newMapProgress>, page: WorldMapPage) =>
    page.nodes.filter((n) => isOpen(p, page, n.id, true)).map((n) => n.id);

  it('opens every world, level and castle node, path and exit; bonus nodes keep needing their key', () => {
    const p = newMapProgress();
    for (const w of [1, 2, 3, 4, 5, 6, 7, 8]) expect(isPageOpen(p, `smb-${w}`, true)).toBe(true);
    expect(isPageOpen(p, 'smb-0', true)).toBe(false);
    for (const page of PAGES) {
      const w = Number(page.id.slice(4));
      expect(openAll(p, page)).toEqual(['start', `${w}-1`, `${w}-2`, `${w}-3`, `${w}-4`]);
      const { paths, exits } = openPaths(p, page, true);
      expect(paths.map(pathId)).toEqual(page.paths.filter((x) => !x.to.startsWith('bonus')).map(pathId));
      expect(exits).toEqual(page.exits);
      for (const e of page.exits) expect(isExitOpen(p, page, e, true)).toBe(true);
    }
    // The bonus node and its path still need the key.
    const bonusPath = P1.paths.find((x) => x.to === 'bonus-1')!;
    expect(isOpen(p, P1, 'bonus-1', true)).toBe(false);
    expect(isPathOpen(p, P1, bonusPath, true)).toBe(false);
    p.secrets.push('key-1');
    expect(isOpen(p, P1, 'bonus-1', true)).toBe(true);
    expect(isPathOpen(p, P1, bonusPath, true)).toBe(true);
  });

  it('marks nothing cleared and changes nothing; without it the rules are as before', () => {
    const p = newMapProgress();
    clearLevel(p, '1-1', getLevel, PAGES);
    const before = JSON.stringify(p);
    for (const page of PAGES) {
      openAll(p, page);
      openPaths(p, page, true);
    }
    expect(JSON.stringify(p)).toBe(before);
    expect(P1.nodes.filter((n) => isCleared(p, P1, n.id)).map((n) => n.id)).toEqual(['1-1']);
    expect(open(p, P1)).toEqual(['start', '1-1', '1-2']);
    expect(open(p, P2)).toEqual([]);
    expect(isPageOpen(p, 'smb-2')).toBe(false);
    expect(openPaths(p, P1).exits).toEqual([]);
  });

  it('nextStep walks past locked nodes, off the world exit and back from the next start', () => {
    const p = newMapProgress();
    expect(nextStep(P1, p, '1-1', 'right', PAGES)).toBeNull();
    const s = nextStep(P1, p, '1-1', 'right', PAGES, true);
    expect(s && s.kind === 'node' ? s.to : null).toBe('1-2');
    const exit = nextStep(P1, p, '1-4', 'right', PAGES, true);
    expect(exit && exit.kind === 'exit' ? exit.exit.to : null).toBe('smb-2');
    const back = nextStep(P2, p, 'start', 'left', PAGES, true);
    expect(back && back.kind === 'back' ? [back.page, back.node] : null).toEqual(['smb-1', '1-4']);
    expect(nextStep(P2, p, 'start', 'left', PAGES)).toBeNull();
  });
});

describe('pages, warp nodes and conditions', () => {
  /** A row of nodes on row 7: start, then `levels` (the last a castle), exits off the castle. */
  function mini(
    id: string,
    group: WorldMapPage['group'],
    levels: string[],
    exits: WorldMapPage['exits'] = [],
  ) {
    const nodes: MapNode[] = [
      { id: 'start', kind: 'start', x: 1, y: 7 },
      ...levels.map((l, i): MapNode => ({
        id: l,
        kind: i === levels.length - 1 ? 'castle' : 'level',
        level: l,
        x: 3 + 2 * i,
        y: 7,
      })),
    ];
    const paths: MapPath[] = nodes.slice(1).map((n, i) => {
      const a = nodes[i] as MapNode;
      return {
        from: a.id,
        to: n.id,
        points: [
          [a.x, 7],
          [a.x + 1, 7],
          [n.x, 7],
        ],
      };
    });
    const page: WorldMapPage = {
      id,
      group,
      label: id.toUpperCase(),
      title: `TEST ${id.toUpperCase()}`,
      theme: 'grass',
      music: 'map',
      tiles: Array.from({ length: 15 }, () => '.'.repeat(16)),
      nodes,
      paths,
      exits,
      actors: [],
    };
    return page;
  }
  const road = (x: number): [number, number][] => [
    [x, 7],
    [x + 1, 7],
  ];

  const W1: WorldMapPage = {
    ...P1,
    nodes: P1.nodes.map((n) =>
      n.kind === 'bonus' ? { ...n, kind: 'warp', to: 'hub', toNode: 'start', label: 'WARP ZONE' } : n,
    ),
  };
  const HUB: WorldMapPage = {
    ...mini('hub', 'hub', []),
    nodes: [
      { id: 'start', kind: 'start', x: 1, y: 7 },
      { id: 'home', kind: 'warp', x: 1, y: 4, to: 'smb-1', toNode: 'bonus-1', label: 'RETURN TO WORLD 1' },
      { id: 'lost', kind: 'warp', x: 4, y: 7, to: 'll-1', requires: 'gameCleared', hint: 'BEAT 8-4' },
      { id: 'never', kind: 'warp', x: 1, y: 10, to: 'hub', requires: 'never', hint: '???' },
    ],
    paths: [
      {
        from: 'start',
        to: 'home',
        points: [
          [1, 7],
          [1, 6],
          [1, 5],
          [1, 4],
        ],
      },
      {
        from: 'start',
        to: 'lost',
        points: [
          [1, 7],
          [2, 7],
          [3, 7],
          [4, 7],
        ],
      },
      {
        from: 'start',
        to: 'never',
        points: [
          [1, 7],
          [1, 8],
          [1, 9],
          [1, 10],
        ],
      },
    ],
  };
  const LL1 = mini(
    'll-1',
    'll',
    ['ll-1-1', 'll-1-2', 'll-1-4'],
    [{ from: 'll-1-4', to: 'll-2', side: 'right', points: road(7) }],
  );
  const LL2 = mini('ll-2', 'll', ['ll-2-1']);
  const LL8 = mini(
    'll-8',
    'll',
    ['ll-8-4'],
    [
      { from: 'll-8-4', to: 'll-9', side: 'right', requires: 'll9', points: road(3) },
      {
        from: 'll-8-4',
        to: 'll-10',
        side: 'top',
        requires: 'llLetters',
        points: [
          [3, 7],
          [3, 6],
        ],
      },
    ],
  );
  const LL9 = mini('ll-9', 'll', ['ll-9-1']);
  const LL10 = mini('ll-10', 'll', ['ll-10-1']);
  const ALL = [W1, P2, HUB, LL1, LL2, LL8, LL9, LL10];
  const getLevelAny = (id: string) => ({ id, parent: null }) as LevelData;

  const store = new Map<string, string>();
  const setLost = (lost: Progress['lost']) =>
    saveProgress({ v: 1, bestScore: 0, lastCharacter: 'mario', reached: {}, cleared: [], lost });
  beforeEach(() => {
    store.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  });

  it('a hidden warp node shows once its secret is found and then works', () => {
    const p = newMapProgress();
    clearLevel(p, '1-1', getLevel, ALL);
    clearLevel(p, '1-2', getLevel, ALL);
    const spot = W1.nodes.find((n) => n.id === 'bonus-1')!;
    expect(isOpen(p, W1, 'bonus-1')).toBe(false);
    expect(findSecret(p, 'key-1', ALL)).toEqual(['smb-1:1-2>bonus-1', 'smb-1:bonus-1']);
    expect(p.secrets).toEqual(['key-1']);
    expect(findSecret(p, 'key-1', ALL)).toEqual([]);
    expect(isOpen(p, W1, 'bonus-1')).toBe(true);
    expect(isWarpOpen(p, spot, false, ALL)).toBe(true);
    expect(warpText(p, spot, false, ALL)).toBe('WARP ZONE');
    // Its target page opens on the warp, start and roads to the pads drawn in.
    expect(isPageOpen(p, 'hub', false, ALL)).toBe(false);
    expect(warpTo(p, 'hub', ALL)).toEqual([
      'hub:start',
      'hub:start>home',
      'hub:home',
      'hub:start>lost',
      'hub:lost',
      'hub:start>never',
      'hub:never',
    ]);
    expect(p.pages).toEqual(['smb-1', 'hub']);
  });

  it('a start node carrying `to` is the arrival node and a warp', () => {
    const p = newMapProgress();
    p.pages.push('hub');
    const centre: WorldMapPage = {
      ...HUB,
      nodes: [
        { id: 'start', kind: 'start', x: 1, y: 7, to: 'smb-1', toNode: 'bonus-1', label: 'BACK' },
        HUB.nodes[2]!,
      ],
      paths: [HUB.paths[1]!],
    };
    const start = centre.nodes[0]!;
    expect(isWarpNode(start)).toBe(true);
    expect(isWarpNode(P1.nodes[0]!)).toBe(false);
    expect(isWarpOpen(p, start, false, ALL)).toBe(true);
    expect(warpText(p, start, false, ALL)).toBe('BACK');
    // Still the page's start: open, and its roads lead on.
    expect(isOpen(p, centre, 'start')).toBe(true);
    expect(isOpen(p, centre, 'lost')).toBe(true);
    const step = nextStep(centre, p, 'start', 'right', ALL);
    expect(step && step.kind === 'node' ? step.to : null).toBe('lost');
  });

  it('a locked pad is shown and walkable but does not work; its hint says why', () => {
    const p = newMapProgress();
    p.pages.push('hub');
    const lost = HUB.nodes.find((n) => n.id === 'lost')!;
    const never = HUB.nodes.find((n) => n.id === 'never')!;
    expect(isOpen(p, HUB, 'lost')).toBe(true);
    expect(isWarpOpen(p, lost, false, ALL)).toBe(false);
    expect(warpText(p, lost, false, ALL)).toBe('BEAT 8-4');
    const step = nextStep(HUB, p, 'start', 'right', ALL);
    expect(step && step.kind === 'node' ? step.to : null).toBe('lost');
    p.gameCleared = true;
    expect(isWarpOpen(p, lost, false, ALL)).toBe(true);
    expect(warpText(p, lost, false, ALL)).toBe('TEST LL-1'); // no label: the target's title
    expect(isWarpOpen(p, never, false, ALL)).toBe(false);
    expect(warpText(p, never, false, ALL)).toBe('???');
  });

  it('unlock all opens every page and pad except "never"; hidden warps still need their key', () => {
    const p = newMapProgress();
    for (const pg of ALL) expect(isPageOpen(p, pg.id, true, ALL)).toBe(true);
    expect(isPageOpen(p, 'll-99', true, ALL)).toBe(false);
    const [home, lost, never] = ['home', 'lost', 'never'].map((id) => HUB.nodes.find((n) => n.id === id)!);
    expect(isWarpOpen(p, home!, true, ALL)).toBe(true);
    expect(isWarpOpen(p, lost!, true, ALL)).toBe(true);
    expect(isWarpOpen(p, never!, true, ALL)).toBe(false);
    expect(isOpen(p, HUB, 'never', true)).toBe(true);
    expect(isOpen(p, W1, 'bonus-1', true)).toBe(false);
    expect(conditionMet(p, 'll9', true)).toBe(true);
    expect(conditionMet(p, 'never', true)).toBe(false);
  });

  it('conditions read the file alone (gameCleared, secrets, Lost Levels clears)', () => {
    const p = newMapProgress();
    expect(conditionMet(p, undefined)).toBe(true);
    for (const c of ['gameCleared', 'll9', 'llLetters', 'never', 'secret:x'] as const)
      expect(conditionMet(p, c), c).toBe(false);
    p.gameCleared = true;
    p.secrets.push('x');
    expect(conditionMet(p, 'gameCleared')).toBe(true);
    expect(conditionMet(p, 'secret:x')).toBe(true);
    expect(conditionMet(p, 'secret:y')).toBe(false);
    // The NES progress store does not count.
    setLost({ world9: true, letters: true, beaten: 8 });
    expect(conditionMet(p, 'll9')).toBe(false);
    expect(conditionMet(p, 'llLetters')).toBe(false);
    // World A: Lost 8-4 beaten on the file; World 9: all 32 of 1-1 to 8-4.
    p.cleared.push('ll-8-4');
    expect(conditionMet(p, 'llLetters')).toBe(true);
    expect(conditionMet(p, 'll9')).toBe(false);
    expect(conditionCount(p, 'll9')).toBe('1/32');
    p.cleared.push(
      ...LOST_NINE_LEVELS.filter((id) => id !== 'll-8-4' && id !== 'll-1-1'),
      'll-9-1',
      'll-10-1',
    );
    expect(conditionCount(p, 'll9')).toBe('31/32');
    expect(conditionMet(p, 'll9')).toBe(false);
    p.cleared.push('ll-1-1');
    expect(conditionMet(p, 'll9')).toBe(true);
    expect(conditionCount(p, 'll9')).toBe('32/32');
    expect(conditionCount(p, 'llLetters')).toBe('');
  });

  it('a locked world exit with a hint shows it on its node, with the count filled in', () => {
    const p = newMapProgress();
    p.pages.push('ll-8');
    const page = { ...LL8, exits: LL8.exits.map((e) => (e.to === 'll-9' ? { ...e, hint: 'NINE {n}' } : e)) };
    expect(exitHint(p, page, 'll-8-4')).toBe('NINE 0/32');
    expect(exitHint(p, page, 'start')).toBe('');
    expect(exitHint(p, page, 'll-8-4', true)).toBe(''); // unlock all: open
    p.cleared.push(...LOST_NINE_LEVELS);
    expect(exitHint(p, page, 'll-8-4')).toBe('');
  });

  it('Lost Levels clears find their page by lookup; a castle opens the next page', () => {
    const p = newMapProgress();
    p.pages.push('ll-1');
    expect(clearLevel(p, 'll-1-1', getLevelAny, ALL)).toEqual(['ll-1:ll-1-1>ll-1-2', 'll-1:ll-1-2']);
    expect(p.position).toEqual({ page: 'll-1', node: 'll-1-1' });
    clearLevel(p, 'll-1-2', getLevelAny, ALL);
    expect(clearLevel(p, 'll-1-4', getLevelAny, ALL)).toEqual([
      'll-1:ll-1-4>ll-2',
      'll-2:start',
      'll-2:start>ll-2-1',
      'll-2:ll-2-1',
    ]);
    expect(p.pages).toEqual(['smb-1', 'll-1', 'll-2']);
    // Back off ll-2's start leads to ll-1's castle (same group); the hub has no way back.
    const back = nextStep(LL2, p, 'start', 'left', ALL);
    expect(back && back.kind === 'back' ? [back.page, back.node] : null).toEqual(['ll-1', 'll-1-4']);
    p.pages.push('hub');
    expect(nextStep(HUB, p, 'start', 'left', ALL)).toBeNull();
  });

  it('exits with requires open only while it holds, also after the castle was cleared', () => {
    const p = newMapProgress();
    p.pages.push('ll-8');
    // 8-4 beaten: 'llLetters' holds at once, 'll9' (all 32 of 1-1 to 8-4) not yet.
    const opened = clearLevel(p, 'll-8-4', getLevelAny, ALL);
    expect(opened[0]).toBe('ll-8:ll-8-4>ll-10');
    expect(opened).toContain('ll-10:start');
    expect(p.pages).toEqual(['smb-1', 'll-8', 'll-10']);
    expect(openPaths(p, LL8).exits.map((e) => e.to)).toEqual(['ll-10']);
    expect(openMetExits(p, ALL)).toEqual([]);
    // The other 31 cleared later, anywhere: World 9 opens the next time the map is shown.
    p.cleared.push(...LOST_NINE_LEVELS.filter((id) => id !== 'll-8-4'));
    expect(openPaths(p, LL8).exits.map((e) => e.to)).toEqual(['ll-9', 'll-10']);
    expect(openMetExits(p, ALL)).toEqual([
      'll-8:ll-8-4>ll-9',
      'll-9:start',
      'll-9:start>ll-9-1',
      'll-9:ll-9-1',
    ]);
    expect(p.pages).toEqual(['smb-1', 'll-8', 'll-10', 'll-9']);
    expect(openMetExits(p, ALL)).toEqual([]);
  });
});
