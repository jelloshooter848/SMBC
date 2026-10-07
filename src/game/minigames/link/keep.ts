import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { TouchLabels } from '@engine/input/touch';
import { SCREEN_W } from '@engine/viewport';
import { abilityHint } from '../../scenes/hints';
import type { Game } from '../../scenes/game';
import { MiniGameMenuScene } from '../menu';
import { NO_TOUCH_BUTTONS } from '../../touch-labels';
import type { MiniGameResult } from '../types';
import { TopDownWorld, type TdEvent } from '../../topdown/world';
import { renderWorld } from '../../topdown/render';
import { drawTdHud, hudData } from '../../topdown/hud';
import { DEFAULT_SHEETS, fontOf, sheetLookup, type TdView } from '../../topdown/view';
import { HUD_H, TILE } from '../../topdown/geometry';
import { Pickup } from '../../topdown/entity';
import { DEFAULT_ITEMS } from '../../topdown/items';
import { Keeper } from './keeper';
import { keepDungeon } from './dungeon';

/** The keep's fixed seed: every round plays the same way for the same inputs. */
export const KEEP_SEED = 0x11c4;
/** The keep's number on the HUD ("LEVEL-1" over the map, as a Zelda dungeon's). */
export const KEEP_LEVEL = 1;
/** Frames the wake-up line stays on screen (Link can already move). */
export const INTRO_FRAMES = 200;
/**
 * Frames Link holds the Triforce up (its fanfare, 'triforce-get', plays meanwhile, with "THE
 * SPELL BREAKS!" over it) before the round passes.
 */
