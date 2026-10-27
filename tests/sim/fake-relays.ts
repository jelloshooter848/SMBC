/*
 * Nostr relays for the online backup's tests (item 159): a WebSocket class whose sockets talk
 * NIP-01 to an in-memory relay per URL, each with a behaviour: one that keeps what it is sent
 * (replaceable events: the newest per author, kind and d tag), one that refuses writes, one that
 * never answers, one that fails to connect (an HTTP 503, or being offline), one with an event-
 * size cap, and ones that serve a forged signature or tampered content. Real relays are not
 * reachable from the test machine.
 */

/** 'nip09': keeps events like 'accept', and honours NIP-09 `a` deletions: every version of the
 * address up to AND including the request's created_at goes. */
export type RelayMode =
  'accept' | 'nip09' | 'reject' | 'silent' | 'down' | 'wrong-sig' | 'tampered' | { cap: number };

export interface NostrEventLike {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export class FakeRelays {
  readonly modes = new Map<string, RelayMode>();
  /** Events kept, per relay. */
  readonly stored = new Map<string, NostrEventLike[]>();
  /** Every socket opened, by URL (none: nothing was contacted). */
  readonly opened: string[] = [];

  constructor(modes: Record<string, RelayMode>) {
    for (const [u, m] of Object.entries(modes)) this.modes.set(u, m);
  }

  /** Puts an event straight into a relay's store (a forged or older one, say). */
  seed(url: string, ev: NostrEventLike): void {
    this.stored.set(url, [...(this.stored.get(url) ?? []), ev]);
  }

  /** A WebSocket class bound to these relays. */
  get WebSocket(): new (url: string) => unknown {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const relays = this;
    return class FakeSocket {
      onopen: (() => void) | null = null;
      onmessage: ((m: { data: string }) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onclose: ((e: { code: number; reason: string }) => void) | null = null;
      private closed = false;
      constructor(readonly url: string) {
        relays.opened.push(url);
        const mode = relays.modes.get(url) ?? 'down';
        setTimeout(() => {
          if (mode === 'down') this.onerror?.({});
          else this.onopen?.();
        }, 1);
      }
      send(text: string): void {
        if (this.closed) return;
        const msg = JSON.parse(text) as unknown[];
        const mode = relays.modes.get(this.url) ?? 'down';
        const reply = (m: unknown[]): void => {
          setTimeout(() => !this.closed && this.onmessage?.({ data: JSON.stringify(m) }), 1);
        };
        if (mode === 'silent') return;
        if (msg[0] === 'EVENT') {
          const ev = msg[1] as NostrEventLike;
          if (mode === 'reject') return reply(['OK', ev.id, false, 'blocked: kind not allowed']);
          if (typeof mode === 'object' && JSON.stringify(ev).length > mode.cap)
            return reply(['OK', ev.id, false, `invalid: event too large: ${JSON.stringify(ev).length}`]);
          if (mode === 'nip09' && ev.kind === 5) {
            for (const t of ev.tags.filter((x) => x[0] === 'a')) {
              const [kind, pubkey, dTag] = (t[1] ?? '').split(':');
              if (pubkey !== ev.pubkey) continue;
              relays.stored.set(
                this.url,
                (relays.stored.get(this.url) ?? []).filter(
                  (e) =>
                    !(
                      String(e.kind) === kind &&
                      e.pubkey === pubkey &&
                      e.tags.find((x) => x[0] === 'd')?.[1] === dTag &&
                      e.created_at <= ev.created_at
                    ),
                ),
              );
            }
          }
          const d = (e: NostrEventLike) => e.tags.find((t) => t[0] === 'd')?.[1];
          // A replaceable event keeps the newest (strfry's answers): the same event again is a
          // duplicate, an older or same-second one is refused.
          const held = (relays.stored.get(this.url) ?? []).find(
            (e) => e.pubkey === ev.pubkey && e.kind === ev.kind && d(e) === d(ev),
          );
          if (held?.id === ev.id) return reply(['OK', ev.id, true, 'duplicate: have this event']);
          if (held && held.created_at >= ev.created_at)
            return reply(['OK', ev.id, false, 'replaced: have newer event']);
          const kept = (relays.stored.get(this.url) ?? []).filter(
            (e) => !(e.pubkey === ev.pubkey && e.kind === ev.kind && d(e) === d(ev)),
          );
          relays.stored.set(this.url, [...kept, ev]);
          return reply(['OK', ev.id, true, '']);
        }
        if (msg[0] === 'REQ') {
          const sub = msg[1] as string;
          const f = msg[2] as { authors?: string[]; kinds?: number[]; '#d'?: string[] };
          for (const e of relays.stored.get(this.url) ?? []) {
            if (f.authors && !f.authors.includes(e.pubkey)) continue;
            if (f.kinds && !f.kinds.includes(e.kind)) continue;
            let out = e;
            if (mode === 'wrong-sig')
              out = { ...e, sig: e.sig.replace(/^./, (c) => (c === '0' ? '1' : '0')) };
            if (mode === 'tampered') out = { ...e, content: e.content.replace(/^.{4}/, 'AAAA') };
            reply(['EVENT', sub, out]);
          }
          reply(['EOSE', sub]);
        }
      }
      close(): void {
        this.closed = true;
      }
    };
  }
}
