import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import { WorldMapScene } from '@game/scenes/world-map';
import { DevMenuScene } from '@game/scenes/dev';
import { MessageScene } from '@game/scenes/message';
import { LINK } from '@game/characters/link';
import { loadSave, migrateSave, newSave } from '@game/save/save-files';
import type { Settings } from '@engine/save/settings';
import { SlotsScene } from '@game/bonus';
import {
  INVENTORY_MAX,
  InventoryScene,
  MemoryScene,
  nextBonusKind,
  openBonusGame,
  shownItems,
  heldItems,
  awardPrize,
  ToadHouseScene,
  useInventoryItem,
  awardHammerPrize,
  type BonusKind,
  type BonusResult,
} from '@game/bonus';
import { DevBonusGamesScene } from '@game/bonus/dev';
import { OPEN_FRAMES } from '@game/bonus/toad-house';
import { RESULT_DELAY } from '@game/bonus/slots';
import { MISS_FRAMES } from '@game/bonus/memory';
import { SLOT_CELL, SLOT_STRIPS, type CardFace } from '@game/bonus/rules';
import { file, makeGame, useStorage, type H } from './heroes-harness';
import { CHARACTERS } from '@game/characters/registry';
import { carriedKit } from '@game/entities/player';
import { giveDevItems } from '@game/bonus/items';
import type { SaveFile } from '@game/save/save-files';

// The SMB3 bonus games and the item inventory (docs/BONUS.md).

useStorage();

const items = (scene: unknown) => (scene as { items: MenuItem[] }).items;
const labels = (scene: unknown) => items(scene).map((i) => i.label);

/** File 1 open on the map (dev mode `dev`), its hero `hero`. */
function onMap(over: Partial<SaveFile> = {}, dev = false, hero = 'mario') {
  const h = makeGame();
  const settings = { dev } as Settings;
  h.game.deps.settings = settings;
  file(over, hero);
  h.game.openFile(1);
  h.idle(8);
  expect(h.top()).toBeInstanceOf(WorldMapScene);
  return { h, settings };
}

function openMenu(h: H): MenuScene {
  h.tap('select');
  expect((h.top() as MenuScene).title).toBe('MAP');
  h.idle(8);
  return h.top() as MenuScene;
}

/** Moves the menu cursor to `label` (from the top). */
function toRow(h: H, menu: MenuScene, label: string): void {
  const row = labels(menu).indexOf(label);
  expect(row).toBeGreaterThanOrEqual(0);
  for (let i = 0; i < row; i++) h.tap('down');
}

/** The ITEMS panel through the map's special button. */
function openItems(h: H): InventoryScene {
  h.tap('special');
  const inv = h.top();
  expect(inv).toBeInstanceOf(InventoryScene);
  h.idle(8);
  return inv as InventoryScene;
}

/** Opens the panel and uses item `index`. */
function useFromPanel(h: H, index: number) {
  const inv = openItems(h);
  for (let i = 0; i < index; i++) h.tap('right');
  h.tap('jump');
  const note = inv.note;
  h.idle(12);
  h.tap('jump');
  return note;
}

describe('item inventory on the save file', () => {
  it('is empty and locked on a new file, and older files without the fields read the same', () => {
    const s = newSave(1, 'mario');
    const m = migrateSave(JSON.parse(JSON.stringify(s)), 1) as SaveFile;
    expect(m.inventory).toEqual([]);
    expect(m.inventoryUnlocked).toBe(false);
    expect(m.bonusNext).toBe(0);
    expect(m.devInventory).toBe(false);
    expect(m.itemsNext).toEqual([]);
  });

  it('keeps known items only, at most 12, and the flags as stored', () => {
    const raw = {
      ...newSave(1, 'mario'),
      inventory: ['mushroom', 'leaf', 3, 'star', ...Array(20).fill('1up')],
      inventoryUnlocked: true,
      bonusOpen: true,
      bonusNext: 2,
      devInventory: true,
      itemsNext: ['star', 'leaf', 'mushroom', 'star'],
    };
    const m = migrateSave(JSON.parse(JSON.stringify(raw)), 1) as SaveFile;
    expect(m.inventory).toHaveLength(INVENTORY_MAX);
    expect(m.inventory?.slice(0, 3)).toEqual(['mushroom', 'star', '1up']);
    expect([m.inventoryUnlocked, m.bonusOpen, m.bonusNext, m.devInventory]).toEqual([true, true, 2, true]);
    expect(m.itemsNext).toEqual(['mushroom', 'star']); // known kinds, each once, in giving order
  });

  it('opens with the file (Game.bonus) and is saved back by autosave', () => {
    const { h } = onMap({ inventory: ['flower'], inventoryUnlocked: true, bonusNext: 1 });
    expect(h.game.bonus.inventory).toEqual(['flower']);
    expect(h.game.inventoryUnlocked).toBe(true);
    h.game.bonus.inventory.push('star');
    h.game.autosave();
    expect(loadSave(1)?.inventory).toEqual(['flower', 'star']);
    expect(loadSave(1)?.bonusNext).toBe(1);
  });
});

