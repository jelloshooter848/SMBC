import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLevel, levelIds } from '@content/levels';
import { runSim } from '@game/sim/headless';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { campaignLevel } from '@game/level/campaign';
import { parseTextMap, serializeTextMap } from '@game/level/textmap';
import { isSwimLevel, type LevelData, type Zone } from '@game/level/schema';
import { T } from '@game/level/tiles';
import type { World } from '@game/world/world';
import { Fred, FRED_DIVES_SAID } from '@game/entities/objects/fred';
import { Partner } from '@game/entities/objects/partner';
import { KeyItem, LockedDoor } from '@game/entities/objects/keys';
import { carryTime, LevelScene } from '@game/scenes/level';
import { WorldMapScene } from '@game/scenes/world-map';
import { CardScene } from '@game/scenes/message';
import { captiveDialogue, CARD_COLS } from '@game/scenes/free-hero';
import { fontText } from '@game/hud/text';
import { hiddenHeroes, hiddenHeroesAt } from '@game/map/captives';
import { MINIGAMES, type MiniGameDef } from '@game/minigames';
import { arenaGames, metHero } from '@game/arena';
import { beat } from '@game/story/beats';
import { RIFT_SEALED_PAGES, sealedHint } from '@game/story/script';
import { CreditsScene } from '@game/scenes/credits';
import { px, toPx } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { captives, closeCards, draw, file, makeGame, useStorage, type H } from './heroes-harness';
import { sophiaDef } from '@content/sprites/sophia';
import { ALL_STORY } from './story-seen';

// Sophia III, the last hidden hero. Since 0.4.54 (owner) her way in is from 8-1: she drops into a
// steel hatch by its start (always shut in play), and the real way down is 8-1's coin room
// (8-1-bonus), where the key opens a locked blast door down into her garage (8-4-garage, its id
// kept, an area of 8-1 now), whose pipe brings the hero back up out of 8-1's pipe at column 115:
// a secret detour, not a shortcut. The clock runs on throughout. (The key route itself is
// tests/sim/sophia-keys.test.ts.) Until then (0.4.18, S4) the way in was 8-4-end's trap pipe to
// Jason's secret area (8-4-jason), after Fred through a flooded tunnel (8-4-fred): both are
// retired, kept for Fred's dive and swim and the tests below, and the trap pipe is the
// original's again.

useStorage();

const none = { steps: [{ frame: 0, hold: [] as Action[] }] };
const tile = (l: { tiles: Uint16Array; width: number }, x: number, y: number) => l.tiles[y * l.width + x];
const v0412 = () =>
  parseTextMap(readFileSync(join(import.meta.dirname, 'fixtures', '8-4-end-v0.4.12.map'), 'utf8'), '8-4-end');
const end84 = () => getLevel('8-4-end');
const camp84 = () => campaignLevel(getLevel('8-4-end'));
const pipes = (zones: Zone[]) => zones.filter((z): z is Zone & { kind: 'pipe' } => z.kind === 'pipe');

const TRAP = { level: '8-4', x: 19, y: 10, exitDir: 'up' };
const INTO_TUNNEL = { level: '8-4-fred', x: 4, y: 0, exitDir: 'fall' };
const INTO_GARAGE = { level: '8-4-garage', x: 2, y: 0, exitDir: 'fall' };
const BACK_TO_81 = { level: '8-1', x: 115, y: 10, exitDir: 'up' };
const SOPHIA_AT = { x: 8, y: 12 };

/** Every hero, at small and big where it has power states (Sophia: Normal and Hyper). */
const runs = CHARACTERS.flatMap((c) =>
  (c.damage.kind === 'powerup' ? ['small', 'big'] : ['full']).map((p) => [`${c.name} ${p}`, c, p] as const),
);

const heroState = (power: string) => ({ powerState: power as 'small' });

/** Onto the down pipe at `col` (its two columns) and DOWN, once lined up over its middle. */
function downPipe(col: number, index = 0) {
  return (w: World): Action[] => {
    const p = w.players[index]!;
    if (!p.body.onGround) return [];
    const dx = toPx(p.centerX) - (col + 1) * 16;
    if (dx < -3) return ['right'];
    if (dx > 3) return ['left'];
    return ['down'];
  };
}

