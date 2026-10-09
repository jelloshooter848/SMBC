import type { Action } from '@engine/input/actions';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { px, tileToSub } from '@engine/math/units';
import { SCREEN_H } from '@engine/viewport';
import type { Game } from '../scenes/game';
import { CardScene } from '../scenes/message';
import type { World } from '../world/world';
import { T } from '../level/tiles';
import { fontText, wrapText } from '../hud/text';
import type { LevelScene } from '../scenes/level';
import type { LevelData } from '../level/schema';
import type { CharacterDef } from '../characters/character';
import { abilityHint, controlScheme } from '../scenes/hints';
import { levelTouchLabels } from '../touch-labels';
import {
  drawPromptBox,
  fillAbilities,
  LessonTracker,
  PROMPT_BOX_Y,
  wrapPrompt,
  type Lesson,
} from './stage-prompts';
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
 * - the pause menu offers "Skip tutorial" (Game.skipTutorial): the stage counts as cleared;
 * - a task walked past is not skipped (0.4.36): a gate (`gates`) closes the way until it is done,
 *   and a player who stops at it on the ground is shown Toad's card (`Lesson.retry`, waiting for a
 *   press) and put back before the task, with a fresh stage. Nothing moves him while he moves.
 */

/**
 * A gate (0.4.36): a column of blocks at column `col`, rows `top` to 12, solid (blank tiles under
 * it: the director draws it) until lesson `after` is done; then it breaks apart.
 */
export interface TutorialGate {
  col: number;
  top: number;
  after: string;
}

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
   * A scripted moment, once: when `when` holds (checked every frame in the main area, also during
   * the flagpole's clear), or else when lesson `lesson` is current and a player stands at column
   * `x` or past it in the main area. `play` pushes its scenes and calls `done` when they are over.
   */
  beat?: {
    lesson?: string;
    x?: number;
    when?(world: World): boolean;
    play(ctx: TutorialContext, done: () => void): void;
  };
  /** Gates that close the way until a lesson is done (TutorialGate), in the stage's order. */
  gates?: readonly TutorialGate[];
  /** Once this lesson is done, a respawn comes back big (the lessons after it need it). */
  bigAfter?: string;
  /**
   * Pause → Skip tutorial (campaign): a story scene the file must still see before the stage
   * closes (1-0: Bowser's spell, once per file). Pushes it and calls `done` after it, and returns
   * true; false when there is none (the stage closes at once).
   */
  beforeSkip?(ctx: TutorialContext, done: () => void): boolean;
}

/**
 * Game.skipTutorial in the campaign: plays the tutorial's `beforeSkip` scene over `scene` (the
 * pause menu and anything else over the level closed first), `then` after it. False when there
 * is none to play.
 */
export function skipTutorialStory(game: Game, scene: LevelScene, levelId: string, then: () => void): boolean {
  const def = stageTutorial(levelId);
  if (!def?.beforeSkip) return false;
  const stack = game.scenes;
  if (!stack.find((s) => s === scene)) return false;
  while (stack.top !== scene) stack.pop();
  return def.beforeSkip({ game, scene }, then);
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
  /**
   * Player one's hero as the file had it when the tutorial swapped in its own hero (campaign:
   * Game.enterLevelFromMap), given back when the tutorial ends (Game.endTutorial) and written by
   * every save in between; null when nothing was swapped.
   */
  heroes: TutorialHeroes | null;
}

/** A hero and its power, as a save file keeps them. */
export interface TutorialHeroes {
  character: CharacterDef;
  powerState: string;
  hp: number;
  kit: Record<string, number>;
}

/** A fresh run of `def`, keeping `lives`; `heroes` is what to give back at the end. */
export function newTutorialRun(
  def: StageTutorial,
  lives: number,
  heroes: TutorialHeroes | null = null,
): TutorialRun {
  return { level: def.level, lesson: 0, done: [], missed: [], greeted: false, beat: false, lives, heroes };
}

