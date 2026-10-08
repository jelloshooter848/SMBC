import { describe, expect, it } from 'vitest';
import { CREDITS, CREDITS_NAME, CREDITS_TAIL, creditsLines } from './credits';
import { STORY_NOT_OVER } from '../story/script';

describe('credits', () => {
  it('open and close with the game name, SUPER MARIO BROS. CROSSOVER / REMIX', () => {
    expect(CREDITS_NAME).toEqual(['SUPER MARIO BROS. CROSSOVER', 'REMIX']);
    expect(CREDITS.slice(0, 2)).toEqual(CREDITS_NAME);
    const thanks = CREDITS.indexOf('THANKS FOR PLAYING');
    expect(CREDITS.slice(thanks + 1, thanks + 3)).toEqual(CREDITS_NAME);
    expect(CREDITS_TAIL).toEqual(['SMB CROSSOVER', 'REMIX']);
  });

  it('credit the author and the original fan game, as the title does', () => {
    expect(CREDITS).toContain('MADE BY JELLOSHOOTER848');
    expect(CREDITS).toContain('AND EXPLODING RABBIT');
    expect(CREDITS.join(' ')).not.toMatch(/REBUILD/);
  });

  it('every line fits the 256 px screen (32 characters of the 8 px font)', () => {
    for (const l of [...creditsLines(true), ...CREDITS_TAIL]) expect(l.length).toBeLessThanOrEqual(32);
  });

  it("the campaign's 8-4 adds the story block right after the closing name", () => {
    const lines = creditsLines(true);
    const thanks = lines.indexOf('THANKS FOR PLAYING');
    expect(lines.slice(thanks + 1, thanks + 1 + CREDITS_NAME.length)).toEqual(CREDITS_NAME);
    const at = thanks + 1 + CREDITS_NAME.length;
    expect(lines.slice(at, at + STORY_NOT_OVER.length)).toEqual(STORY_NOT_OVER);
    expect(lines.length).toBe(CREDITS.length + STORY_NOT_OVER.length);
  });
});
