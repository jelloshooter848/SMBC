import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import type { LevelData } from '@game/level/schema';
import { LevelScene, CRYSTAL_BALL_CARD } from '@game/scenes/level';
import { CardScene, CARD_GUARD_FRAMES } from '@game/scenes/message';
import { captiveDialogue, CARD_COLS } from '@game/scenes/free-hero';
import type { MiniGameDef } from '@game/minigames';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { Larry } from '@game/entities/enemies/larry';
import { CrystalBall } from '@game/entities/objects/crystal-ball';
import { fontText, wrapText } from '@game/hud/text';
import { loadSave } from '@game/save/save-files';
import { beat } from '@game/story/beats';
import { BowserSaysScene, BRIDGE_ROOM, inCampaignLook } from '@game/story/level-beats';
import {
  LARRY_PAGES,
  noMoreStandIns,
  RESTYLE_PAGES,
  STORY_CRYSTAL_BALL_PAGES,
  STORY_TEASE_PAGES,
  STORY_TOAD_PAGES,
} from '@game/story/script';
import { TOAD_PAGES } from '@game/tutorial/mario-1-0';
import {
  ShadowTeaseScene,
  TEASE_FRAMES,
  TEASE_LAST_FRAMES,
  TEASE_LINES,
  TEASE_PAGE_FRAMES,
} from '@game/tutorial/tease';
import { wrapPrompt } from '@game/tutorial/stage-prompts';
import { closeCards, draw, file, makeGame, useStorage, type H } from './heroes-harness';

// The Chapter 1 story's lines in 1-0, the heroes' first cards, Larry, the restyled levels and
// 8-4's bridge room (docs/STORY.md 2.1, 2.2, 2.3a item 5, 2.3b, 2.7, 2.8, 2.13): campaign only,
// everywhere else the old text.

useStorage();

/** A campaign file (no story beats seen unless given) opened, standing on the map. */
function campaign(story: string[] = [], over: Parameters<typeof file>[0] = {}): H {
  const h = makeGame();
  file({ story, ...over });
  h.game.openFile(1);
  h.idle(4);
  return h;
}

/** Straight into `level` (as a pipe or the map's level start does), one frame on. */
function start(h: H, level: LevelData | string): LevelScene {
  h.game.startLevel(typeof level === 'string' ? getLevel(level) : level, { mode: 'stand' });
  const scene = h.game.scenes.top as LevelScene;
  expect(scene).toBeInstanceOf(LevelScene);
  h.step();
  return scene;
}

/** Into 1-0 from the map (the tutorial's greeting comes first). */
function enter10(h: H): void {
  h.game.enterLevelFromMap('1-0');
  h.until(() => h.top() instanceof CardScene, 400);
}

const texts = (h: H) => draw(h.top() as { render(r: never): void }).texts.map((t) => t.str);

describe('1-0: Toad’s greeting', () => {
  it('the campaign shows the story’s four pages, each read out', () => {
    const h = campaign();
    enter10(h);
    expect(closeCards(h)).toEqual(STORY_TOAD_PAGES);
    for (const page of STORY_TOAD_PAGES)
      expect(h.said.some((t) => t.startsWith(page.filter(Boolean).join(' ')))).toBe(true);
  });

  it('outside the campaign the old five pages show, unchanged', () => {
    const h = makeGame();
    h.game.newGame(MARIO, '1-0');
    h.until(() => h.top() instanceof CardScene, 400);
    const fit = (p: readonly string[]) => p.flatMap((l) => (l.trim() === '' ? [''] : wrapText(l, CARD_COLS)));
    expect(closeCards(h)).toEqual(TOAD_PAGES.map(fit));
    expect(h.said.some((t) => /BOWSER HAS BRAINWASHED THE HEROES/.test(t))).toBe(true);
  });
});

