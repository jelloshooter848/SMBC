import { MAP_DIFFICULTIES, type MapDifficulty } from '@engine/save/settings';
import { loadJson, saveJson } from '@engine/save/storage';
import { MenuScene, backToMenu, type MenuItem } from './menu';
import type { Game } from './game';
import type { CharacterDef } from '../characters/character';
import { readRules, type Rules } from '../context';
import { CLASSIC_EXTRAS, playedHero, skinsOf } from '../characters/registry';
import { DEV_VILLAGE } from '../town/secret-house';
import { CUSTOM_PREFIX, customLevelId, loadLibrary } from '../level/library';
import { MAP_SETS, DIFFICULTY_NAMES, type MapSet } from './original-game';
import { levelSelectTarget, worldName } from './level-targets';
import { DevMiniGamesScene } from './dev-minigames';
import { DevBonusGamesScene } from '../bonus/dev';
import { hasTraining, runTraining } from '../tutorial/training';
import { loadSave, SAVE_SLOTS } from '../save/save-files';

/*
 * O-05: the dev Level select as pages (Dev > Classic / Campaign), each a MenuScene, so keys, a pad
 * and touch all work and every row is read out. Classic: map set, world, level (or one of its
 * areas), then the START page. Campaign: the world map or a file on a scratch copy that never
 * saves, a story level (world, level, START), the village, the tutorial stage, the training rooms,
 * the mini and bonus games. The START page picks the hero (the select's slot heroes), its look,
 * power, Map difficulty, rules and kit. 0.4.72 (owner item 7): no Mode row; every dev start is
 * free play (99 lives, straight back after a death), with Map difficulty under Classic rules.
 * "Again" on the Dev menu replays the last start.
 * Dev mode only: every page is reached from the Dev menu, which needs dev mode on.
 */

/** A dev start, as the START page made it and the Dev menu's Again row replays it. */
export interface DevPick {
  branch: 'classic' | 'campaign';
  /** The area started in. */
  level: string;
  /** What the rows and the screen reader call it ("Lost Levels D-4"). */
  name: string;
  /** The slot hero, and the look played (a skin of it, or itself). */
  hero: string;
  look: string;
  power: string;
  kit: boolean;
  rules: Rules;
  /** Always false since 0.4.72 (no Mode row: free play); a kept true is read as false. */
  classicRun: boolean;
  difficulty: MapDifficulty;
  /** 0.4.72 (owner item 6): the Mount row's Yoshi (absent: None). */
  mount?: 'yoshi';
}

/** Where the last dev start is kept (this browser only; dev mode only reads it). */
export const DEV_LAST_KEY = 'smbc.devLast';

/** The last dev start, if one was kept and can start now (resolveDevPick). */
export function loadDevPick(game: Game): DevPick | null {
  const r = resolveDevPick(game, loadJson<Partial<DevPick>>(DEV_LAST_KEY));
  return typeof r === 'string' ? null : r;
}

/**
 * Kept pick `p` as it can start now, or why it cannot: it must name a level this build has and a
 * hero the START page offers (Game.devAllSlotsFor, v0.4.73 item 61: every hero, whatever Toggle
 * heroes says), with one of that hero's looks. A power the played def does not have
 * falls back to its first state.
 */
