import { defaultPower, type Rules } from '../context';
import { startHp, type CharacterDef } from '../characters/character';
import { CLASSIC_EXTRAS, playedHero } from '../characters/registry';
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
  const roster = game.roster;
  if (extra(s.character) && !roster.includes(s.character)) game.setHero(0, game.firstHero);
  if (extra(s.character2) && !roster.includes(s.character2)) game.setHero(1, game.firstHero);
}
