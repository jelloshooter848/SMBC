import { describe, expect, it } from 'vitest';
import { getLevel, levelIds } from '@content/levels';
import { CHARACTERS } from '@game/characters/registry';
import { beat } from '@game/story/beats';
import { MARIO } from '@game/characters/mario';
import { startHp, type CharacterDef } from '@game/characters/character';
import { Partner } from '@game/entities/objects/partner';
import { CaveFire } from '@game/entities/objects/moblin';
import { Decoration } from '@game/entities/objects/decoration';
import { CoinPop } from '@game/entities/effects/effects';
import { LevelScene } from '@game/scenes/level';
import type { Player } from '@game/entities/player';
import { CardScene, CARD_GUARD_FRAMES } from '@game/scenes/message';
import { PARTNERS, type Page } from '@game/story/script';
import type { WorldStart } from '@game/world/world';
import { px } from '@engine/math/units';
import { defaultSettings } from '@engine/save/settings';
import { setHas } from '@game/items/flags';
import { Projectile } from '@game/entities/projectiles/projectile';
import { draw, file, makeGame, useStorage, type H } from './heroes-harness';

// The campaign's partners (docs/STORY.md 2.5-2.10, section 3 decision 2): someone from a hero's
// own game stands before the way in and says what to try. Campaign only; they never leave. Up
// talks (READ for the bird statue), their pages play in the story box over the frozen level (OK
// next, BACK skips the rest), and the old man's "TAKE THIS." pops a coin, once a visit.

useStorage();

/**
 * Where each partner stands, and how the heroes arrive there (0.4.23: next to the hint NPC, the
 * enemies near it cleared, so every hero gets there; Jason's room: up out of its pipe).
 */
const near = (x: number) => ({ mode: 'stand', x, y: 12, clearEnemies: 'all' }) as const;
/** The level's own start (and arrival: standing, falling in, out of a pipe), the enemies near it cleared. */
const fromStart = { clearEnemies: 'all' } as const;
const SPOTS = [
  { who: 'villager', level: '1-1', start: near(52), col: 55 },
  // The warp zone's one free floor tile left of the pipes (178-186), walled in by bricks at 176.
  { who: 'pipe-keeper', level: '1-2', start: near(177), col: 177 },
  { who: 'old-man', level: '2-1', start: near(77), col: 80.5 },
  { who: 'fairy', level: '2-1-sky', start: near(10), col: 7 },
  // On the ground before the spring (126) and the vine block (131); 128-131 is a pit.
  { who: 'dr-light', level: '3-1', start: near(121), col: 124 },
  // Over the pit (57-62) on the lift, on the ground just past the vine block (64).
  { who: 'chozo', level: '4-2', start: near(68), col: 65 },
  { who: 'townsperson', level: '5-4', start: { mode: 'stand' }, col: 10 },
  { who: 'irene', level: '6-2', start: { mode: 'stand' }, col: 7 },
  { who: 'lance', level: '7-3', start: { mode: 'stand' }, col: 5 },
  // Fred by 8-4-end's trap pipe (10), up out of the pipe at 3.
  {
    who: 'fred',
    level: '8-4-end',
    start: { mode: 'pipe-exit', x: 3, y: 10, time: 300, clearEnemies: 'all' },
    col: 8,
  },
  // Jason's secret area behind 8-4-end's trap pipe (0.4.18): up out of its pipe.
  { who: 'jason', level: '8-4-jason', start: { mode: 'pipe-exit', x: 1, y: 10, time: 300 }, col: 5 },
  // 0.4.40: an NPC in every level, each walked up to from the level's own start.
  // World 1: a cave Toad where 1-2's heroes drop in, the lookout at 1-3's start, and a retainer
  // at the foot of 1-4's entrance steps.
  { who: 'cave-toad', level: '1-2', start: fromStart, col: 5 },
  { who: 'lookout', level: '1-3', start: fromStart, col: 8 },
  { who: 'retainer', level: '1-4', start: fromStart, col: 8 },
  // World 2: Error below the steps to 2-2's flag (walked down to), the river man at 2-3's start,
  // a wise man at the foot of 2-4's entrance steps.
  { who: 'error', level: '2-2-exit', start: near(18), col: 15 },
  { who: 'river-man', level: '2-3', start: fromStart, col: 5 },
  { who: 'wise-man', level: '2-4', start: fromStart, col: 7 },
  // World 3: robots at 3-2's and 3-3's starts, Sniper Joe at the foot of 3-4's entrance steps.
  { who: 'prune-bot', level: '3-2', start: fromStart, col: 7 },
  { who: 'weather-bot', level: '3-3', start: fromStart, col: 8 },
  { who: 'sniper-joe', level: '3-4', start: fromStart, col: 8 },
  // World 4: a trooper at 4-1's start, a researcher at 4-3's, and a baby Metroid floating at the
  // low corridor past 4-4's first lava pits.
  { who: 'trooper', level: '4-1', start: fromStart, col: 10 },
  { who: 'researcher', level: '4-3', start: fromStart, col: 8 },
  { who: 'baby-metroid', level: '4-4', start: near(17), col: 21 },
  // World 5: at the starts of 5-1 (the courtyard gate) and 5-2 (the town); in 5-3 (the clock
  // tower) below the steps to the flag (walked back to), past the flying Bullet Bills.
  { who: 'old-woman', level: '5-1', start: fromStart, col: 7 },
  { who: 'garlic-seller', level: '5-2', start: fromStart, col: 7 },
  { who: 'clockmaker', level: '5-3', start: near(150), col: 147 },
  // World 6: a ninja at 6-1's start, a hermit at 6-3's, a clan scout at the foot of 6-4's steps.
  { who: 'ninja', level: '6-1', start: fromStart, col: 10 },
  { who: 'hermit', level: '6-3', start: fromStart, col: 8 },
  { who: 'clan-scout', level: '6-4', start: fromStart, col: 8 },
  // World 7: a corporal at 7-1's start, a river scout below the steps to 7-2's flag (walked down
  // to), a medic at the foot of 7-4's steps.
  { who: 'corporal', level: '7-1', start: fromStart, col: 5 },
  { who: 'river-scout', level: '7-2-exit', start: near(18), col: 15 },
  { who: 'medic', level: '7-4', start: fromStart, col: 8 },
  // World 8: at the starts of 8-1, 8-2 and 8-3; in 8-4 on the floor past the first lava (Fred
  // and Jason are behind the trap pipe at its end, and Fred goes home once Sophia III is free).
  { who: 'mutant', level: '8-1', start: fromStart, col: 10 },
  { who: 'engineer', level: '8-2', start: fromStart, col: 6 },
  { who: 'ice-miner', level: '8-3', start: fromStart, col: 4 },
  { who: 'castle-mutant', level: '8-4', start: near(12), col: 14 },
] as const satisfies readonly { who: string; level: string; start: WorldStart; col: number }[];

