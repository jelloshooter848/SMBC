import { beforeEach, describe, expect, it, vi } from 'vitest';
import { levelIds } from '@content/levels';
import { songs } from '@content/music/songs';
import { sfx } from '@content/sfx/sfx';
import type { AssetRegistry } from '@engine/assets/registry';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import { px, tileToSub, toPx } from '@engine/math/units';
import { SCREEN_W } from '@engine/viewport';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { defaultSettings } from '@engine/save/settings';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { World } from '@game/world/world';
import type { EntitySpawn } from '@game/level/schema';
import type { Entity } from '@game/entities/entity';
import type { MenuItem } from '@game/scenes/menu';
import { AssistOptionsScene } from '@game/scenes/options';
import { Goomba } from '@game/entities/enemies/goomba';
import { Projectile, BUSTER, CHARGED_BUSTER } from '@game/entities/projectiles/projectile';
import { SAW_DISC } from '@game/characters/megaman/weapons';
import { MAX_HP, MEGAMAN, MEGAMAN_PROFILE } from '@game/characters/megaman';
import { parseTextMap } from '@game/level/textmap';
import { ScriptedInput } from '@game/sim/headless';
import type { Action } from '@engine/input/actions';
import { GAME_OVER_FRAMES } from '../lives';
import { BOSS_BAR_X, LIFE_BAR_X, LIFE_COLOUR, WEAPON_BAR_X } from './hud';
import { NES_GRAVITY, NES_JUMP_V, NES_MEGAMAN } from './nes-form';
import { T } from '@game/level/tiles';
import { miniGameFor } from '..';
import { MEGAMAN_MINIGAME } from '.';
import { DARK_PALETTE, FLASH_PALETTE, MM_SOUNDS } from './art';
import { stationDef, stationPalettes } from '@content/sprites/station';
import { megamanDef, megamanPalettes } from '@content/sprites/megaman';
import { stationEntities, stationStage } from './stage';
import {
  BANNER_COLS,
  BEAM_FRAMES,
  FILL_EVERY,
  ITEM_FREEZE,
  READY_FRAMES,
  StationMenuScene,
  WIN_FRAMES,
  type StationScene,
} from './scene';
import {
  Drone,
  DRONE_HP,
  EnemyShot,
  Hopper,
  HOPPER_WAIT,
  Met,
  MET_HIDE,
  MET_PEEK,
  MET_RANGE,
  MET_UP,
  OrbBurst,
  SHOT_DAMAGE,
  StationDecor,
  Turret,
  TURRET_BURST,
  TURRET_GAP,
  TURRET_OPEN,
  TURRET_SHUT,
  WeaponCapsule,
} from './robots';
import {
  BOSS_DAMAGE,
  BOSS_HP,
  BOSS_IFRAMES,
  CHARGE_DAMAGE,
  CONTACT_DAMAGE,
  DARK_BUSTER,
  DARK_CHARGE,
  DarkMegaMan,
} from './dark-megaman';
import { SHARP, StationBot } from './bot';
import { stationHarness, type StationHarness } from './harness';
import { StationWeaponScene } from './weapon-menu';
import { LevelScene } from '@game/scenes/level';
import { PauseScene } from '@game/scenes/pause';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

/** A text-recording renderer, so the HUD and banners can be read back. */
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

/** Sheets with no frames: drawing records only the boxes (bars, bands), so the text can be read back. */
const STUB_ASSETS = {
  sheet: () => ({ id: 'stub', image: null, frames: new Map() }),
  has: () => false,
} as unknown as AssetRegistry;

/** Past READY and the beam down: Mega Man can move. */
function ready(h: StationHarness): void {
  h.step([], READY_FRAMES);
  expect(h.scene.phase).toBe('stage');
  for (let i = 0; i < 120 && h.world.beaming; i++) h.step();
  expect(h.world.beaming).toBe(false);
}

/** The bottom run's floor (px): the top of row 43. */
const FLOOR = 43 * 16;
/** Just before the first shutter (px), on the landing room's floor. */
const DOOR = 128 * 16 - 30;

/**
 * Puts Mega Man standing on the floor (or a top at `feet` px) at `x` px, the camera on his screen
 * and its robots fresh.
 */
function warp(h: StationHarness, x: number, feet = FLOOR): void {
  const b = h.scene.player.body;
  b.x = px(x);
  b.y = px(feet) - b.h;
  b.vx = 0;
  b.vy = 0;
  h.scene.enterScreen();
}

/** MENU: the weapon screen opens; its MENU row opens the round's menu (Continue / Give up). */
function openMenu(h: StationHarness): StationMenuScene {
  h.tap('start');
  const screen = h.game.scenes.top as StationWeaponScene;
  expect(screen).toBeInstanceOf(StationWeaponScene);
  for (let i = 0; i < 10 && screen.rows[screen.cursor]?.kind !== 'options'; i++) h.tap('down');
  h.tap('jump');
  const menu = h.game.scenes.top as StationMenuScene;
  expect(menu).toBeInstanceOf(StationMenuScene);
  return menu;
}

/** Into the boss room: walks into the shutter and on until the fight starts. */
function toFight(h: StationHarness): DarkMegaMan {
  ready(h);
  warp(h, DOOR);
  for (let i = 0; i < 1000 && h.scene.phase !== 'fight'; i++) h.step(['right']);
  expect(h.scene.phase).toBe('fight');
  return h.scene.boss as DarkMegaMan;
}

describe('Station Escape: the mini game contract', () => {
  it('frees Mega Man: registered, a title, and rules within the rules card naming abilities', () => {
    expect(miniGameFor('megaman')).toBe(MEGAMAN_MINIGAME);
    expect(MEGAMAN_MINIGAME.hero).toBe('megaman');
    expect(MEGAMAN_MINIGAME.title).toBe('STATION ESCAPE');
    for (const line of MEGAMAN_MINIGAME.rules) expect(line.length).toBeLessThanOrEqual(26);
    const rules = MEGAMAN_MINIGAME.rules.join(' ');
    expect(rules).toMatch(/SHOOT/);
    expect(rules).toMatch(/SLIDE/);
    expect(rules).toMatch(/DARK MEGA MAN/);
    expect(rules).not.toMatch(/\b[ABXYZC] BUTTON|\bPRESS [ABXYZC]\b/);
  });

  it("uses the station's songs, sounds, frames and palettes (they exist)", () => {
    const songIds = songs.map((s) => s.id);
    const sfxIds = sfx.map((s) => s.id);
    for (const id of [MM_SOUNDS.stage, MM_SOUNDS.boss, MM_SOUNDS.victory]) expect(songIds).toContain(id);
    for (const id of [MM_SOUNDS.fill, MM_SOUNDS.beam, MM_SOUNDS.capsule, MM_SOUNDS.dink])
      expect(sfxIds).toContain(id);
    for (const f of [
      'hopper-0',
      'hopper-1',
      'met-0',
      'met-1',
      'turret-0',
      'turret-1',
      'drone-0',
      'drone-1',
      'pellet',
      'capsule-0',
      'capsule-1',
      'shutter',
      'beam-0',
      'beam-1',
      'beam-2',
      'window',
      'console',
      'girder',
    ])
      expect(Object.keys(stationDef.frames)).toContain(f);
    expect(Object.keys(stationPalettes)).toContain(FLASH_PALETTE);
    expect(Object.keys(megamanPalettes)).toContain(DARK_PALETTE);
    expect(Object.keys(megamanDef.frames)).toContain('death-orb');
    expect(stationStage().level.theme).toBe('station');
  });
});

