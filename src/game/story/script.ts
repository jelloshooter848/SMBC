/*
 * The Chapter 1 story's lines (docs/STORY.md, owner-reviewed 2026-10-07), exactly as written
 * there: upper case, font characters only, already wrapped to the box they show in.
 *
 * - A card page (CardScene panel, the map's Toad box): the speaker, a blank line and at most four
 *   lines of at most CARD_COLS (28) columns.
 * - A castle page (World.castleText): at most CASTLE_COLS (26) columns.
 * - A hint line (the map's bottom strip): at most 32 columns.
 *
 * `<HERO>` is filled by the functions below; script.test.ts checks every page against the
 * longest name a hero can have (SOPHIA III).
 */

/** A page of a card: its lines, top to bottom. */
export type Page = readonly string[];

/** Columns a castle page's line may take (World.castleText, centred under the score). */
export const CASTLE_COLS = 26;
/** Columns of the map's hint line. */
export const HINT_COLS = 32;

const toad = (...lines: string[]): Page => ['TOAD:', '', ...lines];

/* ---------------------------------------------------------------- 2.1 / 2.2: 1-0 */

/** Toad's greeting in 1-0 (campaign): one page, the warm-up (the opening told the rest). */
export const STORY_TOAD_PAGES: readonly Page[] = [
  toad(
    "WE'LL SEARCH EVERY PIPE,",
    'VINE AND HIDDEN BLOCK! BUT',
    'FIRST, A WARM-UP. FOLLOW',
    'THE TIPS UP TOP!',
  ),
];

/* ---------------------------------------------------------------- 2.3a: the fake Bowsers */

/** Toad's one-time explanation on the World 1 map after 1-4 (a major scene: he walks in). */
export const FAKES_PAGES: readonly Page[] = [
  toad('DID YOU SEE THAT? THE KING', 'USED THE WAND TO DRESS A', 'GOOMBA UP AS HIMSELF!'),
  toad('HE HIDES BEHIND STAND-INS.', "THE REAL ONE WON'T FACE", 'YOU UNTIL HIS OWN LAND.'),
];

/** Bowser on first entering 8-4's bridge room (campaign), in the prompt box. */
export function noMoreStandIns(hero: string): Page {
  return ['BOWSER: NO MORE STAND-INS,', `${hero}. THIS TIME IT'S`, 'REALLY ME! BWA HA HA!'];
}

/* ---------------------------------------------------------------- 2.7: Larry and the ball */

/** Larry in his room, the first time the hero rises out of its pipe in a run. */
export const LARRY_PAGES: readonly Page[] = [
  ['LARRY:', '', 'HEY! THE KING TOOK MY', 'WAND, AND ALL I GOT WAS', 'THIS LOUSY SPARE!'],
  ['LARRY:', '', 'HE SAYS I GET IT BACK', 'WHEN THE PRINCESS IS', 'CAUGHT. SO BUZZ OFF!'],
];

/** The crystal ball's cards (Larry beaten; campaign), at most 26 columns a line. */
export const STORY_CRYSTAL_BALL_PAGES: readonly Page[] = [
  ['LARRY DROPPED HIS', 'CRYSTAL BALL! IT SEES', "WHEREVER THE WAND'S SPELL", 'IS AT WORK...'],
  ['...SO FROM NOW ON, THE MAP', 'SHOWS WHERE EACH HERO', 'HIDES!'],
];

/** World 4's map right after the airship crash (a major scene). */
export const CRASH_PAGES: readonly Page[] = [
  toad('NICE LANDING! I MADE THE', 'WRECK INTO A BONUS SPOT.', 'WATCH OUT FOR HAMMER BROS.'),
  toad('AND THAT CRYSTAL BALL WILL', 'SHOW US WHERE EVERY HERO', 'HIDES, IN EVERY WORLD WE', 'REACH. HANDY!'),
];

/* ---------------------------------------------------------------- castles (2.4-2.12) */

/**
 * Each castle's two pages (2.3a), by its main level id: page 1 the reveal (under the thanks),
 * page 2 the story beat, 2 s later in the same box. 8-4's page 1 confirms the king was real.
 */
