import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { Bowser } from '@game/entities/enemies/bowser';
import { Projectile } from '@game/entities/projectiles/projectile';
import { px, toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { World } from '@game/world/world';

// Bowser's long-range flames: the `bowser-fire` zone (the original's bowserFireBallStart).

const W = 80;
/** A flat castle floor (rows 13-14), Bowser standing on it at `bowserCol`, the zone at `fireCol`. */
const castle = (opts: { fireCol?: number; bowser?: string | null } = {}): LevelData =>
  parseTextMap(
    [
      'id: t',
      'theme: castle',
      'time: 400',
      'start: 2,12',
      '',
      '[tiles]',
      ...Array.from({ length: 13 }, () => '.'.repeat(W)),
      '#'.repeat(W),
      '#'.repeat(W),
      '',
      '[entities]',
      ...(opts.bowser === null ? [] : [opts.bowser ?? 'bowser 70 12']),
      '',
      '[zones]',
      ...(opts.fireCol === undefined ? [] : [`bowser-fire ${opts.fireCol}`]),
    ].join('\n'),
  );
const none = { steps: [{ frame: 0, hold: [] as Action[] }] };

function place(w: World, col: number): void {
  const b = w.player.body;
  b.x = px(col * 16 + 2);
  b.y = px(13 * 16) - b.h;
  b.vy = 0;
  w.camera.snapTo(b.x);
}

interface Flame {
  id: number;
  /** Where it first appeared, relative to the screen's right edge (px), and its height (px). */
  fromRight: number;
  y: number;
  owner: unknown;
  xs: number[];
}

/** Run with a per-frame controller and record every Bowser flame. */
function watch(
  level: LevelData,
  frames: number,
  controller: (w: World, f: number) => Action[],
  assist: { invulnerable?: boolean } = { invulnerable: true },
) {
  const flames = new Map<number, Flame>();
  const firstFrame: number[] = [];
  const r = runSim({
    level,
    character: MARIO,
    script: none,
    maxFrames: frames,
    assist,
    controller: (w, f) => {
      for (const e of w.entities) {
        if (!(e instanceof Projectile) || e.kind !== 'bowser-flame' || !e.alive) continue;
        let fl = flames.get(e.id);
        if (!fl) {
          fl = {
            id: e.id,
            fromRight: toPx(e.body.x - w.camera.right),
            y: toPx(e.body.y),
            owner: e.owner,
            xs: [],
          };
          flames.set(e.id, fl);
          firstFrame.push(f);
        }
        fl.xs.push(toPx(e.body.x));
      }
      return controller(w, f);
    },
  });
  return { r, flames: [...flames.values()], firstFrame };
}

describe('Bowser fire zone', () => {
  it('sends nothing before the column', () => {
    const { flames } = watch(castle({ fireCol: 20 }), 600, (w, f) => {
      if (f === 0) place(w, 18);
      return [];
    });
    expect(flames).toEqual([]);
  });

  it('after the column, flames fly in from the right edge at his three heights and travel left', () => {
    const { flames, firstFrame } = watch(castle({ fireCol: 20 }), 1200, (w, f) => {
      if (f === 0) place(w, 18);
      if (f < 60) return [];
      // Walk past the column, then stand still.
      return toPx(w.player.body.x) < 22 * 16 ? ['right'] : [];
    });
    expect(flames.length).toBeGreaterThanOrEqual(4);
    // None before the walk.
    expect(Math.min(...firstFrame)).toBeGreaterThan(60);
    for (const fl of flames) {
      // Just past the right edge of the screen (the flame starts fully off screen).
      expect(fl.fromRight).toBeGreaterThanOrEqual(-2);
      expect(fl.fromRight).toBeLessThanOrEqual(2);
      // Centred on Bowser's feet row (12) or one or two rows above.
      expect([12 * 16 + 4, 11 * 16 + 4, 10 * 16 + 4]).toContain(fl.y);
      // Bowser is not spawned yet, so the flame has no owner.
      expect(fl.owner).toBeNull();
      // Travels left.
      expect(fl.xs[fl.xs.length - 1]!).toBeLessThan(fl.xs[0]! - 20);
    }
    // More than one height turns up.
    expect(new Set(flames.map((f) => f.y)).size).toBeGreaterThan(1);
    // The original's fire timer: 1.5-3.5 s between flames.
    for (let i = 1; i < firstFrame.length; i++) {
      expect(firstFrame[i]! - firstFrame[i - 1]!).toBeGreaterThanOrEqual(90);
      expect(firstFrame[i]! - firstFrame[i - 1]!).toBeLessThan(210 + 2);
    }
  });

  it('never has more than two flames on screen', () => {
    let most = 0;
    watch(castle({ fireCol: 20 }), 2000, (w, f) => {
      if (f === 0) place(w, 22);
      const n = w.entities.filter(
        (e) => e instanceof Projectile && e.kind === 'bowser-flame' && e.alive,
      ).length;
      most = Math.max(most, n);
      return [];
    });
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(2);
  });

  it('the flames hurt the player', () => {
    // Small Mario standing on the floor: the feet-row flames hit him.
    const { r } = watch(
      castle({ fireCol: 20 }),
      3000,
      (w, f) => {
        if (f === 0) place(w, 22);
        return [];
      },
      {},
    );
    expect(r.outcome).toBe('died');
  });

  it('stop once Bowser is on screen (his own attack takes over)', () => {
    // Flames come while he is off screen; at frame 400 the player is next to him, with the
    // screen showing all of his walk (no bridge here, so ±5 tiles around column 71).
    const { flames, firstFrame } = watch(castle({ fireCol: 20 }), 1200, (w, f) => {
      if (f === 0) place(w, 22);
      if (f === 400) place(w, 66);
      return [];
    });
    const before = flames.filter((_, i) => firstFrame[i]! < 400);
    const after = flames.filter((_, i) => firstFrame[i]! > 400);
    expect(before.length).toBeGreaterThan(0);
    // After that, only his own flames: from his mouth, on screen, owned by him.
    expect(after.length).toBeGreaterThan(0);
    for (const fl of after) {
      expect(fl.fromRight).toBeLessThan(-16);
      expect(fl.owner).toBeInstanceOf(Bowser);
    }
  });

  /** Meet Bowser, then (killed or not) go back to just past the column. */
  const meetAndLeave = (kill: boolean) =>
    watch(castle({ fireCol: 20 }), 1200, (w, f) => {
      if (f === 0) place(w, 62);
      if (f === 30 && kill) w.entities.find((e) => e instanceof Bowser)?.destroy();
      if (f === 31) place(w, 22);
      return [];
    }).firstFrame.filter((f) => f > 31);

  it('stop for good once Bowser is defeated', () => {
    expect(meetAndLeave(false).length).toBeGreaterThan(0);
    expect(meetAndLeave(true)).toEqual([]);
  });

  it('a hammer-throwing Bowser sends flames from off screen too', () => {
    const { flames } = watch(castle({ fireCol: 20, bowser: 'bowser 70 12 attack=hammer' }), 900, (w, f) => {
      if (f === 0) place(w, 22);
      return [];
    });
    expect(flames.length).toBeGreaterThan(0);
  });

  it('needs the zone and a real Bowser', () => {
    const stand = (w: World, f: number): Action[] => {
      if (f === 0) place(w, 22);
      return [];
    };
    expect(watch(castle(), 900, stand).flames).toEqual([]);
    expect(watch(castle({ fireCol: 20, bowser: null }), 900, stand).flames).toEqual([]);
    expect(watch(castle({ fireCol: 20, bowser: 'bowser 70 12 fake=1' }), 900, stand).flames).toEqual([]);
  });
});

const map = (dir: string, id: string): LevelData =>
  parseTextMap(
    readFileSync(join(import.meta.dirname, '../../src/content/levels', dir, `${id}.map`), 'utf8'),
    id,
  );

describe('Bowser fire in the castles', () => {
  it('SMB1 1-4: flames come in from column 92 on', () => {
    const { flames } = watch(map('world1', '1-4'), 900, (w, f) => {
      if (f === 0) place1_4(w);
      return [];
    });
    expect(flames.length).toBeGreaterThan(0);
    // Bowser stands on the bridge (row 9 is his feet row): the flames cross rows 7-9.
    for (const fl of flames) expect([9 * 16 + 4, 8 * 16 + 4, 7 * 16 + 4]).toContain(fl.y);
  });
});

/** 1-4 just past the zone column, standing on the floor before the bridge. */
function place1_4(w: World): void {
  const b = w.player.body;
  let floor = 0;
  for (let y = 0; y < 15; y++)
    if (w.map.get(95, y) !== 0) {
      floor = y;
      break;
    }
  b.x = px(95 * 16 + 2);
  b.y = px(floor * 16) - b.h;
  b.vy = 0;
  w.camera.snapTo(b.x);
}
