import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { px } from '@engine/math/units';
import { CHARACTERS } from '@game/characters/registry';
import { LevelScene } from '@game/scenes/level';
import { LARRY_PAGES, STORY_CRYSTAL_BALL_PAGES } from '@game/story/script';
import { CardScene } from '@game/scenes/message';
import { IntroScene } from '@game/scenes/intro';
import { WorldMapScene } from '@game/scenes/world-map';
import { MenuScene, type MenuItem } from '@game/scenes/menu';
import { PauseScene } from '@game/scenes/pause';
import { TitleScene } from '@game/scenes/title';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { MiniGameMenuScene } from '@game/minigames/menu';
import { DevMiniGameResultScene, DevMiniGamesScene } from '@game/scenes/dev-minigames';
import { AIRSHIP_DECK, AIRSHIP_ROOM } from '@game/scenes/airship';
import { Larry } from '@game/entities/enemies/larry';
import { CrystalBall } from '@game/entities/objects/crystal-ball';
import type { SaveFile } from '@game/save/save-files';
import { snapshot } from '@game/scenes/free-hero';
import {
  closeCards,
  draw,
  file,
  makeGame,
  offered,
  rideToStern,
  store,
  useStorage,
  type H,
} from './heroes-harness';

// Larry's airship challenge (scenes/airship.ts, docs/HEROES.md "Larry's airship"): the
// auto-scrolling deck `4-2-airship` and Larry's room `4-2-larry`, played with the current hero
// as real levels; a death costs no life and asks TRY AGAIN? YES / NO; MENU is Continue / Give up.

useStorage();

const W3 = ['1-0', '1-1', '1-2', '1-3', '1-4', '2-1', '2-2', '2-3', '2-4', '3-1', '3-2', '3-3', '3-4'];
const world4 = (over: Partial<SaveFile> = {}): Partial<SaveFile> => ({
  cleared: [...W3, '4-1'],
  pages: ['smb-1', 'smb-2', 'smb-3', 'smb-4'],
  position: { page: 'smb-4', node: '4-2' },
  lives: 4,
  ...over,
});

const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const pick = (h: H, label: string) => {
  const menu = h.top() as MenuScene;
  const row = items(menu).findIndex((i) => i.label === label);
  expect(row, label).toBeGreaterThanOrEqual(0);
  h.idle(8);
  for (let i = 0; i < row; i++) h.tap('down');
  h.tap('jump');
};

/** Dev → Mini games → Larry's airship, then OK on the hero character select preselects. */
const playAirship = (h: H) => {
  pick(h, "Larry's airship");
  expect(h.top()).toBeInstanceOf(CharacterSelectScene);
  h.idle(12);
  h.tap('jump');
};

/** A World 4 campaign file, in 4-2 past its checkpoint with a fire flower, 1234 points and 4 lives. */
function in42(over: Partial<SaveFile> = {}): { h: H; main: LevelScene } {
  const h = makeGame();
  h.game.deps.settings = { dev: false } as Settings;
  file(world4(over));
  h.game.openFile(1);
  h.idle(8);
  expect(h.top()).toBeInstanceOf(WorldMapScene);
  h.game.state.powerState = 'fire';
  h.game.state.score = 1234;
  h.game.state.checkpoint = { level: '4-2', x: 98, y: 12 };
  h.game.startLevel(getLevel('4-2'), { mode: 'stand', x: 98, y: 12, time: 250, clearEnemies: 'all' });
  h.step();
  const main = h.top() as LevelScene;
  expect(main.level.id).toBe('4-2');
  return { h, main };
}

/** Board the deck, standing on its bow (the campaign climbs the anchor chain to the same spot). */
function board(h: H): LevelScene {
  h.game.state.time = 250;
  const { x, y } = getLevel(AIRSHIP_DECK).start;
  h.game.startLevel(getLevel(AIRSHIP_DECK), { x, y, mode: 'stand' });
  h.step();
  const deck = h.top() as LevelScene;
  expect(deck.level.id).toBe(AIRSHIP_DECK);
  return deck;
}

/** Kill player 1 and wait for the death to end the attempt. */
function die(h: H, level: LevelScene): void {
  level.world.kill(level.world.player);
  h.until(() => h.top() !== level, 400);
}