export function resolveDevPick(game: Game, p: Partial<DevPick> | null): DevPick | string {
  if (!p || typeof p !== 'object') return 'No start was kept';
  const { branch, level, name, hero, look, power, difficulty } = p;
  // Item 76: a start kept before the rename names Campaign rules by their old name (readRules).
  const rules = readRules(p.rules);
  if (branch !== 'classic' && branch !== 'campaign') return 'The kept start is unreadable';
  if (typeof level !== 'string' || typeof name !== 'string' || typeof power !== 'string')
    return 'The kept start is unreadable';
  if (!rules) return 'The kept start is unreadable';
  if (!MAP_DIFFICULTIES.includes(difficulty as MapDifficulty)) return 'The kept start is unreadable';
  if (level !== DEV_VILLAGE) {
    try {
      game.deps.getLevel(level);
    } catch {
      return `${name} is not in this build`;
    }
  }
  // v0.4.73 item 61: every hero, as the START page's Hero row offers them.
  const offered = branch === 'campaign' ? game.deps.characters : game.devAllSlotsFor(rules);
  const slot = offered.find((c) => c.id === hero);
  const named = [...game.deps.characters, ...CLASSIC_EXTRAS].find((c) => c.id === hero)?.name ?? String(hero);
  if (!slot) return `${named} is not in this build`;
  const def = devLooks(game, slot, rules).find((c) => c.id === look);
  if (!def || (branch === 'campaign' && def !== slot)) return `That look of ${slot.name} is not offered now`;
  const states = powerStatesOf(game, def, rules);
  return {
    branch,
    level,
    name,
    hero: slot.id,
    look: def.id,
    power: states.includes(power) ? power : (states[0] as string),
    kit: p.kit === true,
    rules,
    // 0.4.72: every dev start is free play (a start kept as a Classic run plays as free play).
    classicRun: false,
    difficulty: rules === 'classic' ? (difficulty as MapDifficulty) : 'normal',
    ...(p.mount === 'yoshi' && canMount(game, def, rules) ? { mount: 'yoshi' as const } : {}),
  };
}

const POWER_UP_STATES = ['small', 'big', 'fire'];
const HP_STATES = ['full', 'half', '1 hp'];

/**
 * The power states the START page offers for `look` played under `rules`: the design it plays
 * (BUG-10: Toggle heroes' Plays as, playedHero).
 */
export function powerStatesOf(game: Game, look: CharacterDef, rules: Rules): string[] {
  return playedHero(game.ctx, look, rules).damage.kind === 'powerup' ? POWER_UP_STATES : HP_STATES;
}

/**
 * 0.4.72 (owner item 6): `look` can start riding Yoshi under `rules`: the Classic Yoshi mount's
 * own test (yoshi-mount.ts mayRide: a Classic def that does not opt out with `rides: false`), on
 * the def played (Toggle heroes' Plays as).
 */
export function canMount(game: Game, look: CharacterDef, rules: Rules): boolean {
  if (rules !== 'classic') return false;
  const d = playedHero(game.ctx, look, rules);
  return d.rides !== false && d.rules === 'classic';
}

/** Slot hero `hero`'s looks on the roster under `rules` (its own first). */
function devLooks(game: Game, hero: CharacterDef, rules: Rules): readonly CharacterDef[] {
  const roster = game.devRosterFor(rules);
  const list = skinsOf(hero).filter((d) => d === hero || roster.includes(d));
  return list.length ? list : [hero];
}

/** Starts `pick` (and keeps it for Again); false, starting nothing, when its look is not on the roster. */
export function playDevPick(game: Game, pick: DevPick): boolean {
  const def = game.devRosterFor(pick.rules).find((c) => c.id === pick.look);
  if (!def) return false;
  saveJson(DEV_LAST_KEY, pick);
  game.devStart(pick.level, def, pick.power, pick.kit, undefined, {
    rules: pick.rules,
    classic: pick.classicRun,
    difficulty: pick.difficulty,
    ...(pick.branch === 'classic' ? { mount: pick.mount ?? 'none' } : {}),
  });
  // v0.4.73 items 63 / 64: a clear, Quit and the last credits come back to Dev > Level select.
  game.keepDevReturn(pick.branch, pick.level);
  return true;
}

/** The Again row's short value and its spoken line. */
export function devPickSummary(game: Game, p: DevPick): { value: string; said: string } {
  const look = game.devRosterFor(p.rules).find((c) => c.id === p.look);
  const who = look?.name ?? p.look;
  const parts = [p.name, who, p.power];
  if (p.branch === 'classic') {
    parts.push(RULES_LABELS[p.rules]);
    if (p.rules === 'classic') parts.push(DIFFICULTY_NAMES[p.difficulty]);
    if (p.mount === 'yoshi') parts.push('riding Yoshi');
  }
  return { value: p.name, said: parts.join(', ') };
}

