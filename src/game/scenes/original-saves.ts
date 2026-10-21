import type { Renderer } from '@engine/gfx/renderer';
import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import { FONT_COLOURS } from '@content/sprites/font';
import type { ClassicResume } from '../run-resume';
import { worldLabel } from '../hud/world-label';
import { MenuScene, type MenuItem } from './menu';
import type { Game } from './game';
import { DIFFICULTY_NAMES, type MapSet } from './original-game';
import { GAME_MODE_NAMES } from './original-options';
import { BOX_BACK_Y, BOX_TOP, boxLayout, boxSize, drawMenuBox, type BoxRow } from './menu-box';
import { abilityHint } from './hints';

/*
 * Per-set saves (O-07, owner: one save per map set). Picking a map set on the CLASSIC menu goes
 * through openClassicSet: a set with a saved run asks CONTINUE / NEW GAME (the original's Start
 * menu, StartMenu.as, per set); NEW GAME there first warns that the set's saved run will be
 * overwritten, with Cancel focused. A set with no save starts a new game straight away. Self-
 * contained, so the CLASSIC title's Start menu can call it after its own set picker.
 */

/** Where a saved run is: "World 4-2, 3 lives". */
export function savedRunLine(r: ClassicResume): string {
  return `World ${worldLabel(r.world)}-${r.stage}, ${r.lives} ${r.lives === 1 ? 'life' : 'lives'}`;
}

/** How a saved run plays (RC-002): "Hard, Survival"; empty for a slot from before it was kept. */
export function savedRunHow(r: ClassicResume): string {
  return [r.difficulty && DIFFICULTY_NAMES[r.difficulty], r.gameMode && GAME_MODE_NAMES[r.gameMode]]
    .filter(Boolean)
    .join(', ');
}

/**
 * What Continue restores with the run (owner decision; RC-002): its game mode, then its map
 * difficulty, "Survival, Hard"; empty for a slot from before they were kept.
 */
export function savedRunRestores(r: ClassicResume): string {
  return [r.gameMode && GAME_MODE_NAMES[r.gameMode], r.difficulty && DIFFICULTY_NAMES[r.difficulty]]
    .filter(Boolean)
    .join(', ');
}

/** The saved run in full, as read out: "World 4-2, 3 lives, Hard, Survival". */
export function savedRunSpoken(r: ClassicResume): string {
  const how = savedRunHow(r);
  return how ? `${savedRunLine(r)}, ${how}` : savedRunLine(r);
}

export interface ClassicSetFlow {
  /** Where Back goes from the prompt and from the new game's select (the CLASSIC menu). */
  back: () => void;
  /** A new game of the set (default: its select, as the CLASSIC menu starts one). */
  newGame?: () => void;
}

/**
 * Map set `set` was picked: CONTINUE / NEW GAME when it has a saved run, else a new game at once.
 * The prompt and its warning go on top of the scene that is up; Back from them returns to it.
 */
export function openClassicSet(game: Game, set: MapSet, flow: ClassicSetFlow): void {
  const newGame = flow.newGame ?? (() => game.classicSelect(set.start, flow.back));
  const kept = game.classicResume(set.id);
  if (!kept) return newGame();
  const base = game.scenes.top;
  // Over the CLASSIC title's demo (B-F's boxed set menu, O-04): the prompt is a box over the demo
  // too, and the demo plays on under it.
  const demo = (base as OverDemo | undefined)?.over ?? null;
  // Back to the scene the prompt opened over, then the new game (it replaces that one).
  const close = () => {
    while (game.scenes.top && game.scenes.top !== base) game.scenes.pop();
  };
  game.scenes.push(
    new ClassicSetScene(game, set, kept, demo, {
      onContinue: () => {
        close();
        game.resumeClassic(set.id);
      },
      onNewGame: () => {
        close();
        newGame();
      },
      onBack: () => {
        close();
        // The scene below says where the player is again.
        (base as Reannounces | undefined)?.reannounce?.();
      },
    }),
  );
}

/** A scene that can say its highlighted entry again (the CLASSIC menu). */
type Reannounces = Scene & { reannounce?: () => void };

/** The CLASSIC title's demo a boxed CLASSIC menu is over (original-title.ts). */
export interface ClassicDemo {
  tickDemo(): void;
}
type OverDemo = Scene & { over?: ClassicDemo | null };

/**
 * A prompt as a box over the CLASSIC title's demo: its text on a dark band near the top, its
 * choices in a menu box under it, and the BACK hint, all in the boxed menu's style.
 */
function renderOverDemo(
  r: Renderer,
  game: Game,
  lines: string[],
  items: MenuItem[],
  index: number,
  t: number,
): void {
  const assets = game.ctx.assets;
  const calm = game.ctx.reduceFlashing;
  const shown = lines.map((l) => l.toUpperCase().slice(0, 30)).filter(Boolean);
  // Under the logo (BUG-02), as every box over the demo is, the choices right under the words.
  const top = BOX_TOP;
  const bandH = shown.length * 12 + 10;
  r.rect(8, top, 240, bandH, 'rgba(0,0,0,0.92)');
  const line = (str: string, y: number) => {
    const x = Math.round(128 - (str.length * 8) / 2);
    r.text(assets.sheet('font', FONT_COLOURS.black), str, x + 1, y + 1);
    r.text(assets.sheet('font'), str, x, y);
  };
  shown.forEach((l, i) => line(l, top + 6 + i * 12));
  const rows: BoxRow[] = items.map((it) => ({ label: it.label }));
  const at = boxLayout(rows, false, top + bandH + 2 + boxSize(rows).h / 2);
  drawMenuBox(r, assets, rows, index, { cx: 128, cy: at.cy, grow: 1, t, calm });
  line(abilityHint(game, 'BACK', 'attack'), BOX_BACK_Y);
}

