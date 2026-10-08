import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Action } from '@engine/input/actions';
import type { Renderer } from '@engine/gfx/renderer';
import { MAP_PAGES, mapPage } from '@content/worldmap';
import { drawMapActor, drawMapTile, mapSky } from '@content/worldmap/render';
import type { MapActor, MapNode, MapProgress, PageGroup, PageId, WorldMapPage } from '../map/types';
import {
  exitId,
  FIRST_PAGE,
  isCleared,
  secretExitTaken,
  isOpen,
  isPageOpen,
  isWarpNode,
  isWarpOpen,
  nextStep,
  openPaths,
  parseRevealId,
  pathId,
  revealId,
  warpText,
  exitHint,
  warpTo,
  warpRecords,
  type Dir,
  type MapStep,
} from '../map/rules';
import type { CharacterDef } from '../characters/character';
import { pad } from '../hud/hud';
import { hasSecretExit } from '../map/secret-exits';
import { CRYSTAL_BALL, heroHint, heroSide, hiddenHeroesAt, type HeroHint } from '../map/captives';
import { fxPalette, mapShadePalette } from '@content/sprites/palette-fx';
import {
  PEDESTAL_EDGE,
  PEDESTAL_H,
  PEDESTAL_STONE,
  PEDESTAL_W,
  TROPHY_SCALE,
  trophyPose,
} from '../map/trophy';
import { Player } from '../entities/player';
import { startHp } from '../characters/character';
import { MenuScene, type MenuItem } from './menu';
import { abilityHint } from './hints';
import { OptionsScene } from './options';
import type { Game } from './game';
import type { TouchLabels } from '@engine/input/touch';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import { InventoryScene } from '../bonus/inventory';
// Registers the SMB3 bonus games on World 4's bonus spot (map/bonus-spot.ts).
import '../bonus/spot';
import { inventoryAvailable, shownItems } from '../bonus/use';
import { giveDevItems } from '../bonus/items';
import { MapGuard, guardRoad } from '../map/hammer-bro';
import {
  BONUS_CLOSED_HINT,
  BONUS_CLOSED_SAID,
  BONUS_SPENT_HINT,
  BONUS_SPENT_SAID,
  bonusGame,
  isBonusArea,
} from '../map/bonus-spot';
import { AirshipCrash, type CrashNames } from '../map/airship-crash';
import { arenaPadHint, arenaPadSaid, arenaPadTouch, drawArenaPad, playArenaPad } from '../arena';
import { dueScenes, ToadGuide, type ToadScene } from '../map/toad-guide';
import { beat, storyOn } from '../story/beats';
import { fontText } from '../hud/text';
import { CardScene } from './message';
import { pageSaid } from '../story/cards';
// S3 (0.4.23): the world gates, the welcomes (map/world-gate.ts, map/gate-scene.ts).
import {
  gateDue,
  gateScenes,
  localHint,
  localNode,
  localSpot,
  sealedExit,
  smbWorld,
  welcomeOf,
} from '../map/world-gate';
import { drawCrack, drawSeal, GateScene } from '../map/gate-scene';
import { LOCAL_SPRITES } from '@content/sprites/locals';
import { sealedHint, type Page } from '../story/script';

/** Hero walking speed on the map (px per frame). */
export const MAP_WALK_SPEED = 2;
/** Length of the slide between two pages. */
export const MAP_SLIDE_FRAMES = 30;
/** Frames between two dots of a path being revealed, and before a revealed node pops in. */
export const REVEAL_DOT_FRAMES = 6;
export const REVEAL_NODE_FRAMES = 16;
/** Length of the fade between two pages of different groups (a warp node). */
export const MAP_FADE_FRAMES = 40;
/** Height of the header bar across the top of the map (keep nodes below it). */
export const MAP_HEADER_H = 24;
/**
 * The hint line across the bottom of the map while the hero stands on a warp node (below tile
 * row 13, the lowest a node may sit on).
 */
export const MAP_HINT_Y = 226;

/**
 * A level node hiding a captive hero the file has not freed, once that level is cleared: the
 * announcer's line and the hint line (map/captives.ts; it never says where in the level). Since
 * 0.4.23 the campaign says these too (Toad's per-hero lines are gone, docs/STORY.md 2.3).
 */
export const HIDING_SAID = 'Someone is hiding in this level.';
export const HIDING_HINT = 'SOMEONE IS HIDING IN THIS LEVEL';
/** The hidden hero's slow shimmer: one cycle, and the frames of it the faint glow shade shows. */
export const HIDING_SHIMMER_FRAMES = 360;
export const HIDING_GLOW_FRAMES = 30;
/**
 * The map's Hammer Bro (map/hammer-bro.ts) stands still for this many frames after the map shows
 * or he comes out, before he starts to wander. It never delays a battle: walking into him starts
 * one at once (he spawns on the road tile farthest from the hero, so it is always the hero's move).
 */
export const GUARD_GRACE_FRAMES = 45;
/** A freed hero's 1-px dark outline: its silhouette drawn once each way, under it. */
const TROPHY_OUTLINE: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/**
 * A trophy statue's stone pedestal (original art), its top-left at (x, y): a PEDESTAL_W cap
 * with its shadow over a narrower shaft and a foot, outlined dark against any ground.
 */
function drawPedestal(r: Renderer, x: number, y: number): void {
  const [light, shadow, face] = PEDESTAL_STONE as [string, string, string];
  const w = PEDESTAL_W;
  r.rect(x - 1, y - 1, w + 2, 3, PEDESTAL_EDGE); // the cap's outline
  r.rect(x, y + 2, w, PEDESTAL_H - 1, PEDESTAL_EDGE); // the shaft's and foot's
  r.rect(x, y, w, 1, light); // cap
  r.rect(x, y + 1, w, 1, shadow); // its underside
  r.rect(x + 2, y + 2, w - 4, PEDESTAL_H - 3, face); // shaft
  r.rect(x + w - 4, y + 2, 2, PEDESTAL_H - 3, shadow); // its shaded side
  r.rect(x + 1, y + PEDESTAL_H - 1, w - 2, 1, shadow); // foot
}

export interface WorldMapOptions {
  /**
   * Page-qualified ids (rules.revealId: 'smb-1:1-2', 'smb-1:1-1>1-2', 'smb-2:start') to draw
   * in one by one, then save; each page reveals only its own.
   */
  reveal?: string[];
  /**
   * Open by moving over from this page (a campaign warp pipe), then draw in: a slide within a
   * group (by page order), a fade between groups.
   */
  slideFrom?: PageId;
}

/**
 * `story`: Toad's box at the top of the map (map/toad-guide.ts), before the page's reveal.
 * `gate`: a world gate breaking (map/gate-scene.ts), before the reveal and Toad (0.4.23).
 */
type Mode = 'reveal' | 'idle' | 'walk' | 'slide' | 'fade' | 'cutscene' | 'story' | 'gate';

/**
 * The Chapter 2 gate's card (rules.chapterGated): shown over the map instead of starting a Lost
 * Kingdom level. Lines fit the card box (at most 28 chars).
 */
export const CHAPTER_GATE_CARD: readonly string[] = [
  'THE PATH IS BLOCKED!',
  'A STRANGE FORCE SEALS THE',
  'WAY INTO THE LOST KINGDOM.',
  'COME BACK IN CHAPTER 2!',
];

/**
 * The gate's card in a box over the map (which stays beneath; the hero stays on the node), read
 * out; OK (JUMP), MENU or BACK closes it. Nothing is saved.
 */
export function showChapterGate(game: Game): void {
  game.ctx.audio.sfx('bump');
  game.deps.announcer?.say(pageSaid(CHAPTER_GATE_CARD, true));
  game.scenes.push(
    new CardScene(game, CHAPTER_GATE_CARD, () => game.scenes.pop(), null, {
      panel: true,
      overlay: true,
      top: true,
      keys: ['jump', 'start', 'attack'],
      prompt: () => abilityHint(game, 'OK', 'jump'),
    }),
  );
}

/** 'WORLD 1' → 'World 1', 'LOST LEVELS - BEAT 8-4 TO UNLOCK' → 'Lost Levels - Beat 8-4 To Unlock'. */
export function spoken(text: string): string {
  return text.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
}

/**
 * The header's top right: the page label ('WORLD 1', 'LOST A', 'WARP ZONE'), with the stage when
 * the hero stands on a level or castle node ('WORLD 1-2', 'LOST A-2'); at most 10 chars.
 */
export function mapHeaderLabel(page: WorldMapPage, node: MapNode | null): string {
  // The stage is the level id's last part ('1-2' → 2, 'll-10-3' → 3).
  const stage = node && levelNode(node) ? node.level?.split('-').pop() : undefined;
  return (stage ? `${page.label}-${stage}` : page.label).slice(0, 10);
}

/**
 * A node JUMP enters a level from: level and castle nodes, and a start carrying a level (World 1's
 * start is Mario's tutorial stage 1-0).
 */
function levelNode(n: MapNode): boolean {
  return !!n.level && !isWarpNode(n) && (n.kind === 'level' || n.kind === 'castle' || n.kind === 'start');
}

/** A path or world exit as drawn: its id and the dot centres, flat [x0, y0, x1, y1, ...]. */
interface DotRun {
  id: string;
  dots: number[];
}

