import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLevel, levelIds } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { sfx as SFX_LIB } from '@content/sfx/sfx';
import { runSim } from '@game/sim/headless';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { SIMON } from '@game/characters/simon';
import { BILL } from '@game/characters/bill';
import { applyLook, blastArrow, campaignLevel } from '@game/level/campaign';
import { parseTextMap, serializeTextMap } from '@game/level/textmap';
import { isTheme, type LevelData, type Zone } from '@game/level/schema';
import { T, tileDef } from '@game/level/tiles';
import { World } from '@game/world/world';
import { Decoration } from '@game/entities/objects/decoration';
import { carryTime, LevelScene } from '@game/scenes/level';
import { WorldMapScene } from '@game/scenes/world-map';
import { captiveDialogue, CARD_COLS } from '@game/scenes/free-hero';
import { fontText } from '@game/hud/text';
import { hiddenHeroes, hiddenHeroesAt } from '@game/map/captives';
import type { MiniGameDef } from '@game/minigames';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NullRenderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { BLAST_LEAD, BridgeBlast, BridgeBoom, blastTimes } from '@game/entities/objects/bridge-blast';
import { jungleDecorFrames } from '@content/sprites/contra-decor';
import { captives, closeCards, file, makeGame, useStorage, type H } from './heroes-harness';
import { FALLS, ROUTE, fallsBot, standingOn, walkRight, type Ledge } from './falls-bot';

// Bill Rizer, hidden under 7-3 (owner design, 0.4.9 batch, B1): in campaign play 7-3 looks like a
// Contra jungle stage (the same layout), and the girder bridge just past the checkpoint (128-142)
// is marked: a hero stepping on sets off a chain of explosions, Contra style. Falling through the
// gap drops into Bill's jungle camp (7-3-camp), whose cave leads into a waterfall climb
// (7-3-falls) back up into 7-3 at column 199, past the bridge. Outside the campaign 7-3 is exactly
// v0.4.8's (tests/sim/fixtures/7-3-v0.4.8.map).

useStorage();

const none = { steps: [{ frame: 0, hold: [] as Action[] }] };
const raw = () => getLevel('7-3');
const camp7 = () => campaignLevel(getLevel('7-3'));
const v048 = () =>
  parseTextMap(readFileSync(join(import.meta.dirname, 'fixtures', '7-3-v0.4.8.map'), 'utf8'), '7-3');
const tile = (l: { tiles: Uint16Array; width: number }, x: number, y: number) => l.tiles[y * l.width + x];

/** The marked bridge: columns 128-142 on row 10, walled by the pillars at 127 and 143. */
const BRIDGE = { x: 128, w: 15, y: 10 };
const INTO_CAMP = { level: '7-3-camp', x: 2, y: 0, exitDir: 'fall' };
const INTO_FALLS = { level: '7-3-falls', x: 1, y: 29 };
const BACK_TO_7_3 = { level: '7-3', x: 199, y: 12, exitDir: 'climb' };
const BILL_AT = { x: 5, y: 12 };
const ON_PILLAR = { x: 127, y: 9, mode: 'stand' as const, time: 300 };

const blast = (w: World) => w.entities.find((e): e is BridgeBlast => e instanceof BridgeBlast);
const bridgeCells = (w: World) =>
  Array.from({ length: BRIDGE.w }, (_, k) => w.map.get(BRIDGE.x + k, BRIDGE.y));
const pits = (zones: Zone[]) => zones.filter((z): z is Zone & { kind: 'pit' } => z.kind === 'pit');
const heroes = CHARACTERS.map((c) => [c.name, c] as const);
const powers = ['small', 'big'] as const;

describe('7-3 outside the campaign is v0.4.8 tile for tile and in look', () => {
  it('the same tiles, theme, music, decor, start, zones and entities (the campaign-only ones sleep)', () => {
    const l = raw();
    const old = v048();
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
    expect([l.theme, l.music]).toEqual(['overworld', 'overworld']);
    expect(l.decor).toEqual(old.decor);
    expect(l.zones.filter((z) => !('campaign' in z && z.campaign))).toEqual(old.zones);
    expect(l.entities.filter((e) => e.props?.campaign !== true)).toEqual(old.entities);
    // What sleeps: the bridge's blast and its pit (and, from 0.4.13, Lance at the start:
    // tests/sim/partners.test.ts).
    expect(l.entities.filter((e) => e.props?.campaign === true)).toEqual([
      { type: 'partner', x: 5, y: 12, props: { who: 'lance', campaign: true } },
      { type: 'bridge-blast', x: 128, y: 10, props: { w: 15, campaign: true } },
    ]);
    expect(pits(l.zones)).toEqual([
      { kind: 'pit', x: 128, w: 15, target: { level: '7-3-camp', x: 2, y: 0 }, campaign: true },
    ]);
  });

  it('a World of plain 7-3 draws it as before: overworld theme and music, clouds, no blast', () => {
    const r = runSim({ level: raw(), character: MARIO, script: none, start: ON_PILLAR, maxFrames: 30 });
    const w = r.world;
    expect([w.level.theme, w.level.music]).toEqual(['overworld', 'overworld']);
    expect(blast(w)).toBeUndefined();
    const kinds = w.entities.filter((e): e is Decoration => e instanceof Decoration).map((e) => e.name);
    expect(kinds.some((k) => k.startsWith('cloud'))).toBe(true);
    expect(kinds.some((k) => ['canopy', 'palm', 'mountain'].includes(k))).toBe(false);
  });

  it('the bridge is a plain bridge: standing on it and walking across it, nothing blows', () => {
    const r = runSim({
      level: raw(),
      character: MARIO,
      // (The Paratroopa over it is not what this is about.)
      assist: { invulnerable: true },
      script: none,
      start: { x: 130, y: 9, mode: 'stand', time: 300 },
      maxFrames: 400,
    });
    expect(r.outcome).toBe('timeout');
    expect(bridgeCells(r.world).every((t) => t === T.BRIDGE)).toBe(true);
    expect(r.world.entities.some((e) => e instanceof BridgeBoom)).toBe(false);
  });

  it("a fall into the bridge's columns kills (the pit sleeps)", () => {
    const r = runSim({
      level: raw(),
      character: MARIO,
      script: none,
      start: { x: 135, y: 12, mode: 'stand', time: 300 },
      maxFrames: 300,
    });
    expect(r.outcome).toBe('died');
    expect(r.events.some((e) => e.type === 'pipe')).toBe(false);
  });
});

