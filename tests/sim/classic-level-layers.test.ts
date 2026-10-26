import { describe, expect, it } from 'vitest';
import { getLevel, levelIds } from '@content/levels';
import { heroVariant } from '@game/level/variants';
import { layeredLevel, layerFlags } from '@game/level/layers';
import { parseTextMap, serializeTextMap } from '@game/level/textmap';
import type { LevelData, LayerFlag } from '@game/level/schema';
import { T, isSolid } from '@game/level/tiles';
import { TileMap } from '@game/world/tilemap';
import { CLASSIC_CHARACTERS, CLASSIC_EXTRAS, CLASSIC_SKINS, heroFor } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { FLOOR_JUMPER_EDITS, applyEdits } from '@game/rules/classic-water';
import { WIDE_VARIANTS } from '@game/rules/classic-level-variants';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { SIMON } from '@game/characters/simon';
import { RYU } from '@game/characters/ryu';
import { SOPHIA } from '@game/characters/sophia';
import { SAMUS } from '@game/characters/samus';
import { BASS_CLASSIC as BASS } from '@game/characters/bass/classic';

// G-010, G-011, G-012, G-006: the original builds each level for the map difficulty and the hero
// (Level.as buildLevel 757-787). tools/levelgen/convert-smbc.mjs --layers writes everything the
// .map files leave out as layers (src/content/level-layers/), and a Classic World lays the ones
// for its heroes' level flags (each Classic def declares them) and the run's Map Difficulty.

const SOPHIA_FLAGS = layerFlags([heroFor(SOPHIA, 'classic')]);
const normal = (flags: readonly LayerFlag[]) => ({ difficulty: 'normal' as const, flags });
const spawnKeys = (l: LevelData) =>
  l.entities
    .filter((e) => e.type !== 'partner' && e.props?.campaign !== true)
    .map((e) => `${e.type} ${e.x} ${e.y}`)
    .sort();
const cell = (l: LevelData, x: number, y: number) => l.tiles[y * l.width + x];

/** The cells where two copies of a level differ, as "x,y". */
function diffCells(a: LevelData, b: LevelData): string[] {
  const out: string[] = [];
  for (let i = 0; i < a.tiles.length; i++)
    if (a.tiles[i] !== b.tiles[i]) out.push(`${i % a.width},${Math.floor(i / a.width)}`);
  return out;
}

describe('G-010: each Classic def declares its level flags', () => {
  const defs = new Set<CharacterDef>([
    ...(Object.values(CLASSIC_CHARACTERS) as CharacterDef[]),
    ...CLASSIC_EXTRAS,
    // A skin list starts with its slot's hero as the Campaign def (the World plays heroFor's).
    ...Object.values(CLASSIC_SKINS)
      .flat()
      .map((d) => heroFor(d, 'classic')),
  ]);
  it('every Classic def (heroes, extras, looks) has levelFlags', () => {
    for (const d of defs) expect(d.levelFlags, d.id).toBeDefined();
  });

  it("every look has its host's flags in the original (MegaMan.as, Samus.as, Luigi's MarioBase)", () => {
    const f = (d: CharacterDef) => layerFlags([heroFor(d, 'classic')]).sort();
    const host = { megaman: ['badswimmer', 'horz'], samus: ['badswimmer', 'horz'], luigi: [] as string[] };
    for (const [slot, list] of Object.entries(CLASSIC_SKINS))
      for (const d of list)
        if (slot in host) expect(f(d), `${slot}: ${d.id}`).toEqual(host[slot as keyof typeof host]);
  });

  it("the original's flags (Character.as and each hero's file)", () => {
    const f = (d: CharacterDef) => layerFlags([heroFor(d, 'classic')]).sort();
    expect(f(MARIO)).toEqual([]);
    expect(f(LINK)).toEqual(['badswimmer', 'horz', 'vert']);
    expect(f(SAMUS)).toEqual(['badswimmer', 'horz']);
    expect(f(SIMON)).toEqual(['badswimmer', 'horz', 'poorbowser']);
    expect(f(RYU)).toEqual(['badswimmer', 'horz', 'poorbowser', 'vert']);
    expect(f(SOPHIA)).toEqual(['horz', 'vert', 'wide']);
    // Bass.as:102-103: no helper pieces (not Mega Man's `horz`, whose factory his def spreads).
    expect(f(BASS)).toEqual(['badswimmer']);
  });

  it('no Campaign def has level flags', async () => {
    const { CHARACTERS } = await import('@game/characters/registry');
    for (const d of CHARACTERS) expect(d.levelFlags, d.id).toBeUndefined();
  });
});

