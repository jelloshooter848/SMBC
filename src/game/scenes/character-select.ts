import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { Game } from './game';

export class CharacterSelectScene implements Scene {
  private index = 0;
  private index2 = 1;
  private p2 = false;
  private t = 0;
  constructor(private readonly game: Game) {}

  enter(): void {
    this.game.deps.announcer?.say(
      'Select your hero. Left and right to choose, start to begin. Player two: press start to join.',
    );
  }

  update(input: InputFrame, inputs: InputFrame[] = [input]): void {
    this.t++;
    const chars = this.game.deps.characters;
    const n = chars.length;
    const move = (idx: number, f: InputFrame): number => {
      if (f.pressed('left')) {
        this.game.ctx.audio.sfx('select');
        const c = chars[(idx + n - 1) % n];
        if (c) this.game.deps.announcer?.say(c.name);
        return (idx + n - 1) % n;
      }
      if (f.pressed('right')) {
        this.game.ctx.audio.sfx('select');
        const c = chars[(idx + 1) % n];
        if (c) this.game.deps.announcer?.say(c.name);
        return (idx + 1) % n;
      }
      return idx;
    };
    this.index = move(this.index, input);
    const f2 = inputs[1];
    if (f2) {
      if (!this.p2 && f2.pressed('start')) {
        this.p2 = true;
        this.game.ctx.audio.sfx('1up');
        this.game.deps.announcer?.say('Player two joined.');
      } else if (this.p2) {
        this.index2 = move(this.index2, f2);
        if (f2.pressed('select')) this.p2 = false;
      }
    }
    if (this.t > 10 && (input.pressed('start') || input.pressed('jump'))) {
      const c = chars[this.index];
      const c2 = this.p2 ? chars[this.index2] : null;
      if (c) this.game.newGame(c, '1-1', c2 ?? null);
    }
    if (input.pressed('select') || input.pressed('attack')) this.game.showTitle();
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
      if (this.p2 && i === this.index2) r.text(font, '2', x + 12, 112 - h / 2);
    });
    if (this.p2) {
      const c2 = chars[this.index2];
      if (c2) r.text(font, `P2: ${c2.name.toUpperCase()}`, 128 - ((c2.name.length + 4) * 8) / 2, 158);
    } else if ((this.t >> 6) % 2 === 1) r.text(font, 'P2 PRESS START TO JOIN', 40, 158);
    if ((this.t >> 5) % 2 === 0) r.text(font, 'PRESS START', 84, 184);
  }
}
