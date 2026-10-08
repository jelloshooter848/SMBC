import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { SCREEN_W } from '@engine/viewport';
import { toPx } from '@engine/math/units';
import type { Game } from '../scenes/game';
import type { World } from '../world/world';
import type { CharacterDef } from '../characters/character';
import { Player } from '../entities/player';
import { enemyPalette } from '../entities/enemies/enemy';
import { fxPalette } from '@content/sprites/palette-fx';
import { cardContinues, CARD_GUARD_FRAMES } from '../scenes/message';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import { fontText } from '../hud/text';
import { abilityHint } from '../scenes/hints';
import { drawPromptBox, wrapPrompt } from './stage-prompts';

/** Pixels a frame the shadow hero runs. */
const RUN_SPEED = 3;
/** Frame Bowser's shadow starts to show (the hero is gone by then). */
const BOWSER_AT = 110;
/** Frames Bowser's shadow takes to rise into view. */
const BOWSER_RISE = 30;
/** What Bowser says, in the box at the top (and read out). */
export const TEASE_LINES: readonly string[] = ['BOWSER: BWA HA HA!', 'YOUR FRIENDS SERVE ME NOW, MARIO!'];

/** Frame the box shows (Bowser's shadow has risen). */
export const BOX_AT = BOWSER_AT + BOWSER_RISE;

/**
 * The tutorial's tease (owner brief, 0.5.0): the level stands still while a dark silhouette of a
 * brainwashed hero dashes past Mario and off the right of the screen; then the sky dims, Bowser's
 * shadow rises over it and laughs. Skippable as the cards are (OK, BACK or MENU after the card
 * guard); once Bowser's box shows it stays until one of them is pressed (text never moves by
 * itself, owner note 4). Drawn over the frozen level (translucent).
 *
 * Outside the campaign only since 0.4.23: the campaign plays Bowser's spell in its place
 * (story/bowser-spell.ts, docs/STORY.md 2.2).
 */
export class ShadowTeaseScene implements Scene {
  readonly translucent = true;
  private t = 0;
  private done = false;
  private readonly pose: Player;
  private x: number;
  private readonly feet: number;

  constructor(
    private readonly game: Game,
    private readonly world: World,
    hero: CharacterDef,
    private readonly next: () => void,
  ) {
    this.pose = new Player(0, 0, hero, 'small', 0);
    this.pose.anim = 'walk';
    this.pose.facing = 1;
    const p = world.player;
    // From the left edge of the screen, along the ground Mario stands on.
    this.x = -24;
    this.feet = toPx(p.body.y + p.body.h);
  }

  enter(): void {
    this.game.ctx.audio.stopMusic();
    this.game.deps.announcer?.say('A shadowy hero dashes past and is gone.');
  }

  /** SKIP while the shadow runs; once Bowser's box is up (it waits for a key) OK, as its prompt says. */
  touchLabels(): TouchLabels {
    if (this.t <= CARD_GUARD_FRAMES) return NO_TOUCH_BUTTONS;
    if (this.t < BOX_AT) return { ...NO_TOUCH_BUTTONS, jump: 'SKIP' };
    return { ...NO_TOUCH_BUTTONS, jump: 'OK' };
  }

  update(_input: InputFrame, inputs: InputFrame[]): void {
    if (this.done) return;
    this.t++;
    const p = this.world.player;
    // Mario turns to watch it go by (screen x, like the shadow's).
    p.facing = this.x + 8 < toPx(p.centerX) - this.world.camera.pxX ? -1 : 1;
    if (this.x < SCREEN_W + 32) {
      this.x += RUN_SPEED;
      if (this.t % 4 === 0) this.pose.walkFrame = (this.pose.walkFrame + 1) % 3;
    }
    if (this.t === BOWSER_AT) {
      this.game.ctx.audio.sfx('bowser-laugh');
      this.game.deps.announcer?.say(TEASE_LINES.join(' '));
    }
    if (cardContinues(this.t, inputs, ['jump', 'attack', 'start'])) this.finish();
  }

  private finish(): void {
    this.done = true;
    this.world.player.facing = 1;
    this.next();
  }

  render(r: Renderer): void {
    const assets = this.game.ctx.assets;
    // The hero, a black silhouette with a grey rim so it reads against anything.
    if (this.x < SCREEN_W + 16) {
      const s = this.pose.def.sprite(this.pose, this.t, true);
      const rim = assets.sheet(s.sheet, fxPalette(s.palette, 'rim'));
      const dark = assets.sheet(s.sheet, fxPalette(s.palette, 'silhouette'));
      const h = dark.frames.get(s.frame)?.h ?? 16;
      const y = this.feet - h;
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const)
        r.sprite(rim, s.frame, this.x + dx, y + dy, s.flip);
      r.sprite(dark, s.frame, this.x, y, s.flip);
    }
    if (this.t < BOWSER_AT) return;
    // The sky dims and Bowser's shadow rises behind the words.
    const k = Math.min(1, (this.t - BOWSER_AT) / BOWSER_RISE);
    r.rect(0, 0, SCREEN_W, 240, `rgba(0,0,0,${(0.45 * k).toFixed(3)})`);
    const pal = enemyPalette('castle');
    const rim = assets.sheet('enemies', fxPalette(pal, 'rim'));
    const dark = assets.sheet('enemies', fxPalette(pal, 'silhouette'));
    const bx = (SCREEN_W >> 1) - 16;
    const by = Math.round(140 - 40 * k);
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const)
      r.sprite(rim, 'bowser-0', bx + dx, by + dy);
    r.sprite(dark, 'bowser-0', bx, by);
    if (k < 1) return;
    const font = assets.sheet('font');
    const ok = fontText(abilityHint(this.game, 'OK', 'jump'));
    drawPromptBox(r, font, [...TEASE_LINES.flatMap((l) => wrapPrompt(l)), ok]);
  }
}
