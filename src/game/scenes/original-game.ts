import {
  loadProgress,
  recordBeat,
  saveProgress,
  type BeatDifficulty,
  type BeatStatus,
  type MapSetId,
} from '@engine/save/progress';
import { MAP_DIFFICULTIES, type ClassicRules, type MapDifficulty } from '@engine/save/settings';
import { MenuScene, type MenuItem } from './menu';
import { OptionsScene } from './options';
import { CheatsScene } from './cheats-menu';
import { defaultClassicSettings, isOriginalClassic } from '@engine/save/original-options';
import {
  ClassicOptionRowsScene,
  EXPANSION_ROW,
  GAME_MODE_ROW,
  MORE_SETTINGS_ROWS,
  WEAPON_ROWS,
  optionItem,
  rowsOriginal,
} from './original-options';
import type { Game } from './game';
import type { Renderer } from '@engine/gfx/renderer';

/**
 * Classic mode (title > CLASSIC): the original game with none of the campaign's additions. This
 * file holds its menu, its options and what it keeps between runs (the global progress store,
 * never a campaign save file).
 */

/** A Classic mode map set (data/MapPack.as; NewGameOptionsMenu's Map Set row). */
export interface MapSet {
  id: MapSetId;
  /** The CLASSIC menu's line. */
  label: string;
  /** Its first level (a new game starts here). */
  start: string;
  /** Its last world: that world's castle ends the game (LevelData.worldCount). */
  lastWorld: number;
  /** What the menu's hint says about it. */
  about: string;
  /** Whether a level id (main or area) belongs to this set. */
  owns(levelId: string): boolean;
}

/**
 * Classic mode's map sets, in the original's order (MapPack: Smb, Special, LostLevels), every one
 * open from the start (G-003, owner decision D3). Each owns its id prefix: none for SMB1, `sp-`
 * for Super Mario Bros. Special (G-020), `ll-` for The Lost Levels.
 */
export const MAP_SETS: readonly MapSet[] = [
  {
    id: 'smb',
    label: 'Super Mario Bros.',
    start: '1-1',
    lastWorld: 8,
    about: 'The original game with every hero',
    owns: (id) => /^\d+-\d+/.test(id),
  },
  {
    id: 'special',
    // The original's menu name (MenuBoxItems.SMB_SPECIAL); a longer one would run into BEATEN.
    label: 'SMB Special',
    start: 'sp-1-1',
    // levelDataSpecial.xml: eight worlds, 8-4 ends the game as in SMB1 (LevelData.worldCount).
    lastWorld: 8,
    about: 'Super Mario Bros. Special: 32 new levels, with icicles, crabs, flies, barrels and fire',
    owns: (id) => id.startsWith('sp-'),
  },
  {
    id: 'lost',
    label: 'The Lost Levels',
    start: 'll-1-1',
    // Worlds 9 and A-D are 10 to 13 (levelDataLostLevels.xml; LevelData.worldCount).
    lastWorld: 13,
    about: 'The harder second quest, thirteen worlds long',
    owns: (id) => id.startsWith('ll-'),
  },
];

/** The map set a level belongs to (SMB for anything else, as custom levels end like SMB). */
export function mapSetOf(levelId: string): MapSet {
  return MAP_SETS.find((m) => m.id !== 'smb' && m.owns(levelId)) ?? (MAP_SETS[0] as MapSet);
}

/**
 * Where a Classic mode run goes from castle `levelId`'s `next=end` (G-001/G-002): every castle
 * but the set's last world's is an ordinary one, and play goes on to the next world's first level
 * (Level.as 3472-3486: X-4 goes to (X+1)-1, whatever warps were taken). Null at the set's last
 * castle (the end of the game) and for anything that is not a castle of a set's world.
 */
export function classicNextWorld(levelId: string): string | null {
  const set = mapSetOf(levelId);
  const m = /^(?:[a-z]+-)?(\d+)-4$/.exec(levelId);
  if (!m || !set.owns(levelId)) return null;
  const world = Number(m[1]);
  if (world >= set.lastWorld) return null;
  return `${set.start.replace(/\d+-\d+$/, '')}${world + 1}-1`;
}

