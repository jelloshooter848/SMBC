// Types for changelog.mjs (imported by tests/release/changelog.test.ts).
type Fragment = { name: string; text: string };
export function renderSection(fragments: readonly Fragment[]): string;
export function updateLinks(changelog: string, version: string): string;
export function stamp(input: {
  changelog: string;
  pkg: string;
  fragments: readonly Fragment[];
  version: string;
  date: string;
}): { changelog: string; pkg: string; section: string };
export function parseArgs(argv: readonly string[]): {
  command: 'preview' | 'stamp';
  version?: string;
  date?: string;
  dryRun: boolean;
  changelog: string;
  pkg: string;
  changes: string;
};
