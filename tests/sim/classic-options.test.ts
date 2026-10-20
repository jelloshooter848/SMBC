import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { px } from '@engine/math/units';
import { saveJson } from '@engine/save/storage';
import { defaultSettings, loadSettings, SETTINGS_KEY, type Settings } from '@engine/save/settings';
import {
  CLASSIC_ROW_VALUES,
  defaultClassicSettings,
  normaliseClassic,
  type ClassicSettings,
} from '@engine/save/original-options';
import type { Action } from '@engine/input/actions';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { SOPHIA } from '@game/characters/sophia';
import type { CharacterDef } from '@game/characters/character';
import { classicDropRate, CLASSIC_DROP_RATES } from '@game/characters/classic/power';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import { Spiny } from '@game/entities/enemies/spiny';
import { HammerBro } from '@game/entities/enemies/hammer-bro';
import { Piranha } from '@game/entities/enemies/piranha';
import { T } from '@game/level/tiles';
import { applyOptionSpawns } from '@game/rules/classic-options-level';
import { classicRules } from '@game/rules/hooks';
import { classicDamage, FAST_ENEMY_MULT } from '@game/rules/classic-enemies';
import { runSim, type SimResult } from '@game/sim/headless';
import type { LevelScene } from '@game/scenes/level';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import { ClassicMenuScene, ClassicOptionsScene } from '@game/scenes/original-game';
import { ClassicOptionRowsScene, MORE_SETTINGS_ROWS, stepRow } from '@game/scenes/original-options';
import { TitleScene } from '@game/scenes/title';
import { TITLE_TIMING } from '@game/scenes/title-anim';
import type { World } from '@game/world/world';
import { makeGame, useStorage, type H } from './heroes-harness';
import { classicWorld, step, testLevel, weapon } from './classic-harness';
import { isolateClassicRegistry } from './classic-registry';

// FU-7a, Classic options I: More Settings (docs/classic/FOLLOW_UPS_PROPOSAL.md). Settings.classic
// is deep-merged into old saves and normalised; ctx.classic exists only in a Classic run with
// Classic rules; each row's default changes nothing (a Classic run hashes the same with the
// options as without), and each other value does what the original's does.

useStorage();
isolateClassicRegistry();

const opts = (over: Partial<ClassicSettings> = {}): ClassicSettings => ({
  ...defaultClassicSettings(),
  ...over,
});

/** A run's frame-by-frame hash: every player's position, speed and power, then the events. */
function hashRun(r: SimResult, frames: number[]): string {
  return JSON.stringify({ frames, events: r.events, score: r.score, outcome: r.outcome });
}

/** A Classic sim of `level` for `def` holding right with a jump every 40 frames. */
function classicRun(def: CharacterDef, levelId: string, classic?: ClassicSettings, n = 900): string {
  const frames: number[] = [];
  const r = runSim({
    level: getLevel(levelId),
    character: def,
    script: { steps: [] },
    maxFrames: n,
    rules: 'classic',
    ...(classic ? { classic } : {}),
    controller: (w: World, f: number): Action[] => {
      const p = w.player;
      frames.push(p.body.x, p.body.y, p.body.vx, p.body.vy, p.powerState.length, w.entities.length);
      return f % 40 < 14 ? ['right', 'jump', 'attack'] : f % 7 === 0 ? ['right', 'special'] : ['right'];
    },
  });
  return hashRun(r, frames);
}

