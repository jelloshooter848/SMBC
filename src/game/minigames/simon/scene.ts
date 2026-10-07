import type { Scene } from '@engine/scene';
import { NO_INPUT, type InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { px, tileToSub, toPx } from '@engine/math/units';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import { levelSeed, World } from '../../world/world';
import { newGameState, type GameState } from '../../context';
import { MAX_HP, SIMON } from '../../characters/simon';
import { T } from '../../level/tiles';
import type { Player } from '../../entities/player';
import type { Game } from '../../scenes/game';
import { abilityHint } from '../../scenes/hints';
import { levelTouchLabels, NO_TOUCH_BUTTONS } from '../../touch-labels';
import { MiniGameMenuScene } from '../menu';
import type { MiniGameResult } from '../types';
import { drawBanner } from '../megaman/scene';
import { CV_SOUNDS, STAGE_THEME } from './art';
import { CastleDoor, Creature, CvShot, MedusaSpawner } from './creatures';
import { Beast, BEAST_HP, BossLife, BOSS_HP, Dracula, ShockWave, SPOTS } from './dracula';
import { BAR_SEGMENTS, drawCastleHud, HUD_H } from './hud';
import { castleEntities, castleStage, type CastleLayout } from './stage';

/** Frames READY shows before Simon can move. */
export const READY_FRAMES = 75;
/** The castle's clock, in seconds (it runs out: Simon falls). */
export const TIME_LIMIT = 300;
/** Camera speed through the door (px a frame). */
export const GATE_SCROLL = 4;
/** Frames Dracula's throne room waits before he first appears. */
export const INTRO_FRAMES = 40;
/** Frames of the transformation between the phases. */
export const TRANSFORM_FRAMES = 120;
/** After the beast falls: the jingle, then the round passes. */
export const WIN_JINGLE = 100;
export const WIN_FRAMES = 300;
/** Frames the sub-weapon's banner stays up. */
export const ITEM_BANNER_FRAMES = 200;
/** Widest banner line. */
export const BANNER_COLS = 26;
/** Simon's start kit: the chain whip, no sub-weapon yet, five hearts. */
export const CASTLE_KIT = { whip: 1, subs: 0, multi: 1, hearts: 5 } as const;

export type CastlePhase =
  'ready' | 'stage' | 'gate' | 'intro' | 'fight' | 'transform' | 'won' | 'dead' | 'over';
export type GateStep = 'opening' | 'walking' | 'closing';

export interface CastleOptions {
  /** World seed (drops); Dracula's spots use their own fixed seed unless `bossSeed` is given. */
  seed?: number;
  bossSeed?: number;
}

/** Input with only right held: Simon walking through the door. */
const WALK_RIGHT: InputFrame = { ...NO_INPUT, held: (a) => a === 'right', dirX: 1 };

/**
 * Simon's mini game, Dracula's Castle: a short NES Castlevania-style stage (stage.map) played as
 * Simon with his whip (the chain whip) and the dagger from a candle, hearts as its ammunition;
 * Castlevania stairs, bats, Medusa heads and bone-throwing skeletons. Behind the door at the end
 * Dracula waits on one enemy bar for two phases: the Count (teleports, a three-fireball spread,
 * only his head can be hurt), then his beast form (walks, spits fire, leaps and stomps). Beating
 * the beast passes; losing every hit point, a pit or the clock running out fails; the menu's Give
 * up quits. A World of its own with a fresh GameState runs it, so the campaign is never touched.
 */
export class CastleScene implements Scene {
  readonly world: World;
  readonly state: GameState;
  readonly layout: CastleLayout = castleStage();
  readonly door: CastleDoor;
  readonly life = new BossLife();
  phase: CastlePhase = 'ready';
  gate: GateStep = 'opening';
  /** Frames since the scene started, and in the current phase. */
  t = 0;
  phaseT = 0;
  /** Frames of play the clock has counted. */
  clock = 0;
  dracula: Dracula | null = null;
  beast: Beast | null = null;
  banner: { lines: string[]; until: number; y: number } | null = null;
  private music: string | null = null;
  private readonly bossSeed: number;
  private timeSaid = false;

  constructor(
    private readonly game: Game,
    private readonly done: (result: MiniGameResult) => void,
    opts: CastleOptions = {},
  ) {
    const level = { ...this.layout.level, theme: STAGE_THEME } as typeof this.layout.level;
    const state = newGameState(SIMON);
    state.kit = { ...CASTLE_KIT };
    state.hp = MAX_HP;
    state.lives = 1;
    state.world = 5;
    state.stage = 4;
    this.state = state;
    this.bossSeed = opts.bossSeed ?? 5;
    this.world = new World(level, game.ctx, state, {
      seed: opts.seed ?? levelSeed(level),
      scorePopups: false, // the HUD shows no score
      extraEntities: castleEntities({ onSubWeapon: (p) => this.gotDagger(p) }),
    });
    this.world.time = null;
    this.world.camera.allowLeftScroll = true;
    const d = this.layout.door;
    this.door = new CastleDoor(d.x, d.y, T.CASTLE_BRICK, T.AIR);
    this.world.spawn(this.door);
    // The candles show on READY already; the world does not step until then.
    this.world.spawnInView();
  }

  get player(): Player {
    return this.world.player;
  }

  /** Whole seconds left on the clock. */
  get seconds(): number {
    return Math.max(0, TIME_LIMIT - Math.floor(this.clock / 60));
  }

  get hearts(): number {
    return this.player.scratch.hearts ?? CASTLE_KIT.hearts;
  }

  get hasDagger(): boolean {
    return (this.player.scratch.subs ?? 0) >= 1;
  }

  enter(): void {
    this.game.ctx.audio.stopMusic();
    this.say(
      `Dracula's castle. Play as Simon: ${this.hint('WHIP', 'attack')} lashes the whip. Hold up at the foot of stairs, or down at the top, to take them. Beat Dracula. ${this.hint('MENU', 'start')} for the menu. Ready!`,
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

  private setPhase(p: CastlePhase): void {
    this.phase = p;
    this.phaseT = 0;
  }

  /** Simon's buttons as in a level while he plays; only MENU while the castle takes over. */
  touchLabels(): TouchLabels {
    if (this.phase === 'stage' || this.phase === 'fight')
      return levelTouchLabels(this.world.players[0], this.world);
    if (
      this.phase === 'ready' ||
      this.phase === 'gate' ||
      this.phase === 'intro' ||
      this.phase === 'transform'
    )
      return { ...NO_TOUCH_BUTTONS, start: 'MENU' };
    return { ...NO_TOUCH_BUTTONS };
  }

  private get menuOpen(): boolean {
    return this.phase !== 'won' && this.phase !== 'dead' && this.phase !== 'over';
  }

  update(input: InputFrame): void {
    if (this.phase === 'over') return;
    if (this.menuOpen && input.pressed('start')) {
      this.game.scenes.push(new CastleMenuScene(this.game, () => this.finish('quit')));
      return;
    }
    this.t++;
    this.phaseT++;
    switch (this.phase) {
      case 'ready':
        input.consumeJumpBuffer();
        if (this.phaseT >= READY_FRAMES) {
          this.setPhase('stage');
          this.playMusic(CV_SOUNDS.stage);
        }
        return;
      case 'stage':
        this.tickClock();
        this.step(input);
        if (this.phase === 'stage' && this.atDoor()) this.openGate();
        return;
      case 'gate':
        return this.updateGate();
      case 'intro':
        this.step(NO_INPUT);
        if (this.phaseT >= INTRO_FRAMES) this.startFight();
        return;
      case 'fight':
        this.tickClock();
        return this.step(input);
      case 'transform':
        return this.updateTransform();
      case 'won':
        return this.updateWon();
      case 'dead':
        return this.step(NO_INPUT);
    }
  }

  /** The clock (held by the Infinite time assist); at zero Simon falls. */
  private tickClock(): void {
    if (this.game.ctx.assist.infiniteTime || this.player.dead) return;
    this.clock++;
    if (this.seconds === 30 && !this.timeSaid) {
      this.timeSaid = true;
      this.say('30 seconds left.');
    }
    if (this.seconds <= 0) {
      this.world.kill(this.player);
      this.setPhase('dead');
      this.music = null;
      this.say('Time is up. Try again.');
    }
  }

  /** One frame of the world; a death ends the round once its jingle has played. */
  private step(input: InputFrame): void {
    this.world.update([input]);
    const events = this.world.events.splice(0);
    if (this.phase !== 'dead' && this.player.dead) {
      this.setPhase('dead');
      this.music = null;
      const fell = toPx(this.player.body.y) > SCREEN_H;
      this.say(fell ? 'Simon fell. Try again.' : 'Simon is down. Try again.');
    }
    if (this.phase === 'dead' && events.some((e) => e.type === 'died')) this.finish('fail');
  }

  /* ---------- The dagger ---------- */

  private gotDagger(p: Player): void {
    p.scratch.subs = Math.max(1, p.scratch.subs ?? 0);
    p.scratch.tool = 0;
    this.game.ctx.audio.sfx(CV_SOUNDS.item);
    const use = this.hint('DAGGER', 'special');
    const lines = [
      'YOU GOT THE DAGGER!',
      use.length + 7 <= BANNER_COLS ? `${use}: THROW` : 'SUB-WEAPON: THROW IT',
      'EACH THROW TAKES A HEART',
    ];
    this.banner = { lines, until: this.t + ITEM_BANNER_FRAMES, y: 64 };
    this.say(`You got the dagger! ${use} throws it. Each throw takes a heart; candles give hearts.`);
  }

  /* ---------- The door ---------- */

  private atDoor(): boolean {
    const b = this.player.body;
    if (this.player.dead || !b.onGround || this.player.stairs) return false;
    const d = this.layout.door;
    const feetRow = (b.y + b.h - 1) >> 12;
    return b.x + b.w >= tileToSub(d.x) - px(1) && feetRow >= d.y && feetRow <= d.y + 1;
  }

  private openGate(): void {
    this.setPhase('gate');
    this.gate = 'opening';
    this.banner = null;
    this.stopMusic();
    for (const e of this.world.entities)
      if (e instanceof CvShot || e instanceof Creature || e instanceof MedusaSpawner) e.destroy();
    this.world.camera.locked = true;
    this.door.open(this.world);
    this.say('The door to the throne room opens.');
  }

  private updateGate(): void {
    const cam = this.world.camera;
    const goal = tileToSub(this.layout.roomX);
    const inside = tileToSub(this.layout.roomX + 1) + px(8);
    if (this.gate === 'opening') {
      this.step(NO_INPUT);
      if (this.door.state === 'open') this.gate = 'walking';
      return;
    }
    if (this.gate === 'walking') {
      const walking = this.player.body.x < inside;
      this.step(walking ? WALK_RIGHT : NO_INPUT);
      cam.x = Math.min(goal, cam.x + px(GATE_SCROLL));
      if (cam.x >= goal && this.player.body.x >= inside) {
        this.gate = 'closing';
        this.door.close(this.world);
      }
      return;
    }
    this.step(NO_INPUT);
    if (this.door.state === 'shut') {
      this.setPhase('intro');
      this.playMusic(CV_SOUNDS.boss);
      this.say('Dracula!');
    }
  }

  /* ---------- Dracula ---------- */

  /** The throne room's floor (px): the top of the row under Dracula's feet tile. */
  get floorY(): number {
    return (this.layout.boss.y + 1) * 16;
  }

  private startFight(): void {
    this.dracula = new Dracula(
      this.layout.roomX,
      this.floorY,
      this.life,
      () => this.phaseOneDown(),
      this.bossSeed,
    );
    this.world.spawn(this.dracula);
    this.world.spawn(this.dracula.head);
    this.setPhase('fight');
    this.say('Dracula appears. Only his head can be hurt: jump and whip it.');
  }

  private phaseOneDown(): void {
    this.setPhase('transform');
    this.stopMusic();
    this.game.ctx.audio.sfx(CV_SOUNDS.roar);
    this.say('Dracula transforms into a giant beast!');
  }

  private updateTransform(): void {
    this.step(NO_INPUT);
    const d = this.dracula;
    if (this.phaseT === TRANSFORM_FRAMES >> 1 && d) {
      d.destroy();
      d.head.destroy();
    }
    if (this.phaseT >= TRANSFORM_FRAMES && d) {
      // It rises where he fell, or at the spot farthest from Simon if he stands too close.
      let cx = d.body.x + (d.body.w >> 1);
      const pcx = this.player.centerX;
      if (Math.abs(cx - pcx) < px(56)) {
        const left = tileToSub(this.layout.roomX);
        const spots = SPOTS.map((s) => left + px(s));
        cx = spots.reduce((a, b) => (Math.abs(b - pcx) > Math.abs(a - pcx) ? b : a));
      }
      this.beast = new Beast(cx, this.floorY, this.layout.roomX, this.life, () => this.beastDown());
      this.world.spawn(this.beast);
      this.playMusic(CV_SOUNDS.beast);
      this.game.ctx.audio.sfx(CV_SOUNDS.roar);
      this.setPhase('fight');
    }
  }

  /* ---------- The end ---------- */

  private beastDown(): void {
    this.setPhase('won');
    this.stopMusic();
    for (const e of this.world.entities) if (e instanceof CvShot || e instanceof ShockWave) e.destroy();
    // A round for fun (Game.inRound) frees nobody: no word of the curse.
    const fun = this.game.inRound;
    this.banner = {
      lines: fun ? ['DRACULA IS DEFEATED!'] : ['DRACULA IS DEFEATED!', 'THE CURSE IS BROKEN.'],
      until: Infinity,
      y: 96,
    };
    this.say(fun ? 'Dracula is defeated!' : 'Dracula is defeated! The curse on Simon is broken.');
  }

  private updateWon(): void {
    this.step(NO_INPUT);
    if (this.phaseT === WIN_JINGLE) this.game.ctx.audio.playJingle(CV_SOUNDS.victory);
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

  /** The ENEMY bar's segments: full until the fight, then both phases' hit points. */
  enemyBar(): number {
    return Math.ceil((Math.max(0, this.life.hp) * BAR_SEGMENTS) / BOSS_HP);
  }

  /** Whether Dracula is in his second phase (the beast). */
  get phaseTwo(): boolean {
    return this.beast !== null || this.life.hp <= BEAST_HP;
  }

  render(r: Renderer): void {
    this.world.render(r);
    const assets = this.game.ctx.assets;
    const font = assets.sheet('font');
    if (this.phase === 'transform' && !this.game.ctx.reduceFlashing && (this.phaseT & 8) === 0)
      r.rect(0, HUD_H, SCREEN_W, SCREEN_H - HUD_H, 'rgba(248,56,0,0.25)');
    drawCastleHud(r, assets, {
      hp: this.player.hp,
      maxHp: MAX_HP,
      enemy: this.enemyBar(),
      hearts: this.hearts,
      time: this.seconds,
      sub: this.hasDagger ? 'dagger' : null,
    });
    if (this.phase === 'ready' && (this.game.ctx.reduceFlashing || ((this.phaseT >> 3) & 3) !== 3))
      r.text(font, 'READY', (SCREEN_W - 40) >> 1, 104);
    const b = this.banner;
    if (b && this.t < b.until) drawBanner(r, font, b.lines, b.y);
  }
}

/**
 * Dracula's Castle's own menu: Continue, Give up (ends the round as 'quit'), and in dev mode the
 * assists. Pauses the music.
 */
export class CastleMenuScene extends MiniGameMenuScene {
  constructor(game: Game, giveUp: () => void) {
    super(
      game,
      "DRACULA'S CASTLE",
      giveUp,
      'Simon stays under the curse for now; you can try the castle again later',
    );
  }
}
