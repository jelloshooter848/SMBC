import { NES } from '@engine/gfx/palette';
import { flipH } from '@engine/gfx/pixelart';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * Enemy sprites. Original 8-bit style designs (nothing traced): a grumpy walking toadstool, an
 * upright turtle with a domed shell, a snapping pod-plant, a steel beetle, a spiked crawler, a
 * stubby cannon shell, a puffer-ish fish, a squid, a helmeted hammer-thrower, a cloud rider
 * with goggles and a horned, spike-shelled king monster.
 *
 * Palette index roles, identical in every palette so area/colour swaps work:
 *   1 = outline / dark          2 = body main           3 = body light / skin
 *   4 = eye white / teeth       5 = shell colour        6 = shell highlight
 *   7 = red accent              8 = green accent (stems, leaves)
 *   9 = yellow accent           a = steel (bullets, hammers, beetles, helmets)
 *   b = steel highlight / cloud shadow
 *
 * Turtle colour: a koopa's shell uses only 5 (main) and 6 (highlight), so a red turtle is the
 * same frames drawn with the `koopa-red` palette (shell indices swapped to red); `koopa-green`
 * is an alias of the overworld palette so callers can always pass a koopa palette name.
 *
 * Plant colour: the pod-plant's head uses only 7 (with 1 outline and 4 teeth/spots; the stem is
 * 8), so `piranha-green` and `piranha-red` differ only in index 7. Like the turtles they are the
 * same in every area theme, so a red plant reads red underground and in castles too.
 *
 * All frames face LEFT (enemies walk left by default); the renderer flips for right.
 */
const base = (outline: string, main: string, light: string, red: string): string[] => [
  NES.black,
  outline,
  main,
  light,
  NES.white,
  NES.green,
  NES.greenLight,
  red,
  NES.greenPipe,
  NES.yellow,
  NES.gray,
  NES.lightGray,
];

const overworld = base(NES.brownDark, NES.orangeBrown, NES.tan, NES.redBright);
const koopaRed = [...overworld];
koopaRed[5] = NES.redBright;
koopaRed[6] = NES.peach;
const piranhaGreen = [...overworld];
piranhaGreen[7] = NES.green;
const piranhaRed = [...overworld];
piranhaRed[7] = NES.redBright;

export const enemyPalettes: Record<string, string[]> = {
  'enemies-overworld': overworld,
  'enemies-underground': base(NES.black, NES.blueUnderground, NES.lavender, NES.blueLight),
  'enemies-castle': base(NES.black, NES.gray, NES.tan, NES.redBright),
  'enemies-water': base(NES.black, NES.blueUnderground, NES.lavender, NES.redBright),
  // Slow Cheep Cheeps: the red accent becomes grey.
  'cheep-grey': base(NES.black, NES.blueUnderground, NES.lavender, NES.gray),
  'koopa-green': [...overworld],
  'koopa-red': koopaRed,
  'piranha-green': piranhaGreen,
  'piranha-red': piranhaRed,
  // The fake king's true forms in a castle: the castle colours, but outlined in dark grey (the
  // NES castle sprite palettes carry no black), so they read against the black background.
  'bowser-true-form': base(NES.darkGray, NES.gray, NES.tan, NES.redBright),
};

/** Paint `top` over `bottom`; '.' in `top` keeps the pixel underneath. */
const layer = (bottom: readonly string[], top: readonly string[]): string[] =>
  bottom.map((row, y) => {
    const t = top[y];
    if (!t) return row;
    return row
      .split('')
      .map((c, x) => (t[x] && t[x] !== '.' ? (t[x] as string) : c))
      .join('');
  });

const blank = (w: number, h: number): string[] => Array.from({ length: h }, () => '.'.repeat(w));

/* ------------------------------------------------------------------------------------------ */
/* Walking toadstool (goomba role), 16x16                                                      */
/* ------------------------------------------------------------------------------------------ */

const GOOMBA_TOP = [
  '.....111111.....',
  '...1122222211...',
  '..122222222221..',
  '.12122222221221.',
  '.12211222211221.',
  '.12144222144221.',
  '.12444222444221.',
  '.12222222222221.',
  '..122222222221..',
  '...1333333331...',
  '..133111111331..',
  '..133433334331..',
  '...1333333331...',
];

const GOOMBA_FEET_0 = ['..111133331111..', '.11111.....1111.', '11111......1111.'];
const GOOMBA_FEET_1 = flipH(GOOMBA_FEET_0);

