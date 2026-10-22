/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Round 2 benchmark (throwaway): multiple references (multi-K), modular per-stage references,
 * cross-slot references and an adaptive per-section encoder, against the round-1 hybrid.
 * BENCH_FILE=<this file> npx vitest run tests/zz-savecode-bench.test.ts
 */
import { writeFileSync } from 'node:fs';
import { deflateRawSync, inflateRawSync, gzipSync } from 'node:zlib';
import { defaultSettings } from '@engine/save/settings';
import { CHARACTERS } from '@game/characters/registry';
import { heroStart } from '@game/items/heroes';
import { MAP_PAGES } from '@content/worldmap';
import { CODE_DICTS, decodeSaveCode, encodeSaveCode } from '@game/save/save-code';
import { cleanCode, fromBase32, toBase32, widthFor } from '@game/save/code-bits';
import { metIds, newSave, SAVE_VERSION } from '@game/save/save-files';
import { CRYSTAL_BALL } from '@game/map/captives';
import { upgradeStory } from '@game/story/beats';
import { BitReader, BitWriter, bitsToBytes, bytesToBits, canon, CodeFormatError, deepEq, enc as enc1, dec as dec1, type S } from './codec';
import { bitsOf, dec2, decStaged, enc2, encStaged, pickFields, push, type Stage } from './codec2';
import {
  applyPolicy,
  BL_KEYS,
  blSchema,
  CLASSIC_HEROES,
  CLASSIC_LEVELS,
  DEV_FIELDS,
  DEVICE_FIELDS,
  KEY_CODES,
  KIT_KEYS,
  NODES,
  progressDefault,
  progressSchema,
  RESUME_KEYS,
  resumeSchema,
  saveSchema,
  settingsDefault,
  settingsSchema,
  type Policy,
} from './schema';
import { canonLoaded, hybridBits, hybridFromBits, INNER_FRAME, KIND, loadAll, normaliseLoaded, packB32, packB64, SAVE_KEYS, slotCode, slotDecode, unpackB32, unpackB64 } from './bench';
import { fullHero, randomScenarios, sampleScenario, scenarios, type Scenario } from './scenarios';
import { campaignAt, pctProfile } from './scenarios2';
import { Rng } from '@engine/rng';
import { R, TR } from './trace';

const DIR = new URL('.', import.meta.url).pathname.replace(/\/$/, ''); // research/savecode/harness
const SAMPLE = `${DIR}/../sample/sample-save.json`;

let checks = 0;
const failures: string[] = [];
function check(ok: boolean, what: string): void {
  checks++;
  if (!ok && failures.length < 100) failures.push(what);
  else if (!ok) failures.push('…');
}

// ------------------------------------------------------------------ policy-dependent schemas

const F_DROP = ['created', 'updated', 'devUnlockAll', 'devAllHeroes', 'devGateOpen', 'devInventory'];
export const sDropOf = (p: Policy) => (p === 'semantic' ? DEV_FIELDS : [...DEV_FIELDS, ...DEVICE_FIELDS]);
const SCH: Record<string, any> = {};
export function sch(policy: Policy) {
  if (!SCH[policy]) {
    const settings = settingsSchema(sDropOf(policy));
    const save = saveSchema(F_DROP) as any;
    const res = resumeSchema(['savedAt']) as any;
    const bl = blSchema(['savedAt']) as any;
    SCH[policy] = { settings, save, saveBody: save.body, res, resBody: res.body, bl, blBody: bl.body };
  }
  return SCH[policy];
}
export const names = (s: any): string[] => s.f.map(([n]: any) => n);

// ------------------------------------------------------------------ K: frozen references (built from the game's registries, not from test data)

const HEROES = CHARACTERS.map((c) => c.id);
const levelsOf = (pred: (p: (typeof MAP_PAGES)[number]) => boolean) => MAP_PAGES.filter(pred).flatMap((p) => p.nodes.flatMap((n) => (n.level ? [n.level] : [])));
const SMB_PAGE = (p: any) => p.group === 'smb';
const HALF_PAGES = ['smb-1', 'smb-2', 'smb-3', 'smb-4'];
const ALL_PAGES = MAP_PAGES.map((p) => p.id);
const heroBasic = (id: string) => {
  const c = CHARACTERS.find((h) => h.id === id);
  return c ? heroStart(c) : { powerState: 'small', hp: 0, kit: {} };
};
const heroFull = (id: string) => (HEROES.includes(id) ? fullHero(id) : heroBasic(id));

function freshFile(h: any): any {
  const d: any = { ...newSave(h.slot ?? 1, h.character ?? 'mario', h.character2 ?? null), v: SAVE_VERSION };
  for (const k of F_DROP) delete d[k];
  return d;
}
/** Whole-file campaign templates (head-dependent: the played heroes' own kits). */
export const FILE_T: Record<string, (h: any) => any> = {
  fresh: freshFile,
  half: (h) => ({ ...freshFile(h), cleared: levelsOf((p) => HALF_PAGES.includes(p.id)), pages: HALF_PAGES }),
  smb: (h) => ({ ...freshFile(h), cleared: levelsOf(SMB_PAGE), pages: MAP_PAGES.filter(SMB_PAGE).map((p) => p.id), gameCleared: true }),
  full: (h) => {
    const played = [h.character, ...(h.character2 ? [h.character2] : [])];
    const me = heroFull(h.character);
    return {
      ...freshFile(h),
      cleared: levelsOf(() => true),
      pages: ALL_PAGES,
      secrets: CODE_DICTS.secrets as string[],
      gameCleared: true,
      wallet: true,
      inventoryUnlocked: true,
      freed: HEROES,
      met: [...HEROES, 'larry'],
      tutorials: HEROES,
      story: CODE_DICTS.story as string[],
      explained: CODE_DICTS.explained as string[],
      powerState: me.powerState,
      hp: me.hp,
      kit: me.kit,
      heroKits: Object.fromEntries(HEROES.filter((x) => !played.includes(x)).map((x) => [x, heroFull(x)])),
    };
  },
};
const allUnlockedSettings = () => {
  const s: any = defaultSettings();
  for (const k of Object.keys(s.classicCheats.unlocked)) s.classicCheats.unlocked[k] = true;
  s.classicCheats.beaten = { smb: true, special: true, lost: true };
  s.classicCheats.levelSelect = true;
  return s;
};
const allDoneProgress = () => ({ ...progressDefault(), lost: { world9: true, letters: true, beaten: 8 }, classicBeat: { smb: 'hard', special: 'hard', lost: 'hard' } });

