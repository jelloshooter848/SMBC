/*
 * The heroes' own power-up items (docs/POWERUPS.md): pure data, no game code, so the map parser,
 * the save code and the panels can all read it. Each hero has one grow item (their mushroom) and a
 * list of power items (their fire flowers), placed block by block in the campaign through a level's
 * `[hero-items]` section. What an item does is the hero's own (characters/<hero>/items.ts).
 */

export type ItemKind = 'grow' | 'power';

export interface ItemInfo {
  /** The id `.map` files and save files use (`ice-beam`). */
  id: string;
  /** As the game shows it (upper-cased on screen). */
  name: string;
  /** One line the announcer reads after the name, and the panel shows ("it freezes what it hits"). */
  does: string;
  kind: ItemKind;
}

export interface HeroItems {
  /** The hero's grow item id (their mushroom). */
  grow: string;
  /** What a power block with no entry for this hero gives (the first power item they find). */
  defaultPower: string;
  /** Grow item first, then the power items in the hero's own game's order. */
  items: readonly ItemInfo[];
  /**
   * Blocks give hero items (HeroItem entities, which stay put) rather than SMB's mushroom and
   * flower; false for Mario and Luigi, whose items are SMB's own (the mushroom still slides).
   */
  ownItems: boolean;
}

const grow = (id: string, name: string, does: string): ItemInfo => ({ id, name, does, kind: 'grow' });
const power = (id: string, name: string, does: string): ItemInfo => ({ id, name, does, kind: 'power' });

const SMB: HeroItems = {
  grow: 'mushroom',
  defaultPower: 'fire-flower',
  ownItems: false,
  items: [
    grow('mushroom', 'Super Mushroom', 'you grow big and can take a hit'),
    power('fire-flower', 'Fire Flower', 'you throw fireballs'),
  ],
};

