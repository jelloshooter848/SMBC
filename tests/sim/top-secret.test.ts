import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLevel, levelIds } from '@content/levels';
import { mapPage } from '@content/worldmap';
import { runSim } from '@game/sim/headless';
import { CHARACTERS } from '@game/characters/registry';
import { SIMON } from '@game/characters/simon';
import { ScriptedInput } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { LINK } from '@game/characters/link';
import { campaignLevel } from '@game/level/campaign';
import { parseTextMap, serializeTextMap } from '@game/level/textmap';
import { MAP_EXIT, type LevelData, type Zone } from '@game/level/schema';
import { T } from '@game/level/tiles';
import { PATH_STEP_FRAMES, World, type WorldEvent } from '@game/world/world';
import { Decoration } from '@game/entities/objects/decoration';
import { PowerUp } from '@game/entities/objects/powerup';
import { Moblin } from '@game/entities/objects/moblin';
import {
  EGG_HATCH_FRAME,
  EGG_RISE_FRAMES,
  YoshiEgg,
  hatch,
  yoshiUnlocked,
} from '@game/entities/objects/yoshi-egg';
import { LevelScene, MOBLIN_CARDS, PATH_SAID } from '@game/scenes/level';
import { CardScene } from '@game/scenes/message';
import { IntroScene } from '@game/scenes/intro';
import { WorldMapScene } from '@game/scenes/world-map';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { CARD_COLS } from '@game/scenes/free-hero';
import { fontText } from '@game/hud/text';
import { isOpen, isPathOpen, pathExit, type Dir } from '@game/map/rules';
import { hasSecretExit } from '@game/map/secret-exits';
import { isBonusArea } from '@game/map/bonus-spot';
import { clearedMainLevels, loadSave } from '@game/save/save-files';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { px, toPx } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import type { CharacterDef } from '@game/characters/character';
import type { MapNode, WorldMapPage } from '@game/map/types';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { draw, file, makeGame, useStorage, type H } from './heroes-harness';
import { hudAreaLines } from '@game/hud/hud';
import { LIGHT_SKIES } from '@game/world/tile-render';
import { runRoute, type Move } from './route-bot';
import { ALL_STORY } from './story-seen';

// The Top Secret Area (owner design for 0.4.10, after Super Mario World's): in campaign play a
// hidden block at the top of 2-1's last tower lays a cloud path toward the flagpole, so every hero
// can jump OVER the pole without touching it; past the castle a cave mouth leads into the Moblin's
// cave, where his secret ends the level: 2-1 cleared AND World 2's hidden bonus spot `bonus-2`
// found. That spot is the Top Secret Area: five ? blocks (flower, flower, Yoshi egg, mushroom,
// mushroom), refilled on every visit, and a pipe back to the map. Outside the campaign 2-1 is
// exactly v0.4.9's (tests/sim/fixtures/2-1-v0.4.9.map).

useStorage();

const raw = () => getLevel('2-1');
const camp21 = () => campaignLevel(getLevel('2-1'));
const v049 = () =>
  parseTextMap(readFileSync(join(import.meta.dirname, 'fixtures', '2-1-v0.4.9.map'), 'utf8'), '2-1');
const tile = (l: { tiles: Uint16Array; width: number }, x: number, y: number) => l.tiles[y * l.width + x];

/** The pole: column 200, its ball on row 2; the last tower: columns 190-191, its top on row 3. */
const POLE_X = 200;
const ON_TOWER = { x: 190, y: 2, mode: 'stand' as const, time: 300 };
/** The hidden block: high over the bricks (185-186, row 9), left of 2-1's hidden coin block (186,5). */
const HIDDEN = { x: 184, y: 0 };
/** Standing on the hidden coin block (once bumped: 2-1's ordinary way up the last tower). */
const ON_COIN_BLOCK = { x: 186, y: 4, mode: 'stand' as const, time: 300 };
const COIN_BLOCK = { x: 186, y: 5 };
const PATH = { x: 192, y: 3, w: 7 };
/** The two cloud steps back up to the bricks the same bump lays first (0.4.12). */
const STEPS = [
  { x: 183, y: 10 },
  { x: 184, y: 9 },
];
/** The one-way cloud ledge against the last tower (0.4.12, campaign only): Simon's way up. */
const LEDGE = { x: 188, y: 8, w: 2 };
const INTO_CAVE = { level: '2-1-cave', x: 1, y: 12 };
const TSA = '2-top-secret';
const heroes = CHARACTERS.map((c) => [c.name, c] as const);
const runs = CHARACTERS.flatMap((c) =>
  (c.damage.kind === 'powerup' ? ['small', 'big'] : ['full']).map((p) => [`${c.name} ${p}`, c, p] as const),
);

const sleeps = (z: Zone) => 'campaign' in z && z.campaign === true;

describe('2-1 outside the campaign is v0.4.9 tile for tile', () => {
  it('the same tiles, look, start, zones and entities (the campaign-only ones sleep)', () => {
    const l = raw();
    const old = v049();
    expect([l.width, l.height]).toEqual([old.width, old.height]);
    expect(l.tiles).toEqual(old.tiles);
    expect([l.theme, l.music, l.time, l.start, l.startMode, l.camera]).toEqual([
      old.theme,
      old.music,
      old.time,
      old.start,
      old.startMode,
      old.camera,
    ]);
    expect(l.decor).toEqual(old.decor);
    // 0.4.12: a campaign look (Link's Zelda II field) that only campaign play applies.
    expect(l.campaignLook).toMatchObject({ theme: 'zelda2', music: 'zelda2-field' });
    expect(l.zones.filter((z) => !sleeps(z))).toEqual(old.zones);
    expect(l.entities.filter((e) => e.props?.campaign !== true)).toEqual(old.entities);
    // What sleeps: the cave mouth, the hidden path and the way into the cave (and, from 0.4.13,
    // the old man at the start with his cave doorway and fires: tests/sim/partners.test.ts).
    expect(l.entities.filter((e) => e.props?.campaign === true)).toEqual([
      { type: 'decor', x: 220, y: 12, props: { kind: 'items:cave-mouth', campaign: true } },
      { type: 'cave-fire', x: 7, y: 12, props: { campaign: true } },
      { type: 'decor', x: 8, y: 12, props: { kind: 'partners:cave', campaign: true } },
      { type: 'partner', x: 8, y: 12, props: { who: 'old-man', dx: 8, campaign: true } },
      { type: 'cave-fire', x: 10, y: 12, props: { campaign: true } },
    ]);
    expect(l.zones.filter(sleeps)).toEqual([
      ...STEPS.map((p) => ({ kind: 'path', ...p, w: 1, block: HIDDEN, oneWay: true, campaign: true })),
      { kind: 'path', ...PATH, block: HIDDEN, campaign: true },
      { kind: 'ledge', ...LEDGE, campaign: true },
      { kind: 'pipe', x: 224, y: 11, dir: 'right', target: INTO_CAVE, campaign: true },
    ]);
    // The tower top has no hidden block at all, and no cloud ledge stands by the tower.
    expect(tile(l, HIDDEN.x, HIDDEN.y)).toBe(T.AIR);
    for (let k = 0; k < LEDGE.w; k++) expect(tile(l, LEDGE.x + k, LEDGE.y)).toBe(T.AIR);
    // And its campaign-only zones write back as they read.
    expect(parseTextMap(serializeTextMap(l), '2-1').zones).toEqual(l.zones);
  });

  it('a hero who jumps over the pole and walks on finds no cave: nothing happens at the end', () => {
    const r = runSim({
      level: raw(),
      character: LUIGI,
      assist: { invulnerable: true },
      script: { steps: [] },
      start: { x: 205, y: 12, mode: 'stand', time: 300 },
      controller: () => ['right'],
      maxFrames: 400,
    });
    expect(r.outcome).toBe('timeout');
    expect(r.playerX).toBeGreaterThan(220 * 16);
    expect(r.world.entities.some((e) => e instanceof Decoration && e.name === 'items:cave-mouth')).toBe(
      false,
    );
  });

  it('jumping straight up on the tower bumps nothing (no hidden block)', () => {
    const r = runSim({
      level: raw(),
      character: MARIO,
      script: { steps: [{ frame: 5, hold: ['jump'] }] },
      start: ON_TOWER,
      maxFrames: 80,
    });
    expect(r.events.some((e) => e.type === 'path')).toBe(false);
    for (let k = 0; k < PATH.w; k++) expect(r.world.map.get(PATH.x + k, PATH.y)).toBe(T.AIR);
  });
});

