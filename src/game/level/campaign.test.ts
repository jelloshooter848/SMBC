import { describe, expect, it } from 'vitest';
import { getLevel, levelIds } from '@content/levels';
import { campaignLevel } from './campaign';
import { parseTextMap, serializeTextMap } from './textmap';
import { T } from './tiles';
import type { LevelData, Zone } from './schema';

// Campaign variants of warp zones (docs/WORLD_MAP.md): 1-2's `secret` (one pipe, a secret exit)
// and 4-2's two `goto` zones (into an area of 4-2): the vine area's one pipe into Samus's cavern,
// and the right zone's anchor chain (a climb `goto`: no pipe) up to Larry's airship. Non-campaign
// play keeps every warp as in SMB.

type Pipe = Zone & { kind: 'pipe' };
const pipesIn = (l: LevelData, x0: number, x1: number) =>
  l.zones.filter((z): z is Pipe => z.kind === 'pipe' && z.x >= x0 && z.x < x1);
const warp = (l: LevelData) => l.zones.find((z): z is Zone & { kind: 'warp' } => z.kind === 'warp');
const tile = (l: LevelData, x: number, y: number) => l.tiles[y * l.width + x];
/** The airship (L1's area) counted as there, whether or not it is bundled yet. */
const withAirship = (id: string) => id === '4-2-airship' || levelIds().includes(id);

describe('4-2 vine area (4-2-warp): campaign variant', () => {
  it('outside the campaign: the three numbered pipes to 8-1, 7-1 and 6-1 and the welcome text', () => {
    const l = getLevel('4-2-warp');
    expect(pipesIn(l, 48, 64).map((p) => [p.x, p.target])).toEqual([
      [50, { level: '8-1', x: 2, y: 12 }],
      [54, { level: '7-1', x: 2, y: 12 }],
      [58, { level: '6-1', x: 2, y: 12 }],
    ]);
    expect(warp(l)).toMatchObject({ worlds: [8, 7, 6], text: 'WELCOME TO WARP ZONE!' });
  });

  it('campaign: ONE pipe (the middle one) into 4-2-cavern, no world numbers, no text', () => {
    const base = getLevel('4-2-warp');
    const l = campaignLevel(base);
    expect(l).not.toBe(base);
    expect(pipesIn(l, 48, 64).map((p) => [p.x, p.target])).toEqual([
      [54, { level: '4-2-cavern', x: 2, y: 0 }],
    ]);
    expect(warp(l)?.worlds).toEqual([]);
    expect(warp(l)?.text).toBeUndefined();
    // The other two pipes are gone from the room; the middle one stands.
    for (const x of [50, 51, 58, 59]) for (const y of [10, 11, 12]) expect(tile(l, x, y)).toBe(T.AIR);
    expect(tile(l, 54, 10)).toBe(T.PIPE_TL);
    // The level itself is untouched (dev select and ?level= keep the warps).
    expect(pipesIn(base, 48, 64)).toHaveLength(3);
    expect(tile(base, 50, 10)).toBe(T.PIPE_TL);
    // Cached: the same variant each time.
    expect(campaignLevel(base)).toBe(l);
  });

  it('the cavern target lies inside 4-2-cavern, an area of 4-2', () => {
    const cave = getLevel('4-2-cavern');
    const t = pipesIn(campaignLevel(getLevel('4-2-warp')), 48, 64)[0]!.target;
    expect(t.x).toBeLessThan(cave.width);
    expect(tile(cave, t.x, t.y)).toBe(T.AIR);
    expect(cave.parent).toBe('4-2');
  });
});

