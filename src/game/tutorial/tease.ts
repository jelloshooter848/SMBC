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
import type { Action } from '@engine/input/actions';
import { storyOn } from '../story/beats';
import { STORY_TEASE_PAGES } from '../story/script';
import { pageSaid } from '../story/cards';

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
 * In the campaign (story/beats storyOn) Bowser says STORY_TEASE_PAGES instead (docs/STORY.md 2.2),
 * two pages in the same box: OK (or MENU) turns to the second, which OK ends; BACK ends it at
 * once. Neither page turns by itself. A press before the box shows skips to Bowser (a mandatory
 * scene: his words are never skipped unseen). Each page is read out.
 */
export class ShadowTeaseScene implements Scene {
  readonly translucent = true;
  private t = 0;
  private done = false;
  private readonly pose: Player;
  private x: number;
  private readonly feet: number;
  /** The campaign's two pages (STORY_TEASE_PAGES), else null (TEASE_LINES as before). */
  private readonly pages: readonly (readonly string[])[] | null;
  /** The page shown (campaign) and the frame it showed. */
  private page = 0;
  private pageAt = BOX_AT;

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
    this.pages = storyOn(game) ? STORY_TEASE_PAGES : null;
  }

  enter(): void {
    this.game.ctx.audio.stopMusic();
    this.game.deps.announcer?.say('A shadowy hero dashes past and is gone.');
  }

  touchLabels(): TouchLabels {
    return this.t > CARD_GUARD_FRAMES ? { ...NO_TOUCH_BUTTONS, jump: 'SKIP' } : NO_TOUCH_BUTTONS;
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
      this.game.deps.announcer?.say(this.pages ? this.said(0) : TEASE_LINES.join(' '));
    }
    if (this.pages) return this.updatePages(inputs);
    if (cardContinues(this.t, inputs, ['jump', 'attack', 'start'])) this.finish();
  }

  /** What the announcer reads for the campaign's page `i`. */
  private said(i: number): string {
    return pageSaid(this.pages?.[i] ?? [], i === (this.pages?.length ?? 0) - 1);
  }

  /** The campaign's two pages (see the class comment). */
  private updatePages(inputs: InputFrame[]): void {
    const pages = this.pages as readonly (readonly string[])[];
    const any = (keys: readonly Action[]) => inputs.some((i) => keys.some((k) => i.pressed(k)));
    if (this.t < BOX_AT) {
      // Straight on to Bowser: the shadow hero is gone, the laugh plays next frame.
      if (this.t > CARD_GUARD_FRAMES && this.t < BOWSER_AT && any(['jump', 'attack', 'start'])) {
        this.x = SCREEN_W + 32;
        this.t = BOWSER_AT - 1;
      }
      return;
    }
    const since = this.t - this.pageAt;
    if (since > CARD_GUARD_FRAMES && any(['attack'])) return this.finish();
    if (!cardContinues(since, inputs, ['jump', 'start'])) return;
    if (this.page === pages.length - 1) return this.finish();
    this.page++;
    this.pageAt = this.t;
    this.game.deps.announcer?.say(this.said(this.page));
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
    const lines = this.pages?.[this.page] ?? TEASE_LINES;
    drawPromptBox(r, font, [...lines.flatMap((l) => wrapPrompt(l)), ok]);
  }
}
