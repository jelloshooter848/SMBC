export const LEVEL_ROWS = 15;
export const HUD_ROWS = 2; // the top 32 px are the HUD on the NES; the playfield is still 15 rows
export const SCREEN_TILES = 16;
/** SMB1 ticks the timer every 24 frames (400 units ≈ 160 s). */
export const TIMER_FRAMES = 24;
export const JUMP_BUFFER_FRAMES = 4;
/** Entities spawn when their column is this many px past the right edge of the camera. */
export const SPAWN_MARGIN_PX = 16;
export const DESPAWN_MARGIN_PX = 64;
/** Star invincibility length in frames (~10 s). */
export const STAR_FRAMES = 600;
/** Frames the "hurry up" warning triggers at. */
export const HURRY_TIME = 100;
