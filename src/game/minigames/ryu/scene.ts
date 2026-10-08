import type { Scene } from '@engine/scene';
import { NO_INPUT, type InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import type { TouchLabels } from '@engine/input/touch';
import { px, tileToSub, toPx, velToPxf } from '@engine/math/units';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import { levelSeed, World } from '../../world/world';
import { newGameState, type GameState } from '../../context';
import { MAX_HP, RYU } from '../../characters/ryu';
import { NINPO_ARTS } from '../../characters/ryu/weapons';
import { T } from '../../level/tiles';
import type { Player } from '../../entities/player';
import type { Game } from '../../scenes/game';
import { abilityHint, controlScheme } from '../../scenes/hints';
import { levelTouchLabels, NO_TOUCH_BUTTONS } from '../../touch-labels';
import { MiniGameMenuScene } from '../menu';
import { GAME_OVER_FRAMES, lifeLostSaid, MiniLives, type MiniCheckpoint } from '../lives';
import type { MiniGameResult } from '../types';
import { drawBanner } from '../megaman/scene';
import { drawNinja, hasNinjaFrame, NG_SOUNDS, STAGE_THEME } from './art';
import { Creature, NgShot } from './creatures';
import { CLASH_AT, CUT_BEATS, drawCutscene } from './cutscene';
import { CAPTION_OK, CAPTION_SKIP, CaptionPager, drawCaptionKeys } from '../captions';
import { BAR_SEGMENTS, drawNgHud, HUD_H } from './hud';
import { Afterimage, BossLife, INTRO_FRAMES, MASKED_HP, MaskedNinja } from './masked';
import type { DuelLayout as Layout } from './stage';
import { duelEntities, duelStage, type DuelLayout } from './stage';

/** Frames READY shows before Ryu can move. */
export const READY_FRAMES = 75;
/** The stage's clock, in seconds (it runs out: Ryu falls). */
export const TIME_LIMIT = 150;
/** Camera speed onto the rooftop arena (px a frame). */
export const GATE_SCROLL = 4;
/** After the Masked Ninja falls: the jingle, then the round passes. */
export const WIN_JINGLE = 100;
export const WIN_FRAMES = 300;
/** Over the rooftop arena Ryu's head never rises above this (px: the towers' tops). */
export const SKY_TOP = 32;
/** Frames the first cling's banner stays up. */
export const CLIMB_BANNER_FRAMES = 240;
/** Frames the art's banner stays up. */
export const ART_BANNER_FRAMES = 150;
/** Widest banner line. */
export const BANNER_COLS = 26;
/** What a banner never covers, besides Ryu: what he plays for and what he fights. */
export const BANNER_AVOIDS: ReadonlySet<string> = new Set([
  'lantern',
  'art-scroll',
  'pickup',
  'thrower',
  'dog',
  'hawk',
  'masked-ninja',
]);
/** px kept clear around those. */
const BANNER_CLEAR = 4;
/** px kept clear around Ryu, and frames of his rise or fall looked ahead. */
const RYU_SLACK = 16;
const RYU_LOOK_AHEAD = 12;
/** px beside a slot that must be clear for a banner to move there (things scrolling in). */
const BANNER_SCROLL = 32;
/**
 * A banner's first-line y (px) slots, from the strip right under the HUD band (a box starts 6 px
 * above its first line) down to low over the street (a three-line box reaches 38 px below its
 * first line; the floor is at 208).
 */
export const BANNER_SLOTS: readonly number[] = [36, 72, 104, 136, 168];
/** The screen box drawBanner fills for `lines` with its first line at `y`. */
export function bannerBox(
  lines: readonly string[],
  y: number,
): { x: number; y: number; w: number; h: number } {
  const w = Math.max(...lines.map((l) => l.length)) * 8;
  return { x: ((SCREEN_W - w) >> 1) - 8, y: y - 6, w: w + 16, h: lines.length * 12 + 8 };
}
/**
 * Ryu's start kit: his sword, the first ninpo art (the throwing star) and 10 spirit points of
 * 40; the lanterns hold more, and one holds the next art (the windmill shuriken).
 */
export const DUEL_KIT = { arts: 1, ninpo: 10, ninpoMax: 40, tool: 0 } as const;

export type DuelPhase =
  'cutscene' | 'ready' | 'stage' | 'gate' | 'intro' | 'fight' | 'won' | 'dead' | 'gameover' | 'over';

/**
 * Where a life starts (lives.ts, Ninja Gaiden's three lives): the street; the ground past the
 * tower, before the pits; the rooftops before the arena's doorway, once Ryu has gone through it.
 */
export const DUEL_START: MiniCheckpoint = { id: 'start', x: 2, y: 12 };
export const DUEL_MID: MiniCheckpoint = { id: 'mid', x: 66, y: 12, at: 66, rows: [11, 12] };
export const DUEL_BOSS: MiniCheckpoint = { id: 'boss', x: 110, y: 12, at: Infinity };
export type GateStep = 'walking' | 'closing';

export interface DuelOptions {
  /** World seed (drops). */
  seed?: number;
  /** Start at READY, without the cutscene (tests). */
  skipCutscene?: boolean;
}

/** Input with only right held: Ryu walking into the arena. */
const WALK_RIGHT: InputFrame = { ...NO_INPUT, held: (a) => a === 'right', dirX: 1 };

/**
 * Ryu's mini game, Shadow Duel: a Tecmo-style cutscene (skippable), then a short Ninja
 * Gaiden-style stage (stage.map) played as Ryu with his own kit, built around his wall cling:
 * walls to climb and kick between, lanterns holding spirit points, health and a ninpo art,
 * knife throwers, attack dogs and hawks (never near a pit). On the rooftop at the end the Masked
 * Ninja waits (masked.ts). Beating him passes. Losing every hit point, a pit or the clock
 * running out costs one of three lives (the next starts at the last checkpoint); with none left
 * it is GAME OVER and the round fails. The menu's Give up quits. A World of its own with a fresh GameState runs
 * it, so the campaign is never touched.
 */
export class DuelScene implements Scene {
  /** This life's World (a new one at the checkpoint for each life). */
  world: World;
  /** Three lives and the checkpoint the next one starts from. */
  readonly lives: MiniLives;
  readonly state: GameState;
  readonly layout: DuelLayout = duelStage();
  readonly life = new BossLife();
  phase: DuelPhase = 'cutscene';
  gate: GateStep = 'walking';
  /** Frames since the scene started, and in the current phase. */
  t = 0;
  phaseT = 0;
  /** Frames of play the clock has counted. */
  clock = 0;
  boss: MaskedNinja | null = null;
  /** The banner on screen: its lines, until when (scene frames), its first line's y (px). */
  banner: { lines: string[]; until: number; y: number } | null = null;
  /** The cutscene was skipped (tests). */
  skipped = false;
  /** The first cling's banner has shown. */
  clingTaught = false;
  private music: string | null = null;
  private timeSaid = false;
  private readonly seed: number | undefined;
  /** The cutscene's skip prompt: "SKIP" with the JUMP key, as the touch button says. */
  private skipText = 'SKIP';
  private okText = 'OK';
  /** The opening's captions, a page at a time: OK turns them, SKIP ends the cutscene. */
  readonly captions = new CaptionPager(CUT_BEATS);

  constructor(
    private readonly game: Game,
    private readonly done: (result: MiniGameResult) => void,
    opts: DuelOptions = {},
  ) {
    const state = newGameState(RYU);
    state.world = 6;
    state.stage = 2;
    this.state = state;
    this.seed = opts.seed;
    this.lives = new MiniLives({
      start: DUEL_START,
      checkpoints: [DUEL_MID, DUEL_BOSS],
      infinite: () => game.ctx.assist.infiniteLives,
    });
    this.world = this.buildWorld();
    if (opts.skipCutscene) this.setPhase('ready');
  }

  /**
   * A life's World, at the current checkpoint: Ryu with every hit point and his start kit (as in
   * Ninja Gaiden, a death loses the ninpo art he picked up); the lanterns and creatures back.
   */
  private buildWorld(): World {
    const level = { ...this.layout.level, theme: STAGE_THEME } as Layout['level'];
    const state = this.state;
    state.kit = { ...DUEL_KIT };
    state.hp = MAX_HP;
    state.lives = this.lives.lives;
    const { x, y } = this.lives.start;
    const world = new World(level, this.game.ctx, state, {
      x,
      y,
      seed: this.seed ?? levelSeed(level),
      scorePopups: false, // Ninja Gaiden floats no points (the HUD keeps the score)
      deathStyle: 'ninja',
      extraEntities: duelEntities({ onArt: (p) => this.gotArt(p) }, this.layout.pits),
    });
    world.time = null;
    world.camera.allowLeftScroll = true;
    const arenaX = this.layout.roomX * 16;
    world.backdrop = (r) => drawNight(r, this.game.ctx.assets, world.camera.pxX, arenaX);
    world.spawnInView();
    return world;
  }

  get player(): Player {
    return this.world.player;
  }

  /** Whole seconds left on the clock. */
  get seconds(): number {
    return Math.max(0, TIME_LIMIT - Math.floor(this.clock / 60));
  }

  get ninpo(): number {
    return this.player.scratch.ninpo ?? DUEL_KIT.ninpoMax;
  }

  enter(): void {
    this.game.ctx.audio.stopMusic();
    this.skipText = this.hint('SKIP', CAPTION_SKIP);
    this.okText = this.hint('OK', CAPTION_OK);
    if (this.phase === 'cutscene') {
      this.playMusic(NG_SOUNDS.cutscene);
      this.say(`Shadow Duel. ${this.captions.said(this.game)}`);
    } else this.sayReady();
  }

  exit(): void {
    this.game.ctx.audio.setTempoScale(1);
  }

  private sayReady(): void {
    this.say(
      `Play as Ryu: ${this.hint('SLASH', 'attack')} slashes, ${this.castHint()}. ${this.climbHint()} Break lanterns for spirit points. Beat the Masked Ninja. ${this.hint('MENU', 'start')} for the menu. Ready!`,
    );
  }

  /**
   * How to cast. With keys or a pad: "CAST (X) casts a ninpo art". On touch the button carries
   * the name of the art in hand (SHURIKEN, later WINDMILL), so the text names it the same way.
   */
  private castHint(): string {
    if (controlScheme(this.game) !== 'touch') return `${this.hint('CAST', 'special')} casts a ninpo art`;
    const button = levelTouchLabels(this.player, this.world).special ?? 'CAST';
    return `${button} casts your ninpo art`;
  }

  /** How to climb, in the rules card's words (with the JUMP key). */
  private climbHint(): string {
    return `Hold toward a wall in the air to cling; keep holding and tap ${this.hint('JUMP', 'jump')} to climb.`;
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

  private setPhase(p: DuelPhase): void {
    this.phase = p;
    this.phaseT = 0;
  }

  /**
   * Ryu's buttons as in a level while he plays (SLASH hides while he clings, where it does
   * nothing); OK, SKIP and MENU in the cutscene; only MENU while the stage takes over.
   */
  touchLabels(): TouchLabels {
    if (this.phase === 'stage' || this.phase === 'fight') {
      const p = this.world.players[0];
      const out = levelTouchLabels(p, this.world);
      if (p?.clinging) out.attack = null;
      return out;
    }
    if (this.phase === 'cutscene') return { ...NO_TOUCH_BUTTONS, jump: 'OK', attack: 'SKIP', start: 'MENU' };
    if (this.phase === 'ready' || this.phase === 'gate' || this.phase === 'intro')
      return { ...NO_TOUCH_BUTTONS, start: 'MENU' };
    return { ...NO_TOUCH_BUTTONS };
  }

  private get menuOpen(): boolean {
    return (
      this.phase !== 'won' && this.phase !== 'dead' && this.phase !== 'gameover' && this.phase !== 'over'
    );
  }

  update(input: InputFrame): void {
    this.play(input);
    if (this.banner && this.t < this.banner.until)
      this.banner.y = this.bannerY(this.banner.lines, this.banner.y);
  }

  private play(input: InputFrame): void {
    if (this.phase === 'over') return;
    if (this.menuOpen && input.pressed('start')) {
      this.game.scenes.push(new DuelMenuScene(this.game, () => this.finish('quit')));
      return;
    }
    this.t++;
    this.phaseT++;
    switch (this.phase) {
      case 'cutscene': {
        if (input.pressed(CAPTION_SKIP)) this.skipped = true;
        const c = this.captions;
        const pic = c.pic;
        const step = this.skipped ? 'done' : c.update(input.pressed(CAPTION_OK));
        if (pic === CLASH_AT - 1 && c.pic === CLASH_AT) this.game.ctx.audio.sfx(NG_SOUNDS.clang);
        if (step === 'next') this.say(c.said(this.game));
        if (step === 'done') {
          input.consumeJumpBuffer();
          this.stopMusic();
          this.setPhase('ready');
          this.sayReady();
        }
        return;
      }
      case 'ready':
        input.consumeJumpBuffer();
        if (this.phaseT >= READY_FRAMES) {
          this.setPhase('stage');
          this.playMusic(NG_SOUNDS.stage);
        }
        return;
      case 'stage':
        this.tickClock();
        this.step(input);
        if (this.phase === 'stage' && !this.player.dead) {
          const p = this.player;
          this.lives.reach(p.centerX >> 12, (p.body.y + (p.body.h >> 1)) >> 12);
        }
        if (!this.clingTaught && this.player.clinging) this.teachClimb();
        if (this.phase === 'stage' && this.atDoor()) this.openGate();
        return;
      case 'gate':
        return this.updateGate();
      case 'intro':
        this.step(NO_INPUT);
        if (this.phaseT >= INTRO_FRAMES) this.setPhase('fight');
        return;
      case 'fight':
        this.tickClock();
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

  /** What the announcer says as Ryu loses this life (before the count drops): the lives left. */
  private lifeLine(): string {
    return lifeLostSaid('Ryu', this.lives.rest, this.game.ctx.assist.infiniteLives);
  }

  /**
   * The death has played out: with a life left, the next one starts at the checkpoint (READY,
   * a full clock, the Masked Ninja whole again); none left, GAME OVER, and then the round fails.
   */
  private lifeLost(): void {
    const lost = this.lives.lose();
    this.state.lives = Math.max(0, this.lives.lives);
    if (lost === 'over') {
      this.setPhase('gameover');
      this.stopMusic();
      return;
    }
    this.clock = 0;
    this.timeSaid = false;
    this.boss = null;
    this.banner = null;
    this.life.hp = MASKED_HP;
    this.life.iframes = 0;
    this.world = this.buildWorld();
    this.setPhase('ready');
    this.say('Ready!');
  }

  /** The clock (held by the Infinite time assist); at zero Ryu falls. */
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
      this.say(`Time is up. ${this.lifeLine()}`);
    }
  }

  /** One frame of the world; a death costs a life once it has played out (lifeLost). */
  private step(input: InputFrame): void {
    this.world.update([input]);
    // Over the open rooftop the screen's top is a ceiling: Ryu can't climb out over a tower.
    const b = this.player.body;
    if (this.boss && b.y < px(SKY_TOP)) {
      b.y = px(SKY_TOP);
      if (b.vy < 0) b.vy = 0;
    }
    const events = this.world.events;
    let died = false;
    for (const e of events) if (e.type === 'died') died = true;
    events.length = 0;
    // (a trade, Ryu falling in the update that fells the Masked Ninja, still wins)
    if (this.phase !== 'dead' && this.phase !== 'won' && this.player.dead) {
      this.setPhase('dead');
      this.music = null;
      const fell = toPx(this.player.body.y) > SCREEN_H;
      this.say(fell ? `Ryu fell. ${this.lifeLine()}` : this.lifeLine());
    }
    if (this.phase === 'dead' && died) this.lifeLost();
  }

  /* ---------- Banners ---------- */

  /**
   * Where a banner's first line goes (px): one of BANNER_SLOTS. It keeps its slot while its box
   * covers neither Ryu (with RYU_SLACK round him, stretched the way he is moving by
   * RYU_LOOK_AHEAD frames of his rise or fall) nor anything in BANNER_AVOIDS on screen; else it
   * moves to the first slot that is clear (BANNER_SCROLL px either side too). With none clear it stays put unless it is on Ryu
   * himself, and then goes to the slot covering least (Ryu above all). Fixed slots and the slack
   * keep it from creeping or bouncing while he climbs through it.
   */
  private bannerY(lines: readonly string[], y: number): number {
    const cam = this.world.camera;
    type Box = { x: number; y: number; w: number; h: number };
    const screen = (b: Box, slack: number): Box => ({
      x: toPx(b.x) - cam.pxX - slack,
      y: toPx(b.y) - cam.pxY - slack,
      w: toPx(b.w) + 2 * slack,
      h: toPx(b.h) + 2 * slack,
    });
    const hit = (r: Box, b: Box) => r.x < b.x + b.w && b.x < r.x + r.w && r.y < b.y + b.h && b.y < r.y + r.h;
    const things = this.world.entities
      .filter((e) => e.alive && BANNER_AVOIDS.has(e.kind))
      .map((e) => screen(e.body, BANNER_CLEAR));
    const p = this.player;
    const ryu = p.dead ? null : screen(p.body, 0);
    let wide: Box | null = null;
    if (!p.dead) {
      wide = screen(p.body, RYU_SLACK);
      const reach = Math.round(velToPxf(p.body.vy) * RYU_LOOK_AHEAD);
      if (reach < 0) wide.y += reach;
      wide.h += Math.abs(reach);
    }
    // (a slot it moves to must also be clear of what is about to scroll in beside it)
    const cover = (top: number, me: Box | null, scroll = 0) => {
      const r = bannerBox(lines, top);
      r.x -= scroll;
      r.w += 2 * scroll;
      let n = me && hit(r, me) ? 100 : 0;
      for (const b of things) if (hit(r, b)) n++;
      return n;
    };
    const slotted = BANNER_SLOTS.includes(y);
    if (slotted && cover(y, wide) === 0) return y;
    for (const top of BANNER_SLOTS) if (cover(top, wide, BANNER_SCROLL) === 0) return top;
    if (slotted && !(ryu && hit(bannerBox(lines, y), ryu))) return y;
    let best = BANNER_SLOTS[0] as number;
    for (const top of BANNER_SLOTS) if (cover(top, ryu) < cover(best, ryu)) best = top;
    return best;
  }

  /* ---------- The climb ---------- */

  /** The first cling (building A's face): how to climb on from there, once. */
  private teachClimb(): void {
    this.clingTaught = true;
    const jump = this.hint('JUMP', 'jump');
    // Two lines: in the strip under the HUD band it clears the lantern on building A's roof.
    const tap = `AND TAP ${jump} TO CLIMB.`;
    this.banner = {
      lines: ['CLINGING! KEEP HOLDING ON', tap.length <= BANNER_COLS ? tap : 'AND TAP JUMP TO CLIMB.'],
      until: this.t + CLIMB_BANNER_FRAMES,
      y: BANNER_SLOTS[0] as number,
    };
    this.say(`Clinging! Keep holding toward the wall and tap ${jump} to climb.`);
  }

  /* ---------- The ninpo art ---------- */

  private gotArt(p: Player): void {
    const n = Math.min(NINPO_ARTS.length, (p.scratch.arts ?? 0) + 1);
    p.scratch.arts = n;
    p.scratch.tool = n - 1;
    const art = NINPO_ARTS[n - 1];
    this.game.ctx.audio.sfx(NG_SOUNDS.item);
    const name = (art?.name ?? 'NINPO ART').toUpperCase();
    const change = this.hint('NINPO', 'select');
    const lines = [
      'YOU GOT A NINPO ART:',
      name.length <= BANNER_COLS ? name : 'A NEW ART',
      change.length + 12 <= BANNER_COLS ? `${change}: CHANGE ART` : 'NINPO: CHANGE ART',
    ];
    this.banner = { lines, until: this.t + ART_BANNER_FRAMES, y: BANNER_SLOTS[0] as number };
    this.say(`You got a ninpo art: the ${art?.name ?? 'next art'}! ${change} changes art.`);
  }

  /* ---------- The arena's doorway (in the left tower) ---------- */

  private atDoor(): boolean {
    const b = this.player.body;
    if (this.player.dead || !b.onGround) return false;
    const { roomX, doorY, doorH } = this.layout;
    const feetRow = (b.y + b.h - 1) >> 12;
    return b.x + b.w >= tileToSub(roomX) - px(1) && feetRow >= doorY && feetRow < doorY + doorH;
  }

  private openGate(): void {
    this.lives.set('boss');
    this.setPhase('gate');
    this.gate = 'walking';
    this.banner = null;
    this.stopMusic();
    for (const e of this.world.entities) if (e instanceof NgShot || e instanceof Creature) e.destroy();
    this.world.camera.locked = true;
    this.say('Ryu steps out onto the rooftop.');
  }

  private updateGate(): void {
    const cam = this.world.camera;
    const goal = tileToSub(this.layout.roomX);
    const inside = tileToSub(this.layout.roomX + 1) + px(12);
    if (this.gate === 'walking') {
      const walking = this.player.body.x < inside;
      this.step(walking ? WALK_RIGHT : NO_INPUT);
      cam.x = Math.min(goal, cam.x + px(GATE_SCROLL));
      if (cam.x >= goal && this.player.body.x >= inside && this.player.body.onGround) {
        this.gate = 'closing';
        const { roomX, doorY, doorH } = this.layout;
        for (let y = doorY; y < doorY + doorH; y++) this.world.map.set(roomX, y, T.CASTLE_BRICK);
        this.world.audio.sfx(NG_SOUNDS.clang);
      }
      return;
    }
    this.step(NO_INPUT);
    this.startIntro();
  }

  /** The arena's floor (px): the top of the row under the boss's feet tile. */
  get floorY(): number {
    return (this.layout.boss.y + 1) * 16;
  }

  private startIntro(): void {
    const cx = tileToSub(this.layout.boss.x) + px(8);
    this.boss = new MaskedNinja(cx, this.layout.roomX, this.floorY, this.life, () => this.bossDown());
    this.world.spawn(this.boss);
    this.world.spawn(this.boss.afterimage);
    this.setPhase('intro');
    this.playMusic(NG_SOUNDS.boss);
    this.say(
      'The Masked Ninja! He dashes at Ryu: jump him. He runs up the wall and throws stars: keep moving. Strike while he stands or kneels.',
    );
  }

  /* ---------- The end ---------- */

  private bossDown(): void {
    this.setPhase('won');
    this.stopMusic();
    for (const e of this.world.entities) if (e instanceof NgShot || e instanceof Afterimage) e.destroy();
    // A round for fun (Game.inRound) frees nobody: no word of the curse.
    const fun = this.game.inRound;
    this.banner = {
      lines: fun ? ['THE MASKED NINJA FALLS!'] : ['THE MASKED NINJA FALLS!', 'THE CURSE IS BROKEN.'],
      until: Infinity,
      y: 104,
    };
    this.say(fun ? 'The Masked Ninja falls!' : 'The Masked Ninja falls! The curse on Ryu is broken.');
  }

  private updateWon(): void {
    this.step(NO_INPUT);
    if (this.phaseT === WIN_JINGLE) this.game.ctx.audio.playJingle(NG_SOUNDS.victory);
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

  /** The ENEMY bar's segments: full until the fight, then his hit points. */
  enemyBar(): number {
    return Math.ceil((Math.max(0, this.life.hp) * BAR_SEGMENTS) / MASKED_HP);
  }

  render(r: Renderer): void {
    const assets = this.game.ctx.assets;
    const font = assets.sheet('font');
    if (this.phase === 'cutscene') {
      const c = this.captions;
      drawCutscene(r, assets, c.pic, this.game.ctx.reduceFlashing, c.lines);
      drawCaptionKeys(r, font, this.skipText, c.waiting ? this.okText : null);
      return;
    }
    this.world.render(r);
    const p = this.player;
    const arts = Math.max(1, Math.min(NINPO_ARTS.length, p.scratch.arts ?? 1));
    const art = NINPO_ARTS[(p.scratch.tool ?? 0) % arts];
    drawNgHud(r, assets, {
      score: this.state.score,
      stage: `${this.state.world}-${this.state.stage}`,
      lives: this.state.lives,
      hp: p.hp,
      maxHp: MAX_HP,
      enemy: this.enemyBar(),
      ninpo: this.ninpo,
      time: this.seconds,
      art: art?.icon ?? null,
    });
    if (this.phase === 'ready' && (this.game.ctx.reduceFlashing || ((this.phaseT >> 3) & 3) !== 3))
      r.text(font, 'READY', (SCREEN_W - 40) >> 1, 104);
    if (this.phase === 'gameover') {
      r.rect(0, HUD_H, SCREEN_W, SCREEN_H - HUD_H, '#000');
      r.text(font, 'GAME OVER', (SCREEN_W - 72) >> 1, 112);
    }
    const b = this.banner;
    if (b && this.t < b.until) drawBanner(r, font, b.lines, b.y);
  }
}

/**
 * The night behind the stage: the big moon (the cutscene's), drifting slowly with the camera so
 * it hangs in the middle of the sky over the rooftop arena (`arenaX`, px) as in the cutscene (a
 * round of boxes until the sheet has it).
 */
function drawNight(r: Renderer, assets: AssetRegistry, camX: number, arenaX: number): void {
  const x = 96 + ((arenaX - camX) >> 4);
  const y = HUD_H + 10;
  if (hasNinjaFrame(assets, 'cut-moon')) {
    drawNinja(r, assets, 'cut-moon', x, y, 64, 64, MOON);
    return;
  }
  for (let i = 0; i < 40; i += 4) {
    const d = Math.round(Math.sqrt(20 * 20 - (i + 2 - 20) ** 2));
    r.rect(x + 32 - d, y + 12 + i, d * 2, 4, MOON[0]);
  }
}

const MOON = ['#fce0a8', '#fce0a8'] as const;

/**
 * Shadow Duel's own menu: Continue, Give up (ends the round as 'quit'), and in dev mode the
 * assists. Pauses the music.
 */
export class DuelMenuScene extends MiniGameMenuScene {
  constructor(game: Game, giveUp: () => void) {
    super(game, 'SHADOW DUEL', giveUp, 'Ryu stays under the curse for now; you can try the duel again later');
  }
}
