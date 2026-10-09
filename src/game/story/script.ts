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

/** Bowser on first entering 8-4's bridge room (campaign), in the prompt box. */
export function noMoreStandIns(hero: string): Page {
  return ['BOWSER: NO MORE STAND-INS,', `${hero}. THIS TIME IT'S`, 'REALLY ME! BWA HA HA!'];
}

/* ---------------------------------------------------------------- 2.7: Larry and the ball */

/**
 * 4-2's anchor scene (0.4.39, world/anchor-scene.ts): Larry yells down the chain from his airship
 * after the anchor has knocked the hero back, before he climbs down, panics and scurries up.
 */
export const ANCHOR_LARRY_PAGES: readonly Page[] = [
  [
    'LARRY:',
    '',
    'AFTER MY WAND, ARE YOU?!',
    'NOBODY TAKES MY WAND!',
    '...NOBODY ELSE, ANYWAY.',
    'STAY RIGHT THERE!',
  ],
];

/** Said as Larry climbs down the anchor chain, sees the hero, panics and scurries back up. */
export const ANCHOR_LARRY_SAID = 'Larry climbs down the chain, sees you, panics and scurries back up!';

/** The hero's line as Larry scurries back up the chain, by hero id, without the speaker. */
const ANCHOR_HERO_LINES: Readonly<Record<string, Page>> = {
  mario: ["LET'S GET HIM!"],
  luigi: ["HE'S MORE SCARED THAN ME!", "LET'S GET HIM!"],
  link: ['...AFTER HIM!'],
  megaman: ['A FLYING FORTRESS? JUST', "LIKE DR. WILY'S. LET'S GO!"],
  samus: ['TARGET IS RUNNING.', 'MOVING TO INTERCEPT.'],
  simon: ['FLEE, COWARD! A BELMONT', 'NEVER LOSES THE TRAIL.'],
  ryu: ['HE CANNOT OUTRUN A NINJA.'],
  bill: ["BOGEY'S HEADING TOPSIDE.", "LET'S TAKE HIM DOWN!"],
  sophia: ['TARGET CLIMBING. SOPHIA', 'III, ENGAGE PURSUIT!'],
};

/** The heroes with their own line in the anchor scene (anchorHeroPage), in roster order. */
export const ANCHOR_HEROES: readonly string[] = Object.keys(ANCHOR_HERO_LINES);

/**
 * The hero's card at the end of 4-2's anchor scene: `name` (the hero's full name, upper case)
 * speaking hero `id`'s line, Mario's "LET'S GET HIM!" for a hero without one.
 */
export function anchorHeroPage(id: string, name: string): Page {
  return [`${name}:`, '', ...(ANCHOR_HERO_LINES[id] ?? ANCHOR_HERO_LINES.mario ?? [])];
}

/** Larry in his room, the first time the hero rises out of its pipe in a run. */
export const LARRY_PAGES: readonly Page[] = [
  ['LARRY:', '', 'HEY! THE KING TOOK MY', 'WAND, AND ALL I GOT WAS', 'THIS LOUSY SPARE!'],
  ['LARRY:', '', 'HE SAYS I GET IT BACK', 'WHEN THE PRINCESS IS', 'CAUGHT. SO BUZZ OFF!'],
];

/**
 * Larry in his room when the hero has already met him in 4-2's anchor scene (0.4.39: the file has
 * seen `anchor-4-2`): he knows the hero this time. The second page is LARRY_PAGES's.
 */
export const LARRY_AGAIN_PAGES: readonly Page[] = [
  ['LARRY:', '', 'YOU AGAIN?! THE KING TOOK', 'MY WAND, AND ALL I GOT WAS', 'THIS LOUSY SPARE!'],
  LARRY_PAGES[1] as Page,
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
          toad('THAT VILLAGER JUST DOWN', 'THE ROAD SAW WHERE HE WENT.', "LET'S GO BACK AND LOOK!"),
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
            'SPELL. THE OLD MAN IN THE',
            'FIELD CAVE KNOWS, I BET.',
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
            'BE OUT THERE. DR. LIGHT IS',
            'TRACKING HIS SIGNAL OUT BY',
            'THE RADIO MASTS!',
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
            'DOWN IN THE CAVERNS MUST',
            'KNOW WHERE SHE IS.',
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
            "THE OLD CASTLE'S GATE SAID",
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
          toad('STILL SEALED. WE NEED THE', 'NINJA. THAT AGENT IN THE', 'CITY STREETS WAS TRACKING', 'HIM!'),
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
            'IS WAITING IN THE DEEP',
            'JUNGLE, BY THE BRIDGES.',
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
  toad('THE LAST SPELL! THE TANK IS', 'STILL UNDER IT. HER PILOT IS', "LOST IN THE KING'S CASTLE."),
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
  /**
   * Talking again once the world's hero is freed (0.4.23, docs/STORY.md 2.5-2.11 "after-freed"):
   * this page instead of the welcome's plea.
   */
  after?: readonly Page[];
}

