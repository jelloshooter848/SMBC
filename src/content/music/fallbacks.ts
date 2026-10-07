import { songs } from './songs';

/**
 * Songs named before they are written (the SMB3 music of 0.5.0) and what plays until they land.
 * Once a song exists it plays itself; these entries can then go.
 */
export const SONG_FALLBACKS: Readonly<Record<string, string>> = {
  'smb3-boss': 'castle',
  airship: 'castle',
  'toad-house': 'map',
  'bonus-game': 'map',
};

/** `id` when the song exists, else its fallback (else `id`, which the audio skips with a warning). */
export function resolveSong(id: string): string {
  if (songs.some((s) => s.id === id)) return id;
  return SONG_FALLBACKS[id] ?? id;
}
