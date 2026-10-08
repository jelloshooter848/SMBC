import type { Action } from '@engine/input/actions';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import type { Game } from '../scenes/game';
import { abilityHint } from '../scenes/hints';
import { CARD_GUARD_FRAMES } from '../scenes/message';

/**
 * One page of a mini game's opening cutscene (Sophia's, Ryu's): its lines under the picture,
 * the picture frame it starts at (`at`), and the frame the picture rests on while the page
 * waits for OK (`hold`).
 */
export interface CaptionPage {
  at: number;
  hold: number;
  lines: readonly string[];
  /** What the announcer reads for the page (default: its lines), e.g. what the picture shows. */
  said?: string;
}

/** The keys a cutscene's captions use: OK (JUMP) turns the page, SKIP (ATTACK) ends it. */
export const CAPTION_OK: Action = 'jump';
export const CAPTION_SKIP: Action = 'attack';

/**
 * A cutscene's captions page by page (owner rule, 0.4.22: text never moves on without a key
 * press). The picture plays on to the page's `hold` frame and rests there; OK (after the card
 * guard) turns to the next page, the picture going on from that page's start, and on the last
 * page ends the cutscene. Skipping is the scene's own (SKIP ends it at any time).
 */
export class CaptionPager {
  /** The page showing. */
  page = 0;
  /** The picture's frame (the cutscene's timeline). */
  pic = 0;
  /** Frames the page has shown. */
  since = 0;

  constructor(readonly pages: readonly CaptionPage[]) {}

  get lines(): readonly string[] {
    return this.pages[this.page]?.lines ?? [];
  }

  get last(): boolean {
    return this.page >= this.pages.length - 1;
  }

  /** What the announcer reads as the page shows: its words, then how to go on. */
  said(game: Game): string {
    const p = this.pages[this.page];
    const text = p?.said ?? (p?.lines ?? []).join(' ');
    const ok = abilityHint(game, 'OK', CAPTION_OK);
    if (this.last) return `${text} ${ok} to continue.`;
    return `${text} ${ok} for more, ${abilityHint(game, 'SKIP', CAPTION_SKIP)} to skip.`;
  }

  /** The guard is over: OK turns the page (and the OK prompt shows). */
  get waiting(): boolean {
    return this.since > CARD_GUARD_FRAMES;
  }

  /**
   * One frame, `ok` a fresh OK press: 'next' when the page turned, 'done' when the last page
   * was closed, else null.
   */
  update(ok: boolean): 'next' | 'done' | null {
    this.since++;
    const hold = this.pages[this.page]?.hold ?? this.pic;
    if (this.pic < hold) this.pic++;
    if (!ok || !this.waiting) return null;
    if (this.last) return 'done';
    this.page++;
    this.since = 0;
    this.pic = Math.max(this.pic, this.pages[this.page]?.at ?? this.pic);
    return 'next';
  }
}

/**
 * The cutscene's keys on the letterbox: `skip` ("SKIP (X)") at the top right, and `ok`
 * ("OK (Z)") at the bottom right under the lines once the page waits for it (null: not yet).
 */
export function drawCaptionKeys(r: Renderer, font: SpriteSheet, skip: string, ok: string | null): void {
  r.text(font, skip, SCREEN_W - 8 - skip.length * 8, 16);
  if (ok) r.text(font, ok, SCREEN_W - 8 - ok.length * 8, SCREEN_H - 10);
}
