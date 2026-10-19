import { afterEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLevel } from '@content/levels';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { defaultSettings } from '@engine/save/settings';
import { DEFAULT_ASSIST, newGameState, rulesOf, type GameContext } from '@game/context';
import { CHARACTERS, CLASSIC_CHARACTERS, CLASSIC_EXTRAS, heroFor } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { urlRules } from '@game/dev-url';
import { rulesLine, rulesTag } from '@game/hud/rules-tag';
import { runSim } from '@game/sim/headless';
import { World } from '@game/world/world';
import { LevelScene } from '@game/scenes/level';
import { IntroScene } from '@game/scenes/intro';
import { PauseScene } from '@game/scenes/pause';
import { DebugOverlay } from '@game/scenes/debug-overlay';
import { DevLevelSelectScene, RULES_HINT, RULES_LABELS } from '@game/scenes/dev-level-select';
import type { MenuItem } from '@game/scenes/menu';
import { MINIGAMES } from '@game/minigames';
import { hasTraining, trainingScene } from '@game/tutorial/training';
import { saveFromState } from '@game/save/save-files';
import { fontText } from '@game/hud/text';
import { file, makeGame, useStorage } from './heroes-harness';
import { hideClassicHeroes, isolateClassicRegistry } from './classic-registry';

// Every test gets the Classic registry back as it found it (tests/sim/classic-registry.ts).
isolateClassicRegistry();

// The Classic rules plumbing (umbrella report TG-9..TG-43, Classic mode's rules model): with no
// Classic defs yet every hero plays Current under Classic rules and the tag reads CLASSIC?. Where
// a test needs a Classic def it registers a stand-in (a copy of the Current def marked
// `rules: 'classic'`) and takes it out again afterwards.

useStorage();

/** CLASSIC_CHARACTERS entries as they were before a test changed them (put back after it). */
const saved = new Map<string, CharacterDef | undefined>();
const extras: CharacterDef[] = [];
function remember(id: string): void {
  if (!saved.has(id)) saved.set(id, CLASSIC_CHARACTERS[id]);
}
/** Registers a stand-in Classic def for `def` (the real entry, if any, comes back after the test). */
function fakeClassic(def: CharacterDef): CharacterDef {
  const c: CharacterDef = { ...def, rules: 'classic' };
  remember(def.id);
  CLASSIC_CHARACTERS[def.id] = c;
  return c;
}
/** Makes `def` a hero with no Classic def for this test (its real one comes back after it). */
function unbuilt(def: CharacterDef): CharacterDef {
  remember(def.id);
  delete CLASSIC_CHARACTERS[def.id];
  return def;
}
/** Registers a stand-in Classic-only extra (removed after the test). */
function fakeExtra(id: string): CharacterDef {
  const c: CharacterDef = {
    ...MARIO,
    id,
    name: id.toUpperCase(),
    hudName: id.toUpperCase(),
    rules: 'classic',
  };
  CLASSIC_EXTRAS.push(c);
  extras.push(c);
  return c;
}
afterEach(() => {
  for (const [id, prev] of saved) {
    if (prev) CLASSIC_CHARACTERS[id] = prev;
    else delete CLASSIC_CHARACTERS[id];
  }
  saved.clear();
  for (const c of extras.splice(0)) CLASSIC_EXTRAS.splice(CLASSIC_EXTRAS.indexOf(c), 1);
});

function ctx(rules?: 'current' | 'classic'): GameContext {
  return {
    assets: new AssetRegistry({ default: {} }),
    audio: NULL_AUDIO,
    assist: { ...DEFAULT_ASSIST },
    reduceFlashing: true,
    ...(rules ? { rules } : {}),
  };
}

/** Every string drawn by `scene.render`. */
function texts(scene: { render(r: Renderer): void }): { str: string; x: number; y: number }[] {
  const out: { str: string; x: number; y: number }[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    text(_f: SpriteSheet, str: string, x: number, y: number): void {
      out.push({ str, x, y });
    },
    debugText(str: string, x: number, y: number): void {
      out.push({ str, x, y });
    },
  });
  scene.render(r);
  return out;
}