describe('the map ITEMS panel', () => {
  it('is hidden until unlocked: no Items row, the ITEMS button does nothing, nothing can be used', () => {
    const { h } = onMap({ inventory: ['mushroom', '1up'] });
    const map = h.top() as WorldMapScene;
    expect(map.touchLabels().special).toBeNull();
    h.tap('special');
    expect(h.top()).toBe(map);
    expect(labels(openMenu(h))).not.toContain('Items');
    const lives = h.game.state.lives;
    expect(useInventoryItem(h.game, 1)).toBeNull();
    expect(h.game.state.lives).toBe(lives);
    expect(h.game.bonus.inventory).toEqual(['mushroom', '1up']);
  });

  it('once unlocked: an Items row on the map menu and the ITEMS button (special) open it', () => {
    const { h } = onMap({ inventory: ['mushroom'], inventoryUnlocked: true });
    const map = h.top() as WorldMapScene;
    expect(map.touchLabels().special).toBe('ITEMS');
    const menu = openMenu(h);
    expect(labels(menu)[1]).toBe('Items');
    toRow(h, menu, 'Items');
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(InventoryScene);
    expect(h.said.some((t) => t.startsWith('Items for Mario, 1 of 12.'))).toBe(true);
    h.idle(8);
    h.tap('attack'); // BACK
    expect(h.top()).toBe(map);
  });

  it("names abilities and the hero's own effect", () => {
    const { h } = onMap({ inventory: ['flower'], inventoryUnlocked: true }, false, 'link');
    const inv = openItems(h);
    expect(inv.touchLabels()).toMatchObject({ jump: 'USE', attack: 'BACK' });
    expect(h.said.at(-1)).toMatch(/fire flower\. The red tunic/i);
  });
});

/** Straight into 1-1 (as from the map after the pick), one frame in. */
function startLevel(h: H): LevelScene {
  h.game.startLevel(getLevel('1-1'), { mode: 'stand' });
  h.step();
  const level = h.top() as LevelScene;
  expect(level).toBeInstanceOf(LevelScene);
  return level;
}

