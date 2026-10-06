import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { flipH, swapColors } from '@engine/gfx/pixelart';
import { mapIconFrames } from './map-icons';

/**
 * Item palette roles:
 *   0 outline (black)    1 white            2 red (mushroom cap, spring coil)
 *   3 cream (stem, spots, lift planks)      4 green (1up cap, flower leaves, flag, super spring coil)
 *   5 gold (coin, star, buster)             6 gold light (shine)
 *   7 orange (fire)      8 dark red (shade) 9 brown (brick shards, axe handle)
 *   a light blue (sword beam)               b grey (axe blade, spring plates)
 *   c purple (knuckle, poison cap rim)      d pink (knuckle thumb, knuckle glints)
 *   e blue (weapon pellets, e-tank body, poison cap)
 */
export const itemPalettes: Record<string, string[]> = {
  items: [
    NES.black,
    NES.white,
    NES.redBright,
    NES.tan,
    NES.green,
    NES.yellow,
    NES.yellowLight,
    NES.orange,
    NES.redDark,
    NES.orangeBrown,
    NES.blueLight,
    NES.lightGray,
    NES.purple,
    NES.pink,
    NES.blueMid,
  ],
};

const vflip = (rows: readonly string[]): string[] => [...rows].reverse();

const mushroom = [
  '.....000000.....',
  '...0022222200...',
  '..022233332220..',
  '.02222333322220.',
  '.02222333322220.',
  '0223322222223320',
  '0233332222233330',
  '0233332222233330',
  '0223322222223320',
  '.02222222222220.',
  '..000333333000..',
  '....03333380....',
  '....03333380....',
  '....03333380....',
  '....03333380....',
  '....00000000....',
];

/* Lost Levels poison mushroom (original art): a dark blue cap with a purple rim and sheen, pale
 * spots, and a frowning face on the stem so it reads as a threat next to the red mushroom. */
const poisonMushroom = [
  '.....000000.....',
  '...00eeeeee00...',
  '..0ece3333eee0..',
  '.0ecee3333eeee0.',
  '.0eeeee33eeeee0.',
  '033eeeeeeeeee330',
  '0333eeeeeeee3330',
  '033eeeeeeeeee330',
  '0ceeeeeeeeeeeec0',
  '.0cccccccccccc0.',
  '..000333333000..',
  '...0330330330...',
  '...0333333330...',
  '...0333003330...',
  '...0330330330...',
  '...0000000000...',
];

const flower0 = [
  '....00000000....',
  '..007777777700..',
  '.07775555557770.',
  '.07755666655770.',
  '0775566116655770',
  '0775566116655770',
  '.07755666655770.',
  '.07775555557770.',
  '..007777777700..',
  '....00000000....',
  '......0440......',
  '......0440......',
  '.000..0440..000.',
  '0444000440004440',
  '.04444444444440.',
  '..000000000000..',
];

const star0 = [
  '.......00.......',
  '......0660......',
  '......0650......',
  '.....065550.....',
  '0000006555000000',
  '0666655555555550',
  '.06555555555550.',
  '..055555555550..',
  '...0555555550...',
  '...0555555550...',
  '..055550055550..',
  '.05555000055550.',
  '.05550....05550.',
  '.0550......0550.',
  '.000........000.',
  '................',
];

/* Coin popping out of a block: same spin as the tile coin, item colours. */
const coin0 = [
  '................',
  '.....999999.....',
  '....96655559....',
  '...9665555559...',
  '...9655999559...',
  '...9659555959...',
  '...9659555959...',
  '...9659555959...',
  '...9659555959...',
  '...9659555959...',
  '...9659555959...',
  '...9655999559...',
  '...9555555559...',
  '....95555559....',
  '.....999999.....',
  '................',
];
const coin1 = [
  '................',
  '......9999......',
  '.....965559.....',
  '....96555559....',
  '....96599559....',
  '....96595959....',
  '....96595959....',
  '....96595959....',
  '....96595959....',
  '....96595959....',
  '....96595959....',
  '....96599559....',
  '....95555559....',
  '.....955559.....',
  '......9999......',
  '................',
];
const coin2 = [
  '................',
  '.......99.......',
  '......9669......',
  '......9669......',
  '......9659......',
  '......9659......',
  '......9659......',
  '......9659......',
  '......9659......',
  '......9659......',
  '......9659......',
  '......9659......',
  '......9559......',
  '......9559......',
  '.......99.......',
  '................',
];

/* Double-bit axe; later frames are the shimmer. */
const axe0 = [
  '......0000......',
  '......0990......',
  '...0000990000...',
  '..01bb0990bb10..',
  '.01bbb0990bbb10.',
  '.0bbbb0990bbbb0.',
  '.0bbbb0990bbbb0.',
  '.0bbbb0990bbbb0.',
  '.0bbbb0990bbbb0.',
  '..0bbb0990bbb0..',
  '...0b009900b0...',
  '....00099000....',
  '......0990......',
  '......0990......',
  '......0990......',
  '......0000......',
];

const brickPiece = [
  '.00000..',
  '0339990.',
  '0399980.',
  '0399980.',
  '0999880.',
  '.098880.',
  '..0000..',
  '........',
];

const fireball0 = [
  '........',
  '..7777..',
  '.711557.',
  '.715557.',
  '.755557.',
  '.755557.',
  '..7777..',
  '........',
];

const firebar = [
  '..7777..',
  '.776677.',
  '76655667',
  '76551567',
  '76551567',
  '76655667',
  '.776677.',
  '..7777..',
];

const buster0 = [
  '........',
  '........',
  '..5555..',
  '.566665.',
  '.566665.',
  '..5555..',
  '........',
  '........',
];
const buster1 = [
  '........',
  '........',
  '...555..',
  '..56165.',
  '..56165.',
  '...555..',
  '........',
  '........',
];

const swordBeam = [
  '........',
  '.....a..',
  '....a1a.',
  'aaaa111a',
  '....a1a.',
  '.....a..',
  '........',
  '........',
];

/* Flame travelling left: white-hot core at the head, flickering tail. */
const bowserFlame0 = [
  '......77777......7......',
  '...77755557777..777.....',
  '.775566665557777777777..',
  '7556611166655555777.7777',
  '7556611166655555777.7777',
  '.775566665557777777777..',
  '...77755557777..777.....',
  '......77777......7......',
];
const bowserFlame1 = [
  '......77777....77.......',
  '...77755557777777..77...',
  '.775566665557777777777..',
  '7556611166655555777777.7',
  '7556611166655555777777.7',
  '.775566665557777777777..',
  '...77755557777777..77...',
  '......77777....77.......',
];

