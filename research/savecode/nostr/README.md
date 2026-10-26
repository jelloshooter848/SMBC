# Nostr save backup: prototype

Research only. This is not game code, and nothing under `src/` changed.

**The idea:** the game uploads the save as it is (the whole JSON file, or a save code) to a few free Nostr relays. The player keeps a **10-character backup code** such as `7KQ2M-X9PDA`, and that code alone brings the save back on any device.

**M** = MEASURED by `demo.mjs` (Node, this container). **F** = FORECAST.

## Why the code is 10 characters, not a 63-character note ID

A Nostr event ID (`note1…`) is a 256-bit hash. It is random, so it cannot be compressed or made shorter. The prototype therefore does not keep the ID at all: **the code is the key.**

1. The game makes 10 random characters from the Crockford Base32 alphabet, the same one the save codes use (50 bits).
2. `scrypt(code)` turns them into a Nostr secret key. The matching public key is the "author" to ask the relays for.
3. The backup is a kind-30078 event (NIP-78, application data) with the tag `d = smbc-remix/backup/v1`:
   - Nostr clients do not show this kind as a post, so backups never appear in anyone's feed.
   - It is replaceable: uploading again with the same code replaces the old backup. One code works for the player's whole life.
4. The save text is encrypted to that same key (NIP-44). Relays and anyone scraping them see only an opaque blob.
5. To restore, the player types the code, the game derives the key, asks the relays for that author's backup, checks the signature and decrypts.

Typing is as forgiving as the existing save codes: any case, spaces or dashes, and O, I and L read as 0, 1 and 1.

**Could the code be shorter or easier to remember?**
- **Shorter:** each character removed cuts the guessing cost by 32×. 8 characters (40 bits) would still take an attacker years of CPU per player (see below), so 8 is defensible for game saves. 10 is the comfortable choice.
- **Words instead of characters:** 5 words from a 1,024-word list carry the same 50 bits. A game-themed word list, such as `KOOPA-PIPE-STAR-…`, would be more memorable, but someone has to write the list (not done here).
- **A typo check:** an 11th character as a checksum would let the game say "that code looks mistyped" rather than "no backup found" (not done here).

## Results (M, local in-process relays)

All 14 checks passed (`results-local.json`).

**Sizes:**

| Save | Event |
| --- | --- |
| Synthetic whole-profile JSON (23,104 bytes) | 33,234 bytes (NIP-44 adds base64) |
| The 2,941-character `z` string | 4,562 bytes |

Everything fits under typical relay caps. Saves over 40 KB are refused before upload.

**Behaviour:**
- **Upload:** two relays accepted it, one refused writes, and one was offline. Upload succeeds when any relay accepts.
- **Restore** with only the code (typed loosely) gave the file back byte for byte, in about 20 ms plus the key derivation.
- **Re-upload** under the same code: the restore returns the newest backup.
- **A mistyped code** finds nothing. It derives a different key.
- **A relay serving a tampered or forged event:** the event was rejected, and the real backup still restored from another relay.
- **One relay pruned the backup:** it still restored from another relay. **All relays pruned it: the backup is gone.**

**Costs:**
- Key derivation: scrypt N = 2^15, r = 8, which takes **177–200 ms and 32 MB** per derive in Node (M). Expect about 0.3–1 s on a phone (**F**). It runs once per code.
- Bundle: **24 KB gzip** (61 KB minified) for `backup.mjs` with nostr-tools, noble and scrypt (M, `node size.mjs`).

**Guessing someone's code.** An attacker would have to scrape every SMBC backup event, then run one scrypt per guess.
- With 50 bits, one CPU core needs about 6 million years to search all codes (M rate).
- Searching against 10,000 players at once to hit *any* one: about 700 core-years. A GPU farm could cut that substantially (**F**).
- Winning would let the attacker read or overwrite one random stranger's game save. This is low stakes, and it is the same exposure as someone seeing a save code today.

## Live relays (MEASURED)

Measured on 2026-10-26 from this container, through its HTTPS proxy (data-centre network, not a phone). Two full live runs, about 4 minutes apart (22:24 and 22:29 UTC); each run uploads two backups under two new codes:
- the whole JSON file (33,234-byte event);
- the `z` string (4,562-byte event).

Raw data: `results-live.json`, `results-size-limits.json`, `results-retention.json`.