function tryAgain(h: H): MenuScene {
  const menu = h.top() as MenuScene;
  expect(menu).toBeInstanceOf(MenuScene);
  expect(menu.title).toBe('TRY AGAIN?');
  expect(items(menu).map((i) => i.label)).toEqual(['Yes', 'No']);
  return menu;
}

describe("Larry's airship challenge (campaign)", () => {
  it('boarding snapshots the run; the clock is held (hidden) on the deck and in the room', () => {
    const { h } = in42();
    const deck = board(h);
    expect(h.game.airship).not.toBeNull();
    expect(h.game.airship?.before.powerState).toBe('fire');
    expect(h.game.airship?.before.lives).toBe(4);
    expect(deck.world.time).toBeNull();
    h.idle(200);
    expect(deck.world.time).toBeNull();
    expect(h.game.state.time).toBeNull();
    rideToStern(h, deck);
    const room = h.top() as LevelScene;
    expect(room.level.id).toBe(AIRSHIP_ROOM);
    expect(room.world.time).toBeNull();
  });

  it('a death on the deck costs no life: TRY AGAIN? YES restarts the deck at its start', () => {
    const { h } = in42();
    const deck = board(h);
    h.idle(120);
    expect(deck.world.camera.x).toBeGreaterThan(0);
    die(h, deck);
    tryAgain(h);
    expect(h.said).toContain('Try again?');
    expect(h.game.state.lives).toBe(4);
    pick(h, 'Yes');
    const again = h.top() as LevelScene;
    expect(again).toBeInstanceOf(LevelScene);
    expect(again).not.toBe(deck);
    expect(again.level.id).toBe(AIRSHIP_DECK);
    expect(again.world.camera.x).toBeLessThan(px(2));
    expect(Math.floor((again.world.player.body.x >> 8) / 16)).toBe(2);
    // The run as it was when boarding: the fire flower back, no life lost.
    expect(h.game.state.lives).toBe(4);
    expect(again.world.player.powerState).toBe('fire');
    expect(again.world.time).toBeNull();
  });

  it("once Larry's room is reached, YES restarts in the room", () => {
    const { h } = in42();
    rideToStern(h, board(h));
    const room = h.top() as LevelScene;
    expect(room.level.id).toBe(AIRSHIP_ROOM);
    expect(h.game.airship?.reachedRoom).toBe(true);
    h.until(() => !room.world.player.frozen, 200);
    // Out of the pipe Larry has his say (campaign story, once a run).
    h.step();
    expect(closeCards(h)).toEqual(LARRY_PAGES);
    die(h, room);
    pick(h, 'Yes');
    const again = h.top() as LevelScene;
    expect(again.level.id).toBe(AIRSHIP_ROOM);
    expect(again).not.toBe(room);
    expect(h.game.state.lives).toBe(4);
    expect(again.world.player.powerState).toBe('fire');
    // Rising out of the room's pipe again, as when first arriving.
    expect(again.world.player.frozen).toBe(true);
    // ...but straight into the fight: Larry does not speak again on TRY AGAIN.
    h.until(() => !again.world.player.frozen, 200);
    h.idle(30);
    expect(h.top()).toBe(again);
  });

  it('NO goes back to 4-2 at its last checkpoint with the run as it was before boarding, no life lost', () => {
    const { h } = in42();
    const deck = board(h);
    // Things change aboard: power lost, points scored...
    h.game.state.score = 9999;
    die(h, deck);
    pick(h, 'No');
    expect(h.game.airship).toBeNull();
    expect(h.top()).toBeInstanceOf(IntroScene);
    h.until(() => h.top() instanceof LevelScene, 400);
    const back = h.top() as LevelScene;
    expect(back.level.id).toBe('4-2');
    expect(Math.floor((back.world.player.body.x >> 8) / 16)).toBe(98);
    expect(h.game.state.lives).toBe(4);
    expect(h.game.state.score).toBe(1234);
    expect(back.world.player.powerState).toBe('fire');
    expect(h.game.state.checkpoint).toEqual({ level: '4-2', x: 98, y: 12 });
    // 4-2's own clock again (a fresh one, as after any respawn).
    expect(back.world.time).toBeGreaterThan(0);
  });

  it('NO without a 4-2 checkpoint restarts 4-2 from its start', () => {
    const { h } = in42();
    h.game.state.checkpoint = null;
    die(h, board(h));
    pick(h, 'No');
    h.until(() => h.top() instanceof LevelScene, 400);
    const back = h.top() as LevelScene;
    expect(back.level.id).toBe('4-2');
    expect(Math.floor((back.world.player.body.x >> 8) / 16)).toBe(getLevel('4-2').start.x);
  });

  it('MENU aboard is Continue / Give up; Continue plays on, Give up is NO', () => {
    const { h } = in42();
    const deck = board(h);
    h.idle(10);
    h.tap('start');
    const menu = h.top() as MiniGameMenuScene;
    expect(menu).toBeInstanceOf(MiniGameMenuScene);
    expect(menu).not.toBeInstanceOf(PauseScene);
    expect(items(menu).map((i) => i.label)).toEqual(['Continue', 'Give up']);
    // The scroll holds while the menu is open.
    const x = deck.world.camera.x;
    h.idle(60);
    expect(deck.world.camera.x).toBe(x);
    pick(h, 'Continue');
    expect(h.top()).toBe(deck);
    h.idle(20);
    expect(deck.world.camera.x).toBeGreaterThan(x);
    h.game.state.score = 5000;
    h.tap('start');
    pick(h, 'Give up');
    expect(h.game.airship).toBeNull();
    h.until(() => h.top() instanceof LevelScene, 400);
    const back = h.top() as LevelScene;
    expect(back.level.id).toBe('4-2');
    expect(h.game.state.score).toBe(1234);
    expect(h.game.state.lives).toBe(4);
  });

  it('dev mode adds the assists to the menu aboard', () => {
    const { h } = in42();
    h.game.deps.settings = { ...defaultSettings(), dev: true };
    board(h);
    h.idle(10);
    h.tap('start');
    expect(items(h.top()).map((i) => i.label)).toEqual(['Continue', 'Give up', 'Assists']);
  });

  it('beating Larry: the crystal ball as before, then the map with the bonus road; the run is over', () => {
    const { h } = in42();
    rideToStern(h, board(h));
    const room = h.top() as LevelScene;
    h.until(() => !room.world.player.frozen, 200);
    h.step();
    expect(closeCards(h)).toEqual(LARRY_PAGES);
    h.until(() => room.world.entities.some((e) => e instanceof Larry), 200);
    const larry = room.world.entities.find((e): e is Larry => e instanceof Larry) as Larry;
    room.world.player.invuln = 100000;
    for (let n = 0; n < 3; n++) {
      h.until(() => !larry.inShell, 400);
      larry.hit({ kind: 'stomp', amount: 1, owner: null, dirX: 1 }, room.world);
    }
    h.until(() => room.world.entities.some((e) => e instanceof CrystalBall && e.body.onGround), 300);
    const ball = room.world.entities.find((e): e is CrystalBall => e instanceof CrystalBall) as CrystalBall;
    const p = room.world.player;
    p.body.x = ball.body.x;
    p.body.y = ball.body.y + ball.body.h - p.body.h;
    h.step();
    // The campaign's crystal ball: two pages (docs/STORY.md 2.7).
    expect(h.top()).toBeInstanceOf(CardScene);
    expect(closeCards(h)).toEqual(STORY_CRYSTAL_BALL_PAGES);
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.game.airship).toBeNull();
    expect(h.game.mapProgress.secrets).toContain('larry');
    expect(h.game.mapProgress.cleared).not.toContain('4-2');
  });

  it('items held from the map are given once: a retry neither loses them nor gives them again', () => {
    const { h } = in42();
    h.game.state.powerState = 'small';
    h.game.bonus.itemsNext = ['mushroom'];
    const deck = board(h);
    expect(deck.world.player.powerState).toBe('big');
    expect(h.game.bonus.itemsNext).toEqual([]);
    die(h, deck);
    pick(h, 'Yes');
    const again = h.top() as LevelScene;
    expect(again.world.player.powerState).toBe('big');
    expect(h.game.bonus.itemsNext).toEqual([]);
    die(h, again);
    pick(h, 'No');
    h.until(() => h.top() instanceof LevelScene, 400);
    expect((h.top() as LevelScene).world.player.powerState).toBe('big');
    expect(h.game.bonus.itemsNext).toEqual([]);
  });

  it('co-op respawns aboard cost no shared life', () => {
    const { h } = in42();
    h.game.state.character2 = CHARACTERS[1]!;
    const deck = board(h);
    expect(deck.world.players).toHaveLength(2);
    deck.world.kill(deck.world.players[1]!);
    h.idle(260);
    expect(deck.world.players[1]!.dead).toBe(false);
    expect(h.game.state.lives).toBe(4);
  });
});

