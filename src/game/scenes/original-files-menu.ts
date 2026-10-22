import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { MapSetId } from '@engine/save/progress';
import { MAP_DIFFICULTIES, type MapDifficulty } from '@engine/save/settings';
import { defaultClassicSettings, isOriginalClassic } from '@engine/save/original-options';
import {
  CLASSIC_FILE_SLOTS,
  eraseClassicFile,
  hasClassicFile,
  loadClassicFile,
  oldRunsWaiting,
  originalFileRules,
  type ClassicFile,
  type ClassicFileRef,
  type ClassicFileRules,
  type ClassicFileSlot,
} from '../original-files';
import { resumeSetOf } from '../run-resume';
import { CLASSIC_EXTRAS } from '../characters/registry';
import { worldLabel } from '../hud/world-label';
import { MenuScene, type MenuItem } from './menu';
import type { FileProblem, Game } from './game';
import { demoUnder, renderBoxedMenu, type DemoBackdrop } from './original-box-menu';
import { DIFFICULTY_NAMES, MAP_SETS, type MapSet } from './original-game';
import {
  ClassicOptionRowsScene,
  GAME_MODE_NAMES,
  GAME_MODE_ROW,
  MORE_SETTINGS_ROWS,
  WEAPON_ROWS,
  optionItem,
  rowsOriginal,
  type OptionStore,
} from './original-options';
import { ClassicHeroesScene, type HeroesOffStore } from './disable-heroes';

/*
 * B-L: Classic mode's save files, in the Classic style (orange boxes over the CLASSIC title's
 * live demo, the mushroom cursor, the original's move, choose, back and coin sounds). Picking a map
 * set on the set box opens its file box: FILE 1-3 (a used file shows its difficulty, where it is
 * and its lives on its row, its hero and score under the box; an empty one NEW GAME), ERASE FILE
 * and BACK. A used file goes on (Game.resumeClassic: CONTINUE, then the select); an empty one
 * asks the Map difficulty, then its rules box (Game mode, More settings, Weapons, Disable heroes,
 * each starting at the original's), and START plays it. ERASE FILE picks a file, then asks
 * "ERASE FILE N?" with NO first. BACK steps back one box everywhere.
 */

/** The short name of a map set, for a run the Level Select cheat took into another set. */
export const SET_SHORT: Record<MapSetId, string> = { smb: 'SMB', special: 'SP', lost: 'LL' };

const setOf = (id: MapSetId): MapSet => MAP_SETS.find((m) => m.id === id) ?? (MAP_SETS[0] as MapSet);

/** Where a file's run is: "4-2", or "SP 2-1" when it is in another map set than its file's. */
export function fileWhere(f: ClassicFile): string {
  const at = `${worldLabel(f.run.world)}-${f.run.stage}`;
  const here = resumeSetOf(f.run.levelId);
  return here === f.set ? at : `${SET_SHORT[here]} ${at}`;
}

/** A used file's row value: "HARD 4-2 X3". */
export function fileRowValue(f: ClassicFile): string {
  const lives = livesShown(f) ? ` x${f.run.lives}` : '';
  return `${DIFFICULTY_NAMES[f.rules.difficulty]} ${fileWhere(f)}${lives}`.toUpperCase();
}

/**
 * Whether a file's lives are shown: always, but for a Survival run with none left (its lives only
 * revive heroes, so "X0" would read as a run that is over).
 */
function livesShown(f: ClassicFile): boolean {
  return !(f.run.lives === 0 && f.run.survival);
}

/** The hero a file plays, by name (a hero toggled off in the Dev menu too, 31d). */
export function fileHeroName(game: Game, f: ClassicFile): string {
  const all = [...game.rosterFor('classic'), ...CLASSIC_EXTRAS];
  return all.find((c) => c.id === f.run.hero)?.name ?? f.run.hero;
}

/** The line under the file box for a used file: its hero and score. */
export function fileDetailLine(game: Game, f: ClassicFile): string {
  return `${fileHeroName(game, f)} SCORE ${f.run.score}`;
}

