/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Round 2: profiles at a given completion percentage, with sparse, out-of-order progress (not
 * sequential): 'seq' = the first p% of the campaign's levels minus random holes plus random
 * later extras; 'scatter' = every level, secret, beat, hero independently with probability p.
 * Every campaign file is passed through the game's own migrateSave, so the inputs are files the
 * game would store. These are synthetic: nothing here is a real gameplay invariant.
 */
import { Rng } from '@engine/rng';
import { defaultSettings, CLASSIC_CHEAT_IDS, CLASSIC_CHEAT_STATS } from '@engine/save/settings';
import { CHARACTERS } from '@game/characters/registry';
import { heroStart } from '@game/items/heroes';
import { MAP_PAGES } from '@content/worldmap';
import { CODE_DICTS } from '@game/save/save-code';
import { migrateSave, newSave, type SaveFile } from '@game/save/save-files';
import { coinCap } from '@game/items/wallet';
import { STORY_REV } from '@game/story/beats';
import { blFile, fullHero, resume, type Scenario } from './scenarios';
import { CLASSIC_HEROES, progressDefault, SETS } from './schema';

const HEROES = CHARACTERS.map((c) => c.id);
const ORDER = MAP_PAGES.flatMap((p) => p.nodes.flatMap((n) => (n.level ? [{ page: p.id, node: n.id, level: n.level }] : [])));
const STORY = (CODE_DICTS.story as string[]).filter((b) => b !== STORY_REV);
const EXPLAINED = CODE_DICTS.explained as string[];
const SECRETS = CODE_DICTS.secrets as string[];
const ITEMS = ['mushroom', 'flower', 'star', '1up'];
const T0 = 1792627409905;

const sample = <T>(rng: Rng, xs: readonly T[], p: number): T[] => (p >= 1 ? [...xs] : xs.filter(() => rng.chance(p)));
const shuffle = <T>(rng: Rng, xs: T[]): T[] => {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [xs[i], xs[j]] = [xs[j] as T, xs[i] as T];
  }
  return xs;
};

/** A hero's power with a share p of their full kit's extra keys (sparse, not "basic or full"). */
function partialHero(rng: Rng, id: string, p: number): { powerState: string; hp: number; kit: Record<string, number> } {
  const c = CHARACTERS.find((h) => h.id === id);
  if (!c) throw new Error(id);
  const start = heroStart(c);
  const f = fullHero(id);
  const kit: Record<string, number> = { ...start.kit };
  for (const [k, v] of Object.entries(f.kit)) if (!(k in kit) || kit[k] !== v) if (p >= 1 || rng.chance(p)) kit[k] = v;
  const power = c.damage.kind === 'powerup' ? (['small', 'big', 'fire'][rng.int(3)] as string) : 'full';
  return { powerState: p >= 1 ? f.powerState : power, hp: p >= 1 ? f.hp : start.hp, kit };
}

export function campaignAt(rng: Rng, slot: 1 | 2 | 3, p: number, mode: 'seq' | 'scatter'): SaveFile {
  const n = ORDER.length;
  let taken: typeof ORDER;
  if (mode === 'seq') {
    const k = Math.round(p * n);
    const first = ORDER.slice(0, k);
    const holes = p < 1 ? Math.max(1, Math.round(0.03 * k)) : 0;
    const extras = p < 1 ? Math.max(1, Math.round(0.02 * n)) : 0;
    const kept = shuffle(rng, first.slice()).slice(holes);
    const later = shuffle(rng, ORDER.slice(k)).slice(0, extras);
    taken = [...kept, ...later];
  } else taken = sample(rng, ORDER, p);
  const cleared = [...new Set(taken.map((t) => t.level))];
  const pages = [...new Set(['smb-1', ...taken.map((t) => t.page)])];
  const freed = ['mario', ...sample(rng, HEROES.slice(1), p)];
  const character = freed[rng.int(freed.length)] as string;
  const character2 = rng.chance(0.15) && freed.length > 1 ? (freed.find((h) => h !== character) as string) : null;
  const wallet = p >= 1 || rng.chance(p);
  const played = [character, ...(character2 ? [character2] : [])];
  const me = partialHero(rng, character, p);
  const at = taken.length ? taken[rng.int(taken.length)]! : { page: 'smb-1', node: 'start' };
  const raw: any = {
    ...newSave(slot, character, character2),
    lives: 1 + rng.int(30),
    score: rng.int(Math.max(1, Math.round(p * 3_000_000))),
    coins: rng.int(coinCap(wallet) + 1),
    wallet,
    powerState: me.powerState,
    hp: me.hp,
    kit: me.kit,
    cleared,
    pages,
    secrets: sample(rng, SECRETS, p),
    position: { page: at.page, node: at.node },
    lastNode: Object.fromEntries(sample(rng, taken, 0.15).map((t) => [t.page, t.node])),
    gameCleared: p >= 0.99 ? rng.chance(0.9) : rng.chance(p * 0.3),
    freed,
    tutorials: sample(rng, freed, 0.85),
    met: [...freed, ...sample(rng, HEROES, 0.3), ...(rng.chance(p) ? ['larry'] : [])],
    inventoryUnlocked: p >= 1 || rng.chance(p),
    heroKits: Object.fromEntries(freed.filter((h) => !played.includes(h)).map((h) => [h, partialHero(rng, h, p)])),
    heroInventory: Object.fromEntries(sample(rng, freed, 0.3).map((h) => [h, Array.from({ length: 1 + rng.int(3) }, () => ITEMS[rng.int(4)])])),
    bonusNext: rng.int(4),
    spadeBoard: rng.int(3),
    spadeTaken: sample(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8], 0.3 * p),
    story: [STORY_REV, ...shuffle(rng, sample(rng, STORY, p))],
    explained: sample(rng, EXPLAINED, 0.8 * p),
  };
  const s = migrateSave(raw, slot);
  if (!s) throw new Error('pct save did not validate');
  return { ...s, created: T0 - 86400e3, updated: T0 };
}

