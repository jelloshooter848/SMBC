import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  checkRelease,
  findSection,
  hasUnreleased,
  isSemver,
  parseArgs,
  parseFragment,
  readFragments,
  unreleasedEntries,
} from '../../tools/release/check.mjs';

const CHANGELOG = `# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

## [0.2.0-rc.1] - 2026-10-20

### Added

- A test build.

## [0.1.0] - 2026-10-05

### Added

- Worlds 1-8.
- Eight heroes.

### Fixed

- Shells.

[Unreleased]: https://github.com/jelloshooter848/SMBC/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/jelloshooter848/SMBC/releases/tag/v0.1.0
`;

describe('isSemver', () => {
  it('accepts release, pre-release and build versions', () => {
    for (const v of ['0.1.0', '1.0.0', '10.20.30', '0.2.0-rc.1', '1.0.0-alpha.beta', '1.0.0+build.5']) {
      expect(isSemver(v), v).toBe(true);
    }
  });
  it('rejects partial, prefixed or padded versions', () => {
    for (const v of ['0.1', 'v0.1.0', '01.1.0', '0.1.0-', '0.1.0-rc..1', '0.1.0 ', '']) {
      expect(isSemver(v), v).toBe(false);
    }
  });
});

describe('hasUnreleased', () => {
  it('finds the heading only as a level-2 heading', () => {
    expect(hasUnreleased(CHANGELOG)).toBe(true);
    expect(hasUnreleased('# Changelog\n\n### [Unreleased]\n')).toBe(false);
    expect(hasUnreleased('see ## [Unreleased] below')).toBe(false);
  });
});

describe('findSection', () => {
  it('returns the date and the body up to the next section', () => {
    expect(findSection(CHANGELOG, '0.2.0-rc.1')).toEqual({
      date: '2026-10-20',
      body: '### Added\n\n- A test build.',
    });
  });
  it('leaves the link footers out of the last section', () => {
    expect(findSection(CHANGELOG, '0.1.0')).toEqual({
      date: '2026-10-05',
      body: '### Added\n\n- Worlds 1-8.\n- Eight heroes.\n\n### Fixed\n\n- Shells.',
    });
  });
  it('needs an exact version and a date', () => {
    expect(findSection(CHANGELOG, '0.1')).toBeNull();
    expect(findSection(CHANGELOG, '0.2.0')).toBeNull();
    expect(findSection(CHANGELOG, 'Unreleased')).toBeNull();
    expect(findSection('## [0.1.0]\n\n- x\n', '0.1.0')).toBeNull();
  });
  it('handles CRLF line endings', () => {
    expect(findSection('## [0.1.0] - 2026-10-05\r\n\r\n- x\r\n', '0.1.0')).toEqual({
      date: '2026-10-05',
      body: '- x',
    });
  });
});

