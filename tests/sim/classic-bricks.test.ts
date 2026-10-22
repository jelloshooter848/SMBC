import { afterEach, describe, expect, it, vi } from 'vitest';
import { px } from '@engine/math/units';
import { Rng } from '@engine/rng';
import { T } from '@game/level/tiles';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { MEGAMAN } from '@game/characters/megaman';
import { SAMUS } from '@game/characters/samus';
import { SIMON } from '@game/characters/simon';
import { FIREBALL, Projectile, type ProjectileSpec } from '@game/entities/projectiles/projectile';
import { Pickup } from '@game/entities/objects/pickup';
import { PowerUp } from '@game/entities/objects/powerup';
import { Goomba } from '@game/entities/enemies/goomba';
import { BRICK_HP } from '@game/rules/classic-bricks';
import { CLASSIC_DROPS, classicDrop } from '@game/characters/classic/power';
import type { CharacterDef } from '@game/characters/character';
import type { World } from '@game/world/world';
import { classicStub, classicWorld, sfxLog, shotSpec, step, testLevel, tile } from './classic-harness';
import { isolateClassicRegistry } from './classic-registry';

// Independent of which hero slices have landed: no registered Classic hero def replaces this
// file's stand-ins (tests/sim/classic-registry.ts).
isolateClassicRegistry({ hide: true });

// Classic block rules (bug-reports/2026-10-07-classic-bricks-and-shots.md, BR-C1..BR-C19): brick
// HP 125, weapons that break bricks and bump item blocks from any side, shots that pass through
// ground (TG-26's ProjectileSpec.classicBlocks), Classic heads per def, and block drops. Heroes
// are stand-in Classic defs; the weapon specs are stubs with the BR-C14 values.

afterEach(() => {
  vi.restoreAllMocks();
});

const smallHead = (def: CharacterDef): CharacterDef => classicStub(def, { canBreakBricks: () => false });

/** A shot of `spec` from the World's player at (col, row) heading right. */
function fire(w: World, spec: ProjectileSpec, col: number, row: number, dir: -1 | 1 = 1): Projectile {
  const pr = new Projectile(tile(col), tile(row) + px(5), dir, spec, w.player);
  w.spawn(pr);
  return pr;
}

const BUSTER_C = shotSpec({
  amount: 100,
  classicBlocks: { ground: 'pass', afterBlock: 'end', strikesBlocks: true },
});
const SHORT_BEAM = shotSpec({
  amount: 150,
  classicBlocks: { ground: 'collide', afterBlock: 'end', strikesBlocks: true },
});
const WAVE_BEAM = shotSpec({
  amount: 225,
  classicBlocks: { ground: 'pass', afterBlock: 'end', strikesBlocks: true },
});
const AXE = shotSpec({
  amount: 350,
  classicBlocks: { ground: 'pass', afterBlock: 'continue', strikesBlocks: true },
});
const METAL_BLADE = shotSpec({
  amount: 150,
  classicBlocks: { ground: 'pass', afterBlock: 'continueIfBroken', strikesBlocks: true },
});
const BOOMERANG = shotSpec({
  amount: 0,
  classicBlocks: { ground: 'none', afterBlock: 'continue', strikesBlocks: false },
});
const FIREBALL_C: ProjectileSpec = {
  ...FIREBALL,
  amount: 1000,
  classicBlocks: { ground: 'collide', afterBlock: 'end', strikesBlocks: false },
};

