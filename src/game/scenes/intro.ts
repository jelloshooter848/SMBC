import type { Scene } from '@engine/scene';
import { worldLabel } from '../hud/world-label';
import { shownPlace, shownStage } from '../map/campaign-order';
import { drawHud } from '../hud/hud';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { Game } from './game';
import type { TouchLabels } from '@engine/input/touch';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import { drawRulesTag } from '../hud/rules-tag';
import { rulesOf } from '../context';
import { playedHero } from '../characters/registry';
import { shownPortrait } from '../characters/character';
import type { InputFrame } from '@engine/input/input-manager';
import { CARD_GUARD_FRAMES } from './message';
import { wrapPrompt } from '../tutorial/stage-prompts';
import { fontText } from '../hud/text';

/**
 * Item 142 / 148: the note that a run cannot save to its file, centred from `y` down, 28 columns
 * a line (the WORLD card, the game over, the Quit card), over a `shadow` where the scene shows.
 */
export function drawFileNote(
  r: Renderer,
  font: SpriteSheet,
  note: string,
  y: number,
  shadow?: SpriteSheet,
): void {
  wrapPrompt(fontText(note.toUpperCase()), 28).forEach((l, i) => {
    const x = (256 - l.length * 8) >> 1;
    if (shadow) r.text(shadow, l, x + 1, y + i * 12 + 1);
    r.text(font, l, x, y + i * 12);
  });
}

/** Frames the card stays up: the original's 2000 ms (PRELEVEL_DEFAULT_ALL_CHARS). */
export const INTRO_FRAMES = 120;
/** Single Character keeps the original's longer 2500 ms (DUR_TMR_PRE_LEVEL_DEFAULT). */
export const INTRO_FRAMES_SINGLE = 150;

/**
 * The black "WORLD 1-1  × 3" card shown before a level, under the HUD row. It moves on by itself,
 * as the original's InformativeBlackScreen does: the one written exception to "text never moves
 * on without a press" (owner decision D4, G-090; docs/ACCESSIBILITY.md). It is announced, and in
 * a Classic run (`opts.skippable`) a fresh JUMP, ATTACK or START press skips it.
 */
export class IntroScene implements Scene {
  private t = 0;
  private done = false;
  /**
   * `time` is the clock the level will start with, shown in the HUD row across the top as the
   * original does (InformativeBlackScreen adds TopScreenText, and TopScreenText.initiateBlackScreen
   * sets the time to the level's gettimeLeftTot). Null leaves it blank.
   */
  constructor(
    private readonly game: Game,
    private readonly next: () => void,
    private readonly time: number | null = null,
    private readonly opts: { frames?: number; skippable?: boolean; note?: string } = {},
  ) {}

  /**
   * Item 142: a note on the card (a file the run cannot save to): the card then waits for a
   * press, as any text does (the timer moves only a card with nothing else to read).
   */
  private get waits(): boolean {
    return !!this.opts.note;
  }

  /** A Classic run's card: a SKIP button once the guard is over (G-090, D4: a press skips it). */
  touchLabels(): TouchLabels {
    if (this.t <= CARD_GUARD_FRAMES) return NO_TOUCH_BUTTONS;
    if (this.waits) return { ...NO_TOUCH_BUTTONS, jump: 'OK' };
    return this.opts.skippable === true ? { ...NO_TOUCH_BUTTONS, jump: 'SKIP' } : NO_TOUCH_BUTTONS;
  }

  update(_input?: InputFrame, inputs: readonly InputFrame[] = []): void {
    if (this.done) return;
    const t = ++this.t;
    const skip =
      (this.opts.skippable === true || this.waits) &&
      t > CARD_GUARD_FRAMES &&
      inputs.some((i) => i.pressed('jump') || i.pressed('attack') || i.pressed('start'));
    if (skip || (!this.waits && t >= (this.opts.frames ?? INTRO_FRAMES))) {
      this.done = true;
      this.next();
    }
  }

  render(r: Renderer): void {
    r.clear('#000');
    const assets = this.game.ctx.assets;
    const font = assets.sheet('font');
    const s = this.game.state;
    // initiateBlackScreen hides the time's digits with the infinite-time cheat.
    drawHud(r, assets, s, this.game.ctx.assist.infiniteTime ? null : this.time, 0, [], {
      classic: this.game.classicRun,
    });
    // A level shown by its name (BOWSER'S CASTLE, never "8-5") has it centred instead.
    const place = shownPlace(s.world, s.stage)?.shown;
    if (place) r.text(font, place, (256 - place.length * 8) >> 1, 80);
    else
      r.text(font, `WORLD ${worldLabel(s.world)}-${shownStage(s.world, s.stage, s.campaignOrder)}`, 88, 80);
    // A Classic run's card shows the Classic hero's art (R1: drawn at the original's sizes).
    const c = shownPortrait(playedHero(this.game.ctx, s.character, rulesOf(this.game.ctx)));
    const sheet = assets.sheet(c.sheet, c.palette);
    const f = sheet.frames.get(c.frame);
    r.sprite(sheet, c.frame, 96, 112 - (f?.h ?? 16) + 16);
    // Classic Survival shows 1: each hero has one life (Game.cardLives); a replay none (143).
    const lives = this.game.cardLives;
    if (lives !== null) r.text(font, `×  ${lives}`, 120, 120);
    // Item 142: the note, under the hero.
    if (this.opts.note) drawFileNote(r, font, this.opts.note, 156);
    // The Classic rules tag, as the level will show it (TG-32).
    const rules = rulesOf(this.game.ctx);
    const heroes = [s.character, ...(s.character2 ? [s.character2] : [])].map((d) =>
      playedHero(this.game.ctx, d, rules),
    );
    drawRulesTag(r, assets, rules, heroes);
  }
}
