import type { Page } from './script';

/*
 * Kakariko Village's townsfolk (0.4.41, docs/STORY.md 2.5 "Kakariko Village"). Every line is
 * original (the back-room man's is a nod to Zelda II's town; World 2 is Hyrule). Cards follow the
 * game's rules: the speaker's name, a blank line, at most 26 columns a line; places are named
 * in-world, never by level number; abilities by their names (TOOLS). Some lines change with the
 * hero walking the village, which makes switching heroes worth a try.
 */

/** A townsperson's card: `NAME:`, a blank line, the words. */
const say = (who: string, ...lines: string[]): Page => [`${who}:`, '', ...lines];

/** The guard at the south gate, the first time the village is found (he greets you as you come in). */
export const GUARD_FIRST: readonly Page[] = [
  say('GUARD', 'A VILLAGE NO MAP SHOWS.', 'FUNNY HOW YOU FOUND IT.'),
  say('GUARD', 'WELCOME TO KAKARIKO.', 'WIPE YOUR BOOTS. MIND', 'THE HEN.'),
];

/** The guard on a later visit. */
export const GUARD_AGAIN: readonly Page[] = [say('GUARD', 'BACK AGAIN? THE HEN', 'MISSED YOU.')];

/** The healer heals a hero who counts hit points, in full and for free. */
export const HEALER_HEALS: readonly Page[] = [
  say('HEALER', 'LET ME SEE THOSE', 'SCRAPES... THERE.', 'GOOD AS NEW.'),
];
/** ...but Mario and Luigi have none to heal. */
export const HEALER_PLUMBER: readonly Page[] = [say('HEALER', 'YOU LOOK FINE TO ME.', 'TRY A MUSHROOM.')];

export const BARKEEP: readonly Page[] = [
  say(
    'BARKEEP',
    "WORD IS THERE'S A BLOCK",
    'HIGH OVER THE GREAT',
    "FIELD'S LAST TOWER THAT",
    "NOBODY'S EVER BUMPED...",
  ),
  say('BARKEEP', '...WELL. ONE PERSON.'),
];

export const PATRON: readonly Page[] = [
  say('PATRON', 'IF YOU FALL IN A PIT, YOU', 'DROP EVERYTHING YOU CARRY.', 'ASK ME HOW I KNOW.'),
];

export const PATRON_2: readonly Page[] = [
  say('PATRON', 'I CAME FOR ONE NIGHT.', 'THAT WAS THREE KINGDOMS', 'AGO.'),
];

/**
 * The old man in his house by the well: the hero switch. `button` is what it is called where the
 * player is: TOOLS, or HERO on the touch pad (the button's own name in the village).
 */
export function oldManPages(button: string): Page[] {
  return [
    say('OLD MAN', "IF YOUR HERO CAN'T MANAGE", `IT, PRESS ${button}. SOMEONE`, 'ELSE MIGHT.'),
    say('OLD MAN', 'HERE IN THE VILLAGE, ANY', "FRIEND YOU'VE FREED CAN", 'TAKE A WALK IN YOUR PLACE.'),
  ];
}

export const GARDENER_LINK: readonly Page[] = [
  say('GARDENER', 'YOU AGAIN! KEEP THAT', 'SWORD AWAY FROM MY', 'BUSHES.'),
];
export const GARDENER: readonly Page[] = [say('GARDENER', 'NOTHING UNDER THESE', 'BUSHES. I CHECKED.')];

export const KID: readonly Page[] = [
  say('KID', "I'M GONNA CATCH THAT HEN!", "SHE'S FASTER THAN SHE", 'LOOKS.'),
];
export const KID_SAMUS: readonly Page[] = [say('KID', 'ARE YOU A ROBOT?')];
export const KID_MEGAMAN: readonly Page[] = [say('KID', 'ARE YOU A ROBOT?', '...COOL.')];

export const WOMAN: readonly Page[] = [
  say('WOMAN', 'THE WEATHERVANE POINTS', 'WHEREVER THE WIND LIKES.', 'MOSTLY AT THE SHOP.'),
];

export const MOTHER: readonly Page[] = [
  say('MOTHER', 'THE HEALER NEXT DOOR', 'PATCHES ANYONE UP. FREE!', "SHE'S BORED, YOU SEE."),
];

export const CHILD: readonly Page[] = [
  say('CHILD', 'MY BIG BROTHER CHASES THE', 'HEN ALL DAY. I THINK THE', 'HEN IS WINNING.'),
];

/** The man in the inn's back room. */
export const STRANGER: readonly Page[] = [say('STRANGER', 'I AM ERROR.')];

/** Things to read and look at (no speaker). */
export const WEATHERVANE: readonly Page[] = [['W... E... S...', '', 'THE N FELL OFF YEARS AGO.']];
export const FALLEN_LOG: readonly Page[] = [['SOMEONE SHOULD MOVE THIS.', '', 'SOMEDAY.']];
export const SHOP_SIGN: readonly Page[] = [['THE SHOP', '', 'COMING SOON!']];

/** The well echoes the hero's name back (`name`: as the font writes it). */
export function wellPage(name: string): Page[] {
  return [['YOU CALL DOWN THE WELL.', '', `...${name}...`, `${name}...`]];
}

/** A building door that is locked (the hook for a later secret: TdEntrance.needs). */
export const DOOR_LOCKED = 'CLOSED. ASK AROUND.';
/** The shop's door, shut until the shop opens. */
export const SHOP_SHUT = 'THE SHOP: COMING SOON!';
/** SELECT with no other hero freed. */
export const NO_ONE_ELSE = 'NO ONE ELSE HAS JOINED YOU YET.';

/** Every fixed page here, by name (the script-doc test checks them against docs/STORY.md). */
export const KAKARIKO_PAGES: Readonly<Record<string, readonly Page[]>> = {
  GUARD_FIRST,
  GUARD_AGAIN,
  HEALER_HEALS,
  HEALER_PLUMBER,
  BARKEEP,
  PATRON,
  PATRON_2,
  GARDENER_LINK,
  GARDENER,
  KID,
  KID_SAMUS,
  KID_MEGAMAN,
  WOMAN,
  MOTHER,
  CHILD,
  STRANGER,
  WEATHERVANE,
  FALLEN_LOG,
  SHOP_SIGN,
};
