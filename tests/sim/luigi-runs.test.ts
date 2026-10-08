import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { LevelScene } from '@game/scenes/level';
import { CardScene, CARD_GUARD_FRAMES } from '@game/scenes/message';
import { MARIO } from '@game/characters/mario';
import { beat } from '@game/story/beats';
import { LUIGI_RUNS_PAGE, LUIGI_RUNS_SAID } from '@game/story/script';
import { LuigiRunsScene } from '@game/story/luigi-runs';
import { loadSave } from '@game/save/save-files';
import { closeCards, draw, file, makeGame, useStorage, type H } from './heroes-harness';
import { ALL_STORY } from './story-seen';

// 1-1: brainwashed Luigi runs off, then Mario's line (0.4.23, docs/STORY.md 2.4). Campaign only,
// once per file, while Luigi is not freed.

useStorage();

function into11(over: Parameters<typeof file>[0] = {}): H {
  const h = makeGame();
  file({ cleared: ['1-0'], story: ALL_STORY.filter((id) => id !== beat.luigiRuns), ...over });
  h.game.openFile(1);
  h.idle(4);
  h.game.startLevel(getLevel('1-1'), { mode: 'stand' });
  h.step();
  return h;
}

describe('1-1: Luigi runs', () => {
  it('play holds: Luigi in the captive palette ahead of Mario looks back and runs off; then Mario’s card', () => {
    const h = into11();
    const level = h.game.scenes.find((s) => s instanceof LevelScene) as LevelScene;
    expect(h.top()).toBeInstanceOf(LuigiRunsScene);
    expect(h.said).toContain(LUIGI_RUNS_SAID);
    expect(h.game.seen(beat.luigiRuns)).toBe(true);
    expect(loadSave(1)?.story).toContain(beat.luigiRuns);
    const frame = level.world.frame;
    const first = draw(h.top() as LuigiRunsScene).sprites.find((s) => s.key.endsWith('luigi~brainwashed'));
    expect(first).toBeDefined();
    // About eight columns ahead of Mario.
    const mx = level.world.player.body.x / 256 - level.world.camera.pxX;
    expect(first!.x - mx).toBeGreaterThan(96);
    h.until(() => h.top() instanceof CardScene, 400);
    expect(level.world.frame).toBe(frame); // the level waited
    expect((h.top() as CardScene).lines).toEqual(LUIGI_RUNS_PAGE);
    expect(closeCards(h)).toEqual([LUIGI_RUNS_PAGE]);
    expect(h.top()).toBe(level);
  });

  it('once per file; not once Luigi is freed; not outside the campaign; not in 1-1’s sub-areas', () => {
    const again = into11({ story: [...ALL_STORY] });
    expect(again.top()).toBeInstanceOf(LevelScene);
    const freed = into11({ freed: ['mario', 'luigi'] });
    expect(freed.top()).toBeInstanceOf(LevelScene);
    const h = makeGame();
    h.game.newGame(MARIO, '1-1');
    h.until(() => h.top() instanceof LevelScene, 400);
    h.idle(10);
    expect(h.top()).toBeInstanceOf(LevelScene);
    const bonus = makeGame();
    file({ cleared: ['1-0'], story: ALL_STORY.filter((id) => id !== beat.luigiRuns) });
    bonus.game.openFile(1);
    bonus.idle(4);
    bonus.game.startLevel(getLevel('1-1-bonus'), { mode: 'fall', x: 1, y: 1 });
    bonus.step();
    expect(bonus.top()).toBeInstanceOf(LevelScene);
  });

  it('a press skips the run straight to the card', () => {
    const h = into11();
    h.idle(CARD_GUARD_FRAMES + 1);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(CardScene);
  });
});
