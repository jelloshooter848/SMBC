import type { HeroStage } from '../hero-stage';
import { LUIGI_STAGE_DEF } from './luigi';
import { LINK_STAGE_DEF } from './link';
import { MEGAMAN_STAGE_DEF } from './megaman';
import { SAMUS_STAGE_DEF } from './samus';
import { SIMON_STAGE_DEF } from './simon';
import { RYU_STAGE_DEF } from './ryu';
import { BILL_STAGE_DEF } from './bill';
import { SOPHIA_STAGE_DEF } from './sophia';

/*
 * The heroes' training stages (0.4.37, tutorial/hero-stage.ts), one file each. Simon, Ryu, Bill
 * and Sophia III keep the practice room (room.ts) until theirs come (0.4.38).
 */
export const HERO_STAGES: Readonly<Record<string, HeroStage>> = {
  luigi: LUIGI_STAGE_DEF,
  link: LINK_STAGE_DEF,
  megaman: MEGAMAN_STAGE_DEF,
  samus: SAMUS_STAGE_DEF,
  simon: SIMON_STAGE_DEF,
  ryu: RYU_STAGE_DEF,
  bill: BILL_STAGE_DEF,
  sophia: SOPHIA_STAGE_DEF,
};

/** The hero's training stage, or null (Mario's is 1-0; the room's heroes have none yet). */
export function heroStage(id: string): HeroStage | null {
  return HERO_STAGES[id] ?? null;
}
