import { describe, expect, it } from 'vitest';
import { getLevel, levelIds } from '@content/levels';
import type { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { InputFrame } from '@engine/input/input-manager';
import { ScriptedInput } from '@game/sim/headless';
import type { Action } from '@engine/input/actions';
import { px, toPx } from '@engine/math/units';
import { SCREEN_W } from '@engine/viewport';
import { DEFAULT_ASSIST, newGameState } from '../context';
import { MARIO } from '../characters/mario';
import { parseTextMap, serializeTextMap } from '../level/textmap';
import { Camera, DEFAULT_AUTO_SCROLL } from './camera';
import { World } from './world';

/*
 * The opt-in auto-scroll camera (`camera: auto` + `scroll: <px per frame>` in a map's header,
 * SMB3's airships): it moves right on its own, its left edge pushes the players (squashing one
 * against a wall), they cannot leave past its right edge, and it stops at the map's end or its
 * scroll stop. Every other level keeps its camera exactly as before.
 */

const STUB_ASSETS = {
  sheet: () => ({ id: 'stub', image: null, frames: new Map() }),
  has: () => false,
} as unknown as AssetRegistry;

const ctx = () => ({
  assets: STUB_ASSETS,
  audio: NULL_AUDIO,
  assist: { ...DEFAULT_ASSIST },
  reduceFlashing: true,
});

/**
 * A 48-wide auto map with a flat floor; `wall` puts a solid column (rows 10-12) there, `extra`
 * adds header lines.
 */
function autoMap(opts: { scroll?: string; wall?: number; extra?: string[]; camera?: string } = {}): string {
  const lines = [
    'id: 9-7',
    'name: DECK',
    'theme: castle',
    'time: 300',
    'start: 2,12',
    `camera: ${opts.camera ?? 'auto'}`,
    ...(opts.scroll ? [`scroll: ${opts.scroll}`] : []),
    ...(opts.extra ?? []),
    '',
    '[tiles]',
  ];
  for (let y = 0; y < 15; y++) {
    let row = '';
    for (let x = 0; x < 48; x++) row += y >= 13 || (x === opts.wall && y >= 10) ? '#' : '.';
    lines.push(row);
  }
  return lines.join('\n');
}

const world = (src: string) => new World(parseTextMap(src), ctx(), newGameState(MARIO));

/** One input frame holding `held` (a fresh ScriptedInput each call is fine: no presses needed). */
function held(...a: Action[]): InputFrame[] {
  const i = new ScriptedInput({ steps: [] });
  i.setHeld(a);
  i.next();
  return [i];
}

describe('Text maps: `camera: auto` and `scroll`', () => {
  it('parse the camera and its speed (decimals fine), default 0.5 px per frame', () => {
    const l = parseTextMap(autoMap({ scroll: '0.75' }));
    expect(l.camera).toBe('auto');
    expect(l.scroll).toBe(0.75);
    expect(parseTextMap(autoMap()).scroll).toBe(DEFAULT_AUTO_SCROLL);
    expect(DEFAULT_AUTO_SCROLL).toBe(0.5);
  });

  it('round-trip the speed', () => {
    const l = parseTextMap(autoMap({ scroll: '1.25' }));
    const text = serializeTextMap(l);
    expect(text).toMatch(/^camera: auto$/m);
    expect(text).toMatch(/^scroll: 1.25$/m);
    const again = parseTextMap(text);
    expect(again.camera).toBe('auto');
    expect(again.scroll).toBe(1.25);
    expect([...again.tiles]).toEqual([...l.tiles]);
  });

  it('reject a bad speed, a speed without `camera: auto`, an unknown camera and a tall auto map', () => {
    for (const bad of ['0', '-1', 'fast', '1e3', '17'])
      expect(() => parseTextMap(autoMap({ scroll: bad })), bad).toThrow(/scroll must be/);
    expect(() => parseTextMap(autoMap({ camera: 'scroll', scroll: '1' }))).toThrow(/needs "camera: auto"/);
    expect(() => parseTextMap(autoMap({ camera: 'sideways' }))).toThrow(/unknown camera "sideways"/);
    expect(() => parseTextMap(autoMap({ extra: ['height: 30'] }))).toThrow(/needs "camera: free"/);
  });

  it('every library level but the airship deck keeps its camera and has no speed; the deck is auto', () => {
    for (const id of levelIds()) {
      const l = getLevel(id);
      if (id === '4-2-airship') {
        expect(l.camera).toBe('auto');
        expect(l.scroll).toBeGreaterThan(0);
        continue;
      }
      expect(l.camera, id).not.toBe('auto');
      expect(l.scroll, id).toBeUndefined();
      expect(serializeTextMap(l), id).not.toMatch(/^scroll:/m);
    }
  });
});

describe('Camera: `auto`', () => {
  it('moves right at its speed whatever the player does, and stops at its end', () => {
    const cam = new Camera(32, null, false, { autoScroll: 0.5 });
    expect(cam.auto).toBe(true);
    cam.follow(px(300));
    expect(cam.x).toBe(0); // never follows the player
    cam.scroll();
    cam.scroll();
    expect(cam.x).toBe(px(1));
    for (let i = 0; i < 2000; i++) cam.scroll();
    expect(cam.x).toBe(cam.maxX);
    expect(cam.pxX).toBe(32 * 16 - SCREEN_W);
    expect(cam.autoDone).toBe(true);
  });

  it('stops at a scroll stop; a locked auto camera never moves; other cameras ignore scroll()', () => {
    const stop = new Camera(64, 30, false, { autoScroll: 2 });
    for (let i = 0; i < 2000; i++) stop.scroll();
    expect(stop.pxX).toBe(30 * 16 - SCREEN_W);
    const locked = new Camera(64, null, true, { autoScroll: 2 });
    locked.scroll();
    expect(locked.x).toBe(0);
    const normal = new Camera(64, null);
    expect(normal.auto).toBe(false);
    normal.scroll();
    expect(normal.x).toBe(0);
  });
});

describe('World with an auto-scroll camera', () => {
  it('the camera moves on while the player stands still, and its left edge pushes him along', () => {
    const w = world(autoMap({ scroll: '1' }));
    const x0 = w.player.body.x;
    for (let i = 0; i < 60; i++) w.update([]);
    expect(w.camera.pxX).toBe(60);
    // Pushed: at the left edge, alive, on the floor.
    expect(w.player.body.x).toBeGreaterThan(x0);
    expect(w.player.body.x).toBeGreaterThanOrEqual(w.camera.x);
    expect(toPx(w.player.body.x) - w.camera.pxX).toBeLessThanOrEqual(1);
    expect(w.player.dead).toBe(false);
    expect(w.player.body.onGround).toBe(true);
  });

  it('a player squashed between the left edge and a wall dies', () => {
    // A wall at column 6: standing still behind it, the edge closes in.
    const w = world(autoMap({ scroll: '1', wall: 6 }));
    for (let i = 0; i < 200 && !w.player.dead; i++) w.update([]);
    expect(w.player.dead).toBe(true);
    // The wall's left side was within a body width of the edge when he died.
    expect(6 * 16 - w.camera.pxX).toBeLessThan(w.player.body.w / 256 + 2);
  });

  it('dies squashed even with the invulnerability assist (no way out, as with a pit)', () => {
    const w = new World(
      parseTextMap(autoMap({ scroll: '1', wall: 6 })),
      { ...ctx(), assist: { ...DEFAULT_ASSIST, invulnerable: true } },
      newGameState(MARIO),
    );
    for (let i = 0; i < 200 && !w.player.dead; i++) w.update([]);
    expect(w.player.dead).toBe(true);
  });

  it('a player jumping over the wall in time lives', () => {
    const w = world(autoMap({ scroll: '0.5', wall: 12 }));
    // Walk right up to the wall, then jump it.
    for (let i = 0; i < 400 && !w.player.dead; i++) {
      const nearWall = toPx(w.player.body.x) > 12 * 16 - 40 && toPx(w.player.body.x) < 12 * 16;
      w.update(held('right', ...(nearWall ? (['jump', 'run'] as Action[]) : [])));
    }
    expect(w.player.dead).toBe(false);
    expect(toPx(w.player.body.x)).toBeGreaterThan(12 * 16);
  });

  it('the player cannot run past the right edge of the screen', () => {
    const w = world(autoMap({ scroll: '0.5' }));
    for (let i = 0; i < 300; i++) w.update(held('right', 'run'));
    const right = toPx(w.player.body.x + w.player.body.w);
    expect(right).toBeLessThanOrEqual(w.camera.pxX + SCREEN_W);
    expect(right).toBeGreaterThanOrEqual(w.camera.pxX + SCREEN_W - 2);
    expect(w.camera.pxX).toBe(150);
  });

  it('stops at the end of the map; the player then walks freely up to the end', () => {
    const w = world(autoMap({ scroll: '4' }));
    for (let i = 0; i < 400; i++) w.update([]);
    expect(w.camera.pxX).toBe(48 * 16 - SCREEN_W);
    expect(w.camera.autoDone).toBe(true);
    for (let i = 0; i < 300; i++) w.update(held('right'));
    expect(toPx(w.player.body.x + w.player.body.w)).toBe(48 * 16);
  });

  it('holds while the world stands still: a solo death freezes the scroll', () => {
    const w = world(autoMap({ scroll: '1' }));
    for (let i = 0; i < 10; i++) w.update([]);
    const x = w.camera.x;
    w.kill(w.player);
    for (let i = 0; i < 100; i++) w.update([]);
    expect(w.camera.x).toBe(x);
  });

  it('enemies still spawn as the screen reaches them', () => {
    const l = parseTextMap(autoMap({ scroll: '2' }));
    l.entities.push({ type: 'goomba', x: 30, y: 12 });
    const w = new World(l, ctx(), newGameState(MARIO));
    const goombas = () => w.entities.filter((e) => e.kind === 'goomba' && e.alive);
    expect(goombas()).toHaveLength(0);
    for (let i = 0; i < 20; i++) w.update([]);
    expect(goombas()).toHaveLength(0);
    for (let i = 0; i < 120 && goombas().length === 0; i++) w.update([]);
    expect(goombas()).toHaveLength(1);
    // Spawned just past the right edge, as in a scrolling level.
    expect(toPx(goombas()[0]!.body.x)).toBeGreaterThan(w.camera.pxX + SCREEN_W - 16);
  });

  it('a normal level never scrolls on its own', () => {
    const w = new World(getLevel('1-1'), ctx(), newGameState(MARIO));
    for (let i = 0; i < 120; i++) w.update([]);
    expect(w.camera.x).toBe(0);
    expect(w.camera.auto).toBe(false);
  });
});

/**
 * A 48-wide auto map drawn by `at(x, y)` (a tile char; null: air, or the floor on rows 13-14),
 * with optional `[entities]` and `[zones]` lines.
 */
function drawnMap(
  at: (x: number, y: number) => string | null,
  opts: { scroll?: string; start?: string; entities?: string[]; zones?: string[] } = {},
): string {
  const lines = [
    'id: 9-6',
    'name: EDGE',
    'theme: castle',
    'time: 300',
    `start: ${opts.start ?? '1,12'}`,
    'camera: auto',
    `scroll: ${opts.scroll ?? '0.5'}`,
    '',
    '[tiles]',
  ];
  for (let y = 0; y < 15; y++) {
    let row = '';
    for (let x = 0; x < 48; x++) row += at(x, y) ?? (y >= 13 ? '#' : '.');
    lines.push(row);
  }
  if (opts.entities) lines.push('', '[entities]', ...opts.entities);
  if (opts.zones) lines.push('', '[zones]', ...opts.zones);
  return lines.join('\n');
}

/** A 2x2 pipe with its top-left tile at (px0, py0), drawn with the four chars of `tl tr bl br`. */
const pipeAt =
  (px0: number, py0: number, chars: string) =>
  (x: number, y: number): string | null => {
    const dx = x - px0;
    const dy = y - py0;
    if (dx < 0 || dx > 1 || dy < 0 || dy > 1) return null;
    return chars[dy * 2 + dx] ?? null;
  };

describe('auto-scroll squashes only against a wall ahead (edge cases that must live)', () => {
  it('a lift rising under an overhang while the edge pushes: alive', () => {
    // A long overhang over the first 30 columns at row 7; a wide rising lift at the left edge.
    const w = world(
      drawnMap((x, y) => (y === 7 && x < 30 ? '#' : null), {
        scroll: '0.25',
        start: '0,11',
        entities: ['lift-up 0 12 len=8'],
      }),
    );
    let pushed = 0;
    let underCeiling = 0;
    for (let i = 0; i < 260; i++) {
      w.update([]);
      if (w.player.body.x <= w.camera.x + px(1)) pushed++;
      if (toPx(w.player.body.y) < 8 * 16 + 4) underCeiling++;
    }
    expect(pushed).toBeGreaterThan(30);
    expect(underCeiling).toBeGreaterThan(0);
    expect(w.player.dead).toBe(false);
  });

  it('growing under a block at the edge: alive', () => {
    // A row of blocks right over the small hero's head at the left edge.
    const w = world(drawnMap((x, y) => (y === 11 && x < 6 ? '#' : null), { start: '0,12' }));
    for (let i = 0; i < 20; i++) w.update([]);
    w.player.def.behaviour.onPowerUp(w.player, 'mushroom', w);
    for (let i = 0; i < 200; i++) w.update([]);
    expect(w.player.powerState).toBe('big');
    expect(w.player.dead).toBe(false);
  });

  it('climbing a vine at the edge: alive', () => {
    const w = world(drawnMap(() => null, { start: '1,12', entities: ['vine 1 12 len=10'] }));
    let climbed = 0;
    for (let i = 0; i < 200; i++) {
      w.update(held('up'));
      if (w.player.vine) climbed++;
    }
    expect(climbed).toBeGreaterThan(20);
    expect(w.player.dead).toBe(false);
  });

  it('a down pipe entered at the edge: in, no death', () => {
    const w = world(
      drawnMap(pipeAt(1, 11, '[]{}'), { scroll: '1', start: '1,10', zones: ['pipe 1 11 down -> 1-1 2 12'] }),
    );
    for (let i = 0; i < 20; i++) w.update([]);
    let event = false;
    for (let i = 0; i < 200 && !event; i++) {
      w.update(held('down'));
      event = w.events.some((e) => e.type === 'pipe');
    }
    expect(event).toBe(true);
    expect(w.player.dead).toBe(false);
  });

  it('a side pipe entered with the edge right behind: in, no death', () => {
    const w = world(
      drawnMap(pipeAt(6, 11, '()<>'), { scroll: '1', start: '1,12', zones: ['pipe 6 12 right -> 1-1 2 12'] }),
    );
    let event = false;
    for (let i = 0; i < 300 && !event; i++) {
      // The edge catches up first, then the hero walks into the mouth with it right behind.
      w.update(i < 40 ? [] : held('right'));
      event = w.events.some((e) => e.type === 'pipe');
    }
    expect(event).toBe(true);
    expect(w.player.dead).toBe(false);
  });

  it('still squashes against a wall ahead (the probe is the leading edge)', () => {
    const w = world(drawnMap((x, y) => (x === 4 && y >= 9 ? '#' : null), { scroll: '1', start: '1,12' }));
    for (let i = 0; i < 200 && !w.player.dead; i++) w.update([]);
    expect(w.player.dead).toBe(true);
  });
});

describe('auto-scroll holds during a vine arrival (an anchor chain into the bow)', () => {
  it('no scroll while the players climb in; it starts once they are off', () => {
    // The arrival vine rises from the screen bottom through a gap in the floor at column 2.
    const map = drawnMap((x, y) => (x === 2 && y >= 13 ? '.' : null), { scroll: '1', start: '2,12' });
    const w = new World(parseTextMap(map), ctx(), newGameState(MARIO), { mode: 'climb' });
    expect(w.arriving).toBe(true);
    let frames = 0;
    for (; frames < 1000 && w.arriving; frames++) {
      w.update([]);
      if (w.arriving) expect(w.camera.x).toBe(0);
    }
    expect(frames).toBeGreaterThan(10);
    expect(w.arriving).toBe(false);
    for (let i = 0; i < 30; i++) w.update([]);
    expect(w.camera.x).toBeGreaterThan(0);
    expect(w.player.dead).toBe(false);
  });
});
