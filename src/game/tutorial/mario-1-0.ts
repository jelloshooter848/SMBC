import type { Action } from '@engine/input/actions';
import { tileToSub } from '@engine/math/units';
import type { World } from '../world/world';
import type { Player } from '../entities/player';
import { Vine } from '../entities/objects/vine';
import { CardScene } from '../scenes/message';
import { abilityHint } from '../scenes/hints';
import { fontText, wrapText } from '../hud/text';
import type { Lesson } from './stage-prompts';
import type { StageTutorial, TutorialContext, TutorialGate } from './stage-tutorial';
import { ShadowTeaseScene } from './tease';
import { beat, storyOn } from '../story/beats';
import { playStoryCards } from '../story/cards';
import { STORY_TOAD_PAGES } from '../story/script';
import { BowserSpellScene } from '../story/bowser-spell';

/*
 * Mario's tutorial stage 1-0 (owner brief, 0.5.0; reworked in 0.4.36 from the owner's notes; the
 * map: src/content/levels/world1/1-0.map). World 1's start node on the map: every new file stands
 * on it, and 1-1 opens once it is cleared. It doubles as the game's general tutorial and the start
 * of the story: Toad greets Mario, the lessons follow one by one, and after the flagpole Bowser
 * interrupts in person and casts his spell (campaign, docs/STORY.md 2.2: story/bowser-spell.ts);
 * elsewhere a brainwashed hero's shadow dashes past while Bowser laughs (tease.ts), after the flag too.
 *
 * The lessons (0.4.36): walk; hop the steps; walk, then sprint (RUN held at top speed until the
 * bar fills) and walk again down a long stretch; two gaps only a sprinting jump clears (7 and 8
 * tiles: a walking jump falls short, and a fall drops Mario back in a few steps before the gap);
 * stomp the Goomba; bump a ? block; grow; take the pipe, and a line to search pipes for secrets;
 * find the hidden vine at the foot of a tall wall and climb it over; smash up through the bricks
 * at the end of a low tunnel (big Mario only); the flagpole. A task walked past is never skipped:
 * a gate (MARIO_GATES) blocks the way until it is done, and a player who stops at the gate is
 * shown Toad's card (waiting for a press) and put back before the task. Nothing resets mid-move.
 */

const alive = (p: Player): boolean => !p.dead && !p.out;

/** A player is at column `col` or past it. */
const past = (w: World, col: number): boolean =>
  w.players.some((p) => alive(p) && p.body.x >= tileToSub(col));

/** A player stands on the ground at column `col` or past it. */
const landedPast = (w: World, col: number): boolean =>
  w.players.some((p) => alive(p) && p.body.onGround && p.body.x >= tileToSub(col));

/** A player stands on top of the higher step (columns 14-15, its top on row 11). */
const onHighStep = (w: World): boolean =>
  w.players.some(
    (p) =>
      alive(p) &&
      p.body.onGround &&
      p.body.y + p.body.h <= tileToSub(11) &&
      p.centerX >= tileToSub(14) &&
      p.centerX < tileToSub(16),
  );

/** A player stands on a ledge whose top is row `row`, over columns `from` to `to` (any part of him). */
const onTop = (w: World, row: number, from: number, to: number): boolean =>
  w.players.some(
    (p) =>
      alive(p) &&
      p.body.onGround &&
      p.body.y + p.body.h <= tileToSub(row) &&
      p.body.x + p.body.w > tileToSub(from) &&
      p.body.x < tileToSub(to + 1),
  );

/** The tutorial's pipe room (1-0-pipe.map). */
export const PIPE_ROOM = '1-0-pipe';

/** The columns of 1-0's set pieces (the map's), for the lessons, the gates and the tests. */
export const MARIO_10 = {
  /** The long sprint stretch starts here; its gate stands at `sprintGate`. */
  sprintFrom: 18,
  sprintGate: 48,
  /** The two gaps: first column and width. A fall drops Mario back in at `back`. */
  gap1: { x: 58, w: 7, back: 51 },
  gap2: { x: 76, w: 8, back: 67 },
  goomba: 96,
  stompGate: 101,
  growGate: 120,
  pipe: 132,
  /** The hidden vine block (row 10) at the foot of the tall wall (columns 150-152, top row 5). */
  vine: { x: 149, y: 10 },
  vineWall: { from: 150, to: 152, top: 5 },
  /** The low tunnel's brick ceiling at its end (rows 9-10) and the step out (top row 10). */
  bricks: { from: 170, to: 171 },
  stepOut: { from: 172, to: 173, top: 10 },
  flag: 182,
} as const;
const M = MARIO_10;

