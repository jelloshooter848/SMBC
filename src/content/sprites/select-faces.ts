import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * Classic mode's select-screen faces: our own 24 x 24 close-ups (head and shoulders filling the
 * cell, as the original's portraits are framed), drawn by hand for this screen: each select slot
 * hero, each skin (Mega Man's built on his face, as their bodies are on his frame) and each
 * Expansion hero. A look with none here shows its standing art's head doubled
 * (scenes/select-grid.ts faceOf).
 *
 * One shared palette (roles):
 *   0 outline   1 white   2 skin   3 skin shade   4 red   5 dark red   6 green   7 dark green
 *   8 light blue   9 blue   a dark blue   b brown   c dark brown   d gold   e grey   f light grey
 *   g orange   h dark grey   i pink   j purple   k cyan   l pale gold   m pale blue
 *   n peach (skin shade)   o burnt orange (skin rim)   p maroon (red rim)   q lime   r Sophia pink
 *   s Sophia pink shade   t Sophia pink light   u light brown   v magenta   w light red   x light green
 *
 * The 0.5.0 faces (O-11) follow one standard: three tones per material and a 1 px rim in the
 * material's own dark shade (never the box's black), eyes 2 px wide, a shaded jaw, and each face
 * in its sprite's colours.
 */
export const selectFacePalettes: Record<string, string[]> = {
  'select-faces': [
    NES.black,
    NES.white,
    NES.tan,
    NES.tanDark,
    NES.redBright,
    NES.redDark,
    NES.green,
    NES.greenDark,
    NES.blueLight,
    NES.blueMid,
    NES.blueDark,
    NES.brown,
    NES.brownDark,
    NES.yellow,
    NES.gray,
    NES.lightGray,
    NES.orange,
    NES.darkGray,
    NES.pink,
    NES.purple,
    NES.cyan,
    NES.yellowLight,
    NES.skyLight,
    NES.peach,
    NES.orangeBrown,
    '#881400',
    NES.greenLight,
    '#e44a85',
    '#a8105c',
    '#f8a4c0',
    NES.brownLight,
    NES.magenta,
    '#f87858',
    '#58d854',
  ],
};

/** Mario: the red cap and its M badge, brown sideburns, the round nose over the black moustache, a grin, the red shirt and his brown overall straps. */
const mario = [
  '......pppppppppppp......',
  '....pp444411111444pp....',
  '...p4w44414111414444p...',
  '..p4w4444144144144444p..',
  '..p4w4444141414144444p..',
  '.p4w444441411141444444p.',
  '.p44444444111114444444p.',
  'p5555555555555555555555p',
  '.pccnnnnnnnnnnnnnnnnccp.',
  '.pcb2221022222201222bcp.',
  '.pcb222002nnnn200222bcp.',
  '.pcb32200n2nnnn00223bcp.',
  '.pco3222nnnnnnnn2223ocp.',
  '..po322cconnnnocc223op..',
  '...o3cccccccccccccc3o...',
  '...o3ccc22222222ccc3o...',
  '...o3222o111111o2223o...',
  '....o3322oooooo2233o....',
  '.....oo3333333333oo.....',
  '....pp4oooooooooo4pp....',
  '..pp44w4bc44444cb4w44pp.',
  '.p444w44bd44444db444w44p',
  'p4444444cb44444bc4444444',
  'p4444444bb44444bb4444444',
];

