import { describe, expect, it } from 'vitest';
import { px, toPx, velToPxf } from '@engine/math/units';
import { Player } from './player';
import { MARIO_PROFILE } from '../characters/mario/profile';
import { TileMap } from '../world/tilemap';
import { parseTextMap } from '../level/textmap';
import type { Action } from '@engine/input/actions';
import type { InputFrame } from '@engine/input/input-manager';

/** Flat 64-wide floor with a wall at column 40 and a ceiling block at (10, 8). */
function flatMap(): TileMap {
  const rows = Array.from({ length: 13 }, () => '.'.repeat(64));
  rows[8] = '.'.repeat(10) + '=' + '.'.repeat(53);
  for (let y = 9; y < 13; y++) rows[y] = '.'.repeat(40) + '#' + '.'.repeat(23);
  const src = ['id: t', '', '[tiles]', ...rows, '#'.repeat(64), '#'.repeat(64)].join('\n');
  return new TileMap(parseTextMap(src));
}

function fakeInput(held: Set<Action>, pressedJump = false): InputFrame {
  return {
    held: (a) => held.has(a),
    pressed: (a) => a === 'jump' && pressedJump,
    released: () => false,
    bufferedJump: () => pressedJump,
    consumeJumpBuffer: () => {
      pressedJump = false;
    },
    get dirX() {
      return held.has('left') ? -1 : held.has('right') ? 1 : 0;
    },
  };
}

function standingPlayer(x = 2): Player {
  const p = new Player(px(x * 16), px(13 * 16 - 16), { w: 12, h: 16 }, MARIO_PROFILE);
  p.body.onGround = true;
  return p;
}

describe('Mario physics', () => {
  it('stands on the ground and does not sink', () => {
    const map = flatMap();
    const p = standingPlayer();
    for (let i = 0; i < 10; i++) p.update(fakeInput(new Set()), map);
    expect(p.body.onGround).toBe(true);
    expect(toPx(p.body.y)).toBe(13 * 16 - 16);
  });

  it('reaches max walk speed (1.5625 px/f) and max run speed (2.5625 px/f)', () => {
    const map = flatMap();
    const p = standingPlayer();
    for (let i = 0; i < 120; i++) p.update(fakeInput(new Set(['right'])), map);
    expect(velToPxf(p.body.vx)).toBeCloseTo(1.5625, 3);
    for (let i = 0; i < 120; i++) p.update(fakeInput(new Set(['right', 'attack'])), map);
    expect(velToPxf(p.body.vx)).toBeCloseTo(2.5625, 3);
  });

  it('standing jump apex is about 4 tiles (64 px)', () => {
    const map = flatMap();
    const p = standingPlayer();
    const startY = toPx(p.body.y);
    let minY = startY;
    let first = true;
    for (let i = 0; i < 80; i++) {
      p.update(fakeInput(new Set(['jump']), first), map);
      first = false;
      minY = Math.min(minY, toPx(p.body.y));
    }
    const apex = startY - minY;
    expect(apex).toBeGreaterThanOrEqual(60);
    expect(apex).toBeLessThanOrEqual(68);
    expect(p.body.onGround).toBe(true); // landed again
  });

  it('short hop when jump is released early', () => {
    const map = flatMap();
    const p = standingPlayer();
    const startY = toPx(p.body.y);
    let minY = startY;
    for (let i = 0; i < 80; i++) {
      p.update(fakeInput(new Set(i < 3 ? ['jump'] : []), i === 0), map);
      minY = Math.min(minY, toPx(p.body.y));
    }
    expect(startY - minY).toBeLessThan(40);
  });

  it('running jump apex is about 5 tiles (80 px)', () => {
    const map = flatMap();
    const p = standingPlayer(0);
    for (let i = 0; i < 90; i++) p.update(fakeInput(new Set(['right', 'attack'])), map);
    const startY = toPx(p.body.y);
    let minY = startY;
    let first = true;
    for (let i = 0; i < 90; i++) {
      p.update(fakeInput(new Set(['right', 'attack', 'jump']), first), map);
      first = false;
      minY = Math.min(minY, toPx(p.body.y));
    }
    const apex = startY - minY;
    expect(apex).toBeGreaterThanOrEqual(76);
    expect(apex).toBeLessThanOrEqual(84);
  });

  it('stops at walls', () => {
    const map = flatMap();
    const p = standingPlayer(36);
    for (let i = 0; i < 120; i++) p.update(fakeInput(new Set(['right', 'attack'])), map);
    expect(toPx(p.body.x) + toPx(p.body.w)).toBe(40 * 16);
    expect(p.body.vx).toBe(0);
  });

  it('bumps its head on a block and reports the tile', () => {
    const map = flatMap();
    const p = standingPlayer(10);
    p.body.x = px(10 * 16 + 2);
    let bumped: [number, number] | null = null;
    let first = true;
    for (let i = 0; i < 40; i++) {
      p.update(fakeInput(new Set(['jump']), first), map, (tx, ty) => (bumped = [tx, ty]));
      first = false;
    }
    expect(bumped).toEqual([10, 8]);
  });

  it('skids when reversing at speed', () => {
    const map = flatMap();
    const p = standingPlayer();
    for (let i = 0; i < 60; i++) p.update(fakeInput(new Set(['right'])), map);
    p.update(fakeInput(new Set(['left'])), map);
    expect(p.skidding).toBe(true);
    expect(p.body.vx).toBeGreaterThan(0);
  });
});
