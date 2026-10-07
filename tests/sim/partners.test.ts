import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { startHp, type CharacterDef } from '@game/characters/character';
import { Partner } from '@game/entities/objects/partner';
import { CaveFire } from '@game/entities/objects/moblin';
import { Decoration } from '@game/entities/objects/decoration';
import { CoinPop } from '@game/entities/effects/effects';
import { LevelScene } from '@game/scenes/level';
import type { Player } from '@game/entities/player';
import { CardScene, CARD_GUARD_FRAMES } from '@game/scenes/message';
import { beat } from '@game/story/beats';
import { PARTNERS, type Page } from '@game/story/script';
import type { WorldStart } from '@game/world/world';
import { px } from '@engine/math/units';
import { draw, file, makeGame, useStorage, type H } from './heroes-harness';

// The campaign's partners (docs/STORY.md 2.5-2.10, section 3 decision 2): someone from a hero's
// own game stands before the way in and says what to try. Campaign only; they never leave. Up
// talks (READ for the bird statue), their pages play in the story box over the frozen level (OK
// next, BACK skips the rest), and the old man's "TAKE THIS." pops a coin, once a visit.

useStorage();

/** Where each partner stands, and how the heroes arrive there (the pipe rooms: falling in). */
const SPOTS = [
  { who: 'old-man', level: '2-1', start: { mode: 'stand' } },
  { who: 'dr-light', level: '3-1-bonus', start: { mode: 'fall', x: 1, y: 0, time: 300 } },
  { who: 'chozo', level: '4-1-bonus', start: { mode: 'fall', x: 1, y: 0, time: 300 } },
  { who: 'townsperson', level: '5-4', start: { mode: 'stand' } },
  { who: 'irene', level: '6-2', start: { mode: 'stand' } },
  { who: 'lance', level: '7-3', start: { mode: 'stand' } },
  // Jason's secret area behind 8-4-end's trap pipe (0.4.18): up out of its pipe.
  { who: 'jason', level: '8-4-jason', start: { mode: 'pipe-exit', x: 1, y: 10, time: 300 } },
] as const satisfies readonly { who: string; level: string; start: WorldStart }[];

const runs = CHARACTERS.flatMap((c) =>
  (c.damage.kind === 'powerup' ? ['small', 'big'] : ['full']).map((p) => [`${c.name} ${p}`, c, p] as const),
);
const cases = SPOTS.flatMap((s) =>
  runs.map(([n, c, p]) => [`${s.who} in ${s.level}, ${n}`, s, c, p] as const),
);

const said = (page: Page) => page.filter((l) => l !== '').join(' ');
const partners = (l: LevelScene) =>
  l.world.entities.filter((e): e is Partner => e instanceof Partner && e.alive);

/** Campaign file 1, hero `c` at `power`, into `spot`'s level as play reaches it. */
function campaignIn(
  h: H,
  spot: (typeof SPOTS)[number],
  c: CharacterDef = MARIO,
  power = 'small',
  over: Parameters<typeof file>[0] = {},
): LevelScene {
  file(over);
  h.game.openFile(1);
  // Toad's remarks on a restyled level's first start are another story; seen already here.
  for (const s of SPOTS) h.game.markSeen(beat.restyle(s.level.replace(/-bonus$/, '')));
  const st = h.game.state;
  st.character = c;
  st.powerState = power as typeof st.powerState;
  st.hp = startHp(c);
  st.coins = 0;
  h.game.startLevel(getLevel(spot.level), spot.start);
  h.step();
  const l = h.top();
  expect(l).toBeInstanceOf(LevelScene);
  return l as LevelScene;
}

