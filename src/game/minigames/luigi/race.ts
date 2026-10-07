import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { px, toPx } from '@engine/math/units';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import { levelSeed, World } from '../../world/world';
import { newGameState } from '../../context';
import { MARIO } from '../../characters/mario';
import { LUIGI } from '../../characters/luigi';
import type { View } from '../../entities/entity';
import type { Game } from '../../scenes/game';
import { MiniGameMenuScene } from '../menu';
import { levelTouchLabels, NO_TOUCH_BUTTONS } from '../../touch-labels';
import type { MiniGameResult } from '../types';
import { LUIGI_ROUTE, poleOf, raceCourse } from './course';
import { RivalLuigi } from './rival';
import { drawBanner, drawBigText, drawOffscreenArrow, drawTrack, raceClock } from './race-hud';

/** Frames each of "3", "2", "1" stays up; the race starts on GO, which stays up a little longer. */
export const COUNT_FRAMES = 60;
export const GO_FRAME = COUNT_FRAMES * 3;
const GO_SHOWN = 50;
/** After the rival takes the flag: his slide down the pole and the banner, then the round ends. */
export const LOST_FRAMES = 150;
/** The most the win's flag sequence may run before the round ends anyway. */
const WIN_MAX_FRAMES = 600;
/** The race music: the overworld theme, a little faster. */
const RACE_TEMPO = 1.15;

export type RacePhase = 'countdown' | 'race' | 'won' | 'lost' | 'dead' | 'over';

/**
 * Luigi's Mirror Race: Mario against brainwashed Luigi, a ghost racer (rival.ts), over a short
 * course (luigi-race.map) to a flagpole. A real World runs Mario (physics, enemies, pits, the
 * flag sequence) with a state of its own, so nothing here touches the campaign's score, lives or
 * power. The first to the pole wins; a death loses. The menu offers Continue / Give up.
 */
export class MirrorRaceScene implements Scene {
  readonly world: World;
  readonly rival: RivalLuigi;
  phase: RacePhase = 'countdown';
  /** Frames since the scene started, and frames of racing (the clock). */
  private t = 0;
  raceFrames = 0;
  /** Frames since the race was decided. */
  private endT = 0;
  private readonly start: number;
  private readonly goal: number;

  constructor(
    private readonly game: Game,
    private readonly done: (result: MiniGameResult) => void,
  ) {
    const level = raceCourse();
    const pole = poleOf(level);
    // Mario as he starts a level, small, in a state that belongs to the race alone.
    const state = newGameState(MARIO);
    this.world = new World(level, game.ctx, state, { seed: levelSeed(level) });
    this.world.time = null; // no clock: the race is against Luigi
    // Luigi starts a tile behind Mario, so both show at the line.
    this.rival = new RivalLuigi(level, LUIGI, LUIGI_ROUTE, px(level.start.x * 16 - 16), pole);
    this.world.backdrop = (r) => this.rival.render(r, this.view());
    this.start = toPx(this.world.player.body.x);
    this.goal = pole.x;
  }

  private view(): View {
    return {
      camX: this.world.camera.pxX,
      frame: this.world.frame,
      assets: this.game.ctx.assets,
      theme: this.world.level.theme,
      reduceFlashing: this.game.ctx.reduceFlashing,
    };
  }

  enter(): void {
    this.game.ctx.audio.stopMusic();
  }

  exit(): void {
    this.game.ctx.audio.setTempoScale(1);
  }

  touchLabels(): TouchLabels {
    if (this.phase === 'countdown' || this.phase === 'race')
      return levelTouchLabels(this.world.players[0], this.world);
    return { ...NO_TOUCH_BUTTONS };
  }

  update(input: InputFrame): void {
    if (this.phase === 'over') return;
    if ((this.phase === 'countdown' || this.phase === 'race') && input.pressed('start')) {
      this.game.scenes.push(new RaceMenuScene(this.game, () => this.finish('quit')));
      return;
    }
    this.t++;
    if (this.phase === 'countdown') return this.countdown();
    if (this.phase === 'lost') {
      this.rival.update();
      if (++this.endT >= LOST_FRAMES) this.finish('fail');
      return;
    }
    this.world.update([input]);
    const events = this.world.events.splice(0);
    if (this.phase === 'race') {
      this.raceFrames++;
      this.rival.update();
      if (this.world.flagGrabbedBy) this.win();
      else if (this.world.player.dead) this.lose('dead');
      else if (this.rival.finished) this.lose('lost');
      return;
    }
    this.rival.update(); // stopped: he coasts and lands
    this.endT++;
    if (this.phase === 'won' && (events.some((e) => e.type === 'exit') || this.endT >= WIN_MAX_FRAMES))
      this.finish('pass');
    else if (this.phase === 'dead' && events.some((e) => e.type === 'died')) this.finish('fail');
  }

