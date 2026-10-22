/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Round 3 benchmark (throwaway): audit + instrumented cost breakdown, Experiments A-D and the
 * compressor controls of briefs/round3-brief.md, against R1 and guarded config M.
 * BENCH_FILE=<this file> npx vitest run tests/zz-savecode-bench.test.ts   (writes results3.json)
 * Optional: DEPS=<dir with node_modules/@gfx/zopfli> for the Zopfli control; python3 + zstandard
 * for the zstd dictionary training.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { brotliCompressSync, constants as Z, deflateRawSync, gzipSync, inflateRawSync, zstdCompressSync, zstdDecompressSync } from 'node:zlib';
import { defaultSettings } from '@engine/save/settings';
import { CODE_DICTS } from '@game/save/save-code';
import { BitReader, BitWriter, widthFor } from '@game/save/code-bits';
import { Rng } from '@engine/rng';
import { binom, deepEq, enc as enc1, OPT, rankWidth, type S } from './codec';
import { bitsOf, pickFields } from './codec2';
import { applyPolicy, CLASSIC_HEROES, CLASSIC_LEVELS, CLASSIC_TUTORIAL_IDS, KIT_KEYS, type Policy } from './schema';
import { TUTORIAL_IDS } from '@game/tutorial/original-tutorials';
import { canonLoaded, hybridBits, hybridFromBits, loadAll, normaliseLoaded, packB64, SAVE_KEYS, unpackB64 } from './bench';
import {
  b64Len,
  campaignCands,
  CLASSIC_KEYS,
  classicCands,
  CONFIGS,
  decodeProfile,
  encodeProfile,
  finalCanon,
  names,
  progressCands,
  sch,
  SETTINGS_GROUPS,
  settingsCands,
  type Cfg,
} from './bench2';
import { randomScenarios, sampleScenario, scenarios, type Scenario } from './scenarios';
import { pctProfile } from './scenarios2';
import { rkProfile } from './scenarios3';
import { callBits, CallReader, callsOf, installTrace, pushTraced, R, ReplaySource, TR, type Call, type CallSource } from './trace';
import { aligned, AlignedSource, channels, ChannelSource, CHANNEL_OF, tight } from './layouts';
import { EncIo, Model, normPath, rcEncode, RcSource, trainTable, type ModelOpts } from './rc';

installTrace();

const DIR = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
const SAMPLE = `${DIR}/../sample/sample-save.json`;
const SCRATCH = process.env.SCRATCH ?? '/tmp/savecode-r3';
mkdirSync(SCRATCH, { recursive: true });

let checks = 0;
const failures: string[] = [];
function check(ok: boolean, what: string): void {
  checks++;
  if (!ok) failures.push(what);
}

const M = CONFIGS.find((c) => c.name.startsWith('M.'))!;
const H = CONFIGS.find((c) => c.name.startsWith('H.'))!;
const POL: Policy = 'semantic';

// ------------------------------------------------------------------ envelope lengths (P + version + flags + CRC-32 + payload)

/** A method's payload as sent: the flags byte names the method, so every method costs the same 9 chars of framing. */
const lenOf = (payload: Uint8Array) => packB64(payload, false).length;
const z9 = (b: Uint8Array) => new Uint8Array(deflateRawSync(b, { level: 9 }));
/** Best of raw and deflate for a byte payload (one flag bit picks). */
const bestLen = (b: Uint8Array) => Math.min(lenOf(b), packB64(z9(b), true).length);

// ------------------------------------------------------------------ stats

const q = (s: number[], f: number) => s[Math.min(s.length - 1, Math.floor(f * (s.length - 1)))] as number;
function stats(xs: number[]): any {
  const s = [...xs].sort((a, b) => a - b);
  return { n: s.length, min: s[0], median: q(s, 0.5), p95: q(s, 0.95), max: s[s.length - 1] };
}
/** Row vs a baseline: medians, the median of per-profile savings (a different statistic from the ratio of medians), absolute chars, shorter/equal/longer. */
function vs(row: number[], base: number[]): any {
  const sav = row.map((x, i) => (100 * ((base[i] as number) - x)) / (base[i] as number));
  const abs = row.map((x, i) => (base[i] as number) - x);
  const sm = stats(row).median;
  const bm = stats(base).median;
  return {
    median_len: sm,
    base_median_len: bm,
    ratio_of_medians_saving_pct: +((100 * (bm - sm)) / bm).toFixed(2),
    median_per_profile_saving_pct: +stats(sav).median.toFixed(2),
    p95_per_profile_saving_pct: +q([...sav].sort((a, b) => a - b), 0.95).toFixed(2),
    median_chars_saved: stats(abs).median,
    max_chars_saved: Math.max(...abs),
    shorter: row.filter((x, i) => x < (base[i] as number)).length,
    equal: row.filter((x, i) => x === (base[i] as number)).length,
    longer: row.filter((x, i) => x > (base[i] as number)).length,
  };
}

// ------------------------------------------------------------------ corpora

function blRegime(regime: string, seed: number): any {
  // as bench2's cross-slot regimes, plus 'mosaic': each later file takes each hero's kit from a random earlier file of the set (adversarial for whole-record references)
  const KK = (KIT_KEYS as string[]).filter((k) => !k.startsWith('has-'));
  const ROW: Record<string, readonly unknown[]> = {
    lives: [1, 3, 5, 7, 10],
    attack: ['very-weak', 'weak', 'normal', 'strong', 'very-strong'],
    whenHit: ['lose-everything', 'previous-state', 'instant-death'],
    drops: ['very-low', 'low', 'normal', 'high', 'very-high'],
    piranhas: ['some', 'all', 'green-some', 'green-all', 'red-some', 'red-all'],
    goombas: ['off', 'buzzy', 'spiny', 'spike-top'],
    enemySpeed: ['normal', 'fast'],
  };
  const g = new Rng(seed);
  const randRules = () => ({
    difficulty: (['easy', 'normal', 'hard'] as const)[g.int(3)],
    gameMode: (['all', 'survival', 'single', 'single-random'] as const)[g.int(4)],
    more: Object.fromEntries(Object.entries(ROW).map(([k, vals]) => [k, g.chance(0.5) ? 'original' : vals[g.int(vals.length)]])),
    weapons: g.chance(0.5) ? {} : { samus: 'ice', link: g.chance(0.5) ? 'bow' : 'bomb' },
    disabled: CLASSIC_HEROES.filter(() => g.chance(0.05)),
  });
  const randKits = (heroes: string[]) =>
    Object.fromEntries(heroes.map((h) => [h, { powerState: ['small', 'big', 'fire'][g.int(3)], hp: g.int(4), kit: Object.fromEntries(Array.from({ length: 1 + g.int(3) }, () => [KK[g.int(KK.length)], g.int(61)])) }]));
  const LV = CLASSIC_LEVELS.filter((l) => /^(\d|sp-|ll-)/.test(l) && !l.includes('bonus'));
  const data: any = {};
  for (const set of ['smb', 'special', 'lost']) {
    const shared = randRules();
    const sharedHeroes = CLASSIC_HEROES.filter(() => g.chance(0.4));
    const sharedKits = randKits(sharedHeroes);
    const n = 1 + g.int(3);
    const made: any[] = [];
    for (let i = 1; i <= n; i++) {
      const heroes = regime === 'independent' || regime === 'shared-rules' ? CLASSIC_HEROES.filter(() => g.chance(0.4)) : sharedHeroes;
      let kits: any = regime === 'shared-all' ? structuredClone(sharedKits) : randKits(heroes);
      if (regime === 'shared-all') for (const h of Object.keys(kits)) if (g.chance(0.3)) kits[h].kit = Object.fromEntries(Object.entries(kits[h].kit).map(([k]) => [k, g.int(61)]));
      if (regime === 'mosaic' && made.length) kits = Object.fromEntries(Object.keys(kits).map((h) => [h, g.chance(0.25) ? kits[h] : structuredClone((made[g.int(made.length)] as any)[h] ?? kits[h])]));
      made.push(kits);
      data[`smbc-classic-file-${set}-${i}`] = {
        v: 1,
        levelId: LV[g.int(LV.length)],
        hero: CLASSIC_HEROES[g.int(CLASSIC_HEROES.length)],
        score: g.int(2_000_000),
        coins: g.int(100),
        lives: 1 + g.int(9),
        powerState: ['small', 'big', 'fire'][g.int(3)],
        hp: g.int(4),
        kit: {},
        heroKits: kits,
        checkpoint: g.chance(0.5) ? { x: g.int(300), y: 12 } : null,
        continues: g.int(5),
        rules: regime === 'independent' ? randRules() : structuredClone(shared),
      };
    }
  }
  return data;
}

