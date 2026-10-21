import { MAP_DIFFICULTIES, type MapDifficulty } from '@engine/save/settings';
import { loadJson, saveJson } from '@engine/save/storage';
import { MenuScene, type MenuItem } from './menu';
import type { Game } from './game';
import type { CharacterDef } from '../characters/character';
import type { Rules } from '../context';
import { heroFor, skinsOf } from '../characters/registry';
import { DEV_VILLAGE } from '../town/secret-house';
import { MAP_SETS, DIFFICULTY_NAMES, type MapSet } from './original-game';
import { levelSelectTarget, worldName } from './level-select-cheat';
import { RULES_HINT, RULES_LABELS } from './dev-level-select';
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
 * power, Map difficulty, rules, mode and kit. "Again" on the Dev menu replays the last start.
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
  classicRun: boolean;
  difficulty: MapDifficulty;
}

/** Where the last dev start is kept (this browser only; dev mode only reads it). */
export const DEV_LAST_KEY = 'smbc.devLast';

/** The last dev start, if one was kept and still names a level and a hero this build has. */
export function loadDevPick(game: Game): DevPick | null {
  const p = loadJson<Partial<DevPick>>(DEV_LAST_KEY);
  if (!p || typeof p !== 'object') return null;
  const { branch, level, name, hero, look, power, rules, difficulty } = p;
  if (branch !== 'classic' && branch !== 'campaign') return null;
  if (typeof level !== 'string' || typeof name !== 'string' || typeof power !== 'string') return null;
  if (rules !== 'classic' && rules !== 'current') return null;
  if (!MAP_DIFFICULTIES.includes(difficulty as MapDifficulty)) return null;
  if (level !== DEV_VILLAGE) {
    try {
      game.deps.getLevel(level);
    } catch {
      return null;
    }
  }
  const roster = game.rosterFor(rules);
  if (!roster.some((c) => c.id === hero) || !roster.some((c) => c.id === look)) return null;
  return {
    branch,
    level,
    name,
    hero: hero as string,
    look: look as string,
    power,
    kit: p.kit === true,
    rules,
    classicRun: p.classicRun === true,
    difficulty: difficulty as MapDifficulty,
  };
}

/** Starts `pick` (and keeps it for Again). */
export function playDevPick(game: Game, pick: DevPick): void {
  const def = game.rosterFor(pick.rules).find((c) => c.id === pick.look);
  if (!def) return;
  saveJson(DEV_LAST_KEY, pick);
  game.devStart(pick.level, def, pick.power, pick.kit, undefined, {
    rules: pick.rules,
    classic: pick.classicRun,
    difficulty: pick.difficulty,
  });
}

/** The Again row's short value and its spoken line. */
export function devPickSummary(game: Game, p: DevPick): { value: string; said: string } {
  const look = game.rosterFor(p.rules).find((c) => c.id === p.look);
  const who = look?.name ?? p.look;
  const parts = [p.name, who, p.power];
  if (p.branch === 'classic') {
    parts.push(p.classicRun ? 'Classic run' : 'Free play', RULES_LABELS[p.rules]);
    if (p.classicRun && p.rules === 'classic') parts.push(DIFFICULTY_NAMES[p.difficulty]);
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
    select: () => playDevPick(game, p),
    hint: `Starts the last pick again: ${s.said}`,
  };
}

/** The short map set names (the cheat's Level select has the same). */
const SET_NAMES: Record<string, string> = { smb: 'SMB', special: 'Special', lost: 'Lost Levels' };

/** A dev page: a MenuScene that says its title as it opens, then its row. */
class DevPage extends MenuScene {
  constructor(game: Game, title: string, items: MenuItem[], translucent: boolean) {
    super(game, title, items, () => game.scenes.pop(), translucent);
  }

  override enter(): void {
    const it = this.items[this.index];
    const v = it?.value ? `: ${it.value()}` : '';
    const page = this.title.charAt(0) + this.title.slice(1).toLowerCase();
    const line = `${it?.label ?? ''}${v}`;
    this.game.deps.announcer?.say(`${page}. ${it?.hint ? `${line.replace(/\.$/, '')}. ${it.hint}` : line}`);
  }
}

/** Opens a page over the one on top, seen through as it is. */
function push(game: Game, page: MenuScene, translucent: boolean): void {
  page.translucent = translucent;
  game.scenes.push(page);
}

const back = (game: Game): MenuItem => ({ label: 'Back', select: () => game.scenes.pop() });

/** Every listed area of level `id` (itself first, then its rooms: `1-2-intro`, `1-2-bonus`). */
export function areasOf(game: Game, id: string): string[] {
  const all = game.deps.listLevels?.() ?? [];
  return all.filter((a) => a === id || a.startsWith(`${id}-`));
}

