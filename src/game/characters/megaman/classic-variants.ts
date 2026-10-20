import type { CharacterDef, CharacterGuide } from '../character';
import type { MovementProfile } from '../profile';
import type { ProjectileSpec, ClassicBlocks } from '../../entities/projectiles/projectile';
import { MEGAMAN } from './index';
import { MEGAMAN_CLASSIC_GUIDE } from './classic-guide';
import { MEGAMAN_CLASSIC_PROFILE, MM_CHARGE, classicMegaMan, type ClassicMegaManOptions } from './classic';
import { MM_BUSTER, MM_CHARGE_FULL, MM_CHARGE_WEAK, MM_HIT } from './classic-weapons';

/**
 * Classic mode's Mega Man gameplay variants (docs/classic/FOLLOW_UPS_PROPOSAL.md FU-3): the
 * original 3.1.21's Mega Man skins that change the rules (SkinDescriptions.as; the switches in
 * MegaManBase.as and MegaManProjectile.as). Each plays differently from Mega Man, so each has its
 * own select slot (the owner's rule); Francesca and Doropie play alike, so Doropie is a skin on
 * Francesca's slot (classic/skins.ts). Built by `classicMegaMan` as Proto Man is, drawn from Mega
 * Man's redrawn sheet under their own heads (sprites/smbc-megaman-variants.ts).
 */

/** Down a level of PR_PASSTHROUGH_ALWAYS: through the ground, every brick it strikes and on. */
const PASS_THROUGH: ClassicBlocks = { ground: 'pass', afterBlock: 'continue', strikesBlocks: true };

/** The original's damage ×1.25 (Cut Man's and Fire Man's buster, Cut Man's weak charge). */
const STRONGER = 1.25;
/** ×0.75 (Ice Man's buster). */
const WEAKER = 0.75;

/** A survived hit pushes twice as fast (TAKE_DAMAGE_SPEED_LONG 160 px/s, as Proto Man's). */
const DOUBLE_KNOCKBACK = 0x01555;

/** Two buster shots at a time (numShotsMB - 1). */
const TWO_SHOTS = 2;

/* ---------- shots ---------- */

/** Cut Man's buster: 125, through enemies and bricks (PR_PASSTHROUGH_ALWAYS). */
export const CUT_BUSTER: ProjectileSpec = {
  ...MM_BUSTER,
  amount: MM_BUSTER.amount * STRONGER,
  pierce: true,
  classicBlocks: PASS_THROUGH,
};
/** Cut Man's weak charge: 250, through enemies and bricks. */
export const CUT_CHARGE_WEAK: ProjectileSpec = {
  ...MM_CHARGE_WEAK,
  amount: MM_CHARGE_WEAK.amount * STRONGER,
  pierce: true,
  classicBlocks: PASS_THROUGH,
};
/** Cut Man's full charge: 300, through everything, not only what it defeats. */
export const CUT_CHARGE_FULL: ProjectileSpec = {
  ...MM_CHARGE_FULL,
  pierce: true,
  pierceDefeat: false,
  classicBlocks: PASS_THROUGH,
};

/** Fire Man's buster: 125. */
export const FIRE_BUSTER: ProjectileSpec = { ...MM_BUSTER, amount: MM_BUSTER.amount * STRONGER };

/** Ice Man's buster: 75. */
export const ICE_BUSTER: ProjectileSpec = { ...MM_BUSTER, amount: MM_BUSTER.amount * WEAKER };
/** Ice Man's freeze (MegaMan.FREEZE_DUR, 2 s). */
export const ICE_FREEZE_FRAMES = 120;
/** Ice Man's full charge freezes what it hits (TYPE_FREEZE_AGG) instead of hurting it. */
export const ICE_CHARGE_FULL: ProjectileSpec = {
  ...MM_CHARGE_FULL,
  classicHit: { ...MM_HIT, freezeFrames: ICE_FREEZE_FRAMES },
};

/* ---------- movement ---------- */

/**
 * Rokko Chan's dash (canDashJump): the slide's speed and distance, upright (her dash pose), and
 * a jump out of it, Down held or not, at the high jump's 650 px/s keeping the dash speed in the
 * air, as Bass's.
 */
export const ROKKO_PROFILE: MovementProfile = {
  ...MEGAMAN_CLASSIC_PROFILE,
  slide: {
    ...(MEGAMAN_CLASSIC_PROFILE.slide as NonNullable<MovementProfile['slide']>),
    hitboxH: 22,
    jumpWithDown: true,
    jumpSpeed: 0x05355,
    keepSpeedInAir: true,
  },
};

/** Rokko Chan's shots leave lower (Y_PAD_BOT_*_ROKKO: 22 and 32 Flash px, halved). */
export const ROKKO_SHOT_PAD = { ground: 11, air: 16 };

/* ---------- guides ---------- */

/** Mega Man's page with the tagline and the rows a variant changes. */
function guide(
  tagline: string,
  rows: { slide?: string | null; attack?: string; hold?: string | null; mushroom?: string },
  tips: string[] = [],
): CharacterGuide {
  const g = MEGAMAN_CLASSIC_GUIDE;
  return {
    ...g,
    tagline,
    controls: g.controls.flatMap((c) => {
      if (c.action === 'down+jump' && rows.slide !== undefined)
        return rows.slide === null ? [] : [{ ...c, does: rows.slide }];
      if (c.action === 'attack' && rows.attack) return [{ ...c, does: rows.attack }];
      if (c.action === 'attack (hold)' && rows.hold !== undefined)
        return rows.hold === null ? [] : [{ ...c, does: rows.hold }];
      return [c];
    }),
    powerups: g.powerups.map((p) =>
      p.item === 'mushroom' && rows.mushroom ? { ...p, does: rows.mushroom } : p,
    ),
    tips: [...tips, ...(g.tips ?? [])],
  };
}

