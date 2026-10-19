import { MenuScene } from './menu';
import type { Game } from './game';
import type { CharacterDef } from '../characters/character';
import { DEV_VILLAGE } from '../town/secret-house';
import type { Rules } from '../context';
import { heroFor } from '../characters/registry';

/** The Rules row's values and hint (dev Classic starts, TG rules model). */
export const RULES_LABELS: Record<Rules, string> = { current: 'Current', classic: 'Classic SMBC' };
export const RULES_HINT = 'Classic SMBC: heroes play as in SMBC 3.1.21';

const POWER_UP_STATES = ['small', 'big', 'fire'];
const HP_STATES = ['full', 'half', '1 hp'];

/** Developer level select: any level, any character, chosen power state, 99 lives. */
export class DevLevelSelectScene extends MenuScene {
  private levels: string[];
  private levelIndex = 0;
  private charIndex = 0;
  private powerIndex = 0;
  private fullKit = false;
  /** The run's rules (Current or Classic SMBC), passed to devStart. */
  private rules: Rules;
  /** Mode: free play (99 lives, straight back in after a death) or a Classic mode run. */
  private classicRun = false;

  constructor(game: Game, onBack: () => void) {
    super(game, 'LEVEL SELECT', [], onBack);
    this.rules = game.liveRules;
    this.levels = game.deps.listLevels?.() ?? ['1-1'];
    if (!this.levels.length) this.levels = ['1-1'];
    // Kakariko Village (0.4.41), for testing: no file, every hero to switch to, the title after.
    this.levels = [...this.levels, DEV_VILLAGE];
    const cycle = (i: number, d: number, n: number) => (i + d + n) % n;
    this.setItems([
      {
        label: 'Level',
        value: () => this.levels[this.levelIndex] ?? '-',
        adjust: (d) => (this.levelIndex = cycle(this.levelIndex, d, this.levels.length)),
        hint: 'Left and right to choose',
      },
      {
        label: 'Character',
        value: () => this.character.name,
        adjust: (d) => {
          this.charIndex = cycle(this.charIndex, d, this.roster.length);
          this.powerIndex = 0;
        },
      },
      {
        label: 'Power',
        value: () => this.powerStates[this.powerIndex] ?? '-',
        adjust: (d) => (this.powerIndex = cycle(this.powerIndex, d, this.powerStates.length)),
      },
      {
        label: 'Kit',
        value: () => (this.hero.devKit ? (this.fullKit ? 'full' : 'basic') : '-'),
        adjust: () => (this.fullKit = !this.fullKit),
        hint: 'Full: all tools, ammo and magic',
      },
      {
        label: 'Rules',
        value: () => RULES_LABELS[this.rules],
        adjust: () => {
          this.rules = this.rules === 'classic' ? 'current' : 'classic';
          // The roster and the power list can differ under the other rules.
          if (this.charIndex >= this.roster.length) this.charIndex = 0;
          this.powerIndex = 0;
        },
        hint: RULES_HINT,
      },
      {
        label: 'Mode',
        value: () => (this.classicRun ? 'Classic run' : 'Free play'),
        adjust: () => (this.classicRun = !this.classicRun),
        hint: 'Classic run plays as Classic mode with the chosen rules: its lives and continues',
      },
      {
        label: 'Start',
        select: () =>
          game.devStart(
            this.levels[this.levelIndex] ?? '1-1',
            this.character,
            this.power,
            this.fullKit,
            undefined,
            { rules: this.rules, classic: this.classicRun },
          ),
        hint: 'Free play starts with 99 lives',
      },
      { label: 'Back', select: onBack },
    ]);
  }

  /** Who can be picked under the chosen rules (Game.rosterFor: the Classic extras too). */
  private get roster(): CharacterDef[] {
    return this.game.rosterFor(this.rules);
  }

  private get character(): CharacterDef {
    return this.roster[this.charIndex] ?? (this.roster[0] as CharacterDef);
  }

  /** The def played under the chosen rules: its power list and kit (TG-17a). */
  private get hero(): CharacterDef {
    return heroFor(this.character, this.rules);
  }

  private get powerStates(): string[] {
    return this.hero.damage.kind === 'powerup' ? POWER_UP_STATES : HP_STATES;
  }

  private get power(): string {
    return this.powerStates[this.powerIndex] ?? (this.powerStates[0] as string);
  }
}