/**
 * A hidden hero drawn beside its node (map/captives.ts): its silhouette (behind the node) or its
 * trophy (beside it, in colour). `cx` is the sprite's centre, `feet` the row under its feet.
 */
interface HeroMark {
  node: MapNode;
  hint: Exclude<HeroHint, 'none'>;
  def: CharacterDef;
  side: 1 | -1;
  cx: number;
  feet: number;
}

/** What is drawn of a page for the current progress (rebuilt only when progress may change). */
interface PageView {
  runs: DotRun[];
  /** `sheet`: the frame's sheet when it is not the items sheet (the bonus spot's SMB3 icon). */
  nodes: { node: MapNode; frame: string; sheet?: string }[];
  heroes: HeroMark[];
}

/** The hero's frames on the map: standing, and walking when the sheet has them. */
interface HeroFrames {
  idle: string;
  walk: string[];
}

/** The map menu's WORLDS list, its cursor starting on the current page. */
export class WorldsMenu extends MenuScene {
  constructor(game: Game, items: MenuItem[], onBack: () => void, start: number) {
    super(game, 'WORLDS', items, onBack, true);
    this.index = start;
  }

  /** The highlighted entry. */
  get cursor(): number {
    return this.index;
  }
}

/** The map menu (MAP): rows can be rebuilt in place (a dev toggle adds or removes Items). */
export class MapMenu extends MenuScene {
  constructor(game: Game, items: MenuItem[], onBack: () => void) {
    super(game, 'MAP', items, onBack, true);
  }

  /** Replaces the rows, keeping the cursor on the row labelled `label`. */
  rebuild(items: MenuItem[], label: string): void {
    this.setItems(items);
    const i = items.findIndex((it) => it.label === label);
    if (i >= 0) this.index = i;
  }
}

/** Black at 0/8 .. 8/8 opacity, for the fade (precomputed: no strings built per frame). */
const FADE_SHADES = Array.from({ length: 9 }, (_, i) => `rgba(0,0,0,${i / 8})`);

const DIRS: Dir[] = ['left', 'right', 'up', 'down'];
const ANY: Action[] = ['left', 'right', 'up', 'down', 'jump', 'attack', 'special', 'start', 'select'];

/** Stands in when no page exists (no content yet): nothing to draw or walk to. */
const EMPTY_PAGE: WorldMapPage = {
  id: '',
  group: 'smb',
  label: '',
  title: '',
  theme: 'grass',
  music: 'title',
  tiles: [],
  nodes: [],
  paths: [],
  exits: [],
  actors: [],
};

/** Dot centres along a tile path: every tile centre and half way between. */
function pathDots(points: [number, number][], skipFirst: boolean, skipLast: boolean): number[] {
  const out: number[] = [];
  points.forEach(([x, y], i) => {
    const first = i === 0;
    const last = i === points.length - 1;
    if (!(first && skipFirst) && !(last && skipLast)) out.push(x * 16 + 8, y * 16 + 8);
    const n = points[i + 1];
    if (n) out.push((x + n[0]) * 8 + 8, (y + n[1]) * 8 + 8);
  });
  return out;
}

function startNode(page: WorldMapPage): MapNode | null {
  return page.nodes.find((n) => n.kind === 'start') ?? page.nodes[0] ?? null;
}

/** The furthest open SMB world's page (World 1 when there is none). */
function furthestOpenPage(progress: MapProgress, unlockAll: boolean): PageId {
  const open = MAP_PAGES.filter((p) => p.group === 'smb' && isPageOpen(progress, p.id, unlockAll));
  return open[open.length - 1]?.id ?? FIRST_PAGE;
}

/** -1 / 1: whether `to` comes before or after `from` in the registry (play order). */
function pageOrder(from: WorldMapPage, to: WorldMapPage): -1 | 1 {
  return MAP_PAGES.indexOf(from) < MAP_PAGES.indexOf(to) ? 1 : -1;
}

/**
 * The Super Mario World-style map of one world: the page's scenery, the open paths and nodes,
 * the hero walking between nodes with the d-pad, entering levels, sliding to the next page along
 * an open world exit, and the dot-by-dot reveal of what a clear just opened.
 */
export class WorldMapScene implements Scene {
  page: WorldMapPage;
  mode: Mode = 'idle';
  /** Node the hero stands on (or last left); '' on a page without nodes. */
  node: string;
  /** Hero position (px, top-left of the 16×16 tile it stands on). */
  hx = 0;
  hy = 0;
  private facingLeft = false;
  private t = 0;
  private walkPts: [number, number][] = [];
  private walkStep: MapStep | null = null;
  private slide: { from: WorldMapPage; dir: -1 | 1; t: number; node: string } | null = null;
  /** A fade to `this.page` (a warp node, or a warp pipe across groups): black out, then in. */
  private fade: { from: WorldMapPage; t: number; node: string } | null = null;
  /** Reveal state: local ids still to show (in order) and how many dots of each are drawn. */
  private revealQueue: string[] = [];
  private readonly revealShown = new Map<string, number>();
  private revealNodes: string[] = [];
  /** The world-qualified ids being drawn in, removed from the pending list when done. */
  private revealTaken: string[] = [];
  private revealT = 0;
  /** Render caches. */
  private readonly views = new Map<WorldMapPage, PageView>();
  private readonly heroFrames = new Map<CharacterDef, HeroFrames>();
  /** Each trophy hero's jump frame (its CharacterDef sprite in the air), or null without one. */
  private readonly jumpFrames = new Map<
    CharacterDef,
    { sheet: string; palette: string; frame: string } | null
  >();
  /** Freed heroes celebrating on this map: the frame their burst of hops began (map/trophy.ts). */
  private readonly trophyBursts = new Map<string, number>();
  private readonly scratchActor: MapActor = { type: '', x: 0, y: 0 };
  /**
   * The airship's crash on World 4 (map/airship-crash.ts), playing before the reveal of the road
   * to the bonus spot it opened (`node`: that bonus node, hidden until Toad has built it).
   */
  private crash: {
    scene: AirshipCrash;
    node: string;
    names: CrashNames;
    /** The page's line (announceHere), said ahead of the first narration line, not under it. */
    lead: string;
  } | null = null;
  /** Toad's story scenes playing over the map (the `story` mode), or null. */
  toad: ToadGuide | null = null;
  /** A world gate breaking (the `gate` mode, map/gate-scene.ts), or null. */
  gate: GateScene | null = null;
  /** Toad's pages once a gate's road has drawn in (he walks in after the reveal). */
  private gateToad: readonly Page[] | null = null;
  /** The Hammer Bro wandering the road to a used bonus spot on this page, or null. */
  guard: MapGuard | null = null;
  private guardGrace = 0;
  private readonly header = {
    page: null as WorldMapPage | null,
    node: null as MapNode | null,
    hero: null as CharacterDef | null,
    lives: -1,
    score: -1,
    coins: -1,
    title: '',
    world: '',
    livesText: '',
    scoreText: '',
    coinsText: '',
  };

  constructor(
    private readonly game: Game,
    pageId: PageId,
    private readonly opts: WorldMapOptions = {},
  ) {
    const prog = game.mapProgress;
    const all = game.mapUnlockAll;
    let id = isPageOpen(prog, pageId, all) && mapPage(pageId) ? pageId : prog.position.page;
    // A file left on "Unlock all" (dev mode since turned off) may stand somewhere locked.
    const recheck = game.devUnlockAll;
    if (recheck && !(isPageOpen(prog, id, all) && mapPage(id))) id = furthestOpenPage(prog, all);
    this.page = mapPage(id) ?? mapPage(FIRST_PAGE) ?? MAP_PAGES[0] ?? EMPTY_PAGE;
    const pos = prog.position;
    let here = pos.page === this.page.id ? this.nodeById(pos.node) : undefined;
    if (recheck && here && !isOpen(prog, this.page, here.id, all)) here = undefined;
    this.node = here?.id ?? startNode(this.page)?.id ?? '';
    this.placeHero();
  }

  private get progress() {
    return this.game.mapProgress;
  }

  /** Developer "Unlock all" in effect (the file's flag, while dev mode is on). */
  private get unlockAll(): boolean {
    return this.game.mapUnlockAll;
  }

  enter(): void {
    this.game.ctx.audio.playMusic(this.page.music);
    this.views.clear();
    this.refreshGuard();
    this.game.addReveal(this.opts.reveal ?? []);
    this.takeReveal();
    if (this.startCrash()) return;
    this.announceHere();
    const from = this.opts.slideFrom === undefined ? undefined : mapPage(this.opts.slideFrom);
    if (from && from !== this.page) {
      // A warp: slide in from the page warped from (fade in from another group); the reveal
      // follows (updateSlide / updateFade).
      if (from.group === this.page.group) {
        this.slide = { from, dir: pageOrder(from, this.page), t: 0, node: this.node };
        this.mode = 'slide';
      } else {
        this.fade = { from, t: 0, node: this.node };
        this.mode = 'fade';
      }
      if (!this.revealQueue.length) this.game.autosave();
      return;
    }
    this.arrived();
  }

  /**
   * The page has shown (the map opened, or a slide or fade ended; the crash cutscene ended,
   * `crash`): Toad's due story scenes first (campaign), then the page's reveal draws in.
   */
  private arrived(crash = false): void {
    if (!crash && this.startGate()) return;
    if (this.startStory(crash)) return;
    this.afterStory();
  }