describe('G-010: the layers hold the pieces the hand-made Sophia sections and tables held', () => {
  it("1-1's flagpole lift (charHorz) is laid for Link under Classic rules only", () => {
    const level = getLevel('1-1');
    const lift = (l: LevelData) => l.entities.some((e) => e.type === 'lift-fall' && e.x === 193 && e.y === 4);
    const play = (character: CharacterDef, rules: 'classic' | 'campaign') =>
      runSim({ level, character, rules, script: { steps: [] }, maxFrames: 1 }).world.level;
    expect(lift(play(LINK, 'classic'))).toBe(true);
    expect(lift(play(SOPHIA, 'classic'))).toBe(true);
    expect(lift(play(MARIO, 'classic'))).toBe(false);
    expect(lift(play(LINK, 'campaign'))).toBe(false);
  });

  it("every `[variant sophia classic]` section's pieces are in Sophia's layers", () => {
    // The sections laid a few of the original's pieces by hand; the layers have all of them (the
    // original's data holds more for her than the sections did: ll-1-3's tree tops, for one).
    const misses: string[] = [];
    let checked = 0;
    for (const id of levelIds()) {
      const level = getLevel(id);
      const sections = (level.variants ?? []).filter((v) => v.hero === 'sophia' && v.classic);
      if (!sections.length || !level.layers) continue;
      checked++;
      const hand = heroVariant(level, ['sophia'], false);
      const ours = layeredLevel(level, normal(SOPHIA_FLAGS));
      for (const v of sections) {
        for (const r of v.tiles)
          r.tiles.forEach((t, i) => {
            if (cell(ours, r.x + i, r.y) !== t) misses.push(`${id} ${r.x + i},${r.y}`);
          });
        const have = spawnKeys(ours);
        for (const e of v.add ?? [])
          if (!have.includes(`${e.type} ${e.x} ${e.y}`)) misses.push(`${id} + ${e.type}`);
        for (const e of v.remove ?? [])
          if (
            have.includes(`${e.type} ${e.x} ${e.y}`) &&
            !spawnKeys(hand).includes(`${e.type} ${e.x} ${e.y}`)
          )
            misses.push(`${id} - ${e.type} ${e.x} ${e.y}`);
      }
    }
    expect(checked).toBeGreaterThan(60);
    expect(misses).toEqual([]);
  });

  it("the wide heroes' table (rules/classic-level-variants.ts) is in the wide layers", () => {
    for (const [id, v] of Object.entries(WIDE_VARIANTS)) {
      const ours = layeredLevel(getLevel(id), normal(SOPHIA_FLAGS));
      for (const [x, y, t] of v.tiles) expect(cell(ours, x, y), `${id} ${x},${y}`).toBe(t);
      for (const m of v.moves ?? [])
        expect(
          ours.entities.some((e) => e.type === m.type && e.x === m.to[0] && e.y === m.to[1]),
          `${id} ${m.type}`,
        ).toBe(true);
    }
  });

  it('G-011: the stepping stones for floor jumpers (2-2, 7-2) are in the bad swimmer layers', () => {
    for (const [id, edits] of Object.entries(FLOOR_JUMPER_EDITS)) {
      const level = getLevel(id);
      const ours = layeredLevel(level, normal(['badswimmer', 'horz']));
      const map = new TileMap(level);
      applyEdits(map, edits);
      // The original's are coral ground (`groundCoral`); the table's were hard blocks: solid both.
      for (const [x, y] of edits.blocks) expect(isSolid(cell(ours, x, y) ?? 0), `${id} ${x},${y}`).toBe(true);
      for (const [, [x, y]] of edits.coins) expect(cell(ours, x, y), `${id} coin ${x},${y}`).toBe(T.COIN);
    }
  });
});

describe('G-011, G-012: Lost Levels bad swimmer pieces and the poor Bowser fighter blocks', () => {
  const withFlag = (flag: LayerFlag) =>
    levelIds().filter((id) => getLevel(id).layers?.some((l) => l.flags.includes(flag)));

  it('the Lost Levels have bad swimmer layers (water areas)', () => {
    const lost = withFlag('badswimmer').filter((id) => id.startsWith('ll-'));
    expect(lost.length).toBeGreaterThan(3);
  });

  it("Simon and Ryu get extra blocks before Bowser that Link and Mario don't", () => {
    const castles = withFlag('poorbowser');
    expect(castles.length).toBeGreaterThan(3);
    const flags = (d: CharacterDef) => layerFlags([heroFor(d, 'classic')]);
    for (const id of castles) {
      const level = getLevel(id);
      for (const l of level.layers ?? []) {
        // A difficulty's own layer may take the piece back out (7-4 on Hard): its any-difficulty layer is checked.
        if (!l.flags.includes('poorbowser') || l.difficulty) continue;
        const difficulty = l.difficulty ?? 'normal';
        const as = (d: CharacterDef) => layeredLevel(level, { difficulty, flags: flags(d) });
        for (const fighter of [SIMON, RYU]) {
          const differs =
            diffCells(as(fighter), as(LINK)).length > 0 ||
            spawnKeys(as(fighter)).join() !== spawnKeys(as(LINK)).join();
          expect(differs, `${id} ${difficulty} ${fighter.id}`).toBe(true);
        }
        expect(diffCells(as(MARIO), layeredLevel(level, { difficulty, flags: [] })).length).toBe(0);
      }
    }
  });
});

