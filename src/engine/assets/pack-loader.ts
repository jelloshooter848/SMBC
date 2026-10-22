import type { AssetRegistry } from './registry';
import type { FrameRect, SpriteSheet } from '../gfx/spritesheet';
import { validateManifest, type PackManifest } from './manifest';
import { packStore, type StoredPack } from './idb';
import { makeZip, type ZipEntry } from '../save/zip';

export interface LoadedPack {
  name: string;
  manifest: PackManifest;
  sheets: Map<string, SpriteSheet>;
  /** Decoded audio by song/sfx id (filled by the audio side). */
  audio: Map<string, Blob>;
  warnings: string[];
}

/** Read a pack from a set of files (a folder picked in the browser). */
export async function readPackFiles(
  files: File[],
): Promise<{ manifest: PackManifest; files: Record<string, Blob> }> {
  const byName = new Map<string, File>();
  for (const f of files) {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    const parts = rel.split('/');
    byName.set(parts.slice(1).join('/') || f.name, f);
    byName.set(f.name, f);
  }
  const mf = byName.get('manifest.json');
  if (!mf) throw new Error('manifest.json not found in the selected files');
  const manifest: unknown = JSON.parse(await mf.text());
  if (!validateManifest(manifest)) throw new Error('manifest.json is not a valid pack manifest');
  const out: Record<string, Blob> = {};
  const want = new Set<string>();
  for (const s of Object.values(manifest.sprites ?? {})) want.add(s.image);
  for (const f of Object.values(manifest.music ?? {})) want.add(f);
  for (const f of Object.values(manifest.sfx ?? {})) want.add(f);
  for (const path of want) {
    const f = byName.get(path);
    if (!f) throw new Error(`pack file "${path}" is missing`);
    out[path] = f;
  }
  return { manifest, files: out };
}

/** Build sprite sheets and audio blobs from a stored pack, using built-in frame layouts when the pack omits them. */
export async function buildPack(stored: StoredPack, registry: AssetRegistry): Promise<LoadedPack> {
  const manifest = stored.manifest as PackManifest;
  const pack: LoadedPack = { name: stored.name, manifest, sheets: new Map(), audio: new Map(), warnings: [] };
  for (const [id, spec] of Object.entries(manifest.sprites ?? {})) {
    const blob = stored.files[spec.image];
    if (!blob) {
      pack.warnings.push(`sprite "${id}": file ${spec.image} missing`);
      continue;
    }
    let image: CanvasImageSource;
    try {
      image = await createImageBitmap(blob);
    } catch {
      pack.warnings.push(`sprite "${id}": ${spec.image} is not a readable image`);
      continue;
    }
    let frames: Map<string, FrameRect>;
    if (spec.frames) {
      frames = new Map(Object.entries(spec.frames).map(([k, [x, y, w, h]]) => [k, { x, y, w, h }]));
    } else if (registry.has(id)) {
      frames = new Map(registry.sheet(id).frames);
    } else {
      pack.warnings.push(`sprite "${id}": unknown built-in sheet and no frames given`);
      continue;
    }
    pack.sheets.set(id, { id: `${id}@pack:${stored.name}`, image, frames });
  }
  for (const [sid, file] of Object.entries({ ...(manifest.music ?? {}), ...(manifest.sfx ?? {}) })) {
    const blob = stored.files[file];
    if (blob) pack.audio.set(sid, blob);
    else pack.warnings.push(`audio "${sid}": file ${file} missing`);
  }
  return pack;
}

/** Apply a pack's sheets as overrides (later packs win). Palette-only overrides re-rasterize built-ins. */
export function applyPack(pack: LoadedPack, registry: AssetRegistry): void {
  for (const [id, sheet] of pack.sheets) {
    registry.override(id, sheet);
    // A pack image replaces every palette variant of that sheet too, but not the whole-palette
    // effects ('mario@luigi~silhouette'): those stay the built-in art recoloured, so a pack can't
    // unhide a locked hero's silhouette or a captive's trance.
    for (const key of registry.sheetKeys())
      if (key.startsWith(`${id}@`) && !key.includes('~')) registry.override(key, sheet);
  }
  for (const [name, colors] of Object.entries(pack.manifest.palettes ?? {}))
    registry.overridePalette(name, colors);
}

/** Store a pack picked from files, returning its name. */
export async function importPackFiles(files: File[]): Promise<string> {
  const { manifest, files: blobs } = await readPackFiles(files);
  await packStore.put({ name: manifest.name, manifest, files: blobs, addedAt: Date.now() });
  return manifest.name;
}

/** Load every enabled stored pack in order and apply it. */
export async function loadEnabledPacks(names: string[], registry: AssetRegistry): Promise<LoadedPack[]> {
  registry.clearOverrides();
  const loaded: LoadedPack[] = [];
  for (const name of names) {
    const stored = await packStore.get(name);
    if (!stored) continue;
    const pack = await buildPack(stored, registry);
    applyPack(pack, registry);
    loaded.push(pack);
  }
  return loaded;
}

/** Fetch `user-packs/index.json` in dev builds and import the listed folders (served by Vite). */
export async function importDevPacks(base = '/user-packs/'): Promise<string[]> {
  try {
    const res = await fetch(`${base}index.json`);
    if (!res.ok) return [];
    const index = (await res.json()) as { packs?: string[] };
    const names: string[] = [];
    for (const folder of index.packs ?? []) {
      const mres = await fetch(`${base}${folder}/manifest.json`);
      if (!mres.ok) continue;
      const manifest: unknown = await mres.json();
      if (!validateManifest(manifest)) continue;
      const files: Record<string, Blob> = {};
      const paths = new Set<string>();
      for (const s of Object.values(manifest.sprites ?? {})) paths.add(s.image);
      for (const f of Object.values(manifest.music ?? {})) paths.add(f);
      for (const f of Object.values(manifest.sfx ?? {})) paths.add(f);
      for (const p of paths) {
        const r = await fetch(`${base}${folder}/${p}`);
        if (r.ok) files[p] = await r.blob();
      }
      await packStore.put({ name: manifest.name, manifest, files, addedAt: Date.now() });
      names.push(manifest.name);
    }
    return names;
  } catch {
    return [];
  }
}

