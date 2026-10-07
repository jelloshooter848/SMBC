import type { Scene } from '@engine/scene';
import { NO_INPUT, type InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { TouchLabels } from '@engine/input/touch';
import { SCREEN_W } from '@engine/viewport';
import type { Game } from '../../scenes/game';
import { abilityHint } from '../../scenes/hints';
import { NO_TOUCH_BUTTONS } from '../../touch-labels';
import { MiniGameMenuScene } from '../menu';
import type { MiniGameResult } from '../types';
import { drawBanner } from '../megaman/scene';
import { renderWorld } from '../../topdown/render';
import { sheetLookup, type TdSheets, type TdView } from '../../topdown/view';
import { HUD_H, type Dir } from '../../topdown/geometry';
import type { TdEvent } from '../../topdown/world';
import {
  BM_MUSIC,
  DUNGEON_TILES,
  FALLBACK_TILES,
  FALLBACK_TILES_PALETTE,
  DUNGEON_TILES_DARK,
  SOPHIA_SHEET,
  fontSheet,
  soundId,
  type BmSound,
} from './art';
import { CUT_SAY, CUTSCENE_FRAMES, drawCutscene } from './cutscene';
import { newUnderworld } from './dungeon';
import { drawBmHud } from './hud';
import type { UnderworldWorld } from './jason';
import { PlutoniumBoss } from './plutonium';

/** Lives for a round (Blaster Master's three). */
export const LIVES = 3;
/** Frames after Jason's death (the spin and the boom) before the next life or GAME OVER. */
export const RESPAWN_DELAY = 30;
/** Frames he blinks, untouchable, after coming back. */
export const RESPAWN_INVULN = 120;
/** GAME OVER shows this long before the round fails. */
export const GAME_OVER_FRAMES = 180;
/** After the Plutonium Boss falls: the banner, the jingle, then the round passes. */
export const WIN_BANNER_AT = 60;
export const WIN_JINGLE = 90;
export const WIN_FRAMES = 330;
/** Frames the dungeon's first banner stays up. */
export const DUNGEON_BANNER_FRAMES = 180;
/** Frames the boss's name stays up. */
export const BOSS_BANNER_FRAMES = 100;
/** The area's name on the HUD. */
export const AREA_TITLE = 'UNDERWORLD';

export type UnderworldPhase = 'cutscene' | 'dungeon' | 'won' | 'lost' | 'over';

export interface UnderworldOptions {
  /** The dungeon's seed (capsule drops). */
  seed?: number;
  /** Start in the dungeon, without the cutscene (tests). */
  skipCutscene?: boolean;
}

/** Where Jason came into the room he is in (a new life starts there). */
interface Entry {
  room: string;
  x: number;
  y: number;
  facing: Dir;
}

/**
 * Sophia's mini game, Underworld: Blaster Master's opening in brief (Fred, the glowing chest and
 * the hole; skippable), then Jason on foot through the gateway into an overhead dungeon on the
 * top-down kit (dungeon.ts, jason.ts, mutants.ts) with the original's GUN meter, grenades and
 * POW, ending with the Plutonium Boss (plutonium.ts). Three lives. Beating the boss passes;
 * losing every life fails (GAME OVER); the menu's Give up quits. Everything lives in the round,
 * so the campaign's state is never touched.
 */
export class UnderworldScene implements Scene {
  readonly td: UnderworldWorld;
  phase: UnderworldPhase = 'cutscene';
  /** Frames since the scene started, and in the current phase. */
  t = 0;
  phaseT = 0;
  lives = LIVES;
  /** The banner on screen: its lines, until when (scene frames), its first line's y. */
  banner: { lines: string[]; until: number; y: number } | null = null;
  /** The cutscene was skipped. */
  skipped = false;
  private music: string | null = null;
  private entry: Entry;
  private deadT = 0;
  private winT = -1;
  private readonly view: TdView;
  private skipText = 'SKIP';

  constructor(
    private readonly game: Game,
    private readonly done: (result: MiniGameResult) => void,
    opts: UnderworldOptions = {},
  ) {
    const assist = game.ctx.assist;
    this.td = newUnderworld({
      ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
      noDamage: () => assist.invulnerable,
    });
    this.td.events.length = 0; // the first room is announced when the dungeon starts
    const h = this.td.hero;
    this.entry = { room: this.td.room.id, x: h.x, y: h.y, facing: h.facing };
    const assets = game.ctx.assets;
    const own = assets.has(DUNGEON_TILES);
    const sheets: TdSheets = {
      tiles: own ? DUNGEON_TILES : FALLBACK_TILES,
      tilesDark: own ? DUNGEON_TILES_DARK : FALLBACK_TILES_PALETTE,
      hero: SOPHIA_SHEET,
      enemies: SOPHIA_SHEET,
    };
    const td = this.td;
    this.view = {
      get frame() {
        return td.frame;
      },
      reduceFlashing: game.ctx.reduceFlashing,
      sheets,
      sheet: sheetLookup(assets),
    };
    if (opts.skipCutscene) this.phase = 'dungeon';
  }

  get jason() {
    return this.td.jason;
  }

  /** The boss, while its room is on screen. */
  get boss(): PlutoniumBoss | null {
    return this.td.entities.find((e): e is PlutoniumBoss => e instanceof PlutoniumBoss) ?? null;
  }

  enter(): void {
    this.game.ctx.audio.stopMusic();
    this.skipText = this.hint('SKIP', 'jump');
    if (this.phase === 'cutscene') {
      this.playMusic(BM_MUSIC.cutscene);
      this.say(`Underworld. ${CUT_SAY} ${this.hint('JUMP', 'jump')} skips.`);
    } else this.startDungeon();
  }

  exit(): void {
    this.game.ctx.audio.setTempoScale(1);
  }

  private say(text: string): void {
    this.game.deps.announcer?.say(text);
  }

  private hint(label: string, action: Parameters<typeof abilityHint>[2]): string {
    return abilityHint(this.game, label, action);
  }

  private sfx(s: BmSound): void {
    this.game.ctx.audio.sfx(soundId(s));
  }

  private playMusic(id: string): void {
    if (this.music === id) return;
    this.music = id;
    this.game.ctx.audio.playMusic(id);
  }

  private stopMusic(): void {
    this.music = null;
    this.game.ctx.audio.stopMusic();
  }

  private setPhase(p: UnderworldPhase): void {
    this.phase = p;
    this.phaseT = 0;
  }

  /** SKIP in the cutscene; SHOOT and GRENADE while Jason is up; MENU while the menu opens. */
  touchLabels(): TouchLabels {
    if (this.phase === 'cutscene') return { ...NO_TOUCH_BUTTONS, jump: 'SKIP', start: 'MENU' };
    if (this.phase !== 'dungeon') return { ...NO_TOUCH_BUTTONS };
    const h = this.td.hero;
    if (h.dying || h.dead) return { ...NO_TOUCH_BUTTONS, start: 'MENU' };
    return { ...NO_TOUCH_BUTTONS, attack: 'SHOOT', special: 'GRENADE', start: 'MENU' };
  }

  private get menuOpens(): boolean {
    return this.phase === 'cutscene' || this.phase === 'dungeon';
  }

  update(input: InputFrame): void {
    if (this.phase === 'over') return;
    if (this.menuOpens && input.pressed('start')) {
      this.game.scenes.push(new UnderworldMenuScene(this.game, () => this.finish('quit')));
      return;
    }
    this.t++;
    this.phaseT++;
    switch (this.phase) {
      case 'cutscene':
        if (input.pressed('jump') || input.pressed('attack')) this.skipped = true;
        if (this.skipped || this.phaseT >= CUTSCENE_FRAMES) {
          input.consumeJumpBuffer();
          this.stopMusic();
          this.setPhase('dungeon');
          this.startDungeon();
        }
        return;
      case 'dungeon':
        return this.updateDungeon(input);
      case 'won':
        return this.updateWon();
      case 'lost':
        if (this.phaseT >= GAME_OVER_FRAMES) this.finish('fail');
        return;
    }
  }

  /* ---------- The dungeon ---------- */

  private startDungeon(): void {
    this.updateMusic();
    this.banner = {
      lines: ['JASON ENTERS THE GATEWAY'],
      until: this.t + DUNGEON_BANNER_FRAMES,
      y: HUD_H + 16,
    };
    const shoot = this.hint('SHOOT', 'attack');
    const grenade = this.hint('GRENADE', 'special');
    this.say(
      `Jason enters the dungeon. ${shoot} fires his gun; every hit he takes lowers the gun a level, and G capsules raise it. ${grenade} throws a grenade. P capsules restore power. Find the Plutonium Boss! ${this.hint('MENU', 'start')} for the menu.`,
    );
  }

  /** The room's music: the boss's while it lives, the dungeon's everywhere else. */
  private updateMusic(): void {
    if (this.phase !== 'dungeon' || this.td.hero.dying) return;
    const boss = this.td.room.def.music === 'boss' && !this.td.state().met.has('clear') && this.td.sealed;
    this.playMusic(boss ? BM_MUSIC.boss : BM_MUSIC.dungeon);
  }

  private updateDungeon(input: InputFrame): void {
    const td = this.td;
    td.update(input);
    for (const e of td.events.splice(0)) this.onEvent(e);
    const h = td.hero;
    if (this.phase === 'dungeon' && h.dead && ++this.deadT >= RESPAWN_DELAY) this.lifeLost();
  }

  private onEvent(e: TdEvent): void {
    const td = this.td;
    switch (e.type) {
      case 'shot':
        return this.sfx('shot');
      case 'toss':
        return this.sfx('toss');
      case 'blast':
        return this.sfx('grenade');
      case 'hit':
        return this.sfx('hit');
      case 'clang':
        return this.sfx('clang');
      case 'spit':
      case 'boss-shot':
      case 'boss-open':
        return this.sfx('enemyShot');
      case 'kill':
        this.sfx('die');
        if (e.kind === 'plutonium') this.bossDown();
        return;
      case 'hurt':
        return this.sfx('hurt');
      case 'gun':
        if (e.up) this.sfx('gunUp');
        this.say(`Gun ${String(e.level)}.`);
        return;
      case 'pickup':
        if (e.kind === 'pow') {
          this.sfx('pow');
          this.say('Power restored.');
        } else this.sfx('capsule');
        return;
      case 'secret':
        this.sfx('secret');
        return this.say('The cracked wall breaks open!');
      case 'shutters':
        this.sfx('door');
        if (!e.open) this.say('The door slams shut behind Jason!');
        return this.updateMusic();
      case 'room':
        this.entry = { room: td.room.id, x: td.hero.x, y: td.hero.y, facing: td.hero.facing };
        if (e.first && td.room.def.hint) this.say(td.room.def.hint);
        if (this.banner && this.banner.until !== Infinity) this.banner = null;
        return this.updateMusic();
      case 'boss-wakes':
        this.banner = { lines: ['PLUTONIUM BOSS'], until: this.t + BOSS_BANNER_FRAMES, y: HUD_H + 120 };
        this.playMusic(BM_MUSIC.boss);
        this.say(
          'The Plutonium Boss! Its core is shut; it glows, then opens with a ring of orbs. Shoot the open core.',
        );
        return;
      case 'boss-break':
        this.say('The shell bursts! The core breaks free and bounces round the room.');
        return;
      case 'boss-boom':
        return this.sfx('bossBoom');
      case 'dying':
        this.deadT = 0;
        this.stopMusic();
        this.sfx('die');
        return;
    }
  }

  /** Jason's spin and boom are over: the next life at the doorway he came in by, or GAME OVER. */
  private lifeLost(): void {
    const infinite = this.game.ctx.assist.infiniteLives;
    if (!infinite) this.lives--;
    if (this.lives <= 0) {
      this.setPhase('lost');
      this.banner = { lines: ['GAME OVER'], until: Infinity, y: 112 };
      this.say('Game over. Try again.');
      return;
    }
    const e = this.entry;
    this.jason.revive(e.x, e.y, RESPAWN_INVULN);
    this.jason.facing = e.facing;
    this.td.warpTo(e.room, e.x, e.y);
    this.td.events.length = 0;
    this.deadT = 0;
    this.updateMusic();
    const left = this.lives - 1;
    this.say(
      infinite
        ? 'Jason is back.'
        : left === 0
          ? 'Jason is down! Last life.'
          : `Jason is down! ${left} ${left === 1 ? 'life' : 'lives'} left.`,
    );
  }

  /* ---------- The end ---------- */

  private bossDown(): void {
    this.setPhase('won');
    this.winT = 0;
    this.stopMusic();
  }

  private updateWon(): void {
    this.td.update(NO_INPUT);
    this.td.events.length = 0;
    this.winT++;
    if (this.winT === WIN_BANNER_AT) {
      // A round for fun (Game.inRound) frees nobody: no word of the spell.
      const fun = this.game.inRound;
      this.banner = {
        lines: fun
          ? ['THE PLUTONIUM BOSS FALLS!']
          : ['THE PLUTONIUM BOSS FALLS!', 'THE SPELL ON SOPHIA BREAKS!'],
        until: Infinity,
        y: HUD_H + 40,
      };
      this.say(fun ? 'The Plutonium Boss falls!' : 'The Plutonium Boss falls! The spell on Sophia breaks.');
    }
    if (this.winT === WIN_JINGLE) this.game.ctx.audio.playJingle(BM_MUSIC.victory);
    if (this.winT >= WIN_FRAMES) this.finish('pass');
  }

  /** The round is over: report it once. */
  private finish(result: MiniGameResult): void {
    if (this.phase === 'over') return;
    this.phase = 'over';
    this.stopMusic();
    this.game.ctx.audio.setTempoScale(1);
    this.done(result);
  }

  /* ---------- Drawing ---------- */

  render(r: Renderer): void {
    const assets = this.game.ctx.assets;
    const font = fontSheet(assets);
    if (this.phase === 'cutscene') {
      drawCutscene(r, assets, this.phaseT, this.game.ctx.reduceFlashing);
      const skip = this.skipText;
      r.text(font, skip, SCREEN_W - 8 - skip.length * 8, 16);
      return;
    }
    r.clear('#000000');
    renderWorld(r, this.view, this.td);
    this.drawHud(r, font);
    const b = this.banner;
    if (b && this.t < b.until) drawBanner(r, font, b.lines, b.y);
  }

  private drawHud(r: Renderer, font: SpriteSheet): void {
    const td = this.td;
    const d = td.dungeon;
    const visited = td
      .visited()
      .map((id) => d.rooms.get(id))
      .filter((room) => room !== undefined)
      .map((room) => [room.gx, room.gy] as const);
    drawBmHud(r, font, this.view.sheet(SOPHIA_SHEET), {
      gun: this.jason.gun,
      pow: td.hero.hp,
      powMax: td.hero.maxHp,
      rest: Math.max(0, this.lives - 1),
      title: AREA_TITLE,
      map: { cols: d.cols, rows: d.rows, visited, here: [td.room.gx, td.room.gy] },
    });
  }
}

/**
 * Underworld's own menu: Continue, Give up (ends the round as 'quit'), and in dev mode the
 * assists. Pauses the music.
 */
export class UnderworldMenuScene extends MiniGameMenuScene {
  constructor(game: Game, giveUp: () => void) {
    super(game, 'UNDERWORLD', giveUp, 'Sophia stays under the spell for now; you can try again later');
  }
}