  private countdown(): void {
    const audio = this.game.ctx.audio;
    const say = (s: string) => this.game.deps.announcer?.say(s);
    if (this.t === 1 || this.t === COUNT_FRAMES + 1 || this.t === COUNT_FRAMES * 2 + 1) {
      audio.sfx('timer-tick');
      say(String(3 - Math.floor((this.t - 1) / COUNT_FRAMES)));
    }
    if (this.t >= GO_FRAME) {
      this.phase = 'race';
      audio.sfx('coin');
      audio.setTempoScale(RACE_TEMPO);
      audio.playMusic(this.world.level.music);
      say('Go!');
    }
  }

  private win(): void {
    this.phase = 'won';
    this.rival.stopped = true;
    this.game.ctx.audio.setTempoScale(1);
    this.game.deps.announcer?.say('You beat Luigi to the flag!');
  }

  private lose(why: 'dead' | 'lost'): void {
    this.phase = why;
    this.endT = 0;
    const audio = this.game.ctx.audio;
    audio.setTempoScale(1);
    if (why === 'dead') {
      this.rival.stopped = true; // the world plays the death
      const fell = toPx(this.world.player.body.y) > SCREEN_H;
      this.game.deps.announcer?.say(fell ? 'Mario fell. Try again.' : 'Mario was hit. Try again.');
      return;
    }
    audio.stopMusic();
    audio.sfx('flagpole');
    this.game.deps.announcer?.say('Luigi wins the race.');
  }

  /** The round is over: report it once. */
  private finish(result: MiniGameResult): void {
    if (this.phase === 'over') return;
    this.phase = 'over';
    const audio = this.game.ctx.audio;
    audio.setTempoScale(1);
    audio.stopMusic();
    this.done(result);
  }

  /** How far along the course (0 at the start line, 1 at the pole) a body's right edge is. */
  private progress(x: number, w: number): number {
    return (x + w - this.start) / (this.goal - this.start);
  }

  render(r: Renderer): void {
    this.world.render(r);
    const font = this.game.ctx.assets.sheet('font');
    const m = this.world.player.body;
    const l = this.rival.player.body;
    drawTrack(r, font, this.progress(toPx(m.x), toPx(m.w)), this.progress(toPx(l.x), toPx(l.w)));
    r.text(font, raceClock(this.raceFrames), 208, 14);
    // Where the rival is when the screen doesn't show him.
    const sx = toPx(l.x) - this.world.camera.pxX;
    const sy = toPx(l.y);
    if (this.phase === 'race' || this.phase === 'lost') {
      if (sx > SCREEN_W) drawOffscreenArrow(r, font, 1, sy);
      else if (sx + toPx(l.w) < 0) drawOffscreenArrow(r, font, -1, sy);
    }
    if (this.phase === 'countdown') {
      const n = 3 - Math.floor(this.t / COUNT_FRAMES);
      drawBigText(r, String(Math.max(1, n)), SCREEN_W / 2, 72, '#fcfcfc');
      drawBanner(r, font, 'RACE LUIGI TO THE FLAG!', 120);
    } else if (this.phase === 'race' && this.t - GO_FRAME < GO_SHOWN) {
      drawBigText(r, 'GO!', SCREEN_W / 2, 72, '#f8b800');
    } else if (this.phase === 'won') {
      drawBanner(r, font, 'YOU BEAT LUIGI!', 72);
    } else if (this.phase === 'lost') {
      drawBanner(r, font, 'LUIGI WINS!', 72);
    }
  }
}

/**
 * The race's own menu: Continue, or Give up (ends the round as 'quit'), and in dev mode the
 * assists (No damage: enemies cannot hurt Mario, a pit still ends the race, as in a level).
 * Pauses the music.
 */
export class RaceMenuScene extends MiniGameMenuScene {
  constructor(game: Game, giveUp: () => void) {
    super(game, 'MIRROR RACE', giveUp, 'Luigi stays brainwashed for now; you can race him again later');
  }
}