describe('Station Escape: the stage', () => {
  it('is kept out of the level library (dev level select, campaign)', () => {
    expect(levelIds()).not.toContain('mm-station');
  });

  it("Mega Man 2's two shutters after the drop: a one-screen corridor with both in sight, then the 16-wide boss room", () => {
    const { level, shutters, boss, corridorX, roomX } = stationStage();
    expect(level.width).toBe(159);
    expect(shutters).toEqual([
      { x: 128, y: 41 },
      { x: 143, y: 41 },
    ]);
    expect([corridorX, roomX]).toEqual([128, 143]);
    expect(level.width - roomX).toBe(16);
    const at = (x: number, y: number) => level.tiles[y * level.width + x];
    // Each shutter's two tiles are solid in the map, the doorway's floor below them.
    for (const x of [128, 143]) {
      expect(at(x, 41)).toBe(T.HARD);
      expect(at(x, 42)).toBe(T.HARD);
      expect(at(x, 43)).toBe(T.GROUND);
    }
    // The corridor between them is open to walk.
    for (let x = 129; x < 143; x++) for (const y of [41, 42]) expect(at(x, y)).not.toBe(T.HARD);
    expect(boss.x).toBeGreaterThan(roomX);
    // The scene places the shutters and the boss; the map keeps its robots and the capsule.
    expect(level.entities.map((e) => e.type)).not.toContain('shutter');
    expect(level.entities.map((e) => e.type)).not.toContain('dark-megaman');
    const count = (t: string) => level.entities.filter((e) => e.type === t).length;
    expect(count('hopper')).toBe(4);
    expect(count('turret')).toBe(3);
    expect(count('drone')).toBe(4);
    expect(count('met')).toBe(6);
    expect(count('capsule')).toBe(1);
    expect(level.entities.find((e) => e.props?.mount === 'ceiling')?.type).toBe('turret');
  });

  it('every robot and the capsule come from the station types (World knows none of them)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const h = stationHarness();
    ready(h);
    const kinds = new Set<string>();
    // Each screen in turn (its robots come with it), walked across in steps.
    for (const s of stationStage().screens)
      for (let x = s.x; x < s.x + s.w; x += 2) {
        warp(h, x * 16 + 2, (s.y + 13) * 16);
        h.world.update([]);
        for (const e of h.world.entities) kinds.add(e.kind);
      }
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
    for (const k of ['hopper', 'turret', 'drone', 'met', 'capsule', 'shutter']) expect(kinds).toContain(k);
  });

  it("World's extraEntities: an entity takes the spawn, null drops it, undefined leaves it to World", () => {
    const level = {
      ...stationStage().level,
      entities: [
        { type: 'hopper', x: 4, y: 12 },
        { type: 'goomba', x: 6, y: 12 },
      ],
    };
    const station = stationEntities({ onCapsule: () => undefined });
    const run = (hook: (s: EntitySpawn) => Entity | null | undefined) => {
      const world = new World(
        level,
        { assets: STUB_ASSETS, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
        newGameState(MEGAMAN),
        { extraEntities: hook },
      );
      world.update([]);
      return world;
    };
    // null for a type World knows: dropped, no Goomba.
    const dropped = run((s) => (s.type === 'goomba' ? null : station(s)));
    expect(dropped.entities.some((e) => e instanceof Hopper)).toBe(true);
    expect(dropped.entities.some((e) => e instanceof Goomba)).toBe(false);
    // undefined: World makes it as usual.
    const kept = run(station);
    expect(kept.entities.some((e) => e instanceof Hopper)).toBe(true);
    expect(kept.entities.some((e) => e instanceof Goomba)).toBe(true);
  });

  it('Mega Man plays with the helmet kit: buster, charge shot, slide, full health; no weapons yet', () => {
    const h = stationHarness();
    const p = h.scene.player;
    expect(p.def).toBe(NES_MEGAMAN);
    expect(p.def.id).toBe('megaman');
    expect(p.hp).toBe(MAX_HP);
    expect(p.scratch.helmet).toBe(1);
    expect(p.scratch.weapons ?? 0).toBe(0);
    expect(MEGAMAN.tools?.(p).map((t) => t.id)).not.toContain('saw');
  });

  it('READY blinks on the empty spot with the stage music playing; then Mega Man beams down, and only then moves', () => {
    const h = stationHarness();
    const p = h.scene.player;
    const x = p.body.x;
    expect(h.log.music).toEqual([MM_SOUNDS.stage]);
    expect(p.hidden).toBe(true);
    h.step(['right'], READY_FRAMES - 1);
    expect(p.hidden).toBe(true);
    expect(p.body.x).toBe(x);
    expect(h.log.sfx).not.toContain(MM_SOUNDS.beam);
    // The beam comes down; he appears where it lands, then can move.
    h.step(['right']);
    expect(h.scene.phase).toBe('stage');
    let frames = 0;
    for (; frames < 120 && h.world.beaming; frames++) {
      expect(p.body.x).toBe(x);
      h.step(['right']);
    }
    expect(frames).toBeGreaterThan(10);
    expect(p.hidden).toBe(false);
    expect(h.log.sfx).toContain(MM_SOUNDS.beam);
    h.step(['right'], 10);
    expect(p.body.x).toBeGreaterThan(x);
    expect(h.log.music).toEqual([MM_SOUNDS.stage]);
    expect(h.said[0]).toMatch(/Station escape.*Dark Mega Man.*3 lives.*Ready!/);
  });
});

