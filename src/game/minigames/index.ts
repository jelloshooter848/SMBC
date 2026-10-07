import type { MiniGameDef } from './types';
import { LUIGI_MINIGAME } from './luigi';
import { LINK_MINIGAME } from './link';
import { MEGAMAN_MINIGAME } from './megaman';
import { SAMUS_MINIGAME } from './samus';
import { SIMON_MINIGAME } from './simon';

export type { MiniGameDef, MiniGameResult } from './types';

/** Every hero's freeing mini game, by CharacterDef id (Mario starts free and has none). */
export const MINIGAMES: Readonly<Record<string, MiniGameDef>> = {
  luigi: LUIGI_MINIGAME,
  link: LINK_MINIGAME,
  megaman: MEGAMAN_MINIGAME,
  samus: SAMUS_MINIGAME,
  simon: SIMON_MINIGAME,
};

export function miniGameFor(hero: string): MiniGameDef | null {
  return MINIGAMES[hero] ?? null;
}