/** Every hero, from the top of the last tower: try running jumps off its edge; true if one gets over. */
function overThePole(level: LevelData, c: CharacterDef, power: string): boolean {
  for (const run of [true, false])
    for (let jx = 0; jx <= 30; jx += 2) {
      let jumped = -1;
      let over = false;
      runSim({
        level,
        character: c,
        assist: { invulnerable: true },
        state: { powerState: power },
        script: { steps: [] },
        start: ON_TOWER,
        maxFrames: 260,
        controller: (w, f) => {
          const x = toPx(w.player.body.x);
          const hold: Action[] = run ? ['right', 'run'] : ['right'];
          if (f > 2 && jumped < 0 && x >= ON_TOWER.x * 16 + jx) jumped = f;
          if (jumped >= 0 && f - jumped < 60) hold.push('jump');
          return hold;
        },
        until: (w) => {
          if (w.flagGrabbedBy) return true;
          over = toPx(w.player.body.x) > POLE_X * 16 + 16;
          return over;
        },
      });
      if (over) return true;
    }
  return false;
}

/** Campaign 2-1 with its hidden coin block already bumped (a used block), as on the way up. */
function coinShown(): LevelData {
  const l = camp21();
  const tiles = new Uint16Array(l.tiles);
  tiles[COIN_BLOCK.y * l.width + COIN_BLOCK.x] = T.USED;
  return { ...l, tiles };
}

/**
 * The bot, for each player on his own, from the top of the tower once the hidden block has been
 * bumped (it is found elsewhere, below): wait for the path, then run right along it and jump off
 * its far end, holding right on past the castle into the cave mouth. Returns how it ended and
 * whether anyone touched the pole.
 */
function secretRoute(c: CharacterDef, power: string, players = 1) {
  const state = {
    ...newGameState(c),
    powerState: power,
    ...(players > 1 ? { character2: c, powerState2: power } : {}),
  };
  const w = new World(
    camp21(),
    {
      assets: new AssetRegistry({ default: {} }),
      audio: NULL_AUDIO,
      assist: { ...DEFAULT_ASSIST, invulnerable: true },
      reduceFlashing: true,
    },
    state,
    { ...ON_TOWER },
  );
  w.strikeBlock(HIDDEN.x, HIDDEN.y, w.player, false);
  const bots = w.players.map(() => ({ phase: 'wait' as 'wait' | 'run' | 'jump', at: -1 }));
  const inputs = w.players.map(() => new ScriptedInput({ steps: [] }));
  const events: WorldEvent[] = [];
  let touched = false;
  for (let f = 0; f < 1500; f++) {
    w.players.forEach((p, i) => {
      const bot = bots[i] as (typeof bots)[number];
      let hold: Action[] = [];
      if (bot.phase === 'wait') {
        if (!w.layingPath && p.body.onGround) bot.phase = 'run';
      } else {
        hold = ['right', 'run'];
        if (bot.phase === 'run' && toPx(p.body.x + p.body.w) >= 3176 && p.body.onGround) {
          bot.phase = 'jump';
          bot.at = f;
        }
        if (bot.phase === 'jump' && f - bot.at < 40) hold.push('jump');
      }
      const input = inputs[i] as ScriptedInput;
      input.setHeld(hold);
      input.next();
    });
    w.update(inputs);
    events.push(...w.events.splice(0));
    touched ||= !!w.flagGrabbedBy;
    if (touched || events.some((e) => e.type === 'pipe')) break;
  }
  return { events, touched, phases: bots.map((b) => b.phase), world: w };
}

