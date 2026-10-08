import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { mapPage } from '@content/worldmap';
import type { Action } from '@engine/input/actions';
import { tileAt, tileToSub, toPx } from '@engine/math/units';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { defaultSettings } from '@engine/save/settings';
import { WorldMapScene, mapHeaderLabel } from '@game/scenes/world-map';
import { LevelScene } from '@game/scenes/level';
import { IntroScene } from '@game/scenes/intro';
import { CardScene } from '@game/scenes/message';
import { PauseScene } from '@game/scenes/pause';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { FileSelectScene } from '@game/scenes/file-select';
import type { MenuItem } from '@game/scenes/menu';
import type { ControlScheme } from '@game/scenes/game';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { Goomba } from '@game/entities/enemies/goomba';
import { PowerUp } from '@game/entities/objects/powerup';
import { Toad } from '@game/entities/objects/toad';
import { isCleared, isOpen } from '@game/map/rules';
import type { WorldMapPage } from '@game/map/types';
import { loadSave, newSave, saveKey } from '@game/save/save-files';
import { MARIO_LESSONS, MARIO_TUTORIAL, TOAD_PAGES } from '@game/tutorial/mario-1-0';
import { ShadowTeaseScene, TEASE_LINES } from '@game/tutorial/tease';
import { BowserSpellScene } from '@game/story/bowser-spell';
import { BOWSER_SPELL_PAGES } from '@game/story/script';
import { STORY_TOAD_PAGES } from '@game/story/script';
import { plainText, wrapPrompt } from '@game/tutorial/stage-prompts';
import { stageTutorial } from '@game/tutorial/stage-tutorial';
import { draw, makeGame, store, useStorage, file, type H } from './heroes-harness';
import { ALL_STORY } from './story-seen';

// Mario's tutorial stage 1-0 (0.5.0): World 1's start node, where a new file begins; 1-1 opens
// once it is cleared (or skipped). Toad tells the story, the lessons follow one by one in a
// box at the top, and a brainwashed hero's shadow dashes past near the end.

useStorage();

const W1 = () => mapPage('smb-1') as WorldMapPage;
const level = (h: H) => h.top() as LevelScene;
const director = (h: H) => level(h).tutorial;

/** Title → Start game → slot 1 (a new file when it is empty). */
function newFileFromTitle(h: H) {
  h.game.showTitle();
  h.idle(8);
  h.tap('start');
  expect(h.top()).toBeInstanceOf(FileSelectScene);
  h.idle(8);
  h.tap('jump');
}

/** From the map on 1-0: JUMP enters it (no character select), the card, then the level. */
function enter10(h: H) {
  const m = h.top() as WorldMapScene;
  expect(m).toBeInstanceOf(WorldMapScene);
  expect(m.node).toBe('start');
  h.idle(8);
  h.tap('jump');
  expect(h.top()).not.toBeInstanceOf(CharacterSelectScene);
  h.until(() => h.top() instanceof LevelScene, 300);
  expect(level(h).level.id).toBe('1-0');
}

/** Pages through Toad's greeting with OK. */
function skipGreeting(h: H) {
  h.until(() => h.top() instanceof CardScene, 60);
  for (let i = 0; i < 20 && h.top() instanceof CardScene; i++) {
    h.idle(32);
    h.tap('jump');
  }
  expect(h.top()).toBeInstanceOf(LevelScene);
}

/**
 * A scripted Mario that plays every lesson as asked, reading the current lesson: walks and
 * hops the steps, takes a run at the gap, stomps the Goomba, bumps the ? block, grows, breaks a
 * brick, takes the pipe down and the side pipe up, and grabs the flagpole.
 */
