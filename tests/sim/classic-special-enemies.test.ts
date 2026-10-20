import { describe, expect, it } from 'vitest';
import { SPRITES } from '@content/sprites';
import { specialEnemiesDef, specialItemFrames } from '@content/sprites/special';
import { itemsDef } from '@content/sprites/items';
import { validateDef } from '@engine/gfx/pixelart';
import { px } from '@engine/math/units';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { heroFor } from '@game/characters/registry';
import { Goomba } from '@game/entities/enemies/goomba';
import { Barrel, Crab, FireEnemy, Fly, Icicle, SPECIAL_SCORES } from '@game/entities/enemies/special-enemies';
import { PowerUp } from '@game/entities/objects/powerup';
import { ENEMY_SCORES } from '@game/rules/score';
import { CLASSIC_HP, armourOf, classicMaxHp, isArmoured } from '@game/rules/classic-enemies';
import { allHammerBros } from '@game/rules/classic-cheats';
import { T } from '@game/level/tiles';
import { HammerWeapon, SPECIAL_ITEM_SAID, WING_FRAMES, HAMMER_FRAMES } from '@game/world/special-items';
import { WATER_MODE_TOP } from '@game/world/world';
import { fullPowerUp } from '@game/world/special-items';
import { AMMO_PICKUPS } from '@game/cheats';
import { SIMON } from '@game/characters/simon';
import { RYU } from '@game/characters/ryu';
import { SOPHIA } from '@game/characters/sophia';
import { runSim } from '@game/sim/headless';
import { SAMUS } from '@game/characters/samus';
import type { EntitySpawn } from '@game/level/schema';
import type { World } from '@game/world/world';
import type { Renderer } from '@engine/gfx/renderer';
import type { View } from '@game/entities/entity';
import { classicStub, classicWorld, step, testLevel, weapon } from './classic-harness';

// G-021: Super Mario Bros. Special's enemies (enemies/Icicle.as, Crab.as, Fly.as, Barrel.as,
// FireEnemy.as) and G-022: its items (pickups/Atom.as, HammerPickup.as, Wing.as;
// projectiles/HammerWeapon.as; Character.as 1619-1665), with our own art.

const at = <E extends { body: { x: number; y: number } }>(w: World, e: E, col: number, row = 12): E => {
  e.body.x = px(col * 16 + 2);
  e.body.y = px(row * 16 + 2);
  w.spawn(e as never);
  return e;
};
/** The player stands at column `col`. */
function stand(w: World, col: number): void {
  w.player.body.x = px(col * 16 + 2);
  w.camera.snapTo(w.player.body.x);
}

describe('G-021 / G-022: the art', () => {
  it('is original pixel art in the text format: 16x16 frames, enemy and item palettes', () => {
    expect(() => validateDef('special-enemies', specialEnemiesDef)).not.toThrow();
    expect(SPRITES['special-enemies']).toBe(specialEnemiesDef);
    expect(specialEnemiesDef.palette).toBe('enemies-overworld');
    for (const rows of [...Object.values(specialEnemiesDef.frames), ...Object.values(specialItemFrames)]) {
      expect(rows).toHaveLength(16);
      for (const r of rows) expect(r).toHaveLength(16);
    }
    for (const k of Object.keys(specialItemFrames)) expect(itemsDef.frames[k], k).toBeDefined();
    for (const k of ['icicle', 'crab-0', 'crab-angry-0', 'fly-0', 'fly-stand', 'barrel-0', 'fire-enemy-0'])
      expect(specialEnemiesDef.frames[k], k).toBeDefined();
  });

  it("the World builds each from its map type, at the original's Classic hit points", () => {
    const w = classicWorld(MARIO);
    const make = (type: string) =>
      (w as unknown as { makeEntity(s: EntitySpawn): unknown }).makeEntity({ type, x: 10, y: 12 });
    expect(make('icicle')).toBeInstanceOf(Icicle);
    expect(make('crab')).toBeInstanceOf(Crab);
    expect(make('fly')).toBeInstanceOf(Fly);
    expect(make('barrel')).toBeInstanceOf(Barrel);
    expect(make('fire-enemy')).toBeInstanceOf(FireEnemy);
    expect(CLASSIC_HP).toMatchObject({ icicle: 25, crab: 600, fly: 350, barrel: 400, 'fire-enemy': 250 });
    expect(classicMaxHp(new Crab(0, 0), w)).toBe(600);
  });

  it('All Hammer Bros turns them into Hammer Bros too', () => {
    const spawns: EntitySpawn[] = ['icicle', 'crab', 'fly', 'barrel', 'fire-enemy'].map((type, i) => ({
      type,
      x: i,
      y: 12,
    }));
    expect(allHammerBros(spawns)).toBe(5);
    expect(spawns.every((s) => s.type === 'hammer-bro')).toBe(true);
  });
});