// ------------------------------------------------------------------ Experiment A1: sectionized config M (same grammar, any choice per section)

interface Part {
  fixed?: number[];
  cands?: number[][]; // selector + payload, traced
  greedy?: number;
  key?: string;
}
/** encodeProfileWith (bench2) with the choice per section exposed; force(i) overrides section i's choice. */
function sectionize(data: any, policy: Policy, cfg: Cfg, force?: (i: number) => number | undefined): Part[] {
  const parts: Part[] = [];
  const ctx: any = {};
  let sec = 0;
  const fixed = (f: (w: BitWriter) => void) => parts.push({ fixed: bitsOf(f) });
  const section = (cands: any[], key: string): any => {
    const width = widthFor(cands.length);
    const all = cands.map((c, i) =>
      bitsOf((w) => {
        R('sel');
        w.uint(width, i);
        pushTraced(w, bitsOf(c.enc));
      }),
    );
    let g = 0;
    all.forEach((b, i) => {
      if (b.length < (all[g] as number[]).length) g = i;
    });
    const f = force?.(sec);
    const pick = f ?? g;
    sec++;
    parts.push({ cands: all, greedy: g, key });
    const r = new BitReader(all[pick] as number[]);
    r.uint(width);
    return cands[pick].dec(r);
  };
  const s = data['smbc.settings'];
  TR.path.push('smbc.settings');
  fixed((w) => {
    R('presence');
    w.bit(!!s);
  });
  if (s) {
    const groups = SETTINGS_GROUPS(sch(policy).settings);
    const dec: any = {};
    for (const g of ['device', 'options', 'achieve'] as const) {
      if (!groups[g].length) continue;
      Object.assign(dec, section(settingsCands(cfg, policy, g, pickFields(s, groups[g])), `settings.${g}`));
    }
    ctx.settings = dec;
  }
  TR.path.pop();
  const p = data['smbc.progress'];
  TR.path.push('smbc.progress');
  fixed((w) => {
    R('presence');
    w.bit(!!p);
  });
  if (p) section(progressCands(cfg, p), 'progress');
  TR.path.pop();
  const prevFiles: any[] = [];
  SAVE_KEYS.forEach((k, i) => {
    const f = data[k];
    TR.path.push(k);
    fixed((w) => {
      R('presence');
      w.bit(!!f);
    });
    if (f) prevFiles.push(section(campaignCands(cfg, policy, i + 1, pickFields(f, names(sch(policy).saveBody)), prevFiles.slice()), 'campaign'));
    TR.path.pop();
  });
  const prevC: any[] = [];
  const prevB: any[] = [];
  for (const k of CLASSIC_KEYS) {
    const c = data[k];
    TR.path.push(k);
    fixed((w) => {
      R('presence');
      w.bit(!!c);
    });
    if (c) {
      const isBL = k.startsWith('smbc-classic-file-');
      const prev = isBL ? prevB : prevC;
      prev.push(section(classicCands(cfg, policy, k, c, prev.slice(), ctx), isBL ? 'bl' : 'classic'));
    }
    TR.path.pop();
  }
  return parts;
}
function assemble(parts: Part[], choice?: number[]): number[] {
  const w = new BitWriter();
  let j = 0;
  for (const p of parts) {
    if (p.fixed) pushTraced(w, p.fixed);
    else pushTraced(w, p.cands![choice ? (choice[j] as number) : (p.greedy as number)] as number[]);
    if (!p.fixed) j++;
  }
  return w.bits;
}
const bytesOf = (bits: number[]) => packBitsTraced(bits);
function packBitsTraced(bits: number[]): Uint8Array {
  const out = new Uint8Array(Math.ceil(bits.length / 8));
  for (let i = 0; i < bits.length; i++) if (bits[i]) out[i >> 3]! |= 0x80 >> (i & 7);
  return out;
}

/** Coordinate descent over the K shortest candidates per section, scored on the complete wrapped code. */
function searchChoice(parts: Part[], K: number, passes: number): { choice: number[]; len: number; evals: number } {
  const secs = parts.filter((p) => !p.fixed);
  const choice = secs.map((p) => p.greedy as number);
  const alts = secs.map((p) =>
    p
      .cands!.map((b, i) => [b.length, i] as const)
      .sort((a, b) => a[0] - b[0])
      .slice(0, K)
      .map(([, i]) => i),
  );
  let evals = 1;
  let best = bestLen(bytesOf(assemble(parts, choice)));
  for (let pass = 0; pass < passes; pass++) {
    let improved = false;
    secs.forEach((_, s) => {
      for (const a of alts[s] as number[]) {
        if (a === choice[s]) continue;
        const old = choice[s] as number;
        choice[s] = a;
        evals++;
        const l = bestLen(bytesOf(assemble(parts, choice)));
        if (l < best) {
          best = l;
          improved = true;
        } else choice[s] = old;
      }
    });
    if (!improved) break;
  }
  return { choice, len: best, evals };
}

// ------------------------------------------------------------------ a transform's decode, through the real decoders

function decodeVia(kind: 'r1' | 'M' | 'H', src: CallSource, cfg: Cfg = M): { back: any; calls: number } {
  const r = new CallReader(src);
  const back = kind === 'r1' ? hybridFromBits([], POL, 8, r) : decodeProfile([], POL, kind === 'H' ? H : cfg, 8, r);
  return { back, calls: r.calls };
}
/** R1's decoded profile compared with the full semantic state (the same canonical form config M is checked against). */
function sameState(back: any, data: any): boolean {
  return deepEq(finalCanon(back, POL), finalCanon(data, POL));
}

// ------------------------------------------------------------------ cost breakdown categories

function category(c: Call): string {
  const parts = c.g.split('.');
  const inKit = parts.some((x) => x === 'heroKits' || x === 'kit' || x === 'kit2' || x === 'heroInventory' || x === 'heroItemsNext');
  const inRules = parts.includes('rules') || parts.some((x) => ['classic', 'classicRules', 'classicMapDifficulty', 'classicSkins', 'classicHeroesOff', 'classicTutorials'].includes(x));
  switch (c.r) {
    case 'presence':
    case 'same':
      return 'presence/same flags';
    case 'sel':
    case 'mode':
    case 'setmode':
      return 'reference/mode selectors';
    case 'codec':
      return 'campaign codec payload (opaque)';
    case 'cframe':
      return 'framing: inner campaign code (version, CRC-16, length)';
    case 'esc':
      return 'unknown-string escapes';
    case 'set':
      return inKit ? 'kit values' : 'set membership';
  }
  if (inKit) return 'kit values';
  if (inRules) return 'rule values';
  if (c.r === 'num') return 'numeric values';
  if (c.r === 'count') return 'counts/lengths';
  return 'ids/enums/bools';
}
function breakdown(calls: readonly Call[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of calls) {
    const k = category(c);
    out[k] = (out[k] ?? 0) + callBits(c);
  }
  return out;
}

