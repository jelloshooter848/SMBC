import { beforeEach, describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';
import { toPx } from '@engine/math/units';
import { ScriptedInput } from '../sim/headless';
import { DEFAULT_ASSIST } from '../context';
import { Game } from '../scenes/game';
import { CHARACTERS } from '../characters/registry';
import { MARIO } from '../characters/mario';
import { openBonusGame, type BonusResult } from '.';
import type { ToadHouseScene } from './toad-house';
import { CHEST_X, ENTRY_X, OPEN_FRAMES, TOAD_LINE } from './toad-house';
import { BONUS_GUARD_FRAMES } from './common';
import { STATUS_BAR_Y } from '../hud/smb3-status';

class Recorder implements Renderer {
  texts: { s: string; y: number }[] = [];
  sprites: { f: string; x: number; y: number }[] = [];
  private readonly none = new NullRenderer();
  clear = this.none.clear;
  rect = this.none.rect;
  debugText = this.none.debugText;
  line = this.none.line;
  sprite(_s: Parameters<Renderer['sprite']>[0], f: string, x: number, y: number): void {
    this.sprites.push({ f, x, y });
  }
  text(_f: Parameters<Renderer['text']>[0], s: string, _x: number, y: number): void {
    this.texts.push({ s, y });
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

function house(hero = MARIO, seed = 5) {
  const assets = {
    sheet: () => ({ id: 'stub', image: null, frames: new Map() }),
    has: () => false,
  } as unknown as AssetRegistry;
  const said: string[] = [];
  const game = new Game({
    ctx: { assets, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    getLevel,
    characters: CHARACTERS,
    announcer: { say: (t: string) => said.push(t) } as unknown as Announcer,
  });
  game.newGame(hero, '1-1');
  game.inventoryUnlocked = true;
  const ends: BonusResult[] = [];
  const scene = openBonusGame(game, 'toad-house', (r) => ends.push(r), { seed }) as ToadHouseScene;
  const input = new ScriptedInput({ steps: [] });
  const step = (held: Action[] = []) => {
    input.setHeld(held);
    input.next();
    game.scenes.update([input]);
  };
  const idle = (n: number) => {
    for (let i = 0; i < n; i++) step();
  };
  /** Past the guard and the walk in. */
  const inside = () => {
    for (let i = 0; i < 400 && !scene.entered; i++) step();
  };
  const heroX = () => {
    const b = scene.world.player.body;
    return toPx(b.x + b.w / 2);
  };
  /** Walks (jumping if it stops dead) to chest `i` and presses OPEN there. */
  const openAt = (i: number) => {
    inside();
    const target = (CHEST_X[i] as number) + 8;
    let last = -1;
    let stuck = 0;
    for (let f = 0; f < 900 && scene.nearChest() !== i; f++) {
      const x = heroX();
      stuck = x === last ? stuck + 1 : 0;
      last = x;
      const dir: Action = x < target ? 'right' : 'left';
      step(stuck > 10 && stuck % 20 < 10 ? [dir, 'jump'] : [dir]);
    }
    // Stand still a moment, then OPEN.
    for (let f = 0; f < 60 && !scene.world.player.body.onGround; f++) step();
    step();
    step(['attack']);
    step();
  };
  const render = () => {
    const r = new Recorder();
    game.scenes.render(r);
    return r;
  };
  return { game, scene, said, ends, step, idle, inside, heroX, openAt, render };
}

describe('the Toad House you walk into', () => {
  it('the hero walks in from the left on his own; Toad says his line at the top; three chests on the floor', () => {
    const h = house();
    const x0 = h.heroX();
    h.idle(BONUS_GUARD_FRAMES);
    expect(h.scene.entered).toBe(false);
    h.inside();
    expect(h.heroX()).toBeGreaterThan(x0);
    expect(h.heroX()).toBeGreaterThanOrEqual(ENTRY_X);
    const r = h.render();
    const top = r.texts.filter((t) => t.y < 80).map((t) => t.s);
    expect(top.join(' ')).toBe(TOAD_LINE);
    expect(r.sprites.filter((s) => s.f === 'chest-closed')).toHaveLength(3);
    expect(r.sprites.some((s) => s.f === 'toad')).toBe(true);
    // All of it above SMB3's status bar.
    for (const s of r.sprites) expect(s.y).toBeLessThan(STATUS_BAR_Y);
  });

  it('walking up to a chest and pressing OPEN opens it: the others are gone, its prize goes to the items', () => {
    const h = house();
    h.openAt(2);
    expect(h.scene.opened?.index).toBe(2);
    const r = h.render();
    expect(r.sprites.filter((s) => s.f.startsWith('chest-'))).toEqual([
      expect.objectContaining({ f: 'chest-open' }),
    ]);
    h.idle(OPEN_FRAMES + 5);
    expect(h.game.bonus.inventory).toEqual([h.scene.chests[2]]);
    expect(h.said.some((t) => t.startsWith('Box 3:'))).toBe(true);
    h.idle(60);
    h.idle(40);
    h.step(['jump']);
    h.step();
    expect(h.ends).toEqual([
      {
        kind: 'toad-house',
        prizes: [{ kind: 'item', item: h.scene.chests[2] }],
        gaveUp: false,
        played: true,
      },
    ]);
  });

  it('OPEN away from every chest does nothing; once one is open no other opens', () => {
    const h = house();
    h.inside();
    expect(h.scene.nearChest()).toBeNull();
    expect(h.scene.touchLabels().attack).toBeNull();
    h.step(['attack']);
    h.step();
    expect(h.scene.opened).toBeNull();
    h.openAt(0);
    expect(h.scene.opened?.index).toBe(0);
    expect(h.scene.touchLabels().attack).toBeNull();
    h.scene.open(1);
    expect(h.scene.opened?.index).toBe(0);
  });

  it('by a chest OPEN is offered (touch label and announcer), its number said', () => {
    const h = house();
    h.inside();
    const target = (CHEST_X[1] as number) + 8;
    for (let f = 0; f < 300 && h.scene.nearChest() !== 1; f++)
      h.step([h.heroX() < target ? 'right' : 'left']);
    expect(h.scene.touchLabels().attack).toBe('OPEN');
    expect(h.said.some((t) => t.startsWith('Box 2.'))).toBe(true);
  });

  it.each(CHARACTERS.flatMap((c) => [0, 1, 2].map((i) => [c.id, i, c] as const)))(
    '%s reaches chest %i and opens it',
    (_id, i, hero) => {
      const h = house(hero);
      h.openAt(i);
      expect(h.scene.opened?.index).toBe(i);
      h.idle(OPEN_FRAMES + 5);
      expect(h.game.bonus.inventory).toEqual([h.scene.chests[i]]);
    },
  );
});