/** The Dev menu's Again row, or none when no start was kept. */
export function devAgainItem(game: Game): MenuItem | null {
  const p = loadDevPick(game);
  if (!p) return null;
  const s = devPickSummary(game, p);
  return {
    label: 'Again',
    value: () => s.value,
    // Resolved again on the press: Dev mode, Toggle heroes may have changed who is offered since.
    select: () => {
      const now = resolveDevPick(game, p);
      if (typeof now !== 'string' && playDevPick(game, now)) return;
      const why = typeof now === 'string' ? now : `${s.value} cannot start now`;
      game.ctx.audio.sfx('bump');
      game.deps.announcer?.say(`Again cannot start. ${why}.`);
    },
    hint: `Starts the last pick again: ${s.said}`,
  };
}

/** The START page's Rules row values and hint (dev Classic starts, TG rules model). */
// Owner decision: the 'campaign' rules are shown and said as "Campaign" (item 76: the value too).
export const RULES_LABELS: Record<Rules, string> = { campaign: 'Campaign', classic: 'Classic SMBC' };
export const RULES_HINT = 'Classic SMBC: heroes play as in SMBC 3.1.21';

/** The short map set names. */
const SET_NAMES: Record<string, string> = { smb: 'SMB', special: 'Special', lost: 'Lost Levels' };

/** A dev page: a MenuScene that says its title as it opens, then its row. */
class DevPage extends MenuScene {
  /** The title as it is said ("Lost Levels D"); the drawn title is upper case. */
  private readonly spoken: string;

  constructor(game: Game, title: string, items: MenuItem[], translucent: boolean) {
    super(game, title.toUpperCase(), items, () => backToMenu(game), translucent);
    this.spoken = title;
  }

  override enter(): void {
    const it = this.items[this.index];
    const v = it?.value ? `: ${it.value()}` : '';
    const page = this.spoken;
    const line = `${it?.label ?? ''}${v}`;
    this.game.deps.announcer?.say(`${page}. ${it?.hint ? `${line.replace(/\.$/, '')}. ${it.hint}` : line}`);
  }
}

/** Opens a page over the one on top, seen through as it is. */
function push(game: Game, page: MenuScene, translucent: boolean): void {
  page.translucent = translucent;
  game.scenes.push(page);
}

const back = (game: Game): MenuItem => ({ label: 'Back', select: () => backToMenu(game) });

/**
 * Area `id` as its row shows and says it: its set's prefix off, the world as the menus name it
 * (A-D), the rest as words ("ll-10-2-intro" is "A-2 intro", "2-top-secret" "2 top secret").
 */
export function areaName(id: string, prefix: string): string {
  const parts = (id.startsWith(prefix) ? id.slice(prefix.length) : id).split('-');
  const w = Number(parts[0]);
  const world = Number.isInteger(w) && w > 0 ? worldName(w) : (parts[0] ?? '');
  const level = parts[1] !== undefined && /^\d+$/.test(parts[1]) ? `${world}-${parts[1]}` : null;
  const rest = parts.slice(level ? 2 : 1);
  return [level ?? world, ...rest].join(' ');
}

/** Every listed area of level `id` (itself first, then its rooms: `1-2-intro`, `1-2-bonus`). */
export function areasOf(game: Game, id: string): string[] {
  const all = game.deps.listLevels?.() ?? [];
  return all.filter((a) => a === id || a.startsWith(`${id}-`));
}

/**
 * BUG-09: Dev > Level select, the one level select of the Dev menu: Classic (the O-05 map set
 * pages), Campaign, Mini games and Bonus games. It replaces the old one-page list
 * (dev-level-select.ts, deprecated); every id that list offered is reached from these pages.
 */