/** Luigi: Mario's cap in green with his L, a longer nose and a wider moustache, a longer face, the green shirt and his dark overall straps. */
const luigi = [
  '......777777777777......',
  '....7766661111166677....',
  '...76x666161111166667...',
  '..76x66661611111666667..',
  '..76x66661611111666667..',
  '.76x6666616666116666667.',
  '.7666666661111166666667.',
  '777777777777777777777777',
  '.cccnnnnnnnnnnnnnnnnccc.',
  '.cbb2221022222201222bbc.',
  '.cbb222002nnnn200222bbc.',
  '.cbb32200n2nnnn00223bbc.',
  '.cbo3222nnnnnnnn2223obc.',
  '..co3222nnnnnnnn2223oc..',
  '..co3cccconnnnocccc3oc..',
  '..occccccccccccccccccco.',
  '...occ322222222223cco...',
  '...o33222o1111o22233o...',
  '....o3322oooooo2233o....',
  '.....oo3333333333oo.....',
  '.....77oooooooooo77.....',
  '...77x6hd666666dh6x77...',
  '.7766x66hh666666hh66x667',
  '76666666hh666666hh666667',
];

/** Link: the long green cap falling back to his right, the fair fringe, his pointed ears out at the sides, the green tunic. */
const link = [
  '........77777777........',
  '......77x666666677......',
  '.....7x666666666667.....',
  '....7x666666666666667...',
  '...7x66666666666666667..',
  '...766666666666666666667',
  '..7c66666666666666666667',
  '..cbuubuubuubuubuubuc767',
  '..cubbubbubbubbubbubbc67',
  '..cbb2bb22b22b22bb2bbc67',
  'oo.c2221022222201222c.77',
  'o2oo222002222220022oo2o7',
  '.o22o32002222220023o22o.',
  '..o223222222222222322o..',
  '...oo3222222n2222223oo..',
  '....o3222222n22222223o..',
  '.....o32222nn2222223o...',
  '.....o3322222222223o....',
  '......o33222oo22233o....',
  '.......oo333333333o.....',
  '.....77oooooooooooo77...',
  '...77x667733337766x677..',
  '.77x66666677336666666x77',
  '7x6666666667766666666667',
];

/** Samus: the round orange helmet, its lime visor framed in dark red, the big shoulder pads. */
const samus = [
  '........pppppppp........',
  '......ppnnnggnnnpp......',
  '.....pnnggggggggnnp.....',
  '....pnggggggggggggnp....',
  '...pnggggggggggggggnp...',
  '..pngggg55555555ggggnp..',
  '..pggg557777777755gggp..',
  '.pggg5711qqqqqqqq75gggp.',
  '.pggg571qqqqqqqqq75gggp.',
  '.pggg57qqqqqqqqqq75gggp.',
  '.pogg57xxxxxxxxxx75ggop.',
  '.pogg55777777777755ggop.',
  '.poggg555555555555gggop.',
  '..poggggggggggggggggop..',
  '..ppoooooooooooooooopp..',
  '.pp5p55555555555555p5pp.',
  '.pgnnp555555555555pnngp.',
  'pgnnggp5555555555pggnngp',
  'pnggggop55555555poggggnp',
  'pggggggp55555555pggggggp',
  'pggggogp55555555pgoggggp',
  'pogggoop55555555poogggop',
  'ppoooopp55555555ppoooopp',
  'p5555555555555555555555p',
];

/** Simon: short red-brown hair under the grey headband, heavy brows, a square jaw, the leather armour. */
const simon = [
  '.......pppppppppp.......',
  '.....pp5o5o55o5o5pp.....',
  '....p55o5o5555o5o55p....',
  '...p5o555555555555o5p...',
  '...p5555555555555555p...',
  '..pffffffffffffffffffp..',
  '..peeeeeeeeeeeeeeeeeep..',
  '..p5o32222222222223o5p..',
  '..p532555522225555235p..',
  '..p532210222222012235p..',
  '..po3220022222200223op..',
  '..po3222222332222223op..',
  '..po3222222332222223op..',
  '...o3222223nn3222223o...',
  '...o3222222222222223o...',
  '...on3222oooooo2223no...',
  '....on322222222223no....',
  '....onn3333333333nno....',
  '.....oonnnnnnnnnnoo.....',
  '...ccbboo333333oobbcc...',
  '..cbuubbbconnocbbbuubc..',
  '.cbuubbbbbccccbbbbbuubc.',
  'cbuubbbbbbbccbbbbbbbuubc',
  'cbubbbbbbbbbbbbbbbbbbubc',
];

