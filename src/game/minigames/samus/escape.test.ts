import { beforeEach, describe, expect, it } from 'vitest';
import { levelIds } from '@content/levels';
import { songs } from '@content/music/songs';
import { sfx } from '@content/sfx/sfx';
import { SPRITES } from '@content/sprites';
import type { AssetRegistry } from '@engine/assets/registry';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import { px, tileToSub } from '@engine/math/units';
import { SCREEN_H } from '@engine/viewport';
import { defaultSettings } from '@engine/save/settings';
import type { EntitySpawn } from '@game/level/schema';
import type { MenuItem } from '@game/scenes/menu';
import { AssistOptionsScene } from '@game/scenes/options';
import { Projectile } from '@game/entities/projectiles/projectile';
import { Bomb } from '@game/entities/objects/bomb';
import { MISSILE, LONG_BEAM } from '@game/characters/samus/weapons';
import { T } from '@game/level/tiles';
import { miniGameFor } from '..';
import { SAMUS_MINIGAME } from '.';
import {
  rotateClockwise,
  ZEBES_FLASH,
  ZEBES_FRAMES,
  ZEBES_SHEET,
  ZEBES_SOUNDS,
  ZEBES_WALL_DEF,
  ZEBES_WALL_SHEET,
} from './art';
import { zebesDef, zebesPalettes } from '@content/sprites/zebes';
import type { View } from '@game/entities/entity';
import { escapeEntities, escapeStage, shipSpot } from './stage';
import {
  ALARM_EVERY,
  ALARM_EVERY_FINAL,
  BOOM_FRAMES,
  COUNTDOWN_FRAMES,
  COUNTDOWN_SECONDS,
  drawAlarmTint,
  drawBlast,
  ESCAPE_KIT,
  EscapeMenuScene,
  FINAL_TEMPO,
  LIFTOFF_FRAMES,
  APPEAR_FRAMES,
  drawMaterialise,
  ESCAPE_START,
} from './scene';
import { GAME_OVER_FRAMES } from '../lives';
import { energyReadout, HUD_X, TANK_BOX, TANKS_Y, timeShown } from './hud';
import {
  Ripper,
  Ship,
  Skree,
  SKREE_DIG,
  SkreeShard,
  ZebesDecor,
  Zoomer,
  ZOOMER_HP,
  ZOOMER_STEP_FRAMES,
} from './creatures';
import { EscapeBot, ROUTE } from './bot';
import { escapeHarness, type EscapeHarness } from './harness';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

/** A recording renderer: the text and the boxes drawn. */
class TextRenderer implements Renderer {
  texts: string[] = [];
  rects: [number, number, number, number, string][] = [];
  private readonly none = new NullRenderer();
  clear = this.none.clear;
  sprite = this.none.sprite;
  debugText = this.none.debugText;
  line = this.none.line;
  rect(x: number, y: number, w: number, h: number, c: string): void {
    this.rects.push([x, y, w, h, c]);
  }
  text(...args: Parameters<Renderer['text']>): void {
    this.texts.push(args[1]);
  }
}

/** Sheets with no frames (and no zebes sheet): every zebes draw falls back to boxes. */
const STUB_ASSETS = {
  sheet: () => ({ id: 'stub', image: null, frames: new Map() }),
  has: () => false,
} as unknown as AssetRegistry;

/** Assets that record which sheet (and palette) each sprite comes from; every sheet is known. */
function recordingAssets() {
  const defined = new Set<string>();
  return {
    sheet: (id: string, palette?: string) => ({
      id: palette ? `${id}@${palette}` : id,
      image: null,
      frames: new Map(),
    }),
    has: (id: string) => id === 'zebes' || defined.has(id),
    define: (id: string) => void defined.add(id),
  } as unknown as AssetRegistry;
}

/** The sprites an entity draws at `frame`. */
function drawn(e: { render(r: Renderer, v: View): void }, frame: number, reduceFlashing: boolean) {
  const out: { sheet: string; frame: string; flipX: boolean; flipY: boolean }[] = [];
  const r: Renderer = {
    ...new NullRenderer(),
    clear() {},
    rect() {},
    text() {},
    debugText() {},
    line() {},
    sprite: (sheet, f, _x, _y, flipX = false, flipY = false) =>
      void out.push({ sheet: sheet.id, frame: f, flipX, flipY }),
  };
  e.render(r, { camX: 0, frame, assets: ASSETS, theme: 'cavern', reduceFlashing });
  return out;
}
const ASSETS = recordingAssets();

/** Past READY: Samus can move and the countdown runs. */
function ready(h: EscapeHarness): void {
  h.step([], APPEAR_FRAMES);
  expect(h.scene.phase).toBe('escape');
}

/** Puts Samus standing (or curled, `ball`) with her feet on row `feetRow` at `x` px, the camera on her. */
function warp(h: EscapeHarness, x: number, feetRow: number, ball = false): void {
  const p = h.scene.player;
  p.scratch.ball = ball ? 1 : 0;
  p.refitHitbox();
  const b = p.body;
  b.x = px(x);
  b.y = tileToSub(feetRow) - b.h;
  b.vx = 0;
  b.vy = 0;
  b.onGround = true;
  h.world.camera.snapTo(b.x, b.y);
}

