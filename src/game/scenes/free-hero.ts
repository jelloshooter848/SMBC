import type { Scene } from '@engine/scene';
import type { Action } from '@engine/input/actions';
import type { Game } from './game';
import type { LevelScene } from './level';
import type { GameState } from '../context';
import type { CharacterDef } from '../characters/character';
import { CardScene, MessageScene } from './message';
import { MenuScene } from './menu';
import { abilityHint } from './hints';
import { fontText, wrapText } from '../hud/text';
import { miniGameFor, type MiniGameDef, type MiniGameResult } from '../minigames';

/*
 * Freeing a brainwashed hero (campaign only, docs/HEROES.md). Talking to a captive pauses the
 * level (every scene here is pushed over it, so its clock and world stand still):
 *
 *   dialogue cards (the hero speaks) → rules card (MiniGameDef.title + rules) → one round
 *   (MiniGameDef.create) → pass: "<HERO> IS FREE!", the hero joins the file's roster (saved at
 *   once) and leaves the room in a puff; fail: TRY AGAIN? YES (a fresh round) / NO (back);
 *   quit: back. Back means the level exactly as it was left, its music restarted.
 *
 * The flow knows mini games only through the MiniGameDef contract (miniGameFor), so a hero's
 * mini game can be rebuilt without touching it.
 */

/** Dialogue cards go on with OK, B or MENU (any player), as the castle cards do plus OK. */
const CARD_KEYS: readonly Action[] = ['jump', 'attack', 'start'];

/** Columns a line may take in the dialogue box (CardScene panel: 228 px inside). */
export const CARD_COLS = 28;

/** Lines wrapped to the dialogue box (blank lines kept). */
function fit(lines: readonly string[]): string[] {
  return lines.flatMap((l) => (l.trim() === '' ? [''] : wrapText(l, CARD_COLS)));
}

/**
 * What a brainwashed hero says before the round; `player` is the hero of the player who came to
 * talk. Every line fits the box (a long mini game title wraps).
 */
export function captiveDialogue(hero: CharacterDef, def: MiniGameDef, player: CharacterDef): string[][] {
  const name = fontText(hero.name);
  const you = fontText(player.name);
  const lines = DIALOGUE[hero.id]?.(you) ?? [
    'NO ONE PASSES HERE.',
    `BEAT ME AT THE ${def.title}, IF YOU DARE!`,
  ];
  return [fit([`${name}:`, '', `...${name} SERVES`, 'KING KOOPA...']), fit([`${name}:`, '', ...lines])];
}

/** Each hero's own challenge (after "...<HERO> SERVES KING KOOPA..."). */
const DIALOGUE: Record<string, (you: string) => string[]> = {
  luigi: (you) => [
    `${you}? I KNOW NO ${you}.`,
    '',
    'RACE ME TO THE FLAG.',
    'BEAT ME, AND MAYBE...',
    'I WILL REMEMBER.',
  ],
  // The spell holds Link inside his own mind: the Shadow Keep.
  link: (you) => ['THE SHADOW... HOLDS ME...', '', `${you}... FIGHT IT WITH ME,`, 'IN HERE.'],
  // The brainwashing is a rogue program loose in his systems; it has built a dark copy of him.
  megaman: (you) => [
    'ERROR... ROGUE PROGRAM',
    'IN MY SYSTEMS...',
    'IT MADE A DARK COPY OF ME.',
    '',
    `${you}... HELP ME DELETE IT.`,
  ],
  // A parasite holds her, feeding on her will the way a Metroid feeds; it set Zebes to blow.
  samus: (you) => [
    'A PARASITE... LIKE A METROID',
    'IS FEEDING ON MY WILL.',
    '',
    'IT SET OFF THE COUNTDOWN.',
    `${you}... HELP ME ESCAPE!`,
  ],
  // Larry's wand woke the curse Dracula left in him (Simon's Quest): he is Dracula's thrall.
  simon: (you) => [
    "LARRY'S WAND WOKE THE CURSE",
    'DRACULA LEFT IN MY BLOOD.',
    'NOW I AM HIS THRALL.',
    '',
    `${you}... TAKE MY WHIP.`,
    'END HIM IN HIS CASTLE!',
  ],
};