/* Lift surface: one 8x8 plank, repeated twice. */
const plank = [
  '00000000',
  '03333390',
  '03333390',
  '03333390',
  '03333390',
  '03333390',
  '09999990',
  '00000000',
];
const platform = plank.map((r) => r + r);

const springPlate = ['.00000000000000.', '0bbbbbbbbbbbbbb0', '.00000000000000.'];
const springBase = ['.00000000000000.', '0bbbbbbbbbbbbbb0', '.00000000000000.'];
const coilRows = [
  '...0220....0220.',
  '..0220....0220..',
  '.0220....0220...',
  '..0220....0220..',
  '...0220....0220.',
  '....0220....0220',
  '...0220....0220.',
  '..0220....0220..',
  '.0220....0220...',
  '..0220....0220..',
];
const blank = '................';
const spring0 = [...springPlate, ...coilRows, ...springBase];

/* The rescued princess (original design): gold crown, brown hair, pink gown, 16x24. */
const princess = [
  '.....0.0.0......',
  '.....05050......',
  '....0555550.....',
  '....0999990.....',
  '...099333990....',
  '...093030390....',
  '...093333390....',
  '...099333990....',
  '....0933390.....',
  '.....00300......',
  '....0dd1dd0.....',
  '...0dddddd0.....',
  '..03ddddddd30...',
  '..03ddd1ddd30...',
  '...0dddddddd0...',
  '...0ddd1dddd0...',
  '..0ddddddddd0...',
  '..0dddd1ddddd0..',
  '.0dddddddddddd0.',
  '.0ddd1dddd1ddd0.',
  '.0dddddddddddd0.',
  '.0d1ddddddd1dd0.',
  '.0dddddddddddd0.',
  '..000000000000..',
];

/* The castle's mushroom retainer (original design): white cap with red spots, blue vest, 16x24. */
const toad = [
  '.....000000.....',
  '...0012222100...',
  '..011222222110..',
  '.01111222211110.',
  '.02211111111220.',
  '0222111111112220',
  '0222111111112220',
  '0221111111111220',
  '0111111111111110',
  '.00000000000000.',
  '...0333333330...',
  '...0303333030...',
  '...0303333030...',
  '...0333333330...',
  '....03333330....',
  '...0ee1111ee0...',
  '..03ee1111ee30..',
  '..03ee1111ee30..',
  '...0ee1111ee0...',
  '...0eeeeeeee0...',
  '...0111111110...',
  '...0111001110...',
  '..09990..09990..',
  '..00000..00000..',
];

/* Pulley wheel for balance lifts: a grey wheel with a dark rim on a cream bracket, 16x16. */
const pulley = [
  '................',
  '......0000......',
  '.....0bbbb0.....',
  '....0b1bb1b0....',
  '...0bb1bb1bb0...',
  '...0b111111b0...',
  '...0bb1001bb0...',
  '...0bb1001bb0...',
  '...0b111111b0...',
  '...0bb1bb1bb0...',
  '....0b1bb1b0....',
  '.....0bbbb0.....',
  '......0000......',
  '.......03.......',
  '......0330......',
  '......0000......',
];

/* Beanstalk: a twisting green stem with leaf pairs; the top frame ends in a curl. */
const vineMid = [
  '.......04.......',
  '......044.......',
  '......044.......',
  '...00.0440..00..',
  '..0440044400440.',
  '.04444044404444.',
  '..0440044400440.',
  '...00.0440..00..',
  '.......044......',
  '.......044......',
  '......0440......',
  '......044.......',
  '...00.044.......',
  '..04400440......',
  '.0444404440.....',
  '..0440.044......',
];
const vineTop = [
  '................',
  '......000.......',
  '.....04440......',
  '....0440440.....',
  '....044.044.....',
  '....0440044.....',
  '.....04444......',
  '......0440......',
  '......044.......',
  '......044.......',
  '......0440......',
  '......044.......',
  '...00.044.......',
  '..04400440......',
  '.0444404440.....',
  '..0440.044......',
];
const spring1 = [blank, blank, blank, blank, ...springPlate, ...coilRows.slice(2, 8), ...springBase];
const spring2 = [
  ...Array.from({ length: 8 }, () => blank),
  ...springPlate,
  ...coilRows.slice(4, 6),
  ...springBase,
];

/* Goal flag: cloth to the left of the pole, white with a green border and diamond. */
const flag = [
  '00000000000000..',
  '04444444444440..',
  '04111111111140..',
  '04111114111140..',
  '04111144411140..',
  '04111444441140..',
  '04114444444140..',
  '04111444441140..',
  '04111144411140..',
  '04111114111140..',
  '04111111111140..',
  '04444444444440..',
  '00000000000000..',
  '................',
  '................',
  '................',
];

/* Small pennant raised on the castle once the level is cleared. */
const castleFlag = [
  '......0b........',
  '......0b000000..',
  '......0b222220..',
  '......0b211120..',
  '......0b222220..',
  '......0b000000..',
  '......0b........',
  '......0b........',
  '......0b........',
  '......0b........',
  '......0b........',
  '......0b........',
  '......0b........',
  '......0b........',
  '......0b........',
  '......0b........',
];

/* Firework over the castle after the flagpole (original art): a white-hot pop, an eight-ray gold
 * burst, then scattered orange and red embers. */
const firework0 = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.......66.......',
  '......6116......',
  '.....611116.....',
  '.....611116.....',
  '......6116......',
  '.......66.......',
  '................',
  '................',
  '................',
  '................',
  '................',
];
const firework1 = [
  '................',
  '.......55.......',
  '..5....66....5..',
  '...6...11...6...',
  '....1......1....',
  '................',
  '................',
  '.5661..11..1665.',
  '.5661..11..1665.',
  '................',
  '................',
  '....1......1....',
  '...6...11...6...',
  '..5....66....5..',
  '.......55.......',
  '................',
];
const firework2 = [
  '.......77.......',
  '..7..........7..',
  '................',
  '................',
  '.....2....2.....',
  '................',
  '................',
  '7..2........2..7',
  '7..2........2..7',
  '................',
  '................',
  '.....2....2.....',
  '................',
  '................',
  '..7..........7..',
  '.......77.......',
];

/* Round black bomb with a grey cap, a short fuse curling up to the right and a grey highlight; frame 1
 * lights the fuse. */
