import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import { SCREEN_W } from '@engine/viewport';
import { encodeShare } from '@engine/share';
import type { LevelData, Theme, Zone } from '../level/schema';
import { THEMES } from '../level/schema';
import { parseTextMap, serializeTextMap } from '../level/textmap';
import { DEFAULT_LEGEND, T, TILES, tileDef } from '../level/tiles';
import { TileMap } from '../world/tilemap';
import { renderTiles, SKY } from '../world/tile-render';
import { customLevelId, loadLibrary, saveLibrary } from '../level/library';
import { enemyPalette } from '../entities/enemies/enemy';
import { decorPalette } from '../entities/objects/decoration';
import type { View } from '../entities/entity';
import type { Game } from './game';
import type { TouchLabels } from '@engine/input/touch';
import { NO_TOUCH_BUTTONS } from '../touch-labels';

type Brush =
  | { kind: 'tile'; id: number; label: string }
  | { kind: 'entity'; type: string; label: string; props?: Record<string, number> }
  | { kind: 'decor'; name: string; label: string }
  | { kind: 'erase'; label: string }
  | { kind: 'start'; label: string };

const MUSIC = ['overworld', 'underground', 'castle', 'water', 'star', 'title'];
const ENTITY_FRAMES: Record<
  string,
  { sheet: string; frame: string; palette?: (theme: Theme) => string; flipY?: boolean }
> = {
  goomba: { sheet: 'enemies', frame: 'goomba-0', palette: enemyPalette },
  'koopa-green': { sheet: 'enemies', frame: 'koopa-0', palette: () => 'koopa-green' },
  'koopa-red': { sheet: 'enemies', frame: 'koopa-0', palette: () => 'koopa-red' },
  'koopa-para-green': { sheet: 'enemies', frame: 'koopa-fly-0', palette: () => 'koopa-green' },
  'koopa-para-red': { sheet: 'enemies', frame: 'koopa-fly-0', palette: () => 'koopa-red' },
  'koopa-para-green-h': { sheet: 'enemies', frame: 'koopa-fly-0', palette: () => 'koopa-green' },
  piranha: { sheet: 'enemies', frame: 'piranha-0', palette: () => 'piranha-green' },
  'piranha-down': { sheet: 'enemies', frame: 'piranha-0', palette: () => 'piranha-green', flipY: true },
  // Red plants are `piranha`/`piranha-down` with `red=1` (see redPiranhaKey).
  'piranha-red': { sheet: 'enemies', frame: 'piranha-0', palette: () => 'piranha-red' },
  'piranha-down-red': { sheet: 'enemies', frame: 'piranha-0', palette: () => 'piranha-red', flipY: true },
  'cheep-red': { sheet: 'enemies', frame: 'cheep-0', palette: enemyPalette },
  'cheep-grey': { sheet: 'enemies', frame: 'cheep-0', palette: () => 'cheep-grey' },
  blooper: { sheet: 'enemies', frame: 'blooper-0', palette: enemyPalette },
  podoboo: { sheet: 'enemies', frame: 'podoboo-0', palette: enemyPalette },
  spring: { sheet: 'items', frame: 'spring-0' },
  'spring-green': { sheet: 'items', frame: 'spring-green-0' },
  'hammer-bro': { sheet: 'enemies', frame: 'hammer-bro-1', palette: enemyPalette },
  'hammer-bro-chase': { sheet: 'enemies', frame: 'hammer-bro-1', palette: enemyPalette },
  buzzy: { sheet: 'enemies', frame: 'buzzy-0', palette: enemyPalette },
  spiny: { sheet: 'enemies', frame: 'spiny-0', palette: enemyPalette },
  lakitu: { sheet: 'enemies', frame: 'lakitu-0', palette: enemyPalette },
  'bullet-bill': { sheet: 'enemies', frame: 'bullet', palette: enemyPalette },
  princess: { sheet: 'items', frame: 'princess' },
  toad: { sheet: 'items', frame: 'toad' },
  'lift-right': { sheet: 'items', frame: 'platform' },
  balance: { sheet: 'items', frame: 'pulley' },
  vine: { sheet: 'items', frame: 'vine-top' },
  bowser: { sheet: 'enemies', frame: 'bowser-0', palette: enemyPalette },
  firebar: { sheet: 'items', frame: 'firebar' },
  'firebar-ccw': { sheet: 'items', frame: 'firebar' },
  axe: { sheet: 'items', frame: 'axe-0' },
  'lift-h': { sheet: 'items', frame: 'platform' },
  'lift-v': { sheet: 'items', frame: 'platform' },
  'lift-fall': { sheet: 'items', frame: 'platform' },
  'lift-up': { sheet: 'items', frame: 'platform' },
  'lift-down': { sheet: 'items', frame: 'platform' },
  mushroom: { sheet: 'items', frame: 'mushroom' },
  flower: { sheet: 'items', frame: 'flower-0' },
  star: { sheet: 'items', frame: 'star-0' },
  '1up': { sheet: 'items', frame: '1up' },
  'decor-castle': { sheet: 'decor', frame: 'castle-small' },
};

