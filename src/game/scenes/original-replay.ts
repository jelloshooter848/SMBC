import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { loadJson, saveJson } from '@engine/save/storage';
import { FONT_COLOURS } from '@content/sprites/font';
import { replayWorlds, type ClassicFileRef, type ClearedFile } from '../original-files';
import { fontText, wrapText } from '../hud/text';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import type { LevelStart } from './level';
import { CharacterSelectScene } from './character-select';
import type { Game } from './game';
import { abilityHint } from './hints';
import { MenuScene, type MenuItem } from './menu';
import { boxGrowth, drawMenuBox, drawMushroom, type BoxRow } from './menu-box';
import { demoUnder, type DemoBackdrop } from './original-box-menu';
import { ClassicBox, closeTo, type ClassicFilesScene } from './original-files-menu';
import { MAP_SETS, type MapSet } from './original-game';
import { levelSelectTarget, worldName } from './level-targets';
import { QUIT_BOX_CY } from './quit-run';
import { advancedCheatsItem } from './advanced-cheats-menu';
import { DEFAULT_SELECT_THEME, drawPanel } from './select-grid';

/*
 * v0.4.73 (owner-approved PR 2): a CLEARED file's level replay, in the Classic style (orange boxes
 * over the CLASSIC title's 1-1 demo, the mushroom cursor, the original's box sounds):
 * - after a set's credits and cheat cards, its file box on the CLEARED file with a message box
 *   over it (clearedNote);
 * - picking a CLEARED file: the first time any is picked, the instructions (once, shared by every
 *   file); then the world box, the level box (true level starts only), the Classic hero select
 *   (Game.replaySelect) and the level, with the file's rules;
 * - a death in it: the death box (RETRY, SELECT CHARACTER, RETURN TO MENU); a clear: back to
 *   that world's level box (Game.leaveReplay).
 * Every box is read out and waits for a press (never a timer), BACK steps back one box, and with
 * Reduce flashing a box is open at once. Nothing here writes the file.
 */

/** The level replay being played: its CLEARED file, and the world and level picked. */
export interface ReplayRun {
  ref: ClassicFileRef;
  world: number;
  stage: number;
  /** The area the level starts in (its intro, or its first area). */
  levelId: string;
  /**
   * Item 134: the file's Advanced cheats fingerprint (Game.advancedCheatsId) as its world box was
   * made; '' for none. Its Advanced cheats play and change only while the slot holds that file.
   */
  fp: string;
}

/** Where the instructions are marked as read (once, for every CLEARED file: D). */
export const REPLAY_HELP_KEY = 'smbc-classic-replay-help';

/** Read this session when storage does not keep the mark (so they still show once). */
const helpReadHere = new WeakMap<Game, true>();

function helpRead(game: Game): boolean {
  return helpReadHere.has(game) || loadJson<unknown>(REPLAY_HELP_KEY) === true;
}

function markHelpRead(game: Game): void {
  helpReadHere.set(game, true);
  saveJson(REPLAY_HELP_KEY, true);
}

/** A note box's text columns (the widest line a Classic box holds, with its margins). */
export const NOTE_COLS = 26;
/** Frames before a page takes a press (so the press that opened it does not close it). */
export const NOTE_GUARD_FRAMES = 30;
const NOTE_LINE = 12;
const NOTE_PAD = 6;
const NOTE_MARGIN = 10;
/** Where a note box is centred over the file box (screen px). */
const NOTE_CY = 140;

export interface NoteOptions {
  /** After the last page's OK (the box has gone). */
  onDone: () => void;
  /** BACK (the box has gone); without it BACK closes the box as OK does. */
  onBack?: () => void;
  /** The box drawn under this one (the file box). */
  under?: Scene | null;
  /** Said before the first page ("Replay"). */
  lead?: string;
}

/**
 * A Classic message box: pages of words (wrapped to fit), each read out, an OK row with the
 * mushroom cursor, OK for the next page, BACK to step back. Over the CLASSIC title (its demo
 * plays on) and the box it was opened from, which stays in view under it.
 */
export class ClassicNoteScene implements Scene {
  readonly translucent = true;
  private page = 0;
  private age = 0;
  private t = 0;
  private readonly over: DemoBackdrop | null;

