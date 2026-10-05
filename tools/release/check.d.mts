// Types for check.mjs (imported by tests/release/check.test.ts).
export function isSemver(version: string): boolean;
export function hasUnreleased(changelog: string): boolean;
export function findSection(changelog: string, version: string): { date: string; body: string } | null;
export function checkRelease(input: { version: unknown; changelog: string; tag?: string | undefined }): {
  errors: string[];
  notes: string | null;
};
export function parseArgs(argv: readonly string[]): {
  tag?: string;
  notes: boolean;
  changelog: string;
  pkg: string;
};
