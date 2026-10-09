import { describe, expect, it } from 'vitest';
import type { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NO_INPUT } from '@engine/input/input-manager';
import { DEFAULT_ASSIST, newGameState } from '../context';
import type { CharacterDef } from '../characters/character';
import { CHARACTERS } from '../characters/registry';
import { MEGAMAN } from '../characters/megaman';
import { SOPHIA } from '../characters/sophia';
import { parseTextMap } from '../level/textmap';
import { Pickup, type PickupKind } from '../entities/objects/pickup';
import { heroStart, itemRules } from '../items/heroes';
import { setHas } from '../items/flags';
import { World } from './world';

// Drops are always collectible (owner decision, 0.4.35): every hero picks up every enemy drop,
// even one they cannot use yet. Ammo or energy for a power they don't own goes into a hidden
// reserve, there when they get the power; when it is full the drop gives points instead.

const STUB_ASSETS = {
  sheet: () => ({ id: 'stub', image: null, frames: new Map() }),
  has: () => false,
} as unknown as AssetRegistry;

const KINDS: readonly PickupKind[] = [
  'bomb',
  'magic-small',
  'magic-large',
  'heart-small',
  'heart-large',
  'health-small',
  'health-large',
  'weapon-small',
  'weapon-large',
  'e-tank',
  'energy-small',
  'energy-large',
  'missile-pack',
  'ninpo-small',
  'ninpo-large',
  'capsule',
  'triple-ammo',
  'homing-ammo',
];

const ROOM = parseTextMap(
  [
    'id: t',
    'theme: overworld',
    'start: 4,12',
    '[tiles]',
    ...Array.from({ length: 15 }, (_, y) => (y >= 13 ? '#' : '.').repeat(24)),
  ].join('\n'),
  't',
);

/** A campaign world with `def` standing still at full health (its basic kit). */
function world(def: CharacterDef) {
  const state = newGameState(def);
  const start = heroStart(def);
  state.powerState = start.powerState;
  state.hp = start.hp;
  state.kit = start.kit;
  const ctx = { assets: STUB_ASSETS, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true };
  const w = new World(ROOM, ctx, state, { seed: 1 });
  w.time = null;
  w.useHeroItems([]);
  for (let i = 0; i < 4; i++) w.update([NO_INPUT]);
  w.player.transition = null;
  return w;
}

/** Drop `kind` on the player's feet; true once it is taken. */
function take(w: World, kind: PickupKind): boolean {
  const b = w.player.body;
  const drop = new Pickup(b.x + (b.w >> 1), b.y + b.h, kind);
  w.spawn(drop);
  for (let i = 0; i < 20 && drop.alive; i++) w.update([NO_INPUT]);
  return !drop.alive;
}

describe('drops are always collectible (0.4.35)', () => {
  for (const def of CHARACTERS)
    it(`${def.name} picks up every kind of drop, full or not`, () => {
      for (const kind of KINDS) {
        const w = world(def);
        // Twice: the second one finds whatever it fills already full.
        expect(take(w, kind), `${kind} (1)`).toBe(true);
        // Taken again and again: once full (or no use at all) it gives points, and is still taken.
        const before = w.state.score;
        for (let i = 0; i < 120 && w.state.score === before; i++)
          expect(take(w, kind), `${kind} (${i + 2})`).toBe(true);
        expect(w.state.score, `${kind} gives points when full`).toBeGreaterThan(before);
      }
    });

  it('Mega Man takes weapon energy with no weapon selected (a full reserve: points)', () => {
    const w = world(MEGAMAN);
    const before = w.state.score;
    expect(take(w, 'weapon-small')).toBe(true);
    expect(w.state.score).toBeGreaterThan(before);
  });

  it('Mega Man: weapon energy fills the emptiest weapon he owns when the selected one is full', () => {
    const w = world(MEGAMAN);
    const p = w.player;
    setHas(p, 'saw-disc');
    setHas(p, 'bolt');
    p.scratch.wbolt = 10;
    p.scratch.wsaw = 28;
    expect(take(w, 'weapon-large')).toBe(true);
    expect(p.scratch.wbolt).toBe(20);
  });

  it("Sophia keeps missile ammo found before her missiles: it's there when she gets them", () => {
    const w = world(SOPHIA);
    const p = w.player;
    expect(p.scratch.hasTriple ?? 0).toBe(0);
    expect(take(w, 'triple-ammo')).toBe(true);
    const reserve = p.scratch.triple ?? 0;
    expect(reserve).toBeGreaterThan(0);
    itemRules('sophia')!.give(p, 'triple-missile');
    expect(p.scratch.triple).toBeGreaterThanOrEqual(reserve);
  });
});