const NO_CHARGE_MUSHROOM = 'One extra hit. No charge shot.';

/* ---------- the variants ---------- */

/** The roster identity: Mega Man's, with this name and its own art. */
function identity(id: string, name: string, hudName: string, sheet: string, palette: string) {
  const art = { sheet, palette, frame: 'portrait' };
  return { ...MEGAMAN, id, name, hudName, portrait: art, portraitArt: art };
}

/** A variant from Mega Man's factory, drawn from its own sheet as his is (R1's canvas). */
function variant(
  id: string,
  name: string,
  hudName: string,
  sheet: string,
  palette: string,
  o: Partial<ClassicMegaManOptions>,
  rescueName: string,
): CharacterDef {
  return {
    ...classicMegaMan({
      base: identity(id, name, hudName, sheet, palette),
      sheet,
      palette,
      canvas: true,
      flowerSetting: 'megaman',
      ...o,
    }),
    // The castle text's name: the skin's in BmdInfo.as (its third name).
    rescueName,
  };
}

/** Rock (skins 16, 17): no charge, no slide. */
export const ROCK_CLASSIC = variant(
  'rock',
  'Rock',
  'ROCK',
  'mm-rock',
  'rock',
  {
    charge: null,
    noSlide: true,
    guide: guide("Can't charge the buster or slide", {
      slide: null,
      hold: null,
      mushroom: NO_CHARGE_MUSHROOM,
    }),
  },
  'Dr. Light',
);

/** Francesca (skin 25): no slide. */
export const FRANCESCA_CLASSIC = variant(
  'francesca',
  'Francesca',
  'FRAN.',
  'mm-witch',
  'francesca',
  { noSlide: true, guide: guide("Can't slide", { slide: null }) },
  'Kagemaru',
);

/** Doropie (skin 26): Francesca's other look, the same rules (a skin on her slot). */
export const DOROPIE_CLASSIC = variant(
  'doropie',
  'Doropie',
  'DORO.',
  'mm-witch',
  'doropie',
  { noSlide: true, guide: guide("Can't slide", { slide: null }) },
  'Kagemaru',
);

/** Rokko Chan (skin 11): a dash instead of the slide, a dash jump, no charge. */
export const ROKKO_CLASSIC = variant(
  'rokko',
  'Rokko Chan',
  'ROKKO',
  'mm-rokko',
  'rokko',
  {
    profile: ROKKO_PROFILE,
    charge: null,
    slideFrame: 'dash',
    shotPad: ROKKO_SHOT_PAD,
    guide: guide("Dashes instead of sliding, can dash jump, can't charge", {
      slide: 'Dash: fast and upright. Jump during the dash, down held or not, to keep its speed in the air.',
      hold: null,
      mushroom: NO_CHARGE_MUSHROOM,
    }),
  },
  'Professor Thane',
);

/** Cut Man (skins 13, 21): piercing shots, a brick-breaking head, two shots at a time. */
export const CUTMAN_CLASSIC = variant(
  'cutman',
  'Cut Man',
  'CUT',
  'mm-cutman',
  'cutman',
  {
    buster: { spec: CUT_BUSTER, cap: TWO_SHOTS },
    charge: { levels: MM_CHARGE, weak: CUT_CHARGE_WEAK, full: CUT_CHARGE_FULL },
    headBreaksBricks: true,
    guide: guide(
      'Shots pass through enemies and bricks, head breaks bricks, two shots at a time',
      {
        attack: 'Fire the buster, two shots at a time. Shots pass through enemies, walls and bricks.',
      },
      ['Jump up into a brick to break it, small or big.'],
    ),
  },
  'Dr. Light',
);

/** Ice Man (skin 14): a freezing full charge, a weaker buster. */
export const ICEMAN_CLASSIC = variant(
  'iceman',
  'Ice Man',
  'ICE',
  'mm-iceman',
  'iceman',
  {
    buster: { spec: ICE_BUSTER, cap: 3 },
    charge: { levels: MM_CHARGE, weak: MM_CHARGE_WEAK, full: ICE_CHARGE_FULL },
    guide: guide('Charged shots freeze enemies, normal shots are weaker', {
      hold: 'With the mushroom: charge, then let go. Fully charged, the shot freezes what it hits.',
    }),
  },
  'Dr. Light',
);

/** Fire Man (skin 24): a stronger buster, two shots, firebars harmless, double knockback. */
export const FIREMAN_CLASSIC = variant(
  'fireman',
  'Fire Man',
  'FIRE',
  'mm-fireman',
  'fireman',
  {
    buster: { spec: FIRE_BUSTER, cap: TWO_SHOTS },
    knockbackVx: DOUBLE_KNOCKBACK,
    fireBarProof: true,
    guide: guide(
      'Stronger shots, immune to firebars, two shots at a time, double knockback',
      { attack: 'Fire the buster, two stronger shots at a time. Shots fly through walls and break bricks.' },
      ['Firebars pass through you.', 'Hits knock you back twice as far. Mind the pits.'],
    ),
  },
  'Dr. Light',
);
