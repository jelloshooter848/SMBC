import type { HeroStage } from '../hero-stage';
import { LUIGI_STAGE_DEF } from './luigi';

/*
 * The heroes' training stages (0.4.37, tutorial/hero-stage.ts), one file each. Simon, Ryu, Bill
 * and Sophia III keep the practice room (room.ts) until theirs come (0.4.38).
 */
export const HERO_STAGES: Readonly<Record<string, HeroStage>> = {
  luigi: LUIGI_STAGE_DEF,
};

/** The hero's training stage, or null (Mario's is 1-0; the room's heroes have none yet). */
export function heroStage(id: string): HeroStage | null {
  return HERO_STAGES[id] ?? null;
}