describe('Station Escape: the robots', () => {
  it('a Hopper crouches, then jumps toward Mega Man, short and tall in turn; three buster shots', () => {
    const h = stationHarness();
    ready(h);
    warp(h, 120);
    h.step([], 2);
    const hop = h.world.entities.find((e) => e instanceof Hopper) as Hopper;
    expect(hop).toBeDefined();
    h.scene.player.invuln = 100000;
    const x0 = hop.body.x;
    let air = 0;
    for (let i = 0; i < HOPPER_WAIT + 4; i++) {
      h.step();
      if (!hop.body.onGround) air++;
    }
    expect(air).toBeGreaterThan(0);
    expect(hop.facing).toBe(-1);
    for (let i = 0; i < 40; i++) h.step();
    expect(hop.body.x).toBeLessThan(x0);
    // Three buster shots.
    for (let i = 0; i < 3; i++) hop.hit({ kind: 'buster', amount: 1, owner: null, dirX: 1 }, h.world);
    expect(hop.alive).toBe(false);
  });

  it('a Turret turns shots away while shut, opens and fires a burst of pellets at Mega Man, then takes hits', () => {
    const h = stationHarness();
    ready(h);
    warp(h, 400);
    h.step();
    const t = h.world.entities.find((e) => e instanceof Turret && e.mount === 'floor') as Turret;
    expect(t).toBeDefined();
    expect(t.open).toBe(false);
    expect(t.hit({ kind: 'buster', amount: 1, owner: null, dirX: 1 }, h.world)).toBe('immune');
    h.scene.player.invuln = 100000;
    let pellets = 0;
    const seen = new Set<number>();
    for (let i = 0; i < TURRET_SHUT + TURRET_OPEN + TURRET_GAP * TURRET_BURST; i++) {
      h.step();
      for (const e of h.world.entities)
        if (e instanceof EnemyShot && e.kind === 'pellet' && !seen.has(e.id)) {
          seen.add(e.id);
          pellets++;
          // Aimed back toward Mega Man (left of it), never down.
          expect(e.body.vx).toBeLessThan(0);
          expect(e.body.vy).toBeLessThanOrEqual(0);
        }
    }
    expect(pellets).toBe(TURRET_BURST);
    expect(t.open).toBe(true);
    for (let i = 0; i < 3; i++) t.hit({ kind: 'buster', amount: 1, owner: null, dirX: 1 }, h.world);
    expect(t.alive).toBe(false);
  });

  it('a pellet takes 2 of Mega Man’s hit points; his own touch damage stays 4', () => {
    const h = stationHarness();
    ready(h);
    const p = h.scene.player;
    const b = p.body;
    h.world.spawn(new EnemyShot(b.x + b.w + px(2), b.y + px(8), -0x01800, 0, DARK_BUSTER, null));
    h.step([], 3);
    expect(p.hp).toBe(MAX_HP - SHOT_DAMAGE);
    expect(p.invuln).toBeGreaterThan(0);
  });

  it('a Drone sways while drifting over, dives on Mega Man standing below, and climbs back; two shots', () => {
    const h = stationHarness();
    ready(h);
    warp(h, 400);
    h.step();
    const d = h.world.entities.find((e) => e instanceof Drone) as Drone;
    expect(d).toBeDefined();
    h.scene.player.invuln = 100000;
    const y0 = d.body.y;
    const ys = new Set<number>();
    const phases = new Set<string>();
    for (let i = 0; i < 400; i++) {
      h.step();
      ys.add(d.body.y);
      phases.add(d.phase);
    }
    expect(ys.size).toBeGreaterThan(10);
    expect(phases).toContain('dive');
    expect(phases).toContain('rise');
    expect(Math.max(...ys)).toBeGreaterThan(y0 + px(48));
    expect(d.hp).toBe(DRONE_HP);
    for (let i = 0; i < DRONE_HP; i++) d.hit({ kind: 'buster', amount: 1, owner: null, dirX: 1 }, h.world);
    expect(d.alive).toBe(false);
  });

  it('a Met hides under its hard hat (a shot bounces off with a dink), peeks up when Mega Man comes near, fires a three-way spread and hides again; one shot when it is up', () => {
    const h = stationHarness();
    ready(h);
    const p = h.scene.player;
    p.invuln = 100000;
    // A Met on the floor 64 px ahead of Mega Man.
    const met = new Met(p.body.x + px(64), p.body.y + p.body.h - px(14));
    h.world.spawn(met);
    expect(met.state).toBe('hide');
    const sfx = h.log.sfx.length;
    expect(met.hit({ kind: 'buster', amount: 1, owner: null, dirX: 1 }, h.world)).toBe('immune');
    expect(h.log.sfx.slice(sfx)).toContain(MM_SOUNDS.dink);
    const states = new Set<string>();
    const shots: EnemyShot[] = [];
    for (let i = 0; i < MET_HIDE + MET_PEEK + MET_UP + 10; i++) {
      h.step();
      states.add(met.state);
      for (const e of h.world.entities) if (e instanceof EnemyShot && !shots.includes(e)) shots.push(e);
    }
    expect([...states]).toEqual(expect.arrayContaining(['hide', 'peek', 'up']));
    expect(met.state).toBe('hide');
    // Three shots at once, toward Mega Man: one level, one up and one down the same slant.
    expect(shots).toHaveLength(3);
    for (const sh of shots) expect(sh.body.vx).toBeLessThan(0);
    const vys = shots.map((sh) => Math.sign(sh.body.vy)).sort();
    expect(vys).toEqual([-1, 0, 1]);
    // Up again: one buster shot finishes it.
    for (let i = 0; i < 200 && met.state !== 'up'; i++) h.step();
    expect(met.state).toBe('up');
    met.hit({ kind: 'buster', amount: 1, owner: null, dirX: 1 }, h.world);
    expect(met.alive).toBe(false);
  });

  it('a Met far from Mega Man stays hidden', () => {
    const h = stationHarness();
    ready(h);
    const p = h.scene.player;
    const met = new Met(p.body.x + px(MET_RANGE + 40), p.body.y + p.body.h - px(14));
    h.world.spawn(met);
    for (let i = 0; i < MET_HIDE * 3; i++) {
      h.step();
      expect(met.state).toBe('hide');
    }
  });

  it('the stage has Mets on its floors', () => {
    expect(stationStage().level.entities.filter((e) => e.type === 'met').length).toBeGreaterThanOrEqual(2);
  });

  it('robots leave Mega Man’s drops (health and weapon pellets, now and then an E-tank for the weapon screen)', () => {
    const h = stationHarness();
    const kinds = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const hop = new Hopper(px(200), px(190));
      h.world.spawn(hop);
      for (let k = 0; k < 3; k++)
        hop.hit({ kind: 'buster', amount: 1, owner: h.scene.player, dirX: 1 }, h.world);
    }
    for (const e of h.world.entities)
      if (e.kind === 'pickup') kinds.add((e as unknown as { item: string }).item);
    expect(kinds).toContain('health-small');
    expect(kinds).toContain('weapon-small');
    expect(kinds).toContain('e-tank');
  });
});

describe('Station Escape: the weapon capsule', () => {
  it('unlocks the Saw Disc: the station holds still, a banner and the announcer say how to switch and fire it', () => {
    const h = stationHarness();
    ready(h);
    warp(h, 548, FLOOR - 32);
    for (let i = 0; i < 60 && h.scene.phase === 'stage'; i++) h.step(['right']);
    expect(h.scene.phase).toBe('item');
    const p = h.scene.player;
    expect(p.scratch.weapons).toBe(1);
    expect(MEGAMAN.tools?.(p).map((t) => t.id)).toContain('saw');
    expect(h.world.entities.some((e) => e instanceof WeaponCapsule && e.alive)).toBe(false);
    expect(h.log.sfx).toContain(MM_SOUNDS.capsule);
    const lines = h.scene.banner?.lines ?? [];
    expect(lines[0]).toBe('YOU GOT SAW DISC!');
    expect(lines.join(' ')).toMatch(/WEAPON.*SWITCH/);
    expect(lines.join(' ')).toMatch(/USE WEAPON.*FIRE/);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(BANNER_COLS);
    expect(h.said.at(-1)).toMatch(/Saw Disc.*USE WEAPON.*WEAPON/);
    // Held still for a moment.
    const x = p.body.x;
    h.step(['right'], ITEM_FREEZE - 2);
    expect(p.body.x).toBe(x);
    h.step(['right'], 4);
    expect(h.scene.phase).toBe('stage');
    // It is in hand at once (the belt's first, 0.4.35: no buster entry); USE WEAPON throws one.
    expect(h.scene.touchLabels().special).toBe('SAW');
    h.tap('special');
    expect(h.world.entities.some((e) => e instanceof Projectile && e.kind === 'saw')).toBe(true);
  });
});

