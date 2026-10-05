import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Action } from '@engine/input/actions';
import type { Renderer } from '@engine/gfx/renderer';
import { MAP_PAGES, mapPage } from '@content/worldmap';
import { drawMapActor, drawMapTile, mapSky } from '@content/worldmap/render';
import type { MapNode, WorldMapPage } from '../map/types';
import {
  exitId,
  isCleared,
  isOpen,
  isWorldOpen,
  nextStep,
  openPaths,
  pathId,
  type Dir,
  type MapStep,
} from '../map/rules';
import type { CharacterDef } from '../characters/character';
import { pad } from '../hud/hud';
import { worldLabel } from '../hud/world-label';
import { MenuScene } from './menu';
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
  /** Node ids and path/exit ids (rules.pathId / exitId) to draw in one by one, then save. */
  reveal?: string[];
}

type Mode = 'reveal' | 'idle' | 'walk' | 'slide';

/** Optional hooks other parts of the game may provide (save files). */
interface SaveHooks {
  saveAndQuit?: () => void;
  autosave?: () => void;
}

const DIRS: Dir[] = ['left', 'right', 'up', 'down'];
const ANY: Action[] = ['left', 'right', 'up', 'down', 'jump', 'attack', 'special', 'start', 'select'];

/** Dot positions (px centres) along a tile path: every tile centre and half way between. */
function pathDots(points: [number, number][], skipFirst: boolean, skipLast: boolean): [number, number][] {
  const out: [number, number][] = [];
  points.forEach(([x, y], i) => {
    const first = i === 0;
    const last = i === points.length - 1;
    if (!(first && skipFirst) && !(last && skipLast)) out.push([x * 16 + 8, y * 16 + 8]);
    const n = points[i + 1];
    if (n) out.push([(x + n[0]) * 8 + 8, (y + n[1]) * 8 + 8]);
  });
  return out;
}

/**
 * The Super Mario World-style map of one world: the page's scenery, the open paths and nodes,
 * the hero walking between nodes with the d-pad, entering levels, sliding to the next page along
 * an open world exit, and the dot-by-dot reveal of what a clear just opened.
 */
export class WorldMapScene implements Scene {
  page: WorldMapPage;
  mode: Mode = 'idle';
  /** Node the hero stands on (or last left). */
  node: string;
  /** Hero position (px, top-left of the 16×16 tile it stands on). */
  hx = 0;
  hy = 0;
  private facingLeft = false;
  private t = 0;
  private walkPts: [number, number][] = [];
  private walkStep: MapStep | null = null;
  private slide: { from: WorldMapPage; dir: -1 | 1; t: number; node: string } | null = null;
  /** Reveal state: ids still to show (in order) and how far the current one is drawn. */
  private revealQueue: string[] = [];
  private revealShown = new Map<string, number>();
  private revealT = 0;

  constructor(
    private readonly game: Game,
    world: number,
    private readonly opts: WorldMapOptions = {},
  ) {
    this.page = mapPage(world) ?? (MAP_PAGES[0] as WorldMapPage);
    const pos = game.mapProgress.position;
    const here = pos.world === this.page.world && this.page.nodes.find((n) => n.id === pos.node);
    this.node = here ? here.id : this.startNode(this.page).id;
    this.placeHero();
  }

  private get progress() {
    return this.game.mapProgress;
  }

  enter(): void {
    this.game.ctx.audio.playMusic(this.page.music);
    this.announcePage();
    const ids = new Set(this.pageIds(this.page));
    this.revealQueue = (this.opts.reveal ?? []).filter((id) => ids.has(id));
    if (this.revealQueue.length) {
      this.mode = 'reveal';
      for (const id of this.revealQueue) this.revealShown.set(id, 0);
    }
  }

  private startNode(page: WorldMapPage): MapNode {
    return page.nodes.find((n) => n.kind === 'start') ?? (page.nodes[0] as MapNode);
  }

  private nodeById(id: string): MapNode | undefined {
    return this.page.nodes.find((n) => n.id === id);
  }

  private placeHero(): void {
    const n = this.nodeById(this.node) ?? this.startNode(this.page);
    this.hx = n.x * 16;
    this.hy = n.y * 16;
  }

  /** Every id a reveal may name on a page. */
  private pageIds(page: WorldMapPage): string[] {
    return [...page.nodes.map((n) => n.id), ...page.paths.map(pathId), ...page.exits.map(exitId)];
  }

