import { songs } from '@content/music/songs';
import { sfx } from '@content/sfx/sfx';

/**
 * The Shadow Keep's music and sounds, by id: the dungeon loop, the keeper's loop, the secret
 * chime, the sword stab, a door opening and the key fanfare.
 *
 * FALLBACK (temporary, removable): until those tracks and sounds are in songs.ts / sfx.ts, the
 * nearest existing ones play instead. Once they are merged every id resolves to itself and this
 * table can be deleted (keepMusic / keepSfx then just return their argument).
 */
export const AUDIO_FALLBACK: Readonly<Record<string, string>> = {
  dungeon: 'underground',
  keeper: 'castle',
  secret: 'powerup-appear',
  'sword-stab': 'sword',
  'door-open': 'pipe',
  'key-get': 'coin',
};

const SONG_IDS = new Set(songs.map((s) => s.id));
const SFX_IDS = new Set(sfx.map((s) => s.id));

export function keepMusic(id: string): string {
  return SONG_IDS.has(id) ? id : (AUDIO_FALLBACK[id] ?? id);
}

export function keepSfx(id: string): string {
  return SFX_IDS.has(id) ? id : (AUDIO_FALLBACK[id] ?? id);
}