/** The freed card's lines (and so its announcement): the hero's full name, "MEGA MAN IS FREE!". */
export function freedCard(hero: CharacterDef): string[] {
  const name = fontText(hero.name);
  return fit([
    `${name} IS FREE!`,
    '',
    `${name} JOINS YOUR TEAM.`,
    'PICK THE NEW HERO WHEN YOU ENTER A LEVEL.',
  ]);
}

/** The run's carried state, so nothing a round does to it leaks back into the level. */
export function snapshot(s: GameState): GameState {
  return {
    ...s,
    kit: { ...s.kit },
    kit2: { ...s.kit2 },
    checkpoint: s.checkpoint ? { ...s.checkpoint } : null,
  };
}

/**
 * Start the unlock flow for captive `heroId` over `level`; `talker` is the hero of the player who
 * talked (player 2's in co-op). Does nothing for a hero without a mini game (miniGameFor) or one
 * already freed.
 */
export function talkToCaptive(
  game: Game,
  level: LevelScene,
  heroId: string,
  talker: CharacterDef = game.state.character,
): void {
  const def = miniGameFor(heroId);
  const hero = game.deps.characters.find((c) => c.id === heroId);
  if (!def || !hero || game.freed.includes(heroId)) return;
  // Talked to once: the hero's mini game is in the Mini Game Arena from now on (saved).
  game.meet(heroId);
  const world = level.world;
  const audio = game.ctx.audio;
  const say = (lines: readonly string[]) => game.deps.announcer?.say(lines.filter(Boolean).join(' '));

  /** Pop everything over the level and play on. */
  const back = () => {
    while (game.scenes.depth > 0 && game.scenes.top !== level) game.scenes.pop();
    level.resume();
  };

  /** A card in a box over the level with an OK prompt, then `then`. */
  const card = (lines: string[], then: () => void): Scene => {
    say([...lines, 'OK to continue.']);
    return new CardScene(
      game,
      lines,
      () => {
        game.scenes.pop();
        then();
      },
      world,
      3600,
      { keys: CARD_KEYS, panel: true, prompt: () => fontText(abilityHint(game, 'OK', 'jump')) },
    );
  };

  const rules = () => {
    const lines = fit([def.title, '', ...def.rules].map(fontText));
    say([...lines, 'OK to start.']);
    game.scenes.push(
      new MessageScene(
        game,
        [...lines, '', fontText(`PRESS ${abilityHint(game, 'OK', 'jump')}`)],
        () => {
          game.scenes.pop();
          round();
        },
        // No timeout: the round starts only on OK.
        Infinity,
        ['start', 'jump'],
      ),
    );
  };

  const round = () => {
    const saved = game.state;
    const before = snapshot(saved);
    audio.stopMusic();
    let over = false;
    const scene = def.create(game, (result: MiniGameResult) => {
      if (over) return;
      over = true;
      // The round's own scenes (its menu) go with it; the run is as the level left it.
      while (game.scenes.depth > 0 && game.scenes.top !== level) {
        if (game.scenes.pop() === scene) break;
      }
      game.state = saved;
      Object.assign(saved, before);
      ended(result);
    });
    game.scenes.push(scene);
  };

  const ended = (result: MiniGameResult) => {
    if (result === 'pass') {
      game.freeHero(hero.id); // saved at once
      world.freeCaptive(hero.id);
      audio.sfx('1up');
      game.scenes.push(card(freedCard(hero), back));
    } else if (result === 'fail') {
      audio.sfx('bump');
      game.deps.announcer?.say('Try again?');
      game.scenes.push(
        new MenuScene(
          game,
          'TRY AGAIN?',
          [
            {
              label: 'Yes',
              select: () => {
                game.scenes.pop();
                round();
              },
            },
            { label: 'No', select: back },
          ],
          back,
        ),
      );
    } else back();
  };

  audio.sfx('pause');
  const [first, ...more] = captiveDialogue(hero, def, talker);
  const chain = (pages: string[][], then: () => void): (() => void) =>
    pages.reduceRight<() => void>((next, lines) => () => game.scenes.push(card(lines, next)), then);
  chain(first ? [first, ...more] : more, rules)();
}
