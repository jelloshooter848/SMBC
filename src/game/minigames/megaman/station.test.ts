import { beforeEach, describe, expect, it, vi } from 'vitest';
import { levelIds } from '@content/levels';
import { songs } from '@content/music/songs';
import { sfx } from '@content/sfx/sfx';
import type { AssetRegistry } from '@engine/assets/registry';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import { px, tileToSub, toPx } from '@engine/math/units';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { defaultSettings } from '@engine/save/settings';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { World } from '@game/world/world';
import type { MenuItem } from '@game/scenes/menu';
import { AssistOptionsScene } from '@game/scenes/options';
import { Goomba } from '@game/entities/enemies/goomba';
import { Projectile, BUSTER, CHARGED_BUSTER } from '@game/entities/projectiles/projectile';
import { SAW_DISC } from '@game/characters/megaman/weapons';
import { MAX_HP, MEGAMAN } from '@game/characters/megaman';
import { T } from '@game/level/tiles';
import { miniGameFor } from '..';
import { MEGAMAN_MINIGAME } from '.';
import { MM_SOUNDS, songOr, sfxOr } from './art';
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
  OrbBurst,
  SHOT_DAMAGE,
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

/** Sheets with no frames: everything draws its fallback boxes. */
const STUB_ASSETS = {
  sheet: () => ({ id: 'stub', image: null, frames: new Map() }),
  has: () => false,
} as unknown as AssetRegistry;

/** Past READY: Mega Man can move. */
function ready(h: StationHarness): void {
  h.step([], READY_FRAMES);
  expect(h.scene.phase).toBe('stage');
}

/** Puts Mega Man standing on the floor (or a top at `feet` px) at `x` px, the camera on him. */
function warp(h: StationHarness, x: number, feet = 208): void {
  const b = h.scene.player.body;
  b.x = px(x);
  b.y = px(feet) - b.h;
  b.vx = 0;
  b.vy = 0;
  h.world.camera.snapTo(b.x);
}

/** Into the boss room: walks into the shutter and on until the fight starts. */
function toFight(h: StationHarness): DarkMegaMan {
  ready(h);
  warp(h, 1250);
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

  it("uses the station's songs and sounds by name, falling back to ones that exist until they land", () => {
    const songIds = songs.map((s) => s.id);
    const sfxIds = sfx.map((s) => s.id);
    for (const id of [MM_SOUNDS.stage(), MM_SOUNDS.boss(), MM_SOUNDS.victory()])
      expect(songIds).toContain(id);
    for (const id of [MM_SOUNDS.fill(), MM_SOUNDS.beam(), MM_SOUNDS.capsule()]) expect(sfxIds).toContain(id);
    expect(songOr('no-such-song', 'castle')).toBe('castle');
    expect(sfxOr('coin', 'bump')).toBe('coin');
  });

  it('draws without the station art: no sheet, no dark palette, no frames (fallback boxes)', () => {
    const h = stationHarness({ assets: STUB_ASSETS });
    const r = new TextRenderer();
    const boss = toFight(h);
    h.world.spawn(new OrbBurst(boss.body.x, boss.body.y, true));
    expect(() => h.game.scenes.render(r)).not.toThrow();
    expect(r.rects.length).toBeGreaterThan(50);
  });
});

