/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Throwaway save-code benchmark (read-only review). Run through vitest so the game's TS modules
 * and aliases load: BENCH_FILE=<this file> npx vitest run tests/zz-savecode-bench.test.ts
 * Writes results.json and results.md next to this file.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { webcrypto } from 'node:crypto';
import { Rng } from '@engine/rng';
import { encodeShare, decodeShare } from '@engine/share';
import { loadSettings, defaultSettings } from '@engine/save/settings';
import { loadProgress } from '@engine/save/progress';
import { loadSave, newSave, migrateSave } from '@game/save/save-files';
import { decodeSaveCode, encodeSaveCode, SAVE_CODE_FIELDS } from '@game/save/save-code';
import { loadClassicResume } from '@game/run-resume';
import { cleanCode, groupCode } from '@game/save/code-bits';
import {
  BitReader,
  BitWriter,
  bitsToBytes,
  b64u,
  bytesToBits,
  canon,
  CodeFormatError,
  crc16,
  crc32,
  dec,
  deepEq,
  enc,
  fromBase32,
  toBase32,
  unb64u,
  type S,
} from './codec';
import { R, TR } from './trace';
import { applyPolicy, BL_KEYS, blSchema, profileDefault, profileSchema, RESUME_KEYS, resumeSchema, saveSchema, SETS, type Policy } from './schema';
import { firstCastle, freshSave, fullSave, midSave, randomScenarios, sampleScenario, scenarios, resume, blFile, type Scenario } from './scenarios';

const DIR = new URL('.', import.meta.url).pathname.replace(/\/$/, ''); // research/savecode/harness
const SAMPLE = `${DIR}/../sample/sample-save.json`;
const SAMPLE_CODE = `${DIR}/../sample/sample-save-code.txt`;

// ------------------------------------------------------------------ in-memory localStorage (for the game's real loaders)

const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
};

// ------------------------------------------------------------------ envelopes

export const VERSION = 1;
/** Kinds in a code's first EG(0) field. */
export const KIND = { campaign: 0, classic: 1, profile: 2 } as const;

/** Base32 profile/slot code: kind EG0, version EG0, CRC (16 or 32 bits) over everything else, payload, zero padding. */
export function packB32(kind: number, payload: number[], crcBits: 16 | 32, version = VERSION): string {
  const head = new BitWriter();
  head.eg(0, kind);
  head.eg(0, version - 1);
  const body = payload.slice();
  while ((head.length + crcBits + body.length) % 5) body.push(0);
  const crc = new BitWriter();
  const all = [...head.bits, ...body];
  crc.uint(crcBits, crcBits === 16 ? crc16(all) : crc32(bitsToBytes(all)) >>> 0);
  return toBase32([...head.bits, ...crc.bits, ...body]);
}
type Unpacked = { ok: true; kind: number; version: number; r: BitReader } | { ok: false; error: 'typo' | 'newer' };
export function unpackB32(text: string, crcBits: 16 | 32): Unpacked {
  const clean = cleanCode(text);
  if (!clean) return { ok: false, error: 'typo' };
  const bits = fromBase32(clean);
  if (!bits) return { ok: false, error: 'typo' };
  try {
    const r = new BitReader(bits);
    const kind = r.eg(0);
    const version = r.eg(0) + 1;
    const head = bits.slice(0, r.pos);
    const crc = r.uint(crcBits);
    const all = [...head, ...bits.slice(r.pos)];
    const want = crcBits === 16 ? crc16(all) : crc32(bitsToBytes(all)) >>> 0;
    if (want !== crc) return { ok: false, error: 'typo' };
    if (version > VERSION) return { ok: false, error: 'newer' };
    return { ok: true, kind, version, r };
  } catch {
    return { ok: false, error: 'typo' };
  }
}

/** Base64url profile code: 'P' + [version][flags: bit0 deflate][CRC-32 of the rest, 4 bytes][payload bytes]. */
export function packB64(payload: Uint8Array, deflated: boolean, version = VERSION): string {
  const body = new Uint8Array(2 + payload.length);
  body[0] = version;
  body[1] = deflated ? 1 : 0;
  body.set(payload, 2);
  const c = crc32(body);
  const out = new Uint8Array(body.length + 4);
  out.set(body.subarray(0, 2), 0);
  out[2] = c >>> 24;
  out[3] = (c >>> 16) & 255;
  out[4] = (c >>> 8) & 255;
  out[5] = c & 255;
  out.set(body.subarray(2), 6);
  return 'P' + b64u(out);
}
export function unpackB64(code: string): { ok: true; payload: Uint8Array; deflated: boolean } | { ok: false; error: 'typo' | 'newer' } {
  if (code[0] !== 'P') return { ok: false, error: 'typo' };
  let b: Uint8Array;
  try {
    b = unb64u(code.slice(1));
  } catch {
    return { ok: false, error: 'typo' };
  }
  if (b.length < 6) return { ok: false, error: 'typo' };
  const body = new Uint8Array(b.length - 4);
  body.set(b.subarray(0, 2), 0);
  body.set(b.subarray(6), 2);
  const c = (((b[2] as number) << 24) | ((b[3] as number) << 16) | ((b[4] as number) << 8) | (b[5] as number)) >>> 0;
  if (crc32(body) !== c) return { ok: false, error: 'typo' };
  // re-encoding check: base64url has slack bits in its last character; a canonical code has them 0
  if (b64u(b) !== code.slice(1)) return { ok: false, error: 'typo' };
  if ((body[0] as number) > VERSION) return { ok: false, error: 'newer' };
  return { ok: true, payload: body.subarray(2), deflated: ((body[1] as number) & 1) === 1 };
}

