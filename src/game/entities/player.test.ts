import { describe, expect, it } from 'vitest';
import { px, toPx, velToPxf } from '@engine/math/units';
import { Player } from './player';
import { MARIO } from '../characters/mario';
import { LUIGI } from '../characters/luigi';
import type { CharacterDef } from '../characters/character';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
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

/** Flat floor with a 4-tile-high plateau from column 40 to the right edge (a tall pipe's top). */
function plateauMap(): TileMap {
  const rows = Array.from({ length: 13 }, () => '.'.repeat(64));
  for (let y = 9; y < 13; y++) rows[y] = '.'.repeat(40) + '#'.repeat(24);
  const src = ['id: t', '', '[tiles]', ...rows, '#'.repeat(64), '#'.repeat(64)].join('\n');
  return new TileMap(parseTextMap(src));
}

function standingPlayer(x = 2, def: CharacterDef = MARIO): Player {
  const p = new Player(px(x * 16), px(13 * 16 - 16), def, 'small', 0);
  p.body.onGround = true;
  return p;
}

/** Jump from a standstill holding the button; returns the apex height in px. */
function standingApex(def: CharacterDef): number {
  const map = flatMap();
  const p = standingPlayer(2, def);
  const startY = toPx(p.body.y);
  let minY = startY;
  let first = true;
  for (let i = 0; i < 100; i++) {
    p.update(fakeInput(new Set(['jump']), first), map, NULL_AUDIO);
    first = false;
    minY = Math.min(minY, toPx(p.body.y));
  }
  return startY - minY;
}