describe('G-021: none of them can be stomped (Classic and Current)', () => {
  for (const [name, make] of [
    ['Crab', () => new Crab(0, 0)],
    ['Barrel', () => new Barrel(0, 0)],
    ['FireEnemy', () => new FireEnemy(0, 0)],
    ['Fly', () => new Fly(0, 0)],
  ] as const)
    it(`${name}: landing on it hurts`, () => {
      for (const rules of ['classic', 'current'] as const) {
        const w = classicWorld(MARIO, testLevel(), rules);
        const e = at(w, make() as Crab, 2);
        e.walkSpeed = 0;
        e.body.vx = 0;
        e.body.x = w.player.body.x;
        w.player.body.y -= px(48);
        const before = w.feats.stomps;
        step(w, 40);
        expect(w.feats.stomps, rules).toBe(before);
        expect(w.player.invuln > 0 || w.player.dead || w.events.some((v) => v.type === 'died'), rules).toBe(
          true,
        );
      }
    });
});

describe('G-021: Icicle', () => {
  it('hangs until the player is within three tiles, then falls through everything', () => {
    const w = classicWorld(MARIO, testLevel({ 4: '=================' }));
    const ice = new Icicle(px(16 * 16 + 3), px(5 * 16 + 1), 16, 5);
    w.spawn(ice);
    stand(w, 2);
    step(w, 30);
    expect(ice.falling).toBe(false);
    const y0 = ice.body.y;
    stand(w, 14);
    step(w, 2);
    expect(ice.falling).toBe(true);
    step(w, 120);
    // Through the ground: it touches nothing but heroes.
    expect(ice.body.y > y0 + px(16 * 9) || !ice.alive).toBe(true);
  });

  it('drops when the brick it hangs from is bumped', () => {
    const w = classicWorld(MARIO, testLevel({ 9: '..........=' }));
    const ice = new Icicle(px(10 * 16 + 3), px(10 * 16 + 1), 10, 10);
    w.spawn(ice);
    stand(w, 2);
    step(w, 2);
    expect(ice.falling).toBe(false);
    w.map.set(10, 9, T.AIR); // broken
    step(w, 2);
    expect(ice.falling).toBe(true);
  });
});

describe('G-021: Crab', () => {
  it('Classic: a weak hit leaves it calm; at 400 hit points or fewer it is angry, faster, towards the player', () => {
    const def = classicStub(MARIO);
    const w = classicWorld(def);
    stand(w, 2);
    const crab = at(w, new Crab(0, 0), 20);
    crab.hit(weapon(w, 'sword', 100), w);
    expect(crab.angry).toBe(false);
    expect(crab.classicHp).toBe(500);
    crab.hit(weapon(w, 'sword', 150), w);
    expect(crab.angry).toBe(true);
    expect(crab.classicHp).toBe(400);
    expect(crab.body.vx).toBe(-Math.round(crab.walkSpeed * Crab.ANGRY_SPEED));
    step(w, 16);
    expect(crab.currentFrame).toMatch(/^crab-angry-/);
  });

  it("Classic: Mario's fireball only angers a calm crab (400); the next one defeats it", () => {
    const w = classicWorld(heroFor(MARIO, 'classic'));
    const crab = at(w, new Crab(0, 0), 20);
    const fire = { kind: 'fireball' as const, amount: 1000, owner: w.player, dirX: 1 as const };
    expect(crab.hit(fire, w)).toBe('hp');
    expect(crab.angry).toBe(true);
    expect(crab.classicHp).toBe(400);
    expect(crab.hit(fire, w)).toBe('kill');
  });

  it('a block bumped under it pops it up angry (Classic and Current)', () => {
    for (const rules of ['classic', 'current'] as const) {
      const w = classicWorld(MARIO, testLevel(), rules);
      const crab = at(w, new Crab(0, 0), 20);
      expect(crab.hit({ kind: 'bump', amount: 1, owner: null, dirX: 1, fromX: px(30 * 16) }, w), rules).toBe(
        'bounce',
      );
      expect(crab.alive).toBe(true);
      expect(crab.angry).toBe(true);
      expect(crab.body.vy).toBeLessThan(0);
    }
  });

  it('Current: the first hit angers it, the second defeats it', () => {
    const w = classicWorld(MARIO, testLevel(), 'current');
    const crab = at(w, new Crab(0, 0), 20);
    const fire = { kind: 'fireball' as const, amount: 1, owner: w.player, dirX: 1 as const };
    crab.hit(fire, w);
    expect(crab.alive && crab.angry).toBe(true);
    crab.hit(fire, w);
    expect(crab.alive).toBe(false);
    expect(crab.scores).toBe(ENEMY_SCORES.SPINEY);
  });
});

