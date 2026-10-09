import { describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import type { Scene } from '@engine/scene';
import { toPx } from '@engine/math/units';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { LevelScene } from '@game/scenes/level';
import { PauseScene } from '@game/scenes/pause';
import type { MenuItem } from '@game/scenes/menu';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { LINK } from '@game/characters/link';
import { SAMUS } from '@game/characters/samus';
import { heroStart } from '@game/items/heroes';
import { carriedKit } from '@game/entities/player';
import { loadSave, migrateSave, newSave } from '@game/save/save-files';
import { CARD_GUARD_FRAMES, PracticeRoomScene, TrainingMenuScene } from '@game/tutorial/room';
import { TrainingQuestionScene } from '@game/tutorial/training';
import { HeroStageScene, StageMenu, StartAtMenu } from '@game/tutorial/hero-stage';
import { CardScene } from '@game/scenes/message';
import { RYU } from '@game/characters/ryu';
import type { TargetDummy } from '@game/tutorial/dummy';
import type { Settings } from '@engine/save/settings';
import { mapPage } from '@content/worldmap';
import { draw, file, makeGame, store, useStorage, type H } from './heroes-harness';

useStorage();

const items = (s: Scene | undefined) => (s as unknown as { items: MenuItem[] }).items;

/** Pick the menu entry labelled `label` (stepping down to it). */
function choose(h: H, label: string, value?: string) {
  h.idle(8);
  const i = items(h.top()).findIndex((it) => it.label === label && (!value || it.value?.() === value));
  expect(i, label).toBeGreaterThanOrEqual(0);
  for (let k = 0; k < i; k++) h.tap('down');
  h.tap('jump');
}

/** From the map: enter 1-1 and move the select's cursor `right` times, then OK. */
function pick(h: H, right: number) {
  h.game.markSeen('luigi-runs'); // 1-1's opening beat (Luigi running off) is another story
  h.game.enterLevelFromMap('1-1');
  expect(h.top()).toBeInstanceOf(CharacterSelectScene);
  h.idle(12);
  for (let i = 0; i < right; i++) h.tap('right');
  h.tap('jump');
}

/**
 * Skip training from its menu: a hero stage's (START AT's Beginning first on a replay, Toad's
 * greeting skipped with BACK), or the practice room's.
 */
function skip(h: H) {
  if (h.top() instanceof StartAtMenu) choose(h, 'Beginning');
  const stage = h.game.scenes.find((sc) => sc instanceof HeroStageScene) as HeroStageScene | undefined;
  if (stage) {
    if (!stage.run.greeted) {
      h.until(() => h.top() instanceof CardScene, 60);
      h.idle(CARD_GUARD_FRAMES + 12);
      h.tap('attack');
    }
    expect(h.top()).toBeInstanceOf(HeroStageScene);
    h.idle(4);
    h.tap('start');
    expect(h.top()).toBeInstanceOf(StageMenu);
    choose(h, 'Skip training');
    return;
  }
  expect(h.top()).toBeInstanceOf(PracticeRoomScene);
  h.idle(4);
  h.tap('start');
  expect(h.top()).toBeInstanceOf(TrainingMenuScene);
  choose(h, 'Skip training');
}

describe('the training question', () => {
  it("the first pick of a freed hero asks LUIGI TRAINING?; NO goes on at once and it's never asked again", () => {
    const h = makeGame();
    file({ freed: ['mario', 'luigi'] });
    h.game.openFile(1);
    expect(h.game.tutorials).toEqual(['mario']);
    pick(h, 1);
    const q = h.top() as TrainingQuestionScene;
    expect(q).toBeInstanceOf(TrainingQuestionScene);
    expect(q.title).toBe('LUIGI TRAINING?');
    expect(items(q).map((i) => i.label)).toEqual(['Yes', 'No']);
    expect(h.said.at(-1)).toMatch(/^Luigi training\?.*Yes\.$/);
    expect(draw(q).texts.map((t) => t.str)).toEqual(expect.arrayContaining(['LUIGI TRAINING?', 'YES', 'NO']));
    choose(h, 'No');
    h.until(() => h.top() instanceof LevelScene);
    expect(h.game.state.character).toBe(LUIGI);
    expect(loadSave(1)?.tutorials).toEqual(['mario', 'luigi']);
    // Again from the map, and after reopening the file: straight on.
    h.game.returnToMap();
    pick(h, 0);
    expect(h.top()).not.toBeInstanceOf(TrainingQuestionScene);
    const again = makeGame();
    again.game.openFile(1);
    expect(again.game.tutorials).toContain('luigi');
    again.game.state.character = MARIO;
    pick(again, 1);
    expect(again.top()).not.toBeInstanceOf(TrainingQuestionScene);
    again.until(() => again.top() instanceof LevelScene);
  });

  it("YES plays Link's stage (no START AT), then the level starts as the pick would have; the run is untouched", () => {
    const h = makeGame();
    file({ freed: ['mario', 'link'], lives: 4, score: 1200, coins: 7, powerState: 'fire' });
    h.game.openFile(1);
    pick(h, 1);
    choose(h, 'Yes');
    const stage = h.top() as HeroStageScene;
    expect(stage).toBeInstanceOf(HeroStageScene);
    expect(stage.hero).toBe(LINK);
    expect(loadSave(1)?.tutorials).toContain('link');
    // The stage's own world and state: Link's basic kit.
    expect(stage.state).not.toBe(h.game.state);
    expect(stage.world.player.scratch).toMatchObject(heroStart(LINK).kit);
    expect(stage.world.player.scratch['has-bomb-bag']).toBeUndefined();
    expect(h.game.state.character).toBe(MARIO);
    skip(h);
    h.until(() => h.top() instanceof LevelScene);
    expect((h.top() as LevelScene).level.id).toBe('1-1');
    const s = h.game.state;
    expect(s.character).toBe(LINK);
    expect([s.lives, s.score, s.coins, s.powerState, s.hp]).toEqual([4, 1200, 7, 'full', 6]);
    expect(s.kit).toEqual(heroStart(LINK).kit); // Link's basic campaign kit (docs/POWERUPS.md)
  });

  it('YES plays the practice room (a hero without a stage yet), then the level starts; the run is untouched', () => {
    const h = makeGame();
    file({ freed: ['mario', 'ryu'], lives: 4, score: 1200, coins: 7, powerState: 'fire' });
    h.game.openFile(1);
    pick(h, 1);
    choose(h, 'Yes');
    const room = h.top() as PracticeRoomScene;
    expect(room).toBeInstanceOf(PracticeRoomScene);
    expect(room.hero).toBe(RYU);
    expect(loadSave(1)?.tutorials).toContain('ryu');
    // The room's own world and state: its kit, its score.
    expect(room.player.scratch).toMatchObject(heroStart(RYU).kit); // Ryu's basic kit
    // The first chapter's card waits for a button; then knock the dummy down with the sword: the
    // room's own score goes up.
    h.idle(CARD_GUARD_FRAMES + 1);
    h.tap('jump');
    expect(room.phase).toBe('lesson');
    const d = room.dummy as TargetDummy;
    for (let i = 0; i < 300 && d.alive; i++)
      h.step(toPx(room.player.centerX) < 128 ? ['right'] : i % 16 < 2 ? ['attack'] : []);
    expect(d.alive).toBe(false);
    expect(room.state.score).toBeGreaterThan(0);
    // Still the pick in progress: Mario's power, the run's lives, score and coins.
    expect(h.game.state.character).toBe(MARIO);
    expect(h.game.state.powerState).toBe('fire');
    skip(h);
    h.until(() => h.top() instanceof LevelScene);
    expect((h.top() as LevelScene).level.id).toBe('1-1');
    const s = h.game.state;
    expect(s.character).toBe(RYU);
    expect([s.lives, s.score, s.coins, s.powerState, s.hp]).toEqual([4, 1200, 7, 'full', heroStart(RYU).hp]);
    expect(s.kit).toEqual(heroStart(RYU).kit);
  });

  it("old saves don't ask for the heroes they already play; a new hero still asks", () => {
    const h = makeGame();
    // A file from before training (no tutorials) playing Link, with Samus freed too.
    const old = { ...newSave(1, 'link'), freed: ['mario', 'link', 'samus'], powerState: 'full', hp: 6 };
    delete (old as { tutorials?: string[] }).tutorials;
    store.set('smbc.save.1', JSON.stringify(old));
    expect(migrateSave(JSON.parse(store.get('smbc.save.1') as string), 1)?.tutorials).toEqual(['link']);
    h.game.openFile(1);
    expect(h.game.state.character).toBe(LINK);
    pick(h, 0); // Link
    expect(h.top()).not.toBeInstanceOf(TrainingQuestionScene);
    h.until(() => h.top() instanceof LevelScene);
    h.game.returnToMap();
    pick(h, 1); // Samus
    expect(h.top()).toBeInstanceOf(TrainingQuestionScene);
    expect((h.top() as TrainingQuestionScene).hero).toBe(SAMUS);
  });

  it('validates the stored list: known heroes only, each once', () => {
    const raw = { ...newSave(1, 'mario'), tutorials: ['luigi', 'nobody', 'luigi', 3, 'ryu'] };
    expect(migrateSave(raw, 1)?.tutorials).toEqual(['luigi', 'ryu', 'mario']);
    expect(migrateSave({ ...raw, tutorials: 'luigi' }, 1)?.tutorials).toEqual(['mario']);
  });

  it('is never asked for Mario, nor outside campaign play', () => {
    const h = makeGame();
    file();
    h.game.openFile(1);
    pick(h, 0); // Mario on a new file
    expect(h.top()).not.toBeInstanceOf(TrainingQuestionScene);
    h.until(() => h.top() instanceof LevelScene);
    // The title's pick (?level=, custom levels) and dev starts: no question.
    h.game.showTitle();
    h.game.pendingLevel = '1-2';
    h.game.showCharacterSelect();
    h.idle(12);
    h.tap('right'); // Luigi
    h.tap('jump');
    expect(h.top()).not.toBeInstanceOf(TrainingQuestionScene);
    h.game.devStart('1-1', MARIO, 'small');
    h.until(() => h.top() instanceof LevelScene);
    (h.top() as LevelScene).world.events.push({ type: 'died' });
    h.game.quickRespawn = false;
    h.step();
    h.until(() => h.top() instanceof CharacterSelectScene);
    h.idle(12);
    h.tap('right');
    h.tap('jump');
    expect(h.top()).not.toBeInstanceOf(TrainingQuestionScene);
  });

  it('the pick after a death asks too, then respawns; YES and NO both record it', () => {
    const h = makeGame();
    file({ freed: ['mario', 'luigi', 'link'] });
    h.game.openFile(1);
    pick(h, 0);
    h.until(() => h.top() instanceof LevelScene);
    (h.top() as LevelScene).world.events.push({ type: 'died' });
    h.step();
    h.until(() => h.top() instanceof CharacterSelectScene);
    h.idle(12);
    h.tap('right'); // Luigi
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(TrainingQuestionScene);
    choose(h, 'Yes');
    skip(h);
    h.until(() => h.top() instanceof LevelScene);
    expect(h.game.state.character).toBe(LUIGI);
    expect(h.game.state.lives).toBe(2);
    expect(loadSave(1)?.tutorials).toEqual(['mario', 'luigi']);
  });

  it("after player one's room the map music is back for player two's pick", () => {
    const h = makeGame();
    file({ freed: ['mario', 'luigi'], character2: 'mario', lives: 5 });
    h.game.openFile(1);
    pick(h, 1);
    choose(h, 'Yes');
    skip(h);
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    expect(h.audio.playMusic).toHaveBeenLastCalledWith(mapPage('smb-1')?.music);
  });

  it("player two's pick on a two-player file asks for player two's hero", () => {
    const h = makeGame();
    file({ freed: ['mario', 'luigi'], character2: 'mario', lives: 5 });
    h.game.openFile(1);
    h.game.enterLevelFromMap('1-1');
    h.idle(12);
    h.tap('jump'); // P1 keeps Mario
    h.until(() => h.top() instanceof CharacterSelectScene && h.top() !== undefined);
    h.idle(12);
    h.tap('right', 1);
    h.tap('jump', 1);
    expect(h.top()).toBeInstanceOf(TrainingQuestionScene);
    h.idle(8);
    h.tap('jump', 1); // YES, from player two's controls
    // The stage answers to player two's input (player one's drives it too).
    expect(h.top()).toBeInstanceOf(HeroStageScene);
    expect((h.top() as HeroStageScene).hero).toBe(LUIGI);
  });
});

describe('training and the dev "All heroes" toggle', () => {
  it('a hero picked only through All heroes is not asked (or recorded); once freed, it is', () => {
    const h = makeGame();
    const settings = { dev: true } as Settings;
    h.game.deps.settings = settings;
    file();
    h.game.openFile(1);
    h.game.devAllHeroes = true;
    pick(h, 1); // Luigi, still a captive on the file
    expect(h.top()).not.toBeInstanceOf(TrainingQuestionScene);
    h.until(() => h.top() instanceof LevelScene);
    expect(h.game.state.character).toBe(LUIGI);
    h.game.returnToMap();
    expect(loadSave(1)?.tutorials).toEqual(['mario']);
    // Reopened while he is the file's hero: still not marked.
    const again = makeGame();
    again.game.deps.settings = settings;
    again.game.openFile(1);
    expect(again.game.state.character).toBe(LUIGI);
    expect(again.game.tutorials).toEqual(['mario']);
    // Freed for real, dev mode off: the real question comes.
    settings.dev = false;
    again.game.freeHero('luigi');
    again.game.state.character = MARIO;
    pick(again, 1);
    expect(again.top()).toBeInstanceOf(TrainingQuestionScene);
  });
});

describe('the basic kit and chapters', () => {
  it('the stage starts from the basic kit whatever the run holds; the run gets its own back', () => {
    const h = makeGame();
    file({ freed: ['mario', 'samus'], tutorials: ['mario', 'samus'] }, SAMUS.id);
    h.game.openFile(1);
    pick(h, 0);
    h.until(() => h.top() instanceof LevelScene);
    h.idle(30);
    // The run has found the Long Beam and the Missiles.
    const level = h.top() as LevelScene;
    Object.assign(level.world.player.scratch, { 'has-long-beam': 1, 'has-missiles': 1, missiles: 7 });
    h.tap('start');
    choose(h, 'Training');
    choose(h, 'Beginning');
    const stage = h.top() as HeroStageScene;
    expect(stage).toBeInstanceOf(HeroStageScene);
    const kit = { ...h.game.state.kit };
    expect(stage.world.player.scratch).toMatchObject(heroStart(SAMUS).kit);
    expect(stage.world.player.scratch['has-long-beam']).toBeUndefined();
    expect(stage.world.player.scratch['has-missiles']).toBeUndefined();
    skip(h);
    // The run's own kit, as the level's hero carries it.
    expect({ ...kit, ...h.game.state.kit }).toEqual(carriedKit(level.world.player));
    expect(level.world.player.scratch).toMatchObject({
      'has-long-beam': 1,
      'has-missiles': 1,
      missiles: 7,
    });
  });

  it('START AT a power-up gives the earlier ones quietly, and the run keeps its own kit', () => {
    const h = makeGame();
    file(
      { freed: ['mario', 'samus'], tutorials: ['mario', 'samus'], kit: { beam: 2, missiles: 5 } },
      SAMUS.id,
    );
    h.game.openFile(1);
    pick(h, 0);
    h.until(() => h.top() instanceof LevelScene);
    h.idle(30);
    const kit = { ...h.game.state.kit };
    h.tap('start');
    choose(h, 'Training');
    expect(items(h.top()).map((i) => i.label)).toEqual([
      'Beginning',
      'Energy Tank',
      'Long Beam',
      'Missiles',
      'Ice Beam',
      'Varia Suit',
      'Wave Beam',
    ]);
    choose(h, 'Wave Beam');
    const stage = h.top() as HeroStageScene;
    expect(stage.director.lesson?.id).toBe('wave-beam');
    // The earlier items, quietly: a tank, the beams, the missiles and the suit; not the Wave Beam.
    const p = stage.world.player;
    expect(p.scratch).toMatchObject({
      tanks: 1,
      'has-long-beam': 1,
      'has-missiles': 1,
      'has-ice-beam': 1,
      varia: 1,
    });
    expect(p.scratch['has-wave-beam']).toBeUndefined();
    expect(h.said.join(' ')).not.toMatch(/Energy Tank:/);
    // The stage's lessons change its kit...
    p.scratch.missiles = 0;
    skip(h);
    // ...but the run's kit is restored.
    expect(h.game.state.kit).toEqual(kit);
  });

  it('Skip chapter from the menu moves on to the next chapter; a skipped room ends as skipped', () => {
    const h = makeGame();
    file({ freed: ['mario', 'ryu'] });
    h.game.openFile(1);
    pick(h, 1);
    choose(h, 'Yes');
    const room = h.top() as PracticeRoomScene;
    expect(room.hero).toBe(RYU);
    const n = room.chapters.length;
    for (let c = 1; c < n; c++) {
      h.idle(4);
      h.tap('start');
      choose(h, 'Skip chapter');
      expect([room.phase, room.chapter]).toEqual(['chapter', c]);
    }
    h.idle(4);
    h.tap('start');
    choose(h, 'Skip chapter');
    // Past the last chapter: READY!, waiting for a button.
    expect(room.phase).toBe('ready');
    h.idle(200);
    expect(h.top()).toBe(room);
    h.tap('jump');
    h.until(() => h.top() instanceof LevelScene);
    expect(h.game.state.character).toBe(RYU);
  });
});

describe('pause → Training', () => {
  /** File 1 open, Link in 1-1, a few seconds in, then paused. */
  function paused(h: H) {
    file({ freed: ['mario', 'link'], tutorials: ['mario', 'link'] }, LINK.id);
    h.game.openFile(1);
    pick(h, 0);
    h.until(() => h.top() instanceof LevelScene);
    const level = h.top() as LevelScene;
    h.idle(90);
    h.tap('start');
    expect(h.top()).toBeInstanceOf(PauseScene);
    return level;
  }

  it("replays Link's stage over the paused level (START AT first), then returns to it exactly as it was", () => {
    const h = makeGame();
    const level = paused(h);
    const world = level.world;
    const time = world.time;
    const x = world.player.body.x;
    const before = { ...h.game.state, kit: { ...h.game.state.kit } };
    expect(items(h.top()).some((i) => i.label === 'Training')).toBe(true);
    const resume = vi.spyOn(h.audio, 'resume');
    choose(h, 'Training');
    // A replay: where to start, the beginning or any power-up.
    expect(h.top()).toBeInstanceOf(StartAtMenu);
    choose(h, 'Beginning');
    const stage = h.top() as HeroStageScene;
    expect(stage).toBeInstanceOf(HeroStageScene);
    expect(stage.hero).toBe(LINK);
    // The pause menu suspended the sound: the stage's music (Zelda II's field) plays.
    expect(resume).toHaveBeenCalled();
    expect(h.audio.playMusic).toHaveBeenLastCalledWith('zelda2-field');
    // Play in the stage for a while: the level stands still.
    for (let i = 0; i < 120; i++) h.step(i % 20 < 2 ? ['attack', 'right'] : ['right']);
    expect(world.time).toBe(time);
    expect(world.player.body.x).toBe(x);
    skip(h);
    expect(h.top()).toBe(level);
    expect(level.world).toBe(world);
    expect(world.time).toBe(time);
    expect({ ...h.game.state, kit: { ...h.game.state.kit } }).toEqual(before);
    expect(h.audio.playMusic).toHaveBeenLastCalledWith(level.level.music);
    // And the level plays on.
    h.idle(30);
    expect(world.time).toBeLessThan(time as number);
  });

  it('is offered only in campaign levels and not for Mario', () => {
    const h = makeGame();
    file();
    h.game.openFile(1);
    pick(h, 0);
    h.until(() => h.top() instanceof LevelScene);
    h.idle(8);
    h.tap('start');
    expect(items(h.top()).some((i) => i.label === 'Training')).toBe(false);
    h.game.devStart('1-1', LINK, 'full');
    h.until(() => h.top() instanceof LevelScene);
    h.idle(8);
    h.tap('start');
    expect(h.top()).toBeInstanceOf(PauseScene);
    expect(items(h.top()).some((i) => i.label === 'Training')).toBe(false);
  });

  it('works in the 1-1 bonus room too (any campaign level)', () => {
    const h = makeGame();
    file({ freed: ['mario', 'samus'], tutorials: ['mario', 'samus'] }, SAMUS.id);
    h.game.openFile(1);
    h.game.startLevel(getLevel('1-1-bonus'), { mode: 'fall', x: 1, y: 1, time: 300 });
    h.idle(60);
    h.tap('start');
    choose(h, 'Training');
    expect(h.top()).toBeInstanceOf(StartAtMenu);
    expect((h.game.scenes.find((sc) => sc instanceof HeroStageScene) as HeroStageScene).hero).toBe(SAMUS);
  });
});
