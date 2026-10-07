import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { CharacterDef } from '../characters/character';
import type { LevelData } from '../level/schema';
import { carriedKit } from '../entities/player';
import { freshSeed, World } from '../world/world';
import type { Game } from '../scenes/game';
import { addItem, ITEM_NAMES, ITEM_SPOKEN, NEXT_ORDER, takeItem, type ItemId, type NextItem } from './items';
import { Rng } from '@engine/rng';
import { CHEST_WEIGHTS, rollWeighted, type BonusPrize } from './rules';

/*
 * Using items and handing out bonus prizes (docs/BONUS.md). Mushrooms and fire flowers go through
 * the hero's own `CharacterDef.behaviour.onPowerUp`, as touching one in a level does, so every
 * hero gets its own equivalent (Mario grows, Link gains a heart container, Mega Man his helmet...).
 */

/** Most lives a file keeps (the save keeps 1..99). */
export const MAX_LIVES = 99;

/** Whether the file's inventory can be used: unlocked (Larry beaten), or dev mode's "Item inventory" on. */
export function inventoryAvailable(game: Game): boolean {
  return game.inventoryUnlocked || (game.devMode && game.bonus.devInventory);
}

/** A one-screen empty room: the world `onPowerUp` runs in when an item is used on the map. */
const ITEM_ROOM: LevelData = {
  schema: 1,
  id: 'item-use',
  name: '',
  world: 1,
  stage: 1,
  theme: 'overworld',
  music: '',
  time: null,
  width: 16,
  height: 15,
  tiles: new Uint16Array(16 * 15),
  entities: [],
  zones: [],
  decor: [],
  start: { x: 2, y: 12 },
  startMode: 'stand',
  camera: 'locked',
  parent: null,
};

/** Whether dev mode's "Give items" list is shown and usable (dev mode and "Item inventory" on). */
export function devItemsShown(game: Game): boolean {
  return game.devMode && game.bonus.devInventory;
}

/**
 * Dev items (given and held) vanish once dev mode or its "Item inventory" toggle is off. Called
 * wherever they would be read.
 */
export function dropDevItemsIfOff(game: Game): void {
  if (devItemsShown(game)) return;
  game.bonus.devItems = [];
  game.bonus.devNext = [];
}

/** The items the panel shows, in order: the file's, then (dev) the unsaved dev items. */
export function shownItems(game: Game): ItemId[] {
  dropDevItemsIfOff(game);
  const b = game.bonus;
  return [...b.inventory, ...b.devItems];
}

/** Every item waiting for the next level (the file's and dev mode's), in giving order. */
export function heldItems(game: Game): NextItem[] {
  dropDevItemsIfOff(game);
  const b = game.bonus;
  return NEXT_ORDER.filter((k) => b.itemsNext.includes(k) || b.devNext.includes(k));
}

/** A hero's carried power, for the dry run. */
interface HeroPower {
  def: CharacterDef;
  power: string;
  hp: number;
  kit: Record<string, number>;
}

const sameKit = (a: Record<string, number>, b: Record<string, number>): boolean =>
  JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

/**
 * Whether a mushroom or fire flower would change anything for `hero` (its power, hit points or
 * kit), tried through its own `onPowerUp` in a silent scratch world; nothing real is touched.
 */
export function powerUpChanges(game: Game, hero: HeroPower, item: 'mushroom' | 'flower'): boolean {
  const temp = {
    ...game.state,
    character: hero.def,
    character2: null,
    powerState: hero.power,
    hp: hero.hp,
    kit: { ...hero.kit },
  };
  const world = new World(ITEM_ROOM, { ...game.ctx, audio: NULL_AUDIO }, temp, { seed: 1 });
  const p = world.player;
  hero.def.behaviour.onPowerUp(p, item, world);
  return p.powerState !== hero.power || p.hp !== hero.hp || !sameKit(carriedKit(p), hero.kit);
}

/** What using an item did: `ok` false leaves the item where it was, `lines` say why. */
export interface UseOutcome {
  ok: boolean;
  /** Banner lines (font text, at most 28 columns). */
  lines: string[];
  /** What the announcer says. */
  said: string;
}

