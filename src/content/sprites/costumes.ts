import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * The fake Bowsers' villain costumes (0.4.47, roadmap #31; designed by CD47, approved by the
 * owner): in castles 2-4 to 7-4 the campaign's fake king wears a cheap costume of that world's
 * villain over his usual look. Original 8-bit art drawn here; nothing is traced or recoloured from
 * any game. Each one reads as "a Koopa badly dressed as X". Bowser.render draws it; Bowser.unmask
 * drops its pile (entities/effects/costume-pile.ts).
 *
 * Two frames a world, both 32x32 like the king (`bowser-0..3` in enemies.ts) and facing LEFT:
 * - `costume-N` is an OVERLAY: drawn at the same x, y and flip as the king's frame, straight after
 *   it. '.' shows the king underneath, so one overlay fits all four of his frames: it keeps off
 *   the jaw's moving rows 14-16 (the fire breath) and the walking legs (rows 25-30), except
 *   Dracula's fangs and Red Falcon's mandibles, which hang over the jaw on purpose. Where it
 *   covers row 13 (the upper lip) or row 24 (the hips) it covers them in every frame alike.
 *   Hidden while the tell shows the true form (Bowser.tellShowing) and once he is unmasked.
 * - `costume-drop-N` is the shed costume lying on the floor, in the same 32x32 box (its feet on
 *   row 30, like his): drawn where he stood when the costume falls off, with the wand's puff.
 *
 * Palette `costumes`: indices 0-b are `enemies-castle`'s exactly (1 = the king's black outline,
 * 4 white, 7 red, 9 yellow, a/b steel), so a costume's outline and accents match his; c-s are the
 * costume colours (the cheap fabric, card and plastic). No index is used for anything else.
 *
 * High contrast: like `bowser-true-form`'s outline, index c (dark grey: Dracula's wig, the ninja's
 * robe, the card's shade) would sink into the castle's black there; sprites/index.ts gives it a
 * mid grey in that mode.
 */

/**
 * `costumes` index roles (0-b as enemies-castle):
 *   0 black          1 outline (black)   2 grey        3 tan          4 white
 *   5 green          6 light green       7 red         8 pipe green   9 yellow
 *   a steel          b steel light       c dark grey (seams, card shade, the ninja's robe, Dracula's wig)
 *   d dark blue (folds)  e blue (Ganon's mask, Dracula's cape)  f light blue (Ganon's snout, glass glints)
 *   g purple (Ganon's cape)  h magenta (lining, brain folds)  i pink (brain, alien flesh)
 *   j cyan (glass)   k dark brown (hilts) l brown (handles)    m light brown (wooden sword)
 *   n crimson (the ninja's mask, the falcon, Dracula's lining, the alien head)  o dark red (their
 *   shading)  p lavender (wig shine)  q tan dark (bone)  r peach (brain-cap shine)
 *   s pale yellow (glowing eyes)
 */
export const costumePalettes: Record<string, string[]> = {
  costumes: [
    NES.black,
    NES.black,
    NES.gray,
    NES.tan,
    NES.white,
    NES.green,
    NES.greenLight,
    NES.redBright,
    NES.greenPipe,
    NES.yellow,
    NES.gray,
    NES.lightGray,
    NES.darkGray,
    NES.blueDark,
    NES.blueMid,
    NES.blueLight,
    NES.purple,
    NES.magenta,
    NES.pink,
    NES.cyan,
    NES.brownDark,
    NES.brown,
    NES.brownLight,
    NES.red,
    NES.redDark,
    NES.lavender,
    NES.tanDark,
    NES.peach,
    NES.yellowLight,
  ],
};

/* ---------------------------------------------------------------- World 2: Ganon */