describe('Station Escape: the capsule cannot be skipped', { timeout: 60_000 }, () => {
  it.each([8, 12, 20, 40])(
    'bunny-hopping right over the pillar (jump held %i frames) still takes the Saw Disc, from any take-off',
    (hold) => {
      for (const start of [360, 400, 430, 460, 490, 520]) {
        const h = stationHarness();
        h.game.ctx.assist.invulnerable = true; // no knockback: only the hops decide
        ready(h);
        warp(h, start);
        const p = h.scene.player;
        // Jump again the moment he lands (letting go for a frame first, so it is a new press).
        let held = 0;
        let was = false;
        for (let i = 0; i < 600 && toPx(p.body.x) < 700 && !p.dead; i++) {
          if (h.scene.phase !== 'stage') {
            h.step();
            continue;
          }
          if (held === 0 && p.body.onGround && !was) held = hold;
          was = held > 0;
          h.step(was ? ['right', 'jump'] : ['right']);
          if (held > 0) held--;
        }
        // A tap (8 frames) is too low for the pillar with Mega Man 2's jump: he stays behind it.
        const past = toPx(p.body.x) >= 600;
        if (hold >= 12) expect(past, `hold ${hold} from x ${start} got past the pillar`).toBe(true);
        if (past) expect(p.scratch.weapons ?? 0, `hold ${hold} from x ${start}`).toBe(1);
      }
    },
  );
});

describe('Station Escape: the boss gate', () => {
  it('the first shutter opens when touched, Mega Man walks through, it shuts behind him, and the camera locks on the corridor', () => {
    const h = stationHarness();
    ready(h);
    warp(h, DOOR);
    const cam = h.world.camera;
    for (let i = 0; i < 100 && h.scene.phase === 'stage'; i++) h.step(['right']);
    expect(h.scene.phase).toBe('gate');
    expect(h.said.at(-1)).toBe('The shutter opens.');
    // The robots and their shots are gone, as on a screen change.
    expect(h.world.enemies.filter((e) => !(e instanceof DarkMegaMan))).toEqual([]);
    expect(h.log.sfx).toContain('door-open');
    const corridorPx = tileToSub(128);
    expect(cam.x).toBeLessThan(corridorPx);
    let walkedIn = false;
    for (let i = 0; i < 400 && h.scene.phase === 'gate'; i++) {
      h.step(['left']); // the player's input means nothing now
      if (h.world.map.get(128, 42) === T.AIR) walkedIn = true;
    }
    expect(walkedIn).toBe(true);
    // The corridor: Mega Man plays again, the stage music on, no boss and no boss bar yet.
    expect(h.scene.phase).toBe('stage');
    expect(h.scene.shutters[0]?.state).toBe('shut');
    expect(h.world.map.get(128, 41)).toBe(T.HARD);
    expect(h.world.map.get(128, 42)).toBe(T.HARD);
    expect(cam.x).toBe(corridorPx);
    expect(cam.locked).toBe(true);
    expect(h.scene.player.body.x).toBeGreaterThan(tileToSub(129));
    expect(h.scene.bossBarValue()).toBeNull();
    expect(h.log.music.at(-1)).toBe(MM_SOUNDS.stage);
    // Locked: standing about never moves the camera (on the bottom screen row all along).
    h.step([], 100);
    expect(cam.x).toBe(corridorPx);
    expect(cam.y).toBe(tileToSub(30));
  });

  it('the second shutter, at the end of the corridor, opens into the boss room: the camera locks there, then the bar fills', () => {
    const h = stationHarness();
    ready(h);
    warp(h, DOOR);
    const cam = h.world.camera;
    for (let i = 0; i < 600 && h.scene.nextGate === 0; i++) h.step(['right']);
    for (let i = 0; i < 400 && h.scene.phase === 'stage'; i++) h.step(['right']);
    expect(h.scene.phase).toBe('gate');
    expect(h.scene.shutter).toBe(h.scene.shutters[1]);
    for (let i = 0; i < 400 && h.scene.phase === 'gate'; i++) h.step(['left']);
    expect(h.scene.phase).toBe('intro');
    expect(h.scene.shutters[1]?.state).toBe('shut');
    expect(h.world.map.get(143, 42)).toBe(T.HARD);
    expect(cam.x).toBe(tileToSub(143));
    expect(cam.locked).toBe(true);
    expect(h.scene.player.body.x).toBeGreaterThan(tileToSub(144));
    expect(h.log.music.at(-1)).toBe(MM_SOUNDS.boss);
    h.step([], 300);
    expect(cam.x).toBe(tileToSub(143));
  });

  it('Dark Mega Man beams in and his bar fills tick by tick (a boss-fill each) while Mega Man waits; then the fight', () => {
    const h = stationHarness();
    ready(h);
    warp(h, DOOR);
    for (let i = 0; i < 500 && h.scene.phase !== 'intro'; i++) h.step(['right']);
    expect(h.log.music.at(-1)).toBe(MM_SOUNDS.boss);
    expect(h.said.at(-1)).toBe('Dark Mega Man!');
    const p = h.scene.player;
    const x = p.body.x;
    h.step(['left', 'attack'], BEAM_FRAMES);
    expect(h.scene.boss).toBeInstanceOf(DarkMegaMan);
    const bars: number[] = [];
    const fills = () => h.log.sfx.filter((s) => s === MM_SOUNDS.fill).length;
    const before = fills();
    for (let i = 0; i < 200 && h.scene.phase === 'intro'; i++) {
      h.step(['left', 'jump', 'attack']);
      bars.push(h.scene.bossBar);
    }
    expect(h.scene.phase).toBe('fight');
    // Frozen the whole time: no steps, no shots.
    expect(p.body.x).toBe(x);
    expect(h.world.entities.some((e) => e instanceof Projectile)).toBe(false);
    // One segment at a time, FILL_EVERY frames apart, each with its tick.
    expect(fills() - before).toBe(BOSS_HP);
    // 0, 1, 2 ... 28: each change one more segment.
    const changes = bars.filter((b, i) => b !== (i > 0 ? bars[i - 1] : 0));
    expect(changes).toEqual(Array.from({ length: BOSS_HP }, (_, i) => i + 1));
    const first = bars.indexOf(1);
    const second = bars.indexOf(2);
    expect(second - first).toBe(FILL_EVERY);
    expect(h.scene.boss?.awake).toBe(true);
    expect(h.scene.bossBarValue()).toBe(BOSS_HP);
  });
});