  /** After Toad's scenes (or with none): the reveal, else the map is the player's (saved). */
  private afterStory(): void {
    this.revealT = 0;
    if (this.revealQueue.length) this.mode = 'reveal';
    else if (this.revealTaken.length) this.finishReveal();
    else {
      this.mode = 'idle';
      this.game.autosave();
    }
  }

  /**
   * Toad's story scenes due on this page (map/toad-guide.ts dueScenes; only while the campaign's
   * story plays, story/beats.ts storyOn): played as the `story` mode. False when none has a
   * page to show (scenes with none are only marked seen).
   */
  private startStory(crash: boolean, lead: readonly Page[] = []): boolean {
    const game = this.game;
    // A gate's Toad (a major scene: he walks in) leads, then whatever else is due.
    const first: ToadScene[] = lead.length ? [{ ids: [], pages: [...lead], walk: true }] : [];
    const scenes = [...first, ...this.storyScenes(crash)];
    if (!scenes.length) return false;
    // Toad stands just left of the hero, or right of him when the hero is at the left edge
    // (World 1's start), so he never covers the hero.
    const stand = { x: this.hx - 20 >= 4 ? this.hx - 20 : this.hx + 20, y: this.hy - 6 };
    const guide = new ToadGuide(scenes, stand, {
      markSeen: (id) => game.markSeen(id),
      say: (text) => this.say(text),
      prompt: () => abilityHint(game, 'OK', 'jump'),
    });
    if (guide.done) return false;
    this.toad = guide;
    this.mode = 'story';
    return true;
  }

  /** Toad's scenes due on this page now (none outside the story, or on a page not open). Pure. */
  private storyScenes(crash: boolean): ToadScene[] {
    const game = this.game;
    // Not on a page shown only through developer "Unlock all".
    if (!storyOn(game) || !this.page.nodes.length || !isPageOpen(this.progress, this.page.id)) return [];
    const due = dueScenes({
      page: this.page.id,
      seen: (id) => game.seen(id),
      progress: this.progress,
      freed: game.freed,
      heroes: game.deps.characters.map((c) => c.id),
      hero: fontText(game.state.character.name),
      crash,
    });
    // S3: the gate's reminder and the local's welcome (routine), after Toad's own.
    return [...due, ...gateScenes(this.gateInput())];
  }

  /** What map/world-gate.ts reads about the page shown. */
  private gateInput() {
    const game = this.game;
    return {
      page: this.page,
      progress: this.progress,
      seen: (id: string) => game.seen(id),
      hero: fontText(game.state.character.name),
      node: this.node,
    };
  }

  /**
   * A world gate breaks on this page (map/world-gate.ts gateDue: its road on is waiting in the
   * reveal; campaign story only, on a page really open): its beat is marked and the `gate` mode
   * plays Bowser's cutaway and the seal shattering (World 8: the crack tearing open). False when
   * none is due.
   */
  private startGate(): boolean {
    const game = this.game;
    if (!storyOn(game) || !this.page.nodes.length || !isPageOpen(this.progress, this.page.id)) return false;
    const pending = this.revealQueue.map((id) => revealId(this.page.id, id));
    const due = gateDue(this.gateInput(), pending);
    if (!due) return false;
    game.markSeen(beat.gate(this.page.id));
    const end = due.exit.points[due.exit.points.length - 1] ?? [15, 7];
    const scene = new GateScene(
      due,
      { x: end[0] * 16, y: end[1] * 16 },
      {
        say: (text) => this.say(text),
        sfx: (id) => game.ctx.audio.sfx(id),
        prompt: () => abilityHint(game, 'OK', 'jump'),
        reduceFlashing: () => game.ctx.reduceFlashing,
      },
    );
    this.gateToad = due.toad.length ? due.toad : null;
    if (scene.done) {
      this.afterGate();
      return true;
    }
    this.gate = scene;
    this.mode = 'gate';
    return true;
  }

  private updateGate(inputs: readonly InputFrame[]): void {
    const g = this.gate;
    if (g) g.update(inputs);
    if (g && !g.done) return;
    this.gate = null;
    this.afterGate();
  }

  /**
   * The gate scene is over: worlds 1-7 draw the road in, then Toad walks in (finishReveal);
   * World 8 goes on to Toad's rift scene, then its road (the usual order).
   */
  private afterGate(): void {
    if (this.gateToad) {
      this.revealT = 0;
      if (this.revealQueue.length) this.mode = 'reveal';
      else this.finishReveal();
      return;
    }
    if (this.startStory(false)) return;
    this.afterStory();
  }

  /**
   * Toad's scenes, page by page; when the last page is over, the reveal (afterStory). Toad's walk
   * back off goes on over the map after that (updateToadLeaving), so the hero is not held up.
   */
  private updateStory(inputs: readonly InputFrame[]): void {
    const g = this.toad;
    if (g) g.update(inputs);
    if (g && !g.done && !g.leaving) return;
    if (g?.done) this.toad = null;
    this.afterStory();
  }

  /** Outside the `story` mode: Toad walking back off after his last page, until he is gone. */
  private updateToadLeaving(): void {
    const g = this.toad;
    if (!g || this.mode === 'story') return;
    g.update([]);
    if (g.done) this.toad = null;
  }

  /**
   * Queues this page's share of the game's pending reveal ids (the rest wait for their own
   * page); they leave the pending list once drawn in (finishReveal).
   */
  private takeReveal(): void {
    const ids = new Set(this.pageIds(this.page));
    const page = this.page.id;
    this.game.pendingReveal = this.game.pendingReveal.filter((rid) => {
      const r = parseRevealId(rid);
      if (!r || r.page !== page) return true;
      if (ids.has(r.id) && !this.revealShown.has(r.id)) {
        this.revealQueue.push(r.id);
        this.revealShown.set(r.id, 0);
        this.revealTaken.push(rid);
        if (this.nodeById(r.id)) this.revealNodes.push(r.id);
        return true; // until drawn in
      }
      return false; // not on this page: stale
    });
  }

  /**
   * The crystal ball's crash cutscene (Game.mapCutscene, set when the ball is taken; consumed here
   * whether or not it plays): on the page whose bonus node the ball opens, while that node and its
   * road wait in the reveal. It runs as the `cutscene` mode, then the reveal draws the road.
   */
  private startCrash(): boolean {
    if (this.game.mapCutscene !== 'airship-crash') return false;
    this.game.mapCutscene = null;
    const bonus = this.page.nodes.find((n) => n.kind === 'bonus' && n.unlock === CRYSTAL_BALL);
    const here = this.nodeById(this.node);
    if (!this.game.campaign || !bonus || !here || !this.revealQueue.includes(bonus.id)) return false;
    const s = this.game.state;
    const names: CrashNames = {
      heroes: s.character2 ? `${s.character.name} and ${s.character2.name}` : s.character.name,
      bonus: spoken(bonusGame().label(this.game)),
      skip: abilityHint(this.game, 'JUMP', 'jump'),
    };
    this.crash = { scene: new AirshipCrash(here, bonus), node: bonus.id, names, lead: `${this.hereLine()}.` };
    this.mode = 'cutscene';
    return true;
  }

  /** The crash cutscene's frame; JUMP (or MENU) skips straight to its end and the road drawn. */
  private updateCrash(input: InputFrame): void {
    const c = this.crash as NonNullable<typeof this.crash>;
    if (this.t > 1 && (input.pressed('jump') || input.pressed('start'))) {
      this.endCrash();
      this.finishReveal();
      // Skipped: the road is drawn, and Toad's crash cards still play (once per file).
      this.startStory(true);
      return;
    }
    for (const ev of c.scene.update(c.names)) {
      if (ev.sfx) this.game.ctx.audio.sfx(ev.sfx);
      if (!ev.say) continue;
      this.say(c.lead ? `${c.lead} ${ev.say}` : ev.say);
      c.lead = '';
    }
    if (c.scene.built) this.showBonus(c.node);
    if (!c.scene.done) return;
    this.endCrash();
    // Toad's crash cards (and whatever else is due), then the road to the bonus spot draws in.
    this.arrived(true);
  }

  /** The bonus node built by Toad: out of the reveal (drawn from now on, still announced). */
  private showBonus(id: string): void {
    this.revealShown.delete(id);
    this.revealQueue = this.revealQueue.filter((q) => q !== id);
  }

  private endCrash(): void {
    const c = this.crash;
    if (!c) return;
    this.crash = null;
    this.showBonus(c.node);
    this.mode = 'reveal';
  }

  /** True while the airship's crash cutscene plays. */
  get cutscene(): boolean {
    return this.crash !== null;
  }

  private nodeById(id: string): MapNode | undefined {
    return this.page.nodes.find((n) => n.id === id);
  }

  /** Puts the hero on its node and records that as the file's map position. */
  private placeHero(): void {
    const n = this.nodeById(this.node);
    this.hx = n ? n.x * 16 : 0;
    this.hy = n ? n.y * 16 : 0;
    this.progress.position = { page: this.page.id, node: this.node };
    if (this.node) this.game.mapLastNode[this.page.id] = this.node;
  }

  /** Every id a reveal may name on a page. */
  private pageIds(page: WorldMapPage): string[] {
    return [...page.nodes.map((n) => n.id), ...page.paths.map(pathId), ...page.exits.map(exitId)];
  }