export function pctProfile(p: number, mode: 'seq' | 'scatter', seed: number): Scenario {
  const rng = new Rng(seed);
  const s: any = defaultSettings();
  if (rng.chance(0.5)) s.input.touch = 'on';
  if (rng.chance(0.3)) s.audio.master = 0.7;
  for (const id of CLASSIC_CHEAT_IDS) if (p >= 1 || rng.chance(p)) s.classicCheats.unlocked[id] = true;
  for (const id of CLASSIC_CHEAT_IDS) if (s.classicCheats.unlocked[id] && rng.chance(0.15)) s.classicCheats.on[id] = true;
  for (const k of CLASSIC_CHEAT_STATS) s.classicCheats.stats[k] = rng.int(Math.max(1, Math.round(p * 20_000)));
  s.classicCheats.beaten = { smb: p >= 1 || rng.chance(p), special: p >= 1 || rng.chance(p), lost: p >= 1 || rng.chance(p) };
  s.classicCheats.continuesUsed = rng.int(1 + Math.round(20 * p));
  s.classicCheats.levelSelect = p >= 1 || (p >= 0.9 && rng.chance(0.5));
  if (rng.chance(0.5)) s.classicTutorialsSeen = sample(rng, ['select', 'first-start', 'mario', 'link', 'samus', 'upgrade'], p);
  const st = () => (p >= 1 ? 'hard' : (['none', 'easy', 'normal', 'hard'][Math.min(3, Math.floor(rng.float() * 4 * p + rng.float()))] as string));
  const beaten = rng.int(1 + Math.round(12 * p));
  const progress = { ...progressDefault(), lost: { world9: rng.chance(p), letters: beaten >= 8, beaten }, classicBeat: { smb: st(), special: st(), lost: st() } };
  const nFiles = 1 + rng.int(3);
  const saves = [1, 2, 3].map((slot) => (slot <= nFiles ? campaignAt(rng, slot as 1, p >= 1 ? 1 : Math.min(1, Math.max(0.01, p + (rng.float() - 0.5) * 0.2)), mode) : null));
  const base: Record<string, any> = { 'smbc.settings': s, 'smbc.progress': progress };
  saves.forEach((f, i) => f && (base[`smbc.save.${i + 1}`] = f));
  const current = structuredClone(base);
  const bl = structuredClone(base);
  const LV: Record<string, string[]> = { smb: ['3-2', '6-1', '8-3'], special: ['sp-2-1', 'sp-5-3', 'sp-8-2'], lost: ['ll-1-2', 'll-4-1', 'll-8-4'] };
  for (const set of SETS) {
    const files = rng.int(4);
    for (let n = 0; n < files; n++) {
      const o: any = {
        levelId: (LV[set] as string[])[rng.int(3)],
        hero: CLASSIC_HEROES[rng.int(16)],
        score: rng.int(Math.max(1, Math.round(p * 1_000_000))),
        coins: rng.int(100),
        lives: 1 + rng.int(9),
        kits: rng.int(1 + Math.round(p * 14)),
        survival: rng.chance(0.2) ? 1 + rng.int(5) : 0,
        checkpoint: rng.chance(0.5),
        difficulty: (['easy', 'normal', 'hard'] as const)[rng.int(3)],
        rules: (['default', 'default', 'some', 'all'] as const)[rng.int(4)],
        continues: rng.int(5),
        rng: new Rng(rng.next()),
      };
      if (n === 0) current[`smbc-classic-resume-${set}`] = resume(o);
      bl[`smbc-classic-file-${set}-${n + 1}`] = blFile({ ...o, rng: new Rng(o.rng.next()) });
    }
  }
  return { name: `${Math.round(p * 100)}% ${mode} #${seed}`, current, bl };
}