describe('checkRelease', () => {
  it('passes a well-formed changelog without a tag', () => {
    expect(checkRelease({ version: '0.1.0', changelog: CHANGELOG })).toEqual({ errors: [], notes: null });
  });
  it('returns the notes for a matching tag', () => {
    const r = checkRelease({ version: '0.1.0', changelog: CHANGELOG, tag: 'v0.1.0' });
    expect(r.errors).toEqual([]);
    expect(r.notes).toContain('- Eight heroes.');
  });
  it('accepts a pre-release tag with its own section', () => {
    const r = checkRelease({ version: '0.2.0-rc.1', changelog: CHANGELOG, tag: 'v0.2.0-rc.1' });
    expect(r).toEqual({ errors: [], notes: '### Added\n\n- A test build.' });
  });
  it('rejects a bad package version and a missing Unreleased section', () => {
    const r = checkRelease({ version: '0.1', changelog: '# Changelog\n' });
    expect(r.errors).toHaveLength(2);
    expect(checkRelease({ version: undefined, changelog: CHANGELOG }).errors).toHaveLength(1);
  });
  it('rejects a tag that does not match package.json', () => {
    const r = checkRelease({ version: '0.2.0', changelog: CHANGELOG, tag: 'v0.1.0' });
    expect(r.errors).toEqual(['Tag "v0.1.0" does not match package.json version 0.2.0 (expected v0.2.0).']);
  });
  it('rejects a tag without v or SemVer', () => {
    expect(checkRelease({ version: '0.1.0', changelog: CHANGELOG, tag: '0.1.0' }).errors[0]).toMatch(
      /not v followed/,
    );
    expect(checkRelease({ version: '0.1.0', changelog: CHANGELOG, tag: 'v0.1' }).errors[0]).toMatch(
      /not v followed/,
    );
  });
  it('rejects a tag without a dated section', () => {
    const r = checkRelease({ version: '0.3.0', changelog: CHANGELOG, tag: 'v0.3.0' });
    expect(r.errors).toEqual(['CHANGELOG.md has no "## [0.3.0] - YYYY-MM-DD" section.']);
    expect(r.notes).toBeNull();
  });
  it('rejects an impossible date and an empty section', () => {
    const bad =
      '## [Unreleased]\n\n## [0.3.0] - 2026-02-30\n\n- x\n\n## [0.4.0] - 2026-03-01\n\n## [0.1.0] - 2026-01-01\n';
    expect(checkRelease({ version: '0.3.0', changelog: bad, tag: 'v0.3.0' }).errors[0]).toMatch(
      /invalid date/,
    );
    expect(checkRelease({ version: '0.4.0', changelog: bad, tag: 'v0.4.0' }).errors[0]).toMatch(/is empty/);
  });
});

describe('parseArgs', () => {
  it('reads the flags', () => {
    expect(parseArgs([])).toEqual({
      notes: false,
      changelog: 'CHANGELOG.md',
      pkg: 'package.json',
      changes: 'changes',
    });
    expect(
      parseArgs([
        '--tag',
        'v0.1.0',
        '--notes',
        '--changelog',
        'a.md',
        '--package',
        'b.json',
        '--changes',
        'c',
      ]),
    ).toEqual({
      tag: 'v0.1.0',
      notes: true,
      changelog: 'a.md',
      pkg: 'b.json',
      changes: 'c',
    });
  });
  it('rejects unknown flags, missing values and --notes without --tag', () => {
    expect(() => parseArgs(['--tags', 'v1'])).toThrow(/Unknown/);
    expect(() => parseArgs(['--tag'])).toThrow(/needs a value/);
    expect(() => parseArgs(['--tag', '--notes'])).toThrow(/needs a value/);
    expect(() => parseArgs(['--notes'])).toThrow(/needs --tag/);
    expect(() => parseArgs(['--changes'])).toThrow(/needs a value/);
  });
});

const WITH_ENTRY = CHANGELOG.replace(
  '## [Unreleased]\n',
  '## [Unreleased]\n\n### Added\n\n- The world map.\n',
);

describe('unreleasedEntries', () => {
  it('is empty for an empty section, a missing one, and the last section before the footers', () => {
    expect(unreleasedEntries(CHANGELOG)).toEqual([]);
    expect(unreleasedEntries('# Changelog\n')).toEqual([]);
    expect(unreleasedEntries('## [Unreleased]\n\n[Unreleased]: https://x/compare/v0.1.0...HEAD\n')).toEqual(
      [],
    );
  });
  it('returns the line numbers of any text under it, headings included', () => {
    expect(unreleasedEntries(WITH_ENTRY)).toEqual([7, 9]);
    expect(unreleasedEntries('## [Unreleased]\r\n\r\n- x\r\n## [0.1.0] - 2026-01-01\r\n- y\r\n')).toEqual([
      3,
    ]);
  });
});

