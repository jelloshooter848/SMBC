import type { Rules } from './context';

/**
 * `?rules=classic|current` (TG-5..7): the rules for a `?level=` start. Honoured only while dev mode
 * is on (read after `?dev=` is applied); with dev mode off a value is ignored and logged, and any
 * other value is ignored. Null: no rules asked for (the start plays Current). It is never stored:
 * rules are chosen per start, and a campaign file always plays Current (Game.liveRules).
 */
export function urlRules(params: URLSearchParams, dev: boolean): Rules | null {
  const v = params.get('rules');
  if (v !== 'classic' && v !== 'current') return null;
  if (!dev) {
    console.info(`[dev] rules=${v} ignored: dev mode is off`);
    return null;
  }
  return v;
}

/**
 * `?mode=classic` (dev mode only): the `?level=` start is a Classic mode run (its lives, death and
 * continue flow) instead of free play. Ignored with dev mode off.
 */
export function urlClassicRun(params: URLSearchParams, dev: boolean): boolean {
  return dev && params.get('mode') === 'classic';
}

/**
 * `?yoshi=1|ride` (dev mode only; 2026-10-19-yoshi-build-classic-character.md YM-1): turns the
 * Classic Yoshi mount on for this start ('on'), or on with every life starting on his back
 * ('ride', a testing aid). Null: the Dev menu's toggle decides. Ignored with dev mode off.
 */
export function urlYoshi(params: URLSearchParams, dev: boolean): 'on' | 'ride' | null {
  const v = params.get('yoshi');
  if (!dev || v === null) return null;
  if (v === 'ride') return 'ride';
  return v === '1' || v === 'on' ? 'on' : null;
}

/**
 * The levels a Classic run starts at from a link: SMB 1-1 to 8-4, Super Mario Bros. Special's
 * sp-1-1 to sp-8-4 (G-020) and the Lost Levels' 1-1 to D-4.
 */
const CLASSIC_LINK_LEVEL = /^(?:[1-8]|sp-[1-8]|ll-(?:[1-9]|1[0-3]))-[1-4]$/;

/**
 * How a `?level=` link starts (0.5.0): with dev mode on, as before (free play, or a Classic run
 * with `mode=classic`). With it off, the campaign's content stays closed until Chapter 1 opens: a
 * custom level plays as before, an SMB, Special or Lost Levels level starts a Classic run there (Classic
 * mode's rules and heroes), and anything else (1-0, the heroes' rooms and stages) opens the title
 * instead (null). Null too when there is no `level`.
 */
export function urlLevelStart(params: URLSearchParams, dev: boolean): 'free' | 'classic' | null {
  const level = params.get('level');
  if (!level) return null;
  if (dev) return urlClassicRun(params, dev) ? 'classic' : 'free';
  if (level.startsWith('custom-')) return 'free';
  return CLASSIC_LINK_LEVEL.test(level) ? 'classic' : null;
}