/**
 * Uses `item` now (the inventory is not touched). A 1-up adds a life at once. A mushroom, fire
 * flower or Starman is held for the start of the next level (`bonus.itemsNext`) and given there to
 * the hero who enters it (`applyHeldItems`), so picking another hero on the way keeps it; one of
 * each kind can wait. Refused, changing nothing, when one of its kind already waits (or lives are
 * full). `dev`: a dev mode item, held in the unsaved `devNext`.
 */
export function useItem(game: Game, item: ItemId, dev = false): UseOutcome {
  const name = ITEM_NAMES[item];
  if (item === '1up') {
    if (game.state.lives >= MAX_LIVES)
      return { ok: false, lines: ['YOU HAVE ALL THE LIVES', 'YOU CAN HOLD.'], said: 'Lives are full.' };
    game.state.lives++;
    return { ok: true, lines: ['1 UP!'], said: `One more life. ${game.state.lives} lives.` };
  }
  const b = game.bonus;
  if (heldItems(game).includes(item))
    return {
      ok: false,
      lines: [`A ${name} IS ALREADY`, 'WAITING FOR THE NEXT LEVEL.'],
      said: `${ITEM_SPOKEN[item]} is already waiting for the next level.`.replace(/^a /, 'A '),
    };
  // A dev item waits in the unsaved dev list, a file's item in the saved one.
  if (dev) b.devNext = NEXT_ORDER.filter((k) => k === item || b.devNext.includes(k));
  else b.itemsNext = NEXT_ORDER.filter((k) => k === item || b.itemsNext.includes(k));
  return {
    ok: true,
    lines: [`${name} READY FOR THE`, 'START OF THE NEXT LEVEL!'],
    said: `${ITEM_SPOKEN[item].replace(/^a /, 'A ')}, ready for the start of the next level.`,
  };
}

/**
 * The Items panel's choice: uses shown item `index` (the file's items, then the dev items). Used,
 * it leaves its list and the file is saved; refused, it stays. Nothing happens while the inventory
 * is locked.
 */
export function useInventoryItem(game: Game, index: number): UseOutcome | null {
  if (!inventoryAvailable(game)) return null;
  const item = shownItems(game)[index];
  if (!item) return null;
  const b = game.bonus;
  const dev = index >= b.inventory.length;
  const out = useItem(game, item, dev);
  if (out.ok) {
    if (dev) b.devItems.splice(index - b.inventory.length, 1);
    else takeItem(b, index);
    game.autosave();
  }
  return out;
}

/** What a held item did at a level's start. */
export interface HeldOutcome {
  item: NextItem;
  /** Given to the hero (false: it would have done nothing, so it went back to the inventory). */
  given: boolean;
  /** Back in the inventory (false when it was given, or the inventory was full and it was lost). */
  returned: boolean;
  /** A dev mode item (from and back to the unsaved dev list). */
  dev: boolean;
}

/**
 * The start of a campaign level (LevelScene, once on screen; not in a stage tutorial): the items
 * used from the map go to player 1's hero, the one who actually enters, through its own
 * `onPowerUp`: mushroom, then flower, then Starman (music too). A mushroom or flower that would do
 * nothing for this hero goes back into the inventory (lost only if that is full). The points they
 * would add are not kept. The run's power is updated and the file saved at once.
 */
