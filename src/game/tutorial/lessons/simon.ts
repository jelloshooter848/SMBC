import { SUB_WEAPONS } from '../../characters/simon/weapons';
import { type HeroTraining, k, legacyLesson, setKit } from './common';

/* Simon's training (docs/HEROES.md): the chapters of lessons, in the order the room plays them. */

const SIMON_SUB_PROMPTS: Record<string, string> = {
  dagger: '[THROW:special] HURLS A SUB-WEAPON: THE DAGGER FLIES FAST AND STRAIGHT.',
  'hand-axe': '[TOOLS:select] TO THE AXE. [THROW:special] LOBS IT HIGH OVER WALLS.',
  'holy-water': '[TOOLS:select] TO THE HOLY WATER. [THROW:special]: IT BURNS ON THE FLOOR.',
  cross: '[TOOLS:select] TO THE CROSS. [THROW:special]: IT SPINS OUT AND COMES BACK.',
  stopwatch: '[TOOLS:select] TO THE STOPWATCH. [THROW:special] FREEZES THE DUMMY: 5 HEARTS.',
};

export const SIMON_TRAINING: HeroTraining = {
  // The old whole-kit room (devKit) until its lessons place their items (0.4.34).
  fullKit: true,
  chapters: [
    {
      id: 'whip',
      title: 'WHIP',
      room: 'practice',
      lessons: [
        legacyLesson(
          'whip',
          'CRACK THE [WHIP:attack] AT THE DUMMY. IT WINDS UP, SO SWING EARLY!',
          (t) => t.dummyHits.has('melee'),
          undefined,
          setKit({ whip: 0 }),
        ),
        legacyLesson(
          'crouch-whip',
          'HOLD DOWN TO CROUCH, AND [WHIP:attack] LOW.',
          (t) => t.crouchAttacks > 0,
        ),
        legacyLesson(
          'committed-jump',
          "SIMON'S [JUMP:jump] IS COMMITTED: NO STEERING IN THE AIR. JUMP THE GAP!",
          (t) => t.gapCrossings > 0,
        ),
      ],
    },
    {
      id: 'subs',
      title: 'SUB-WEAPONS',
      room: 'practice',
      lessons: [
        ...SUB_WEAPONS.map((w, i) =>
          legacyLesson(
            w.id,
            SIMON_SUB_PROMPTS[w.id] ?? '',
            w.spec ? (t) => t.shotKinds.has(w.id) : (t) => t.toolUses.has(w.id),
            (run) => k(run, 'subs') > i,
          ),
        ),
        legacyLesson(
          'hearts',
          'SUB-WEAPONS COST HEARTS. YOU HAVE 3: [THROW:special] UNTIL THEY RUN OUT.',
          (t) => t.now.hearts === 0,
          (run) => k(run, 'subs') > 0,
          setKit({ hearts: 3, tool: 0 }),
        ),
      ],
    },
    {
      id: 'upgrades',
      title: 'UPGRADES',
      room: 'practice',
      lessons: [
        legacyLesson(
          'chain-whip',
          'THE CHAIN WHIP REACHES FURTHER. [WHIP:attack] THE DUMMY WITH IT.',
          (t) => t.dummyHits.has('melee'),
          (run) => k(run, 'whip') >= 1,
          setKit({ whip: 1 }),
        ),
        legacyLesson(
          'morning-star',
          'THE MORNING STAR REACHES FURTHEST. [WHIP:attack] THE DUMMY WITH IT.',
          (t) => t.dummyHits.has('melee'),
          (run) => k(run, 'whip') >= 2,
          setKit({ whip: 2 }),
        ),
        legacyLesson(
          'double-shot',
          'DOUBLE SHOT: TWO SUB-WEAPONS AT ONCE. [THROW:special] TWO AXES, QUICKLY!',
          (t) => t.maxShotsOut >= 2,
          (run) => k(run, 'multi') >= 2,
          // The axe: its long arc leaves time for a second throw.
          setKit({ multi: 2, tool: 1 }),
        ),
      ],
    },
  ],
};