describe('Station Escape: the stage', () => {
  it('is kept out of the level library (dev level select, campaign)', () => {
    expect(levelIds()).not.toContain('mm-station');
  });

  it('five screens of station and a 16-wide boss room behind a two-tile shutter', () => {
    const { level, shutter, boss, roomX } = stationStage();
    expect(level.width).toBe(96);
    expect(roomX).toBe(80);
    expect(level.width - roomX).toBe(16);
    expect(shutter).toEqual({ x: 80, y: 11 });
    const at = (x: number, y: number) => level.tiles[y * level.width + x];
    // The shutter's two tiles are solid in the map, the doorway's floor below them.
    expect(at(80, 11)).toBe(T.HARD);
    expect(at(80, 12)).toBe(T.HARD);
    expect(at(80, 13)).toBe(T.GROUND);
    expect(boss.x).toBeGreaterThan(roomX);
    // The scene places the shutter and the boss; the map keeps its robots and the capsule.
    expect(level.entities.map((e) => e.type)).not.toContain('shutter');
    expect(level.entities.map((e) => e.type)).not.toContain('dark-megaman');
    const count = (t: string) => level.entities.filter((e) => e.type === t).length;
    expect(count('hopper')).toBe(3);
    expect(count('turret')).toBe(3);
    expect(count('drone')).toBe(3);
    expect(count('capsule')).toBe(1);
    expect(level.entities.find((e) => e.props?.mount === 'wall')?.type).toBe('turret');
    // The camera stops at the shutter until it opens.
    expect(level.zones).toContainEqual({ kind: 'scrollStop', x: 81 });
  });

  it('every robot and the capsule come from the station types (World knows none of them)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const h = stationHarness();
    ready(h);
    for (let x = 0; x < 1260; x += 32) {
      warp(h, x);
      h.world.update([]);
    }
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
    const kinds = new Set(h.world.entities.map((e) => e.kind));
    for (const k of ['hopper', 'turret', 'drone', 'capsule', 'shutter']) expect(kinds).toContain(k);
  });

  it("World's extraEntities: an entity takes the spawn, null drops it, undefined leaves it to World", () => {
    const level = {
      ...stationStage().level,
      entities: [
        { type: 'hopper', x: 4, y: 12 },
        { type: 'nothing', x: 5, y: 12 },
        { type: 'goomba', x: 6, y: 12 },
      ],
    };
    const world = new World(
      level,
      { assets: STUB_ASSETS, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
      newGameState(MEGAMAN),
      {
        extraEntities: (s) =>
          s.type === 'nothing' ? null : stationEntities({ onCapsule: () => undefined })(s),
      },
    );
    world.update([]);
    expect(world.entities.some((e) => e instanceof Hopper)).toBe(true);
    expect(world.entities.some((e) => e instanceof Goomba)).toBe(true);
    expect(world.entities.filter((e) => e.kind === 'nothing')).toHaveLength(0);
  });

  it('Mega Man plays with the helmet kit: buster, charge shot, slide, full health; no weapons yet', () => {
    const h = stationHarness();
    const p = h.scene.player;
    expect(p.def).toBe(MEGAMAN);
    expect(p.hp).toBe(MAX_HP);
    expect(p.scratch.helmet).toBe(1);
    expect(p.scratch.weapons ?? 0).toBe(0);
    expect(MEGAMAN.tools?.(p).map((t) => t.id)).not.toContain('saw');
  });

  it('READY first: Mega Man cannot move until it goes, then the stage music starts', () => {
    const h = stationHarness();
    const x = h.scene.player.body.x;
    h.step(['right'], READY_FRAMES - 1);
    expect(h.scene.player.body.x).toBe(x);
    expect(h.log.music).toEqual([]);
    h.step(['right'], 10);
    expect(h.scene.player.body.x).toBeGreaterThan(x);
    expect(h.log.music).toEqual([MM_SOUNDS.stage()]);
    expect(h.said[0]).toMatch(/Station escape.*Dark Mega Man.*Ready!/);
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

  it('robots leave Mega Man’s drops (health and weapon pellets), never an E-tank', () => {
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
    expect(kinds).not.toContain('e-tank');
  });
});

describe('Station Escape: the weapon capsule', () => {
  it('unlocks the Saw Disc: the station holds still, a banner and the announcer say how to switch and fire it', () => {
    const h = stationHarness();
    ready(h);
    warp(h, 548, 176);
    for (let i = 0; i < 60 && h.scene.phase === 'stage'; i++) h.step(['right']);
    expect(h.scene.phase).toBe('item');
    const p = h.scene.player;
    expect(p.scratch.weapons).toBe(1);
    expect(MEGAMAN.tools?.(p).map((t) => t.id)).toContain('saw');
    expect(h.world.entities.some((e) => e instanceof WeaponCapsule && e.alive)).toBe(false);
    expect(h.log.sfx).toContain(MM_SOUNDS.capsule());
    const lines = h.scene.banner?.lines ?? [];
    expect(lines[0]).toBe('YOU GOT SAW DISC!');
    expect(lines.join(' ')).toMatch(/WEAPON.*SWITCH/);
    expect(lines.join(' ')).toMatch(/USE WEAPON.*FIRE/);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(BANNER_COLS);
    expect(h.said.at(-1)).toMatch(/Saw Disc.*WEAPON.*USE WEAPON/);
    // Held still for a moment.
    const x = p.body.x;
    h.step(['right'], ITEM_FREEZE - 2);
    expect(p.body.x).toBe(x);
    h.step(['right'], 4);
    expect(h.scene.phase).toBe('stage');
    // WEAPON picks it; USE WEAPON throws a Saw Disc.
    h.tap('select');
    expect(h.scene.touchLabels().special).toBe('SAW');
    h.tap('special');
    expect(h.world.entities.some((e) => e instanceof Projectile && e.kind === 'saw')).toBe(true);
  });
});

describe('Station Escape: the boss gate', () => {
  it('the shutter opens when touched, Mega Man walks through, it shuts behind him, and the camera locks on the room', () => {
    const h = stationHarness();
    ready(h);
    warp(h, 1250);
    const cam = h.world.camera;
    for (let i = 0; i < 100 && h.scene.phase === 'stage'; i++) h.step(['right']);
    expect(h.scene.phase).toBe('gate');
    expect(h.said.at(-1)).toBe('The shutter opens.');
    // The robots and their shots are gone, as on a screen change.
    expect(h.world.enemies.filter((e) => !(e instanceof DarkMegaMan))).toEqual([]);
    expect(h.log.sfx).toContain('door-open');
    const roomPx = tileToSub(80);
    expect(cam.x).toBeLessThan(roomPx);
    let walkedIn = false;
    for (let i = 0; i < 400 && h.scene.phase === 'gate'; i++) {
      h.step(['left']); // the player's input means nothing now
      if (h.world.map.get(80, 12) === T.AIR) walkedIn = true;
    }
    expect(walkedIn).toBe(true);
    expect(h.scene.phase).toBe('intro');
    expect(h.scene.shutter.state).toBe('shut');
    expect(h.world.map.get(80, 11)).toBe(T.HARD);
    expect(h.world.map.get(80, 12)).toBe(T.HARD);
    expect(cam.x).toBe(roomPx);
    expect(cam.locked).toBe(true);
    expect(h.scene.player.body.x).toBeGreaterThan(tileToSub(81));
    // Locked: walking right across the room never moves the camera.
    h.step([], 300);
    expect(cam.x).toBe(roomPx);
  });

  it('Dark Mega Man beams in and his bar fills tick by tick (a boss-fill each) while Mega Man waits; then the fight', () => {
    const h = stationHarness();
    ready(h);
    warp(h, 1250);
    for (let i = 0; i < 500 && h.scene.phase !== 'intro'; i++) h.step(['right']);
    expect(h.log.music.at(-1)).toBe(MM_SOUNDS.boss());
    expect(h.said.at(-1)).toBe('Dark Mega Man!');
    const p = h.scene.player;
    const x = p.body.x;
    h.step(['left', 'attack'], BEAM_FRAMES);
    expect(h.scene.boss).toBeInstanceOf(DarkMegaMan);
    const bars: number[] = [];
    const fills = () => h.log.sfx.filter((s) => s === MM_SOUNDS.fill()).length;
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
    warp(h, 1250);
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
    expect(frames).toBeLessThan(4000);
    expect(h.log.jingles).toContain(MM_SOUNDS.victory());
    expect(h.log.sfx.filter((s) => s === MM_SOUNDS.beam()).length).toBeGreaterThanOrEqual(2);
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

  it('standing still fails: the station wears Mega Man down', () => {
    const h = stationHarness({ keep: true });
    for (let i = 0; i < 8000 && h.results.length === 0; i++) h.step();
    expect(h.results).toEqual(['fail']);
    expect(h.said.at(-1)).toBe('Mega Man is down. Try again.');
    // Reported once, however long the scene is left on top.
    for (let i = 0; i < 600; i++) h.step(i % 7 === 0 ? ['start'] : []);
    expect(h.results).toEqual(['fail']);
    expect(h.game.scenes.top).toBe(h.scene);
  });

  it('falling in a pit fails, under No damage too', () => {
    const h = stationHarness();
    h.game.ctx.assist.invulnerable = true;
    ready(h);
    warp(h, 280);
    for (let i = 0; i < 600 && h.results.length === 0; i++) h.step(['right']);
    expect(h.results).toEqual(['fail']);
    expect(h.said).toContain('Mega Man fell. Try again.');
  });

  it('losing to Dark Mega Man fails', () => {
    const h = stationHarness();
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
    h.tap('start');
    expect(h.game.scenes.top).toBeInstanceOf(StationMenuScene);
    h.step(['right'], 10);
    expect(h.scene.player.body.x).toBe(x);
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

  it('the menu opens in the boss room too, and Give up quits from there', () => {
    const h = stationHarness();
    toFight(h);
    h.tap('start');
    expect(h.game.scenes.top).toBeInstanceOf(StationMenuScene);
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
      h.tap('start');
      const menu = h.game.scenes.top as StationMenuScene;
      expect(menu).toBeInstanceOf(StationMenuScene);
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

describe('Station Escape: screen and controls', () => {
  it("labels the touch buttons as Mega Man's in a level while he plays, only MENU in the cut-scenes, none once decided", () => {
    const h = stationHarness();
    expect(h.scene.touchLabels()).toMatchObject({ jump: null, attack: null, start: 'MENU' });
    ready(h);
    const l = h.scene.touchLabels();
    expect(l.jump).toBe('JUMP');
    expect(l.attack).toBe('SHOOT');
    expect(l.start).toBe('MENU');
    warp(h, 1250);
    for (let i = 0; i < 200 && h.scene.phase === 'stage'; i++) h.step(['right']);
    expect(h.scene.touchLabels()).toMatchObject({ jump: null, attack: null, start: 'MENU' });
    for (let i = 0; i < 1000 && h.scene.phase !== 'fight'; i++) h.step();
    expect(h.scene.touchLabels().attack).toBe('SHOOT');
    h.scene.player.hp = 1;
    h.scene.player.invuln = 0;
    for (let i = 0; i < 2000 && !h.scene.player.dead; i++) h.step();
    expect(h.scene.touchLabels()).toMatchObject({ jump: null, attack: null, start: null });
  });

  it('draws READY, the HUD (STATION, no score), the boss bar beside Mega Man’s bars once he appears, and the banners', () => {
    const h = stationHarness({ assets: STUB_ASSETS });
    const r = new TextRenderer();
    h.game.scenes.render(r);
    expect(r.texts).toContain('READY');
    expect(r.texts).toContain('STATION');
    expect(r.texts.join(' ')).not.toMatch(/WORLD|TIME|0000000/);
    const bossBar = () => r.rects.some(([x, , w, , c]) => x === 24 && w === 6 && c === '#f83800');
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