const welcome = (who: string, said: string, ...pages: string[][]): WelcomeScript => ({
  local: who,
  said,
  pages: pages.map((p) => [`${who}:`, '', ...p]),
});

/** Welcome `w` with its after-freed page (`lines`, spoken by its local). */
const afterFreed = (w: WelcomeScript, ...lines: string[]): WelcomeScript => ({
  ...w,
  after: [[`${w.local}:`, '', ...lines]],
});

/** The welcomes of worlds 2-8, by map page. */
export const WELCOMES: Readonly<Record<string, WelcomeScript>> = {
  'smb-2': afterFreed(
    welcome(
      'HEALER',
      'A healer',
      [
        'WELCOME TO HYRULE,',
        "TRAVELER. OR WHAT'S LEFT OF",
        'IT. A SPELL DRAGGED OUR',
        'LAND HERE, SEA AND ALL.',
      ],
      ['OUR HERO LINK HAS BEEN', 'BRAINWASHED BY SOMEONE.', 'PLEASE HELP!'],
      [
        'HE WAS LAST SEEN ON THE',
        'GREAT FIELD. AN OLD MAN IN',
        'A CAVE THERE KNOWS THINGS.',
        'HE ALWAYS DOES.',
      ],
      ['LET ME HEAL YOU BEFORE YOU', "GO. ...OH. YOU'RE FINE.", 'NEVER MIND.'],
    ),
    'LINK IS HIMSELF AGAIN!',
    'THANK YOU, TRAVELER. GO ON',
    'EAST, AND STAY HEALTHY...',
    "I'M STILL OUT OF PATIENTS.",
  ),
  'smb-3': afterFreed(
    welcome(
      'LAB ROBOT',
      'A lab robot',
      ['BEEP! WELCOME TO THE YEAR', '20XX. WELL, A CHUNK OF IT.', 'YOUR KINGDOM HAS ODD', 'PHYSICS.'],
      ['OUR HERO MEGA MAN HAS BEEN', 'REPROGRAMMED BY SOMEONE.', 'PLEASE HELP! BEEP!'],
      ['HIS LAST SIGNAL CAME FROM', 'THE RADIO MASTS. DR. LIGHT', 'IS OUT THERE, TRACKING IT.'],
    ),
    'BEEP! MEGA MAN IS BACK',
    'ONLINE! DR. LIGHT SAYS',
    'THANK YOU. THE ROAD AHEAD',
    'IS CLEAR. BEEP BOOP!',
  ),
  'smb-4': afterFreed(
    welcome(
      'SCIENTIST',
      'A scientist',
      [
        'WELCOME TO PLANET ZEBES...',
        'OR A PIECE OF IT. OUR',
        'WHOLE RESEARCH BASE CAME',
        'ALONG FOR THE RIDE.',
      ],
      ['THE HUNTER WHO GUARDS US,', 'SAMUS, HAS BEEN BRAINWASHED', 'BY SOMEONE. PLEASE HELP!'],
      ['HER LAST READING CAME FROM', "DEEP IN THE CAVERNS. THERE'S", 'AN OLD BIRD STATUE DOWN', 'THERE.'],
      ['ALSO, A KOOPA AIRSHIP KEEPS', 'CIRCLING OVER THE CAVERNS.', 'KEEP AN EYE ON THE SKY!'],
    ),
    'SAMUS IS BACK ON PATROL.',
    'OUR BASE IS SAFE AGAIN,',
    'THANKS TO YOU. ONWARD! THE',
    'NEXT WORLD NEEDS YOU MORE.',
  ),
  'smb-5': afterFreed(
    welcome(
      'MERCHANT',
      'A merchant',
      [
        'WELCOME, STRANGER, TO',
        'TRANSYLVANIA. A FOUL SPELL',
        'CARRIED OUR WHOLE COUNTRY',
        'HERE. EVEN THE NIGHTS.',
      ],
      ['OUR HERO SIMON HAS BEEN', 'BRAINWASHED BY SOMEONE.', 'PLEASE HELP!'],
      [
        'HE WAS LAST SEEN IN THE',
        'OLD CASTLE AT THE END OF',
        'THE ROAD. A TOWNSPERSON',
        'WAITS AT ITS GATE.',
      ],
      ['WANT TO BUY A WHITE', 'CRYSTAL? ...NO? NOBODY', 'EVER DOES.'],
    ),
    'SIMON WALKS FREE AGAIN!',
    'YOU HAVE MY THANKS. NOW,',
    'ON YOUR WAY... AND STILL',
    'NO WHITE CRYSTAL? SHAME.',
  ),
  'smb-6': afterFreed(
    welcome(
      'ELDER',
      'The village elder',
      ['WELCOME TO OUR NINJA', 'VILLAGE. A DARK SPELL', 'BROUGHT IT HERE, SNOW AND', 'ALL.'],
      ['OUR YOUNG MASTER RYU HAS', 'BEEN BRAINWASHED BY', 'SOMEONE. PLEASE HELP!'],
      ['HE WAS LAST SEEN IN THE', 'CITY STREETS AT NIGHT. AN', 'AMERICAN AGENT IS ON HIS', 'TRAIL.'],
      ['A NINJA IS SEEN ONLY IF HE', 'WISHES TO BE. DO NOT LOOK', 'FOR HIM. LOOK FOR WHAT', 'HIDES HIM.'],
    ),
    'MASTER RYU HAS RETURNED TO',
    'HIMSELF. THE VILLAGE OWES',
    'YOU A DEBT. GO NOW. THE',
    'PATH AHEAD IS YOURS.',
  ),
  'smb-7': afterFreed(
    welcome(
      'SERGEANT',
      'A sergeant',
      ['WELCOME TO THE FRONT,', 'SOLDIER. SOME SPELL DROPPED', 'OUR WHOLE JUNGLE HERE,', 'ALIENS AND ALL.'],
      ['OUR BEST MAN, BILL, HAS', 'BEEN BRAINWASHED BY', 'SOMEONE. PLEASE HELP!'],
      [
        'HE WAS LAST SEEN IN THE',
        'DEEP JUNGLE, BY THE BRIDGES.',
        'HIS PARTNER LANCE IS',
        'WAITING THERE. MOVE OUT!',
      ],
    ),
    "BILL'S BACK IN THE FIGHT!",
    'GOOD WORK, SOLDIER. THE',
    'WHOLE UNIT SALUTES YOU.',
    'NOW MOVE OUT!',
  ),
  'smb-8': afterFreed(
    welcome(
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
        'OWN CASTLE AFTER HIS FROG.',
        'THAT FROG TAKES THE PIPES',
        'NOBODY ELSE DOES.',
      ],
      ['ODD THING... SOMEONE PULLED', 'UP A TURNIP RIGHT HERE. WHO', 'GROWS TURNIPS NEXT TO LAVA?'],
    ),
    "SOPHIA'S ROLLING AGAIN, AND",
    "THE BOY'S BACK WITH HIS",
    'FROG. THANK YOU, STRANGER!',
    'MIND THE LAVA ON YOUR WAY.',
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

/**
 * 2.1: Toad bursts into Mario's house (0.4.36, owner: it opens with these words), before her
 * note. It replaces the caption over Peach's courtyard ('PRINCESS PEACH IS MISSING!').
 */
export const OPENING_BURST: Page = toad(
  'MARIO!!! THANK GOODNESS',
  "YOU'RE HERE! PRINCESS PEACH",
  'IS MISSING... SHE LEFT',
  'THIS NOTE:',
);

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

/** 2.1: after the note, Toad to Mario (his name is not said twice: the first card said it). */
export const OPENING_TOAD_PAGES: readonly Page[] = [
  toad('THE KOOPAS ARE ALREADY OUT', 'HUNTING FOR HER. WE HAVE TO', 'FIND HER FIRST!'),
  toad('COME ON, THE ROAD STARTS', 'RIGHT OUTSIDE YOUR DOOR.', "LET'S GO!"),
];

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
  /** What it says once `hero` is freed (NEW in 0.4.23; one to three pages since 0.4.40). */
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

  /* -------------------------------------------- 0.4.40: an NPC in every level (World 1, Luigi) */

  // 1-2, by the spot the heroes drop in: a Toad hiding underground.
  'cave-toad': {
    verb: 'TALK',
    name: 'A cave Toad',
    hero: 'luigi',
    pages: [
      [
        'CAVE TOAD:',
        '',
        'PSST! IS IT SAFE? I SAW A',
        'GUY IN GREEN UP ON THE',
        'FIRST ROAD. GLOWING EYES.',
        'HE DOVE DOWN A PIPE.',
      ],
      [
        'CAVE TOAD:',
        '',
        'A VILLAGER UP THERE GOT',
        'KNOCKED FLAT. HE SAW WHICH',
        'PIPE. PLEASE, GO FIND THAT',
        'POOR GUY!',
      ],
    ],
    after: [
      [
        'CAVE TOAD:',
        '',
        "LUIGI'S FREE? PHEW! LAST",
        'TIME MARIO WENT MISSING,',
        'LUIGI FOUND HIM. THIS TIME',
        "IT'S PEACH.",
      ],
    ],
  },
  // 1-3, on the ground at the start, under the treetops.
  lookout: {
    verb: 'TALK',
    name: 'A lookout',
    hero: 'luigi',
    pages: [
      [
        'LOOKOUT:',
        '',
        'FROM THOSE TREETOPS I CAN',
        'SEE THE WHOLE ROAD! JUST',
        'NOT DOWN PIPES. NOBODY CAN',
        'SEE DOWN PIPES.',
      ],
      [
        'LOOKOUT:',
        '',
        'THE FELLOW IN GREEN WENT',
        'DOWN ONE ON THE FIRST ROAD,',
        'BY THE VILLAGER. PLEASE,',
        'GO BRING HIM BACK!',
      ],
    ],
    after: [
      [
        'LOOKOUT:',
        '',
        "LUIGI'S FREE! I WATCHED HIM",
        'CLEAR THREE TREES IN ONE',
        "JUMP. DON'T TELL MARIO I",
        'SAID THAT.',
      ],
    ],
  },
  // 1-4, at the foot of the castle's entrance steps: one of the princess's retainers, spying.
  retainer: {
    verb: 'TALK',
    name: 'A retainer',
    hero: 'luigi',
    pages: [
      [
        'RETAINER:',
        '',
        'SHH! I SNUCK IN TO SPY ON',
        'THE KING. BUT THE ROAD OUT',
        'OF THIS LAND IS SEALED BY',
        'HIS MAGIC.',
      ],
      [
        'RETAINER:',
        '',
        "IT WON'T OPEN TILL LUIGI IS",
        'FREE. HE WENT DOWN A PIPE',
        'ON THE FIRST ROAD. PLEASE,',
        'GO BACK FOR HIM!',
      ],
    ],
    after: [
      [
        'RETAINER:',
        '',
        "LUIGI'S FREE? THEN GO GET",
        'THE KING! BETWEEN US, HE',
        'LOOKS SHORTER THAN USUAL',
        'TODAY.',
      ],
      ['RETAINER:', '', "AND IF THE PRINCESS ISN'T", 'IN THIS CASTLE... WELL.', 'THAT HAPPENS A LOT.'],
    ],
  },

  /* ---------------------------------------------------- World 2 (Hyrule, Link): Zelda II folk */

  // 2-2's way out (2-2-exit), on the ground below the steps to the flag. A townsman of Hyrule.
  error: {
    verb: 'TALK',
    name: 'Error',
    hero: 'link',
    pages: [
      ['ERROR:', '', 'I AM ERROR.'],
      [
        'ERROR:',
        '',
        'YOU SEEK THE SILENT ONE? HE',
        'WAS LAST SEEN ON THE GREAT',
        'FIELD. THE OLD MAN IN THE',
        'CAVE THERE KNOWS MORE.',
      ],
      ['ERROR:', '', 'PLEASE FIND HIM. MY FRIEND', 'BAGU IS WORRIED SICK.'],
    ],
    after: [
      ['ERROR:', '', 'I AM STILL ERROR.'],
      ['ERROR:', '', 'THE SILENT ONE IS FREE?', 'THEN NOTHING HERE IS AN', 'ERROR. EXCEPT ME.'],
    ],
  },
  // 2-3's start, before the stone bridges: the man who keeps them.
  'river-man': {
    verb: 'TALK',
    name: 'The river man',
    hero: 'link',
    pages: [
      ['RIVER MAN:', '', 'HALT! NOBODY CROSSES MY', 'BRIDGES WITHOUT A NOTE', 'FROM BAGU.'],
      [
        'RIVER MAN:',
        '',
        '...THE SILENT ONE CROSSED',
        'WITHOUT ONE. HE WAS ON THE',
        'GREAT FIELD, STARING AT THE',
        'CLOUDS. EYES ALL WRONG.',
      ],
      ['RIVER MAN:', '', 'GO BACK AND FIND HIM. HE', 'NEEDS HELP MORE THAN MY', 'BRIDGES NEED NOTES.'],
    ],
    after: [
      ['RIVER MAN:', '', 'HALT! NOBODY CROSSES', 'WITHOUT A NOTE FROM BAGU.'],
      ['RIVER MAN:', '', 'THE SILENT ONE WROTE YOU', "ONE? IT SAYS '...'.", 'GOOD ENOUGH. GO ON.'],
    ],
  },
  // 2-4, at the foot of the palace's entrance steps, before its knight statues.
  'wise-man': {
    verb: 'TALK',
    name: 'A wise man',
    hero: 'link',
    pages: [
      [
        'WISE MAN:',
        '',
        'THE ROAD OUT OF HYRULE IS',
        'SEALED. ONLY THE SILENT',
        "ONE'S FREEDOM CAN BREAK",
        'THE SPELL.',
      ],
      [
        'WISE MAN:',
        '',
        'SEEK HIM ABOVE THE CLOUDS',
        'OF THE GREAT FIELD. I WOULD',
        "GO MYSELF, BUT I'M WISE.",
        'I KNOW BETTER.',
      ],
    ],
    after: [
      [
        'WISE MAN:',
        '',
        'THE SILENT ONE IS FREE! FOR',
        'THIS, I TEACH YOU A SPELL.',
        'IT TURNS YOUR FOES INTO',
        'LITTLE BLOBS.',
      ],
      ['WISE MAN:', '', '...NOTHING? HM. IT WORKS', "BETTER IN HYRULE. YOU'RE", 'DOING FINE WITHOUT IT.'],
    ],
  },

  /* ------------------------------------- World 3 (Mega City, Mega Man): Dr. Light's robots */

  // 3-2's start, in the robot forest.
  'prune-bot': {
    verb: 'TALK',
    name: 'A prune bot',
    hero: 'megaman',
    pages: [
      ['PRUNE BOT:', '', 'BZZT. TRIMMING TREES.', 'WOOD MAN GROWS THEM FASTER', 'THAN I CAN CUT THEM.'],
      [
        'PRUNE BOT:',
        '',
        'MEGA MAN? HIS SIGNAL WENT',
        'STRANGE. DR. LIGHT TRACKS',
        'IT BY THE RADIO MASTS.',
        'PLEASE, HELP HIM. BZZT.',
      ],
    ],
    after: [
      [
        'PRUNE BOT:',
        '',
        'MEGA MAN IS BACK ONLINE!',
        "WOOD MAN'S LEAF SHIELD? IT'S",
        'JUST LEAVES. I RAKE THEM UP',
        'EVERY WEEK.',
      ],
    ],
  },
  // 3-3's start, on the steel deck under the cloud platforms.
  'weather-bot': {
    verb: 'TALK',
    name: 'A weather bot',
    hero: 'megaman',
    pages: [
      ['WEATHER BOT:', '', 'FORECAST: WINDY, WITH A', 'CHANCE OF FLYING TURTLES.'],
      [
        'WEATHER BOT:',
        '',
        'ALSO: MEGA MAN, MISSING.',
        'LAST SIGNAL: THE RADIO',
        'MASTS. DR. LIGHT IS THERE.',
        'PLEASE, BRING HIM HOME.',
      ],
    ],
    after: [
      ['WEATHER BOT:', '', 'FORECAST: WINDY. CAUSE: AIR', 'MAN. MANY HEROES CANNOT', 'BEAT AIR MAN.'],
      ['WEATHER BOT:', '', 'MEGA MAN CAN. I CHECKED.', 'HAVE A NICE DAY.'],
    ],
  },
  // 3-4, at the foot of the fortress's entrance steps: a guard robot on his break, shield up.
  'sniper-joe': {
    verb: 'TALK',
    name: 'Sniper Joe',
    hero: 'megaman',
    pages: [
      [
        'SNIPER JOE:',
        '',
        "HALT! ...OH. YOU'RE NOT THE",
        "BLUE ONE. I'M ON MY BREAK.",
        'THE SHIELD STAYS UP. HABIT.',
      ],
      [
        'SNIPER JOE:',
        '',
        "THE BLUE ONE? THE KING'S",
        'SPELL GOT HIM. LAST SIGNAL:',
        'UP OVER THE RADIO MASTS.',
      ],
      ['SNIPER JOE:', '', 'GO GET HIM. WORK IS NO FUN', 'WITHOUT HIM. GO, BEFORE I', 'CLOCK BACK IN.'],
    ],
    after: [
      ['SNIPER JOE:', '', "THE BLUE ONE'S FREE? GOOD.", 'HE ONCE BEAT EIGHT OF MY', 'BOSSES IN A ROW.'],
      [
        'SNIPER JOE:',
        '',
        'THE BIG BOSS ALWAYS BEGGED',
        'FOR MERCY AT THE END. ON HIS',
        'KNEES. EVERY. TIME.',
      ],
    ],
  },

  /* ------------------------ World 4 (Planet Zebes, Samus): the Federation, a lab, a hatchling */

  // 4-1's start, on the planet's surface.
  trooper: {
    verb: 'TALK',
    name: 'A Federation trooper',
    hero: 'samus',
    pages: [
      [
        'TROOPER:',
        '',
        'FEDERATION TROOPER,',
        'REPORTING. OUR HUNTER,',
        'SAMUS, WENT DARK. WE LOST',
        'HER SIGNAL.',
      ],
      [
        'TROOPER:',
        '',
        'LAST READING: DEEP IN THE',
        'CAVERNS OF BRINSTAR. AN OLD',
        'BIRD STATUE STANDS DOWN',
        'THERE. PLEASE, FIND HER.',
      ],
    ],
    after: [
      [
        'TROOPER:',
        '',
        'SAMUS IS BACK ON PATROL!',
        'HALF MY SQUAD THOUGHT SHE',
        'WAS A MAN, TILL SHE TOOK',
        'OFF HER HELMET.',
      ],
      ['TROOPER:', '', "THE OTHER HALF THINK SHE'S", "A ROBOT. I DON'T ASK."],
    ],
  },
  // 4-3's start, in Norfair's heat.
  researcher: {
    verb: 'TALK',
    name: 'A researcher',
    hero: 'samus',
    pages: [
      ['RESEARCHER:', '', 'PHEW. I CAME TO STUDY', "NORFAIR'S HEAT. NOW I'M", 'MOSTLY STUDYING SWEAT.'],
      [
        'RESEARCHER:',
        '',
        'SAMUS COULD WALK THROUGH',
        "THIS. BUT SHE'S LOST IN THE",
        'CAVERNS OF BRINSTAR. PLEASE,',
        'BRING HER BACK!',
      ],
    ],
    after: [
      [
        'RESEARCHER:',
        '',
        'SAMUS IS FREE! SHE SAYS',
        'NORFAIR IS NICE THIS TIME',
        'OF YEAR. SHE HAS A HEAT',
        'SUIT. I HAVE A LAB COAT.',
      ],
    ],
  },
  // 4-4, Tourian: a hatchling floating at the foot of the entrance steps. It can't talk, so its
  // second card is a caption (like Fred's).
  'baby-metroid': {
    verb: 'TALK',
    name: 'A baby Metroid',
    hero: 'samus',
    pages: [
      ['BABY METROID:', '', 'CHIRP? CHIRP?'],
      [
        'IT DRIFTS BACK THE WAY YOU',
        'CAME, TOWARD THE CAVERNS',
        'OF BRINSTAR, THEN BACK TO',
        'YOU. IT MISSES THE HUNTER.',
      ],
    ],
    after: [
      ['BABY METROID:', '', 'CHIRP!'],
      ['IT THINKS THE HUNTER IS', 'ITS MOTHER. NOBODY HAS THE', 'HEART TO TELL IT.'],
    ],
  },

  /* -------------------------------- World 5 (Transylvania, Simon): the cursed country's folk */

  // 5-1's start, at the courtyard gate.
  'old-woman': {
    verb: 'TALK',
    name: 'An old woman',
    hero: 'simon',
    pages: [
      [
        'OLD WOMAN:',
        '',
        'A STRANGER, AT THIS HOUR?',
        'THE GATES ARE NO PLACE TO',
        'LINGER AFTER DARK, DEARIE.',
      ],
      [
        'OLD WOMAN:',
        '',
        'OUR SIMON IS UNDER A CURSE',
        'NOT HIS OWN. HE WAS LAST',
        'SEEN IN THE OLD CASTLE AT',
        'THE END OF THE ROAD.',
      ],
      ['OLD WOMAN:', '', 'PLEASE, BRING HIM HOME. HE', 'NEVER WIPES HIS BOOTS, BUT', "HE'S OUR BOY."],
    ],
    after: [
      ['OLD WOMAN:', '', 'SIMON IS FREE! NOW TAKE AN', "OLD WOMAN'S ADVICE:"],
      ['OLD WOMAN:', '', 'GET A SILK BAG FROM THE', 'GRAVEYARD DUCK TO LIVE', 'LONGER.'],
      ['OLD WOMAN:', '', "...WHAT? IT'S GOOD ADVICE."],
    ],
  },
  // 5-2's start, on the town street.
  'garlic-seller': {
    verb: 'TALK',
    name: 'A garlic seller',
    hero: 'simon',
    pages: [
      ['GARLIC SELLER:', '', 'GARLIC! FRESH GARLIC! KEEPS', 'VAMPIRES AWAY! ...MOSTLY.'],
      [
        'GARLIC SELLER:',
        '',
        'SIMON? THE CURSE TOOK HIM',
        'TO THE OLD CASTLE AT THE',
        'END OF THE ROAD. PLEASE,',
        'GO! FIRST CLOVE IS FREE.',
      ],
    ],
    after: [
      [
        'GARLIC SELLER:',
        '',
        'SIMON CAME BY AND BOUGHT',
        'GARLIC. HE ALWAYS BUYS',
        'GARLIC. THEN HE DROPS IT',
        'IN A GRAVEYARD. EVERY TIME.',
      ],
    ],
  },
  // 5-3's start, at the foot of the clock tower.
  clockmaker: {
    verb: 'TALK',
    name: 'The clockmaker',
    hero: 'simon',
    pages: [
      [
        'CLOCKMAKER:',
        '',
        'TICK, TOCK. THIS CLOCK HAS',
        'STRUCK MIDNIGHT ALL WEEK.',
        'A CURSED HOUR, IF YOU ASK',
        'ME.',
      ],
      [
        'CLOCKMAKER:',
        '',
        'SIMON COULD BREAK IT. BUT',
        "HE'S LOST IN THE OLD CASTLE",
        'AT THE END OF THE ROAD.',
        'PLEASE, BRING HIM BACK.',
      ],
    ],
    after: [
      ['CLOCKMAKER:', '', 'THE MORNING SUN HAS', 'VANQUISHED THE HORRIBLE', 'NIGHT.'],
      [
        'CLOCKMAKER:',
        '',
        '...OR IT WILL. THE CLOCK',
        'STILL SAYS MIDNIGHT. BUT',
        "SIMON'S FREE, SO I HAVE",
        'HOPE.',
      ],
    ],
  },

  /* ------------------------ World 6 (Dragon Valley, Ryu): the ninja clan and a mountain hermit */

  // 6-1's start, in the moonlit field.
  ninja: {
    verb: 'TALK',
    name: 'A ninja',
    hero: 'ryu',
    pages: [
      ['NINJA:', '', '...YOU SAW ME? THEN I AM', 'NO NINJA. HMPH.'],
      [
        'NINJA:',
        '',
        'OUR MASTER RYU IS LOST TO',
        'A SPELL. THE CITY STREETS',
        'AT NIGHT. AN AGENT TRACKS',
        'HIM. FIND HIM, I BEG YOU.',
      ],
    ],
    after: [
      [
        'NINJA:',
        '',
        'MASTER RYU IS FREE. HIS',
        'FATHER ONCE FOUGHT A DUEL',
        'ON A FIELD LIKE THIS, UNDER',
        'A MOON LIKE THIS.',
      ],
      ['NINJA:', '', 'TWO LEAPS. ONE STRIKE. THE', 'GRASS STILL TALKS ABOUT IT.'],
    ],
  },
  // 6-3's start, at the foot of the snowy pass.
  hermit: {
    verb: 'TALK',
    name: 'A hermit',
    hero: 'ryu',
    pages: [
      ['HERMIT:', '', "COLD, ISN'T IT? THE SPELL", 'BROUGHT OUR SNOW ALONG.', 'AND TOOK OUR NINJA.'],
      [
        'HERMIT:',
        '',
        'SEEK RYU IN THE CITY',
        'STREETS AT NIGHT. AN',
        'AMERICAN AGENT IS ON HIS',
        'TRAIL. GO, AND HURRY.',
      ],
    ],
    after: [
      ['HERMIT:', '', 'RYU IS FREE. GOOD. NOW, ON', 'THESE CLIFFS, A WARNING:'],
      ['HERMIT:', '', 'BEWARE THE BIRDS. EVERY', 'NINJA FEARS THE BIRDS.', 'THEY KNOW WHAT THEY DID.'],
    ],
  },
  // 6-4, at the foot of the demon temple's entrance steps.
  'clan-scout': {
    verb: 'TALK',
    name: 'A clan scout',
    hero: 'ryu',
    pages: [
      ['CLAN SCOUT:', '', 'THE WAY OUT OF THIS VALLEY', 'IS SEALED UNTIL MASTER RYU', 'IS FREE.'],
      [
        'CLAN SCOUT:',
        '',
        'HE WAS LAST SEEN IN THE',
        'CITY STREETS AT NIGHT. GO.',
        'THE CLAN IS COUNTING ON',
        'YOU.',
      ],
    ],
    after: [
      [
        'CLAN SCOUT:',
        '',
        'MASTER RYU IS FREE. HEED',
        'THIS: IN OUR TEMPLES, FALL',
        'TO THE MASTER AND YOU START',
        'AGAIN FROM FAR BELOW.',
      ],
      ['CLAN SCOUT:', '', "HERE? I DON'T KNOW. DON'T", 'FALL.'],
    ],
  },

  /* ------------------------------------- World 7 (Galuga Island, Bill): soldiers of the front */

  // 7-1's start, on watch in the snowfield before the base.
  corporal: {
    verb: 'TALK',
    name: 'A corporal',
    hero: 'bill',
    pages: [
      ['CORPORAL:', '', 'EYES UP! THE ALIEN BASE IS', 'DEAD AHEAD. SO ARE THE', 'ALIENS.'],
      [
        'CORPORAL:',
        '',
        'WE LOST BILL TO SOME SPELL.',
        'LAST SEEN IN THE DEEP',
        'JUNGLE, BY THE BRIDGES.',
        'BRING HIM BACK. PLEASE.',
      ],
    ],
    after: [
      [
        'CORPORAL:',
        '',
        "BILL'S BACK! HE TAUGHT ME A",
        'SECRET CODE ONCE. UP, UP,',
        'DOWN, DOWN... THEN I FORGOT',
        'THE REST.',
      ],
      ['CORPORAL:', '', 'SOMETHING ABOUT THIRTY', 'LIVES. I COULD USE THIRTY', 'LIVES.'],
    ],
  },
  // 7-2's way out (7-2-exit), on the bank below the steps to the flag.
  'river-scout': {
    verb: 'TALK',
    name: 'A river scout',
    hero: 'bill',
    pages: [
      ['RIVER SCOUT:', '', 'YOU SWAM THAT RIVER? NICE.', 'THE ALIENS HATE WATER.', '...PROBABLY.'],
      [
        'RIVER SCOUT:',
        '',
        "BILL'S STILL OUT THERE,",
        'UNDER THE SPELL. DEEP',
        'JUNGLE, BY THE BRIDGES.',
        'BRING HIM HOME, SOLDIER.',
      ],
    ],
    after: [
      [
        'RIVER SCOUT:',
        '',
        "BILL'S FREE! FUNNY THING:",
        'IN SOME LANDS, THEY SAY',
        'BILL AND LANCE ARE ROBOTS.',
      ],
      ['RIVER SCOUT:', '', "I'VE MET BILL. HE'S NOT A", 'ROBOT. ...PRETTY SURE.'],
    ],
  },
  // 7-4, at the foot of the alien lair's entrance steps.
  medic: {
    verb: 'TALK',
    name: 'A medic',
    hero: 'bill',
    pages: [
      ['MEDIC:', '', 'STAY BACK! THIS PLACE IS', 'ALIVE. THE WALLS ARE', 'BREATHING.'],
      [
        'MEDIC:',
        '',
        'AND THE ROAD OFF THIS',
        "ISLAND IS SEALED TILL BILL'S",
        'FREE. DEEP JUNGLE, BY THE',
        'BRIDGES. HURRY, PLEASE!',
      ],
    ],
    after: [
      [
        'MEDIC:',
        '',
        "BILL'S FREE, AND HE NEVER",
        'EVEN NEEDED ME. ONE HIT',
        "AND HE'S DOWN, SURE. BUT HE",
        'NEVER STAYS DOWN.',
      ],
    ],
  },

  /* ------------------- World 8 (Bowser's Underworld, Sophia III): mutants and miners below */

  // 8-1's start, among the forest ruins.
  mutant: {
    verb: 'TALK',
    name: 'A mutant',
    hero: 'sophia',
    pages: [
      ['MUTANT:', '', "GRBL! DON'T SHOOT! I'M A", 'NICE MUTANT. MOSTLY.'],
      [
        'MUTANT:',
        '',
        'THE BOY WITH THE FROG WENT',
        "INTO THE KING'S OWN CASTLE.",
        'HE LOST HIS TANK. PLEASE,',
        'HELP HIM. GRBL.',
      ],
    ],
    after: [
      ['MUTANT:', '', 'GRBL! THE TANK IS ROLLING', 'AGAIN! SHE BLASTED ME ONCE,', 'BACK WHEN I WAS A BOSS.'],
      ['MUTANT:', '', 'NO HARD FEELINGS. I WAS A', 'VERY BAD BOSS.'],
    ],
  },
  // 8-2's start, before the techno castle's machines.
  engineer: {
    verb: 'TALK',
    name: 'An engineer',
    hero: 'sophia',
    pages: [
      ['ENGINEER:', '', 'CAREFUL. THESE MACHINES', 'BITE. EVERYTHING DOWN HERE', 'BITES.'],
      [
        'ENGINEER:',
        '',
        "THE KING'S SPELL TOOK THE",
        'TANK, SOPHIA. HER PILOT',
        "WENT INTO THE KING'S CASTLE",
        'AFTER HIS FROG. HELP THEM!',
      ],
    ],
    after: [
      ['ENGINEER:', '', "SOPHIA'S BACK! WHAT A", 'MACHINE. SHE HOVERS, SHE', 'CLIMBS WALLS, SHE DIVES.'],
      [
        'ENGINEER:',
        '',
        'AND THE BOY? OUT OF THE',
        'TANK, A SHORT FALL HURTS',
        'HIM BAD. SO HE STAYS IN',
        'THE TANK.',
      ],
    ],
  },
  // 8-3's start, in the frozen ruins.
  'ice-miner': {
    verb: 'TALK',
    name: 'An ice miner',
    hero: 'sophia',
    pages: [
      ['ICE MINER:', '', 'BRR! I CAME DOWN HERE FOR', 'GOLD. FOUND ICE. AND', 'MUTANTS.'],
      [
        'ICE MINER:',
        '',
        'SAW A BOY CHASE A FROG INTO',
        "THE KING'S CASTLE. THE FROG",
        'KNOWS A PIPE THE GUARDS',
        "DON'T. PLEASE, FOLLOW IT!",
      ],
    ],
    after: [
      ['ICE MINER:', '', 'THE TANK IS FREE! AND THE', 'FROG? FRED? HE STARTED ALL', 'THIS, YOU KNOW.'],
      [
        'ICE MINER:',
        '',
        'HOPPED IN A BOX OF STRANGE',
        'GOO, GREW HUGE, JUMPED DOWN',
        'A HOLE. THE BOY FOLLOWED',
        'HIM AND FOUND A TANK.',
      ],
    ],
  },
  // 8-4, on the floor past the first lava, before the piranha pipe (19): the king's worst guard.
  'castle-mutant': {
    verb: 'TALK',
    name: 'A guard mutant',
    hero: 'sophia',
    pages: [
      [
        'GUARD MUTANT:',
        '',
        'GRBL. I GUARD THIS HALL.',
        "I'M BAD AT IT. A BOY AND HIS",
        'FROG GOT RIGHT PAST ME.',
      ],
      [
        'GUARD MUTANT:',
        '',
        'THE FROG TOOK A PIPE NOBODY',
        "USES, BY THE KING'S BRIDGE.",
        'FOLLOW THE FROG. PLEASE.',
        'THE BOY IS LOST.',
      ],
    ],
    after: [
      ['GUARD MUTANT:', '', "GRBL. TANK'S FREE, BOY'S", "HAPPY, FROG'S HOME. I'M", 'STILL HERE.'],
      ['GUARD MUTANT:', '', 'GO GET THE KING. I WILL', 'GUARD THE HALL. BADLY.'],
    ],
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
