import { afterEach, describe, expect, it } from 'vitest';
import {
  CLASSIC_CHEAT_IDS,
  defaultSettings,
  loadSettings,
  SETTINGS_KEY,
  type Settings,
} from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { CHEAT_GOALS, CHEATS, lockedText, unlockEarned } from '@game/cheats';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { CheatsScene, HIDDEN_CHEAT } from '@game/scenes/cheats-menu';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import { CARD_GUARD_FRAMES, CardScene } from '@game/scenes/message';
import { ClassicMenuScene, ClassicOptionsScene } from '@game/scenes/original-game';
import { PauseScene } from '@game/scenes/pause';
import { TitleScene } from '@game/scenes/title';
import { TITLE_TIMING } from '@game/scenes/title-anim';
import { HammerBro } from '@game/entities/enemies/hammer-bro';
import { DEV_CODE } from '@game/scenes/cheat';
import { draw, file, makeGame, store, useStorage, type H } from './heroes-harness';

// Classic mode's Cheats page and unlock goals (FU-7e; cheats.ts, scenes/cheats-menu.ts): the
// original's names, On/Off, ????? rows with their goals, Enter code; settings.classicCheats is its
// own key, deep-merged into old files; play in a Classic run (not a developer one) counts toward
// the goals and the unlocks are told; developer mode opens every cheat from the Classic pause;
// the campaign and Current rules never see a cheat.

useStorage();
afterEach(() => store.clear());

const labels = (m: unknown) => ((m as { items: MenuItem[] }).items ?? []).map((i) => i.label);
const items = (m: unknown) => (m as { items: MenuItem[] }).items;

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

function toCheats(h: H): CheatsScene {
  h.game.showTitle();
  h.idle(TITLE_TIMING.dropEnd + 10);
  expect(h.top()).toBeInstanceOf(TitleScene);
  pick(h, 'Classic');
  expect(h.top()).toBeInstanceOf(ClassicMenuScene);
  pick(h, 'Options');
  expect(h.top()).toBeInstanceOf(ClassicOptionsScene);
  pick(h, 'Cheats');
  expect(h.top()).toBeInstanceOf(CheatsScene);
  return h.top() as CheatsScene;
}

const inLevel = (h: H) => h.top() instanceof LevelScene;
const level = (h: H) => h.top() as LevelScene;

describe('settings.classicCheats', () => {
  it('defaults to the original: all off, only Everyone Can Stomp and Classic Scroll open', () => {
    const c = defaultSettings().classicCheats;
    expect(Object.values(c.on).every((v) => v === false)).toBe(true);
    expect(CLASSIC_CHEAT_IDS.filter((id) => c.unlocked[id])).toEqual([
      'classicScreenScroll',
      'everyoneCanStomp',
    ]);
    expect(Object.values(c.stats).every((v) => v === 0)).toBe(true);
    expect(c.beaten).toEqual({ smb: false, lost: false });
  });

  it('a file from before it gets the defaults; a partial one keeps its values (deep-merged)', () => {
    const old: Record<string, unknown> = { ...defaultSettings() };
    delete old.classicCheats;
    store.set(SETTINGS_KEY, JSON.stringify(old));
    expect(loadSettings().classicCheats).toEqual(defaultSettings().classicCheats);
    store.set(
      SETTINGS_KEY,
      JSON.stringify({
        ...defaultSettings(),
        classicCheats: { on: { waterMode: true }, stats: { bricksBroken: 12.7, enemiesStomped: -3 } },
      }),
    );
    const s = loadSettings().classicCheats;
    expect(s.on.waterMode).toBe(true);
    expect(s.on.invincible).toBe(false);
    expect(s.unlocked.everyoneCanStomp).toBe(true);
    expect(s.stats.bricksBroken).toBe(12);
    expect(s.stats.enemiesStomped).toBe(0);
  });
});