describe('the campaign variant of 7-3', () => {
  it('wakes the pit and the blast; the only new tiles are the coin arrow, so the collision is the same', () => {
    const l = camp7();
    const base = raw();
    expect(pits(l.zones)).toEqual([
      { kind: 'pit', x: 128, w: 15, target: { level: '7-3-camp', x: 2, y: 0 } },
    ]);
    expect(l.entities.filter((e) => e.type === 'bridge-blast')).toEqual([
      { type: 'bridge-blast', x: 128, y: 10, props: { w: 15 } },
    ]);
    const arrow = blastArrow({ type: 'bridge-blast', x: 128, y: 10 });
    expect(arrow).toEqual([
      [130, 4],
      [130, 5],
      [128, 6],
      [129, 6],
      [130, 6],
      [131, 6],
      [132, 6],
      [129, 7],
      [130, 7],
      [131, 7],
      [130, 8],
    ]);
    const changed: [number, number][] = [];
    for (let y = 0; y < l.height; y++)
      for (let x = 0; x < l.width; x++) {
        const a = tile(base, x, y) as number;
        const b = tile(l, x, y) as number;
        expect(tileDef(b).collision, `${x},${y}`).toBe(tileDef(a).collision);
        if (a !== b) changed.push([x, y]);
      }
    expect(changed.sort((p, q) => p[1] - q[1] || p[0] - q[0])).toEqual(
      [...arrow].sort((p, q) => p[1] - q[1] || p[0] - q[0]),
    );
    for (const [x, y] of arrow) expect(tile(l, x, y)).toBe(T.COIN);
    // Every other zone and entity as they were (Lance, a story partner, woken too).
    expect(l.zones.filter((z) => z.kind !== 'pit')).toEqual(base.zones.filter((z) => z.kind !== 'pit'));
    const other = (e: { type: string }) => e.type !== 'bridge-blast' && e.type !== 'partner';
    expect(l.entities.filter(other)).toEqual(base.entities.filter(other));
    expect(l.entities.filter((e) => e.type === 'partner')).toEqual([
      { type: 'partner', x: 5, y: 12, props: { who: 'lance' } },
    ]);
    expect(camp7()).toBe(l); // cached
  });

  it("is a Contra jungle stage: B3's contra-jungle theme and music, a hanging canopy, mountains and palms", () => {
    const l = camp7();
    const look = getLevel('7-3').campaignLook;
    expect(look?.theme).toBe('contra-jungle');
    expect(look?.music).toBe('contra-jungle');
    const kinds = new Set(look?.decor?.map((d) => d.kind));
    for (const k of ['canopy-hang', 'palm', 'mountain']) expect(kinds.has(k), k).toBe(true);
    // The hanging canopy is one ceiling, a piece every 2 columns along the top across the level.
    expect(look?.decor?.filter((d) => d.kind === 'canopy-hang').map((d) => [d.x, d.y])).toEqual(
      Array.from({ length: 120 }, (_, i) => [i * 2, 0]),
    );
    // NES Contra's black night has no clouds: the jungle look leaves the level's clouds out.
    expect(look?.decor?.filter((d) => d.kind.startsWith('cloud'))).toEqual([]);
    // A band of palms and undergrowth along the ground and tree tops, each piece on solid ground
    // (both its columns) with two clear rows over it.
    const band = look?.decor?.filter((d) => d.kind.startsWith('jungle-band')) ?? [];
    expect(band.length).toBeGreaterThan(10);
    for (const d of band)
      for (let c = 0; c < (d.kind === 'jungle-band' ? 2 : 1); c++) {
        expect(tileDef(tile(raw(), d.x + c, d.y + 1) as number).collision, `band ${d.x + c}`).toBe('solid');
        expect(tile(raw(), d.x + c, d.y), `band ${d.x + c}`).toBe(T.AIR);
      }
    // Palms stand on ground (or a tree platform), the row below their foot solid.
    for (const d of look?.decor?.filter((x) => x.kind === 'palm') ?? [])
      expect(tileDef(tile(raw(), d.x + 1, d.y + 1) as number).collision, `palm ${d.x}`).toBe('solid');
    expect(isTheme('contra-jungle')).toBe(true);
    expect([l.theme, l.music]).toEqual(['contra-jungle', 'contra-jungle']);
    expect(l.decor).toEqual(look?.decor);
  });
});

