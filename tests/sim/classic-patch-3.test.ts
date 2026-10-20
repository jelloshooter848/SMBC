import { afterEach, describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { Action } from '@engine/input/actions';
import {
  defaultSettings,
  loadSettings,
  SETTINGS_KEY,
  type ClassicCheatId,
  type Settings,
} from '@engine/save/settings';
import { DEFAULT_ASSIST, NO_CHEATS, newGameState, type CheatFlags, type Rules } from '@game/context';
import { MARIO } from '@game/characters/mario';
import { MEGAMAN } from '@game/characters/megaman';
import { SAMUS } from '@game/characters/samus';
import { applyRevivalBoost } from '@game/survival';
import { CHARACTERS } from '@game/characters/registry';
import { megamanSmbcDef } from '@content/sprites/smbc-megaman';
import { marioClassicDef } from '@content/sprites/mario-classic';
import { SPRITES } from '@content/sprites';
import { LINK } from '@game/characters/link';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CharacterDef } from '@game/characters/character';
import type { LevelData } from '@game/level/schema';
import { ScriptedInput } from '@game/sim/headless';
import { Firework } from '@game/entities/effects/firework';
import { drawHud } from '@game/hud/hud';
import { levelSeed, World, type WorldStart } from '@game/world/world';
import { IntroScene } from '@game/scenes/intro';
import type { Game } from '@game/scenes/game';
import { CHEAT_GOALS, cheatInfo } from '@game/cheats';
import { LevelScene } from '@game/scenes/level';
import { MORE_SETTINGS_ROWS, optionItem } from '@game/scenes/original-options';
import { defaultClassicSettings, type ClassicSettings } from '@engine/save/original-options';
import { px } from '@engine/math/units';
import { YOSHI_CLASSIC } from '@game/characters/yoshi/classic';
import { edible, mouthOf } from '@game/characters/classic/yoshi-tongue';
import { SpikeTop } from '@game/entities/enemies/spike-top';
import { Spiny } from '@game/entities/enemies/spiny';
import { Rig, flatLevel } from './classic-plumber-harness';
import { draw, makeGame, store, useStorage, type H } from './heroes-harness';
import type { CharacterSelectScene } from '@game/scenes/character-select';
import { REVIVE_DONE_QUESTION, REVIVE_NEWS } from '@game/scenes/character-select';

// Classic patch 3 (owner-approved review findings of #164-#167): one describe per item.

useStorage();
afterEach(() => store.clear());

type Flags = Partial<Record<ClassicCheatId, boolean>>;

function world(
  level: LevelData,
  cheats: Flags | null,
  def: CharacterDef = MARIO,
  rules: Rules = 'classic',
  start: WorldStart = {},
): World {
  const ctx = {
    assets: new AssetRegistry({ default: {} }),
    audio: NULL_AUDIO,
    assist: { ...DEFAULT_ASSIST },
    reduceFlashing: true,
    rules,
    ...(cheats ? { classicCheats: { ...NO_CHEATS, ...cheats } as CheatFlags } : {}),
  };
  return new World(level, ctx, newGameState(def, null, rules), { seed: levelSeed(level), ...start });
}

function run(
  w: World,
  n: number,
  hold: (f: number) => Action[] = () => [],
  until?: (w: World) => boolean,
): number {
  const input = new ScriptedInput({ steps: [] });
  for (let f = 0; f < n; f++) {
    input.setHeld(hold(f));
    input.next();
    w.update([input]);
    if (until?.(w)) return f;
  }
  return n;
}

const phase = (w: World): string | undefined =>
  (w as unknown as { clear: { phase: string } | null }).clear?.phase;

/** The texts a HUD draws. */
function hudTexts(time: number | null, noTime: boolean): string[] {
  const texts: string[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    text(_f: SpriteSheet, str: string): void {
      texts.push(str);
    },
  });
  const assets = { sheet: () => ({ frames: new Map() }) } as unknown as AssetRegistry;
  drawHud(r, assets, newGameState(MARIO), time, 0, [], { noTime });
  return texts;
}

