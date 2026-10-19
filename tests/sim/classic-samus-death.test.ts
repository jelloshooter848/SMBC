import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { World } from '@game/world/world';
import { burstPieces } from '@game/world/death-style';
import { ScriptedInput } from '@game/sim/headless';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO, type AudioSink } from '@engine/audio/audio-manager';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { SAMUS } from '@game/characters/samus';
import { SAMUS_CLASSIC } from '@game/characters/samus/classic';
import { CHARACTERS, CLASSIC_CHARACTERS } from '@game/characters/registry';
import { samusClassicDef } from '@content/sprites/samus';
import { songs } from '@content/music/songs';
import { px, toPx } from '@engine/math/units';
import type { WorldEvent } from '@game/world/world';

/*
 * Classic SMBC Samus's death (SA-C32; Samus.as:142-143, 1334-1358, SamusGuts.as): she vanishes,
 * her suit bursts into 6 pieces and her own death jingle plays; the death lasts 180 frames
 * (DIE_TMR_DEL_NORMAL 3000 ms), 150 in a pit (DIE_TMR_DEL_PIT 2500 ms), with no pieces there.
 * Current Samus keeps the shared death.
 */

const level = () =>
  parseTextMap(
    [
      'id: t',
      'time: 300',
      'start: 4,12',
      '',
      '[tiles]',
      ...Array(13).fill('.'.repeat(32)),
      '#'.repeat(32),
      '#'.repeat(32),
    ].join('\n'),
  );

function dieAfter(rules: 'classic' | 'current', pit = false) {
  const jingles: string[] = [];
  const sfx: string[] = [];
  const audio: AudioSink = {
    ...NULL_AUDIO,
    playJingle: (id) => jingles.push(id),
    sfx: (id) => sfx.push(id),
  };
  const world = new World(
    level(),
    {
      assets: new AssetRegistry({ default: {} }),
      audio,
      assist: { ...DEFAULT_ASSIST },
      reduceFlashing: false,
      rules,
    },
    newGameState(SAMUS, null, rules),
  );
  const input = new ScriptedInput({ steps: [] });
  const p = world.player;
  if (pit) p.body.y = px(world.heightPx + 20);
  world.kill(p);
  const y0 = p.body.y;
  const events: WorldEvent[] = [];
  let diedAt = -1;
  for (let f = 1; f <= 400 && diedAt < 0; f++) {
    input.next();
    world.update([input]);
    events.push(...world.events.splice(0));
    if (events.some((e) => e.type === 'died')) diedAt = f;
  }
  return { world, jingles, sfx, diedAt, p, y0 };
}

describe('SA-C32: Classic Samus bursts into six pieces', () => {
  it('the Classic def sets it; no Current def and no other Classic def does', () => {
    expect(SAMUS_CLASSIC.deathBurst?.pieces).toHaveLength(6);
    for (const def of [...CHARACTERS, ...Object.values(CLASSIC_CHARACTERS)])
      if (def !== SAMUS_CLASSIC) expect(def?.deathBurst, def?.id).toBeUndefined();
  });

  it('her own jingle in place of the death jingle; 180 frames, 150 in a pit', () => {
    const d = dieAfter('classic');
    expect(d.jingles).toEqual(['samus-classic-death']);
    expect(d.diedAt).toBe(180);
    const pit = dieAfter('classic', true);
    expect(pit.jingles).toEqual(['samus-classic-death']);
    expect(pit.diedAt).toBe(150);
  });

  it('she stays where she died (no hop) while the pieces fly', () => {
    const d = dieAfter('classic');
    expect(d.p.body.y).toBe(d.y0);
    const cur = dieAfter('current');
    expect(cur.jingles).toEqual(['death']);
    expect(cur.diedAt).not.toBe(180);
  });

  it("the pieces follow SamusGuts' numbers: 3 right, 3 left, top, middle and bottom", () => {
    const d = dieAfter('classic');
    const burst = SAMUS_CLASSIC.deathBurst as NonNullable<typeof SAMUS_CLASSIC.deathBurst>;
    const b = d.p.body;
    const cx = toPx(b.x + (b.w >> 1));
    const feet = toPx(b.y + b.h);
    const t1 = burstPieces(burst, d.p, 1, false);
    expect(t1).toHaveLength(6);
    // Pieces 1-3 right of her centre, 4-6 left; tops start 24 px up, middles 15, bottoms 6.
    expect(t1.slice(0, 3).every((q) => q.x > cx)).toBe(true);
    expect(t1.slice(3).every((q) => q.x < cx)).toBe(true);
    const ups = burst.pieces.map((q) => q.y);
    expect(ups).toEqual([24, 15, 6, 24, 15, 6]);
    // 150 Flash px/s sideways (1.25 px a frame), up at 200 / 200 / 100 Flash px/s.
    expect(burst.pieces[0]?.vx).toBeCloseTo(1.25, 6);
    expect(burst.pieces[3]?.vx).toBeCloseTo(-1.25, 6);
    expect(burst.pieces.map((q) => q.vy * 120)).toEqual(
      [-200, -200, -100, -200, -200, -100].map((v) => expect.closeTo(v, 6)),
    );
    expect(burst.pieces.map((q) => q.gravity * 7200)).toEqual(
      [500, 350, 150, 500, 350, 150].map((v) => expect.closeTo(v, 6)),
    );
    // Gravity first, then the move: after one frame the top piece is up vy + g.
    const top = burst.pieces[0] as (typeof burst.pieces)[0];
    expect(t1[0]?.y).toBeCloseTo(feet - 24 + top.vy + top.gravity, 6);
    // Gone 50 px out (MAX_X_DIST 100 Flash px): 40 frames at 1.25 px.
    expect(burstPieces(burst, d.p, 40, false)).toHaveLength(6);
    expect(burstPieces(burst, d.p, 41, false)).toHaveLength(0);
  });

  it('pieces tumble through two frames, held still with Reduce flashing', () => {
    const d = dieAfter('classic');
    const burst = SAMUS_CLASSIC.deathBurst as NonNullable<typeof SAMUS_CLASSIC.deathBurst>;
    const frames = new Set<string>();
    for (let t = 1; t < 20; t++) for (const q of burstPieces(burst, d.p, t, false)) frames.add(q.frame);
    expect(frames.size).toBe(12);
    const calm = new Set<string>();
    for (let t = 1; t < 20; t++) for (const q of burstPieces(burst, d.p, t, true)) calm.add(q.frame);
    expect([...calm].every((f) => f.endsWith('-0'))).toBe(true);
    // Every frame drawn exists in her Classic sheet as 8x8 text art.
    for (const f of frames) {
      const art = samusClassicDef.frames[f] as string[];
      expect(art, f).toHaveLength(8);
      expect(art.every((row) => row.length === 8)).toBe(true);
    }
  });

  it('the jingle is an MML song in the repo', () => {
    const song = songs.find((s) => s.id === 'samus-classic-death');
    expect(song?.loop).toBe(false);
  });
});
