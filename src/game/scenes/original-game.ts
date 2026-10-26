import {
  loadProgress,
  recordBeat,
  saveProgress,
  type BeatDifficulty,
  type BeatStatus,
  type MapSetId,
} from '@engine/save/progress';
import type { MapDifficulty } from '@engine/save/settings';
import { MenuScene, type MenuItem } from './menu';
import { OptionsScene } from './options';
import { CheatsScene } from './cheats-menu';
import { MUSIC_SET_ROW, optionItem } from './original-options';
import type { Game } from './game';
import { STORAGE_UNREADABLE, filesBoxFor } from './original-files-menu';
import { storageReadable } from '@engine/save/storage';
import { CLASSIC_FILE_SLOTS } from '../original-files';
import { demoUnder, renderBoxedMenu } from './original-box-menu';
import type { Renderer } from '@engine/gfx/renderer';
import type { InputFrame } from '@engine/input/input-manager';
import type { ClassicTitleScene } from './original-title';
import { boxCentreUnderLogo, boxGrowth, boxLayout, drawMenuBox, type BoxRow } from './menu-box';
import { abilityHint } from './hints';
import { FONT_COLOURS } from '@content/sprites/font';

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

/** The Tutorials row's spoken help (O-15 / G-042). */
export const TUTORIALS_HINT =
  'On: boxes explain the select, the controls, each hero and each upgrade, once per game';

/**
 * The Tutorials row (O-15 / G-042; the original's General > Tutorials, GeneralOptions.as 25): Off
 * (the original's default, GameSettings.as 89) or On. Left / Right or OK switch it.
 */
export function tutorialsItem(game: Game): MenuItem {
  const flip = () => {
    const s = game.deps.settings;
    if (!s) return;
    if (s.classicTutorials) delete s.classicTutorials;
    else s.classicTutorials = true;
    game.deps.applySettings?.();
  };
  return {
    label: 'Tutorials',
    value: () => (game.deps.settings?.classicTutorials ? 'On' : 'Off'),
    adjust: flip,
    hint: TUTORIALS_HINT,
  };
}

/**
 * The CLASSIC menu: each map set (MAP_SETS), Options, Back. Opened from the CLASSIC title's Start
 * box (`over`, O-04), it is a box over the title's live demo, and BACK returns to that box; on its
 * own (no `over`) it is a full-screen menu whose BACK goes to the CLASSIC title.
 */
export class ClassicMenuScene extends MenuScene {
  /** Frame the box opened (its grow); null: open at once (coming back from a run). */
  private boxAt: number | null;

  constructor(
    game: Game,
    readonly over: ClassicTitleScene | null = null,
    grow = over !== null,
    focus?: MapSetId,
  ) {
    super(game, 'CLASSIC', [], () => this.leave(), over !== null);
    this.boxAt = grow ? 0 : null;
    // RC-040: the box's moves and BACK sound as the Start box's (MessageBoxSounds).
    if (over) {
      this.moveSfx = 'fireball';
      this.backSfx = 'bump';
      this.adjustSfx = 'coin';
      this.okAdjustSfx = 'coin';
    }
    this.build();
    // Back from a set's select: on that set's row again.
    if (focus)
      this.index = Math.max(
        0,
        MAP_SETS.findIndex((m) => m.id === focus),
      );
  }

  /** BACK: the Start box under it, or the CLASSIC title. */
  private leave(): void {
    if (this.over) this.over.backFromSets();
    else this.game.showClassicTitle('start');
  }

  /** The entries (rebuilt on the way back from a file box, so the hints follow the files). */
  private build(): void {
    const game = this.game;
    // Every map set from the start (G-003, D3), each with its beat status (G-005): read out in
    // the hint, drawn as BEATEN at the row's end (render).
    this.beaten = MAP_SETS.map((set) => classicBeatStatus(set.id) !== 'none');
    // B-L: each set has three save files; picking a set opens its file box (original-files-menu.ts).
    // Map difficulty and Options are no longer here: a file's rules are chosen when it starts,
    // and the shared options are in the Start box's OPTIONS.
    const readable = storageReadable();
    const items: MenuItem[] = MAP_SETS.map((set) => {
      // 38b: every file in use counts, an UNREADABLE, HERO OFF or CANNOT PLAY one too (a new
      // game never takes them), not only the ones that play now.
      const used = CLASSIC_FILE_SLOTS.filter(
        (slot) => game.classicFileState({ set: set.id, slot }) !== 'empty',
      ).length;
      // Item 120: while saves cannot be read every file reads as empty: said instead of a count.
      const files = !readable
        ? STORAGE_UNREADABLE
        : used === 0
          ? 'No files used'
          : `${used} ${used === 1 ? 'file' : 'files'} used`;
      return {
        label: set.label,
        // 38e: on the file just played, after a run.
        select: () => game.scenes.push(filesBoxFor(game, set.id, game.playedSlot(set.id))),
        hint: `${set.about}${beatHint(classicBeatStatus(set.id))}. ${files}`,
      };
    });
    items.push({ label: 'Back', select: () => this.leave(), hint: 'To the Start box' });
    this.setItems(items);
  }

