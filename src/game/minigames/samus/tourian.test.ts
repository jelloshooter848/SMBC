import { beforeEach, describe, expect, it } from 'vitest';
import { songs } from '@content/music/songs';
import { tilesDef } from '@content/sprites/tiles';
import { zebesDef, zebesPalettes } from '@content/sprites/zebes';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import { px, tileToSub, toPx } from '@engine/math/units';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import { SAMUS, SAMUS_PROFILE } from '@game/characters/samus';
import { T } from '@game/level/tiles';
import { ZEBES_SOUNDS, TOURIAN_FRAMES } from './art';
import {
  BRAIN_BOOM_FRAMES,
  BRAIN_HITS,
  BrainTank,
  Cannon,
  CANNON_EVERY,
  CannonShot,
  Door,
  DOOR_OPEN_FRAMES,
  DOOR_RED_MISSILES,
  Rinka,
  RinkaSpawner,
  RINKA_RESPAWN,
  TankWreck,
  Zebetite,
  ZEBETITE_HITS,
  ZEBETITE_REGEN,
} from './tourian';
import { escapeStage, ROOMS, roomAt } from './stage';
import { APPEAR_FRAMES, DOOR_SCROLL_FRAMES, ENDING_FRAMES, ESCAPE_KIT, OPENER } from './scene';
import {
  clearCreatures,
  escapeHarness,
  ready,
  setBomb,
  STUB_ASSETS,
  warp,
  type EscapeHarness,
} from './harness';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

/** The text the scene draws this frame. */
function texts(h: EscapeHarness): string[] {
  const out: string[] = [];
  const r = Object.assign(new NullRenderer(), {
    text(_f: unknown, s: string): void {
      out.push(s);
    },
  }) as unknown as Renderer;
  h.scene.render(r);
  return out;
}

function find<E>(h: EscapeHarness, type: abstract new (...a: never[]) => E, tx?: number): E {
  const e = h.world.entities.find(
    (e) => e.alive && e instanceof type && (tx === undefined || e.body.x >> 12 === tx),
  );
  if (!e) throw new Error(`no ${type.name}${tx === undefined ? '' : ` at ${tx}`}`);
  return e as E;
}

/** Fires `n` shots (beam, or missiles with `missile`), facing `dir`, a while apart. */
function fire(h: EscapeHarness, n: number, missile = false, dir: 'left' | 'right' = 'right'): void {
  h.step([dir]);
  h.step();
  for (let i = 0; i < n; i++) {
    h.step([missile ? 'special' : 'attack']);
    h.step([], 14);
  }
}

/** Walks `dir` until `until` holds (or `max` frames). */
function walk(h: EscapeHarness, dir: 'left' | 'right', until: () => boolean, max = 600): void {
  for (let i = 0; i < max && !until(); i++) h.step([dir]);
}