// ------------------------------------------------------------------ sections and candidates

type Tag = 'base' | 'r1' | 'fullK' | 'multiK' | 'codec' | 'modular' | 'derived' | 'cross';
export interface Cand {
  tag: Tag;
  name: string;
  enc: (w: BitWriter) => void;
  dec: (r: BitReader) => any;
}
export interface Cfg {
  name: string;
  tags: ReadonlySet<Tag>;
  wholeK?: boolean;
  deflate?: boolean;
}
export const CFG = (name: string, tags: Tag[], extra: Partial<Cfg> = {}): Cfg => ({ name, tags: new Set<Tag>(['base', ...tags, ...(tags.includes('multiK') ? (['fullK'] as Tag[]) : [])]), ...extra });

export const SETTINGS_GROUPS = (body: any) => {
  const all = names(body);
  const device = all.filter((n) => DEVICE_FIELDS.includes(n));
  const achieve = all.filter((n) => ['classicCheats', 'classicTutorialsSeen'].includes(n));
  const options = all.filter((n) => !device.includes(n) && !achieve.includes(n));
  return { device, options, achieve };
};
const subObj = (body: any, fields: string[]): S => ({ t: 'obj', f: body.f.filter(([n]: any) => fields.includes(n)) });

/** One section: the candidates allowed by cfg, best picked, selector bits written. */
let ACC: Record<string, { n: number; r1: number; chosen: number }> | undefined;
function encSection(w: BitWriter, cands: Cand[], stat: Record<string, number>, key: string): any {
  let best: number[] | null = null;
  let bi = 0;
  let r1b = -1;
  cands.forEach((c, i) => {
    const b = bitsOf(c.enc);
    if (c.name === 'r1' || c.name === 'codec') r1b = b.length;
    if (!best || b.length < best.length) {
      best = b;
      bi = i;
    }
  });
  R('sel');
  w.uint(widthFor(cands.length), bi);
  push(w, best as unknown as number[]);
  if (ACC && r1b >= 0) {
    const a = (ACC[key] ??= { n: 0, r1: 0, chosen: 0 });
    a.n++;
    a.r1 += r1b;
    a.chosen += widthFor(cands.length) + (best as unknown as number[]).length;
  }
  const tagKey = `${key}:${cands[bi]!.name}`;
  stat[tagKey] = (stat[tagKey] ?? 0) + 1;
  return cands[bi]!.dec(new BitReader(best as unknown as number[]));
}
export function decSection(r: BitReader, cands: Cand[]): any {
  R('sel');
  const i = r.uint(widthFor(cands.length));
  if (i >= cands.length) throw new CodeFormatError('bad selector');
  return cands[i]!.dec(r);
}
export const allow = (cfg: Cfg, cs: Cand[]) => cs.filter((c) => cfg.tags.has(c.tag));

// --- settings groups
export function settingsCands(cfg: Cfg, policy: Policy, group: 'device' | 'options' | 'achieve', v: any, wholeRef?: any): Cand[] {
  const body = sch(policy).settings;
  const fields = SETTINGS_GROUPS(body)[group];
  const s = subObj(body, fields);
  const def = pickFields(settingsDefault(sDropOf(policy)), fields);
  const mk = (tag: Tag, name: string, ref: any): Cand => ({ tag, name, enc: (w) => enc2(w, s, v, ref), dec: (r) => dec2(r, s, ref) });
  if (wholeRef) return [mk('base', 'whole', pickFields(wholeRef, fields))];
  const out = [mk('base', 'default', def), { tag: 'r1' as Tag, name: 'r1', enc: (w: BitWriter) => enc1(w, s, v, def, true), dec: (r: BitReader) => dec1(r, s, def, true) }];
  if (group === 'achieve') out.push(mk('fullK', 'allUnlocked', pickFields(allUnlockedSettings(), fields)));
  return allow(cfg, out);
}
export function progressCands(cfg: Cfg, v: any, wholeRef?: any): Cand[] {
  const s = progressSchema;
  const mk = (tag: Tag, name: string, ref: any): Cand => ({ tag, name, enc: (w) => enc2(w, s, v, ref), dec: (r) => dec2(r, s, ref) });
  if (wholeRef) return [mk('base', 'whole', wholeRef)];
  return allow(cfg, [
    mk('base', 'default', progressDefault()),
    { tag: 'r1', name: 'r1', enc: (w) => enc1(w, s, v, progressDefault(), true), dec: (r) => dec1(r, s, progressDefault(), true) },
    mk('fullK', 'allDone', allDoneProgress()),
  ]);
}

// --- campaign files
const HEAD = ['slot', 'character', 'character2'];
const PROG = ['v', 'cleared', 'pages', 'secrets', 'gameCleared', 'position', 'lastNode', 'pendingReveal', 'bonusOpen', 'bonusGuard', 'bonusNext', 'spadeBoard', 'spadeTaken', 'wallet', 'inventoryUnlocked'];
const FREED = ['freed'];
const MET = ['met', 'tutorials'];
const STORYF = ['story', 'explained'];
const EQUIP = ['powerState', 'hp', 'kit', 'powerState2', 'hp2', 'kit2', 'heroKits', 'heroInventory', 'heroItemsNext', 'inventory', 'itemsNext'];
const RUN = ['lives', 'score', 'coins'];
const headRef = (slot: number) => ({ slot, character: 'mario', character2: null });

