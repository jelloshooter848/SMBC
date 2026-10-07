import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { DOC_SCREENSHOT_MAX_BYTES, findBadFiles } from '../../tools/check-no-binaries.mjs';

const small = () => 30 * 1024;

describe('check:assets (tools/check-no-binaries.mjs)', () => {
  it('rejects image and audio files anywhere but the favicon', () => {
    const files = ['src/a.png', 'art/b.wav', 'docs/c.jpg', 'public/favicon.png', 'src/main.ts', 'docs/x.md'];
    expect(findBadFiles(files, small)).toEqual(['src/a.png', 'art/b.wav', 'docs/c.jpg']);
  });

  it("allows the secrets guide's PNG screenshots, and only those", () => {
    expect(findBadFiles(['docs/secrets/img/1-luigi-1.png'], small)).toEqual([]);
    expect(
      findBadFiles(
        [
          'docs/secrets/img/1-luigi-1.jpg', // PNG only
          'docs/secrets/img/sub/1-luigi-1.png', // no subfolders
          'docs/secrets/1-luigi-1.png', // only in img/
          'docs/img/1-luigi-1.png',
          'src/docs/secrets/img/a.png',
          'docs/secrets/img/a.wav',
        ],
        small,
      ),
    ).toHaveLength(6);
  });

  it('caps each screenshot at DOC_SCREENSHOT_MAX_BYTES', () => {
    expect(DOC_SCREENSHOT_MAX_BYTES).toBe(150 * 1024);
    const f = 'docs/secrets/img/2-link-1.png';
    expect(findBadFiles([f], () => DOC_SCREENSHOT_MAX_BYTES)).toEqual([]);
    const bad = findBadFiles([f], () => DOC_SCREENSHOT_MAX_BYTES + 1);
    expect(bad).toHaveLength(1);
    expect(bad[0]).toContain(f);
  });

  it('the tracked files pass', () => {
    const files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
    expect(findBadFiles(files, (f) => statSync(f).size)).toEqual([]);
  });
});