/** A red piranha plant is a `piranha`/`piranha-down` with `red=1`: its brush and frame key. */
function redPiranhaKey(e: { type: string; props?: Record<string, unknown> }): string | undefined {
  return (e.type === 'piranha' || e.type === 'piranha-down') && e.props?.red ? `${e.type}-red` : undefined;
}

function blankLevel(name: string): LevelData {
  const rows = Array.from({ length: 13 }, () => '.'.repeat(64));
  const src = [
    `id: ${customLevelId(name)}`,
    `name: ${name.toUpperCase()}`,
    'theme: overworld',
    'time: 400',
    'start: 2,12',
    '',
    '[tiles]',
    ...rows,
    '#'.repeat(64),
    '#'.repeat(64),
    '',
    '[zones]',
    'exit 60 next=end',
  ].join('\n');
  return parseTextMap(src);
}

/**
 * In-browser level editor: paint tiles, place enemies, items, decor and zones on the canvas,
 * with a DOM side panel for level settings, saving, play-testing, export and share links.
 */
export class EditorScene implements Scene {
  level: LevelData;
  map: TileMap;
  name: string;
  private camX = 0;
  private cursor = { tx: 2, ty: 12 };
  private brush: Brush = { kind: 'tile', id: T.GROUND, label: 'ground' };
  private painting: 'paint' | 'erase' | null = null;
  private panel: HTMLElement | null = null;
  private status = 'Click to paint. Right-click erases. Shift-click picks.';
  private frame = 0;
  private pipeTarget = {
    level: '1-1-bonus',
    x: 1,
    y: 1,
    dir: 'down' as Zone extends { kind: 'pipe' } ? never : 'down' | 'right',
  };
  private readonly listeners: Array<() => void> = [];

  constructor(
    private readonly game: Game,
    initial?: { level: LevelData; name: string },
  ) {
    this.name = initial?.name ?? 'My Level';
    this.level = initial?.level ?? blankLevel(this.name);
    this.map = new TileMap(this.level);
    this.level.tiles = this.map.tiles; // edit in place
  }

  enter(): void {
    this.game.ctx.audio.stopMusic();
    this.buildPanel();
    this.bindCanvas();
    this.game.deps.announcer?.say(
      'Level editor. Paint with the mouse; use the side panel to save, test and share.',
    );
  }

  exit(): void {
    this.panel?.remove();
    this.panel = null;
    for (const off of this.listeners) off();
    this.listeners.length = 0;
  }

  /* ---------- Editing ---------- */

  private apply(tx: number, ty: number, mode: 'paint' | 'erase'): void {
    if (tx < 0 || tx >= this.level.width || ty < 0 || ty >= this.level.height) return;
    const b = this.brush;
    if (mode === 'erase' || b.kind === 'erase') {
      this.map.set(tx, ty, T.AIR);
      this.level.entities = this.level.entities.filter((e) => !(e.x === tx && e.y === ty));
      this.level.decor = this.level.decor.filter((d) => !(d.x === tx && d.y === ty));
      return;
    }
    switch (b.kind) {
      case 'tile':
        this.map.set(tx, ty, b.id);
        break;
      case 'entity':
        {
          const same = this.level.entities.find((e) => e.x === tx && e.y === ty && e.type === b.type);
          if (same && redPiranhaKey(same) === redPiranhaKey(b)) return;
          // Painting a red plant over a green one (or back) swaps its colour.
          if (same) this.level.entities = this.level.entities.filter((e) => e !== same);
        }
        this.level.entities.push(
          b.props ? { type: b.type, x: tx, y: ty, props: { ...b.props } } : { type: b.type, x: tx, y: ty },
        );
        this.map.set(tx, ty, T.AIR);
        break;
      case 'decor':
        if (this.level.decor.some((d) => d.x === tx && d.y === ty)) return;
        this.level.decor.push({ kind: b.name, x: tx, y: ty });
        break;
      case 'start':
        this.level.start = { x: tx, y: ty };
        break;
    }
  }