// ------------------------------------------------------------------ profile codecs

export function profileBits(data: any, policy: Policy, delta: boolean): number[] {
  const w = new BitWriter();
  enc(w, profileSchema(policy), data, delta ? profileDefault(policy) : undefined, delta);
  return w.bits;
}
export function profileFromBits(bits: number[], policy: Policy, delta: boolean): any {
  const r = new BitReader(bits);
  const v = dec(r, profileSchema(policy), delta ? profileDefault(policy) : undefined, delta);
  if (r.left >= 8 || bits.slice(r.pos).some((b) => b)) throw new CodeFormatError('trailing bits');
  return v;
}

interface Lengths {
  [enc: string]: number;
}

const ENVELOPE = (data: any) => JSON.stringify({ app: 'smbc-remix', v: 1, exported: '2026-10-22', data });
const DICT = Buffer.from(
  JSON.stringify({
    app: 'smbc-remix',
    v: 1,
    exported: '2026-10-22',
    data: {
      'smbc.settings': defaultSettings(),
      'smbc.progress': profileDefault('exact')['smbc.progress'],
      'smbc.save.1': newSave(1, 'mario'),
      'smbc-classic-resume-smb': resume({ levelId: '1-1', rng: new Rng(1) }),
      'smbc-classic-file-smb-1': blFile({ levelId: '1-1', rng: new Rng(1) }),
    },
  }),
);

let checks = 0;
const failures: string[] = [];
function check(ok: boolean, what: string): void {
  checks++;
  if (!ok) failures.push(what);
}

async function measureProfile(name: string, data: any, policy: Policy): Promise<Lengths> {
  const input = applyPolicy(data, policy);
  const schema = profileSchema(policy);
  const out: Lengths = {};
  // (a)/(b) JSON + deflate-raw + base64url: the game's own encodeShare (CompressionStream), and zlib level 9
  const json = ENVELOPE(input);
  const zReal = await encodeShare(json);
  out.json_minified_bytes = Buffer.byteLength(json);
  out.z_encodeShare = zReal.length;
  check(deepEq(JSON.parse(await decodeShare(zReal)).data, input), `${name}/${policy}: z round trip`);
  const z9 = 'z' + b64u(deflateRawSync(json, { level: 9 }));
  out.z_level9 = z9.length;
  check(deepEq(JSON.parse(inflateRawSync(unb64u(z9.slice(1))).toString()).data, input), `${name}/${policy}: z9 round trip`);
  const zd = 'z' + b64u(deflateRawSync(json, { level: 9, dictionary: DICT }));
  out.z_level9_Kdictionary = zd.length;
  check(deepEq(JSON.parse(inflateRawSync(unb64u(zd.slice(1)), { dictionary: DICT }).toString()).data, input), `${name}/${policy}: zdict round trip`);
  // (c)/(d) binary schema, full and delta, with and without deflate
  for (const delta of [false, true]) {
    const tag = delta ? 'delta' : 'binary';
    const bits = profileBits(input, policy, delta);
    out[`${tag}_bits`] = bits.length;
    const want = canon(schema, input);
    // Base32 (CRC-32)
    const c32 = packB32(KIND.profile, bits, 32);
    out[`${tag}_base32`] = c32.length;
    const u = unpackB32(c32, 32);
    check(u.ok && deepEq(canon(schema, profileFromBitsAt(u, policy, delta)), want), `${name}/${policy}: ${tag} base32 round trip`);
    // Base64url (CRC-32)
    const bytes = bitsToBytes(bits);
    const c64 = packB64(bytes, false);
    out[`${tag}_base64url`] = c64.length;
    const u64 = unpackB64(c64);
    check(u64.ok && deepEq(canon(schema, profileFromBits(bytesToBits((u64 as any).payload), policy, delta)), want), `${name}/${policy}: ${tag} b64 round trip`);
    // + deflate-raw
    const z = deflateRawSync(bytes, { level: 9 });
    const cz = packB64(z, true);
    out[`${tag}_deflate_base64url`] = cz.length;
    const uz = unpackB64(cz);
    check(uz.ok && deepEq(canon(schema, profileFromBits(bytesToBits(inflateRawSync((uz as any).payload)), policy, delta)), want), `${name}/${policy}: ${tag}+deflate round trip`);
    out[`${tag}_best_base64url`] = Math.min(c64.length, cz.length);
  }
  return out;
}
function profileFromBitsAt(u: Unpacked, policy: Policy, delta: boolean): any {
  if (!u.ok) return null;
  const v = dec(u.r, profileSchema(policy), delta ? profileDefault(policy) : undefined, delta);
  if (u.r.left >= 5) throw new CodeFormatError('trailing');
  return v;
}

