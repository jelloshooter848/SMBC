import { beforeEach, describe, expect, it } from 'vitest';
import { px, tileToSub, toPx } from '@engine/math/units';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { AssetRegistry } from '@engine/assets/registry';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { World } from '@game/world/world';
import { parseTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import { MEGAMAN } from '@game/characters/megaman';
import { Projectile } from '@game/entities/projectiles/projectile';
import { tilesDef } from '@content/sprites/tiles';
import { megamanDef } from '@content/sprites/megaman';
import { READY_FRAMES, SCROLL_FRAMES, STATION_CHECKPOINTS } from './scene';
import { screenAt, SCREEN_ROWS, stationStage } from './stage';
import { CLIMB_OVER_PX, LADDER_SPEED, onLadder } from './ladder';
import { NES_MEGAMAN } from './nes-form';
import { EnemyShot, hurtHero, Met, Robot } from './robots';
import { stationHarness, type StationHarness } from './harness';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

const STUB_ASSETS = {
  sheet: () => ({ id: 'stub', image: null, frames: new Map() }),
  has: () => false,
} as unknown as AssetRegistry;

/** Past READY and the beam down: Mega Man can move. */
function ready(h: StationHarness): void {
  h.step([], READY_FRAMES);
  for (let i = 0; i < 200 && h.world.beaming; i++) h.step();
  expect(h.world.beaming).toBe(false);
  expect(h.scene.phase).toBe('stage');
}

/** Mega Man standing centred on column `tx` with his feet on row `row`'s floor (the row below). */
function place(h: StationHarness, tx: number, row: number): void {
  const b = h.scene.player.body;
  b.x = tileToSub(tx) + px(8) - (b.w >> 1);
  b.y = tileToSub(row + 1) - b.h;
  b.vx = 0;
  b.vy = 0;
  b.onGround = true;
  h.scene.enterScreen();
}

const robots = (h: StationHarness) => h.world.entities.filter((e) => e instanceof Robot && e.alive);

describe("Station Escape: laid out as Mega Man 2's stages", () => {
  const { level, screens, shutters, corridorX, roomX } = stationStage();
  const at = (x: number, y: number) => level.tiles[y * level.width + x];

  it('screens: a run along the bottom, a shaft two screens up, a run along the top, a drop two screens down, then the shutters', () => {
    expect(level.height).toBe(45);
    expect(level.camera).toBe('free');
    expect(screens).toEqual([
      { x: 0, y: 30, w: 80 },
      { x: 64, y: 15, w: 16 },
      { x: 64, y: 0, w: 64 },
      { x: 112, y: 15, w: 16 },
      { x: 112, y: 30, w: 16 },
    ]);
    for (const s of screens) expect(s.w % 16).toBe(0);
    expect(screenAt(screens, 2, 42)).toBe(0);
    expect(screenAt(screens, 71, 20)).toBe(1);
    expect(screenAt(screens, 100, 12)).toBe(2);
    expect(screenAt(screens, 120, 42)).toBe(4);
    expect(screenAt(screens, 30, 10)).toBe(-1);
    // The shutters come after the drop, at the landing room's floor.
    expect(shutters).toEqual([
      { x: 128, y: 41 },
      { x: 143, y: 41 },
    ]);
    expect([corridorX, roomX]).toEqual([128, 143]);
    expect(level.width - roomX).toBe(16);
    // The scene places the screens, shutters and boss; the map keeps the robots and the capsule.
    for (const t of ['screen', 'shutter', 'dark-megaman'])
      expect(level.entities.map((e) => e.type)).not.toContain(t);
  });

  it('ladders are tiles: the shaft’s two, each topped in a floor by a ladder top (stood on, climbed through)', () => {
    expect(T.CLOUD_LEDGE).toBeDefined();
    // The first, from the bottom run's floor up through the ceiling to the ledge two screens up.
    for (let y = 23; y <= 42; y++) expect(at(71, y), `71,${y}`).toBe(T.CHAIN);
    expect(at(71, 22)).toBe(T.CLOUD_LEDGE);
    expect(at(71, 43)).toBe(T.GROUND);
    // The second, from the ledge up through the top run's floor.
    for (let y = 14; y <= 21; y++) expect(at(75, y), `75,${y}`).toBe(T.CHAIN);
    expect(at(75, 13)).toBe(T.CLOUD_LEDGE);
    expect(at(76, 22)).toBe(T.HARD);
    // The drop: a hole in the top run's floor over a chute down to the landing room.
    for (let y = 13; y <= 42; y++) for (const x of [119, 120, 121]) expect(at(x, y)).not.toBe(T.GROUND);
    for (let y = 13; y <= 42; y++) expect(at(120, y) === T.HARD, `120,${y}`).toBe(false);
    expect(at(120, 43)).toBe(T.GROUND);
    // Floors under the start, along the bottom run (its pits aside), the top run and the boss room.
    for (const x of [2, 30, 63, 70, 140, 150]) expect(at(x, 43), `${x},43`).toBe(T.GROUND);
    for (const x of [70, 90, 118, 125]) expect(at(x, 13), `${x},13`).toBe(T.GROUND);
  });

  it('the station theme draws its ladders and ladder tops (original art), and Mega Man has his ladder frames', () => {
    expect(tilesDef.frames['chain@station']).toBeDefined();
    expect(tilesDef.frames['cloud-ledge@station']).toBeDefined();
    for (const f of ['climb-0', 'climb-1', 'climb-shoot', 'climb-top'])
      expect(megamanDef.frames[f]).toBeDefined();
  });

  it('robots are spread over the screens: Mets at the foot of the shaft, on its ledge, on the top run and in the landing room', () => {
    const mets = level.entities.filter((e) => e.type === 'met').map((e) => screenAt(screens, e.x, e.y));
    expect(new Set(mets)).toEqual(new Set([0, 1, 2, 4]));
    for (const e of level.entities) {
      if (e.type === 'deco' || e.type === 'capsule') continue;
      expect(screenAt(screens, e.x, e.y), `${e.type} ${e.x},${e.y}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('checkpoints: halfway along the bottom run, at the top of the shaft, and in the landing room before the shutters', () => {
    expect(STATION_CHECKPOINTS.map((c) => c.id)).toEqual(['mid', 'top', 'boss']);
    const top = STATION_CHECKPOINTS[1];
    expect(screenAt(screens, top?.x ?? 0, top?.y ?? 0)).toBe(2);
    const boss = STATION_CHECKPOINTS[2];
    expect(screenAt(screens, boss?.x ?? 0, boss?.y ?? 0)).toBe(4);
  });
});

describe("Station Escape: ladders (Mega Man 2's)", () => {
  it('UP at a ladder takes hold of it: centred on it, climbing at 0.75 px a frame, still when let go (no gravity)', () => {
    const h = stationHarness();
    ready(h);
    place(h, 71, 42);
    const p = h.scene.player;
    const b = p.body;
    b.x += px(5); // a little off the ladder's centre, its column behind his middle
    h.step(['up']);
    expect(onLadder(p)).toBe(true);
    expect(b.x + (b.w >> 1)).toBe(tileToSub(71) + px(8));
    const y = b.y;
    h.step(['up'], 16);
    expect(y - b.y).toBe(16 * LADDER_SPEED);
    expect(LADDER_SPEED).toBe(px(0.75));
    expect(p.anim).toBe('climb');
    const still = b.y;
    h.step([], 30);
    expect(b.y).toBe(still);
    expect(onLadder(p)).toBe(true);
    expect(p.def.sprite(p, 0, true).frame).toMatch(/^climb-[01]$/);
  });

  it('LEFT or RIGHT on the ladder turns him without moving; a shot goes that way from the ladder (and he holds still while it does)', () => {
    const h = stationHarness();
    ready(h);
    place(h, 71, 42);
    const p = h.scene.player;
    h.step(['up'], 20);
    expect(onLadder(p)).toBe(true);
    const x = p.body.x;
    h.step(['left'], 5);
    expect(p.facing).toBe(-1);
    expect(p.body.x).toBe(x);
    h.step(['left', 'attack']);
    h.step(['left']);
    const shot = h.world.entities.find((e): e is Projectile => e instanceof Projectile && e.owner === p);
    expect(shot?.body.vx).toBeLessThan(0);
    expect(p.def.sprite(p, 0, true).frame).toBe('climb-shoot');
    expect(p.def.sprite(p, 0, true).flip).toBe(true);
    const y = p.body.y;
    h.step(['up'], 4);
    expect(p.body.y).toBe(y); // the shot's pose holds him
    h.step(['right', 'attack']);
    h.step(['right']);
    expect(p.facing).toBe(1);
    expect(onLadder(p)).toBe(true);
  });

  it('JUMP lets go: he drops (no jump up), and lands on the floor below', () => {
    const h = stationHarness();
    ready(h);
    place(h, 71, 42);
    const p = h.scene.player;
    h.step(['up'], 40);
    const y = p.body.y;
    h.step(['jump']);
    h.step();
    expect(onLadder(p)).toBe(false);
    expect(p.body.y).toBeGreaterThanOrEqual(y);
    for (let i = 0; i < 60 && !p.body.onGround; i++) h.step();
    expect(p.body.onGround).toBe(true);
    expect(p.body.y + p.body.h).toBe(tileToSub(43));
  });

  it('DOWN climbs down to the floor and he stands there', () => {
    const h = stationHarness();
    ready(h);
    place(h, 71, 42);
    const p = h.scene.player;
    h.step(['up'], 40);
    for (let i = 0; i < 100 && onLadder(p); i++) h.step(['down']);
    expect(onLadder(p)).toBe(false);
    expect(p.body.onGround).toBe(true);
    expect(p.body.y + p.body.h).toBe(tileToSub(43));
  });

  it('at the top he climbs over (the climb-over frame for the last few px) and stands on the floor above; DOWN there takes the ladder back down', () => {
    const h = stationHarness();
    ready(h);
    place(h, 75, 21); // on the shaft's ledge, at the foot of the second ladder
    expect(h.scene.screen).toBe(1);
    const p = h.scene.player;
    const top = tileToSub(13);
    const frames: string[] = [];
    for (let i = 0; i < 600 && (onLadder(p) || frames.length === 0); i++) {
      h.step(h.scene.phase === 'stage' ? ['up'] : []);
      if (onLadder(p)) frames.push(p.def.sprite(p, 0, true).frame);
    }
    expect(onLadder(p)).toBe(false);
    expect(h.scene.screen).toBe(2); // the camera went up with him
    expect(frames.at(-1)).toBe('climb-top');
    expect(frames.filter((f) => f === 'climb-top').length).toBeLessThanOrEqual(
      Math.ceil(CLIMB_OVER_PX / 0.75) + 1,
    );
    expect(p.body.onGround).toBe(true);
    expect(p.body.y + p.body.h).toBe(top);
    // Standing on the ladder's top: it holds him, walking over it too.
    h.step([], 20);
    expect(p.body.y + p.body.h).toBe(top);
    // DOWN takes it back down.
    h.step(['down'], 20);
    expect(onLadder(p)).toBe(true);
    expect(p.body.y + p.body.h).toBeGreaterThan(top);
  });

  it('he can catch a ladder in the air (UP while jumping or falling past it)', () => {
    const h = stationHarness();
    ready(h);
    place(h, 69, 42);
    const p = h.scene.player;
    h.step(['right', 'jump'], 8);
    let caught = false;
    for (let i = 0; i < 40 && !caught; i++) {
      h.step(['right', 'up', 'jump']);
      caught = onLadder(p);
    }
    expect(caught).toBe(true);
  });

  it('a hit knocks him off the ladder', () => {
    const h = stationHarness();
    ready(h);
    place(h, 71, 42);
    const p = h.scene.player;
    h.step(['up'], 60);
    expect(onLadder(p)).toBe(true);
    hurtHero(h.world, p, 2, 1);
    h.step(['up']);
    expect(onLadder(p)).toBe(false);
    const y = p.body.y;
    h.step(['up'], 10);
    expect(p.body.y).toBeGreaterThan(y);
  });
});

describe("Station Escape: screens (Mega Man 2's camera)", () => {
  it('inside a screen row the camera scrolls sideways only, within its columns', () => {
    const h = stationHarness();
    ready(h);
    const cam = h.world.camera;
    expect(cam.y).toBe(tileToSub(30));
    place(h, 40, 42);
    h.step(['right'], 30);
    expect(cam.y).toBe(tileToSub(30));
    expect(cam.x).toBeGreaterThan(tileToSub(20));
    place(h, 78, 42);
    h.step([], 2);
    expect(cam.x).toBe(tileToSub(64)); // the foot of the shaft: the run's last screen
    place(h, 120, 12);
    h.step([], 2);
    expect(cam.x).toBe(tileToSub(112));
    expect(cam.y).toBe(0);
  });

  it('climbing off the top flips a screen up: play stops, the camera moves 240 px in SCROLL_FRAMES, he arrives still on the ladder; the robots are those of the new screen', () => {
    const h = stationHarness();
    ready(h);
    place(h, 71, 42);
    const p = h.scene.player;
    const cam = h.world.camera;
    for (let i = 0; i < 1000 && h.scene.phase === 'stage'; i++) h.step(['up']);
    expect(h.scene.phase).toBe('scroll');
    expect(cam.y).toBe(tileToSub(30));
    const shots = h.world.entities.filter((e) => e instanceof EnemyShot && e.alive).length;
    expect(shots).toBe(0);
    let frames = 0;
    for (; frames < 200 && h.scene.phase === 'scroll'; frames++) h.step(['down']);
    expect(frames).toBe(SCROLL_FRAMES);
    expect(cam.y).toBe(tileToSub(15));
    expect(h.scene.phase).toBe('stage');
    expect(h.scene.screen).toBe(1);
    expect(onLadder(p)).toBe(true);
    // He is inside the new screen, near its bottom.
    expect(toPx(p.body.y + p.body.h)).toBeLessThanOrEqual(30 * 16 + 4);
    expect(toPx(p.body.y)).toBeGreaterThan(15 * 16 + 160);
    // The bottom run's robots are gone; the shaft's Met is there.
    const kinds = robots(h).map((r) => `${r.kind}@${toPx(r.body.x) >> 4}`);
    expect(kinds).toEqual(['met@78']);
  });

  it('climbing back down flips the screen down, and the screen below has its robots again', () => {
    const h = stationHarness();
    ready(h);
    place(h, 71, 42);
    h.step(['up'], 2);
    for (let i = 0; i < 1000 && h.scene.screen === 0; i++) h.step(h.scene.phase === 'stage' ? ['up'] : []);
    expect(h.scene.screen).toBe(1);
    for (let i = 0; i < 1000 && h.scene.screen === 1; i++) h.step(h.scene.phase === 'stage' ? ['down'] : []);
    expect(h.scene.screen).toBe(0);
    for (let i = 0; i < 200 && h.scene.phase !== 'stage'; i++) h.step();
    expect(h.world.camera.y).toBe(tileToSub(30));
    expect(robots(h).some((r) => r instanceof Met && toPx(r.body.x) >> 4 === 77)).toBe(true);
  });

  it('the drop: off the top run into the hole, two screens down the chute, into the landing room', () => {
    const h = stationHarness();
    ready(h);
    place(h, 116, 12);
    const p = h.scene.player;
    const seen = new Set<number>();
    let scrolls = 0;
    let was = h.scene.phase;
    for (let i = 0; i < 600 && !(h.scene.screen === 4 && p.body.onGround && h.scene.phase === 'stage'); i++) {
      h.step(h.scene.phase === 'stage' && toPx(p.body.x) < 120 * 16 ? ['right'] : []);
      seen.add(h.scene.screen);
      if (h.scene.phase === 'scroll' && was !== 'scroll') scrolls++;
      was = h.scene.phase;
    }
    expect(scrolls).toBe(2);
    expect([...seen]).toEqual([2, 3, 4]);
    expect(p.dead).toBe(false);
    expect(p.body.y + p.body.h).toBe(tileToSub(43));
    expect(h.world.camera.y).toBe(tileToSub(30));
    expect(h.world.camera.x).toBe(tileToSub(112));
    expect(robots(h).map((r) => r.kind)).toEqual(['met']);
  });

  it('a life lost past the shaft starts at the top of it (the checkpoint), the camera on that screen', () => {
    const h = stationHarness();
    ready(h);
    place(h, 80, 12);
    h.step(['right'], 10);
    h.world.kill(h.scene.player);
    for (let i = 0; i < 400 && h.scene.phase !== 'ready'; i++) h.step();
    expect(h.scene.phase).toBe('ready');
    expect(h.scene.lives.current.id).toBe('top');
    expect(h.scene.screen).toBe(2);
    expect(h.world.camera.y).toBe(0);
    // The beam comes down from the top of that screen, not from the map's.
    h.step([], READY_FRAMES);
    let frames = 0;
    for (; frames < 200 && h.world.beaming; frames++) h.step();
    expect(frames).toBeLessThan(120);
    expect(h.scene.player.hidden).toBe(false);
  });
});

describe('Station Escape: the campaign Mega Man has no ladders', () => {
  it('UP in front of a ladder tile does nothing to the campaign kit, and his sprite is his own', () => {
    const rows = Array.from({ length: 15 }, (_, y) =>
      y >= 13 ? '#'.repeat(16) : y >= 5 ? '....L...........' : '................',
    );
    const level = parseTextMap(
      ['id: t', 'name: T', 'theme: overworld', 'start: 4,12', '[legend]', 'L chain', '[tiles]', ...rows].join(
        '\n',
      ),
    );
    const world = new World(
      level,
      { assets: STUB_ASSETS, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
      newGameState(MEGAMAN),
    );
    const p = world.player;
    const y = p.body.y;
    const up = {
      held: (a: string) => a === 'up',
      pressed: () => false,
      released: () => false,
      dirX: 0 as const,
      bufferedJump: () => false,
      consumeJumpBuffer: () => undefined,
    };
    for (let i = 0; i < 30; i++) world.update([up as never]);
    expect(onLadder(p)).toBe(false);
    expect(p.body.y).toBe(y);
    expect(MEGAMAN.sprite).not.toBe(NES_MEGAMAN.sprite);
    expect(MEGAMAN.behaviour.update).not.toBe(NES_MEGAMAN.behaviour.update);
    expect(SCREEN_ROWS).toBe(15);
  });
});