/** Frames a sprint must hold top speed on the ground (0.75 s, about seven tiles) to fill the bar. */
export const SPRINT_FRAMES = 45;
/** Frames of walking pace (on the ground, moving, at walking speed or below) the "walk" asks for. */
export const WALK_FRAMES = 20;
/** Of the sprint bar: the share that shows the run-up to top speed (the rest fills while held). */
const RUN_UP_SHARE = 0.3;

/** Per world (a respawn or a put-back is a new world, so a fresh count): the sprint and the walk. */
const paces = new WeakMap<World, { sprint: number; walk: number; frame: number }>();
function pace(w: World): { sprint: number; walk: number; frame: number } {
  let s = paces.get(w);
  if (!s) paces.set(w, (s = { sprint: 0, walk: 0, frame: -1 }));
  return s;
}

/** The lead player's ground speed now (absolute, subpixels per frame). */
const speed = (w: World): number => Math.abs(w.player.body.vx);

/**
 * Counts the sprint and the walk once per world frame: a frame on the ground at top speed adds to
 * the sprint, anything slower empties it (tapping RUN or a short burst never fills it); a frame on
 * the ground moving at walking pace adds to the walk, anything else empties it.
 */
function tick(w: World): { sprint: number; walk: number } {
  const s = pace(w);
  if (s.frame === w.frame) return s;
  s.frame = w.frame;
  const p = w.player;
  const b = p.body;
  const top = p.def.movement.maxRun - 0x100;
  const v = Math.abs(b.vx);
  if (!alive(p) || v < top) s.sprint = 0;
  else if (b.onGround) s.sprint++;
  s.walk = alive(p) && b.onGround && v > 0 && v <= p.def.movement.maxWalk ? s.walk + 1 : 0;
  return s;
}

/**
 * The lessons, in the stage's order (columns from 1-0.map). Their words name abilities: the
 * tokens become "JUMP (Z)" with a keyboard, the button's caption on touch (stage-prompts.ts).
 * `retry` is Toad's card for a player who stops at the gate with the lesson not done.
 */
