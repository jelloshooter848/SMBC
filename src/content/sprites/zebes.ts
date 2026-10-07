import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * Samus's cavern below 4-2 and ZEBES ESCAPE: the bird-like statue that holds a hero's orb, the
 * gunship, the bubble door, the cave creatures and the self-destruct alarm. Original 8-bit art
 * drawn here in the spirit of an NES planet-exploration game (black outlines, three-tone shading
 * lit from the top left); nothing is traced. The cavern's rock is `<tile>@cavern` frames on the
 * tile sheet (tiles.ts).
 *
 * Conventions the game relies on:
 * - Creatures face LEFT (enemies walk left by default); flip for right. `zoomer-*` crawl on their
 *   bottom row (rotate or flip for walls and ceilings), `ripper-*` glide, `skree-0` hangs from
 *   its top row and `skree-1` is its dive.
 * - `chozo-*` (32x32) face RIGHT and sit on their plinth's bottom row; frame 1 lights the orb
 *   (only the orb and its halo change).
 * - `ship` (64x32) is drawn head on and mirrored, standing on its feet (bottom row).
 * - `bubble-door` (16x48) fills three tiles and is mirrored. `alarm-*` sit on a plate at the
 *   bottom: frame 0 dark, frame 1 lit (blink them, or hold frame 1 with reduce-flashing on).
 */

/**
 * `zebes` index roles (the same in `zebes-flash`):
 *   0 black / outline   1 stone shadow   2 stone           3 stone light    4 white
 *   5 door rim blue     6 door blue      7 door light      8 door shine     9 dark red
 *   a red (eyes, lamp)  b orange         c yellow          d pale yellow    e green
 *   f dark green        g dark brown     h brown           i light green
 */
const zebesBase = (): string[] => [
  NES.black,
  NES.darkGray,
  NES.gray,
  NES.lightGray,
  NES.white,
  NES.blueDark,
  NES.blueMid,
  NES.blueLight,
  NES.skyLight,
  NES.redDark,
  NES.redBright,
  NES.orange,
  NES.yellow,
  NES.yellowLight,
  NES.green,
  NES.greenDark,
  NES.brownDark,
  NES.brown,
  NES.greenLight,
];

export const zebesPalettes: Record<string, string[]> = {
  zebes: zebesBase(),
  // A creature struck by a shot: every colour but the outline flashes pale for a frame or two.
  'zebes-flash': zebesBase().map((c, i) => (i === 0 ? c : i % 2 ? NES.white : NES.lightGray)),
};

/* The bird-like statue, seated on its plinth facing right, an orb cupped in its hands; the orb dim. */
const chozo0 = [
  '................................',
  '..........000000................',
  '.........01022000...............',
  '........0310200000000...........',
  '........0102201a2222200.........',
  '........0022220a22222220........',
  '........0222220110000220........',
  '.........02222200....020........',
  '........00111100.....00.........',
  '.......0330000..................',
  '......003203330......000........',
  '.....00322032220....0bbb0.......',
  '....0203220322220..0bccbb0......',
  '....02032201222220.0bccb90......',
  '...02032222012222200bbbb90......',
  '...0203222220112222009990.......',
  '...02032222220012200000000......',
  '...01032222222001033302220......',
  '..0221322220003300122220000.....',
  '..022012200333222001110.........',
  '..02203203322222032000..........',
  '..02103201222222032220..........',
  '..022132203222220322220.........',
  '...02012203222200000000.........',
  '...020322012000.033333300.......',
  '...010111100...01111111110......',
  '.0000000000000000000000000000...',
  '.0333333333333333333333333330...',
  '.0222222222222222222222222220...',
  '.0211111111111111111111111120...',
  '.0222222222222222222222222220...',
  '.0000000000000000000000000000...',
];

/* The same statue with the orb aglow: a white-hot core and a halo of sparks (only the orb changes). */
const chozo1 = [
  '................................',
  '..........000000................',
  '.........01022000...............',
  '........0310200000000...........',
  '........0102201a2222200.........',
  '........0022220a22222220........',
  '........0222220110000220........',
  '.........02222200....020........',
  '........00111100.....00.........',
  '.......0330000....d.......d.....',
  '......003203330......000........',
  '.....00322032220....0cdc0.......',
  '....0203220322220..0cd44c0......',
  '....02032201222220.0cd4dc0.d....',
  '...02032222012222200ccdcb0......',
  '...020322222011222200bcb0.......',
  '...02032222220012200000000......',
  '...01032222222001033302220......',
  '..0221322220003300122220000.....',
  '..022012200333222001110.........',
  '..02203203322222032000..........',
  '..02103201222222032220..........',
  '..022132203222220322220.........',
  '...02012203222200000000.........',
  '...020322012000.033333300.......',
  '...010111100...01111111110......',
  '.0000000000000000000000000000...',
  '.0333333333333333333333333330...',
  '.0222222222222222222222222220...',
  '.0211111111111111111111111120...',
  '.0222222222222222222222222220...',
  '.0000000000000000000000000000...',
];

