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
import { ScriptedInput } from '@game/sim/headless';
import { CHARACTERS } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { newSave, writeSave } from '@game/save/save-files';
import { Game } from './game';
import { TitleScene } from './title';
import { FileSelectScene } from './file-select';
import { PauseScene } from './pause';
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
    const chars = [...CHARACTERS, fakeHero('sophia')];
    const row = heroRow(chars, ['mario']);
    expect(row).toHaveLength(chars.length);
    expect(row.at(-1)).toMatchObject({ freed: false });
    expect(row.at(-1)?.def.id).toBe('sophia');
    expect(heroRow(chars, ['mario', 'sophia']).at(-1)?.freed).toBe(true);
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
      'UNOFFICIAL FAN PROJECT',
    ])
      expect(t).toContain(s);
    expect(t).not.toContain('DEV MODE');
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
    const version = `V${__APP_VERSION__}`.toUpperCase();
    expect(version.startsWith(`V${pkg.version}`)).toBe(true);
    expect(t).toContain(version);
  });

  it('announces the screen and the highlighted entry', () => {
    const h = makeGame();
    h.game.showTitle();
    const last = h.said.at(-1) ?? '';
    expect(last).toContain('REMIX');
    expect(last).toContain('Exploding Rabbit');
    expect(last).toContain('Start game');
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
    for (let i = 0; i < 500; i++) {
      h.step();
      if (title.shake() !== 0) shook = true;
      if (title.boltFlash()) flashed = true;
      rims.add(title.rimPhase());
    }
    return { shook, flashed, rims };
  }

  it('the stamp shakes the screen, the bolt flashes and the rim cycles normally', () => {
    const r = run(false);
    expect(r.shook).toBe(true);
    expect(r.flashed).toBe(true);
    expect(r.rims.size).toBeGreaterThan(1);
  });

  it('with reduce flashing there is no shake, no flash and no colour cycling', () => {
    const r = run(true);
    expect(r.shook).toBe(false);
    expect(r.flashed).toBe(false);
    expect(r.rims.size).toBe(1);
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