  private view(page: WorldMapPage): PageView {
    let v = this.views.get(page);
    if (v) return v;
    const { paths, exits } = openPaths(this.progress, page, this.unlockAll);
    const nodes = page.nodes
      .filter((n) => isOpen(this.progress, page, n.id, this.unlockAll))
      .map((n) => {
        const frame = this.nodeFrame(page, n);
        const c = frame.indexOf(':');
        return c > 0 ? { node: n, sheet: frame.slice(0, c), frame: frame.slice(c + 1) } : { node: n, frame };
      });
    v = {
      runs: [
        ...paths.map((p) => ({ id: pathId(p), dots: pathDots(p.points, true, true) })),
        ...exits.map((e) => ({ id: exitId(e), dots: pathDots(e.points, true, false) })),
      ],
      nodes,
      // Every node may have a hero beside it: a shown node's silhouette or trophy, and with the
      // crystal ball a silhouette by a node not reached yet (heroMarks).
      heroes: page.nodes.flatMap((node) => this.heroMarks(page, node)),
    };
    this.views.set(page, v);
    return v;
  }

  /**
   * The hidden heroes beside a shown node, in campaign play only (map/captives.ts): a silhouette
   * once its level is cleared, the hero in colour once freed (the file's `freed`; dev "All
   * heroes" never changes it). A second hero at one node stands a little further out.
   */
  private heroMarks(page: WorldMapPage, node: MapNode): HeroMark[] {
    if (!this.game.campaign || !node.level) return [];
    const side = heroSide(page, node);
    const out: HeroMark[] = [];
    for (const h of hiddenHeroesAt(page.id, node.id)) {
      const hint = heroHint(h, this.progress, this.game.freed);
      const def = this.game.deps.characters.find((c) => c.id === h.hero);
      if (hint === 'none' || !def) continue;
      // A node not shown (yet): nothing beside it, except, once the crystal ball is found, the
      // silhouette of a hero hiding on a world the file has really reached (0.4.23, docs/STORY.md
      // 2.7: the ball shows each world's hider from the first arrival). Never one shown only
      // through developer "Unlock all".
      const reached = isOpen(this.progress, page, node.id);
      const ball = this.progress.secrets.includes(CRYSTAL_BALL) && isPageOpen(this.progress, page.id);
      const shows =
        hint === 'trophy' ? isOpen(this.progress, page, node.id, this.unlockAll) : reached || ball;
      if (!shows) continue;
      // The silhouette peeks out from behind the dot (half of it hidden); the trophy's pedestal
      // stands clear of it (and of the player's marker on the node), on the ground beside it.
      const out0 = hint === 'silhouette' ? 9 : 18;
      const step = hint === 'silhouette' ? 12 : PEDESTAL_W + 3;
      out.push({
        node,
        hint,
        def,
        side,
        cx: node.x * 16 + 8 + side * (out0 + out.length * step),
        feet: node.y * 16 + (hint === 'silhouette' ? 9 : 10),
      });
    }
    return out;
  }

  /**
   * A hero freed since the map last showed it (Game.celebrate) starts its burst of happy hops the
   * first time its trophy is on the page shown.
   */
  private startTrophyBursts(): void {
    const c = this.game.celebrate;
    if (c.size === 0 || !this.page.nodes.length) return;
    for (const m of this.view(this.page).heroes)
      if (m.hint === 'trophy' && c.delete(m.def.id)) this.trophyBursts.set(m.def.id, this.t);
  }

  /** The node the hero stands still on hides a hero not freed yet whose level is cleared. */
  private hidingHere(): boolean {
    if (this.mode !== 'idle') return false;
    const n = this.nodeById(this.node);
    return !!n && this.isHiding(n);
  }

  private isHiding(n: MapNode): boolean {
    return this.view(this.page).heroes.some((m) => m.node === n && m.hint === 'silhouette');
  }

  private say(text: string): void {
    this.game.deps.announcer?.say(text);
  }

  /** The page's name and the node the hero stands on. */
  private announceHere(): void {
    this.say(this.hereLine());
  }

  private hereLine(): string {
    const n = this.nodeById(this.node);
    const label = spoken(this.page.label);
    const page = label.toUpperCase() === this.page.title ? label : `${label}, ${this.page.title}`;
    return n ? `${page}. ${this.nodeLabel(n)}` : page;
  }

  /**
   * "World 1-2, cleared, secret exit" ("World 1-2, open, secret exit found": beaten only through its
   * secret exit, rules.secretExitTaken) / "World 1-3, open" / "World 1-4 castle, open" / "Lost A-1, open";
   * warp nodes say their hint line: "Warp, Return To World 1" / "Lost Levels - Beat 8-4 To
   * Unlock, locked".
   */
  nodeLabel(n: MapNode): string {
    const label = spoken(this.page.label);
    // A Mini Game Arena pad (src/game/arena): its game, or why it is still dark.
    if (n.kind === 'game') return arenaPadSaid(this.game, n, abilityHint(this.game, 'JUMP', 'jump'));
    // A bonus node leading into a level (World 2's Top Secret Area): its label; always open.
    if (isBonusArea(n)) return `${spoken(n.label ?? 'Bonus')}, open`;
    // The bonus spot (map/bonus-spot.ts): the bonus game's name while open.
    if (n.kind === 'bonus')
      return this.game.bonusOpen ? `${spoken(bonusGame().label(this.game))}, open` : this.bonusShutSaid();
    if (isWarpNode(n)) {
      const text = spoken(warpText(this.progress, n, this.unlockAll));
      return isWarpOpen(this.progress, n, this.unlockAll) ? `Warp, ${text}` : `${text}, locked`;
    }
    let state = isCleared(this.progress, this.page, n.id) ? 'cleared' : 'open';
    if (hasSecretExit(n.level))
      state += secretExitTaken(this.progress, this.page, n.id) ? ', secret exit found' : ', secret exit';
    const hint = exitHint(this.progress, this.page, n.id, this.unlockAll);
    let text = this.nodeLabelPlain(n, label, state);
    if (hint) text += `. ${spoken(hint)}`;
    const sealed = this.sealedHintAt(n);
    if (sealed) text += `. ${spoken(sealed)}`;
    const local = this.localHere(n) ? welcomeOf(this.page.id) : null;
    if (local) text += `. ${local.said}. Up to talk`;
    if (this.isHiding(n)) text += `. ${HIDING_SAID}`;
    return text;
  }

  private nodeLabelPlain(n: MapNode, label: string, state: string): string {
    if (n.kind === 'start' && !n.level) return `${label} start`;
    // The stage is the level id's last part ('1-2' → 2, 'll-10-3' → 3).
    const stage = n.level?.split('-').pop();
    const lvl = stage ? `${label}-${stage}` : label;
    return n.kind === 'castle' ? `${lvl} castle, ${state}` : `${lvl}, ${state}`;
  }

  /**
   * The seal's hint line on node `n` when the road on leaving it is sealed (story only; never
   * through Unlock all), else ''.
   */
  private sealedHintAt(n: MapNode): string {
    if (!storyOn(this.game) || this.unlockAll) return '';
    const e = sealedExit(this.progress, this.page);
    if (!e || e.from !== n.id || !e.gate) return '';
    const def = this.game.deps.characters.find((c) => c.id === e.gate);
    return sealedHint(fontText(def?.name ?? e.gate).toUpperCase());
  }

  /** The sealed hint while the hero stands still on its node, else ''. */
  private sealedHintHere(): string {
    if (this.mode !== 'idle') return '';
    const n = this.nodeById(this.node);
    return n ? this.sealedHintAt(n) : '';
  }

  /** Node `n` is this page's start with a local standing by it (worlds 2-8; story only). */
  private localHere(n: MapNode): boolean {
    return storyOn(this.game) && localNode(this.progress, this.page) === n;
  }

  /** TALK (up) on a start node with a local: the welcome again, in the box at the top. */
  private talkToLocal(): void {
    const w = welcomeOf(this.page.id);
    if (!w) return;
    const game = this.game;
    const guide = new ToadGuide(
      [{ ids: [], pages: [...w.pages], walk: false }],
      { x: 0, y: 0 },
      {
        markSeen: (id) => game.markSeen(id),
        say: (text) => this.say(text),
        prompt: () => abilityHint(game, 'OK', 'jump'),
      },
    );
    if (guide.done) return;
    this.toad = guide;
    this.mode = 'story';
  }

  /** The warp node the hero stands still on (the hint line shows), or null. */
  warpHere(): MapNode | null {
    if (this.mode !== 'idle') return null;
    const n = this.nodeById(this.node);
    return n && isWarpNode(n) ? n : null;
  }

  /**
   * The hint line's text while the hero stands still on a warp node, on the node a locked world
   * exit with a hint leaves from (Lost 8-4: World 9's count), or on a cleared level that still
   * hides a hero (HIDING_HINT); '' otherwise.
   */
  get hintLine(): string {
    const n = this.warpHere();
    if (n) return warpText(this.progress, n, this.unlockAll);
    if (this.mode !== 'idle') return '';
    const here = this.nodeById(this.node);
    if (here && isBonusArea(here)) return here.label ?? '';
    if (here?.kind === 'bonus')
      return this.game.bonusOpen
        ? bonusGame().label(this.game)
        : this.game.bonusGuard
          ? BONUS_CLOSED_HINT
          : BONUS_SPENT_HINT;
    if (here?.kind === 'game') return arenaPadHint(this.game, here);
    // S3: a sealed road on (SEALED - FREE <NAME> FIRST); a world's local on its start node.
    const sealed = this.sealedHintHere();
    if (sealed) return sealed;
    if (here && this.localHere(here)) return localHint(this.page.id);
    return (
      exitHint(this.progress, this.page, this.node, this.unlockAll) ||
      (here && this.hidingHere() ? HIDING_HINT : '')
    );
  }

