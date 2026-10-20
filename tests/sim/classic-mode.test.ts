import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { px } from '@engine/math/units';
import { loadProgress, saveProgress } from '@engine/save/progress';
import { defaultSettings, loadSettings, SETTINGS_KEY, type Settings } from '@engine/save/settings';
import type { CharacterDef } from '@game/characters/character';
import { CHARACTERS, CLASSIC_EXTRAS } from '@game/characters/registry';
import { LINK } from '@game/characters/link';
import { MARIO } from '@game/characters/mario';
import { Bowser } from '@game/entities/enemies/bowser';
import { Captive } from '@game/entities/objects/captive';
import { HeroItem } from '@game/entities/objects/hero-item';
import { LockedDoor } from '@game/entities/objects/keys';
import { Partner } from '@game/entities/objects/partner';
import type { LevelData } from '@game/level/schema';
import { SELECT_GRID } from '@game/scenes/select-grid';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { CreditsScene } from '@game/scenes/credits';
import { DevLevelSelectScene } from '@game/scenes/dev-level-select';
import { FileSelectScene } from '@game/scenes/file-select';
import { GAME_OVER_CARD_FRAMES, GameOverScene } from '@game/scenes/game-over';
import { IntroScene } from '@game/scenes/intro';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import type { CardScene } from '@game/scenes/message';
import { CARD_GUARD_FRAMES, MessageScene } from '@game/scenes/message';
import { reconcileRules } from '@game/rules/reconcile';
import { ClassicMenuScene, ClassicOptionsScene } from '@game/scenes/original-game';
import { PauseScene } from '@game/scenes/pause';
import { TitleScene } from '@game/scenes/title';
import { TITLE_TIMING } from '@game/scenes/title-anim';
import { WorldMapScene } from '@game/scenes/world-map';
import type { Renderer } from '@engine/gfx/renderer';
import { draw, file, makeGame, store, useStorage, type H } from './heroes-harness';
import { isolateClassicRegistry } from './classic-registry';

// Every test gets the Classic registry back as it found it (tests/sim/classic-registry.ts). The
// built Classic-only extras are hidden: these tests use stand-ins (each extra has its own file).
isolateClassicRegistry({ hideExtras: true });

// Classic mode (title > CLASSIC): the original game, with none of the campaign's additions. No
// campaign file is opened or written; deaths and continues go through character select as in
// the original; warp zones go where the original's go; 8-4 ends with the original ending, then
// the title. Every map set is offered from the start (0.5.0, owner decision D3).

useStorage();

const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const labels = (s: unknown) => items(s).map((i) => i.label);

/** Highlight `label` on the menu on top and pick it. */
function pick(h: H, label: string): void {
  const menu = h.top() as MenuScene;
  const row = items(menu).findIndex((i) => i.label === label);
  expect(row, label).toBeGreaterThanOrEqual(0);
  h.idle(8);
  const at = () => (menu as unknown as { index: number }).index;
  for (let i = 0; i < 20 && at() !== row; i++) h.tap('down');
  h.tap('jump');
}

function classic(over: Partial<Settings> = {}): H & { settings: Settings } {
  const settings = { ...defaultSettings(), ...over };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}

/** The finished title, then CLASSIC. */
function toClassicMenu(h: H): ClassicMenuScene {
  h.game.showTitle();
  h.idle(TITLE_TIMING.dropEnd + 10);
  expect(h.top()).toBeInstanceOf(TitleScene);
  pick(h, 'Classic');
  expect(h.top()).toBeInstanceOf(ClassicMenuScene);
  return h.top() as ClassicMenuScene;
}

/** On a select screen: step right to hero `def` and confirm. */
function choose(h: H, def: CharacterDef): void {
  const sel = h.top();
  expect(sel).toBeInstanceOf(CharacterSelectScene);
  h.idle(12);
  // One more step than heroes: Classic mode's Random slot ends the ring (FU-4).
  // Classic mode's select says the hero, then its game (the name box): "Link, The Legend of Zelda".
  const said = () => h.said.at(-1)?.split(', ')[0];
  for (let i = 0; i <= CHARACTERS.length && said() !== def.name; i++) h.tap('right');
  expect(said()).toBe(def.name);
  h.tap('jump');
}

const level = (h: H) => h.top() as LevelScene;
const inLevel = (h: H) => h.top() instanceof LevelScene;

/** Into the level through its WORLD card. */
function enterLevel(h: H): LevelScene {
  h.until(() => inLevel(h), 600);
  return level(h);
}

function die(h: H): void {
  const w = enterLevel(h).world;
  w.kill(w.player);
  h.until(() => !inLevel(h), 400);
}

/** Every save file key and value in storage (Classic mode never writes one). */
const saveFiles = () => [...store.entries()].filter(([k]) => k.startsWith('smbc.save'));

