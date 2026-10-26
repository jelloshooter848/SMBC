/*
 * Research only: a minimal NIP-01 relay in memory, so the prototype's own protocol code can be
 * exercised where public relays are unreachable. It verifies signatures, keeps only the newest
 * event per (author, kind, d tag) for kinds 30000-39999 (NIP-01 addressable events), answers REQ
 * with EVENTs then EOSE, and can be told to refuse writes or drop stored events (a relay that
 * pruned). It says nothing about how real relays behave.
 */
import { WebSocketServer } from 'ws';
import { verifyEvent } from 'nostr-tools/pure';
import { matchFilters as match } from 'nostr-tools';

export function startRelay({ port = 0, refuseWrites = false, maxBytes = 65536 } = {}) {
  const events = [];
  const wss = new WebSocketServer({ port });
  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      if (raw.length > maxBytes) return ws.send(JSON.stringify(['NOTICE', 'message too large']));
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return ws.send(JSON.stringify(['NOTICE', 'bad json']));
      }
      if (msg[0] === 'EVENT') {
        const ev = msg[1];
        if (refuseWrites) return ws.send(JSON.stringify(['OK', ev?.id, false, 'blocked: writes refused']));
        if (!verifyEvent(ev)) return ws.send(JSON.stringify(['OK', ev?.id, false, 'invalid: bad signature']));
        if (ev.kind >= 30000 && ev.kind < 40000) {
          const d = ev.tags.find((t) => t[0] === 'd')?.[1] ?? '';
          const i = events.findIndex((x) => x.pubkey === ev.pubkey && x.kind === ev.kind && (x.tags.find((t) => t[0] === 'd')?.[1] ?? '') === d);
          if (i >= 0) {
            if (events[i].created_at > ev.created_at) return ws.send(JSON.stringify(['OK', ev.id, true, 'duplicate: have newer']));
            events.splice(i, 1);
          }
        }
        events.push(ev);
        return ws.send(JSON.stringify(['OK', ev.id, true, '']));
      }
      if (msg[0] === 'REQ') {
        const [, sub, ...filters] = msg;
        const limit = Math.min(...filters.map((f) => f.limit ?? 500));
        const hits = events.filter((e) => match(filters, e)).sort((a, b) => b.created_at - a.created_at).slice(0, limit);
        for (const e of hits) ws.send(JSON.stringify(['EVENT', sub, e]));
        return ws.send(JSON.stringify(['EOSE', sub]));
      }
    });
  });
  return new Promise((resolve) =>
    wss.on('listening', () =>
      resolve({
        url: `ws://127.0.0.1:${wss.address().port}`,
        events,
        /** Forget everything (a relay that pruned old events). */
        prune: () => events.splice(0),
        /** Store an event as is, without checks (a relay serving a forged or foreign event). */
        inject: (e) => events.push(e),
        close: () => new Promise((r) => wss.close(r)),
      }),
    ),
  );
}
