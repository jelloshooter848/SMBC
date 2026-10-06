import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim, ScriptedInput } from '@game/sim/headless';
import { px } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import type { CharacterDef } from '@game/characters/character';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { LINK } from '@game/characters/link';
import { T } from '@game/level/tiles';
import { PowerUp, type PowerUpKind } from '@game/entities/objects/powerup';
import { ENTITY_GRAVITY } from '@game/entities/entity';
import type { World } from '@game/world/world';

// A block bumped under an item, as the original's Brick.hitObjectsAbove does it (on every bounce
// and when a brick breaks): Mushroom.gBounceHit (red, poison and 1-up) pops it up by
// `vy = -BOUNCE_AMT` (350 px/s = 2.92 px/f), with `gravity = BOUNCE_GRAVITY` (1500 px/s² =
// 0.208 px/f²) until it lands, and `if (nx < g.hMidX) vx = -vx`. Coin.gBounceHit collects a coin
// standing on the block (a FlyingCoin worth 200 and a coin). Star and FireFlower have no
// gBounceHit (AnimatedObject's is empty), nor does the plain Pickup the Clock is.

/** BOUNCE_AMT 350 px/s = 0x02eab, seen after its first frame of BOUNCE_GRAVITY (0x00355). */
const BUMPED_VY = -0x02eab + 0x00355;

const COL = 10;
const ROW = 9;
const TOP = ROW * 16; // px
const MID = COL * 16 + 8; // px

/**
 * A flat 48-wide field with `block` at (10, 9) in a ledge of hard blocks (columns 4-16), so an
 * item popped off it lands at the same height; `above` goes at (10, 8). The hero starts under it.
 */
function field(block: string, above = '.') {
  const rows = Array.from({ length: 13 }, () => '.'.repeat(48));
  const at = (ch: string) => '.'.repeat(COL) + ch + '.'.repeat(48 - COL - 1);
  rows[ROW] = '.'.repeat(4) + 'B'.repeat(COL - 4) + block + 'B'.repeat(6) + '.'.repeat(48 - COL - 7);
  if (above !== '.') rows[ROW - 1] = at(above);
  return parseTextMap(
    ['id: t', 'time: 300', `start: ${COL},12`, '', '[tiles]', ...rows, '#'.repeat(48), '#'.repeat(48)].join(
      '\n',
    ),
  );
}

const still = new ScriptedInput({ steps: [] });
function idle(w: World, frames: number): void {
  for (let i = 0; i < frames; i++) {
    still.next();
    w.update([still]);
  }
}

interface Trace {
  world: World;
  item: PowerUp;
  /** Item centre (px from the block's middle) and vx sign on the frame before it was bumped. */
  before: { dx: number; dir: number } | null;
  /** Frames from the bump until it stands again, where (px above the start), and the peak. */
  landedAfter: number;
  landedAt: number;
  rise: number;
  bumpVy: number;
}

/**
 * Put a walking `kind` on the block, centre `dx` px from its middle walking `dir`, while the
 * hero (jumping straight up, plus `held`) is about to reach the block, then follow the item.
 */
function bumpWithItem(opts: {
  block: string;
  kind: PowerUpKind;
  dx: number;
  dir: 1 | -1;
  character?: CharacterDef;
  power?: string;
  held?: Action[];
}): Trace {
  const item = new PowerUp(COL, ROW, opts.kind);
  let placed = false;
  let bumped = false;
  let before: Trace['before'] = null;
  let bumpFrame = -1;
  let landedAfter = -1;
  let landedAt = 0;
  let bumpVy = 0;
  let rise = 0;
  let y0 = 0;
  const sim = runSim({
    level: field(opts.block),
    character: opts.character ?? MARIO,
    state: opts.power ? { powerState: opts.power } : {},
    assist: { invulnerable: true },
    script: { steps: [] },
    maxFrames: 200,
    // Stop once it stands again, before it can walk into the hero.
    until: () => landedAfter >= 0,
    controller: (w, f) => {
      const b = item.body;
      const head = w.player.body.y;
      if (!placed && w.player.body.vy < 0 && head <= px(TOP + 16 + 12)) {
        placed = true;
        // Already out of the block and walking, as after `emerging` runs out.
        (item as unknown as { emerging: number }).emerging = 0;
        item.layer = 'main';
        b.x = px(MID + opts.dx) - (b.w >> 1);
        b.y = px(TOP) - b.h;
        b.vx = opts.dir * 0x01000;
        b.vy = 0;
        b.onGround = true;
        w.spawn(item);
        y0 = b.y;
      }
      if (placed && !bumped) {
        if (b.vy < 0) {
          bumped = true;
          bumpFrame = f;
          bumpVy = b.vy;
        } else before = { dx: (b.x + (b.w >> 1)) / 256 - MID, dir: Math.sign(b.vx) };
      }
      if (bumped) {
        rise = Math.max(rise, (y0 - b.y) / 256);
        if (landedAfter < 0 && b.onGround && f > bumpFrame + 1) {
          landedAfter = f - bumpFrame;
          landedAt = (y0 - b.y) / 256;
        }
      }
      return f < 20 ? ['jump', ...(opts.held ?? [])] : (opts.held ?? []);
    },
  });
  return { world: sim.world, item, before, landedAfter, landedAt, rise, bumpVy };
}