/** No campaign-only entity is awake in the level. */
function noCampaignEntities(l: LevelScene): void {
  const e = l.world.entities;
  expect(e.some((x) => x instanceof Captive)).toBe(false);
  expect(e.some((x) => x instanceof Partner)).toBe(false);
  expect(e.some((x) => x instanceof HeroItem)).toBe(false);
  expect(e.some((x) => x instanceof LockedDoor)).toBe(false);
}

/** Where a level's exit leads: its own exit, else the first one reached through its own areas. */
function exitOf(id: string): string {
  const main = getLevel(id);
  const seen = new Set([id]);
  const queue = [id];
  while (queue.length) {
    const l: LevelData = getLevel(queue.shift() as string);
    for (const z of l.zones) {
      if (z.kind === 'exit') return z.next;
      const to = z.kind === 'pipe' || z.kind === 'vine' ? z.target.level : null;
      if (!to || seen.has(to)) continue;
      let t: LevelData;
      try {
        t = getLevel(to);
      } catch {
        continue;
      }
      if (t.world !== main.world || t.stage !== main.stage) continue;
      seen.add(to);
      queue.push(to);
    }
  }
  throw new Error(`${id}: no exit`);
}

describe('the title and the CLASSIC menu', () => {
  it('CLASSIC comes right after Start game, with a hint free of level numbers', () => {
    const h = classic();
    h.game.showTitle();
    const title = h.top() as TitleScene;
    expect(labels(title).slice(0, 4)).toEqual(['Start game', 'Classic', 'Custom levels', 'Options']);
    const it = items(title)[1] as MenuItem;
    expect(it.hint).toBeTruthy();
    expect(it.hint).not.toMatch(/\d/);
    // Without dev mode: four rows where main's three were (x 80, from y 96, 12 px apart).
    h.idle(TITLE_TIMING.dropEnd + 10);
    const four = draw(h.top() as TitleScene).texts.filter((t) =>
      labels(h.top()).some((l) => l.toUpperCase() === t.str),
    );
    const last = (str: string) => four.filter((t) => t.str === str).at(-1);
    ['START GAME', 'CLASSIC', 'CUSTOM LEVELS', 'OPTIONS'].forEach((str, i) =>
      expect(last(str)).toMatchObject({ x: 80, y: 96 + i * 12 }),
    );
    // Five rows with Dev mode: the usual 12 px step, every row above the credits.
    h.settings.dev = true;
    h.game.showTitle();
    h.idle(TITLE_TIMING.dropEnd + 10);
    const rows = draw(h.top() as TitleScene).texts.filter((t) =>
      labels(h.top()).some((l) => l.toUpperCase() === t.str),
    );
    expect(rows.length).toBeGreaterThanOrEqual(5);
    for (const r of rows) expect(r.y + 8).toBeLessThanOrEqual(148 - 4);
    // (shadows draw 1 px right and down)
    const ys = [...new Set(rows.filter((r) => r.x === 64).map((r) => r.y))].sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) expect((ys[i] as number) - (ys[i - 1] as number)).toBe(12);
    // Clear of CHAPTER 1 above.
    expect(ys[0]).toBeGreaterThanOrEqual(70 + 8 + 4);
  });

  it('the menu: Super Mario Bros., The Lost Levels, Options, Back; each line is announced', () => {
    const h = classic();
    const menu = toClassicMenu(h);
    expect(labels(menu)).toEqual([
      'Super Mario Bros.',
      'The Lost Levels',
      'Map difficulty',
      'Options',
      'Back',
    ]);
    expect(h.said.at(-1)).toMatch(/^Classic\. The original game\. Super Mario Bros\./);
    h.idle(8);
    for (const l of ['The Lost Levels', 'Map difficulty', 'Options', 'Back', 'Super Mario Bros.']) {
      h.tap('down');
      expect(h.said.at(-1)?.startsWith(l)).toBe(true);
    }
    for (const it of items(menu)) expect(`${it.label} ${it.hint ?? ''}`).not.toMatch(/\d-\d/);
    // Back (and BACK) returns to the title.
    pick(h, 'Back');
    expect(h.top()).toBeInstanceOf(TitleScene);
  });

  it('The Lost Levels are offered from the start (G-003, D3)', () => {
    const h = classic();
    expect(labels(toClassicMenu(h))).toEqual([
      'Super Mario Bros.',
      'The Lost Levels',
      'Map difficulty',
      'Options',
      'Back',
    ]);
    pick(h, 'The Lost Levels');
    choose(h, MARIO);
    const l = enterLevel(h);
    expect(l.level.id).toBe('ll-1-1');
    expect(h.game.classicRun).toBe(true);
    expect(h.game.campaign).toBeNull();
  });

  it('Options: Classic rules (Classic SMBC / Current), saved in settings, then every other option', () => {
    const h = classic();
    toClassicMenu(h);
    pick(h, 'Options');
    const opts = h.top() as ClassicOptionsScene;
    expect(opts).toBeInstanceOf(ClassicOptionsScene);
    expect(labels(opts)).toEqual([
      'Classic rules',
      'Game mode',
      'More settings',
      'Weapons',
      'Cheats',
      'All options',
      'Back',
    ]);
    expect(h.said.at(-1)).toMatch(/^Classic options\. Classic rules: Classic SMBC\./);
    // Drawn in full: the label, and the value right-aligned on its row.
    let t = draw(opts).texts.map((x) => x.str);
    expect(t).toContain('CLASSIC RULES');
    expect(t).toContain('CLASSIC SMBC');
    h.idle(8);
    h.tap('right');
    expect(h.settings.classicRules).toBe('current');
    expect(h.said.at(-1)).toMatch(/^Classic rules: Current/);
    t = draw(opts).texts.map((x) => x.str);
    expect(t).toContain('CURRENT');
    h.tap('jump');
    expect(h.settings.classicRules).toBe('classic');
    pick(h, 'All options');
    expect(labels(h.top())).toContain('Video');
    h.idle(8);
    h.tap('attack');
    expect(h.top()).toBe(opts);
    pick(h, 'Back');
    expect(h.top()).toBeInstanceOf(ClassicMenuScene);
  });

  it('settings: classicRules defaults to classic, survives a reload, and bad values fall back', () => {
    expect(defaultSettings().classicRules).toBe('classic');
    store.set(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), classicRules: 'current' }));
    expect(loadSettings().classicRules).toBe('current');
    store.set(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), classicRules: 'turbo' }));
    expect(loadSettings().classicRules).toBe('classic');
    const old: Record<string, unknown> = { ...defaultSettings() };
    delete old.classicRules;
    store.set(SETTINGS_KEY, JSON.stringify(old));
    expect(loadSettings().classicRules).toBe('classic');
  });
});

