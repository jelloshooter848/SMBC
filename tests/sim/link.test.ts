import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { BOOMERANG, LINK, JUMP_SPELL, MAX_MAGIC } from '@game/characters/link';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import { Pickup } from '@game/entities/objects/pickup';
import { PowerUp } from '@game/entities/objects/powerup';
import { Bomb } from '@game/entities/objects/bomb';
import { Projectile, BOWSER_FLAME } from '@game/entities/projectiles/projectile';
import { T } from '@game/level/tiles';
import { Rng } from '@engine/rng';
import type { World } from '@game/world/world';
import type { Action } from '@engine/input/actions';

/** A flat 48-wide field; `rows` patches individual rows (0 = top, 12 = the row above the floor). */
function field(rows: Record<number, string> = {}, startX = 2) {
  const base = Array.from({ length: 13 }, () => '.'.repeat(48));
  for (const [y, row] of Object.entries(rows)) base[Number(y)] = row;
  return parseTextMap(
    [
      'id: t',
      'time: 300',
      `start: ${startX},12`,
      '',
      '[tiles]',
      ...base,
      '#'.repeat(48),
      '#'.repeat(48),
    ].join('\n'),
  );
}
const at = (col: number, ch: string, width = 48) =>
  '.'.repeat(col) + ch + '.'.repeat(width - col - ch.length);

type Ctl = (w: World, f: number) => Action[];

function enemyAhead(w: World): number {
  let best = Infinity;
  for (const e of w.entities) {
    if (!(e instanceof Goomba || e instanceof Koopa) || !e.alive) continue;
    const dx = (e.body.x - (w.player.body.x + w.player.body.w)) / 256;
    if (dx > -8 && dx < best) best = dx;
  }
  return best;
}

function run(
  level: ReturnType<typeof field>,
  controller: Ctl,
  frames: number,
  kit: Record<string, number> = {},
  hp = 6,
) {
  return runSim({
    level,
    character: LINK,
    script: { steps: [] },
    maxFrames: frames,
    controller,
    state: { kit, hp },
  });
}