  /** Back from a set's file box: the sets again (their hints follow the files). */
  comeBack(): void {
    this.build();
    this.announce();
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
   * Over the CLASSIC title (O-04): the rows in a box over the demo (each value and BEATEN at the
   * row's right), the Campaign-rules status line under it and the BACK line.
   */
  private renderBox(r: Renderer): void {
    const game = this.game;
    const calm = game.ctx.reduceFlashing;
    const rows: BoxRow[] = this.items.map((it, i) => {
      const set = i;
      const value = it.value?.();
      return {
        label: it.label,
        ...(value !== undefined ? { value } : {}),
        ...(set >= 0 && set < MAP_SETS.length && this.beaten[set] ? { mark: BEATEN_MARK } : {}),
      };
    });
    const grow = this.boxAt === null ? 1 : boxGrowth(this.t - this.boxAt, calm);
    // Clear of the status line and the BACK hint under it, whatever its row count (O-04).
    const at = boxLayout(rows, this.status !== '', boxCentreUnderLogo(rows));
    drawMenuBox(r, game.ctx.assets, rows, this.index, { cx: 128, cy: at.cy, grow, t: this.t, calm });
    if (grow < 1) return;
    const assets = game.ctx.assets;
    const line = (s: string, y: number) => {
      const x = Math.round(128 - (s.length * 8) / 2);
      r.text(assets.sheet('font', FONT_COLOURS.black), s, x + 1, y + 1);
      r.text(assets.sheet('font'), s, x, y);
    };
    // The screen's full width (31 columns), so "CAMPAIGN RULES: ALWAYS NORMAL" fits whole.
    if (this.status && at.statusY !== null) line(this.status.toUpperCase().slice(0, 31), at.statusY);
    line(abilityHint(game, 'BACK', 'attack'), at.backY);
  }

  /** The demo under the box plays on while it is up (original-title.ts). */
  override update(input: InputFrame): void {
    this.over?.tickDemo();
    super.update(input);
  }

  /**
   * A beaten set's row ends in BEATEN, right-aligned where a menu value goes (the menu is full
   * screen and short, so its rows never scroll); the spoken hint carries the difficulty.
   */
  override render(r: Renderer): void {
    if (this.over) return this.renderBox(r);
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
/** The first full-screen menu row's y (the CLASSIC menu's BEATEN marks line up with its rows). */
const CLASSIC_RULES_Y = 64;

/** Classic mode's shared options (the Start box's OPTIONS): Music set, Tutorials, Cheats, the usual Options. */
export class ClassicOptionsScene extends MenuScene {
  /** BUG-01: the CLASSIC title it is a box over (null: a full-screen page). */
  private readonly over = demoUnder(this.game);

  constructor(game: Game, onBack: () => void) {
    super(game, 'CLASSIC OPTIONS', [], onBack);
    if (this.over) {
      this.translucent = true;
      this.moveSfx = 'fireball';
      this.backSfx = 'bump';
      this.adjustSfx = 'coin';
      this.okAdjustSfx = 'coin';
    }
    this.build();
  }

  /** The demo under the box plays on while it is up. */
  override update(input: InputFrame): void {
    this.over?.tickDemo();
    super.update(input);
  }

  /**
   * The rows (rebuilt after a change, so the Music set row's `*` mark follows). B-L: only what
   * is shared across Classic, changeable any time: Music set, Tutorials, Cheats and the video,
   * audio and controls. A file's rules (Map difficulty, Game mode, More settings, Weapons, Disable
   * heroes) are chosen only as the file starts (original-files-menu.ts).
   */
  private build(): void {
    const game = this.game;
    const onBack = this.onBack ?? (() => {});
    this.setItems([
      optionItem(game, MUSIC_SET_ROW, () => this.build()),
      tutorialsItem(game),
      {
        label: 'Cheats',
        select: () => game.scenes.push(new CheatsScene(game, () => this.back(), { all: game.devMode })),
        hint: game.devMode
          ? 'The original cheats; developer mode opens them all'
          : 'The original cheats; play to unlock them',
      },
      {
        // O-13: named for what it holds (the original's own options are the rows above).
        label: 'Video, audio, controls',
        select: () =>
          game.scenes.push(new OptionsScene(game, () => this.back(), false, true, 'Video, audio, controls')),
        hint: 'Video, audio, controls, how to play and asset packs',
      },
      { label: 'Back', select: onBack },
    ]);
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

  /** BUG-01: over the CLASSIC title, the original's box; else the usual full-screen page. */
  override render(r: Renderer): void {
    if (this.over) {
      renderBoxedMenu(r, this.game, {
        backAction: this.backAction,
        header: 'Options',
        items: this.items,
        index: this.index,
        t: this.t,
        status: this.status,
        age: this.t,
      });
      return;
    }
    super.render(r);
  }
}