Changes to the prototype for live use:
- `publish` and `query` now record `NOTICE`, `AUTH` and `CLOSED` frames, and the time each relay took.
- A socket the relay closes ends the wait with its close code; before, the prototype waited for the timeout.
- Under Node, a failed connection includes the reason (e.g. `Unexpected server response: 403`). Browsers give none.
- Live mode tests each relay on its own and uses two codes, so each save size can be re-checked later.
- New `--restore` mode.
- New `size-limits.mjs`.

The protocol is unchanged. No relay needed NIP-42 AUTH to accept a write: only paid nostr.land sent `AUTH`, and it refuses unpaid keys either way.

### Per relay (M)

Restore times are for that one relay alone, with only the code. They exclude the scrypt derive, which is 140 ms here.

| Relay | Software, cap | 33 KB file | 4.5 KB string | Restore file / string (ms) | Notes |
| --- | --- | --- | --- | --- | --- |
| `wss://nos.lol` | strfry 1.1.3, **64 KB event cap** | OK | OK | 695 / 595, 644 / 516 | Took 64.0 KB; refused 66.0 KB: `invalid: event too large: 65986` |
| `wss://relay.primal.net` | strfry 1.1.3 | OK | OK | 734 / 638, 773 / 620 | Took 200 KB |
| `wss://nostr.mom` | strfry 1.1.3, **64 KB event cap** | OK | OK | 647 / 551, 642 / 513 | Same cap and message as nos.lol |
| `wss://nostr-pub.wellorder.net` | nostr-rs-relay 0.9.0 | OK | OK | 504 / 423, 555 / 399 | Took 200 KB. Different software from the rest, which adds diversity |
| `wss://nostr.oxtr.dev` | strfry 1.0.4 | OK | OK | 648 / 551, 652 / 522 | Took 128 KB; 200 KB: socket closed 1006 |
| `wss://relay.nostr.net` | strfry, aggregator | OK | OK | 887 / 791, 973 / 717 | Often answers `duplicate: have this event`: it copies events from other relays |
| `wss://relay.damus.io` | strfry | run 1 OK, run 2 **HTTP 503** | OK | 387 / 446, — / 322 | **Unreliable at connect.** It answered `Unexpected server response: 503` to many connections (3 of 9 in the size test, and 1 of 3 uploads in run 2). Took 200 KB when it connected |
| `wss://offchain.pub` | strfry 1.1.0, web of trust | **refused** | run 1 refused, run 2 OK | — / 274 | `Policy violated and pubkey is not in our web of trust.` It later accepted newer events from keys it had refused: inconsistent |
| `wss://nostr.bitcoiner.social` | strfry 1.1.0, web of trust | **refused** | run 1 refused, run 2 OK | — / 510 | Same message and behaviour as offchain.pub |
| `wss://relay.nos.social` | strfry 1.0.3 | **refused** | **refused** | — | `blocked: kind not allowed` (kind 30078) |
| `wss://relay.snort.social` | memlay 0.2.0 (in-memory) | no answer | no answer | — | Connects and answers REQ, but never sends OK within 10 s, at any size. In-memory, so retention is unlikely anyway |
| `wss://nostr.land` | NFDB, paid | **refused** | **refused** | — | Sends an `AUTH` challenge, then `restricted: Pay on https://nostr.land for access.` |
| `wss://nostr.wine` | paid | **refused** | **refused** | — | HTTP 403 on the WebSocket upgrade |
| `wss://relay.nostr.band` | — | down | down | — | `read ECONNRESET` or timeout. curl also times out |
| `wss://relay.nostr.bg` | — | down | down | — | HTTP 502 |
| `wss://relay.mostr.pub` | — | down | down | — | HTTP 301; no relay at this URL |

**Upload time (M):** 0.8–1.7 s for the 33 KB file and 0.4–1.0 s for the string, per relay, in parallel.

**Restore from every relay at once (M):** 7.3 s in both runs. That is the slowest relays timing out at 10 s, not the data: any single good relay answers in 0.3–1.0 s. The game should keep the first valid backup as soon as it arrives, with a timeout of about 3 s per relay (**F**: about 1 s after the derive on a phone, on a decent connection).

**Replace (M):** a newer upload under the same code replaced the older one on every relay that accepted it. Once, damus answered with no events right after a replace, then returned the event on later queries.

### Retention (M, first data point only)

Restore-only checks (`--restore`, no upload) at 22:34 UTC and three times at 23:01 UTC. The 23:01 checks were **31–37 minutes after upload**. All three gave the same picture:

