import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { TouchLabels } from '@engine/input/touch';
import { SCREEN_W } from '@engine/viewport';
import type { Game } from '../../scenes/game';
import { MenuScene } from '../../scenes/menu';
import { NO_TOUCH_BUTTONS } from '../../touch-labels';
import type { MiniGameResult } from '../types';
import { TopDownWorld, type TdEvent } from '../../topdown/world';
import { renderWorld } from '../../topdown/render';
import { drawTdHud, hudData } from '../../topdown/hud';
import { DEFAULT_SHEETS, fontOf, sheetLookup, type TdView } from '../../topdown/view';
import { Keeper } from './keeper';
import { keepDungeon } from './dungeon';

/** The keep's fixed seed: every round plays the same way for the same inputs. */
export const KEEP_SEED = 0x11c4;
/** Frames the wake-up line stays on screen (Link can already move). */
export const INTRO_FRAMES = 200;
/** Frames of "THE SPELL BREAKS!" before the round passes. */
export const WIN_FRAMES = 150;
/** Frames after the death spin and puff before the round fails. */
export const FAIL_DELAY = 30;
/** Frames a short banner (the keeper's name) stays up. */
const BANNER_FRAMES = 100;

export const INTRO_LINES = ['LINK... WAKE UP...', 'THE SPELL HOLDS YOU HERE'] as const;

export type KeepPhase = 'play' | 'dying' | 'won' | 'over';

export interface KeepOptions {
  seed?: number;
}

/**
 * Link's mini game, "Escape the Shadow Keep": a small Zelda-style dungeon (dungeon.ts) on the
 * top-down kit (src/game/topdown). Link walks it room by room with sword and shield, solves the
 * block and switch rooms, takes the key to the locked door, beats the keeper (keeper.ts) and
 * walks into the shining exit: pass. Losing every heart: fail, after the death spin. The menu
 * offers Continue / Give up (quit). The world has its own hearts and keys, so the campaign's
 * GameState is never touched.
 */
export class ShadowKeepScene implements Scene {
  readonly world: TopDownWorld;
  phase: KeepPhase = 'play';
  /** Frames since the scene started. */
  t = 0;
  private endT = 0;
  private banner: { lines: readonly string[]; until: number } | null = null;
  private music: string | null = null;
  private readonly view: TdView;
  private readonly sheet: (id: string, palette?: string) => SpriteSheet | null;

  constructor(
    private readonly game: Game,
    private readonly done: (result: MiniGameResult) => void,
    opts: KeepOptions = {},
  ) {
    this.world = new TopDownWorld(keepDungeon(), {
      seed: opts.seed ?? KEEP_SEED,
      spawners: { keeper: (_w, s) => new Keeper(s.x, s.y) },
    });
    this.world.events.length = 0; // the first room's arrival is announced in enter()
    this.sheet = sheetLookup(game.ctx.assets);
    const world = this.world;
    const sheet = this.sheet;
    this.view = {
      get frame() {
        return world.frame;
      },
      reduceFlashing: game.ctx.reduceFlashing,
      sheets: DEFAULT_SHEETS,
      sheet,
    };
  }

  enter(): void {
    this.game.ctx.audio.stopMusic();
    this.updateMusic();
    this.banner = { lines: INTRO_LINES, until: INTRO_FRAMES };
    this.say(`Escape the Shadow Keep. ${this.world.room.def.hint ?? ''}`.trim());
  }

  touchLabels(): TouchLabels {
    if (this.phase !== 'play') return { ...NO_TOUCH_BUTTONS };
    return { jump: null, attack: 'SWORD', special: null, start: 'MENU', select: null };
  }

  private say(text: string): void {
    this.game.deps.announcer?.say(text);
  }

  private sfx(id: string): void {
    this.game.ctx.audio.sfx(id);
  }

  /** The room's music: the keeper's loop while it lives, the dungeon loop everywhere else. */
  private updateMusic(): void {
    if (this.phase !== 'play') return;
    const room = this.world.room;
    const boss = room.def.music === 'keeper' && !this.world.state().met.has('clear');
    const want = boss ? 'keeper' : 'dungeon';
    if (want === this.music) return;
    this.music = want;
    this.game.ctx.audio.playMusic(want);
  }