describe('a Classic run', () => {
  it('every hero can be picked (a campaign file freeing only Mario changes nothing), then WORLD 1-1', () => {
    file();
    const before = saveFiles();
    const h = classic();
    toClassicMenu(h);
    pick(h, 'Super Mario Bros.');
    const sel = h.top() as CharacterSelectScene;
    expect(sel).toBeInstanceOf(CharacterSelectScene);
    const t = draw(sel).texts.map((x) => x.str);
    expect(t).not.toContain('???');
    expect(t.some((s) => s.includes('TO FIND'))).toBe(false);
    h.idle(12);
    const names: string[] = [];
    // Every hero, and the Random slot that ends the ring (FU-4).
    for (let i = 0; i <= CHARACTERS.length; i++) {
      h.tap('right');
      names.push(h.said.at(-1)?.split(', ')[0] ?? '');
    }
    expect(new Set(names)).toEqual(new Set([...CHARACTERS.map((c) => c.name), 'Random']));
    choose(h, LINK);
    expect(h.top()).toBeInstanceOf(IntroScene);
    expect(h.said.at(-1)).toMatch(/^World 1-1\. 3 lives\.$/);
    const l = enterLevel(h);
    expect(l.level.id).toBe('1-1');
    const g = h.game;
    expect(g.campaign).toBeNull();
    expect(g.classicRun).toBe(true);
    expect(g.runRules).toBe('classic');
    expect(g.state.character).toBe(LINK);
    expect(g.state.lives).toBe(3);
    expect(g.state.campaignOrder).toBe(false);
    // The level as it is: no campaign variant (its look, its decor), no story, no captives.
    expect(l.level).toBe(getLevel('1-1'));
    expect(l.level.theme).toBe('overworld');
    expect(l.world.storyMode).toBe(false);
    expect(l.world.captives).toBeNull();
    noCampaignEntities(l);
    expect(saveFiles()).toEqual(before);
  });

  it.each(['2-1', '3-1', '4-2', '7-3', '8-4'])(
    '%s plays as the original: no campaign look, decor, partners or airship',
    (id) => {
      const h = classic();
      h.game.classicGame(MARIO, id);
      const l = enterLevel(h);
      const raw = getLevel(l.level.id);
      expect(l.level).toBe(raw);
      expect(l.world.level.theme).toBe(raw.theme);
      expect(l.world.storyMode).toBe(false);
      expect(l.world.entities.some((e) => e.kind === 'anchor-drop')).toBe(false);
      noCampaignEntities(l);
      expect(h.game.airship).toBeNull();
    },
  );

  it('plays Current rules when Options says so', () => {
    const h = classic({ classicRules: 'current' });
    h.game.classicGame(MARIO);
    expect(h.game.runRules).toBe('current');
    expect(h.game.classicRun).toBe(true);
  });

  it('a death goes to character select (no RETURN TO MAP), then the level again', () => {
    const h = classic();
    h.game.classicGame(MARIO);
    die(h);
    const sel = h.top();
    expect(sel).toBeInstanceOf(CharacterSelectScene);
    expect(draw(sel as CharacterSelectScene).texts.map((x) => x.str)).not.toContain('RETURN TO MAP');
    expect(h.game.state.lives).toBe(2);
    choose(h, LINK);
    const l = enterLevel(h);
    expect(l.level.id).toBe('1-1');
    expect(h.game.state.character).toBe(LINK);
    expect(h.game.classicRun).toBe(true);
  });

  it('game over: CONTINUE, character select, then the first level of the world, from 3 lives', () => {
    const h = classic();
    h.game.classicGame(MARIO, '1-3');
    enterLevel(h);
    h.game.state.lives = 1;
    h.game.state.score = 900;
    die(h);
    expect(h.top()).toBeInstanceOf(GameOverScene);
    h.idle(GAME_OVER_CARD_FRAMES);
    h.tap('jump'); // YES
    choose(h, LINK);
    const l = enterLevel(h);
    expect(l.level.id).toBe('1-1');
    expect(h.game.state.lives).toBe(3);
    expect(h.game.state.score).toBe(0);
    expect(h.game.classicRun).toBe(true);
  });

  it("1-2's warp zone has the original three pipes; 4-1's goes through character select into 4-1", () => {
    const h = classic();
    h.game.classicGame(LINK, '1-2');
    const l = enterLevel(h);
    expect(l.level.id).toBe('1-2');
    const pipes = l.level.zones.filter((z) => z.kind === 'pipe');
    const targets = pipes.map((z) => (z.kind === 'pipe' ? z.target.level : ''));
    expect(targets).toEqual(expect.arrayContaining(['2-1', '3-1', '4-1']));
    expect(pipes.some((z) => z.kind === 'pipe' && z.target.secret)).toBe(false);
    const four = pipes.find((z) => z.kind === 'pipe' && z.target.level === '4-1');
    if (four?.kind !== 'pipe') throw new Error('no 4-1 pipe');
    l.world.events.push({ type: 'pipe', target: { ...four.target } });
    h.step();
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    choose(h, LINK);
    const to = enterLevel(h);
    expect(to.level.id).toBe('4-1');
    expect(h.game.state.warped).toBe(true);
    expect(h.game.mapProgress.cleared).toEqual([]);
    noCampaignEntities(to);
  });

  it('plays 1-1 to 8-4 in the original order (no campaign order, no map)', () => {
    const h = classic();
    h.game.classicGame(MARIO);
    const order: string[] = [];
    for (let n = 0; n < 40; n++) {
      // F2: each clear goes through character select (the original's All Characters mode).
      h.until(
        () => inLevel(h) || h.top() instanceof CreditsScene || h.top() instanceof CharacterSelectScene,
        600,
      );
      if (h.top() instanceof CharacterSelectScene) {
        h.idle(12);
        h.tap('jump');
        h.until(() => inLevel(h) || h.top() instanceof CreditsScene, 600);
      }
      if (!inLevel(h)) break;
      const l = level(h);
      const ws = `${l.level.world}-${l.level.stage}`;
      if (order.at(-1) !== ws) order.push(ws);
      expect(h.game.state.campaignOrder).toBe(false);
      expect(l.world.storyMode).toBe(false);
      const main = l.level.parent ?? l.level.id;
      l.world.events.push({ type: 'exit', next: exitOf(main) });
      h.step();
      expect(h.top()).not.toBeInstanceOf(WorldMapScene);
    }
    const smb: string[] = [];
    for (let w = 1; w <= 8; w++) for (let s = 1; s <= 4; s++) smb.push(`${w}-${s}`);
    expect(order).toEqual(smb);
    expect(h.top()).toBeInstanceOf(CreditsScene);
  });

  it('no Bowser health bar in 8-4 (a campaign addition)', () => {
    const h = classic({ dev: true });
    h.game.ctx.assist.invulnerable = true;
    h.game.devStart('8-4-end', MARIO, 'fire', false, undefined, { rules: 'classic', classic: true });
    const l = enterLevel(h);
    const w = l.world;
    const axe = l.level.entities.find((e) => e.type === 'axe') as { x: number; y: number };
    const p = w.player.body;
    p.x = px((axe.x - 9) * 16);
    w.camera.snapTo(p.x);
    for (let i = 0; i < 20 && !w.entities.some((e) => e instanceof Bowser); i++) h.step();
    const b = w.entities.find((e): e is Bowser => e instanceof Bowser);
    expect(b).toBeDefined();
    h.idle(30);
    b?.hit({ kind: 'fireball', amount: 1, owner: w.player, dirX: 1 }, w);
    h.step();
    expect(w.bossBar.shown).toBe(false);
    expect(w.storyMode).toBe(false);
  });

  it('8-4: the original ending and credits, then the title (G-004, D3)', () => {
    const h = classic();
    h.game.classicGame(MARIO, '8-4-end');
    const l = enterLevel(h);
    l.world.castleText = ['THANK YOU MARIO!', '', 'YOUR QUEST IS OVER.'];
    l.world.events.push({ type: 'exit', next: 'end' });
    h.step();
    const credits = h.top();
    expect(credits).toBeInstanceOf(CreditsScene);
    // The classic credits, not the campaign's "the story is not over" lines.
    expect(h.said.at(-1)).toBe('Credits.');
    h.until(() => (credits as CreditsScene).touchLabels().jump === 'OK', 6000);
    h.tap('jump');
    // The cheats the clear and the game unlocked (All Ground Is Bricks among them): a card each,
    // read out, then the title.
    const cards: string[] = [];
    for (let i = 0; i < 10 && h.top() instanceof MessageScene; i++) {
      cards.push(h.said.at(-1) ?? '');
      h.idle(CARD_GUARD_FRAMES + 2);
      h.tap('jump');
    }
    expect(cards).toContainEqual(expect.stringMatching(/^You unlocked the All Ground Is Bricks cheat!/));
    for (const c of cards) expect(c).not.toMatch(/\b(press|push)\s+[abc]\b/i);
    expect(h.top()).toBeInstanceOf(TitleScene);
    expect(loadProgress().classicBeat?.smb).toBe('normal');
    expect(saveFiles()).toEqual([]);
    expect(h.game.classicRun).toBe(false);
  });
});

