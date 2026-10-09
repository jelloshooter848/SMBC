import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Action } from '@engine/input/actions';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { px, tileToSub } from '@engine/math/units';
import { parseTextMap } from '../level/textmap';
import type { EntitySpawn, LevelData } from '../level/schema';
import { levelSeed, World } from '../world/world';
import { newGameState, type GameState } from '../context';
import type { CharacterDef } from '../characters/character';
import { carriedKit } from '../entities/player';
import type { Entity } from '../entities/entity';
import { heroStart } from '../items/heroes';
import type { Game } from '../scenes/game';
import { CardScene } from '../scenes/message';
import { MenuScene, type MenuItem } from '../scenes/menu';
import { abilityHint } from '../scenes/hints';
import { drawHud } from '../hud/hud';
import { fontText, wrapText } from '../hud/text';
import { LIGHT_SKIES } from '../world/tile-render';
import { levelTouchLabels, NO_TOUCH_BUTTONS } from '../touch-labels';
import {
  newTutorialRun,
  TutorialDirector,
  type StageTutorial,
  type TutorialContext,
  type TutorialHost,
  type TutorialRun,
} from './stage-tutorial';
import { lessonItems } from './stage-prompts';
import { MergedInput } from './room';
import { itemName, ownsItem, TRANSIENT_KIT } from './kit';
import {
  LessonCandle,
  stageWatch,
  TrainingDoor,
  TrainingTarget,
  WaitingGoomba,
  type TargetOptions,
} from './targets';

/*
 * A hero's training stage (0.4.37, docs/HEROES.md): a short stage of their own, in their own
 * game's look and music, played over a paused level, a hero pick or the Arena, in a world of its
 * own and a copy of the run (so nothing the stage does reaches the run). It runs the stage
 * tutorial's director (stage-tutorial.ts) as 1-0 does: one tip at a time in the box under the HUD,
 * gates that hold the way until a lesson is done, Toad's card when the hero stops at one (a press,
 * then he stands at the lesson's start in a fresh stretch), a death that costs nothing. The hero
 * starts with their basic kit and takes each power-up from a real block, in the order their kit
 * builds up. The flagpole ends it with the TRAINING CLEAR card. MENU offers Continue / Skip this
 * lesson / Skip training; a replay first asks where to START AT.
 */

/** One hero's stage: the tutorial (its lessons and gates), its map and Toad's greeting. */
export interface HeroStage {
  hero: string;
  tutorial: StageTutorial;
  /** The stage's map text (src/content/levels/training/<hero>.map, imported ?raw). */
  source: string;
  /** Toad's greeting, one page each (lines after TOAD:). */
  greeting: readonly string[];
}

/** Columns a line of Toad's cards takes (the dialogue box's). */
const CARD_COLS = 28;
/** The keys that turn a card's page (OK, MENU); BACK skips the rest of the greeting. */
const CARD_KEYS: readonly Action[] = ['jump', 'start'];
const SKIP_KEYS: readonly Action[] = ['attack'];

export type StageResult = 'done' | 'skip';

export interface HeroStageOptions {
  /** Which player trains (their input drives the hero). */
  player?: number;
  /** A replay (Pause → Training, the Arena): START AT is asked first. */
  replay?: boolean;
  /** Called once when the stage ends: the flagpole ('done') or Skip training ('skip'). */
  onEnd: (result: StageResult) => void;
}

const parsed = new Map<string, LevelData>();

/** A stage's level, parsed once (outside the level library, so no select lists it). */
export function stageLevel(stage: HeroStage): LevelData {
  const id = stage.tutorial.level;
  let level = parsed.get(id);
  if (!level) parsed.set(id, (level = parseTextMap(stage.source, id)));
  return level;
}

/**
 * A map's own spawns (feet on the bottom of their tile): `target` a TrainingTarget, `candle` a
 * wall candle (`dx=` px along, `lesson=`: gone once that lesson is done), `door` a
 * TrainingDoor whose walkers come while lesson `lesson=` is being played (`live`), a `goomba` with
 * `lesson=` a WaitingGoomba that walks only then.
 */
