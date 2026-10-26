/*
 * Research only. Backs a save up under a short code and restores it with nothing but the code.
 *   node demo.mjs --local                      in-process relays (protocol checks only)
 *   node demo.mjs wss://relay.damus.io wss://nos.lol …   real relays (needs network access to them)
 *   node demo.mjs --restore CODE [CODE…] wss://…     restore only, no upload: which relays still have it
 * Writes results-local.json, results-live.json or (appending) results-retention.json next to this file.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import WebSocket from 'ws';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { backup, backupFilter, CODE_CHARS, keysFromCode, makeBackupEvent, MAX_SAVE_BYTES, newBackupCode, normalizeCode, openBackupEvent, publish, query, restore, SCRYPT } from './backup.mjs';
import { startRelay } from './local-relay.mjs';
import { finalizeEvent, generateSecretKey } from 'nostr-tools/pure';

const HERE = new URL('.', import.meta.url).pathname;
const args = process.argv.slice(2);
const local = args.includes('--local');
const sha = (t) => createHash('sha256').update(t).digest('hex').slice(0, 16);

// Live relays are reached through HTTPS_PROXY when one is set (as in this container).
let W = WebSocket;
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
if (!local && proxy) {
  const agent = new HttpsProxyAgent(proxy);
  W = class extends WebSocket {
    constructor(url) {
      super(url, { agent });
    }
  };
}

// ---- restore only: no upload, one row per code and relay (retention re-checks)
if (args[0] === '--restore') {
  const codes = args.slice(1).filter((a) => !a.startsWith('ws'));
  const urls = args.filter((a) => a.startsWith('ws'));
  const live = existsSync(`${HERE}results-live.json`) ? JSON.parse(readFileSync(`${HERE}results-live.json`, 'utf8')) : {};
  const run = { at: new Date().toISOString(), rows: [] };
  for (const code of codes) {
    const known = [...(live.backups ?? []), ...(live.earlier_backups ?? [])].find((b) => normalizeCode(b.code) === normalizeCode(code));
    const answers = await query(urls, await backupFilter(code), { WebSocket: W, timeoutMs: 10000 });
    for (const a of answers) {
      let found = null;
      for (const ev of a.events) {
        const text = await openBackupEvent(code, ev);
        if (text !== null && (!found || ev.created_at > found.created_at)) found = { created_at: ev.created_at, sha256_16: sha(text), bytes: Buffer.byteLength(text) };
      }
      const row = {
        code,
        save: known?.save,
        relay: a.url,
        still_there: !!found,
        ...(found ?? {}),
        ...(known && found ? { matches_upload: found.sha256_16 === known.sha256_16, hours_since_upload: +((Date.now() / 1000 - known.uploaded_at) / 3600).toFixed(2) } : {}),
        ms: a.ms,
        ...(a.error ? { error: a.error } : {}),
        ...(a.notices ? { notices: a.notices } : {}),
      };
      run.rows.push(row);
      console.log(`${row.still_there ? 'kept' : 'GONE'} ${code} ${a.url}${a.error ? ` (${a.error})` : ''}${row.hours_since_upload != null ? ` ${row.hours_since_upload} h after upload` : ''}`);
    }
  }
  const file = `${HERE}results-retention.json`;
  const all = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  all.push(run);
  writeFileSync(file, JSON.stringify(all, null, 2));
  process.exit(0);
}

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
const servers = [];
if (local) {
  for (const o of [{}, {}, { refuseWrites: true }]) servers.push(await startRelay(o));
  relays = [...servers.map((s) => s.url), 'ws://127.0.0.1:1']; // the last one is down
} else {
  relays = args.filter((a) => a.startsWith('ws'));
}
const opts = { WebSocket: W, timeoutMs: local ? 2000 : 10000 };
out.relays = relays;

if (!local) await liveRun();

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

finish();
function finish() {
out.failed = failed;
writeFileSync(`${HERE}results-${local ? 'local' : 'live'}.json`, JSON.stringify(out, null, 2));
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
}

/*
 * Live: each relay on its own, so every row says what that relay did. Two codes, so each save size
 * stays on the relays for later retention checks (`--restore`): one keeps the whole JSON file, one the `z` string.
 */
