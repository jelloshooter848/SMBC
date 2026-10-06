import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Action } from '@engine/input/actions';
import type { Renderer } from '@engine/gfx/renderer';
import { SCREEN_W } from '@engine/viewport';
import type { Game } from './game';
import type { TouchLabels } from '@engine/input/touch';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import type { World } from '../world/world';

/** Frames a card ignores input for, so a press meant for the level doesn't skip it. */
export const CARD_GUARD_FRAMES = 30;

/**
 * Whether a card `t` frames old should go on: any player newly pressed one of `keys` (a button
 * held since before the card does not count) once the guard is over, or the timeout ran out.
 */
export function cardContinues(
  t: number,
  timeout: number,
  inputs: readonly InputFrame[],
  keys: readonly Action[],
): boolean {
  if (t >= timeout) return true;
  return t > CARD_GUARD_FRAMES && inputs.some((i) => keys.some((k) => i.pressed(k)));
}

/** Centered lines of text on black; continues on `keys` (any player) or after a timeout. */
export class MessageScene implements Scene {
  private t = 0;
  private done = false;
  constructor(
    private readonly game: Game,
    private readonly lines: string[],
    private readonly next: () => void,
    private readonly timeout = 600,
    private readonly keys: readonly Action[] = ['start', 'jump'],
  ) {}

  /** One OK button: A if it continues the message, else B, else Start. */
  touchLabels(): TouchLabels {
    const key = (['jump', 'attack', 'start'] as const).find((k) => this.keys.includes(k));
    return key ? { ...NO_TOUCH_BUTTONS, [key]: 'OK' } : NO_TOUCH_BUTTONS;
  }

  update(_input: InputFrame, inputs: InputFrame[]): void {
    if (this.done) return;
    if (cardContinues(++this.t, this.timeout, inputs, this.keys)) {
      this.done = true;
      this.next();
    }
  }

  render(r: Renderer): void {
    r.clear('#000');
    const font = this.game.ctx.assets.sheet('font');
    const y0 = 120 - (this.lines.length * 12) / 2;
    this.lines.forEach((l, i) => r.text(font, l, 128 - (l.length * 8) / 2, y0 + i * 12));
  }
}

/**
 * A closing card (the Lost Levels' endings): its lines drawn where the castle's text goes
 * (World.castleText), over the level when given its `world` so the HUD keeps showing the score,
 * as in the SMB 8-4 ending; else on black. Start or B (attack, the card's "PUSH BUTTON B")
 * from any player continues, or the timeout.
 */
export class CardScene implements Scene {
  readonly translucent: boolean;
  private t = 0;
  private done = false;
  constructor(
    private readonly game: Game,
    readonly lines: readonly string[],
    private readonly next: () => void,
    private readonly world: World | null = null,
    private readonly timeout = 1800,
  ) {
    this.translucent = world !== null;
    if (world) world.castleText = [...lines];
  }

  /** B goes on (the card's "PUSH BUTTON B"); Start does too, but one button is enough. */
  touchLabels(): TouchLabels {
    return { ...NO_TOUCH_BUTTONS, attack: 'OK' };
  }

  update(_input: InputFrame, inputs: InputFrame[]): void {
    if (this.done) return;
    if (cardContinues(++this.t, this.timeout, inputs, ['start', 'attack'])) {
      this.done = true;
      this.next();
    }
  }

  render(r: Renderer): void {
    if (this.world) return; // the level beneath draws the lines (World.castleText)
    r.clear('#000');
    const font = this.game.ctx.assets.sheet('font');
    this.lines.forEach((l, i) => r.text(font, l, (SCREEN_W - l.length * 8) >> 1, 80 + i * 16));
  }
}