describe('1-0: Bowser’s shadow tease', () => {
  /** The tease pushed over a level; `ended` turns true when it calls back. */
  function tease(h: H, level: LevelScene) {
    const state = { ended: false };
    const scene = new ShadowTeaseScene(h.game, level.world, LINK, () => {
      state.ended = true;
      h.game.scenes.pop();
    });
    h.game.scenes.push(scene);
    return { scene, state };
  }
  const boxShows = 110 + 30 + 1;
  const linesOf = (page: readonly string[]) => page.flatMap((l) => wrapPrompt(l));

  it('campaign: page 1, turned by OK, then page 2, ended by OK; each read out', () => {
    const h = campaign();
    const { scene, state } = tease(h, start(h, '1-1'));
    h.idle(boxShows);
    expect(texts(h)).toEqual(expect.arrayContaining(linesOf(STORY_TEASE_PAGES[0]!)));
    // The same words as every story box: OK for the next page, BACK skips.
    expect(h.said.at(-1)).toBe(
      "BOWSER: BWA HA HA! MY KOOPAS COULDN'T FIND THAT PRINCESS. FINE! OK for more, BACK to skip.",
    );
    h.idle(CARD_GUARD_FRAMES);
    h.tap('jump');
    expect(h.top()).toBe(scene);
    expect(texts(h)).toEqual(expect.arrayContaining(linesOf(STORY_TEASE_PAGES[1]!)));
    expect(h.said.at(-1)).toMatch(/^THESE HEROES DON'T THINK.* OK to continue\.$/);
    h.idle(CARD_GUARD_FRAMES);
    expect(state.ended).toBe(false);
    h.tap('jump');
    expect(state.ended).toBe(true);
    expect(h.said.some((t) => t.includes(TEASE_LINES[1]!))).toBe(false);
  });

  it('campaign: the pages turn and end by themselves; a press during the dash skips to Bowser', () => {
    const h = campaign();
    const { state } = tease(h, start(h, '1-1'));
    h.idle(CARD_GUARD_FRAMES + 2);
    h.tap('jump');
    // Not over: straight on to Bowser's words.
    expect(state.ended).toBe(false);
    expect(h.said.at(-1)).toMatch(/^BOWSER: BWA HA HA!/);
    h.idle(30 + TEASE_PAGE_FRAMES + 1);
    expect(texts(h)).toEqual(expect.arrayContaining(linesOf(STORY_TEASE_PAGES[1]!)));
    h.idle(TEASE_LAST_FRAMES + 1);
    expect(state.ended).toBe(true);
  });

  it('outside the campaign: the old line, one page, over after TEASE_FRAMES', () => {
    const h = makeGame();
    h.game.newGame(MARIO, '1-1');
    h.until(() => h.top() instanceof LevelScene, 400);
    const { state } = tease(h, h.top() as LevelScene);
    h.idle(boxShows);
    expect(texts(h)).toEqual(expect.arrayContaining(TEASE_LINES.flatMap((l) => wrapPrompt(l))));
    expect(h.said).toContain(TEASE_LINES.join(' '));
    h.idle(TEASE_FRAMES - boxShows);
    expect(state.ended).toBe(true);
    expect(h.said.some((t) => t.includes('MY KOOPAS'))).toBe(false);
  });
});

describe('the heroes’ first card (2.13) and Simon’s curse (2.8)', () => {
  const def: MiniGameDef = {
    hero: 'x',
    title: 'A RACE',
    rules: [],
    create: () => ({ update() {}, render() {} }),
  };
  it.each(CHARACTERS.map((c) => [c.id, c] as const))(
    '%s: ...MUST FIND THE PRINCESS... after SERVES',
    (_id, c) => {
      const [first] = captiveDialogue(c, def, MARIO);
      const name = fontText(c.name);
      expect(first).toEqual([
        `${name}:`,
        '',
        `...${name} SERVES`,
        'KING KOOPA...',
        '...MUST FIND',
        'THE PRINCESS...',
      ]);
    },
  );

  it('Simon blames the stolen wand, not Larry', () => {
    const simon = CHARACTERS.find((c) => c.id === 'simon')!;
    const own = captiveDialogue(simon, def, MARIO)[1]!;
    expect(own.slice(2, 5)).toEqual([
      'THE STOLEN WAND WOKE THE',
      'CURSE DRACULA LEFT IN MY',
      'BLOOD. NOW I AM HIS THRALL.',
    ]);
  });
});

describe('Larry in his room (2.7)', () => {
  it('outside the campaign he says nothing and the old crystal ball card shows', () => {
    const h = makeGame();
    h.game.devStart('4-2-larry', MARIO, 'big');
    h.until(() => h.top() instanceof LevelScene, 400);
    const level = h.top() as LevelScene;
    h.until(() => level.world.entities.some((e) => e instanceof Larry), 200);
    h.idle(30);
    expect(h.top()).toBe(level);
    expect(h.said.some((t) => t.includes('LOUSY SPARE'))).toBe(false);
    // The ball: dropped straight away here, the old one-page card.
    const larry = level.world.entities.find((e): e is Larry => e instanceof Larry)!;
    level.world.player.invuln = 100000;
    for (let n = 0; n < 3; n++) {
      h.until(() => !larry.inShell, 400);
      larry.hit({ kind: 'stomp', amount: 1, owner: null, dirX: 1 }, level.world);
    }
    h.until(() => level.world.entities.some((e) => e instanceof CrystalBall && e.body.onGround), 300);
    const ball = level.world.entities.find((e): e is CrystalBall => e instanceof CrystalBall)!;
    const p = level.world.player;
    p.body.x = ball.body.x;
    p.body.y = ball.body.y + ball.body.h - p.body.h;
    h.step();
    expect((h.top() as CardScene).lines).toEqual(CRYSTAL_BALL_CARD);
    expect(h.said.some((t) => t.includes('LARRY DROPPED'))).toBe(false);
  });

  it('campaign: his two pages as he rises out of the pipe, every run (not once per file)', () => {
    for (let run = 0; run < 2; run++) {
      const h = campaign([beat.bowser84]);
      h.game.startLevel(getLevel('4-2-larry'), { mode: 'pipe-exit', x: 2, y: 12 });
      const room = h.top() as LevelScene;
      h.until(() => h.top() !== room, 200);
      expect(room.world.player.frozen).toBe(false);
      expect(closeCards(h)).toEqual(LARRY_PAGES);
      expect(h.top()).toBe(room);
      expect(h.game.airship?.larrySpoke).toBe(true);
    }
    expect(STORY_CRYSTAL_BALL_PAGES).toHaveLength(2);
  });
});

describe('restyled levels: Toad’s remark (2.3b)', () => {
  it('7-3 (its look registered): once per file, before play, saved on the file', () => {
    const h = campaign();
    const level = start(h, '7-3');
    expect(level.world.level.theme).not.toBe('overworld');
    expect(h.top()).toBeInstanceOf(CardScene);
    expect((h.top() as CardScene).lines).toEqual(RESTYLE_PAGES['7-3']);
    expect(h.said.at(-1)).toMatch(/^TOAD: CANNON COAST TURNED INTO A JUNGLE/);
    const frame = level.world.frame;
    h.idle(20);
    expect(level.world.frame).toBe(frame); // the level waits
    expect(closeCards(h)).toHaveLength(1);
    expect(h.top()).toBe(level);
    expect(loadSave(1)?.story).toContain(beat.restyle('7-3'));
    // Not again on this file: a restart, a reload.
    start(h, '7-3');
    expect(h.top()).toBeInstanceOf(LevelScene);
    h.game.openFile(1);
    h.idle(4);
    start(h, '7-3');
    expect(h.top()).toBeInstanceOf(LevelScene);
  });

  it('not in its sub-areas, not outside the campaign, not on an old file that cleared it', () => {
    const h = campaign();
    start(h, '7-3-camp');
    expect(h.top()).toBeInstanceOf(LevelScene);
    expect(h.game.seen(beat.restyle('7-3'))).toBe(false);

    const dev = makeGame();
    dev.game.newGame(MARIO, '7-3');
    dev.until(() => dev.top() instanceof LevelScene, 400);
    dev.idle(10);
    expect(dev.top()).toBeInstanceOf(LevelScene);

    const old = makeGame();
    file({ cleared: ['1-0', '7-3'] });
    old.game.openFile(1);
    old.idle(4);
    start(old, '7-3');
    expect(old.top()).toBeInstanceOf(LevelScene);
  });

  it('keyed on the look: a remark level shows it only once its campaign look is on', () => {
    const look = getLevel('7-3').campaignLook!;
    const base = getLevel('2-1');
    const looked: LevelData = { ...base, campaignLook: { theme: look.theme } };
    const plain: LevelData = { ...base };
    delete plain.campaignLook;
    const unknown: LevelData = { ...base, campaignLook: { theme: 'not-a-theme' } };
    expect(inCampaignLook(looked)).toBe(true);
    expect(inCampaignLook(plain)).toBe(false);
    expect(inCampaignLook(unknown)).toBe(false);
    for (const level of [plain, unknown]) {
      const h = campaign();
      start(h, level);
      expect(h.top()).toBeInstanceOf(LevelScene);
      expect(h.game.seen(beat.restyle('2-1'))).toBe(false);
    }
    const h = campaign();
    start(h, looked);
    expect((h.top() as CardScene).lines).toEqual(RESTYLE_PAGES['2-1']);
    // Every remark level has its card.
    expect(Object.keys(RESTYLE_PAGES).sort()).toEqual(['2-1', '3-1', '4-2', '5-4', '6-2', '7-3']);
  });
});

describe('8-4’s bridge room: the real king (2.3a item 5)', () => {
  it('campaign: Bowser speaks in the prompt box before the fight, once per file; BACK closes', () => {
    const h = campaign([], { character: LINK.id, freed: ['mario', 'link'] });
    const room = start(h, BRIDGE_ROOM);
    const box = h.top() as BowserSaysScene;
    expect(box).toBeInstanceOf(BowserSaysScene);
    expect(box.lines).toEqual(noMoreStandIns('LINK'));
    expect(texts(h)).toEqual(expect.arrayContaining([...noMoreStandIns('LINK')]));
    expect(h.said.at(-1)).toBe(
      "BOWSER: NO MORE STAND-INS, LINK. THIS TIME IT'S REALLY ME! BWA HA HA! OK to continue.",
    );
    const frame = room.world.frame;
    h.idle(CARD_GUARD_FRAMES);
    expect(room.world.frame).toBe(frame);
    h.tap('attack');
    expect(h.top()).toBe(room);
    expect(loadSave(1)?.story).toContain(beat.bowser84);
    start(h, BRIDGE_ROOM);
    expect(h.top()).toBeInstanceOf(LevelScene);
  });

  it('outside the campaign, and on a file that beat 8-4, he says nothing', () => {
    const h = makeGame();
    h.game.newGame(MARIO, '8-4');
    h.until(() => h.top() instanceof LevelScene, 400);
    start(h, BRIDGE_ROOM);
    expect(h.top()).toBeInstanceOf(LevelScene);
    const old = makeGame();
    file({ cleared: ['8-4'] });
    old.game.openFile(1);
    old.idle(4);
    start(old, BRIDGE_ROOM);
    expect(old.top()).toBeInstanceOf(LevelScene);
  });
});
