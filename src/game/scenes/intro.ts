import type { Scene } from '@engine/scene';
import type { Renderer } from '@engine/gfx/renderer';
import type { Game } from './game';

/** The black "WORLD 1-1  × 3" card shown before a level. */
export class IntroScene implements Scene {
  private t = 0;
  constructor(
    private readonly game: Game,
    private readonly next: () => void,
  ) {}

  update(): void {
    if (++this.t >= 120) this.next();
  }

  render(r: Renderer): void {
    r.clear('#000');
    const assets = this.game.ctx.assets;
    const font = assets.sheet('font');
    const s = this.game.state;
    r.text(font, `WORLD ${s.world}-${s.stage}`, 88, 80);
    const c = s.character;
    const sheet = assets.sheet(c.portrait.sheet, c.portrait.palette);
    const f = sheet.frames.get(c.portrait.frame);
    r.sprite(sheet, c.portrait.frame, 96, 112 - (f?.h ?? 16) + 16);
    r.text(font, `×  ${s.lives}`, 120, 120);
  }
}
