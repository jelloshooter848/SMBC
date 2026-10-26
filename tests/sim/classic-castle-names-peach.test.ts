import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { CLASSIC_EXTRAS } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { SCREEN_W } from '@engine/viewport';
import { px } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { World } from '@game/world/world';

/*
 * Castle names of Peach and Arthur (the release review): Peach's original skins name the Subcon;
 * Arthur was never in the original, so he keeps the shared line. Built like
 * classic-castle-names-extras.test.ts. Castle names of the Classic-only heroes (BA-M13, PM-19/PM-M8, PI-23/PI-M5): the original's
 * default-skin third names (BmdInfo.as namesArr[2]). They only ever play Classic rules; the
 * campaign roster has no such heroes and keeps the shared line.
 */

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

function castleNews(character: CharacterDef, rules: 'classic' | 'campaign') {
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

const find = (id: string): CharacterDef => {
  const def = CLASSIC_EXTRAS.find((d) => d.id === id);
  expect(def, id).toBeDefined();
  return def as CharacterDef;
};

describe('Peach and Arthur: castle text', () => {
  it('Peach: Classic names the Subcon', () => {
    const def = find('peach');
    expect(def.rescueName).toBe('the Subcon');
    const classic = castleNews(def, 'classic');
    expect(classic.text.slice(1)).toEqual(['', 'BUT THE SUBCON IS IN', 'ANOTHER CASTLE!']);
    expect(classic.say).toHaveLength(1);
    expect(classic.say[0]).toContain('BUT THE SUBCON IS IN ANOTHER CASTLE!');
    for (const line of classic.text) expect(line.length * 8, line).toBeLessThanOrEqual(SCREEN_W - 32);
  });

  it('Arthur has no rescue name: the castle keeps the shared line', () => {
    const def = find('arthur');
    expect(def.rescueName).toBeUndefined();
    const classic = castleNews(def, 'classic');
    expect(classic.text.slice(1)).toEqual(['', 'BUT OUR PRINCESS IS IN', 'ANOTHER CASTLE!']);
  });
});