  update(input: InputFrame, inputs: readonly InputFrame[] = [input]): void {
    this.t++;
    this.startTrophyBursts();
    this.updateToadLeaving();
    if (this.updateGuard()) return;
    switch (this.mode) {
      case 'reveal':
        this.updateReveal(input);
        return;
      case 'cutscene':
        this.updateCrash(input);
        return;
      case 'story':
        this.updateStory(inputs);
        return;
      case 'gate':
        this.updateGate(inputs);
        return;
      case 'walk':
        this.updateWalk();
        return;
      case 'slide':
        this.updateSlide();
        return;
      case 'fade':
        this.updateFade();
        return;
      case 'idle':
        this.updateIdle(input);
    }
  }

  /**
   * Idle: A enters the level underfoot when it is open (warps on an open warp node), Start (or
   * Select) opens the map menu. A reveal skips on any button (A says so); nothing to press
   * while walking, sliding or fading.
   */
  touchLabels(): TouchLabels {
    if (this.mode === 'reveal' || this.mode === 'cutscene') return { ...NO_TOUCH_BUTTONS, jump: 'SKIP' };
    // Toad's box: OK the next page, SKIP the rest of that scene.
    if (this.mode === 'story' || this.mode === 'gate')
      return { ...NO_TOUCH_BUTTONS, jump: 'OK', attack: 'SKIP' };
    if (this.mode !== 'idle') return NO_TOUCH_BUTTONS;
    const here = this.nodeById(this.node);
    const open = !!here?.level && isOpen(this.progress, this.page, here.id, this.unlockAll);
    const warp = !!here && isWarpOpen(this.progress, here, this.unlockAll);
    const bonus =
      here?.kind === 'bonus' &&
      !isBonusArea(here) &&
      this.game.bonusOpen &&
      isOpen(this.progress, this.page, here.id, this.unlockAll);
    return {
      ...NO_TOUCH_BUTTONS,
      jump: open || bonus ? 'ENTER' : warp ? 'WARP' : null,
      start: 'MENU',
      special: inventoryAvailable(this.game) ? 'ITEMS' : null,
      ...(here?.kind === 'game' ? arenaPadTouch(this.game, here) : {}),
    };
  }

  private updateReveal(input: InputFrame): void {
    if (this.t > 1 && ANY.some((a) => input.pressed(a))) {
      this.finishReveal();
      return;
    }
    const id = this.revealQueue[0];
    if (id === undefined) {
      this.finishReveal();
      return;
    }
    this.revealT++;
    if (this.nodeById(id)) {
      if (this.revealT >= REVEAL_NODE_FRAMES) {
        this.revealShown.delete(id);
        this.game.ctx.audio.sfx('coin');
        this.nextReveal();
      }
      return;
    }
    if (this.revealT >= REVEAL_DOT_FRAMES) {
      this.revealT = 0;
      const shown = (this.revealShown.get(id) ?? 0) + 1;
      const run = this.view(this.page).runs.find((r) => r.id === id);
      if (!run || shown >= run.dots.length / 2) {
        this.revealShown.delete(id);
        this.nextReveal();
      } else this.revealShown.set(id, shown);
    }
  }

  private nextReveal(): void {
    this.revealQueue.shift();
    this.revealT = 0;
    if (!this.revealQueue.length) this.finishReveal();
  }

  private finishReveal(): void {
    this.revealQueue = [];
    this.revealShown.clear();
    this.mode = 'idle';
    const taken = this.revealTaken;
    this.game.pendingReveal = this.game.pendingReveal.filter((id) => !taken.includes(id));
    this.revealTaken = [];
    // Warp pads and arena pads drawn in are not read out (four hints in a row on the hub, a
    // dozen in the arena): a pad's hint is said when the hero stands on it.
    const opened = this.revealNodes
      .map((id) => this.nodeById(id))
      .filter((n): n is MapNode => !!n && !isWarpNode(n) && n.kind !== 'game')
      .map((n) => this.nodeLabel(n));
    this.revealNodes = [];
    if (opened.length) this.say(opened.join('. '));
    this.game.autosave();
    // A gate's road has drawn in: Toad walks in (then whatever else is due).
    const toad = this.gateToad;
    if (toad) {
      this.gateToad = null;
      this.startStory(false, toad);
    }
  }

  /**
   * True while a reveal is still drawing in (the crash cutscene before it included, and Toad's
   * box while a reveal waits behind it).
   */
  get revealing(): boolean {
    return (
      this.mode === 'reveal' ||
      this.mode === 'cutscene' ||
      this.mode === 'gate' ||
      (this.mode === 'story' && this.revealQueue.length > 0)
    );
  }

  /** True while Toad's box (or Toad walking in or off) shows over the map. */
  get story(): boolean {
    return this.mode === 'story';
  }

  private updateIdle(input: InputFrame): void {
    if (this.t < 6) return;
    const here = this.nodeById(this.node);
    // Start and select open the map menu (as start pauses a level); only jump enters a level.
    if (input.pressed('start') || input.pressed('select')) {
      this.openPause();
      return;
    }
    // The ITEMS button (SMB3's item box), once the inventory is unlocked.
    if (input.pressed('special') && inventoryAvailable(this.game)) {
      this.openItems();
      return;
    }
    if (input.pressed('jump') && here?.level && isOpen(this.progress, this.page, here.id, this.unlockAll)) {
      // The one way into a level from the map: Chapter 2's levels are sealed for now (the card).
      if (this.game.chapterBlocked(here.level)) {
        showChapterGate(this.game);
        return;
      }
      this.game.ctx.audio.sfx('coin');
      this.game.enterLevelFromMap(here.level);
      return;
    }
    if (
      input.pressed('jump') &&
      here?.kind === 'bonus' &&
      isOpen(this.progress, this.page, here.id, this.unlockAll)
    ) {
      if (this.game.bonusOpen) {
        this.game.ctx.audio.sfx('coin');
        this.game.openBonus({ page: this.page.id, node: here.id });
      } else {
        // Used: a bump, and why it is shut.
        this.game.ctx.audio.sfx('bump');
        this.say(this.bonusShutSaid());
      }
      return;
    }
    if (input.pressed('jump') && here?.kind === 'game') {
      // A Mini Game Arena pad: one round for fun over the map, then back here (nothing saved).
      if (!playArenaPad(this.game, here, this.page.music, () => this.announceHere()))
        this.say(this.nodeLabel(here));
      return;
    }
    if (input.pressed('jump') && here && isWarpNode(here)) {
      if (isWarpOpen(this.progress, here, this.unlockAll)) this.warp(here);
      else {
        // Locked: a bump, and the hint (still on the hint line) said again.
        this.game.ctx.audio.sfx('bump');
        this.say(this.nodeLabel(here));
      }
      return;
    }
    for (const d of DIRS) {
      if (!input.pressed(d)) continue;
      const step = here ? nextStep(this.page, this.progress, this.node, d, MAP_PAGES, this.unlockAll) : null;
      // S3: up on a start node with a local (no road goes up from it) talks to the local.
      if (!step && d === 'up' && here && this.localHere(here)) {
        this.talkToLocal();
        return;
      }
      if (!step) {
        this.game.ctx.audio.sfx('bump');
        return;
      }
      this.walkStep = step;
      this.walkPts = step.points.map(([x, y]): [number, number] => [x * 16, y * 16]);
      if (step.kind !== 'node') {
        // Walk on off the page edge before the slide.
        const a = step.points[step.points.length - 2] as [number, number];
        const b = step.points[step.points.length - 1] as [number, number];
        this.walkPts.push([(2 * b[0] - a[0]) * 16, (2 * b[1] - a[1]) * 16]);
      }
      this.walkPts.shift();
      this.mode = 'walk';
      return;
    }
  }

  private updateWalk(): void {
    const target = this.walkPts[0];
    const step = this.walkStep;
    if (!target || !step) {
      this.mode = 'idle';
      return;
    }
    const dx = target[0] - this.hx;
    const dy = target[1] - this.hy;
    if (dx) this.facingLeft = dx < 0;
    this.hx += Math.sign(dx) * Math.min(MAP_WALK_SPEED, Math.abs(dx));
    this.hy += Math.sign(dy) * Math.min(MAP_WALK_SPEED, Math.abs(dy));
    if (this.hx !== target[0] || this.hy !== target[1]) return;
    this.walkPts.shift();
    if (this.walkPts.length) return;
    this.walkStep = null;
    if (step.kind === 'node') {
      this.arrive(step.to);
      return;
    }
    const toPage = step.kind === 'exit' ? step.exit.to : step.page;
    const next = mapPage(toPage);
    if (!next || !isPageOpen(this.progress, toPage, this.unlockAll)) {
      this.mode = 'idle';
      this.placeHero();
      return;
    }
    const side = step.kind === 'exit' ? step.exit.side : null;
    const dir: -1 | 1 = step.kind === 'back' ? (this.hx < 128 ? -1 : 1) : side === 'left' ? -1 : 1;
    this.slide = {
      from: this.page,
      dir,
      t: 0,
      node: step.kind === 'back' ? step.node : (startNode(next)?.id ?? ''),
    };
    this.page = next;
    this.views.clear();
    this.guard = null;
    this.mode = 'slide';
    this.takeReveal(); // hidden while sliding in, drawn in on arrival
  }

