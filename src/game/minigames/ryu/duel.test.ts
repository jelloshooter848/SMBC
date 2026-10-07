import { beforeEach, describe, expect, it } from 'vitest';
import { levelIds } from '@content/levels';
import type { AssetRegistry } from '@engine/assets/registry';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import { overlaps } from '@engine/math/aabb';
import { px, tileToSub, toPx } from '@engine/math/units';
import { defaultSettings } from '@engine/save/settings';
import type { MenuItem } from '@game/scenes/menu';
import { AssistOptionsScene } from '@game/scenes/options';
import { ROUND_GIVE_UP_HINT } from '@game/minigames/menu';
import { MAX_HP } from '@game/characters/ryu';
import { ARENA_GAMES } from '@game/arena';
import { ScorePopup } from '@game/entities/effects/effects';
import { Pickup } from '@game/entities/objects/pickup';
import { MINIGAMES, miniGameFor } from '..';
import { RYU_MINIGAME } from '.';
import { duelStage } from './stage';
import {
  ArtScroll,
  Dog,
  DOG_BARK,
  DOG_SPEED,
  DOG_WAKE,
  Hawk,
  HAWK_CRY,
  HAWK_PIT_WAKE,
  HAWK_SWOOP,
  KNIFE_HEIGHT,
  KnifeThrower,
  Lantern,
  NgShot,
  THROWER_HP,
  THROWER_WIND,
} from './creatures';
import type { MaskedNinja } from './masked';
import { AFTERIMAGE_LAG, MASKED_HP, PHASE_TWO_HP, STAR_AT } from './masked';
import { CLASH_AT, CUTSCENE_FRAMES } from './cutscene';
import { DuelMenuScene, READY_FRAMES, TIME_LIMIT, WIN_FRAMES } from './scene';
import { DuelBot, SHARP } from './bot';
import { duelHarness, type DuelHarness } from './harness';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

class TextRenderer implements Renderer {
  texts: string[] = [];
  rects: [number, number, number, number, string][] = [];
  private readonly none = new NullRenderer();
  clear = this.none.clear;
  sprite = this.none.sprite;
  debugText = this.none.debugText;
  line = this.none.line;
  rect(x: number, y: number, w: number, h: number, c: string): void {
    this.rects.push([x, y, w, h, c]);
  }
  text(...args: Parameters<Renderer['text']>): void {
    this.texts.push(args[1]);
  }
}

const STUB_ASSETS = {
  sheet: () => ({ id: 'stub', image: null, frames: new Map() }),
  has: () => false,
} as unknown as AssetRegistry;

const SWORD = { kind: 'sword' as const, amount: 1, owner: null, dirX: 1 as const };

/** A round from READY (no cutscene). */
function round(opts: Parameters<typeof duelHarness>[0] = {}): DuelHarness {
  const h = duelHarness({ skipCutscene: true, ...opts });
  h.step([], READY_FRAMES);
  expect(h.scene.phase).toBe('stage');
  return h;
}

/** Ryu standing with his feet at `feet` px and his centre at `cx` px, the camera on him. */
function warp(h: DuelHarness, cx: number, feet = 208): void {
  const b = h.scene.player.body;
  b.x = px(cx) - (b.w >> 1);
  b.y = px(feet) - b.h;
  b.vx = 0;
  b.vy = 0;
  b.onGround = true;
  h.world.camera.snapTo(b.x);
}

function the<T>(h: DuelHarness, cls: abstract new (...a: never[]) => T): T[] {
  return h.world.entities.filter((e) => e.alive && e instanceof cls) as T[];
}

/** Steps until he is in `state`. */
function until(h: DuelHarness, boss: MaskedNinja, state: MaskedNinja['state']): void {
  for (let i = 0; i < 2000 && boss.state !== state; i++) h.step();
  expect(boss.state).toBe(state);
}

/** Into the dojo and on until the Masked Ninja is in it and the fight is on. */
function toFight(h: DuelHarness): MaskedNinja {
  h.game.ctx.assist.invulnerable = true;
  warp(h, 1760);
  for (let i = 0; i < 600 && h.scene.phase !== 'fight'; i++) h.step(['right']);
  h.game.ctx.assist.invulnerable = false;
  expect(h.scene.phase).toBe('fight');
  return h.scene.boss as MaskedNinja;
}

