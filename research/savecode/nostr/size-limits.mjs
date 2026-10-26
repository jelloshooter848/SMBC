/*
 * Research only. How big an event each relay takes: kind-30078 events of growing size, signed by a
 * throwaway key under d = 'smbc-remix/size-probe' (not the backup tag), random base64 content.
 *   node size-limits.mjs wss://nos.lol wss://relay.primal.net …
 * Writes results-size-limits.json next to this file.
 */
import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import WebSocket from 'ws';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { finalizeEvent, generateSecretKey } from 'nostr-tools/pure';
import { publish } from './backup.mjs';

const HERE = new URL('.', import.meta.url).pathname;
const relays = process.argv.slice(2).filter((a) => a.startsWith('ws'));
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const agent = proxy ? new HttpsProxyAgent(proxy) : undefined;
const W = class extends WebSocket {
  constructor(url) {
    super(url, { agent });
  }
};
const sizes = [16_000, 33_000, 48_000, 60_000, 64_000, 66_000, 100_000, 128_000, 200_000];
const sk = generateSecretKey();
const out = { at: new Date().toISOString(), note: 'event_bytes is the JSON event; the EVENT frame adds ~11 bytes', rows: [] };
for (const target of sizes) {
  const base = finalizeEvent({ kind: 30078, created_at: Math.floor(Date.now() / 1000), tags: [['d', 'smbc-remix/size-probe']], content: '' }, sk);
  const pad = target - Buffer.byteLength(JSON.stringify(base));
  const ev = finalizeEvent({ kind: 30078, created_at: Math.floor(Date.now() / 1000), tags: [['d', `smbc-remix/size-probe/${target}`]], content: randomBytes(pad).toString('base64').slice(0, pad - 20) }, sk);
  const event_bytes = Buffer.byteLength(JSON.stringify(ev));
  for (const r of await publish(relays, ev, { WebSocket: W, timeoutMs: 10000 })) {
    out.rows.push({ relay: r.url, event_bytes, accepted: r.ok, message: r.message, ...(r.notices ? { notices: r.notices } : {}) });
    console.log(`${String(event_bytes).padStart(7)} ${r.ok ? 'OK  ' : 'NO  '} ${r.url} ${r.message}`);
  }
}
writeFileSync(`${HERE}results-size-limits.json`, JSON.stringify(out, null, 2));
