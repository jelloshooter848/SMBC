import { WEAPONS } from '../characters/megaman/weapons';
import { SUB_WEAPONS } from '../characters/simon/weapons';
import { NINPO_ARTS } from '../characters/ryu/weapons';
import { GUNS } from '../characters/bill/weapons';
import { FOUND, hasKey } from './flags';

/** Ninpo the meter starts with, and each Ninpo Scroll adds (ryu/index.ts START_NINPO, NINPO_PER_FLOWER). */
const START_NINPO = 40;
const PER_SCROLL = 20;
const MAX_SCROLLS = 3;
const MAX_RESERVE_TANKS = 6;

/**
 * A campaign kit saved before 0.4.33 (no `found`), converted to the found-item rules
 * (docs/POWERUPS.md 8.3): today's tier keys become one flag per item in their old order, so the hero
 * keeps everything they had. Link keeps the five tools he has today; Samus's two 30-energy tanks
 * become six 10-energy reserve tanks (the same energy); Mega Man's helmet keeps Rush; a Crusher
 * Sophia keeps both climbs. A kit that already has `found` comes back as it is.
 */
export function campaignKit(
  hero: string,
  old: Readonly<Record<string, number>>,
  powerState = '',
): Record<string, number> {
  if (old[FOUND]) return { ...old };
  const kit: Record<string, number> = { ...old, [FOUND]: 1 };
  const give = (id: string): void => {
    kit[hasKey(id)] = 1;
  };
  const take = (key: string): number => {
    const v = kit[key] ?? 0;
    delete kit[key];
    return v;
  };
  switch (hero) {
    case 'link':
      for (const id of ['bomb-bag', 'shield-spell', 'jump-spell', 'fire-spell']) give(id);
      break;
    case 'megaman':
      for (const w of WEAPONS.slice(0, take('weapons'))) give(w.item);
      if (kit.helmet) give('rush-coil');
      break;
    case 'samus': {
      const beam = take('beam');
      if (beam >= 1) give('long-beam');
      if (beam >= 2) give('ice-beam');
      if (beam >= 3) give('wave-beam');
      if ((kit.missiles ?? 0) > 0) give('missiles');
      if (kit.tanks) kit.tanks = Math.min(MAX_RESERVE_TANKS, kit.tanks * 3);
      break;
    }
    case 'simon': {
      const whip = take('whip');
      if (whip >= 1) give('chain-whip');
      if (whip >= 2) give('morning-star');
      const multi = take('multi');
      if (multi >= 2) give('double-shot');
      if (multi >= 3) give('triple-shot');
      for (const s of SUB_WEAPONS.slice(0, take('subs'))) give(s.item);
      break;
    }
    case 'ryu': {
      for (const a of NINPO_ARTS.slice(0, take('arts'))) give(a.item);
      const scrolls = Math.round(((kit.ninpoMax ?? START_NINPO) - START_NINPO) / PER_SCROLL);
      if (scrolls > 0) kit.scrolls = Math.min(MAX_SCROLLS, scrolls);
      break;
    }
    case 'bill':
      for (const g of GUNS.slice(1, 1 + take('guns'))) give(g.item);
      break;
    case 'sophia':
      if (powerState === 'fire') {
        give('wall-climb');
        give('ceiling-climb');
      }
      break;
  }
  return kit;
}
