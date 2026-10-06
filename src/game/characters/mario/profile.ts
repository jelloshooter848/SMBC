import type { MovementProfile } from '../profile';

/**
 * SMB1 Mario movement constants, taken from the NES disassembly / community physics docs,
 * expressed in 1/4096 px per frame (0x1000 = 1 px/f). Speeds in SMB1 are 1/16 px/f bytes and
 * forces are 1/256 of that, so the hex values here are the ROM bytes shifted left by 4 or
 * used directly.
 */
export const MARIO_PROFILE: MovementProfile = {
  minWalk: 0x00130, // 0.074 px/f
  walkAccel: 0x00098, // 0.037 px/f²
  runAccel: 0x000e4, // 0.056 px/f²
  releaseDecel: 0x000d0, // 0.051 px/f²
  skidDecel: 0x001a0, // 0.102 px/f²
  maxWalk: 0x01900, // 1.5625 px/f
  maxRun: 0x02900, // 2.5625 px/f
  skidTurnaround: 0x00900, // 0.5625 px/f
  jump: [
    { maxVx: 0x01000, initial: 0x04000, holdGravity: 0x00200, fallGravity: 0x00700 }, // |vx| < 1.0
    { maxVx: 0x02500, initial: 0x04000, holdGravity: 0x001e0, fallGravity: 0x00600 }, // |vx| < 2.3125
    { maxVx: Infinity, initial: 0x05000, holdGravity: 0x00280, fallGravity: 0x00900 }, // running
  ],
  maxFall: 0x04800, // 4.5 px/f
  fallReset: 0x04000, // 4.0 px/f
  runTimerFrames: 10,
  airControl: 'smb1',
  canRun: true,
  variableJump: true,
  instantAccel: false,
  coyoteFrames: 0,
  // Under water (MarioBase.as setStats: JUMP_PWR_WATER = 200, water gravity 350,
  // walksSlowUnderWater; Character.as vyMaxPsvWater = 250, vxMaxGroundWater = 90). Flash px/s at
  // 32 px tiles: /2/60 per frame, /2/3600 per frame². Luigi (also a MarioBase) inherits it.
  swim: {
    stroke: 0x01aab, // 200 → 1.667 px/f: a stroke from rest rises about 28 px
    gravity: 0x000c7, // 350 → 0.049 px/f²
    sinkMax: 0x02155, // 250 → 2.083 px/f
    floorWalk: 0x00c00, // 90 → 0.75 px/f on the sea floor
  },
};
