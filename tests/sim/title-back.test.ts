import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { NULL_AUDIO, type AudioSink } from '@engine/audio/audio-manager';
import { BACK, PORTAL, emergePose, portalStage, suckPose, TitleScene } from '@game/scenes/title';
import { CLASSIC_AT, ClassicTitleScene, SMASH } from '@game/scenes/original-title';
import { TITLE_TIMING } from '@game/scenes/title-anim';
import { draw, makeGame, useStorage } from './heroes-harness';
import { DEFAULT_ASSIST } from '@game/context';

// 0.4.73 (owner, 52A; replaces 0.4.72's shatter-and-slam): CLASSIC to REMIX through the rift.
// A small rift portal opens over the logo, CLASSIC is sucked up into it (stretching, shrinking
// and spinning), and REMIX comes out of it into its place; the heroes are already standing.
// Reduce flashing: the same timeline, calm (steady colours, no spin, no shake, no dust). The
// music, as in 0.4.72: the overworld cut as the way back starts, the theme in as REMIX lands,
// from its loop point.

useStorage();
afterEach(() => vi.useRealTimers());

function setup(reduceFlashing = false) {
  const music: string[] = [];
  const sfx: string[] = [];
  const audio: AudioSink = {
    ...NULL_AUDIO,
    playMusic: (id, _fadeIn, fromLoop) => void music.push(`${id}${fromLoop ? '@loop' : ''}`),
    fadeOutMusic: (s) => void music.push(`fade ${s}`),
    stopMusic: () => void music.push('stop'),
    sfx: (id) => void sfx.push(id),
  };
  const h = makeGame();
  h.game.ctx.audio = audio;
  (h.game.ctx as { reduceFlashing: boolean }).reduceFlashing = reduceFlashing;
  h.game.ctx.assist = { ...DEFAULT_ASSIST };
  return { h, music, sfx };
}

/** The REMIX title, then CLASSIC with its smash over and the overworld playing, then BACK. */
function back(
  s: ReturnType<typeof setup>,
  demoFrames = 0,
): { title: TitleScene; classic: ClassicTitleScene } {
  s.h.game.showTitle();
  s.h.idle(TITLE_TIMING.dropEnd + 2);
  s.h.game.showClassicTitle();
  s.h.idle(SMASH.end + 2 + demoFrames);
  const classic = s.h.top() as ClassicTitleScene;
  expect(classic).toBeInstanceOf(ClassicTitleScene);
  s.music.length = 0;
  s.sfx.length = 0;
  s.h.step(['attack']); // BACK on the demo
  const title = s.h.top() as TitleScene;
  expect(title).toBeInstanceOf(TitleScene);
  return { title, classic };
}

const clock = (t: TitleScene) => (t as unknown as { clock: number }).clock;
const frames = (t: TitleScene) => draw(t).sprites.map((x) => x.frame);

const sprite = (t: TitleScene, frame: string) => draw(t).sprites.find((x) => x.frame === frame);
const rift = (t: TitleScene) => draw(t).sprites.find((x) => x.key.startsWith('title-rift'));

