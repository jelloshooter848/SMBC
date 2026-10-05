import { SceneStack } from '@engine/scene';
import { loadProgress, saveProgress } from '@engine/save/progress';
import type { GameContext, GameState } from '../context';
import { newGameState } from '../context';
import { startHp, type CharacterDef } from '../characters/character';
import { TitleScene } from './title';
import { IntroScene } from './intro';
import { LevelScene, type LevelStart } from './level';
import { startTime } from '../world/world';
import { GameOverScene } from './game-over';
import { CharacterSelectScene } from './character-select';
import type { LevelData } from '../level/schema';
import type { Settings } from '@engine/save/settings';
import type { InputManager } from '@engine/input/input-manager';
import type { Announcer } from '@engine/a11y/announcer';
import type { Viewport } from '@engine/viewport';
import { EditorScene } from './editor';
import { DevMenuScene } from './dev';
import { MenuScene } from './menu';
import { loadLibrary, customLevelId } from '../level/library';
import { MessageScene } from './message';

export interface GameDeps {
  ctx: GameContext;
  getLevel: (id: string) => LevelData;
  characters: CharacterDef[];
  debugKeys?: ReadonlySet<string>;
  fps?: () => number;
  /** Live settings object and a callback that applies + persists it (wired by main). */
  settings?: Settings;
  applySettings?: () => void;
  input?: InputManager;
  announcer?: Announcer;
  /** Every playable level id (built-in and custom), for the developer level select. */
  listLevels?: () => string[];
  /** DOM hooks for the editor (canvas for pointer mapping, overlay for panels). */
  canvas?: HTMLCanvasElement;
  overlay?: HTMLElement;
  viewport?: Viewport;
}

/** Orchestrates scenes and carries GameState between levels. */
export class Game {
  readonly scenes = new SceneStack();
  state: GameState;
  /** Level to start after character select (custom levels / shared links). */
  pendingLevel: string | null = null;
  /** When set, the current level is an editor play-test; called when it ends. */
  playtestDone: (() => void) | null = null;

  constructor(readonly deps: GameDeps) {
    this.state = newGameState(deps.characters[0] as CharacterDef);
  }

  get ctx(): GameContext {
    return this.deps.ctx;
  }

  /** After the last castle: the princess's thanks, the final score, then the title. */
  showEnding(from = ''): void {
    const s = this.state;
    // The Lost Levels: clearing 8-4 opens worlds A-D; a run without warps goes on to World 9.
    let next: string | null = null;
    if (from === 'll-8-4') {
      const progress = loadProgress();
      progress.lost.letters = true;
      if (!s.warped) {
        progress.lost.world9 = true;
        next = 'll-9-1-start';
      }
      saveProgress(progress);
    }
    const audio = this.deps.ctx.audio;
    audio.stopMusic();
    audio.playJingle('world-clear');
    this.deps.announcer?.say(`Thank you ${s.character.name}! The princess is safe. Final score ${s.score}.`);
    this.scenes.clear();
    this.scenes.push(
      new MessageScene(
        this,
        [
          `THANK YOU ${s.character.hudName}!`,
          '',
          'THE PRINCESS IS SAFE',
          'AND THE KINGDOM IS FREE.',
          '',
          `FINAL SCORE ${String(s.score).padStart(6, '0')}`,
          '',
          'PRESS START',
        ],
        () => (next ? this.goToLevel(next, { mode: 'stand' }) : this.showTitle()),
        1800,
      ),
    );
  }

  showTitle(): void {
    this.deps.ctx.audio.stopMusic();
    this.pendingLevel = null;
    this.playtestDone = null;
    this.scenes.clear();
    this.scenes.push(new TitleScene(this));
  }

  showCharacterSelect(): void {
    this.scenes.replace(new CharacterSelectScene(this));
  }

  get devMode(): boolean {
    return this.deps.settings?.dev ?? false;
  }

  showDevMenu(): void {
    this.scenes.push(new DevMenuScene(this));
  }

  /** Developer level select: any level, character and power state, with 99 lives. */
  devStart(levelId: string, character: CharacterDef, power: string, fullKit = false): void {
    this.state = newGameState(character);
    this.state.lives = 99;
    if (fullKit && character.devKit) this.state.kit = character.devKit();
    if (character.damage.kind === 'powerup') this.state.powerState = power;
    else {
      const max = this.state.kit.maxHp ?? startHp(character);
      this.state.hp = power === 'full' ? max : power === 'half' ? Math.max(1, Math.ceil(max / 2)) : 1;
    }
    this.playtestDone = null;
    this.pendingLevel = null;
    this.goToLevel(levelId, { mode: 'stand' });
  }

  openEditor(initial?: { level: LevelData; name: string }): void {
    this.playtestDone = null;
    this.deps.ctx.audio.stopMusic();
    this.scenes.clear();
    this.scenes.push(new EditorScene(this, initial));
  }

  /** Menu of saved custom levels; picking one goes to character select then the level. */
  showCustomLevels(): void {
    const names = Object.keys(loadLibrary().levels).sort();
    const items = names.map((n) => ({
      label: n.slice(0, 14),
      select: () => {
        this.pendingLevel = customLevelId(n);
        this.showCharacterSelect();
      },
    }));
    if (!items.length) items.push({ label: 'No levels yet', select: () => this.openEditor() });
    items.push({ label: 'Back', select: () => this.showTitle() });
    this.scenes.replace(new MenuScene(this, 'CUSTOM LEVELS', items, () => this.showTitle()));
  }

  /** Run a level from the editor; returns to it when the level ends or the player quits. */
  playtest(level: LevelData, done: () => void): void {
    this.state = newGameState(this.state.character);
    this.state.lives = 99;
    this.playtestDone = done;
    this.startLevel(level, { mode: 'stand' });
  }

  /** Play a level decoded from a share link with the default character. */
  playShared(level: LevelData): void {
    this.state = newGameState(this.deps.characters[0] as CharacterDef);
    this.playtestDone = null;
    this.startLevel(level, { mode: 'stand' });
  }

  newGame(character: CharacterDef, levelId = '1-1', character2: CharacterDef | null = null): void {
    this.state = newGameState(character, character2);
    this.playtestDone = null;
    const id = this.pendingLevel ?? levelId;
    this.pendingLevel = null;
    this.goToLevel(id, { mode: 'stand' });
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
    this.deps.announcer?.say(`World ${level.world}-${level.stage}. ${this.state.lives} lives.`);
    const time = startTime(level, this.state, start);
    this.scenes.push(new IntroScene(this, () => this.startLevel(level, start), time));
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