describe('settings: Settings.classic', () => {
  it('defaults are the original game’s values', () => {
    const d = defaultSettings().classic;
    expect(d).toEqual({
      lives: 3,
      whenHit: 'lose-everything',
      attack: 'normal',
      drops: 'normal',
      enemySpeed: 'normal',
      piranhas: 'some',
      goombas: 'off',
      gameMode: 'all',
      weapons: {
        bass: 'water-shield',
        billFirst: 'mg',
        billSecond: 'spread',
        link: 'bomb',
        megaman: 'metal-blade',
        ryuStart: 'shuriken',
        ryuExtra: 'windmill',
        samus: 'wave',
        simonStart: 'hand-axe',
        simonExtra: 'cross',
        sophia: 'triple',
      },
    });
    // Each More Settings value list starts from the original's own order.
    expect(CLASSIC_ROW_VALUES.lives).toEqual([1, 3, 5, 7, 10]);
    expect(CLASSIC_ROW_VALUES.goombas).toEqual(['off', 'buzzy', 'spiny']);
  });

  it('a file saved before the options gets the defaults (deep merge)', () => {
    const old = { ...defaultSettings() } as Partial<Settings>;
    delete old.classic;
    saveJson(SETTINGS_KEY, old);
    expect(loadSettings().classic).toEqual(defaultClassicSettings());
  });

  it('a partial or bad stored value falls back to the original’s, and the rest is kept', () => {
    saveJson(SETTINGS_KEY, {
      ...defaultSettings(),
      classic: { lives: 7, whenHit: 'nonsense', attack: 'strong', weapons: { link: 'bow', samus: 9 } },
    });
    const c = loadSettings().classic;
    expect(c.lives).toBe(7);
    expect(c.whenHit).toBe('lose-everything');
    expect(c.attack).toBe('strong');
    expect(c.weapons.link).toBe('bow');
    expect(c.weapons.samus).toBe('wave');
    expect(c.goombas).toBe('off');
  });

  it('a weapon pair holding the same weapon goes back to both defaults', () => {
    const c = normaliseClassic({ weapons: { ryuStart: 'windmill', ryuExtra: 'windmill' } });
    expect([c.weapons.ryuStart, c.weapons.ryuExtra]).toEqual(['shuriken', 'windmill']);
    // Bill's first gun is never the Spread (CustomizeWeaponsMenu).
    expect(normaliseClassic({ weapons: { billFirst: 'spread' } }).weapons.billFirst).toBe('mg');
  });
});

function classicGame(over: Partial<ClassicSettings> = {}): H & { settings: Settings } {
  const settings = { ...defaultSettings(), classic: opts(over) };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}

const inLevel = (h: H) => (h.top() as { world?: World }).world !== undefined;

describe('ctx.classic: only a Classic run with Classic rules', () => {
  it('absent on the title, in free play, in a campaign-shaped run and with Current rules', () => {
    const h = classicGame({ lives: 7 });
    h.game.showTitle();
    expect(h.game.ctx.classic).toBeUndefined();
    h.game.newGame(MARIO, '1-1', null, { rules: 'classic' });
    expect(h.game.ctx.classic).toBeUndefined();
    expect(h.game.state.lives).toBe(3);
    // Classic mode with Current rules: no options either.
    h.settings.classicRules = 'current';
    h.game.classicGame(MARIO);
    expect(h.game.classicRun).toBe(true);
    expect(h.game.ctx.classic).toBeUndefined();
    expect(h.game.state.lives).toBe(3);
  });

  it('present in a Classic mode run with Classic rules, and every World and player carries it', () => {
    const h = classicGame({ lives: 7 });
    h.game.classicGame(MARIO);
    expect(h.game.ctx.classic).toBe(h.settings.classic);
    expect(h.game.state.lives).toBe(7);
    h.until(() => inLevel(h), 600);
    const w = (h.top() as LevelScene).world;
    expect(w.classic).toBe(h.settings.classic);
    expect(w.player.classicOptions).toBe(h.settings.classic);
    h.game.showTitle();
    expect(h.game.ctx.classic).toBeUndefined();
  });

  it('a World under Current rules never holds them, even when the context has them', () => {
    const r = runSim({
      level: testLevel(),
      character: MARIO,
      script: { steps: [] },
      maxFrames: 1,
      classic: opts(),
    });
    expect(r.world.classic).toBeNull();
    expect(r.world.player.classicOptions).toBeNull();
  });
});

