import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
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
  },
};
