import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { localsDef } from './locals';
import { partnersDef, partnersPalettes } from './partners';

/**
 * 0.4.40: the folk who stand in every level of Chapter 1 (docs/STORY.md, each world's "Level
 * NPCs"; `partner x y who=<id>` like the hint NPCs). Most are the hint NPCs' own art in new
 * colours (a Toad's cap, an old man's robe, a townsperson's cloak); the welcomes' locals (map
 * sprites, `locals` sheet) are copied over in new colours too, their index letters moved onto
 * this palette. Only worlds that had nobody fitting get new art, drawn here in the spirit of
 * their hero's game, original, nothing traced.
 *
 * Conventions (the same as `partners`): `<who>-0` is the idle frame and `<who>-1` the blink,
 * differing only around the eyes; everyone stands on the bottom row with an empty top row.
 */

/**
 * `npcs` index roles: 0-l are the `partners` palette's (0 black, 1 white, 2 light grey, 3 grey,
 * 4 dark grey, 5 skin, 6 skin shade, 7 red-brown, 8 dark red, 9 bright red, a light brown,
 * b brown, c dark brown, d blue, e dark blue, f yellow, g pale yellow, h olive, i dark green,
 * j pink, k green, l pale blue), then:
 *   m deep purple   n magenta   o cyan   p lime   q teal   r lavender   s red
 */
export const npcsPalettes: Record<string, string[]> = {
  npcs: [
    ...(partnersPalettes.partners as string[]),
    '#940084',
    NES.magenta,
    NES.cyan,
    NES.greenLight,
    NES.teal,
    NES.purple,
    NES.red,
  ],
};

type Rows = readonly string[];

/** `rows` with each index letter in `map` swapped for its new one (all at once). */
const recolor = (rows: Rows, map: Readonly<Record<string, string>>): Rows =>
  rows.map((r) => [...r].map((c) => map[c] ?? c).join(''));

/** `rows` with row `y` replaced (a blink). */
const swap = (rows: Rows, y: number, row: string): Rows => rows.map((r, i) => (i === y ? row : r));

/** A `partners` frame, by name. */
const partner = (name: string): Rows => partnersDef.frames[name] ?? [];

/* ---------------------------------------------------------------- World 1: the Mushroom Kingdom */

/*
 * Toads of the kingdom: 1-1's villager in other caps and vests (our Toad's spots are red, the
 * villager's blue, the pipe keeper's green).
 */
const toadIn = (spots: string, vest: string): [Rows, Rows] => [
  recolor(partner('villager-0'), { d: spots, b: vest }),
  recolor(partner('villager-1'), { d: spots, b: vest }),
];
/** 1-2's cave Toad: yellow spots, a dark miner's vest. */
const [caveToad0, caveToad1] = toadIn('f', 'c');
/** 1-3's lookout: pink spots, a green vest. */
const [lookout0, lookout1] = toadIn('j', 'k');
/** 1-4's retainer, sneaking through the king's castle: orange spots, a royal blue vest. */
const [retainer0, retainer1] = toadIn('7', 'd');

/* ---------------------------------------------------------------- World 2: Hyrule */

/** 2-2's Error, a townsman of Hyrule: the night town's townsperson in a red-brown cloak, a dark belt. */
const errorIn = { h: '7', i: '8', a: 'c' };
const error0 = recolor(partner('townsperson-0'), errorIn);
const error1 = recolor(partner('townsperson-1'), errorIn);
/** 2-3's river man: 2-1's old man in a green robe. */
const riverMan0 = recolor(partner('old-man-0'), { 7: 'k', 8: 'i' });
const riverMan1 = recolor(partner('old-man-1'), { 7: 'k', 8: 'i' });
/** 2-4's wise man: the old man in a blue robe. */
const wiseMan0 = recolor(partner('old-man-0'), { 7: 'd', 8: 'e' });
const wiseMan1 = recolor(partner('old-man-1'), { 7: 'd', 8: 'e' });

/* ---------------------------------------------------------------- World 3: Mega City */

