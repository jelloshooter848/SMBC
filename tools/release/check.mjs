// Release checks (see docs/RELEASING.md).
//
//   pnpm release:check                       package.json has a SemVer version; CHANGELOG.md has ## [Unreleased]
//   pnpm release:check --tag v0.2.0          ...and the tag is v + that version, with a ## [0.2.0] - YYYY-MM-DD section
//   pnpm -s release:check --tag v0.2.0 --notes   ...and print that section's body (the release notes) to stdout
//
// --changelog <path> and --package <path> read other files (the release workflow uses them for
// tags made before this tool existed). Only Node built-ins are imported, so the file runs on its own.
import { readFileSync } from 'node:fs';
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

/** @param {string} date YYYY-MM-DD */
function isRealDate(date) {
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

/**
 * All checks. Returns the problems found (empty when everything is fine) and, with a tag, the
 * release notes.
 * @param {{ version: unknown, changelog: string, tag?: string | undefined }} input
 * @returns {{ errors: string[], notes: string | null }}
 */
export function checkRelease({ version, changelog, tag }) {
  const errors = [];
  let notes = null;
  if (typeof version !== 'string' || !isSemver(version)) {
    errors.push(`package.json version ${JSON.stringify(version)} is not a SemVer version (x.y.z).`);
  }
  if (!hasUnreleased(changelog)) errors.push('CHANGELOG.md has no "## [Unreleased]" section.');
  if (tag !== undefined) {
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
 * @returns {{ tag?: string, notes: boolean, changelog: string, pkg: string }}
 */
export function parseArgs(argv) {
  /** @type {{ tag?: string, notes: boolean, changelog: string, pkg: string }} */
  const out = { notes: false, changelog: 'CHANGELOG.md', pkg: 'package.json' };
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
  });
  if (errors.length) {
    console.error('release:check failed:\n  ' + errors.join('\n  '));
    process.exit(1);
  }
  if (args.notes) process.stdout.write(`${notes}\n`);
  else console.log(`release:check ok (version ${pkg.version}${args.tag ? `, tag ${args.tag}` : ''})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
