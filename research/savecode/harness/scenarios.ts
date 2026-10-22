/* eslint-disable @typescript-eslint/no-explicit-any */
/* Test profiles for the benchmark, built with the game's real constructors (newSave, migrateSave, defaultSettings). */
import { readFileSync } from 'node:fs';
import { Rng } from '@engine/rng';
import { defaultSettings, CLASSIC_CHEAT_IDS, CLASSIC_CHEAT_STATS } from '@engine/save/settings';
import { CLASSIC_ROW_VALUES, CLASSIC_WEAPON_VALUES, defaultClassicWeapons } from '@engine/save/original-options';
import { CHARACTERS } from '@game/characters/registry';
import { HERO_ITEMS } from '@game/items/catalog';
import { hasKey } from '@game/items/flags';
import { heroStart, itemRules } from '@game/items/heroes';
import { MAP_PAGES } from '@content/worldmap';
import { CRYSTAL_BALL } from '@game/map/captives';
import { KAKARIKO } from '@game/town/secret-house';
import { beat, STORY_REV } from '@game/story/beats';
import { migrateSave, newSave, type SaveFile } from '@game/save/save-files';
import { Actions } from '@engine/input/actions';
import { CLASSIC_HEROES, KEY_CODES, levelWS, progressDefault, SETS } from './schema';

// ------------------------------------------------------------------ campaign files (copied from save-code.test.ts helpers)

export function fullHero(id: string): { powerState: string; hp: number; kit: Record<string, number> } {
  const c = CHARACTERS.find((h) => h.id === id);
  if (!c) throw new Error(id);
  const s = heroStart(c);
  const p = { def: c, scratch: { ...s.kit }, hp: s.hp, powerState: c.damage.kind === 'powerup' ? 'fire' : 'full', startTransition: () => {} };
  const rules = itemRules(id);
  for (let k = 0; k < 6; k++)
    for (const item of HERO_ITEMS[id]?.items ?? [])
      try {
        rules?.give(p as never, item.id);
      } catch {
        p.scratch[hasKey(item.id)] = 1;
      }
  if (id === 'mario' || id === 'luigi') p.powerState = 'fire';
  return { powerState: p.powerState, hp: p.hp, kit: p.scratch };
}
const LEVELS = MAP_PAGES.flatMap((p) => p.nodes.flatMap((n) => (n.level ? [n.level] : [])));
const SMB_PAGES = MAP_PAGES.filter((p) => p.group === 'smb').map((p) => p.id);

const T0 = 1792627409905; // a fixed "now" (ms) so runs are repeatable
function stamp(s: SaveFile, created: number, updated: number): SaveFile {
  return { ...s, created, updated };
}

export function fullSave(slot: 1 | 2 | 3 = 1): SaveFile {
  const heroes = CHARACTERS.map((c) => c.id);
  const m = fullHero('mario');
  const raw = {
    ...newSave(slot, 'mario'),
    lives: 99,
    coins: 999,
    score: 4_812_350,
    wallet: true,
    powerState: m.powerState,
    hp: m.hp,
    kit: m.kit,
    cleared: LEVELS.slice(),
    pages: MAP_PAGES.map((p) => p.id),
    secrets: ['bonus-1', 'bonus-2', KAKARIKO, 'bonus-3', CRYSTAL_BALL, 'bonus-5', 'bonus-6', 'bonus-7', 'bonus-8'],
    position: { page: 'll-13', node: 'll-13-4' },
    gameCleared: true,
    lastNode: Object.fromEntries(
      MAP_PAGES.filter((p) => p.group !== 'arena' && p.id !== 'hub').map((p) => [p.id, p.nodes[p.nodes.length - (p.group === 'smb' ? 2 : 1)]?.id ?? 'start']),
    ),
    freed: heroes,
    tutorials: heroes,
    met: [...heroes, 'larry'],
    inventoryUnlocked: true,
    heroKits: Object.fromEntries(heroes.filter((h) => h !== 'mario').map((h) => [h, fullHero(h)])),
    heroInventory: { mario: ['star', 'flower', '1up'], link: ['mushroom', 'star'], samus: ['1up'] },
    heroItemsNext: { mario: ['star'] },
    bonusNext: 2,
    story: [
      STORY_REV, beat.opening, beat.spell, beat.luigiRuns, beat.fakes, beat.crash, beat.anchor42, beat.rift, beat.bowser84, beat.hub, beat.arena,
      ...SMB_PAGES.flatMap((p, i) => [beat.enter(p), beat.gate(p), beat.sealed(p), ...(i > 0 ? [beat.welcome(p)] : []), ...(i < 7 ? [beat.remark(`${i + 1}-4`)] : [])]),
    ],
  };
  const s = migrateSave(raw, slot);
  if (!s) throw new Error('full save did not validate');
  return stamp(s, T0 - 90 * 86400e3, T0 - 3600e3);
}