describe('the campaign look hook (LevelData.campaignLook)', () => {
  const src = (extra: string[], decor: string[] = []) =>
    [
      'id: 9-9',
      'theme: overworld',
      'music: overworld',
      'start: 1,12',
      ...extra,
      '[tiles]',
      ...Array.from({ length: 13 }, () => '................'),
      '################',
      '################',
      '[decor]',
      'cloud-1 3 4',
      ...decor,
    ].join('\n');

  it('parses campaignTheme, campaignMusic and [campaign-decor], and writes them back', () => {
    const l = parseTextMap(
      src(['campaignTheme: night', 'campaignMusic: castle'], ['[campaign-decor]', 'canopy 3 4', 'palm 7 14']),
    );
    expect(l.campaignLook).toEqual({
      theme: 'night',
      music: 'castle',
      decor: [
        { kind: 'canopy', x: 3, y: 4 },
        { kind: 'palm', x: 7, y: 14 },
      ],
    });
    expect(l.decor).toEqual([{ kind: 'cloud-1', x: 3, y: 4 }]);
    expect(parseTextMap(serializeTextMap(l)).campaignLook).toEqual(l.campaignLook);
    expect(parseTextMap(src([])).campaignLook).toBeUndefined();
    expect(parseTextMap(src(['campaignTheme: night'])).campaignLook).toEqual({ theme: 'night' });
  });

  it('music or decor without a theme is an error', () => {
    expect(() => parseTextMap(src(['campaignMusic: castle']))).toThrow(/campaignTheme/);
    expect(() => parseTextMap(src([], ['[campaign-decor]', 'palm 1 14']))).toThrow(/campaignTheme/);
  });

  it('applies the theme, the music once registered, and the decor; tiles, zones and entities stay', () => {
    const l = parseTextMap(
      src(['campaignTheme: night', 'campaignMusic: castle'], ['[campaign-decor]', 'canopy 3 4']),
    );
    const out = applyLook(l);
    expect(out.theme).toBe('night');
    expect(out.music).toBe('castle');
    expect(out.decor).toEqual([{ kind: 'canopy', x: 3, y: 4 }]);
    expect(out.tiles).toBe(l.tiles);
    expect(out.zones).toBe(l.zones);
    expect(out.entities).toBe(l.entities);
    // The level itself is untouched.
    expect([l.theme, l.music]).toEqual(['overworld', 'overworld']);
    // A song not registered yet: the level's own music plays on.
    expect(applyLook(l, { theme: isTheme, music: () => false }).music).toBe('overworld');
    // Through campaignLevel too (a level with nothing else for the campaign).
    expect(campaignLevel(l, () => true).theme).toBe('night');
  });

  it('a look whose theme is not registered yet is left out entirely (nothing throws)', () => {
    const l = parseTextMap(
      src(['campaignTheme: lava-land', 'campaignMusic: lava-song'], ['[campaign-decor]', 'palm 3 14']),
    );
    expect(applyLook(l)).toBe(l);
    const c = campaignLevel(l, () => true);
    expect([c.theme, c.music, c.decor]).toEqual(['overworld', 'overworld', l.decor]);
    const assets = new AssetRegistry(PALETTES);
    assets.defineAll(SPRITES);
    const w = new World(
      c,
      { assets, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST }, reduceFlashing: false },
      newGameState(MARIO),
      { seed: 1 },
    );
    expect(() => {
      w.update([]);
      w.render(new NullRenderer());
    }).not.toThrow();
  });

  it("7-3 came first; 0.4.12's hero tributes and their coin heavens have looks too, World 2's Hyrule (0.4.24) and World 3's Mega Man looks (0.4.26), nothing else", () => {
    const hyrule = ['2-1-bonus', '2-1-cave', '2-2-intro', '2-2', '2-2-exit', '2-3', '2-4'];
    // World 3 as Mega Man's world (0.4.26).
    const megaman = ['3-1-bonus', '3-2', '3-3', '3-4'];
    expect(
      levelIds()
        .filter((id) => getLevel(id).campaignLook)
        .sort(),
    ).toEqual(
      [
        '2-1',
        '2-1-sky',
        '2-1-sky2',
        '3-1',
        '3-1-sky',
        '4-2',
        '5-4',
        '6-2',
        '6-2-sky',
        '7-3',
        ...hyrule,
        ...megaman,
      ].sort(),
    );
  });
});

describe('the pit zone: a column range, campaign only', () => {
  it('parses `pit x -> level x y w=N campaign` and writes it back', () => {
    const l = parseTextMap(
      [
        'id: 9-9',
        'start: 1,12',
        '[tiles]',
        ...Array.from({ length: 15 }, () => '................'),
        '[zones]',
        'pit 4 -> t 2 0 w=3 campaign',
        'pit 9 -> t 2 0 w=2',
        'pit 12 -> t 2 0',
      ].join('\n'),
    );
    expect(pits(l.zones)).toEqual([
      { kind: 'pit', x: 4, w: 3, target: { level: 't', x: 2, y: 0 }, campaign: true },
      { kind: 'pit', x: 9, w: 2, target: { level: 't', x: 2, y: 0 } },
      { kind: 'pit', x: 12, target: { level: 't', x: 2, y: 0 } },
    ]);
    expect(pits(parseTextMap(serializeTextMap(l)).zones)).toEqual(pits(l.zones));
    expect(() =>
      parseTextMap(
        [
          'id: 9-9',
          '[tiles]',
          ...Array.from({ length: 15 }, () => '....'),
          '[zones]',
          'pit 1 -> t 2 0 w=0',
        ].join('\n'),
      ),
    ).toThrow(/whole number/);
  });

  it('a fall anywhere else in campaign 7-3 still kills: under the other bridges, past the pillar at 143', () => {
    for (const [x, y] of [
      [50, 11],
      [20, 11],
      [144, 9],
      [160, 11],
    ] as const) {
      const r = runSim({
        level: camp7(),
        character: MARIO,
        script: none,
        start: { x, y, mode: 'stand', time: 300 },
        maxFrames: 300,
      });
      expect(r.outcome, `${x}`).toBe('died');
      expect(r.events.some((e) => e.type === 'pipe')).toBe(false);
    }
  });
});

/**
 * Runs right from rest on the pillar at 127 until clear of the bridge (on or past the pillar at
 * 143). `gaps()`: at each blast while the hero is still on the bridge, the px between its heels
 * (its body's left edge) and the blown gap's far end (how much to spare).
 */