function equipRef(h: any, so: any, kind: 'basic' | 'full'): any {
  const played = [h.character, ...(h.character2 ? [h.character2] : [])];
  const pick = kind === 'basic' ? heroBasic : heroFull;
  const me = pick(h.character);
  const d = freshFile(h);
  return { ...d, powerState: me.powerState, hp: me.hp, kit: me.kit, heroKits: Object.fromEntries((so.freed ?? []).filter((x: string) => !played.includes(x)).map((x: string) => [x, pick(x)])) };
}
const CAMPAIGN_MODULAR = (slot: number): Stage[] => [
  { name: 'head', fields: HEAD, refs: () => [headRef(slot)] },
  { name: 'progress', fields: PROG, refs: (so) => ['fresh', 'half', 'smb', 'full'].map((t) => FILE_T[t]!(so)) },
  { name: 'freed', fields: FREED, refs: (so) => [freshFile(so), FILE_T.full!(so)] },
  {
    name: 'met',
    fields: MET,
    refs: (so) => [freshFile(so), { met: metIds([], so.freed, (so.secrets ?? []).includes(CRYSTAL_BALL)), tutorials: so.freed }, FILE_T.full!(so)],
  },
  { name: 'story', fields: STORYF, refs: (so) => [freshFile(so), { story: upgradeStory(undefined, so, so.freed), explained: [] }, FILE_T.full!(so)] },
  { name: 'equip', fields: EQUIP, refs: (so) => [freshFile(so), equipRef(so, so, 'basic'), equipRef(so, so, 'full')] },
  { name: 'run', fields: RUN, refs: (so) => [freshFile(so)] },
];
const CAMPAIGN_WHOLE = (slot: number, t: (h: any) => any): Stage[] => [
  { name: 'head', fields: HEAD, refs: () => [headRef(slot)] },
  { name: 'rest', fields: [...PROG, ...FREED, ...MET, ...STORYF, ...EQUIP, ...RUN], refs: (so) => [t(so)] },
];
const CAMPAIGN_PREV = (slot: number, prev: any): Stage[] => [
  { name: 'head', fields: HEAD, refs: () => [headRef(slot), prev] },
  { name: 'rest', fields: [...PROG, ...FREED, ...MET, ...STORYF, ...EQUIP, ...RUN], refs: () => [prev] },
];

/** The decoded campaign file as the schema has it (what a later section can reference). */
export function asSchemaFile(policy: Policy, s: any): any {
  return pickFields(s, names(sch(policy).saveBody));
}
export function campaignCands(cfg: Cfg, policy: Policy, slot: number, v: any, prev: any[], wholeT?: string): Cand[] {
  const body = sch(policy).saveBody;
  const staged = (tag: Tag, name: string, stages: Stage[]): Cand => ({
    tag,
    name,
    enc: (w) => void encStaged(w, body, stages, v, {}, `${policy}:${name}`),
    dec: (r) => decStaged(r, body, stages, {}, `${policy}:${name}`),
  });
  if (wholeT) return [staged('base', `whole-${wholeT}`, CAMPAIGN_WHOLE(slot, FILE_T[wholeT]!))];
  const codec: Cand = {
    tag: 'codec',
    name: 'codec',
    enc: (w) => {
      const code = cleanCode(encodeSaveCode(v)) as string;
      R('cframe');
      w.eg(4, code.length);
      (fromBase32(code) as number[]).forEach((b, i) => {
        R(i < INNER_FRAME ? 'cframe' : 'codec');
        w.bit(b);
      });
      R('num');
      w.eg(10, v.score);
    },
    dec: (r) => {
      R('cframe');
      const n = r.eg(4);
      if (n > 4096) throw new CodeFormatError('inner code too long');
      const cb: number[] = [];
      for (let j = 0; j < n * 5; j++) {
        R(j < INNER_FRAME ? 'cframe' : 'codec');
        cb.push(r.bit() ? 1 : 0);
      }
      const res = decodeSaveCode(toBase32(cb), slot as 1);
      if (!res.ok) throw new CodeFormatError('inner campaign code');
      R('num');
      return asSchemaFile(policy, { ...res.save, score: r.eg(10) });
    },
  };
  const r1: Cand = { tag: 'r1', name: 'r1-generic', enc: (w) => enc1(w, sch(policy).save, v, undefined, true), dec: (r) => dec1(r, sch(policy).save, undefined, true) };
  const out: Cand[] = [
    staged('base', 'fresh', CAMPAIGN_WHOLE(slot, FILE_T.fresh!)),
    codec,
    r1,
    staged('multiK', 'half', CAMPAIGN_WHOLE(slot, FILE_T.half!)),
    staged('multiK', 'smb', CAMPAIGN_WHOLE(slot, FILE_T.smb!)),
    staged('fullK', 'full', CAMPAIGN_WHOLE(slot, FILE_T.full!)),
    staged('modular', 'modular', CAMPAIGN_MODULAR(slot)),
    ...prev.map((p, j) => staged('cross', `prev${j}`, CAMPAIGN_PREV(slot, p))),
  ];
  return allow(cfg, out);
}

// --- Classic slots (current ClassicResume) and planned B-L files (DESIGN)
export function classicCands(cfg: Cfg, policy: Policy, key: string, v: any, prev: any[], ctx: any): Cand[] {
  const isBL = key.startsWith('smbc-classic-file-');
  const keyed = isBL ? sch(policy).bl : sch(policy).res;
  const body = keyed.body;
  const all = names(body);
  const head = ['levelId'];
  const kitsF = ['heroKits'];
  const rulesF = isBL ? ['rules'] : [];
  const runF = all.filter((n) => !head.includes(n) && !kitsF.includes(n) && !rulesF.includes(n));
  const K0 = (so: any) => keyed.mk(so);
  const staged = (tag: Tag, name: string, stages: Stage[]): Cand => ({
    tag,
    name,
    enc: (w) => void encStaged(w, body, stages, v, ctx, `${policy}:${isBL}:${name}`),
    dec: (r) => decStaged(r, body, stages, ctx, `${policy}:${isBL}:${name}`),
  });
  const globalRules = () => {
    const s = ctx.settings;
    if (!s) return undefined;
    const d = defaultSettings() as any;
    const c = s.classic ?? d.classic;
    const weapons: any = {};
    for (const [k, x] of Object.entries(c.weapons ?? {})) if (x !== d.classic.weapons[k]) weapons[k] = x;
    return {
      rules: {
        difficulty: s.classicMapDifficulty ?? 'normal',
        gameMode: c.gameMode,
        more: { lives: c.lives, attack: c.attack, whenHit: c.whenHit, drops: c.drops, piranhas: c.piranhas, goombas: c.goombas, enemySpeed: c.enemySpeed },
        weapons,
        disabled: s.classicHeroesOff ?? [],
      },
    };
  };
  const modular: Stage[] = [
    { name: 'head', fields: head, refs: () => [undefined] },
    { name: 'run', fields: runF, refs: (so) => [K0(so)] },
    { name: 'kits', fields: kitsF, refs: () => [{ heroKits: isBL ? {} : undefined }, ...(cfg.tags.has('cross') ? prev : [])] },
    ...(isBL ? [{ name: 'rules', fields: rulesF, refs: (so: any) => [K0(so), ...(cfg.tags.has('derived') && ctx.settings ? [globalRules()] : []), ...(cfg.tags.has('cross') ? prev : [])] } as Stage] : []),
  ];
  const out: Cand[] = [
    staged('base', 'K0', [
      { name: 'head', fields: head, refs: () => [undefined] },
      { name: 'rest', fields: all.filter((n) => n !== 'levelId'), refs: (so) => [K0(so)] },
    ]),
    { tag: 'r1', name: 'r1', enc: (w) => enc1(w, keyed, v, undefined, true), dec: (r) => dec1(r, keyed, undefined, true) },
    staged('modular', 'modular', modular),
    ...prev.map((p, j) =>
      staged('cross', `prev${j}`, [
        { name: 'head', fields: head, refs: () => [undefined, p] },
        { name: 'rest', fields: all.filter((n) => n !== 'levelId'), refs: () => [p] },
      ]),
    ),
  ];
  return allow(cfg, out);
}