/** Frames before the greeting starts, so the stage shows first. */
const GREET_DELAY = 20;
/** Frames the "NICE!" tag shows on the box after a lesson is done. */
const NICE_FRAMES = 60;
/** Frames a player stands against a closed gate before Toad's card comes (a bump is not a stop). */
export const GATE_STOP_FRAMES = 24;
/** Columns a line of Toad's card may take (the dialogue box's, as the greeting's). */
const CARD_COLS = 28;
/** The keys that close Toad's card (OK, BACK or MENU), as the greeting's. */
const CARD_KEYS = ['jump', 'attack', 'start'] as const;
/** A gate's block (content/sprites/house.ts). */
export const GATE_FRAME = 'gate-block';
/** What Toad says at a gate when the lesson has no words of its own. */
const RETRY = "DO THE TIP UP TOP TO OPEN THE WAY. LET'S TRY THAT AGAIN!";

/** Runs a stage tutorial in one level scene (LevelScene.tutorial). */
export class TutorialDirector {
  private readonly tracker: LessonTracker;
  /** A scripted scene is on (the greeting, the beat): no box, no checks. */
  private busy = false;
  private frames = 0;
  private nice = 0;
  /** The lesson the box shows: the one just done while "NICE!" is up, else the current one. */
  private shown: number;
  private cache = { key: '', lines: [] as string[] };
  /** Gates laid in this world (closed), and the frames a player has stood against one. */
  private readonly laid = new Set<TutorialGate>();
  private stopped = 0;

  constructor(
    private readonly game: Game,
    private readonly scene: LevelScene,
    readonly def: StageTutorial,
    readonly run: TutorialRun,
  ) {
    this.tracker = new LessonTracker(def.lessons, run.lesson);
    this.tracker.done.push(...run.done);
    this.tracker.missed.push(...run.missed);
    this.shown = this.tracker.index;
    this.layGates();
  }

  /** Gate `g` is closed: its lesson is not done yet. */
  private closed(g: TutorialGate): boolean {
    return this.tracker.index <= this.tracker.indexOf(g.after);
  }

  /** The columns of the gates closed in this world, in order. */
  get closedGates(): number[] {
    return [...this.laid].map((g) => g.col);
  }

  /** The closed gates' blocks in the main area (blank solid tiles; render draws them). */
  private layGates(): void {
    if (!this.mainArea) return;
    const map = this.scene.world.map;
    for (const g of this.def.gates ?? []) {
      if (!this.closed(g)) continue;
      for (let row = g.top; row <= 12; row++) map.set(g.col, row, T.BUMPING);
      this.laid.add(g);
    }
  }

