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
  /**
   * The hero's death sound, in place of the `death` jingle with the music stopped (G-065; Link.as
   * 1400, MegaManBase.as 2561, Bill.as 982, Sophia.as 2238). Simon's and Ryu's death is music
   * (scenes/original-music.ts), Samus's her burst's jingle.
   */
  death?: string;
  /** Picking up a drop, by kind (in place of `pickup`). */
  pickups?: Partial<Record<PickupKind, string>>;
  /**
   * The hero's default pickup sound (playDefaultPickupSoundEffect: Link.as 1673, Simon.as 1301,
   * MegaManBase.as 846, Samus.as 1465, Ryu.as 1536, Bill.as 1218): a drop with no sound of its own
   * in `pickups`, and the 1-up mushroom (which plays no regular sound in the original), in place
   * of `pickup` and `1up`.
   */
  item?: string;
}

const MEGAMAN: ClassicHeroSounds = {
  hurt: 'mm-hurt',
  hit: 'mm-hit',
  kill: 'mm-kill',
  death: 'mm-death',
  pickups: { 'weapon-small': 'mm-energy', 'weapon-large': 'mm-energy' },
  item: 'mm-1up',
};

/** Each hero's sounds by def id (Bass and Proto Man share Mega Man's, as in the original). */
export const CLASSIC_HERO_SOUNDS: Readonly<Record<string, ClassicHeroSounds>> = {
  link: {
    hurt: 'link-hurt',
    hit: 'link-hit',
    kill: 'link-kill',
    death: 'link-death',
    pickups: {
      'heart-small': 'link-heart',
      'heart-large': 'link-heart',
      bomb: 'link-item',
      'arrow-pack': 'link-item',
    },
    item: 'link-item',
  },
  megaman: MEGAMAN,
  bass: MEGAMAN,
  protoman: MEGAMAN,
  samus: {
    hurt: 'samus-hurt',
    hit: 'samus-hit',
    pickups: { 'missile-pack': 'samus-missile-get' },
    item: 'samus-energy',
  },
  simon: {
    hurt: 'cv-hurt',
    hit: 'cv-hit',
    kill: 'cv-kill',
    pickups: { 'heart-small': 'cv-heart', 'heart-large': 'cv-heart' },
    // Every pickup but a heart plays the sub-weapon sound (Simon.as 1128-1134).
    item: 'cv-weapon',
  },
  // Bill's hit is an electric shock (Bill.as 899, SFX_BILL_ELECTRECUTE).
  bill: { hurt: 'bill-shock', death: 'contra-death', item: 'bill-item' },
  sophia: { death: 'sophia-die' },
  ryu: {
    hurt: 'ng-hurt',
    hit: 'ng-hit',
    kill: 'ng-kill',
    pickups: { 'ninpo-small': 'ng-pickup', 'ninpo-large': 'ng-pickup' },
    item: 'ng-pickup',
  },
};

/** Hero `def`'s own `kind` sound, else `fallback` (the shared one). */
export function heroSound(
  def: Pick<CharacterDef, 'id' | 'lookOf'> | null | undefined,
  kind: Exclude<keyof ClassicHeroSounds, 'pickups'>,
  fallback: string,
): string;
export function heroSound(
  def: Pick<CharacterDef, 'id' | 'lookOf'> | null | undefined,
  kind: Exclude<keyof ClassicHeroSounds, 'pickups'>,
  fallback?: undefined,
): string | undefined;
export function heroSound(
  def: Pick<CharacterDef, 'id' | 'lookOf'> | null | undefined,
  kind: Exclude<keyof ClassicHeroSounds, 'pickups'>,
  fallback?: string,
): string | undefined {
  // A look sounds as its hero (CharacterDef.lookOf: Zelda as Link, Quick Man as Bass).
  return (
    (def ? (CLASSIC_HERO_SOUNDS[def.id] ?? CLASSIC_HERO_SOUNDS[def.lookOf ?? def.id])?.[kind] : undefined) ??
    fallback
  );
}

/** Hero `def`'s sound for picking up `kind`, else its default pickup sound, else the shared `pickup`. */
export function pickupSound(
  def: Pick<CharacterDef, 'id' | 'lookOf'> | null | undefined,
  kind: PickupKind,
): string {
  const s = def ? (CLASSIC_HERO_SOUNDS[def.id] ?? CLASSIC_HERO_SOUNDS[def.lookOf ?? def.id]) : undefined;
  return s?.pickups?.[kind] ?? s?.item ?? 'pickup';
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
  if (quietLanding(p, world)) return;
  world.audio.sfx(id);
}

/**
 * A landing with no sound (Samus.as 524, Bill.as 927: landOnGround): down the flagpole, or onto a
 * springboard.
 */
export function quietLanding(p: Player, world: World): boolean {
  return world.clearPhase !== null || world.onSpring(p);
}