/** The `locals` palette's index letters moved onto this one (0-6 are the same colour on both). */
const FROM_LOCALS: Readonly<Record<string, string>> = {
  7: 'b',
  8: 'c',
  9: 'a',
  a: 'h',
  b: 'i',
  c: 'd',
  d: 'e',
  e: '7',
  f: '8',
  g: 'f',
  h: 'g',
  i: 'i',
  j: 'm',
  k: 'n',
  l: 'r',
  m: 'o',
};
/**
 * A welcome's local (`locals` sheet, 16x20) on this palette, recoloured by `map` (in this
 * palette's letters), with an empty row on top (the locals' antennas and lamps reach row 0).
 */
const local = (name: string, map: Readonly<Record<string, string>> = {}): Rows => {
  const rows = recolor(recolor(localsDef.frames[name] ?? [], FROM_LOCALS), map);
  return /[^.]/.test(rows[0] ?? '') ? ['................', ...rows] : rows;
};
/** 3-2's prune bot: World 3's lab robot, painted green for the forest. */
const pruneBot0 = local('lab-robot-0', { d: 'k', e: 'i' });
const pruneBot1 = local('lab-robot-1', { d: 'k', e: 'i' });
/** 3-3's weather bot: the lab robot in yellow, a storm-grey trim. */
const weatherBot0 = local('lab-robot-0', { d: 'f', e: '4' });
const weatherBot1 = local('lab-robot-1', { d: 'f', e: '4' });

/* ---------------------------------------------------------------- World 4: Planet Zebes */

/**
 * 4-1's Federation trooper (new, 16x32): a white helmet with a cyan visor, blue armour with a
 * grey chest plate, grey gloves and boots. The blink is a glint running across the visor.
 */
const trooper0: Rows = [
  '................',
  '................',
  '................',
  '................',
  '.....000000.....',
  '....02222220....',
  '...0222222220...',
  '...0223333220...',
  '...0200000020...',
  '...020oooo020...',
  '...0200000020...',
  '...0222222220...',
  '....03333330....',
  '..000dddddd000..',
  '.0dd0d2222d0dd0.',
  '.0dd0d2332d0dd0.',
  '.0dd0d2332d0dd0.',
  '.0dd0dd22dd0dd0.',
  '.0ee0dddddd0ee0.',
  '.02204444440220.',
  '..000dddddd000..',
  '....0dddddd0....',
  '...0ddd00ddd0...',
  '...0ddd00ddd0...',
  '...0eee00eee0...',
  '...0ddd00ddd0...',
  '...0ddd00ddd0...',
  '...0ddd00ddd0...',
  '...0333003330...',
  '..033330033330..',
  '..044440044440..',
  '..000000000000..',
];
const trooper1 = swap(trooper0, 9, '...0201ooo020...');
/** 4-3's researcher: World 4's scientist in a yellow heat suit. */
const researcher0 = local('scientist-0', { 1: 'f', 2: 'a' });
const researcher1 = local('scientist-1', { 1: 'f', 2: 'a' });
/**
 * 4-4's baby Metroid (new, 16x16): a lime membrane dome over three red nuclei (two, and one below), pale fangs below.
 * It floats (partner.ts FLOAT); its `-1` frame is a pulse, the nuclei glowing brighter.
 */
const metroid0: Rows = [
  '................',
  '................',
  '.....000000.....',
  '...00pppppp00...',
  '..0p1ppppppkp0..',
  '.0ppssppppsspkp0',
  '.0ps88spps88skp0',
  '0pps88spps88skp0',
  '0ppppps88spppkk0',
  '0kpppps88sppppk0',
  '0kkppppssppppkk0',
  '.0kkkkkkkkkkkk0.',
  '..000000000000..',
  '...020.02.020...',
  '...020.02.020...',
  '....0..00..0....',
];
const metroid1 = recolor(metroid0, { s: '9', 8: 's' });

/* ---------------------------------------------------------------- World 5: Transylvania */

/** 5-1's old woman: World 2's healer in a deep purple shawl and dress, a dark hem. */
const oldWoman0 = local('healer-0', { 7: 'm', 8: '4' });
const oldWoman1 = local('healer-1', { 7: 'm', 8: '4' });
/** 5-2's garlic seller: World 5's merchant in a green hood, his sack white with garlic. */
const garlicIn = { m: 'i', n: 'k', a: '1', b: '2' };
const garlicSeller0 = local('merchant-0', garlicIn);
const garlicSeller1 = local('merchant-1', garlicIn);
/** 5-3's clockmaker: the townsperson in a grey hood and a blue smock, a brass belt. */
const clockIn = { b: '3', c: '4', h: 'd', i: 'e', a: 'f' };
const clockmaker0 = recolor(partner('townsperson-0'), clockIn);
const clockmaker1 = recolor(partner('townsperson-1'), clockIn);

