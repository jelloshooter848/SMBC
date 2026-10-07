import type { Action } from '@engine/input/actions';
import { tileToSub } from '@engine/math/units';
import type { World } from '../world/world';
import type { Player } from '../entities/player';
import { Goomba } from '../entities/enemies/goomba';
import { CardScene } from '../scenes/message';
import { abilityHint } from '../scenes/hints';
import { fontText, wrapText } from '../hud/text';
import type { Lesson } from './stage-prompts';
import type { StageTutorial, TutorialContext } from './stage-tutorial';
import { ShadowTeaseScene } from './tease';
import { storyOn } from '../story/beats';
import { STORY_TOAD_PAGES } from '../story/script';

/*
 * Mario's tutorial stage 1-0 (owner brief, 0.5.0; the map: src/content/levels/world1/1-0.map).
 * World 1's start node on the map: every new file stands on it, and 1-1 opens once it is cleared.
 * It doubles as the game's general tutorial and the start of the story: Toad greets Mario and
 * tells him what Bowser did, the lessons follow one by one, and near the end a brainwashed hero's
 * shadow dashes past while Bowser laughs.
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

/** The tutorial's pipe room (1-0-pipe.map). */
export const PIPE_ROOM = '1-0-pipe';

/**
 * The lessons, in the stage's order (columns from 1-0.map). Their words name abilities: the
 * tokens become "JUMP (Z)" with a keyboard, the button's caption on touch (stage-prompts.ts).
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
    id: 'run',
    at: 17,
    text: 'HOLD [RUN:attack] TO RUN, THEN [JUMP:jump] OVER THE GAP.',
    // The touch pad runs too: a push to its outer ring (touch-logic.ts DPAD_RUN_R).
    touchText: 'TO RUN, PUSH THE D-PAD FAR TO THE SIDE OR HOLD [RUN:attack]. THEN [JUMP:jump] OVER THE GAP.',
    done: (w) => landedPast(w, 29),
  },
  {
    id: 'stomp',
    at: 30,
    text: 'JUMP ON THE GOOMBA TO STOMP IT!',
    done: (w) => w.feats.stomps > 0,
    passX: 50,
    // Its Goomba (column 40) has spawned once a player is past column 38; none alive then means
    // it walked off the left of the screen.
    gone: (w) => past(w, 38) && !w.entities.some((e) => e instanceof Goomba && e.alive),
  },
  {
    id: 'block',
    at: 44,
    text: 'JUMP UP UNDER THE ? BLOCK TO BUMP IT FOR A COIN.',
    done: (w) => w.feats.coinBlocks > 0,
    passX: 56,
  },
  {
    id: 'grow',
    at: 52,
    text: 'THIS ? BLOCK HOLDS A MUSHROOM. BUMP IT, THEN TOUCH THE MUSHROOM TO GROW BIG.',
    // Power-up heroes only: a co-op partner with hit points is never 'small'.
    done: (w) =>
      w.players.some((p) => alive(p) && p.def.damage.kind === 'powerup' && p.powerState !== 'small'),
    passX: 65,
  },
  {
    id: 'brick',
    at: 64,
    text: 'BIG MARIO CAN BREAK BRICKS. JUMP UP AND HIT ONE!',
    done: (w) => w.feats.bricks > 0,
    passX: 74,
  },
  {
    id: 'pipe',
    at: 72,
    text: 'STAND ON THE PIPE AND HOLD [DOWN:down] TO GO IN.',
    done: (w) => w.level.id === PIPE_ROOM,
  },
  {
    id: 'pipe-out',
    at: 72,
    area: PIPE_ROOM,
    text: 'GRAB THE COINS, THEN WALK RIGHT INTO THE SIDE PIPE.',
    done: (w) => w.level.id !== PIPE_ROOM,
  },
  {
    id: 'flag',
    at: 82,
    text: 'JUMP ONTO THE FLAGPOLE. THE HIGHER YOU GRAB IT, THE MORE POINTS!',
    done: (w) => w.flagGrabbedBy !== null,
  },
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
 * Toad's pages one after another over the frozen level (CardScene panel, at the top), then `done`:
 * the story's greeting in the campaign (docs/STORY.md 2.1, STORY_TOAD_PAGES), else TOAD_PAGES.
 */
function greet({ game, scene }: TutorialContext, done: () => void): void {
  const pages = storyOn(game) ? STORY_TOAD_PAGES : TOAD_PAGES;
  game.ctx.audio.sfx('pause');
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
        3600,
        { keys: CARD_KEYS, panel: true, prompt, top: true },
      ),
    );
  };
  show(0);
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
  greet,
  // Back up from the pipe room, a few steps before the flagpole.
  beat: {
    lesson: 'flag',
    x: 83,
    play(ctx, done) {
      const hero = shadowHero(ctx);
      if (!hero) return done();
      const { game, scene } = ctx;
      game.scenes.push(
        new ShadowTeaseScene(game, scene.world, hero, () => {
          game.scenes.pop();
          scene.resume();
          done();
        }),
      );
    },
  },
};
