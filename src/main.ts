import { FixedLoop } from '@engine/loop';
import { SceneStack } from '@engine/scene';
import { Viewport } from '@engine/viewport';
import { CanvasRenderer } from '@engine/gfx/renderer';
import { InputManager } from '@engine/input/input-manager';
import { KeyboardSource } from '@engine/input/keyboard';
import { GamepadSource } from '@engine/input/gamepad';
import { LevelScene } from '@game/scenes/level';
import { getLevel } from '@content/levels';

function boot(): void {
  const canvas = document.getElementById('screen') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('#screen canvas missing');
  const viewport = new Viewport(canvas);
  const renderer = new CanvasRenderer(viewport.ctx);
  const input = new InputManager(2);
  const keyboard = new KeyboardSource();
  input.addSource('keyboard', keyboard);
  if (GamepadSource.available()) input.addSource('gamepad', new GamepadSource());

  const scenes = new SceneStack();
  let fps = 0;
  let frames = 0;
  let fpsAt = performance.now();
  const params = new URLSearchParams(location.search);
  const levelId = params.get('level') ?? '1-1';
  scenes.push(new LevelScene(getLevel(levelId), { debugKeys: keyboard.down, fps: () => fps }));

  const loop = new FixedLoop({
    step() {
      input.beginFrame();
      scenes.update(input.player(0));
    },
    render() {
      scenes.render(renderer);
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
