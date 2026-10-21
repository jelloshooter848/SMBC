import { describe, expect, it } from 'vitest';
import {
  CREDITS,
  CREDITS_RABBIT_LOGO,
  CREDITS_TAIL,
  CreditsScene,
  creditsLines,
  creditsSpeech,
} from '@game/scenes/credits';
import { makeGame, useStorage } from './heroes-harness';

// Owner decision (0.5.0, #181): the whole credits roll is read to screen readers, the Classic and
// the campaign roll alike, the Exploding Rabbit logo credit too. One announcement as it starts
// (the live region keeps only its latest text), then "OK to continue." at the end; the roll
// itself never waits for it.

useStorage();

describe('the credits are read out', () => {
  for (const story of [false, true]) {
    it(`every line, in a couple of announcements (${story ? 'campaign 8-4' : 'Classic'} roll)`, () => {
      const h = makeGame();
      const lines = creditsLines(story);
      const before = h.said.length;
      const scene = new CreditsScene(h.game, [], () => undefined, null, lines);
      h.game.scenes.push(scene);
      // The roll runs at its own pace to the end, then waits for OK.
      h.until(() => scene.waiting, 6000);
      const said = h.said.slice(before);
      expect(said.length).toBeLessThanOrEqual(2);
      const text = said.join(' ');
      for (const l of [...lines, ...CREDITS_TAIL].filter((x) => x.trim())) expect(text).toContain(l.trim());
      expect(text).toContain('EXPLODING RABBIT LOGO (C) JAY PAVLINA');
      expect(said.at(-1)).toBe('OK to continue.');
    });
  }

  it('reads blocks as sentences, with no blank or doubled lines', () => {
    const s = creditsSpeech(CREDITS);
    expect(s.startsWith('Credits. SUPER MARIO BROS. CROSSOVER REMIX.')).toBe(true);
    expect(s).toContain(`${CREDITS_RABBIT_LOGO.join(' ')}`);
    expect(s).not.toMatch(/ {2}|\.\./);
  });
});
