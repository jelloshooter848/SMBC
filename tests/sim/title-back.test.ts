import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { NULL_AUDIO, type AudioSink } from '@engine/audio/audio-manager';
import { BACK, TitleScene } from '@game/scenes/title';
import { ClassicTitleScene, SMASH } from '@game/scenes/original-title';
import { TITLE_TIMING } from '@game/scenes/title-anim';
import { draw, makeGame, useStorage } from './heroes-harness';
import { DEFAULT_ASSIST } from '@game/context';

// 0.4.72 (owner, back transition option A): CLASSIC to REMIX. CLASSIC squashes, breaks into its
// letters over the CLASSIC title's still frame, then the REMIX stamp pops and slams on, in about
// 0.3 s; the heroes are already standing. Reduce flashing: an instant swap. The music: the
// overworld cut under the shatter, the theme in on the slam from its loop point.

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

describe('the way back from CLASSIC (option A)', () => {
  it('breaks CLASSIC into its letters over the still frame, pops the stamp, slams in about 0.3 s', () => {
    const s = setup();
    const { title, classic } = back(s);
    expect(title.phase).toBe('back');
    const demoT = classic.demo.t;
    // The squash, then seven pieces (one a letter) with a chip each, the CLASSIC frame held still.
    expect(frames(title)).toContain('classic-squash');
    s.h.idle(BACK.squash);
    // The break's first frame: the seven pieces, their chips not yet out (not on the letters' feet).
    const cracked = frames(title);
    expect(cracked.filter((f) => f === 'classic')).toHaveLength(7);
    expect(cracked).not.toContain('brick-bit');
    s.h.step();
    const broken = frames(title);
    expect(broken.filter((f) => f === 'classic')).toHaveLength(7);
    expect(broken.filter((f) => f === 'brick-bit')).toHaveLength(7);
    expect(broken).not.toContain('remix');
    expect(classic.demo.t).toBe(demoT); // the demo no longer runs: a still frame
    // The pieces hop up, then fall.
    const y0 = title.classicPieces(0, 173)[0]!.y;
    expect(title.classicPieces(3, 173)[0]!.y).toBeLessThan(y0);
    expect(title.classicPieces(12, 173)[0]!.y).toBeGreaterThan(y0);
    // The stamp's big frame just before it lands.
    while (clock(title) < BACK.slam - TITLE_TIMING.stampPop) s.h.step();
    expect(frames(title)).toContain('remix-2x');
    expect(s.sfx).not.toContain('stamp');
    // The slam, about 0.27 s in: the REMIX title, the shake.
    while (clock(title) < BACK.slam) s.h.step();
    expect(BACK.slam / 60).toBeGreaterThan(0.2);
    expect(BACK.slam / 60).toBeLessThan(0.35);
    const slam = frames(title);
    expect(slam).toContain('remix');
    expect(slam).not.toContain('classic');
    expect(title.shake()).not.toBe(0);
    expect(s.sfx.filter((x) => x === 'stamp')).toEqual(['stamp']);
    s.h.idle(TITLE_TIMING.dustFrames);
    expect(title.phase).toBe('ready');
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

  it('the music: the overworld cut under the shatter, the theme in on the slam from its loop point', () => {
    const s = setup();
    const { title } = back(s);
    expect(s.music).toEqual(['fade 0.05']);
    while (clock(title) < BACK.slam - 1) s.h.step();
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

  it('with Reduce flashing: an instant swap, no break, no pop, no shake', () => {
    const s = setup(true);
    const { title } = back(s);
    // The music and the thud at once.
    expect(s.music).toEqual(['fade 0.05', 'title@loop']);
    expect(s.sfx.filter((x) => x === 'stamp')).toEqual(['stamp']);
    for (let i = 0; i < 40; i++) {
      const f = frames(title);
      expect(f).toContain('remix');
      for (const no of ['classic', 'classic-squash', 'remix-2x', 'brick-bit']) expect(f).not.toContain(no);
      expect(title.shake()).toBe(0);
      s.h.step();
    }
    expect(title.phase).toBe('ready');
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

  it('a scrolled demo: the break shows its frame; the slam frame cuts to the field, under the shake', () => {
    const s = setup();
    const { title, classic } = back(s, 500);
    expect(classic.demo.world.camera.pxX).toBeGreaterThan(0);
    const broken = draw(title).sprites.filter((x) => x.frame === 'hill-big');
    expect(broken.some((x) => x.x === 0 && x.y === 160)).toBe(false);
    while (clock(title) < BACK.slam) s.h.step();
    const slam = draw(title).sprites.filter((x) => x.frame === 'hill-big');
    expect(title.shake()).not.toBe(0);
    expect(slam.some((x) => x.x === 0 && x.y === 160 + title.shake())).toBe(true);
  });
});
