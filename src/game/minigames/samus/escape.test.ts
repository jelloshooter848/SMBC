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
import { TOURIAN_FRAMES, ZEBES_FLASH, ZEBES_FRAMES, ZEBES_SHEET, ZEBES_SOUNDS } from './art';
import { zebesDef, zebesPalettes } from '@content/sprites/zebes';
import { fontTints } from '@content/sprites/font';
import type { View } from '@game/entities/entity';
import { escapeEntities, escapeStage } from './stage';
import {
  ALARM_EVERY,
  ALARM_EVERY_FINAL,
  BOOM_FRAMES,
  COUNTDOWN_FRAMES,
  COUNTDOWN_SECONDS,
  drawAlarmTint,
  drawBlast,
  drawEnding,
  ENDING_FRAMES,
  ESCAPE_KIT,
  EscapeMenuScene,
  FINAL_TEMPO,
  APPEAR_FRAMES,
  drawMaterialise,
  ESCAPE_START,
} from './scene';
import { GAME_OVER_FRAMES } from '../lives';
import { energyReadout, HUD_X, TANK_BOX, TANKS_Y, TIME_PALETTES, timePalette, timeShown } from './hud';
import { ZebesDecor } from './creatures';
import {
  BrainTank,
  Cannon,
  CannonShot,
  Door,
  Rinka,
  RinkaSpawner,
  Zebetite,
  type TourianHooks,
} from './tourian';
import { EscapeBot, ROUTE } from './bot';
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
    expect(SAMUS_MINIGAME.rules.join(' ')).toMatch(/MISSILES/);
    expect(SAMUS_MINIGAME.rules.join(' ')).toMatch(/BRAIN/);
  });

  it("uses Tourian's theme, songs, sounds, frames and palettes (they exist)", () => {
    const songIds = songs.map((s) => s.id);
    const sfxIds = sfx.map((s) => s.id);
    for (const id of [ZEBES_SOUNDS.tourian, ZEBES_SOUNDS.escape, ZEBES_SOUNDS.victory])
      expect(songIds).toContain(id);
    for (const id of [ZEBES_SOUNDS.alarm, ZEBES_SOUNDS.blast]) expect(sfxIds).toContain(id);
    for (const f of [...ZEBES_FRAMES, ...TOURIAN_FRAMES]) expect(Object.keys(zebesDef.frames)).toContain(f);
    expect(SPRITES[ZEBES_SHEET]).toBe(zebesDef);
    expect(Object.keys(zebesPalettes)).toContain(ZEBES_FLASH);
    expect(escapeStage().theme).toBe('tourian');
    expect(escapeStage().music).toBe(ZEBES_SOUNDS.tourian);
  });

  it("draws Metroid's HUD (tank boxes, EN, a 3-digit missile count; no name, place or score); TIME and the opener once the bomb is set", () => {
    const h = escapeHarness({ assets: STUB_ASSETS });
    const r = new TextRenderer();
    ready(h);
    h.scene.render(r);
    expect(r.texts).toEqual(['EN..30', '030']);
    setBomb(h);
    const r2 = new TextRenderer();
    h.scene.render(r2);
    expect(r2.texts).toEqual(['EN..30', '030', 'TIME 999', 'TIME BOMB SET', 'GET OUT FAST!']);
    expect(r2.texts.join(' ')).not.toMatch(/SAMUS|ZEBES|\d{7}/);
    // One energy tank, full: a filled box.
    const box = r.rects.filter(
      ([x, y, w, hh]) => x === HUD_X + 16 && y === TANKS_Y && w === TANK_BOX && hh === TANK_BOX,
    );
    expect(box).toHaveLength(1);
  });

  it('TIME turns red in the last ten seconds (pulsing, steady with reduce flashing) and grey while Infinite time holds it', () => {
    expect(timePalette('plain', 0, false)).toBeUndefined();
    expect(timePalette('held', 0, false)).toBe(TIME_PALETTES.held);
    const final = (rf: boolean) => new Set([0, 8, 16, 24].map((t) => timePalette('final', t, rf)));
    expect(final(true)).toEqual(new Set([TIME_PALETTES.red]));
    expect(final(false)).toEqual(new Set([TIME_PALETTES.red, TIME_PALETTES.dark]));
    for (const id of Object.values(TIME_PALETTES)) expect(Object.keys(fontTints)).toContain(id);
    // In the scene: which font palette TIME is drawn in.
    const timeSheet = (h: EscapeHarness) => {
      const ids: string[] = [];
      const r = Object.assign(new NullRenderer(), {
        text(f: { id: string }, str: string): void {
          if (str.startsWith('TIME ')) ids.push(f.id);
        },
      }) as unknown as Renderer;
      h.scene.render(r);
      return ids.at(-1);
    };
    const h = escapeHarness({ assets: recordingAssets(), countdown: 15 * 60 });
    ready(h);
    setBomb(h);
    expect(timeSheet(h)).toBe('font');
    h.step([], 6 * 60);
    expect(timeSheet(h)).toBe(`font@${TIME_PALETTES.red}`);
    h.game.ctx.assist.infiniteTime = true;
    h.step();
    expect(timeSheet(h)).toBe(`font@${TIME_PALETTES.held}`);
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
    expect(COUNTDOWN_SECONDS).toBe(60);
    expect(timeShown(1, COUNTDOWN_FRAMES)).toBe(1);
    expect(timeShown(0, COUNTDOWN_FRAMES)).toBe(0);
    const h = escapeHarness();
    ready(h);
    setBomb(h);
    expect(h.scene.time).toBe(999);
    h.step([], (COUNTDOWN_FRAMES / 2) | 0);
    expect(h.scene.time).toBeGreaterThanOrEqual(499);
    expect(h.scene.time).toBeLessThanOrEqual(501);
  });
});

