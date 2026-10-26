import { describe, expect, it, vi } from 'vitest';
import { defaultSettings, loadSettings, SETTINGS_KEY, type Settings } from '@engine/save/settings';
import { CHARACTERS, CLASSIC_CHARACTERS, playedHero } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { heroRulesOf } from '@game/context';
import { DevClassicHeroesScene, DevMenuScene, DevPlaysAsScene, DevToggleHeroesScene } from '@game/scenes/dev';
import { LevelScene } from '@game/scenes/level';
import { reconcileRules } from '@game/rules/reconcile';
import type { MenuItem } from '@game/scenes/menu';
import { file, makeGame, useStorage, type H } from './heroes-harness';

// BUG-10: Dev > Toggle heroes (was Classic heroes) opens two pages. Classic: the per-hero Release /
// On / Off page, the Yoshi mount and Plays as (each Classic hero plays its Classic or its Campaign
// design in Classic mode). Campaign: each campaign hero plays its Campaign design or its Classic
// kit in the campaign. Saved like the other dev toggles; no effect outside dev mode.

useStorage();

const items = (s: unknown): MenuItem[] => (s as { items: MenuItem[] }).items;
const labels = (s: unknown) => items(s).map((i) => i.label);
const row = (s: unknown, label: string): MenuItem => {
  const r = items(s).find((i) => i.label === label);
  expect(r, label).toBeDefined();
  return r as MenuItem;
};

function devGame(dev = true): H & { settings: Settings; apply: ReturnType<typeof vi.fn> } {
  const settings: Settings = { ...defaultSettings(), dev };
  const apply = vi.fn();
  const h = makeGame({ deps: { settings, applySettings: apply } });
  return { ...h, settings, apply };
}

const level = (h: H) => {
  h.until(() => h.top() instanceof LevelScene, 600);
  return h.top() as LevelScene;
};

describe('BUG-10 the Toggle heroes pages', () => {
  it('the Dev menu names it Toggle heroes, and it opens Classic and Campaign', () => {
    const h = devGame();
    h.game.showDevMenu();
    expect(labels(h.top())).toContain('Toggle heroes');
    expect(labels(h.top())).not.toContain('Classic heroes');
    row(h.top(), 'Toggle heroes').select?.();
    expect(h.top()).toBeInstanceOf(DevToggleHeroesScene);
    expect(labels(h.top())).toEqual(['Classic', 'Campaign', 'Back']);
    expect(h.said.at(-1)).toMatch(/^Toggle heroes\. Classic\. /);
    row(h.top(), 'Classic').select?.();
    expect(h.top()).toBeInstanceOf(DevClassicHeroesScene);
    expect(labels(h.top())).toContain('Plays as');
    expect(row(h.top(), 'Plays as').value?.()).toBe('All Classic');
    h.game.scenes.pop();
    row(h.top(), 'Campaign').select?.();
    expect(h.top()).toBeInstanceOf(DevPlaysAsScene);
  });

  it('Classic > Plays as: a row per hero with both designs, Classic until flipped to Campaign, saved and read out', () => {
    const h = devGame();
    const classic = new DevClassicHeroesScene(h.game, () => h.game.scenes.pop());
    h.game.scenes.push(classic);
    row(classic, 'Plays as').select?.();
    const page = h.top() as DevPlaysAsScene;
    expect(page).toBeInstanceOf(DevPlaysAsScene);
    const both = CHARACTERS.filter((c) => CLASSIC_CHARACTERS[c.id]);
    expect(labels(page)).toEqual([...both.map((c) => c.name), 'Back']);
    for (const c of both) expect(row(page, c.name).value?.()).toBe('Classic');
    expect(h.said.at(-1)).toMatch(
      /^Toggle heroes: Classic, plays as\. Mario: Classic\. Plays as: Classic or Campaign/,
    );
    h.idle(8);
    h.tap('down');
    h.tap('down'); // Link
    h.tap('jump');
    expect(h.said.at(-1)).toMatch(/^Link: Campaign/);
    expect(h.settings.classicDev.playsCampaign).toEqual(['link']);
    expect(h.apply).toHaveBeenCalled();
    h.tap('right');
    expect(h.settings.classicDev.playsCampaign).toBeUndefined();
    row(page, 'Link').adjust?.(1);
    h.game.scenes.pop();
    expect(row(classic, 'Plays as').value?.()).toBe('Mixed');
  });

  it('START on a Plays as row leaves the page, never flipping it', () => {
    const h = devGame();
    h.game.scenes.push(new DevMenuScene(h.game));
    const page = new DevPlaysAsScene(h.game, 'campaign', () => h.game.scenes.pop());
    h.game.scenes.push(page);
    h.idle(8);
    h.tap('start');
    expect(h.top()).not.toBe(page);
    expect(h.settings.classicDev.playsClassic).toBeUndefined();
  });

  it('Campaign: each campaign hero, Campaign until flipped to Classic', () => {
    const h = devGame();
    const page = new DevPlaysAsScene(h.game, 'campaign', () => {});
    expect(labels(page)).toEqual([...CHARACTERS.map((c) => c.name), 'Back']);
    expect(row(page, 'Mario').value?.()).toBe('Campaign');
    row(page, 'Mario').adjust?.(1);
    expect(row(page, 'Mario').value?.()).toBe('Classic');
    expect(h.settings.classicDev.playsClassic).toEqual(['mario']);
  });

  it('saved like the other dev toggles: loadSettings keeps both lists, strings only', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        v: 2,
        classicDev: {
          yoshiMount: false,
          heroesOff: [],
          playsCampaign: ['link', 4, 'link'],
          playsClassic: ['samus'],
        },
      }),
    );
    const s = loadSettings();
    expect(s.classicDev.playsCampaign).toEqual(['link']);
    expect(s.classicDev.playsClassic).toEqual(['samus']);
  });
});

