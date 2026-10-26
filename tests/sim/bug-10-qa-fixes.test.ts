import { describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { CLASSIC_CHARACTERS, CLASSIC_SKINS, playedHero } from '@game/characters/registry';
import { startHp } from '@game/characters/character';
import { LINK } from '@game/characters/link';
import { MARIO } from '@game/characters/mario';
import { reconcileRules } from '@game/rules/reconcile';
import { DevClassicHeroesScene, DevPlaysAsScene } from '@game/scenes/dev';
import { DevStartScene } from '@game/scenes/dev-play';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem } from '@game/scenes/menu';
import { draw, makeGame, useStorage, type H } from './heroes-harness';

// BUG-10 QA fixes: the dev START page offers (and Again starts) the power of the design a hero
// plays (Plays as); a power that no longer fits the played design is reset however the design
// changed, dev mode turned off included; a Classic look follows its slot hero's Plays as; the
// pages are titled Toggle heroes: Classic / Campaign and show every row with Back on one screen.

useStorage();

const items = (s: unknown): MenuItem[] => (s as { items: MenuItem[] }).items;
const row = (s: unknown, label: string) => items(s).find((i) => i.label === label) as MenuItem;

function devGame(): H & { settings: Settings } {
  const settings: Settings = { ...defaultSettings(), dev: true };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}

const level = (h: H) => {
  h.until(() => h.top() instanceof LevelScene, 600);
  return h.top() as LevelScene;
};

describe('BUG-10 QA: the START page plays the swapped design', () => {
  it('Link set to Plays as Campaign: the Power row offers hit points, and he starts with full HP', () => {
    const h = devGame();
    h.settings.classicDev.playsCampaign = ['link'];
    const start = new DevStartScene(h.game, { branch: 'classic', level: '1-1', name: 'SMB 1-1' });
    const hero = row(start, 'Hero');
    for (let i = 0; i < 30 && start.hero.id !== 'link'; i++) hero.adjust?.(1);
    expect(start.hero.id).toBe('link');
    const power = row(start, 'Power');
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) {
      seen.add(power.value?.() ?? '');
      power.adjust?.(1);
    }
    expect([...seen].sort()).toEqual(['1 hp', 'full', 'half']);
    while (power.value?.() !== 'full') power.adjust?.(1);
    h.game.scenes.push(start);
    row(start, 'Start').select?.();
    const l = level(h);
    expect(l.world.players[0]?.def).toBe(LINK);
    expect(h.game.state.powerState).toBe('full');
    expect(h.game.state.hp).toBe(startHp(LINK));
  });
});

describe('BUG-10 QA: dev mode turned off with a hero swapped', () => {
  it('a Campaign hero playing his Classic kit goes back to his Campaign power', () => {
    const h = devGame();
    h.settings.classicDev.playsClassic = ['link'];
    h.game.devStart('1-1', LINK, 'fire', false, 1);
    expect(level(h).world.players[0]?.def).toBe(CLASSIC_CHARACTERS.link);
    expect(h.game.state.powerState).toBe('fire');
    h.settings.dev = false;
    reconcileRules(h.game, 'campaign');
    expect(h.game.state.powerState).toBe('full');
    expect(h.game.state.hp).toBe(startHp(LINK));
  });

  it('a Classic hero playing his Campaign design goes back to his Classic power', () => {
    const h = devGame();
    h.settings.classicDev.playsCampaign = ['link'];
    h.game.devClassicGame(LINK, '1-1', 'classic');
    expect(level(h).world.players[0]?.def).toBe(LINK);
    expect(h.game.state.powerState).toBe('full');
    h.settings.dev = false;
    reconcileRules(h.game, 'classic');
    expect(h.game.state.powerState).toBe('small');
  });

  it('a power that fits is never touched (no swap, dev mode on or off)', () => {
    for (const dev of [true, false]) {
      const h = devGame();
      h.settings.dev = dev;
      h.game.devStart('1-1', MARIO, 'fire', false, 1);
      level(h);
      reconcileRules(h.game, 'campaign');
      expect(h.game.state.powerState).toBe('fire');
    }
  });
});

describe('BUG-10 QA: looks and pages', () => {
  it("a Classic look follows its slot hero's Plays as", () => {
    const h = devGame();
    const look = (CLASSIC_SKINS.mario ?? [])[1];
    expect(look).toBeDefined();
    if (!look) return;
    expect(playedHero(h.game.ctx, look, 'classic')).toBe(look);
    h.settings.classicDev.playsCampaign = ['mario'];
    expect(playedHero(h.game.ctx, look, 'classic')).toBe(MARIO);
  });

  it('titled Toggle heroes: Classic / Campaign, drawn and said; every row and Back on one screen', () => {
    const h = devGame();
    const classic = new DevClassicHeroesScene(h.game, () => h.game.scenes.pop());
    expect(classic.title).toBe('TOGGLE HEROES: CLASSIC');
    h.game.scenes.push(classic);
    expect(h.said.at(-1)).toMatch(/^Toggle heroes: Classic\. /);
    for (const rules of ['classic', 'campaign'] as const) {
      const page = new DevPlaysAsScene(h.game, rules, () => h.game.scenes.pop());
      h.game.scenes.push(page);
      if (rules === 'campaign') {
        expect(page.title).toBe('TOGGLE HEROES: CAMPAIGN');
        expect(h.said.at(-1)).toMatch(/^Toggle heroes: Campaign\. /);
      }
      const t = draw(page).texts.map((x) => x.str);
      for (const it of items(page)) expect(t, it.label).toContain(it.label.toUpperCase());
      const back = draw(page).texts.find((x) => x.str === 'BACK');
      expect(back).toBeDefined();
      expect((back?.y ?? 999) + 8).toBeLessThanOrEqual(200);
      h.game.scenes.pop();
    }
  });
});
