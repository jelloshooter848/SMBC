import { describe, expect, it } from 'vitest';
import { changeNotes } from '../release/change-notes';
import { getLevel, levelIds, specialLevelIds } from '@content/levels';
import { px } from '@engine/math/units';
import { loadProgress } from '@engine/save/progress';
import { SETTINGS_KEY, defaultSettings, loadSettings, type Settings } from '@engine/save/settings';
import type { CharacterDef } from '@game/characters/character';
import { CHARACTERS, heroFor } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { Bowser } from '@game/entities/enemies/bowser';
import { Princess } from '@game/entities/objects/princess';
import { layeredLevel, layerFlags } from '@game/level/layers';
import type { LevelData, Zone } from '@game/level/schema';
import { CHEATS, cheatInfo, lockedText, unlockEarned } from '@game/cheats';
import { LOCKED_CHECKPOINTS } from '@game/rules/classic-cheats';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { CreditsScene } from '@game/scenes/credits';
import { LevelScene } from '@game/scenes/level';
import { newFile } from './classic-files-nav';
import { LevelSelectScene, levelSelectTarget } from '@game/scenes/level-select-cheat';
import type { MenuItem } from '@game/scenes/menu';
import { CARD_GUARD_FRAMES, MessageScene } from '@game/scenes/message';
import {
  MAP_SETS,
  classicBeatStatus,
  classicNextWorld,
  mapSetOf,
  type ClassicMenuScene,
} from '@game/scenes/original-game';
import { TitleScene } from '@game/scenes/title';
import { runSim } from '@game/sim/headless';
import { makeGame, store, useStorage, type H } from './heroes-harness';
import { isolateClassicRegistry } from './classic-registry';

// G-020: Super Mario Bros. Special (MapPack.Special; levelDataSpecial.xml), built with our
// converter (tools/levelgen/regen.mjs: the `sp-` set) into src/content/special-levels/ and its
// layers into src/content/level-layers/special/. It is on the CLASSIC menu in the original's
// order (Smb, Special, LostLevels), open from the start (D3), keeps its own beat status (G-005),
// ends as SMB does (8-4's quest is over, the credits, the title) and its beat is now the All Hammer
// Bros goal (StatManager.as:510-511).

isolateClassicRegistry({ hideExtras: true });
useStorage();

const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const S = (h: H) => h.game.deps.settings as Settings;

function classic(over: Partial<Settings> = {}): H {
  return makeGame({ deps: { settings: { ...defaultSettings(), ...over }, applySettings: () => {} } });
}

const inLevel = (h: H) => h.top() instanceof LevelScene;
function enterLevel(h: H): LevelScene {
  h.until(() => inLevel(h), 600);
  return h.top() as LevelScene;
}
function choose(h: H, def: CharacterDef): void {
  h.until(() => h.top() instanceof CharacterSelectScene, 600);
  h.idle(12);
  const said = () => h.said.at(-1)?.split(', ')[0];
  for (let i = 0; i <= CHARACTERS.length && said() !== def.name; i++) h.tap('right');
  h.tap('jump');
}

const special = () => specialLevelIds();
const MAIN = Array.from({ length: 32 }, (_, i) => `sp-${Math.floor(i / 4) + 1}-${(i % 4) + 1}`);

/** Every level id a zone of `l` leads to. */
function targets(l: LevelData): string[] {
  const out: string[] = [];
  for (const z of l.zones as Zone[]) {
    if (z.kind === 'exit' && z.next !== 'end') out.push(z.next);
    if ((z.kind === 'pipe' || z.kind === 'vine' || z.kind === 'pit') && 'target' in z)
      out.push(z.target.level);
  }
  return out;
}

