import type { Action } from '@engine/input/actions';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { tileToSub } from '@engine/math/units';
import type { Game } from '../scenes/game';
import type { LevelScene } from '../scenes/level';
import type { LevelData } from '../level/schema';
import { abilityHint, controlScheme } from '../scenes/hints';
import { levelTouchLabels } from '../touch-labels';
import { drawPromptBox, fillAbilities, LessonTracker, wrapPrompt, type Lesson } from './stage-prompts';
import { MARIO_TUTORIAL } from './mario-1-0';

/*
 * Stage tutorials (0.5.0): a level whose play is a list of lessons (stage-prompts.ts), shown one at
 * a time in a box near the top of the screen and advanced when the player does each. Mario's 1-0
 * (mario-1-0.ts) is the first. While one is played:
 *
 * - it is played with its own hero (character select is skipped, Game.enterLevelFromMap);
 * - there is no clock and no life is lost: a death respawns at the current lesson's column,
 *   straight away (no character select), and the lives count never drops;
 * - the run (current lesson, greeting and scripted moment seen) lives on the Game, so it survives
 *   respawns, pits and pipes into its sub-areas; it ends when anything else is shown;
 * - the pause menu offers "Skip tutorial" (Game.skipTutorial): the stage counts as cleared.
 */

/** The game and the level scene a tutorial plays in, for its scripted scenes. */
export interface TutorialContext {
  game: Game;
  scene: LevelScene;
}

export interface StageTutorial {
  /** The main level id ('1-0'); its sub-areas (parent) play the same tutorial. */
  level: string;
  /** The hero it is played with (CharacterDef id). */
  hero: string;
  lessons: readonly Lesson[];
  /** On first entering the main area: scenes over the level (a greeting), then `done`. */
  greet?(ctx: TutorialContext, done: () => void): void;
  /**
   * A scripted moment, once: when lesson `lesson` is current and a player stands at column `x`
   * or past it in the main area. `play` pushes its scenes and calls `done` when they are over.
   */
  beat?: { lesson: string; x: number; play(ctx: TutorialContext, done: () => void): void };
}

/** Every stage tutorial, by main level id. */
export const STAGE_TUTORIALS: readonly StageTutorial[] = [MARIO_TUTORIAL];

/** The tutorial played in main level `levelId`, or null. */
export function stageTutorial(levelId: string): StageTutorial | null {
  return STAGE_TUTORIALS.find((t) => t.level === levelId) ?? null;
}

/** The tutorial a level (or one of its sub-areas) belongs to, or null. */
export function levelTutorial(level: LevelData): StageTutorial | null {
  return stageTutorial(level.parent ?? level.id);
}

/** A tutorial being played (Game.tutorialRun): what has been done so far. */
export interface TutorialRun {
  level: string;
  /** Index of the current lesson. */
  lesson: number;
  done: string[];
  missed: string[];
  greeted: boolean;
  beat: boolean;
  /** The lives count it keeps (no life is lost; 1-ups still count). */
  lives: number;
}

/** Frames before the greeting starts, so the stage shows first. */
const GREET_DELAY = 20;
/** Frames the "NICE!" tag shows on the box after a lesson is done. */
const NICE_FRAMES = 60;

/** Runs a stage tutorial in one level scene (LevelScene.tutorial). */
export class TutorialDirector {
  private readonly tracker: LessonTracker;
  /** A scripted scene is on (the greeting, the beat): no box, no checks. */
  private busy = false;
  private frames = 0;
  private nice = 0;
  private cache = { key: '', lines: [] as string[] };

  constructor(
    private readonly game: Game,
    private readonly scene: LevelScene,
    readonly def: StageTutorial,
    readonly run: TutorialRun,
  ) {
    this.tracker = new LessonTracker(def.lessons, run.lesson);
    this.tracker.done.push(...run.done);
    this.tracker.missed.push(...run.missed);
  }

  /**
   * The director for `scene`'s level, or null when it has no tutorial. Picks up the game's run of
   * that tutorial (a respawn, a pipe) or starts one; any other level ends the run.
   */
  static attach(game: Game, scene: LevelScene): TutorialDirector | null {
    const def = levelTutorial(scene.level);
    if (!def) {
      game.tutorialRun = null;
      return null;
    }
    let run = game.tutorialRun;
    if (!run || run.level !== def.level) {
      run = {
        level: def.level,
        lesson: 0,
        done: [],
        missed: [],
        greeted: false,
        beat: false,
        lives: game.state.lives,
      };
      game.tutorialRun = run;
    }
    return new TutorialDirector(game, scene, def, run);
  }

  /** The lesson being taught, or null once all are done. */
  get lesson(): Lesson | null {
    return this.tracker.current;
  }

