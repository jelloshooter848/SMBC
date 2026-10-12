import { fitGame, type GameFit } from '../viewport';
import { BUTTON_PLACES, FACE_BUTTON, SMALL_BUTTON } from './touch-logic';

/*
 * The screen layout (0.4.45): where the game picture and each touch control go, from the window
 * size and its safe-area insets. Pure, so the tests can lay out any phone; main.ts applies it to
 * the Viewport and the TouchSource. The rule: no touch control is ever drawn over the game.
 * - Desktop (no pad), and tablets where nothing overlapped: the 0.4.44 layout, game centred.
 * - A phone held upright: the game at the top, just below the notch; the controls below it, with
 *   MENU at the top right of that area (no longer in the screen's corner, over the game).
 * - Landscape where a control reached the game: the game centred, the controls in the side
 *   gutters, SELECT up and to the left of C inside the right gutter.
 * Controls shrink (never below MIN_CONTROL_SCALE) before the game does.
 */

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ControlId = 'dpad' | 'jump' | 'attack' | 'special' | 'select' | 'start';
export const CONTROL_IDS: readonly ControlId[] = ['dpad', 'jump', 'attack', 'special', 'select', 'start'];

/** A control's place inside the frame, in CSS px (already scaled). */
export type Place = Partial<Record<'left' | 'right' | 'top' | 'bottom', number>>;

export interface ScreenInput {
  /** The window (CSS px), notch and home bar included. */
  width: number;
  height: number;
  insets: Insets;
  dpr: number;
  integerScale: boolean;
  /** The on-screen pad is up. */
  touch: boolean;
  /** The player's touch scale (Options > Controls). */
  touchScale: number;
}

export type LayoutMode = 'centred' | 'portrait' | 'landscape';

export interface ScreenLayout {
  mode: LayoutMode;
  /** The canvas and the controls' box: the window less the insets (client px). */
  frame: Rect;
  /** The game picture (client px). */
  game: Rect;
  /** For Viewport.fit. */
  fit: GameFit;
  /** The controls' scale (--ts): the player's, or smaller where it would not fit. */
  scale: number;
  places: Record<ControlId, Place>;
  /** Each control's drawn box (client px); the d-pad's is also the floating stick's resting place. */
  rects: Record<ControlId, Rect>;
}

/** The game's top edge below the frame top (the safe-area inset) when a phone is upright. */
export const PORTRAIT_TOP_MARGIN = 8;
/** Clear space between MENU and the game above it (portrait). */
export const PORTRAIT_MENU_GAP = 12;
/** Clear space between a control and the game (landscape gutters). */
export const GUTTER_GAP = 4;
/** Controls never shrink below this: a face button stays 48 px, thumb-sized. */
export const MIN_CONTROL_SCALE = 0.7;
/** A window whose short side is under this (CSS px) is a phone. */
export const PHONE_MAX_SHORT_SIDE = 600;

/** The d-pad (also the floating stick at rest), at touch scale 1. */
export const DPAD_PLACE = { left: 16, bottom: 24 } as const;
export const DPAD_SIZE = 150;
/** Landscape: SELECT up and to the left of C, no wider out than B (inside the right gutter). */
export const LANDSCAPE_SELECT = { right: 104, bottom: 190 } as const;

const SIZES: Record<ControlId, { w: number; h: number }> = {
  dpad: { w: DPAD_SIZE, h: DPAD_SIZE },
  jump: FACE_BUTTON,
  attack: FACE_BUTTON,
  special: FACE_BUTTON,
  select: SMALL_BUTTON,
  start: SMALL_BUTTON,
};

/** The places at touch scale 1: the 0.4.44 layout. */
function basePlaces(): Record<ControlId, Place> {
  return { dpad: { ...DPAD_PLACE }, ...BUTTON_PLACES };
}

function scalePlace(p: Place, s: number): Place {
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v * s])) as Place;
}

function rectOf(frame: Rect, p: Place, w: number, h: number): Rect {
  const x = p.left !== undefined ? frame.x + p.left : frame.x + frame.w - (p.right ?? 0) - w;
  const y = p.top !== undefined ? frame.y + p.top : frame.y + frame.h - (p.bottom ?? 0) - h;
  return { x, y, w, h };
}

export function overlaps(a: Rect, b: Rect, gap = 0): boolean {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
}

export function inside(a: Rect, box: Rect): boolean {
  const e = 0.5;
  return (
    a.x >= box.x - e && a.y >= box.y - e && a.x + a.w <= box.x + box.w + e && a.y + a.h <= box.y + box.h + e
  );
}

function gameRect(frame: Rect, dpr: number, integerScale: boolean, fit: GameFit): Rect {
  const b = fitGame(frame.w, frame.h, dpr, integerScale, fit);
  return { x: frame.x + b.ox / dpr, y: frame.y + b.oy / dpr, w: b.dw / dpr, h: b.dh / dpr };
}