describe('heads (BR-C3..BR-C5)', () => {
  it('a hero whose def does not break bricks bumps them; a breaking head breaks them', () => {
    const w = classicWorld(smallHead(SAMUS), testLevel({ 9: '....=' }));
    expect(w.strikeBlock(4, 9, w.player, false)).toEqual({ broken: false, bumped: true, hp: 0 });
    step(w, 20);
    expect(w.map.get(4, 9)).toBe(T.BRICK);
    const wm = classicWorld(classicStub(MARIO), testLevel({ 9: '....=' }));
    expect(wm.strikeBlock(4, 9, wm.player, true)?.broken).toBe(true);
    expect(wm.map.get(4, 9)).toBe(T.AIR);
  });

  it('a head bump leaves the brick at 0 HP: one Mega Buster shot breaks it next', () => {
    const w = classicWorld(smallHead(MEGAMAN), testLevel({ 12: '........=' }));
    w.strikeBlock(8, 12, w.player, false);
    step(w, 20);
    expect(w.brickHp.get('8,12')).toBe(0);
    const s = fire(w, BUSTER_C, 5, 12);
    step(w, 30);
    expect(s.alive).toBe(false);
    expect(w.map.get(8, 12)).toBe(T.AIR);
  });

  it('Campaign: strikeBlock reports nothing and keeps no brick HP', () => {
    const w = classicWorld(SAMUS, testLevel({ 9: '....=' }), 'campaign');
    expect(w.strikeBlock(4, 9, w.player, true)).toBeUndefined();
    expect(w.map.get(4, 9)).toBe(T.AIR);
    expect(w.brickHp.size).toBe(0);
  });
});

describe('shots on bricks (BR-C7, BR-C9, BR-C16, BR-C17)', () => {
  it('Mega Buster: 125 -> 25 after one shot, silent; broken by the 2nd for 50 points', () => {
    const w = classicWorld(smallHead(MEGAMAN), testLevel({ 12: '........=' }));
    const sounds = sfxLog(w);
    const a = fire(w, BUSTER_C, 5, 12);
    step(w, 30);
    expect(a.alive).toBe(false);
    expect(w.map.get(8, 12)).toBe(T.BRICK);
    expect(w.brickHp.get('8,12')).toBe(BRICK_HP - 100);
    expect(sounds).toEqual([]);
    const before = w.state.score;
    fire(w, BUSTER_C, 5, 12);
    step(w, 30);
    expect(w.map.get(8, 12)).toBe(T.AIR);
    expect(w.state.score - before).toBe(50);
    expect(sounds).toContain('break');
  });

  it('a Mega Buster shot along the ground passes the pipe; a Short Beam stops at it; a Wave Beam passes', () => {
    // Pipe at columns 10-11 (rows 11-12); the shot starts at column 6 on row 12.
    const lvl = () => testLevel({ 11: '..........[]', 12: '..........{}' });
    const w = classicWorld(smallHead(MEGAMAN), lvl());
    const b = fire(w, BUSTER_C, 6, 12);
    step(w, 30);
    expect(b.body.x).toBeGreaterThan(tile(12));
    const ws = classicWorld(smallHead(SAMUS), lvl());
    const s = fire(ws, SHORT_BEAM, 6, 12);
    step(ws, 30);
    expect(s.alive).toBe(false);
    expect(s.body.x).toBeLessThan(tile(10));
    const ww = classicWorld(smallHead(SAMUS), lvl());
    const v = fire(ww, WAVE_BEAM, 6, 12);
    step(ww, 30);
    expect(v.body.x).toBeGreaterThan(tile(12));
  });

  it('a ground-passing shot reaches the Goomba beyond the pipe', () => {
    const w = classicWorld(smallHead(MEGAMAN), testLevel({ 11: '..........[]', 12: '..........{}' }));
    const g = new Goomba(tile(14), tile(12) + px(2));
    g.body.vx = 0;
    w.spawn(g);
    fire(w, BUSTER_C, 6, 12);
    step(w, 45);
    expect(g.classicHp).toBe(150);
  });

  it("Simon's Axe through a row of 3 bricks: all 3 break and the Axe is still alive", () => {
    const w = classicWorld(smallHead(SIMON), testLevel({ 12: '........===' }));
    const a = fire(w, AXE, 5, 12);
    step(w, 30);
    expect([8, 9, 10].map((x) => w.map.get(x, 12))).toEqual([T.AIR, T.AIR, T.AIR]);
    expect(a.alive).toBe(true);
  });

  it('a Mega Buster wall: one brick per 2 shots', () => {
    const w = classicWorld(smallHead(MEGAMAN), testLevel({ 12: '........##=##' }));
    for (let i = 0; i < 2; i++) {
      fire(w, BUSTER_C, 5, 12);
      step(w, 40);
    }
    expect(w.map.get(10, 12)).toBe(T.AIR);
  });

  it("Link's boomerang through a brick: unchanged; Mario's fireball against a brick's side: it explodes, brick unchanged", () => {
    const w = classicWorld(smallHead(LINK), testLevel({ 12: '........=' }));
    const b = fire(w, BOOMERANG, 5, 12);
    step(w, 20);
    expect(w.map.get(8, 12)).toBe(T.BRICK);
    expect(b.body.x).toBeGreaterThan(tile(9));
    const wm = classicWorld(classicStub(MARIO), testLevel({ 12: '........=' }));
    const f = new Projectile(tile(6), tile(12) + px(4), 1, FIREBALL_C, wm.player);
    wm.spawn(f);
    step(wm, 20);
    expect(f.alive).toBe(false);
    expect(wm.map.get(8, 12)).toBe(T.BRICK);
    expect(wm.brickHp.size).toBe(0);
  });
});

