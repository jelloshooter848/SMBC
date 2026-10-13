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

/** Frames of each of the up-throw demo's clips (UP, then UP + AHEAD). */
export const THROW_CLIP_FRAMES = 96;
/** Frames into a clip: the direction held, the button pressed, the boomerang's flight out and back. */
const THROW = { dirFrom: 10, dirTo: 64, pressFrom: 22, pressTo: 30, out: 22, back: 24 };

/**
 * Link's boomerang up (0.4.46, owner #26): UP held with the tool button throws it straight up,
 * then UP with RIGHT throws it up and ahead; a coin up there rides back on it. On touch the
 * thumb sits on the d-pad's up arm (up and right for the second clip) and the tool button.
 */
export const BOOMERANG_UP_DEMO: LessonDemo = {
  length: () => 2 * THROW_CLIP_FRAMES,
  state(_v: DemoVariant, t: number): DemoState {
    const ahead = t >= THROW_CLIP_FRAMES;
    const k = t % THROW_CLIP_FRAMES;
    const dir = k >= THROW.dirFrom && k < THROW.dirTo;
    return {
      label: ahead ? 'UP + AHEAD' : 'UP',
      speed: 'idle',
      dir,
      button: k >= THROW.pressFrom && k < THROW.pressTo,
      push: dir ? 0.6 : 0,
      dirs: ahead ? ['up', 'right'] : ['up'],
    };
  },
  button: { ability: 'USE TOOL', action: 'special' },
  dir: { ability: 'UP', action: 'up' },
  dirs: [
    { ability: 'UP', action: 'up' },
    { ability: 'RIGHT', action: 'right' },
  ],
  touchCaption: 'TOOL',
  height: 80,
  groundH: 3,
  hero: { sheet: 'link', idle: 'idle', walk: [] },
  caption(_st, t) {
    const k = (t % THROW_CLIP_FRAMES) - THROW.out;
    return k >= 0 && k < 2 * THROW.back ? 'THROW!' : '';
  },
  draw(r, game, at, t) {
    const ahead = t >= THROW_CLIP_FRAMES;
    const k = (t % THROW_CLIP_FRAMES) - THROW.out;
    const items = game.ctx.assets.sheet('items');
    // From over his head up to the strip's top (the boomerang 8 px), out for `back` frames, back.
    const ox = at.heroX - 4;
    const oy = at.heroTop - 6;
    const reach = Math.max(8, oy - (at.y + 2));
    const step = reach / THROW.back;
    const d = k < 0 ? 0 : k < THROW.back ? k * step : Math.max(0, (2 * THROW.back - k) * step);
    const dx = ahead ? d : 0;
    const dy = d;
    // A coin up there (a small gold one: the strip is short): waiting until it is reached, then
    // riding back on the boomerang.
    const coin = (x: number, y: number) => {
      r.rect(x + 2, y + 1, 4, 6, '#f8b800');
      r.rect(x + 3, y + 2, 1, 4, '#fce4a0');
    };
    const flying = k >= 0 && k < 2 * THROW.back;
    if (k < THROW.back) coin(Math.round(ox + (ahead ? reach : 0)), Math.round(oy - reach));
    if (!flying) return;
    const bx = Math.round(ox + dx);
    const by = Math.round(oy - dy);
    if (k >= THROW.back) coin(bx, by);
    r.sprite(items, `boomerang-${(k >> 1) & 3}`, bx, by);
  },
  said(game, v) {
    if (v === 'touch')
      return 'The picture shows up held on the d-pad with the tool button: the boomerang flies straight up. With up and right held, it flies up and ahead.';
    const up = abilityHint(game, 'UP', 'up');
    return `The picture shows ${up} held with ${abilityHint(game, 'USE TOOL', 'special')}: the boomerang flies straight up. With ${up} and ${abilityHint(game, 'RIGHT', 'right')}, it flies up and ahead.`;
  },
};