function bot(h: H): Action[] {
  const top = h.top();
  if (!(top instanceof LevelScene)) return [];
  const d = top.tutorial;
  const w = top.world;
  const p = w.player;
  const b = p.body;
  const lesson = d?.lesson?.id ?? 'flag';
  const x = toPx(p.centerX);
  const out: Action[] = [];
  /** Walk to column `col`'s centre; true once there. */
  const goTo = (col: number, run = false): boolean => {
    const dx = col * 16 + 8 - x;
    if (Math.abs(dx) <= 3 && Math.abs(b.vx) < 256) return true;
    if (Math.abs(dx) > 3) out.push(dx > 0 ? 'right' : 'left');
    if (run) out.push('attack');
    return false;
  };
  /** Hold jump while rising (a full-height jump), press it on the ground. */
  const jump = () => {
    if (b.onGround ? (w.frame & 1) === 0 : b.vy < 0) out.push('jump');
  };
  const wallAhead = () => {
    const col = tileAt(b.x + b.w);
    const row = tileAt(b.y + b.h - 1);
    return w.map.isSolid(col + 1, row) || w.map.isSolid(col + 1, row - 1);
  };
  switch (lesson) {
    case 'walk':
      goTo(11);
      break;
    case 'jump':
      out.push('right');
      if (wallAhead() || !b.onGround) jump();
      break;
    case 'run': {
      out.push('right', 'attack');
      const col = tileAt(b.x + b.w);
      if ((col >= 23 && b.onGround) || (!b.onGround && b.vy < 0)) jump();
      break;
    }
    case 'stomp': {
      const g = w.entities.find((e): e is Goomba => e instanceof Goomba && e.alive);
      if (!g) {
        out.push('right');
        break;
      }
      // Stop short of it, hop as it comes close, and come down on top of it.
      const gap = toPx(g.body.x + (g.body.w >> 1)) - x;
      if (!b.onGround) {
        if (b.vy < 0) out.push('jump');
        if (Math.abs(gap) > 2) out.push(gap > 0 ? 'right' : 'left');
      } else if (gap > 72) out.push('right');
      else if (b.vx > 0) out.push('left');
      else if (gap <= 30) jump();
      break;
    }
    case 'block':
      if (goTo(50) || !b.onGround) jump();
      break;
    case 'grow': {
      const m = w.entities.find((e): e is PowerUp => e instanceof PowerUp && e.alive);
      if (m) {
        goTo(Math.floor(toPx(m.body.x + (m.body.w >> 1)) / 16));
        break;
      }
      if (x < 56 * 16) {
        out.push('right');
        if (wallAhead() || !b.onGround) jump();
        break;
      }
      if (goTo(59) || !b.onGround) jump();
      break;
    }
    case 'brick':
      if (x < 64 * 16) {
        out.push('right');
        if (wallAhead() || !b.onGround) jump();
        break;
      }
      if (goTo(68) || !b.onGround) jump();
      break;
    case 'pipe':
      if (x < 74 * 16) {
        out.push('right');
        break;
      }
      if (b.y + b.h > tileToSub(11)) {
        // Hop onto the pipe.
        if (goTo(74) || !b.onGround) jump();
        if (!b.onGround) out.push('right');
        break;
      }
      if (goTo(75) || x >= 75 * 16 + 4) out.push('down');
      break;
    case 'pipe-out':
      out.push('right');
      if ((wallAhead() && tileAt(b.x + b.w) < 11) || !b.onGround) jump();
      break;
    default:
      // The flag: run at it and jump.
      out.push('right', 'attack');
      if ((tileAt(b.x + b.w) >= 84 && b.onGround) || (!b.onGround && b.vy < 0)) jump();
  }
  return out;
}

/** Plays 1-0 with the bot until `stop`; cards and the tease go on with OK. */
function playTutorial(h: H, stop: () => boolean, max = 6000) {
  let frames = 0;
  for (; frames < max && !stop(); frames++) {
    const t = h.top();
    if (t instanceof CardScene) {
      h.step(frames % 40 === 39 ? ['jump'] : []);
      continue;
    }
    // The tease (Bowser's spell in the campaign) waits for OK once Bowser speaks (text never
    // moves by itself).
    if (t instanceof ShadowTeaseScene || t instanceof BowserSpellScene) {
      h.step(frames % 40 === 39 ? ['jump'] : []);
      continue;
    }
    h.step(bot(h));
  }
  expect(stop(), `stopped after ${frames} frames`).toBe(true);
}