describe('Mario physics', () => {
  it('stands on the ground and does not sink', () => {
    const map = flatMap();
    const p = standingPlayer();
    for (let i = 0; i < 10; i++) p.update(fakeInput(new Set()), map, NULL_AUDIO);
    expect(p.body.onGround).toBe(true);
    expect(toPx(p.body.y)).toBe(13 * 16 - 16);
  });

  it('reaches max walk speed (1.5625 px/f) and max run speed (2.5625 px/f)', () => {
    const map = flatMap();
    const p = standingPlayer();
    for (let i = 0; i < 120; i++) p.update(fakeInput(new Set(['right'])), map, NULL_AUDIO);
    expect(velToPxf(p.body.vx)).toBeCloseTo(1.5625, 3);
    for (let i = 0; i < 120; i++) p.update(fakeInput(new Set(['right', 'attack'])), map, NULL_AUDIO);
    expect(velToPxf(p.body.vx)).toBeCloseTo(2.5625, 3);
  });

  it('standing jump clears 4 tiles (64 px) like SMB1', () => {
    const map = flatMap();
    const p = standingPlayer();
    const startY = toPx(p.body.y);
    let minY = startY;
    let first = true;
    for (let i = 0; i < 80; i++) {
      p.update(fakeInput(new Set(['jump']), first), map, NULL_AUDIO);
      first = false;
      minY = Math.min(minY, toPx(p.body.y));
    }
    const apex = startY - minY;
    expect(apex).toBeGreaterThanOrEqual(64);
    expect(apex).toBeLessThanOrEqual(70);
    expect(p.body.onGround).toBe(true); // landed again
  });

  it('walking jump keeps walking speed in the air (no run-speed burst)', () => {
    const map = flatMap();
    const p = standingPlayer(0);
    for (let i = 0; i < 120; i++) p.update(fakeInput(new Set(['right'])), map, NULL_AUDIO);
    expect(p.body.vx).toBe(MARIO.movement.maxWalk);
    let first = true;
    let maxVx = 0;
    for (let i = 0; i < 90; i++) {
      p.update(fakeInput(new Set(['right', 'jump']), first), map, NULL_AUDIO);
      first = false;
      maxVx = Math.max(maxVx, p.body.vx);
    }
    expect(maxVx).toBe(MARIO.movement.maxWalk);
  });

  it('walking jump lands on top of a 4-tile pipe without running', () => {
    const map = plateauMap();
    const p = standingPlayer(20);
    let pressed = false;
    for (let i = 0; i < 400 && !(p.body.onGround && toPx(p.body.y) === 9 * 16 - 16); i++) {
      const ahead = 40 * 16 - toPx(p.body.x + p.body.w);
      const jump = pressed || (p.body.onGround && ahead <= 56);
      const held = new Set<Action>(['right']);
      if (jump) held.add('jump');
      p.update(fakeInput(held, jump && !pressed), map, NULL_AUDIO);
      if (jump) pressed = true;
    }
    expect(p.body.onGround).toBe(true);
    expect(toPx(p.body.y)).toBe(9 * 16 - 16);
    expect(toPx(p.body.x + p.body.w)).toBeGreaterThan(40 * 16); // standing on the plateau's edge
  });

  it('short hop when jump is released early', () => {
    const map = flatMap();
    const p = standingPlayer();
    const startY = toPx(p.body.y);
    let minY = startY;
    for (let i = 0; i < 80; i++) {
      p.update(fakeInput(new Set(i < 3 ? ['jump'] : []), i === 0), map, NULL_AUDIO);
      minY = Math.min(minY, toPx(p.body.y));
    }
    expect(startY - minY).toBeLessThan(40);
  });

  it('running jump apex is about 5 tiles (80 px)', () => {
    const map = flatMap();
    const p = standingPlayer(0);
    for (let i = 0; i < 90; i++) p.update(fakeInput(new Set(['right', 'attack'])), map, NULL_AUDIO);
    const startY = toPx(p.body.y);
    let minY = startY;
    let first = true;
    for (let i = 0; i < 90; i++) {
      p.update(fakeInput(new Set(['right', 'attack', 'jump']), first), map, NULL_AUDIO);
      first = false;
      minY = Math.min(minY, toPx(p.body.y));
    }
    const apex = startY - minY;
    expect(apex).toBeGreaterThanOrEqual(80);
    expect(apex).toBeLessThanOrEqual(88);
  });

  it('stops at walls', () => {
    const map = flatMap();
    const p = standingPlayer(36);
    for (let i = 0; i < 120; i++) p.update(fakeInput(new Set(['right', 'attack'])), map, NULL_AUDIO);
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
      p.update(fakeInput(new Set(['jump']), first), map, NULL_AUDIO, (tx, ty) => (bumped = [tx, ty]));
      first = false;
    }
    expect(bumped).toEqual([10, 8]);
  });

  it('skids when reversing at speed', () => {
    const map = flatMap();
    const p = standingPlayer();
    for (let i = 0; i < 60; i++) p.update(fakeInput(new Set(['right'])), map, NULL_AUDIO);
    p.update(fakeInput(new Set(['left'])), map, NULL_AUDIO);
    expect(p.skidding).toBe(true);
    expect(p.body.vx).toBeGreaterThan(0);
  });
});

describe('Luigi physics', () => {
  it('jumps about a tile higher than Mario from a standstill', () => {
    const mario = standingApex(MARIO);
    const luigi = standingApex(LUIGI);
    expect(luigi).toBeGreaterThanOrEqual(mario + 10);
    expect(luigi).toBeLessThanOrEqual(mario + 18);
  });

  it('slides further than Mario after letting go', () => {
    const slide = (def: CharacterDef) => {
      const map = flatMap();
      const p = standingPlayer(2, def);
      for (let i = 0; i < 120; i++) p.update(fakeInput(new Set(['right'])), map, NULL_AUDIO);
      const x0 = toPx(p.body.x);
      for (let i = 0; i < 120; i++) p.update(fakeInput(new Set()), map, NULL_AUDIO);
      expect(p.body.vx).toBe(0);
      return toPx(p.body.x) - x0;
    };
    expect(slide(LUIGI)).toBeGreaterThan(slide(MARIO) * 1.5);
  });

  it('shares the plumber power-up rules', () => {
    expect(LUIGI.damage).toEqual(MARIO.damage);
    expect(LUIGI.behaviour).toBe(MARIO.behaviour);
  });
});
