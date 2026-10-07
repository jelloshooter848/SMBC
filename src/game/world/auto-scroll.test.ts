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