export class DevLevelPagesScene extends DevPage {
  constructor(game: Game, translucent = false) {
    super(
      game,
      'Level select',
      [
        {
          label: 'Classic',
          select: () => push(game, new DevClassicScene(game, translucent), translucent),
          hint: 'Map set, world, level, then the start page',
        },
        {
          label: 'Campaign',
          select: () => push(game, new DevCampaignScene(game, translucent), translucent),
          hint: 'World map, story levels, village, training, games; nothing is saved',
        },
        {
          label: 'Mini games',
          select: () => push(game, new DevMiniGamesScene(game, translucent), translucent),
          hint: "Play any hero's freeing mini game; nothing is saved",
        },
        {
          label: 'Bonus games',
          select: () => push(game, new DevBonusGamesScene(game, translucent), translucent),
          hint: 'Toad House, N-spade and the spade game; nothing is saved',
        },
        back(game),
      ],
      translucent,
    );
  }
}

/** Dev > Classic: the map sets. */
export class DevClassicScene extends DevPage {
  constructor(game: Game, translucent = false) {
    super(
      game,
      'Classic',
      [
        ...MAP_SETS.map((set) => ({
          label: set.label,
          select: () => push(game, new DevWorldScene(game, 'classic', set, translucent), translucent),
          hint: 'Choose a world',
        })),
        back(game),
      ],
      translucent,
    );
  }
}

/** A map set's worlds (1-8; The Lost Levels' 9 and A-D too). */
export class DevWorldScene extends DevPage {
  constructor(game: Game, branch: 'classic' | 'campaign', set: MapSet, translucent: boolean) {
    const lost = branch === 'campaign' && set.id === 'lost';
    const items: MenuItem[] = [];
    for (let w = 1; w <= set.lastWorld; w++)
      items.push({
        label: `${lost ? 'Lost world' : 'World'} ${worldName(w)}`,
        select: () => push(game, new DevLevelPage(game, branch, set, w, translucent), translucent),
      });
    items.push(back(game));
    const story = `Story: ${set.id === 'lost' ? 'Lost Levels' : 'SMB'} worlds`;
    super(game, branch === 'classic' ? (SET_NAMES[set.id] ?? 'World') : story, items, translucent);
  }
}

/** A world's four levels, then Areas for each level's rooms. */
export class DevLevelPage extends DevPage {
  constructor(game: Game, branch: 'classic' | 'campaign', set: MapSet, world: number, translucent: boolean) {
    const prefix = set.start.replace(/\d+-\d+$/, '');
    const setName = branch === 'campaign' ? (set.id === 'lost' ? 'Lost' : 'World') : SET_NAMES[set.id];
    const items: MenuItem[] = [];
    for (let l = 1; l <= 4; l++) {
      const name = `${setName} ${worldName(world)}-${l}`;
      items.push({
        label: `${worldName(world)}-${l}`,
        select: () => {
          const level = levelSelectTarget(game, set, world, l);
          push(game, new DevStartScene(game, { branch, level, name }), translucent);
        },
        hint: 'Start page: hero, power and more',
      });
    }
    // Each level's rooms, then the world's other areas (8-5, 2-top-secret, 1-0-pipe): every listed
    // area of the world is reached from here.
    const rooms = (label: string, title: string, areas: string[], hint: string): MenuItem => ({
      label,
      select: () =>
        push(
          game,
          new DevPage(
            game,
            title,
            [
              ...areas.map((a) => ({
                label: areaName(a, prefix),
                select: () =>
                  push(
                    game,
                    new DevStartScene(game, { branch, level: a, name: areaName(a, prefix) }),
                    translucent,
                  ),
              })),
              back(game),
            ],
            translucent,
          ),
          translucent,
        ),
      hint,
    });
    const covered = new Set<string>();
    for (let l = 1; l <= 4; l++) {
      const id = `${prefix}${world}-${l}`;
      const areas = areasOf(game, id);
      for (const a of areas) covered.add(a);
      if (areas.length < 2) continue;
      const level = `${worldName(world)}-${l}`;
      items.push(
        rooms(
          `${level} areas`,
          `${setName ?? 'World'} ${level} areas`,
          areas,
          "Start in one of this level's rooms",
        ),
      );
    }
    const others = (game.deps.listLevels?.() ?? []).filter(
      (a) => a.startsWith(`${prefix}${world}-`) && !covered.has(a),
    );
    if (others.length)
      items.push(
        rooms(
          'Other rooms',
          `${setName ?? 'World'} ${worldName(world)} other rooms`,
          others,
          'Areas of this world outside its four levels',
        ),
      );
    items.push(back(game));
    super(game, `${setName ?? 'World'} ${worldName(world)}`, items, translucent);
  }
}

