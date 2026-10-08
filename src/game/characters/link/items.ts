import type { HeroItemRules } from '../../items/rules';
import { has, setHas } from '../../items/flags';
import { LINK_SPELLS, MAX_BOMBS, MAX_HEARTS, MAX_MAGIC, maxHp } from './index';

/** Bombs the Bomb Bag comes with (it carries MAX_BOMBS). */
export const BAG_BOMBS = 4;

/**
 * Link's items (docs/POWERUPS.md 5.2). The Blue Ring is today's white tunic (`tunic`), the Magical
 * Sword today's red tunic's beam (`beam`); the bag and the spells have their own flags.
 */
export const LINK_ITEMS: HeroItemRules = {
  small: (p) => maxHp(p) <= 6,
  owned(p, id) {
    switch (id) {
      case 'heart-container':
        return maxHp(p) >= MAX_HEARTS * 2;
      case 'blue-ring':
        return !!p.scratch.tunic;
      case 'magical-sword':
        return !!p.scratch.beam;
      default:
        return has(p, id);
    }
  },
  give(p, id) {
    switch (id) {
      case 'heart-container':
        p.scratch.maxHp = Math.min(MAX_HEARTS * 2, maxHp(p) + 2);
        break;
      case 'blue-ring':
        p.scratch.tunic = 1;
        break;
      case 'magical-sword':
        p.scratch.beam = 1;
        break;
      case 'bomb-bag':
        setHas(p, id);
        p.scratch.bombs = Math.max(p.scratch.bombs ?? 0, BAG_BOMBS);
        break;
      default:
        // A spell: the magic meter shows from the first one, full.
        if (!LINK_SPELLS.some((s) => has(p, s))) p.scratch.magic = MAX_MAGIC;
        setHas(p, id);
    }
    p.hp = maxHp(p);
  },
  refill(p, id) {
    p.hp = maxHp(p);
    p.scratch.magic = MAX_MAGIC;
    if (id !== 'heart-container' && has(p, 'bomb-bag')) p.scratch.bombs = MAX_BOMBS;
  },
  refillSfx: 'pickup',
};