/** Bill: dark hair under the red bandana (its knot and tails to his right), heavy brows, a stubbled jaw, bare shoulders and his strap. */
const bill = [
  '.....cccccccccccccc.....',
  '....ccbccccccccccbcc....',
  '...cccbcccbccbcccbccc...',
  '...cccccccccccccccccp44.',
  '..pw444444444444444p455.',
  '..p55555555555555554p5..',
  '..pc32222222222222245p..',
  '..oc3ccc22222222ccc5co..',
  '..oc3221022222201223co..',
  '..oc3220022222200223co..',
  '..o332222223322222233o..',
  '..o332222223322222233o..',
  '...o3222nn3333nn2223o...',
  '...o3222222222222223o...',
  '...o32222oooooo22223o...',
  '...o3322222222222233o...',
  '....o33333333333333o....',
  '.....oonnnnnnnnnnoo.....',
  '......on33333333no......',
  '...ocb332222222233noo...',
  '..on3cb2222332222223no..',
  '.on322cb2223322222223no.',
  'on32333cb3333333333323no',
  'on322222cb222222222223no',
];

/** Princess Zelda: light brown hair down to her shoulders, the gold circlet and its red jewel, the pointed ears, the pink gown. */
const zelda = [
  '........................',
  '.......bbbbbbbbbb.......',
  '.....bbuuuuuuuuuubb.....',
  '....buuuuuuuuuuuuuub....',
  '...buuuuuuu44uuuuuuub...',
  '...buuddddd44ddddduub...',
  '..buu22222222222222uub..',
  '..buu22222222222222uub..',
  '..bu22oo22222222oo22ub..',
  '..bu2221022222201222ub..',
  'oo2u2220022222200222u2oo',
  '.o2u3222222222222223u2o.',
  '..bu3222222332222223ub..',
  '..buu32222222222223uub..',
  '..buu32222wwww22223uub..',
  '..buuu322222222223uuub..',
  '..buuuu3333333333uuuub..',
  '..buuuubo333333obuuuub..',
  '.buuuuubb333333bbuuuuub.',
  '.buuuubiiiiiiiiiibuuuub.',
  'buuuubiiitiiiitiiibuuuub',
  'buuubiiiiiiiiiiiiiibuuub',
  'buubiiiiiiiiiiiiiiiibuub',
  'bubviiiiiiiiiiiiiiiivbub',
];

/** The moustached template (Dr. Wily's, Mr. X's and Dr. Cossack's looks are built on it). */
const moustached = [
  '.......0000000000.......',
  '.....00444444444400.....',
  '....0444441111444440....',
  '...044444114411444440...',
  '...044444141141444440...',
  '..0444444411114444440...',
  '..04444444444444444440..',
  '..00000000000004444440..',
  '..0ccc22222220004444440.',
  '..0cc2220220222000000...',
  '.0cc22220220222222220...',
  '.0c222220220222222220...',
  '.0c2222222222333222220..',
  '..0c22222220000000022220',
  '..0cc2222000000000002220',
  '...0cc22000000000000220.',
  '....0c22222222222222220.',
  '.....002222222222222200.',
  '.....04400022222220044..',
  '....04444400000000444440',
  '...0444499444444449944440',
  '..04444499444444449944444',
  '.044444444444444444444444',
  '.044444444444444444444444',
].map((r) => r.slice(0, 24).padEnd(24, '.'));

