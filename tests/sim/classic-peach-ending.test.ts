import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { CLASSIC_EXTRAS, heroFor } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { px } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { World } from '@game/world/world';
import { Princess } from '@game/entities/objects/princess';

/*
 * classic-patch-2 item 9 (owner idea, "Maybe Peach has Mario greet her"): in the last castle
 * (exit next=end) Classic Peach finds big Mario where the princess stands, and he greets her;
 * announced, and held until OK. Every other hero keeps the princess and today's lines.
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

const PEACH = CLASSIC_EXTRAS.find((d) => d.id === 'peach') as CharacterDef;

describe("Classic Peach's last castle: Mario greets her", () => {
  it('Mario stands in the princess room, 32 px tall on her tile, facing the hero', () => {
    const { princess } = ending(PEACH, 'classic');
    expect(princess).not.toBeNull();
    const p = princess as Princess;
    expect(p.look).toEqual({
      sheet: 'mario',
      palette: 'mario',
      frame: 'big-idle',
      h: 32,
      news: expect.any(Array),
    });
    expect(p.body.y + p.body.h).toBe(px(13 * 16));
    expect(p.body.h).toBe(px(32));
  });

  it('his lines follow THANK YOU PEACH!, are read out and wait for OK (no auto-advance)', () => {
    const { text, say, exits } = ending(PEACH, 'classic');
    expect(text).toEqual(['THANK YOU PEACH!', '', 'THIS TIME YOU SAVED ME!', 'YOUR QUEST IS OVER.']);
    expect(say).toContain('THANK YOU PEACH! THIS TIME YOU SAVED ME! YOUR QUEST IS OVER. OK to continue.');
    expect(exits).toHaveLength(0);
    for (const l of text) expect(l.length).toBeLessThanOrEqual(28);
  });

  it('every other hero keeps the princess and YOUR QUEST IS OVER.', () => {
    for (const def of [heroFor(MARIO, 'classic'), heroFor(LINK, 'classic')]) {
      const { text, princess } = ending(def, 'classic');
      expect(princess?.look ?? null, def.id).toBeNull();
      expect(text, def.id).toEqual([`THANK YOU ${def.name.toUpperCase()}!`, '', 'YOUR QUEST IS OVER.']);
    }
    const cur = ending(MARIO, 'current');
    expect(cur.princess?.look ?? null).toBeNull();
    expect(cur.text).toEqual(['THANK YOU MARIO!', '', 'YOUR QUEST IS OVER.']);
  });

  it('only Classic Peach sets endingGreeter', () => {
    const all = [...CLASSIC_EXTRAS, heroFor(MARIO, 'classic'), heroFor(LINK, 'classic'), MARIO, LINK];
    expect(all.filter((d) => d.endingGreeter).map((d) => d.id)).toEqual(['peach']);
  });
});