describe('a dev-started Classic run records no beat status', () => {
  function beat84(h: H): void {
    const l = enterLevel(h);
    l.world.events.push({ type: 'exit', next: 'end' });
    h.step();
    const credits = h.top() as CreditsScene;
    expect(credits).toBeInstanceOf(CreditsScene);
    h.until(() => credits.touchLabels().jump === 'OK', 6000);
    h.tap('jump');
  }

  it.each(['level select', 'url'])(
    'started from the dev %s: 8-4 records nothing, the title follows',
    (from) => {
      const h = classic({ dev: true });
      if (from === 'url') h.game.devClassicGame(MARIO, '8-4-end', 'classic');
      else h.game.devStart('8-4-end', MARIO, 'small', false, undefined, { rules: 'classic', classic: true });
      expect(h.game.classicRun).toBe(true);
      expect(h.game.classicDev).toBe(true);
      beat84(h);
      expect(h.top()).toBeInstanceOf(TitleScene);
      expect(loadProgress().cleared).toEqual([]);
      expect(loadProgress().classicBeat?.smb).toBe('none');
    },
  );

  it('a title CLASSIC run after a dev one counts again', () => {
    const h = classic({ dev: true });
    h.game.devClassicGame(MARIO, '1-1', 'classic');
    h.game.showTitle();
    h.game.classicGame(MARIO, '8-4-end');
    expect(h.game.classicDev).toBe(false);
    beat84(h);
    expect(loadProgress().classicBeat?.smb).toBe('normal');
  });
});

