// Runs convert-smbc.mjs over every converted world: SMB1's 1-8 (src/content/levels/world<N>) and
// The Lost Levels' 1-13 (src/content/levels/lost/world<N>, ids prefixed `ll-`).
//
//   node tools/levelgen/regen.mjs --layers <dir with levelDataSmb.xml and levelDataLostLevels.xml> [outRoot]
//
// `--layers` writes only the `.layers` files (the maps stay byte for byte as they are; the maps
// themselves carry hand edits, so regenerate a .map only on purpose, without `--layers`).
// `outRoot` defaults to src/content/levels; give a scratch folder to compare.
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--'));
const [xmlDir, outRoot = 'src/content/levels'] = args.filter((a) => !a.startsWith('--'));
if (!xmlDir) {
  console.error('usage: regen.mjs [--layers] <xmlDir> [outRoot]');
  process.exit(2);
}
const tool = join(dirname(fileURLToPath(import.meta.url)), 'convert-smbc.mjs');
const stages = (w) => [1, 2, 3, 4].map((s) => `${w}-${s}`);
const SETS = [
  { xml: 'levelDataSmb.xml', dir: 'world', worlds: 8, extra: [] },
  { xml: 'levelDataLostLevels.xml', dir: 'lost/world', worlds: 13, extra: ['--prefix=ll-'] },
];
let failed = false;
for (const set of SETS)
  for (let w = 1; w <= set.worlds; w++) {
    const r = spawnSync(
      process.execPath,
      [tool, ...set.extra, ...flags, join(xmlDir, set.xml), join(outRoot, `${set.dir}${w}`), ...stages(w)],
      { stdio: 'inherit' },
    );
    if (r.status !== 0) failed = true;
  }
process.exit(failed ? 1 : 0);
