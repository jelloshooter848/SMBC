import { beforeEach, describe, expect, it } from 'vitest';
import { levelIds } from '@content/levels';
import type { AssetRegistry } from '@engine/assets/registry';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import { px, tileToSub, toPx } from '@engine/math/units';
import { defaultSettings } from '@engine/save/settings';
import type { MenuItem } from '@game/scenes/menu';
import { AssistOptionsScene } from '@game/scenes/options';
import { MAX_HP } from '@game/characters/simon';
import { Stairs, STAIR_LOCK, STAIR_SPEED } from '@game/entities/objects/stairs';
import { ARENA_GAMES } from '@game/arena';
import { MINIGAMES, miniGameFor } from '..';
import { SIMON_MINIGAME } from '.';
import { castleStage } from './stage';
import {
  Bat,
  BAT_SWOOP,
  Candle,
  CastleDoor,
  CvShot,
  MEDUSA_FIRST,
  MEDUSA_MAX,
  MedusaHead,
  MedusaSpawner,
  Roast,
  ROAST_HP,
  Skeleton,
  SKELETON_EVERY,
  SKELETON_HP,
  SKELETON_POSE,
  SubWeaponItem,
} from './creatures';
import type { Dracula } from './dracula';
import { Beast, BEAST_HP, BOSS_HP, CAST_FIRE_AT, DRACULA_HP, ShockWave, SPOT_CLEAR, SPOTS } from './dracula';
import {
  CastleMenuScene,
  READY_FRAMES,
  TIME_LIMIT,
  TRANSFORM_FRAMES,
  WIN_FRAMES,
  type CastleScene,
} from './scene';
import { CastleBot, SHARP } from './bot';
import { castleHarness, type CastleHarness } from './harness';

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

function ready(h: CastleHarness): void {
  h.step([], READY_FRAMES);
  expect(h.scene.phase).toBe('stage');
}

/** Simon standing with his feet at `feet` px and his centre at `cx` px, the camera on him. */
function warp(h: CastleHarness, cx: number, feet = 208): void {
  const b = h.scene.player.body;
  b.x = px(cx) - (b.w >> 1);
  b.y = px(feet) - b.h;
  b.vx = 0;
  b.vy = 0;
  b.onGround = true;
  h.world.camera.snapTo(b.x);
}

/** Through the door and on until Dracula is in the room. */
function toFight(h: CastleHarness): Dracula {
  ready(h);
  h.game.ctx.assist.invulnerable = true;
  warp(h, 1500);
  for (let i = 0; i < 1500 && h.scene.phase !== 'fight'; i++) h.step(['right']);
  h.game.ctx.assist.invulnerable = false;
  expect(h.scene.phase).toBe('fight');
  return h.scene.dracula as Dracula;
}

function the<T>(h: CastleHarness, cls: abstract new (...a: never[]) => T): T[] {
  return h.world.entities.filter((e) => e.alive && e instanceof cls) as T[];
}

describe("Dracula's Castle: the mini game contract", () => {
  it('frees Simon: registered (Dev → Mini games lists MINIGAMES), a title, and rules naming abilities', () => {
    expect(miniGameFor('simon')).toBe(SIMON_MINIGAME);
    expect(Object.keys(MINIGAMES)).toContain('simon');
    // The Mini Game Arena lists it too (tests/sim/arena.test.ts launches every pad).
    expect(ARENA_GAMES.map((g) => g.id)).toContain('mini-simon');
    expect(SIMON_MINIGAME.hero).toBe('simon');
    expect(SIMON_MINIGAME.title).toBe("DRACULA'S CASTLE");
    for (const line of SIMON_MINIGAME.rules) expect(line.length).toBeLessThanOrEqual(26);
    const rules = SIMON_MINIGAME.rules.join(' ');
    expect(rules).toMatch(/WHIP/);
    expect(rules).toMatch(/STAIRS/);
    expect(rules).toMatch(/DRACULA/);
    expect(rules).not.toMatch(/\b[ABXYZC] BUTTON|\bPRESS [ABXYZC]\b/);
  });

  it('the stage is kept out of the level library; a door, a 16-wide throne room, two flights of stairs', () => {
    expect(levelIds()).not.toContain('cv-castle');
    const { level, door, roomX, boss } = castleStage();
    expect(roomX).toBe(96);
    expect(level.width - roomX).toBe(16);
    expect(door).toEqual({ x: 96, y: 11 });
    expect(boss.x).toBeGreaterThan(roomX);
    const types = level.entities.map((e) => e.type);
    expect(types).not.toContain('door');
    expect(types).not.toContain('dracula');
    const stairs = level.entities.filter((e) => e.type === 'stairs');
    expect(stairs.map((s) => s.props?.dir)).toEqual(['ur', 'ul']);
    expect(types.filter((t) => t === 'candle').some(Boolean)).toBe(true);
    expect(level.entities.find((e) => e.props?.drop === 'dagger')?.type).toBe('candle');
    expect(level.zones).toContainEqual({ kind: 'scrollStop', x: 97 });
  });
});