  private pick(tx: number, ty: number): void {
    const e = this.level.entities.find((en) => en.x === tx && en.y === ty);
    if (e) {
      const red = redPiranhaKey(e);
      this.brush = red
        ? { kind: 'entity', type: e.type, label: red, props: { red: 1 } }
        : { kind: 'entity', type: e.type, label: e.type };
    } else {
      const id = this.map.get(tx, ty);
      this.brush =
        id === T.AIR ? { kind: 'erase', label: 'eraser' } : { kind: 'tile', id, label: tileDef(id).name };
    }
    this.status = `Brush: ${this.brush.label}`;
    this.syncBrushButtons();
  }

  private resize(width: number): void {
    const w = Math.max(16, Math.min(1024, Math.floor(width)));
    const tiles = new Uint16Array(w * this.level.height);
    for (let y = 0; y < this.level.height; y++) {
      for (let x = 0; x < Math.min(w, this.level.width); x++) tiles[y * w + x] = this.map.get(x, y);
    }
    this.level.width = w;
    this.level.tiles = tiles;
    this.level.entities = this.level.entities.filter((e) => e.x < w);
    this.level.decor = this.level.decor.filter((d) => d.x < w);
    this.map = new TileMap(this.level);
    this.level.tiles = this.map.tiles;
    this.camX = Math.min(this.camX, Math.max(0, w * 16 - SCREEN_W));
  }

  private addZone(z: Zone): void {
    this.level.zones.push(z);
    this.refreshZoneList();
  }

  /* ---------- Save / load / share ---------- */

  toText(): string {
    this.level.id = customLevelId(this.name);
    this.level.name = this.name.toUpperCase().slice(0, 20);
    return serializeTextMap(this.level);
  }

  private save(): void {
    const lib = loadLibrary();
    lib.levels[this.name] = this.toText();
    this.status = saveLibrary(lib) ? `Saved "${this.name}"` : 'Save failed (storage full or blocked)';
    this.refreshLoadList();
  }

  private load(name: string): void {
    const lib = loadLibrary();
    const text = lib.levels[name];
    if (!text) return;
    try {
      this.level = parseTextMap(text, customLevelId(name));
      this.map = new TileMap(this.level);
      this.level.tiles = this.map.tiles;
      this.name = name;
      this.camX = 0;
      this.status = `Loaded "${name}"`;
      this.buildPanel();
    } catch (e) {
      this.status = `Load failed: ${(e as Error).message.slice(0, 40)}`;
    }
  }

  private remove(name: string): void {
    const lib = loadLibrary();
    delete lib.levels[name];
    saveLibrary(lib);
    this.status = `Deleted "${name}"`;
    this.refreshLoadList();
  }