describe('guard: every More Settings default changes nothing', () => {
  const heroes = CHARACTERS;
  for (const def of heroes)
    it(`${def.name}: a Classic run at the defaults hashes as one without options`, () => {
      expect(classicRun(def, '1-1', opts())).toBe(classicRun(def, '1-1'));
    });

  it('each row at its default leaves the run as without options (1-2, Mario and Link)', () => {
    for (const def of [MARIO, LINK]) {
      const base = classicRun(def, '1-2', undefined, 700);
      for (const r of MORE_SETTINGS_ROWS) {
        const s = opts();
        // Step the row away and back: the row ends at its default.
        stepRow(r, s, 1);
        stepRow(r, s, -1);
        expect(s).toEqual(defaultClassicSettings());
        expect(classicRun(def, '1-2', s, 700), r.label).toBe(base);
      }
    }
  });

  it('the rows that change play change the run (the hash is not blind)', () => {
    const base = classicRun(MARIO, '1-1');
    expect(classicRun(MARIO, '1-1', opts({ goombas: 'spiny' }))).not.toBe(base);
    expect(classicRun(MARIO, '1-1', opts({ enemySpeed: 'fast' }))).not.toBe(base);
    expect(classicRun(MARIO, '1-1', opts({ piranhas: 'all' }))).not.toBe(base);
  });
});

describe('Lives', () => {
  it('a Classic mode run starts with the chosen lives, and a continue gives them again', () => {
    const h = classicGame({ lives: 1 });
    h.game.classicGame(MARIO);
    expect(h.game.state.lives).toBe(1);
    h.game.state.lives = 0;
    h.game.continueGame('1-2');
    expect(h.game.state.lives).toBe(1);
  });

  it('a dev Classic run uses them too; free play keeps 99', () => {
    const h = classicGame({ lives: 10 });
    h.game.devStart('1-1', MARIO, 'small', false, undefined, { rules: 'classic', classic: true });
    expect(h.game.state.lives).toBe(10);
    h.game.devStart('1-1', MARIO, 'small', false, undefined, { rules: 'classic' });
    expect(h.game.state.lives).toBe(99);
  });
});

/** A Classic World for `def` with `o`, at power `power`. */
function world(def: CharacterDef, o: ClassicSettings, power = 'fire'): World {
  return runSim({
    level: testLevel(),
    character: def,
    script: { steps: [] },
    maxFrames: 0,
    rules: 'classic',
    classic: o,
    state: { powerState: power },
  }).world;
}

describe('When hit', () => {
  const hit = (w: World) => {
    step(w, 3);
    w.hurtPlayer(w.player, 1);
    return w.player;
  };
  for (const def of [MARIO, LINK, SOPHIA]) {
    it(`${def.name}: Lose everything ends small, Previous state goes Fire to big then small, Instant death kills`, () => {
      expect(hit(world(def, opts())).powerState).toBe('small');
      const w = world(def, opts({ whenHit: 'previous-state' }));
      const p = hit(w);
      expect(p.powerState).toBe('big');
      expect(p.dead).toBe(false);
      p.invuln = 0;
      p.hurtLock = null;
      p.transition = null;
      w.hurtPlayer(p, 1);
      expect(p.powerState).toBe('small');
      const d = hit(world(def, opts({ whenHit: 'instant-death' }), 'big'));
      expect(d.dead).toBe(true);
    });
  }
});

describe('Attack strength', () => {
  it('multiplies Classic damage (int(dmg × dmgMult)); Normal is unchanged', () => {
    const w = classicWorld(MARIO);
    const src = weapon(w, 'fireball', 100);
    expect(classicDamage(src)).toBe(100);
    expect(classicDamage(src, 0.66)).toBe(66);
    expect(classicDamage(src, 3)).toBe(300);
  });

  it('a Very strong run takes more off an enemy and a brick than Normal', () => {
    const hpAfter = (attack: ClassicSettings['attack']) => {
      const w = world(MARIO, opts({ attack }));
      const g = new Goomba(px(200), px(192));
      w.entities.push(g);
      g.hit(weapon(w, 'fireball', 10), w);
      return g.classicHp;
    };
    expect(hpAfter('normal')).toBeGreaterThan(hpAfter('very-strong') as number);
  });
});