/* The gunship, seen head on: a fat hull under a green canopy, swept wings ending in engine pods with
   glowing exhausts, tail fins, and two landing legs on the bottom row. */
const ship = [
  '................................................................',
  '................................................................',
  '.........0............................................0.........',
  '..........0..........................................0..........',
  '..........000..............0000000000..............000..........',
  '...........0b0............0eeeeeeeeee0............0b0...........',
  '...........0bb00........00e44eeeeeeeee00........00bb0...........',
  '...........0bbbb0.......0e4eeeeeeeeeeee0.......0bbbb0...........',
  '............0bbbb0.....0ee4eeeeeeeeeeeee0.....0bbbb0............',
  '............0bbbb0000008e4eeeeeeeeeeeeee8000000bbbb0............',
  '.............0b00ccbbb08eeeeeeeeeeeeeeee80bbbcc00b0.............',
  '.............00ccbbbbb0feeeeeeeeeeeeeeeef0bbbbbcc00.............',
  '..............0bbbbbbbb08eeeeeeeeeeeeee80bbbbbbbb0..............',
  '.............0bbbbbb000000000000000000000000bbbbbb0.............',
  '............0cbbbbb09999999999999999999999990bbbbbc0............',
  '.........000cbbbbba09999999999999999999999990abbbbbc000.........',
  '.......00bb0cbbbbbbb000000000000000000000000bbbbbbbc0bb00.......',
  '....000bbbb09b999999999999999999999999999999999999b90bbbb000....',
  '...0001000bb0cbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbc0bb0001000...',
  '...03323310b09bbbbbbbbbbbbbb00000000bbbbbbbbbbbbbb90b01332330...',
  '..0222222210b09bbbbbbbbbbbb0133333310bbbbbbbbbbbb90b0122222220..',
  '..0222222210bb090bbbbbbbbbbb03222230bbbbbbbbbbb090bb0122222220..',
  '..02ccc22210b000.00bbbbbbbbb03222230bbbbbbbbb00.000b01222ccc20..',
  '.0122d2222000......0099bbbbb01222210bbbbb9900......0002222d2210.',
  '.000002000...........0090000000000000000900...........000200000.',
  '......0..............020................020..............0......',
  '.....................020................020.....................',
  '.....................020................020.....................',
  '.....................000................000.....................',
  '..................00033300............00333000..................',
  '..................02222220............02222220..................',
  '..................00000000............00000000..................',
];

/* A blue bubble door three tiles tall between metal hatch rims; mirrored, so it faces either way. */
const bubbleDoor = [
  '0000000000000000',
  '0333333333333330',
  '0222222222222220',
  '1000000000000001',
  '1000055555500001',
  '1000557777550001',
  '1005567777655001',
  '1005667777665001',
  '1055667777665501',
  '1056867777686501',
  '1056467777646501',
  '1056467777646501',
  '1056467777646501',
  '1056867777686501',
  '1056867777686501',
  '1056867777686501',
  '1056867777686501',
  '1056867777686501',
  '1056867777686501',
  '1056867777686501',
  '1056667777666501',
  '1056667777666501',
  '1056667777666501',
  '1056667777666501',
  '1056667777666501',
  '1056667777666501',
  '1056667777666501',
  '1056667777666501',
  '1056667777666501',
  '1056667777666501',
  '1056687777866501',
  '1056687777866501',
  '1056687777866501',
  '1056687777866501',
  '1056687777866501',
  '1056687777866501',
  '1056667777666501',
  '1056667777666501',
  '1056667777666501',
  '1055667777665501',
  '1005667777665001',
  '1005567777655001',
  '1000557777550001',
  '1000055555500001',
  '1000000000000001',
  '0222222222222220',
  '0333333333333330',
  '0000000000000000',
];

