import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { Action } from '@engine/input/actions';
import type { ClassicCheatId } from '@engine/save/settings';
import { DEFAULT_ASSIST, NO_CHEATS, newGameState, type CheatFlags, type Rules } from '@game/context';
import { MARIO } from '@game/characters/mario';
import type { CharacterDef } from '@game/characters/character';
import type { LevelData } from '@game/level/schema';
import { ScriptedInput } from '@game/sim/headless';
import { Firework } from '@game/entities/effects/firework';
import { drawHud } from '@game/hud/hud';
import { levelSeed, World, type WorldStart } from '@game/world/world';
import { IntroScene } from '@game/scenes/intro';
import type { Game } from '@game/scenes/game';

// Classic patch 3 (owner-approved review findings of #164-#167): one describe per item.

type Flags = Partial<Record<ClassicCheatId, boolean>>;

function world(
  level: LevelData,
  cheats: Flags | null,
  def: CharacterDef = MARIO,
  rules: Rules = 'classic',
  start: WorldStart = {},
): World {
  const ctx = {
    assets: new AssetRegistry({ default: {} }),
    audio: NULL_AUDIO,
    assist: { ...DEFAULT_ASSIST },
    reduceFlashing: true,
    rules,
    ...(cheats ? { classicCheats: { ...NO_CHEATS, ...cheats } as CheatFlags } : {}),
  };
  return new World(level, ctx, newGameState(def, null, rules), { seed: levelSeed(level), ...start });
}

function run(
  w: World,
  n: number,
  hold: (f: number) => Action[] = () => [],
  until?: (w: World) => boolean,
): number {
  const input = new ScriptedInput({ steps: [] });
  for (let f = 0; f < n; f++) {
    input.setHeld(hold(f));
    input.next();
    w.update([input]);
    if (until?.(w)) return f;
  }
  return n;
}

const phase = (w: World): string | undefined =>
  (w as unknown as { clear: { phase: string } | null }).clear?.phase;

/** The texts a HUD draws. */
function hudTexts(time: number | null, noTime: boolean): string[] {
  const texts: string[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    text(_f: SpriteSheet, str: string): void {
      texts.push(str);
    },
  });
  const assets = { sheet: () => ({ frames: new Map() }) } as unknown as AssetRegistry;
  drawHud(r, assets, newGameState(MARIO), time, 0, [], { noTime });
  return texts;
}

/** Plays 1-1 from just before the flag (TIME 301 at the touch: a fireworks digit) to the end of the clear. */
function flagRun(cheats: Flags | null) {
  const w = world(getLevel('1-1'), cheats, MARIO, 'classic', { x: 194, y: 12, mode: 'stand', time: 303 });
  let atFlag = -1;
  let scoreAtWalkEnd = -1;
  const fireworks = new Set<Firework>();
  run(
    w,
    3000,
    (f) => (f % 30 < 15 ? ['right', 'jump'] : ['right']),
    (w) => {
      if (phase(w) === 'countdown' && scoreAtWalkEnd < 0) scoreAtWalkEnd = w.state.score;
      if (phase(w) === 'flag' && atFlag < 0) atFlag = w.time ?? -1;
      for (const e of w.entities) if (e instanceof Firework) fireworks.add(e);
      return phase(w) === 'done';
    },
  );
  return {
    atFlag,
    bonus: w.state.score - scoreAtWalkEnd,
    fireworks: fireworks.size,
    done: phase(w) === 'done',
  };
}

describe('1. Infinite Time: no TIME on the HUD or the card, no tally', () => {
  it('drawHud with noTime leaves out the label and the digits; without it both show', () => {
    expect(hudTexts(400, false)).toEqual(expect.arrayContaining(['TIME', '400']));
    const t = hudTexts(400, true);
    expect(t).not.toContain('TIME');
    expect(t).not.toContain('400');
  });

  it('a clear with the cheat on skips the time tally and the fireworks; off, both play', () => {
    const off = flagRun({});
    expect(off.done).toBe(true);
    expect(off.atFlag).toBe(0);
    expect(off.bonus).toBeGreaterThan(0);
    expect(off.fireworks).toBeGreaterThan(0);
    const on = flagRun({ infiniteTime: true });
    expect(on.done).toBe(true);
    expect(on.atFlag).toBeGreaterThan(0); // the clock is never converted
    expect(on.bonus).toBe(0);
    expect(on.fireworks).toBe(0);
  });

  it('the card before a level shows no TIME with the cheat on; the campaign assist keeps the label', () => {
    const card = (classicCheats: CheatFlags | undefined, infiniteTime: boolean): string[] => {
      const game = {
        ctx: {
          assets: { sheet: () => ({ frames: new Map() }) },
          assist: { ...DEFAULT_ASSIST, infiniteTime },
          ...(classicCheats ? { classicCheats } : {}),
        },
        state: newGameState(MARIO),
      } as unknown as Game;
      const texts: string[] = [];
      const r: Renderer = Object.assign(new NullRenderer(), {
        text(_f: SpriteSheet, str: string): void {
          texts.push(str);
        },
      });
      new IntroScene(game, () => undefined, 400).render(r);
      return texts;
    };
    expect(card(undefined, true)).toContain('TIME');
    const on = card({ ...NO_CHEATS, infiniteTime: true }, true);
    expect(on).not.toContain('TIME');
    expect(on).not.toContain('400');
    expect(card({ ...NO_CHEATS }, false)).toEqual(expect.arrayContaining(['TIME', '400']));
  });
});