/** Plays 1-1 from just before the flag (TIME 301 at the touch: a fireworks digit) to the end of the clear. */
function flagRun(cheats: Flags | null) {
  const w = world(getLevel('1-1'), cheats, MARIO, 'classic', { x: 194, y: 12, mode: 'stand', time: 303 });
  let atFlag = -1;
  let scoreAtWalkEnd = -1;
  const fireworks = new Set<Firework>();
  run(
    w,
    3000,
    (f) => (f % 30 < 15 ? ['right', 'jump'] : ['right']),
    (w) => {
      if (phase(w) === 'countdown' && scoreAtWalkEnd < 0) scoreAtWalkEnd = w.state.score;
      if (phase(w) === 'flag' && atFlag < 0) atFlag = w.time ?? -1;
      for (const e of w.entities) if (e instanceof Firework) fireworks.add(e);
      return phase(w) === 'done';
    },
  );
  return {
    atFlag,
    bonus: w.state.score - scoreAtWalkEnd,
    fireworks: fireworks.size,
    done: phase(w) === 'done',
  };
}

describe('1. Infinite Time: no TIME on the HUD or the card, no tally', () => {
  it('drawHud with noTime leaves out the label and the digits; without it both show', () => {
    expect(hudTexts(400, false)).toEqual(expect.arrayContaining(['TIME', '400']));
    const t = hudTexts(400, true);
    expect(t).not.toContain('TIME');
    expect(t).not.toContain('400');
  });

  it('a clear with the cheat on skips the time tally and the fireworks; off, both play', () => {
    const off = flagRun({});
    expect(off.done).toBe(true);
    expect(off.atFlag).toBe(0);
    expect(off.bonus).toBeGreaterThan(0);
    expect(off.fireworks).toBeGreaterThan(0);
    const on = flagRun({ infiniteTime: true });
    expect(on.done).toBe(true);
    expect(on.atFlag).toBeGreaterThan(0); // the clock is never converted
    expect(on.bonus).toBe(0);
    expect(on.fireworks).toBe(0);
  });

  it('the card before a level shows no TIME with the cheat on; the campaign assist keeps the label', () => {
    const card = (classicCheats: CheatFlags | undefined, infiniteTime: boolean): string[] => {
      const game = {
        ctx: {
          assets: { sheet: () => ({ frames: new Map() }) },
          assist: { ...DEFAULT_ASSIST, infiniteTime },
          ...(classicCheats ? { classicCheats } : {}),
        },
        state: newGameState(MARIO),
      } as unknown as Game;
      const texts: string[] = [];
      const r: Renderer = Object.assign(new NullRenderer(), {
        text(_f: SpriteSheet, str: string): void {
          texts.push(str);
        },
      });
      new IntroScene(game, () => undefined, 400).render(r);
      return texts;
    };
    expect(card(undefined, true)).toContain('TIME');
    const on = card({ ...NO_CHEATS, infiniteTime: true }, true);
    expect(on).not.toContain('TIME');
    expect(on).not.toContain('400');
    expect(card({ ...NO_CHEATS }, false)).toEqual(expect.arrayContaining(['TIME', '400']));
  });
});

describe('2. All Hammer Bros: the goal says The Lost Levels stands in for the Special maps', () => {
  it("the locked text names The Lost Levels and the original's Special maps", () => {
    const t = cheatInfo('allHammerBros').goalText;
    expect(t).toMatch(/The Lost Levels/);
    expect(t).toMatch(/Special maps/);
  });
});

function classicGame(over: Partial<Settings> = {}): H & { settings: Settings } {
  const settings = { ...defaultSettings(), ...over };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}

