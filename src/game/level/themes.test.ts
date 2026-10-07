import { describe, expect, it } from 'vitest';
import { PALETTES } from '@content/sprites';
import { tilesDef } from '@content/sprites/tiles';
import { parseTextMap, serializeTextMap } from './textmap';
import { THEMES, isTheme, isWaterTheme, themeMusic, type Theme } from './schema';
import { SKY } from '../world/tile-render';
import { decorPalette } from '../entities/objects/decoration';
import { enemyPalette } from '../entities/enemies/enemy';

const map = (header: string[]) =>
  parseTextMap(
    [
      'id: 9-9',
      ...header,
      'start: 1,12',
      '',
      '[tiles]',
      ...Array.from({ length: 13 }, () => '....'),
      '####',
      '####',
    ].join('\n'),
  );

const LOST_SKINS: Theme[] = [
  'mushroom',
  'clouds',
  'clouds-overworld',
  'overworld-water',
  'water-gray',
  'castle-overworld',
  'mushroom-red',
  'castle-water',
];

describe('themes', () => {
  it('lists the Lost Levels skins alongside the SMB1 themes', () => {
    expect(THEMES).toEqual([
      'overworld',
      'underground',
      'castle',
      'water',
      'night',
      'treetop',
      'snow',
      ...LOST_SKINS,
      'station',
      'cavern',
      'airship',
    ]);
    expect(new Set(THEMES).size).toBe(THEMES.length);
  });

  it.each(THEMES)('%s parses, serializes and parses back unchanged', (theme) => {
    const lvl = map([`theme: ${theme}`, 'music: water']);
    expect(lvl.theme).toBe(theme);
    expect(isTheme(theme)).toBe(true);
    const again = parseTextMap(serializeTextMap(lvl));
    expect(again.theme).toBe(theme);
    expect(again.music).toBe('water');
  });

  it('falls back to overworld for a missing or unknown theme', () => {
    expect(map([]).theme).toBe('overworld');
    expect(map(['theme: lava-land']).theme).toBe('overworld');
    expect(isTheme('lava-land')).toBe(false);
  });

  it('defaults the music by what a theme skins: water, castle, the station, the cavern or the overworld tune', () => {
    const music = Object.fromEntries(THEMES.map((t) => [t, map([`theme: ${t}`]).music]));
    expect(music).toEqual({
      overworld: 'overworld',
      underground: 'underground',
      castle: 'castle',
      water: 'water',
      night: 'overworld',
      treetop: 'overworld',
      snow: 'overworld',
      mushroom: 'overworld',
      clouds: 'overworld',
      'clouds-overworld': 'overworld',
      'overworld-water': 'water',
      'water-gray': 'water',
      'castle-overworld': 'castle',
      'mushroom-red': 'overworld',
      'castle-water': 'water',
      station: 'mm-station',
      cavern: 'cavern',
      airship: 'airship',
    });
    for (const t of THEMES) expect(themeMusic(t)).toBe(music[t]);
    // An explicit music line wins.
    expect(map(['theme: overworld-water', 'music: overworld']).music).toBe('overworld');
  });

  it('swims in the water theme and in the flooded overworld skins only', () => {
    expect(THEMES.filter(isWaterTheme)).toEqual(['water', 'overworld-water', 'water-gray', 'castle-water']);
  });

  it.each(THEMES)('%s has a sky, a tile palette and a decor palette', (theme) => {
    expect(SKY[theme]).toMatch(/^#[0-9a-f]{6}$/);
    const tiles = PALETTES.default[`tiles-${theme}`];
    expect(tiles).toHaveLength(12);
    expect(PALETTES.default[decorPalette(theme)]).toBeDefined();
  });

  it('draws platforms as mushrooms or cloud ledges in the Lost Levels skins', () => {
    const frames = tilesDef.frames;
    for (const t of ['mushroom', 'mushroom-red']) {
      expect(frames[`tree-top@${t}`]).toBe(frames['mushroom-top']);
      expect(frames[`tree-trunk@${t}`]).toBe(frames['mushroom-stem']);
    }
    for (const t of ['clouds', 'clouds-overworld']) {
      expect(frames[`tree-top@${t}`]).toBeDefined();
      expect(frames[`tree-top@${t}`]).not.toEqual(frames['tree-top']);
      expect(frames[`tree-trunk@${t}`]).toBeDefined();
    }
    // Sky levels stand on cloud banks; the overworld variant keeps its ground.
    expect(frames['ground@clouds']).toBeDefined();
    expect(frames['ground@clouds-overworld']).toBeUndefined();
  });

  it('gives each new skin a look of its own', () => {
    const look = (t: Theme) =>
      JSON.stringify([SKY[t], PALETTES.default[`tiles-${t}`], PALETTES.default[decorPalette(t)]]);
    // Palette differences (the cloud skins differ from the plain ones by their tile art).
    for (const t of ['mushroom', 'overworld-water', 'water-gray'] as Theme[]) {
      expect(look(t)).not.toBe(look('overworld'));
      expect(look(t)).not.toBe(look('water'));
    }
    expect(look('water-gray')).not.toBe(look('overworld-water'));
    // The red giant mushrooms are the orange ones' art in other colours.
    expect(look('mushroom-red')).not.toBe(look('overworld'));
    expect(look('mushroom-red')).not.toBe(look('mushroom'));
    const cap = (t: Theme) => PALETTES.default[`tiles-${t}`]?.[0xb];
    expect(cap('mushroom-red')).not.toBe(cap('mushroom'));
    // A swim through a castle: the castle's darkness, stone, scenery and enemies.
    expect(SKY['castle-water']).toBe(SKY.castle);
    expect(PALETTES.default['tiles-castle-water']).toEqual(PALETTES.default['tiles-castle']);
    expect(decorPalette('castle-water')).toBe(decorPalette('castle'));
    expect(enemyPalette('castle-water')).toBe(enemyPalette('castle'));
    expect(tilesDef.frames['ground@castle-water']).toBe(tilesDef.frames['ground@castle']);
    // A castle under the daylight sky: castle bricks in the overworld palette.
    expect(SKY['castle-overworld']).toBe(SKY.overworld);
    expect(SKY['castle-overworld']).not.toBe(SKY.castle);
    expect(PALETTES.default['tiles-castle-overworld']).toEqual(PALETTES.default['tiles-overworld']);
  });

  it("dresses Mega Man's station in its own steel: tiles, sky, scenery and robots' fallbacks", () => {
    const frames = tilesDef.frames;
    // The tiles a platform stage stands on are redrawn, not just recoloured.
    for (const t of [
      'ground',
      'hard',
      'brick',
      'used',
      'castle-brick',
      'tree-top',
      'tree-trunk',
      'bridge',
      'wall',
      'wall-top',
    ]) {
      expect(frames[`${t}@station`], t).toBeDefined();
      expect(frames[`${t}@station`], t).not.toEqual(frames[t]);
    }
    // Space is black; the plating has a palette of its own; dark-theme scenery and enemies.
    expect(SKY.station).toBe('#000000');
    expect(PALETTES.default['tiles-station']).not.toEqual(PALETTES.default['tiles-castle']);
    expect(decorPalette('station')).toBe(decorPalette('castle'));
    expect(enemyPalette('station')).toBe(enemyPalette('castle'));
    expect(isWaterTheme('station')).toBe(false);
  });

  it("dresses Samus's cavern in bubbly blue rock: tiles, a near-black sky, rock scenery", () => {
    const frames = tilesDef.frames;
    // The tiles a cavern is built of are redrawn, not just recoloured.
    for (const t of [
      'ground',
      'hard',
      'brick',
      'used',
      'castle-brick',
      'tree-top',
      'tree-trunk',
      'bridge',
      'wall',
      'wall-top',
    ]) {
      expect(frames[`${t}@cavern`], t).toBeDefined();
      expect(frames[`${t}@cavern`], t).not.toEqual(frames[t]);
      expect(frames[`${t}@cavern`], t).not.toEqual(frames[`${t}@station`]);
    }
    // The bomb-able rock is not the plain rock: it shows its cracks.
    expect(frames['brick@cavern']).not.toEqual(frames['ground@cavern']);
    expect(frames['brick@cavern']).not.toEqual(frames['hard@cavern']);
    // A near-black sky, darker than any lit theme but not the castle's pure black.
    const sky = SKY.cavern as string;
    expect(sky).not.toBe(SKY.castle);
    const [r, g, b] = [1, 3, 5].map((k) => parseInt(sky.slice(k, k + 2), 16)) as [number, number, number];
    expect(Math.max(r, g, b)).toBeLessThan(0x30);
    // Blue rock: the block colours lean blue, unlike the underground's or the station's.
    const tiles = PALETTES.default['tiles-cavern'] as string[];
    for (const i of [2, 3]) {
      const c = tiles[i] as string;
      const [cr, , cb] = [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16)) as [number, number, number];
      expect(cb, `index ${i} is blue`).toBeGreaterThan(cr * 2);
    }
    expect(tiles).not.toEqual(PALETTES.default['tiles-underground']);
    expect(tiles).not.toEqual(PALETTES.default['tiles-station']);
    // Bushes, hills and ruin pillars in rock colours; enemies in the underground's blue.
    expect(decorPalette('cavern')).toBe('decor-cavern');
    expect(PALETTES.default['decor-cavern']).not.toEqual(PALETTES.default['decor-night']);
    expect(enemyPalette('cavern')).toBe(enemyPalette('underground'));
    expect(isWaterTheme('cavern')).toBe(false);
  });

  it("builds Larry's airship from its own planks and iron under a night sky", () => {
    const frames = tilesDef.frames;
    for (const t of [
      'ground',
      'hard',
      'brick',
      'used',
      'castle-brick',
      'tree-top',
      'tree-trunk',
      'bridge',
      'wall',
      'wall-top',
    ]) {
      expect(frames[`${t}@airship`], t).toBeDefined();
      expect(frames[`${t}@airship`], t).not.toEqual(frames[t]);
      expect(frames[`${t}@airship`], t).not.toEqual(frames[`${t}@station`]);
    }
    // A dark navy night: darker than the overworld's blue, not the castle's or space's black.
    expect(SKY.airship).not.toBe(SKY.overworld);
    expect(SKY.airship).not.toBe('#000000');
    const [r, g, b] = [1, 3, 5].map((k) => parseInt((SKY.airship as string).slice(k, k + 2), 16)) as [
      number,
      number,
      number,
    ];
    expect(b).toBeGreaterThan(r + g);
    expect(r + g + b).toBeLessThan(0x80);
    // Wood and iron of its own; dark-theme scenery and enemies; no swimming; its own tune.
    const tiles = PALETTES.default['tiles-airship'];
    for (const other of ['tiles-overworld', 'tiles-castle', 'tiles-station'])
      expect(tiles, other).not.toEqual(PALETTES.default[other]);
    expect(decorPalette('airship')).toBe(decorPalette('castle'));
    expect(enemyPalette('airship')).toBe(enemyPalette('castle'));
    expect(isWaterTheme('airship')).toBe(false);
    expect(themeMusic('airship')).toBe('airship');
  });

  it("Larry's cabin: a floor of log posts in front of a wall of horizontal logs", () => {
    const frame = (name: string) => tilesDef.frames[name] as readonly string[];
    const top = frame('ground@airship');
    const body = frame('castle-brick@airship');
    // the floor's top is a rounded cap: dark corners on the first row, a full post below it
    expect(top[0]?.[0]).not.toBe('3');
    expect(top[0]?.slice(4, 12)).toMatch(/^0+$/);
    expect(top.join('')).not.toContain('.');
    // below the cap the post carries straight on down into the post body (same columns), and the
    // body tiles vertically: every row is one post, black-edged both sides
    const strip = (rows: readonly string[]) => rows.map((r) => r.replace(/1/g, '2'));
    expect(strip(top.slice(3))).toEqual(strip(body.slice(3, 16)));
    for (const r of body) expect(r).toMatch(/^0[0-3]{14}0$/);
    // the back wall: logs lying sideways, a black seam across the whole tile, never the lit tone
    const wall = frame('wall@airship');
    expect(wall[0]).toMatch(/^0+$/);
    expect(wall.at(-1)).toMatch(/^0+$/);
    expect(wall.join('')).not.toMatch(/[3.]/);
    expect(top.join('')).toMatch(/3/);
  });
});
