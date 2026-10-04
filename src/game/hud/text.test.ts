import { describe, expect, it } from 'vitest';
import { fontText, wrapText } from './text';

describe('fontText', () => {
  it('upper-cases and keeps only glyphs the font has', () => {
    expect(fontText('Jump: hold Z (or A)!')).toBe('JUMP: HOLD Z (OR A)!');
    expect(fontText('a_b#c')).toBe('ABC');
    expect(fontText('don’t — go & stop')).toBe("DON'T - GO + STOP");
  });
});

describe('wrapText', () => {
  it('never exceeds the column count and breaks on spaces', () => {
    const lines = wrapText('Throw a fireball when you have the flower. Two on screen.', 20);
    expect(lines.every((l) => l.length <= 20)).toBe(true);
    expect(lines.join(' ')).toBe('THROW A FIREBALL WHEN YOU HAVE THE FLOWER. TWO ON SCREEN.');
    expect(lines[0]).toBe('THROW A FIREBALL');
  });

  it('cuts a word longer than a line and respects newlines', () => {
    expect(wrapText('abcdefghij', 4)).toEqual(['ABCD', 'EFGH', 'IJ']);
    expect(wrapText('one\ntwo', 10)).toEqual(['ONE', 'TWO']);
    expect(wrapText('', 10)).toEqual(['']);
  });
});
