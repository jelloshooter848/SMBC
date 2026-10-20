import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { World, type WorldEvent } from '@game/world/world';
import { burstPieces } from '@game/world/death-style';
import { ScriptedInput } from '@game/sim/headless';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO, type AudioSink } from '@engine/audio/audio-manager';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import type { CharacterDef } from '@game/characters/character';
import { SAMUS_CLASSIC } from '@game/characters/samus/classic';
import { DARKPIT_CLASSIC, PIT_CLASSIC } from '@game/characters/pit/classic';
import { px } from '@engine/math/units';

// 0.5.0 QA: Pit and Dark Pit are the original's Samus skins, so they die as she does (SA-C32): her
// six-piece burst (in their own colours) and her death jingle; no pieces after a pit.

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

function die(def: CharacterDef, pit = false) {
  const jingles: string[] = [];
  const audio: AudioSink = { ...NULL_AUDIO, playJingle: (id) => void jingles.push(id) };
  const world = new World(
    level(),
    {
      assets: new AssetRegistry({ default: {} }),
      audio,
      assist: { ...DEFAULT_ASSIST },
      reduceFlashing: false,
      rules: 'classic',
    },
    newGameState(def, null, 'classic'),
  );
  const p = world.player;
  if (pit) p.body.y = px(world.heightPx + 20);
  world.kill(p);
  const input = new ScriptedInput({ steps: [] });
  let diedAt = -1;
  const events: WorldEvent[] = [];
  for (let f = 1; f <= 400 && diedAt < 0; f++) {
    input.next();
    world.update([input]);
    events.push(...world.events.splice(0));
    if (events.some((e) => e.type === 'died')) diedAt = f;
  }
  return { jingles, diedAt, p };
}

describe("Pit and Dark Pit die as Samus's looks", () => {
  for (const def of [PIT_CLASSIC, DARKPIT_CLASSIC])
    it(`${def.name}: her six pieces and her jingle; 180 frames, 150 in a pit`, () => {
      expect(def.deathBurst).toBe(SAMUS_CLASSIC.deathBurst);
      const r = die(def);
      expect(r.jingles).toContain('samus-classic-death');
      expect(r.jingles).not.toContain('death');
      expect(r.diedAt).toBe(180);
      expect(
        burstPieces(def.deathBurst as NonNullable<CharacterDef['deathBurst']>, r.p, 10, false),
      ).toHaveLength(6);
      expect(die(def, true).diedAt).toBe(150);
    });
});