function outrun(c: (typeof CHARACTERS)[number], power: string, hold: Action[]) {
  let fell = false;
  const gaps: number[] = [];
  let seen = 0;
  return {
    r: runSim({
      level: camp7(),
      character: c,
      state: { powerState: power },
      // The Paratroopa over the bridge is not what this is about (a hit's knockback costs the run).
      assist: { invulnerable: true },
      script: none,
      start: ON_PILLAR,
      maxFrames: 600,
      controller: (w, f) => {
        const p = w.player.body;
        if (toPx(p.y) > BRIDGE.y * 16) fell = true;
        const b = blast(w);
        if (b && b.blown > seen && p.onGround && toPx(p.x) < (BRIDGE.x + BRIDGE.w) * 16)
          gaps.push(toPx(p.x) - (BRIDGE.x + b.blown) * 16);
        seen = b?.blown ?? 0;
        return f < 5 ? [] : hold;
      },
      until: (w) => toPx(w.player.body.x) >= (BRIDGE.x + BRIDGE.w) * 16 && w.player.body.onGround,
    }),
    fell: () => fell,
    gaps: () => gaps,
  };
}

describe('the exploding bridge (campaign)', () => {
  it('the chain chases a ghost of the hero: up to its top speed, BLAST_LEAD px behind', () => {
    for (const c of CHARACTERS) {
      const m = c.movement;
      const times = blastTimes(m, BRIDGE.w);
      expect(times, c.name).toHaveLength(BRIDGE.w);
      for (let k = 1; k < times.length; k++) expect(times[k], c.name).toBeGreaterThan(times[k - 1] as number);
      // Once up to speed, a segment every 16 px of the hero's top speed (whole frames).
      const top = m.canRun ? m.maxRun : m.maxWalk;
      const last = (times[14] as number) - (times[9] as number);
      expect(Math.abs(last - (5 * 16 * 4096) / top), c.name).toBeLessThanOrEqual(1);
      // Already at top speed when stepping on: no wind-up, that pace from the first segment.
      const flying = blastTimes(m, BRIDGE.w, top);
      expect(flying[0], c.name).toBe(Math.ceil(((16 + BLAST_LEAD) * 4096) / top));
      expect(flying[14], c.name).toBeLessThanOrEqual(times[14] as number);
    }
    expect(blastTimes(MARIO.movement, BRIDGE.w)).toEqual([
      39, 46, 52, 59, 65, 71, 77, 84, 90, 96, 102, 109, 115, 121, 127,
    ]);
    expect(blastTimes(SIMON.movement, BRIDGE.w)).toEqual(Array.from({ length: 15 }, (_, k) => 48 + 16 * k));
    const r = runSim({
      level: camp7(),
      character: MARIO,
      script: none,
      start: { x: 130, y: 9, mode: 'stand', time: 300 },
      maxFrames: 400,
      controller: (w) => {
        // Set off, then out of the way onto the pillar at 143 to watch.
        const p = w.player.body;
        if (blast(w)?.state === 'blowing' && toPx(p.x) < 143 * 16) {
          p.x = px(143 * 16 + 2);
          p.y = px(BRIDGE.y * 16) - p.h;
          p.vx = 0;
        }
        return [];
      },
      until: (w) => blast(w)?.state === 'gone',
    });
    expect(r.outcome).toBe('stopped');
    const b = blast(r.world) as BridgeBlast;
    // Mario stood still: the chain chases his ghost from rest.
    expect(b.times).toEqual(blastTimes(MARIO.movement, BRIDGE.w));
    expect(b.dir).toBe(1);
    expect([0, 1, 14].map((k) => [b.column(k), b.blowAt(k)])).toEqual([
      [128, 39],
      [129, 46],
      [142, 127],
    ]);
    expect(bridgeCells(r.world).every((t) => t === T.AIR)).toBe(true);
  });

  it.each(heroes)('%s, standing still on it, falls through into the camp', (_n, c) => {
    for (const power of powers) {
      const r = runSim({
        level: camp7(),
        character: c,
        state: { powerState: power },
        script: none,
        start: { x: 130, y: 9, mode: 'stand', time: 300 },
        maxFrames: 400,
      });
      expect(r.outcome, `${c.name} ${power}`).toBe('pipe');
      expect(r.events.find((e) => e.type === 'pipe')).toEqual({ type: 'pipe', target: INTO_CAMP });
      expect(r.world.player.dead).toBe(false);
      expect(r.events.some((e) => e.type === 'died')).toBe(false);
    }
  });

  it.each(heroes)(
    '%s, running from rest on the pillar at 127, just about outruns the chain (8-25 px to spare)',
    (_n, c) => {
      for (const power of powers) {
        const { r, fell, gaps } = outrun(c, power, ['right', 'run']);
        expect(r.outcome, `${c.name} ${power}`).toBe('stopped');
        expect(fell(), `${c.name} ${power}`).toBe(false);
        const b = blast(r.world) as BridgeBlast;
        expect(b.state, c.name).toBe('blowing');
        // Hard on its heels the whole way, at every blast (QA 0.4.9: the old pacing left 40-80 px
        // by the far pillar).
        expect(gaps().length, `${c.name} ${power}`).toBeGreaterThanOrEqual(BRIDGE.w - 2);
        expect(Math.min(...gaps()), `${c.name} ${power}`).toBeGreaterThanOrEqual(8);
        expect(Math.max(...gaps()), `${c.name} ${power}`).toBeLessThanOrEqual(25);
        expect(b.blown, c.name).toBeGreaterThanOrEqual(BRIDGE.w - 2);
      }
    },
  );

  it.each([MARIO, LUIGI].map((c) => [c.name, c] as const))(
    '%s walking (not running) is caught and drops into the camp',
    (_n, c) => {
      const { r } = outrun(c, 'small', ['right']);
      expect(r.outcome).toBe('pipe');
      expect(r.events.find((e) => e.type === 'pipe')).toEqual({ type: 'pipe', target: INTO_CAMP });
    },
  );

  it.each(heroes)(
    '%s steps on from the right end: the chain runs from there; once it is gone, a drop into the gap leads to the camp',
    (_n, c) => {
      let phase: 'step' | 'back' | 'wait' | 'drop' = 'step';
      const r = runSim({
        level: camp7(),
        character: c,
        // A long wait beside the Paratroopa and the Cheep Cheeps: they are not what this is about.
        assist: { invulnerable: true },
        script: none,
        start: { x: 143, y: 9, mode: 'stand', time: 300 },
        maxFrames: 1200,
        controller: (w) => {
          const b = blast(w);
          if (phase === 'step') {
            if (b?.state === 'blowing') phase = 'back';
            return ['left'];
          }
          if (phase === 'back') {
            // Back onto the pillar (its middle), then stand there.
            if (toPx(w.player.centerX) >= 143 * 16 + 5 && w.player.body.onGround) phase = 'wait';
            return ['right'];
          }
          if (phase === 'wait') {
            if (b?.state === 'gone') phase = 'drop';
            return [];
          }
          return ['left'];
        },
      });
      const b = blast(r.world) as BridgeBlast;
      expect(b.dir, c.name).toBe(-1);
      expect(b.column(0)).toBe(142);
      expect(phase, c.name).toBe('drop');
      expect(bridgeCells(r.world).every((t) => t === T.AIR)).toBe(true);
      expect(r.outcome, c.name).toBe('pipe');
      expect(r.events.find((e) => e.type === 'pipe')).toEqual({ type: 'pipe', target: INTO_CAMP });
    },
  );

  it('a hero who lands facing backwards still sets the chain off from the end of its half', () => {
    for (const [x, facing, dir, first] of [
      [130, -1, 1, 128],
      [140, 1, -1, 142],
    ] as const) {
      const r = runSim({
        level: camp7(),
        character: MARIO,
        script: none,
        start: { x, y: 9, mode: 'stand', time: 300 },
        maxFrames: 10,
        controller: (w) => {
          w.player.facing = facing;
          return [];
        },
        until: (w) => blast(w)?.state === 'blowing',
      });
      const b = blast(r.world) as BridgeBlast;
      expect(r.world.player.facing).toBe(facing);
      expect(b.dir, `${x}`).toBe(dir);
      expect(b.column(0), `${x}`).toBe(first);
    }
  });

  it('co-op: the chain is paced for the slower hero, and both players drop into the camp', () => {
    const r = runSim({
      level: camp7(),
      character: MARIO,
      state: { character2: SIMON, powerState2: 'small', hp2: 0 },
      script: none,
      start: { x: 130, y: 9, mode: 'stand', time: 300 },
      maxFrames: 400,
    });
    expect(r.world.players).toHaveLength(2);
    expect(blast(r.world)?.times).toEqual(blastTimes(SIMON.movement, BRIDGE.w));
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({ type: 'pipe', target: INTO_CAMP });
    expect(r.world.players.every((p) => !p.dead)).toBe(true);
  });

  it('comes back whole on re-entry or a respawn (a fresh World)', () => {
    const level = camp7();
    const first = runSim({
      level,
      character: MARIO,
      script: none,
      start: { x: 130, y: 9, mode: 'stand', time: 300 },
      maxFrames: 400,
    });
    expect(bridgeCells(first.world).some((t) => t === T.AIR)).toBe(true);
    for (let k = 0; k < BRIDGE.w; k++) expect(tile(level, BRIDGE.x + k, BRIDGE.y)).toBe(T.BRIDGE);
    const again = runSim({ level, character: MARIO, script: none, start: ON_PILLAR, maxFrames: 2 });
    expect(bridgeCells(again.world).every((t) => t === T.BRIDGE)).toBe(true);
    expect(blast(again.world)?.state).toBe('armed');
  });

  it("draws the contra sheet's girders with the lamp, B3's booms, and booms with bridge-boom", () => {
    const sfx = vi.fn();
    const assets = new AssetRegistry(PALETTES);
    assets.defineAll(SPRITES);
    for (const reduceFlashing of [true, false]) {
      const w = new World(
        camp7(),
        { assets, audio: { ...NULL_AUDIO, sfx }, assist: { ...DEFAULT_ASSIST }, reduceFlashing },
        newGameState(MARIO),
        { x: 130, y: 9, mode: 'stand', time: 300, seed: 1 },
      );
      const frames = new Map<string, Set<string>>();
      const rec = Object.assign(new NullRenderer(), {
        sprite(sheet: { id: string }, frame: string) {
          const s = frames.get(sheet.id) ?? new Set<string>();
          s.add(frame);
          frames.set(sheet.id, s);
        },
      });
      for (let f = 0; f < 80; f++) {
        w.update([]);
        w.render(rec);
      }
      const contra = [...(frames.get('contra') ?? [])];
      expect(contra).toContain('blast-bridge-0');
      // With reduce flashing the lamp stays lit (no blink).
      expect(contra.includes('blast-bridge-1')).toBe(!reduceFlashing && w.frame > 32);
      expect(contra.some((f) => f.startsWith('boom-'))).toBe(true);
      expect(w.entities.some((e) => e instanceof BridgeBoom)).toBe(true);
    }
    expect(sfx).toHaveBeenCalledWith('bridge-boom');
    expect(SFX_LIB.some((s) => s.id === 'bridge-boom')).toBe(true);
  });
});

