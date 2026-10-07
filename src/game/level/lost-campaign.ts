/*
 * The Lost Levels in campaign play (docs/WORLD_MAP.md): their levels sit on the 'll-*' pages and
 * play like SMB's from the map. They are the story's extension (0.4.7): SMB World 8's castle
 * road leads on to Lost World 1, and the worlds open in order (1-8, 9, A-D), each castle's exit
 * opening the next page, whatever warps were taken. What is theirs alone:
 * - their warp zones stay as on the NES (backward ones too): a warp pipe opens only its target
 *   page and the map moves there (Game.campaignWarpToMap);
 * - their game ends (8-4, 9-4 with their cards, D-4 the final ending with the credits) return to
 *   the map, where the next world's road draws in (Game.showLostEnding).
 */

/** A Lost Levels level id ('ll-3-2', 'll-9-1-start'). */
export function isLostLevel(id: string): boolean {
  return id.startsWith('ll-');
}