describe('using items (Mario, a power-up hero)', () => {
  it('mushroom: held for the next level, where small Mario grows; used up and saved', () => {
    const { h } = onMap({ inventory: ['mushroom', 'flower'], inventoryUnlocked: true });
    const note = useFromPanel(h, 0);
    expect(note?.ok).toBe(true);
    expect(note?.lines.join(' ')).toMatch(/READY FOR THE START OF THE NEXT LEVEL/);
    expect(h.top()).toBeInstanceOf(WorldMapScene); // the panel closed after the use
    expect(h.game.state.powerState).toBe('small'); // not yet
    expect(h.game.bonus.inventory).toEqual(['flower']);
    expect(loadSave(1)?.itemsNext).toEqual(['mushroom']);
    expect(loadSave(1)?.inventory).toEqual(['flower']);
    const score = h.game.state.score;
    const level = startLevel(h);
    expect(level.world.player.powerState).toBe('big');
    expect(h.game.state.powerState).toBe('big');
    expect(h.game.state.score).toBe(score);
    expect(h.game.bonus.itemsNext).toEqual([]);
    expect(loadSave(1)?.powerState).toBe('big');
    expect(loadSave(1)?.itemsNext).toEqual([]);
  });

  it('mushroom and flower together: small Mario gets fire power at the start', () => {
    const { h } = onMap({ inventory: ['flower', 'mushroom'], inventoryUnlocked: true });
    useFromPanel(h, 0);
    useFromPanel(h, 0);
    expect(h.game.bonus.itemsNext).toEqual(['mushroom', 'flower']);
    expect(startLevel(h).world.player.powerState).toBe('fire');
  });

  it('one of each kind can wait: a second mushroom is refused and kept', () => {
    const { h } = onMap({ inventory: ['mushroom', 'mushroom'], inventoryUnlocked: true });
    useFromPanel(h, 0);
    const inv = openItems(h);
    h.tap('jump');
    expect(inv.note?.ok).toBe(false);
    expect(inv.note?.lines.join(' ')).toMatch(/ALREADY WAITING/);
    expect(h.game.bonus.inventory).toEqual(['mushroom']);
  });

  it('a mushroom that would do nothing (fire Mario) goes back into the inventory at the start', () => {
    const { h } = onMap({ inventory: ['mushroom'], inventoryUnlocked: true, powerState: 'fire' });
    useFromPanel(h, 0);
    expect(h.game.bonus.inventory).toEqual([]);
    startLevel(h);
    expect(h.game.state.powerState).toBe('fire');
    expect(h.game.bonus.inventory).toEqual(['mushroom']);
    expect(loadSave(1)?.inventory).toEqual(['mushroom']);
    expect(h.said.some((t) => /Mario is at full power: the mushroom went back to your items/.test(t))).toBe(
      true,
    );
  });

  it('1-up adds a life at once', () => {
    const { h } = onMap({ inventory: ['1up'], inventoryUnlocked: true });
    const lives = h.game.state.lives;
    useFromPanel(h, 0);
    expect(h.game.state.lives).toBe(lives + 1);
    expect(h.game.bonus.inventory).toEqual([]);
    expect(loadSave(1)?.lives).toBe(lives + 1);
  });

  it('star: waits for the next level, which starts with star power; a second is refused meanwhile', () => {
    const { h } = onMap({ inventory: ['star', 'star'], inventoryUnlocked: true });
    useFromPanel(h, 0);
    expect(h.game.bonus.itemsNext).toEqual(['star']);
    const inv = openItems(h);
    h.tap('jump');
    expect(inv.note?.ok).toBe(false);
    expect(h.game.bonus.inventory).toEqual(['star']);
    h.idle(12);
    h.tap('jump');
    const level = startLevel(h);
    expect(level.world.player.star).toBeGreaterThan(0);
    expect(h.game.bonus.itemsNext).toEqual([]);
    expect(loadSave(1)?.itemsNext).toEqual([]);
    expect(h.audio.playMusic).toHaveBeenLastCalledWith('star');
  });

  it('nothing waiting: a level starts as it was', () => {
    const { h } = onMap({ inventoryUnlocked: true });
    const p = startLevel(h).world.player;
    expect(p.star).toBe(0);
    expect(p.powerState).toBe('small');
  });

  it('a mushroom used as Mario goes to Link when Link is picked for the level', () => {
    const { h } = onMap({
      inventory: ['mushroom'],
      inventoryUnlocked: true,
      freed: ['mario', 'link'],
      tutorials: ['link'], // no training question on the way
    });
    useFromPanel(h, 0);
    h.game.enterLevelFromMap('1-1');
    h.idle(12);
    // Character select: step right until Link is said, then pick him.
    for (let i = 0; i < 12; i++) {
      h.tap('right');
      if (h.said.at(-1)?.startsWith('Link')) break;
    }
    h.tap('jump');
    h.until(() => h.top() instanceof LevelScene, 600);
    const p = (h.top() as LevelScene).world.player;
    expect(p.def).toBe(LINK);
    expect(p.scratch.maxHp).toBe(8);
    expect(h.game.state.kit.maxHp).toBe(8);
    expect(h.game.bonus.itemsNext).toEqual([]);
    expect(loadSave(1)?.kit.maxHp).toBe(8);
  });
});

describe('using items (Link, a hit-point hero)', () => {
  it("mushroom: Link's own power-up, a heart container and the white tunic, hearts refilled", () => {
    const { h } = onMap({ inventory: ['mushroom'], inventoryUnlocked: true, hp: 3 }, false, 'link');
    expect(h.game.state.character).toBe(LINK);
    useFromPanel(h, 0);
    startLevel(h);
    expect(h.game.state.kit.maxHp).toBe(8);
    expect(h.game.state.kit.tunic).toBe(1);
    expect(h.game.state.hp).toBe(8);
    expect(loadSave(1)?.kit.maxHp).toBe(8);
    expect(h.game.bonus.inventory).toEqual([]);
  });

  it('fire flower: the red tunic (sword beam), hearts refilled', () => {
    const { h } = onMap({ inventory: ['flower'], inventoryUnlocked: true, hp: 2 }, false, 'link');
    useFromPanel(h, 0);
    startLevel(h);
    expect(h.game.state.kit.beam).toBe(1);
    expect(h.game.state.hp).toBe(6);
  });

  it("star: Link's star power at the next level's start", () => {
    const { h } = onMap({ inventory: ['star'], inventoryUnlocked: true }, false, 'link');
    useFromPanel(h, 0);
    const p = startLevel(h).world.player;
    expect(p.def).toBe(LINK);
    expect(p.star).toBeGreaterThan(0);
  });
});

