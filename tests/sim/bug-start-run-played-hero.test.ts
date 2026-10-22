import { describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { CLASSIC_CHARACTERS } from '@game/characters/registry';
import { startHp } from '@game/characters/character';
import { LINK } from '@game/characters/link';
import { MARIO } from '@game/characters/mario';
import { LevelScene } from '@game/scenes/level';
import { makeGame, useStorage, type H } from './heroes-harness';

// Item 24: startRun (classicGame, newGame, devClassicGame) starts each hero at the power of the
// design it plays (playedHero, as devStart does), so a brand-new run with a hero's Plays as
// flipped is never told "Hero design changed. Power reset."

useStorage();

function devGame(): H & { settings: Settings } {
  const settings: Settings = { ...defaultSettings(), dev: true };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}

const RESET = 'Hero design changed. Power reset.';

describe('a new run starts at the played design power', () => {
  it('Classic run, Link plays as Campaign: full hit points from the start, no reset said', () => {
    for (const start of ['classicGame', 'devClassicGame'] as const) {
      const h = devGame();
      h.settings.classicDev.playsCampaign = ['link'];
      if (start === 'classicGame') h.game.classicGame(LINK, '1-1');
      else h.game.devClassicGame(LINK, '1-1', 'classic');
      // Before any World: the state the run's first save would store.
      expect(h.game.state.powerState, start).toBe('full');
      expect(h.game.state.hp, start).toBe(startHp(LINK));
      h.until(() => h.top() instanceof LevelScene, 600);
      expect((h.top() as LevelScene).world.players[0]?.def, start).toBe(LINK);
      expect(h.game.state.powerState, start).toBe('full');
      expect(h.said, start).not.toContain(RESET);
    }
  });

  it('Campaign-rules run, Link plays as Classic (both players): small from the start, no reset said', () => {
    const h = devGame();
    h.settings.classicDev.playsClassic = ['link'];
    h.game.newGame(LINK, '1-1', LINK, { rules: 'current' });
    const classicLink = CLASSIC_CHARACTERS.link;
    expect(classicLink).toBeDefined();
    expect(h.game.state.powerState).toBe('small');
    expect(h.game.state.hp).toBe(startHp(classicLink!));
    expect(h.game.state.powerState2).toBe('small');
    h.until(() => h.top() instanceof LevelScene, 600);
    expect(h.said).not.toContain(RESET);
  });

  it('no swap: a Classic run still starts small Mario', () => {
    const h = devGame();
    h.game.classicGame(MARIO, '1-1');
    expect(h.game.state.powerState).toBe('small');
    expect(h.said).not.toContain(RESET);
  });
});
