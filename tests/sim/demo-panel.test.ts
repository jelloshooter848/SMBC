import { describe, expect, it } from 'vitest';
import { toPx } from '@engine/math/units';
import { defaultSettings } from '@engine/save/settings';
import { DPAD_RUN_R } from '@engine/input/touch-logic';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { ControlScheme } from '@game/scenes/game';
import { LevelScene } from '@game/scenes/level';
import { CardScene } from '@game/scenes/message';
import { demoVariant, DEMO_H, type DemoVariant } from '@game/tutorial/demo-panel';
import { RUN_CLIP_FRAMES, RUN_DEMO } from '@game/tutorial/demos';
import { MARIO_LESSONS } from '@game/tutorial/mario-1-0';
import { TIP_LOCK_FRAMES } from '@game/tutorial/tips';
import { draw, file, makeGame, useStorage, type H } from './heroes-harness';
import { okTip, playTutorial, tipHeld } from './tutorial-bot';

// The RUN demo (0.4.45, owner #38): while 1-0's run tip holds the game, a looping panel shows a
// small Mario running beside a picture of the controls in use. Touch: "PUSH FAR" (a thumb out past
// the d-pad's ring, a walk becoming a run) and "HOLD RUN" (RUN held with the d-pad) take turns.
// Keys and pad: the RUN key or button lights up while the direction is held, by its real name. It
// follows the input in use live; nothing blinks; the run must still be done for real.

useStorage();

const level = (h: H) => h.top() as LevelScene;
const states = (v: DemoVariant) => Array.from({ length: RUN_DEMO.length(v) }, (_, t) => RUN_DEMO.state(v, t));

/** The stretches of `on` in a loop: how long each lit run lasts, and how many times it changes. */
function stretches(on: boolean[]): { changes: number; shortest: number } {
  let changes = 0;
  let run = 1;
  let shortest = Infinity;
  for (let i = 1; i < on.length; i++) {
    if (on[i] !== on[i - 1]) {
      changes++;
      shortest = Math.min(shortest, run);
      run = 1;
    } else run++;
  }
  return { changes, shortest: Math.min(shortest, run) };
}

/** A file on 1-0, scheme `scheme` (changeable through the returned setter), up to the run tip's hold. */
function atRunTip(scheme: ControlScheme): { h: H; set: (s: ControlScheme) => void } {
  const h = makeGame();
  let now = scheme;
  Object.assign(h.game.deps, { settings: defaultSettings(), controlScheme: () => now });
  file();
  h.game.openFile(1);
  h.idle(8);
  h.tap('jump');
  h.until(() => h.top() instanceof LevelScene, 300);
  h.until(() => h.top() instanceof CardScene, 60);
  for (let i = 0; i < 20 && h.top() instanceof CardScene; i++) {
    h.idle(32);
    h.tap('jump');
  }
  playTutorial(
    h,
    () => tipHeld(h) && level(h).tutorial?.lesson?.id === 'sprint',
    3000,
    () => undefined,
  );
  return { h, set: (s) => void (now = s) };
}

/** Every text drawn this frame. */
const texts = (h: H): string[] => draw(level(h)).texts.map((t) => t.str);