const GOOMBA_SQUASH = [
  ...blank(16, 8),
  '.....111111.....',
  '...1122222211...',
  '.12211222211221.',
  '.12144222144221.',
  '..122222222221..',
  '..133433334331..',
  '.11111111111111.',
  '1111111111111111',
];

/* ------------------------------------------------------------------------------------------ */
/* Turtle (koopa role), 16x24                                                                  */
/* ------------------------------------------------------------------------------------------ */

const KOOPA_BODY = [
  '...1111.........',
  '..133331........',
  '.13333331.......',
  '.13143331.......',
  '.13443331.......',
  '.133333331......',
  '.133333331......',
  '..1111331.1111..',
  '.....1331156651.',
  '....133315666651',
  '...1333315566651',
  '..13333315566551',
  '.131333315555551',
  '.133333315655551',
  '.111333315555551',
  '...1333315555551',
  '...1333311555511',
  '....133331333311',
];

/** Legs, 6 rows: alternate frames swap which foot is forward. */
const KOOPA_LEGS_0 = [
  '....13331111111.',
  '....1333..1331..',
  '...13331..1331..',
  '..133331..13331.',
  '..133331..13331.',
  '..111111..11111.',
];
const KOOPA_LEGS_1 = [
  '....13331111111.',
  '.....1331.1331..',
  '.....1331.1331..',
  '....13331.13331.',
  '....13331.13331.',
  '....11111.11111.',
];

const KOOPA_0 = [...KOOPA_BODY, ...KOOPA_LEGS_0];
const KOOPA_1 = [...KOOPA_BODY, ...KOOPA_LEGS_1];

/** Wings behind the shell (overlay). */
const WINGS_0 = [
  '................',
  '................',
  '................',
  '................',
  '..........11....',
  '.........1441...',
  '.........14441..',
  '..........14441.',
  '...........1441.',
  '............141.',
  '.............11.',
];
const WINGS_1 = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '...............1',
  '..............14',
  '.............144',
  '............1441',
  '...........1441.',
  '..........1111..',
];

/** Shell on its own, 14 px tall, bottom aligned in 16x16. */
const SHELL = [
  '................',
  '................',
  '.....111111.....',
  '...1156666511...',
  '..155665566551..',
  '.15566556655551.',
  '.15565556555551.',
  '.15555555555551.',
  '.15565556555551.',
  '.15555655555551.',
  '.15555555555551.',
  '.11555555555511.',
  '.13311111111331.',
  '.13333333333331.',
  '..133333333331..',
  '...1111111111...',
];

const SHELL_WIGGLE = [
  '................',
  '................',
  '.....111111.....',
  '...1156666511...',
  '..155665566551..',
  '.15566556655551.',
  '.15565556555551.',
  '.15555555555551.',
  '.15565556555551.',
  '.15555655555551.',
  '.11555555555511.',
  '113311111111331.',
  '1331333333333311',
  '1331133333331331',
  '.11111111111.11.',
  '.111........111.',
];

/* ------------------------------------------------------------------------------------------ */
/* Snapping pod-plant (piranha role), 16x24                                                    */
/* ------------------------------------------------------------------------------------------ */

const PIRANHA_STEM = [
  '......1881......',
  '....1.1881.1....',
  '...18818811881..',
  '..18881881188881',
  '...18818811881..',
  '....111881111...',
  '......1881......',
  '......1881......',
  '......1881......',
  '......1881......',
];

const PIRANHA_0 = [
  '.....111111.....',
  '...1177777711...',
  '..177477777471..',
  '.17777777777771.',
  '.17477777747771.',
  '.17777747777771.',
  '.14444444444441.',
  '.11411411411411.',
  '..14444444441...',
  '...1777777771...',
  '...1747777471...',
  '....17777771....',
  '.....111111.....',
  '......1881......',
  ...PIRANHA_STEM,
];

const PIRANHA_1 = [
  '.....111111.....',
  '...1177777711...',
  '..177477777471..',
  '.17777777777771.',
  '.17477777747771.',
  '.14444444444441.',
  '.14141414141441.',
  '.11111111111111.',
  '.11111111111111.',
  '.11411411411411.',
  '..14444444441...',
  '...1777777771...',
  '....17477471....',
  '.....111111.....',
  ...PIRANHA_STEM,
];

