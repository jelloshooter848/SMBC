import type { Action } from '@engine/input/actions';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { SCREEN_W } from '@engine/viewport';
import { tileToSub } from '@engine/math/units';
import type { World } from '../world/world';
import { fontText } from '../hud/text';

/*
 * Lesson prompts for a stage tutorial (reusable: nothing here knows about Mario or 1-0).
 *
 * A lesson is a line of advice shown in a box near the top of the screen until the player has
 * actually done it (`done` reads the world: positions, power, World.feats). Its words name
 * abilities, never buttons: a token `[JUMP:jump]` is the ability JUMP on action `jump`, filled
 * in by `fillAbilities` with the name the scheme in use shows (the touch button's own caption on
 * touch, "JUMP (Z)" with a keyboard or pad: hints.ts abilityHint).
 */

export interface Lesson {
  /** Stable id (tests, the run's record). */
  id: string;
  /** The advice, with ability tokens `[NAME:action]` (e.g. `HOLD [RUN:attack]`). */
  text: string;
  /** Column (tile) where the lesson starts: a respawn while it is current stands here. */
  at: number;
  /** Row the respawn stands on (feet on the tile below it; default 12). */
  row?: number;
  /**
   * The sub-area the lesson is played in (a pipe's room), when not the stage's main area: a
   * respawn goes back to the lesson before it, which leads there.
   */
  area?: string;
  /** Whether the lesson is done (checked every frame while it is the current one). */
  done(world: World): boolean;
  /**
   * Moving on: once a player is past this column in the stage's main area with the lesson not
   * done (the Goomba jumped over, the block left behind), it is skipped so the prompt never
   * asks for something no longer there. Absent: only `done` ends it.
   */
  passX?: number;
}

/** What `LessonTracker.update` saw this frame. */
export type LessonStep = { kind: 'done' | 'missed'; lesson: Lesson } | null;

/** The lessons in order, the current one, and what became of each. */
export class LessonTracker {
  /** Ids done, in the order they were done. */
  readonly done: string[] = [];
  /** Ids skipped (passX). */
  readonly missed: string[] = [];

  constructor(
    readonly lessons: readonly Lesson[],
    public index = 0,
  ) {}

  get current(): Lesson | null {
    return this.lessons[this.index] ?? null;
  }

  get finished(): boolean {
    return this.index >= this.lessons.length;
  }

  /** The lesson with id `id`'s index, or -1. */
  indexOf(id: string): number {
    return this.lessons.findIndex((l) => l.id === id);
  }

  /**
   * Checks the current lesson once: done → the next one; passed by (`passX`, only when `mainArea`)
   * → skipped. At most one step a frame, so each new prompt shows for at least one frame.
   */
  update(world: World, mainArea: boolean): LessonStep {
    const l = this.current;
    if (!l) return null;
    if (l.done(world)) {
      this.done.push(l.id);
      this.index++;
      return { kind: 'done', lesson: l };
    }
    if (
      mainArea &&
      l.passX !== undefined &&
      world.players.some((p) => !p.dead && !p.out && p.body.x >= tileToSub(l.passX as number))
    ) {
      this.missed.push(l.id);
      this.index++;
      return { kind: 'missed', lesson: l };
    }
    return null;
  }
}

/** Ability tokens: `[NAME:action]`. */
const TOKEN = /\[([A-Z][A-Z -]*):([a-z]+)\]/g;

/**
 * Fills in a lesson's ability tokens: `name(ability, action)` gives the words shown for each (the
 * stage tutorial passes abilityHint, with the touch button's caption as the ability on touch).
 */
export function fillAbilities(text: string, name: (ability: string, action: Action) => string): string {
  return text.replace(TOKEN, (_, ability: string, action: string) => name(ability, action as Action));
}

/** The words a lesson shows when nothing is filled in (the ability names alone). */
export function plainText(text: string): string {
  return fillAbilities(text, (ability) => ability);
}

/** Columns a prompt line may take in the box (28 × 8 px inside 240 px). */
export const PROMPT_COLS = 28;

/**
 * Lines of at most `cols` font characters. An ability with its key in brackets ("RUN (RIGHT
 * SHIFT)") stays on one line.
 */
export function wrapPrompt(text: string, cols = PROMPT_COLS): string[] {
  const words = fontText(text).match(/[^\s(]+(?:\s\([^)]*\))?|\([^)]*\)/g) ?? [];
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (!line) line = w;
    else if (line.length + 1 + w.length <= cols) line += ` ${w}`;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines.flatMap((l) => (l.length <= cols ? [l] : (l.match(new RegExp(`.{1,${cols}}`, 'g')) ?? [])));
}

/** Top of the prompt box: under the HUD's rows. */
export const PROMPT_BOX_Y = 40;

/**
 * A prompt box near the top of the screen (white frame, black inside), lines centred; `tag` (e.g.
 * "NICE!") at its top right, drawn over the frame. Returns the box's bottom.
 */
export function drawPromptBox(
  r: Renderer,
  font: SpriteSheet,
  lines: readonly string[],
  y = PROMPT_BOX_Y,
  tag = '',
): number {
  const h = lines.length * 10 + 10;
  r.rect(8, y, SCREEN_W - 16, h, '#fcfcfc');
  r.rect(10, y + 2, SCREEN_W - 20, h - 4, '#000');
  lines.forEach((l, i) => r.text(font, l, (SCREEN_W - l.length * 8) >> 1, y + 6 + i * 10));
  if (tag) {
    const x = SCREEN_W - 16 - tag.length * 8;
    r.rect(x - 2, y - 4, tag.length * 8 + 4, 10, '#000');
    r.text(font, tag, x, y - 3);
  }
  return y + h;
}