describe('the RUN demo panel', () => {
  it('picks the picture for the input in use', () => {
    expect(demoVariant('touch')).toBe('touch');
    expect(demoVariant('keyboard')).toBe('keys');
    expect(demoVariant('gamepad')).toBe('pad');
    expect(MARIO_LESSONS.find((l) => l.id === 'sprint')?.demo).toBe(RUN_DEMO);
  });

  it('touch: PUSH FAR (out past the ring, a walk then a run) and HOLD RUN (the button with the d-pad) take turns', () => {
    const s = states('touch');
    expect(s).toHaveLength(2 * RUN_CLIP_FRAMES);
    const far = s.slice(0, RUN_CLIP_FRAMES);
    const hold = s.slice(RUN_CLIP_FRAMES);
    expect(new Set(far.map((x) => x.label))).toEqual(new Set(['PUSH FAR']));
    expect(new Set(hold.map((x) => x.label))).toEqual(new Set(['HOLD RUN']));
    // PUSH FAR: never the button; the thumb goes out past the ring; walking first, then running.
    expect(far.some((x) => x.button)).toBe(false);
    expect(far.at(-1)!.push).toBeGreaterThan(DPAD_RUN_R);
    const firstWalk = far.findIndex((x) => x.speed === 'walk');
    const firstRun = far.findIndex((x) => x.speed === 'run');
    expect(firstWalk).toBeGreaterThan(-1);
    expect(firstRun).toBeGreaterThan(firstWalk);
    for (const x of far) expect(x.speed === 'run').toBe(x.push >= DPAD_RUN_R);
    // HOLD RUN: the thumb inside the ring, the button held, running.
    for (const x of hold) expect(x.push).toBeLessThan(DPAD_RUN_R);
    expect(hold.at(-1)).toMatchObject({ button: true, speed: 'run', dir: true });
    for (const x of hold) expect(x.speed === 'run').toBe(x.button);
  });

  it('keys and pad: the direction held and Mario walks, then RUN lights up with it and he runs', () => {
    for (const v of ['keys', 'pad'] as const) {
      const s = states(v);
      expect(
        s.some((x) => x.dir && !x.button && x.speed === 'walk'),
        v,
      ).toBe(true);
      for (const x of s) {
        if (x.button) expect(x.dir, v).toBe(true);
        expect(x.speed === 'run', v).toBe(x.button);
      }
    }
  });

  it('nothing blinks: each highlight stays lit while held, over a second at least', () => {
    for (const v of ['touch', 'keys', 'pad'] as const) {
      const s = states(v);
      for (const pick of [(x: (typeof s)[number]) => x.button, (x: (typeof s)[number]) => x.dir]) {
        const { changes, shortest } = stretches(s.map(pick));
        expect(changes, v).toBeLessThanOrEqual(4);
        expect(shortest, v).toBeGreaterThanOrEqual(15);
      }
      const ring = stretches(s.map((x) => x.push >= DPAD_RUN_R));
      expect(ring.shortest).toBeGreaterThanOrEqual(15);
    }
  });

  it('1-0: the run tip holds with the panel; keyboard shows the real keys, lit while held', () => {
    const { h } = atRunTip('keyboard');
    expect(level(h).tutorial?.demo).toBe(RUN_DEMO);
    expect(h.said.at(-1)).toMatch(/RUN \(X\) held with RIGHT\. OK to continue\.$/);
    h.idle(TIP_LOCK_FRAMES);
    // The keys' names on them, the abilities under, the clip's name.
    let t = texts(h);
    expect(t).toContain('X');
    expect(t).toContain('RIGHT');
    expect(t).toContain('RUN');
    expect(t).toContain('HOLD RUN');
    // Into the run part of the loop: RUN! under the strip.
    h.idle(70);
    t = texts(h);
    expect(t).toContain('RUN!');
  });

  it('touch: PUSH FAR, then HOLD RUN; gamepad: the pad, its RUN button by name; it switches live', () => {
    const { h, set } = atRunTip('touch');
    expect(h.said.at(-1)).toMatch(/push the d-pad far, past its ring, or hold RUN/);
    expect(texts(h)).toContain('PUSH FAR');
    h.idle(RUN_CLIP_FRAMES);
    expect(texts(h)).toContain('HOLD RUN');
    expect(texts(h)).not.toContain('PUSH FAR');
    set('gamepad');
    const t = texts(h);
    expect(t).toContain('RUN (X)');
    expect(t).not.toContain('PUSH FAR');
    set('keyboard');
    expect(texts(h)).toContain('RIGHT');
  });

  it('the panel never covers Mario; it goes with OK, and only a real run passes', () => {
    const { h } = atRunTip('touch');
    const ys: number[] = [];
    const r: Renderer = Object.assign(new NullRenderer(), {
      text(_f: SpriteSheet, str: string, _x: number, y: number): void {
        if (str === 'PUSH FAR') ys.push(y);
      },
    });
    level(h).render(r);
    expect(ys).toHaveLength(1);
    const w = level(h).world;
    const top = toPx(w.player.body.y) - (w.camera.pxY ?? 0);
    const panelTop = (ys[0] as number) - 5;
    expect(panelTop + DEMO_H).toBeLessThan(top);
    okTip(h);
    expect(level(h).tutorial?.demo).toBeNull();
    expect(texts(h)).not.toContain('PUSH FAR');
    // Walking never passes it.
    for (let i = 0; i < 60; i++) h.step(['right']);
    expect(level(h).tutorial?.lesson?.id).toBe('sprint');
    // A real sprint does.
    for (let i = 0; i < 400 && level(h).tutorial?.lesson?.id === 'sprint'; i++) h.step(['right', 'run']);
    expect(level(h).tutorial?.lesson?.id).toBe('ease');
  });

  it('a tip seen again never brings the panel back', () => {
    const { h } = atRunTip('keyboard');
    okTip(h);
    const w = level(h).world;
    w.kill(w.player);
    h.until(() => h.top() instanceof LevelScene && level(h).world !== w && level(h).world.frame > 40, 600);
    expect(level(h).tutorial?.lesson?.id).toBe('sprint');
    expect(tipHeld(h)).toBe(false);
    expect(level(h).tutorial?.demo).toBeNull();
  });
});