describe('the CLASSIC tag: fully on screen, clear of every HUD line', () => {
  /** Boxes overlap (text cells are 8 px; `gap` px of air required between them). */
  const touches = (
    a: { x: number; y: number; str: string },
    b: { x: number; y: number; str: string },
    gap = 2,
  ) =>
    a.x < b.x + b.str.length * 8 + gap &&
    b.x < a.x + a.str.length * 8 + gap &&
    a.y < b.y + 8 + gap &&
    b.y < a.y + 8 + gap;

  function check(scene: { render(r: Renderer): void }): void {
    const t = draw(scene).texts;
    const tag = t.find((x) => x.str.startsWith('CLASSIC'));
    expect(tag).toBeDefined();
    if (!tag) return;
    expect(tag.y).toBeGreaterThanOrEqual(4);
    expect(tag.x + tag.str.length * 8).toBeLessThanOrEqual(256);
    for (const o of t)
      if (o !== tag && o.str.trim()) expect(touches(tag, o), `${tag.str} vs ${o.str}`).toBe(false);
  }

  it('one player: in the level and on the intro card', () => {
    const h = classic();
    h.game.classicGame(LINK);
    expect(h.top()).toBeInstanceOf(IntroScene);
    check(h.top() as IntroScene);
    check(enterLevel(h));
  });

  it("two players (a dev free play under Classic rules): under player two's lines", () => {
    const h = classic({ dev: true });
    h.game.newGame(MARIO, '1-1', LINK, { rules: 'classic' });
    expect(h.top()).toBeInstanceOf(IntroScene);
    check(h.top() as IntroScene);
    check(enterLevel(h));
  });
});