const level = (h: ReturnType<typeof makeGame>) => {
  h.until(() => h.top() instanceof LevelScene, 400);
  return h.top() as LevelScene;
};

describe('Rules type and context (TG-9, TG-15)', () => {
  it('rulesOf is current unless the context says classic', () => {
    expect(rulesOf({})).toBe('current');
    expect(rulesOf({ rules: 'current' })).toBe('current');
    expect(rulesOf({ rules: 'classic' })).toBe('classic');
    expect(rulesOf(ctx())).toBe('current');
  });

  it('newGameState writes rules only for classic, and Current states are as before', () => {
    hideClassicHeroes(); // about heroes with no Classic def, whatever is built
    const cur = newGameState(MARIO, LINK);
    expect('rules' in cur).toBe(false);
    expect(newGameState(MARIO, LINK, 'current')).toEqual(cur);
    expect(cur.powerState).toBe('small');
    expect(cur.powerState2).toBe('full');
    expect(cur.hp2).toBe(LINK.damage.kind === 'hp' ? (LINK.startHp ?? LINK.damage.max) : 0);
    const cl = newGameState(MARIO, LINK, 'classic');
    expect(cl.rules).toBe('classic');
    expect(cl.character).toBe(MARIO);
    // No Classic Link yet: he keeps his Current start.
    expect(cl.powerState2).toBe('full');
  });

  it('newGameState takes the default power from the def played under the rules', () => {
    fakeClassic({ ...LINK, damage: { kind: 'powerup', states: ['small', 'big', 'fire'] } });
    const s = newGameState(LINK, null, 'classic');
    expect(s.character).toBe(LINK); // the roster def stays (TG-19)
    expect(s.powerState).toBe('small');
    expect(s.hp).toBe(0);
  });
});

describe('dev URL helper (TG-5..7)', () => {
  it('honours rules= only with dev mode on', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const p = (q: string) => new URLSearchParams(q);
    expect(urlRules(p('?rules=classic'), true)).toBe('classic');
    expect(urlRules(p('?rules=current'), true)).toBe('current');
    expect(urlRules(p('?rules=bogus'), true)).toBeNull();
    expect(urlRules(p('?level=1-1'), true)).toBeNull();
    expect(urlRules(p('?rules=classic'), false)).toBeNull();
    expect(info).toHaveBeenCalledWith('[dev] rules=classic ignored: dev mode is off');
    info.mockRestore();
  });
});

describe('heroFor and the registry (TG-17, TG-20)', () => {
  it('returns the Current def under Current, and while a hero has no Classic def', () => {
    for (const c of CHARACTERS) {
      expect(heroFor(c, 'current')).toBe(c);
      // A hero whose Classic def is built plays it; one not built yet plays its Current def.
      expect(heroFor(c, 'classic')).toBe(CLASSIC_CHARACTERS[c.id] ?? c);
    }
    // A hero that is certainly not built (a stand-in id no Classic file has).
    const ghost: CharacterDef = { ...MARIO, id: 'ghost-hero', name: 'Ghost' };
    expect(heroFor(ghost, 'classic')).toBe(ghost);
    unbuilt(MARIO);
    expect(heroFor(MARIO, 'classic')).toBe(MARIO);
    const cm = fakeClassic(MARIO);
    expect(heroFor(MARIO, 'classic')).toBe(cm);
    expect(heroFor(MARIO, 'current')).toBe(MARIO);
  });
});