| Relay | File, run 1 | String, run 1 | File, run 2 | String, run 2 |
| --- | --- | --- | --- | --- |
| nos.lol, relay.primal.net, nostr.mom, nostr.oxtr.dev, nostr-pub.wellorder.net, relay.nostr.net | kept | kept | kept | kept |
| relay.snort.social | kept | kept | kept | kept |
| relay.damus.io | 503 on connect | 503 on connect, then kept | not there (that upload got 503) | kept |
| offchain.pub, nostr.bitcoiner.social | not there | kept | not there | kept |

- Every save a relay accepted was still there and matched the upload byte for byte (sha-256 check).
- **Nothing was pruned** in about 35 minutes.
- relay.snort.social never answered OK, yet it serves all four backups. Most likely it copies them from other relays.
- The two web-of-trust relays refused every direct write, yet serve the small strings, and only the newer replacement. Most likely they copy from other relays too, but not 33 KB events.
- Restore time per relay with only the code was 0.5–1.2 s.

This is minutes, not weeks. Free relays promise nothing, and strfry operators prune by age or disk use. Real retention needs re-checks of the same four codes after 1 day, 1 week and 1 month. The command restores without uploading and appends a run to `results-retention.json`:

```sh
cd research/savecode/nostr && npm install
node demo.mjs --restore JPCFA-5HFPT YRT7G-ZPMVR T4EJC-ZYKHV FN1XX-M3ZVV \
  wss://relay.damus.io wss://nos.lol wss://relay.primal.net wss://nostr.mom wss://relay.nostr.net \
  wss://offchain.pub wss://nostr.oxtr.dev wss://nostr-pub.wellorder.net wss://nostr.bitcoiner.social wss://relay.snort.social
```

| Code | Save | Uploaded (UTC) |
| --- | --- | --- |
| `JPCFA-5HFPT` | 33 KB file | 2026-10-26 22:24 |
| `YRT7G-ZPMVR` | 4.5 KB string (replaced once) | 2026-10-26 22:25 |
| `T4EJC-ZYKHV` | 33 KB file | 2026-10-26 22:29 |
| `FN1XX-M3ZVV` | 4.5 KB string (replaced once) | 2026-10-26 22:30 |

These are throwaway codes for synthetic test saves, so publishing them here is harmless.

### Recommended defaults

Use **5 relays**: `wss://relay.primal.net`, `wss://nos.lol`, `wss://nostr.mom`, `wss://nostr-pub.wellorder.net` and `wss://nostr.oxtr.dev`.
- All five accepted both sizes in both runs and restored byte for byte in 0.4–0.8 s (M).
- They are four operators on two relay programs.
- Upload to all of them, and count the backup as made when at least 2 accept.

Possible extras:
- `wss://relay.damus.io` is popular and takes large events, but often answered 503 on connect (M).
- `wss://relay.nostr.net` works, but it copies other relays' events, so it adds little independent durability.

Avoid:
- the web-of-trust relays (offchain.pub, nostr.bitcoiner.social), which refuse new keys;
- relay.nos.social, which blocks kind 30078;
- paid relays (nostr.land, nostr.wine);
- relay.snort.social (no OK, in-memory);
- the dead hosts.

Relays come and go (three of the hosts tried are down), so the game should be able to update its relay list without a new release, or at least ship a list longer than it needs (**F**).

### Is a 33 KB save safe?

**Yes today, but send the `z` string by default.**
- The strictest cap measured is **64 KB per event** (nos.lol and nostr.mom, the strfry default; M). The 33 KB file is half of that. The prototype's 40,000-byte save limit makes a **55,078-byte** event (M), which still fits.
- The string is 7× smaller and uploads about twice as fast.
- The string leaves room if the save format grows.
- The string asks less of free relays that are carrying the backup for nothing.

Use the whole file only if the string cannot hold everything the player needs back.

## What remains a product decision

- **Rules:** it needs network access and third-party servers, which is an exception to the current "offline, no server" rule. Make it opt-in.
- **Durability:** free relays promise nothing. Keep the local save code or file as the real backup, and treat Nostr as a convenience.
- **Players include kids:** the content is encrypted, but the public key and the timestamps of each backup are public.

## Files

- `backup.mjs`: the module. It is browser-ready; relays are reached with any `WebSocket` class.
- `local-relay.mjs`: a minimal in-memory NIP-01 relay, for tests only.
- `demo.mjs`: the checks above, run locally (`--local`), live (relay URLs), or restore only (`--restore CODE… relays…`).
- `size-limits.mjs`: uploads events of growing size under a throwaway key, to find each relay's cap.
- `size.mjs`: the bundle-size measurement.
- `results-local.json`, `results-live.json`, `results-size-limits.json`, `results-retention.json`
