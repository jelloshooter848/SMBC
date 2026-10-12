import type { Action } from '@engine/input/actions';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { DPAD_RUN_R } from '@engine/input/touch-logic';
import type { ControlScheme, Game } from '../scenes/game';
import { abilityHint, boundKey, controlScheme } from '../scenes/hints';
import { fontText } from '../hud/text';

/*
 * A lesson's demo panel (0.4.45, owner #38: "teach RUN with an animation that shows the buttons
 * being pressed and Mario doing the move"): while a lesson's new tip holds the game, a short
 * looping clip under the tip's box. On its left a hero runs on a strip of ground (the ground
 * scrolls by at his speed); on its right a picture of the controls in use, drawn in our own pixel
 * art: our touch pad (its dashed run ring, the thumb on it) and round buttons, a keyboard's keys
 * (their real bound names), or a pad with its d-pad and face buttons. It follows the input in use
 * live (asked every frame drawn). A highlight is never a blink: what is held stays lit, steadily,
 * for as long as it is held (reduce flashing or not).
 *
 * Reusable: a lesson gives a `LessonDemo` (its clip as states frame by frame, the button and the
 * direction it shows, the hero's frames); this file knows nothing of RUN or Mario.
 */

/** Which picture of the controls: the touch pad, a keyboard, a gamepad. */
export type DemoVariant = 'touch' | 'keys' | 'pad';

/** The picture for the controls in use. */
export function demoVariant(scheme: ControlScheme): DemoVariant {
  return scheme === 'touch' ? 'touch' : scheme === 'gamepad' ? 'pad' : 'keys';
}

/** One frame of a clip. */
export interface DemoState {
  /** The clip's name, shown at the panel's top ("PUSH FAR"). */
  label: string;
  /** How the hero moves. */
  speed: 'idle' | 'walk' | 'run';
  /** The direction is held (its arrow, key or d-pad arm lit). */
  dir: boolean;
  /** The lesson's button is held (lit, a thumb on it on touch). */
  button: boolean;
  /**
   * Touch: where the thumb sits on the d-pad, from its centre (0) out along the direction to its
   * rim (1); past the dashed ring (DPAD_RUN_R) the ring lights, as on the real pad.
   */
  push: number;
}

export interface LessonDemo {
  /** Frames in one loop of the clip for `variant`. */
  length(variant: DemoVariant): number;
  /** Frame `t` (0 to length - 1) of the clip for `variant`. */
  state(variant: DemoVariant, t: number): DemoState;
  /** The button the clip shows (its ability and action: RUN on 'attack'). */
  button: { ability: string; action: Action };
  /** The direction the clip shows. */
  dir: { ability: string; action: Action };
  /** The hero's sheet and frames (standing, the walk cycle). */
  hero: { sheet: string; idle: string; walk: readonly string[] };
  /** What is read out with the tip when the panel first shows (the picture in words). */
  said(game: Game, variant: DemoVariant): string;
}

/** The panel's height (px). */
export const DEMO_H = 60;

/** Colours: the panel and the stage strip, and our touch pad's (touch.ts, as pixels on black). */
const C = {
  frame: '#fcfcfc',
  inside: '#000',
  sky: '#5c94fc',
  ground: '#c84c0c',
  groundTop: '#fca044',
  seam: '#000',
  bush: '#00a800',
  padBase: '#3c3c3c',
  padEdge: '#9c9c9c',
  ring: '#7c7c7c',
  ringLit: '#f8b800',
  wedge: '#5c5c5c',
  wedgeLit: '#bcbcbc',
  thumb: '#d8d8d8',
  thumbEdge: '#fcfcfc',
  btn: '#2c2c2c',
  btnRun: '#94b8fc',
  btnLit: '#bcbcbc',
  key: '#202020',
  keyLit: '#f8b800',
  text: '#fcfcfc',
};

/** A filled disc of radius `rad` centred on (cx, cy), in pixel rows. */
export function disc(r: Renderer, cx: number, cy: number, rad: number, color: string): void {
  for (let dy = -rad; dy <= rad; dy++) {
    const half = Math.floor(Math.sqrt(rad * rad - dy * dy) + 0.35);
    r.rect(cx - half, cy + dy, half * 2 + 1, 1, color);
  }
}

/** A one-pixel circle; `dash` > 0 leaves gaps (dash and gap of that many degrees). */
export function circle(r: Renderer, cx: number, cy: number, rad: number, color: string, dash = 0): void {
  const steps = Math.max(24, Math.round(rad * 8));
  let last = '';
  for (let i = 0; i < steps; i++) {
    const deg = (i * 360) / steps;
    if (dash > 0 && Math.floor(deg / dash) % 2 === 1) continue;
    const a = (deg * Math.PI) / 180;
    const x = Math.round(cx + rad * Math.cos(a));
    const y = Math.round(cy + rad * Math.sin(a));
    const k = `${x},${y}`;
    if (k === last) continue;
    last = k;
    r.rect(x, y, 1, 1, color);
  }
}