describe('parseFragment', () => {
  it('reads a group of bullets, wrapped lines included', () => {
    const text = '### Fixed\n\n- One fix that wraps\n  onto a second line.\n- Another.\n';
    expect(parseFragment('a-fix.md', text)).toEqual({
      groups: [{ section: 'Fixed', bullets: ['- One fix that wraps\n  onto a second line.', '- Another.'] }],
      errors: [],
    });
  });
  it('reads more groups, CRLF and trailing spaces', () => {
    const text = '### Added\r\n- New.  \r\n\r\n### Removed\r\n\r\n- Old.\r\n';
    expect(parseFragment('x.md', text)).toEqual({
      groups: [
        { section: 'Added', bullets: ['- New.'] },
        { section: 'Removed', bullets: ['- Old.'] },
      ],
      errors: [],
    });
  });
  it('rejects a missing or unknown heading, stray text, empty groups and bad names', () => {
    const bad = (name: string, text: string) => parseFragment(name, text).errors;
    expect(bad('a.md', '- No heading.\n')[0]).toMatch(/a\.md:1: the first line must be/);
    expect(bad('a.md', '\n### Added\n- x\n')[0]).toMatch(/first line/);
    expect(bad('a.md', '### Security\n\n- x\n')[0]).toMatch(/unknown group "### Security"/);
    expect(bad('a.md', '## Added\n\n- x\n')[0]).toMatch(/first line/);
    expect(bad('a.md', '### Added\n\nJust a sentence.\n')).toEqual([
      'changes/a.md:3: expected a "- " bullet (or a wrapped line indented by two spaces).',
      'changes/a.md: "### Added" has no bullets.',
    ]);
    expect(bad('a.md', '### Added\n\n* Star bullet.\n')[0]).toMatch(/:3: expected/);
    expect(bad('a.md', '### Added\n\n- x\n\n  orphan wrap\n')[0]).toMatch(/:5: expected/);
    expect(bad('a.md', '### Added\n\n- x\n\n### Added\n\n- y\n')[0]).toMatch(/appears twice/);
    expect(bad('a.md', '### Fixed\n')).toEqual(['changes/a.md: "### Fixed" has no bullets.']);
    expect(bad('a.md', '')[0]).toMatch(/first line/);
    expect(bad('My Change.md', '### Added\n\n- x\n')[0]).toMatch(/lowercase slug/);
    expect(bad('notes.txt', '### Added\n\n- x\n')[0]).toMatch(/lowercase slug/);
    expect(parseFragment('a.md', '### Added\n\nnope\n').groups).toEqual([]);
  });
});

describe('readFragments', () => {
  it('reads the folder sorted by name, skips README.md and folders, and treats a missing folder as empty', () => {
    const dir = mkdtempSync(join(tmpdir(), 'smbc-changes-'));
    try {
      writeFileSync(join(dir, 'b.md'), 'B');
      writeFileSync(join(dir, 'a.md'), 'A');
      writeFileSync(join(dir, 'README.md'), '# not a fragment');
      mkdirSync(join(dir, 'sub'));
      expect(readFragments(dir)).toEqual([
        { name: 'a.md', text: 'A' },
        { name: 'b.md', text: 'B' },
      ]);
      expect(readFragments(join(dir, 'missing'))).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('checkRelease and fragments (the default PR run)', () => {
  const good = { name: 'good.md', text: '### Fixed\n\n- A fix.\n' };
  it('passes good fragments and an empty Unreleased section', () => {
    expect(checkRelease({ version: '0.1.0', changelog: CHANGELOG, fragments: [good] }).errors).toEqual([]);
  });
  it('fails when CHANGELOG.md has text under Unreleased', () => {
    expect(checkRelease({ version: '0.1.0', changelog: WITH_ENTRY }).errors).toEqual([
      'CHANGELOG.md has text under "## [Unreleased]" (line 7, 9): add a fragment in changes/ instead (changes/README.md).',
    ]);
  });
  it('fails on a malformed fragment', () => {
    const r = checkRelease({
      version: '0.1.0',
      changelog: CHANGELOG,
      fragments: [good, { name: 'bad.md', text: 'Fixed a thing.\n' }],
    });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/^changes\/bad\.md:1:/);
  });
  it('leaves --tag as it was: Unreleased text and fragments are not checked there', () => {
    const r = checkRelease({
      version: '0.1.0',
      changelog: WITH_ENTRY,
      tag: 'v0.1.0',
      fragments: [{ name: 'bad.md', text: 'x' }],
    });
    expect(r.errors).toEqual([]);
    expect(r.notes).toContain('- Eight heroes.');
  });
});
