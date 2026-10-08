import type { HeroItemRules } from '../../items/rules';
import { has, setHas } from '../../items/flags';
import { MAX_HEARTS, MAX_HP, SMALL_HP, hearts, maxHp } from './index';

/** Hearts (sub-weapon ammo) an owned item gives. */
const REFILL_HEARTS = 10;

/** Simon's items (docs/POWERUPS.md 5.5): the Pot Roast grows the bar (`maxHp`); the rest are flags. */
export const SIMON_ITEMS: HeroItemRules = {
  small: (p) => maxHp(p) < MAX_HP,
  owned: (p, id) => (id === 'pot-roast' ? maxHp(p) >= MAX_HP : has(p, id)),
  give(p, id) {
    if (id === 'pot-roast') p.scratch.maxHp = MAX_HP;
    else setHas(p, id);
    p.hp = maxHp(p);
  },
  refill(p, id) {
    p.hp = maxHp(p);
    if (id !== 'pot-roast') p.scratch.hearts = Math.min(MAX_HEARTS, hearts(p) + REFILL_HEARTS);
  },
  refillSfx: 'pickup',
  start: { hp: SMALL_HP, kit: { maxHp: SMALL_HP } },
};
