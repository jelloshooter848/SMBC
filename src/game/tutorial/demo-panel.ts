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
  /**
   * The directions held while `dir` is (0.4.46: UP, or UP and RIGHT for a throw up and ahead).
   * Absent: the demo's own direction alone.
   */
  dirs?: readonly Action[];
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
  /**
   * Every direction the clip ever shows (the touch pad's arms drawn, a key each): absent, `dir`'s
   * alone. Their names on keys are the bound keys', as `dir`'s.
   */
  dirs?: readonly { ability: string; action: Action }[];
  /** The button's caption on the touch picture, when not its ability (a tool's, kept short). */
  touchCaption?: string;
  /** The panel's height (px), for a taller hero or a throw up high; default DEMO_H. */
  height?: number;
  /** The strip's ground (px tall; default 10): a thin one leaves the sky room for a throw up. */
  groundH?: number;
  /** The hero's sheet and frames (standing, the walk cycle). */
  hero: { sheet: string; idle: string; walk: readonly string[] };
  /** What is read out with the tip when the panel first shows (the picture in words). */
  said(game: Game, variant: DemoVariant): string;
  /** The words under the strip at this frame (default: RUN! or WALK by the hero's speed). */
  caption?(st: DemoState, t: number): string;
  /**
   * More of the picture over the strip at frame `t` (a thrown boomerang's flight): the strip's
   * box, its ground's top and where the hero's middle and head are.
   */
  draw?(
    r: Renderer,
    game: Game,
    at: { x: number; y: number; w: number; h: number; groundY: number; heroX: number; heroTop: number },
    t: number,
    st: DemoState,
  ): void;
}

/** The directions held at a clip's frame (none while `dir` is off). */
const heldDirs = (demo: LessonDemo, st: DemoState): readonly Action[] =>
  st.dir ? (st.dirs ?? [demo.dir.action]) : [];

/** Every direction a demo shows (its d-pad arms, its keys). */
const allDirs = (demo: LessonDemo): readonly { ability: string; action: Action }[] => demo.dirs ?? [demo.dir];

/** A direction's unit vector on screen (y down). */
const DIR_VEC: Readonly<Partial<Record<Action, [number, number]>>> = {
  right: [1, 0],
  left: [-1, 0],
  up: [0, -1],
  down: [0, 1],
};

/** The panel's height (px), unless a demo asks for more (LessonDemo.height). */
export const DEMO_H = 60;

/** The height of `demo`'s panel. */
export const demoHeight = (demo: LessonDemo): number => demo.height ?? DEMO_H;

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
  btnLit: '#3c64d8',
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
  const gh = demo.groundH ?? 10;
  const groundY = y + h - gh;
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
  r.rect(x, groundY, w, gh, C.ground);
  r.rect(x, groundY, w, 1, C.groundTop);
  if (gh >= 10) {
    const off = Math.floor(scroll) % 16;
    for (let sx = x - off; sx < x + w; sx += 16) if (sx >= x) r.rect(sx, groundY + 1, 1, 9, C.seam);
    r.rect(x, groundY + 5, w, 1, C.seam);
  }
  // The hero, a third of the way in, standing on the ground (feet on it, however tall).
  const sheet = game.ctx.assets.sheet(demo.hero.sheet);
  const walk = demo.hero.walk;
  const every = st.speed === 'run' ? 3 : 6;
  const frame =
    st.speed === 'idle' || !walk.length
      ? demo.hero.idle
      : (walk[Math.floor(t / every) % walk.length] as string);
  const f = sheet.frames.get(frame);
  const fw = f?.w ?? 16;
  const fh = f?.h ?? 16;
  const heroX = x + Math.floor(w / 3);
  r.sprite(sheet, frame, heroX - (fw >> 1), groundY - fh);
  demo.draw?.(r, game, { x, y, w, h, groundY, heroX, heroTop: groundY - fh }, t, st);
}

/**
 * Our touch pad: its base, the wedges of the demo's directions (those held lit), the dashed run
 * ring, the thumb (out along the directions held).
 */