const bomb0 = [
  '..........9.....',
  '.........99.....',
  '.......0990.....',
  '......0bbbb0....',
  '.....000bb00....',
  '....00000000....',
  '...00bb000000...',
  '..00bb00000000..',
  '..0b0000000000..',
  '..000000000000..',
  '..000000000000..',
  '..000000000000..',
  '..000000000000..',
  '...0000000000...',
  '....00000000....',
  '.....000000.....',
];
const bomb1 = ['........5.1.5...', '.........616....', '.......09590....', ...bomb0.slice(3)];

/* Fireball burst in three sizes: white-hot core, medium ring throwing spikes, large ragged ring. */
const explosion0 = [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '...............88...............',
  '...............77...............',
  '...............77...............',
  '........8..............8........',
  '.........7..77777777..7.........',
  '..........777755557777..........',
  '..........775555555577..........',
  '.........77555666655577.........',
  '.........77556666665577.........',
  '.........75566111166557.........',
  '.....877.75566111166557.778.....',
  '.....877.75566111166557.778.....',
  '.........75566111166557.........',
  '.........77556666665577.........',
  '.........77555666655577.........',
  '..........775555555577..........',
  '..........777755557777..........',
  '.........7..77777777..7.........',
  '........8..............8........',
  '...............77...............',
  '...............77...............',
  '...............88...............',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
];
const explosion1 = [
  '................................',
  '...............88...............',
  '...............77...............',
  '...............77...............',
  '....8......8...77...8......8....',
  '.....7....8.77777777.8....7.....',
  '......7...777777777777...7......',
  '.......777775555555577777.......',
  '.......777555555555555777.......',
  '.......775556666666655577.......',
  '.....8775556661111666555778.....',
  '....8.77556611111111665577.8....',
  '.....77556611......11665577.....',
  '.....7755661...11...1665577.....',
  '.....7755611........1165577.....',
  '.87777755611.1....1.11655777778.',
  '.87777755611.1....1.11655777778.',
  '.....7755611........1165577.....',
  '.....7755661...11...1665577.....',
  '.....77556611......11665577.....',
  '....8.77556611111111665577.8....',
  '.....8775556661111666555778.....',
  '.......775556666666655577.......',
  '.......777555555555555777.......',
  '.......777775555555577777.......',
  '......7...777777777777...7......',
  '.....7....8.77777777.8....7.....',
  '....8......8...77...8......8....',
  '...............77...............',
  '...............77...............',
  '...............88...............',
  '................................',
];
const explosion2 = [
  '...............77...............',
  '..........888.8788.888..........',
  '........8887788888877888....8...',
  '.......887777755557777788..7....',
  '.......777777555555777777.7.....',
  '......8877555......5557788......',
  '......87755..........55778......',
  '.......75......8.......57.......',
  '...88......................88...',
  '..8877....................7788..',
  '.887755..................557788.',
  '.87755................8...55778.',
  '.8775....8.................5778.',
  '.8775......................5778.',
  '88755......................55788',
  '88755......................55787',
  '.7875......................5787.',
  '78875...8..................5788.',
  '8.875......................578..',
  '..8775....................5778..',
  '..8775....................5778..',
  '..8875.....8.........8...55788..',
  '...8775..................5778...',
  '...8875.................57788...',
  '....88.5........8......577788...',
  '........5.............5577788...',
  '....7..7755.........5557778..8..',
  '...7..87775555...5555777778.....',
  '..8...8877777777777777777788....',
  '.......888777777777777788..8....',
  '.........8887777788888..........',
  '............78888...............',
];

/* Bent boomerang, two pixels thick with a dark edge; four frames step it a quarter turn each so cycling
 * them spins it clockwise. The 90-degree frame is drawn, the others are derived. */
const transpose = (rows: readonly string[]): string[] =>
  (rows[0] ?? '').split('').map((_, x) => rows.map((r) => r[x] ?? '.').join(''));

const boomerangCorner = [
  '00000000',
  '03333330',
  '03777770',
  '03700000',
  '0370....',
  '0370....',
  '0370....',
  '0000....',
];
const boomerangSide = [
  '....0370',
  '...0370.',
  '..0370..',
  '.0370...',
  '.0370...',
  '..0370..',
  '...0370.',
  '....0370',
];

/* Blue potion jar with a grey stopper and a light highlight down the left. */
const magicJarSmall = [
  '...00...',
  '..0bb0..',
  '.0aaaa0.',
  '0a1aaaa0',
  '0a1aaaa0',
  '0aaaaaa0',
  '.0aaaa0.',
  '..0000..',
];
const magicJarLarge = [
  '................',
  '......0000......',
  '.....0bbbb0.....',
  '.....0bbbb0.....',
  '....00aaaa00....',
  '..00aaaaaaaa00..',
  '.0aaaaaaaaaaaa0.',
  '0aa11aaaaaaaaaa0',
  '0a11aaaaaaaaaaa0',
  '0a1aaaaaaaaaaaa0',
  '0a1aaaaaaaaaaaa0',
  '0aaaaaaaaaaaaaa0',
  '0aaaaaaaaaaaaaa0',
  '.0aaaaaaaaaaaa0.',
  '..00aaaaaaaa00..',
  '....00000000....',
];

const heartSmall = [
  '........',
  '.00..00.',
  '02100220',
  '02222220',
  '02222220',
  '.022220.',
  '..0220..',
  '...00...',
];

/* HUD icons: drawn without black so they stay legible on the black status bar. */
const iconBoomerang = [
  '....133.',
  '...133..',
  '..133...',
  '.133....',
  '.133....',
  '..133...',
  '...133..',
  '....133.',
];
const iconBomb = [
  '.....5..',
  '....9...',
  '..bbbb..',
  '.b1bbbb.',
  '.b1bbbb.',
  '.bbbbbb.',
  '.bbbbbb.',
  '..bbbb..',
];
const iconJump = [
  '...11...',
  '..1111..',
  '.111111.',
  '11111111',
  '...66...',
  '...66...',
  '...66...',
  '...66...',
];
const iconShield = [
  '.555555.',
  '5aaaaaa5',
  '5aa1aaa5',
  '5aaaaaa5',
  '.5aaaa5.',
  '.5aaaa5.',
  '..5aa5..',
  '...55...',
];
const iconFire = [
  '...7....',
  '...77.7.',
  '..775.7.',
  '.775577.',
  '.7755577',
  '77551157',
  '.7551157',
  '..75557.',
];