describe('Tourian: the stage', () => {
  it('is Tourian: its own theme, tiles and music, rooms joined by doors, and no ship', () => {
    const level = escapeStage();
    expect(level.theme).toBe('tourian');
    expect(level.camera).toBe('free');
    for (const name of ['ground', 'hard', 'brick', 'castle-brick'])
      expect(tilesDef.frames[`${name}@tourian`], name).toBeDefined();
    expect(songs.map((s) => s.id)).toContain(ZEBES_SOUNDS.tourian);
    for (const f of TOURIAN_FRAMES) expect(Object.keys(zebesDef.frames), f).toContain(f);
    expect(Object.keys(zebesPalettes)).toContain('zebes-red');
    expect(level.entities.some((e) => e.type === 'ship')).toBe(false);
    // Rooms: two corridors, the brain's chamber, the escape shaft to the surface.
    expect(ROOMS.map((r) => r.id)).toEqual(['corridor', 'hall', 'brain', 'shaft']);
    const shaft = ROOMS[3] as (typeof ROOMS)[number];
    expect(shaft.y1 - shaft.y0 + 1).toBeGreaterThanOrEqual(45);
    expect(shaft.x1 - shaft.x0 + 1).toBe(16);
    // Every door stands in a gap of its room's wall, paired with one in the next room's.
    const doors = level.entities.filter((e) => e.type === 'door');
    expect(doors).toHaveLength(6);
    for (const d of doors) {
      const pair = doors.find((o) => o.y === d.y && Math.abs(o.x - d.x) === 1);
      expect(pair, `${d.x}`).toBeDefined();
      expect(roomAt(d.x, d.y)).not.toBe(roomAt((pair as typeof d).x, d.y));
      for (let y = d.y; y < d.y + 3; y++) expect(level.tiles[y * level.width + d.x]).toBe(T.AIR);
      expect(level.tiles[(d.y - 1) * level.width + d.x]).not.toBe(T.AIR);
      expect(level.tiles[(d.y + 3) * level.width + d.x]).not.toBe(T.AIR);
    }
    // One red door (missiles), the rest blue.
    expect(doors.filter((d) => d.props?.color === 'red').map((d) => d.x)).toEqual([47, 48]);
  });

  it('the round opens in Tourian: Samus materialises, then no TIME and no countdown until the brain falls', () => {
    const h = escapeHarness({ assets: STUB_ASSETS });
    ready(h);
    expect(h.scene.phase).toBe('tourian');
    expect(h.scene.room.id).toBe('corridor');
    expect(h.log.music.at(-1)).toBe(ZEBES_SOUNDS.tourian);
    h.step([], 600);
    expect(h.scene.left).toBe(h.scene.total);
    expect(texts(h).some((t) => t.startsWith('TIME'))).toBe(false);
    // No alarm before the bomb.
    expect(h.log.sfx).not.toContain(ZEBES_SOUNDS.alarm);
  });

  it("the camera keeps inside Samus's room, as Metroid's rooms", () => {
    const h = escapeHarness();
    ready(h);
    warp(h, 29 * 16, 57);
    clearCreatures(h);
    h.step([], 2);
    const c = h.world.camera;
    expect(toPx(c.x) + SCREEN_W).toBeLessThanOrEqual(32 * 16);
    expect(toPx(c.y)).toBe(45 * 16);
    warp(h, 3 * 16, 57);
    h.step([], 2);
    expect(toPx(c.x)).toBe(0);
  });
});

describe('Tourian: doors', () => {
  it('a blue door: a beam shot opens it, walking in scrolls the screen to the next room, and it closes behind her', () => {
    const h = escapeHarness();
    ready(h);
    warp(h, 27 * 16, 57);
    clearCreatures(h);
    const door = find(h, Door, 31);
    expect(door.open).toBe(false);
    // Closed, it stops her like a wall.
    walk(h, 'right', () => false, 60);
    expect(toPx(h.scene.player.body.x + h.scene.player.body.w)).toBeLessThanOrEqual(31 * 16);
    fire(h, 1);
    expect(door.open).toBe(true);
    walk(h, 'right', () => h.scene.transition !== null);
    expect(h.scene.transition).not.toBeNull();
    const t0 = h.scene.player.body.x;
    // The scroll: the world holds still and the camera slides a screen.
    h.step([], DOOR_SCROLL_FRAMES >> 1);
    expect(toPx(h.world.camera.x)).toBeGreaterThan(16 * 16);
    expect(toPx(h.world.camera.x)).toBeLessThan(32 * 16);
    h.step([], DOOR_SCROLL_FRAMES);
    expect(h.scene.transition).toBeNull();
    expect(h.scene.room.id).toBe('hall');
    expect(toPx(h.world.camera.x)).toBe(32 * 16);
    expect(h.scene.player.body.x).toBeGreaterThan(t0);
    expect(toPx(h.scene.player.body.x)).toBeGreaterThanOrEqual(33 * 16);
    // Behind her, both bubbles shut again.
    h.step([], 60);
    expect(door.open).toBe(false);
    expect(find(h, Door, 32).open).toBe(false);
  });

  it('an open door shuts again by itself if she does not go through', () => {
    const h = escapeHarness();
    ready(h);
    warp(h, 27 * 16, 57);
    clearCreatures(h);
    fire(h, 1);
    const door = find(h, Door, 31);
    expect(door.open).toBe(true);
    h.step([], DOOR_OPEN_FRAMES);
    expect(door.open).toBe(false);
  });

  it('a red door: beams glance off it; it takes five missiles', () => {
    expect(DOOR_RED_MISSILES).toBe(5);
    const h = escapeHarness();
    ready(h);
    warp(h, 43 * 16, 57);
    clearCreatures(h);
    h.step();
    const door = find(h, Door, 47);
    expect(door.color).toBe('red');
    fire(h, 3);
    expect(door.open).toBe(false);
    const before = h.scene.player.scratch.missiles ?? 0;
    fire(h, DOOR_RED_MISSILES - 1, true);
    expect(door.open).toBe(false);
    fire(h, 1, true);
    expect(door.open).toBe(true);
    expect(h.scene.player.scratch.missiles).toBe(before - DOOR_RED_MISSILES);
    // Opened, it stays a plain door from then on.
    expect(door.color).toBe('blue');
    // Going through it into the brain's chamber is a checkpoint.
    walk(h, 'right', () => h.scene.transition !== null);
    h.step([], DOOR_SCROLL_FRAMES + 2);
    expect(h.scene.room.id).toBe('brain');
    expect(h.scene.lives.current.id).toBe('brain');
  });
});

