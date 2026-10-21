import type { MovementProfile } from '../profile';
import { MARIO_PROFILE } from '../mario/profile';

/**
 * BUG-07: the original's stomp bounce (Character.bounce, Character.as 2610-2618): vy = -bouncePwr
 * with normal gravity, whether jump is held or not (it never reads jmpBtn). bouncePwr is 300
 * (Character.as 172) for every hero but Link, who sets 325 (Link.as 221, 409). Only Mario and Luigi
 * stomp of their own (MarioBase.as 278, 368); the others stomp with Everyone Can Stomp
 * (Character.canStomp, 3212-3220). 300 px/s at 60 fps on the original's 1x scale is 2.5 px/f here:
 * 0x2800 in velocity units of 1/4096 px/f (units.ts VEL; as mario/classic.ts has it).
 */
export const CLASSIC_STOMP_BOUNCE = 0x02800;

/** Link's bouncePwr 325: 325 / 120 px/f (2.708) = 0x2B55. */
export const LINK_CLASSIC_STOMP_BOUNCE = 0x02b55;

/**
 * BUG-07, by owner decision a deliberate departure from the original (which bounces every hero a
 * fixed bouncePwr, above): the Classic SMB heroes (Mario, Luigi and their looks, Peach, Yoshi and
 * the Yoshi mount) bounce as in SMB1, the campaign's own rule. SMB1 sets Player_Y_Speed to $FC
 * (-4 px/f) on a stomp and keeps the jump's VerticalForce while A is held and Mario rises
 * (JumpMForceData $20/$1E/$28 held, FallMForceData $70/$60/$90 otherwise, by the speed tier), so
 * holding JUMP bounces higher: MARIO_PROFILE.jump holds those numbers (1/4096 px/f²).
 */
export const SMB1_STOMP_HELD: NonNullable<MovementProfile['stompHeld']> = {
  vy: 0x04000,
  tiers: MARIO_PROFILE.jump,
};