describe('the Cheats page', () => {
  it('in CLASSIC > Options: open cheats with On/Off, locked ones as ????? with their goal', () => {
    const h = classic();
    const page = toCheats(h);
    expect(h.said.at(-1)).toMatch(/^Cheats\./);
    const l = labels(page);
    expect(l).toHaveLength(CHEATS.length + 2);
    expect(l.filter((x) => x === HIDDEN_CHEAT)).toHaveLength(CHEATS.length - 2);
    expect(l).toContain('Everyone Can Stomp');
    expect(l).toContain('Classic Scroll');
    expect(l.at(-2)).toBe('Enter code');
    expect(l.at(-1)).toBe('Back');
    // Drawn: the locked rows' question marks, the open rows' value.
    const t = draw(page).texts.map((x) => x.str);
    expect(t).toContain(HIDDEN_CHEAT);
    // A locked row is read as a locked cheat with its goal and its count, never as "?????".
    h.idle(8);
    h.tap('down');
    expect(h.said.at(-1)).toBe(
      `Locked cheat. Beat The Lost Levels.`, // All Hammer Bros
    );
    h.tap('down');
    expect(h.said.at(-1)).toBe(
      `Locked cheat. Beat the game once and defeat ${CHEAT_GOALS.armouredDefeated} armored enemies. Current count: 0.`,
    );
    // Picking it shows the goal on a card until OK.
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(CardScene);
    expect((h.top() as CardScene).lines.join(' ')).toMatch(/TO UNLOCK THIS CHEAT/);
    expect(h.said.at(-1)).toMatch(/^To unlock this cheat: Beat the game once/);
    h.idle(CARD_GUARD_FRAMES + 1);
    h.tap('jump');
    expect(h.top()).toBe(page);
  });

  it('toggling an open cheat saves it and reads it out', () => {
    const h = classic();
    const page = toCheats(h);
    h.idle(8);
    const at = labels(page).indexOf('Everyone Can Stomp');
    for (let i = 0; i < at; i++) h.tap('down');
    h.tap('jump');
    expect(h.settings.classicCheats.on.everyoneCanStomp).toBe(true);
    expect(h.said.at(-1)).toBe('Everyone Can Stomp: On. Every hero can stomp enemies');
    expect(JSON.parse(store.get(SETTINGS_KEY) as string).classicCheats.on.everyoneCanStomp).toBe(true);
    h.tap('left');
    expect(h.settings.classicCheats.on.everyoneCanStomp).toBe(false);
    expect(h.said.at(-1)).toMatch(/^Everyone Can Stomp: Off/);
    // A locked cheat cannot be turned on from here.
    const water = items(page).find((i) => i.hint?.includes('cheep cheeps'));
    expect(water?.adjust).toBeUndefined();
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(ClassicOptionsScene);
  });

  it("Enter code: the original's code unlocks every cheat; a wrong press ends it", () => {
    const h = classic();
    const page = toCheats(h);
    h.idle(8);
    for (let i = 0; i < labels(page).indexOf('Enter code'); i++) h.tap('down');
    h.tap('jump');
    expect(h.said.at(-1)).toBe('Enter the code.');
    h.tap('up');
    h.tap('left');
    expect(h.said.at(-1)).toBe('Wrong code.');
    expect(h.settings.classicCheats.unlocked.waterMode).toBe(false);
    h.tap('jump'); // Enter code again (the cursor stayed on it)
    for (const a of DEV_CODE) h.tap(a);
    expect(h.said.at(-1)).toBe('Every cheat is unlocked.');
    expect(CLASSIC_CHEAT_IDS.every((id) => h.settings.classicCheats.unlocked[id])).toBe(true);
    expect(labels(page)).not.toContain(HIDDEN_CHEAT);
    expect(labels(page)).not.toContain('Enter code');
  });

  it('the Classic pause has no Cheats row; in developer mode it opens every cheat, live', () => {
    const h = classic();
    h.game.classicGame(MARIO);
    h.until(() => inLevel(h), 600);
    h.idle(4);
    h.tap('start');
    expect(labels(h.top())).not.toContain('Cheats');
    const d = classic({ dev: true });
    d.game.classicGame(MARIO);
    d.until(() => inLevel(d), 600);
    const world = level(d).world;
    d.idle(4);
    d.tap('start');
    expect(d.top()).toBeInstanceOf(PauseScene);
    pick(d, 'Cheats');
    const page = d.top() as CheatsScene;
    expect(page).toBeInstanceOf(CheatsScene);
    expect(labels(page)).not.toContain(HIDDEN_CHEAT);
    expect(labels(page)).not.toContain('Enter code');
    expect(draw(page).texts.map((x) => x.str)).toContain('DEV MODE: ALL CHEATS');
    // Water Mode floods the paused level at once; Invincible holds from the next hit.
    d.idle(8);
    for (let i = 0; i < labels(page).indexOf('Water Mode'); i++) d.tap('down');
    d.tap('jump');
    expect(d.settings.classicCheats.on.waterMode).toBe(true);
    expect(world.cheats.waterMode).toBe(true);
    expect(world.waterTop).toBeLessThan(0);
    // Still locked outside developer mode: a toggle in dev mode never unlocks it.
    expect(d.settings.classicCheats.unlocked.waterMode).toBe(false);
  });
});

describe('cheats are Classic only', () => {
  it('play under them only in a Classic run under Classic rules', () => {
    const h = classic();
    h.settings.classicCheats.on.invincible = true;
    expect(h.game.ctx.classicCheats).toBeUndefined();
    h.game.classicGame(MARIO);
    expect(h.game.ctx.classicCheats?.invincible).toBe(true);
    h.game.showTitle();
    expect(h.game.ctx.classicCheats).toBeUndefined();
    // Classic mode under Current rules: no cheats.
    h.settings.classicRules = 'current';
    h.game.classicGame(MARIO);
    expect(h.game.ctx.classicCheats).toBeUndefined();
    // Free play with Classic rules (dev Level select's Free play): no cheats.
    h.game.newGame(MARIO, '1-1', null, { rules: 'classic' });
    expect(h.game.ctx.classicCheats).toBeUndefined();
  });

  it('a campaign file never has them, whatever is on', () => {
    const h = classic();
    for (const id of CLASSIC_CHEAT_IDS) h.settings.classicCheats.on[id] = true;
    file();
    h.game.openFile(1);
    expect(h.game.campaign).not.toBeNull();
    expect(h.game.ctx.classicCheats).toBeUndefined();
    h.game.goToLevel('1-1', { mode: 'stand' });
    h.until(() => inLevel(h), 600);
    expect(level(h).world.cheats.invincible).toBe(false);
    expect(level(h).world.assist.invulnerable).toBe(false);
  });
});

