import { describe, expect, it } from 'vitest';
import { getLevel, levelIds } from '@content/levels';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { SAMUS } from '@game/characters/samus';
import { HeroItem } from '@game/entities/objects/hero-item';
import { PowerUp } from '@game/entities/objects/powerup';
import { heroStart } from '@game/items/heroes';
import { campaignLevel } from '@game/level/campaign';
import { newGameState } from '@game/context';
import { buy, newShopVisit, shopEntries } from '@game/town/shop';

// Samus's grow item first (0.4.43, owner: she took the Varia Suit before any Energy Tank). Her
// campaign blocks, an SMB Mushroom another hero's block put out (Mario's, in co-op) and the
// Kakariko shop all give a small Samus her Energy Tank first.

const fresh = () => heroStart(SAMUS);

describe("Samus's grow item first", () => {
  it('every campaign block that holds her Varia Suit gives a small Samus an Energy Tank', () => {
    const blocks = levelIds()
      .map((id) => campaignLevel(getLevel(id)))
      .flatMap((level) =>
        (level.heroItems ?? [])
          .filter((h) => h.items.samus === 'varia-suit')
          .map((h) => ({ level, x: h.x, y: h.y })),
      );
    expect(blocks.length).toBeGreaterThanOrEqual(4);
    for (const { level, x, y } of blocks) {
      const items: string[] = [];
      const start = fresh();
      runSim({
        level,
        character: SAMUS,
        script: { steps: [] },
        maxFrames: 50,
        state: { kit: start.kit, hp: start.hp, powerState: start.powerState },
        controller: (w, f) => {
          if (f === 0) {
            w.useHeroItems(level.heroItems ?? []);
            w.strikeBlock(x, y, w.player, true);
          }
          if (f === 40) for (const e of w.entities) if (e instanceof HeroItem) items.push(e.item);
          return [];
        },
      });
      expect(items, `${level.id} ${x},${y}`).toEqual(['energy-tank']);
    }
  });

  it("an SMB Mushroom (another hero's block) gives a small campaign Samus her Energy Tank, not the Varia Suit", () => {
    const rows = Array.from({ length: 13 }, () => '.'.repeat(32));
    const level = parseTextMap(
      ['id: t', 'time: 300', 'start: 2,12', '', '[tiles]', ...rows, '#'.repeat(32), '#'.repeat(32)].join(
        '\n',
      ),
    );
    const start = fresh();
    const r = runSim({
      level,
      character: SAMUS,
      script: { steps: [] },
      maxFrames: 600,
      state: { kit: start.kit, hp: start.hp, powerState: start.powerState },
      controller: (w, f) => {
        if (f === 0) {
          const m = new PowerUp(8, 13, 'mushroom');
          w.spawn(m);
        }
        return f > 40 ? ['right'] : [];
      },
      until: (w) => !!(w.player.scratch.tanks || w.player.scratch.varia),
    });
    const p = r.world.player;
    expect(p.scratch.tanks).toBe(1);
    expect(p.scratch.varia ?? 0).toBe(0);
  });

  it('the Kakariko shop: her power item is GROW FIRST until the Energy Tank is bought', () => {
    const s = newGameState(SAMUS);
    const start = fresh();
    s.powerState = start.powerState;
    s.hp = start.hp;
    s.kit = { ...start.kit };
    s.coins = 99;
    const visit = newShopVisit();
    const power = () => shopEntries(s, visit).find((e) => e.slot === 'power');
    expect(power()?.mark).toBe('GROW FIRST');
    expect(buy(s, visit, 'power')).toEqual({ kind: 'refused', mark: 'GROW FIRST' });
    expect(s.kit.varia ?? 0).toBe(0);
    expect(buy(s, visit, 'grow').kind).toBe('bought');
    expect(s.kit.tanks).toBe(1);
    expect(power()?.mark).toBeNull();
    expect(buy(s, visit, 'power').kind).toBe('bought');
  });
});