describe('Station Escape: Dark Mega Man', () => {
  it('is asleep (cannot be hurt, does not hurt) until his bar is full', () => {
    const h = stationHarness();
    ready(h);
    warp(h, DOOR);
    for (let i = 0; i < 500 && !h.scene.boss; i++) h.step(['right']);
    const boss = h.scene.boss as DarkMegaMan;
    expect(boss.hit({ kind: 'buster', amount: 1, owner: null, dirX: 1 }, h.world)).toBe('immune');
    expect(boss.contactHurts).toBe(false);
    expect(boss.hp).toBe(BOSS_HP);
  });

  it("takes the buster, the charge shot and the Saw Disc (his weakness), with a moment's invulnerability after each", () => {
    const h = stationHarness();
    const boss = toFight(h);
    const p = h.scene.player;
    const shoot = (spec: typeof BUSTER) => {
      boss.iframes = 0;
      const pr = new Projectile(boss.body.x, boss.body.y + px(8), 1, spec, p);
      const hp = boss.hp;
      boss.hit({ kind: spec.damage, amount: spec.amount, owner: pr, dirX: 1 }, h.world);
      return hp - boss.hp;
    };
    expect(shoot(BUSTER)).toBe(BOSS_DAMAGE.buster);
    expect(shoot(CHARGED_BUSTER)).toBe(BOSS_DAMAGE['buster-charged']);
    expect(shoot(SAW_DISC)).toBe(BOSS_DAMAGE.saw);
    expect(BOSS_DAMAGE.saw).toBeGreaterThan(BOSS_DAMAGE.buster as number);
    expect(boss.iframes).toBe(BOSS_IFRAMES);
    const hp = boss.hp;
    boss.hit({ kind: 'buster', amount: 1, owner: null, dirX: 1 }, h.world);
    expect(boss.hp).toBe(hp);
    // Through the world too: a real buster shot into him.
    boss.iframes = 0;
    h.world.spawn(new Projectile(boss.body.x - px(10), boss.body.y + px(8), 1, BUSTER, p));
    h.step();
    expect(boss.hp).toBeLessThan(hp);
  });

  it('hurts like Mega Man: his touch 4, his buster 2, his charge shot 6', () => {
    expect(CONTACT_DAMAGE).toBe(4);
    expect(DARK_BUSTER.damage).toBe(2);
    expect(DARK_CHARGE.damage).toBe(CHARGE_DAMAGE);
    expect(CHARGE_DAMAGE).toBe(6);
    const h = stationHarness();
    const boss = toFight(h);
    const p = h.scene.player;
    const hit = (f: () => void) => {
      p.invuln = 0;
      const hp = p.hp;
      f();
      return hp - p.hp;
    };
    expect(
      hit(() => {
        h.world.spawn(new EnemyShot(p.body.x + p.body.w, p.body.y + px(5), -0x04000, 0, DARK_CHARGE, boss));
        h.step([], 2);
      }),
    ).toBe(6);
    expect(
      hit(() => {
        h.world.spawn(new EnemyShot(p.body.x + p.body.w, p.body.y + px(8), -0x04000, 0, DARK_BUSTER, boss));
        h.step([], 2);
      }),
    ).toBe(2);
    expect(
      hit(() => {
        for (const e of h.world.entities) if (e instanceof EnemyShot) e.destroy();
        boss.body.x = p.body.x;
        boss.body.y = p.body.y;
        h.step();
      }),
    ).toBe(4);
  });

  it('plays a seeded pattern: the same inputs give the same fight, and he runs, jumps, fires volleys, slides and charges', () => {
    const fight = () => {
      const h = stationHarness();
      const boss = toFight(h);
      h.game.ctx.assist.invulnerable = true;
      // Mega Man hops and shoots now and then.
      for (let i = 0; i < 2400; i++) h.step(i % 50 < 20 ? ['jump'] : i % 9 === 0 ? ['attack'] : []);
      return boss.log.map((s) => `${s.state}@${s.x},${s.y}`);
    };
    const a = fight();
    expect(fight()).toEqual(a);
    const states = new Set(a.map((s) => s.split('@')[0]));
    for (const s of ['stand', 'run', 'jump', 'volley', 'slide', 'charge']) expect(states).toContain(s);
  });

  it('a volley is three shots', () => {
    const h = stationHarness();
    const boss = toFight(h);
    h.game.ctx.assist.invulnerable = true;
    const shots = new Set<number>();
    let volleys = 0;
    let prev = '';
    for (let i = 0; i < 3000 && volleys < 3; i++) {
      h.step();
      for (const e of h.world.entities)
        if (e instanceof EnemyShot && e.kind === 'dark-buster') shots.add(e.id);
      if (prev === 'volley' && boss.state !== 'volley') volleys++;
      prev = boss.state;
    }
    expect(volleys).toBe(3);
    expect(shots.size).toBeGreaterThanOrEqual(9);
  });
});

describe('Station Escape: outcomes', { timeout: 60_000 }, () => {
  it('a full run by the bot passes: the orb burst, the jingle, Mega Man beams out, then pass (once)', () => {
    const h = stationHarness({ keep: true });
    const frames = h.play(new StationBot(SHARP));
    expect(h.results).toEqual(['pass']);
    expect(frames).toBeLessThan(6000);
    expect(h.log.jingles).toContain(MM_SOUNDS.victory);
    expect(h.log.sfx.filter((s) => s === MM_SOUNDS.beam).length).toBeGreaterThanOrEqual(2);
    expect(h.said).toContain('Dark Mega Man is beaten! The spell on Mega Man breaks.');
    for (let i = 0; i < 600; i++) h.step(i % 7 === 0 ? ['start'] : []);
    expect(h.results).toEqual(['pass']);
    expect(h.game.scenes.top).toBe(h.scene);
  });

  it('beating him bursts him into orbs and holds the win before passing', () => {
    const h = stationHarness();
    const boss = toFight(h);
    boss.hp = 1;
    boss.hit({ kind: 'buster', amount: 1, owner: null, dirX: 1 }, h.world);
    expect(boss.alive).toBe(false);
    expect(h.scene.phase).toBe('won');
    expect(h.world.entities.some((e) => e instanceof OrbBurst)).toBe(true);
    h.step([], WIN_FRAMES - 2);
    expect(h.results).toEqual([]);
    h.step([], 4);
    expect(h.results).toEqual(['pass']);
  });

  it('standing still fails: the station wears down all three lives, then GAME OVER, then fail', () => {
    const h = stationHarness({ keep: true });
    let gameOverAt = -1;
    let i = 0;
    for (; i < 30000 && h.results.length === 0; i++) {
      h.step();
      if (gameOverAt < 0 && h.scene.phase === 'gameover') gameOverAt = i;
    }
    expect(h.results).toEqual(['fail']);
    expect(i - gameOverAt).toBe(GAME_OVER_FRAMES + 1);
    expect(h.said).toContain('Mega Man is down! 2 lives left.');
    expect(h.said).toContain('Mega Man is down! Last life.');
    expect(h.said.at(-1)).toBe('Mega Man is down! Game over.');
    expect(h.scene.banner?.lines).toEqual(['GAME OVER']);
    // Reported once, however long the scene is left on top.
    for (let i = 0; i < 600; i++) h.step(i % 7 === 0 ? ['start'] : []);
    expect(h.results).toEqual(['fail']);
    expect(h.game.scenes.top).toBe(h.scene);
  });

  it('falling in a pit costs a life, under No damage too; the next one starts over at the stage start', () => {
    const h = stationHarness();
    h.game.ctx.assist.invulnerable = true;
    ready(h);
    const first = h.world;
    warp(h, 280);
    for (let i = 0; i < 600 && h.scene.phase !== 'ready'; i++) h.step(['right']);
    expect(h.said).toContain('Mega Man fell! 2 lives left.');
    expect(h.results).toEqual([]);
    expect(h.scene.phase).toBe('ready');
    expect(h.world).not.toBe(first);
    expect(h.scene.lives.rest).toBe(1);
    expect(h.scene.player.body.x).toBe(tileToSub(2) + px(2));
    expect(h.scene.player.hp).toBe(MAX_HP);
  });

  it('losing to Dark Mega Man costs a life: the next starts at the boss door, and the fight starts over', () => {
    const h = stationHarness();
    toFight(h);
    expect(h.scene.lives.current.id).toBe('boss');
    h.scene.player.hp = 2;
    for (let i = 0; i < 4000 && h.scene.phase !== 'ready'; i++) h.step();
    expect(h.scene.phase).toBe('ready');
    expect(h.scene.boss).toBeNull();
    expect(h.scene.bossBarValue()).toBeNull();
    expect(h.scene.shutter.state).toBe('shut');
    // The landing room under the drop, before the first shutter.
    expect(Math.floor(toPx(h.scene.player.body.x) / 16)).toBe(116);
    ready(h);
    for (let i = 0; i < 1000 && h.scene.phase !== 'fight'; i++) h.step(['right']);
    expect(h.scene.phase).toBe('fight');
    expect(h.scene.bossBarValue()).toBe(BOSS_HP);
  });

  it('losing to Dark Mega Man with the last life is GAME OVER, then fail', () => {
    const h = stationHarness();
    h.scene.lives.rest = 0;
    toFight(h);
    h.scene.player.hp = 2;
    for (let i = 0; i < 4000 && h.results.length === 0; i++) h.step();
    expect(h.results).toEqual(['fail']);
  });

  it('the menu offers Continue (play resumes where it was) and Give up (quit)', () => {
    const h = stationHarness();
    ready(h);
    h.step(['right'], 20);
    const x = h.scene.player.body.x;
    openMenu(h);
    h.step(['right'], 10);
    expect(h.scene.player.body.x).toBe(x);
    h.tap('jump'); // Continue
    expect(h.game.scenes.top).toBe(h.scene);
    expect(h.results).toEqual([]);
    openMenu(h);
    h.step([], 8);
    h.tap('down');
    h.tap('jump'); // Give up
    expect(h.results).toEqual(['quit']);
    expect(h.game.scenes.top).toBe(h.below);
  });

  it('the menu opens in the boss room too, and Give up quits from there', () => {
    const h = stationHarness();
    toFight(h);
    openMenu(h);
    h.step([], 8);
    h.tap('down');
    h.tap('jump');
    expect(h.results).toEqual(['quit']);
  });

  it('in dev mode the menu offers the assists too (not without dev mode)', () => {
    const labels = (dev: boolean) => {
      const h = stationHarness();
      h.game.deps.settings = { ...defaultSettings(), dev };
      h.step([], 5);
      const menu = openMenu(h);
      return { h, items: (menu as unknown as { items: MenuItem[] }).items };
    };
    expect(labels(false).items.map((i) => i.label)).toEqual(['Continue', 'Give up']);
    const { h, items } = labels(true);
    expect(items.map((i) => i.label)).toEqual(['Continue', 'Give up', 'Assists']);
    items[2]?.select?.();
    expect(h.game.scenes.top).toBeInstanceOf(AssistOptionsScene);
  });

  it('dev assist No damage: robots, pellets and Dark Mega Man take no hit points', () => {
    const h = stationHarness();
    h.game.ctx.assist.invulnerable = true;
    const boss = toFight(h);
    const p = h.scene.player;
    for (let i = 0; i < 1500; i++) {
      if (i % 100 === 0) {
        boss.body.x = p.body.x;
        h.world.spawn(new EnemyShot(p.body.x + p.body.w, p.body.y + px(8), -0x04000, 0, DARK_CHARGE, boss));
      }
      h.step();
    }
    expect(p.hp).toBe(MAX_HP);
    expect(p.dead).toBe(false);
  });

  it("leaves the campaign's state alone (score, coins, lives, power, hero)", () => {
    const h = stationHarness();
    const before = { ...h.game.state };
    h.play(new StationBot(SHARP));
    expect(h.results).toEqual(['pass']);
    expect(h.game.state).toEqual(before);
  });
});