/** A file's rules as read out: "Survival, Hard" (its Game mode, then its Map difficulty). */
export function fileRulesSpoken(r: ClassicFileRules): string {
  return `${GAME_MODE_NAMES[r.options.gameMode] ?? r.options.gameMode}, ${DIFFICULTY_NAMES[r.difficulty]}`;
}

/**
 * Whether a file plays changed rules beyond its difficulty and Game mode (More settings,
 * Weapons or Disable heroes): its hint says so (FU-7: never silently non-original).
 */
export function fileOwnRules(r: ClassicFileRules): boolean {
  const o = { ...r.options, gameMode: defaultClassicSettings().gameMode };
  return !isOriginalClassic(o) || r.heroesOff.length > 0;
}

/** A used file in full, as read out. */
export function fileSpoken(game: Game, f: ClassicFile): string {
  const own = fileOwnRules(f.rules) ? '. Your own rules are on' : '';
  const r = f.run;
  const here = resumeSetOf(r.levelId);
  const where = `World ${worldLabel(r.world)}-${r.stage}${here === f.set ? '' : ` of ${setOf(here).label.replace(/\.$/, '')}`}`;
  const lives = livesShown(f) ? `${r.lives} ${r.lives === 1 ? 'life' : 'lives'}` : '';
  const parts = [
    DIFFICULTY_NAMES[f.rules.difficulty],
    where,
    lives,
    `score ${r.score}`,
    fileHeroName(game, f),
    GAME_MODE_NAMES[f.rules.options.gameMode],
  ];
  return `${parts.filter(Boolean).join(', ')}${own}`;
}

/** A kept file that cannot be read (as the campaign's file select shows one). */
const UNREADABLE = 'UNREADABLE';

/**
 * 31d: why a file that reads cannot play now (Game.classicFileProblem), shown on its row and
 * read out: never "cannot be read", and erasing is not the only way back.
 */
function problemRow(
  game: Game,
  f: ClassicFile,
  problem: FileProblem,
): {
  value: string;
  why: string;
} {
  if (problem === 'not-released') {
    // 0.4.72: played in dev mode by a hero players do not have yet; never played as another.
    const name = fileHeroName(game, f);
    return {
      value: 'NOT RELEASED',
      why: `Its hero, ${name}, is not released yet. Turn dev mode on to play it`,
    };
  }
  if (problem === 'hero-off') {
    const name = fileHeroName(game, f);
    return {
      value: 'HERO OFF',
      why: `Its hero, ${name}, is off in Dev > Toggle heroes. Turn ${name} on there to play it`,
    };
  }
  const what = problem === 'hero' ? 'hero' : 'level';
  return {
    value: 'CANNOT PLAY',
    why: `Its ${what} is not in this version of the game. A version that has it can play it, or erase it to use it again`,
  };
}

/** "File 2" */
const fileName = (slot: ClassicFileSlot) => `File ${slot}`;

/**
 * 31a: an old save (from before the files) whose set was full waits for a free file and moves
 * into the next file that is freed. The words for it, said and shown.
 */
const OLD_SAVE = 'A game saved by an older version';

/**
 * A Classic box page over the CLASSIC title's demo (BUG-01's boxes): the original's sounds, the
 * demo playing on under it, the rows drawn by renderBoxedMenu with the page's name on top and a
 * status line under the box. Away from the demo (never in play) the usual full-screen page.
 */
abstract class ClassicBox extends MenuScene {
  protected readonly over: DemoBackdrop | null;
  /** Says the page's name first when it opens. */
  protected abstract readonly spokenTitle: string;

  constructor(game: Game, title: string, onBack: () => void) {
    super(game, title, [], onBack);
    this.over = demoUnder(game);
    if (this.over) {
      this.translucent = true;
      this.moveSfx = 'fireball';
      this.backSfx = 'bump';
      this.adjustSfx = 'coin';
      this.okAdjustSfx = 'coin';
    }
  }

  /** The line under the box for the highlighted row ('' for none). */
  protected statusLine(): string {
    return this.status;
  }

  /** The highlighted row as read out. */
  protected spoken(): string {
    const it = this.items[this.index];
    if (!it) return '';
    const v = it.value ? `: ${it.value()}` : '';
    const line = `${it.label.replace(/\*$/, '')}${v}`;
    return it.hint ? `${line.replace(/\.$/, '')}. ${it.hint}` : line;
  }

