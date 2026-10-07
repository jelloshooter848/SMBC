import type { Scene } from '@engine/scene';
import type { Game } from './game';
import type { LevelStart } from './level';
import type { GameState } from '../context';
import type { MiniGameResult } from '../minigames';
import { MiniGameMenuScene } from '../minigames/menu';
import { MenuScene } from './menu';
import { snapshot } from './free-hero';

/*
 * LARRY'S AIRSHIP CHALLENGE (docs/HEROES.md "Larry's airship"): the deck `4-2-airship` (an
 * auto-scrolling level) and Larry's room `4-2-larry`, played with the current hero(es) as real
 * levels but ending like a mini game round:
 *
 * - Boarding (campaign: any arrival in an airship area from elsewhere, Game.startLevel) snapshots
 *   the run (lives, power, score, coins, kit, 4-2's checkpoint) as it was before the airship.
 * - The clock does not run aboard (LevelScene hides it), and co-op respawns there are free.
 * - A death never costs a life: TRY AGAIN? YES retries from the deck's start, or from Larry's room
 *   once reached, with the run as it was when that area was first entered; NO goes back to 4-2 at
 *   its last checkpoint (the usual 4-2 respawn, fresh clock) with the pre-boarding run restored.
 * - MENU aboard: Continue / Give up (Give up = NO) and, in dev mode, the assists.
 * - Beating Larry: the crystal ball as before (LevelScene.takeCrystalBall → Game.takeCrystalBall,
 *   the campaign's hand-off to the map). The run ends there.
 *
 * Dev → Mini games → "Larry's airship" (AIRSHIP_CHALLENGE) plays deck + room as one round over the
 * dev list: the ball passes, a death fails, Give up quits, then the dev result card.
 */

/** The deck (auto-scroll) and Larry's room, by level id. */
export const AIRSHIP_DECK = '4-2-airship';
export const AIRSHIP_ROOM = '4-2-larry';
export const AIRSHIP_AREAS: readonly string[] = [AIRSHIP_DECK, AIRSHIP_ROOM];
export const AIRSHIP_TITLE = "LARRY'S AIRSHIP";

export const isAirshipArea = (levelId: string): boolean => AIRSHIP_AREAS.includes(levelId);

/** An area of the run and how it was entered, with the run as it was then (what a retry restores). */
interface Checkpoint {
  level: string;
  start: LevelStart;
  state: GameState;
}

/** Only the placement of a start (a retry has no carried clock and clears no enemies). */
const placement = (s: LevelStart): LevelStart => ({
  ...(s.x !== undefined ? { x: s.x } : {}),
  ...(s.y !== undefined ? { y: s.y } : {}),
  ...(s.mode !== undefined ? { mode: s.mode } : {}),
  // Boarded up 4-2's anchor chain: a retry climbs the chain again.
  ...(s.chain ? { chain: true } : {}),
});

/** One airship challenge in progress (Game.airship). */
export class AirshipRun {
  /** The run as it was before boarding: what NO / Give up restores. */
  readonly before: GameState;
  /** Where a retry starts: the deck as boarded, then Larry's room once reached. */
  retryAt: Checkpoint;
  /** The player has reached Larry's room. */
  reachedRoom = false;

  constructor(
    level: string,
    start: LevelStart,
    state: GameState,
    /** Dev round: how it ended (no retry prompt, no 4-2); null in the campaign. */
    readonly onDone: ((result: MiniGameResult) => void) | null = null,
    /** The scene the run's levels sit on (the dev list): level changes clear down to it. */
    readonly base: Scene | null = null,
  ) {
    this.before = snapshot(state);
    this.retryAt = { level, start: placement(start), state: snapshot(state) };
    if (level === AIRSHIP_ROOM) this.reachedRoom = true;
  }

  /**
   * Items held from the map were just given to player 1 at an airship area's start
   * (applyHeldItems, which empties the held list): the snapshots take the new power, so a retry
   * or NO neither loses them nor gives them twice.
   */
  itemsGiven(state: GameState): void {
    for (const s of [this.before, this.retryAt.state]) {
      s.powerState = state.powerState;
      s.hp = state.hp;
      s.kit = { ...state.kit };
    }
  }