describe('Shadow Duel: the mini game contract', () => {
  it('frees Ryu: registered (Dev → Mini games and the arena list MINIGAMES), a title, and rules naming abilities', () => {
    expect(miniGameFor('ryu')).toBe(RYU_MINIGAME);
    expect(Object.keys(MINIGAMES)).toContain('ryu');
    expect(ARENA_GAMES.map((g) => g.id)).toContain('mini-ryu');
    expect(RYU_MINIGAME.hero).toBe('ryu');
    expect(RYU_MINIGAME.title).toBe('SHADOW DUEL');
    for (const line of RYU_MINIGAME.rules) expect(line.length).toBeLessThanOrEqual(26);
    const rules = RYU_MINIGAME.rules.join(' ');
    expect(rules).toMatch(/CLING/);
    expect(rules).toMatch(/JUMP/);
    expect(rules).toMatch(/SLASH/);
    expect(rules).toMatch(/MASKED NINJA/);
    expect(rules).not.toMatch(/\b[ABXYZC] BUTTON|\bPRESS [ABXYZC]\b/);
  });

  it('the stage is kept out of the level library; walls to climb, a 16-wide dojo, few pits and nothing hostile near them', () => {
    expect(levelIds()).not.toContain('ng-shadow-duel');
    const { level, roomX, doorY, doorH, pits, boss } = duelStage();
    expect(level.theme).toBe('ninja-night');
    expect(level.width - roomX).toBe(16);
    expect([doorY, doorH]).toEqual([10, 3]);
    expect(boss.x).toBeGreaterThan(roomX);
    expect(pits).toEqual([70, 71, 76, 77]);
    // Walls taller than a jump (five tiles or more) from the floor: building A, the pillar, the
    // tower and the last wall.
    const floor = level.height - 2;
    const solid = (x: number, y: number) =>
      level.tiles[y * level.width + x] !== 0 && level.tiles[y * level.width + x] !== undefined;
    let tall = 0;
    for (let x = 1; x < roomX; x++) {
      let hgt = 0;
      while (
        hgt < floor &&
        solid(x, floor - 1 - hgt) &&
        level.tiles[(floor - 1 - hgt) * level.width + x] === level.tiles[(floor - 1) * level.width + 20]
      )
        hgt++;
      const prev =
        level.tiles[(floor - 1) * level.width + x - 1] === level.tiles[(floor - 1) * level.width + 20];
      if (hgt >= 5 && !prev) tall++;
    }
    expect(tall).toBe(4);
    // Nothing hostile within ten columns of a pit; hawks far enough that they never wake there.
    for (const e of level.entities) {
      if (e.type === 'lantern') continue;
      for (const c of pits) expect(Math.abs(e.x - c)).toBeGreaterThan(10);
      if (e.type === 'hawk')
        for (const c of pits) expect(Math.abs(e.x - c) * 16).toBeGreaterThan(HAWK_PIT_WAKE + 112);
    }
    const types = level.entities.map((e) => e.type);
    for (const t of ['thrower', 'dog', 'hawk', 'lantern']) expect(types).toContain(t);
    expect(types).not.toContain('masked');
    expect(level.entities.filter((e) => e.props?.drop === 'art')).toHaveLength(1);
  });
});

describe('Shadow Duel: the opening cutscene', () => {
  it('plays first (its music, announced), then READY on its own; touch shows SKIP and MENU', () => {
    const h = duelHarness();
    expect(h.scene.phase).toBe('cutscene');
    expect(h.log.music.at(-1)).toBe('ng-cutscene');
    expect(h.said.at(-1)).toMatch(/moonlit field/);
    expect(h.scene.touchLabels()).toMatchObject({ jump: 'SKIP', start: 'MENU', attack: null });
    h.step([], CUTSCENE_FRAMES);
    expect(h.scene.phase).toBe('ready');
    expect(h.said.at(-1)).toMatch(/Ready!/);
  });

  it('JUMP (OK) skips it, and the press does not make Ryu jump', () => {
    const h = duelHarness();
    h.step([], 30);
    h.step(['jump']);
    expect(h.scene.phase).toBe('ready');
    expect(h.scene.skipped).toBe(true);
    h.step(['jump'], 5);
    h.step([], READY_FRAMES);
    expect(h.scene.phase).toBe('stage');
    expect(h.scene.player.body.onGround).toBe(true);
    const h2 = duelHarness();
    h2.tap('attack');
    expect(h2.scene.phase).toBe('ready');
  });

  it('letterboxed; the clash flashes white only without reduce flashing (the spark is drawn either way)', () => {
    const white = (rf: boolean) => {
      const h = duelHarness({ assets: STUB_ASSETS, reduceFlashing: rf });
      h.step([], CLASH_AT);
      const r = new TextRenderer();
      h.game.scenes.render(r);
      expect(
        r.rects.some(([x, y, w, hh, c]) => x === 0 && y === 0 && w === 256 && hh === 40 && c === '#000'),
      ).toBe(true);
      expect(r.rects.some(([, , w, hh, c]) => w === 32 && hh === 32 && c === '#fcfcfc')).toBe(true);
      return r.rects.some(([, , w, hh, c]) => w === 256 && hh === 160 && c === '#fcfcfc');
    };
    expect(white(true)).toBe(false);
    expect(white(false)).toBe(true);
  });
});

