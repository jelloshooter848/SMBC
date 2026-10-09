import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { runSim } from '@game/sim/headless';
import { CHARACTERS } from '@game/characters/registry';
import { MEGAMAN } from '@game/characters/megaman';
import type { CharacterDef } from '@game/characters/character';
import { heroVariant } from '@game/level/variants';
import { T } from '@game/level/tiles';
import { tileAtTiles } from '@game/level/schema';
import { toPx, px } from '@engine/math/units';
import { Larry } from '@game/entities/enemies/larry';
import { Yoku } from '@game/entities/enemies/wily-sky';
import { Projectile } from '@game/entities/projectiles/projectile';
import type { World } from '@game/world/world';
import type { Action } from '@engine/input/actions';
import { megamanShipBot } from './megaman-airship-bot';

// Mega Man's airship (0.4.39, the "Wily-sky remix"): the deck's `[variant megaman]` section, laid
// in campaign play when any player is Mega Man (level/variants.ts heroVariant). Its layout, that it
// leaves every other hero's airship exactly as it was, that he gets across it (with and without his
// helmet; and a partner hero too, since co-op plays the variant), and that he beats Larry in his
// room with the buster alone.

const DECK = getLevel('4-2-airship');
const ROOM = getLevel('4-2-larry');
const mmDeck = heroVariant(DECK, ['megaman'], true);
const mmRoom = heroVariant(ROOM, ['megaman'], true);
const t = (x: number, y: number) => tileAtTiles(mmDeck, x, y);

describe("Mega Man's deck (the variant)", () => {
  it('is the same hull and length, to the Wily fortress music; tagged as his', () => {
    expect(mmDeck.width).toBe(DECK.width);
    expect(mmDeck.music).toBe('mm-wily');
    expect(mmDeck.heroVariants).toEqual(['megaman']);
    expect(mmRoom.heroVariants).toEqual(['megaman']);
    // The room keeps the SMB3 boss music and its tiles but the raised post (7,12), which took
    // every standing buster shot across it: still an SMB3 fight.
    const diff = [...mmRoom.tiles].flatMap((v, i) => (v === ROOM.tiles[i] ? [] : [i]));
    expect(diff).toEqual([12 * ROOM.width + 7]);
    expect(mmRoom.tiles[12 * ROOM.width + 7]).toBe(T.WALL);
    expect(mmRoom.music).toBe(ROOM.music);
    // The bow, the cannons, the blasters and the pipe are where they were.
    for (const e of DECK.entities.filter((e) => e.type === 'cannon'))
      expect(mmDeck.entities).toContainEqual(e);
    expect(mmDeck.zones).toEqual(DECK.zones);
  });

  it('swaps Rocky Wrench for his enemies and opens the stern steps into an appearing-block climb', () => {
    const types = mmDeck.entities.map((e) => e.type);
    expect(types).not.toContain('rocky');
    for (const k of ['telly-port', 'shield-joe', 'gull', 'yoku']) expect(types).toContain(k);
    const yoku = mmDeck.entities.filter((e) => e.type === 'yoku');
    expect(yoku).toHaveLength(4);
    // The steps are gone; the lower stern deck runs on under the blocks (a miss is no fall).
    for (let x = 83; x <= 90; x++) {
      for (let y = 9; y <= 12; y++) expect(t(x, y), `${x},${y}`).toBe(T.AIR);
      expect(t(x, 13)).not.toBe(T.AIR);
    }
    for (const y of yoku) {
      expect(y.x).toBeGreaterThanOrEqual(83);
      expect(y.x).toBeLessThanOrEqual(90);
    }
    // The HUD rows stay clear.
    for (let y = 0; y < 3; y++) for (let x = 0; x < mmDeck.width; x++) expect(t(x, y)).toBe(T.AIR);
  });

  it('every other hero gets the airship exactly as today (and classic play never the variant)', () => {
    for (const c of CHARACTERS) {
      if (c.id === 'megaman') continue;
      expect(heroVariant(DECK, [c.id], true), c.id).toBe(DECK);
      expect(heroVariant(ROOM, [c.id], true), c.id).toBe(ROOM);
    }
    expect(heroVariant(DECK, ['megaman'], false)).toBe(DECK);
  });
});

function cross(c: CharacterDef, kit: Record<string, number>, invulnerable: boolean, shoot = true) {
  let furthest = 0;
  let hits = 0;
  const r = runSim({
    level: mmDeck,
    character: c,
    state: { powerState: 'big', ...(c === MEGAMAN ? { kit } : {}) },
    assist: { invulnerable },
    script: { steps: [] },
    controller: (() => {
      const bot = megamanShipBot({ shoot });
      let last = -1;
      return (w: World) => {
        furthest = Math.max(furthest, toPx(w.player.body.x));
        if (w.player.invuln > 0 && last === 0) hits++;
        last = w.player.invuln;
        return bot(w);
      };
    })(),
    maxFrames: 60 * 150,
  });
  return { r, furthest, hits };
}