describe('shots on item blocks (BR-C8, BR-C9, BR-C11, BR-C12)', () => {
  it('Metal Blade at a ? block: the coin comes out and the blade is still alive a frame later', () => {
    const w = classicWorld(smallHead(MEGAMAN), testLevel({ 12: '........?' }));
    const coins = w.state.coins;
    const m = fire(w, METAL_BLADE, 5, 12);
    let f = 0;
    while (w.state.coins === coins && f++ < 30) step(w);
    expect(w.state.coins).toBe(coins + 1);
    step(w);
    expect(m.alive).toBe(true);
  });

  it('a Short Beam into a ? block from the side bumps it and ends', () => {
    const w = classicWorld(smallHead(SAMUS), testLevel({ 12: '........M' }));
    const s = fire(w, SHORT_BEAM, 5, 12);
    step(w, 30);
    expect(s.alive).toBe(false);
    expect(w.entities.some((e) => e instanceof PowerUp)).toBe(true);
  });

  it('a shot from the side reveals a hidden 1-up block and a 1-up rises from its top', () => {
    const w = classicWorld(smallHead(MEGAMAN), testLevel({ 12: '........1' }));
    fire(w, BUSTER_C, 5, 12);
    step(w, 30);
    const up = w.entities.find((e): e is PowerUp => e instanceof PowerUp && e.item === '1up');
    expect(up).toBeDefined();
    expect(w.map.get(8, 12)).toBe(T.USED);
  });

  it('a passing-through shot gives one coin per contact from a multi-coin brick', () => {
    const w = classicWorld(smallHead(SIMON), testLevel({ 12: '........C' }));
    const coins = w.state.coins;
    fire(w, AXE, 5, 12);
    step(w, 40);
    expect(w.state.coins - coins).toBe(1);
  });

  it('a used block is plain ground: a passing shot flies through it', () => {
    const w = classicWorld(smallHead(MEGAMAN), testLevel({ 12: '........u' }));
    const s = fire(w, BUSTER_C, 5, 12);
    step(w, 20);
    expect(s.body.x).toBeGreaterThan(tile(9));
  });
});

describe('melee and blasts (BR-C6, BR-C13)', () => {
  it('melee breaks a plain brick in one hit and bumps an item block, each once per swing', () => {
    const def = classicStub(SIMON, { canBreakBricks: () => false, meleeStrikesBlocks: true });
    const w = classicWorld(def, testLevel({ 10: '....=?' }));
    const coins = w.state.coins;
    def.behaviour = {
      ...SIMON.behaviour,
      update: (p, input, world) => {
        SIMON.behaviour.update(p, input, world);
        p.activeMelee = { x: tile(4), y: tile(10), w: tile(2), h: tile(1) };
      },
    };
    step(w, 5);
    expect(w.map.get(4, 10)).toBe(T.AIR);
    expect(w.state.coins).toBe(coins + 1);
  });

  it('a blast takes its damage off the brick (800 breaks, 100 leaves 25)', () => {
    const w = classicWorld(smallHead(LINK), testLevel({ 9: '..........=...=' }));
    w.explode(tile(10) + px(8), tile(9) + px(8), 8, w.player, { amount: 800, hurtsPlayers: false });
    expect(w.map.get(10, 9)).toBe(T.AIR);
    w.explode(tile(14) + px(8), tile(9) + px(8), 8, w.player, { amount: 100, hurtsPlayers: false });
    expect(w.map.get(14, 9)).toBe(T.BRICK);
    expect(w.brickHp.get('14,9')).toBe(25);
  });
});

