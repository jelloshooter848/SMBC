import type { CharacterGuide } from '../character';

/** Shared by Mario and Luigi; `name` only changes the tagline. */
export function plumberGuide(name: string, note: string): CharacterGuide {
  return {
    tagline: `${name}: ${note}`,
    controls: [
      { action: 'left/right', does: 'Walk. Speed builds up, and he skids when you turn.' },
      { action: 'attack (hold)', does: 'Run. A running jump goes higher and further.' },
      { action: 'jump', does: 'Jump. Hold it to go higher, let go to drop sooner.' },
      { action: 'down', does: 'Crouch when big. Slide down a pipe that leads somewhere.' },
      { action: 'attack', does: 'Throw a fireball when you have the flower. Two on screen.' },
    ],
    powerups: [
      { item: 'mushroom', does: 'Grow big: take one hit without dying and break bricks with your head.' },
      { item: 'flower', does: 'Fire power: bouncing fireballs that kill most enemies.' },
      { item: 'star', does: 'Invincible for a few seconds. Touching enemies kills them.' },
      { item: 'drops', does: 'None. Stomp enemies in a row without landing for bigger scores.' },
    ],
    tips: [
      'Stomping a koopa leaves a shell. Kick it into a line of enemies.',
      'Hidden blocks hold 1-ups. Jump under suspicious gaps.',
    ],
    demo: ['idle', 'walk', 'jump', 'attack', 'crouch'],
  };
}