// ------------------------------------------------------------------ Experiment C budgets: the campaign codec's own sets, and mixed-radix

const egLen = (k: number, v: number) => {
  let n = 0;
  for (let x = v + 2 ** k; x >= 1; x = Math.floor(x / 2)) n++;
  return 2 * n - 1 - k;
};
/** save-code.ts writeIndexSet's cost (runs or bitmap, + mode bit), and the enumerative alternative (+ mode bit). */
function indexSetCost(n: number, idx: number[]): { now: number; rank: number; gap: number } {
  const runs: [number, number][] = [];
  for (const i of idx) {
    const last = runs[runs.length - 1];
    if (last && last[0] + last[1] === i) last[1]++;
    else runs.push([i, 1]);
  }
  let a = egLen(0, runs.length);
  let pos = 0;
  for (const [s, l] of runs) {
    a += egLen(0, s - pos) + egLen(0, l - 1);
    pos = s + l;
  }
  const now = 1 + Math.min(a, n);
  const rank = 1 + Math.min(egLen(0, idx.length) + rankWidth(n, idx.length), n);
  let gap = egLen(0, idx.length);
  let prev = -1;
  for (const i of idx) {
    gap += egLen(0, i - prev - 1);
    prev = i;
  }
  return { now, rank, gap: 1 + Math.min(gap, n) };
}
const SET_FIELDS: [string, string][] = [
  ['pages', 'pages'],
  ['cleared', 'levels'],
  ['secrets', 'secrets'],
  ['freed', 'heroes'],
  ['tutorials', 'heroes'],
  ['met', 'met'],
  ['story', 'story'],
  ['explained', 'explained'],
];

// ------------------------------------------------------------------ Experiment D: repeated typed subcomponents

const classicPower: S = (sch(POL).res.body.f.find(([n]: any) => n === 'heroKits')[1] as any).val;
function componentBits(v: any): number {
  return bitsOf((w) => enc1(w, classicPower, v, undefined, true)).length;
}
/** Per profile: hero-kit entries and B-L rules that repeat an earlier record's, beyond what one best earlier record (a whole-record or kits-stage reference) already gives. */
function sharingEstimate(data: any): { components: number; repeats: number; missed: number; missedBits: number; netBits: number; rulesMissed: number } {
  const recs = CLASSIC_KEYS.filter((k) => data[k]).map((k) => data[k]);
  const seen = new Map<string, number>(); // component → first record
  const defs: string[] = [];
  let components = 0;
  let repeats = 0;
  let missed = 0;
  let missedBits = 0;
  let rulesMissed = 0;
  const seenRules = new Set<string>();
  recs.forEach((rec, i) => {
    const kits = rec.heroKits ?? {};
    // the best single earlier record for this one (what prev-slot / kits-stage references capture)
    let bestJ = -1;
    let bestN = 0;
    for (let j = 0; j < i; j++) {
      const n = Object.entries(kits).filter(([h, x]) => deepEq(recs[j].heroKits?.[h], x)).length;
      if (n > bestN) {
        bestN = n;
        bestJ = j;
      }
    }
    for (const [h, x] of Object.entries(kits)) {
      components++;
      const key = `${h}:${JSON.stringify(x)}`;
      if (seen.has(key)) {
        repeats++;
        if (bestJ < 0 || !deepEq(recs[bestJ].heroKits?.[h], x)) {
          missed++;
          missedBits += componentBits(x) - (1 + Math.ceil(Math.log2(Math.max(2, defs.length))));
        }
      } else {
        seen.set(key, i);
        defs.push(key);
      }
    }
    if (rec.rules) {
      const rk = JSON.stringify(rec.rules);
      const prevSame = i > 0 && deepEq(recs[i - 1].rules, rec.rules);
      if (seenRules.has(rk) && !prevSame) rulesMissed++;
      seenRules.add(rk);
    }
  });
  // every component then needs a "new / reference" flag
  return { components, repeats, missed, missedBits, netBits: missedBits - components, rulesMissed };
}

// ------------------------------------------------------------------ the run

