import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MAP_SETS } from '@game/scenes/original-game';

// #181: the READMEs name every Classic map set (G-020 added Super Mario Bros. Special).

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8').replace(/\s+/g, ' ');

describe('the READMEs name every Classic map set', () => {
  it('the offline README.txt and the main README list SMB, Special and The Lost Levels', () => {
    expect(MAP_SETS.map((m) => m.id)).toEqual(['smb', 'special', 'lost']);
    for (const p of ['tools/offline/README.txt', 'README.md']) {
      const t = read(p);
      expect(t, p).toContain('Super Mario Bros. Special');
      expect(t, p).toContain('The Lost Levels');
    }
    expect(read('tools/offline/README.txt')).toContain(
      'Super Mario Bros., Super Mario Bros. Special and The Lost Levels',
    );
  });
});
