import type { SpriteDef } from '@engine/gfx/pixelart';

/*
 * THE ONE NAMED EXCEPTION to the project's original-art rule (owner decision, 0.5.0 batch 4; see
 * docs/ART_EXCEPTIONS.md): the Exploding Rabbit logo, the original game's full power-up
 * (pickups/ExplodingRabbitPowerup.as), as its SMB map skin draws it (GraphicsManager
 * MapInfo.ExplodingRabbitPowerup: ar(324,194,67,16) of BmdInfo_Map000), pixel for pixel and in
 * its colours, written out as text. Exploding Rabbit logo (c) Jay Pavlina / Exploding Rabbit,
 * used as a tribute in Classic mode; it will be replaced on request. Classic mode only: under
 * Campaign rules the item keeps our own drawing (the Fire Flower's). Not a precedent: no other
 * original asset is taken.
 *
 * Four frames, its explosion cycling red, orange, yellow and white on ANIM_MODERATE_TMR (75 ms).
 */
export const rabbitLogoPalettes: Record<string, string[]> = {
  'rabbit-logo': [
    '#d82800', // 0 red
    '#000000', // 1 black
    '#6f3198', // 2 (the sheet's cell divider; unused)
    '#fc9838', // 3 orange
    '#fce4a0', // 4 pale yellow
    '#fcfcfc', // 5 white
    '#747474', // 6 grey
    '#fcc4d8', // 7 pink
  ],
};

export const rabbitLogoDef: SpriteDef = {
  palette: 'rabbit-logo',
  frames: {
    'rabbit-0': [
      '011....00.11..00',
      '1661..0331661030',
      '1676103316761330',
      '.167111117614430',
      '.01116661114430.',
      '..015565514430..',
      '..1615651614430.',
      '.016556556111330',
      '031666766616610.',
      '.03165556166661.',
      '..03111116666661',
      '.034416661666661',
      '0344161616161661',
      '0333161161111161',
      '0300.10310.16161',
      '00.....00...1.10',
    ],
    'rabbit-1': [
      '311....33.11..33',
      '1661..3441661343',
      '1676134416761443',
      '.167111117615543',
      '.31116661115543.',
      '..315565515543..',
      '..1615651615543.',
      '.316556556111443',
      '341666766616613.',
      '.34165556166661.',
      '..34111116666661',
      '.345516661666661',
      '3455161616161661',
      '3444161161111161',
      '3433.13413.16161',
      '33.....33...1.13',
    ],
    'rabbit-2': [
      '411....44.11..44',
      '1661..4551661454',
      '1676145516761554',
      '.167111117610054',
      '.41116661110054.',
      '..415565510054..',
      '..1615651610054.',
      '.416556556111554',
      '451666766616614.',
      '.45165556166661.',
      '..45111116666661',
      '.450016661666661',
      '4500161616161661',
      '4555161161111161',
      '4544.14514.16161',
      '44.....44...1.14',
    ],
    'rabbit-3': [
      '511....55.11..55',
      '1661..5001661505',
      '1676150016761005',
      '.167111117613305',
      '.51116661113305.',
      '..515565513305..',
      '..1615651613305.',
      '.516556556111005',
      '501666766616615.',
      '.50165556166661.',
      '..50111116666661',
      '.503316661666661',
      '5033161616161661',
      '5000161161111161',
      '5055.15015.16161',
      '55.....55...1.15',
    ],
  },
};
