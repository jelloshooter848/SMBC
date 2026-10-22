import { defaultPower, type GameState, type Rules } from '../context';
import { startHp, type CharacterDef } from '../characters/character';
import { CLASSIC_EXTRAS, heroFor, playedHero } from '../characters/registry';
import type { Game } from '../scenes/game';

/**
 * Before a World is built (LevelScene, TG-16): power, hit points and kit carried from other rules
 * go back to each hero's start for `rules` (lives, score, coins, checkpoint, time and the rest
 * stay), and a Classic-only extra no longer in the roster gives way to the first hero (TG-42).
 * `state.rules` is then set ('classic', or no key for Current). Said aloud. With the rules
 * unchanged and no extra carried it touches nothing but reads `game.state`.
 */
export function reconcileRules(game: Game, rules: Rules): void {
  const s = game.state;
  // Item 25: power and kit earned in a design Toggle heroes' Plays as swapped in (dev mode) go
  // back to the real design's start, kit too, once that design plays again (dev mode turned off,
  // or the swap undone). The flag then follows what plays now.
  const swapped = (c: CharacterDef) => isSwapped(game, c, rules);
  const real = (c: CharacterDef) => {
    const d = playedHero(game.ctx, c, rules);
    return { powerState: defaultPower(d), hp: startHp(d) };
  };
  // 36b: only the kit gained while swapped goes: the real design's kit the hero carried into a
  // swap begun in this run (swapKit, his own) comes back.
  const carried = (c: CharacterDef, k: GameState['swapKit']) => (k && k.hero === c.id ? { ...k.kit } : {});
  if (s.swapped && !swapped(s.character)) {
    ({ powerState: s.powerState, hp: s.hp } = real(s.character));
    s.kit = carried(s.character, s.swapKit);
    game.deps.announcer?.say('Hero design changed. Power reset.');
  }
  if (s.character2 && s.swapped2 && !swapped(s.character2)) {
    ({ powerState: s.powerState2, hp: s.hp2 } = real(s.character2));
    s.kit2 = carried(s.character2, s.swapKit2);
  }
  // A swap beginning now: the kit the hero carries into it is kept aside (36b).
  if (swapped(s.character)) {
    if (!s.swapped) s.swapKit = { hero: s.character.id, kit: { ...s.kit } };
    s.swapped = true;
  } else delete s.swapped;
  if (s.character2 && swapped(s.character2)) {
    if (!s.swapped2) s.swapKit2 = { hero: s.character2.id, kit: { ...s.kit2 } };
    s.swapped2 = true;
  } else delete s.swapped2;
  if (!s.swapped || s.swapKit?.hero !== s.character.id) delete s.swapKit;
  if (!s.swapped2 || s.swapKit2?.hero !== s.character2?.id) delete s.swapKit2;
  if ((s.rules ?? 'current') !== rules) {
    const reset = (c: CharacterDef) => {
      const d = playedHero(game.ctx, c, rules);
      return { powerState: defaultPower(d), hp: startHp(d) };
    };
    const p1 = reset(s.character);
    s.powerState = p1.powerState;
    s.hp = p1.hp;
    s.kit = {};
    // Player two's carried power and kit only when there is a player two.
    if (s.character2) {
      const p2 = reset(s.character2);
      s.powerState2 = p2.powerState;
      s.hp2 = p2.hp;
      s.kit2 = {};
    }
    if (rules === 'classic') s.rules = 'classic';
    else delete s.rules;
    game.deps.announcer?.say('Rules changed. Power reset.');
  }
  // BUG-10: a hero whose played design changed since its power was set (Toggle heroes' Plays as
  // flipped, or dev mode turned off with a hero swapped) starts at that design's power. A power
  // fits only when it is in the design's own list (a hit-point hero's is 'full'), so a power that
  // already fits, as every campaign and Classic power does, is never touched.
  const fits = (c: CharacterDef, power: string) => {
    const d = playedHero(game.ctx, c, rules);
    return d.damage.kind === 'powerup' ? d.damage.states.includes(power) : power === defaultPower(d);
  };
  const start = (c: CharacterDef) => {
    const d = playedHero(game.ctx, c, rules);
    return { powerState: defaultPower(d), hp: startHp(d) };
  };
  if (!fits(s.character, s.powerState)) {
    ({ powerState: s.powerState, hp: s.hp } = start(s.character));
    game.deps.announcer?.say('Hero design changed. Power reset.');
  }
  if (s.character2 && !fits(s.character2, s.powerState2))
    ({ powerState: s.powerState2, hp: s.hp2 } = start(s.character2));
  const extra = (c: CharacterDef | null): c is CharacterDef => !!c && CLASSIC_EXTRAS.includes(c);
  if (!extra(s.character) && !extra(s.character2)) return;
  // v0.4.74 item 61: a dev free play start offers every hero (Toggle heroes is for Classic and
  // campaign play), so its hero stays whatever Toggle heroes says.
  const roster = game.devFreePlaying ? game.devRosterFor(rules) : game.roster;
  if (extra(s.character) && !roster.includes(s.character)) game.setHero(0, game.firstHero);
  if (extra(s.character2) && !roster.includes(s.character2)) game.setHero(1, game.firstHero);
}

/**
 * Item 25: whether hero `c` plays, under `rules`, a design other than his own (Toggle heroes'
 * Plays as, dev mode only: ctx.heroSwaps).
 */
export function isSwapped(game: Game, c: CharacterDef, rules: Rules): boolean {
  return playedHero(game.ctx, c, rules) !== heroFor(c, rules);
}

/**
 * Item 25: a put-away hero's power and kit as they may come back: a kit earned in a design that
 * no longer plays is dropped (null: the hero starts afresh), and one that still plays is kept
 * with its flag.
 */
export function keptPower<T extends { swapped?: true }>(
  game: Game,
  c: CharacterDef,
  rules: Rules,
  k: T,
): T | null {
  return k.swapped && !isSwapped(game, c, rules) ? null : k;
}
