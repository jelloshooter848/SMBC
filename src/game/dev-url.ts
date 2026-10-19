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