describe('the deck outside the campaign (dev select, ?level=)', () => {
  it('is a plain auto-scrolling level: no run, its clock runs, a death costs a life', () => {
    const h = makeGame();
    h.game.devStart(AIRSHIP_DECK, CHARACTERS[0]!, 'big');
    h.until(() => h.top() instanceof LevelScene, 400);
    const deck = h.top() as LevelScene;
    expect(h.game.airship).toBeNull();
    expect(deck.world.time).toBe(300);
    h.idle(60);
    expect(deck.world.camera.x).toBeGreaterThan(0);
    h.tap('start');
    expect(h.top()).toBeInstanceOf(PauseScene);
    pick(h, 'Continue');
    const lives = h.game.state.lives;
    die(h, deck);
    expect(h.game.state.lives).toBe(lives - 1);
  });
});

describe("Dev → Mini games → Larry's airship", () => {
  function fromTitle(): { h: H; list: DevMiniGamesScene } {
    const h = makeGame();
    h.game.deps.settings = { ...defaultSettings(), dev: true };
    h.game.showTitle();
    h.idle(8);
    expect(h.top()).toBeInstanceOf(TitleScene);
    pick(h, 'Dev mode');
    pick(h, 'Mini games');
    const list = h.top() as DevMiniGamesScene;
    expect(list).toBeInstanceOf(DevMiniGamesScene);
    playAirship(h);
    return { h, list };
  }

  it('plays the deck, then the room; beating Larry shows PASS and goes back to the list', () => {
    const { h, list } = fromTitle();
    const deck = h.top() as LevelScene;
    expect(deck.level.id).toBe(AIRSHIP_DECK);
    expect(deck.world.time).toBeNull();
    const lives = h.game.state.lives;
    rideToStern(h, deck);
    const room = h.top() as LevelScene;
    expect(room.level.id).toBe(AIRSHIP_ROOM);
    // The list is still underneath.
    expect(h.game.scenes.find((s) => s === list)).toBe(list);
    h.until(() => room.world.entities.some((e) => e instanceof Larry), 200);
    const larry = room.world.entities.find((e): e is Larry => e instanceof Larry) as Larry;
    room.world.player.invuln = 100000;
    for (let n = 0; n < 3; n++) {
      h.until(() => !larry.inShell, 400);
      larry.hit({ kind: 'stomp', amount: 1, owner: null, dirX: 1 }, room.world);
    }
    h.until(() => room.world.entities.some((e) => e instanceof CrystalBall && e.body.onGround), 300);
    const ball = room.world.entities.find((e): e is CrystalBall => e instanceof CrystalBall) as CrystalBall;
    room.world.player.body.x = ball.body.x;
    room.world.player.body.y = ball.body.y + ball.body.h - room.world.player.body.h;
    h.step();
    h.idle(32);
    h.tap('jump');
    const card = h.top() as DevMiniGameResultScene;
    expect(card).toBeInstanceOf(DevMiniGameResultScene);
    expect(card.result).toBe('pass');
    expect(card.lines[0]).toBe("LARRY'S AIRSHIP");
    expect(h.game.airship).toBeNull();
    expect(h.game.state.lives).toBe(lives);
    h.idle(40);
    h.tap('jump');
    expect(h.top()).toBe(list);
  });

  it('a death fails the round (no retry prompt); Give up quits', () => {
    const { h, list } = fromTitle();
    die(h, h.top() as LevelScene);
    expect((h.top() as DevMiniGameResultScene).result).toBe('fail');
    h.idle(40);
    h.tap('jump');
    expect(h.top()).toBe(list);
    // The list's cursor is still on Larry's airship: OK, then OK on the hero.
    h.idle(8);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    h.idle(12);
    h.tap('jump');
    expect((h.top() as LevelScene).level.id).toBe(AIRSHIP_DECK);
    h.idle(10);
    h.tap('start');
    pick(h, 'Give up');
    expect((h.top() as DevMiniGameResultScene).result).toBe('quit');
    expect(h.game.airship).toBeNull();
  });

  it('a round leaves the save storage and the game state exactly as they were', () => {
    const h = makeGame();
    h.game.deps.settings = { ...defaultSettings(), dev: true };
    h.game.showTitle();
    h.idle(8);
    pick(h, 'Dev mode');
    pick(h, 'Mini games');
    const state = h.game.state;
    const before = snapshot(state);
    const stored = [...store.entries()];
    playAirship(h);
    const deck = h.top() as LevelScene;
    // Things change aboard: points, coins, power, a life.
    h.idle(30);
    state.score += 777;
    state.coins += 3;
    state.lives += 1;
    deck.world.player.powerState = 'fire';
    h.step();
    rideToStern(h, deck);
    expect((h.top() as LevelScene).level.id).toBe(AIRSHIP_ROOM);
    die(h, h.top() as LevelScene);
    expect((h.top() as DevMiniGameResultScene).result).toBe('fail');
    expect(h.game.state).toBe(state);
    expect(snapshot(h.game.state)).toEqual(before);
    expect([...store.entries()]).toEqual(stored);
    expect(h.game.campaign).toBeNull();
  });

  it('the HUD shows WORLD 4-2 aboard, whatever world was played last; it is put back after', () => {
    const h = makeGame();
    h.game.deps.settings = { ...defaultSettings(), dev: true };
    h.game.showTitle();
    h.idle(8);
    pick(h, 'Dev mode');
    pick(h, 'Mini games');
    h.game.state.world = 3;
    h.game.state.stage = 1;
    playAirship(h);
    const deck = h.top() as LevelScene;
    expect(deck.level.id).toBe(AIRSHIP_DECK);
    expect([h.game.state.world, h.game.state.stage]).toEqual([4, 2]);
    expect(draw(deck).texts.map((t) => t.str)).toContain('4-2');
    rideToStern(h, deck);
    const room = h.top() as LevelScene;
    expect(draw(room).texts.map((t) => t.str)).toContain('4-2');
    h.tap('start');
    pick(h, 'Give up');
    expect((h.top() as DevMiniGameResultScene).result).toBe('quit');
    expect([h.game.state.world, h.game.state.stage]).toEqual([3, 1]);
  });

  it('leaving the airship for another level mid-round ends it as QUIT, back over the list', () => {
    const { h, list } = fromTitle();
    h.idle(10);
    h.game.startLevel(getLevel('1-1'), { mode: 'stand' });
    const card = h.top() as DevMiniGameResultScene;
    expect(card).toBeInstanceOf(DevMiniGameResultScene);
    expect(card.result).toBe('quit');
    expect(h.game.airship).toBeNull();
    expect(h.game.scenes.find((s) => s === list)).toBe(list);
    h.idle(40);
    h.tap('jump');
    expect(h.top()).toBe(list);
  });

  it('asks for a hero first (every hero, the current one preselected); Back is the list, nothing started', () => {
    const h = makeGame();
    h.game.deps.settings = { ...defaultSettings(), dev: true };
    h.game.showTitle();
    h.idle(8);
    pick(h, 'Dev mode');
    pick(h, 'Mini games');
    const list = h.top() as DevMiniGamesScene;
    const state = h.game.state;
    const before = snapshot(state);
    pick(h, "Larry's airship");
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    expect(h.said.at(-1)).toMatch(new RegExp(`^Choose your hero\\. ${state.character.name}\\.`));
    h.idle(12);
    // Outside a campaign no hero is locked.
    expect(new Set(offered(h)).size).toBe(CHARACTERS.length);
    h.tap('attack');
    expect(h.top()).toBe(list);
    expect(h.said.at(-1)).toMatch(/^Larry's airship\. Deck and Larry's room with a hero you pick\./);
    expect(h.game.airship).toBeNull();
    expect(h.game.inRound).toBe(false);
    expect(snapshot(h.game.state)).toEqual(before);
  });

  it('picking Link plays the round as Link; the run keeps its own hero, power and lives after', () => {
    const h = makeGame();
    h.game.deps.settings = { ...defaultSettings(), dev: true };
    h.game.showTitle();
    h.idle(8);
    pick(h, 'Dev mode');
    pick(h, 'Mini games');
    const list = h.top() as DevMiniGamesScene;
    const state = h.game.state;
    state.powerState = 'fire';
    const before = snapshot(state);
    const hero = state.character.id;
    expect(hero).not.toBe('link');
    pick(h, "Larry's airship");
    h.idle(12);
    while (h.said.at(-1) !== 'Link') h.tap('right');
    h.tap('jump');
    const deck = h.top() as LevelScene;
    expect(deck.level.id).toBe(AIRSHIP_DECK);
    expect(deck.world.player.def.id).toBe('link');
    expect(h.game.state.character.id).toBe('link');
    h.idle(10);
    h.tap('start');
    pick(h, 'Give up');
    expect((h.top() as DevMiniGameResultScene).result).toBe('quit');
    h.idle(40);
    h.tap('jump');
    expect(h.top()).toBe(list);
    expect(h.game.state).toBe(state);
    expect([state.character.id, state.powerState]).toEqual([hero, 'fire']);
    expect(snapshot(state)).toEqual(before);
  });
});