describe('campaign 2-1: the hidden block, the cloud path and the jump over the pole', () => {
  it('the campaign variant puts the hidden block in and wakes the path, the cave pipe and its mouth', () => {
    const l = camp21();
    expect(l).not.toBe(raw());
    expect(tile(l, HIDDEN.x, HIDDEN.y)).toBe(T.HIDDEN_PATH);
    expect(l.zones).toContainEqual({ kind: 'path', ...PATH, block: HIDDEN });
    expect(l.zones).toContainEqual({ kind: 'pipe', x: 224, y: 11, dir: 'right', target: INTO_CAVE });
    expect(l.zones.some(sleeps)).toBe(false);
    expect(l.entities).toContainEqual({ type: 'decor', x: 220, y: 12, props: { kind: 'items:cave-mouth' } });
    // The one-way cloud ledge by the tower (0.4.12) is laid.
    expect(l.zones).toContainEqual({ kind: 'ledge', ...LEDGE });
    for (let k = 0; k < LEDGE.w; k++) expect(tile(l, LEDGE.x + k, LEDGE.y)).toBe(T.CLOUD_LEDGE);
    // Every other tile is 2-1's own: the flagpole, the tower, the castle.
    let diff = 0;
    for (let i = 0; i < l.tiles.length; i++) if (l.tiles[i] !== raw().tiles[i]) diff++;
    expect(diff).toBe(1 + LEDGE.w);
  });

  it('bumping the hidden block lays two steps back up, then seven cloud blocks toward the pole, one by one, and says so once', () => {
    // Small Mario on the hidden coin block walks left and jumps up-left at its edge.
    const r = runSim({
      level: coinShown(),
      character: MARIO,
      script: {
        steps: [
          { frame: 0, hold: ['left'] },
          { frame: 18, hold: ['left', 'jump'] },
        ],
      },
      start: ON_COIN_BLOCK,
      until: (w) => w.layingPath,
      maxFrames: 80,
    });
    expect(r.outcome).toBe('stopped');
    expect(r.events.filter((e) => e.type === 'path')).toEqual([{ type: 'path' }]);
    const w = r.world;
    expect(w.map.get(HIDDEN.x, HIDDEN.y)).not.toBe(T.HIDDEN_PATH); // shown (bumping, then used)
    expect(w.layingPath).toBe(true);
    const cells = [...STEPS, ...Array.from({ length: PATH.w }, (_, k) => ({ x: PATH.x + k, y: PATH.y }))];
    expect(cells.every((c) => w.map.get(c.x, c.y) === T.AIR)).toBe(true);
    // Each cell's frame of appearance: in order, steps first, at least PATH_STEP_FRAMES apart.
    const at: number[] = cells.map(() => -1);
    for (let f = 1; f <= 600 && w.layingPath; f++) {
      w.update([]);
      cells.forEach((c, i) => {
        if (at[i] === -1 && w.map.get(c.x, c.y) === (i < STEPS.length ? T.CLOUD_LEDGE : T.CLOUD_BLOCK))
          at[i] = f;
      });
    }
    expect(w.layingPath).toBe(false);
    expect(at.every((f) => f > 0)).toBe(true);
    for (let i = 1; i < at.length; i++) expect(at[i]! - at[i - 1]!).toBeGreaterThanOrEqual(PATH_STEP_FRAMES);
    expect(at[0]).toBeGreaterThanOrEqual(PATH_STEP_FRAMES - 1); // the bump's own frame counts
    expect(w.map.get(HIDDEN.x, HIDDEN.y)).toBe(T.USED);
    expect(w.events.filter((e) => e.type === 'path')).toEqual([]);
    // The pole's column stays clear: the path ends two tiles short of it.
    expect(PATH.x + PATH.w).toBe(POLE_X - 1);
    expect(PATH_SAID).toMatch(/path/);
  });

  it.each(runs)(
    '%s can find it: from the hidden coin block, a jump back up-left bumps it',
    (_n, c, power) => {
      // Walk left off the coin block's top and jump at some moment: one of them bumps it (each
      // hero's walk and jump differ, so the moment does), and the path starts.
      const hits: number[] = [];
      for (let j = 0; j <= 40; j += 2) {
        const r = runSim({
          level: coinShown(),
          character: c,
          state: { powerState: power },
          script: {
            steps: [
              { frame: 0, hold: ['left'] },
              { frame: j, hold: ['left', 'jump'] },
            ],
          },
          start: ON_COIN_BLOCK,
          until: (w) => w.layingPath,
          maxFrames: 120,
        });
        if (r.outcome === 'stopped') hits.push(j);
      }
      expect(hits.length).toBeGreaterThan(0);
    },
  );

  it.each(runs)(
    '%s: ordinary play never bumps it (ground, springboard, bricks, coin block, tower, ledge)',
    (name, c, power) => {
      // Every hero, small and big: runs and walks from the last stretch of ground, the bricks, the
      // hidden coin block and the tower top, heading right (or standing, or from the bricks and
      // tower jumping back left), jumping at many moments, short and long; bouncing on the
      // springboard (jump pressed as it squashes) or not, and from the cloud ledge by the tower
      // (0.4.12: right, standing or back left, with the coin block hidden or shown). Only a
      // deliberate jump back up-left from the coin block (above) finds the block.
      const coin = coinShown();
      const starts = [
        { name: 'ground 172', level: camp21(), at: { x: 172, y: 12 }, dirs: ['right'] },
        { name: 'ground 180', level: camp21(), at: { x: 180, y: 12 }, dirs: ['right'] },
        { name: 'bricks', level: camp21(), at: { x: 185, y: 8 }, dirs: ['right', 'none', 'left'] },
        { name: 'coin block', level: coin, at: { x: 186, y: 4 }, dirs: ['right', 'none'] },
        { name: 'tower', level: camp21(), at: { x: 190, y: 2 }, dirs: ['right', 'none', 'left'] },
        // 0.4.12: the one-way cloud ledge against the tower (Simon's step up), both its tiles.
        { name: 'ledge 188', level: camp21(), at: { x: 188, y: 7 }, dirs: ['right', 'none', 'left'] },
        { name: 'ledge 189', level: camp21(), at: { x: 189, y: 7 }, dirs: ['right', 'none', 'left'] },
        {
          name: 'ledge 188 (coin shown)',
          level: coin,
          at: { x: 188, y: 7 },
          dirs: ['right', 'none', 'left'],
        },
        {
          name: 'ledge 189 (coin shown)',
          level: coin,
          at: { x: 189, y: 7 },
          dirs: ['right', 'none', 'left'],
        },
      ] as const;
      let tries = 0;
      const bumped: string[] = [];
      for (const s of starts)
        for (const dir of s.dirs)
          for (const run of [true, false])
            for (let j = 0; j <= 84; j += 12)
              for (const hold of [8, 40])
                for (const spring of dir === 'right' ? [false, true] : [false]) {
                  tries++;
                  let hit = false;
                  runSim({
                    level: s.level,
                    character: c,
                    assist: { invulnerable: true },
                    state: { powerState: power },
                    script: { steps: [] },
                    start: { ...s.at, mode: 'stand', time: 300 },
                    maxFrames: 260,
                    controller: (w, f) => {
                      const h: Action[] = dir === 'none' ? [] : [dir];
                      if (run) h.push('run');
                      if (f >= j && f < j + hold) h.push('jump');
                      // On the springboard (column 188): jump as it squashes, for the high bounce.
                      if (spring && Math.abs(toPx(w.player.body.x) - 188 * 16) < 24 && f % 2 === 0)
                        h.push('jump');
                      return h;
                    },
                    until: (w) => {
                      hit ||= w.map.get(HIDDEN.x, HIDDEN.y) !== T.HIDDEN_PATH;
                      return hit || !!w.flagGrabbedBy || toPx(w.player.body.x) > 3230;
                    },
                  });
                  if (hit)
                    bumped.push(
                      `${name} from ${s.name} ${dir} run=${run} jump@${j}+${hold} spring=${spring}`,
                    );
                }
      expect(tries).toBeGreaterThan(400);
      expect(bumped).toEqual([]);
    },
  );

  it('2-1 has the hidden coin block the way up uses, and the springboard', () => {
    expect(tile(raw(), COIN_BLOCK.x, COIN_BLOCK.y)).toBe(T.HIDDEN_COIN);
    expect(raw().entities).toContainEqual({ type: 'spring', x: 188, y: 12 });
  });

  it('before the path, only Luigi can jump over the pole from the tower (measured, v0.4.9)', () => {
    const level = raw();
    const can = runs.filter(([, c, p]) => overThePole(level, c, p)).map(([name]) => name);
    expect(can).toEqual(['Luigi small', 'Luigi big']);
  });

  it.each(runs)(
    '%s: the hidden block, the path, over the pole untouched, on into the cave',
    (_n, c, power) => {
      const { events, touched, phases } = secretRoute(c, power);
      expect(phases).toEqual(['jump']);
      expect(touched).toBe(false);
      expect(events.at(-1)).toEqual({ type: 'pipe', target: INTO_CAVE });
    },
  );

  it.each([
    ['Mario', MARIO, 'big'],
    ['Simon', SIMON, 'full'],
  ] as const)('co-op (%s): both players over the pole, and into the cave together', (_n, c, power) => {
    const { events, touched, phases, world } = secretRoute(c, power, 2);
    expect(world.players).toHaveLength(2);
    expect(phases).toEqual(['jump', 'jump']);
    expect(touched).toBe(false);
    expect(events.at(-1)).toEqual({ type: 'pipe', target: INTO_CAVE });
  });

  it('touching the pole still ends the level the normal way (campaign or not)', () => {
    for (const level of [raw(), camp21()]) {
      // The usual way: a running jump off the tower's edge, into the pole.
      const r = runSim({
        level,
        character: MARIO,
        script: { steps: [] },
        start: ON_TOWER,
        controller: (w) => (toPx(w.player.body.x) >= 3058 ? ['right', 'run', 'jump'] : ['right', 'run']),
        maxFrames: 1500,
      });
      expect(r.outcome).toBe('cleared');
      expect(r.events.at(-1)).toEqual({ type: 'exit', next: '2-2-intro' });
    }
  });

  it('2-1 now has a secret exit on the map (the Moblin), the Top Secret Area none', () => {
    expect(hasSecretExit('2-1')).toBe(true);
    expect(hasSecretExit(TSA)).toBe(false);
  });
});

