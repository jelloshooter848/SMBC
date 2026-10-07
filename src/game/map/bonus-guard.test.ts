import { beforeEach, describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { WorldMapScene, GUARD_GRACE_FRAMES } from '@game/scenes/world-map';
import { HammerBattleScene } from '@game/scenes/hammer-battle';
import { CHARACTERS } from '@game/characters/registry';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { loadSave, newSave, type SaveFile } from '@game/save/save-files';
import { BONUS_CLOSED_HINT, BONUS_SPENT_HINT, registerBonusGame } from './bonus-spot';
import { GUARD_STEP_FRAMES } from './hammer-bro';

// World 4's bonus spot and its Hammer Bro, played through a real Game (docs/WORLD_MAP.md "The
// bonus spot and its Hammer Bro"): used, the spot is spent with no guard; the Hammer Bro comes out
// only once a level has been entered from the map, never walks into the hero, and is fought only
// when the hero walks into him.

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  registerBonusGame(null);
});

const W4_CLEARED = ['1-0', '1-1', '1-2', '1-3', '1-4', '2-1', '2-2', '2-3', '2-4'];
const W4_MORE = ['3-1', '3-2', '3-3', '3-4', '4-1', '4-2'];

/** A file standing on World 4's map at `node`, the crystal ball found (the bonus spot open). */
function fileAt(node: string, over: Partial<SaveFile> = {}): SaveFile {
  return {
    ...newSave(1, 'mario'),
    cleared: [...W4_CLEARED, ...W4_MORE],
    pages: ['smb-1', 'smb-2', 'smb-3', 'smb-4'],
    secrets: ['larry'],
    position: { page: 'smb-4', node },
    lastNode: { 'smb-4': node },
    inventoryUnlocked: true,
    ...over,
  };
}

function setup(save: SaveFile) {
  const game = new Game({
    ctx: {
      assets: new AssetRegistry({ default: {} }),
      audio: NULL_AUDIO,
      assist: { ...DEFAULT_ASSIST },
      reduceFlashing: true,
    },
    getLevel,
    characters: CHARACTERS,
    announcer: { say: () => {} } as unknown as Announcer,
  });
  game.openFile(1, save);
  const input = new ScriptedInput({ steps: [] });
  const step = (held: Action[] = []) => {
    input.setHeld(held);
    input.next();
    game.scenes.update([input]);
  };
  const map = () => game.scenes.top as WorldMapScene;
  /** Presses a direction and walks until the hero stands still again (or a battle starts). */
  const walk = (dir: Action) => {
    step([dir]);
    for (let i = 0; i < 600 && map() instanceof WorldMapScene && map().mode === 'walk'; i++) step();
  };
  /** Stands still for `frames` frames. */
  const idle = (frames: number) => {
    for (let i = 0; i < frames && map() instanceof WorldMapScene; i++) step();
  };
  // The map takes no input for its first few frames.
  idle(8);
  return { game, step, map, walk, idle };
}

/** Uses the bonus from its node (the placeholder card, counted as used). */
function useBonus(h: ReturnType<typeof setup>): void {
  expect(h.map()).toBeInstanceOf(WorldMapScene);
  h.step(['jump']);
  h.step();
  expect(h.map()).not.toBeInstanceOf(WorldMapScene);
  // The placeholder card: OK to continue.
  for (let i = 0; i < 400 && !(h.map() instanceof WorldMapScene); i++) h.step(i % 2 ? [] : ['jump']);
  expect(h.map()).toBeInstanceOf(WorldMapScene);
  h.idle(8);
}

describe('after the bonus is used', () => {
  it('the spot is spent, with no Hammer Bro yet: JUMP bumps, walking back starts no battle', () => {
    const h = setup(fileAt('bonus-4'));
    expect(h.game.bonusOpen).toBe(true);
    useBonus(h);
    expect(h.game.bonusOpen).toBe(false);
    expect(h.game.bonusGuard).toBe(false);
    expect(h.map().guard).toBeNull();
    expect(h.map().hintLine).toBe(BONUS_SPENT_HINT);
    // JUMP on the spent node: nothing opens.
    h.step(['jump']);
    h.step();
    expect(h.map()).toBeInstanceOf(WorldMapScene);
    expect(h.map().node).toBe('bonus-4');
    // Back along the road to 4-2, freely.
    h.walk('right');
    expect(h.map()).toBeInstanceOf(WorldMapScene);
    expect(h.map().node).toBe('4-2');
    expect(h.map().guard).toBeNull();
  });

  it('keeps the spent, unguarded state across a reload', () => {
    const h = setup(fileAt('bonus-4'));
    useBonus(h);
    const saved = loadSave(1) as SaveFile;
    expect(saved.bonusOpen).toBe(false);
    expect(saved.bonusGuard).toBe(false);
    const again = setup(saved);
    expect(again.game.bonusGuard).toBe(false);
    expect(again.map().guard).toBeNull();
    expect(again.map().hintLine).toBe(BONUS_SPENT_HINT);
  });

  it('an older file with the bonus used (no bonusGuard) waits for a level too', () => {
    const { bonusGuard: _g, ...old } = fileAt('bonus-4', { bonusOpen: false });
    const h = setup(old as SaveFile);
    expect(h.map().guard).toBeNull();
  });
});

