import type { Renderer } from '@engine/gfx/renderer';
import type { Scene } from '@engine/scene';
import type { ClassicResume } from '../run-resume';
import { worldLabel } from '../hud/world-label';
import { MenuScene, type MenuItem } from './menu';
import type { Game } from './game';
import { DIFFICULTY_NAMES, type MapSet } from './original-game';
import { GAME_MODE_NAMES } from './original-options';

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
  // Back to the scene the prompt opened over, then the new game (it replaces that one).
  const close = () => {
    while (game.scenes.top && game.scenes.top !== base) game.scenes.pop();
  };
  game.scenes.push(
    new ClassicSetScene(game, set, kept, {
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
    actions: SetActions,
  ) {
    super(game, set.label.toUpperCase(), [], actions.onBack);
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
            new ClassicOverwriteScene(game, set, kept, actions.onNewGame, () => {
              game.scenes.pop();
              this.reannounce();
            }),
          ),
        hint: `Start ${set.label} again. Your saved run will be overwritten`,
      },
    ];
    this.setItems(items);
  }

  override enter(): void {
    const it = this.items[this.index];
    this.game.deps.announcer?.say(
      `${this.set.label.replace(/\.$/, '')}. Saved run: ${savedRunSpoken(this.kept)}. ${it?.label ?? ''}${it?.hint ? `. ${it.hint}` : ''}`,
    );
  }

  /** Back from the warning: the highlighted entry again. */
  reannounce(): void {
    this.announce();
  }

  override render(r: Renderer): void {
    super.render(r);
    const font = this.game.ctx.assets.sheet('font');
    const lines = [`SAVED: ${savedRunLine(this.kept)}`, savedRunHow(this.kept)];
    lines.forEach((l, i) => {
      const t = l.toUpperCase().slice(0, 28);
      if (t) r.text(font, t, 128 - t.length * 4, 120 + i * 14);
    });
  }
}

/**
 * NEW GAME on a set with a saved run: the run will be overwritten. Cancel is focused (the safe
 * choice); only a press answers, and Back is Cancel too.
 */
export class ClassicOverwriteScene extends MenuScene {
  constructor(
    game: Game,
    readonly set: MapSet,
    readonly kept: ClassicResume,
    onConfirm: () => void,
    onCancel: () => void,
  ) {
    super(game, 'OVERWRITE SAVE?', [], onCancel);
    this.setItems([
      { label: 'Cancel', select: onCancel, hint: 'Keep the saved run' },
      {
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
      `Overwrite save? A new game of ${this.set.label} overwrites its saved run, ${savedRunSpoken(this.kept)}. ${it?.label ?? ''}. ${it?.hint ?? ''}`,
    );
  }

  override render(r: Renderer): void {
    super.render(r);
    const font = this.game.ctx.assets.sheet('font');
    const lines = [
      'A NEW GAME OF',
      this.set.label.toUpperCase().slice(0, 28),
      'OVERWRITES ITS SAVED RUN:',
      savedRunLine(this.kept).toUpperCase().slice(0, 28),
      savedRunHow(this.kept).toUpperCase().slice(0, 28),
    ];
    lines.forEach((l, i) => l && r.text(font, l, 128 - l.length * 4, 112 + i * 14));
  }
}