describe('World.rules and the player build (TG-13, TG-14, TG-19, TG-37)', () => {
  it('under Current every player plays the state def', () => {
    for (const c of CHARACTERS) {
      const r = runSim({ level: getLevel('1-1'), character: c, script: { steps: [] }, maxFrames: 1 });
      expect(r.world.rules).toBe('current');
      expect(r.world.players[0]?.def).toBe(c);
    }
  });

  it('under Classic each player plays the Classic def, or the Current one not yet built', () => {
    const cm = fakeClassic(MARIO);
    for (const c of CHARACTERS) {
      const r = runSim({
        level: getLevel('1-1'),
        character: c,
        script: { steps: [] },
        maxFrames: 1,
        rules: 'classic',
      });
      const def = r.world.players[0]?.def as CharacterDef;
      expect(r.world.rules).toBe('classic');
      expect(r.world.state.rules).toBe('classic');
      expect(r.world.state.character).toBe(c);
      expect(def.id).toBe(c.id);
      expect(def).toBe(c === MARIO ? cm : (CLASSIC_CHARACTERS[c.id] ?? c));
    }
  });

  it('WorldStart.rules overrides the context', () => {
    fakeClassic(MARIO);
    const w = new World(getLevel('1-1'), ctx('classic'), newGameState(MARIO), { rules: 'current' });
    expect(w.rules).toBe('current');
    expect(w.player.def).toBe(MARIO);
    const w2 = new World(getLevel('1-1'), ctx(), newGameState(MARIO), { rules: 'classic' });
    expect(w2.rules).toBe('classic');
  });

  it('co-op: both players play the same rules (TG-30)', () => {
    const cm = fakeClassic(MARIO);
    const cl = fakeClassic(LINK);
    const w = new World(getLevel('1-1'), ctx('classic'), newGameState(MARIO, LINK, 'classic'));
    expect(w.players.map((p) => p.def)).toEqual([cm, cl]);
    expect(rulesTag(w.rules, [cm, cl])).toBe('CLASSIC');
  });
});

describe('Game.liveRules: one place decides (rules model)', () => {
  it('devStart sets the run rules; Current by default', () => {
    const h = makeGame({ dev: true });
    h.game.devStart('1-1', MARIO, 'small', false, 1);
    expect(h.game.liveRules).toBe('current');
    expect(level(h).world.rules).toBe('current');
    h.game.devStart('1-1', MARIO, 'small', false, 1, { rules: 'classic' });
    expect(h.game.liveRules).toBe('classic');
    expect(h.game.ctx.rules).toBe('classic');
    expect(level(h).world.rules).toBe('classic');
  });

  it('a switch mid-level leaves the World alone; the next level start uses it', () => {
    const h = makeGame({ dev: true });
    h.game.devStart('1-1', MARIO, 'small', false, 1);
    const l = level(h);
    h.game.ctx.rules = 'classic';
    expect(h.game.runRules).toBe('classic');
    h.idle(5);
    expect(l.world.rules).toBe('current');
    h.game.goToLevel('1-2', { mode: 'stand', seed: 1 });
    expect(level(h).world.rules).toBe('classic');
  });

  it('a campaign file always plays Current, even opened after a dev Classic start', () => {
    const h = makeGame({ dev: true });
    h.game.devStart('1-1', MARIO, 'small', false, 1, { rules: 'classic' });
    level(h);
    file();
    h.game.openFile(1);
    expect(h.game.campaign).not.toBeNull();
    expect(h.game.liveRules).toBe('current');
    expect(rulesOf(h.game.ctx)).toBe('current');
    expect(h.game.state.rules).toBeUndefined();
    // The 1-1 bonus room (as from its pipe): no story scene comes first.
    h.game.startLevel(getLevel('1-1-bonus'), { mode: 'fall', x: 1, y: 1, time: 300 });
    h.step();
    const l = h.top() as LevelScene;
    expect(l).toBeInstanceOf(LevelScene);
    expect(l.world.rules).toBe('current');
    expect(l.world.player.def).toBe(h.game.state.character);
  });

  it('the title, play-tests and shared levels go back to Current', () => {
    const h = makeGame({ dev: true });
    h.game.runRules = 'classic';
    h.game.showTitle();
    expect(h.game.liveRules).toBe('current');
    h.game.runRules = 'classic';
    h.game.playShared(getLevel('1-1'));
    expect(h.game.liveRules).toBe('current');
  });

  it('newGame keeps the run rules a Classic flow set, or takes opts.rules', () => {
    const h = makeGame();
    h.game.runRules = 'classic';
    h.game.newGame(MARIO, '1-1');
    expect(h.game.state.rules).toBe('classic');
    h.game.newGame(MARIO, '1-1', null, { rules: 'current' });
    expect(h.game.liveRules).toBe('current');
    expect('rules' in h.game.state).toBe(false);
  });
});

