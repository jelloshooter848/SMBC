import { loadProgress, saveProgress } from '@engine/save/progress';
import type { ClassicRules } from '@engine/save/settings';
import { MenuScene, type MenuItem } from './menu';
import { OptionsScene } from './options';
import type { Game } from './game';
import { listSaves } from '../save/save-files';

/**
 * Classic mode (title > CLASSIC): the original game with none of the campaign's additions. This
 * file holds its menu, its options and what it keeps between runs (the global progress store,
 * never a campaign save file).
 */

/** The level whose clear opens the Lost Levels: SMB's last castle. */
export const SMB_LAST_CASTLE = '8-4';

/**
 * Whether the CLASSIC menu offers The Lost Levels: SMB beaten, in a Classic mode run (the global
 * progress store's cleared list) or on any campaign file (its gameCleared flag).
 */
export function lostLevelsOpen(): boolean {
  if (loadProgress().cleared.includes(SMB_LAST_CASTLE)) return true;
  return listSaves().some((s) => s !== null && typeof s !== 'string' && s.gameCleared === true);
}

/** A Classic mode run beat `levelId` (SMB 8-4): kept in the global progress store. */
export function recordClassicClear(levelId: string): void {
  const p = loadProgress();
  if (p.cleared.includes(levelId)) return;
  saveProgress({ ...p, cleared: [...p.cleared, levelId] });
}

/** A menu line as MenuScene reads it: label, value and hint. */
function spokenItem(it: MenuItem | undefined): string {
  if (!it) return '';
  const v = it.value ? `: ${it.value()}` : '';
  return `${it.label}${v}${it.hint ? `. ${it.hint}` : ''}`;
}

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
}

/** Classic mode's options: its rules, then every other setting (the usual Options). */
export class ClassicOptionsScene extends MenuScene {
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
        label: 'Rules',
        value: () => RULES_LABELS[game.deps.settings?.classicRules ?? 'classic'],
        adjust: step,
        hint: 'Classic rules. Classic SMBC plays the heroes as the original did; Current as the campaign does',
      },
      {
        label: 'All options',
        select: () => game.scenes.push(new OptionsScene(game, () => this.back())),
        hint: 'Video, audio, controls and more',
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
}
