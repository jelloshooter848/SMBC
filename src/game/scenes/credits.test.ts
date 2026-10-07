import { describe, expect, it } from 'vitest';
import { STORY_NOT_OVER } from '../story/script';
import { CREDITS, CREDITS_NAME, CREDITS_SHORT_NAME, CREDITS_TAIL, creditsLines } from './credits';

/** The font's 8 px cells across the 256 px screen. */
const COLUMNS = 32;

describe('the credits', () => {
  it('the campaign 8-4 roll is marked END OF CHAPTER 1, then the false ending, after the thanks', () => {
    const lines = creditsLines(true);
    const thanks = lines.indexOf('THANKS FOR PLAYING');
    expect(lines.slice(thanks + 1, thanks + 1 + CREDITS_NAME.length)).toEqual(CREDITS_NAME);
    const end = lines.indexOf('END OF CHAPTER 1');
    expect(end).toBeGreaterThan(thanks + CREDITS_NAME.length);
    // The false ending's own wording (docs/STORY.md 2.12) follows it.
    expect(lines.slice(end + 2, end + 4)).toEqual(['...BUT THE STORY', "ISN'T OVER."]);
    // The announcer says the block too (Game.showEnding reads STORY_NOT_OVER).
    expect(STORY_NOT_OVER.filter(Boolean).join(' ')).toBe("END OF CHAPTER 1 ...BUT THE STORY ISN'T OVER.");
  });

  it('classic play keeps the plain roll: no chapter mark, no story', () => {
    const lines = creditsLines(false);
    expect(lines).toBe(CREDITS);
    expect(lines).not.toContain('END OF CHAPTER 1');
    expect(lines).not.toContain('...BUT THE STORY');
  });

  it('names our game from one place (the 0.5.0 rename), and the original by its own name', () => {
    expect(CREDITS.slice(0, CREDITS_NAME.length)).toEqual(CREDITS_NAME);
    expect(CREDITS_TAIL).toEqual(CREDITS_SHORT_NAME);
    const inspired = CREDITS.indexOf('INSPIRED BY THE 2010 FLASH GAME');
    expect(CREDITS.slice(inspired + 1, inspired + 4)).toEqual([
      'SUPER MARIO BROS. CROSSOVER',
      'BY JAY PAVLINA',
      'AND EXPLODING RABBIT',
    ]);
  });

  it('every line fits the screen', () => {
    for (const l of [...creditsLines(true), ...CREDITS_TAIL]) expect(l.length).toBeLessThanOrEqual(COLUMNS);
  });
});
