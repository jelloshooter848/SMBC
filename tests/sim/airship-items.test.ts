import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { px } from '@engine/math/units';
import { getLevel } from '@content/levels';
import { runSim } from '@game/sim/headless';
import { CHARACTERS } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { HeroItem } from '@game/entities/objects/hero-item';
import { PowerUp } from '@game/entities/objects/powerup';
import { carriedKit, Player } from '@game/entities/player';
import { heroItems } from '@game/items/catalog';
import { heroStart, itemRules } from '@game/items/heroes';
import { campaignLevel } from '@game/level/campaign';
import { heroVariant } from '@game/level/variants';
import { tileDef } from '@game/level/tiles';
import type { LevelData } from '@game/level/schema';
import type { World } from '@game/world/world';

// #34 (0.4.43, owner: on Mega Man's airship deck the ? block's Helmet rested where a small Mega Man
// could not reach it). For every ? block on both decks of 4-2's airship (the plain one and Mega
// Man's), every hero, small and big with only their basic kit, can get to the item where it rests:
// a jump from the deck or a post near the block reaches it (touches it, or lands by it).

/** The decks: the airship as the campaign plays it, and Mega Man's variant. */
const DECKS: readonly [string, LevelData][] = [
  ['plain deck', campaignLevel(getLevel('4-2-airship'))],
  ["Mega Man's deck", heroVariant(campaignLevel(getLevel('4-2-airship')), ['megaman'], true)],
];

/** The power blocks of `level` (tiles with a power block's content). */
function powerBlocks(level: LevelData): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < level.height; y++)
    for (let x = 0; x < level.width; x++) {
      const b = tileDef(level.tiles[y * level.width + x] as number).block;
      if (b && b.content !== 'coin' && b.content !== 'none' && b.content !== 'coins10') out.push({ x, y });
    }
  return out;
}

/** The hero's basic kit, small, or with their grow item ("big"). */
function kit(c: CharacterDef, big: boolean): { kit: Record<string, number>; hp: number; powerState: string } {
  const start = heroStart(c);
  if (!big) return { kit: { ...start.kit }, hp: start.hp, powerState: start.powerState };
  if (c.damage.kind === 'powerup' && !itemRules(c.id))
    return { kit: { ...start.kit }, hp: start.hp, powerState: 'big' };
  const p = new Player(0, 0, c, start.powerState, start.hp);
  Object.assign(p.scratch, start.kit);
  const grow = heroItems(c.id)?.grow;
  if (grow) itemRules(c.id)?.give(p, grow);
  return { kit: carriedKit(p), hp: p.hp, powerState: p.powerState };
}

/** The top row of the first solid tile at or below row `from` in column `x`. */
function floorRow(w: World, x: number, from: number): number {
  let y = from;
  while (y < w.level.height && !w.map.isSolid(x, y)) y++;
  return y;
}

/**
 * One try: the block struck and its item out, the hero standing at column `col` (on the floor
 * under the block's row), then a jump (held) with `dir` held (and RUN when `run`). True when the
 * item is taken within the jump.
 */
function tryReach(
  level: LevelData,
  c: CharacterDef,
  big: boolean,
  block: { x: number; y: number },
  col: number,
  dir: Action | null,
  run: boolean,
  lead = 0,
): boolean {
  let taken = false;
  let ready = -1;
  runSim({
    level,
    character: c,
    script: { steps: [] },
    maxFrames: 200,
    assist: { invulnerable: true },
    state: kit(c, big),
    start: { x: col, y: 1, mode: 'stand' },
    controller: (w, f) => {
      const p = w.player;
      if (f === 0) {
        w.useHeroItems(w.level.heroItems ?? []);
        // Nothing else moves: only the hero and the item.
        for (const e of w.entities) if (!(e instanceof HeroItem || e instanceof PowerUp)) e.alive = false;
        w.strikeBlock(block.x, block.y, p, false);
        const row = floorRow(w, col, block.y + 1);
        p.body.x = px(col * 16 + 8) - (p.body.w >> 1);
        p.body.y = px(row * 16) - p.body.h;
        p.body.vx = 0;
        p.body.vy = 0;
        // The auto-scroll held with the block mid-screen (the hero is where a player would be).
        w.camera.snapTo(px(block.x * 16));
        (w.camera as unknown as { locked: boolean }).locked = true;
        return [];
      }
      const item = w.entities.find(
        (e) => (e instanceof HeroItem && e.out) || (e instanceof PowerUp && e.alive),
      );
      const out = w.entities.some((e) => (e instanceof HeroItem || e instanceof PowerUp) && e.alive);
      if (ready < 0 && item) ready = f;
      if (ready >= 0 && !out) taken = true;
      // A Mario Mushroom slides off and drops to the deck: walking after it is reaching it.
      if (ready < 0) return [];
      const keys: Action[] = [];
      if (dir) keys.push(dir);
      if (run) keys.push('attack');
      // A walk of `lead` frames first (a hero who can't steer in the air jumps on the move).
      if (f - ready >= lead && f - ready < lead + 40) keys.push('jump');
      return keys;
    },
    until: () => taken,
  });
  return taken;
}

describe('#34: every ? block on the airship decks is in reach for every hero, small and big', () => {
  for (const [name, level] of DECKS)
    it(`${name}: each hero, small and big, gets the item off every power block`, () => {
      const blocks = powerBlocks(level);
      expect(blocks.length).toBeGreaterThan(0);
      const out: string[] = [];
      for (const block of blocks)
        for (const c of CHARACTERS)
          for (const big of [false, true]) {
            let ok = false;
            for (let d = -4; d <= 4 && !ok; d++)
              for (const dir of [null, 'left', 'right'] as const)
                for (const run of [false, true])
                  for (const lead of dir ? [0, 6, 12] : [0]) {
                    if (ok) break;
                    ok = tryReach(level, c, big, block, block.x + d, dir, run, lead);
                  }
            // A run-up along the deck from further off, jumping at each step of the way.
            for (const from of [-9, -8, 9, 8])
              for (let lead = 4; lead <= 60 && !ok; lead += 4)
                ok = tryReach(level, c, big, block, block.x + from, from < 0 ? 'right' : 'left', true, lead);
            if (!ok) out.push(`${block.x},${block.y} ${c.id} ${big ? 'big' : 'small'}`);
          }
      expect(out).toEqual([]);
    });
});