describe('a mushroom on a block bumped from below hops (Mushroom.gBounceHit)', () => {
  for (const block of ['?', '='] as const) {
    for (const [side, dx, dir, flips] of [
      // Left of the middle it turns round, right of it it keeps going.
      ['left of the middle, walking right', -5, 1, true],
      ['left of the middle, walking left', -5, -1, true],
      ['right of the middle, walking right', 5, 1, false],
      ['right of the middle, walking left', 5, -1, false],
    ] as const) {
      it(`${block === '?' ? '? block' : 'brick'}, ${side}: rises ~20 px, lands, ${flips ? 'turns' : 'keeps its way'}`, () => {
        const t = bumpWithItem({ block, kind: 'mushroom', dx, dir });
        expect(t.before).not.toBeNull();
        expect(Math.sign(t.before!.dx)).toBe(Math.sign(dx));
        expect(t.bumpVy).toBe(BUMPED_VY);
        expect(t.rise).toBeGreaterThan(17);
        expect(t.rise).toBeLessThan(23);
        // Up and down at 0.208 px/f² is about 28 frames.
        expect(t.landedAfter).toBeGreaterThan(22);
        expect(t.landedAfter).toBeLessThan(34);
        expect(t.landedAt).toBe(0);
        expect(t.item.alive).toBe(true);
        expect(Math.sign(t.item.body.vx)).toBe(flips ? -dir : dir);
        expect(t.world.map.get(COL, ROW)).not.toBe(T.AIR);
      });
    }
  }

  it('once it has landed it falls with its usual gravity again', () => {
    const t = bumpWithItem({ block: '=', kind: 'mushroom', dx: 5, dir: 1 });
    expect(t.landedAt).toBe(0);
    // Walk off the end of the ledge, then watch one frame of the fall.
    const w = t.world;
    const b = t.item.body;
    let f = 0;
    for (; f < 200 && !(b.vy > 0 && !b.onGround); f++) idle(w, 1);
    expect(f).toBeLessThan(200);
    const vy = b.vy;
    idle(w, 1);
    expect(b.vy - vy).toBe(ENTITY_GRAVITY);
  });

  for (const kind of ['1up', 'poison'] as const) {
    it(`a ${kind} mushroom hops the same way`, () => {
      const t = bumpWithItem({ block: '=', kind, dx: -5, dir: 1 });
      expect(t.bumpVy).toBe(BUMPED_VY);
      expect(t.rise).toBeGreaterThan(17);
      expect(t.rise).toBeLessThan(23);
      expect(Math.sign(t.item.body.vx)).toBe(-1);
      expect(t.item.alive).toBe(true);
    });
  }

  it('Luigi bumping the block pops it too', () => {
    const t = bumpWithItem({ block: '?', kind: 'mushroom', dx: 5, dir: -1, character: LUIGI });
    expect(t.bumpVy).toBe(BUMPED_VY);
    expect(t.rise).toBeGreaterThan(17);
    expect(Math.sign(t.item.body.vx)).toBe(-1);
  });

  it('big Mario breaking the brick pops it up before it falls through the gap', () => {
    const t = bumpWithItem({ block: '=', kind: 'mushroom', dx: 5, dir: 1, power: 'big' });
    expect(t.world.map.get(COL, ROW)).toBe(T.AIR);
    expect(t.bumpVy).toBe(BUMPED_VY);
    expect(t.rise).toBeGreaterThan(17);
    expect(t.item.alive).toBe(true);
  });

  it("Link's up-thrust (strikeBlock) pops it up as the sword breaks the brick", () => {
    const t = bumpWithItem({ block: '=', kind: 'mushroom', dx: 5, dir: 1, character: LINK, held: ['up'] });
    expect(t.world.map.get(COL, ROW)).toBe(T.AIR); // the thrust, not a head bump
    expect(t.bumpVy).toBe(BUMPED_VY);
    expect(t.rise).toBeGreaterThan(17);
    expect(Math.sign(t.item.body.vx)).toBe(1);
  });
});

describe('items without a gBounceHit ignore the bump', () => {
  function onBrick(kind: PowerUpKind) {
    const sim = runSim({ level: field('='), character: MARIO, script: { steps: [] }, maxFrames: 1 });
    const w = sim.world;
    const item = new PowerUp(COL, ROW, kind);
    (item as unknown as { emerging: number }).emerging = 0;
    item.layer = 'main';
    item.body.y = px(TOP) - item.body.h;
    item.body.onGround = true;
    w.spawn(item);
    w.strikeBlock(COL, ROW, w.player, false);
    return { w, item };
  }

  it('the star keeps its own hop', () => {
    const { item } = onBrick('star');
    expect(item.body.vy).toBe(0);
  });

  for (const kind of ['flower', 'clock'] as const) {
    it(`the ${kind} stays where it is`, () => {
      const { w, item } = onBrick(kind);
      const y = item.body.y;
      idle(w, 30);
      expect(item.body.y).toBe(y);
      expect(item.alive).toBe(true);
    });
  }
});

describe('a coin on a bumped block is collected (Coin.gBounceHit)', () => {
  for (const [name, block, power] of [
    ['? block', '?', 'small'],
    ['brick', '=', 'small'],
    ['breaking brick', '=', 'big'],
  ] as const) {
    it(`${name}: the coin flies off for a coin and 200 points`, () => {
      const blockCoins = block === '?' ? 1 : 0;
      const sim = runSim({
        level: field(block, '$'),
        character: MARIO,
        state: { powerState: power },
        script: { steps: [] },
        maxFrames: 90,
        controller: (_w, f) => (f < 20 ? ['jump'] : []),
      });
      const w = sim.world;
      expect(w.map.get(COL, ROW - 1)).toBe(T.AIR);
      expect(sim.coins).toBe(1 + blockCoins);
      // 200 for the coin; a ? block's own coin is 200 more, a broken brick 50.
      expect(sim.score).toBe(200 + blockCoins * 200 + (power === 'big' ? 50 : 0));
    });
  }
});