describe('Shadow Duel: wall cling sections', () => {
  /** Holds right and taps JUMP (a kick off every wall it clings to); returns whether it clung. */
  function climb(h: DuelHarness, until: () => boolean, max = 400): boolean {
    let clung = false;
    for (let i = 0; i < max && !until(); i++) {
      h.step(i % 2 === 0 ? ['right', 'jump'] : ['right']);
      if (h.scene.player.clinging) clung = true;
    }
    return clung;
  }

  it("building A (7 tiles) can't be jumped; clinging and kicking off its face climbs onto the roof", () => {
    const h = round();
    h.game.ctx.assist.invulnerable = true;
    const p = h.scene.player;
    warp(h, 300);
    // A plain jump falls short of the roof.
    h.step(['jump'], 30);
    h.step([], 60);
    expect(toPx(p.body.y + p.body.h)).toBe(208);
    const clung = climb(h, () => p.body.onGround && toPx(p.body.y + p.body.h) === 96);
    expect(clung).toBe(true);
    expect(toPx(p.body.y + p.body.h)).toBe(96);
    expect(toPx(p.centerX)).toBeGreaterThan(320);
  });

  it('the shaft: up the pillar, then kicks between the pillar and the tower onto the tower top', () => {
    const h = round();
    h.game.ctx.assist.invulnerable = true;
    const p = h.scene.player;
    warp(h, 50 * 16 - 20);
    climb(h, () => p.body.onGround && toPx(p.body.y + p.body.h) === 64, 900);
    expect(toPx(p.body.y + p.body.h)).toBe(64);
    expect(toPx(p.centerX)).toBeGreaterThan(55 * 16);
  });

  it('while Ryu clings SLASH hides from the touch buttons (it does nothing there); NINPO shows once he has two arts', () => {
    const h = round();
    h.game.ctx.assist.invulnerable = true;
    const p = h.scene.player;
    expect(h.scene.touchLabels()).toMatchObject({
      attack: 'SLASH',
      special: 'SHURIKEN',
      select: null,
      start: 'MENU',
    });
    warp(h, 310);
    h.step(['right', 'jump']);
    for (let i = 0; i < 20 && !p.clinging; i++) h.step(['right']);
    expect(p.clinging).toBe(true);
    expect(h.scene.touchLabels().attack).toBeNull();
    // Out of spirit points: the art's button hides too.
    p.scratch.ninpo = 0;
    h.step([]);
    h.step([], 60);
    expect(h.scene.touchLabels().special).toBeNull();
  });
});