async function liveRun() {
  const codes = { file: code, string: newBackupCode() };
  const texts = { file: saveFile, string: saveString };
  out.backups = [];
  // codes from earlier live runs stay listed, so `--restore` can still match them to their upload
  if (existsSync(`${HERE}results-live.json`)) {
    const prev = JSON.parse(readFileSync(`${HERE}results-live.json`, 'utf8'));
    out.earlier_backups = [...(prev.backups ?? []), ...(prev.earlier_backups ?? [])];
  }
  out.per_relay = Object.fromEntries(relays.map((u) => [u, {}]));
  const now = Math.floor(Date.now() / 1000);
  for (const name of ['file', 'string']) {
    const ev = await makeBackupEvent(codes[name], texts[name], now);
    const results = await publish(relays, ev, opts);
    out.backups.push({ save: name, code: codes[name], event_bytes: Buffer.byteLength(JSON.stringify(ev)), event_id: ev.id, uploaded_at: now, sha256_16: sha(texts[name]) });
    for (const r of results) {
      const row = (out.per_relay[r.url][name] = { accepted: r.ok, message: r.message, publish_ms: r.ms, ...(r.notices ? { notices: r.notices } : {}) });
      // restore from this relay alone, with only the code (key already derived; derive cost is reported separately)
      if (r.ok) {
        const t0 = performance.now();
        const back = await restore(name === 'file' ? sloppy : codes[name], [r.url], opts);
        row.restore_ms = +(performance.now() - t0).toFixed(0);
        row.restored_byte_for_byte = back.best?.saveText === texts[name];
        if (back.answers[0].notices) row.restore_notices = back.answers[0].notices;
      }
    }
    const okCount = results.filter((r) => r.ok).length;
    check(okCount > 0, `the ${name} save (${out.backups.at(-1).event_bytes} B event) is accepted by at least one relay`, results.map((r) => `${r.url} ${r.ok ? 'OK' : r.message}`));
    check(relays.every((u) => !out.per_relay[u][name].accepted || out.per_relay[u][name].restored_byte_for_byte), `every relay that accepted the ${name} save gives it back byte for byte`);
  }

  // every relay together, as the game would: one restore with only the code
  const t0 = performance.now();
  const back = await restore(sloppy, relays, opts);
  out.restore_all_relays_ms = +(performance.now() - t0).toFixed(0);
  check(back.best?.saveText === saveFile, 'restore from all relays at once with only the code', { from: back.best?.from, ms: out.restore_all_relays_ms });

  // replaceable: a newer upload of the string save under its code wins (the file code is left alone for retention checks)
  const ev2 = await makeBackupEvent(codes.string, saveString, now + 60);
  const res2 = await publish(relays, ev2, opts);
  for (const r of res2) out.per_relay[r.url].newer_upload = { accepted: r.ok, message: r.message };
  const back2 = await restore(codes.string, relays.filter((u, i) => res2[i].ok), opts);
  for (const a of back2.answers) out.per_relay[a.url].replaced_by_newer = a.events.some((e) => e.id === ev2.id) && !a.events.some((e) => e.id === out.backups[1].event_id);
  out.backups[1].event_id = ev2.id;
  out.backups[1].uploaded_at = now + 60;
  check(back2.best?.id === ev2.id, 'a newer upload under the same code replaces the older one', Object.fromEntries(back2.answers.map((a) => [a.url, a.events.length + ' event(s)'])));

  const wrong = normalizeCode(code).replace(/^./, (c) => (c === 'A' ? 'B' : 'A'));
  check((await restore(wrong, relays, opts)).best === null, 'a mistyped code finds no backup');
  out.retention_command = `node demo.mjs --restore ${codes.file} ${codes.string} ${relays.join(' ')}`;
  finish();
}
