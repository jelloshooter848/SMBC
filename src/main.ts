import { FixedLoop } from '@engine/loop';
import { Viewport } from '@engine/viewport';
import { CanvasRenderer } from '@engine/gfx/renderer';
import { InputManager } from '@engine/input/input-manager';
import { KeyboardSource } from '@engine/input/keyboard';
import { GamepadSource } from '@engine/input/gamepad';
import { AssetRegistry } from '@engine/assets/registry';
import { AudioManager } from '@engine/audio/audio-manager';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { songs } from '@content/music/songs';
import { sfx } from '@content/sfx/sfx';
import { Game } from '@game/scenes/game';
import { CHARACTERS } from '@game/characters/registry';
import { DEFAULT_ASSIST } from '@game/context';

function boot(): void {
  const canvas = document.getElementById('screen') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('#screen canvas missing');
  const viewport = new Viewport(canvas);
  const renderer = new CanvasRenderer(viewport.ctx);
  const input = new InputManager(2);
  const keyboard = new KeyboardSource();
  input.addSource('keyboard', keyboard);
  if (GamepadSource.available()) input.addSource('gamepad', new GamepadSource());

  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const audio = new AudioManager();
  audio.registerSongs(songs);
  audio.registerSfx(sfx);
  const unlock = () => audio.unlock();
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('gamepadconnected', unlock);

  let fps = 0;
  let frames = 0;
  let fpsAt = performance.now();
  const game = new Game({
    ctx: { assets, audio, assist: { ...DEFAULT_ASSIST }, reduceFlashing: false },
    getLevel,
    characters: CHARACTERS,
    debugKeys: keyboard.down,
    fps: () => fps,
  });
  const params = new URLSearchParams(location.search);
  const level = params.get('level');
  if (level)
    game.newGame(
      CHARACTERS.find((c) => c.id === params.get('char')) ?? (CHARACTERS[0] as (typeof CHARACTERS)[0]),
      level,
    );
  else game.showTitle();

  const loop = new FixedLoop({
    step() {
      input.beginFrame();
      game.scenes.update(input.player(0));
    },
    render() {
      game.scenes.render(renderer);
      viewport.present();
      frames++;
      const now = performance.now();
      if (now - fpsAt >= 1000) {
        fps = (frames * 1000) / (now - fpsAt);
        frames = 0;
        fpsAt = now;
      }
    },
  });
  loop.start();
}

boot();
