import type { MiniGameDef } from './types';
import { LUIGI_MINIGAME } from './luigi';

export type { MiniGameDef, MiniGameResult } from './types';

/** Every hero's freeing mini game, by CharacterDef id (Mario starts free and has none). */
export const MINIGAMES: Readonly<Record<string, MiniGameDef>> = {
  luigi: LUIGI_MINIGAME,
};

export function miniGameFor(hero: string): MiniGameDef | null {
  return MINIGAMES[hero] ?? null;
}