describe('the way back from CLASSIC (0.4.73: through the rift portal)', () => {
  it('a portal opens, CLASSIC is sucked up into it, REMIX comes out into its place, in about 1.3 s', () => {
    const s = setup();
    const { title, classic } = back(s);
    expect(title.phase).toBe('back');
    const demoT = classic.demo.t;
    // The portal (the intro's rift) opens over the logo; CLASSIC still at rest in its place.
    expect(rift(title)?.frame).toBe('rift-1');
    const c0 = sprite(title, 'classic')!;
    expect(c0.x).toBe(CLASSIC_AT.x);
    expect(c0.y).toBe(CLASSIC_AT.y);
    expect(frames(title)).not.toContain('remix');
    // It opens to its stage, steadily.
    s.h.idle(BACK.openStep * PORTAL.stage);
    expect(rift(title)?.frame).toBe(`rift-${PORTAL.stage}`);
    expect(classic.demo.t).toBe(demoT); // the demo no longer runs
    // CLASSIC is pulled toward the portal: closer every frame, smaller, and turning.
    let last = Infinity;
    const dist = (p: { x: number; y: number }) => Math.hypot(p.x - PORTAL.x, p.y - PORTAL.y);
    for (let f = BACK.suckFrom + 1; f < BACK.suckTo; f++) {
      const p = suckPose(f, false)!;
      expect(dist(p), `frame ${f}`).toBeLessThanOrEqual(last);
      last = dist(p);
    }
    const early = suckPose(BACK.suckFrom + 6, false)!;
    expect(early.sy).toBeGreaterThan(1); // the stretch toward it
    const late = suckPose(BACK.suckTo - 2, false)!;
    expect(late.sx).toBeLessThan(0.1);
    expect(Math.abs(late.angle)).toBeGreaterThan(Math.PI); // spun round
    expect(s.sfx).toContain('pipe');
    // Gone into it: the portal alone for a moment.
    while (clock(title) < BACK.suckTo) s.h.step();
    expect(frames(title)).not.toContain('classic');
    expect(frames(title)).not.toContain('remix');
    expect(rift(title)).toBeDefined();
    // REMIX comes out of the portal's centre, growing and unwinding into the stamp's place.
    const out0 = emergePose(BACK.emergeFrom, false)!;
    expect(out0.x).toBe(PORTAL.x);
    expect(out0.y).toBe(PORTAL.y);
    expect(out0.sx).toBeLessThan(0.05);
    expect(Math.abs(out0.angle)).toBeGreaterThan(Math.PI);
    while (clock(title) < BACK.emergeFrom + 10) s.h.step();
    expect(frames(title)).toContain('remix');
    expect(frames(title)).not.toContain('classic');
    expect(s.sfx).not.toContain('stamp');
    // At rest on the arrival: exactly the finished title's stamp, no jump.
    expect(emergePose(BACK.slam, false)).toEqual({ x: 206, y: 76, angle: -0, sx: 1, sy: 1, alpha: 1 });
    while (clock(title) < BACK.slam) s.h.step();
    expect(BACK.slam / 60).toBeGreaterThan(1);
    expect(BACK.slam / 60).toBeLessThan(1.6);
    expect(sprite(title, 'remix')).toMatchObject({ x: 160, y: 54 });
    expect(frames(title)).not.toContain('classic');
    expect(title.shake()).toBe(0); // it comes out, it does not slam down
    expect(s.sfx.filter((x) => x === 'stamp')).toEqual(['stamp']);
    // The portal closes behind it, then the finished title.
    expect(rift(title)).toBeDefined();
    while (clock(title) < BACK.end) {
      for (const no of ['dust-0', 'dust-1', 'dust-2', 'remix-2x']) expect(frames(title)).not.toContain(no);
      s.h.step();
    }
    expect(rift(title)).toBeUndefined();
    expect(title.phase).toBe('ready');
    expect(sprite(title, 'remix')).toMatchObject({ x: 160, y: 54 });
  });

  it('the portal: open by stages, a gulp as CLASSIC goes in, closed by the end', () => {
    expect(portalStage(0, false)).toBe(1);
    expect(portalStage(BACK.openStep * PORTAL.stage, false)).toBe(PORTAL.stage);
    expect(portalStage(BACK.suckTo, false)).toBe(PORTAL.stage - 1);
    expect(portalStage(BACK.suckTo, true)).toBe(PORTAL.stage); // no gulp with Reduce flashing
    expect(portalStage(BACK.emergeFrom, false)).toBe(PORTAL.stage);
    expect(portalStage(BACK.end - 1, false)).toBeGreaterThan(0);
    expect(portalStage(BACK.end, false)).toBe(0);
  });

  it('the speaker is hidden and cannot be tapped during the break; the CLASSIC title is let go on the slam', () => {
    const s = setup();
    const { title } = back(s);
    const box = title.speakerBox;
    const at = [box.x + box.w / 2, box.y + box.h / 2] as const;
    expect(title.speakerShown).toBe(false);
    expect(title.tapAt(...at)).toBe(false);
    expect(draw(title).sprites.length).toBeGreaterThan(0);
    const held = () => (title as unknown as { classic: unknown }).classic;
    expect(held()).not.toBeNull();
    while (clock(title) < BACK.slam) s.h.step();
    expect(held()).toBeNull();
    expect(title.speakerShown).toBe(true);
    expect(title.tapAt(...at)).toBe(true);
    s.h.idle(5); // still drawn without it
    expect(frames(title)).toContain('remix');
  });

  it('a skip during the break lets the CLASSIC title go too', () => {
    const s = setup();
    const { title } = back(s);
    s.h.step();
    s.h.step(['jump']);
    expect((title as unknown as { classic: unknown }).classic).toBeNull();
  });

  it('no full title reload: the logo is in place and the heroes already stand (no walk-in)', () => {
    const s = setup();
    const { title } = back(s);
    const actors = (title as unknown as { actors: { x: number; walking: boolean; slot: { x: number } }[] })
      .actors;
    expect(actors.length).toBeGreaterThan(0);
    for (const a of actors) {
      expect(a.walking).toBe(false);
      expect(a.x).toBe(a.slot.x);
    }
    while (clock(title) < BACK.slam) s.h.step();
    const sp = draw(title).sprites;
    // CROSSOVER at rest from the slam on (no drop).
    const cross = sp.filter((x) => x.frame.startsWith('cross-'));
    expect(cross).toHaveLength(9);
    for (const c of cross) expect(Math.abs(c.y - 30)).toBeLessThanOrEqual(2);
  });

  it('the music: the overworld cut as the way back starts, the theme in as REMIX lands, from its loop point', () => {
    const s = setup();
    const { title } = back(s);
    expect(s.music).toEqual(['fade 0.05']);
    while (clock(title) < BACK.slam - 1) s.h.step();
    expect(frames(title)).toContain('remix'); // REMIX is coming out in silence
    expect(s.music).toEqual(['fade 0.05']);
    s.h.step();
    expect(s.music).toEqual(['fade 0.05', 'title@loop']);
    expect(s.sfx.filter((x) => x === 'stamp')).toEqual(['stamp']);
    s.h.idle(120);
    expect(s.music).toEqual(['fade 0.05', 'title@loop']);
    expect(s.sfx.filter((x) => x === 'stamp')).toEqual(['stamp']);
  });

  it('a press during the break skips to the finished title, with its slam (once)', () => {
    const s = setup();
    const { title } = back(s);
    s.h.step();
    s.h.step(['jump']);
    expect(title.phase).toBe('ready');
    expect(s.music.at(-1)).toBe('title@loop');
    expect(s.sfx.filter((x) => x === 'stamp')).toEqual(['stamp']);
    s.h.idle(60);
    expect(s.sfx.filter((x) => x === 'stamp')).toEqual(['stamp']);
    expect(s.h.top()).toBe(title); // the skip chose nothing
  });

  it('a press late in the way back (the menu long since live) skips and still chooses nothing', () => {
    for (const key of ['jump', 'start', 'attack'] as const) {
      const s = setup();
      const { title } = back(s);
      s.h.idle(BACK.emergeFrom);
      s.h.step([key]);
      expect(title.phase, key).toBe('ready');
      s.h.idle(10);
      expect(s.h.top(), key).toBe(title);
      expect(s.sfx, key).not.toContain('coin');
      expect(frames(title), key).toContain('remix');
      expect(rift(title), key).toBeUndefined();
    }
  });

  it('with Reduce flashing: the same way back, calm (steady colours, no spin, no shake, no dust)', () => {
    const s = setup(true);
    const { title } = back(s);
    // The music as without it: cut now, the theme as REMIX lands.
    expect(s.music).toEqual(['fade 0.05']);
    const palettes = new Set<string>();
    let sawClassicGo = false;
    let sawRemixCome = false;
    while (clock(title) < BACK.end) {
      const f = frames(title);
      const rk = rift(title)?.key;
      if (rk) palettes.add(rk);
      if (clock(title) > BACK.suckFrom && f.includes('classic')) sawClassicGo = true;
      if (clock(title) < BACK.slam && f.includes('remix')) sawRemixCome = true;
      for (const no of ['classic-squash', 'remix-2x', 'brick-bit', 'dust-0', 'dust-1', 'dust-2'])
        expect(f, `frame ${clock(title)}`).not.toContain(no);
      expect(title.shake()).toBe(0);
      expect(title.rimPhase()).toBe(0);
      const t = clock(title);
      // Nothing turns; CLASSIC fades as it shrinks, REMIX fades in as it grows, never past full size.
      expect(suckPose(t, true)?.angle ?? 0).toBe(0);
      expect(emergePose(t, true)?.angle ?? 0).toBe(0);
      expect(emergePose(t, true)?.sx ?? 0).toBeLessThanOrEqual(1);
      if (t === BACK.slam - 1) expect(s.music).toEqual(['fade 0.05']);
      s.h.step();
    }
    expect(sawClassicGo).toBe(true);
    expect(sawRemixCome).toBe(true);
    expect(palettes.size).toBe(1); // the portal's colours never cycle
    expect(s.music).toEqual(['fade 0.05', 'title@loop']);
    expect(s.sfx.filter((x) => x === 'stamp')).toEqual(['stamp']);
    expect(suckPose(BACK.suckTo - 2, true)!.alpha).toBeLessThan(0.5);
    expect(emergePose(BACK.emergeFrom, true)!.alpha).toBe(0);
    expect(title.phase).toBe('ready');
    expect(sprite(title, 'remix')).toMatchObject({ x: 160, y: 54 });
  });

  it('72: with Reduce flashing, no dust sparkles on any frame of the way back, the first included', () => {
    const s = setup(true);
    const { title } = back(s);
    for (let i = 0; i <= BACK.end + 4; i++) {
      expect(
        frames(title).filter((f) => f.startsWith('dust-')),
        `frame ${clock(title)}`,
      ).toEqual([]);
      s.h.step();
    }
  });

  it("BACK during CLASSIC's fall: nothing was hit, so no break; the finished title, its theme back up", () => {
    const s = setup();
    s.h.game.showTitle();
    s.h.idle(TITLE_TIMING.dropEnd + 2);
    s.h.game.showClassicTitle();
    s.h.idle(4);
    const classic = s.h.top() as ClassicTitleScene;
    expect(classic.smashPhase()).toBe('drop');
    s.music.length = 0;
    s.sfx.length = 0;
    s.h.step(['attack']);
    const title = s.h.top() as TitleScene;
    expect(title).toBeInstanceOf(TitleScene);
    expect(title.phase).toBe('ready');
    expect(s.music).toEqual(['title']); // the same song: it comes back up, never restarted
    const actors = (title as unknown as { actors: { x: number; walking: boolean; slot: { x: number } }[] })
      .actors;
    for (const a of actors) expect(a.walking || a.x !== a.slot.x).toBe(false);
    for (let i = 0; i < 40; i++) {
      const f = frames(title);
      expect(f).toContain('remix');
      for (const no of ['classic', 'classic-squash', 'remix-2x', 'brick-bit', 'dust-0'])
        expect(f).not.toContain(no);
      expect(title.shake()).toBe(0);
      s.h.step();
    }
    expect(s.sfx).not.toContain('stamp');
    expect(s.music).toEqual(['title']);
  });

  it('with Reduce flashing, BACK while the theme is still crossing over: the finished title at once', () => {
    const s = setup(true);
    // A sink that crossfades: the overworld comes in 0.4 s after CLASSIC opens.
    s.h.game.ctx.audio.crossfadeMusic = (id) => (s.music.push(`cross ${id}`), 0.4);
    s.h.game.showTitle();
    s.h.idle(TITLE_TIMING.dropEnd + 2);
    s.h.game.showClassicTitle();
    expect(s.music.at(-1)).toBe('cross overworld');
    s.h.idle(4);
    s.music.length = 0;
    s.sfx.length = 0;
    s.h.step(['attack']);
    const title = s.h.top() as TitleScene;
    expect(title).toBeInstanceOf(TitleScene);
    expect(title.phase).toBe('ready');
    // From its loop point: brought back up if still current, never its fanfare (the crossfade
    // runs on the clock and may already have handed over to the overworld).
    expect(s.music).toEqual(['title@loop']);
    for (let i = 0; i < 20; i++) {
      expect(rift(title)).toBeUndefined();
      expect(frames(title)).not.toContain('classic');
      expect(frames(title).filter((f) => f.startsWith('dust-'))).toEqual([]);
      s.h.step();
    }
  });

  it("with Reduce flashing, the Start box's Back inside the crossfade takes the same shortcut", () => {
    const s = setup(true);
    s.h.game.ctx.audio.crossfadeMusic = (id) => (s.music.push(`cross ${id}`), 0.4);
    s.h.game.showTitle();
    s.h.idle(TITLE_TIMING.dropEnd + 2);
    s.h.game.showClassicTitle();
    const classic = s.h.top() as ClassicTitleScene;
    s.h.idle(2);
    s.h.step(['jump']); // the Start box
    s.h.step();
    expect(classic.phase).toBe('start');
    // Up to its Back row (it wraps from the first), and OK, all inside the 0.4 s crossfade.
    s.h.step(['up']);
    s.h.step();
    s.music.length = 0;
    s.h.step(['jump']);
    const title = s.h.top() as TitleScene;
    expect(title).toBeInstanceOf(TitleScene);
    expect(title.phase).toBe('ready');
    expect(s.music).toEqual(['title@loop']);
    expect(rift(title)).toBeUndefined();
  });

  it("the Start box's Back after the crossfade: the calm way back through the portal", () => {
    const s = setup(true);
    s.h.game.ctx.audio.crossfadeMusic = (id) => (s.music.push(`cross ${id}`), 0.4);
    s.h.game.showTitle();
    s.h.idle(TITLE_TIMING.dropEnd + 2);
    s.h.game.showClassicTitle();
    s.h.idle(40);
    s.h.step(['jump']);
    s.h.idle(10); // the box open
    for (let i = 0; i < 6 && !(s.h.said.at(-1) ?? '').startsWith('Back'); i++) {
      s.h.step(['up']);
      s.h.step();
    }
    expect(s.h.said.at(-1)).toMatch(/^Back/);
    s.h.step(['jump']);
    const title = s.h.top() as TitleScene;
    expect(title).toBeInstanceOf(TitleScene);
    expect(title.phase).toBe('back');
    expect(rift(title)).toBeDefined();
  });

  it('a press after REMIX has landed, while the portal closes, is swallowed too', () => {
    const s = setup();
    const { title } = back(s);
    while (clock(title) < BACK.slam + 5) s.h.step();
    expect(clock(title)).toBeLessThan(BACK.end);
    expect(title.phase).toBe('back');
    s.h.step(['jump']);
    expect(title.phase).toBe('ready');
    s.h.idle(10);
    expect(s.h.top()).toBe(title);
    expect(s.sfx).not.toContain('coin');
  });

  it('the first launch (the rift intro, the full fanfare) and the plain title are as they were', () => {
    const s = setup();
    s.h.game.showTitle();
    const title = s.h.top() as TitleScene;
    expect(title.phase).toBe('drop');
    s.h.idle(TITLE_TIMING.dropEnd);
    expect(s.music.at(-1)).toBe('title');
    expect(s.music.some((m) => m.endsWith('@loop'))).toBe(false);
  });
});