describe("Link's kit", () => {
  it('the boomerang stuns a goomba, which is harmless to touch and dies to the sword', () => {
    let thrown = false;
    const r = run(
      field({ 12: at(16, 'g') }),
      (w) => {
        const g = w.entities.find((e): e is Goomba => e instanceof Goomba);
        if (!g) return ['right'];
        const d = enemyAhead(w);
        if (!thrown) {
          if (d > 80) return ['right'];
          thrown = true;
          return ['special']; // boomerang is the first tool
        }
        if (g.stunned === 0) return [];
        if (d < 10) return w.player.attackTimer === 0 ? ['attack'] : [];
        return ['right'];
      },
      600,
    );
    expect(r.score).toBeGreaterThanOrEqual(100);
    expect(r.world.player.hp).toBe(6);
    expect(r.world.entities.some((e) => e instanceof Goomba && e.alive)).toBe(false);
  });

  it('a bomb kills a goomba, breaks a brick and hurts Link too', () => {
    const r = run(
      field({ 12: at(7, '=').slice(0, 13) + 'g' + '.'.repeat(34) }, 8),
      (_w, f) => (f === 5 ? ['special'] : []),
      240,
      { bombs: 2, tool: 1 },
    );
    expect(r.world.player.scratch.bombs).toBe(1);
    expect(r.world.map.get(7, 12)).toBe(T.AIR); // the brick behind him is gone
    expect(r.score).toBeGreaterThanOrEqual(100 + 50); // goomba + brick
    expect(r.world.player.hp).toBe(5); // standing next to your own bomb hurts
    expect(r.world.entities.some((e) => e instanceof Bomb && e.alive)).toBe(false);
  });

  it('the raised shield destroys a flame coming from the front', () => {
    const flameFrom = (held: Action[]) =>
      run(
        field(),
        (w, f) => {
          if (f === 1) {
            const b = w.player.body;
            w.spawn(new Projectile(b.x + 100 * 256, b.y + 8 * 256, -1, BOWSER_FLAME, null));
          }
          return held;
        },
        150,
      );
    const blocked = flameFrom([]);
    expect(blocked.world.player.hp).toBe(6);
    expect(blocked.world.entities.some((e) => e instanceof Projectile && e.alive)).toBe(false);
    const crouched = flameFrom(['down']); // shield down: the flame lands
    expect(crouched.world.player.hp).toBe(5);
  });

  it('the up-thrust hits an enemy above the head', () => {
    let swung = false;
    let above = Infinity;
    const r = run(
      field(),
      (w, f) => {
        const b = w.player.body;
        if (w.player.activeMelee) above = Math.min(above, w.player.activeMelee.y - b.y);
        if (f < 2) return [];
        if (b.onGround && f < 5) return ['jump'];
        if (!b.onGround && b.vy < 0 && !swung) {
          swung = true;
          w.spawn(new Goomba(b.x, b.y - 34 * 256)); // falls onto the raised sword
          return ['jump', 'up', 'attack'];
        }
        return b.onGround ? [] : ['jump', 'up'];
      },
      120,
    );
    expect(swung).toBe(true);
    expect(above).toBeLessThan(0); // the sword box sat above the head
    expect(r.score).toBeGreaterThanOrEqual(100);
    expect(r.world.player.hp).toBe(6);
  });

  it('only the up-thrust (not the head) opens bricks and item blocks overhead', () => {
    // A brick two tiles above the head; jump under it with or without holding up.
    const under = (held: Action[], row: string) =>
      run(field({ 9: at(2, row) }), (_w, f) => (f >= 2 && f < 20 ? ['jump', ...held] : held), 60);
    const bumped = under([], '=');
    expect(bumped.world.map.get(2, 9)).not.toBe(T.AIR); // head bump leaves the brick
    const cut = under(['up'], '=');
    expect(cut.world.map.get(2, 9)).toBe(T.AIR); // the sword shatters it
    expect(cut.score).toBeGreaterThanOrEqual(50);
    const coin = under(['up'], '?');
    expect(coin.coins).toBe(1);
  });

  it('the Jump spell costs 8 magic and raises the jump', () => {
    const apex = (kit: Record<string, number>) => {
      let min = Infinity;
      const r = run(
        field(),
        (w, f) => {
          min = Math.min(min, w.player.body.y);
          if (f === 2) return ['special'];
          if (f >= 10 && f < 14) return ['jump'];
          return [];
        },
        120,
        kit,
      );
      return { height: (13 * 16 - 24) * 256 - min, magic: r.world.player.scratch.magic ?? MAX_MAGIC };
    };
    const plain = apex({});
    const spell = apex({ tool: 2 });
    expect(spell.magic).toBe(MAX_MAGIC - JUMP_SPELL.cost);
    expect(plain.magic).toBe(MAX_MAGIC); // the boomerang tool spends nothing
    expect(spell.height).toBeGreaterThan(plain.height * 1.3);
  });

  it('the white tunic makes every other hit glance off', () => {
    // A bot that keeps walking into the goomba gets hit again each time invulnerability ends.
    const walkInto = (kit: Record<string, number>) => {
      let hits = 0;
      let wasStunned = false;
      const r = run(
        field({ 12: at(14, 'g') }),
        (w) => {
          const stunned = w.player.stun > 0; // every hit knocks him back
          if (stunned && !wasStunned) hits++;
          wasStunned = stunned;
          return ['right'];
        },
        400,
        kit,
      );
      return { hits, hp: r.world.player.hp };
    };
    const plain = walkInto({});
    expect(plain.hits).toBeGreaterThanOrEqual(2);
    expect(plain.hp).toBe(6 - plain.hits);
    const tunic = walkInto({ tunic: 1 });
    expect(tunic.hits).toBeGreaterThanOrEqual(2);
    expect(tunic.hp).toBe(6 - Math.floor(tunic.hits / 2));
  });

  it('drops include bombs, magic and hearts, and a bomb pickup raises the ammo', () => {
    const seen = new Set<string>();
    const goomba = new Goomba(0, 0);
    for (let seed = 1; seed < 200; seed++) seen.add(String(LINK.drop?.(new Rng(seed), goomba)));
    expect(seen).toEqual(new Set(['bomb', 'magic-small', 'heart-small', 'null']));

    const r = run(
      field(),
      (w, f) => {
        if (f === 1) {
          const b = w.player.body;
          w.spawn(new Pickup(b.x + 40 * 256, b.y + b.h, 'bomb'));
          w.spawn(new Pickup(b.x + 60 * 256, b.y + b.h, 'magic-small'));
        }
        return ['right'];
      },
      120,
      { magic: 10 },
    );
    expect(r.world.player.scratch.bombs).toBe(1);
    expect(r.world.player.scratch.magic).toBe(18);
    expect(r.world.entities.some((e) => e instanceof Pickup && e.alive)).toBe(false);
  });
});

