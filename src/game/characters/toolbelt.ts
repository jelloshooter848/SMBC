import type { InputFrame } from '@engine/input/input-manager';
import type { Player } from '../entities/player';
import type { World } from '../world/world';

/** One entry on a character's tool belt (sub-weapons, spells, special weapons). */
export interface ToolInfo {
  id: string;
  /** Frame on the `items` sheet drawn in the HUD (8x8). */
  icon: string;
  /** Ammo / stored count shown next to the icon, or null for unlimited. */
  count: number | null;
  /** False when it cannot be used right now (no ammo, not enough magic). */
  usable: boolean;
}

/** Index of the selected tool (stored in the player's carried kit). */
export function toolIndex(p: Player, tools: readonly ToolInfo[]): number {
  const n = tools.length;
  if (n === 0) return 0;
  const i = p.scratch.tool ?? 0;
  return ((i % n) + n) % n;
}

export function activeTool(p: Player, tools: readonly ToolInfo[]): ToolInfo | null {
  return tools[toolIndex(p, tools)] ?? null;
}

/** Select cycles through the belt. Returns true when the selection changed this frame. */
export function cycleTool(p: Player, input: InputFrame, tools: readonly ToolInfo[], world: World): boolean {
  if (tools.length < 2 || !input.pressed('select')) return false;
  p.scratch.tool = (toolIndex(p, tools) + 1) % tools.length;
  world.audio.sfx('select');
  return true;
}