export function midSave(slot: 1 | 2 | 3 = 2): SaveFile {
  const raw = {
    ...newSave(slot, 'link'),
    lives: 7,
    coins: 63,
    score: 212_400,
    powerState: 'full',
    hp: 10,
    kit: { found: 1, maxHp: 10, [hasKey('bomb-bag')]: 1, bombs: 6, tool: 0, magic: 20, [hasKey('shield-spell')]: 1 },
    cleared: ['1-0', '1-1', '1-2', '1-3', '1-4', '2-1', '2-2', '2-3', '2-4', '3-1', '3-2', '3-3', '3-4', '4-1'],
    pages: ['smb-1', 'smb-2', 'smb-3', 'smb-4'],
    secrets: ['bonus-1', KAKARIKO],
    position: { page: 'smb-4', node: '4-1' },
    lastNode: { 'smb-1': '1-4', 'smb-2': '2-4', 'smb-3': '3-4' },
    pendingReveal: ['smb-4:4-1>4-2', 'smb-4:4-2'],
    freed: ['mario', 'luigi', 'link', 'megaman'],
    tutorials: ['mario', 'luigi', 'link'],
    met: ['mario', 'luigi', 'link', 'megaman', 'samus'],
    heroKits: {
      mario: { powerState: 'big', hp: 0, kit: { found: 1 } },
      megaman: { powerState: 'full', hp: 28, kit: { found: 1, helmet: 1, [hasKey('saw-disc')]: 1, wsaw: 17 } },
    },
    heroInventory: { link: ['mushroom', 'flower'] },
    bonusNext: 1,
    spadeBoard: 1,
    spadeTaken: [0, 5],
    story: [
      STORY_REV, beat.opening, beat.spell, beat.luigiRuns, beat.fakes,
      ...['smb-1', 'smb-2', 'smb-3', 'smb-4'].map(beat.enter),
      ...['smb-2', 'smb-3', 'smb-4'].map(beat.welcome),
      ...['smb-1', 'smb-2', 'smb-3'].flatMap((p) => [beat.gate(p), beat.sealed(p)]),
      ...['1-4', '2-4', '3-4'].map(beat.remark),
    ],
  };
  const s = migrateSave(raw, slot);
  if (!s) throw new Error('mid save did not validate');
  return stamp(s, T0 - 20 * 86400e3, T0 - 7200e3);
}

export function firstCastle(slot: 1 | 2 | 3 = 1): SaveFile {
  const s = migrateSave(
    {
      ...newSave(slot, 'mario'),
      powerState: 'fire',
      coins: 42,
      score: 31_250,
      cleared: ['1-0', '1-1', '1-2', '1-3', '1-4'],
      pages: ['smb-1', 'smb-2'],
      position: { page: 'smb-1', node: '1-4' },
      lastNode: { 'smb-1': '1-4' },
      pendingReveal: ['smb-1:1-4>smb-2', 'smb-2:start'],
      freed: ['mario', 'luigi'],
      met: ['mario', 'luigi'],
      heroInventory: { mario: ['star'] },
      story: [STORY_REV, beat.opening, beat.spell, beat.enter('smb-1'), beat.luigiRuns, beat.remark('1-4')],
    },
    slot,
  ) as SaveFile;
  return stamp(s, T0 - 2 * 86400e3, T0 - 600e3);
}

export function freshSave(slot: 1 | 2 | 3 = 1): SaveFile {
  return stamp(newSave(slot, 'mario'), T0, T0);
}

// ------------------------------------------------------------------ Classic slots

const KITS = [{}, { tier: 1 }, { tier: 2, ammo: 21 }, { tier: 3, ammo: 40, missiles: 12 }, { bombs: 8, arrows: 30, bow: 1 }, { subs: 2, hearts: 15, whip: 2 }];
function kitFor(rng: Rng): Record<string, number> {
  return { ...(KITS[rng.int(KITS.length)] as Record<string, number>) };
}
const POWERS = ['small', 'big', 'fire'];
const ROSTER = CLASSIC_HEROES.slice(0, 16);

