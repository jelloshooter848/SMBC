import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PALETTES, SPRITES } from '@content/sprites';
import { tilesDef } from '@content/sprites/tiles';
import { decorDef } from '@content/sprites/decor';
import { AssetRegistry } from '@engine/assets/registry';
import { NullRenderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { View } from '../entities/entity';
import { T, tileDef } from './tiles';
import { parseTextMap, serializeTextMap } from './textmap';
import { THEMES, isTheme, isWaterTheme, themeMusic, type Theme } from './schema';
import { SKY, STARRY_SKIES } from '../world/tile-render';
import { decorPalette, drawDecor } from '../entities/objects/decoration';
import { enemyPalette } from '../entities/enemies/enemy';
import { Vine } from '../entities/objects/vine';

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
      'airship-deck',
      'crypt',
      'castlevania',
      'dojo',
      'ninja-night',
      'ninja-city',
      'contra-jungle',
      'contra-falls',
      'alien-lair',
      'underworld',
      'bm-dungeon',
      'smw-secret',
      'zelda2',
      'megaman-stage',
      'brinstar',
      'tourian',
      // World 2 as Hyrule (0.4.24): 2-2's lake, 2-4's palace, 2-1's caves
      'zelda2-water',
      'zelda2-palace',
      'zelda2-cave',
      // World 3 as Mega Man's world (0.4.26): 3-1's bonus room, 3-2, 3-3, 3-4
      'megaman-metal',
      'megaman-wood',
      'megaman-air',
      'megaman-fortress',
      // World 4 as Samus's world, Zebes (0.4.27): 4-1 and 4-2's overworld areas, 4-3, 4-4
      'crateria',
      'norfair',
      'tourian-lair',
      // World 5 as Simon's world, Transylvania (0.4.28): 5-1, its bonus room, 5-2, its coin heaven
      // and water area, 5-3
      'cv-gate',
      'cv-catacomb',
      'cv-town',
      'cv-storm',
      'cv-lake',
      'cv-clock',
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
      'airship-deck': 'airship',
      crypt: 'crypt',
      castlevania: 'cv-hall',
      dojo: 'dojo',
      'ninja-night': 'ng-stage',
      'ninja-city': 'ng-city',
      'contra-jungle': 'contra-jungle',
      'contra-falls': 'contra-jungle',
      'alien-lair': 'contra-lair',
      underworld: 'bm-area',
      'bm-dungeon': 'bm-dungeon',
      'smw-secret': 'top-secret',
      zelda2: 'zelda2-field',
      'megaman-stage': 'mm-stage-31',
      brinstar: 'brinstar',
      tourian: 'tourian',
      'zelda2-water': 'zelda2-water',
      'zelda2-palace': 'zelda2-palace',
      'zelda2-cave': 'zelda2-cave',
      'megaman-metal': 'mm-station',
      'megaman-wood': 'mm-wood',
      'megaman-air': 'mm-air',
      'megaman-fortress': 'mm-wily',
      crateria: 'crateria',
      norfair: 'norfair',
      'tourian-lair': 'tourian',
      'cv-gate': 'cv-hall',
      'cv-catacomb': 'crypt',
      'cv-town': 'cv-town',
      'cv-storm': 'cv-town',
      'cv-lake': 'cv-lake',
      'cv-clock': 'cv-stage',
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

  it("sails Larry's airship deck under a daylight sky, in planks of its own", () => {
    const frames = tilesDef.frames;
    const frame = (name: string) => frames[name] as readonly string[];
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
      'blaster-top',
      'blaster-base',
    ]) {
      expect(frames[`${t}@airship-deck`], t).toBeDefined();
      expect(frames[`${t}@airship-deck`], t).not.toEqual(frames[t]);
      expect(frames[`${t}@airship-deck`], t).not.toEqual(frames[`${t}@airship`]);
    }
    // The deck planks tile both ways: opaque, seams on the edge rows, the joints lined up so a
    // tile's right column meets the next tile's left column like any other column of the plank.
    const deck = frame('ground@airship-deck');
    expect(deck.join('')).not.toContain('.');
    expect(deck[0]).toMatch(/^0+$/);
    expect(deck.at(-1)).not.toMatch(/0{16}/);
    expect(deck.join('')).toMatch(/3/);
    // `%` is the same planking with a round porthole: its edges are the plank's edges.
    const port = frame('castle-brick@airship-deck');
    const col = (rows: readonly string[], x: number) => rows.map((r) => r[x]).join('');
    for (const x of [0, 15]) expect(col(port, x), `column ${x}`).toBe(col(deck, x));
    for (const y of [0, 15]) expect(port[y], `row ${y}`).toBe(deck[y]);
    expect(port.slice(5, 11).join('')).toMatch(/0{4}/);
    // The hull behind (scenery) is darker than the deck: no lit or main wood, no holes.
    const wall = frame('wall@airship-deck');
    expect(wall.join('')).not.toMatch(/[23.]/);
    expect(wall.join('')).toContain('b');
    // The thin plank is a plank on air; the blaster is iron, not wood.
    const plank = frame('bridge@airship-deck');
    expect(plank.slice(8).join('')).toMatch(/^\.+$/);
    for (const b of ['blaster-top', 'blaster-base'])
      expect(frame(`${b}@airship-deck`).join(''), b).not.toMatch(/[123]/);
    // A daylight sky, lighter than SMB1's overworld blue, nothing like the cabin's night.
    const rgb = (hex: string) =>
      [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)) as [number, number, number];
    const sky = rgb(SKY['airship-deck'] as string);
    expect(SKY['airship-deck']).not.toBe(SKY.overworld);
    expect(Math.max(...sky)).toBe(sky[2]);
    expect(sky[0] + sky[1] + sky[2]).toBeGreaterThan(rgb(SKY.overworld as string).reduce((a, b) => a + b));
    // Warm wood (1-3), iron greys in the water slots (9, a), the dark hull in the lava slot (b).
    const tiles = PALETTES.default['tiles-airship-deck'] as string[];
    for (const other of ['tiles-overworld', 'tiles-airship', 'tiles-castle'])
      expect(tiles, other).not.toEqual(PALETTES.default[other]);
    for (const i of [1, 2, 3]) {
      const [r, , b] = rgb(tiles[i] as string);
      expect(r, `index ${i} is warm`).toBeGreaterThan(b);
    }
    for (const i of [9, 10]) {
      const [r, g, b] = rgb(tiles[i] as string);
      expect([g, b], `index ${i} is grey`).toEqual([r, r]);
    }
    const lum = (i: number) => rgb(tiles[i] as string).reduce((a, b) => a + b);
    expect(lum(11)).toBeLessThan(lum(1));
    expect(lum(1)).toBeLessThan(lum(2));
    expect(lum(2)).toBeLessThan(lum(3));
    // Daylight scenery (clouds) and enemies; no swimming; the airship's tune.
    expect(decorPalette('airship-deck')).toBe(decorPalette('overworld'));
    expect(enemyPalette('airship-deck')).toBe(enemyPalette('overworld'));
    expect(isWaterTheme('airship-deck')).toBe(false);
    expect(themeMusic('airship-deck')).toBe('airship');
  });

  it("lays Simon's crypt in grey stone and night-blue brick in the castle's dark", () => {
    const frames = tilesDef.frames;
    const frame = (name: string) => frames[name] as readonly string[];
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
      expect(frames[`${t}@crypt`], t).toBeDefined();
      expect(frames[`${t}@crypt`], t).not.toEqual(frames[t]);
      for (const other of ['station', 'cavern', 'airship'])
        expect(frames[`${t}@crypt`], `${t} vs ${other}`).not.toEqual(frames[`${t}@${other}`]);
    }
    // The breakable bricks are plainly not the solid masonry, and the hard block is carved.
    expect(frame('brick@crypt')).not.toEqual(frame('castle-brick@crypt'));
    expect(frame('hard@crypt')).not.toEqual(frame('ground@crypt'));
    // The floor and masonry are opaque stone; the backdrop is the blue slots and black only.
    for (const t of ['ground', 'castle-brick', 'brick', 'hard'])
      expect(frame(`${t}@crypt`).join(''), t).toMatch(/^[0-3]+$/);
    expect(frame('wall@crypt').join('')).toMatch(/^[09a]+$/);
    expect(frame('wall-top@crypt').slice(4)).toEqual(frame('wall@crypt').slice(4));
    // Grey stone shaded brown, unlike the castle's greys; blue backdrop bricks; a black sky.
    const tiles = PALETTES.default['tiles-crypt'] as string[];
    expect(tiles).not.toEqual(PALETTES.default['tiles-castle']);
    expect(tiles[1]).not.toBe(PALETTES.default['tiles-castle']?.[1]);
    const rgb = (hex: string) =>
      [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)) as [number, number, number];
    for (const i of [9, 10]) {
      const [r, g, b] = rgb(tiles[i] as string);
      expect(b, `index ${i} is blue`).toBeGreaterThan(r + g);
    }
    expect(SKY.crypt).toBe(SKY.castle);
    // Castle scenery and enemies; no swimming; its own tune.
    expect(decorPalette('crypt')).toBe(decorPalette('castle'));
    expect(enemyPalette('crypt')).toBe(enemyPalette('castle'));
    expect(isWaterTheme('crypt')).toBe(false);
    expect(themeMusic('crypt')).toBe('crypt');
  });

  it("builds Ryu's dojo of dark lacquered wood and shoji, and his moonlit town of grey stone", () => {
    const frames = tilesDef.frames;
    const frame = (name: string) => frames[name] as readonly string[];
    const dojoTiles = [
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
    ];
    for (const t of dojoTiles) {
      expect(frames[`${t}@dojo`], t).toBeDefined();
      expect(frames[`${t}@dojo`], t).not.toEqual(frames[t]);
      for (const other of ['station', 'cavern', 'airship', 'crypt'])
        expect(frames[`${t}@dojo`], `${t} vs ${other}`).not.toEqual(frames[`${t}@${other}`]);
    }
    for (const t of ['ground', 'hard', 'castle-brick', 'tree-top', 'tree-trunk', 'wall', 'wall-top']) {
      expect(frames[`${t}@ninja-night`], t).toBeDefined();
      expect(frames[`${t}@ninja-night`], t).not.toEqual(frames[`${t}@dojo`]);
    }
    // Solid wood and stone are opaque in the block indices; the backdrops are lattice and paper,
    // or the town's dark wall with one lit window (gold light).
    for (const t of ['ground', 'castle-brick', 'brick', 'hard'])
      expect(frame(`${t}@dojo`).join(''), t).toMatch(/^[0-3]+$/);
    // (the town's breakable bricks and bridges are the plain ones in its stone colours)
    for (const t of ['ground', 'castle-brick', 'hard'])
      expect(frame(`${t}@ninja-night`).join(''), t).toMatch(/^[0-3]+$/);
    expect(frame('wall@dojo').join('')).toMatch(/^[19a]+$/);
    expect(frame('wall-top@dojo').slice(4)).toEqual(frame('wall@dojo').slice(4));
    expect(frame('wall@ninja-night').join('')).toMatch(/^[079a]+$/);
    expect(frame('wall@ninja-night').join('')).toMatch(/7/);
    expect(frame('wall-top@ninja-night').slice(8)).toEqual(frame('wall@ninja-night').slice(8));
    // The floor boards run across: every board's top row is lit.
    expect(frame('ground@dojo').filter((r) => /^[03]+$/.test(r)).length).toBe(4);
    const rgb = (hex: string) =>
      [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)) as [number, number, number];
    // Wood: the block tones are warm (red over blue) and darken in order; the paper is lighter.
    const dojo = PALETTES.default['tiles-dojo'] as string[];
    const lum = (p: string[], i: number) => rgb(p[i] as string).reduce((a, b) => a + b);
    for (const i of [1, 2, 3]) {
      const [r, , b] = rgb(dojo[i] as string);
      expect(r, `dojo ${i} is warm`).toBeGreaterThan(b);
    }
    expect(lum(dojo, 1)).toBeLessThan(lum(dojo, 2));
    expect(lum(dojo, 2)).toBeLessThan(lum(dojo, 3));
    expect(lum(dojo, 9)).toBeGreaterThan(lum(dojo, 3));
    expect(dojo).not.toEqual(PALETTES.default['tiles-airship']);
    // The town: grey stone with indigo shadows under a violet night, its far walls darker still.
    const town = PALETTES.default['tiles-ninja-night'] as string[];
    const [r1, g1, b1] = rgb(town[1] as string);
    expect(b1).toBeGreaterThan(r1 + g1);
    expect(lum(town, 9)).toBeLessThan(lum(town, 1));
    expect(lum(town, 9)).toBeGreaterThan(lum([SKY['ninja-night'] as string], 0));
    expect(SKY.dojo).toBe(SKY.castle);
    // Night scenery for both; castle enemies indoors; no swimming; their own tunes.
    expect(decorPalette('dojo')).toBe(decorPalette('night'));
    expect(decorPalette('ninja-night')).toBe(decorPalette('night'));
    expect(enemyPalette('dojo')).toBe(enemyPalette('castle'));
    expect(enemyPalette('ninja-night')).toBe(enemyPalette('night'));
    for (const t of ['dojo', 'ninja-night'] as Theme[]) expect(isWaterTheme(t)).toBe(false);
    expect(themeMusic('dojo')).toBe('dojo');
    expect(themeMusic('ninja-night')).toBe('ng-stage');
  });

  it('the Top Secret Area: grass-topped dirt under a cream sky, green hills that sparkle, its own tune', () => {
    const frames = tilesDef.frames;
    const frame = (name: string) => frames[name] as readonly string[];
    for (const t of ['ground', 'tree-top', 'used']) {
      expect(frames[`${t}@smw-secret`], t).toBeDefined();
      expect(frames[`${t}@smw-secret`], t).not.toEqual(frames[t]);
    }
    // The dirt fills its tile; the grass stands on the dirt (blade tips only open on top).
    expect(frame('ground@smw-secret').join('')).toMatch(/^[123]+$/);
    for (const row of frame('tree-top@smw-secret').slice(1)) expect(row).not.toContain('.');
    expect(frame('tree-top@smw-secret').slice(7)).toEqual(frame('ground@smw-secret').slice(7));
    // A pale cream sky, lighter than any other; gold ? blocks and green pipes as everywhere.
    const rgb = (hex: string) =>
      [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)) as [number, number, number];
    const [r, g, b] = rgb(SKY['smw-secret'] as string);
    expect(r).toBeGreaterThan(0xe0);
    expect(g).toBeGreaterThan(0xd0);
    expect(b).toBeLessThan(g);
    const tiles = PALETTES.default['tiles-smw-secret'] as string[];
    for (const i of [4, 5, 6, 7]) expect(tiles[i], `${i}`).toBe(PALETTES.default['tiles-overworld']?.[i]);
    // Its own decor palette and frames; overworld enemies; no swimming; the Top Secret tune.
    expect(decorPalette('smw-secret')).toBe('decor-smw');
    for (const n of ['smw-hill-big', 'smw-hill-small', 'smw-bush'])
      expect(decorDef.frames[n], n).toBeDefined();
    expect((decorDef.frames['smw-hill-big'] as string[]).join('')).toContain('4'); // its sparkles
    expect(enemyPalette('smw-secret')).toBe(enemyPalette('overworld'));
    expect(isWaterTheme('smw-secret')).toBe(false);
    expect(themeMusic('smw-secret')).toBe('top-secret');
  });

  describe("Bill's jungle, waterfall and Red Falcon's lair", () => {
    const frames = tilesDef.frames;
    const frame = (name: string) => frames[name] as readonly string[];
    const rgb = (hex: string) =>
      [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)) as [number, number, number];
    const BILL: Theme[] = ['contra-jungle', 'contra-falls', 'alien-lair'];
    const REDRAWN = ['ground', 'hard', 'brick', 'used', 'castle-brick', 'tree-top', 'tree-trunk', 'bridge'];

    it('redraws every tile 7-3 uses in the jungle, keeping ? blocks, coins and the flagpole readable', () => {
      const lvl = parseTextMap(
        readFileSync(join(import.meta.dirname, '../../content/levels/world7/7-3.map'), 'utf8'),
      );
      // the frame names renderTiles asks for, every animation step included
      const used = new Set<string>();
      for (const id of lvl.tiles) {
        if (id === T.AIR) continue;
        const def = tileDef(id);
        if (def.block?.kind === 'hidden') continue;
        if (def.block?.kind === 'question') for (const n of [0, 1, 2]) used.add(`question-${n}`);
        else if (def.block?.kind === 'brick') used.add('brick');
        else if (def.pickup === 'coin') for (const n of [0, 1, 2, 3]) used.add(`coin-${n}`);
        else used.add(def.name);
      }
      expect([...used].sort()).toEqual(
        [
          'bridge',
          'coin-0',
          'coin-1',
          'coin-2',
          'coin-3',
          'flag-ball',
          'flag-shaft',
          'ground',
          'hard',
          'question-0',
          'question-1',
          'question-2',
          'tree-top',
          'tree-trunk',
        ].sort(),
      );
      for (const name of used) expect(frames[`${name}@contra-jungle`], name).toBeDefined();
      // Coins and the flagpole are SMB's own; the ? block only gains four steel corner rivets.
      for (const n of ['coin-0', 'coin-1', 'coin-2', 'coin-3', 'flag-shaft', 'flag-ball'])
        expect(frame(`${n}@contra-jungle`), n).toEqual(frame(n));
      for (const n of [0, 1, 2]) {
        const q = frame(`question-${n}@contra-jungle`);
        const base = frame(`question-${n}`);
        let diff = 0;
        q.forEach((r, y) => [...r].forEach((c, x) => c !== base[y]?.[x] && diff++));
        expect(diff, `question-${n}`).toBe(4);
        expect(q.join('').replace(/[^8]/g, '')).toBe('8888');
      }
    });

    it('keeps each tile its collision shape: solid blocks fill their cell, the bridge deck is on top', () => {
      for (const t of BILL)
        for (const name of REDRAWN) {
          expect(frames[`${name}@${t}`], `${name}@${t}`).toBeDefined();
          expect(frames[`${name}@${t}`], `${name}@${t}`).not.toEqual(frames[name]);
        }
      for (const t of BILL) {
        for (const name of ['ground', 'hard', 'brick', 'used', 'castle-brick'])
          expect(frame(`${name}@${t}`).join(''), `${name}@${t}`).not.toContain('.');
        // a ledge stands on its whole width: only blade tips or bumps may leave its top row open
        for (const row of frame(`tree-top@${t}`).slice(2)) expect(row, `tree-top@${t}`).not.toContain('.');
        // the bridge's deck spans the tile on its top rows; below it may open up
        for (const row of frame(`bridge@${t}`).slice(0, 4)) expect(row, `bridge@${t}`).toMatch(/^[^.]{16}$/);
        expect(frame(`bridge@${t}`).join(''), `bridge@${t}`).toContain('.');
        // the backdrop is scenery, drawn behind: it fills its cell
        expect(frame(`wall@${t}`).join(''), `wall@${t}`).not.toContain('.');
        expect(frame(`wall-top@${t}`).slice(8), `wall-top@${t}`).toEqual(frame(`wall@${t}`).slice(8));
      }
    });

    it('the jungle: girders and pylons of steel, cliffs of rock and grass, a river', () => {
      // the bridge and the hard blocks (7-3's bridge pylons) are steel: the light and grey slots
      // (8, b) and black, no rock; the cliffs are rock (1-3) under green grass (5, 6)
      expect(frame('bridge@contra-jungle').join('')).toMatch(/^[08b.]+$/);
      expect(frame('hard@contra-jungle').join('')).toMatch(/^[08b]+$/);
      expect(frame('ground@contra-jungle').join('')).toMatch(/^[01235]+$/);
      expect(frame('tree-top@contra-jungle').slice(0, 2).join('')).toMatch(/^[56.]+$/);
      // breakable bricks are the SMB brick courses (same mortar lines) cut in the rock
      const mortar = (rows: readonly string[]) => rows.map((r) => r.replace(/[^0]/g, '.'));
      expect(mortar(frame('brick@contra-jungle'))).toEqual(mortar(frame('brick')));
      const tiles = PALETTES.default['tiles-contra-jungle'] as string[];
      const [sr, sg, sb] = rgb(tiles[0xb] as string);
      expect([sg, sb]).toEqual([sr, sr]); // grey steel
      expect(tiles[4]).toBe(PALETTES.default['tiles-overworld']?.[4]); // gold ? blocks and coins
      expect(tiles[5]).toBe(PALETTES.default['tiles-overworld']?.[5]); // the green flagpole
      // NES Contra's black night sky, with sparse stars in it
      const [r, g, b] = rgb(SKY['contra-jungle'] as string);
      expect(r + g + b).toBeLessThan(0x18);
      expect(STARRY_SKIES.has('contra-jungle')).toBe(true);
      expect(STARRY_SKIES.has('overworld')).toBe(false);
      // jungle scenery; SMB's own enemies keep their look; the jungle tune; no swimming
      expect(decorPalette('contra-jungle')).toBe('decor-jungle');
      expect(PALETTES.default['decor-jungle']).not.toEqual(PALETTES.default['decor-overworld']);
      expect(enemyPalette('contra-jungle')).toBe(enemyPalette('overworld'));
      expect(themeMusic('contra-jungle')).toBe('contra-jungle');
      for (const t of BILL) expect(isWaterTheme(t), t).toBe(false);
    });

    it('the waterfall falls: its water is streaks sliding down, the second frame 8 rows on', () => {
      const a = frame('water-0@contra-falls');
      const b = frame('water-1@contra-falls');
      expect(b).toEqual([...a.slice(8), ...a.slice(0, 8)]);
      expect(a.join('')).not.toContain('.');
      expect(decorPalette('contra-falls')).toBe('decor-jungle');
      expect(themeMusic('contra-falls')).toBe('contra-jungle');
      expect(SKY['contra-falls']).not.toBe(SKY['contra-jungle']);
    });

    it("the lair is flesh: dark red night, flesh tones lighten in order, castle enemies, Red Falcon's tune", () => {
      const lair = PALETTES.default['tiles-alien-lair'] as string[];
      const lum = (i: number) => rgb(lair[i] as string).reduce((x, y) => x + y);
      for (const i of [1, 2, 3]) {
        const [r, g, b] = rgb(lair[i] as string);
        expect(r, `lair ${i} is red`).toBeGreaterThan(Math.max(g, b));
      }
      expect(lum(1)).toBeLessThan(lum(2));
      expect(lum(2)).toBeLessThan(lum(3));
      const [r, g, b] = rgb(SKY['alien-lair'] as string);
      expect(r).toBeGreaterThan(g + b);
      expect(enemyPalette('alien-lair')).toBe(enemyPalette('castle'));
      expect(themeMusic('alien-lair')).toBe('contra-lair');
    });

    it("the jungle's clouds are dim night clouds; palms, canopy, mountains, sandbags and a searchlight stand by", () => {
      for (const n of ['palm', 'canopy', 'canopy-hang', 'mountain', 'sandbags', 'searchlight'])
        expect(decorDef.frames[n], n).toBeDefined();
      const decorFrame = (n: string) => decorDef.frames[n] as readonly string[];
      const dark = PALETTES.default['decor-jungle'] as string[];
      for (const [n, w] of [
        ['cloud-1@contra-jungle', 32],
        ['cloud-2@contra-jungle', 48],
        ['cloud-3@contra-jungle', 64],
      ] as const) {
        const f = decorFrame(n);
        expect([f[0]?.length, f.length], n).toEqual([w, 16]);
        // mostly the dim navy body (5), a lighter rim (4), a star pixel or two (8); no greens
        const px = f.join('').replace(/\./g, '');
        expect(px, n).toMatch(/^[458]+$/);
        expect(px.replace(/[^5]/g, '').length, n).toBeGreaterThan(px.length / 2);
        // a flat bottom: the cloud's lowest row is one unbroken run
        expect(f[12]?.replace(/^\.+|\.+$/g, ''), n).toMatch(/^5+$/);
        expect(f.slice(13).join(''), n).toMatch(/^\.+$/);
      }
      // the cloud body is dim (7-3's jungle look leaves its clouds out of the black starry sky)
      const lum = (hex: string) => rgb(hex).reduce((x, y) => x + y);
      expect(lum(dark[5] as string)).toBeLessThan(0xd0);
      // the foliage ceiling: a solid top row, leaves hanging down, its edges joining up
      const hang = decorFrame('canopy-hang');
      expect(hang[0]).toMatch(/^[0-3]{32}$/);
      expect(hang.at(-1)).toContain('.');
      // the sandbags are olive canvas, nothing like the jungle's rock and brick
      const bags = decorFrame('sandbags').join('').replace(/\./g, '');
      expect(bags).toMatch(/^[019a]+$/);
      const rock = PALETTES.default['tiles-contra-jungle'] as string[];
      for (const i of [9, 10])
        for (const j of [1, 2, 3]) expect(dark[i], `${i} vs rock ${j}`).not.toBe(rock[j]);
      const [r, g, b] = rgb(dark[9] as string);
      expect(Math.abs(r - g)).toBeLessThan(0x10); // olive: red and green level, little blue
      expect(b).toBeLessThan(r);
      const assets = new AssetRegistry(PALETTES);
      assets.defineAll(SPRITES);
      const drawn = (theme: Theme, kind: string) => {
        const view: View = { camX: 0, frame: 0, assets, theme, reduceFlashing: true };
        const out: { sheet: string; frame: string; y: number }[] = [];
        const r = Object.assign(new NullRenderer(), {
          sprite(s: SpriteSheet, f: string, _x: number, y: number): void {
            out.push({ sheet: s.id, frame: f, y });
          },
        });
        drawDecor(r, view, kind, 0, 128);
        return out[0];
      };
      expect(drawn('contra-jungle', 'cloud-1')).toEqual({
        sheet: 'decor@decor-jungle',
        frame: 'cloud-1@contra-jungle',
        y: 112,
      });
      expect(drawn('contra-jungle', 'palm')?.frame).toBe('palm');
      expect(drawn('contra-jungle', 'castle-big')?.frame).toBe('castle-big');
      // the classic look is untouched
      expect(drawn('overworld', 'cloud-1')?.frame).toBe('cloud-1');
    });
  });
  describe("Sophia's Underworld and the dungeon's metal", () => {
    const frames = tilesDef.frames;
    const frame = (name: string) => frames[name] as readonly string[];
    const rgb = (hex: string) =>
      [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)) as [number, number, number];
    const SOPHIA: Theme[] = ['underworld', 'bm-dungeon'];
    const REDRAWN = [
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
      'water-0',
      'water-1',
    ];

    it('redraws the terrain, keeping each tile its collision shape', () => {
      for (const t of SOPHIA) {
        for (const name of REDRAWN) {
          expect(frames[`${name}@${t}`], `${name}@${t}`).toBeDefined();
          expect(frames[`${name}@${t}`], `${name}@${t}`).not.toEqual(frames[name]);
        }
        for (const name of ['ground', 'hard', 'brick', 'used', 'castle-brick', 'wall', 'water-0', 'water-1'])
          expect(frame(`${name}@${t}`).join(''), `${name}@${t}`).not.toContain('.');
        for (const row of frame(`tree-top@${t}`).slice(2)) expect(row, `tree-top@${t}`).not.toContain('.');
        for (const row of frame(`bridge@${t}`).slice(0, 4)) expect(row, `bridge@${t}`).toMatch(/^[^.]{16}$/);
        expect(frame(`bridge@${t}`).join(''), `bridge@${t}`).toContain('.');
        // the root column and the pillar are scenery, open at the sides
        expect(
          frame(`tree-trunk@${t}`).every((r) => r[0] === '.' && r[15] === '.'),
          t,
        ).toBe(true);
        // `?` blocks, coins, pipes and the flagpole are SMB's own
        for (const n of ['question-0', 'coin-0', 'pipe-top-left', 'flag-shaft'])
          expect(frames[`${n}@${t}`], `${n}@${t}`).toBeUndefined();
        const pal = PALETTES.default[`tiles-${t}`] as string[];
        const over = PALETTES.default['tiles-overworld'] as string[];
        for (const i of [0, 4, 5, 6, 7]) expect(pal[i], `${t} role ${i}`).toBe(over[i]);
      }
    });

    it('the Underworld: dark rust rock with pale roots, a near-black cave, its march', () => {
      const uw = PALETTES.default['tiles-underworld'] as string[];
      // the rock lightens in order, warm (red over blue); the roots are paler than the rock
      const lum = (hex: string) => rgb(hex).reduce((a, b) => a + b, 0);
      expect(lum(uw[1] as string)).toBeLessThan(lum(uw[2] as string));
      expect(lum(uw[2] as string)).toBeLessThan(lum(uw[3] as string));
      expect(lum(uw[8] as string)).toBeGreaterThan(lum(uw[3] as string));
      const [r, , b] = rgb(uw[2] as string);
      expect(r).toBeGreaterThan(b);
      expect(frame('ground@underworld').join('')).toContain('8');
      expect(frame('castle-brick@underworld').join('')).toMatch(/5/);
      // a spent block reads as spent: darker than the bolted slab, its pale bolts gone
      const shade = (f: readonly string[]) => [...f.join('')].filter((c) => c === '0' || c === '1').length;
      expect(shade(frame('used@underworld'))).toBeGreaterThan(shade(frame('hard@underworld')) * 2);
      expect(frame('used@underworld').join('')).not.toMatch(/[38]/);
      expect(lum(SKY.underworld as string)).toBeLessThan(0x40);
      expect(STARRY_SKIES.has('underworld')).toBe(false);
      expect(decorPalette('underworld')).toBe('decor-underworld');
      expect(enemyPalette('underworld')).toBe(enemyPalette('underground'));
      expect(themeMusic('underworld')).toBe('bm-area');
      // the dungeon's metal: black between the walls, castle enemies, the dungeon's tune
      expect(SKY['bm-dungeon']).toBe('#000000');
      expect(enemyPalette('bm-dungeon')).toBe(enemyPalette('castle'));
      expect(decorPalette('bm-dungeon')).toBe('decor-night');
      expect(themeMusic('bm-dungeon')).toBe('bm-dungeon');
    });

    it('the gateway is an arch round a doorway Jason fits through; ladders in place of beanstalks', () => {
      const gate = decorDef.frames.gateway as readonly string[];
      // the doorway: black, 12 wide and 20 tall, reaching the bottom row
      for (let y = 31; y >= 16; y--) expect((gate[y] as string).slice(11, 21), `row ${y}`).toMatch(/^0{10}$/);
      // stone round it and slime from the keystone
      expect(gate.join('')).toMatch(/7/);
      expect(gate.join('')).toMatch(/2/);
      const roots = decorDef.frames.roots as readonly string[];
      expect(roots[0]).toMatch(/^a{32}$/);
      expect(roots.at(-1)).toContain('.');
      const assets = new AssetRegistry(PALETTES);
      assets.defineAll(SPRITES);
      const view: View = { camX: 0, frame: 0, assets, theme: 'underworld', reduceFlashing: true };
      const out: { sheet: string; frame: string }[] = [];
      const r = Object.assign(new NullRenderer(), {
        sprite(s: SpriteSheet, f: string): void {
          out.push({ sheet: s.id, frame: f });
        },
      });
      drawDecor(r, view, 'gateway', 0, 192);
      expect(out[0]).toEqual({ sheet: 'decor@decor-underworld', frame: 'gateway' });
      // the classic scenery is redrawn for the cavern at its own size: rock heaps, stalagmites,
      // mist; none of it in the slime greens (no bright green hills underground)
      for (const kind of [
        'hill-big',
        'hill-small',
        'bush-1',
        'bush-2',
        'bush-3',
        'cloud-1',
        'cloud-2',
        'cloud-3',
      ]) {
        const themed = decorDef.frames[`${kind}@underworld`] as readonly string[];
        const plain = decorDef.frames[kind] as readonly string[];
        expect([themed[0]?.length, themed.length], kind).toEqual([plain[0]?.length, plain.length]);
        expect(themed.join(''), kind).not.toMatch(/[123]/);
        out.length = 0;
        drawDecor(r, view, kind, 0, 192);
        expect(out[0]?.frame, kind).toBe(`${kind}@underworld`);
      }
      for (const kind of ['cloud-1', 'cloud-2', 'cloud-3'])
        expect((decorDef.frames[`${kind}@underworld`] as readonly string[]).join(''), kind).toMatch(
          /^[45.]+$/,
        );
      // a beanstalk in the Underworld is a steel ladder; elsewhere it stays a beanstalk
      out.length = 0;
      new Vine(3, 10, 3).render(r, view);
      expect(out.map((o) => o.frame)).toEqual(['ladder', 'ladder', 'ladder-top']);
      expect(out[0]?.sheet).toBe('sophia');
      out.length = 0;
      new Vine(3, 10, 3).render(r, { ...view, theme: 'underground' });
      expect(out.map((o) => o.frame)).toEqual(['vine-mid', 'vine-mid', 'vine-top']);
    });
  });
});