describe('4-2 (the right warp zone): campaign variant', () => {
  it('outside the campaign: one numbered pipe to 5-1', () => {
    const l = getLevel('4-2');
    expect(pipesIn(l, 208, 224).map((p) => [p.x, p.target])).toEqual([[214, { level: '5-1', x: 2, y: 12 }]]);
    expect(warp(l)).toMatchObject({ worlds: [5], text: 'WELCOME TO WARP ZONE!' });
  });

  it('campaign: the classic look over a dead pipe, and the anchor drop waiting; no pipe zone', () => {
    const base = getLevel('4-2');
    const l = campaignLevel(base, withAirship);
    expect(warp(base)?.goto).toEqual({ level: '4-2-airship', x: 2, y: 3, exitDir: 'climb' });
    expect(warp(base)?.until).toBe('larry');
    // The pipe stands (solid, for the anchor to smash) but is no pipe zone: it never warps.
    expect(pipesIn(l, 208, 224)).toEqual([]);
    expect(tile(l, 214, 10)).toBe(T.PIPE_TL);
    // The classic look: the 5 over the pipe (labelAt) and the welcome text.
    expect(warp(l)).toMatchObject({
      worlds: [5],
      text: 'WELCOME TO WARP ZONE!',
      labelAt: [{ x: 214, y: 10 }],
    });
    // The anchor drop on the floor (row 13) where the pipe stands; the vine zone on its chain's
    // foot leads to the bow. The ceiling stays whole until the anchor breaks it.
    expect(l.entities.filter((e) => e.type === 'anchor-drop' || e.type === 'chain')).toEqual([
      { type: 'anchor-drop', x: 214, y: 12, props: { len: 14, pipe: 10, holes: '2', room: '208,224' } },
    ]);
    expect(l.zones.filter((z) => z.kind === 'vine' && z.x >= 208)).toEqual([
      { kind: 'vine', x: 214, y: 12, target: { level: '4-2-airship', x: 2, y: 3 } },
    ]);
    expect(l.decor).toEqual(base.decor);
    expect(tile(l, 214, 2)).toBe(tile(base, 214, 2));
    // The rest of 4-2 is as it was.
    const other = (z: Zone) =>
      z.kind !== 'warp' && !(z.x === 214 && (z.kind === 'pipe' || z.kind === 'vine'));
    expect(l.zones.filter(other)).toEqual(base.zones.filter(other));
    expect(l.entities.filter((e) => e.type !== 'anchor-drop')).toEqual(base.entities);
  });

  it('with `larry` on the file: the smashed stump only (no drop, no vine, no pipe, no text)', () => {
    const l = campaignLevel(getLevel('4-2'), withAirship, ['larry']);
    expect(pipesIn(l, 208, 224)).toEqual([]);
    expect([tile(l, 214, 10), tile(l, 214, 11), tile(l, 214, 12), tile(l, 215, 12)]).toEqual([
      T.AIR,
      T.AIR,
      T.PIPE_BL,
      T.PIPE_BR,
    ]);
    expect(l.entities.some((e) => e.type === 'anchor-drop')).toBe(false);
    expect(l.zones.some((z) => z.kind === 'vine' && z.x >= 208)).toBe(false);
    expect(warp(l)?.worlds).toEqual([]);
    expect(warp(l)?.text).toBeUndefined();
  });

  it('the vine-area zone (a plain goto) still keeps its one pipe: only `climb` gets an anchor', () => {
    const l = campaignLevel(getLevel('4-2-warp'));
    expect(l.entities.some((e) => e.type === 'anchor-drop')).toBe(false);
    expect(pipesIn(l, 48, 64)).toHaveLength(1);
  });

  it('a goto whose level is not in the library (yet) leaves the warp as it is', () => {
    const base = getLevel('4-2');
    expect(campaignLevel(base, () => false)).toBe(base);
  });
});

describe('no 4-2 campaign pipe is a secret exit (no map road comes from them)', () => {
  it('neither pipe carries a secret, so LevelScene enters the area instead of Game.campaignSecret', () => {
    for (const id of ['4-2', '4-2-warp']) {
      const l = campaignLevel(getLevel(id), withAirship);
      for (const p of l.zones.filter((z): z is Pipe => z.kind === 'pipe'))
        expect(p.target.secret, `${id} ${p.x}`).toBeUndefined();
    }
  });

  it('both lead into areas of 4-2 (same world and stage: the clock carries, no warp)', () => {
    const chain = campaignLevel(getLevel('4-2'), withAirship).zones.find(
      (z): z is Zone & { kind: 'vine' } => z.kind === 'vine' && z.x >= 208,
    );
    const into = [
      ...pipesIn(campaignLevel(getLevel('4-2-warp')), 48, 64).map((p) => p.target),
      chain?.target,
    ].map((t) => t?.level);
    expect(into).toEqual(['4-2-cavern', '4-2-airship']);
    const cave = getLevel('4-2-cavern');
    expect([cave.world, cave.stage, cave.parent]).toEqual([4, 2, '4-2']);
  });
});

describe('1-2 keeps its secret variant', () => {
  it('one pipe with secret bonus-1 (the welcome text stays)', () => {
    const l = campaignLevel(getLevel('1-2'));
    expect(pipesIn(l, 176, 192).map((p) => [p.x, p.target.level, p.target.secret])).toEqual([
      [182, '3-1', 'bonus-1'],
    ]);
    expect(warp(l)).toMatchObject({ worlds: [], text: 'WELCOME TO WARP ZONE!', secret: 'bonus-1' });
  });
});

describe('warp zone goto in the map format', () => {
  const src = (z: string) =>
    [
      'id: t',
      'time: 300',
      '',
      '[tiles]',
      ...Array.from({ length: 15 }, () => '.'.repeat(16)),
      '',
      '[zones]',
      z,
    ].join('\n');

  it('parses goto=level,x,y[,exit] and writes it back', () => {
    const a = parseTextMap(src('warp 0 16 worlds=2 goto=4-2-cavern,2,0'), 't');
    expect(warp(a)?.goto).toEqual({ level: '4-2-cavern', x: 2, y: 0 });
    const c = parseTextMap(src('warp 0 16 worlds=2 goto=x-1,2,3,climb until=larry'), 't');
    expect(warp(c)?.goto).toEqual({ level: 'x-1', x: 2, y: 3, exitDir: 'climb' });
    expect(warp(c)?.until).toBe('larry');
    expect(serializeTextMap(c)).toContain('goto=x-1,2,3,climb until=larry');
    const b = parseTextMap(src('warp 0 16 worlds=2 goto=x-1,3,4,up'), 't');
    expect(warp(b)?.goto).toEqual({ level: 'x-1', x: 3, y: 4, exitDir: 'up' });
    expect(serializeTextMap(b)).toContain('warp 0 16 worlds=2 goto=x-1,3,4,up');
    expect(warp(parseTextMap(serializeTextMap(b), 't'))).toEqual(warp(b));
  });

  it('a malformed goto is an error', () => {
    expect(() => parseTextMap(src('warp 0 16 worlds=2 goto=nowhere'), 't')).toThrow(/goto/);
  });
});