  override enter(): void {
    this.game.deps.announcer?.say(`${this.spokenTitle}. ${this.spoken()}`);
  }

  protected override announce(): void {
    this.game.deps.announcer?.say(this.spoken());
  }

  /** Back to this page from one over it: its rows again, then the highlighted one read. */
  comeBack(): void {
    this.refresh();
    this.announce();
  }

  /** Rebuild the rows (after a change on a page over this one). */
  protected refresh(): void {}

  override update(input: InputFrame): void {
    this.over?.tickDemo();
    super.update(input);
  }

  override render(r: Renderer): void {
    if (!this.over) {
      const keep = this.status;
      this.status = this.statusLine();
      super.render(r);
      this.status = keep;
      return;
    }
    renderBoxedMenu(r, this.game, {
      backAction: this.backAction,
      header: this.title,
      items: this.items,
      index: this.index,
      t: this.t,
      status: this.statusLine(),
      age: this.t,
    });
  }
}

/** Pops scenes until `scene` is on top. */
function closeTo(game: Game, scene: MenuScene): void {
  while (game.scenes.top && game.scenes.top !== scene) game.scenes.pop();
}

/**
 * Map set `set`'s file box: FILE 1-3, ERASE FILE (a row of its own, so a file is never erased by
 * accident), BACK (to the set box).
 */
export class ClassicFilesScene extends ClassicBox {
  protected readonly spokenTitle: string;
  private files: (ClassicFile | null)[] = [];
  /** Every file that reads, playable or not (31d), for ERASE FILE and the line under the box. */
  private readable: (ClassicFile | null)[] = [];
  /**
   * After ERASE, shown under its file until the cursor moves: 31a, an old save just moved into it;
   * 39a, the erase was refused (storage).
   */
  private note: { slot: ClassicFileSlot; moved: boolean } | null = null;

  constructor(
    game: Game,
    readonly set: MapSet,
    focus?: ClassicFileSlot,
    onBack: () => void = () => {
      game.scenes.pop();
      (game.scenes.top as Partial<ClassicBox> | undefined)?.comeBack?.();
    },
  ) {
    super(game, set.label.toUpperCase(), onBack);
    this.spokenTitle = `${set.label.replace(/\.$/, '')}. Choose a file`;
    this.refresh();
    if (focus) this.index = focus - 1;
  }

  /** The file on a row (FILE 1-3), or undefined for the ERASE FILE and BACK rows. */
  private slotAt(i: number): ClassicFileSlot | undefined {
    return CLASSIC_FILE_SLOTS[i];
  }

  protected override refresh(): void {
    const game = this.game;
    this.files = game.classicFiles(this.set.id);
    this.readable = CLASSIC_FILE_SLOTS.map((slot) => loadClassicFile({ set: this.set.id, slot }));
    const items: MenuItem[] = CLASSIC_FILE_SLOTS.map((slot, i) => {
      const f = this.files[i] ?? null;
      const ref = { set: this.set.id, slot };
      const kept = this.readable[i] ?? null;
      const problem = !f && kept ? game.classicFileProblem(ref) : null;
      if (kept && problem) {
        const { value, why } = problemRow(game, kept, problem);
        return {
          label: fileName(slot),
          value: () => value,
          select: () => {
            game.ctx.audio.sfx('bump');
            game.deps.announcer?.say(`${fileName(slot)}: ${why.charAt(0).toLowerCase()}${why.slice(1)}.`);
          },
          hint: `${fileSpoken(game, kept)}. ${why}`,
        };
      }
      if (!f && game.classicFileState({ set: this.set.id, slot }) === 'unreadable')
        return {
          label: fileName(slot),
          value: () => UNREADABLE,
          select: () => {
            game.ctx.audio.sfx('bump');
            game.deps.announcer?.say(`${fileName(slot)} cannot be read. Erase it to use it again.`);
          },
          hint: 'Cannot be read. Erase it to use it again',
        };
      return f
        ? {
            label: fileName(slot),
            value: () => fileRowValue(f),
            select: () => this.play(slot),
            hint: `${fileSpoken(game, f)}. Continue this file`,
          }
        : {
            label: fileName(slot),
            value: () => 'NEW GAME',
            select: () => this.openNew(slot, originalFileRules(), false),
            hint: 'Empty. Start a new game here: choose its difficulty and rules',
          };
    });
    const used = this.inUse.some(Boolean);
    const waiting = oldRunsWaiting(this.set.id) > 0;
    items.push(
      {
        label: 'Erase file',
        select: () => this.erase(),
        hint: `${used ? 'Choose a file to erase' : 'Every file is empty'}${waiting ? `. ${OLD_SAVE} is waiting for a free file` : ''}`,
      },
      { label: 'Back', select: () => this.onBack?.(), hint: 'To the map sets' },
    );
    this.setItems(items);
  }