// ------------------------------------------------------------------ loader-level equivalence (the game's real loaders)

export function loadAll(data: Record<string, any>): any {
  store.clear();
  for (const [k, v] of Object.entries(data)) store.set(k, JSON.stringify(v));
  const out: any = {
    settings: loadSettings(),
    progress: loadProgress(),
    saves: [1, 2, 3].map((n) => loadSave(n as 1)),
    classic: SETS.map((s) => loadClassicResume(s)),
  };
  store.clear();
  return out;
}
/** What the semantic rule lets differ, set to fixed values on both sides. */
export function normaliseLoaded(l: any, policy: Policy): any {
  const x = structuredClone(l);
  if (policy === 'exact') return x;
  const d = defaultSettings() as any;
  for (const k of ['dev', 'devUnlock', 'classicDev']) x.settings[k] = d[k];
  if (policy === 'portable') for (const k of ['video', 'audio', 'input', 'packs', 'announce', 'homeScreen', 'backupReminders']) x.settings[k] = d[k];
  for (const s of x.saves) if (s) Object.assign(s, { created: 0, updated: 0, devUnlockAll: false, devAllHeroes: false, devGateOpen: false, devInventory: undefined });
  for (const c of x.classic) if (c) delete c.savedAt;
  return x;
}
function loaderCheck(name: string, data: any, policy: Policy): boolean {
  const input = applyPolicy(data, policy);
  const bits = profileBits(input, policy, true);
  const back = profileFromBits(bits, policy, true);
  // An import of a portable code keeps this device's own preferences: fill them in from defaults here.
  if (policy === 'portable' && back['smbc.settings']) {
    const d = defaultSettings() as any;
    for (const k of ['video', 'audio', 'input', 'packs', 'announce', 'homeScreen', 'backupReminders']) back['smbc.settings'][k] = d[k];
  }
  const a = normaliseLoaded(loadAll(data), policy);
  const b = normaliseLoaded(loadAll(back), policy);
  const ok = deepEq(canonLoaded(a), canonLoaded(b));
  check(ok, `${name}/${policy}: loader-level equivalence`);
  return ok;
}
export function canonLoaded(l: any): any {
  const x = structuredClone(l);
  const sortList = (o: any, keys: string[]) => {
    if (o) for (const k of keys) if (Array.isArray(o[k])) o[k] = [...o[k]].sort();
  };
  for (const s of x.saves) sortList(s, ['cleared', 'pages', 'secrets', 'freed', 'tutorials', 'met', 'story', 'explained']);
  for (const c of x.classic) if (c?.survival) c.survival.fallen = [...c.survival.fallen].sort();
  if (x.settings?.classicHeroesOff) x.settings.classicHeroesOff = [...x.settings.classicHeroesOff].sort();
  return x;
}


// ------------------------------------------------------------------ hybrid: generic delta + the game's own campaign codec for each file