export function stageEntity(
  s: EntitySpawn,
  live: (lesson: string) => boolean,
  done: (lesson: string) => boolean = () => false,
): Entity | null | undefined {
  // A target (or a candle) of a lesson done is not put up again in a rebuilt stretch.
  if (
    (s.type === 'target' || s.type === 'candle') &&
    typeof s.props?.lesson === 'string' &&
    done(s.props.lesson)
  )
    return null;
  // A wall candle (Simon's), `dx` px right of its tile's: just past a whip's reach from a low wall.
  if (s.type === 'candle') {
    const lesson = typeof s.props?.lesson === 'string' ? s.props.lesson : undefined;
    return new LessonCandle(s.x, s.y, lesson, Number(s.props?.dx ?? 0) || 0);
  }
  if (s.type === 'door') {
    const lesson = String(s.props?.lesson ?? '');
    return new TrainingDoor(tileToSub(s.x), tileToSub(s.y + 1), () => live(lesson));
  }
  // A lesson's walker waits until its lesson is being played (its item taken).
  if (s.type === 'goomba' && typeof s.props?.lesson === 'string') {
    const lesson = s.props.lesson;
    return new WaitingGoomba(tileToSub(s.x) + px(2), tileToSub(s.y) + px(2), () => live(lesson));
  }
  if (s.type !== 'target') return undefined;
  const p = s.props ?? {};
  const opts: TargetOptions = {};
  if (typeof p.lesson === 'string') opts.lesson = p.lesson;
  if (typeof p.shoots === 'number') {
    opts.shoots = p.shoots;
    // A lesson's shooter fires only while that lesson is played (its item taken).
    if (typeof p.lesson === 'string') {
      const lesson = p.lesson;
      opts.live = () => live(lesson);
    }
  }
  if (typeof p.tough === 'number') opts.tough = p.tough;
  if (p.facing === 'left') opts.facing = -1;
  else if (p.facing === 'right') opts.facing = 1;
  // A hanging target's top is the top of its tile (under the ceiling); a standing one's feet the bottom.
  if (p.hang) {
    opts.hang = true;
    return new TrainingTarget(tileToSub(s.x) + px(2), tileToSub(s.y) + px(24), opts);
  }
  return new TrainingTarget(tileToSub(s.x) + px(2), tileToSub(s.y + 1), opts);
}

/** A page wrapped to the dialogue box, under TOAD:. */
function toadPage(text: string): string[] {
  return ['TOAD:', '', ...wrapText(fontText(text), CARD_COLS)];
}

export class HeroStageScene implements Scene, TutorialHost {
  world: World;
  readonly level: LevelData;
  readonly state: GameState;
  readonly run: TutorialRun;
  readonly director: TutorialDirector;
  private readonly player: number;
  private over = false;
  /** The TRAINING CLEAR card is up (the flagpole was grabbed). */
  cleared = false;
  private swallowJump = true;
  /** Lessons done when their targets were last popped. */
  private popped = 0;

  constructor(
    private readonly game: Game,
    readonly hero: CharacterDef,
    readonly stage: HeroStage,
    private readonly opts: HeroStageOptions,
  ) {
    this.player = opts.player ?? 0;
    this.level = stageLevel(stage);
    this.state = this.freshState();
    this.world = this.build(this.level.start.x, this.level.start.y);
    const def: StageTutorial = { ...stage.tutorial, greet: (ctx, done) => this.greet(ctx, done) };
    this.run = newTutorialRun(def, this.state.lives);
    this.director = new TutorialDirector(game, this, def, this.run);
    this.director.rebuilt();
  }

  /**
   * The hero with their basic kit (the campaign's first kit, items/heroes.ts heroStart), whatever
   * the run holds: the stage's blocks build it up. One life, no clock, no score shown.
   */
  private freshState(): GameState {
    const s = newGameState(this.hero);
    const start = heroStart(this.hero);
    s.kit = { ...start.kit };
    s.powerState = start.powerState;
    s.hp = start.hp;
    s.lives = 1;
    return s;
  }

  /** A fresh world with the hero standing at column `x`, row `y`. */
  private build(x: number, y: number): World {
    const level = this.level;
    const world = new World(level, this.game.ctx, this.state, {
      x,
      y,
      mode: 'stand',
      seed: levelSeed(level),
      // No score is shown in training (the HUD reads TRAINING): no "200" floats up either.
      scorePopups: false,
      extraEntities: (s) =>
        stageEntity(
          s,
          (id) => this.lessonLive(id),
          (id) => !!this.director?.done.includes(id),
        ),
    });
    world.time = null;
    world.useHeroItems(level.heroItems ?? []);
    world.camera.allowLeftScroll = this.game.ctx.assist.allowLeftScroll;
    stageWatch(world);
    this.popped = 0;
    return world;
  }