export const CASTLE_PAGES: Readonly<Record<string, { reveal: Page; news: Page }>> = {
  '1-4': {
    reveal: ['IT WAS A GOOMBA IN THE', "KING'S SHAPE! WAND MAGIC!"],
    news: ['THE REAL KING FLED EAST,', 'WAND AND ALL.'],
  },
  '2-4': {
    reveal: ['A KOOPA IN DISGUISE! THE', 'KING SENDS STAND-INS.'],
    news: ['THE SPELL OVER THE SEA IS', "FADING. THE KING'S SHIPS", 'SAILED FOR THE HILLS.'],
  },
  '3-4': {
    reveal: ['A BUZZY BEETLE THIS TIME!', 'STILL NOT THE REAL KING.'],
    news: ['SOMEONE SLIPPED THE KOOPAS', 'A MAP SIGNED - P. IT LED', 'THEM STRAIGHT INTO A', 'SWAMP. HA!'],
  },
  '4-4': {
    reveal: ['A SPINY IN A KING SUIT!', 'OUCH. STILL A FAKE.'],
    news: ['THE KING WAVED THE WAND AT', 'US, BUT IT ONLY FIZZLED!', "IT'S GETTING WEAKER."],
  },
  '5-4': {
    reveal: ['A LAKITU, OF ALL THINGS!', 'THE KING HIDES BEHIND', 'HIS OWN SHAPE.'],
    news: [
      'THE KOOPAS STORMED OUR',
      'VILLAGE, BUT IT WAS EMPTY.',
      'SOMEONE GOT US ALL OUT',
      'JUST BEFORE THEY CAME.',
    ],
  },
  '6-4': {
    reveal: ['A BLOOPER?! IN A CASTLE?', "THE WAND'S TRICKS ARE", 'GETTING SILLY.'],
    news: ['THE KING SLEEPS WITH THE', 'WAND UNDER HIS PILLOW NOW.', "HE KNOWS YOU'RE COMING."],
  },
  '7-4': {
    reveal: ['A HAMMER BRO! THE LAST', 'FAKE. THE REAL KING', 'WAITS IN HIS OWN LAND.'],
    news: ['THE WAND IS CRACKING! ALL', 'THAT SPELL-WORK WORE IT', "THIN. HE'S GONE HOME."],
  },
  '8-4': {
    reveal: ['NO TRICK THIS TIME. THAT', 'WAS THE REAL KING!'],
    news: ['BOWSER FELL... AND THE', 'WAND BROKE! ITS PIECES', 'FELL THROUGH A CRACK IN', 'THE WORLD!'],
  },
};

/** Said once as the wand breaks over 8-4's lava (campaign; a scene without on-screen text). */
export const WAND_BREAK_SAID =
  "The wand spins out of Bowser's hand and breaks! Its glowing pieces swirl into a crack in the air.";

/**
 * The block the 8-4 credits add after THANKS FOR PLAYING (campaign): Chapter 1 ends there, and
 * the false ending says the story goes on (into the Lost Kingdom, Chapter 2).
 */
export const STORY_NOT_OVER: readonly string[] = [
  '',
  'END OF CHAPTER 1',
  '',
  '...BUT THE STORY',
  "ISN'T OVER.",
];

/** Toad works out Peach's note on the World 8 map after the credits (a major scene). */
export function riftPages(hero: string): Page[] {
  return [
    toad('THAT CRACK LEADS TO THE', 'LOST KINGDOM! NOBODY GOES', 'THERE. NOBODY EVER LOOKS', 'THERE...'),
    toad('...WAIT. WHERE NO KOOPA', "WOULD EVER LOOK. THAT'S", `WHERE SHE WENT, ${hero}!`),
    toad('OLD FRIENDS, SHE WROTE...', 'WHO COULD SHE KNOW IN THE', 'LOST KINGDOM?'),
    toad(
      "BUT THE WAND'S PIECES FELL",
      'IN THERE TOO, AND THE',
      'KOOPALINGS WILL GO AFTER',
      "THEM. LET'S HURRY!",
    ),
  ];
}

/* ---------------------------------------------------------------- 2.13 / 2.14: the heroes */

/** What every hero's first card adds after "...<HERO> SERVES / KING KOOPA..." (free-hero.ts). */
export const CAPTIVE_HUNT: Page = ['...MUST FIND', 'THE PRINCESS...'];

/** Simon's curse (2.8, `DIALOGUE.simon` in free-hero.ts): the stolen wand, no longer Larry's. */
export const SIMON_CURSE: Page = [
  'THE STOLEN WAND WOKE THE',
  'CURSE DRACULA LEFT IN MY',
  'BLOOD. NOW I AM HIS THRALL.',
];

/** The optional extras, the first visit to the Warp Zone hub and to the Mini Game Arena. */
export const HUB_PAGE: Page = toad(
  'A PLACE BETWEEN WORLDS!',
  "THE WAND'S MAGIC MUST HAVE",
  'WORN A PATH THROUGH HERE.',
);
export const ARENA_PAGE: Page = toad(
  'THE HEROES CAN RELIVE',
  'THEIR TRIALS HERE. JUST',
  'FOR FUN, THIS TIME.',
);

