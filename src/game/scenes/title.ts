import type { Renderer } from '@engine/gfx/renderer';
import type { InputFrame } from '@engine/input/input-manager';
import { MenuScene, type MenuItem } from './menu';
import { OptionsScene } from './options';
import { FileSelectScene } from './file-select';
import { CheatCode, DEV_CODE } from './cheat';
import type { Game } from './game';

export class TitleScene extends MenuScene {
  private readonly cheat = new CheatCode(DEV_CODE);
  private unlockedFlash = 0;

  constructor(game: Game) {
    super(game, '', [], null);
    this.rebuild();
  }

  private rebuild(): void {
    const game = this.game;
    const items: MenuItem[] = [
      { label: 'Start game', select: () => game.scenes.replace(new FileSelectScene(game)) },
      { label: 'Custom levels', select: () => game.showCustomLevels() },
      {
        label: 'Options',
        select: () => game.scenes.push(new OptionsScene(game, () => game.scenes.pop())),
        hint: 'Settings, how to play and the level editor',
      },
    ];
    if (game.devMode) items.push({ label: 'Dev mode', select: () => game.showDevMenu() });
    this.setItems(items);
  }

  override enter(): void {
    this.game.ctx.audio.playMusic('title');
    this.rebuild();
    super.enter();
  }

  override update(input: InputFrame): void {
    if (this.unlockedFlash > 0) this.unlockedFlash--;
    if (this.cheat.feed(input)) {
      const s = this.game.deps.settings;
      if (s && !s.dev) {
        s.dev = true;
        this.game.deps.applySettings?.();
      }
      this.rebuild();
      this.index = this.items.length - 1; // land on the new Dev mode entry
      this.unlockedFlash = 120;
      this.game.ctx.audio.sfx('1up');
      this.game.deps.announcer?.say('Developer mode unlocked.');
      return; // the final press of the code must not also activate a menu item
    }
    super.update(input);
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
      const y = 120 + i * 12;
      if (i === this.index && (this.t >> 4) % 2 === 0) r.text(font, '>', 76, y);
      r.text(font, it.label.toUpperCase(), 88, y);
    });
    r.text(font, 'ORIGINAL ART AND MUSIC', 40, 184);
    r.text(font, 'NOT AFFILIATED WITH NINTENDO', 16, 196);
    const version = `V${__APP_VERSION__}`.toUpperCase();
    r.text(font, version, 252 - version.length * 8, 226);
    if (this.game.devMode) r.text(font, 'DEV', 4, 226);
    if (this.unlockedFlash > 0 && (this.unlockedFlash >> 3) % 2 === 0)
      r.text(font, 'DEV MODE UNLOCKED', 60, 214);
  }
}
