import { describe, expect, it } from 'vitest';
import { getLevel, levelIds } from '@content/levels';
import type { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NullRenderer, OffsetRenderer, type Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { SCREEN_H } from '@engine/viewport';
import { DEFAULT_ASSIST, newGameState } from '../context';
import { MARIO } from '../characters/mario';
import { SAMUS } from '../characters/samus';
import { Entity, type View } from '../entities/entity';
import { parseTextMap, serializeTextMap } from '../level/textmap';
import { Camera } from './camera';
import { World } from './world';

/*
 * The opt-in vertical camera (`camera: free` in a map's header, with `height: N` rows): it
 * follows the player up and down shafts and both ways sideways. Every other level keeps the
 * horizontal-only camera exactly as before.
 */

/** Sheets with no frames (drawing does nothing), so a whole world can render headless. */
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

/** A `rows`-high, 32-wide map with a floor at the bottom and a ledge row near the top. */
function tallMap(rows: number, camera = 'free'): string {
  const lines = [
    'id: 9-8',
    'name: SHAFT',
    'theme: underground',
    'time: 300',
    `start: 2,${rows - 3}`,
    `camera: ${camera}`,
    `height: ${rows}`,
    '',
    '[tiles]',
  ];
  for (let y = 0; y < rows; y++)
    lines.push(y >= rows - 2 ? '################ ################' : '................ ................');
  return lines.join('\n');
}

describe('Camera: the horizontal camera (every level but `camera: free`)', () => {
  it('never moves vertically, whatever the player does', () => {
    const cam = new Camera(64, null);
    cam.follow(px(400), px(-200));
    expect(cam.y).toBe(0);
    cam.follow(px(500), px(900));
    expect(cam.y).toBe(0);
    cam.snapTo(px(100), px(900));
    expect(cam.y).toBe(0);
    expect(cam.pxY).toBe(0);
  });

  it('scrolls right only (unless left scroll is allowed), as before', () => {
    const cam = new Camera(64, null);
    cam.follow(px(300));
    expect(cam.pxX).toBe(220);
    cam.follow(px(200));
    expect(cam.pxX).toBe(220);
    cam.allowLeftScroll = true;
    cam.follow(px(200));
    expect(cam.pxX).toBe(120);
  });
});

describe('Camera: `free` (vertical follow)', () => {
  it('follows up and down inside a band, clamped to the map', () => {
    const cam = new Camera(32, null, false, { free: true, heightTiles: 45 });
    expect(cam.maxY).toBe(px(45 * 16 - SCREEN_H));
    cam.snapTo(px(40), px(44 * 16 - 24));
    // At the bottom of the map: clamped there.
    expect(cam.y).toBe(cam.maxY);
    // Climbing: the camera rises once the player is above the band's top.
    const y0 = cam.y;
    cam.follow(px(40), y0 + cam.pushTop);
    expect(cam.y).toBe(y0);
    cam.follow(px(40), y0 + cam.pushTop - px(10));
    expect(cam.y).toBe(y0 - px(10));
    // Falling back: it follows down once the player is below the band's bottom.
    const y1 = cam.y;
    cam.follow(px(40), y1 + cam.pushBottom + px(6));
    expect(cam.y).toBe(y1 + px(6));
    // Never above the map's top.
    cam.follow(px(40), px(-100));
    expect(cam.y).toBe(0);
  });

  it('follows both ways sideways', () => {
    const cam = new Camera(64, null, false, { free: true, heightTiles: 30 });
    cam.follow(px(400), px(100));
    expect(cam.pxX).toBe(320);
    cam.follow(px(200), px(100));
    expect(cam.pxX).toBe(120);
  });

  it('a map only one screen high cannot scroll vertically', () => {
    const cam = new Camera(32, null, false, { free: true, heightTiles: 15 });
    cam.follow(px(10), px(400));
    expect(cam.y).toBe(0);
  });

  it('a locked camera stays put', () => {
    const cam = new Camera(32, null, true, { free: true, heightTiles: 45 });
    cam.follow(px(300), px(10));
    expect(cam.x).toBe(0);
    expect(cam.y).toBe(0);
  });
});

describe('Text maps: `height` and `camera: free`', () => {
  it('parse a map taller than a screen', () => {
    const lvl = parseTextMap(tallMap(45));
    expect(lvl.height).toBe(45);
    expect(lvl.camera).toBe('free');
    expect(lvl.tiles.length).toBe(32 * 45);
  });

  it('reject a row count that does not match the height (and a height under a screen)', () => {
    expect(() => parseTextMap(tallMap(45).replace('height: 45', 'height: 44'))).toThrow(
      /expected 44 tile rows, got 45/,
    );
    expect(() => parseTextMap(tallMap(45).replace('height: 45', 'height: 9'))).toThrow(/height/);
  });

  it('reject a map taller than a screen without `camera: free` (only it scrolls vertically)', () => {
    for (const cam of ['scroll', 'locked'])
      expect(() => parseTextMap(tallMap(30, cam))).toThrow(/height 30 needs "camera: free"/);
    expect(parseTextMap(tallMap(15, 'scroll')).height).toBe(15);
  });

  it('round-trip; a normal map serializes with no height line', () => {
    const tall = parseTextMap(tallMap(30));
    const again = parseTextMap(serializeTextMap(tall));
    expect(again.height).toBe(30);
    expect(again.camera).toBe('free');
    expect([...again.tiles]).toEqual([...tall.tiles]);
    const normal = getLevel('1-1');
    expect(serializeTextMap(normal)).not.toMatch(/^height:/m);
  });

  it('every level in the library is one screen high with a horizontal camera, but the 7-3 waterfall climb', () => {
    for (const id of levelIds()) {
      const l = getLevel(id);
      // Bill's waterfall climb (0.4.9) is the one tall area: a free camera, two screens high.
      if (id === '7-3-falls') {
        expect([l.height, l.camera]).toEqual([32, 'free']);
        continue;
      }
      expect(l.height, id).toBe(15);
      expect(l.camera, id).not.toBe('free');
    }
  });
});

/** Records the renderer each render() call was handed and the y it drew at. */
class Spy extends Entity {
  readonly kind = 'spy';
  seen: { r: Renderer; y: number }[] = [];
  constructor(x: number, y: number) {
    super(x, y, 16, 16);
    this.despawnMargin = null;
  }
  update(): void {}
  render(r: Renderer, view: View): void {
    this.seen.push({ r, y: this.screenY() });
    void view;
  }
}

describe('World with a vertical camera', () => {
  it('draws through an offset renderer (y minus the camera) only in a free level', () => {
    const base = new NullRenderer();
    const normal = new World(getLevel('1-1'), ctx(), newGameState(MARIO));
    const s1 = new Spy(px(40), px(100));
    normal.spawn(s1);
    normal.render(base);
    expect(s1.seen[0]?.r).toBe(base);

    const tall = new World(parseTextMap(tallMap(45)), ctx(), newGameState(SAMUS));
    const s2 = new Spy(px(40), px(100));
    tall.spawn(s2);
    tall.render(base);
    const r = s2.seen[0]?.r;
    expect(r).toBeInstanceOf(OffsetRenderer);
    expect((r as OffsetRenderer).dy).toBe(-tall.camera.pxY);
    expect(tall.camera.pxY).toBe(45 * 16 - SCREEN_H);
    // One offset renderer, reused (and moved) frame after frame.
    tall.player.body.y = px(100);
    tall.update([]);
    tall.render(base);
    expect(s2.seen[1]?.r).toBe(r);
    expect((r as OffsetRenderer).dy).toBe(-tall.camera.pxY);
    expect(tall.camera.pxY).toBeLessThan(45 * 16 - SCREEN_H);
  });

  it('the offset renderer moves every draw by its offset', () => {
    const calls: number[][] = [];
    const inner: Renderer = {
      ...new NullRenderer(),
      clear() {},
      rect: (x, y) => void calls.push([x, y]),
      sprite: (_s, _f, x, y) => void calls.push([x, y]),
      text: (_f, _s, x, y) => void calls.push([x, y]),
      debugText: (_s, x, y) => void calls.push([x, y]),
      line: (x1, y1, x2, y2) => void calls.push([x1, y1, x2, y2]),
    };
    const o = new OffsetRenderer(inner, 3, -100);
    const sheet = { id: 's', image: null, frames: new Map() } as never;
    o.rect(1, 200, 2, 2, '#fff');
    o.sprite(sheet, 'f', 5, 150);
    o.text(sheet, 'A', 7, 120);
    o.debugText('x', 0, 110);
    o.line(0, 100, 10, 130, '#fff');
    expect(calls).toEqual([
      [4, 100],
      [8, 50],
      [10, 20],
      [3, 10],
      [3, 0, 13, 30],
    ]);
  });

  it('the camera follows the player up the map, and a pit is the bottom of the tall map', () => {
    const w = new World(parseTextMap(tallMap(45)), ctx(), newGameState(SAMUS));
    expect(w.camera.pxY).toBe(45 * 16 - SCREEN_H);
    // Lift the player high up: the camera follows.
    w.player.body.y = px(100);
    w.update([]);
    expect(w.camera.pxY).toBeLessThan(100);
    // Below the first screen's bottom is still inside the map: no death.
    w.player.body.y = px(SCREEN_H + 40);
    w.player.body.vy = 0;
    w.update([]);
    expect(w.player.dead).toBe(false);
    // Below the map's bottom: a pit.
    w.player.body.y = px(45 * 16 + 20);
    w.update([]);
    expect(w.player.dead).toBe(true);
  });

  it('entities fall out of a tall map at its bottom, not at the first screen', () => {
    const w = new World(parseTextMap(tallMap(45)), ctx(), newGameState(SAMUS));
    const s = new Spy(px(40), px(SCREEN_H + 100));
    w.spawn(s);
    w.update([]);
    expect(s.isBelowLevel()).toBe(false);
    s.body.y = px(45 * 16 + 40);
    expect(s.isBelowLevel()).toBe(true);
    // A one-screen level keeps the old line.
    const n = new Spy(px(40), px(SCREEN_H + 40));
    expect(n.isBelowLevel()).toBe(true);
  });

  it('a normal level never moves the camera vertically while played', () => {
    const w = new World(getLevel('1-1'), ctx(), newGameState(MARIO));
    for (let i = 0; i < 120; i++) w.update([]);
    expect(w.camera.y).toBe(0);
    expect(toPx(w.camera.y)).toBe(0);
  });
});