/* ================================================================ S1 (0.4.23): the opening, 1-0, World 1 */

/** 2.1: the caption over Peach's courtyard (a card without a speaker), before her note. */
export const OPENING_CAPTION: Page = ['PRINCESS PEACH IS MISSING!', 'SHE LEFT THIS NOTE:'];

/** Columns and lines of Peach's note on its parchment (2.1). */
export const NOTE_COLS = 26;
export const NOTE_LINES = 13;

/** 2.1: Peach's note, as written on the parchment (blank lines are gaps between paragraphs). */
export const PEACH_NOTE: Page = [
  'DEAR TOAD,',
  '',
  'BOWSER IS UP TO SOMETHING.',
  "THIS TIME I WON'T SIT AND",
  'WAIT TO BE RESCUED.',
  '',
  "I'VE GONE TO FIND OLD",
  'FRIENDS WHO CAN HELP, IN A',
  'PLACE WHERE NO KOOPA WOULD',
  'EVER LOOK.',
  '',
  "DON'T WORRY ABOUT ME!",
  '                       - P',
];

/** 2.1: back in the courtyard after the note, Toad to Mario. */
export const OPENING_TOAD_PAGES: readonly Page[] = [
  toad('MARIO! THE KOOPAS ARE', 'ALREADY OUT HUNTING FOR', 'HER. WE HAVE TO FIND HER', 'FIRST!'),
  toad('COME ON, THE ROAD STARTS', "JUST OUTSIDE TOWN. LET'S", 'GO!'),
];

const bowser = (...lines: string[]): Page => ['BOWSER:', '', ...lines];

/**
 * 2.2: Bowser in person at the end of 1-0 (campaign): the pages before his spell (the wand comes
 * out on the second), then the last page after it.
 */
export const BOWSER_SPELL_PAGES: readonly Page[] = [
  bowser("BWA HA HA! SO YOU'RE", 'LOOKING FOR THE PRINCESS', 'TOO, MARIO?'),
  bowser('LIKE MY NEW WAND? ONE WAVE', 'AND ANYONE DOES WHATEVER I', 'SAY!'),
  bowser('AND I READ HER LITTLE NOTE.', "'WHERE NO KOOPA WOULD EVER", "LOOK.' HMPH!"),
  bowser("WELL, IF MY KOOPAS CAN'T", "FIND HER, THEN I'LL FIND", 'SOMEBODY WHO WILL!'),
];
export const BOWSER_SPELL_LAST: Page = bowser(
  'HEROES OF OTHER WORLDS,',
  'YOU SERVE ME NOW! FIND ME',
  'THAT PRINCESS! BWA HA HA!',
);

/** Said once during the spell's eight windows (a scene without on-screen text). */
export const BOWSER_SPELL_SAID =
  'Bowser raises the wand. Eight heroes from other worlds are pulled into the eight worlds, under his spell.';

/** 2.4: Toad's World 1 scene, back on the map after 1-0 (a major scene: he walks in). */
export const WORLD1_PAGES: readonly Page[] = [
  toad('MARIO, DID YOU SEE THAT?!', 'BOWSER USED MAGIC TO BRING', 'PEOPLE HERE FROM OTHER', 'UNIVERSES!'),
  toad('AND HE WANTS THEM TO FIND', 'THE PRINCESS FOR HIM. WE', 'HAVE TO FIND HER FIRST!'),
  toad("WHERE'S LUIGI? WE NEED TO", 'FIND HIM. WE COULD REALLY', 'USE HIS HELP FINDING', 'PEACH.'),
];

/** 2.4: 1-1, brainwashed Luigi runs off: what the announcer says, then Mario's card. */
export const LUIGI_RUNS_SAID = 'A brainwashed Luigi looks back and runs away.';
export const LUIGI_RUNS_PAGE: Page = [
  'MARIO:',
  '',
  'WAS THAT LUIGI? WHY DID HE',
  "LOOK LIKE THAT? LET'S GO",
  'FIND HIM!',
];

/* ================================================================ end of S1 */

/* ---------------------------------------------------------------- the partners (2.5-2.10) */

/** A partner's id (the `partner x y who=<id>` entity) and what it says when talked to (or read). */
export interface PartnerScript {
  /** The word over it while a player is in reach: TALK, or READ for the Chozo statue. */
  verb: 'TALK' | 'READ';
  /** Said by the announcer when a player comes within reach ("Dr. Light. Up to talk."). */
  name: string;
  pages: readonly Page[];
  /** The page after which a single coin pops out over it (the old man's "TAKE THIS."). */
  coinAfter?: number;
}

