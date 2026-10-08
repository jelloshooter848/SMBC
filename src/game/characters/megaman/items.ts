import type { HeroItemRules } from '../../items/rules';
import { has, setHas } from '../../items/flags';
import { MAX_HP, setEnergy } from './index';
import { RUSH, WEAPON_ENERGY, WEAPONS } from './weapons';

function fill(p: Parameters<HeroItemRules['give']>[0]): void {
  p.hp = MAX_HP;
  for (const w of WEAPONS) setEnergy(p, w.id, WEAPON_ENERGY);
  setEnergy(p, RUSH.id, WEAPON_ENERGY);
}

/** Mega Man's items (docs/POWERUPS.md 5.3): the helmet (`helmet`), and one flag per weapon and Rush. */
export const MEGAMAN_ITEMS: HeroItemRules = {
  small: (p) => !p.scratch.helmet,
  owned: (p, id) => (id === 'helmet' ? !!p.scratch.helmet : has(p, id)),
  give(p, id) {
    if (id === 'helmet') p.scratch.helmet = 1;
    else setHas(p, id);
    p.hp = MAX_HP;
  },
  refill: (p) => fill(p),
  refillSfx: 'boss-fill',
};
