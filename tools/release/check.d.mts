// Types for check.mjs (imported by tests/release/check.test.ts).
export function isSemver(version: string): boolean;
export function isRealDate(date: string): boolean;
export function hasUnreleased(changelog: string): boolean;
export function findSection(changelog: string, version: string): { date: string; body: string } | null;
export const FRAGMENT_SECTIONS: readonly ['Added', 'Changed', 'Removed', 'Fixed'];
export function parseFragment(
  name: string,
  text: string,
): { groups: { section: string; bullets: string[] }[]; errors: string[] };
export function readFragments(dir: string): { name: string; text: string }[];
export function unreleasedEntries(changelog: string): number[];
export function checkRelease(input: {
  version: unknown;
  changelog: string;
  tag?: string | undefined;
  fragments?: readonly { name: string; text: string }[];
}): {
  errors: string[];
  notes: string | null;
};
export function parseArgs(argv: readonly string[]): {
  tag?: string;
  notes: boolean;
  changelog: string;
  pkg: string;
  changes: string;
};