function heroKits(rng: Rng, n: number, except: string): Record<string, any> {
  const out: Record<string, any> = {};
  for (const h of ROSTER.filter((h) => h !== except).slice(0, n)) out[h] = { powerState: POWERS[rng.int(3)], hp: rng.chance(0.5) ? 3 : 0, kit: kitFor(rng) };
  return out;
}

export interface SlotOpts {
  levelId: string;
  hero?: string;
  score?: number;
  coins?: number;
  lives?: number;
  kits?: number;
  survival?: number;
  difficulty?: 'easy' | 'normal' | 'hard';
  gameMode?: 'all' | 'survival' | 'single' | 'single-random';
  checkpoint?: boolean;
  savedAt?: number;
  rng: Rng;
}
/** ClassicResume as resumeOf + saveClassicResume write it (main), with PR #193's heroKits when kits > 0. */
export function resume(o: SlotOpts): any {
  const hero = o.hero ?? 'mario';
  return {
    v: 1,
    levelId: o.levelId,
    rules: 'classic',
    hero,
    score: o.score ?? 0,
    coins: o.coins ?? 0,
    lives: o.lives ?? 3,
    ...levelWS(o.levelId),
    powerState: POWERS[o.rng.int(3)],
    hp: 0,
    kit: kitFor(o.rng),
    warped: false,
    checkpoint: o.checkpoint ? { level: o.levelId, x: 80 + o.rng.int(60), y: 12 } : null,
    ...(o.survival ? { survival: { fallen: ROSTER.filter((h) => h !== hero).slice(0, o.survival), reviveAllowed: true } } : {}),
    difficulty: o.difficulty ?? 'normal',
    gameMode: o.gameMode ?? (o.survival ? 'survival' : 'all'),
    ...(o.kits ? { heroKits: heroKits(o.rng, o.kits, hero) } : {}),
    savedAt: o.savedAt ?? T0,
  };
}

const MORE_DEFAULT = { lives: 'original', attack: 'original', whenHit: 'original', drops: 'original', piranhas: 'original', goombas: 'original', enemySpeed: 'original' };
/** A planned B-L Classic file (DESIGN ONLY: field names are the sample's placeholders). */
export function blFile(o: SlotOpts & { rules?: 'default' | 'some' | 'all'; continues?: number }): any {
  const hero = o.hero ?? 'mario';
  const r = o.rules ?? 'default';
  const more: any = { ...MORE_DEFAULT };
  const weapons: any = {};
  let disabled: string[] = [];
  if (r !== 'default') {
    more.lives = 5;
    more.goombas = 'spiny';
    if (r === 'all') {
      more.lives = 10;
      more.attack = 'very-strong';
      more.whenHit = 'instant-death';
      more.drops = 'very-high';
      more.piranhas = 'red-all';
      more.goombas = 'spike-top';
      more.enemySpeed = 'fast';
      const def = defaultClassicWeapons() as any;
      for (const [k, vals] of Object.entries(CLASSIC_WEAPON_VALUES)) weapons[k] = (vals as string[]).find((v) => v !== def[k]);
      // keep the weapon pairs apart
      weapons.billFirst = 'flare';
      weapons.billSecond = 'laser';
      weapons.ryuStart = 'jump-slash';
      weapons.ryuExtra = 'fire-wheel';
      weapons.simonStart = 'dagger';
      weapons.simonExtra = 'holy-water';
      disabled = ROSTER.slice(5, 10);
    } else weapons.samus = 'ice';
  }
  return {
    v: 1,
    levelId: o.levelId,
    hero,
    score: o.score ?? 0,
    coins: o.coins ?? 0,
    lives: o.lives ?? 3,
    powerState: POWERS[o.rng.int(3)],
    hp: 0,
    kit: kitFor(o.rng),
    heroKits: o.kits ? heroKits(o.rng, o.kits, hero) : {},
    checkpoint: o.checkpoint ? { x: 80 + o.rng.int(60), y: 12 } : null,
    continues: o.continues ?? 0,
    rules: { difficulty: o.difficulty ?? 'normal', gameMode: o.gameMode ?? (o.survival ? 'survival' : 'all'), more, weapons, disabled },
    ...(o.survival ? { survival: { fallen: ROSTER.filter((h) => h !== hero).slice(0, o.survival), reviveAllowed: true } } : {}),
    savedAt: o.savedAt ?? T0,
  };
}

