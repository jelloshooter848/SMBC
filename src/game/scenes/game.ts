import { SceneStack } from '@engine/scene';
import type { GameContext, GameState } from '../context';
import { newGameState } from '../context';
import type { CharacterDef } from '../characters/character';
import { TitleScene } from './title';
import { IntroScene } from './intro';
import { LevelScene, type LevelStart } from './level';
import { GameOverScene } from './game-over';
import { CharacterSelectScene } from './character-select';
import type { LevelData } from '../level/schema';
import { MessageScene } from './message';

export interface GameDeps {
  ctx: GameContext;
  getLevel: (id: string) => LevelData;
  characters: CharacterDef[];
  debugKeys?: ReadonlySet<string>;
  fps?: () => number;
}

/** Orchestrates scenes and carries GameState between levels. */
export class Game {
  readonly scenes = new SceneStack();
  state: GameState;

  constructor(readonly deps: GameDeps) {
    this.state = newGameState(deps.characters[0] as CharacterDef);
  }

  get ctx(): GameContext {
    return this.deps.ctx;
  }

  showTitle(): void {
    this.deps.ctx.audio.stopMusic();
    this.scenes.clear();
    this.scenes.push(new TitleScene(this));
  }

  showCharacterSelect(): void {
    this.scenes.replace(new CharacterSelectScene(this));
  }

  newGame(character: CharacterDef, levelId = '1-1'): void {
    this.state = newGameState(character);
    this.goToLevel(levelId, { mode: 'stand' });
  }

  /** Intro card then the level. Levels that don't exist yet end the run with a thank-you card. */
  goToLevel(levelId: string, start: LevelStart): void {
    let level: LevelData;
    try {
      level = this.deps.getLevel(levelId);
    } catch {
      this.deps.ctx.audio.stopMusic();
      this.deps.ctx.audio.playJingle('world-clear');
      this.scenes.clear();
      this.scenes.push(
        new MessageScene(
          this,
          [
            'THANK YOU FOR PLAYING!',
            '',
            `WORLD ${levelId.split('-')[0]} IS NOT`,
            'BUILT YET.',
            '',
            'MORE WORLDS COMING SOON',
          ],
          () => this.showTitle(),
        ),
      );
      return;
    }
    this.state.world = level.world;
    this.state.stage = level.stage;
    this.deps.ctx.audio.stopMusic();
    this.deps.ctx.audio.setTempoScale(1);
    this.scenes.clear();
    this.scenes.push(new IntroScene(this, () => this.startLevel(level, start)));
  }

  /** Straight into a level (pipes, bonus rooms). */
  startLevel(level: LevelData, start: LevelStart): void {
    this.scenes.clear();
    this.scenes.push(new LevelScene(this, level, start));
  }

  gameOver(): void {
    this.scenes.clear();
    this.scenes.push(new GameOverScene(this));
  }
}