/* ---------- arm-cannon weapon pickups and projectiles ---------- */

/* Spinning blade: a grey disc with a dark hub, a highlight arc and eight teeth. Frame 1 turns the
 * teeth half a step so cycling the two frames spins it. */
const sawDisc0 = [
  '.......00.......',
  '.00...0bb0...00.',
  '.0b0..0bb0..0b0.',
  '..0b00bbbb00b0..',
  '...0b11bbbbb0...',
  '...01bbbbbbb0...',
  '.001bbbbbbbbb00.',
  '0bbbbbb00bbbbbb0',
  '0bbbbbb00bbbbbb0',
  '.00bbbbbbbbbb00.',
  '...0bbbbbbbb0...',
  '...0bbbbbbbb0...',
  '..0b00bbbb00b0..',
  '.0b0..0bb0..0b0.',
  '.00...0bb0...00.',
  '.......00.......',
];
const sawDisc1 = [
  '................',
  '....00....00....',
  '....0b0000b0....',
  '....0bbbbbb0....',
  '.000b11bbbbb000.',
  '.0bb1bbbbbbbbb0.',
  '..01bbbbbbbbb0..',
  '..0bbbb00bbbb0..',
  '..0bbbb00bbbb0..',
  '..0bbbbbbbbbb0..',
  '.0bbbbbbbbbbbb0.',
  '.000bbbbbbbb000.',
  '....0bbbbbb0....',
  '....0b0000b0....',
  '....00....00....',
  '................',
];

/* Leaf tilted up to the right: green blade, pale midrib along the diagonal, short stem. */
const leaf = [
  '..............0.',
  '.............040',
  '...........04640',
  '.........0446440',
  '........0446440.',
  '......044464440.',
  '.....044464440..',
  '....044464440...',
  '...044464440....',
  '..044464440.....',
  '.044464440......',
  '.0446440........',
  '0446440.........',
  '04640...........',
  '090.............',
  '00..............',
];

/* Low, wide tongue of fire hugging the floor: dark red base, orange body, yellow flames and two
 * white-hot cores. Frame 1 flickers the tips and moves the cores. */
const flameWave0 = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '......7.........',
  '..7..77....7....',
  '..77.775..77..7.',
  '.7757755..775.7.',
  '.775575577775577',
  '7755556557755577',
  '7755661655566577',
  '7756611165566577',
  '8755661165566578',
  '8877555555555788',
];
const flameWave1 = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '...........7....',
  '....7.....77..7.',
  '.7.77....775..7.',
  '.7.775..7775.77.',
  '7757755777557577',
  '7755557755565577',
  '7756655555661577',
  '7756115565611677',
  '8756116555611678',
  '8877555555555788',
];

/* Clenched metal fist punching right: purple hand and cuff, pink thumb curled over the top with a
 * white glint, three pink knuckle bumps on the leading edge. */
const knuckle = [
  '................',
  '................',
  '......00000.....',
  '.....0ddddd0....',
  '....0d1dddcd0...',
  '.0000dddddccc0..',
  '0ccc0cccccccc00.',
  '0ccc0ccccccccdd0',
  '0ccc0cccccc000d0',
  '0ccc0ccccccccdd0',
  '0ccc0cccccc000d0',
  '0ccc0ccccccccdd0',
  '.00000cccccc0d0.',
  '......0cccccc0..',
  '.......000000...',
  '................',
];

/* Horizontal lightning beam: a two-pixel zigzag, yellow core over a pale edge, white at the
 * peaks. Frame 1 is the mirror image so the two alternate. */
const bolt0 = [
  '........................',
  '...1.........1..........',
  '..565.......565.....1...',
  '556.65.....56.65...565..',
  '66...65...56...65.56.655',
  '......65.56.....616...66',
  '.......616.......6......',
  '........6...............',
];

/* Robot-dog launcher pad: a red box with two eyes, a nose and four stubby feet, carrying a grey
 * spring with a plate on top. Frame 1 is the spring fully extended after a launch. */
const rushBody = [
  '..000000000000..',
  '..022222222220..',
  '..021022220120..',
  '..022228822220..',
  '..022222222220..',
  '..088888888880..',
  '..00.00..00.00..',
];
const rushPlate = ['...0000000000...', '...0bbbbbbbb0...', '...0000000000...'];
const rushCoil = ['....0b0..0b0....', '.....0b00b0.....'];
const rushCoil0 = [blank, blank, blank, blank, ...rushPlate, ...rushCoil, ...rushBody];
const rushCoil1 = [...rushPlate, ...rushCoil, ...rushCoil, ...rushCoil, ...rushBody];

/* Health capsule: pale yellow with a white glint top-left and a gold shade below. The weapon
 * energy capsules are the same shapes in blue. */
const pelletSmall = [
  '..0000..',
  '.066660.',
  '01166650',
  '01666650',
  '06666550',
  '06655550',
  '.055550.',
  '..0000..',
];
const pelletLarge = [
  '.....000000.....',
  '...0066666600...',
  '..016666666660..',
  '.01116666666660.',
  '.01166666666660.',
  '0116666666666650',
  '0116666666666550',
  '0166666666665550',
  '0666666666655550',
  '0666666666555550',
  '0666666665555550',
  '.06666655555550.',
  '.06665555555550.',
  '..055555555550..',
  '...0055555500...',
  '.....000000.....',
];
const weaponPellet = (rows: readonly string[]): string[] => swapColors(rows, { '6': 'a', '5': 'e' });

/* Energy tank: a blue canister with a grey cap, light rims and a bold white E on the front. */
const eTank = [
  '.....000000.....',
  '.....0bbbb0.....',
  '....00000000....',
  '..000aaaaaa000..',
  '.0aaeeeeeeeeaa0.',
  '.0aeeeeeeeeeee0.',
  '.0aee111111eee0.',
  '.0aee11eeeeeee0.',
  '.0aee11111eeee0.',
  '.0aee11eeeeeee0.',
  '.0aee111111eee0.',
  '.0aeeeeeeeeeee0.',
  '.0aeeeeeeeeeee0.',
  '.0aaeeeeeeeeaa0.',
  '..00aaaaaaaa00..',
  '....00000000....',
];