export async function run(): Promise<string> {
  const T: any = { checks: {}, audit: {}, breakdown: {}, ablation: {}, A1: {}, A2: {}, B: {}, C: {}, D: {}, controls: {}, robustness: {}, timing: {}, sizes: {} };
  const { scenario: sampleSc } = sampleScenario(SAMPLE);
  const named = [...scenarios(), sampleSc];
  const pct: Scenario[] = [];
  for (const p of [0.1, 0.25, 0.5, 0.75, 0.9, 0.99, 1]) for (const mode of ['seq', 'scatter'] as const) for (let i = 0; i < (p === 1 ? 5 : 15); i++) pct.push(pctProfile(p, mode, 9000 + Math.round(p * 1000) * 37 + i * 101 + (mode === 'seq' ? 0 : 7)));
  const rand = randomScenarios(200);
  const rk: Scenario[] = [];
  for (const p of [0.1, 0.25, 0.5, 0.75, 0.9, 0.99, 1]) for (const mode of ['seq', 'scatter'] as const) for (let i = 0; i < (p === 1 ? 5 : 15); i++) rk.push(rkProfile(p, mode, 50_000 + Math.round(p * 1000) * 41 + i * 103 + (mode === 'seq' ? 0 : 11)));
  const corpora: Record<string, Scenario[]> = { progress: pct, random200: rand, rk, named };

  // ---- per profile: R1, M (greedy == bench2's encoder), guarded M, H guarded, plus every experiment's length
  interface Row {
    name: string;
    corpus: string;
    shape: string;
    data: any;
    r1: number;
    r1Calls: Call[];
    m: number;
    mg: number;
    hg: number;
    mCalls: Call[];
    parts: Part[];
    [k: string]: any;
  }
  const rows: Row[] = [];
  const tm: Record<string, number[]> = {};
  const time = <X>(k: string, f: () => X): X => {
    const t0 = performance.now();
    const x = f();
    (tm[k] ??= []).push(performance.now() - t0);
    return x;
  };
  let r1StateDiff = 0;
  const r1DiffFields: Record<string, number> = {};
  for (const [cname, corpus] of Object.entries(corpora))
    for (const shape of ['current', 'bl'] as const)
      for (const sc of corpus) {
        const data = applyPolicy(sc[shape], POL);
        const r1bits = time('r1_enc', () => hybridBits(data, POL));
        const r1 = b64Len(r1bits, true).len;
        // audit: R1 against the full semantic state
        const r1back = hybridFromBits(r1bits, POL, 8);
        if (!sameState(r1back, data)) {
          r1StateDiff++;
          const a = finalCanon(r1back, POL);
          const b = finalCanon(data, POL);
          for (const k of Object.keys(b)) if (!deepEq(a[k], b[k])) for (const f of Object.keys(b[k] ?? {})) if (!deepEq(a[k]?.[f], b[k][f])) r1DiffFields[`${k.replace(/\d$/, 'n')}.${f}`] = (r1DiffFields[`${k.replace(/\d$/, 'n')}.${f}`] ?? 0) + 1;
        }
        const parts = time('m_enc', () => sectionize(data, POL, M));
        const mbits = assemble(parts);
        const ref = encodeProfile(data, POL, M, {});
        check(deepEq(mbits, ref), `${cname}/${shape}/${sc.name}: sectionized M == bench2 M`);
        const m = b64Len(mbits, true).len;
        const hbits = encodeProfile(data, POL, H, {});
        const h = b64Len(hbits, true).len;
        // replay: the decoders ask for exactly the traced calls (roles and paths included)
        for (const [kind, bits] of [['r1', r1bits], ['M', mbits]] as const) {
          const calls = callsOf(bits);
          check(calls.reduce((a, c) => a + callBits(c), 0) === bits.length, `${kind} calls cover the bits`);
          const src = new ReplaySource(calls);
          let ok = false;
          try {
            const { back } = decodeVia(kind, src);
            ok = src.i === calls.length && sameState(back, data);
          } catch (e) {
            if (failures.length < 20) failures.push(`${cname}/${shape}/${sc.name} ${kind} replay: ${(e as Error).message}`);
          }
          check(ok, `${cname}/${shape}/${sc.name}: ${kind} replay`);
        }
        rows.push({ name: sc.name, corpus: cname, shape, data, r1, r1Calls: callsOf(r1bits), m, mg: Math.min(m, r1), hg: Math.min(h, r1), mCalls: callsOf(mbits), parts });
      }
  T.audit.r1_vs_full_semantic_state = { profiles: rows.length, differing: r1StateDiff, fields: r1DiffFields };

  const sel = (corpus: string, shape: string) => rows.filter((r) => r.corpus === corpus && r.shape === shape);
  const GROUPS = [
    ['progress', 'current'],
    ['progress', 'bl'],
    ['rk', 'current'],
    ['rk', 'bl'],
    ['random200', 'current'],
    ['random200', 'bl'],
  ] as const;
  const col = (rs: Row[], k: string) => rs.map((r) => r[k] as number);
  T.baselines = Object.fromEntries(
    GROUPS.map(([c, s]) => {
      const rs = sel(c, s);
      return [`${c}/${s}`, { r1: stats(col(rs, 'r1')), m: stats(col(rs, 'm')), m_guarded: stats(col(rs, 'mg')), h_guarded: stats(col(rs, 'hg')), m_guarded_vs_r1: vs(col(rs, 'mg'), col(rs, 'r1')), m_unguarded_vs_r1: vs(col(rs, 'm'), col(rs, 'r1')), h_guarded_vs_r1: vs(col(rs, 'hg'), col(rs, 'r1')) }];
    }),
  );

  // ---- cost breakdown (raw bits of the uncompressed intermediate representation, before deflate and framing)
  for (const [c, s] of GROUPS) {
    const rs = sel(c, s);
    for (const kind of ['r1', 'm'] as const) {
      const tot: Record<string, number> = {};
      const per: Record<string, number[]> = {};
      for (const r of rs) {
        const b = breakdown(kind === 'r1' ? r.r1Calls : r.mCalls);
        for (const [k, v] of Object.entries(b)) {
          tot[k] = (tot[k] ?? 0) + v;
          (per[k] ??= []).push(v);
        }
      }
      const all = Object.values(tot).reduce((a, b) => a + b, 0);
      T.breakdown[`${c}/${s}/${kind}`] = {
        total_bits: all,
        outer_frame_chars_per_code: 9,
        by_category: Object.fromEntries(
          Object.entries(tot)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => [k, { bits: v, share_pct: +((100 * v) / all).toFixed(1), median_bits_per_profile: stats([...per[k]!, ...Array(rs.length - per[k]!.length).fill(0)]).median }]),
        ),
      };
    }
  }

  // ---- controlled ablations: remove one kind of content, re-measure the complete code (attribution, non-additive)
  {
    const strip: Record<string, (d: any) => any> = {
      'no Classic heroKits': (d) => {
        for (const k of CLASSIC_KEYS) if (d[k]) d[k].heroKits = k.startsWith('smbc-classic-file-') ? {} : undefined;
        return d;
      },
      'no campaign files': (d) => {
        for (const k of SAVE_KEYS) delete d[k];
        return d;
      },
      'no Classic records': (d) => {
        for (const k of CLASSIC_KEYS) delete d[k];
        return d;
      },
      'default settings': (d) => {
        if (d['smbc.settings']) d['smbc.settings'] = applyPolicy({ 'smbc.settings': defaultSettings() }, POL)['smbc.settings'];
        return d;
      },
    };
    for (const [c, s] of GROUPS.slice(0, 4)) {
      const rs = sel(c, s);
      const out: any = { full: { r1: stats(col(rs, 'r1')).median, m_guarded: stats(col(rs, 'mg')).median } };
      for (const [name, f] of Object.entries(strip)) {
        const r1: number[] = [];
        const mg: number[] = [];
        for (const r of rs) {
          const d = f(structuredClone(r.data));
          for (const k of CLASSIC_KEYS) if (d[k] && d[k].heroKits === undefined) delete d[k].heroKits;
          const a = b64Len(hybridBits(d, POL), true).len;
          r1.push(a);
          mg.push(Math.min(a, b64Len(encodeProfile(d, POL, M, {}), true).len));
        }
        out[name] = { r1: stats(r1).median, m_guarded: stats(mg).median };
      }
      T.ablation[`${c}/${s}`] = out;
    }
  }

  // ---- A1: whole-profile candidate selection (coordinate descent, K = 4 shortest per section, scored on the wrapped code)
  {
    let inconsistent = 0;
    for (const r of rows) {
      const t0 = performance.now();
      const sr = searchChoice(r.parts, 4, 3);
      // the true code for that choice: re-encode with the choice forced (later sections reference what earlier ones decode to)
      const parts2 = sectionize(r.data, POL, M, (i) => sr.choice[i]);
      const bits = assemble(parts2, sr.choice);
      const len = b64Len(bits, true).len;
      (tm.a1_search ??= []).push(performance.now() - t0);
      (tm.a1_evals ??= []).push(sr.evals);
      if (len !== sr.len) inconsistent++;
      let ok = false;
      try {
        ok = sameState(decodeProfile(bits, POL, M, 8), r.data);
      } catch {
        ok = false;
      }
      check(ok, `A1 ${r.corpus}/${r.shape}/${r.name}: decode`);
      r.a1 = Math.min(len, r.m);
      r.a1g = Math.min(r.a1, r.r1);
      r.a1Bits = bits;
    }
    T.A1.note = 'coordinate descent over the 4 shortest candidates per section, up to 3 passes, each scored on the complete wrapped code (best of raw / deflate); the greedy choice is the start, so never longer than greedy M';
    T.A1.forced_reencode_differs_from_assembled = inconsistent;
    for (const [c, s] of GROUPS) {
      const rs = sel(c, s);
      T.A1[`${c}/${s}`] = { a1_guarded: stats(col(rs, 'a1g')), vs_m_guarded: vs(col(rs, 'a1g'), col(rs, 'mg')), vs_r1: vs(col(rs, 'a1g'), col(rs, 'r1')) };
    }
  }

  // ---- A2: layout matrix (record-major tight / field-major tight / field-major byte-aligned), one final deflate, raw kept when smaller
  {
    const L = { tight, channels, aligned } as const;
    for (const r of rows) {
      for (const [kind, calls] of [['r1', r.r1Calls], ['m', r.mCalls]] as const) {
        for (const [ln, f] of Object.entries(L)) {
          const bytes = f(calls);
          const len = bestLen(bytes);
          r[`a2_${kind}_${ln}`] = len;
          if (ln !== 'tight' && (r.corpus === 'named' || rows.indexOf(r) % 5 === 0)) {
            const src = ln === 'channels' ? new ChannelSource(bytes) : new AlignedSource(bytes);
            let ok = false;
            try {
              ok = sameState(decodeVia(kind === 'r1' ? 'r1' : 'M', src).back, r.data);
            } catch (e) {
              if (failures.length < 20) failures.push(`A2 ${ln} ${kind} ${r.name}: ${(e as Error).message}`);
            }
            check(ok, `A2 ${ln} ${kind} decode`);
          }
        }
      }
      r.a2best = Math.min(r.mg, r.a2_m_channels, r.a2_m_aligned, r.a2_r1_channels, r.a2_r1_aligned);
    }
    for (const [c, s] of GROUPS) {
      const rs = sel(c, s);
      const o: any = {};
      for (const kind of ['r1', 'm'])
        for (const ln of ['tight', 'channels', 'aligned']) {
          const k = `a2_${kind}_${ln}`;
          o[`${kind}/${ln}`] = { stats: stats(col(rs, k)), vs_r1: vs(col(rs, k), col(rs, 'r1')), vs_m_guarded: vs(col(rs, k), col(rs, 'mg')) };
        }
      o['guarded best of {M guarded, layouts} (needs a method value per layout)'] = { stats: stats(col(rs, 'a2best')), vs_m_guarded: vs(col(rs, 'a2best'), col(rs, 'mg')) };
      T.A2[`${c}/${s}`] = o;
    }
  }

  // ---- B: semantic range coding of the traced decisions
  {
    const train = (rs: Row[], kind: 'r1Calls' | 'mCalls', ctx: ModelOpts['ctx']) => {
      const counts = new Map<string, [number, number]>();
      for (const r of rs) {
        const { model } = rcEncode(r[kind], { ctx, adapt: true });
        for (const [k, [a, b]] of model.counts) {
          const c = counts.get(k) ?? [0, 0];
          c[0] += a;
          c[1] += b;
          counts.set(k, c);
        }
      }
      return trainTable(counts);
    };
    // train on one generator, test on the other (both synthetic); named profiles are only tested
    const rkIdx = (r: Row) => sel('rk', r.shape).indexOf(r);
    const split: Record<string, { train: Row[]; test: (r: Row) => boolean }> = {
      'train random200 → test progress': { train: rows.filter((r) => r.corpus === 'random200'), test: (r) => r.corpus === 'progress' },
      'train progress → test random200': { train: rows.filter((r) => r.corpus === 'progress'), test: (r) => r.corpus === 'random200' },
      'train palette corpora (random200 + progress) → test rk': { train: rows.filter((r) => r.corpus === 'random200' || r.corpus === 'progress'), test: (r) => r.corpus === 'rk' },
      'train rk even → test rk odd (same generator: optimistic)': { train: rows.filter((r) => r.corpus === 'rk' && rkIdx(r) % 2 === 0), test: (r) => r.corpus === 'rk' && rkIdx(r) % 2 === 1 },
    };
    const variants: { name: string; ctx: ModelOpts['ctx']; adapt: boolean; frozen: boolean }[] = [
      { name: 'frozen, kind contexts', ctx: 'kind', adapt: false, frozen: true },
      { name: 'frozen, role contexts', ctx: 'role', adapt: false, frozen: true },
      { name: 'frozen, role+path contexts', ctx: 'path', adapt: false, frozen: true },
      { name: 'adaptive from 1/2, kind', ctx: 'kind', adapt: true, frozen: false },
      { name: 'adaptive from 1/2, role+path', ctx: 'path', adapt: true, frozen: false },
      { name: 'adaptive from 1/2, role+path+codec history', ctx: 'path+', adapt: true, frozen: false },
      { name: 'frozen init + adaptive, role+path', ctx: 'path', adapt: true, frozen: true },
      { name: 'frozen init + adaptive, role+path+codec history', ctx: 'path+', adapt: true, frozen: true },
    ];
    T.B.variants = variants.map((v) => v.name);
    for (const [sname, sp] of Object.entries(split)) {
      const tables: Record<string, Map<string, number>> = {};
      for (const kind of ['r1Calls', 'mCalls'] as const) for (const ctx of ['kind', 'role', 'path', 'path+'] as const) tables[`${kind}/${ctx}`] = train(sp.train, kind, ctx);
      T.sizes[`B tables (${sname})`] = Object.fromEntries(
        Object.entries(tables).map(([k, t]) => [k, { contexts: t.size, bytes_1_per_context: t.size, gzip_json: gzipSync(JSON.stringify([...t]), { level: 9 }).length }]),
      );
      for (const shape of ['current', 'bl'] as const) {
        const rs = rows.filter((r) => sp.test(r) && r.shape === shape);
        const res: any = {};
        for (const v of variants)
          for (const kind of ['r1Calls', 'mCalls'] as const) {
            const key = `${v.name} / ${kind === 'r1Calls' ? 'R1 stream' : 'M stream'}`;
            const lens: number[] = [];
            let vi = 0;
            for (const r of rs) {
              const o: ModelOpts = { ctx: v.ctx, adapt: v.adapt, init: v.frozen ? tables[`${kind}/${v.ctx}`] : undefined };
              const t0 = performance.now();
              const { bytes } = rcEncode(r[kind], o);
              const t1 = performance.now();
              lens.push(lenOf(bytes));
              if (vi++ % 6 === 0) {
                let ok = false;
                try {
                  const t2 = performance.now();
                  ok = sameState(decodeVia(kind === 'r1Calls' ? 'r1' : 'M', new RcSource(bytes, o)).back, r.data);
                  (tm.rc_dec ??= []).push(performance.now() - t2);
                } catch (e) {
                  if (failures.length < 20) failures.push(`B ${key} ${r.name}: ${(e as Error).message}`);
                }
                check(ok, `B ${key} decode`);
              }
              (tm.rc_enc ??= []).push(t1 - t0);
            }
            res[key] = { stats: stats(lens), vs_r1: vs(lens, col(rs, 'r1')), vs_m_guarded: vs(lens, col(rs, 'mg')), guarded_min_with_m_guarded: vs(lens.map((x, i) => Math.min(x, rs[i]!.mg)), col(rs, 'mg')) };
            rs.forEach((r, i) => (r[`B:${sname}:${key}`] = lens[i]));
          }
        // where the best variant's bits go, by category (ideal code length), vs the raw M stream
        {
          const o: ModelOpts = { ctx: 'path', adapt: true, init: tables['mCalls/path'] };
          const o0: ModelOpts = { ctx: 'path', adapt: true };
          const acc: Record<string, { raw: number; adaptive: number; frozen_adaptive: number }> = {};
          for (const r of rs) {
            const m1 = new Model(o);
            const m0 = new Model(o0);
            const io1 = new EncIo();
            const io0 = new EncIo();
            for (const c of r.mCalls) {
              const a = (acc[category(c)] ??= { raw: 0, adaptive: 0, frozen_adaptive: 0 });
              const b1 = m1.cost;
              const b0 = m0.cost;
              m1.call(io1, c.r, c.g, c.k, c.p, c.v);
              m0.call(io0, c.r, c.g, c.k, c.p, c.v);
              a.raw += callBits(c);
              a.frozen_adaptive += m1.cost - b1;
              a.adaptive += m0.cost - b0;
            }
          }
          res['bits by category, M stream: raw / adaptive from 1/2 / frozen init + adaptive (role+path), corpus totals'] = Object.fromEntries(
            Object.entries(acc)
              .sort((a, b) => b[1].raw - a[1].raw)
              .map(([k, v]) => [k, { raw: v.raw, adaptive: Math.round(v.adaptive), frozen_adaptive: Math.round(v.frozen_adaptive) }]),
          );
        }
        T.B[`${sname} / ${shape}`] = res;
      }
    }
    // the cross-entropy of the frozen role+path model on held-out data (a diagnostic, not a bound): bits per profile
  }

  // ---- C: enumerative set coding (combination rank) as the generic set code, + budgets
  {
    OPT.enumSets = true;
    try {
      for (const r of rows) {
        const r1bits = hybridBits(r.data, POL);
        const mbits = encodeProfile(r.data, POL, M, {});
        r.c_r1 = b64Len(r1bits, true).len;
        r.c_m = b64Len(mbits, true).len;
        r.c_mg = Math.min(r.c_m, r.r1, r.mg);
        if (r.corpus === 'named' || rows.indexOf(r) % 4 === 0) {
          let ok = false;
          try {
            ok = sameState(decodeProfile(mbits, POL, M, 8), r.data) && sameState(hybridFromBits(r1bits, POL, 8), r.data);
          } catch (e) {
            if (failures.length < 20) failures.push(`C ${r.name}: ${(e as Error).message}`);
          }
          check(ok, `C enum sets decode ${r.name}`);
        }
      }
    } finally {
      OPT.enumSets = false;
    }
    for (const [c, s] of GROUPS) {
      const rs = sel(c, s);
      T.C[`${c}/${s}`] = {
        r1_with_enum_sets: { stats: stats(col(rs, 'c_r1')), vs_r1: vs(col(rs, 'c_r1'), col(rs, 'r1')) },
        m_with_enum_sets: { stats: stats(col(rs, 'c_m')), vs_m: vs(col(rs, 'c_m'), col(rs, 'm')) },
        guarded_min_r1_m_menum: { stats: stats(col(rs, 'c_mg')), vs_m_guarded: vs(col(rs, 'c_mg'), col(rs, 'mg')) },
      };
    }
    // budget: the campaign codec's own sets (inside production save-code.ts), runs/bitmap vs rank, raw bits per file
    const D = CODE_DICTS as any;
    const files: any[] = [];
    for (const r of rows.filter((x) => x.shape === 'current' && x.corpus !== 'named')) for (const k of SAVE_KEYS) if (r.data[k]) files.push(r.data[k]);
    const per: Record<string, { now: number; rank: number; gap: number }> = {};
    const fileSave: number[] = [];
    const fileCode: number[] = [];
    for (const f of files) {
      let saved = 0;
      for (const [field, dict] of SET_FIELDS) {
        const d = D[dict] as string[];
        const idx = d.flatMap((x, i) => ((f[field] ?? []) as string[]).includes(x) ? [i] : []);
        const c = indexSetCost(d.length, idx);
        const p = (per[field] ??= { now: 0, rank: 0, gap: 0 });
        p.now += c.now;
        p.rank += c.rank;
        p.gap += c.gap;
        saved += c.now - Math.min(c.now, c.rank);
      }
      fileSave.push(saved);
      fileCode.push(r1CodecBits(f));
    }
    T.C.campaign_codec_set_budget = {
      files: files.length,
      dict_sizes: Object.fromEntries(SET_FIELDS.map(([f, d]) => [f, (D[d] as string[]).length])),
      raw_bits_total_by_field: per,
      median_raw_bits_saved_per_file_if_rank_added: stats(fileSave).median,
      max_raw_bits_saved_per_file: Math.max(...fileSave),
      median_codec_bits_per_file: stats(fileCode).median,
    };
    // budget: mixed-radix packing of every bounded symbol (enum / dictionary id) in the M stream: n − log2(alphabet) bits each
    for (const [c, s] of GROUPS.slice(0, 2)) {
      const rs = sel(c, s);
      const slack = rs.map((r) => r.mCalls.filter((x) => (x.r === 'enum' || x.r === 'sym') && x.a > 1).reduce((a, x) => a + x.p - Math.log2(x.a), 0));
      const total = rs.map((r) => r.mCalls.reduce((a, x) => a + callBits(x), 0));
      T.C[`mixed_radix_budget ${c}/${s}`] = { median_slack_bits_per_profile: +stats(slack).median.toFixed(1), median_total_bits: stats(total).median, max_slack_bits: +Math.max(...slack).toFixed(1) };
    }
  }

  // ---- D: hierarchical sharing, stage 1-2 (measure repeats beyond existing references, estimate the saving)
  {
    const corp: Record<string, any[]> = {
      'progress / bl': sel('progress', 'bl').map((r) => r.data),
      'progress / current': sel('progress', 'current').map((r) => r.data),
      'rk / bl': sel('rk', 'bl').map((r) => r.data),
      'random200 / bl (6-kit palette: stress)': sel('random200', 'bl').map((r) => r.data),
    };
    for (const regime of ['independent', 'shared-rules', 'shared-all', 'mosaic']) corp[`B-L regime ${regime} (synthetic, Classic-only)`] = Array.from({ length: 60 }, (_, i) => applyPolicy(blRegime(regime, 777 + i), POL));
    for (const [name, ds] of Object.entries(corp)) {
      const est = ds.map(sharingEstimate);
      const mbits = ds.map((d) => encodeProfile(d, POL, M, {}).length);
      const net = est.map((e) => e.netBits);
      T.D[name] = {
        profiles: ds.length,
        median_kit_components: stats(est.map((e) => e.components)).median,
        median_repeats: stats(est.map((e) => e.repeats)).median,
        median_repeats_missed_by_one_best_reference: stats(est.map((e) => e.missed)).median,
        profiles_with_any_missed: est.filter((e) => e.missed > 0).length,
        median_net_raw_bits_estimate: stats(net).median,
        p95_net_raw_bits_estimate: q([...net].sort((a, b) => a - b), 0.95),
        max_net_raw_bits_estimate: Math.max(...net),
        median_M_raw_bits: stats(mbits).median,
        median_net_estimate_pct_of_M_raw: +((100 * stats(net).median) / stats(mbits).median).toFixed(2),
        rules_objects_repeating_a_non_previous_file: est.reduce((a, e) => a + e.rulesMissed, 0),
      };
      // the regimes vs M (for the report)
      if (name.startsWith('B-L regime')) {
        const r1 = ds.map((d) => b64Len(hybridBits(d, POL), true).len);
        const mg = ds.map((d, i) => Math.min(r1[i] as number, b64Len(encodeProfile(d, POL, M, {}), true).len));
        const hg = ds.map((d, i) => Math.min(r1[i] as number, b64Len(encodeProfile(d, POL, H, {}), true).len));
        T.D[name].r1 = stats(r1);
        T.D[name].m_guarded = stats(mg);
        T.D[name].h_guarded = stats(hg);
      }
    }
  }

  // ---- compressor controls on the same payloads: Zopfli, zstd (+ trained dictionary), deflate + the same dictionary, Brotli
  {
    const deps = process.env.DEPS;
    let zopfli: any = null;
    if (deps) zopfli = createRequire(`${deps}/package.json`)('@gfx/zopfli');
    // dictionaries trained on one generator's payloads, tested on the other
    const payload = (r: Row, kind: 'r1' | 'm') => tight(kind === 'r1' ? r.r1Calls : r.mCalls);
    const rkRows = (shape: string) => rows.filter((r) => r.corpus === 'rk' && r.shape === shape);
    const trainSets: Record<string, Row[]> = {
      random200: rows.filter((r) => r.corpus === 'random200'),
      'rk-even': rows.filter((r) => r.corpus === 'rk' && rkRows(r.shape).indexOf(r) % 2 === 0),
    };
    const dictsBy: Record<string, Record<string, Uint8Array>> = {};
    for (const [tn, trainSet] of Object.entries(trainSets)) {
      const dicts: Record<string, Uint8Array> = {};
      try {
        for (const kind of ['r1', 'm'] as const) {
          const dir = `${SCRATCH}/samples-${tn}-${kind}`;
          mkdirSync(dir, { recursive: true });
          trainSet.forEach((r, i) => writeFileSync(`${dir}/${i}.bin`, payload(r, kind)));
          for (const size of [1024, 4096]) {
            const out = `${SCRATCH}/dict-${tn}-${kind}-${size}.bin`;
            const how = execFileSync('python3', [`${DIR}/train_zstd_dict.py`, dir, String(size), out], { stdio: 'pipe' }).toString().trim();
            dicts[`${kind}/${size}`] = new Uint8Array(readFileSync(out));
            (T.controls.dictionary_kind ??= {})[`${tn}/${kind}/${size}`] = how;
          }
        }
      } catch (e) {
        T.controls[`dictionary_training_error ${tn}`] = (e as Error).message.slice(0, 300);
      }
      dictsBy[tn] = dicts;
    }
    const dicts = dictsBy.random200 ?? {};
    const zstd = (b: Uint8Array, dict?: Uint8Array) => {
      const params = { [Z.ZSTD_c_compressionLevel]: 19, [Z.ZSTD_c_contentSizeFlag]: 0, [Z.ZSTD_c_checksumFlag]: 0, [Z.ZSTD_c_dictIDFlag]: 0 };
      const c = new Uint8Array(zstdCompressSync(b, dict ? ({ params, dictionary: dict } as any) : { params }));
      // drop the 4-byte magic number (the magicless frame format); the decoder adds it back
      const back = new Uint8Array(zstdDecompressSync(Buffer.from(c), dict ? ({ dictionary: dict } as any) : {}));
      check(deepEq(Array.from(back), Array.from(b)), 'zstd round trip');
      return c.subarray(4);
    };
    const deflDict = (b: Uint8Array, dict: Uint8Array) => {
      const c = new Uint8Array(deflateRawSync(b, { level: 9, dictionary: dict }));
      check(deepEq(Array.from(new Uint8Array(inflateRawSync(c, { dictionary: dict }))), Array.from(b)), 'deflate+dict round trip');
      return c;
    };
    const testRows = rows.filter((r) => r.corpus === 'progress' || r.corpus === 'rk');
    for (const r of testRows) {
      for (const kind of ['r1', 'm'] as const) {
        const b = payload(r, kind);
        const raw = lenOf(b);
        r[`ctl_${kind}_deflate9`] = Math.min(raw, packB64(z9(b), true).length);
        if (zopfli) {
          const t0 = performance.now();
          const zc = new Uint8Array(await zopfli.deflateAsync(Buffer.from(b), { numiterations: 50 }));
          (tm.zopfli_enc ??= []).push(performance.now() - t0);
          check(deepEq(Array.from(new Uint8Array(inflateRawSync(zc))), Array.from(b)), 'zopfli round trip (standard inflate)');
          r[`ctl_${kind}_zopfli`] = Math.min(raw, lenOf(zc));
        }
        r[`ctl_${kind}_zstd`] = Math.min(raw, lenOf(zstd(b)));
        r[`ctl_${kind}_brotli`] = Math.min(raw, lenOf(new Uint8Array(brotliCompressSync(b, { params: { [Z.BROTLI_PARAM_QUALITY]: 11, [Z.BROTLI_PARAM_SIZE_HINT]: b.length } }))));
        for (const [dk, d] of Object.entries(dicts)) {
          if (!dk.startsWith(kind)) continue;
          r[`ctl_${kind}_zstd_dict${dk.split('/')[1]}`] = Math.min(raw, lenOf(zstd(b, d)));
          r[`ctl_${kind}_deflate_dict${dk.split('/')[1]}`] = Math.min(raw, lenOf(deflDict(b, d)));
        }
        if (r.corpus === 'rk')
          for (const [dk, d] of Object.entries(dictsBy['rk-even'] ?? {})) {
            if (!dk.startsWith(kind)) continue;
            r[`ctl_${kind}_zstd_rkdict${dk.split('/')[1]}`] = Math.min(raw, lenOf(zstd(b, d)));
            r[`ctl_${kind}_deflate_rkdict${dk.split('/')[1]}`] = Math.min(raw, lenOf(deflDict(b, d)));
          }
      }
      // the M choice, guarded, under each control: min over R1/M payloads like M guarded
    }
    for (const corpus of ['progress', 'rk'])
      for (const shape of ['current', 'bl']) {
        let rs = testRows.filter((r) => r.shape === shape && r.corpus === corpus);
        // rk: only the odd half (the even half trained the rk dictionaries)
        if (corpus === 'rk') rs = rs.filter((r) => rkRows(shape).indexOf(r) % 2 === 1);
        const o: any = {};
        for (const k of Object.keys(rs[0]!).filter((x) => x.startsWith('ctl_'))) {
          const xs = col(rs, k);
          const guarded = xs.map((x, i) => Math.min(x, rs[i]!.mg));
          o[k.slice(4)] = { stats: stats(xs), vs_r1: vs(xs, col(rs, 'r1')), vs_m_guarded: vs(xs, col(rs, 'mg')), guarded_with_m_guarded: vs(guarded, col(rs, 'mg')) };
        }
        T.controls[`${corpus}/${shape} (dict = trained on random200; rkdict = trained on rk even half; rk rows = odd half)`] = o;
      }
    T.sizes.dictionaries = Object.fromEntries(Object.entries(dictsBy).flatMap(([tn, ds]) => Object.entries(ds).map(([k, d]) => [`${tn}/${k}`, d] as const)).map(([k, d]) => [k, { bytes: d.length, gzip: gzipSync(d, { level: 9 }).length }]));
  }

  // ---- K gap: round 1's K has no dictionary for classicTutorialsSeen (every id is an escaped string); fill it from the game's TUTORIAL_IDS
  {
    const genIds = ['select', 'first-start', 'mario', 'link', 'samus', 'upgrade'];
    T.Kgap = { tutorial_ids: TUTORIAL_IDS.length, generator_ids_in_registry: genIds.filter((x) => TUTORIAL_IDS.includes(x)) };
    CLASSIC_TUTORIAL_IDS.push(...TUTORIAL_IDS);
    try {
      for (const [c, s] of GROUPS.slice(0, 4)) {
        const rs = sel(c, s);
        const r1 = rs.map((r) => b64Len(hybridBits(r.data, POL), true).len);
        const mg = rs.map((r, i) => {
          const bits = encodeProfile(r.data, POL, M, {});
          if (i % 8 === 0) check(sameState(decodeProfile(bits, POL, M, 8), r.data), 'Kgap decode');
          return Math.min(r1[i] as number, b64Len(bits, true).len);
        });
        T.Kgap[`${c}/${s}`] = { r1_vs_r1: vs(r1, col(rs, 'r1')), mg_vs_mg: vs(mg, col(rs, 'mg')), profiles_with_tutorials_seen: rs.filter((r) => r.data['smbc.settings']?.classicTutorialsSeen?.length).length };
      }
    } finally {
      CLASSIC_TUTORIAL_IDS.length = 0;
    }
  }

  // ---- named profiles and completion groups: R1, guarded M / H, A1, and range coding (no table; and a table trained on random200)
  {
    const oA: ModelOpts = { ctx: 'path', adapt: true };
    const table = (() => {
      const counts = new Map<string, [number, number]>();
      for (const r of rows.filter((x) => x.corpus === 'random200')) for (const [k, [a, b]] of rcEncode(r.mCalls, oA).model.counts) {
        const c = counts.get(k) ?? [0, 0];
        c[0] += a;
        c[1] += b;
        counts.set(k, c);
      }
      return trainTable(counts);
    })();
    const oF: ModelOpts = { ctx: 'path', adapt: true, init: table };
    for (const r of rows) {
      r.bA = Math.min(r.mg, lenOf(rcEncode(r.mCalls, oA).bytes));
      r.bF = Math.min(r.mg, lenOf(rcEncode(r.mCalls, oF).bytes));
    }
    T.named = Object.fromEntries(
      rows
        .filter((r) => r.corpus === 'named')
        .map((r) => [`${r.name} / ${r.shape}`, { r1: r.r1, m: r.m, m_guarded: r.mg, h_guarded: r.hg, a1_guarded: r.a1g, rc_adaptive_guarded: r.bA, rc_table_random200_guarded: r.bF }]),
    );
    T.byPct = {};
    for (const corpus of ['progress', 'rk'])
      for (const shape of ['current', 'bl'])
        for (const p of [10, 25, 50, 75, 90, 99, 100]) {
          const rs = sel(corpus, shape).filter((r) => new RegExp(`(^|rk )${p}% `).test(r.name));
          T.byPct[`${corpus}/${shape} ${p}%`] = { n: rs.length, r1: stats(col(rs, 'r1')).median, m_guarded: stats(col(rs, 'mg')).median, rc_adaptive_guarded: stats(col(rs, 'bA')).median, rc_table_guarded: stats(col(rs, 'bF')).median };
        }
    for (const [c, s] of GROUPS) {
      const rs = sel(c, s);
      T[`rc summary ${c}/${s}`] = {
        rc_adaptive_guarded_vs_m_guarded: vs(col(rs, 'bA'), col(rs, 'mg')),
        rc_adaptive_guarded_vs_r1: vs(col(rs, 'bA'), col(rs, 'r1')),
        rc_table_random200_guarded_vs_m_guarded: c === 'random200' ? 'trained on this corpus: see B' : vs(col(rs, 'bF'), col(rs, 'mg')),
      };
    }
    T.sizes.implementation_source_gzip = Object.fromEntries(['rc.ts', 'trace.ts', 'layouts.ts', 'codec2.ts'].map((f) => [f, gzipSync(readFileSync(`${DIR}/${f}`), { level: 9 }).length]));
  }

  // ---- the best combination per profile among methods that need no new decoder semantics vs those that do
  {
    for (const [c, s] of GROUPS) {
      const rs = sel(c, s);
      const comb = rs.map((r) => Math.min(r.mg, r.a1g));
      T[`combination ${c}/${s}`] = { 'A1 search, guarded (no new syntax)': vs(comb, col(rs, 'mg')) };
    }
  }

  // ---- real loaders: the decoded profiles of A1 and of the best range-coded variant (current shape, every 4th + named)
  {
    let n = 0;
    for (const r of rows.filter((x) => x.shape === 'current')) {
      if (r.corpus !== 'named' && n++ % 4) continue;
      const back = decodeProfile(r.a1Bits, POL, M, 8);
      const a = normaliseLoaded(loadAll(r.data), POL);
      const b = normaliseLoaded(loadAll(back), POL);
      check(deepEq(canonLoaded(a), canonLoaded(b)), `loader-level equality A1 ${r.name}`);
      const o: ModelOpts = { ctx: 'path', adapt: true };
      const { bytes } = rcEncode(r.mCalls, o);
      const b2 = decodeVia('M', new RcSource(bytes, o)).back;
      check(deepEq(canonLoaded(normaliseLoaded(loadAll(b2), POL)), canonLoaded(a)), `loader-level equality B ${r.name}`);
    }
  }

  // ---- robustness: entropy-stream corruption, call budget, inflate cap, envelope method/version
  {
    const r = rows.find((x) => x.corpus === 'named' && x.name.startsWith('late'))!;
    const o: ModelOpts = { ctx: 'path', adapt: true };
    const { bytes } = rcEncode(r.mCalls, o);
    let threw = 0;
    let differs = 0;
    let same = 0;
    let maxCalls = 0;
    let maxMs = 0;
    const g = new Rng(31337);
    for (let i = 0; i < 1000; i++) {
      const b = bytes.slice();
      const j = g.int(b.length);
      b[j] = (b[j]! ^ (1 + g.int(255))) & 255;
      const t0 = performance.now();
      try {
        const rd = new CallReader(new RcSource(b, o));
        const back = decodeProfile([], POL, M, 8, rd);
        maxCalls = Math.max(maxCalls, rd.calls);
        if (sameState(back, r.data)) same++;
        else differs++;
      } catch {
        threw++;
      }
      maxMs = Math.max(maxMs, performance.now() - t0);
    }
    // with the CRC-32 envelope every one of those is rejected before decoding
    let crcAccepted = 0;
    const code = packB64(bytes, false);
    for (let i = 0; i < 1000; i++) {
      const chars = code.split('');
      const j = 1 + g.int(chars.length - 1);
      const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
      let ch = chars[j]!;
      while (ch === chars[j]) ch = alpha[g.int(64)]!;
      chars[j] = ch;
      if (unpackB64(chars.join('')).ok) crcAccepted++;
    }
    // an all-0xFF stream: the call budget or a count cap stops it
    let budgetStop = '';
    try {
      decodeProfile([], POL, M, 8, new CallReader(new RcSource(new Uint8Array(4096).fill(255), o), 200_000));
      budgetStop = 'decoded';
    } catch (e) {
      budgetStop = (e as Error).message;
    }
    // inflate cap: a 1 MB zero buffer deflates to ~1 KB; decoding with maxOutputLength 64 KB must stop
    let capStop = '';
    try {
      inflateRawSync(deflateRawSync(new Uint8Array(1 << 20), { level: 9 }), { maxOutputLength: 65536 });
      capStop = 'inflated';
    } catch (e) {
      capStop = (e as Error).message.slice(0, 80);
    }
    T.robustness = {
      range_coded_payload_byte_corruptions_without_crc: { trials: 1000, threw, decoded_different: differs, decoded_same: same, max_calls: maxCalls, max_ms: +maxMs.toFixed(1) },
      same_corruptions_with_crc32_envelope_accepted: crcAccepted,
      all_ff_stream: budgetStop,
      inflate_cap_64KB_on_1MB_bomb: capStop,
    };
  }

  for (const [k, v] of Object.entries(tm)) T.timing[k] = Object.fromEntries(Object.entries(stats(v)).map(([a, b]) => [a, typeof b === 'number' ? +(b as number).toFixed(2) : b]));
  T.checks = { total: checks, failed: failures.length, failures: failures.slice(0, 30) };
  writeFileSync(`${DIR}/results3.json`, JSON.stringify(T, null, 2));
  return JSON.stringify(T.checks);
}

/** The campaign codec's bits for a file (the inner code without its version and CRC). */
function r1CodecBits(f: any): number {
  return hybridBits({ 'smbc.save.1': f }, POL).length;
}
void binom;