describe('Castlevania stairs (World `stairs x y len=N dir=ur|ul`)', () => {
  it('UP at the foot gets on; Simon walks the diagonal, cannot jump, and steps off onto the top landing', () => {
    const h = castleHarness();
    ready(h);
    const p = h.scene.player;
    const flight = the(h, Stairs)[0] as Stairs;
    expect(flight.dir).toBe('ur');
    // Too far from the foot: UP does nothing.
    warp(h, 18 * 16 - 20);
    h.step(['up']);
    expect(p.stairs).toBeNull();
    warp(h, 18 * 16 + 3);
    h.step(['up']);
    expect(p.stairs).not.toBeNull();
    const x0 = p.centerX;
    const y0 = p.body.y + p.body.h;
    h.step(['up'], 20);
    // Up and to the right, one for one.
    expect(p.centerX - x0).toBe(20 * STAIR_SPEED);
    expect(y0 - (p.body.y + p.body.h)).toBe(20 * STAIR_SPEED);
    // Jump does nothing on stairs.
    const y1 = p.body.y;
    h.step(['jump'], 3);
    expect(p.body.y).toBe(y1);
    expect(p.stairs).not.toBeNull();
    // RIGHT climbs too (the way this flight rises); letting go stands still.
    h.step(['right'], 4);
    expect(p.body.y).toBeLessThan(y1);
    const y2 = p.body.y;
    h.step([], 10);
    expect(p.body.y).toBe(y2);
    for (let i = 0; i < 200 && p.stairs; i++) h.step(['up']);
    expect(p.stairs).toBeNull();
    expect(p.body.y + p.body.h).toBe(px(128));
    expect(p.body.onGround).toBe(true);
  });

  it('DOWN at the top gets on and walks down to the foot; DOWN at the foot does nothing', () => {
    const h = castleHarness();
    ready(h);
    const p = h.scene.player;
    // The second flight rises left: its top is at column 46 on the walk (row 8).
    warp(h, 46 * 16 - 4, 128);
    h.step(['down']);
    expect(p.stairs?.line.sx).toBe(-1);
    for (let i = 0; i < 200 && p.stairs; i++) h.step(['down']);
    expect(p.stairs).toBeNull();
    expect(p.body.y + p.body.h).toBe(px(208));
    expect(toPx(p.centerX)).toBe(51 * 16);
    h.step(['down'], 5);
    expect(p.stairs).toBeNull();
    // At the foot UP gets on again (after a moment: the end just stepped off is locked briefly).
    h.step([], STAIR_LOCK);
    h.step(['up']);
    expect(p.stairs).not.toBeNull();
  });

  it('a hit on the stairs never knocks Simon off them', () => {
    const h = castleHarness();
    ready(h);
    const p = h.scene.player;
    warp(h, 18 * 16);
    h.step(['up'], 30);
    expect(p.stairs).not.toBeNull();
    const before = { x: p.body.x, y: p.body.y };
    const hp = p.hp;
    p.invuln = 0;
    h.world.hurtPlayer(p, -1);
    expect(p.hp).toBe(hp - 2);
    h.step([], 10);
    expect(p.stairs).not.toBeNull();
    expect({ x: p.body.x, y: p.body.y }).toEqual(before);
  });
});

