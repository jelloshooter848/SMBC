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
 * page 2 the story beat, on OK in the same box. 8-4's page 1 confirms the king was real.
 * (0.4.23, S3: 1-4 to 7-4 rewritten; 1-4's first page carries what Toad's old map card said.)
 */
export const CASTLE_PAGES: Readonly<Record<string, { reveal: Page; news: Page }>> = {
  '1-4': {
    reveal: ['THAT GOOMBA WAS UNDER A', 'SPELL! THE KING DRESSED', 'IT UP AS HIMSELF.'],
    news: ['THE REAL KING HIDES BEHIND', 'STAND-INS. HE FLED EAST,', 'WAND AND ALL.'],
  },
  '2-4': {
    reveal: ['A KOOPA UNDER THE SPELL,', "IN THE KING'S SHAPE AGAIN."],
    news: ['THE KOOPAS SEARCHED EVERY', 'CAVE IN THIS LAND. NO', 'PRINCESS. JUST OLD MEN.'],
  },
  '3-4': {
    reveal: ['A BUZZY BEETLE, UNDER THE', 'SPELL. STILL NOT THE KING.'],
    news: ['SOMEONE SLIPPED THE KOOPAS', 'A MAP SIGNED - P. IT LED', 'THEM STRAIGHT INTO A', 'SWAMP. HA!'],
  },
  '4-4': {
    reveal: ['A SPINY UNDER THE SPELL,', 'IN A KING SUIT. OUCH.'],
    news: ['LARRY IS TELLING EVERYONE', 'THE KING STOLE HIS WAND.', "FOR ONCE, HE'S NOT LYING."],
  },
  '5-4': {
    reveal: ['A LAKITU, OF ALL THINGS!', 'UNDER THE SPELL LIKE THE', 'REST.'],
    news: [
      'THE KOOPAS STORMED OUR',
      'VILLAGE, BUT IT WAS EMPTY.',
      'SOMEONE GOT US ALL OUT',
      'JUST BEFORE THEY CAME.',
    ],
  },
  '6-4': {
    reveal: ["A BLOOPER?! THE WAND'S", 'TRICKS ARE GETTING SILLY.'],
    news: ['THE KING SLEEPS WITH THE', 'WAND UNDER HIS PILLOW NOW.', "HE KNOWS YOU'RE COMING."],
  },
  '7-4': {
    reveal: ['A HAMMER BRO UNDER THE', 'SPELL. THAT WAS HIS LAST', 'STAND-IN!'],
    news: ['THE KOOPAS ARE ALL RUNNING', 'HOME. THE KING CALLED THEM', 'BACK TO GUARD HIS CASTLE.'],
  },
  '8-4': {
    reveal: ['NO TRICK THIS TIME. THAT', 'WAS THE REAL KING!'],
    news: ['BOWSER FELL... AND THE', 'WAND BROKE! ITS PIECES', 'FELL THROUGH A CRACK IN', 'THE WORLD!'],
  },
};

/** Said once as the wand breaks over 8-4's lava (campaign; a scene without on-screen text). */
export const WAND_BREAK_SAID =
  "The wand spins out of Bowser's hand and breaks! Its glowing pieces swirl into a crack in the air.";

/* ================================================================ S3 (0.4.23): castles, gates, welcomes, the rift
 * docs/STORY.md 2.3a (the hero's remark at the axe), 2.3b (the world gates and the welcomes) and
 * 2.12 (the rift waits for Sophia III). The castles' own pages are CASTLE_PAGES above.
 */

/** The hero's remark at castles 1-4 to 7-4 (2.3a: reaching the axe), by main level id, without the speaker. */
const CASTLE_REMARKS: Readonly<Record<string, Page>> = {
  '1-4': ["WAIT... THAT'S NOT BOWSER!", "IT'S A GOOMBA IN A BOWSER", 'SUIT!'],
  '2-4': ['ANOTHER FAKE! JUST A KOOPA', "TROOPA WEARING THE KING'S", 'FACE.'],
  '3-4': ["A BUZZY BEETLE?! SO THAT'S", 'WHY THE SHELL WAS SO SHINY.'],
  '4-4': ['A SPINY! NO WONDER THAT', 'SUIT LOOKED SO POINTY.'],
  '5-4': ['A LAKITU?! WITHOUT ITS', 'CLOUD IT LOOKS SO SMALL.'],
  '6-4': ['A BLOOPER?! IN A CASTLE?', 'HOW IS IT EVEN BREATHING?'],
  '7-4': ['A HAMMER BRO! THE LAST', 'FAKE. THE REAL KING MUST', 'BE CLOSE.'],
};

