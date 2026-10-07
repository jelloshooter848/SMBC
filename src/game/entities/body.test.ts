import { describe, expect, it } from 'vitest';
import { px } from '@engine/math/units';
import { makeBody, moveY } from './body';
import { TileMap } from '../world/tilemap';
import { parseTextMap } from '../level/textmap';

/** A block at (10, 5); with `wall`, a wall at column 12 below it (rows 6 and 7). */
function cornerMap(wall: boolean): TileMap {
  const rows = Array.from({ length: 13 }, () => '.'.repeat(32));
  rows[5] = '.'.repeat(10) + '#' + '.'.repeat(21);
  if (wall) for (const y of [6, 7]) rows[y] = '.'.repeat(12) + '#' + '.'.repeat(19);
  const src = ['id: t', '', '[tiles]', ...rows, '#'.repeat(32), '#'.repeat(32)].join('\n');
  return new TileMap(parseTextMap(src));
}

describe('moveY: the wide-body corner slip (cornerFreeTiles: 2)', () => {
  // 19 px wide, its left 3 px under the block's right edge, rising into row 5.
  const rise = (wall: boolean) => {
    const b = makeBody(px(11 * 16 - 3), px(6 * 16 + 1), 19, 15.5);
    b.vy = -0x02000;
    moveY(b, cornerMap(wall), -px(2), { cornerFreeTiles: 2 });
    return b;
  };

  it('slips past the corner when the shifted box is clear', () => {
    const b = rise(false);
    expect(b.x).toBe(px(11 * 16));
    expect(b.hitHead).toBe(false);
  });

  it('bumps instead when slipping would push the box into a wall beside it', () => {
    const b = rise(true);
    expect(b.x).toBe(px(11 * 16 - 3));
    expect(b.x + b.w).toBeLessThanOrEqual(px(12 * 16));
    expect(b.y).toBeGreaterThanOrEqual(px(6 * 16));
  });
});