describe("Station Escape: Mega Man 2's weapon screen (MENU)", () => {
  it('MENU opens it with the weapons he has (P first, with his life), E-tanks, lives and the round menu; play stops', () => {
    const h = stationHarness({ assets: STUB_ASSETS });
    ready(h);
    h.step(['right'], 10);
    const x = h.scene.player.body.x;
    h.tap('start');
    const w = h.game.scenes.top as StationWeaponScene;
    expect(w).toBeInstanceOf(StationWeaponScene);
    expect(w.rows.map((r) => (r.kind === 'weapon' ? r.label : r.kind))).toEqual([
      'P',
      'RUSH',
      'etank',
      'options',
    ]);
    expect(w.energy('buster')).toBe(h.scene.player.hp);
    h.step(['right'], 20);
    expect(h.scene.player.body.x).toBe(x);
    const r = new TextRenderer();
    h.game.scenes.render(r);
    expect(r.texts).toEqual(expect.arrayContaining(['P', 'RUSH', 'E-TANK', '×0', 'MENU', 'MEGA MAN ×3']));
    // Abilities, never a bare button letter on its own.
    expect(r.texts.join(' ')).not.toMatch(/\bPRESS [ABXYZC]\b|\b[ABXYZC] BUTTON/);
    expect(h.said.some((t) => t.startsWith('Weapons.'))).toBe(true);
  });

  it('with the Saw Disc, the d-pad picks it and OK goes back to play with it equipped', () => {
    const h = stationHarness();
    ready(h);
    const p = h.scene.player;
    p.scratch.weapons = 1;
    p.scratch.wsaw = 20;
    h.tap('start');
    const w = h.game.scenes.top as StationWeaponScene;
    expect(w.rows.map((r) => (r.kind === 'weapon' ? r.label : r.kind))).toEqual([
      'P',
      'SAW DISC',
      'RUSH',
      'etank',
      'options',
    ]);
    // The saw is in hand already (the belt's first); P above it is the buster, his life.
    expect(w.cursor).toBe(1);
    h.tap('up');
    expect(w.cursor).toBe(0);
    expect(h.said.at(-1)).toMatch(/^Mega Buster, life/);
    h.tap('down');
    expect(w.cursor).toBe(1);
    expect(h.said.at(-1)).toBe('Saw Disc, energy 20 of 28');
    h.tap('jump');
    expect(h.game.scenes.top).toBe(h.scene);
    expect(p.scratch.tool).toBe(0);
    expect(p.def.meter?.(p)?.value).toBe(20);
    // Opened again, the cursor starts on the weapon in hand; up from the top wraps to MENU.
    h.tap('start');
    const again = h.game.scenes.top as StationWeaponScene;
    expect(again.cursor).toBe(1);
    h.tap('up');
    h.tap('up');
    expect(again.rows[again.cursor]?.kind).toBe('options');
  });

  it('an E-tank fills his life from the screen (none, or at full life: nothing happens); they last across lives', () => {
    const h = stationHarness();
    ready(h);
    const p = h.scene.player;
    h.tap('start');
    const w = h.game.scenes.top as StationWeaponScene;
    while (w.rows[w.cursor]?.kind !== 'etank') h.tap('down');
    p.hp = 10;
    h.tap('jump');
    expect(p.hp).toBe(10); // none yet
    expect(h.game.scenes.top).toBe(w);
    p.scratch.etanks = 2;
    h.tap('jump');
    expect(p.hp).toBe(MAX_HP);
    expect(p.scratch.etanks).toBe(1);
    h.tap('jump'); // at full life: nothing
    expect(p.scratch.etanks).toBe(1);
    // A life lost: the next one still has it.
    while (w.rows[w.cursor]?.kind !== 'weapon') h.tap('down');
    h.tap('jump');
    p.hp = 1;
    p.invuln = 0;
    h.world.kill(p);
    for (let i = 0; i < 2000 && h.scene.phase !== 'ready'; i++) h.step();
    expect(h.scene.player.scratch.etanks).toBe(1);
  });

  it('START closes it from any row, as in Mega Man 2 (no E-tank used, no menu stacked over it)', () => {
    const h = stationHarness();
    ready(h);
    const p = h.scene.player;
    p.scratch.weapons = 1;
    p.scratch.wsaw = 20;
    p.scratch.etanks = 2;
    p.hp = 10;
    const depth = h.game.scenes.depth;
    // On the E-tank row: START closes, the tank stays.
    h.tap('start');
    let w = h.game.scenes.top as StationWeaponScene;
    while (w.rows[w.cursor]?.kind !== 'etank') h.tap('down');
    h.tap('start');
    expect(h.game.scenes.top).toBe(h.scene);
    expect(p.scratch.etanks).toBe(2);
    expect(p.hp).toBe(10);
    // On the MENU row: START closes too, the round's menu does not open.
    h.tap('start');
    w = h.game.scenes.top as StationWeaponScene;
    while (w.rows[w.cursor]?.kind !== 'options') h.tap('down');
    h.tap('start');
    expect(h.game.scenes.top).toBe(h.scene);
    expect(h.game.scenes.depth).toBe(depth);
    // On a weapon: START takes it, as OK does.
    h.tap('start');
    expect(h.game.scenes.top).toBeInstanceOf(StationWeaponScene);
    h.tap('down');
    h.tap('start');
    expect(h.game.scenes.top).toBe(h.scene);
    expect(p.scratch.tool).toBe(1);
    // The round's menu (from the MENU row) replaces the screen, never stacks over it.
    openMenu(h);
    expect(h.game.scenes.depth).toBe(depth + 1);
    expect(h.game.scenes.find((s) => s instanceof StationWeaponScene)).toBeUndefined();
  });
});