/** Dev > Classic: the map sets. */
export class DevClassicScene extends DevPage {
  constructor(game: Game, translucent = false) {
    super(
      game,
      'CLASSIC',
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
    super(
      game,
      branch === 'classic' ? (SET_NAMES[set.id]?.toUpperCase() ?? 'WORLD') : 'STORY LEVEL',
      items,
      translucent,
    );
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
    for (let l = 1; l <= 4; l++) {
      const id = `${prefix}${world}-${l}`;
      const areas = areasOf(game, id);
      if (areas.length < 2) continue;
      items.push({
        label: `${worldName(world)}-${l} areas`,
        select: () =>
          push(
            game,
            new DevPage(
              game,
              'AREAS',
              [
                ...areas.map((a) => ({
                  label: a,
                  select: () =>
                    push(game, new DevStartScene(game, { branch, level: a, name: a }), translucent),
                })),
                back(game),
              ],
              translucent,
            ),
            translucent,
          ),
        hint: "Start in one of this level's rooms",
      });
    }
    items.push(back(game));
    super(game, `${(setName ?? 'WORLD').toUpperCase()} ${worldName(world)}`, items, translucent);
  }
}

/** Dev > Campaign: its places and games, none of which writes a save file. */
export class DevCampaignScene extends DevPage {
  constructor(game: Game, translucent = false) {
    const start = (level: string, name: string) => () =>
      push(game, new DevStartScene(game, { branch: 'campaign', level, name }), translucent);
    const smb = MAP_SETS[0] as MapSet;
    const lost = MAP_SETS[2] as MapSet;
    super(
      game,
      'CAMPAIGN',
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
    super(game, 'OPEN A FILE', items, translucent);
  }
}

/** Dev > Campaign > Training rooms: each hero's training stage, back here after. */
export class DevTrainingScene extends DevPage {
  constructor(game: Game, translucent: boolean) {
    const heroes = game.deps.characters.filter((c) => hasTraining(c.id));
    super(
      game,
      'TRAINING ROOMS',
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

const POWER_UP_STATES = ['small', 'big', 'fire'];
const HP_STATES = ['full', 'half', '1 hp'];

/**
 * The START page: Start, Hero (the select's slot heroes), Look (that hero's skins), Power, then
 * for a Classic start Map difficulty, Rules and Mode, and Kit. A campaign start plays Current
 * rules as free play (99 lives).
 */
export class DevStartScene extends DevPage {
  private heroIndex = 0;
  private lookIndex = 0;
  private powerIndex = 0;
  private fullKit = false;
  private rules: Rules;
  private classicRun: boolean;
  private difficulty: MapDifficulty = 'normal';

  constructor(
    game: Game,
    readonly target: { branch: 'classic' | 'campaign'; level: string; name: string },
  ) {
    super(game, 'START', [], false);
    const classic = target.branch === 'classic';
    this.rules = classic ? 'classic' : 'current';
    this.classicRun = classic;
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
      const live = () => this.difficultyLive;
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
              : 'Only a Classic run with Classic SMBC rules: else Normal';
          },
        },
        {
          label: 'Rules',
          value: () => RULES_LABELS[this.rules],
          adjust: () => {
            this.rules = this.rules === 'classic' ? 'current' : 'classic';
            // The slots and the power list can differ under the other rules.
            if (this.heroIndex >= this.heroes.length) this.heroIndex = 0;
            this.lookIndex = 0;
            this.powerIndex = 0;
          },
          hint: RULES_HINT,
        },
        {
          label: 'Mode',
          value: () => (this.classicRun ? 'Classic run' : 'Free play'),
          adjust: () => (this.classicRun = !this.classicRun),
          hint: 'Classic run: its lives, continues and select. Free play: 99 lives',
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

  /** The heroes the select would offer this start (Game.slotsFor; the campaign's roster). */
  get heroes(): CharacterDef[] {
    if (this.target.branch === 'campaign') return this.game.deps.characters;
    return this.game.slotsFor(this.rules);
  }

  get hero(): CharacterDef {
    return this.heroes[this.heroIndex] ?? (this.heroes[0] as CharacterDef);
  }

  /** The hero's looks on this start's roster (its own first). */
  get looks(): readonly CharacterDef[] {
    const roster = this.game.rosterFor(this.rules);
    const list = skinsOf(this.hero).filter((d) => d === this.hero || roster.includes(d));
    return list.length ? list : [this.hero];
  }

  get look(): CharacterDef {
    if (this.target.branch === 'campaign') return this.hero;
    return this.looks[this.lookIndex] ?? this.hero;
  }

  /** The def played under the chosen rules: its power list and kit. */
  private get played(): CharacterDef {
    return heroFor(this.look, this.rules);
  }

  private get powerStates(): string[] {
    return this.played.damage.kind === 'powerup' ? POWER_UP_STATES : HP_STATES;
  }

  private get power(): string {
    return this.powerStates[this.powerIndex] ?? (this.powerStates[0] as string);
  }

  /** Map difficulty plays only in a Classic run under Classic rules (GameContext.mapDifficulty). */
  get difficultyLive(): boolean {
    return this.classicRun && this.rules === 'classic';
  }

  private get difficultyNow(): MapDifficulty {
    return this.difficultyLive ? this.difficulty : 'normal';
  }

  /** The start these rows make. */
  get pick(): DevPick {
    const classic = this.target.branch === 'classic';
    return {
      branch: this.target.branch,
      level: this.target.level,
      name: this.target.name,
      hero: this.hero.id,
      look: this.look.id,
      power: this.power,
      kit: this.fullKit,
      rules: this.rules,
      classicRun: classic && this.classicRun,
      difficulty: this.difficultyNow,
    };
  }
}