// ------------------------------------------------------------------ profile encode / decode

export const CLASSIC_KEYS = [...RESUME_KEYS, ...BL_KEYS];
const WHOLE_T = [
  { name: 'fresh', settings: () => defaultSettings(), progress: progressDefault, file: 'fresh' },
  { name: 'mid', settings: () => defaultSettings(), progress: progressDefault, file: 'half' },
  { name: 'full', settings: allUnlockedSettings, progress: allDoneProgress, file: 'full' },
];

export function encodeProfile(data: any, policy: Policy, cfg: Cfg, stat: Record<string, number>, acc?: any): number[] {
  ACC = acc;
  try {
    return encodeProfileInner(data, policy, cfg, stat);
  } finally {
    ACC = undefined;
  }
}
function encodeProfileInner(data: any, policy: Policy, cfg: Cfg, stat: Record<string, number>): number[] {
  const w = new BitWriter();
  let tIdx = -1;
  if (cfg.wholeK) {
    // one selector for the whole profile: try each template, keep the shortest
    let best: number[] | null = null;
    WHOLE_T.forEach((_, i) => {
      const b = encodeProfileWith(data, policy, cfg, {}, i);
      if (!best || b.length < best.length) {
        best = b;
        tIdx = i;
      }
    });
    stat[`whole:${WHOLE_T[tIdx]!.name}`] = (stat[`whole:${WHOLE_T[tIdx]!.name}`] ?? 0) + 1;
    R('sel');
    w.uint(widthFor(WHOLE_T.length), tIdx);
    push(w, best as unknown as number[]);
    return w.bits;
  }
  return encodeProfileWith(data, policy, cfg, stat, -1);
}
function encodeProfileWith(data: any, policy: Policy, cfg: Cfg, stat: Record<string, number>, t: number): number[] {
  const w = new BitWriter();
  const T = t >= 0 ? WHOLE_T[t] : undefined;
  const ctx: any = {};
  const s = data['smbc.settings'];
  TR.path.push('smbc.settings');
  R('presence');
  w.bit(!!s);
  if (s) {
    const groups = SETTINGS_GROUPS(sch(policy).settings);
    const dec: any = {};
    for (const g of ['device', 'options', 'achieve'] as const) {
      if (!groups[g].length) continue;
      Object.assign(dec, encSection(w, settingsCands(cfg, policy, g, pickFields(s, groups[g]), T?.settings()), stat, `settings.${g}`));
    }
    ctx.settings = dec;
  }
  TR.path.pop();
  const p = data['smbc.progress'];
  TR.path.push('smbc.progress');
  R('presence');
  w.bit(!!p);
  if (p) encSection(w, progressCands(cfg, p, T?.progress()), stat, 'progress');
  TR.path.pop();
  const prevFiles: any[] = [];
  SAVE_KEYS.forEach((k, i) => {
    const f = data[k];
    TR.path.push(k);
    R('presence');
    w.bit(!!f);
    if (f) {
      const v = pickFields(f, names(sch(policy).saveBody));
      prevFiles.push(encSection(w, campaignCands(cfg, policy, i + 1, v, prevFiles.slice(), T?.file), stat, 'campaign'));
    }
    TR.path.pop();
  });
  const prevC: any[] = [];
  const prevB: any[] = [];
  for (const k of CLASSIC_KEYS) {
    const c = data[k];
    TR.path.push(k);
    R('presence');
    w.bit(!!c);
    if (c) {
      const isBL = k.startsWith('smbc-classic-file-');
      const prev = isBL ? prevB : prevC;
      const out = encSection(w, classicCands(cfg, policy, k, c, prev.slice(), ctx), stat, isBL ? 'bl' : 'classic');
      prev.push(out);
    }
    TR.path.pop();
  }
  return w.bits;
}
export function decodeProfile(bits: number[], policy: Policy, cfg: Cfg, padTo: number, reader?: BitReader): any {
  const r = reader ?? new BitReader(bits);
  let T: (typeof WHOLE_T)[number] | undefined;
  if (cfg.wholeK) {
    R('sel');
    const i = r.uint(widthFor(WHOLE_T.length));
    T = WHOLE_T[i];
    if (!T) throw new CodeFormatError('bad template');
  }
  const out: any = {};
  const ctx: any = {};
  TR.path.push('smbc.settings');
  R('presence');
  if (r.bit()) {
    const groups = SETTINGS_GROUPS(sch(policy).settings);
    const s: any = {};
    for (const g of ['device', 'options', 'achieve'] as const) {
      if (!groups[g].length) continue;
      Object.assign(s, decSection(r, settingsCands(cfg, policy, g, undefined, T?.settings())));
    }
    out['smbc.settings'] = s;
    ctx.settings = s;
  }
  TR.path.pop();
  TR.path.push('smbc.progress');
  R('presence');
  if (r.bit()) out['smbc.progress'] = decSection(r, progressCands(cfg, undefined, T?.progress()));
  TR.path.pop();
  const prevFiles: any[] = [];
  SAVE_KEYS.forEach((k, i) => {
    TR.path.push(k);
    R('presence');
    if (r.bit()) {
      const f = decSection(r, campaignCands(cfg, policy, i + 1, undefined, prevFiles.slice(), T?.file));
      prevFiles.push(f);
      out[k] = f;
    }
    TR.path.pop();
  });
  const prevC: any[] = [];
  const prevB: any[] = [];
  for (const k of CLASSIC_KEYS) {
    TR.path.push(k);
    R('presence');
    if (r.bit()) {
      const isBL = k.startsWith('smbc-classic-file-');
      const prev = isBL ? prevB : prevC;
      const c = decSection(r, classicCands(cfg, policy, k, undefined, prev.slice(), ctx));
      prev.push(c);
      out[k] = c;
    }
    TR.path.pop();
  }
  if (r.left >= padTo || bits.slice(r.pos).some((b) => b)) throw new CodeFormatError('trailing bits');
  return out;
}