/*
 * Simon's way to the secret (0.4.12, QA of 0.4.10): his committed, fixed-arc jump could bump the
 * hidden block from the hidden coin block but never get onto the tower top or the cloud path (his
 * jumps hit the tower's side; the springboard threw him into it), nor back up once the bump had
 * dropped him on the ground. Campaign 2-1 now has a one-way cloud ledge against the tower, a row
 * over the bricks (a `ledge` zone: he hops onto it off the bricks or lands on it coming down from
 * the springboard, whose launch rises through it, and jumps from it onto the coin block's top, and
 * from there to the tower top), and the bump first lays two one-way cloud steps back up to the
 * bricks. Each hero's route below was found
 * by searching the bot's moves (tests/sim/route-bot.ts) and is replayed from the ground by real
 * inputs: onto the bricks, bump the hidden coin block, onto its top (Simon: by the ledge), bump the
 * hidden block, back up to the tower top, then along the path, over the pole and into the cave.
 */
const ROUTES: Readonly<Record<string, readonly Move[]>> = {
  'mario small': [
    { do: 'hop', dir: 1, at: 2916, steer: 2962, over: 144 },
    { do: 'hop', dir: 0, at: 0, from: 2978 },
    { do: 'hop', dir: 0, at: 0, from: 2964, steer: 2978, over: 80 },
    { do: 'hop', dir: -1, at: 2970, from: 2984 },
    { do: 'hop', dir: 1, at: 2930, from: 2916, steer: 2962, over: 144 },
    { do: 'hop', dir: 0, at: 0, from: 2962, steer: 2978, over: 80 },
    { do: 'hop', dir: 1, at: 2986, from: 2978, steer: 3048, over: 48 },
    { do: 'exit', jumpAt: 3170 },
  ],
  'mario big': [
    { do: 'hop', dir: 1, at: 2920 },
    { do: 'hop', dir: 0, at: 0, from: 2978 },
    { do: 'hop', dir: 0, at: 0, from: 2964, steer: 2978, over: 80 },
    { do: 'hop', dir: -1, at: 2968, from: 2984 },
    { do: 'hop', dir: 1, at: 2922, from: 2916, steer: 2962, over: 144 },
    { do: 'hop', dir: 0, at: 0, from: 2962, steer: 2978, over: 80 },
    { do: 'hop', dir: 1, at: 2986, from: 2978, steer: 3048, over: 48 },
    { do: 'exit', jumpAt: 3170 },
  ],
  'luigi small': [
    { do: 'hop', dir: 1, at: 2924 },
    { do: 'hop', dir: 0, at: 0, from: 2978 },
    { do: 'hop', dir: 0, at: 0, from: 2962, steer: 2978, over: 80 },
    { do: 'hop', dir: -1, at: 2968, from: 2984 },
    { do: 'hop', dir: 1, at: 2936, from: 2916, steer: 2962, over: 144 },
    { do: 'hop', dir: 0, at: 0, from: 2960, steer: 2978, over: 80 },
    { do: 'hop', dir: 1, at: 2986, from: 2978, steer: 3048, over: 48 },
    { do: 'exit', jumpAt: 3170 },
  ],
  'luigi big': [
    { do: 'hop', dir: 1, at: 2926 },
    { do: 'hop', dir: 0, at: 0, from: 2978 },
    { do: 'hop', dir: 0, at: 0, from: 2962, steer: 2978, over: 80 },
    { do: 'hop', dir: -1, at: 2966, from: 2984 },
    { do: 'hop', dir: 1, at: 2922, from: 2920, steer: 2962, over: 144 },
    { do: 'hop', dir: 0, at: 0, from: 2960, steer: 2978, over: 80 },
    { do: 'hop', dir: 1, at: 2986, from: 2978, steer: 3048, over: 48 },
    { do: 'exit', jumpAt: 3170 },
  ],
  'link full': [
    { do: 'hop', dir: 1, at: 2918, steer: 2962, over: 144 },
    { do: 'hop', dir: 0, at: 0, from: 2978 },
    { do: 'hop', dir: 0, at: 0, from: 2958, steer: 2978, over: 80 },
    { do: 'hop', dir: -1, at: 2968, from: 2984 },
    { do: 'hop', dir: 1, at: 2916, from: 2908, steer: 2962, over: 144 },
    { do: 'hop', dir: 0, at: 0, from: 2958, steer: 2978, over: 80 },
    { do: 'hop', dir: 1, at: 2985, from: 2978 },
    { do: 'exit', jumpAt: 3170 },
  ],
  'megaman full': [
    { do: 'hop', dir: 1, at: 2920, steer: 2962, over: 144 },
    { do: 'hop', dir: 0, at: 0, from: 2978 },
    { do: 'hop', dir: 0, at: 0, from: 2958, steer: 2978, over: 80 },
    { do: 'hop', dir: -1, at: 2967, from: 2984 },
    { do: 'hop', dir: 1, at: 2910, from: 2908, steer: 2962, over: 144 },
    { do: 'hop', dir: 0, at: 0, from: 2958, steer: 2978, over: 80 },
    { do: 'hop', dir: 1, at: 2986, from: 2978, steer: 3048, over: 48 },
    { do: 'exit', jumpAt: 3174 },
  ],
  'samus full': [
    { do: 'hop', dir: 1, at: 2918, steer: 2962, over: 144 },
    { do: 'hop', dir: 0, at: 0, from: 2978 },
    { do: 'hop', dir: 0, at: 0, from: 2958, steer: 2978, over: 80 },
    { do: 'hop', dir: -1, at: 2967, from: 2984 },
    { do: 'hop', dir: 1, at: 2912, from: 2908, steer: 2962, over: 144 },
    { do: 'hop', dir: 0, at: 0, from: 2958, steer: 2978, over: 80 },
    { do: 'hop', dir: 1, at: 2986, from: 2978, steer: 3048, over: 48 },
    { do: 'exit', jumpAt: 3170 },
  ],
  // onto the bricks, bump the coin block, hop onto the ledge, onto the coin block's top, bump the
  // hidden block (landing on the step beside the bricks), the ledge and the coin block's top
  // again, the tower top, over the pole
  'simon full': [
    { do: 'hop', dir: 1, at: 2918 },
    { do: 'hop', dir: 0, at: 0, from: 2978 },
    { do: 'hop', dir: 1, at: 2986, from: 2964 },
    { do: 'hop', dir: -1, at: 3019, from: 3028 },
    { do: 'hop', dir: -1, at: 2965, from: 2984 },
    { do: 'hop', dir: 1, at: 2986, from: 2964 },
    { do: 'hop', dir: -1, at: 3019, from: 3028 },
    { do: 'hop', dir: 1, at: 2987, from: 2978 },
    { do: 'exit', jumpAt: 3178 },
  ],
  'ryu full': [
    { do: 'hop', dir: 1, at: 2908 },
    { do: 'hop', dir: 0, at: 0, from: 2978 },
    { do: 'hop', dir: 0, at: 0, from: 2958, steer: 2978, over: 80 },
    { do: 'hop', dir: -1, at: 2967, from: 2984 },
    { do: 'hop', dir: 1, at: 2912, from: 2908, steer: 2962, over: 144 },
    { do: 'hop', dir: 0, at: 0, from: 2958, steer: 2978, over: 80 },
    { do: 'hop', dir: 1, at: 2985, from: 2978 },
    { do: 'exit', jumpAt: 3170 },
  ],
  'bill full': [
    { do: 'hop', dir: 1, at: 2918, steer: 2962, over: 144 },
    { do: 'hop', dir: 0, at: 0, from: 2978 },
    { do: 'hop', dir: 0, at: 0, from: 2958, steer: 2978, over: 80 },
    { do: 'hop', dir: -1, at: 2967, from: 2984 },
    { do: 'hop', dir: 1, at: 2910, from: 2908, steer: 2962, over: 144 },
    { do: 'hop', dir: 0, at: 0, from: 2958, steer: 2978, over: 80 },
    { do: 'hop', dir: 1, at: 2986, from: 2978, steer: 3048, over: 48 },
    { do: 'exit', jumpAt: 3170 },
  ],
};
const FROM_GROUND = { x: 180, y: 12 };

