import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import {
  defaultSettings,
  loadSettings,
  saveSettings,
  SETTINGS_KEY,
  SETTINGS_VERSION,
} from '@engine/save/settings';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';
import { ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { TitleScene } from '@game/scenes/title';
import { MenuScene, type MenuItem } from '@game/scenes/menu';
import { OptionsScene } from '@game/scenes/options';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { TITLE_TIMING } from '@game/scenes/title-anim';
import { CHARACTERS } from '@game/characters/registry';
import { saveLibrary } from '@game/level/library';
import { CUSTOM_LEVEL_MISSING } from '@game/scenes/game';
import { MessageScene } from '@game/scenes/message';
import { QUIT_RUN_KEPT, QUIT_RUN_TITLE, QuitRunScene } from '@game/scenes/quit-run';
import { ClassicMenuScene } from '@game/scenes/original-game';
import { ClassicTitleScene } from '@game/scenes/original-title';
import { PauseScene } from '@game/scenes/pause';
import { LevelScene } from '@game/scenes/level';
import { GuideIndexScene } from '@game/scenes/guide';
import { ClassicOptionsScene } from '@game/scenes/original-game';
import { SaveFilesOptions } from '@game/scenes/save-codes';
import {
  OFFLINE_NOTICE_CLOSED_LINES,
  OFFLINE_NOTICE_LINES,
  STANDALONE_NOTICE_CLOSED_LINES,
  STANDALONE_NOTICE_LINES,
  titleNotice,
  type HomeScreenHooks,
} from '@game/pwa/home-screen';
import { CardScene } from '@game/scenes/message';
import { CHAPTER1_GATE_CARD, CHAPTER1_LINK_CARD } from '@game/scenes/chapter1-gate';

// The 0.5.0 RC's title and menus batch (docs/classic/RC_AUDIT_0.5.0.md, addendum O-01..O-16, and
// RC-005..RC-007): each block names the item it checks.

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

function makeGame(dev = false) {
  const said: string[] = [];
  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const settings = { ...defaultSettings(), dev };
  const sfx = vi.fn();
  const game = new Game({
    ctx: { assets, audio: { ...NULL_AUDIO, sfx }, assist: { ...DEFAULT_ASSIST }, reduceFlashing: false },
    getLevel,
    characters: CHARACTERS,
    settings,
    applySettings: () => {},
    announcer: { say: (t: string) => said.push(t) } as unknown as Announcer,
  });
  const p1 = new ScriptedInput({ steps: [] });
  const r = new NullRenderer();
  const step = (a: Action[] = []) => {
    p1.setHeld(a);
    p1.next();
    game.scenes.update([p1]);
    game.scenes.render(r);
  };
  const tap = (a: Action) => {
    step([a]);
    step();
  };
  const idle = (n: number) => {
    for (let i = 0; i < n; i++) step();
  };
  const top = () => game.scenes.top;
  return { game, said, step, tap, idle, top, settings, sfx };
}
type H = ReturnType<typeof makeGame>;

const items = (m: unknown) => (m as { items: MenuItem[] }).items;
const cursor = (m: unknown) => (m as { index: number }).index;
const labels = (m: unknown) => items(m).map((i) => i.label);

/** Move the open menu's cursor to `label` and press OK. */
function pick(h: H, label: string): void {
  h.idle(8);
  const m = h.top();
  const row = labels(m).indexOf(label);
  expect(row, `${label} in ${labels(m).join(', ')}`).toBeGreaterThanOrEqual(0);
  for (let n = 0; cursor(h.top()) !== row && n < 40; n++) h.tap('down');
  h.tap('jump');
}

/** The finished title. */
function title(h: H): TitleScene {
  h.game.showTitle();
  h.idle(TITLE_TIMING.dropEnd + 10);
  return h.top() as TitleScene;
}

/** Every string drawn this frame. */
function drawn(h: H): string[] {
  const out: string[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    text(_f: SpriteSheet, str: string): void {
      out.push(str);
    },
  });
  h.game.scenes.render(r);
  return out;
}