/** Clears the creatures out of the way (for tests about something else). */
function clearCreatures(h: EscapeHarness): void {
  for (const e of h.world.entities)
    if (e instanceof Zoomer || e instanceof Ripper || e instanceof Skree) e.destroy();
}

describe('Zebes Escape: the mini game contract', () => {
  it('frees Samus: registered, a title, and rules within the rules card naming abilities', () => {
    expect(miniGameFor('samus')).toBe(SAMUS_MINIGAME);
    expect(SAMUS_MINIGAME.hero).toBe('samus');
    expect(SAMUS_MINIGAME.title).toBe('ZEBES ESCAPE');
    for (const line of SAMUS_MINIGAME.rules) {
      expect(line.length).toBeLessThanOrEqual(26);
      // Ability names, never button letters.
      expect(line).not.toMatch(/\b[ABXYZC]\b|\(.\)/);
    }
    expect(SAMUS_MINIGAME.rules.join(' ')).toMatch(/MORPH BALL/);
  });

  it("uses the cavern's theme, songs, sounds, frames and palettes (they exist)", () => {
    const songIds = songs.map((s) => s.id);
    const sfxIds = sfx.map((s) => s.id);
    for (const id of [ZEBES_SOUNDS.escape, ZEBES_SOUNDS.victory]) expect(songIds).toContain(id);
    for (const id of [ZEBES_SOUNDS.alarm, ZEBES_SOUNDS.liftoff, ZEBES_SOUNDS.blast])
      expect(sfxIds).toContain(id);
    for (const f of ZEBES_FRAMES) expect(Object.keys(zebesDef.frames)).toContain(f);
    expect(SPRITES[ZEBES_SHEET]).toBe(zebesDef);
    expect(Object.keys(zebesPalettes)).toContain(ZEBES_FLASH);
    expect(escapeStage().theme).toBe('cavern');
    expect(escapeStage().music).toBe(ZEBES_SOUNDS.escape);
  });

  it("draws Metroid's HUD (tank boxes, EN, a 3-digit missile count; no name, place or score), TIME and the opener", () => {
    const h = escapeHarness({ assets: STUB_ASSETS });
    const r = new TextRenderer();
    ready(h);
    h.scene.render(r);
    expect(r.texts).toEqual(['EN..30', '010', 'TIME 999', 'TIME BOMB SET', 'GET OUT FAST!']);
    expect(r.texts.join(' ')).not.toMatch(/SAMUS|ZEBES|\d{7}/);
    // One energy tank, full: a filled box.
    const box = r.rects.filter(
      ([x, y, w, hh]) => x === HUD_X + 16 && y === TANKS_Y && w === TANK_BOX && hh === TANK_BOX,
    );
    expect(box).toHaveLength(1);
  });

  it('the energy readout and the TIME counter, as Metroid shows them', () => {
    // 30 a tank: full tanks are boxes, EN shows what is in the tank in use.
    expect(energyReadout(60, 1)).toEqual({ full: 1, shown: 30 });
    expect(energyReadout(45, 1)).toEqual({ full: 1, shown: 15 });
    expect(energyReadout(30, 1)).toEqual({ full: 0, shown: 30 });
    expect(energyReadout(8, 1)).toEqual({ full: 0, shown: 8 });
    expect(energyReadout(0, 1)).toEqual({ full: 0, shown: 0 });
    // TIME runs 999 down to 0 over the real countdown.
    expect(timeShown(COUNTDOWN_FRAMES, COUNTDOWN_FRAMES)).toBe(999);
    expect(timeShown(COUNTDOWN_FRAMES / 2, COUNTDOWN_FRAMES)).toBe(500);
    expect(timeShown(1, COUNTDOWN_FRAMES)).toBe(1);
    expect(timeShown(0, COUNTDOWN_FRAMES)).toBe(0);
    const h = escapeHarness();
    ready(h);
    expect(h.scene.time).toBe(999);
    h.step([], 60 * 45);
    expect(h.scene.time).toBeGreaterThanOrEqual(499);
    expect(h.scene.time).toBeLessThanOrEqual(501);
  });
});