  constructor(
    private readonly game: Game,
    /** Each page as read out; shown upper-cased in the font. */
    readonly pages: readonly string[],
    private readonly opts: NoteOptions,
  ) {
    this.over = demoUnder(game);
  }

  /** The page shown now, as drawn (wrapped). */
  get lines(): string[] {
    return wrapText(fontText(this.pages[this.page] ?? ''), NOTE_COLS);
  }

  get pageIndex(): number {
    return this.page;
  }

  /** How far the box has grown open (1 at once with Reduce flashing). */
  get openness(): number {
    return boxGrowth(this.age, this.game.ctx.reduceFlashing);
  }

  /** It takes a press now. */
  get interactive(): boolean {
    return this.age > NOTE_GUARD_FRAMES;
  }

  enter(): void {
    this.say(this.opts.lead);
  }

  private say(lead?: string): void {
    const g = this.game;
    const more = this.page < this.pages.length - 1;
    const ok = `${abilityHint(g, 'OK', 'jump')} to ${more ? 'go on' : 'continue'}`;
    const back = this.opts.onBack ? `, ${abilityHint(g, 'BACK', 'attack')} to go back` : '';
    const n = this.pages.length > 1 ? `Page ${this.page + 1} of ${this.pages.length}. ` : '';
    g.deps.announcer?.say(`${lead ? `${lead}. ` : ''}${n}${this.pages[this.page] ?? ''} ${ok}${back}.`);
  }

  touchLabels(): TouchLabels {
    if (!this.interactive) return NO_TOUCH_BUTTONS;
    return { ...NO_TOUCH_BUTTONS, jump: 'OK', attack: 'BACK' };
  }

  update(_input: InputFrame, inputs: InputFrame[]): void {
    this.over?.tickDemo();
    this.t++;
    this.age++;
    for (const f of inputs) f.consumeJumpBuffer();
    if (!this.interactive) return;
    const pressed = (...keys: ('jump' | 'start' | 'attack' | 'select')[]) =>
      inputs.some((i) => keys.some((k) => i.pressed(k)));
    if (pressed('attack', 'select')) {
      this.game.ctx.audio.sfx('bump');
      this.close();
      (this.opts.onBack ?? this.opts.onDone)();
    } else if (pressed('jump', 'start')) {
      this.game.ctx.audio.sfx('coin');
      if (this.page < this.pages.length - 1) {
        this.page++;
        this.age = NOTE_GUARD_FRAMES - 10;
        this.say();
        return;
      }
      this.close();
      this.opts.onDone();
    }
  }

  private close(): void {
    if (this.game.scenes.top === this) this.game.scenes.pop();
  }

  render(r: Renderer): void {
    this.opts.under?.render(r);
    const game = this.game;
    const calm = game.ctx.reduceFlashing;
    const lines = this.lines;
    const cols = Math.max(4, ...lines.map((l) => l.length));
    const w = cols * 8 + NOTE_MARGIN * 2;
    const h = (lines.length + 2) * NOTE_LINE + NOTE_PAD * 2;
    const x = Math.round(128 - w / 2);
    const y = Math.max(0, Math.round(NOTE_CY - h / 2));
    const grow = this.openness;
    const gw = Math.max(2, Math.round(w * grow));
    const gh = Math.max(2, Math.round(h * grow));
    drawPanel(r, Math.round(128 - gw / 2), Math.round(y + h / 2 - gh / 2), gw, gh, DEFAULT_SELECT_THEME);
    if (grow < 1) return;
    const assets = game.ctx.assets;
    const plain = assets.sheet('font');
    lines.forEach((l, i) => r.text(plain, l, x + NOTE_MARGIN, y + NOTE_PAD + i * NOTE_LINE + 2));
    const oy = y + NOTE_PAD + (lines.length + 1) * NOTE_LINE + 2;
    const label = 'OK';
    const lx = Math.round(128 - (label.length * 8) / 2) + 6;
    drawMushroom(r, lx - 12, oy, this.t, calm);
    r.text(assets.sheet('font', DEFAULT_SELECT_THEME.tintFont), label, lx, oy);
    // The BACK line under the box: the box under this one (the file box) draws it at the foot of
    // the screen, where every Classic box has it; with none under, this box draws it there.
    if (!this.opts.under) {
      const back = abilityHint(game, 'BACK', 'attack');
      const bx = Math.round(128 - (back.length * 8) / 2);
      r.text(assets.sheet('font', FONT_COLOURS.black), back, bx + 1, 231);
      r.text(plain, back, bx, 230);
    }
  }
}

