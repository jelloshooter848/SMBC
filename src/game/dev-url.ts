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