describe('mushroom and flower for every hero', () => {
  for (const def of CHARACTERS)
    for (const item of ['mushroom', 'flower'] as const)
      it(`${def.id}: ${item} at the start either changes something or goes back; the kit carries over`, () => {
        const { h } = onMap(
          { inventory: [item], inventoryUnlocked: true, freed: CHARACTERS.map((c) => c.id) },
          false,
          def.id,
        );
        const s = h.game.state;
        expect(s.character).toBe(def);
        const before = { power: s.powerState, hp: s.hp, kit: JSON.stringify(s.kit) };
        useFromPanel(h, 0);
        const level = startLevel(h);
        const p = level.world.player;
        const changed =
          s.powerState !== before.power || s.hp !== before.hp || JSON.stringify(s.kit) !== before.kit;
        // A fresh hero (starting power, no kit) always gains something from either.
        expect(changed).toBe(true);
        expect(h.game.bonus.inventory).toEqual([]);
        // What the player has is what the run carries (and the file saves).
        expect(s.powerState).toBe(p.powerState);
        expect(s.hp).toBe(p.hp);
        // Every carried kit entry is the player's own (runtime-only entries like aim come later).
        for (const [k, v] of Object.entries(s.kit)) expect(carriedKit(p)[k]).toBe(v);
        // The file saved the power-up's kit at the start.
        for (const [k, v] of Object.entries(loadSave(1)?.kit ?? {})) expect(s.kit[k]).toBe(v);
        const f = loadSave(1) as SaveFile;
        if (changed)
          expect(
            f.powerState !== before.power || f.hp !== before.hp || JSON.stringify(f.kit) !== before.kit,
          ).toBe(true);
        h.idle(30); // plays on without throwing
        expect(h.top()).toBe(level);
      });
});

describe('dev mode "Item inventory"', () => {
  it('only in dev mode; on unlocks the inventory at once (the Items row appears), never writing inventoryUnlocked', () => {
    let { h } = onMap({}, false);
    expect(labels(openMenu(h))).not.toContain('Item inventory');
    ({ h } = onMap({ inventory: ['1up'] }, true));
    const menu = openMenu(h);
    expect(labels(menu)).not.toContain('Items');
    const row = items(menu).find((i) => i.label === 'Item inventory');
    expect(row?.value?.()).toBe('off');
    toRow(h, menu, 'Item inventory');
    h.tap('right');
    expect(
      items(menu)
        .find((i) => i.label === 'Item inventory')
        ?.value?.(),
    ).toBe('on');
    expect(labels(menu)).toContain('Items');
    expect(h.said.at(-1)).toMatch(/^Item inventory: on\./);
    expect(loadSave(1)?.devInventory).toBe(true);
    expect(loadSave(1)?.inventoryUnlocked).toBe(false);
    h.tap('attack');
    const lives = h.game.state.lives;
    useFromPanel(h, 0);
    expect(h.game.state.lives).toBe(lives + 1);
  });

  it('has no effect with dev mode off', () => {
    const { h, settings } = onMap({ devInventory: true, inventory: ['1up'] }, true);
    expect((h.top() as WorldMapScene).touchLabels().special).toBe('ITEMS');
    settings.dev = false;
    expect((h.top() as WorldMapScene).touchLabels().special).toBeNull();
    expect(useInventoryItem(h.game, 0)).toBeNull();
  });

  it('"Give items": one of each, never saved, shown only in dev mode with the toggle on', () => {
    const { h, settings } = onMap({ inventory: Array(10).fill('mushroom') }, true);
    const menu = openMenu(h);
    toRow(h, menu, 'Give items');
    h.tap('jump');
    expect(labels(menu)).toContain('Items'); // the toggle came on
    expect(h.game.bonus.inventory).toHaveLength(10);
    expect(shownItems(h.game)).toHaveLength(INVENTORY_MAX);
    expect(shownItems(h.game).slice(10)).toEqual(['mushroom', 'flower']);
    h.game.autosave();
    expect(loadSave(1)?.inventory).toEqual(Array(10).fill('mushroom'));
    expect(JSON.stringify(loadSave(1))).not.toContain('devItems');
    // Used from the panel: the dev item goes, the file's items stay.
    h.tap('attack');
    const inv = openItems(h);
    for (let i = 0; i < 11; i++) h.tap('right');
    h.tap('jump');
    expect(inv.note?.ok).toBe(true);
    // Held in the unsaved dev list: the file's held items stay empty.
    expect(h.game.bonus.devNext).toEqual(['flower']);
    expect(h.game.bonus.itemsNext).toEqual([]);
    expect(heldItems(h.game)).toEqual(['flower']);
    expect(loadSave(1)?.itemsNext).toEqual([]);
    expect(JSON.stringify(loadSave(1))).not.toContain('devNext');
    expect(h.game.bonus.inventory).toHaveLength(10);
    expect(shownItems(h.game)).toHaveLength(11);
    // Dev mode off: they vanish, the held one too.
    settings.dev = false;
    expect(shownItems(h.game)).toEqual(Array(10).fill('mushroom'));
    expect(heldItems(h.game)).toEqual([]);
    expect(h.game.bonus.devNext).toEqual([]);
  });

  it('a held dev item is given at the level start; a useless one goes back to the dev list, never the file', () => {
    const { h } = onMap({ inventory: ['star'], powerState: 'fire', devInventory: true }, true);
    giveDevItems(h.game.bonus); // mushroom, flower, star, 1-up after the file's star
    expect(useInventoryItem(h.game, 1)?.ok).toBe(true); // the dev mushroom
    expect(useInventoryItem(h.game, 2)?.ok).toBe(true); // the dev star (the flower moved up)
    expect(loadSave(1)?.itemsNext).toEqual([]);
    const p = startLevel(h).world.player;
    expect(p.star).toBeGreaterThan(0); // the dev star was given
    expect(h.game.state.powerState).toBe('fire');
    expect(h.game.bonus.inventory).toEqual(['star']); // the file's inventory is unchanged
    expect(loadSave(1)?.inventory).toEqual(['star']);
    expect(h.game.bonus.devItems).toEqual(['flower', '1up', 'mushroom']); // the mushroom came back here
    expect(loadSave(1)?.itemsNext).toEqual([]);
  });

  it('a dev item and a file item of the same kind: only one can wait', () => {
    const { h } = onMap({ inventory: ['mushroom'], devInventory: true }, true);
    giveDevItems(h.game.bonus);
    expect(useInventoryItem(h.game, 0)?.ok).toBe(true); // the file's mushroom
    expect(useInventoryItem(h.game, 0)?.ok).toBe(false); // the dev mushroom: one is waiting
    expect(loadSave(1)?.itemsNext).toEqual(['mushroom']);
  });

  it('a won item pushes a dev item out when the two lists are full', () => {
    const { h } = onMap({ inventory: Array(8).fill('1up'), devInventory: true }, true);
    giveDevItems(h.game.bonus);
    expect(shownItems(h.game)).toHaveLength(INVENTORY_MAX);
    awardPrize(h.game, { kind: 'item', item: 'star' });
    expect(h.game.bonus.inventory).toHaveLength(9);
    expect(shownItems(h.game)).toHaveLength(INVENTORY_MAX);
    expect(h.game.bonus.devItems).toEqual(['mushroom', 'flower', 'star']);
  });
});