describe('Item drop rate', () => {
  it('Normal is the original’s rates; others add their offset to 25 % before the factors', () => {
    const p = world(LINK, opts()).player;
    expect(classicDropRate(p, 'enemy')).toBe(CLASSIC_DROP_RATES.enemy);
    expect(classicDropRate(p, 'brick')).toBe(CLASSIC_DROP_RATES.brick);
    expect(classicDropRate(p, 'coin')).toBe(CLASSIC_DROP_RATES.coin);
    const hi = world(LINK, opts({ drops: 'very-high' })).player;
    expect(classicDropRate(hi, 'enemy')).toBeCloseTo(0.4);
    expect(classicDropRate(hi, 'brick')).toBeCloseTo(0.4 * 0.25);
    expect(classicDropRate(hi, 'coin')).toBeCloseTo(0.4 * 0.5);
    const lo = world(LINK, opts({ drops: 'very-low' })).player;
    expect(classicDropRate(lo, 'enemy')).toBeCloseTo(0.2);
  });
});

describe('Enemy speed', () => {
  it('Fast: Goombas, Koopas, Spinies and the Hammer Bro’s chase walk ×90/65; Normal keeps them', () => {
    const at = (speed: ClassicSettings['enemySpeed']) => {
      const w = world(MARIO, opts({ enemySpeed: speed }));
      const es = [
        new Goomba(px(200), px(192)),
        new Koopa(px(240), px(192), 'green'),
        new Spiny(px(280), px(192), false),
      ];
      const hb = new HammerBro(px(320), px(186));
      // As World.spawnUpTo does for a map enemy.
      for (const e of [...es, hb]) classicRules().enemySpawned(e, w);
      return { es, hb };
    };
    const n = at('normal');
    const f = at('fast');
    for (const [i, e] of f.es.entries()) {
      const before = (n.es[i] as Goomba).walkSpeed;
      expect(before).toBe(new Goomba(0, 0).walkSpeed);
      expect(e.walkSpeed).toBe(Math.round(before * FAST_ENEMY_MULT));
      expect(Math.abs(e.body.vx)).toBe(e.walkSpeed);
    }
    expect(f.hb.chaseSpeed).toBe(Math.round(n.hb.chaseSpeed * FAST_ENEMY_MULT));
    expect(FAST_ENEMY_MULT).toBeCloseTo(90 / 65);
  });

  it('Fast: a map Goomba in 1-1 walks faster from its spawn', () => {
    const speed = (o?: ClassicSettings) => {
      const r = runSim({
        level: getLevel('1-1'),
        character: MARIO,
        script: { steps: [] },
        maxFrames: 400,
        rules: 'classic',
        ...(o ? { classic: o } : {}),
        controller: () => ['right'],
        until: (w) => w.entities.some((e) => e instanceof Goomba),
      });
      const g = r.world.entities.find((e) => e instanceof Goomba) as Goomba;
      return g.walkSpeed;
    };
    expect(speed(opts({ enemySpeed: 'fast' }))).toBe(Math.round(speed() * FAST_ENEMY_MULT));
    expect(speed(opts())).toBe(speed());
  });
});

