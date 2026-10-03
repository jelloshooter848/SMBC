import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import { px } from '@engine/math/units';
import type { LevelData } from '../level/schema';
import { World, type WorldStart } from '../world/world';
import { DebugOverlay } from './debug-overlay';
import { drawHud } from '../hud/hud';
import type { Game } from './game';
import { PauseScene } from './pause';

export type LevelStart = WorldStart;

export class LevelScene implements Scene {
  world: World;
  readonly debug = new DebugOverlay();
  private lastDebugToggle = { f1: false, f2: false };
  private started = false;

  constructor(
    private readonly game: Game,
    readonly level: LevelData,
    start: LevelStart,
  ) {
    this.world = new World(level, game.ctx, game.state, start);
  }

  enter(): void {
    const music =
      this.game.state.character.music && this.level.theme === 'overworld'
        ? this.game.state.character.music
        : this.level.music;
    this.game.ctx.audio.setTempoScale(this.world.time !== null && this.world.time <= 100 ? 1.4 : 1);
    this.game.ctx.audio.playMusic(music);
    this.started = true;
  }

  update(input: InputFrame, inputs: InputFrame[] = [input]): void {
    this.handleDebugKeys();
    if (this.debug.freeCamera) {
      const keys = this.game.deps.debugKeys;
      const step = keys?.has('ShiftLeft') ? px(16) : px(4);
      if (keys?.has('ArrowLeft')) this.world.camera.x = Math.max(0, this.world.camera.x - step);
      if (keys?.has('ArrowRight'))
        this.world.camera.x = Math.min(this.world.camera.maxX, this.world.camera.x + step);
      return;
    }
    if (inputs.some((f) => f.pressed('start')) && this.world.activePlayers().length > 0 && this.started) {
      this.game.scenes.push(new PauseScene(this.game));
      return;
    }
    this.world.camera.allowLeftScroll = this.game.ctx.assist.allowLeftScroll; // dev assists can change mid-level
    this.world.update(inputs);
    this.syncState();
    for (const ev of this.world.events.splice(0)) this.handle(ev);
  }

  /** Mirror the player's power state into the carried game state. */
  private syncState(): void {
    const s = this.game.state;
    const p = this.world.player;
    s.powerState = p.powerState;
    s.hp = p.hp;
    const p2 = this.world.players[1];
    if (p2) {
      s.powerState2 = p2.powerState;
      s.hp2 = p2.hp;
    }
    s.time = this.world.time;
  }

  private handle(ev: ReturnType<World['events']['splice']>[number]): void {
    const game = this.game;
    switch (ev.type) {
      case 'checkpoint':
        game.state.checkpoint = { level: this.level.id, x: ev.x };
        break;
      case 'pipe': {
        const target = game.deps.getLevel(ev.target.level);
        const exitDir = ev.target.exitDir ?? 'none';
        const start: LevelStart = {
          x: ev.target.x,
          y: ev.target.y,
          mode: exitDir === 'up' ? 'pipe-exit' : target.startMode,
        };
        if (target.time === null) game.state.time = this.world.time;
        game.startLevel(target, start);
        break;
      }
      case 'exit':
        game.state.checkpoint = null;
        game.state.time = null;
        if (game.playtestDone) game.playtestDone();
        else if (ev.next === 'end') game.showTitle();
        else game.goToLevel(ev.next, { mode: 'stand' });
        break;
      case 'died': {
        if (game.playtestDone) {
          game.playtestDone();
          return;
        }
        const s = game.state;
        s.powerState = s.character.damage.kind === 'powerup' ? 'small' : 'full';
        s.hp = s.character.damage.kind === 'hp' ? s.character.damage.max : 0;
        if (s.character2) {
          s.powerState2 = s.character2.damage.kind === 'powerup' ? 'small' : 'full';
          s.hp2 = s.character2.damage.kind === 'hp' ? s.character2.damage.max : 0;
        }
        s.time = null;
        if (!game.ctx.assist.infiniteLives) s.lives--;
        if (s.lives <= 0) {
          s.lives = 0;
          game.gameOver();
          return;
        }
        // Respawn at the checkpoint if one was reached, else at the start of the main level.
        const cp = s.checkpoint;
        const mainLevel = cp?.level ?? this.level.parent ?? this.level.id;
        const start: LevelStart = cp ? { x: cp.x, y: 12, mode: 'stand' } : { mode: 'stand' };
        game.goToLevel(mainLevel, start);
        break;
      }
    }
  }

  private handleDebugKeys(): void {
    const keys = this.game.deps.debugKeys;
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
    drawHud(r, this.game.ctx.assets, this.game.state, this.world.time, this.world.frame, this.world.players);
    this.debug.render(r, this.world, this.game.deps.fps?.() ?? 0);
  }
}
