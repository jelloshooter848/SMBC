// Release checks (see docs/RELEASING.md).
//
//   pnpm release:check                       package.json has a SemVer version; CHANGELOG.md has an empty
//                                            ## [Unreleased]; every fragment in changes/ is well formed
//   pnpm release:check --tag v0.2.0          ...and the tag is v + that version, with a ## [0.2.0] - YYYY-MM-DD section
//   pnpm -s release:check --tag v0.2.0 --notes   ...and print that section's body (the release notes) to stdout
//
// --changelog <path>, --package <path> and --changes <dir> read other files (the release workflow
// uses them for tags made before this tool existed). Only Node built-ins are imported, so the file
// runs on its own. The fragment format (changes/README.md) is parsed here; changelog.mjs stamps it.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** SemVer 2.0.0 (https://semver.org), without a leading `v`. */
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/** @param {string} version */
export function isSemver(version) {
  return SEMVER.test(version);
}

/** @param {string} s */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** @param {string} changelog */
export function hasUnreleased(changelog) {
  return /^## \[Unreleased\][ \t]*$/m.test(changelog);
}

/**
 * The `## [version] - YYYY-MM-DD` section of a changelog: its date and body (the text up to the
 * next `## ` heading or the link footers, trimmed), or null when there is none.
 * @param {string} changelog
 * @param {string} version
 * @returns {{ date: string, body: string } | null}
 */
export function findSection(changelog, version) {
  const lines = changelog.replace(/\r\n/g, '\n').split('\n');
  const heading = new RegExp(`^## \\[${escapeRegExp(version)}\\] - (\\d{4}-\\d{2}-\\d{2})[ \\t]*$`);
  const start = lines.findIndex((l) => heading.test(l));
  if (start < 0) return null;
  const date = /** @type {RegExpExecArray} */ (heading.exec(/** @type {string} */ (lines[start])))[1];
  let end = start + 1;
  while (end < lines.length && !/^## /.test(/** @type {string} */ (lines[end]))) end++;
  const body = lines.slice(start + 1, end);
  // Link reference footers ([0.1.0]: https://...) after the last section are not release notes.
  while (body.length && /^(\[[^\]]+\]: \S+)?\s*$/.test(/** @type {string} */ (body[body.length - 1])))
    body.pop();
  return { date: /** @type {string} */ (date), body: body.join('\n').trim() };
}

/**
 * The changelog groups a fragment may use, in Keep a Changelog order (the order of a stamped
 * section).
 */
export const FRAGMENT_SECTIONS = /** @type {const} */ (['Added', 'Changed', 'Removed', 'Fixed']);

/** A fragment's file name: a lowercase slug (README.md in the folder is not a fragment). */
const FRAGMENT_NAME = /^[a-z0-9][a-z0-9-]*\.md$/;

/**
 * Parses one fragment from changes/: its first line is a `### Added|Changed|Removed|Fixed`
 * heading, followed by `- ` bullets (a bullet wraps onto lines indented by two spaces). More
 * groups may follow, each under its own heading. Blank lines are ignored.
 * @param {string} name the file name, for example `my-change.md`
 * @param {string} text
 * @returns {{ groups: { section: string, bullets: string[] }[], errors: string[] }}
 */
export function parseFragment(name, text) {
  /** @type {{ section: string, bullets: string[] }[]} */
  const groups = [];
  /** @type {string[]} */
  const errors = [];
  const where = (/** @type {number} */ n) => `changes/${name}:${n}`;
  if (!FRAGMENT_NAME.test(name)) {
    errors.push(`changes/${name}: a fragment's name is a lowercase slug ending in .md (my-change.md).`);
  }
  const lines = text.replace(/\r\n/g, '\n').replace(/\s+$/, '').split('\n');
  const headings = FRAGMENT_SECTIONS.map((s) => `### ${s}`).join(', ');
  if (!/^### /.test(/** @type {string} */ (lines[0]))) {
    errors.push(`${where(1)}: the first line must be one of ${headings}.`);
  }
  /** @type {string[] | null} */
  let bullet = null;
  lines.forEach((raw, i) => {
    const line = raw.replace(/[ \t]+$/, '');
    const heading = /^### (.*)$/.exec(line);
    if (heading) {
      const section = /** @type {string} */ (heading[1]);
      bullet = null;
      if (!(/** @type {readonly string[]} */ (FRAGMENT_SECTIONS).includes(section))) {
        errors.push(`${where(i + 1)}: unknown group "${line}" (use ${headings}).`);
      } else if (groups.some((g) => g.section === section)) {
        errors.push(`${where(i + 1)}: "${line}" appears twice.`);
      }
      groups.push({ section, bullets: [] });
    } else if (line === '') {
      // Blank lines between the heading and the bullets (or between bullets) are fine.
    } else if (/^- \S/.test(line) && groups.length) {
      bullet = [line];
      /** @type {{ bullets: string[] }} */ (groups[groups.length - 1]).bullets.push(line);
    } else if (/^ {2}\S/.test(line) && bullet && lines[i - 1]?.trim()) {
      const g = /** @type {{ bullets: string[] }} */ (groups[groups.length - 1]);
      g.bullets[g.bullets.length - 1] += `\n${line}`;
    } else if (groups.length) {
      errors.push(`${where(i + 1)}: expected a "- " bullet (or a wrapped line indented by two spaces).`);
    }
  });
  for (const g of groups) {
    if (!g.bullets.length) errors.push(`changes/${name}: "### ${g.section}" has no bullets.`);
  }
  if (!groups.length && errors.length === 0) errors.push(`${where(1)}: the fragment is empty.`);
  return { groups: errors.length ? [] : groups, errors };
}