describe('O-01: Custom levels moves from the title into Options', () => {
  it('the title has no Custom levels row; its Options lists Custom levels next to Level editor', () => {
    const h = makeGame();
    const t = title(h);
    expect(labels(t)).not.toContain('Custom levels');
    expect(drawn(h)).not.toContain('CUSTOM LEVELS');
    pick(h, 'Options');
    const o = labels(h.top());
    expect(h.top()).toBeInstanceOf(OptionsScene);
    expect(o.indexOf('Custom levels')).toBeGreaterThan(-1);
    expect(o.indexOf('Custom levels')).toBe(o.indexOf('Level editor') - 1);
  });

  it('it opens over Options and Back returns to Options, announced', () => {
    const h = makeGame();
    title(h);
    pick(h, 'Options');
    const options = h.top();
    pick(h, 'Custom levels');
    expect(h.top()).toBeInstanceOf(MenuScene);
    expect(labels(h.top())).toEqual(['No levels yet', 'Back']);
    h.idle(4);
    h.tap('attack');
    expect(h.top()).toBe(options);
    expect(h.said.at(-1)).toContain('Custom levels');
  });

  it('a saved level goes to the select, with nothing of the menus left beneath', () => {
    saveLibrary({ v: 1, levels: { mine: 'x' } });
    const h = makeGame();
    title(h);
    pick(h, 'Options');
    pick(h, 'Custom levels');
    expect(labels(h.top())).toEqual(['mine', 'Back']);
    pick(h, 'mine');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    expect(h.game.scenes.depth).toBe(1);
    expect(h.game.pendingLevel).toBe('custom-mine');
  });

  it("is never offered in Classic's options or in a game's Options (RC-027)", () => {
    const h = makeGame();
    for (const o of [
      new OptionsScene(h.game, () => {}, false, true),
      new OptionsScene(h.game, () => {}, true, true),
      new OptionsScene(h.game, () => {}, true),
    ]) {
      expect(labels(o)).not.toContain('Custom levels');
      expect(labels(o)).not.toContain('Level editor');
    }
  });
});

describe('O-02: the title row is "Campaign"', () => {
  it('reads Campaign, second; its card reads CAMPAIGN / CHAPTER 1 COMING SOON!, read out', () => {
    const h = makeGame();
    const t = title(h);
    expect(labels(t)).toEqual(['Classic', 'Campaign', 'Options']);
    expect(drawn(h)).toContain('CAMPAIGN');
    pick(h, 'Campaign');
    expect(h.top()).toBeInstanceOf(CardScene);
    expect(CHAPTER1_GATE_CARD.slice(0, 2)).toEqual(['CAMPAIGN', 'CHAPTER 1 COMING SOON!']);
    expect(CHAPTER1_LINK_CARD.slice(0, 2)).toEqual(['CAMPAIGN', 'CHAPTER 1 COMING SOON!']);
    expect(h.said.at(-1)).toMatch(/^CAMPAIGN CHAPTER 1 COMING SOON!/);
    for (const l of [...CHAPTER1_GATE_CARD, ...CHAPTER1_LINK_CARD]) expect(l.length).toBeLessThanOrEqual(28);
  });
});

describe('O-03: the gate card no longer says the save files are kept', () => {
  it('has no YOUR SAVE FILES ARE KEPT. line; the resume link card keeps its own line', () => {
    expect(CHAPTER1_GATE_CARD).not.toContain('YOUR SAVE FILES ARE KEPT.');
    expect(CHAPTER1_GATE_CARD).toEqual(['CAMPAIGN', 'CHAPTER 1 COMING SOON!', '', 'PLAY CLASSIC FOR NOW.']);
    expect(CHAPTER1_LINK_CARD).toContain('THIS RESUME LINK IS KEPT.');
    const h = makeGame();
    title(h);
    pick(h, 'Campaign');
    expect(h.said.at(-1)).not.toContain('SAVE FILES');
  });
});

