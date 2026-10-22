import { readdirSync, readFileSync } from 'node:fs';

/**
 * Every change note in the repo: CHANGELOG.md (all sections) and the unreleased fragments in
 * changes/. A test that checks a change was written down searches this, so it passes before and
 * after a release stamp moves a fragment into CHANGELOG.md.
 */
export function changeNotes(): string {
  const root = new URL('../../', import.meta.url);
  const dir = new URL('changes/', root);
  let names: string[] = [];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith('.md') && n !== 'README.md');
  } catch {
    // No changes/ folder: only the changelog.
  }
  return [
    readFileSync(new URL('CHANGELOG.md', root), 'utf8'),
    ...names.sort().map((n) => readFileSync(new URL(n, dir), 'utf8')),
  ].join('\n');
}
