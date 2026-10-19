import { defaultPower, type Rules } from '../context';
import { startHp, type CharacterDef } from '../characters/character';
import { CLASSIC_EXTRAS, heroFor } from '../characters/registry';
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
      const d = heroFor(c, rules);
      return { powerState: defaultPower(d), hp: startHp(d) };
    };
    const p1 = reset(s.character);
    s.powerState = p1.powerState;
    s.hp = p1.hp;
    s.kit = {};
    if (s.character2) {
      const p2 = reset(s.character2);
      s.powerState2 = p2.powerState;
      s.hp2 = p2.hp;
    }
    s.kit2 = {};
    if (rules === 'classic') s.rules = 'classic';
    else delete s.rules;
    game.deps.announcer?.say('Rules changed. Power reset.');
  }
  const extra = (c: CharacterDef | null): c is CharacterDef => !!c && CLASSIC_EXTRAS.includes(c);
  if (!extra(s.character) && !extra(s.character2)) return;
  const roster = game.roster;
  if (extra(s.character) && !roster.includes(s.character)) game.setHero(0, game.firstHero);
  if (extra(s.character2) && !roster.includes(s.character2)) game.setHero(1, game.firstHero);
}