/** World 2, worn: Ganon. Overlay on bowser-0..3. */
const GANON = [
  '.........................b.b.b..',
  '...........1.............a.a.a..',
  '..........1e1..1.........aaaaa..',
  '..........1f1..1e1.........l....',
  '.........1eef1.e1..........l....',
  '.........1eeee1............l....',
  '.....1ffffeeeeeee1...111111l111.',
  '....1feeeeeeeeeeeee19gggggglgg1.',
  '...1eee111111eeeeee11gggdggldgg1',
  '.11111e......eeeeee11hggdggldgg1',
  '1ff4ff1......eeeeee11hggdggldgg1',
  '1f1f1f1......eeeeee11hggdggldgg1',
  '1fffff14eeeeeeeeeee11hggdggldgg1',
  '.11111.41111111111111hggdggldgg1',
  '....................1hggdggldg1.',
  '....................1hggdggldg1.',
  '....................1hggdggldg1.',
  '....................1hggdgggdg1.',
  '....................1hggdgggdg1.',
  '.....................1hgdgggdg1.',
  '.....................1hgdgggdg1.',
  '.....................1hgdgggdg1.',
  '.....................1hgdgggdg1.',
  '.....................1hgdgggd1..',
  '.....................1hgdggg1...',
  '......................1d1d11....',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
];

/** World 2, shed on the floor. */
const GANON_DROP = [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '........................aaaab...',
  '.1.....1................a.......',
  '.1e1ll1e1lllllllllllllllaaaab...',
  '.1e1111111..............a.......',
  '..1eeeeeee1...1111111111aaaab...',
  '.1e111e111e1ggggggggggggggg1....',
  '.1e.1.e.11e1ggggdggghggdggggg1..',
  '1eeeeeeeeeee1dggdgghhggdgggggg1.',
  '1e1fffff1ee1gggdggdgggdgdgggggg1',
  '1e1f1f1f1ee1dggggdggdggdggggggg1',
  '.11fffff111gggggggggggggggggggg1',
  '................................',
];

/* ---------------------------------------------------------------- World 3: Dr. Wily (the skull machine) */

/** World 3, worn: Dr. Wily (the skull machine). Overlay on bowser-0..3. */
const WILY = [
  '.................n..............',
  '.................a..............',
  '.111......111111111111..........',
  '.141......1444444444c1..........',
  '.1b1......1bbnbnbnbbc1..........',
  '.1bb111111bbbnbnbnbbc1..........',
  '.1bbbbbbbbbbbbnbnbbbc1..........',
  '.11111b111111bbbbbbbc1..........',
  '.11111b......bbbbbbbc1..........',
  '.11n11b......bbbbbbbc1..........',
  '.11111b......b1bbbbbc1..........',
  '.1bbbbb......1bbbbbbc1..........',
  '.141414141414141414cc1..........',
  '.111111111111111111111..........',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  'bbbbbbbbbbbbbbbbbbbbbbbbbb......',
  'a4aa4aa4aa4aa4aa4aa4aa4aa4......',
  '.cccccccccccccccccccccccc.......',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
];

/** World 3, shed on the floor. */
const WILY_DROP = [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '......n.........................',
  '.......a........................',
  '..1111111111111111111...........',
  '..1bbbbbbbbbbbbbbbbb1...........',
  '..1b444444444444444c1...........',
  '..1b1111b1111bbbbbbc1...........',
  '..1b1nn1b1..1bn.n.nc1...........',
  '..1b1111b1111bn.n.nc1...........',
  '..1bbbbbbbbbbb.n.n.c1...........',
  '..1b414141414141414111..........',
  '..1ccccccccccccccccc1...........',
  '..1ccccccccccccccccbbbbbbbbbbbbb',
  '..111111111111111a4aa4aa4aa4aa4a',
  '..................bbbbbbbbbbbbbb',
  '....................cccccccccc..',
  '................................',
];

/* ---------------------------------------------------------------- World 4: Mother Brain */

/** World 4, worn: Mother Brain. Overlay on bowser-0..3. */
const MOTHER_BRAIN = [
  '......jjjjjjjjjjjjjjjj..........',
  '....jj...1111111111...jj........',
  '...j..41riihiiiihiii1..j........',
  '..j.41irhiiihhiiihiii1.j........',
  '.j.41ihhiiiihiihhiiihi1j........',
  '.j4.1iiihiihhiiiihiihi1j........',
  'j.4.1ihiiihiiiihhiiiii1j........',
  'j.4..1iiiiihiihiiiiii1.j........',
  'j.....11111..........11j........',
  'j................4.....j.aa.....',
  'j......................j.ab.....',
  'j.....................fj.ab.....',
  'j.....................fj.ab.....',
  'j....................4fj.ab.....',
  'j......................j.ab.....',
  'j......................j.ab.....',
  'j......................j.ab.....',
  '.j....................j..ab.....',
  'abbbbbbbbbbbbbbbbbbbbaabba......',
  '.aaaaaaaaaaaaaaaaaaaa...........',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
];

