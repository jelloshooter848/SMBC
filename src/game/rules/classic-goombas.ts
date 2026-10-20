import type { EntitySpawn } from '../level/schema';

/*
 * Replace Goombas (FU-7a; GameSettings.goombaReplacementType: Off, Buzzy Beetle, Spiny, Spike
 * Top): every Goomba of the level data spawns as the chosen enemy (Level.as, never on the
 * title). The More Settings row (Classic options) owns the choice and Buzzy Beetle and Spiny;
 * this file adds the choices that came with their own enemy, Spike Top first
 * (entities/enemies/spike-top.ts), through registerGoombaReplacements, and the spawn rewrite.
 */

/** A Replace Goombas choice: its option id, its row value, the spawn type a Goomba becomes. */
export interface GoombaReplacement {
  id: string;
  label: string;
  spawn: string;
}

/** The choices this file adds to the row, in the original's order (after Buzzy Beetle, Spiny). */
export const EXTRA_GOOMBA_REPLACEMENTS: readonly GoombaReplacement[] = [
  { id: 'spikeTop', label: 'Spike Top', spawn: 'spike-top' },
];

/** Hands each extra choice to the Replace Goombas row (`add` appends it to the row's values). */
export function registerGoombaReplacements(add: (r: GoombaReplacement) => void): void {
  for (const r of EXTRA_GOOMBA_REPLACEMENTS) add(r);
}

/**
 * Every Goomba in `spawns` becomes a `spawn` (Level.as: `case GoombaReplacementType.SpikeTop:
 * objectToSpawn = new SpikeTop(itemText)`), on the same cell. Returns how many changed.
 */
export function replaceGoombas(spawns: EntitySpawn[], spawn: string): number {
  let n = 0;
  spawns.forEach((s, i) => {
    if (s.type !== 'goomba') return;
    spawns[i] = { ...s, type: spawn };
    n++;
  });
  return n;
}
