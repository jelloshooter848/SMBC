import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { CHARACTERS, CLASSIC_CHARACTERS } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { anotherCastle } from '@game/world/world';
import { px } from '@engine/math/units';
import { SCREEN_W } from '@engine/viewport';
import type { LevelData } from '@game/level/schema';
import type { World } from '@game/world/world';

/*
 * Per-hero castle names (PM-19/PM-M8, PI-23/PI-M5, BA-M13): under Classic SMBC rules the castle's
 * "BUT OUR PRINCESS IS IN ANOTHER CASTLE!" names whoever the original's default skin names
 * (BmdInfo.as namesArr[2], ScreenManager.addTxtTmrHandler, GameTextMessages.ANOTHER_CASTLE).
 * Under Current rules every hero keeps the shared line.
 */

/** The original's default-skin third names (BmdInfo.as, skins 0 and 1 of each hero). */
const ORIGINAL: Record<string, string> = {
  mario: 'our princess', // no names array: the line is left as it is
  luigi: 'your princess',
  link: 'Princess Zelda',
  megaman: 'Dr. Light',
  samus: 'the hatchling',
  simon: 'your friend',
  ryu: 'Irene',
  bill: 'your buddy',
  sophia: 'your frog',
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

function news(character: CharacterDef, rules: 'classic' | 'current') {
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

describe('Classic castle text names the original rescue', () => {
  it('each of the nine Classic defs carries its original name', () => {
    for (const def of CHARACTERS)
      expect(CLASSIC_CHARACTERS[def.id]?.rescueName, def.id).toBe(ORIGINAL[def.id]);
  });

  it.each(CHARACTERS.map((d) => [d.id, d] as const))(
    '%s: Classic names them, Current keeps the line',
    (id, def) => {
      const classic = news(def, 'classic');
      const name = (ORIGINAL[id] as string).toUpperCase();
      expect(classic.text.slice(1)).toEqual(['', `BUT ${name} IS IN`, 'ANOTHER CASTLE!']);
      // Read out too (the screen reader hears the same words).
      expect(classic.say).toHaveLength(1);
      expect(classic.say[0]).toContain(`BUT ${name} IS IN ANOTHER CASTLE!`);
      // Fits the screen.
      for (const line of classic.text) expect(line.length * 8, line).toBeLessThanOrEqual(SCREEN_W - 32);

      const current = news(def, 'current');
      expect(current.text.slice(1)).toEqual(['', 'BUT OUR PRINCESS IS IN', 'ANOTHER CASTLE!']);
      expect(current.say[0]).toContain('BUT OUR PRINCESS IS IN ANOTHER CASTLE!');
    },
  );

  it('no Current def has a rescue name', () => {
    for (const def of CHARACTERS) expect(def.rescueName, def.id).toBeUndefined();
  });

  it('a long name wraps to fit the screen instead of running off it', () => {
    expect(anotherCastle()).toEqual(['BUT OUR PRINCESS IS IN', 'ANOTHER CASTLE!']);
    expect(anotherCastle('Christopher Belmont the Second')).toEqual([
      'BUT CHRISTOPHER BELMONT THE',
      'SECOND IS IN ANOTHER CASTLE!',
    ]);
    for (const line of anotherCastle('Christopher Belmont the Second'))
      expect(line.length * 8).toBeLessThanOrEqual(SCREEN_W - 32);
  });
});