  /** Lesson ids done, in order, and those skipped by moving on. */
  get done(): readonly string[] {
    return this.tracker.done;
  }
  get missed(): readonly string[] {
    return this.tracker.missed;
  }

  /** A scripted scene (greeting, beat) is playing over the level. */
  get scripted(): boolean {
    return this.busy;
  }

  private get mainArea(): boolean {
    return this.scene.level.id === this.def.level;
  }

  private get ctx(): TutorialContext {
    return { game: this.game, scene: this.scene };
  }

  private sync(): void {
    const r = this.run;
    r.lesson = this.tracker.index;
    r.done = [...this.tracker.done];
    r.missed = [...this.tracker.missed];
  }

  /** Each frame after the world's: lives kept, the greeting, the beat, the current lesson. */
  update(): void {
    const s = this.game.state;
    if (s.lives < this.run.lives) s.lives = this.run.lives;
    else this.run.lives = s.lives;
    this.frames++;
    if (this.nice > 0) this.nice--;
    if (this.busy) return;
    const def = this.def;
    if (!this.run.greeted && def.greet && this.mainArea) {
      if (this.frames < GREET_DELAY) return;
      this.run.greeted = true;
      this.busy = true;
      def.greet(this.ctx, () => this.resume());
      return;
    }
    this.run.greeted = true;
    const beat = def.beat;
    const world = this.scene.world;
    if (
      beat &&
      !this.run.beat &&
      this.mainArea &&
      this.lesson?.id === beat.lesson &&
      world.players.some((p) => !p.dead && !p.out && p.body.onGround && p.body.x >= tileToSub(beat.x))
    ) {
      this.run.beat = true;
      this.busy = true;
      beat.play(this.ctx, () => this.resume());
      return;
    }
    const step = this.tracker.update(world, this.mainArea);
    if (!step) return;
    this.sync();
    if (step.kind === 'done') {
      this.nice = NICE_FRAMES;
      this.game.ctx.audio.sfx('select');
    }
    this.announce(step.kind === 'done' ? 'Nice!' : '');
  }

  /** A scripted scene is over: the prompt comes (back) and is read out. */
  private resume(): void {
    this.busy = false;
    this.announce();
  }

  /** Reads out the current prompt (after `before`), as the box shows it. */
  announce(before = ''): void {
    const text = this.lesson ? this.lines().join(' ') : '';
    const say = `${before} ${text}`.trim();
    if (say) this.game.deps.announcer?.say(say);
  }

  /** The words for ability `ability` on `action`: the touch button's caption on touch, then the key. */
  private abilityName(ability: string, action: Action, labels: TouchLabels): string {
    const touch = controlScheme(this.game) === 'touch';
    const caption = action in labels ? labels[action as keyof TouchLabels] : null;
    return abilityHint(this.game, touch && caption ? caption : ability, action);
  }

  /** The current prompt's lines as shown (cached until the lesson or the scheme changes). */
  lines(): string[] {
    const l = this.lesson;
    if (!l) return [];
    const labels = levelTouchLabels(this.scene.world.players[0], this.scene.world);
    const key = `${this.tracker.index}|${controlScheme(this.game)}|${labels.jump}|${labels.attack}`;
    if (this.cache.key !== key)
      this.cache = {
        key,
        lines: wrapPrompt(fillAbilities(l.text, (a, act) => this.abilityName(a, act, labels))),
      };
    return this.cache.lines;
  }

  /**
   * The prompt box over the level (not while a scripted scene plays, before the greeting, or under
   * the pause menu).
   */
  render(r: Renderer): void {
    if (this.busy || !this.run.greeted || !this.lesson || this.game.scenes.top !== this.scene) return;
    drawPromptBox(
      r,
      this.game.ctx.assets.sheet('font'),
      this.lines(),
      undefined,
      this.nice > 0 ? 'NICE!' : '',
    );
  }

  /**
   * A death (LevelScene, after the power is reset): no life lost, and straight back in at the
   * current lesson's column (a lesson in a sub-area goes back to the one leading there).
   */
  respawn(): void {
    const t = this.tracker;
    while (t.index > 0 && t.current?.area) t.index--;
    const before = new Set(t.lessons.slice(0, t.index).map((x) => x.id));
    for (const list of [t.done, t.missed])
      for (let i = list.length - 1; i >= 0; i--) if (!before.has(list[i] as string)) list.splice(i, 1);
    this.sync();
    const l = t.current ?? t.lessons[t.lessons.length - 1];
    this.game.state.checkpoint = null;
    this.game.state.lives = this.run.lives;
    this.game.goToLevel(this.def.level, {
      x: l?.at ?? 2,
      y: l?.row ?? 12,
      mode: 'stand',
      clearEnemies: 'all',
    });
  }
}