describe('Tourian: the brain and its barriers', () => {
  it('a Zebetite: beams and bombs glance off, it grows back if left alone, and four missiles break it', () => {
    const h = escapeHarness();
    ready(h);
    warp(h, 51 * 16, 57);
    clearCreatures(h);
    h.step();
    const z = find(h, Zebetite, 55);
    fire(h, 3);
    expect(z.hits).toBe(0);
    fire(h, 2, true);
    expect(z.hits).toBe(2);
    h.step([], ZEBETITE_REGEN + 2);
    expect(z.hits).toBe(1);
    fire(h, ZEBETITE_HITS - 1, true);
    expect([z.hits, z.alive, h.scene.player.scratch.missiles]).toEqual([
      ZEBETITE_HITS,
      false,
      ESCAPE_KIT.missiles - 5,
    ]);
    // The way is open: she walks past where it stood.
    walk(h, 'right', () => toPx(h.scene.player.body.x) > 56 * 16, 200);
    expect(toPx(h.scene.player.body.x)).toBeGreaterThan(56 * 16);
  });

  it('the brain: beams do nothing; missiles destroy it, the time bomb is set and the escape begins', () => {
    const h = escapeHarness({ assets: STUB_ASSETS });
    ready(h);
    warp(h, 68 * 16, 57);
    clearCreatures(h);
    for (const z of h.world.entities) if (z instanceof Zebetite) z.destroy();
    h.step();
    const brain = find(h, BrainTank);
    fire(h, 3);
    expect(brain.hits).toBe(0);
    expect(h.scene.phase).toBe('tourian');
    fire(h, BRAIN_HITS, true);
    expect(brain.defeated).toBe(true);
    expect(h.scene.phase).toBe('escape');
    expect(h.scene.bombSet).toBe(true);
    expect(h.said.join(' ')).toMatch(/Time bomb set! Get out fast!/);
    expect(texts(h)).toEqual(expect.arrayContaining([...OPENER]));
    expect(texts(h).some((t) => /^TIME 99\d$/.test(t))).toBe(true);
    expect(h.log.music.at(-1)).toBe(ZEBES_SOUNDS.escape);
    h.step([], 120);
    expect(h.scene.left).toBeLessThan(h.scene.total);
    // The tank no longer bars the way to the shaft's door.
    walk(h, 'right', () => toPx(h.scene.player.body.x) > 76 * 16, 300);
    expect(toPx(h.scene.player.body.x)).toBeGreaterThan(76 * 16);
    expect(h.scene.lives.current.id).toBe('escape');
  });

  it("the destroyed tank's wreck lets shots through: a beam from beside it opens the shaft's door", () => {
    const h = escapeHarness();
    ready(h);
    setBomb(h);
    h.step([], BRAIN_BOOM_FRAMES + 2);
    expect(h.world.entities.some((e) => e instanceof BrainTank && e.alive)).toBe(false);
    expect(h.world.entities.some((e) => e instanceof TankWreck && e.alive)).toBe(true);
    warp(h, 70 * 16, 57);
    clearCreatures(h);
    const door = find(h, Door, 79);
    const missiles = h.scene.player.scratch.missiles;
    fire(h, 1);
    h.step([], 40); // the shot crosses the chamber
    expect(door.open).toBe(true);
    expect(h.scene.player.scratch.missiles).toBe(missiles);
  });

  it('after the bomb, a lost life starts at the foot of the shaft with the clock full; the brain stays dead', () => {
    const h = escapeHarness({ assets: STUB_ASSETS });
    ready(h);
    warp(h, 68 * 16, 57);
    clearCreatures(h);
    for (const z of h.world.entities) if (z instanceof Zebetite) z.destroy();
    fire(h, BRAIN_HITS, true);
    expect(h.scene.phase).toBe('escape');
    h.step([], 300);
    h.world.kill(h.scene.player);
    for (let i = 0; i < 400 && h.scene.phase !== 'appear'; i++) h.step();
    expect(h.scene.phase).toBe('appear');
    h.step([], APPEAR_FRAMES);
    expect(h.scene.phase).toBe('escape');
    expect(h.scene.room.id).toBe('shaft');
    expect(h.scene.left).toBeGreaterThan(h.scene.total - 5);
    expect(h.world.entities.some((e) => e instanceof BrainTank && e.alive && !e.defeated)).toBe(false);
    expect(texts(h).some((t) => t.startsWith('TIME'))).toBe(true);
  });

  it('climbing out of the shaft onto the surface ends the round: the clock stops, a short ending, then pass', () => {
    const h = escapeHarness({ assets: STUB_ASSETS, keep: true });
    ready(h);
    warp(h, 68 * 16, 57);
    clearCreatures(h);
    for (const z of h.world.entities) if (z instanceof Zebetite) z.destroy();
    fire(h, BRAIN_HITS, true);
    h.game.ctx.assist.invulnerable = true;
    // On the shaft's last ledge, a jump and a drift up onto the surface.
    warp(h, 86 * 16, 6);
    const left = h.scene.left;
    for (let i = 0; i < 120 && h.scene.phase === 'escape'; i++) h.step(i < 30 ? ['jump', 'left'] : ['left']);
    expect(h.scene.phase).toBe('ending');
    const at = h.scene.left;
    expect(at).toBeLessThanOrEqual(left);
    expect(texts(h)).toContain('SAMUS ESCAPED!');
    // The surface alone: no HUD over its sky.
    expect(texts(h).filter((t) => /^(TIME|EN)/.test(t))).toEqual([]);
    h.step([], ENDING_FRAMES - 2);
    expect(h.scene.left).toBe(at);
    expect(h.results).toEqual([]);
    h.step([], 4);
    expect(h.results).toEqual(['pass']);
    expect(h.said.join(' ')).toMatch(/Samus escaped to the surface with \d+ seconds to spare!/);
  });
});

