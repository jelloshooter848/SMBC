export const Actions = [
  'left',
  'right',
  'up',
  'down',
  'jump',
  'attack',
  'special',
  'start',
  'select',
] as const;
export type Action = (typeof Actions)[number];

export const ActionLabels: Record<Action, string> = {
  left: 'Left',
  right: 'Right',
  up: 'Up',
  down: 'Down',
  jump: 'Jump (A)',
  attack: 'Run / Attack (B)',
  special: 'Special',
  start: 'Start / Pause',
  select: 'Select',
};