/** Opens a bonus game over the map with `seed`, recording how it ends. */
function bonus(h: H, kind: BonusKind, seed = 1) {
  const ends: BonusResult[] = [];
  const scene = openBonusGame(h.game, kind, (r) => ends.push(r), { seed });
  expect(h.top()).toBe(scene);
  h.idle(25); // past the opening guard
  return { scene, ends };
}

/** Closes the result card with OK. */
function closeCard(h: H) {
  h.idle(35);
  h.tap('jump');
}

describe('Toad House', () => {
  it('pick a chest with left/right and OPEN: its prize goes into the inventory, then OK ends it', () => {
    const { h } = onMap({ inventoryUnlocked: true });
    const { scene, ends } = bonus(h, 'toad-house', 42);
    const house = scene as ToadHouseScene;
    expect(h.said.some((t) => t.includes('Pick a box. Its contents will help you on your way.'))).toBe(true);
    expect(house.touchLabels()).toMatchObject({ jump: 'OPEN', start: 'MENU' });
    expect(house.cursor).toBe(1);
    h.tap('left');
    expect(house.cursor).toBe(0);
    h.tap('jump');
    expect(house.opened?.index).toBe(0);
    h.idle(OPEN_FRAMES + 65);
    expect(h.game.bonus.inventory).toEqual([house.chests[0]]);
    expect(loadSave(1)?.inventory).toEqual([house.chests[0]]);
    closeCard(h);
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(ends).toEqual([
      { kind: 'toad-house', prizes: [{ kind: 'item', item: house.chests[0] }], gaveUp: false, played: true },
    ]);
    expect(h.audio.playMusic).toHaveBeenLastCalledWith('map');
  });

  it('the same seed deals the same chests', () => {
    const { h } = onMap({ inventoryUnlocked: true });
    const a = (bonus(h, 'toad-house', 9).scene as ToadHouseScene).chests;
    h.game.scenes.pop();
    const b = (bonus(h, 'toad-house', 9).scene as ToadHouseScene).chests;
    expect(b).toEqual(a);
  });

  it('a full inventory: the prize waits for the next level instead', () => {
    const { h } = onMap({ inventoryUnlocked: true, inventory: Array(INVENTORY_MAX).fill('1up') });
    const { scene } = bonus(h, 'toad-house', 3);
    const house = scene as ToadHouseScene;
    house.chests[1] = 'mushroom';
    h.tap('jump');
    h.idle(OPEN_FRAMES + 65);
    expect(h.game.bonus.inventory).toHaveLength(INVENTORY_MAX);
    expect(h.game.bonus.itemsNext).toEqual(['mushroom']);
    expect(h.said.some((t) => /items are full: kept for the next level/.test(t))).toBe(true);
  });

  it('a full inventory and one of its kind already waiting: it is lost, and the banner says so', () => {
    const { h } = onMap({
      inventoryUnlocked: true,
      itemsNext: ['flower'],
      inventory: Array(INVENTORY_MAX).fill('1up'),
    });
    const { scene } = bonus(h, 'toad-house', 3);
    (scene as ToadHouseScene).chests[1] = 'flower';
    h.tap('jump');
    h.idle(OPEN_FRAMES + 65);
    expect(h.game.bonus.inventory).toEqual(Array(INVENTORY_MAX).fill('1up'));
    expect(h.game.bonus.itemsNext).toEqual(['flower']);
    expect(h.said.some((t) => /one is already waiting, so it is lost/.test(t))).toBe(true);
  });

  it('once a chest is open there is no Give up: the prize always comes', () => {
    const { h } = onMap({ inventoryUnlocked: true });
    const { scene, ends } = bonus(h, 'toad-house', 3);
    h.tap('jump');
    h.tap('start');
    expect(h.top()).toBe(scene); // no menu
    h.idle(OPEN_FRAMES + 65);
    expect(h.game.bonus.inventory).toEqual([(scene as ToadHouseScene).chests[1]]);
    closeCard(h);
    expect(ends[0]?.gaveUp).toBe(false);
  });

  it('Give up from its menu ends it with no prize', () => {
    const { h } = onMap({ inventoryUnlocked: true });
    const { ends } = bonus(h, 'toad-house');
    h.tap('start');
    h.idle(8);
    h.tap('down');
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(ends).toEqual([{ kind: 'toad-house', prizes: [], gaveUp: true, played: false }]);
  });
});

