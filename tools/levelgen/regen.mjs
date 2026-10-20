// Runs convert-smbc.mjs over every converted world: SMB1's 1-8 (world<N>) and The Lost Levels'
// 1-13 (lost/world<N>, ids prefixed `ll-`).
//
//   node tools/levelgen/regen.mjs --layers <dir with levelDataSmb.xml and levelDataLostLevels.xml> [root]
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
const tool = join(dirname(fileURLToPath(import.meta.url)), 'convert-smbc.mjs');
const stages = (w) => [1, 2, 3, 4].map((s) => `${w}-${s}`);
const SETS = [
  { xml: 'levelDataSmb.xml', dir: 'world', worlds: 8, extra: [] },
  { xml: 'levelDataLostLevels.xml', dir: 'lost/world', worlds: 13, extra: ['--prefix=ll-'] },
];
let failed = false;
for (const set of SETS)
  for (let w = 1; w <= set.worlds; w++) {
    const maps = join(root, 'levels', `${set.dir}${w}`);
    const out = layers ? join(root, 'level-layers', `${set.dir}${w}`) : maps;
    const r = spawnSync(
      process.execPath,
      [tool, ...set.extra, ...flags, `--maps=${maps}`, join(xmlDir, set.xml), out, ...stages(w)],
      { stdio: 'inherit' },
    );
    if (r.status !== 0) failed = true;
  }
process.exit(failed ? 1 : 0);
