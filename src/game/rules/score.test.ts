import { describe, expect, it } from 'vitest';
import { Blooper } from '../entities/enemies/blooper';
import { Bowser } from '../entities/enemies/bowser';
import { BulletBill } from '../entities/enemies/bullet-bill';
import { Cheep } from '../entities/enemies/cheep';
import type { Enemy } from '../entities/enemies/enemy';
import { Goomba } from '../entities/enemies/goomba';
import { HammerBro } from '../entities/enemies/hammer-bro';
import { Koopa } from '../entities/enemies/koopa';
import { Lakitu } from '../entities/enemies/lakitu';
import { Piranha } from '../entities/enemies/piranha';
import { Spiny } from '../entities/enemies/spiny';
import { Flagpole } from '../entities/objects/flagpole';
import type { DamageKind } from './damage';
import { shellKickSeqScore, stompScore } from './score';

// Expected values copied from the original's com/smbc/data/ScoreValue.as.
// Columns: STOMP, ATTACK, STAR, BELOW.
const TABLE: [string, () => Enemy, [number, number, number, number]][] = [
  ['Goomba (GOOMBA_*)', () => new Goomba(0, 0), [100, 100, 100, 100]],
  ['Koopa (KOOPA_*)', () => new Koopa(0, 0, 'green'), [100, 200, 200, 100]],
  ['red Koopa (KOOPA_*)', () => new Koopa(0, 0, 'red'), [100, 200, 200, 100]],
  ['Paratroopa (KOOPA_FLYING_*)', () => new Koopa(0, 0, 'green', true), [400, 200, 200, 100]],
  ['red Paratroopa (KOOPA_FLYING_*)', () => new Koopa(0, 0, 'red', true), [400, 200, 200, 100]],
  ['Buzzy Beetle (BEETLE_*)', () => new Koopa(0, 0, 'buzzy'), [100, 100, 200, 100]],
  ['Piranha (PIRANHA_*)', () => new Piranha(0, 0), [100, 200, 200, 100]],
  ['Cheep (CHEEP_*)', () => new Cheep(0, 0, 'red'), [200, 200, 200, 100]],
  ['flying Cheep (CHEEP_*)', () => new Cheep(0, 0, 'red', true), [200, 200, 200, 100]],
  ['Blooper (BLOOPA_*)', () => new Blooper(0, 0), [1000, 200, 200, 100]],
  ['Lakitu (LAKITU_*)', () => new Lakitu(0, 0), [800, 200, 200, 100]],
  ['Spiny (SPINEY_*)', () => new Spiny(0, 0, false), [100, 200, 200, 100]],
  ['Bullet Bill (BULLET_BILL_*)', () => new BulletBill(0, 0, -1), [200, 200, 200, 200]],
  ['Hammer Bro (HAMMER_BRO_*)', () => new HammerBro(0, 0), [1000, 1000, 1000, 1000]],
  ['Bowser (BOWSER_*)', () => new Bowser(0, 0), [5000, 5000, 5000, 5000]],
];

/** Every way to die that isn't a stomp, star or bump scores the ATTACK value (Enemy.takeDamage). */
const ATTACKS: DamageKind[] = ['fireball', 'sword', 'buster', 'bomb', 'weapon', 'axe', 'contact'];

describe('kill scores per enemy and kill kind (ScoreValue.as)', () => {
  for (const [name, make, [stomp, attack, star, below]] of TABLE) {
    it(name, () => {
      const e = make();
      expect(e.scoreFor('stomp')).toBe(stomp);
      expect(e.scoreFor('star')).toBe(star);
      expect(e.scoreFor('bump')).toBe(below);
      for (const k of ATTACKS) expect(e.scoreFor(k), k).toBe(attack);
    });
  }

  it('a paratroopa keeps the flying values once its wings are gone (set once at spawn)', () => {
    const k = new Koopa(0, 0, 'green', true);
    k.wings = false;
    expect(k.scoreFor('stomp')).toBe(400);
  });
});

describe('stomp sequence (Enemy.stomp, STOMP_SEQ_*)', () => {
  it('climbs 100..8000 and then gives a life, never below the enemy value', () => {
    const seq = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => stompScore(n, 100));
    expect(seq).toEqual([100, 200, 400, 500, 800, 1000, 2000, 4000, 5000, 8000]);
    expect(stompScore(11, 100)).toBe('1up');
    expect(stompScore(30, 5000)).toBe('1up');
    expect(stompScore(1, 1000)).toBe(1000); // Hammer Bro
    expect(stompScore(1, 400)).toBe(400); // Paratroopa
    expect(stompScore(4, 400)).toBe(500);
    expect(stompScore(0, 200)).toBe(200); // a Bullet Bill before any counted stomp
  });

  it('a double stomp is worth at least DOUBLE_STOMP (400)', () => {
    expect(stompScore(2, 100, true)).toBe(400);
    expect(stompScore(5, 100, true)).toBe(800);
    expect(stompScore(11, 100, true)).toBe('1up');
  });
});

describe('shell-kick sequence (KoopaGreen.hitEnemy, SHELL_KICK_SEQ_*)', () => {
  it('climbs 500..8000 and then gives a life', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(shellKickSeqScore)).toEqual([500, 800, 1000, 2000, 4000, 5000, 8000]);
    expect(shellKickSeqScore(8)).toBe('1up');
  });
});

describe('flagpole grab bands (FlagPole.touchPlayer)', () => {
  // A standard pole: ball at row 2, base block at row 12 (top at y = 192). The original's pole is
  // TILE_SIZE * 9.3 tall, so its height here is 148.8 px and a band starts at 192 - 148.8 * perc.
  const pole = new Flagpole(10, 2, 12);
  it.each([
    [192 - 148.8 * 0.9, 5000],
    [192 - 148.8 * 0.9 + 0.5, 2000],
    [192 - 148.8 * 0.65, 2000],
    [192 - 148.8 * 0.65 + 0.5, 800],
    [192 - 148.8 * 0.4, 800],
    [192 - 148.8 * 0.4 + 0.5, 400],
    [192 - 148.8 * 0.2, 400],
    [192 - 148.8 * 0.2 + 0.5, 100],
    [40, 5000],
    [190, 100],
  ])('middle at y=%f scores %i', (midY, points) => {
    expect(pole.scoreForGrab(midY)).toBe(points);
  });
});