/** The beat status a map set's menu hint ends with (G-005), or nothing while unbeaten. */
export function beatHint(status: BeatStatus): string {
  return status === 'none' ? '' : `. Beaten on ${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

/**
 * A Classic mode run beat map set `set` (StatManager.beatGameHandler: setBeatGameStatus):
 * kept in the global progress store, never a campaign save file, with the run's Map Difficulty
 * (G-006).
 */
export function recordClassicBeat(set: MapSetId, difficulty: BeatDifficulty = 'normal'): void {
  const p = loadProgress();
  const next = recordBeat(p, set, difficulty);
  if (next !== p) saveProgress(next);
}

/** Map set `set`'s beat status (G-005). */
export function classicBeatStatus(set: MapSetId): BeatStatus {
  return loadProgress().classicBeat?.[set] ?? 'none';
}

/** A menu line as MenuScene reads it (label, value and hint), without a doubled full stop. */
function spokenItem(it: MenuItem | undefined): string {
  if (!it) return '';
  const v = it.value ? `: ${it.value()}` : '';
  // A changed option's `*` mark is drawn, not read (its hint says it is changed).
  const line = `${it.label.replace(/\*$/, '')}${v}`;
  return it.hint ? `${line.replace(/\.$/, '')}. ${it.hint}` : line;
}

/** Map Difficulty names as menus show and read them (data/MapDifficulty.as). */
export const DIFFICULTY_NAMES: Record<MapDifficulty, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
};

/** The status line while Current rules leave every map on Normal (it fits the 28 columns). */
export const CURRENT_RULES_NORMAL = 'Current rules: always Normal';

/**
 * A Map difficulty row (G-006): its value, changed with left and right (and OK / CHANGE on a
 * phone), saved and read out. While `classic()` is false (Current rules) it shows Normal, says
 * why and does not change.
 */
export function mapDifficultyItem(
  game: Game,
  classic: () => boolean,
  store: { get(): MapDifficulty; set(d: MapDifficulty): void } = settingsDifficulty(game),
): MenuItem {
  const value = () => (classic() ? store.get() : 'normal');
  return {
    label: 'Map difficulty',
    value: () => DIFFICULTY_NAMES[value()],
    adjust: (d) => {
      if (!classic()) return;
      const all = MAP_DIFFICULTIES;
      store.set(all[(all.indexOf(value()) + d + all.length) % all.length] as MapDifficulty);
    },
    get hint() {
      return classic()
        ? 'Easy, Normal or Hard: each plays the original version of every level'
        : 'Classic rules only: with Current rules every level plays as Normal';
    },
  };
}

/** The CLASSIC menu's Map difficulty: settings.classicMapDifficulty, saved at once. */
function settingsDifficulty(game: Game): { get(): MapDifficulty; set(d: MapDifficulty): void } {
  return {
    get: () => game.deps.settings?.classicMapDifficulty ?? 'normal',
    set: (d) => {
      const s = game.deps.settings;
      if (!s) return;
      s.classicMapDifficulty = d;
      game.deps.applySettings?.();
    },
  };
}

/** Where the Classic rules value is drawn: right edge, and the first full-screen menu row's y. */
const CLASSIC_RULES_RIGHT = 248;
const CLASSIC_RULES_Y = 64;

const RULES_LABELS: Record<ClassicRules, string> = { classic: 'Classic SMBC', current: 'Current' };

/**
 * Whether a Classic mode run will play changed options: any row with Classic SMBC rules; with
 * Current rules only Game mode applies (More settings and Weapons are Classic rules only).
 */
export function classicOptionsOn(game: Game): boolean {
  const c = game.deps.settings?.classic ?? defaultClassicSettings();
  if ((game.deps.settings?.classicRules ?? 'classic') === 'classic') return !isOriginalClassic(c);
  return c.gameMode !== defaultClassicSettings().gameMode;
}

/** The CLASSIC menu: each map set (MAP_SETS), Options, Back. */
export class ClassicMenuScene extends MenuScene {
  constructor(game: Game) {
    super(game, 'CLASSIC', [], () => game.showTitle());
    this.build();
  }

  /** The entries (rebuilt on the way back from Options, so the hints follow the options). */
  private build(): void {
    const game = this.game;
    const back = () => game.showClassicMenu();
    // A run that will not play as the original says so (FU-7: never silently non-original).
    const own = classicOptionsOn(game) ? '. Your own Classic options are on' : '';
    // Every map set from the start (G-003, D3), each with its beat status (G-005): read out in
    // the hint, drawn as BEATEN at the row's end (render).
    this.beaten = MAP_SETS.map((set) => classicBeatStatus(set.id) !== 'none');
    const items: MenuItem[] = MAP_SETS.map((set) => ({
      label: set.label,
      select: () => game.classicSelect(set.start, back),
      hint: `${set.about}${beatHint(classicBeatStatus(set.id))}${own}`,
    }));
    // Map Difficulty (G-006): its own row after the map sets, as the original's New Game options
    // have it (NewGameOptionsMenu.as:43). Classic rules only: with Current rules every map plays
    // as Normal, which the row shows and says (and it does not change).
    items.push(mapDifficultyItem(game, () => game.deps.settings?.classicRules !== 'current'));
    this.status = game.deps.settings?.classicRules === 'current' ? CURRENT_RULES_NORMAL : '';
    items.push(
      {
        label: 'Options',
        select: () =>
          game.scenes.push(
            new ClassicOptionsScene(game, () => {
              game.scenes.pop();
              this.build();
              this.announce();
            }),
          ),
        hint: 'Classic rules, game mode, more settings, weapons and all settings',
      },
      { label: 'Back', select: () => game.showTitle() },
    );
    this.setItems(items);
  }

  override enter(): void {
    this.game.deps.announcer?.say(`Classic. The original game. ${spokenItem(this.items[this.index])}`);
  }

  protected override announce(): void {
    this.game.deps.announcer?.say(spokenItem(this.items[this.index]));
  }

  /** Per map set row (MAP_SETS order): beaten at least once (G-005). */
  private beaten: boolean[] = [];

  /**
   * A beaten set's row ends in BEATEN, right-aligned where a menu value goes (the menu is full
   * screen and short, so its rows never scroll); the spoken hint carries the difficulty.
   */
  override render(r: Renderer): void {
    super.render(r);
    const font = this.game.ctx.assets.sheet('font');
    this.beaten.forEach((b, i) => {
      if (b)
        r.text(
          font,
          BEATEN_MARK,
          MENU_VALUE_RIGHT - BEATEN_MARK.length * 8,
          CLASSIC_RULES_Y + i * MENU_ROW_H,
        );
    });
  }
}

/** The CLASSIC menu's mark on a beaten map set's row, and where menu rows and values go (menu.ts). */
const BEATEN_MARK = 'BEATEN';
const MENU_VALUE_RIGHT = 232;
const MENU_ROW_H = 14;

/** Classic mode's options: its rules, then every other setting (the usual Options). */
export class ClassicOptionsScene extends MenuScene {
  /** While drawing: the Classic rules row draws its own value (it needs the full row). */
  private drawing = false;

  constructor(game: Game, onBack: () => void) {
    super(game, 'CLASSIC OPTIONS', [], onBack);
    this.build();
  }

  /** The rows (rebuilt after a change, so the Game mode row's `*` mark follows). */
  private build(): void {
    const game = this.game;
    const step = () => {
      const s = game.deps.settings;
      if (!s) return;
      s.classicRules = s.classicRules === 'classic' ? 'current' : 'classic';
      game.deps.applySettings?.();
    };
    const menu = (title: string, spoken: string, rows: Parameters<typeof rowsOriginal>[0]) => () =>
      game.scenes.push(
        new ClassicOptionRowsScene(game, title, rows, spoken, () => {
          game.scenes.pop();
          this.build();
          this.announce();
        }),
      );
    const state = (rows: Parameters<typeof rowsOriginal>[0]) => () =>
      rowsOriginal(rows, game.deps.settings?.classic ?? defaultClassicSettings()) ? 'Original' : 'Changed';
    const onBack = this.onBack ?? (() => {});
    this.setItems([
      {
        label: 'Classic rules',
        value: () => (this.drawing ? '' : this.rulesLabel),
        adjust: step,
        hint: 'Classic SMBC plays the heroes as the original did; Current as the campaign does',
      },
      optionItem(game, GAME_MODE_ROW, () => this.build()),
      optionItem(game, EXPANSION_ROW, () => this.build()),
      {
        label: 'More settings',
        value: state(MORE_SETTINGS_ROWS),
        select: menu('MORE SETTINGS', 'More settings', MORE_SETTINGS_ROWS),
        hint: 'Lives, attack, when hit, item drops, piranhas, goombas and enemy speed, with Classic SMBC rules',
      },
      {
        label: 'Weapons',
        value: state(WEAPON_ROWS),
        select: menu('CUSTOMIZE WEAPONS', 'Customize weapons', WEAPON_ROWS),
        hint: "Each hero's weapons, with Classic SMBC rules",
      },
      {
        label: 'Cheats',
        select: () => game.scenes.push(new CheatsScene(game, () => this.back(), { all: game.devMode })),
        hint: game.devMode
          ? 'The original cheats; developer mode opens them all'
          : 'The original cheats; play to unlock them',
      },
      {
        label: 'All options',
        select: () => game.scenes.push(new OptionsScene(game, () => this.back())),
        hint: 'Video, audio, controls and more',
      },
      { label: 'Back', select: onBack },
    ]);
  }

  private get rulesLabel(): string {
    return RULES_LABELS[this.game.deps.settings?.classicRules ?? 'classic'];
  }

  private back(): void {
    this.game.scenes.pop();
    this.announce();
  }

  override enter(): void {
    this.game.deps.announcer?.say(`Classic options. ${spokenItem(this.items[this.index])}`);
  }

  protected override announce(): void {
    this.game.deps.announcer?.say(spokenItem(this.items[this.index]));
  }

  /**
   * "CLASSIC RULES" and "CLASSIC SMBC" are too long for a menu row's value column: the value is
   * drawn right-aligned to the screen's edge (the menu is full screen, its first row unscrolled).
   */
  override render(r: Renderer): void {
    this.drawing = true;
    try {
      super.render(r);
    } finally {
      this.drawing = false;
    }
    const v = this.rulesLabel.toUpperCase();
    r.text(this.game.ctx.assets.sheet('font'), v, CLASSIC_RULES_RIGHT - v.length * 8, CLASSIC_RULES_Y);
  }
}