describe("campaign 2-1: every hero's whole way to the secret from the ground (0.4.12)", () => {
  it('the ledge and the steps are campaign-only zones that write back as they read', () => {
    const zones = raw().zones.filter((z) => z.kind === 'ledge' || (z.kind === 'path' && z.oneWay));
    expect(zones).toEqual([
      ...STEPS.map((p) => ({ kind: 'path', ...p, w: 1, block: HIDDEN, oneWay: true, campaign: true })),
      { kind: 'ledge', ...LEDGE, campaign: true },
    ]);
    expect(parseTextMap(serializeTextMap(raw()), '2-1').zones).toEqual(raw().zones);
    expect(() => parseTextMap('id: x\n[tiles]\n' + '.'.repeat(16) + '\n[zones]\nledge 1 2 3\n')).toThrow(
      /ledge x y w campaign/,
    );
  });

  it.each(runs)(
    '%s: from the ground, by real inputs, into the cave without touching the pole',
    (n, c, power) => {
      const key = `${c.id} ${power}`;
      const moves = ROUTES[key] as readonly Move[];
      expect(moves, key).toBeDefined();
      let bumpedBy = -1;
      const r = runRoute({
        level: camp21(),
        character: c,
        power,
        start: FROM_GROUND,
        moves,
        onFrame: (w) => {
          if (bumpedBy < 0 && w.map.get(HIDDEN.x, HIDDEN.y) !== T.HIDDEN_PATH)
            bumpedBy = toPx(w.player.body.x);
        },
      });
      expect(r.sim.events.at(0)).not.toEqual({ type: 'path' });
      expect(bumpedBy, n).toBeGreaterThan(0);
      expect(r.touchedPole, n).toBe(false);
      expect(r.sim.outcome, n).toBe('pipe');
      expect(r.sim.events.at(-1)).toEqual({ type: 'pipe', target: INTO_CAVE });
      // the route started on the ground and climbed (no placing on the tower)
      expect(
        r.stands.some(([, feet]) => feet === 48),
        n,
      ).toBe(true);
      if (c === SIMON)
        expect(
          r.stands.some(([, feet]) => feet === LEDGE.y * 16),
          'Simon uses the ledge',
        ).toBe(true);
    },
  );

  it("without the ledge, Simon's jumps off the bricks never land on the hidden coin block", () => {
    // Off the bricks (the coin block overhangs them) every jump right or straight up falls short.
    const noLedge = (() => {
      const l = coinShown();
      const tiles = new Uint16Array(l.tiles);
      for (let k = 0; k < LEDGE.w; k++) tiles[LEDGE.y * l.width + LEDGE.x + k] = T.AIR;
      return { ...l, tiles };
    })();
    const hops: Move[] = [
      ...Array.from({ length: 28 }, (_, k): Move => ({ do: 'hop', dir: 1, at: 2964 + k, from: 2962 })),
      ...Array.from({ length: 15 }, (_, k): Move => ({ do: 'hop', dir: 0, at: 0, from: 2962 + 2 * k })),
    ];
    for (const hop of hops) {
      const r = runRoute({
        level: noLedge,
        character: SIMON,
        power: 'full',
        start: { x: 185, y: 8 },
        moves: [hop],
        maxFrames: 400,
      });
      expect(r.done, JSON.stringify(hop)).toBe(1);
      expect(r.stands.at(-1)?.[1], JSON.stringify(hop)).not.toBe(80);
    }
  });

  it.each(runs)(
    '%s: an ordinary flagpole run ends the same with the ledge, and never bumps the hidden block',
    (n, c, power) => {
      // Run (or walk) right from the last stretch of ground, jump at many points, bounce on the
      // springboard (jump pressed as it squashes for the high launch) or not, and hold on right:
      // the ledge changes nothing (the launch rises through it) and the block stays hidden.
      for (const boost of [true, false])
        for (const run of [true, false])
          for (let jx = 2930; jx <= 2996; jx += 6) {
            const res = [raw(), camp21()].map((level, i) => {
              let jumped = -1;
              const r = runSim({
                level,
                character: c,
                assist: { invulnerable: true },
                state: { powerState: power },
                script: { steps: [] },
                start: { x: 178, y: 12, mode: 'stand', time: 300 },
                maxFrames: 700,
                controller: (w, f) => {
                  const h: Action[] = run ? ['right', 'run'] : ['right'];
                  const x = toPx(w.player.body.x);
                  if (jumped < 0 && x >= jx) jumped = f;
                  if (jumped >= 0 && f - jumped < 30) h.push('jump');
                  if (boost && Math.abs(x - 188 * 16) < 24 && f % 2 === 0) h.push('jump');
                  return h;
                },
              });
              if (i === 1) expect(r.world.map.get(HIDDEN.x, HIDDEN.y), n).toBe(T.HIDDEN_PATH);
              return `${r.outcome} ${r.score} ${JSON.stringify(r.events.at(-1))}`;
            });
            expect(res[1], `${n} boost=${boost} run=${run} jump at ${jx}`).toBe(res[0]);
          }
    },
  );
});

const moblinOf = (w: World) => w.entities.find((e): e is Moblin => e instanceof Moblin);

/** Walk right into the cave until the Moblin speaks (his event). */
function meet() {
  return runSim({
    level: getLevel('2-1-cave'),
    character: MARIO,
    script: { steps: [] },
    maxFrames: 600,
    controller: () => ['right'],
    until: (w) => !!moblinOf(w)?.told,
  });
}