describe('Zebes Escape: the stage', () => {
  it('is kept out of the level library (dev level select, campaign)', () => {
    expect(levelIds()).not.toContain('zebes-escape');
  });

  it('three screens wide and three high with a free camera, the route laid out as the bot knows it', () => {
    const level = escapeStage();
    expect(level.width).toBe(48);
    expect(level.height).toBe(45);
    expect(level.camera).toBe('free');
    const at = (x: number, y: number) => level.tiles[y * level.width + x];
    // Every surface on the route is solid along its top row and clear above.
    for (const r of ROUTE) {
      for (let x = r.at.x0; x <= r.at.x1; x++) {
        expect(at(x, r.at.row), `${r.at.row}:${x}`).not.toBe(T.AIR);
        expect(at(x, r.at.row - 1), `${r.at.row - 1}:${x}`).not.toBe(T.GROUND);
      }
    }
    // The bomb blocks in the tunnel and the wall, the pit to the map's bottom, the ship's pad.
    expect(at(27, 42)).toBe(T.BRICK);
    for (const y of [16, 17, 18]) expect(at(24, y)).toBe(T.BRICK);
    for (const y of [43, 44]) expect(at(21, y)).toBe(T.AIR);
    const s = shipSpot();
    for (let x = s.x; x < s.x + 4; x++) expect(at(x, s.y + 1)).not.toBe(T.AIR);
  });

  it('every creature, the statue, the lights and the ship come from its own types (World knows none)', () => {
    const make = escapeEntities({ onShip() {} });
    const types = new Set(escapeStage().entities.map((e) => e.type));
    expect([...types].sort()).toEqual(['deco', 'ripper', 'ship', 'skree', 'zoomer']);
    for (const e of escapeStage().entities) expect(make(e)).toBeDefined();
    const kinds = (t: string, props?: EntitySpawn['props']) =>
      make({ type: t, x: 3, y: 4, ...(props ? { props } : {}) });
    expect(kinds('zoomer')).toBeInstanceOf(Zoomer);
    expect(kinds('ripper')).toBeInstanceOf(Ripper);
    expect(kinds('skree')).toBeInstanceOf(Skree);
    expect(kinds('ship')).toBeInstanceOf(Ship);
    expect(kinds('deco', { kind: 'chozo' })).toBeInstanceOf(ZebesDecor);
    expect(kinds('goomba')).toBeUndefined();
  });

  it('Samus plays with a kit: Long Beam, ten missiles, one energy tank (60), morph ball and bombs', () => {
    const h = escapeHarness();
    const p = h.scene.player;
    expect(p.def.id).toBe('samus');
    expect(p.hp).toBe(60);
    expect(p.scratch).toMatchObject(ESCAPE_KIT);
    expect(h.scene.state.lives).toBe(1);
    expect(h.world.time).toBeNull();
  });

  it('no READY: Samus materialises to her start jingle; she cannot move and the clock waits; then the escape', () => {
    const h = escapeHarness({ assets: STUB_ASSETS });
    const p = h.scene.player;
    const x = p.body.x;
    expect(h.log.jingles).toEqual([ZEBES_SOUNDS.start]);
    expect(p.hidden).toBe(true);
    const r = new TextRenderer();
    h.scene.render(r);
    expect(r.texts).not.toContain('READY');
    h.step(['right'], APPEAR_FRAMES - 1);
    expect(h.scene.phase).toBe('appear');
    expect(p.body.x).toBe(x);
    expect(h.scene.left).toBe(COUNTDOWN_FRAMES);
    expect(h.log.music).toEqual([]);
    h.step([], 1);
    expect(h.scene.phase).toBe('escape');
    expect(p.hidden).toBe(false);
    expect(h.log.music).toEqual([ZEBES_SOUNDS.escape]);
    expect(h.log.sfx).toContain(ZEBES_SOUNDS.alarm);
    expect(h.said.at(-1)).toBe(`Time bomb set! Get out fast! ${COUNTDOWN_SECONDS} seconds.`);
    expect(h.scene.banner?.lines).toEqual(['TIME BOMB SET', 'GET OUT FAST!']);
    expect(h.said[0]).toMatch(/Zebes escape.*3 lives/);
  });

  it('materialising: sparkles, then her outline, then Samus herself (sparkles hold still with reduce flashing)', () => {
    const h = escapeHarness();
    const p = h.scene.player;
    const at = (t: number, rf: boolean) => {
      const sprites: string[] = [];
      const rects: string[] = [];
      const r = {
        ...new NullRenderer(),
        rect: (x: number, y: number) => void rects.push(`${x},${y}`),
        sprite: (sheet: { id: string }, f: string) => void sprites.push(`${sheet.id}:${f}`),
      } as unknown as Renderer;
      drawMaterialise(r, recordingAssets(), p, t, 0, 0, rf);
      return { sprites, rects };
    };
    const early = at(10, true);
    expect(early.sprites).toEqual([]);
    expect(early.rects.length).toBeGreaterThan(0);
    const mid = at(Math.round(APPEAR_FRAMES * 0.6), true);
    expect(mid.sprites).toHaveLength(1);
    expect(mid.sprites[0]).toMatch(/~rim/);
    const late = at(APPEAR_FRAMES - 5, true);
    expect(late.sprites).toHaveLength(1);
    expect(late.sprites[0]).not.toMatch(/~rim/);
    // Twinkling only without reduce flashing.
    const counts = (rf: boolean) => new Set([13, 16, 19, 22].map((t) => at(t, rf).rects.join(' '))).size;
    expect(counts(true)).toBe(1);
    expect(counts(false)).toBeGreaterThan(1);
  });

  it('READY already shows the statue, the alarm lights and the creatures, standing still', () => {
    const h = escapeHarness({ assets: STUB_ASSETS });
    const decor = () => h.world.entities.filter((e): e is ZebesDecor => e instanceof ZebesDecor);
    const creatures = () => h.world.entities.filter((e) => e instanceof Zoomer || e instanceof Ripper);
    expect(h.scene.phase).toBe('appear');
    expect(decor().map((d) => d.name)).toEqual(expect.arrayContaining(['chozo', 'alarm']));
    expect(creatures().length).toBeGreaterThan(0);
    // ...and they are drawn.
    const drawnKinds = new Set<string>();
    for (const e of h.world.entities) {
      const render = e.render.bind(e);
      e.render = (r, v) => {
        drawnKinds.add(e.kind);
        render(r, v);
      };
    }
    h.scene.render(new TextRenderer());
    expect(drawnKinds).toContain('zebes-decor');
    const at = () => creatures().map((e) => [e.body.x, e.body.y]);
    const before = at();
    h.step([], APPEAR_FRAMES - 1);
    expect(h.scene.phase).toBe('appear');
    expect(at()).toEqual(before);
    h.step([], 30);
    expect(h.scene.phase).toBe('escape');
    expect(at()).not.toEqual(before);
  });

  it('the camera climbs with Samus up a shaft and follows her back down', () => {
    const h = escapeHarness();
    ready(h);
    clearCreatures(h);
    expect(h.world.camera.pxY).toBe(45 * 16 - SCREEN_H);
    warp(h, 38 * 16, 28);
    h.step([], 2);
    const high = h.world.camera.pxY;
    expect(high).toBeLessThan(28 * 16 - 100);
    expect(high).toBeGreaterThan(28 * 16 - 240);
    // Off the platform's left end: she drops to the one below and the camera goes with her.
    for (let i = 0; i < 120; i++) h.step(['left']);
    expect(h.world.camera.pxY).toBeGreaterThan(high);
    expect((h.scene.player.body.y + h.scene.player.body.h) >> 12).toBe(31);
    expect(h.scene.player.dead).toBe(false);
  });
});

