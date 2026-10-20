import { describe, expect, it } from 'vitest';
import { getLevel, levelIds } from '@content/levels';
import { defaultSettings, loadSettings, saveSettings } from '@engine/save/settings';
import { parseTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { Cheep } from '@game/entities/enemies/cheep';
import { MAX_SPINIES, RESPAWN_FRAMES } from '@game/entities/enemies/lakitu';
import { PowerUp } from '@game/entities/objects/powerup';
import { FLYING_CHEEP_CAP, type World } from '@game/world/world';
import type { MapDifficulty } from '@game/level/schema';

// G-006: Classic mode's Map Difficulty (data/MapDifficulty.as): the Lakitu's return delay
// (LakituSpawner.as:28-41) and Spiny cap (Lakitu.as:246-258), the flying Cheep Cheeps' cap
// (FlyingCheepSpawner.as:17-19, 37-50), and its layers (classic-level-layers.test.ts).
// G-023: the Hudson Bee, Hard layers only: 8000 points (pickups/HudsonBee.as; Character.as:1612).

const room = (extra: string[] = [], tiles?: (y: number) => string) =>
  parseTextMap(
    [
      'id: room',
      'time: 300',
      'start: 2,12',
      '',
      '[tiles]',
      ...Array.from({ length: 15 }, (_, y) => (tiles ? tiles(y) : y >= 13 ? '#'.repeat(64) : '.'.repeat(64))),
      '',
      ...extra,
    ].join('\n'),
  );

describe('G-006: the difficulty tables', () => {
  it("are the original's numbers", () => {
    // 48, 40 and 16 TIME units of 397 ms, at 60 frames a second.
    expect(RESPAWN_FRAMES).toEqual({ easy: 1143, normal: 953, hard: 381 });
    expect(MAX_SPINIES).toEqual({ easy: 2, normal: 4, hard: 6 });
    expect(FLYING_CHEEP_CAP).toEqual({ easy: 2, normal: 3, hard: 4 });
  });

  it('the flying Cheep Cheeps out at once follow the difficulty (Current: always 3)', () => {
    const level = room(['[zones]', 'cheeps 0 64']);
    const most = (rules: 'classic' | 'current', mapDifficulty: MapDifficulty) => {
      let max = 0;
      runSim({
        level,
        character: MARIO,
        rules,
        mapDifficulty,
        script: { steps: [] },
        maxFrames: 1500,
        assist: { invulnerable: true },
        until: (w: World) => {
          max = Math.max(max, w.entities.filter((e) => e instanceof Cheep && e.alive && e.flying).length);
          return false;
        },
      });
      return max;
    };
    expect(most('classic', 'easy')).toBe(2);
    expect(most('classic', 'normal')).toBe(3);
    expect(most('classic', 'hard')).toBe(4);
    expect(most('current', 'hard')).toBe(3);
  });

  it('Map difficulty is a setting, Normal by default and for an unknown value', () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    expect(defaultSettings().classicMapDifficulty).toBe('normal');
    const s = defaultSettings();
    s.classicMapDifficulty = 'hard';
    saveSettings(s);
    expect(loadSettings().classicMapDifficulty).toBe('hard');
    saveSettings({ ...s, classicMapDifficulty: 'nightmare' as MapDifficulty });
    expect(loadSettings().classicMapDifficulty).toBe('normal');
  });
});

describe('G-023: the Hudson Bee', () => {
  it('is in the Hard layers only, in bricks and hidden blocks', () => {
    let hard = 0;
    for (const id of levelIds())
      for (const l of getLevel(id).layers ?? [])
        for (const e of l.add ?? [])
          if (e.type === 'block-item' && e.props?.item === 'bee') {
            expect(l.difficulty, id).toBe('hard');
            hard++;
          }
    // 32 in SMB's data, 52 in The Lost Levels'.
    expect(hard).toBeGreaterThanOrEqual(84);
  });

  it('rises out of its block, stays on it, and is worth 8000 points', () => {
    // A hidden block at 6,9 holding the bee (as the Hard layer lays it: `2` and a block-item).
    const level = room(['[entities]', 'block-item 6 9 item=bee'], (y) =>
      y >= 13 ? '#'.repeat(64) : y === 9 ? '......2' + '.'.repeat(57) : '.'.repeat(64),
    );
    for (const rules of ['classic', 'current'] as const) {
      let bee: PowerUp | null = null;
      let score0 = 0;
      const r = runSim({
        level,
        character: MARIO,
        rules,
        script: { steps: [] },
        maxFrames: 120,
        controller: (w, f) => {
          if (f === 0) {
            score0 = w.state.score;
            w.bumpBlock(6, 9, w.player, false);
            bee = w.entities.find((e): e is PowerUp => e instanceof PowerUp) ?? null;
            expect(w.map.get(6, 9)).not.toBe(T.HIDDEN_COIN);
          }
          if (f === 60 && bee) {
            expect(bee.out).toBe(true);
            expect(bee.body.vx).toBe(0);
            w.player.body.x = bee.body.x;
            w.player.body.y = bee.body.y;
          }
          return [];
        },
      });
      expect((bee as PowerUp | null)?.item, rules).toBe('bee');
      expect(r.world.state.score - score0, rules).toBe(8000);
      expect(r.coins, rules).toBe(0);
    }
  });

  it('a lone Clock (Easy and Hard layers) leaves a used block, not a coin block', () => {
    const level = room(['[entities]', 'block-item 6 9 item=clock'], (y) =>
      y >= 13 ? '#'.repeat(64) : y === 9 ? '......?' + '.'.repeat(57) : '.'.repeat(64),
    );
    const r = runSim({
      level,
      character: MARIO,
      rules: 'classic',
      script: { steps: [] },
      maxFrames: 40,
      controller: (w, f) => {
        if (f === 0) {
          w.bumpBlock(6, 9, w.player, false);
          expect(w.entities.some((e) => e instanceof PowerUp && e.item === 'clock')).toBe(true);
        }
        return [];
      },
    });
    expect(r.world.map.get(6, 9)).toBe(T.USED);
  });
});
