/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Round 3: an independent check corpus ("rk"). Round 1-2's corpora (named, random-200 and the
 * progress profiles alike) draw every Classic kit from one 6-entry palette (scenarios.ts KITS) and
 * every B-L rules object from 3 presets, so a model or dictionary trained on any of them learns
 * the palette. Here, from a separate seed stream:
 *   - Classic heroes are a random subset of the roster (not its first n);
 *   - a campaign hero's kit is a random share of its real full kit (fullHero, game item rules),
 *     with random numeric values; any other hero gets 1-4 keys from a per-hero key set (a hash of
 *     its id into KIT_KEYS) with random values;
 *   - B-L rules rows are independently 'original' (p 0.6) or a random value.
 * Still synthetic: nothing here is a measured player distribution.
 */
import { Rng } from '@engine/rng';
import { CLASSIC_WEAPON_VALUES } from '@engine/save/original-options';
import { CHARACTERS } from '@game/characters/registry';
import { fullHero, type Scenario } from './scenarios';
import { pctProfile } from './scenarios2';
import { CLASSIC_HEROES, KIT_KEYS, SETS } from './schema';

const CAMPAIGN = new Set(CHARACTERS.map((c) => c.id));
const KK = (KIT_KEYS as string[]).filter((k) => !k.startsWith('has-') && k !== 'found');
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const ROWS: Record<string, readonly unknown[]> = {
  lives: [1, 3, 5, 7, 10],
  attack: ['very-weak', 'weak', 'normal', 'strong', 'very-strong'],
  whenHit: ['lose-everything', 'previous-state', 'instant-death'],
  drops: ['very-low', 'low', 'normal', 'high', 'very-high'],
  piranhas: ['some', 'all', 'green-some', 'green-all', 'red-some', 'red-all'],
  goombas: ['off', 'buzzy', 'spiny', 'spike-top'],
  enemySpeed: ['normal', 'fast'],
};

function kitOf(g: Rng, hero: string, p: number): Record<string, number> {
  if (CAMPAIGN.has(hero)) {
    const f = fullHero(hero).kit;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(f)) if (g.chance(Math.max(0.1, p))) out[k] = v > 1 && g.chance(0.5) ? g.int(v + 1) : v;
    return out;
  }
  const own = Array.from({ length: 4 }, (_, i) => KK[(hash(hero) + i * 37) % KK.length] as string);
  return Object.fromEntries(own.slice(0, 1 + g.int(4)).map((k) => [k, g.chance(0.4) ? 1 : g.int(1 + Math.round(60 * p))]));
}
function kitsOf(g: Rng, n: number, except: string, p: number): Record<string, any> {
  const pool = CLASSIC_HEROES.filter((h) => h !== except);
  const out: Record<string, any> = {};
  for (let i = 0; i < n && pool.length; i++) {
    const h = pool.splice(g.int(Math.min(pool.length, 30)), 1)[0] as string;
    out[h] = { powerState: ['small', 'big', 'fire', 'full'][g.int(4)], hp: g.chance(0.5) ? g.int(6) : 0, kit: kitOf(g, h, p) };
  }
  return out;
}
function rulesOf(g: Rng): any {
  const weapons: Record<string, string> = {};
  for (const [k, vals] of Object.entries(CLASSIC_WEAPON_VALUES)) if (g.chance(0.15)) weapons[k] = (vals as string[])[g.int((vals as string[]).length)] as string;
  return {
    difficulty: (['easy', 'normal', 'hard'] as const)[g.int(3)],
    gameMode: (['all', 'survival', 'single', 'single-random'] as const)[g.chance(0.6) ? 0 : g.int(4)],
    more: Object.fromEntries(Object.entries(ROWS).map(([k, vals]) => [k, g.chance(0.6) ? 'original' : vals[g.int(vals.length)]])),
    weapons,
    disabled: CLASSIC_HEROES.filter(() => g.chance(0.04)),
  };
}

/** pctProfile's profile with its Classic heroes, kits and B-L rules regenerated independently. */
export function rkProfile(p: number, mode: 'seq' | 'scatter', seed: number): Scenario {
  const sc = pctProfile(p, mode, seed);
  const g = new Rng(seed ^ 0x5eed);
  const n = () => g.int(1 + Math.round(p * 14));
  for (const set of SETS) {
    const c = sc.current[`smbc-classic-resume-${set}`];
    if (c) {
      const kits = kitsOf(g, n(), c.hero, p);
      if (Object.keys(kits).length) c.heroKits = kits;
      else delete c.heroKits;
      c.kit = kitOf(g, c.hero, p);
    }
    for (let i = 1; i <= 3; i++) {
      const f = sc.bl[`smbc-classic-file-${set}-${i}`];
      if (!f) continue;
      f.heroKits = kitsOf(g, n(), f.hero, p);
      f.kit = kitOf(g, f.hero, p);
      f.rules = rulesOf(g);
    }
  }
  return { ...sc, name: `rk ${sc.name}` };
}