/**
 * Custom level `id`'s name as the editor saved it (its library key, as Options > Custom levels
 * shows it), else the id without its prefix.
 */
function customName(id: string): string {
  const name = Object.keys(loadLibrary().levels).find((n) => customLevelId(n) === id);
  return name ?? id.slice(CUSTOM_PREFIX.length);
}

/** Dev > Campaign: its places and games, none of which writes a save file. */
export class DevCampaignScene extends DevPage {
  constructor(game: Game, translucent = false) {
    const start = (level: string, name: string) => () =>
      push(game, new DevStartScene(game, { branch: 'campaign', level, name }), translucent);
    const smb = MAP_SETS[0] as MapSet;
    const lost = MAP_SETS[2] as MapSet;
    const custom = (game.deps.listLevels?.() ?? []).filter((id) => id.startsWith(CUSTOM_PREFIX));
    super(
      game,
      'Campaign',
      [
        {
          label: 'World map',
          select: () => game.openScratchFile(),
          hint: 'A new file with every world open; nothing is saved',
        },
        {
          label: 'Open a file',
          select: () => push(game, new DevFilesScene(game, translucent), translucent),
          hint: 'A copy of a save file; nothing is saved',
        },
        {
          label: 'Story level',
          select: () => push(game, new DevWorldScene(game, 'campaign', smb, translucent), translucent),
          hint: 'Worlds 1 to 8',
        },
        {
          label: 'Lost story level',
          select: () => push(game, new DevWorldScene(game, 'campaign', lost, translucent), translucent),
          hint: 'The Lost Kingdom, worlds 1 to D',
        },
        { label: 'Village', select: start(DEV_VILLAGE, 'Village'), hint: 'Kakariko Village, every hero' },
        { label: 'Tutorial 1-0', select: start('1-0', 'Tutorial 1-0'), hint: "Mario's tutorial stage" },
        // BUG-09: the editor's levels, which only the old one-page Level select listed.
        ...(custom.length
          ? [
              {
                label: 'Custom levels',
                select: () =>
                  push(
                    game,
                    new DevPage(
                      game,
                      'Custom levels',
                      [
                        ...custom.map((id) => {
                          const name = customName(id);
                          return { label: name, select: start(id, `Custom ${name}`) };
                        }),
                        back(game),
                      ],
                      translucent,
                    ),
                    translucent,
                  ),
                hint: 'The levels made in the editor',
              },
            ]
          : []),
        {
          label: 'Training rooms',
          select: () => push(game, new DevTrainingScene(game, translucent), translucent),
          hint: "Each hero's training stage",
        },
        {
          label: 'Mini games',
          select: () => push(game, new DevMiniGamesScene(game, translucent), translucent),
          hint: "Play any hero's freeing mini game; nothing is saved",
        },
        {
          label: 'Bonus games',
          select: () => push(game, new DevBonusGamesScene(game, translucent), translucent),
          hint: 'Toad House, N-spade and the spade game; nothing is saved',
        },
        back(game),
      ],
      translucent,
    );
  }
}

