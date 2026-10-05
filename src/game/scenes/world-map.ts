import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Action } from '@engine/input/actions';
import type { Renderer } from '@engine/gfx/renderer';
import { MAP_PAGES, mapPage } from '@content/worldmap';
import { drawMapActor, drawMapTile, mapSky } from '@content/worldmap/render';
import type { MapActor, MapNode, WorldMapPage } from '../map/types';
import {
  exitId,
  isCleared,
  isOpen,
  isWorldOpen,
  nextStep,
  openPaths,
  parseRevealId,
  pathId,
  type Dir,
  type MapStep,
} from '../map/rules';
import type { CharacterDef } from '../characters/character';
import { pad } from '../hud/hud';
import { worldLabel } from '../hud/world-label';
import { MenuScene, type MenuItem } from './menu';
import { OptionsScene } from './options';
import type { Game } from './game';

/** Hero walking speed on the map (px per frame). */
export const MAP_WALK_SPEED = 2;
/** Length of the slide between two pages. */
export const MAP_SLIDE_FRAMES = 30;
/** Frames between two dots of a path being revealed, and before a revealed node pops in. */
export const REVEAL_DOT_FRAMES = 6;
export const REVEAL_NODE_FRAMES = 16;
/** Height of the header bar across the top of the map (keep nodes below it). */
export const MAP_HEADER_H = 24;

export interface WorldMapOptions {
  /**
   * World-qualified ids (rules.revealId: '1:1-2', '1:1-1>1-2', '2:start') to draw in one by
   * one, then save; each page reveals only its own.
   */
  reveal?: string[];
}

type Mode = 'reveal' | 'idle' | 'walk' | 'slide';

/** A path or world exit as drawn: its id and the dot centres, flat [x0, y0, x1, y1, ...]. */
interface DotRun {
  id: string;
  dots: number[];
}

/** What is drawn of a page for the current progress (rebuilt only when progress may change). */
interface PageView {
  runs: DotRun[];
  nodes: { node: MapNode; frame: string }[];
}

/** The hero's frames on the map: standing, and walking when the sheet has them. */
interface HeroFrames {
  idle: string;
  walk: string[];
}

const DIRS: Dir[] = ['left', 'right', 'up', 'down'];
const ANY: Action[] = ['left', 'right', 'up', 'down', 'jump', 'attack', 'special', 'start', 'select'];

