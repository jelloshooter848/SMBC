import type { Scene } from '@engine/scene';
import type { Game } from '../scenes/game';
import type { MiniGameResult } from '../minigames';
import type { DevRound } from '../scenes/dev-minigames';
import { newGameState } from '../context';
import { newTutorialRun, stageTutorial } from '../tutorial/stage-tutorial';
import { TUTORIAL_LEVEL } from '../save/save-files';

/*
 * A stage tutorial played as one round (the Mini Game Arena's 1-0 pad), the way Larry's airship
 * is a dev round: the stage over the arena's map with a run of its own (its hero, no clock, no
 * life lost), played through Game.stageRound:
 *
 * - its exit (the flagpole) ends the round as PASS (scenes/level.ts);
 * - pause → Give up ends it as QUIT (scenes/pause.ts; no Skip tutorial, no Quit to the title);
 * - a death respawns at the lesson as in the campaign; pipes and respawns clear the scenes down
 *   to the map (Game.clearToRoundBase) instead of all of them.
 *
 * The round runner (scenes/dev-minigames.ts playRound) puts the run, the map and the file's state
 * back afterwards; no file is open meanwhile, so nothing is saved.
 */

/** A stage round in progress (Game.stageRound). */
export interface StageRound {
  /** The scene the stage is played over (the arena's map): level changes clear down to it. */
  base: Scene | null;
  /** How it ended, reported once. */
  done: (result: MiniGameResult) => void;
}

/** Ends the stage round in progress as `result`; false when none is. */
export function endStageRound(game: Game, result: MiniGameResult): boolean {
  const run = game.stageRound;
  if (!run) return false;
  game.stageRound = null;
  run.done(result);
  return true;
}

/** Mario's tutorial stage 1-0 as a round, with its own hero. */
export const TUTORIAL_ROUND: DevRound = {
  title: `TUTORIAL ${TUTORIAL_LEVEL}`,
  hero: 'mario',
  create(game: Game, done: (result: MiniGameResult) => void): Scene {
    const tutorial = stageTutorial(TUTORIAL_LEVEL);
    if (!tutorial) throw new Error(`no stage tutorial ${TUTORIAL_LEVEL}`);
    const hero = game.deps.characters.find((c) => c.id === tutorial.hero) ?? game.firstHero;
    const level = game.deps.getLevel(game.firstArea(TUTORIAL_LEVEL));
    // The round's own run (the runner puts the file's back afterwards).
    game.state = newGameState(hero);
    game.state.world = level.world;
    game.state.stage = level.stage;
    game.tutorialRun = newTutorialRun(tutorial, game.state.lives, null);
    game.stageRound = { base: game.scenes.top ?? null, done };
    return game.levelScene(level, { mode: 'stand' });
  },
};