/* Weapon HUD icons, again without black. */
const iconBuster = [
  '........',
  '...eeeee',
  '.aaeaaae',
  'aaaeaaa1',
  'aaaeaaa1',
  '.aaeaaae',
  '...eeeee',
  '........',
];
const iconSaw = [
  '...bb...',
  '.b.bb.b.',
  '.bbbbbb.',
  'bbb11bbb',
  'bbb11bbb',
  '.bbbbbb.',
  '.b.bb.b.',
  '...bb...',
];
const iconLeaf = [
  '......4.',
  '....4464',
  '...44644',
  '..446444',
  '.446444.',
  '.46444..',
  '4644....',
  '94......',
];
const iconFlame = [
  '....7...',
  '.7..77..',
  '.77.775.',
  '.775757.',
  '77555577',
  '75566557',
  '75611657',
  '.756657.',
];
const iconKnuckle = [
  '........',
  '..dddd..',
  '.d1ddddc',
  'cccccccd',
  'ccccccc.',
  'cccccccd',
  '.cccccc.',
  '........',
];
const iconBolt = [
  '....55..',
  '...515..',
  '..515...',
  '.5155555',
  '..555155',
  '....515.',
  '...515..',
  '..55....',
];
const iconRush = [
  'bbbbbbbb',
  '.bb..bb.',
  '...bb...',
  '.bb..bb.',
  '...bb...',
  '.bb..bb.',
  '22222222',
  '2.2..2.2',
];

/* ---------- bounty-hunter beams, missiles and pickups ---------- */

/* Power beam: a short gold bolt with a pale head, travelling right. Frame 1 stretches the tail a
 * pixel so the two flicker. */
const beam0 = [
  '........',
  '........',
  '...5556.',
  '..556661',
  '..556661',
  '...5556.',
  '........',
  '........',
];
const beam1 = [
  '........',
  '........',
  '....556.',
  '.5556661',
  '.5556661',
  '....556.',
  '........',
  '........',
];
/* Ice beam: the same bolt in light blue with a white head. */
const iceBeam = (rows: readonly string[]): string[] => swapColors(rows, { '5': 'a', '6': '1' });
/* Wave beam: two purple strands twisting round each other with pink crests. Frame 1 is the
 * mirror image so alternating the two makes the wave undulate. */
const waveBeam0 = [
  '........',
  '.cd.....',
  'c.cd..cc',
  '...cd.dc',
  '....cdc.',
  '.....c..',
  '........',
  '........',
];
const waveBeam1 = vflip(waveBeam0);

/* Missile, 16x8: grey tube with a light stripe, a red nose cone, tail fins and an orange flame. */
const missile = [
  '................',
  '....0b0.........',
  '....0b00000000..',
  '.7.0bbb1bbbbb20.',
  '7550bbbbbbbbb220',
  '.7.0bbbbbbbbb20.',
  '....0b00000000..',
  '....0b0.........',
];

/* Morph bomb: a small grey sphere whose gold core blinks white. */
const morphBomb0 = [
  '........',
  '..0000..',
  '.0bbbb0.',
  '0bb55bb0',
  '0bb55bb0',
  '.0bbbb0.',
  '..0000..',
  '........',
];
const morphBomb1 = swapColors(morphBomb0, { '5': '1' });

/* Energy orbs: a gold ball with a pale rim and a white-hot centre. */
const energyOrbSmall = [
  '..0000..',
  '.056650.',
  '05611650',
  '06111160',
  '06111160',
  '05611650',
  '.056650.',
  '..0000..',
];
const energyOrbLarge = [
  '.....000000.....',
  '...0055555500...',
  '..055666666550..',
  '.05566111166550.',
  '.05661111116650.',
  '0556611111166550',
  '0556111111116550',
  '0561111111111650',
  '0561111111111650',
  '0556111111116550',
  '0556611111166550',
  '.05661111116650.',
  '.05566111166550.',
  '..055666666550..',
  '...0055555500...',
  '.....000000.....',
];

/* Missile pack: a grey capsule with red end caps and a white missile with a red nose painted across
 * the front. */
const missilePack = [
  '....00000000....',
  '..002222222200..',
  '.02222222222220.',
  '.0bbbbbbbbbbbb0.',
  '0b1bbbbbbbbbbbb0',
  '0b1bb000000000b0',
  '0b1b701111111220',
  '0b1b701111111220',
  '0b1bb000000000b0',
  '0b1bbbbbbbbbbbb0',
  '0b1bbbbbbbbbbbb0',
  '0bbbbbbbbbbbbbb0',
  '.02222222222220.',
  '.02222222222220.',
  '..002222222200..',
  '....00000000....',
];

/* HUD icons for the bounty-hunter weapons, drawn without black so they read on the status bar. */
const iconBeam = [
  '........',
  '........',
  '5..5556.',
  '.5556661',
  '.5556661',
  '5..5556.',
  '........',
  '........',
];
const iconMissile = [
  '...22...',
  '..2222..',
  '..bbbb..',
  '..b1bb..',
  '..b1bb..',
  '.bbbbbb.',
  '.b7777b.',
  '..7..7..',
];

/* ---------- vampire-hunter sub-weapons, pickups and HUD icons ---------- */

/** Rotate a square block a quarter turn clockwise. */
const rotateCW = (rows: readonly string[]): string[] => flipH(transpose(rows));

/* Thrown dagger, 16x8, flying right: brown grip with a dark pommel, a black cross-guard and a long
 * grey blade with a light highlight near the guard, tapering to the point. */
const dagger = [
  '................',
  '................',
  '....0000000000..',
  '0999011bbbbbbbb0',
  '09990bbbbbbbbb0.',
  '....0000000000..',
  '................',
  '................',
];

/* Hand axe, 16x16, upright: a straight brown haft with a grey hatchet head on the right whose
 * convex edge carries a light bevel. The other three frames turn it a quarter each. */
const handAxe0 = [
  '................',
  '....000000000...',
  '....099bbbbb0...',
  '....099bbbbb10..',
  '....099bbbbbb10.',
  '....099bbbbbb10.',
  '....099bbbbbb10.',
  '....099bbbbb10..',
  '....0990bbbb10..',
  '....09900bb10...',
  '....0990.0000...',
  '....0990........',
  '....0990........',
  '....0990........',
  '....0990........',
  '....000.........',
];
const handAxe1 = rotateCW(handAxe0);
const handAxe2 = rotateCW(handAxe1);
const handAxe3 = rotateCW(handAxe2);

/* Holy water, 8x8: a stubby round-shouldered flask of blue liquid with a grey cork and a white
 * glint high on the left. */
const holyWater = [
  '...00...',
  '..0bb0..',
  '..0ee0..',
  '.0e11e0.',
  '0ee1eee0',
  '0eeeeee0',
  '0eeeeee0',
  '.000000.',
];