describe('Zebes Escape: morph ball tunnels and bomb blocks', () => {
  it('a tunnel is a one-tile gap: standing Samus stops at it, in the ball she rolls through', () => {
    const h = escapeHarness();
    ready(h);
    clearCreatures(h);
    h.world.map.set(27, 42, T.AIR); // the bomb block out of the way
    warp(h, 24 * 16, 43);
    h.step(['right'], 150);
    expect(h.scene.player.body.x + h.scene.player.body.w).toBeLessThanOrEqual(tileToSub(26));
    warp(h, 24 * 16, 43, true);
    h.step(['right'], 150);
    expect(h.scene.player.body.x).toBeGreaterThan(tileToSub(29));
    // And she stands up once out (UP, with room above).
    h.tap('up');
    expect(h.scene.player.scratch.ball).toBe(0);
  });

  it('cannot stand up inside the tunnel', () => {
    const h = escapeHarness();
    ready(h);
    clearCreatures(h);
    warp(h, 26 * 16 + 2, 43, true);
    h.tap('up');
    expect(h.scene.player.scratch.ball).toBe(1);
  });

  it("a bomb opens the tunnel's block; the beam does not", () => {
    const h = escapeHarness();
    ready(h);
    clearCreatures(h);
    const p = h.scene.player;
    // Samus cannot shoot from the ball, so a beam shot is fired straight at the block for her:
    // it does not break it.
    h.world.spawn(new Projectile(tileToSub(25), tileToSub(42) + px(4), 1, LONG_BEAM, p));
    h.step([], 40);
    expect(h.world.map.get(27, 42)).toBe(T.BRICK);
    warp(h, 27 * 16 - 12, 43, true);
    h.tap('attack');
    expect(h.world.entities.some((e) => e instanceof Bomb)).toBe(true);
    h.step([], 60);
    expect(h.world.map.get(27, 42)).toBe(T.AIR);
    // The blast does not hurt her.
    expect(p.hp).toBe(60);
  });

  it('the bomb wall: a bomb opens its bottom block, enough to roll under; a missile opens any', () => {
    const h = escapeHarness();
    ready(h);
    clearCreatures(h);
    warp(h, 25 * 16, 19, true);
    h.tap('attack');
    h.step([], 60);
    expect(h.world.map.get(24, 18)).toBe(T.AIR);
    expect(h.world.map.get(24, 17)).toBe(T.BRICK);
    h.step(['left'], 60);
    expect(h.scene.player.body.x).toBeLessThan(tileToSub(23));
    h.world.spawn(new Projectile(tileToSub(26), tileToSub(16) + px(4), -1, MISSILE, h.scene.player));
    h.step([], 30);
    expect(h.world.map.get(24, 16)).toBe(T.AIR);
  });
});