export const SAVE_KEYS = ['smbc.save.1', 'smbc.save.2', 'smbc.save.3'];
/** The inner campaign code's own version (EG0 of 2: 3 bits) and CRC-16 at its start: framing inside the profile. */
export const INNER_FRAME = 19;
export function hybridBits(data: any, policy: Policy): number[] {
  const rest: any = { ...data };
  for (const k of SAVE_KEYS) delete rest[k];
  const w = new BitWriter();
  enc(w, profileSchema(policy), rest, profileDefault(policy), true);
  for (const k of SAVE_KEYS) {
    const s = data[k];
    TR.path.push(k);
    R('presence');
    w.bit(!!s);
    if (s) {
      const code = cleanCode(encodeSaveCode(s)) as string;
      R('cframe');
      w.eg(4, code.length);
      (fromBase32(code) as number[]).forEach((b, i) => {
        R(i < INNER_FRAME ? 'cframe' : 'codec');
        w.bit(b);
      });
      R('num');
      w.eg(10, s.score);
    }
    TR.path.pop();
  }
  return w.bits;
}
export function hybridFromBits(bits: number[], policy: Policy, padTo: number, reader?: BitReader): any {
  const r = reader ?? new BitReader(bits);
  const out = dec(r, profileSchema(policy), profileDefault(policy), true);
  SAVE_KEYS.forEach((k, i) => {
    TR.path.push(k);
    try {
      R('presence');
      if (!r.bit()) return;
      R('cframe');
      const n = r.eg(4);
      if (n > 4096) throw new CodeFormatError('inner code too long');
      const cb: number[] = [];
      for (let j = 0; j < n * 5; j++) {
        R(j < INNER_FRAME ? 'cframe' : 'codec');
        cb.push(r.bit() ? 1 : 0);
      }
      const res = decodeSaveCode(toBase32(cb), (i + 1) as 1);
      if (!res.ok) throw new CodeFormatError('inner campaign code');
      R('num');
      out[k] = { ...res.save, score: r.eg(10) };
    } finally {
      TR.path.pop();
    }
  });
  if (r.left >= padTo || bits.slice(r.pos).some((b) => b)) throw new CodeFormatError('trailing bits');
  return out;
}
/** What the campaign code keeps of a file (SAVE_CODE_FIELDS 'code'), plus the score, sets sorted. */
export function campaignCanon(s: any): any {
  const x: any = {};
  for (const [k, v] of Object.entries(s)) if ((SAVE_CODE_FIELDS as any)[k] === 'code' || k === 'score') x[k] = v;
  for (const k of ['cleared', 'pages', 'secrets', 'freed', 'tutorials', 'met', 'story', 'explained']) if (Array.isArray(x[k])) x[k] = [...x[k]].sort();
  return x;
}
function measureHybrid(name: string, data: any, policy: Policy, out: Lengths): void {
  const input = applyPolicy(data, policy);
  const bits = hybridBits(input, policy);
  out.hybrid_bits = bits.length;
  const c32 = packB32(KIND.profile, bits, 32);
  out.hybrid_base32 = c32.length;
  const u = unpackB32(c32, 32);
  let back: any = null;
  if (u.ok) back = hybridFromBits(u.r.bits.slice(u.r.pos), policy, 5);
  const schema = profileSchema(policy);
  const strip = (d: any) => {
    const x: any = { ...d };
    for (const k of SAVE_KEYS) delete x[k];
    return canon(schema, x);
  };
  check(!!back && deepEq(strip(back), strip(input)) && SAVE_KEYS.every((k) => (!input[k] && !back[k]) || deepEq(campaignCanon(back[k]), campaignCanon(input[k]))), `${name}/${policy}: hybrid round trip`);
  const bytes = bitsToBytes(bits);
  const c64 = packB64(bytes, false);
  out.hybrid_base64url = c64.length;
  const cz = packB64(deflateRawSync(bytes, { level: 9 }), true);
  out.hybrid_deflate_base64url = cz.length;
  const uz = unpackB64(cz);
  check(uz.ok && deepEq(strip(hybridFromBits(bytesToBits(inflateRawSync((uz as any).payload)), policy, 8)), strip(input)), `${name}/${policy}: hybrid+deflate round trip`);
  out.hybrid_best_base64url = Math.min(c64.length, cz.length);
  // loader level: the decoded profile through the game's loaders vs the original's
  if (back && !Object.keys(data).some((k) => k.startsWith('smbc-classic-file-'))) {
    if (policy === 'portable' && back['smbc.settings']) {
      const d = defaultSettings() as any;
      for (const k of ['video', 'audio', 'input', 'packs', 'announce', 'homeScreen', 'backupReminders']) back['smbc.settings'][k] = d[k];
    }
    const a = normaliseLoaded(loadAll(data), policy);
    const b = normaliseLoaded(loadAll(back), policy);
    // the campaign code's own left-out rule: dev flags off, timestamps now (already normalised)
    const ok = deepEq(canonLoaded(a), canonLoaded(b));
    check(ok, `${name}/${policy}: hybrid loader-level equivalence`);
    out.hybrid_loader_equivalent = ok ? 1 : 0;
  }
}

/** Bits each stored record costs in the delta profile (and the campaign files in the hybrid). */
function breakdown(data: any, policy: Policy): Record<string, number> {
  const input = applyPolicy(data, policy);
  const schema = profileSchema(policy);
  const def = profileDefault(policy);
  const out: Record<string, number> = {};
  for (const [k, fs] of schema.f) {
    if (input[k] === undefined) continue;
    const w = new BitWriter();
    if (def[k] !== undefined) {
      w.bit(0);
      w.bit(1);
      // encBody equivalent: enc without its same-bit
      const w2 = new BitWriter();
      enc(w2, fs, input[k], def[k], true);
      out[k] = w.length + w2.length - 1;
    } else {
      enc(w, fs, input[k], undefined, true);
      out[k] = w.length + 1;
    }
    if (SAVE_KEYS.includes(k)) {
      const code = cleanCode(encodeSaveCode(input[k])) as string;
      const sw = new BitWriter();
      sw.eg(4, code.length);
      sw.eg(10, input[k].score);
      out[`${k} (campaign codec)`] = 1 + code.length * 5 + sw.length;
    }
  }
  return out;
}

