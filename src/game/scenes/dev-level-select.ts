import { MenuScene } from './menu';
import type { Game } from './game';
import type { CharacterDef } from '../characters/character';

const POWER_UP_STATES = ['small', 'big', 'fire'];
const HP_STATES = ['full', 'half', '1 hp'];

/** Developer level select: any level, any character, chosen power state, 99 lives. */
export class DevLevelSelectScene extends MenuScene {
  private levels: string[];
  private levelIndex = 0;
  private charIndex = 0;
  private powerIndex = 0;
  private fullKit = false;

  constructor(game: Game, onBack: () => void) {
    super(game, 'LEVEL SELECT', [], onBack);
    this.levels = game.deps.listLevels?.() ?? ['1-1'];
    if (!this.levels.length) this.levels = ['1-1'];
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
          this.charIndex = cycle(this.charIndex, d, game.deps.characters.length);
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
        value: () => (this.character.devKit ? (this.fullKit ? 'full' : 'basic') : '-'),
        adjust: () => (this.fullKit = !this.fullKit),
        hint: 'Full: all tools, ammo and magic',
      },
      {
        label: 'Start',
        select: () =>
          game.devStart(this.levels[this.levelIndex] ?? '1-1', this.character, this.power, this.fullKit),
        hint: 'Starts with 99 lives',
      },
      { label: 'Back', select: onBack },
    ]);
  }

  private get character(): CharacterDef {
    return this.game.deps.characters[this.charIndex] ?? (this.game.deps.characters[0] as CharacterDef);
  }

  private get powerStates(): string[] {
    return this.character.damage.kind === 'powerup' ? POWER_UP_STATES : HP_STATES;
  }

  private get power(): string {
    return this.powerStates[this.powerIndex] ?? (this.powerStates[0] as string);
  }
}
