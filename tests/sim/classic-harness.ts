import { vi } from 'vitest';
import { px } from '@engine/math/units';
import { parseTextMap } from '@game/level/textmap';
import { runSim, ScriptedInput } from '@game/sim/headless';
import type { CharacterDef } from '@game/characters/character';
import type { DamageSource } from '@game/rules/damage';
import type { ClassicHitProps } from '@game/rules/damage';
import { BUSTER, type ProjectileSpec } from '@game/entities/projectiles/projectile';
import type { World } from '@game/world/world';

// Shared helpers for the Classic shared-system tests (classic-enemy-hp, classic-bricks): a flat
// test level, a stand-in Classic def (a copy of a Campaign def marked `rules: 'classic'`, so its
// weapons count in the original's units), Classic weapon specs and stepping the World by hand.

/** A stand-in Classic def for `def` (not registered: heroFor plays a classic def as given). */
export function classicStub(def: CharacterDef, extra: Partial<CharacterDef> = {}): CharacterDef {
  return { ...def, rules: 'classic', ...extra };
}

/**
 * A 48-column test level: ground on rows 13-14, the player at column 2 row 12, and `rows`
 * (row number -> 48-char string) laid over the air.
 */
export function testLevel(rows: Record<number, string> = {}): ReturnType<typeof parseTextMap> {
  const lines: string[] = [];
  for (let y = 0; y < 13; y++) lines.push((rows[y] ?? '').padEnd(48, '.').slice(0, 48));
  lines.push('#'.repeat(48), '#'.repeat(48));
  return parseTextMap(['id: t', 'time: 300', 'start: 2,12', '', '[tiles]', ...lines].join('\n'));
}

/** A Classic World (no frames run yet) for `def` on `level`. */
export function classicWorld(
  def: CharacterDef,
  level = testLevel(),
  rules: 'classic' | 'campaign' = 'classic',
): World {
  return runSim({ level, character: def, script: { steps: [] }, maxFrames: 0, rules }).world;
}

/** Runs `n` frames with no input held. */
export function step(world: World, n = 1): void {
  const input = new ScriptedInput({ steps: [] });
  for (let i = 0; i < n; i++) {
    input.next();
    world.update([input]);
  }
}

/** A weapon hit from the World's player (a Classic stub: `amount` in the original's units). */
export function weapon(
  world: World,
  kind: DamageSource['kind'],
  amount: number,
  extra: ClassicHitProps = {},
): DamageSource {
  return { kind, amount, owner: world.player, dirX: 1, ...extra };
}

/** A Classic shot spec built on the Mega Buster's body. */
export function shotSpec(over: Partial<ProjectileSpec>): ProjectileSpec {
  return { ...BUSTER, ...over };
}

/** Records every sound the World plays. */
export function sfxLog(world: World): string[] {
  const out: string[] = [];
  vi.spyOn(world.audio, 'sfx').mockImplementation((id: string) => void out.push(id));
  return out;
}

export const tile = (n: number): number => px(n * 16);