describe('the run ends whenever play leaves the airship', () => {
  it('on the title, the map and a level outside the airship', () => {
    for (const leave of ['title', 'map', 'level'] as const) {
      const { h } = in42();
      board(h);
      expect(h.game.airship, leave).not.toBeNull();
      if (leave === 'title') h.game.showTitle();
      else if (leave === 'map') h.game.showMap();
      else h.game.startLevel(getLevel('4-2'), { mode: 'stand' });
      expect(h.game.airship, leave).toBeNull();
    }
  });

  it('a room entered after the deck keeps the same run; only an airship area does', () => {
    const { h } = in42();
    board(h);
    const run = h.game.airship;
    h.game.startLevel(getLevel(AIRSHIP_ROOM), { x: 2, y: 12, mode: 'pipe-exit' });
    expect(h.game.airship).toBe(run);
    expect(run?.reachedRoom).toBe(true);
  });
});

describe('TRY AGAIN? has no way back but its answers', () => {
  it('BACK (attack / select) does nothing: the prompt stays until YES or NO', () => {
    const { h } = in42();
    die(h, board(h));
    const menu = tryAgain(h);
    h.idle(8);
    h.tap('attack');
    h.tap('select');
    h.idle(30);
    expect(h.top()).toBe(menu);
    expect(h.game.airship).not.toBeNull();
    expect(h.game.state.lives).toBe(4);
  });
});