describe('Replace Goombas and Piranhas (the spawn list)', () => {
  const spawnsOf = (o: ClassicSettings, id = '1-1') => {
    const w = runSim({
      level: getLevel(id),
      character: MARIO,
      script: { steps: [] },
      maxFrames: 0,
      rules: 'classic',
      classic: o,
    }).world as unknown as {
      spawns: { type: string; x: number; y: number; props?: Record<string, unknown> }[];
    };
    return w.spawns;
  };
  it('Off keeps every Goomba; Buzzy Beetle and Spiny take each one’s cell', () => {
    const base = spawnsOf(opts());
    const goombas = base.filter((s) => s.type === 'goomba');
    expect(goombas.length).toBeGreaterThan(5);
    for (const g of ['buzzy', 'spiny'] as const) {
      const s = spawnsOf(opts({ goombas: g }));
      expect(s.some((x) => x.type === 'goomba')).toBe(false);
      expect(s.filter((x) => x.type === g).map((x) => `${x.x},${x.y}`)).toEqual(
        expect.arrayContaining(goombas.map((x) => `${x.x},${x.y}`)),
      );
    }
  });

  it('All Pipes: a plant on every upright pipe top that had none; Some Pipes keeps the map’s', () => {
    const level = getLevel('1-1');
    const tops: string[] = [];
    for (let y = 0; y < level.height; y++)
      for (let x = 0; x < level.width; x++)
        if (level.tiles[y * level.width + x] === T.PIPE_TL) tops.push(`${x},${y}`);
    expect(tops.length).toBeGreaterThan(3);
    const some = spawnsOf(opts()).filter((s) => s.type === 'piranha');
    expect(some.length).toBeLessThan(tops.length);
    const all = spawnsOf(opts({ piranhas: 'all' })).filter((s) => s.type === 'piranha');
    expect(all.map((s) => `${s.x},${s.y}`).sort()).toEqual([...tops].sort());
    // The list stays sorted by column, as the World spawns it.
    const xs = spawnsOf(opts({ piranhas: 'all' })).map((s) => s.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });

  it('All Pipes adds hanging plants under hanging pipes (Lost Levels)', () => {
    const level = getLevel('ll-10-1');
    let rims = 0;
    for (let i = 0; i < level.tiles.length; i++) if (level.tiles[i] === T.PIPE_BOTTOM_L) rims++;
    const down = spawnsOf(opts({ piranhas: 'all' }), 'll-10-1').filter((s) => s.type === 'piranha-down');
    expect(down.length).toBe(rims);
  });

  it('Red / Green force every plant’s colour; the plants spawn that colour', () => {
    expect(
      spawnsOf(opts({ piranhas: 'red-some' }))
        .filter((s) => s.type === 'piranha')
        .every((s) => s.props?.red),
    ).toBe(true);
    const red = spawnsOf(opts({ piranhas: 'green-some' }), 'll-7-3').filter((s) => s.type === 'piranha');
    expect(red.length).toBeGreaterThan(0);
    expect(red.some((s) => s.props?.red)).toBe(false);
    const r = runSim({
      level: getLevel('1-1'),
      character: MARIO,
      script: { steps: [] },
      maxFrames: 2000,
      rules: 'classic',
      classic: opts({ piranhas: 'red-all' }),
      state: { powerState: 'big' },
      assist: { invulnerable: true },
      controller: () => ['right'],
      until: (w) => w.entities.some((e) => e instanceof Piranha),
    });
    const plant = r.world.entities.find((e) => e instanceof Piranha) as Piranha;
    expect(plant.red).toBe(true);
  });

  it('nothing changes at the defaults (no edit, same list)', () => {
    const map = { width: 2, height: 2, get: () => T.PIPE_TL } as unknown as Parameters<
      typeof applyOptionSpawns
    >[0];
    const spawns = [{ type: 'goomba', x: 1, y: 1 }];
    expect(applyOptionSpawns(map, spawns, opts())).toBe(false);
    expect(spawns).toEqual([{ type: 'goomba', x: 1, y: 1 }]);
    expect(applyOptionSpawns(map, spawns, null)).toBe(false);
  });
});

/* ---------- the menu ---------- */

const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const labels = (s: unknown) => items(s).map((i) => i.label);

function pick(h: H, label: string): void {
  const menu = h.top() as MenuScene;
  const row = items(menu).findIndex((i) => i.label === label);
  expect(row, label).toBeGreaterThanOrEqual(0);
  h.idle(8);
  const at = () => (menu as unknown as { index: number }).index;
  for (let i = 0; i < 20 && at() !== row; i++) h.tap('down');
  h.tap('jump');
}

function toClassicOptions(h: H): ClassicOptionsScene {
  h.game.showTitle();
  h.idle(TITLE_TIMING.dropEnd + 10);
  expect(h.top()).toBeInstanceOf(TitleScene);
  pick(h, 'Classic');
  expect(h.top()).toBeInstanceOf(ClassicMenuScene);
  pick(h, 'Options');
  return h.top() as ClassicOptionsScene;
}

describe('More Settings menu (CLASSIC > Options > More settings)', () => {
  it('lists the original’s rows, each spoken with what it changes, then Restore originals and Back', () => {
    const h = classicGame();
    const o = toClassicOptions(h);
    expect(
      items(o)
        .find((i) => i.label === 'More settings')
        ?.value?.(),
    ).toBe('Original');
    pick(h, 'More settings');
    const m = h.top();
    expect(m).toBeInstanceOf(ClassicOptionRowsScene);
    expect(labels(m)).toEqual([
      'Lives',
      'When hit',
      'Attack',
      'Item drops',
      'Piranhas',
      'Goombas',
      'Enemy speed',
      'Restore originals',
      'Back',
    ]);
    expect(h.said.at(-1)).toMatch(
      /^More settings\. Left and right to change\. Lives: 3\. Lives at the start/,
    );
  });

  it('Left / Right step a row, saved in Settings.classic; a changed row is marked and spoken as changed', () => {
    const h = classicGame();
    toClassicOptions(h);
    pick(h, 'More settings');
    h.idle(8);
    h.tap('right');
    expect(h.settings.classic.lives).toBe(5);
    expect(labels(h.top())[0]).toBe('Lives*');
    expect(h.said.at(-1)).toMatch(/^Lives: 5\. .*Changed from the original: 3/);
    h.tap('left');
    h.tap('left');
    expect(h.settings.classic.lives).toBe(1);
    h.tap('left');
    expect(h.settings.classic.lives).toBe(10);
    h.tap('down');
    h.tap('right');
    expect(h.settings.classic.whenHit).toBe('previous-state');
    // Back: the Options row says the run is not the original's.
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(ClassicOptionsScene);
    expect(
      items(h.top())
        .find((i) => i.label === 'More settings')
        ?.value?.(),
    ).toBe('Changed');
  });

  it('Restore originals puts every row back', () => {
    const h = classicGame({ lives: 10, goombas: 'spiny', attack: 'weak' });
    toClassicOptions(h);
    pick(h, 'More settings');
    expect(labels(h.top())).toContain('Goombas*');
    pick(h, 'Restore originals');
    expect(h.settings.classic).toEqual(defaultClassicSettings());
    expect(labels(h.top()).some((l) => l.endsWith('*'))).toBe(false);
    expect(h.said.at(-1)).toMatch(/back to the original/);
  });

  it('every row names what it changes, never a button letter, and fits its menu row', () => {
    const h = classicGame();
    toClassicOptions(h);
    pick(h, 'More settings');
    const LETTER = /\b(BUTTON )?[ABC]\b/;
    for (const r of MORE_SETTINGS_ROWS) {
      const s = opts();
      for (let k = 0; k < r.values.length; k++) {
        stepRow(r, s, 1);
        const v = (r as { name(v: unknown): string; get(s: ClassicSettings): unknown }).name(
          (r as { get(s: ClassicSettings): unknown }).get(s),
        );
        // A marked label, one space and the value fit the row's 24 columns.
        expect(`${r.label}* ${v}`.length, `${r.label} ${v}`).toBeLessThanOrEqual(
          24 + (v === 'Lose everything' ? 1 : 0),
        );
        expect(v.toUpperCase()).not.toMatch(LETTER);
      }
      expect(r.hint.toUpperCase()).not.toMatch(LETTER);
    }
  });
});