/** The entity types every Special map and layer spawns (all known to World.makeEntity). */
const KNOWN = new Set([
  'goomba',
  'koopa-green',
  'koopa-red',
  'koopa-para-green',
  'koopa-para-red',
  'koopa-para-green-h',
  'piranha',
  'piranha-down',
  'cheep-red',
  'cheep-grey',
  'blooper',
  'podoboo',
  'hammer-bro',
  'hammer-bro-chase',
  'buzzy',
  'lakitu',
  'balance',
  'princess',
  'toad',
  'bowser',
  'axe',
  'firebar',
  'firebar-ccw',
  'lift-h',
  'lift-v',
  'lift-fall',
  'lift-down',
  'lift-up',
  'lift-right',
  'vine',
  'spring',
  'spring-green',
  'decor-castle',
  'decor-castle-big',
  'block-item',
  'icicle',
  'crab',
  'fly',
  'barrel',
  'fire-enemy',
]);

describe('G-020: the Special set loads and every area converts', () => {
  it('has its 32 levels, each with its areas, as `sp-` ids apart from the campaign maps', () => {
    const ids = special();
    // Not among the campaign's ids (its map, captives, secret exits and sweeps read those).
    expect(levelIds().some((id) => id.startsWith('sp-'))).toBe(false);
    for (const id of MAIN) expect(ids, id).toContain(id);
    expect(ids.length).toBeGreaterThan(MAIN.length);
    // Kept out of src/content/levels (the campaign's maps; their hashes are guarded).
    for (const id of ids) expect(() => getLevel(id), id).not.toThrow();
    expect(getLevel('sp-1-1').world).toBe(1);
    expect(getLevel('sp-8-4').time).toBe(400);
  });

  it('every pipe, vine, pit and exit leads to a Special area; 8-4 ends the game', () => {
    const ids = new Set(special());
    for (const id of ids)
      for (const t of targets(getLevel(id))) expect(ids.has(t), `${id} -> ${t}`).toBe(true);
    const ends = [...ids].filter((id) =>
      getLevel(id).zones.some((z) => z.kind === 'exit' && z.next === 'end'),
    );
    expect(ends).toEqual(['sp-8-4-end4']);
    // The castles go on to the next world (an ordinary castle in a Classic run too).
    expect(getLevel('sp-1-4').zones).toContainEqual({ kind: 'exit', x: 178, next: 'sp-2-1' });
  });

  it('only knows spawn types the World builds, in its maps and in every layer', () => {
    for (const id of special()) {
      const l = getLevel(id);
      const types = [
        ...l.entities.map((e) => e.type),
        ...(l.layers ?? []).flatMap((y) => (y.add ?? []).map((e) => e.type)),
      ];
      for (const t of types) expect(KNOWN.has(t), `${id}: ${t}`).toBe(true);
    }
  });

  it('runs: every area builds a World and plays a second for Mario and Link (Classic)', () => {
    for (const id of special())
      for (const def of [MARIO, LINK]) {
        const r = runSim({
          level: getLevel(id),
          character: def,
          rules: 'classic',
          script: { steps: [] },
          maxFrames: 60,
          assist: { invulnerable: true },
        });
        expect(r.world.level.id, id).toBe(id);
      }
  });

  it("is skinned by Special's theme table (GameSuperMarioBros.as themeMapPack = Special)", () => {
    expect(getLevel('sp-3-1').theme).toBe('night');
    expect(getLevel('sp-5-1').theme).toBe('snow');
    expect(getLevel('sp-1-4').theme).toBe('castle');
    // Single areas: 3-2b the orange giant mushrooms, over its own overworld tune.
    expect(getLevel('sp-3-2').theme).toBe('mushroom');
    expect(getLevel('sp-3-2').music).toBe('overworld');
    // World 8's platform levels are mushrooms too (Special's own world entry).
    expect(getLevel('sp-8-1').theme).toBe('mushroom');
  });

  it('a numbered vine arrives like a pipe, out of that pipe end (Vine.as globPipeExInt; 4-1, 4-3)', () => {
    const vine = (id: string) => getLevel(id).zones.find((z) => z.kind === 'vine');
    expect(vine('sp-4-1')).toMatchObject({ target: { level: 'sp-4-1-sky', x: 2, y: 10, exitDir: 'up' } });
    expect(vine('sp-4-3')).toMatchObject({ target: { level: 'sp-4-3-bonus', x: 2, y: 7, exitDir: 'up' } });
    // Heroes with the vert pieces get the room one row lower: its pipe end too (the layer).
    const vert = layeredLevel(getLevel('sp-4-3'), { difficulty: 'normal', flags: ['vert'] });
    expect(vert.zones.find((z) => z.kind === 'vine')).toMatchObject({
      target: { x: 2, y: 8, exitDir: 'up' },
    });
  });

  it("Extra Checkpoints knows Special's locked halfway points", () => {
    for (const id of ['sp-1-4', 'sp-4-4', 'sp-8-1', 'sp-7-4-end3', 'sp-8-4-end2'])
      expect(LOCKED_CHECKPOINTS[id], id).toBeDefined();
  });
});