describe('Zebes Escape: the creatures', () => {
  it('a Zoomer creeps round a platform: top, side, underside, side, and back where it began', () => {
    const h = escapeHarness();
    const z = new Zoomer(39, 27, -1);
    const surfaces = new Set<string>();
    const lap = 16 * 16 * ZOOMER_STEP_FRAMES; // 16 tiles round a 5-wide platform
    for (let i = 0; i < lap; i++) {
      z.update(h.world);
      surfaces.add(z.surface);
    }
    expect([...surfaces].sort()).toEqual(['ceiling', 'floor', 'left', 'right']);
    expect(z.cell).toEqual({ x: 39, y: 27 });
    expect(z.dir).toEqual({ x: -1, y: 0 });
    // Two beam shots.
    for (let i = 0; i < ZOOMER_HP; i++) z.hit({ kind: 'buster', amount: 1, owner: null, dirX: 1 }, h.world);
    expect(z.alive).toBe(false);
  });

  it('a Zoomer that loses its surface falls and crawls on from where it lands', () => {
    const h = escapeHarness();
    const z = new Zoomer(10, 38, -1); // in the open chamber
    for (let i = 0; i < 200; i++) z.update(h.world);
    expect(z.falling).toBe(false);
    expect(z.surface).toBe('floor');
    expect(z.cell.y).toBe(42);
  });

  it('a Ripper flies straight between walls; beams glance off, a missile stops it', () => {
    const h = escapeHarness();
    const r = new Ripper(tileToSub(40), tileToSub(32), 1);
    const y = r.body.y;
    let turned = false;
    for (let i = 0; i < 300; i++) {
      r.update(h.world);
      if (r.body.vx < 0) turned = true;
    }
    expect(turned).toBe(true);
    expect(r.body.y).toBe(y);
    expect(r.hit({ kind: 'buster', amount: 1, owner: null, dirX: 1 }, h.world)).toBe('immune');
    expect(r.alive).toBe(true);
    r.hit({ kind: 'weapon', amount: 3, owner: null, dirX: 1 }, h.world);
    expect(r.alive).toBe(false);
  });

  it('a Skree hangs until Samus passes beneath, dives, digs in and bursts into four shards', () => {
    const h = escapeHarness();
    ready(h);
    clearCreatures(h);
    const s = new Skree(tileToSub(8), tileToSub(33));
    h.world.spawn(s);
    warp(h, 60, 43);
    h.step([], 30);
    expect(s.state).toBe('hang');
    warp(h, 8 * 16 + 30, 43);
    h.step([], 2);
    expect(s.state).toBe('dive');
    for (let i = 0; i < 200 && s.state === 'dive'; i++) h.step();
    expect(s.state).toBe('dig');
    h.step([], SKREE_DIG);
    expect(s.alive).toBe(false);
    expect(h.world.entities.filter((e) => e instanceof SkreeShard && e.alive).length).toBe(4);
  });

  it("a Skree's shard and a creature's touch take 8 energy; one beam shot downs a Skree", () => {
    const h = escapeHarness();
    ready(h);
    clearCreatures(h);
    const p = h.scene.player;
    h.world.spawn(new SkreeShard(p.body.x + (p.body.w >> 1), p.body.y + px(8), 0, 0));
    h.step();
    expect(p.hp).toBe(52);
    p.invuln = 0;
    const z = new Zoomer(5, 42, -1);
    z.body.x = p.body.x;
    h.world.spawn(z);
    h.step();
    expect(p.hp).toBe(44);
    const s = new Skree(0, 0);
    s.hit({ kind: 'buster', amount: 1, owner: null, dirX: 1 }, h.world);
    expect(s.alive).toBe(false);
  });
});

describe('Zebes Escape: the countdown', () => {
  it('counts down a second every 60 frames, calls 60, 30 and 10 seconds, and the alarm speeds up at the end', () => {
    const h = escapeHarness({ countdown: 61 * 60 });
    ready(h);
    clearCreatures(h);
    expect(h.scene.seconds).toBe(61);
    h.step([], 60);
    expect(h.scene.seconds).toBe(60);
    expect(h.said).toContain('60 seconds!');
    const alarms = () => h.log.sfx.filter((s) => s === ZEBES_SOUNDS.alarm).length;
    const a0 = alarms();
    h.step([], ALARM_EVERY * 5);
    expect(alarms() - a0).toBe(5);
    h.step([], 30 * 60 - ALARM_EVERY * 5);
    expect(h.said).toContain('30 seconds!');
    h.step([], 20 * 60);
    expect(h.scene.seconds).toBe(10);
    expect(h.said).toContain('10 seconds!');
    expect(h.tempo).toContain(FINAL_TEMPO);
    const a1 = alarms();
    h.step([], ALARM_EVERY_FINAL * 8);
    expect(alarms() - a1).toBeGreaterThanOrEqual(7);
    expect(h.said.filter((s) => /^\d+ seconds!$/.test(s))).toEqual([
      '60 seconds!',
      '30 seconds!',
      '10 seconds!',
    ]);
  });

  it('time out: the cavern blows up (a fade with reduce flashing) and costs a life; the next starts with the clock full', () => {
    const h = escapeHarness({ countdown: 120, keep: true });
    ready(h);
    clearCreatures(h);
    h.step([], 120);
    expect(h.scene.phase).toBe('boom');
    expect(h.log.sfx).toContain(ZEBES_SOUNDS.blast);
    expect(h.said.at(-1)).toBe('Time is up. The cavern exploded. 2 lives left.');
    expect(h.scene.touchLabels()).toMatchObject({ jump: null, attack: null, start: null });
    const first = h.world;
    h.step([], BOOM_FRAMES);
    expect(h.results).toEqual([]);
    expect(h.scene.phase).toBe('appear');
    expect(h.world).not.toBe(first);
    expect(h.scene.left).toBe(120);
    expect(h.log.jingles.filter((j) => j === ZEBES_SOUNDS.start)).toHaveLength(2);
    expect(h.tempo.at(-1)).toBe(1);
  });

  it('time out on the last life: GAME OVER over the white, then fail, once', () => {
    const h = escapeHarness({ countdown: 120, keep: true });
    h.scene.lives.rest = 0;
    ready(h);
    clearCreatures(h);
    h.step([], 120);
    expect(h.said.at(-1)).toBe('Time is up. The cavern exploded. Game over.');
    h.step([], BOOM_FRAMES);
    expect(h.scene.phase).toBe('gameover');
    expect(h.scene.banner?.lines).toEqual(['GAME OVER']);
    h.step([], GAME_OVER_FRAMES - 2);
    expect(h.results).toEqual([]);
    h.step([], 4);
    expect(h.results).toEqual(['fail']);
    for (let i = 0; i < 300; i++) h.step(i % 7 === 0 ? ['start'] : []);
    expect(h.results).toEqual(['fail']);
  });

  it('standing still fails: the countdown runs out on all three lives', () => {
    const h = escapeHarness();
    const life = COUNTDOWN_FRAMES + APPEAR_FRAMES + BOOM_FRAMES;
    for (let i = 0; i < 3 * life + GAME_OVER_FRAMES + 10 && h.results.length === 0; i++) h.step();
    expect(h.results).toEqual(['fail']);
    expect(h.scene.player.dead).toBe(false);
  });
});