function drawPad(r: Renderer, cx: number, cy: number, st: DemoState, demo: LessonDemo): void {
  const R = 20;
  disc(r, cx, cy, R, C.padBase);
  circle(r, cx, cy, R, C.padEdge);
  // Each direction's wedge: lit while it is held.
  const held = heldDirs(demo, st);
  for (const d of allDirs(demo)) {
    const [vx, vy] = DIR_VEC[d.action] ?? [1, 0];
    const lit = held.includes(d.action);
    for (let k = 5; k <= 14; k++) {
      const half = Math.round(k * 0.85);
      if (vx !== 0) r.rect(cx + vx * k, cy - half, 1, half * 2 + 1, lit ? C.wedgeLit : C.wedge);
      else r.rect(cx - half, cy + vy * k, half * 2 + 1, 1, lit ? C.wedgeLit : C.wedge);
    }
  }
  const running = st.push >= DPAD_RUN_R;
  const ringR = Math.round(R * DPAD_RUN_R);
  if (running) {
    circle(r, cx, cy, ringR, C.ringLit);
    circle(r, cx, cy, ringR + 1, C.ringLit);
  } else circle(r, cx, cy, ringR, C.ring, 15);
  // The thumb, along the directions held.
  if (st.dir || st.push > 0) {
    let ux = 0;
    let uy = 0;
    for (const a of held.length ? held : [demo.dir.action]) {
      const [vx, vy] = DIR_VEC[a] ?? [1, 0];
      ux += vx;
      uy += vy;
    }
    const len = Math.hypot(ux, uy) || 1;
    const tx = cx + Math.round((st.push * R * ux) / len);
    const ty = cy + Math.round((st.push * R * uy) / len);
    disc(r, tx, ty, 7, C.thumb);
    circle(r, tx, ty, 7, C.thumbEdge);
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
  // Wide enough for its caption (TOOL as well as RUN).
  const R = Math.max(15, label.length * 4 + 3);
  disc(r, cx, cy, R, lit ? C.btnLit : C.btn);
  circle(r, cx, cy, R, C.btnRun);
  if (lit) {
    // The thumb pressing it from below and to the right, the caption left clear.
    circle(r, cx, cy, R + 1, C.ringLit);
    disc(r, cx + 9, cy + 11, 6, C.thumb);
    circle(r, cx + 9, cy + 11, 6, C.thumbEdge);
  }
  centred(r, font, label, cx, cy - 6);
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
 * A gamepad: its body, a d-pad (each arm held lit) and four face buttons in a diamond (the one the
 * action is bound to lit while held).
 */
function drawGamepad(
  r: Renderer,
  x: number,
  y: number,
  st: DemoState,
  bound: string | null,
  held: readonly Action[],
): void {
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
  for (const a of held) {
    const [vx, vy] = DIR_VEC[a] ?? [1, 0];
    r.rect(dx - 3 + vx * 7, dy - 3 + vy * 7, 7, 7, C.ringLit);
  }
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
  const H = demoHeight(demo);
  r.rect(x, y, w, H, C.frame);
  r.rect(x + 2, y + 2, w - 4, H - 4, C.inside);
  // The hero's distance so far this loop, at each frame's speed (the ground scrolls by).
  let scroll = 0;
  for (let i = 0; i < k; i++) {
    const s = demo.state(variant, i).speed;
    scroll += s === 'run' ? 2.5 : s === 'walk' ? 1.25 : 0;
  }
  const stripW = Math.min(104, Math.floor((w - 12) / 2));
  const sx = x + 6;
  const sy = y + 6;
  drawStrip(r, game, demo, sx, sy, stripW, H - 22, scroll, st, k);
  // Under the strip: what the hero does.
  centred(
    r,
    font,
    demo.caption?.(st, k) ?? (st.speed === 'run' ? 'RUN!' : st.speed === 'walk' ? 'WALK' : ''),
    sx + (stripW >> 1),
    y + H - 13,
  );
  // The controls, right of the strip, the clip's name over them.
  const cx0 = sx + stripW + 4;
  const cw = x + w - 4 - cx0;
  const mid = cx0 + (cw >> 1);
  centred(r, font, fontText(st.label), mid, y + 5);
  // A taller panel keeps its controls under the clip's name, centred in the room left.
  y += (H - DEMO_H) >> 1;
  const button = fontText(abilityHint(game, demo.button.ability, demo.button.action));
  if (variant === 'touch') {
    drawPad(r, mid - 26, y + 34, st, demo);
    drawButton(r, font, mid + 28, y + 36, fontText(demo.touchCaption ?? demo.button.ability), st.button);
    return;
  }
  if (variant === 'pad') {
    const bound = boundKey(game, demo.button.action);
    drawGamepad(r, mid - 48, y + 14, st, bound, heldDirs(demo, st));
    centred(r, font, button, mid, y + DEMO_H - 12);
    return;
  }
  // Keys: the direction's key (each held direction's, as many as fit), then the button's, their
  // names on them and the abilities under.
  const held = heldDirs(demo, st);
  const shown = demo.dirs ? demo.dirs.filter((d) => held.includes(d.action)) : [demo.dir];
  const dirs = (shown.length ? shown : [demo.dir]).map((d) => ({
    ...d,
    name: fontText(boundKey(game, d.action) ?? d.ability),
  }));
  const btnName = fontText(boundKey(game, demo.button.action) ?? demo.button.ability);
  const gap = 14;
  const width = (n: number) => dirs.slice(0, n).reduce((a, d) => a + capW(d.name) + gap, 0) + capW(btnName);
  // Long key names (RIGHT SHIFT and RIGHT) that don't fit side by side: fewer direction keys, the
  // button's key alone at the least.
  let n = dirs.length;
  while (n > 0 && width(n) > cw) n--;
  let kx = mid - (width(n) >> 1);
  const ky = y + 18;
  for (const d of dirs.slice(0, n)) {
    const dw = keyCap(r, font, kx, ky, d.name, held.includes(d.action));
    centred(r, font, '+', kx + dw + (gap >> 1), ky + 6);
    if (d.name !== fontText(d.ability)) centred(r, font, fontText(d.ability), kx + (dw >> 1), ky + 24);
    kx += dw + gap;
  }
  const bw = keyCap(r, font, kx, ky, btnName, st.button);
  centred(r, font, fontText(demo.button.ability), kx + (bw >> 1), ky + 24);
}