/**
 * Reads every fragment in a changes/ folder, sorted by file name. README.md is skipped, and a
 * missing folder has no fragments.
 * @param {string} dir
 * @returns {{ name: string, text: string }[]}
 */
export function readFragments(dir) {
  let names;
  try {
    names = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name !== 'README.md')
      .map((e) => e.name);
  } catch {
    return [];
  }
  return names.sort().map((name) => ({ name, text: readFileSync(join(dir, name), 'utf8') }));
}

/**
 * The 1-based line numbers of the text under `## [Unreleased]` (up to the next `## ` heading or
 * the link footers). Empty when the section is empty or missing.
 * @param {string} changelog
 * @returns {number[]}
 */
export function unreleasedEntries(changelog) {
  const lines = changelog.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => /^## \[Unreleased\][ \t]*$/.test(l));
  if (start < 0) return [];
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = /** @type {string} */ (lines[i]);
    if (/^## /.test(l) || /^\[[^\]]+\]: \S+/.test(l)) break;
    if (l.trim()) out.push(i + 1);
  }
  return out;
}

/** @param {string} date YYYY-MM-DD */
export function isRealDate(date) {
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

/**
 * All checks. Returns the problems found (empty when everything is fine) and, with a tag, the
 * release notes. Without a tag (every push and pull request) `## [Unreleased]` must be empty and
 * every fragment well formed: changes go in changes/, and only a release stamp writes them into
 * CHANGELOG.md. With a tag those two checks are skipped.
 * @param {{ version: unknown, changelog: string, tag?: string | undefined,
 *   fragments?: readonly { name: string, text: string }[] }} input
 * @returns {{ errors: string[], notes: string | null }}
 */
export function checkRelease({ version, changelog, tag, fragments = [] }) {
  const errors = [];
  let notes = null;
  if (typeof version !== 'string' || !isSemver(version)) {
    errors.push(`package.json version ${JSON.stringify(version)} is not a SemVer version (x.y.z).`);
  }
  if (!hasUnreleased(changelog)) errors.push('CHANGELOG.md has no "## [Unreleased]" section.');
  if (tag === undefined) {
    const entries = unreleasedEntries(changelog);
    if (entries.length) {
      errors.push(
        `CHANGELOG.md has text under "## [Unreleased]" (line ${entries.join(', ')}): ` +
          'add a fragment in changes/ instead (changes/README.md).',
      );
    }
    for (const f of fragments) errors.push(...parseFragment(f.name, f.text).errors);
  } else {
    if (!/^v/.test(tag) || !isSemver(tag.slice(1))) {
      errors.push(`Tag "${tag}" is not v followed by a SemVer version (for example v0.2.0).`);
    } else if (typeof version === 'string' && tag !== `v${version}`) {
      errors.push(`Tag "${tag}" does not match package.json version ${version} (expected v${version}).`);
    }
    const target = tag.replace(/^v/, '');
    const section = findSection(changelog, target);
    if (!section) {
      errors.push(`CHANGELOG.md has no "## [${target}] - YYYY-MM-DD" section.`);
    } else if (!isRealDate(section.date)) {
      errors.push(`CHANGELOG.md section [${target}] has an invalid date ${section.date}.`);
    } else if (!section.body) {
      errors.push(`CHANGELOG.md section [${target}] is empty.`);
    } else {
      notes = section.body;
    }
  }
  return { errors, notes };
}

/**
 * @param {readonly string[]} argv arguments after the script name
 * @returns {{ tag?: string, notes: boolean, changelog: string, pkg: string, changes: string }}
 */
export function parseArgs(argv) {
  /** @type {{ tag?: string, notes: boolean, changelog: string, pkg: string, changes: string }} */
  const out = { notes: false, changelog: 'CHANGELOG.md', pkg: 'package.json', changes: 'changes' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === '--tag') out.tag = value();
    else if (a === '--notes') out.notes = true;
    else if (a === '--changelog') out.changelog = value();
    else if (a === '--package') out.pkg = value();
    else if (a === '--changes') out.changes = value();
    else if (a === '--') continue;
    else throw new Error(`Unknown argument ${a}`);
  }
  if (out.notes && out.tag === undefined) throw new Error('--notes needs --tag');
  return out;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`release:check: ${/** @type {Error} */ (e).message}`);
    process.exit(2);
  }
  /** @param {string} path */
  const read = (path) => {
    try {
      return readFileSync(path, 'utf8');
    } catch {
      console.error(`release:check: cannot read ${path}`);
      process.exit(1);
    }
  };
  const pkg = JSON.parse(read(args.pkg));
  const { errors, notes } = checkRelease({
    version: pkg.version,
    changelog: read(args.changelog),
    tag: args.tag,
    fragments: args.tag === undefined ? readFragments(args.changes) : [],
  });
  if (errors.length) {
    console.error('release:check failed:\n  ' + errors.join('\n  '));
    process.exit(1);
  }
  if (args.notes) process.stdout.write(`${notes}\n`);
  else console.log(`release:check ok (version ${pkg.version}${args.tag ? `, tag ${args.tag}` : ''})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
