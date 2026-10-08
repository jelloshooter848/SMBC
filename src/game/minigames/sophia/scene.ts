import type { Scene } from '@engine/scene';
import { NO_INPUT, type InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { TouchLabels } from '@engine/input/touch';
import { SCREEN_W } from '@engine/viewport';
import type { Game } from '../../scenes/game';
import { abilityHint } from '../../scenes/hints';
import { levelTouchLabels, NO_TOUCH_BUTTONS } from '../../touch-labels';
import type { World } from '../../world/world';
import type { CharacterDef } from '../../characters/character';
import type { Player } from '../../entities/player';
import { MiniGameMenuScene } from '../menu';
import type { MiniGameResult } from '../types';
import { drawBanner } from '../megaman/scene';
import { renderWorld } from '../../topdown/render';
import { sheetLookup, type TdSheets, type TdView } from '../../topdown/view';
import { HUD_H, type Dir } from '../../topdown/geometry';
import type { TdEvent } from '../../topdown/world';
import {
  BM_MUSIC,
  drawSophia,
  DUNGEON_TILES,
  FALLBACK_TILES,
  FALLBACK_TILES_PALETTE,
  DUNGEON_TILES_DARK,
  SOPHIA_SHEET,
  fontSheet,
  soundId,
  type BmSound,
} from './art';
import { CUT_BEATS, drawCutscene } from './cutscene';
import { CAPTION_OK, CAPTION_SKIP, CaptionPager, drawCaptionKeys } from '../captions';
import { areaStage, atGateway, newArea, newBossRoom, onFoot, sophiaDef } from './area';
import type { PlutoniumBoss } from './plutonium';
import { newUnderworld } from './dungeon';
import { drawBmHud } from './hud';
import type { UnderworldWorld } from './jason';
import { Guardian } from './guardian';

/** Lives for a round (Blaster Master's three). */
export const LIVES = 3;
/** Frames after Jason's death (the spin and the boom) before the next life or GAME OVER. */
export const RESPAWN_DELAY = 30;
/** Frames he blinks, untouchable, after coming back. */
export const RESPAWN_INVULN = 120;
/** GAME OVER shows this long before the round fails. */
export const GAME_OVER_FRAMES = 180;
/** After the last boss falls: the banner, the jingle, then the round passes. */
export const WIN_BANNER_AT = 60;
export const WIN_JINGLE = 90;
export const WIN_FRAMES = 330;
/** Frames the dungeon's first banner stays up. */
export const DUNGEON_BANNER_FRAMES = 180;
/** Frames a boss's name stays up, and the guardian's fall. */
export const BOSS_BANNER_FRAMES = 100;
export const GUARDIAN_DOWN_FRAMES = 150;
/** Frames of Jason's run back to the tank (section 4) before the Plutonium Boss. */
export const RETURN_FRAMES = 120;
/** The area's name on the HUD. */
export const AREA_TITLE = 'UNDERWORLD';

export type UnderworldPhase =
  'cutscene' | 'area' | 'gateway' | 'dungeon' | 'return' | 'boss' | 'won' | 'lost' | 'over';

/** Frames of the walk into the gateway (the cavern fades out) before the dungeon. */
export const GATEWAY_FRAMES = 60;
/** Frames the hop-out lesson's banner stays up. */
export const TEACH_FRAMES = 300;
/**
 * The action EXIT (Jason hopping out of the tank, and back in) is on: S1's choice, on the
 * special/select side.
 */
export const EXIT_ACTION = 'select' as const;

export interface UnderworldOptions {
  /** The dungeon's seed (capsule drops). */
  seed?: number;
  /** Start in the dungeon, without the cutscene or the cavern (tests). */
  skipCutscene?: boolean;
  /** Start in the tank's cavern, without the cutscene (tests). */
  startInArea?: boolean;
  /** Start in the Plutonium Boss's chamber (tests). */
  startInBoss?: boolean;
  /**
   * The hero the tank's sections (the cavern, the Plutonium Boss) are played as: Sophia once
   * S1's def is registered (the default); a stand-in in tests; null leaves them out (the round
   * goes from the cutscene to the gateway, and passes once Jason is back at the tank).
   */
  tankHero?: CharacterDef | null;
}

/** Where Jason came into the room he is in (a new life starts there). */
interface Entry {
  room: string;
  x: number;
  y: number;
  facing: Dir;
}

/**
 * Sophia's mini game, Underworld, Blaster Master in brief:
 *   1. the opening (Fred, the glowing chest and the hole; skippable);
 *   2. the tank's cavern in side view (area.ts, cavern.ts), ending at a gateway only Jason on
 *      foot goes through;
 *   3. Jason's overhead dungeon on the top-down kit (dungeon.ts, jason.ts, mutants.ts) with the
 *      original's GUN meter, grenades and POW, and its guardian (guardian.ts);
 *   4. Jason's run back to the tank;
 *   5. the Plutonium Boss in side view, fought in the tank (plutonium.ts).
 * Three lives across the round. Beating the Plutonium Boss passes; losing every life fails
 * (GAME OVER); the menu's Give up quits. Everything lives in the round, so the campaign's state is
 * never touched.
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
  private okText = 'OK';
  /** The opening's captions, a page at a time: OK turns them, SKIP ends the cutscene. */
  readonly captions = new CaptionPager(CUT_BEATS);
  /** The tank's hero (null: no tank sections), and the side-view World played (cavern or boss). */
  readonly tankHero: CharacterDef | null;
  area: World | null = null;
  /** The Plutonium Boss, once its chamber is reached. */
  plutonium: PlutoniumBoss | null = null;
  private areaSeed: number;
  private farthest = 0;
  /** The hop-out lesson has shown. */
  taught = false;

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
    this.tankHero = opts.tankHero === undefined ? sophiaDef() : opts.tankHero;
    this.areaSeed = opts.seed ?? 0x5091a;
    if (opts.skipCutscene) this.phase = 'dungeon';
    else if (opts.startInArea && this.tankHero) this.phase = 'area';
    else if (opts.startInBoss && this.tankHero) this.phase = 'boss';
  }

  get jason() {
    return this.td.jason;
  }

  /** The dungeon's guardian, while its room is on screen. */
  get guardian(): Guardian | null {
    return this.td.entities.find((e): e is Guardian => e instanceof Guardian) ?? null;
  }

  enter(): void {
    this.game.ctx.audio.stopMusic();
    this.skipText = this.hint('SKIP', CAPTION_SKIP);
    this.okText = this.hint('OK', CAPTION_OK);
    if (this.phase === 'cutscene') {
      this.playMusic(BM_MUSIC.cutscene);
      this.say(`Underworld. ${this.captions.said(this.game)}`);
    } else if (this.phase === 'area') this.startArea();
    else if (this.phase === 'boss') this.startBoss();
    else this.startDungeon();
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

  /** OK and SKIP in the cutscene; SHOOT and GRENADE while Jason is up; MENU while the menu opens. */
  touchLabels(): TouchLabels {
    if (this.phase === 'cutscene') return { ...NO_TOUCH_BUTTONS, jump: 'OK', attack: 'SKIP', start: 'MENU' };
    if ((this.phase === 'area' || this.phase === 'boss') && this.area) {
      const p = this.area.player;
      if (p.dead) return { ...NO_TOUCH_BUTTONS, start: 'MENU' };
      return { ...levelTouchLabels(p, this.area), start: 'MENU' };
    }
    if (this.phase !== 'dungeon') return { ...NO_TOUCH_BUTTONS };
    const h = this.td.hero;
    if (h.dying || h.dead) return { ...NO_TOUCH_BUTTONS, start: 'MENU' };
    return { ...NO_TOUCH_BUTTONS, attack: 'SHOOT', special: 'GRENADE', start: 'MENU' };
  }

  private get menuOpens(): boolean {
    return (
      this.phase === 'cutscene' || this.phase === 'area' || this.phase === 'dungeon' || this.phase === 'boss'
    );
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
      case 'cutscene': {
        if (input.pressed(CAPTION_SKIP)) this.skipped = true;
        const step = this.skipped ? 'done' : this.captions.update(input.pressed(CAPTION_OK));
        if (step === 'next') this.say(this.captions.said(this.game));
        if (step === 'done') {
          input.consumeJumpBuffer();
          this.stopMusic();
          if (this.tankHero) {
            this.setPhase('area');
            this.startArea();
          } else {
            this.setPhase('dungeon');
            this.startDungeon();
          }
        }
        return;
      }
      case 'area':
        return this.updateArea(input);
      case 'gateway':
        if (this.area) this.stepArea(NO_INPUT);
        if (this.phaseT >= GATEWAY_FRAMES) {
          this.area = null;
          this.setPhase('dungeon');
          this.startDungeon();
        }
        return;
      case 'dungeon':
        return this.updateDungeon(input);
      case 'return':
        if (this.phaseT >= RETURN_FRAMES) {
          if (this.tankHero) {
            this.setPhase('boss');
            this.startBoss();
          } else this.allDone();
        }
        return;
      case 'boss':
        return this.updateBoss(input);
      case 'won':
        return this.updateWon();
      case 'lost':
        if (this.phaseT >= GAME_OVER_FRAMES) this.finish('fail');
        return;
    }
  }

  /* ---------- The cavern (section 1) ---------- */

  /** A World for the cavern; after a lost life, from the checkpoint once it was passed. */
  private startArea(fresh = true): void {
    const hero = this.tankHero;
    if (!hero) return;
    const layout = areaStage();
    const from = this.farthest >= layout.checkpointX ? layout.checkpointX : undefined;
    this.area = newArea(this.game.ctx, hero, {
      seed: this.areaSeed,
      ...(from !== undefined ? { fromX: from } : {}),
    });
    this.playMusic(BM_MUSIC.area);
    if (!fresh) return;
    this.say(
      `Sophia the Third, into the cavern! ${this.hint('SHOOT', 'attack')} fires the cannon; it breaks bricks. Find the gateway: only Jason on foot can go in. ${this.hint('MENU', 'start')} for the menu.`,
    );
  }

  private stepArea(input: InputFrame): boolean {
    const w = this.area as World;
    w.update([input]);
    let died = false;
    for (const e of w.events) if (e.type === 'died') died = true;
    w.events.length = 0;
    return died;
  }

  private updateArea(input: InputFrame): void {
    const w = this.area;
    if (!w) return;
    const died = this.stepArea(input);
    const p = w.player;
    const layout = areaStage();
    const col = p.body.x >> 12;
    if (!p.dead) this.farthest = Math.max(this.farthest, col);
    if (!this.taught && !p.dead && col >= layout.teachX && !onFoot(p)) this.teachHopOut();
    if (atGateway(p, layout)) {
      this.setPhase('gateway');
      this.banner = null;
      this.stopMusic();
      this.sfx('door');
      this.say('Jason walks into the gateway.');
      return;
    }
    if (died) this.sideLifeLost();
  }

  /** The tank nears the gateway: only Jason goes in, and how he hops out, once. */
  private teachHopOut(): void {
    this.taught = true;
    const exit = this.hint('EXIT', EXIT_ACTION);
    const line = `${exit}: JASON HOPS OUT`;
    this.banner = {
      lines: ['GATEWAYS ARE FOR JASON.', line.length <= 26 ? line : 'EXIT: JASON HOPS OUT'],
      until: this.t + TEACH_FRAMES,
      y: 40,
    };
    this.say(
      `The gateway is for Jason on foot; the tank can't go in. ${exit} lets Jason hop out. Climb the ladder up the shaft to the gateway.`,
    );
  }

  /**
   * A life lost in the tank: the next one from the cavern's start or checkpoint, or at the door
   * of the Plutonium Boss's chamber (the boss whole again); or GAME OVER.
   */
  private sideLifeLost(): void {
    const infinite = this.game.ctx.assist.infiniteLives;
    if (!infinite) this.lives--;
    if (this.lives <= 0) {
      this.setPhase('lost');
      this.stopMusic();
      this.banner = { lines: ['GAME OVER'], until: Infinity, y: 112 };
      this.say('Game over. Try again.');
      return;
    }
    this.music = null;
    if (this.phase === 'boss') this.startBoss(false);
    else this.startArea(false);
    const left = this.lives - 1;
    this.say(
      infinite
        ? 'Sophia is back.'
        : left === 0
          ? 'Down! Last life.'
          : `Down! ${left} ${left === 1 ? 'life' : 'lives'} left.`,
    );
  }

  /* ---------- The Plutonium Boss (section 5) ---------- */

  /** The chamber, the boss asleep at the right; it wakes after a moment. */
  private startBoss(fresh = true): void {
    const hero = this.tankHero;
    if (!hero) return;
    const { world, boss } = newBossRoom(
      this.game.ctx,
      hero,
      {
        onWake: () => this.plutoWakes(),
        onBreak: () => this.say('The mass bursts! Its core rises and loops over the chamber. Aim up!'),
        onDown: () => this.bossDown(),
      },
      this.areaSeed,
    );
    this.area = world;
    this.plutonium = boss;
    this.stopMusic();
    if (fresh) this.say('Jason is back in Sophia. Something stirs in the dark...');
  }

  private plutoWakes(): void {
    this.banner = { lines: ['PLUTONIUM BOSS'], until: this.t + BOSS_BANNER_FRAMES, y: 48 };
    this.playMusic(BM_MUSIC.boss);
    this.say(
      `The Plutonium Boss! It lobs plutonium where you stand. When it glows it opens and rolls a ball along the floor: jump it, and shoot its open maw with ${this.hint('SHOOT', 'attack')}.`,
    );
  }

  private updateBoss(input: InputFrame): void {
    if (!this.area) return;
    const died = this.stepArea(input);
    if (this.phase === 'boss' && died) this.sideLifeLost();
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
      `Jason enters the dungeon. ${shoot} fires his gun; every hit he takes lowers the gun a level, and G capsules raise it. ${grenade} throws a grenade. P capsules restore power. Get past the guardian, back to Sophia! ${this.hint('MENU', 'start')} for the menu.`,
    );
  }

  /** The room's music: the boss loop while the guardian lives, the dungeon's everywhere else. */
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
        if (e.kind === 'guardian') this.guardianDown();
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
        this.banner = { lines: ['THE GUARDIAN'], until: this.t + BOSS_BANNER_FRAMES, y: HUD_H + 120 };
        this.playMusic(BM_MUSIC.boss);
        this.say(
          "The dungeon's guardian! Its vents are shut; it glows, then opens with a ring of orbs. Shoot it while it is open.",
        );
        return;
      case 'boss-break':
        this.say('The shell cracks! Its core bounces round the room.');
        return;
      case 'exit':
        return this.startReturn();
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

  /* ---------- The guardian falls; back to the tank (section 4) ---------- */

  private guardianDown(): void {
    this.banner = {
      lines: ['THE GUARDIAN FALLS!'],
      until: this.t + GUARDIAN_DOWN_FRAMES,
      y: HUD_H + 40,
    };
    this.sfx('secret');
    this.say('The guardian falls! The way back to Sophia is open, to the east.');
    this.updateMusic();
  }

  /** Jason takes the way out: his run back to the tank. */
  private startReturn(): void {
    this.setPhase('return');
    this.banner = null;
    this.stopMusic();
    this.sfx('open');
    this.say('Jason runs back to Sophia and climbs in.');
  }

  /* ---------- The end ---------- */

  /** The Plutonium Boss falls. */
  private bossDown(): void {
    this.setPhase('won');
    this.winT = 0;
    this.stopMusic();
  }

  /** Without the tank's sections (no Sophia def yet): the round ends with Jason back at the tank. */
  private allDone(): void {
    this.area = null;
    this.setPhase('won');
    this.winT = 0;
  }

  private updateWon(): void {
    if (this.area) this.stepArea(NO_INPUT);
    else {
      this.td.update(NO_INPUT);
      this.td.events.length = 0;
    }
    this.winT++;
    if (this.winT === WIN_BANNER_AT) {
      // A round for fun (Game.inRound) frees nobody: no word of the spell.
      const fun = this.game.inRound;
      const first = this.plutonium ? 'THE PLUTONIUM BOSS FALLS!' : 'JASON IS BACK WITH SOPHIA!';
      this.banner = {
        lines: fun ? [first] : [first, 'THE SPELL ON SOPHIA BREAKS!'],
        until: Infinity,
        y: this.area ? 72 : HUD_H + 40,
      };
      const said = this.plutonium ? 'The Plutonium Boss falls!' : 'Jason is back with Sophia!';
      this.say(fun ? said : `${said} The spell on Sophia breaks.`);
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
      const c = this.captions;
      drawCutscene(r, assets, c.pic, this.game.ctx.reduceFlashing, { lines: c.lines, clock: this.phaseT });
      drawCaptionKeys(r, font, this.skipText, c.waiting ? this.okText : null);
      return;
    }
    if (this.phase === 'return') {
      drawReturn(r, assets, font, this.phaseT);
      return;
    }
    if (this.area && this.phase !== 'dungeon') {
      this.area.render(r);
      drawTankBar(r, font, assets, this.area.player, Math.max(0, this.lives - 1));
      // Into the gateway: the cavern fades out.
      if (this.phase === 'gateway')
        r.rect(
          0,
          24,
          SCREEN_W,
          216,
          `rgba(0,0,0,${Math.min(1, this.phaseT / (GATEWAY_FRAMES - 10)).toFixed(2)})`,
        );
      const b = this.banner;
      if (b && this.t < b.until) drawBanner(r, font, b.lines, b.y);
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

/** The tank's bar: its power (Normal, Hyper, Crusher), cells lit up to it. */
export const POW_CELLS = 3;
export const POW_NAMES: Readonly<Record<string, string>> = { small: 'NORMAL', big: 'HYPER', fire: 'CRUSHER' };

/**
 * The bar over the tank's side-view parts, Blaster Master style: POW (the tank's power: Normal,
 * Hyper, Crusher, shared with Jason on foot) and HOV (the hover gauge, S1's `meter`; empty while
 * there is no hover or Jason is out), the missile in hand and its count (S1's `tools`), and REST.
 */
export function drawTankBar(
  r: Renderer,
  font: SpriteSheet,
  assets: AssetRegistry,
  p: Player,
  rest: number,
): void {
  r.rect(0, 0, SCREEN_W, 24, '#000000');
  const level = p.powerState === 'fire' ? 3 : p.powerState === 'big' ? 2 : 1;
  r.text(font, 'POW', 8, 4);
  for (let i = 0; i < POW_CELLS; i++) r.rect(36 + i * 10, 4, 8, 7, i < level ? '#f83800' : '#282828');
  r.text(font, POW_NAMES[p.powerState] ?? '', 70, 4);
  const m = p.def.meter?.(p) ?? null;
  r.text(font, 'HOV', 8, 14);
  const max = m?.max ?? 8;
  const on = m ? Math.round((Math.max(0, Math.min(m.value, m.max)) / m.max) * max) : 0;
  for (let i = 0; i < max; i++) r.rect(36 + i * 6, 15, 4, 6, i < on ? (m?.colour ?? '#e40058') : '#282828');
  const tools = p.def.tools?.(p) ?? [];
  const t = tools.length
    ? tools[(((p.scratch.tool ?? 0) % tools.length) + tools.length) % tools.length]
    : null;
  if (t) {
    const sheet = sophiaSheetOf(assets, t.sheet);
    if (sheet?.frames.has(t.icon)) r.sprite(sheet, t.icon, 144, 4);
    else r.rect(148, 8, 8, 8, '#f8b800');
    if (t.count !== null) r.text(font, `×${String(t.count).padStart(2, '0')}`, 162, 8);
  }
  r.text(font, `REST ${rest}`, SCREEN_W - 64, 8);
}

function sophiaSheetOf(assets: AssetRegistry, id: string | undefined): SpriteSheet | null {
  try {
    return assets.has(id ?? 'items') ? assets.sheet(id ?? 'items') : null;
  } catch {
    return null;
  }
}

/** Section 4: Jason running back to the tank, its hatch open, on black (a short transition). */
function drawReturn(r: Renderer, assets: AssetRegistry, font: SpriteSheet, t: number): void {
  r.clear('#000000');
  const lines = ['JASON RUNS BACK', 'TO SOPHIA...'];
  lines.forEach((l, i) => r.text(font, l, (SCREEN_W - l.length * 8) >> 1, 80 + i * 12));
  const ground = 168;
  r.rect(0, ground, SCREEN_W, 2, '#503000');
  // (the tank's 32-px frames stand on their row 23: S1's sheet convention)
  drawSophia(r, assets, 'open', 160, ground - 24, 32, 32, ['#545454', '#a4a4a4']);
  // Jason runs in from the left and hops into the hatch.
  const k = Math.min(1, t / (RETURN_FRAMES * 0.6));
  if (k < 1) {
    const x = Math.round(16 + (160 - 16) * k);
    drawSophia(r, assets, `jason-walk-${(t >> 3) % 3}`, x, ground - 16, 16, 16, ['#0058f8', '#fcfcfc']);
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
