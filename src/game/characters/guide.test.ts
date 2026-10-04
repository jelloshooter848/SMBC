import { describe, expect, it } from 'vitest';
import { CHARACTERS } from './registry';
import { describePad } from '../scenes/guide';
import { itemsDef } from '@content/sprites/items';

const ACTIONS = new Set([
  'left/right',
  'jump',
  'attack',
  'special',
  'select',
  'up',
  'down',
  'up+attack',
  'down+attack',
  'down+jump',
  'attack (hold)',
]);

describe('character guides', () => {
  it.each(CHARACTERS.map((c) => [c.name, c] as const))('%s has a complete guide', (_n, c) => {
    const g = c.guide;
    expect(g.tagline.length).toBeGreaterThan(3);
    expect(g.tagline.length).toBeLessThanOrEqual(30); // one line of the bitmap font
    expect(g.controls.length).toBeGreaterThanOrEqual(3);
    for (const ctl of g.controls) {
      expect(ACTIONS.has(ctl.action)).toBe(true);
      expect(ctl.does.length).toBeGreaterThan(3);
    }
    for (const item of ['mushroom', 'flower', 'star'])
      expect(g.powerups.some((p) => p.item === item)).toBe(true);
    expect(g.demo.length).toBeGreaterThan(0);
    for (const t of g.belt ?? []) expect(itemsDef.frames[t.icon]).toBeDefined();
  });

  it('heroes with a tool belt document every tool', () => {
    for (const c of CHARACTERS) {
      if (!c.tools) continue;
      expect(c.guide.belt?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe('describePad', () => {
  it('names the standard mapping and falls back to the generic label', () => {
    expect(describePad('pad:0')).toBe('A');
    expect(describePad('pad:9')).toBe('START');
    expect(describePad('pad:11')).toBe('BUTTON 11');
  });
});
