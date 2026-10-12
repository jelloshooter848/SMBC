import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { defaultSettings } from '@engine/save/settings';
import { LevelScene } from '@game/scenes/level';
import { CardScene } from '@game/scenes/message';
import { PauseScene } from '@game/scenes/pause';
import { WorldMapScene } from '@game/scenes/world-map';
import type { MenuItem } from '@game/scenes/menu';
import { HeroStageScene, StageMenu } from '@game/tutorial/hero-stage';
import { HERO_STAGES } from '@game/tutorial/heroes';
import { TIP_LOCK_FRAMES } from '@game/tutorial/tips';
import { MARIO_LESSONS } from '@game/tutorial/mario-1-0';
import type { TutorialDirector } from '@game/tutorial/stage-tutorial';
import { draw, file, makeGame, useStorage, type H } from './heroes-harness';
import { okTip, playTutorial, tipHeld } from './tutorial-bot';
import { choose, playStage, skipGreeting, startStage } from './stage-bot';
import { billBot } from './bots/bill';
import { linkBot } from './bots/link';
import { luigiBot } from './bots/luigi';
import { megamanBot } from './bots/megaman';
import { ryuBot } from './bots/ryu';
import { samusBot } from './bots/samus';
import { simonBot } from './bots/simon';
import { sophiaBot } from './bots/sophia';
import { ALL_STORY } from './story-seen';

// A new tip holds the game (0.4.45, owner #37: "pause the player every time a new instruction pops
// up, so nobody runs past it without reading"), in 1-0 and in all of the heroes' training stages,
// built once in the shared director (stage-tutorial.ts) and the tips hub (tips.ts): the world
// freezes until OK, never a timer; a short lock eats a press already under way; a tip seen again
// (a reset, a respawn) never holds again; NICE! never holds; MENU still pauses, and the tip is read.

useStorage();

const level = (h: H) => h.top() as LevelScene;

/** A campaign file on 1-0, Toad's greeting closed: the first tip is up. */
function on10(over: Parameters<typeof file>[0] = {}): H {
  const h = makeGame();
  file(over);
  h.game.openFile(1);
  h.idle(8);
  h.tap('jump');
  h.until(() => h.top() instanceof LevelScene, 300);
  h.until(() => h.top() instanceof CardScene, 60);
  for (let i = 0; i < 20 && h.top() instanceof CardScene; i++) {
    h.idle(32);
    h.tap('jump');
  }
  return h;
}

/** A snapshot of everything that moves in a world: its frame, the camera, every body. */
function snapshot(w: LevelScene['world']): string {
  return JSON.stringify([
    w.frame,
    w.camera.x,
    w.time,
    w.entities.map((e) => [e.kind, e.body.x, e.body.y, e.alive]),
    w.players.map((p) => [p.body.x, p.body.y, p.body.vx, p.body.vy]),
  ]);
}

const BOTS: Readonly<Record<string, () => (s: HeroStageScene) => Action[]>> = {
  link: linkBot,
  luigi: luigiBot,
  megaman: megamanBot,
  samus: samusBot,
  simon: simonBot,
  ryu: ryuBot,
  bill: billBot,
  sophia: sophiaBot,
};

