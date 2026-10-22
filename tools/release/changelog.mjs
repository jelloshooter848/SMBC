// Changelog fragments (see changes/README.md and docs/RELEASING.md).
//
//   pnpm changelog:preview                          print the next release's section from changes/*.md
//   pnpm changelog:stamp 0.4.71 2026-10-22          write it into CHANGELOG.md as ## [0.4.71] - 2026-10-22,
//                                                   update the compare links, bump package.json and
//                                                   delete the fragments
//   pnpm changelog:stamp 0.4.71 2026-10-22 --dry-run   print the new section, write nothing
//
// --changelog <path>, --package <path> and --changes <dir> read other files. Only Node built-ins and
// check.mjs are imported.
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  FRAGMENT_SECTIONS,
  checkRelease,
  isRealDate,
  isSemver,
  parseFragment,
  readFragments,
  unreleasedEntries,
} from './check.mjs';

/**
 * The body of the next release's section: every fragment's bullets, grouped in Keep a Changelog
 * order, and inside a group ordered by file name. Throws on a malformed fragment.
 * @param {readonly { name: string, text: string }[]} fragments
 * @returns {string} empty when there are no fragments
 */
export function renderSection(fragments) {
  /** @type {Map<string, string[]>} */
  const bySection = new Map(FRAGMENT_SECTIONS.map((s) => [s, []]));
  const errors = [];
  const sorted = [...fragments].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const f of sorted) {
    const parsed = parseFragment(f.name, f.text);
    errors.push(...parsed.errors);
    for (const g of parsed.groups) /** @type {string[]} */ (bySection.get(g.section)).push(...g.bullets);
  }
  if (errors.length) throw new Error(`malformed fragments:\n  ${errors.join('\n  ')}`);
  return [...bySection]
    .filter(([, bullets]) => bullets.length)
    .map(([section, bullets]) => `### ${section}\n\n${bullets.join('\n')}`)
    .join('\n\n');
}

/**
 * Points `[Unreleased]` at `v<version>...HEAD` and adds a `[<version>]` link comparing the
 * previous tag with `v<version>`. Running it again changes nothing.
 * @param {string} changelog
 * @param {string} version
 * @returns {string}
 */
export function updateLinks(changelog, version) {
  const lines = changelog.split('\n');
  const i = lines.findIndex((l) => /^\[Unreleased\]: \S+\/compare\/\S+\.\.\.HEAD$/.test(l));
  if (i < 0) throw new Error('CHANGELOG.md has no "[Unreleased]: .../compare/vX.Y.Z...HEAD" link.');
  const m = /** @type {RegExpExecArray} */ (
    /^\[Unreleased\]: (\S+)\/compare\/(\S+)\.\.\.HEAD$/.exec(/** @type {string} */ (lines[i]))
  );
  const [, base, previous] = m;
  const tag = `v${version}`;
  if (previous === tag) return changelog;
  const hasLink = lines.some((l) => l.startsWith(`[${version}]: `));
  lines[i] = `[Unreleased]: ${base}/compare/${tag}...HEAD`;
  if (!hasLink) lines.splice(i + 1, 0, `[${version}]: ${base}/compare/${previous}...${tag}`);
  return lines.join('\n');
}

/**
 * Stamps a release: the fragments become `## [version] - date` right under an empty
 * `## [Unreleased]`, the links are updated and package.json gets the version. Pure: the caller
 * writes the files and deletes the fragments. Throws when there is nothing to stamp or the
 * input is wrong.
 * @param {{ changelog: string, pkg: string, fragments: readonly { name: string, text: string }[],
 *   version: string, date: string }} input
 * @returns {{ changelog: string, pkg: string, section: string }}
 */