/** World 4, shed on the floor. */
const MOTHER_BRAIN_DROP = [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................jjjjjjjj........',
  '..............jj........jj......',
  '.............j4...........ja....',
  '............j4............ab....',
  '............j4............ab....',
  '............j.....4.......ab....',
  '....11111111j.............ab....',
  '..11rihiiihii1.......4....ab....',
  '.1iihiiihhiihi1...........ja....',
  '.1ihhiiihiihhi1j........jj......',
  '.1iiihiihhiiii1.jjjjjjjj........',
  '..111111111111abbbbbbbbbbba.....',
  '.............aaaaaaaaaaaaaaa....',
  '................................',
];

/* ---------------------------------------------------------------- World 5: Dracula */

/** World 5, worn: Dracula. Overlay on bowser-0..3. */
const DRACULA = [
  '.............11111111.....1.....',
  '...........1ccccccccc1...1n1....',
  '..........1cpppppccccc1.1nn1....',
  '.........1cccccccccccc11nnoe1...',
  '.........1cppppppppccc1nnoe1....',
  '........1ccccccccccccc1noee1....',
  '.....1cppppppppppccccc1noe1.....',
  '....1ccc1.....1cccccc1nooe1.....',
  '........1cc1......1pc1nooe1.....',
  '.........11........111eeedeeed1.',
  '...................1noeeedeeede1',
  '...................1noeeedeeede1',
  '...................1noeeedeeede1',
  '...................1noeeedeeede1',
  '....4..4...........1noeeedeeede1',
  '....4..4...........1noeeedeeede1',
  '...................1noeeedeeede1',
  '...................1noeeedeeede1',
  '.........b.b..b.b..1noeeedeeede1',
  '...........b99b.....1noeedeeede1',
  '............9n......1noeedeeede1',
  '............99......1noeedeeede1',
  '....................1noeedeeede1',
  '....................1noeedeeede1',
  '....................1noeedeeede1',
  '....................1noeedeeede1',
  '.....................1noedeeede1',
  '.....................1e1.1e1.1e1',
  '......................1...1...1.',
  '................................',
  '................................',
  '................................',
];

/** World 5, shed on the floor. */
const DRACULA_DROP = [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '..........................1.1...',
  '.............111111......1n1n1..',
  '............1cpcccc1....1nn1nn1.',
  '...........1cccpcccc1...1ne1ne1.',
  '...........1ccccpccc1...1111111.',
  '.........1111111111111111111111.',
  '.......1nnnonnonnnonnnnonnonnon1',
  '......1nnnonnnonnnnonnnonnnonnn1',
  '.....1nnnonnnonnonnnnonnnonb9bn1',
  '.1441nnnnnnnnnnnnnnnnnnnnnn9n9n1',
  '.4.141e1e1e1e1e1e1e1e1e1e1e1e1e1',
  '................................',
];

/* ---------------------------------------------------------------- World 6: the Masked Ninja (a knock-off) */

/** World 6, worn: the Masked Ninja (a knock-off). Overlay on bowser-0..3. */
const MASKED_NINJA = [
  '..............................lk',
  '............44b44b44b44......l..',
  '...........44b44b44b44b4....l...',
  '...........4b44b44b44b44b..l.kk.',
  '...........c4cbc4c4cbc4c4cl.kk..',
  '............4b44b44b44b44b4.aaa.',
  '.....1nnnnnnnn1b44b44b44b44b.m..',
  '....1nonnnnnnnn14c4cbc4c4cbc.m..',
  '...1n99nnnnnn99n144b44b44b44bm..',
  '..1nnn9......9nnnncc4b44b44bm...',
  '..1nnnn......nnnnn1.c4cbc4c4m...',
  '..1nnnn......nnnn1...4b44b4mb...',
  '.1n4n4n4n4n4n4nnnn1...44b44m4...',
  '.......................c4cmc....',
  '.......................4.4m4....',
  '........................bmb.....',
  '.........................m......',
  '........................m.......',
  '..1cccc1.....1ccccccc1..m.......',
  '.1cccccc1...1cccccccc1.m........',
  '.....1ccccccccccccccc1.m........',
  '.....1nnnnnnnnnnnnnnnnm.........',
  '.....1cccccccnccccccc1m.........',
  '......1cccccccnccccccc1.........',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
];