describe("Link's sword and blocks (0.4.22, owner notes 26-27)", () => {
  /** Link at col 2 swings once (frame 2) at row 12, facing right, a block at col 3. */
  const swing = (row: string, frames = 40, times = 1) =>
    run(
      field({ 12: at(3, row) }),
      (_w, f) => (f >= 2 && f < 2 + 2 * times && f % 2 === 0 ? ['attack'] : []),
      frames,
    );

  it('a sword swing breaks a brick it hits', () => {
    const r = swing('=');
    expect(r.world.map.get(3, 12)).toBe(T.AIR);
    expect(r.score).toBeGreaterThanOrEqual(50);
  });

  it('a sword swing bumps a ? block it hits (its coin), and a used block stays', () => {
    const r = swing('?');
    expect(r.coins).toBe(1);
    expect(r.world.map.get(3, 12)).toBe(T.USED);
  });

  it('one strike per tile per swing: a ten-coin brick gives one coin a swing', () => {
    const one = swing('C', 30);
    expect(one.coins).toBe(1);
    // A second swing strikes it again.
    const two = run(field({ 12: at(3, 'C') }), (_w, f) => (f === 2 || f === 30 ? ['attack'] : []), 60);
    expect(two.coins).toBe(2);
  });

  it('the down-thrust breaks a brick it lands on (and Link bounces off it), and opens a ? block', () => {
    const drop = (row: string) => {
      let bounced = false;
      let struck = false;
      const r = run(
        field({ 9: at(2, row) }),
        (w, f) => {
          const b = w.player.body;
          if (f === 1) {
            // Mid-air over the block (col 2, row 9), falling.
            b.y = (9 * 16 - 24 - 40) * 256;
            b.vy = 0x01000;
            b.onGround = false;
          }
          if (w.map.get(2, 9) !== (row === '=' ? T.BRICK : T.Q_COIN)) struck = true;
          if (struck && b.vy < 0) bounced = true;
          return f >= 1 ? ['down'] : [];
        },
        90,
      );
      return { r, bounced };
    };
    const brick = drop('=');
    expect(brick.r.world.map.get(2, 9)).toBe(T.AIR);
    expect(brick.bounced).toBe(true);
    const q = drop('?');
    expect(q.r.coins).toBe(1);
    expect(q.bounced).toBe(true);
  });

  it('an up-thrust that breaks a brick rebounds Link down, as a head bump does, instead of rising through', () => {
    let top = Infinity;
    const r = run(
      field({ 9: at(2, '=') }),
      (w, f) => {
        top = Math.min(top, w.player.body.y);
        return f >= 2 && f < 20 ? ['jump', 'up'] : ['up'];
      },
      60,
    );
    expect(r.world.map.get(2, 9)).toBe(T.AIR);
    // He never got past the brick's row: his head stayed below row 9's top.
    expect(top).toBeGreaterThanOrEqual(9 * 16 * 256);
  });
});