describe('Zebes Escape: outcomes', { timeout: 60_000 }, () => {
  it('a full run by the bot passes: Samus boards the ship, it lifts off, then pass (once)', () => {
    const h = escapeHarness({ keep: true });
    const bot = new EscapeBot();
    for (let i = 0; i < 9000 && h.results.length === 0; i++) {
      h.step(bot.next(h.scene));
      if (h.scene.phase === 'liftoff') break;
    }
    expect(h.scene.phase).toBe('liftoff');
    const left = h.scene.seconds;
    expect(left).toBeGreaterThan(30);
    expect(h.scene.player.hidden).toBe(true);
    expect(h.said.at(-1)).toBe(
      `Samus reached her ship with ${left} seconds to spare! The spell on Samus breaks.`,
    );
    expect(h.log.jingles).toContain(ZEBES_SOUNDS.victory);
    expect(h.log.sfx).toContain(ZEBES_SOUNDS.liftoff);
    const ship = h.scene.ship as Ship;
    // The boarding box is one object, kept up to date (no allocation a frame).
    expect(ship.hatch()).toBe(ship.hatch());
    const y = ship.body.y;
    h.step([], LIFTOFF_FRAMES - 2);
    expect(ship.body.y).toBeLessThan(y - px(200));
    // The countdown stopped when she boarded.
    expect(h.scene.seconds).toBe(left);
    h.step([], 4);
    expect(h.results).toEqual(['pass']);
    for (let i = 0; i < 300; i++) h.step(i % 7 === 0 ? ['start'] : []);
    expect(h.results).toEqual(['pass']);
    // The whole route, surface by surface.
    expect(bot.visited.slice(0, 3)).toEqual(['43:1', '43:23', '40:37']);
    expect(bot.visited.at(-1)).toBe('11:36');
  });

  it('falling in the pit costs a life, under No damage too; she materialises again at the start', () => {
    const h = escapeHarness();
    h.game.ctx.assist.invulnerable = true;
    ready(h);
    clearCreatures(h);
    warp(h, 19 * 16, 43);
    for (let i = 0; i < 600 && h.scene.phase !== 'appear'; i++) h.step(['right']);
    expect(h.said).toContain('Samus fell! 2 lives left.');
    expect(h.scene.phase).toBe('appear');
    expect(h.results).toEqual([]);
    expect(Math.floor(h.scene.player.body.x / tileToSub(1))).toBe(ESCAPE_START.x);
  });

  it('losing all energy: Samus explodes with her own sound (no Mario jingle) and loses a life; the last one fails', () => {
    const h = escapeHarness();
    h.scene.lives.rest = 1;
    ready(h);
    expect(h.world.deathStyle).toBe('explode');
    const kill = () => {
      const p = h.scene.player;
      p.hp = 8;
      h.world.spawn(new SkreeShard(p.body.x + (p.body.w >> 1), p.body.y + px(8), 0, 0));
    };
    kill();
    for (let i = 0; i < 400 && h.scene.phase !== 'appear'; i++) h.step();
    expect(h.said).toContain('Samus is down! Last life.');
    expect(h.log.sfx).toContain('samus-death');
    expect(h.log.jingles).not.toContain('death');
    expect(h.scene.player.hp).toBe(ESCAPE_KIT.maxHp);
    expect(h.scene.player.scratch.missiles).toBe(ESCAPE_KIT.missiles);
    ready(h);
    kill();
    for (let i = 0; i < 600 && h.results.length === 0; i++) h.step();
    expect(h.said).toContain('Samus is down! Game over.');
    expect(h.results).toEqual(['fail']);
  });

  it('coming up into the middle corridor is the checkpoint: the next life starts there', () => {
    const h = escapeHarness();
    ready(h);
    clearCreatures(h);
    warp(h, 40 * 16, 19);
    h.step([], 2);
    expect(h.scene.lives.current.id).toBe('mid');
    h.world.kill(h.scene.player);
    for (let i = 0; i < 400 && h.scene.phase !== 'appear'; i++) h.step();
    ready(h);
    const b = h.scene.player.body;
    expect(Math.floor(b.x / tileToSub(1))).toBe(35);
    expect(Math.floor((b.y + b.h - 1) / tileToSub(1))).toBe(18);
  });

  it('dev assist Infinite lives: lives never run out', () => {
    const h = escapeHarness();
    h.game.ctx.assist.infiniteLives = true;
    for (let n = 0; n < 4; n++) {
      ready(h);
      h.world.kill(h.scene.player);
      for (let i = 0; i < 400 && h.scene.phase !== 'appear'; i++) h.step();
      expect(h.scene.phase).toBe('appear');
    }
    expect(h.scene.lives.rest).toBe(2);
    expect(h.results).toEqual([]);
  });

  it('the menu pauses the countdown, offers Continue and Give up (quit)', () => {
    const h = escapeHarness();
    ready(h);
    h.step(['right'], 20);
    const x = h.scene.player.body.x;
    const left = h.scene.left;
    h.tap('start');
    expect(h.game.scenes.top).toBeInstanceOf(EscapeMenuScene);
    h.step(['right'], 120);
    expect(h.scene.player.body.x).toBe(x);
    expect(h.scene.left).toBe(left);
    h.tap('jump'); // Continue
    expect(h.game.scenes.top).toBe(h.scene);
    expect(h.results).toEqual([]);
    h.tap('start');
    h.step([], 8);
    h.tap('down');
    h.tap('jump'); // Give up
    expect(h.results).toEqual(['quit']);
    expect(h.game.scenes.top).toBe(h.below);
  });

  it('in dev mode the menu offers the assists too (not without dev mode)', () => {
    const labels = (dev: boolean) => {
      const h = escapeHarness();
      h.game.deps.settings = { ...defaultSettings(), dev };
      h.step([], 5);
      h.tap('start');
      const menu = h.game.scenes.top as EscapeMenuScene;
      expect(menu).toBeInstanceOf(EscapeMenuScene);
      return { h, items: (menu as unknown as { items: MenuItem[] }).items };
    };
    expect(labels(false).items.map((i) => i.label)).toEqual(['Continue', 'Give up']);
    const { h, items } = labels(true);
    expect(items.map((i) => i.label)).toEqual(['Continue', 'Give up', 'Assists']);
    items[2]?.select?.();
    expect(h.game.scenes.top).toBeInstanceOf(AssistOptionsScene);
  });

  it('dev assist No damage: shards and touches take no energy', () => {
    const h = escapeHarness();
    h.game.ctx.assist.invulnerable = true;
    ready(h);
    const p = h.scene.player;
    for (let i = 0; i < 300; i++) {
      if (i % 30 === 0) h.world.spawn(new SkreeShard(p.body.x + (p.body.w >> 1), p.body.y + px(8), 0, 0));
      h.step();
    }
    expect(p.hp).toBe(60);
  });

  it('dev assist Infinite time: the countdown holds (said once) and never runs out', () => {
    const h = escapeHarness({ countdown: 300 });
    h.game.ctx.assist.infiniteTime = true;
    ready(h);
    clearCreatures(h);
    h.step([], 1200);
    expect(h.scene.seconds).toBe(5);
    expect(h.scene.phase).toBe('escape');
    expect(h.said.filter((s) => s === 'Infinite time: the countdown holds.').length).toBe(1);
    // In the final stretch, held: the music is back to normal speed (once).
    expect(h.tempo.filter((t) => t === 1)).toHaveLength(1);
    expect(h.tempo).not.toContain(FINAL_TEMPO);
    // Turned off again, it runs on from where it held, and the hurry comes back.
    h.game.ctx.assist.infiniteTime = false;
    h.step([], 60);
    expect(h.scene.seconds).toBe(4);
    expect(h.tempo.at(-1)).toBe(FINAL_TEMPO);
    // Held again: normal speed again.
    h.game.ctx.assist.infiniteTime = true;
    h.step([], 2);
    expect(h.tempo.at(-1)).toBe(1);
  });

  it("leaves the campaign's state alone (score, coins, lives, power, hero)", () => {
    const h = escapeHarness();
    const before = { ...h.game.state };
    h.play(new EscapeBot());
    expect(h.results).toEqual(['pass']);
    expect(h.game.state).toEqual(before);
  });
});

