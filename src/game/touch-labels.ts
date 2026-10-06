import type { TouchLabels } from '@engine/input/touch';
import type { Player } from './entities/player';
import type { World } from './world/world';
import type { ToolInfo } from './characters/toolbelt';
import { activeTool } from './characters/toolbelt';

/**
 * What the touch buttons say in menus, and for any scene without its own `touchLabels`:
 * A confirms, B goes back, Start opens the menu; C and Select do nothing there.
 */
export const MENU_TOUCH_LABELS: Readonly<TouchLabels> = {
  jump: 'OK',
  attack: 'BACK',
  special: null,
  start: 'MENU',
  select: null,
};

/** Every button hidden: cut-scenes and cards that take no input. */
export const NO_TOUCH_BUTTONS: TouchLabels = {
  jump: null,
  attack: null,
  special: null,
  start: null,
  select: null,
};

/** Labels for a generic list menu (MenuScene): A picks, B goes back when there is a way back. */
export function menuTouchLabels(canGoBack: boolean): TouchLabels {
  // Start also picks and Select also goes back, but a second OK and BACK only add clutter.
  return { jump: 'OK', attack: canGoBack ? 'BACK' : null, special: null, start: null, select: null };
}

/**
 * C's caption for a belt hero: the selected tool's short name, hidden when nothing is selected
 * or it cannot be used right now (no ammo, not enough magic, boomerang still out).
 */
export function toolButton(
  tools: readonly ToolInfo[],
  p: Player,
  names: Record<string, string>,
): string | null {
  const t = activeTool(p, tools);
  if (!t || !t.usable) return null;
  return names[t.id] ?? t.id.toUpperCase();
}

/** Select's caption: shown only when there are two or more tools to cycle through. */
export function beltButton(tools: readonly ToolInfo[], label: string): string | null {
  return tools.length >= 2 ? label : null;
}

/**
 * The touch buttons during play, for player 1's hero (touch drives player 1 only). Level
 * defaults (A jumps, Start pauses, B/C hidden, Select only with a tool belt) under the hero's
 * own labels, then the states where a button does nothing whoever the hero is: on a vine
 * (no jumps or attacks there), out of the game, or unable to jump (morph ball). In water A swims.
 */
export function levelTouchLabels(p: Player | undefined, world: World): TouchLabels {
  const out: TouchLabels = { jump: 'JUMP', attack: null, special: null, start: 'MENU', select: null };
  if (!p) return out;
  const def = p.def;
  const tools = def.tools?.(p) ?? [];
  out.select = beltButton(tools, 'TOOLS');
  Object.assign(out, def.touchLabels?.(p, world));
  if (p.dead || p.out || p.vine) {
    out.jump = null;
    out.attack = null;
    out.special = null;
    out.select = null;
    return out;
  }
  const canJump = def.behaviour.canJump?.(p) ?? true;
  if (!canJump) out.jump = null;
  else if (p.inWater) out.jump = 'SWIM';
  return out;
}