/* Holy fire, 16x16, bottom-aligned: a low pool of blue flame with lighter tongues and white-hot
 * spots; frame 1 moves the tongues and the spots so the two flicker. */
const holyFire0 = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....e.....e....',
  '..e..ee...ee..e.',
  '..ee.eae..eae.e.',
  '.eae.eae.eeaeee.',
  '.eaeeeaaeeeaaaee',
  'eeaa1aaaaeaa1aee',
  'eea111aaaaa11aee',
  'eeaaaaaaaaaaaaee',
];
const holyFire1 = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..e......e......',
  '..ee..e..ee...e.',
  '.eae..ee.eae..ee',
  '.eae.eaeeeaae.ee',
  'eeaaeeaaeeeaaeee',
  'eea1aaa1aaaa1aae',
  'eea11aa11aaa11ae',
  'eeaaaaaaaaaaaaee',
];

/* Thrown cross, 16x16: a thick white cross with grey shading along the right and underside, gold
 * caps on all four arms and a gold stud at the crossing. The other frames turn it a quarter each. */
const cross0 = [
  '.....000000.....',
  '.....055550.....',
  '.....0111b0.....',
  '.....0111b0.....',
  '000000111b000000',
  '0511111111111b50',
  '0511111551111b50',
  '05bbbbb55bbbbb50',
  '05bbbbbbbbbbbb50',
  '000000111b000000',
  '.....0111b0.....',
  '.....0111b0.....',
  '.....0111b0.....',
  '.....0bbbb0.....',
  '.....055550.....',
  '.....000000.....',
];
const cross1 = rotateCW(cross0);
const cross2 = rotateCW(cross1);
const cross3 = rotateCW(cross2);

/* Stopwatch, 8x8: a grey pocket watch with a gold crown, white face and black hands at three o'clock. */
const stopwatch = [
  '...55...',
  '..0000..',
  '.0b11b0.',
  '0b1101b0',
  '0b1100b0',
  '0b1111b0',
  '.0b11b0.',
  '..0000..',
];

/* Large heart, 16x16: the small heart grown up, with a white glint on the left lobe and a dark red
 * shade down the right side. */
const heartLarge = [
  '................',
  '...0000..0000...',
  '..022220022220..',
  '.02112220222220.',
  '.02112222222220.',
  '.02122222222220.',
  '.02222222222220.',
  '.02222222222280.',
  '..022222222280..',
  '..022222222280..',
  '...0222222280...',
  '....02222280....',
  '.....022280.....',
  '......0280......',
  '.......00.......',
  '................',
];

/* Sub-weapon HUD icons, drawn without black so they read on the status bar. */
const iconDagger = [
  '........',
  '........',
  '...5....',
  '9951bbbb',
  '995bbbb.',
  '...5....',
  '........',
  '........',
];
const iconHandAxe = [
  '...bbbb.',
  '.99bbbbb',
  '.99bbbb1',
  '.99bbb1.',
  '.99.....',
  '.99.....',
  '.99.....',
  '.99.....',
];
const iconHolyWater = [
  '...bb...',
  '...ee...',
  '..e11e..',
  '.ee1eee.',
  '.eeeeee.',
  '.eeeeee.',
  '.eeeeee.',
  '..eeee..',
];
const iconCross = [
  '...55...',
  '...11...',
  '...11...',
  '51111115',
  '51111115',
  '...11...',
  '...11...',
  '...55...',
];
const iconWatch = [
  '...55...',
  '..1111..',
  '.1bbbb1.',
  '1bbb1bb1',
  '1bbb11b1',
  '1bbbbbb1',
  '.1bbbb1.',
  '..1111..',
];

/* ---------- ninja throwing weapons, ninpo and HUD icons ---------- */

const blank16 = Array.from({ length: 16 }, () => blank);

/** Merge equally sized layers: later layers paint over earlier ones wherever they are not '.'. */
const overlay = (...layers: readonly (readonly string[])[]): string[] =>
  (layers[0] ?? []).map((row, y) =>
    row
      .split('')
      .map((_, x) =>
        layers.reduce(
          (ch, layer) => ((layer[y]?.[x] ?? '.') === '.' ? ch : ((layer[y] as string)[x] as string)),
          '.',
        ),
      )
      .join(''),
  );

/* Throwing star, 8x8: four short blades around a dark hub, white along the upper-left edges.
 * Frame 1 is the same star turned 45 degrees so the two alternate as it spins. */
const throwingStar0 = [
  '...1b...',
  '...1b...',
  '...1b...',
  '11100bbb',
  'bbb00bbb',
  '...bb...',
  '...bb...',
  '...bb...',
];
const throwingStar1 = [
  '1......b',
  '11....bb',
  '.11..bb.',
  '..100b..',
  '..b00b..',
  '.bb..bb.',
  'bb....bb',
  'b......b',
];

/* Windmill shuriken, 16x16: four hooked blades sweeping clockwise off a grey hub with a dark
 * hole, white along each blade's straight leading edge and a glint on one blade so every quarter
 * turn reads as a new frame. Frame 0 has the blades on the axes, frame 1 on the diagonals; frames
 * 2 and 3 turn those a quarter, so cycling all four spins the wheel an eighth of a turn per frame. */
const windmillHub = [
  ...blank16.slice(0, 6),
  '......bbbb......',
  '......b00b......',
  '......b00b......',
  '......bbbb......',
  ...blank16.slice(10),
];
const windmillBladeUp = [
  '......1b........',
  '......1bb.......',
  '......1bbb......',
  '......1bbbb.....',
  '......1bbbbb....',
  '......1bbbbbb...',
  ...blank16.slice(6),
];
const windmillBladeDiag = [
  '..............1.',
  '.............1b.',
  '............1bb.',
  '...........1bbb.',
  '..........1bbbb.',
  '.........1bbbb..',
  '........1bbbb...',
  '........bbbb....',
  ...blank16.slice(8),
];
/** Four copies of one blade a quarter turn apart around the hub. */
const wheel = (blade: readonly string[], glint: readonly string[]): string[] => {
  const b1 = rotateCW(blade);
  const b2 = rotateCW(b1);
  return overlay(blade, b1, b2, rotateCW(b2), windmillHub, glint);
};
const windmill0 = wheel(windmillBladeUp, [...blank16.slice(0, 3), '.........1......', ...blank16.slice(4)]);
const windmill1 = wheel(windmillBladeDiag, [...blank16.slice(0, 4), '.............1..', ...blank16.slice(5)]);
const windmill2 = rotateCW(windmill0);
const windmill3 = rotateCW(windmill1);