// ------------------------------------------------------------------ per-slot codes

export function slotCode(kind: number, schema: S, v: any): string {
  const w = new BitWriter();
  enc(w, schema, v, undefined, true);
  return packB32(kind, w.bits, 16);
}
export function slotDecode(code: string, schema: S): any {
  const u = unpackB32(code, 16);
  if (!u.ok) return u;
  const v = dec(u.r, schema, undefined, true);
  if (u.r.left >= 5 || u.r.bits.slice(u.r.pos).some((b) => b)) return { ok: false, error: 'typo' };
  return { ok: true, v };
}

// ------------------------------------------------------------------ stats

const stats = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return { min: s[0] as number, median: s[Math.floor((s.length - 1) / 2)] as number, max: s[s.length - 1] as number, n: s.length };
};

// ------------------------------------------------------------------ run

export async function run(): Promise<string> {
  const results: any = { profiles: {}, random: {}, slots: {}, corruption: {}, crypto: {}, notes: [] };
  const { sample, scenario: sampleSc } = sampleScenario(SAMPLE);
  const sampleCode = readFileSync(SAMPLE_CODE, 'utf8').trim();

  // ---- (a) the supplied z code: decode it with the game's decodeShare and compare with the JSON
  const decoded = JSON.parse(await decodeShare(sampleCode));
  results.sample = {
    code_chars: sampleCode.length,
    decodes_to_same_json: deepEq(decoded, sample),
    minified_bytes: Buffer.byteLength(JSON.stringify(sample)),
    reencoded_encodeShare: (await encodeShare(JSON.stringify(sample))).length,
    reencoded_zlib9: 1 + b64u(deflateRawSync(JSON.stringify(sample), { level: 9 })).length,
  };
  check(results.sample.decodes_to_same_json, 'sample z code decodes to sample JSON');

  // ---- named scenarios
  const named: Scenario[] = [...scenarios(), sampleSc];
  for (const sc of named) {
    results.profiles[sc.name] = {};
    for (const shape of ['current', 'bl'] as const) {
      for (const policy of ['exact', 'semantic', 'portable'] as Policy[]) {
        const data = sc[shape];
        const m = await measureProfile(`${sc.name}/${shape}`, data, policy);
        if (policy !== 'exact') measureHybrid(`${sc.name}/${shape}`, data, policy, m);
        if (shape === 'current' && sc.name !== 'supplied sample') m.loader_equivalent = loaderCheck(`${sc.name}`, data, policy) ? 1 : 0;
        results.profiles[sc.name][`${shape}/${policy}`] = m;
      }
    }
  }

  results.breakdown = {};
  for (const sc of named) for (const shape of ['current', 'bl'] as const) results.breakdown[`${sc.name}/${shape}/semantic`] = breakdown(sc[shape], 'semantic');

  // ---- random profiles: min / median / max
  const rand = randomScenarios(200);
  const acc: Record<string, Record<string, number[]>> = {};
  for (const sc of rand) {
    for (const shape of ['current', 'bl'] as const)
      for (const policy of ['exact', 'semantic', 'portable'] as Policy[]) {
        const m = await measureProfile(sc.name, sc[shape], policy);
        if (policy !== 'exact') measureHybrid(sc.name, sc[shape], policy, m);
        if (shape === 'current' && policy === 'semantic' && Number(sc.name.slice(7)) < 60) loaderCheck(sc.name, sc[shape], policy);
        const key = `${shape}/${policy}`;
        acc[key] ??= {};
        for (const [k, v] of Object.entries(m)) (acc[key][k] ??= []).push(v);
      }
  }
  for (const [key, m] of Object.entries(acc)) results.random[key] = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, stats(v)]));

  // ---- per-slot: campaign files (the game's own code vs this benchmark's generic delta)
  const campaign = { fresh: freshSave(1), firstCastle: firstCastle(1), mid: midSave(1), full: fullSave(1) };
  results.slots.campaign = {};
  const semSave = saveSchema(['created', 'updated', 'devUnlockAll', 'devAllHeroes', 'devGateOpen', 'devInventory']);
  for (const [k, s] of Object.entries(campaign)) {
    const real = encodeSaveCode(s);
    const r = decodeSaveCode(real, 1);
    check(r.ok, `campaign ${k}: real code decodes`);
    const v: any = { ...s };
    for (const f of ['created', 'updated', 'devUnlockAll', 'devAllHeroes', 'devGateOpen', 'devInventory']) delete v[f];
    const generic = slotCode(KIND.campaign, semSave, v);
    const back = slotDecode(generic, semSave);
    check(back.ok && deepEq(canon(semSave, back.v), canon(semSave, v)), `campaign ${k}: generic slot round trip`);
    // the real code with the score added: EG(10) of the score (its real cost, measured on these bits)
    const sw = new BitWriter();
    sw.eg(10, s.score);
    results.slots.campaign[k] = {
      existing_code_chars: real.replace(/-/g, '').length,
      existing_code_with_dashes: real.length,
      existing_plus_score_chars: Math.ceil(((cleanCode(real) as string).length * 5 + sw.length) / 5),
      score: s.score,
      generic_delta_chars: generic.length,
      generic_delta_with_dashes: groupCode(generic).length,
    };
  }

  // ---- per-slot: Classic (current ClassicResume + PR #193 heroKits, and planned B-L)
  const semRes = resumeSchema(['savedAt']);
  const semBL = blSchema(['savedAt']);
  const exRes = resumeSchema();
  results.slots.classic = {};
  const rng = new Rng(77);
  const classicCases: Record<string, any> = {
    'start of a run (1-1, no kits)': { levelId: '1-1', rng },
    'mid run (3-2, checkpoint, 2 kits)': { levelId: '3-2', hero: 'link', score: 45_200, coins: 37, lives: 2, kits: 2, checkpoint: true, rng },
    'late run (8-3, 8 kits, hard)': { levelId: '8-3', hero: 'samus', score: 612_350, coins: 61, lives: 5, kits: 8, checkpoint: true, difficulty: 'hard', rng },
    'Survival (ll-4-1, 5 fallen, 6 kits)': { levelId: 'll-4-1', hero: 'ryu', score: 250_000, lives: 6, kits: 6, survival: 5, rng },
    'max (15 kits, every rule changed)': { levelId: 'sp-8-2', hero: 'bass', score: 9_999_999, coins: 99, lives: 99, kits: 15, checkpoint: true, difficulty: 'hard', gameMode: 'single-random', rules: 'all', continues: 99, rng },
  };
  for (const [k, o] of Object.entries(classicCases)) {
    const r: any = resume(o);
    const rNoKits = { ...r };
    delete rNoKits.heroKits;
    const b: any = blFile(o);
    const rows: any = {};
    for (const [label, schema, v] of [
      ['ClassicResume (main, no heroKits), semantic', semRes, (() => { const x = { ...rNoKits }; delete x.savedAt; return x; })()],
      ['ClassicResume + PR #193 heroKits, semantic', semRes, (() => { const x = { ...r }; delete x.savedAt; return x; })()],
      ['ClassicResume + heroKits, exact (savedAt kept)', exRes, r],
      ['planned B-L file, semantic', semBL, (() => { const x = { ...b }; delete x.savedAt; return x; })()],
    ] as [string, S, any][]) {
      const code = slotCode(KIND.classic, schema, v);
      const back = slotDecode(code, schema);
      check(back.ok && deepEq(canon(schema, back.v), canon(schema, v)), `classic ${k} ${label}: round trip`);
      const json = JSON.stringify(v);
      rows[label] = { chars: code.length, with_dashes: groupCode(code).length, json_bytes: json.length, z_chars: 1 + b64u(deflateRawSync(json, { level: 9 })).length };
    }
    results.slots.classic[k] = rows;
  }
  // the sample's own 9 B-L files as per-slot codes (exact, placeholder values kept)
  const exBL = blSchema();
  results.slots.sampleBL = BL_KEYS.map((k) => {
    const v = sampleSc.bl[k];
    const code = slotCode(KIND.classic, exBL, v);
    const back = slotDecode(code, exBL);
    check(back.ok && deepEq(canon(exBL, back.v), canon(exBL, v)), `sample ${k}: round trip`);
    return code.length;
  });
  results.slots.sampleCurrent = RESUME_KEYS.map((k) => {
    const v = sampleSc.current[k];
    const code = slotCode(KIND.classic, exRes, v);
    const back = slotDecode(code, exRes);
    check(back.ok && deepEq(canon(exRes, back.v), canon(exRes, v)), `sample ${k}: round trip`);
    return code.length;
  });

  // ---- corruption / fuzz
  const frng = new Rng(4242);
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const sub = (s: string, alpha: string, from = 0) => {
    const i = from + frng.int(s.length - from);
    let c = s[i] as string;
    while (c === s[i]) c = alpha[frng.int(alpha.length)] as string;
    return s.slice(0, i) + c + s.slice(i + 1);
  };
  // (1) the existing z format (no checksum): what a one-character typo does
  {
    let threw = 0, silent = 0, same = 0;
    for (let t = 0; t < 2000; t++) {
      const bad = sub(sampleCode, B64, 1);
      try {
        const v = JSON.parse(await decodeShare(bad));
        if (deepEq(v, sample)) same++;
        else silent++;
      } catch {
        threw++;
      }
    }
    results.corruption.z_sample_one_char = { trials: 2000, rejected: threw, accepted_but_different: silent, accepted_identical: same };
    let tThrew = 0, tSilent = 0;
    for (let t = 0; t < 500; t++) {
      const bad = sampleCode.slice(0, 1 + frng.int(sampleCode.length - 1));
      try {
        JSON.parse(await decodeShare(bad));
        tSilent++;
      } catch {
        tThrew++;
      }
    }
    results.corruption.z_sample_truncated = { trials: 500, rejected: tThrew, accepted: tSilent };
  }
  // (2) the proposed Base64url profile code (CRC-32)
  {
    const data = applyPolicy(named[2]!.current, 'semantic');
    const bits = profileBits(data, 'semantic', true);
    const code = packB64(bitsToBytes(bits), false);
    const tryDecode = (c: string) => {
      const u = unpackB64(c);
      if (!u.ok) return u.error;
      try {
        profileFromBits(bytesToBits(u.payload), 'semantic', true);
        return 'accepted';
      } catch {
        return 'typo';
      }
    };
    const tally = (codes: string[]) => codes.reduce((a: any, c) => ((a[tryDecode(c)] = (a[tryDecode(c)] ?? 0) + 1), a), {});
    results.corruption.profile_b64_crc32 = {
      code_chars: code.length,
      one_char: tally(Array.from({ length: 3000 }, () => sub(code, B64, 1))),
      two_chars: tally(Array.from({ length: 3000 }, () => sub(sub(code, B64, 1), B64, 1))),
      adjacent_swap: tally(
        Array.from({ length: 1000 }, () => {
          const i = 1 + frng.int(code.length - 2);
          return code[i] === code[i + 1] ? sub(code, B64, 1) : code.slice(0, i) + code[i + 1] + code[i] + code.slice(i + 2);
        }),
      ),
      truncated: tally(Array.from({ length: 1000 }, () => code.slice(0, 1 + frng.int(code.length - 1)))),
      random_garbage: tally(Array.from({ length: 3000 }, () => 'P' + Array.from({ length: code.length - 1 }, () => B64[frng.int(64)]).join(''))),
      version_2: tryDecode(packB64(bitsToBytes(bits), false, 2)),
    };
  }
  // (3) the proposed per-slot Base32 code (CRC-16), exhaustive single-character substitution
  {
    const v: any = resume(classicCases['late run (8-3, 8 kits, hard)']);
    delete v.savedAt;
    const code = slotCode(KIND.classic, semRes, v);
    const tryDecode = (c: string) => {
      try {
        const r = slotDecode(c, semRes);
        return r.ok ? (deepEq(canon(semRes, r.v), canon(semRes, v)) ? 'accepted_same' : 'accepted_DIFFERENT') : r.error;
      } catch (e) {
        return e instanceof CodeFormatError ? 'typo' : 'crash';
      }
    };
    const t1: any = {};
    for (let i = 0; i < code.length; i++)
      for (const c of B32) {
        if (c === code[i]) continue;
        const k = tryDecode(code.slice(0, i) + c + code.slice(i + 1));
        t1[k] = (t1[k] ?? 0) + 1;
      }
    const t2: any = {};
    for (let t = 0; t < 5000; t++) {
      const k = tryDecode(sub(sub(code, B32), B32));
      t2[k] = (t2[k] ?? 0) + 1;
    }
    const sw: any = {};
    for (let i = 0; i + 1 < code.length; i++) {
      if (code[i] === code[i + 1]) continue;
      const k = tryDecode(code.slice(0, i) + code[i + 1] + code[i] + code.slice(i + 2));
      sw[k] = (sw[k] ?? 0) + 1;
    }
    const tr: any = {};
    for (let n = 1; n < code.length; n++) {
      const k = tryDecode(code.slice(0, n));
      tr[k] = (tr[k] ?? 0) + 1;
    }
    const rnd: any = {};
    for (let t = 0; t < 20000; t++) {
      const k = tryDecode(Array.from({ length: code.length }, () => B32[frng.int(32)]).join(''));
      rnd[k] = (rnd[k] ?? 0) + 1;
    }
    const w = new BitWriter();
    enc(w, semRes, v, undefined, true);
    results.corruption.classic_slot_b32_crc16 = {
      code_chars: code.length,
      code: groupCode(code),
      one_char_exhaustive: t1,
      two_chars: t2,
      adjacent_swap_exhaustive: sw,
      truncated_every_length: tr,
      random_same_length: rnd,
      version_2: tryDecode(packB32(KIND.classic, w.bits, 16, 2)),
      lower_case_with_spaces_O_for_0: tryDecode(groupCode(code).toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o')),
    };
  }
  // (4) the existing campaign code (CRC-16), for comparison
  {
    const s = midSave(1);
    const code = (cleanCode(encodeSaveCode(s)) as string);
    const t1: any = {};
    for (let i = 0; i < code.length; i++)
      for (const c of B32) {
        if (c === code[i]) continue;
        const r = decodeSaveCode(code.slice(0, i) + c + code.slice(i + 1), 1);
        const k = r.ok ? 'accepted' : r.error;
        t1[k] = (t1[k] ?? 0) + 1;
      }
    results.corruption.campaign_existing_one_char_exhaustive = { code_chars: code.length, ...t1 };
  }

  // ---- E: WebCrypto AES-GCM + PBKDF2 overhead and cost (measured in Node's WebCrypto)
  {
    const subtle = webcrypto.subtle;
    const data = applyPolicy(named[1]!.current, 'portable');
    const payload = bitsToBytes(profileBits(data, 'portable', true));
    const iterations = 600_000;
    const salt = webcrypto.getRandomValues(new Uint8Array(16));
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const base = await subtle.importKey('raw', new TextEncoder().encode('1234'), 'PBKDF2', false, ['deriveKey']);
    const t0 = performance.now();
    const key = await subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 128 }, false, ['encrypt', 'decrypt']);
    const tDerive = performance.now() - t0;
    const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, payload));
    const ct96 = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 96 }, key, payload));
    const pt = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, ct));
    check(deepEq([...pt], [...payload]), 'AES-GCM round trip');
    const plainB64 = packB64(payload, false).length;
    const full = 1 + Math.ceil((2 + 16 + 12 + ct.length) * 8 / 6);
    const lean = 1 + Math.ceil((2 + 8 + ct96.length) * 8 / 6); // 8-byte salt, IV fixed (fresh key per salt), 96-bit tag
    const plainB32 = packB32(KIND.profile, bytesToBits(payload), 32).length;
    results.crypto = {
      payload_bytes: payload.length,
      plaintext_b64_chars: plainB64,
      aesgcm_salt16_iv12_tag16_b64_chars: full,
      aesgcm_salt8_ivfixed_tag12_b64_chars: lean,
      plaintext_b32_chars: plainB32,
      aesgcm_salt16_iv12_tag16_b32_chars: Math.ceil(((16 + 12 + ct.length) * 8 + 40) / 5),
      aesgcm_salt8_ivfixed_tag12_b32_chars: Math.ceil(((8 + ct96.length) * 8 + 40) / 5),
      pbkdf2_sha256_600k_ms_node: Math.round(tDerive),
      pin4_space: 10_000,
      pin6_space: 1_000_000,
      worst_case_hours_pin4_one_js_core: +((10_000 * tDerive) / 3_600_000).toFixed(2),
      worst_case_days_pin6_one_js_core: +((1_000_000 * tDerive) / 86_400_000).toFixed(1),
    };
  }

  // ---- negative controls: the comparisons do catch a difference
  {
    const sc = named[1]!.current;
    const a = normaliseLoaded(loadAll(sc), 'semantic');
    const mutated = structuredClone(sc);
    mutated['smbc.save.1'].cleared = mutated['smbc.save.1'].cleared.slice(0, -1);
    const b = normaliseLoaded(loadAll(mutated), 'semantic');
    const m2 = structuredClone(sc);
    m2['smbc.settings'].classicCheats.unlocked.waterMode = true;
    const c = normaliseLoaded(loadAll(m2), 'semantic');
    const m3 = structuredClone(sc);
    m3['smbc-classic-resume-smb'].heroKits.luigi = { powerState: 'fire', hp: 0, kit: {} };
    const d = normaliseLoaded(loadAll(m3), 'semantic');
    results.negative_controls = {
      loader_detects_dropped_level: !deepEq(canonLoaded(a), canonLoaded(b)),
      loader_detects_cheat_unlock: !deepEq(canonLoaded(a), canonLoaded(c)),
      loader_detects_classic_herokit: !deepEq(canonLoaded(a), canonLoaded(d)),
      deepEq_detects_number: !deepEq({ x: [1, { y: 2 }] }, { x: [1, { y: 3 }] }),
    };
    check(Object.values(results.negative_controls).every(Boolean), 'negative controls');
  }

  results.checks = { total: checks, failed: failures.length, failures: failures.slice(0, 50) };
  writeFileSync(`${DIR}/results.json`, JSON.stringify(results, null, 2));
  void migrateSave;
  return JSON.stringify(results.checks);
}