const setOf = (id: ClassicFileRef['set']): MapSet =>
  MAP_SETS.find((m) => m.id === id) ?? (MAP_SETS[0] as MapSet);

/**
 * How the beaten set's file came out (Game.clearFile): CLEARED; not saved (storage refused it:
 * its last run is kept); or left alone because another tab emptied it or started another game
 * there (95).
 */
export type ClearResult = 'cleared' | 'failed' | 'twin' | 'other';

/**
 * B: the message after a beaten set's credits and cheat cards, over its file box (focused on the
 * file): "YOU BEAT <SET>! FILE N IS CLEARED.", then how to replay. `saved` false: storage did not
 * take the CLEARED file; its last run is kept in it.
 */
export function clearedNote(
  game: Game,
  files: ClassicFilesScene,
  ref: ClassicFileRef,
  result: ClearResult,
): ClassicNoteScene {
  const beat = `You beat ${setOf(ref.set).label}!`;
  // v0.4.73 (item 60): beaten on Hard (the file as stored says so): its Advanced cheats.
  const advanced =
    result === 'cleared' && game.advancedCheatsOf(ref) !== null ? [ADVANCED_UNLOCKED(ref.slot)] : [];
  const pages =
    result === 'cleared'
      ? [
          `${beat} File ${ref.slot} is cleared.`,
          'Pick a cleared file to replay any level of this map set.',
          ...advanced,
        ]
      : result === 'twin'
        ? [`${beat} File ${ref.slot} was already cleared in another window.`]
        : result === 'failed'
          ? [
              `${beat} File ${ref.slot} could not be saved as cleared.`,
              'Its last run is kept in it, so nothing is lost.',
            ]
          : [
              `${beat} The beat is kept.`,
              `File ${ref.slot} holds another game now, so it was not marked cleared.`,
            ];
  return new ClassicNoteScene(game, pages, {
    under: files,
    onDone: () => files.comeBack(),
  });
}

/** v0.4.73 (item 60): the unlock, said after the credits with the cleared message. */
export const ADVANCED_UNLOCKED = (slot: number) =>
  `Beating it on Hard unlocked ADVANCED CHEATS for File ${slot} only!`;

/**
 * v0.4.73 (item 60): what Advanced cheats are, the first time the file is picked after the
 * unlock (once per file: Game.setAdvancedCheats marks it read on OK).
 */
export const ADVANCED_HELP: readonly string[] = [
  "This file has ADVANCED CHEATS: every assist, for this file's replays only.",
  'Turn them on in ADVANCED CHEATS, on the world box or in the pause menu.',
];

/** D: the instructions, before the first world box any CLEARED file opens. */
export const REPLAY_HELP: readonly string[] = [
  "A cleared file lets you replay any level of its map set, with that file's rules.",
  'Choose a world, then a level, then your hero. Lives are unlimited.',
  'If you lose a life: retry, select character, or return to menu. A clear goes back to the levels.',
  'The file stays cleared: nothing here changes it. Back goes back one box.',
];

/** C, D: a CLEARED file picked on its file box: the instructions the first time, then its worlds. */
export function openClearedFile(game: Game, files: ClassicFilesScene, f: ClearedFile): void {
  const ref: ClassicFileRef = { set: f.set, slot: f.slot };
  const toWorlds = () => game.scenes.push(new ClassicReplayWorldsScene(game, files, f));
  // v0.4.73 (item 60): the file's Advanced cheats box, once (OK marks it read; BACK does not).
  const worlds = () => {
    const adv = game.advancedCheatsOf(ref);
    // Review fix 1: OK marks only the file this box was opened for.
    const id = game.advancedCheatsId(ref) ?? '';
    if (!adv || adv.seen) return toWorlds();
    game.scenes.push(
      new ClassicNoteScene(game, ADVANCED_HELP, {
        under: files,
        lead: `File ${f.slot}, advanced cheats`,
        onDone: () => {
          game.setAdvancedCheats(ref, id, { seen: true });
          toWorlds();
        },
        onBack: () => files.comeBack(),
      }),
    );
  };
  if (helpRead(game)) return worlds();
  game.scenes.push(
    new ClassicNoteScene(game, REPLAY_HELP, {
      under: files,
      lead: `File ${f.slot}, cleared. How the replay works`,
      onDone: () => {
        markHelpRead(game);
        worlds();
      },
      onBack: () => files.comeBack(),
    }),
  );
}

