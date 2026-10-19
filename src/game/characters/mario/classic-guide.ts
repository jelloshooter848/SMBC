import type { CharacterGuide } from '../character';

/** Classic SMBC's "How to play" page for Mario and Luigi (TG-22); `note` is the tagline. */
export function plumberClassicGuide(name: string, note: string): CharacterGuide {
  return {
    tagline: `${name}: ${note}`,
    controls: [
      {
        action: 'left/right',
        does: 'Walk. Speed builds up and runs down slowly; turning skids. No turning in mid-air.',
        touchDoes: 'Walk. Push far to run. No turning in mid-air.',
      },
      {
        action: 'attack (hold)',
        touch: 'RUN',
        does: 'Run. Running jumps go higher. Holding it in mid-air speeds you up too.',
      },
      { action: 'jump', does: 'Jump. Rise while held, up to a set height; let go to stop rising.' },
      { action: 'down', does: 'Crouch when big. Jump while crouched to stay crouched in the air.' },
      {
        action: 'attack',
        touch: 'FIRE',
        does: 'With the flower: throw a fireball the way you face, two at a time.',
      },
    ],
    powerups: [
      { item: 'mushroom', does: 'Grow big: break bricks with your head. Already big: fire power.' },
      { item: 'flower', does: 'One step up: big, then fire power. Any hit makes you small again.' },
      { item: 'star', does: 'Invincible for twelve seconds. Touching enemies defeats them.' },
      { item: 'drops', does: 'None. Stomp enemies in a row without landing for bigger scores.' },
    ],
    tips: [
      'A stomp bounces you only a little, whether jump is held or not.',
      'Under water every jump is a swim stroke, and stomping does not work.',
    ],
    demo: ['idle', 'walk', 'jump', 'attack', 'crouch'],
  };
}