describe('3. Infinite Lives: continues count over the save, not per run', () => {
  it('a continue in an earlier run keeps Infinite Lives locked when a later run beats a game', () => {
    const h = classicGame();
    h.game.classicGame(MARIO);
    h.game.continueGame('1-1');
    expect(h.settings.classicCheats.continuesUsed).toBe(1);
    // A new run (and a reload of the file) still remembers it.
    h.game.classicGame(MARIO);
    expect(JSON.parse(store.get(SETTINGS_KEY) as string).classicCheats.continuesUsed).toBe(1);
    expect(loadSettings().classicCheats.continuesUsed).toBe(1);
    h.game.cheatEvent({ beat: 'smb' });
    expect(h.settings.classicCheats.unlocked.allGroundIsBricks).toBe(true);
    expect(h.settings.classicCheats.unlocked.infiniteLives).toBe(false);
  });

  it('a save that never continued unlocks it; a file from before gets 0, bad values are cleaned', () => {
    const g = classicGame();
    g.game.classicGame(MARIO);
    g.game.cheatEvent({ beat: 'smb' });
    expect(g.settings.classicCheats.unlocked.infiniteLives).toBe(true);
    const old = { ...defaultSettings(), classicCheats: { on: {}, unlocked: {} } };
    store.set(SETTINGS_KEY, JSON.stringify(old));
    expect(loadSettings().classicCheats.continuesUsed).toBe(0);
    store.set(SETTINGS_KEY, JSON.stringify({ ...defaultSettings(), classicCheats: { continuesUsed: -2.5 } }));
    expect(loadSettings().classicCheats.continuesUsed).toBe(0);
  });

  it('a continue in the campaign (or a developer Classic run) is not counted', () => {
    const h = classicGame({ dev: true });
    h.game.devClassicGame(MARIO, '1-1', 'classic');
    h.game.continueGame('1-1');
    expect(h.settings.classicCheats.continuesUsed).toBe(0);
  });
});

describe('4. Classic mode with Current rules: nothing counts toward the cheats', () => {
  it('no clear, no game beaten, no continue and no tally counts under Current rules', () => {
    const h = classicGame();
    h.settings.classicRules = 'current';
    h.game.classicGame(MARIO);
    expect(h.game.cheatGoalsCount).toBe(false);
    h.game.cheatEvent({ level: true, castle: true });
    h.game.cheatEvent({ beat: 'smb' });
    h.game.cheatTally('enemiesDefeated');
    h.game.continueGame('1-1');
    const c = h.settings.classicCheats;
    expect(c.unlocked.infiniteTime).toBe(false);
    expect(c.unlocked.extraCheckpoints).toBe(false);
    expect(c.unlocked.allGroundIsBricks).toBe(false);
    expect(c.beaten.smb).toBe(false);
    expect(c.stats.enemiesDefeated).toBe(0);
    expect(c.continuesUsed).toBe(0);
  });

  it('the same calls under Classic rules count', () => {
    const h = classicGame();
    h.game.classicGame(MARIO);
    expect(h.game.cheatGoalsCount).toBe(true);
    h.game.cheatEvent({ level: true, castle: true });
    h.game.cheatTally('enemiesDefeated');
    expect(h.settings.classicCheats.unlocked.infiniteTime).toBe(true);
    expect(h.settings.classicCheats.unlocked.extraCheckpoints).toBe(true);
    expect(h.settings.classicCheats.stats.enemiesDefeated).toBe(1);
  });
});

