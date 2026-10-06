import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Action } from '@engine/input/actions';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { TouchLabels } from '@engine/input/touch';
import { px, tileToSub, toPx } from '@engine/math/units';
import { SCREEN_W } from '@engine/viewport';
import { parseTextMap } from '../level/textmap';
import type { LevelData } from '../level/schema';
import { T } from '../level/tiles';
import { levelSeed, World } from '../world/world';
import { newGameState, type GameState } from '../context';
import { startHp, type CharacterDef } from '../characters/character';
import type { Player } from '../entities/player';
import { Projectile, type ProjectileSpec } from '../entities/projectiles/projectile';
import type { DamageSource } from '../rules/damage';
import type { Game } from '../scenes/game';
import { MenuScene } from '../scenes/menu';
import { abilityHint, controlScheme } from '../scenes/hints';
import { drawHud } from '../hud/hud';
import { fontText } from '../hud/text';
import { levelTouchLabels, NO_TOUCH_BUTTONS } from '../touch-labels';
import { TargetDummy } from './dummy';
import {
  lessonsFor,
  MoveStats,
  promptText,
  type TrainingLesson,
  type PracticeRoom,
  type RoomGeometry,
} from './lessons';
import { drawPromptBox, wrapPrompt } from './stage-prompts';
import source from '../../content/levels/practice.map?raw';

/**
 * Columns of the prompt box: 25 (200 px) keeps the box centred under the HUD and clear of the
 * health and weapon bars at the left edge (and of a co-op bar at the right).
 */
export const ROOM_COLS = 25;
/** Lines a prompt may take in the box. */
export const ROOM_LINES = 3;
/** Frames "GOOD!" shows after a lesson before the next prompt. */
export const GOOD_FRAMES = 50;
/** Frames "READY!" shows before the room ends. */
export const READY_FRAMES = 100;
/** Frames before a popped dummy is put back up. */
export const DUMMY_RESPAWN_FRAMES = 45;
/** Frames between the dummy's shots (Link's shield lesson). */
export const DUMMY_SHOT_FRAMES = 90;

/** The dummy's slow shot: flies straight at the hero, harmless to the room's topped-up health. */
const DUMMY_SHOT: ProjectileSpec = {
  kind: 'dummy-shot',
  damage: 'contact',
  amount: 1,
  speed: 0x01400,
  gravity: 0,
  bounceVy: null,
  hitsTiles: false,
  hitsEnemies: false,
  hitsPlayer: true,
  lifetime: 400,
  w: 8,
  h: 8,
  sheet: 'items',
  frames: ['fireball-0', 'fireball-1', 'fireball-2', 'fireball-3'],
  frameRate: 4,
};

export interface PracticeLayout {
  /** The room without its `dummy` line (the room puts the dummy up itself). */
  level: LevelData;
  /** The dummy's tile (feet on the bottom of it). */
  dummy: { x: number; y: number };
  geometry: RoomGeometry;
}

let parsed: PracticeLayout | null = null;

/**
 * The practice room (practice.map), parsed once. Like the Mirror Race's course it lives outside
 * the level library, so the dev level select and the campaign never list it.
 */
export function practiceRoom(): PracticeLayout {
  if (parsed) return parsed;
  const raw = parseTextMap(source, 'practice');
  const spot = raw.entities.find((e) => e.type === 'dummy') ?? { x: 9, y: 12 };
  const level: LevelData = { ...raw, entities: raw.entities.filter((e) => e.type !== 'dummy') };
  const at = (x: number, y: number) => level.tiles[y * level.width + x];
  const floorRow = level.start.y + 1;
  // The gap: floor-row columns with nothing in them.
  const open = [...Array(level.width).keys()].filter((x) => at(x, floorRow) === T.AIR);
  // The high ledge: the highest solid tile in the room's first column.
  let ledge = 0;
  while (ledge < level.height && at(0, ledge) === T.AIR) ledge++;
  parsed = {
    level,
    dummy: { x: spot.x, y: spot.y },
    geometry: {
      floorTop: floorRow * 16,
      ledgeTop: ledge * 16,
      gap: { x0: (open[0] ?? 0) * 16, x1: ((open[open.length - 1] ?? 0) + 1) * 16 },
    },
  };
  return parsed;
}

