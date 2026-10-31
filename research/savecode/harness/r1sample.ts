/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { hybridBits, hybridFromBits, packB64, unpackB64, campaignCanon, SAVE_KEYS } from './bench';
import { applyPolicy, profileSchema } from './schema';
import { bitsToBytes, bytesToBits, canon, deepEq } from './codec';
import { installTrace, callsOf, callBits } from './trace';
installTrace();
export async function run() {
  const sample = JSON.parse(readFileSync(new URL('../sample/sample-save.json', import.meta.url), 'utf8'));
  const data = applyPolicy(sample.data, 'semantic');
  const bits = hybridBits(data, 'semantic');
  const bytes = bitsToBytes(bits);
  const raw = packB64(bytes, false);
  const z = packB64(new Uint8Array(deflateRawSync(bytes, { level: 9 })), true);
  // round trip both
  const strip = (d: any) => { const x: any = { ...d }; for (const k of SAVE_KEYS) delete x[k]; return canon(profileSchema('semantic'), x); };
  const ok = (code: string) => { const u: any = unpackB64(code); const b = hybridFromBits(bytesToBits(u.deflated ? inflateRawSync(u.payload) : u.payload), 'semantic', 8); return deepEq(strip(b), strip(data)) && SAVE_KEYS.every((k) => deepEq(campaignCanon(b[k]), campaignCanon(data[k]))); };
  // per-call bit positions → record / field
  const rows: any[] = []; let pos = 0;
  for (const c of callsOf(bits)) { const n = callBits(c); rows.push({ from: pos, to: pos + n, path: c.g, role: c.r }); pos += n; }
  writeFileSync('/tmp/claude-0/-home-user-SMBC/32ef1390-71bf-5f92-bbc5-d316f35f9eac/scratchpad/r1sample.json', JSON.stringify({ bits: bits.length, raw, z, rawOk: ok(raw), zOk: ok(z), rows }, null, 0));
  return 'see results.json';
}
