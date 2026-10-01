import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { MEGAMAN } from '@game/characters/megaman';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import { Projectile } from '@game/entities/projectiles/projectile';
import type { CharacterDef } from '@game/characters/character';
import type { World } from '@game/world/world';
import type { Action } from '@engine/input/actions';

/** A flat 48-wide field with one goomba at column 12 and a koopa at column 30. */
function field(
  enemies = '............g.................k.................',
): ReturnType<typeof parseTextMap> {
  const rows = Array.from({ length: 13 }, () => '.'.repeat(48));
  rows[12] = enemies;
  return parseTextMap(
    ['id: t', 'time: 300', 'start: 2,12', '', '[tiles]', ...rows, '#'.repeat(48), '#'.repeat(48)].join('\n'),
  );
}

type Ctl = (frame: number, w: World) => Action[];
const walkRight: Ctl = () => ['right'];

function run(character: CharacterDef, controller: Ctl, frames = 600, state = {}, level = field()) {
  return runSim({
    level,
    character,
    script: { steps: [] },
    maxFrames: frames,
    controller: (w, f) => controller(f, w),
    state,
  });
}

/** Pixels from the player's right edge to the nearest live enemy ahead (Infinity if none). */
function enemyAhead(w: World): number {
  let best = Infinity;
  for (const e of w.entities) {
    if (!(e instanceof Goomba || e instanceof Koopa) || !e.alive) continue;
    const dx = (e.body.x - (w.player.body.x + w.player.body.w)) / 256;
    if (dx > -8 && dx < best) best = dx;
  }
  return best;
}

/**
 * Walk up, stop, and jump straight up so the approaching enemy walks under the landing.
 * The distance window depends on the character's air time.
 */
const hopOnto =
  (lo: number, hi: number): Ctl =>
  (_f, w) => {
    const d = enemyAhead(w);
    const b = w.player.body;
    if (!b.onGround) return ['jump']; // hold for the full arc
    if (d > 64) return ['right'];
    if (b.vx === 0 && d < hi && d > lo) return ['jump'];
    return [];
  };

describe('cross-character rules', () => {
  it('Mario stomps a goomba when falling onto it', () => {
    const r = run(MARIO, hopOnto(14, 22), 300);
    expect(r.outcome).not.toBe('died');
    expect(r.score).toBeGreaterThanOrEqual(100);
    const live = r.world.entities.filter(
      (e): e is Goomba => e instanceof Goomba && e.alive && e.contactHurts,
    );
    expect(live).toHaveLength(0);
  });

  it('Link cannot stomp: landing on the goomba costs a heart', () => {
    const r = run(LINK, hopOnto(24, 32), 300, { hp: 6 });
    expect(r.world.player.hp).toBeLessThan(6);
    expect(r.outcome).not.toBe('died');
  });

  it("Link's sword kills the goomba for 100 points without taking damage", () => {
    const r = run(
      LINK,
      (_f, w) => {
        const d = enemyAhead(w);
        if (d < 26) return w.player.attackTimer === 0 ? ['attack'] : [];
        return ['right'];
      },
      400,
      { hp: 6 },
    );
    expect(r.score).toBeGreaterThanOrEqual(100);
    expect(r.world.player.hp).toBe(6);
  });

  it('Link dies when his last half-heart goes', () => {
    const r = run(LINK, walkRight, 2000, { hp: 1 });
    expect(r.outcome).toBe('died');
  });

  it('Mega Man shoots the goomba with the buster', () => {
    const r = run(MEGAMAN, (f) => (f > 10 && f % 15 === 0 ? ['attack'] : []), 300, { hp: 28 });
    expect(r.score).toBeGreaterThanOrEqual(100);
    expect(r.world.player.hp).toBe(28);
  });

  it('Mega Man is limited to three buster shots on screen', () => {
    const r = run(MEGAMAN, (f) => (f % 2 === 0 ? ['attack'] : []), 8, { hp: 28 }, field('.'.repeat(48)));
    expect(r.world.entities.filter((e) => e instanceof Projectile).length).toBeLessThanOrEqual(3);
  });

  it('Mega Man takes 4 damage from contact and survives', () => {
    const r = run(MEGAMAN, walkRight, 150, { hp: 28 });
    expect(r.world.player.hp).toBe(24);
    expect(r.outcome).not.toBe('died');
  });

  it("Mario's fireball kills the goomba", () => {
    const r = run(MARIO, (f) => (f > 10 && f % 30 === 0 ? ['attack'] : []), 300, { powerState: 'fire' });
    expect(r.score).toBeGreaterThanOrEqual(100);
  });

  it('a stomped koopa becomes a shell that a kick sends flying', () => {
    const r = runSim({
      level: field('..............................k.................'),
      character: MARIO,
      script: { steps: [] },
      maxFrames: 900,
      controller: (w, f) => {
        const k = w.entities.find((e): e is Koopa => e instanceof Koopa);
        if (!k) return ['right'];
        const dx = (k.body.x - (w.player.body.x + w.player.body.w)) / 256;
        if (k.state === 'walk') return hopOnto(14, 22)(f, w);
        if (k.state === 'shell') return dx > 0 ? ['right'] : ['left'];
        return [];
      },
      until: (w) => w.entities.some((e) => e instanceof Koopa && (e as Koopa).isMovingShell),
    });
    expect(r.outcome).toBe('stopped');
  });
});
