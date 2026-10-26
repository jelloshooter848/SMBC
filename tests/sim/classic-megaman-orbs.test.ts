import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { World, type WorldEvent } from '@game/world/world';
import { burstPieces } from '@game/world/death-style';
import { ScriptedInput } from '@game/sim/headless';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO, type AudioSink } from '@engine/audio/audio-manager';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { MEGAMAN } from '@game/characters/megaman';
import { BASS_CLASSIC } from '@game/characters/bass/classic';
import { CHARACTERS, heroFor } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { megamanOrbsDef } from '@content/sprites/megaman-orbs';
import { px } from '@engine/math/units';

/*
 * G-054: Classic Mega Man and Bass burst into orbs (MegaManBase.initiateNormalDeath,
 * MegaManParticle.as) with his own death sound in place of Mario's jingle; a pit death plays the
 * sound only. Mega Man's look: 12 colour orbs parting after 200 ms; Bass's: 16 white ones at once.
 * Campaign Mega Man keeps the shared death.
 */

const level = () =>
  parseTextMap(
    [
      'id: t',
      'time: 300',
      'start: 8,12',
      '',
      '[tiles]',
      ...Array(13).fill('.'.repeat(32)),
      '#'.repeat(32),
      '#'.repeat(32),
    ].join('\n'),
  );

function die(def: CharacterDef, rules: 'classic' | 'campaign', pit = false) {
  const jingles: string[] = [];
  const sfx: string[] = [];
  let stopped = 0;
  const audio: AudioSink = {
    ...NULL_AUDIO,
    playJingle: (id) => void jingles.push(id),
    sfx: (id) => void sfx.push(id),
    stopMusic: () => void stopped++,
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
    newGameState(def, null, rules),
  );
  const input = new ScriptedInput({ steps: [] });
  const p = world.player;
  if (pit) p.body.y = px(world.heightPx + 20);
  world.kill(p);
  let diedAt = -1;
  const events: WorldEvent[] = [];
  for (let f = 1; f <= 400 && diedAt < 0; f++) {
    input.next();
    world.update([input]);
    events.push(...world.events.splice(0));
    if (events.some((e) => e.type === 'died')) diedAt = f;
  }
  return { world, jingles, sfx, stopped, diedAt, p };
}

describe('G-054 Mega Man and Bass burst into orbs', () => {
  const mm = heroFor(MEGAMAN, 'classic');

  it('Classic Mega Man: 12 orbs, Bass: 16; the Campaign def has none', () => {
    expect(mm.deathBurst?.pieces).toHaveLength(12);
    expect(BASS_CLASSIC.deathBurst?.pieces).toHaveLength(16);
    expect(CHARACTERS.find((c) => c.id === 'megaman')?.deathBurst).toBeUndefined();
    expect(Object.keys(megamanOrbsDef.frames)).toEqual(['orb-0', 'orb-1']);
  });

  it('his own death sound, the music stopped, no jingle; 2.5 seconds', () => {
    const r = die(mm, 'classic');
    expect(r.sfx).toContain('mm-death');
    expect(r.jingles).not.toContain('death');
    expect(r.stopped).toBeGreaterThan(0);
    expect(r.diedAt).toBeGreaterThanOrEqual(150);
  });

  it('a pit death: the sound only, no orbs', () => {
    const r = die(mm, 'classic', true);
    expect(r.sfx).toContain('mm-death');
    expect(r.jingles).not.toContain('death');
  });

  it("Mega Man's orbs hold for 200 ms, then fly straight out; Bass's part at once", () => {
    const { p } = die(mm, 'classic');
    const burst = mm.deathBurst as NonNullable<CharacterDef['deathBurst']>;
    const at = (t: number) => burstPieces(burst, p, t, false);
    expect(at(1).map((o) => o.x)).toEqual(at(12).map((o) => o.x));
    const later = at(40);
    expect(later.some((o, i) => o.x !== at(12)[i]?.x || o.y !== at(12)[i]?.y)).toBe(true);
    // Every orb moves in a straight line: no gravity.
    for (const piece of burst.pieces) expect(piece.gravity).toBe(0);
    const bass = BASS_CLASSIC.deathBurst as NonNullable<CharacterDef['deathBurst']>;
    const b1 = burstPieces(bass, p, 1, false);
    const b2 = burstPieces(bass, p, 2, false);
    expect(b1.some((o, i) => o.x !== b2[i]?.x || o.y !== b2[i]?.y)).toBe(true);
  });

  it('Reduce flashing holds the orbs on one frame', () => {
    const { p } = die(mm, 'classic');
    const burst = mm.deathBurst as NonNullable<CharacterDef['deathBurst']>;
    const frames = new Set(
      [1, 2, 3, 4, 5].flatMap((t) => burstPieces(burst, p, t, true).map((o) => o.frame)),
    );
    expect([...frames]).toEqual(['orb-0']);
  });

  it('Campaign Mega Man keeps the shared death jingle', () => {
    const r = die(MEGAMAN, 'campaign');
    expect(r.jingles).toContain('death');
  });

  it("each look's orbs follow MegaManParticle's colour lists", async () => {
    const v = await import('@game/characters/megaman/classic-variants');
    const pm = await import('@game/characters/protoman/classic');
    const bl = await import('@game/characters/bass/classic-looks');
    const { QUICKMAN_CLASSIC } = await import('@game/characters/bass/classic-quickman');
    const n = (d: CharacterDef) => d.deathBurst?.pieces.length;
    // MEGA_MAN_COLOR_PARTICLE_SKIN_NUM [0, 1, 10, 13..18, 21, 24, 25]: 12 colour orbs.
    for (const d of [
      mm,
      v.ROCK_CLASSIC,
      v.CUTMAN_CLASSIC,
      v.ICEMAN_CLASSIC,
      v.FIREMAN_CLASSIC,
      v.FRANCESCA_CLASSIC,
    ])
      expect(n(d), d.id).toBe(12);
    // The rest: 16 white ones (Proto Man 3-5, Break Man 8, 9, 19, Rokko 11, Doropie 26).
    for (const d of [pm.PROTOMAN_CLASSIC, pm.BREAKMAN_CLASSIC, v.ROKKO_CLASSIC, v.DOROPIE_CLASSIC])
      expect(n(d), d.id).toBe(16);
    // BASS_COLOR_PARTICLE_SKIN_NUM [3, 4, 7, 8]: Dr. Wily and Quick Man; the rest white.
    for (const d of [bl.WILY_CLASSIC, QUICKMAN_CLASSIC]) expect(n(d), d.id).toBe(12);
    for (const d of [
      BASS_CLASSIC,
      bl.MRX_CLASSIC,
      bl.COSSACK_CLASSIC,
      bl.GEMINI_CLASSIC,
      bl.SKULLMAN_CLASSIC,
    ])
      expect(n(d), d.id).toBe(16);
  });
});
