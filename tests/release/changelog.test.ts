import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, renderSection, stamp, updateLinks } from '../../tools/release/changelog.mjs';
import { checkRelease } from '../../tools/release/check.mjs';

// Fixtures only: nothing here reads the repo's own CHANGELOG.md or changes/.

const CHANGELOG = `# Changelog

Intro.

## [Unreleased]

## [0.1.1] - 2026-10-10

### Fixed

- Shells.

## [0.1.0] - 2026-10-05

### Added

- Worlds 1-8.

[Unreleased]: https://github.com/jelloshooter848/SMBC/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/jelloshooter848/SMBC/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/jelloshooter848/SMBC/releases/tag/v0.1.0
`;

const PKG = '{\n  "name": "smbc",\n  "version": "0.1.1",\n  "private": true\n}\n';

const ALL = [
  { name: 'zz-fix.md', text: '### Fixed\n\n- Z fix.\n' },
  { name: 'b-change.md', text: '### Changed\n\n- B change that wraps\n  onto two lines.\n' },
  { name: 'a-fix.md', text: '### Fixed\n\n- A fix.\n- A second fix.\n' },
  { name: 'c-mixed.md', text: '### Removed\n\n- C removal.\n\n### Added\n\n- C addition.\n' },
];

const run = (fragments: readonly { name: string; text: string }[], changelog = CHANGELOG) =>
  stamp({ changelog, pkg: PKG, fragments, version: '0.2.0', date: '2026-10-22' });

describe('renderSection', () => {
  it('is empty for an empty set', () => {
    expect(renderSection([])).toBe('');
  });
  it('orders the groups as Keep a Changelog and the bullets by file name', () => {
    expect(renderSection(ALL)).toBe(
      [
        '### Added',
        '',
        '- C addition.',
        '',
        '### Changed',
        '',
        '- B change that wraps\n  onto two lines.',
        '',
        '### Removed',
        '',
        '- C removal.',
        '',
        '### Fixed',
        '',
        '- A fix.\n- A second fix.\n- Z fix.',
      ].join('\n'),
    );
  });
  it('throws on a malformed fragment, naming it', () => {
    expect(() => renderSection([...ALL, { name: 'oops.md', text: 'Fixed stuff.\n' }])).toThrow(
      /changes\/oops\.md:1/,
    );
  });
});

describe('stamp', () => {
  it('refuses an empty set', () => {
    expect(() => run([])).toThrow(/no fragments/);
  });

  it('stamps every section under an empty Unreleased, with links and the version', () => {
    const r = run(ALL);
    expect(r.section.split('\n')[0]).toBe('## [0.2.0] - 2026-10-22');
    expect(r.changelog).toContain(
      `## [Unreleased]\n\n## [0.2.0] - 2026-10-22\n\n### Added\n\n- C addition.\n\n### Changed\n`,
    );
    expect(r.changelog).toContain('- Z fix.\n\n## [0.1.1] - 2026-10-10\n');
    expect(r.changelog).toContain(
      '[Unreleased]: https://github.com/jelloshooter848/SMBC/compare/v0.2.0...HEAD\n' +
        '[0.2.0]: https://github.com/jelloshooter848/SMBC/compare/v0.1.1...v0.2.0\n' +
        '[0.1.1]: https://github.com/jelloshooter848/SMBC/compare/v0.1.0...v0.1.1\n',
    );
    expect(r.pkg).toBe(PKG.replace('"0.1.1"', '"0.2.0"'));
    // The release workflow's check passes, and a new PR run sees an empty Unreleased again.
    expect(checkRelease({ version: '0.2.0', changelog: r.changelog, tag: 'v0.2.0' }).notes).toBe(
      r.section.split('\n').slice(2).join('\n'),
    );
    expect(checkRelease({ version: '0.2.0', changelog: r.changelog }).errors).toEqual([]);
  });

  it('gives the same result whatever order the fragments come in', () => {
    expect(run([...ALL].reverse())).toEqual(run(ALL));
  });

  it('refuses a malformed fragment', () => {
    expect(() => run([...ALL, { name: 'bad.md', text: '### Security\n\n- x\n' }])).toThrow(/unknown group/);
  });

  it('refuses text under Unreleased, an existing version, a bad version or date', () => {
    const withText = CHANGELOG.replace('## [Unreleased]\n', '## [Unreleased]\n\n- Stray.\n');
    expect(() => run(ALL, withText)).toThrow(/text under "## \[Unreleased\]" \(line 7\)/);
    expect(() =>
      stamp({ changelog: CHANGELOG, pkg: PKG, fragments: ALL, version: '0.1.1', date: '2026-10-22' }),
    ).toThrow(/already has/);
    expect(() =>
      stamp({ changelog: CHANGELOG, pkg: PKG, fragments: ALL, version: '0.2', date: '2026-10-22' }),
    ).toThrow(/SemVer/);
    expect(() =>
      stamp({ changelog: CHANGELOG, pkg: PKG, fragments: ALL, version: '0.2.0', date: '2026-02-30' }),
    ).toThrow(/not a date/);
    expect(() => run(ALL, CHANGELOG.replace(/^\[Unreleased\]:.*$/m, ''))).toThrow(/link/);
  });

  it('stamps a first release with no section below Unreleased', () => {
    const first = '# Changelog\n\n## [Unreleased]\n\n[Unreleased]: https://x.test/compare/v0.0.0...HEAD\n';
    const r = run([ALL[0] as { name: string; text: string }], first);
    expect(r.changelog).toBe(
      '# Changelog\n\n## [Unreleased]\n\n## [0.2.0] - 2026-10-22\n\n### Fixed\n\n- Z fix.\n\n' +
        '[Unreleased]: https://x.test/compare/v0.2.0...HEAD\n[0.2.0]: https://x.test/compare/v0.0.0...v0.2.0\n',
    );
  });
});

