import { MapBuilder, overworldDecor } from './lib.mjs';
import { writeFileSync } from 'node:fs';

// World 1-1, transcribed from the public SMB1 level maps. Columns are 0-based tiles,
// rows 0-14 (13-14 = ground). Blocks sit at row 9 ("low") or row 5 ("high").
const W = 208;
const b = new MapBuilder(W, {
  id: '1-1',
  name: 'WORLD 1-1',
  world: 1,
  stage: 1,
  theme: 'overworld',
  music: 'overworld',
  time: 400,
  start: '2,12',
  startMode: 'stand',
  camera: 'scroll',
});

b.ground(0, 68);
b.ground(71, 85);
b.ground(89, 152);
b.ground(155, W - 1);

// Screen 1
b.set(16, 9, '?');
b.row(20, 9, '=M=?=');
b.set(22, 5, '?');
b.pipe(28, 2);
// Screen 2-3
b.pipe(38, 3);
b.pipe(46, 4);
b.pipe(57, 4);
// Screen 4: hidden 1-up, pit, powerup bricks
b.set(64, 9, '1');
b.row(77, 9, '=M=');
b.row(80, 5, '========');
// Screen 5-6: bricks over the 3-wide pit, star bricks, coin blocks
b.row(91, 5, '===?');
b.set(94, 9, '=');
b.row(100, 9, '=S');
b.set(106, 9, '?');
b.set(109, 9, '?');
b.set(109, 5, '?');
b.set(112, 9, '?');
// Screen 7-8
b.row(118, 9, '==');
b.row(121, 5, '===');
b.row(128, 5, '=??=');
b.row(129, 9, '==');
b.stairUp(134, 4);
b.stairDown(140, 4);
// Screen 9: stairs around the last pit
b.stairUp(148, 4);
b.column(152, 4);
b.column(155, 4);
b.stairDown(156, 3);
// Screen 10-11
b.pipe(163, 2);
b.row(168, 9, '==?=');
b.pipe(179, 2);
b.stairUp(181, 8);
b.column(189, 8);
b.flagpole(198);

// Enemies (16 Goombas, 1 Koopa)
for (const x of [22, 40, 51, 53, 80, 82, 97, 99, 114, 116, 124, 126, 128, 174, 176]) b.set(x, 12, 'g');
b.set(107, 12, 'k');
b.set(129, 12, 'g');

b.entity('decor-castle', 202, 12);
b.zone('pipe 57 9 down -> 1-1-bonus 1,1 exit=none');
b.zone('checkpoint 86');
b.zone('exit 198 next=1-2');
b.zone('scrollStop 208');
overworldDecor(b, W);

writeFileSync(new URL('../../src/content/levels/world1/1-1.map', import.meta.url), b.toString());
console.log('wrote 1-1.map');