describe("Bill's jungle camp (7-3-camp)", () => {
  const camp = () => getLevel('7-3-camp');

  it('an area of 7-3 that keeps the clock, dropped into from above, one locked screen', () => {
    const l = camp();
    expect(l.parent).toBe('7-3');
    expect(l.time).toBeNull();
    expect([l.world, l.stage]).toEqual([7, 3]);
    expect(l.startMode).toBe('fall');
    expect(l.start).toEqual({ x: 2, y: 0 });
    expect(l.camera).toBe('locked');
    expect(carryTime(raw(), l, 250)).toBe(250);
    for (let y = 0; y < 2; y++) for (let x = 0; x < l.width; x++) expect(tile(l, x, y)).toBe(T.AIR);
  });

  it('Bill by his sandbags under the searchlight, the river, the cave into the falls', () => {
    const l = camp();
    expect(l.entities).toEqual([{ type: 'captive', x: BILL_AT.x, y: BILL_AT.y, props: { hero: 'bill' } }]);
    expect(tile(l, BILL_AT.x, BILL_AT.y + 1)).toBe(T.GROUND);
    expect(l.decor.map((d) => d.kind)).toEqual(
      expect.arrayContaining(['sandbags', 'searchlight', 'palm', 'canopy']),
    );
    // A shallow river: water one tile deep over the ground.
    for (const x of [8, 9, 10]) {
      expect(tile(l, x, 13)).toBe(T.WATER);
      expect(tile(l, x, 14)).toBe(T.GROUND);
    }
    expect(l.zones).toEqual([{ kind: 'pipe', x: 16, y: 11, dir: 'right', target: INTO_FALLS }]);
    // The arrival column is open from the top to the ground.
    for (let y = 0; y < 13; y++) expect(tile(l, 2, y)).toBe(T.AIR);
  });

  it.each(heroes)('%s drops in, reaches Bill and walks on into the cave: the waterfall climb', (_n, c) => {
    for (const power of powers) {
      let reached = false;
      const hop = walkRight();
      const r = runSim({
        level: campaignLevel(camp()),
        character: c,
        state: { powerState: power },
        script: none,
        start: { time: 250, clearEnemies: 'keep-piranhas' },
        maxFrames: 900,
        controller: (w) => {
          const b = w.player.body;
          if (b.onGround && Math.abs(toPx(w.player.centerX) - (BILL_AT.x * 16 + 8)) < 24) reached = true;
          return hop(w);
        },
      });
      expect(reached, `${c.name} ${power} beside Bill`).toBe(true);
      expect(r.outcome, `${c.name} ${power}`).toBe('pipe');
      expect(r.events.find((e) => e.type === 'pipe')).toEqual({ type: 'pipe', target: INTO_FALLS });
      expect(r.world.player.dead).toBe(false);
    }
  });

  it('co-op: both players drop into the camp onto the ground, on screen, out of the walls', () => {
    for (const c of CHARACTERS) {
      const r = runSim({
        level: camp(),
        character: MARIO,
        state: { character2: c, powerState2: 'small', hp2: 0 },
        script: none,
        start: { time: 250 },
        maxFrames: 120,
      });
      expect(r.world.players, c.name).toHaveLength(2);
      for (const p of r.world.players) {
        expect(p.dead).toBe(false);
        expect(p.body.onGround, `${c.name} P${p.index + 1}`).toBe(true);
        expect(toPx(p.body.y + p.body.h)).toBe(13 * 16);
        expect(toPx(p.body.x)).toBeGreaterThanOrEqual(0);
        expect(toPx(p.body.x + p.body.w)).toBeLessThanOrEqual(256);
      }
    }
  });
});