export function applyHeldItems(game: Game, world: World): HeldOutcome[] {
  if (!game.campaign || game.tutorialRun) return [];
  const held = heldItems(game);
  const p = world.players[0];
  if (!p || !held.length) return [];
  const b = game.bonus;
  const fromDev = new Set(b.devNext.filter((k) => !b.itemsNext.includes(k)));
  b.itemsNext = [];
  b.devNext = [];
  const score = game.state.score;
  const out: HeldOutcome[] = [];
  for (const item of held) {
    const dev = fromDev.has(item);
    if (item !== 'star') {
      const hero = { def: p.def, power: p.powerState, hp: p.hp, kit: carriedKit(p) };
      if (!powerUpChanges(game, hero, item)) {
        // Back where it came from: a dev item to the unsaved dev list, never the file's inventory.
        const returned = dev ? (b.devItems.push(item), true) : addItem(b, item);
        out.push({ item, given: false, returned, dev });
        continue;
      }
    }
    p.def.behaviour.onPowerUp(p, item, world);
    out.push({ item, given: true, returned: false, dev });
  }
  game.state.score = score; // items from the item box are not worth points
  const s = game.state;
  s.powerState = p.powerState;
  s.hp = p.hp;
  s.kit = carriedKit(p);
  const back = out.filter((o) => !o.given);
  if (back.length) {
    const names = back.map((o) => ITEM_NAMES[o.item].toLowerCase()).join(' and ');
    game.deps.announcer?.say(
      `${p.def.name} is at full power: the ${names} ${back.every((o) => o.returned) ? 'went back to your items' : 'had no room in your items'}.`,
    );
  }
  game.autosave();
  return out;
}

/** What winning a prize did. */
export interface AwardOutcome {
  /** Banner lines (font text). */
  lines: string[];
  said: string;
  /** An item went into the inventory (false: used at once, or not an item). */
  stored: boolean;
}

/** Coins added the HUD way: every 100 makes a life (lives capped at MAX_LIVES). */
function addCoins(game: Game, n: number): void {
  const s = game.state;
  s.coins += n;
  while (s.coins >= 100) {
    s.coins -= 100;
    s.lives = Math.min(MAX_LIVES, s.lives + 1);
  }
}

/**
 * A bonus game's prize, given now: lives and coins count at once; an item goes into the
 * inventory, or, when that is full or still locked, is used as from the panel (a 1-up at once, the
 * others held for the next level; owner call left to L2: SMB3 lost it). The file is saved.
 */
export function awardPrize(game: Game, prize: BonusPrize): AwardOutcome {
  const s = game.state;
  let out: AwardOutcome;
  if (prize.kind === 'lives') {
    s.lives = Math.min(MAX_LIVES, s.lives + prize.amount);
    const n = prize.amount;
    out = {
      lines: [n === 1 ? '1 UP!' : `${n} UP!`],
      said: `${n === 1 ? 'One more life' : `${n} more lives`}. ${s.lives} lives.`,
      stored: false,
    };
  } else if (prize.kind === 'coins') {
    addCoins(game, prize.amount);
    out = { lines: [`${prize.amount} COINS!`], said: `${prize.amount} coins.`, stored: false };
  } else {
    const item = prize.item;
    const got = `YOU GOT A ${ITEM_NAMES[item]}!`;
    if (inventoryAvailable(game) && addItem(game.bonus, item)) {
      const n = game.bonus.inventory.length;
      out = {
        lines: [got, `ADDED TO YOUR ITEMS (${n})`],
        said: `You got ${ITEM_SPOKEN[item]}. Added to your items.`,
        stored: true,
      };
    } else {
      // Full (or no item box yet): it waits for the next level instead (SMB3 lost it); lost only
      // when one of its kind already waits.
      const why = inventoryAvailable(game) ? 'YOUR ITEMS ARE FULL:' : 'NO ITEM BOX YET:';
      const use = useItem(game, item);
      const said = why === 'NO ITEM BOX YET:' ? 'No item box yet' : 'Your items are full';
      const now = item === '1up' ? 'USED AT ONCE.' : 'KEPT FOR THE NEXT LEVEL.';
      out = {
        lines: [got, why, use.ok ? now : 'ONE IS WAITING. LOST.'],
        said: `You got ${ITEM_SPOKEN[item]}. ${said}: ${use.ok ? now.toLowerCase() : 'one is already waiting, so it is lost.'}`,
        stored: false,
      };
    }
  }
  game.autosave();
  return out;
}

/**
 * Beating the map's Hammer Bros (SMB3 gives an item for it): a mushroom, fire flower or star,
 * weighted as a Toad House chest, given as a bonus prize (into the inventory, or used at once).
 */
export function awardHammerPrize(game: Game, seed = freshSeed()): AwardOutcome {
  return awardPrize(game, { kind: 'item', item: rollWeighted(new Rng(seed), CHEST_WEIGHTS) });
}