  private updateSlide(): void {
    const s = this.slide;
    if (!s) {
      this.mode = 'idle';
      return;
    }
    s.t++;
    if (s.t < MAP_SLIDE_FRAMES) return;
    this.slide = null;
    this.views.clear();
    this.node = this.nodeById(s.node) ? s.node : (startNode(this.page)?.id ?? '');
    this.placeHero();
    this.refreshGuard();
    if (this.page.music !== s.from.music) this.game.ctx.audio.playMusic(this.page.music);
    this.announceHere();
    this.arrived(); // Toad's scenes, then the reveal (which saves when drawn in)
  }

  /**
   * Jump on an open warp node: its target page opens (what that opens is drawn in on arrival),
   * the hero's place here is kept for map travel, and the map fades over to the target node
   * (`toNode` when it is open, else the start), where the position is saved. A warp that works
   * only through developer "Unlock all" travels without opening anything in the file.
   */
  private warp(n: MapNode): void {
    const next = n.to === undefined ? undefined : mapPage(n.to);
    if (!next) return;
    this.game.ctx.audio.sfx('coin');
    this.game.mapLastNode[this.page.id] = this.node;
    if (warpRecords(this.progress, this.page, n)) this.game.addReveal(warpTo(this.progress, next.id));
    // A hidden or unreachable arrival node (World 1's warp spot before its secret) would strand
    // the hero: the start instead.
    const target =
      n.toNode && isOpen(this.progress, next, n.toNode, this.unlockAll) ? n.toNode : startNode(next)?.id;
    this.fade = { from: this.page, t: 0, node: target ?? '' };
    this.page = next;
    this.views.clear();
    this.guard = null;
    this.mode = 'fade';
    this.takeReveal(); // hidden while fading in, drawn in on arrival
  }

  private updateFade(): void {
    const f = this.fade;
    if (!f) {
      this.mode = 'idle';
      return;
    }
    f.t++;
    if (f.t < MAP_FADE_FRAMES) return;
    this.fade = null;
    this.views.clear();
    this.node = this.nodeById(f.node) ? f.node : (startNode(this.page)?.id ?? '');
    this.placeHero();
    this.refreshGuard();
    if (this.page.music !== f.from.music) this.game.ctx.audio.playMusic(this.page.music);
    this.announceHere();
    this.arrived(); // Toad's scenes, then the reveal (which saves when drawn in)
  }

  private arrive(nodeId: string): void {
    this.node = nodeId;
    this.mode = 'idle';
    this.placeHero();
    this.views.clear();
    // Off the Hammer Bro's road node (where he holds back), he comes out now.
    if (!this.guard) this.refreshGuard();
    const n = this.nodeById(nodeId);
    if (n) this.say(this.nodeLabel(n));
  }

  private openPause(): void {
    const game = this.game;
    game.ctx.audio.sfx('pause');
    const pop = () => game.scenes.pop();
    const items = (): MenuItem[] => [
      { label: 'Continue', select: pop },
      ...(inventoryAvailable(game)
        ? [
            {
              label: 'Items',
              value: () => String(shownItems(game).length),
              select: () => {
                pop();
                this.openItems();
              },
              hint: `Use an item before entering a level. Also on ${abilityHint(game, 'ITEMS', 'special')}`,
            },
          ]
        : []),
      { label: 'Worlds', select: () => this.openWorlds() },
      { label: 'Save and quit', select: () => game.saveAndQuit() },
      { label: 'Options', select: () => game.scenes.push(new OptionsScene(game, pop, true)) },
      ...(game.devMode
        ? [
            {
              label: 'Item inventory',
              value: () => (game.bonus.devInventory ? 'on' : 'off'),
              adjust: () => {
                this.toggleInventory();
                menu.rebuild(items(), 'Item inventory');
              },
              hint: 'Developer mode: the item inventory unlocked before Larry is beaten',
            },
            {
              label: 'Give items',
              select: () => {
                this.giveItems();
                menu.rebuild(items(), 'Give items');
              },
              hint: 'Developer mode: one of each item, never saved; turns Item inventory on',
            },
            {
              label: 'All heroes',
              value: () => (game.devAllHeroes ? 'on' : 'off'),
              adjust: () => this.toggleAllHeroes(),
              hint: 'Developer mode: every hero can be picked, none freed',
            },
            {
              label: 'Unlock all',
              value: () => (game.devUnlockAll ? 'on' : 'off'),
              adjust: () => this.toggleUnlockAll(),
              hint: 'Developer mode: every level on the map open',
            },
            {
              label: 'Chapter 2 gate',
              value: () => (game.devGateOpen ? 'open' : 'closed'),
              adjust: () => this.toggleChapterGate(),
              hint: 'Developer mode: open lets the Lost Kingdom levels be entered',
            },
          ]
        : []),
    ];
    const menu = new MapMenu(game, items(), pop);
    game.scenes.push(menu);
  }

  /**
   * Map menu "All heroes" (dev mode only): flips the file's flag and saves. The file's freed list
   * is never touched; turning it off puts a player on a hero it has not freed back on Mario.
   */
  private toggleAllHeroes(): void {
    const game = this.game;
    game.devAllHeroes = !game.devAllHeroes;
    if (!game.devAllHeroes) game.dropLockedHeroes();
    this.views.clear();
    game.autosave();
  }

  /**
   * Map menu "Chapter 2 gate" (dev mode only): flips the file's flag and saves. Open, the campaign
   * enters Lost Kingdom levels as before the gate (rules.chapterGated); nothing else changes.
   */
  private toggleChapterGate(): void {
    const game = this.game;
    game.devGateOpen = !game.devGateOpen;
    game.autosave();
  }

  /** The ITEMS panel over the map (the inventory). */
  private openItems(): void {
    this.game.scenes.push(new InventoryScene(this.game));
  }

  /**
   * Map menu "Item inventory" (dev mode only): flips the file's dev flag and saves. It never writes
   * `inventoryUnlocked`; the open map menu is rebuilt with or without its Items row.
   */
  private toggleInventory(): void {
    const game = this.game;
    game.bonus.devInventory = !game.bonus.devInventory;
    game.autosave();
  }

  /**
   * Map menu "Give items" (dev mode only): one of each item, as room allows, into the dev list
   * (`bonus.devItems`): never saved, shown only while dev mode and "Item inventory" are on (this
   * turns it on). The file's own items and progress are not touched.
   */
  private giveItems(): void {
    const game = this.game;
    const added = giveDevItems(game.bonus);
    game.bonus.devInventory = true;
    game.ctx.audio.sfx(added ? 'powerup' : 'bump');
    this.say(added ? `${added} dev items added. They are never saved.` : 'The inventory is full.');
  }

  /**
   * Map menu "Unlock all" (dev mode only): flips the file's flag and saves. Turning it off puts a
   * hero standing somewhere locked back on the start of its world, or of the furthest open world.
   */
  private toggleUnlockAll(): void {
    const game = this.game;
    game.devUnlockAll = !game.devUnlockAll;
    this.views.clear();
    this.refreshGuard();
    if (!game.devUnlockAll) {
      const prog = this.progress;
      if (!isPageOpen(prog, this.page.id)) {
        game.travelToPage(furthestOpenPage(prog, false)); // shows that page, which saves
        game.autosave();
        return;
      }
      if (!isOpen(prog, this.page, this.node)) {
        this.node = startNode(this.page)?.id ?? '';
        this.placeHero();
      }
    }
    game.autosave();
  }

  /**
   * The pages the map menu "Worlds" lists, in play order: the open pages of the story (SMB
   * worlds, then the Lost Levels worlds, its extension since 0.4.7), plus the hub when it is
   * open; on the hub, the hub first.
   */
  worldsMenuPages(): WorldMapPage[] {
    const story = (g: PageGroup) => g === 'smb' || g === 'll';
    const group = this.page.group;
    const same = (p: WorldMapPage) => p.group === group || (story(p.group) && story(group));
    const open = MAP_PAGES.filter(
      (p) =>
        (group === 'hub' || same(p) || p.group === 'hub') && isPageOpen(this.progress, p.id, this.unlockAll),
    );
    // The current group (the story counts as one) first, then the Warp Zone, then the others.
    const rank = (p: WorldMapPage) => (same(p) ? 0 : p.group === 'hub' ? 1 : 2);
    return open.sort((a, b) => rank(a) - rank(b) || MAP_PAGES.indexOf(a) - MAP_PAGES.indexOf(b));
  }

