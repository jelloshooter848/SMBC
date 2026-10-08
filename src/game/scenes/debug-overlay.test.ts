import { beforeEach, describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { toPx } from '@engine/math/units';
import { SCREEN_H } from '@engine/viewport';
import { DEFAULT_ASSIST } from '../context';
import { CHARACTERS } from '../characters/registry';
import { MARIO } from '../characters/mario';
import { SMB3_WORLD_SHIFT, STATUS_BAR_Y } from '../hud/smb3-status';
import { Game } from './game';
import { LevelScene } from './level';

/** Records the overlay's lines and debug texts. */
class Recorder implements Renderer {
  lines: { x1: number; y1: number; x2: number; y2: number; c: string }[] = [];
  debug: { s: string; x: number; y: number }[] = [];
  private readonly none = new NullRenderer();
  clear = this.none.clear;
  rect = this.none.rect;
  sprite = this.none.sprite;
  text = this.none.text;
  line(x1: number, y1: number, x2: number, y2: number, c: string): void {
    this.lines.push({ x1, y1, x2, y2, c });
  }
  debugText(s: string, x: number, y: number): void {
    this.debug.push({ s, x, y });
  }
}

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

function overlayIn(id: string): { scene: LevelScene; r: Recorder } {
  const assets = {
    sheet: () => ({ id: 'stub', image: null, frames: new Map() }),
    has: () => false,
  } as unknown as AssetRegistry;
  const game = new Game({
    ctx: { assets, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    getLevel,
    characters: CHARACTERS,
  });
  game.newGame(MARIO, '1-1');
  game.startLevel(getLevel(id), { mode: 'stand' });
  const scene = game.scenes.top as LevelScene;
  expect(scene).toBeInstanceOf(LevelScene);
  scene.debug.enabled = true;
  const r = new Recorder();
  scene.render(r);
  return { scene, r };
}

/** The hitbox's top edge (the first green line) and the grid's horizontal lines. */
const hitboxTop = (r: Recorder) => r.lines.find((l) => l.c === '#0f0')?.y1;
const columnLabels = (r: Recorder) => r.debug.filter((d) => /^\d+$/.test(d.s));

describe('the debug overlay (F1) follows the camera the world is drawn with', () => {
  it('in a level: the hitbox on the player, the column numbers along the bottom', () => {
    const { scene, r } = overlayIn('1-1');
    expect(hitboxTop(r)).toBe(toPx(scene.world.player.body.y));
    for (const c of columnLabels(r)) expect(c.y).toBe(SCREEN_H - 2);
  });

  it.each(['4-2-airship', '4-2-larry'])(
    "aboard Larry's airship (%s): drawn up with the world, the columns above the status bar",
    (id) => {
      const { scene, r } = overlayIn(id);
      expect(hitboxTop(r)).toBe(toPx(scene.world.player.body.y) - SMB3_WORLD_SHIFT);
      const cols = columnLabels(r);
      expect(cols.length).toBeGreaterThan(0);
      for (const c of cols) expect(c.y).toBeLessThanOrEqual(STATUS_BAR_Y);
      // Each column number sits at its column: x + camera = column * 16 (+1).
      const cam = scene.world.camera.pxX;
      for (const c of cols) expect(c.x - 1 + cam).toBe(Number(c.s) * 16);
    },
  );
});
