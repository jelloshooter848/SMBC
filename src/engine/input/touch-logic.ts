import type { Action } from './actions';
import type { TouchMode } from '../save/settings';
import type { TouchLabels } from './touch';

/*
 * The pure parts of the touch controls (no DOM): d-pad zones, when to show the pad, hit-testing
 * the face buttons, and fitting button labels. TouchSource in touch.ts wires them to the page.
 */

// ---- D-pad zones ---------------------------------------------------------------------------

/** Inside this fraction of the pad radius nothing is held (a resting thumb). */
export const DPAD_DEAD = 0.2;
/** Left/right are held within this many degrees of horizontal (a wide ±60° band each side). */
export const DPAD_HORIZONTAL_MAX_DEG = 60;
/** Up is held at this elevation or steeper: up-diagonals 35°–60°, pure up within ±30° of vertical. */
export const DPAD_UP_MIN_DEG = 35;
/** Down is held at this elevation or steeper (down-diagonals 45°–60°)... */
export const DPAD_DOWN_MIN_DEG = 45;
/** ...and only past this fraction of the radius, so a thumb running sideways never crouches. */
export const DPAD_DOWN_MIN_R = 0.55;
/** Past this fraction of the radius a left/right push also holds `run` (the drawn ring). */
export const DPAD_RUN_R = 0.75;
/** Floating stick: when the thumb drags further than this (× radius) the centre follows it. */
export const DPAD_FOLLOW_R = 1.25;
/** The fixed pad's invisible hit area, as a multiple of the drawn pad's size. */
export const DPAD_HIT_SCALE = 1.4;
/** Floating stick: touches in this fraction of the screen width (from the left) grab the stick. */
export const FLOAT_ZONE_FRACTION = 0.45;

export interface DpadDirs {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  run: boolean;
}

export const NO_DIRS: Readonly<DpadDirs> = { left: false, right: false, up: false, down: false, run: false };

/**
 * Directions held for a thumb at (dx, dy) px from the pad centre (screen axes, +y down) on a pad
 * of `radius` px. Eight sectors by angle: left/right wide, up/down narrower, diagonals only in
 * the bands between; down also needs a deliberate push, and a far push left/right adds `run`.
 */
export function dpadDirs(dx: number, dy: number, radius: number): DpadDirs {
  const r = Math.hypot(dx, dy) / radius;
  if (!(r >= DPAD_DEAD) || !Number.isFinite(r)) return { ...NO_DIRS };
  const elev = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI; // 0 = horizontal, 90 = vertical
  const horizontal = elev <= DPAD_HORIZONTAL_MAX_DEG;
  const left = horizontal && dx < 0;
  const right = horizontal && dx > 0;
  const up = dy < 0 && elev >= DPAD_UP_MIN_DEG;
  const down = dy > 0 && elev >= DPAD_DOWN_MIN_DEG && r >= DPAD_DOWN_MIN_R;
  const run = r >= DPAD_RUN_R && (left || right);
  return { left, right, up, down, run };
}

/** Floating stick: the centre after the thumb moved to (x, y); it trails a thumb dragged far out. */
export function followCentre(
  cx: number,
  cy: number,
  x: number,
  y: number,
  radius: number,
): { cx: number; cy: number } {
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.hypot(dx, dy);
  const max = DPAD_FOLLOW_R * radius;
  if (d <= max) return { cx, cy };
  const k = (d - max) / d;
  return { cx: cx + dx * k, cy: cy + dy * k };
}

// ---- When to show the pad --------------------------------------------------------------------

/** What the page knows about the device. */
export interface TouchFacts {
  /** matchMedia('(pointer: coarse)'): the primary pointer is a finger. */
  coarsePointer: boolean;
  /** matchMedia('(hover: none)'): the primary pointer cannot hover. */
  hoverNone: boolean;
}

/** The last kind of input used: a real touch, or a key / gamepad button. */
export type LastInput = 'touch' | 'keys' | null;

/**
 * Show the on-screen pad? 'on'/'off' always win. 'auto' follows the last input used (a touch
 * shows it, a key or gamepad button hides it) and otherwise the device: phones and tablets
 * (coarse primary pointer that cannot hover) yes, desktops and touchscreen laptops no.
 */
