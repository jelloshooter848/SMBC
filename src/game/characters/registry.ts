import type { CharacterDef } from './character';
import { MARIO } from './mario';
import { LINK } from './link';
import { MEGAMAN } from './megaman';

/** Playable characters in select-screen order. */
export const CHARACTERS: CharacterDef[] = [MARIO, LINK, MEGAMAN];

export function characterById(id: string): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? MARIO;
}
