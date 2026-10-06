import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim, ScriptedInput } from '@game/sim/headless';
import { LevelScene } from '@game/scenes/level';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { Game } from '@game/scenes/game';
import type { CharacterDef } from '@game/characters/character';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { Bowser } from '@game/entities/enemies/bowser';
import { Toad } from '@game/entities/objects/toad';
import { Princess } from '@game/entities/objects/princess';
import { px, toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { World } from '@game/world/world';

// The castle clear: the bridge falls, the player walks to Toad (or the princess) and stops at
// the exit marker, Toad's thanks appear over the level, then "BUT OUR PRINCESS IS IN ANOTHER
// CASTLE!" in every castle but the last (the original's ScreenManager.displayThankYouText and
// GameTextMessages), and the next level starts; the last castle says "YOUR QUEST IS OVER."
// (GameTextMessages.QUEST_IS_OVER) and goes to the ending 2.5 s later.

const levels = join(import.meta.dirname, '../../src/content/levels');
const load = (path: string, id: string): LevelData =>
  parseTextMap(readFileSync(join(levels, path), 'utf8'), id);
const NEWS = ['', 'BUT OUR PRINCESS IS IN', 'ANOTHER CASTLE!'];
const QUEST_OVER = ['', 'YOUR QUEST IS OVER.'];

/** Put the player on the axe (feet on top of row `floor`) once the bridge's Bowser is there. */
function place(w: World, col: number, floor: number): void {
  const b = w.player.body;
  b.x = px(col * 16 + 2);
  b.y = px(floor * 16) - b.h;
  b.vx = 0;
  b.vy = 0;
  w.camera.snapTo(b.x);
}

/** Play a castle's end through the level scene with a stub game; returns what it saw. */
function clearCastle(level: LevelData, axe: number, character: CharacterDef = MARIO) {
  const showEnding = vi.fn();
  const goToLevel = vi.fn();
  const push = vi.fn();
  const game = {
    ctx: {
      assets: new AssetRegistry({ default: {} }),
      audio: NULL_AUDIO,
      assist: { ...DEFAULT_ASSIST, invulnerable: true },
      reduceFlashing: true,
    },
    state: newGameState(character),
    playtestDone: null,
    deps: { getLevel: () => level },
    scenes: { push },
    showEnding,
    goToLevel,
  } as unknown as Game;
  const scene = new LevelScene(game, level, { x: axe - 6, y: 8, mode: 'stand' });
  const input = new ScriptedInput({ steps: [{ frame: 0, hold: [] as Action[] }] });
  const texts: string[][] = [];
  let placed = false;
  let frames = 0;
  for (; frames < 1500 && !showEnding.mock.calls.length && !goToLevel.mock.calls.length; frames++) {
    if (!placed && scene.world.entities.some((e) => e instanceof Bowser)) {
      placed = true;
      place(scene.world, axe, 9);
    }
    input.next();
    scene.update(input);
    const last = texts[texts.length - 1];
    if (scene.world.castleText.join('|') !== (last ?? []).join('|')) texts.push([...scene.world.castleText]);
  }
  return { world: scene.world, showEnding, goToLevel, push, texts, frames, placed };
}

describe('castle clear: Toad and the news', () => {
  it('SMB1 1-4: the player walks to Toad, gets the news over the level, then World 2 starts', () => {
    const r = clearCastle(load('world1/1-4.map', '1-4'), 141);
    expect(r.placed).toBe(true);
    const toad = r.world.entities.find((e): e is Toad => e instanceof Toad);
    expect(toad?.alive).toBe(true);
    expect(toad && toPx(toad.body.x)).toBe(153 * 16);
    // Stopped on touching the exit marker (column 152), one tile short of Toad, on the floor.
    const b = r.world.player.body;
    expect(toPx(b.x + b.w)).toBe(152 * 16);
    expect(toPx(b.y + b.h)).toBe(13 * 16);
    expect(r.texts).toEqual([['THANK YOU MARIO!'], ['THANK YOU MARIO!', ...NEWS]]);
    expect(r.goToLevel).toHaveBeenCalledWith('2-1', { mode: 'stand' });
    expect(r.showEnding).not.toHaveBeenCalled();
    // No separate message screen any more: the news is part of the level.
    expect(r.push).not.toHaveBeenCalled();
    // Still in the level while the news is up.
    expect(r.frames).toBeGreaterThan(500);
  });

  it("Lost Levels 1-4: the same news, with the hero's name", () => {
    const r = clearCastle(load('lost/world1/ll-1-4.map', 'll-1-4'), 141, LINK);
    expect(r.world.entities.some((e) => e instanceof Toad && e.alive)).toBe(true);
    expect(r.texts).toEqual([['THANK YOU LINK!'], ['THANK YOU LINK!', ...NEWS]]);
    expect(r.goToLevel).toHaveBeenCalledWith('ll-2-1', { mode: 'stand' });
  });

  it('Lost Levels 8-4: the princess waits instead of Toad, and the ending card is her thanks', () => {
    const r = clearCastle(load('lost/world8/ll-8-4-end3.map', 'll-8-4-end3'), 125);
    expect(r.world.entities.some((e) => e instanceof Princess && e.alive)).toBe(true);
    expect(r.world.entities.some((e) => e instanceof Toad)).toBe(false);
    // The castle says nothing: the card (Game.showLostEnding) carries "THANK YOU <hero>!" and
    // "YOUR QUEST IS OVER.", so neither is said twice.
    expect(r.texts).toEqual([]);
    expect(r.world.castleHero).toBe(MARIO);
    expect(r.showEnding).toHaveBeenCalledWith('ll-8-4');
    expect(r.goToLevel).not.toHaveBeenCalled();
  });

  it('SMB1 8-4: the princess, "YOUR QUEST IS OVER." and the ending', () => {
    const r = clearCastle(load('world8/8-4-end.map', '8-4-end'), 45);
    expect(r.world.entities.some((e) => e instanceof Princess && e.alive)).toBe(true);
    expect(r.texts.flat()).not.toContain('ANOTHER CASTLE!');
    expect(r.texts.at(-1)).toEqual(['THANK YOU MARIO!', ...QUEST_OVER]);
    expect(r.showEnding).toHaveBeenCalledWith('8-4');
  });
});

describe('castle clear walk', () => {
  // One screen: floor 0-15, a bridge over lava 16-27 with Bowser, the axe at 28 on a ledge
  // (rows 11-14) 28-30, then a lower floor (rows 13-14) with Toad at 40 and the exit marker at 39.
  const W = 48;
  const castle = (zones: string[], toad = true): LevelData =>
    parseTextMap(
      [
        'id: t',
        'theme: castle',
        'time: 300',
        'start: 25,11',
        '',
        '[tiles]',
        ...Array.from({ length: 11 }, () => '.'.repeat(W)),
        '.'.repeat(28) + '###' + '.'.repeat(W - 31),
        '.'.repeat(16) + '-'.repeat(12) + '###' + '.'.repeat(W - 31),
        '#'.repeat(16) + '~'.repeat(12) + '#'.repeat(W - 28),
        '#'.repeat(16) + '.'.repeat(12) + '#'.repeat(W - 28),
        '',
        '[entities]',
        'bowser 20 11',
        'axe 28 10',
        ...(toad ? ['toad 40 12'] : []),
        '',
        '[zones]',
        ...zones,
      ].join('\n'),
    );

  it('drops off the ledge, stops at the exit marker and exits after the news', () => {
    const r = runSim({
      level: castle(['exit 39 next=2-1']),
      character: MARIO,
      script: { steps: [{ frame: 0, hold: [] }] },
      maxFrames: 1500,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 28, 11);
        return [];
      },
    });
    expect(r.outcome).toBe('cleared');
    expect(r.events.at(-1)).toEqual({ type: 'exit', next: '2-1' });
    expect(r.playerX + toPx(r.world.player.body.w)).toBe(39 * 16);
    expect(r.playerY + toPx(r.world.player.body.h)).toBe(13 * 16);
    expect(r.world.castleText).toEqual(['THANK YOU MARIO!', ...NEWS]);
  });

  it('a player who took the axe over the bridge walks level over the lava instead of falling in', () => {
    const r = runSim({
      level: castle(['exit 39 next=2-1']),
      character: MARIO,
      script: { steps: [{ frame: 0, hold: [] }] },
      maxFrames: 1500,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) {
          // Mid-air over the bridge's last tile, touching the axe.
          const b = w.player.body;
          b.x = px(27 * 16 + 8);
          b.y = px(10 * 16 + 4);
          b.vy = 0;
          w.camera.snapTo(b.x);
        }
        return [];
      },
    });
    expect(r.outcome).toBe('cleared');
    expect(r.world.player.dead).toBe(false);
    expect(r.playerY + toPx(r.world.player.body.h)).toBe(13 * 16);
  });

  it('a castle that ends the game shows the thanks and "YOUR QUEST IS OVER." before the ending', () => {
    const r = runSim({
      level: castle(['exit 39 next=end'], false),
      character: MARIO,
      script: { steps: [{ frame: 0, hold: [] }] },
      maxFrames: 1500,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (f === 0) place(w, 28, 11);
        return [];
      },
    });
    expect(r.events.at(-1)).toEqual({ type: 'exit', next: 'end' });
    expect(r.world.castleText).toEqual(['THANK YOU MARIO!', ...QUEST_OVER]);
  });
});
