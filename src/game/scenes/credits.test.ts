import { describe, expect, it } from 'vitest';
import { CREDITS, CREDITS_NAME, CREDITS_SHORT_NAME, CREDITS_TAIL, creditsLines } from './credits';
import { STORY_NOT_OVER } from '../story/script';

/** The font's 8 px cells across the 256 px screen. */
const COLUMNS = 32;

describe('credits', () => {
  it('open and close with the game name, SUPER MARIO BROS. CROSSOVER / REMIX', () => {
    expect(CREDITS_NAME).toEqual(['SUPER MARIO BROS. CROSSOVER', 'REMIX']);
    expect(CREDITS.slice(0, 2)).toEqual(CREDITS_NAME);
    const thanks = CREDITS.indexOf('THANKS FOR PLAYING');
    expect(CREDITS.slice(thanks + 1, thanks + 3)).toEqual(CREDITS_NAME);
    expect(CREDITS_TAIL).toEqual(['SMB CROSSOVER', 'REMIX']);
    expect(CREDITS_TAIL).toEqual(CREDITS_SHORT_NAME);
  });

  it('credit the author and the original fan game, as the title does', () => {
    expect(CREDITS).toContain('MADE BY JELLOSHOOTER848');
    expect(CREDITS).toContain('AND EXPLODING RABBIT');
    expect(CREDITS.join(' ')).not.toMatch(/REBUILD/);
  });

  it('name the original by its own name (not ours)', () => {
    const based = CREDITS.indexOf('BASED ON THE 2010 FLASH GAME');
    expect(CREDITS.slice(based + 1, based + 4)).toEqual([
      'SUPER MARIO BROS. CROSSOVER',
      'BY JAY PAVLINA',
      'AND EXPLODING RABBIT',
    ]);
  });

  it('every line fits the 256 px screen (32 characters of the 8 px font)', () => {
    for (const l of [...creditsLines(true), ...CREDITS_TAIL]) expect(l.length).toBeLessThanOrEqual(COLUMNS);
  });

  it("the campaign's 8-4 adds the story block right after the closing name", () => {
    const lines = creditsLines(true);
    const thanks = lines.indexOf('THANKS FOR PLAYING');
    expect(lines.slice(thanks + 1, thanks + 1 + CREDITS_NAME.length)).toEqual(CREDITS_NAME);
    const at = thanks + 1 + CREDITS_NAME.length;
    expect(lines.slice(at, at + STORY_NOT_OVER.length)).toEqual(STORY_NOT_OVER);
    expect(lines.length).toBe(CREDITS.length + STORY_NOT_OVER.length);
  });

  it('that block marks END OF CHAPTER 1, then the false ending (docs/STORY.md 2.12)', () => {
    const lines = creditsLines(true);
    const thanks = lines.indexOf('THANKS FOR PLAYING');
    const end = lines.indexOf('END OF CHAPTER 1');
    expect(end).toBeGreaterThan(thanks + CREDITS_NAME.length);
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
});