  /** Gates whose lesson is now done break apart, bottom block first. */
  private openGates(): void {
    const world = this.scene.world;
    for (const g of [...this.laid]) {
      if (this.closed(g)) continue;
      this.laid.delete(g);
      for (let row = 12; row >= g.top; row--) {
        world.map.set(g.col, row, T.AIR);
        world.breakPieces(g.col, row);
      }
      this.game.ctx.audio.sfx('break');
      world.shake(6);
      this.game.deps.announcer?.say('The gate opens.');
    }
  }
  /**
   * The director for `scene`'s level, or null when it has no tutorial or player one is not its
   * hero (dev select or `?level=` with another hero: then it is a plain stage). Picks up the
   * game's run of that tutorial (a respawn, a pipe) or starts one; any other level ends the run.
   */
  static attach(game: Game, scene: LevelScene): TutorialDirector | null {
    const def = levelTutorial(scene.level);
    if (!def || game.state.character.id !== def.hero) {
      game.tutorialRun = null;
      return null;
    }
    let run = game.tutorialRun;
    if (!run || run.level !== def.level) {
      run = newTutorialRun(def, game.state.lives);
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

  /**
   * A player standing on the ground against a closed gate, still, for GATE_STOP_FRAMES (never
   * in the air, never on the way past a bump): the gate it is, else null.
   */
  private stoppedAtGate(world: World): TutorialGate | null {
    for (const g of this.laid) {
      const edge = tileToSub(g.col);
      const at = world.players.some((p) => {
        const b = p.body;
        return (
          !p.dead && !p.out && b.onGround && Math.abs(b.vx) < 0x400 && b.x < edge && b.x + b.w >= edge - px(2)
        );
      });
      if (at) {
        this.stopped++;
        return this.stopped >= GATE_STOP_FRAMES ? g : null;
      }
    }
    this.stopped = 0;
    return null;
  }

  /**
   * Toad's card at a closed gate (the current lesson's `retry`): it waits for a press, then the
   * player is put back before the task.
   */
  private showRetry(): void {
    const l = this.tracker.current;
    this.busy = true;
    this.stopped = 0;
    const labels = levelTouchLabels(this.scene.world.players[0], this.scene.world);
    const words = fillAbilities(l?.retry ?? RETRY, (a, act) => this.abilityName(a, act, labels));
    const lines = ['TOAD:', '', ...wrapText(fontText(words), CARD_COLS)];
    const game = this.game;
    game.ctx.audio.sfx('pause');
    game.deps.announcer?.say(`${lines.filter(Boolean).join(' ')} OK to continue.`);
    game.scenes.push(
      new CardScene(
        game,
        lines,
        () => {
          game.scenes.pop();
          this.putBack();
        },
        this.scene.world,
        {
          keys: CARD_KEYS,
          panel: true,
          top: true,
          prompt: () => fontText(abilityHint(game, 'OK', 'jump')),
        },
      ),
    );
  }

  /** Back before the current lesson's task, standing, in a fresh stage (no life lost, no card). */
  putBack(): void {
    this.rewind();
    const l = this.tracker.current ?? this.def.lessons[this.def.lessons.length - 1];
    this.game.state.checkpoint = null;
    this.game.startLevel(this.game.deps.getLevel(this.def.level), {
      x: l?.at ?? 2,
      y: l?.row ?? 12,
      mode: 'stand',
      clearEnemies: 'all',
    });
  }

  /**
   * Back to the lesson a fresh stage can teach: one in a sub-area goes back to the one leading
   * there, one with `restartsAt` to that lesson. Done and skipped lists follow.
   */
  private rewind(): void {
    const t = this.tracker;
    for (let guard = 0; guard < t.lessons.length && t.index > 0; guard++) {
      const cur = t.current;
      if (cur?.area) t.index--;
      else if (cur?.restartsAt && t.indexOf(cur.restartsAt) >= 0) t.index = t.indexOf(cur.restartsAt);
      else break;
    }
    const before = new Set(t.lessons.slice(0, t.index).map((x) => x.id));
    for (const list of [t.done, t.missed])
      for (let i = list.length - 1; i >= 0; i--) if (!before.has(list[i] as string)) list.splice(i, 1);
    this.sync();
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
    if (this.busy) return;
    // "NICE!" over the lesson just done, then the next one.
    if (this.nice > 0 && --this.nice === 0) this.showCurrent();
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
    const due = (b: NonNullable<StageTutorial['beat']>): boolean =>
      b.when
        ? b.when(world)
        : this.lesson?.id === b.lesson &&
          world.players.some((p) => !p.dead && !p.out && p.body.onGround && p.body.x >= tileToSub(b.x ?? 0));
    if (beat && !this.run.beat && this.mainArea && due(beat)) {
      this.run.beat = true;
      this.busy = true;
      beat.play(this.ctx, () => this.resume());
      return;
    }
    const step = this.tracker.update(world, this.mainArea);
    if (step) {
      this.sync();
      this.openGates();
      if (step.kind === 'done' && !step.lesson.note) {
        this.nice = NICE_FRAMES;
        this.game.ctx.audio.sfx('select');
        this.game.deps.announcer?.say('Nice!');
      } else this.showCurrent();
      return;
    }
    if (this.mainArea && this.stoppedAtGate(world)) this.showRetry();
  }

  /** The box moves on to the current lesson, read out. */
  private showCurrent(): void {
    this.nice = 0;
    this.shown = this.tracker.index;
    this.announce();
  }

  /** A scripted scene is over: the prompt comes (back) and is read out (not after the stage). */
  private resume(): void {
    this.busy = false;
    if (this.tracker.current) this.showCurrent();
  }

  /** Reads out the prompt the box shows. */
  announce(): void {
    const text = this.lines().join(' ');
    if (text) this.game.deps.announcer?.say(text);
  }

  /** The words for ability `ability` on `action`: the touch button's caption on touch, then the key. */
  private abilityName(ability: string, action: Action, labels: TouchLabels): string {
    const touch = controlScheme(this.game) === 'touch';
    const caption = action in labels ? labels[action as keyof TouchLabels] : null;
    return abilityHint(this.game, touch && caption ? caption : ability, action);
  }

  /** The prompt's lines as the box shows them (cached until the lesson or the scheme changes). */
  lines(): string[] {
    const l = this.tracker.lessons[this.shown];
    if (!l) return [];
    const labels = levelTouchLabels(this.scene.world.players[0], this.scene.world);
    const scheme = controlScheme(this.game);
    const key = `${this.shown}|${scheme}|${labels.jump}|${labels.attack}`;
    const text = (scheme === 'touch' ? l.touchText : undefined) ?? l.text;
    if (this.cache.key !== key)
      this.cache = {
        key,
        lines: wrapPrompt(fillAbilities(text, (a, act) => this.abilityName(a, act, labels))),
      };
    return this.cache.lines;
  }

  /**
   * The prompt box over the level (not while a scripted scene plays, before the greeting, or under
   * the pause menu).
   */
  render(r: Renderer): void {
    this.drawGates(r);
    if (this.busy || !this.run.greeted || this.game.scenes.top !== this.scene) return;
    const lines = this.lines();
    if (!lines.length) return;
    const l = this.tracker.lessons[this.shown];
    const meter = l?.meter && this.nice === 0 ? Math.max(0, Math.min(1, l.meter(this.scene.world))) : null;
    const shown = meter === null ? lines : [...lines, ''];
    const h = shown.length * 10 + 10;
    // Out of the way of a player up high (a vine, the flagpole's top): the box goes to the bottom.
    const camY = this.scene.world.camera.pxY ?? 0;
    const high = this.scene.world.players.some(
      (p) => !p.dead && !p.out && Math.round(p.body.y / px(1)) - camY < PROMPT_BOX_Y + h + 8,
    );
    const y = high ? SCREEN_H - h - 6 : PROMPT_BOX_Y;
    const bottom = drawPromptBox(r, this.game.ctx.assets.sheet('font'), shown, {
      tag: this.nice > 0 ? 'NICE!' : '',
      y,
    });
    if (meter !== null) this.drawMeter(r, bottom - 13, meter);
  }

  /** The sprint bar: a frame, dark cells, gold fill (white once full), arrow notches. */
  private drawMeter(r: Renderer, y: number, k: number): void {
    const w = 128;
    const x = 64;
    r.rect(x - 2, y - 2, w + 4, 10, '#fcfcfc');
    r.rect(x, y, w, 6, '#404040');
    const fill = Math.round(w * k);
    r.rect(x, y, fill, 6, k >= 1 ? '#fcfcfc' : '#f8b800');
    for (let cx = x + 15; cx < x + w; cx += 16) r.rect(cx, y, 1, 6, '#000');
  }

  /** The closed gates: columns of red and white barrier blocks (blank solid tiles beneath). */
  private drawGates(r: Renderer): void {
    if (!this.laid.size) return;
    const cam = this.scene.world.camera;
    const camX = cam.pxX;
    const camY = cam.pxY ?? 0;
    const sheet = this.game.ctx.assets.sheet('house');
    for (const g of this.laid) {
      const x = g.col * 16 - camX;
      if (x < -16 || x > 256) continue;
      for (let row = g.top; row <= 12; row++) r.sprite(sheet, GATE_FRAME, x, row * 16 - camY);
    }
  }

  /**
   * A death (LevelScene, after the power is reset): no life lost, and straight back in at the
   * current lesson's column (a lesson in a sub-area goes back to the one leading there).
   */
  respawn(): void {
    const t = this.tracker;
    this.rewind();
    const l = t.current ?? t.lessons[t.lessons.length - 1];
    // Past the mushroom, the lessons need a big hero: he comes back big.
    const big = this.def.bigAfter;
    if (big && t.done.includes(big) && this.game.state.powerState === 'small')
      this.game.state.powerState = 'big';
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
