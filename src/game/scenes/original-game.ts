import { loadProgress, saveProgress } from '@engine/save/progress';
import type { ClassicRules } from '@engine/save/settings';
import { MenuScene, type MenuItem } from './menu';
import { OptionsScene } from './options';
import { CheatsScene } from './cheats-menu';
import { ClassicHeroesScene } from './classic-heroes-menu';
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

/** The level whose clear opens the Lost Levels: SMB's last castle. */
export const SMB_LAST_CASTLE = '8-4';

/**
 * Whether the CLASSIC menu offers The Lost Levels: SMB beaten in a Classic mode run (the global
 * progress store's cleared list). A campaign file's clear does not count (owner decision).
 */
export function lostLevelsOpen(): boolean {
  return loadProgress().cleared.includes(SMB_LAST_CASTLE);
}

/** A Classic mode run beat `levelId` (SMB 8-4): kept in the global progress store. */
export function recordClassicClear(levelId: string): void {
  const p = loadProgress();
  if (p.cleared.includes(levelId)) return;
  saveProgress({ ...p, cleared: [...p.cleared, levelId] });
}

/** A menu line as MenuScene reads it (label, value and hint), without a doubled full stop. */
function spokenItem(it: MenuItem | undefined): string {
  if (!it) return '';
  const v = it.value ? `: ${it.value()}` : '';
  // A changed option's `*` mark is drawn, not read (its hint says it is changed).
  const line = `${it.label.replace(/\*$/, '')}${v}`;
  return it.hint ? `${line.replace(/\.$/, '')}. ${it.hint}` : line;
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

/** The CLASSIC menu: Super Mario Bros., The Lost Levels (once open), Options, Back. */
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
    const items: MenuItem[] = [
      {
        label: 'Super Mario Bros.',
        select: () => game.classicSelect('1-1', back),
        hint: `The original game with every hero${own}`,
      },
    ];
    if (lostLevelsOpen())
      items.push({
        label: 'The Lost Levels',
        select: () => game.classicSelect('ll-1-1', back),
        hint: `The harder second quest${own}`,
      });
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
}

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
        label: 'Disable heroes',
        value: () => String(game.deps.settings?.classicHeroesOff?.length ? 'Some off' : 'All on'),
        select: () => game.scenes.push(new ClassicHeroesScene(game, () => this.back())),
        hint: 'Leave heroes out of the select and Random',
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
        select: () => game.scenes.push(new OptionsScene(game, () => this.back(), false, true)),
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
