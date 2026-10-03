import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { LINK, JUMP_SPELL, MAX_MAGIC } from '@game/characters/link';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import { Pickup } from '@game/entities/objects/pickup';
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