describe('Shadow Duel: lanterns and creatures', () => {
  it('lanterns: the sword breaks one; it leaves spirit points (or health); the art lantern gives the windmill, with a banner', () => {
    const h = round({ assets: STUB_ASSETS, seed: 1 });
    const p = h.scene.player;
    const first = the(h, Lantern).find((l) => l.drop === 'ninpo') as Lantern;
    warp(h, toPx(first.body.x) - 12);
    p.facing = 1;
    h.tap('attack');
    h.step([], 4);
    expect(first.alive).toBe(false);
    const drop = the(h, Pickup)[0] as Pickup;
    expect(drop.item).toBe('ninpo-small');
    const before = h.scene.ninpo;
    for (let i = 0; i < 60 && drop.alive; i++) h.step(['right']);
    expect(h.scene.ninpo).toBe(before + 5);
    // The art.
    h.world.spawn(
      new ArtScroll(p.centerX, p.body.y + p.body.h, (q) =>
        (h.scene as unknown as { gotArt(q: unknown): void }).gotArt(q),
      ),
    );
    h.step([], 20);
    expect(p.scratch.arts).toBe(2);
    const r = new TextRenderer();
    h.game.scenes.render(r);
    expect(r.texts).toContain('YOU GOT A NINPO ART:');
    expect(r.texts).toContain('WINDMILL SHURIKEN');
    expect(h.said.at(-1)).toMatch(/Windmill Shuriken/);
    expect(h.scene.touchLabels().select).toBe('NINPO');
  });

  it(`a knife thrower winds up (${THROWER_WIND} frames) and throws a flat knife at chest height: a crouch ducks it, standing takes it, a slash knocks it away; ${THROWER_HP} hits`, () => {
    const h = round();
    const p = h.scene.player;
    const thrower = the(h, KnifeThrower)[0] as KnifeThrower;
    warp(h, toPx(thrower.body.x) - 90);
    let wound = -1;
    let knife: NgShot | undefined;
    for (let i = 0; i < 300 && !knife; i++) {
      h.step(['down']);
      if (wound < 0 && thrower.wind > 0) wound = i;
      knife = the(h, NgShot).find((s) => s.kind === 'knife');
      if (knife) expect(i - wound).toBe(THROWER_WIND);
    }
    const k = knife as NgShot;
    expect(toPx(k.body.y)).toBe(toPx(thrower.body.y + thrower.body.h) - KNIFE_HEIGHT);
    expect(k.body.vx).toBeLessThan(0);
    // Crouching: it flies over.
    for (let i = 0; i < 80 && k.alive; i++) h.step(['down']);
    expect(p.hp).toBe(MAX_HP);
    // Standing: the next one hits.
    for (let i = 0; i < 300 && p.hp === MAX_HP; i++) h.step();
    expect(p.hp).toBe(MAX_HP - 2);
    // A slash knocks one away.
    h.step([], 40);
    const shot = new NgShot(p.body.x + p.body.w + px(14), p.body.y + px(6), -0x02000, 0, k.spec);
    h.world.spawn(shot);
    p.invuln = 0;
    p.facing = 1;
    h.tap('attack');
    h.step([], 6);
    expect(shot.alive).toBe(false);
    expect(p.hp).toBe(MAX_HP - 2);
    for (let i = 0; i < THROWER_HP; i++) thrower.hit(SWORD, h.world);
    expect(thrower.alive).toBe(false);
  });

  it(`a dog waits, barks (${DOG_BARK} frames) once Ryu is within ${DOG_WAKE} px, then runs at him; only a crouching slash reaches it`, () => {
    const h = round();
    h.game.ctx.assist.invulnerable = true;
    const p = h.scene.player;
    warp(h, 100);
    const dog = new Dog(px(100 + DOG_WAKE + 40), px(208 - 10));
    h.world.spawn(dog);
    h.step([], 20);
    expect(dog.state).toBe('wait');
    warp(h, 160);
    h.step();
    expect(dog.state).toBe('bark');
    h.step([], DOG_BARK);
    expect(dog.state).toBe('run');
    const x0 = dog.body.x;
    h.step();
    expect(x0 - dog.body.x).toBe(DOG_SPEED >> 4);
    // Standing slash: over its back. Crouching slash: it meets it.
    const d2 = new Dog(px(400), px(208 - 10));
    h.world.spawn(d2);
    warp(h, 400 - 12);
    p.facing = 1;
    h.step(['attack']);
    h.step([], 2);
    expect(p.activeMelee && overlaps(p.activeMelee, d2.body)).toBeFalsy();
    h.step([], 12);
    h.step(['down']);
    h.step(['down', 'attack']);
    h.step(['down'], 2);
    expect(p.activeMelee && overlaps(p.activeMelee, d2.body)).toBe(true);
  });

  it('a hawk circles, cries, swoops to his chest and glides level through him; it strikes once and crumbles', () => {
    const h = round();
    for (const t of the(h, KnifeThrower)) t.destroy();
    const p = h.scene.player;
    warp(h, 140);
    const hawk = new Hawk(px(220), px(70), []);
    h.world.spawn(hawk);
    for (let i = 0; i < 40 && hawk.state === 'circle'; i++) h.step();
    expect(hawk.state).toBe('cry');
    h.step([], HAWK_CRY);
    expect(hawk.state).toBe('swoop');
    h.step([], HAWK_SWOOP);
    expect(hawk.state).toBe('glide');
    expect(Math.abs(toPx(hawk.body.y) - toPx(p.body.y + px(4)))).toBeLessThanOrEqual(1);
    for (let i = 0; i < 120 && hawk.alive; i++) h.step();
    expect(hawk.alive).toBe(false);
    expect(p.hp).toBe(MAX_HP - 2);
  });

  it('fair play: a hawk never turns on Ryu near a pit, and pulls out of its swoop when he walks up to one', () => {
    const h = round();
    for (const t of the(h, KnifeThrower)) t.destroy();
    warp(h, 140);
    const near = new Hawk(px(200), px(70), [11]); // a pit column 36 px ahead of him
    h.world.spawn(near);
    h.step([], 200);
    expect(near.state).toBe('circle');
    near.destroy();
    const hawk = new Hawk(px(220), px(70), [16]);
    h.world.spawn(hawk);
    for (let i = 0; i < 60 && hawk.state !== 'swoop'; i++) h.step();
    expect(hawk.state).toBe('swoop');
    warp(h, 16 * 16 - 30);
    h.step();
    expect(hawk.state).toBe('rise');
    h.step([], 60);
    expect(h.scene.player.hp).toBe(MAX_HP);
  });
});

