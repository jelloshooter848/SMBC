import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap, serializeTextMap } from '@game/level/textmap';
import { DEFAULT_LEGEND, T, TILES, tileDef } from '@game/level/tiles';
import type { LevelData } from '@game/level/schema';
import { getLevel, levelIds } from '.';
import { PALETTES, SPRITES } from '@content/sprites';
import { AssetRegistry } from '@engine/assets/registry';
import { NullRenderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { decorInFront, drawDecor } from '@game/entities/objects/decoration';
import type { View } from '@game/entities/entity';

// Owner design (3-1 coin heaven, Mega Man): past the end of the clouds a coin trail leads over
// two small cloud platforms to a hidden block holding a teleport pad; standing on the pad beams
// the player up to a space station (3-1-station) where captive Mega Man waits, and its return
// pad beams the player back down into 3-1 exactly where the coin heaven's own drop lands.

const load = (id: string): LevelData =>
  parseTextMap(readFileSync(join(import.meta.dirname, 'world3', `${id}.map`), 'utf8'), id);
const tile = (l: LevelData, x: number, y: number) => l.tiles[y * l.width + x];
const coinsIn = (l: LevelData, x0: number, x1: number, y0: number, y1: number): string[] => {
  const rows: string[] = [];
  for (let y = y0; y <= y1; y++) {
    let row = '';
    for (let x = x0; x <= x1; x++) row += tile(l, x, y) === T.COIN ? '$' : '.';
    rows.push(row);
  }
  return rows;
};
const cloudRun = (l: LevelData, y: number, x0: number, x1: number) => {
  for (let x = x0; x <= x1; x++) expect(tile(l, x, y), `${x},${y}`).toBe(T.CLOUD_BLOCK);
};

describe('the hidden teleporter block tile', () => {
  it('is a hidden block holding a teleport pad, written `8` in maps, added after every older tile', () => {
    expect(tileDef(T.HIDDEN_TELEPORTER).block).toEqual({ kind: 'hidden', content: 'teleporter' });
    expect(tileDef(T.HIDDEN_TELEPORTER).collision).toBe('none');
    expect(tileDef(T.HIDDEN_TELEPORTER).name).toBe('hidden-teleporter');
    expect(DEFAULT_LEGEND['8']).toBe(T.HIDDEN_TELEPORTER);
    // Appended, so saved custom levels (tile ids) keep their meaning.
    expect(T.HIDDEN_TELEPORTER).toBe(TILES.length - 1);
    expect(T.HIDDEN_TELEPORTER).toBe(T.HIDDEN_VINE + 1);
  });
});

describe('the teleport zone', () => {
  it('parses with its defaults and options, and writes back the same', () => {
    const src = [
      'id: t',
      '[tiles]',
      ...Array.from({ length: 15 }, () => '................'),
      '[zones]',
      'teleport 3 12 -> 1-1 4 12',
      'teleport 9 10 -> 2-1 162 0 exit=fall block=8,6',
    ].join('\n');
    const l = parseTextMap(src, 't');
    expect(l.zones).toEqual([
      { kind: 'teleport', x: 3, y: 12, target: { level: '1-1', x: 4, y: 12, exitDir: 'beam' } },
      {
        kind: 'teleport',
        x: 9,
        y: 10,
        target: { level: '2-1', x: 162, y: 0, exitDir: 'fall' },
        block: { x: 8, y: 6 },
      },
    ]);
    expect(parseTextMap(serializeTextMap(l), 't').zones).toEqual(l.zones);
  });

  it('rejects a bad exit or block', () => {
    const base = ['id: t', '[tiles]', ...Array.from({ length: 15 }, () => '................'), '[zones]'];
    expect(() => parseTextMap([...base, 'teleport 1 1 -> 1-1 1 1 exit=up'].join('\n'))).toThrow();
    expect(() => parseTextMap([...base, 'teleport 1 1 -> 1-1 1 1 block=8'].join('\n'))).toThrow();
    expect(() => parseTextMap([...base, 'teleport 1 1 1-1 1 1'].join('\n'))).toThrow();
  });
});

describe('3-1 sky: the way up to the space station', () => {
  const l = load('3-1-sky');

  it('a coin trail past the end of the clouds, hopping over the platforms up to the hidden block', () => {
    expect(tile(l, 82, 13)).toBe(T.CLOUD_BLOCK);
    expect(tile(l, 83, 13)).toBe(T.AIR);
    expect(coinsIn(l, 83, 92, 8, 11)).toEqual([
      '........$.', //
      '.....$$.$.',
      '$$.....$..',
      '..$$$.....',
    ]);
  });

  it('two small cloud platforms; the hidden teleporter block over the second, the pad beside it', () => {
    cloudRun(l, 12, 85, 87);
    cloudRun(l, 11, 90, 94);
    for (const x of [83, 84, 88, 89, 95])
      for (let y = 10; y <= 13; y++) expect(tile(l, x, y), `${x},${y}`).not.toBe(T.CLOUD_BLOCK);
    // Four rows above the platform, like 2-1's hidden vine block: a normal jump bumps it.
    expect(tile(l, 91, 7)).toBe(T.HIDDEN_TELEPORTER);
    for (let y = 8; y <= 10; y++) expect(tileDef(tile(l, 91, y) as number).collision).toBe('none');
    // The pad lies on the platform two tiles to the right of the block, hidden in it until bumped.
    expect(l.zones).toContainEqual({
      kind: 'teleport',
      x: 93,
      y: 10,
      target: { level: '3-1-station', x: 3, y: 12, exitDir: 'beam' },
      block: { x: 91, y: 7 },
    });
    expect(tile(l, 93, 10)).toBe(T.AIR);
    expect(tile(l, 93, 11)).toBe(T.CLOUD_BLOCK);
  });

  it('the old drop still lands in 3-1 at column 162 anywhere off the clouds', () => {
    expect(l.zones).toContainEqual({ kind: 'pit', x: 0, target: { level: '3-1', x: 162, y: 0 } });
    for (let x = 83; x < l.width; x++) expect(tile(l, x, 13), `${x}`).toBe(T.AIR);
    expect(l.width).toBe(96);
  });
});

describe('the space station (3-1-station)', () => {
  const l = load('3-1-station');

  it('is a 3-1 sub-area, beamed down into, keeping the running clock', () => {
    expect(l.parent).toBe('3-1');
    expect([l.world, l.stage]).toEqual([3, 1]);
    expect(l.time).toBeNull();
    expect(l.startMode).toBe('beam');
    expect(l.start).toEqual({ x: 3, y: 12 });
    expect(l.theme).toBe('station');
    expect(l.music).toBe('mm-station'); // the theme's own music
    expect(l.width).toBeGreaterThanOrEqual(32);
    expect(l.width).toBeLessThanOrEqual(48);
  });

  it('is in the level library like the other sub-areas', () => {
    expect(levelIds()).toContain('3-1-station');
    expect(getLevel('3-1-station').parent).toBe('3-1');
  });

  it('a solid floor all the way: no pit to fall in', () => {
    for (let x = 0; x < l.width; x++)
      expect(tileDef(tile(l, x, 13) as number).collision, `${x}`).toBe('solid');
    expect(l.zones.filter((z) => z.kind === 'pit')).toEqual([]);
  });

  it('the arrival pad under the start, and the return pad past Mega Man, both down to 3-1 at 162', () => {
    const back = { level: '3-1', x: 162, y: 0, exitDir: 'fall' };
    expect(l.zones).toContainEqual({ kind: 'teleport', x: 3, y: 12, target: back });
    expect(l.zones).toContainEqual({ kind: 'teleport', x: 44, y: 12, target: back });
    // Exactly where (and how) the coin heaven's own drop lands.
    const pit = load('3-1-sky').zones.find((z) => z.kind === 'pit');
    expect(pit?.kind === 'pit' && { ...pit.target, exitDir: 'fall' }).toEqual(back);
    for (const x of [3, 44]) {
      expect(tileDef(tile(l, x, 12) as number).collision).toBe('none');
      expect(tileDef(tile(l, x, 13) as number).collision).toBe('solid');
    }
  });

  it('captive Mega Man stands on the command deck floor, under the big window', () => {
    expect(l.entities).toContainEqual({ type: 'captive', x: 38, y: 12, props: { hero: 'megaman' } });
    expect(tileDef(tile(l, 38, 12) as number).collision).toBe('none');
    expect(tileDef(tile(l, 38, 11) as number).collision).toBe('none');
    expect(tileDef(tile(l, 38, 13) as number).collision).toBe('solid');
    expect(l.decor).toContainEqual({ kind: 'station:window', x: 37, y: 8 });
  });

  it('station decor: windows (stars and Earth), consoles and girders', () => {
    const kinds = l.decor.map((d) => d.kind);
    expect(kinds.filter((k) => k === 'station:window').length).toBeGreaterThanOrEqual(2);
    expect(kinds).toContain('station:console');
    expect(kinds).toContain('station:girder');
  });
});

describe('every bundled level: teleport pads', () => {
  it('each pad hidden in a block points at a hidden teleporter block (`8`)', () => {
    let hidden = 0;
    for (const id of levelIds()) {
      const l = getLevel(id);
      for (const z of l.zones) {
        if (z.kind !== 'teleport' || !z.block) continue;
        hidden++;
        expect(tile(l, z.block.x, z.block.y), `${id} block=${z.block.x},${z.block.y}`).toBe(
          T.HIDDEN_TELEPORTER,
        );
      }
    }
    expect(hidden).toBeGreaterThanOrEqual(1);
  });

  it('every pad targets a bundled level, and lies on a solid floor', () => {
    for (const id of levelIds()) {
      const l = getLevel(id);
      for (const z of l.zones) {
        if (z.kind !== 'teleport') continue;
        expect(() => getLevel(z.target.level), id).not.toThrow();
        expect(tileDef(tile(l, z.x, z.y + 1) as number).collision, `${id} ${z.x},${z.y}`).toBe('solid');
      }
    }
  });
});

describe('the station interior', () => {
  const l = load('3-1-station');
  it('is a room: dark bulkhead wall tiles fill the background, a conduit along the top', () => {
    for (let x = 1; x < l.width - 1; x++) {
      const t = tile(l, x, 3);
      expect([T.WALL_TOP, T.HARD], `${x},3`).toContain(t);
      for (let y = 4; y <= 12; y++) {
        const id = tile(l, x, y) as number;
        expect([T.WALL, T.HARD], `${x},${y}`).toContain(id); // no coins: a coin cell would show black
      }
    }
    expect(tileDef(T.WALL).collision).toBe('none'); // background only: collision unchanged
  });
});

describe('`sheet:frame` decor (game and editor draw it the same way)', () => {
  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const view: View = { camX: 0, frame: 0, assets, theme: 'station', reduceFlashing: true };
  const drawn = (kind: string) => {
    const out: { sheet: string; frame: string; x: number; y: number }[] = [];
    const r = Object.assign(new NullRenderer(), {
      sprite(s: SpriteSheet, frame: string, x: number, y: number): void {
        out.push({ sheet: s.id, frame, x, y });
      },
    });
    drawDecor(r, view, kind, 64, 128);
    return out;
  };

  it('draws that frame of the other sheet, bottom-anchored, in front of the tiles', () => {
    expect(drawn('station:window')).toEqual([{ sheet: 'station', frame: 'window', x: 64, y: 96 }]);
    expect(drawn('station:console')).toEqual([{ sheet: 'station', frame: 'console', x: 64, y: 112 }]);
    expect(decorInFront('station:girder')).toBe(true);
    expect(decorInFront('cloud-1')).toBe(false);
  });

  it('classic decor still comes from the decor sheet; an unknown frame draws nothing', () => {
    expect(drawn('cloud-1')[0]?.frame).toBe('cloud-1');
    expect(drawn('cloud-1')[0]?.sheet).toMatch(/^decor@/);
    expect(drawn('station:nothing')).toEqual([]);
  });
});
