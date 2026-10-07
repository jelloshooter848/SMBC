import { describe, expect, it } from 'vitest';
import { getLevel, levelIds } from '@content/levels';
import { runSim } from '@game/sim/headless';
import { CHARACTERS } from '@game/characters/registry';
import { campaignLevel, ANCHOR_DECOR } from '@game/level/campaign';
import { LevelScene } from '@game/scenes/level';
import { Vine } from '@game/entities/objects/vine';
import { px, toPx } from '@engine/math/units';
import type { World } from '@game/world/world';
import type { Action } from '@engine/input/actions';
import { T } from '@game/level/tiles';
import { draw, file, makeGame, useStorage } from './heroes-harness';

// 4-2's anchor chain (owner decision 8:25 PM PDT, docs/HEROES.md "Larry Koopa and the crystal
// ball"): in campaign play the hidden right zone has no pipe; Larry's anchor rests on the floor and
// its chain rises through the ceiling off the top of the screen. Climbed to the top it leads to
// Larry's airship (`4-2-airship`), arriving up a chain at the bow: the chain at column 2, the hero
// stepping off onto the deck in column 3.

useStorage();

const withAirship = (id: string) => id === '4-2-airship' || levelIds().includes(id);
const camp = () => campaignLevel(getLevel('4-2'), withAirship);
/** The chain's column and foot row (the pipe stood at 214-215; the floor is row 13). */
const CHAIN = { x: 214, y: 12 };
const ARRIVAL = { level: '4-2-airship', x: 2, y: 3 };

/** The hero's body overlaps no solid tile. */
function clear(w: World): boolean {
  const b = w.player.body;
  for (let ty = toPx(b.y) >> 4; ty <= (toPx(b.y + b.h) - 1) >> 4; ty++)
    for (let tx = toPx(b.x) >> 4; tx <= (toPx(b.x + b.w) - 1) >> 4; tx++)
      if (w.map.isSolid(tx, ty)) return false;
  return true;
}