describe('Station Escape: screen and controls', () => {
  it("draws the first screen's decor from the very first frame (on READY, before the world steps)", () => {
    const h = stationHarness();
    const inView = () =>
      h.world.entities.filter(
        (e) => e instanceof StationDecor && e.alive && toPx(e.body.x) - h.world.camera.pxX < SCREEN_W,
      ).length;
    expect(h.scene.phase).toBe('ready');
    expect(inView()).toBeGreaterThan(0);
    // It is the same decor once play starts: none added late.
    const first = inView();
    ready(h);
    expect(inView()).toBe(first);
  });

  it("labels the touch buttons as Mega Man's in a level while he plays, only MENU in the cut-scenes, none once decided", () => {
    const h = stationHarness();
    expect(h.scene.touchLabels()).toMatchObject({ jump: null, attack: null, start: 'MENU' });
    ready(h);
    const l = h.scene.touchLabels();
    expect(l.jump).toBe('JUMP');
    expect(l.attack).toBe('SHOOT');
    expect(l.start).toBe('MENU');
    warp(h, DOOR);
    for (let i = 0; i < 200 && h.scene.phase === 'stage'; i++) h.step(['right']);
    expect(h.scene.touchLabels()).toMatchObject({ jump: null, attack: null, start: 'MENU' });
    for (let i = 0; i < 1000 && h.scene.phase !== 'fight'; i++) h.step(['right']);
    expect(h.scene.touchLabels().attack).toBe('SHOOT');
    h.scene.player.hp = 1;
    h.scene.player.invuln = 0;
    for (let i = 0; i < 2000 && !h.scene.player.dead; i++) h.step();
    expect(h.scene.touchLabels()).toMatchObject({ jump: null, attack: null, start: null });
  });

  it('draws READY, a HUD of bars only (no names, score or lives), the boss bar beside Mega Man’s once he appears, and the banners', () => {
    const h = stationHarness({ assets: STUB_ASSETS });
    const r = new TextRenderer();
    h.game.scenes.render(r);
    expect(r.texts).toEqual(['READY']);
    // No bars until he has beamed down.
    const lifeBar = () => r.rects.some(([x, , w, , c]) => x === LIFE_BAR_X && w === 6 && c === LIFE_COLOUR);
    expect(lifeBar()).toBe(false);
    ready(h);
    r.texts = [];
    r.rects = [];
    h.game.scenes.render(r);
    expect(r.texts).toEqual([]);
    expect(lifeBar()).toBe(true);
    // The weapon bar shows while a weapon (or Rush) is in hand: the belt has no buster entry
    // since 0.4.35, so with the helmet's Rush it always is.
    h.scene.player.scratch.weapons = 1;
    h.scene.player.scratch.tool = 0;
    r.rects = [];
    h.game.scenes.render(r);
    expect(r.rects.some(([x, , w]) => x === WEAPON_BAR_X && w === 6)).toBe(true);
    h.scene.player.scratch.tool = 0;
    const bossBar = () => r.rects.some(([x, , w, , c]) => x === BOSS_BAR_X && w === 6 && c === '#f83800');
    expect(bossBar()).toBe(false);
    toFight(h);
    r.rects = [];
    h.game.scenes.render(r);
    expect(bossBar()).toBe(true);
    (h.scene.boss as DarkMegaMan).hp = 1;
    (h.scene.boss as DarkMegaMan).hit({ kind: 'buster', amount: 1, owner: null, dirX: 1 }, h.world);
    r.texts = [];
    h.game.scenes.render(r);
    expect(r.texts).toContain('DARK MEGA MAN IS BEATEN!');
  });

  it("Dark Mega Man's hit invulnerability: drawn every frame with reduce flashing, flickering without", () => {
    const drawn = (reduceFlashing: boolean) => {
      const sheets = {
        sheet: (id: string, palette?: string) => ({
          id: `${id}@${palette ?? ''}`,
          image: null,
          frames: new Map(),
        }),
        has: () => true,
      } as unknown as AssetRegistry;
      const h = stationHarness({ assets: sheets });
      h.game.ctx.reduceFlashing = reduceFlashing;
      const boss = toFight(h);
      h.game.ctx.assist.invulnerable = true;
      boss.hit({ kind: 'buster', amount: 1, owner: null, dirX: 1 }, h.world);
      expect(boss.iframes).toBeGreaterThan(8);
      const shown: boolean[] = [];
      for (let i = 0; i < 8; i++) {
        const ids: string[] = [];
        const r = new TextRenderer();
        (r as unknown as { sprite: Renderer['sprite'] }).sprite = (sheet) => void ids.push(sheet.id);
        h.game.scenes.render(r);
        shown.push(ids.includes(`megaman@${DARK_PALETTE}`));
        h.step();
      }
      return shown;
    };
    expect(drawn(true).every(Boolean)).toBe(true);
    expect(drawn(false).some((s) => !s)).toBe(true);
  });

  it('the boss bar shows his hit points in the fight', () => {
    const h = stationHarness();
    const boss = toFight(h);
    boss.hp = 11;
    expect(h.scene.bossBarValue()).toBe(11);
    expect(toPx(boss.body.y)).toBeGreaterThan(100);
  });
});

/** Reference so the tests read the scene type. */
export type { StationScene };

