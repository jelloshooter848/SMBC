import type { CharacterDef } from '../characters/character';
import type { Game } from '../scenes/game';
import { MenuScene } from '../scenes/menu';
import { snapshot } from '../scenes/free-hero';
import { fontText } from '../hud/text';
import { FIRST_HERO } from '../save/save-files';
import { lessonsFor } from './lessons';
import { MergedInput, PracticeRoomScene } from './room';
import { HeroStageScene } from './hero-stage';
import { heroStage } from './heroes';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { Scene } from '@engine/scene';

/*
 * Optional hero training (campaign only, docs/HEROES.md). The first time a hero other than Mario
 * is picked on a save file, "<HERO> TRAINING?" asks YES / NO; either answer is recorded on the
 * file (SaveFile.tutorials) so it is asked once. YES plays the hero's training, then the pick goes
 * on exactly as it would have. The pause menu's Training replays it from a level, starting with
 * START AT. Luigi, Link, Mega Man and Samus train in a stage of their own (hero-stage.ts, 0.4.37);
 * the others in the practice room (room.ts) until theirs come.
 */

/** The hero has training: a stage of their own, or the practice room's lessons (not Mario: 1-0). */
export function hasTraining(heroId: string): boolean {
  return heroId !== FIRST_HERO && (heroStage(heroId) !== null || lessonsFor(heroId).length > 0);
}

/** Where the hero trains, in words: "a training stage" or "a training room". */
export function trainingPlace(heroId: string): string {
  return heroStage(heroId) ? 'a training stage' : 'a training room';
}

/** Training exists for this hero here: campaign play (not an editor play-test), not Mario. */
export function trainingOffered(game: Game, hero: CharacterDef): boolean {
  return game.campaign !== null && !game.playtestDone && hasTraining(hero.id);
}

/**
 * The hero's training scene: their stage (a `replay` asks START AT first), else the practice
 * room. `onEnd` gets 'done' when it is finished, 'skip' when it is left.
 */
export function trainingScene(
  game: Game,
  hero: CharacterDef,
  opts: { player: number; replay: boolean; onEnd: (result: 'done' | 'skip') => void },
): Scene {
  const stage = heroStage(hero.id);
  if (stage) return new HeroStageScene(game, hero, stage, opts);
  return new PracticeRoomScene(game, hero, { player: opts.player, onEnd: opts.onEnd });
}

/** The first pick of this freed hero on the file: ask about training before going on. */
export function needsTraining(game: Game, hero: CharacterDef): boolean {
  // A hero picked only through dev "All heroes" (not freed on the file) is not asked: the real
  // question waits for the hero to be freed.
  return trainingOffered(game, hero) && game.freed.includes(hero.id) && !game.tutorials.includes(hero.id);
}

/** "<HERO> TRAINING?" YES / NO, over the character select. */
export class TrainingQuestionScene extends MenuScene {
  constructor(
    game: Game,
    readonly hero: CharacterDef,
    answer: (yes: boolean) => void,
    private readonly player = 0,
  ) {
    super(
      game,
      fontText(`${hero.name} TRAINING?`),
      [
        {
          label: 'Yes',
          select: () => answer(true),
          hint: `Practise ${hero.name}'s moves in ${trainingPlace(hero.id)}`,
        },
        { label: 'No', select: () => answer(false), hint: 'Play on' },
      ],
      null,
    );
    this.status = 'ALSO IN THE PAUSE MENU';
  }

  /** The menu on black, with the hero standing under it. */
  override render(r: Renderer): void {
    super.render(r);
    const c = this.hero.portrait;
    const sheet = this.game.ctx.assets.sheet(c.sheet, c.palette);
    const h = sheet.frames.get(c.frame)?.h ?? 32;
    r.sprite(sheet, c.frame, 120, 150 - h);
  }

  /** Player 2's question takes their controls and player 1's, as their pick did. */
  override update(input: InputFrame, inputs: InputFrame[] = [input]): void {
    const own = inputs[this.player];
    super.update(this.player > 0 && own ? new MergedInput([own, input]) : input);
  }

  override enter(): void {
    this.game.ctx.audio.sfx('pause');
    this.game.deps.announcer?.say(
      `${this.hero.name} training? Learn ${this.hero.name}'s moves in ${trainingPlace(this.hero.id)}. Training is also in the pause menu. Up and down to choose, OK to confirm. Yes.`,
    );
  }
}

/**
 * Play `hero`'s training (player `player`'s input drives it), then `after`. It starts from the
 * hero's basic kit whatever the run holds, in a state of its own, and the run's GameState is
 * restored afterwards, so training cannot change lives, score, coins, power, kit or the clock. A
 * `replay` (Pause, the Arena) asks where to START AT.
 */
export function runTraining(
  game: Game,
  hero: CharacterDef,
  player: number,
  after: () => void,
  replay = false,
): void {
  const saved = game.state;
  const before = snapshot(saved);
  let over = false;
  const scene = trainingScene(game, hero, {
    player,
    replay,
    onEnd: () => {
      if (over) return;
      over = true;
      // The training's own scenes (its menu, its cards) go with it.
      while (game.scenes.depth > 0) if (game.scenes.pop() === scene) break;
      game.state = saved;
      Object.assign(saved, before);
      after();
    },
  });
  game.scenes.push(scene);
}

/**
 * A pick confirmed `hero` for the first time on this file: ask, record the answer (saved at once),
 * then the practice room on YES, and `then` (the pick going on) either way. `music` (the map's)
 * is put back after the room.
 */
export function askTraining(
  game: Game,
  hero: CharacterDef,
  player: number,
  then: () => void,
  music?: string,
): void {
  const below = game.scenes.top;
  let answered = false;
  const answer = (yes: boolean) => {
    if (answered) return;
    answered = true;
    game.answerTraining(hero.id);
    while (game.scenes.depth > 0 && game.scenes.top !== below) game.scenes.pop();
    if (!yes) return then();
    runTraining(game, hero, player, () => {
      // The music that played under the pick (the map's) comes back for what follows.
      if (music) game.ctx.audio.playMusic(music);
      then();
    });
  };
  game.scenes.push(new TrainingQuestionScene(game, hero, answer, player));
}

/**
 * Pause → Training: the room over the paused level, then back to the level as it was (its clock
 * stood still; the pause menu closes and the music starts again).
 */
export function trainFromPause(game: Game, hero: CharacterDef, player: number): void {
  const pause = game.scenes.top;
  // The pause menu suspended the sound; the room has its own music.
  game.ctx.audio.resume();
  runTraining(
    game,
    hero,
    player,
    () => {
      if (game.scenes.top === pause) game.scenes.pop();
      const level = game.scenes.top as { resume?: () => void } | undefined;
      level?.resume?.();
    },
    true,
  );
}
