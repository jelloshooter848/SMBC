import { MapBuilder, overworldDecor } from './lib.mjs';
import { writeFileSync } from 'node:fs';

const out = (name, b) => {
  writeFileSync(new URL(`../../src/content/levels/world1/${name}.map`, import.meta.url), b.toString());
  console.log(`wrote ${name}.map`);
};

/* ---------------- 1-1 bonus coin room (one locked screen) ---------------- */
{
  const b = new MapBuilder(16, {
    id: '1-1-bonus',
    name: 'WORLD 1-1',
    world: 1,
    stage: 1,
    theme: 'underground',
    music: 'underground',
    time: 'inherit',
    start: '1,0',
    startMode: 'fall',
    camera: 'locked',
    parent: '1-1',
  });
  b.ground(0, 15);
  b.fill(0, 1, 0, 12, '=');
  b.fill(3, 1, 15, 1, '=');
  b.row(4, 10, '=======');
  b.row(4, 9, '$$$$$$$');
  b.row(4, 11, '$$$$$$');
  b.row(4, 12, '$$$$$$');
  // Exit: horizontal pipe at the right with a vertical shaft up into the ceiling.
  b.set(13, 11, '(');
  b.set(13, 12, '<');
  b.row(14, 11, '))');
  b.row(14, 12, '>>');
  b.fill(14, 2, 14, 10, '{');
  b.fill(15, 2, 15, 10, '}');
  b.zone('pipe 13 11 right -> 1-1 163 10 exit=up');
  out('1-1-bonus', b);
}

/* ---------------- 1-2 intro: walk into the pipe ---------------- */
{
  const b = new MapBuilder(32, {
    id: '1-2-intro',
    name: 'WORLD 1-2',
    world: 1,
    stage: 2,
    theme: 'overworld',
    music: 'overworld',
    time: 400,
    start: '2,12',
    startMode: 'autowalk',
    camera: 'locked',
  });
  b.ground(0, 31);
  b.pipe(10, 2);
  b.zone('pipe 10 11 down -> 1-2 2 12');
  b.entity('decor-castle', 0, 12);
  b.dec('cloud-2', 18, 3);
  b.dec('bush-2', 20, 12);
  out('1-2-intro', b);
}

/* ---------------- 1-2 underground ---------------- */
{
  const W = 176;
  const b = new MapBuilder(W, {
    id: '1-2',
    name: 'WORLD 1-2',
    world: 1,
    stage: 2,
    theme: 'underground',
    music: 'underground',
    time: 'inherit',
    start: '2,12',
    startMode: 'stand',
    camera: 'scroll',
    parent: '1-2-intro',
  });
  // Ceiling of bricks across the whole level (rows 1-2) with a gap at the very start for the drop-in.
  b.fill(4, 1, W - 1, 2, '=');
  b.fill(0, 1, 3, 2, '.');
  // Floor with pits.
  b.ground(0, 85);
  b.ground(89, 108);
  b.ground(123, 135);
  b.ground(139, W - 1);
  // Start: 5 ? blocks, middle one holds the power-up.
  b.row(8, 9, '??M??');
  for (const x of [13, 15]) b.set(x, 12, 'g');
  // Brick cluster to climb; coins on top.
  b.row(18, 9, '====');
  b.fill(24, 9, 24, 12, '=');
  b.fill(28, 7, 31, 7, '=');
  b.row(28, 6, '$$$$');
  b.set(26, 12, 'k');
  // Mid section: 10-coin brick, star brick, pipes with piranhas.
  b.row(36, 9, '=C==');
  b.set(42, 12, 'g');
  b.set(44, 12, 'g');
  b.pipe(48, 2);
  b.entity('piranha', 48, 11);
  b.row(54, 9, '==S=');
  b.pipe(58, 3);
  b.entity('piranha', 58, 10);
  b.row(63, 5, '=====');
  b.row(63, 4, '$$$$$');
  for (const x of [66, 68, 70]) b.set(x, 12, 'g');
  // Brick wall with a low gap you crouch-slide / jump over, then pit 1 (86-88).
  b.fill(76, 9, 76, 12, '=');
  b.fill(79, 1, 79, 9, '=');
  b.row(81, 9, '=M');
  // After pit 1: koopas and the pipe to the bonus coin room.
  b.set(92, 12, 'k');
  b.set(95, 12, 'k');
  b.pipe(100, 3);
  b.zone('pipe 100 10 down -> 1-2-bonus 1 2');
  b.row(104, 9, '====');
  // Pit 2 (109-122) crossed on lifts.
  b.entity('lift-up', 112, 8, { len: 3 });
  b.entity('lift-down', 118, 4, { len: 3 });
  // Platforms and coins over pit 3 (136-138).
  b.row(126, 9, '=?=');
  b.set(130, 12, 'g');
  b.set(132, 12, 'g');
  b.entity('lift-h', 136, 8, { len: 3, range: 2 });
  // End: the exit pipe and the ceiling run to the warp zone above it.
  b.row(142, 9, '====');
  b.fill(146, 3, 146, 9, '=');
  b.row(148, 8, '===');
  b.fill(152, 1, 152, 2, '.'); // hole in the ceiling leading up (reach via the bricks)
  b.fill(153, 1, 153, 2, '.');
  b.fill(147, 2, 151, 2, '.');
  b.fill(148, 1, 151, 1, '.');
  b.pipe(158, 4);
  b.zone('pipe 158 9 down -> 1-2-exit 2 10 exit=up');
  // Wall after the pipe so the lower route ends here.
  b.fill(162, 3, 162, 12, '=');
  // Warp zone on the ceiling: three pipes.
  b.fill(147, 0, W - 1, 0, '.');
  b.fill(163, 1, W - 1, 2, '.');
  b.fill(163, 3, W - 1, 3, '='); // ceiling floor
  b.pipe(165, 2, 3);
  b.pipe(169, 2, 3);
  b.pipe(173, 2, 3);
  b.zone('warp 163 13 worlds=4,3,2 text=WELCOME_TO_WARP_ZONE!');
  b.zone('pipe 165 1 down -> 4-1 2 12');
  b.zone('pipe 169 1 down -> 3-1 2 12');
  b.zone('pipe 173 1 down -> 2-1 2 12');
  b.zone('checkpoint 90');
  b.zone('scrollStop 176');
  out('1-2', b);
}

