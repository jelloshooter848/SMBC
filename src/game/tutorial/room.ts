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
import { carriedKit, type Player } from '../entities/player';
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
  AMMO_KEYS,
  chaptersFor,
  FAR_HIT_PX,
  isPreview,
  MoveStats,
  PREVIEW,
  promptText,
  type RoomId,
  type RunKit,
  type TrainingChapter,
  type TrainingLesson,
  type PracticeRoom,
  type RoomGeometry,
} from './lessons';
import { drawPromptBox, wrapPrompt } from './stage-prompts';
import practiceSource from '../../content/levels/practice.map?raw';
import gearSource from '../../content/levels/practice-gear.map?raw';
import waterSource from '../../content/levels/practice-water.map?raw';

const SOURCES: Record<RoomId, string> = { practice: practiceSource, gear: gearSource, water: waterSource };

/**
 * Columns of the prompt box: 25 (200 px) keeps the box centred under the HUD and clear of the
 * health and weapon bars at the left edge (and of a co-op bar at the right).
 */
export const ROOM_COLS = 25;
/** Lines a prompt may take in the box. */
export const ROOM_LINES = 3;
/**
 * Frames a chapter card, GOOD! or READY! shows before a button can move on (so a press already on
 * its way, or the one that ticked the lesson, does not skip it unread). After that the text waits
 * for a button: nothing moves on by itself (owner note 4, 0.4.22).
 */
export const CARD_GUARD_FRAMES = 20;
/** The buttons that move a chapter card, GOOD! or READY! on. */
const GO_ON: readonly Action[] = ['jump', 'attack', 'special', 'select'];
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

const parsed = new Map<RoomId, PracticeLayout>();

/**
 * A practice room (practice.map, and the gear and water screens: practice-gear.map,
 * practice-water.map), parsed once. Like the Mirror Race's course they live outside the level
 * library, so the dev level select and the campaign never list them.
 */