export const MARIO_LESSONS: readonly Lesson[] = [
  { id: 'walk', at: 2, text: 'HOLD [RIGHT:right] TO WALK.', done: (w) => past(w, 9) },
  {
    id: 'jump',
    at: 9,
    text: 'PRESS [JUMP:jump] TO HOP UP THE STEPS. HOLD IT LONGER TO JUMP HIGHER.',
    done: (w) => onHighStep(w) || landedPast(w, 17),
  },
  {
    id: 'sprint',
    at: M.sprintFrom,
    text: 'HOLD [RUN:attack] TO SPRINT. KEEP IT HELD AT TOP SPEED UNTIL THE BAR FILLS!',
    // The touch pad runs too: a push to its outer ring (touch-logic.ts DPAD_RUN_R).
    touchText: 'PUSH THE D-PAD FAR TO THE SIDE OR HOLD [RUN:attack] TO SPRINT, UNTIL THE BAR FILLS!',
    retry: 'THE WAY OPENS FOR A REAL SPRINT! HOLD [RUN:attack] AT TOP SPEED UNTIL THE BAR FILLS.',
    done: (w) => tick(w).sprint >= SPRINT_FRAMES,
    meter: (w) => {
      const p = w.player;
      const n = tick(w).sprint;
      if (n > 0) return RUN_UP_SHARE + (1 - RUN_UP_SHARE) * Math.min(1, n / SPRINT_FRAMES);
      return RUN_UP_SHARE * Math.min(1, speed(w) / p.def.movement.maxRun);
    },
  },
  {
    id: 'ease',
    at: 36,
    text: 'TOP SPEED! NOW LET GO OF [RUN:attack] AND JUST WALK.',
    retry: 'LET GO OF [RUN:attack] AND WALK UP TO THE GATE TO OPEN IT.',
    done: (w) => tick(w).walk >= WALK_FRAMES,
  },
  {
    id: 'gap1',
    at: M.gap1.back,
    text: 'A WALKING JUMP FALLS SHORT HERE. SPRINT WITH [RUN:attack] AND [JUMP:jump] FROM THE EDGE!',
    touchText: 'A WALKING JUMP FALLS SHORT HERE. SPRINT, THEN [JUMP:jump] FROM THE EDGE!',
    done: (w) => landedPast(w, M.gap1.x + M.gap1.w),
  },
  {
    id: 'gap2',
    at: M.gap2.back,
    text: 'AN EVEN WIDER ONE! GET UP TO TOP SPEED AND JUMP AT THE VERY EDGE.',
    done: (w) => landedPast(w, M.gap2.x + M.gap2.w),
  },
  {
    id: 'stomp',
    at: 85,
    text: 'JUMP ON THE GOOMBA TO STOMP IT!',
    retry: 'STOMP THE GOOMBA TO OPEN THE WAY. HERE IT COMES AGAIN!',
    done: (w) => w.feats.stomps > 0,
  },
  {
    id: 'block',
    at: 102,
    text: 'JUMP UP UNDER THE ? BLOCK TO BUMP IT FOR A COIN.',
    retry: 'BUMP THE ? BLOCK FOR A COIN TO OPEN THE WAY.',
    done: (w) => w.feats.coinBlocks > 0,
  },
  {
    id: 'grow',
    at: 106,
    text: 'THIS ? BLOCK HOLDS A MUSHROOM. BUMP IT, THEN TOUCH THE MUSHROOM TO GROW BIG.',
    retry: 'BUMP THE ? BLOCK AND GRAB THE MUSHROOM TO OPEN THE WAY.',
    // Power-up heroes only: a co-op partner with hit points is never 'small'.
    done: (w) =>
      w.players.some((p) => alive(p) && p.def.damage.kind === 'powerup' && p.powerState !== 'small'),
  },
  {
    id: 'pipe',
    at: 129,
    text: 'STAND ON THE PIPE AND HOLD [DOWN:down] TO GO IN.',
    done: (w) => w.level.id === PIPE_ROOM,
  },
  {
    id: 'pipe-out',
    at: 129,
    area: PIPE_ROOM,
    text: 'GRAB THE COINS, THEN WALK RIGHT INTO THE SIDE PIPE.',
    done: (w) => w.level.id !== PIPE_ROOM,
  },
  {
    // Owner note (0.4.36): after the pipe lesson, a line to search pipes for secrets.
    id: 'secrets',
    at: 137,
    note: true,
    text: 'PIPES OFTEN HIDE SECRETS. TRY GOING DOWN EVERY PIPE YOU FIND!',
    done: (w) => past(w, 144),
  },
  {
    id: 'vine',
    at: 144,
    text: 'SOME BLOCKS ARE HIDDEN! JUMP UNDER THE EMPTY SPOT AT THE FOOT OF THE TALL WALL.',
    done: (w) => w.entities.some((e) => e instanceof Vine && e.alive),
  },
  {
    id: 'climb',
    at: 144,
    // A respawn makes the block hidden again: back to finding it.
    restartsAt: 'vine',
    text: 'JUMP TO GRAB THE VINE AND HOLD [UP:up] TO CLIMB. THEN STEP OFF ONTO THE WALL.',
    done: (w) => onTop(w, M.vineWall.top, M.vineWall.from, M.vineWall.to) || landedPast(w, M.vineWall.to + 2),
  },
  {
    id: 'wall',
    at: 156,
    text: 'ONLY BIG MARIO CAN BREAK BRICKS. SMASH UP THROUGH THE BRICKS AT THE END OF THE TUNNEL!',
    done: (w) => onTop(w, M.stepOut.top, M.stepOut.from, M.stepOut.to) || landedPast(w, M.stepOut.to + 1),
  },
  {
    id: 'flag',
    at: 175,
    text: 'JUMP ONTO THE FLAGPOLE. THE HIGHER YOU GRAB IT, THE MORE POINTS!',
    done: (w) => w.flagGrabbedBy !== null,
  },
];

/**
 * The gates (0.4.36, owner: a task walked past resets until it is passed): a column of blocks
 * that closes the way on until lesson `after` is done, then breaks apart. A player who stops
 * at it is shown the current lesson's `retry` card and put back before the task.
 */
export const MARIO_GATES: readonly TutorialGate[] = [
  { col: M.sprintGate, top: 6, after: 'ease' },
  { col: M.stompGate, top: 6, after: 'stomp' },
  { col: M.growGate, top: 6, after: 'grow' },
];

/** Columns a line may take in the dialogue box (as the captive heroes' dialogue). */
const CARD_COLS = 28;

