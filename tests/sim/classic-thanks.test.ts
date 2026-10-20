import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { CLASSIC_EXTRAS, heroFor } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { SOPHIA } from '@game/characters/sophia';
import { px } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { World } from '@game/world/world';
import { Princess } from '@game/entities/objects/princess';

/*
 * Owner decision (#179): the last castle is exactly the original's for every hero and look in
 * Classic: the princess, then THANK YOU <name>! where <name> is the look's short name (BmdInfo
 * namesArr[1], ScreenManager.displayThankYouText; Sophia III thanks JASON), then YOUR QUEST IS
 * OVER. The text is read out and waits for OK. Mario's greeting for Peach (patch-2 item 9) is gone.
 */

const W = 48;
const lastCastle = (): LevelData =>
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
      'princess 40 12',
      '',
      '[zones]',
      'exit 39 next=end',
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

function ending(character: CharacterDef, rules: 'classic' | 'current') {
  const r = runSim({
    level: lastCastle(),
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
  const exits = r.events.filter((e) => e.type === 'exit');
  const princess = r.world.entities.find((e): e is Princess => e instanceof Princess) ?? null;
  return { text: r.world.castleText, say, exits, princess };
}

const look = (id: string) => CLASSIC_EXTRAS.find((d) => d.id === id) as CharacterDef;

describe('the last castle in Classic: the original thank-you for every look (#179)', () => {
  const cases: [CharacterDef, string][] = [
    [look('peach'), 'TOADSTOOL'],
    [look('zelda-snes'), 'ZELDA'],
    [look('wily'), 'DR. WILY'],
    [look('quickman'), 'QUICK MAN'],
    [look('haggleman'), 'HAGGLE MAN'],
    [look('mario3'), 'MARIO'],
    [look('rokko'), 'ROKKO CHAN'],
    [heroFor(MARIO, 'classic'), 'MARIO'],
    [heroFor(LINK, 'classic'), 'LINK'],
    [heroFor(SOPHIA, 'classic'), 'JASON'],
  ];
  for (const [def, name] of cases)
    it(`${def.id}: the princess, THANK YOU ${name}!, YOUR QUEST IS OVER., announced`, () => {
      const { text, say, exits, princess } = ending(def, 'classic');
      expect(princess).not.toBeNull();
      expect(text).toEqual([`THANK YOU ${name}!`, '', 'YOUR QUEST IS OVER.']);
      expect(say).toContain(`THANK YOU ${name}! YOUR QUEST IS OVER. OK to continue.`);
      expect(exits).toHaveLength(0);
    });

  it('the campaign keeps its own line', () => {
    expect(ending(MARIO, 'current').text).toEqual(['THANK YOU MARIO!', '', 'YOUR QUEST IS OVER.']);
  });
});