describe('carried power when the rules change (TG-16)', () => {
  it('a fire Mario goes back to small and keeps his coins and lives', () => {
    const h = makeGame({ dev: true });
    h.game.devStart('1-1', MARIO, 'fire', false, 1);
    level(h);
    Object.assign(h.game.state, { coins: 12, lives: 2, kit: { x: 1 } });
    h.game.runRules = 'classic';
    h.game.goToLevel('1-2', { mode: 'stand', seed: 1 });
    const l = level(h);
    expect(h.game.state).toMatchObject({
      powerState: 'small',
      coins: 12,
      lives: 2,
      kit: {},
      rules: 'classic',
    });
    expect(l.world.player.powerState).toBe('small');
    expect(h.said).toContain('Rules changed. Power reset.');
  });

  it('with no switch nothing is reset', () => {
    const h = makeGame({ dev: true });
    h.game.devStart('1-1', MARIO, 'fire', false, 1, { rules: 'classic' });
    level(h);
    h.game.goToLevel('1-2', { mode: 'stand', seed: 1 });
    level(h);
    expect(h.game.state.powerState).toBe('fire');
    expect(h.said).not.toContain('Rules changed. Power reset.');
  });

  it('back to Current leaves no rules key on the state', () => {
    const h = makeGame({ dev: true });
    h.game.devStart('1-1', MARIO, 'fire', false, 1, { rules: 'classic' });
    level(h);
    h.game.runRules = 'current';
    h.game.goToLevel('1-2', { mode: 'stand', seed: 1 });
    level(h);
    expect('rules' in h.game.state).toBe(false);
    expect(h.game.state.powerState).toBe('small');
  });
});

describe('campaign saves never carry rules (TG-17b skipped)', () => {
  it('saveFromState writes no rules key, whatever the state says', () => {
    const save = file();
    const s = { ...newGameState(MARIO, null, 'classic') };
    expect(s.rules).toBe('classic');
    expect('rules' in saveFromState(save, s)).toBe(false);
    expect('rules' in saveFromState(save, newGameState(MARIO))).toBe(false);
  });
});