/** Mega Man: the round blue helmet with its light crest, the open face and big eyes. */
const megaman = [
  '.......0000000000.......',
  '.....009999999999900....',
  '....0999999888899999....',
  '...099999988889999990...',
  '..09999999888899999990..',
  '..099999998888999999990.',
  '.0999999999999999999990.',
  '.099990000000000009999990',
  '.09990222222222222099990.',
  '.0990222222222222222099..',
  '.088022011102011102208880',
  '.088022011002011002208880',
  '.088022011002011002208880',
  '.099022222222222222209990',
  '.099022222223222222209990',
  '.0999022222222222222099990',
  '.09990222200000022220999..',
  '..0999002222222222009990..',
  '...00990000000000009900...',
  '...0888809999999990888800',
  '..088888099999999990888880',
  '.0888888809999999908888888',
  '.0888888880999999088888888',
  '.0888888888099990888888888',
].map((r) => r.slice(0, 24).padEnd(24, '.'));

/** Bass: the black helmet with its tall fins and gold stripe, the dark eyes, a smirk. */
const bass = [
  '..00.................00.',
  '.0dd0...............0dd0',
  '.0ddd0.............0ddd0',
  '.0hddd0...0000....0dddh0',
  '..0hhdd00hhhhhh00ddhh0..',
  '...0hhhhhhhhhhhhhhhhh0..',
  '...0hhhhdddddddddhhhh0..',
  '..0hhhhhhdddddddhhhhhh0.',
  '..0hhh000000000000hhhh0.',
  '..0hh0222222222222200hh0',
  '..0hh022200022200022200h0',
  '..0hh022201022201022220h0',
  '..0hh022200022200022220h0',
  '..0hh02222222222222222200',
  '..0hhh022222222322222220.',
  '..0hhh022222222222222220.',
  '..0hhhh0222220000022220..',
  '...0hhhh00222222222200...',
  '....0hhhhh0000000000hh0..',
  '...0ddhhhhhhhhhhhhhhhdd0.',
  '..0dddhhhhhhhhhhhhhhhddd0',
  '.0dddhhhhhhhhhhhhhhhhhddd0',
  '.0ddhhhhhhhhhhhhhhhhhhhdd0',
  '.0dhhhhhhhhhhhhhhhhhhhhhd0',
].map((r) => r.slice(0, 24).padEnd(24, '.'));

/** Ryu: the blue ninja hood, a strip of face with the eyes, the scarf tail. */
const ryu = [
  '.......0000000000.......',
  '.....00aaaaaaaaaaa00....',
  '....0aaaaaaaaaaaaaaa0...',
  '...0aaaa9999999999aaaa0.',
  '..0aaa999999999999999aa0',
  '..0aa99999999999999999a0',
  '..0a999999999999999999a0',
  '.0aa999999999999999999a0',
  '.0a99000000000000000099a0',
  '.0a99022222222222222099a0',
  '.0a99022000222200022099a0',
  '.0a99022010222201022099a0',
  '.0a99022000222200022099a0',
  '.0a99000000000000000099a0',
  '.0aa999999999999999999a0.',
  '.0aaa99999999999999999a0..',
  '..0aaa999999999999999aa0..',
  '...0aaa9999999999999aaa000',
  '...0aaaaa999999999aaaaa4440',
  '..0aaaaaaaaaaaaaaaaaaa44440',
  '.0aaaa99999aaaaa99999aa440',
  '.0aaa999999aaaaa999999aa00',
  '0aaa9999999aaaaa9999999aa0',
  '0aa99999999aaaaa99999999a0',
].map((r) => r.slice(0, 24).padEnd(24, '.'));

/** Sophia III: the tank head on, its blue canopy, the hull lights and the front wheels. */
const sophia = [
  '........................',
  '.......0000000000.......',
  '.....009999999999900....',
  '....09988888888889990...',
  '...0998811888888889990..',
  '...0988188888888888890..',
  '..00000000000000000000..',
  '.0ffffffffffffffffffff0.',
  '0ffeeeeeeeeeeeeeeeeeeff0',
  '0fe44efffffffffffe44eef0',
  '0fe44effffffffffffe44ef0',
  '0feeeeeeeeeeeeeeeeeeeef0',
  '0ffffffffffffffffffffff0',
  '.0eeeeeeeeeeeeeeeeeeee0.',
  '.00000000000000000000000',
  '0hhhh00..........00hhhh0',
  'hhffhh0..........0hhffhh',
  'hffffh0..........0hffffh',
  'hfeefh0..........0hfeefh',
  'hfeefh0..........0hfeefh',
  'hffffh0..........0hffffh',
  'hhffhh0..........0hhffhh',
  '0hhhh00..........00hhhh0',
  '.0000............0000...',
].map((r) => r.slice(0, 24).padEnd(24, '.'));

