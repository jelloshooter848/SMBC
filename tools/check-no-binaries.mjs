// Fails if any image/audio binary is tracked by git outside the allowed paths.
// All in-repo art and music must be generated from source (pixel arrays / MML),
// which keeps copyrighted rips out of the repository.
//
// One narrow exception: the secrets guide's screenshots (docs/secrets/img/*.png, taken from the
// game itself, so only our own art), each at most DOC_SCREENSHOT_MAX_BYTES.
import { execSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const DOC_SCREENSHOT_MAX_BYTES = 150 * 1024;

const allowed = [/^public\/favicon/];
/** The guide's screenshots: PNG only, directly in docs/secrets/img (no subfolders). */
const docScreenshot = /^docs\/secrets\/img\/[^/]+\.png$/;
const banned = /\.(png|jpe?g|gif|bmp|webp|wav|mp3|ogg|flac|m4a|swf|fla)$/i;

/**
 * The tracked files that break the rule, each with the reason. `sizeOf(path)` gives a file's size
 * in bytes (only asked for the guide's screenshots).
 */
export function findBadFiles(files, sizeOf) {
  const bad = [];
  for (const f of files) {
    if (!banned.test(f) || allowed.some((a) => a.test(f))) continue;
    if (docScreenshot.test(f)) {
      const size = sizeOf(f);
      if (size > DOC_SCREENSHOT_MAX_BYTES)
        bad.push(`${f} (${size} bytes; guide screenshots are capped at ${DOC_SCREENSHOT_MAX_BYTES})`);
      continue;
    }
    bad.push(f);
  }
  return bad;
}

function main() {
  const files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
  const bad = findBadFiles(files, (f) => statSync(f).size);
  if (bad.length) {
    console.error('Binary art/audio files are not allowed in the repository:\n  ' + bad.join('\n  '));
    process.exit(1);
  }
  console.log(`check:assets ok (${files.length} tracked files)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