  update(input: InputFrame): void {
    if (this.phase === 'over') return;
    if (this.phase === 'play' && input.pressed('start')) {
      this.game.scenes.push(new KeepMenuScene(this.game, () => this.finish('quit')));
      return;
    }
    this.t++;
    if (this.phase === 'won') {
      if (++this.endT >= WIN_FRAMES) this.finish('pass');
      return;
    }
    this.world.update(input);
    for (const e of this.world.events.splice(0)) this.onEvent(e);
    if (this.phase === 'dying' && this.world.hero.dead && ++this.endT >= FAIL_DELAY) this.finish('fail');
  }

  private onEvent(e: TdEvent): void {
    const world = this.world;
    switch (e.type) {
      case 'sword':
        return this.sfx('sword-stab');
      case 'hit':
        return this.sfx('hurt-enemy');
      case 'kill':
        this.sfx('kick');
        if (e.kind === 'keeper') {
          this.sfx('secret');
          this.say('The keeper falls! The way out is open.');
          this.updateMusic(); // back to the dungeon loop
        }
        return;
      case 'hurt':
        return this.sfx('hit');
      case 'block':
      case 'switch':
        return this.sfx('bump');
      case 'cast':
        return this.sfx('magic');
      case 'pickup':
        if (e.kind === 'key') {
          this.sfx('key-get');
          this.say('Got a key!');
        } else if (e.kind === 'heart-container') {
          this.sfx('powerup');
          this.say('Hearts refilled.');
        } else this.sfx('pickup');
        return;
      case 'unlock':
        this.sfx('door-open');
        return this.say('The key opens the door.');
      case 'met': {
        const def = world.room.def;
        if (e.cond === def.shutters || e.cond === def.reveal) this.sfx('secret');
        return;
      }
      case 'shutters':
        this.sfx('door-open');
        return this.say(e.open ? 'The doors open.' : 'The doors slam shut!');
      case 'reveal':
        return this.say(
          world.room.spawns.some((s) => s.kind === 'key') ? 'A key appears!' : 'Something appears!',
        );
      case 'room':
        if (e.first && world.room.def.hint) this.say(world.room.def.hint);
        this.banner = null;
        return this.updateMusic();
      case 'keeper-wakes':
        this.banner = { lines: ['THE KEEPER'], until: this.t + BANNER_FRAMES };
        this.updateMusic();
        return;
      case 'dying':
        this.phase = 'dying';
        this.endT = 0;
        this.music = null;
        this.game.ctx.audio.stopMusic();
        this.say('Link fell.'); // the flow asks "Try again?"
        return;
      case 'exit':
        this.phase = 'won';
        this.endT = 0;
        this.music = null;
        this.game.ctx.audio.stopMusic();
        this.sfx('secret');
        this.banner = { lines: ['THE SPELL BREAKS!'], until: Infinity };
        this.say('The spell breaks! Link is free.');
        return;
    }
  }

  /** The round is over: report it once. */
  private finish(result: MiniGameResult): void {
    if (this.phase === 'over') return;
    this.phase = 'over';
    this.game.ctx.audio.stopMusic();
    this.done(result);
  }

  render(r: Renderer): void {
    r.clear('#000000');
    renderWorld(r, this.view, this.world);
    drawTdHud(r, this.view, hudData(this.world, 'SHADOW KEEP', { label: 'SWORD', frame: 'sword-icon' }));
    if (this.banner && this.t < this.banner.until) drawBanner(r, fontOf(this.view), this.banner.lines, 112);
  }
}

/** Lines of the bitmap font on a dark band, centred, the first at `y`. */
export function drawBanner(r: Renderer, font: SpriteSheet, lines: readonly string[], y: number): void {
  const w = Math.max(...lines.map((l) => l.length)) * 8;
  r.rect(((SCREEN_W - w) >> 1) - 8, y - 6, w + 16, lines.length * 12 + 8, 'rgba(0,0,0,0.75)');
  lines.forEach((l, i) => r.text(font, l, (SCREEN_W - l.length * 8) >> 1, y + i * 12));
}

/** The keep's own menu: Continue, or Give up (ends the round as 'quit'). Pauses the music. */
export class KeepMenuScene extends MenuScene {
  constructor(game: Game, giveUp: () => void) {
    super(
      game,
      'SHADOW KEEP',
      [
        { label: 'Continue', select: () => game.scenes.pop() },
        {
          label: 'Give up',
          select: () => {
            game.scenes.pop();
            giveUp();
          },
          hint: 'Link stays under the spell for now; you can try the keep again later',
        },
      ],
      () => game.scenes.pop(),
      true,
    );
  }

  override enter(): void {
    this.game.ctx.audio.sfx('pause');
    this.game.ctx.audio.pause();
    super.enter();
  }

  exit(): void {
    this.game.ctx.audio.resume();
  }
}
