import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { startHp } from '@game/characters/character';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { LevelScene } from '@game/scenes/level';
import { resumeOf } from '@game/run-resume';
import {
  classicFileKey,
  eraseClassicFile,
  loadClassicFile,
  originalFileRules,
  type ClassicFileRef,
} from '@game/original-files';
import { makeGame, store, useStorage, type H } from './heroes-harness';

// BUG-06: in the original every hero keeps his own upgrades and ammo (StatManager.as 135-147, by
// charNum). A level's end resets nothing; a hero change leaves each hero his own (Character.as
// 605); a death resets only the hero who died (Character.cleanUp, 3076-3081); a new game and a
// continue reset everyone (resetAllStats, StatManager.as 280-332, 542-548); the save keeps every
// hero's (prepareLoadSaveStats, 610-643).

useStorage();
afterEach(() => store.clear());

const F1: ClassicFileRef = { set: 'smb', slot: 1 };
/** B-L: FILE 1's run (the old per-set slot's place). */
const loadClassicResume = (_set: 'smb') => loadClassicFile(F1)?.run ?? null;
/** FILE 1 holding run `r` as stored (its JSON, so the reader checks every field). */
const fileWith = (r: string) =>
  `{"v":1,"rules":${JSON.stringify(originalFileRules())},"continues":0,"run":${r}}`;

function classic(over: Partial<Settings> = {}): H {
  const settings = { ...defaultSettings(), ...over };
  return makeGame({ deps: { settings, applySettings: () => {} } });
}

const inLevel = (h: H) => h.top() instanceof LevelScene;
const level = (h: H) => h.top() as LevelScene;

function enterLevel(h: H): LevelScene {
  h.until(() => inLevel(h), 600);
  expect(inLevel(h)).toBe(true);
  return level(h);
}

/** A Classic run of Mario, in 1-1. */
function marioRun(h: H): void {
  h.game.classicGame(MARIO, '1-1', { ref: F1 });
  enterLevel(h);
}

/** Picks the hero named `name` on the select on top, its own look. */
function pick(h: H, name: string): void {
  expect(h.top()).toBeInstanceOf(CharacterSelectScene);
  h.idle(12);
  for (let i = 0; i < 30 && h.said.at(-1)?.split(/[,.]/)[0] !== name; i++) h.tap('right');
  h.tap('jump');
  if ((h.top() as CharacterSelectScene).pickerOpen) h.tap('jump');
}