describe('O-07 (option c): Save files is a dev-mode row until the campaign opens', () => {
  const every = (h: H) => [
    new OptionsScene(h.game, () => {}),
    new OptionsScene(h.game, () => {}, false, true),
    new OptionsScene(h.game, () => {}, true, true),
    new OptionsScene(h.game, () => {}, true),
  ];

  it('no Options (title, Classic, pause) lists Save files outside dev mode', () => {
    const h = makeGame();
    for (const o of every(h)) expect(labels(o)).not.toContain('Save files');
  });

  it('with dev mode on (the campaign open) every Options lists it again and it opens', () => {
    const h = makeGame(true);
    for (const o of every(h)) expect(labels(o)).toContain('Save files');
    title(h);
    pick(h, 'Options');
    pick(h, 'Save files');
    expect(h.top()).toBeInstanceOf(SaveFilesOptions);
  });

  function hooks(over: Partial<HomeScreenHooks>): HomeScreenHooks {
    return {
      ios: false,
      phone: false,
      standalone: false,
      variant: () => 'hidden',
      prompt: async () => 'accepted' as const,
      updateReady: () => false,
      applyUpdate: () => {},
      ...over,
    };
  }

  it("the Home Screen app's and the download's first notes name no Save files while it is closed", () => {
    for (const [hk, closed, open] of [
      [{ ios: true, phone: true, standalone: true }, STANDALONE_NOTICE_CLOSED_LINES, STANDALONE_NOTICE_LINES],
      [{ fileCopy: true }, OFFLINE_NOTICE_CLOSED_LINES, OFFLINE_NOTICE_LINES],
    ] as const) {
      for (const dev of [false, true]) {
        const h = makeGame(dev);
        (h.game.deps as { homeScreen?: HomeScreenHooks }).homeScreen = hooks(hk);
        h.game.showTitle();
        h.game.scenes.clear();
        expect(titleNotice(h.game)).toBe(true);
        const lines = (h.top() as CardScene).lines;
        expect(lines).toEqual(dev ? open : closed);
        const said = h.said.at(-1) ?? '';
        if (dev) expect(said).toMatch(/Save files/);
        else {
          expect(lines.join(' ')).not.toMatch(/SAVE FILES/);
          expect(said).not.toMatch(/Save files/);
          expect(said).toMatch(/own saves/);
        }
        for (const l of lines) expect(l.length).toBeLessThanOrEqual(28);
      }
    }
  });
});

describe('O-08: the backup reminders are off by default, with a migration', () => {
  it('a new player has them off; Save files shows Off and turns them on', () => {
    expect(defaultSettings().backupReminders).toBe(false);
    expect(loadSettings().backupReminders).toBe(false);
    const h = makeGame(true);
    const files = new SaveFilesOptions(h.game, () => {});
    const row = items(files).find((i) => i.label === 'Backup reminders') as MenuItem;
    expect(row.value?.()).toBe('Off');
    row.adjust?.(1);
    expect(h.settings.backupReminders).toBe(true);
    expect(row.value?.()).toBe('On');
  });

  it('a v2 (or older) file saved with them on turns them off once; the rest of the file is kept', () => {
    for (const v of [1, 2]) {
      store.set(
        SETTINGS_KEY,
        JSON.stringify({ ...defaultSettings(), v, backupReminders: true, announce: false }),
      );
      const s = loadSettings();
      expect(s.backupReminders, `v${v}`).toBe(false);
      expect(s.announce).toBe(false);
      expect(s.v).toBe(SETTINGS_VERSION);
    }
  });

  it('a v3 file with them turned back on keeps them on', () => {
    const s = loadSettings();
    s.backupReminders = true;
    saveSettings(s);
    expect(JSON.parse(store.get(SETTINGS_KEY) as string).v).toBe(SETTINGS_VERSION);
    expect(loadSettings().backupReminders).toBe(true);
  });
});