/* ---------------- 1-2 bonus coin room ---------------- */
{
  const b = new MapBuilder(16, {
    id: '1-2-bonus',
    name: 'WORLD 1-2',
    world: 1,
    stage: 2,
    theme: 'underground',
    music: 'underground',
    time: 'inherit',
    start: '1,0',
    startMode: 'fall',
    camera: 'locked',
    parent: '1-2',
  });
  b.ground(0, 15);
  b.fill(0, 1, 0, 12, '=');
  b.fill(3, 1, 15, 1, '=');
  b.row(3, 10, '=====');
  b.row(3, 9, '$$$$$');
  b.row(9, 8, '====');
  b.row(9, 7, '$$$$');
  b.row(3, 12, '$$$$$$$$$');
  b.set(13, 11, '(');
  b.set(13, 12, '<');
  b.row(14, 11, '))');
  b.row(14, 12, '>>');
  b.fill(14, 2, 14, 10, '{');
  b.fill(15, 2, 15, 10, '}');
  b.zone('pipe 13 11 right -> 1-2 158 8 exit=up');
  out('1-2-bonus', b);
}

/* ---------------- 1-2 exit: outdoors to the flag ---------------- */
{
  const W = 48;
  const b = new MapBuilder(W, {
    id: '1-2-exit',
    name: 'WORLD 1-2',
    world: 1,
    stage: 2,
    theme: 'overworld',
    music: 'overworld',
    time: 'inherit',
    start: '2,10',
    startMode: 'pipe-exit',
    camera: 'scroll',
    parent: '1-2',
  });
  b.ground(0, W - 1);
  b.pipe(2, 2);
  b.stairUp(12, 8);
  b.column(20, 8);
  b.flagpole(29);
  b.entity('decor-castle', 33, 12);
  b.zone('exit 29 next=1-3');
  b.zone('scrollStop 40');
  overworldDecor(b, W);
  out('1-2-exit', b);
}

