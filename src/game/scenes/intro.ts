import type { Scene } from '@engine/scene';
import { worldLabel } from '../hud/world-label';
import { drawHud } from '../hud/hud';
import type { Renderer } from '@engine/gfx/renderer';
import type { Game } from './game';
import type { TouchLabels } from '@engine/input/touch';
import { NO_TOUCH_BUTTONS } from '../touch-labels';

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
    r.text(font, `WORLD ${worldLabel(s.world)}-${s.stage}`, 88, 80);
    const c = s.character;
    const sheet = assets.sheet(c.portrait.sheet, c.portrait.palette);
    const f = sheet.frames.get(c.portrait.frame);
    r.sprite(sheet, c.portrait.frame, 96, 112 - (f?.h ?? 16) + 16);
    r.text(font, `×  ${s.lives}`, 120, 120);
  }
}