describe("the Moblin's cave", () => {
  it('a one-screen cave of 2-1 with two fires and the Moblin, who sees you coming', () => {
    const l = getLevel('2-1-cave');
    expect([l.width, l.camera, l.parent, l.world, l.stage]).toEqual([16, 'locked', '2-1', 2, 1]);
    expect(l.entities).toEqual([
      { type: 'cave-fire', x: 7, y: 12 },
      { type: 'moblin', x: 9, y: 12, props: { secret: 'bonus-2', next: '2-2-intro' } },
      { type: 'cave-fire', x: 11, y: 12 },
    ]);
    const r = meet();
    expect(r.outcome).toBe('stopped');
    const ev = r.events.find((e) => e.type === 'moblin');
    expect(ev).toEqual({ type: 'moblin', player: 0, secret: 'bonus-2', next: '2-2-intro' });
    expect(moblinOf(r.world)?.surprised).toBe(true);
    // He saw Mario coming while Mario was still short of the first fire.
    expect(toPx(r.world.player.body.x)).toBeLessThan(7 * 16);
    // He spoke once: more frames raise nothing more.
    for (let i = 0; i < 60; i++) r.world.update([]);
    expect(r.world.events.some((e) => e.type === 'moblin')).toBe(false);
  });

  it("his cards fit a card and the font: '...!', 'YOU FOUND ME?!', the secret path, the secret", () => {
    expect(MOBLIN_CARDS.map((c) => c.join(' '))).toEqual([
      '...!',
      'YOU FOUND ME?!',
      "I'LL SHOW YOU A SECRET PATH... AS LONG AS YOU DON'T TELL ANYONE.",
      "IT'S A SECRET TO EVERYBODY.",
    ]);
    for (const card of MOBLIN_CARDS)
      for (const line of card) {
        expect(line.length).toBeLessThanOrEqual(CARD_COLS);
        expect(fontText(line)).toBe(line);
      }
  });

  it('co-op: either player can find him', () => {
    const state = { ...newGameState(MARIO), character2: LUIGI };
    const w = new World(
      getLevel('2-1-cave'),
      {
        assets: new AssetRegistry({ default: {} }),
        audio: NULL_AUDIO,
        assist: { ...DEFAULT_ASSIST },
        reduceFlashing: true,
      },
      state,
      {},
    );
    // Player 1 waits by the way in; player 2 walks up to him.
    const p1 = new ScriptedInput({ steps: [] });
    const p2 = new ScriptedInput({ steps: [{ frame: 0, hold: ['right'] }] });
    const events: WorldEvent[] = [];
    for (let i = 0; i < 400 && !events.some((e) => e.type === 'moblin'); i++) {
      p1.next();
      p2.next();
      w.update([p1, p2]);
      events.push(...w.events.splice(0));
    }
    expect(events.find((e) => e.type === 'moblin')).toMatchObject({ player: 1, secret: 'bonus-2' });
  });
});

/** A campaign file standing on 2-1 (World 1 done, World 2 open). */
function onWorld2(h: H, over: Parameters<typeof file>[0] = {}) {
  h.game.openFile(
    1,
    file({
      cleared: ['1-0', '1-1', '1-2', '1-3', '1-4'],
      pages: ['smb-1', 'smb-2'],
      position: { page: 'smb-2', node: '2-1' },
      story: [...ALL_STORY], // Toad's map scenes (0.4.13) are seen
      ...over,
    }),
  );
  h.idle(8);
  h.until(() => (h.top() as WorldMapScene).mode === 'idle', 1200);
}

const map = (h: H) => h.top() as WorldMapScene;

/** Hold `held` until `pred` (at most `max` frames). */
function holdUntil(h: H, held: Action[], pred: () => boolean, max = 1500) {
  for (let i = 0; i < max && !pred(); i++) h.step(held);
  expect(pred()).toBe(true);
}
const w2 = () => mapPage('smb-2') as WorldMapPage;
const node = (id: string) => w2().nodes.find((n) => n.id === id) as MapNode;

function dirOf(points: [number, number][]): Dir {
  const [a, b] = points as [[number, number], [number, number]];
  if (b[0] > a[0]) return 'right';
  if (b[0] < a[0]) return 'left';
  return b[1] > a[1] ? 'down' : 'up';
}
function walkTo(h: H, to: string) {
  const m = map(h);
  const p = m.page.paths.find((x) => x.from === m.node && x.to === to);
  const q = m.page.paths.find((x) => x.to === m.node && x.from === to);
  const pts = p ? p.points : [...(q as { points: [number, number][] }).points].reverse();
  h.tap(dirOf(pts));
  h.until(() => m.mode === 'idle');
  expect(m.node).toBe(to);
}

/** Through the Moblin's four cards with OK (jump). */
function readCards(h: H) {
  for (let i = 0; i < MOBLIN_CARDS.length; i++) {
    h.until(() => h.top() instanceof CardScene, 200);
    const card = h.top() as CardScene;
    expect(card.lines).toEqual(MOBLIN_CARDS[i]);
    h.idle(32);
    h.tap('jump');
    h.step();
  }
}

describe('campaign: the Moblin clears 2-1 and opens the road to the Top Secret Area', () => {
  it('cards, then the map: 2-1 cleared AND bonus-2 found, both roads drawn in, saved', () => {
    const h = makeGame();
    onWorld2(h);
    h.game.startLevel(getLevel('2-1-cave'), { mode: 'stand', time: 250 });
    h.step();
    expect(h.top()).toBeInstanceOf(LevelScene);
    holdUntil(h, ['right'], () => h.top() instanceof CardScene, 400);
    expect(h.said.at(-1)).toBe('...! OK.');
    readCards(h);
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    const prog = h.game.mapProgress;
    expect(prog.cleared).toContain('2-1');
    expect(prog.secrets).toEqual(['bonus-2']);
    expect(prog.position).toEqual({ page: 'smb-2', node: '2-1' });
    expect(h.game.pendingReveal).toEqual([
      'smb-2:2-1>2-2',
      'smb-2:2-2',
      'smb-2:2-1>bonus-2',
      'smb-2:bonus-2',
    ]);
    expect(loadSave(1)).toMatchObject({ secrets: ['bonus-2'], position: { page: 'smb-2', node: '2-1' } });
    expect(loadSave(1)?.cleared).toContain('2-1');
    h.until(() => map(h).mode === 'idle', 1600);
    expect(h.game.pendingReveal).toEqual([]);
    expect(isOpen(prog, w2(), '2-2')).toBe(true);
    expect(isOpen(prog, w2(), 'bonus-2')).toBe(true);
    expect(
      isPathOpen(
        prog,
        w2(),
        w2().paths.find((p) => p.to === 'bonus-2')!,
      ),
    ).toBe(true);
    expect(h.said).toContain('World 2-2, open. Top Secret Area, open');
    expect(map(h).nodeLabel(node('2-1'))).toMatch(/^World 2-1, cleared, secret exit found/);
    expect(clearedMainLevels(prog)).toBe(5);
  });

  it('touching the pole instead clears 2-1 only: the Top Secret road stays hidden', () => {
    const h = makeGame();
    onWorld2(h);
    h.game.startLevel(getLevel('2-1'), ON_TOWER);
    h.step();
    const lvl = h.top() as LevelScene;
    for (let i = 0; i < 1500 && !(h.top() instanceof WorldMapScene); i++)
      h.step(toPx(lvl.world.player.body.x) >= 3058 ? ['right', 'run', 'jump'] : ['right', 'run']);
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    const prog = h.game.mapProgress;
    expect(prog.cleared).toContain('2-1');
    expect(prog.secrets).toEqual([]);
    expect(h.game.pendingReveal).toEqual(['smb-2:2-1>2-2', 'smb-2:2-2']);
    expect(isOpen(prog, w2(), 'bonus-2')).toBe(false);
  });

  it('outside the campaign the Moblin sends you on to 2-2', () => {
    const h = makeGame();
    h.game.devStart('2-1-cave', MARIO, 'small');
    h.until(() => h.top() instanceof LevelScene, 400);
    holdUntil(h, ['right'], () => h.top() instanceof CardScene, 400);
    readCards(h);
    expect(h.top()).toBeInstanceOf(IntroScene);
    h.until(() => h.top() instanceof LevelScene, 400);
    expect((h.top() as LevelScene).level.id).toBe('2-2-intro');
  });
});