describe('1-0: a new tip holds the game until OK', () => {
  it('the first tip freezes the world; held RIGHT, time and a held button never move it; only a press after the lock goes on', () => {
    const h = on10();
    const d = level(h).tutorial as TutorialDirector;
    expect(d.lesson?.id).toBe('walk');
    expect(tipHeld(h)).toBe(true);
    expect(h.said.at(-1)).toMatch(/^HOLD RIGHT TO WALK\. OK to continue\.$/);
    const w = level(h).world;
    const before = snapshot(w);
    // Ten seconds of holding RIGHT and RUN: nothing moves.
    for (let i = 0; i < 600; i++) h.step(['right', 'run']);
    expect(snapshot(w)).toBe(before);
    expect(tipHeld(h)).toBe(true);
    // The touch buttons: OK and MENU only.
    expect(level(h).touchLabels()).toMatchObject({ jump: 'OK', start: 'MENU', attack: null, special: null });
    // OK shows at the box's foot once a press will close it.
    expect(draw(level(h)).texts.map((t) => t.str)).toContain('OK');
  });

  it('the lock eats a press already under way; a held button never closes it; a new press does', () => {
    const h = makeGame();
    file();
    h.game.openFile(1);
    h.idle(8);
    h.tap('jump');
    h.until(() => h.top() instanceof LevelScene, 300);
    h.until(() => h.top() instanceof CardScene, 60);
    // Through the greeting with OK; the last press is held on into the tip.
    while (h.top() instanceof CardScene) {
      h.idle(32);
      h.step(['jump']);
      if (h.top() instanceof CardScene) h.step();
    }
    // Mashing OK through the lock: none of it counts.
    for (let i = 0; i < TIP_LOCK_FRAMES - 2; i++) h.step(i % 2 ? [] : ['jump']);
    expect(tipHeld(h)).toBe(true);
    // Held on past the lock: still held.
    for (let i = 0; i < 60; i++) h.step(['jump']);
    expect(tipHeld(h)).toBe(true);
    const y = level(h).world.player.body.y;
    h.step();
    h.step(['jump']);
    expect(tipHeld(h)).toBe(false);
    // The press that closed it never makes Mario jump.
    for (let i = 0; i < 20; i++) h.step(['jump']);
    expect(level(h).world.player.body.y).toBe(y);
    expect(level(h).world.player.body.onGround).toBe(true);
  });

  it('TALK closes it too; MENU opens the pause menu over it (LAST TIPS there), and it still holds after', () => {
    const h = on10();
    expect(tipHeld(h)).toBe(true);
    h.idle(TIP_LOCK_FRAMES + 1);
    h.tap('start');
    expect(h.top()).toBeInstanceOf(PauseScene);
    const items = (h.top() as unknown as { items: MenuItem[] }).items.map((i) => i.label);
    expect(items).toContain('Last tips');
    expect(items).toContain('Skip tutorial');
    choose(h, 'Continue');
    expect(h.top()).toBeInstanceOf(LevelScene);
    expect(tipHeld(h)).toBe(true);
    h.idle(4);
    h.tap('special');
    expect(tipHeld(h)).toBe(false);
  });

  it('Skip tutorial works while a tip holds the game', () => {
    const h = on10({ story: [...ALL_STORY] });
    expect(tipHeld(h)).toBe(true);
    h.idle(4);
    h.tap('start');
    choose(h, 'Skip tutorial');
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.game.tutorialRun).toBeNull();
    expect(h.game.mapProgress.cleared).toContain('1-0');
  });

  it('NICE! never holds on its own; the next tips do, once each, in order', () => {
    const h = on10();
    okTip(h);
    const held: string[] = [];
    let oldTipHeld = false;
    playTutorial(
      h,
      () => level(h).tutorial?.lesson?.id === 'block',
      9000,
      (s) => {
        held.push(s.tutorial?.lesson?.id ?? '');
        // What holds is always the new lesson's tip (NICE! may ride over it), never the one done.
        oldTipHeld ||= !s.tutorial?.tipUp;
      },
    );
    expect(oldTipHeld).toBe(false);
    const order = ['walk', 'jump', 'sprint', 'ease', 'gap1', 'gap2', 'stomp'];
    expect(held).toEqual([...held].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
    expect(new Set(held).size).toBe(held.length);
    expect(held).toContain('sprint');
    expect(held).toContain('stomp');
  });

  it('a quick player never does a lesson before its new tip holds the game (the bricks before their tip)', () => {
    const h = on10();
    okTip(h);
    const held: string[] = [];
    let bricksAtWall = -1;
    playTutorial(
      h,
      () => h.top() instanceof WorldMapScene,
      20000,
      (s) => {
        const id = s.tutorial?.lesson?.id ?? '';
        held.push(id);
        if (id === 'wall') bricksAtWall = s.world.feats.bricks;
      },
    );
    // The brick tip holds before Mario has broken a brick, straight after the slide's NICE!.
    expect(bricksAtWall).toBe(0);
    // Every lesson's tip held the game before it was done (a note never holds the bot up: it is
    // passed by walking on, so it may not).
    const lessons = MARIO_LESSONS.filter((l) => !l.note).map((l) => l.id);
    expect(['walk', ...held]).toEqual(expect.arrayContaining(lessons));
  });

  it('NICE! rides over the next tip while it holds, then goes with the OK', () => {
    const h = on10();
    okTip(h);
    playTutorial(h, () => level(h).tutorial?.lesson?.id === 'sprint' && tipHeld(h));
    expect(draw(level(h)).texts.some((t) => t.str === 'NICE!')).toBe(true);
    // Read out as one line, so the tip never cuts "Nice!" off.
    expect(h.said.at(-1)).toMatch(/^Nice! HOLD RUN .* OK to continue\.$/);
    okTip(h);
    h.idle(2);
    expect(draw(level(h)).texts.some((t) => t.str === 'NICE!')).toBe(false);
  });

  it("a tip seen again (a death, Toad's put-back) never holds again", () => {
    const h = on10();
    playTutorial(h, () => level(h).tutorial?.lesson?.id === 'stomp' && level(h).tutorial?.tipUp === true);
    if (tipHeld(h)) okTip(h);
    const w = level(h).world;
    w.kill(w.player);
    h.until(() => h.top() instanceof LevelScene && level(h).world !== w && level(h).world.frame > 30, 600);
    expect(level(h).tutorial?.lesson?.id).toBe('stomp');
    expect(h.said.some((t) => /^JUMP ON THE GOOMBA/.test(t))).toBe(true);
    expect(tipHeld(h)).toBe(false);
    for (let i = 0; i < 60; i++) {
      h.step();
      expect(tipHeld(h)).toBe(false);
    }
  });

  it('every tip is read out; the box keeps it on screen after OK', () => {
    const h = on10();
    const said = h.said.at(-1) ?? '';
    okTip(h);
    h.idle(30);
    expect(draw(level(h)).texts.some((t) => t.str.startsWith('HOLD RIGHT'))).toBe(true);
    expect(said).toMatch(/HOLD RIGHT TO WALK/);
    expect(h.game.tips.current?.said).toBe('HOLD RIGHT TO WALK.');
  });
});

