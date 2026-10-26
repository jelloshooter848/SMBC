import { describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { CLASSIC_CHARACTERS } from '@game/characters/registry';
import { LINK } from '@game/characters/link';
import { MARIO } from '@game/characters/mario';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem } from '@game/scenes/menu';
import { ClassicMenuScene, ClassicOptionsScene } from '@game/scenes/original-game';
import { draw, makeGame, useStorage, type H } from './heroes-harness';

// BUG-11: the dev-only Classic options Rules row (Classic SMBC / Campaign) is gone. Classic mode
// always plays Classic rules (Game.classicRules); a hero plays its Campaign design there only
// when Dev > Toggle heroes > Classic > Plays as says so (BUG-10). A saved classicRules is ignored
// and never rewritten. The dev START page's own Rules row still starts a Campaign-rules run.

useStorage();

const labels = (m: unknown) => (m as { items: MenuItem[] }).items.map((i) => i.label.replace(/\*$/, ''));

function game(dev: boolean): H & { settings: Settings } {
  const settings: Settings = { ...defaultSettings(), dev, classicRules: 'campaign' };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}

describe('BUG-11 no Classic rules row', () => {
  for (const dev of [false, true])
    it(`Classic options has no Rules row and draws no rules value (dev ${dev})`, () => {
      const h = game(dev);
      const o = new ClassicOptionsScene(h.game, () => {});
      // B-L: the shared rows; Music set first.
      expect(labels(o)[0]).toBe('Music set');
      for (const l of labels(o)) expect(l).not.toMatch(/rules/i);
      for (const i of (o as unknown as { items: MenuItem[] }).items)
        expect(i.hint ?? '').not.toMatch(/Classic rules|Campaign rules/);
      const t = draw(o).texts.map((x) => x.str);
      expect(t).not.toContain('CLASSIC SMBC');
      expect(t).not.toContain('CAMPAIGN');
    });

  it('the getter gives Classic rules whatever was saved, and the saved value is never rewritten', () => {
    for (const dev of [false, true]) {
      const h = game(dev);
      expect(h.game.classicRules).toBe('classic');
      h.game.showClassicMenu();
      expect(h.top()).toBeInstanceOf(ClassicMenuScene);
      h.game.classicGame(MARIO);
      expect(h.game.liveRules).toBe('classic');
      expect(h.settings.classicRules).toBe('campaign');
    }
  });

  it('Toggle heroes takes its place: a hero set to Plays as Campaign plays that design in Classic mode', () => {
    const h = game(true);
    h.settings.classicDev.playsCampaign = ['link'];
    h.game.classicGame(LINK);
    h.until(() => h.top() instanceof LevelScene, 600);
    const w = (h.top() as LevelScene).world;
    expect(w.rules).toBe('classic');
    expect(w.players[0]?.def).toBe(LINK);
    // Mario, not toggled, plays his Classic design.
    h.game.classicGame(MARIO);
    h.until(() => h.top() instanceof LevelScene && (h.top() as LevelScene).world !== w, 600);
    expect((h.top() as LevelScene).world.players[0]?.def).toBe(CLASSIC_CHARACTERS.mario);
  });

  it('the dev START page still starts a whole run under Campaign rules', () => {
    const h = game(true);
    h.game.devClassicGame(MARIO, '1-1', 'campaign');
    expect(h.game.liveRules).toBe('campaign');
    expect(h.game.classicRun).toBe(true);
  });
});