describe('5. Cheat counts are saved per area / per clear, not per kill', () => {
  const savedStat = () =>
    (JSON.parse(store.get(SETTINGS_KEY) ?? '{}') as Partial<Settings>).classicCheats?.stats.enemiesDefeated;

  it('kills in an area write nothing; the next area start saves them all at once', () => {
    const h = classicGame();
    h.game.classicGame(MARIO);
    h.until(() => h.top() instanceof LevelScene, 600);
    store.delete(SETTINGS_KEY);
    for (let i = 0; i < 20; i++) h.game.cheatTally('enemiesDefeated');
    expect(h.settings.classicCheats.stats.enemiesDefeated).toBe(20);
    expect(store.has(SETTINGS_KEY)).toBe(false);
    const w = (h.top() as LevelScene).world;
    w.events.push({ type: 'exit', next: '1-2' });
    h.until(() => store.has(SETTINGS_KEY), 600);
    expect(savedStat()).toBe(20);
  });

  it('a clear saves them, an unlock saves at once, and flushCheatStats writes only when dirty', () => {
    const h = classicGame();
    h.game.classicGame(MARIO);
    store.delete(SETTINGS_KEY);
    h.game.flushCheatStats();
    expect(store.has(SETTINGS_KEY)).toBe(false);
    h.game.cheatTally('enemiesDefeated');
    h.game.cheatEvent({ level: true });
    expect(savedStat()).toBe(1);
    store.delete(SETTINGS_KEY);
    h.settings.classicCheats.stats.hammerBrosDefeated = CHEAT_GOALS.hammerBrosDefeated - 1;
    h.game.cheatTally('hammerBrosDefeated');
    expect(h.settings.classicCheats.unlocked.evilHammerBros).toBe(true);
    expect(store.has(SETTINGS_KEY)).toBe(true);
    store.delete(SETTINGS_KEY);
    h.game.cheatTally('enemiesDefeated');
    h.game.showTitle();
    expect(savedStat()).toBe(2);
  });
});

describe("6. Yoshi's tongue vs Spike Top: inedible, like a Spiny", () => {
  it('the edible table gives null for a Spike Top, for the hero and the mount', () => {
    const st = new SpikeTop(0, 0);
    expect(edible(st, 'hero')).toBeNull();
    expect(edible(st, 'mount')).toBeNull();
    expect(edible(new Spiny(0, 0, false), 'hero')).toBeNull();
  });

  it("the playable Yoshi's tongue bounces off a Spike Top: it stays alive, the mouth stays empty", () => {
    const r = new Rig(YOSHI_CLASSIC, flatLevel(), 'classic', 'small');
    r.settle();
    const st = new SpikeTop(0, 0);
    const b = r.p.body;
    st.body.x = b.x + b.w + px(16);
    st.body.y = r.p.body.y;
    st.body.vx = 0;
    st.activated = true;
    r.world.spawn(st);
    r.step(['attack']);
    for (let i = 0; i < 12; i++) r.step([]);
    expect(mouthOf(r.p)).toBeNull();
    expect(st.alive).toBe(true);
  });
});

describe("7. More Settings rows in the original's order (DifficultySettingsMenu.loadItems)", () => {
  it('Lives, Attack, When hit, Item drops, Piranhas, Goombas, Enemy speed', () => {
    expect(MORE_SETTINGS_ROWS.map((r) => r.label)).toEqual([
      'Lives',
      'Attack',
      'When hit',
      'Item drops',
      'Piranhas',
      'Goombas',
      'Enemy speed',
    ]);
  });
});

describe("8. The When hit hint speaks only the current value's meaning", () => {
  const whenHit = MORE_SETTINGS_ROWS.find((r) => r.label === 'When hit');
  const hintFor = (v: ClassicSettings['whenHit']): string => {
    const classic = { ...defaultClassicSettings(), whenHit: v };
    const game = { deps: { settings: { classic } } } as unknown as Game;
    return optionItem(game, whenHit as never, () => undefined).hint ?? '';
  };

  it('each value is told alone; the other two are not named', () => {
    const lose = hintFor('lose-everything');
    expect(lose).toBe('Any hit leaves you small');
    const prev = hintFor('previous-state');
    expect(prev).toMatch(/^A hit takes one power-up away: Fire goes to big, big to small\. Changed from/);
    // Only the Changed from note names another value (the original's).
    expect(prev.split('. Changed')[0]).not.toMatch(/Lose everything|Instant death|defeats/);
    const dead = hintFor('instant-death');
    expect(dead).toMatch(/^Any hit defeats you\. Changed from the original: Lose everything$/);
    expect(dead.split('. Changed')[0]).not.toMatch(/Previous state|small/);
  });

  it('the other rows keep their own hint', () => {
    const lives = MORE_SETTINGS_ROWS[0];
    const game = { deps: { settings: { classic: defaultClassicSettings() } } } as unknown as Game;
    expect(optionItem(game, lives as never, () => undefined).hint).toBe(
      'Lives at the start and after each continue',
    );
  });
});