/* ---------- the skins and the Expansion heroes ---------- */

/** `rows` with each role in `map` swapped for another. */
function recolour(rows: readonly string[], map: Readonly<Record<string, string>>): string[] {
  return rows.map((r) => [...r].map((c) => map[c] ?? c).join(''));
}

/** `base` with `layer`'s drawn pixels painted over it ('.' keeps the base; ',' clears to '.'). */
function over(base: readonly string[], layer: readonly string[]): string[] {
  return base.map((r, y) => {
    const l = layer[y] ?? '';
    return [...r].map((c, x) => (l[x] === ',' ? '.' : l[x] && l[x] !== '.' ? l[x] : c)).join('');
  });
}

/** `rows` with each black pixel on the outside edge (next to '.' or the frame's edge) turned `rim`. */
function rimmed(rows: readonly string[], rim: string): string[] {
  const at = (x: number, y: number): string => rows[y]?.[x] ?? '.';
  return rows.map((r, y) =>
    [...r]
      .map((c, x) =>
        c === '0' && [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].includes('.') ? rim : c,
      )
      .join(''),
  );
}

/** Proto Man: Mega Man's build in red and grey, the dark visor over his eyes, the gold scarf. */
const protoman = over(recolour(megaman, { '9': '4', '8': 'f' }), [
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '.....hhhhhhhhhhhhhhh....',
  '....hh11hhhhhh11hhhh....',
  '....hhhhhhhhhhhhhhhh....',
  '.....hhhhhhhhhhhhhh.....',
  '',
  '',
  '',
  '',
  '',
  '..0ddddd0000000ddddd0...',
  '.0ddddddd0444440dddddd0.',
  '.0dddddddd04440ddd0ddd0.',
  '..00dd00ddd0400dd0.0dd0.',
  '',
  '',
]);

/** Break Man: Proto Man's mask in dark grey and deep red. */
const breakman = recolour(protoman, { '4': 'h', f: '5' });

/** Rock: no helmet, his spiky brown hair, a blue shirt. */
const rock = over(recolour(megaman, { '8': 'm', '9': 'b' }), [
  '....0.0.000.0.0.........',
  '...0b0b0bbb0b0b0........',
  '..0bbbbbbbbbbbbbb0......',
  '..0bbbbbbbbbbbbbbbb0....',
  '..0bbbbbbbbbbbbbbbbb0...',
  '.0bbbbbbbbbbbbbbbbbbb0..',
  '.0bbbbbbbbbbbbbbbbbbb0..',
  '.0bbbb00000000000bbbbbb0',
  '.0bbb0222222222222bbbbb0',
  '.0bb022222222222222222b0',
  '.02202',
  '.02202',
  '.02202',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
]);

/** Cut Man: his helmet in orange and red under the great scissor blades. */
const cutman = over(recolour(megaman, { '9': 'g', '8': '4' }), [
  '...00..........00.......',
  '..0110........0110......',
  '..01110......01110......',
  '...01110....01110.......',
  '....011100001110........',
  '.....0111111110.........',
]);

/** Fire Man: dark red with orange, the flame burning on his head. */
const fireman = over(recolour(megaman, { '9': '5', '8': 'g' }), [
  '.........d..............',
  '.......d.dd.d...........',
  '......ddgddgdd..........',
  '.....dgggggggdd.........',
  '.....dgg4444ggd.........',
]);