describe('The Masked Ninja', () => {
  it('his round: stand, crouch, dash, turn at the wall, run up it, three stars aimed at Ryu, the glint, the dive, kneel', () => {
    const h = round();
    const boss = toFight(h);
    h.game.ctx.assist.invulnerable = true;
    const stars: NgShot[] = [];
    const spawn = h.world.spawn.bind(h.world);
    h.world.spawn = (e) => {
      if (e instanceof NgShot) stars.push(e);
      spawn(e);
    };
    for (let i = 0; i < 1200 && boss.moves.length < 10; i++) h.step();
    expect(boss.moves.slice(0, 10)).toEqual([
      'stand',
      'crouch',
      'dash',
      'turn',
      'climb',
      'wall',
      'aim',
      'dive',
      'recover',
      'stand',
    ]);
    expect(stars).toHaveLength(STAR_AT.length);
    for (const s of stars) expect(Math.sign(s.body.vy)).toBe(1);
  });

  it('blades clang off while he dashes, runs and dives; they hurt while he stands, kneels or clings', () => {
    const h = round();
    const boss = toFight(h);
    h.game.ctx.assist.invulnerable = true;
    until(h, boss, 'stand');
    expect(boss.hit(SWORD, h.world)).toBe('hp');
    expect(h.scene.life.hp).toBe(MASKED_HP - 1);
    until(h, boss, 'dash');
    h.scene.life.iframes = 0;
    expect(boss.hit(SWORD, h.world)).toBe('immune');
    expect(h.log.sfx).toContain('clang');
    until(h, boss, 'wall');
    h.scene.life.iframes = 0;
    expect(boss.hit(SWORD, h.world)).toBe('hp');
    until(h, boss, 'dive');
    h.scene.life.iframes = 0;
    expect(boss.hit(SWORD, h.world)).toBe('immune');
    expect(h.scene.enemyBar()).toBeLessThan(16);
  });

  it(`under ${PHASE_TWO_HP + 1} hit points his afterimage runs his dash ${AFTERIMAGE_LAG} frames behind him`, () => {
    const h = round();
    const boss = toFight(h);
    h.game.ctx.assist.invulnerable = true;
    h.scene.life.hp = PHASE_TWO_HP;
    until(h, boss, 'dash');
    const xs: number[] = [];
    for (let i = 0; i < 20 && boss.state === 'dash'; i++) {
      xs.push(boss.body.x);
      h.step();
    }
    expect(boss.afterimage.active).toBe(true);
    expect(boss.afterimage.body.x).toBe(xs[xs.length - AFTERIMAGE_LAG]);
    while (boss.state === 'dash' || boss.state === 'turn') h.step();
    h.step([], AFTERIMAGE_LAG + 2);
    expect(boss.afterimage.active).toBe(false);
  });

  it('beating him wins: banner, announcer, jingle, then pass (reported once)', () => {
    const h = round({ assets: STUB_ASSETS, keep: true });
    const boss = toFight(h);
    until(h, boss, 'stand');
    h.scene.life.hp = 1;
    boss.hit(SWORD, h.world);
    expect(h.scene.phase).toBe('won');
    expect(h.scene.enemyBar()).toBe(0);
    const r = new TextRenderer();
    h.game.scenes.render(r);
    expect(r.texts).toContain('THE MASKED NINJA FALLS!');
    expect(r.texts).toContain('THE CURSE IS BROKEN.');
    expect(h.said.at(-1)).toMatch(/curse/);
    h.step([], WIN_FRAMES + 5);
    expect(h.log.jingles).toContain('castle-clear');
    expect(h.results).toEqual(['pass']);
    h.step([], 300);
    expect(h.results).toEqual(['pass']);
  });

  it('in a round for fun (Game.inRound) the win says nothing of the curse, and Give up "Ends the round"', () => {
    const h = round({ assets: STUB_ASSETS, keep: true });
    h.game.inRound = true;
    h.tap('start');
    const menu = h.game.scenes.top as DuelMenuScene;
    const items = (menu as unknown as { items: MenuItem[] }).items;
    expect(items[1]?.hint).toBe(ROUND_GIVE_UP_HINT);
    h.step([], 8);
    h.tap('jump');
    const boss = toFight(h);
    until(h, boss, 'stand');
    h.scene.life.hp = 1;
    boss.hit(SWORD, h.world);
    const r = new TextRenderer();
    h.game.scenes.render(r);
    expect(r.texts).toContain('THE MASKED NINJA FALLS!');
    expect(r.texts).not.toContain('THE CURSE IS BROKEN.');
    expect(h.said.at(-1)).not.toMatch(/curse/);
  });
});