/** Player 1 walks up to the level's partner (right or left, then stops) until in reach on the ground. */
function walkUp(h: H, l: LevelScene, max = 900): Partner {
  const w = l.world;
  for (let f = 0; f < max; f++) {
    const p = w.player;
    const it = partners(l)[0];
    if (it && it.inReach(p) && Math.abs(p.body.vx) < px(1) / 4) return it;
    const dx = it ? it.body.x + (it.body.w >> 1) - p.centerX : px(64);
    // Falling in from a pipe, the hero drops straight down; then walks.
    h.step(!p.body.onGround || Math.abs(dx) < px(10) ? [] : [dx > 0 ? 'right' : 'left']);
    expect(h.top(), 'still playing').toBe(l);
  }
  const p = w.player;
  const it = partners(l)[0];
  throw new Error(
    `never reached the partner (${partners(l).length} spawned): player ${p.body.x / 256},${p.body.y / 256} ${p.body.w / 256}x${p.body.h / 256} ground ${p.body.onGround}; partner ${it ? `${it.body.x / 256},${it.body.y / 256} ${it.body.w / 256}x${it.body.h / 256}` : '-'}`,
  );
}

/** Wait out a card's guard, then press `a` (jump = OK, attack = BACK). */
function press(h: H, a: 'jump' | 'attack') {
  h.idle(CARD_GUARD_FRAMES + 2);
  h.tap(a);
}

describe('partners: where they stand (campaign only)', () => {
  it.each(SPOTS)('$who stands in $level in the campaign, on open ground, clear of the tiles', (spot) => {
    const h = makeGame();
    const l = campaignIn(h, spot);
    // (Up out of a pipe, the room's entities come once the hero is out.)
    h.idle(spot.start.mode === 'pipe-exit' ? 120 : 2);
    const [it, ...more] = partners(l);
    expect(it?.who).toBe(spot.who);
    expect(more).toEqual([]);
    // Feet on the floor; nothing solid where it stands.
    const map = l.world.map;
    const tx0 = Math.floor(it!.body.x / px(16));
    const tx1 = Math.floor((it!.body.x + it!.body.w - 1) / px(16));
    const ty0 = Math.floor(it!.body.y / px(16));
    const ty1 = Math.floor((it!.body.y + it!.body.h - 1) / px(16));
    for (let tx = tx0; tx <= tx1; tx++) {
      for (let ty = ty0; ty <= ty1; ty++) expect(map.isSolid(tx, ty), `${tx},${ty}`).toBe(false);
      expect(map.isSolid(tx, ty1 + 1), `floor under ${tx}`).toBe(true);
    }
  });

  it.each(SPOTS)('no $who in $level outside the campaign (classic play)', (spot) => {
    const h = makeGame();
    h.game.newGame(MARIO, spot.level);
    h.until(() => h.top() instanceof LevelScene, 600);
    h.idle(4);
    const l = h.top() as LevelScene;
    expect(l).toBeInstanceOf(LevelScene);
    expect(partners(l)).toEqual([]);
    expect(l.world.entities.some((e) => e instanceof Decoration && e.name === 'partners:cave')).toBe(false);
  });

  it("2-1: the old man's cave doorway and its two fires, in the campaign only", () => {
    const h = makeGame();
    const l = campaignIn(h, SPOTS[0]);
    h.idle(2);
    const cave = l.world.entities.find((e) => e instanceof Decoration && e.name === 'partners:cave');
    const fires = l.world.entities.filter((e) => e instanceof CaveFire);
    expect(cave).toBeDefined();
    expect(fires.map((f) => f.body.x / px(16))).toEqual([7, 10]);
    const man = partners(l)[0] as Partner;
    // He stands in the doorway's middle, between the fires, before the first tree (column 11).
    expect(man.body.x + (man.body.w >> 1)).toBe(cave!.body.x + px(16));
    const classic = makeGame();
    classic.game.newGame(MARIO, '2-1');
    classic.until(() => classic.top() instanceof LevelScene, 600);
    classic.idle(4);
    expect((classic.top() as LevelScene).world.entities.some((e) => e instanceof CaveFire)).toBe(false);
  });
});

