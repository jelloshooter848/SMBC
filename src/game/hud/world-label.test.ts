import { describe, expect, it } from 'vitest';
import { worldLabel } from './world-label';

describe('worldLabel', () => {
  it('shows worlds 1-9 as numbers and 10-13 as A-D', () => {
    expect(worldLabel(1)).toBe('1');
    expect(worldLabel(9)).toBe('9');
    expect([10, 11, 12, 13].map(worldLabel)).toEqual(['A', 'B', 'C', 'D']);
  });
});