describe("Link's boomerang fetches (0.4.22, owner note 27)", () => {
  it('brings back a coin, a mushroom and a drop it touches; Link gets them when it returns', () => {
    let atTouch: { coins: number; bombs: number } | null = null;
    const r = run(
      field({ 12: at(6, '$') }),
      (w, f) => {
        const b = w.player.body;
        if (f === 1) {
          const m = PowerUp.hopOut(b.x + 80 * 256, b.y + b.h, 'mushroom');
          m.body.vx = 0;
          m.body.vy = 0;
          w.spawn(m);
          w.spawn(new Pickup(b.x + 50 * 256, b.y + b.h, 'bomb'));
        }
        if (f === 3) return ['special']; // the boomerang (the first tool)
        // The moment the coin tile is gone (taken by the boomerang), Link has nothing yet.
        if (!atTouch && f > 3 && w.map.get(6, 12) === T.AIR)
          atTouch = { coins: w.state.coins, bombs: w.player.scratch.bombs ?? 0 };
        return [];
      },
      150,
      {},
      4,
    );
    expect(atTouch).toEqual({ coins: 0, bombs: 0 });
    expect(r.coins).toBe(1);
    expect(r.world.player.scratch.bombs).toBe(1);
    expect(r.world.player.scratch.maxHp).toBe(8); // the mushroom's heart container
    expect(r.world.entities.some((e) => (e instanceof PowerUp || e instanceof Pickup) && e.alive)).toBe(
      false,
    );
  });

  it('leaves a poison mushroom and an item still rising out of its block; takes a star and a 1-up', () => {
    let checked = false;
    run(
      field(),
      (w, f) => {
        if (f !== 1) return [];
        const b = w.player.body;
        const x = b.x + 64 * 256;
        const feet = b.y + b.h;
        const out = (['poison', 'star', '1up'] as const).map((k) => {
          const m = PowerUp.hopOut(x, feet, k);
          m.body.vx = 0;
          m.body.vy = 0;
          w.spawn(m);
          return m;
        });
        const rising = new PowerUp(x >> 12, 12, 'mushroom');
        w.spawn(rising);
        // A boomerang over all of them.
        const boom = new Projectile(x, feet - 32 * 256, 1, BOOMERANG, w.player);
        Object.assign(boom.body, { x: x - 24 * 256, y: feet - 40 * 256, w: 48 * 256, h: 48 * 256 });
        w.boomerangFetch(boom);
        expect(boom.carried).toEqual([out[1], out[2]]);
        expect(out[0]?.alive).toBe(true);
        expect(rising.alive).toBe(true);
        const lives = w.state.lives;
        w.deliverFetch(boom);
        expect(w.player.star).toBeGreaterThan(0);
        expect(w.state.lives).toBe(lives + 1);
        expect(boom.carried).toEqual([]);
        // Delivered once: a second delivery gives nothing more.
        w.deliverFetch(boom);
        expect(w.state.lives).toBe(lives + 1);
        checked = true;
        return [];
      },
      4,
    );
    expect(checked).toBe(true);
  });

  it('a down-thrust bounce off a ? block strikes it once: held down, Link lands on the used block', () => {
    let bounces = 0;
    let wasUp = false;
    const r = run(
      field({ 9: at(2, '?') }),
      (w, f) => {
        const b = w.player.body;
        if (f === 1) {
          b.y = (9 * 16 - 24 - 40) * 256;
          b.vy = 0x01000;
          b.onGround = false;
        }
        const up = b.vy < 0;
        if (up && !wasUp) bounces++;
        wasUp = up;
        return f >= 1 ? ['down'] : [];
      },
      240,
    );
    expect(r.coins).toBe(1);
    expect(r.world.map.get(2, 9)).toBe(T.USED);
    expect(bounces).toBe(1);
    expect(r.world.player.body.onGround).toBe(true);
  });
});