/** Ice Man: a blue parka hood, the white fur ring round his face, a pompom on top. */
const iceman = over(recolour(megaman, { '8': '9' }), [
  '.........0110...........',
  '........011110..........',
  '.........0110...........',
  '',
  '',
  '',
  '',
  '.09991111111111111199990',
  '.0991',
  '.0912',
  '.0912',
  '.0912',
  '.0912',
  '.0912',
  '.0912',
  '.0991',
  '.0999111111111111111999.',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
]);

/** Francesca: the tall witch's hat with its gold band, her pale gold hair. */
const francesca = over(recolour(megaman, { '9': 'l', '8': 'j' }), [
  '...........000..........',
  '..........0jj0..........',
  '.........0jjj0..........',
  '........0jjjj0..........',
  '.......0jjjjjj0.........',
  '.....00ddddddddd00......',
  '..000jjjjjjjjjjjjjj000..',
  '.0jjjjjjjjjjjjjjjjjjjjj0',
]);

/** Doropie: Francesca's other look, the hat and dress in red. */
const doropie = recolour(francesca, { j: '4' });

/** Rokko Chan: a pink helmet with a red crest, her brown hair out at the sides. */
const rokko = over(recolour(megaman, { '9': 'i', '8': '4' }), [
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '0bb0',
  '0bbb0',
  '0bbb0',
  '0bbb0..................0',
  '.0bb0..................b0',
  '..0b0.................bb0',
]);

/** Pit: brown hair under a green laurel, a bright face, the white toga with a gold clasp. */
const pit = [
  '.......0000000000.......',
  '.....00bbbbbbbbbb00.....',
  '....0bbbbbbbbbbbbbb0....',
  '...0b66b66b66b66b66b0...',
  '...0b66666666666666b0...',
  '..0bbbbbbbbbbbbbbbbbb0..',
  '..0bbb22b222222b22bbb0..',
  '..0bb2222222222222bbb0..',
  '..0bb2200022220002bb0...',
  '..0b22201022220102bb0...',
  '..0b22200022220002b20...',
  '..0b22222222222222220...',
  '..0b22222223222222220...',
  '...0222222222222222220..',
  '...02222220000022222200.',
  '....022222222222222200..',
  '.....0002222222220000...',
  '.......002222222200.....',
  '....00ffff000000fff00...',
  '...0fffffffd11dfffff0...',
  '..0ffffffffd11dffffff0..',
  '.0fffffffffdddfffffff10.',
  '.0ffffffffffffffffffff10',
  '.0fffffffffffffffffff110',
].map((r) => r.slice(0, 24).padEnd(24, '.'));

/** Dark Pit: Pit's look in black and grey. */
const darkpit = recolour(pit, { b: 'h', f: 'e', '6': '7' });

/** Princess Peach: pale gold hair, her crown with its blue jewel, the pink dress. */
const peach = [
  '........0.0..0.0........',
  '.......0d0d00d0d0.......',
  '.......0ddd88ddd0.......',
  '.....00dddddddddd00.....',
  '....0llllllllllllll0....',
  '...0llllllllllllllll0...',
  '..0llllll22222222lllll0.',
  '..0llll222222222222llll0',
  '..0lll22200022200022lll0',
  '..0lll22201022201022lll0',
  '..0lll22200022200022lll0',
  '..0lll22222222222222lll0',
  '..0lll22222223222222lll0',
  '..0llll222222222222llll0',
  '..0lllll2224444442lllll0',
  '..0llllll222222222lllll0',
  '..0lllllll2222222llllll0',
  '..0llllll000000000lllll0',
  '...0ll0iiiiiiiiiiiii0ll0',
  '....0iiiiiiii8iiiiiii0..',
  '...0iiiiiiiii8iiiiiiii0.',
  '..0iiiiiiiiiiiiiiiiiiii0',
  '..0iiiiiiiiiiiiiiiiiiii0',
  '..0iiiiiiiiiiiiiiiiiiii0',
].map((r) => r.slice(0, 24).padEnd(24, '.'));