/** Puts player 1 on `l` (its middle) and lets it land. */
function onLedge(w: World, l: Ledge): void {
  const b = w.player.body;
  b.x = px(((l.x0 + l.x1 + 1) * 16) / 2) - (b.w >> 1);
  b.y = px(l.row * 16) - b.h;
  b.vx = 0;
  b.vy = 0;
}

describe('the waterfall climb (7-3-falls)', () => {
  const falls = () => getLevel('7-3-falls');

  it('an area of 7-3 that keeps the clock: two screens tall, a free camera, the climb from the pool', () => {
    const l = falls();
    expect(l.parent).toBe('7-3');
    expect(l.time).toBeNull();
    expect([l.world, l.stage]).toEqual([7, 3]);
    expect(l.camera).toBe('free');
    expect(l.height).toBe(32);
    expect(l.width).toBe(16);
    expect(l.start).toEqual({ x: INTO_FALLS.x, y: INTO_FALLS.y });
    expect(l.startMode).toBe('stand');
    expect(l.zones).toEqual([{ kind: 'vine', x: 1, y: 5, target: { level: '7-3', x: 199, y: 12 } }]);
    expect(l.entities).toEqual([
      { type: 'vine', x: 14, y: 20, props: { len: 12 } },
      { type: 'vine', x: 1, y: 5, props: { len: 8 } },
    ]);
  });

  it('a closed shaft: walls both sides, a floor under it all, the ledges where the route says', () => {
    const l = falls();
    for (let y = 2; y < l.height; y++) {
      expect(tile(l, 0, y)).toBe(T.GROUND);
      expect(tile(l, 15, y)).toBe(T.GROUND);
    }
    for (let x = 0; x < l.width; x++) expect(tile(l, x, 30)).toBe(T.GROUND);
    for (const ledge of Object.values(FALLS).filter((f) => f !== FALLS.floor))
      for (let x = ledge.x0; x <= ledge.x1; x++)
        expect(tile(l, x, ledge.row), `${x},${ledge.row}`).toBe(T.TREE_TOP);
  });

  it('every jump is three rows up and one tile across, with nothing over its take-off for 8 rows', () => {
    const l = falls();
    for (const leg of ROUTE) {
      // (From the floor any spot will do: it runs under the whole climb.)
      if (!('jump' in leg) || leg.from === FALLS.floor) continue;
      const { from, jump: to } = leg;
      expect(from.row - to.row).toBe(3);
      const gap = to.x0 > from.x1 ? to.x0 - from.x1 - 1 : from.x0 - to.x1 - 1;
      expect(gap).toBeLessThanOrEqual(1);
      const cols =
        to.x0 > from.x1 ? [from.x1 - 1, from.x1, from.x1 + 1] : [from.x0 - 1, from.x0, from.x0 + 1];
      for (const x of cols)
        for (let y = from.row - 8; y < from.row; y++) {
          const isTarget = y === to.row && x >= to.x0 && x <= to.x1;
          if (!isTarget) expect(tileDef(tile(l, x, y) as number).collision, `${x},${y}`).not.toBe('solid');
        }
    }
  });

  it.each(heroes)('%s climbs from the pool to the top and out into 7-3 (small and big)', (_n, c) => {
    for (const power of powers) {
      const bot = fallsBot();
      const seen = new Set<Ledge>();
      const r = runSim({
        level: campaignLevel(falls()),
        character: c,
        state: { powerState: power },
        script: none,
        start: { time: 250 },
        maxFrames: 3000,
        controller: (w) => {
          const on = standingOn(w.player);
          if (on) seen.add(on);
          return bot(w);
        },
      });
      expect(r.outcome, `${c.name} ${power}`).toBe('pipe');
      expect(r.events.find((e) => e.type === 'pipe')).toEqual({ type: 'pipe', target: BACK_TO_7_3 });
      for (const l of [FALLS.floor, FALLS.a1, FALLS.a2, FALLS.b1, FALLS.b2, FALLS.b3])
        expect(seen.has(l), `${c.name} ${power} stood on ${l.x0},${l.row}`).toBe(true);
      expect(r.world.time).toBeLessThanOrEqual(250);
    }
  });

  it.each(heroes)('%s gets out from any ledge (nobody gets stuck)', (_n, c) => {
    for (const ledge of Object.values(FALLS)) {
      const bot = fallsBot();
      const r = runSim({
        level: falls(),
        character: c,
        script: none,
        start: { time: 250 },
        maxFrames: 3000,
        controller: (w, f) => {
          if (f === 0) onLedge(w, ledge);
          return f < 2 ? [] : bot(w);
        },
      });
      expect(r.outcome, `${c.name} from ${ledge.x0},${ledge.row}`).toBe('pipe');
    }
  });

  it("co-op: the camp's cave takes both players in; both climb, and the first off the top takes both out", () => {
    const r = runSim({
      level: falls(),
      character: MARIO,
      state: { character2: BILL, powerState2: 'small', hp2: 0 },
      script: none,
      start: { time: 250 },
      maxFrames: 3000,
      controller: fallsBot(0),
    });
    expect(r.world.players).toHaveLength(2);
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({ type: 'pipe', target: BACK_TO_7_3 });
  });

  it.each(heroes)('%s climbs out into 7-3 at 199, onto the tree platform past the bridge', (_n, c) => {
    for (const level of [camp7(), raw()]) {
      const r = runSim({
        level,
        character: c,
        script: none,
        start: { x: 199, y: 12, mode: 'climb', time: 200 },
        maxFrames: 400,
      });
      const b = r.world.player.body;
      expect(r.world.player.dead, c.name).toBe(false);
      expect(b.onGround, c.name).toBe(true);
      expect(toPx(b.y + b.h), c.name).toBe(13 * 16);
      expect(toPx(b.x) >> 4, c.name).toBeGreaterThanOrEqual(199);
      expect(r.world.time).toBeLessThanOrEqual(200);
    }
  });

  it('co-op: both players climb out into 7-3 and land on the tree platform', () => {
    for (const c of CHARACTERS) {
      const r = runSim({
        level: camp7(),
        character: LUIGI,
        state: { character2: c, powerState2: 'small', hp2: 0 },
        script: none,
        start: { x: 199, y: 12, mode: 'climb', time: 200 },
        maxFrames: 500,
      });
      for (const p of r.world.players) {
        expect(p.dead, c.name).toBe(false);
        expect(p.body.onGround, `${c.name} P${p.index + 1}`).toBe(true);
        expect(toPx(p.body.y + p.body.h)).toBe(13 * 16);
      }
    }
  });
});