// ------------------------------------------------------------------ settings variants

export function typicalSettings(): any {
  const s: any = defaultSettings();
  s.audio.master = 0.7;
  s.input.touch = 'on';
  s.homeScreen.tipDone = true;
  s.classicCheats.stats = { enemiesDefeated: 412, enemiesStomped: 160, armouredDefeated: 12, bricksBroken: 96, ammoPickups: 40, cheepsDefeated: 7, hammerBrosDefeated: 3 };
  s.classicCheats.beaten.smb = true;
  s.classicCheats.unlocked.allGroundIsBricks = true;
  return s;
}
export function lateSettings(): any {
  const s = typicalSettings();
  s.classicMapDifficulty = 'hard';
  s.classicCheats.stats = { enemiesDefeated: 18_212, enemiesStomped: 7_420, armouredDefeated: 640, bricksBroken: 5_120, ammoPickups: 2_210, cheepsDefeated: 380, hammerBrosDefeated: 141 };
  s.classicCheats.beaten = { smb: true, special: true, lost: false };
  for (const id of ['allGroundIsBricks', 'allHammerBros', 'bouncyPits', 'extraCheckpoints', 'infiniteAmmo', 'waterMode']) s.classicCheats.unlocked[id] = true;
  s.classicCheats.on.extraCheckpoints = true;
  s.classicCheats.continuesUsed = 14;
  s.classicTutorialsSeen = ['select', 'first-start', 'mario', 'link'];
  return s;
}
export function unusualSettings(rng: Rng): any {
  const s: any = lateSettings();
  s.video = { integerScale: false, palette: 'deuteranopia', reduceFlashing: true, showFps: true };
  s.audio = { master: 0.3, music: 0.5, sfx: 0.8, muted: false };
  const kb = KEY_CODES.filter((c) => !c.startsWith('pad:'));
  const pads = KEY_CODES.filter((c) => c.startsWith('pad:'));
  for (const b of s.input.bindings) {
    for (const a of Actions) {
      b.keyboard[a] = Array.from({ length: 1 + rng.int(3) }, () => kb[rng.int(kb.length)]);
      b.gamepad[a] = Array.from({ length: 1 + rng.int(2) }, () => pads[rng.int(pads.length)]);
    }
  }
  s.input.bindings[1].gamepadIndex = 1;
  s.input.touchScale = 1.3;
  s.input.dpad = 'floating';
  s.input.keyHints = true;
  s.assist = { allowLeftScroll: true, infiniteLives: false, invulnerable: false, infiniteTime: true, coyoteFrames: 6, fireRevertsToBig: true, safetyFloor: true, slowMotion: 2 };
  s.packs = ['my-retro-pack', 'hd-sfx'];
  s.announce = false;
  s.backupReminders = true;
  s.classicRules = 'current';
  s.classic = { ...s.classic, lives: 5, whenHit: 'previous-state', attack: 'strong', drops: 'high', enemySpeed: 'fast', piranhas: 'all', goombas: 'buzzy', gameMode: 'single', musicSet: 'random', expansion: 'on' };
  s.classic.weapons = { ...s.classic.weapons, samus: 'ice', link: 'bow', ryuStart: 'fire-wheel' };
  s.classicSkins = { megaman: 'protoman', samus: 'pit' };
  s.classicHeroesOff = ['simon', 'sophia'];
  s.classicTutorials = true;
  return s;
}
export function maxSettings(rng: Rng): any {
  const s = unusualSettings(rng);
  for (const k of CLASSIC_CHEAT_STATS) s.classicCheats.stats[k] = 9_999_999;
  for (const id of CLASSIC_CHEAT_IDS) {
    s.classicCheats.unlocked[id] = true;
    s.classicCheats.on[id] = rng.chance(0.5);
  }
  s.classicCheats.continuesUsed = 99_999;
  s.classicCheats.levelSelect = true;
  s.classicCheats.beaten = { smb: true, special: true, lost: true };
  s.classicSkins = Object.fromEntries(['mario', 'luigi', 'link', 'megaman', 'ryu', 'bass'].map((h, i) => [h, CLASSIC_HEROES[20 + i] ?? h]));
  s.classicTutorialsSeen = Array.from({ length: 30 }, (_, i) => `box-${i}`);
  // a dev profile (release builds clear these unless the passphrase was entered)
  s.dev = true;
  s.devUnlock = 'f'.repeat(64);
  s.classicDev = { yoshiMount: true, yoshiRide: true, heroesOff: ['bill'], heroesOn: ['vicviper', 'yoshi'] };
  return s;
}
export function unlockedSettings(): any {
  const s = lateSettings();
  for (const id of CLASSIC_CHEAT_IDS) s.classicCheats.unlocked[id] = true;
  s.classicCheats.levelSelect = true;
  s.classicCheats.beaten = { smb: true, special: true, lost: true };
  s.classicCheats.continuesUsed = 0;
  return s;
}
void CLASSIC_ROW_VALUES;