/**
 * One player's input, also taking player 1's (touch drives player 1 only, so one device can
 * drive player 2's training and answer for them).
 */
export class MergedInput implements InputFrame {
  constructor(private readonly frames: InputFrame[]) {}
  held(a: Action): boolean {
    return this.frames.some((f) => f.held(a));
  }
  pressed(a: Action): boolean {
    return this.frames.some((f) => f.pressed(a));
  }
  released(a: Action): boolean {
    return this.frames.some((f) => f.released(a));
  }
  bufferedJump(w: number): boolean {
    return this.frames.some((f) => f.bufferedJump(w));
  }
  consumeJumpBuffer(): void {
    for (const f of this.frames) f.consumeJumpBuffer();
  }
  get dirX(): -1 | 0 | 1 {
    for (const f of this.frames) if (f.dirX !== 0) return f.dirX;
    return 0;
  }
}

/** Upper-case prompt text read as a sentence ("HOLD JUMP..." → "Hold jump..."). */
export function spoken(text: string): string {
  return text
    .toLowerCase()
    .replace(/(^|[.!?]\s+)([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase());
}

export type TrainingResult = 'done' | 'skip';
export type RoomPhase = 'lesson' | 'good' | 'ready' | 'over';

export interface RoomOptions {
  /** Which player trains (their input drives the hero). */
  player?: number;
  /** Called once when the room ends: every lesson done ('done') or Skip training ('skip'). */
  onEnd: (result: TrainingResult) => void;
}

/**
 * A hero's practice room: one screen run in a World of its own, with a fresh GameState for the
 * hero (its full kit from `devKit`, so charge shots, missiles and sub-weapons work), so the run's
 * lives, score and power are never touched. The lessons (lessons.ts) come up one at a time in a
 * box near the top, each announced; doing one ticks it off with a sound, and after the last
 * "READY!" shows and the room ends. Nothing here can kill the hero: hit points stay topped up,
 * the dummy never hurts, and falling in the gap puts the hero back at the start. MENU opens
 * Continue / Skip training.
 */
export class PracticeRoomScene implements Scene, PracticeRoom {
  world: World;
  readonly tracker: MoveStats;
  readonly lessons: readonly TrainingLesson[];
  readonly state: GameState;
  index = 0;
  phase: RoomPhase = 'lesson';
  dummyShoots = false;
  dummy: TargetDummy | null = null;
  private readonly layout = practiceRoom();
  private phaseT = 0;
  private t = 0;
  private dummyGone = 0;
  private shotT = 0;
  private readonly shots: Projectile[] = [];
  private readonly player_: number;

  constructor(
    private readonly game: Game,
    readonly hero: CharacterDef,
    private readonly opts: RoomOptions,
  ) {
    this.player_ = opts.player ?? 0;
    this.lessons = lessonsFor(hero.id);
    this.tracker = new MoveStats(this.layout.geometry);
    this.state = this.freshState();
    this.world = this.build();
  }

  /** The hero as it starts a level, with its whole kit and full health; one life, no clock. */
  private freshState(): GameState {
    const s = newGameState(this.hero);
    s.kit = this.hero.devKit?.() ?? {};
    if (this.hero.damage.kind === 'hp') s.hp = s.kit.maxHp ?? startHp(this.hero);
    s.lives = 1;
    return s;
  }

  private build(): World {
    const level = this.layout.level;
    const world = new World(level, this.game.ctx, this.state, { seed: levelSeed(level) });
    world.time = null;
    this.dummy = null;
    this.dummyGone = 0;
    return world;
  }

  get player(): Player {
    return this.world.player;
  }

  get lesson(): TrainingLesson | null {
    return this.lessons[this.index] ?? null;
  }

  enter(): void {
    const audio = this.game.ctx.audio;
    audio.stopMusic();
    audio.setTempoScale(1);
    audio.playMusic(this.music());
    this.putUpDummy();
    this.startLesson(0, `${this.hero.name} training. ${spoken(this.hint('MENU', 'start'))} to skip. `);
  }

  exit(): void {
    this.game.ctx.audio.setTempoScale(1);
  }

  private music(): string {
    return this.hero.music ?? this.layout.level.music;
  }

  /** A button's ability for the training player: "SHOOT (X)" with keys or a pad, "SHOOT" on touch. */
  private hint(label: string, action: Action): string {
    return abilityHint(this.game, label, action, this.player_);
  }

  /**
   * The current prompt wrapped for the box: abilities with their keys (`abilityHint`), or the
   * bare names when that would not fit ROOM_LINES lines.
   */
  promptWrapped(): string[] {
    const prompt = this.promptSource();
    const hinted = wrapPrompt(
      promptText(prompt, (l, a) => this.hint(l, a)),
      ROOM_COLS,
    );
    if (hinted.length <= ROOM_LINES) return hinted;
    return wrapPrompt(promptText(prompt), ROOM_COLS).slice(0, ROOM_LINES);
  }

  /**
   * The current lesson's prompt for the controls in use: its touch wording when player 1 trains
   * on touch (touch drives player 1 only), else the usual one.
   */
  promptSource(): string {
    const l = this.lesson;
    if (!l) return '';
    const touch = this.player_ === 0 && controlScheme(this.game) === 'touch';
    return (touch ? l.touchPrompt : undefined) ?? l.prompt;
  }

  /** TrainingLesson `i` comes up: counting starts afresh, its setup runs, and it is announced. */
  startLesson(i: number, lead = ''): void {
    this.index = i;
    this.phase = 'lesson';
    this.phaseT = 0;
    this.dummyShoots = false;
    this.tracker.reset();
    const lesson = this.lesson;
    if (!lesson) return this.ready();
    lesson.setup?.(this);
    this.game.deps.announcer?.say(`${lead}${spoken(this.promptWrapped().join(' '))}`);
  }

  private ready(): void {
    this.phase = 'ready';
    this.phaseT = 0;
    this.dummyShoots = false;
    this.game.ctx.audio.sfx('1up');
    this.game.deps.announcer?.say(`Ready! ${this.hero.name} training complete.`);
  }

  touchLabels(): TouchLabels {
    if (this.phase === 'over') return { ...NO_TOUCH_BUTTONS };
    return levelTouchLabels(this.world.players[0], this.world);
  }

  update(input: InputFrame, inputs: InputFrame[] = [input]): void {
    if (this.phase === 'over') return;
    const own = inputs[this.player_] ?? input;
    const frame = this.player_ === 0 ? own : new MergedInput([own, inputs[0] ?? input]);
    // The OK that opened the room must not make the hero jump.
    if (this.t === 0) frame.consumeJumpBuffer();
    this.t++;
    if (frame.pressed('start')) {
      this.game.scenes.push(new TrainingMenuScene(this.game, this.hero, () => this.finish('skip')));
      return;
    }
    const invuln = this.player.invuln;
    this.world.update([frame]);
    this.world.events.splice(0);
    this.keepSafe();
    this.tendDummy();
    this.tracker.observe(this.player, this.world);
    this.checkShots(invuln);
    this.advance();
  }

  /** Nothing in the room can end it: full health, and the gap leads back to the start. */
  private keepSafe(): void {
    let p = this.player;
    if (p.dead) {
      // Should not happen (nothing hurts for real); start the room's world over.
      this.world = this.build();
      this.putUpDummy();
      this.tracker.teleported();
      p = this.player;
    }
    if (this.hero.damage.kind === 'hp') {
      const max = p.scratch.maxHp ?? startHp(this.hero);
      if (p.hp < max) p.hp = max;
    }
    const b = p.body;
    if (toPx(b.y) > this.layout.geometry.floorTop + 16) {
      const start = this.layout.level.start;
      b.x = tileToSub(start.x) + px((16 - toPx(b.w)) >> 1);
      b.y = tileToSub(start.y + 1) - b.h;
      b.vx = 0;
      b.vy = 0;
      b.onGround = false;
      p.clinging = false;
      p.invuln = Math.max(p.invuln, 30);
      this.tracker.teleported();
      this.game.ctx.audio.sfx('pipe');
    }
  }

  private putUpDummy(): void {
    const d = this.layout.dummy;
    this.dummy = new TargetDummy(tileToSub(d.x) + px(2), tileToSub(d.y + 1), (src) => this.dummyHit(src));
    this.world.spawn(this.dummy);
    this.dummyGone = 0;
  }

  /** A popped dummy goes back up; with `dummyShoots` it fires at the hero now and then. */
  private tendDummy(): void {
    const d = this.dummy;
    if (!d || !d.alive) {
      if (++this.dummyGone >= DUMMY_RESPAWN_FRAMES) this.putUpDummy();
      return;
    }
    if (!this.dummyShoots) {
      this.shotT = DUMMY_SHOT_FRAMES - 30;
      return;
    }
    if (++this.shotT < DUMMY_SHOT_FRAMES || d.stunned > 0) return;
    const p = this.player;
    const db = d.body;
    const dir: -1 | 1 = p.centerX < db.x + (db.w >> 1) ? -1 : 1;
    // Not while the hero stands in the dummy itself (which way would it fire?).
    if (Math.abs(p.centerX - (db.x + (db.w >> 1))) < px(8)) return;
    this.shotT = 0;
    const x = dir < 0 ? db.x - px(DUMMY_SHOT.w) : db.x + db.w;
    const shot = new Projectile(x, db.y + px(8), dir, DUMMY_SHOT, d);
    this.world.spawn(shot);
    this.shots.push(shot);
    this.game.ctx.audio.sfx('fireball');
  }

  /**
   * A dummy shot that ended at the hero, who was not hurt by it and whose shield faced it: the
   * shield took it. `invuln` is the hero's invulnerability before the frame (a hit raises it).
   */
  private checkShots(invuln: number): void {
    const p = this.player;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i] as Projectile;
      if (s.alive) continue;
      this.shots.splice(i, 1);
      const sb = s.body;
      const near =
        Math.abs(sb.x + (sb.w >> 1) - p.centerX) <= px(20) &&
        sb.y + sb.h > p.body.y - px(4) &&
        sb.y < p.body.y + p.body.h + px(4);
      const hurt = p.invuln > invuln;
      if (near && !hurt && p.def.behaviour.blocks?.(p, s)) this.tracker.shieldBlock();
    }
  }

  /** What hit the dummy, for the tracker: the kind, then how ('shot' and its kind, 'melee' and the move). */
  private dummyHit(src: DamageSource): void {
    const tags: string[] = [src.kind];
    const p = this.player;
    if (src.owner instanceof Projectile) tags.push('shot', src.owner.kind);
    else if (src.kind === 'stomp') tags.push('stomp');
    else if (src.owner === null && src.kind === 'sword') {
      tags.push('melee');
      if (p.scratch.downThrust) tags.push('down-thrust');
      if (p.scratch.upThrust) tags.push('up-thrust');
      if (p.crouching) tags.push('crouch');
    }
    this.tracker.hitDummy(tags);
  }

  /** Ticks the lesson off when done; moves on after GOOD!, and ends the room after READY!. */
  private advance(): void {
    this.phaseT++;
    if (this.phase === 'lesson') {
      if (this.lesson?.done(this.tracker)) {
        this.phase = 'good';
        this.phaseT = 0;
        this.dummyShoots = false;
        this.game.ctx.audio.sfx('coin');
        this.game.deps.announcer?.say('Good!');
      }
    } else if (this.phase === 'good') {
      if (this.phaseT >= GOOD_FRAMES) this.startLesson(this.index + 1);
    } else if (this.phase === 'ready' && this.phaseT >= READY_FRAMES) this.finish('done');
  }

  /** The room is over: report it once. */
  finish(result: TrainingResult): void {
    if (this.phase === 'over') return;
    this.phase = 'over';
    const audio = this.game.ctx.audio;
    audio.setTempoScale(1);
    audio.stopMusic();
    this.opts.onEnd(result);
  }

  /** The prompt box's lines: a heading, then the prompt (or GOOD! / READY!). */
  promptLines(): string[] {
    const n = this.lessons.length;
    const head = fontText(`${this.hero.hudName} TRAINING ${Math.min(this.index + 1, n)}/${n}`);
    if (this.phase === 'ready' || this.phase === 'over')
      return [fontText(`${this.hero.hudName} TRAINING`), '', 'READY!'];
    if (this.phase === 'good') return [head, '', 'GOOD!'];
    return [head, ...this.promptWrapped()];
  }

  render(r: Renderer): void {
    this.world.render(r);
    const assets = this.game.ctx.assets;
    drawHud(r, assets, this.state, null, this.world.frame, this.world.players, { place: 'TRAINING' });
    const font = assets.sheet('font');
    const tick = this.phase === 'good' || this.phase === 'ready' || this.phase === 'over';
    const bottom = drawRoomBox(r, font, this.promptLines(), tick ? 2 : -1);
    // How to skip, on the box's bottom edge (like its tag on the top one): never over the floor.
    const skip = this.skipText();
    const sx = (SCREEN_W - skip.length * 8) >> 1;
    r.rect(sx - 4, bottom - 5, skip.length * 8 + 8, 10, '#000');
    r.text(font, skip, sx, bottom - 4);
  }

  /** "MENU (ESC) TO SKIP" with keys, "MENU TO SKIP" on touch. */
  skipText(): string {
    return fontText(`${this.hint('MENU', 'start')} TO SKIP`);
  }
}

