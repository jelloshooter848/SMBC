import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLevel, levelIds } from '@content/levels';
import { runSim } from '@game/sim/headless';
import { LINK } from '@game/characters/link';
import { SOPHIA } from '@game/characters/sophia';

/*
 * G-010 / G-006 guard: the per-hero and per-difficulty layers (src/content/level-layers/, written
 * by tools/levelgen/regen.mjs --layers) never touch a map. Every .map file under
 * src/content/levels hashes as recorded on main before the layers landed:
 *   RECORD_MAP_HASHES=1 pnpm vitest run tests/sim/campaign-map-hashes.test.ts
 * (only to record a map change made on purpose). And a Campaign World plays the map's own level:
 * the layers are laid only under Classic rules.
 */

const ROOT = fileURLToPath(new URL('../../src/content/levels', import.meta.url));
const FIXTURE = fileURLToPath(new URL('./fixtures/campaign-map-hashes.json', import.meta.url));

function maps(dir: string): string[] {
  return readdirSync(dir)
    .flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? maps(p) : f.endsWith('.map') ? [p] : [];
    })
    .sort();
}

const hashes = (): Record<string, string> =>
  Object.fromEntries(
    maps(ROOT).map((p) => [
      relative(ROOT, p).split('\\').join('/'),
      createHash('sha256').update(readFileSync(p)).digest('hex'),
    ]),
  );

describe('campaign maps stay byte-identical (G-010, G-006)', () => {
  it('every .map file hashes as recorded', () => {
    const now = hashes();
    if (process.env.RECORD_MAP_HASHES === '1') {
      writeFileSync(FIXTURE, JSON.stringify(now, null, 2) + '\n');
      return;
    }
    const want = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, string>;
    expect(Object.keys(now)).toEqual(Object.keys(want));
    for (const [f, h] of Object.entries(want)) expect(now[f], f).toBe(h);
  });

  it('no layer file sits beside a map (the map folders hold maps only)', () => {
    const stray = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? stray(p) : f.endsWith('.layers') ? [p] : [];
      });
    expect(stray(ROOT)).toEqual([]);
  });

  it('a Campaign World plays the map as it is, whoever the hero (no layer is laid)', () => {
    const withLayers = levelIds().filter((id) => getLevel(id).layers?.length);
    expect(withLayers.length).toBeGreaterThan(150);
    for (const id of ['1-1', '2-2', '8-4', 'll-1-2', 'll-9-1']) {
      const level = getLevel(id);
      for (const character of [LINK, SOPHIA]) {
        const r = runSim({ level, character, rules: 'campaign', script: { steps: [] }, maxFrames: 1 });
        expect(r.world.level).toBe(level);
        expect(r.world.mapDifficulty).toBe('normal');
      }
    }
  });
});