describe("Dracula's Castle: candles and creatures", () => {
  it('candles: the whip snuffs them; hearts, the dagger (and its banner), and a roast', () => {
    const h = castleHarness({ assets: STUB_ASSETS, seed: 1 });
    ready(h);
    const p = h.scene.player;
    const candles = the(h, Candle);
    const dagger = candles.find((c) => c.drop === 'dagger') as Candle;
    expect(h.scene.hasDagger).toBe(false);
    // Stand left of it, facing it, and lash.
    warp(h, toPx(dagger.body.x) - 14);
    p.facing = 1;
    h.tap('attack');
    h.step([], 20);
    expect(dagger.alive).toBe(false);
    const item = the(h, SubWeaponItem)[0] as SubWeaponItem;
    expect(item).toBeDefined();
    for (let i = 0; i < 60 && item.alive; i++) h.step(['right']);
    expect(h.scene.hasDagger).toBe(true);
    const r = new TextRenderer();
    h.game.scenes.render(r);
    expect(r.texts).toContain('YOU GOT THE DAGGER!');
    expect(h.said.at(-1)).toMatch(/dagger/);
    // The dagger takes a heart a throw.
    const hearts = h.scene.hearts;
    h.tap('special');
    expect(h.scene.hearts).toBe(hearts - 1);
    // A roast gives back hit points.
    p.hp = 4;
    const roast = new Roast(p.centerX, p.body.y + p.body.h);
    h.world.spawn(roast);
    h.step([], 30);
    expect(p.hp).toBe(4 + ROAST_HP);
  });

  it('a bat roosts until Simon comes near, swoops to his head height, flies on and crumbles when it strikes', () => {
    const h = castleHarness();
    ready(h);
    const p = h.scene.player;
    warp(h, 100);
    h.step();
    for (const b of the(h, Bat)) b.destroy(); // the hall's own bat
    const bat = new Bat(px(260), px(40));
    h.world.spawn(bat);
    h.step([], 10);
    expect(bat.state).toBe('roost');
    warp(h, 200);
    h.step();
    expect(bat.state).toBe('swoop');
    h.step([], BAT_SWOOP);
    expect(bat.state).toBe('fly');
    expect(Math.abs(toPx(bat.body.y) - toPx(p.body.y))).toBeLessThan(16);
    const hp = p.hp;
    for (let i = 0; i < 200 && bat.alive; i++) h.step();
    expect(bat.alive).toBe(false);
    expect(p.hp).toBe(hp - 1);
  });

  it('Medusa heads: only while Simon is in their stretch, from the side he faces, a sine wave, one at a time (MEDUSA_MAX)', () => {
    const h = castleHarness();
    ready(h);
    h.game.ctx.assist.invulnerable = true;
    warp(h, 200);
    h.step([], MEDUSA_FIRST + 10);
    expect(the(h, MedusaHead)).toHaveLength(0);
    warp(h, 30 * 16, 128);
    h.scene.player.facing = 1;
    h.step([], MEDUSA_FIRST + 2);
    expect(the(h, MedusaSpawner).length).toBeGreaterThan(0);
    const heads = the(h, MedusaHead);
    expect(heads).toHaveLength(1);
    const head = heads[0] as MedusaHead;
    expect(head.facing).toBe(-1);
    const ys = new Set<number>();
    for (let i = 0; i < 60; i++) {
      h.step();
      ys.add(toPx(head.body.y));
    }
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(16);
    for (let i = 0; i < 1500; i++) {
      h.step();
      expect(the(h, MedusaHead).length).toBeLessThanOrEqual(MEDUSA_MAX);
    }
  });

  it('a skeleton paces by his post and lobs bones in an arc toward Simon; two lashes', () => {
    const h = castleHarness();
    ready(h);
    h.game.ctx.assist.invulnerable = true;
    warp(h, 200);
    const sk = new Skeleton(px(300), px(208 - 30));
    h.world.spawn(sk);
    let bone: CvShot | undefined;
    for (let i = 0; i < SKELETON_EVERY + SKELETON_POSE + 10 && !bone; i++) {
      h.step();
      bone = the(h, CvShot).find((s) => s.kind === 'bone');
    }
    expect(bone).toBeDefined();
    expect((bone as CvShot).body.vx).toBeLessThan(0);
    expect((bone as CvShot).body.vy).toBeLessThan(0);
    // It comes down (gravity).
    h.step([], 40);
    expect((bone as CvShot).body.vy).toBeGreaterThan(0);
    expect(sk.hp).toBe(SKELETON_HP);
    for (let k = 0; k < SKELETON_HP; k++) {
      sk.hit({ kind: 'sword', amount: 1, owner: null, dirX: 1 }, h.world);
    }
    expect(sk.alive).toBe(false);
  });
});

