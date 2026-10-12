import { DPAD_RUN_R } from '@engine/input/touch-logic';
import { abilityHint } from '../scenes/hints';
import type { DemoState, DemoVariant, LessonDemo } from './demo-panel';

/*
 * The lessons' demos (0.4.45, demo-panel.ts). The RUN demo (owner #38, 1-0's sprint lesson): on
 * touch two clips take turns, "PUSH FAR" (a thumb slides out past the d-pad's dashed ring and
 * Mario speeds up from a walk to a run) and "HOLD RUN" (the thumb holds the RUN button with the
 * d-pad, and Mario runs); with keys or a pad, the direction is held and Mario walks, then the RUN
 * key or button lights up and he runs. Every highlight stays lit while it is held.
 */

/** Frames of each touch clip, and of the keys' and pad's one. */
export const RUN_CLIP_FRAMES = 150;

/** Where the thumb rests inside the ring (walking) and out past it (running), of the pad's radius. */
const PUSH_WALK = 0.5;
const PUSH_RUN = 0.95;

/** "PUSH FAR": the thumb at the centre, out to walk, then on past the ring to run. */
function pushFar(t: number): DemoState {
  const label = 'PUSH FAR';
  if (t < 30) return { label, speed: 'idle', dir: false, button: false, push: 0 };
  if (t < 45) return { label, speed: 'walk', dir: true, button: false, push: (PUSH_WALK * (t - 29)) / 15 };
  if (t < 75) return { label, speed: 'walk', dir: true, button: false, push: PUSH_WALK };
  if (t < 90) {
    const push = PUSH_WALK + ((PUSH_RUN - PUSH_WALK) * (t - 74)) / 15;
    return { label, speed: push >= DPAD_RUN_R ? 'run' : 'walk', dir: true, button: false, push };
  }
  return { label, speed: 'run', dir: true, button: false, push: PUSH_RUN };
}

/** "HOLD RUN": the thumb inside the ring (a walk), then RUN held with it (a run). */
function holdRun(t: number): DemoState {
  const label = 'HOLD RUN';
  if (t < 40) return { label, speed: 'walk', dir: true, button: false, push: PUSH_WALK };
  return { label, speed: 'run', dir: true, button: true, push: PUSH_WALK };
}

/** Keys or a pad: nothing, the direction (a walk), then RUN with it (a run). */
function keysRun(t: number): DemoState {
  const label = 'HOLD RUN';
  if (t < 20) return { label, speed: 'idle', dir: false, button: false, push: 0 };
  if (t < 60) return { label, speed: 'walk', dir: true, button: false, push: 0 };
  return { label, speed: 'run', dir: true, button: true, push: 0 };
}

export const RUN_DEMO: LessonDemo = {
  length: (v: DemoVariant) => (v === 'touch' ? 2 * RUN_CLIP_FRAMES : RUN_CLIP_FRAMES),
  state(v: DemoVariant, t: number): DemoState {
    if (v !== 'touch') return keysRun(t);
    return t < RUN_CLIP_FRAMES ? pushFar(t) : holdRun(t - RUN_CLIP_FRAMES);
  },
  button: { ability: 'RUN', action: 'attack' },
  dir: { ability: 'RIGHT', action: 'right' },
  hero: { sheet: 'mario', idle: 'small-idle', walk: ['small-walk-0', 'small-walk-1', 'small-walk-2'] },
  said(game, v) {
    if (v === 'touch')
      return 'The picture shows two ways to run: push the d-pad far, past its ring, or hold RUN with the d-pad.';
    return `The picture shows ${abilityHint(game, 'RUN', 'attack')} held with ${abilityHint(game, 'RIGHT', 'right')}.`;
  },
};