/* ------------------------------------------------------------------------------------------ */
/* Steel beetle (buzzy role) and spiked crawler (spiny role), 16x16                            */
/* ------------------------------------------------------------------------------------------ */

const BUZZY_DOME = [
  '................',
  '................',
  '......11111.....',
  '....11abbbaa1...',
  '...1abbbaaaaa1..',
  '..1abbaaaaaaaa1.',
  '..1abaaaaaaaaa1.',
  '.1aaaaaaaaaaaaa1',
  '.1aaaaaaaaaaaaa1',
  '.1aaaaaaaaaaaaa1',
  '.11aaaaaaaaaaa11',
  '..11aaaaaaaaa11.',
];

const BUZZY_0 = [
  ...BUZZY_DOME.slice(0, 10),
  '1411aaaaaaaaaa11',
  '14411111111111..',
  '.111.1331.1331..',
  '....1331..1331..',
  '....1111..1111..',
  '................',
];

const BUZZY_1 = [
  ...BUZZY_DOME.slice(0, 10),
  '1411aaaaaaaaaa11',
  '14411111111111..',
  '.111..1331.1331.',
  '......1331.1331.',
  '......1111.1111.',
  '................',
];

const BUZZY_SHELL = [
  ...BUZZY_DOME,
  '...11111111111..',
  '....1bbbbbbb1...',
  '.....1111111....',
  '................',
];

const SPINY_BODY = [
  '..4..4....4..4..',
  '..41.41..41.41..',
  '..1771771771771.',
  '.17777777777771.',
  '.17777777777771.',
  '114777777777771.',
  '144177777777771.',
  '1441777777777771',
  '.11177777777771.',
  '..1777777777771.',
  '..1777777777771.',
  '...1177777771...',
];

const SPINY_0 = [...blank(16, 1), ...SPINY_BODY, '..1331..1331....', '..1331..1331....', '..1111..1111....'];
const SPINY_1 = [...blank(16, 1), ...SPINY_BODY, '....1331..1331..', '....1331..1331..', '....1111..1111..'];

const SPINY_EGG = [
  '.....4.1.4......',
  '....4411144.....',
  '..4.11777111.4..',
  '..441777777144..',
  '.4.17777777771.4',
  '.4117777777771.4',
  '4.1777777777771.',
  '4.1777777777771.',
  '.4117777777771.4',
  '.4.17777777771.4',
  '..441777777144..',
  '..4.11777111.4..',
  '....4411144.....',
  '.....4.1.4......',
  '................',
  '................',
];

/* ------------------------------------------------------------------------------------------ */
/* Cannon shell (bullet role), fish, squid, hammer                                             */
/* ------------------------------------------------------------------------------------------ */

const BULLET = [
  '................',
  '................',
  '.......111111111',
  '.....11abbbbbba1',
  '...11aabbbbbbba1',
  '..1aaaaaaaaaaaa1',
  '.1aa44aaaaaaaaa1',
  '.1a4414aaaaaa111',
  '1aa4414aaaaaa1b1',
  '1aaa44aaaaaaa1b1',
  '1aaaaaaaaaaaa111',
  '.1aaaaaaaaaaaaa1',
  '..1aaaaaaaaaaaa1',
  '...11aaaaaaaaaa1',
  '.....11aaaaaaaa1',
  '.......111111111',
];

const CHEEP_0 = [
  '................',
  '........11......',
  '.......1991.....',
  '.....1177771..1.',
  '....17777777119.',
  '...1447777777991',
  '..14417777777911',
  '..14441777777991',
  '..17777777777191',
  '...17777777771.1',
  '....1177777711..',
  '......199191....',
  '.......11.1.....',
  '................',
  '................',
  '................',
];

const CHEEP_1 = [
  '................',
  '................',
  '................',
  '.......1111.....',
  '.....11777711.1.',
  '....1777777771.1',
  '...1447777777991',
  '..14417777777991',
  '..14441777777911',
  '..17777777777191',
  '...1777777777191',
  '....1177777711.1',
  '......1991......',
  '.......11.......',
  '................',
  '................',
];