/** Stands in when no page exists (no content yet): nothing to draw or walk to. */
const EMPTY_PAGE: WorldMapPage = {
  world: 1,
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
  /** Reveal state: local ids still to show (in order) and how many dots of each are drawn. */
  private revealQueue: string[] = [];
  private readonly revealShown = new Map<string, number>();
  private revealNodes: string[] = [];
  private revealT = 0;
  /** Render caches. */
  private readonly views = new Map<WorldMapPage, PageView>();
  private readonly heroFrames = new Map<CharacterDef, HeroFrames>();
  private readonly scratchActor: MapActor = { type: '', x: 0, y: 0 };
  private readonly header = {
    page: null as WorldMapPage | null,
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
    world: number,
    private readonly opts: WorldMapOptions = {},
  ) {
    const prog = game.mapProgress;
    const w = isWorldOpen(prog, world) && mapPage(world) ? world : prog.position.world;
    this.page = mapPage(w) ?? mapPage(1) ?? MAP_PAGES[0] ?? EMPTY_PAGE;
    const pos = prog.position;
    const here = pos.world === this.page.world ? this.nodeById(pos.node) : undefined;
    this.node = here?.id ?? startNode(this.page)?.id ?? '';
    this.placeHero();
  }

  private get progress() {
    return this.game.mapProgress;
  }

  enter(): void {
    this.game.ctx.audio.playMusic(this.page.music);
    this.views.clear();
    this.announceHere();
    const ids = new Set(this.pageIds(this.page));
    for (const rid of this.opts.reveal ?? []) {
      const r = parseRevealId(rid);
      if (r && r.world === this.page.world && ids.has(r.id) && !this.revealShown.has(r.id)) {
        this.revealQueue.push(r.id);
        this.revealShown.set(r.id, 0);
        if (this.nodeById(r.id)) this.revealNodes.push(r.id);
      }
    }
    if (this.revealQueue.length) this.mode = 'reveal';
    else this.game.autosave();
  }

  private nodeById(id: string): MapNode | undefined {
    return this.page.nodes.find((n) => n.id === id);
  }

  /** Puts the hero on its node and records that as the file's map position. */
  private placeHero(): void {
    const n = this.nodeById(this.node);
    this.hx = n ? n.x * 16 : 0;
    this.hy = n ? n.y * 16 : 0;
    this.progress.position = { world: this.page.world, node: this.node };
    if (this.node) this.game.mapLastNode[this.page.world] = this.node;
  }

  /** Every id a reveal may name on a page. */
  private pageIds(page: WorldMapPage): string[] {
    return [...page.nodes.map((n) => n.id), ...page.paths.map(pathId), ...page.exits.map(exitId)];
  }

  private view(page: WorldMapPage): PageView {
    let v = this.views.get(page);
    if (v) return v;
    const { paths, exits } = openPaths(this.progress, page);
    v = {
      runs: [
        ...paths.map((p) => ({ id: pathId(p), dots: pathDots(p.points, true, true) })),
        ...exits.map((e) => ({ id: exitId(e), dots: pathDots(e.points, true, false) })),
      ],
      nodes: page.nodes
        .filter((n) => isOpen(this.progress, page, n.id))
        .map((n) => ({ node: n, frame: this.nodeFrame(page, n) })),
    };
    this.views.set(page, v);
    return v;
  }

  private say(text: string): void {
    this.game.deps.announcer?.say(text);
  }

  /** The page's name and the node the hero stands on. */
  private announceHere(): void {
    const n = this.nodeById(this.node);
    const page = `World ${this.page.world}, ${this.page.title}`;
    this.say(n ? `${page}. ${this.nodeLabel(n)}` : page);
  }

  /** "World 1-2, cleared" / "World 1-3, open" / "World 1-4 castle, open". */
  nodeLabel(n: MapNode): string {
    const state = isCleared(this.progress, this.page, n.id) ? 'cleared' : 'open';
    if (n.kind === 'start') return `World ${this.page.world} start`;
    if (n.kind === 'bonus') return `Bonus level, ${state}`;
    const lvl = n.level ? `World ${n.level}` : `World ${this.page.world}`;
    return n.kind === 'castle' ? `${lvl} castle, ${state}` : `${lvl}, ${state}`;
  }

  update(input: InputFrame): void {
    this.t++;
    switch (this.mode) {
      case 'reveal':
        this.updateReveal(input);
        return;
      case 'walk':
        this.updateWalk();
        return;
      case 'slide':
        this.updateSlide();
        return;
      case 'idle':
        this.updateIdle(input);
    }
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
    const opened = this.revealNodes
      .map((id) => this.nodeById(id))
      .filter((n): n is MapNode => !!n)
      .map((n) => this.nodeLabel(n));
    if (opened.length) this.say(opened.join('. '));
    this.game.autosave();
  }

  /** True while a reveal is still drawing in. */
  get revealing(): boolean {
    return this.mode === 'reveal';
  }

  private updateIdle(input: InputFrame): void {
    if (this.t < 6) return;
    const here = this.nodeById(this.node);
    if (input.pressed('select')) {
      this.openPause();
      return;
    }
    const enter = input.pressed('jump') || input.pressed('start');
    if (enter && here?.level && isOpen(this.progress, this.page, here.id)) {
      this.game.ctx.audio.sfx('coin');
      this.game.enterLevelFromMap(here.level);
      return;
    }
    if (input.pressed('start')) {
      this.openPause();
      return;
    }
    for (const d of DIRS) {
      if (!input.pressed(d)) continue;
      const step = here ? nextStep(this.page, this.progress, this.node, d) : null;
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
    const toWorld = step.kind === 'exit' ? step.exit.toWorld : step.world;
    const next = mapPage(toWorld);
    if (!next || !isWorldOpen(this.progress, toWorld)) {
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
    this.mode = 'slide';
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
    if (this.page.music !== s.from.music) this.game.ctx.audio.playMusic(this.page.music);
    this.mode = 'idle';
    this.announceHere();
  }

  private arrive(nodeId: string): void {
    this.node = nodeId;
    this.mode = 'idle';
    this.placeHero();
    this.views.clear();
    const n = this.nodeById(nodeId);
    if (n) this.say(this.nodeLabel(n));
  }

  private openPause(): void {
    const game = this.game;
    game.ctx.audio.sfx('pause');
    const pop = () => game.scenes.pop();
    game.scenes.push(
      new MenuScene(
        game,
        'MAP',
        [
          { label: 'Continue', select: pop },
          { label: 'Worlds', select: () => this.openWorlds() },
          { label: 'Save and quit', select: () => game.saveAndQuit() },
          { label: 'Options', select: () => game.scenes.push(new OptionsScene(game, pop, true)) },
        ],
        pop,
        true,
      ),
    );
  }

  /** Map menu "Worlds": every open world with a page; the current one is marked HERE. */
  private openWorlds(): void {
    const game = this.game;
    const here = this.page.world;
    const worlds = MAP_PAGES.map((p) => p.world)
      .filter((w) => isWorldOpen(this.progress, w))
      .sort((a, b) => a - b);
    const items = worlds.map((w): MenuItem => ({
      label: `World ${w}`,
      ...(w === here ? { value: () => 'here', hint: 'You are here' } : {}),
      select: () => {
        if (w !== here) return game.travelToWorld(w);
        game.scenes.pop(); // the current world: just close both menus
        game.scenes.pop();
      },
    }));
    game.scenes.push(new MenuScene(game, 'WORLDS', items, () => game.scenes.pop(), true));
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
    } else {
      r.clear(mapSky(this.page));
      this.drawPage(r, this.page, 0, true);
    }
    this.drawHeader(r);
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
    for (let i = 0; i < v.nodes.length; i++) {
      const nv = v.nodes[i] as PageView['nodes'][number];
      if (revealing && this.revealShown.has(nv.node.id)) continue;
      r.sprite(items, nv.frame, ox + nv.node.x * 16, nv.node.y * 16);
    }
    if (hero && page.nodes.length) this.drawHeroes(r);
  }

  private nodeFrame(page: WorldMapPage, n: MapNode): string {
    const cleared = isCleared(this.progress, page, n.id);
    switch (n.kind) {
      case 'start':
        return 'map-node-start';
      case 'bonus':
        return cleared ? 'map-node-cleared' : 'map-node-bonus';
      case 'castle':
        return cleared ? 'map-castle-cleared' : 'map-castle';
      default:
        return cleared ? 'map-node-cleared' : 'map-node-open';
    }
  }

  private drawHeroes(r: Renderer): void {
    const s = this.game.state;
    // Player two a little behind and to the side.
    if (s.character2) this.drawHero(r, s.character2, this.hx - 7, this.hy - 2);
    this.drawHero(r, s.character, this.hx, this.hy);
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
    // Rebuild the strings only when what they show changes.
    if (
      h.page !== this.page ||
      h.hero !== s.character ||
      h.lives !== s.lives ||
      h.score !== s.score ||
      h.coins !== s.coins
    ) {
      h.page = this.page;
      h.hero = s.character;
      h.lives = s.lives;
      h.score = s.score;
      h.coins = s.coins;
      h.title = this.page.title.toUpperCase().slice(0, 20);
      h.world = `WORLD ${worldLabel(this.page.world)}`;
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
