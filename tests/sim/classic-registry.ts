import { afterEach, beforeEach } from 'vitest';
import type { CharacterDef } from '@game/characters/character';
import { CLASSIC_CHARACTERS, CLASSIC_EXTRAS } from '@game/characters/registry';

// Keeps the Classic tests independent of which hero slices have landed. A World plays
// `heroFor(def, rules)`, so a registered Classic def replaces whatever stand-in a test passes, and
// a "hero with no Classic def yet" stops being one as soon as that hero is built. Tests that are
// about stand-ins (or about a hero with no Classic def) hide the registered heroes for their
// duration; every test gets the registry back as it found it.

let snapshot: Partial<Record<string, CharacterDef>> | null = null;
let extras: CharacterDef[] = [];

function restore(): void {
  if (!snapshot) return;
  for (const id of Object.keys(CLASSIC_CHARACTERS)) delete CLASSIC_CHARACTERS[id];
  Object.assign(CLASSIC_CHARACTERS, snapshot);
  CLASSIC_EXTRAS.splice(0, CLASSIC_EXTRAS.length, ...extras);
  snapshot = null;
}

/**
 * Snapshots the Classic registry before each test and puts it back after (whatever the test
 * registered or removed). With `hide`, each test starts with no Classic hero registered, as
 * before any hero slice (Classic-only extras stay). With `hideExtras`, each test starts with no
 * Classic-only extra built (tests that place their own stand-in extra, or count the roster).
 */
export function isolateClassicRegistry(opts: { hide?: boolean; hideExtras?: boolean } = {}): void {
  beforeEach(() => {
    snapshot = { ...CLASSIC_CHARACTERS };
    extras = [...CLASSIC_EXTRAS];
    if (opts.hide) hideClassicHeroes();
    if (opts.hideExtras) CLASSIC_EXTRAS.splice(0);
  });
  afterEach(restore);
}

/** Inside a test (with isolateClassicRegistry): no Classic hero def registered from here on. */
export function hideClassicHeroes(): void {
  for (const id of Object.keys(CLASSIC_CHARACTERS)) delete CLASSIC_CHARACTERS[id];
}

/** The Classic hero defs and extras that were registered when the test started (guard tests). */
export function builtClassicDefs(): CharacterDef[] {
  const heroes = Object.values(snapshot ?? CLASSIC_CHARACTERS).filter((d): d is CharacterDef => !!d);
  return [...heroes, ...(snapshot ? extras : CLASSIC_EXTRAS)];
}