  protected override statusLine(): string {
    const slot = this.slotAt(this.index);
    if (slot && slot === this.note?.slot)
      return this.note.moved
        ? `OLD SAVE MOVED INTO ${fileName(slot).toUpperCase()}`
        : `${fileName(slot).toUpperCase()} COULD NOT BE ERASED`;
    const f = slot ? this.readable[slot - 1] : null;
    return f ? fileDetailLine(this.game, f) : '';
  }

  /** A used file goes on (CONTINUE, then the select). */
  private play(slot: ClassicFileSlot): void {
    if (!this.game.resumeClassic({ set: this.set.id, slot })) {
      this.game.ctx.audio.sfx('bump');
      this.comeBack();
    }
  }

  /**
   * A new game on empty file `slot`: its difficulty box, then its rules box with `draft`.
   * `atRules`: straight back to the rules box (BACK from the new game's select), the
   * difficulty box under it.
   */
  openNew(slot: ClassicFileSlot, draft: ClassicFileRules, atRules: boolean): void {
    const ref: ClassicFileRef = { set: this.set.id, slot };
    const diff = new ClassicDifficultyScene(this.game, ref, draft, this);
    this.game.scenes.push(diff);
    if (atRules) diff.openRules(true);
  }

  /** Per file: anything stored there (used, or unreadable), so ERASE FILE can empty it. */
  get inUse(): boolean[] {
    return CLASSIC_FILE_SLOTS.map(
      (slot) => this.game.classicFileState({ set: this.set.id, slot }) !== 'empty',
    );
  }

  private erase(): void {
    if (!this.inUse.some(Boolean)) {
      this.game.ctx.audio.sfx('bump');
      this.game.deps.announcer?.say('Every file is empty.');
      return;
    }
    this.game.scenes.push(new ClassicEraseScene(this.game, this));
  }

  /** The files that read, playable or not (ERASE FILE's picker reads them). */
  get shown(): readonly (ClassicFile | null)[] {
    return this.readable;
  }

  protected override announce(): void {
    if (this.note !== null && this.slotAt(this.index) !== this.note.slot) this.note = null;
    super.announce();
  }

  /**
   * ERASE FILE's YES: file `slot` emptied, then the box again on it (erased). 39a: whether the
   * file is gone is read right after the erase, so a refused erase (storage throwing) is never
   * told as an old save moving in.
   */
  eraseFile(slot: ClassicFileSlot): void {
    const ref: ClassicFileRef = { set: this.set.id, slot };
    eraseClassicFile(ref);
    this.erased(slot, !hasClassicFile(ref));
  }

  /**
   * After ERASE: the box again, on the erased file, saying so. 31a: an old save that was waiting
   * for a free file (its set was full) has moved into it on this read: that is said, then the
   * file as it is now. 39a: only when the file was empty right after the erase (`emptied`), so
   * what is in it now came in on this read (even when its old key could not be removed); a file
   * still there right after the erase was not erased.
   */
  private erased(slot: ClassicFileSlot, emptied: boolean): void {
    closeTo(this.game, this);
    this.refresh();
    this.index = slot - 1;
    const erased = `${fileName(slot)} erased.`;
    if (this.game.classicFileState({ set: this.set.id, slot }) === 'empty') {
      this.note = null;
      this.game.deps.announcer?.say(`${erased} ${this.spoken()}`);
      return;
    }
    if (emptied) {
      this.note = { slot, moved: true };
      const hint = this.items[this.index]?.hint ?? '';
      this.game.deps.announcer?.say(`${erased} ${OLD_SAVE} moved into ${fileName(slot)}: ${hint}.`);
      return;
    }
    this.note = { slot, moved: false };
    this.game.ctx.audio.sfx('bump');
    this.game.deps.announcer?.say(`${fileName(slot)} could not be erased. ${this.spoken()}`);
  }
}