describe('Shadow Duel: endings, menu and assists', () => {
  it('a sharp bot plays the whole round (clinging its way up) and passes, leaving the campaign state alone', () => {
    const h = duelHarness();
    const before = { ...h.game.state };
    h.step(['jump']); // skips the cutscene
    h.step([]);
    const bot = new DuelBot(SHARP);
    h.play(bot);
    expect(h.results).toEqual(['pass']);
    for (const ph of ['stage', 'gate', 'fight', 'won']) expect(bot.reached.has(ph)).toBe(true);
    expect(bot.clung).toBeGreaterThan(0);
    expect(h.game.state).toEqual(before);
  }, 60_000);

  it('standing still fails: the clock runs out (reported once)', () => {
    const h = duelHarness({ keep: true, skipCutscene: true });
    h.step([], READY_FRAMES + TIME_LIMIT * 60 + 260);
    expect(h.said).toContain('Time is up. Try again.');
    expect(h.results).toEqual(['fail']);
    for (let i = 0; i < 300; i++) h.step(i % 7 === 0 ? ['start'] : []);
    expect(h.results).toEqual(['fail']);
    expect(h.game.scenes.top).toBe(h.scene);
  });

  it('losing every hit point fails; so does a pit', () => {
    const h = round();
    h.scene.player.hp = 2;
    h.world.hurtPlayer(h.scene.player, 1);
    for (let i = 0; i < 400 && h.results.length === 0; i++) h.step();
    expect(h.results).toEqual(['fail']);
    expect(h.said.at(-1)).toBe('Ryu is down. Try again.');
    const h2 = round();
    warp(h2, 70 * 16 + 16);
    for (let i = 0; i < 400 && h2.results.length === 0; i++) h2.step();
    expect(h2.results).toEqual(['fail']);
    expect(h2.said.at(-1)).toBe('Ryu fell. Try again.');
  });

  it('the menu offers Continue and Give up (quit), from the cutscene, the stage and the dojo', () => {
    const h = duelHarness();
    h.tap('start');
    expect(h.game.scenes.top).toBeInstanceOf(DuelMenuScene);
    h.step([], 8);
    h.tap('jump');
    expect(h.game.scenes.top).toBe(h.scene);
    expect(h.scene.phase).toBe('cutscene');
    h.tap('start');
    h.step([], 8);
    h.tap('down');
    h.tap('jump');
    expect(h.results).toEqual(['quit']);
    expect(h.game.scenes.top).toBe(h.below);
    const h2 = round();
    toFight(h2);
    h2.tap('start');
    h2.step([], 8);
    h2.tap('down');
    h2.tap('jump');
    expect(h2.results).toEqual(['quit']);
  });

  it('in dev mode the menu offers the assists; No damage keeps every hit point, Infinite time holds the clock', () => {
    const h = round();
    h.game.deps.settings = { ...defaultSettings(), dev: true };
    h.tap('start');
    const menu = h.game.scenes.top as DuelMenuScene;
    const items = (menu as unknown as { items: MenuItem[] }).items;
    expect(items.map((i) => i.label)).toEqual(['Continue', 'Give up', 'Assists']);
    items[2]?.select?.();
    expect(h.game.scenes.top).toBeInstanceOf(AssistOptionsScene);
    h.game.scenes.pop();
    h.game.scenes.pop();
    const h2 = round();
    const boss = toFight(h2);
    h2.game.ctx.assist.invulnerable = true;
    h2.game.ctx.assist.infiniteTime = true;
    const p = h2.scene.player;
    const secs = h2.scene.seconds;
    for (let i = 0; i < 1500; i++) {
      if (i % 40 === 0) p.body.x = boss.body.x;
      h2.step();
    }
    expect(p.hp).toBe(MAX_HP);
    expect(h2.scene.seconds).toBe(secs);
  });
});