/* Podoboo: a teardrop fireball, flame tip up (flipped vertically when falling), 16x16. */
const PODOBOO_0 = [
  '.......1........',
  '......191.......',
  '......191.......',
  '.....19791......',
  '.....19791......',
  '....1977791.....',
  '....1977791.....',
  '...197777791....',
  '...197779791....',
  '..19777779791...',
  '..19777777791...',
  '..19777777791...',
  '..17977777771...',
  '...177777771....',
  '....1777771.....',
  '.....11111......',
];
const PODOBOO_1 = [
  '........1.......',
  '.......191......',
  '......1991......',
  '.....197791.....',
  '.....197791.....',
  '....19777791....',
  '....19777791....',
  '...1977797791...',
  '...1977777791...',
  '..197777779791..',
  '..197777777791..',
  '..197977777791..',
  '..179777777971..',
  '...1777777771...',
  '....17777771....',
  '.....111111.....',
];

const BLOOPER_HEAD = [
  '.....111111.....',
  '....14444441....',
  '...1444444441...',
  '..144444444441..',
  '..144444444441..',
  '.14444444444441.',
  '.14414444414441.',
  '.14414444414441.',
  '.14444444444441.',
  '.14444444444441.',
  '..144444444441..',
];

const BLOOPER_0 = [
  ...BLOOPER_HEAD,
  '..114444444411..',
  '.14444444444441.',
  '141.141.141.141.',
  '141.141.141.141.',
  '.11.141.141.11..',
  '....141.141.....',
  '....141.141.....',
  '.....1...1......',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const BLOOPER_1 = [
  ...blank(16, 4),
  ...BLOOPER_HEAD,
  '..114444444411..',
  '.14444444444441.',
  '.14141414141411.',
  '.14141414141411.',
  '..11.11.11.11...',
  '................',
  '................',
  '................',
  '................',
];

const HAMMER_0 = [
  '................',
  '....1111111.....',
  '...1abbbbbba1...',
  '...1aaaaaaaa1...',
  '...1aaaaaaaa1...',
  '....1111111.....',
  '......122.......',
  '......122.......',
  '......122.......',
  '......122.......',
  '......122.......',
  '......122.......',
  '......122.......',
  '......122.......',
  '.......1........',
  '................',
];

const HAMMER_1 = [
  '................',
  '................',
  '................',
  '................',
  '..1111..........',
  '.1abba1.........',
  '.1abba1.........',
  '.1aaaa1.........',
  '.1aaaa11222222..',
  '.1aaaa11222222..',
  '.1aaaa1.........',
  '.1aaaa1.........',
  '..1111..........',
  '................',
  '................',
  '................',
];

/* ------------------------------------------------------------------------------------------ */
/* Hammer-thrower and cloud rider, 16x24                                                       */
/* ------------------------------------------------------------------------------------------ */

/** Helmeted head, 8 rows, drops straight onto the turtle body. */
const HAMMER_BRO_HEAD = [
  '...1111.........',
  '..1aaaa1........',
  '.1abbaaa1.......',
  '.111111111......',
  '.13143331.......',
  '.13443331.......',
  '.133333331......',
  '..1111331.1111..',
];

/** Arm raised with the hammer hand above the shoulder (overlay). */
const HB_ARM_UP = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '13..............',
  '13..............',
  '13..............',
  '13..............',
  '11..............',
  '.1..............',
  '1...............',
];

const HAMMER_BRO_0 = layer([...HAMMER_BRO_HEAD, ...KOOPA_BODY.slice(8), ...KOOPA_LEGS_0], HB_ARM_UP);
const HAMMER_BRO_1 = [...HAMMER_BRO_HEAD, ...KOOPA_BODY.slice(8), ...KOOPA_LEGS_1];

const CLOUD = [
  '......111.......',
  '....11bbb11.....',
  '...1bb444bb1....',
  '..1b4444444b1...',
  '.1b444444444b1..',
  '1b41444414444b1.',
  '1b44444444444b1.',
  '.1b4444444444b1.',
  '..1bbbbbbbbbb1..',
  '...1111111111...',
];

const LAKITU_HEAD = [
  '....111111......',
  '...15555551.....',
  '..1566555551....',
  '..11111111111...',
  '.1444114444411..',
  '.1414114144411..',
  '.1444114444411..',
  '..1111133111....',
  '...1333333331...',
  '....1333311.....',
  '.....1111.......',
  '......1331......',
  '.....133331.....',
  '....11333311....',
  '....11111111....',
];

const LAKITU_0 = [...LAKITU_HEAD.slice(0, 14), ...CLOUD].slice(0, 24);
const LAKITU_1 = [...blank(16, 1), ...LAKITU_HEAD.slice(0, 13), ...CLOUD].slice(0, 24);

