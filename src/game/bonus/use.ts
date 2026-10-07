import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { CharacterDef } from '../characters/character';
import type { LevelData } from '../level/schema';
import { carriedKit } from '../entities/player';
import { freshSeed, World } from '../world/world';
import type { Game } from '../scenes/game';
import { addItem, ITEM_NAMES, ITEM_SPOKEN, takeItem, type ItemId } from './items';
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

/** The hero, power, hit points and kit of player `player` (0 or 1). */
function heroOf(game: Game, player: 0 | 1) {
  const s = game.state;
  return player === 1 && s.character2
    ? { def: s.character2, power: s.powerState2, hp: s.hp2, kit: s.kit2 }
    : { def: s.character, power: s.powerState, hp: s.hp, kit: s.kit };
}

/**
 * Gives player `player`'s hero a mushroom or fire flower through its own `onPowerUp`, in a silent
 * scratch world, and carries the result (power, hit points, kit) back into the run. The score it
 * would add is not kept. Returns false, leaving everything as it was, when it would change nothing
 * (Mario already on fire power, a hero at full strength).
 */
export function powerUpHero(game: Game, item: 'mushroom' | 'flower', player: 0 | 1 = 0): boolean {
  const s = game.state;
  const h = heroOf(game, player);
  const def: CharacterDef = h.def;
  const temp = {
    ...s,
    character: def,
    character2: null,
    powerState: h.power,
    hp: h.hp,
    kit: { ...h.kit },
  };
  const world = new World(ITEM_ROOM, { ...game.ctx, audio: NULL_AUDIO }, temp, { seed: 1 });
  const p = world.player;
  def.behaviour.onPowerUp(p, item, world);
  const kit = carriedKit(p);
  const same =
    p.powerState === h.power &&
    p.hp === h.hp &&
    JSON.stringify(Object.entries(kit).sort()) === JSON.stringify(Object.entries(h.kit).sort());
  if (same) return false;
  if (player === 1 && s.character2) {
    s.powerState2 = p.powerState;
    s.hp2 = p.hp;
    s.kit2 = kit;
  } else {
    s.powerState = p.powerState;
    s.hp = p.hp;
    s.kit = kit;
  }
  return true;
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
 * Uses `item` on player `player`'s hero now (the inventory is not touched): a mushroom or flower
 * powers the hero up, a Starman waits for the start of the next level (`bonus.starNext`), a 1-up
 * adds a life. Fails, changing nothing, when it would do nothing.
 */
export function useItem(game: Game, item: ItemId, player: 0 | 1 = 0): UseOutcome {
  const hero = heroOf(game, player).def;
  const name = ITEM_NAMES[item];
  switch (item) {
    case 'mushroom':
    case 'flower':
      if (!powerUpHero(game, item, player))
        return {
          ok: false,
          lines: [`${hero.hudName} IS AT FULL POWER.`, `SAVE THE ${name} FOR LATER.`],
          said: `${hero.name} is at full power. Save the ${name.toLowerCase()} for later.`,
        };
      return {
        ok: true,
        lines: [`${hero.hudName} USED THE ${name}!`],
        said: `${hero.name} used ${ITEM_SPOKEN[item]}.`,
      };
    case 'star':
      if (game.bonus.starNext)
        return {
          ok: false,
          lines: ['A STARMAN IS ALREADY', 'WAITING FOR THE NEXT LEVEL.'],
          said: 'A Starman is already waiting for the next level.',
        };
      game.bonus.starNext = true;
      return {
        ok: true,
        lines: ['STAR POWER AT THE START', 'OF THE NEXT LEVEL!'],
        said: 'Star power at the start of the next level.',
      };
    case '1up':
      if (game.state.lives >= MAX_LIVES)
        return { ok: false, lines: ['YOU HAVE ALL THE LIVES', 'YOU CAN HOLD.'], said: 'Lives are full.' };
      game.state.lives++;
      return { ok: true, lines: ['1 UP!'], said: `One more life. ${game.state.lives} lives.` };
  }
}

/**
 * The Items menu's choice: uses inventory item `index` on player `player`'s hero. Used, it leaves
 * the inventory and the file is saved; refused (it would do nothing), it stays. Nothing happens
 * while the inventory is locked.
 */
export function useInventoryItem(game: Game, index: number, player: 0 | 1 = 0): UseOutcome | null {
  if (!inventoryAvailable(game)) return null;
  const item = game.bonus.inventory[index];
  if (!item) return null;
  const out = useItem(game, item, player);
  if (out.ok) {
    takeItem(game.bonus, index);
    game.autosave();
  }
  return out;
}

/**
 * The start of a level: a Starman used from the map gives player 1's hero star power through its
 * own `onPowerUp` (its music too). Called by LevelScene once it is on screen; true when it did.
 */
export function applyStarAtStart(game: Game, world: World): boolean {
  if (!game.campaign || !game.bonus.starNext) return false;
  const p = world.players[0];
  if (!p) return false;
  game.bonus.starNext = false;
  const score = game.state.score;
  p.def.behaviour.onPowerUp(p, 'star', world);
  game.state.score = score; // the item box's star is not worth points
  game.autosave();
  return true;
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
 * inventory, or, when that is full or still locked, is used at once on player 1's hero (owner
 * call left to L2: SMB3 lost it; using it is kinder, and a refused use is the only loss). The file
 * is saved.
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
      const why = inventoryAvailable(game) ? 'YOUR ITEMS ARE FULL:' : 'NO ITEM BOX YET:';
      const use = useItem(game, item);
      // Refused (it would do nothing now), it is lost.
      out = {
        lines: [got, why, use.ok ? 'USED AT ONCE.' : 'NO USE FOR IT NOW. LOST.'],
        said: `You got ${ITEM_SPOKEN[item]}. ${why === 'NO ITEM BOX YET:' ? 'No item box yet' : 'Your items are full'}: ${use.ok ? 'used at once.' : 'no use for it now, so it is lost.'}`,
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
