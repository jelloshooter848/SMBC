import type { HeroItemRules } from '../../items/rules';
import { has, setHas } from '../../items/flags';
import { MAX_HITS, START_HITS, unlocked } from './index';

const maxHits = (p: Parameters<HeroItemRules['small']>[0]): number => p.scratch.maxHp ?? START_HITS;

/** Bill's items (docs/POWERUPS.md 5.7): Medals raise his hits (`maxHp`); each gun has its own flag. */
export const BILL_ITEMS: HeroItemRules = {
  small: (p) => maxHits(p) <= START_HITS,
  owned: (p, id) => (id === 'medal' ? maxHits(p) >= MAX_HITS : has(p, id)),
  give(p, id) {
    if (id === 'medal') p.scratch.maxHp = Math.min(MAX_HITS, maxHits(p) + 1);
    else {
      setHas(p, id);
      // A new gun becomes the selected one, as today.
      p.scratch.tool = Math.max(
        0,
        unlocked(p).findIndex((g) => g.item === id),
      );
    }
    p.hp = maxHits(p);
  },
  refill(p) {
    p.hp = maxHits(p);
  },
  refillSfx: 'pickup',
};