describe('he gets across to the stern pipe (geometry: hits ignored)', () => {
  for (const [name, kit] of [
    ['with his helmet', { helmet: 1 }],
    ['without it', { helmet: 0 }],
  ] as const)
    it(`Mega Man ${name}`, () => {
      const { r, furthest } = cross(MEGAMAN, kit, true);
      expect(r.outcome, `reached x=${furthest}`).toBe('pipe');
      expect((r.events.find((e) => e.type === 'pipe') as { target?: { level: string } }).target?.level).toBe(
        '4-2-larry',
      );
    });
});

describe('with damage on', () => {
  it('Mega Man, shooting as he goes, reaches the pipe alive', () => {
    const { r, furthest, hits } = cross(MEGAMAN, { helmet: 1 }, false);
    expect(r.outcome, `reached x=${furthest} after ${hits} hits`).toBe('pipe');
    expect(r.world.player.dead).toBe(false);
  });
});

describe('the appearing blocks have a fair rhythm', () => {
  it('two are always up somewhere on the climb, and each shows for most of two seconds', () => {
    const blocks = mmDeck.entities
      .filter((e) => e.type === 'yoku')
      .map((e) => new Yoku(e.x, e.y, e.props ?? {}));
    for (let f = 0; f < 360; f++) {
      const up = blocks.filter((b) => b.phase(f) < b.on);
      expect(up.length, `frame ${f}`).toBeGreaterThanOrEqual(2);
    }
    for (const b of blocks) expect(b.on).toBeGreaterThanOrEqual(100);
  });
});

/**
 * Larry's room as Mega Man, the buster only: faces Larry, keeps a few tiles away, jumps his hops
 * and blasts, and taps the buster (and every so often a charge shot).
 */
function fightLarry(kit: Record<string, number>, max = 60 * 90) {
  let vault = 0;
  return runSim({
    level: mmRoom,
    character: MEGAMAN,
    state: { powerState: 'big', kit },
    script: { steps: [] },
    start: { mode: 'stand' },
    maxFrames: max,
    controller: (w: World, f: number): Action[] => {
      const p = w.player;
      const larry = w.entities.find((e): e is Larry => e instanceof Larry);
      if (!larry || larry.defeated) return [];
      const px0 = toPx(p.centerX);
      const dx = toPx(larry.body.x + (larry.body.w >> 1)) - px0;
      const acts: Action[] = [];
      const dir: Action = dx < 0 ? 'left' : 'right';
      const away: Action = dx < 0 ? 'right' : 'left';
      // Backed into a corner with him close: over him (a jump toward and past him).
      const cornered = (px0 < 56 && dx > 0) || (px0 > 200 && dx < 0);
      if (vault > 0 || (cornered && Math.abs(dx) < 72 && p.body.onGround)) {
        if (vault <= 0) vault = 50;
        vault--;
        acts.push(dir);
        if (vault > 20) acts.push('jump');
        return acts;
      }
      // Keep 3-6 tiles off him, turned to face him.
      if (Math.abs(dx) < 48) acts.push(away);
      else if (Math.abs(dx) > 96) acts.push(dir);
      else if ((dx < 0 ? -1 : 1) !== p.facing) acts.push(dir);
      // Jump a blast coming at him.
      const blast = w.entities.some(
        (e) =>
          e instanceof Projectile &&
          e.alive &&
          e.spec.hitsPlayer &&
          Math.abs(toPx(e.body.x) - px0) < 40 &&
          toPx(e.body.y) > toPx(p.body.y) - 8,
      );
      if (blast && p.body.onGround) acts.push('jump');
      // Shoot only while turned to him (a charge shot now and then with the helmet).
      const facing = (dx < 0 ? -1 : 1) === p.facing;
      if (kit.helmet && f % 200 < 50) {
        acts.push('attack');
      } else if (facing && f % 8 === 0) acts.push('attack');
      return acts;
    },
    until: (w) => w.entities.some((e) => e instanceof Larry && e.defeated),
  });
}

describe('he beats Larry in his room (Larry has a hit-point bar there)', () => {
  for (const [name, kit] of [
    ['with his helmet (buster and charge shots)', { helmet: 1 }],
    ['without it (buster only)', { helmet: 0 }],
  ] as const)
    it(`Mega Man ${name}`, () => {
      const r = fightLarry(kit);
      expect(r.outcome).toBe('stopped');
      const larry = r.world.entities.find((e): e is Larry => e instanceof Larry) as Larry;
      expect(larry.hpMode).toBe(true);
      expect(r.world.player.dead).toBe(false);
    });

  it('every other hero meets the room as today (no hit-point mode)', () => {
    for (const c of CHARACTERS.filter((c) => c.id !== 'megaman')) {
      const r = runSim({
        level: heroVariant(ROOM, [c.id], true),
        character: c,
        script: { steps: [] },
        maxFrames: 3,
      });
      const larry = r.world.entities.find((e): e is Larry => e instanceof Larry) as Larry;
      expect(larry.hpMode, c.id).toBe(false);
    }
    void px;
  });
});