/** A new file's Map difficulty: Easy, Normal or Hard (the original's MAP_DIFFICULTY). */
const DIFFICULTY_HINTS: Record<MapDifficulty, string> = {
  easy: "The original's easier version of every level",
  normal: 'Every level as the original game has it',
  hard: "The original's harder version of every level",
};

export class ClassicDifficultyScene extends ClassicBox {
  protected readonly spokenTitle: string;

  constructor(
    game: Game,
    readonly ref: ClassicFileRef,
    readonly draft: ClassicFileRules,
    readonly files: ClassicFilesScene,
  ) {
    super(game, 'Difficulty', () => {
      closeTo(game, files);
      files.comeBack();
    });
    this.spokenTitle = `${fileName(ref.slot)}, new game. Choose the map difficulty; it is fixed for this file`;
    this.setItems([
      ...MAP_DIFFICULTIES.map((d) => ({
        label: DIFFICULTY_NAMES[d],
        select: () => {
          this.draft.difficulty = d;
          this.openRules();
        },
        hint: DIFFICULTY_HINTS[d],
      })),
      { label: 'Back', select: () => this.onBack?.(), hint: 'To the files' },
    ]);
    this.index = Math.max(0, MAP_DIFFICULTIES.indexOf(draft.difficulty));
  }

  /** The file's rules box, over this one; `atStart`: on its START (back from the hero select). */
  openRules(atStart = false): void {
    this.game.scenes.push(new ClassicFileRulesScene(this.game, this.ref, this.draft, this, atStart));
  }
}

/**
 * A new file's rules box: Game mode, More settings, Weapons, Disable heroes (each sub-page a box,
 * every value starting at the original's), then START. Nothing here is saved until the file's
 * first WORLD card writes it with these rules, and nothing goes into the shared settings.
 */
export class ClassicFileRulesScene extends ClassicBox {
  protected readonly spokenTitle: string;

  constructor(
    game: Game,
    readonly ref: ClassicFileRef,
    readonly draft: ClassicFileRules,
    readonly below: ClassicDifficultyScene,
    atStart = false,
  ) {
    super(game, `File ${ref.slot} rules`, () => {
      closeTo(game, below);
      below.comeBack();
    });
    this.spokenTitle = `${fileName(ref.slot)} rules, ${DIFFICULTY_NAMES[draft.difficulty]}. They are fixed once the file starts. Left and right to change`;
    this.refresh();
    // 38c: back from the new game's hero select, on START again (the row that opened it).
    if (atStart)
      this.index = Math.max(
        0,
        this.items.findIndex((i) => i.label === 'Start'),
      );
  }

  private get options(): OptionStore {
    return { get: () => this.draft.options, changed: () => {} };
  }

  private get heroesOff(): HeroesOffStore {
    return {
      get: () => this.draft.heroesOff,
      set: (off) => {
        this.draft.heroesOff = off;
      },
    };
  }

  protected override refresh(): void {
    const game = this.game;
    const sub = (title: string, spoken: string, rows: Parameters<typeof rowsOriginal>[0]) => () =>
      game.scenes.push(
        new ClassicOptionRowsScene(game, title, rows, spoken, () => this.backHere(), this.options),
      );
    const state = (rows: Parameters<typeof rowsOriginal>[0]) => () =>
      rowsOriginal(rows, this.draft.options) ? 'Original' : 'Changed';
    this.setItems([
      optionItem(game, GAME_MODE_ROW, () => this.refresh(), this.options),
      {
        label: 'More settings',
        value: state(MORE_SETTINGS_ROWS),
        select: sub('MORE SETTINGS', 'More settings', MORE_SETTINGS_ROWS),
        hint: 'Lives, attack, when hit, item drops, piranhas, goombas and enemy speed',
      },
      {
        label: 'Weapons',
        value: state(WEAPON_ROWS),
        select: sub('CUSTOMIZE WEAPONS', 'Customize weapons', WEAPON_ROWS),
        hint: "Each hero's weapons",
      },
      {
        label: 'Disable heroes',
        value: () => (this.draft.heroesOff.length ? 'Some off' : 'All on'),
        select: () => game.scenes.push(new ClassicHeroesScene(game, () => this.backHere(), this.heroesOff)),
        hint: 'Leave heroes out of the select and Random',
      },
      {
        label: 'Start',
        select: () => this.start(),
        hint: `Start ${fileName(this.ref.slot)} with these rules, then choose your hero`,
      },
      { label: 'Back', select: () => this.onBack?.(), hint: 'To the difficulty' },
    ]);
  }

