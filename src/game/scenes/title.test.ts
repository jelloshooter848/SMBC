import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { getLevel } from '@content/levels';
import { DEFAULT_ASSIST } from '@game/context';
import type { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO, type AudioSink } from '@engine/audio/audio-manager';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { Action } from '@engine/input/actions';
import type { Announcer } from '@engine/a11y/announcer';
import type { Settings } from '@engine/save/settings';
import { ScriptedInput } from '@game/sim/headless';
import { CHARACTERS } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { newSave, writeSave } from '@game/save/save-files';
import { Game } from './game';
import { TitleScene } from './title';
import { FileSelectScene } from './file-select';
import { PauseScene } from './pause';
import { DEV_CODE } from './cheat';
import { heroRow, titleFreed, TITLE_TIMING } from './title-anim';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

const assets = {
  sheet: (name: string, palette?: string) => ({ id: name, name, palette, image: null, frames: new Map() }),
} as unknown as AssetRegistry;

function makeGame(opts: { intro?: boolean; reduceFlashing?: boolean; audio?: AudioSink } = {}) {
  const said: string[] = [];
  const game = new Game({
    ctx: {
      assets,
      audio: opts.audio ?? NULL_AUDIO,
      assist: { ...DEFAULT_ASSIST },
      reduceFlashing: opts.reduceFlashing ?? false,
    },
    getLevel,
    characters: CHARACTERS,
    announcer: { say: (t: string) => said.push(t) } as unknown as Announcer,
    titleIntro: opts.intro ?? false,
  });
  const p1 = new ScriptedInput({ steps: [] });
  const p2 = new ScriptedInput({ steps: [] });
  const step = (a1: Action[] = []) => {
    p1.setHeld(a1);
    p2.setHeld([]);
    p1.next();
    p2.next();
    game.scenes.update([p1, p2]);
  };
  const tap = (a: Action) => {
    step([a]);
    step();
  };
  const idle = (n: number) => {
    for (let i = 0; i < n; i++) step();
  };
  return { game, said, step, tap, idle };
}

function texts(scene: TitleScene): { str: string; x: number; y: number }[] {
  const out: { str: string; x: number; y: number }[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    text(_f: SpriteSheet, str: string, x: number, y: number): void {
      out.push({ str, x, y });
    },
  });
  scene.render(r);
  return out;
}

const fakeHero = (id: string): CharacterDef => ({ ...CHARACTERS[2]!, id, name: id.toUpperCase() });

describe('title hero row', () => {
  it('lists every registered hero in registry order, freed ones in colour', () => {
    const row = heroRow(CHARACTERS, ['mario', 'link']);
    expect(row.map((h) => h.def.id)).toEqual(CHARACTERS.map((c) => c.id));
    expect(row.filter((h) => h.freed).map((h) => h.def.id)).toEqual(['mario', 'link']);
  });

  it('picks up a newly registered hero automatically (as a silhouette until freed)', () => {
    const chars = [...CHARACTERS, fakeHero('newhero')];
    const row = heroRow(chars, ['mario']);
    expect(row).toHaveLength(chars.length);
    expect(row.at(-1)).toMatchObject({ freed: false });
    expect(row.at(-1)?.def.id).toBe('newhero');
    expect(heroRow(chars, ['mario', 'newhero']).at(-1)?.freed).toBe(true);
  });

  it('has Mario and all eight heroes to free, Sophia III last, spaced inside the screen', () => {
    const row = heroRow(
      CHARACTERS,
      CHARACTERS.map((c) => c.id),
    );
    expect(row).toHaveLength(9);
    expect(row.at(-1)?.def.id).toBe('sophia');
    expect(row.every((h) => h.freed)).toBe(true);
    for (const h of row) {
      expect(h.x).toBeGreaterThanOrEqual(16);
      expect(h.x).toBeLessThanOrEqual(240);
    }
    expect(heroRow(CHARACTERS, ['mario']).filter((h) => h.freed)).toHaveLength(1);
  });

  it('with no save file only Mario is freed; else the most advanced file is shown', () => {
    expect(titleFreed([null, null, null])).toEqual(['mario']);
    const a = { ...newSave(1, 'mario'), freed: ['mario', 'luigi'] };
    const b = { ...newSave(2, 'mario'), freed: ['mario', 'link', 'samus'] };
    expect(titleFreed([a, 'unreadable', b])).toEqual(['mario', 'link', 'samus']);
  });

  it('the title scene reads the save files', () => {
    writeSave({ ...newSave(2, 'mario'), freed: ['mario', 'megaman'] });
    const h = makeGame();
    h.game.showTitle();
    const title = h.game.scenes.top as TitleScene;
    expect(title.heroes.filter((x) => x.freed).map((x) => x.def.id)).toEqual(['mario', 'megaman']);
  });
});