describe('G-021: Fly', () => {
  it('waits on the ground, then hops towards the player, and stands still once it lands', () => {
    const w = classicWorld(MARIO);
    stand(w, 2);
    const fly = at(w, new Fly(0, 0), 12);
    let minY = fly.body.y;
    let jumped = false;
    const vxs: number[] = [];
    let landedStill = false;
    for (let i = 0; i < 80; i++) {
      step(w);
      minY = Math.min(minY, fly.body.y);
      if (fly.body.vy < 0) jumped = true;
      if (!fly.body.onGround) vxs.push(fly.body.vx);
      else if (jumped && fly.body.vx === 0) landedStill = true;
    }
    expect(jumped).toBe(true);
    expect(minY).toBeLessThan(px(12 * 16 + 2 - 16));
    expect(vxs.some((v) => v < 0)).toBe(true); // towards the player, on the left
    expect(landedStill).toBe(true);
    // Falling below where it took off, the sideways speed dies away (FRICTION_X 0.1 a second).
    expect(Fly.AIR_FRICTION).toBeCloseTo(Math.pow(0.1, 1 / 60), 10);
    expect(fly.scores).toBe(SPECIAL_SCORES.FLY);
  });
});

describe('G-021: Barrel', () => {
  it('is armoured: Classic weapons without pierce bounce off; a bumped block pops it', () => {
    const w = classicWorld(classicStub(LINK));
    const b = at(w, new Barrel(0, 0), 20);
    expect(isArmoured(b)).toBe(true);
    expect(b.hit(weapon(w, 'sword', 1000), w)).toBe('blocked');
    expect(b.hit(weapon(w, 'sword', 1000, { pierce: 5 }), w)).toBe('kill');
    const c = at(w, new Barrel(0, 0), 24);
    expect(c.hit({ kind: 'bump', amount: 1, owner: null, dirX: 1 }, w)).toBe('bounce');
    expect(c.alive).toBe(true);
    expect(c.scores).toBe(SPECIAL_SCORES.BARREL);
  });

  it('rolls: four frames', () => {
    const w = classicWorld(MARIO);
    const b = at(w, new Barrel(0, 0), 20);
    const frames = new Set<string>();
    for (let i = 0; i < 20; i++) {
      step(w);
      frames.add(b.currentFrame);
    }
    expect(frames.size).toBe(4);
  });
});

describe('G-021: FireEnemy', () => {
  it('only pierce 11 gets through (Classic); only a Star (or the Hammer) under Current', () => {
    const w = classicWorld(classicStub(LINK));
    const f = at(w, new FireEnemy(0, 0), 20);
    expect(armourOf(f)).toBe(FireEnemy.ARMOUR);
    expect(f.hit(weapon(w, 'sword', 1000, { pierce: 6 }), w)).toBe('blocked');
    expect(f.hit(weapon(w, 'sword', 1000, { pierce: 11 }), w)).toBe('kill');
    const cur = classicWorld(MARIO, testLevel(), 'current');
    const g = at(cur, new FireEnemy(0, 0), 20);
    expect(g.hit({ kind: 'fireball', amount: 1, owner: cur.player, dirX: 1 }, cur)).toBe('immune');
    expect(g.hit({ kind: 'star', amount: 1, owner: null, dirX: 1 }, cur)).toBe('kill');
  });

  it('every 250 ms it walks left, walks right or stands, at random', () => {
    const w = classicWorld(MARIO);
    stand(w, 2);
    const f = at(w, new FireEnemy(0, 0), 20);
    const seen = new Set<number>();
    for (let i = 0; i < 600; i++) {
      step(w);
      if (i % FireEnemy.TURN_FRAMES === 1) seen.add(Math.sign(f.body.vx));
    }
    expect([...seen].sort()).toEqual([-1, 0, 1]);
  });
});