describe("Tourian: the brain's guards", () => {
  it('Rinkas: out of their spawner toward Samus, through the rock; one beam shot; another follows a while later', () => {
    const h = escapeHarness();
    ready(h);
    warp(h, 38 * 16, 57);
    for (const e of h.world.entities) if (e instanceof Cannon) e.destroy();
    h.step([], 2);
    const spawners = h.world.entities.filter(
      (e) => e instanceof RinkaSpawner && roomAt(e.body.x >> 12, e.body.y >> 12)?.id === 'hall',
    );
    expect(spawners.length).toBeGreaterThan(0);
    let rinka: Rinka | undefined;
    for (let i = 0; i < 200 && !rinka; i++) {
      h.step();
      rinka = h.world.entities.find((e): e is Rinka => e instanceof Rinka && e.alive);
    }
    expect(rinka).toBeDefined();
    const r = rinka as Rinka;
    const from = spawners.find((s) => (s as RinkaSpawner).child === r) as RinkaSpawner;
    expect(from).toBeDefined();
    const p = h.scene.player;
    const d0 = Math.hypot(r.body.x - p.body.x, r.body.y - p.body.y);
    h.step([], 10);
    expect(Math.hypot(r.body.x - p.body.x, r.body.y - p.body.y)).toBeLessThan(d0);
    // One beam shot downs it.
    r.hit({ kind: 'buster', amount: 1, owner: null, dirX: 1 }, h.world);
    expect(r.alive).toBe(false);
    let n = 0;
    for (; n < RINKA_RESPAWN + 200 && !from.child?.alive; n++) h.step();
    expect(from.child?.alive).toBe(true);
    expect(n).toBeGreaterThanOrEqual(RINKA_RESPAWN - 2);
  });

  it("cannons fire in turn and cannot be destroyed; a shot costs 8 energy; guards outside Samus's room hold still", () => {
    const h = escapeHarness();
    ready(h);
    warp(h, 35 * 16, 57);
    clearCreatures(h, true);
    const here = find(h, Cannon, 40);
    const away = find(h, Cannon, 14);
    h.game.ctx.assist.invulnerable = true;
    h.step([], CANNON_EVERY * 2 + 2);
    h.game.ctx.assist.invulnerable = false;
    const shots = h.world.entities.filter((e) => e instanceof CannonShot);
    expect(shots.length).toBeGreaterThan(0);
    expect(
      shots.map((s) => roomAt(s.body.x >> 12, s.body.y >> 12)?.id ?? `${s.body.x >> 12},${s.body.y >> 12}`),
    ).toEqual(shots.map(() => 'hall'));
    expect(here.fired).toBeGreaterThanOrEqual(2);
    expect(away.fired).toBe(0);
    here.hit({ kind: 'weapon', amount: 3, owner: null, dirX: 1 }, h.world);
    expect(here.alive).toBe(true);
    // A shot on her.
    for (const e of h.world.entities) if (e instanceof CannonShot) e.destroy();
    const p = h.scene.player;
    const hp = p.hp;
    p.invuln = 0;
    h.world.spawn(new CannonShot(p.body.x + px(4), p.body.y + px(8), 0, 0));
    h.step();
    expect(p.hp).toBe(hp - 8);
  });
});

