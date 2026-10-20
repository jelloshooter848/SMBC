import type { SwimProfile } from '../characters/profile';

/**
 * Classic SMBC's water numbers per hero (`2026-10-07-classic-swimming.md`, SW-C1..SW-C10), for the
 * Classic defs' movement profiles: `movement: { ...LAND, swim: CLASSIC_SWIM.link }`. Units are
 * 1/4096 px per frame (per frame² for gravity).
 *
 * - Every hero: the surface line at the hitbox top (SW-C9) and the shared sink cap 2.0833 px/f
 *   (`Character.as vyMaxPsvWater = 250`).
 * - Mario and Luigi stroke anywhere below the line (Current's own values, `mario/profile.ts`), walk
 *   slowly on the sea floor, never stomp under water (SW-C7), and above the line fall with
 *   0.09722 px/f² capped at 3.3333 px/f (SW-C10).
 * - The other six jump from the floor only (`floorJumpOnly`). `stroke` is their water jump take-off
 *   less one frame of water gravity, because our player moves before gravity and the original
 *   adds gravity first (SW-C3): then the arcs match frame for frame. Their walk speed stays their
 *   land one (the Classic land profile's `maxWalk`).
 * - Link also has his own fall cap above the line (SW-C10: land gravity, 4.1667 px/f); the others
 *   use their Classic land values there.
 */
const SINK = 0x02155;

const PLUMBER: SwimProfile = {
  stroke: 0x01aab, // 200 px/s: 1.6667 px/f
  gravity: 0x000c7, // 350: 0.04861 px/f²
  sinkMax: SINK,
  floorWalk: 0x00c00, // 90: 0.75 px/f
  surfaceTest: 'top',
  noStomp: true,
  surface: { gravity: 0x0018e, fallMax: 0x03555 }, // 700 / 400
  // PitVacuum (G-013): vertPullPwr 600, horzPullPwr 400 px/s²; MarioBase's water vyMaxPsv 400.
  pitPull: { down: 0x002ab, side: 0x001c7, fallMax: 0x03555 },
};

/** A floor jumper: take-off already less one frame of `gravity`. */
const floorJumper = (stroke: number, gravity: number, extra: Partial<SwimProfile> = {}): SwimProfile => ({
  stroke,
  gravity,
  sinkMax: SINK,
  floorJumpOnly: true,
  surfaceTest: 'top',
  ...extra,
});

export const CLASSIC_SWIM: Readonly<Record<string, SwimProfile>> = {
  mario: PLUMBER,
  luigi: PLUMBER,
  // Peach (PE-20, D-PE-9): no stroke and no float, a floor jump on her rise path's seabed mode
  // with Link's numbers (T): apex about 123 px; floor walk at her walk speed.
  peach: { stroke: 0x0418e, gravity: 0x0011c, sinkMax: SINK, mode: 'seabed', surfaceTest: 'top' },
  // 500 px/s jump (0x042AB), water gravity 500 (0x0011C): apex 123 px. Above the line his land
  // gravity 1300 (0x002E4) and VY_MAX_PSV water 500 (0x042AB).
  link: floorJumper(0x0418e, 0x0011c, { surface: { gravity: 0x002e4, fallMax: 0x042ab } }),
  // Land jump 500 (0x042AB), water gravity 400 (0x000E4): apex 154 px.
  samus: floorJumper(0x041c7, 0x000e4),
  // Land jump 565 (0x04B55), water gravity 750 (0x001AB): apex 104 px (and his air jump again).
  simon: floorJumper(0x049ab, 0x001ab),
  // Water jump 560 without a double jump (0x04AAB), water gravity 500 (0x0011C): apex 154 px.
  megaman: floorJumper(0x0498e, 0x0011c),
  // Land jump 550 (0x04955), water gravity 500 (0x0011C): apex 149 px.
  bill: floorJumper(0x04839, 0x0011c),
  // Water jump 400 (0x03555), water gravity 500 (0x0011C): apex 78 px.
  ryu: floorJumper(0x03439, 0x0011c),
  // Bass (BA-15): floor jump and double jump 500 (0x042AB), dash jump 650 (0x056AB), water
  // gravity 500 (0x0011C): apex about 123 px, 209 px from a dash.
  bass: floorJumper(0x0418e, 0x0011c, { slideJump: 0x0558e }),
  // Sir Arthur (AR-24, tuning values): Link's water numbers, a committed floor jump of about 123 px.
  arthur: floorJumper(0x0418e, 0x0011c),
};

/** Ryu's wall hops under water keep their land speeds (SW-C4): 2.5 and 3.5833 px/f. */
export const CLASSIC_RYU_WALL_HOPS = { low: 0x02800, high: 0x03955 } as const;