/* Fire wheel, 16x16: a rolling orb of flame, orange outside, yellow inside and a white-hot core,
 * with tongues licking off the rim. Frame 1 moves the tongues and the core so the two flicker. */
const fireWheel0 = [
  '......7....7....',
  '...7..77..77....',
  '...77777777777..',
  '..7777555557777.',
  '.77755666665577.',
  '.775566116655777',
  '7755661111665577',
  '7755611111165577',
  '7755611111165577',
  '7755661111665577',
  '.775566116655777',
  '..775566665577..',
  '..7775555577.7..',
  '...77777777777..',
  '....77..77..7...',
  '.....7....7.....',
];
const fireWheel1 = [
  '....7....7......',
  '....77..77..7...',
  '..77777777777...',
  '.7777555557777..',
  '.77556666655777.',
  '7775566111665577',
  '7755661111165577',
  '7755611111165577',
  '7755611111165577',
  '7755661111665577',
  '7775566111665577',
  '..775566665577..',
  '..7.7755555777..',
  '...77777777777..',
  '....7..77..77...',
  '......7....7....',
];

/* Ninpo spirit flame: a teardrop of light-blue fire with a white core and a blue edge so it
 * stays visible over the sky, in a small 8x8 and a large 16x16 size. */
const ninpoSmall = [
  '....e...',
  '...eae..',
  '..eaaae.',
  '.eaa1aae',
  '.ea111ae',
  '.ea11aae',
  '..eaaae.',
  '...eee..',
];
const ninpoLarge = [
  '.........e......',
  '........eae.....',
  '.......eaae..e..',
  '......eaaae.eae.',
  '......eaaaaeaae.',
  '.....eaaaaaaaae.',
  '....eaaa1aaaaaae',
  '....eaa111aaaaae',
  '...eaaa1111aaaae',
  '...eaa111111aaae',
  '...eaa111111aaae',
  '...eaaa1111aaaae',
  '....eaaa11aaaae.',
  '....eaaaaaaaaae.',
  '.....eaaaaaaae..',
  '......eeeeeee...',
];

/* Ninja HUD icons, drawn without black so they read on the status bar. */
const iconStar = [
  '...1b...',
  '...1b...',
  '...1b...',
  '111bbbbb',
  'bbbbbbbb',
  '...bb...',
  '...bb...',
  '...bb...',
];
const iconWindmill = [
  '...1....',
  '...1b...',
  '..b1bb..',
  '.bbbb111',
  '111bbbb.',
  '..bb1b..',
  '...b1...',
  '....1...',
];
const iconFireWheel = [
  '7..77..7',
  '.777777.',
  '.775577.',
  '77511577',
  '77511577',
  '.775577.',
  '.777777.',
  '7..77..7',
];
const iconSlash = [
  '......1b',
  '.....1bb',
  '....1bb.',
  '..51bb..',
  '...bb5..',
  '..9.....',
  '.9......',
  '5.......',
];

/* ---------- commando gun shots, weapon capsule and HUD icons ---------- */

/* Rifle shot, 8x8: a small round bullet, gold rim around a white core, centred. */
const rifleShot = [
  '........',
  '........',
  '...55...',
  '..5115..',
  '..5115..',
  '...55...',
  '........',
  '........',
];

/* Machine-gun shot, 8x8: a longer orange slug tapering to a gold and white tip on the right. */
const mgShot = [
  '........',
  '........',
  '..7777..',
  '.7776661',
  '.7776661',
  '..7777..',
  '........',
  '........',
];

/* Spread shot, 8x8: a round fireball with a red rim, orange body and gold core. Frame 1 throws
 * out four red sparks and whitens the core so the two flicker. */
const spreadShot0 = [
  '........',
  '..2222..',
  '.277772.',
  '.276672.',
  '.276672.',
  '.277772.',
  '..2222..',
  '........',
];
const spreadShot1 = [
  '.2....2.',
  '..2772..',
  '.277772.',
  '.276172.',
  '.271672.',
  '.277772.',
  '..2772..',
  '.2....2.',
];

/* Laser beam, 24x8: a thin blue beam, light blue inside, with a white-hot core running the full
 * length and tapered ends. */
const laserBeam = [
  '........................',
  '........................',
  '.eaaaaaaaaaaaaaaaaaaaae.',
  'eaa111111111111111111aae',
  '.eaaaaaaaaaaaaaaaaaaaae.',
  '........................',
  '........................',
  '........................',
];

/* Flame shot, 16x16: a rolling fireball flying right, orange outside, gold inside and a white-hot
 * heart, with a tail of flame streaming back on the left. Frame 1 rolls the tongues and the tail
 * so the two flicker. */
const flameShot0 = [
  '................',
  '................',
  '..........777...',
  '........7755577.',
  '.......77566657.',
  '...7..7756611657',
  '.777775561111657',
  '7775556611116657',
  '.777556661116657',
  '...775566666577.',
  '......775555577.',
  '.....7..7777777.',
  '..........7.7...',
  '................',
  '................',
  '................',
];
const flameShot1 = [
  '................',
  '................',
  '..........7.7...',
  '.........777777.',
  '.......77555557.',
  '......7756666657',
  '.....77566111657',
  '.777755661111657',
  '7775555661111657',
  '..7.77556666657.',
  '......775555577.',
  '........777777..',
  '..........7.....',
  '................',
  '................',
  '................',
];

/* Weapon capsule, 16x16: a rounded grey pod with a white glint, a red letter-like mark on the
 * front and a pair of small white wings spread from its shoulders. */
const capsule = [
  '................',
  '................',
  '................',
  '11....0000....11',
  '.11..0bbbb0..11.',
  '.1110bbbbbb0111.',
  '1110bb2222bb0111',
  '.1101b2bbbbb011.',
  '..101b222bbb01..',
  '...0bb2bbbbb0...',
  '...0bbbbbbbb0...',
  '....0bbbbbb0....',
  '.....0bbbb0.....',
  '......0000......',
  '................',
  '................',
];

