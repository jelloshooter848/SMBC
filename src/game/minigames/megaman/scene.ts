import type { Scene } from '@engine/scene';
import { NO_INPUT, type InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { TouchLabels } from '@engine/input/touch';
import { px, tileToSub, toPx } from '@engine/math/units';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import { levelSeed, World } from '../../world/world';
import { newGameState, type GameState } from '../../context';
import { MAX_HP } from '../../characters/megaman';
import { WEAPON_ENERGY } from '../../characters/megaman/weapons';
import { T } from '../../level/tiles';
import type { Player } from '../../entities/player';
import type { Game } from '../../scenes/game';
import { abilityHint } from '../../scenes/hints';
import { levelTouchLabels, NO_TOUCH_BUTTONS } from '../../touch-labels';
import { MiniGameMenuScene } from '../menu';
import { GAME_OVER_FRAMES, lifeLostSaid, MiniLives, type LifeLost, type MiniCheckpoint } from '../lives';
import type { MiniGameResult } from '../types';
import { drawStation, MM_SOUNDS } from './art';
import { BOSS_HP, DarkMegaMan } from './dark-megaman';
import { BAR_BOTTOM, BOSS_BAR_X, drawBossBar as drawBossBarAt, drawStationHud } from './hud';
import { NES_MEGAMAN } from './nes-form';
import { EnemyShot, Robot, Shutter } from './robots';
import { StationWeaponScene } from './weapon-menu';
import { stationEntities, stationStage, type StationLayout } from './stage';

export { BOSS_BAR_X };

/**
 * Frames READY blinks on the empty start spot (the stage music already playing) before Mega Man
 * beams down onto it; he can move once he has landed.
 */
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
/** Widest banner line (columns). Banners sit below the bars (hud.ts BAR_BOTTOM). */
export const BANNER_COLS = 24;
/** The capsule's banner's first line (px): under the bars. */
export const ITEM_BANNER_Y = BAR_BOTTOM + 16;

/**
 * Where a life starts (MiniLives): the stage start, a checkpoint halfway (column 40, past the
 * capsule and the tall block), and the boss door (in front of the shutter, reached at column 76).
 * A life lost in the boss room restarts at the door: through the shutter again, and Dark Mega
 * Man's bar fills again.
 */
export const STATION_START: MiniCheckpoint = { id: 'start', x: 2, y: 12 };
export const STATION_CHECKPOINTS: readonly MiniCheckpoint[] = [
  { id: 'mid', x: 40, y: 12 },
  { id: 'boss', x: 77, y: 12, at: 76 },
];

export type StationPhase =
  'ready' | 'stage' | 'item' | 'gate' | 'intro' | 'fight' | 'won' | 'dead' | 'gameover' | 'over';
export type GateStep = 'opening' | 'walking' | 'closing';

export interface StationOptions {
  /** World seed (drops); the boss's pattern has its own fixed seed. */
  seed?: number;
}

/** Input with only right held: Mega Man walking through the shutter. */
const WALK_RIGHT: InputFrame = { ...NO_INPUT, held: (a) => a === 'right', dirX: 1 };

/**
 * Mega Man's mini game, Station Escape: a short NES-style stage (stage.map) on the space station
 * above 3-1, played as Mega Man in NES form (nes-form.ts: Mega Man 2's jump, knockback and
 * wall-passing shots) with the helmet kit (buster, charge shot, slide); a weapon capsule halfway
 * unlocks the Saw Disc. Each life starts with READY blinking on the empty spot, then Mega Man
 * beams down. At the end Mega Man 2's two shutters: the first opens into a one-screen corridor
 * (the camera locks on it), the second into Dark Mega Man's room: the camera locks, his life bar
 * fills tick by tick while Mega Man waits, then the fight. Beating him passes (after the orb
 * burst, a jingle and Mega Man beaming out). Three lives (lives.ts): losing every hit point or
 * falling in a pit bursts him into orbs and costs one, and the next starts at the last
 * checkpoint (halfway, or the boss door); losing the last is GAME OVER, which fails the round.
 * MENU opens Mega Man 2's weapon screen (weapon-menu.ts); its MENU row, the round's menu, whose
 * Give up quits. A World of its own (built again for each life) runs it with a fresh
 * GameState, so the campaign's lives, score and power are never touched. The HUD is bars only.
 */
export class StationScene implements Scene {
  /** The life in play's World (a new one each life). */
  world: World;
  readonly state: GameState;
  readonly layout: StationLayout = stationStage();
  /** The two boss shutters (the corridor's, then the boss room's). */
  shutters: Shutter[];
  /** The shutter the next gate opens (0, then 1 once in the corridor). */
  nextGate = 0;
  readonly lives: MiniLives;
  phase: StationPhase = 'ready';
  gate: GateStep = 'opening';
  /** Frames since the scene started, and in the current phase. */
  t = 0;
  phaseT = 0;
  boss: DarkMegaMan | null = null;
  /** Segments of the boss's bar while it fills. */
  bossBar = 0;
  banner: { lines: string[]; until: number; y: number } | null = null;
  /** The Saw Disc was taken (it stays his for the round's later lives), and its energy then. */
  sawGot = false;
  private sawEnergy = WEAPON_ENERGY;
  /** E-tanks carried from one life to the next. */
  private etanks = 0;
  /** What losing the life in play came to (decided as he goes down). */
  private lost: LifeLost | null = null;
  private music: string | null = null;
  private readonly seed: number;

  constructor(
    private readonly game: Game,
    private readonly done: (result: MiniGameResult) => void,
    opts: StationOptions = {},
  ) {
    // Mega Man (NES form) with his helmet (buster, charge, slide), full health, no clock.
    const state = newGameState(NES_MEGAMAN);
    state.kit = { helmet: 1 };
    state.hp = MAX_HP;
    state.lives = 1;
    state.world = 3;
    this.state = state;
    this.seed = opts.seed ?? levelSeed(this.layout.level);
    this.lives = new MiniLives({
      start: STATION_START,
      checkpoints: STATION_CHECKPOINTS,
      infinite: () => game.ctx.assist.infiniteLives,
    });
    const { world, shutters } = this.buildWorld();
    this.world = world;
    this.shutters = shutters;
  }

  /** The shutter being passed (or the last one passed). */
  get shutter(): Shutter {
    return this.shutters[Math.min(this.nextGate, this.shutters.length - 1)] as Shutter;
  }

  /** A World for the next life: Mega Man beams down at the current checkpoint. */
  private buildWorld(): { world: World; shutters: Shutter[] } {
    const level = this.layout.level;
    const game = this.game;
    this.state.hp = MAX_HP;
    const station = stationEntities({ onCapsule: (p) => this.gotSaw(p) });
    const world = new World(level, game.ctx, this.state, {
      ...this.lives.start,
      mode: 'beam',
      deathStyle: 'orbs',
      scorePopups: false, // the HUD shows no score
      seed: this.seed,
      // A capsule already taken stays gone.
      extraEntities: (s) => (s.type === 'capsule' && this.sawGot ? null : station(s)),
    });
    world.time = null;
    // Mega Man's stages scroll both ways.
    world.camera.allowLeftScroll = true;
    const shutters = this.layout.shutters.map((s) => new Shutter(s.x, s.y, T.HARD, T.AIR));
    for (const s of shutters) world.spawn(s);
    world.backdrop = (r) => drawStars(r, world.camera.pxX, world.frame, game.ctx.reduceFlashing);
    if (this.sawGot) {
      const p = world.player;
      p.scratch.weapons = Math.max(1, p.scratch.weapons ?? 0);
      p.scratch.wsaw = this.sawEnergy;
    }
    // E-tanks found stay his for the round's later lives (the weapon screen uses them).
    if (this.etanks > 0) world.player.scratch.etanks = this.etanks;
    return { world, shutters };
  }

  get player(): Player {
    return this.world.player;
  }

  enter(): void {
    this.game.ctx.audio.stopMusic();
    this.playMusic(MM_SOUNDS.stage);
    this.say(
      `Station escape. Play as Mega Man: find the Saw Disc and beat Dark Mega Man. ${this.lives.lives} lives. ${this.hint('MENU', 'start')} for the menu. Ready!`,
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
    if (this.phase === 'stage' && this.world.beaming) return { ...NO_TOUCH_BUTTONS, start: 'MENU' };
    if (this.phase === 'stage' || this.phase === 'fight')
      return levelTouchLabels(this.world.players[0], this.world);
    if (this.phase === 'ready' || this.phase === 'item' || this.phase === 'gate' || this.phase === 'intro')
      return { ...NO_TOUCH_BUTTONS, start: 'MENU' };
    return { ...NO_TOUCH_BUTTONS };
  }

  /** Can the menu open now (not once the round is decided). */
  private get menuOpen(): boolean {
    return (
      this.phase !== 'won' && this.phase !== 'dead' && this.phase !== 'gameover' && this.phase !== 'over'
    );
  }

  update(input: InputFrame): void {
    if (this.phase === 'over') return;
    if (this.menuOpen && input.pressed('start')) {
      this.openWeapons();
      return;
    }
    this.t++;
    this.phaseT++;
    switch (this.phase) {
      case 'ready':
        // The OK that started the round must not make Mega Man jump.
        input.consumeJumpBuffer();
        if (this.phaseT >= READY_FRAMES) this.setPhase('stage');
        return;
      case 'item':
        if (this.phaseT >= ITEM_FREEZE) this.setPhase('stage');
        return;
      case 'stage':
        this.step(input);
        if (this.phase !== 'stage') return;
        this.reachCheckpoints();
        if (this.atShutter()) this.openGate();
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
      case 'gameover':
        if (this.phaseT >= GAME_OVER_FRAMES) this.finish('fail');
        return;
    }
  }

  /**
   * One frame of the world with `input`. Going down (the orb burst) costs a life; once the burst
   * has played, the next life starts at the checkpoint, or GAME OVER shows.
   */
  private step(input: InputFrame): void {
    this.world.update([input]);
    const events = this.world.events.splice(0);
    if (this.phase !== 'dead' && this.phase !== 'won' && this.player.dead) this.down();
    if (this.phase === 'dead' && events.some((e) => e.type === 'died')) {
      if (this.lost === 'retry') this.nextLife();
      else this.gameOver();
    }
  }

  /** Mega Man went down (hit points or a pit): a life is lost. */
  private down(): void {
    this.setPhase('dead');
    this.music = null; // the World stopped it for the burst's sound
    this.banner = null;
    const p = this.player;
    if (this.sawGot) this.sawEnergy = p.scratch.wsaw ?? this.sawEnergy;
    this.etanks = p.scratch.etanks ?? 0;
    this.lost = this.lives.lose();
    const fell = toPx(p.body.y) > SCREEN_H;
    const what = lifeLostSaid('Mega Man', this.lives.lives, this.game.ctx.assist.infiniteLives);
    this.say(fell ? what.replace('is down', 'fell') : what);
  }

  /** The next life: a fresh World at the checkpoint, READY, and he beams down. */
  private nextLife(): void {
    const { world, shutters } = this.buildWorld();
    this.world = world;
    this.shutters = shutters;
    this.nextGate = 0;
    this.boss = null;
    this.bossBar = 0;
    this.gate = 'opening';
    this.lost = null;
    this.setPhase('ready');
    this.playMusic(MM_SOUNDS.stage);
  }

  private gameOver(): void {
    this.setPhase('gameover');
    this.stopMusic();
    this.banner = { lines: ['GAME OVER'], until: Infinity, y: 104 };
  }

  /** Passing the halfway point or reaching the boss door moves where the next life starts. */
  private reachCheckpoints(): void {
    const p = this.player;
    if (p.dead || this.world.beaming) return;
    const b = p.body;
    this.lives.reach((b.x + (b.w >> 1)) >> 12, (b.y + (b.h >> 1)) >> 12);
  }

  /* ---------- The weapon screen (MENU) ---------- */

  /** Mega Man 2's START screen: his weapons and their energy, E-tanks, lives, the round's menu. */
  private openWeapons(): void {
    const game = this.game;
    const p = this.player;
    const screen: StationWeaponScene = new StationWeaponScene(game, {
      player: p,
      livesLeft: this.lives.lives,
      tools: () => p.def.tools?.(p) ?? [],
      // The round's menu takes the weapon screen's place: Continue goes straight back to play.
      openOptions: () => {
        if (game.scenes.top === screen) game.scenes.pop();
        game.scenes.push(new StationMenuScene(game, () => this.finish('quit')));
      },
    });
    game.scenes.push(screen);
  }

  /* ---------- The weapon capsule ---------- */

  /** The capsule: the Saw Disc joins the buster (full energy) and a banner says how to use it. */
  private gotSaw(p: Player): void {
    p.scratch.weapons = Math.max(1, p.scratch.weapons ?? 0);
    p.scratch.wsaw = WEAPON_ENERGY;
    this.sawGot = true;
    this.sawEnergy = WEAPON_ENERGY;
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
    this.banner = { lines, until: this.t + ITEM_BANNER_FRAMES, y: ITEM_BANNER_Y };
    this.setPhase('item');
    this.say(
      `You got the Saw Disc! ${weapon} switches to it, ${use} fires it. Hold a direction to aim it eight ways. It cuts through Dark Mega Man.`,
    );
  }

  /* ---------- The boss gate ---------- */

  /** Mega Man on the floor against the next shutter. */
  private atShutter(): boolean {
    const b = this.player.body;
    if (this.player.dead || !b.onGround) return false;
    const s = this.layout.shutters[this.nextGate];
    if (!s) return false;
    const feetRow = (b.y + b.h - 1) >> 12;
    return b.x + b.w >= tileToSub(s.x) - px(1) && feetRow >= s.y && feetRow <= s.y + 1;
  }

  private openGate(): void {
    this.setPhase('gate');
    this.gate = 'opening';
    this.banner = null;
    // The stage music plays on into the corridor; it stops at the boss room's shutter.
    if (this.nextGate > 0) this.stopMusic();
    // As on a screen change in Mega Man's games, the robots and their shots are gone.
    for (const e of this.world.entities) if (e instanceof EnemyShot || e instanceof Robot) e.destroy();
    this.world.camera.locked = true;
    this.shutter.open(this.world);
    this.say('The shutter opens.');
  }

  private updateGate(): void {
    const cam = this.world.camera;
    const room = this.nextGate === 0 ? this.layout.corridorX : this.layout.roomX;
    const goal = tileToSub(room);
    const inside = tileToSub(room + 1) + px(8);
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
    if (this.shutter.state !== 'shut') return;
    // The corridor: Mega Man walks it to the second shutter (the camera stays locked on it).
    if (this.nextGate === 0) {
      this.nextGate = 1;
      this.setPhase('stage');
      return;
    }
    this.startIntro();
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
    this.banner = { lines: ['DARK MEGA MAN IS BEATEN!'], until: Infinity, y: BAR_BOTTOM + 24 };
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
    if (this.phase === 'won' || ((this.phase === 'dead' || this.phase === 'gameover') && this.boss))
      return this.boss?.alive ? this.boss.hp : 0;
    return null;
  }

  render(r: Renderer): void {
    this.world.render(r);
    const assets = this.game.ctx.assets;
    const font = assets.sheet('font');
    if (this.phase === 'intro' && this.phaseT < BEAM_FRAMES) this.drawBossBeam(r);
    if (this.phase === 'won' && this.phaseT >= WIN_BEAM) this.drawHeroBeam(r);
    // Bars only, as Mega Man 2's (no name, score or lives); none before he has beamed down.
    if (!this.player.hidden || this.phase === 'won') drawStationHud(r, this.player);
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

/** The boss's life bar: Mega Man's bar style (28 segments of 2 px), in his colours (hud.ts). */
export function drawBossBar(r: Renderer, value: number): void {
  drawBossBarAt(r, value, BOSS_HP);
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