const levelId = (h: H) => (h.top() as LevelScene).level?.id;
const scene = (h: H) => h.top() as LevelScene;

describe('the whole way in campaign play', () => {
  it('7-3 bridge → camp → falls → 7-3 at 199: the clock carries over, no secret and no clear recorded', () => {
    const h = makeGame();
    file({ cleared: ['1-0', '7-2'], pages: ['smb-1', 'smb-7'], position: { page: 'smb-7', node: '7-3' } });
    h.game.openFile(1);
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    h.game.startLevel(getLevel('7-3'), { x: 130, y: 9, mode: 'stand', time: 250 });
    h.step();
    // No remark on the restyled level since 0.4.23 (docs/STORY.md 2.14): play goes straight on.
    expect(closeCards(h)).toEqual([]);
    expect(levelId(h)).toBe('7-3');
    expect(blast(scene(h).world)).toBeDefined();
    for (let f = 0; f < 400 && levelId(h) === '7-3'; f++) h.step();
    expect(levelId(h)).toBe('7-3-camp');
    const arrived = scene(h).world.time as number;
    expect(arrived).toBeLessThanOrEqual(250);
    expect(arrived).toBeGreaterThan(240);
    h.idle(2);
    expect(captives(scene(h)).map((x) => x.hero.id)).toEqual(['bill']);
    const hop = walkRight();
    for (let f = 0; f < 900 && levelId(h) === '7-3-camp'; f++) h.step(hop(scene(h).world));
    expect(levelId(h)).toBe('7-3-falls');
    const bot = fallsBot();
    for (let f = 0; f < 3000 && levelId(h) === '7-3-falls'; f++) h.step(bot(scene(h).world));
    expect(levelId(h)).toBe('7-3');
    const main = scene(h).world;
    expect(main.time).toBeLessThan(arrived);
    expect(main.time).toBeGreaterThan(arrived - 40);
    h.idle(200);
    expect(main.player.dead).toBe(false);
    expect(toPx(main.player.body.x) >> 4).toBeGreaterThanOrEqual(199);
    // Back in 7-3 the bridge is whole again (a new visit).
    expect(bridgeCells(main).every((t) => t === T.BRIDGE)).toBe(true);
    expect(h.game.mapProgress.secrets).toEqual([]);
    expect(h.game.mapProgress.cleared).not.toContain('7-3');
  });
});

