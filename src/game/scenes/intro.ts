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

/** The black "WORLD 1-1  × 3" card shown before a level, under the HUD row. */
export class IntroScene implements Scene {
  private t = 0;
  /**
   * `time` is the clock the level will start with, shown in the HUD row across the top as the
   * original does (InformativeBlackScreen adds TopScreenText, and TopScreenText.initiateBlackScreen
   * sets the time to the level's gettimeLeftTot). Null leaves it blank.
   */
  constructor(
    private readonly game: Game,
    private readonly next: () => void,
    private readonly time: number | null = null,
  ) {}

  touchLabels(): TouchLabels {
    return NO_TOUCH_BUTTONS;
  }

  update(): void {
    if (++this.t >= 120) this.next();
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