describe('partners: every hero can walk up and talk', () => {
  it.each(cases)('%s', (_n, spot, c, power) => {
    const h = makeGame();
    const l = campaignIn(h, spot, c, power);
    const it = walkUp(h, l);
    const script = PARTNERS[spot.who]!;
    expect(h.said).toContain(`${script.name}. Up to ${script.verb === 'READ' ? 'read' : 'talk'}.`);
    h.tap('up');
    expect(h.top()).toBeInstanceOf(CardScene);
    expect(h.said.some((s) => s.startsWith(said(script.pages[0]!)))).toBe(true);
    press(h, 'attack');
    expect(h.top()).toBe(l);
    expect(it.alive).toBe(true);
  });
});

describe('partners: the pages', () => {
  it.each(SPOTS)('$who: every page in order, OK on each, then play goes on', (spot) => {
    const h = makeGame();
    const l = campaignIn(h, spot);
    walkUp(h, l);
    const pages = PARTNERS[spot.who]!.pages;
    const from = h.said.length;
    h.tap('up');
    for (const page of pages) {
      const card = h.top() as CardScene;
      expect(card).toBeInstanceOf(CardScene);
      expect(h.said.at(-1)?.startsWith(said(page))).toBe(true);
      expect(draw(card).texts.some((t) => t.str === page.find((s) => s !== ''))).toBe(true);
      press(h, 'jump');
    }
    expect(h.top()).toBe(l);
    expect(h.said.slice(from).filter((s) => pages.some((p) => s.startsWith(said(p))))).toHaveLength(
      pages.length,
    );
    // They never leave: up talks again, from the first page.
    h.idle(2);
    h.tap('up');
    expect(h.top()).toBeInstanceOf(CardScene);
    expect(h.said.at(-1)?.startsWith(said(pages[0]!))).toBe(true);
  });

  it('BACK on the first page skips the rest', () => {
    const h = makeGame();
    const l = campaignIn(h, SPOTS[1]);
    walkUp(h, l);
    h.tap('up');
    press(h, 'attack');
    expect(h.top()).toBe(l);
    const pages = PARTNERS['dr-light']!.pages;
    expect(h.said.some((s) => s.startsWith(said(pages[1]!)))).toBe(false);
    // and the level plays on: the hero can walk away
    const x = l.world.player.body.x;
    for (let i = 0; i < 20; i++) h.step(['left']);
    expect(l.world.player.body.x).toBeLessThan(x);
  });

  it('the statue reads: READ over it in reach, said as "Up to read."; the others say TALK', () => {
    const h = makeGame();
    const l = campaignIn(h, SPOTS[2]);
    walkUp(h, l);
    const texts = draw(l).texts.map((t) => t.str);
    expect(texts).toContain('READ');
    expect(texts).not.toContain('TALK');
    expect(h.said).toContain('An old bird statue. Up to read.');
    const h2 = makeGame();
    const l2 = campaignIn(h2, SPOTS[4]);
    walkUp(h2, l2);
    expect(draw(l2).texts.map((t) => t.str)).toContain('TALK');
    expect(h2.said).toContain('Irene. Up to talk.');
  });

  it('out of reach, no word shows over a partner', () => {
    const h = makeGame();
    const l = campaignIn(h, SPOTS[0]);
    h.idle(2);
    expect(draw(l).texts.map((t) => t.str)).not.toContain('TALK');
  });
});