describe('drops from blocks (BR-C18)', () => {
  it('10 000 bricks for Simon: about 6.25 % drop a heart, about 1 in 5 of those big', () => {
    const rng = new Rng(12345);
    const p = classicWorld(classicStub(SIMON)).player;
    const roll = (source: 'brick' | 'coin', table = CLASSIC_DROPS.simon) =>
      classicDrop(rng, p, table, source);
    let drops = 0;
    let big = 0;
    for (let i = 0; i < 10000; i++) {
      const d = roll('brick');
      if (d) drops++;
      if (d === 'heart-large') big++;
    }
    expect(drops / 10000).toBeGreaterThan(0.055);
    expect(drops / 10000).toBeLessThan(0.07);
    expect(big / drops).toBeGreaterThan(0.14);
    expect(big / drops).toBeLessThan(0.26);
    // Coins roll at 12.5 %, and only for a hero who gets coin drops.
    let coinDrops = 0;
    for (let i = 0; i < 10000; i++) if (roll('coin')) coinDrops++;
    expect(coinDrops / 10000).toBeGreaterThan(0.115);
    expect(coinDrops / 10000).toBeLessThan(0.135);
    // Link and Samus get nothing from coins; Mega Man nothing from blocks at all.
    expect(roll('coin', CLASSIC_DROPS.link)).toBeNull();
    expect(roll('brick', CLASSIC_DROPS.megaman)).toBeNull();
  });

  it("a broken brick and a coin block call the def's blockDrop and the drop appears there", () => {
    const calls: string[] = [];
    const def = classicStub(SIMON, {
      canBreakBricks: () => false,
      blockDrop: (_rng, _p, source) => {
        calls.push(source);
        return 'heart-small';
      },
    });
    const w = classicWorld(def, testLevel({ 12: '........=?' }));
    w.strikeBlock(8, 12, w.player, false, { source: 'melee' });
    w.strikeBlock(9, 12, w.player, false, { source: 'shot', damage: 300 });
    expect(calls).toEqual(['brick', 'coin']);
    const drops = w.entities.filter((e): e is Pickup => e instanceof Pickup);
    expect(drops).toHaveLength(2);
    expect(drops[0]?.body.x).toBeGreaterThanOrEqual(tile(8));
    expect(drops[0]?.body.x).toBeLessThan(tile(9));
    // A plain bump of a brick (it survives) rolls nothing.
    calls.length = 0;
    const w2 = classicWorld(def, testLevel({ 12: '........=' }));
    w2.strikeBlock(8, 12, w2.player, false);
    expect(calls).toEqual([]);
  });
});

describe('heads that touch blocks as ground (BR-C3 BRICK_NONE)', () => {
  it('a def whose headBumps is false leaves the block alone', () => {
    const def = classicStub(SAMUS, { canBreakBricks: () => false, headBumps: () => false });
    const w = classicWorld(def, testLevel({ 9: '..?' }));
    const coins = w.state.coins;
    const hit = (w as unknown as { hitBlock(tx: number, ty: number, p: unknown): void }).hitBlock.bind(w);
    hit(2, 9, w.player);
    expect(w.state.coins).toBe(coins);
    expect(w.map.get(2, 9)).toBe(T.Q_COIN);
  });
});

describe('heroes without a Classic def yet (TG-20)', () => {
  it("a Campaign def's bomb under Classic rules still breaks a brick (its points count 1000 each)", () => {
    const w = classicWorld(LINK, testLevel({ 9: '..........=' }));
    w.explode(tile(10) + px(8), tile(9) + px(8), 8, w.player, { hurtsPlayers: false });
    expect(w.map.get(10, 9)).toBe(T.AIR);
  });
});

