import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { Game } from './game';

export class CharacterSelectScene implements Scene {
  private index = 0;
  private t = 0;
  constructor(private readonly game: Game) {}

  update(input: InputFrame): void {
    this.t++;
    const n = this.game.deps.characters.length;
    if (input.pressed('left')) {
      this.index = (this.index + n - 1) % n;
      this.game.ctx.audio.sfx('select');
    }
    if (input.pressed('right')) {
      this.index = (this.index + 1) % n;
      this.game.ctx.audio.sfx('select');
    }
    if (input.pressed('start') || input.pressed('jump')) {
      const c = this.game.deps.characters[this.index];
      if (c) this.game.newGame(c);
    }
    if (input.pressed('select')) this.game.showTitle();
  }

  render(r: Renderer): void {
    r.clear('#000');
    const assets = this.game.ctx.assets;
    const font = assets.sheet('font');
    r.text(font, 'SELECT YOUR HERO', 64, 32);
    const chars = this.game.deps.characters;
    const spacing = Math.min(64, 224 / Math.max(1, chars.length));
    const x0 = 128 - ((chars.length - 1) * spacing) / 2;
    chars.forEach((c, i) => {
      const x = Math.round(x0 + i * spacing);
      const sheet = assets.sheet(c.portrait.sheet, c.portrait.palette);
      const f = sheet.frames.get(c.portrait.frame);
      const h = f?.h ?? 32;
      r.sprite(sheet, c.portrait.frame, x - 8, 120 - h);
      if (i === this.index) {
        r.text(font, '>', x - 20, 112 - h / 2);
        r.text(font, c.name.toUpperCase(), 128 - (c.name.length * 8) / 2, 144);
      }
    });
    if ((this.t >> 5) % 2 === 0) r.text(font, 'PRESS START', 84, 184);
  }
}