describe('G-020 / D3: the CLASSIC menu entry and its order', () => {
  it('lists it between SMB and The Lost Levels (MapPack: Smb, Special, LostLevels), open from the start', () => {
    expect(MAP_SETS.map((m) => m.id)).toEqual(['smb', 'special', 'lost']);
    const h = classic();
    h.game.showClassicMenu();
    const menu = h.top() as ClassicMenuScene;
    expect(items(menu).map((i) => i.label)).toEqual([
      'Super Mario Bros.',
      'SMB Special',
      'The Lost Levels',
      'Back',
    ]);
    for (const it of items(menu)) expect(`${it.label} ${it.hint ?? ''}`).not.toMatch(/\d-\d/);
    h.idle(8);
    h.tap('down');
    expect(h.said.at(-1)).toMatch(/^SMB Special\. Super Mario Bros\. Special: 32 new levels/);
    expect(h.said.at(-1)).not.toMatch(/Beaten/);
  });

  it('its row starts a Classic run at Special 1-1 (B-L: a new file, on the difficulty it asks)', () => {
    const h = classic();
    h.game.showClassicMenu();
    h.idle(8);
    h.tap('down');
    expect(h.said.at(-1)).toMatch(/^SMB Special\./);
    h.tap('jump');
    // An empty file: Special has the original's Easy and Hard layers, so it asks.
    newFile(h, 1, 'Easy');
    choose(h, MARIO);
    const l = enterLevel(h);
    expect(l.level.id).toBe('sp-1-1');
    expect(h.game.classicRun).toBe(true);
    expect(h.game.ctx.mapDifficulty).toBe('easy');
    expect(S(h).classicMapDifficulty).toBe('normal');
    expect(h.said.some((t) => /World 1-1/.test(t))).toBe(true);
  });

  it('the Level Select cheat offers it with its eight worlds', () => {
    const h = classic();
    S(h).classicCheats.levelSelect = true;
    const set = MAP_SETS[1];
    expect(set?.lastWorld).toBe(8);
    h.game.scenes.push(new LevelSelectScene(h.game, () => h.game.scenes.pop()));
    h.idle(8);
    h.tap('right');
    expect(items(h.top())[0]?.value?.()).toBe('Special');
    expect(levelSelectTarget(h.game, set as never, 3, 1)).toBe('sp-3-1');
  });
});