describe("partners: the old man's coin", () => {
  it('pops out over him after page 1, once a visit: not again on a second talk', () => {
    const h = makeGame();
    const l = campaignIn(h, SPOTS[0]);
    const man = walkUp(h, l);
    expect(h.game.state.coins).toBe(0);
    h.tap('up');
    press(h, 'jump');
    expect(h.game.state.coins).toBe(1);
    const pop = l.world.entities.find((e) => e instanceof CoinPop);
    expect(pop).toBeDefined();
    expect(pop!.body.y).toBeLessThan(man.body.y);
    expect(Math.abs(pop!.body.x + px(4) - (man.body.x + (man.body.w >> 1)))).toBeLessThanOrEqual(px(1));
    for (let i = 1; i < PARTNERS['old-man']!.pages.length; i++) press(h, 'jump');
    expect(h.top()).toBe(l);
    expect(h.game.state.coins).toBe(1);
    // Talked to again (every page): no second coin.
    h.idle(40);
    h.tap('up');
    for (const _ of PARTNERS['old-man']!.pages) press(h, 'jump');
    expect(h.top()).toBe(l);
    h.idle(40);
    expect(h.game.state.coins).toBe(1);
  });

  it('BACK on page 1 gives none; the next talk gives it', () => {
    const h = makeGame();
    const l = campaignIn(h, SPOTS[0]);
    walkUp(h, l);
    h.tap('up');
    press(h, 'attack');
    expect(h.top()).toBe(l);
    expect(h.game.state.coins).toBe(0);
    h.idle(2);
    h.tap('up');
    press(h, 'jump');
    expect(h.game.state.coins).toBe(1);
  });

  it('no other partner gives a coin', () => {
    for (const spot of SPOTS.slice(1)) {
      const h = makeGame();
      const l = campaignIn(h, spot);
      walkUp(h, l);
      const coins = h.game.state.coins;
      h.tap('up');
      for (const _ of PARTNERS[spot.who]!.pages) press(h, 'jump');
      expect(h.top()).toBe(l);
      expect(h.game.state.coins, spot.who).toBe(coins);
    }
  });
});

describe('partners: the music plays on', () => {
  it("closing a partner's pages (OK through them, or BACK) never stops or restarts the music", () => {
    const h = makeGame();
    const l = campaignIn(h, SPOTS[1]);
    walkUp(h, l);
    h.audio.stopMusic.mockClear();
    h.audio.playMusic.mockClear();
    h.tap('up');
    for (const _ of PARTNERS['dr-light']!.pages) press(h, 'jump');
    expect(h.top()).toBe(l);
    h.idle(2);
    h.tap('up');
    press(h, 'attack');
    expect(h.top()).toBe(l);
    h.idle(10);
    expect(h.audio.stopMusic).not.toHaveBeenCalled();
    expect(h.audio.playMusic).not.toHaveBeenCalled();
    // The press that closed the card does not make the hero jump.
    expect(l.world.player.body.onGround).toBe(true);
  });

  it("closing a restyled level's remark never stops or restarts the music", () => {
    const h = makeGame();
    file({ story: [] });
    h.game.openFile(1);
    h.idle(4);
    h.game.startLevel(getLevel('7-3'), { mode: 'stand' });
    h.step();
    expect(h.top()).toBeInstanceOf(CardScene);
    h.audio.stopMusic.mockClear();
    h.audio.playMusic.mockClear();
    press(h, 'jump');
    expect(h.top()).toBeInstanceOf(LevelScene);
    h.idle(10);
    expect(h.audio.stopMusic).not.toHaveBeenCalled();
    expect(h.audio.playMusic).not.toHaveBeenCalled();
  });
});

describe('partners: co-op', () => {
  it('player 2 talking to a partner opens its pages, and player 2 turns them', () => {
    const h = makeGame();
    const l = campaignIn(h, SPOTS[4], MARIO, 'small', { character2: 'luigi' });
    expect(l.world.players).toHaveLength(2);
    walkUp(h, l);
    const [p1, p2] = l.world.players as [Player, Player];
    p2.body.x = p1.body.x;
    p2.body.y = p1.body.y;
    h.until(() => p2.body.onGround && partners(l)[0]!.inReach(p2), 60);
    h.tap('up', 1);
    expect(h.top()).toBeInstanceOf(CardScene);
    const pages = PARTNERS.irene!.pages;
    expect(h.said.at(-1)?.startsWith(said(pages[0]!))).toBe(true);
    h.idle(CARD_GUARD_FRAMES + 2);
    h.tap('jump', 1);
    expect(h.said.at(-1)?.startsWith(said(pages[1]!))).toBe(true);
    h.idle(CARD_GUARD_FRAMES + 2);
    h.tap('jump', 1);
    expect(h.top()).toBe(l);
  });
});