/** Moves the memory cursor to card `i` and turns it. */
function turnCard(h: H, m: MemoryScene, i: number) {
  while (m.cursor !== i) {
    if (m.row !== Math.floor(i / 6)) h.tap('down');
    else h.tap('right');
  }
  h.tap('jump');
}

function cardsOf(m: MemoryScene, face: CardFace): number[] {
  return m.board.cards.flatMap((c, i) => (c.face === face ? [i] : []));
}

describe('N-spade', () => {
  it('pairs win their prizes (coins and 1-ups at once, items to the inventory); two misses end it', () => {
    const { h } = onMap({ inventoryUnlocked: true });
    const { scene, ends } = bonus(h, 'memory', 77);
    const m = scene as MemoryScene;
    const s = h.game.state;
    const lives = s.lives;
    const [c10a, c10b] = cardsOf(m, 'coin10');
    turnCard(h, m, c10a as number);
    turnCard(h, m, c10b as number);
    expect(s.coins).toBe(10);
    const [u1, u2] = cardsOf(m, '1up');
    turnCard(h, m, u1 as number);
    turnCard(h, m, u2 as number);
    expect(s.lives).toBe(lives + 1);
    const [sa, sb] = cardsOf(m, 'star');
    turnCard(h, m, sa as number);
    turnCard(h, m, sb as number);
    expect(h.game.bonus.inventory).toEqual(['star']);
    // Two misses.
    const mush = cardsOf(m, 'mushroom');
    const flow = cardsOf(m, 'flower');
    turnCard(h, m, mush[0] as number);
    turnCard(h, m, flow[0] as number);
    expect(m.board.misses).toBe(1);
    h.idle(MISS_FRAMES + 2);
    expect(m.board.cards[mush[0] as number]?.up).toBe(false);
    turnCard(h, m, mush[0] as number);
    turnCard(h, m, flow[0] as number);
    h.idle(MISS_FRAMES + 2);
    expect(m.board.over).toBe(true);
    closeCard(h);
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(ends[0]?.prizes).toEqual([
      { kind: 'coins', amount: 10 },
      { kind: 'lives', amount: 1 },
      { kind: 'item', item: 'star' },
    ]);
    expect(loadSave(1)?.coins).toBe(10);
  });

  it('a 20-coin pair over 100 coins makes a life', () => {
    const { h } = onMap({ inventoryUnlocked: true, coins: 90 });
    const { scene } = bonus(h, 'memory', 5);
    const m = scene as MemoryScene;
    const lives = h.game.state.lives;
    const [a, b] = cardsOf(m, 'coin20');
    turnCard(h, m, a as number);
    turnCard(h, m, b as number);
    expect(h.game.state.coins).toBe(10);
    expect(h.game.state.lives).toBe(lives + 1);
  });
});