function build(
  mode: LayoutMode,
  frame: Rect,
  input: ScreenInput,
  fit: GameFit,
  scale: number,
  at1: Record<ControlId, Place>,
  extra: Partial<Record<ControlId, Place>> = {},
): ScreenLayout {
  const places = {} as Record<ControlId, Place>;
  const rects = {} as Record<ControlId, Rect>;
  for (const id of CONTROL_IDS) {
    places[id] = { ...scalePlace(at1[id], scale), ...extra[id] };
    rects[id] = rectOf(frame, places[id], SIZES[id].w * scale, SIZES[id].h * scale);
  }
  const game = gameRect(frame, input.dpr, input.integerScale, fit);
  return { mode, frame, game, fit, scale, places, rects };
}

/** No control over the game. */
export function clearOfGame(l: ScreenLayout, gap = 0): boolean {
  return CONTROL_IDS.every((id) => !overlaps(l.rects[id], l.game, gap));
}

/** The pills (SELECT, MENU) clear of every other control, and everything inside the frame. */
function tidy(l: ScreenLayout): boolean {
  for (const pill of ['select', 'start'] as const)
    for (const id of CONTROL_IDS)
      if (id !== pill && overlaps(l.rects[pill], l.rects[id], 4 * l.scale)) return false;
  return CONTROL_IDS.every((id) => inside(l.rects[id], l.frame));
}

/** Scales from `top` down to MIN_CONTROL_SCALE in steps of 0.05. */
function scales(top: number): number[] {
  const out = [top];
  for (let s = Math.floor(top * 20 - 1e-9) / 20; s >= MIN_CONTROL_SCALE - 1e-9; s -= 0.05)
    out.push(Math.round(s * 100) / 100);
  if ((out.at(-1) ?? 0) > MIN_CONTROL_SCALE) out.push(MIN_CONTROL_SCALE);
  return out;
}

/** Upright: game at the top, controls bottom-anchored below it, MENU at the top right of that area. */
function portrait(frame: Rect, input: ScreenInput): ScreenLayout {
  const at1 = basePlaces();
  const make = (fit: GameFit, s: number) => {
    const game = gameRect(frame, input.dpr, input.integerScale, fit);
    const top = game.y + game.h - frame.y + PORTRAIT_MENU_GAP;
    return build('portrait', frame, input, fit, s, at1, {
      start: { right: BUTTON_PLACES.start.right * s, top },
    });
  };
  const ok = (l: ScreenLayout) => clearOfGame(l, PORTRAIT_MENU_GAP - 1) && tidy(l);
  const fit: GameFit = { top: PORTRAIT_TOP_MARGIN };
  for (const s of scales(input.touchScale)) {
    const l = make(fit, s);
    if (ok(l)) return l;
  }
  // Even the smallest controls need more room: give up game height, a step at a time.
  const s = Math.min(input.touchScale, MIN_CONTROL_SCALE);
  let maxH = frame.h - PORTRAIT_TOP_MARGIN;
  let l = make(fit, s);
  for (let i = 0; i < 200 && !ok(l) && maxH > 0; i++) {
    maxH -= 8;
    l = make({ ...fit, maxH }, s);
  }
  return l;
}

/** Sideways: game centred, controls in the gutters (SELECT moved in beside C). */
function landscape(frame: Rect, input: ScreenInput): ScreenLayout {
  const at1 = { ...basePlaces(), select: { ...LANDSCAPE_SELECT } };
  const ok = (l: ScreenLayout) => clearOfGame(l, GUTTER_GAP - 1) && tidy(l);
  for (const s of scales(input.touchScale)) {
    const l = build('landscape', frame, input, {}, s, at1);
    if (ok(l)) return l;
  }
  const s = Math.min(input.touchScale, MIN_CONTROL_SCALE);
  let maxW = frame.w;
  let l = build('landscape', frame, input, {}, s, at1);
  for (let i = 0; i < 200 && !ok(l) && maxW > 0; i++) {
    maxW -= 8;
    l = build('landscape', frame, input, { maxW }, s, at1);
  }
  return l;
}

/** The game rect and every control's rect for a window of this size and safe-area insets. */
export function layoutScreen(input: ScreenInput): ScreenLayout {
  const { width, height, insets } = input;
  const frame: Rect = {
    x: insets.left,
    y: insets.top,
    w: Math.max(0, width - insets.left - insets.right),
    h: Math.max(0, height - insets.top - insets.bottom),
  };
  const centred = build('centred', frame, input, {}, input.touchScale, basePlaces());
  if (!input.touch) return centred;
  const upright = frame.h > frame.w;
  const phone = Math.min(width, height) < PHONE_MAX_SHORT_SIDE;
  if (!(upright && phone) && clearOfGame(centred)) return centred;
  return upright ? portrait(frame, input) : landscape(frame, input);
}