/** "World 3", "World A". */
const worldLabel = (w: number) => `World ${worldName(w)}`;

/** C (1): a CLEARED file's worlds; BACK to the file box. */
export class ClassicReplayWorldsScene extends ClassicBox {
  protected readonly spokenTitle: string;
  /** Item 134: the file's Advanced cheats fingerprint as this box was made ('' for none). */
  readonly advancedId: string;

  constructor(
    game: Game,
    readonly files: ClassicFilesScene,
    readonly file: ClearedFile,
    focus?: number,
    advancedId?: string,
  ) {
    super(game, `Replay file ${file.slot}`, () => {
      closeTo(game, files);
      files.comeBack();
    });
    const set = setOf(file.set);
    this.spokenTitle = `Replay ${set.label.replace(/\.$/, '')}, file ${file.slot}. Choose a world`;
    const worlds = replayWorlds(file);
    const items: MenuItem[] = worlds.map((w) => ({
      label: worldLabel(w),
      select: () => this.openWorld(w),
      hint: 'Choose a level of it',
    }));
    // v0.4.73 (item 60): beaten on Hard: its Advanced cheats, before BACK.
    const ref: ClassicFileRef = { set: file.set, slot: file.slot };
    // Item 134: rebuilt after a replay, the box keeps the replay's fingerprint (advancedId).
    this.advancedId = advancedId ?? game.advancedCheatsId(ref) ?? '';
    if (game.advancedCheatsOf(ref, this.advancedId))
      items.push(
        advancedCheatsItem(
          game,
          ref,
          () => {
            closeTo(game, this);
            this.comeBack();
          },
          this.advancedId,
        ),
      );
    items.push({ label: 'Back', select: () => this.onBack?.(), hint: 'To the files' });
    this.setItems(items);
    if (focus !== undefined) this.index = Math.max(0, worlds.indexOf(focus));
  }

  protected override statusLine(): string {
    return `FILE ${this.file.slot} CLEARED`;
  }

  /** World `w`'s level box over this one, on level `focus` (its first by default). */
  openWorld(w: number, focus?: number, lead?: string): ClassicReplayLevelsScene {
    const box = new ClassicReplayLevelsScene(this.game, this, w, focus, lead);
    this.game.scenes.push(box);
    return box;
  }
}

/** C (2): a world's levels (true level starts only); BACK to the world box. */
export class ClassicReplayLevelsScene extends ClassicBox {
  protected readonly spokenTitle: string;

  constructor(
    game: Game,
    readonly worlds: ClassicReplayWorldsScene,
    readonly world: number,
    focus?: number,
    lead?: string,
  ) {
    super(game, worldLabel(world), () => {
      closeTo(game, worlds);
      worlds.comeBack();
    });
    this.spokenTitle = `${lead ? `${lead} ` : ''}${worldLabel(world)}. Choose a level`;
    const file = worlds.file;
    const set = setOf(file.set);
    const prefix = set.start.replace(/\d+-\d+$/, '');
    const stages = [1, 2, 3, 4].filter((n) => {
      try {
        game.deps.getLevel(`${prefix}${world}-${n}`);
        return true;
      } catch {
        return false;
      }
    });
    const ref: ClassicFileRef = { set: file.set, slot: file.slot };
    const items: MenuItem[] = stages.map((n) => ({
      label: `${worldName(world)}-${n}`,
      select: () =>
        game.replaySelect(ref, world, n, levelSelectTarget(game, set, world, n), worlds.advancedId),
      hint: 'Choose your hero and play it',
    }));
    items.push({ label: 'Back', select: () => this.onBack?.(), hint: 'To the worlds' });
    this.setItems(items);
    if (focus !== undefined) this.index = Math.max(0, stages.indexOf(focus));
  }
}

