import type { Scene } from '@engine/scene';
import { NO_INPUT, type InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { TouchLabels } from '@engine/input/touch';
import { px, tileToSub, toPx } from '@engine/math/units';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import { levelSeed, World } from '../../world/world';
import { newGameState, type GameState } from '../../context';
import { MAX_HP, MEGAMAN } from '../../characters/megaman';
import { WEAPON_ENERGY } from '../../characters/megaman/weapons';
import { T } from '../../level/tiles';
import type { Player } from '../../entities/player';
import type { Game } from '../../scenes/game';
import { abilityHint } from '../../scenes/hints';
import { drawHud } from '../../hud/hud';
import { levelTouchLabels, NO_TOUCH_BUTTONS } from '../../touch-labels';
import { MiniGameMenuScene } from '../menu';
import type { MiniGameResult } from '../types';
import { drawStation, MM_SOUNDS } from './art';
import { BOSS_HP, DarkMegaMan } from './dark-megaman';
import { EnemyShot, Robot, Shutter } from './robots';
import { stationEntities, stationStage, type StationLayout } from './stage';

/** Frames READY shows before Mega Man can move. */
export const READY_FRAMES = 75;
/** Frames the station holds still while Mega Man takes the capsule. */
export const ITEM_FREEZE = 60;
/** Frames the capsule's banner (what it is and how to use it) stays up. */
export const ITEM_BANNER_FRAMES = 240;
/** Camera speed through the shutter (px a frame). */
export const GATE_SCROLL = 4;
/** Frames Dark Mega Man's beam takes to come down. */
export const BEAM_FRAMES = 36;
/** Frames between the boss bar's ticks as it fills (NES style, one segment at a time). */
export const FILL_EVERY = 3;
/** After Dark Mega Man falls: the jingle starts, Mega Man beams out, the round passes. */
export const WIN_JINGLE = 50;
export const WIN_BEAM = 220;
export const WIN_FRAMES = 270;
/**
 * Widest banner line: 24 columns keep the band clear of the health and weapon bars at the left.
 */
export const BANNER_COLS = 24;
/** Screen x of the boss's bar, beside Mega Man's health (x 8) and weapon energy (x 16) bars. */
export const BOSS_BAR_X = 24;
const BAR_Y = 40;

export type StationPhase = 'ready' | 'stage' | 'item' | 'gate' | 'intro' | 'fight' | 'won' | 'dead' | 'over';
export type GateStep = 'opening' | 'walking' | 'closing';

export interface StationOptions {
  /** World seed (drops); the boss's pattern has its own fixed seed. */
  seed?: number;
}

/** Input with only right held: Mega Man walking through the shutter. */
const WALK_RIGHT: InputFrame = { ...NO_INPUT, held: (a) => a === 'right', dirX: 1 };

/**
 * Mega Man's mini game, Station Escape: a short NES-style stage (stage.map) on the space station
 * above 3-1, played as Mega Man with the helmet kit (buster, charge shot, slide); a weapon capsule
 * halfway unlocks the Saw Disc. At the end a shutter opens into Dark Mega Man's room: the camera
 * locks, his life bar fills tick by tick while Mega Man waits, then the fight. Beating him passes
 * (after the orb burst, a jingle and Mega Man beaming out); losing every hit point or falling in
 * a pit fails; the menu's Give up quits. A World of its own runs it with a fresh GameState, so the
 * campaign's lives, score and power are never touched.
 */
export class StationScene implements Scene {
  readonly world: World;
  readonly state: GameState;
  readonly layout: StationLayout = stationStage();
  readonly shutter: Shutter;
  phase: StationPhase = 'ready';
  gate: GateStep = 'opening';
  /** Frames since the scene started, and in the current phase. */
  t = 0;
  phaseT = 0;
  boss: DarkMegaMan | null = null;
  /** Segments of the boss's bar while it fills. */
  bossBar = 0;
  banner: { lines: string[]; until: number; y: number } | null = null;
  private music: string | null = null;

  constructor(
    private readonly game: Game,
    private readonly done: (result: MiniGameResult) => void,
    opts: StationOptions = {},
  ) {
    const level = this.layout.level;
    // Mega Man with his helmet (buster, charge, slide), full health, one life, no clock.
    const state = newGameState(MEGAMAN);
    state.kit = { helmet: 1 };
    state.hp = MAX_HP;
    state.lives = 1;
    state.world = 3;
    this.state = state;
    this.world = new World(level, game.ctx, state, {
      scorePopups: false, // the HUD shows no score
      seed: opts.seed ?? levelSeed(level),
      extraEntities: stationEntities({ onCapsule: (p) => this.gotSaw(p) }),
    });
    this.world.time = null;
    // Mega Man's stages scroll both ways.
    this.world.camera.allowLeftScroll = true;
    const s = this.layout.shutter;
    this.shutter = new Shutter(s.x, s.y, T.HARD, T.AIR);
    this.world.spawn(this.shutter);
    this.world.backdrop = (r) =>
      drawStars(r, this.world.camera.pxX, this.world.frame, game.ctx.reduceFlashing);
  }

  get player(): Player {
    return this.world.player;
  }

  enter(): void {
    this.game.ctx.audio.stopMusic();
    this.say(
      `Station escape. Play as Mega Man: find the Saw Disc and beat Dark Mega Man. ${this.hint('MENU', 'start')} for the menu. Ready!`,
    );
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

  private playMusic(id: string): void {
    if (this.music === id) return;
    this.music = id;
    this.game.ctx.audio.playMusic(id);
  }

  private stopMusic(): void {
    this.music = null;
    this.game.ctx.audio.stopMusic();
  }

  private setPhase(p: StationPhase): void {
    this.phase = p;
    this.phaseT = 0;
  }

  /** Mega Man's buttons as in a level while he plays; only MENU while the station takes over. */
  touchLabels(): TouchLabels {
    if (this.phase === 'stage' || this.phase === 'fight')
      return levelTouchLabels(this.world.players[0], this.world);
    if (this.phase === 'ready' || this.phase === 'item' || this.phase === 'gate' || this.phase === 'intro')
      return { ...NO_TOUCH_BUTTONS, start: 'MENU' };
    return { ...NO_TOUCH_BUTTONS };
  }

  /** Can the menu open now (not once the round is decided). */
  private get menuOpen(): boolean {
    return this.phase !== 'won' && this.phase !== 'dead' && this.phase !== 'over';
  }

  update(input: InputFrame): void {
    if (this.phase === 'over') return;
    if (this.menuOpen && input.pressed('start')) {
      this.game.scenes.push(new StationMenuScene(this.game, () => this.finish('quit')));
      return;
    }
    this.t++;
    this.phaseT++;
    switch (this.phase) {
      case 'ready':
        // The OK that started the round must not make Mega Man jump.
        input.consumeJumpBuffer();
        if (this.phaseT >= READY_FRAMES) {
          this.setPhase('stage');
          this.playMusic(MM_SOUNDS.stage);
        }
        return;
      case 'item':
        if (this.phaseT >= ITEM_FREEZE) this.setPhase('stage');
        return;
      case 'stage':
        this.step(input);
        if (this.phase === 'stage' && this.atShutter()) this.openGate();
        return;
      case 'gate':
        return this.updateGate();
      case 'intro':
        return this.updateIntro();
      case 'fight':
        return this.step(input);
      case 'won':
        return this.updateWon();
      case 'dead':
        return this.step(NO_INPUT);
    }
  }

  /** One frame of the world with `input`; a death ends the round once its jingle has played. */
  private step(input: InputFrame): void {
    this.world.update([input]);
    const events = this.world.events.splice(0);
    if (this.phase !== 'dead' && this.player.dead) {
      this.setPhase('dead');
      this.music = null;
      const fell = toPx(this.player.body.y) > SCREEN_H;
      this.say(fell ? 'Mega Man fell. Try again.' : 'Mega Man is down. Try again.');
    }
    if (this.phase === 'dead' && events.some((e) => e.type === 'died')) this.finish('fail');
  }

  /* ---------- The weapon capsule ---------- */

  /** The capsule: the Saw Disc joins the buster (full energy) and a banner says how to use it. */
  private gotSaw(p: Player): void {
    p.scratch.weapons = Math.max(1, p.scratch.weapons ?? 0);
    p.scratch.wsaw = WEAPON_ENERGY;
    this.game.ctx.audio.sfx(MM_SOUNDS.capsule);
    const weapon = this.hint('WEAPON', 'select');
    const use = this.hint('USE WEAPON', 'special');
    // Each line with its key while that fits the banner, else the bare ability.
    const fit = (hinted: string, bare: string) => (hinted.length <= BANNER_COLS ? hinted : bare);
    const lines = [
      'YOU GOT SAW DISC!',
      fit(`${weapon}: SWITCH`, 'WEAPON: SWITCH TO IT'),
      fit(`${use}: FIRE`, 'USE WEAPON: FIRE IT'),
      'HOLD A DIRECTION TO AIM',
    ];
    this.banner = { lines, until: this.t + ITEM_BANNER_FRAMES, y: 56 };
    this.setPhase('item');
    this.say(
      `You got the Saw Disc! ${weapon} switches to it, ${use} fires it. Hold a direction to aim it eight ways. It cuts through Dark Mega Man.`,
    );
  }

  /* ---------- The boss gate ---------- */

  /** Mega Man on the floor against the shutter. */
  private atShutter(): boolean {
    const b = this.player.body;
    if (this.player.dead || !b.onGround) return false;
    const s = this.layout.shutter;
    const feetRow = (b.y + b.h - 1) >> 12;
    return b.x + b.w >= tileToSub(s.x) - px(1) && feetRow >= s.y && feetRow <= s.y + 1;
  }

  private openGate(): void {
    this.setPhase('gate');
    this.gate = 'opening';
    this.banner = null;
    this.stopMusic();
    // As on a screen change in Mega Man's games, the robots and their shots are gone.
    for (const e of this.world.entities) if (e instanceof EnemyShot || e instanceof Robot) e.destroy();
    this.world.camera.locked = true;
    this.shutter.open(this.world);
    this.say('The shutter opens.');
  }

  private updateGate(): void {
    const cam = this.world.camera;
    const goal = tileToSub(this.layout.roomX);
    const inside = tileToSub(this.layout.roomX + 1) + px(8);
    if (this.gate === 'opening') {
      this.step(NO_INPUT);
      if (this.shutter.state === 'open') this.gate = 'walking';
      return;
    }
    if (this.gate === 'walking') {
      const walking = this.player.body.x < inside;
      this.step(walking ? WALK_RIGHT : NO_INPUT);
      cam.x = Math.min(goal, cam.x + px(GATE_SCROLL));
      if (cam.x >= goal && this.player.body.x >= inside) {
        this.gate = 'closing';
        this.shutter.close(this.world);
      }
      return;
    }
    this.step(NO_INPUT);
    if (this.shutter.state === 'shut') this.startIntro();
  }

  /* ---------- Dark Mega Man's entrance ---------- */

  private startIntro(): void {
    this.setPhase('intro');
    this.bossBar = 0;
    this.playMusic(MM_SOUNDS.boss);
    this.game.ctx.audio.sfx(MM_SOUNDS.beam);
    this.say('Dark Mega Man!');
  }

  /** Where Dark Mega Man stands (px of his body's top-left). */
  private bossSpot(): { x: number; y: number } {
    const s = this.layout.boss;
    return { x: s.x * 16 + 2, y: (s.y + 1) * 16 - 22 };
  }

  private updateIntro(): void {
    this.step(NO_INPUT);
    if (this.phaseT === BEAM_FRAMES) {
      const s = this.bossSpot();
      this.boss = new DarkMegaMan(px(s.x), px(s.y), () => this.bossDown());
      this.world.spawn(this.boss);
    }
    if (this.phaseT <= BEAM_FRAMES + 10) return;
    if ((this.phaseT - BEAM_FRAMES - 10) % FILL_EVERY !== 0) return;
    if (this.bossBar < BOSS_HP) {
      this.bossBar++;
      this.game.ctx.audio.sfx(MM_SOUNDS.fill);
      return;
    }
    this.boss?.wake();
    this.setPhase('fight');
  }

  /* ---------- The end ---------- */

  private bossDown(): void {
    this.setPhase('won');
    this.stopMusic();
    // Nothing can hurt him now; the room is his to leave.
    for (const e of this.world.entities) if (e instanceof EnemyShot) e.destroy();
    this.banner = { lines: ['DARK MEGA MAN IS BEATEN!'], until: Infinity, y: BAR_Y + 64 };
    this.say(`Dark Mega Man is beaten!${this.game.inRound ? '' : ' The spell on Mega Man breaks.'}`);
  }

  private updateWon(): void {
    if (this.phaseT < WIN_BEAM) this.step(NO_INPUT);
    if (this.phaseT === WIN_JINGLE) this.game.ctx.audio.playJingle(MM_SOUNDS.victory);
    if (this.phaseT === WIN_BEAM) {
      this.player.hidden = true;
      this.game.ctx.audio.sfx(MM_SOUNDS.beam);
    }
    if (this.phaseT >= WIN_FRAMES) this.finish('pass');
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

  /** Segments the boss bar shows: filling in the intro, his hit points in the fight, none before. */
  bossBarValue(): number | null {
    if (this.phase === 'intro') return this.boss ? this.bossBar : null;
    if (this.phase === 'fight') return this.boss?.hp ?? 0;
    if (this.phase === 'won' || (this.phase === 'dead' && this.boss))
      return this.boss?.alive ? this.boss.hp : 0;
    return null;
  }

  render(r: Renderer): void {
    this.world.render(r);
    const assets = this.game.ctx.assets;
    const font = assets.sheet('font');
    if (this.phase === 'intro' && this.phaseT < BEAM_FRAMES) this.drawBossBeam(r);
    if (this.phase === 'won' && this.phaseT >= WIN_BEAM) this.drawHeroBeam(r);
    drawHud(r, assets, this.state, null, this.world.frame, this.world.players, {
      place: 'STATION',
      covered: (x, y, w, h) => this.world.spriteIn(x, y, w, h),
    });
    const bar = this.bossBarValue();
    if (bar !== null) drawBossBar(r, bar);
    if (this.phase === 'ready' && (this.game.ctx.reduceFlashing || ((this.phaseT >> 3) & 3) !== 3))
      r.text(font, 'READY', (SCREEN_W - 40) >> 1, 104);
    const b = this.banner;
    if (b && this.t < b.until) drawBanner(r, font, b.lines, b.y);
  }

  /** Dark Mega Man's teleport streak coming down onto his spot. */
  private drawBossBeam(r: Renderer): void {
    const s = this.bossSpot();
    const x = s.x - 2 - this.world.camera.pxX;
    const yEnd = s.y - 10;
    const y = Math.round(-32 + ((yEnd + 32) * this.phaseT) / BEAM_FRAMES);
    this.drawBeam(r, x, y);
  }

  /** Mega Man beaming out, up off the screen. */
  private drawHeroBeam(r: Renderer): void {
    const b = this.player.body;
    const x = toPx(b.x) - 2 - this.world.camera.pxX;
    const y = toPx(b.y) - 10 - (this.phaseT - WIN_BEAM) * 8;
    this.drawBeam(r, x, y);
  }

  /** The teleport streak (station `beam-*`, 16×32) with its top at (x, y). */
  private drawBeam(r: Renderer, x: number, y: number): void {
    drawStation(r, this.game.ctx.assets, `beam-${(this.t >> 2) % 3}`, x, y);
  }
}

/** The boss's life bar: Mega Man's bar style (28 segments of 2 px), in his colours. */
export function drawBossBar(r: Renderer, value: number): void {
  const segs = BOSS_HP;
  r.rect(BOSS_BAR_X - 1, BAR_Y - 1, 8, segs * 2 + 2, '#000');
  for (let i = 0; i < segs; i++) {
    const on = i < value;
    const y = BAR_Y + (segs - 1 - i) * 2;
    r.rect(BOSS_BAR_X, y, 6, 1, on ? '#fcfcfc' : '#404040');
    r.rect(BOSS_BAR_X, y + 1, 6, 1, on ? '#f83800' : '#202020');
  }
}

/** Lines of the bitmap font on a dark band, centred, the first at `y`. */
export function drawBanner(r: Renderer, font: SpriteSheet, lines: readonly string[], y: number): void {
  const w = Math.max(...lines.map((l) => l.length)) * 8;
  r.rect(((SCREEN_W - w) >> 1) - 8, y - 6, w + 16, lines.length * 12 + 8, 'rgba(0,0,0,0.75)');
  lines.forEach((l, i) => r.text(font, l, (SCREEN_W - l.length * 8) >> 1, y + i * 12));
}

/** Stars out of the station's windows: fixed, slow parallax, a few twinkle (not with reduce flashing). */
function drawStars(r: Renderer, camX: number, frame: number, reduceFlashing: boolean): void {
  const span = 512;
  for (let i = 0; i < 56; i++) {
    const sx = (i * 197 + ((i * i * 31) % 89)) % span;
    const sy = 8 + ((i * 113 + 41) % 190);
    const x = (((sx - (camX >> 2)) % span) + span) % span;
    if (x >= SCREEN_W) continue;
    const dim = !reduceFlashing && ((frame >> 4) + i) % 9 === 0;
    r.rect(x, sy, 1, 1, i % 5 === 0 ? '#f8d878' : dim ? '#404040' : '#bcbcbc');
  }
}

/**
 * Station Escape's own menu: Continue, or Give up (ends the round as 'quit'), and in dev mode the
 * assists (No damage keeps Mega Man's hit points; a pit still ends the round). Pauses the music.
 */
export class StationMenuScene extends MiniGameMenuScene {
  constructor(game: Game, giveUp: () => void) {
    super(
      game,
      'STATION ESCAPE',
      giveUp,
      'Mega Man stays brainwashed for now; you can try the station again later',
    );
  }
}
