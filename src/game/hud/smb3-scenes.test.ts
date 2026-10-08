import { beforeEach, describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NO_INPUT } from '@engine/input/input-manager';
import { DEFAULT_ASSIST } from '../context';
import { Game } from '../scenes/game';
import { CHARACTERS } from '../characters/registry';
import { MARIO } from '../characters/mario';
import { HammerBattleScene } from '../scenes/hammer-battle';
import { LevelScene } from '../scenes/level';
import { createBonusScene, BONUS_KINDS } from '../bonus';
import { STATUS_BAR_H, STATUS_BAR_Y, SMB3_WORLD_SHIFT } from './smb3-status';

/** Records texts and sprites with where they went. */
class Recorder implements Renderer {
  texts: { s: string; x: number; y: number }[] = [];
  sprites: { f: string; x: number; y: number }[] = [];
  /** The draw order: 'sprite', 'text', and 'bar' for the status bar's black band. */
  order: string[] = [];
  private readonly none = new NullRenderer();
  clear = this.none.clear;
  debugText = this.none.debugText;
  line = this.none.line;
  rect(x: number, y: number, w: number, h: number): void {
    if (x === 0 && y === STATUS_BAR_Y && w === 256 && h === STATUS_BAR_H) this.order.push('bar');
  }
  sprite(_s: Parameters<Renderer['sprite']>[0], f: string, x: number, y: number): void {
    this.sprites.push({ f, x, y });
    this.order.push('sprite');
  }
  text(_f: Parameters<Renderer['text']>[0], s: string, x: number, y: number): void {
    this.texts.push({ s, x, y });
    this.order.push('text');
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

function makeGame(): Game {
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
  return game;
}

function drawTop(game: Game): Recorder {
  const r = new Recorder();
  game.scenes.render(r);
  return r;
}

/** SMB1's HUD across the top: MARIO, WORLD and TIME on its first row. */
const smb1Hud = (r: Recorder) => r.texts.some((t) => t.y < 32 && (t.s === 'TIME' || t.s === 'WORLD'));
const smb3Bar = (r: Recorder) => r.texts.some((t) => t.y >= STATUS_BAR_Y && t.s.startsWith('WORLD '));

describe('the SMB3 pieces use the SMB3 status bar', () => {
  it('the Hammer Bro battle: the bar at the bottom, no SMB1 HUD, the arena drawn up out of its way', () => {
    const game = makeGame();
    game.scenes.push(new HammerBattleScene(game, 7));
    game.scenes.update([NO_INPUT]);
    const r = drawTop(game);
    expect(smb3Bar(r)).toBe(true);
    expect(smb1Hud(r)).toBe(false);
    // The floor's top row (row 13) is drawn 2 rows higher, so its bottom row (14) clears the bar.
    expect(r.sprites.some((s) => s.y === 13 * 16 - SMB3_WORLD_SHIFT)).toBe(true);
    expect(r.sprites.every((s) => s.y + 16 <= STATUS_BAR_Y || s.y >= 240)).toBe(true);
  });

  it.each(['4-2-airship', '4-2-larry'])("Larry's airship (%s): the bar, no SMB1 HUD", (id) => {
    const game = makeGame();
    game.startLevel(getLevel(id), { mode: 'stand' });
    expect(game.scenes.top).toBeInstanceOf(LevelScene);
    game.scenes.update([NO_INPUT]);
    const r = drawTop(game);
    expect(smb3Bar(r)).toBe(true);
    expect(smb1Hud(r)).toBe(false);
  });

  it("Larry's cabin: the hero's drop from the ceiling is drawn under the HUD, never over a label", () => {
    const game = makeGame();
    game.startLevel(getLevel('4-2-larry'), { mode: 'fall' });
    const scene = game.scenes.top as LevelScene;
    const p = scene.world.player;
    expect(p.body.y).toBeLessThan(0); // above the room, in the ceiling pipe
    for (let f = 0; f < 90; f++) {
      game.scenes.update([NO_INPUT]);
      const r = drawTop(game);
      const bar = r.order.indexOf('bar');
      expect(bar).toBeGreaterThanOrEqual(0);
      // Every sprite (the hero among them) goes down before the bar: the HUD is drawn on top.
      expect(r.order.lastIndexOf('sprite')).toBeLessThan(bar);
      // No HUD label up top for the hero to cross (SMB1's MARIO / WORLD / TIME row).
      expect(smb1Hud(r)).toBe(false);
      expect(r.texts.filter((t) => t.y < STATUS_BAR_Y)).toEqual([]);
    }
    expect(p.body.onGround).toBe(true);
  });

  it('any other level keeps the SMB1 HUD', () => {
    const game = makeGame();
    game.startLevel(getLevel('1-1'), { mode: 'stand' });
    const r = drawTop(game);
    expect(smb1Hud(r)).toBe(true);
    expect(smb3Bar(r)).toBe(false);
  });

  it.each(BONUS_KINDS)('the bonus game %s: the bar, and its own words all above it', (kind) => {
    const game = makeGame();
    game.scenes.push(createBonusScene(game, kind, 3, () => {}));
    for (let i = 0; i < 30; i++) game.scenes.update([NO_INPUT]);
    const r = drawTop(game);
    expect(smb3Bar(r)).toBe(true);
    for (const t of r.texts) if (t.y < STATUS_BAR_Y) expect(t.y + 8).toBeLessThanOrEqual(STATUS_BAR_Y);
    for (const s of r.sprites) expect(s.y < STATUS_BAR_Y).toBe(true);
  });
});