/* Commando HUD icons, drawn without black so they read on the status bar. */
const iconRifle = [
  '........',
  '........',
  '.....bb.',
  'bbbbbbbb',
  '99bb....',
  '99.b....',
  '........',
  '........',
];
const iconMg = [
  '........',
  '........',
  'bbbbbbb7',
  '9bbbbbb.',
  '99.bb...',
  '...bb...',
  '...bb...',
  '........',
];
const iconSpread = [
  '.....77.',
  '.....77.',
  '........',
  '22....77',
  '22....77',
  '........',
  '.....77.',
  '.....77.',
];
const iconLaser = [
  '........',
  '........',
  '........',
  'ea111111',
  '.eaaaaaa',
  '........',
  '........',
  '........',
];
const iconFlameGun = [
  '....7...',
  '.....77.',
  '...77677',
  'bbb76617',
  'bbb76617',
  '...77677',
  '.....77.',
  '....7...',
];

export const itemsDef: SpriteDef = {
  palette: 'items',
  frames: {
    mushroom,
    '1up': swapColors(mushroom, { '2': '4' }),
    'poison-mushroom': poisonMushroom,
    'flower-0': flower0,
    'flower-1': swapColors(flower0, { '7': '2', '5': '6', '6': '5' }),
    'star-0': star0,
    'star-1': swapColors(star0, { '5': '6', '6': '1' }),
    'star-2': swapColors(star0, { '5': '7', '6': '5' }),
    'star-3': swapColors(star0, { '5': '2', '6': '7' }),
    'coin-0': coin0,
    'coin-1': coin1,
    'coin-2': coin2,
    'coin-3': swapColors(coin1, { '6': '5' }),
    'axe-0': axe0,
    'axe-1': swapColors(axe0, { '1': 'b' }),
    'axe-2': swapColors(axe0, { b: '1' }),
    'brick-piece': brickPiece,
    'fireball-0': fireball0,
    'fireball-1': flipH(fireball0),
    'fireball-2': vflip(flipH(fireball0)),
    'fireball-3': vflip(fireball0),
    firebar,
    'buster-0': buster0,
    'buster-1': buster1,
    'sword-beam': swordBeam,
    'bowser-flame-0': bowserFlame0,
    'bowser-flame-1': bowserFlame1,
    platform,
    'spring-0': spring0,
    'spring-1': spring1,
    'spring-2': spring2,
    'spring-green-0': swapColors(spring0, { '2': '4' }),
    'spring-green-1': swapColors(spring1, { '2': '4' }),
    'spring-green-2': swapColors(spring2, { '2': '4' }),
    'vine-top': vineTop,
    pulley,
    'vine-mid': vineMid,
    flag,
    'castle-flag': castleFlag,
    'firework-0': firework0,
    'firework-1': firework1,
    'firework-2': firework2,
    princess,
    toad,
    'bomb-0': bomb0,
    'bomb-1': bomb1,
    'explosion-0': explosion0,
    'explosion-1': explosion1,
    'explosion-2': explosion2,
    'boomerang-0': vflip(transpose(boomerangSide)),
    'boomerang-1': vflip(boomerangCorner),
    'boomerang-2': boomerangSide,
    'boomerang-3': boomerangCorner,
    'magic-jar-small': magicJarSmall,
    'magic-jar-large': magicJarLarge,
    'heart-small': heartSmall,
    'icon-boomerang': iconBoomerang,
    'icon-bomb': iconBomb,
    'icon-jump': iconJump,
    'icon-shield': iconShield,
    'icon-fire': iconFire,
    'saw-disc-0': sawDisc0,
    'saw-disc-1': sawDisc1,
    leaf,
    'flame-wave-0': flameWave0,
    'flame-wave-1': flameWave1,
    knuckle,
    'bolt-0': bolt0,
    'bolt-1': vflip(bolt0),
    'rush-coil-0': rushCoil0,
    'rush-coil-1': rushCoil1,
    'pellet-small': pelletSmall,
    'pellet-large': pelletLarge,
    'weapon-pellet-small': weaponPellet(pelletSmall),
    'weapon-pellet-large': weaponPellet(pelletLarge),
    'e-tank': eTank,
    'icon-buster': iconBuster,
    'icon-saw': iconSaw,
    'icon-leaf': iconLeaf,
    'icon-flame': iconFlame,
    'icon-knuckle': iconKnuckle,
    'icon-bolt': iconBolt,
    'icon-rush': iconRush,
    'beam-0': beam0,
    'beam-1': beam1,
    'ice-beam-0': iceBeam(beam0),
    'ice-beam-1': iceBeam(beam1),
    'wave-beam-0': waveBeam0,
    'wave-beam-1': waveBeam1,
    missile,
    'morph-bomb-0': morphBomb0,
    'morph-bomb-1': morphBomb1,
    'energy-orb-small': energyOrbSmall,
    'energy-orb-large': energyOrbLarge,
    'missile-pack': missilePack,
    'icon-beam': iconBeam,
    'icon-missile': iconMissile,
    dagger,
    'hand-axe-0': handAxe0,
    'hand-axe-1': handAxe1,
    'hand-axe-2': handAxe2,
    'hand-axe-3': handAxe3,
    'holy-water': holyWater,
    'holy-fire-0': holyFire0,
    'holy-fire-1': holyFire1,
    'cross-0': cross0,
    'cross-1': cross1,
    'cross-2': cross2,
    'cross-3': cross3,
    stopwatch,
    'heart-large': heartLarge,
    'icon-dagger': iconDagger,
    'icon-axe': iconHandAxe,
    'icon-holy-water': iconHolyWater,
    'icon-cross': iconCross,
    'icon-watch': iconWatch,
    'throwing-star-0': throwingStar0,
    'throwing-star-1': throwingStar1,
    'windmill-0': windmill0,
    'windmill-1': windmill1,
    'windmill-2': windmill2,
    'windmill-3': windmill3,
    'fire-wheel-0': fireWheel0,
    'fire-wheel-1': fireWheel1,
    'ninpo-small': ninpoSmall,
    'ninpo-large': ninpoLarge,
    'icon-star': iconStar,
    'icon-windmill': iconWindmill,
    'icon-fire-wheel': iconFireWheel,
    'icon-slash': iconSlash,
    'rifle-shot': rifleShot,
    'mg-shot': mgShot,
    'spread-shot-0': spreadShot0,
    'spread-shot-1': spreadShot1,
    'laser-beam': laserBeam,
    'flame-shot-0': flameShot0,
    'flame-shot-1': flameShot1,
    capsule,
    'icon-rifle': iconRifle,
    'icon-mg': iconMg,
    'icon-spread': iconSpread,
    'icon-laser': iconLaser,
    'icon-flame-gun': iconFlameGun,
    ...mapIconFrames,
  },
};