  private exportMap(): void {
    const blob = new Blob([this.toText()], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${customLevelId(this.name)}.map`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  private importMap(file: File): void {
    void file.text().then((text) => {
      try {
        const lvl = parseTextMap(text, customLevelId(file.name.replace(/\.map$/, '')));
        this.level = lvl;
        this.map = new TileMap(lvl);
        this.level.tiles = this.map.tiles;
        this.name = file.name.replace(/\.map$/, '');
        this.camX = 0;
        this.status = `Imported ${file.name}`;
        this.buildPanel();
      } catch (e) {
        this.status = `Import failed: ${(e as Error).message.slice(0, 40)}`;
      }
    });
  }

  private async share(): Promise<void> {
    const code = await encodeShare(this.toText());
    const url = `${location.origin}${location.pathname}#level=${code}`;
    try {
      await navigator.clipboard.writeText(url);
      this.status = `Link copied (${url.length} chars)`;
    } catch {
      this.status = 'Copy failed; link shown below';
    }
    const out = this.panel?.querySelector<HTMLInputElement>('[data-share]');
    if (out) out.value = url;
  }

  private playtest(): void {
    try {
      // Re-parse so the test uses exactly what would be saved/shared.
      const lvl = parseTextMap(this.toText(), customLevelId(this.name));
      this.game.playtest(lvl, () => this.game.openEditor({ level: this.level, name: this.name }));
    } catch (e) {
      this.status = `Cannot play: ${(e as Error).message.slice(0, 40)}`;
    }
  }

  /* ---------- Input ---------- */

  /** The d-pad scrolls; holding B scrolls faster. Everything else is in the side panel. */
  touchLabels(): TouchLabels {
    return { ...NO_TOUCH_BUTTONS, attack: 'FAST' };
  }

  update(input: InputFrame): void {
    this.frame++;
    const keys = this.game.deps.debugKeys;
    const fast = keys?.has('ShiftLeft') || keys?.has('ShiftRight') || input.held('attack');
    const step = fast ? 16 : 4;
    if (input.held('left')) this.camX -= step;
    if (input.held('right')) this.camX += step;
    this.camX = Math.max(0, Math.min(Math.max(0, this.level.width * 16 - SCREEN_W), this.camX));
  }

  private bindCanvas(): void {
    const canvas = this.game.deps.canvas;
    const viewport = this.game.deps.viewport;
    if (!canvas || !viewport) return;
    const toTile = (e: PointerEvent) => {
      const s = viewport.toScreen(e.clientX, e.clientY);
      return {
        tx: Math.floor((this.camX + s.x) / 16),
        ty: Math.floor(s.y / 16),
        onCanvas: s.x >= 0 && s.x < SCREEN_W && s.y >= 0 && s.y < 240,
      };
    };
    const down = (e: PointerEvent) => {
      const t = toTile(e);
      if (!t.onCanvas) return;
      e.preventDefault();
      if (e.shiftKey) return this.pick(t.tx, t.ty);
      this.painting = e.button === 2 ? 'erase' : 'paint';
      this.cursor = t;
      this.apply(t.tx, t.ty, this.painting);
    };
    const move = (e: PointerEvent) => {
      const t = toTile(e);
      if (t.onCanvas) this.cursor = t;
      if (this.painting && t.onCanvas) this.apply(t.tx, t.ty, this.painting);
    };
    const up = () => (this.painting = null);
    const ctx = (e: Event) => e.preventDefault();
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    canvas.addEventListener('contextmenu', ctx);
    this.listeners.push(() => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      canvas.removeEventListener('contextmenu', ctx);
    });
  }

  /* ---------- Panel ---------- */