export const PARTNERS: Readonly<Record<string, PartnerScript>> = {
  'old-man': {
    verb: 'TALK',
    name: 'An old man',
    coinAfter: 0,
    pages: [
      ['OLD MAN:', '', "IT'S DANGEROUS TO GO", 'ALONE! TAKE THIS.'],
      ['OLD MAN:', '', 'THE SILENT ONE WAITS ABOVE', 'THE CLOUDS. A BRICK AHEAD', 'HIDES A VINE. CLIMB IT.'],
      [
        'OLD MAN:',
        '',
        'WHERE THE COINS IN THE SKY',
        'RUN OUT, BUMP THE EMPTY AIR.',
        'A SECOND VINE GOES HIGHER.',
      ],
      ['OLD MAN:', '', 'ALSO, PAY ME FOR THE DOOR', 'REPAIR CHARGE. ...KIDDING.', 'THERE IS NO DOOR.'],
    ],
  },
  'dr-light': {
    verb: 'TALK',
    name: 'Doctor Light',
    pages: [
      [
        'DR. LIGHT:',
        '',
        "AH, A VISITOR! I'VE BEEN",
        "TRACKING MY BOY'S SIGNAL.",
        'IT COMES FROM ABOVE THE',
        'SKY. HIGHER THAN COINS GO.',
      ],
      [
        'DR. LIGHT:',
        '',
        'MY OLD TELEPORTER ANSWERS',
        'TO A HIDDEN BLOCK. PAST',
        'THE CLOUD COINS, KEEP',
        'JUMPING. BUMP THE AIR!',
      ],
    ],
  },
  chozo: {
    verb: 'READ',
    name: 'An old bird statue',
    pages: [
      ['AN OLD BIRD STATUE. ITS', 'EYES GLOW. WORDS ARE CUT', 'INTO ITS BASE:'],
      [
        'THE HUNTER SLEEPS BELOW.',
        "CLIMB THE NEXT LAND'S VINE",
        'TO THE PIPE THAT NO LONGER',
        'WARPS, AND GO DOWN.',
      ],
    ],
  },
  townsperson: {
    verb: 'TALK',
    name: 'A townsperson',
    pages: [
      ['TOWNSPERSON:', '', 'WHAT A HORRIBLE NIGHT TO', 'HAVE A CURSE.'],
      [
        'TOWNSPERSON:',
        '',
        'RIDE THE MOVING FLOOR DOWN,',
        'PAST WHERE FLOORS SHOULD',
        "END. OR DON'T. I'M JUST A",
        'TOWNSPERSON.',
      ],
      ['TOWNSPERSON:', '', 'AND HIT THE CRACKED WALL', 'WITH YOUR HEAD TO MAKE A', 'HOLE. TRUST ME.'],
    ],
  },
  irene: {
    verb: 'TALK',
    name: 'Irene',
    pages: [
      [
        'IRENE:',
        '',
        'AGENT IRENE LEW, CIA.',
        "I'M TRACKING A NINJA. HE",
        'WENT DOWN THE FIRST PIPE',
        'ON THIS ROAD...',
      ],
      [
        'IRENE:',
        '',
        '...AND NEVER CAME OUT.',
        'NINJAS. THEY NEVER USE',
        'THE DOOR. LEAN ON THE',
        'LEFT WALL DOWN THERE.',
      ],
    ],
  },
  lance: {
    verb: 'TALK',
    name: 'Lance',
    pages: [
      ['LANCE:', '', 'SEEN MY PARTNER? WE CAME', 'TO STOP AN ALIEN. NOW HE', 'WORKS FOR IT.'],
      [
        'LANCE:',
        '',
        'LAST I SAW, HE WAS ON THE',
        'BRIDGE BY THE RED LIGHT. IT',
        "BLEW UP UNDER HIM. HE DIDN'T",
        'RUN. HE NEVER RUNS.',
      ],
    ],
  },
  // Sophia III's pilot, in his secret area behind 8-4-end's trap pipe (8-4-jason): talking to him
  // sends Fred into the pool (objects/fred.ts).
  jason: {
    verb: 'TALK',
    name: 'Jason',
    pages: [
      ['JASON:', '', 'FRED! FRED, COME BACK!', '...OH, HI. HAVE YOU SEEN', 'A FROG? GREEN, THIS BIG?'],
      [
        'JASON:',
        '',
        'HE JUMPED IN THE WATER AND',
        'SWAM DOWN A CRACK. LAST',
        'TIME HE DID THAT, I FOUND',
        'A TANK.',
      ],
      ['JASON:', '', "MY TANK, SOPHIA! SHE'S DOWN", 'THERE TOO. FOLLOW FRED,', "PLEASE. I CAN'T SWIM."],
    ],
  },
};
