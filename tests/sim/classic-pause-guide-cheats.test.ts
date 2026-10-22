import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { CheatsScene, HIDDEN_CHEAT } from '@game/scenes/cheats-menu';
import { GuideIndexScene, GuideScene } from '@game/scenes/guide';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import { OptionsScene } from '@game/scenes/options';
import { PauseScene } from '@game/scenes/pause';
import { makeGame, store, useStorage, type H } from './heroes-harness';

// G-031: the original's Pause > Options > Cheats mid-run: the unlocked cheats, applied at once.
// G-093: the Classic pause has the hero's Guide, and How to play from Classic mode's menus lists
// the Classic select's heroes under Options > Classic rules (not the campaign's).

useStorage();
afterEach(() => store.clear());

const labels = (m: unknown) => ((m as { items: MenuItem[] }).items ?? []).map((i) => i.label);

function pick(h: H, label: string): void {
  const m = h.top() as MenuScene;
  const list = labels(m);
  expect(list).toContain(label);
  h.idle(8);
  for (
    let i = 0;
    i < list.length && labels(h.top())[(h.top() as unknown as { index: number }).index] !== label;
    i++
  )
    h.tap('down');
  h.tap('jump');
}

function classic(over: Partial<Settings> = {}): H & { settings: Settings } {
  const settings = { ...defaultSettings(), ...over };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}

function pausedRun(h: H, hero = MARIO): LevelScene {
  h.game.classicGame(hero);
  h.until(() => h.top() instanceof LevelScene, 600);
  const level = h.top() as LevelScene;
  h.idle(4);
  h.tap('start');
  expect(h.top()).toBeInstanceOf(PauseScene);
  return level;
}

describe('G-031 cheats from the Classic pause', () => {
  it('lists only the unlocked cheats (no code entry mid-run hides the others)', () => {
    const h = classic();
    pausedRun(h);
    pick(h, 'Cheats');
    const page = h.top() as CheatsScene;
    expect(page).toBeInstanceOf(CheatsScene);
    // The original's defaults: Everyone Can Stomp and Classic Scroll open, the rest locked.
    expect(labels(page)).toContain('Everyone Can Stomp');
    expect(labels(page)).toContain(HIDDEN_CHEAT);
  });

  it('Invincible applies at once, mid-level', () => {
    const h = classic();
    h.settings.classicCheats.unlocked.invincible = true;
    const level = pausedRun(h);
    expect(level.world.assist.invulnerable).toBe(false);
    pick(h, 'Cheats');
    const page = h.top() as CheatsScene;
    h.idle(8);
    for (let i = 0; i < labels(page).indexOf('Invincible'); i++) h.tap('down');
    h.tap('right');
    expect(h.settings.classicCheats.on.invincible).toBe(true);
    expect(level.world.assist.invulnerable).toBe(true);
  });

  it('Water Mode floods the paused level at once', () => {
    const h = classic();
    h.settings.classicCheats.unlocked.waterMode = true;
    const level = pausedRun(h);
    pick(h, 'Cheats');
    const page = h.top() as CheatsScene;
    h.idle(8);
    for (let i = 0; i < labels(page).indexOf('Water Mode'); i++) h.tap('down');
    h.tap('right');
    expect(level.world.cheats.waterMode).toBe(true);
  });

  it('is not offered under Campaign rules, where no cheat plays', () => {
    // O-12: Classic rules set to Current is developer mode's: the run starts there, and its
    // pause is a player's (dev mode off; developer mode's pause offers every cheat).
    // BUG-11: such a run is the dev START page's (Rules: Campaign, Mode: Classic run).
    const h = classic({ dev: true });
    h.game.devClassicGame(MARIO, '1-1', 'current');
    expect(h.game.liveRules).toBe('current');
    h.settings.dev = false;
    h.until(() => h.top() instanceof LevelScene, 600);
    h.idle(4);
    h.tap('start');
    expect(h.top()).toBeInstanceOf(PauseScene);
    expect(labels(h.top())).not.toContain('Cheats');
  });
});