// The deck's shots vary with its world seed, so the ride is played on fixed seeds (devStart's
// `seed`), each hero on every one. Besides an everyday seed, these once ended the bot's ride:
// 3872769170: Simon (his jump committed at takeoff) jumped the 3-tall blaster post too slowly,
//   bumped its face, and the screen's edge pushed him into it;
// 1753536851 (Simon) and 3423891524 (Ryu): an unsteered jump over a Bullet Bill, made while
//   stepping back, carried the hero back over the fore deck's cannon onto the screen's edge.
const DECK_SEEDS = [1, 3872769170, 1753536851, 3423891524];

describe('every hero rides the deck to the stern pipe', () => {
  for (const c of CHARACTERS) {
    for (const seed of DECK_SEEDS) {
      it(`${c.name}: stands on the scrolling deck and goes down the stern pipe into Larry's room (seed ${seed})`, () => {
        const h = makeGame();
        h.game.devStart(AIRSHIP_DECK, c, c.damage.kind === 'powerup' ? 'small' : 'full', false, seed);
        h.until(() => h.top() instanceof LevelScene, 400);
        const deck = h.top() as LevelScene;
        // Standing still, the left edge pushes the hero along the deck: alive, on the deck.
        h.idle(200);
        const p = deck.world.player;
        expect(p.dead).toBe(false);
        expect(p.body.onGround).toBe(true);
        expect(p.body.x).toBeGreaterThanOrEqual(deck.world.camera.x);
        expect(deck.world.camera.x).toBeGreaterThan(px(60)); // 200 frames at 0.375 px/f
        rideToStern(h, deck);
        expect(p.dead).toBe(false);
        expect((h.top() as LevelScene).level?.id).toBe(AIRSHIP_ROOM);
      });
    }
  }
});
