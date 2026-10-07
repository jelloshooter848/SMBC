import { describe, expect, it } from 'vitest';
import { replay } from './sophia-reach';

/*
 * Routes the completability search (sophia-reach.ts, sophia-sweep.test.ts) found through the
 * hardest Chapter 1 levels, played again on every run: the tank, Jason and the nose-first drop
 * must keep getting Sophia III through them. A failing replay names the step that went wrong.
 * To refresh a route after a deliberate physics change, run the sweep for that level and paste
 * the path it prints.
 */

const ROUTES: [string, string, string][] = [
  // Normal: the maze, nose first down its one-tile drops.
  [
    '4-4',
    'small',
    'enter 4-4 | tank@0,6 run-right | tank@6,9 jump-right | tank@13,9 jump-right | tank@18,5 edge-right | tank@27,5 run-right | tank@31,5 run-right | tank@35,5 edge-right | tank@49,5 edge-right | tank@128,5 edge-right | tank@140,9 long-right | tank@150,12 edge-right | tank@153,9 long-right | tank@156,9 jump-right | tank@158,6 hop-right | tank@162,5 edge-right | tank@166,5 edge-right | tank@172,5 edge-right | tank@176,5 edge-right | tank@190,5 edge-right | tank@205,5 edge-right | tank@214,12 edge-right | tank@217,9 long-right | tank@220,9 jump-right | tank@222,6 hop-right | tank@226,5 edge-right | tank@230,5 edge-right | tank@236,5 jump-right | tank@239,5 long-left | tank@234,5 down-left | tank@232,9 long-left | tank@227,9 wait40-down-left | tank@223,12 edge-right | tank@237,12 edge-right | tank@251,12 edge-right | tank@264,12 edge-right | tank@281,9 long-right | tank@290,9 edge-right',
  ],
  // Normal: the maze (its loops).
  [
    '7-4',
    'small',
    'enter 7-4 | tank@1,6 run-right | tank@7,9 edge-right ride-drive16-right | tank@30,9 long-right | tank@36,6 hop-right | tank@40,5 edge-right | tank@54,9 edge-right | tank@70,5 edge-right | tank@85,5 edge-right | tank@96,12 edge-right | tank@111,12 long-right | tank@118,9 edge-right | tank@134,5 edge-right | tank@149,5 edge-right | tank@162,12 hop-right | tank@167,12 jump-right | tank@174,12 edge-right | tank@190,9 edge-right | tank@198,9 jump-right | tank@201,5 edge-right | tank@216,5 walk-right | tank@220,9 long-right | tank@227,5 run-right | tank@231,5 run-right | tank@235,5 edge-right | tank@247,5 jump-right | tank@251,12 walk-right | tank@252,12 jump-left | tank@250,12 jump-right | tank@254,9 edge-right | tank@262,9 jump-right | tank@265,5 edge-right | tank@280,5 walk-right | tank@284,9 edge-right | tank@294,12 jump-right | tank@298,9 edge-right | tank@310,9 edge-right | tank@318,9 edge-right',
  ],
  // Hyper: the hanging pipe at 163 is out of the tank's reach at Normal.
  [
    '8-4',
    'big',
    'enter 8-4 | tank@1,6 hover-right | tank@23,12 hover-right | tank@44,12 hover-right | tank@64,9 hover-right | tank@84,9 edge-runup-left | tank@82,7 pipe | enter 8-4 | tank@126,10 hover-right | tank@147,12 hover-right | tank@168,12 hover-left | tank@163,5 pipe | enter 8-4 | tank@206,10 hover-right | tank@226,9 hover-right | tank@246,9 hover-right | tank@266,9 hover-right | tank@285,9 hover-right | tank@303,7 pipe | enter 8-4-water | tank@3,10 swim-3-240-right | tank@20,7 swim-3-240-right | tank@36,4 far-right | tank@57,12 edge-right | tank@67,8 jump-right | enter 8-4-end | tank@3,10 long-right | tank@12,12 edge-right | tank@26,9 hover-right',
  ],
  // Crusher: up the wall past the one-tile shaft, nose first down the next.
  [
    'll-2-4',
    'fire',
    'enter ll-2-4 | tank@0,6 climb-right | tank@21,5 run-right | tank@23,5 down-right | tank@24,12 climb-right | tank@49,12 hover-right | tank@66,8 climb-right | tank@91,8 climb-right | tank@101,12 jump-right | tank@105,8 run-right | tank@110,12 hover-right | tank@127,9 edge-right',
  ],
  // Normal: nose first down a shaft onto the moving lift over lava.
  [
    'll-12-4',
    'small',
    'enter ll-12-4 | tank@0,6 edge-right | tank@8,7 edge-right | tank@15,4 edge-right | tank@28,4 wait90-down-right ride150-right | tank@34,12 run-right | tank@38,12 run-right | tank@42,12 walk-right | tank@44,12 jump-right ride1-right | tank@71,12 run-right | tank@75,12 edge-right | tank@82,12 jump-left | tank@80,9 jump-right | tank@82,5 edge-right | tank@94,5 run-right | tank@98,5 run-right | tank@102,5 run-right | tank@106,5 edge-right | tank@120,5 edge-right | tank@134,12 edge-right | tank@147,9 jump-right | tank@149,5 long-right | tank@154,7 run-right | tank@157,8 jump-right | tank@162,9 jump-right | tank@167,5 run-right | tank@169,8 long-right | tank@175,5 jump-right | tank@180,9 edge-right | tank@189,9 edge-right | tank@202,12 jump-right | tank@208,9 edge-right | tank@225,9 edge-right',
  ],
];

describe('Sophia III: found routes through the hardest levels still work', () => {
  it.each(ROUTES)('%s as %s', (id, power, path) => {
    const r = replay(id, power, path.split(' | '));
    expect(r.done ? 'done' : `stuck at ${r.at}`).toBe('done');
  });
});