describe('BUG-10 Plays as in play', () => {
  it('a Classic run: Link set to Campaign plays the Campaign Link; the others their Classic design', () => {
    const h = devGame();
    h.settings.classicDev.playsCampaign = ['link'];
    h.game.devClassicGame(LINK, '1-1', 'classic');
    const l = level(h);
    expect(l.world.rules).toBe('classic');
    expect(l.world.players[0]?.def).toBe(LINK);
    expect(h.game.state.character).toBe(LINK);
    // A hit-point hero's power, not a power-up one.
    expect(h.game.state.powerState).toBe('full');
    h.settings.classicDev.playsCampaign = [];
    h.game.devClassicGame(LINK, '1-1', 'classic');
    expect(level(h).world.players[0]?.def).toBe(CLASSIC_CHARACTERS.link);
  });

  it('the campaign: Mario set to Classic plays his Classic kit in a campaign file', () => {
    const h = devGame();
    h.settings.classicDev.playsClassic = ['mario'];
    file();
    h.game.openFile(1);
    expect(h.game.campaign).not.toBeNull();
    h.game.enterLevelFromMap('1-1');
    h.idle(12);
    h.tap('jump');
    const l = level(h);
    expect(l.world.rules).toBe('campaign');
    expect(l.world.players[0]?.def).toBe(CLASSIC_CHARACTERS.mario);
  });

  it("a hit-point hero swapped to a power-up design (and back) starts at that design's power", () => {
    const h = devGame();
    h.game.devStart('1-1', LINK, 'full', false, 1);
    expect(level(h).world.players[0]?.def).toBe(LINK);
    h.settings.classicDev.playsClassic = ['link'];
    h.game.devStart('1-1', LINK, 'small', false, 1);
    const l = level(h);
    expect(l.world.players[0]?.def).toBe(CLASSIC_CHARACTERS.link);
    expect(h.game.state.powerState).toBe('small');
  });

  it("a design flipped between levels resets that hero's power before the next World (dev mode only)", () => {
    const h = devGame();
    h.game.devStart('1-1', LINK, 'full', false, 1);
    level(h);
    expect(h.game.state.powerState).toBe('full');
    h.settings.classicDev.playsClassic = ['link'];
    reconcileRules(h.game, 'campaign');
    expect(h.game.state.powerState).toBe('small');
    expect(h.said.at(-1)).toBe('Hero design changed. Power reset.');
    delete h.settings.classicDev.playsClassic;
    reconcileRules(h.game, 'campaign');
    expect(h.game.state.powerState).toBe('full');
  });

  it('outside dev mode the saved lists do nothing', () => {
    const h = devGame(false);
    h.settings.classicDev.playsCampaign = ['link', 'mario'];
    h.settings.classicDev.playsClassic = ['mario', 'link'];
    expect(h.game.heroSwaps).toBeUndefined();
    expect(h.game.ctx.heroSwaps).toBeUndefined();
    expect(playedHero(h.game.ctx, MARIO, 'campaign')).toBe(MARIO);
    expect(playedHero(h.game.ctx, LINK, 'classic')).toBe(CLASSIC_CHARACTERS.link);
    h.game.classicGame(LINK, '1-1');
    expect(level(h).world.players[0]?.def).toBe(CLASSIC_CHARACTERS.link);
  });

  it('heroRulesOf swaps only the named heroes, each way', () => {
    const ctx = { heroSwaps: { classic: ['link'], campaign: ['samus'] } };
    expect(heroRulesOf(ctx, 'link', 'classic')).toBe('campaign');
    expect(heroRulesOf(ctx, 'mario', 'classic')).toBe('classic');
    expect(heroRulesOf(ctx, 'samus', 'campaign')).toBe('classic');
    expect(heroRulesOf(ctx, 'link', 'campaign')).toBe('campaign');
    expect(heroRulesOf({}, 'link', 'classic')).toBe('classic');
  });
});