// ------------------------------------------------------------------ profiles

export interface Scenario {
  name: string;
  current: Record<string, any>;
  bl: Record<string, any>;
}
const resumeKey = (set: string) => `smbc-classic-resume-${set}`;
const blKey = (set: string, n: number) => `smbc-classic-file-${set}-${n}`;
const LV: Record<string, string[]> = { smb: ['3-2', '6-1', '8-3'], special: ['sp-2-1', 'sp-5-3', 'sp-8-2'], lost: ['ll-1-2', 'll-4-1', 'll-8-4'] };

function build(name: string, settings: any, progress: any, saves: (SaveFile | null)[], classic: (Omit<SlotOpts, 'levelId' | 'rng'> & { rules?: 'default' | 'some' | 'all'; continues?: number })[][], rng: Rng): Scenario {
  const base: Record<string, any> = {};
  if (settings) base['smbc.settings'] = settings;
  if (progress) base['smbc.progress'] = progress;
  saves.forEach((s, i) => {
    if (s) base[`smbc.save.${i + 1}`] = { ...s, slot: i + 1 };
  });
  const current = structuredClone(base);
  const bl = structuredClone(base);
  SETS.forEach((set, si) => {
    const files = classic[si] ?? [];
    files.forEach((o, n) => {
      const levelId = (LV[set] as string[])[n % 3] as string;
      if (n === 0) current[resumeKey(set)] = resume({ ...o, levelId, rng: new Rng(rng.next()) });
      bl[blKey(set, n + 1)] = blFile({ ...o, levelId, rng: new Rng(rng.next()) });
    });
  });
  return { name, current, bl };
}

export function scenarios(): Scenario[] {
  const rng = new Rng(20261022);
  const out: Scenario[] = [];
  out.push(build('fresh', defaultSettings(), progressDefault(), [], [], rng));
  out.push(
    build('typical (mid-game)', typicalSettings(), { ...progressDefault(), classicBeat: { smb: 'normal', special: 'none', lost: 'none' } }, [midSave(1)], [[{ hero: 'link', score: 45_200, coins: 37, lives: 2, kits: 2, checkpoint: true }]], rng),
  );
  out.push(
    build(
      'late / end-game',
      lateSettings(),
      { ...progressDefault(), lost: { world9: false, letters: false, beaten: 3 }, classicBeat: { smb: 'hard', special: 'normal', lost: 'easy' } },
      [fullSave(1), midSave(2), firstCastle(3)],
      SETS.map(() => [0, 1, 2].map((i) => ({ hero: ROSTER[i * 3] as string, score: 300_000 + i * 91_350, coins: 20 + i, lives: 4, kits: 8, checkpoint: true, difficulty: 'hard' as const, rules: i ? ('some' as const) : ('default' as const), continues: i }))),
      rng,
    ),
  );
  out.push(build('unusual settings + key bindings', unusualSettings(rng), progressDefault(), [midSave(1)], [[{ hero: 'samus', score: 12_000, kits: 1 }]], rng));
  out.push(
    build(
      'max values',
      maxSettings(rng),
      { v: 1, bestScore: 99_999_999, lastCharacter: 'sophia', reached: { mario: '8-4', link: 'll-13-4' }, cleared: ['8-4', 'll-8-4'], lost: { world9: true, letters: true, beaten: 999 }, classicBeat: { smb: 'hard', special: 'hard', lost: 'hard' } },
      [1, 2, 3].map((n) => ({ ...fullSave(n as 1), score: 9_999_999, lives: 99, coins: 999, devUnlockAll: true, devAllHeroes: true, devGateOpen: true })),
      SETS.map(() => [0, 1, 2].map((i) => ({ hero: ROSTER[15 - i] as string, score: 9_999_999, coins: 99, lives: 99, kits: 15, checkpoint: true, difficulty: 'hard' as const, gameMode: 'single-random' as const, rules: 'all' as const, continues: 99 }))),
      rng,
    ),
  );
  out.push(
    build(
      'fully unlocked (100%, runs finished)',
      unlockedSettings(),
      { ...progressDefault(), lost: { world9: true, letters: true, beaten: 8 }, classicBeat: { smb: 'hard', special: 'hard', lost: 'hard' } },
      [fullSave(1), fullSave(2), fullSave(3)],
      [],
      rng,
    ),
  );
  out.push(
    build('Survival runs', lateSettings(), { ...progressDefault(), classicBeat: { smb: 'normal', special: 'none', lost: 'none' } }, [midSave(1)], SETS.map(() => [0, 1, 2].map((i) => ({ hero: ROSTER[i] as string, score: 150_000, lives: 6, kits: 6, survival: 3 + i, checkpoint: i === 1 }))), rng),
  );
  return out;
}