describe('G-005 / G-020: beat status and the end of the game', () => {
  it('owns its ids; its castles go on to the next world, 8-4 ends it', () => {
    expect(mapSetOf('sp-3-2-bonus').id).toBe('special');
    expect(mapSetOf('3-2').id).toBe('smb');
    expect(classicNextWorld('sp-4-4')).toBe('sp-5-1');
    expect(classicNextWorld('sp-8-4')).toBeNull();
  });

  it('8-4: the princess, "YOUR QUEST IS OVER.", the credits, the cheat cards, the title; Special beaten', () => {
    const h = classic();
    h.game.classicGame(MARIO, 'sp-8-4-end4');
    const l = enterLevel(h);
    expect(l.world.classicEnd).toEqual({ next: null });
    expect(
      l.world.entities.some((e) => e instanceof Princess) ||
        l.level.entities.some((e) => e.type === 'princess'),
    ).toBe(true);
    const w = l.world;
    h.game.ctx.assist.invulnerable = true;
    const put = (col: number) => {
      const b = w.player.body;
      b.x = px(col * 16 + 2);
      b.y = px(9 * 16) - b.h;
      b.vx = 0;
      b.vy = 0;
      w.camera.snapTo(b.x);
    };
    put(42);
    let placed = false;
    let quest = false;
    for (let i = 0; i < 2000 && h.top() === l; i++) {
      if (!placed && w.entities.some((e) => e instanceof Bowser && !e.fake)) {
        placed = true;
        put(48);
      }
      if (w.castleText.includes('YOUR QUEST IS OVER.')) quest = true;
      h.step(w.castleWaiting && i % 2 === 0 ? ['jump'] : []);
    }
    expect(placed).toBe(true);
    expect(quest).toBe(true);
    const credits = h.top() as CreditsScene;
    expect(credits).toBeInstanceOf(CreditsScene);
    h.until(() => credits.touchLabels().jump === 'OK', 6000);
    h.tap('jump');
    const unlocked: string[] = [];
    for (let i = 0; i < 12 && h.top() instanceof MessageScene; i++) {
      unlocked.push(h.said.at(-1) ?? '');
      h.idle(CARD_GUARD_FRAMES + 2);
      h.tap('jump');
    }
    expect(h.top()).toBeInstanceOf(TitleScene);
    expect(classicBeatStatus('special')).toBe('normal');
    expect(classicBeatStatus('smb')).toBe('none');
    expect(classicBeatStatus('lost')).toBe('none');
    expect(S(h).classicCheats.beaten.special).toBe(true);
    // G-020: beating Special unlocks All Hammer Bros, told on its card.
    expect(unlocked.some((t) => /^You unlocked the All Hammer Bros cheat!/.test(t))).toBe(true);
    expect(S(h).classicCheats.unlocked.allHammerBros).toBe(true);
  });

  it('a beat is kept per difficulty in the progress store', () => {
    const h = classic();
    h.game.classicGame(MARIO, 'sp-1-1');
    h.game.classicRun = true;
    h.game.classicDev = false;
    h.game.classicDifficulty = 'hard';
    (h.game as unknown as { afterCredits(from: string): void }).afterCredits('sp-8-4-end4');
    expect(loadProgress().classicBeat?.special).toBe('hard');
    h.game.showClassicMenu();
    const row = items(h.top()).find((i) => /Special/.test(String(i.label)));
    expect(row?.hint).toMatch(/Beaten on Hard/);
  });
});

describe('G-020: All Hammer Bros comes from beating Special only (StatManager.as:510-511)', () => {
  it("its goal and locked text are the original's", () => {
    const info = cheatInfo('allHammerBros');
    expect(info.goal).toEqual({ kind: 'beat-special' });
    expect(info.goalText).toBe('Beat the Super Mario Bros. Special map set.');
    expect(lockedText(defaultSettings().classicCheats, 'allHammerBros')).not.toMatch(/Lost Levels/);
    expect(CHEATS.some((c) => c.goal.kind === ('beat-lost' as never))).toBe(false);
  });

  it('The Lost Levels or SMB beaten do not unlock it; Special does', () => {
    const c = defaultSettings().classicCheats;
    c.beaten.lost = true;
    c.beaten.smb = true;
    expect(unlockEarned(c)).not.toContain('allHammerBros');
    expect(c.unlocked.allHammerBros).toBe(false);
    c.beaten.special = true;
    expect(unlockEarned(c)).toContain('allHammerBros');
  });

  it('a save that unlocked it under the old goal keeps it; an old save has Special unbeaten', () => {
    const old = defaultSettings() as unknown as {
      classicCheats: { beaten: Record<string, boolean>; unlocked: Record<string, boolean> };
    };
    old.classicCheats.unlocked.allHammerBros = true;
    old.classicCheats.beaten = { smb: false, lost: true };
    store.set(SETTINGS_KEY, JSON.stringify(old));
    const s = loadSettings();
    expect(s.classicCheats.unlocked.allHammerBros).toBe(true);
    expect(s.classicCheats.beaten).toEqual({ smb: false, special: false, lost: true });
    // And a Lost Levels beat never takes it away.
    unlockEarned(s.classicCheats);
    expect(s.classicCheats.unlocked.allHammerBros).toBe(true);
  });

  it('the CHANGELOG says so', () => {
    // Any section or fragment: a note in changes/ moves into a dated section when a release is stamped.
    const log = changeNotes();
    const entry = log.split(/\n(?=- )/).find((item) => /All Hammer Bros/.test(item));
    expect(entry).toMatch(/Special/);
  });
});