/** Text centred on `cx` (the font's 8 px cells). */
function centred(r: Renderer, font: SpriteSheet, s: string, cx: number, y: number): void {
  r.text(font, s, cx - ((s.length * 8) >> 1), y);
}

/** The stage strip: sky, a bush scrolling by, ground with seams, the hero on it at `speed`. */
function drawStrip(
  r: Renderer,
  game: Game,
  demo: LessonDemo,
  x: number,
  y: number,
  w: number,
  h: number,
  scroll: number,
  st: DemoState,
  t: number,
): void {
  r.rect(x, y, w, h, C.sky);
  const groundY = y + h - 10;
  // A bush going by (its left edge wraps around the strip).
  const bx = x + (((((w - Math.floor(scroll * 0.75)) % (w + 24)) + (w + 24)) % (w + 24)) - 24);
  for (const [dx, dy, ww] of [
    [4, 0, 8],
    [2, 1, 12],
    [0, 2, 16],
    [0, 3, 16],
  ] as const) {
    const left = Math.max(x, bx + dx);
    const right = Math.min(x + w, bx + dx + ww);
    if (right > left) r.rect(left, groundY - 4 + dy, right - left, 1, C.bush);
  }
  r.rect(x, groundY, w, 10, C.ground);
  r.rect(x, groundY, w, 1, C.groundTop);
  const off = Math.floor(scroll) % 16;
  for (let sx = x - off; sx < x + w; sx += 16) if (sx >= x) r.rect(sx, groundY + 1, 1, 9, C.seam);
  r.rect(x, groundY + 5, w, 1, C.seam);
  // The hero, a third of the way in, standing on the ground.
  const sheet = game.ctx.assets.sheet(demo.hero.sheet);
  const walk = demo.hero.walk;
  const every = st.speed === 'run' ? 3 : 6;
  const frame =
    st.speed === 'idle' || !walk.length
      ? demo.hero.idle
      : (walk[Math.floor(t / every) % walk.length] as string);
  r.sprite(sheet, frame, x + Math.floor(w / 3) - 8, groundY - 16);
}

/** Our touch pad: its base, the four wedges (the direction's lit), the dashed run ring, the thumb. */
function drawPad(r: Renderer, cx: number, cy: number, st: DemoState): void {
  const R = 20;
  disc(r, cx, cy, R, C.padBase);
  circle(r, cx, cy, R, C.padEdge);
  // The right wedge: lit while the direction is held.
  for (let dx = 5; dx <= 14; dx++) {
    const half = Math.round(dx * 0.85);
    r.rect(cx + dx, cy - half, 1, half * 2 + 1, st.dir ? C.wedgeLit : C.wedge);
  }
  const running = st.push >= DPAD_RUN_R;
  const ringR = Math.round(R * DPAD_RUN_R);
  if (running) {
    circle(r, cx, cy, ringR, C.ringLit);
    circle(r, cx, cy, ringR + 1, C.ringLit);
  } else circle(r, cx, cy, ringR, C.ring, 15);
  // The thumb, along the direction.
  if (st.dir || st.push > 0) {
    const tx = cx + Math.round(st.push * R);
    disc(r, tx, cy, 7, C.thumb);
    circle(r, tx, cy, 7, C.thumbEdge);
  }
}

/** A round button with its ability's caption; lit (and a thumb on it) while held. */
function drawButton(
  r: Renderer,
  font: SpriteSheet,
  cx: number,
  cy: number,
  label: string,
  lit: boolean,
): void {
  const R = 15;
  disc(r, cx, cy, R, lit ? C.btnLit : C.btn);
  circle(r, cx, cy, R, C.btnRun);
  if (lit) {
    // The thumb resting on it, from below.
    disc(r, cx + 3, cy + 9, 7, C.thumb);
    circle(r, cx + 3, cy + 9, 7, C.thumbEdge);
  }
  centred(r, font, label, cx, cy - 4);
}

/** A key cap with a name on it; lit (gold, dark text) while held. Returns its width. */
function keyCap(r: Renderer, font: SpriteSheet, x: number, y: number, name: string, lit: boolean): number {
  const w = Math.max(24, name.length * 8 + 10);
  r.rect(x, y, w, 20, C.frame);
  r.rect(x + 2, y + 2, w - 4, 16, lit ? C.keyLit : C.key);
  if (lit) r.rect(x + 2, y + 16, w - 4, 2, '#ac7c00');
  r.text(font, name, x + ((w - name.length * 8) >> 1), y + 6);
  return w;
}

/** The width a key cap takes. */
const capW = (name: string): number => Math.max(24, name.length * 8 + 10);

