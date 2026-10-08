import type { HeroItemRules } from '../../items/rules';
import { has, setHas } from '../../items/flags';
import {
  HOMING_MAX,
  HOMING_REPEAT,
  HOMING_START,
  HOVER_CELLS,
  TRIPLE_MAX,
  TRIPLE_REPEAT,
  TRIPLE_START,
} from './profile';
import { sophiaState } from './state';

/**
 * Sophia III's items (docs/POWERUPS.md 5.8): the Power Capsule and the Crusher are her power
 * states (Hyper `big`, Crusher `fire`), the missiles today's `hasTriple` / `hasHoming`, and the
 * climbs their own flags (a hit to Normal takes them).
 */
export const SOPHIA_ITEMS: HeroItemRules = {
  small: (p) => p.powerState === 'small',
  owned(p, id) {
    switch (id) {
      case 'power-capsule':
        return p.powerState !== 'small';
      case 'crusher':
        return p.powerState === 'fire';
      case 'triple-missile':
        return !!p.scratch.hasTriple;
      case 'homing-missile':
        return !!p.scratch.hasHoming;
      default:
        return has(p, id);
    }
  },
  give(p, id) {
    switch (id) {
      case 'power-capsule':
        p.powerState = 'big';
        sophiaState(p).cells = HOVER_CELLS;
        p.startTransition('grow');
        break;
      case 'crusher':
        p.powerState = 'fire';
        p.startTransition('grow');
        break;
      case 'triple-missile':
        p.scratch.hasTriple = 1;
        p.scratch.triple = Math.max(p.scratch.triple ?? 0, TRIPLE_START);
        break;
      case 'homing-missile':
        p.scratch.hasHoming = 1;
        p.scratch.homing = Math.max(p.scratch.homing ?? 0, HOMING_START);
        break;
      default:
        setHas(p, id);
    }
  },
  refill(p, id) {
    sophiaState(p).cells = HOVER_CELLS;
    if (id === 'power-capsule') return;
    if (p.scratch.hasTriple) p.scratch.triple = Math.min(TRIPLE_MAX, (p.scratch.triple ?? 0) + TRIPLE_REPEAT);
    if (p.scratch.hasHoming) p.scratch.homing = Math.min(HOMING_MAX, (p.scratch.homing ?? 0) + HOMING_REPEAT);
  },
  refillSfx: 'sophia-pickup',
};