describe('World 1 map: 1-0 is the start node', () => {
  it('a new file opens on the map with the hero on 1-0 and 1-1 locked (no story cards)', () => {
    const h = makeGame();
    newFileFromTitle(h);
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    const m = h.top() as WorldMapScene;
    expect(m.page.id).toBe('smb-1');
    expect(m.node).toBe('start');
    const start = W1().nodes.find((n) => n.id === 'start');
    expect(start?.level).toBe('1-0');
    expect(mapHeaderLabel(W1(), start ?? null)).toBe('WORLD 1-0');
    const p = h.game.mapProgress;
    expect(isOpen(p, W1(), 'start')).toBe(true);
    expect(isOpen(p, W1(), '1-1')).toBe(false);
    expect(m.nodeLabel(start!)).toBe('World 1-0, open');
    // Walking right goes nowhere yet.
    h.idle(8);
    h.tap('right');
    h.idle(30);
    expect(m.node).toBe('start');
  });

  it('JUMP enters 1-0 as Mario with no character select, whoever the file was using', () => {
    const h = makeGame();
    file({ character: LINK.id, freed: ['mario', 'link'], powerState: 'full', hp: 3 });
    h.game.openFile(1);
    expect(h.game.state.character).toBe(LINK);
    enter10(h);
    expect(h.game.state.character).toBe(MARIO);
    expect(h.game.state.powerState).toBe('small');
  });
});

