import type { InputFrame } from '@engine/input/input-manager';
import type { CharacterDef, DamageModel } from '../../characters/character';
import type { MovementProfile } from '../../characters/profile';
import { SIMON, SIMON_PROFILE } from '../../characters/simon';
import type { Player } from '../../entities/player';

/*
 * Simon in Castlevania form: a mini-game-only variant of his kit for Dracula's Castle (as
 * bill/commando.ts is Bill's Contra form). src/game/characters/simon is not touched: the
 * campaign keeps his tuned walk, his softer knockback and his walking whip. Checked against NES
 * Castlevania:
 *
 * - He walks at 1 px a frame from the first frame he walks, and stops dead when he lets go (no
 *   acceleration, no skid).
 * - The jump is the committed arc he already has (no steering, no hold-to-go-higher): straight
 *   up from a stand, 1 px a frame forward from a walk.
 * - Lashing the whip on the ground roots him: he cannot walk, turn or jump until the lash is
 *   done. In the air the jump's arc carries on.
 * - A hit turns him to face what hit him and throws him back in a fixed arc away from it. He has
 *   no control at all (no walking, whip or sub-weapon) until he lands. On stairs he is not
 *   thrown (the stairs keep him), as in Castlevania.
 */

/** Walking speed (velocity units: 1 px a frame). */
export const HUNTER_WALK = 0x01000;
/** The knockback arc: back at 1 px a frame, up at 2.75 px a frame (about 24 px high, 2 tiles long). */
export const KNOCK_VX = 0x01000;
export const KNOCK_VY = 0x02c00;

export const HUNTER_PROFILE: MovementProfile = {
  ...SIMON_PROFILE,
  minWalk: HUNTER_WALK,
  walkAccel: HUNTER_WALK,
  runAccel: HUNTER_WALK,
  releaseDecel: HUNTER_WALK,
  skidDecel: HUNTER_WALK,
  maxWalk: HUNTER_WALK,
  maxRun: HUNTER_WALK,
  skidTurnaround: HUNTER_WALK,
  instantAccel: true,
  airControl: 'none',
  variableJump: false,
  canRun: false,
  coyoteFrames: 0,
};

/** Whether Simon is in a knockback's arc (no control until he lands). */
export const knockedBack = (p: Player): boolean => (p.scratch.knock ?? 0) > 0;

/**
 * Simon's kit with Castlevania's movement and knockback. The world throws him (the def's
 * knockback, away from the hit); his own update turns him to face the hit and holds him helpless
 * until he lands.
 */
const SIMON_DAMAGE = SIMON.damage as Extract<DamageModel, { kind: 'hp' }>;

export const SIMON_HUNTER: CharacterDef = {
  ...SIMON,
  movement: HUNTER_PROFILE,
  damage: { ...SIMON_DAMAGE, knockback: { vx: KNOCK_VX, vy: KNOCK_VY } },
  behaviour: {
    ...SIMON.behaviour,
    update(p, input, world) {
      const b = p.body;
      if (knockedBack(p)) {
        const t = (p.scratch.knock ?? 0) + 1;
        p.scratch.knock = t;
        if (p.stairs || p.dead || (b.onGround && t > 2)) {
          // Landed (or kept on the stairs): control is back.
          p.scratch.knock = 0;
          p.stun = 0;
          if (b.onGround) b.vx = 0;
        } else {
          if (b.vx !== 0) p.facing = b.vx > 0 ? -1 : 1;
          p.stun = Math.max(p.stun, 1);
        }
      }
      SIMON.behaviour.update(p, input, world);
    },
    onHurt(p, world) {
      const r = SIMON.behaviour.onHurt(p, world);
      if (r === 'hurt' && !p.stairs) p.scratch.knock = 1;
      return r;
    },
  },
};

/**
 * The input Simon's body gets: no left, right or jump while a lash roots him on the ground (from
 * the frame he lashes), and nothing at all while a knockback carries him. The rest passes through.
 */
export function hunterInput(p: Player, input: InputFrame): InputFrame {
  if (knockedBack(p)) {
    return {
      held: (a) => a === 'start' && input.held(a),
      pressed: (a) => a === 'start' && input.pressed(a),
      released: (a) => input.released(a),
      bufferedJump: () => false,
      consumeJumpBuffer: () => input.consumeJumpBuffer(),
      dirX: 0,
    };
  }
  const lashing = p.attackTimer > 0 || (input.pressed('attack') && !(p.scratch.throwT ?? 0));
  if (!lashing || !p.body.onGround || p.stairs) return input;
  // (nor a jump: the lash plays out first)
  const walk = (a: string) => a === 'left' || a === 'right' || a === 'jump';
  return {
    held: (a) => !walk(a) && input.held(a),
    pressed: (a) => !walk(a) && input.pressed(a),
    released: (a) => input.released(a),
    bufferedJump: () => false,
    consumeJumpBuffer: () => input.consumeJumpBuffer(),
    dirX: 0,
  };
}
