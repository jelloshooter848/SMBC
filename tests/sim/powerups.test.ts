import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { Goomba } from '@game/entities/enemies/goomba';
import { PowerUp } from '@game/entities/objects/powerup';
import type { World } from '@game/world/world';
import type { Action } from '@engine/input/actions';
import type { CharacterDef } from '@game/characters/character';

/**
 * A flat 48-wide field: an item block at column 8 three tiles above the floor and a goomba
 * walking in from column 30. `block` is the legend char ('*' star block, '1' hidden 1-Up).
 */
function itemField(block: string) {
  const rows = Array.from({ length: 13 }, () => '.'.repeat(48));
  rows[9] = '.'.repeat(8) + block + '.'.repeat(39);
  rows[12] = '.'.repeat(30) + 'g' + '.'.repeat(17);
  return parseTextMap(
    ['id: t', 'time: 300', 'start: 2,12', '', '[tiles]', ...rows, '#'.repeat(48), '#'.repeat(48)].join('\n'),
  );
}

const BLOCK_CENTER = 8 * 16 + 8;

/** Walk under the block, hop into it, then chase the item that pops out until it is collected. */
function collectItem(w: World, frame: number, collected: boolean): Action[] {
  const p = w.player;
  const b = p.body;
  if (collected) return ['right'];
  const item = w.entities.find((e): e is PowerUp => e instanceof PowerUp && e.alive);
  if (item) {
    const dx = (item.body.x + item.body.w / 2 - (b.x + b.w / 2)) / 256;
    return dx > 2 ? ['right'] : dx < -2 ? ['left'] : [];
  }
  const dx = (BLOCK_CENTER * 256 - (b.x + b.w / 2)) / 256;
  if (!b.onGround) return ['jump'];
  if (dx > 2) return ['right'];
  if (dx < -2) return ['left'];
  if (b.vx !== 0) return [];
  return frame % 2 === 0 ? ['jump'] : [];
}

function liveGoombas(w: World): Goomba[] {
  return w.entities.filter((e): e is Goomba => e instanceof Goomba && e.alive && e.contactHurts);
}

describe.each<[string, CharacterDef]>([
  ['Mario', MARIO],
  ['Luigi', LUIGI],
])('%s power-ups', (_name, hero) => {
  it('a star from a block makes contact kill the goomba', () => {
    const r = runSim({
      level: itemField('*'),
      character: hero,
      script: { steps: [] },
      maxFrames: 900,
      controller: (w, f) => collectItem(w, f, w.player.star > 0),
      // The goomba spawns once the camera scrolls to it; the star contact scores it 100.
      until: (w) => w.player.star > 0 && w.state.score >= 1000 + 100,
    });
    expect(r.outcome).toBe('stopped');
    expect(r.world.player.star).toBeGreaterThan(0);
    expect(r.world.player.powerState).toBe('small'); // the goomba never hurt him
    expect(liveGoombas(r.world)).toHaveLength(0);
  });

  it('a hidden 1-Up block pops a mushroom that adds a life', () => {
    const r = runSim({
      level: itemField('1'),
      character: hero,
      script: { steps: [] },
      maxFrames: 900,
      state: { lives: 3 },
      controller: (w, f) => collectItem(w, f, w.state.lives > 3),
      until: (w) => w.state.lives > 3,
    });
    expect(r.outcome).toBe('stopped');
    expect(r.lives).toBe(4);
  });
});
