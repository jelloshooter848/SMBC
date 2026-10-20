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
  ],
};

/** Mario: the red cap and its white badge, brown hair, the big nose over a black moustache. */
const mario = [
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

/** Luigi: the same cap in green with his L, a taller face and a longer moustache. */
const luigi = [
  '.......0000000000.......',
  '.....00666666666600.....',
  '....0666661111666660....',
  '...066666116611666660...',
  '...066666116111666660...',
  '..0666666611116666660...',
  '..06666666666666666660..',
  '..00000000000006666660..',
  '..0ccc22222220006666660.',
  '..0cc2220220222000000...',
  '.0cc22220220222222220...',
  '.0c222220220222222220...',
  '.0c2222222222333222220..',
  '.0c222222222222222222220',
  '..0c22222000000000022220',
  '..0cc2220000000000002220',
  '...0cc220000000000000220',
  '....0c22222222222222220.',
  '.....002222222222222200.',
  '.....06600022222220066..',
  '....06666600000000666660',
  '...0666699666666669966660',
  '..06666699666666669966666',
  '.066666666666666666666666',
].map((r) => r.slice(0, 24).padEnd(24, '.'));

/** Link: the long green cap falling back, blond fringe, a pointed ear, green tunic. */
const link = [
  '........00000000........',
  '......006666666600......',
  '.....06666666666660.....',
  '....0666666666666660....',
  '...066666666666666660...',
  '..0d6d6d6d6d66666666600.',
  '..0dddddddddd666666666600',
  '..0ddd2222222dd66666666660',
  '..0dd222222222dd6666666660',
  '..0d22000222000d2066666660',
  '.0d222010222010d2206666660',
  '.0d222000222000d22220666660',
  '.0d2222222222222222220066600',
  '..0222222232222222220..0660',
  '..022222222222222220....00.',
  '...0222220000222220........',
  '....02222222222220.........',
  '.....000222222000..........',
  '....06660000000666.........',
  '...0666666666666666........',
  '..066667666666766660.......',
  '.06666667666667666660......',
  '.06666666766676666660......',
  '.06666666676766666660......',
].map((r) => r.slice(0, 24).padEnd(24, '.'));

/** Samus: the round orange helmet, its green visor, the red rim and the shoulder pads. */
const samus = [
  '.......0000000000.......',
  '.....00ggggggggggg00....',
  '....0ggggggggggggggg0...',
  '...0ggggg555555ggggggg0..',
  '..0gggg5500000055ggggg0..',
  '..0ggg5066666666055gggg0.',
  '.0ggg506666666666605gggg0',
  '.0ggg506611666666605gggg0',
  '.0ggg506616666666605gggg0',
  '.0ggg506666666666605gggg0',
  '.0ggg550666666666055gggg0',
  '.0gggg5500000000055ggggg0',
  '.0ggggg555555555555gggggg0',
  '..0gggggggggggggggggggg0.',
  '..05ggggggggggggggggg50..',
  '...055gggggggggggggg550..',
  '..0dd0555555555555550dd0.',
  '.0ddddd000000000000ddddd0',
  '0ddggddd0555555550dddggdd0',
  '0dggggdd0555555550ddggggd0',
  '0dggggdd0555555550ddggggd0',
  '0ddgggdd0555555550ddgggdd0',
  '0ddddddd0555555550ddddddd0',
  '.0000000055555555500000000',
].map((r) => r.slice(0, 24).padEnd(24, '.'));

/** Simon: long brown hair under a red headband, a strong jaw, the leather armour's collar. */
const simon = [
  '......000000000000......',
  '....00bbbbbbbbbbbb00....',
  '...0bbbbbbbbbbbbbbbb0...',
  '..0bbbbbbbbbbbbbbbbbb0..',
  '..0b444444444444444b0...',
  '..0b555555555555555b0...',
  '.0bbb2222222222222bbb0..',
  '.0bb222000222000222bb0..',
  '.0bb222010222010222bb0..',
  '.0bb2220002220002222bb0.',
  '.0bb2222222222222222bb0.',
  '.0bbb222222232222222bb0.',
  '.0bbb22222222222222bbb0.',
  '.0bbbb222200000222bbbb0.',
  '.0bbbbb2222222222bbbbb0.',
  '..0bbbbb22222222bbbbb0..',
  '..0bbbbbb000000bbbbbb0..',
  '...0bbbb0cccccc0bbbb0...',
  '...0bb0cccbbbbccc0bb0...',
  '..0bbcccbbbbbbbbcccbb0..',
  '.0cccbbbbbbbbbbbbbbccc0.',
  '0cccbbbbbbbbbbbbbbbbccc0',
  '0ccbbbbbbbbbbbbbbbbbbcc0',
  '0cbbbbbbbbbbbbbbbbbbbbc0',
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

/** Bill: short dark hair and a red bandana, a squared jaw, bare shoulders. */
const bill = [
  '.......00000000000......',
  '.....00ccccccccccc00....',
  '....0cccccccccccccccc0..',
  '...0ccccccccccccccccccc0.',
  '...04444444444444444440.',
  '..044444444444444444444000',
  '..055555555555555555554440',
  '..0c22222222222222222c05440',
  '..0c22200022220002222c0.0440',
  '..0c22201022220102222c0..00',
  '..0c22200022220002222c0..',
  '..0c22222222222222222c0..',
  '..0c22222222322222222c0..',
  '..0c22222222222222222c0..',
  '...0c22222000000222220...',
  '...0c22222222222222220...',
  '....0c222222222222220....',
  '.....00222222222222000...',
  '....0222000000000002220..',
  '...02222222222222222222200',
  '..022222333222222233322220',
  '.0222223333222222333332220',
  '.0222222333222222333322220',
  '.0222222222222222222222220',
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
 * from the princess face (brown hair and a red jewel; gold hair and a white gown; Game Boy
 * greens), Quick Man from Bass's helmet in red with its gold crest, Haggle Man from Ryu's hood in
 * red.
 */
const mario3 = recolour(mario, { c: '0', 9: 'a' });
const luigi3 = recolour(luigi, { c: '0', 9: 'a', 6: '7' });
const zeldaNes = recolour(peach, { l: 'b', 8: '4' });
const zeldaSnes = recolour(peach, { l: 'd', d: 'f', i: '1', 8: 'j' });
const zeldaGb = recolour(peach, { 0: '7', l: '7', d: '6', 8: '7', i: '6', 2: 'l', 3: '6', 4: '6', 1: 'l' });
const quickman = recolour(bass, { h: '4' });
const haggleman = recolour(ryu, { a: '5', 9: '4', 4: 'd' });
/*
 * Bass's other looks (owner addition): Dr. Wily, Mr. X and Dr. Cossack from the moustached face
 * (grey hair over a white coat; a purple beret and coat; a brown fur hat and coat), Gemini Man and
 * Skull Man from Bass's helmet (white and blue with a cyan crest; a white skull).
 */
const wily = recolour(mario, { 4: 'f', 1: 'f', c: 'f' });
const mrx = recolour(mario, { 4: 'j', 1: 'j', c: 'h' });
const cossack = recolour(mario, { 4: 'b', 1: 'c', c: 'b' });
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