/**
 * C: back to a CLEARED file's level box for World `world` (BACK from the hero select, a clear,
 * the death box's BACK), the file box and world box under it, on level `stage`; `next`: on the
 * level after it (a clear), when the world has one.
 */
export function showReplayLevels(
  game: Game,
  ref: ClassicFileRef,
  world: number,
  stage: number,
  next = false,
  fp?: string,
): void {
  const files = game.showClassicFiles(ref.set, ref.slot);
  const f = game.classicClearedAt(ref);
  if (!f) return;
  // Item 134: `fp`, the replay's fingerprint, so the rebuilt box stays tied to that file.
  const worlds = new ClassicReplayWorldsScene(game, files, f, world, fp);
  game.scenes.push(worlds);
  // A clear: on the level after it, when the world has one (focused before the box is read out).
  const prefix = setOf(ref.set).start.replace(/\d+-\d+$/, '');
  let focus = stage;
  if (next)
    try {
      game.deps.getLevel(`${prefix}${world}-${stage + 1}`);
      focus = stage + 1;
    } catch {
      /* the world's last level: stay on it */
    }
  worlds.openWorld(world, focus, next ? 'Level clear!' : undefined);
}

/**
 * C (49A): a death in a replayed level: RETRY, SELECT CHARACTER (its BACK comes back here),
 * RETURN TO MENU (the file box, on the file). BACK steps back to the level box. A Classic box over
 * the level, as the Quit card is.
 */
export class ReplayDeathScene extends MenuScene {
  constructor(
    game: Game,
    readonly replay: ReplayRun,
    readonly levelId: string,
    readonly start: LevelStart,
  ) {
    super(
      game,
      `Replay ${worldName(replay.world)}-${replay.stage}`,
      [],
      () => game.leaveReplay('levels'),
      true,
    );
    this.setItems([
      {
        label: 'Retry',
        // v0.4.73 (item 66): a hero no select offers now (dev mode turned off) picks again.
        select: () =>
          game.heroUnoffered(game.state.character) ? this.pickHero() : game.replayRetry(levelId, start),
        hint: 'Play the level again',
      },
      {
        label: 'Select character',
        select: () => this.pickHero(),
        hint: 'Choose a hero, then play the level again',
      },
      { label: 'Return to menu', select: () => game.leaveReplay('files'), hint: 'To the files' },
    ]);
    this.moveSfx = 'fireball';
    this.backSfx = 'bump';
  }

  override enter(): void {
    const it = this.items[this.index];
    this.game.deps.announcer?.say(
      `${this.title}. No life is lost. ${it?.label ?? ''}. ${it?.hint ?? ''}. ${abilityHint(this.game, 'BACK', 'attack')} for the levels.`,
    );
  }

  /** Back here from the hero select. */
  comeBack(): void {
    this.announcePage();
  }

  private pickHero(): void {
    const game = this.game;
    game.scenes.push(
      new CharacterSelectScene(game, {
        player: 0,
        current: game.state.character,
        onPick: (c) => game.replayHero(c, this.levelId, this.start),
        onCancel: () => {
          closeTo(game, this);
          this.comeBack();
        },
        random: true,
        training: false,
      }),
    );
  }

  override render(r: Renderer): void {
    const game = this.game;
    const calm = game.ctx.reduceFlashing;
    const rows: BoxRow[] = this.items.map((it) => ({ label: it.label }));
    const at = drawMenuBox(r, game.ctx.assets, rows, this.index, {
      cx: 128,
      cy: QUIT_BOX_CY,
      grow: 1,
      t: this.t,
      calm,
      header: this.title,
    });
    const back = abilityHint(game, 'BACK', this.backAction);
    const x = Math.round(128 - (back.length * 8) / 2);
    const y = at.y + at.h + 4;
    r.text(game.ctx.assets.sheet('font', FONT_COLOURS.black), back, x + 1, y + 1);
    r.text(game.ctx.assets.sheet('font'), back, x, y);
  }
}