describe('QA nits', () => {
  it('free play keeps the NES wording on that card', () => {
    const h = classic();
    h.game.newGame(MARIO, 'll-8-4');
    const l = enterLevel(h);
    l.world.events.push({ type: 'exit', next: 'end' });
    h.step();
    expect((h.top() as CardScene).lines).toContain('PUSH BUTTON B');
  });

  it('game over, NO: a Classic run goes back to the CLASSIC menu; free play to the title', () => {
    for (const run of ['classic', 'free'] as const) {
      const h = classic();
      if (run === 'classic') h.game.classicGame(MARIO);
      else h.game.newGame(MARIO);
      enterLevel(h);
      h.game.state.lives = 1;
      die(h);
      expect(h.top()).toBeInstanceOf(GameOverScene);
      h.idle(GAME_OVER_CARD_FRAMES);
      h.tap('down'); // NO
      h.tap('jump');
      expect(h.top()).toBeInstanceOf(run === 'classic' ? ClassicMenuScene : TitleScene);
      expect(h.game.classicRun).toBe(false);
    }
  });

  it("a rules change resets player two's kit only when there is a player two", () => {
    const h = classic();
    h.game.newGame(MARIO, '1-1', null, { rules: 'current' });
    const s = h.game.state;
    s.kit2 = { keep: 1 };
    reconcileRules(h.game, 'classic');
    expect(s.rules).toBe('classic');
    expect(s.kit2).toEqual({ keep: 1 });
    // Rules unchanged: nothing is reset.
    s.kit = { tool: 2 };
    reconcileRules(h.game, 'classic');
    expect(s.kit).toEqual({ tool: 2 });
    // With a player two, a change resets both kits.
    h.game.newGame(MARIO, '1-1', LINK, { rules: 'current' });
    const t = h.game.state;
    t.kit = { a: 1 };
    t.kit2 = { b: 1 };
    reconcileRules(h.game, 'classic');
    expect(t.kit).toEqual({});
    expect(t.kit2).toEqual({});
  });
});

describe('the Classic pause menu', () => {
  it('Continue, Options, Quit to title (and every dev row with dev mode on)', () => {
    const h = classic();
    h.game.classicGame(MARIO);
    enterLevel(h);
    h.idle(4);
    h.tap('start');
    const pause = h.top() as PauseScene;
    expect(pause).toBeInstanceOf(PauseScene);
    expect(labels(pause)).toEqual(['Continue', 'Options', 'Quit to title']);
    pick(h, 'Quit to title');
    expect(h.top()).toBeInstanceOf(TitleScene);
    expect(h.game.classicRun).toBe(false);
    expect(h.game.runRules).toBe('current');

    const d = classic({ dev: true });
    d.game.classicGame(MARIO);
    enterLevel(d);
    d.idle(4);
    d.tap('start');
    // Every developer row free play or a campaign file's pause has in dev mode.
    expect(labels(d.top())).toEqual([
      'Continue',
      'Options',
      'Dev mode',
      'Assists',
      'Cheats',
      'Quit to title',
    ]);
  });
});

describe('dev Level select: Mode', () => {
  function devSelect(h: H): DevLevelSelectScene {
    const s = new DevLevelSelectScene(h.game, () => h.game.scenes.pop());
    h.game.scenes.push(s);
    return s;
  }

  it("a Mode row, Free play by default: today's dev start (99 lives, straight back after a death)", () => {
    const h = classic({ dev: true });
    const s = devSelect(h);
    expect(labels(s)).toEqual(['Level', 'Character', 'Power', 'Kit', 'Rules', 'Mode', 'Start', 'Back']);
    const mode = items(s)[5] as MenuItem;
    expect(mode.value?.()).toBe('Free play');
    pick(h, 'Start');
    enterLevel(h);
    expect(h.game.classicRun).toBe(false);
    expect(h.game.state.lives).toBe(99);
    die(h);
    expect(h.top()).not.toBeInstanceOf(CharacterSelectScene);
  });

  it("Classic run: the Classic flow (3 lives, character select after a death), the Rules row's rules", () => {
    const h = classic({ dev: true });
    const s = devSelect(h);
    const mode = items(s)[5] as MenuItem;
    (items(s)[4] as MenuItem).adjust?.(1); // Rules: Classic SMBC
    mode.adjust?.(1);
    expect(mode.value?.()).toBe('Classic run');
    pick(h, 'Start');
    enterLevel(h);
    expect(h.game.classicRun).toBe(true);
    expect(h.game.runRules).toBe('classic');
    expect(h.game.campaign).toBeNull();
    expect(h.game.state.lives).toBe(3);
    die(h);
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
  });
});

