import type { HeroItemRules } from '../../items/rules';
import { has, setHas } from '../../items/flags';
import { MAX_HP, MAX_NINPO, NINPO_PER_FLOWER, SMALL_HP, maxHp, ninpoMax } from './index';

/** Ninpo Scrolls that raise the meter (40 → 99); more are refills. */
export const MAX_SCROLLS = 3;

/**
 * Ryu's items (docs/POWERUPS.md 5.6): Medicine grows the bar (`maxHp`), each Ninpo Scroll adds 20
 * to the meter (`scrolls` counts them, `ninpoMax`), and each art has its own flag.
 */
export const RYU_ITEMS: HeroItemRules = {
  small: (p) => maxHp(p) < MAX_HP,
  owned(p, id) {
    if (id === 'medicine') return maxHp(p) >= MAX_HP;
    if (id === 'ninpo-scroll') return (p.scratch.scrolls ?? 0) >= MAX_SCROLLS;
    return has(p, id);
  },
  give(p, id) {
    if (id === 'medicine') p.scratch.maxHp = MAX_HP;
    else if (id === 'ninpo-scroll') {
      p.scratch.scrolls = (p.scratch.scrolls ?? 0) + 1;
      p.scratch.ninpoMax = Math.min(MAX_NINPO, ninpoMax(p) + NINPO_PER_FLOWER);
    } else setHas(p, id);
    p.scratch.ninpo = ninpoMax(p);
    p.hp = maxHp(p);
  },
  refill(p) {
    p.scratch.ninpo = ninpoMax(p);
    p.hp = maxHp(p);
  },
  refillSfx: 'pickup',
  start: { hp: SMALL_HP, kit: { maxHp: SMALL_HP } },
};