describe('Zebes Escape: screen and controls', () => {
  it("labels the touch buttons as Samus's in a level while she runs (BOMB in the ball), only MENU at READY", () => {
    const h = escapeHarness();
    expect(h.scene.touchLabels()).toMatchObject({ jump: null, attack: null, start: 'MENU' });
    ready(h);
    expect(h.scene.touchLabels()).toMatchObject({
      jump: 'JUMP',
      attack: 'SHOOT',
      special: 'MISSILE',
      start: 'MENU',
    });
    clearCreatures(h);
    h.step([], 5);
    h.tap('down');
    expect(h.scene.touchLabels()).toMatchObject({ jump: null, attack: 'BOMB' });
  });

  it('a Skree under the HUD: the HUD text over it gets its dark outline (the HUD stays on top)', () => {
    const h = escapeHarness({ assets: recordingAssets() });
    const sheets = (): string[] => {
      const out: string[] = [];
      const r = Object.assign(new NullRenderer(), {
        text(f: { id: string }, str: string): void {
          if (str.startsWith('EN')) out.push(f.id);
        },
      }) as unknown as Renderer;
      h.scene.render(r);
      return out;
    };
    expect(sheets()).toEqual(['font']);
    // Hanging right under EN (24, 24 on screen).
    const cam = h.world.camera;
    h.world.spawn(new Skree(px(cam.pxX + 28), px(cam.pxY + 20)));
    const drawn = sheets();
    expect(drawn.filter((s) => s.includes('silhouette'))).toHaveLength(4);
    expect(drawn.at(-1)).toBe('font');
  });

  it('the alarm wash swells and fades, but holds steady with reduce flashing', () => {
    const tint = (t: number, rf: boolean) => {
      const r = new TextRenderer();
      drawAlarmTint(r, t, 50, rf);
      return r.rects[0]?.[4];
    };
    expect(new Set([0, 10, 20, 30, 40].map((t) => tint(t, true))).size).toBe(1);
    expect(new Set([0, 10, 20, 30, 40].map((t) => tint(t, false))).size).toBeGreaterThan(1);
  });

  it('the blast flickers white and orange only without reduce flashing; with it, only a fade', () => {
    const colours = (rf: boolean) => {
      const out: string[] = [];
      for (let t = 0; t < 40; t++) {
        const r = new TextRenderer();
        drawBlast(r, t, rf);
        out.push(r.rects[0]?.[4] ?? '');
      }
      return out;
    };
    expect(colours(false)).toContain('#fc7460');
    const calm = colours(true);
    expect(calm.every((c) => c.startsWith('rgba(252,252,252,'))).toBe(true);
    const alphas = calm.map((c) => Number(/,([\d.]+)\)$/.exec(c)?.[1]));
    for (let i = 1; i < alphas.length; i++) expect(alphas[i]).toBeGreaterThanOrEqual(alphas[i - 1] as number);
  });

  it("a Skree's shard glints yellow and red, but holds one colour with reduce flashing", () => {
    const shard = new SkreeShard(0, 0, 0, 0);
    const colours = (rf: boolean) => {
      const out = new Set<string>();
      for (let frame = 0; frame < 16; frame++) {
        const r = new TextRenderer();
        shard.render(r, { camX: 0, frame, assets: STUB_ASSETS, theme: 'cavern', reduceFlashing: rf });
        out.add(r.rects[0]?.[4] ?? '');
      }
      return out;
    };
    expect(colours(false).size).toBe(2);
    expect([...colours(true)]).toEqual(['#f8b800']);
  });

  it('the alarm lights blink, or stay lit with reduce flashing', () => {
    const light = new ZebesDecor('alarm', 0, 0);
    const frames = (reduceFlashing: boolean) =>
      [0, 16, 32, 48].map((frame) => drawn(light, frame, reduceFlashing)[0]?.frame);
    expect(frames(false)).toEqual(['alarm-1', 'alarm-0', 'alarm-1', 'alarm-0']);
    expect(frames(true)).toEqual(['alarm-1', 'alarm-1', 'alarm-1', 'alarm-1']);
  });

  it('creatures face left in the sheet (flipped going right) and flash pale when hit, not with reduce flashing', () => {
    const h = escapeHarness();
    const r = new Ripper(tileToSub(40), tileToSub(32), 1);
    r.update(h.world);
    expect(drawn(r, 0, false)[0]).toMatchObject({ sheet: 'zebes', flipX: true });
    const z = new Zoomer(39, 27, -1);
    z.hit({ kind: 'buster', amount: 1, owner: null, dirX: 1 }, h.world);
    expect(z.alive).toBe(true);
    expect(drawn(z, 0, false)[0]).toMatchObject({ sheet: `zebes@${ZEBES_FLASH}`, flipX: false });
    expect(drawn(z, 0, true)[0]?.sheet).toBe('zebes');
    const s = new Skree(0, 0);
    expect(drawn(s, 0, false)[0]?.frame).toBe('skree-0');
  });

  it('a Zoomer on a wall is drawn from its frames turned a quarter; on a ceiling upside down', () => {
    expect(rotateClockwise(['ab', 'cd'])).toEqual(['ca', 'db']);
    expect(ZEBES_WALL_DEF.frames['zoomer-0']?.[0]).toBe(
      [...(zebesDef.frames['zoomer-0'] ?? [])]
        .reverse()
        .map((row) => row[0])
        .join(''),
    );
    const h = escapeHarness();
    const z = new Zoomer(39, 27, -1);
    const seen = new Map<string, { sheet: string; flipX: boolean; flipY: boolean }>();
    for (let i = 0; i < 16 * 16 * ZOOMER_STEP_FRAMES; i++) {
      z.update(h.world);
      const d = drawn(z, i, true)[0];
      if (d && !seen.has(z.surface)) seen.set(z.surface, d);
    }
    expect(seen.get('floor')).toMatchObject({ sheet: 'zebes', flipY: false });
    expect(seen.get('ceiling')).toMatchObject({ sheet: 'zebes', flipY: true });
    expect(seen.get('left')).toMatchObject({ sheet: ZEBES_WALL_SHEET, flipX: false });
    expect(seen.get('right')).toMatchObject({ sheet: ZEBES_WALL_SHEET, flipX: true });
  });
});