describe("10. Survival's boxes on the select cover no hero", () => {
  const survivalGame = () => {
    const settings = {
      ...defaultSettings(),
      classic: { ...defaultClassicSettings(), gameMode: 'survival' as const },
    };
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    return { ...h, settings };
  };
  /** The box's white frame (16, y, 224, h) and the heroes' sprites, as drawn. */
  function layout(s: CharacterSelectScene) {
    const rects: { x: number; y: number; w: number; h: number; c: string }[] = [];
    const sprites: { y: number; h: number }[] = [];
    const r: Renderer = Object.assign(new NullRenderer(), {
      rect(x: number, y: number, w: number, h: number, c: string): void {
        rects.push({ x, y, w, h, c });
      },
      sprite(sh: SpriteSheet, frame: string, _x: number, y: number): void {
        sprites.push({ y, h: sh.frames.get(frame)?.h ?? 0 });
      },
    });
    s.render(r);
    const box = rects.find((b) => b.x === 16 && b.w === 224 && b.c === '#fcfcfc');
    return { box, bottom: Math.max(...sprites.map((sp) => sp.y + sp.h)) };
  }

  it('the DONE question sits under the last row of heroes, inside the screen', () => {
    const h = survivalGame();
    h.game.classicSelect('1-1', () => h.game.showClassicMenu());
    const s = h.top() as CharacterSelectScene;
    h.idle(12);
    h.tap('jump'); // revive Mario: DONE now asks
    h.tap('attack');
    expect(s.boxShown).toBe('finished');
    const { box, bottom } = layout(s);
    expect(box).toBeDefined();
    const b = box as { y: number; h: number };
    expect(b.y).toBeGreaterThanOrEqual(bottom);
    expect(b.y).toBeGreaterThan(s.heroesBottom() + 4); // below the feet and the cursor's underline
    expect(b.y + b.h).toBeLessThanOrEqual(240);
    // Its lines fit inside it.
    const texts = draw(s).texts.filter((t) => REVIVE_DONE_QUESTION.includes(t.str) || t.str === 'YES');
    for (const t of texts) {
      expect(t.y).toBeGreaterThan(b.y);
      expect(t.y + 8).toBeLessThanOrEqual(b.y + b.h - 2);
    }
  });

  it('every box size (the news, the question, four cheat lines) fits under the heroes', () => {
    const h = survivalGame();
    h.game.classicSelect('1-1', () => h.game.showClassicMenu());
    const s = h.top() as CharacterSelectScene;
    for (const n of [REVIVE_NEWS.length, REVIVE_DONE_QUESTION.length, 4]) {
      const { y, h: bh } = s.boxRect(n);
      expect(y).toBeGreaterThan(s.heroesBottom() + 4);
      expect(y + bh).toBeLessThanOrEqual(240);
    }
  });
});