/** What the pack template lists beside the sheets: the live song and sfx ids (main.ts's registries). */
export interface TemplateLists {
  songs: readonly string[];
  sfx: readonly string[];
  /** A sheet's PNG (default: drawn from its canvas); null leaves the sheet out. */
  encodePng?: (id: string) => Promise<Uint8Array | null>;
}

/** The template's file name (one download, owner item 92). */
export const TEMPLATE_ZIP = 'smbc-remix-pack-template.zip';

/** A sheet's image as PNG bytes, through a canvas (browsers). */
async function canvasPng(registry: AssetRegistry, id: string): Promise<Uint8Array | null> {
  if (typeof document === 'undefined') return null;
  const img = registry.sheet(id).image;
  if (!img) return null;
  const canvas = document.createElement('canvas');
  canvas.width = (img as HTMLCanvasElement).width;
  canvas.height = (img as HTMLCanvasElement).height;
  canvas.getContext('2d')?.drawImage(img, 0, 0);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
}

/** The README.txt of the pack template: what a pack can replace, all read live. */
export function templateReadme(
  registry: AssetRegistry,
  sheets: readonly string[],
  lists: Pick<TemplateLists, 'songs' | 'sfx'>,
): string {
  const example: PackManifest = {
    schema: 1,
    name: 'my-pack',
    sprites: { mario: { image: 'mario.png' } },
    music: { [lists.songs[0] ?? 'overworld']: 'overworld.ogg' },
    sfx: { [lists.sfx[0] ?? 'jump-small']: 'jump.wav' },
  };
  const list = (ids: readonly string[]) => [...ids].sort().map((id) => `  ${id}`);
  return [
    'SMBC REMIX ASSET PACK TEMPLATE',
    '',
    "An asset pack replaces the game's pictures and sounds by id. It holds no code and no levels.",
    'To make one: repaint the PNG files you want to change (keep each frame where its',
    '<sheet>.frames.json says it is), delete the ones you do not change from this folder and from',
    'manifest.json, rename the pack in manifest.json ("name": letters, digits, - and _), then pick',
    'the folder with Options > Asset packs > Import pack on a computer.',
    '',
    'manifest.json keys:',
    '  sprites   sheet id -> { "image": "<file>.png" } (optional "frames": { name: [x, y, w, h] })',
    '  palettes  palette name -> list of colours, replacing a built-in palette (see below)',
    '  music     song id -> audio file (ogg, mp3, wav) played instead of the built-in song',
    '  sfx       sound id -> audio file played instead of the built-in sound',
    '',
    'A minimal example manifest:',
    '```json',
    JSON.stringify(example, null, 2),
    '```',
    '',
    `SPRITE SHEETS (${sheets.length}): <id>.png and <id>.frames.json in this folder`,
    ...list(sheets),
    '',
    `MUSIC IDS (${lists.songs.length}) for "music":`,
    ...list(lists.songs),
    '',
    `SFX IDS (${lists.sfx.length}) for "sfx":`,
    ...list(lists.sfx),
    '',
    'PALETTES for "palettes": name: colours, in order. A palette entry recolours every built-in',
    "sheet drawn with that palette, without repainting it: the heroes' power-up colours such as",
    'Fire Mario, the level and map themes, star flashes and other colour cycles. A sheet a pack',
    'repaints as a PNG ignores palettes.',
    ...Object.entries(registry.paletteTable())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([name, colors]) => `  ${name}: ${colors.join(', ')}`),
    '',
  ].join('\n');
}

/**
 * The pack template as one zip (owner item 92): manifest.json naming every sheet, each sheet's
 * PNG and frames.json (sheet ids read live from the registry), and README.txt.
 */
export async function buildTemplateZip(registry: AssetRegistry, lists: TemplateLists): Promise<Uint8Array> {
  const encode = lists.encodePng ?? ((id: string) => canvasPng(registry, id));
  const manifest: PackManifest = { schema: 1, name: 'my-pack', sprites: {} };
  const sprites = manifest.sprites as NonNullable<PackManifest['sprites']>;
  const entries: ZipEntry[] = [];
  const sheets: string[] = [];
  for (const id of registry.ids()) {
    const png = await encode(id);
    if (!png) continue;
    const rects: Record<string, [number, number, number, number]> = {};
    for (const [k, f] of registry.sheet(id).frames) rects[k] = [f.x, f.y, f.w, f.h];
    entries.push({ path: `${id}.png`, data: png });
    entries.push({ path: `${id}.frames.json`, data: JSON.stringify(rects, null, 2) });
    sprites[id] = { image: `${id}.png` };
    sheets.push(id);
  }
  return makeZip([
    { path: 'manifest.json', data: JSON.stringify(manifest, null, 2) },
    { path: 'README.txt', data: templateReadme(registry, sheets, lists) },
    ...entries,
  ]);
}

/** Export template: one download, smbc-remix-pack-template.zip. */
export async function exportTemplate(
  registry: AssetRegistry,
  lists: TemplateLists,
  save: (name: string, blob: Blob) => void = download,
): Promise<void> {
  const bytes = await buildTemplateZip(registry, lists);
  save(TEMPLATE_ZIP, new Blob([bytes as BlobPart], { type: 'application/zip' }));
}

/** Saves `blob` as a download named `name`. */
export function download(name: string, blob: Blob): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
