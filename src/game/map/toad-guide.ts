import type { InputFrame } from '@engine/input/input-manager';
import type { Action } from '@engine/input/actions';
import type { Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import { cardContinues, CARD_GUARD_FRAMES } from '../scenes/message';
import { beat, FIRST_HERO } from '../story/beats';
import { pageSaid, STORY_CARD_TIMEOUT } from '../story/cards';
import {
  ALL_FREED_AFTER,
  ALL_FREED_BEFORE,
  ARENA_PAGE,
  CRASH_PAGES,
  ENTRY_NEEDS,
  FAKES_PAGES,
  HUB_PAGE,
  JOINED_CRACK,
  JOINED_GENERIC,
  JOINED_PAGES,
  MISSED_HINT,
  MISSED_PAGES,
  riftPages,
  WORLD_ENTRY,
  type Page,
} from '../story/script';
import { CRYSTAL_BALL } from './captives';
import type { MapProgress } from './types';

/*
 * Toad as the world map's guide (docs/STORY.md 2.3, 2.3a item 4, 2.4-2.12, 2.14; campaign only):
 * which of his story scenes are due when a map page shows, and the box at the top of the map that
 * plays them, page by page (OK the next page, BACK the rest of that scene), with his map sprite
 * walking in from the left for the major scenes only (the World 1 entry after 1-0, the fake
 * Bowsers, the airship crash, the 8-4 rift). Every scene plays once per file: its beat ids
 * (story/beats.ts) are marked seen as it starts. The map scene (scenes/world-map.ts) runs this as
 * its `story` mode, before the page's reveal draws in.
 */

/** One of Toad's scenes: the beat ids it marks seen, its pages (none: only marked), a walk-in. */
export interface ToadScene {
  ids: string[];
  pages: Page[];
  /** A major scene: Toad's map sprite walks in from the left before it. */
  walk: boolean;
}

/** What decides which scenes are due on the page shown. */
export interface GuideInput {
  /** The page shown ('smb-1', 'hub', 'arena', 'll-1'). */
  page: string;
  seen(id: string): boolean;
  progress: MapProgress;
  /** The file's freed heroes (the first hero, Mario, included). */
  freed: readonly string[];
  /** Every registered character id (World 8's entry needs Sophia's). */
  heroes: readonly string[];
  /** Every hidden hero's id that the game has (its captive in a level, its character registered). */
  hidden: readonly string[];
  /** Hero ids whose silhouette shows on this page because their level was cleared. */
  shadows: readonly string[];
  /** Player 1's full name, in font characters ('MEGA MAN'). */
  hero: string;
  /** The airship crash cutscene has just played on this page. */
  crash?: boolean;
}

/**
 * The scenes due on the page shown, in play order: the major scene (the crash, the rift, the
 * fake Bowsers), then heroes joined, every hero freed, the world entry, missed heroes, the
 * extras. The Lost Kingdom's pages have none (its story is for a later release). Pure.
 */
export function dueScenes(g: GuideInput): ToadScene[] {
  const out: ToadScene[] = [];
  const p = g.progress;
  const page = g.page;
  const smb = /^smb-\d+$/.test(page);
  if (!smb && page !== 'hub' && page !== 'arena') return out;
  const add = (ids: string[], pages: Page[], walk = false) => {
    const fresh = ids.filter((id) => !g.seen(id));
    if (fresh.length) out.push({ ids: fresh, pages, walk });
  };
  // The major scenes.
  if (g.crash && !g.seen(beat.crash)) add([beat.crash], [...CRASH_PAGES], true);
  if (page === 'smb-8' && p.gameCleared === true) add([beat.rift], riftPages(g.hero), true);
  if (page === 'smb-1' && p.cleared.includes('1-4')) add([beat.fakes], [...FAKES_PAGES], true);
  // A hero joined: the generic card first (once per file), then each hero's own.
  const cracked = p.gameCleared === true;
  const generic = (): Page[] => (cracked ? [JOINED_GENERIC] : [JOINED_CRACK, JOINED_GENERIC]);
  let genericNow = false;
  for (const id of g.freed) {
    if (id === FIRST_HERO || g.seen(beat.joined(id))) continue;
    if (!g.seen(beat.joined()) && !genericNow) {
      add([beat.joined()], generic());
      genericNow = true;
    }
    const own = JOINED_PAGES[id];
    if (own) add([beat.joined(id)], [own]);
    else if (genericNow)
      add([beat.joined(id)], []); // the generic card just played stands for it
    else add([beat.joined(id)], generic());
  }
  if (g.hidden.length && g.hidden.every((id) => g.freed.includes(id)))
    add([beat.allFreed], [cracked ? ALL_FREED_AFTER : ALL_FREED_BEFORE]);
  // The world entry, on first arrival (World 1's once 1-0 is behind; World 8's with Sophia).
  // Pages about a hero not in the game yet (World 8's Sophia) wait for her, as a beat of their own.
  const entry = WORLD_ENTRY[page];
  if (entry && (page !== 'smb-1' || p.cleared.includes('1-0'))) {
    const needs = ENTRY_NEEDS[page];
    const heroId = needs && g.heroes.includes(needs.hero) ? beat.enterHero(page, needs.hero) : null;
    const ids = [beat.enter(page), ...(heroId ? [heroId] : [])].filter((id) => !g.seen(id));
    const hers = (i: number) => needs?.pages.includes(i) === true;
    const pages = entry.filter((_, i) =>
      hers(i) ? heroId !== null && ids.includes(heroId) : ids.includes(beat.enter(page)),
    );
    if (pages.length) add(ids, pages, page === 'smb-1');
  }
  // Missed heroes: after the crystal ball every shadow shows at once, and the crash's card stands
  // in for theirs (only marked).
  const ball = p.secrets.includes(CRYSTAL_BALL);
  for (const id of g.shadows) {
    const own = MISSED_PAGES[id];
    add([beat.missed(id)], ball || !own ? [] : [own]);
  }
  if (page === 'hub') add([beat.hub], [HUB_PAGE]);
  if (page === 'arena') add([beat.arena], [ARENA_PAGE]);
  return out;
}

/** The map's hint line while the hero stands by hero `id`'s shadow, or null without its own. */
export function missedHint(id: string): string | null {
  return MISSED_HINT[id] ?? null;
}

/** What the announcer says for hero `id`'s hint line ("Toad: I hear a mustache sigh..."), or null. */
export function missedSaid(id: string): string | null {
  const line = MISSED_HINT[id];
  if (!line) return null;
  const body = line.replace(/^TOAD:\s*/, '').toLowerCase();
  const text = body.charAt(0).toUpperCase() + body.slice(1);
  return `Toad: ${/[.!?]$/.test(text) ? text : `${text}.`}`;
}

/** Top of Toad's box: just under the map's header bar. */
export const TOAD_BOX_Y = 28;
/** Toad's walking speed (px per frame) and where he starts, off the left edge. */
export const TOAD_WALK_SPEED = 2;
export const TOAD_OFF_X = -18;

/** What the guide asks of the map scene. */
export interface GuideHooks {
  markSeen(id: string): void;
  say(text: string): void;
  /** The OK prompt's text ("OK", or with the key while not on touch), asked each frame drawn. */
  prompt(): string;
}

type Phase = 'in' | 'page' | 'out' | 'done';

const OK_KEYS: readonly Action[] = ['jump', 'start'];
const SKIP_KEYS: readonly Action[] = ['attack'];

/**
 * Plays a list of Toad's scenes over the map: walks Toad in when a scene is major (he then stays
 * until the last scene, and walks back off), shows each page in the box at the top, announced.
 * `stand` is where Toad stops (top-left of his 16x16 frame, feet on the hero's ground line).
 */
export class ToadGuide {
  private phase: Phase = 'page';
  private scene = -1;
  private page = 0;
  private t = 0;
  /** Toad's x while on stage; null while off it. */
  private tx: number | null = null;
  private readonly timeout: number;

  constructor(
    readonly scenes: readonly ToadScene[],
    private readonly stand: { x: number; y: number },
    private readonly hooks: GuideHooks,
    timeout = STORY_CARD_TIMEOUT,
  ) {
    this.timeout = timeout;
    this.nextScene();
  }

  get done(): boolean {
    return this.phase === 'done';
  }

  /**
   * Every page is over and Toad is walking back off: the map is the player's again while he goes
   * (the map keeps updating and drawing him until he is off stage, `done`).
   */
  get leaving(): boolean {
    return this.phase === 'out';
  }

  /** The lines in the box now, or null while none shows (Toad walking). */
  get lines(): Page | null {
    if (this.phase !== 'page') return null;
    return this.scenes[this.scene]?.pages[this.page] ?? null;
  }

  /** Toad is on the map (walking in, standing, or walking off). */
  get toadShown(): boolean {
    return this.tx !== null;
  }

  /** Toad's frame and top-left, or null while he is off stage. */
  toad(): { frame: string; x: number; y: number; flip: boolean } | null {
    if (this.tx === null) return null;
    const walking = this.phase === 'in' || this.phase === 'out';
    const frame = walking ? `toad-map-${(this.t >> 3) & 1}` : `toad-map-${(this.t >> 4) & 1}`;
    return { frame, x: Math.round(this.tx), y: this.stand.y, flip: this.phase === 'out' };
  }

  /** Starts the next scene with pages (marking every scene passed on the way), or ends. */
  private nextScene(): void {
    for (;;) {
      this.scene++;
      const s = this.scenes[this.scene];
      if (!s) {
        this.leave();
        return;
      }
      for (const id of s.ids) this.hooks.markSeen(id);
      if (!s.pages.length) continue;
      this.page = 0;
      this.t = 0;
      if (s.walk && this.tx === null) {
        this.tx = TOAD_OFF_X;
        this.phase = 'in';
        return;
      }
      this.showPage();
      return;
    }
  }

  private leave(): void {
    this.t = 0;
    this.phase = this.tx === null ? 'done' : 'out';
  }

  private showPage(): void {
    this.phase = 'page';
    this.t = 0;
    const s = this.scenes[this.scene] as ToadScene;
    const page = s.pages[this.page] as Page;
    const last = this.page === s.pages.length - 1;
    this.hooks.say(pageSaid(page, last));
  }

  update(inputs: readonly InputFrame[]): void {
    this.t++;
    switch (this.phase) {
      case 'in': {
        const x = Math.min(this.stand.x, (this.tx ?? TOAD_OFF_X) + TOAD_WALK_SPEED);
        this.tx = x;
        if (x >= this.stand.x) this.showPage();
        return;
      }
      case 'out': {
        const x = (this.tx ?? TOAD_OFF_X) - TOAD_WALK_SPEED;
        this.tx = x;
        if (x <= TOAD_OFF_X) {
          this.tx = null;
          this.phase = 'done';
        }
        return;
      }
      case 'page': {
        if (cardContinues(this.t, Infinity, inputs, SKIP_KEYS)) {
          this.nextScene();
          return;
        }
        if (!cardContinues(this.t, this.timeout, inputs, OK_KEYS)) return;
        const s = this.scenes[this.scene] as ToadScene;
        if (this.page < s.pages.length - 1) {
          this.page++;
          this.showPage();
        } else this.nextScene();
        return;
      }
      default:
    }
  }

  /** Toad (when on stage) and the box at the top (while a page shows). */
  draw(r: Renderer, assets: AssetRegistry): void {
    const toad = this.toad();
    if (toad) r.sprite(assets.sheet('smb3'), toad.frame, toad.x, toad.y, toad.flip);
    const lines = this.lines;
    if (!lines) return;
    const font = assets.sheet('font');
    const prompt = this.hooks.prompt();
    const h = (lines.length + 1) * 10 + 12;
    const y = TOAD_BOX_Y;
    r.rect(12, y, 256 - 24, h, '#fcfcfc');
    r.rect(14, y + 2, 256 - 28, h - 4, '#000');
    lines.forEach((l, i) => r.text(font, l, (256 - l.length * 8) >> 1, y + 7 + i * 10));
    if (this.t > CARD_GUARD_FRAMES)
      r.text(font, prompt, 256 - 20 - prompt.length * 8, y + 7 + lines.length * 10);
  }
}
