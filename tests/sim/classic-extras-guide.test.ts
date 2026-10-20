import { describe, expect, it } from 'vitest';
import { MARIO } from '@game/characters/mario';
import { CLASSIC_EXTRAS } from '@game/characters/registry';
import { GuideIndexScene } from '@game/scenes/guide';
import type { MenuItem } from '@game/scenes/menu';
import { makeGame, useStorage } from './heroes-harness';
import { isolateClassicRegistry } from './classic-registry';

// Options > How to play in a Classic run lists the Classic-only extras (Bass, Proto Man, Break Man,
// Pit, Dark Pit) after the usual heroes, each with its own Classic guide; never under Current.

useStorage();
isolateClassicRegistry();

const rows = (s: unknown) =>
  (s as { items: MenuItem[] }).items.map((i) => [i.label, (i as { hint?: string }).hint] as const);

describe('How to play lists the Classic extras', () => {
  it('in a Classic run: every extra, in roster order, with its Classic guide tagline', () => {
    expect(CLASSIC_EXTRAS.map((c) => c.id)).toEqual([
      'bass',
      'protoman',
      'breakman',
      'pit',
      'darkpit',
      'vicviper',
      'warriors',
      'peach',
      'arthur',
    ]);
    const h = makeGame({ dev: true });
    h.game.devStart('1-1', MARIO, 'small', false, 1, { rules: 'classic' });
    expect(h.game.liveRules).toBe('classic');
    const r = rows(new GuideIndexScene(h.game, () => {}));
    const labels = r.map(([l]) => l);
    const at = labels.indexOf(CLASSIC_EXTRAS[0]?.name ?? '');
    expect(at).toBe(h.game.deps.characters.length);
    CLASSIC_EXTRAS.forEach((c, k) => {
      expect(r[at + k], c.id).toEqual([c.name, c.guide.tagline]);
      expect(c.rules).toBe('classic');
    });
  });

  it('under Current: no extras', () => {
    const h = makeGame({ dev: true });
    h.game.devStart('1-1', MARIO, 'small', false, 1, { rules: 'current' });
    const labels = rows(new GuideIndexScene(h.game, () => {})).map(([l]) => l);
    for (const c of CLASSIC_EXTRAS) expect(labels).not.toContain(c.name);
  });
});
