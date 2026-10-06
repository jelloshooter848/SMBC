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
  /** Run without attacking (the touch pad's outer ring). Running = held('attack') || held('run'). */
  'run',
] as const;
export type Action = (typeof Actions)[number];

export const ActionLabels: Record<Action, string> = {
  left: 'Left',
  right: 'Right',
  up: 'Up',
  down: 'Down',
  jump: 'Jump (A)',
  attack: 'Attack / Run (B)',
  special: 'Special',
  start: 'Start / Pause',
  select: 'Select',
  run: 'Run',
};
