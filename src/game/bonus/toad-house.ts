import type { InputFrame } from '@engine/input/input-manager';
import type { Action } from '@engine/input/actions';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { toPx } from '@engine/math/units';
import { levelTouchLabels } from '../touch-labels';
import type { Game } from '../scenes/game';
import { wrapText } from '../hud/text';
import { renderSmb3World, SMB3_WORLD_SHIFT } from '../hud/smb3-status';
import { parseTextMap } from '../level/textmap';
import type { LevelData } from '../level/schema';
import { World } from '../world/world';
import { newGameState } from '../context';
import { BONUS_MUSIC, BONUS_SFX, drawChest, drawItem, drawToad } from './art';
import { BonusScene, centred, drawTextBox, fitLine, HINT_Y, type BonusResult } from './common';
import { dealChests } from './rules';
import { ITEM_SPOKEN, type ItemId } from './items';
import source from './toad-house.map?raw';

/** Toad's line (SMB3's, word for word). */
export const TOAD_LINE = 'PICK A BOX. ITS CONTENTS WILL HELP YOU ON YOUR WAY.';
/** Chests' left edges (room px) and the floor they stand on (the top of the map's row 13). */
export const CHEST_X: readonly number[] = [72, 120, 168];
const FLOOR_Y = 13 * 16;
const CHEST_Y = FLOOR_Y - 16;
/** Toad's left edge (room px): at the back on the right, facing the chests and the door. */
const TOAD_X = 208;
/** The hero walks in on his own until his centre is this far in (room px). */
export const ENTRY_X = 32;
/** How near (px, centre to centre) the hero must stand to a chest to open it. */
const REACH = 10;
/** Frames from the lid opening to the prize being given (it rises out meanwhile). */
export const OPEN_FRAMES = 40;

let room: LevelData | null = null;

/** The house's one room (toad-house.map), parsed once. */
export function toadHouseRoom(): LevelData {
  room ??= parseTextMap(source, 'toad-house');
  return room;
}

/** Input that holds the d-pad right and nothing else: the walk in through the door. */
const WALK_IN: InputFrame = {
  held: (a: Action) => a === 'right',
  pressed: () => false,
  released: () => false,
  bufferedJump: () => false,
  consumeJumpBuffer: () => undefined,
  dirX: 1,
};

/**
 * SMB3's Toad House: the hero walks in from the left (on his own, a few steps), Toad's line shows
 * at the top, and three chests stand on the floor. The hero walks (and jumps) about with his own
 * moves in a real World and opens the chest he stands by with OPEN (ATTACK); the other two are
 * gone at once (one pick), and the opened chest's prize (mushroom 50%, fire flower 35%, star 15%,
 * rolled from the seed as the house opens) rises out and goes into the item inventory with a
 * banner; then the result card and OK end it. The room is SMB3's: drawn above its status bar.
 */
export class ToadHouseScene extends BonusScene {
  protected music = BONUS_MUSIC.toadHouse;
  /** The three chests' contents, left to right. */
  readonly chests: ItemId[];
  readonly world: World;
  /** The walk in is over: the player has the hero. */
  entered = false;
  /** The chest opened and the frame it opened, or null while picking. */
  opened: { index: number; t: number } | null = null;
  /** The chest the hero last stood by (said once on arrival). */
  private by: number | null = null;

  constructor(game: Game, seed: number, onEnd: (r: BonusResult) => void) {
    super(game, 'toad-house', seed, onEnd);
    this.chests = dealChests(this.rng);
    // The hero as he is in the run, in a state of the room's own (nothing here touches the run).
    const state = newGameState(game.state.character);
    state.powerState = game.state.powerState;
    this.world = new World(toadHouseRoom(), game.ctx, state, { mode: 'stand', seed });
    this.world.time = null;
    this.world.backdrop = (r) => this.drawRoom(r);
  }

  protected get decided(): boolean {
    return this.opened !== null;
  }

  protected intro(): string {
    return `Toad: Pick a box. Its contents will help you on your way. Walk up to a box and ${this.hint('open', 'attack')} it.`;
  }

  protected playLabels(): TouchLabels {
    const near = this.opened ? null : this.nearChest();
    const labels = levelTouchLabels(this.world.player, this.world);
    return { ...labels, attack: near !== null ? 'OPEN' : null, start: null };
  }

  /** The chest the hero stands by on the floor (null: none, or one is already open). */
  nearChest(): number | null {
    if (this.opened) return null;
    const p = this.world.player;
    if (!p.body.onGround || toPx(p.body.y + p.body.h) !== FLOOR_Y) return null;
    const cx = toPx(p.body.x + p.body.w / 2);
    const i = CHEST_X.findIndex((x) => Math.abs(cx - (x + 8)) <= REACH);
    return i < 0 ? null : i;
  }

  protected play(input: InputFrame): void {
    const p = this.world.player;
    if (!this.entered && toPx(p.body.x + p.body.w / 2) >= ENTRY_X) this.entered = true;
    this.world.update([this.entered && !this.opened ? input : this.entered ? WALK_STILL : WALK_IN]);
    this.world.events.splice(0);
    const o = this.opened;
    if (o) {
      if (this.t - o.t === OPEN_FRAMES) {
        const item = this.chests[o.index] as ItemId;
        this.award({ kind: 'item', item });
        this.sfx(BONUS_SFX.win);
      }
      if (this.t - o.t >= OPEN_FRAMES + 60) this.finish(this.banner?.lines ?? []);
      return;
    }
    if (!this.entered) return;
    const near = this.nearChest();
    if (near !== null && near !== this.by) this.say(`Box ${near + 1}. ${this.hint('Open', 'attack')} it?`);
    this.by = near;
    if (near !== null && input.pressed('attack')) this.open(near);
  }

  /** Opens chest `index` (tests call this as OPEN by it would); one pick only. */
  open(index: number): void {
    if (this.opened) return;
    this.markPlayed();
    this.opened = { index, t: this.t };
    this.sfx(BONUS_SFX.open);
    this.say(`Box ${index + 1}: ${ITEM_SPOKEN[this.chests[index] as ItemId]}!`);
  }

  /** The room behind the hero (room px; the world draws it moved up with itself): Toad and the chests. */
  private drawRoom(r: Renderer): void {
    const assets = this.game.ctx.assets;
    drawToad(r, assets, TOAD_X, FLOOR_Y - 24, true);
    const o = this.opened;
    CHEST_X.forEach((x, i) => {
      // One pick: once a chest is open the other two are gone.
      if (o && o.index !== i) return;
      drawChest(r, assets, o?.index === i, x, CHEST_Y);
      if (!o) return;
      const k = Math.min(1, (this.t - o.t) / OPEN_FRAMES);
      drawItem(r, assets, this.chests[i] as ItemId, x, CHEST_Y - 4 - Math.round(24 * k));
    });
  }

  protected draw(r: Renderer): void {
    const font = this.game.ctx.assets.sheet('font');
    renderSmb3World(r, this.world);
    // Toad's words at the top of the room.
    drawTextBox(r, font, wrapText(TOAD_LINE, 26), 8);
    if (this.entered && !this.opened && !this.banner) {
      const full = `WALK TO A BOX  ${this.hint('OPEN', 'attack')}`;
      centred(r, font, fitLine(full, 'WALK TO A BOX  OPEN'), HINT_Y - SMB3_WORLD_SHIFT - 64);
    }
  }
}

/** Nothing held: the hero stands while the chest gives up its prize. */
const WALK_STILL: InputFrame = { ...WALK_IN, held: () => false, dirX: 0 };