describe('1-0: Toad, the lessons and the tease', () => {
  it('Toad greets Mario with the story in a box at the top, then the first lesson shows', () => {
    const h = makeGame();
    file();
    h.game.openFile(1);
    enter10(h);
    const lvl = level(h);
    expect(lvl.world.time).toBeNull();
    h.until(() => h.top() instanceof CardScene, 60);
    expect(lvl.world.entities.some((e) => e instanceof Toad)).toBe(true);
    const card = h.top() as CardScene;
    expect(card.lines.join(' ')).toMatch(/TOAD/);
    const all = TOAD_PAGES.flat().join(' ');
    expect(all).toMatch(/BOWSER HAS BRAINWASHED THE HEROES OF OTHER WORLDS/);
    expect(all).toMatch(/FIND THEM, TALK TO THEM AND FREE THEM/);
    // Where they hide (secret places), and the map's hint for a level that still hides one.
    expect(all).toMatch(/THEY HIDE IN SECRET PLACES: DOWN PIPES, UP VINES, BEHIND HIDDEN BLOCKS/);
    expect(all).toMatch(/IF A LEVEL HIDES SOMEONE YOU MISSED, LOOK CLOSELY AT THE MAP/);
    expect(TOAD_PAGES.length).toBeLessThanOrEqual(5);
    for (const page of TOAD_PAGES) expect(page.join(' ').length).toBeLessThanOrEqual(130);
    // The campaign tells the story's greeting (docs/STORY.md 2.1); TOAD_PAGES stay for other play.
    expect(card.lines).toEqual(STORY_TOAD_PAGES[0]);
    skipGreeting(h);
    expect(h.said.some((t) => t.startsWith(STORY_TOAD_PAGES[0]!.filter(Boolean).join(' ')))).toBe(true);
    expect(director(h)?.lesson?.id).toBe('walk');
    expect(h.said.at(-1)).toMatch(/HOLD RIGHT TO WALK/);
    // The greeting is not repeated after a respawn.
    level(h).world.kill(level(h).world.player);
    h.until(() => h.top() instanceof LevelScene && level(h).world.frame > 40, 600);
    expect(h.top()).toBeInstanceOf(LevelScene);
  });

  it("a scripted Mario does every lesson in order, sees Bowser's spell and reaches the flag", () => {
    const h = makeGame();
    file();
    h.game.openFile(1);
    enter10(h);
    const lives = h.game.state.lives;
    const seen: string[] = [];
    let teased = false;
    playTutorial(h, () => {
      const t = h.top();
      if (t instanceof BowserSpellScene) teased = true;
      if (t instanceof LevelScene) {
        const id = t.tutorial?.lesson?.id;
        if (id && seen.at(-1) !== id) seen.push(id);
        return t.world.flagGrabbedBy !== null;
      }
      return false;
    });
    const d = director(h)!;
    expect(seen).toEqual(MARIO_LESSONS.map((l) => l.id));
    expect(d.done).toEqual(MARIO_LESSONS.map((l) => l.id));
    expect(d.missed).toEqual([]);
    expect(teased).toBe(true);
    // The campaign's spell (docs/STORY.md 2.2): Bowser's pages, each read out.
    for (const page of BOWSER_SPELL_PAGES)
      expect(h.said.some((t) => t.startsWith(page.filter(Boolean).join(' ')))).toBe(true);
    expect(h.game.state.lives).toBe(lives);
    // The flag clears 1-0: back on the map, 1-1 drawn in.
    h.until(() => h.top() instanceof WorldMapScene, 1200);
    const p = h.game.mapProgress;
    expect(isCleared(p, W1(), 'start')).toBe(true);
    expect(isOpen(p, W1(), '1-1')).toBe(true);
    expect(loadSave(1)?.cleared).toEqual(['1-0']);
    expect(h.game.tutorialRun).toBeNull();
  });

  it('a fall into the gap drops Mario back in before it, with no life lost', () => {
    const h = makeGame();
    file();
    h.game.openFile(1);
    enter10(h);
    skipGreeting(h);
    const lives = h.game.state.lives;
    playTutorial(h, () => director(h)?.lesson?.id === 'run');
    // Walk (don't run) off the edge into the gap.
    const start = level(h);
    h.until(() => {
      h.step(['right']);
      return h.top() !== start;
    }, 600);
    h.until(() => h.top() instanceof LevelScene, 60);
    const w = level(h).world;
    expect(w.player.dead).toBe(false);
    expect(tileAt(w.player.body.x)).toBe(19);
    expect(director(h)?.lesson?.id).toBe('run');
    expect(h.game.state.lives).toBe(lives);
  });

  it('a death (the Goomba) respawns at the lesson with no life lost and no character select', () => {
    const h = makeGame();
    file();
    h.game.openFile(1);
    enter10(h);
    skipGreeting(h);
    playTutorial(h, () => director(h)?.lesson?.id === 'stomp');
    const lives = h.game.state.lives;
    level(h).world.kill(level(h).world.player);
    h.until(() => !(h.top() instanceof LevelScene), 400);
    expect(h.top()).toBeInstanceOf(IntroScene);
    h.until(() => h.top() instanceof LevelScene, 200);
    expect(h.game.state.lives).toBe(lives);
    expect(director(h)?.lesson?.id).toBe('stomp');
    expect(tileAt(level(h).world.player.body.x)).toBe(MARIO_LESSONS.find((l) => l.id === 'stomp')?.at);
  });

  it('Pause → Skip tutorial counts 1-0 cleared and opens 1-1 on the map', () => {
    const h = makeGame();
    file({ story: [...ALL_STORY] }); // Toad's World 1 entry: toad-guide.test.ts
    h.game.openFile(1);
    enter10(h);
    skipGreeting(h);
    h.tap('start');
    const pause = h.top() as PauseScene;
    expect(pause).toBeInstanceOf(PauseScene);
    const items = (pause as unknown as { items: MenuItem[] }).items;
    items.find((i) => i.label === 'Skip tutorial')?.select?.();
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    const p = h.game.mapProgress;
    expect(p.cleared).toEqual(['1-0']);
    expect(p.position).toEqual({ page: 'smb-1', node: 'start' });
    expect(h.game.pendingReveal).toEqual(['smb-1:start>1-1', 'smb-1:1-1']);
    h.until(() => !(h.top() as WorldMapScene).revealing, 600);
    expect(isOpen(p, W1(), '1-1')).toBe(true);
    expect(loadSave(1)?.cleared).toEqual(['1-0']);
    // Other levels have no such entry.
    h.game.enterLevelFromMap('1-0');
    h.until(() => h.top() instanceof LevelScene, 300);
    h.game.levelCleared('1-0');
    h.game.startLevel(getLevel('1-1'), { mode: 'stand' });
    h.step();
    h.tap('start');
    const items2 = (h.top() as PauseScene as unknown as { items: MenuItem[] }).items;
    expect(items2.some((i) => i.label === 'Skip tutorial')).toBe(false);
  });

  it('old files: any clear means 1-0 is cleared; they land on a valid node', () => {
    const h = makeGame();
    store.set(
      saveKey(1),
      JSON.stringify({
        ...newSave(1, 'mario'),
        cleared: ['1-1', '1-2'],
        position: { page: 'smb-1', node: '1-2' },
      }),
    );
    store.set(
      saveKey(2),
      JSON.stringify({ ...newSave(2, 'mario'), position: { page: 'smb-1', node: '1-1' } }),
    );
    h.game.openFile(1);
    const m = h.top() as WorldMapScene;
    expect(m.node).toBe('1-2');
    expect(isCleared(h.game.mapProgress, W1(), 'start')).toBe(true);
    expect(isOpen(h.game.mapProgress, W1(), '1-1')).toBe(true);
    h.game.openFile(2);
    expect((h.top() as WorldMapScene).node).toBe('start');
    expect(isOpen(h.game.mapProgress, W1(), '1-1')).toBe(false);
  });
});

