import type { CharacterDef } from '../character';
import type { PickupKind } from '../../entities/objects/pickup';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';

/**
 * Classic SMBC heroes' own sounds (0.5.0, GAP_LIST_0.5.0 G-071 to G-073; content/sfx/hero-sounds.ts):
 * the take-damage, hit-enemy, kill-enemy and pickup sounds each hero's original class plays
 * (Link.as 1004-1047, 1102, 1143, 1320; Simon.as 984, 1086, 1105, SimonProjectile.as 218-225;
 * MegaManBase.as 845, 1702-1707, 2362; Samus.as 620, 1195; Ryu.as 1334). A hero or a sound with
 * no entry keeps the shared one. The armour sounds stay the weapons' own `blockedSfx` (HP-C14:
 * `armour`, Samus's `bump`), which already tell the heroes apart. Only Classic code reads it
 * (power.ts and the Classic enemy door), so a Current def never meets it.
 */
export interface ClassicHeroSounds {
  /** Taking a hit (in place of Mario's `pipe`). */
  hurt?: string;
  /** A hit that takes an enemy's hit points (in place of `hurt-enemy`). */
  hit?: string;
  /** An enemy defeated by the hero's attack (none shared). */
  kill?: string;
  /** Picking up a drop, by kind (in place of `pickup`). */
  pickups?: Partial<Record<PickupKind, string>>;
}

const MEGAMAN: ClassicHeroSounds = {
  hurt: 'mm-hurt',
  hit: 'mm-hit',
  kill: 'mm-kill',
  pickups: { 'weapon-small': 'mm-energy', 'weapon-large': 'mm-energy' },
};

/** Each hero's sounds by def id (Bass and Proto Man share Mega Man's, as in the original). */
export const CLASSIC_HERO_SOUNDS: Readonly<Record<string, ClassicHeroSounds>> = {
  link: {
    hurt: 'link-hurt',
    hit: 'link-hit',
    kill: 'link-kill',
    pickups: {
      'heart-small': 'link-heart',
      'heart-large': 'link-heart',
      bomb: 'link-item',
      'arrow-pack': 'link-item',
    },
  },
  megaman: MEGAMAN,
  bass: MEGAMAN,
  protoman: MEGAMAN,
  samus: {
    hurt: 'samus-hurt',
    hit: 'samus-hit',
    pickups: { 'missile-pack': 'samus-missile-get' },
  },
  simon: {
    hurt: 'cv-hurt',
    hit: 'cv-hit',
    kill: 'cv-kill',
    pickups: { 'heart-small': 'cv-heart', 'heart-large': 'cv-heart' },
  },
  // Bill's hit is an electric shock (Bill.as 899, SFX_BILL_ELECTRECUTE).
  bill: { hurt: 'bill-shock' },
  ryu: {
    hurt: 'ng-hurt',
    hit: 'ng-hit',
    kill: 'ng-kill',
    pickups: { 'ninpo-small': 'ng-pickup', 'ninpo-large': 'ng-pickup' },
  },
};

/** Hero `def`'s own `kind` sound, else `fallback` (the shared one). */
export function heroSound(
  def: Pick<CharacterDef, 'id'> | null | undefined,
  kind: Exclude<keyof ClassicHeroSounds, 'pickups'>,
  fallback: string,
): string;
export function heroSound(
  def: Pick<CharacterDef, 'id'> | null | undefined,
  kind: Exclude<keyof ClassicHeroSounds, 'pickups'>,
  fallback?: undefined,
): string | undefined;
export function heroSound(
  def: Pick<CharacterDef, 'id'> | null | undefined,
  kind: Exclude<keyof ClassicHeroSounds, 'pickups'>,
  fallback?: string,
): string | undefined {
  return (def ? CLASSIC_HERO_SOUNDS[def.id]?.[kind] : undefined) ?? fallback;
}

/** Hero `def`'s sound for picking up `kind`, else the shared `pickup`. */
export function pickupSound(def: Pick<CharacterDef, 'id'> | null | undefined, kind: PickupKind): string {
  return (def ? CLASSIC_HERO_SOUNDS[def.id]?.pickups?.[kind] : undefined) ?? 'pickup';
}

/**
 * A landing sound (G-070; MegaManBase.as 2704, Bill.as 925): call every frame from the hero's
 * update; `id` plays on the first frame back on the ground after any time in the air.
 */
export function landSound(p: Player, world: World, id: string): void {
  if (!p.body.onGround) {
    p.scratch._landAir = 1;
    return;
  }
  if (!p.scratch._landAir) return;
  delete p.scratch._landAir;
  world.audio.sfx(id);
}