describe('title text', () => {
  it('shows the menu, credits, chapter and the build version', () => {
    const h = makeGame();
    h.game.showTitle();
    h.idle(TITLE_TIMING.dropEnd + 10);
    const t = texts(h.game.scenes.top as TitleScene).map((x) => x.str);
    for (const s of [
      'START GAME',
      'CUSTOM LEVELS',
      'OPTIONS',
      'CHAPTER 1',
      'MADE BY JELLOSHOOTER848',
      'BASED ON SUPER MARIO BROS.',
      'CROSSOVER BY EXPLODING RABBIT',
      'PRE-RELEASE',
    ])
      expect(t).toContain(s);
    expect(t).not.toContain('UNOFFICIAL FAN PROJECT');
    expect(t).not.toContain('DEV MODE');
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
    const version = `V${__APP_VERSION__}`.toUpperCase();
    expect(version.startsWith(`V${pkg.version}`)).toBe(true);
    expect(t).toContain(version);
  });

  it('puts PRE-RELEASE bottom left with the build version on the same line', () => {
    const h = makeGame();
    h.game.showTitle();
    h.idle(TITLE_TIMING.dropEnd + 10);
    const all = texts(h.game.scenes.top as TitleScene);
    // Shadowed text draws twice (shadow first): the last draw is the text itself.
    const footer = all.filter((x) => x.str === 'PRE-RELEASE').at(-1);
    const version = all.filter((x) => x.str === `V${__APP_VERSION__}`.toUpperCase()).at(-1);
    expect(footer).toMatchObject({ x: 4, y: 228 });
    // Release and dev builds (V0.4.19-DEV.ABC1234) both fit beside the short footer.
    expect(version?.y).toBe(228);
    expect((version?.x ?? 0) > 4 + 'PRE-RELEASE'.length * 8).toBe(true);
  });

  it('announces the screen and the highlighted entry', () => {
    const h = makeGame();
    h.game.showTitle();
    const last = h.said.at(-1) ?? '';
    expect(last).toContain('REMIX');
    expect(last).toContain('Exploding Rabbit');
    expect(last).toContain('Pre-release.');
    expect(last).not.toContain('Unofficial fan project');
    expect(last).toContain('Start game');
    // Mario starts free: a new save has none of the eight heroes to find yet.
    expect(last).toContain('0 of 8 heroes freed.');
  });
});

describe('title dev code', () => {
  it('still unlocks developer mode on the finished title, landing on Dev mode', () => {
    const h = makeGame();
    const settings = { dev: false } as Settings;
    (h.game.deps as { settings?: unknown }).settings = settings;
    h.game.showTitle();
    h.idle(TITLE_TIMING.dropEnd + 10);
    const title = h.game.scenes.top as TitleScene;
    for (const a of DEV_CODE) h.tap(a);
    expect(settings.dev).toBe(true);
    expect(h.game.scenes.top).toBe(title);
    expect(h.said.at(-1)).toBe('Developer mode unlocked.');
    expect(texts(title).map((x) => x.str)).toContain('DEV MODE');
  });
});