describe('the campaign is unaffected', () => {
  it('Start game still opens the file select; a file plays Current, never as a Classic run', () => {
    const h = classic();
    h.game.classicGame(MARIO);
    expect(h.game.classicRun).toBe(true);
    h.game.showTitle();
    h.idle(TITLE_TIMING.dropEnd + 10);
    pick(h, 'Start game');
    expect(h.top()).toBeInstanceOf(FileSelectScene);
    file();
    h.game.openFile(1);
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.game.classicRun).toBe(false);
    expect(h.game.runRules).toBe('current');
  });

  it('every other start ends a Classic run', () => {
    const h = classic();
    h.game.classicGame(MARIO);
    h.game.newGame(MARIO, '1-1', null, { rules: 'current' });
    expect(h.game.classicRun).toBe(false);
    const starts: Array<() => void> = [
      () => h.game.devStart('1-1', MARIO, 'small'),
      () => h.game.playShared(getLevel('1-1')),
      () => h.game.playtest(getLevel('1-1'), () => {}),
    ];
    for (const start of starts) {
      h.game.classicGame(MARIO);
      start();
      expect(h.game.classicRun).toBe(false);
      expect(h.game.runRules).toBe('current');
    }
  });

  it('the free (non-Classic) 8-4 ending still goes to the title', () => {
    const h = classic();
    h.game.newGame(MARIO, '8-4-end');
    const l = enterLevel(h);
    l.world.events.push({ type: 'exit', next: 'end' });
    h.step();
    const credits = h.top() as CreditsScene;
    h.until(() => credits.touchLabels().jump === 'OK', 6000);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(TitleScene);
    expect(loadProgress().cleared).toEqual([]);
  });
});

describe('the select screen: Classic extras on a second row', () => {
  // A stand-in Classic-only hero, registered as the extras will be (registry.ts CLASSIC_EXTRAS).
  const EXTRA: CharacterDef = { ...MARIO, id: 'extra', name: 'Extra', rules: 'classic' };
  beforeEach(() => void CLASSIC_EXTRAS.push(EXTRA));
  afterEach(() => void CLASSIC_EXTRAS.splice(CLASSIC_EXTRAS.indexOf(EXTRA), 1));

  it('offered on the FIRST Classic pick (title > CLASSIC > Super Mario Bros.), and playable', () => {
    const h = classic();
    toClassicMenu(h);
    pick(h, 'Super Mario Bros.');
    const sel = h.top() as CharacterSelectScene;
    expect(sel).toBeInstanceOf(CharacterSelectScene);
    expect(sel.chars).toContain(EXTRA);
    expect(h.game.heroLocked(EXTRA)).toBe(false);
    choose(h, EXTRA);
    enterLevel(h);
    expect(h.game.state.character).toBe(EXTRA);
  });

  it('also on the Lost Levels entry; never with Classic rules set to Current', () => {
    saveProgress({ ...loadProgress(), cleared: ['8-4'] });
    const h = classic();
    toClassicMenu(h);
    pick(h, 'The Lost Levels');
    expect((h.top() as CharacterSelectScene).chars).toContain(EXTRA);
    const c = classic({ classicRules: 'current' });
    toClassicMenu(c);
    pick(c, 'Super Mario Bros.');
    expect((c.top() as CharacterSelectScene).chars).not.toContain(EXTRA);
  });

  it('not offered in free play or on a campaign file', () => {
    const h = classic();
    h.game.showTitle();
    h.game.showCharacterSelect(); // custom levels' / free play's select
    expect((h.top() as CharacterSelectScene).chars).not.toContain(EXTRA);
    h.game.newGame(MARIO);
    die(h);
    expect((h.top() as CharacterSelectScene).chars).not.toContain(EXTRA);
    file();
    h.game.openFile(1);
    expect(h.game.roster).not.toContain(EXTRA);
    h.game.enterLevelFromMap('1-1');
    expect((h.top() as CharacterSelectScene).chars).not.toContain(EXTRA);
  });

  it('the original grid: the usual heroes fill the first row, extras the next; left and right walk the whole roster', () => {
    const h = classic();
    h.game.classicSelect('1-1', () => h.game.showClassicMenu());
    const sel = h.top() as CharacterSelectScene;
    expect(sel.firstRow).toBe(CHARACTERS.length);
    // Cells SELECT_GRID.cell px square, nine to a row (the original's CharacterSelectBox, fitted).
    const step = SELECT_GRID.cell + SELECT_GRID.gap;
    CHARACTERS.forEach((_, i) =>
      expect(sel.slot(i)).toEqual({
        x: SELECT_GRID.x + i * step + SELECT_GRID.cell / 2,
        y: SELECT_GRID.y + SELECT_GRID.cell,
      }),
    );
    // The second row: the extra, then the Random slot (FU-4).
    expect(sel.slot(CHARACTERS.length)).toEqual({
      x: SELECT_GRID.x + SELECT_GRID.cell / 2,
      y: SELECT_GRID.y + step + SELECT_GRID.cell,
    });
    h.idle(12);
    h.tap('left');
    expect(h.said.at(-1)).toBe('Random');
    h.tap('left');
    expect(h.said.at(-1)).toBe('Extra');
    const t = draw(sel).texts;
    // The name box names the hero.
    expect(t.some((x) => x.str === 'EXTRA')).toBe(true);
    for (const x of t) expect(x.y + 8).toBeLessThanOrEqual(240);
    h.tap('right');
    h.tap('right');
    expect(h.said.at(-1)?.split(', ')[0]).toBe(CHARACTERS[0]?.name);
  });

  it('Classic rules Current: the registry, in one row', () => {
    const h = classic({ classicRules: 'current' });
    h.game.classicSelect('1-1', () => h.game.showClassicMenu());
    const sel = h.top() as CharacterSelectScene;
    expect(sel.chars).toBe(CHARACTERS);
    expect(sel.firstRow).toBe(CHARACTERS.length);
    // BACK returns to the CLASSIC menu.
    h.idle(12);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(ClassicMenuScene);
  });
});

