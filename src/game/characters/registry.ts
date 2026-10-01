import type { CharacterDef } from './character';
import { MARIO } from './mario';

/** Playable characters in select-screen order. Crossover characters register here in phase 3. */
export const CHARACTERS: CharacterDef[] = [MARIO];

export function characterById(id: string): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? MARIO;
}