/** World 6, shed on the floor. */
const MASKED_NINJA_DROP = [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '.........................k......',
  '........................l.......',
  '.......................l........',
  '......................l.........',
  '.....................l..........',
  '..11111111.........4b4.4........',
  '.1nnnnnnnn1......4b4b44b4.......',
  '1n99nnnn99n1....4c4b4c4b44......',
  '1n1111n111n1...4b4c44b4c4b4.....',
  '1nnnnnnnnnn1...b44b4c4b44c4.....',
  '1n4n4n4n4nn1...4c4b44b4c4b4.....',
  '.1nnnnnnnn1.....nnnnnnnnnnn.....',
  '..11111111....1cccccccccc1.a....',
  '....mmmmmmmmmmmmmmmmmmmmmmmakkk.',
  '...........................a....',
];

/* ---------------------------------------------------------------- World 7: Red Falcon */

/** World 7, worn: Red Falcon. Overlay on bowser-0..3. */
const RED_FALCON = [
  '......111111111111..............',
  '...1nnnnoiqqnnonnnnnn1..........',
  '..1nnoinnnnoiqqnnnonnnn1........',
  '.1nnnnnnonnnnnnoqqnnonnn1.......',
  '.1nnoinnnnnnoinnnnqqnnnn1.......',
  '1nnnnnnnnnnnnnnnnonqqoin1.......',
  '1nonnnonnoinnnonnnonqqo1........',
  '1onnnonnnonnnonononono1.........',
  '119s91n111111n19s91no1..........',
  '119991n......n19991on1..........',
  '1nonnno......nonononn1..........',
  '.1nnoon......onnnonnn1..........',
  '1q11111111111111111111..........',
  '1q1.............................',
  '.1q1............................',
  '..1q............................',
  '..11............................',
  '................................',
  '.....1444bbbbbb444bb1...........',
  '....1bbbnbbbnbbbnbbb1...........',
  '....1bbbnnbnnnbnnbbbb1..........',
  '.....1bbbnnnnnnnbbbbb1..........',
  '.....1bbbbbnbnbbbbbbb1..........',
  '......1bbbbbbbbbbbbbb1..........',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
];

/** World 7, shed on the floor. */
const RED_FALCON_DROP = [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '......1111111111111.............',
  '....1nnnnoinnnnnnnnn1...........',
  '...1nnnnnnnqnnnoinnnn1..........',
  '..1nnnoinnnnnqnnnnnnnn1.........',
  '..1nnnnnnnnnnnnqnnnonn1.........',
  '.1nn19s9119s91n1nq1nnnn1........',
  '.1nn1999119991n1nn1nnnn1111111..',
  '.1nnonnnnnnnnnnnnnnnnn1bbbbbbb1.',
  '1q1nnnnnnnnonnnnnnnnnn1bn.n.nb1.',
  '.1q1nnnnnnnnnnnnnonnn11bbnnnbb1.',
  '..1..1nnnnnnnnnnnnn1..1bbbnbbb1.',
  '.......11111111111....111111111.',
  '................................',
];

/** The costume each castle's fake wears, by world (none in World 1: the plain king suit). */
export const COSTUME_OF_WORLD: Readonly<Record<number, string>> = {
  2: 'ganon',
  3: 'wily',
  4: 'mother-brain',
  5: 'dracula',
  6: 'masked-ninja',
  7: 'red-falcon',
};

export const costumesDef: SpriteDef = {
  palette: 'costumes',
  frames: {
    'costume-2': GANON,
    'costume-drop-2': GANON_DROP,
    'costume-3': WILY,
    'costume-drop-3': WILY_DROP,
    'costume-4': MOTHER_BRAIN,
    'costume-drop-4': MOTHER_BRAIN_DROP,
    'costume-5': DRACULA,
    'costume-drop-5': DRACULA_DROP,
    'costume-6': MASKED_NINJA,
    'costume-drop-6': MASKED_NINJA_DROP,
    'costume-7': RED_FALCON,
    'costume-drop-7': RED_FALCON_DROP,
  },
};