/** The supplied sample (B-L placeholder shape), and the same data with its 9 classic files as 3 current ClassicResume slots. */
export function sampleScenario(path: string): { sample: any; scenario: Scenario } {
  const sample = JSON.parse(readFileSync(path, 'utf8'));
  const bl = structuredClone(sample.data);
  const current: Record<string, any> = {};
  for (const [k, v] of Object.entries(bl)) if (!k.startsWith('smbc-classic-file-')) current[k] = structuredClone(v);
  for (const set of SETS) {
    const f: any = bl[`smbc-classic-file-${set}-1`];
    if (!f) continue;
    current[`smbc-classic-resume-${set}`] = {
      v: 1,
      levelId: f.levelId,
      rules: 'classic',
      hero: f.hero,
      score: f.score,
      coins: f.coins,
      lives: f.lives,
      ...levelWS(f.levelId),
      powerState: f.powerState,
      hp: f.hp,
      kit: f.kit,
      warped: false,
      checkpoint: f.checkpoint ? { level: f.levelId, x: f.checkpoint.x, y: f.checkpoint.y } : null,
      difficulty: f.rules.difficulty,
      gameMode: 'all',
      heroKits: f.heroKits,
      savedAt: f.savedAt,
    };
  }
  return { sample, scenario: { name: 'supplied sample', current, bl } };
}

/** Seeded random profiles for the min / median / max spread. */
export function randomScenarios(n: number): Scenario[] {
  const out: Scenario[] = [];
  for (let i = 0; i < n; i++) {
    const rng = new Rng(1000 + i);
    const st = rng.int(4);
    const settings = st === 0 ? defaultSettings() : st === 1 ? typicalSettings() : st === 2 ? lateSettings() : unusualSettings(rng);
    const progress = { ...progressDefault(), lost: { world9: rng.chance(0.2), letters: false, beaten: rng.int(10) }, classicBeat: { smb: ['none', 'easy', 'normal', 'hard'][rng.int(4)], special: ['none', 'normal'][rng.int(2)], lost: ['none', 'hard'][rng.int(2)] } };
    progress.lost.letters = progress.lost.beaten >= 8;
    const saves = [1, 2, 3].map((slot) => {
      const k = rng.int(5);
      if (k === 0) return null;
      const s = k === 1 ? freshSave(slot as 1) : k === 2 ? firstCastle(slot as 1) : k === 3 ? midSave(slot as 1) : fullSave(slot as 1);
      return { ...s, score: rng.int(2_000_000), lives: 1 + rng.int(20), coins: rng.int(99) };
    });
    const classic = SETS.map(() =>
      Array.from({ length: rng.int(4) }, () => ({
        hero: ROSTER[rng.int(ROSTER.length)] as string,
        score: rng.int(1_000_000),
        coins: rng.int(100),
        lives: 1 + rng.int(9),
        kits: rng.int(10),
        survival: rng.chance(0.2) ? 1 + rng.int(5) : 0,
        checkpoint: rng.chance(0.5),
        difficulty: (['easy', 'normal', 'hard'] as const)[rng.int(3)],
        rules: (['default', 'default', 'some', 'all'] as const)[rng.int(4)],
        continues: rng.int(5),
      })),
    );
    out.push(build(`random-${i}`, settings, progress, saves, classic, rng));
  }
  return out;
}

export const BENCH_T0 = T0;
