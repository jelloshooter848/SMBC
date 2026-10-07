import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { SCREEN_W } from '@engine/viewport';
import type { Game } from '../scenes/game';
import { abilityHint } from '../scenes/hints';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import { fontText, wrapText } from '../hud/text';
import { BONUS_SFX, drawItem } from './art';
import { fitLine } from './common';
import { INVENTORY_MAX, ITEM_NAMES, type ItemId } from './items';
import { inventoryAvailable, useInventoryItem, type UseOutcome } from './use';

/** The panel across the bottom of the map. */
export const PANEL_Y = 120;
const PANEL_H = 112;
const SLOT = 18;
const SLOTS_X = (SCREEN_W - INVENTORY_MAX * SLOT) >> 1;
const SLOTS_Y = PANEL_Y + 18;

/** What item `item` does for `game`'s player 1 hero, as the panel says it (the hero's guide's words). */
export function itemDoes(game: Game, item: ItemId): string {
  const hero = game.state.character;
  if (item === '1up') return 'One more life.';
  if (item === 'star') return 'Star power at the start of the next level.';
  return hero.guide.powerups.find((p) => p.item === item)?.does ?? 'A power-up.';
}

/**
 * The map's ITEMS panel (SMB3's item box): the inventory as a row of icons over the bottom of the
 * map. Left / right choose, USE uses the item on player 1's hero (useInventoryItem; refused when it
 * would do nothing), BACK closes. After a use the panel says what happened, and the next press
 * closes it.
 */
export class InventoryScene implements Scene {
  readonly translucent = true;
  cursor = 0;
  private t = 0;
  /** What the last use said; `ok` closes the panel on the next press. */
  note: (UseOutcome & { t: number }) | null = null;

  constructor(private readonly game: Game) {}

  private get items(): ItemId[] {
    return this.game.bonus.inventory;
  }

  enter(): void {
    this.game.ctx.audio.sfx('pause');
    this.say(true);
  }

  private say(opening = false): void {
    const hero = this.game.state.character.name;
    const items = this.items;
    const head = opening ? `Items for ${hero}, ${items.length} of ${INVENTORY_MAX}. ` : '';
    const item = items[this.cursor];
    const use = abilityHint(this.game, 'use', 'jump');
    const back = abilityHint(this.game, 'back', 'attack');
    const text = item
      ? `${head}${this.cursor + 1}: ${ITEM_NAMES[item].toLowerCase()}. ${itemDoes(this.game, item)} ${use} to use it, ${back} to close.`
      : `${head}No items yet. Toad Houses and spade games give them. ${back} to close.`;
    this.game.deps.announcer?.say(text);
  }

  touchLabels(): TouchLabels {
    if (this.note) return { ...NO_TOUCH_BUTTONS, jump: 'OK' };
    return { ...NO_TOUCH_BUTTONS, jump: this.items.length ? 'USE' : null, attack: 'BACK' };
  }

  update(input: InputFrame): void {
    this.t++;
    if (this.t < 6) return;
    const game = this.game;
    const audio = game.ctx.audio;
    if (this.note) {
      if (this.t - this.note.t < 10) return;
      if (['jump', 'attack', 'start', 'select'].some((a) => input.pressed(a as 'jump'))) {
        const ok = this.note.ok;
        this.note = null;
        if (ok || !this.items.length) this.close();
        else this.say();
      }
      return;
    }
    if (
      input.pressed('attack') ||
      input.pressed('select') ||
      input.pressed('start') ||
      input.pressed('special')
    ) {
      audio.sfx('select');
      this.close();
      return;
    }
    const n = this.items.length;
    const d = input.pressed('left') ? -1 : input.pressed('right') ? 1 : 0;
    if (d && n) {
      this.cursor = (this.cursor + d + n) % n;
      audio.sfx(BONUS_SFX.move);
      this.say();
      return;
    }
    if (input.pressed('jump')) this.use();
  }

  /** Uses the item under the cursor, as USE does. */
  use(): UseOutcome | null {
    const game = this.game;
    if (!inventoryAvailable(game) || !this.items.length) {
      game.ctx.audio.sfx(BONUS_SFX.miss);
      return null;
    }
    const out = useInventoryItem(game, this.cursor);
    if (!out) return null;
    game.ctx.audio.sfx(out.ok ? BONUS_SFX.use : BONUS_SFX.miss);
    this.cursor = Math.max(0, Math.min(this.cursor, this.items.length - 1));
    this.note = { ...out, t: this.t };
    game.deps.announcer?.say(`${out.said} OK to go on.`);
    return out;
  }

  private close(): void {
    this.game.scenes.pop();
  }

  render(r: Renderer): void {
    const game = this.game;
    const assets = game.ctx.assets;
    const font = assets.sheet('font');
    r.rect(8, PANEL_Y, SCREEN_W - 16, PANEL_H, '#fcfcfc');
    r.rect(10, PANEL_Y + 2, SCREEN_W - 20, PANEL_H - 4, '#000');
    const title = fontText(`ITEMS - ${game.state.character.hudName}`);
    r.text(font, title, 16, PANEL_Y + 6);
    const count = `${this.items.length}/${INVENTORY_MAX}`;
    r.text(font, count, SCREEN_W - 16 - count.length * 8, PANEL_Y + 6);
    for (let i = 0; i < INVENTORY_MAX; i++) {
      const x = SLOTS_X + i * SLOT;
      r.rect(x, SLOTS_Y, SLOT - 1, SLOT - 1, '#3c3c3c');
      r.rect(x + 1, SLOTS_Y + 1, SLOT - 3, SLOT - 3, '#0c0c0c');
      const item = this.items[i];
      if (item) drawItem(r, assets, item, x, SLOTS_Y);
    }
    const item = this.items[this.cursor];
    if (item && !this.note) {
      // The cursor: a white frame (steady, never blinking).
      const x = SLOTS_X + this.cursor * SLOT - 2;
      const y = SLOTS_Y - 2;
      r.rect(x, y, SLOT + 2, 2, '#fcfcfc');
      r.rect(x, y + SLOT, SLOT + 2, 2, '#fcfcfc');
      r.rect(x, y, 2, SLOT + 2, '#fcfcfc');
      r.rect(x + SLOT, y, 2, SLOT + 2, '#fcfcfc');
    }
    let lines: string[];
    if (this.note) lines = this.note.lines.map(fontText);
    else if (item) lines = [ITEM_NAMES[item], ...wrapText(itemDoes(game, item), 28).slice(0, 3)];
    else lines = ['NO ITEMS YET.', 'TOAD HOUSES AND SPADE', 'GAMES GIVE THEM.'];
    lines.forEach((l, i) => r.text(font, l, 16, SLOTS_Y + 26 + i * 10));
    if (game.bonus.starNext && !this.note)
      r.text(font, 'STAR READY FOR NEXT LEVEL', 16, PANEL_Y + PANEL_H - 22);
    const prompt = this.note
      ? fontText(`PRESS ${abilityHint(game, 'OK', 'jump')}`)
      : fitLine(
          `${item ? `${abilityHint(game, 'USE', 'jump')}  ` : ''}${abilityHint(game, 'BACK', 'attack')}`,
          item ? 'USE  BACK' : 'BACK',
        );
    r.text(font, prompt, 16, PANEL_Y + PANEL_H - 12);
  }
}