describe('one player only', () => {
  it('the Classic select offers no player two join, and the run is one player', () => {
    const h = classic();
    toClassicMenu(h);
    pick(h, 'Super Mario Bros.');
    const sel = h.top() as CharacterSelectScene;
    expect(h.said.at(-1)).not.toMatch(/Player two/);
    h.idle(12);
    h.tap('start', 1);
    expect(h.said.at(-1)).not.toBe('Player two joined.');
    for (let i = 0; i < 140; i++) {
      h.step();
      expect(draw(sel).texts.some((x) => x.str.includes('TO JOIN'))).toBe(false);
    }
    h.tap('jump');
    enterLevel(h);
    expect(h.game.state.character2).toBeNull();
  });
});

describe('newGame after a Classic run', () => {
  it('is never a Classic run; from the title it plays Current', () => {
    const h = classic();
    h.game.classicGame(MARIO);
    expect(h.game.liveRules).toBe('classic');
    h.game.newGame(MARIO);
    expect(h.game.classicRun).toBe(false);
    h.game.classicGame(MARIO);
    h.game.showTitle();
    h.game.newGame(MARIO);
    expect(h.game.classicRun).toBe(false);
    expect(h.game.liveRules).toBe('current');
  });
});

describe('dev Level select hides the campaign rooms for a Classic run', () => {
  it('Mode = Classic run lists no village or 1-0; Free play lists them again', () => {
    const h = makeGame({
      deps: { settings: { ...defaultSettings(), dev: true }, listLevels: () => ['1-0', '1-1', '1-2'] },
    });
    const s = new DevLevelSelectScene(h.game, () => {});
    h.game.scenes.push(s);
    const level = items(s)[0] as MenuItem;
    const mode = items(s).find((i) => i.label === 'Mode') as MenuItem;
    const all = (): string[] => {
      const seen: string[] = [];
      for (let i = 0; i < 6; i++) {
        seen.push(level.value?.() ?? '');
        level.adjust?.(1);
      }
      return [...new Set(seen)];
    };
    expect(all()).toEqual(['1-0', '1-1', '1-2', 'village']);
    for (let i = 0; i < 4 && level.value?.() !== '1-0'; i++) level.adjust?.(1);
    expect(level.value?.()).toBe('1-0');
    mode.adjust?.(1); // 1-0 is hidden: the row moves to 1-1
    expect(level.value?.()).toBe('1-1');
    expect(all().sort()).toEqual(['1-1', '1-2']);
    mode.adjust?.(1);
    expect(all()).toContain('village');
  });
});

describe('dev Classic runs skip the campaign rooms', () => {
  it.each(['1-0', 'village'])('%s starts 1-1 instead', (id) => {
    const h = classic({ dev: true });
    h.game.devStart(id, MARIO, 'small', false, undefined, { rules: 'classic', classic: true });
    expect(h.game.town).toBeNull();
    expect(h.game.tutorialRun).toBeNull();
    expect(enterLevel(h).level.id).toBe('1-1');
    expect(h.game.classicRun).toBe(true);
  });

  it('the URL start (?mode=classic) does too, one player', () => {
    const h = classic({ dev: true });
    h.game.devClassicGame(LINK, '1-0', 'classic');
    expect(enterLevel(h).level.id).toBe('1-1');
    expect(h.game.state.character2).toBeNull();
    expect(h.game.runRules).toBe('classic');
  });
});

describe('accessibility: the new menus name abilities, never button letters', () => {
  const LETTER = /\b(BUTTON )?[ABC]\b/;
  const PROSE =
    /\b(button|press|push|tap|hold)\s+[abc]\b|\([abc]\)|\b[abc]\s*:|\b(press|push|tap)\s+(start|select)\b/i;

  it('CLASSIC, CLASSIC OPTIONS, the Classic pause and the dev Mode row', () => {
    saveProgress({ ...loadProgress(), cleared: ['8-4'] });
    const h = classic({ dev: true });
    h.game.classicGame(MARIO);
    enterLevel(h);
    const menus: MenuScene[] = [
      new ClassicMenuScene(h.game),
      new ClassicOptionsScene(h.game, () => {}),
      new PauseScene(h.game, level(h).world),
      new DevLevelSelectScene(h.game, () => {}),
    ];
    for (const m of menus)
      for (const it of items(m)) {
        const text = [it.label, it.value?.() ?? '', it.hint ?? ''];
        for (const s of text) {
          expect(s.toUpperCase(), s).not.toMatch(LETTER);
          expect(s, s).not.toMatch(PROSE);
        }
      }
  });
});