export function practiceRoom(id: RoomId = 'practice'): PracticeLayout {
  const done = parsed.get(id);
  if (done) return done;
  const raw = parseTextMap(SOURCES[id], id === 'practice' ? 'practice' : `practice-${id}`);
  const spot = raw.entities.find((e) => e.type === 'dummy') ?? { x: 9, y: 12 };
  const level: LevelData = { ...raw, entities: raw.entities.filter((e) => e.type !== 'dummy') };
  const at = (x: number, y: number) => level.tiles[y * level.width + x];
  const floorRow = level.start.y + 1;
  // The gap: floor-row columns with nothing in them.
  const open = [...Array(level.width).keys()].filter((x) => at(x, floorRow) === T.AIR);
  // The high ledge: the highest solid tile in the room's first column.
  let ledge = 0;
  while (ledge < level.height && at(0, ledge) === T.AIR) ledge++;
  // The tunnel: open along the floor under a solid roof.
  const solid = (x: number, y: number) => at(x, y) !== T.AIR && at(x, y) !== T.WATER;
  const low = [...Array(level.width).keys()].filter(
    (x) => !solid(x, floorRow - 1) && solid(x, floorRow - 2) && solid(x, floorRow),
  );
  const layout: PracticeLayout = {
    level,
    dummy: { x: spot.x, y: spot.y },
    geometry: {
      floorTop: floorRow * 16,
      ledgeTop: ledge * 16,
      gap: { x0: (open[0] ?? 0) * 16, x1: ((open[open.length - 1] ?? 0) + 1) * 16 },
      tunnel: { x0: (low[0] ?? 0) * 16, x1: low.length ? ((low[low.length - 1] ?? 0) + 1) * 16 : 0 },
    },
  };
  parsed.set(id, layout);
  return layout;
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
export type RoomPhase = 'chapter' | 'lesson' | 'good' | 'ready' | 'over';

export interface RoomOptions {
  /** Which player trains (their input drives the hero). */
  player?: number;
  /**
   * Called once when the room ends: every lesson done ('done'), or Skip training or a skipped
   * chapter ('skip').
   */
  onEnd: (result: TrainingResult) => void;
  /**
   * The training player's kit in the run: lessons for kit it lacks are marked (PREVIEW). Absent
   * (the Arena), nothing is marked.
   */
  run?: RunKit;
}

/**
 * A hero's practice room: one screen per chapter run in a World of its own, with a fresh GameState
 * for the hero (its full kit from `devKit`, so charge shots, missiles and sub-weapons work), so the
 * run's lives, score and power are never touched. Each chapter (lessons.ts) opens with a card that
 * waits for a button, in its own screen (the room, the gear screen or the water screen), built
 * afresh; its lessons come up one at a time in a box near the top, each announced; doing one ticks
 * it off with a sound and GOOD!, which waits for a button; after the last "READY!" waits too and the room ends.
 * Nothing here can kill the hero: hit points stay topped up, the dummy never hurts, and falling in
 * the gap puts the hero back at the start. MENU opens Continue / Skip chapter / Skip training.
 */
export class PracticeRoomScene implements Scene, PracticeRoom {
  world: World;
  readonly tracker: MoveStats;
  readonly chapters: readonly TrainingChapter[];
  readonly lessons: readonly TrainingLesson[];
  readonly state: GameState;
  /** The current lesson (an index into `lessons`). */
  index = 0;
  /** The chapter on screen (an index into `chapters`). */
  chapter = 0;
  phase: RoomPhase = 'chapter';
  /** A chapter was skipped: the room ends 'skip'. */
  skipped = false;
  dummyShoots = false;
  dummy: TargetDummy | null = null;
  private layout: PracticeLayout;
  /** The chapter the room's world was built for. */
  private builtFor = 0;
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
    this.chapters = chaptersFor(hero.id);
    this.lessons = this.chapters.flatMap((c) => c.lessons);
    this.layout = practiceRoom(this.chapters[0]?.room);
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

  /** The chapter lesson `i` belongs to (`chapters.length` past the last). */
  chapterOf(i: number): number {
    let n = 0;
    for (const [c, ch] of this.chapters.entries()) {
      n += ch.lessons.length;
      if (i < n) return c;
    }
    return this.chapters.length;
  }

  /** The index of chapter `c`'s first lesson. */
  firstOf(c: number): number {
    return this.chapters.slice(0, c).reduce((n, ch) => n + ch.lessons.length, 0);
  }

  /** The lesson is for kit the run has not unlocked: its prompt is marked (PREVIEW). */
  preview(lesson = this.lesson): boolean {
    return !!lesson && isPreview(lesson, this.opts.run);
  }

  enter(): void {
    const audio = this.game.ctx.audio;
    audio.stopMusic();
    audio.setTempoScale(1);
    audio.playMusic(this.music());
    this.putUpDummy();
    this.startChapter(0, `${this.hero.name} training. ${spoken(this.hint('MENU', 'start'))} to skip. `);
  }

  /**
   * The room for chapter `c`: built afresh (the hero back at the start with what it carries, a new
   * dummy) unless the world is already that chapter's.
   */
  private enterRoom(c: number): void {
    if (c === this.builtFor) return;
    const ch = this.chapters[c];
    if (!ch) return;
    // What the hero carries goes into the next room: power, health, kit.
    const p = this.player;
    this.state.powerState = p.powerState;
    this.state.hp = p.hp;
    this.state.kit = carriedKit(p);
    this.layout = practiceRoom(ch.room);
    this.tracker.room = this.layout.geometry;
    this.world = this.build();
    this.putUpDummy();
    this.tracker.teleported();
    this.builtFor = c;
  }

  /** Chapter `c`'s card: its title, waiting for a button (or READY! after the last chapter). */
  startChapter(c: number, lead = ''): void {
    const ch = this.chapters[c];
    if (!ch) return this.ready();
    this.enterRoom(c);
    this.chapter = c;
    this.index = this.firstOf(c);
    this.phase = 'chapter';
    this.phaseT = 0;
    this.dummyShoots = false;
    this.tracker.reset();
    const n = ch.lessons.length;
    this.game.deps.announcer?.say(
      `${lead}Chapter ${c + 1} of ${this.chapters.length}: ${spoken(ch.title)}. ${n} ${n === 1 ? 'lesson' : 'lessons'}. Any button to start.`,
    );
  }

  /** Skip chapter (the room's menu): on to the next chapter's card, or READY! after the last. */
  skipChapter(): void {
    if (this.phase === 'over' || this.phase === 'ready') return;
    this.skipped = true;
    this.startChapter(this.chapter + 1);
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
    const prompt = (this.preview() ? PREVIEW : '') + this.promptSource();
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

  /**
   * TrainingLesson `i` comes up (in its chapter's room): counting starts afresh, the room's ammo is
   * topped up, its setup runs, and it is announced.
   */
  startLesson(i: number, lead = ''): void {
    const c = this.chapterOf(i);
    this.enterRoom(c);
    this.chapter = c;
    this.index = i;
    this.phase = 'lesson';
    this.phaseT = 0;
    this.dummyShoots = false;
    this.tracker.reset();
    const lesson = this.lesson;
    if (!lesson) return this.ready();
    this.refill();
    lesson.setup?.(this);
    this.game.deps.announcer?.say(`${lead}${spoken(this.promptWrapped().join(' '))}`);
  }

  /** Ammo and magic back to the room's full kit, so no lesson runs dry from the one before. */
  private refill(): void {
    const kit = this.hero.devKit?.() ?? {};
    for (const key of AMMO_KEYS) {
      const v = kit[key];
      if (v !== undefined) this.player.scratch[key] = v;
    }
  }

  private ready(): void {
    this.phase = 'ready';
    this.phaseT = 0;
    this.dummyShoots = false;
    this.game.ctx.audio.sfx('1up');
    this.game.deps.announcer?.say(`Ready! ${this.hero.name} training complete. Any button to go on.`);
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
      this.game.scenes.push(
        new TrainingMenuScene(
          this.game,
          this.hero,
          () => this.finish('skip'),
          () => this.skipChapter(),
        ),
      );
      return;
    }
    // A card (a chapter's, or READY!) holds the room still and waits for a button.
    if (this.phase === 'chapter' || this.phase === 'ready') {
      this.phaseT++;
      if (this.phaseT < CARD_GUARD_FRAMES || !GO_ON.some((a) => frame.pressed(a))) return;
      frame.consumeJumpBuffer();
      if (this.phase === 'ready') return this.finish(this.skipped ? 'skip' : 'done');
      return this.startLesson(this.index);
    }
    // GOOD! stays up (the hero still moves) until a button: the press goes on and does nothing else.
    if (this.phase === 'good' && this.phaseT >= CARD_GUARD_FRAMES && GO_ON.some((a) => frame.pressed(a))) {
      frame.consumeJumpBuffer();
      return this.next();
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
      this.refill();
      this.lesson?.setup?.(this);
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
    if (src.owner instanceof Projectile) {
      tags.push('shot', src.owner.kind);
      if (src.owner.spec.wave) tags.push('wave');
    } else if (src.kind === 'stomp') tags.push('stomp');
    else if (src.owner === null && src.kind === 'sword') {
      tags.push('melee');
      if (p.scratch.downThrust) tags.push('down-thrust');
      if (p.scratch.upThrust) tags.push('up-thrust');
      if (p.crouching) tags.push('crouch');
    }
    // From afar: the hero's front edge to the dummy's near edge.
    const d = this.dummy;
    if (d) {
      const pb = p.body;
      const db = d.body;
      const gap = pb.x + pb.w < db.x ? db.x - (pb.x + pb.w) : pb.x - (db.x + db.w);
      if (toPx(gap) >= FAR_HIT_PX) tags.push('far');
    }
    this.tracker.hitDummy(tags);
  }

  /** Ticks the lesson off when done: GOOD!, which waits for a button (`update`). */
  private advance(): void {
    this.phaseT++;
    if (this.phase === 'lesson') {
      if (this.lesson?.done(this.tracker)) {
        this.phase = 'good';
        this.phaseT = 0;
        this.dummyShoots = false;
        this.game.ctx.audio.sfx('coin');
        this.game.deps.announcer?.say('Good! Any button to go on.');
      }
    }
  }

  /** After GOOD!: the next lesson in this chapter, or the next chapter's card (READY! after the last). */
  private next(): void {
    const next = this.index + 1;
    if (this.chapterOf(next) === this.chapter) this.startLesson(next);
    else this.startChapter(this.chapter + 1);
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

  /** "ANY BUTTON TO START" under a card. */
  private goOn(what: string): string {
    return fontText(`ANY BUTTON TO ${what}`);
  }

  /**
   * The prompt box's lines: a heading (the hero, the chapter, the lesson's place in it), then the
   * prompt (or GOOD!); a chapter's card, or READY!.
   */
  promptLines(): string[] {
    const name = this.hero.hudName;
    if (this.phase === 'ready' || this.phase === 'over')
      return [fontText(`${name} TRAINING`), 'READY!', '', this.goOn('GO ON')];
    const ch = this.chapters[this.chapter];
    if (!ch) return [fontText(`${name} TRAINING`)];
    if (this.phase === 'chapter')
      return [
        fontText(`${name} TRAINING`),
        fontText(`CHAPTER ${this.chapter + 1}/${this.chapters.length}`),
        fontText(ch.title),
        this.goOn('START'),
      ];
    const n = ch.lessons.length;
    const head = fontText(`${name} ${ch.title} ${this.index - this.firstOf(this.chapter) + 1}/${n}`);
    if (this.phase === 'good') return [head, 'GOOD!', '', this.goOn('GO ON')];
    return [head, ...this.promptWrapped()];
  }

  render(r: Renderer): void {
    this.world.render(r);
    const assets = this.game.ctx.assets;
    drawHud(r, assets, this.state, null, this.world.frame, this.world.players, {
      place: 'TRAINING',
      covered: (x, y, w, h) => this.world.spriteIn(x, y, w, h),
    });
    const font = assets.sheet('font');
    const tick = this.phase === 'good' || this.phase === 'ready' || this.phase === 'over' ? 1 : -1;
    const bottom = drawRoomBox(r, font, this.promptLines(), tick);
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

/**
 * The room's menu: Continue, Skip chapter (on to the next chapter's card) or Skip training (ends
 * the room). Pauses the music.
 */
export class TrainingMenuScene extends MenuScene {
  constructor(game: Game, hero: CharacterDef, skip: () => void, skipChapter?: () => void) {
    super(
      game,
      fontText(`${hero.hudName} TRAINING`),
      [
        { label: 'Continue', select: () => game.scenes.pop() },
        ...(skipChapter
          ? [
              {
                label: 'Skip chapter',
                select: () => {
                  game.scenes.pop();
                  skipChapter();
                },
                hint: 'On to the next chapter',
              },
            ]
          : []),
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