/** The castles with a remark (1-4 to 7-4), in order. */
export const REMARK_CASTLES: readonly string[] = Object.keys(CASTLE_REMARKS);

/** Castle `level`'s remark card, the player's hero `hero` (full name) speaking; null without one. */
export function castleRemark(level: string, hero: string): Page | null {
  const body = CASTLE_REMARKS[level];
  return body ? [`${hero}:`, '', ...body] : null;
}

const bowser = (...lines: string[]): Page => ['BOWSER:', '', ...lines];

/** One world gate's lines (2.3b): Toad's reminder, Bowser's cutaway, Toad once the seal breaks. */
export interface GateScript {
  reminder: readonly Page[];
  bowser: readonly Page[];
  toad: readonly Page[];
}

/** The gates out of worlds 1-7 (Bowser's misfires grow worse each time), `hero` filling <HERO>. */
export function gateScript(world: number, hero: string): GateScript | null {
  switch (world) {
    case 1:
      return {
        reminder: [
          toad('THE WAY ON IS SEALED BY', "BOWSER'S MAGIC... AND WE", "STILL HAVEN'T FOUND LUIGI!"),
          toad('THAT VILLAGER IN 1-1 SAW', "WHERE HE WENT. LET'S GO", 'BACK AND LOOK!'),
        ],
        bowser: [
          bowser('HUH? WHAT WAS THAT? MY WAND', 'JUST... SPUTTERED.'),
          bowser('...PROBABLY NOTHING. KEEP', 'LOOKING FOR THAT PRINCESS!'),
        ],
        toad: [
          toad('WHOA! DID YOU SEE THAT? WE', 'MUST BE WEAKENING HIS', 'SPELLS!'),
          toad('AND THE WAY TO ANOTHER', 'WORLD JUST OPENED UP.', "LET'S GO!"),
        ],
      };
    case 2:
      return {
        reminder: [
          toad(
            'THE WAY ON IS STILL SEALED,',
            'AND LINK IS STILL UNDER THE',
            'SPELL. THAT OLD MAN IN 2-1',
            'KNOWS SOMETHING, I BET.',
          ),
        ],
        bowser: [
          bowser('OW! MY EYEBROWS! THE WAND', 'JUST SPARKED AT ME!'),
          bowser("WHO'S MESSING WITH MY", 'SPELLS? FIND THAT PRINCESS,', 'YOU FOOLS!'),
        ],
        toad: [
          toad('ANOTHER SEAL, GONE! EVERY', 'HERO WE FREE TAKES A BITE', 'OUT OF HIS MAGIC.'),
          toad('THE NEXT WORLD IS OPEN. I', 'CAN HEAR MACHINES HUMMING', 'OVER THERE...'),
        ],
      };
    case 3:
      return {
        reminder: [
          toad(
            'STILL SEALED. MEGA MAN MUST',
            'STILL BE OUT THERE. DR.',
            'LIGHT IN 3-1 IS TRACKING',
            'HIS SIGNAL!',
          ),
        ],
        bowser: [
          bowser('WHAT NOW?! THE WAND FIRED', 'BY ITSELF! MY PORTRAIT! I', 'LOOKED SO GOOD IN THAT!'),
          bowser('THOSE HEROES ARE SUPPOSED', 'TO WORK FOR ME! WHO KEEPS', 'LETTING THEM GO?!'),
        ],
        toad: [
          toad('THAT SEAL CRACKED LIKE AN', 'EGG! HIS SPELLS ARE GETTING', 'WEAKER, ALL RIGHT.'),
          toad('ANOTHER WORLD IS OPEN. IT', 'LOOKS LIKE... A PLANET?', "CAREFUL, IT'S DARK IN THERE."),
        ],
      };
    case 4:
      return {
        reminder: [
          toad(
            'STILL SEALED! WE NEED THE',
            'HUNTER. THAT BIRD STATUE',
            'DOWN IN 4-2 MUST KNOW',
            'WHERE SHE IS.',
          ),
        ],
        bowser: [
          bowser('THE WAND IS SMOKING! IT', "WON'T STOP SMOKING!"),
          bowser(
            'LARRY! DID YOU SWAP MY',
            'WAND FOR YOUR CHEAP SPARE?!',
            '...WAIT. THIS IS THE GOOD',
            'ONE.',
          ),
        ],
        toad: [
          toad('HALFWAY THERE! HIS WAND', 'MUST BE SMOKING BY NOW.'),
          toad('THE NEXT WORLD IS OPEN...', 'BRR. I HEAR BATS. AND', 'ORGAN MUSIC.'),
        ],
      };
    case 5:
      return {
        reminder: [
          toad(
            'STILL SEALED. THE VAMPIRE',
            'HUNTER! THE TOWNSPERSON AT',
            'THE GATE OF 5-4 SAID',
            'SOMETHING ABOUT A LIFT...',
          ),
        ],
        bowser: [
          bowser("IS THAT... A CRACK? THAT'S", 'A CRACK! WHO PUT A CRACK IN', 'MY WAND?!'),
          bowser('...NOBODY TELL LARRY.'),
        ],
        toad: [
          toad('FIVE SEALS DOWN! THEY BREAK', "EASIER EVERY TIME. HE'S", 'RUNNING OUT OF MAGIC!'),
          toad("THE NEXT WORLD IS OPEN. IT'S", 'SNOWING THERE, AND I SAW A', 'SHADOW ON A ROOFTOP...'),
        ],
      };
    case 6:
      return {
        reminder: [
          toad('STILL SEALED. WE NEED THE', 'NINJA. THAT AGENT AT THE', 'START OF 6-2 WAS TRACKING', 'HIM!'),
        ],
        bowser: [
          bowser('WHOA! WHOA! THE WAND JUST', 'BLASTED MY THRONE TO BITS!'),
          bowser('GRR! FINE! WHO NEEDS A', 'THRONE? KOOPAS! DOUBLE THE', 'GUARDS!'),
        ],
        toad: [
          toad('SIX SEALS! I COULD HEAR', 'THAT ONE CRACK FROM HERE.'),
          toad('THE NEXT WORLD IS OPEN. A', 'JUNGLE... AND EXPLOSIONS.', 'LOTS OF EXPLOSIONS.'),
        ],
      };
    case 7:
      return {
        reminder: [
          toad(
            'STILL SEALED. WE NEED THE',
            'SOLDIER. HIS PARTNER LANCE',
            'IS WAITING AT THE START OF',
            '7-3.',
          ),
        ],
        bowser: [
          bowser('THE WAND IS SHAKING! I CAN', 'BARELY HOLD IT!'),
          bowser('ENOUGH! IF YOU WANT', 'SOMETHING DONE RIGHT, DO', 'IT YOURSELF.'),
          bowser('COME TO MY CASTLE,', `${hero}. I'LL BE WAITING!`, 'BWA HA HA!'),
        ],
        toad: [
          toad('THE LAST SEAL! THE ROAD', 'GOES STRAIGHT INTO', "BOWSER'S OWN LAND."),
          toad(`THIS IS IT, ${hero}!`, "LET'S FINISH THIS!"),
        ],
      };
    default:
      return null;
  }
}