/** The comparison form: every record as its schema keeps it, sets in dictionary order. */
export function finalCanon(data: any, policy: Policy): any {
  const S = sch(policy);
  const out: any = {};
  for (const [k, x] of Object.entries(data)) {
    if (!x) continue;
    if (k === 'smbc.settings') out[k] = canon(S.settings, pickFields(x, names(S.settings)));
    else if (k === 'smbc.progress') out[k] = canon(progressSchema, x);
    else if (k.startsWith('smbc.save.')) out[k] = canon(S.saveBody, pickFields(x, names(S.saveBody)));
    else if (k.startsWith('smbc-classic-resume-')) out[k] = canon(S.resBody, x);
    else out[k] = canon(S.blBody, x);
  }
  return out;
}

// ------------------------------------------------------------------ framing (Base64url profile envelope: 'P' + version, flags, CRC-32, payload)

/** The b64 envelope: flags byte bit0 = deflate, bits 1-3 = method (0 = round-1 hybrid, 1 = adaptive): no extra bytes. */
export function b64Len(bits: number[], deflate: boolean): { len: number; deflated: boolean } {
  const bytes = bitsToBytes(bits);
  const plain = packB64(bytes, false).length;
  if (!deflate) return { len: plain, deflated: false };
  const z = packB64(deflateRawSync(bytes, { level: 9 }), true).length;
  return z < plain ? { len: z, deflated: true } : { len: plain, deflated: false };
}

const D = { deflate: true };
export const CONFIGS: Cfg[] = [
  CFG('A. single-K, round-2 delta ops', [], D),
  CFG('B. whole-profile multi-K (one selector)', [], { wholeK: true, deflate: true }),
  CFG('C. per-section multi-K', ['multiK'], D),
  CFG('D. C + campaign codec + round-1 reps', ['multiK', 'codec', 'r1'], D),
  CFG('E. base + codec + r1 (round-2 delta ops only)', ['codec', 'r1'], D),
  CFG('F. E + cross-slot', ['codec', 'r1', 'cross'], D),
  CFG('G. D + modular/derived refs', ['multiK', 'codec', 'r1', 'modular', 'derived'], D),
  CFG('K. D + cross-slot (no modular)', ['multiK', 'codec', 'r1', 'cross'], D),
  CFG('M. minimal: codec + r1 + 100% templates + cross-slot', ['codec', 'r1', 'fullK', 'cross'], D),
  CFG('H. adaptive: everything', ['multiK', 'codec', 'r1', 'modular', 'derived', 'cross'], D),
];
const ADAPTIVE = 'H. adaptive: everything';

// ------------------------------------------------------------------ the run

const stats = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const q = (f: number) => s[Math.min(s.length - 1, Math.floor(f * (s.length - 1)))] as number;
  return { n: s.length, min: s[0] as number, median: q(0.5), p95: q(0.95), max: s[s.length - 1] as number };
};