const spotOf = (who: string) => SPOTS.find((s) => s.who === who) as (typeof SPOTS)[number];

const runs = CHARACTERS.flatMap((c) =>
  (c.damage.kind === 'powerup' ? ['small', 'big'] : ['full']).map((p) => [`${c.name} ${p}`, c, p] as const),
);
const cases = SPOTS.flatMap((s) =>
  runs.map(([n, c, p]) => [`${s.who} in ${s.level}, ${n}`, s, c, p] as const),
);

const said = (page: Page) => page.filter((l) => l !== '').join(' ');
/** The spot's partner each level was entered for (0.4.40: 1-2 has two, the cave Toad and the pipe keeper). */
const spotWho = new WeakMap<LevelScene, string>();
const partners = (l: LevelScene) =>
  l.world.entities.filter(
    (e): e is Partner => e instanceof Partner && e.alive && (!spotWho.has(l) || e.who === spotWho.get(l)),
  );

/** Campaign file 1, hero `c` at `power`, into `spot`'s level as play reaches it. */
function campaignIn(
  h: H,
  spot: { level: string; start: WorldStart; who?: string },
  c: CharacterDef = MARIO,
  power = 'small',
  over: Parameters<typeof file>[0] = {},
): LevelScene {
  file(over);
  h.game.openFile(1);
  // 1-1's opening beat (Luigi running off, story/luigi-runs.ts) is another story; seen already here.
  h.game.markSeen(beat.luigiRuns);
  // Bowser in 8-4-end's bridge room (Fred's trap pipe is in it) is another story too.
  h.game.markSeen(beat.bowser84);
  const st = h.game.state;
  st.character = c;
  st.powerState = power as typeof st.powerState;
  st.hp = startHp(c);
  st.coins = 0;
  h.game.startLevel(getLevel(spot.level), spot.start);
  h.step();
  const l = h.top();
  expect(l).toBeInstanceOf(LevelScene);
  if (spot.who) spotWho.set(l as LevelScene, spot.who);
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
    h.idle('mode' in spot.start && spot.start.mode === 'pipe-exit' ? 120 : 2);
    const [it, ...more] = partners(l);
    expect(it?.who).toBe(spot.who);
    expect(more).toEqual([]);
    expect((it!.body.x + (it!.body.w >> 1)) / px(16) - 0.5, 'column').toBe(spot.col);
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

  it("2-1: the old man's cave doorway and its two fires, by the vine, in the campaign only", () => {
    const h = makeGame();
    const l = campaignIn(h, spotOf('old-man'));
    h.idle(2);
    const cave = l.world.entities.find((e) => e instanceof Decoration && e.name === 'partners:cave');
    const fires = l.world.entities.filter((e) => e instanceof CaveFire);
    expect(cave).toBeDefined();
    expect(fires.map((f) => f.body.x / px(16))).toEqual([79, 82]);
    const man = partners(l)[0] as Partner;
    // 0.4.23: by the vine block (83), in the doorway's middle, between the fires.
    expect(man.body.x + (man.body.w >> 1)).toBe(cave!.body.x + px(16));
    const classic = makeGame();
    classic.game.newGame(MARIO, '2-1');
    classic.until(() => classic.top() instanceof LevelScene, 600);
    classic.idle(4);
    expect((classic.top() as LevelScene).world.entities.some((e) => e instanceof CaveFire)).toBe(false);
  });
});