/** World 8's rift still shut (2.12): Toad's reminder after the credits while Sophia III is captive. */
export const RIFT_SEALED_PAGES: readonly Page[] = [
  toad(
    'THE KING IS BEATEN, BUT',
    'THAT CRACK IS TOO SMALL TO',
    "GO THROUGH. SOMETHING'S",
    'HOLDING IT SHUT...',
  ),
  toad('THE LAST SPELL! THE TANK IS', 'STILL UNDER IT. HER PILOT IS', 'LOST SOMEWHERE IN 8-4.'),
];

/** The map's hint line on a castle whose road is sealed (`name`: the hero's full name). */
export function sealedHint(name: string): string {
  return `SEALED - FREE ${name} FIRST`;
}

/** A world's local on its start node (2.3b): who speaks, and the welcome. */
export interface WelcomeScript {
  /** The local's name as the speaker and the hint line say it ('LAB ROBOT'). */
  local: string;
  /** Said by the announcer on the node ("A healer."). */
  said: string;
  pages: readonly Page[];
}

const welcome = (who: string, said: string, ...pages: string[][]): WelcomeScript => ({
  local: who,
  said,
  pages: pages.map((p) => [`${who}:`, '', ...p]),
});

/** The welcomes of worlds 2-8, by map page. */
export const WELCOMES: Readonly<Record<string, WelcomeScript>> = {
  'smb-2': welcome(
    'HEALER',
    'A healer',
    [
      'WELCOME TO HYRULE,',
      "TRAVELER. OR WHAT'S LEFT OF",
      'IT. A SPELL DRAGGED OUR',
      'LAND HERE, SEA AND ALL.',
    ],
    ['OUR HERO LINK HAS BEEN', 'BRAINWASHED BY SOMEONE.', 'PLEASE HELP!'],
    ['HE WAS LAST SEEN NEAR 2-1.', 'AN OLD MAN THERE KNOWS', 'THINGS. HE ALWAYS DOES.'],
    ['LET ME HEAL YOU BEFORE YOU', "GO. ...OH. YOU'RE FINE.", 'NEVER MIND.'],
  ),
  'smb-3': welcome(
    'LAB ROBOT',
    'A lab robot',
    ['BEEP! WELCOME TO THE YEAR', '20XX. WELL, A CHUNK OF IT.', 'YOUR KINGDOM HAS ODD', 'PHYSICS.'],
    ['OUR HERO MEGA MAN HAS BEEN', 'REPROGRAMMED BY SOMEONE.', 'PLEASE HELP! BEEP!'],
    ['HIS LAST SIGNAL CAME FROM', '3-1. DR. LIGHT IS THERE,', 'TRACKING IT.'],
  ),
  'smb-4': welcome(
    'SCIENTIST',
    'A scientist',
    [
      'WELCOME TO PLANET ZEBES...',
      'OR A PIECE OF IT. OUR',
      'WHOLE RESEARCH BASE CAME',
      'ALONG FOR THE RIDE.',
    ],
    ['THE HUNTER WHO GUARDS US,', 'SAMUS, HAS BEEN BRAINWASHED', 'BY SOMEONE. PLEASE HELP!'],
    ['HER LAST READING CAME FROM', "DEEP UNDER 4-2. THERE'S AN", 'OLD BIRD STATUE IN THERE.'],
    ['ALSO, A KOOPA AIRSHIP KEEPS', 'CIRCLING 4-2. KEEP AN EYE', 'ON THE SKY!'],
  ),
  'smb-5': welcome(
    'MERCHANT',
    'A merchant',
    [
      'WELCOME, STRANGER, TO',
      'TRANSYLVANIA. A FOUL SPELL',
      'CARRIED OUR WHOLE COUNTRY',
      'HERE. EVEN THE NIGHTS.',
    ],
    ['OUR HERO SIMON HAS BEEN', 'BRAINWASHED BY SOMEONE.', 'PLEASE HELP!'],
    ['HE WAS LAST SEEN IN THE', 'OLD CASTLE, 5-4. A', 'TOWNSPERSON WAITS AT ITS', 'GATE.'],
    ['WANT TO BUY A WHITE', 'CRYSTAL? ...NO? NOBODY', 'EVER DOES.'],
  ),
  'smb-6': welcome(
    'ELDER',
    'The village elder',
    ['WELCOME TO OUR NINJA', 'VILLAGE. A DARK SPELL', 'BROUGHT IT HERE, SNOW AND', 'ALL.'],
    ['OUR YOUNG MASTER RYU HAS', 'BEEN BRAINWASHED BY', 'SOMEONE. PLEASE HELP!'],
    ['HE WAS LAST SEEN IN THE', 'CITY STREETS OF 6-2. AN', 'AMERICAN AGENT IS ON HIS', 'TRAIL.'],
    ['A NINJA IS SEEN ONLY IF HE', 'WISHES TO BE. DO NOT LOOK', 'FOR HIM. LOOK FOR WHAT', 'HIDES HIM.'],
  ),
  'smb-7': welcome(
    'SERGEANT',
    'A sergeant',
    ['WELCOME TO THE FRONT,', 'SOLDIER. SOME SPELL DROPPED', 'OUR WHOLE JUNGLE HERE,', 'ALIENS AND ALL.'],
    ['OUR BEST MAN, BILL, HAS', 'BEEN BRAINWASHED BY', 'SOMEONE. PLEASE HELP!'],
    ['HE WAS LAST SEEN AT 7-3.', 'HIS PARTNER LANCE IS', 'WAITING THERE. MOVE OUT!'],
  ),
  'smb-8': welcome(
    'MINER',
    'A miner',
    [
      'WELCOME TO THE UNDERWORLD,',
      'STRANGER. MUTANTS DOWN',
      'BELOW, AND NOW A SPIKY KING',
      'UPSTAIRS. LOVELY.',
    ],
    [
      'OUR HERO IS A TANK CALLED',
      'SOPHIA. SOMEONE BRAINWASHED',
      'HER, AND HER PILOT IS LOST.',
      'PLEASE HELP!',
    ],
    [
      "THE BOY WENT INTO THE KING'S",
      'CASTLE, 8-4, AFTER HIS FROG.',
      'THAT FROG TAKES THE PIPES',
      'NOBODY ELSE DOES.',
    ],
    ['ODD THING... SOMEONE PULLED', 'UP A TURNIP RIGHT HERE. WHO', 'GROWS TURNIPS NEXT TO LAVA?'],
  ),
};

/** The map's hint line on a start node with a local (`TALK TO THE HEALER`). */
export function welcomeHint(local: string): string {
  return `TALK TO THE ${local}`;
}

/* ================================================================ end of S3's region */

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
