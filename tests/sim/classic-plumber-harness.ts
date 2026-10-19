import type { Action } from '@engine/input/actions';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { parseTextMap } from '@game/level/textmap';
import type { LevelData } from '@game/level/schema';
import { ScriptedInput } from '@game/sim/headless';
import { World, type WorldEvent } from '@game/world/world';
import { DEFAULT_ASSIST, newGameState, type Rules } from '@game/context';
import type { CharacterDef } from '@game/characters/character';
import type { Player } from '@game/entities/player';

// Frame-by-frame rig for the Classic Mario and Luigi tests (classic-mario-luigi.test.ts).

/** A flat stretch `width` columns wide, `rows` (0..12) laid over it, floor top at y = 208 px. */
export function flatLevel(rows: Record<number, string> = {}, width = 200, extra: string[] = []): LevelData {
  const lines = Array.from({ length: 13 }, (_, y) => (rows[y] ?? '').padEnd(width, '.'));
  return parseTextMap(
    [
      'id: t',
      'time: 300',
      'start: 6,12',
      ...extra,
      '',
      '[tiles]',
      ...lines,
      '#'.repeat(width),
      '#'.repeat(width),
    ].join('\n'),
  );
}

/** A World stepped one frame at a time with the actions held that frame. */
export class Rig {
  readonly world: World;
  private readonly input = new ScriptedInput({ steps: [] });
  frame = 0;
  /** Every world event so far, with the frame (1-based) it came on. */
  readonly events: { frame: number; e: WorldEvent }[] = [];
  constructor(def: CharacterDef, level: LevelData = flatLevel(), rules: Rules = 'classic', power = 'small') {
    const state = { ...newGameState(def, null, rules), powerState: power };
    this.world = new World(
      level,
      {
        assets: new AssetRegistry({ default: {} }),
        audio: NULL_AUDIO,
        assist: { ...DEFAULT_ASSIST },
        reduceFlashing: true,
        rules,
      },
      state,
      { seed: 1 },
    );
  }
  get p(): Player {
    return this.world.player;
  }
  step(hold: Action[] = []): void {
    this.input.setHeld(hold);
    this.input.next();
    this.world.update([this.input]);
    this.frame++;
    for (const e of this.world.events.splice(0)) this.events.push({ frame: this.frame, e });
  }
  /** Steps (holding `hold`) until `cond` holds, at most `max` frames; returns the frames stepped. */
  until(cond: () => boolean, hold: Action[] | ((i: number) => Action[]) = [], max = 600): number {
    for (let i = 0; i < max; i++) {
      if (cond()) return i;
      this.step(typeof hold === 'function' ? hold(i) : hold);
    }
    return max;
  }
  /** Settles the hero on the floor. */
  settle(): void {
    for (let i = 0; i < 10; i++) this.step();
  }
}

export interface JumpLog {
  /** Apex height above take-off (px, fractional). */
  apex: number;
  /** Frame of the apex (take-off frame = 1). */
  apexFrame: number;
  /** Frames from take-off to landing, both counted. */
  airtime: number;
}

/**
 * Jumps from the floor with vx set to `vx` at take-off (no direction held after), jump held for
 * `holdFrames` frames counting the take-off frame (Infinity: held to the landing).
 */
export function measureJump(
  def: CharacterDef,
  vx: number,
  holdFrames: number,
  rules: Rules = 'classic',
  power = 'small',
): JumpLog {
  const r = new Rig(def, flatLevel({}, 400), rules, power);
  r.settle();
  const b = r.p.body;
  b.vx = vx;
  const y0 = b.y + b.h;
  let minFeet = y0;
  let apexFrame = 0;
  let f = 0;
  for (; f < 300; f++) {
    r.step(f < holdFrames ? ['jump'] : []);
    const feet = b.y + b.h;
    if (feet < minFeet) {
      minFeet = feet;
      apexFrame = f + 1;
    }
    if (f > 0 && b.onGround) break;
  }
  return { apex: (y0 - minFeet) / 256, apexFrame, airtime: f + 1 };
}