describe('captive Bill', () => {
  const intoCamp = (h: H) => {
    h.game.openFile(1);
    h.game.startLevel(getLevel('7-3-camp'), { mode: 'fall', x: 2, y: 0, time: 250 });
    h.step();
    return h.top() as LevelScene;
  };

  it('stands in the camp only in campaign play, and only until freed', () => {
    const h = makeGame();
    file();
    const l = intoCamp(h);
    h.idle(30);
    expect(captives(l).map((c) => c.hero.id)).toEqual(['bill']);
    const h1 = makeGame();
    file({ freed: ['mario', 'bill'] });
    const l1 = intoCamp(h1);
    h1.idle(30);
    expect(captives(l1)).toHaveLength(0);
    const h2 = makeGame();
    h2.game.devStart('7-3-camp', MARIO, 'small');
    h2.until(() => h2.top() instanceof LevelScene);
    h2.idle(30);
    expect(captives(h2.top() as LevelScene)).toHaveLength(0);
  });

  it('the map hints at node 7-3 on World 7', () => {
    expect(hiddenHeroes()).toContainEqual({
      hero: 'bill',
      level: '7-3-camp',
      main: '7-3',
      page: 'smb-7',
      node: '7-3',
    });
    expect(hiddenHeroesAt('smb-7', '7-3').map((x) => x.hero)).toEqual(['bill']);
    expect(hiddenHeroesAt('smb-7', '7-2')).toEqual([]);
  });

  it("his words: King Koopa's spell let Red Falcon take his mind; every line fits", () => {
    const def: MiniGameDef = {
      hero: 'bill',
      title: 'JUNGLE ASSAULT',
      rules: [],
      create: () => ({ update() {}, render() {} }),
    };
    for (const talker of CHARACTERS) {
      const pages = captiveDialogue(BILL, def, talker);
      for (const page of pages)
        for (const line of page) expect(line.length, `${talker.id}: ${line}`).toBeLessThanOrEqual(CARD_COLS);
      const own = (pages[1] ?? []).join(' ');
      expect(own).toContain('RED FALCON');
      expect(own).toContain("KING KOOPA'S SPELL");
      expect(own).toContain('MIND');
      expect(own).toContain(`${fontText(talker.name)}...`);
      expect(own).not.toContain('NO ONE PASSES HERE.');
    }
  });
});

describe('the bundled areas', () => {
  it("7-3-camp and 7-3-falls are in B3's themes and music", () => {
    expect([getLevel('7-3-camp').theme, getLevel('7-3-camp').music]).toEqual([
      'contra-jungle',
      'contra-jungle',
    ]);
    expect(getLevel('7-3-falls').theme).toBe('contra-falls');
    // Decor of the decor sheet's jungle frames only (they are drawn in contra-jungle/-falls only).
    const jungle = new Set(['canopy', 'canopy-hang', 'palm', 'mountain', 'sandbags', 'searchlight']);
    for (const id of ['7-3-camp', '7-3-falls'])
      for (const d of getLevel(id).decor) expect(jungle.has(d.kind), `${id} ${d.kind}`).toBe(true);
  });

  it("nothing busy behind the HUD's rows (y < 32): only the hanging canopy, its leaves above the letters", () => {
    // QA 0.4.9: the camp's cliff-top crowns sat behind the TIME digits.
    for (const l of [camp7(), getLevel('7-3-camp'), getLevel('7-3-falls')])
      for (const d of l.decor) {
        if (d.kind === 'canopy-hang') {
          expect(d.y, `${l.id} canopy-hang ${d.x}`).toBe(0);
          continue;
        }
        const h = jungleDecorFrames[d.kind]?.length;
        expect(h, `${l.id} ${d.kind}`).toBeDefined();
        expect((d.y + 1) * 16 - (h as number), `${l.id} ${d.kind} ${d.x},${d.y}`).toBeGreaterThanOrEqual(32);
      }
    expect(getLevel('7-3-camp').decor.filter((d) => d.kind === 'canopy')).toEqual([
      { kind: 'canopy', x: 12, y: 2 },
      { kind: 'canopy', x: 14, y: 2 },
    ]);
    for (const x of [11, 12, 13, 14, 15]) {
      expect(tile(getLevel('7-3-camp'), x, 2), `${x}`).toBe(T.AIR);
      expect(tileDef(tile(getLevel('7-3-camp'), x, 3) as number).collision, `${x}`).toBe('solid');
    }
    // The ceiling's leaves end above the HUD's first row of letters (y 8); below that only its three
    // vines hang, in the darker greens (not the bright one).
    const hang = jungleDecorFrames['canopy-hang'] as readonly string[];
    for (let y = 8; y < hang.length; y++) {
      const row = hang[y] as string;
      expect(row.replace(/\./g, '').length, `row ${y}`).toBeLessThanOrEqual(3);
      expect(row, `row ${y}`).toMatch(/^[.12]+$/);
    }
  });

  it('every level reached on the way has its own data (no dangling link)', () => {
    const levels: LevelData[] = [camp7(), getLevel('7-3-camp'), getLevel('7-3-falls')];
    for (const l of levels)
      for (const z of l.zones)
        if ('target' in z && z.target) expect(levelIds()).toContain((z.target as { level: string }).level);
  });
});
