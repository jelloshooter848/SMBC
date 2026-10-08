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

/** Toad's greeting in 1-0 (campaign): the stolen wand, the heroes, Peach's note. */
export const STORY_TOAD_PAGES: readonly Page[] = [
  toad('MARIO! THANK GOODNESS', "YOU'RE HERE! KING KOOPA", "STOLE LARRY'S MAGIC WAND!"),
  toad('NOW STRANGE HEROES FROM', 'OTHER WORLDS ARE POPPING', "UP, ALL UNDER THE KING'S", 'SPELL. BUT WHY?'),
  toad('AND THE PRINCESS IS GONE!', 'SHE LEFT ME ONE NOTE:', 'GONE WHERE NO KOOPA', 'WOULD EVER LOOK. - P'),
  toad('SEARCH EVERY PIPE, VINE', 'AND HIDDEN BLOCK! BUT', 'FIRST, A WARM-UP. FOLLOW', 'THE TIPS UP TOP!'),
];

/** Bowser's shadow in 1-0's tease (campaign): two pages in the prompt box. */
export const STORY_TEASE_PAGES: readonly Page[] = [
  ['BOWSER: BWA HA HA!', "MY KOOPAS COULDN'T FIND", 'THAT PRINCESS. FINE!'],
  ["THESE HEROES DON'T THINK", "LIKE KOOPAS. THEY'LL SNIFF", 'HER OUT BEFORE YOU DO!'],
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

/* ---------------------------------------------------------------- 2.3b: restyled levels */

/** Toad's remark the first time a restyled level starts (campaign), by main level id. */
export const RESTYLE_PAGES: Readonly<Record<string, Page>> = {
  '2-1': toad(
    'WHY DOES SEA SIDE LOOK SO',
    'DIFFERENT HERE? STONE',
    'RUINS? SOMEONE BROUGHT A',
    'BIT OF THEIR WORLD ALONG.',
  ),
  '3-1': toad(
    'WHY DOES NIGHT HILLS LOOK',
    'LIKE A FACTORY HERE? ALL',
    'BOLTS AND PIPES. SOMEBODY',
    'BROUGHT THEIR WORLD ALONG.',
  ),
  '4-2': toad('MUSHROOM WOODS, BUT BLUE', 'AND BUBBLY DOWN HERE? IT', 'FEELS LIKE ANOTHER PLANET.'),
  '5-4': toad(
    'WHY DOES THIS CASTLE LOOK',
    'SO... OLD? CANDLES, STONE,',
    'AND I SWEAR SOMETHING JUST',
    'MOVED IN THAT WINDOW.',
  ),
  '6-2': toad(
    'SNOW NIGHT HAS STREETS',
    'NOW? SHOP FRONTS, LAMPS...',
    "SOMEONE'S WORLD HAS",
    'BLED INTO THIS ONE.',
  ),
  '7-3': toad('CANNON COAST TURNED INTO A', "JUNGLE?! AND WHAT'S WITH", "THAT BRIDGE'S RED LIGHT?"),
};

/* ---------------------------------------------------------------- 2.4-2.11: the worlds */

/** Toad's world entry, by map page (first arrival on the page). */
export const WORLD_ENTRY: Readonly<Record<string, readonly Page[]>> = {
  'smb-1': [
    toad(
      'FIRST, WHO ARE WE LOOKING',
      'FOR HERE? SOMEONE IN GREEN.',
      'TALLER THAN YOU. JUMPS',
      'HIGHER. ALWAYS PLAYER TWO.',
    ),
    toad('IF I KNOW HIM, HE FOUND', 'THE COINS BEFORE YOU DID.', 'DOWN A PIPE, MAYBE?'),
  ],
  'smb-2': [
    toad(
      'ONE CASTLE DOWN! NEXT WE',
      'SEEK A SWORDSMAN IN A',
      'GREEN CAP. HE NEVER SAYS',
      "A WORD. NOT ONE. I'VE TRIED.",
    ),
    toad('I KEEP DREAMING OF OLD', 'RUINS ABOVE THE CLOUDS.', 'FUNNY... THE CLOUDS HERE', 'END SO SUDDENLY.'),
  ],
  'smb-3': [
    toad(
      'THE SEA IS CALM AGAIN!',
      'NEXT: A BLUE ROBOT BOY',
      'WITH A CANNON FOR AN ARM.',
      'FROM THE FUTURE, I THINK.',
    ),
    toad('LOOK AT THE SKY TONIGHT.', 'ONE STAR KEEPS BLINKING.', "STARS DON'T BLINK LIKE", 'THAT. DO THEY?'),
  ],
  'smb-4': [
    toad(
      'THREE CASTLES! THE KING IS',
      'WORRIED. NEXT: A HUNTER',
      'IN A POWER SUIT. NO ONE',
      'HAS EVER SEEN HER FACE.',
    ),
    toad('SOME OLD WARP PIPES HERE', "DON'T WARP ANY MORE...", 'THEY GO DOWN. DEEP DOWN.'),
    toad('AND I SAW AN AIRSHIP', 'FLYING LOW OVER 4-2.', 'KEEP AN EYE ON THE SKY!'),
  ],
  'smb-5': [
    toad(
      'THE WOODS ARE FREE! NEXT:',
      'A HUNTER OF THE NIGHT.',
      'HIS FAMILY HAS FOUGHT',
      'VAMPIRES FOR AGES.',
    ),
    toad('UP IN THE SKY TREES? NO...', 'A MAN LIKE THAT IS DEEP', 'UNDERGROUND, IN SOME', 'DUNGEON. BRR!'),
  ],
  'smb-6': [
    toad('FIVE CASTLES! NEXT: A', "NINJA. YOU WON'T SEE HIM", 'UNLESS HE WANTS YOU TO.'),
    toad(
      'NINJAS LOVE SECRET DOORS.',
      "WALLS THAT AREN'T WALLS.",
      "I'D PUSH ON ANYTHING THAT",
      'LOOKS... POKED.',
    ),
  ],
  'smb-7': [
    toad('SIX CASTLES! NEXT: A', 'SOLDIER. ONE BIG GUN,', 'NO SHIRT, NO FEAR.'),
    toad(
      'THE COAST LOOKS LIKE A',
      'JUNGLE NOW, AND THE',
      'BRIDGES GO BOOM. RUN, OR',
      "DON'T. HE'D KNOW WHICH.",
    ),
  ],
  // Pages 2-3, World 8's hero (Sophia III) and her pilot: only once she is in the game (ENTRY_NEEDS).
  'smb-8': [
    toad("BOWSER'S LAND. HE'S IN", 'HERE SOMEWHERE WITH THE', "WAND. AND HE'S NOT HAPPY."),
    toad("THE LAST ONE WE SEEK ISN'T", "A PERSON AT ALL. IT'S A...", 'TANK? A TANK THAT JUMPS?'),
    toad(
      'HER PILOT IS LOST IN THE',
      "KING'S CASTLE. HE KEEPS",
      'TAKING THE PIPE THAT',
      'EVERYONE ELSE SKIPS.',
    ),
    toad(
      'ODD... SOMEONE PULLED UP A',
      'TURNIP RIGHT HERE. IN',
      "BOWSER'S LAND! WHO PLANTS",
      'TURNIPS NEXT TO LAVA?',
    ),
  ],
};

/**
 * The pages of a world entry that are about a hero who may not be in the game yet (World 8's
 * Sophia III and her pilot, pages 2-3 by index): shown only once that character is registered,
 * as a beat of their own (beats.ts beat.enterHero), so a file that reached the world before she
 * landed still hears them later, once. The rest of the entry (World 8: Bowser's land and the
 * turnip, Peach's clue) always plays.
 */
export const ENTRY_NEEDS: Readonly<Record<string, { hero: string; pages: readonly number[] }>> = {
  'smb-8': { hero: 'sophia', pages: [1, 2] },
};

/** Toad's "missed something" card, by hero id: the first time that hero's shadow shows. */
export const MISSED_PAGES: Readonly<Record<string, Page>> = {
  luigi: toad('HUH. 1-1 FEELS... CROWDED.', 'LIKE SOMEONE WAS WAITING', 'UNDER IT THE WHOLE TIME.'),
  link: toad('2-1 LOOKED TALLER THAN IT', 'SHOULD. AS IF IT KEPT GOING', 'UP, PAST THE LAST CLOUD...'),
  megaman: toad('THAT STAR OVER 3-1 IS', 'STILL BLINKING. I THINK', "IT'S BLINKING AT US."),
  samus: toad('4-2 SOUNDED HOLLOW. LIKE', "THERE'S A WHOLE CAVE UNDER", 'IT THAT WE NEVER SAW.'),
  simon: toad("THAT CASTLE'S LIFT WENT", 'DOWN... AND SOMETHING DOWN', 'THERE WENT TAP, TAP, TAP.'),
  ryu: toad('6-2 HAD A STAR STUCK IN', 'A WALL. NOT THE GOOD KIND', 'OF STAR, EITHER.'),
  bill: toad('THAT JUNGLE STILL SMELLS', 'OF SMOKE. SOMEONE IS', 'CAMPING UNDER THOSE', 'BRIDGES.'),
  sophia: toad('A FROG HAS BEEN SITTING', 'ON 8-4, CROAKING AT ME.', 'I THINK HE WANTS SOMETHING.'),
};

/**
 * The map's hint line while the hero stands on a node whose hidden hero's shadow shows, by hero
 * id (replaces the generic HIDING_HINT), and what the announcer says for it.
 */
export const MISSED_HINT: Readonly<Record<string, string>> = {
  luigi: 'TOAD: I HEAR A MUSTACHE SIGH...',
  link: 'TOAD: SOMETHING UP THERE HUMS...',
  megaman: 'TOAD: A STAR UP THERE BLINKS...',
  samus: 'TOAD: THE PIPES HERE ECHO...',
  simon: 'TOAD: THIS LIFT SMELLS OF BATS',
  ryu: 'TOAD: A WALL IN HERE IS WATCHING',
  bill: 'TOAD: I SMELL A CAMPFIRE...',
  sophia: 'TOAD: A FROG CROAKED IN THERE',
};

/* ---------------------------------------------------------------- 2.7: Larry and the ball */

/** Larry in his room, the first time the hero rises out of its pipe in a run. */
export const LARRY_PAGES: readonly Page[] = [
  ['LARRY:', '', 'HEY! THE KING TOOK MY', 'WAND, AND ALL I GOT WAS', 'THIS LOUSY SPARE!'],
  ['LARRY:', '', 'HE SAYS I GET IT BACK', 'WHEN THE PRINCESS IS', 'CAUGHT. SO BUZZ OFF!'],
];

/** The crystal ball's cards (Larry beaten; campaign), at most 26 columns a line. */
export const STORY_CRYSTAL_BALL_PAGES: readonly Page[] = [
  ['LARRY DROPPED HIS', 'CRYSTAL BALL! IT SEES', "WHEREVER THE WAND'S SPELL", 'IS AT WORK...'],
  ['...SO IT SHOWS WHERE', 'YOUR FRIENDS ARE HIDDEN!'],
];

/** World 4's map right after the airship crash: also stands in for the per-hero missed cards. */
export const CRASH_PAGES: readonly Page[] = [
  toad('NICE LANDING! I MADE THE', 'WRECK INTO A BONUS SPOT.', 'WATCH OUT FOR HAMMER BROS.'),
  toad('AND THAT CRYSTAL BALL LIT', 'UP EVERY HIDING PLACE ON', 'THE MAP. SEE THE SHADOWS?'),
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
    toad(
      '...WAIT. WHERE NO KOOPA',
      'WOULD EVER LOOK, AND NO',
      "HERO EVER SNIFFED. THAT'S",
      `WHERE SHE IS, ${hero}!`,
    ),
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

/** Toad's generic hero-joined card: its first page (the crack) is left out once 8-4 is beaten. */
export const JOINED_CRACK: Page = toad(
  'ANOTHER HERO SET FREE! AND',
  'DID YOU HEAR THAT CRACK?',
  'EVERY SPELL YOU BREAK SNAPS',
  'BACK INTO THE WAND!',
);
export const JOINED_GENERIC: Page = toad(
  'ONE LESS PAIR OF EYES',
  'HUNTING THE PRINCESS, AND',
  'ONE MORE CRACK IN THE WAND!',
);

/** Toad's reaction the first time the map shows after a hero is freed, by hero id. */
export const JOINED_PAGES: Readonly<Record<string, Page>> = {
  luigi: toad("LUIGI! I KNEW YOU'D SNAP", 'OUT OF IT. ...YOU DID SNAP', 'OUT OF IT, RIGHT?'),
  link: toad("THE SWORDSMAN STILL HASN'T", 'SAID A WORD TO ME. HE', 'TALKED TO YOU?!'),
  megaman: toad('A ROBOT ON THE TEAM! CAN', 'HE MAKE TOAST? ...NO?', 'OKAY. STILL GREAT.'),
  samus: toad('THE HUNTER IS WITH US! SHE', 'SAID THANKS. I THINK. HER', 'HELMET MUFFLES THINGS.'),
  simon: toad('THE VAMPIRE HUNTER SAID', 'WHAT A HORRIBLE NIGHT IT', "IS. IT'S THE MIDDLE OF", 'THE DAY.'),
  ryu: toad('THE NINJA IS WITH US! HE', 'WAS STANDING BEHIND ME THE', "WHOLE TIME, WASN'T HE."),
  bill: toad('THE SOLDIER SAYS THANKS.', 'AT LEAST I THINK SO. IT', 'WAS MOSTLY EXPLOSIONS.'),
  sophia: toad('JASON AND FRED SAY THANK', 'YOU! AND THE TANK... DID', 'THE TANK JUST HONK?'),
};

/** Every hidden hero freed: before 8-4 is beaten, and after. */
export const ALL_FREED_BEFORE: Page = toad(
  'EVERY HERO IS FREE! NOBODY',
  'HUNTS THE PRINCESS NOW...',
  'EXCEPT BOWSER. THE WAND',
  'MUST BE NEARLY EMPTY!',
);
export const ALL_FREED_AFTER: Page = toad(
  'EVERY HERO IS FREE! NOW',
  "THEY'RE ALL LOOKING FOR",
  'THE PRINCESS WITH US.',
);

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

/* ================================================================ S2 (0.4.23): the NPCs and the freeing talks */

/* ---------------------------------------------------------------- the hint NPCs (2.4-2.11) */

/** A partner's id (the `partner x y who=<id>` entity) and what it says when talked to (or read). */
export interface PartnerScript {
  /** The word over it while a player is in reach: TALK, or READ for the Chozo statue. */
  verb: 'TALK' | 'READ';
  /** Said by the announcer when a player comes within reach ("Dr. Light. Up to talk."). */
  name: string;
  pages: readonly Page[];
  /** The page after which a single coin pops out over it (the old man's "TAKE THIS."). */
  coinAfter?: number;
  /**
   * The hero this partner gives the hints for (docs/STORY.md 2.3 "Hint NPCs"). Once that hero is
   * freed on the file it says `after` instead of `pages`; with no `after` it is gone (Fred: home).
   */
  hero?: string;
  /** What it says once `hero` is freed (one page, NEW in 0.4.23). */
  after?: readonly Page[];
}

/** The pages partner `script` says on a file where the heroes `freed` are free (story/partners.ts). */
export function partnerPages(script: PartnerScript, freed: readonly string[]): readonly Page[] {
  return script.hero && script.after && freed.includes(script.hero) ? script.after : script.pages;
}

/** Whether partner `script` has left on a file where `freed` are free (a hint NPC with no after line). */
export function partnerGone(script: PartnerScript, freed: readonly string[]): boolean {
  return script.hero !== undefined && script.after === undefined && freed.includes(script.hero);
}

export const PARTNERS: Readonly<Record<string, PartnerScript>> = {
  // 1-1, column 55: the Mushroom Kingdom villager Luigi knocked flat on his way down the pipe (2.4).
  villager: {
    verb: 'TALK',
    name: 'A villager',
    hero: 'luigi',
    pages: [
      [
        'VILLAGER:',
        '',
        'OW, MY CAP! SOME GUY IN',
        'GREEN JUST KNOCKED ME FLAT',
        'AND JUMPED DOWN THIS PIPE!',
      ],
      ['VILLAGER:', '', 'HIS EYES WERE ALL GLOWY. HE', "DIDN'T EVEN SAY SORRY. BE", 'CAREFUL DOWN THERE!'],
    ],
    after: [
      [
        'VILLAGER:',
        '',
        'THAT WAS LUIGI? HE CAME BACK',
        'AND SAID SORRY. NICE GUY,',
        "WHEN HE'S NOT GLOWING.",
      ],
    ],
  },
  // 1-2's warp zone: not a hint for a hero; he says where the one working pipe goes (2.4).
  'pipe-keeper': {
    verb: 'TALK',
    name: 'The pipe keeper',
    pages: [
      [
        'PIPE KEEPER:',
        '',
        'WELCOME TO THE WARP ZONE!',
        'I KEEP THESE PIPES. THEY',
        'USED TO GO TO OTHER PARTS',
        'OF THE KINGDOM...',
      ],
      [
        'PIPE KEEPER:',
        '',
        "BUT SINCE THE KING'S BIG",
        'SPELL, ONLY THE MIDDLE ONE',
        'WORKS, AND IT GOES SOMEWHERE',
        'STRANGE.',
      ],
      [
        'PIPE KEEPER:',
        '',
        'A PLACE BETWEEN WORLDS!',
        'STRANGE FOLK PLAY STRANGE',
        'GAMES THERE. HAVE A LOOK,',
        'IF YOU DARE.',
      ],
    ],
  },
  // 2-1, by the vine block (83), in front of his cave doorway (2.5).
  'old-man': {
    verb: 'TALK',
    name: 'An old man',
    hero: 'link',
    coinAfter: 0,
    pages: [
      ['OLD MAN:', '', "IT'S DANGEROUS TO GO", 'ALONE! TAKE THIS.'],
      ['OLD MAN:', '', 'THE SILENT ONE WAITS ABOVE', 'THE CLOUDS. A BRICK RIGHT', 'UP THERE HIDES A VINE.'],
      ['OLD MAN:', '', 'ALSO, PAY ME FOR THE DOOR', 'REPAIR CHARGE. ...KIDDING.', 'THERE IS NO DOOR.'],
    ],
    after: [['OLD MAN:', '', 'THE SILENT ONE THANKED ME.', 'WELL, HE NODDED. SAME', 'THING.']],
  },
  // 2-1-sky, bobbing in the air at the arrival (2.5).
  fairy: {
    verb: 'TALK',
    name: 'A fairy',
    hero: 'link',
    pages: [
      ['FAIRY:', '', "THE SILENT ONE'S TEMPLE", 'FLOATS HIGHER STILL!'],
      [
        'FAIRY:',
        '',
        'RIDE THE CLOUDS TO WHERE',
        'THE COINS RUN OUT. THEN',
        'JUMP, AND BUMP THE EMPTY',
        'AIR. A VINE WILL GROW.',
      ],
    ],
    after: [['FAIRY:', '', 'YOU FOUND HIM! NOW GO ON,', 'SHOO. FAIRIES NEED NAPS.']],
  },
  // 3-1, on the ground before the vine block (131) (2.6).
  'dr-light': {
    verb: 'TALK',
    name: 'Doctor Light',
    hero: 'megaman',
    pages: [
      [
        'DR. LIGHT:',
        '',
        "AH, A VISITOR! MY BOY'S",
        'SIGNAL COMES FROM ABOVE',
        'THE SKY. A BLOCK UP THERE',
        'HIDES A VINE. CLIMB IT!',
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
    after: [['DR. LIGHT:', '', 'THANK YOU FOR BRINGING MY', 'BOY BACK. TAKE GOOD CARE', 'OF EACH OTHER!']],
  },
  // 4-2's Brinstar underground, before the vine block (64) (2.7). A caption: no speaker.
  chozo: {
    verb: 'READ',
    name: 'An old bird statue',
    hero: 'samus',
    pages: [
      ['AN OLD BIRD STATUE. ITS', 'EYES GLOW. WORDS ARE CUT', 'INTO ITS BASE:'],
      [
        'THE HUNTER SLEEPS BELOW.',
        'CLIMB THE VINE ABOVE TO',
        'THE PIPE THAT NO LONGER',
        'WARPS, AND GO DOWN.',
      ],
    ],
    after: [["THE STATUE'S EYES HAVE", 'GONE DARK. IT LOOKS...', 'PLEASED?']],
  },
  townsperson: {
    verb: 'TALK',
    name: 'A townsperson',
    hero: 'simon',
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
    after: [['TOWNSPERSON:', '', 'THE HUNTER IS FREE! WHAT A', 'WONDERFUL NIGHT TO HAVE NO', 'CURSE.']],
  },
  irene: {
    verb: 'TALK',
    name: 'Irene',
    hero: 'ryu',
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
    after: [['IRENE:', '', 'YOU FOUND HIM! HE THANKED', 'ME, THEN VANISHED. NINJAS.']],
  },
  lance: {
    verb: 'TALK',
    name: 'Lance',
    hero: 'bill',
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
    after: [['LANCE:', '', 'THANKS FOR BRINGING MY', 'PARTNER BACK. I OWE YOU A', 'SPREAD GUN.']],
  },
  // Fred the frog by 8-4-end's trap pipe (10): he can't talk, so his second page is a caption.
  // Once Sophia III is freed he is gone (home with Jason).
  fred: {
    verb: 'TALK',
    name: 'Fred the frog',
    hero: 'sophia',
    pages: [
      ['FRED:', '', 'RIBBIT.'],
      ['THE FROG LOOKS AT YOU,', 'THEN DOWN THE PIPE. THEN', 'AT YOU AGAIN.'],
    ],
  },
  // Sophia III's pilot, in his secret area behind 8-4-end's trap pipe (8-4-jason): talking to him
  // sends Fred into the pool (objects/fred.ts).
  jason: {
    verb: 'TALK',
    name: 'Jason',
    hero: 'sophia',
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
    after: [['JASON:', '', "SOPHIA'S BACK, FRED'S BACK.", 'BEST DAY EVER! THANK YOU!']],
  },
};

/* ---------------------------------------------------------------- 2.13: the freed talks */

/**
 * What each freed hero says (docs/STORY.md 2.4-2.11), between the round and the freed card
 * (scenes/free-hero.ts), by hero id; `you` is the full name of the hero who talked to them (the
 * `<HERO>` of the doc), who speaks the `<HERO>:` pages. Each talk reveals a bit more (2.13).
 */
export const FREED_TALKS: Readonly<Record<string, (you: string) => Page[]>> = {
  luigi: (you) => [
    ['LUIGI:', '', 'OOF... MY HEAD...', `${you}? IS THAT YOU?`],
    [`${you}:`, '', 'LUIGI! ...YOU DID SNAP OUT', "OF IT, DIDN'T YOU?"],
    [
      'LUIGI:',
      '',
      'I THINK SO! IT WAS BOWSER.',
      "HE'S GOT A MAGIC WAND, AND",
      "HE'S BRAINWASHING PEOPLE",
      'TO DO HIS BIDDING!',
    ],
    [
      'LUIGI:',
      '',
      'ALL HE WANTED FROM ME WAS',
      'ONE THING: FIND THE',
      "PRINCESS. AND I WASN'T THE",
      'ONLY ONE HE ZAPPED.',
    ],
    [
      'LUIGI:',
      '',
      'THERE WERE OTHERS IN THAT',
      'SPELL. HEROES FROM OTHER',
      'WORLDS! WE HAVE TO FIND',
      'THEM AND SAVE THEM TOO.',
    ],
    ['LUIGI:', '', 'BUT WHERE COULD THEY BE?', "...COUNT ME IN. LET'S GO!"],
  ],
  link: (you) => [
    ['LINK:', '', '...'],
    [`${you}:`, '', 'ARE YOU OKAY?'],
    [
      'LINK:',
      '',
      '...THANK YOU. THE SHADOW',
      'SHOWED ME HER. A PRINCESS',
      'IN PINK, RUNNING. NOT',
      'CAUGHT. RUNNING.',
    ],
    [
      'LINK:',
      '',
      "THE KING'S SPELL DID NOT",
      'TAKE ONLY ME. IT TORE MY',
      'LAND FROM ITS PLACE AND',
      'SET IT DOWN HERE.',
    ],
    ['LINK:', '', "EACH HERO'S LAND IS SEALED", 'WITH HIS MAGIC. FREE THEM,', 'AND THE SEALS WILL BREAK.'],
    ['LINK:', '', '...I WILL COME WITH YOU.'],
  ],
  megaman: (you) => [
    ['MEGA MAN:', '', 'SYSTEMS... REBOOTING. ROGUE', 'PROGRAM DELETED. THANK YOU,', `${you}!`],
    [
      'MEGA MAN:',
      '',
      'I LOGGED THE SPELL WHILE IT',
      'RAN ME. EVERY SPELL COMES',
      'FROM ONE SOURCE: THE WAND.',
    ],
    ['MEGA MAN:', '', 'WHEN YOU BREAK A SPELL, ITS', 'ENERGY SNAPS BACK INTO THE', "WAND. IT'S OVERLOADING!"],
    ['MEGA MAN:', '', 'FREE THE OTHERS, AND IT', "WILL KEEP SPARKING. LET'S", "GO. I'M READY!"],
  ],
  samus: (you) => [
    ['SAMUS:', '', 'THE PARASITE IS GONE.', `THANKS, ${you}.`, 'I OWE YOU ONE.'],
    ['SAMUS:', '', 'MY VISOR SCANNED THAT WAND', "WHILE I WAS UNDER. IT'S NOT", "EVEN THE KING'S."],
    ['SAMUS:', '', "IT'S REGISTERED TO ONE OF", 'HIS KIDS. LARRY. THE KING', 'STOLE IT FROM HIS OWN SON.'],
    ['SAMUS:', '', 'A KOOPA WHO ROBS HIS OWN', "FAMILY. I'VE HUNTED WORSE.", "NOT MANY. LET'S MOVE."],
  ],
  simon: (you) => [
    ['SIMON:', '', 'THE CURSE IS LIFTED. MY', 'BLOOD RUNS CLEAN AGAIN. I', `AM IN YOUR DEBT, ${you}.`],
    ['SIMON:', '', 'UNDER THE CURSE, I HUNTED', 'YOUR PRINCESS. EVERY TRAIL', 'WENT COLD. EVERY ONE.'],
    [
      'SIMON:',
      '',
      'SHE WARNS VILLAGES BEFORE',
      'THE KOOPAS COME. SHE LAYS',
      'FALSE TRACKS. NO HUNTER',
      'COULD CATCH HER.',
    ],
    [
      'SIMON:',
      '',
      'YOUR PRINCESS IS NO DAMSEL.',
      'BUT WE SHOULD FIND HER',
      'BEFORE THE KING DOES. LEAD',
      'ON.',
    ],
  ],
  ryu: () => [
    ['RYU:', '', 'THE MASK IS BROKEN. MY', 'BLADE IS MY OWN AGAIN.'],
    ['RYU:', '', "I SAW THE KING'S PLAN WHILE", 'I SERVED HIM. HIS STAND-INS', 'ARE NEARLY SPENT.'],
    ['RYU:', '', 'WHEN THE LAST ONE FALLS, HE', 'WILL HIDE IN HIS OWN', 'CASTLE AND FIGHT YOU', 'HIMSELF.'],
    [
      'RYU:',
      '',
      'AND I SAW YOUR PRINCESS',
      'ONCE, ON A ROOFTOP. SHE SAW',
      'ME TOO, AND VANISHED.',
      'LIKE A NINJA.',
    ],
  ],
  bill: (you) => [
    ['BILL:', '', "ALIEN'S OUT OF MY HEAD.", 'FEELS GOOD. THANKS,', `${you}.`],
    ['BILL:', '', "INTEL: THE KING'S WAND HAS", 'MORE CRACKS THAN MY OLD', "HELMET. IT'S ABOUT TO GO."],
    ['BILL:', '', 'ONE WORLD LEFT. ONE HERO', 'LEFT. THEN WE HIT THE', "KING'S BASE. LOCK AND", 'LOAD!'],
  ],
  sophia: (you) => [
    ['SOPHIA III:', '', 'SYSTEM REBOOT... PILOT', 'FOUND. HELLO, JASON.'],
    ['JASON:', '', "SOPHIA! YOU'RE OKAY! AND", `YOU... THANKS, ${you}.`],
    [
      'SOPHIA III:',
      '',
      'ALERT. SCAN SHOWS A TEAR',
      'IN SPACE UNDER THIS',
      "CASTLE. THE KING'S WAND IS",
      'HOLDING IT SHUT.',
    ],
    ['SOPHIA III:', '', 'BEYOND IT: A LAND NO MAP', 'SHOWS. NO KOOPA SIGNALS', 'THERE. NONE.'],
    ['JASON:', '', "WE'RE WITH YOU. CLIMB IN", 'ANY TIME!'],
  ],
};

/** Hero `id`'s freed talk, `you` speaking the `<HERO>:` pages; none for a hero without one. */
export function freedTalk(id: string, you: string): Page[] {
  return FREED_TALKS[id]?.(you) ?? [];
}

/* ================================================================ end of S2 */