  /**
   * Map menu "Worlds": the pages of worldsMenuPages by label; the current one is marked HERE and
   * the cursor starts on it.
   */
  private openWorlds(): void {
    const game = this.game;
    const here = this.page.id;
    const pages = this.worldsMenuPages();
    const items = pages.map((p): MenuItem => ({
      label: spoken(p.label),
      ...(p.id === here ? { value: () => 'here', hint: 'You are here' } : {}),
      select: () => {
        if (p.id !== here) return game.travelToPage(p.id);
        game.scenes.pop(); // the current world: just close both menus
        game.scenes.pop();
      },
    }));
    const start = Math.max(
      0,
      pages.findIndex((p) => p.id === here),
    );
    game.scenes.push(new WorldsMenu(game, items, () => game.scenes.pop(), start));
  }

  /** Said on a used bonus node: come back after a level, or beat the Hammer Bro once he is out. */
  private bonusShutSaid(): string {
    return this.game.bonusGuard ? BONUS_CLOSED_SAID : BONUS_SPENT_SAID;
  }

  /**
   * The Hammer Bro (campaign only): out on the road to a bonus node with `guard: 'hammer-bro'` while
   * the bonus is used (Game.bonusOpen false), a level has been entered since (Game.bonusGuard) and
   * the node is shown, on the road tile farthest from the hero (map/hammer-bro.ts). Not while the
   * hero stands on that road (its node), where he would block the only way back: he comes out
   * when the hero arrives anywhere else (arrive), or the map shows, slides or fades in again.
   */
  private refreshGuard(): void {
    this.guard = null;
    if (!this.game.campaign || this.game.bonusOpen || !this.game.bonusGuard) return;
    const n = this.page.nodes.find(
      (x) => x.guard === 'hammer-bro' && isOpen(this.progress, this.page, x.id, this.unlockAll),
    );
    if (!n) return;
    const road = guardRoad(this.page, n.id);
    if (!road.length) return;
    const here = this.nodeById(this.node);
    if (here && road.some(([x, y]) => x === here.x && y === here.y)) return;
    this.guard = MapGuard.spawn(road, here ? [here.x, here.y] : [n.x, n.y], 0x5eed + this.t);
    this.guardGrace = GUARD_GRACE_FRAMES;
  }

  /** The Hammer Bro may not step onto tile (x, y): the hero is on it, or walking along it. */
  private guardBlocked(x: number, y: number): boolean {
    const px = x * 16;
    const py = y * 16;
    if (Math.abs(px - this.hx) < 16 && Math.abs(py - this.hy) < 16) return true;
    return this.mode === 'walk' && this.walkPts.some(([wx, wy]) => wx === px && wy === py);
  }

  /**
   * The Hammer Bro wanders while the hero stands or walks, never onto the hero's tile or path;
   * only the hero walking into him starts the battle (Game.startHammerBattle). True when it did.
   */
  private updateGuard(): boolean {
    const g = this.guard;
    if (!g || (this.mode !== 'idle' && this.mode !== 'walk')) return false;
    // He waits out the grace before his first step; walking into him counts at once.
    if (this.guardGrace > 0) this.guardGrace--;
    else g.update((x, y) => this.guardBlocked(x, y));
    if (this.mode !== 'walk' || !g.touches(this.hx, this.hy)) return false;
    this.guard = null;
    this.game.ctx.audio.sfx('kick');
    this.game.startHammerBattle();
    return true;
  }

  /** The Hammer Bro (the smb3 sheet's map frames, facing left), feet on the road like the hero's. */
  private drawGuard(r: Renderer, g: MapGuard): void {
    const sheet = this.game.ctx.assets.sheet('smb3');
    const frame = `hammer-bro-map-${(this.t >> 4) & 1}`;
    const h = sheet.frames.get(frame)?.h ?? 16;
    r.sprite(sheet, frame, g.x, g.y + 10 - h, !g.facingLeft);
  }

  // ---------------------------------------------------------------- drawing

  render(r: Renderer): void {
    const s = this.slide;
    if (s) {
      const k = Math.min(1, s.t / MAP_SLIDE_FRAMES);
      const off = Math.round(256 * k) * s.dir;
      r.clear(mapSky(s.from));
      this.drawPage(r, s.from, -off, false);
      this.drawPage(r, this.page, s.dir * 256 - off, false);
    } else if (this.fade) {
      // First half: the page left darkens to black; second half: the new page comes up.
      const half = MAP_FADE_FRAMES / 2;
      const t = this.fade.t;
      const page = t < half ? this.fade.from : this.page;
      r.clear(mapSky(page));
      this.drawPage(r, page, 0, false);
      const k = t < half ? t / half : Math.max(0, (MAP_FADE_FRAMES - t) / half);
      r.rect(0, 0, 256, 240, FADE_SHADES[Math.min(FADE_SHADES.length - 1, Math.round(k * 8))] as string);
    } else {
      r.clear(mapSky(this.page));
      this.drawPage(r, this.page, 0, true);
    }
    this.drawHeader(r);
    this.drawHint(r);
    // Toad (walking in for a major scene) and his box at the top, over the map.
    this.toad?.draw(r, this.game.ctx.assets);
    // A world gate breaking: the cutaway over the dimmed map, or the seal shattering.
    this.gate?.draw(r, this.game.ctx.assets);
  }

  /** The hint line across the bottom (a warp node, open or locked, or a locked exit's hint). */
  private drawHint(r: Renderer): void {
    const text = this.hintLine;
    if (!text) return;
    const font = this.game.ctx.assets.sheet('font');
    const line = text.slice(0, 32);
    r.rect(0, MAP_HINT_Y, 256, 240 - MAP_HINT_Y, '#000');
    r.text(font, line, Math.max(0, 128 - line.length * 4), MAP_HINT_Y + 3);
  }

  private drawPage(r: Renderer, page: WorldMapPage, ox: number, hero: boolean): void {
    const assets = this.game.ctx.assets;
    if (ox !== 0) r.rect(ox, 0, 256, 240, mapSky(page));
    const tiles = page.tiles;
    for (let y = 0; y < tiles.length; y++) {
      const row = tiles[y] as string;
      for (let x = 0; x < 16; x++) drawMapTile(r, assets, page, row[x] ?? '.', ox + x * 16, y * 16, this.t);
    }
    const actors = page.actors;
    const scratch = this.scratchActor;
    for (let i = 0; i < actors.length; i++) {
      const a = actors[i] as MapActor;
      if (ox === 0) {
        drawMapActor(r, assets, page, a, this.t);
        continue;
      }
      scratch.type = a.type;
      scratch.x = a.x + ox;
      scratch.y = a.y;
      if (a.props) scratch.props = a.props;
      else delete scratch.props;
      drawMapActor(r, assets, page, scratch, this.t);
    }
    const items = assets.sheet('items');
    const v = this.view(page);
    const revealing = page === this.page && this.revealShown.size > 0;
    for (let i = 0; i < v.runs.length; i++) {
      const run = v.runs[i] as DotRun;
      const shown = revealing ? this.revealShown.get(run.id) : undefined;
      const n = shown === undefined ? run.dots.length : shown * 2;
      for (let j = 0; j + 1 < n; j += 2)
        r.sprite(items, 'map-path-dot', ox + (run.dots[j] as number) - 4, (run.dots[j + 1] as number) - 4);
    }
    // Hidden heroes' silhouettes go behind the dots, freed heroes in front (before the player).
    for (let i = 0; i < v.heroes.length; i++) {
      const m = v.heroes[i] as HeroMark;
      if (m.hint === 'silhouette') this.drawHeroMark(r, page, m, ox);
    }
    for (let i = 0; i < v.nodes.length; i++) {
      const nv = v.nodes[i] as PageView['nodes'][number];
      if (revealing && this.revealShown.has(nv.node.id)) continue;
      if (nv.node.kind === 'game') {
        drawArenaPad(r, this.game, nv.node, ox, this.t);
        continue;
      }
      r.sprite(nv.sheet ? assets.sheet(nv.sheet) : items, nv.frame, ox + nv.node.x * 16, nv.node.y * 16);
    }
    for (let i = 0; i < v.heroes.length; i++) {
      const m = v.heroes[i] as HeroMark;
      if (m.hint === 'trophy') this.drawHeroMark(r, page, m, ox);
    }
    this.drawGateAndLocal(r, page, ox);
    if (hero && this.guard) this.drawGuard(r, this.guard);
    const crash = hero ? this.crash?.scene : undefined;
    if (crash) {
      // The hero is aboard until he jumps out; then on his way down to (and standing on) 4-2.
      const at = crash.heroAt();
      if (at) this.drawHeroes(r, at.x, at.y);
      crash.draw(r, this.game.ctx.assets, this.game.ctx.reduceFlashing);
    } else if (hero && page.nodes.length) this.drawHeroes(r);
  }

  /**
   * S3 (0.4.23, story only): the seal across a sealed road at the page's edge (World 8: the rift's
   * crack, held shut), kept while a gate scene runs until it shatters; and a world's local beside
   * its start node, blinking now and then.
   */
  private drawGateAndLocal(r: Renderer, page: WorldMapPage, ox: number): void {
    if (!storyOn(this.game) || this.unlockAll) return;
    const reduce = this.game.ctx.reduceFlashing;
    const gate = page === this.page ? this.gate : null;
    const e = gate ? (gate.sealShown ? gate.gate.exit : null) : sealedExit(this.progress, page);
    const end = e?.points[e.points.length - 1];
    if (end) {
      if (smbWorld(page.id) === 8) drawCrack(r, ox + end[0] * 16, end[1] * 16, this.t, reduce);
      else drawSeal(r, ox + end[0] * 16, end[1] * 16, this.t, reduce);
    }
    const who = LOCAL_SPRITES[page.id];
    const spot = localNode(this.progress, page) ? localSpot(page) : null;
    if (!spot || !who) return;
    // Beside the start node, clear of the hero standing there (map/world-gate.ts localSpot).
    const blink = this.t % 200 < 8 ? 1 : 0;
    r.sprite(this.game.ctx.assets.sheet('locals'), `${who}-${blink}`, ox + spot.x, spot.y);
  }