describe('mini games and training rooms stay Current (TG-14)', () => {
  it('every mini game World plays Current defs while the run is Classic', () => {
    for (const c of CHARACTERS) fakeClassic(c);
    const h = makeGame({ dev: true });
    h.game.runRules = 'classic';
    let checked = 0;
    for (const def of Object.values(MINIGAMES)) {
      const scene = def.create(h.game, () => undefined) as { world?: World };
      const w = scene.world;
      if (!(w instanceof World)) continue;
      checked++;
      expect(w.rules, def.hero).toBe('current');
      for (const p of w.players) expect(p.def.rules, def.hero).toBeUndefined();
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('training rooms play Current defs while the run is Classic', () => {
    for (const c of CHARACTERS) fakeClassic(c);
    const h = makeGame({ dev: true });
    h.game.runRules = 'classic';
    const trained = CHARACTERS.filter((c) => hasTraining(c.id));
    expect(trained.length).toBeGreaterThan(0);
    for (const c of trained) {
      const scene = trainingScene(h.game, c, {
        player: 0,
        replay: false,
        onEnd: () => undefined,
      }) as unknown as { world: World };
      expect(scene.world.rules, c.id).toBe('current');
      expect(scene.world.player.def, c.id).toBe(c);
    }
  });
});

describe('the CLASSIC tag and the F1 line (TG-31..33)', () => {
  it('shows CLASSIC? while a hero has no Classic def, CLASSIC when all have, nothing under Current', () => {
    unbuilt(MARIO);
    const h = makeGame({ dev: true });
    h.game.devStart('1-1', MARIO, 'small', false, 1);
    let l = level(h);
    expect(texts(l).some((t) => t.str.startsWith('CLASSIC'))).toBe(false);
    h.game.devStart('1-1', MARIO, 'small', false, 1, { rules: 'classic' });
    l = level(h);
    expect(texts(l)).toContainEqual({ str: 'CLASSIC?', x: 188, y: 28 });
    fakeClassic(MARIO);
    h.game.devStart('1-1', MARIO, 'small', false, 1, { rules: 'classic' });
    l = level(h);
    expect(texts(l)).toContainEqual({ str: 'CLASSIC', x: 196, y: 28 });
  });

  it('the intro card shows the same tag', () => {
    unbuilt(MARIO);
    const h = makeGame({ dev: true });
    h.game.runRules = 'classic';
    const intro = new IntroScene(h.game, () => undefined, 300);
    expect(texts(intro).map((t) => t.str)).toContain('CLASSIC?');
    h.game.runRules = 'current';
    expect(texts(intro).some((t) => t.str.startsWith('CLASSIC'))).toBe(false);
  });

  it('the F1 overlay names each hero rules in a Classic world', () => {
    hideClassicHeroes(); // about heroes with no Classic def, whatever is built
    fakeClassic(MARIO);
    const w = new World(getLevel('1-1'), ctx('classic'), newGameState(MARIO, LINK, 'classic'));
    const o = new DebugOverlay();
    o.enabled = true;
    const lines = texts({ render: (r) => o.render(r, w, 60) }).map((t) => t.str);
    expect(lines).toContain('rules classic p1 mario classic p2 link current');
    expect(rulesLine('classic', [LINK])).toBe('rules classic p1 link current');
    const cur = new World(getLevel('1-1'), ctx(), newGameState(MARIO));
    const curLines = texts({ render: (r) => o.render(r, cur, 60) }).map((t) => t.str);
    expect(curLines.some((l) => l.startsWith('rules'))).toBe(false);
  });
});

describe('HUD, pause guide and music read the played def (TG-19)', () => {
  it('the HUD name and the pause Guide come from players[i].def', () => {
    const cm = fakeClassic({ ...MARIO, hudName: 'CMARIO', name: 'Classic Mario' });
    const h = makeGame({ dev: true });
    h.game.devStart('1-1', MARIO, 'small', false, 1, { rules: 'classic' });
    const l = level(h);
    expect(l.world.player.def).toBe(cm);
    expect(texts(l).map((t) => t.str)).toContain('CMARIO');
    const pause = new PauseScene(h.game, l.world);
    const items = (pause as unknown as { items: MenuItem[] }).items;
    expect(items.some((i) => i.label === 'Guide')).toBe(true);
  });
});

describe('roster plumbing (TG-41..43)', () => {
  it('is deps.characters under Current and in the campaign', () => {
    const h = makeGame({ dev: true });
    fakeExtra('bass');
    expect(h.game.roster).toBe(h.game.deps.characters);
    file();
    h.game.runRules = 'classic';
    h.game.openFile(1);
    expect(h.game.roster).toBe(h.game.deps.characters);
  });

  it('adds the Classic extras in a Classic run, never to the heroes to find', () => {
    const h = makeGame({ dev: true });
    const bass = fakeExtra('bass');
    h.game.runRules = 'classic';
    expect(h.game.roster).toEqual([...CHARACTERS, bass]);
    expect(h.game.heroLocked(bass)).toBe(false);
    h.game.runRules = 'current';
    expect(h.game.heroLocked(bass)).toBe(true);
    expect(h.game.heroesToFind).toBe(0);
  });

  it('with no extras built, a Classic roster is the plain roster', () => {
    const h = makeGame({ dev: true });
    h.game.runRules = 'classic';
    expect(h.game.roster).toBe(h.game.deps.characters);
  });

  it('a carried extra becomes small Mario when the rules go back to Current', () => {
    const bass = fakeExtra('bass');
    const h = makeGame({ dev: true });
    h.game.devStart('1-1', bass, 'fire', false, 1, { rules: 'classic' });
    expect(level(h).world.player.def).toBe(bass);
    h.game.runRules = 'current';
    h.game.goToLevel('1-2', { mode: 'stand', seed: 1 });
    const l = level(h);
    expect(h.game.state.character).toBe(MARIO);
    expect(h.game.state.powerState).toBe('small');
    expect(l.world.player.def).toBe(MARIO);
  });
});

describe('dev Level select Rules row', () => {
  it('starts the run with the chosen rules', () => {
    const h = makeGame({ dev: true });
    h.game.deps.settings = { ...defaultSettings(), dev: true };
    const menu = new DevLevelSelectScene(h.game, () => undefined);
    const items = (menu as unknown as { items: MenuItem[] }).items;
    const rules = items.find((i) => i.label === 'Rules') as MenuItem;
    expect(rules.value?.()).toBe('Current');
    rules.adjust?.(1);
    expect(rules.value?.()).toBe('Classic SMBC');
    items.find((i) => i.label === 'Start')?.select?.();
    expect(h.game.liveRules).toBe('classic');
    expect(level(h).world.rules).toBe('classic');
  });
});

describe('guard: Current untouched (TG-39)', () => {
  it('CHARACTERS keeps its ids and order and no entry has rules', () => {
    expect(CHARACTERS.map((c) => c.id)).toEqual([
      'mario',
      'luigi',
      'link',
      'megaman',
      'samus',
      'simon',
      'ryu',
      'bill',
      'sophia',
    ]);
    for (const c of CHARACTERS) expect(c.rules, c.id).toBeUndefined();
    for (const c of CLASSIC_EXTRAS) expect(CHARACTERS).not.toContain(c);
  });

  it('only classic modules (and registry.ts) import a classic module', () => {
    const root = fileURLToPath(new URL('../../src', import.meta.url));
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : [];
      });
    const isClassic = (rel: string) =>
      /(^|\/)classic[^/]*\.ts$/.test(rel) ||
      rel.includes('characters/classic/') ||
      /(^|\/)rules\/classic-[^/]*\.ts$/.test(rel);
    const bad: string[] = [];
    for (const f of walk(root)) {
      const rel = relative(root, f).replaceAll('\\', '/');
      if (isClassic(rel) || rel === 'game/characters/registry.ts') continue;
      for (const line of readFileSync(f, 'utf8').split('\n')) {
        const m = /^\s*(?:import|export)\b.*from\s+['"]([^'"]+)['"]/.exec(line);
        const spec = m?.[1];
        if (spec && /(^|\/)(classic[^/]*|classic-[^/]*)$|characters\/classic\//.test(spec))
          bad.push(`${rel}: ${line.trim()}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('guides and menu text for Classic (TG-40)', () => {
  const classicDefs = () => [
    ...Object.values(CLASSIC_CHARACTERS).filter((d): d is CharacterDef => !!d),
    ...CLASSIC_EXTRAS,
  ];

  it('every Classic def has a complete guide the font can draw, with no button letters', () => {
    const PROSE = /\b(button|press|push|tap|hold)\s+[abc]\b|\([abc]\)|\b[abc]\s*:/i;
    for (const c of classicDefs()) {
      expect(c.rules).toBe('classic');
      const g = c.guide;
      expect(g.tagline.length).toBeGreaterThan(3);
      expect(g.controls.length).toBeGreaterThanOrEqual(3);
      const prose = [
        g.tagline,
        ...g.controls.flatMap((x) => [x.does, x.touchDoes ?? '']),
        ...g.powerups.map((x) => x.does),
        ...(g.tips ?? []),
      ];
      for (const t of prose) {
        expect(fontText(t).length, `${c.id}: ${t}`).toBe(t.length);
        expect(t, c.id).not.toMatch(PROSE);
      }
    }
  });

  it('the Rules row names no button and fits the font', () => {
    for (const t of [RULES_HINT, ...Object.values(RULES_LABELS), 'Rules']) {
      expect(t).not.toMatch(/\b(BUTTON )?[ABC]\b/);
      expect(fontText(t).length, t).toBe(t.length);
    }
  });
});
