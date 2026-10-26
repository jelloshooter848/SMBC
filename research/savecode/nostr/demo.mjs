/*
 * Research only. Backs a save up under a short code and restores it with nothing but the code.
 *   node demo.mjs --local                      in-process relays (protocol checks only)
 *   node demo.mjs wss://relay.damus.io wss://nos.lol …   real relays (needs network access to them)
 * Writes results-local.json or results-live.json next to this file.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import WebSocket from 'ws';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { backup, CODE_CHARS, keysFromCode, makeBackupEvent, MAX_SAVE_BYTES, newBackupCode, normalizeCode, openBackupEvent, restore, SCRYPT } from './backup.mjs';
import { startRelay } from './local-relay.mjs';
import { finalizeEvent, generateSecretKey } from 'nostr-tools/pure';

const HERE = new URL('.', import.meta.url).pathname;
const args = process.argv.slice(2);
const local = args.includes('--local');
const out = { mode: local ? 'local in-process relays (protocol checks, not real relays)' : 'live relays', checks: [] };
let failed = 0;
const check = (ok, what, detail) => {
  out.checks.push({ ok, what, ...(detail ? { detail } : {}) });
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `  ${JSON.stringify(detail)}` : ''}`);
};

// The two kinds of save text: the synthetic whole-profile JSON file, and the 2,941-char `z` string made from it.
const saveFile = readFileSync(`${HERE}../sample/sample-save.json`, 'utf8');
const saveString = readFileSync(`${HERE}../sample/sample-save-code.txt`, 'utf8').trim();
out.saves = { file_bytes: Buffer.byteLength(saveFile), string_chars: saveString.length };

// ---- the code
const code = newBackupCode();
out.code_example = code;
check(normalizeCode(code)?.length === CODE_CHARS, 'a new code has 10 characters', { code });
const sloppy = code.toLowerCase().replace('-', ' ').replace(/0/g, 'o').replace(/1/g, 'l');
check(normalizeCode(sloppy) === normalizeCode(code), 'typed loosely (lower case, space, O for 0, L for 1) it is the same code', { typed: sloppy });
check(normalizeCode('ABCD') === null && normalizeCode('ABCDE-FGHIJU') === null, 'too short, or a character outside the alphabet, is not a code');

// ---- key derivation cost (what one guess costs an attacker per core)
{
  const t0 = performance.now();
  for (let i = 0; i < 3; i++) await keysFromCode(newBackupCode());
  const ms = (performance.now() - t0) / 3;
  out.scrypt = { params: SCRYPT, memory_mb: (128 * SCRYPT.N * SCRYPT.r) / 2 ** 20, ms_per_derive_node: +ms.toFixed(0) };
  const bits = CODE_CHARS * 5;
  out.guessing = {
    code_bits: bits,
    note: 'brute force needs one scrypt per guess; the per-core rate is from this machine, a GPU farm can be thousands of times faster',
    years_per_core_to_search_all_codes: +((2 ** bits * ms) / 1000 / 3600 / 24 / 365).toExponential(2),
  };
  console.log('scrypt', out.scrypt);
}

// ---- events and sizes
for (const [name, text] of [['file', saveFile], ['string', saveString]]) {
  const ev = await makeBackupEvent(code, text);
  out[`event_bytes_${name}`] = Buffer.byteLength(JSON.stringify(ev));
  check((await openBackupEvent(code, ev)) === text, `the ${name} save survives encrypt + sign + verify + decrypt`, { event_bytes: out[`event_bytes_${name}`] });
}
check(await makeBackupEvent(code, 'x'.repeat(MAX_SAVE_BYTES + 1)).then(() => false, () => true), 'a save over the size cap is refused before upload');

// ---- relays
let relays;
let W = WebSocket;
const servers = [];
if (local) {
  for (const o of [{}, {}, { refuseWrites: true }]) servers.push(await startRelay(o));
  relays = [...servers.map((s) => s.url), 'ws://127.0.0.1:1']; // the last one is down
} else {
  relays = args.filter((a) => a.startsWith('ws'));
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (proxy) {
    const agent = new HttpsProxyAgent(proxy);
    W = class extends WebSocket {
      constructor(url) {
        super(url, { agent });
      }
    };
  }
}
const opts = { WebSocket: W, timeoutMs: local ? 2000 : 10000 };
out.relays = relays;

const now = Math.floor(Date.now() / 1000);
const up = await backup(code, saveFile, relays, { ...opts, now });
out.upload = up.results;
check(up.ok, 'upload accepted by at least one relay', up.results.map((r) => `${r.url} ${r.ok ? 'OK' : r.message}`));

// a "new device": nothing but the code
const t0 = performance.now();
const back = await restore(sloppy, relays, opts);
out.restore_ms = +(performance.now() - t0).toFixed(0);
check(back.best?.saveText === saveFile, 'restore with only the code gives the file back byte for byte', { from: back.best?.from, ms: out.restore_ms });

// the same code again later: the newer upload replaces the older one
const up2 = await backup(code, saveString, relays, { ...opts, now: now + 60 });
check(up2.ok, 'a second upload under the same code is accepted');
const back2 = await restore(code, relays, opts);
check(back2.best?.saveText === saveString, 'restore gives the newest upload');

// a mistyped code finds nothing (it is a different key)
const wrong = normalizeCode(code).replace(/^./, (c) => (c === 'A' ? 'B' : 'A'));
check((await restore(wrong, relays, opts)).best === null, 'a mistyped code finds no backup (it derives a different key)');

if (local) {
  // a relay serving junk under the same author and tag: a forged signature and a foreign key are both ignored
  const { pk } = await keysFromCode(code);
  const real = await makeBackupEvent(code, 'tampered', now + 120);
  servers[0].inject({ ...real, content: real.content.replace(/^.{8}/, 'AAAAAAAA') });
  const foreign = finalizeEvent({ kind: 30078, created_at: now + 180, tags: [['d', 'smbc-remix/backup/v1']], content: 'x' }, generateSecretKey());
  servers[0].inject({ ...foreign, pubkey: pk });
  check((await restore(code, relays, opts)).best?.saveText === saveString, 'tampered or forged events on a relay are rejected; the real backup still restores');
  // relays that pruned: one gone still restores, all gone does not
  servers[0].prune();
  check((await restore(code, relays, opts)).best?.saveText === saveString, 'one relay pruned it: another relay still has it');
  servers[1].prune();
  check((await restore(code, relays, opts)).best === null, 'every relay pruned it: the backup is gone (the local code must stay the real backup)');
  for (const s of servers) await s.close();
}

out.failed = failed;
writeFileSync(`${HERE}results-${local ? 'local' : 'live'}.json`, JSON.stringify(out, null, 2));
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