describe('Shadow Duel: screen and controls', () => {
  it('a kill scores no point popup: the HUD has no score', () => {
    const h = round();
    h.world.addScore(200, px(100), px(100));
    h.step();
    expect(h.world.entities.some((e) => e instanceof ScorePopup)).toBe(false);
  });

  it("touch: only MENU on READY and walking into the dojo, Ryu's buttons while he plays, none once decided", () => {
    const h = duelHarness({ skipCutscene: true });
    expect(h.scene.touchLabels()).toMatchObject({ jump: null, attack: null, start: 'MENU' });
    h.step([], READY_FRAMES);
    expect(h.scene.touchLabels()).toMatchObject({ jump: 'JUMP', attack: 'SLASH', start: 'MENU' });
    h.scene.player.hp = 1;
    h.world.hurtPlayer(h.scene.player, 1);
    h.step();
    expect(h.scene.touchLabels()).toMatchObject({ jump: null, attack: null, start: null });
  });

  it('draws the Ninja Gaiden HUD (TIMER, NINJA, ENEMY, ninpo) and a steady READY with reduce flashing', () => {
    const h = duelHarness({ assets: STUB_ASSETS, skipCutscene: true });
    const reads: boolean[] = [];
    for (let i = 0; i < 40; i++) {
      const r = new TextRenderer();
      h.game.scenes.render(r);
      reads.push(r.texts.includes('READY'));
      if (i === 0)
        expect(r.texts).toEqual(
          expect.arrayContaining([`TIMER-${TIME_LIMIT}`, 'NINJA', 'ENEMY', 'NINPO-10']),
        );
      h.step();
    }
    expect(reads.every(Boolean)).toBe(true);
  });

  it('reduce flashing: a hit on the Masked Ninja shows his hurt frame, never the white flash', () => {
    const flashes = (rf: boolean) => {
      const h = round({ assets: STUB_ASSETS, reduceFlashing: rf });
      const boss = toFight(h);
      until(h, boss, 'stand');
      boss.hit(SWORD, h.world);
      h.step();
      const r = new TextRenderer();
      h.game.scenes.render(r);
      return r.rects.some(([, , w, hh, c]) => w === 16 && hh === 32 && c === '#fcfcfc');
    };
    expect(flashes(true)).toBe(false);
    expect(flashes(false)).toBe(true);
  });

  it('the dojo: Ryu walks in, the doorway shuts behind him, and the Masked Ninja appears to his music', () => {
    const h = round();
    toFight(h);
    const { roomX, doorY } = duelStage();
    expect(h.world.map.isSolid(roomX, doorY)).toBe(true);
    expect(h.log.music).toContain('ng-boss');
    expect(h.said.some((s) => s.startsWith('The Masked Ninja!'))).toBe(true);
    expect(toPx(h.scene.player.body.x)).toBeGreaterThan((roomX + 1) * 16);
    expect(tileToSub(roomX)).toBe(h.world.camera.x);
  });
});