export const WIN_FRAMES = 300;
/** Frames after the death spin and puff before the round fails. */
export const FAIL_DELAY = 30;
/** Frames a chest's banner (what Link found and how to use it) stays up. */
export const ITEM_BANNER_FRAMES = 150;
/** Screen y of the intro line. */
const INTRO_Y = 112;

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
  private banner: { lines: readonly string[]; until: number; y: number } | null = null;
  private music: string | null = null;
  private readonly view: TdView;
  private readonly sheet: (id: string, palette?: string) => SpriteSheet | null;

  constructor(
    private readonly game: Game,
    private readonly done: (result: MiniGameResult) => void,
    opts: KeepOptions = {},
  ) {
    // Link starts with only his sword; the shield is in the secret shrine. The no-damage assist
    // (dev mode) is read each time he is hurt, so turning it on mid-round counts at once.
    this.world = new TopDownWorld(keepDungeon(), {
      seed: opts.seed ?? KEEP_SEED,
      spawners: {
        keeper: (_w, s) => new Keeper(s.x, s.y),
        // The shard, centred between its tile and the one to its left (the room's middle).
        triforce: (w, s) =>
          w.state().taken.has(`${s.col},${s.row}`) ? null : new Pickup(s.x - TILE / 2, s.y, 'triforce'),
      },
      items: DEFAULT_ITEMS,
      shield: false,
      swordBeam: true,
      noDamage: () => game.ctx.assist.invulnerable,
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
    this.banner = { lines: INTRO_LINES, until: INTRO_FRAMES, y: INTRO_Y };
    this.say(`Escape the Shadow Keep. ${this.world.room.def.hint ?? ''}`.trim());
  }

  /**
   * SWORD, the item in the slot by name while it can be used (none left, or the boomerang still
   * out: hidden), ITEM to switch once there are two, and MENU.
   */
  touchLabels(): TouchLabels {
    if (this.phase !== 'play') return { ...NO_TOUCH_BUTTONS };
    const w = this.world;
    const item = w.itemUsable() ? (w.inv.current?.label ?? null) : null;
    const select = w.inv.owned.length >= 2 ? 'ITEM' : null;
    return { jump: null, attack: 'SWORD', special: item, start: 'MENU', select };
  }

  /** The banner and announcement for a chest's prize: what it is and how to use it. */
  private gotItem(what: string): void {
    const game = this.game;
    const item = this.world.items[what];
    let lines: string[];
    let said: string;
    if (item) {
      const verb = what === 'bomb' ? 'SET ONE DOWN' : 'THROW';
      lines = [`YOU GOT THE ${item.label}!`, `${abilityHint(game, item.label, 'special')}: ${verb}`];
      said = `You got the ${item.label.toLowerCase()}! ${abilityHint(game, item.label, 'special')} uses it.`;
      if (this.world.inv.owned.length >= 2) {
        lines.push(`${abilityHint(game, 'ITEM', 'select')}: SWITCH`);
        said += ` ${abilityHint(game, 'ITEM', 'select')} switches items.`;
      }
      if (what === 'bomb') said += ' Bombs can open cracked walls.';
    } else if (what === 'shield') {
      lines = ['YOU GOT THE SHIELD!', 'FACE ROCKS AND SPELLS TO BLOCK', 'MONSTERS HURT YOU LESS'];
      said = 'You got the magic shield! Face rocks and spells to block them, and monsters hurt you less.';
    } else return;
    const y = this.world.hero.y > 88 ? HUD_H + 16 : HUD_H + 120;
    this.banner = { lines, until: this.t + ITEM_BANNER_FRAMES, y };
    this.say(said);
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
      case 'beam':
        return this.sfx('sword-beam');
      case 'hit':
        return this.sfx('hurt-enemy');
      case 'kill':
        this.sfx('kick');
        if (e.kind === 'keeper') {
          this.sfx('secret');
          this.say('The keeper falls! The north door opens.');
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
          this.say('A heart container! One more heart, and every heart refilled.');
        } else if (e.kind === 'refill') {
          this.sfx('powerup');
          this.say('Hearts refilled.');
        } else if (e.kind === 'bombs') {
          this.sfx('pickup');
          this.say(`Bombs! ${world.inv.count('bomb')}`);
        } else if (e.kind === 'map') {
          this.sfx('key-get');
          this.say('The map! Every room of the keep is on it.');
        } else if (e.kind === 'compass') {
          this.sfx('key-get');
          this.say('The compass! It marks where the Triforce lies.');
        } else if (e.kind === 'triforce') this.win();
        else if (e.kind === 'heart') this.sfx('pickup');
        return; // a chest's prize has its own fanfare
      case 'chest':
        this.sfx('item-get');
        this.gotItem(String(e.item));
        return;
      case 'item-select':
        this.sfx('select');
        return this.say(world.inv.current?.label ?? '');
      case 'whirr':
        return this.sfx('boomerang');
      case 'fuse':
        return this.sfx('bomb-fuse');
      case 'blast':
        return this.sfx('bomb-blast');
      case 'stun':
        return this.sfx('bump');
      case 'secret':
        this.sfx('secret');
        return this.say('The cracked wall breaks open!');
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
        return this.say(revealLine(world.room.spawns.map((s) => s.kind)));
      case 'room':
        if (e.first && world.room.def.hint) this.say(world.room.def.hint);
        this.banner = null;
        return this.updateMusic();
      case 'keeper-wakes':
        // No name on screen (a Zelda boss has none): its music says it is awake.
        this.updateMusic();
        return;
      case 'dying':
        this.phase = 'dying';
        this.endT = 0;
        this.music = null;
        this.game.ctx.audio.stopMusic();
        this.say('Link fell.'); // the flow asks "Try again?"
        return;
    }
  }

  /**
   * The Triforce is Link's: he holds it up over his head with both hands to its fanfare, every
   * heart refilled, as in Zelda (no flash: the room stays as it is), then the round passes.
   */
  private win(): void {
    const w = this.world;
    this.phase = 'won';
    this.endT = 0;
    this.music = null;
    w.hero.heal(w.hero.maxHp);
    w.hero.holdUp('triforce');
    this.game.ctx.audio.stopMusic();
    this.game.ctx.audio.playMusic('triforce-get');
    // A round for fun (Game.inRound) frees nobody: no word of the spell.
    if (this.game.inRound) {
      this.banner = { lines: ['YOU GOT THE TRIFORCE!'], until: Infinity, y: HUD_H + 16 };
      this.say('Link holds up the Triforce! He escaped the Shadow Keep.');
    } else {
      this.banner = { lines: ['THE SPELL BREAKS!'], until: Infinity, y: HUD_H + 16 };
      this.say('Link holds up the Triforce! The spell breaks. Link is free.');
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
    // Zelda's HUD: the level over the map, and the B box (the item in the slot) beside the A
    // box (the sword). B and A are the HUD's own art here, never instruction text (owner's call).
    const item = this.world.inv.current;
    drawTdHud(
      r,
      this.view,
      hudData(this.world, `LEVEL-${KEEP_LEVEL}`, [
        { label: 'B', frame: item?.icon ?? null },
        { label: 'A', frame: 'sword-icon' },
      ]),
    );
    const b = this.banner;
    if (b && this.t < b.until) drawBanner(r, fontOf(this.view), b.lines, b.y);
  }
}

/** What a room's hidden prize is, said as it appears. */
function revealLine(kinds: readonly string[]): string {
  if (kinds.includes('key')) return 'A key appears!';
  if (kinds.includes('heart-container')) return 'A heart container appears!';
  if (kinds.includes('map')) return 'A map appears!';
  if (kinds.includes('compass')) return 'A compass appears!';
  return 'Something appears!';
}

/** Lines of the bitmap font on a dark band, centred, the first at `y`. */
export function drawBanner(r: Renderer, font: SpriteSheet, lines: readonly string[], y: number): void {
  const w = Math.max(...lines.map((l) => l.length)) * 8;
  r.rect(((SCREEN_W - w) >> 1) - 8, y - 6, w + 16, lines.length * 12 + 8, 'rgba(0,0,0,0.75)');
  lines.forEach((l, i) => r.text(font, l, (SCREEN_W - l.length * 8) >> 1, y + i * 12));
}

/**
 * The keep's own menu: Continue, or Give up (ends the round as 'quit'), and in dev mode the
 * assists (No damage keeps Link's hearts). Pauses the music.
 */
export class KeepMenuScene extends MiniGameMenuScene {
  constructor(game: Game, giveUp: () => void) {
    super(
      game,
      'SHADOW KEEP',
      giveUp,
      'Link stays under the spell for now; you can try the keep again later',
    );
  }
}
