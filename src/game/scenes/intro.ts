import type { Scene } from '@engine/scene';
import { worldLabel } from '../hud/world-label';
import { shownPlace, shownStage } from '../map/campaign-order';
import { drawHud } from '../hud/hud';
import type { Renderer } from '@engine/gfx/renderer';
import type { Game } from './game';
import type { TouchLabels } from '@engine/input/touch';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import { drawRulesTag } from '../hud/rules-tag';
import { rulesOf } from '../context';
import { heroFor } from '../characters/registry';
import { shownPortrait } from '../characters/character';
import type { InputFrame } from '@engine/input/input-manager';
import { CARD_GUARD_FRAMES } from './message';

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
    private readonly opts: { frames?: number; skippable?: boolean } = {},
  ) {}

  touchLabels(): TouchLabels {
    return NO_TOUCH_BUTTONS;
  }

  update(_input?: InputFrame, inputs: readonly InputFrame[] = []): void {
    if (this.done) return;
    const t = ++this.t;
    const skip =
      this.opts.skippable === true &&
      t > CARD_GUARD_FRAMES &&
      inputs.some((i) => i.pressed('jump') || i.pressed('attack') || i.pressed('start'));
    if (skip || t >= (this.opts.frames ?? INTRO_FRAMES)) {
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
    drawHud(r, assets, s, this.game.ctx.assist.infiniteTime ? null : this.time, 0, []);
    // A level shown by its name (BOWSER'S CASTLE, never "8-5") has it centred instead.
    const place = shownPlace(s.world, s.stage)?.shown;
    if (place) r.text(font, place, (256 - place.length * 8) >> 1, 80);
    else
      r.text(font, `WORLD ${worldLabel(s.world)}-${shownStage(s.world, s.stage, s.campaignOrder)}`, 88, 80);
    // A Classic run's card shows the Classic hero's art (R1: drawn at the original's sizes).
    const c = shownPortrait(heroFor(s.character, rulesOf(this.game.ctx)));
    const sheet = assets.sheet(c.sheet, c.palette);
    const f = sheet.frames.get(c.frame);
    r.sprite(sheet, c.frame, 96, 112 - (f?.h ?? 16) + 16);
    // Classic Survival shows 1: each hero has one life (Game.cardLives).
    r.text(font, `×  ${this.game.cardLives}`, 120, 120);
    // The Classic rules tag, as the level will show it (TG-32).
    const rules = rulesOf(this.game.ctx);
    const heroes = [s.character, ...(s.character2 ? [s.character2] : [])].map((d) => heroFor(d, rules));
    drawRulesTag(r, assets, rules, heroes);
  }
}