  /**
   * Lesson `id` is being played: it is the current one, and its item (if any) is taken. A door's
   * walkers come only then.
   */
  lessonLive(id: string): boolean {
    const l = this.director?.lesson;
    if (!l || l.id !== id || this.director.scripted) return false;
    return lessonItems(l).every((item) => ownsItem(this.world.player, item));
  }

  /** The stage's music (its world's song). */
  private playMusic(): void {
    const audio = this.game.ctx.audio;
    audio.setTempoScale(1);
    audio.playMusic(this.level.music);
  }

  enter(): void {
    this.game.ctx.audio.stopMusic();
    this.playMusic();
    this.game.deps.announcer?.say(`${this.hero.name} training.`);
    if (this.opts.replay) this.askStartAt();
  }

  exit(): void {
    this.game.ctx.audio.setTempoScale(1);
  }

  resume(): void {
    this.game.ctx.audio.stopMusic();
    this.playMusic();
    this.swallowJump = true;
  }

  resumePlay(): void {
    this.swallowJump = true;
  }

  /**
   * A put-back, a respawn, Skip this lesson or START AT: a fresh stage with the hero standing at
   * column `x`, row `y`. A death (`respawn`) costs no life: the hero comes back with the basic kit
   * and the director gives the kit floor. A move or spell under way is left behind.
   */
  restartAt(x: number, y: number, why: 'put-back' | 'respawn'): void {
    const s = this.state;
    if (why === 'respawn') {
      const start = heroStart(this.hero);
      s.powerState = start.powerState;
      s.hp = start.hp;
      s.kit = { ...start.kit };
    } else this.syncState();
    for (const k of TRANSIENT_KIT) delete s.kit[k];
    s.lives = 1;
    this.world = this.build(x, y);
    this.director.rebuilt();
    this.swallowJump = true;
  }

  /** The player's power, health and kit into the stage's own state (put-backs keep them). */
  private syncState(): void {
    const p = this.world.player;
    const s = this.state;
    s.powerState = p.powerState;
    s.hp = p.hp;
    s.kit = carriedKit(p);
  }

  /** Toad's greeting, page by page (OK or MENU turns a page, BACK skips the rest). */
  private greet({ game }: TutorialContext, done: () => void): void {
    const pages = this.stage.greeting;
    const prompt = (): string => fontText(abilityHint(game, 'OK', 'jump'));
    const finish = () => {
      this.resumePlay();
      done();
    };
    const show = (i: number): void => {
      const page = pages[i];
      if (page === undefined) return finish();
      const lines = toadPage(page);
      game.deps.announcer?.say(`${lines.filter(Boolean).join(' ')} OK to continue.`);
      game.scenes.push(
        new CardScene(
          game,
          lines,
          () => {
            game.scenes.pop();
            show(i + 1);
          },
          this.world,
          {
            keys: CARD_KEYS,
            panel: true,
            prompt,
            top: true,
            skipKeys: SKIP_KEYS,
            onSkip: () => {
              game.scenes.pop();
              finish();
            },
          },
        ),
      );
    };
    game.ctx.audio.sfx('pause');
    show(0);
  }

  /** START AT (a replay): the beginning or any power-up's lesson. */
  private askStartAt(): void {
    const game = this.game;
    const lessons = this.director.def.lessons;
    const pick = (i: number) => () => {
      game.scenes.pop();
      if (i > 0) this.director.startAt(i);
      this.swallowJump = true;
    };
    const items: MenuItem[] = [{ label: 'Beginning', select: pick(0), hint: 'The whole stage' }];
    lessons.forEach((l, i) => {
      if (!l.item) return;
      items.push({
        label: itemName(this.hero.id, l.item),
        select: pick(i),
        hint: 'Earlier items are given',
      });
    });
    game.scenes.push(new StartAtMenu(game, this.hero, items, pick(0)));
  }

  touchLabels(): TouchLabels {
    if (this.over) return { ...NO_TOUCH_BUTTONS };
    return levelTouchLabels(this.world.players[0], this.world);
  }