describe("1-0 gives the file's own hero back", () => {
  const KIT = { maxHp: 12, tunic: 1, beam: 1, bombs: 8, magic: 4 };
  /** A Link file past the tutorial, with a full kit, on 1-0; entered as Mario. */
  function linkOn10(h: H) {
    file({
      character: LINK.id,
      freed: ['mario', 'link'],
      powerState: 'full',
      hp: 11,
      kit: KIT,
      cleared: ['1-0'],
    });
    h.game.openFile(1);
    enter10(h);
    expect(h.game.state.character).toBe(MARIO);
    // Saved as the file had it, even while Mario plays.
    expect(loadSave(1)?.character).toBe('link');
    expect(loadSave(1)?.kit).toEqual(KIT);
  }
  const expectLink = (h: H) => {
    const s = h.game.state;
    expect([s.character, s.powerState, s.hp, s.kit]).toEqual([LINK, 'full', 11, KIT]);
    const saved = loadSave(1);
    expect([saved?.character, saved?.powerState, saved?.hp, saved?.kit]).toEqual(['link', 'full', 11, KIT]);
  };

  it('after Pause → Quit to map', () => {
    const h = makeGame();
    linkOn10(h);
    skipGreeting(h);
    h.tap('start');
    (h.top() as PauseScene as unknown as { items: MenuItem[] }).items
      .find((i) => i.label === 'Quit to map')
      ?.select?.();
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expectLink(h);
  });

  it('after clearing it at the flagpole', () => {
    const h = makeGame();
    linkOn10(h);
    playTutorial(h, () => h.top() instanceof WorldMapScene, 8000);
    expectLink(h);
  });

  it('after Skip tutorial, and after Save and quit', () => {
    const h = makeGame();
    linkOn10(h);
    skipGreeting(h);
    h.game.skipTutorial();
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expectLink(h);
    const h2 = makeGame();
    linkOn10(h2);
    h2.game.saveAndQuit();
    expectLink(h2);
  });
});

describe('1-0 outside the campaign', () => {
  it('another hero (dev select) plays it as a plain stage: no lessons, no tutorial run', () => {
    const h = makeGame();
    h.game.devStart('1-0', LINK, 'full');
    h.until(() => h.top() instanceof LevelScene, 300);
    h.idle(60);
    expect(h.top()).toBeInstanceOf(LevelScene);
    expect(director(h)).toBeNull();
    expect(h.game.tutorialRun).toBeNull();
    h.tap('start');
    const items = (h.top() as PauseScene as unknown as { items: MenuItem[] }).items;
    expect(items.some((i) => i.label === 'Skip tutorial')).toBe(false);
  });

  it('?level=1-0 / dev select play it, nothing saves; its exit goes on to 1-1', () => {
    const h = makeGame();
    h.game.devStart('1-0', MARIO, 'small');
    h.until(() => h.top() instanceof LevelScene, 300);
    expect(director(h)).not.toBeNull();
    playTutorial(h, () => h.top() instanceof IntroScene && h.game.state.stage === 1, 8000);
    expect(h.game.state.world).toBe(1);
    expect([...store.keys()].filter((k) => k.startsWith('smbc.save.'))).toEqual([]);
    expect(h.game.tutorialRun).toBeNull();
  });

  it('Skip tutorial outside the campaign goes on to 1-1', () => {
    const h = makeGame();
    h.game.newGame(MARIO, '1-0');
    h.until(() => h.top() instanceof LevelScene, 300);
    skipGreeting(h);
    h.tap('start');
    const items = (h.top() as PauseScene as unknown as { items: MenuItem[] }).items;
    items.find((i) => i.label === 'Skip tutorial')?.select?.();
    h.until(() => h.top() instanceof LevelScene, 300);
    expect(level(h).level.id).toBe('1-1');
    expect(level(h).tutorial).toBeNull();
  });
});