describe('updateLinks', () => {
  it('is idempotent', () => {
    const once = updateLinks(CHANGELOG, '0.2.0');
    expect(updateLinks(once, '0.2.0')).toBe(once);
    expect(once.match(/^\[0\.2\.0\]: /gm)).toHaveLength(1);
  });
  it('does not add a second link for a version that already has one', () => {
    const withLink = CHANGELOG.replace(
      '[0.1.1]: ',
      '[0.2.0]: https://github.com/jelloshooter848/SMBC/compare/v0.1.1...v0.2.0\n[0.1.1]: ',
    );
    const out = updateLinks(withLink, '0.2.0');
    expect(out.match(/^\[0\.2\.0\]: /gm)).toHaveLength(1);
    expect(out).toContain('[Unreleased]: https://github.com/jelloshooter848/SMBC/compare/v0.2.0...HEAD\n');
  });
});

describe('parseArgs', () => {
  it('reads preview and stamp', () => {
    expect(parseArgs(['preview'])).toEqual({
      command: 'preview',
      dryRun: false,
      changelog: 'CHANGELOG.md',
      pkg: 'package.json',
      changes: 'changes',
    });
    expect(parseArgs(['stamp', '0.2.0', '2026-10-22', '--dry-run', '--changes', 'c'])).toEqual({
      command: 'stamp',
      version: '0.2.0',
      date: '2026-10-22',
      dryRun: true,
      changelog: 'CHANGELOG.md',
      pkg: 'package.json',
      changes: 'c',
    });
  });
  it('rejects a missing command, missing or extra values and unknown flags', () => {
    expect(() => parseArgs([])).toThrow(/usage/);
    expect(() => parseArgs(['stamp', '0.2.0'])).toThrow(/usage/);
    expect(() => parseArgs(['stamp', '0.2.0', '2026-10-22', 'x'])).toThrow(/usage/);
    expect(() => parseArgs(['preview', '0.2.0'])).toThrow(/no version/);
    expect(() => parseArgs(['preview', '--dry-run'])).toThrow(/for stamp/);
    expect(() => parseArgs(['stamp', '0.2.0', '2026-10-22', '--force'])).toThrow(/Unknown/);
  });
});

describe('the command line', () => {
  const script = fileURLToPath(new URL('../../tools/release/changelog.mjs', import.meta.url));
  const setup = () => {
    const dir = mkdtempSync(join(tmpdir(), 'smbc-stamp-'));
    writeFileSync(join(dir, 'CHANGELOG.md'), CHANGELOG);
    writeFileSync(join(dir, 'package.json'), PKG);
    mkdirSync(join(dir, 'changes'));
    writeFileSync(join(dir, 'changes', 'README.md'), '# Not a fragment\n');
    for (const f of ALL) writeFileSync(join(dir, 'changes', f.name), f.text);
    return dir;
  };
  const cli = (dir: string, ...args: string[]) =>
    execFileSync('node', [script, ...args], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

  it('preview and --dry-run print the section and write nothing', () => {
    const dir = setup();
    try {
      expect(cli(dir, 'preview')).toContain('### Fixed\n\n- A fix.\n- A second fix.\n- Z fix.\n');
      const out = cli(dir, 'stamp', '0.2.0', '2026-10-22', '--dry-run');
      expect(out.startsWith('## [0.2.0] - 2026-10-22\n\n### Added\n')).toBe(true);
      expect(out).toContain('dry run');
      expect(readFileSync(join(dir, 'CHANGELOG.md'), 'utf8')).toBe(CHANGELOG);
      expect(readFileSync(join(dir, 'package.json'), 'utf8')).toBe(PKG);
      expect(existsSync(join(dir, 'changes', 'a-fix.md'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('stamp writes both files and deletes the fragments but not the README', () => {
    const dir = setup();
    try {
      cli(dir, 'stamp', '0.2.0', '2026-10-22');
      expect(readFileSync(join(dir, 'CHANGELOG.md'), 'utf8')).toBe(run(ALL).changelog);
      expect(readFileSync(join(dir, 'package.json'), 'utf8')).toContain('"version": "0.2.0"');
      for (const f of ALL) expect(existsSync(join(dir, 'changes', f.name)), f.name).toBe(false);
      expect(existsSync(join(dir, 'changes', 'README.md'))).toBe(true);
      // A second stamp has nothing left to release and changes nothing.
      const before = readFileSync(join(dir, 'CHANGELOG.md'), 'utf8');
      expect(() => cli(dir, 'stamp', '0.2.1', '2026-10-23')).toThrow();
      expect(readFileSync(join(dir, 'CHANGELOG.md'), 'utf8')).toBe(before);
      expect(cli(dir, 'preview')).toContain('no fragments');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
