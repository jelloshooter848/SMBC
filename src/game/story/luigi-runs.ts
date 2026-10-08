import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { SCREEN_W } from '@engine/viewport';
import { toPx } from '@engine/math/units';
import { fxPalette } from '@content/sprites/palette-fx';
import type { Game } from '@game/scenes/game';
import type { World } from '@game/world/world';
import type { CharacterDef } from '@game/characters/character';
import { Player } from '@game/entities/player';
import { drawSparkle, WAND_SPARKLE } from '@game/entities/effects/wand-poof';
import { cardContinues, CARD_GUARD_FRAMES } from '@game/scenes/message';
import { NO_TOUCH_BUTTONS } from '@game/touch-labels';
import { LUIGI_RUNS_SAID } from './script';

/*
 * 1-1's opening beat (docs/STORY.md 2.4; campaign, once per file, while Luigi is not freed): play
 * holds; brainwashed Luigi (the captive palette, wand sparkles drifting off him) stands about
 * eight columns ahead of Mario with his back turned, looks over his shoulder, flinches and runs
 * off the right of the screen, toward the pipe at column 57. A beat later the scene ends and
 * Mario's card follows (story/level-beats.ts). No text of its own; any press after the card
 * guard skips straight to the card.
 */

export const LUIGI_RUN_TIMING = {
  /** He looks back over his shoulder, then flinches (a little hop), then runs. */
  lookAt: 30,
  flinchAt: 56,
  runAt: 66,
  /** Px a frame he runs. */
  speed: 4,
  /** Frames after he is off screen before Mario's card. */
  beat: 24,
} as const;
const T = LUIGI_RUN_TIMING;

export class LuigiRunsScene implements Scene {
  readonly translucent = true;
  private t = 0;
  private done = false;
  private x: number;
  private readonly feet: number;
  private readonly pose: Player;
  private offAt = -1;

  constructor(
    private readonly game: Game,
    private readonly world: World,
    luigi: CharacterDef,
    private readonly next: () => void,
  ) {
    const p = world.player;
    const mx = toPx(p.body.x) - world.camera.pxX;
    this.x = Math.min(SCREEN_W - 24, mx + 8 * 16);
    this.feet = toPx(p.body.y + p.body.h);
    const pose = new Player(0, 0, luigi, 'big', 0);
    pose.facing = 1; // his back to Mario
    pose.body.onGround = true;
    this.pose = pose;
  }

  enter(): void {
    this.game.deps.announcer?.say(LUIGI_RUNS_SAID);
  }

  touchLabels(): TouchLabels {
    return this.t > CARD_GUARD_FRAMES ? { ...NO_TOUCH_BUTTONS, jump: 'SKIP' } : NO_TOUCH_BUTTONS;
  }

  update(_input: InputFrame, inputs: InputFrame[]): void {
    if (this.done) return;
    this.t++;
    if (cardContinues(this.t, inputs, ['jump', 'attack', 'start'])) return this.finish();
    const pose = this.pose;
    if (this.t === T.lookAt) pose.facing = -1;
    if (this.t === T.flinchAt) {
      pose.facing = 1;
      this.game.ctx.audio.sfx('flinch');
    }
    if (this.t >= T.runAt) {
      pose.anim = 'walk';
      if (this.t % 3 === 0) pose.walkFrame = (pose.walkFrame + 1) % 3;
      if (this.x < SCREEN_W + 24) this.x += T.speed;
      else if (this.offAt < 0) this.offAt = this.t;
    }
    if (this.offAt >= 0 && this.t - this.offAt >= T.beat) this.finish();
  }

  private finish(): void {
    this.done = true;
    this.world.player.facing = 1;
    this.next();
  }

  render(r: Renderer): void {
    if (this.x >= SCREEN_W + 16) return;
    const assets = this.game.ctx.assets;
    const reduce = this.game.ctx.reduceFlashing;
    const s = this.pose.def.sprite(this.pose, this.t, reduce);
    const sheet = assets.sheet(s.sheet, fxPalette(s.palette, 'brainwashed'));
    const h = sheet.frames.get(s.frame)?.h ?? 32;
    const flinch = this.t >= T.flinchAt && this.t < T.runAt ? -3 : 0;
    const y = this.feet - h + flinch;
    r.sprite(sheet, s.frame, Math.round(this.x), y, s.flip);
    // A few wand sparkles drifting up off him.
    for (let k = 0; k < 3; k++) {
      const drift = (this.t + k * 13) % 36;
      const c = reduce ? k % 3 : (k + (this.t >> 3)) % 3;
      drawSparkle(r, Math.round(this.x) + 3 + k * 5, y + 12 - (drift >> 1), 0, WAND_SPARKLE[c] as string);
    }
  }
}