describe('lessons: co-op, NICE!, a Goomba that is gone', () => {
  it('co-op: a partner with hit points does not count as grown; Mario does', () => {
    const grow = MARIO_LESSONS.find((l) => l.id === 'grow')!;
    const h = makeGame();
    h.game.newGame(MARIO, '1-0', LINK);
    h.until(() => h.top() instanceof LevelScene, 300);
    const w = level(h).world;
    expect(director(h)).not.toBeNull();
    expect(w.players[1]?.def).toBe(LINK);
    expect(grow.done(w)).toBe(false);
    w.player.powerState = 'big';
    expect(grow.done(w)).toBe(true);
  });

  it('"NICE!" shows over the lesson just done, then the next one comes', () => {
    const h = makeGame();
    h.game.devStart('1-0', MARIO, 'small');
    h.until(() => h.top() instanceof LevelScene, 300);
    skipGreeting(h);
    const drawn = () => {
      const texts: string[] = [];
      const r: Renderer = Object.assign(new NullRenderer(), {
        text(_f: SpriteSheet, str: string): void {
          texts.push(str);
        },
      });
      h.top()?.render(r);
      return texts;
    };
    playTutorial(h, () => director(h)?.lesson?.id === 'jump');
    let t = drawn();
    expect(t).toContain('NICE!');
    expect(t.some((x) => x.startsWith('HOLD RIGHT'))).toBe(true);
    expect(h.said.at(-1)).toBe('Nice!');
    h.idle(61);
    t = drawn();
    expect(t).not.toContain('NICE!');
    expect(t.some((x) => x.startsWith('PRESS JUMP'))).toBe(true);
    expect(h.said.at(-1)).toMatch(/^PRESS JUMP/);
  });

  it('the stomp lesson moves on once its Goomba is gone', () => {
    const h = makeGame();
    h.game.devStart('1-0', MARIO, 'small');
    h.until(() => h.top() instanceof LevelScene, 300);
    skipGreeting(h);
    playTutorial(h, () => director(h)?.lesson?.id === 'stomp');
    const w = level(h).world;
    h.until(() => w.entities.some((e) => e instanceof Goomba && e.alive), 300);
    for (const e of w.entities) if (e instanceof Goomba) e.destroy();
    w.player.body.x = tileToSub(39);
    h.step();
    expect(director(h)?.missed).toEqual(['stomp']);
    expect(director(h)?.lesson?.id).toBe('block');
  });
});

