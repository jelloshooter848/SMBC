import { startHp } from '../characters/character';
import type { Player } from '../entities/player';
import { heroItems, itemInfo } from '../items/catalog';
import { itemRules } from '../items/heroes';

/*
 * A hero's power-ups as the hero stages hand them out (0.4.37): owned or not, given quietly (Skip
 * this lesson, START AT, the kit floor at a put-back), and their names. Mario and Luigi's are SMB's
 * own (their power state); every other hero's are their items (items/heroes.ts).
 */

/**
 * Power items that stack, owned for a stage once the hero has one (their rules count them owned
 * only at the most): Ryu's Ninpo Scroll.
 */
const STACKED: Readonly<Record<string, (p: Player) => boolean>> = {
  'ninpo-scroll': (p) => (p.scratch.scrolls ?? 0) > 0,
};

/**
 * The hero has power-up `id` (Mario and Luigi: their power state). An item that stacks (Link's
 * Heart Container, Samus's Energy Tank, Ryu's Ninpo Scroll) counts once the hero has one.
 */
export function ownsItem(p: Player, id: string): boolean {
  const rules = itemRules(p.def.id);
  const stacked = STACKED[id];
  if (rules && stacked) return stacked(p);
  if (rules) return id === heroItems(p.def.id)?.grow ? !rules.small(p) : rules.owned(p, id);
  if (id === 'mushroom') return p.powerState !== 'small';
  if (id === 'fire-flower') return p.powerState === 'fire';
  return false;
}

/** Power-up `id` for the hero without a sound, a caption or a score (nothing when owned). */
export function giveQuietly(p: Player, id: string): void {
  if (ownsItem(p, id)) return;
  const rules = itemRules(p.def.id);
  if (rules) {
    rules.give(p, id);
    // No grow flicker either (Sophia III's hull: her power state).
    p.transition = null;
    p.refitHitbox();
    return;
  }
  if (id === 'mushroom' && p.powerState === 'small') p.powerState = 'big';
  else if (id === 'fire-flower') p.powerState = 'fire';
  p.refitHitbox();
}

/** The name an item shows by ("Blue Ring", SMB's "Super Mushroom"). */
export function itemName(hero: string, id: string): string {
  return itemInfo(hero, id)?.name ?? id;
}

/** The most hit points the hero holds now (Link's hearts, Samus's bar and tanks, a 28 bar). */
export function fullHp(p: Player): number {
  return p.scratch.maxHp ?? startHp(p.def);
}

/** Health back to full, quietly (a hit-point hero; a power-up hero keeps their power). */
export function refillHealth(p: Player): void {
  if (p.def.damage.kind !== 'hp' || p.dead) return;
  const full = fullHp(p);
  if (p.hp < full) p.hp = full;
}

/**
 * Scratch keys of a move or spell in progress, left behind when the stage is rebuilt (a put-back,
 * a respawn) or the hero goes on to a new room: the rest of the kit comes along. Samus's morph
 * ball and aim, Link's running spells and his ring's count, a charging shot or a throw under way.
 */
export const TRANSIENT_KIT = [
  'ball',
  'aimUp',
  'jumpSpell',
  'shieldSpell',
  'fireSpell',
  'chargeT',
  'throwT',
  'spin',
  'autoT',
  'halfHit',
] as const;
