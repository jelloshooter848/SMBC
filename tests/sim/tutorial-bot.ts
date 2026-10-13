import { expect } from 'vitest';
import type { Action } from '@engine/input/actions';
import { LevelScene } from '@game/scenes/level';
import { CardScene } from '@game/scenes/message';
import { ShadowTeaseScene } from '@game/tutorial/tease';
import { BowserSpellScene } from '@game/story/bowser-spell';
import { HeroStageScene } from '@game/tutorial/hero-stage';
import { TIP_LOCK_FRAMES } from '@game/tutorial/tips';
import type { H } from './heroes-harness';

export { tutorialBot } from './tutorial-controls';
import { tutorialBot } from './tutorial-controls';

/**
 * A new tip holds the game (0.4.45): 1-0's level or a hero's training stage is on top and its
 * tutorial waits for OK.
 */
export const tipHeld = (h: H): boolean => {
  const t = h.top();
  // A pickup's one-time explainer holds it the same way (0.4.46).
  if (t instanceof LevelScene) return !!t.tutorial?.frozen || t.explainers.frozen;
  return t instanceof HeroStageScene && (t.director.frozen || t.explainers.frozen);
};

/** OK on a tip holding the game, once its lock is over: play goes on. */
export function okTip(h: H): void {
  for (let i = 0; i < 120 && tipHeld(h); i++) h.step(i > TIP_LOCK_FRAMES && i % 4 === 0 ? ['jump'] : []);
  expect(tipHeld(h)).toBe(false);
}

/** One frame of `input`, after OK on any tip holding the game. */
export function stepPast(h: H, input: Action[] = []): void {
  if (tipHeld(h)) okTip(h);
  h.step(input);
}

/**
 * Steps `input` (default: idle) until the current lesson's tip is up (NICE! over, the hero landed),
 * then OK on it if it holds the game: the tests that step on their own start from there.
 */
export function passTip(h: H, input: () => Action[] = () => [], max = 300): void {
  for (let i = 0; i < max && !tipHeld(h); i++) {
    const t = h.top();
    const d = t instanceof LevelScene ? t.tutorial : t instanceof HeroStageScene ? t.director : null;
    if (d?.tipUp) break;
    h.step(input());
  }
  if (tipHeld(h)) okTip(h);
}

/**
 * Plays 1-0 with the bot until `stop`; cards, the tease and Bowser's spell go on with OK, and so
 * does each new tip that holds the game (0.4.45). `onHold` sees each hold as it starts.
 */
export function playTutorial(
  h: H,
  stop: () => boolean,
  max = 9000,
  onHold?: (scene: LevelScene) => void,
): void {
  let frames = 0;
  let held = 0;
  for (; frames < max && !stop(); frames++) {
    const t = h.top();
    // Text never moves by itself: every card waits for OK.
    if (t instanceof CardScene || t instanceof ShadowTeaseScene || t instanceof BowserSpellScene) {
      h.step(frames % 40 === 39 ? ['jump'] : []);
      continue;
    }
    if (t instanceof LevelScene && t.tutorial?.frozen) {
      if (held++ === 0) onHold?.(t);
      h.step(held % 24 === 0 ? ['jump'] : []);
      continue;
    }
    held = 0;
    h.step(tutorialBot(h));
  }
  expect(stop(), `stopped after ${frames} frames`).toBe(true);
}