describe('spade game', () => {
  /** Lines reel `r` up on the first `pic` of its strip (the reel is still running). */
  function aim(sl: SlotsScene, r: number, pic: string) {
    sl.machine.offsets[r] = (SLOT_STRIPS[r] as readonly string[]).indexOf(pic) * SLOT_CELL;
  }

  it('STOP stops the reels top to bottom; a full flower wins 3 lives', () => {
    const { h } = onMap({ inventoryUnlocked: true });
    const { scene, ends } = bonus(h, 'slots', 2);
    const sl = scene as SlotsScene;
    expect(sl.touchLabels()).toMatchObject({ jump: 'STOP' });
    const lives = h.game.state.lives;
    for (let r = 0; r < 3; r++) {
      aim(sl, r, 'flower');
      sl.stopReel();
      expect(sl.machine.next).toBe(r + 1);
    }
    h.idle(RESULT_DELAY + 2);
    expect(h.game.state.lives).toBe(lives + 3);
    closeCard(h);
    expect(ends[0]?.prizes).toEqual([{ kind: 'lives', amount: 3 }]);
  });

  it('a mismatch wins nothing; one try', () => {
    const { h } = onMap({ inventoryUnlocked: true });
    const { scene, ends } = bonus(h, 'slots', 2);
    const sl = scene as SlotsScene;
    const lives = h.game.state.lives;
    aim(sl, 0, 'star');
    h.tap('jump');
    aim(sl, 1, 'star');
    h.tap('jump');
    aim(sl, 2, 'mushroom');
    h.tap('jump');
    expect(sl.machine.done).toBe(true);
    h.idle(RESULT_DELAY + 2);
    expect(h.game.state.lives).toBe(lives);
    closeCard(h);
    expect(ends[0]?.prizes).toEqual([]);
    expect(h.top()).toBeInstanceOf(WorldMapScene);
  });
});

/** A file on World 4 standing on the bonus spot, Larry beaten (the crystal ball's secret). */
const W3 = ['1-0', '1-1', '1-2', '1-3', '1-4', '2-1', '2-2', '2-3', '2-4', '3-1', '3-2', '3-3', '3-4'];
const onBonusSpot = (over: Partial<SaveFile> = {}) =>
  onMap({
    cleared: [...W3, '4-1'],
    pages: ['smb-1', 'smb-2', 'smb-3', 'smb-4'],
    position: { page: 'smb-4', node: 'bonus-4' },
    secrets: ['larry'],
    ...over,
  });

/** Gives up from the open bonus game's menu. */
function giveUp(h: H) {
  h.tap('start');
  h.idle(8);
  h.tap('down');
  h.tap('jump');
}

