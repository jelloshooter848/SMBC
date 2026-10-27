import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Item 159 / owner item 160: the crypto and relay code (nostr-tools, @noble) is loaded only
 * through import() when an online row is used, so the main bundle and startup do not change.
 * This walks every static import from src/main.ts (type-only imports left out, as the build
 * drops them) and checks that neither the online module nor its packages are on that path, and
 * that the page reaches the module through import() only, behind the offline build's switch.
 */

const ROOT = resolve(__dirname, '../..');
const ALIAS: Record<string, string> = {
  '@engine/': 'src/engine/',
  '@game/': 'src/game/',
  '@content/': 'src/content/',
};
const LAZY = 'src/engine/online/nostr-backup.ts';

function resolveImport(from: string, spec: string): string | null {
  let base: string | null = null;
  for (const [a, p] of Object.entries(ALIAS))
    if (spec.startsWith(a)) base = join(ROOT, p, spec.slice(a.length));
  if (!base && spec.startsWith('.')) base = resolve(dirname(from), spec);
  if (!base) return null;
  for (const f of [base, `${base}.ts`, join(base, 'index.ts')])
    if (existsSync(f) && f.endsWith('.ts')) return f;
  return null;
}

/** The static (value) imports of a file: specifiers. */
function staticImports(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const out: string[] = [];
  const re = /^\s*(import|export)\s+(?!type\b)([^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;
  for (let m = re.exec(src); m; m = re.exec(src)) out.push(m[3] as string);
  return out;
}

function reachable(entry: string): { files: Set<string>; packages: Set<string> } {
  const files = new Set<string>();
  const packages = new Set<string>();
  const todo = [join(ROOT, entry)];
  while (todo.length) {
    const f = todo.pop() as string;
    if (files.has(f)) continue;
    files.add(f);
    for (const spec of staticImports(f)) {
      const r = resolveImport(f, spec);
      if (r) todo.push(r);
      else if (
        !spec.startsWith('.') &&
        !spec.startsWith('@engine') &&
        !spec.startsWith('@game') &&
        !spec.startsWith('@content')
      )
        packages.add(spec);
    }
  }
  return { files, packages };
}

describe('the online backup code is loaded lazily (item 160)', () => {
  const { files, packages } = reachable('src/main.ts');

  it('the walk finds the game (a sanity check on the walker)', () => {
    expect(files.size).toBeGreaterThan(200);
    expect([...files].some((f) => f.endsWith('src/game/scenes/save-data.ts'))).toBe(true);
    expect([...files].some((f) => f.endsWith('src/engine/online/online-backup.ts'))).toBe(true);
  });

  it('no static import from main.ts reaches the crypto and relay module', () => {
    expect([...files].filter((f) => f.endsWith(LAZY))).toEqual([]);
  });

  it('no static import from main.ts reaches nostr-tools or @noble', () => {
    expect([...packages].filter((p) => p.startsWith('nostr-tools') || p.startsWith('@noble'))).toEqual([]);
  });

  it('the page reaches it only through import(), behind the offline build check', () => {
    const src = readFileSync(join(ROOT, 'src/game/scenes/save-data.ts'), 'utf8');
    expect(src).toMatch(/import\(\s*['"]@engine\/online\/nostr-backup['"]\s*\)/);
    expect(src).toMatch(/import\.meta\.env\.MODE\s*===\s*['"]offline['"]/);
  });

  it('only the lazy module imports the packages', () => {
    const lazy = staticImports(join(ROOT, LAZY));
    expect(lazy.some((s) => s.startsWith('nostr-tools'))).toBe(true);
    expect(lazy.some((s) => s.startsWith('@noble/hashes'))).toBe(true);
  });
});