describe('Station Escape: Mega Man in NES form (the campaign kit untouched)', () => {
  it("the campaign's Mega Man keeps the usual pause menu on MENU, not the station's weapon screen", () => {
    const h = stationHarness();
    h.game.newGame(MEGAMAN, '1-1');
    for (let i = 0; i < 400 && !(h.game.scenes.top instanceof LevelScene); i++) h.step();
    expect(h.game.scenes.top).toBeInstanceOf(LevelScene);
    h.tap('start');
    expect(h.game.scenes.top).toBeInstanceOf(PauseScene);
    expect(h.game.scenes.find((sc) => sc instanceof StationWeaponScene)).toBeUndefined();
  });

  /** A flat room for a hero alone, the floor at row 13, a wall at column 14 (rows 9-12). */
  const room = () => {
    const rows: string[] = [];
    for (let y = 0; y < 15; y++) {
      let row = '';
      for (let x = 0; x < 32; x++) row += y >= 13 || (x === 14 && y >= 9) ? '#' : '.';
      rows.push(row);
    }
    return parseTextMap(['id: t', 'theme: castle', 'start: 4,12', '[tiles]', ...rows].join('\n'), 't');
  };
  const solo = (def: typeof MEGAMAN) => {
    const state = newGameState(def);
    state.kit = { helmet: 1 };
    const ctx = {
      assets: STUB_ASSETS,
      audio: NULL_AUDIO,
      assist: { ...DEFAULT_ASSIST },
      reduceFlashing: true,
    };
    const w = new World(room(), ctx, state, { seed: 1 });
    w.time = null;
    const input = new ScriptedInput({ steps: [] });
    const step = (held: Action[] = [], n = 1) => {
      for (let i = 0; i < n; i++) {
        input.setHeld(held);
        input.next();
        w.update([input]);
      }
    };
    step([], 5);
    return { w, step, p: w.player };
  };
  /** A full jump's height (px, feet). */
  const apex = (def: typeof MEGAMAN) => {
    const { p, step } = solo(def);
    const y0 = p.body.y;
    let top = y0;
    for (let i = 0; i < 60; i++) {
      step(['jump']);
      top = Math.min(top, p.body.y);
    }
    return toPx(y0 - top);
  };

  it('jumps about 3 tiles high (Mega Man 2), against the campaign’s 4.3', () => {
    const nes = apex(NES_MEGAMAN);
    expect(nes).toBeGreaterThanOrEqual(46);
    expect(nes).toBeLessThanOrEqual(52);
    expect(apex(MEGAMAN)).toBeGreaterThan(64);
    expect(NES_MEGAMAN.movement.jump[0]).toMatchObject({ initial: NES_JUMP_V, fallGravity: NES_GRAVITY });
  });

  it('the campaign’s Mega Man keeps his own jump, knockback and wall-stopped shots', () => {
    expect(MEGAMAN.movement).toBe(MEGAMAN_PROFILE);
    expect(MEGAMAN_PROFILE.jump[0]).toMatchObject({ initial: 0x05800, holdGravity: 0x00380 });
    expect(MEGAMAN.damage).toMatchObject({ knockback: { vx: 0x00800, vy: 0x01800 } });
    expect(BUSTER.piercesTiles).toBeUndefined();
    expect(CHARGED_BUSTER.piercesTiles).toBeUndefined();
    // And in a level his buster still stops at a wall.
    const { w, step, p } = solo(MEGAMAN);
    p.body.x = tileToSub(11);
    step(['attack']);
    step([], 40);
    expect(w.entities.some((e) => e instanceof Projectile && e.alive && e.body.x > tileToSub(15))).toBe(
      false,
    );
  });

  it('his shots (buster and charge shot) pass through walls', () => {
    const { w, step, p } = solo(NES_MEGAMAN);
    p.body.x = tileToSub(11);
    step(['attack']);
    step([], 30);
    const through = w.entities.filter((e) => e instanceof Projectile && e.alive && e.body.x > tileToSub(15));
    expect(through).toHaveLength(1);
    expect((through[0] as Projectile).spec.piercesTiles).toBe(true);
    // Charged: held, then let go.
    p.body.x = tileToSub(11);
    step(['attack'], 50);
    step([], 30);
    expect(
      w.entities.some(
        (e) => e instanceof Projectile && e.alive && e.kind === 'buster-charged' && e.body.x > tileToSub(15),
      ),
    ).toBe(true);
    // Still three buster shots at most on screen.
    for (let i = 0; i < 10; i++) step(i % 2 ? [] : ['attack']);
    expect(w.countProjectiles(p, 'buster')).toBeLessThanOrEqual(3);
  });

  it('a hit pushes him back without an upward pop (a jump stops rising)', () => {
    const nes = solo(NES_MEGAMAN);
    nes.step(['jump'], 4);
    expect(nes.p.body.vy).toBeLessThan(0);
    nes.w.hurtPlayer(nes.p, -1);
    expect(nes.p.body.vy === 0).toBe(true); // (-0: the push upward is nothing)
    expect(nes.p.body.vx).toBeLessThan(0);
    const camp = solo(MEGAMAN);
    camp.w.hurtPlayer(camp.p, -1);
    expect(camp.p.body.vy).toBeLessThan(0);
  });
});

describe('Station Escape: death, lives and checkpoints', { timeout: 60_000 }, () => {
  it('Mega Man bursts into orbs with his own sound (no Mario jingle); the next life comes after it', () => {
    const h = stationHarness();
    ready(h);
    expect(h.world.deathStyle).toBe('orbs');
    h.world.kill(h.scene.player);
    h.step();
    expect(h.log.sfx).toContain('mm-death');
    expect(h.log.jingles).not.toContain('death');
    expect(h.scene.phase).toBe('dead');
    for (let i = 0; i < 400 && h.scene.phase === 'dead'; i++) h.step();
    expect(h.scene.phase).toBe('ready');
  });

  it('a life lost past the halfway point starts at the checkpoint; the Saw Disc stays his and the capsule stays gone', () => {
    const h = stationHarness();
    ready(h);
    warp(h, 548, FLOOR - 32);
    for (let i = 0; i < 60 && h.scene.phase === 'stage'; i++) h.step(['right']);
    expect(h.scene.sawGot).toBe(true);
    h.step([], ITEM_FREEZE + 2);
    warp(h, 40 * 16 + 4);
    h.step(['right'], 4);
    expect(h.scene.lives.current.id).toBe('mid');
    h.scene.player.scratch.wsaw = 10;
    h.world.kill(h.scene.player);
    for (let i = 0; i < 400 && h.scene.phase !== 'ready'; i++) h.step();
    ready(h);
    const p = h.scene.player;
    expect(Math.floor(toPx(p.body.x) / 16)).toBe(40);
    expect(p.scratch.weapons).toBe(1);
    expect(p.scratch.wsaw).toBe(10);
    expect(p.scratch.tool ?? 0).toBe(0); // back on the belt's first (the saw)
    expect(p.hp).toBe(MAX_HP);
    warp(h, 500);
    h.step([], 4);
    expect(h.world.entities.some((e) => e instanceof WeaponCapsule)).toBe(false);
  });

  it('dev assist Infinite lives: lives never run out', () => {
    const h = stationHarness();
    h.game.ctx.assist.infiniteLives = true;
    for (let n = 0; n < 5; n++) {
      ready(h);
      h.world.kill(h.scene.player);
      for (let i = 0; i < 400 && h.scene.phase !== 'ready'; i++) h.step();
      expect(h.scene.phase).toBe('ready');
    }
    expect(h.scene.lives.rest).toBe(2);
    expect(h.results).toEqual([]);
  });

  it('the menu does not open on GAME OVER, and the round fails once', () => {
    const h = stationHarness({ keep: true });
    h.scene.lives.rest = 0;
    ready(h);
    h.world.kill(h.scene.player);
    for (let i = 0; i < 400 && h.scene.phase !== 'gameover'; i++) h.step();
    expect(h.scene.phase).toBe('gameover');
    h.tap('start');
    expect(h.game.scenes.top).toBe(h.scene);
    expect(h.scene.touchLabels()).toMatchObject({ start: null });
    h.step([], GAME_OVER_FRAMES + 10);
    expect(h.results).toEqual(['fail']);
  });
});