describe('Dracula, phase 1 (the Count)', () => {
  it('teleports: appears at one of four spots, never the last one, never on top of Simon', () => {
    const h = castleHarness();
    const d = toFight(h);
    h.game.ctx.assist.invulnerable = true;
    for (let i = 0; i < 2400; i++) {
      h.step();
      if (d.state === 'appear' && d.t === 1) {
        const left = tileToSub(h.scene.layout.roomX);
        const cx = d.body.x + (d.body.w >> 1);
        expect(SPOTS.map((s) => left + px(s))).toContain(cx);
        expect(Math.abs(cx - h.scene.player.centerX)).toBeGreaterThanOrEqual(px(SPOT_CLEAR) - px(2));
      }
    }
    expect(d.visits.length).toBeGreaterThan(5);
    for (let i = 1; i < d.visits.length; i++) expect(d.visits[i]).not.toBe(d.visits[i - 1]);
    expect(new Set(d.visits).size).toBeGreaterThanOrEqual(2);
  });

  it('only his head can be hurt, and only while he stands there; the body clinks', () => {
    const h = castleHarness();
    const d = toFight(h);
    const sword = { kind: 'sword' as const, amount: 1, owner: null, dirX: 1 as const };
    while (d.state !== 'cast') h.step();
    expect(d.hit(sword, h.world)).toBe('immune');
    expect(h.scene.life.hp).toBe(BOSS_HP);
    expect(d.head.hit(sword, h.world)).toBe('hp');
    expect(h.scene.life.hp).toBe(BOSS_HP - 1);
    // A short grace after a hit.
    expect(d.head.hit(sword, h.world)).toBe('immune');
    for (let i = 0; i < 400 && (d.state as string) !== 'vanish'; i++) h.step();
    h.scene.life.iframes = 0;
    expect(d.head.hit(sword, h.world)).toBe('immune');
    expect(h.scene.life.hp).toBe(BOSS_HP - 1);
  });

  it('casts a spread of three fireballs from his low hand (level, rising, falling); a lash knocks them away', () => {
    const h = castleHarness();
    const d = toFight(h);
    h.game.ctx.assist.invulnerable = true;
    while (!(d.state === 'cast' && d.t === CAST_FIRE_AT)) h.step();
    const shots = the(h, CvShot).filter((s) => s.kind === 'fireball');
    expect(shots).toHaveLength(3);
    const vys = shots.map((s) => Math.sign(s.body.vy)).sort();
    expect(vys).toEqual([-1, 0, 1]);
    for (const s of shots) expect(Math.sign(s.body.vx)).toBe(d.facing);
    // A lash where they fly.
    const p = h.scene.player;
    const s0 = shots[0] as CvShot;
    p.activeMelee = { x: s0.body.x - px(4), y: s0.body.y - px(20), w: px(24), h: px(40) };
    for (const s of shots) s.update(h.world);
    expect(shots.filter((s) => s.alive).length).toBe(0);
  });

  it(`the enemy bar runs across both phases: ${DRACULA_HP} head hits, the beast form, then ${BEAST_HP} more`, () => {
    const h = castleHarness();
    const d = toFight(h);
    expect(h.scene.enemyBar()).toBe(16);
    const sword = { kind: 'sword' as const, amount: 1, owner: null, dirX: 1 as const };
    while (d.state !== 'cast') h.step();
    for (let k = 0; k < DRACULA_HP; k++) {
      h.scene.life.iframes = 0;
      d.state = 'linger';
      d.head.hit(sword, h.world);
    }
    expect(h.scene.life.hp).toBe(BEAST_HP);
    expect(h.scene.phase).toBe('transform');
    expect(h.scene.enemyBar()).toBeLessThan(16);
    expect(h.scene.enemyBar()).toBeGreaterThan(0);
    h.step([], TRANSFORM_FRAMES);
    expect(h.scene.phase).toBe('fight');
    expect(h.scene.beast).toBeInstanceOf(Beast);
    expect(d.alive).toBe(false);
    expect(h.log.music.at(-1)).toBe('cv-beast');
  });
});