  private nodeFrame(page: WorldMapPage, n: MapNode): string {
    const cleared = isCleared(this.progress, page, n.id);
    if (isWarpNode(n)) return isWarpOpen(this.progress, n, this.unlockAll) ? 'map-warp' : 'map-warp-locked';
    switch (n.kind) {
      case 'start':
        if (n.level) return cleared ? 'map-node-cleared' : 'map-node-open';
        return 'map-node-start';
      case 'bonus': {
        // A bonus node into a level (the Top Secret Area): its own green dot with a sparkle.
        if (isBonusArea(n)) return 'map-node-tsa';
        // The bonus game's icon (`sheet:frame`) while open; used, a spent dot.
        return this.game.bonusOpen ? bonusGame().icon(this.game) : 'map-node-cleared';
      }
      case 'castle':
        if (hasSecretExit(n.level)) return cleared ? 'map-castle-secret-cleared' : 'map-castle-secret';
        return cleared ? 'map-castle-cleared' : 'map-castle';
      default:
        // Levels with a secret (alternate) exit keep their own look, cleared or not.
        if (hasSecretExit(n.level)) return cleared ? 'map-node-secret-cleared' : 'map-node-secret';
        return cleared ? 'map-node-cleared' : 'map-node-open';
    }
  }

  /**
   * A hidden hero beside its node, facing it: the silhouette in the page's ground shade (with a
   * slow, faint shimmer unless reduce flashing is on), or the freed hero in colour (drawTrophy).
   */
  private drawHeroMark(r: Renderer, page: WorldMapPage, m: HeroMark, ox: number): void {
    if (m.hint === 'trophy') return this.drawTrophy(r, m, ox);
    const p = m.def.portrait;
    const glow = !this.game.ctx.reduceFlashing && this.t % HIDING_SHIMMER_FRAMES < HIDING_GLOW_FRAMES;
    const sheet = this.game.ctx.assets.sheet(p.sheet, mapShadePalette(p.palette, page.theme, glow));
    const f = sheet.frames.get(p.frame);
    const w = f?.w ?? 16;
    const h = f?.h ?? 16;
    r.sprite(sheet, p.frame, ox + Math.round(m.cx - w / 2), m.feet - h, m.side > 0);
  }

  /**
   * A freed hero beside its node, glad to be free (map/trophy.ts): a half-size statue of it on a
   * small stone pedestal, so it never reads as the player's marker. Every few seconds a small
   * happy hop in its jump frame with a twinkle at the top (none with reduce flashing), a burst
   * of hops the first time after freeing. A 1-px dark outline keeps it clear of the map's ground
   * (Luigi's green on grass).
   */
  private drawTrophy(r: Renderer, m: HeroMark, ox: number): void {
    const def = m.def;
    const assets = this.game.ctx.assets;
    const phase = Math.max(0, this.game.deps.characters.indexOf(def)) * 53;
    const pose = trophyPose(
      this.t,
      phase,
      this.trophyBursts.get(def.id) ?? null,
      this.game.ctx.reduceFlashing,
    );
    const jump = pose.airborne ? this.jumpFrame(def) : null;
    const look = jump ?? def.portrait;
    const sheet = assets.sheet(look.sheet, look.palette);
    const f = sheet.frames.get(look.frame);
    const w = Math.round((f?.w ?? 16) * TROPHY_SCALE);
    const h = Math.round((f?.h ?? 16) * TROPHY_SCALE);
    // The pedestal stands on the ground line (its bottom a pixel under the marker's feet row).
    const top = m.feet + 1 - PEDESTAL_H;
    drawPedestal(r, ox + Math.round(m.cx - PEDESTAL_W / 2), top);
    const x = ox + Math.round(m.cx - w / 2);
    const y = top - h - pose.lift;
    const flip = m.side > 0;
    const dark = assets.sheet(look.sheet, fxPalette(look.palette, 'silhouette'));
    for (const [dx, dy] of TROPHY_OUTLINE)
      r.sprite(dark, look.frame, x + dx, y + dy, flip, false, 0, TROPHY_SCALE);
    r.sprite(sheet, look.frame, x, y, flip, false, 0, TROPHY_SCALE);
    if (pose.sparkle > 0) {
      // A little twinkle over the head, on the side away from the node.
      const sx = x + (w >> 1) + m.side * 4;
      const sy = y - 2;
      const n = pose.sparkle;
      r.rect(sx - n, sy, 2 * n + 1, 1, '#fce4a0');
      r.rect(sx, sy - n, 1, 2 * n + 1, '#fce4a0');
      r.rect(sx, sy, 1, 1, '#fcfcfc');
    }
  }

  /** `def`'s jump frame through its CharacterDef sprite (a stand-in in the air), cached. */
  private jumpFrame(def: CharacterDef): { sheet: string; palette: string; frame: string } | null {
    if (this.jumpFrames.has(def)) return this.jumpFrames.get(def) ?? null;
    let out: { sheet: string; palette: string; frame: string } | null = null;
    try {
      const states = def.damage.kind === 'powerup' ? def.damage.states : [];
      const power =
        def.damage.kind === 'powerup'
          ? states.includes('small')
            ? 'small'
            : (states[0] ?? 'small')
          : 'full';
      const pose = new Player(0, 0, def, power, startHp(def));
      pose.body.onGround = false;
      pose.body.vy = -0x02000;
      pose.anim = 'jump';
      pose.facing = 1;
      const spec = def.sprite(pose, 0, true);
      if (this.game.ctx.assets.sheet(spec.sheet, spec.palette).frames.has(spec.frame))
        out = { sheet: spec.sheet, palette: spec.palette, frame: spec.frame };
    } catch {
      out = null;
    }
    this.jumpFrames.set(def, out);
    return out;
  }

  private drawHeroes(r: Renderer, x = this.hx, y = this.hy): void {
    const s = this.game.state;
    // Player two a little behind and to the side.
    if (s.character2) this.drawHero(r, s.character2, x - 7, y - 2);
    this.drawHero(r, s.character, x, y);
  }

  private framesFor(c: CharacterDef): HeroFrames {
    let f = this.heroFrames.get(c);
    if (!f) {
      const idle = c.portrait.frame;
      const walk = [0, 1, 2].map((i) => idle.replace(/idle$/, `walk-${i}`)).filter((w) => w !== idle);
      f = { idle, walk };
      this.heroFrames.set(c, f);
    }
    return f;
  }

  private drawHero(r: Renderer, c: CharacterDef, x: number, y: number): void {
    const sheet = this.game.ctx.assets.sheet(c.portrait.sheet, c.portrait.palette);
    const frames = this.framesFor(c);
    let frame = frames.idle;
    if (this.mode === 'walk' && frames.walk.length) {
      const walk = frames.walk[(this.t >> 3) % frames.walk.length] as string;
      if (sheet.frames.has(walk)) frame = walk;
    }
    const f = sheet.frames.get(frame);
    const w = f?.w ?? 16;
    const h = f?.h ?? 16;
    // Feet on the node dot.
    r.sprite(sheet, frame, Math.round(x + 8 - w / 2), Math.round(y + 10 - h), this.facingLeft);
  }

  private drawHeader(r: Renderer): void {
    const font = this.game.ctx.assets.sheet('font');
    const s = this.game.state;
    const h = this.header;
    // A fade switches the header at its midpoint, when the screen is darkest.
    const f = this.fade;
    const page = f && f.t < MAP_FADE_FRAMES / 2 ? f.from : this.page;
    // Standing on a level or castle node (not walking, sliding or fading) names the level.
    const standing =
      !f && (this.mode === 'idle' || this.mode === 'reveal' || this.mode === 'story' || this.mode === 'gate')
        ? this.nodeById(this.node)
        : undefined;
    const node = standing && levelNode(standing) ? standing : null;
    // Rebuild the strings only when what they show changes.
    if (
      h.page !== page ||
      h.node !== node ||
      h.hero !== s.character ||
      h.lives !== s.lives ||
      h.score !== s.score ||
      h.coins !== s.coins
    ) {
      h.page = page;
      h.node = node;
      h.hero = s.character;
      h.lives = s.lives;
      h.score = s.score;
      h.coins = s.coins;
      h.title = page.title.toUpperCase().slice(0, 20);
      h.world = mapHeaderLabel(page, node);
      h.livesText = `${s.character.hudName.slice(0, 5)}×${pad(s.lives, 2)}`;
      h.scoreText = pad(s.score, 7);
      h.coinsText = `$×${pad(s.coins, 2)}`;
    }
    r.rect(0, 0, 256, MAP_HEADER_H, '#000');
    r.text(font, h.title, 8, 4);
    r.text(font, h.world, 248 - h.world.length * 8, 4);
    r.text(font, h.livesText, 8, 14);
    r.text(font, h.scoreText, 100, 14);
    r.text(font, h.coinsText, 216, 14);
  }
}