describe('the map: World 2 bonus spot is the Top Secret Area', () => {
  it('bonus-2 at (8,4) leads into the Top Secret Area; hidden until its key; its road is 2-1s secret exit', () => {
    const n = node('bonus-2');
    expect(n).toEqual({
      id: 'bonus-2',
      kind: 'bonus',
      x: 8,
      y: 4,
      unlock: 'bonus-2',
      level: TSA,
      label: 'TOP SECRET AREA',
    });
    expect(isBonusArea(n)).toBe(true);
    expect(isBonusArea(mapPage('smb-4')!.nodes.find((x) => x.kind === 'bonus')!)).toBe(false);
    const road = w2().paths.find((p) => p.to === 'bonus-2')!;
    expect(road.from).toBe('2-1');
    expect(pathExit(w2(), road)).toBe('secret:bonus-2');
    const prog = {
      cleared: ['2-1'],
      pages: ['smb-1', 'smb-2'],
      secrets: [],
      position: { page: 'smb-2', node: '2-1' },
    };
    expect(isOpen(prog, w2(), 'bonus-2')).toBe(false);
    // Developer "Unlock all" does not show it either (bonus nodes need their key).
    expect(isOpen(prog, w2(), 'bonus-2', true)).toBe(false);
    expect(isOpen({ ...prog, secrets: ['bonus-2'] }, w2(), 'bonus-2')).toBe(true);
  });

  it('standing on it: its own icon, the hint line and the announcer name it; JUMP goes in (no WORLD card)', () => {
    const h = makeGame();
    onWorld2(h, { cleared: ['1-0', '1-1', '1-2', '1-3', '1-4', '2-1'], secrets: ['bonus-2'] });
    walkTo(h, 'bonus-2');
    expect(map(h).hintLine).toBe('TOP SECRET AREA');
    expect(h.said.at(-1)).toBe('Top Secret Area, open');
    expect(map(h).nodeLabel(node('bonus-2'))).toBe('Top Secret Area, open');
    expect(map(h).touchLabels().jump).toBe('ENTER');
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    h.idle(12);
    h.tap('jump');
    h.step();
    expect(h.top()).toBeInstanceOf(LevelScene);
    const scene = h.top() as LevelScene;
    expect(scene.level.id).toBe(TSA);
    expect(scene.world.time).toBeNull();
    expect(h.said).toContain('Top Secret Area.');
    expect(loadSave(1)?.position).toEqual({ page: 'smb-2', node: 'bonus-2' });
  });
});