/* ---------------- 1-3 treetops ---------------- */
{
  const W = 176;
  const b = new MapBuilder(W, {
    id: '1-3',
    name: 'WORLD 1-3',
    world: 1,
    stage: 3,
    theme: 'overworld',
    music: 'overworld',
    time: 300,
    start: '2,8',
    startMode: 'stand',
    camera: 'scroll',
  });
  // Trees: top row of 'T' with 't' trunks down to the ground row. Ground only at the start and end.
  const tree = (x, w, top) => {
    b.fill(x, top, x + w - 1, top, 'T');
    for (let y = top + 1; y <= 14; y++) b.set(x + ((w - 1) >> 1), y, 't');
  };
  b.ground(0, 15);
  tree(0, 5, 9);
  tree(8, 3, 11);
  tree(14, 3, 7);
  tree(20, 4, 10);
  tree(26, 3, 7);
  b.row(26, 4, '$$$');
  tree(31, 3, 11);
  tree(36, 6, 8);
  b.set(38, 7, 'k');
  tree(44, 2, 5);
  tree(49, 5, 9);
  b.set(51, 8, 'g');
  b.set(52, 8, 'g');
  tree(57, 3, 6);
  b.row(57, 3, '$$$');
  tree(63, 3, 10);
  tree(68, 3, 12);
  tree(73, 4, 8);
  b.set(75, 7, 'k');
  tree(80, 3, 5);
  b.row(80, 2, '$$$');
  // Lifts over a wide gap.
  b.entity('lift-h', 86, 7, { len: 3, range: 3 });
  tree(94, 4, 9);
  b.set(96, 8, 'K');
  b.entity('lift-fall', 101, 6, { len: 3 });
  b.entity('lift-fall', 106, 9, { len: 3 });
  tree(112, 5, 10);
  b.set(114, 9, 'g');
  b.set(115, 9, 'g');
  tree(120, 3, 6);
  b.row(120, 3, '$$$');
  tree(126, 3, 9);
  b.set(127, 8, 'K');
  tree(132, 2, 5);
  b.entity('lift-v', 137, 4, { len: 3, range: 6 });
  tree(143, 6, 11);
  b.set(146, 10, 'k');
  // Final hill: ground returns, stair to the flag.
  b.ground(150, W - 1);
  b.stairUp(152, 8);
  b.column(160, 8);
  b.flagpole(167);
  b.entity('decor-castle', 171, 12);
  b.zone('checkpoint 94');
  b.zone('exit 167 next=1-4');
  b.zone('scrollStop 176');
  for (let x = 2; x < W; x += 40) {
    b.dec('hill-big', x, 12);
    b.dec('cloud-1', x + 12, 2);
    b.dec('cloud-2', x + 28, 4);
  }
  out('1-3', b);
}

/* ---------------- 1-4 castle ---------------- */
{
  const W = 160;
  const b = new MapBuilder(W, {
    id: '1-4',
    name: 'WORLD 1-4',
    world: 1,
    stage: 4,
    theme: 'castle',
    music: 'castle',
    time: 300,
    start: '2,12',
    startMode: 'stand',
    camera: 'scroll',
  });
  // Ceiling and floor of castle brick.
  b.fill(0, 1, W - 1, 2, '%');
  b.ground(0, 23, '%');
  // Entry hall with a power-up block and the first fire bar.
  b.set(12, 9, 'M');
  b.set(16, 9, 'B');
  b.entity('firebar', 16, 9);
  // Lava pit with stepping blocks.
  b.fill(24, 13, 29, 14, '~');
  b.fill(26, 10, 27, 10, '%');
  b.ground(30, 55, '%');
  b.set(36, 9, 'B');
  b.entity('firebar-ccw', 36, 9);
  b.row(42, 9, '%%%');
  b.set(48, 6, 'B');
  b.entity('firebar', 48, 6);
  // Lava corridor: floor of lava with raised platforms.
  b.fill(56, 13, 79, 14, '~');
  b.fill(58, 10, 61, 10, '%');
  b.fill(65, 8, 67, 8, '%');
  b.fill(71, 10, 75, 10, '%');
  b.set(73, 7, 'B');
  b.entity('firebar-ccw', 73, 7);
  b.ground(80, 103, '%');
  // Low ceiling section with fire bars above and below.
  b.fill(84, 3, 95, 6, '%');
  b.set(88, 9, 'B');
  b.entity('firebar', 88, 9);
  b.fill(96, 9, 99, 12, '%');
  // Approach to the boss.
  b.fill(104, 13, 109, 14, '~');
  b.ground(110, 127, '%');
  b.set(118, 9, 'B');
  b.entity('firebar', 118, 9);
  b.set(124, 9, 'M');
  // Bridge over lava, Bowser near the end, axe behind it.
  b.fill(128, 13, 143, 14, '~');
  b.fill(128, 10, 140, 10, '-');
  b.fill(128, 9, 140, 9, '.');
  b.set(141, 9, ':');
  b.fill(141, 10, 141, 10, '%');
  b.entity('bowser', 137, 9);
  b.entity('axe', 142, 9);
  b.fill(141, 11, 143, 12, '%');
  b.ground(144, W - 1, '%');
  b.fill(144, 10, W - 1, 12, '%');
  b.fill(144, 1, W - 1, 2, '%');
  b.zone('exit 150 next=2-1');
  b.zone('scrollStop 160');
  out('1-4', b);
}
