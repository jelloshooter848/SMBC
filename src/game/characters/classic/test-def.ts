import type { CharacterDef } from '../character';
import { CLASSIC_POWER_STATES } from '../character';
import type { PickupKind } from '../../entities/objects/pickup';
import { CLASSIC_SWIM } from '../../rules/classic-swim';
import {
  CLASSIC_DROPS,
  CLASSIC_HIT_RESPONSES,
  CLASSIC_STAR_MUSIC_LEFT,
  classicBlockPowerUp,
  classicBusy,
  classicDrop,
  classicLook,
  classicOnHurt,
  classicOnPowerUp,
  classicPickup,
  classicRespawn,
  classicStartKit,
  type ClassicAmmo,
  type ClassicDropTable,
  type ClassicPowerKit,
} from './power';

/** What a stand-in may override (everything else comes from the shared Classic tables). */
export interface ClassicStandInOptions {
  kit?: Partial<ClassicPowerKit>;
  drops?: ClassicDropTable;
  ammo?: Partial<Record<PickupKind, ClassicAmmo>>;
  start?: Record<string, number>;
  hudAmmo?: CharacterDef['hudAmmo'];
}

/**
 * A minimal Classic def built on a Current def (shared tests and dev checks before the hero slices
 * land): the Current def's body, sprites and land movement, with Classic power states (PS-C1),
 * hit response and look (PS-C10, PS-C13), drops (PS-C15), Star (PS-C19) and water numbers
 * (CLASSIC_SWIM). Mario and Luigi keep their fireballs and stomp; the others have no attacks and
 * never stomp. Never registered in CLASSIC_CHARACTERS: the hero slices write the real defs.
 */
export function classicStandIn(base: CharacterDef, opts: ClassicStandInOptions = {}): CharacterDef {
  const plumber = base.id === 'mario' || base.id === 'luigi';
  const response =
    CLASSIC_HIT_RESPONSES[base.id] ?? (CLASSIC_HIT_RESPONSES.mario as ClassicPowerKit['response']);
  const kit: ClassicPowerKit = { response, ...(plumber ? { grows: true } : {}), ...opts.kit };
  const drops = opts.drops ?? CLASSIC_DROPS[base.id];
  const start = opts.start ?? {};
  const swim = CLASSIC_SWIM[base.id];
  const def: CharacterDef = {
    ...base,
    rules: 'classic',
    damage: { kind: 'powerup', states: CLASSIC_POWER_STATES },
    movement: swim ? { ...base.movement, swim } : base.movement,
    stomps: plumber,
    blockPowerUp: classicBlockPowerUp,
    drawLook: (p, _frame, reduce) => classicLook(p, reduce, kit.response.look),
    starMusicLeft: CLASSIC_STAR_MUSIC_LEFT,
    drop: (rng, _e, killer) => (killer ? classicDrop(rng, killer, drops, 'enemy') : null),
    blockDrop: (rng, p, source) => classicDrop(rng, p, drops, source),
    behaviour: {
      update(p, input, world) {
        classicStartKit(p, start);
        if (classicBusy(p)) return;
        if (plumber) base.behaviour.update(p, input, world);
      },
      onPowerUp: (p, kind, world) => classicOnPowerUp(p, kind, world, kit),
      contactDamage: () => null,
      onHurt: (p, world, fromDir) => classicOnHurt(p, world, fromDir, kit),
      onPickup: (p, kind, world) => classicPickup(p, kind, world, opts.ammo ?? {}),
      onRespawn: (p) => classicRespawn(p, start),
    },
  };
  // A Classic def leaves out the Current HUD extras (TG-22, PS-C25).
  delete def.tools;
  delete def.meter;
  delete def.hudExtra;
  delete def.reserve;
  delete def.startHp;
  delete def.energyTanks;
  delete def.devKit;
  if (opts.hudAmmo) def.hudAmmo = opts.hudAmmo;
  return def;
}