describe('G-006: Map Difficulty layers', () => {
  it('every converted area has an Easy and a Hard layer, and Hard 1-1 has its Lakitu', () => {
    const hard = layeredLevel(getLevel('1-1'), { difficulty: 'hard', flags: [] });
    expect(hard.entities.some((e) => e.type === 'lakitu')).toBe(true);
    expect(getLevel('1-1').entities.some((e) => e.type === 'lakitu')).toBe(false);
    const converted = levelIds().filter((i) => getLevel(i).layers?.length);
    // Every area convert-smbc.mjs made: SMB1's 61 and The Lost Levels' 110.
    expect(converted.length).toBe(171);
    for (const id of converted) {
      const ls = getLevel(id).layers ?? [];
      expect(
        ls.some((l) => l.difficulty === 'easy' && !l.flags.length),
        id,
      ).toBe(true);
      expect(
        ls.some((l) => l.difficulty === 'hard' && !l.flags.length),
        id,
      ).toBe(true);
    }
  });

  it("Hard 1-2's top pipe keeps its junction and its right-facing end (groundPipeIntRight*, EndRight*)", () => {
    const hard = layeredLevel(getLevel('1-2'), { difficulty: 'hard', flags: [] });
    for (const y of [2, 3]) {
      expect(isSolid(cell(hard, 169, y) ?? 0), `169,${y}`).toBe(true);
      expect(isSolid(cell(hard, 176, y) ?? 0), `176,${y}`).toBe(true);
    }
    expect([cell(hard, 176, 2), cell(hard, 176, 3)]).toEqual([T.PIPE_H_TL, T.PIPE_H_BL]);
  });

  it("Easy and Hard open the locked castles' checkpoints (Level.as:1454)", () => {
    const cp = (l: LevelData) => l.zones.filter((z) => z.kind === 'checkpoint').length;
    for (const id of ['1-4', '8-1', 'll-7-4']) {
      const level = getLevel(id);
      expect(cp(level), id).toBe(0);
      expect(cp(layeredLevel(level, { difficulty: 'easy', flags: [] })), id).toBeGreaterThan(0);
      expect(cp(layeredLevel(level, { difficulty: 'hard', flags: [] })), id).toBeGreaterThan(0);
    }
  });

  it('a Classic World is built for the run difficulty; a Campaign one never is', () => {
    const level = getLevel('1-1');
    const run = (rules: 'classic' | 'campaign') =>
      runSim({ level, character: MARIO, rules, mapDifficulty: 'hard', script: { steps: [] }, maxFrames: 1 })
        .world;
    expect(run('classic').mapDifficulty).toBe('hard');
    expect(run('classic').level.entities.some((e) => e.type === 'lakitu')).toBe(true);
    expect(run('campaign').mapDifficulty).toBe('normal');
    expect(run('campaign').level).toBe(level);
  });
});

describe('the [layer] format', () => {
  const src = [
    'id: t',
    '',
    '[tiles]',
    ...Array.from({ length: 15 }, (_, y) => (y >= 13 ? '#'.repeat(20) : '.'.repeat(20))),
    '',
    '[layer hard]',
    '3 10 ==',
    '+ goomba 6 12',
    '+zone checkpoint 8 12',
    'start 4 12 stand',
    '',
    '[layer horz]',
    '3 10 .',
    '',
    '[layer hard horz]',
    '- goomba 6 12',
  ].join('\n');

  it('parses, lays in order by difficulty and flags, and writes back the same', () => {
    const level = parseTextMap(src);
    expect(level.layers?.length).toBe(3);
    const hard = layeredLevel(level, { difficulty: 'hard', flags: [] });
    expect([cell(hard, 3, 10), cell(hard, 4, 10)]).toEqual([T.BRICK, T.BRICK]);
    expect(hard.entities.map((e) => e.type)).toEqual(['goomba']);
    expect(hard.zones).toEqual([{ kind: 'checkpoint', x: 8, y: 12 }]);
    expect(hard.start).toEqual({ x: 4, y: 12 });
    const hardHorz = layeredLevel(level, { difficulty: 'hard', flags: ['horz', 'vert'] });
    expect([cell(hardHorz, 3, 10), cell(hardHorz, 4, 10)]).toEqual([T.AIR, T.BRICK]);
    expect(hardHorz.entities).toEqual([]);
    expect(layeredLevel(level, { difficulty: 'normal', flags: [] })).toBe(level);
    expect(layeredLevel(level, { difficulty: 'easy', flags: ['horz'] }).tiles).toEqual(level.tiles);
    expect(parseTextMap(serializeTextMap(level)).layers).toEqual(level.layers);
  });

  it('refuses unknown words and two difficulties', () => {
    expect(() => parseTextMap(src.replace('[layer horz]', '[layer tall]'))).toThrow(/unknown layer word/);
    expect(() => parseTextMap(src.replace('[layer horz]', '[layer easy hard]'))).toThrow(
      /one map difficulty/,
    );
  });
});