/* ------------------------------------------------------------------------------------------ */
/* Spike-shelled king monster (bowser role), 32x32                                             */
/* ------------------------------------------------------------------------------------------ */

/** Rows are left-aligned and padded to 32 (the monster faces left, so the right edge is air). */
const pad32 = (rows: readonly string[]): string[] => rows.map((r) => r.padEnd(32, '.'));

/** Head, 18 rows. Closed mouth. */
const KING_HEAD_CLOSED = pad32([
  '..............77...77',
  '......11.....177..1771',
  '.....1331...17771.17771',
  '....1333311117771117771.4.4.4',
  '....13333177777717777711414141',
  '....1333117777771777755111111',
  '.....1115555555177755222222221',
  '....15555555555517752222222221',
  '...1555577777755555522222222221',
  '..15555514444155555522222222221',
  '..15555514114155555522222222221',
  '..15555514444155555552222222221',
  '.155555555555555555552222222221',
  '.133355555555555555552222222221',
  '.13333333111111111155522222221',
  '.14141414141414141415522222221',
  '.11111111111111111115522222221',
  '..133333333333333331552222221',
]);

/** Head, 18 rows. Jaw dropped for the fire breath. */
const KING_HEAD_OPEN = pad32([
  '..............77...77',
  '......11.....177..1771',
  '.....1331...17771.17771',
  '....1333311117771117771.4.4.4',
  '....13333177777717777711414141',
  '....1333117777771777755111111',
  '.....1115555555177755222222221',
  '....15555555555517752222222221',
  '...1555577777755555522222222221',
  '..15555514444155555522222222221',
  '..15555514114155555522222222221',
  '..15555514444155555552222222221',
  '.155555555555555555552222222221',
  '.14141414141414141415522222221',
  '.11111111111111111155522222221',
  '.11111111111111111115522222221',
  '.14141414141414141115522222221',
  '.13333333333333333315522222221',
]);

/** Belly, arm and shell underside, 6 rows. */
const KING_BODY = pad32([
  '..13333333333333331155222221',
  '.1311333333333333333155222211',
  '1344133333333333333315512211',
  '1344113333333333333331511',
  '.111.1333333333333333151',
  '......13333333333333331',
]);

const KING_LEGS_0 = pad32([
  '.....133333311333331',
  '....13333331.1333331',
  '...1333331.1.1333331',
  '...1333331...1333331',
  '..13311111...1331111',
  '..1441.......1441.1',
  '..1111.......1111',
  '',
]);

const KING_LEGS_1 = pad32([
  '.....1333333333331',
  '.....13333331333331',
  '.....1333331.133331',
  '....13333311.133331',
  '....1331111..1331111',
  '....1441.....1441.1',
  '....1111.....1111',
  '',
]);

const king = (head: readonly string[], legs: readonly string[]): string[] => [...head, ...KING_BODY, ...legs];

/* ------------------------------------------------------------------------------------------ */
/* The fake king's true forms (bowser-die-1..7)                                                */
/* ------------------------------------------------------------------------------------------ */

/*
 * The fireball death frames: the original's Bowser clip has one per world, `die_1` to `die_8`,
 * shown upside down as he falls (Bowser.as `die`: FL_DIE + level.worldNum; Enemy.die: scaleY =
 * -1). Worlds 1-7 unmask the fake king as that world's stand-in; world 8's is the king himself.
 *
 * How the unmasking reads, following the NES game Crossover copies (HandleEnemyFBallCol swaps
 * the defeated king's enemy id for BowserIdentities[world] and flips it over):
 *   - the stand-in is drawn at its own size (16 wide, 16 or 24 tall), not stretched to the
 *     king's, in the place of his front half: the head end of the box, its top 24 rows;
 *   - worlds 1-3 get the defeated state $23, which draws the turtle and the steel beetle as an
 *     overturned SHELL (no head or feet), not as the walking enemy; 4-7 are the whole enemy;
 *   - nothing in that castle palette is black, so outlines stay visible on the black castle
 *     background (see the `bowser-true-form` palette).
 *
 * Frames are drawn upright here (feet down, facing left like every enemy frame); the corpse is
 * mirrored vertically when drawn, so on screen each one is head-down at the top of the box.
 */