  /** Dots a path or exit is drawn with. */
  private dotsFor(id: string): [number, number][] {
    const p = this.page.paths.find((x) => pathId(x) === id);
    if (p) return pathDots(p.points, true, true);
    const e = this.page.exits.find((x) => exitId(x) === id);
    return e ? pathDots(e.points, true, false) : [];
  }

  private say(text: string): void {
    this.game.deps.announcer?.say(text);
  }

  private announcePage(): void {
    this.say(`World ${this.page.world}, ${this.page.title}`);
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
      this.revealQueue = [];
      this.finishReveal();
      return;
    }
    const id = this.revealQueue[0];
    if (id === undefined) {
      this.finishReveal();
      return;
    }
    this.revealT++;
    const isNode = !!this.nodeById(id);
    if (isNode) {
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
      if (shown >= this.dotsFor(id).length) {
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
    this.revealShown.clear();
    this.mode = 'idle';
    (this.game as Game & SaveHooks).autosave?.();
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
      const step = nextStep(this.page, this.progress, this.node, d);
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
      node: step.kind === 'back' ? step.node : this.startNode(next).id,
    };
    this.page = next;
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
    this.node = this.nodeById(s.node) ? s.node : this.startNode(this.page).id;
    this.placeHero();
    this.progress.position = { world: this.page.world, node: this.node };
    if (this.page.music !== s.from.music) this.game.ctx.audio.playMusic(this.page.music);
    this.mode = 'idle';
    this.announcePage();
    const n = this.nodeById(this.node);
    if (n) this.say(this.nodeLabel(n));
  }

  private arrive(nodeId: string): void {
    this.node = nodeId;
    this.mode = 'idle';
    this.placeHero();
    this.progress.position = { world: this.page.world, node: nodeId };
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
          {
            label: 'Save and quit',
            select: () => {
              const g = game as Game & SaveHooks;
              if (g.saveAndQuit) g.saveAndQuit();
              else game.showTitle();
            },
          },
          { label: 'Options', select: () => game.scenes.push(new OptionsScene(game, pop, true)) },
        ],
        pop,
        true,
      ),
    );
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
    page.tiles.forEach((row, y) => {
      for (let x = 0; x < 16; x++) drawMapTile(r, assets, page, row[x] ?? '.', ox + x * 16, y * 16, this.t);
    });
    for (const a of page.actors) drawMapActor(r, assets, page, ox ? { ...a, x: a.x + ox } : a, this.t);
    const items = assets.sheet('items');
    const current = page === this.page;
    const { paths, exits } = openPaths(this.progress, page);
    const drawDots = (id: string, dots: [number, number][]) => {
      const shown = current ? this.revealShown.get(id) : undefined;
      const n = shown === undefined ? dots.length : shown;
      for (let i = 0; i < n; i++) {
        const d = dots[i] as [number, number];
        r.sprite(items, 'map-path-dot', ox + d[0] - 4, d[1] - 4);
      }
    };
    for (const p of paths) drawDots(pathId(p), pathDots(p.points, true, true));
    for (const e of exits) drawDots(exitId(e), pathDots(e.points, true, false));
    for (const n of page.nodes) {
      if (!isOpen(this.progress, page, n.id)) continue;
      if (current && this.revealShown.has(n.id)) continue;
      r.sprite(items, this.nodeFrame(page, n), ox + n.x * 16, n.y * 16);
    }
    if (hero) this.drawHeroes(r);
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

  private drawHero(r: Renderer, c: CharacterDef, x: number, y: number): void {
    const sheet = this.game.ctx.assets.sheet(c.portrait.sheet, c.portrait.palette);
    let frame = c.portrait.frame;
    if (this.mode === 'walk') {
      const walk = c.portrait.frame.replace(/idle$/, `walk-${(this.t >> 3) % 3}`);
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
    r.rect(0, 0, 256, MAP_HEADER_H, '#000');
    r.text(font, this.page.title.toUpperCase().slice(0, 20), 8, 4);
    const w = `WORLD ${worldLabel(this.page.world)}`;
    r.text(font, w, 248 - w.length * 8, 4);
    r.text(font, `${s.character.hudName.slice(0, 5)}×${pad(s.lives, 2)}`, 8, 14);
    r.text(font, pad(s.score, 7), 100, 14);
    r.text(font, `$×${pad(s.coins, 2)}`, 216, 14);
  }
}