describe('G-006 / G-010: the layers per difficulty and hero', () => {
  const profile = (difficulty: 'easy' | 'normal' | 'hard', def: CharacterDef = MARIO) => ({
    difficulty,
    flags: layerFlags([heroFor(def, 'classic')]),
  });
  const count = (l: LevelData, type: string) => l.entities.filter((e) => e.type === type).length;

  it('every Special area with layers has them for Easy or Hard, and many for heroes with level flags', () => {
    const withLayers = special().filter((id) => getLevel(id).layers?.length);
    expect(withLayers.length).toBeGreaterThan(40);
    const flagged = withLayers.filter((id) => getLevel(id).layers?.some((l) => l.flags.length > 0));
    expect(flagged.length).toBeGreaterThan(10);
  });

  it('1-1 differs on Easy, Normal and Hard, and for Link (charHorz pieces)', () => {
    const base = getLevel('sp-1-1');
    const easy = layeredLevel(base, profile('easy'));
    const normal = layeredLevel(base, profile('normal'));
    const hard = layeredLevel(base, profile('hard'));
    expect(normal).toBe(base);
    expect(easy).not.toBe(base);
    expect(hard).not.toBe(base);
    const link = layeredLevel(base, profile('normal', LINK));
    expect(link).not.toBe(base);
  });

  it("the World lays them: a Hard run has more of Special 4-2's enemies than an Easy one", () => {
    const run = (mapDifficulty: 'easy' | 'normal' | 'hard') =>
      runSim({
        level: getLevel('sp-4-2'),
        character: MARIO,
        rules: 'classic',
        mapDifficulty,
        script: { steps: [] },
        maxFrames: 1,
      }).world.level;
    const enemies = (l: LevelData) =>
      ['icicle', 'crab', 'fly', 'barrel', 'fire-enemy', 'goomba'].reduce((n, t) => n + count(l, t), 0);
    expect(enemies(run('hard'))).toBeGreaterThan(enemies(run('easy')));
    // A Campaign World plays the map as it is.
    const cur = runSim({
      level: getLevel('sp-4-2'),
      character: MARIO,
      rules: 'campaign',
      script: { steps: [] },
      maxFrames: 1,
    });
    expect(cur.world.level).toBe(getLevel('sp-4-2'));
  });

  it("SMB1's and The Lost Levels' Hard layers now hold Special's enemies and items (G-021, G-022)", () => {
    const hardAdds = (prefix: RegExp) =>
      levelIds()
        .filter((id) => prefix.test(id))
        .flatMap((id) =>
          (getLevel(id).layers ?? []).filter((l) => l.difficulty === 'hard').flatMap((l) => l.add ?? []),
        );
    const smb = hardAdds(/^\d/).map((e) => (e.type === 'block-item' ? String(e.props?.item) : e.type));
    const lost = hardAdds(/^ll-/).map((e) => (e.type === 'block-item' ? String(e.props?.item) : e.type));
    for (const t of ['icicle', 'crab', 'fly', 'barrel']) {
      expect(smb, t).toContain(t);
      expect(lost, t).toContain(t);
    }
    expect([...smb, ...lost]).toContain('atom');
  });
});