describe('11. Revive mode on a standing hero says "OK to power up", as the screen does', () => {
  it('fallen: OK to revive; standing (after NO to the question): OK to power up', () => {
    const settings = {
      ...defaultSettings(),
      classic: { ...defaultClassicSettings(), gameMode: 'survival' as const },
    };
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    h.game.classicSelect('1-1', () => h.game.showClassicMenu());
    const s = h.top() as CharacterSelectScene;
    h.idle(12);
    expect(h.said.at(-1)).toMatch(/Mario: revive\. .* OK to revive\./);
    h.tap('jump'); // Mario revived: he stands, the cursor stays on him
    h.tap('attack');
    expect(s.boxShown).toBe('finished');
    h.tap('jump'); // NO: back to revive mode, read out again
    expect(s.boxShown).toBeNull();
    const line = h.said.at(-1) ?? '';
    expect(line).toMatch(/Mario: power up\. .* OK to power up\./);
    expect(line).not.toMatch(/OK to revive/);
    expect(draw(s).texts.map((t) => t.str)).toContain('OK (Z) TO POWER UP');
  });
});

describe("12. Survival's power-up under Current rules: each hero's own Current upgrade", () => {
  const flatLevel1 = () => getLevel('1-1');

  it("Current Mega Man: the helmet, then his first weapon (not the Classic Flower's path)", () => {
    const w = world(flatLevel1(), null, MEGAMAN, 'current');
    applyRevivalBoost(w.player, w, 'megaman');
    expect(w.player.scratch.helmet).toBe(1);
    expect(w.player.scratch.weapons).toBe(1);
  });

  it('Current Samus: the Varia Suit, then the next beam', () => {
    const w = world(flatLevel1(), null, SAMUS, 'current');
    applyRevivalBoost(w.player, w, 'samus');
    expect(w.player.scratch.varia).toBe(1);
    expect(w.player.scratch.beam).toBe(1);
  });

  it('Current Mario: the Mushroom, then the Flower; no points either way', () => {
    const w = world(flatLevel1(), null, MARIO, 'current');
    const score = w.state.score;
    applyRevivalBoost(w.player, w, 'mario');
    expect(w.player.powerState).toBe('fire');
    expect(w.state.score).toBe(score);
  });

  it('Classic rules keep the Classic path: two Fire Flowers to the Classic hero', () => {
    const w = world(flatLevel1(), null, MARIO, 'classic');
    applyRevivalBoost(w.player, w, 'mario');
    expect(w.player.powerState).toBe('fire');
  });
});

describe('13. Mega Man shoot frame: no stray dark line under the buster', () => {
  it('nothing is drawn right of his front boot below the buster arm (rows under it, x past the boots)', () => {
    const rows = megamanSmbcDef.frames.shoot as string[];
    // The buster's rows: those with pixels beyond the body's right edge in the idle frame.
    const idle = megamanSmbcDef.frames.idle as string[];
    const bodyRight = Math.max(...idle.map((r) => r.replace(/\.+$/, '').length - 1));
    const busterRows = rows
      .map((r, y) => (r.replace(/\.+$/, '').length - 1 > bodyRight ? y : -1))
      .filter((y) => y >= 0);
    expect(busterRows.length).toBeGreaterThan(0);
    const below = Math.max(...busterRows) + 1;
    // The front boot's right edge in the shoot frame's last row (the sole).
    const boot = (rows.at(-1) ?? '').replace(/\.+$/, '').length - 1;
    for (let y = below; y < rows.length; y++) {
      const tail = (rows[y] ?? '').slice(boot + 1);
      expect(tail.replace(/\./g, ''), `row ${y}: ${rows[y]}`).toBe('');
    }
  });
});

