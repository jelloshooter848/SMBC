import type { MovementProfile } from '../profile';

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
 * fixed bouncePwr, above): the owner believes the original's lack of SMB1's held stomp bounce was
 * an oversight, so the Classic SMB heroes (Mario, Luigi and their looks, Peach, Yoshi and the
 * Yoshi mount) bounce off a stomped enemy as in SMB1. Source: the SMB1 disassembly (doppelganger's
 * SMBDIS.ASM), from memory: it could not be fetched here, so check these against it.
 * - The stomp: `SBnce: lda #$fc / sta Player_Y_Speed`, -4 px/f.
 * - The forces, by the speed tier ProcJumping picks from PlayerXSpeedAbsolute (cmp #$09, #$10,
 *   #$19, #$1c; Player_X_Speed is in 1/16 px/f): JumpMForceData $20, $20, $1E, $28, $28 while A
 *   is held, FallMForceData $70, $70, $60, $90, $90 otherwise (1/256 px/f², so x16 here). SMB1's
 *   Luigi has Mario's physics.
 * - JumpSwimSub: while rising with A held (this frame and the last) the force stays; otherwise
 *   it stores VerticalForceDown in VerticalForce, which nothing in the air sets back: a release
 *   latches the fall force to the landing (Player.stompGravity).
 * Simplification: the tier is picked from the speed at the stomp rather than at the last jump's
 * take-off. Unverified: as recalled, SMB1 also runs DumpFall while falling (vy >= 0), which would
 * leave the fall force set when a stomp lands; the held gravity from the stomp on is the owner's
 * rule (BUG-07), to be checked against the listing.
 */
const SMB1_TIERS = [
  { maxVx: 0x00900, initial: 0x04000, holdGravity: 0x00200, fallGravity: 0x00700 },
  { maxVx: 0x01000, initial: 0x04000, holdGravity: 0x00200, fallGravity: 0x00700 },
  { maxVx: 0x01900, initial: 0x04000, holdGravity: 0x001e0, fallGravity: 0x00600 },
  { maxVx: 0x01c00, initial: 0x05000, holdGravity: 0x00280, fallGravity: 0x00900 },
  { maxVx: Infinity, initial: 0x05000, holdGravity: 0x00280, fallGravity: 0x00900 },
] as const;

export const SMB1_STOMP_HELD: NonNullable<MovementProfile['stompHeld']> = {
  vy: 0x04000, // $FC
  tiers: SMB1_TIERS,
};
