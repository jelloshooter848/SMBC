import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { CHARACTERS, CLASSIC_EXTRAS } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { SCREEN_W } from '@engine/viewport';
import { px } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { World } from '@game/world/world';

/*
 * Castle names of the Classic-only heroes (BA-M13, PM-19/PM-M8, PI-23/PI-M5): the original's
 * default-skin third names (BmdInfo.as namesArr[2]). They only ever play Classic rules; the
 * campaign roster has no such heroes and keeps the shared line.
 */

const EXTRA_NAMES: Record<string, string> = {
  bass: 'Dr. Wily',
  protoman: 'Roll',
  breakman: 'Roll',
  pit: 'Palutena',
  darkpit: 'the Reaper',
};

const W = 48;
const castle = (): LevelData =>
  parseTextMap(
    [
      'id: t',
      'theme: castle',
      'time: 300',
      'start: 25,11',
      '',
      '[tiles]',
      ...Array.from({ length: 11 }, () => '.'.repeat(W)),
      '.'.repeat(28) + '###' + '.'.repeat(W - 31),
      '.'.repeat(16) + '-'.repeat(12) + '###' + '.'.repeat(W - 31),
      '#'.repeat(16) + '~'.repeat(12) + '#'.repeat(W - 28),
      '#'.repeat(16) + '.'.repeat(12) + '#'.repeat(W - 28),
      '',
      '[entities]',
      'bowser 20 11',
      'axe 28 10',
      'toad 40 12',
      '',
      '[zones]',
      'exit 39 next=2-1',
    ].join('\n'),
  );

function place(w: World): void {
  const b = w.player.body;
  b.x = px(28 * 16 + 2);
  b.y = px(11 * 16) - b.h;
  b.vx = 0;
  b.vy = 0;
  w.camera.snapTo(b.x);
}

function castleNews(character: CharacterDef, rules: 'classic' | 'current') {
  const r = runSim({
    level: castle(),
    character,
    rules,
    script: { steps: [{ frame: 0, hold: [] }] },
    maxFrames: 3000,
    assist: { invulnerable: true },
    castleOk: false,
    controller: (w, f) => {
      if (f === 0) place(w);
      return [];
    },
  });
  const say = r.events.filter((e) => e.type === 'say').map((e) => (e as { text: string }).text);
  return { text: r.world.castleText, say };
}

const BUILT = CLASSIC_EXTRAS.filter((d) => d.id in EXTRA_NAMES);

describe('Classic-only heroes: castle text names their rescue', () => {
  it('each named extra is built and carries its name', () => {
    expect(BUILT.map((d) => d.id).sort()).toEqual(Object.keys(EXTRA_NAMES).sort());
    for (const def of BUILT) expect(def.rescueName, def.id).toBe(EXTRA_NAMES[def.id]);
  });

  it.each(BUILT.map((d) => [d.id, d] as const))('%s: Classic names the rescue', (id, def) => {
    const classic = castleNews(def, 'classic');
    const name = (EXTRA_NAMES[id] as string).toUpperCase();
    expect(classic.text.slice(1)).toEqual(['', `BUT ${name} IS IN`, 'ANOTHER CASTLE!']);
    expect(classic.say).toHaveLength(1);
    expect(classic.say[0]).toContain(`BUT ${name} IS IN ANOTHER CASTLE!`);
    for (const line of classic.text) expect(line.length * 8, line).toBeLessThanOrEqual(SCREEN_W - 32);
  });

  it('Current is unaffected: no campaign hero carries a name and the line stays shared', () => {
    for (const def of CHARACTERS) expect(def.rescueName, def.id).toBeUndefined();
    for (const def of CHARACTERS.slice(0, 2)) {
      const current = castleNews(def, 'current');
      expect(current.text.slice(1)).toEqual(['', 'BUT OUR PRINCESS IS IN', 'ANOTHER CASTLE!']);
    }
  });
});