/**
 * Walking right through a room, hopping onto what blocks the way (a pipe): straight up first, then
 * over once above it; a hero whose jump is committed at take-off (Simon) backs up for a run-up.
 * Once on top of the down pipe at `pipe`, it lines up and goes DOWN.
 */
function walkToPipe(pipe: number | null, index = 0) {
  let backing = 0;
  const down = pipe === null ? null : downPipe(pipe, index);
  return (w: World): Action[] => {
    const p = w.players[index]!;
    const b = p.body;
    if (p.clinging) return [];
    const feetRow = (toPx(b.y + b.h) - 1) >> 4;
    if (down && pipe !== null && b.onGround && w.map.get(pipe, feetRow + 1) === T.PIPE_TL) return down(w);
    const ahead = (toPx(b.x + b.w) + 1) >> 4;
    // In the air: jump held only while rising (a tank held in the air would hover), and on over
    // the step once above it, never into its side (Ryu would cling).
    if (!b.onGround) {
      const rise: Action[] = b.vy < 0 ? ['jump'] : [];
      return w.map.isSolid(ahead, feetRow) ? rise : ['right', ...rise];
    }
    if (backing > 0) {
      backing--;
      return ['left'];
    }
    if (p.profile.airControl === 'none') {
      if (!w.map.isSolid((toPx(b.x + b.w) + 20) >> 4, feetRow)) return ['right'];
      if (Math.abs(b.vx) < 0.8 * p.profile.maxWalk) {
        backing = 24;
        return ['left'];
      }
      return ['right', 'jump'];
    }
    if (!w.map.isSolid(ahead, feetRow)) return ['right'];
    return w.frame % 2 ? ['jump'] : [];
  };
}

/**
 * Fred's tunnel: swim right along the open band (rows 8-12), a stroke whenever the feet sink below
 * row 11's middle or rock is just ahead; from column 31 on, sink to the floor and walk into the
 * side pipe.
 */
function swimBot(index = 0) {
  return (w: World): Action[] => {
    const p = w.players[index]!;
    const b = p.body;
    // From column 31 on, and all the way for a hero who cannot steer off the ground (Simon): the floor.
    if (toPx(p.centerX) >> 4 >= 31 || p.profile.airControl === 'none') return ['right'];
    const feet = toPx(b.y + b.h);
    const ahead = (toPx(b.x + b.w) + 2) >> 4;
    let blocked = false;
    for (let r = toPx(b.y) >> 4; r <= (feet - 1) >> 4; r++) if (w.map.isSolid(ahead, r)) blocked = true;
    const stroke = feet > 184 || blocked;
    return stroke && w.frame % 2 === 0 ? ['right', 'jump'] : ['right'];
  };
}