describe('O-13: Classic options "All options" becomes "Video, audio, controls"', () => {
  it('names the row for what it holds, fits a row, and opens the usual options', () => {
    const h = makeGame();
    h.game.showClassicMenu();
    h.game.scenes.push(new ClassicOptionsScene(h.game, () => h.game.scenes.pop()));
    const l = labels(h.top());
    expect(l).not.toContain('All options');
    const row = items(h.top()).find((i) => i.label === 'Video, audio, controls') as MenuItem;
    expect(row).toBeDefined();
    expect(row.label.length).toBeLessThanOrEqual(24);
    expect(row.hint).not.toMatch(/and more/);
    pick(h, 'Video, audio, controls');
    expect(h.top()).toBeInstanceOf(OptionsScene);
    expect(labels(h.top()).slice(0, 3)).toEqual(['Video', 'Audio', 'Controls']);
  });
});

// 0.4.73 (owner, item 81): the title's Options no longer has How to play, so O-14's title guide
// is gone; Classic's own Options keep theirs (Classic heroes, Classic pages:
// classic-pause-guide-cheats.test.ts) and the Campaign's keep the campaign roster.
describe("O-14 / item 81: no campaign guides in Classic; none at all in the title's Options", () => {
  it('the title > Options has no How to play, with dev mode off or on', () => {
    for (const dev of [false, true]) {
      const h = makeGame(dev);
      title(h);
      pick(h, 'Options');
      expect(h.top()).toBeInstanceOf(OptionsScene);
      expect(labels(h.top())).not.toContain('How to play');
    }
  });

  it("Classic's Options list the Classic select's heroes, each with its Classic page", () => {
    const h = makeGame();
    h.game.scenes.push(new OptionsScene(h.game, () => h.game.scenes.pop(), false, true));
    pick(h, 'How to play');
    expect(h.top()).toBeInstanceOf(GuideIndexScene);
    const names = labels(h.top()).filter((l) => l !== 'Back');
    expect(names).toContain('Bass');
    expect(names.slice(0, 2)).toEqual(['Mario', 'Luigi']);
    pick(h, names[0] as string);
    expect((h.top() as unknown as { def: { rules?: string } }).def.rules).toBe('classic');
  });

  it("the Campaign's (in-game) Options list the campaign roster, as before", () => {
    const h = makeGame(true);
    h.game.scenes.push(new OptionsScene(h.game, () => h.game.scenes.pop(), true));
    pick(h, 'How to play');
    const names = labels(h.top()).filter((l) => l !== 'Back');
    expect(names).not.toContain('Bass');
    expect(names).toEqual(h.game.roster.map((c) => c.name));
  });
});

describe('O-10: no OK prompt line on the select; the spoken line says what OK does', () => {
  it("Classic's first select names the highlighted hero and says OK: play, with nothing drawn under the hero", () => {
    const h = makeGame();
    h.game.classicSelect('1-1', () => h.game.showClassicMenu());
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    const said = h.said.at(-1) ?? '';
    expect(said).toMatch(/^Select your hero\. Mario, Super Mario Bros\. /);
    // Mario wears other looks in Classic, so OK opens them.
    expect(said).toMatch(/OK: (looks|play)\./);
    expect(said).toMatch(h.game.skinsFor(h.game.heroSlots[0]!).length > 1 ? /OK: looks\./ : /OK: play\./);
    expect(said).not.toMatch(/OK to begin/);
    h.idle(30);
    expect(drawn(h).filter((t) => /^OK\b/.test(t))).toEqual([]);
  });

  it('a mid-run pick on a hero with looks says OK: looks (it opens the skin menu)', () => {
    const h = makeGame();
    const mario = h.game.heroSlots[0] as (typeof h.game.heroSlots)[number];
    h.game.classicGame(mario, '1-1');
    const megaman = h.game.heroSlots.find((c) => c.id === 'megaman');
    expect(megaman).toBeDefined();
    if (!megaman) return;
    h.game.scenes.push(
      new CharacterSelectScene(h.game, { player: 0, current: megaman, onPick: () => {}, random: true }),
    );
    const said = h.said.at(-1) ?? '';
    expect(said).toMatch(/Mega Man/);
    expect(said).toMatch(/OK: looks\./);
    expect(said).not.toMatch(/OK to confirm/);
    h.idle(30);
    expect(drawn(h).filter((t) => /^OK\b/.test(t))).toEqual([]);
  });

  it('a hero with no other looks says OK: play', () => {
    const h = makeGame();
    h.game.classicGame(h.game.heroSlots[0]!, '1-1', { ref: { set: 'smb', slot: 1 } });
    const plain = h.game.heroSlots.find((c) => h.game.skinsFor(c).length <= 1);
    expect(plain).toBeDefined();
    if (!plain) return;
    h.game.scenes.push(
      new CharacterSelectScene(h.game, { player: 0, current: plain, onPick: () => {}, random: true }),
    );
    expect(h.said.at(-1)).toMatch(/OK: play\./);
  });

  it('the campaign select keeps its line (Current rules unchanged)', () => {
    const h = makeGame(true);
    h.game.showCharacterSelect();
    expect(h.said.at(-1)).toMatch(/^Select your hero\. Left and right to choose, OK to begin\./);
  });
});

