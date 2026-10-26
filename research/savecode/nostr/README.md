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

## Not tested: real relays

This container's network policy blocks every public relay tried: `relay.damus.io`, `nos.lol`, `relay.nostr.band`, `relay.primal.net`, `relay.snort.social` and `nostr.mom`. So the following are **unmeasured**:
- whether free relays accept kind 30078 events of this size;
- how long they keep them;
- how fast they are from a phone.

The local relay checks only the prototype's own protocol code.

To run it live once those hosts are allowed (or from any machine with internet):

```sh
cd research/savecode/nostr && npm install
node demo.mjs wss://relay.damus.io wss://nos.lol wss://relay.primal.net wss://relay.nostr.band
```

It writes `results-live.json`. Run it again days or weeks later with the same code to see how long relays keep backups. That would need a small "restore only" flag; it is not built yet.

## What remains a product decision

- **Rules:** it needs network access and third-party servers, which is an exception to the current "offline, no server" rule. Make it opt-in.
- **Durability:** free relays promise nothing. Keep the local save code or file as the real backup, and treat Nostr as a convenience.
- **Players include kids:** the content is encrypted, but the public key and the timestamps of each backup are public.

## Files

- `backup.mjs`: the module. It is browser-ready; relays are reached with any `WebSocket` class.
- `local-relay.mjs`: a minimal in-memory NIP-01 relay, for tests only.
- `demo.mjs`: the checks above, run locally or live.
- `size.mjs`: the bundle-size measurement.
- `results-local.json`
