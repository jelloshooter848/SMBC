import { loadProgress, saveProgress } from '@engine/save/progress';
import type { ClassicRules } from '@engine/save/settings';
import { MenuScene, type MenuItem } from './menu';
import { OptionsScene } from './options';
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
  const line = `${it.label}${v}`;
  return it.hint ? `${line.replace(/\.$/, '')}. ${it.hint}` : line;
}

/** Where the Classic rules value is drawn: right edge, and the first full-screen menu row's y. */
const CLASSIC_RULES_RIGHT = 248;
const CLASSIC_RULES_Y = 64;

const RULES_LABELS: Record<ClassicRules, string> = { classic: 'Classic SMBC', current: 'Current' };

/** The CLASSIC menu: Super Mario Bros., The Lost Levels (once open), Options, Back. */
export class ClassicMenuScene extends MenuScene {
  constructor(game: Game) {
    super(game, 'CLASSIC', [], () => game.showTitle());
    const back = () => game.showClassicMenu();
    const items: MenuItem[] = [
      {
        label: 'Super Mario Bros.',
        select: () => game.classicSelect('1-1', back),
        hint: 'The original game with every hero',
      },
    ];
    if (lostLevelsOpen())
      items.push({
        label: 'The Lost Levels',
        select: () => game.classicSelect('ll-1-1', back),
        hint: 'The harder second quest',
      });
    items.push(
      {
        label: 'Options',
        select: () =>
          game.scenes.push(
            new ClassicOptionsScene(game, () => {
              game.scenes.pop();
              this.announce();
            }),
          ),
        hint: 'Classic rules and all settings',
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
    const step = () => {
      const s = game.deps.settings;
      if (!s) return;
      s.classicRules = s.classicRules === 'classic' ? 'current' : 'classic';
      game.deps.applySettings?.();
    };
    this.setItems([
      {
        label: 'Classic rules',
        value: () => (this.drawing ? '' : this.rulesLabel),
        adjust: step,
        hint: 'Classic SMBC plays the heroes as the original did; Current as the campaign does',
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