describe('O-16: Back on the mid-run select, and a confirmed Quit', () => {
  /** A Classic run in 1-1, its first pick done, then a death with lives left: the select again. */
  function midRunSelect(h: H): CharacterSelectScene {
    h.game.classicGame(h.game.heroSlots[0]!, '1-1', { ref: { set: 'smb', slot: 1 } });
    for (let i = 0; i < 600 && !(h.top() instanceof LevelScene); i++) h.step();
    expect(h.top()).toBeInstanceOf(LevelScene);
    h.game.respawn('1-1', { mode: 'stand' });
    const sel = h.top() as CharacterSelectScene;
    expect(sel).toBeInstanceOf(CharacterSelectScene);
    h.idle(12);
    return sel;
  }

  it('BACK on the select after a death asks NO / YES, NO first, announced; NO goes back to the select', () => {
    const h = makeGame();
    const sel = midRunSelect(h);
    h.tap('attack');
    const card = h.top();
    expect(card).toBeInstanceOf(QuitRunScene);
    expect(labels(card)).toEqual(['No', 'Yes']);
    expect(cursor(card)).toBe(0);
    expect(h.said.at(-1)).toBe('Quit to the Classic menu? Your run waits in its file. No');
    const text = drawn(h);
    expect(text).toContain(QUIT_RUN_TITLE);
    expect(text).toContain(QUIT_RUN_KEPT);
    for (const l of [QUIT_RUN_TITLE, QUIT_RUN_KEPT]) expect(l.length).toBeLessThanOrEqual(28);
    h.idle(8);
    h.tap('jump');
    expect(h.top()).toBe(sel);
    expect(h.said.at(-1)).toBe('No. Choose your hero.');
    expect(h.game.classicRun).toBe(true);
  });

  it('YES goes to the CLASSIC menu, where Continue holds the run', () => {
    const h = makeGame();
    midRunSelect(h);
    h.tap('attack');
    const before = h.said.length;
    pick(h, 'Yes');
    expect(h.top()).toBeInstanceOf(ClassicMenuScene);
    // Over the CLASSIC title's demo (O-04), and nothing else under it.
    expect(h.game.scenes.depth).toBe(2);
    expect((h.top() as ClassicMenuScene).over).toBeInstanceOf(ClassicTitleScene);
    // Straight there: the title is never shown (or read out) on the way.
    expect(h.said.slice(before).some((t) => t.includes('REMIX'))).toBe(false);
    expect(h.game.classicRun).toBe(false);
    expect(h.game.classicFileAt({ set: 'smb', slot: 1 })).not.toBeNull();
  });

  it('BACK on the card is NO', () => {
    const h = makeGame();
    const sel = midRunSelect(h);
    h.tap('attack');
    h.idle(8);
    h.tap('attack');
    expect(h.top()).toBe(sel);
  });

  it('Pause > Quit asks the same, and NO returns to the pause', () => {
    const h = makeGame();
    h.game.classicGame(h.game.heroSlots[0]!, '1-1', { ref: { set: 'smb', slot: 1 } });
    for (let i = 0; i < 600 && !(h.top() instanceof LevelScene); i++) h.step();
    h.idle(4);
    h.tap('start');
    const pause = h.top();
    expect(pause).toBeInstanceOf(PauseScene);
    pick(h, 'Quit');
    expect(h.top()).toBeInstanceOf(QuitRunScene);
    pick(h, 'No');
    expect(h.top()).toBe(pause);
    pick(h, 'Quit');
    pick(h, 'Yes');
    expect(h.top()).toBeInstanceOf(ClassicMenuScene);
  });

  it('a link run (never writes Continue, RC-004) promises nothing: no kept line, no Continue hint', () => {
    const h = makeGame();
    h.game.devClassicGame(h.game.heroSlots[0]!, '1-1', 'classic', false);
    for (let i = 0; i < 600 && !(h.top() instanceof LevelScene); i++) h.step();
    expect(h.game.keepsResume).toBe(false);
    h.idle(4);
    h.tap('start');
    const quit = items(h.top()).find((i) => i.label === 'Quit');
    expect(quit?.hint).toBe('Back to the Classic menu');
    pick(h, 'Quit');
    expect(h.top()).toBeInstanceOf(QuitRunScene);
    expect(drawn(h)).not.toContain(QUIT_RUN_KEPT);
    expect(h.said.at(-1)).toBe('Quit to the Classic menu? No');
  });

  it('a Classic mode run keeps the promise', () => {
    const h = makeGame();
    h.game.classicGame(h.game.heroSlots[0]!, '1-1', { ref: { set: 'smb', slot: 1 } });
    for (let i = 0; i < 600 && !(h.top() instanceof LevelScene); i++) h.step();
    expect(h.game.keepsResume).toBe(true);
    h.idle(4);
    h.tap('start');
    expect(items(h.top()).find((i) => i.label === 'Quit')?.hint).toMatch(/your file picks the run up/);
  });

  it('the campaign select keeps no BACK of its own (Current rules unchanged)', () => {
    const h = makeGame(true);
    h.game.newGame(h.game.roster[0]!, '1-1', null);
    h.game.respawn('1-1', { mode: 'stand' });
    const sel = h.top();
    if (sel instanceof CharacterSelectScene) {
      h.idle(12);
      h.tap('attack');
      expect(h.top()).not.toBeInstanceOf(QuitRunScene);
    }
  });
});

