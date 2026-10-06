import type { Action } from '@engine/input/actions';
import { describeCode, describePad } from '@engine/input/bindings';
import type { ControlScheme, Game } from './game';

/**
 * Player-facing text names abilities ("JUMP", "BACK", "TOOLS"), never arbitrary button letters.
 * With a keyboard or gamepad the real bound key or pad button follows in brackets.
 */

/** The controls in use: main.ts decides (touch pad shown, else a gamepad, else the keyboard). */
export function controlScheme(game: Game): ControlScheme {
  const live = game.deps.controlScheme?.();
  if (live) return live;
  return game.deps.settings?.input?.touch === 'on' ? 'touch' : 'keyboard';
}

/**
 * The key or pad button bound to `action` for `player` in the scheme in use, upper-cased
 * ("Z", "RIGHT SHIFT", "A"), or null on touch (the button carries the ability's name itself).
 * Touch only drives player 1, so player 2 is always described by their keys or pad.
 */
export function boundKey(
  game: Game,
  action: Action,
  player = 0,
  scheme: ControlScheme = controlScheme(game),
): string | null {
  const s = player > 0 && scheme === 'touch' ? 'keyboard' : scheme;
  if (s === 'touch') return null;
  const b = game.deps.settings?.input?.bindings?.[player];
  const code = s === 'gamepad' ? b?.gamepad[action]?.[0] : b?.keyboard[action]?.[0];
  if (!code) return null;
  return (s === 'gamepad' ? describePad(code) : describeCode(code)).toUpperCase();
}

/** "BACK" on touch, "BACK (X)" with a keyboard or pad: the ability, then the real key. */
export function abilityHint(game: Game, ability: string, action: Action, player = 0): string {
  const key = boundKey(game, action, player);
  return key && key !== ability ? `${ability} (${key})` : ability;
}