  /** Game.startLevel: an airship area is being entered (a pipe or a retry). */
  entered(level: string, start: LevelStart, state: GameState): void {
    if (level === AIRSHIP_ROOM && !this.reachedRoom) {
      this.reachedRoom = true;
      this.retryAt = { level, start: placement(start), state: snapshot(state) };
    }
  }
}

/**
 * Start a run as an airship area is entered from outside (Game.startLevel). Campaign only: dev
 * select and `?level=` play the areas as plain levels.
 */
export function boardAirship(game: Game, level: string, start: LevelStart): void {
  if (!game.campaign || game.playtestDone) return;
  game.airship = new AirshipRun(level, start, game.state);
}

/** End the run and report it to a dev round; true when it was one. */
export function endDev(game: Game, result: MiniGameResult): boolean {
  const run = game.airship;
  if (!run?.onDone) return false;
  game.airship = null;
  run.onDone(result);
  return true;
}

/** YES: the deck from its start, or Larry's room once reached, with the run as it was then. */
export function retryAirship(game: Game): void {
  const run = game.airship;
  if (!run) return;
  Object.assign(game.state, snapshot(run.retryAt.state));
  game.state.time = null;
  game.startLevel(game.deps.getLevel(run.retryAt.level), { ...run.retryAt.start });
}

/**
 * NO / Give up: the run as it was before boarding, back in 4-2 at its last checkpoint (4-2's own
 * respawn rules: its start without one; a fresh clock), with no life lost. A dev round quits.
 */
export function leaveAirship(game: Game): void {
  if (endDev(game, 'quit')) return;
  const run = game.airship;
  game.airship = null;
  if (run) Object.assign(game.state, snapshot(run.before));
  const s = game.state;
  s.time = null;
  const cp = s.checkpoint;
  const main = cp?.level ?? game.deps.getLevel(AIRSHIP_DECK).parent ?? AIRSHIP_DECK;
  const start: LevelStart = cp
    ? { x: cp.x, y: cp.y ?? 12, mode: 'stand', clearEnemies: 'all' }
    : { mode: 'stand' };
  game.goToLevel(cp ? main : game.firstArea(main), start);
}

/** A death aboard (LevelScene's `died`): TRY AGAIN? YES / NO, no life lost. A dev round fails. */
export function airshipDied(game: Game): void {
  if (endDev(game, 'fail')) return;
  game.ctx.audio.sfx('bump');
  game.deps.announcer?.say('Try again?');
  game.scenes.push(
    new MenuScene(
      game,
      'TRY AGAIN?',
      [
        {
          label: 'Yes',
          select: () => retryAirship(game),
          hint: game.airship?.reachedRoom ? "From Larry's room" : 'From the start of the deck',
        },
        { label: 'No', select: () => leaveAirship(game), hint: 'Back to 4-2' },
      ],
      null,
    ),
  );
}

/** MENU aboard: Continue / Give up (= NO) and, in dev mode, the assists. */
export function airshipMenu(game: Game): Scene {
  const dev = game.airship?.onDone != null;
  return new MiniGameMenuScene(
    game,
    AIRSHIP_TITLE,
    () => leaveAirship(game),
    dev ? 'Ends the round' : 'Back to 4-2 as you left it',
  );
}

/** Larry's crystal ball taken aboard: a dev round passes (true); the campaign run just ends. */
export function airshipWon(game: Game): boolean {
  if (endDev(game, 'pass')) return true;
  game.airship = null;
  return false;
}

/**
 * The dev Mini games entry: deck + room as one round with the current hero, over the dev list
 * (DevMiniGamesScene.play pushes the deck; the run's level changes clear down to the list).
 */
export const AIRSHIP_CHALLENGE = {
  title: AIRSHIP_TITLE,
  who: 'LARRY KOOPA',
  create(game: Game, done: (result: MiniGameResult) => void): Scene {
    const start: LevelStart = { mode: 'stand' };
    const deck = game.deps.getLevel(AIRSHIP_DECK);
    // The HUD's WORLD is the airship's (4-2), not the last world played; the round's restore
    // puts the run's own back (DevMiniGamesScene.play). Set before the run snapshots the state,
    // so a retry keeps it too.
    game.state.world = deck.world;
    game.state.stage = deck.stage;
    game.airship = new AirshipRun(AIRSHIP_DECK, start, game.state, done, game.scenes.top ?? null);
    return game.levelScene(deck, start);
  },
};