export function stamp({ changelog, pkg, fragments, version, date }) {
  if (!isSemver(version)) throw new Error(`"${version}" is not a SemVer version (x.y.z).`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isRealDate(date)) {
    throw new Error(`"${date}" is not a date (YYYY-MM-DD).`);
  }
  const text = changelog.replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const u = lines.findIndex((l) => /^## \[Unreleased\][ \t]*$/.test(l));
  if (u < 0) throw new Error('CHANGELOG.md has no "## [Unreleased]" section.');
  const entries = unreleasedEntries(text);
  if (entries.length) {
    throw new Error(
      `CHANGELOG.md has text under "## [Unreleased]" (line ${entries.join(', ')}): move it into changes/ first.`,
    );
  }
  if (lines.some((l) => l.startsWith(`## [${version}]`))) {
    throw new Error(`CHANGELOG.md already has a "## [${version}]" section.`);
  }
  const body = renderSection(fragments);
  if (!body) throw new Error('changes/ has no fragments: there is nothing to release.');
  const section = `## [${version}] - ${date}\n\n${body}`;

  let end = u + 1;
  while (end < lines.length && !/^## /.test(/** @type {string} */ (lines[end]))) {
    if (/^\[[^\]]+\]: \S+/.test(/** @type {string} */ (lines[end]))) break;
    end++;
  }
  lines.splice(u + 1, end - (u + 1), '', ...section.split('\n'), '');
  const out = updateLinks(lines.join('\n'), version);

  const versionField = /("version"\s*:\s*)"[^"]*"/;
  if (!versionField.test(pkg)) throw new Error('package.json has no "version" field.');
  const newPkg = pkg.replace(versionField, `$1"${version}"`);

  // The result must pass the tag check the release workflow runs.
  const { errors } = checkRelease({ version, changelog: out, tag: `v${version}` });
  if (errors.length) throw new Error(`the stamped changelog fails release:check:\n  ${errors.join('\n  ')}`);
  return { changelog: out, pkg: newPkg, section };
}

/**
 * @param {readonly string[]} argv arguments after the script name
 * @returns {{ command: 'preview' | 'stamp', version?: string, date?: string, dryRun: boolean,
 *   changelog: string, pkg: string, changes: string }}
 */
export function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (command !== 'preview' && command !== 'stamp') {
    throw new Error('usage: changelog.mjs preview | stamp <version> <date> [--dry-run]');
  }
  /** @type {{ command: 'preview' | 'stamp', version?: string, date?: string, dryRun: boolean,
   *   changelog: string, pkg: string, changes: string }} */
  const out = { command, dryRun: false, changelog: 'CHANGELOG.md', pkg: 'package.json', changes: 'changes' };
  /** @type {string[]} */
  const positional = [];
  for (let i = 0; i < rest.length; i++) {
    const a = /** @type {string} */ (rest[i]);
    const value = () => {
      const v = rest[++i];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--changelog') out.changelog = value();
    else if (a === '--package') out.pkg = value();
    else if (a === '--changes') out.changes = value();
    else if (a === '--') continue;
    else if (a.startsWith('--')) throw new Error(`Unknown argument ${a}`);
    else positional.push(a);
  }
  if (command === 'preview') {
    if (positional.length) throw new Error('preview takes no version or date');
    if (out.dryRun) throw new Error('--dry-run is for stamp');
  } else {
    if (positional.length !== 2) throw new Error('usage: changelog.mjs stamp <version> <date> [--dry-run]');
    [out.version, out.date] = positional;
  }
  return out;
}

/** @param {number} n */
const count = (n) => `${n} fragment${n === 1 ? '' : 's'}`;

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`changelog: ${/** @type {Error} */ (e).message}`);
    process.exit(2);
  }
  const fragments = readFragments(args.changes);
  try {
    if (args.command === 'preview') {
      const body = renderSection(fragments);
      if (!body) console.log(`## [Unreleased]\n\n(no fragments in ${args.changes}/ yet)`);
      else console.log(`## [Unreleased]\n\n${body}\n\n(${count(fragments.length)} in ${args.changes}/)`);
      return;
    }
    const result = stamp({
      changelog: readFileSync(args.changelog, 'utf8'),
      pkg: readFileSync(args.pkg, 'utf8'),
      fragments,
      version: /** @type {string} */ (args.version),
      date: /** @type {string} */ (args.date),
    });
    console.log(result.section);
    const files = fragments.map((f) => join(args.changes, f.name));
    if (args.dryRun) {
      console.log(
        `\n(dry run: nothing written; would update ${args.changelog} and ${args.pkg} and delete ` +
          `${count(files.length)}: ${files.join(', ')})`,
      );
      return;
    }
    writeFileSync(args.changelog, result.changelog);
    writeFileSync(args.pkg, result.pkg);
    for (const f of files) unlinkSync(f);
    console.log(
      `\nStamped ${args.version}: updated ${args.changelog} and ${args.pkg}, deleted ${count(files.length)}.`,
    );
  } catch (e) {
    console.error(`changelog: ${/** @type {Error} */ (e).message}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