describe("World 4's bonus spot plays the bonus games in rotation", () => {
  it('JUMP on the open node plays the next game; played, it is used and the rotation moves on', () => {
    const { h } = onBonusSpot();
    const map = h.top() as WorldMapScene;
    expect(map.hintLine).toBe('TOAD HOUSE');
    h.tap('jump');
    const house = h.top() as ToadHouseScene;
    expect(house).toBeInstanceOf(ToadHouseScene);
    h.idle(25);
    h.tap('jump'); // OPEN the middle chest
    h.idle(OPEN_FRAMES + 65);
    closeCard(h);
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.game.bonusOpen).toBe(false);
    expect(h.game.bonus.inventory).toEqual([house.chests[1]]);
    expect(loadSave(1)?.bonusNext).toBe(1);
    expect(nextBonusKind(loadSave(1) as SaveFile)).toBe('memory');
  });

  it('the next visits are the N-spade, then the spade game, then the Toad House again', () => {
    for (const [n, kind, scene] of [
      [1, 'N-SPADE', MemoryScene],
      [2, 'SPADE GAME', SlotsScene],
      [3, 'TOAD HOUSE', ToadHouseScene],
    ] as const) {
      const { h } = onBonusSpot({ bonusNext: n % 3 });
      expect((h.top() as WorldMapScene).hintLine).toBe(kind);
      h.tap('jump');
      expect(h.top()).toBeInstanceOf(scene);
    }
  });

  it('giving up before any choice leaves it open, the same game next time; after a choice it is used', () => {
    let { h } = onBonusSpot({ bonusNext: 2 });
    h.tap('jump');
    h.idle(25);
    giveUp(h);
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.game.bonusOpen).toBe(true);
    expect(h.game.bonus.bonusNext).toBe(2);
    ({ h } = onBonusSpot({ bonusNext: 2 }));
    h.tap('jump');
    h.idle(25);
    h.tap('jump'); // the top reel stops
    giveUp(h);
    expect(h.game.bonusOpen).toBe(false);
    expect(loadSave(1)?.bonusNext).toBe(0);
  });

  it('the first choice closes the spot and saves before any prize: a reload finds it closed, the prize kept', () => {
    const { h } = onBonusSpot();
    h.tap('jump');
    const house = h.top() as ToadHouseScene;
    h.idle(25);
    h.tap('jump'); // OPEN: decided, nothing given yet
    let saved = loadSave(1) as SaveFile;
    expect(saved.bonusOpen).toBe(false);
    expect(saved.bonusNext).toBe(1);
    expect(saved.inventory).toEqual([]);
    h.idle(OPEN_FRAMES + 5); // the prize is given (and saved) here
    saved = loadSave(1) as SaveFile;
    expect(saved.inventory).toEqual([house.chests[1]]);
    // A reload: a fresh game opens the file.
    const r = makeGame();
    r.game.deps.settings = { dev: false } as Settings;
    r.game.openFile(1);
    r.idle(8);
    const map = r.top() as WorldMapScene;
    expect(r.game.bonusOpen).toBe(false);
    expect(r.game.bonus.inventory).toEqual([house.chests[1]]);
    r.tap('jump');
    expect(r.top()).toBe(map); // no way in
  });

  it('the spade game: no Give up once the last reel stops; the lives always come', () => {
    const { h } = onBonusSpot({ bonusNext: 2 });
    h.tap('jump');
    const sl = h.top() as SlotsScene;
    h.idle(25);
    const lives = h.game.state.lives;
    for (let r = 0; r < 3; r++) {
      sl.machine.offsets[r] = (SLOT_STRIPS[r] as readonly string[]).indexOf('mushroom') * SLOT_CELL;
      sl.stopReel();
    }
    h.tap('start');
    expect(h.top()).toBe(sl);
    h.idle(RESULT_DELAY + 2);
    expect(h.game.state.lives).toBe(lives + 2);
  });
});

describe('the Hammer Bro prize', () => {
  it('awardHammerPrize gives a mushroom, flower or star into the inventory', () => {
    const { h } = onMap({ inventoryUnlocked: true });
    const out = awardHammerPrize(h.game, 4);
    expect(out.stored).toBe(true);
    expect(['mushroom', 'flower', 'star']).toContain(h.game.bonus.inventory[0]);
    expect(loadSave(1)?.inventory).toHaveLength(1);
  });
});

describe('Dev → Bonus games', () => {
  it('lists the three games and plays one; nothing sticks', () => {
    const { h } = onMap({}, true);
    const before = { lives: h.game.state.lives, bonus: { ...h.game.bonus } };
    h.game.scenes.push(new DevMenuScene(h.game, true));
    const dev = h.top() as MenuScene;
    expect(labels(dev)).toContain('Bonus games');
    h.idle(8);
    toRow(h, dev, 'Bonus games');
    h.tap('jump');
    const list = h.top() as DevBonusGamesScene;
    expect(list).toBeInstanceOf(DevBonusGamesScene);
    expect(labels(list)).toEqual(['Toad house', 'N-spade', 'Spade game', 'Back']);
    list.play('slots', 1);
    const sl = h.top() as SlotsScene;
    h.idle(25);
    for (let r = 0; r < 3; r++) {
      sl.machine.offsets[r] = (SLOT_STRIPS[r] as readonly string[]).indexOf('star') * SLOT_CELL;
      sl.stopReel();
    }
    h.idle(RESULT_DELAY + 2);
    closeCard(h);
    expect(h.top()).toBeInstanceOf(MessageScene);
    expect(list.lastResult?.prizes).toEqual([{ kind: 'lives', amount: 5 }]);
    expect(h.game.state.lives).toBe(before.lives);
    expect(h.game.bonus).toEqual(before.bonus);
    expect(h.game.campaign).not.toBeNull();
    h.idle(35);
    h.tap('jump');
    expect(h.top()).toBe(list);
  });
});
