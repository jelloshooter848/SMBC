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
import { drawHud } from '../hud/hud';
import { levelTouchLabels, NO_TOUCH_BUTTONS } from '../touch-labels';
import { CardScene } from './message';
import { PauseScene } from './pause';
import { abilityHint } from './hints';
import type { Game } from './game';
import { awardHammerPrize } from '../bonus/use';
import { fontText } from '../hud/text';

/** Frames after the last Hammer Bro falls before the win card. */
export const BATTLE_WIN_DELAY = 60;
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
 * power, score and coins carry in and out. Beating both: the win card, then Game.hammerBattleWon
 * (the bonus opens again). Falling: Game.hammerBattleLost (a life lost, back to the map).
 * Start pauses (the usual pause menu; "Quit to map" leaves the battle undecided).
 */
export class HammerBattleScene implements Scene {
  readonly world: World;
  private over = false;
  private beatenFor = 0;

  constructor(
    private readonly game: Game,
    seed = freshSeed(),
  ) {
    const arena = hammerArena();
    this.world = new World(arena, game.ctx, game.state, { mode: 'stand', seed });
    this.world.time = null;
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
    if (inputs.some((f) => f.pressed('start')) && this.world.activePlayers().length > 0) {
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
    if (this.world.frame > 2 && this.brosLeft === 0 && this.world.activePlayers().length > 0) {
      if (++this.beatenFor >= BATTLE_WIN_DELAY) this.win();
    }
  }

  private win(): void {
    this.over = true;
    const game = this.game;
    // Their hammers still in the air go with them.
    for (const e of this.world.entities)
      if (e instanceof Projectile && e.owner instanceof HammerBro) e.destroy();
    game.ctx.audio.stopMusic();
    game.ctx.audio.playJingle('castle-clear');
    // SMB3 gives an item for beating them: into the inventory (or used at once when it is full).
    const prize = game.campaign ? awardHammerPrize(game) : null;
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
    return this.over ? NO_TOUCH_BUTTONS : levelTouchLabels(this.world.players[0], this.world);
  }

  render(r: Renderer): void {
    this.world.render(r);
    drawHud(r, this.game.ctx.assets, this.game.state, null, this.world.frame, this.world.players, {
      covered: (x, y, w, h) => this.world.spriteIn(x, y, w, h),
    });
  }
}