interface SetActions {
  onContinue: () => void;
  onNewGame: () => void;
  onBack: () => void;
}

/** A map set with a saved run: CONTINUE (focused) or NEW GAME; Back returns. */
export class ClassicSetScene extends MenuScene {
  constructor(
    game: Game,
    readonly set: MapSet,
    readonly kept: ClassicResume,
    /** The CLASSIC title's demo it is over, or null (a full-screen menu). */
    readonly demo: ClassicDemo | null,
    actions: SetActions,
  ) {
    super(game, set.label.toUpperCase(), [], actions.onBack, demo !== null);
    const items: MenuItem[] = [
      {
        label: 'Continue',
        select: actions.onContinue,
        hint: `Your saved run: ${savedRunSpoken(kept)}`,
      },
      {
        label: 'New game',
        select: () =>
          game.scenes.push(
            new ClassicOverwriteScene(
              game,
              set,
              kept,
              actions.onNewGame,
              () => {
                game.scenes.pop();
                this.reannounce();
              },
              demo,
            ),
          ),
        hint: `Start ${set.label} again. Your saved run will be overwritten`,
      },
    ];
    this.setItems(items);
  }

  override enter(): void {
    const it = this.items[this.index];
    this.game.deps.announcer?.say(
      `${this.set.label.replace(/\.$/, '')}. Continue or new game. ${it?.label ?? ''}${it?.hint ? `. ${it.hint}` : ''}`,
    );
  }

  /** Back from the warning: the highlighted entry again. */
  reannounce(): void {
    this.announce();
  }

  /** The demo under the box plays on while it is up. */
  override update(input: InputFrame): void {
    this.demo?.tickDemo();
    super.update(input);
  }

  override render(r: Renderer): void {
    const lines = [`SAVED: ${savedRunLine(this.kept)}`, savedRunHow(this.kept)];
    if (this.demo)
      return renderOverDemo(r, this.game, [this.title, ...lines], this.items, this.index, this.t);
    super.render(r);
    const font = this.game.ctx.assets.sheet('font');
    lines.forEach((l, i) => {
      const t = l.toUpperCase().slice(0, 28);
      if (t) r.text(font, t, 128 - t.length * 4, 120 + i * 14);
    });
  }
}

/**
 * NEW GAME on a set with a saved run: the run will be overwritten. Cancel is focused (the safe
 * choice); only a press answers, and Back is Cancel too. `jump`: the pause's Level Select taking
 * the run into this set (it goes on there and writes this set's save from then on), worded so.
 */
export class ClassicOverwriteScene extends MenuScene {
  constructor(
    game: Game,
    readonly set: MapSet,
    readonly kept: ClassicResume,
    onConfirm: () => void,
    onCancel: () => void,
    /** The CLASSIC title's demo it is over, or null (a full-screen menu). */
    readonly demo: ClassicDemo | null = null,
    readonly jump = false,
  ) {
    super(game, 'OVERWRITE SAVE?', [], onCancel, demo !== null);
    this.setItems([
      { label: 'Cancel', select: onCancel, hint: 'Keep the saved run' },
      jump
        ? {
            label: 'Go',
            select: onConfirm,
            hint: `Take this run into ${set.label}; it replaces the saved run there`,
          }
        : {
            label: 'New game',
            select: onConfirm,
            hint: `Start ${set.label} again and overwrite the saved run`,
          },
    ]);
    this.index = 0;
  }

  override enter(): void {
    const it = this.items[this.index];
    this.game.deps.announcer?.say(
      this.jump
        ? `Overwrite save? A new run of ${this.set.label} replaces its saved run: ${savedRunSpoken(this.kept)}. ${it?.label ?? ''}. ${it?.hint ?? ''}`
        : `Overwrite save? A new game of ${this.set.label} overwrites its saved run, ${savedRunSpoken(this.kept)}. ${it?.label ?? ''}. ${it?.hint ?? ''}`,
    );
  }

  /** The demo under the box plays on while it is up. */
  override update(input: InputFrame): void {
    this.demo?.tickDemo();
    super.update(input);
  }

  override render(r: Renderer): void {
    const lines = [
      this.jump ? 'A NEW RUN OF' : 'A NEW GAME OF',
      this.set.label.toUpperCase().slice(0, 28),
      this.jump ? 'REPLACES ITS SAVED RUN:' : 'OVERWRITES ITS SAVED RUN:',
      savedRunLine(this.kept).toUpperCase().slice(0, 28),
      savedRunHow(this.kept).toUpperCase().slice(0, 28),
    ];
    if (this.demo)
      return renderOverDemo(r, this.game, [this.title, ...lines], this.items, this.index, this.t);
    super.render(r);
    const font = this.game.ctx.assets.sheet('font');
    lines.forEach((l, i) => l && r.text(font, l, 128 - l.length * 4, 112 + i * 14));
  }
}