/** Knocked-out toadstool: crossed eyes, feet kicked out. 16x16. */
const TF_GOOMBA = [
  '.....111111.....',
  '...1122222211...',
  '..122222222221..',
  '.12112222221121.',
  '.12221122112221.',
  '.12244122144221.',
  '.12244122144221.',
  '.12222222222221.',
  '..122222222221..',
  '...1333333331...',
  '..133111111331..',
  '..133433334331..',
  '...1333333331...',
  '.11111333311111.',
  '1111111..1111111',
  '.11111....11111.',
];

/** The turtle's empty shell, a hex plate on the dome and the pale rim below. 16x16. */
const TF_SHELL = [
  '................',
  '.....111111.....',
  '...1156666511...',
  '..155666655551..',
  '.15655555555551.',
  '.15655666655551.',
  '.15556555565551.',
  '.15556555565551.',
  '.15555666655551.',
  '.15555555555551.',
  '.11555555555511.',
  '1331111111111331',
  '1333333333333331',
  '.13333333333331.',
  '..111111111111..',
  '................',
];

/** The steel beetle's empty shell: lit dome, dark band, steel lip. 16x16. */
const TF_BUZZY_SHELL = [
  '................',
  '................',
  '.....111111.....',
  '...11bbbaaa11...',
  '..1bbbaaaaaaa1..',
  '.1bbaaaaaaaaaa1.',
  '.1baaaaaaaaaaa1.',
  '1baaaaaaaaaaaaa1',
  '1aaaaaaaaaaaaaa1',
  '1aaaaaaaaaaaaaa1',
  '1aaaaaaaaaaaaaa1',
  '11aaaaaaaaaaaa11',
  '.11111111111111.',
  '..1bbbbbbbbbb1..',
  '...1111111111...',
  '................',
];

/** Spiked crawler with its legs splayed. 16x16. */
const TF_SPINY = [
  '....1...1...1...',
  '...141.141.141..',
  '..1444144414441.',
  '.177777777777771',
  '.147777777777771',
  '1441777777777771',
  '1441777777777771',
  '.117777777777771',
  '..17777777777771',
  '..17777777777771',
  '...117777777711.',
  '.....11111111...',
  '...1331..1331...',
  '..1331....1331..',
  '.1331......1331.',
  '.111........111.',
];

/** Cloud rider knocked about in his seat: goggles wide, hands gripping the cloud's rim. 16x24. */
const TF_LAKITU = [
  '.....111111.....',
  '....15566551....',
  '...1555556651...',
  '..111111111111..',
  '..144441144441..',
  '..141441141441..',
  '..144441144441..',
  '...1111331111...',
  '....13333331....',
  '...1133333311...',
  '..131333333131..',
  '..131333333131..',
  '..111.1111.111..',
  '.1bbb1bbbb1bbb1.',
  '1b444b4444b444b1',
  '1b444444444444b1',
  '1b441444144444b1',
  '1b444444444444b1',
  '.1b4444444444b1.',
  '..1bbbbbbbbbb1..',
  '...1111111111...',
  '................',
  '................',
  '................',
];

/** Squid gone limp: slit eyes, tentacles fanned out. 16x24. */
const TF_BLOOPER = [
  '.....111111.....',
  '....14444441....',
  '...1444444441...',
  '..144444444441..',
  '..144444444441..',
  '.14444444444441.',
  '.14444444444441.',
  '.14414444441441.',
  '.14414444441441.',
  '.14444444444441.',
  '..144444444441..',
  '..114444444411..',
  '.14444444444441.',
  '.141.141141.141.',
  '141..141141..141',
  '11...141141...11',
  '.....141141.....',
  '....141..141....',
  '....141..141....',
  '....11....11....',
  '................',
  '................',
  '................',
  '................',
];

/** Hammer-thrower caught mid-throw: a small hammer held up clear of the helmet, legs kicked out. 16x24. */
const TF_HAMMER_BRO = layer(
  [
    ...HAMMER_BRO_HEAD,
    ...KOOPA_BODY.slice(8, 17),
    '....13331111111.',
    '...13331..13331.',
    '..13331....13331',
    '.13331......1331',
    '.1111.......1111',
    '................',
    '................',
  ],
  [
    '...........11111',
    '...........1abb1',
    '...........11111',
    '............131.',
    '............131.',
    '............131.',
    '...........1331.',
    '...........1331.',
  ],
);

/**
 * Place an upright 16-wide form in the king's 32x32 box: two columns in (his hit box's front
 * edge), from row 8 down, so once mirrored it fills the top 24 rows (a 16-tall form the lower 16
 * of those, as the NES draws a 16x16 enemy in the bottom two of its three tile rows).
 */
