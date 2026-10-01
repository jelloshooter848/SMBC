import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import { px } from '@engine/math/units';
import type { LevelData } from '../level/schema';
import { World } from '../world/world';
import { DebugOverlay } from './debug-overlay';

export interface LevelSceneDeps {
  /** Raw key codes currently down, for debug hotkeys (not part of the action mapping). */
  debugKeys?: ReadonlySet<string>;
  fps?: () => number;
}

export class LevelScene implements Scene {
  world: World;
  readonly debug = new DebugOverlay();
  private lastDebugToggle = { f1: false, f2: false };

  constructor(
    readonly level: LevelData,
    private readonly deps: LevelSceneDeps = {},
  ) {
    this.world = new World(level);
  }

  update(input: InputFrame): void {
    this.handleDebugKeys();
    if (this.debug.freeCamera) {
      const keys = this.deps.debugKeys;
      const step = keys?.has('ShiftLeft') ? px(16) : px(4);
      if (keys?.has('ArrowLeft')) this.world.camera.x = Math.max(0, this.world.camera.x - step);
      if (keys?.has('ArrowRight'))
        this.world.camera.x = Math.min(this.world.camera.maxX, this.world.camera.x + step);
      return;
    }
    this.world.update(input);
    if (this.world.playerFell) this.world = new World(this.level);
  }

  private handleDebugKeys(): void {
    const keys = this.deps.debugKeys;
    if (!keys) return;
    const f1 = keys.has('F1');
    const f2 = keys.has('F2');
    if (f1 && !this.lastDebugToggle.f1) this.debug.enabled = !this.debug.enabled;
    if (f2 && !this.lastDebugToggle.f2) {
      this.debug.freeCamera = !this.debug.freeCamera;
      if (this.debug.freeCamera) this.debug.enabled = true;
    }
    this.lastDebugToggle = { f1, f2 };
  }

  render(r: Renderer): void {
    this.world.render(r);
    this.debug.render(r, this.world, this.deps.fps?.() ?? 0);
  }
}