describe('the anchor chain in 4-2 (campaign)', () => {
  it('stands where the pipe stood, rising through the ceiling off the top of the screen', () => {
    const l = camp();
    const chain = l.entities.find((e) => e.type === 'chain');
    expect(chain).toEqual({ type: 'chain', x: CHAIN.x, y: CHAIN.y, props: { len: 14 } });
    expect(l.decor).toContainEqual({ kind: ANCHOR_DECOR, x: CHAIN.x - 0.5, y: CHAIN.y });
    expect(l.zones).toContainEqual({ kind: 'vine', ...CHAIN, target: ARRIVAL });
    // The ceiling brick over the chain is gone; the rest of the ceiling stands.
    const at = (x: number, y: number) => l.tiles[y * l.width + x];
    expect(at(CHAIN.x, 2)).toBe(T.AIR);
    expect(at(CHAIN.x - 1, 2)).not.toBe(T.AIR);
    // No pipe is left in the room.
    expect(l.zones.filter((z) => z.kind === 'pipe' && z.x >= 208)).toEqual([]);
    for (const y of [10, 11, 12]) expect([at(214, y), at(215, y)]).toEqual([T.AIR, T.AIR]);
  });

  it('a Vine with chain art reaching above the screen top', () => {
    const r = runSim({
      level: camp(),
      character: CHARACTERS[0]!,
      script: { steps: [{ frame: 0, hold: [] as Action[] }] },
      start: { x: CHAIN.x - 3, y: 12, mode: 'stand', time: 300 },
      maxFrames: 5,
    });
    const v = r.world.entities.find((e): e is Vine => e instanceof Vine);
    expect(v?.art).toBe('chain');
    expect(v?.topPx).toBe(-16);
    expect(v?.basePx).toBe(13 * 16);
  });

  it.each(CHARACTERS.map((c) => [c.name, c] as const))(
    '%s climbs the chain into the airship and lands on the deck right of it',
    (_name, c) => {
      // Up from beside the anchor: up grabs the chain, up climbs it off the top of the screen.
      const up = runSim({
        level: camp(),
        character: c,
        script: { steps: [{ frame: 0, hold: [] as Action[] }] },
        start: { x: CHAIN.x, y: 12, mode: 'stand', time: 300 },
        maxFrames: 900,
        controller: (_w, f) => (f < 5 ? [] : ['up']),
      });
      expect(up.outcome, c.name).toBe('pipe');
      expect(up.events.find((e) => e.type === 'pipe')).toMatchObject({
        target: { ...ARRIVAL, exitDir: 'climb', chain: true },
      });
      // The arrival: the chain rises from the screen bottom at column 2; the hero climbs it and
      // steps off to the right, onto the ground in column 3.
      const deck = runSim({
        level: getLevel('4-2-airship'),
        character: c,
        script: { steps: [{ frame: 0, hold: [] as Action[] }] },
        start: { ...ARRIVAL, mode: 'climb', chain: true, time: 300 },
        maxFrames: 900,
        controller: () => [],
        until: (w, f) => f > 10 && !w.arriving && w.player.body.onGround,
      });
      expect(deck.outcome, c.name).toBe('stopped');
      const w = deck.world;
      const arrival = w.entities.find((e): e is Vine => e instanceof Vine && e.tx === ARRIVAL.x);
      expect(arrival?.art).toBe('chain');
      expect(toPx(w.player.centerX) >> 4).toBe(ARRIVAL.x + 1);
      expect(clear(w), `${c.name} stands clear of the tiles`).toBe(true);
      const feet = w.player.body.y + w.player.body.h;
      expect(w.map.isSolid(ARRIVAL.x + 1, toPx(feet) >> 4)).toBe(true);
      expect(feet % px(16)).toBe(0);
    },
  );

  it('the whole way in the game: 4-2 → up the chain → the airship, the clock carried on', () => {
    const h = makeGame();
    file({ cleared: ['1-0', '4-1'], pages: ['smb-1', 'smb-4'], position: { page: 'smb-4', node: '4-2' } });
    h.game.openFile(1);
    h.idle(8);
    h.game.startLevel(getLevel('4-2'), { mode: 'stand', x: CHAIN.x - 2, y: 12, time: 300 });
    h.step();
    const main = h.top() as LevelScene;
    expect(main.level.id).toBe('4-2');
    // The anchor is drawn (once the smb3 sheet has it) and the chain is a Vine with chain art.
    expect(main.level.decor.some((d) => d.kind === ANCHOR_DECOR)).toBe(true);
    // Walk up to the chain (beside the anchor), then hold up.
    for (let f = 0; f < 120 && toPx(main.world.player.centerX) < CHAIN.x * 16 + 4; f++) h.step(['right']);
    for (let f = 0; f < 900 && (h.top() as LevelScene).level?.id !== '4-2-airship'; f++) h.step(['up']);
    const ship = h.top() as LevelScene;
    expect(ship).toBeInstanceOf(LevelScene);
    expect(ship.level.id).toBe('4-2-airship');
    expect(ship.world.time).toBeGreaterThan(250);
    h.until(() => !ship.world.arriving && ship.world.player.body.onGround, 900);
    expect(h.game.mapProgress.secrets).not.toContain('larry');
    // Drawn without throwing, with or without the chain frame in the smb3 sheet.
    expect(() => draw(ship)).not.toThrow();
  });
});

describe('outside the campaign', () => {
  it('4-2 keeps the classic warp zone: the pipe to 5-1, no anchor, no chain', () => {
    const l = getLevel('4-2');
    expect(l.entities.some((e) => e.type === 'chain')).toBe(false);
    expect(l.decor.some((d) => d.kind === ANCHOR_DECOR)).toBe(false);
    expect(l.zones).toContainEqual({
      kind: 'pipe',
      x: 214,
      y: 10,
      dir: 'down',
      target: { level: '5-1', x: 2, y: 12 },
    });
  });
});