/** Vic Viper: the ship's nose head on, its canopy, the wing roots and the red intakes. */
const vicviper = [
  '........................',
  '..........0000..........',
  '.........0ffff0.........',
  '........0ffffff0........',
  '........0f8888f0........',
  '.......0ff8mm8ff0.......',
  '.......0ff8888ff0.......',
  '......0ffffffffff0......',
  '......0fffeeeefff0......',
  '.....0fffeeeeeefff0.....',
  '....0ffffeeeeeeffff0....',
  '...0fffffffffffffffff0..',
  '..0ff44ffffffffffff44ff0',
  '.0fff44ffeeeeeeeeff44fff0',
  '0ffffffffeeeeeeeeffffffff',
  '0eeeeeeeeeeeeeeeeeeeeeee0',
  '.0000eeee0000000eeee0000.',
  '.....0ee0.......0ee0.....',
  '.....0440.......0440.....',
  '......00.........00......',
  '........................',
  '........................',
  '........................',
  '........................',
].map((r) => r.slice(0, 24).padEnd(24, '.'));

/** The Warriors of Light: the fighter's spiky red hair, a stern face, blue armour. */
const warriors = [
  '...0.0..0.0..0.0..0.....',
  '..0g0g00g0g00g0g00g0....',
  '..0ggggggggggggggggg0...',
  '.0ggggggggggggggggggg0..',
  '.0ggggggggggggggggggg0..',
  '.0gggg44444444444gggg0..',
  '.0ggg2222222222222ggg0..',
  '.0gg222000222200022gg0..',
  '.0gg222010222201022gg0..',
  '.0gg222000222200022gg0..',
  '.0gg2222222222222222g0..',
  '.0gg2222222322222222g0..',
  '.0ggg222222222222222g0..',
  '..0gg22222000002222g0...',
  '..0ggg222222222222gg0...',
  '...0gggg22222222ggg0....',
  '....000002222220000.....',
  '...0aaaa00000000aaaa0...',
  '..0999990aaaaaa0999990..',
  '.099999990aaaa099999990.',
  '.0999999990aa0999999990.',
  '0999999999900999999999900',
  '0999999999999999999999990',
  '0999999999999999999999990',
].map((r) => r.slice(0, 24).padEnd(24, '.'));

/** Sir Arthur: the silver knight's helmet, its visor slit and red plume, the armoured shoulders. */
const arthur = [
  '..............44........',
  '............44444.......',
  '.......000044444........',
  '.....00ffffff00.........',
  '....0ffffffffff00.......',
  '...0fffffffffffff0......',
  '..0ffffffffffffffff0....',
  '..0ffffeeeeeeeeffff0....',
  '..0fffe0000000000eff0...',
  '..0fffe0hhhhhhhh0eff0...',
  '..0fffe0000000000eff0...',
  '..0ffffeeeeeeeeeefff0...',
  '..0fffffffffffffffff0...',
  '..0ffffeefeefeefefff0...',
  '..0fffffffffffffffff0...',
  '...0ffffffffffffff0.....',
  '....00000000000000......',
  '...0fffff0eeee0fffff0...',
  '..0ffffffe0ee0effffff0..',
  '.0fffffffee00eefffffff0.',
  '0ffffffffeeeeeeffffffff0',
  '0fffffffffeeeefffffffff0',
  '0eeeeeeeeeeeeeeeeeeeeee0',
  '0ffffffffffffffffffffff0',
].map((r) => r.slice(0, 24).padEnd(24, '.'));

/** Yoshi: the round green head and big nose, his white muzzle, the red saddle at his back. */
const yoshi = [
  '......00000.............',
  '....00666660000.........',
  '...0666666666660........',
  '..066666111066660.......',
  '..066661001066666000....',
  '..066661001066666666600.',
  '..0666661110666666666660',
  '..0666666666666666666666',
  '.06666666666666666666666',
  '.06666666666666666666666',
  '.06666666111111666666666',
  '..0666661111111111166660',
  '..066661111111111111110.',
  '...0661111111111111110..',
  '....0611111111111110....',
  '.....00111111111100.....',
  '......0000000000000.....',
  '....04440666666666000...',
  '...0444406666666666660..',
  '..04444066666666666666.0',
  '..0444066666666666666660',
  '.04440666666666666666666',
  '.04440666666666666666666',
  '.00000666666666666666666',
];

