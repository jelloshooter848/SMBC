import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { runSim } from '@game/sim/headless';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { RYU } from '@game/characters/ryu';
import { SAMUS } from '@game/characters/samus';
import { carryTime, LevelScene } from '@game/scenes/level';
import { WorldMapScene } from '@game/scenes/world-map';
import { campaignLevel } from '@game/level/campaign';
import { parseTextMap, serializeTextMap } from '@game/level/textmap';
import { isSolid, T, tileDef } from '@game/level/tiles';
import { px, toPx } from '@engine/math/units';
import type { World } from '@game/world/world';
import type { Action } from '@engine/input/actions';
import type { LevelData, Zone } from '@game/level/schema';
import { TRICK_HOLD_FRAMES, TRICK_PUSH_FRAMES, TRICK_SPIN_FRAMES } from '@game/entities/objects/trick-wall';
import { captiveDialogue, CARD_COLS } from '@game/scenes/free-hero';
import { fontText } from '@game/hud/text';
import { hiddenHeroes, hiddenHeroesAt } from '@game/map/captives';
import type { MiniGameDef } from '@game/minigames';
import { captives, file, makeGame, useStorage, type H } from './heroes-harness';

// Ryu's trick wall and dojo (owner design, 0.4.8): in campaign play, pushing for about a second
// into the panel marked with a shuriken in the left wall of 6-2's first bonus room (6-2-bonus)
// spins it and flips the player through into Ryu's hideout (6-2-dojo); the same kind of panel in
// the dojo's right wall flips him back into the bonus room. The clock runs on; nothing is recorded.

useStorage();

const none = { steps: [{ frame: 0, hold: [] as Action[] }] };
const bonus = () => getLevel('6-2-bonus');
const campBonus = () => campaignLevel(bonus());
const dojo = () => getLevel('6-2-dojo');
const INTO_DOJO = { level: '6-2-dojo', x: 14, y: 12, exitDir: 'spin' };
const BACK_TO_BONUS = { level: '6-2-bonus', x: 1, y: 12, exitDir: 'spin' };
const OUT_TO_6_2 = { level: '6-2', x: 35, y: 10, exitDir: 'up' };
/** The bonus room's panel: column 0, rows 10-12. The dojo's: column 15, rows 10-12. */
const PANEL = { x: 0, rows: [10, 11, 12] };
const DOJO_PANEL = { x: 15, rows: [10, 11, 12] };
const RYU_AT = { x: 5, y: 12 };
/** Every spin, from the push's last frame to the transfer. */
const SPIN_OUT = TRICK_SPIN_FRAMES + TRICK_HOLD_FRAMES;

const tile = (l: { tiles: Uint16Array; width: number }, x: number, y: number) => l.tiles[y * l.width + x];
const tricks = (zones: Zone[]) => zones.filter((z): z is Zone & { kind: 'trick' } => z.kind === 'trick');
/** Whether `b` overlaps a solid tile of `w`. */
const inWall = (w: World, b: { x: number; y: number; w: number; h: number }) => {
  for (let ty = toPx(b.y) >> 4; ty <= (toPx(b.y + b.h) - 1) >> 4; ty++)
    for (let tx = toPx(b.x) >> 4; tx <= (toPx(b.x + b.w) - 1) >> 4; tx++)
      if (w.map.isSolid(tx, ty)) return true;
  return false;
};

/** Stand beside the bonus room's panel and push left into it. */
function pushLeft(level: LevelData, c = MARIO, extra: Parameters<typeof runSim>[0]['state'] = {}) {
  return runSim({
    level,
    character: c,
    state: extra,
    script: none,
    start: { x: 3, y: 12, mode: 'stand', time: 250 },
    maxFrames: 400,
    controller: () => ['left'],
  });
}

