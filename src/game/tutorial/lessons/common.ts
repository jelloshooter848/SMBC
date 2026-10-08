import type { Action } from '@engine/input/actions';
import type { Entity } from '../../entities/entity';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import type { MoveStats } from '../lessons';

/*
 * Hero training (docs/HEROES.md): what every hero's lessons share. Each hero's chapters live in
 * lessons/<hero>.ts; lessons.ts gathers them, holds the tracker (MoveStats) and re-exports this.
 * Prompts name abilities the way the hero's guide and touch buttons do (JUMP, SWORD, SHOOT,
 * BOOMERANG...), never button letters, and wrap to the room's prompt box (25 columns, 3 lines).
 *
 * Training starts from the hero's basic kit (items/heroes.ts heroStart, the campaign's first
 * kit), whatever the run holds; a lesson with `item` puts that power-up in the room, and the
 * player grabs it, then uses it. The run's kit comes back afterwards.
 */

/**
 * A hero power-up's id (docs/POWERUPS.md, items/catalog.ts: `long-beam`, `bomb-bag`, the grow
 * item `heart-container`...; Mario's and Luigi's are SMB's `mushroom` and `fire-flower`). The
 * catalog keeps its ids as plain strings, so this is one too: lessons.test.ts checks each
 * lesson's `item` is one of its hero's.
 */
export type ItemId = string;

/**
 * `[LABEL:action]`: a button's ability in a prompt; `[LABEL:action:TOUCH]` also names what the
 * touch button says for it (its caption: BOOMERANG, SAW, AXE...), shown instead on touch.
 */
const TOKEN = /\[([^:\]]+):(\w+)(?::([^\]]+))?\]/g;

/**
 * A prompt's text: each `[LABEL:action]` through `hint` (the room passes `abilityHint`), or the
 * bare label without one. On `touch` a token's touch caption replaces its label (owner pick,
 * 0.4.34: touch prompts name the tool or weapon as its button does; keys and pads keep the
 * ability names).
 */
export function promptText(
  prompt: string,
  hint?: (label: string, action: Action) => string,
  touch = false,
): string {
  return prompt.replace(TOKEN, (_m, label: string, action: string, caption?: string) => {
    const name = touch && caption ? caption : label;
    return hint ? hint(name, action as Action) : name;
  });
}

/** The labels a touch player would read for a prompt's tokens (their captions where given). */
export function touchNames(prompt: string): string[] {
  return [...prompt.matchAll(TOKEN)].map((m) => m[3] ?? (m[1] as string));
}

/** The actions named by a prompt's `[LABEL:action]` tokens. */
export function promptActions(prompt: string): string[] {
  return [...prompt.matchAll(TOKEN)].map((m) => m[2] as string);
}

/** Where things are in the practice room (px), so lessons can ask "on the ledge", "over the gap". */
export interface RoomGeometry {
  /** Top of the floor. */
  floorTop: number;
  /** Top of the high ledge. */
  ledgeTop: number;
  /** The gap in the floor: its left and right edges. */
  gap: { x0: number; x1: number };
  /**
   * The one-tile tunnel along the floor (the gear room's low wall): its left and right edges;
   * none (x1 <= x0) in the other rooms.
   */
  tunnel: { x0: number; x1: number };
}

/** A tile in a room (the room's map columns and rows). */
export interface TileSpot {
  x: number;
  y: number;
}

/** What a lesson's setup can change in the room. */
export interface PracticeRoom {
  readonly player: Player;
  readonly world: World;
  /** The dummy fires slow, harmless shots at the hero (Link's shield lesson). */
  dummyShoots: boolean;
  /**
   * Put power-up `id` in the room (at `at`, else the room's item spot) as the real pickup: a
   * HeroItem, or SMB's PowerUp for Mario and Luigi. The room watches for the grab: the tracker's
   * `taken` gets the id (counting starts afresh then). A lesson's `item` calls this itself.
   */
  placeItem(id: ItemId, at?: TileSpot): Entity | null;
}