describe('the REMIX field: 1-1 first screen, still (0.4.72)', () => {
  it("draws 1-1's own scenery on its first screen, where the level has it, standing still", () => {
    const s = setup();
    s.h.game.showTitle();
    s.h.idle(TITLE_TIMING.dropEnd + 2);
    const title = s.h.top() as TitleScene;
    const decor = (t: TitleScene) => draw(t).sprites.filter((x) => x.key.startsWith('decor'));
    const first = getLevel('1-1').decor.filter((d) => d.x < 16);
    const now = decor(title);
    expect(now.map((d) => d.frame)).toEqual(first.map((d) => d.kind));
    expect(now[0]).toMatchObject({ frame: 'hill-big', x: 0, y: 160 });
    s.h.idle(500);
    expect(decor(title)).toEqual(now);
  });

  it('a scrolled demo (12 s on CLASSIC): the way back plays over the still 1-1 field, never the demo, so the slam does not cut', () => {
    const s = setup();
    const { title, classic } = back(s, 12 * 60);
    expect(classic.demo.world.camera.pxX).toBeGreaterThan(256); // pipes and goombas on screen there
    // The same way back from an unscrolled demo draws exactly the same frames.
    const u = setup();
    const plain = back(u, 0).title;
    const field = (t: TitleScene) =>
      draw(t)
        .sprites.filter((x) => x.key.startsWith('decor') || x.frame === 'ground')
        .map((x) => `${x.frame}@${x.x},${x.y - t.shake()}`);
    const still = field(title);
    expect(still).toContain('hill-big@0,160');
    while (clock(title) <= BACK.slam + 4) {
      expect(draw(title).sprites, `frame ${clock(title)}`).toEqual(draw(plain).sprites);
      expect(field(title), `frame ${clock(title)}`).toEqual(still);
      s.h.step();
      u.h.step();
    }
  });
});
