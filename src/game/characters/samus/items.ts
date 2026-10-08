import type { HeroItemRules } from '../../items/rules';
import { has, setHas } from '../../items/flags';
import { MAX_MISSILES, MAX_RESERVE_TANKS, RESERVE_TANK_ENERGY, START_ENERGY, maxHp, missiles } from './index';

/** Missiles the launcher comes with, and each owned Missiles item adds. */
export const MISSILES_PER_ITEM = 10;

/**
 * Samus's items (docs/POWERUPS.md 5.4): Energy Tanks are reserve tanks (`tanks`, `maxHp`), the
 * Varia Suit is today's `varia`; the beams and the launcher have their own flags.
 */
export const SAMUS_ITEMS: HeroItemRules = {
  small: (p) => (p.scratch.tanks ?? 0) === 0,
  owned(p, id) {
    if (id === 'energy-tank') return (p.scratch.tanks ?? 0) >= MAX_RESERVE_TANKS;
    if (id === 'varia-suit') return !!p.scratch.varia;
    return has(p, id);
  },
  give(p, id) {
    switch (id) {
      case 'energy-tank': {
        const tanks = Math.min(MAX_RESERVE_TANKS, (p.scratch.tanks ?? 0) + 1);
        p.scratch.tanks = tanks;
        p.scratch.maxHp = START_ENERGY + RESERVE_TANK_ENERGY * tanks;
        break;
      }
      case 'varia-suit':
        p.scratch.varia = 1;
        break;
      case 'missiles':
        setHas(p, id);
        p.scratch.missiles = Math.min(MAX_MISSILES, missiles(p) + MISSILES_PER_ITEM);
        break;
      default:
        setHas(p, id);
    }
    p.hp = maxHp(p);
  },
  refill(p, id) {
    p.hp = maxHp(p);
    if (id !== 'energy-tank' && has(p, 'missiles'))
      p.scratch.missiles = Math.min(MAX_MISSILES, missiles(p) + MISSILES_PER_ITEM);
  },
  refillSfx: 'pickup',
};