/*
 * 0.5.0's looks (G-050..G-053), each face redrawn in its own colours from one of ours: Mario's
 * and Luigi's Super Mario Bros. 3 looks (black hair, dark blue straps), Princess Zelda's three
 * from her own face (light brown hair and a red jewel; gold hair, a silver circlet and a white
 * gown; Game Boy greens), Quick Man from Bass's helmet in red with its gold crest, Haggle Man from Ryu's hood in
 * red.
 */
const mario3 = rimmed(
  [...recolour(mario.slice(0, 19), { c: '0', b: 'h' }), ...recolour(mario.slice(19), { b: '9', c: 'a' })],
  'h',
);
const luigi3 = rimmed(
  [...recolour(luigi.slice(0, 20), { c: '0', b: 'h' }), ...recolour(luigi.slice(20), { h: 'a' })],
  'h',
);
const zeldaNes = zelda;
const zeldaSnes = recolour(zelda, { d: 'f', u: 'd', i: '1', t: '1', v: 'j', 4: 'j' });
const zeldaGb = recolour(zelda, { u: '7', b: '7', d: 'x', i: 'q', t: 'q', v: '6', 4: '6' });
const quickman = recolour(bass, { h: '4' });
const haggleman = recolour(ryu, { a: '5', 9: '4', 4: 'd' });
/*
 * Bass's other looks (owner addition): Dr. Wily, Mr. X and Dr. Cossack from the moustached face
 * (grey hair over a white coat; a purple beret and coat; a brown fur hat and coat), Gemini Man and
 * Skull Man from Bass's helmet (white and blue with a cyan crest; a white skull).
 */
const wily = recolour(moustached, { 4: 'f', 1: 'f', c: 'f' });
const mrx = recolour(moustached, { 4: 'j', 1: 'j', c: 'h' });
const cossack = recolour(moustached, { 4: 'b', 1: 'c', c: 'b' });
const gemini = recolour(bass, { h: '1', d: 'k' });
const skullman = recolour(bass, { h: 'f', d: '1' });

/** The faces by select-slot hero id (a frame each on the `select-faces` sheet). */
export const SELECT_FACE_IDS = [
  'mario',
  'luigi',
  'link',
  'samus',
  'simon',
  'megaman',
  'bass',
  'bill',
  'ryu',
  'sophia',
  'rock',
  'protoman',
  'breakman',
  'cutman',
  'fireman',
  'iceman',
  'francesca',
  'doropie',
  'rokko',
  'pit',
  'darkpit',
  'peach',
  'vicviper',
  'warriors',
  'arthur',
  'yoshi',
  'mario3',
  'luigi3',
  'zelda-nes',
  'zelda-snes',
  'zelda-gb',
  'quickman',
  'haggleman',
  'wily',
  'mrx',
  'cossack',
  'gemini',
  'skullman',
];

export const selectFacesDef: SpriteDef = {
  palette: 'select-faces',
  frames: {
    mario,
    luigi,
    link,
    samus,
    simon,
    megaman,
    bass,
    bill,
    ryu,
    sophia,
    rock,
    protoman,
    breakman,
    cutman,
    fireman,
    iceman,
    francesca,
    doropie,
    rokko,
    pit,
    darkpit,
    peach,
    vicviper,
    warriors,
    arthur,
    yoshi,
    mario3,
    luigi3,
    'zelda-nes': zeldaNes,
    'zelda-snes': zeldaSnes,
    'zelda-gb': zeldaGb,
    quickman,
    haggleman,
    wily,
    mrx,
    cossack,
    gemini,
    skullman,
  },
};