  /** Back from a sub-page: this box, its values rebuilt. */
  private backHere(): void {
    closeTo(this.game, this);
    this.comeBack();
  }

  private start(): void {
    const { game, ref, draft } = this;
    game.startClassicFile(ref, draft, () => game.showNewFile(ref, draft));
  }
}

/** ERASE FILE: which file (an empty one cannot be picked), then the confirm. */
export class ClassicEraseScene extends ClassicBox {
  protected readonly spokenTitle = 'Erase file. Choose a file to erase';

  constructor(
    game: Game,
    readonly files: ClassicFilesScene,
  ) {
    super(game, 'Erase file', () => {
      closeTo(game, files);
      files.comeBack();
    });
    this.refresh();
    const first = files.inUse.findIndex(Boolean);
    this.index = Math.max(0, first);
  }

  protected override refresh(): void {
    const game = this.game;
    const inUse = this.files.inUse;
    const items: MenuItem[] = CLASSIC_FILE_SLOTS.map((slot, i) => {
      const f = this.files.shown[i] ?? null;
      if (!f && inUse[i])
        return {
          label: fileName(slot),
          value: () => UNREADABLE,
          select: () => game.scenes.push(new ClassicEraseConfirmScene(game, slot, null, this.files, this)),
          hint: 'Cannot be read',
        };
      return f
        ? {
            label: fileName(slot),
            value: () => fileRowValue(f),
            select: () => game.scenes.push(new ClassicEraseConfirmScene(game, slot, f, this.files, this)),
            hint: fileSpoken(game, f),
          }
        : {
            label: fileName(slot),
            value: () => 'EMPTY',
            select: () => {
              game.ctx.audio.sfx('bump');
              game.deps.announcer?.say(`${fileName(slot)} is empty.`);
            },
            hint: 'Empty: nothing to erase',
          };
    });
    items.push({ label: 'Back', select: () => this.onBack?.(), hint: 'To the files' });
    this.setItems(items);
  }
}

/** "ERASE FILE N?": NO (focused, and BACK) or YES, which empties the file. */
export class ClassicEraseConfirmScene extends ClassicBox {
  protected readonly spokenTitle: string;

  constructor(
    game: Game,
    readonly slot: ClassicFileSlot,
    readonly file: ClassicFile | null,
    readonly files: ClassicFilesScene,
    readonly picker: ClassicEraseScene,
  ) {
    super(game, `Erase file ${slot}?`, () => {
      closeTo(game, picker);
      picker.comeBack();
    });
    const what = file ? fileSpoken(game, file) : 'It cannot be read';
    // 31a: an old save waiting for a free file moves into this one once it is erased.
    const then =
      oldRunsWaiting(files.set.id) > 0 ? `. ${OLD_SAVE} will then move into ${fileName(slot)}` : '';
    this.spokenTitle = `Erase file ${slot}? ${what}. It cannot be undone${then}`;
    this.setItems([
      { label: 'No', select: () => this.onBack?.(), hint: 'Keep the file' },
      {
        label: 'Yes',
        select: () => {
          files.eraseFile(slot);
        },
        hint: `Erase ${fileName(slot)} for good`,
      },
    ]);
    this.index = 0;
  }
}

/** For Game: a new file box over the set box, the CLASSIC title under them. */
export function filesBoxFor(game: Game, set: MapSetId, focus?: ClassicFileSlot): ClassicFilesScene {
  return new ClassicFilesScene(game, setOf(set), focus);
}
