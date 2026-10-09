import { describe, expect, it } from 'vitest';
import type { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NO_INPUT, type InputFrame } from '@engine/input/input-manager';
import type { Action } from '@engine/input/actions';
import { itemsDef } from '@content/sprites/items';
import { DEFAULT_ASSIST, newGameState } from '../../context';
import { parseTextMap } from '../../level/textmap';
import { World } from '../../world/world';
import { BUSTER, CHARGED_BUSTER, Projectile } from '../../entities/projectiles/projectile';
import { heroStart, itemRules } from '../../items/heroes';
import { has, setHas } from '../../items/flags';
import { SOPHIA } from '../sophia';
import { MEGAMAN, MEGAMAN_TOOL_LABELS, MAX_HP } from './index';
import { MEGAMAN_GUIDE } from './guide';

const STUB_ASSETS = {
  sheet: () => ({ id: 'stub', image: null, frames: new Map() }),
  has: () => false,
} as unknown as AssetRegistry;

const ROOM = parseTextMap(
  [
    'id: t',
    'theme: overworld',
    'start: 4,12',
    '[tiles]',
    ...Array.from({ length: 15 }, (_, y) => (y >= 13 ? '#' : '.').repeat(32)),
    '',
    '[entities]',
    'goomba 12 12',
    'goomba 14 12',
  ].join('\n'),
  't',
);

function world(def = MEGAMAN, campaign = true) {
  const state = newGameState(def);
  if (campaign) {
    const start = heroStart(def);
    state.powerState = start.powerState;
    state.hp = start.hp;
    state.kit = start.kit;
  }
  const ctx = { assets: STUB_ASSETS, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true };
  const w = new World(ROOM, ctx, state, { seed: 1 });
  w.time = null;
  if (campaign) w.useHeroItems([]);
  for (let i = 0; i < 2; i++) w.update([NO_INPUT]);
  w.player.transition = null;
  return w;
}

function frame(held: readonly Action[], prev: readonly Action[]): InputFrame {
  return {
    ...NO_INPUT,
    held: (a) => held.includes(a),
    pressed: (a) => held.includes(a) && !prev.includes(a),
    released: (a) => !held.includes(a) && prev.includes(a),
  };
}

/** Hold `held` for `n` frames, then let go. */
function hold(w: World, held: Action[], n: number): void {
  let prev: Action[] = [];
  for (let i = 0; i < n; i++) {
    w.update([frame(held, prev)]);
    prev = held;
  }
  w.update([frame([], prev)]);
}

describe('Mega Man: the helmet is his mushroom (0.4.35)', () => {
  it('in the campaign a hit while helmeted takes the helmet (charge shot, brick breaking) and its damage', () => {
    const w = world();
    const p = w.player;
    itemRules('megaman')!.give(p, 'helmet');
    setHas(p, 'saw-disc');
    expect(MEGAMAN.canBreakBricks?.(p)).toBe(true);
    w.hurtPlayer(p);
    expect(p.scratch.helmet ?? 0).toBe(0);
    expect(MEGAMAN.canBreakBricks?.(p)).toBe(false);
    expect(p.hp).toBe(MAX_HP - 4);
    // The weapons he found stay.
    expect(has(p, 'saw-disc')).toBe(true);
    // Small again: SMB's rule, a power block gives the helmet back first.
    expect(itemRules('megaman')!.small(p)).toBe(true);
    // No charge any more.
    p.invuln = 0;
    hold(w, ['attack'], 60);
    expect(w.entities.some((e) => e instanceof Projectile && e.kind === 'buster-charged')).toBe(false);
  });

  it('classic play keeps the original: a hit costs health only', () => {
    const w = world(MEGAMAN, false);
    const p = w.player;
    p.scratch.helmet = 1;
    w.hurtPlayer(p);
    expect(p.scratch.helmet).toBe(1);
  });

  it("Sophia's Power Capsule (her grow item, a state) is lost to a hit as before", () => {
    const w = world(SOPHIA);
    const p = w.player;
    itemRules('sophia')!.give(p, 'power-capsule');
    p.transition = null;
    expect(itemRules('sophia')!.small(p)).toBe(false);
    w.hurtPlayer(p);
    expect(itemRules('sophia')!.small(p)).toBe(true);
  });
});

describe("Mega Man's charge shot: a big blast like the original's (0.4.35)", () => {
  it('a full charge fires a big piercing shot of its own, three times the buster', () => {
    expect(CHARGED_BUSTER.amount).toBe(BUSTER.amount * 3);
    expect(CHARGED_BUSTER.w).toBeGreaterThanOrEqual(BUSTER.w * 3);
    expect(CHARGED_BUSTER.h).toBeGreaterThanOrEqual(BUSTER.h * 2);
    expect(CHARGED_BUSTER.frames.every((f) => !BUSTER.frames.includes(f))).toBe(true);
    for (const f of CHARGED_BUSTER.frames) {
      const rows = itemsDef.frames[f] as readonly string[];
      expect(rows, f).toBeDefined();
      expect(rows[0]!.length, f).toBeGreaterThanOrEqual(CHARGED_BUSTER.w);
    }
  });

  it('it passes through the enemies it defeats', () => {
    const w = world();
    const p = w.player;
    itemRules('megaman')!.give(p, 'helmet');
    p.facing = 1;
    hold(w, ['attack'], 50);
    const shot = w.entities.find(
      (e): e is Projectile => e instanceof Projectile && e.kind === 'buster-charged',
    );
    expect(shot).toBeDefined();
    for (let i = 0; i < 90; i++) w.update([NO_INPUT]);
    expect(w.enemies.filter((e) => e.alive).length).toBe(0);
  });
});

describe("Mega Man's belt: real weapons and Rush only (0.4.35: no 'Buster' entry)", () => {
  it('the belt is empty with no weapons; the plain shot is always the buster', () => {
    const w = world();
    const p = w.player;
    expect(MEGAMAN.tools!(p)).toEqual([]);
    expect(MEGAMAN.touchLabels!(p, w)).toMatchObject({ attack: 'SHOOT', special: null, select: null });
    setHas(p, 'bolt');
    setHas(p, 'rush-coil');
    expect(MEGAMAN.tools!(p).map((t) => t.id)).toEqual(['bolt', 'rush']);
    expect(MEGAMAN_TOOL_LABELS.buster).toBeUndefined();
    expect(MEGAMAN_GUIDE.belt?.some((b) => /buster/i.test(b.name))).toBe(false);
  });

  it('the buster charges with the helmet whatever weapon is selected', () => {
    const w = world();
    const p = w.player;
    itemRules('megaman')!.give(p, 'helmet');
    setHas(p, 'saw-disc');
    hold(w, ['attack'], 50);
    expect(w.entities.some((e) => e instanceof Projectile && e.kind === 'buster-charged')).toBe(true);
  });
});