const trueForm = (rows: readonly string[]): string[] => [
  ...blank(32, 8),
  ...rows.map((r) => `..${r}..............`),
  ...blank(32, 24 - rows.length),
];

/**
 * A frame's outline: its opaque pixels that touch a clear one (or the edge), all in colour 1.
 * The campaign's fake Bowsers wear their true form's outline with reduce flashing on, the steady
 * stand-in for the tell's flicker (docs/STORY.md 2.3a).
 */
const outline = (rows: readonly string[]): string[] => {
  const clear = (x: number, y: number) => (rows[y]?.[x] ?? '.') === '.';
  return rows.map((row, y) =>
    [...row]
      .map((c, x) =>
        c !== '.' && (clear(x - 1, y) || clear(x + 1, y) || clear(x, y - 1) || clear(x, y + 1)) ? '1' : '.',
      )
      .join(''),
  );
};

const TRUE_FORMS = [TF_GOOMBA, TF_SHELL, TF_BUZZY_SHELL, TF_SPINY, TF_LAKITU, TF_BLOOPER, TF_HAMMER_BRO];

/**
 * How tall each true form is (`bowser-die-N`, N = 1..7; its rows start at row 8 of the king's
 * 32-pixel box), so it can be drawn standing on his feet.
 */
export const TRUE_FORM_HEIGHT: Readonly<Record<number, number>> = Object.fromEntries(
  TRUE_FORMS.map((rows, i) => [i + 1, rows.length]),
);

/* ------------------------------------------------------------------------------------------ */

export const enemiesDef: SpriteDef = {
  palette: 'enemies-overworld',
  frames: {
    'goomba-0': [...GOOMBA_TOP, ...GOOMBA_FEET_0],
    'goomba-1': [...GOOMBA_TOP, ...GOOMBA_FEET_1],
    'goomba-squash': GOOMBA_SQUASH,
    shell: SHELL,
    'shell-wiggle': SHELL_WIGGLE,
    'piranha-0': PIRANHA_0,
    'piranha-1': PIRANHA_1,
    'buzzy-0': BUZZY_0,
    'buzzy-1': BUZZY_1,
    'buzzy-shell': BUZZY_SHELL,
    'spiny-0': SPINY_0,
    'spiny-1': SPINY_1,
    'spiny-egg': SPINY_EGG,
    bullet: BULLET,
    'cheep-0': CHEEP_0,
    'cheep-1': CHEEP_1,
    'blooper-0': BLOOPER_0,
    'blooper-1': BLOOPER_1,
    'podoboo-0': PODOBOO_0,
    'podoboo-1': PODOBOO_1,
    'hammer-0': HAMMER_0,
    'hammer-1': HAMMER_1,
    'koopa-0': KOOPA_0,
    'koopa-1': KOOPA_1,
    'koopa-fly-0': layer(KOOPA_0, WINGS_0),
    'koopa-fly-1': layer(KOOPA_1, WINGS_1),
    'hammer-bro-0': HAMMER_BRO_0,
    'hammer-bro-1': HAMMER_BRO_1,
    'lakitu-0': LAKITU_0,
    'lakitu-1': LAKITU_1,
    'bowser-0': king(KING_HEAD_CLOSED, KING_LEGS_0),
    'bowser-1': king(KING_HEAD_CLOSED, KING_LEGS_1),
    'bowser-2': king(KING_HEAD_OPEN, KING_LEGS_0),
    'bowser-3': king(KING_HEAD_OPEN, KING_LEGS_1),
    'bowser-die-1': trueForm(TF_GOOMBA),
    'bowser-die-2': trueForm(TF_SHELL),
    'bowser-die-3': trueForm(TF_BUZZY_SHELL),
    'bowser-die-4': trueForm(TF_SPINY),
    'bowser-die-5': trueForm(TF_LAKITU),
    'bowser-die-6': trueForm(TF_BLOOPER),
    'bowser-die-7': trueForm(TF_HAMMER_BRO),
    'bowser-die-8': king(KING_HEAD_OPEN, KING_LEGS_0),
    // The true forms' outlines (the fakes' steady tell with reduce flashing on).
    ...Object.fromEntries(TRUE_FORMS.map((rows, i) => [`bowser-ghost-${i + 1}`, outline(trueForm(rows))])),
  },
};