export function touchPadVisible(mode: TouchMode, facts: TouchFacts, last: LastInput): boolean {
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  if (last === 'touch') return true;
  if (last === 'keys') return false;
  return facts.coarsePointer && facts.hoverNone;
}

/** Read the media facts from the page (false for both outside a browser). */
export function readTouchFacts(
  mm: ((q: string) => { matches: boolean }) | undefined = typeof matchMedia === 'function'
    ? (q) => matchMedia(q)
    : undefined,
): TouchFacts {
  if (!mm) return { coarsePointer: false, hoverNone: false };
  return { coarsePointer: mm('(pointer: coarse)').matches, hoverNone: mm('(hover: none)').matches };
}

// ---- Face buttons ----------------------------------------------------------------------------

/** Fraction past a button's radius that still counts as on it (rolling thumbs land between). */
export const BUTTON_HIT_SLACK = 1.2;

export interface ButtonTarget {
  action: Action;
  cx: number;
  cy: number;
  r: number;
}

/** The button under (x, y): the nearest whose (slightly enlarged) circle contains the point. */
export function hitButton(x: number, y: number, targets: readonly ButtonTarget[]): Action | null {
  let best: Action | null = null;
  let bestD = Infinity;
  for (const t of targets) {
    const d = Math.hypot(x - t.cx, y - t.cy) / t.r;
    if (d <= BUTTON_HIT_SLACK && d < bestD) {
      best = t.action;
      bestD = d;
    }
  }
  return best;
}

// ---- Labels ----------------------------------------------------------------------------------

/** Smallest font scale a long label shrinks to. */
export const LABEL_MIN_SCALE = 0.45;
/** Font scale for a label wrapped onto two lines. */
export const LABEL_WRAP_SCALE = 0.85;

/**
 * How to fit `text` on a button that holds `maxChars` characters at full size: multi-word labels
 * wrap (one word a line) and shrink to their longest word; single words shrink to fit.
 */
export function fitLabel(text: string, maxChars: number): { scale: number; wrap: boolean } {
  const t = text.trim();
  if (t.length <= maxChars) return { scale: 1, wrap: false };
  const words = t.split(/\s+/);
  if (words.length > 1) {
    const widest = Math.max(...words.map((w) => w.length));
    return { scale: Math.max(LABEL_MIN_SCALE, Math.min(LABEL_WRAP_SCALE, maxChars / widest)), wrap: true };
  }
  return { scale: Math.max(LABEL_MIN_SCALE, maxChars / t.length), wrap: false };
}

/** The little of an element that labelling needs (a DOM element, or a stub in tests). */
export interface LabelTarget {
  textContent: string | null;
  style: { setProperty(name: string, value: string): void };
  classList: { toggle(token: string, force?: boolean): boolean };
}

export interface LabelSlot {
  el: LabelTarget;
  /** Label shown when the scene gives none (the A/B/C identity). */
  def: string;
  /** Characters that fit at full size. */
  maxChars: number;
}

/**
 * Applies TouchLabels to the buttons. Only touches the DOM for buttons whose label changed, so
 * it is cheap to call every frame. `null` hides a button; an absent key restores its default.
 */
export class ButtonLabeler {
  private readonly current = new Map<Action, string | null>();

  constructor(private readonly slots: ReadonlyMap<Action, LabelSlot>) {
    for (const [a, s] of slots) this.current.set(a, s.def);
  }

  /** Returns the actions whose buttons were hidden by this call. */
  apply(labels: TouchLabels): Action[] {
    const hidden: Action[] = [];
    for (const [a, slot] of this.slots) {
      const given = labels[a];
      const next = given === undefined ? slot.def : given;
      if (this.current.get(a) === next) continue;
      this.current.set(a, next);
      const el = slot.el;
      el.classList.toggle('hidden', next === null);
      if (next === null) {
        hidden.push(a);
        continue;
      }
      const fit = fitLabel(next, slot.maxChars);
      el.textContent = next;
      el.style.setProperty('--fs', String(Math.round(fit.scale * 100) / 100));
      el.classList.toggle('wrap', fit.wrap);
      // A custom label keeps a small corner badge with the button's letter.
      el.classList.toggle('custom', next !== slot.def);
    }
    return hidden;
  }

  label(a: Action): string | null | undefined {
    return this.current.get(a);
  }
}
