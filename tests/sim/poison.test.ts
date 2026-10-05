import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim, type SimOptions } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { PowerUp } from '@game/entities/objects/powerup';
import { T, tileDef } from '@game/level/tiles';
import type { World } from '@game/world/world';
import type { Action } from '@engine/input/actions';
import type { CharacterDef } from '@game/characters/character';
import type { LevelData } from '@game/level/schema';

/** A flat 48-wide field with an item block (`block` legend char) at column 8, three tiles up. */
function flat(block: string): LevelData {
  const rows = Array.from({ length: 13 }, () => '.'.repeat(48));
  rows[9] = '.'.repeat(8) + block + '.'.repeat(39);
  return parseTextMap(
    ['id: t', 'time: 300', 'start: 2,12', '', '[tiles]', ...rows, '#'.repeat(48), '#'.repeat(48)].join('\n'),
  );
}

const BLOCK_CENTER = 8 * 16 + 8;
const poisons = (w: World): PowerUp[] =>
  w.entities.filter((e): e is PowerUp => e instanceof PowerUp && e.item === 'poison');

/** Hop into the block, then walk into whatever pops out. */
function chase(w: World, frame: number): Action[] {
  const b = w.player.body;
  const item = w.entities.find((e): e is PowerUp => e instanceof PowerUp && e.alive);
  const target = item ? (item.body.x + item.body.w / 2) / 256 : BLOCK_CENTER;
  const dx = target - (b.x + b.w / 2) / 256;
  if (item) return dx > 2 ? ['right'] : dx < -2 ? ['left'] : [];
  if (!b.onGround) return ['jump'];
  if (dx > 2) return ['right'];
  if (dx < -2) return ['left'];
  if (b.vx !== 0) return [];
  return frame % 2 === 0 ? ['jump'] : [];
}

/** Bump the `4` block and touch the poison mushroom; stops once it is gone (or the hero died). */
function touchPoison(character: CharacterDef, opts: Partial<SimOptions> = {}) {
  let seen = false;
  const r = runSim({
    level: flat('4'),
    character,
    script: { steps: [] },
    maxFrames: 900,
    ...opts,
    controller: (w, f) => {
      opts.controller?.(w, f);
      return chase(w, f);
    },
    until: (w) => {
      if (poisons(w).length > 0) seen = true;
      return w.player.dead || (seen && poisons(w).every((m) => !m.alive));
    },
  });
  expect(seen).toBe(true);
  return r;
}

describe('poison mushroom blocks', () => {
  it('map 4 / 5 / 6 to a ? block, brick and hidden block holding poison', () => {
    const legend = { '4': T.Q_POISON, '5': T.BRICK_POISON, '6': T.HIDDEN_POISON } as const;
    const kinds = { '4': 'question', '5': 'brick', '6': 'hidden' } as const;
    for (const ch of ['4', '5', '6'] as const) {
      const level = flat(ch);
      const id = level.tiles[9 * level.width + 8];
      expect(id).toBe(legend[ch]);
      expect(tileDef(id ?? 0).block).toEqual({ kind: kinds[ch], content: 'poison' });
    }
  });

  it.each(['4', '5', '6'])('head-bumping a %s block spawns a sliding poison mushroom', (ch) => {
    let mushroom: PowerUp | undefined;
    let slid = false;
    runSim({
      level: flat(ch),
      character: MARIO,
      script: { steps: [] },
      maxFrames: 600,
      controller: (w, f) => {
        mushroom ??= poisons(w)[0];
        // Stand still once it is out so it slides away instead of being touched.
        return mushroom ? [] : chase(w, f);
      },
      until: (w) => {
        if (mushroom && mushroom.body.x > (BLOCK_CENTER + 24) * 256) slid = true;
        return slid || w.player.dead;
      },
    });
    expect(mushroom?.item).toBe('poison');
    expect(slid).toBe(true);
  });
});

describe('touching a poison mushroom', () => {
  it('shrinks big Mario', () => {
    const r = touchPoison(MARIO, { state: { powerState: 'big' } });
    expect(r.world.player.dead).toBe(false);
    expect(r.world.player.powerState).toBe('small');
  });

  it('kills small Mario', () => {
    const r = touchPoison(MARIO);
    expect(r.world.player.dead).toBe(true);
  });

  it('costs Link health', () => {
    const r = touchPoison(LINK, { state: { hp: 6 } });
    expect(r.world.player.dead).toBe(false);
    expect(r.world.player.hp).toBe(5);
  });

  it('does nothing under star power', () => {
    const r = touchPoison(MARIO, {
      controller: (w) => {
        w.player.star = 600;
        return [];
      },
    });
    expect(r.world.player.dead).toBe(false);
    expect(r.world.player.powerState).toBe('small');
  });

  it('does nothing with the invulnerable assist', () => {
    const r = touchPoison(MARIO, { state: { powerState: 'big' }, assist: { invulnerable: true } });
    expect(r.world.player.dead).toBe(false);
    expect(r.world.player.powerState).toBe('big');
  });
});
