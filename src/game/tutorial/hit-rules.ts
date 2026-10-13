/*
 * What a hit takes, per hero (0.4.46, roadmap #21): the words of each training stage's WHAT A HIT
 * TAKES lesson, read after the hero walks into its thorns (heroes/common.ts hitLessons). Each is the
 * hero's real rule in the code (their behaviour's onHurt; a death wipes the found kit: LevelScene's
 * `died`, Game.resetAfterDeath) and is written out in docs/POWERUPS.md section 7, which
 * tests/sim/hit-rules.test.ts holds them to.
 */

export interface HitRule {
  /** What the hit took, said after it (a training tip: at most three lines). */
  tip: string;
}

export const HIT_RULES: Readonly<Record<string, HitRule>> = {
  mario: { tip: 'FIRE OR BIG, A HIT MAKES YOU SMALL. A HIT WHILE SMALL COSTS A LIFE.' },
  luigi: { tip: 'FIRE OR BIG, A HIT MAKES YOU SMALL. A HIT WHILE SMALL COSTS A LIFE.' },
  link: { tip: 'A HIT COSTS HALF A HEART; THE RING SKIPS EVERY OTHER. ONLY A DEATH TAKES ITEMS.' },
  megaman: { tip: 'THE HIT TOOK THE HELMET: NO CHARGE SHOT. WEAPONS STAY; A DEATH TAKES ALL.' },
  samus: { tip: 'A HIT COSTS 8 ENERGY, 4 IN THE VARIA SUIT. YOU KEEP ITEMS TILL A DEATH.' },
  simon: { tip: 'A HIT COSTS 2 HEALTH. WHIPS AND SUB-WEAPONS STAY; ONLY A DEATH TAKES THEM.' },
  ryu: { tip: 'A HIT COSTS 2 HEALTH. YOUR ARTS AND SCROLLS STAY; ONLY A DEATH TAKES THEM.' },
  bill: { tip: 'A HIT COSTS ONE HIT POINT. YOUR GUNS STAY; ONLY A DEATH TAKES THEM.' },
  sophia: { tip: 'A HIT DROPS YOU TO NORMAL, CLIMBS LOST, MISSILES KEPT. HIT AT NORMAL: DESTROYED.' },
};

/** The thorns' tip, before the hit: the same for every hero. */
export const HIT_TASK = "WHAT A HIT TAKES: THE THORNS WON'T BEAT YOU. WALK INTO THEM.";
