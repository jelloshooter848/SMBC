// Runs convert-smbc.mjs over every converted world: SMB1's 1-8 (levels/world<N>), Super Mario
// Bros. Special's 1-8 (special-levels/world<N>, ids prefixed `sp-`; G-020: outside levels/, which
// holds the campaign's maps only) and The Lost Levels' 1-13 (levels/lost/world<N>, ids `ll-`).
// Layers go to level-layers/ under the same world folders (Special's: level-layers/special/...).
//
//   node tools/levelgen/regen.mjs --layers <dir with levelDataSmb.xml, levelDataSpecial.xml and levelDataLostLevels.xml> [root]
//   node tools/levelgen/regen.mjs --only=special <dir> [root]   (one set: smb, special or lost)
//
// `--layers` writes only the `.layers` files, into <root>/level-layers/... (root defaults to
// src/content), checked against the maps in <root>/levels/...; the maps stay byte for byte as
// they are (they carry hand edits: regenerate a .map only on purpose, without `--layers`, which
// writes the maps into <root>/levels/...).
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--'));
const [xmlDir, root = 'src/content'] = args.filter((a) => !a.startsWith('--'));
if (!xmlDir) {
  console.error('usage: regen.mjs [--layers] <xmlDir> [root]');
  process.exit(2);
}
const layers = flags.includes('--layers');
const only = flags.find((f) => f.startsWith('--only='))?.slice(7);
const tool = join(dirname(fileURLToPath(import.meta.url)), 'convert-smbc.mjs');
const stages = (w) => [1, 2, 3, 4].map((s) => `${w}-${s}`);
const SETS = [
  { id: 'smb', xml: 'levelDataSmb.xml', maps: 'levels/world', dir: 'world', worlds: 8, extra: [] },
  {
    id: 'special',
    xml: 'levelDataSpecial.xml',
    maps: 'special-levels/world',
    dir: 'special/world',
    worlds: 8,
    extra: ['--prefix=sp-'],
  },
  {
    id: 'lost',
    xml: 'levelDataLostLevels.xml',
    maps: 'levels/lost/world',
    dir: 'lost/world',
    worlds: 13,
    extra: ['--prefix=ll-'],
  },
];
if (only && !SETS.some((s) => s.id === only)) {
  console.error(`no map set "${only}" (smb, special or lost)`);
  process.exit(2);
}
let failed = false;
for (const set of SETS.filter((s) => !only || s.id === only))
  for (let w = 1; w <= set.worlds; w++) {
    const maps = join(root, `${set.maps}${w}`);
    const out = layers ? join(root, 'level-layers', `${set.dir}${w}`) : maps;
    const r = spawnSync(
      process.execPath,
      [tool, ...set.extra, ...flags.filter((f) => !f.startsWith('--only=')), `--maps=${maps}`, join(xmlDir, set.xml), out, ...stages(w)],
      { stdio: 'inherit' },
    );
    if (r.status !== 0) failed = true;
  }
process.exit(failed ? 1 : 0);