describe('RC-005: a custom level link this browser does not have', () => {
  it('shows an announced LEVEL NOT FOUND card that waits for OK, then the title', () => {
    const h = makeGame();
    h.game.goToLevel('custom-someone-elses', { mode: 'stand' });
    expect(h.top()).toBeInstanceOf(MessageScene);
    const text = drawn(h);
    for (const l of CUSTOM_LEVEL_MISSING.filter(Boolean)) expect(text).toContain(l);
    expect(text.join(' ')).not.toMatch(/NOT BUILT YET|THANK YOU/);
    for (const l of CUSTOM_LEVEL_MISSING) expect(l.length).toBeLessThanOrEqual(30);
    expect(h.said.at(-1)).toBe(
      'LEVEL NOT FOUND THIS CUSTOM LEVEL IS NOT SAVED IN THIS BROWSER. ASK FOR ITS SHARE LINK. OK to continue.',
    );
    h.idle(300);
    expect(h.top()).toBeInstanceOf(MessageScene);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(TitleScene);
  });

  it('an unbuilt world is still the thank-you card, now read out and with its world drawn', () => {
    const h = makeGame();
    h.game.goToLevel('z-1', { mode: 'stand' });
    expect(h.top()).toBeInstanceOf(MessageScene);
    expect(drawn(h)).toContain('WORLD Z IS NOT');
    expect(h.said.at(-1)).toMatch(/^THANK YOU FOR PLAYING! WORLD Z IS NOT BUILT YET\./);
  });
});