describe('title intro (the rift)', () => {
  it('plays only when enabled, and only on the first title of the session', () => {
    const h = makeGame({ intro: true });
    h.game.showTitle();
    h.idle(5);
    expect((h.game.scenes.top as TitleScene).phase).toBe('rift');
    h.game.showTitle();
    h.idle(5);
    expect((h.game.scenes.top as TitleScene).phase).not.toBe('rift');
    const plain = makeGame();
    plain.game.showTitle();
    plain.idle(5);
    expect((plain.game.scenes.top as TitleScene).phase).not.toBe('rift');
  });

  it('a press skips it to the finished title without choosing a menu entry', () => {
    const h = makeGame({ intro: true });
    h.game.showTitle();
    h.idle(30);
    h.tap('start');
    const title = h.game.scenes.top as TitleScene;
    expect(title).toBeInstanceOf(TitleScene);
    expect(title.phase).toBe('ready');
    h.idle(8);
    h.tap('start');
    expect(h.game.scenes.top).toBeInstanceOf(FileSelectScene);
  });

  it('ends by itself in about four to six seconds', () => {
    const h = makeGame({ intro: true });
    h.game.showTitle();
    const title = h.game.scenes.top as TitleScene;
    let frames = 0;
    while (title.phase !== 'ready' && frames < 1000) {
      h.step();
      frames++;
    }
    expect(frames).toBeGreaterThanOrEqual(4 * 60);
    expect(frames).toBeLessThanOrEqual(6 * 60);
  });

  it('plays the rift music, then the title theme; a skip goes straight to the title theme', () => {
    const played: string[] = [];
    const audio: AudioSink = {
      ...NULL_AUDIO,
      playMusic: (id) => void played.push(`music:${id}`),
      playJingle: (id) => void played.push(`jingle:${id}`),
      sfx: (id) => void played.push(`sfx:${id}`),
    };
    const h = makeGame({ intro: true, audio });
    h.game.showTitle();
    h.idle(3);
    expect(played).toContain('jingle:title-rift');
    h.tap('jump');
    expect(played.at(-1)).toBe('music:title');
    const q = makeGame({ audio });
    played.length = 0;
    q.game.showTitle();
    q.idle(TITLE_TIMING.dropEnd + 5);
    expect(played).toContain('music:title');
    expect(played).toContain('sfx:stamp');
  });
});

describe('reduce flashing', () => {
  function run(reduce: boolean) {
    const h = makeGame({ intro: true, reduceFlashing: reduce });
    h.game.showTitle();
    const title = h.game.scenes.top as TitleScene;
    let shook = false;
    let flashed = false;
    const rims = new Set<number>();
    const blasts = new Set<number>();
    for (let i = 0; i < 500; i++) {
      h.step();
      if (title.shake() !== 0) shook = true;
      if (title.boltFlash()) flashed = true;
      rims.add(title.rimPhase());
      blasts.add(title.blastFrame(i));
    }
    return { shook, flashed, rims, blasts };
  }

  it('the stamp shakes the screen, the bolt flashes and the rim cycles normally', () => {
    const r = run(false);
    expect(r.shook).toBe(true);
    expect(r.flashed).toBe(true);
    expect(r.rims.size).toBeGreaterThan(1);
    expect(r.blasts.size).toBe(2);
  });

  it('with reduce flashing there is no shake, no flash and no colour cycling', () => {
    const r = run(true);
    expect(r.shook).toBe(false);
    expect(r.flashed).toBe(false);
    expect(r.rims.size).toBe(1);
    expect(r.blasts.size).toBe(1);
  });
});

describe('the short logo', () => {
  it('shows on the pause screen', () => {
    const h = makeGame();
    const frames: string[] = [];
    const r: Renderer = Object.assign(new NullRenderer(), {
      sprite(sheet: SpriteSheet, frame: string): void {
        frames.push(`${sheet.id}/${frame}`);
      },
    });
    new PauseScene(h.game).render(r);
    expect(frames).toContain('title-logo/smbc-line');
  });
});

describe('intro layering', () => {
  it('keeps the logo readable: heroes flying out of the rift pass behind the letters', () => {
    const h = makeGame({ intro: true });
    h.game.showTitle();
    const title = h.game.scenes.top as TitleScene;
    const heroSheets = new Set(CHARACTERS.map((c) => c.portrait.sheet));
    let checked = 0;
    for (let i = 0; i < 300; i++) {
      h.step();
      const calls: string[] = [];
      const r: Renderer = Object.assign(new NullRenderer(), {
        sprite(sheet: SpriteSheet, frame: string): void {
          calls.push(`${sheet.id}/${frame}`);
        },
      });
      title.render(r);
      const lastHero = calls.reduce((last, c, k) => (heroSheets.has(c.split('/')[0]!) ? k : last), -1);
      const firstLetter = calls.findIndex((c) => c.startsWith('title-logo/cross-'));
      if (lastHero < 0 || firstLetter < 0) continue;
      expect(lastHero, `frame ${i}`).toBeLessThan(firstLetter);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});