describe('Dracula, phase 2 (the beast)', () => {
  function toBeast(h: CastleHarness): Beast {
    const d = toFight(h);
    while (d.state !== 'cast') h.step();
    h.scene.life.hp = BEAST_HP + 1;
    d.head.hit({ kind: 'sword', amount: 1, owner: null, dirX: 1 }, h.world);
    h.step([], TRANSFORM_FRAMES);
    return h.scene.beast as Beast;
  }

  it('rises (not hurtable), then walks, spits, walks, spits, walks and leaps; the landing sends a shock wave each way', () => {
    const h = castleHarness();
    const beast = toBeast(h);
    h.game.ctx.assist.invulnerable = true;
    expect(beast.state).toBe('rise');
    expect(beast.hit({ kind: 'sword', amount: 1, owner: null, dirX: 1 }, h.world)).toBe('immune');
    const spawned: unknown[] = [];
    const spawn = h.world.spawn.bind(h.world);
    h.world.spawn = (e) => {
      spawned.push(e);
      spawn(e);
    };
    for (let i = 0; i < 1500 && beast.attacks.length < 3; i++) h.step();
    for (let i = 0; i < 200 && !spawned.some((e) => e instanceof ShockWave); i++) h.step();
    const spits = spawned.filter((e) => e instanceof CvShot && e.kind === 'beast-fire').length;
    const waves = spawned.filter((e): e is ShockWave => e instanceof ShockWave);
    expect(beast.attacks.slice(0, 3)).toEqual(['spit', 'spit', 'leap']);
    expect(spits).toBe(6);
    expect(waves).toHaveLength(2);
    const dirs = waves.map((w) => w.facing).sort();
    expect(dirs).toEqual([-1, 1]);
  });

  it('beating the beast wins: banner, announcer, jingle, then pass (reported once)', () => {
    const h = castleHarness({ assets: STUB_ASSETS, keep: true });
    const beast = toBeast(h);
    h.step([], 70);
    for (let k = 0; k < BEAST_HP; k++) {
      h.scene.life.iframes = 0;
      beast.hit({ kind: 'sword', amount: 1, owner: null, dirX: 1 }, h.world);
    }
    expect(h.scene.phase).toBe('won');
    expect(h.scene.enemyBar()).toBe(0);
    const r = new TextRenderer();
    h.game.scenes.render(r);
    expect(r.texts).toContain('DRACULA IS DEFEATED!');
    expect(h.said.at(-1)).toMatch(/curse/);
    h.step([], WIN_FRAMES + 5);
    expect(h.log.jingles).toContain('castle-clear');
    expect(h.results).toEqual(['pass']);
    h.step([], 300);
    expect(h.results).toEqual(['pass']);
  });
});