describe('G-093 the Classic guide', () => {
  it('the Classic pause opens the Classic hero’s own page', () => {
    const h = classic();
    pausedRun(h, LINK);
    pick(h, 'Guide');
    expect(h.top()).toBeInstanceOf(GuideScene);
    const g = h.top() as unknown as { def: { rules?: string; id: string } };
    expect(g.def.id).toBe('link');
    expect(g.def.rules).toBe('classic');
  });

  it('How to play from the Classic menus lists the Classic select’s heroes, as Classic defs', () => {
    const h = classic();
    h.game.showClassicMenu();
    expect(h.game.liveRules).toBe('current');
    h.game.scenes.push(new OptionsScene(h.game, () => h.game.scenes.pop(), false, true));
    pick(h, 'How to play');
    const idx = h.top() as GuideIndexScene;
    expect(idx).toBeInstanceOf(GuideIndexScene);
    const names = labels(idx).filter((l) => l !== 'Back');
    const slots = h.game.slotsFor('classic');
    expect(names).toHaveLength(slots.length);
    // The Classic select's heroes: Bass is one (Classic only), no campaign-only extras.
    expect(names).toContain('Bass');
    // Picking one opens its Classic page.
    pick(h, names[0] as string);
    expect((h.top() as unknown as { def: { rules?: string } }).def.rules).toBe('classic');
  });

  it('#179: from Classic > Options > Video, audio, controls: the Classic select’s heroes, with Expansion off and on; a look (Peach) is its slot (Luigi)', () => {
    const open = (expansion: 'on' | 'off', skins?: Record<string, string>) => {
      // O-12: the Expansion heroes row is developer mode's until a hero is released.
      const h = classic({ ...(skins ? { classicSkins: skins } : {}), dev: true });
      h.settings.classic = { ...h.settings.classic, expansion };
      // O-06: in dev mode an unreleased Expansion hero shows only with Dev > Classic heroes' On.
      if (expansion === 'on') h.settings.classicDev.heroesOn = ['vicviper', 'warriors', 'arthur', 'yoshi'];
      h.game.showClassicMenu();
      h.game.scenes.push(new OptionsScene(h.game, () => h.game.scenes.pop(), false, true));
      pick(h, 'How to play');
      return labels(h.top()).filter((l) => l !== 'Back');
    };
    const off = open('off');
    expect(off).toEqual([
      'Mario',
      'Luigi',
      'Link',
      'Samus',
      'Simon',
      'Mega Man',
      'Bass',
      'Bill',
      'Ryu',
      'Sophia III',
    ]);
    const on = open('on');
    expect(on.slice(0, off.length)).toEqual(off);
    // The Expansion heroes (the ones the original never had) follow the original's ten.
    expect(on.length).toBeGreaterThan(off.length);
    expect(on).toContain('Yoshi');
    const peach = open('off', { luigi: 'peach' });
    expect(peach).toEqual(off);
    expect(peach).not.toContain('Peach');
  });

  it('a saved Campaign rules setting is ignored (BUG-11): it lists the Classic heroes', () => {
    const h = classic({ classicRules: 'current', dev: true });
    h.game.showClassicMenu();
    h.game.scenes.push(new GuideIndexScene(h.game, () => h.game.scenes.pop(), true));
    const names = labels(h.top()).filter((l) => l !== 'Back');
    expect(names).toEqual(h.game.slotsFor('classic').map((c) => c.name));
  });

  it('the title’s How to play is unchanged (the campaign’s heroes)', () => {
    const h = classic();
    h.game.showTitle();
    h.game.scenes.push(new GuideIndexScene(h.game, () => h.game.scenes.pop()));
    const names = labels(h.top()).filter((l) => l !== 'Back');
    expect(names).toEqual(h.game.roster.map((c) => c.name));
  });
});