describe('strike sources (TG-25)', () => {
  it("a hero's own melee strike is a melee strike under Classic (it breaks; it is not a head bump)", () => {
    const w = classicWorld(smallHead(LINK), testLevel({ 9: '....=' }));
    w.strikeBlock(4, 9, w.player, true, { source: 'melee' });
    expect(w.map.get(4, 9)).toBe(T.AIR);
    // The same call with a head source and a hero who cannot break bricks only bumps.
    const w2 = classicWorld(smallHead(LINK), testLevel({ 9: '....=' }));
    w2.strikeBlock(4, 9, w2.player, false);
    step(w2, 20);
    expect(w2.map.get(4, 9)).toBe(T.BRICK);
  });

  it('a swing struck by both the hero and meleeStrikesBlocks gives one coin from a multi-coin brick', () => {
    const def = classicStub(LINK, { canBreakBricks: () => false, meleeStrikesBlocks: true });
    const w = classicWorld(def, testLevel({ 10: '....C' }));
    const box = { x: tile(4), y: tile(10), w: tile(1), h: tile(1) };
    let first = true;
    def.behaviour = {
      ...LINK.behaviour,
      update: (p, input, world) => {
        LINK.behaviour.update(p, input, world);
        p.activeMelee = box;
        // The hero's own strike (as Link's strikeBlocks does), once per swing.
        if (first) world.strikeBlock(4, 10, p, true, { source: 'melee' });
        first = false;
      },
    };
    const coins = w.state.coins;
    step(w, 40);
    expect(w.state.coins - coins).toBe(1);
  });

  it("a strike with no damage keeps its caller's breakBricks (Campaign behaviours under Classic)", () => {
    const w = classicWorld(smallHead(SAMUS), testLevel({ 9: '....==' }));
    w.strikeBlock(4, 9, w.player, false, { source: 'shot' });
    w.strikeBlock(5, 9, w.player, true, { source: 'shot' });
    step(w, 20);
    expect([w.map.get(4, 9), w.map.get(5, 9)]).toEqual([T.BRICK, T.AIR]);
  });

  it('Campaign ignores the source: a melee or shot strike is the same as before', () => {
    for (const hit of [undefined, { source: 'melee' as const }, { source: 'shot' as const, damage: 1 }]) {
      const w = classicWorld(SAMUS, testLevel({ 9: '....=' }), 'campaign');
      expect(w.strikeBlock(4, 9, w.player, false, hit)).toBeUndefined();
      step(w, 20);
      expect(w.map.get(4, 9)).toBe(T.BRICK);
    }
  });
});

describe('blasts and hidden blocks (BR-C11, BR-C13)', () => {
  it('a Classic bomb blast opens a hidden 1-up block; under Campaign it stays hidden', () => {
    const w = classicWorld(smallHead(LINK), testLevel({ 9: '..........1' }));
    w.explode(tile(10) + px(8), tile(9) + px(8), 8, w.player, { amount: 800, hurtsPlayers: false });
    step(w, 20);
    expect(w.map.get(10, 9)).toBe(T.USED);
    expect(w.entities.some((e) => e instanceof PowerUp && e.item === '1up')).toBe(true);
    const cur = classicWorld(LINK, testLevel({ 9: '..........1' }), 'campaign');
    cur.explode(tile(10) + px(8), tile(9) + px(8), 8, cur.player, { hurtsPlayers: false });
    step(cur, 20);
    expect(cur.map.get(10, 9)).toBe(T.HIDDEN_1UP);
  });

  it('our hidden teleporter is left to heads, under Classic too', () => {
    const w = classicWorld(smallHead(LINK), testLevel({ 9: '..........8' }));
    w.explode(tile(10) + px(8), tile(9) + px(8), 8, w.player, { amount: 800, hurtsPlayers: false });
    expect(w.map.get(10, 9)).toBe(T.HIDDEN_TELEPORTER);
  });
});
