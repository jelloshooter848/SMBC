import type { CharacterDef, DamageModel } from '../../characters/character';
import type { MovementProfile } from '../../characters/profile';
import { MEGAMAN, MEGAMAN_PROFILE } from '../../characters/megaman';
import { Projectile, type ProjectileSpec } from '../../entities/projectiles/projectile';

/*
 * Mega Man in NES form, for Station Escape only (as bill/commando.ts is Bill's Contra form): the
 * campaign's MEGAMAN (characters/megaman, tuned by feel) is not touched. Checked against Mega
 * Man 1 and 2 on the NES, from memory of their published RAM/physics notes (not measured here):
 *
 * - Walking: 1.375 px a frame (1 + 0x60/256), instant start and stop. The campaign kit already
 *   matches it.
 * - Jumping: 4.87 px a frame up (4 + 0xDF/256) under 0.25 px/f² of gravity, rising or falling:
 *   an apex of about 3 tiles (about 50 px with the speed applied on the takeoff frame, our
 *   Player's NES order), against 4.3 tiles in the campaign. Letting go of JUMP still stops the
 *   rise at once, as in the original. High confidence on the two numbers.
 * - Fall speed: left at the campaign's 4.5 px a frame (the original's cap is higher, around
 *   7 px a frame, but that figure is uncertain, and no pit or drop here is deep enough to show it).
 * - Hit: a small push back with no upward pop (a jump in progress stops rising), the hurt pose,
 *   then the usual blinking.
 * - His shots (buster, charge shot; the Saw Disc already did) pass through walls and floors, as
 *   every Mega Man weapon does on the NES.
 */

/** Jump speed (vel units: 4.87 px/f) and gravity (0.25 px/f²). */
export const NES_JUMP_V = 0x04df0;
export const NES_GRAVITY = 0x00400;

export const NES_MEGAMAN_PROFILE: MovementProfile = {
  ...MEGAMAN_PROFILE,
  jump: [{ maxVx: Infinity, initial: NES_JUMP_V, holdGravity: NES_GRAVITY, fallGravity: NES_GRAVITY }],
};

const campaignDamage = MEGAMAN.damage as Extract<DamageModel, { kind: 'hp' }>;

/** The push back on a hit (vel units): the campaign's sideways push, nothing upward. */
export const NES_KNOCKBACK = { vx: campaignDamage.knockback?.vx ?? 0x00800, vy: 0 } as const;

/** Each shot kind's spec, made to pass through tiles (made once per kind). */
const throughWalls = new Map<ProjectileSpec, ProjectileSpec>();
function wallFree(spec: ProjectileSpec): ProjectileSpec {
  let s = throughWalls.get(spec);
  if (!s) {
    s = { ...spec, piercesTiles: true };
    throughWalls.set(spec, s);
  }
  return s;
}

/** Station Escape's Mega Man: MEGAMAN with the NES jump, knockback and wall-passing shots. */
export const NES_MEGAMAN: CharacterDef = {
  ...MEGAMAN,
  movement: NES_MEGAMAN_PROFILE,
  damage: { ...campaignDamage, knockback: { ...NES_KNOCKBACK } },
  behaviour: {
    ...MEGAMAN.behaviour,
    update(p, input, world) {
      const from = world.entities.length;
      MEGAMAN.behaviour.update?.(p, input, world);
      // The shots he fired this frame, again with the same place and speed, passing through walls.
      const end = world.entities.length;
      for (let i = from; i < end; i++) {
        const e = world.entities[i];
        if (!(e instanceof Projectile) || e.owner !== p || e.spec.piercesTiles) continue;
        e.destroy();
        const b = e.body;
        world.spawn(new Projectile(b.x, b.y, e.facing, wallFree(e.spec), p, { vx: b.vx, vy: b.vy }));
      }
    },
  },
};
