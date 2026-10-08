import { NINPO_ARTS } from '../../characters/ryu/weapons';
import { type HeroTraining, k, legacyLesson } from './common';

/* Ryu's training (docs/HEROES.md): the chapters of lessons, in the order the room plays them. */

const RYU_ART_PROMPTS: Record<string, string> = {
  'throwing-star': '[NINPO:select] PICKS AN ART. [CAST:special] THE THROWING STAR. IT COSTS NINPO.',
  windmill: '[NINPO:select] TO THE WINDMILL. [CAST:special]: IT CUTS THROUGH AND RETURNS.',
  'fire-wheel': '[NINPO:select] TO THE FIRE WHEEL. [CAST:special]: FLAMES CIRCLE YOU.',
  slash: '[NINPO:select] TO JUMP AND SLASH. [CAST:special]: A SOMERSAULT THAT CUTS.',
};

export const RYU_TRAINING: HeroTraining = {
  // The old whole-kit room (devKit) until its lessons place their items (0.4.34).
  fullKit: true,
  chapters: [
    {
      id: 'sword',
      title: 'SWORD',
      room: 'practice',
      lessons: [
        legacyLesson('slash', '[SLASH:attack] THE DUMMY WITH YOUR SWORD.', (t) => t.dummyHits.has('melee')),
        legacyLesson('cling', '[JUMP:jump] AT THE TALL WALL AND HOLD TOWARD IT TO CLING.', (t) => t.clung),
        legacyLesson(
          'wall-jump',
          'WHILE CLINGING, [JUMP:jump] TO KICK OFF THE WALL.',
          (t) => t.wallJumps > 0,
        ),
      ],
    },
    {
      id: 'ninpo',
      title: 'NINPO',
      room: 'practice',
      lessons: NINPO_ARTS.map((a, i) => {
        const kind = a.spec?.kind;
        return legacyLesson(
          a.id === 'slash' ? 'jump-slash' : a.id,
          RYU_ART_PROMPTS[a.id] ?? '',
          kind ? (t) => t.shotKinds.has(kind) : (t) => t.seen.has('spin'),
          (run) => k(run, 'arts') > i,
        );
      }),
    },
  ],
};