describe('partners: every one placed has its spot here (0.4.40)', () => {
  it('each `partner` in a level file is one of the spots above, in that level', () => {
    const placed = levelIds().flatMap((id) =>
      getLevel(id)
        .entities.filter((e) => e.type === 'partner')
        .map((e) => `${String(e.props?.who)} in ${id}`),
    );
    expect(placed.sort()).toEqual(SPOTS.map((s) => `${s.who} in ${s.level}`).sort());
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
    const l = campaignIn(h, spotOf('dr-light'));
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
    const l = campaignIn(h, spotOf('chozo'));
    walkUp(h, l);
    const texts = draw(l).texts.map((t) => t.str);
    expect(texts).toContain('READ');
    expect(texts).not.toContain('TALK');
    expect(h.said).toContain('An old bird statue. Up to read.');
    const h2 = makeGame();
    const l2 = campaignIn(h2, spotOf('irene'));
    walkUp(h2, l2);
    expect(draw(l2).texts.map((t) => t.str)).toContain('TALK');
    expect(h2.said).toContain('Irene. Up to talk.');
  });

  it('out of reach, no word shows over a partner', () => {
    const h = makeGame();
    const l = campaignIn(h, spotOf('old-man'));
    h.idle(2);
    expect(draw(l).texts.map((t) => t.str)).not.toContain('TALK');
  });
});