/** Dev > Campaign > Open a file: each save slot that holds a file, opened as a scratch copy. */
export class DevFilesScene extends DevPage {
  constructor(game: Game, translucent: boolean) {
    const items: MenuItem[] = [];
    for (const slot of SAVE_SLOTS) {
      const save = loadSave(slot);
      items.push(
        save
          ? {
              label: `File ${slot}`,
              value: () => `${save.cleared.length} cleared`,
              select: () => game.openScratchFile(save),
              hint: 'Opens a copy; nothing is saved',
            }
          : { label: `File ${slot}`, value: () => 'Empty', hint: 'No file here' },
      );
    }
    items.push(back(game));
    super(game, 'Open a file', items, translucent);
  }
}

/** Dev > Campaign > Training rooms: each hero's training stage, back here after. */
export class DevTrainingScene extends DevPage {
  constructor(game: Game, translucent: boolean) {
    const heroes = game.deps.characters.filter((c) => hasTraining(c.id));
    super(
      game,
      'Training rooms',
      [
        ...heroes.map((c) => ({
          label: c.name,
          select: () => runTraining(game, c, 0, () => undefined, true),
          hint: `${c.name}'s training stage`,
        })),
        back(game),
      ],
      translucent,
    );
  }
}

/**
 * The START page: Start, Hero (the select's slot heroes), Look (that hero's skins), Power, then
 * for a Classic start Mount (None / Yoshi, 0.4.72), Map difficulty and Rules, and Kit. Every
 * start plays as free play (99 lives, straight back after a death; 0.4.72 owner item 7: the Mode
 * row is gone); a campaign start plays Campaign rules.
 */
export class DevStartScene extends DevPage {
  private heroIndex = 0;
  private lookIndex = 0;
  private powerIndex = 0;
  private fullKit = false;
  /** 0.4.72 (owner item 6): the Mount row (None / Yoshi). */
  private yoshi = false;
  private rules: Rules;
  private difficulty: MapDifficulty = 'normal';

  constructor(
    game: Game,
    readonly target: { branch: 'classic' | 'campaign'; level: string; name: string },
  ) {
    super(game, 'Start', [], false);
    const classic = target.branch === 'classic';
    this.rules = classic ? 'classic' : 'campaign';
    // The Mount row starts as the Dev menu's Yoshi mount: Ride gives Yoshi (0.4.72 review).
    const t = game.classicToggles;
    this.yoshi = t.yoshiMount && t.yoshiRide === true;
    const cycle = (i: number, d: number, n: number) => (n ? (i + d + n) % n : 0);
    const items: MenuItem[] = [
      {
        label: 'Start',
        value: () => target.name,
        select: () => playDevPick(game, this.pick),
        hint: 'Starts the level',
      },
      {
        label: 'Hero',
        value: () => this.hero.name,
        adjust: (d) => {
          this.heroIndex = cycle(this.heroIndex, d, this.heroes.length);
          this.lookIndex = 0;
          this.powerIndex = 0;
        },
      },
    ];
    if (classic)
      items.push({
        label: 'Look',
        value: () => this.look.name,
        adjust: (d) => {
          this.lookIndex = cycle(this.lookIndex, d, this.looks.length);
          this.powerIndex = 0;
        },
        hint: "This hero's looks",
      });
    items.push({
      label: 'Power',
      value: () => this.power,
      adjust: (d) => (this.powerIndex = cycle(this.powerIndex, d, this.powerStates.length)),
    });
    if (classic) {
      const can = () => this.canMount;
      items.push({
        label: 'Mount',
        value: () => (this.canMount ? (this.yoshi ? 'Yoshi' : 'None') : '-'),
        adjust: () => {
          if (this.canMount) this.yoshi = !this.yoshi;
        },
        get hint() {
          return can()
            ? 'None or Yoshi: Yoshi starts the level riding him'
            : 'Only with Classic SMBC rules, for a hero who rides';
        },
      });
    }
    if (classic) {
      const live = () => this.difficultyLive;
      const heroName = () => this.hero.name;
      items.push(
        {
          label: 'Map difficulty',
          value: () => DIFFICULTY_NAMES[this.difficultyNow],
          adjust: (d) => {
            if (!this.difficultyLive) return;
            const all = MAP_DIFFICULTIES;
            this.difficulty = all[cycle(all.indexOf(this.difficulty), d, all.length)] as MapDifficulty;
          },
          get hint() {
            return live()
              ? 'Easy, Normal or Hard: each plays the original version of every level'
              : 'Only with Classic SMBC rules: else Normal';
          },
        },
        {
          label: 'Rules',
          value: () => RULES_LABELS[this.rules],
          adjust: () => {
            const hero = this.hero.id;
            const look = this.look.id;
            this.rules = this.rules === 'classic' ? 'campaign' : 'classic';
            // The slots and the power list can differ under the other rules: the same hero (and
            // look) when the new rules offer it, else the first hero.
            this.heroIndex = Math.max(
              0,
              this.heroes.findIndex((c) => c.id === hero),
            );
            this.lookIndex = Math.max(
              0,
              this.looks.findIndex((c) => c.id === look),
            );
            this.powerIndex = 0;
          },
          get hint() {
            return `${RULES_HINT}. Hero: ${heroName()}`;
          },
        },
      );
    }
    items.push(
      {
        label: 'Kit',
        value: () => (this.played.devKit ? (this.fullKit ? 'full' : 'basic') : '-'),
        adjust: () => (this.fullKit = !this.fullKit),
        hint: 'Full: all tools, ammo and magic',
      },
      back(game),
    );
    this.setItems(items);
  }