describe('the areas', () => {
  it("6-2-bonus: a sleeping trick zone on the left wall's panel (column 0, rows 10-12); the campaign wakes it", () => {
    const raw = bonus();
    expect(tricks(raw.zones)).toEqual([
      { kind: 'trick', x: 0, y: 10, h: 3, target: { level: '6-2-dojo', x: 14, y: 12 }, campaign: true },
    ]);
    for (const y of PANEL.rows) expect(tile(raw, PANEL.x, y)).toBe(T.TRICK);
    // The rest of the left wall is brick, as before.
    for (let y = 2; y < 10; y++) expect(tile(raw, PANEL.x, y)).toBe(T.BRICK);
    const camp = campaignLevel(raw, () => true);
    expect(tricks(camp.zones)).toEqual([
      { kind: 'trick', x: 0, y: 10, h: 3, target: { level: '6-2-dojo', x: 14, y: 12 } },
    ]);
    expect(camp.tiles).toEqual(raw.tiles);
    expect(camp.entities).toEqual(raw.entities);
  });

  it('a coin arrow points at the panel: its tip (2, 11) level with the panel’s middle row', () => {
    const l = bonus();
    for (const [x, y] of [
      [2, 11],
      [3, 10],
      [3, 11],
      [3, 12],
      [4, 11],
      [5, 11],
    ] as const)
      expect(tile(l, x, y), `${x},${y}`).toBe(T.COIN);
    expect(tile(l, 1, 11)).toBe(T.AIR);
  });

  it('the trick zone parses and writes back the same', () => {
    const src = [
      'id: t',
      'name: T',
      'world: 1',
      'stage: 1',
      'theme: castle',
      'time: 300',
      'start: 1,1',
      '[tiles]',
      ...Array.from({ length: 15 }, () => '................'),
      '[zones]',
      'trick 0 10 3 -> t-dojo 14 12 campaign',
      'trick 15 9 2 -> t 1 12',
    ].join('\n');
    const l = parseTextMap(src);
    expect(tricks(l.zones)).toEqual([
      { kind: 'trick', x: 0, y: 10, h: 3, target: { level: 't-dojo', x: 14, y: 12 }, campaign: true },
      { kind: 'trick', x: 15, y: 9, h: 2, target: { level: 't', x: 1, y: 12 } },
    ]);
    expect(tricks(parseTextMap(serializeTextMap(l)).zones)).toEqual(tricks(l.zones));
  });

  it('the panel tile is a solid wall that no bump or blast breaks, written `N`', () => {
    expect(isSolid(T.TRICK)).toBe(true);
    expect(tileDef(T.TRICK).block).toBeUndefined();
    const w = runSim({
      level: campBonus(),
      character: MARIO,
      state: { powerState: 'big' },
      script: none,
      start: { x: 3, y: 12, mode: 'stand' },
      maxFrames: 2,
    }).world;
    w.strikeBlock(PANEL.x, 12, w.player, true);
    w.explode(px(8), px(11 * 16 + 8), 24, null, { hurtsPlayers: false });
    for (const y of PANEL.rows) expect(w.map.get(PANEL.x, y)).toBe(T.TRICK);
  });

  it('the dojo is an area of 6-2 that keeps the clock, entered by a spin beside its own panel', () => {
    const l = dojo();
    expect(l.parent).toBe('6-2');
    expect(l.time).toBeNull();
    expect([l.world, l.stage]).toEqual([6, 2]);
    expect(l.camera).toBe('locked');
    expect(l.startMode).toBe('spin');
    expect(l.start).toEqual({ x: 14, y: 12 });
    expect(l.width).toBe(16);
    for (const y of DOJO_PANEL.rows) expect(tile(l, DOJO_PANEL.x, y)).toBe(T.TRICK);
    // Always awake: the way back works whoever got in.
    expect(tricks(l.zones)).toEqual([
      { kind: 'trick', x: 15, y: 10, h: 3, target: { level: '6-2-bonus', x: 1, y: 12 } },
    ]);
    expect(l.zones.filter((z) => z.kind !== 'trick')).toEqual([]);
    expect(l.entities).toContainEqual({ type: 'captive', x: RYU_AT.x, y: RYU_AT.y, props: { hero: 'ryu' } });
    expect(isSolid(tile(l, RYU_AT.x, RYU_AT.y + 1) as number)).toBe(true);
    expect(carryTime(getLevel('6-2'), bonus(), 250)).toBe(250);
    expect(carryTime(bonus(), l, 240)).toBe(240);
    expect(carryTime(l, bonus(), 230)).toBe(230);
  });

  it.each(['6-2-dojo', '6-2-bonus'])('%s keeps rows 0-1 clear under the HUD: no tiles', (id) => {
    const l = getLevel(id);
    for (let y = 0; y < 2; y++)
      for (let x = 0; x < l.width; x++) expect(tile(l, x, y), `${id} ${x},${y}`).toBe(T.AIR);
  });

  it('the dojo stays closed: a solid ceiling on row 2, walls either side, a solid floor', () => {
    const l = dojo();
    for (let x = 0; x < 16; x++) expect(isSolid(tile(l, x, 2) as number), `ceiling ${x}`).toBe(true);
    for (let y = 2; y < 13; y++) {
      expect(isSolid(tile(l, 0, y) as number), `left ${y}`).toBe(true);
      expect(isSolid(tile(l, 15, y) as number), `right ${y}`).toBe(true);
    }
    for (let x = 0; x < 16; x++) expect(isSolid(tile(l, x, 13) as number), `floor ${x}`).toBe(true);
  });
});