/** A World in the Top Secret Area for `c` at `power` (1 or 2 players). */
function tsaWorld(c: CharacterDef = MARIO, power = 'small', c2: CharacterDef | null = null): World {
  const state = { ...newGameState(c), powerState: power, character2: c2 };
  const assets = new AssetRegistry({ default: {} });
  return new World(
    getLevel(TSA),
    { assets, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    state,
    {},
  );
}
const BLOCKS = [6, 7, 8, 9, 10];
/** Put player 1 standing on the way-home pipe (columns 13-14, its top on row 11). */
const onPipe = (w: World) => {
  const b = w.player.body;
  b.x = px(13 * 16 + 16) - (b.w >> 1);
  b.y = px(11 * 16) - b.h;
  b.vy = 0;
};
const items = (w: World) => w.entities.filter((e): e is PowerUp => e instanceof PowerUp && e.alive);

describe('the Top Secret Area', () => {
  it('one screen in the smw-secret look: five ? blocks, flower flower egg mushroom mushroom, a pipe home', () => {
    const l = getLevel(TSA);
    expect([l.width, l.camera, l.theme, l.music, l.bonus, l.parent]).toEqual([
      16,
      'locked',
      'smw-secret',
      'top-secret',
      true,
      null,
    ]);
    expect(BLOCKS.map((x) => tile(l, x, 9))).toEqual([
      T.Q_FLOWER,
      T.Q_FLOWER,
      T.Q_EGG,
      T.Q_MUSHROOM,
      T.Q_MUSHROOM,
    ]);
    expect(l.zones).toEqual([
      { kind: 'pipe', x: 13, y: 11, dir: 'down', target: { level: MAP_EXIT, x: 0, y: 0 } },
    ]);
    expect(l.decor.map((d) => d.kind)).toEqual(['smw-hill-big', 'smw-hill-small', 'smw-bush', 'smw-bush']);
    expect(levelIds()).toContain(TSA);
    expect(parseTextMap(serializeTextMap(l), TSA)).toEqual(l);
    // Its campaign variant is itself: nothing sleeps there.
    expect(campaignLevel(l)).toBe(l);
  });

  it.each(heroes)(
    '%s: the outer blocks give flower, flower, mushroom, mushroom whatever the power',
    (_n, c) => {
      for (const power of c.damage.kind === 'powerup' ? ['small', 'big'] : ['full']) {
        const w = tsaWorld(c, power);
        for (const x of [6, 7, 9, 10]) w.strikeBlock(x, 9, w.player, false);
        expect(items(w).map((p) => p.item)).toEqual(['flower', 'flower', 'mushroom', 'mushroom']);
        for (let i = 0; i < 20; i++) w.update([]);
        for (const x of BLOCKS) if (x !== 8) expect(w.map.get(x, 9)).toBe(T.USED);
      }
    },
  );

  it('the centre block: a Yoshi egg rises, wobbles, cracks and hatches a 1-up (Yoshi is not unlocked)', () => {
    const w = tsaWorld();
    w.strikeBlock(8, 9, w.player, false);
    const egg = w.entities.find((e): e is YoshiEgg => e instanceof YoshiEgg);
    expect(egg).toBeDefined();
    expect(egg?.phase).toBe('rise');
    for (let i = 0; i < EGG_RISE_FRAMES + 1; i++) w.update([]);
    expect(egg?.phase).toBe('wobble');
    expect(toPx((egg as YoshiEgg).body.y + (egg as YoshiEgg).body.h)).toBe(9 * 16);
    const frames = new Set<string>();
    while (egg?.alive && egg.phase === 'wobble') {
      frames.add(egg.frame());
      w.update([]);
    }
    expect([...frames].sort()).toEqual(['yoshi-egg', 'yoshi-egg-l', 'yoshi-egg-r']);
    expect(egg?.phase).toBe('crack');
    expect(egg?.frame()).toBe('yoshi-egg-crack');
    expect(items(w)).toHaveLength(0);
    for (let i = 0; i < EGG_HATCH_FRAME; i++) w.update([]);
    expect(egg?.alive).toBe(false);
    expect(items(w).map((p) => p.item)).toEqual(['1up']);
    expect(yoshiUnlocked(w)).toBe(false);
  });

  it('the hatch hook lets a 1-up hop out (the hook a later release turns into Yoshi)', () => {
    const w = tsaWorld();
    const out = hatch(w, w.player.body.x, w.player.body.y);
    expect(out).toBeInstanceOf(PowerUp);
    expect((out as PowerUp).item).toBe('1up');
    expect(out.body.vy).toBeLessThan(0);
  });

  it('small Mario: a flower makes him big, the 1-up from the egg is a life', () => {
    const w = tsaWorld();
    const take = (item: string) => {
      const got = items(w).find((i) => i.item === item) as PowerUp;
      w.player.body.x = got.body.x;
      w.player.body.y = got.body.y;
      for (let i = 0; i < 3; i++) w.update([]);
      expect(got.alive).toBe(false);
    };
    w.strikeBlock(6, 9, w.player, false);
    for (let i = 0; i < 40; i++) w.update([]);
    take('flower');
    expect(w.player.powerState).toBe('big');
    const lives = w.state.lives;
    w.strikeBlock(8, 9, w.player, false);
    // (Growing pauses the world for a moment, the egg too.)
    for (let i = 0; i < 400 && !items(w).some((p) => p.item === '1up'); i++) w.update([]);
    take('1up');
    expect(w.state.lives).toBe(lives + 1);
  });

  it('Link takes the flower and mushroom as his own powers (a sword beam, a heart container)', () => {
    const w = tsaWorld(LINK, 'full');
    const max = w.player.scratch.maxHp;
    w.player.def.behaviour.onPowerUp(w.player, 'flower', w);
    w.player.def.behaviour.onPowerUp(w.player, 'mushroom', w);
    expect(w.player.scratch.beam).toBe(1);
    expect(w.player.scratch.maxHp).not.toBe(max);
  });

  it('every visit the blocks are full again', () => {
    const w = tsaWorld();
    for (const x of BLOCKS) w.strikeBlock(x, 9, w.player, false);
    for (let i = 0; i < 40; i++) w.update([]);
    expect(BLOCKS.every((x) => w.map.get(x, 9) === T.USED)).toBe(true);
    const again = tsaWorld();
    expect(BLOCKS.map((x) => again.map.get(x, 9))).toEqual([
      T.Q_FLOWER,
      T.Q_FLOWER,
      T.Q_EGG,
      T.Q_MUSHROOM,
      T.Q_MUSHROOM,
    ]);
  });

  it('co-op: both players are there, and each block gives its item to whoever takes it', () => {
    const w = tsaWorld(MARIO, 'small', LUIGI);
    expect(w.players).toHaveLength(2);
    w.strikeBlock(10, 9, w.players[1]!, false);
    expect(items(w).map((p) => p.item)).toEqual(['mushroom']);
  });

  it('campaign: down the pipe is back on the map, on the node, nothing cleared; revisit any time', () => {
    const h = makeGame();
    onWorld2(h, { cleared: ['1-0', '1-1', '1-2', '1-3', '1-4', '2-1'], secrets: ['bonus-2'] });
    walkTo(h, 'bonus-2');
    for (let visit = 0; visit < 2; visit++) {
      const before = h.game.mapProgress.cleared.slice();
      h.idle(8);
      h.tap('jump');
      h.idle(12);
      h.tap('jump');
      h.step();
      const scene = h.top() as LevelScene;
      expect(scene.level.id).toBe(TSA);
      expect(BLOCKS.map((x) => scene.world.map.get(x, 9))).toEqual([
        T.Q_FLOWER,
        T.Q_FLOWER,
        T.Q_EGG,
        T.Q_MUSHROOM,
        T.Q_MUSHROOM,
      ]);
      // Bump one, then walk to the pipe and go down.
      scene.world.strikeBlock(9, 9, scene.world.player, false);
      onPipe(scene.world);
      holdUntil(h, ['down'], () => h.top() instanceof WorldMapScene, 400);
      expect(map(h).node).toBe('bonus-2');
      expect(h.game.mapProgress.cleared).toEqual(before);
      expect(h.game.mapProgress.cleared).not.toContain(TSA);
      expect(loadSave(1)?.position).toEqual({ page: 'smb-2', node: 'bonus-2' });
      h.until(() => map(h).mode === 'idle', 400);
    }
  });

  it('outside the campaign its pipe goes back to the title', () => {
    const h = makeGame();
    h.game.devStart(TSA, MARIO, 'small');
    h.until(() => h.top() instanceof LevelScene, 400);
    const scene = h.top() as LevelScene;
    expect(scene.world.time).toBeNull();
    onPipe(scene.world);
    holdUntil(h, ['down'], () => !(h.top() instanceof LevelScene), 400);
    expect(h.top()?.constructor.name).toBe('TitleScene');
  });
});

describe('save files never break', () => {
  it('an old file (no bonus-2) loads with the spot hidden; a new one round-trips its secret', () => {
    const h = makeGame();
    onWorld2(h, { cleared: ['1-0', '1-1', '1-2', '1-3', '1-4', '2-1'] });
    expect(isOpen(h.game.mapProgress, w2(), 'bonus-2')).toBe(false);
    const h2 = makeGame();
    onWorld2(h2, { cleared: ['1-0', '1-1', '1-2', '1-3', '1-4', '2-1'], secrets: ['bonus-2'] });
    expect(isOpen(h2.game.mapProgress, w2(), 'bonus-2')).toBe(true);
    expect(loadSave(1)?.secrets).toEqual(['bonus-2']);
    // A file saved standing on the Top Secret Area loads standing there.
    const h3 = makeGame();
    onWorld2(h3, {
      cleared: ['1-0', '1-1', '1-2', '1-3', '1-4', '2-1'],
      secrets: ['bonus-2'],
      position: { page: 'smb-2', node: 'bonus-2' },
    });
    expect(map(h3).node).toBe('bonus-2');
  });
});

describe('review fixes (0.4.10)', () => {
  it('a Moblin without a secret is left out (he would end the level with none); every bundled one has one', () => {
    const l = getLevel('2-1-cave');
    const bare: LevelData = {
      ...l,
      entities: l.entities.map((e) => (e.type === 'moblin' ? { ...e, props: { next: '2-2-intro' } } : e)),
    };
    const r = runSim({ level: bare, character: MARIO, script: { steps: [] }, maxFrames: 5 });
    expect(r.world.entities.some((e) => e instanceof Moblin)).toBe(false);
    for (const id of levelIds())
      for (const e of getLevel(id).entities)
        if (e.type === 'moblin')
          expect(typeof e.props?.secret === 'string' && e.props.secret !== '', id).toBe(true);
  });

  it("the Top Secret Area's HUD names it instead of WORLD 2-1, shows no TIME, and outlines its text on the cream sky", () => {
    expect(hudAreaLines('TOP SECRET AREA')).toEqual(['TOP SECRET', 'AREA']);
    expect(hudAreaLines('BONUS')).toEqual(['BONUS', '']);
    expect(LIGHT_SKIES.has('smw-secret')).toBe(true);
    expect(LIGHT_SKIES.has('overworld')).toBe(false);
    const h = makeGame();
    h.game.devStart(TSA, MARIO, 'small');
    h.until(() => h.top() instanceof LevelScene, 400);
    const strs = draw(h.top() as LevelScene).texts.map((t) => t.str);
    expect(strs).toContain('TOP SECRET');
    expect(strs).toContain('AREA');
    expect(strs).not.toContain('WORLD');
    expect(strs).not.toContain('TIME');
    // Each text is drawn five times: four dark outline passes, then the white letters.
    expect(strs.filter((t) => t === 'TOP SECRET')).toHaveLength(5);
    // A level with a normal sky keeps the plain HUD.
    const h2 = makeGame();
    h2.game.devStart('2-1', MARIO, 'small');
    h2.until(() => h2.top() instanceof LevelScene, 400);
    const plain = draw(h2.top() as LevelScene).texts.map((t) => t.str);
    expect(plain.filter((t) => t === 'WORLD')).toHaveLength(1);
  });
});