describe('the prompts name abilities, never buttons', () => {
  /** A button named by its letter ("A", "BUTTON B", "press B", "(A)"). */
  const LETTER = /\b(BUTTON|PRESS|PUSH|TAP|HOLD)\s+[ABC]\b|\([ABC]\)|\b[ABC]\s*[:/]/;

  /** The lines the box shows for each lesson, in scheme `scheme`. */
  function prompts(scheme: ControlScheme): string[][] {
    const h = makeGame();
    Object.assign(h.game.deps, { settings: defaultSettings(), controlScheme: () => scheme });
    h.game.devStart('1-0', MARIO, 'small');
    h.until(() => h.top() instanceof LevelScene, 300);
    const d = director(h)!;
    return MARIO_LESSONS.map((_, i) => {
      d.run.lesson = i;
      (d as unknown as { tracker: { index: number }; shown: number }).tracker.index = i;
      (d as unknown as { shown: number }).shown = i;
      return d.lines();
    });
  }

  it('touch shows the touch buttons’ own captions; keyboard adds the key after the ability', () => {
    const touch = prompts('touch');
    const keys = prompts('keyboard');
    const run = MARIO_LESSONS.findIndex((l) => l.id === 'run');
    // On touch the run lesson says how the pad runs: a push far to the side (or the RUN button).
    expect(touch[run]?.join(' ')).toBe(
      'TO RUN, PUSH THE D-PAD FAR TO THE SIDE OR HOLD RUN. THEN JUMP OVER THE GAP.',
    );
    expect(touch[run]?.length).toBeLessThanOrEqual(3);
    expect(keys[run]?.join(' ')).toBe('HOLD RUN (X) TO RUN, THEN JUMP (Z) OVER THE GAP.');
    expect(prompts('gamepad')[run]?.join(' ')).not.toContain('D-PAD');
    for (const l of MARIO_LESSONS) if (l.id !== 'run') expect(l.touchText, l.id).toBeUndefined();
    for (const lines of [...touch, ...keys]) {
      for (const l of lines) {
        expect(l, l).not.toMatch(LETTER);
        expect(l.length).toBeLessThanOrEqual(28);
      }
    }
    for (const l of MARIO_LESSONS) expect(plainText(l.text)).not.toMatch(LETTER);
    for (const l of [...TOAD_PAGES.flat(), ...TEASE_LINES]) expect(l).not.toMatch(LETTER);
  });

  it("Toad's OK prompt follows the controls in use, even mid-dialogue", () => {
    const h = makeGame();
    let scheme: ControlScheme = 'keyboard';
    Object.assign(h.game.deps, { settings: defaultSettings(), controlScheme: () => scheme });
    h.game.devStart('1-0', MARIO, 'small');
    h.until(() => h.top() instanceof CardScene, 300);
    h.idle(40);
    const texts = () => draw(h.top() as CardScene).texts.map((t) => t.str);
    expect(texts()).toContain('OK (Z)');
    scheme = 'touch';
    expect(texts()).toContain('OK');
    expect(texts()).not.toContain('OK (Z)');
  });

  it('wrapPrompt keeps punctuation after a key on the key ("RUN (X)," not "RUN (X) ,")', () => {
    expect(wrapPrompt('HOLD RIGHT AND RUN (X), LET GO BEFORE THE GAP AND WATCH LUIGI SLIDE!', 25)).toEqual([
      'HOLD RIGHT AND RUN (X),',
      'LET GO BEFORE THE GAP AND',
      'WATCH LUIGI SLIDE!',
    ]);
  });

  it('wrapPrompt keeps an ability with its key on one line', () => {
    expect(wrapPrompt('HOLD RUN (RIGHT SHIFT) TO RUN, THEN JUMP (Z) OVER THE GAP.', 20)).toEqual([
      'HOLD',
      'RUN (RIGHT SHIFT) TO',
      'RUN, THEN JUMP (Z)',
      'OVER THE GAP.',
    ]);
  });

  it('the box is drawn near the top of the screen, under the HUD', () => {
    const h = makeGame();
    h.game.devStart('1-0', MARIO, 'small');
    h.until(() => h.top() instanceof LevelScene, 300);
    skipGreeting(h);
    h.step();
    const texts: { str: string; y: number }[] = [];
    const r: Renderer = Object.assign(new NullRenderer(), {
      text(_f: SpriteSheet, str: string, _x: number, y: number): void {
        texts.push({ str, y });
      },
    });
    h.top()?.render(r);
    const prompt = texts.find((t) => t.str.startsWith('HOLD RIGHT'));
    expect(prompt?.y).toBeGreaterThanOrEqual(40);
    expect(prompt?.y).toBeLessThan(80);
  });
});

describe('the tutorial registry', () => {
  it('1-0 is Mario’s; no other level has one', () => {
    expect(stageTutorial('1-0')).toBe(MARIO_TUTORIAL);
    expect(MARIO_TUTORIAL.hero).toBe('mario');
    expect(stageTutorial('1-1')).toBeNull();
    expect(getLevel('1-0').stage).toBe(0);
    expect(getLevel('1-0-pipe').parent).toBe('1-0');
  });
});
