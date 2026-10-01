// Fails if any image/audio binary is tracked by git outside the allowed paths.
// All in-repo art and music must be generated from source (pixel arrays / MML),
// which keeps copyrighted rips out of the repository.
import { execSync } from 'node:child_process';

const allowed = [/^public\/favicon/];
const banned = /\.(png|jpe?g|gif|bmp|webp|wav|mp3|ogg|flac|m4a|swf|fla)$/i;
const files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
const bad = files.filter((f) => banned.test(f) && !allowed.some((a) => a.test(f)));
if (bad.length) {
  console.error('Binary art/audio files are not allowed in the repository:\n  ' + bad.join('\n  '));
  process.exit(1);
}
console.log(`check:assets ok (${files.length} tracked files)`);