describe("Dracula's Castle: endings, menu and assists", () => {
  it('a sharp bot plays the whole castle and passes, leaving the campaign state alone', () => {
    const h = castleHarness();
    const before = { ...h.game.state };
    const bot = new CastleBot(SHARP);
    h.play(bot);
    expect(h.results).toEqual(['pass']);
    for (const ph of ['stage', 'gate', 'fight', 'transform', 'won']) expect(bot.reached.has(ph)).toBe(true);
    expect(h.game.state).toEqual(before);
  });

  it('standing still fails: the clock runs out (reported once)', () => {
    const h = castleHarness({ keep: true });
    h.step([], READY_FRAMES + TIME_LIMIT * 60 + 260);
    expect(h.said).toContain('Time is up. Try again.');
    expect(h.results).toEqual(['fail']);
    for (let i = 0; i < 300; i++) h.step(i % 7 === 0 ? ['start'] : []);
    expect(h.results).toEqual(['fail']);
    expect(h.game.scenes.top).toBe(h.scene);
  });

  it('losing every hit point fails', () => {
    const h = castleHarness();
    ready(h);
    h.scene.player.hp = 2;
    h.world.hurtPlayer(h.scene.player, 1);
    for (let i = 0; i < 400 && h.results.length === 0; i++) h.step();
    expect(h.results).toEqual(['fail']);
    expect(h.said.at(-1)).toBe('Simon is down. Try again.');
  });

  it('the menu offers Continue and Give up (quit), from the stage and from the throne room', () => {
    const h = castleHarness();
    ready(h);
    h.tap('start');
    expect(h.game.scenes.top).toBeInstanceOf(CastleMenuScene);
    h.step([], 8);
    h.tap('jump');
    expect(h.game.scenes.top).toBe(h.scene);
    h.tap('start');
    h.step([], 8);
    h.tap('down');
    h.tap('jump');
    expect(h.results).toEqual(['quit']);
    expect(h.game.scenes.top).toBe(h.below);
    const h2 = castleHarness();
    toFight(h2);
    h2.tap('start');
    h2.step([], 8);
    h2.tap('down');
    h2.tap('jump');
    expect(h2.results).toEqual(['quit']);
  });

  it('in dev mode the menu offers the assists', () => {
    const h = castleHarness();
    h.game.deps.settings = { ...defaultSettings(), dev: true };
    h.step([], 5);
    h.tap('start');
    const menu = h.game.scenes.top as CastleMenuScene;
    const items = (menu as unknown as { items: MenuItem[] }).items;
    expect(items.map((i) => i.label)).toEqual(['Continue', 'Give up', 'Assists']);
    items[2]?.select?.();
    expect(h.game.scenes.top).toBeInstanceOf(AssistOptionsScene);
  });

  it('dev assists: No damage keeps every hit point; Infinite time holds the clock', () => {
    const h = castleHarness();
    const d = toFight(h);
    h.game.ctx.assist.invulnerable = true;
    h.game.ctx.assist.infiniteTime = true;
    const p = h.scene.player;
    const secs = h.scene.seconds;
    for (let i = 0; i < 1200; i++) {
      if (i % 50 === 0) {
        p.body.x = d.body.x;
        h.world.spawn(
          new CvShot(p.body.x, p.body.y + px(8), 0, 0, { ...(the(h, CvShot)[0]?.spec ?? BONE_SPEC) }, null),
        );
      }
      h.step();
    }
    expect(p.hp).toBe(MAX_HP);
    expect(p.dead).toBe(false);
    expect(h.scene.seconds).toBe(secs);
  });
});

const BONE_SPEC = {
  kind: 'bone',
  w: 8,
  h: 8,
  damage: 2,
  gravity: 0,
  hitsTiles: false,
  frames: ['bone'],
  fallback: ['#fff', '#fff'] as const,
};

describe("Dracula's Castle: screen and controls", () => {
  it("Simon's touch labels while he plays (WHIP), only MENU in the cut-scenes, none once decided", () => {
    const h = castleHarness();
    expect(h.scene.touchLabels()).toMatchObject({ jump: null, attack: null, start: 'MENU' });
    ready(h);
    expect(h.scene.touchLabels().attack).toBe('WHIP');
    expect(h.scene.touchLabels().start).toBe('MENU');
    h.scene.player.hp = 1;
    h.world.hurtPlayer(h.scene.player, 1);
    h.step();
    expect(h.scene.touchLabels()).toMatchObject({ jump: null, attack: null, start: null });
  });

  it('draws the Castlevania HUD (PLAYER, ENEMY, TIME, hearts) and a steady READY with reduce flashing', () => {
    const h = castleHarness({ assets: STUB_ASSETS });
    const reads: boolean[] = [];
    for (let i = 0; i < 40; i++) {
      const r = new TextRenderer();
      h.game.scenes.render(r);
      reads.push(r.texts.includes('READY'));
      if (i === 0) {
        expect(r.texts).toEqual(expect.arrayContaining(['PLAYER', 'ENEMY', 'TIME', '0300', '-05']));
      }
      h.step();
    }
    expect(reads.every(Boolean)).toBe(true);
  });

  it('the door opens, Simon walks in, it shuts behind him and Dracula appears to his music', () => {
    const h = castleHarness();
    toFight(h);
    expect((the(h, CastleDoor)[0] as CastleDoor).state).toBe('shut');
    expect(h.log.music).toContain('cv-boss');
    expect(h.said).toContain('Dracula!');
    expect(the(h, Candle).length).toBe(0);
  });
});

export type { CastleScene };