describe('unlock goals', () => {
  it('a clear unlocks Infinite Time, told on the select screen that follows', () => {
    const h = classic();
    h.game.classicGame(MARIO);
    h.until(() => inLevel(h), 600);
    level(h).world.events.push({ type: 'exit', next: '1-2' });
    h.step();
    expect(h.settings.classicCheats.unlocked.infiniteTime).toBe(true);
    expect(h.settings.classicCheats.unlocked.extraCheckpoints).toBe(false);
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    expect(h.said.at(-1)).toMatch(/You unlocked the Infinite Time cheat!$/);
    const t = draw(h.top() as CharacterSelectScene).texts.map((x) => x.str);
    expect(t).toContain('CHEAT UNLOCKED!');
    expect(t).toContain('INFINITE TIME');
    expect(h.game.cheatUnlocks).toEqual([]);
    expect(JSON.parse(store.get(SETTINGS_KEY) as string).classicCheats.unlocked.infiniteTime).toBe(true);
  });

  it("a castle's clear unlocks Extra Checkpoints", () => {
    const h = classic();
    h.game.classicGame(MARIO, '1-4');
    h.until(() => inLevel(h), 600);
    level(h).world.events.push({ type: 'exit', next: '2-1' });
    h.step();
    expect(h.settings.classicCheats.unlocked.extraCheckpoints).toBe(true);
  });

  it('a developer-started Classic run counts for nothing', () => {
    const h = classic({ dev: true });
    h.game.devClassicGame(MARIO, '1-1', 'classic');
    h.until(() => inLevel(h), 600);
    level(h).world.events.push({ type: 'exit', next: '1-2' });
    h.step();
    expect(h.settings.classicCheats.unlocked.infiniteTime).toBe(false);
  });

  it('the 50th Hammer Bro unlocks Evil Hammer Bros mid-level: its card over the frozen level', () => {
    const h = classic();
    h.settings.classicCheats.stats.hammerBrosDefeated = CHEAT_GOALS.hammerBrosDefeated - 1;
    h.game.classicGame(MARIO);
    h.until(() => inLevel(h), 600);
    const w = level(h).world;
    const hb = new HammerBro(w.player.body.x + 4096 * 64, w.player.body.y);
    w.spawn(hb);
    hb.hit({ kind: 'star', amount: 1, owner: w.player, dirX: 1 }, w);
    h.step();
    h.step();
    expect(h.settings.classicCheats.stats.hammerBrosDefeated).toBe(CHEAT_GOALS.hammerBrosDefeated);
    expect(h.settings.classicCheats.stats.enemiesDefeated).toBe(1);
    expect(h.settings.classicCheats.unlocked.evilHammerBros).toBe(true);
    expect(h.top()).toBeInstanceOf(CardScene);
    expect((h.top() as CardScene).lines).toEqual(['YOU UNLOCKED', 'EVIL HAMMER BROS', 'CHEAT!']);
    expect(h.said.at(-1)).toBe('You unlocked the Evil Hammer Bros cheat! OK to continue.');
    h.idle(CARD_GUARD_FRAMES + 1);
    h.tap('jump');
    expect(inLevel(h)).toBe(true);
  });

  it('beating a game: the counted goals, Super Mario Bros., and no continue (beatGameHandler)', () => {
    const c = defaultSettings().classicCheats;
    c.stats.enemiesStomped = CHEAT_GOALS.enemiesStomped;
    c.stats.bricksBroken = 5;
    // Not beaten yet: a count alone unlocks nothing that needs a beaten game.
    expect(unlockEarned(c)).toEqual([]);
    c.beaten.smb = true;
    expect(unlockEarned(c, { noContinue: true })).toEqual([
      'allGroundIsBricks',
      'bouncyPits',
      'infiniteLives',
    ]);
    expect(lockedText(c, 'alwaysBreakBricks')).toMatch(/Current count: 5\.$/);
    c.beaten.lost = true;
    expect(unlockEarned(c)).toEqual(['allHammerBros']);
  });

  it("a continue in the run keeps Infinite Lives locked at the game's end", () => {
    const h = classic();
    h.game.classicGame(MARIO);
    h.game.continueGame('1-1');
    h.game.cheatEvent({ beat: 'smb' });
    expect(h.settings.classicCheats.unlocked.allGroundIsBricks).toBe(true);
    expect(h.settings.classicCheats.unlocked.infiniteLives).toBe(false);
    const g = classic();
    g.game.classicGame(MARIO);
    g.game.cheatEvent({ beat: 'smb' });
    expect(g.settings.classicCheats.unlocked.infiniteLives).toBe(true);
    expect(g.game.cheatUnlocks).toEqual(['allGroundIsBricks', 'infiniteLives']);
  });
});
