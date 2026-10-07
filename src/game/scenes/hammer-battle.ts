import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import source from '@content/levels/hammer-battle.map?raw';
import { parseTextMap } from '../level/textmap';
import type { LevelData } from '../level/schema';
import { freshSeed, World } from '../world/world';
import { HammerBro } from '../entities/enemies/hammer-bro';
import { Projectile } from '../entities/projectiles/projectile';
import { carriedKit } from '../entities/player';
import { drawSmb3Status, renderSmb3World, smb3Status } from '../hud/smb3-status';
import { levelTouchLabels, NO_TOUCH_BUTTONS } from '../touch-labels';
import { CardScene } from './message';
import { PauseScene } from './pause';
import { abilityHint } from './hints';
import type { Game } from './game';
import { awardPrize, hammerPrizeItem, type AwardOutcome } from '../bonus/use';
import { drawChest, drawItem } from '../bonus/art';
import type { ItemId } from '../bonus/items';
import { toPx } from '@engine/math/units';
import { fontText } from '../hud/text';

/** Frames after the last Hammer Bro falls before their treasure chest drops. */
export const BATTLE_WIN_DELAY = 60;
/** The chest's left edge (room px): it drops in the middle of the arena onto the floor. */
export const BATTLE_CHEST_X = 120;
const FLOOR_Y = 13 * 16;
/** How near (px, centre to centre) a hero must stand to the chest to open it. */
const CHEST_REACH = 10;
/** Frames from the lid opening to the prize being given (it rises out meanwhile). */
export const BATTLE_CHEST_OPEN_FRAMES = 40;
/** The win card (at most 28 columns a line, the card's box). */
export const BATTLE_WON_CARD: readonly string[] = ['THE HAMMER BROS ARE BEATEN!', 'THE BONUS IS OPEN AGAIN.'];

let arena: LevelData | null = null;

/** The battle's one screen (content/levels/hammer-battle.map), parsed once. */
export function hammerArena(): LevelData {
  arena ??= parseTextMap(source, 'hammer-battle');
  return arena;
}

/**
 * The Hammer Bro battle (SMB3 style; docs/WORLD_MAP.md "The bonus spot and its Hammer Bro"): the
 * map's wandering Hammer Bro touched the hero, so the run fights two Hammer Bros (the SMB1
 * HammerBro enemy) on one locked screen with two brick rows, with no clock. The run's lives,
 * power, score and coins carry in and out. Beating both: as in SMB3 a treasure chest drops into
 * the middle of the arena; the hero walks up to it and opens it with OPEN (ATTACK), its item
 * rises out into the inventory (campaign), then the win card and Game.hammerBattleWon (the bonus
 * opens again). Falling: Game.hammerBattleLost (a life lost, back to the map). Start pauses (the
 * usual pause menu; "Quit to map" leaves the battle undecided).
 */
export class HammerBattleScene implements Scene {
  readonly world: World;
  private over = false;
  private beatenFor = 0;
  /** The Hammer Bros' treasure chest once it drops: its top (room px), its fall speed, landed. */
  chest: { y: number; vy: number; landed: boolean } | null = null;
  /** The frames since the chest was opened, or null while shut. */
  openedFor: number | null = null;
  /** The chest's item (rolled from the battle's seed). */
  readonly item: ItemId;

  constructor(
    private readonly game: Game,
    seed = freshSeed(),
  ) {
    const arena = hammerArena();
    this.world = new World(arena, game.ctx, game.state, { mode: 'stand', seed });
    this.world.time = null;
    this.item = hammerPrizeItem(seed);
    this.world.backdrop = (r) => this.drawChest(r);
    // The HUD names the arena's place: World 4-2, the road the bonus spot is on.
    game.state.world = arena.world;
    game.state.stage = arena.stage;
  }

  enter(): void {
    this.game.ctx.audio.setTempoScale(1);
    this.game.ctx.audio.playMusic(this.world.level.music);
    this.game.deps.announcer?.say('Hammer Bro battle! Beat the Hammer Bros.');
  }

  /** The Hammer Bros still in the fight (none spawned yet counts as not beaten). */
  get brosLeft(): number {
    return this.world.entities.filter((e) => e instanceof HammerBro && e.alive).length;
  }

  update(input: InputFrame, inputs: InputFrame[] = [input]): void {
    if (this.over) return;
    // No pause once the chest is down: quitting then would lose the prize already won.
    if (!this.chest && inputs.some((f) => f.pressed('start')) && this.world.activePlayers().length > 0) {
      this.game.scenes.push(new PauseScene(this.game));
      return;
    }
    this.world.update(inputs);
    this.syncState();
    for (const ev of this.world.events.splice(0)) {
      if (ev.type !== 'died') continue;
      this.over = true;
      this.game.hammerBattleLost();
      return;
    }
    if (this.chest) return this.chestFrame(inputs);
    if (this.world.frame > 2 && this.brosLeft === 0 && this.world.activePlayers().length > 0) {
      if (++this.beatenFor >= BATTLE_WIN_DELAY) this.dropChest();
    }
  }