describe('pushing into the panel (campaign)', () => {
  it.each(
    CHARACTERS.flatMap((c) => (['small', 'big'] as const).map((p) => [`${c.name} (${p})`, c, p] as const)),
  )('%s walks into it and keeps pushing: the panel spins him through into the dojo', (_n, c, power) => {
    let spunAt = -1;
    const r = runSim({
      level: campBonus(),
      character: c,
      state: { powerState: power },
      script: none,
      start: { x: 3, y: 12, mode: 'stand', time: 250 },
      maxFrames: 400,
      controller: (w, f) => {
        if (spunAt < 0 && w.spinning) spunAt = f;
        return ['left'];
      },
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({ type: 'pipe', target: INTO_DOJO });
    // About a second of pushing (after the walk to the wall), then the half turn.
    expect(spunAt).toBeGreaterThanOrEqual(TRICK_PUSH_FRAMES);
    expect(r.frames - spunAt).toBeLessThanOrEqual(SPIN_OUT + 1);
    expect(r.world.player.dead).toBe(false);
    expect(r.world.player.hidden).toBe(true);
  });

  it('it takes TRICK_PUSH_FRAMES (60) of pushing without letting go; a short push, or taps, do nothing', () => {
    const run = (held: (f: number) => boolean) => {
      // Pressed against the panel from the first frame.
      const r = runSim({
        level: campBonus(),
        character: MARIO,
        script: none,
        start: { x: 1, y: 12, mode: 'stand', time: 250 },
        maxFrames: 300,
        controller: (w, f) => {
          if (f === 0) w.player.body.x = px(16);
          return held(f) ? ['left'] : [];
        },
        until: (w) => w.spinning,
      });
      return r;
    };
    expect(run((f) => f < TRICK_PUSH_FRAMES).outcome).toBe('stopped');
    expect(run((f) => f < TRICK_PUSH_FRAMES - 1).outcome).toBe('timeout');
    // Taps: 40 frames on, 5 off, again and again.
    expect(run((f) => f % 45 < 40).outcome).toBe('timeout');
  });

  it('pushing the wall above the panel does nothing', () => {
    const r = runSim({
      level: campBonus(),
      character: RYU,
      script: none,
      start: { x: 1, y: 12, mode: 'stand', time: 250 },
      maxFrames: 300,
      controller: (w) => {
        // Hold Ryu clinging to the wall at row 6, well above the panel.
        const b = w.player.body;
        b.x = px(16);
        b.y = px(6 * 16);
        b.vy = 0;
        return ['left'];
      },
    });
    expect(r.outcome).toBe('timeout');
    expect(r.world.spinning).toBe(false);
  });

  it('Ryu jumping into it clings to the panel, and his cling pushes it round', () => {
    let clung = false;
    let hopped = false;
    let atSpin: { clinging: boolean; onGround: boolean } | null = null;
    const r = runSim({
      level: campBonus(),
      character: RYU,
      script: none,
      start: { x: 3, y: 12, mode: 'stand', time: 250 },
      maxFrames: 400,
      controller: (w, f) => {
        const p = w.player;
        if (p.clinging) clung = true;
        if (!atSpin && w.spinning) atSpin = { clinging: p.clinging, onGround: p.body.onGround };
        // Walk up to the wall, hop, and hold toward it.
        const b = p.body;
        if (!hopped && b.onGround && toPx(b.x) === 16 && f > 2) {
          hopped = true;
          return ['left', 'jump'];
        }
        return ['left'];
      },
    });
    expect(clung).toBe(true);
    expect(atSpin).toEqual({ clinging: true, onGround: false });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({ type: 'pipe', target: INTO_DOJO });
  });

  it('Samus rolled up in her morph ball pushes it round too', () => {
    let ball = -1;
    let curled = false;
    const r = runSim({
      level: campBonus(),
      character: SAMUS,
      script: none,
      start: { x: 3, y: 12, mode: 'stand', time: 250 },
      maxFrames: 400,
      controller: (w, f) => {
        if (ball < 0 && w.spinning) ball = w.player.scratch.ball ?? 0;
        // Curl up once on the ground, then roll into the wall.
        if (!curled) {
          curled = f > 2 && w.player.body.onGround;
          return curled ? ['down'] : [];
        }
        return ['left'];
      },
    });
    expect(ball).toBe(1);
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({ type: 'pipe', target: INTO_DOJO });
  });

  it('outside the campaign the panel is a plain wall: no mark, no spin', () => {
    const r = pushLeft(bonus());
    expect(r.outcome).toBe('timeout');
    expect(r.world.spinning).toBe(false);
    expect(r.world.trickWalls.map((w) => w.live)).toEqual([false]);
    expect(pushLeft(campBonus()).world.trickWalls.map((w) => w.live)).toEqual([true]);
  });

  it('the half turn: the pusher stays in view until the panel is edge-on, then goes with it', () => {
    const seen: { t: number | null; hidden: boolean }[] = [];
    runSim({
      level: campBonus(),
      character: MARIO,
      script: none,
      start: { x: 1, y: 12, mode: 'stand', time: 250 },
      maxFrames: 400,
      controller: (w) => {
        const wall = w.trickWalls[0];
        if (wall?.spinT != null) seen.push({ t: wall.spinT, hidden: w.player.hidden });
        return ['left'];
      },
    });
    const half = TRICK_SPIN_FRAMES >> 1;
    expect(seen.length).toBe(TRICK_SPIN_FRAMES);
    for (const s of seen) expect(s.hidden, `t ${s.t}`).toBe((s.t as number) >= half);
    expect(seen.map((s) => s.t)).toEqual(Array.from({ length: TRICK_SPIN_FRAMES }, (_, i) => i + 1));
  });
});

describe('co-op', () => {
  it.each(CHARACTERS.map((c) => [c.name, c] as const))(
    'either player (P2: %s) pushing alone takes both through; nobody is left behind',
    (_n, c) => {
      for (const pusher of [0, 1]) {
        const w = runSim({
          level: campBonus(),
          character: MARIO,
          state: { character2: c, powerState2: 'small', hp2: 0 },
          script: none,
          start: { x: 1, y: 12, mode: 'stand', time: 250 },
          maxFrames: 2,
        }).world;
        // The pusher against the panel, the other a few steps away.
        w.players.forEach((p, i) => (p.body.x = px(i === pusher ? 16 : 96)));
        const inputs = [0, 1].map((i) => held(i === pusher ? ['left'] : []));
        for (let f = 0; f < 300 && !w.events.some((e) => e.type === 'pipe'); f++) w.update(inputs);
        const ev = w.events.find((e) => e.type === 'pipe');
        expect(ev, `P${pusher + 1}`).toEqual({ type: 'pipe', target: INTO_DOJO });
        expect(w.players.every((p) => p.hidden && !p.dead)).toBe(true);
      }
    },
  );

  it.each(CHARACTERS.map((c) => [c.name, c] as const))(
    'arriving with player 2 (%s): both step out inside the room, P2 further in, on the floor, free to move',
    (_n, c) => {
      for (const [name, level, x, side] of [
        ['dojo', dojo(), 14, -1],
        ['bonus room', campBonus(), 1, 1],
      ] as const) {
        for (const power of ['small', 'big'] as const) {
          const r = runSim({
            level,
            character: MARIO,
            state: { powerState: power, character2: c, powerState2: power, hp2: 0 },
            script: none,
            start: { x, y: 12, mode: 'spin', time: 240, clearEnemies: 'keep-piranhas' },
            maxFrames: TRICK_SPIN_FRAMES + 30,
          });
          const label = `${name} ${c.name} ${power}`;
          expect(r.world.players, label).toHaveLength(2);
          expect(r.world.spinning, label).toBe(false);
          const [p1, p2] = r.world.players as [World['player'], World['player']];
          for (const p of [p1, p2]) {
            const b = p.body;
            expect(p.dead, label).toBe(false);
            expect(p.hidden, label).toBe(false);
            expect(p.frozen, label).toBe(false);
            expect(b.onGround, label).toBe(true);
            expect(toPx(b.y + b.h), label).toBe(13 * 16);
            expect(toPx(b.x), label).toBeGreaterThanOrEqual(16);
            expect(toPx(b.x + b.w), label).toBeLessThanOrEqual(15 * 16);
            expect(inWall(r.world, b), label).toBe(false);
            expect(p.facing, label).toBe(side);
          }
          expect(Math.sign(toPx(p2.body.x) - toPx(p1.body.x)), label).toBe(side);
        }
      }
    },
  );
});

/** An input frame that holds `actions` (pressed on no frame). */
function held(actions: Action[]) {
  const set = new Set(actions);
  const l = set.has('left');
  const r = set.has('right');
  return {
    held: (a: Action) => set.has(a),
    pressed: () => false,
    released: () => false,
    bufferedJump: () => false,
    consumeJumpBuffer: () => undefined,
    dirX: (l && !r ? -1 : r && !l ? 1 : 0) as -1 | 0 | 1,
  };
}

describe('the spin arrival', () => {
  it('the players are hidden and frozen until the panel turns edge-on, and move once it is shut', () => {
    const log: { hidden: boolean; frozen: boolean; spin: boolean }[] = [];
    runSim({
      level: dojo(),
      character: MARIO,
      script: none,
      start: { x: 14, y: 12, mode: 'spin', time: 240 },
      maxFrames: TRICK_SPIN_FRAMES + 10,
      controller: (w) => {
        log.push({ hidden: w.player.hidden, frozen: w.player.frozen, spin: w.spinning });
        return ['left'];
      },
    });
    const half = TRICK_SPIN_FRAMES >> 1;
    // Frame f's controller sees the world after f updates.
    expect(log[0]).toEqual({ hidden: true, frozen: true, spin: true });
    expect(log[half - 1]?.hidden).toBe(true);
    expect(log[half]?.hidden).toBe(false);
    expect(log[half]?.frozen).toBe(true);
    expect(log[TRICK_SPIN_FRAMES]).toEqual({ hidden: false, frozen: false, spin: false });
  });

  it('arriving does not spin the panel straight back: walking on into the room', () => {
    const r = runSim({
      level: dojo(),
      character: RYU,
      script: none,
      start: { x: 14, y: 12, mode: 'spin', time: 240 },
      maxFrames: 300,
      controller: () => ['left'],
    });
    expect(r.outcome).toBe('timeout');
    expect(toPx(r.world.player.body.x)).toBeLessThan(4 * 16);
  });
});

describe('every hero gets to Ryu and back out of 6-2', () => {
  it.each(CHARACTERS.map((c) => [c.name, c] as const))(
    '%s: into the dojo, over to Ryu, back through the panel, out of the bonus room’s pipe',
    (_n, c) => {
      // In: from where the pipe drops him in (column 1), push into the panel.
      const a = runSim({
        level: campBonus(),
        character: c,
        script: none,
        start: { x: 1, y: 0, mode: 'fall', time: 250 },
        maxFrames: 600,
        controller: (w) => (w.player.body.onGround ? ['left'] : []),
      });
      expect(a.outcome, c.name).toBe('pipe');
      expect(a.events.find((e) => e.type === 'pipe')).toEqual({ type: 'pipe', target: INTO_DOJO });
      // The dojo: walk over to Ryu (talk range: 24 px), then back to the panel and push into it.
      let reached = false;
      const d = runSim({
        level: dojo(),
        character: c,
        script: none,
        start: { x: 14, y: 12, mode: 'spin', time: 240 },
        maxFrames: 900,
        controller: (w) => {
          const p = w.player;
          const b = p.body;
          if (b.onGround && Math.abs(toPx(p.centerX) - (RYU_AT.x * 16 + 8)) < 20) reached = true;
          if (!b.onGround) return [];
          return reached ? ['right'] : ['left'];
        },
      });
      expect(reached, `${c.name} stood beside Ryu`).toBe(true);
      expect(d.outcome, c.name).toBe('pipe');
      expect(d.events.find((e) => e.type === 'pipe')).toEqual({ type: 'pipe', target: BACK_TO_BONUS });
      expect(d.world.time).toBeLessThanOrEqual(240);
      // Back in the bonus room beside its panel: walk right to the pipe, out into 6-2.
      const b = runSim({
        level: campBonus(),
        character: c,
        script: none,
        start: { x: 1, y: 12, mode: 'spin', time: 220 },
        maxFrames: 900,
        controller: (w) => (w.player.body.onGround ? ['right'] : []),
      });
      expect(b.outcome, c.name).toBe('pipe');
      expect(b.events.find((e) => e.type === 'pipe')).toEqual({ type: 'pipe', target: OUT_TO_6_2 });
    },
  );
});

/** File 1 open on World 6 at 6-2, then into 6-2's first bonus room as its pipe drops you in. */
function intoBonus(h: H): LevelScene {
  file({ cleared: ['1-0', '6-1'], pages: ['smb-1', 'smb-6'], position: { page: 'smb-6', node: '6-2' } });
  h.game.openFile(1);
  expect(h.top()).toBeInstanceOf(WorldMapScene);
  h.game.startLevel(getLevel('6-2-bonus'), { x: 1, y: 0, mode: 'fall', time: 300 });
  h.step();
  return h.top() as LevelScene;
}

const levelId = (h: H) => (h.top() as LevelScene).level?.id;

describe('the whole way in campaign play', () => {
  it('bonus room → dojo → bonus room → 6-2: the clock carries over, no secret and no clear recorded', () => {
    const h = makeGame();
    const l = intoBonus(h);
    expect(tricks(l.level.zones)[0]?.campaign).toBeUndefined();
    // Drop in from the pipe onto the floor first (holding left in the air lands on the wall's top).
    h.until(() => l.world.player.body.onGround, 120);
    for (let f = 0; f < 600 && levelId(h) === '6-2-bonus'; f++) h.step(['left']);
    expect(levelId(h)).toBe('6-2-dojo');
    const inDojo = (h.top() as LevelScene).world;
    const arrived = inDojo.time as number;
    expect(arrived).toBeLessThanOrEqual(300);
    expect(arrived).toBeGreaterThan(290);
    expect(h.game.mapProgress.secrets).toEqual([]);
    expect(h.game.mapProgress.cleared).not.toContain('6-2');
    h.idle(TRICK_SPIN_FRAMES + 2);
    expect(captives(h.top() as LevelScene).map((x) => x.hero.id)).toEqual(['ryu']);
    for (let f = 0; f < 900 && levelId(h) === '6-2-dojo'; f++) h.step(['right']);
    expect(levelId(h)).toBe('6-2-bonus');
    const back = (h.top() as LevelScene).world;
    expect(back.time).toBeLessThanOrEqual(inDojo.time as number);
    for (let f = 0; f < 900 && levelId(h) === '6-2-bonus'; f++) h.step(['right']);
    expect(levelId(h)).toBe('6-2');
    const main = (h.top() as LevelScene).world;
    expect(main.time).toBeLessThanOrEqual(back.time as number);
    expect(main.time).toBeGreaterThan(arrived - 60);
    expect(h.game.mapProgress.secrets).toEqual([]);
    expect(h.game.mapProgress.cleared).not.toContain('6-2');
  });
});

describe('captive Ryu', () => {
  const intoDojo = (h: H) => {
    h.game.openFile(1);
    h.game.startLevel(dojo(), { mode: 'spin', x: 14, y: 12, time: 250 });
    h.step();
    return h.top() as LevelScene;
  };

  it('kneels in the dojo only in campaign play, and only until freed', () => {
    const h = makeGame();
    file();
    const l = intoDojo(h);
    h.idle(30);
    expect(captives(l).map((c) => c.hero.id)).toEqual(['ryu']);
    const h1 = makeGame();
    file({ freed: ['mario', 'ryu'] });
    const l1 = intoDojo(h1);
    h1.idle(30);
    expect(captives(l1)).toHaveLength(0);
    const h2 = makeGame();
    h2.game.devStart('6-2-dojo', MARIO, 'small');
    h2.until(() => h2.top() instanceof LevelScene);
    h2.idle(30);
    expect(captives(h2.top() as LevelScene)).toHaveLength(0);
  });

  it('the map hints at node 6-2 on World 6', () => {
    expect(hiddenHeroes()).toContainEqual({
      hero: 'ryu',
      level: '6-2-dojo',
      main: '6-2',
      page: 'smb-6',
      node: '6-2',
    });
    expect(hiddenHeroesAt('smb-6', '6-2').map((x) => x.hero)).toEqual(['ryu']);
    expect(hiddenHeroesAt('smb-6', '6-1')).toEqual([]);
  });

  it('his words: the Masked Ninja cursed him; every line fits', () => {
    const def: MiniGameDef = {
      hero: 'ryu',
      title: 'SHADOW DUEL',
      rules: [],
      create: () => ({ update() {}, render() {} }),
    };
    for (const talker of CHARACTERS) {
      const pages = captiveDialogue(RYU, def, talker);
      for (const page of pages) {
        expect(page.length, talker.id).toBeLessThanOrEqual(8);
        for (const line of page) expect(line.length, `${talker.id}: ${line}`).toBeLessThanOrEqual(CARD_COLS);
      }
      const own = (pages[1] ?? []).join(' ');
      expect(own).toContain('MASKED NINJA');
      expect(own).toContain('CURSE');
      expect(own).toContain(`${fontText(talker.name)}...`);
      expect(own).not.toContain('NO ONE PASSES HERE.');
    }
  });
});