/* A spiked crawler (faces left), its legs on the bottom row; frame 1 steps and flexes its side spikes. */
const zoomer0 = [
  '.......00.......',
  '......0dd0......',
  '..00..0cc0..00..',
  '..0d0.0cc0.0d0..',
  '...0c00cc00c0...',
  '....0ccbbbb0....',
  '...0cbbbbbbb0...',
  '..0cbbbbbbbbb0..',
  '000bbbbbbbbbb000',
  '0dcbbbbbbbbbbbd0',
  '0004abbbb9999000',
  '.0baabbbb999990.',
  '.09bbbbbb999990.',
  '..099999999990..',
  '..000000000000..',
  '.00..00..00..00.',
];
const zoomer1 = [
  '.......00.......',
  '......0dd0......',
  '..00..0cc0..00..',
  '..0d0.0cc0.0d0..',
  '...0c00cc00c0...',
  '....0ccbbbb0....',
  '...0cbbbbbbb0...',
  '..0cbbbbbbbbb0..',
  '.00bbbbbbbbbb00.',
  '0dcbbbbbbbbbbbd0',
  '00c4abbbb9999900',
  '.0baabbbb999990.',
  '.09bbbbbb999990.',
  '..099999999990..',
  '..000000000000..',
  '..00..00..00..00',
];

/* An armoured glider (faces left), plated like a beetle; its tail fin beats up, then down. */
const ripper0 = [
  '................',
  '.............00.',
  '............0d0.',
  '...........0d0..',
  '.....0000000000.',
  '...00dddhdddhd0.',
  '..0ddhhhghhhghh0',
  '.0d4hhhhghhhghh0',
  '0dhaahhhghhhghhg',
  '0hhhhhhhghhhghg0',
  '.0hhhhhhghhhggg0',
  '..0gggggggggg00.',
  '...0000000000...',
  '................',
  '................',
  '................',
];
const ripper1 = [
  '................',
  '................',
  '................',
  '................',
  '.....000000000..',
  '...00dddhdddhd0.',
  '..0ddhhhghhhghh0',
  '.0d4hhhhghhhghh0',
  '0dhaahhhghhhghhg',
  '0hhhhhhhghhhghg0',
  '.0hhhhhhghhhggg0',
  '..0gggggggggg00.',
  '...00000000000..',
  '...........0h0..',
  '............0h0.',
  '.............00.',
];

/* A ceiling diver: frame 0 hangs by its claws (top row) with its wings folded, frame 1 dives drill
   first with its wings spread. */
const skree0 = [
  '...0.000000.0...',
  '..0i0iiiiee0e0..',
  '.0ie0iieeee0ee0.',
  '.0ie0ieeeee0ee0.',
  '.0ie0ceeeec0ee0.',
  '.0ef0ceeeec0fe0.',
  '..0f0eeeeee0f0..',
  '..0f0eeffee0f0..',
  '...00eeffee00...',
  '....0effffe0....',
  '.....0ffff0.....',
  '.....012210.....',
  '......0330......',
  '......0220......',
  '.......00.......',
  '................',
];
const skree1 = [
  '................',
  '....00000000....',
  '0..0iiiiieee0..0',
  'i000iieeeeee000e',
  '0iie0ceeeec0eee0',
  '.0ef0ceeeec0fe0.',
  '..0f0eeeeee0f0..',
  '..0f0eeffee0f0..',
  '...00eeffee00...',
  '....0effffe0....',
  '.....0ffff0.....',
  '.....012210.....',
  '......0330......',
  '......0220......',
  '.......00.......',
  '................',
];

/* A wall alarm: a red dome on a metal plate (frame 0 dark), lit with a white glint and sparks in frame 1. */
const alarm0 = [
  '................',
  '................',
  '................',
  '................',
  '......0000......',
  '....00999900....',
  '...0a999999a0...',
  '..0a99999999a0..',
  '..099999999990..',
  '.09999999999990.',
  '.09999999999990.',
  '.09999999999990.',
  '0000000000000000',
  '0333333333333330',
  '0222222222222220',
  '0111111111111110',
];
const alarm1 = [
  '................',
  '.......aa.......',
  '.......aa.......',
  '.a............a.',
  '..a...0000...a..',
  '....00aaaa00....',
  '...0d4baaaaa0...',
  'a.0d4baaaaaaa0.a',
  '..0dbaaaaaaaa0..',
  '.0aabaaaaa99990.',
  '.0aaaaaaaa99990.',
  '.0aaaaaaaa99990.',
  '0000000000000000',
  '0333333333333330',
  '0222222222222220',
  '0111111111111110',
];

export const zebesDef: SpriteDef = {
  palette: 'zebes',
  frames: {
    'chozo-0': chozo0,
    'chozo-1': chozo1,
    ship: ship,
    'bubble-door': bubbleDoor,
    'zoomer-0': zoomer0,
    'zoomer-1': zoomer1,
    'ripper-0': ripper0,
    'ripper-1': ripper1,
    'skree-0': skree0,
    'skree-1': skree1,
    'alarm-0': alarm0,
    'alarm-1': alarm1,
  },
};
