import { describe, expect, it } from 'vitest';
import type { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO, type AudioSink } from '@engine/audio/audio-manager';
import { NO_INPUT } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import { px, tileToSub, toPx } from '@engine/math/units';
import { sfx as SFX_LIB } from '@content/sfx/sfx';
import { DEFAULT_ASSIST, newGameState } from '../context';
import type { CharacterDef } from '../characters/character';
import { MARIO } from '../characters/mario';
import { MEGAMAN } from '../characters/megaman';
import { SAMUS } from '../characters/samus';
import { SIMON } from '../characters/simon';
import { RYU } from '../characters/ryu';
import { parseTextMap } from '../level/textmap';
import {
  DEATH_FRAMES,
  DEATH_SFX,
  DEATH_STYLES,
  EXPLODE_FLASH,
  ORB_HOLD,
  ORBS_PER_RING,
  orbPositions,
  piecePositions,
  type DeathStyle,
} from './death-style';
import { World, type WorldStart } from './world';

/*
 * WorldStart.deathStyle: Mario's hop stays the default and unchanged; the mini games' own NES
 * deaths (orbs, explode, collapse, ninja) each make their own sound instead of the `death`
 * jingle, play their own motion and raise `died` at the end of it.
 */

const STUB_ASSETS = {
  sheet: () => ({ id: 'stub', image: null, frames: new Map() }),
  has: () => false,
} as unknown as AssetRegistry;

function recordingAudio() {
  const log = { music: [] as string[], sfx: [] as string[], jingles: [] as string[], stops: 0 };
  const audio: AudioSink = {
    ...NULL_AUDIO,
    playMusic: (id) => void log.music.push(id),
    stopMusic: () => void log.stops++,
    playJingle: (id) => void log.jingles.push(id),
    sfx: (id) => void log.sfx.push(id),
  };
  return { audio, log };
}

/** A flat room: floor on rows 13-14, a pit at columns 20-22, the hero at column 8. */
const ROOM = (() => {
  const rows: string[] = [];
  for (let y = 0; y < 15; y++) {
    let row = '';
    for (let x = 0; x < 32; x++) row += y >= 13 && (x < 20 || x > 22) ? '#' : '.';
    rows.push(row);
  }
  return parseTextMap(['id: t', 'theme: castle', 'start: 8,12', '[tiles]', ...rows].join('\n'), 't');
})();

function world(def: CharacterDef, start: WorldStart = {}, reduceFlashing = true) {
  const { audio, log } = recordingAudio();
  const ctx = { assets: STUB_ASSETS, audio, assist: { ...DEFAULT_ASSIST }, reduceFlashing };
  const w = new World(ROOM, ctx, newGameState(def), { seed: 1, ...start });
  w.time = null;
  // Settle onto the floor.
  for (let i = 0; i < 4; i++) w.update([NO_INPUT]);
  return { w, log, p: w.player };
}

/** Frames (after the kill) until `died` is raised; Infinity if it never is within `max`. */
function framesToDied(w: World, max = 400): number {
  for (let i = 1; i <= max; i++) {
    w.update([NO_INPUT]);
    if (w.events.splice(0).some((e) => e.type === 'died')) return i;
  }
  return Infinity;
}

/** A renderer that records what was drawn. */
function recorder() {
  const calls = { sprites: [] as string[], rects: 0 };
  const r = {
    clear() {},
    rect() {
      calls.rects++;
    },
    sprite(_s: unknown, frame: string) {
      calls.sprites.push(frame);
    },
    text() {},
    debugText() {},
    line() {},
  } as unknown as Renderer;
  return { r, calls };
}

const HERO: Record<Exclude<DeathStyle, 'hop'>, CharacterDef> = {
  orbs: MEGAMAN,
  explode: SAMUS,
  collapse: SIMON,
  ninja: RYU,
};

