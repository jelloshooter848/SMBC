import type { Renderer } from '@engine/gfx/renderer';
import { MenuScene } from './menu';
import { OptionsScene } from './options';
import type { Game } from './game';

export class TitleScene extends MenuScene {
  constructor(game: Game) {
    super(game, '', [], null);
    this.setItems([
      { label: 'Start game', select: () => game.showCharacterSelect() },
      { label: 'Custom levels', select: () => game.showCustomLevels() },
      { label: 'Level editor', select: () => game.openEditor() },
      { label: 'Options', select: () => game.scenes.push(new OptionsScene(game, () => game.scenes.pop())) },
    ]);
  }

  override enter(): void {
    this.game.ctx.audio.playMusic('title');
    super.enter();
  }

  override render(r: Renderer): void {
    r.clear('#5c94fc');
    const assets = this.game.ctx.assets;
    const font = assets.sheet('font');
    r.rect(0, 208, 256, 32, '#c84c0c');
    r.rect(32, 40, 192, 72, '#000');
    r.rect(34, 42, 188, 68, '#e45c10');
    r.text(font, 'SMB', 48, 52);
    r.text(font, 'CROSSOVER', 48, 68);
    r.text(font, 'FAN REBUILD', 48, 88);
    r.sprite(assets.sheet('mario', 'mario'), 'big-idle', 176, 60);
    r.sprite(assets.sheet('link', 'link'), 'idle', 196, 60);
    this.items.forEach((it, i) => {
      const y = 124 + i * 12;
      if (i === this.index && (this.t >> 4) % 2 === 0) r.text(font, '>', 76, y);
      r.text(font, it.label.toUpperCase(), 88, y);
    });
    r.text(font, 'ORIGINAL ART AND MUSIC', 40, 184);
    r.text(font, 'NOT AFFILIATED WITH NINTENDO', 16, 196);
    const version = `V${__APP_VERSION__}`.toUpperCase();
    r.text(font, version, 252 - version.length * 8, 226);
  }
}