describe('after entering a level from the map', () => {
  /** Used, back to 4-2, into 4-2 and straight back to the map (quit, death or clear alike). */
  function playALevel() {
    const h = setup(fileAt('bonus-4'));
    useBonus(h);
    h.walk('right');
    expect(h.map().node).toBe('4-2');
    h.game.enterLevelFromMap('4-2');
    // The hero pick: keep Mario.
    const pick = h.game.scenes.top;
    expect(pick).toBeInstanceOf(CharacterSelectScene);
    for (let i = 0; i < 200 && h.game.scenes.top === pick; i++) h.step(i % 2 ? [] : ['jump']);
    expect(h.game.scenes.top).not.toBe(pick);
    expect(h.game.scenes.top).not.toBeInstanceOf(WorldMapScene);
    return h;
  }

  it('the Hammer Bro is out on the road whatever the result', () => {
    // Back to the map without a clear (quit, a death) or with one.
    for (const back of ['map', 'clear'] as const) {
      const h = playALevel();
      if (back === 'clear') h.game.levelCleared('4-2');
      else h.game.returnToMap();
      expect(h.map()).toBeInstanceOf(WorldMapScene);
      expect(h.game.bonusGuard).toBe(true);
      expect(h.map().guard).not.toBeNull();
    }
  });

  it('keeps the Hammer Bro out across a reload, and the hint says to beat him', () => {
    const h = playALevel();
    h.game.returnToMap();
    const saved = loadSave(1) as SaveFile;
    expect(saved.bonusGuard).toBe(true);
    const again = setup(saved);
    expect(again.map().guard).not.toBeNull();
    // On the spent node (a dev jump there, say), the hint says to beat him.
    const g = setup({ ...saved, position: { page: 'smb-4', node: 'bonus-4' } });
    expect(g.map().hintLine).toBe(BONUS_CLOSED_HINT);
  });
});

describe('the Hammer Bro never forces a fight', () => {
  it('stays off the road while the hero stands on the spent node, so the way back is free', () => {
    const h = setup(fileAt('bonus-4', { bonusOpen: false, bonusGuard: true }));
    expect(h.map().guard).toBeNull();
    h.idle(GUARD_GRACE_FRAMES + GUARD_STEP_FRAMES * 4);
    h.walk('right');
    expect(h.map()).toBeInstanceOf(WorldMapScene);
    expect(h.map().node).toBe('4-2');
    // Off his road: now he comes out.
    expect(h.map().guard).not.toBeNull();
  });

  it('comes out after a level in another world, once the hero leaves the spent node', () => {
    const h = setup(fileAt('bonus-4'));
    useBonus(h);
    // Through the Worlds menu to World 1, a level there, and back to World 4 (onto bonus-4).
    h.game.travelToPage('smb-1');
    h.idle(8);
    expect(h.map().page.id).toBe('smb-1');
    h.game.enterLevelFromMap('1-1');
    const pick = h.game.scenes.top;
    for (let i = 0; i < 200 && h.game.scenes.top === pick; i++) h.step(i % 2 ? [] : ['jump']);
    h.game.returnToMap();
    expect(h.game.bonusGuard).toBe(true);
    h.game.travelToPage('smb-4');
    h.idle(8);
    expect(h.map().node).toBe('bonus-4');
    expect(h.map().guard).toBeNull();
    h.walk('right');
    expect(h.map()).toBeInstanceOf(WorldMapScene);
    expect(h.map().node).toBe('4-2');
    expect(h.map().guard).not.toBeNull();
  });

  it('walking down from 4-2 at once still meets him on the road: no slipping past', () => {
    const h = setup(fileAt('4-2', { bonusOpen: false, bonusGuard: true }));
    expect(h.map().guard).not.toBeNull();
    h.walk('down');
    expect(h.game.scenes.top).toBeInstanceOf(HammerBattleScene);
  });

  it('never walks onto the hero, however long the hero stands next to the road', () => {
    const h = setup(fileAt('4-2', { bonusOpen: false, bonusGuard: true }));
    const m = h.map() as WorldMapScene;
    const g = m.guard!;
    expect(g).not.toBeNull();
    for (let i = 0; i < GUARD_GRACE_FRAMES + GUARD_STEP_FRAMES * 80; i++) {
      h.step();
      expect(h.game.scenes.top).toBe(m);
      expect(Math.abs(g.x - m.hx) >= 16 || Math.abs(g.y - m.hy) >= 16).toBe(true);
    }
  });

  it('starts the battle only when the hero walks into him; winning reopens the bonus', () => {
    const h = setup(fileAt('4-2', { bonusOpen: false, bonusGuard: true }));
    h.idle(GUARD_GRACE_FRAMES + 5);
    expect(h.map()).toBeInstanceOf(WorldMapScene);
    // Down the road to the spot: he is on it, so the hero walks into him.
    h.walk('down');
    expect(h.game.scenes.top).toBeInstanceOf(HammerBattleScene);
    h.game.hammerBattleWon();
    expect(h.game.bonusOpen).toBe(true);
    expect(h.game.bonusGuard).toBe(false);
    expect(h.map().guard).toBeNull();
    expect(loadSave(1)).toMatchObject({ bonusOpen: true, bonusGuard: false });
  });

  it('losing leaves him guarding', () => {
    const h = setup(fileAt('4-2', { bonusOpen: false, bonusGuard: true, lives: 3 }));
    h.idle(GUARD_GRACE_FRAMES + 5);
    h.walk('down');
    expect(h.game.scenes.top).toBeInstanceOf(HammerBattleScene);
    h.game.hammerBattleLost();
    expect(h.game.bonusOpen).toBe(false);
    expect(h.game.bonusGuard).toBe(true);
    expect(h.map().guard).not.toBeNull();
  });
});