describe('8-4-end is v0.4.12 tile for tile: the trap pipe as ever, in the campaign too (0.4.54)', () => {
  it('the same tiles, theme, music, start, entities and zones; nothing of the old route is left', () => {
    const l = end84();
    const old = v0412();
    expect([l.width, l.height]).toEqual([old.width, old.height]);
    expect(l.tiles).toEqual(old.tiles);
    expect([l.theme, l.music, l.time, l.start, l.startMode, l.camera, l.parent]).toEqual([
      old.theme,
      old.music,
      old.time,
      old.start,
      old.startMode,
      old.camera,
      old.parent,
    ]);
    // (0.4.23 to 0.4.53: Fred by the trap pipe, and the campaign pipe to Jason's area.)
    expect(l.entities).toEqual(old.entities);
    expect(l.decor).toEqual(old.decor);
    expect(l.zones).toEqual(old.zones);
  });

  it('the campaign variant: the trap pipe goes back into the maze; only Toad stands at the end', () => {
    const l = camp84();
    const base = end84();
    expect(l.tiles).toEqual(base.tiles);
    expect(pipes(l.zones)).toEqual([{ kind: 'pipe', x: 10, y: 11, dir: 'down', target: TRAP }]);
    expect(l.entities.map((e) => e.type)).toEqual(
      base.entities.map((e) => (e.type === 'princess' ? 'toad' : e.type)),
    );
  });

  it.each([
    ['Mario', MARIO, false],
    ['Mario', MARIO, true],
    ['Sophia III', CHARACTERS.find((c) => c.id === 'sophia')!, true],
  ])('%s down the pipe at 10 goes back into the castle maze (8-4 at 19; campaign %s)', (_n, c, campaign) => {
    const r = runSim({
      level: campaign ? camp84() : end84(),
      character: c,
      script: none,
      start: { x: 10, y: 10, mode: 'stand', time: 300 },
      maxFrames: 300,
      controller: downPipe(10),
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({ type: 'pipe', target: TRAP });
  });
});

describe("Jason's old area (8-4-jason; retired in 0.4.54, kept for Fred's dive)", () => {
  const jason = () => getLevel('8-4-jason');

  it('an area of 8-4 that keeps the clock: one locked Underworld screen, up out of a pipe', () => {
    const l = jason();
    expect([l.parent, l.time, l.world, l.stage]).toEqual(['8-4', null, 8, 4]);
    expect([l.theme, l.music, l.camera, l.startMode]).toEqual([
      'underworld',
      'bm-cutscene',
      'locked',
      'pipe-exit',
    ]);
    expect(l.start).toEqual({ x: 1, y: 10 });
    expect(l.width).toBe(16);
    expect([tile(l, 1, 11), tile(l, 2, 11)]).toEqual([T.PIPE_TL, T.PIPE_TR]);
    expect(carryTime(end84(), l, 250)).toBe(250);
    for (let y = 0; y < 2; y++) for (let x = 0; x < l.width; x++) expect(tile(l, x, y)).toBe(T.AIR);
    // No level leads here any more: only the developer level select.
    for (const id of levelIds())
      for (const z of campaignLevel(getLevel(id)).zones)
        if ('target' in z && z.target)
          expect((z.target as { level: string }).level, id).not.toBe('8-4-jason');
  });

  it('Jason (a campaign partner) by the pipe, Fred on the edge of the pool, the pool a pit into the tunnel', () => {
    const l = jason();
    expect(l.entities).toEqual([
      { type: 'partner', x: 5, y: 12, props: { who: 'jason', campaign: true } },
      { type: 'fred', x: 9, y: 12, props: { to: 11 } },
    ]);
    expect(l.zones).toEqual([{ kind: 'pit', x: 10, w: 4, target: { level: '8-4-fred', x: 4, y: 0 } }]);
    // The pool: water over an open bottom, four columns wide, walled on the right.
    for (const x of [10, 11, 12, 13]) {
      expect(tile(l, x, 13)).toBe(T.WATER);
      expect(tile(l, x, 14)).toBe(T.WATER);
    }
    expect(tile(l, 14, 13)).toBe(T.GROUND);
    expect(tile(l, 9, 13)).toBe(T.GROUND);
    expect(isSwimLevel(l)).toBe(false);
  });

  it.each(runs)('%s: up out of the pipe, walks right and drops into the pool after Fred', (_n, c, power) => {
    const r = runSim({
      level: campaignLevel(jason()),
      character: c,
      state: heroState(power),
      script: none,
      start: { x: 1, y: 10, mode: 'pipe-exit', time: 300, clearEnemies: 'keep-piranhas' },
      maxFrames: 900,
      controller: () => ['right'],
    });
    expect(r.outcome, `${c.name} ${power}`).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({ type: 'pipe', target: INTO_TUNNEL });
    expect(r.world.player.dead).toBe(false);
  });

  it('Sophia III with Jason on foot (EXIT): he drops into the pool and the tank comes along', () => {
    const sophia = CHARACTERS.find((c) => c.id === 'sophia')!;
    const r = runSim({
      level: campaignLevel(jason()),
      character: sophia,
      script: none,
      start: { x: 4, y: 12, mode: 'stand', time: 300 },
      maxFrames: 900,
      controller: (_w, f) => (f === 5 ? ['select'] : f > 30 ? ['right'] : []),
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({ type: 'pipe', target: INTO_TUNNEL });
    expect(r.world.player.dead).toBe(false);
    expect(toPx(r.world.player.body.w)).toBe(8);
  });

  it("Jason and Fred are drawn from Sophia III's sheet", () => {
    const h = makeGame();
    world8();
    h.game.openFile(1);
    h.game.startLevel(getLevel('8-4-jason'), { mode: 'pipe-exit', x: 1, y: 10, time: 300 });
    h.step();
    h.idle(120);
    const sprites = draw(h.top() as LevelScene).sprites.filter((x) => x.key === 'sophia');
    expect(sprites.map((x) => x.frame).sort()).toEqual(['fred-0', 'jason-stand']);
    for (const f of ['jason-stand', 'fred-0', 'fred-1', 'fred-2'])
      expect(sophiaDef.frames[f], f).toBeDefined();
  });

  it('Fred sits until a hero comes close, then hops into the pool, dives out of sight and is gone', () => {
    const fred = (w: World) => w.entities.find((e): e is Fred => e instanceof Fred);
    // Standing by the pipe, nobody near him: he sits.
    const still = runSim({
      level: jason(),
      character: MARIO,
      script: none,
      start: { x: 3, y: 12, mode: 'stand', time: 300 },
      maxFrames: 120,
    });
    expect(fred(still.world)?.doing).toBe('sit');
    // Walking up to him: off he goes, one hop into the pool, and down out of sight.
    let hopped = false;
    const r = runSim({
      level: jason(),
      character: MARIO,
      script: none,
      start: { x: 6, y: 12, mode: 'stand', time: 300 },
      maxFrames: 200,
      controller: (w) => {
        if (fred(w)?.doing === 'hop') hopped = true;
        return toPx(w.player.centerX) < 8 * 16 ? ['right'] : [];
      },
    });
    expect(hopped).toBe(true);
    expect(fred(r.world)).toBeUndefined();
    expect(r.events).toContainEqual({ type: 'say', text: FRED_DIVES_SAID });
  });
});

describe("Fred's flooded tunnel (8-4-fred; retired in 0.4.54, kept for Fred's swim)", () => {
  const tunnel = () => getLevel('8-4-fred');

  it("an area of 8-4 that keeps the clock, swum in the Underworld's look (`swim: true`)", () => {
    const l = tunnel();
    expect([l.parent, l.time, l.world, l.stage]).toEqual(['8-4', null, 8, 4]);
    expect([l.theme, l.music, l.camera, l.startMode]).toEqual(['underworld', 'bm-area', 'scroll', 'fall']);
    expect(l.swim).toBe(true);
    expect(isSwimLevel(l)).toBe(true);
    expect(l.start).toEqual({ x: INTO_TUNNEL.x, y: INTO_TUNNEL.y });
    expect(l.zones).toEqual([{ kind: 'pipe', x: 36, y: 12, dir: 'right', target: INTO_GARAGE }]);
    expect(l.entities).toEqual([{ type: 'fred', x: 8, y: 11, props: { mode: 'swim', to: 35 } }]);
    // The hole in the roof the hero drops in by, over the arrival column.
    for (const x of [3, 4, 5, 6]) expect(tile(l, x, 2)).toBe(T.WATER);
    // Above the roof only the hole's shaft is open, so a hovering hero can't walk the roof under the HUD.
    for (let x = 0; x < l.width; x++)
      for (const y of [0, 1]) expect(tile(l, x, y), `${x},${y}`).toBe(x >= 3 && x <= 6 ? T.AIR : T.HARD);
    // Rows 8-12 are open end to end (to the pipe), so every hero swims (or walks) through.
    for (let x = 1; x < 36; x++)
      for (let y = 8; y <= 12; y++) expect([T.AIR, T.COIN], `${x},${y}`).toContain(tile(l, x, y));
  });

  it('`swim: true` parses, writes back, and only true is allowed', () => {
    const l = tunnel();
    expect(parseTextMap(serializeTextMap(l), l.id).swim).toBe(true);
    expect(serializeTextMap(getLevel('8-4-jason'))).not.toContain('swim:');
    expect(() => parseTextMap(serializeTextMap(l).replace('swim: true', 'swim: yes'), l.id)).toThrow(/swim/);
  });

  it('a World of it swims; the same map without the header does not', () => {
    const swim = runSim({
      level: tunnel(),
      character: MARIO,
      script: none,
      start: { time: 300 },
      maxFrames: 90,
    });
    expect(swim.world.player.inWater).toBe(true);
    const dry: LevelData = { ...tunnel() };
    delete dry.swim;
    const fall = runSim({ level: dry, character: MARIO, script: none, start: { time: 300 }, maxFrames: 90 });
    expect(fall.world.player.inWater).toBe(false);
  });

  it.each(runs)('%s: drops in and swims after Fred to the pipe up into the garage', (_n, c, power) => {
    const r = runSim({
      level: campaignLevel(tunnel()),
      character: c,
      state: heroState(power),
      script: none,
      start: { x: 4, y: 0, mode: 'fall', time: 300, clearEnemies: 'keep-piranhas' },
      maxFrames: 2400,
      controller: swimBot(),
    });
    expect(r.outcome, `${c.name} ${power} at ${toPx(r.world.player.body.x) >> 4}`).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({ type: 'pipe', target: INTO_GARAGE });
  });

  it('Fred swims on ahead while a hero is near, waits by the pipe and slips in as the hero comes', () => {
    let maxAhead = -Infinity;
    let waited = false;
    const r = runSim({
      level: tunnel(),
      character: MARIO,
      script: none,
      start: { x: 4, y: 0, mode: 'fall', time: 300 },
      maxFrames: 2400,
      controller: (w) => {
        const f = w.entities.find((e): e is Fred => e instanceof Fred);
        if (f) {
          maxAhead = Math.max(maxAhead, f.body.x - w.player.body.x);
          if (f.doing === 'wait') waited = true;
        }
        return swimBot()(w);
      },
    });
    expect(r.outcome).toBe('pipe');
    expect(waited).toBe(true);
    expect(maxAhead).toBeGreaterThan(px(32));
    expect(r.world.entities.some((e) => e instanceof Fred)).toBe(false);
    // A hero who stays where he dropped in: Fred swims on a little and waits, just out of reach.
    const alone = runSim({
      level: tunnel(),
      character: MARIO,
      script: none,
      start: { x: 4, y: 0, mode: 'fall', time: 300 },
      maxFrames: 300,
    });
    const f = alone.world.entities.find((e): e is Fred => e instanceof Fred);
    expect(f?.doing).toBe('swim');
    const gap = toPx(f!.body.x + (f!.body.w >> 1) - alone.world.player.centerX);
    expect(gap).toBeGreaterThanOrEqual(80);
    expect(gap).toBeLessThan(84);
  });
});

describe("Sophia III's garage (8-4-garage, an area of 8-1 since 0.4.54)", () => {
  const garage = () => getLevel('8-4-garage');

  it('an area of 8-1 that keeps the clock, one locked screen, dropped into, the bm-garage music', () => {
    const l = garage();
    expect([l.parent, l.time, l.world, l.stage, l.name]).toEqual(['8-1', null, 8, 1, 'WORLD 8-1']);
    expect([l.theme, l.music, l.camera, l.startMode]).toEqual(['underworld', 'bm-garage', 'locked', 'fall']);
    expect(l.start).toEqual({ x: INTO_GARAGE.x, y: INTO_GARAGE.y });
    expect(l.entities).toEqual([
      { type: 'captive', x: SOPHIA_AT.x, y: SOPHIA_AT.y, props: { hero: 'sophia' } },
      { type: 'fred', x: 5, y: 12, props: { mode: 'rest' } },
    ]);
    expect(tile(l, SOPHIA_AT.x, SOPHIA_AT.y + 1)).toBe(T.GROUND);
    // Rows 0-1 clear under the HUD; the roof (row 2) has the shaft the hero drops in by (columns 2-3).
    for (let x = 0; x < l.width; x++) {
      for (const y of [0, 1]) expect(tile(l, x, y), `${x},${y}`).toBe(T.AIR);
      expect(tile(l, x, 2), `${x},2`).toBe(x === 2 || x === 3 ? T.AIR : T.HARD);
    }
    // The way back: up out of 8-1's pipe at column 115 (where the coin room's own pipe comes out).
    expect(l.zones).toEqual([{ kind: 'pipe', x: 13, y: 11, dir: 'down', target: BACK_TO_81 }]);
    expect([tile(l, 13, 11), tile(l, 14, 11)]).toEqual([T.PIPE_TL, T.PIPE_TR]);
    expect(getLevel('8-1-bonus').zones).toContainEqual({
      kind: 'pipe',
      x: 13,
      y: 12,
      dir: 'right',
      target: BACK_TO_81,
    });
  });

  it.each(runs)('%s: drops in, past Sophia III, onto the pipe and back up to 8-1', (_n, c, power) => {
    let reached = false;
    const r = runSim({
      level: campaignLevel(garage()),
      character: c,
      state: heroState(power),
      script: none,
      start: { x: 2, y: 0, mode: 'fall', time: 300, clearEnemies: 'keep-piranhas' },
      maxFrames: 1200,
      controller: (w) => {
        const b = w.player.body;
        if (b.onGround && Math.abs(toPx(w.player.centerX) - (SOPHIA_AT.x * 16 + 8)) < 24) reached = true;
        return walkToPipe(13)(w);
      },
    });
    expect(reached, `${c.name} ${power} beside Sophia III`).toBe(true);
    expect(r.outcome, `${c.name} ${power}`).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({ type: 'pipe', target: BACK_TO_81 });
  });

  it.each(runs)('%s: back in 8-1 up out of the pipe at 115, and on to the right', (_n, c, power) => {
    const r = runSim({
      level: campaignLevel(getLevel('8-1')),
      character: c,
      state: heroState(power),
      script: none,
      start: { x: 115, y: 10, mode: 'pipe-exit', time: 300, clearEnemies: 'all' },
      maxFrames: 900,
      controller: walkToPipe(null),
      until: (w) => w.player.body.onGround && toPx(w.player.centerX) >> 4 >= 119,
    });
    expect(r.outcome).toBe('stopped');
    expect(r.world.player.dead).toBe(false);
  });
});

describe('co-op', () => {
  it('both players drop into the garage together and go back up the pipe', () => {
    for (const c of CHARACTERS) {
      const st = { character2: c, powerState2: 'small' as const, hp2: 0 };
      const r = runSim({
        level: campaignLevel(getLevel('8-4-garage')),
        character: MARIO,
        state: st,
        script: none,
        start: { x: 2, y: 0, mode: 'fall', time: 300 },
        maxFrames: 1200,
        controller: walkToPipe(13),
      });
      expect(r.outcome, c.name).toBe('pipe');
      expect(r.events.find((e) => e.type === 'pipe')).toEqual({ type: 'pipe', target: BACK_TO_81 });
      expect(r.world.players).toHaveLength(2);
      for (const p of r.world.players) expect(p.dead, `${c.name} P${p.index + 1}`).toBe(false);
    }
  });
});

/** A campaign file on World 8 with everything before 8-4 cleared. */
function world8(over: Parameters<typeof file>[0] = {}) {
  const cleared = ['1-0', ...[1, 2, 3, 4, 5, 6, 7].flatMap((w) => [1, 2, 3, 4].map((s) => `${w}-${s}`))];
  return file({
    cleared: [...cleared, '8-1', '8-2', '8-3'],
    pages: [1, 2, 3, 4, 5, 6, 7, 8].map((w) => `smb-${w}`),
    position: { page: 'smb-8', node: '8-4' },
    story: [...ALL_STORY],
    ...over,
  });
}

const scene = (h: H) => h.game.scenes.find((s): s is LevelScene => s instanceof LevelScene) as LevelScene;
const levelId = (h: H) => scene(h)?.world.level.id;

/**
 * 8-1-bonus as a player plays it: right along the floor to under the key box (never on into the
 * exit pipe's mouth), a jump to bump it, PICK UP the key on the floor, left to the blast door (it
 * opens by itself as the key touches it), then UP in the doorway.
 */
function vaultBot() {
  let jumpHold = 0;
  return (w: World, f: number): Action[] => {
    const p = w.player;
    const b = p.body;
    const cx = toPx(p.centerX);
    const a: Action[] = [];
    if (jumpHold > 0) {
      jumpHold--;
      a.push('jump');
    }
    const key = w.entities.find((e): e is KeyItem => e instanceof KeyItem && e.alive);
    const door = w.entities.find((e): e is LockedDoor => e instanceof LockedDoor && e.alive);
    if (w.map.get(12, 9) === T.BRICK_KEY) {
      if (!b.onGround) return a;
      if (cx < 12 * 16 + 5) a.push('right');
      else if (cx > 12 * 16 + 11) a.push('left');
      else if (jumpHold === 0) jumpHold = 20;
    } else if (w.keyHolder === null && !door?.open) {
      if (key && !key.rising && key.body.onGround) {
        if (key.inReach(p)) {
          if (f % 2 === 0) a.push('special');
        } else if (b.onGround) a.push(toPx(key.body.x) + 8 < cx ? 'left' : 'right');
      }
    } else if (door && !door.open) a.push('left');
    else if (door) {
      const dx = toPx(door.body.x) + 8 - cx;
      if (Math.abs(dx) > 4) a.push(dx < 0 ? 'left' : 'right');
      else if (b.onGround && f % 2 === 0) a.push('up');
    }
    return a;
  };
}

describe('the whole way in campaign play', () => {
  it('8-1 → coin room (the key, the door) → garage → 8-1: the clock carries over, nothing recorded', () => {
    const h = makeGame();
    world8();
    h.game.openFile(1);
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    const cleared = [...h.game.mapProgress.cleared];
    h.game.startLevel(getLevel('8-1'), { x: 104, y: 8, mode: 'stand', time: 250 });
    h.step();
    expect(closeCards(h)).toEqual([]);
    for (let f = 0; f < 300 && levelId(h) === '8-1'; f++) h.step(downPipe(104)(scene(h).world));
    expect(levelId(h)).toBe('8-1-bonus');
    const arrived = scene(h).world.time as number;
    expect(arrived).toBeLessThanOrEqual(250);
    expect(arrived).toBeGreaterThan(235);
    // Jason is there (the story plays).
    h.idle(60);
    const jason = scene(h).world.entities.find((e): e is Partner => e instanceof Partner);
    expect(jason?.who).toBe('jason');
    const bot = vaultBot();
    for (let f = 0; f < 3000 && levelId(h) === '8-1-bonus'; f++) h.step(bot(scene(h).world, f));
    expect(levelId(h)).toBe('8-4-garage');
    h.idle(120);
    expect(captives(scene(h)).map((x) => x.hero.id)).toEqual(['sophia']);
    // The key was used up in the door: nothing carried into the garage.
    expect(scene(h).world.keyHolder).toBeNull();
    const walk = walkToPipe(13);
    for (let f = 0; f < 1200 && levelId(h) === '8-4-garage'; f++) h.step(walk(scene(h).world));
    expect(levelId(h)).toBe('8-1');
    const main = scene(h).world;
    expect(main.time).toBeLessThan(arrived);
    expect(main.time).toBeGreaterThan(arrived - 90);
    h.idle(120);
    expect(main.player.dead).toBe(false);
    // Up out of the pipe at 115, standing on it.
    expect(toPx(main.player.centerX) >> 4).toBeGreaterThanOrEqual(115);
    expect(toPx(main.player.centerX) >> 4).toBeLessThanOrEqual(116);
    expect(h.game.mapProgress.secrets).toEqual([]);
    expect(h.game.mapProgress.cleared).toEqual(cleared);
  });
});

describe('captive Sophia III', () => {
  const intoGarage = (h: H) => {
    h.game.openFile(1);
    h.game.startLevel(getLevel('8-4-garage'), { mode: 'fall', x: 2, y: 0, time: 250 });
    h.step();
    return h.top() as LevelScene;
  };

  it('waits in the garage only in campaign play, and only until freed', () => {
    const h = makeGame();
    world8();
    const l = intoGarage(h);
    h.idle(120);
    expect(captives(l).map((c) => c.hero.id)).toEqual(['sophia']);
    const h1 = makeGame();
    world8({ freed: ['mario', 'sophia'] });
    const l1 = intoGarage(h1);
    h1.idle(120);
    expect(captives(l1)).toHaveLength(0);
    const h2 = makeGame();
    h2.game.devStart('8-4-garage', MARIO, 'small');
    h2.until(() => h2.top() instanceof LevelScene);
    h2.idle(120);
    expect(captives(h2.top() as LevelScene)).toHaveLength(0);
  });

  it('talking to her: her first card, her own (the Plutonium Boss has the wheel), then Underworld', () => {
    const h = makeGame();
    world8();
    const l = intoGarage(h);
    const w = l.world;
    for (let f = 0; f < 600 && !captives(l)[0]?.inReach(w.player); f++) h.step(['right']);
    h.idle(6);
    h.tap('special');
    const first = h.top() as CardScene;
    expect(first).toBeInstanceOf(CardScene);
    expect([...first.lines]).toEqual([
      'SOPHIA III:',
      '',
      '...SOPHIA III SERVES',
      'KING KOOPA...',
      '...MUST FIND',
      'THE PRINCESS...',
    ]);
    expect(h.game.met).toContain('sophia');
    // Met: her mini game's pad in the Mini Game Arena is found.
    expect(metHero(h.game, 'sophia')).toBe(true);
    const pad = arenaGames().find((g) => g.id === 'mini-sophia');
    expect(pad?.title).toBe(MINIGAMES.sophia?.title);
    expect(pad?.found(h.game)).toBe(true);
  });

  it('her words: the spell speaks through her computer; every line fits; the round is her mini game', () => {
    const def = MINIGAMES.sophia as MiniGameDef;
    expect(def.hero).toBe('sophia');
    const sophia = CHARACTERS.find((c) => c.id === 'sophia')!;
    for (const talker of CHARACTERS) {
      const pages = captiveDialogue(sophia, def, talker);
      for (const page of pages)
        for (const line of page) expect(line.length, `${talker.id}: ${line}`).toBeLessThanOrEqual(CARD_COLS);
      expect(pages[1]).toEqual([
        'SOPHIA III:',
        '',
        'PILOT NOT FOUND. THE',
        'PLUTONIUM BOSS HAS THE',
        `WHEEL. ${fontText(talker.name)}...`,
        'CLIMB IN. BLAST IT OUT!',
      ]);
    }
  });

  it('the map hints at node 8-1 on World 8 (0.4.54: the garage is an area of 8-1)', () => {
    expect(hiddenHeroes()).toContainEqual({
      hero: 'sophia',
      level: '8-4-garage',
      main: '8-1',
      page: 'smb-8',
      node: '8-1',
    });
    expect(hiddenHeroesAt('smb-8', '8-1').map((x) => x.hero)).toEqual(['sophia']);
    expect(hiddenHeroesAt('smb-8', '8-4')).toEqual([]);
  });
});

describe("Sophia III's story lines play now that she hides under 8-1", () => {
  it("after the 8-4 credits: the rift still shut without her (0.4.23); Toad's reminder, the sealed hint", () => {
    const h = makeGame();
    world8({ story: ALL_STORY.filter((id) => id !== beat.rift && id !== beat.sealed('smb-8')) });
    h.game.openFile(1);
    h.step();
    h.game.showEnding('8-4');
    expect(h.top()).toBeInstanceOf(CreditsScene);
    h.idle(60);
    h.tap('start');
    h.until(() => h.top() instanceof CreditsScene && (h.top() as CreditsScene).waiting, 8000);
    h.tap('jump'); // the closing lines wait for OK
    h.until(() => h.top() instanceof WorldMapScene, 3000);
    const map = h.top() as WorldMapScene;
    const read: string[][] = [];
    for (let i = 0; i < 20 && map.mode === 'story'; i++) {
      h.until(() => map.toad?.lines != null || map.mode !== 'story', 600);
      const lines = map.toad?.lines;
      if (!lines) break;
      read.push([...lines]);
      h.idle(31);
      h.tap('jump');
    }
    expect(read).toEqual(RIFT_SEALED_PAGES.map((p) => [...p]));
    expect(h.game.seen(beat.rift)).toBe(false);
    h.until(() => map.mode === 'idle', 600);
    expect(map.hintLine).toBe(sealedHint('SOPHIA III'));
  });

  it('freed: Toad no longer reacts on the map (docs/STORY.md 2.13)', () => {
    const h = makeGame();
    world8({ freed: ['mario', 'sophia'], story: [...ALL_STORY] });
    h.game.openFile(1);
    h.step();
    const map = h.top() as WorldMapScene;
    expect(map.toad).toBeNull();
  });
});

describe('the bundled areas', () => {
  it('every level reached on the way has its own data (no dangling link)', () => {
    const vault = campaignLevel(getLevel('8-1-bonus'));
    for (const l of [camp84(), vault, getLevel('8-4-jason'), getLevel('8-4-fred'), getLevel('8-4-garage')])
      for (const z of l.zones)
        if ('target' in z && z.target) expect(levelIds()).toContain((z.target as { level: string }).level);
    // The blast door's way down.
    const door = vault.entities.find((e) => e.type === 'locked-door');
    expect(door?.props).toMatchObject({ to: '8-4-garage', tx: 2, ty: 0 });
    expect(levelIds()).toContain(String(door?.props?.to));
  });
});