export async function run(): Promise<string> {
  const results: any = { sections: {}, groups: {}, named: {}, wins: {}, stat: {}, perFile: {}, timing: {}, tables: {}, regressions: {}, heuristic: {} };
  const { scenario: sampleSc } = sampleScenario(SAMPLE);
  const named = [...scenarios(), sampleSc];
  const pct: Scenario[] = [];
  for (const p of [0.1, 0.25, 0.5, 0.75, 0.9, 0.99, 1]) for (const mode of ['seq', 'scatter'] as const) for (let i = 0; i < (p === 1 ? 5 : 15); i++) pct.push(pctProfile(p, mode, 9000 + Math.round(p * 1000) * 37 + i * 101 + (mode === 'seq' ? 0 : 7)));
  const rand = randomScenarios(200);
  const corpora: Record<string, Scenario[]> = { named, random200: rand, progressPct: pct };

  const policies: Policy[] = ['semantic', 'portable'];
  const loaderBudget = { n: 0 };
  for (const [cname, corpus] of Object.entries(corpora)) {
    for (const shape of ['current', 'bl'] as const) {
      for (const policy of policies) {
        const gkey = `${cname}/${shape}/${policy}`;
        const rows: Record<string, number[]> = { r1: [] };
        const winRows: Record<string, { shorter: number; equal: number; longer: number }> = {};
        const st: Record<string, Record<string, number>> = {};
        for (const sc of corpus) {
          const data = applyPolicy(sc[shape], policy);
          // round-1 hybrid (best of raw / deflate)
          const t0 = performance.now();
          const r1bits = hybridBits(data, policy);
          const r1 = b64Len(r1bits, true);
          const t1 = performance.now();
          const r1back = hybridFromBits(r1bits, policy, 8);
          const t2 = performance.now();
          (results.timing.r1_enc ??= []).push(t1 - t0);
          (results.timing.r1_dec ??= []).push(t2 - t1);
          void r1back;
          rows.r1!.push(r1.len);
          if (cname === 'named') (results.named[`${sc.name}/${shape}/${policy}`] ??= {}).r1 = r1.len;
          const want = finalCanon(data, policy);
          for (const cfg of CONFIGS) {
            const stat = (st[cfg.name] ??= {});
            const e0 = performance.now();
            const bits = encodeProfile(data, policy, cfg, stat, cfg.name === ADAPTIVE && policy === 'semantic' && cname !== 'named' ? (results.sections[`${cname}/${shape}`] ??= {}) : undefined);
            const len = b64Len(bits, !!cfg.deflate);
            const e1 = performance.now();
            // decode through the envelope it would ship in
            const bytes = bitsToBytes(bits);
            const code = len.deflated ? packB64(deflateRawSync(bytes, { level: 9 }), true) : packB64(bytes, false);
            const u = unpackB64(code);
            let back: any = null;
            try {
              if (u.ok) back = decodeProfile(bytesToBits(u.deflated ? inflateRawSync(u.payload) : u.payload), policy, cfg, 8);
            } catch (e) {
              back = null;
              if (failures.length < 5) failures.push(`${gkey} ${cfg.name} ${sc.name}: ${(e as Error).message}`);
            }
            const e2 = performance.now();
            if (cfg.name === ADAPTIVE) {
              (results.timing.adaptive_enc ??= []).push(e1 - e0);
              (results.timing.adaptive_dec ??= []).push(e2 - e1);
            }
            check(!!back && deepEq(finalCanon(back, policy), want), `${gkey} ${cfg.name} ${sc.name}: round trip`);
            // loader-level equality on the current shape (B-L has no loader): named + every 4th profile
            if (back && shape === 'current' && cfg.name === ADAPTIVE && (cname === 'named' || loaderBudget.n++ % 4 === 0)) {
              const b2 = structuredClone(back);
              if (policy === 'portable' && b2['smbc.settings']) {
                const d = defaultSettings() as any;
                for (const k of DEVICE_FIELDS) b2['smbc.settings'][k] = d[k];
              }
              const a = normaliseLoaded(loadAll(sc[shape]), policy);
              const b = normaliseLoaded(loadAll(b2), policy);
              check(deepEq(canonLoaded(a), canonLoaded(b)), `${gkey} ${sc.name}: loader-level equality`);
            }
            (rows[cfg.name] ??= []).push(len.len);
            const wr = (winRows[cfg.name] ??= { shorter: 0, equal: 0, longer: 0 });
            if (len.len < r1.len) wr.shorter++;
            else if (len.len === r1.len) wr.equal++;
            else wr.longer++;
            if (cname === 'named') (results.named[`${sc.name}/${shape}/${policy}`] ??= {})[cfg.name] = len.len;
          }
          // the shipped encoder: adaptive or round 1, whichever is shorter (a flags-byte value, 0 extra bytes)
          for (const c of CONFIGS) {
            const x = Math.min(rows[c.name]!.at(-1) as number, r1.len);
            (rows[`${c.name.slice(0, 2)} guarded min(_, r1)`] ??= []).push(x);
          }
          const ad = rows[ADAPTIVE]!.at(-1) as number;
          (rows['J. shipped = min(I, r1)'] ??= []).push(Math.min(ad, r1.len));
          const wr = (winRows['J. shipped = min(I, r1)'] ??= { shorter: 0, equal: 0, longer: 0 });
          if (Math.min(ad, r1.len) < r1.len) wr.shorter++;
          else wr.equal++;
          if (cname === 'named') (results.named[`${sc.name}/${shape}/${policy}`] ??= {}).shipped = Math.min(ad, r1.len);
        }
        results.groups[gkey] = Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, stats(v)]));
        results.wins[gkey] = winRows;
        results.stat[gkey] = st;
        // savings of the shipped encoder vs round 1, in %
        const r1s = rows.r1!;
        const sh = rows['J. shipped = min(I, r1)']!;
        results.groups[gkey].saving_pct = stats(r1s.map((x, i) => (100 * (x - (sh[i] as number))) / x));
      }
    }
  }

  // ---- by completion percentage (semantic, current shape and B-L), median per p
  results.byPct = {};
  for (const shape of ['current', 'bl'] as const) {
    for (const p of [10, 25, 50, 75, 90, 99, 100])
      for (const mode of ['seq', 'scatter']) {
        const sub = pct.filter((s) => s.name.startsWith(`${p}% ${mode}`));
        const r1: number[] = [];
        const ad: number[] = [];
        for (const sc of sub) {
          const data = applyPolicy(sc[shape], 'semantic');
          const a = b64Len(hybridBits(data, 'semantic'), true).len;
          r1.push(a);
          ad.push(Math.min(a, b64Len(encodeProfile(data, 'semantic', CONFIGS.find((c) => c.name === ADAPTIVE)!, {}), true).len));
        }
        results.byPct[`${shape} ${p}% ${mode}`] = { r1: stats(r1).median, shipped: stats(ad).median, n: sub.length };
      }
  }

  // ---- per-file codes (typed codes): campaign and Classic
  {
    const files: any[] = [];
    for (const sc of [...named, ...pct, ...rand.slice(0, 60)]) for (const k of SAVE_KEYS) if (sc.current[k]) files.push(sc.current[k]);
    const rng = new Rng(5);
    for (const p of [0.1, 0.25, 0.5, 0.75, 0.9, 0.99, 1]) for (let i = 0; i < 10; i++) files.push(campaignAt(rng, 1, p, i % 2 ? 'seq' : 'scatter'));
    const body = sch('semantic').saveBody;
    const methods = [
      ['fresh', CAMPAIGN_WHOLE(1, FILE_T.fresh!)],
      ['half', CAMPAIGN_WHOLE(1, FILE_T.half!)],
      ['smb', CAMPAIGN_WHOLE(1, FILE_T.smb!)],
      ['full', CAMPAIGN_WHOLE(1, FILE_T.full!)],
      ['modular', CAMPAIGN_MODULAR(1)],
    ] as const;
    const existing: number[] = [];
    const neu: number[] = [];
    const shipped: number[] = [];
    const won: Record<string, number> = {};
    let wins = 0;
    for (const f0 of files) {
      const f = { ...f0, slot: 1 };
      const v = pickFields(f, names(body));
      const ex = (cleanCode(encodeSaveCode(f)) as string).length;
      // the new per-file kind: version 4 (EG0 = 5 bits, vs 3 for version 3), CRC-16, method selector, payload
      let best: number[] | null = null;
      let bi = 0;
      methods.forEach(([, stg], i) => {
        const b = bitsOf((w) => encStaged(w, body, stg as unknown as Stage[], v, {}, `pf:${i}`));
        if (!best || b.length < best.length) {
          best = b;
          bi = i;
        }
      });
      const payload = [...bitsOf((w) => w.uint(widthFor(methods.length), bi)), ...(best as unknown as number[])];
      const head = 5 + 16;
      const nl = Math.ceil((head + payload.length) / 5);
      // round trip of the chosen method (without the score, which the existing code also leaves out, the comparison keeps it: stricter)
      const back = decStaged(new BitReader(best as unknown as number[]), body, methods[bi]![1] as unknown as Stage[], {}, `pf:${bi}`);
      check(deepEq(canon(body, back), canon(body, v)), 'per-file campaign round trip');
      {
        const sub = [0, 3].map((i) => bitsOf((w) => encStaged(w, body, methods[i]![1] as unknown as Stage[], v, {}, `pf:${i}`)).length);
        const nl2 = Math.ceil((5 + 16 + 1 + Math.min(...sub)) / 5);
        (results.perFile.subsetLens ??= []).push(Math.min(ex, nl2));
        if (nl2 < ex) results.perFile.subsetWins = (results.perFile.subsetWins ?? 0) + 1;
      }
      existing.push(ex);
      neu.push(nl);
      shipped.push(Math.min(ex, nl));
      if (nl < ex) {
        wins++;
        won[methods[bi]![0]] = (won[methods[bi]![0]] ?? 0) + 1;
      }
    }
    results.perFile.subset_fresh_full = { shipped_min: stats(results.perFile.subsetLens), wins_pct: +((100 * (results.perFile.subsetWins ?? 0)) / files.length).toFixed(1) };
    delete results.perFile.subsetLens;
    results.perFile.campaign = {
      files: files.length,
      note: 'new kind keeps score (existing code drops it); existing codes stay valid',
      existing: stats(existing),
      new_kind: stats(neu),
      shipped_min: stats(shipped),
      new_wins_pct: +((100 * wins) / files.length).toFixed(1),
      won_by_method: won,
    };
    // Classic per-file: round-1 slot code vs adaptive (no cross-slot: one file alone)
    const cl: { r1: number[]; ad: number[]; shapes: string[] } = { r1: [], ad: [], shapes: [] };
    let cw = 0;
    let cn = 0;
    for (const sc of [...named, ...pct, ...rand.slice(0, 60)])
      for (const k of CLASSIC_KEYS) {
        const shape = k.startsWith('smbc-classic-file-') ? 'bl' : 'current';
        const v0 = sc[shape][k];
        if (!v0) continue;
        const v = { ...v0 };
        delete v.savedAt;
        const keyed = shape === 'bl' ? sch('semantic').bl : sch('semantic').res;
        const r1 = slotCode(KIND.classic, keyed, v).length;
        const cands = classicCands(CFG('pf', ['r1', 'modular']), 'semantic', k, v, [], {});
        let best: number[] | null = null;
        cands.forEach((c) => {
          const b = [...bitsOf((w) => w.uint(widthFor(cands.length), cands.indexOf(c))), ...bitsOf(c.enc)];
          if (!best || b.length < best.length) best = b;
        });
        const code = packB32(KIND.classic, best as unknown as number[], 16);
        const u = unpackB32(code, 16);
        let back: any = null;
        if (u.ok) back = decSection(u.r, cands);
        check(!!back && deepEq(canon(keyed.body, back), canon(keyed.body, v)), 'per-file classic round trip');
        cl.r1.push(r1);
        cl.ad.push(Math.min(r1, code.length));
        cn++;
        if (code.length < r1) cw++;
      }
    results.perFile.classic = { slots: cn, r1: stats(cl.r1), shipped_min: stats(cl.ad), new_wins_pct: +((100 * cw) / cn).toFixed(1) };
    void slotDecode;
  }

  // ---- references that make codes longer: forced template vs K0, and the "closest by differences" heuristic
  {
    const body = sch('semantic').saveBody;
    const leaves = (o: any, pre = ''): string[] => {
      if (Array.isArray(o)) return o.map((x) => `${pre}∋${JSON.stringify(x)}`);
      if (o && typeof o === 'object') return Object.entries(o).flatMap(([k, x]) => leaves(x, `${pre}.${k}`));
      return [`${pre}=${JSON.stringify(o)}`];
    };
    const diffCount = (a: any, b: any) => {
      const A = new Set(leaves(a));
      const B = new Set(leaves(b));
      let n = 0;
      for (const x of A) if (!B.has(x)) n++;
      for (const x of B) if (!A.has(x)) n++;
      return n;
    };
    let total = 0;
    let longerThanK0: Record<string, number> = {};
    let heurMiss = 0;
    let heurExcess = 0;
    let maxExcess = 0;
    let forcedFullOnFresh = 0;
    for (const sc of [...named, ...pct, ...rand])
      for (const k of SAVE_KEYS) {
        const f = sc.current[k];
        if (!f) continue;
        const v = pickFields({ ...f, slot: 1 }, names(body));
        total++;
        const L: Record<string, number> = {};
        for (const t of ['fresh', 'half', 'smb', 'full']) L[t] = bitsOf((w) => encStaged(w, body, CAMPAIGN_WHOLE(1, FILE_T[t]!), v, {}, `h:${t}`)).length;
        for (const t of ['half', 'smb', 'full']) if ((L[t] as number) > (L.fresh as number)) longerThanK0[t] = (longerThanK0[t] ?? 0) + 1;
        const best = Math.min(...Object.values(L));
        const h = ['fresh', 'half', 'smb', 'full'].map((t) => [t, diffCount(v, FILE_T[t]!(v))] as const).sort((a, b) => a[1] - b[1])[0]![0];
        const ex = (L[h] as number) - best;
        if (ex > 0) {
          heurMiss++;
          heurExcess += ex;
          maxExcess = Math.max(maxExcess, ex);
        }
        if ((v.cleared?.length ?? 0) <= 6) forcedFullOnFresh = Math.max(forcedFullOnFresh, (L.full as number) - (L.fresh as number));
      }
    results.regressions.campaign_templates = {
      files: total,
      template_longer_than_fresh_pct: Object.fromEntries(Object.entries(longerThanK0).map(([t, n]) => [t, +((100 * n) / total).toFixed(1)])),
      worst_full_template_on_near_fresh_file_bits: forcedFullOnFresh,
      closest_by_field_differences_not_optimal_pct: +((100 * heurMiss) / total).toFixed(1),
      closest_heuristic_mean_excess_bits_when_wrong: heurMiss ? +(heurExcess / heurMiss).toFixed(1) : 0,
      closest_heuristic_max_excess_bits: maxExcess,
    };
  }

  // ---- static reference tables added to the bundle (frozen JSON, as they would ship)
  {
    const tbl = (o: any) => {
      const s = JSON.stringify(o);
      return { json_bytes: Buffer.byteLength(s), gzip_bytes: gzipSync(s, { level: 9 }).length };
    };
    const h = { slot: 1, character: 'mario', character2: null };
    const fileTemplates = { half: FILE_T.half!(h), smb: FILE_T.smb!(h), full: FILE_T.full!(h) };
    const kitTables = Object.fromEntries(HEROES.map((x) => [x, { basic: heroBasic(x), full: heroFull(x) }]));
    results.tables = {
      round1_K_new_dictionaries: tbl({ CLASSIC_HEROES, CLASSIC_LEVELS, NODES, KIT_KEYS, KEY_CODES }),
      round1_K_defaults_snapshot: tbl({ s: defaultSettings(), p: progressDefault(), f: newSave(1, 'mario') }),
      round2_file_templates_half_smb_full: tbl(fileTemplates),
      round2_hero_kit_tables_basic_full: tbl(kitTables),
      round2_settings_progress_templates: tbl({ s: allUnlockedSettings().classicCheats, p: allDoneProgress() }),
      note: 'templates as frozen JSON; derived refs also need frozen copies of metIds / upgradeStory logic (code, not data)',
    };
  }

  // ---- timing summaries
  for (const k of Object.keys(results.timing)) results.timing[k] = Object.fromEntries(Object.entries(stats(results.timing[k])).map(([a, b]) => [a, typeof b === 'number' ? +b.toFixed(2) : b]));

  // ---- negative control: a corrupted reference choice must not decode to the same profile
  {
    const data = applyPolicy(named[2]!.current, 'semantic');
    const bits = encodeProfile(data, 'semantic', CONFIGS.find((c) => c.name === ADAPTIVE)!, {});
    let differs = 0;
    let threw = 0;
    for (let i = 0; i < 400; i++) {
      const b = bits.slice();
      const j = (i * 7919) % b.length;
      b[j] = b[j] ? 0 : 1;
      try {
        const back = decodeProfile(b, 'semantic', CONFIGS.find((c) => c.name === ADAPTIVE)!, 8);
        if (!deepEq(finalCanon(back, 'semantic'), finalCanon(data, 'semantic'))) differs++;
      } catch {
        threw++;
      }
    }
    results.negative_control_bitflips_without_crc = { flips: 400, threw, decoded_different: differs, decoded_same: 400 - threw - differs };
  }


  // ---- cross-slot on 9-file B-L profiles (DESIGN shape) under three correlation regimes, Classic-only profiles
  {
    const KK = (KIT_KEYS as string[]).filter((k) => !k.startsWith('has-'));
    const ROW: Record<string, readonly unknown[]> = {
      lives: [1, 3, 5, 7, 10], attack: ['very-weak', 'weak', 'normal', 'strong', 'very-strong'], whenHit: ['lose-everything', 'previous-state', 'instant-death'],
      drops: ['very-low', 'low', 'normal', 'high', 'very-high'], piranhas: ['some', 'all', 'green-some', 'green-all', 'red-some', 'red-all'], goombas: ['off', 'buzzy', 'spiny', 'spike-top'], enemySpeed: ['normal', 'fast'],
    };
    const randRules = (g: Rng) => ({
      difficulty: (['easy', 'normal', 'hard'] as const)[g.int(3)],
      gameMode: (['all', 'survival', 'single', 'single-random'] as const)[g.int(4)],
      more: Object.fromEntries(Object.entries(ROW).map(([k, vals]) => [k, g.chance(0.5) ? 'original' : vals[g.int(vals.length)]])),
      weapons: g.chance(0.5) ? {} : { samus: 'ice', link: g.chance(0.5) ? 'bow' : 'bomb' },
      disabled: CLASSIC_HEROES.filter(() => g.chance(0.05)),
    });
    const randKits = (g: Rng, heroes: string[]) => Object.fromEntries(heroes.map((h) => [h, { powerState: ['small', 'big', 'fire'][g.int(3)], hp: g.int(4), kit: Object.fromEntries(Array.from({ length: 1 + g.int(3) }, () => [KK[g.int(KK.length)], g.int(61)])) }]));
    const LV = CLASSIC_LEVELS.filter((l) => /^(\d|sp-|ll-)/.test(l) && !l.includes('bonus'));
    const make = (regime: string, seed: number) => {
      const g = new Rng(seed);
      const data: any = {};
      for (const set of ['smb', 'special', 'lost']) {
        const shared = randRules(g);
        const sharedHeroes = CLASSIC_HEROES.filter(() => g.chance(0.4));
        const sharedKits = randKits(g, sharedHeroes);
        const n = 1 + g.int(3);
        for (let i = 1; i <= n; i++) {
          const heroes = regime === 'independent' || regime === 'shared-rules' ? CLASSIC_HEROES.filter(() => g.chance(0.4)) : sharedHeroes;
          let kits = regime === 'shared-all' ? structuredClone(sharedKits) : randKits(g, heroes);
          if (regime === 'shared-all') for (const h of Object.keys(kits)) if (g.chance(0.3)) kits[h].kit = Object.fromEntries(Object.entries(kits[h].kit).map(([k]) => [k, g.int(61)]));
          data[`smbc-classic-file-${set}-${i}`] = {
            v: 1, levelId: LV[g.int(LV.length)], hero: CLASSIC_HEROES[g.int(CLASSIC_HEROES.length)], score: g.int(2_000_000), coins: g.int(100), lives: 1 + g.int(9),
            powerState: ['small', 'big', 'fire'][g.int(3)], hp: g.int(4), kit: {}, heroKits: kits, checkpoint: g.chance(0.5) ? { x: g.int(300), y: 12 } : null, continues: g.int(5),
            rules: regime === 'independent' ? randRules(g) : structuredClone(shared),
          };
        }
      }
      return data;
    };
    results.crossSlotBL = {};
    for (const regime of ['independent', 'shared-rules', 'shared-all']) {
      const rows: Record<string, number[]> = {};
      for (let i = 0; i < 60; i++) {
        const data = make(regime, 777 + i);
        const want = finalCanon(data, 'semantic');
        const r1 = b64Len(hybridBits(data, 'semantic'), true).len;
        (rows.r1 ??= []).push(r1);
        for (const name of ['E. base + codec + r1 (round-2 delta ops only)', 'F. E + cross-slot', ADAPTIVE]) {
          const cfg = CONFIGS.find((c) => c.name === name)!;
          const bits = encodeProfile(data, 'semantic', cfg, {});
          const back = decodeProfile(bits, 'semantic', cfg, 8);
          check(deepEq(finalCanon(back, 'semantic'), want), `crossSlotBL ${regime} ${name}`);
          (rows[name] ??= []).push(Math.min(r1, b64Len(bits, true).len));
        }
      }
      results.crossSlotBL[regime] = Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, stats(v)]));
    }
  }

  results.checks = { total: checks, failed: failures.length, failures: failures.slice(0, 30) };
  writeFileSync(`${DIR}/results2.json`, JSON.stringify(results, null, 2));
  return JSON.stringify(results.checks);
}