export interface TrainingLesson {
  id: string;
  /**
   * Shown in the prompt box and announced: ability names, never button letters. A button's
   * ability is written `[LABEL:action]` ('[SHOOT:attack]'): the room shows it through
   * `abilityHint` ("SHOOT (X)" with keys, "SHOOT" on touch); `promptText` gives the bare label.
   */
  prompt: string;
  /**
   * The prompt on touch, when the touch controls do it differently (running: push the d-pad
   * far to the side; a tool's own button label, BOOMERANG or SAW); absent: `prompt`.
   */
  touchPrompt?: string;
  /**
   * True once the player has done it (since the lesson came up: the tracker is reset). With
   * `item`, the room also needs the item grabbed first, and counting starts afresh at the grab,
   * so `done` only has to measure the use.
   */
  done(t: MoveStats): boolean;
  /** Runs when the lesson comes up (e.g. the dummy starts shooting). */
  setup?(room: PracticeRoom): void;
  /**
   * The power-up this lesson is about: the room places it (at `itemAt`, else its item spot) when
   * the lesson comes up, unless the hero already has it, and the lesson is done only once it is
   * grabbed and then used (`done`).
   */
  item?: ItemId;
  /** Where the room places `item` (a tile; its feet on the tile's bottom). */
  itemAt?: TileSpot;
  /**
   * @deprecated The old (PREVIEW) marking: never read any more (training starts from the basic
   * kit and lessons place their items). Left only so unconverted lessons still compile.
   */
  unlocked?(run: RunKit): boolean;
}

/** @deprecated The run's kit for one hero (the old PREVIEW marking; training no longer reads it). */
export interface RunKit {
  kit: Readonly<Record<string, number>>;
  /** The carried power state ('small', 'big', 'fire', 'full'...). */
  power: string;
}

/** The rooms a chapter can use (src/content/levels/practice*.map). */
export type RoomId = 'practice' | 'gear' | 'water';

/** A short run of lessons in one room: skippable on its own from the room's menu. */
export interface TrainingChapter {
  id: string;
  /** Shown on the chapter's card and in the heading: a word or two. */
  title: string;
  room: RoomId;
  lessons: readonly TrainingLesson[];
}

/** One hero's training (lessons/<hero>.ts). */
export interface HeroTraining {
  chapters: readonly TrainingChapter[];
  /**
   * @deprecated The pre-0.4.34 room: the hero's whole kit from `devKit` instead of the basic kit
   * and placed items. Only for a hero whose lessons aren't converted yet.
   */
  fullKit?: boolean;
}

/** @deprecated A run kit's key (the old `unlocked` checks). */
export const k = (run: RunKit, key: string): number => run.kit[key] ?? 0;

/** Turn the hero into `power` for a lesson (Luigi's fire, Sophia III's Hyper and Crusher). */
export function givePower(room: PracticeRoom, power: string, unless: readonly string[] = [power]): void {
  const p = room.player;
  if (unless.includes(p.powerState)) return;
  p.powerState = power;
  p.startTransition('grow');
  room.world.audio.sfx('powerup');
}

/** Set scratch keys for the lesson (a beam level, a whip, a heart count). */
export const setKit =
  (kit: Record<string, number>) =>
  (room: PracticeRoom): void => {
    Object.assign(room.player.scratch, kit);
  };

/** The rest of a lesson beyond its id, prompt and check. */
export type LessonMore = Omit<TrainingLesson, 'id' | 'prompt' | 'done'>;

/** A lesson built from its parts: `more` adds `item`, `touchPrompt`, `setup`... */
export function lesson(
  id: string,
  prompt: string,
  done: (t: MoveStats) => boolean,
  more: LessonMore = {},
): TrainingLesson {
  return { id, prompt, done, ...more };
}

/**
 * "Grab power-up `item`, then use it": a lesson that places `item` in the room. `done` measures
 * the use only (counting starts afresh at the grab).
 */
export function itemLesson(
  id: string,
  item: ItemId,
  prompt: string,
  done: (t: MoveStats) => boolean,
  more: Omit<LessonMore, 'item'> = {},
): TrainingLesson {
  return { id, prompt, done, item, ...more };
}

/** @deprecated The pre-0.4.34 positional builder (with the old `unlocked`); use `lesson`. */
export function legacyLesson(
  id: string,
  prompt: string,
  done: (t: MoveStats) => boolean,
  unlocked?: (run: RunKit) => boolean,
  setup?: (room: PracticeRoom) => void,
): TrainingLesson {
  return { id, prompt, done, ...(unlocked ? { unlocked } : {}), ...(setup ? { setup } : {}) };
}

/** A hit on the dummy from this far (px, the hero's front edge to the dummy) is a long-range hit. */
export const FAR_HIT_PX = 96;
/** Swimming up until the feet are this far over the floor (px) clears the dummy's head. */
export const SWIM_UP_PX = 48;