describe('every training stage holds on a new tip', () => {
  for (const stage of Object.values(HERO_STAGES)) {
    it(`${stage.hero}: the first tip holds the stage until OK`, () => {
      const { h, stage: s } = startStage(stage.hero);
      skipGreeting(h);
      const st = s();
      expect(st.director.frozen).toBe(true);
      const before = snapshot(st.world);
      for (let i = 0; i < 300; i++) h.step(['right', 'attack']);
      expect(snapshot(st.world)).toBe(before);
      expect(st.touchLabels()).toMatchObject({ jump: 'OK', start: 'MENU' });
      // MENU → Skip this lesson works over it, and the next lesson's tip holds in turn.
      h.tap('start');
      expect(h.top()).toBeInstanceOf(StageMenu);
      choose(h, 'Continue');
      expect(st.director.frozen).toBe(true);
      okTip(h);
      expect(h.top()).toBeInstanceOf(HeroStageScene);
    });
  }

  for (const [hero, makeBot] of Object.entries(BOTS)) {
    it(`${hero}: the bot clears the stage, OK on each new tip; none holds twice, none mid-jump`, () => {
      const { h, stage } = startStage(hero);
      const s = stage();
      skipGreeting(h);
      const log = playStage(h, s, makeBot(), () => s.cleared, 40000);
      expect(s.cleared, `stuck at ${s.director.lesson?.id}`).toBe(true);
      expect(log.holds.length).toBeGreaterThan(2);
      const keys = log.holds.map((x) => x.lesson);
      // A lesson holds at most twice (its tip before and after its item is taken).
      for (const k of new Set(keys)) expect(keys.filter((x) => x === k).length, k).toBeLessThanOrEqual(2);
      for (const x of log.holds) expect(x.ground, `${x.lesson} held mid-jump`).toBe(true);
    });
  }

  it('Skip training works while a tip holds', () => {
    const { h, stage, ended } = startStage('link');
    skipGreeting(h);
    expect(stage().director.frozen).toBe(true);
    h.tap('start');
    choose(h, 'Skip training');
    expect(ended()).toBe(true);
  });

  it('the OK prompt follows the controls in use', () => {
    const { h, stage } = startStage('link');
    let scheme: 'keyboard' | 'touch' = 'keyboard';
    Object.assign(h.game.deps, { settings: defaultSettings(), controlScheme: () => scheme });
    skipGreeting(h);
    h.idle(TIP_LOCK_FRAMES + 2);
    const texts = () => draw(stage()).texts.map((t) => t.str);
    expect(texts()).toContain('OK (Z)');
    scheme = 'touch';
    expect(texts()).toContain('OK');
    expect(texts()).not.toContain('OK (Z)');
  });
});