export const HERO_ITEMS: Readonly<Record<string, HeroItems>> = {
  mario: SMB,
  luigi: SMB,
  link: {
    grow: 'heart-container',
    defaultPower: 'bomb-bag',
    ownItems: true,
    items: [
      grow('heart-container', 'Heart Container', 'one more heart, and all hearts filled'),
      power('bomb-bag', 'Bomb Bag', 'bombs on your tool belt'),
      power('shield-spell', 'Shield Spell', 'a spell: every other hit costs no heart for a while'),
      power('jump-spell', 'Jump Spell', 'a spell: higher jumps for a while'),
      power('blue-ring', 'Blue Ring', 'every other hit costs no heart'),
      power('fire-spell', 'Fire Spell', 'a spell: your next sword swing fires a beam'),
      power('magical-sword', 'Magical Sword', 'your sword fires a beam while your hearts are full'),
    ],
  },
  megaman: {
    grow: 'helmet',
    defaultPower: 'saw-disc',
    ownItems: true,
    items: [
      grow('helmet', 'Helmet', 'the charge shot, and your head breaks bricks'),
      power('saw-disc', 'Saw Disc', 'a blade thrown eight ways that cuts bricks'),
      power('leaf-guard', 'Leaf Guard', 'leaves circle you and swat shots, then fly'),
      power('rush-coil', 'Rush Coil', 'Rush, a spring for high jumps'),
      power('flame-wave', 'Flame Wave', 'fire that runs along the floor and burns shells'),
      power('homing-knuckle', 'Homing Knuckle', 'a slow fist that seeks out enemies'),
      power('bolt', 'Bolt', 'a beam right across the screen'),
    ],
  },
  samus: {
    grow: 'energy-tank',
    defaultPower: 'missiles',
    ownItems: true,
    items: [
      grow('energy-tank', 'Energy Tank', 'one more reserve tank, and full energy'),
      power('missiles', 'Missiles', 'heavy shots that open bricks; ten to start'),
      power('long-beam', 'Long Beam', 'every beam reaches across the screen'),
      power('ice-beam', 'Ice Beam', 'it freezes what it hits'),
      power('varia-suit', 'Varia Suit', 'hits take half the energy'),
      power('wave-beam', 'Wave Beam', 'it snakes through walls and enemies'),
    ],
  },
  simon: {
    grow: 'pot-roast',
    defaultPower: 'chain-whip',
    ownItems: true,
    items: [
      grow('pot-roast', 'Pot Roast', 'your health bar grows, and fills'),
      power('chain-whip', 'Chain Whip', 'a longer whip'),
      power('dagger', 'Dagger', 'a sub-weapon thrown fast and straight'),
      power('holy-water', 'Holy Water', 'a sub-weapon that burns on the floor'),
      power('axe', 'Axe', 'a sub-weapon lobbed high over walls'),
      power('morning-star', 'Morning Star', 'the longest whip'),
      power('cross', 'Cross', 'a sub-weapon that spins out and back'),
      power('double-shot', 'Double Shot', 'two sub-weapons at once'),
      power('stopwatch', 'Stopwatch', 'a sub-weapon that stops time'),
      power('triple-shot', 'Triple Shot', 'three sub-weapons at once'),
    ],
  },
  ryu: {
    grow: 'medicine',
    defaultPower: 'throwing-star',
    ownItems: true,
    items: [
      grow('medicine', 'Medicine', 'your health bar grows, and fills'),
      power('throwing-star', 'Throwing Star', 'a ninpo art: a fast, straight star'),
      power('ninpo-scroll', 'Ninpo Scroll', 'more ninpo, and all of it filled'),
      power('windmill', 'Windmill Star', 'a ninpo art: it cuts through and comes back'),
      power('fire-wheel', 'Fire Wheel', 'a ninpo art: flames circle you'),
      power('jump-slash', 'Jump and Slash', 'a ninpo art: a somersault that cuts'),
    ],
  },
  bill: {
    grow: 'medal',
    defaultPower: 'machine-gun',
    ownItems: true,
    items: [
      grow('medal', 'Medal', 'you can take one more hit'),
      power('machine-gun', 'Machine Gun', 'hold to keep firing'),
      power('laser', 'Laser', 'one beam that pierces'),
      power('flame-gun', 'Flame Gun', 'a slow, heavy fireball'),
      power('spread-gun', 'Spread Gun', 'five shots in a fan'),
    ],
  },
  sophia: {
    grow: 'power-capsule',
    defaultPower: 'crusher',
    ownItems: true,
    items: [
      grow('power-capsule', 'Power Capsule', 'the Hyper cannon and the hover'),
      power('crusher', 'Crusher', 'the Crusher cannon'),
      power('wall-climb', 'Wall Climb', 'drive up walls'),
      power('ceiling-climb', 'Ceiling Climb', 'drive along ceilings'),
      power('triple-missile', 'Triple Missile', 'three missiles that fly through walls'),
      power('homing-missile', 'Homing Missile', 'missiles that seek enemies'),
    ],
  },
};

/** The hero's items, or null for a hero id this build doesn't know. */
export function heroItems(hero: string): HeroItems | null {
  return HERO_ITEMS[hero] ?? null;
}

/** The item `id` of `hero`, or null when it isn't one of theirs. */
export function itemInfo(hero: string, id: string): ItemInfo | null {
  return HERO_ITEMS[hero]?.items.find((i) => i.id === id) ?? null;
}

/** The value `grow` in a `[hero-items]` entry: the hero's grow item. */
export const GROW_ENTRY = 'grow';

/** An entry's item for `hero` (`grow` → their grow item), or null when it isn't theirs. */
export function entryItem(hero: string, value: string): string | null {
  const h = HERO_ITEMS[hero];
  if (!h) return null;
  if (value === GROW_ENTRY) return h.grow;
  return h.items.some((i) => i.id === value) ? value : null;
}

/** Spoken with its article ("an Energy Tank", "a Bomb Bag"). */
export function spokenItem(name: string): string {
  return `${/^[AEIOU]/i.test(name) ? 'an' : 'a'} ${name}`;
}