/** A `?`-style item `item` out of its block at column `col` (taken by walking into it). */
function item(w: World, kind: 'atom' | 'hammer' | 'wing', col: number): PowerUp {
  const p = new PowerUp(col, 12, kind);
  w.spawn(p);
  for (let i = 0; i < 40; i++) p.update(w);
  return p;
}

describe('G-022: the items', () => {
  it('stay on their block once out and are worth 1000 points, read out as taken', () => {
    const w = classicWorld(MARIO);
    const p = item(w, 'atom', 2);
    expect(p.out).toBe(true);
    const y = p.body.y;
    step(w, 10);
    expect(p.body.y === y || !p.alive).toBe(true);
    const score = w.state.score;
    p.body.x = w.player.body.x;
    p.body.y = w.player.body.y;
    step(w);
    expect(p.alive).toBe(false);
    expect(w.state.score - score).toBeGreaterThanOrEqual(1000);
    expect(w.events.some((e) => e.type === 'say' && e.text === SPECIAL_ITEM_SAID.atom)).toBe(true);
    // Ability-named, no button letters.
    for (const t of Object.values(SPECIAL_ITEM_SAID))
      expect(t).not.toMatch(/\b(press|push)\b|button [abxy]\b/i);
  });

  it('a block holding one (a `block-item`) lets it out when bumped', () => {
    const level = testLevel({ 9: '..........?' });
    level.entities.push({ type: 'block-item', x: 10, y: 9, props: { item: 'wing' } });
    const w = classicWorld(MARIO, level);
    w.player.body.x = px(10 * 16 + 2);
    w.player.body.y = px(10 * 16);
    w.player.body.vy = -0x04000;
    for (let i = 0; i < 20; i++) step(w);
    expect(w.entities.some((e) => e instanceof PowerUp && e.item === 'wing')).toBe(true);
  });

  it('Atom: every enemy on screen is defeated, scoring as a Star kill; one off screen stays', () => {
    const w = classicWorld(MARIO);
    stand(w, 2);
    const on = [at(w, new Goomba(0, 0), 10), at(w, new Crab(0, 0), 12), at(w, new FireEnemy(0, 0), 14)];
    const off = at(w, new Goomba(0, 0), 40);
    const p = item(w, 'atom', 5);
    p.body.x = w.player.body.x;
    p.body.y = w.player.body.y;
    step(w);
    for (const e of on) expect(e.alive).toBe(false);
    expect(off.alive).toBe(true);
  });

  it('Hammer: swings over and in front of the hero for ten seconds, defeating what it touches', () => {
    const w = classicWorld(MARIO);
    stand(w, 2);
    const p = item(w, 'hammer', 3);
    p.body.x = w.player.body.x;
    p.body.y = w.player.body.y;
    step(w);
    const h = w.entities.find((e): e is HammerWeapon => e instanceof HammerWeapon);
    expect(h).toBeDefined();
    const places = new Set<boolean>();
    for (let i = 0; i < 12; i++) {
      step(w);
      places.add((h as HammerWeapon).overhead);
    }
    expect(places.size).toBe(2);
    // Anything it touches goes, the Flame too.
    const f = at(w, new FireEnemy(0, 0), 3);
    f.walkSpeed = 0;
    f.body.vx = 0;
    // Just out of the hero's reach: only the forward swing touches it.
    f.body.x = w.player.body.x + w.player.body.w + px(4);
    w.player.facing = 1;
    step(w, 12);
    expect(f.alive).toBe(false);
    step(w, HAMMER_FRAMES);
    expect(h?.alive).toBe(false);
  });

  it('Wing: the area swims for ten seconds, then dries (a water area keeps its own water)', () => {
    const w = classicWorld(MARIO);
    expect(w.waterTop).toBe(Infinity);
    const p = item(w, 'wing', 3);
    p.body.x = w.player.body.x;
    p.body.y = w.player.body.y;
    step(w);
    // The swimming line two tiles below the top, as in the original's water levels.
    expect(w.waterTop).toBe(WATER_MODE_TOP);
    expect(w.wingFrames).toBe(WING_FRAMES - 1);
    step(w, 30);
    expect(w.player.inWater).toBe(true);
    step(w, WING_FRAMES);
    expect(w.waterTop).toBe(Infinity);
  });

  it('Reduce flashing: the hammer is drawn steady in both its places; the Atom and Wing hold still', () => {
    const w = classicWorld(MARIO);
    const h = new HammerWeapon(w.player);
    const frames = (reduceFlashing: boolean, e: { render(r: Renderer, v: View): void }, frame = 0) => {
      const out: string[] = [];
      const r = { sprite: (_s: unknown, f: string) => void out.push(f) } as unknown as Renderer;
      const view = { assets: { sheet: () => ({}) }, camX: 0, reduceFlashing, frame } as unknown as View;
      e.render(r, view);
      return out;
    };
    expect(frames(false, h)).toHaveLength(1);
    expect(frames(true, h).sort()).toEqual(['hammer-side', 'hammer-up']);
    const atom = new PowerUp(3, 12, 'atom');
    expect(new Set([0, 4, 8, 12].map((f) => frames(false, atom, f)[0])).size).toBe(2);
    expect(new Set([0, 4, 8, 12].map((f) => frames(true, atom, f)[0])).size).toBe(1);
  });

  it('Wing: the hero cannot swim off the top of the screen (exitWater two tiles below it)', () => {
    let minY = Infinity;
    runSim({
      level: testLevel(),
      character: MARIO,
      rules: 'classic',
      script: { steps: [] },
      maxFrames: 400,
      // Stroke after stroke: JUMP pressed every 8 frames.
      controller: (_w, f) => (f % 8 < 4 ? ['jump'] : []),
      until: (w, f) => {
        if (f === 0) w.wingSwim(WING_FRAMES);
        minY = Math.min(minY, w.player.body.y);
        return false;
      },
    });
    expect(minY).toBeLessThan(px(12 * 16)); // it swam up
    expect(minY).toBeGreaterThan(-px(16)); // but never off the top
  });

  it('the full power-up (fullyPowerup): small Mario and small Samus get their top power at once', () => {
    for (const def of [MARIO, SAMUS]) {
      const w = classicWorld(heroFor(def, 'classic'));
      const p = w.player;
      expect(p.powerState, def.id).toBe('small');
      const it = new PowerUp(2, 12, 'rabbit');
      w.spawn(it);
      for (let i = 0; i < 40; i++) it.update(w);
      it.body.x = p.body.x;
      it.body.y = p.body.y;
      step(w);
      expect(it.alive).toBe(false);
      expect(p.powerState, def.id).toBe('fire');
      expect(w.events.some((e) => e.type === 'say' && e.text === SPECIAL_ITEM_SAID.rabbit)).toBe(true);
    }
  });

  it('the full power-up gives only the missing steps: small two, big one, Fire Flower none (no repeat bonus)', () => {
    for (const [state, calls] of [
      ['small', 2],
      ['big', 1],
      ['fire', 0],
    ] as const) {
      const w = classicWorld(heroFor(MARIO, 'classic'));
      const p = w.player;
      p.powerState = state;
      const seen: string[] = [];
      const own = p.def.behaviour.onPowerUp.bind(p.def.behaviour);
      p.def = {
        ...p.def,
        behaviour: { ...p.def.behaviour, onPowerUp: (q, k, ww) => (seen.push(k), own(q, k, ww)) },
      };
      const score = w.state.score;
      fullPowerUp(w, p);
      expect(seen, state).toHaveLength(calls);
      expect(p.powerState, state).toBe('fire');
      // The steps' own points are not scored (the item's 1000 are, by takeSpecialItem).
      expect(w.state.score, state).toBe(score);
    }
  });

  it('the full power-up fills every ammo to its maximum (setAllAmmoToMax), on the real hero', () => {
    for (const def of [LINK, SAMUS, SIMON, RYU, SOPHIA]) {
      const w = classicWorld(heroFor(def, 'classic'));
      const p = w.player;
      fullPowerUp(w, p);
      const counters = () =>
        Object.fromEntries(Object.entries(p.scratch).filter(([, v]) => typeof v === 'number')) as Record<string, number>;
      const after = counters();
      // Another of every ammo pickup adds nothing: each counter is at its maximum.
      for (const kind of AMMO_PICKUPS) p.def.behaviour.onPickup?.(p, kind, w);
      expect(counters(), def.id).toEqual(after);
      expect(Object.values(after).some((v) => v > 0), def.id).toBe(true);
    }
  });
});
