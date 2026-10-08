import { type HeroTraining, itemLesson, lesson, type PracticeRoom, setKit } from './common';

/*
 * Simon's training (docs/HEROES.md): the chapters of lessons, in the order the room plays them.
 * He starts from his basic kit (the leather whip, 5 hearts, a 10-point health bar) and finds his
 * items in the order the campaign places them (docs/POWERUPS.md 6.2): the Pot Roast first, then
 * the Chain Whip, the Dagger, the Holy Water, the Axe, the Morning Star, the Cross, the Double
 * Shot, the Stopwatch and the Triple Shot. Touch prompts name the sub-weapon as THROW's button
 * shows it (DAGGER, AXE, WATER, CROSS, WATCH).
 */

/** The Pot Roast's health bar (characters/simon MAX_HP; small Simon has 10). */
export const SIMON_BIG_HP = 16;

/** At least `n` hearts (sub-weapon ammo) for the lesson: the stopwatch alone costs 5. */
const heartsAtLeast =
  (n: number) =>
  (room: PracticeRoom): void => {
    const s = room.player.scratch;
    s.hearts = Math.max(s.hearts ?? 0, n);
  };

/** Picks sub-weapon `id` on the belt (its index among the ones he has) and tops up the hearts. */
const holdSub =
  (id: string) =>
  (room: PracticeRoom): void => {
    heartsAtLeast(10)(room);
    const belt = room.player.def.tools?.(room.player) ?? [];
    const i = belt.findIndex((t) => t.id === id);
    if (i >= 0) room.player.scratch.tool = i;
  };

export const SIMON_TRAINING: HeroTraining = {
  chapters: [
    {
      id: 'whip',
      title: 'WHIP',
      room: 'practice',
      lessons: [
        lesson('whip', 'CRACK THE [WHIP:attack] AT THE DUMMY. IT WINDS UP, SO SWING EARLY!', (t) =>
          t.dummyHits.has('melee'),
        ),
        lesson('crouch-whip', 'HOLD DOWN TO CROUCH, AND [WHIP:attack] LOW.', (t) => t.crouchAttacks > 0),
        lesson(
          'committed-jump',
          "SIMON'S [JUMP:jump] IS COMMITTED: NO STEERING IN THE AIR. JUMP THE GAP!",
          (t) => t.gapCrossings > 0,
        ),
      ],
    },
    {
      id: 'items',
      title: 'POWER-UPS',
      room: 'practice',
      lessons: [
        // A chapter starts with the hero at the start, so the item lies to the right.
        itemLesson(
          'pot-roast',
          'pot-roast',
          'WALK RIGHT TO THE POT ROAST: YOUR HEALTH BAR GROWS FROM 10 TO 16.',
          (t) => (t.now.maxHp ?? 0) >= SIMON_BIG_HP,
        ),
        itemLesson(
          'chain-whip',
          'chain-whip',
          'GRAB THE CHAIN WHIP: IT REACHES FURTHER. [WHIP:attack] THE DUMMY WITH IT.',
          (t) => t.dummyHits.has('melee'),
        ),
        itemLesson(
          'dagger',
          'dagger',
          'GRAB THE DAGGER. [THROW:special:DAGGER] HURLS IT FAST AND STRAIGHT.',
          (t) => t.shotKinds.has('dagger'),
          { setup: heartsAtLeast(10) },
        ),
        lesson(
          'hearts',
          'SUB-WEAPONS COST HEARTS. YOU HAVE 3: [THROW:special:DAGGER] UNTIL THEY RUN OUT.',
          (t) => t.now.hearts === 0,
          { setup: setKit({ hearts: 3, tool: 0 }), spends: true },
        ),
        itemLesson(
          'holy-water',
          'holy-water',
          'GRAB THE HOLY WATER. [TOOLS:select] TO IT, THEN [THROW:special:WATER]: IT BURNS.',
          (t) => t.shotKinds.has('holy-water'),
          { setup: heartsAtLeast(10) },
        ),
        itemLesson(
          'hand-axe',
          'axe',
          'GRAB THE AXE. [TOOLS:select] TO IT. [THROW:special:AXE] LOBS IT HIGH OVER WALLS.',
          (t) => t.shotKinds.has('hand-axe'),
          { setup: heartsAtLeast(10) },
        ),
      ],
    },
    {
      id: 'more',
      title: 'MORE POWER-UPS',
      room: 'practice',
      lessons: [
        itemLesson(
          'morning-star',
          'morning-star',
          'THE MORNING STAR REACHES FURTHEST. GRAB IT AND [WHIP:attack] THE DUMMY.',
          (t) => t.dummyHits.has('melee'),
        ),
        itemLesson(
          'cross',
          'cross',
          'GRAB THE CROSS. [TOOLS:select] TO IT. [THROW:special:CROSS]: IT SPINS OUT AND BACK.',
          (t) => t.shotKinds.has('cross'),
          { setup: heartsAtLeast(10) },
        ),
        itemLesson(
          'double-shot',
          'double-shot',
          'DOUBLE SHOT: TWO AT ONCE. GRAB IT, THEN [THROW:special:AXE] TWO AXES, QUICKLY!',
          (t) => t.maxShotsOut >= 2,
          // The axe: its long arc leaves time for a second throw.
          { setup: holdSub('hand-axe') },
        ),
        itemLesson(
          'stopwatch',
          'stopwatch',
          'GRAB THE STOPWATCH. [TOOLS:select] TO IT. [THROW:special:WATCH] FREEZES THE DUMMY.',
          (t) => t.toolUses.has('stopwatch'),
          { setup: heartsAtLeast(10) },
        ),
        itemLesson(
          'triple-shot',
          'triple-shot',
          'TRIPLE SHOT: THREE AT ONCE. GRAB IT, THEN [THROW:special:AXE] THREE AXES!',
          (t) => t.maxShotsOut >= 3,
          { setup: holdSub('hand-axe') },
        ),
      ],
    },
  ],
};