describe('14. The walk to the castle after the flagpole uses the ground pose (Classic defs)', () => {
  /** The frames shown during the clear's walk once the hero is down, and onGround meanwhile. */
  function walkFrames(def: CharacterDef, rules: Rules) {
    const w = world(getLevel('1-1'), null, def, rules, { x: 194, y: 12, mode: 'stand', time: 303 });
    const frames = new Set<string>();
    let grounded = 0;
    let airborne = 0;
    run(
      w,
      2000,
      (f) => (f % 30 < 15 ? ['right', 'jump'] : ['right']),
      (w) => {
        if (phase(w) === 'walk' && w.player.body.vy === 0) {
          if (w.player.body.onGround) grounded++;
          else airborne++;
          frames.add(String(w.player.def.sprite(w.player, w.frame, true).frame));
        }
        return phase(w) === 'countdown';
      },
    );
    return { frames: [...frames], grounded, airborne };
  }
  const AIR = /jump|fall|air|flip|somersault|spin|crouch|kneel/i;

  for (const id of ['samus', 'bill', 'ryu', 'simon', 'sophia']) {
    it(`Classic ${id}: on the ground, in a ground pose, all the walk`, () => {
      const def = CHARACTERS.find((c) => c.id === id) as CharacterDef;
      const r = walkFrames(def, 'classic');
      expect(r.grounded).toBeGreaterThan(10);
      expect(r.airborne).toBe(0);
      for (const f of r.frames) expect(f).not.toMatch(AIR);
    });
  }

  it('Current rules: the walk is untouched (onGround is not set by it)', () => {
    const r = walkFrames(MARIO, 'current');
    expect(r.grounded).toBe(0);
  });
});

describe('15. Housekeeping: Link hurtbox, Link death clock, Classic Mario sizes', () => {
  it("Link's hurtbox stays the original's 13.5 x 15 and fits inside his standing and walking art", () => {
    const w = world(getLevel('1-1'), null, LINK, 'classic');
    const p = w.player;
    const hurt = p.def.hurtbox?.(p);
    expect(hurt).toEqual({ w: 13.5, h: 15 });
    // The standing and walking art (about the original's 15 x 16: 14-15 wide, 15-16 high).
    for (const f of ['idle', 'walk-0', 'walk-1']) {
      const art = SPRITES['link-classic']?.frames[f] as string[] | undefined;
      expect(art, f).toBeDefined();
      const { w: aw, h: ah } = box(art as string[]);
      expect(aw, f).toBeGreaterThanOrEqual(14);
      expect(ah, f).toBeGreaterThanOrEqual(15);
      expect((hurt as { w: number }).w, f).toBeLessThanOrEqual(aw);
      expect((hurt as { h: number }).h, f).toBeLessThanOrEqual(ah);
    }
  });

  it("Link's death clock restarts after he is alive again (as Simon's)", () => {
    const w = world(getLevel('1-1'), null, LINK, 'classic');
    const p = w.player;
    const frameAt = (f: number) => String(p.def.sprite(p, f, true).frame);
    p.dead = true;
    expect(frameAt(100)).toBe('die-front');
    expect(frameAt(400)).toMatch(/^die-spark/);
    p.dead = false;
    frameAt(500);
    p.dead = true;
    // A new death at 600: the flash facing the screen again, not the old death's sparkle.
    expect(frameAt(600)).toBe('die-front');
    expect(frameAt(620)).toMatch(/^die-(right|back|left|front)$/);
  });

  it("the Classic Mario re-cuts' comments give the art's own sizes", () => {
    const src = readFileSync(join(import.meta.dirname, '../../src/content/sprites/mario-classic.ts'), 'utf8');
    const sizes: Record<string, string> = {};
    for (const [name, rows] of Object.entries(marioClassicDef.frames)) {
      const b = box(rows as string[]);
      sizes[name] = `${b.w} x ${b.h}`;
    }
    expect(sizes).toEqual({
      'small-walk-2': '11 x 16',
      'small-skid': '14 x 16',
      'small-die': '15 x 14',
      'big-idle': '15 x 32',
      'grow-mid': '15 x 24',
    });
    for (const s of Object.values(sizes)) expect(src).toContain(`(${s})`);
    for (const s of Object.values(sizes)) expect(src).toContain(s.replace(' x ', 'x'));
  });
});

/** The bounding box of a frame's drawn pixels. */
function box(rows: readonly string[]): { w: number; h: number } {
  let x0 = Infinity;
  let x1 = -1;
  let y0 = Infinity;
  let y1 = -1;
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === '.') return;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }),
  );
  return { w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