describe("partners: the old man's coin", () => {
  it('pops out over him after page 1, once a visit: not again on a second talk', () => {
    const h = makeGame();
    const l = campaignIn(h, spotOf('old-man'));
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
    const l = campaignIn(h, spotOf('old-man'));
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
    for (const spot of SPOTS.filter((s) => s.who !== 'old-man')) {
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
    const l = campaignIn(h, spotOf('dr-light'));
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
});

describe('partners: co-op', () => {
  it('player 2 talking to a partner opens its pages, and player 2 turns them', () => {
    const h = makeGame();
    const l = campaignIn(h, spotOf('irene'), MARIO, 'small', { character2: 'luigi' });
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

describe('partners: once their hero is freed (0.4.23, docs/STORY.md 2.3)', () => {
  const hinting = SPOTS.filter((s) => PARTNERS[s.who]?.after);

  it.each(hinting)('$who says its after pages instead, and again on a second talk', (spot) => {
    const script = PARTNERS[spot.who]!;
    const after = script.after!;
    const h = makeGame();
    const l = campaignIn(h, spot, MARIO, 'small', { freed: ['mario', script.hero!] });
    walkUp(h, l);
    h.tap('up');
    after.forEach((page, i) => {
      expect(h.top()).toBeInstanceOf(CardScene);
      const last = i === after.length - 1;
      expect(h.said.at(-1)).toBe(`${said(page)} ${last ? 'OK to continue.' : 'OK for more, BACK to skip.'}`);
      press(h, 'jump');
    });
    expect(h.top()).toBe(l);
    expect(h.said.some((s) => s.startsWith(said(script.pages[0]!)))).toBe(false);
    h.idle(2);
    h.tap('up');
    expect(h.said.at(-1)?.startsWith(said(script.after![0]!))).toBe(true);
  });

  it('the old man gives no coin once Link is free', () => {
    const h = makeGame();
    const l = campaignIn(h, spotOf('old-man'), MARIO, 'small', { freed: ['mario', 'link'] });
    walkUp(h, l);
    h.tap('up');
    press(h, 'jump');
    expect(h.top()).toBe(l);
    h.idle(20);
    expect(h.game.state.coins).toBe(0);
    expect(l.world.entities.some((e) => e instanceof CoinPop)).toBe(false);
  });

  it("another hero's freeing changes nothing: the villager still tells of Luigi", () => {
    const h = makeGame();
    const l = campaignIn(h, spotOf('villager'), MARIO, 'small', { freed: ['mario', 'link'] });
    walkUp(h, l);
    h.tap('up');
    expect(h.said.at(-1)?.startsWith(said(PARTNERS.villager!.pages[0]!))).toBe(true);
  });

  it('Fred has gone home from the trap pipe once Sophia III is free; Jason stays', () => {
    const h = makeGame();
    const l = campaignIn(h, spotOf('fred'), MARIO, 'small', { freed: ['mario', 'sophia'] });
    h.idle(120);
    expect(partners(l)).toEqual([]);
    const h2 = makeGame();
    const l2 = campaignIn(h2, spotOf('jason'), MARIO, 'small', { freed: ['mario', 'sophia'] });
    h2.idle(120);
    expect(partners(l2).map((p) => p.who)).toEqual(['jason']);
  });
});

describe('partners: who moved, and how they look (0.4.23)', () => {
  it.each([
    ['dr-light', '3-1-bonus'],
    ['chozo', '4-1-bonus'],
  ])('%s is no longer in %s', (_who, level) => {
    const h = makeGame();
    const l = campaignIn(h, { level, start: { mode: 'fall', x: 1, y: 0, time: 300 } });
    h.idle(4);
    expect(partners(l)).toEqual([]);
  });

  it('the fairy greets the heroes as they climb into 2-1-sky: in reach once they step off the vine', () => {
    const h = makeGame();
    const l = campaignIn(h, { level: '2-1-sky', start: { mode: 'climb' } });
    const fairy = walkUp(h, l, 600);
    expect(fairy.who).toBe('fairy');
  });

  it('the fairy floats over her spot and bobs; the others stand on theirs', () => {
    const h = makeGame();
    const l = campaignIn(h, spotOf('fairy'));
    h.idle(2);
    const fairy = partners(l)[0]!;
    const ys = new Set<number>();
    for (let i = 0; i < 60; i++) {
      h.step();
      const s = draw(l).sprites.find((d) => d.frame.startsWith('fairy-'));
      expect(s).toBeDefined();
      expect(s!.y).toBeLessThan(fairy.body.y / px(1) - 8);
      ys.add(s!.y);
    }
    expect(ys.size).toBeGreaterThan(1);
    const h2 = makeGame();
    const l2 = campaignIn(h2, spotOf('villager'));
    h2.idle(2);
    const v = partners(l2)[0]!;
    const s2 = draw(l2).sprites.find((d) => d.frame.startsWith('villager-'));
    expect(s2?.y).toBe(v.body.y / px(1));
  });

  it("Fred sits by the trap pipe, drawn from Sophia III's sheet", () => {
    const h = makeGame();
    const l = campaignIn(h, spotOf('fred'));
    h.idle(120);
    const s = draw(l).sprites.find((d) => d.frame === 'fred-0');
    expect(s?.key).toBe('sophia');
  });
});

describe('partners: the TALK prompt is a button (0.4.35)', () => {
  it('with keys, the word over a partner names the key: TALK (UP)', () => {
    const h = makeGame();
    h.game.deps.settings = defaultSettings();
    h.game.deps.controlScheme = () => 'keyboard';
    const l = campaignIn(h, spotOf('irene'));
    walkUp(h, l);
    expect(draw(l).texts.map((t) => t.str)).toContain('TALK (UP)');
    expect(h.said).toContain('Irene. Up to talk.');
  });

  it('on touch, a TALK button shows in reach and talks; out of reach it is gone', () => {
    const h = makeGame();
    h.game.deps.settings = defaultSettings();
    h.game.deps.controlScheme = () => 'touch';
    const l = campaignIn(h, spotOf('irene'));
    expect(l.touchLabels().special ?? null).not.toBe('TALK');
    walkUp(h, l);
    expect(draw(l).texts.map((t) => t.str)).toContain('TALK');
    expect(l.touchLabels().special).toBe('TALK');
    expect(h.said).toContain('Irene. Press TALK.');
    h.tap('special');
    h.until(() => h.top() instanceof CardScene, 30);
    expect((h.top() as CardScene).lines).toEqual(PARTNERS.irene!.pages[0]);
  });

  it("a hero's own special does nothing while in reach: it talks (Mega Man fires no weapon)", () => {
    const h = makeGame();
    const megaman = CHARACTERS.find((c) => c.id === 'megaman')!;
    const l = campaignIn(h, spotOf('dr-light'), megaman, 'full');
    const p = walkUp(h, l) && l.world.player;
    setHas(p, 'saw-disc');
    h.tap('special');
    expect(l.world.entities.some((e) => e instanceof Projectile && e.kind === 'saw')).toBe(false);
    h.until(() => h.top() instanceof CardScene, 30);
  });
});