/* ---------------------------------------------------------------- World 6: Dragon Valley */

/**
 * 6-1's ninja of Ryu's clan (new head, 16x32): a charcoal hood and mask with a band of skin and
 * eyes, on Lance's build in charcoal garb with a red sash and black boots. The blink is the eyes.
 */
const ninjaHead: Rows = [
  '................',
  '................',
  '................',
  '................',
  '.....000000.....',
  '....04444440....',
  '...0444444440...',
  '...0444444440...',
  '...0455555540...',
  '...0450550540...',
  '...0444444440...',
  '....04444440....',
  '....00444400....',
];
const ninjaBody = (lance: string): Rows =>
  swap(
    swap(recolor(partner(lance).slice(13), { 5: '4', 6: '3', c: '9', e: '4' }), 16, '...0000000000...'),
    17,
    '..000000000000..',
  );
const ninja0: Rows = [...ninjaHead, ...ninjaBody('lance-0')];
const ninja1 = swap(ninja0, 9, '...0455555540...');
/** 6-3's hermit: World 6's elder in a red-brown robe. */
const hermit0 = local('elder-0', { 3: '7', 4: '8' });
const hermit1 = local('elder-1', { 3: '7', 4: '8' });
/** 6-4's clan scout: the ninja in forest green with a yellow sash. */
const scoutIn = { 4: 'i', 3: 'h', 9: 'f' };
const clanScout0 = recolor(ninja0, scoutIn);
const clanScout1 = recolor(ninja1, scoutIn);

/* ---------------------------------------------------------------- World 7: Galuga Island */

/** 7-1's corporal: World 7's sergeant in snow gear, a grey helmet and a white parka. */
const corporal0 = local('sergeant-0', { i: '3', h: '2' });
const corporal1 = local('sergeant-1', { i: '3', h: '2' });
/** 7-2's river scout: the sergeant in a brown helmet and tan fatigues. */
const riverScout0 = local('sergeant-0', { i: 'b', h: 'a' });
const riverScout1 = local('sergeant-1', { i: 'b', h: 'a' });
/** 7-4's medic: the sergeant in white, his radio a red medical pack. */
const medic0 = local('sergeant-0', { i: '1', h: '2', 4: '9' });
const medic1 = local('sergeant-1', { i: '1', h: '2', 4: '9' });

export const npcsDef: SpriteDef = {
  palette: 'npcs',
  frames: {
    'cave-toad-0': caveToad0,
    'cave-toad-1': caveToad1,
    'lookout-0': lookout0,
    'lookout-1': lookout1,
    'retainer-0': retainer0,
    'retainer-1': retainer1,
    'error-0': error0,
    'error-1': error1,
    'river-man-0': riverMan0,
    'river-man-1': riverMan1,
    'wise-man-0': wiseMan0,
    'wise-man-1': wiseMan1,
    'prune-bot-0': pruneBot0,
    'prune-bot-1': pruneBot1,
    'weather-bot-0': weatherBot0,
    'weather-bot-1': weatherBot1,
    'trooper-0': trooper0,
    'trooper-1': trooper1,
    'researcher-0': researcher0,
    'researcher-1': researcher1,
    'baby-metroid-0': metroid0,
    'baby-metroid-1': metroid1,
    'old-woman-0': oldWoman0,
    'old-woman-1': oldWoman1,
    'garlic-seller-0': garlicSeller0,
    'garlic-seller-1': garlicSeller1,
    'clockmaker-0': clockmaker0,
    'clockmaker-1': clockmaker1,
    'ninja-0': ninja0,
    'ninja-1': ninja1,
    'hermit-0': hermit0,
    'hermit-1': hermit1,
    'clan-scout-0': clanScout0,
    'clan-scout-1': clanScout1,
    'corporal-0': corporal0,
    'corporal-1': corporal1,
    'river-scout-0': riverScout0,
    'river-scout-1': riverScout1,
    'medic-0': medic0,
    'medic-1': medic1,
  },
};
