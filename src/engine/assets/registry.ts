import type { SpriteSheet } from '../gfx/spritesheet';
import type { SpriteDef } from '../gfx/pixelart';
import { rasterize } from '../gfx/pixelart';
import { resolvePalette, type PaletteBook, type PaletteMode } from '../gfx/palette';

/**
 * Holds every sprite sheet by id. Built-in definitions are rasterized on demand for the active
 * palette mode; asset packs (phase 4) replace entries by id.
 */
export class AssetRegistry {
  private readonly defs = new Map<string, SpriteDef>();
  private readonly sheets = new Map<string, SpriteSheet>();
  private readonly overrides = new Map<string, SpriteSheet>();
  mode: PaletteMode = 'default';

  constructor(private readonly palettes: PaletteBook) {}

  define(id: string, def: SpriteDef): void {
    this.defs.set(id, def);
  }

  defineAll(defs: Record<string, SpriteDef>): void {
    for (const [id, d] of Object.entries(defs)) this.define(id, d);
  }

  /** Get a sheet, optionally recoloured with another palette ("mario" with palette "luigi"). */
  sheet(id: string, paletteName?: string): SpriteSheet {
    const key = paletteName ? `${id}@${paletteName}` : id;
    const o = this.overrides.get(key);
    if (o) return o;
    const cached = this.sheets.get(key);
    if (cached) return cached;
    const def = this.defs.get(id);
    if (!def) throw new Error(`unknown sprite sheet "${id}"`);
    const pal = resolvePalette(this.palettes, paletteName ?? def.palette, this.mode);
    const sheet = rasterize(key, def, pal);
    this.sheets.set(key, sheet);
    return sheet;
  }

  has(id: string): boolean {
    return this.defs.has(id) || this.overrides.has(id);
  }

  /** Replace a sheet from an asset pack. */
  override(key: string, sheet: SpriteSheet): void {
    this.overrides.set(key, sheet);
  }

  clearOverrides(): void {
    this.overrides.clear();
  }

  /** Re-rasterize everything (palette mode changed). */
  setMode(mode: PaletteMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.sheets.clear();
  }

  ids(): string[] {
    return [...this.defs.keys()];
  }
}