/** Toad's greeting, one box per page: the story, and on to the lessons. */
export const TOAD_PAGES: readonly (readonly string[])[] = [
  ['TOAD:', '', "MARIO! THANK GOODNESS YOU'RE HERE!"],
  ['TOAD:', '', 'BOWSER HAS BRAINWASHED THE HEROES OF OTHER WORLDS AND HIDDEN THEM ALONG YOUR ROAD.'],
  ['TOAD:', '', 'THEY HIDE IN SECRET PLACES: DOWN PIPES, UP VINES, BEHIND HIDDEN BLOCKS. LOOK EVERYWHERE!'],
  // The map's hint (a cleared level that still hides a hero shows a faint shape by its node).
  [
    'TOAD:',
    '',
    'FIND THEM, TALK TO THEM AND FREE THEM FROM HIS SPELL! IF A LEVEL HIDES SOMEONE YOU MISSED, LOOK CLOSELY AT THE MAP.',
  ],
  ['TOAD:', '', 'BUT FIRST, A QUICK WARM-UP. FOLLOW THE TIPS UP TOP!'],
];

/** Dialogue boxes go on with OK, BACK or MENU (any player), as the captive heroes' do. */
const CARD_KEYS: readonly Action[] = ['jump', 'attack', 'start'];

/** A page wrapped to the box (blank lines kept). */
function fit(lines: readonly string[]): string[] {
  return lines.flatMap((l) => (l.trim() === '' ? [''] : wrapText(l, CARD_COLS)));
}

/**
 * Toad's pages one after another over the frozen level (CardScene panel, at the top), then `done`.
 * In the campaign, the story's greeting (docs/STORY.md 2.1, STORY_TOAD_PAGES) as every story card
 * plays (story/cards.ts: OK or MENU the next page, BACK the rest; the music plays on). Else
 * TOAD_PAGES, as before (any of OK, BACK, MENU turns a page; the level's music restarts after).
 */
function greet({ game, scene }: TutorialContext, done: () => void): void {
  game.ctx.audio.sfx('pause');
  if (storyOn(game)) {
    playStoryCards(game, scene.world, STORY_TOAD_PAGES, () => {
      scene.resumePlay();
      done();
    });
    return;
  }
  const pages = TOAD_PAGES;
  // Asked every frame: switching to the touch pad mid-dialogue drops the key ("OK (Z)" → "OK").
  const prompt = (): string => fontText(abilityHint(game, 'OK', 'jump'));
  const show = (i: number): void => {
    const page = pages[i];
    if (!page) {
      scene.resume();
      done();
      return;
    }
    const lines = fit(page);
    game.deps.announcer?.say(`${lines.filter(Boolean).join(' ')} OK to continue.`);
    game.scenes.push(
      new CardScene(
        game,
        lines,
        () => {
          game.scenes.pop();
          show(i + 1);
        },
        scene.world,
        { keys: CARD_KEYS, panel: true, prompt, top: true },
      ),
    );
  };
  show(0);
}

/**
 * In the campaign, Bowser's spell (docs/STORY.md 2.2) over the level, every time 1-0 is played,
 * to his own theme. After the flagpole the level-clear walk goes on (its jingle plays); before it
 * (Pause → Skip tutorial) the level's music comes back. False outside the campaign (the tease).
 */
export function playBowserSpell({ game, scene }: TutorialContext, done: () => void): boolean {
  if (!storyOn(game)) return false;
  game.markSeen(beat.spell);
  game.scenes.push(
    new BowserSpellScene(game, scene.world, () => {
      game.scenes.pop();
      if (scene.world.flagGrabbedBy) scene.resumePlay();
      else scene.resume();
      done();
    }),
  );
  return true;
}

/** The shadow hero of the tease: Luigi (waiting brainwashed in 1-1's bonus room), else any other. */
function shadowHero({ game }: TutorialContext) {
  const chars = game.deps.characters;
  return chars.find((c) => c.id === 'luigi') ?? chars.find((c) => c.id !== 'mario') ?? chars[0];
}

export const MARIO_TUTORIAL: StageTutorial = {
  level: '1-0',
  hero: 'mario',
  lessons: MARIO_LESSONS,
  gates: MARIO_GATES,
  // The lessons after the mushroom need a big Mario (the brick wall): a respawn keeps him big.
  bigAfter: 'grow',
  greet,
  // Skipped from the pause menu: a file that never saw Bowser's spell sees it first.
  beforeSkip: (ctx, done) => !ctx.game.seen(beat.spell) && playBowserSpell(ctx, done),
  // After the flagpole (owner note, 0.4.36): Bowser interrupts once Mario is down the pole.
  beat: {
    when: (w) => w.clearPhase === 'hop',
    play(ctx, done) {
      if (playBowserSpell(ctx, done)) return;
      const hero = shadowHero(ctx);
      if (!hero) return done();
      const { game, scene } = ctx;
      game.scenes.push(
        new ShadowTeaseScene(game, scene.world, hero, () => {
          game.scenes.pop();
          scene.resumePlay();
          done();
        }),
      );
    },
  },
};