  /** Both beaten: their hammers go with them, the jingle plays and the chest drops from the top. */
  private dropChest(): void {
    const game = this.game;
    for (const e of this.world.entities)
      if (e instanceof Projectile && e.owner instanceof HammerBro) e.destroy();
    game.ctx.audio.stopMusic();
    game.ctx.audio.playJingle('castle-clear');
    this.chest = { y: 2 * 16, vy: 0, landed: false };
    game.deps.announcer?.say(
      `The Hammer Bros are beaten! A treasure chest fell. Walk up to it and ${abilityHint(game, 'open', 'attack')} it.`,
    );
  }

  /** A player standing by the landed, shut chest (on the floor, centred within reach), or null. */
  private byChest(): boolean {
    if (!this.chest?.landed || this.openedFor !== null) return false;
    return this.world.activePlayers().some((p) => {
      const b = p.body;
      const cx = toPx(b.x + b.w / 2);
      return b.onGround && toPx(b.y + b.h) === FLOOR_Y && Math.abs(cx - (BATTLE_CHEST_X + 8)) <= CHEST_REACH;
    });
  }

  /** The chest falls and lands; OPEN by it opens it; its item rises out, then the win. */
  private chestFrame(inputs: InputFrame[]): void {
    const c = this.chest;
    if (!c) return;
    if (!c.landed) {
      c.vy = Math.min(4, c.vy + 0.25);
      c.y += c.vy;
      if (c.y >= FLOOR_Y - 16) {
        c.y = FLOOR_Y - 16;
        c.landed = true;
        this.game.ctx.audio.sfx('bump');
      }
      return;
    }
    if (this.openedFor === null) {
      if (this.byChest() && inputs.some((f) => f.pressed('attack'))) this.open();
      return;
    }
    if (++this.openedFor >= BATTLE_CHEST_OPEN_FRAMES) this.win();
  }

  /** Opens the chest (as OPEN by it would). */
  open(): void {
    if (!this.chest?.landed || this.openedFor !== null) return;
    this.openedFor = 0;
    this.game.ctx.audio.sfx('powerup-appear');
  }

  private win(): void {
    this.over = true;
    const game = this.game;
    // SMB3 gives an item for beating them: into the inventory (or used at once when it is full).
    const prize: AwardOutcome | null = game.campaign
      ? awardPrize(game, { kind: 'item', item: this.item })
      : null;
    if (prize) game.ctx.audio.sfx('bonus-win');
    const card = [...BATTLE_WON_CARD, ...(prize ? ['', ...prize.lines.map(fontText)] : [])];
    game.deps.announcer?.say(`${BATTLE_WON_CARD.join(' ')} ${prize ? `${prize.said} ` : ''}OK to continue.`);
    game.scenes.push(
      new CardScene(game, card, () => game.hammerBattleWon(), this.world, 1800, {
        panel: true,
        keys: ['start', 'attack', 'jump'],
        prompt: () => abilityHint(game, 'OK', 'jump'),
      }),
    );
  }

  /** Mirror the players' power into the run (as LevelScene does). */
  private syncState(): void {
    const s = this.game.state;
    const p = this.world.player;
    s.powerState = p.powerState;
    s.hp = p.hp;
    s.kit = carriedKit(p);
    const p2 = this.world.players[1];
    if (p2) {
      s.powerState2 = p2.powerState;
      s.hp2 = p2.hp;
      s.kit2 = carriedKit(p2);
    }
  }

  touchLabels(): TouchLabels {
    if (this.over) return NO_TOUCH_BUTTONS;
    const labels = levelTouchLabels(this.world.players[0], this.world);
    return this.chest ? { ...labels, attack: this.byChest() ? 'OPEN' : null } : labels;
  }

  /** The chest (room px; the world draws it moved up with itself), its item rising once open. */
  private drawChest(r: Renderer): void {
    const c = this.chest;
    if (!c) return;
    const assets = this.game.ctx.assets;
    drawChest(r, assets, this.openedFor !== null, BATTLE_CHEST_X, Math.round(c.y));
    if (this.openedFor === null) return;
    const k = Math.min(1, this.openedFor / BATTLE_CHEST_OPEN_FRAMES);
    drawItem(r, assets, this.item, BATTLE_CHEST_X, Math.round(c.y) - 4 - Math.round(24 * k));
  }

  /** SMB3's look: the arena above SMB3's status bar (hud/smb3-status.ts), no HUD across the top. */
  render(r: Renderer): void {
    renderSmb3World(r, this.world);
    const ctx = this.game.ctx;
    const status = smb3Status(this.game.state, this.world.player, null);
    drawSmb3Status(r, ctx.assets, status, this.world.frame, ctx.reduceFlashing);
  }
}
