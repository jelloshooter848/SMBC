import { getLevel } from '@content/levels';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { Scene } from '@engine/scene';
import { ScriptedInput } from '@game/sim/headless';
import { toPx } from '@engine/math/units';
import { Game } from '@game/scenes/game';
import { CHARACTERS } from '@game/characters/registry';
import type { MiniGameResult } from '../types';
import { LUIGI_MINIGAME } from '.';
import type { MirrorRaceScene } from './race';
import { RaceBot, type RaceBotOptions } from './bot';

/*
 * Test support for the Mirror Race (not a shipped code path): a whole race, the real scene in a
 * real Game, played by the race bot (bot.ts) from the card to the result.
 */

export interface RaceRun {
  result: MiniGameResult | null;
  /** Frames from GO to Mario's flag grab (null without one), and to Luigi's. */
  marioAt: number | null;
  luigiAt: number | null;
  died: boolean;
  stuck: boolean;
  /** Where Mario was (px) when the race was decided. */
  x: number;
  /** Frames Mario and Luigi spent waiting for plants. */
  waited: number;
  luigiWaited: number;
  /** Where Luigi was (px) at the end. */
  luigiX: number;
}

export function raceRun(
  opts: Partial<RaceBotOptions> & {
    /** Luigi races on to the pole even after Mario wins (luigiAt is then his finish anyway). */
    rivalOn?: boolean;
  } = {},
): RaceRun {
  const game = new Game({
    ctx: {
      assets: new AssetRegistry({ default: {} }),
      audio: NULL_AUDIO,
      assist: { ...DEFAULT_ASSIST },
      reduceFlashing: true,
    },
    getLevel,
    characters: CHARACTERS,
  });
  const below: Scene = { update() {}, render() {} };
  game.scenes.push(below);
  let result: MiniGameResult | null = null;
  const scene = LUIGI_MINIGAME.create(game, (r) => {
    result = r;
  }) as MirrorRaceScene;
  game.scenes.push(scene);
  const bot = new RaceBot(opts);
  const input = new ScriptedInput({ steps: [] });
  let marioAt: number | null = null;
  let died = false;
  let x = 0;
  for (let f = 0; f < 6000 && result === null; f++) {
    const racing = scene.phase === 'race';
    input.setHeld(racing ? bot.step(scene.world) : []);
    input.next();
    game.scenes.update([input]);
    if (racing && scene.phase !== 'race') {
      x = toPx(scene.world.player.body.x);
      if (scene.phase === 'won') marioAt = scene.raceFrames;
      died = scene.phase === 'dead';
    }
    if (bot.stuck) break;
  }
  if (opts.rivalOn) {
    // (The world stops with the race, so its plants no longer hold him up.)
    scene.rival.plantUp = null;
    for (let f = 0; f < 3000 && !scene.rival.finished; f++) {
      scene.rival.stopped = false;
      scene.rival.update();
    }
  }
  return {
    result,
    marioAt,
    luigiAt: scene.rival.finishedAt,
    died,
    stuck: bot.stuck,
    x,
    waited: bot.waited,
    luigiWaited: scene.rival.waited,
    luigiX: scene.rival.x,
  };
}
