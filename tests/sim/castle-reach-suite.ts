import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { CHARACTERS } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { Enemy } from '@game/entities/enemies/enemy';
import { runSim } from '@game/sim/headless';
import { CASTLE_LEGS, reach } from './castle-reach';

/*
 * BOWSER'S CASTLE (internal 8-5, 0.4.55): every hero, small and big (a hit-point hero at full),
 * reaches each checkpoint from the one before, the axe from the last, and then the end (the
 * bridge falls, Toad, the exit to the ending). LV54's design sims, ported (castle-reach.ts). The
 * heroes are split over three files (bowsers-castle-reach-*.test.ts) so the sweep runs in parallel.
 */

/** The powers a hero is searched in: small and big (Mario, Luigi, Sophia III), else full. */
const powersOf = (hero: CharacterDef): string[] =>
  hero.damage.kind === 'powerup' ? ['small', 'big'] : ['full'];

export function castleReachSuite(heroIds: readonly string[]): void {
  const level = getLevel('8-5');
  const heroes = heroIds.map((id) => {
    const hero = CHARACTERS.find((c) => c.id === id);
    if (!hero) throw new Error(`no hero ${id}`);
    return hero;
  });
  const cases = heroes.flatMap((hero) => powersOf(hero).map((power) => [hero.id, power, hero] as const));

  describe("BOWSER'S CASTLE: every section, checkpoint to checkpoint, then the axe", () => {
    it.each(cases)(
      '%s (%s)',
      (_id, power, hero) => {
        const failed: string[] = [];
        for (const [label, from, stop] of CASTLE_LEGS) {
          const r = reach(level, hero, power, {
            budget: 6000,
            ...(from ? { from: { ...from, mode: 'stand' as const } } : {}),
            ...(stop !== null ? { stopAt: stop } : {}),
          });
          if (!r.done) failed.push(`${label}: furthest column ${r.furthest}`);
          else if (stop === null) expect(r.how).toBe('axe');
        }
        expect(failed).toEqual([]);
      },
      600_000,
    );
  });

  describe("BOWSER'S CASTLE: from the bridge to the end", () => {
    it.each(cases)(
      '%s (%s): the axe drops the bridge, Toad, and the exit to the ending',
      (_id, power, hero) => {
        // Along the bridge and a jump up the step to the axe, from a few run-ups as a player
        // would try (Simon's committed arc wants its own); the first that clears is kept.
        const run = (from: number) =>
          runSim({
            level,
            character: hero,
            script: { steps: [] },
            maxFrames: 1500,
            assist: { invulnerable: true, infiniteTime: true },
            state: { powerState: power },
            start: { x: from, y: 9, mode: 'stand' },
            controller: (w, f) => {
              // The king and his hammers out of the way: this leg is the bridge's fall and the end.
              for (const e of w.entities) if (e instanceof Enemy) e.alive = false;
              return f >= 4 && f % 60 < 30 ? ['right', 'jump'] : ['right'];
            },
          });
        const r = [530, 534, 537, 538, 539].map(run).find((x) => x.outcome === 'cleared');
        expect(r?.outcome).toBe('cleared');
        expect(r?.events).toContainEqual({ type: 'exit', next: 'end' });
      },
    );
  });
}