  private buildPanel(): void {
    const overlay = this.game.deps.overlay;
    if (!overlay) return;
    this.panel?.remove();
    const el = document.createElement('div');
    el.className = 'editor-panel';
    el.innerHTML = `
      <style>
        .editor-panel { position: fixed; top: 0; right: 0; bottom: 0; width: 240px; overflow-y: auto; background: rgba(0,0,0,0.88); color: #eee; font: 12px/1.4 system-ui, sans-serif; padding: 8px; box-sizing: border-box; }
        .editor-panel h2 { font-size: 14px; margin: 4px 0; }
        .editor-panel h3 { font-size: 12px; margin: 10px 0 4px; color: #9cf; text-transform: uppercase; }
        .editor-panel input, .editor-panel select, .editor-panel button { font: inherit; margin: 1px; }
        .editor-panel input[type=number] { width: 52px; }
        .editor-panel input[type=text] { width: 120px; }
        .editor-panel button { background: #333; color: #fff; border: 1px solid #666; border-radius: 3px; padding: 2px 6px; cursor: pointer; }
        .editor-panel button.on { background: #fc0; color: #000; }
        .editor-panel .row { display: flex; flex-wrap: wrap; gap: 2px; align-items: center; }
        .editor-panel .zones li { display: flex; justify-content: space-between; gap: 4px; }
        .editor-panel ul { margin: 0; padding-left: 12px; }
        .editor-panel .help { color: #aaa; font-size: 11px; }
        @media (max-width: 700px) { .editor-panel { width: 50vw; } }
      </style>
      <h2>Level editor</h2>
      <div class="row">Name <input type="text" data-name value="${escapeHtml(this.name)}"></div>
      <div class="row">Width <input type="number" data-width min="16" max="1024" value="${this.level.width}"> <button data-apply-width>Apply</button></div>
      <div class="row">Theme <select data-theme>${THEMES.map((t) => `<option ${t === this.level.theme ? 'selected' : ''}>${t}</option>`).join('')}</select>
        Music <select data-music>${MUSIC.map((m) => `<option ${m === this.level.music ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="row">Time <input type="number" data-time min="0" max="999" value="${this.level.time ?? 0}"> Camera <select data-camera><option ${this.level.camera === 'scroll' ? 'selected' : ''}>scroll</option><option ${this.level.camera === 'locked' ? 'selected' : ''}>locked</option></select></div>
      <h3>Tiles</h3><div class="row" data-tiles></div>
      <h3>Enemies & items</h3><div class="row" data-entities></div>
      <h3>Scenery</h3><div class="row" data-decor></div>
      <h3>Zones</h3>
      <div class="row"><button data-zone="exit">Exit at cursor</button><button data-zone="checkpoint">Checkpoint</button><button data-zone="scrollStop">Scroll stop</button><button data-zone="bowser-fire">Bowser fire</button></div>
      <div class="row">Pipe to <input type="text" data-pipe-level value="${this.pipeTarget.level}" style="width:80px"> x <input type="number" data-pipe-x value="${this.pipeTarget.x}"> y <input type="number" data-pipe-y value="${this.pipeTarget.y}">
        <select data-pipe-dir><option>down</option><option>right</option></select> <button data-zone="pipe">Add pipe at cursor</button></div>
      <ul class="zones" data-zones></ul>
      <h3>Level</h3>
      <div class="row"><button data-act="new">New</button><button data-act="save">Save</button><button data-act="test">Play test</button></div>
      <div class="row"><select data-load></select><button data-act="load">Load</button><button data-act="delete">Delete</button></div>
      <div class="row"><button data-act="export">Export .map</button><label><button type="button" data-act="import">Import .map</button><input type="file" accept=".map,.txt" data-import hidden></label></div>
      <div class="row"><button data-act="share">Copy share link</button></div>
      <input type="text" data-share readonly placeholder="share link appears here" style="width:100%">
      <div class="row"><button data-act="back">Back to title</button></div>
      <p class="help">Left-click/drag paints, right-click erases, shift-click picks a brush. Arrow keys scroll (hold X for fast).</p>`;
    overlay.appendChild(el);
    this.panel = el;

    const tiles = el.querySelector('[data-tiles]') as HTMLElement;
    for (const [ch, v] of Object.entries(DEFAULT_LEGEND)) {
      if (typeof v !== 'number' || v === T.AIR) continue;
      const def = tileDef(v);
      tiles.appendChild(this.brushButton({ kind: 'tile', id: v, label: def.name }, `${ch} ${def.name}`));
    }
    for (const def of TILES) {
      if (!Object.values(DEFAULT_LEGEND).includes(def.id) && def.id !== T.AIR && def.id !== T.BUMPING) {
        tiles.appendChild(this.brushButton({ kind: 'tile', id: def.id, label: def.name }, def.name));
      }
    }
    tiles.appendChild(this.brushButton({ kind: 'erase', label: 'eraser' }, 'eraser'));
    tiles.appendChild(this.brushButton({ kind: 'start', label: 'start' }, 'player start'));
    const ents = el.querySelector('[data-entities]') as HTMLElement;
    const entityTypes = [
      'goomba',
      'koopa-green',
      'koopa-red',
      'koopa-para-green',
      'koopa-para-red',
      'koopa-para-green-h',
      'piranha',
      'piranha-down',
      'cheep-red',
      'cheep-grey',
      'blooper',
      'podoboo',
      'hammer-bro',
      'hammer-bro-chase',
      'buzzy',
      'spiny',
      'lakitu',
      'bullet-bill',
      'balance',
      'spring',
      'spring-green',
      'vine',
      'firebar',
      'firebar-ccw',
      'bowser',
      'axe',
      'toad',
      'princess',
      'mushroom',
      'flower',
      'star',
      '1up',
    ];
    for (const t of entityTypes) ents.appendChild(this.brushButton({ kind: 'entity', type: t, label: t }, t));
    for (const t of ['piranha', 'piranha-down']) {
      const label = `${t}-red`;
      ents.appendChild(this.brushButton({ kind: 'entity', type: t, label, props: { red: 1 } }, label));
    }
    for (const t of ['lift-h', 'lift-v', 'lift-fall', 'lift-up', 'lift-down', 'lift-right']) {
      ents.appendChild(
        this.brushButton({ kind: 'entity', type: t, label: t, props: { len: 3, range: 4 } }, t),
      );
    }
    const decor = el.querySelector('[data-decor]') as HTMLElement;
    for (const d of [
      'hill-big',
      'hill-small',
      'bush-1',
      'bush-2',
      'bush-3',
      'cloud-1',
      'cloud-2',
      'cloud-3',
      'tree-big',
      'tree-small',
      'fence',
      'castle-small',
      'castle-big',
      'ruin-pillar',
      'ruin-pillar-broken',
      'ruin-statue',
      'ruin-temple',
    ]) {
      decor.appendChild(this.brushButton({ kind: 'decor', name: d, label: d }, d));
    }
    this.syncBrushButtons();
    this.refreshZoneList();
    this.refreshLoadList();

    const q = <E extends HTMLElement>(sel: string) => el.querySelector(sel) as E;
    q<HTMLInputElement>('[data-name]').addEventListener(
      'change',
      (e) => (this.name = (e.target as HTMLInputElement).value.trim() || 'My Level'),
    );
    q<HTMLButtonElement>('[data-apply-width]').addEventListener('click', () =>
      this.resize(Number(q<HTMLInputElement>('[data-width]').value)),
    );
    q<HTMLSelectElement>('[data-theme]').addEventListener(
      'change',
      (e) => (this.level.theme = (e.target as HTMLSelectElement).value as Theme),
    );
    q<HTMLSelectElement>('[data-music]').addEventListener(
      'change',
      (e) => (this.level.music = (e.target as HTMLSelectElement).value),
    );
    q<HTMLInputElement>('[data-time]').addEventListener(
      'change',
      (e) => (this.level.time = Number((e.target as HTMLInputElement).value) || null),
    );
    q<HTMLSelectElement>('[data-camera]').addEventListener(
      'change',
      (e) => (this.level.camera = (e.target as HTMLSelectElement).value as 'scroll' | 'locked'),
    );
    el.querySelectorAll<HTMLButtonElement>('[data-zone]').forEach((b) =>
      b.addEventListener('click', () => {
        const { tx, ty } = this.cursor;
        switch (b.dataset.zone) {
          case 'exit':
            this.level.zones = this.level.zones.filter((z) => z.kind !== 'exit');
            this.addZone({ kind: 'exit', x: tx, next: 'end' });
            break;
          case 'checkpoint':
            // The respawn stands on the bottom of the checkpoint's row (Level.as hwPnt).
            this.addZone({ kind: 'checkpoint', x: tx, y: ty });
            break;
          case 'scrollStop':
            this.level.zones = this.level.zones.filter((z) => z.kind !== 'scrollStop');
            this.addZone({ kind: 'scrollStop', x: tx });
            break;
          case 'bowser-fire':
            // Bowser's long-range flames start at this column (one per level).
            this.level.zones = this.level.zones.filter((z) => z.kind !== 'bowser-fire');
            this.addZone({ kind: 'bowser-fire', x: tx });
            break;
          case 'pipe': {
            const level = q<HTMLInputElement>('[data-pipe-level]').value.trim();
            const x = Number(q<HTMLInputElement>('[data-pipe-x]').value);
            const y = Number(q<HTMLInputElement>('[data-pipe-y]').value);
            const dir = q<HTMLSelectElement>('[data-pipe-dir]').value as 'down' | 'right';
            this.addZone({ kind: 'pipe', x: tx, y: ty, dir, target: { level, x, y, exitDir: 'none' } });
            break;
          }
        }
      }),
    );
    el.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) =>
      b.addEventListener('click', () => {
        switch (b.dataset.act) {
          case 'new':
            this.level = blankLevel('My Level');
            this.name = 'My Level';
            this.map = new TileMap(this.level);
            this.level.tiles = this.map.tiles;
            this.camX = 0;
            this.buildPanel();
            break;
          case 'save':
            this.save();
            break;
          case 'test':
            this.playtest();
            break;
          case 'load':
            this.load(q<HTMLSelectElement>('[data-load]').value);
            break;
          case 'delete':
            this.remove(q<HTMLSelectElement>('[data-load]').value);
            break;
          case 'export':
            this.exportMap();
            break;
          case 'import':
            q<HTMLInputElement>('[data-import]').click();
            break;
          case 'share':
            void this.share();
            break;
          case 'back':
            this.game.showTitle();
            break;
        }
      }),
    );
    q<HTMLInputElement>('[data-import]').addEventListener('change', (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) this.importMap(f);
    });
  }

  private brushButton(brush: Brush, text: string): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = text;
    b.dataset.brush = brush.label;
    b.addEventListener('click', () => {
      this.brush = brush;
      this.status = `Brush: ${brush.label}`;
      this.syncBrushButtons();
    });
    return b;
  }

  private syncBrushButtons(): void {
    this.panel
      ?.querySelectorAll<HTMLButtonElement>('[data-brush]')
      .forEach((b) => b.classList.toggle('on', b.dataset.brush === this.brush.label));
  }

  private refreshZoneList(): void {
    const ul = this.panel?.querySelector('[data-zones]');
    if (!ul) return;
    ul.innerHTML = '';
    this.level.zones.forEach((z, i) => {
      const li = document.createElement('li');
      const text =
        z.kind === 'pipe'
          ? `pipe ${z.x},${z.y} → ${z.target.level}`
          : z.kind === 'exit'
            ? `exit at ${z.x}`
            : `${z.kind} ${z.x}`;
      li.textContent = text;
      const del = document.createElement('button');
      del.textContent = '×';
      del.addEventListener('click', () => {
        this.level.zones.splice(i, 1);
        this.refreshZoneList();
      });
      li.appendChild(del);
      ul.appendChild(li);
    });
  }

  private refreshLoadList(): void {
    const sel = this.panel?.querySelector<HTMLSelectElement>('[data-load]');
    if (!sel) return;
    const names = Object.keys(loadLibrary().levels).sort();
    sel.innerHTML = names
      .map((n) => `<option ${n === this.name ? 'selected' : ''}>${escapeHtml(n)}</option>`)
      .join('');
  }

  /* ---------- Rendering ---------- */

  render(r: Renderer): void {
    const assets = this.game.ctx.assets;
    const theme = this.level.theme;
    r.clear(SKY[theme] ?? '#5c94fc');
    const view: View = { camX: this.camX, frame: this.frame, assets, theme, reduceFlashing: true };
    const decorSheet = assets.sheet('decor', decorPalette(theme));
    for (const d of this.level.decor) {
      const f = decorSheet.frames.get(d.kind);
      if (f) r.sprite(decorSheet, d.kind, d.x * 16 - this.camX, (d.y + 1) * 16 - f.h);
    }
    renderTiles(r, view, this.map, true);
    for (const e of this.level.entities) {
      const spec = ENTITY_FRAMES[redPiranhaKey(e) ?? e.type];
      const x = e.x * 16 - this.camX;
      if (x < -32 || x > SCREEN_W + 32) continue;
      if (spec) {
        const sheet = assets.sheet(spec.sheet, spec.palette?.(theme));
        const f = sheet.frames.get(spec.frame);
        // Hanging things (flipY) dangle below their anchor tile; the rest stand on its bottom.
        if (spec.flipY) r.sprite(sheet, spec.frame, x + 8, (e.y + 1) * 16, false, true);
        else r.sprite(sheet, spec.frame, x, (e.y + 1) * 16 - (f?.h ?? 16));
      } else r.rect(x + 2, e.y * 16 + 2, 12, 12, '#f0f');
    }
    for (const z of this.level.zones) {
      const x = z.x * 16 - this.camX;
      if (x < -16 || x > SCREEN_W) continue;
      const color =
        z.kind === 'exit' ? '#0f0' : z.kind === 'checkpoint' ? '#ff0' : z.kind === 'pipe' ? '#0ff' : '#f80';
      if (z.kind === 'pipe') r.rect(x, z.y * 16, 32, 2, color);
      else r.rect(x, 0, 2, 240, color);
    }
    const s = this.level.start;
    r.rect(s.x * 16 - this.camX, s.y * 16, 16, 16, 'rgba(0,255,0,0.3)');
    // Cursor and status.
    const cx = this.cursor.tx * 16 - this.camX;
    const cy = this.cursor.ty * 16;
    r.line(cx, cy, cx + 16, cy, '#fff');
    r.line(cx, cy + 16, cx + 16, cy + 16, '#fff');
    r.line(cx, cy, cx, cy + 16, '#fff');
    r.line(cx + 16, cy, cx + 16, cy + 16, '#fff');
    const font = assets.sheet('font');
    r.rect(0, 0, 256, 10, 'rgba(0,0,0,0.6)');
    r.text(font, `${this.cursor.tx},${this.cursor.ty} ${this.brush.label.toUpperCase().slice(0, 12)}`, 2, 1);
    r.rect(0, 230, 256, 10, 'rgba(0,0,0,0.6)');
    r.text(font, this.status.toUpperCase().slice(0, 32), 2, 231);
  }
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}