  update(input: InputFrame, inputs: InputFrame[] = [input]): void {
    if (this.over) return;
    const own = inputs[this.player] ?? input;
    const frame = this.player === 0 ? own : new MergedInput([own, inputs[0] ?? input]);
    if (this.swallowJump) {
      this.swallowJump = false;
      frame.consumeJumpBuffer();
    }
    if (frame.pressed('start') && this.run.greeted) {
      this.game.scenes.push(
        new StageMenu(
          this.game,
          this.hero,
          () => this.finish('skip'),
          this.director.lesson ? () => this.director.skipLesson() : null,
        ),
      );
      return;
    }
    const world = this.world;
    world.update([frame]);
    stageWatch(world).observe();
    this.syncState();
    this.director.update();
    if (this.world !== world) return;
    for (const ev of world.events.splice(0)) {
      if (ev.type === 'say') this.game.deps.announcer?.say(ev.text);
      else if (ev.type === 'died') {
        this.director.respawn();
        return;
      }
    }
    this.popTargets();
    // Down the flagpole: the TRAINING CLEAR card, waiting for a press.
    const phase = world.clearPhase;
    if (!this.cleared && phase && phase !== 'slide') this.clear();
  }

  /** The targets of lessons done since the last look pop. */
  private popTargets(): void {
    const done = this.director.done;
    if (done.length === this.popped) return;
    const ids = new Set(done.slice(this.popped));
    this.popped = done.length;
    for (const e of [...this.world.entities])
      if (e instanceof TrainingTarget && e.lesson && ids.has(e.lesson)) e.pop(this.world);
  }

  /** The flagpole: TRAINING CLEAR over the stage, then the stage ends. */
  private clear(): void {
    this.cleared = true;
    const game = this.game;
    game.ctx.audio.stopMusic();
    game.ctx.audio.playJingle('level-clear');
    const lines = toadPage(`TRAINING CLEAR! ${this.hero.name.toUpperCase()} IS READY TO GO.`);
    game.deps.announcer?.say(`${lines.filter(Boolean).join(' ')} OK to continue.`);
    game.scenes.push(
      new CardScene(
        game,
        lines,
        () => {
          game.scenes.pop();
          this.finish('done');
        },
        this.world,
        {
          keys: ['jump', 'attack', 'start'],
          panel: true,
          top: true,
          prompt: () => fontText(abilityHint(game, 'OK', 'jump')),
        },
      ),
    );
  }

  /** The stage is over: report it once. */
  finish(result: StageResult): void {
    if (this.over) return;
    this.over = true;
    const audio = this.game.ctx.audio;
    audio.setTempoScale(1);
    audio.stopMusic();
    this.opts.onEnd(result);
  }

  render(r: Renderer): void {
    this.world.render(r);
    // The gates stand in the world: under the HUD (a gate the screen's full height never hides it).
    this.director.drawGates(r);
    drawHud(r, this.game.ctx.assets, this.state, null, this.world.frame, this.world.players, {
      place: 'TRAINING',
      covered: (x, y, w, h) => this.world.spriteIn(x, y, w, h),
      outline: LIGHT_SKIES.has(this.level.theme),
    });
    this.director.render(r, { gates: false });
  }
}

/** The stage's menu: Continue, Skip this lesson, Skip training. Pauses the music. */
export class StageMenu extends MenuScene {
  constructor(game: Game, hero: CharacterDef, skip: () => void, skipLesson: (() => void) | null) {
    super(
      game,
      fontText(`${hero.name} TRAINING`),
      [
        { label: 'Continue', select: () => game.scenes.pop() },
        ...(skipLesson
          ? [
              {
                label: 'Skip this lesson',
                select: () => {
                  game.scenes.pop();
                  skipLesson();
                },
                hint: 'Its power-up is given and the way opens',
              },
            ]
          : []),
        {
          label: 'Skip training',
          select: () => {
            game.scenes.pop();
            skip();
          },
          hint: 'Training stays in the pause menu during a level',
        },
      ],
      () => game.scenes.pop(),
      true,
    );
  }

  override enter(): void {
    this.game.ctx.audio.sfx('pause');
    this.game.ctx.audio.pause();
    super.enter();
  }

  exit(): void {
    this.game.ctx.audio.resume();
  }
}

/** START AT: where a replayed stage begins (the beginning, or a power-up's lesson). */
export class StartAtMenu extends MenuScene {
  constructor(game: Game, hero: CharacterDef, items: MenuItem[], back: () => void) {
    super(game, fontText(`${hero.name} TRAINING: START AT`), items, back, true);
  }
}