describe('BUG-06: each hero keeps his power-ups in a Classic run', () => {
  it("a level's end keeps the Fire Flower for the next level", () => {
    const h = classic();
    marioRun(h);
    level(h).world.player.powerState = 'fire';
    level(h).world.events.push({ type: 'exit', next: '1-2' });
    h.step();
    pick(h, MARIO.name);
    const l = enterLevel(h);
    expect(l.level.id).toBe('1-2');
    expect(h.game.state.powerState).toBe('fire');
    expect(l.world.player.powerState).toBe('fire');
  });

  it('a hero change puts the hero away as he is; picked again he has it back', () => {
    const h = classic();
    marioRun(h);
    const g = h.game;
    g.state.powerState = 'fire';
    g.setHero(0, LINK);
    expect(g.state.character).toBe(LINK);
    expect(g.state.powerState).toBe('small');
    g.state.powerState = 'big';
    g.state.kit = { bombs: 4 };
    g.setHero(0, MARIO);
    expect(g.state.powerState).toBe('fire');
    g.setHero(0, LINK);
    expect(g.state.powerState).toBe('big');
    expect(g.state.kit).toEqual({ bombs: 4 });
  });

  it('through the select between levels: Link, then Mario back with his Fire Flower', () => {
    const h = classic();
    marioRun(h);
    level(h).world.player.powerState = 'fire';
    level(h).world.events.push({ type: 'exit', next: '1-2' });
    h.step();
    pick(h, LINK.name);
    enterLevel(h);
    expect(h.game.state.character).toBe(LINK);
    expect(h.game.state.powerState).toBe('small');
    level(h).world.events.push({ type: 'exit', next: '1-3' });
    h.step();
    pick(h, MARIO.name);
    enterLevel(h);
    expect(h.game.state.character).toBe(MARIO);
    expect(h.game.state.powerState).toBe('fire');
  });

  it("another look of the same hero shares his power (a skin shares the original's charNum)", () => {
    const h = classic();
    marioRun(h);
    const g = h.game;
    const look = g.skinsFor(MARIO).find((c) => c !== MARIO);
    expect(look).toBeDefined();
    if (!look) return;
    g.state.powerState = 'fire';
    g.setHero(0, look);
    expect(g.state.powerState).toBe('fire');
  });

  it('a death resets only the hero who died', () => {
    const h = classic();
    marioRun(h);
    const g = h.game;
    g.setHero(0, LINK);
    g.state.powerState = 'big';
    g.setHero(0, MARIO);
    g.state.powerState = 'fire';
    g.resetAfterDeath();
    expect(g.state.powerState).toBe('small');
    g.setHero(0, MARIO); // the select after the death: Mario again
    expect(g.state.powerState).toBe('small');
    g.setHero(0, LINK);
    expect(g.state.powerState).toBe('big');
  });

  it('a new run and a continue reset every hero', () => {
    const h = classic();
    marioRun(h);
    const g = h.game;
    g.state.powerState = 'fire';
    g.setHero(0, LINK);
    g.continueGame('1-1');
    expect(g.classicKits).toEqual({});
    g.setHero(0, MARIO);
    expect(g.state.powerState).toBe('small');
    g.state.powerState = 'fire';
    g.setHero(0, LINK);
    // 31e: a new game starts only in an empty file (ERASE FILE first, as a player does).
    eraseClassicFile(F1);
    g.classicGame(LINK, '1-1', { ref: F1 });
    expect(g.classicKits).toEqual({});
    g.setHero(0, MARIO);
    expect(g.state.powerState).toBe('small');
  });

  it('the resume slot keeps the other heroes, and Continue gives them back', () => {
    const h = classic();
    marioRun(h);
    const g = h.game;
    g.state.powerState = 'fire';
    g.setHero(0, LINK);
    g.state.powerState = 'big';
    g.goToLevel('1-2', { mode: 'stand' }); // its WORLD card writes the slot
    expect(loadClassicResume('smb')?.heroKits).toEqual({
      mario: { powerState: 'fire', hp: expect.any(Number), kit: {} },
    });
    g.showTitle();
    expect(g.resumeClassic(F1)).toBe(true);
    expect(g.state.character).toBe(LINK);
    expect(g.state.powerState).toBe('big');
    g.setHero(0, MARIO);
    expect(g.state.powerState).toBe('fire');
  });

  it('a slot without other heroes (older, or a continue point) gives them their defaults', () => {
    const h = classic();
    marioRun(h);
    const g = h.game;
    const r = resumeOf('1-2', g.state, 'classic');
    expect(r.heroKits).toBeUndefined();
    store.set(classicFileKey(F1), fileWith(JSON.stringify(r)));
    g.showTitle();
    expect(g.resumeClassic(F1)).toBe(true);
    expect(g.classicKits).toEqual({});
    g.setHero(0, LINK);
    expect(g.state.powerState).toBe('small');
  });

  // Release review: an entry is kept only for a Classic select slot, with a power its hero has.
  // Every Classic hero is a power-up hero, whose hp means nothing (startHp: always 0): any
  // number reads as 0, so a negative one is kept as 0 (a hit-point hero's is checked below).
  it('a broken entry in the slot is dropped (that hero starts afresh)', () => {
    const h = classic();
    marioRun(h);
    const r = {
      ...resumeOf('1-2', h.game.state, 'classic'),
      heroKits: {
        link: { powerState: 'big', hp: 'x' },
        samus: { powerState: 'huge', hp: 0 },
        luigi: { powerState: 'fire', hp: -1 },
        bill: { powerState: 'big', hp: 3 },
        simon: { powerState: 'fire', hp: 0, kit: { a: 1, b: 'no' } },
      },
    };
    store.set(classicFileKey(F1), fileWith(JSON.stringify(r)));
    expect(loadClassicResume('smb')?.heroKits).toEqual({
      luigi: { powerState: 'fire', hp: 0, kit: {} },
      bill: { powerState: 'big', hp: 0, kit: {} },
      simon: { powerState: 'fire', hp: 0, kit: { a: 1 } },
    });
  });

  it('an id that is no Classic select slot is dropped (an unknown hero, or a look)', () => {
    const h = classic();
    marioRun(h);
    const r = {
      ...resumeOf('1-2', h.game.state, 'classic'),
      heroKits: {
        nobody: { powerState: 'fire', hp: 0, kit: {} },
        peach: { powerState: 'fire', hp: 0, kit: {} },
        bass: { powerState: 'big', hp: 0, kit: {} },
      },
    };
    store.set(classicFileKey(F1), fileWith(JSON.stringify(r)));
    expect(loadClassicResume('smb')?.heroKits).toEqual({ bass: { powerState: 'big', hp: 0, kit: {} } });
  });

  it("the slot's own power and hp that do not read for its hero are its default", () => {
    const h = classic();
    marioRun(h);
    const put = (over: Record<string, unknown>) =>
      store.set(
        classicFileKey(F1),
        fileWith(JSON.stringify({ ...resumeOf('1-2', h.game.state, 'classic'), ...over })),
      );
    put({ powerState: 'huge' });
    expect(loadClassicResume('smb')).toMatchObject({ powerState: 'small', hp: 0 });
    // A power-up hero's hp means nothing: any number reads as 0, his power kept.
    for (const hp of [0, -2, 3]) {
      put({ powerState: 'fire', hp });
      expect(loadClassicResume('smb'), String(hp)).toMatchObject({ powerState: 'fire', hp: 0 });
    }
    // A hit-point hero (a developer run under Campaign rules): 0 < hp <= its max.
    const max = startHp(LINK);
    for (const hp of [0, -3, max + 1]) {
      put({ rules: 'campaign', hero: 'link', powerState: 'full', hp });
      expect(loadClassicResume('smb'), String(hp)).toMatchObject({ powerState: 'full', hp: max });
    }
    put({ rules: 'campaign', hero: 'link', powerState: 'full', hp: 2 });
    expect(loadClassicResume('smb')).toMatchObject({ powerState: 'full', hp: 2 });
    put({ rules: 'campaign', hero: 'link', powerState: 'fire', hp: 2 });
    expect(loadClassicResume('smb')).toMatchObject({ powerState: 'full', hp: max });
  });

  it("a dev start from a Classic run's pause takes no kits from that run", () => {
    const h = classic();
    marioRun(h);
    const g = h.game;
    g.state.powerState = 'fire';
    g.setHero(0, LINK);
    expect(g.classicKits.mario?.powerState).toBe('fire');
    g.devStart('1-1', LINK, 'small', false, undefined, { rules: 'classic', classic: true });
    expect(g.classicKits).toEqual({});
    g.setHero(0, MARIO);
    expect(g.state.powerState).toBe('small');
  });

  it('outside a Classic run (free play) a new hero still starts from its default', () => {
    const h = makeGame({ deps: { settings: defaultSettings(), applySettings: () => {} } });
    const g = h.game;
    g.newGame(MARIO, '1-1', null);
    g.state.powerState = 'fire';
    g.setHero(0, LINK);
    g.setHero(0, MARIO);
    expect(g.state.powerState).toBe('small');
    expect(g.classicKits).toEqual({});
  });
});