/**
 * A gamepad: its body, a d-pad (the right arm lit while held) and four face buttons in a diamond
 * (the one the action is bound to lit while held).
 */
function drawGamepad(r: Renderer, x: number, y: number, st: DemoState, bound: string | null): void {
  const w = 96;
  const h = 34;
  r.rect(x + 4, y, w - 8, h, C.padEdge);
  r.rect(x, y + 4, w, h - 8, C.padEdge);
  r.rect(x + 5, y + 1, w - 10, h - 2, C.padBase);
  r.rect(x + 1, y + 5, w - 2, h - 10, C.padBase);
  // The d-pad.
  const dx = x + 22;
  const dy = y + 17;
  r.rect(dx - 10, dy - 3, 21, 7, C.wedge);
  r.rect(dx - 3, dy - 10, 7, 21, C.wedge);
  if (st.dir) r.rect(dx + 4, dy - 3, 7, 7, C.ringLit);
  // The face buttons: Y top, X left, B right, A bottom (the standard mapping).
  const fx = x + w - 24;
  const fy = y + 17;
  const spots: Record<string, [number, number]> = { Y: [0, -8], X: [-8, 0], B: [8, 0], A: [0, 8] };
  for (const [name, [ox, oy]] of Object.entries(spots)) {
    const lit = st.button && bound === name;
    disc(r, fx + ox, fy + oy, 4, lit ? C.ringLit : C.btn);
    circle(r, fx + ox, fy + oy, 4, C.padEdge);
  }
}

/**
 * The panel for `demo` at frame `t` of its loop, under (or over) a box at x..x+w: a frame, the
 * clip's name, the stage strip and the controls in use.
 */
export function drawDemoPanel(
  r: Renderer,
  game: Game,
  demo: LessonDemo,
  t: number,
  x: number,
  y: number,
  w: number,
): void {
  const variant = demoVariant(controlScheme(game));
  const len = Math.max(1, demo.length(variant));
  const k = ((t % len) + len) % len;
  const st = demo.state(variant, k);
  const font = game.ctx.assets.sheet('font');
  r.rect(x, y, w, DEMO_H, C.frame);
  r.rect(x + 2, y + 2, w - 4, DEMO_H - 4, C.inside);
  // The hero's distance so far this loop, at each frame's speed (the ground scrolls by).
  let scroll = 0;
  for (let i = 0; i < k; i++) {
    const s = demo.state(variant, i).speed;
    scroll += s === 'run' ? 2.5 : s === 'walk' ? 1.25 : 0;
  }
  const stripW = Math.min(104, Math.floor((w - 12) / 2));
  const sx = x + 6;
  const sy = y + 6;
  drawStrip(r, game, demo, sx, sy, stripW, DEMO_H - 22, scroll, st, k);
  // Under the strip: what the hero does.
  centred(
    r,
    font,
    st.speed === 'run' ? 'RUN!' : st.speed === 'walk' ? 'WALK' : '',
    sx + (stripW >> 1),
    y + DEMO_H - 13,
  );
  // The controls, right of the strip, the clip's name over them.
  const cx0 = sx + stripW + 4;
  const cw = x + w - 4 - cx0;
  const mid = cx0 + (cw >> 1);
  centred(r, font, fontText(st.label), mid, y + 5);
  const button = fontText(abilityHint(game, demo.button.ability, demo.button.action));
  if (variant === 'touch') {
    drawPad(r, mid - 26, y + 34, st);
    drawButton(r, font, mid + 28, y + 36, fontText(demo.button.ability), st.button);
    return;
  }
  if (variant === 'pad') {
    const bound = boundKey(game, demo.button.action);
    drawGamepad(r, mid - 48, y + 14, st, bound);
    centred(r, font, button, mid, y + DEMO_H - 12);
    return;
  }
  // Keys: the direction's key, then the button's, their names on them and the abilities under.
  const dirName = fontText(boundKey(game, demo.dir.action) ?? demo.dir.ability);
  const btnName = fontText(boundKey(game, demo.button.action) ?? demo.button.ability);
  const gap = 14;
  const both = capW(dirName) + gap + capW(btnName);
  // Long key names (RIGHT SHIFT and RIGHT) that don't fit side by side: the button's key alone.
  const withDir = both <= cw;
  let kx = mid - ((withDir ? both : capW(btnName)) >> 1);
  const ky = y + 18;
  if (withDir) {
    const dw = keyCap(r, font, kx, ky, dirName, st.dir);
    centred(r, font, '+', kx + dw + (gap >> 1), ky + 6);
    if (dirName !== fontText(demo.dir.ability))
      centred(r, font, fontText(demo.dir.ability), kx + (dw >> 1), ky + 24);
    kx += dw + gap;
  }
  const bw = keyCap(r, font, kx, ky, btnName, st.button);
  centred(r, font, fontText(demo.button.ability), kx + (bw >> 1), ky + 24);
}