  /**
   * The heroes this start offers (v0.4.73 item 61, Game.devAllSlotsFor: every hero, released or
   * not, whatever Toggle heroes says; the campaign's roster).
   */
  get heroes(): CharacterDef[] {
    if (this.target.branch === 'campaign') return this.game.deps.characters;
    return this.game.devAllSlotsFor(this.rules);
  }

  get hero(): CharacterDef {
    return this.heroes[this.heroIndex] ?? (this.heroes[0] as CharacterDef);
  }

  /** The hero's looks on this start's roster (its own first). */
  get looks(): readonly CharacterDef[] {
    return devLooks(this.game, this.hero, this.rules);
  }

  get look(): CharacterDef {
    if (this.target.branch === 'campaign') return this.hero;
    return this.looks[this.lookIndex] ?? this.hero;
  }

  /** The def played under the chosen rules (and Toggle heroes' Plays as): its power list and kit. */
  private get played(): CharacterDef {
    return playedHero(this.game.ctx, this.look, this.rules);
  }

  private get powerStates(): string[] {
    return powerStatesOf(this.game, this.look, this.rules);
  }

  private get power(): string {
    return this.powerStates[this.powerIndex] ?? (this.powerStates[0] as string);
  }

  /** The Mount row can start riding Yoshi now (canMount). */
  get canMount(): boolean {
    return this.target.branch === 'classic' && canMount(this.game, this.look, this.rules);
  }

  /**
   * Map difficulty plays under Classic rules (GameContext.mapDifficulty; 0.4.72: in a dev free
   * play start too).
   */
  get difficultyLive(): boolean {
    return this.rules === 'classic';
  }

  private get difficultyNow(): MapDifficulty {
    return this.difficultyLive ? this.difficulty : 'normal';
  }

  /** The start these rows make. */
  get pick(): DevPick {
    return {
      branch: this.target.branch,
      level: this.target.level,
      name: this.target.name,
      hero: this.hero.id,
      look: this.look.id,
      power: this.power,
      kit: this.fullKit,
      rules: this.rules,
      classicRun: false,
      difficulty: this.difficultyNow,
      ...(this.yoshi && this.canMount ? { mount: 'yoshi' as const } : {}),
    };
  }
}