/** Top of the room's prompt box: under the HUD and a magic meter. */
export const ROOM_BOX_Y = 44;
/** The room's box is centred with these side margins (ROOM_COLS wide), clear of the health bars. */
const ROOM_BOX_X = (SCREEN_W - (ROOM_COLS * 8 + 8)) >> 1;

/**
 * The room's prompt box: the stage tutorials' box (stage-prompts.ts drawPromptBox), centred under
 * the HUD, ROOM_COLS wide. With `tick` >= 0 a green tick is drawn left of that line (GOOD!, READY!).
 * Returns the box's bottom.
 */
export function drawRoomBox(r: Renderer, font: SpriteSheet, lines: readonly string[], tick = -1): number {
  const y = ROOM_BOX_Y;
  const bottom = drawPromptBox(r, font, lines, { x: ROOM_BOX_X, y });
  const line = lines[tick];
  if (line === undefined) return bottom;
  // Where drawPromptBox puts the line (centred), less the tick's width and a gap.
  const tx = ((SCREEN_W - line.length * 8) >> 1) - 14;
  const ty = y + 6 + tick * 10;
  for (const [dx, dy] of [
    [0, 3],
    [2, 5],
    [4, 3],
    [6, 1],
    [8, -1],
  ] as const)
    r.rect(tx + dx, ty + dy, 2, 2, '#58d854');
  return bottom;
}

/** The room's menu: Continue, or Skip training (ends the room). Pauses the music. */
export class TrainingMenuScene extends MenuScene {
  constructor(game: Game, hero: CharacterDef, skip: () => void) {
    super(
      game,
      fontText(`${hero.hudName} TRAINING`),
      [
        { label: 'Continue', select: () => game.scenes.pop() },
        {
          label: 'Skip training',
          select: () => {
            game.scenes.pop();
            skip();
          },
          hint: 'Training stays in the pause menu during a level',
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
