import { describe, expect, it } from 'vitest';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { Action } from '@engine/input/actions';
import { defaultClassicCheats, type ClassicCheatId } from '@engine/save/settings';
import { DEFAULT_ASSIST, NO_CHEATS, newGameState, type CheatFlags } from '@game/context';
import { heroFor } from '@game/characters/registry';
import { SAMUS } from '@game/characters/samus';
import { SIMON } from '@game/characters/simon';
import { CHEATS } from '@game/cheats';
import type { CharacterDef } from '@game/characters/character';
import { parseTextMap } from '@game/level/textmap';
import type { LevelData } from '@game/level/schema';
import { ScriptedInput } from '@game/sim/headless';
import { levelSeed, World } from '@game/world/world';

// G-040: the original's Classic Samus and Classic Simon cheats (Cheats.as 36, 38: open from the
// start) set Samus.classicMode and Simon.classicMode, which both heroes read.

type Flags = Partial<Record<ClassicCheatId, boolean>>;

function level(tiles: Record<number, string> = {}, start = '2,12'): LevelData {
  const lines: string[] = [];
  for (let y = 0; y < 13; y++) lines.push((tiles[y] ?? '').padEnd(48, '.').slice(0, 48));
  lines.push('#'.repeat(48), '#'.repeat(48));
  return parseTextMap(['id: t', 'time: 300', `start: ${start}`, '', '[tiles]', ...lines].join('\n'));
}

function world(def: CharacterDef, cheats: Flags, lv = level()): World {
  const ctx = {
    assets: new AssetRegistry({ default: {} }),
    audio: NULL_AUDIO,
    assist: { ...DEFAULT_ASSIST },
    reduceFlashing: true,
    rules: 'classic' as const,
    classicCheats: { ...NO_CHEATS, ...cheats } as CheatFlags,
  };
  const d = heroFor(def, 'classic');
  return new World(lv, ctx, newGameState(d, null, 'classic'), { seed: levelSeed(lv) });
}

function run(w: World, n: number, hold: (f: number) => Action[] = () => []): void {
  const input = new ScriptedInput({ steps: [] });
  for (let f = 0; f < n; f++) {
    input.setHeld(hold(f));
    input.next();
    w.update([input]);
  }
}

/** One press of `a` (held a frame, then released), after `before` idle frames. */
const tap = (w: World, a: Action, before = 4) => run(w, before + 2, (f) => (f === before ? [a] : []));

describe('G-040 the cheats exist, open from the start', () => {
  it('Classic Samus and Classic Simon are on the Cheats page, unlocked, off', () => {
    const c = defaultClassicCheats();
    for (const id of ['classicSamus', 'classicSimon'] as const) {
      expect(CHEATS.some((x) => x.id === id)).toBe(true);
      expect(c.unlocked[id]).toBe(true);
      expect(c.on[id]).toBe(false);
    }
  });
});

describe('G-040 Classic Samus', () => {
  function samus(on: boolean): World {
    const w = world(SAMUS, { classicSamus: on });
    run(w, 10);
    w.player.scratch.missileUp = 1;
    w.player.scratch.missiles = 10;
    return w;
  }
  const missiles = (w: World) => w.player.scratch.missiles ?? 0;
  const palette = (w: World) => w.player.def.sprite(w.player, w.frame, false).palette ?? '';

  it('off: Special fires a missile; her suit is her own', () => {
    const w = samus(false);
    tap(w, 'special');
    expect(missiles(w)).toBe(9);
    expect(palette(w)).not.toMatch(/missile/);
  });

  it('on: Special toggles missile mode (the suit changes colour) and Attack fires them', () => {
    const w = samus(true);
    tap(w, 'special');
    expect(missiles(w)).toBe(10);
    expect(palette(w)).toMatch(/-missile$/);
    expect(w.player.def.touchLabels?.(w.player, w)).toMatchObject({ attack: 'MISSILE', special: 'SWITCH' });
    run(w, 30);
    tap(w, 'attack');
    expect(missiles(w)).toBe(9);
    // Select toggles back: Attack is the beam again.
    tap(w, 'select');
    expect(palette(w)).not.toMatch(/missile/);
    run(w, 30);
    tap(w, 'attack');
    expect(missiles(w)).toBe(9);
  });

  it('on: Down on the ground rolls her straight into the ball; off, she crouches', () => {
    const on = samus(true);
    tap(on, 'down');
    expect(on.player.scratch._ball).toBe(1);
    const off = samus(false);
    tap(off, 'down');
    expect(off.player.scratch._ball).toBeUndefined();
    expect(off.player.scratch._crouch).toBe(1);
  });
});

describe('G-040 Classic Simon', () => {
  it('on: the jump keeps its take-off direction; off, he steers in the air', () => {
    const vxAfter = (on: boolean) => {
      const w = world(SIMON, { classicSimon: on });
      run(w, 10);
      // Right and jump together, then hold left from the top of the rise.
      run(w, 24, (f) => (f < 8 ? ['right', 'jump'] : ['left', 'jump']));
      expect(w.player.body.onGround).toBe(false);
      return w.player.body.vx;
    };
    expect(vxAfter(true)).toBeGreaterThan(0);
    expect(vxAfter(false)).toBeLessThan(0);
  });

  it('on: a standing jump goes straight up whatever is held', () => {
    const w = world(SIMON, { classicSimon: true });
    run(w, 10);
    run(w, 16, (f) => (f < 2 ? ['jump'] : ['right', 'jump']));
    expect(w.player.body.onGround).toBe(false);
    expect(w.player.body.vx).toBe(0);
  });

  it('on: walking off a ledge he drops straight down; off, he keeps walking', () => {
    const fall = (on: boolean) => {
      const w = world(SIMON, { classicSimon: on }, level({ 10: '#######' }, '2,9'));
      run(w, 10);
      const vxs: number[] = [];
      for (let f = 0; f < 120; f++) {
        run(w, 1, () => ['right']);
        if (!w.player.body.onGround) vxs.push(w.player.body.vx);
        else if (vxs.length) break;
      }
      return vxs;
    };
    const on = fall(true);
    const off = fall(false);
    expect(on.length).toBeGreaterThan(3);
    expect(on.slice(1).every((v) => v === 0)).toBe(true);
    expect(off.every((v) => v > 0)).toBe(true);
  });
});