describe('World death styles', () => {
  it("the default is Mario's hop, unchanged: the `death` jingle, the hop, `died` 200 frames on", () => {
    const { w, log, p } = world(MARIO);
    expect(w.deathStyle).toBe('hop');
    const y0 = p.body.y;
    w.kill(p);
    expect(log.jingles).toEqual(['death']);
    expect(log.sfx).toEqual([]);
    let top = y0;
    for (let i = 0; i < 60; i++) {
      w.update([NO_INPUT]);
      top = Math.min(top, p.body.y);
    }
    expect(top).toBeLessThan(y0 - px(16)); // the hop
    expect(framesToDied(w)).toBe(DEATH_FRAMES.hop - 60);
  });

  it('every other style makes its own sound, stops the music, plays no jingle and raises `died` on time', () => {
    for (const style of DEATH_STYLES) {
      if (style === 'hop') continue;
      const { w, log, p } = world(HERO[style], { deathStyle: style });
      w.kill(p);
      expect(log.jingles, style).toEqual([]);
      expect(log.sfx, style).toEqual([DEATH_SFX[style]]);
      expect(log.stops, style).toBe(1);
      expect(framesToDied(w), style).toBe(DEATH_FRAMES[style]);
    }
  });

  it('every death sound exists in the sound library; deathSfx overrides one', () => {
    for (const id of Object.values(DEATH_SFX))
      expect(
        SFX_LIB.some((s) => s.id === id),
        id,
      ).toBe(true);
    const { w, log, p } = world(SIMON, { deathStyle: 'collapse', deathSfx: 'hit' });
    w.kill(p);
    expect(log.sfx).toEqual(['hit']);
  });

  it('orbs: a short freeze in the hurt pose, then two rings of orbs fly out and he is gone', () => {
    const { w, p } = world(MEGAMAN, { deathStyle: 'orbs' });
    const x0 = p.body.x;
    w.kill(p);
    expect(orbPositions(p, ORB_HOLD)).toEqual([]);
    const later = orbPositions(p, ORB_HOLD + 10);
    expect(later).toHaveLength(2 * ORBS_PER_RING);
    const cx = toPx(p.body.x + (p.body.w >> 1));
    // The outer ring at 2 px a frame, the inner at 1.
    expect(Math.max(...later.map((o) => o.x - cx))).toBe(20);
    expect(later.some((o) => o.x - cx === 10)).toBe(true);
    // Drawn: the hero during the freeze, then only orbs (rects on the stub sheet, no hero sprite).
    let rec = recorder();
    w.update([NO_INPUT]);
    w.render(rec.r);
    expect(rec.calls.sprites).toContain('hurt');
    for (let i = 0; i < ORB_HOLD + 5; i++) w.update([NO_INPUT]);
    rec = recorder();
    w.render(rec.r);
    expect(rec.calls.sprites).not.toContain('hurt');
    expect(rec.calls.rects).toBeGreaterThanOrEqual(2 * ORBS_PER_RING);
    expect(p.body.x).toBe(x0); // he did not move
  });

  it('explode: she flashes (steady with reduce flashing), then her pieces fly apart and fall', () => {
    const flashing = world(SAMUS, { deathStyle: 'explode' }, false);
    flashing.w.kill(flashing.p);
    const shown: boolean[] = [];
    for (let i = 0; i < 8; i++) {
      flashing.w.update([NO_INPUT]);
      const rec = recorder();
      flashing.w.render(rec.r);
      shown.push(rec.calls.sprites.includes('die'));
    }
    expect(shown).toContain(true);
    expect(shown).toContain(false);
    const steady = world(SAMUS, { deathStyle: 'explode' }, true);
    steady.w.kill(steady.p);
    for (let i = 0; i < 8; i++) {
      steady.w.update([NO_INPUT]);
      const rec = recorder();
      steady.w.render(rec.r);
      expect(rec.calls.sprites).toContain('die');
    }
    expect(piecePositions(steady.p, EXPLODE_FLASH)).toEqual([]);
    const a = piecePositions(steady.p, EXPLODE_FLASH + 10);
    const b = piecePositions(steady.p, EXPLODE_FLASH + 40);
    expect(a.length).toBeGreaterThan(6);
    // They spread out, and gravity pulls them down in the end.
    const spread = (ps: { x: number }[]) => Math.max(...ps.map((q) => q.x)) - Math.min(...ps.map((q) => q.x));
    expect(spread(b)).toBeGreaterThan(spread(a));
    expect(Math.max(...b.map((q) => q.y))).toBeGreaterThan(Math.max(...a.map((q) => q.y)));
  });

  it('collapse: no hop; from the air he drops to the floor and lies there', () => {
    const { w, p } = world(SIMON, { deathStyle: 'collapse' });
    p.body.y -= px(40);
    p.body.vy = -0x02000; // a knockback's upward push
    p.body.onGround = false;
    const y0 = p.body.y;
    w.kill(p);
    let top = y0;
    for (let i = 0; i < 80; i++) {
      w.update([NO_INPUT]);
      top = Math.min(top, p.body.y);
    }
    expect(top).toBe(y0);
    expect(p.body.onGround).toBe(true);
    expect(p.body.y + p.body.h).toBe(tileToSub(13));
    expect(p.scratch.deathT).toBe(80);
    expect(w.deathTime(p)).toBe(80);
  });

  it('ninja: thrown up and back (away from where he faces), then he lands and lies there', () => {
    const { w, p } = world(RYU, { deathStyle: 'ninja' });
    p.facing = 1;
    const x0 = p.body.x;
    const y0 = p.body.y;
    w.kill(p);
    let top = y0;
    for (let i = 0; i < 90; i++) {
      w.update([NO_INPUT]);
      top = Math.min(top, p.body.y);
    }
    expect(top).toBeLessThan(y0 - px(8));
    expect(p.body.x).toBeLessThan(x0);
    expect(p.body.onGround).toBe(true);
    expect(p.body.y).toBe(y0);
  });

  it('a pit death draws no orbs and no pieces', () => {
    for (const style of ['orbs', 'explode'] as const) {
      const { w, p } = world(HERO[style], { deathStyle: style });
      p.body.y = px(260);
      w.kill(p);
      for (let i = 0; i < 70; i++) w.update([NO_INPUT]);
      const rec = recorder();
      w.render(rec.r);
      // No hero, no orbs, no pieces.
      expect(rec.calls.sprites.filter((f) => ['death-orb', 'hurt', 'die'].includes(f))).toEqual([]);
      expect(rec.calls.rects).toBe(0);
    }
  });
});
