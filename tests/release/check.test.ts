import { describe, expect, it } from 'vitest';
import { checkRelease, findSection, hasUnreleased, isSemver, parseArgs } from '../../tools/release/check.mjs';

const CHANGELOG = `# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- The world map.

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
    expect(parseArgs([])).toEqual({ notes: false, changelog: 'CHANGELOG.md', pkg: 'package.json' });
    expect(parseArgs(['--tag', 'v0.1.0', '--notes', '--changelog', 'a.md', '--package', 'b.json'])).toEqual({
      tag: 'v0.1.0',
      notes: true,
      changelog: 'a.md',
      pkg: 'b.json',
    });
  });
  it('rejects unknown flags, missing values and --notes without --tag', () => {
    expect(() => parseArgs(['--tags', 'v1'])).toThrow(/Unknown/);
    expect(() => parseArgs(['--tag'])).toThrow(/needs a value/);
    expect(() => parseArgs(['--tag', '--notes'])).toThrow(/needs a value/);
    expect(() => parseArgs(['--notes'])).toThrow(/needs --tag/);
  });
});
