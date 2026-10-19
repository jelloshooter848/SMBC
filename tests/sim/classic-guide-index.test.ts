import { describe, expect, it } from 'vitest';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { MEGAMAN } from '@game/characters/megaman';
import { MARIO_CLASSIC } from '@game/characters/mario/classic';
import { LINK_CLASSIC } from '@game/characters/link/classic';
import { MEGAMAN_CLASSIC } from '@game/characters/megaman/classic';
import { CHARACTERS } from '@game/characters/registry';
import { GuideIndexScene } from '@game/scenes/guide';
import type { MenuItem } from '@game/scenes/menu';
import { file, makeGame, useStorage } from './heroes-harness';

// Options > How to play lists the live roster as the run's rules play it (TG-22): the Classic
// guides in a Classic run, today's guides under Current and in the campaign.

useStorage();

const items = (s: unknown) => (s as { items: MenuItem[] }).items;
/** Each row's hint (the hero's tagline), by label. */
function hints(scene: GuideIndexScene): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const i of items(scene)) out[i.label] = (i as { hint?: string }).hint;
  return out;
}

describe('How to play follows the live rules', () => {
  it('a Classic run shows the Classic guides of Mario, Link and Mega Man', () => {
    const h = makeGame({ dev: true });
    h.game.devStart('1-1', MARIO, 'small', false, 1, { rules: 'classic' });
    expect(h.game.liveRules).toBe('classic');
    const g = hints(new GuideIndexScene(h.game, () => {}));
    for (const d of [MARIO_CLASSIC, LINK_CLASSIC, MEGAMAN_CLASSIC]) {
      expect(g[d.name], d.id).toBe(d.guide.tagline);
      expect(d.guide.tagline).not.toBe(CHARACTERS.find((c) => c.id === d.id)?.guide.tagline);
    }
  });

  it('under Current and in the campaign it is exactly as today', () => {
    const cur = makeGame({ dev: true });
    cur.game.devStart('1-1', MARIO, 'small', false, 1, { rules: 'current' });
    const expected = [...CHARACTERS.map((c) => [c.name, c.guide.tagline]), ['Back', undefined]];
    const rows = (s: GuideIndexScene) => items(s).map((i) => [i.label, (i as { hint?: string }).hint]);
    expect(rows(new GuideIndexScene(cur.game, () => {}))).toEqual(expected);
    const camp = makeGame({ dev: true });
    camp.game.devStart('1-1', MARIO, 'small', false, 1, { rules: 'classic' });
    file();
    camp.game.openFile(1);
    expect(camp.game.liveRules).toBe('current');
    const g = hints(new GuideIndexScene(camp.game, () => {}));
    for (const d of [MARIO, LINK, MEGAMAN]) expect(g[d.name], d.id).toBe(d.guide.tagline);
    expect(rows(new GuideIndexScene(camp.game, () => {}))).toEqual(expected);
  });
});