describe('Tourian: what stays', () => {
  it("Samus's kit is the escape's (one tank, the Long Beam, missiles enough for the barriers and the brain)", () => {
    expect(ESCAPE_KIT.tanks).toBe(1);
    expect(ESCAPE_KIT.beam).toBe(1);
    expect(ESCAPE_KIT.missiles).toBeGreaterThanOrEqual(DOOR_RED_MISSILES + 3 * ZEBETITE_HITS + BRAIN_HITS);
  });

  it("the campaign's Samus is unchanged, and playing the round leaves her definition alone", () => {
    const snapshot = () =>
      JSON.stringify({
        movement: SAMUS.movement,
        damage: SAMUS.damage,
        startHp: SAMUS.startHp,
        devKit: SAMUS.devKit?.(),
      });
    expect(SAMUS.movement).toBe(SAMUS_PROFILE);
    expect(SAMUS_PROFILE.maxWalk).toBe(0x01400);
    expect(SAMUS_PROFILE.jump).toEqual([
      { maxVx: Infinity, initial: 0x04800, holdGravity: 0x00240, fallGravity: 0x00240 },
    ]);
    expect(SAMUS.startHp).toBe(30);
    expect(SAMUS.damage).toEqual({
      kind: 'hp',
      max: 90,
      hudStyle: 'number',
      invulnFrames: 40,
      knockback: { vx: 0x01000, vy: 0x02000 },
    });
    expect(SAMUS.devKit?.()).toEqual({ varia: 1, tanks: 2, maxHp: 90, beam: 3, missiles: 30 });
    const before = snapshot();
    const h = escapeHarness();
    ready(h);
    h.step(['right'], 300);
    expect(snapshot()).toBe(before);
  });

  it('screen sizes are the NES screen (rooms are whole screens)', () => {
    for (const r of ROOMS) {
      expect(((r.x1 - r.x0 + 1) * 16) % SCREEN_W).toBe(0);
      expect((r.y1 - r.y0 + 1) * 16).toBeGreaterThanOrEqual(SCREEN_H);
    }
    expect(tileToSub(1)).toBe(px(16));
  });
});
