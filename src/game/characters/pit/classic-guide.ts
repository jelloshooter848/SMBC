import type { CharacterGuide } from '../character';
import { samusClassicGuide } from '../samus/classic-guide';

/**
 * Classic SMBC Pit's and Dark Pit's "How to play" page (PI-25, TG-22): Classic Samus's, with the
 * rows the six rule changes touch; `name` where the hero's name appears.
 */
export function pitClassicGuide(name: string): CharacterGuide {
  const samus = samusClassicGuide(name);
  const does: Partial<Record<string, string>> = {
    'left/right': "Walk at one steady speed, in the air too. You can't walk on the ground while aiming up.",
    up: 'Aim straight up. On the ground you stand still while aiming.',
    down: 'Crouch while you hold it. You can walk and jump while crouched, and fit one-tile gaps.',
    attack: 'Fire the beam, three shots at a time. Not while crouched.',
    special: 'Fire a missile once you have them, even while crouched. Missiles break armour.',
  };
  return {
    ...samus,
    tagline: `Samus's rules, ${name}'s moves. No morph ball.`,
    controls: samus.controls.map((c) => {
      const d = does[c.action];
      return d ? { ...c, does: d } : c;
    }),
    tips: [
      'No morph ball and no bombs.',
      'Standing shots fly low. Hold down in the air to tuck into the crouch.',
      'With the flower, a somersault defeats what it touches. Shooting ends it.',
    ],
    demo: ['idle', 'walk', 'jump', 'attack', 'crouch'],
  };
}