describe('Zebes Escape: the stage', () => {
  it('is kept out of the level library (dev level select, campaign)', () => {
    expect(levelIds()).not.toContain('zebes-escape');
  });

  it('six screens wide and four high with a free camera, the route laid out as the bot knows it', () => {
    const level = escapeStage();
    expect(level.width).toBe(96);
    expect(level.height).toBe(60);
    expect(level.camera).toBe('free');
    const at = (x: number, y: number) => level.tiles[y * level.width + x];
    // Every surface on the route is solid along its top row and clear above.
    for (const r of ROUTE) {
      for (let x = r.at.x0; x <= r.at.x1; x++) {
        expect(at(x, r.at.row), `${r.at.row}:${x}`).not.toBe(T.AIR);
        expect(at(x, r.at.row - 1), `${r.at.row - 1}:${x}`).not.toBe(T.GROUND);
      }
    }
    // The bomb block in the morph-ball tunnel, the tunnel's roof, the shaft's mouth to the sky.
    expect(at(22, 56)).toBe(T.BRICK);
    for (const x of [20, 21, 23]) {
      expect(at(x, 56)).toBe(T.AIR);
      expect(at(x, 55)).toBe(T.GROUND);
    }
    for (let x = 83; x <= 89; x++) expect(at(x, 3)).toBe(T.AIR);
    for (let x = 80; x <= 95; x++) expect(at(x, 0)).toBe(T.AIR);
  });

  it("every door, barrier, guard and light comes from Tourian's own types (World knows none)", () => {
    const hooks: TourianHooks = { active: () => true, calm: () => false, onDoor() {}, onBrain() {} };
    const make = escapeEntities(hooks);
    const types = new Set(escapeStage().entities.map((e) => e.type));
    expect([...types].sort()).toEqual(['brain', 'cannon', 'deco', 'door', 'rinka', 'zebetite']);
    for (const e of escapeStage().entities) expect(make(e)).toBeDefined();
    const kinds = (t: string, props?: EntitySpawn['props']) =>
      make({ type: t, x: 3, y: 4, ...(props ? { props } : {}) });
    expect(kinds('door')).toBeInstanceOf(Door);
    expect(kinds('zebetite')).toBeInstanceOf(Zebetite);
    expect(kinds('brain')).toBeInstanceOf(BrainTank);
    expect(kinds('cannon')).toBeInstanceOf(Cannon);
    expect(kinds('rinka')).toBeInstanceOf(RinkaSpawner);
    expect(kinds('deco', { kind: 'alarm' })).toBeInstanceOf(ZebesDecor);
    expect(kinds('goomba')).toBeUndefined();
  });

  it('Samus plays with a kit: Long Beam, thirty missiles, one energy tank (60), morph ball and bombs', () => {
    const h = escapeHarness();
    const p = h.scene.player;
    expect(p.def.id).toBe('samus');
    expect(p.hp).toBe(60);
    expect(p.scratch).toMatchObject(ESCAPE_KIT);
    expect(h.scene.state.lives).toBe(1);
    expect(h.world.time).toBeNull();
  });

  it('no READY: Samus materialises to her start jingle; she cannot move; then Tourian (its music, no clock)', () => {
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
    expect(h.log.music).toEqual([]);
    h.step([], 1);
    expect(h.scene.phase).toBe('tourian');
    expect(p.hidden).toBe(false);
    expect(h.log.music).toEqual([ZEBES_SOUNDS.tourian]);
    expect(h.log.sfx).not.toContain(ZEBES_SOUNDS.alarm);
    expect(h.scene.banner).toBeNull();
    expect(h.said[0]).toMatch(/Zebes escape.*Tourian.*brain.*3 lives/);
    // The bomb: the escape music, the alarm, the opener and its words.
    setBomb(h);
    expect(h.log.music.at(-1)).toBe(ZEBES_SOUNDS.escape);
    expect(h.log.sfx).toContain(ZEBES_SOUNDS.alarm);
    expect(h.said.at(-1)).toBe(`Time bomb set! Get out fast! ${COUNTDOWN_SECONDS} seconds.`);
    expect(h.scene.banner?.lines).toEqual(['TIME BOMB SET', 'GET OUT FAST!']);
    expect(h.scene.left).toBe(COUNTDOWN_FRAMES);
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

  it('while Samus materialises the guards already show, standing still', () => {
    const h = escapeHarness({ assets: STUB_ASSETS });
    expect(h.scene.phase).toBe('appear');
    const cannon = h.world.entities.find((e): e is Cannon => e instanceof Cannon) as Cannon;
    expect(cannon).toBeDefined();
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
    expect(drawnKinds).toContain('cannon');
    h.step([], APPEAR_FRAMES - 1);
    expect(h.scene.phase).toBe('appear');
    expect(cannon.fired).toBe(0);
    expect(h.world.entities.some((e) => e instanceof Rinka)).toBe(false);
    h.step([], 200);
    expect(h.scene.phase).toBe('tourian');
    expect(cannon.fired + h.world.entities.filter((e) => e instanceof Rinka).length).toBeGreaterThan(0);
  });

  it('the camera climbs with Samus up the shaft and follows her back down', () => {
    const h = escapeHarness();
    ready(h);
    setBomb(h);
    warp(h, 83 * 16, 57);
    h.step([], 2);
    expect(h.scene.room.id).toBe('shaft');
    expect(h.world.camera.pxY).toBe(60 * 16 - SCREEN_H);
    warp(h, 86 * 16, 30);
    h.step([], 2);
    const high = h.world.camera.pxY;
    expect(high).toBeLessThan(30 * 16 - 100);
    expect(high).toBeGreaterThan(30 * 16 - 240);
    // Off the platform's left end: she drops to the one below and the camera goes with her.
    for (let i = 0; i < 120; i++) h.step(['left']);
    expect(h.world.camera.pxY).toBeGreaterThan(high);
    expect((h.scene.player.body.y + h.scene.player.body.h) >> 12).toBe(33);
    expect(h.scene.player.dead).toBe(false);
  });
});

describe('Zebes Escape: morph ball tunnels and bomb blocks', () => {
  it('a tunnel is a one-tile gap: standing Samus stops at it, in the ball she rolls through', () => {
    const h = escapeHarness();
    ready(h);
    h.world.map.set(22, 56, T.AIR); // the bomb block out of the way
    warp(h, 17 * 16, 57);
    clearCreatures(h);
    h.step(['right'], 150);
    expect(h.scene.player.body.x + h.scene.player.body.w).toBeLessThanOrEqual(tileToSub(20));
    warp(h, 18 * 16, 57, true);
    h.step(['right'], 150);
    expect(h.scene.player.body.x).toBeGreaterThan(tileToSub(24));
    // And she stands up once out (UP, with room above).
    h.tap('up');
    expect(h.scene.player.scratch.ball).toBe(0);
  });

  it('cannot stand up inside the tunnel', () => {
    const h = escapeHarness();
    ready(h);
    warp(h, 21 * 16 + 2, 57, true);
    clearCreatures(h);
    h.tap('up');
    expect(h.scene.player.scratch.ball).toBe(1);
  });

  it("a bomb opens the tunnel's block; the beam does not", () => {
    const h = escapeHarness();
    ready(h);
    warp(h, 17 * 16, 57);
    clearCreatures(h);
    const p = h.scene.player;
    // Samus cannot shoot from the ball, so a beam shot is fired straight at the block for her:
    // it does not break it.
    h.world.spawn(new Projectile(tileToSub(20), tileToSub(56) + px(4), 1, LONG_BEAM, p));
    h.step([], 40);
    expect(h.world.map.get(22, 56)).toBe(T.BRICK);
    warp(h, 22 * 16 - 12, 57, true);
    h.tap('attack');
    expect(h.world.entities.some((e) => e instanceof Bomb)).toBe(true);
    h.step([], 60);
    expect(h.world.map.get(22, 56)).toBe(T.AIR);
    // The blast does not hurt her.
    expect(p.hp).toBe(60);
  });

  it('a missile opens the bomb block too', () => {
    const h = escapeHarness();
    ready(h);
    warp(h, 17 * 16, 57);
    clearCreatures(h);
    h.world.spawn(new Projectile(tileToSub(20), tileToSub(56) + px(4), 1, MISSILE, h.scene.player));
    h.step([], 30);
    expect(h.world.map.get(22, 56)).toBe(T.AIR);
  });
});

describe('Zebes Escape: the countdown', () => {
  it('after the bomb: counts down a second every 60 frames, calls 30 and 10 seconds, and the alarm speeds up at the end', () => {
    const h = escapeHarness({ countdown: 60 * 60 });
    ready(h);
    setBomb(h);
    expect(h.scene.seconds).toBe(60);
    const alarms = () => h.log.sfx.filter((s) => s === ZEBES_SOUNDS.alarm).length;
    const a0 = alarms();
    h.step([], ALARM_EVERY * 5);
    expect(alarms() - a0).toBe(5);
    h.step([], 30 * 60 - ALARM_EVERY * 5);
    expect(h.scene.seconds).toBe(30);
    expect(h.said).toContain('30 seconds!');
    h.step([], 20 * 60);
    expect(h.scene.seconds).toBe(10);
    expect(h.said).toContain('10 seconds!');
    expect(h.tempo).toContain(FINAL_TEMPO);
    const a1 = alarms();
    h.step([], ALARM_EVERY_FINAL * 8);
    expect(alarms() - a1).toBeGreaterThanOrEqual(7);
    expect(h.said.filter((s) => /^\d+ seconds!$/.test(s))).toEqual(['30 seconds!', '10 seconds!']);
  });

  it('time out: Tourian blows up (a fade with reduce flashing) and costs a life; the next starts at the shaft with the clock full', () => {
    const h = escapeHarness({ countdown: 120, keep: true });
    ready(h);
    setBomb(h);
    h.step([], 120);
    expect(h.scene.phase).toBe('boom');
    expect(h.log.sfx).toContain(ZEBES_SOUNDS.blast);
    expect(h.said.at(-1)).toBe('Time is up. Tourian exploded. Samus is down! 2 lives left.');
    expect(h.scene.touchLabels()).toMatchObject({ jump: null, attack: null, start: null });
    const first = h.world;
    h.step([], BOOM_FRAMES);
    expect(h.results).toEqual([]);
    expect(h.scene.phase).toBe('appear');
    expect(h.world).not.toBe(first);
    expect(h.scene.left).toBe(120);
    expect(h.log.jingles.filter((j) => j === ZEBES_SOUNDS.start)).toHaveLength(2);
    expect(h.tempo.at(-1)).toBe(1);
    h.step([], APPEAR_FRAMES);
    expect(h.scene.phase).toBe('escape');
    expect(h.scene.room.id).toBe('shaft');
    expect(h.said.at(-1)).toBe('Get out fast! 2 seconds.');
  });

  it('time out on the last life: GAME OVER over the white, then fail, once', () => {
    const h = escapeHarness({ countdown: 120, keep: true });
    h.scene.lives.rest = 0;
    ready(h);
    setBomb(h);
    h.step([], 120);
    expect(h.said.at(-1)).toBe('Time is up. Tourian exploded. Samus is down! Game over.');
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

  it('after the bomb, standing still fails: the countdown runs out on all three lives', () => {
    const h = escapeHarness({ countdown: 600 });
    ready(h);
    setBomb(h);
    const life = 600 + APPEAR_FRAMES + BOOM_FRAMES;
    for (let i = 0; i < 3 * life + GAME_OVER_FRAMES + 10 && h.results.length === 0; i++) h.step();
    expect(h.results).toEqual(['fail']);
    expect(h.scene.player.dead).toBe(false);
  });
});

describe('Zebes Escape: outcomes', { timeout: 60_000 }, () => {
  it('a full run by the bot passes: through Tourian, the brain, up the shaft; the ending plays, then pass (once)', () => {
    const h = escapeHarness({ keep: true });
    const bot = new EscapeBot();
    for (let i = 0; i < 9000 && h.results.length === 0; i++) {
      h.step(bot.next(h.scene));
      if (h.scene.phase === 'ending') break;
    }
    expect(h.scene.phase).toBe('ending');
    const left = h.scene.seconds;
    expect(left).toBeGreaterThan(20);
    expect(h.said.at(-1)).toBe(
      `Samus escaped to the surface with ${left} seconds to spare! The spell on Samus breaks.`,
    );
    expect(h.log.jingles).toContain(ZEBES_SOUNDS.victory);
    // The countdown stopped on the surface.
    h.step([], ENDING_FRAMES - 2);
    expect(h.scene.seconds).toBe(left);
    expect(h.results).toEqual([]);
    h.step([], 4);
    expect(h.results).toEqual(['pass']);
    for (let i = 0; i < 300; i++) h.step(i % 7 === 0 ? ['start'] : []);
    expect(h.results).toEqual(['pass']);
    // The whole route, surface by surface.
    expect(bot.visited.slice(0, 6)).toEqual(['57:1', '55:9', '57:11', '57:33', '57:49', '57:81']);
    expect(bot.visited.at(-1)).toBe('6:85');
  });

  it('losing all energy: Samus explodes with her own sound (no Mario jingle) and loses a life; the last one fails', () => {
    const h = escapeHarness();
    h.scene.lives.rest = 1;
    ready(h);
    expect(h.world.deathStyle).toBe('explode');
    const kill = () => {
      const p = h.scene.player;
      p.hp = 8;
      h.world.spawn(new CannonShot(p.body.x + (p.body.w >> 1), p.body.y + px(8), 0, 0));
    };
    kill();
    for (let i = 0; i < 400 && h.scene.phase !== 'appear'; i++) h.step();
    expect(h.said).toContain('Samus is down! Last life.');
    expect(h.log.sfx).toContain('samus-death');
    expect(h.log.jingles).not.toContain('death');
    expect(h.scene.player.hp).toBe(ESCAPE_KIT.maxHp);
    expect(h.scene.player.scratch.missiles).toBe(ESCAPE_KIT.missiles);
    expect(Math.floor(h.scene.player.body.x / tileToSub(1))).toBe(ESCAPE_START.x);
    ready(h);
    kill();
    for (let i = 0; i < 600 && h.results.length === 0; i++) h.step();
    expect(h.said).toContain('Samus is down! Game over.');
    expect(h.results).toEqual(['fail']);
  });

  it("through the red door is the checkpoint: the next life starts in the brain's chamber", () => {
    const h = escapeHarness();
    ready(h);
    h.scene.lives.set('brain');
    h.world.kill(h.scene.player);
    for (let i = 0; i < 400 && h.scene.phase !== 'appear'; i++) h.step();
    ready(h);
    expect(h.scene.phase).toBe('tourian');
    expect(h.scene.room.id).toBe('brain');
    const b = h.scene.player.body;
    expect(Math.floor(b.x / tileToSub(1))).toBe(50);
    expect(Math.floor((b.y + b.h - 1) / tileToSub(1))).toBe(56);
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
    setBomb(h);
    h.step(['left'], 20);
    const x = h.scene.player.body.x;
    const left = h.scene.left;
    h.tap('start');
    expect(h.game.scenes.top).toBeInstanceOf(EscapeMenuScene);
    h.step(['left'], 120);
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

  it('dev assist No damage: shots and touches take no energy', () => {
    const h = escapeHarness();
    h.game.ctx.assist.invulnerable = true;
    ready(h);
    const p = h.scene.player;
    for (let i = 0; i < 300; i++) {
      if (i % 30 === 0) h.world.spawn(new CannonShot(p.body.x + (p.body.w >> 1), p.body.y + px(8), 0, 0));
      h.step();
    }
    expect(p.hp).toBe(60);
  });

  it('dev assist Infinite time: the countdown holds (said once) and never runs out', () => {
    const h = escapeHarness({ countdown: 300 });
    h.game.ctx.assist.infiniteTime = true;
    ready(h);
    setBomb(h);
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
  it("labels the touch buttons as Samus's in a level while she runs (BOMB in the ball), only MENU while she materialises", () => {
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

  it('a Rinka under the HUD: the HUD text over it gets its dark outline (the HUD stays on top)', () => {
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
    // Right under EN (24, 24 on screen).
    const cam = h.world.camera;
    h.world.spawn(
      new Rinka(px(cam.pxX + 36), px(cam.pxY + 28), {
        active: () => true,
        calm: () => false,
        onDoor() {},
        onBrain() {},
      }),
    );
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

  it("a cannon's shot glints, but holds still with reduce flashing", () => {
    const shot = new CannonShot(0, 0, 0, 0);
    const looks = (rf: boolean) => {
      const out = new Set<string>();
      for (let frame = 0; frame < 16; frame++) {
        const r = new TextRenderer();
        shot.render(r, { camX: 0, frame, assets: STUB_ASSETS, theme: 'tourian', reduceFlashing: rf });
        out.add(r.rects.map((x) => x.join()).join(' '));
      }
      return out;
    };
    expect(looks(false).size).toBe(2);
    expect(looks(true).size).toBe(1);
  });

  it('the alarm lights blink, or stay lit with reduce flashing', () => {
    const light = new ZebesDecor('alarm', 0, 0);
    const frames = (reduceFlashing: boolean) =>
      [0, 16, 32, 48].map((frame) => drawn(light, frame, reduceFlashing)[0]?.frame);
    expect(frames(false)).toEqual(['alarm-1', 'alarm-0', 'alarm-1', 'alarm-0']);
    expect(frames(true)).toEqual(['alarm-1', 'alarm-1', 'alarm-1', 'alarm-1']);
  });

  it('the brain pulses and flashes pale when hit (neither with reduce flashing); a red door is drawn red', () => {
    const h = escapeHarness();
    const brain = new BrainTank(72, 53, { active: () => true, calm: () => false, onDoor() {}, onBrain() {} });
    const frames = (rf: boolean) => new Set([0, 16, 32, 48].map((f) => drawn(brain, f, rf)[0]?.frame));
    expect(frames(false)).toEqual(new Set(['brain-0', 'brain-1']));
    expect(frames(true)).toEqual(new Set(['brain-0']));
    brain.hit({ kind: 'weapon', amount: 3, owner: null, dirX: 1 }, h.world);
    expect(drawn(brain, 0, false)[0]?.sheet).toBe(`zebes@${ZEBES_FLASH}`);
    expect(drawn(brain, 0, true)[0]?.sheet).toBe('zebes');
    // Beams glance off the glass.
    expect(brain.hit({ kind: 'buster', amount: 1, owner: null, dirX: 1 }, h.world)).toBe('immune');
    expect(brain.hits).toBe(1);
    const red = new Door(
      47,
      54,
      'red',
      { active: () => true, calm: () => false, onDoor() {}, onBrain() {} },
      new Map(),
    );
    expect(drawn(red, 0, true)[0]).toMatchObject({ sheet: 'zebes@zebes-red', frame: 'bubble-door' });
    const blue = new Door(
      31,
      54,
      'blue',
      { active: () => true, calm: () => false, onDoor() {}, onBrain() {} },
      new Map(),
    );
    expect(drawn(blue, 0, true)[0]).toMatchObject({ sheet: 'zebes', frame: 'bubble-door' });
    blue.openUp(null);
    expect(drawn(blue, 0, true)[0]?.frame).toBe('bubble-door-open');
  });

  it('the ending: stars come out over the surface and a glow rises from the shaft, steady with reduce flashing', () => {
    const glow = (t: number, rf: boolean) => {
      const r = new TextRenderer();
      drawEnding(r, t, 0, rf);
      return r.rects;
    };
    expect(glow(ENDING_FRAMES - 1, true).length).toBeGreaterThan(glow(10, true).length);
    // With reduce flashing the glow only swells; without, it pulses.
    const last = (t: number, rf: boolean) => Number(/,([\d.]+)\)$/.exec(glow(t, rf).at(-1)?.[4] ?? '')?.[1]);
    const steady = [150, 155, 160, 165, 170].map((t) => last(t, true));
    expect(new Set(steady).size).toBe(1);
    const pulsing = [150, 155, 160, 165, 170].map((t) => last(t, false));
    expect(new Set(pulsing).size).toBeGreaterThan(1);
    // Nothing drawn below the surface's row (the camera far down the shaft).
    const deep = new TextRenderer();
    drawEnding(deep, 100, 400, true);
    expect(deep.rects).toEqual([]);
  });
});
