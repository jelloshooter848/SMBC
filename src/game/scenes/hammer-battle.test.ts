import { beforeEach, describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import type { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';
import { toPx } from '@engine/math/units';
import { ScriptedInput } from '../sim/headless';
import { DEFAULT_ASSIST } from '../context';
import { Game } from './game';
import { CardScene } from './message';
import { CHARACTERS } from '../characters/registry';
import { MARIO } from '../characters/mario';
import { HammerBro } from '../entities/enemies/hammer-bro';
import {
  BATTLE_CHEST_OPEN_FRAMES,
  BATTLE_CHEST_X,
  BATTLE_WIN_DELAY,
  HammerBattleScene,
} from './hammer-battle';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

/** A battle over a game playing `hero`, its Hammer Bros beaten at once. */
function beaten(hero = MARIO) {
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
  const battle = new HammerBattleScene(game, 11);
  game.scenes.push(battle);
  const input = new ScriptedInput({ steps: [] });
  const step = (held: Action[] = []) => {
    input.setHeld(held);
    input.next();
    game.scenes.update([input]);
  };
  for (let i = 0; i < 3; i++) step();
  battle.world.player.invuln = 100000;
  for (const b of battle.world.entities)
    if (b instanceof HammerBro) b.hit({ kind: 'fireball', amount: 1, owner: null, dirX: 1 }, battle.world);
  const heroX = () => {
    const b = battle.world.player.body;
    return toPx(b.x + b.w / 2);
  };
  /** Walks (hopping when stopped dead) to the chest and presses OPEN by it. */
  const openChest = () => {
    const target = BATTLE_CHEST_X + 8;
    let last = -1;
    let stuck = 0;
    for (let f = 0; f < 900 && !(Math.abs(heroX() - target) <= 6 && battle.world.player.body.onGround); f++) {
      const x = heroX();
      stuck = x === last ? stuck + 1 : 0;
      last = x;
      const dir: Action = x < target ? 'right' : 'left';
      step(stuck > 10 && stuck % 20 < 10 ? [dir, 'jump'] : [dir]);
    }
    for (let f = 0; f < 60 && !battle.world.player.body.onGround; f++) step();
    step();
    step(['attack']);
    step();
  };
  return { game, battle, said, step, heroX, openChest };
}

describe("the Hammer Bros' treasure chest", () => {
  it('drops into the middle of the arena once they are beaten, and lands on the floor; no card yet', () => {
    const h = beaten();
    for (let i = 0; i < BATTLE_WIN_DELAY + 2; i++) h.step();
    expect(h.battle.chest).not.toBeNull();
    expect(h.battle.chest?.landed).toBe(false);
    expect(h.said.some((t) => t.includes('A treasure chest fell'))).toBe(true);
    for (let i = 0; i < 120 && !h.battle.chest?.landed; i++) h.step();
    expect(h.battle.chest?.landed).toBe(true);
    expect(h.battle.chest?.y).toBe(13 * 16 - 16);
    expect(h.game.scenes.top).toBe(h.battle);
  });

  it('OPEN away from it does nothing; by it OPEN is offered and opens it; its item rises, then the win card', () => {
    const h = beaten();
    for (let i = 0; i < BATTLE_WIN_DELAY + 120; i++) h.step();
    // The hero starts at the left, far from the chest.
    expect(h.battle.touchLabels().attack).toBeNull();
    h.step(['attack']);
    h.step();
    expect(h.battle.openedFor).toBeNull();
    h.openChest();
    expect(h.battle.openedFor).not.toBeNull();
    for (let i = 0; i < BATTLE_CHEST_OPEN_FRAMES + 2; i++) h.step();
    expect(h.game.scenes.top).toBeInstanceOf(CardScene);
    expect((h.game.scenes.top as CardScene).lines).toContain('THE HAMMER BROS ARE BEATEN!');
  });

  it.each(CHARACTERS.map((c) => [c.id, c] as const))('%s walks up to it and opens it', (_id, hero) => {
    const h = beaten(hero);
    for (let i = 0; i < BATTLE_WIN_DELAY + 120; i++) h.step();
    h.openChest();
    expect(h.battle.openedFor).not.toBeNull();
  });
});
